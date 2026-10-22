import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { ColumnValue, GridError, ResolvedColumn, RowId } from '../../core/types';
import { toGridError } from '../../core/errors';
import { toText } from '../../core/values';
import { classes } from '../context';
import { useCellTabIndex } from '../navigation/context';
import type { CellContext, GridwrightColumn } from '../types';

declare module 'apsw-gridwright/react' {
    // Declared from the add-on, through the package's own specifier, the same way a third-party
    // add-on adds a column option.
    interface GridwrightColumn<TRow, TValue> {
        /**
         * Makes the column editable in place, when the grid lists `inlineEditing()`. Opt-in per
         * column: a grid where every cell turns into a text box on click is a grid nobody can read.
         */
        readonly edit?: ColumnEditOptions<TRow, TValue>;
    }
}

export interface EditorContext<TRow, TValue = ColumnValue> {
    readonly value: TValue;
    readonly row: TRow;
    readonly rowId: RowId;
    readonly column: ResolvedColumn<TRow, TValue>;
    /** Writes the value and closes the editor. */
    readonly commit: (next: TValue) => void;
    readonly cancel: () => void;
}

export interface ColumnEditOptions<TRow, TValue = ColumnValue> {
    readonly editable?: boolean | ((row: TRow) => boolean);
    /** Replaces the built-in input entirely. */
    readonly editor?: (context: EditorContext<TRow, TValue>) => ReactNode;
    readonly inputType?: 'text' | 'number' | 'date' | 'checkbox' | 'select';
    readonly choices?: readonly { readonly value: string; readonly label: string }[];
    /** Turns the raw input string into the value the row should carry. */
    readonly parse?: (input: string) => TValue;
}

export type CommitEdit = (
    rowId: RowId,
    columnId: string,
    value: ColumnValue,
) => Promise<void> | void;

interface EditingCell {
    readonly rowId: RowId;
    readonly columnId: string;
}

export interface InlineEditController {
    readonly editing: EditingCell | null;
    readonly pendingRowIds: ReadonlySet<RowId>;
    getError(rowId: RowId, columnId: string): GridError | null;
    begin(rowId: RowId, columnId: string): void;
    cancel(): void;
    commit(rowId: RowId, columnId: string, value: ColumnValue): void;
    isEditing(rowId: RowId, columnId: string): boolean;
}

const InlineEditContext = createContext<InlineEditController | null>(null);

export interface InlineEditProviderProps {
    /**
     * Persists one field. In a tree grid this is usually `tree.updateRow`, which already applies
     * the change optimistically and rolls it back if this rejects.
     */
    readonly commit: CommitEdit;
    /**
     * Whether a record is among the rows the grid has settled on; null while it has not settled. An editor
     * open on a record that is no longer among them is closed, because the cell that held it is gone and
     * nothing would otherwise say so: the editing state would wait, and open an editor again, showing the
     * stored value instead of the text typed, the moment that record came back to the page. Leave it out
     * and the editor is left alone. It is asked about the id the editor was opened with, the one a
     * `commit` receives, which under `treeData()` is the record's and not the placement's.
     */
    readonly isPresent?: ((rowId: RowId) => boolean) | null;
    readonly children: ReactNode;
}

export function InlineEditProvider({ commit, isPresent, children }: InlineEditProviderProps) {
    const controller = useInlineEdit(commit, isPresent);
    return <InlineEditContext.Provider value={controller}>{children}</InlineEditContext.Provider>;
}

export function useInlineEditContext(): InlineEditController {
    const value = useContext(InlineEditContext);
    if (!value) {
        throw new Error('[gridwright] an editable column must be rendered inside <InlineEditProvider>.');
    }
    return value;
}

/**
 * The editing state machine: which cell is open, what is in flight, what failed.
 *
 * It holds no row data. Applying and reverting a value is the job of whatever `commit` is wired
 * to, which in a tree grid is the controller that already does optimistic updates with rollback.
 * Two implementations of that would be two behaviours to keep in step.
 */
export function useInlineEdit(commit: CommitEdit, isPresent?: ((rowId: RowId) => boolean) | null): InlineEditController {
    const [editing, setEditing] = useState<EditingCell | null>(null);
    // Writes in flight per row. A row can have several, one per column, and it is saved only when the last
    // of them settles; a plain set let the first to finish unmark a row that still had a write on the wire.
    const [inFlight, setInFlight] = useState<ReadonlyMap<RowId, number>>(() => new Map());
    const pendingRowIds = useMemo<ReadonlySet<RowId>>(() => new Set(inFlight.keys()), [inFlight]);
    const [errors, setErrors] = useState<ReadonlyMap<string, GridError>>(() => new Map());

    const latestCommit = useRef(commit);
    latestCommit.current = commit;

    // Only while editing, so a grid nobody is editing pays nothing for it. Dropping the state rather than
    // keeping it is the point: the draft lived in the cell, which is gone, so there is nothing to resume.
    useEffect(() => {
        if (editing === null || !isPresent) return;
        if (!isPresent(editing.rowId)) setEditing(null);
    }, [editing, isPresent]);

    const key = (rowId: RowId, columnId: string): string => `${String(rowId)}\u0000${columnId}`;

    return useMemo<InlineEditController>(
        () => ({
            editing,
            pendingRowIds,

            getError: (rowId, columnId) => errors.get(key(rowId, columnId)) ?? null,

            isEditing: (rowId, columnId) =>
                editing !== null && editing.rowId === rowId && editing.columnId === columnId,

            begin(rowId, columnId) {
                setErrors((current) => {
                    if (!current.has(key(rowId, columnId))) return current;
                    const next = new Map(current);
                    next.delete(key(rowId, columnId));
                    return next;
                });
                setEditing({ rowId, columnId });
            },

            cancel: () => setEditing(null),

            commit(rowId, columnId, value) {
                // Closed immediately. Leaving the editor open while a request is in flight invites
                // a second edit on top of the first, and the two arrive out of order.
                setEditing(null);
                setInFlight((current) => new Map(current).set(rowId, (current.get(rowId) ?? 0) + 1));

                void Promise.resolve(latestCommit.current(rowId, columnId, value))
                    .catch((error: unknown) => {
                        setErrors((current) => new Map(current).set(key(rowId, columnId), toGridError(error)));
                    })
                    .finally(() => {
                        setInFlight((current) => {
                            const next = new Map(current);
                            const remaining = (current.get(rowId) ?? 1) - 1;
                            if (remaining > 0) next.set(rowId, remaining);
                            else next.delete(rowId);
                            return next;
                        });
                    });
            },
        }),
        [editing, pendingRowIds, errors],
    );
}

/**
 * Wraps columns so a cell marked editable opens an input when activated.
 *
 * Editing is opt-in per column, because a grid where every cell turns into a text box on click is
 * a grid nobody can read.
 */
export function editableColumns<TRow>(
    columns: readonly GridwrightColumn<TRow, ColumnValue>[],
): readonly GridwrightColumn<TRow, ColumnValue>[] {
    return columns.map((column) => {
        const edit = column.edit;
        if (!edit) return column;

        const original = column.cell;
        const format = column.formatValue;
        const icon = column.icon;

        return {
            ...column,
            // The icon moves inside the trigger, so clicking it starts editing like clicking the
            // text does. Left where it was, it is a dead patch in the middle of a control, and the
            // reader who aimed at it concludes the cell is not editable.
            ...(icon ? { icon: undefined } : {}),
            cell: (context: CellContext<TRow, ColumnValue>) => (
                <EditableCell
                    context={context}
                    options={edit}
                    {...(icon ? { icon: icon(context) } : {})}
                    // Formatted from the value and the row rather than through the resolved column,
                    // because another wrapper may have rewritten that column for a different row
                    // type. The value and the row are always the consumer's.
                    render={() =>
                        original
                            ? original(context)
                            : format
                              ? format(context.value, context.row)
                              : toText(context.value)
                    }
                />
            ),
        };
    });
}

function EditableCell<TRow>({
    context,
    options,
    render,
    icon,
}: {
    context: CellContext<TRow, ColumnValue>;
    options: ColumnEditOptions<TRow, ColumnValue>;
    render: () => ReactNode;
    icon?: ReactNode;
}) {
    const controller = useInlineEditContext();
    const { rowId, column, row, value } = context;

    const allowed =
        typeof options.editable === 'function' ? options.editable(row) : options.editable !== false;

    const active = controller.isEditing(rowId, column.id);
    const pending = controller.pendingRowIds.has(rowId);
    const error = controller.getError(rowId, column.id);
    const tabIndex = useCellTabIndex();

    // What had focus when the editor was closed. When that element is gone once the button is back,
    // closing the editor is what removed it -- Enter, Escape, choosing an option -- and focus would
    // otherwise fall to <body>, taking a keyboard reader out of the grid. Clicking away closes the
    // editor too, but focus is on what was clicked by then, which is still there, so it stays put.
    const focusedAtClose = useRef<Element | null>(null);
    const close = (then: () => void): void => {
        focusedAtClose.current = typeof document === 'undefined' ? null : document.activeElement;
        then();
    };
    const returnFocus = useCallback((button: HTMLButtonElement | null): void => {
        const previous = focusedAtClose.current;
        focusedAtClose.current = null;
        if (button && previous && previous !== previous.ownerDocument.body && !previous.isConnected) {
            button.focus({ preventScroll: true });
        }
    }, []);

    const withIcon = (content: ReactNode): ReactNode =>
        icon === undefined || icon === null || icon === false ? (
            content
        ) : (
            <>
                <span className="gw-icon" aria-hidden="true">
                    {icon}
                </span>
                {content}
            </>
        );

    // A cell that cannot be edited on this row still shows its icon: the icon describes the row,
    // not the control.
    if (!allowed) return <span className="gw-cell-content">{withIcon(render())}</span>;

    if (active) {
        const editorContext: EditorContext<TRow, ColumnValue> = {
            value,
            row,
            rowId,
            column,
            commit: (next) => close(() => controller.commit(rowId, column.id, next)),
            cancel: () => close(() => controller.cancel()),
        };

        return options.editor ? (
            <>{options.editor(editorContext)}</>
        ) : (
            <DefaultEditor context={editorContext} options={options} />
        );
    }

    return (
        <button
            ref={returnFocus}
            type="button"
            tabIndex={tabIndex}
            className={classes('gw-edit-trigger', pending && 'gw-edit-trigger--pending', error && 'gw-edit-trigger--error')}
            // A real button, so the cell is reachable by Tab and announced as activatable. A div
            // with an onClick is invisible to everyone not using a mouse.
            onClick={(event) => {
                event.stopPropagation();
                controller.begin(rowId, column.id);
            }}
            title={error?.message}
            aria-describedby={error ? `${String(rowId)}-${column.id}-error` : undefined}
        >
            {withIcon(render())}
            {error && (
                <span id={`${String(rowId)}-${column.id}-error`} className="gw-visually-hidden" role="alert">
                    {error.message}
                </span>
            )}
        </button>
    );
}

function DefaultEditor<TRow>({
    context,
    options,
}: {
    context: EditorContext<TRow, ColumnValue>;
    options: ColumnEditOptions<TRow, ColumnValue>;
}) {
    const inputType = options.inputType ?? 'text';
    const [draft, setDraft] = useState(() =>
        inputType === 'checkbox' ? String(Boolean(context.value)) : String(context.value ?? ''),
    );
    const ref = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

    useEffect(() => {
        ref.current?.focus();
        if (ref.current instanceof HTMLInputElement && inputType !== 'checkbox') ref.current.select();
    }, [inputType]);

    const parse = useCallback(
        (raw: string): ColumnValue => {
            if (options.parse) return options.parse(raw);
            if (inputType === 'number') return raw === '' ? null : Number(raw);
            if (inputType === 'checkbox') return raw === 'true';
            return raw;
        },
        [options, inputType],
    );

    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Enter') {
            event.preventDefault();
            context.commit(parse(draft));
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            context.cancel();
        }
    };

    if (inputType === 'select') {
        return (
            <select
                ref={ref as React.RefObject<HTMLSelectElement>}
                className="gw-editor gw-select"
                value={draft}
                aria-label={context.column.header}
                onChange={(event) => {
                    setDraft(event.target.value);
                    context.commit(parse(event.target.value));
                }}
                onKeyDown={onKeyDown}
                onBlur={() => context.cancel()}
            >
                {(options.choices ?? []).map((choice) => (
                    <option key={choice.value} value={choice.value}>
                        {choice.label}
                    </option>
                ))}
            </select>
        );
    }

    if (inputType === 'checkbox') {
        return (
            <input
                ref={ref as React.RefObject<HTMLInputElement>}
                type="checkbox"
                className="gw-editor gw-checkbox"
                checked={draft === 'true'}
                aria-label={context.column.header}
                onChange={(event) => context.commit(event.target.checked)}
                onKeyDown={onKeyDown}
            />
        );
    }

    return (
        <input
            ref={ref as React.RefObject<HTMLInputElement>}
            type={inputType}
            className="gw-editor"
            value={draft}
            aria-label={context.column.header}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            // Blur commits rather than cancels: clicking away from a field you just typed into and
            // losing the text is the single most complained-about behaviour in an editable grid.
            onBlur={() => context.commit(parse(draft))}
        />
    );
}

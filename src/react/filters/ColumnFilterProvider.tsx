import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, KeyboardEvent } from 'react';
import type { FilterOperator } from '../../core/types';
import { useAddonMessages } from '../addons/context';
import { classes, useGridwrightContext } from '../context';
import { FILTERS_ADDON, filterMessages, operatorLabel } from './messages';
import { draftFrom, filterTypeOf, operatorsFor, specFrom, takesNoValue } from './operators';
import type { FilterDraft } from './operators';
import type { ColumnFilterProviderProps } from './types';

export interface ColumnFilterContextValue {
    /** The column whose dialog is open, or null. */
    readonly openColumnId: string | null;
    readonly dialogId: string;
    open(columnId: string): void;
    close(returnFocus: boolean): void;
    /** A stable ref callback for a column's trigger, so the provider can measure it and focus it. */
    triggerRef(columnId: string): (element: HTMLButtonElement | null) => void;
    /** Focuses a column's trigger, or the first trigger on screen when no column is named. */
    focusTrigger(columnId?: string): void;
}

const ColumnFilterContext = createContext<ColumnFilterContextValue | null>(null);

/** The provider's value, or null outside one. The header asks this to decide whether to draw triggers. */
export const useOptionalColumnFilters = (): ColumnFilterContextValue | null => useContext(ColumnFilterContext);

export function useColumnFilters(): ColumnFilterContextValue {
    const value = useContext(ColumnFilterContext);
    if (!value) {
        throw new Error(
            '[gridwright] a column filter part must be rendered inside <ColumnFilterProvider>, or in a grid with the columnFilters() add-on.',
        );
    }
    return value;
}

/**
 * Column filtering for the grid below it: which column's dialog is open, and the dialog itself.
 *
 * There is one dialog, rendered here after the children rather than inside a header cell, for two
 * reasons found in the markup. The table wrapper scrolls, and a scroll container clips, so a dialog
 * inside the table is cut off, worst of all under the one-row table a filter that matched nothing
 * leaves behind. And anything inside a `<th>` is part of that column header's accessible name, which
 * a screen reader repeats on every cell of the column. Rendered here, it is still inside the grid
 * root, so it keeps the theme, the direction and the language.
 */
export function ColumnFilterProvider({ children }: ColumnFilterProviderProps) {
    const { columns } = useGridwrightContext();
    const [openColumnId, setOpenColumnId] = useState<string | null>(null);
    const dialogId = useId();

    const openRef = useRef(openColumnId);
    openRef.current = openColumnId;

    const triggers = useRef(new Map<string, HTMLButtonElement>());
    const refCallbacks = useRef(new Map<string, (element: HTMLButtonElement | null) => void>());

    const triggerRef = useCallback((columnId: string) => {
        let callback = refCallbacks.current.get(columnId);
        if (!callback) {
            // Cached per column, so a header re-render passes the same function and React does not
            // detach and re-attach the element on every state publish.
            callback = (element) => {
                if (element) {
                    triggers.current.set(columnId, element);
                    return;
                }
                triggers.current.delete(columnId);
                // The column went away under its own open dialog: hidden, or dropped from the set.
                // Checked a microtask later, because React detaches and re-attaches a ref inside one
                // commit when it re-mounts a cell, and that is not the column going away.
                queueMicrotask(() => {
                    if (openRef.current === columnId && !triggers.current.get(columnId)?.isConnected) {
                        setOpenColumnId(null);
                    }
                });
            };
            refCallbacks.current.set(columnId, callback);
        }
        return callback;
    }, []);

    const latestColumns = useRef(columns);
    latestColumns.current = columns;

    const focusTrigger = useCallback((columnId?: string) => {
        if (columnId !== undefined) {
            triggers.current.get(columnId)?.focus();
            return;
        }
        // In column order rather than registration order, which Strict Mode and re-mounts shuffle.
        for (const column of latestColumns.current) {
            const element = triggers.current.get(column.id);
            if (element?.isConnected) {
                element.focus();
                return;
            }
        }
    }, []);

    const close = useCallback(
        (returnFocus: boolean) => {
            const closing = openRef.current;
            setOpenColumnId(null);
            if (returnFocus && closing !== null) focusTrigger(closing);
        },
        [focusTrigger],
    );

    const open = useCallback((columnId: string) => setOpenColumnId(columnId), []);

    // Stable, so the dialog's listeners are attached once per opening rather than per render.
    const openTrigger = useCallback(
        () => (openRef.current === null ? undefined : triggers.current.get(openRef.current)),
        [],
    );

    const value = useMemo<ColumnFilterContextValue>(
        () => ({ openColumnId, dialogId, open, close, triggerRef, focusTrigger }),
        [openColumnId, dialogId, open, close, triggerRef, focusTrigger],
    );

    return (
        <ColumnFilterContext.Provider value={value}>
            {children}
            {openColumnId !== null && (
                <ColumnFilterDialog
                    // Keyed on the column, so moving from one column's dialog to another's starts
                    // a fresh draft instead of carrying the last column's half-typed value across.
                    key={openColumnId}
                    columnId={openColumnId}
                    dialogId={dialogId}
                    trigger={openTrigger}
                    close={close}
                />
            )}
        </ColumnFilterContext.Provider>
    );
}

const FOCUSABLE = 'select, input, button:not(:disabled)';

function ColumnFilterDialog({
    columnId,
    dialogId,
    trigger,
    close,
}: {
    columnId: string;
    dialogId: string;
    trigger: () => HTMLButtonElement | undefined;
    close: (returnFocus: boolean) => void;
}) {
    const { api, columns, definitions, classNames } = useGridwrightContext();
    const t = useAddonMessages(FILTERS_ADDON, filterMessages);
    const column = columns.find((candidate) => candidate.id === columnId);
    const options = definitions.get(columnId)?.filter;
    const type = filterTypeOf(options);
    const offered = operatorsFor(options);

    const active = api.getFilter(columnId);
    const [draft, setDraft] = useState<FilterDraft>(() => draftFrom(active, options));
    const spec = specFrom(draft, options);

    const dialogRef = useRef<HTMLDivElement | null>(null);
    const conditionRef = useRef<HTMLSelectElement | null>(null);
    // Transparent rather than `visibility: hidden` until measured: a browser refuses to focus an
    // element that is not visible, and the focus below can run before the measurement lands.
    const [position, setPosition] = useState<CSSProperties>({ opacity: 0 });

    // Measured against the viewport, because the dialog is `position: fixed`: that is what lets it
    // hang below a header inside a scrolling wrapper without being clipped by it. Re-measured on any
    // scroll, the wrapper's included, so it follows the header it belongs to.
    const place = useCallback(() => {
        const button = trigger();
        const dialog = dialogRef.current;
        if (!button?.isConnected || !dialog) {
            // The column went away under an open dialog: a hidden column, a column set that changed.
            close(false);
            return;
        }
        const rect = button.getBoundingClientRect();
        const width = dialog.offsetWidth;
        const gutter = 8;
        const rtl = getComputedStyle(dialog).direction === 'rtl';
        const viewport = document.documentElement.clientWidth;
        const preferred = rtl ? rect.right - width : rect.left;
        const left = Math.max(gutter, Math.min(preferred, viewport - width - gutter));
        setPosition({ top: rect.bottom + 4, left });
    }, [trigger, close]);

    useLayoutEffect(() => {
        place();
        // In the same effect as the measurement, so focus never lands before the dialog is placed.
        conditionRef.current?.focus({ preventScroll: true });
    }, [place]);

    useEffect(() => {
        const onPointerDown = (event: Event): void => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (dialogRef.current?.contains(target)) return;
            // The trigger toggles the dialog itself; closing here as well would reopen it on click.
            if (trigger()?.contains(target)) return;
            close(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('scroll', place, true);
            window.removeEventListener('resize', place);
        };
    }, [trigger, close, place]);

    if (!column) return null;

    const update = (patch: Partial<FilterDraft>): void => setDraft((current) => ({ ...current, ...patch }));

    const apply = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        if (!spec) return;
        // Focus first, then the query: a synchronous source re-renders inside `setFilter`, and the
        // reader should already be back on the header when it does.
        close(true);
        api.setFilter(columnId, spec);
    };

    const clear = (): void => {
        close(true);
        api.setFilter(columnId, null);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            close(true);
            return;
        }
        if (event.key !== 'Tab') return;

        // Kept inside while open. The dialog is modal, and Tab landing on a sort button behind it
        // would leave a keyboard reader operating a grid they cannot see past the dialog.
        const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text';
    const valueInput = (key: 'value' | 'to', label: string) => (
        <label className="gw-filter-field">
            <span>{label}</span>
            <input
                type={inputType}
                className="gw-filter-input"
                value={draft[key]}
                {...(type === 'number' ? { step: 'any' } : {})}
                onChange={(event) => update({ [key]: event.target.value })}
            />
        </label>
    );

    return (
        <div
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-label={t('open', { column: column.header })}
            className={classes('gw-filter-dialog', classNames.filterDialog)}
            style={position}
            onKeyDown={onKeyDown}
        >
            <form className="gw-filter-form" onSubmit={apply}>
                <label className="gw-filter-field">
                    <span>{t('condition')}</span>
                    <select
                        ref={conditionRef}
                        className="gw-filter-input"
                        value={draft.operator}
                        onChange={(event) => update({ operator: event.target.value as FilterOperator })}
                    >
                        {offered.map((operator) => (
                            <option key={operator} value={operator}>
                                {operatorLabel(t, operator, type)}
                            </option>
                        ))}
                    </select>
                </label>

                {type === 'select' && !takesNoValue(draft.operator) ? (
                    <fieldset className="gw-filter-choices">
                        <legend>{t('values')}</legend>
                        {(options?.choices ?? []).map((choice, index) => (
                            <label key={index} className="gw-filter-choice">
                                <input
                                    type="checkbox"
                                    className="gw-checkbox"
                                    checked={draft.picked.includes(index)}
                                    onChange={(event) =>
                                        update({
                                            picked: event.target.checked
                                                ? [...draft.picked, index]
                                                : draft.picked.filter((picked) => picked !== index),
                                        })
                                    }
                                />
                                <span>{choice.label}</span>
                            </label>
                        ))}
                    </fieldset>
                ) : draft.operator === 'between' ? (
                    <div className="gw-filter-range">
                        {valueInput('value', t('from'))}
                        {valueInput('to', t('to'))}
                    </div>
                ) : takesNoValue(draft.operator) ? null : (
                    valueInput('value', t('value'))
                )}

                <div className="gw-filter-actions">
                    {active && (
                        <button type="button" className="gw-button gw-filter-clear" onClick={clear}>
                            {t('clear')}
                        </button>
                    )}
                    <button type="submit" className="gw-button gw-filter-apply" disabled={spec === null}>
                        {t('apply')}
                    </button>
                </div>
            </form>
        </div>
    );
}

import { useEffect, useMemo, useRef } from 'react';
import { classes, GridwrightProvider, useGridwrightContext } from './context';
import { GridBody } from './parts/GridBody';
import { GridHeader } from './parts/GridHeader';
import { GridPagination } from './parts/GridPagination';
import { GridStaleNotice } from './parts/GridStaleNotice';
import { GridTable } from './parts/GridTable';
import { GridToolbar } from './parts/GridToolbar';
import { BubbleMenu } from './plugins/BubbleMenu';
import { InlineEditProvider, editableColumns } from './plugins/InlineEdit';
import { GridVirtualBody } from './virtual/GridVirtualBody';
import { TreeProvider } from './tree/context';
import { useTreeGridwright } from './tree/useTreeGridwright';
import type { TreeGridwrightInstance, UseTreeGridwrightOptions } from './tree/useTreeGridwright';
import type { GridwrightInstance, GridwrightProps } from './types';
import { useGridwright } from './useGridwright';
import { useGridAnnouncement } from './a11y/useAnnouncement';

/**
 * The grid.
 *
 * There is one component, and every capability is an option on it rather than a separate export:
 * a tree is `tree={...}`, windowing is `virtual`, row actions are `rowActions={[...]}`, editing is
 * `edit` on the columns that should have it. They compose, so a virtualized tree with a row menu
 * and two editable columns is four props on the same element rather than a different component.
 *
 * Each option is also available on its own for a layout composed by hand: `useGridwright`,
 * `useTreeGridwright`, `GridVirtualBody`, `BubbleMenu`, `InlineEditProvider`. This component is
 * their default arrangement and has no privileged access to any of them.
 */
export function Gridwright<TRow>(props: GridwrightProps<TRow>) {
    // Editing is switched on by one prop, so the component does the column wrapping rather than
    // asking every consumer to call `editableColumns` and remember the order it goes in.
    const columns = useEditableColumns(props.columns, props.onCellEdit !== undefined);
    const resolved = { ...props, columns };

    // Three components rather than conditional hooks: whichever one renders calls the same hooks in
    // the same order every time, which is the rule that matters. Switching a live grid between flat
    // and tree remounts it, which is correct, because it is a different grid.
    if (props.instance) return <ProvidedInstance {...resolved} instance={props.instance} />;
    return props.tree ? <TreeOwned {...resolved} /> : <FlatOwned {...resolved} />;
}

/** True for an instance built by `useTreeGridwright`, whoever built it. */
function isTreeInstance<TRow>(
    instance: GridwrightInstance<TRow>,
): instance is GridwrightInstance<TRow> & TreeGridwrightInstance<unknown> {
    return 'tree' in instance && 'gridColumns' in instance;
}

/**
 * Renders an instance the caller made.
 *
 * An instance from `useTreeGridwright` still needs the tree context and the wrapped columns, or the
 * grid would quietly render as a flat list of nodes. Detecting it here is what keeps
 * `instance={useTreeGridwright(...)}` and `tree={...}` the same grid.
 */
function ProvidedInstance<TRow>(props: GridwrightProps<TRow> & { instance: GridwrightInstance<TRow> }) {
    const { instance } = props;
    if (!isTreeInstance(instance)) return <GridwrightView {...props} />;

    // The columns come from the instance, which already holds the tree-wrapped set, so only the
    // context is missing here.
    return (
        <TreeProvider controller={instance.tree} treeColumnId={instance.treeColumnId}>
            <GridwrightView {...props} />
        </TreeProvider>
    );
}

function useEditableColumns<TRow>(
    columns: GridwrightProps<TRow>['columns'],
    enabled: boolean,
): GridwrightProps<TRow>['columns'] {
    const latest = useRef(columns);
    latest.current = columns;

    // Keyed on what the wrapping actually depends on, not on the array's identity, which changes
    // every render for anyone writing their columns inline. `icon` is in here because the wrapped
    // column carries a copy of it, so a column that gains one has to be wrapped again.
    const signature = columns
        .map((column) => `${column.id}:${column.edit ? '1' : '0'}:${column.icon ? '1' : '0'}`)
        .join('|');

    return useMemo(
        () => (enabled ? editableColumns(latest.current) : latest.current),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [enabled, signature],
    );
}

function FlatOwned<TRow>(props: GridwrightProps<TRow>) {
    const instance = useGridwright<TRow>(props);
    return <GridwrightView {...props} instance={instance} />;
}

function TreeOwned<TRow>(props: GridwrightProps<TRow>) {
    // The grid options and the tree options are one object for the hook. Cast once, here, because
    // both carry a `getRowId` with different arities and the hook's own type is the one that wins.
    const merged = { ...props, ...props.tree!, columns: props.columns };
    const instance = useTreeGridwright<TRow>(merged as unknown as UseTreeGridwrightOptions<TRow>);

    const controllerRef = props.tree?.controllerRef;
    const controller = instance.tree;
    useEffect(() => {
        if (!controllerRef) return;
        controllerRef(controller);
        return () => controllerRef(null);
        // The controller is stable for the life of the grid, so this runs once rather than on
        // every state change. A ref that fired per render would be a render loop for anyone
        // putting it in state, which is the only reason to ask for it.
    }, [controllerRef, controller]);

    return (
        <TreeProvider controller={instance.tree} treeColumnId={instance.treeColumnId}>
            <GridwrightView
                {...props}
                // The engine's rows are tree nodes; the parts read them through the context, which
                // is type-erased at runtime. The consumer's own props stay in terms of their row.
                instance={instance as unknown as GridwrightInstance<TRow>}
            />
        </TreeProvider>
    );
}

function GridwrightView<TRow>({
    instance,
    className,
    classNames,
    locale,
    messages,
    translate,
    labels,
    searchable = false,
    toolbar,
    footer,
    caption,
    hidePagination = false,
    pageSizeOptions,
    virtual,
    rowActions,
    rowActionsTrigger,
    onCellEdit,
    onRowClick,
    renderEmpty,
    renderLoading,
    renderError,
    renderSkeleton,
    'aria-label': ariaLabel,
}: GridwrightProps<TRow> & { instance: GridwrightInstance<TRow> }) {
    const scrollRef = useRef<HTMLDivElement | null>(null);

    // The engine resolves columns in an effect, so for one render after editing is switched off the
    // rows still hold editable cells while the prop is already gone. Those cells throw without a
    // provider, which takes the whole grid down, so the provider stays for as long as a cell might
    // still ask for it rather than for as long as the prop is set.
    const hasEditableColumn = [...instance.definitions.values()].some((column) => column.edit);
    const editing = onCellEdit !== undefined || hasEditableColumn;

    const showToolbar = searchable || toolbar !== undefined;
    const windowing = virtual === true ? {} : virtual;
    // Windowing replaces paging: a scrollbar over the whole result set is the navigation, and page
    // controls underneath it would be a second, disagreeing one.
    const showPagination = !hidePagination && windowing === undefined;

    const body = windowing ? (
        <GridVirtualBody<TRow>
            containerRef={scrollRef}
            {...(windowing.rowHeight !== undefined ? { rowHeight: windowing.rowHeight } : {})}
            {...(windowing.overscan !== undefined ? { overscan: windowing.overscan } : {})}
            {...(onRowClick ? { onRowClick } : {})}
            {...(renderSkeleton ? { renderSkeleton } : {})}
        />
    ) : (
        <GridBody<TRow>
            {...(onRowClick ? { onRowClick } : {})}
            {...(renderEmpty ? { renderEmpty } : {})}
            {...(renderLoading ? { renderLoading } : {})}
            {...(renderError ? { renderError } : {})}
        />
    );

    const grid = (
        <GridRoot className={className} virtualized={windowing !== undefined}>
            {showToolbar && <GridToolbar searchable={searchable}>{toolbar}</GridToolbar>}

            {/* Above the table, so warning about the rows does not move them. */}
            <GridStaleNotice />

            {rowActions && rowActions.length > 0 && (
                <BubbleMenu<TRow>
                    items={rowActions}
                    {...(rowActionsTrigger ? { trigger: rowActionsTrigger } : {})}
                    {...(ariaLabel ? { 'aria-label': `${ariaLabel} row actions` } : {})}
                />
            )}

            <GridTable
                caption={caption}
                aria-label={ariaLabel}
                {...(windowing
                    ? { scrollRef, maxHeight: windowing.height ?? 420 }
                    : {})}
            >
                <GridHeader />
                {body}
            </GridTable>

            {showPagination && <GridPagination {...(pageSizeOptions ? { pageSizeOptions } : {})} />}
            {footer}
        </GridRoot>
    );

    return (
        <GridwrightProvider
            instance={instance}
            classNames={classNames}
            {...(locale !== undefined ? { locale } : {})}
            {...(messages ? { messages } : {})}
            {...(translate ? { translate } : {})}
            {...(labels ? { labels } : {})}
        >
            {editing ? (
                // A stale cell rendered after the prop went away has nowhere to commit to, and
                // dropping that keystroke is the correct answer: the consumer just said no.
                <InlineEditProvider commit={onCellEdit ?? noCommit}>{grid}</InlineEditProvider>
            ) : (
                grid
            )}
        </GridwrightProvider>
    );
}

const noCommit = (): void => {};

function GridRoot({
    className,
    children,
    virtualized = false,
}: {
    className?: string;
    children: React.ReactNode;
    /** Windowing is on, so there are no pages and a from-to range describes the scroll position. */
    virtualized?: boolean;
}) {
    const { classNames, state, columns, labels, translator } = useGridwrightContext();

    // Rebuilt per render rather than memoised: it is one entry per visible column, and a memo keyed
    // on something stable enough to be worth it would be keyed on the column array, whose identity
    // changes every render for anyone writing their columns inline.
    const headers = new Map(columns.map((column) => [column.id, column.header]));

    const announcement = useGridAnnouncement({
        status: state.status,
        error: state.error,
        rowCount: state.rows.length,
        totalRows: state.totalRows,
        isTotalExact: state.isTotalExact,
        firstRowIndex: state.query.pagination.pageIndex * state.query.pagination.pageSize,
        paginated: !virtualized,
        sort: state.query.sort,
        headers,
        labels,
    });

    return (
        <div
            className={classes('gw-root', classNames.root, className)}
            data-status={state.status}
            // Set only for right-to-left, so a grid inside an already-RTL page does not reset
            // itself to the document direction it is nested in.
            dir={translator.direction === 'rtl' ? 'rtl' : undefined}
            lang={translator.locale}
        >
            {/* A visually hidden live region: without it a screen reader gets no announcement at
                all when the rows change under a paginating grid.

                One sentence, never the rows themselves. A region is read out in full every time it
                changes, so `aria-live` on the tbody would recite a hundred and fifty cells on every
                page change, every sort and every keystroke of the search box. */}
            <span className="gw-visually-hidden" role="status" aria-live="polite">
                {announcement}
            </span>
            {children}
        </div>
    );
}

Gridwright.Root = GridRoot;
Gridwright.Toolbar = GridToolbar;
Gridwright.Table = GridTable;
Gridwright.Header = GridHeader;
Gridwright.Body = GridBody;
Gridwright.VirtualBody = GridVirtualBody;
Gridwright.Pagination = GridPagination;
Gridwright.StaleNotice = GridStaleNotice;
Gridwright.RowActions = BubbleMenu;

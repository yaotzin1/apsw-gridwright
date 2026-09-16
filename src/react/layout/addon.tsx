import { useRef } from 'react';
import type { CSSProperties } from 'react';
import type { ColumnValue } from '../../core/types';
import type { AddonContribution, ContributedAttributes, GridAddon, GridContext } from '../addons/types';
import type { GridwrightColumn, UseGridwrightOptions } from '../types';
import { ColumnLayoutProvider, useColumnLayoutController } from './context';
import { GridColumnPicker } from './GridColumnPicker';
import { GridResizeHandle } from './GridResizeHandle';
import { columnWidthProperty, columnWidthVar, layoutColumnsOf, stickyOffsets } from './layout';
import { COLUMN_LAYOUT_ADDON, columnLayoutMessages } from './messages';
import type { ColumnLayoutController, ColumnLayoutOptions, ColumnPin, LayoutColumn } from './types';

/**
 * Column resizing, pinning and visibility, as one add-on because they are one problem.
 *
 * A pinned column sits at an offset that is the sum of the widths of the pinned columns before it,
 * so resizing one moves the rest and hiding one collapses the gap it left. Delivering the three
 * separately would mean three copies of that arithmetic, disagreeing at the edges.
 *
 * The three reach the grid by different routes, which is the point of the contract:
 *
 * - **Widths** are CSS custom properties on the table, contributed through `tableAttributes`, and
 *   read by each cell's own `width`. A drag writes the property directly and commits on release.
 * - **Pinning** is `position: sticky` and a computed offset, contributed through `headerAttributes`,
 *   `cellAttributes`, and -- for another add-on's extra column -- `extraHeaderAttributes` and
 *   `extraCellAttributes`.
 * - **Visibility** is `ColumnDef.hidden`, written through `configure`, so the engine, global search
 *   and every export agree with what the reader can see.
 */
export function columnLayout<TRow>(options: ColumnLayoutOptions = {}): GridAddon<TRow> {
    return {
        name: COLUMN_LAYOUT_ADDON,
        // A named function expression, so the hooks lint rule knows setup is a hook and checks it.
        setup: function useColumnLayoutSetup({ options: gridOptions }) {
            return useLayoutContribution<TRow>(options, gridOptions);
        },
    };
}

/** Everything computed once per render, the moment the first slot asks for it. */
interface Painted {
    readonly properties: CSSProperties;
    readonly header: ReadonlyMap<string, CSSProperties>;
    readonly cell: ReadonlyMap<string, CSSProperties>;
    readonly className: ReadonlyMap<string, string>;
    readonly pinned: ReadonlyMap<string, ColumnPin>;
}

function useLayoutContribution<TRow>(
    options: ColumnLayoutOptions,
    gridOptions: UseGridwrightOptions<TRow>,
): AddonContribution<TRow> {
    const layout = useColumnLayoutController(options, gridOptions.columns);

    // Which columns are hidden, as one comparable string, and the last one the live region was told
    // about. A column appearing or disappearing settles the grid's own state, so the sentence has to
    // come through a contributor: said through `announce` it would be spoken over by the row range
    // that the refetch produces a moment later.
    const hiddenNow = gridOptions.columns.filter((column) => layout.isHidden(column.id)).map((column) => column.id);
    const hiddenKey = hiddenNow.join('|');
    // Starts at what the grid mounted with, so the first change has something to be a change from.
    // A null baseline would spend the first sentence establishing one, and the first column a reader
    // hides is the one they most need to hear about.
    const spoken = useRef(hiddenKey);

    // Computed lazily and once per render of the grid, then read by every slot call. `setup` runs
    // per render, so these closures are this render's; a cell attribute is then a map lookup rather
    // than an arithmetic pass, which matters because it is called once per cell per row.
    let painted: Painted | null = null;
    const paintedFor = (grid: GridContext<TRow>): Painted => (painted ??= paint(grid, layout));

    return {
        messages: columnLayoutMessages,
        provide: (children) => <ColumnLayoutProvider controller={layout}>{children}</ColumnLayoutProvider>,

        // The engine's own idea of which columns exist. Written here rather than by filtering the
        // rendered list, so that everything reading `hidden` agrees with the reader: an export is
        // of the grid on screen, and a column nobody can see is not part of it. Global search is
        // deliberately not one of those things -- `searchable` is the switch for that, and a column
        // hidden from view is not a column nobody wants found. No `columnSignature` contribution is
        // needed here: the grid's own signature already reads `hidden`, and `configure` runs before
        // it is built.
        configure: (current) => ({
            ...current,
            columns: current.columns.map((column) =>
                layout.isHidden(column.id) === (column.hidden === true)
                    ? column
                    : ({ ...column, hidden: layout.isHidden(column.id) } as GridwrightColumn<TRow, ColumnValue>),
            ),
        }),

        // One custom property per column, and the class that puts the table into fixed layout. Both
        // arrive with the add-on: a grid that does not list it keeps the table it had.
        tableAttributes: (grid) => ({ className: 'gw-table--fixed', style: paintedFor(grid).properties }),

        headerAfter: (column) => (layout.canResize(column.id) ? <GridResizeHandle columnId={column.id} /> : null),

        headerAttributes: (column, grid) => attributesFor(paintedFor(grid), column.id, 'header'),
        cellAttributes: (_row, column, grid) => attributesFor(paintedFor(grid), column.id, 'cell'),
        extraHeaderAttributes: (columnId, grid) => attributesFor(paintedFor(grid), columnId, 'header'),
        extraCellAttributes: (_row, columnId, grid) => attributesFor(paintedFor(grid), columnId, 'cell'),

        announce: [
            {
                // Above a filter, below a sort: hiding a column while a sort is settling is not a
                // thing one gesture does, and if it ever were, the sort moved the rows.
                priority: 15,
                key: () => hiddenKey,
                describe: ({ headers, t }) => {
                    const before = spoken.current;
                    spoken.current = hiddenKey;
                    if (before === hiddenKey) return null;

                    const was = new Set(before === '' ? [] : before.split('|'));
                    const now = new Set(hiddenNow);
                    const changed = [...new Set([...was, ...now])].filter((id) => was.has(id) !== now.has(id));
                    // Only when exactly one changed. "Show all columns" changes several, and naming
                    // one of them would tell the reader the others are still hidden.
                    if (changed.length !== 1) return null;

                    const columnId = changed[0]!;
                    return t(now.has(columnId) ? 'hidden' : 'shown', { column: headers.get(columnId) ?? columnId });
                },
            },
        ],

        ...(options.picker === false ? {} : { toolbar: () => <GridColumnPicker /> }),
    };
}

function attributesFor(
    painted: Painted,
    columnId: string,
    part: 'header' | 'cell',
): ContributedAttributes<HTMLTableCellElement> {
    const style = (part === 'header' ? painted.header : painted.cell).get(columnId);
    if (!style) return {};
    const pinned = painted.pinned.get(columnId);
    return {
        style,
        className: painted.className.get(columnId),
        // What a stylesheet of your own hooks onto, and what a test asserts without reading a
        // computed style.
        ...(pinned ? { 'data-pinned': pinned } : {}),
    };
}

/**
 * The whole layout of one render: the table's custom properties, and the style each header and body
 * cell gets.
 *
 * Pure but for reading the grid, and called once per render. Everything a cell needs is in a map by
 * the time the first cell asks, and every cell of one column shares one style object, so React's
 * own diff sees an unchanged style on a render that changed nothing about the layout.
 */
function paint<TRow>(grid: GridContext<TRow>, layout: ColumnLayoutController): Painted {
    const extras = grid.contributions.active.flatMap(({ contribution }) => contribution.columns ?? []);

    // A data column pinned to an edge means the extra columns on that edge are pinned too. The
    // checkbox belongs to the row whose name is pinned, and a checkbox that scrolls out from under
    // that name is worse than nothing being pinned at all.
    const anyPinned = (side: ColumnPin): boolean =>
        grid.columns.some((column) => !column.hidden && layout.pinOf(column.id) === side);

    const columns: readonly LayoutColumn[] = layoutColumnsOf({
        columns: grid.columns.map((column) => ({
            id: column.id,
            hidden: column.hidden,
            width: layout.widthOf(column.id),
            pinned: layout.pinOf(column.id),
        })),
        extras: extras.map(({ id, placement }) => ({ id, placement })),
        extraWidth: (columnId) => layout.widthOf(columnId),
        extraPin: (columnId, placement) => {
            const stated = layout.pinOf(columnId);
            if (stated !== null) return stated;
            const side = placement === 'start' ? 'left' : 'right';
            return anyPinned(side) ? side : null;
        },
    });

    const offsets = stickyOffsets(columns);
    const properties: Record<string, string> = {};
    const header = new Map<string, CSSProperties>();
    const cell = new Map<string, CSSProperties>();
    const className = new Map<string, string>();
    const pinned = new Map<string, ColumnPin>();

    for (const column of columns) {
        properties[columnWidthProperty(column.id)] = `${column.width}px`;

        const width = columnWidthVar(column.id);
        const left = offsets.left.get(column.id);
        const right = offsets.right.get(column.id);
        const offset = left ?? right;

        if (offset === undefined) {
            header.set(column.id, { width });
            cell.set(column.id, { width });
            continue;
        }

        pinned.set(column.id, column.pinned!);
        // Logical, not `left` and `right`: "pinned to the start" lands on the right of a
        // right-to-left page, which is where the start of the row is there.
        const inset = left !== undefined ? { insetInlineStart: `${offset}px` } : { insetInlineEnd: `${offset}px` };
        // The header is already sticky to the top of the wrapper, so a pinned header is sticky in
        // both directions and has to sit above both the headers it scrolls past and the pinned
        // cells that scroll under it.
        header.set(column.id, { width, position: 'sticky', zIndex: 4, ...inset });
        cell.set(column.id, { width, position: 'sticky', zIndex: 2, ...inset });

        const boundary =
            column.id === offsets.lastLeft
                ? ' gw-cell--pinned-left-last'
                : column.id === offsets.firstRight
                  ? ' gw-cell--pinned-right-first'
                  : '';
        className.set(column.id, `gw-cell--pinned${boundary}`);
    }

    // A record of custom properties is a style object React writes verbatim, and one CSS
    // `CSSProperties` cannot describe: it has no index signature for `--*` names.
    return { properties: properties as CSSProperties, header, cell, className, pinned };
}

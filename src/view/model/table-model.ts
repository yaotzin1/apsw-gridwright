import type { ColumnValue, GridRow, ResolvedColumn } from '../../core/types';
import type { ViewAddonContribution, ViewRenderGrid } from '../addon';
import { mergeAttributes } from '../attributes';
import type { ViewLabels } from '../labels';
import { h, text } from '../node';
import type { Attrs, ViewNode } from '../node';
import type { ResolvedSet } from '../resolve';
import { slotValues } from '../resolve';
import { rowNumbering } from './numbering';
import { bodyStatusOf } from './status';

/**
 * The table as plain data: what a renderer draws, with no renderer in it.
 *
 * It is the neutral counterpart of the React shell (`GridRoot`, `GridTable`, `GridHeader`, `GridBody`):
 * the same attributes, the same ARIA numbering, the same status rows, built from the engine's state and
 * the add-ons' contributions. A framework adapter turns it into its own elements, or draws
 * `tableNode(model)` through the node renderer, and has not re-implemented the shell either way.
 *
 * Rows are produced on request. A grid of a million rows pages or windows what it mounts, and building
 * a row model for every row to draw ten of them would put the cost back that virtualization removes.
 */

export interface HeaderCellModel<TRow> {
    readonly column: ResolvedColumn<TRow, ColumnValue>;
    readonly attrs: Attrs;
    /** The cell's content: the sort button, or whatever add-on owns the label, or the header text. */
    readonly label: ViewNode;
}

export interface CellModel {
    readonly columnId: string;
    readonly attrs: Attrs;
    readonly content: ViewNode;
}

export interface RowModel {
    readonly id: string;
    readonly attrs: Attrs;
    readonly cells: readonly CellModel[];
}

export type BodyModel =
    | {
          readonly kind: 'rows';
          readonly busy: boolean;
          readonly rowCount: number;
          /** The row at a zero-based position among the rows on show. Built when asked for. */
          row(index: number): RowModel;
      }
    | {
          readonly kind: 'status';
          readonly status: 'loading' | 'empty' | 'error';
          /** Columns the status cell spans. */
          readonly colSpan: number;
          readonly content: ViewNode;
      };

export interface TableModel<TRow> {
    readonly root: Attrs;
    /** The sentence the live region carries. */
    readonly live: string;
    readonly table: Attrs;
    readonly caption: string | null;
    readonly header: { readonly attrs: Attrs; readonly cells: readonly HeaderCellModel<TRow>[] };
    readonly body: BodyModel;
}

export interface TableModelInput<TRow> {
    readonly grid: ViewRenderGrid<TRow>;
    readonly columns: readonly ResolvedColumn<TRow, ColumnValue>[];
    readonly contributions: ResolvedSet<ViewAddonContribution<TRow>>;
    readonly labels: ViewLabels;
    readonly locale: string;
    readonly direction: 'ltr' | 'rtl';
    /** The live region's current sentence. */
    readonly live: string;
    readonly caption?: string;
    readonly ariaLabel?: string;
}

/** Joins class names, dropping what is empty. */
const classes = (...names: readonly (string | false | null | undefined)[]): string | undefined => names.filter(Boolean).join(' ') || undefined;

/** The status row's default content, which an add-on may replace in the React contract and cannot yet here. */
function statusContent(status: 'loading' | 'empty' | 'error', input: TableModelInput<unknown>, retry: () => void): ViewNode {
    const { labels, grid } = input;
    if (status === 'loading') return h('span', { attrs: { className: 'gw-loading' } }, labels.loading);
    if (status === 'empty') return h('span', { attrs: { className: 'gw-empty' } }, labels.empty);
    const error = grid.state.error;
    return h(
        'div',
        { attrs: { className: 'gw-error', role: 'alert' } },
        h('p', { attrs: { className: 'gw-error-title' } }, labels.errorTitle),
        h('p', { attrs: { className: 'gw-error-message' } }, error?.message ?? ''),
        error?.retryable
            ? h('button', { attrs: { type: 'button', className: 'gw-button' }, on: { click: () => void retry() } }, labels.retry)
            : null,
    );
}

export function buildTableModel<TRow>(input: TableModelInput<TRow>): TableModel<TRow> {
    const { grid, columns, contributions } = input;
    const { state } = grid;
    const numbering = rowNumbering(state.totalRows, state.isTotalExact);
    const active = contributions.active;

    const root = mergeAttributes<Record<string, unknown>>({
        className: 'gw-root',
        'data-status': state.status,
        // Set only for right-to-left, so a grid inside an already-RTL page does not reset itself.
        dir: input.direction === 'rtl' ? 'rtl' : undefined,
        lang: input.locale,
    }) as Attrs;

    const table = mergeAttributes<Record<string, unknown>>({
        className: 'gw-table',
        role: 'grid',
        'aria-label': input.ariaLabel,
        // Counts the header row, because `aria-rowindex` does. The two have to agree.
        'aria-rowcount': numbering.rowCount,
        'aria-busy': state.status === 'loading' || state.status === 'refreshing',
    }) as Attrs;

    const headerOwner = contributions.headerLabel;
    const headerCells: HeaderCellModel<TRow>[] = columns.map((column) => {
        const label =
            headerOwner?.contribution.headerLabel?.(column, grid) ??
            h('span', { attrs: { className: 'gw-header-label' } }, grid.headerContent(column));
        const attrs = mergeAttributes<Record<string, unknown>>(
            {
                scope: 'col',
                className: 'gw-header-cell',
                style: {
                    ...(column.width !== undefined ? { width: column.width } : {}),
                    ...(column.minWidth !== undefined ? { minWidth: column.minWidth } : {}),
                    ...(column.align ? { textAlign: column.align } : {}),
                },
                'data-column-id': column.id,
            },
            ...slotValues(active, 'headerAttributes').map(({ value }) => value(column, grid)),
        ) as Attrs;
        return { column, attrs, label };
    });

    const status = bodyStatusOf(state);
    const body: BodyModel = status
        ? {
              kind: 'status',
              status,
              colSpan: columns.length,
              content: statusContent(status, input as TableModelInput<unknown>, () => void grid.api.refresh()),
          }
        : {
              kind: 'rows',
              busy: state.status === 'refreshing',
              rowCount: state.rows.length,
              row: (index: number): RowModel => {
                  const row = state.rows[index];
                  if (!row) throw new RangeError(`there is no row at position ${index}; the grid shows ${state.rows.length}`);
                  return rowModelOf(row, index, input, numbering.indexOf(state.query.pagination.pageIndex * state.query.pagination.pageSize + index));
              },
          };

    return {
        root,
        live: input.live,
        table,
        caption: input.caption ?? null,
        header: { attrs: { className: 'gw-header-row', 'aria-rowindex': 1 }, cells: headerCells },
        body,
    };
}

function rowModelOf<TRow>(row: GridRow<TRow>, _index: number, input: TableModelInput<TRow>, ariaRowIndex: number): RowModel {
    const attrs = mergeAttributes<Record<string, unknown>>({
        className: 'gw-row',
        'data-row-id': String(row.id),
        'aria-rowindex': ariaRowIndex,
    }) as Attrs;
    const cells: CellModel[] = input.columns.map((column) => ({
        columnId: column.id,
        attrs: mergeAttributes<Record<string, unknown>>({
            className: classes('gw-cell'),
            'data-column-id': column.id,
            style: column.align ? { textAlign: column.align } : undefined,
        }) as Attrs,
        content: text(column.getText(row.data)),
    }));
    return { id: String(row.id), attrs, cells };
}

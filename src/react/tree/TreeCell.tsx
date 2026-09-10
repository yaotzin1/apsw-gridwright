import type { ReactNode } from 'react';
import type { ColumnValue } from '../../core/types';
import { descendantCount } from '../../tree/nested-set';
import type { TreeNode } from '../../tree/types';
import { treeColumn } from '../../tree/columns';
import { useGridwrightContext } from '../context';
import type { CellContext, GridwrightColumn } from '../types';
import { useNodeState, useTreeContext } from './context';

export interface TreeCellProps<TRow> {
    readonly node: TreeNode<TRow>;
    readonly children: ReactNode;
}

/**
 * Indentation and the expand control, wrapped around whatever the column already rendered.
 *
 * The indentation is padding on a spacer rather than nested markup, so the table keeps one cell per
 * column and a screen reader still reads a grid. `aria-level`, `aria-expanded` and `aria-setsize`
 * on the row are what actually convey the shape; the padding is decoration.
 */
export function TreeCell<TRow>({ node, children }: TreeCellProps<TRow>) {
    const { controller } = useTreeContext<TRow>();
    const { labels } = useGridwrightContext();
    const state = useNodeState(node.nodeId);

    const toggleable = node.hasChildren && !node.cyclic;
    const count = descendantCount(node);

    return (
        <span className="gw-tree-cell" style={{ paddingInlineStart: `${node.depth * 16}px` }}>
            {toggleable ? (
                <button
                    type="button"
                    className="gw-tree-toggle"
                    aria-label={state.expanded ? labels.treeCollapse : labels.treeExpand}
                    aria-expanded={state.expanded}
                    data-loading={state.loadState === 'loading' ? 'true' : undefined}
                    onClick={(event) => {
                        // The row underneath may navigate or select. Toggling is not either.
                        event.stopPropagation();
                        controller.toggle(node.nodeId);
                    }}
                >
                    <span className="gw-tree-chevron" aria-hidden="true" />
                </button>
            ) : (
                <span className="gw-tree-toggle gw-tree-toggle--empty" aria-hidden="true" />
            )}

            <span className="gw-tree-label">{children}</span>

            {state.error && (
                // Any failure the controller recorded for this node: children that would not load,
                // or an edit the server refused and rolled back.
                <span className="gw-tree-note gw-tree-note--error" role="alert">
                    {state.error.message ||
                        (state.loadState === 'error' ? labels.treeLoadFailed : '')}
                </span>
            )}

            {node.cyclic && (
                // Saying so beats silently rendering a leaf where the reader expects a subtree.
                <span className="gw-tree-note" title={labels.treeCycle}>
                    {labels.treeCycle}
                </span>
            )}

            {state.expanded && count > 0 && (
                <span className="gw-visually-hidden">{labels.treeChildCount(count)}</span>
            )}
        </span>
    );
}

/**
 * Rewrites columns for a tree grid.
 *
 * The value-reading members are unwrapped by the core helper. This adds the React half: renderers
 * receive your row rather than the node, and the designated column gains the indentation and the
 * toggle.
 */
export function reactTreeColumns<TRow>(
    columns: readonly GridwrightColumn<TRow, ColumnValue>[],
    treeColumnId: string | null,
): readonly GridwrightColumn<TreeNode<TRow>, ColumnValue>[] {
    const firstVisible = columns.find((column) => !column.hidden)?.id ?? null;
    const target = treeColumnId ?? firstVisible;

    return columns.map((column) => {
        const base = treeColumn<TRow>(column) as GridwrightColumn<TreeNode<TRow>, ColumnValue>;
        const { cell, headerCell } = column;

        const renderContent = (context: CellContext<TreeNode<TRow>, ColumnValue>): ReactNode =>
            cell
                ? cell({
                      value: context.value,
                      row: context.row.row,
                      rowId: context.row.rowId,
                      rowIndex: context.rowIndex,
                      column: context.column as never,
                      api: context.api as never,
                  })
                : context.column.getText(context.row);

        return {
            ...base,
            ...(headerCell ? { headerCell: headerCell as never } : {}),
            cell: (context: CellContext<TreeNode<TRow>, ColumnValue>) =>
                column.id === target ? (
                    <TreeCell node={context.row}>{renderContent(context)}</TreeCell>
                ) : (
                    renderContent(context)
                ),
        };
    });
}

import { addonMessages } from '../addons/context';
import type { AddonContribution, GridAddon } from '../addons/types';
import { BubbleMenuView, useBubbleMenu } from './BubbleMenu';
import type { BubbleMenuItem, BubbleMenuTrigger } from './BubbleMenu';
import { InlineEditProvider, editableColumns } from './InlineEdit';
import type { CommitEdit } from './InlineEdit';
import { INLINE_EDITING_ADDON, ROW_ACTIONS_ADDON, rowActionsMessages } from './messages';

export { INLINE_EDITING_ADDON, ROW_ACTIONS_ADDON, rowActionsMessages };

export interface RowActionsOptions<TRow> {
    readonly items: readonly BubbleMenuItem<TRow>[];
    /** What opens the menu. Default `both`: hover and focus float it, a click or the context-menu key pins it. */
    readonly trigger?: BubbleMenuTrigger;
    /** `top` floats it over the row; `bottom` hangs it under the row. Default `top`. */
    readonly placement?: 'top' | 'bottom';
    readonly className?: string;
}

/**
 * Row actions in a floating menu over the row under the pointer or the focus.
 *
 * The menu attaches to rows through `rowAttributes` and floats in the `overlay` slot, so it works over
 * a paged body, a windowed one and a tree alike. `useBubbleMenu` and `BubbleMenuView` are exported,
 * so a menu of your own can be built the same way.
 */
export function rowActions<TRow>(options: RowActionsOptions<TRow>): GridAddon<TRow> {
    return {
        name: ROW_ACTIONS_ADDON,
        // A named function expression, so the hooks lint rule knows setup is a hook and checks it.
        setup: function useRowActionsSetup(): AddonContribution<TRow> {
            const menu = useBubbleMenu(options.trigger ?? 'both');
            if (options.items.length === 0) return { messages: rowActionsMessages };

            return {
                messages: rowActionsMessages,
                // Attached to each row through the contract rather than found in the DOM, so it works
                // for every body that renders rows through `GridRowView`, paged, windowed or a tree.
                rowAttributes: (row) => menu.rowHandlers(row.id),
                overlay: (grid) => (
                    <BubbleMenuView<TRow>
                        controller={menu}
                        items={options.items}
                        {...(options.placement ? { placement: options.placement } : {})}
                        {...(options.className ? { className: options.className } : {})}
                        aria-label={addonMessages(grid.translator, grid.contributions as never, ROW_ACTIONS_ADDON)('menu')}
                    />
                ),
            };
        },
    };
}

export interface InlineEditingOptions {
    /**
     * Persists one edit. Which cells are editable is decided per column, by `edit`.
     *
     * In a tree this is usually `(rowId, columnId, value) => controller.updateRow(rowId, ...)`, which
     * already applies the change optimistically and reverts it if this rejects.
     */
    readonly commit: CommitEdit;
}

/**
 * Editing in place, for the columns that declare `edit`.
 *
 * Placed before the tree, whatever order the two are listed in: the tree wraps a column's content
 * in its indentation and toggle, and the editor belongs inside that, not around it.
 */
export function inlineEditing<TRow>(options: InlineEditingOptions): GridAddon<TRow> {
    return {
        name: INLINE_EDITING_ADDON,
        before: ['gridwright:tree'],
        setup: () => ({
            configure: (grid) => ({ ...grid, columns: editableColumns(grid.columns) }),
            // `edit` and `icon` change what the wrapper renders, so they take part in the signature.
            columnSignature: (column) => `${column.edit ? '1' : '0'}${column.icon ? '1' : '0'}`,
            provide: (children) => <InlineEditProvider commit={options.commit}>{children}</InlineEditProvider>,
        }),
    };
}

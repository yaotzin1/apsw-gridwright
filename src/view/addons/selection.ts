import type { AddonMessages } from '../../i18n/messages';
import { defineAddon } from '../addon';
import type { ViewAddon, ViewRenderGrid } from '../addon';
import { pageSelectionOf, rowClickSelects, selectionRowAttrs, selectionTableAttrs, spaceSelectsRow } from '../behaviour/selection';
import { h } from '../node';
import type { ViewNode } from '../node';

export const SELECTION_ADDON = 'gridwright:selection';

/** English strings, plain data with no framework in them, so locale packs and every adapter read the same. */
export const selectionMessages: AddonMessages = {
    en: {
        row: 'Select row',
        all: 'Select all rows on this page',
        // The checkbox column's name when its header holds no select-all checkbox. Hidden from sight,
        // so the column still has a header a screen reader can name it by.
        selectColumn: 'Selection',
        count: {
            zero: 'None selected',
            one: '{count} selected',
            other: '{count} selected',
        },
    },
};

export interface SelectionOptions {
    /**
     * A checkbox column, with a select-all checkbox in its header. Default: on when the grid's
     * `selectionMode` is `multiple`.
     */
    readonly checkboxes?: boolean;
    /** The "3 selected" count in the toolbar, while a toolbar is shown. Default true. */
    readonly count?: boolean;
    /**
     * The select-page checkbox in the checkbox column's header. Default true. Off, the header holds
     * the column's name for assistive technology and nothing visible: on a remote grid "select all"
     * reads as every row, and it selects one page.
     */
    readonly selectAll?: boolean;
    /**
     * Clicking a row toggles its selection. Clicks on controls inside the row, and clicks that end a
     * text selection, do not. With `cellNavigation()`, `Space` on a focused cell that holds no
     * control toggles its row too, which is the keyboard route when `checkboxes` is off. Default
     * false.
     */
    readonly selectOnRowClick?: boolean;
}

/**
 * The view of the engine's selection, written once for every adapter: checkboxes, `aria-selected` on
 * rows, `aria-multiselectable` on the table, the selected class, and the count.
 *
 * The selection itself stays in the engine, whoever renders it: moving it here would give
 * `GridRow.selected` a second source of truth. So this add-on keeps no state of its own.
 */
export function selection<TRow>(options: SelectionOptions = {}): ViewAddon<TRow> {
    const selectAll = options.selectAll !== false;
    const onRowClick = options.selectOnRowClick === true;

    const selectPage = (grid: ViewRenderGrid<TRow>): ViewNode => {
        const t = grid.messages(SELECTION_ADDON, selectionMessages);
        const { all, some } = pageSelectionOf(grid.state);
        return h('input', {
            attrs: { type: 'checkbox', className: 'gw-checkbox', 'aria-label': t('all'), checked: all, indeterminate: some },
            on: { change: () => grid.api.selectPage() },
        });
    };

    return defineAddon<TRow>({
        name: SELECTION_ADDON,
        setup: (context) => {
            const checkboxes = options.checkboxes ?? context.selectionMode === 'multiple';
            return {
                messages: selectionMessages,
                ...(checkboxes
                    ? {
                          columns: [
                              {
                                  id: SELECTION_ADDON,
                                  placement: 'start' as const,
                                  className: 'gw-cell--select',
                                  header: (grid: ViewRenderGrid<TRow>) =>
                                      selectAll
                                          ? selectPage(grid)
                                          : h('span', { attrs: { className: 'gw-visually-hidden' } }, grid.messages(SELECTION_ADDON, selectionMessages)('selectColumn')),
                                  cell: (row: { readonly id: string | number; readonly selected: boolean }, grid: ViewRenderGrid<TRow>) =>
                                      h('input', {
                                          attrs: {
                                              type: 'checkbox',
                                              className: 'gw-checkbox',
                                              tabIndex: grid.cellControlTabIndex(SELECTION_ADDON),
                                              'aria-label': grid.messages(SELECTION_ADDON, selectionMessages)('row'),
                                              checked: row.selected,
                                          },
                                          on: {
                                              change: () => grid.api.toggleRowSelection(row.id),
                                              // Without this a click on the checkbox also fires the grid's own row click, so
                                              // selecting a row navigates away from the grid you are selecting in.
                                              click: (event) => event.stopPropagation(),
                                          },
                                      }),
                              },
                          ],
                      }
                    : {}),
                tableAttributes: (grid) => selectionTableAttrs(grid.api.getSelectionMode()),
                rowAttributes: (row, grid) =>
                    grid.api.getSelectionMode() === 'none'
                        ? {}
                        : selectionRowAttrs(row.selected, { selectOnRowClick: onRowClick, selectedClass: grid.classNames.rowSelected }),
                ...(onRowClick
                    ? {
                          rowHandlers: (row, grid) =>
                              grid.api.getSelectionMode() === 'none'
                                  ? {}
                                  : {
                                        click: (event) => {
                                            if (rowClickSelects(event)) grid.api.toggleRowSelection(row.id);
                                        },
                                    },
                          // `Space` on a focused cell, which only `cellNavigation()` gives the grid. A cell that holds a
                          // control is left to it, so `Space` on the checkbox cell ticks the checkbox exactly once.
                          tableKeyDown: (event, grid) => {
                              const row = spaceSelectsRow(event, grid.state);
                              if (row === undefined) return false;
                              grid.api.toggleRowSelection(row.id);
                              return true;
                          },
                      }
                    : {}),
                ...(options.count === false
                    ? {}
                    : {
                          toolbarStatus: (grid: ViewRenderGrid<TRow>) =>
                              grid.state.selectedIds.length > 0
                                  ? h(
                                        'span',
                                        { attrs: { className: 'gw-selected-count' } },
                                        grid.messages(SELECTION_ADDON, selectionMessages)('count', { count: grid.state.selectedIds.length }),
                                    )
                                  : null,
                      }),
            };
        },
    });
}

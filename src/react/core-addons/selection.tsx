import type { GridRow } from '../../core/types';
import { useAddonMessages } from '../addons/context';
import type { GridAddon } from '../addons/types';
import { useGridwrightContext } from '../context';
import { useCellTabIndex } from '../navigation/context';
import { SELECTION_ADDON, selectionMessages } from './messages';
import { pageSelectionOf, selectionKeyDown, selectionRowAttributes, selectionTableAttributes } from './selection-logic';

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
 * The view of the engine's selection: checkboxes, `aria-selected` on rows, `aria-multiselectable` on
 * the table, the selected class, and the count.
 *
 * The selection itself stays in the engine, whoever renders it: moving it here would give
 * `GridRow.selected` a second source of truth.
 */
export function selection<TRow>(options: SelectionOptions = {}): GridAddon<TRow> {
    return {
        name: SELECTION_ADDON,
        setup: ({ options: grid }) => {
            const checkboxes = options.checkboxes ?? grid.selectionMode === 'multiple';
            const selectAll = options.selectAll !== false;
            const onRowClick = options.selectOnRowClick === true;
            return {
                messages: selectionMessages,
                ...(checkboxes
                    ? {
                          columns: [
                              {
                                  id: SELECTION_ADDON,
                                  placement: 'start' as const,
                                  className: 'gw-cell--select',
                                  header: () => (selectAll ? <SelectPage /> : <SelectColumnName />),
                                  cell: (row: GridRow<TRow>) => <SelectRow rowId={row.id} selected={row.selected} />,
                              },
                          ],
                      }
                    : {}),
                tableAttributes: (context) => selectionTableAttributes(context),
                rowAttributes: (row, context) => selectionRowAttributes(row, context, { selectOnRowClick: onRowClick }),
                ...(onRowClick ? { tableKeyDown: selectionKeyDown } : {}),
                ...(options.count === false
                    ? {}
                    : { toolbarStatus: (context) => (context.state.selectedIds.length > 0 ? <SelectedCount /> : null) }),
            };
        },
    };
}

function SelectColumnName() {
    const t = useAddonMessages(SELECTION_ADDON, selectionMessages);
    return <span className="gw-visually-hidden">{t('selectColumn')}</span>;
}

function SelectPage() {
    const { api, state } = useGridwrightContext();
    const t = useAddonMessages(SELECTION_ADDON, selectionMessages);
    const { all: allSelected, some: someSelected } = pageSelectionOf(state);

    return (
        <input
            type="checkbox"
            className="gw-checkbox"
            aria-label={t('all')}
            checked={allSelected}
            ref={(node) => {
                if (node) node.indeterminate = someSelected;
            }}
            onChange={() => api.selectPage()}
        />
    );
}

function SelectRow({ rowId, selected }: { rowId: GridRow<unknown>['id']; selected: boolean }) {
    const { api } = useGridwrightContext();
    const t = useAddonMessages(SELECTION_ADDON, selectionMessages);
    const tabIndex = useCellTabIndex(SELECTION_ADDON);
    return (
        <input
            type="checkbox"
            className="gw-checkbox"
            tabIndex={tabIndex}
            aria-label={t('row')}
            checked={selected}
            onChange={() => api.toggleRowSelection(rowId)}
            // Without this a click on the checkbox also fires the row handler, so selecting a row
            // navigates away from the grid you are selecting in.
            onClick={(event) => event.stopPropagation()}
        />
    );
}

function SelectedCount() {
    const { state } = useGridwrightContext();
    const t = useAddonMessages(SELECTION_ADDON, selectionMessages);
    return <span className="gw-selected-count">{t('count', { count: state.selectedIds.length })}</span>;
}

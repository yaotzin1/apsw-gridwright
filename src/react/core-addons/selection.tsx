import type { GridRow } from '../../core/types';
import { useAddonMessages } from '../addons/context';
import type { GridAddon } from '../addons/types';
import { classes, useGridwrightContext } from '../context';
import { SELECTION_ADDON, selectionMessages } from './messages';

export interface SelectionOptions {
    /**
     * A checkbox column, with a select-all checkbox in its header. Default: on when the grid's
     * `selectionMode` is `multiple`.
     */
    readonly checkboxes?: boolean;
    /** The "3 selected" count in the toolbar, while a toolbar is shown. Default true. */
    readonly count?: boolean;
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
            return {
                messages: selectionMessages,
                ...(checkboxes
                    ? {
                          columns: [
                              {
                                  id: SELECTION_ADDON,
                                  placement: 'start' as const,
                                  className: 'gw-cell--select',
                                  header: () => <SelectPage />,
                                  cell: (row: GridRow<TRow>) => <SelectRow rowId={row.id} selected={row.selected} />,
                              },
                          ],
                      }
                    : {}),
                tableAttributes: (context) => ({
                    // Without it a reader has no way to know that more than one row may be selected,
                    // and checkboxes alone do not say so: a single-selection grid has them too.
                    'aria-multiselectable': context.api.getSelectionMode() === 'multiple' ? true : undefined,
                }),
                rowAttributes: (row, context) =>
                    context.api.getSelectionMode() === 'none'
                        ? {}
                        : {
                              'aria-selected': row.selected,
                              className: row.selected ? classes('gw-row--selected', context.classNames.rowSelected) : undefined,
                          },
                ...(options.count === false
                    ? {}
                    : { toolbarStatus: (context) => (context.state.selectedIds.length > 0 ? <SelectedCount /> : null) }),
            };
        },
    };
}

function SelectPage() {
    const { api, state } = useGridwrightContext();
    const t = useAddonMessages(SELECTION_ADDON, selectionMessages);
    const pageIds = state.rows.map((row) => row.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => state.selectedIds.includes(id));
    const someSelected = !allSelected && pageIds.some((id) => state.selectedIds.includes(id));

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
    return (
        <input
            type="checkbox"
            className="gw-checkbox"
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

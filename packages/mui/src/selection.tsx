import Checkbox from '@mui/material/Checkbox';
import {
    pageSelectionOf,
    SELECTION_ADDON,
    selectionKeyDown,
    selectionMessages,
    selectionRowAttributes,
    selectionTableAttributes,
    useAddonMessages,
    useCellTabIndex,
    useGridwrightContext,
    type GridAddon,
    type GridRow,
    type SelectionOptions,
} from 'apsw-gridwright/react';

/**
 * The engine's selection with MUI `Checkbox`es.
 *
 * The same add-on as `selection()`, with the same name and options, and the same attributes,
 * row click and `Space` handling, because both call the helpers `apsw-gridwright/react` exports.
 * Only the two checkboxes are MUI's.
 */
export function muiSelection<TRow>(options: SelectionOptions = {}): GridAddon<TRow> {
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
                                  header: () => (selectAll ? <MuiSelectPage /> : <SelectColumnName />),
                                  cell: (row: GridRow<TRow>) => <MuiSelectRow rowId={row.id} selected={row.selected} />,
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

function MuiSelectPage() {
    const { api, state } = useGridwrightContext();
    const t = useAddonMessages(SELECTION_ADDON, selectionMessages);
    const { all, some } = pageSelectionOf(state);

    return (
        <Checkbox
            size="small"
            checked={all}
            indeterminate={some}
            onChange={() => api.selectPage()}
            slotProps={{
                input: {
                    'aria-label': t('all'),
                    // MUI's `indeterminate` draws the icon and sets `data-indeterminate`, not the DOM
                    // property, and the property is what assistive technology reads as "mixed".
                    ref: (node: HTMLInputElement | null) => {
                        if (node) node.indeterminate = some;
                    },
                },
            }}
        />
    );
}

function MuiSelectRow({ rowId, selected }: { rowId: GridRow<unknown>['id']; selected: boolean }) {
    const { api } = useGridwrightContext();
    const t = useAddonMessages(SELECTION_ADDON, selectionMessages);
    // -1 while `cellNavigation()` visits this cell, so the grid stays one Tab stop.
    const tabIndex = useCellTabIndex(SELECTION_ADDON);

    return (
        <Checkbox
            size="small"
            checked={selected}
            onChange={() => api.toggleRowSelection(rowId)}
            // Without this a click on the checkbox also fires the row handler, so selecting a row
            // navigates away from the grid you are selecting in.
            onClick={(event) => event.stopPropagation()}
            slotProps={{ input: { 'aria-label': t('row'), ...(tabIndex === undefined ? {} : { tabIndex }) } }}
        />
    );
}

function SelectedCount() {
    const { state } = useGridwrightContext();
    const t = useAddonMessages(SELECTION_ADDON, selectionMessages);
    return <span className="gw-selected-count">{t('count', { count: state.selectedIds.length })}</span>;
}

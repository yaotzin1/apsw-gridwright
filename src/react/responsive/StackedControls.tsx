import { useId } from 'react';
import { useAddonMessages } from '../addons/context';
import { useGridwrightContext } from '../context';
import { RESPONSIVE_ADDON, responsiveMessages } from './messages';

/**
 * The sort control that stands in for the header row while the rows are cards.
 *
 * The header cells are not on screen then, so the buttons that sort are not either. This reads and
 * writes the same sort state as those buttons, through the engine: a sort made here is announced by
 * the same live region and sent to a server the same way. It sets the primary sort; a multi-sort made
 * earlier is replaced by it, as a plain click on a header would.
 */
export function StackedSortControl() {
    const { api, state, columns } = useGridwrightContext();
    const t = useAddonMessages(RESPONSIVE_ADDON, responsiveMessages);
    const columnId = useId();
    const directionId = useId();

    const sortable = columns.filter((column) => column.sortable && !column.hidden);
    if (sortable.length === 0) return null;

    const current = state.query.sort[0] ?? null;

    return (
        <div className="gw-stacked-sort">
            <label htmlFor={columnId}>{t('sortBy')}</label>
            <select
                id={columnId}
                className="gw-select"
                value={current?.columnId ?? ''}
                onChange={(event) => {
                    const next = event.target.value;
                    api.setSort(next === '' ? [] : [{ columnId: next, direction: current?.direction ?? 'asc' }]);
                }}
            >
                <option value="">{t('sortNone')}</option>
                {sortable.map((column) => (
                    <option key={column.id} value={column.id}>
                        {column.header}
                    </option>
                ))}
            </select>
            {current && (
                <>
                    <label className="gw-visually-hidden" htmlFor={directionId}>
                        {t('sortDirection')}
                    </label>
                    <select
                        id={directionId}
                        className="gw-select"
                        value={current.direction}
                        onChange={(event) =>
                            api.setSort([{ columnId: current.columnId, direction: event.target.value === 'desc' ? 'desc' : 'asc' }])
                        }
                    >
                        <option value="asc">{t('sortAscending')}</option>
                        <option value="desc">{t('sortDescending')}</option>
                    </select>
                </>
            )}
        </div>
    );
}

/**
 * Says so when a sort or a filter is on a column the width has hidden.
 *
 * Both stay in force, because hiding is a view concern; without this the reader would see rows in an
 * order or a subset that nothing on screen explains.
 */
export function HiddenQueryNote({ hidden }: { readonly hidden: ReadonlySet<string> }) {
    const { state, columns } = useGridwrightContext();
    const t = useAddonMessages(RESPONSIVE_ADDON, responsiveMessages);
    const headerOf = (id: string): string => columns.find((column) => column.id === id)?.header ?? id;

    const sorted = state.query.sort.filter((spec) => hidden.has(spec.columnId)).map((spec) => headerOf(spec.columnId));
    const filtered = [...new Set(state.query.filters.filter((spec) => hidden.has(spec.columnId)).map((spec) => headerOf(spec.columnId)))];
    if (sorted.length === 0 && filtered.length === 0) return null;

    return (
        <span className="gw-hidden-query-note">
            {[...sorted.map((column) => t('hiddenSort', { column })), ...filtered.map((column) => t('hiddenFilter', { column }))].join('. ')}
        </span>
    );
}

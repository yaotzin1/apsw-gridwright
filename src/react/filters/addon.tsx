import type { FilterSpec, GridState } from '../../core/types';
import type { AnnouncementChange, GridAddon } from '../addons/types';
import { ColumnFilterProvider } from './ColumnFilterProvider';
import { ColumnFilterTrigger } from './ColumnFilterTrigger';
import { GridFilterClear } from './GridFilterClear';
import { FILTERS_ADDON, filterMessages } from './messages';

/**
 * A filter button in the header of every filterable column, one dialog for them, a "clear filters"
 * button in the toolbar while any filter is on, and a sentence naming the column a filter changed.
 *
 * Each column says what it holds with `filter: { type }`, which decides the conditions offered. The
 * filter goes into `query.filters` exactly as `api.setFilter` would put it there, so a source that
 * declares `filter: true` receives it and the pipeline steps aside.
 */
export function columnFilters<TRow>(): GridAddon<TRow> {
    return {
        name: FILTERS_ADDON,
        setup: () => ({
            messages: filterMessages,
            // One dialog for the grid, inside the root so it keeps the theme, the direction and the
            // language, and outside the table so the table's scrolling never clips it.
            provide: (children) => <ColumnFilterProvider>{children}</ColumnFilterProvider>,
            headerAfter: (column) => (column.filterable ? <ColumnFilterTrigger columnId={column.id} /> : null),
            headerAttributes: (column, grid) => ({
                'data-filtered': grid.api.getFilter(column.id) !== null ? 'true' : undefined,
            }),
            // A toolbar appears for an active filter even when nothing else asked for one, because the
            // clear button lives there and a filter nobody can see how to remove looks like missing data.
            toolbar: (grid) => (grid.state.query.filters.length > 0 ? <GridFilterClear /> : null),
            announce: [
                {
                    priority: 10,
                    key: (state) =>
                        [...filterSignatures(state)].map(([columnId, signature]) => `${columnId}=${signature}`).join('|'),
                    describe: (change) => describeFilter(change),
                },
            ],
        }),
    };
}

/** One comparable string per filtered column. A value that cannot be serialised compares by type. */
function filterSignatures<TRow>(state: GridState<TRow>): ReadonlyMap<string, string> {
    const signatures = new Map<string, string>();
    for (const filter of state.query.filters as readonly FilterSpec[]) {
        let value: string;
        try {
            value = JSON.stringify(filter.value) ?? typeof filter.value;
        } catch {
            value = typeof filter.value;
        }
        const previous = signatures.get(filter.columnId);
        const entry = `${filter.operator}:${value}`;
        signatures.set(filter.columnId, previous === undefined ? entry : `${previous};${entry}`);
    }
    return signatures;
}

/**
 * The one column whose filter changed, named by its header.
 *
 * Only when exactly one did. Clearing every filter at once changes several, and naming one of them
 * "filter removed" would tell the reader the others are still on; the settled row range that follows
 * is the honest thing to say then.
 */
function describeFilter<TRow>({ previous, next, headers, t }: AnnouncementChange<TRow>): string | null {
    const before = previous ? filterSignatures(previous) : new Map<string, string>();
    const after = filterSignatures(next);

    const changed = new Set<string>();
    for (const [columnId, signature] of after) if (before.get(columnId) !== signature) changed.add(columnId);
    for (const columnId of before.keys()) if (!after.has(columnId)) changed.add(columnId);
    if (changed.size !== 1) return null;

    const [columnId] = [...changed] as [string];
    return t(after.has(columnId) ? 'applied' : 'removed', { column: headers.get(columnId) ?? columnId });
}

import { describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { createLocalDataSource } from '../../src/data/local';
import type { GridApi } from '../../src/core/types';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

function makeGrid(
    rows: readonly Person[] = people,
    pageSize = 3,
    selectionMode: 'none' | 'single' | 'multiple' = 'none',
): GridApi<Person> {
    return createGridEngine<Person>({
        columns: personColumns,
        dataSource: createLocalDataSource<Person>(rows),
        initialQuery: { pagination: { pageIndex: 0, pageSize } },
        selectionMode,
    });
}

/** Selection is off by default, so every selection test opts in the way a consumer would. */
const makeSelectableGrid = (pageSize = 3) => makeGrid(people, pageSize, 'multiple');

const names = (api: GridApi<Person>): string[] => api.getState().rows.map((row) => row.data.name);

describe('engine with a local data source', () => {
    it('is ready synchronously, with no loading state to flash', () => {
        // An in-memory array resolves in the same tick. Publishing a loading state first would
        // make every local grid blink a spinner it never needed.
        const api = makeGrid();
        expect(api.getState().status).toBe('ready');
        expect(api.getState().rows).toHaveLength(3);
        api.destroy();
    });

    it('reports the full match count while showing one page', () => {
        const api = makeGrid();
        expect(api.getState().totalRows).toBe(7);
        expect(api.getState().pageCount).toBe(3);
        expect(api.getState().isTotalExact).toBe(true);
        api.destroy();
    });

    it('uses the row id property for row identity', () => {
        const api = makeGrid();
        expect(api.getState().rows.map((row) => row.id)).toEqual([1, 2, 3]);
        api.destroy();
    });

    it('pages forward and back', () => {
        const api = makeGrid();
        api.nextPage();
        expect(names(api)).toEqual(['Mary Jackson', 'Dorothy Vaughan', 'Annie Easley']);
        expect(api.getState().hasPreviousPage).toBe(true);

        api.previousPage();
        expect(names(api)[0]).toBe('Ada Lovelace');
        api.destroy();
    });

    it('refuses to page past the last page', () => {
        const api = makeGrid();
        api.setPage(2);
        expect(api.getState().hasNextPage).toBe(false);
        api.nextPage();
        expect(api.getState().query.pagination.pageIndex).toBe(2);
        api.destroy();
    });

    it('cycles sort through ascending, descending and off', () => {
        const api = makeGrid();

        api.toggleSort('salary');
        expect(api.getSort('salary')).toBe('asc');
        expect(names(api)[0]).toBe('Mary Jackson');

        api.toggleSort('salary');
        expect(api.getSort('salary')).toBe('desc');
        expect(names(api)[0]).toBe('Grace Hopper');

        api.toggleSort('salary');
        // The third state matters: without it a column can never return to natural order.
        expect(api.getSort('salary')).toBeNull();
        expect(names(api)[0]).toBe('Ada Lovelace');

        api.destroy();
    });

    it('sorts by several columns when the toggle is additive', () => {
        const api = makeGrid(people, 10);
        api.toggleSort('department');
        api.toggleSort('salary', { additive: true });

        expect(names(api).slice(0, 2)).toEqual(['Ada Lovelace', 'Grace Hopper']);
        expect(api.getState().query.sort).toHaveLength(2);
        api.destroy();
    });

    it('replaces the sort when the toggle is not additive', () => {
        const api = makeGrid();
        api.toggleSort('department');
        api.toggleSort('salary');
        expect(api.getState().query.sort).toEqual([{ columnId: 'salary', direction: 'asc' }]);
        api.destroy();
    });

    it('filters and reports the filtered total', () => {
        const api = makeGrid(people, 10);
        api.setFilter('department', { operator: 'eq', value: 'Research' });

        expect(api.getState().totalRows).toBe(3);
        expect(names(api)).toEqual(['Katherine Johnson', 'Mary Jackson', 'Evelyn Boyd']);
        api.destroy();
    });

    it('clears a filter when it is set to null', () => {
        const api = makeGrid(people, 10);
        api.setFilter('department', { operator: 'eq', value: 'Research' });
        api.setFilter('department', null);
        expect(api.getState().totalRows).toBe(7);
        api.destroy();
    });

    it('searches across every searchable column', () => {
        const api = makeGrid(people, 10);
        api.setSearch('operations');
        expect(names(api)).toEqual(['Dorothy Vaughan', 'Annie Easley']);
        api.destroy();
    });

    it('returns to the first page when a filter narrows the set', () => {
        // Filtering while deep in a set otherwise lands on an empty page, which reads exactly
        // like "the filter matched nothing".
        const api = makeGrid();
        api.setPage(2);
        expect(api.getState().query.pagination.pageIndex).toBe(2);

        api.setSearch('research');
        expect(api.getState().query.pagination.pageIndex).toBe(0);
        expect(api.getState().rows).not.toHaveLength(0);
        api.destroy();
    });

    it('moves to the last real page when the data shrinks underneath it', () => {
        const source = createLocalDataSource<Person>(people);
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: source,
            initialQuery: { pagination: { pageIndex: 2, pageSize: 3 } },
        });

        source.setRows(people.slice(0, 4));

        expect(api.getState().query.pagination.pageIndex).toBe(1);
        expect(api.getState().rows).toHaveLength(1);
        api.destroy();
    });

    it('refetches when the local source replaces its rows', () => {
        const source = createLocalDataSource<Person>(people.slice(0, 2));
        const api = createGridEngine<Person>({ columns: personColumns, dataSource: source });

        expect(api.getState().totalRows).toBe(2);
        source.setRows(people);
        expect(api.getState().totalRows).toBe(7);
        api.destroy();
    });

    it('does not refetch when a query update changes nothing', () => {
        const source = createLocalDataSource<Person>(people);
        const fetchSpy = vi.spyOn(source, 'fetch');
        const api = createGridEngine<Person>({ columns: personColumns, dataSource: source });

        fetchSpy.mockClear();
        api.setSearch('');
        api.setPage(0);
        expect(fetchSpy).not.toHaveBeenCalled();
        api.destroy();
    });
});

describe('selection', () => {
    it('toggles rows on and off in multiple mode', () => {
        const api = makeSelectableGrid();
        api.toggleRowSelection(1);
        api.toggleRowSelection(2);
        expect(api.getState().selectedIds).toEqual([1, 2]);

        api.toggleRowSelection(1);
        expect(api.getState().selectedIds).toEqual([2]);
        api.destroy();
    });

    it('keeps a single selection in single mode', () => {
        const api = makeSelectableGrid();
        api.setSelectionMode('single');
        api.toggleRowSelection(1);
        api.toggleRowSelection(2);
        expect(api.getState().selectedIds).toEqual([2]);
        api.destroy();
    });

    it('ignores selection entirely in none mode', () => {
        const api = makeSelectableGrid();
        api.setSelectionMode('none');
        api.toggleRowSelection(1);
        expect(api.getState().selectedIds).toEqual([]);
        api.destroy();
    });

    it('selects and clears the whole page', () => {
        const api = makeSelectableGrid();
        api.selectPage();
        expect(api.getState().selectedIds).toEqual([1, 2, 3]);

        api.selectPage();
        expect(api.getState().selectedIds).toEqual([]);
        api.destroy();
    });

    it('keeps ids selected on other pages while resolving only loaded rows', () => {
        const api = makeSelectableGrid();
        api.selectPage();
        api.nextPage();

        expect(api.getState().selectedIds).toEqual([1, 2, 3]);
        // Rows from page one are no longer loaded, so they cannot be handed back as objects.
        expect(api.getSelectedRows()).toEqual([]);
        api.destroy();
    });

    it('marks the row objects it hands to a renderer', () => {
        const api = makeSelectableGrid();
        api.toggleRowSelection(2);
        expect(api.getState().rows.map((row) => row.selected)).toEqual([false, true, false]);
        api.destroy();
    });

    it('emits selection changes once per change', () => {
        const api = makeSelectableGrid();
        const listener = vi.fn();
        api.on('selection:change', listener);

        api.toggleRowSelection(1);
        api.setSelectedIds([1]);
        expect(listener).toHaveBeenCalledTimes(1);
        api.destroy();
    });
});

describe('lifecycle', () => {
    it('stops publishing state after destroy', () => {
        const api = makeGrid();
        const listener = vi.fn();
        api.subscribe(listener);

        api.destroy();
        api.setSearch('anything');

        expect(listener).not.toHaveBeenCalled();
        expect(api.destroyed).toBe(true);
    });

    it('does not dispose a data source it did not create', () => {
        // A source is routinely shared between grids, and Strict Mode destroys an engine on
        // purpose. Disposing someone else's source there would break the remount.
        const source = createLocalDataSource<Person>(people);
        const dispose = vi.spyOn(source, 'dispose');
        const api = createGridEngine<Person>({ columns: personColumns, dataSource: source });

        api.destroy();
        expect(dispose).not.toHaveBeenCalled();
    });
});

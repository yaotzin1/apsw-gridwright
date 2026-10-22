import { describe, expect, it } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { createLocalDataSource } from '../../src/data/local';
import { createRemoteDataSource } from '../../src/data/remote';
import { deferred } from '../fixtures';
import type { ColumnDef, DataSource, DataSourceRequest, DataSourceResult, GridApi, GridRow, RowId, SelectionMode } from '../../src/core/types';

/**
 * Selection against everything that reorders, narrows or replaces the rows underneath it.
 *
 * A selection belongs to records, not to places on the screen. Sorting, filtering, searching, paging
 * and a server refresh all move records around, and the checkbox that was ticked has to stay with the
 * record it was ticked on. This file ticks rows, applies each of those changes through each kind of
 * data source and each way of identifying a row, and checks every row on the screen against the ids
 * the engine holds.
 */

interface Rec {
    key: number;
    name: string;
    department: string;
    salary: number;
    id?: number;
}

const DEPARTMENTS = ['Engineering', 'Research', 'Operations'];

const records = (): Rec[] =>
    Array.from({ length: 12 }, (_, index) => ({
        key: index + 1,
        // Names run against the salary order and the key order, so a sort moves every record.
        name: `Person ${String.fromCharCode(76 - index)}`,
        department: DEPARTMENTS[index % DEPARTMENTS.length]!,
        salary: 100 + ((index * 7) % 12) * 10,
    }));

const columns: readonly ColumnDef<Rec>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary' },
];

type SourceKind = 'local' | 'server does everything' | 'server only pages';
type IdKind = 'id property' | 'getRowId' | 'row position';

const SOURCES: readonly SourceKind[] = ['local', 'server does everything', 'server only pages'];
const IDS: readonly IdKind[] = ['id property', 'getRowId', 'row position'];

const flush = async (): Promise<void> => {
    for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
};

/** A small honest server: applies what the grid sent and reports the total. */
function serve(rows: readonly Rec[], request: DataSourceRequest<Rec>, resolved: boolean): DataSourceResult<Rec> {
    let result = [...rows];
    if (resolved) {
        const { filters, search, sort } = request.query;
        for (const filter of filters) result = result.filter((row) => (row as unknown as Record<string, unknown>)[filter.columnId] === filter.value);
        if (search) result = result.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));
        for (const spec of [...sort].reverse()) {
            const sign = spec.direction === 'asc' ? 1 : -1;
            result.sort((a, b) => {
                const left = (a as unknown as Record<string, string | number>)[spec.columnId]!;
                const right = (b as unknown as Record<string, string | number>)[spec.columnId]!;
                return left < right ? -sign : left > right ? sign : 0;
            });
        }
    }
    const total = result.length;
    const { pageIndex, pageSize } = request.query.pagination;
    return { rows: result.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize), totalRows: total };
}

interface Rig {
    readonly api: GridApi<Rec>;
    /** The row id the grid gives the record with this key, for the id strategy under test. */
    idOf(key: number): RowId;
    /** Replaces what the data holds, as the data changing underneath the grid does. */
    replaceRows(next: readonly Rec[]): Promise<void>;
    current(): readonly Rec[];
}

function rig(source: SourceKind, idKind: IdKind, mode: SelectionMode = 'multiple', pageSize = 4): Rig {
    let held: Rec[] = records().map((rec) => (idKind === 'id property' ? { ...rec, id: rec.key } : rec));

    const make = (): DataSource<Rec> =>
        source === 'local'
            ? createLocalDataSource<Rec>(held)
            : createRemoteDataSource<Rec>({
                  retry: { attempts: 0 },
                  ...(source === 'server only pages' ? { capabilities: { sort: false, filter: false, search: false, paginate: true } } : {}),
                  fetcher: async (request) => serve(held, request, source === 'server does everything'),
              });

    const api = createGridEngine<Rec>({
        columns,
        dataSource: make(),
        selectionMode: mode,
        initialQuery: { pagination: { pageIndex: 0, pageSize } },
        ...(idKind === 'getRowId' ? { getRowId: (row: Rec) => `rec-${row.key}` } : {}),
    });

    return {
        api,
        idOf: (key) => (idKind === 'id property' ? key : idKind === 'getRowId' ? `rec-${key}` : -1),
        current: () => held,
        async replaceRows(next) {
            held = [...next];
            if (source === 'local') api.setDataSource(make());
            else await api.refresh();
            await flush();
        },
    };
}

const keysOnScreen = (api: GridApi<Rec>): number[] => api.getState().rows.map((row) => row.data.key);
const selectedKeysOnScreen = (api: GridApi<Rec>): number[] =>
    api.getState().rows.filter((row) => row.selected).map((row) => row.data.key);

/** The relationship that must hold after every change, whatever the change was. */
function expectConsistent(api: GridApi<Rec>): void {
    const { rows, selectedIds } = api.getState();
    const chosen = new Set(selectedIds);
    for (const row of rows) expect(row.selected, `row ${String(row.id)}`).toBe(chosen.has(row.id));
    expect(api.getSelectedRows()).toHaveLength(rows.filter((row) => row.selected).length);
    for (const row of rows) expect(api.isSelected(row.id)).toBe(row.selected);
    expect(new Set(selectedIds).size).toBe(selectedIds.length);
}

interface Change {
    readonly name: string;
    /** Whether the change keeps the same records in view, only moved. */
    apply(r: Rig): Promise<void> | void;
}

const changes: readonly Change[] = [
    { name: 'sort by name descending', apply: (r) => r.api.setSort([{ columnId: 'name', direction: 'desc' }]) },
    { name: 'sort by salary ascending', apply: (r) => r.api.setSort([{ columnId: 'salary', direction: 'asc' }]) },
    { name: 'sort twice', apply: (r) => { r.api.toggleSort('salary'); r.api.toggleSort('salary'); } },
    { name: 'filter by department', apply: (r) => r.api.setFilter('department', { operator: 'eq', value: 'Research' }) },
    { name: 'search', apply: (r) => r.api.setSearch('person') },
    { name: 'next page', apply: (r) => r.api.nextPage() },
    { name: 'last page', apply: (r) => r.api.setPage(2) },
    { name: 'page size 5', apply: (r) => r.api.setPageSize(5) },
    { name: 'page size 12', apply: (r) => r.api.setPageSize(12) },
    { name: 'new column objects', apply: (r) => r.api.setColumns(columns.map((column) => ({ ...column }))) },
    { name: 'refresh', apply: (r) => r.api.refresh() },
    { name: 'refresh after the data was reversed', apply: (r) => r.replaceRows([...r.current()].reverse()) },
    { name: 'refresh after a record was prepended', apply: (r) => r.replaceRows([{ key: 99, name: 'Newcomer', department: 'Research', salary: 1, ...(r.current()[0]?.id !== undefined ? { id: 99 } : {}) }, ...r.current()]) },
    { name: 'refresh after a record was renamed', apply: (r) => r.replaceRows(r.current().map((rec) => (rec.key === 1 ? { ...rec, name: 'Renamed' } : rec))) },
];

describe('ticked rows stay ticked through every change', () => {
    describe.each(SOURCES)('%s', (source) => {
        describe.each(IDS)('identified by %s', (idKind) => {
            describe.each(changes)('$name', (change) => {
                it('keeps the checkbox state of every row consistent with the selection', async () => {
                    const r = rig(source, idKind);
                    await flush();
                    r.api.setSelectedIds(r.api.getState().rows.slice(0, 2).map((row) => row.id));
                    await change.apply(r);
                    await flush();

                    expect(r.api.getState().status).toBe('ready');
                    expectConsistent(r.api);
                    r.api.destroy();
                });

                it('does not drop the selection when the rows change', async () => {
                    const r = rig(source, idKind);
                    await flush();
                    const chosen = r.api.getState().rows.slice(0, 2).map((row) => row.id);
                    r.api.setSelectedIds(chosen);
                    await change.apply(r);
                    await flush();

                    // Ids are the selection; a row leaving the screen does not untick it.
                    expect(r.api.getState().selectedIds).toEqual(chosen);
                    r.api.destroy();
                });

                if (idKind !== 'row position') {
                    it('leaves the tick on the record it was made on', async () => {
                        const r = rig(source, idKind);
                        await flush();
                        // Records 1 and 2: the first two rows of the unsorted page in every source.
                        const ticked = [1, 2];
                        r.api.setSelectedIds(ticked.map((key) => r.idOf(key)));
                        await change.apply(r);
                        await flush();

                        const onScreen = keysOnScreen(r.api);
                        expect(selectedKeysOnScreen(r.api).sort()).toEqual(ticked.filter((key) => onScreen.includes(key)).sort());
                        r.api.destroy();
                    });
                }
            });
        });
    });
});

describe('without a stable id the tick follows the place, not the record', () => {
    // Documented: the id defaults to the `id` property, then to the row index. A grid whose rows carry
    // neither gets the position, and a position is a place on the page. These tests pin that so the
    // fallback is a decision rather than an accident; a consumer who sorts needs an id.
    it.each(['local', 'server does everything'] as const)('moves to another record when the %s result is sorted', async (source) => {
        const r = rig(source, 'row position');
        await flush();
        const before = r.api.getState().rows[0]!;
        r.api.toggleRowSelection(before.id);
        expect(selectedKeysOnScreen(r.api)).toEqual([before.data.key]);

        r.api.setSort([{ columnId: 'name', direction: 'asc' }]);
        await flush();

        const after = r.api.getState().rows.find((row) => row.id === before.id)!;
        expect(after.selected).toBe(true);
        expect(after.data.key).not.toBe(before.data.key);
        r.api.destroy();
    });

    it('does not carry a tick from page one onto page two', async () => {
        const r = rig('local', 'row position');
        r.api.toggleRowSelection(r.api.getState().rows[0]!.id);
        r.api.nextPage();

        expect(selectedKeysOnScreen(r.api)).toEqual([]);
        r.api.previousPage();
        expect(selectedKeysOnScreen(r.api)).toEqual([r.api.getState().rows[0]!.data.key]);
        r.api.destroy();
    });
});

describe('a selection across pages', () => {
    describe.each(SOURCES)('%s', (source) => {
        it('accumulates ticks from different pages and shows each on its own page', async () => {
            const r = rig(source, 'id property');
            await flush();
            r.api.toggleRowSelection(r.idOf(1));
            r.api.setPage(2);
            await flush();
            r.api.toggleRowSelection(r.idOf(9));

            expect(r.api.getState().selectedIds).toEqual([1, 9]);
            expect(selectedKeysOnScreen(r.api)).toEqual([9]);
            // Only what is loaded can be resolved to a row.
            expect(r.api.getSelectedRows().map((row) => row.key)).toEqual([9]);

            r.api.setPage(0);
            await flush();
            expect(selectedKeysOnScreen(r.api)).toEqual([1]);
            r.api.destroy();
        });

        it('selects the page without touching ticks on other pages, and deselects only that page', async () => {
            const r = rig(source, 'id property');
            await flush();
            r.api.toggleRowSelection(r.idOf(1));
            r.api.setPage(1);
            await flush();

            r.api.selectPage();
            expect(r.api.getState().selectedIds).toEqual(expect.arrayContaining([1, 5, 6, 7, 8]));
            expect(r.api.getState().selectedIds).toHaveLength(5);

            r.api.selectPage();
            expect(r.api.getState().selectedIds).toEqual([1]);
            r.api.destroy();
        });

        it('selects the page it is sorted into, not the page it was on before', async () => {
            const r = rig(source, 'id property');
            await flush();
            r.api.setSort([{ columnId: 'name', direction: 'asc' }]);
            await flush();
            const visible = keysOnScreen(r.api);

            r.api.selectPage();

            expect(r.api.getState().selectedIds).toEqual(visible);
            r.api.destroy();
        });

        it('selects only the filtered rows and keeps the earlier tick that the filter hides', async () => {
            const r = rig(source, 'id property');
            await flush();
            r.api.toggleRowSelection(r.idOf(2));
            r.api.setFilter('department', { operator: 'eq', value: 'Operations' });
            await flush();
            const visible = keysOnScreen(r.api);
            expect(visible).not.toContain(2);

            r.api.selectPage();

            expect(r.api.getState().selectedIds).toEqual([2, ...visible]);
            expectConsistent(r.api);
            r.api.destroy();
        });

        it('lets a tick on a record the filter hides come back when the filter is cleared', async () => {
            const r = rig(source, 'id property');
            await flush();
            r.api.toggleRowSelection(r.idOf(2));
            r.api.setFilter('department', { operator: 'eq', value: 'Operations' });
            await flush();
            expect(selectedKeysOnScreen(r.api)).toEqual([]);

            r.api.setFilter('department', null);
            await flush();

            expect(selectedKeysOnScreen(r.api)).toEqual([2]);
            r.api.destroy();
        });
    });
});

describe('a record that disappears from the data', () => {
    describe.each(SOURCES)('%s', (source) => {
        it('stays in the selection but not on the screen, and stops resolving to a row', async () => {
            const r = rig(source, 'id property');
            await flush();
            r.api.setSelectedIds([r.idOf(1), r.idOf(2)]);

            await r.replaceRows(r.current().filter((rec) => rec.key !== 1));

            expect(r.api.getState().selectedIds).toEqual([1, 2]);
            expect(r.api.getSelectedRows().map((row) => row.key)).toEqual([2]);
            expectConsistent(r.api);
            r.api.destroy();
        });

        it('is ticked again if the record comes back', async () => {
            const r = rig(source, 'id property');
            await flush();
            const all = r.current();
            r.api.setSelectedIds([r.idOf(1)]);
            await r.replaceRows(all.filter((rec) => rec.key !== 1));
            expect(selectedKeysOnScreen(r.api)).toEqual([]);

            await r.replaceRows(all);

            expect(selectedKeysOnScreen(r.api)).toEqual([1]);
            r.api.destroy();
        });

        it('can be emptied by clearing, whether or not the records are loaded', async () => {
            const r = rig(source, 'id property');
            await flush();
            r.api.setSelectedIds([r.idOf(1), r.idOf(11)]);
            await r.replaceRows(r.current().filter((rec) => rec.key !== 1));

            r.api.clearSelection();

            expect(r.api.getState().selectedIds).toEqual([]);
            expect(selectedKeysOnScreen(r.api)).toEqual([]);
            r.api.destroy();
        });
    });
});

describe('the selection mode changing while rows are on screen', () => {
    describe.each(SOURCES)('%s', (source) => {
        it('keeps the first tick when multiple becomes single', async () => {
            const r = rig(source, 'id property');
            await flush();
            r.api.setSelectedIds([r.idOf(3), r.idOf(1), r.idOf(2)]);

            r.api.setSelectionMode('single');

            expect(r.api.getState().selectedIds).toEqual([3]);
            expect(selectedKeysOnScreen(r.api)).toEqual([3]);
            r.api.destroy();
        });

        it('forgets everything when selection is switched off, and does not bring it back', async () => {
            const r = rig(source, 'id property');
            await flush();
            r.api.setSelectedIds([r.idOf(1)]);

            r.api.setSelectionMode('none');
            r.api.setSelectionMode('multiple');
            r.api.setSort([{ columnId: 'name', direction: 'asc' }]);
            await flush();

            expect(r.api.getState().selectedIds).toEqual([]);
            expect(selectedKeysOnScreen(r.api)).toEqual([]);
            r.api.destroy();
        });

        it('refuses a tick while selection is off', async () => {
            const r = rig(source, 'id property', 'none');
            await flush();
            r.api.toggleRowSelection(r.idOf(1));
            r.api.setSelectedIds([r.idOf(1)]);
            r.api.selectPage();

            expect(r.api.getState().selectedIds).toEqual([]);
            r.api.destroy();
        });

        it('replaces the tick in single mode, and unticks it on a second click', async () => {
            const r = rig(source, 'id property', 'single');
            await flush();
            r.api.toggleRowSelection(r.idOf(1));
            r.api.toggleRowSelection(r.idOf(2));
            expect(r.api.getState().selectedIds).toEqual([2]);

            r.api.toggleRowSelection(r.idOf(2));
            expect(r.api.getState().selectedIds).toEqual([]);
            r.api.destroy();
        });

        it('keeps one tick in single mode through a sort and a page change', async () => {
            const r = rig(source, 'id property', 'single');
            await flush();
            r.api.toggleRowSelection(r.idOf(2));

            r.api.setSort([{ columnId: 'salary', direction: 'desc' }]);
            r.api.nextPage();
            await flush();
            r.api.setPage(0);
            await flush();

            expect(r.api.getState().selectedIds).toEqual([2]);
            expectConsistent(r.api);
            r.api.destroy();
        });
    });
});

describe('ticking while a request is in flight', () => {
    function gated() {
        const gates: Array<ReturnType<typeof deferred<DataSourceResult<Rec>>>> = [];
        const gateAnswers: DataSourceResult<Rec>[] = [];
        const held = records().map((rec) => ({ ...rec, id: rec.key }));
        const api = createGridEngine<Rec>({
            columns,
            selectionMode: 'multiple',
            initialQuery: { pagination: { pageIndex: 0, pageSize: 4 } },
            dataSource: createRemoteDataSource<Rec>({
                retry: { attempts: 0 },
                fetcher: (request) => {
                    const gate = deferred<DataSourceResult<Rec>>();
                    gates.push(gate);
                    const answer = serve(held, request, true);
                    gateAnswers.push(answer);
                    return gate.promise as Promise<{ rows: readonly Rec[]; totalRows?: number }>;
                },
            }),
        });
        return { api, gates, answer: (index: number) => gates[index]!.resolve(gateAnswers[index]!) };
    }

    it('applies a tick made during the load to the rows that arrive', async () => {
        const g = gated();
        g.api.setSelectedIds([2]);
        g.answer(0);
        await flush();

        expect(selectedKeysOnScreen(g.api)).toEqual([2]);
        g.api.destroy();
    });

    it.each([
        ['in order', [0, 1]],
        ['out of order', [1, 0]],
    ] as const)('applies the latest selection to the latest rows when responses land %s', async (_name, order) => {
        const g = gated();
        g.api.setSelectedIds([1]);
        g.api.setSort([{ columnId: 'name', direction: 'asc' }]);
        g.api.setSelectedIds([1, 3]);

        for (const index of order) {
            g.answer(index);
            await flush();
        }

        expectConsistent(g.api);
        expect(g.api.getState().selectedIds).toEqual([1, 3]);
        for (const row of g.api.getState().rows) expect(row.selected).toBe([1, 3].includes(row.data.key));
        g.api.destroy();
    });

    it('marks the rows still on screen while the next page loads', async () => {
        const g = gated();
        g.answer(0);
        await flush();

        g.api.nextPage();
        g.api.toggleRowSelection(1);

        expect(g.api.getState().status).toBe('refreshing');
        expect(selectedKeysOnScreen(g.api)).toEqual([1]);
        g.api.destroy();
    });

    it('does not tick a row that the response replaced', async () => {
        const g = gated();
        g.answer(0);
        await flush();
        g.api.toggleRowSelection(1);

        g.api.setPage(1);
        g.answer(1);
        await flush();

        expect(keysOnScreen(g.api)).not.toContain(1);
        expect(selectedKeysOnScreen(g.api)).toEqual([]);
        expect(g.api.getState().selectedIds).toEqual([1]);
        g.api.destroy();
    });

    it('announces each change of the selection once, and none for a response', async () => {
        const g = gated();
        const seen: RowId[][] = [];
        g.api.on('selection:change', ({ selectedIds }) => seen.push([...selectedIds]));

        g.api.toggleRowSelection(1);
        g.api.toggleRowSelection(1);
        g.api.toggleRowSelection(1);
        g.answer(0);
        await flush();

        expect(seen).toEqual([[1], [], [1]]);
        g.api.destroy();
    });
});

describe('rows handed back by the grid are never shared between states', () => {
    it('does not mutate the rows a subscriber already received when the selection changes', async () => {
        const r = rig('local', 'id property');
        const received: Array<readonly GridRow<Rec>[]> = [];
        r.api.subscribe((state) => received.push(state.rows));

        r.api.toggleRowSelection(r.idOf(1));
        r.api.toggleRowSelection(r.idOf(2));

        expect(received.length).toBeGreaterThanOrEqual(2);
        expect(received[0]!.filter((row) => row.selected).map((row) => row.data.key)).toEqual([1]);
        expect(received[1]!.filter((row) => row.selected).map((row) => row.data.key)).toEqual([1, 2]);
        r.api.destroy();
    });
});

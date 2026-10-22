import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { createLocalDataSource } from '../../src/data/local';
import { createRemoteDataSource } from '../../src/data/remote';
import { createWindowedDataSource } from '../../src/data/windowed';
import type { DataSourceCapabilities, GridApi } from '../../src/core/types';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

/**
 * A source that paginates and leaves a facet undeclared makes the grid sort, filter or search the one
 * page it received. That is a choice worth making on purpose, so the grid says so the first time the
 * query uses it, and only then.
 */

const ONLY_PAGES: Partial<DataSourceCapabilities> = { sort: false, filter: false, search: false, paginate: true };

function grid(
    capabilities: Partial<DataSourceCapabilities> | undefined,
    options: { warnOnPageScopedQuery?: boolean; kind?: string } = {},
): GridApi<Person> {
    return createGridEngine<Person>({
        columns: personColumns,
        dataSource: createRemoteDataSource<Person>({
            ...(capabilities ? { capabilities } : {}),
            ...(options.kind ? { kind: options.kind } : {}),
            fetcher: async ({ query }) => {
                const start = query.pagination.pageIndex * query.pagination.pageSize;
                return { rows: people.slice(start, start + query.pagination.pageSize), totalRows: people.length };
            },
        }),
        initialQuery: { pagination: { pageIndex: 0, pageSize: 3 } },
        ...(options.warnOnPageScopedQuery !== undefined ? { warnOnPageScopedQuery: options.warnOnPageScopedQuery } : {}),
    });
}

const settle = async (): Promise<void> => {
    for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
};

const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined);

const warnings = (spy: ReturnType<typeof quiet>): string[] =>
    spy.mock.calls.map((call: unknown[]) => String(call[0])).filter((text: string) => text.includes('applied to the'));

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe('a paginate-only source', () => {
    const uses: ReadonlyArray<readonly [string, string, (api: GridApi<Person>) => void]> = [
        ['sort', 'sorting', (api) => api.setSort([{ columnId: 'salary', direction: 'asc' }])],
        ['filter', 'filtering', (api) => api.setFilter('department', { operator: 'eq', value: 'Research' })],
        ['search', 'search', (api) => api.setSearch('ada')],
    ];

    it.each(uses)('warns when the query uses %s', async (facet, noun, use) => {
        const warn = quiet();
        const api = grid(ONLY_PAGES);
        await settle();
        expect(warnings(warn)).toEqual([]);

        use(api);
        await settle();

        const [message] = warnings(warn);
        expect(warnings(warn)).toHaveLength(1);
        expect(message).toContain(`[gridwright] ${noun} is applied to the 3 rows of the page received`);
        expect(message).toContain('does not declare `' + facet + '`');
        expect(message).toContain(`capabilities.${facet}: true`);
        expect(message).toContain('warnOnPageScopedQuery: false');
        api.destroy();
    });

    it.each(uses)('names the source kind in the %s warning', async (_facet, _noun, use) => {
        const warn = quiet();
        const api = grid(ONLY_PAGES, { kind: 'orders-api' });
        await settle();
        use(api);
        await settle();

        expect(warnings(warn)[0]).toContain('the "orders-api" source');
        api.destroy();
    });

    it('says nothing for a grid that only pages and never sorts, filters or searches', async () => {
        const warn = quiet();
        const api = grid(ONLY_PAGES);
        await settle();
        api.nextPage();
        await settle();
        api.setPageSize(2);
        await settle();

        expect(warnings(warn)).toEqual([]);
        api.destroy();
    });

    it('says each facet once, however many times it is used', async () => {
        const warn = quiet();
        const api = grid(ONLY_PAGES);
        await settle();

        for (const term of ['a', 'ad', 'ada', 'ada ', 'ada l']) {
            api.setSearch(term);
            await settle();
        }
        api.toggleSort('salary');
        await settle();
        api.toggleSort('salary');
        await settle();

        expect(warnings(warn)).toHaveLength(2);
        expect(warnings(warn).filter((text) => text.startsWith('[gridwright] search'))).toHaveLength(1);
        expect(warnings(warn).filter((text) => text.startsWith('[gridwright] sorting'))).toHaveLength(1);
        api.destroy();
    });

    it('says all three when one query uses all three', async () => {
        const warn = quiet();
        const api = grid(ONLY_PAGES);
        await settle();

        api.setQuery({
            sort: [{ columnId: 'salary', direction: 'desc' }],
            filters: [{ columnId: 'department', operator: 'eq', value: 'Research' }],
            search: 'a',
        });
        await settle();

        expect(warnings(warn)).toHaveLength(3);
        api.destroy();
    });

    it('counts the rows it actually received', async () => {
        const warn = quiet();
        const api = grid(ONLY_PAGES);
        await settle();
        api.setPageSize(5);
        await settle();
        api.setSearch('a');
        await settle();

        expect(warnings(warn)[0]).toContain('applied to the 5 rows of the page received');
        api.destroy();
    });

    it('speaks again for a replacement source, which is a new situation', async () => {
        const warn = quiet();
        const api = grid(ONLY_PAGES);
        await settle();
        api.setSearch('a');
        await settle();
        expect(warnings(warn)).toHaveLength(1);

        api.setDataSource(
            createRemoteDataSource<Person>({ capabilities: ONLY_PAGES, fetcher: async () => ({ rows: people.slice(0, 2), totalRows: 7 }) }),
        );
        await settle();

        expect(warnings(warn)).toHaveLength(2);
        api.destroy();
    });

    it('stops speaking when it is replaced by a source that resolves the facet', async () => {
        const warn = quiet();
        const api = grid(ONLY_PAGES);
        await settle();
        api.setDataSource(createRemoteDataSource<Person>({ fetcher: async () => ({ rows: people.slice(0, 2), totalRows: 7 }) }));
        await settle();
        api.setSearch('zzz');
        await settle();

        expect(warnings(warn)).toEqual([]);
        api.destroy();
    });
});

describe('a source that resolves the facet it is asked for', () => {
    it.each([
        ['declares sort', { sort: true, filter: false, search: false, paginate: true }, (api: GridApi<Person>) => api.toggleSort('salary')],
        [
            'declares filter',
            { sort: false, filter: true, search: false, paginate: true },
            (api: GridApi<Person>) => api.setFilter('department', { operator: 'eq', value: 'Research' }),
        ],
        ['declares search', { sort: false, filter: false, search: true, paginate: true }, (api: GridApi<Person>) => api.setSearch('ada')],
        [
            'declares everything',
            undefined,
            (api: GridApi<Person>) => {
                api.toggleSort('salary');
                api.setSearch('a');
            },
        ],
    ] as const)('says nothing when it %s', async (_name, capabilities, use) => {
        const warn = quiet();
        const api = grid(capabilities);
        await settle();

        use(api);
        await settle();

        expect(warnings(warn)).toEqual([]);
        api.destroy();
    });

    it('warns about the facet it leaves out and only that one', async () => {
        const warn = quiet();
        const api = grid({ sort: true, filter: false, search: true, paginate: true });
        await settle();

        api.setQuery({
            sort: [{ columnId: 'salary', direction: 'asc' }],
            search: 'a',
            filters: [{ columnId: 'department', operator: 'eq', value: 'Research' }],
        });
        await settle();

        expect(warnings(warn)).toHaveLength(1);
        expect(warnings(warn)[0]).toContain('filtering is applied');
        api.destroy();
    });
});

describe('a source that is not paginating for itself', () => {
    it('says nothing for an array, which holds the whole result', () => {
        const warn = quiet();
        const api = createGridEngine<Person>({ columns: personColumns, dataSource: createLocalDataSource<Person>(people) });

        api.setSearch('ada');
        api.toggleSort('salary');
        api.setFilter('department', { operator: 'eq', value: 'Research' });

        expect(warnings(warn)).toEqual([]);
        api.destroy();
    });

    it('says nothing for a source that pages and says it does the rest', async () => {
        const warn = quiet();
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: createWindowedDataSource<Person>({
                blockSize: 3,
                maxBlocks: 2,
                fetchRange: async ({ offset, limit }) => ({ rows: people.slice(offset, offset + limit), totalRows: people.length }),
            }),
        });
        await settle();

        api.setSearch('ada');
        api.toggleSort('salary');
        await settle();

        expect(warnings(warn)).toEqual([]);
        api.destroy();
    });
});

describe('switching it off, and production', () => {
    it('is silent when told page-only is intended', async () => {
        const warn = quiet();
        const api = grid(ONLY_PAGES, { warnOnPageScopedQuery: false });
        await settle();

        api.setSearch('ada');
        api.toggleSort('salary');
        api.setFilter('department', { operator: 'eq', value: 'Research' });
        await settle();

        expect(warnings(warn)).toEqual([]);
        api.destroy();
    });

    it('does not change what the grid does, only what it says', async () => {
        quiet();
        const api = grid(ONLY_PAGES);
        await settle();

        api.setSort([{ columnId: 'salary', direction: 'asc' }]);
        await settle();

        expect(api.getState().rows.map((row) => row.data.name)).toEqual(['Katherine Johnson', 'Ada Lovelace', 'Grace Hopper']);
        api.destroy();
    });

    it('is silent in a production build', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        const warn = quiet();
        const api = grid(ONLY_PAGES);
        await settle();

        api.setSearch('ada');
        await settle();

        expect(warnings(warn)).toEqual([]);
        api.destroy();
    });

    it.each(['development', 'test', ''])('speaks when NODE_ENV is %j', async (value) => {
        vi.stubEnv('NODE_ENV', value);
        const warn = quiet();
        const api = grid(ONLY_PAGES);
        await settle();

        api.setSearch('ada');
        await settle();

        expect(warnings(warn)).toHaveLength(1);
        api.destroy();
    });
});

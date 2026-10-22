import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { rowDetail } from '../../src/react/detail/addon';
import { virtualRows } from '../../src/react/virtual/addon';
import type { GridAddon } from '../../src/react/addons/types';
import type { GridApi } from '../../src/core/types';
import type { GridwrightColumn } from '../../src/react/types';
import { fakeServer } from '../fake-server';
import type { Person } from '../fixtures';

/**
 * What assistive technology is told, while the grid sorts, filters, pages and virtualizes.
 *
 * A screen reader has no view of the rows that are not mounted. It knows the table only through
 * `aria-rowcount`, each row's `aria-rowindex`, `aria-sort` and the live region, so those have to stay
 * true to the whole result set through every combination, not only on a first, unsorted page.
 */

const TOTAL = 240;
const DEPARTMENTS = ['Engineering', 'Research', 'Operations', 'Finance'];

const many: Person[] = Array.from({ length: TOTAL }, (_, index) => ({
    id: index + 1,
    name: `Person ${String(index + 1).padStart(3, '0')}`,
    department: DEPARTMENTS[index % DEPARTMENTS.length]!,
    // Runs against the id so that sorting by salary reorders everything.
    salary: ((index * 37) % TOTAL) + 1,
    startedOn: '2020-01-01',
    active: true,
}));

const columns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary' },
];

type Layout = 'paged' | 'virtual';
type Origin = 'local' | 'server';

let current: GridApi<Person>;
const probe: GridAddon<Person> = {
    name: 'test:api',
    setup: () => ({
        toolbar: (context) => {
            current = context.api;
            return null;
        },
    }),
};

function mount(origin: Origin, layout: Layout, extra: readonly GridAddon<Person>[] = []) {
    const server = fakeServer(many);
    const addons = [probe, ...(layout === 'virtual' ? [virtualRows<Person>({ rowHeight: 40, height: 400 })] : []), ...extra];
    return {
        server,
        ...render(
            <Gridwright<Person>
                columns={columns}
                {...(origin === 'local' ? { data: many } : { dataSource: server.dataSource })}
                getRowId={(row) => row.id}
                pageSize={layout === 'virtual' ? TOTAL : 20}
                aria-label="People"
                addons={addons}
            />,
        ),
    };
}

const ready = () => waitFor(() => expect(current.getState().status).toBe('ready'));
const change = async (run: (api: GridApi<Person>) => void) => {
    await act(async () => run(current));
    await ready();
};

const dataRows = (): HTMLElement[] =>
    screen.getAllByRole('row').filter((row) => row.getAttribute('aria-rowindex') !== '1' && row.hasAttribute('data-row-id'));

const indices = (): number[] => dataRows().map((row) => Number(row.getAttribute('aria-rowindex')));

const nameOf = (row: HTMLElement): string => row.querySelector('[data-column-id="name"]')!.textContent!;

/** The result set a query describes, worked out independently of the grid. */
function expected(query: { sort?: 'asc' | 'desc'; department?: string; search?: string }): Person[] {
    let result = [...many];
    if (query.department) result = result.filter((row) => row.department === query.department);
    if (query.search) result = result.filter((row) => [row.name, row.department, String(row.salary)].some((text) => text.toLowerCase().includes(query.search!.toLowerCase())));
    if (query.sort) result.sort((a, b) => (query.sort === 'asc' ? a.salary - b.salary : b.salary - a.salary));
    return result;
}

interface Scenario {
    readonly name: string;
    readonly query: { sort?: 'asc' | 'desc'; department?: string; search?: string };
    apply(api: GridApi<Person>): void;
}

const scenarios: readonly Scenario[] = [
    { name: 'nothing applied', query: {}, apply: () => undefined },
    { name: 'sorted ascending', query: { sort: 'asc' }, apply: (api) => api.setSort([{ columnId: 'salary', direction: 'asc' }]) },
    { name: 'sorted descending', query: { sort: 'desc' }, apply: (api) => api.setSort([{ columnId: 'salary', direction: 'desc' }]) },
    { name: 'filtered', query: { department: 'Research' }, apply: (api) => api.setFilter('department', { operator: 'eq', value: 'Research' }) },
    { name: 'searched', query: { search: '07' }, apply: (api) => api.setSearch('07') },
    {
        name: 'filtered and sorted',
        query: { department: 'Operations', sort: 'desc' },
        apply: (api) => {
            api.setFilter('department', { operator: 'eq', value: 'Operations' });
            api.setSort([{ columnId: 'salary', direction: 'desc' }]);
        },
    },
    {
        name: 'searched, filtered and sorted',
        query: { department: 'Finance', search: '1', sort: 'asc' },
        apply: (api) => {
            api.setSearch('1');
            api.setFilter('department', { operator: 'eq', value: 'Finance' });
            api.setSort([{ columnId: 'salary', direction: 'asc' }]);
        },
    },
];

afterEach(() => undefined);

describe('the row count and positions tell the truth about the whole result', () => {
    describe.each(['local', 'server'] as const)('%s data', (origin) => {
        describe.each(['paged', 'virtual'] as const)('%s', (layout) => {
            describe.each(scenarios)('$name', (scenario) => {
                it('counts every matching row plus the header', async () => {
                    mount(origin, layout);
                    await ready();
                    await change(scenario.apply);

                    const matching = expected(scenario.query);
                    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', String(matching.length + 1));
                });

                it('numbers the mounted rows by their place in the result, without gaps or repeats', async () => {
                    mount(origin, layout);
                    await ready();
                    await change(scenario.apply);

                    const positions = indices();
                    expect(positions.length).toBeGreaterThan(0);
                    expect(positions[0]).toBe(2);
                    positions.forEach((position, at) => expect(position).toBe(2 + at));
                    expect(Math.max(...positions)).toBeLessThanOrEqual(expected(scenario.query).length + 1);
                });

                it('shows the right record at each position', async () => {
                    mount(origin, layout);
                    await ready();
                    await change(scenario.apply);

                    const matching = expected(scenario.query);
                    for (const row of dataRows()) {
                        const position = Number(row.getAttribute('aria-rowindex')) - 2;
                        expect(nameOf(row)).toBe(matching[position]!.name);
                    }
                });
            });
        });
    });
});

describe('the position after the reader has moved on', () => {
    it.each(['local', 'server'] as const)('numbers page three from row 41 on %s data, however it was reached', async (origin) => {
        mount(origin, 'paged');
        await ready();

        await change((api) => api.setSort([{ columnId: 'salary', direction: 'desc' }]));
        await change((api) => api.setPage(2));

        const matching = expected({ sort: 'desc' });
        expect(indices()[0]).toBe(42);
        expect(nameOf(dataRows()[0]!)).toBe(matching[40]!.name);
        expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', String(TOTAL + 1));
    });

    it.each(['local', 'server'] as const)('returns to row two, and counts the shorter set, when a filter changes it from a late page (%s)', async (origin) => {
        mount(origin, 'paged');
        await ready();
        await change((api) => api.setPage(10));
        expect(indices()[0]).toBe(202);

        await change((api) => api.setFilter('department', { operator: 'eq', value: 'Research' }));

        // A filter changes which rows exist, so the page number the reader was on means nothing now.
        expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '61');
        expect(indices()[0]).toBe(2);
        expect(nameOf(dataRows()[0]!)).toBe(expected({ department: 'Research' })[0]!.name);
    });

    it('lands on the last page that exists when a refresh shrinks the server set beneath a late page', async () => {
        const { server } = mount('server', 'paged');
        await ready();
        await change((api) => api.setPage(10));

        server.rows = many.slice(0, 50);
        await act(async () => void (await current.refresh()));
        await waitFor(() => expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '51'));
        await ready();

        expect(indices()[0]).toBe(42);
        expect(nameOf(dataRows()[0]!)).toBe(many[40]!.name);
    });

    it('numbers rows from the start of the window when the reader has scrolled, then sorts', async () => {
        const { container } = mount('local', 'virtual');
        await ready();
        const scroller = container.querySelector<HTMLElement>('.gw-table-wrapper')!;
        await act(async () => {
            scroller.scrollTop = 100 * 40;
            scroller.dispatchEvent(new Event('scroll'));
            await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        });
        await waitFor(() => expect(indices()[0]).toBeGreaterThan(50));

        await change((api) => api.setSort([{ columnId: 'salary', direction: 'asc' }]));

        const matching = expected({ sort: 'asc' });
        const positions = indices();
        positions.forEach((position, at) => expect(position).toBe(positions[0]! + at));
        for (const row of dataRows()) {
            expect(nameOf(row)).toBe(matching[Number(row.getAttribute('aria-rowindex')) - 2]!.name);
        }
    });
});

describe('aria-sort names the sorted column and only that one', () => {
    const headerOf = (name: string): HTMLElement => screen.getByRole('columnheader', { name: new RegExp(name) });
    const sortedHeaders = (): string[] =>
        screen
            .getAllByRole('columnheader')
            .filter((header) => header.hasAttribute('aria-sort') && header.getAttribute('aria-sort') !== 'none')
            .map((header) => header.getAttribute('data-column-id') ?? header.textContent!);

    it.each(['local', 'server'] as const)('moves from one column to another on %s data', async (origin) => {
        mount(origin, 'paged');
        await ready();

        await change((api) => api.setSort([{ columnId: 'salary', direction: 'asc' }]));
        expect(headerOf('Salary')).toHaveAttribute('aria-sort', 'ascending');
        expect(sortedHeaders()).toHaveLength(1);

        await change((api) => api.setSort([{ columnId: 'name', direction: 'desc' }]));
        expect(headerOf('Name')).toHaveAttribute('aria-sort', 'descending');
        expect(headerOf('Salary').getAttribute('aria-sort') ?? 'none').toBe('none');
        expect(sortedHeaders()).toHaveLength(1);

        await change((api) => api.setSort([]));
        expect(sortedHeaders()).toHaveLength(0);
    });

    it.each(['local', 'server'] as const)('keeps its value through a filter, a search and a page change on %s data', async (origin) => {
        mount(origin, 'paged');
        await ready();
        await change((api) => api.setSort([{ columnId: 'salary', direction: 'desc' }]));

        await change((api) => api.setFilter('department', { operator: 'eq', value: 'Finance' }));
        await change((api) => api.setSearch('1'));
        await change((api) => api.setPage(1));

        expect(headerOf('Salary')).toHaveAttribute('aria-sort', 'descending');
    });

    it('stays true while the sorted rows are still on their way', async () => {
        const { server } = mount('server', 'paged');
        await ready();

        server.hold();
        await act(async () => current.setSort([{ columnId: 'salary', direction: 'asc' }]));

        // The query has changed and the rows have not. The header reports the sort that was asked
        // for, and the table is marked busy rather than presenting old rows as the new order.
        expect(headerOf('Salary')).toHaveAttribute('aria-sort', 'ascending');
        expect(current.getState().status).toBe('refreshing');

        await act(async () => server.release());
        await ready();
        expect(nameOf(dataRows()[0]!)).toBe(expected({ sort: 'asc' })[0]!.name);
    });
});

describe('the live region follows the result', () => {
    const announcement = (): string => screen.getByRole('status').textContent ?? '';

    it.each(['local', 'server'] as const)('reports the range of the filtered set on %s data', async (origin) => {
        mount(origin, 'paged');
        await ready();
        await waitFor(() => expect(announcement()).toBe(`Showing 1 to 20 of ${TOTAL}`));

        await change((api) => api.setFilter('department', { operator: 'eq', value: 'Research' }));

        await waitFor(() => expect(announcement()).toBe('Showing 1 to 20 of 60'));
    });

    it.each(['local', 'server'] as const)('reports the last page honestly on %s data', async (origin) => {
        mount(origin, 'paged');
        await ready();

        await change((api) => api.setFilter('department', { operator: 'eq', value: 'Research' }));
        await change((api) => api.setPage(2));

        await waitFor(() => expect(announcement()).toBe('Showing 41 to 60 of 60'));
    });

    it('does not announce a range of rows that are still loading', async () => {
        const { server } = mount('server', 'paged');
        await ready();
        await waitFor(() => expect(announcement()).toBe(`Showing 1 to 20 of ${TOTAL}`));

        server.hold();
        await act(async () => current.setPage(3));

        expect(announcement()).not.toMatch(/61 to 80/);

        await act(async () => server.release());
        await waitFor(() => expect(announcement()).toBe(`Showing 61 to 80 of ${TOTAL}`));
    });
});

describe('a detail panel does not disturb the positions', () => {
    const panel = rowDetail<Person>({ render: (row) => `Detail of ${row.data.name}` });

    it('refuses to be listed with row windowing, naming both, rather than misnumbering rows', () => {
        expect(() => mount('local', 'virtual', [panel])).toThrow(/gridwright:row-detail.*gridwright:virtual/s);
    });

    it('leaves the row count and the indices alone when panels open', async () => {
        mount('local', 'paged', [panel]);
        await ready();
        const before = { count: screen.getByRole('grid').getAttribute('aria-rowcount'), indices: indices() };

        const toggles = screen.getAllByRole('button', { name: /Show details/ });
        await act(async () => toggles[0]!.click());
        await act(async () => toggles[2]!.click());

        expect(screen.getAllByText(/^Detail of/)).toHaveLength(2);
        expect(screen.getByRole('grid').getAttribute('aria-rowcount')).toBe(before.count);
        expect(indices()).toEqual(before.indices);
    });

    it.each(['local', 'server'] as const)('numbers rows true after a sort with a panel open (%s)', async (origin) => {
        mount(origin, 'paged', [panel]);
        await ready();
        await act(async () => screen.getAllByRole('button', { name: /Show details/ })[0]!.click());

        await change((api) => api.setSort([{ columnId: 'salary', direction: 'desc' }]));

        const matching = expected({ sort: 'desc' });
        for (const row of dataRows()) {
            expect(nameOf(row)).toBe(matching[Number(row.getAttribute('aria-rowindex')) - 2]!.name);
        }
        expect(indices()).toEqual(Array.from({ length: 20 }, (_, at) => at + 2));
    });
});

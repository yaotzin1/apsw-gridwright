/**
 * The documented recipes, executed.
 *
 * Every test here is a recipe from `docs/react-playbook.md` or a step from
 * `docs/getting-started.md`, written the way the page writes it and asserting the outcome the page
 * claims. Documentation that is only read drifts; documentation that is run cannot.
 *
 * A failure here means the **page** is wrong until proven otherwise. Fix the page, or fix the code
 * and say so on the page -- do not adjust the test until it agrees with whatever the code does now.
 *
 * Deliberately through the package specifiers' real modules, and using only exports a consumer has.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRemoteDataSource } from '../../src/data/remote';
import { createRestDataSource } from '../../src/data/rest';
import { createWindowedDataSource } from '../../src/data/windowed';
import { columnCountOf } from '../../src/react/parts/slots';
import { Gridwright } from '../../src/react/Gridwright';
import { columnFilters } from '../../src/react/filters';
import { coreAddons, search } from '../../src/react/core-addons';
import { columnLayout } from '../../src/react/layout';
import { inlineEditing } from '../../src/react/plugins/addons';
import { rowDetail } from '../../src/react/detail/addon';
import { pl } from '../../src/locales';
import type { GridAddon } from '../../src/react/addons/types';
import type { GridQuery } from '../../src/core/types';
import type { GridwrightColumn } from '../../src/react/types';

interface Person {
    id: number;
    name: string;
    department: string;
    salary: number;
    canEditPay: boolean;
}

const PEOPLE: Person[] = [
    { id: 1, name: 'Ada Lovelace', department: 'Engineering', salary: 164_000, canEditPay: true },
    { id: 2, name: 'Grace Hopper', department: 'Engineering', salary: 152_000, canEditPay: false },
    { id: 3, name: 'Katherine Johnson', department: 'Research', salary: 148_000, canEditPay: true },
    { id: 4, name: 'Mary Jackson', department: 'Research', salary: 121_000, canEditPay: false },
    { id: 5, name: 'Dorothy Vaughan', department: 'Operations', salary: 133_000, canEditPay: true },
];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const columns: GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary', align: 'end', formatValue: (value) => money.format(Number(value)) },
];

const bodyNames = (): string[] =>
    screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');

/** A `fetchImpl` for `createRestDataSource`, which the options expose for exactly this. */
function jsonFetch(handler: (url: URL) => { body: unknown; headers?: Record<string, string> }): typeof fetch {
    return (async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'http://localhost');
        const { body, headers } = handler(url);
        return new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...headers },
        });
    }) as typeof fetch;
}

// --- getting-started.md ------------------------------------------------------------------------

describe('Getting started', () => {
    it('step 1: two props and a list of columns is a working grid', () => {
        render(<Gridwright<Person> columns={columns} data={PEOPLE} pageSize={25} aria-label="People" />);

        // The claims the page makes about what you get without asking.
        expect(screen.getByRole('grid', { name: 'People' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Salary/ })).toBeInTheDocument();
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getAllByRole('row')).toHaveLength(1 + PEOPLE.length);
        expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'none');
    });

    it('step 1: the page size control agrees with the page size', () => {
        render(<Gridwright<Person> columns={columns} data={PEOPLE} pageSize={2} aria-label="People" />);
        expect(screen.getByRole('combobox', { name: /Rows per page/i })).toHaveValue('2');
        expect(screen.getAllByRole('row')).toHaveLength(1 + 2);
    });

    it('step 2: formatValue is what the screen shows and what search matches', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={columns} data={PEOPLE} aria-label="People" addons={[search()]} />);

        expect(within(screen.getAllByRole('row')[1]!).getAllByRole('cell')[2]).toHaveTextContent('$164,000');

        // The page's claim: the engine searches values, so what is on screen is findable.
        await user.type(screen.getByRole('searchbox'), 'Research');
        await waitFor(() => expect(bodyNames()).toEqual(['Katherine Johnson', 'Mary Jackson']));
    });
});

// --- react-playbook.md -------------------------------------------------------------------------

describe('Recipe 1 — read-only grid over an endpoint', () => {
    it('sends the documented wire format and reads the documented response shapes', async () => {
        const seen: URL[] = [];
        const source = createRestDataSource<Person>({
            url: '/api/people',
            fetchImpl: jsonFetch((url) => {
                seen.push(url);
                return { body: { data: PEOPLE.slice(0, 2), total: PEOPLE.length } };
            }),
        });

        render(<Gridwright<Person> columns={columns} dataSource={source} pageSize={2} aria-label="People" />);

        await waitFor(() => expect(bodyNames()).toEqual(['Ada Lovelace', 'Grace Hopper']));

        // "page is one-based", and pageSize is the row count.
        expect(seen[0]!.searchParams.get('page')).toBe('1');
        expect(seen[0]!.searchParams.get('pageSize')).toBe('2');

        // `{ data, total }` is one of the shapes the page says is read: the total made it through.
        // Asserted on `aria-rowcount` (totalRows + the header row) rather than the range text,
        // which the live region also carries -- two nodes, one string.
        expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '6');
    });

    it('reads a total from an X-Total-Count header', async () => {
        const source = createRestDataSource<Person>({
            url: '/api/people',
            fetchImpl: jsonFetch(() => ({ body: PEOPLE.slice(0, 2), headers: { 'X-Total-Count': '5' } })),
        });

        render(<Gridwright<Person> columns={columns} dataSource={source} pageSize={2} aria-label="People" />);
        await waitFor(() => expect(bodyNames()).toHaveLength(2));
        expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '6');
    });

    it('sends a token from a headers function, per request rather than captured once', async () => {
        const tokens: (string | null)[] = [];
        let issued = 0;

        const source = createRestDataSource<Person>({
            url: '/api/people',
            headers: async () => ({ Authorization: `Bearer token-${++issued}` }),
            fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
                tokens.push(new Headers(init?.headers).get('Authorization'));
                // It has to page, or there is no next page to press and no second request.
                const url = new URL(String(input), 'http://localhost');
                const page = Number(url.searchParams.get('page') ?? '1');
                const size = Number(url.searchParams.get('pageSize') ?? '2');
                const body = { data: PEOPLE.slice((page - 1) * size, page * size), total: PEOPLE.length };
                return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }) as typeof fetch,
        });

        const user = userEvent.setup();
        render(<Gridwright<Person> columns={columns} dataSource={source} pageSize={2} aria-label="People" />);
        await waitFor(() => expect(tokens).toHaveLength(1));

        await user.click(screen.getByRole('button', { name: 'Next page' }));
        await waitFor(() => expect(tokens).toHaveLength(2));
        expect(tokens).toEqual(['Bearer token-1', 'Bearer token-2']);
    });

    it('replaces the whole vocabulary through buildParams and parseResponse', async () => {
        let seen: URL | null = null;
        const source = createRestDataSource<Person>({
            url: '/api/people',
            buildParams: (query) => ({
                offset: String(query.pagination.pageIndex * query.pagination.pageSize),
                limit: String(query.pagination.pageSize),
                order_by: query.sort.map((s) => `${s.direction === 'desc' ? '-' : ''}${s.columnId}`).join(','),
            }),
            parseResponse: (payload) => {
                const body = payload as { results: Person[]; count: number };
                return { rows: body.results, totalRows: body.count };
            },
            fetchImpl: jsonFetch((url) => {
                seen = url;
                return { body: { results: PEOPLE.slice(0, 2), count: PEOPLE.length } };
            }),
        });

        render(<Gridwright<Person> columns={columns} dataSource={source} pageSize={2} aria-label="People" />);
        await waitFor(() => expect(bodyNames()).toHaveLength(2));

        expect(seen!.searchParams.get('offset')).toBe('0');
        expect(seen!.searchParams.get('limit')).toBe('2');
        expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '6');
    });
});

describe('Recipe 3 — the server only pages', () => {
    it('lets the pipeline sort, filter and search the page that arrived', async () => {
        const user = userEvent.setup();
        const requests: GridQuery[] = [];

        const source = createRemoteDataSource<Person>({
            capabilities: { paginate: true, sort: false, filter: false, search: false },
            fetcher: ({ query }) => {
                requests.push(query);
                const { pageIndex, pageSize } = query.pagination;
                const start = pageIndex * pageSize;
                return { rows: PEOPLE.slice(start, start + pageSize), totalRows: PEOPLE.length };
            },
        });

        render(<Gridwright<Person> columns={columns} dataSource={source} pageSize={3} aria-label="People" />);
        await waitFor(() => expect(bodyNames()).toHaveLength(3));

        // Sorting is the pipeline's, on the three rows that arrived.
        const before = requests.length;
        await user.click(screen.getByRole('button', { name: /Salary/ }));
        await waitFor(() => expect(bodyNames()).toEqual(['Katherine Johnson', 'Grace Hopper', 'Ada Lovelace']));

        // And the request still went out. The engine hands the source *every* query change and lets
        // it decide what to do with it, whatever `capabilities` said -- which is why a sort on a
        // paginate-only source costs a round trip, and why `queryDebounceMs` exists.
        expect(requests.length).toBeGreaterThan(before);
        expect(requests.at(-1)!.sort).toEqual([{ columnId: 'salary', direction: 'asc' }]);
    });

    it('says "of many" rather than inventing a total, and still offers the next page', async () => {
        const user = userEvent.setup();
        const source = createRemoteDataSource<Person>({
            capabilities: { paginate: true, sort: false, filter: false, search: false },
            fetcher: ({ query }) => {
                const { pageIndex, pageSize } = query.pagination;
                const start = pageIndex * pageSize;
                // No totalRows: the documented honest answer from an endpoint that does not count.
                return { rows: PEOPLE.slice(start, start + pageSize) };
            },
        });

        render(<Gridwright<Person> columns={columns} dataSource={source} pageSize={2} aria-label="People" />);
        await waitFor(() => expect(bodyNames()).toHaveLength(2));

        // -1 is the ARIA value for "the total is not known", which is exactly the situation.
        expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '-1');
        expect(screen.getAllByText(/many/i).length).toBeGreaterThan(0);

        await user.click(screen.getByRole('button', { name: 'Next page' }));
        await waitFor(() => expect(bodyNames()).toEqual(['Katherine Johnson', 'Mary Jackson']));
    });

    it('hands the fetcher a signal, and aborts it once the query moves on', async () => {
        const user = userEvent.setup();
        const signals: AbortSignal[] = [];

        const source = createRemoteDataSource<Person>({
            capabilities: { paginate: true, sort: false, filter: false, search: false },
            fetcher: ({ query, signal }) => {
                signals.push(signal);
                const { pageIndex, pageSize } = query.pagination;
                const start = pageIndex * pageSize;
                return { rows: PEOPLE.slice(start, start + pageSize), totalRows: PEOPLE.length };
            },
        });

        render(<Gridwright<Person> columns={columns} dataSource={source} pageSize={2} aria-label="People" />);
        await waitFor(() => expect(bodyNames()).toHaveLength(2));

        // The page says to pass this into `fetch`. It exists, and it is live while the request is.
        expect(signals[0]).toBeInstanceOf(AbortSignal);
        expect(signals[0]!.aborted).toBe(false);

        await user.click(screen.getByRole('button', { name: 'Next page' }));
        await waitFor(() => expect(bodyNames()).toEqual(['Katherine Johnson', 'Mary Jackson']));

        // Superseded: a response for page 1 arriving late can no longer overwrite page 2, which is
        // the whole reason the page says to pass it on.
        expect(signals[0]!.aborted).toBe(true);
        expect(signals[1]!.aborted).toBe(false);
    });
});

describe('Recipe 4 — editable cells that persist', () => {
    it('commits an edit, and reverts the cell when commit throws', async () => {
        const user = userEvent.setup();
        const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
        const saved: [string | number, string, unknown][] = [];

        const editable: GridwrightColumn<Person>[] = [
            { id: 'name', header: 'Name', edit: {} },
            { id: 'department', header: 'Department' },
            { id: 'salary', header: 'Salary', align: 'end', edit: { inputType: 'number', editable: (row) => row.canEditPay } },
        ];

        render(
            <Gridwright<Person>
                columns={editable}
                data={PEOPLE}
                aria-label="People"
                addons={[
                    inlineEditing({
                        commit: (rowId, columnId, value) => {
                            if (value === 'nope') throw new Error('refused');
                            saved.push([rowId, columnId, value]);
                        },
                    }),
                ]}
            />,
        );

        // `edit: {}` is enough to make a column editable: `editable` defaults to true.
        const trigger = screen.getAllByRole('button', { name: /Ada Lovelace/ })[0]!;
        await user.click(trigger);
        const input = await screen.findByRole('textbox');
        await user.clear(input);
        await user.type(input, 'Ada L{Enter}');

        await waitFor(() => expect(saved).toEqual([[1, 'name', 'Ada L']]));
        reported.mockRestore();
    });

    it('honours editable per row, so a locked cell offers no editor', () => {
        const editable: GridwrightColumn<Person>[] = [
            { id: 'name', header: 'Name' },
            { id: 'salary', header: 'Salary', edit: { inputType: 'number', editable: (row) => row.canEditPay } },
        ];

        render(
            <Gridwright<Person>
                columns={editable}
                data={PEOPLE}
                pageSize={2}
                aria-label="People"
                addons={[inlineEditing({ commit: () => undefined })]}
            />,
        );

        // Ada may, Grace may not.
        expect(screen.getAllByRole('button', { name: /164,000|164000/ })).toHaveLength(1);
        expect(screen.queryAllByRole('button', { name: /152,000|152000/ })).toHaveLength(0);
    });
});

describe('Recipe 5 — master–detail', () => {
    it('opens a nested grid under a row, and draws no toggle where hasDetail says no', async () => {
        const user = userEvent.setup();

        render(
            <Gridwright<Person>
                columns={columns}
                data={PEOPLE}
                aria-label="People"
                addons={[
                    rowDetail<Person>({
                        hasDetail: (row) => row.data.department === 'Engineering',
                        render: ({ data }) => (
                            <Gridwright<Person>
                                columns={columns}
                                data={PEOPLE.filter((p) => p.department === data.department)}
                                coreAddons={false}
                                aria-label={`Team of ${data.name}`}
                            />
                        ),
                    }),
                ]}
            />,
        );

        expect(screen.getAllByRole('button', { name: /Show details for/ })).toHaveLength(2);

        await user.click(screen.getByRole('button', { name: 'Show details for Ada Lovelace' }));
        const panel = screen.getByRole('region', { name: 'Details for Ada Lovelace' });

        // A whole grid inside a row, and `coreAddons={false}` really is a bare table.
        const inner = within(panel).getByRole('grid', { name: 'Team of Ada Lovelace' });
        expect(within(inner).queryByRole('button', { name: /Salary/ })).not.toBeInTheDocument();
        expect(within(inner).getAllByRole('row')).toHaveLength(1 + 2);
    });

    it('throws, naming both, when listed with virtualRows()', async () => {
        const { virtualRows } = await import('../../src/react/virtual/addon');
        const reported = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() =>
            render(
                <Gridwright<Person>
                    columns={columns}
                    data={PEOPLE}
                    aria-label="People"
                    addons={[virtualRows(), rowDetail<Person>({ render: () => <p>detail</p> })]}
                />,
            ),
        ).toThrow(/row-detail[\s\S]*virtual|virtual[\s\S]*row-detail/);

        reported.mockRestore();
    });
});

describe('Recipe 6 — remember what the user changed', () => {
    it('restores a saved query and reports every change', async () => {
        const user = userEvent.setup();
        const changes: GridQuery[] = [];

        render(
            <Gridwright<Person>
                columns={columns}
                data={PEOPLE}
                pageSize={2}
                aria-label="People"
                initialQuery={{ sort: [{ columnId: 'salary', direction: 'asc' }] }}
                onQueryChange={(next) => changes.push(next)}
            />,
        );

        // Restored: the lowest salary is first without anyone clicking.
        expect(bodyNames()[0]).toBe('Mary Jackson');
        expect(screen.getByRole('columnheader', { name: /Salary/ })).toHaveAttribute('aria-sort', 'ascending');

        await user.click(screen.getByRole('button', { name: 'Next page' }));
        await waitFor(() => expect(changes.at(-1)?.pagination.pageIndex).toBe(1));
    });

    it('does not fire a layout onChange on mount, so it cannot overwrite a saved layout', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <Gridwright<Person>
                columns={columns}
                data={PEOPLE}
                aria-label="People"
                addons={[columnLayout({ initial: { hidden: { department: true } }, onChange })]}
            />,
        );

        // `initial` applied: the hidden column is not rendered...
        expect(screen.queryByRole('columnheader', { name: /Department/ })).not.toBeInTheDocument();
        // ...and nothing was reported for simply having restored it.
        expect(onChange).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Columns' }));
        await user.click(screen.getByRole('menuitemcheckbox', { name: 'Department' }));
        await waitFor(() => expect(onChange).toHaveBeenCalled());
    });
});

describe('Recipe 7 — very large result sets', () => {
    it('fetches blocks rather than the table, and holds only a window', async () => {
        const ranges: { offset: number; limit: number }[] = [];
        const TOTAL = 10_000;

        const source = createWindowedDataSource<Person>({
            blockSize: 100,
            maxBlocks: 4,
            fetchRange: async ({ offset, limit }) => {
                ranges.push({ offset, limit });
                const rows = Array.from({ length: Math.min(limit, TOTAL - offset) }, (_, index) => ({
                    id: offset + index,
                    name: `Person ${offset + index}`,
                    department: 'Engineering',
                    salary: 100_000,
                    canEditPay: false,
                }));
                // Required here, unlike a paging source: it is the scrollbar's height.
                return { rows, totalRows: TOTAL };
            },
        });

        render(<Gridwright<Person> columns={columns} dataSource={source} pageSize={50} aria-label="People" />);
        await waitFor(() => expect(bodyNames()[0]).toBe('Person 0'));

        // Ten thousand rows exist; one block was fetched.
        expect(ranges[0]!.limit).toBeLessThanOrEqual(100);
        expect(ranges.reduce((sum, range) => sum + range.limit, 0)).toBeLessThan(TOTAL);
        expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', String(TOTAL + 1));
    });
});

describe('Recipe 8 — an add-on of your own', () => {
    it('reaches the cells, the toolbar and a row after a row, from the public exports only', async () => {
        const highlight = (): GridAddon<Person> => ({
            name: 'acme:highlight',
            setup: () => ({
                cellAttributes: (row, column) =>
                    column.id === 'salary' && row.data.salary > 150_000 ? { className: 'is-high', 'data-high': 'true' } : {},
                toolbar: () => <span data-testid="legend">Highlighted: above $150k</span>,
                rowAfter: (row, grid) =>
                    row.data.department === 'Operations' ? (
                        <tr role="presentation" data-testid="note">
                            <td role="presentation" colSpan={columnCountOf(grid)}>
                                end of the list
                            </td>
                        </tr>
                    ) : undefined,
            }),
        });

        render(<Gridwright<Person> columns={columns} data={PEOPLE} aria-label="People" addons={[highlight()]} />);

        expect(screen.getByTestId('legend')).toBeInTheDocument();
        expect(document.querySelectorAll('[data-high="true"]')).toHaveLength(2);

        // The contributed row spans the table and is not a grid row.
        const note = screen.getByTestId('note');
        expect(note.querySelector('td')).toHaveAttribute('colspan', String(columns.length));
        expect(screen.getAllByRole('row')).toHaveLength(1 + PEOPLE.length);
    });

    it('drops an attribute the allowlist does not permit', () => {
        const sneaky = (): GridAddon<Person> => ({
            name: 'acme:sneaky',
            setup: () => ({
                // `href` is not on the allowlist at any value; `data-*` is. An add-on cannot hand
                // the grid a URL attribute, which is what keeps a sink out of the extension point.
                cellAttributes: () => ({ href: '/anywhere', 'data-ok': 'yes' }) as never,
            }),
        });

        render(<Gridwright<Person> columns={columns} data={PEOPLE} aria-label="People" addons={[sneaky()]} />);

        expect(document.querySelector('[data-ok="yes"]')).not.toBeNull();
        expect(document.querySelector('td[href]')).toBeNull();
    });
});

describe('Recipe 11 — translating it', () => {
    it('translates the shell and every built-in add-on from one pack', async () => {
        const user = userEvent.setup();

        render(
            <Gridwright<Person>
                columns={columns}
                data={PEOPLE}
                pageSize={2}
                locale={pl}
                aria-label="Ludzie"
                selectionMode="multiple"
                coreAddons={coreAddons<Person>()}
                addons={[search(), columnFilters(), rowDetail<Person>({ render: () => <p>szczegóły</p> })]}
            />,
        );

        expect(screen.getAllByRole('checkbox', { name: 'Zaznacz wiersz' })).toHaveLength(2);
        await user.click(screen.getByRole('button', { name: 'Pokaż szczegóły: Ada Lovelace' }));
        expect(screen.getByRole('region', { name: 'Szczegóły: Ada Lovelace' })).toBeInTheDocument();
    });

    it('falls back to the catalog when a translate function returns the key', () => {
        render(
            <Gridwright<Person>
                columns={columns}
                data={[]}
                aria-label="People"
                translate={(key) => (key === 'status.empty' ? 'Nothing here yet' : key)}
            />,
        );

        // In the empty state and in the live region: the override reaches every place the string
        // is used, which is the point of it.
        expect(screen.getAllByText('Nothing here yet').length).toBeGreaterThanOrEqual(1);
    });
});

describe('The traps table', () => {
    it('a grid with no stable id still selects, because getRowId supplies one', async () => {
        const user = userEvent.setup();
        const selected: unknown[] = [];
        const rows = PEOPLE.map(({ id, ...rest }) => ({ ...rest, uuid: `u${id}` }));

        render(
            <Gridwright
                columns={columns as never}
                data={rows}
                pageSize={2}
                aria-label="People"
                selectionMode="multiple"
                getRowId={(row) => (row as { uuid: string }).uuid}
                onSelectionChange={(ids) => selected.push(...ids)}
            />,
        );

        await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!);
        await waitFor(() => expect(selected).toEqual(['u1']));
    });

    it('a rebuilt data source refetches, which is why the page says to memoise it', async () => {
        let fetches = 0;

        function Unstable({ rebuild }: { rebuild: number }) {
            // The *correct* pattern from the page: deps are what the source reads.
            const source = useMemo(() => {
                return createRemoteDataSource<Person>({
                    kind: `remote-${rebuild}`,
                    fetcher: () => {
                        fetches += 1;
                        return { rows: PEOPLE, totalRows: PEOPLE.length };
                    },
                });
            }, [rebuild]);

            return <Gridwright<Person> columns={columns} dataSource={source} aria-label="People" />;
        }

        function Harness() {
            const [rebuild, setRebuild] = useState(0);
            return (
                <>
                    <button type="button" onClick={() => setRebuild((value) => value + 1)}>
                        rebuild
                    </button>
                    <Unstable rebuild={rebuild} />
                </>
            );
        }

        const user = userEvent.setup();
        render(<Harness />);
        await waitFor(() => expect(fetches).toBe(1));

        // A render that does NOT change the deps must not refetch.
        await user.click(screen.getByRole('button', { name: 'rebuild' }));
        await waitFor(() => expect(fetches).toBe(2));
    });
});

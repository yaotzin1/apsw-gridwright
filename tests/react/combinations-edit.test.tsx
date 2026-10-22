import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { inlineEditing } from '../../src/react/plugins/addons';
import type { CommitEdit } from '../../src/react/plugins/InlineEdit';
import type { GridAddon } from '../../src/react/addons/types';
import type { GridApi } from '../../src/core/types';
import type { GridwrightColumn } from '../../src/react/types';
import { fakeServer } from '../fake-server';
import type { FakeServer } from '../fake-server';
import type { Person } from '../fixtures';
import { deferred, people } from '../fixtures';

/**
 * Editing a cell while the data underneath it moves.
 *
 * An editor is state the reader has put into the grid (an open input, half a sentence), and the grid
 * keeps fetching, sorting and paging around it. The rule these tests hold to: an edit belongs to a
 * record. Wherever that record goes (down the page, off it, back) the editor, the pending marker and
 * the error stay with it, and Enter writes to the record that was opened, never to whichever row now
 * stands in its place.
 */

const columns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', edit: { editable: true } },
    { id: 'department', header: 'Department', edit: { editable: true } },
    { id: 'salary', header: 'Salary' },
];

interface Mounted {
    readonly user: ReturnType<typeof userEvent.setup>;
    readonly server: FakeServer;
    readonly commit: ReturnType<typeof vi.fn<CommitEdit>>;
    api(): GridApi<Person>;
    rowOf(id: number): HTMLElement | null;
    triggerOf(id: number, column?: 'name' | 'department'): HTMLElement;
    editor(): HTMLInputElement | null;
    open(id: number, column?: 'name' | 'department'): Promise<HTMLElement>;
    type(text: string): Promise<void>;
    refresh(): Promise<void>;
    act(run: (api: GridApi<Person>) => void | Promise<void>): Promise<void>;
}

async function mount(options: { pageSize?: number; rows?: readonly Person[]; commit?: CommitEdit } = {}): Promise<Mounted> {
    const user = userEvent.setup();
    const server = fakeServer(options.rows ?? people);
    const commit = vi.fn<CommitEdit>(options.commit ?? (() => undefined));
    let captured: GridApi<Person> | undefined;
    const probe: GridAddon<Person> = {
        name: 'test:api',
        setup: () => ({
            toolbar: (context) => {
                captured = context.api;
                return null;
            },
        }),
    };

    render(
        <Gridwright<Person>
            columns={columns}
            dataSource={server.dataSource}
            getRowId={(row) => row.id}
            pageSize={options.pageSize ?? 10}
            selectionMode="multiple"
            aria-label="People"
            addons={[inlineEditing<Person>({ commit }), probe]}
        />,
    );
    await screen.findByText('Ada Lovelace');

    const rowOf = (id: number): HTMLElement | null => document.querySelector<HTMLElement>(`tr[data-row-id="${id}"]`);
    const triggerOf = (id: number, column: 'name' | 'department' = 'name'): HTMLElement => {
        const cell = rowOf(id)?.querySelectorAll('td')[column === 'name' ? 1 : 2];
        const trigger = cell?.querySelector<HTMLElement>('.gw-edit-trigger');
        if (!trigger) throw new Error(`row ${id} has no edit trigger for ${column}`);
        return trigger;
    };

    const mounted: Mounted = {
        user,
        server,
        commit,
        api: () => captured!,
        rowOf,
        triggerOf,
        editor: () => document.querySelector<HTMLInputElement>('input.gw-editor'),
        async open(id, column = 'name') {
            await user.click(triggerOf(id, column));
            return screen.getByRole('textbox', { name: column === 'name' ? 'Name' : 'Department' });
        },
        async type(text) {
            // A change event, not keystrokes: the text arriving is what matters here, and typing a
            // value character by character costs a render per letter across hundreds of cases.
            fireEvent.change(mounted.editor()!, { target: { value: text } });
        },
        async refresh() {
            await act(async () => {
                await captured!.refresh();
            });
        },
        async act(run) {
            await act(async () => {
                await run(captured!);
            });
        },
    };
    return mounted;
}

const settled = (): Promise<void> =>
    waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------------------------

interface ServerChange {
    readonly name: string;
    apply(server: FakeServer): void;
    /** Whether the refresh itself fails, leaving the grid in an error state over the rows it had. */
    readonly fails?: boolean;
    /** The one record the change is about, when it is not a change to the whole set. */
    readonly about?: number;
}

const serverChanges: readonly ServerChange[] = [
    { name: 'the same rows again', apply: () => undefined },
    { name: 'the rows in reverse order', apply: (s) => void (s.rows = [...s.rows].reverse()) },
    { name: 'the rows rotated by two', apply: (s) => void (s.rows = [...s.rows.slice(2), ...s.rows.slice(0, 2)]) },
    {
        name: 'the edited record renamed on the server',
        apply: (s) => void (s.rows = s.rows.map((row) => (row.id === 4 ? { ...row, name: 'Renamed Elsewhere' } : row))),
        about: 4,
    },
    {
        name: 'every other record renamed',
        apply: (s) => void (s.rows = s.rows.map((row) => (row.id === 4 ? row : { ...row, name: `${row.name}!` }))),
    },
    { name: 'a record added at the end', apply: (s) => void (s.rows = [...s.rows, { ...people[0]!, id: 90, name: 'Last One' }]) },
    { name: 'a record added at the top', apply: (s) => void (s.rows = [{ ...people[0]!, id: 91, name: 'First One' }, ...s.rows]) },
    {
        name: 'the edited record changing department',
        apply: (s) => void (s.rows = s.rows.map((row) => (row.id === 4 ? { ...row, department: 'Moved' } : row))),
        about: 4,
    },
    { name: 'a refresh that fails', apply: (s) => s.failNext(), fails: true },
];

const TARGETS = [
    ['the first row', 1],
    ['a middle row', 4],
    ['the last row', 7],
] as const;

/** Every row is worth editing, except that a change about record 4 only means something while editing 4. */
const targetsFor = (change: ServerChange) => TARGETS.filter(([, id]) => change.about === undefined || id === change.about);

describe('an open editor survives the server answering again', () => {
    describe.each(serverChanges)('$name', (change) => {
        describe.each(targetsFor(change))('editing %s', (_label, id) => {
            describe.each([
                ['untouched', undefined],
                ['with text typed', 'Typed Value'],
            ] as const)('%s', (_state, typed) => {
                it('keeps the editor open on the same record, holding the same text, with focus', async () => {
                    const m = await mount();
                    const original = people.find((person) => person.id === id)!.name;
                    const input = await m.open(id);
                    if (typed) await m.type(typed);
                    const expected = typed ?? original;

                    change.apply(m.server);
                    await m.refresh();
                    await settled().catch(() => undefined);

                    expect(m.rowOf(id)).not.toBeNull();
                    expect(within(m.rowOf(id)!).getByRole('textbox', { name: 'Name' })).toHaveValue(expected);
                    expect(screen.getAllByRole('textbox')).toHaveLength(1);
                    expect(m.editor()).toHaveFocus();
                    expect(m.commit).not.toHaveBeenCalled();
                    // The same input element would be best; at the least the reader never sees it flicker shut.
                    expect(input.isConnected || m.editor() !== null).toBe(true);
                });

                it('writes the typed text to the record that was opened, wherever it now stands', async () => {
                    const m = await mount();
                    await m.open(id);
                    await m.type('Final Text');

                    change.apply(m.server);
                    await m.refresh();
                    await m.user.keyboard('{Enter}');

                    expect(m.commit).toHaveBeenCalledTimes(1);
                    expect(m.commit).toHaveBeenCalledWith(id, 'name', 'Final Text');
                    expect(m.editor()).toBeNull();
                });

                it('abandons the text on Escape without writing anything', async () => {
                    const m = await mount();
                    await m.open(id);
                    await m.type('Never Saved');

                    change.apply(m.server);
                    await m.refresh();
                    await m.user.keyboard('{Escape}');

                    expect(m.commit).not.toHaveBeenCalled();
                    expect(m.editor()).toBeNull();
                });
            });
        });
    });
});

describe('typing on while a refresh is in flight', () => {
    describe.each(TARGETS)('editing %s', (_label, id) => {
        describe.each(serverChanges.filter((change) => !change.fails && change.about === undefined))(
            'then the server answers with $name',
            (change) => {
                it('keeps the editor open and the text intact through the wait and the answer', async () => {
                    const m = await mount();
                    await m.open(id);
                    await m.type('Half');

                    m.server.hold();
                    change.apply(m.server);
                    await m.act((api) => void api.refresh());
                    expect(m.api().getState().status).toBe('refreshing');
                    expect(m.editor()).toHaveValue('Half');

                    await m.type('Half and more');
                    expect(m.editor()).toHaveValue('Half and more');

                    await act(async () => m.server.release());
                    await waitFor(() => expect(m.api().getState().status).toBe('ready'));

                    expect(m.editor()).toHaveValue('Half and more');
                    await m.user.keyboard('{Enter}');
                    expect(m.commit).toHaveBeenCalledWith(id, 'name', 'Half and more');
                });
            },
        );
    });
});

// ---------------------------------------------------------------------------------------------

interface Departure {
    readonly name: string;
    leave(m: Mounted): Promise<void>;
    /** Undoes the departure, so the record is on the page again. */
    comeBack(m: Mounted): Promise<void>;
}

const departures: readonly Departure[] = [
    {
        name: 'the server stops returning the record',
        leave: async (m) => {
            m.server.rows = m.server.rows.filter((row) => row.id !== 1);
            await m.refresh();
        },
        comeBack: async (m) => {
            m.server.rows = [...people];
            await m.refresh();
        },
    },
    {
        name: 'a filter excludes the record',
        leave: (m) => m.act((api) => api.setFilter('department', { operator: 'eq', value: 'Research' })),
        comeBack: (m) => m.act((api) => api.setFilter('department', null)),
    },
    {
        name: 'a search excludes the record',
        leave: (m) => m.act((api) => api.setSearch('mary')),
        comeBack: (m) => m.act((api) => api.setSearch('')),
    },
    {
        name: 'the reader pages away',
        leave: (m) => m.act((api) => api.setPage(1)),
        comeBack: (m) => m.act((api) => api.setPage(0)),
    },
    {
        name: 'a sort pushes the record to a later page',
        leave: (m) => m.act((api) => api.setSort([{ columnId: 'name', direction: 'desc' }])),
        comeBack: (m) => m.act((api) => api.setSort([])),
    },
];

describe('an editor whose record leaves the page', () => {
    describe.each(departures)('$name', (departure) => {
        it('closes without writing, without a crash, and leaves the grid usable', async () => {
            const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const m = await mount({ pageSize: 3 });
            await m.open(1);
            await m.type('Half way');

            await departure.leave(m);
            await waitFor(() => expect(m.api().getState().status).toBe('ready'));

            expect(m.rowOf(1)).toBeNull();
            expect(m.editor()).toBeNull();
            expect(m.commit).not.toHaveBeenCalled();
            expect(error).not.toHaveBeenCalled();
            // Another row can be edited straight away.
            const id = m.api().getState().rows[0]!.id as number;
            await m.open(id);
            expect(m.editor()).not.toBeNull();
        });

        it('lets another record be edited and written while the first is gone', async () => {
            const m = await mount({ pageSize: 3 });
            await m.open(1);
            await departure.leave(m);
            await waitFor(() => expect(m.api().getState().status).toBe('ready'));

            const id = m.api().getState().rows[0]!.id as number;
            await m.open(id);
            await m.type('Second Record');
            await m.user.keyboard('{Enter}');

            expect(m.commit).toHaveBeenCalledTimes(1);
            expect(m.commit).toHaveBeenCalledWith(id, 'name', 'Second Record');
        });

        // The editing state used to outlive the cell that rendered it, so the record's return opened an editor
        // by itself, showing the stored value instead of the text typed and taking focus from the reader.
        it('does not reopen the editor by itself when the record comes back', async () => {
            const m = await mount({ pageSize: 3 });
            await m.open(1);
            await m.type('Half way');
            await departure.leave(m);
            await waitFor(() => expect(m.api().getState().status).toBe('ready'));

            await departure.comeBack(m);
            await waitFor(() => expect(m.api().getState().status).toBe('ready'));

            expect(m.rowOf(1)).not.toBeNull();
            expect(m.editor()).toBeNull();
        });
    });
});

// ---------------------------------------------------------------------------------------------

describe('a write in flight while the rows move', () => {
    const stays: ReadonlyArray<{ name: string; apply(m: Mounted): Promise<void> }> = [
        { name: 'a sort', apply: (m) => m.act((api) => api.setSort([{ columnId: 'name', direction: 'desc' }])) },
        { name: 'a sort on another column', apply: (m) => m.act((api) => api.setSort([{ columnId: 'salary', direction: 'asc' }])) },
        { name: 'the server reversing its order', apply: async (m) => { m.server.rows = [...m.server.rows].reverse(); await m.refresh(); } },
        { name: 'a record inserted above it', apply: async (m) => { m.server.rows = [{ ...people[0]!, id: 80, name: 'Zed' }, ...m.server.rows]; await m.refresh(); } },
        { name: 'a search that still matches it', apply: (m) => m.act((api) => api.setSearch('a')) },
        { name: 'a smaller page size that still holds it', apply: (m) => m.act((api) => api.setPageSize(8)) },
    ];

    const pendingRows = (): number[] =>
        [...document.querySelectorAll<HTMLElement>('tr[data-row-id]')]
            .filter((row) => row.querySelector('.gw-edit-trigger--pending'))
            .map((row) => Number(row.getAttribute('data-row-id')));

    describe.each(stays)('$name', (change) => {
        it('marks the record that is being written, and no other row, wherever it moved', async () => {
            const gate = deferred<void>();
            const m = await mount({ commit: () => gate.promise });
            await m.open(2);
            await m.type('Saving');
            await m.user.keyboard('{Enter}');
            expect(pendingRows()).toEqual([2]);

            await change.apply(m);
            await waitFor(() => expect(m.api().getState().status).toBe('ready'));

            expect(pendingRows()).toEqual([2]);
            expect(m.commit).toHaveBeenCalledTimes(1);

            await act(async () => gate.resolve());
            await waitFor(() => expect(pendingRows()).toEqual([]));
        });

        it('shows the failure on the record that failed, wherever it moved', async () => {
            const gate = deferred<void>();
            const m = await mount({ commit: () => gate.promise });
            await m.open(2);
            await m.type('Doomed');
            await m.user.keyboard('{Enter}');

            await change.apply(m);
            await waitFor(() => expect(m.api().getState().status).toBe('ready'));
            await act(async () => gate.reject(new Error('Rejected by the server')));

            const alerts = screen.getAllByRole('alert').filter((node) => node.textContent === 'Rejected by the server');
            expect(alerts).toHaveLength(1);
            expect(alerts[0]!.closest('tr')).toHaveAttribute('data-row-id', '2');
            expect(alerts[0]!.closest('td')).toBe(m.rowOf(2)!.querySelectorAll('td')[1]);
            expect(pendingRows()).toEqual([]);
        });

        it('lets the failed cell be edited again, clearing the old failure', async () => {
            const first = deferred<void>();
            const m = await mount({ commit: vi.fn<CommitEdit>().mockReturnValueOnce(first.promise) });
            await m.open(2);
            await m.type('Doomed');
            await m.user.keyboard('{Enter}');
            await change.apply(m);
            await act(async () => first.reject(new Error('Rejected by the server')));

            await m.open(2);

            expect(screen.queryByText('Rejected by the server')).toBeNull();
        });
    });

    describe.each([
        ['the reader pages away', (m: Mounted) => m.act((api) => api.setPage(1)), (m: Mounted) => m.act((api) => api.setPage(0))],
        ['a filter hides it', (m: Mounted) => m.act((api) => api.setFilter('department', { operator: 'eq', value: 'Research' })), (m: Mounted) => m.act((api) => api.setFilter('department', null))],
    ] as const)('%s while the write is pending', (_name, leave, back) => {
        it('does not mark any other row, and the mark is gone when the write settles', async () => {
            const gate = deferred<void>();
            const m = await mount({ pageSize: 3, commit: () => gate.promise });
            await m.open(1);
            await m.type('Away');
            await m.user.keyboard('{Enter}');

            await leave(m);
            await waitFor(() => expect(m.api().getState().status).toBe('ready'));
            expect(pendingRows()).toEqual([]);

            await act(async () => gate.resolve());
            await back(m);
            await waitFor(() => expect(m.api().getState().status).toBe('ready'));

            expect(pendingRows()).toEqual([]);
        });

        it('shows the failure on the record when it comes back', async () => {
            const gate = deferred<void>();
            const m = await mount({ pageSize: 3, commit: () => gate.promise });
            await m.open(1);
            await m.type('Away');
            await m.user.keyboard('{Enter}');

            await leave(m);
            await waitFor(() => expect(m.api().getState().status).toBe('ready'));
            await act(async () => gate.reject(new Error('Rejected while away')));
            await back(m);
            await waitFor(() => expect(m.api().getState().status).toBe('ready'));

            const alert = screen.getByText('Rejected while away');
            expect(alert.closest('tr')).toHaveAttribute('data-row-id', '1');
        });
    });
});

// ---------------------------------------------------------------------------------------------

describe('several writes at once', () => {
    const pendingRows = (): number[] =>
        [...document.querySelectorAll<HTMLElement>('tr[data-row-id]')]
            .filter((row) => row.querySelector('.gw-edit-trigger--pending'))
            .map((row) => Number(row.getAttribute('data-row-id')));

    const pairs = [
        ['two different rows', [1, 'name'], [2, 'name']],
        ['two columns of one row', [1, 'name'], [1, 'department']],
    ] as const;

    describe.each(pairs)('%s', (_label, first, second) => {
        describe.each([
            ['the first write settles first', 0],
            ['the second write settles first', 1],
        ] as const)('when %s', (_order, settlesFirst) => {
            it('keeps a row marked until the last write on it has settled', async () => {
                const gates = [deferred<void>(), deferred<void>()];
                let call = 0;
                const m = await mount({ commit: () => gates[call++]!.promise });

                await m.open(first[0], first[1]);
                await m.type('One');
                await m.user.keyboard('{Enter}');
                await m.open(second[0], second[1]);
                await m.type('Two');
                await m.user.keyboard('{Enter}');
                expect(m.commit).toHaveBeenCalledTimes(2);

                const rows = [...new Set([first[0], second[0]])].sort();
                expect(pendingRows()).toEqual(rows);

                await act(async () => gates[settlesFirst]!.resolve());
                // One write is still out on its row. Unmarking the row now would tell the reader the
                // row is saved while a second change to it is still on the wire.
                const stillOut = settlesFirst === 0 ? second[0] : first[0];
                expect(pendingRows()).toContain(stillOut);

                await act(async () => gates[1 - settlesFirst]!.resolve());
                await waitFor(() => expect(pendingRows()).toEqual([]));
            });

            it('reports a failure on the cell that failed and on no other', async () => {
                const gates = [deferred<void>(), deferred<void>()];
                let call = 0;
                const m = await mount({ commit: () => gates[call++]!.promise });

                await m.open(first[0], first[1]);
                await m.type('One');
                await m.user.keyboard('{Enter}');
                await m.open(second[0], second[1]);
                await m.type('Two');
                await m.user.keyboard('{Enter}');

                const failing = settlesFirst;
                await act(async () => gates[failing]!.reject(new Error(`write ${failing} failed`)));
                await act(async () => gates[1 - failing]!.resolve());
                await waitFor(() => expect(pendingRows()).toEqual([]));

                const alerts = screen.getAllByRole('alert').map((node) => node.textContent);
                expect(alerts).toEqual([`write ${failing} failed`]);
                const target = failing === 0 ? first : second;
                const cell = screen.getByText(`write ${failing} failed`).closest('td')!;
                expect(cell.closest('tr')).toHaveAttribute('data-row-id', String(target[0]));
                expect(cell.getAttribute('data-column-id') ?? cell.cellIndex.toString()).toBeTruthy();
            });
        });
    });
});

describe('the editor and the selection together', () => {
    const tickOf = (id: number): HTMLInputElement =>
        within(document.querySelector<HTMLElement>(`tr[data-row-id="${id}"]`)!).getByRole('checkbox') as HTMLInputElement;

    it.each([
        ['a sort', (m: Mounted) => m.act((api) => api.setSort([{ columnId: 'name', direction: 'desc' }]))],
        ['a reversed server', async (m: Mounted) => { m.server.rows = [...m.server.rows].reverse(); await m.refresh(); }],
        ['a search', (m: Mounted) => m.act((api) => api.setSearch('a'))],
    ] as const)('keeps the ticked record ticked and the edited record editing through %s', async (_name, change) => {
        const m = await mount();
        await m.user.click(tickOf(2));
        await m.open(5);
        await m.type('Both');

        await change(m);
        await waitFor(() => expect(m.api().getState().status).toBe('ready'));

        expect(tickOf(2)).toBeChecked();
        expect(m.rowOf(2)).toHaveAttribute('aria-selected', 'true');
        expect(within(m.rowOf(5)!).getByRole('textbox', { name: 'Name' })).toHaveValue('Both');
        expect(tickOf(5)).not.toBeChecked();
    });

    it('does not tick the row when the editor is opened or its text committed', async () => {
        const m = await mount();
        await m.open(3);
        await m.type('Edited');
        await m.user.keyboard('{Enter}');

        expect(m.api().getState().selectedIds).toEqual([]);
    });

    it('does not open an editor when a row is ticked', async () => {
        const m = await mount();
        await m.user.click(tickOf(3));

        expect(m.editor()).toBeNull();
        expect(m.api().getState().selectedIds).toEqual([3]);
    });
});

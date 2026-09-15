import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createContext, useContext, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
// Only the public entry points: an add-on of your own has exactly this reach and no more.
import {
    Gridwright,
    STAGE_ORDER,
    coreAddons,
    headerContentOf,
    pagination,
    sorting,
    useAddonMessages,
    type GridAddon,
    type GridPlugin,
} from '../../src/react/index';
import { pl } from '../../src/locales';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

const announcement = (): string => screen.getByRole('status').textContent ?? '';

const HighlightContext = createContext<{ readonly highlighted: string | null; readonly set: (id: string | null) => void } | null>(null);

const heatmapMessages = {
    en: { reset: 'Reset highlight', highlighted: '{name} highlighted', marker: 'Marked' },
    pl: { reset: 'Wyczyść wyróżnienie', highlighted: 'Wyróżniono: {name}', marker: 'Oznaczone' },
};

function ResetButton() {
    const t = useAddonMessages('acme:heatmap', heatmapMessages);
    const highlight = useContext(HighlightContext)!;
    return (
        <button type="button" onClick={() => highlight.set(null)}>
            {t('reset')}
        </button>
    );
}

/** A plugin that keeps only people earning at least a threshold, switched on and off per pass. */
const minimumSalary = (read: () => number | null): GridPlugin<Person> => ({
    name: 'acme:minimum-salary',
    setup: (context) =>
        context.registerStage({
            id: 'acme:minimum-salary',
            order: STAGE_ORDER.FILTER + 5,
            skip: () => read() === null,
            run: (rows) => {
                const kept = rows.filter((row) => row.salary >= read()!);
                return { rows: kept, totalRows: kept.length };
            },
        }),
});

/**
 * An add-on that touches every slot the contract has. If any slot were reachable only from inside
 * the package, this file would not compile or would not pass.
 */
function heatmap(onKey: (key: string) => void): GridAddon<Person> {
    return {
        name: 'acme:heatmap',
        requires: ['gridwright:sorting'],
        setup: function useHeatmap({ options }) {
            const [highlighted, set] = useState<string | null>(null);
            const minimum = useRef<number | null>(null);
            const wrapper = useRef<HTMLDivElement | null>(null);
            const value = { highlighted, set };
            const plugin = useRef(minimumSalary(() => minimum.current)).current;

            return {
                messages: heatmapMessages,
                configure: (current) => ({ ...current, pageSize: current.pageSize ?? options.pageSize ?? 3 }),
                plugins: [plugin],
                columnSignature: (column) => (column.id === 'salary' ? 'heat' : ''),
                provide: (children) => <HighlightContext.Provider value={value}>{children}</HighlightContext.Provider>,

                toolbar: () => <ResetButton />,
                toolbarStatus: () => <span data-testid="status-item">status</span>,
                aboveTable: () => <p data-testid="above">above</p>,
                belowTable: () => <p data-testid="below">below</p>,
                overlay: () => (highlighted ? <div role="note">{highlighted}</div> : null),

                tableAttributes: () => ({ 'data-heatmap': 'on', 'aria-describedby': 'heat-legend' }),
                tableWrapper: () => ({ ref: wrapper, className: 'acme-heat-wrapper', style: { outline: '1px solid' } }),
                tableKeyDown: (event) => {
                    onKey(event.key);
                    if (event.key !== 'h') return false;
                    set('keyboard');
                    return true;
                },
                tableFooter: (grid) => (
                    <tfoot>
                        <tr>
                            <td data-testid="total">{grid.state.totalRows}</td>
                        </tr>
                    </tfoot>
                ),

                headerBefore: (column) => (column.id === 'salary' ? <span data-testid="before">€</span> : null),
                headerAfter: (column, grid) =>
                    column.id === 'salary' ? (
                        <button
                            type="button"
                            onClick={() => {
                                minimum.current = minimum.current === null ? 120_000 : null;
                                grid.api.invalidatePipeline();
                            }}
                        >
                            only high earners
                        </button>
                    ) : null,
                headerAttributes: (column) => (column.id === 'salary' ? { 'data-heat': 'column' } : {}),

                columns: [
                    {
                        id: 'acme:mark',
                        placement: 'end',
                        header: () => 'Mark',
                        cell: (row) => (
                            <button type="button" onClick={(event) => (event.stopPropagation(), set(row.data.name))}>
                                mark {row.data.name}
                            </button>
                        ),
                    },
                ],
                rowAttributes: (row) => ({
                    className: row.data.name === highlighted ? 'is-hot' : undefined,
                    'data-department': row.data.department,
                }),
                renderRow: (row) =>
                    row.data.name === 'Mary Jackson' ? (
                        <tr data-testid="custom-row">
                            <td colSpan={5}>custom {row.data.name}</td>
                        </tr>
                    ) : undefined,
                extraCellAttributes: (_row, columnId) => (columnId === 'gridwright:selection' ? { 'data-pinned': 'start' } : {}),
                extraHeaderAttributes: (columnId) => (columnId === 'gridwright:selection' ? { 'data-pinned': 'start' } : {}),
                cellAttributes: (row, column) =>
                    column.id === 'salary' ? { style: { background: row.data.salary > 110_000 ? 'red' : 'blue' } } : {},
                status: { empty: () => <em data-testid="empty">nothing hot</em> },

                announce: [
                    {
                        priority: 30,
                        key: () => highlighted ?? '',
                        describe: ({ previous, t }) => (previous && highlighted ? t('highlighted', { name: highlighted }) : null),
                    },
                ],
            };
        },
    };
}

describe('an add-on built from the public exports', () => {
    it('reaches every slot a built-in add-on reaches', async () => {
        const user = userEvent.setup();
        const keys = vi.fn();
        render(<Gridwright<Person> columns={personColumns} data={people} selectionMode="multiple" aria-label="People" addons={[heatmap(keys)]} />);

        // configure: the page size the add-on chose. Header, three rows, and the footer's row.
        expect(screen.getAllByRole('row')).toHaveLength(1 + 3 + 1);

        // around the table
        expect(screen.getByRole('button', { name: 'Reset highlight' }).closest('.gw-toolbar')).not.toBeNull();
        expect(screen.getByTestId('status-item')).toBeInTheDocument();
        expect(screen.getByTestId('above')).toBeInTheDocument();
        expect(screen.getByTestId('below')).toBeInTheDocument();

        // the table and its wrapper
        const table = screen.getByRole('grid');
        expect(table).toHaveAttribute('data-heatmap', 'on');
        expect(table.closest('.gw-table-wrapper')).toHaveClass('acme-heat-wrapper');
        expect(within(table).getByTestId('total')).toHaveTextContent('7');

        // header
        const salary = screen.getByRole('columnheader', { name: /Salary/ });
        expect(salary).toHaveAttribute('data-heat', 'column');
        expect(within(salary).getByTestId('before')).toBeInTheDocument();
        expect(within(salary).getByRole('button', { name: 'Salary' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Mark' })).toBeInTheDocument();

        // another add-on's extra column: the selection checkboxes, pinned by this one
        expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('data-pinned', 'start');
        expect(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!.closest('td')).toHaveAttribute('data-pinned', 'start');

        // body
        const firstRow = screen.getAllByRole('row')[1]!;
        expect(firstRow).toHaveAttribute('data-department', 'Engineering');
        expect(within(firstRow).getAllByRole('cell')[3]).toHaveStyle({ background: 'red' });

        // plugins, through a control in the header
        await user.click(screen.getByRole('button', { name: 'only high earners' }));
        await waitFor(() => expect(within(table).getByTestId('total')).toHaveTextContent('3'));
        await user.click(screen.getByRole('button', { name: 'only high earners' }));
        await waitFor(() => expect(within(table).getByTestId('total')).toHaveTextContent('7'));

        // provide, overlay, row attributes and an announcement that outranks the sort
        await user.click(screen.getAllByRole('button', { name: /^mark / })[0]!);
        expect(screen.getByRole('note')).toHaveTextContent('Ada Lovelace');
        expect(screen.getAllByRole('row')[1]).toHaveClass('is-hot');
        await waitFor(() => expect(announcement()).toBe('Ada Lovelace highlighted'));

        // keyboard
        table.focus();
        await user.keyboard('h');
        expect(keys).toHaveBeenCalledWith('h');
        expect(screen.getByRole('note')).toHaveTextContent('keyboard');
    });

    it('renders a row of its own kind', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} addons={[heatmap(() => undefined)]} />);

        await user.click(screen.getByRole('button', { name: 'Next page' }));
        expect(screen.getByTestId('custom-row')).toHaveTextContent('custom Mary Jackson');
    });

    it('replaces a status row', () => {
        render(<Gridwright<Person> columns={personColumns} data={[]} addons={[heatmap(() => undefined)]} />);
        expect(screen.getByTestId('empty')).toHaveTextContent('nothing hot');
    });

    it('is translated by a locale pack, a catalog of its own, or the grid messages', () => {
        const { unmount } = render(
            <Gridwright<Person> columns={personColumns} data={people} locale={pl} addons={[heatmap(() => undefined)]} />,
        );
        expect(screen.getByRole('button', { name: 'Wyczyść wyróżnienie' })).toBeInTheDocument();
        unmount();

        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                messages={{ 'acme:heatmap.reset': 'Clear' }}
                addons={[heatmap(() => undefined)]}
            />,
        );
        expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });

    it('says which add-on it needs when that one is missing', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(() =>
            render(<Gridwright<Person> columns={personColumns} data={people} coreAddons={false} addons={[heatmap(() => undefined)]} />),
        ).toThrow(/"acme:heatmap" requires "gridwright:sorting"/);
        spy.mockRestore();
    });

    it('replaces a built-in add-on by suppressing it', async () => {
        const user = userEvent.setup();
        const arrows: GridAddon<Person> = {
            name: 'acme:arrows',
            setup: () => ({
                suppresses: ['gridwright:sorting'],
                headerLabel: (column, grid) => (
                    <button type="button" onClick={() => grid.api.toggleSort(column.id)}>
                        {headerContentOf(column, grid)} ↕
                    </button>
                ),
            }),
        };

        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[arrows]} />);

        await user.click(screen.getByRole('button', { name: 'Salary ↕' }));
        // The built-in button and its aria-sort are gone; the engine's sort still applies.
        expect(screen.queryByRole('button', { name: 'Salary' })).not.toBeInTheDocument();
        expect(screen.getAllByRole('row')[1]).toHaveTextContent('Mary Jackson');
    });

    it('keeps the grid alive when a slot throws', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const broken: GridAddon<Person> = {
            name: 'acme:broken',
            setup: () => ({
                aboveTable: () => {
                    throw new Error('slot exploded');
                },
                rowAttributes: () => {
                    throw new Error('attributes exploded');
                },
            }),
        };

        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[broken]} />);

        expect(screen.getAllByRole('row')).toHaveLength(4);
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('"acme:broken"'), expect.any(Error));
        spy.mockRestore();
    });

    it('changes the core set without losing the rest of it', () => {
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={5}
                coreAddons={[
                    ...coreAddons<Person>().filter((addon) => addon.name !== 'gridwright:pagination'),
                    pagination<Person>({ pageSizeOptions: [5, 50] }),
                ]}
            />,
        );

        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['5', '50']);
        expect(screen.getByRole('button', { name: 'Salary' })).toBeInTheDocument();
    });

    it('renders a bare table with no core add-ons at all', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} coreAddons={false} />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByText('Rows per page')).not.toBeInTheDocument();
        // The engine still pages, because pagination the plugin is core; only its controls are gone.
        expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
        expect(sorting).toBeTypeOf('function');
    });
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { GridwrightProvider } from '../../src/react/context';
import { ColumnFilterProvider } from '../../src/react/filters/ColumnFilterProvider';
import { ColumnFilterTrigger } from '../../src/react/filters/ColumnFilterTrigger';
import { GridFilterClear } from '../../src/react/filters/GridFilterClear';
import { GridBody } from '../../src/react/parts/GridBody';
import { GridHeader } from '../../src/react/parts/GridHeader';
import { GridTable } from '../../src/react/parts/GridTable';
import { useGridwright } from '../../src/react/useGridwright';
import { pl } from '../../src/locales/pl';
import type { DataSource, DataSourceRequest } from '../../src/core/types';
import type { GridwrightColumn } from '../../src/react/types';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

const columns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    {
        id: 'department',
        header: 'Department',
        filter: {
            type: 'select',
            choices: ['Engineering', 'Research', 'Operations'].map((value) => ({ value, label: value })),
        },
    },
    { id: 'salary', header: 'Salary', filter: { type: 'number' } },
    { id: 'startedOn', header: 'Started', filter: { type: 'date' } },
    { id: 'active', header: 'Status', filterable: false },
];

const names = (): string[] =>
    screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');

const announcement = (): string =>
    screen.getAllByRole('status').find((node) => node.closest('.gw-export') === null)?.textContent ?? '';

const renderGrid = (props: Partial<Parameters<typeof Gridwright<Person>>[0]> = {}) =>
    render(<Gridwright<Person> columns={columns} data={people} pageSize={10} columnFilters {...props} />);

const openFilter = async (user: ReturnType<typeof userEvent.setup>, column: string) => {
    await user.click(screen.getByRole('button', { name: new RegExp(`^Filter ${column}`) }));
    return screen.getByRole('dialog', { name: `Filter ${column}` });
};

describe('<Gridwright columnFilters />', () => {
    it('puts a named filter button in every filterable header, separate from the sort button', () => {
        renderGrid();

        const header = screen.getByRole('columnheader', { name: /Salary/ });
        const trigger = within(header).getByRole('button', { name: 'Filter Salary' });

        expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        // Not nested: a button inside a button is neither valid nor reachable.
        expect(trigger.closest('.gw-sort-button')).toBeNull();
        expect(within(header).getByRole('button', { name: 'Salary' })).toBeInTheDocument();
        expect(header).toHaveAttribute('aria-sort', 'none');

        expect(screen.queryByRole('button', { name: /Filter Status/ })).not.toBeInTheDocument();
    });

    it('draws nothing new without the prop', () => {
        render(<Gridwright<Person> columns={columns} data={people} />);

        expect(screen.queryByRole('button', { name: /^Filter/ })).not.toBeInTheDocument();
        expect(document.querySelector('.gw-header-content')).toBeNull();
    });

    it('opens a dialog outside the table, with focus on the condition', async () => {
        const user = userEvent.setup();
        renderGrid();

        const dialog = await openFilter(user, 'Name');

        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(screen.getByRole('button', { name: 'Filter Name' })).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('button', { name: 'Filter Name' })).toHaveAttribute('aria-controls', dialog.id);
        // Outside the table, so it is never part of a column header's accessible name.
        expect(dialog.closest('table')).toBeNull();
        expect(screen.getByRole('columnheader', { name: /Name/ })).not.toHaveTextContent('Condition');
        expect(within(dialog).getByRole('combobox', { name: 'Condition' })).toHaveFocus();
    });

    it('applies a text filter with Enter, returns to the first page, and returns focus to the button', async () => {
        const user = userEvent.setup();
        renderGrid({ pageSize: 2 });

        await user.click(screen.getByRole('button', { name: 'Next page' }));
        const dialog = await openFilter(user, 'Name');

        await user.type(within(dialog).getByRole('textbox', { name: 'Value' }), 'son{Enter}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filter Name, filtered' })).toHaveFocus();
        await waitFor(() => expect(names()).toEqual(['Katherine Johnson', 'Mary Jackson']));
        expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('data-filtered', 'true');
        expect(screen.getByText('1-2 of 2')).toBeInTheDocument();
    });

    it('keeps Apply off until the condition is complete', async () => {
        const user = userEvent.setup();
        renderGrid();

        const dialog = await openFilter(user, 'Salary');
        const apply = within(dialog).getByRole('button', { name: 'Apply' });
        expect(apply).toBeDisabled();

        await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Condition' }), 'Between');
        await user.type(within(dialog).getByRole('spinbutton', { name: 'From' }), '100000');
        expect(apply).toBeDisabled();

        await user.type(within(dialog).getByRole('spinbutton', { name: 'To' }), '125000');
        expect(apply).toBeEnabled();
        await user.click(apply);

        await waitFor(() => expect(names()).toEqual(['Ada Lovelace', 'Katherine Johnson', 'Dorothy Vaughan']));
    });

    it('names date conditions as dates', async () => {
        const user = userEvent.setup();
        renderGrid();

        const dialog = await openFilter(user, 'Started');
        const condition = within(dialog).getByRole('combobox', { name: 'Condition' });

        expect(within(condition).getAllByRole('option').map((option) => option.textContent)).toEqual([
            'On',
            'After',
            'Before',
            'Between',
            'Is empty',
            'Is not empty',
        ]);

        await user.selectOptions(condition, 'Before');
        fireEvent.change(dialog.querySelector('input[type="date"]')!, { target: { value: '2018-01-01' } });
        await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(names()).toEqual(['Grace Hopper', 'Evelyn Boyd']));
    });

    it('filters a select column on the values ticked', async () => {
        const user = userEvent.setup();
        renderGrid();

        const dialog = await openFilter(user, 'Department');
        const values = within(dialog).getByRole('group', { name: 'Values' });

        await user.click(within(values).getByRole('checkbox', { name: 'Operations' }));
        await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(names()).toEqual(['Dorothy Vaughan', 'Annie Easley']));
    });

    it('reopens on the filter already applied, and clears just that column', async () => {
        const user = userEvent.setup();
        renderGrid();

        let dialog = await openFilter(user, 'Salary');
        await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Condition' }), 'Greater than');
        await user.type(within(dialog).getByRole('spinbutton', { name: 'Value' }), '120000{Enter}');
        await waitFor(() => expect(names()).toEqual(['Grace Hopper', 'Evelyn Boyd']));

        dialog = await openFilter(user, 'Salary');
        expect(within(dialog).getByRole('combobox', { name: 'Condition' })).toHaveDisplayValue('Greater than');
        expect(within(dialog).getByRole('spinbutton', { name: 'Value' })).toHaveValue(120000);

        await user.click(within(dialog).getByRole('button', { name: 'Clear filter' }));

        expect(screen.getByRole('button', { name: 'Filter Salary' })).toHaveFocus();
        await waitFor(() => expect(names()).toHaveLength(people.length));
    });

    it('discards the draft on Escape and on a click outside', async () => {
        const user = userEvent.setup();
        const onQueryChange = vi.fn();
        renderGrid({ onQueryChange });

        let dialog = await openFilter(user, 'Name');
        await user.type(within(dialog).getByRole('textbox', { name: 'Value' }), 'Ada');
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filter Name' })).toHaveFocus();

        dialog = await openFilter(user, 'Name');
        // A fresh draft, not the one Escape threw away.
        expect(within(dialog).getByRole('textbox', { name: 'Value' })).toHaveValue('');
        await user.type(within(dialog).getByRole('textbox', { name: 'Value' }), 'Ada');
        await user.click(screen.getAllByRole('row')[2]!);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(onQueryChange).not.toHaveBeenCalled();
        expect(names()).toHaveLength(people.length);
    });

    it('keeps Tab inside the dialog while it is open', async () => {
        const user = userEvent.setup();
        renderGrid();

        const dialog = await openFilter(user, 'Name');
        const condition = within(dialog).getByRole('combobox', { name: 'Condition' });
        await user.type(within(dialog).getByRole('textbox', { name: 'Value' }), 'a');
        const apply = within(dialog).getByRole('button', { name: 'Apply' });

        apply.focus();
        await user.tab();
        expect(condition).toHaveFocus();

        await user.tab({ shift: true });
        expect(apply).toHaveFocus();
    });

    it('clears every filter from the toolbar, and puts focus on a header rather than the page', async () => {
        const user = userEvent.setup();
        renderGrid();

        expect(screen.queryByRole('button', { name: /^Clear \d+ filter/ })).not.toBeInTheDocument();

        let dialog = await openFilter(user, 'Name');
        await user.type(within(dialog).getByRole('textbox', { name: 'Value' }), 'a{Enter}');
        dialog = await openFilter(user, 'Salary');
        await user.type(within(dialog).getByRole('spinbutton', { name: 'Value' }), '95000{Enter}');

        await waitFor(() => expect(names()).toEqual(['Mary Jackson']));
        const clear = screen.getByRole('button', { name: 'Clear 2 filters' });
        // The toolbar was drawn for this, with no search box and no export asked for.
        expect(clear.closest('.gw-toolbar')).not.toBeNull();

        await user.click(clear);

        await waitFor(() => expect(names()).toHaveLength(people.length));
        expect(screen.queryByRole('button', { name: /^Clear \d+ filter/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filter Name' })).toHaveFocus();
    });

    it('announces the column that was filtered, then the rows', async () => {
        const user = userEvent.setup();
        renderGrid();
        await waitFor(() => expect(announcement()).toBe('Showing 1 to 7 of 7'));

        const dialog = await openFilter(user, 'Department');
        await user.click(within(dialog).getByRole('checkbox', { name: 'Research' }));
        await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

        await waitFor(() => expect(announcement()).toBe('Department, filtered'));

        await user.click(screen.getByRole('button', { name: 'Filter Department, filtered' }));
        await user.click(screen.getByRole('button', { name: 'Clear filter' }));
        await waitFor(() => expect(announcement()).toBe('Department, filter removed'));
    });

    it('sends the filter to a source that filters for itself, and leaves the rows it returns alone', async () => {
        const user = userEvent.setup();
        const requests: DataSourceRequest<Person>[] = [];
        const source: DataSource<Person> = {
            kind: 'test:server',
            capabilities: { sort: true, filter: true, search: true, paginate: true },
            fetch: (request) => {
                requests.push(request);
                // Deliberately ignores the filter, so a client-side filter would show.
                return { rows: people.slice(0, 3), totalRows: 3 };
            },
        };

        render(<Gridwright<Person> columns={columns} dataSource={source} columnFilters />);

        const dialog = await openFilter(user, 'Salary');
        await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Condition' }), 'Less than');
        await user.type(within(dialog).getByRole('spinbutton', { name: 'Value' }), '100000{Enter}');

        await waitFor(() =>
            expect(requests.at(-1)?.query.filters).toEqual([{ columnId: 'salary', operator: 'lt', value: 100000 }]),
        );
        expect(requests.at(-1)?.query.pagination.pageIndex).toBe(0);
        // The server said these three match. The pipeline did not second-guess it.
        await waitFor(() => expect(names()).toEqual(['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson']));
    });

    it('filters a tree and keeps the folders above a match', async () => {
        const user = userEvent.setup();
        interface Node {
            id: string;
            name: string;
            children?: Node[];
        }
        const tree: Node[] = [
            { id: 'a', name: 'Docs', children: [{ id: 'a1', name: 'Report.pdf' }, { id: 'a2', name: 'Notes.txt' }] },
            { id: 'b', name: 'Music', children: [{ id: 'b1', name: 'Song.mp3' }] },
        ];

        render(
            <Gridwright<Node>
                columns={[{ id: 'name', header: 'Name' }]}
                data={tree}
                columnFilters
                tree={{ getRowId: (row) => row.id, getChildren: (row) => row.children, defaultExpandedDepth: 1 }}
            />,
        );

        const dialog = await openFilter(user, 'Name');
        await user.type(within(dialog).getByRole('textbox', { name: 'Value' }), 'report{Enter}');

        // The folder's cell also carries its visually hidden child count, so match on the name.
        await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3));
        expect(names()[0]).toMatch(/^Docs/);
        expect(names()[1]).toBe('Report.pdf');
    });

    it('translates the controls and the announcement', async () => {
        const user = userEvent.setup();
        renderGrid({ locale: pl });

        await user.click(screen.getByRole('button', { name: 'Filtruj: Salary' }));
        const dialog = screen.getByRole('dialog', { name: 'Filtruj: Salary' });
        const condition = within(dialog).getByRole('combobox', { name: 'Warunek' });

        expect(within(condition).getAllByRole('option')[0]).toHaveTextContent('Równa się');
        await user.type(within(dialog).getByRole('spinbutton', { name: 'Wartość' }), '95000');
        await user.click(within(dialog).getByRole('button', { name: 'Zastosuj' }));

        await waitFor(() => expect(announcement()).toBe('Salary, filtr zastosowany'));
        expect(screen.getByRole('button', { name: 'Wyczyść 1 filtr' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Filtruj: Salary, filtr aktywny' })).toBeInTheDocument();
    });

    it('closes the dialog when its column goes away', async () => {
        const user = userEvent.setup();
        const { rerender } = renderGrid();

        await openFilter(user, 'Salary');
        rerender(
            <Gridwright<Person>
                columns={columns.map((column) => (column.id === 'salary' ? { ...column, hidden: true } : column))}
                data={people}
                pageSize={10}
                columnFilters
            />,
        );

        await waitFor(() => expect(screen.queryByRole('columnheader', { name: /Salary/ })).not.toBeInTheDocument());
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
});

describe('the parts, composed by hand', () => {
    function Composed() {
        const instance = useGridwright<Person>({ columns, data: people, pageSize: 10 });
        return (
            <GridwrightProvider instance={instance}>
                <ColumnFilterProvider>
                    <div>
                        <GridFilterClear />
                        <ColumnFilterTrigger columnId="active" />
                    </div>
                    <GridTable aria-label="People">
                        <GridHeader />
                        <GridBody />
                    </GridTable>
                </ColumnFilterProvider>
            </GridwrightProvider>
        );
    }

    it('works under a provider with no component around it', async () => {
        const user = userEvent.setup();
        render(<Composed />);

        // A trigger for a column that is not filterable draws nothing, so it can be placed blindly.
        expect(screen.getAllByRole('button', { name: /^Filter/ })).toHaveLength(4);

        const dialog = await openFilter(user, 'Name');
        await user.type(within(dialog).getByRole('textbox', { name: 'Value' }), 'Grace{Enter}');

        await waitFor(() => expect(names()).toEqual(['Grace Hopper']));
        await user.click(screen.getByRole('button', { name: 'Clear 1 filter' }));
        await waitFor(() => expect(names()).toHaveLength(people.length));
    });

    it('says what is missing when a trigger is rendered without a provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        function Bare() {
            const instance = useGridwright<Person>({ columns, data: people });
            return (
                <GridwrightProvider instance={instance}>
                    <ColumnFilterTrigger columnId="name" />
                </GridwrightProvider>
            );
        }

        expect(() => render(<Bare />)).toThrow(/ColumnFilterProvider/);
        spy.mockRestore();
    });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { coreAddons, search } from '../../src/react/core-addons';
import { inlineEditing } from '../../src/react/plugins/addons';
import { GridwrightProvider } from '../../src/react/context';
import { GridBody } from '../../src/react/parts/GridBody';
import { GridHeader } from '../../src/react/parts/GridHeader';
import { GridPagination } from '../../src/react/parts/GridPagination';
import { GridTable } from '../../src/react/parts/GridTable';
import { useGridwright } from '../../src/react/useGridwright';
import { createRemoteDataSource } from '../../src/data/remote';
import type { Person } from '../fixtures';
import { deferred, people, personColumns } from '../fixtures';

const rowNames = (): string[] =>
    screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0]!.textContent ?? '');

describe('<Gridwright /> with local data', () => {
    it('renders the header and the first page', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />);

        expect(screen.getByRole('grid', { name: 'People' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
        expect(rowNames()).toEqual(['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson']);
    });

    it('reads a value through the column id when no accessor is given', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={1} />);
        const cells = within(screen.getAllByRole('row')[1]!).getAllByRole('cell');
        expect(cells.map((cell) => cell.textContent)).toEqual([
            'Ada Lovelace',
            'Engineering',
            '120000',
            '2019-03-01',
        ]);
    });

    it('sorts when a header is activated, and announces the direction', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} />);

        await user.click(screen.getByRole('button', { name: /Salary/ }));

        expect(rowNames()[0]).toBe('Mary Jackson');
        expect(screen.getByRole('columnheader', { name: /Salary/ })).toHaveAttribute('aria-sort', 'ascending');

        await user.click(screen.getByRole('button', { name: /Salary/ }));
        expect(screen.getByRole('columnheader', { name: /Salary/ })).toHaveAttribute('aria-sort', 'descending');
        expect(rowNames()[0]).toBe('Grace Hopper');
    });

    it('reaches the sort control by keyboard', async () => {
        // A clickable <th> that is not a button is unreachable without a mouse.
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} />);

        await user.tab();
        expect(screen.getByRole('button', { name: /Name/ })).toHaveFocus();

        await user.keyboard('{Enter}');
        expect(rowNames()[0]).toBe('Ada Lovelace');
        expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
    });

    it('filters through the search box and returns to the first page', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[search()]} />);

        await user.click(screen.getByRole('button', { name: 'Next page' }));
        expect(rowNames()[0]).toBe('Mary Jackson');

        await user.type(screen.getByRole('searchbox'), 'research');

        expect(rowNames()).toEqual(['Katherine Johnson', 'Mary Jackson', 'Evelyn Boyd']);
        expect(screen.getByText('1-3 of 3')).toBeInTheDocument();
    });

    it('pages forward and disables the control at the end', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} />);

        expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
        expect(screen.getByText('1-3 of 7')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Next page' }));
        await user.click(screen.getByRole('button', { name: 'Next page' }));

        expect(screen.getByText('7-7 of 7')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    });

    it('changes the page size', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={10} />);

        await user.selectOptions(screen.getByRole('combobox'), '10');
        expect(rowNames()).toHaveLength(7);
    });

    it('selects rows and reports the selection', async () => {
        const user = userEvent.setup();
        const onSelectionChange = vi.fn();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                selectionMode="multiple"
                addons={[search()]}
                onSelectionChange={onSelectionChange}
            />,
        );

        await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[1]!);

        expect(onSelectionChange).toHaveBeenCalledWith([2], [expect.objectContaining({ name: 'Grace Hopper' })]);
        expect(screen.getByText('1 selected')).toBeInTheDocument();
        expect(screen.getAllByRole('row')[2]).toHaveAttribute('aria-selected', 'true');
    });

    it('selects and clears the whole page from the header checkbox', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} selectionMode="multiple" addons={[search()]} />);

        const selectAll = screen.getByRole('checkbox', { name: 'Select all rows on this page' });
        await user.click(selectAll);
        expect(screen.getByText('3 selected')).toBeInTheDocument();

        await user.click(selectAll);
        expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });

    it('does not fire the row handler when a selection checkbox is clicked', async () => {
        // Otherwise selecting a row navigates away from the grid being selected in.
        const user = userEvent.setup();
        const onRowClick = vi.fn();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                selectionMode="multiple"
                onRowClick={onRowClick}
            />,
        );

        await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!);
        expect(onRowClick).not.toHaveBeenCalled();

        await user.click(screen.getAllByRole('row')[1]!);
        expect(onRowClick).toHaveBeenCalledOnce();
    });

    it('renders a custom cell', () => {
        render(
            <Gridwright<Person>
                columns={[
                    { id: 'name' },
                    {
                        id: 'salary',
                        cell: ({ value }) => <strong data-testid="money">{`$${Number(value) / 1000}k`}</strong>,
                    },
                ]}
                data={people}
                pageSize={1}
            />,
        );

        expect(screen.getByTestId('money')).toHaveTextContent('$120k');
    });

    it('renders a custom header cell', () => {
        render(
            <Gridwright<Person>
                columns={[{ id: 'name', headerCell: ({ sortDirection }) => <em>{sortDirection ?? 'unsorted'}</em> }]}
                data={people}
                pageSize={1}
            />,
        );

        expect(screen.getByText('unsorted')).toBeInTheDocument();
    });

    it('shows the empty state without collapsing the header', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} addons={[search()]} />);

        await user.type(screen.getByRole('searchbox'), 'nobody named this');

        // Twice over: once in the body, and once in the live region, which is the only one of the
        // two a screen reader is told about when the rows are replaced under it.
        expect(screen.getAllByText('No rows to show')).toHaveLength(2);
        expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
    });

    it('accepts a translated string for the shell and for an add-on', () => {
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={[]}
                labels={{ empty: 'Brak wierszy' }}
                messages={{ 'gridwright:pagination.rowsPerPage': 'Wierszy na stronie' }}
            />,
        );

        expect(screen.getAllByText('Brak wierszy').length).toBeGreaterThan(0);
        expect(screen.getByText('Wierszy na stronie')).toBeInTheDocument();
    });

    it('follows a changed data prop', async () => {
        function Host() {
            const [rows, setRows] = useState<readonly Person[]>(people.slice(0, 2));
            return (
                <>
                    <button type="button" onClick={() => setRows(people)}>
                        load all
                    </button>
                    <Gridwright<Person> columns={personColumns} data={rows} pageSize={10} />
                </>
            );
        }

        const user = userEvent.setup();
        render(<Host />);
        expect(rowNames()).toHaveLength(2);

        await user.click(screen.getByRole('button', { name: 'load all' }));
        await waitFor(() => expect(rowNames()).toHaveLength(7));
    });

    it('survives Strict Mode double mounting', () => {
        // Strict Mode destroys the engine once on purpose. A grid that does not rebuild there
        // renders empty in development and correctly in production, which is the worst pairing.
        render(
            <StrictMode>
                <Gridwright<Person> columns={personColumns} data={people} pageSize={3} />
            </StrictMode>,
        );

        expect(rowNames()).toEqual(['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson']);
    });

    it.each([
        ['without editing', undefined],
        ['with editing', [inlineEditing<Person>({ commit: () => undefined })]],
    ])('follows a column hidden or renamed after the first render, %s', async (_, addons) => {
        const headers = () => screen.getAllByRole('columnheader').map((header) => header.textContent);
        const { rerender } = render(
            <Gridwright<Person> columns={personColumns} data={people} {...(addons ? { addons } : {})} />,
        );
        expect(headers()).toEqual(['Name', 'Department', 'Salary', 'Started']);

        // A regression: the component memoised its columns on id, `edit` and `icon`, so any other
        // change after the first render never reached the engine.
        rerender(
            <Gridwright<Person>
                columns={personColumns.map((column) =>
                    column.id === 'salary'
                        ? { ...column, hidden: true }
                        : column.id === 'name'
                          ? { ...column, header: 'Full name' }
                          : column,
                )}
                data={people}
                {...(addons ? { addons } : {})}
            />,
        );

        await waitFor(() => expect(headers()).toEqual(['Full name', 'Department', 'Started']));
    });
});

describe('<Gridwright /> with a remote source', () => {
    it('shows a loading state, then the rows', async () => {
        const gate = deferred<{ rows: readonly Person[]; totalRows: number }>();
        const dataSource = createRemoteDataSource<Person>({
            fetcher: () => gate.promise,
            retry: { attempts: 0 },
        });

        render(<Gridwright<Person> columns={personColumns} dataSource={dataSource} pageSize={3} />);

        // Inside the table, so the header and the column widths stay put while it loads. The
        // second copy of this text is the visually hidden live region, which is what announces it.
        expect(within(screen.getByRole('grid')).getByText('Loading rows')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Loading rows');

        gate.resolve({ rows: people.slice(0, 3), totalRows: 7 });
        await waitFor(() => expect(rowNames()).toHaveLength(3));
        expect(screen.getByText('1-3 of 7')).toBeInTheDocument();
    });

    it('offers a retry on a retryable failure and recovers', async () => {
        const user = userEvent.setup();
        let failing = true;
        const dataSource = createRemoteDataSource<Person>({
            retry: { attempts: 0 },
            fetcher: async () => {
                if (failing) throw new Error('The reporting service is down.');
                return { rows: people.slice(0, 2), totalRows: 2 };
            },
        });

        render(<Gridwright<Person> columns={personColumns} dataSource={dataSource} pageSize={3} />);

        await screen.findByRole('alert');
        expect(screen.getByText('The reporting service is down.')).toBeInTheDocument();

        failing = false;
        await user.click(screen.getByRole('button', { name: 'Try again' }));
        await waitFor(() => expect(rowNames()).toHaveLength(2));
    });

    it('follows a changed dataSource prop', async () => {
        // The guard used to compare the new prop against a helper that read the current props, so
        // it compared the prop against itself and the swap never happened.
        const first = createRemoteDataSource<Person>({
            fetcher: async () => ({ rows: people.slice(0, 2), totalRows: 2 }),
            retry: { attempts: 0 },
        });
        const second = createRemoteDataSource<Person>({
            fetcher: async () => ({ rows: people.slice(0, 5), totalRows: 5 }),
            retry: { attempts: 0 },
        });

        function Host() {
            const [source, setSource] = useState(first);
            return (
                <>
                    <button type="button" onClick={() => setSource(second)}>
                        swap
                    </button>
                    <Gridwright<Person> columns={personColumns} dataSource={source} pageSize={10} />
                </>
            );
        }

        const user = userEvent.setup();
        render(<Host />);
        await waitFor(() => expect(rowNames()).toHaveLength(2));

        await user.click(screen.getByRole('button', { name: 'swap' }));
        await waitFor(() => expect(rowNames()).toHaveLength(5));
    });

    it('says the total is unknown rather than inventing one', async () => {
        const dataSource = createRemoteDataSource<Person>({
            fetcher: async () => ({ rows: people.slice(0, 3) }),
            retry: { attempts: 0 },
        });

        render(<Gridwright<Person> columns={personColumns} dataSource={dataSource} pageSize={3} />);

        await waitFor(() => expect(rowNames()).toHaveLength(3));
        expect(screen.getByText('1-3 of many')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
    });
});

describe('composition', () => {
    it('renders the parts in a layout the consumer chooses', async () => {
        function CustomLayout() {
            const instance = useGridwright<Person>({ columns: personColumns, data: people, pageSize: 3 });
            return (
                <GridwrightProvider instance={instance}>
                    <div data-testid="above">
                        <GridPagination pageSizeOptions={[3, 6]} />
                    </div>
                    <GridTable aria-label="Composed">
                        <GridHeader />
                        <GridBody />
                    </GridTable>
                </GridwrightProvider>
            );
        }

        const user = userEvent.setup();
        render(<CustomLayout />);

        // Pagination above the table, which the assembled component never renders.
        expect(within(screen.getByTestId('above')).getByText('1-3 of 7')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Next page' }));
        expect(rowNames()[0]).toBe('Mary Jackson');
    });

    it('tells a developer when a part is used outside a provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(() => render(<GridPagination />)).toThrow(/inside <GridwrightProvider>/);
        spy.mockRestore();
    });
});

describe('configuring a core add-on', () => {
    it('drops the checkbox column while multi-row selection keeps working', async () => {
        const user = userEvent.setup();

        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                selectionMode="multiple"
                aria-label="People"
                coreAddons={coreAddons<Person>({ selection: { checkboxes: false } })}
            />,
        );

        // No checkbox column, in the header or in any row.
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
        expect(screen.getAllByRole('columnheader')).toHaveLength(personColumns.length);

        // Selection itself is engine state and is untouched: the table still says so, and a row
        // still reports whether it is selected.
        expect(screen.getByRole('grid')).toHaveAttribute('aria-multiselectable', 'true');
        expect(screen.getAllByRole('row')[1]).toHaveAttribute('aria-selected', 'false');

        // The other core add-ons are still there, configured or not.
        expect(screen.getByRole('button', { name: /Name/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();

        // And the default keeps its checkboxes, so nothing about this changed for anyone else.
        await user.click(screen.getByRole('button', { name: 'Next page' }));
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });

    it('keeps the checkbox column by default', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} selectionMode="multiple" aria-label="People" />);
        expect(screen.getAllByRole('checkbox', { name: 'Select row' })).toHaveLength(3);
        expect(screen.getAllByRole('columnheader')).toHaveLength(personColumns.length + 1);
    });
});

describe('the page size control', () => {
    it('offers the grid own page size even when it was not listed', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={5} aria-label="People" />);

        // The grid is showing five rows, so the control must say five. A `<select>` whose value is
        // not among its options renders the first one instead, which claimed 10 while five rows
        // were on screen and gave the reader no way back to five.
        const select = screen.getByRole('combobox', { name: /Rows per page/i });
        expect(select).toHaveValue('5');
        expect(screen.getAllByRole('row')).toHaveLength(1 + 5);

        // Inserted in order, not appended.
        expect(Array.from(select.querySelectorAll('option')).map((option) => option.value)).toEqual(['5', '10', '25', '50', '100']);
    });

    it('leaves the listed options alone when the page size is one of them', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={10} aria-label="People" />);
        const select = screen.getByRole('combobox', { name: /Rows per page/i });
        expect(Array.from(select.querySelectorAll('option')).map((option) => option.value)).toEqual(['10', '25', '50', '100']);
    });
});

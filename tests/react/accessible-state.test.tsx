import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { createRemoteDataSource } from '../../src/data/remote';
import type { GridwrightColumn } from '../../src/react/types';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

/**
 * What the live region currently holds.
 *
 * Found by role rather than by class, because a region assistive technology cannot find is a region
 * that does not exist, and querying it the way a screen reader does is the assertion.
 */
const announcement = (): string => screen.getByRole('status').textContent ?? '';

const dataRows = (): HTMLElement[] => screen.getAllByRole('row').slice(1);

describe('row position', () => {
    it('numbers a row by its place in the result, not its place on the page', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />);

        expect(dataRows()[0]).toHaveAttribute('aria-rowindex', '2');

        await user.click(screen.getByRole('button', { name: 'Next page' }));

        // Page two starts at row four of seven. Told "row one" here, a reader has no way to know
        // that paging moved them anywhere at all.
        expect(dataRows()[0]).toHaveAttribute('aria-rowindex', '5');
    });

    it('gives the header row the index ARIA reserves for it', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />);

        expect(screen.getAllByRole('row')[0]).toHaveAttribute('aria-rowindex', '1');
    });

    it('counts the header row in the total, so the index and the count agree', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />);

        const grid = screen.getByRole('grid');
        expect(grid).toHaveAttribute('aria-rowcount', String(people.length + 1));

        // The last row of the last page must be the last index the count allows.
        const last = Number(grid.getAttribute('aria-rowcount'));
        expect(Number(dataRows()[0]!.getAttribute('aria-rowindex'))).toBeLessThanOrEqual(last);
    });

    it('reports an unknown total as unknown rather than as a number from one page', async () => {
        const source = createRemoteDataSource<Person>({
            // A paginating endpoint that answers without a count, which is the common case. Omitting
            // `totalRows` is how a source says it does not know, and the grid must not fill it in.
            fetcher: async () => ({ rows: people.slice(0, 3) }),
            retry: { attempts: 0 },
        });

        render(<Gridwright<Person> columns={personColumns} dataSource={source} pageSize={3} aria-label="People" />);

        await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
        expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '-1');
    });
});

describe('selection state', () => {
    it('says that more than one row may be selected', () => {
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                selectionMode="multiple"
                aria-label="People"
            />,
        );

        expect(screen.getByRole('grid')).toHaveAttribute('aria-multiselectable', 'true');
    });

    it('does not say so when only one row may be selected', () => {
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                selectionMode="single"
                aria-label="People"
            />,
        );

        // Checkboxes do not distinguish the two: a single-selection grid has them too.
        expect(screen.getByRole('grid')).not.toHaveAttribute('aria-multiselectable');
    });
});

describe('the live region', () => {
    it('reports the range and the total once the rows settle', async () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />);

        await waitFor(() => expect(announcement()).toBe('Showing 1 to 3 of 7'));
    });

    it('follows a page change', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />);

        await waitFor(() => expect(announcement()).toBe('Showing 1 to 3 of 7'));
        await user.click(screen.getByRole('button', { name: 'Next page' }));

        // Paging replaces the rows with no navigation event of any kind. Nothing is announced by
        // default, which is why a grid feels like it stopped responding.
        await waitFor(() => expect(announcement()).toBe('Showing 4 to 6 of 7'));
    });

    it('says what the sort became, which aria-sort cannot', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />);

        await user.click(screen.getByRole('button', { name: /Salary/ }));

        // `aria-sort` lives on the header cell, and the reader has left it by the time the sort
        // applies. Without this the control is activated and nothing at all is said.
        await waitFor(() => expect(announcement()).toBe('Salary, sorted ascending'));

        await user.click(screen.getByRole('button', { name: /Salary/ }));
        await waitFor(() => expect(announcement()).toBe('Salary, sorted descending'));

        await user.click(screen.getByRole('button', { name: /Salary/ }));
        await waitFor(() => expect(announcement()).toBe('Salary, not sorted'));
    });

    it('reports an empty result', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person> columns={personColumns} data={people} pageSize={3} searchable aria-label="People" />,
        );

        await user.type(screen.getByRole('searchbox'), 'nobody named this');

        await waitFor(() => expect(announcement()).toBe('No rows to show'));
    });

    it('shows and announces a failed refresh over rows that are still on screen', async () => {
        let attempt = 0;
        const source = createRemoteDataSource<Person>({
            fetcher: async () => {
                attempt += 1;
                if (attempt > 1) throw new Error('the server said no');
                return { rows: people.slice(0, 3), totalRows: 7 };
            },
            retry: { attempts: 0 },
        });

        const user = userEvent.setup();
        render(
            <Gridwright<Person> columns={personColumns} dataSource={source} pageSize={3} aria-label="People" />,
        );

        await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: /Salary/ }));

        // Without the banner the rows are stale and nobody is told: the `role="alert"` in the body
        // only renders when the grid has nothing left to show, so a failed refresh over a full page
        // changed nothing a person could see.
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('The rows could not be updated');
        expect(alert).toHaveTextContent('Showing what was last loaded');

        // The rows keep their place, which is what keepPreviousData is for.
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();

        // Announced once, by the alert. The live region stays out of it rather than saying the
        // same failure a second time.
        expect(announcement()).toBe('');
    });

    it('clears the stale banner once a refresh succeeds', async () => {
        let failing = false;
        const source = createRemoteDataSource<Person>({
            fetcher: async () => {
                if (failing) throw new Error('the server said no');
                return { rows: people.slice(0, 3), totalRows: 7 };
            },
            retry: { attempts: 0 },
        });

        const user = userEvent.setup();
        render(
            <Gridwright<Person> columns={personColumns} dataSource={source} pageSize={3} aria-label="People" />,
        );
        await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());

        failing = true;
        await user.click(screen.getByRole('button', { name: /Salary/ }));
        await screen.findByRole('alert');

        failing = false;
        await user.click(screen.getByRole('button', { name: 'Try again' }));

        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });

    it('says nothing new when nothing it describes has changed', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={personColumns}
                data={people}
                pageSize={3}
                selectionMode="multiple"
                aria-label="People"
            />,
        );

        await waitFor(() => expect(announcement()).toBe('Showing 1 to 3 of 7'));

        // Selecting a row publishes new state without changing anything the sentence describes. A
        // region that repeats itself on every click is a region people switch off.
        await user.click(within(dataRows()[0]!).getByRole('checkbox'));

        expect(announcement()).toBe('Showing 1 to 3 of 7');
    });

    it('carries the total for a virtualized grid, where a range would describe the scrollbar', async () => {
        const many: Person[] = Array.from({ length: 5_000 }, (_, index) => ({
            ...people[0]!,
            id: index,
            name: `Person ${index}`,
        }));

        render(
            <Gridwright<Person>
                columns={personColumns}
                data={many}
                pageSize={5_000}
                virtual={{ rowHeight: 40, height: 400 }}
                aria-label="People"
            />,
        );

        await waitFor(() => expect(announcement()).toBe('5,000 rows'));
    });
});

describe('focus after a page change', () => {
    it('keeps the reader in the grid when the control they pressed disables itself', async () => {
        const user = userEvent.setup();
        // Two pages exactly, so one press of next exhausts the grid.
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={4} aria-label="People" />);

        const next = screen.getByRole('button', { name: 'Next page' });
        await user.click(next);

        expect(next).toBeDisabled();
        // A focused element that becomes disabled sends focus to <body>, which ejects a keyboard
        // user from the grid at the exact moment they reach its last page.
        await waitFor(() => expect(screen.getByRole('button', { name: 'Previous page' })).toHaveFocus());
    });

    it('leaves focus alone when the page changed without the controls being used', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person> columns={personColumns} data={people} pageSize={4} searchable aria-label="People" />,
        );

        const search = screen.getByRole('searchbox');
        await user.type(search, 'Ada');

        // Searching resets to page one and disables "previous", which the reader never touched.
        await waitFor(() => expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled());
        expect(search).toHaveFocus();
    });
});

describe('a grid that is not a tree', () => {
    it('is a grid, and carries no hierarchy it does not have', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" />);

        expect(screen.getByRole('grid')).toBeInTheDocument();
        expect(dataRows()[0]).not.toHaveAttribute('aria-level');
        expect(dataRows()[0]).not.toHaveAttribute('aria-expanded');
    });
});

interface Item {
    id: string;
    name: string;
    children?: Item[];
}

const items: Item[] = [
    {
        id: 'docs',
        name: 'Documents',
        children: [{ id: 'cv', name: 'CV.pdf' }, { id: 'work', name: 'Work' }],
    },
    { id: 'photos', name: 'Photos', children: [{ id: 'beach', name: 'Beach.jpg' }] },
];

const itemColumns: readonly GridwrightColumn<Item>[] = [{ id: 'name', header: 'Name' }];

describe('a tree grid', () => {
    const tree = () =>
        render(
            <Gridwright<Item>
                columns={itemColumns}
                data={items}
                pageSize={100}
                aria-label="Files"
                tree={{ getRowId: (row: Item) => row.id, getChildren: (row: Item) => row.children }}
            />,
        );

    it('is a treegrid, so the hierarchy attributes are read at all', () => {
        tree();

        // Inside a plain `grid` a screen reader ignores aria-level and offers no expand keys.
        expect(screen.getByRole('treegrid')).toBeInTheDocument();
    });

    it('gives every row its depth and its place among its siblings', async () => {
        const user = userEvent.setup();
        tree();

        const roots = dataRows();
        expect(roots[0]).toHaveAttribute('aria-level', '1');
        expect(roots[0]).toHaveAttribute('aria-posinset', '1');
        expect(roots[0]).toHaveAttribute('aria-setsize', '2');
        expect(roots[1]).toHaveAttribute('aria-posinset', '2');

        await user.click(screen.getAllByRole('button', { name: 'Expand' })[0]!);

        // The indentation is padding, and padding tells a reader nothing. This is what does.
        const child = screen.getByText('CV.pdf').closest('tr')!;
        expect(child).toHaveAttribute('aria-level', '2');
        expect(child).toHaveAttribute('aria-posinset', '1');
        expect(child).toHaveAttribute('aria-setsize', '2');
    });

    it('carries the expanded state on the row and not on the toggle as well', async () => {
        const user = userEvent.setup();
        tree();

        const row = screen.getByText('Documents').closest('tr')!;
        expect(row).toHaveAttribute('aria-expanded', 'false');
        expect(within(row).getByRole('button')).not.toHaveAttribute('aria-expanded');

        await user.click(within(row).getByRole('button'));
        expect(screen.getByText('Documents').closest('tr')).toHaveAttribute('aria-expanded', 'true');
    });

    it('leaves a leaf without an expanded state it can never reach', async () => {
        const user = userEvent.setup();
        tree();

        await user.click(screen.getAllByRole('button', { name: 'Expand' })[0]!);

        expect(screen.getByText('CV.pdf').closest('tr')).not.toHaveAttribute('aria-expanded');
    });
});

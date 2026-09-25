import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { coreAddons, sorting } from '../../src/react/core-addons';
import { pl } from '../../src/locales';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

const announcement = (): string => screen.getByRole('status').textContent ?? '';

const sortButton = (name: string): HTMLElement => screen.getByRole('button', { name });

/** The badge in each header, by header text: what a sighted reader sees beside the chevrons. */
const priorities = (): Record<string, string> =>
    Object.fromEntries(
        screen
            .getAllByRole('columnheader')
            .map((header) => [header.textContent?.replace(/\d+$/, '') ?? '', header.querySelector('.gw-sort-priority')?.textContent])
            .filter((entry): entry is [string, string] => entry[1] !== undefined),
    );

const cellsIn = (column: number): string[] =>
    screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[column]?.textContent ?? '');

describe('multi-column sorting', () => {
    it('numbers the sorted columns once there is more than one', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={10} aria-label="People" />);

        await user.click(sortButton('Department'));
        // One sorted column has no priority to speak of.
        expect(priorities()).toEqual({});

        await user.keyboard('{Shift>}');
        await user.click(sortButton('Salary'));
        await user.click(sortButton('Name'));
        await user.keyboard('{/Shift}');

        expect(priorities()).toEqual({ Department: '1', Salary: '2', Name: '3' });
    });

    it('sorts by the second column within ties of the first', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={10} aria-label="People" />);

        await user.click(sortButton('Department'));
        await user.keyboard('{Shift>}');
        await user.click(sortButton('Salary'));
        await user.click(sortButton('Salary'));
        await user.keyboard('{/Shift}');

        // Department ascending, then salary descending inside each department.
        const departments = cellsIn(1);
        const salaries = cellsIn(2).map((cell) => Number(cell.replace(/\D/g, '')));
        for (let at = 1; at < departments.length; at++) {
            expect(departments[at - 1]!.localeCompare(departments[at]!)).toBeLessThanOrEqual(0);
            if (departments[at - 1] === departments[at]) expect(salaries[at - 1]).toBeGreaterThanOrEqual(salaries[at]!);
        }
    });

    it('renumbers when a column leaves, and drops the badges at one column', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={10} aria-label="People" />);

        await user.click(sortButton('Department'));
        await user.keyboard('{Shift>}');
        await user.click(sortButton('Salary'));
        await user.click(sortButton('Name'));

        // Department goes descending, then leaves the sort; the others move up.
        await user.click(sortButton('Department'));
        await user.click(sortButton('Department'));
        expect(priorities()).toEqual({ Salary: '1', Name: '2' });

        await user.click(sortButton('Salary'));
        await user.click(sortButton('Salary'));
        await user.keyboard('{/Shift}');
        expect(priorities()).toEqual({});
        expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending');
    });

    it('keeps the button named by its header while the badge is showing', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={10} aria-label="People" />);

        await user.click(sortButton('Department'));
        await user.keyboard('{Shift>}');
        await user.click(sortButton('Salary'));
        await user.keyboard('{/Shift}');

        // The badge is decorative; a name that changed with every sort would be re-read on each one.
        expect(sortButton('Salary').querySelector('.gw-sort-priority')).toHaveAttribute('aria-hidden', 'true');
    });

    it('says the priority while more than one column is sorted', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={10} aria-label="People" />);

        await user.click(sortButton('Department'));
        await waitFor(() => expect(announcement()).toBe('Department, sorted ascending'));

        await user.keyboard('{Shift>}');
        await user.click(sortButton('Salary'));
        await waitFor(() => expect(announcement()).toBe('Salary, sort priority 2, sorted ascending'));

        await user.click(sortButton('Department'));
        await waitFor(() => expect(announcement()).toBe('Department, sort priority 1, sorted descending'));

        await user.click(sortButton('Salary'));
        await user.click(sortButton('Salary'));
        await waitFor(() => expect(announcement()).toBe('Salary, not sorted'));
        await user.keyboard('{/Shift}');

        // A plain activation replaces the sort, and one sorted column speaks as it always did.
        await user.click(sortButton('Salary'));
        await waitFor(() => expect(announcement()).toBe('Salary, sorted ascending'));
        expect(priorities()).toEqual({});
    });

    it('adds a column from the keyboard with Shift and Enter', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={10} aria-label="People" />);

        await user.click(sortButton('Department'));
        sortButton('Salary').focus();
        await user.keyboard('{Shift>}{Enter}{/Shift}');

        expect(priorities()).toEqual({ Department: '1', Salary: '2' });
    });

    it('tells the reader what Shift does, in the title', () => {
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={10} aria-label="People" />);

        expect(sortButton('Salary')).toHaveAttribute('title', 'Sort ascending (Shift: keep other columns sorted)');
        expect(sortButton('Salary')).toHaveAccessibleDescription('Sort ascending (Shift: keep other columns sorted)');
    });

    it('speaks and titles in the grid locale', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Person> columns={personColumns} data={people} pageSize={10} locale={pl} aria-label="People" />);

        expect(sortButton('Salary')).toHaveAttribute('title', 'Sortuj rosnąco (Shift: zachowaj sortowanie pozostałych kolumn)');

        await user.click(sortButton('Department'));
        await user.keyboard('{Shift>}');
        await user.click(sortButton('Salary'));
        await user.keyboard('{/Shift}');
        await waitFor(() => expect(announcement()).toBe('Salary, priorytet sortowania 2, posortowano rosnąco'));
    });

    describe('with multiSort off', () => {
        const single = () => [
            ...coreAddons<Person>().filter((addon) => addon.name !== 'gridwright:sorting'),
            sorting<Person>({ multiSort: false }),
        ];

        it('replaces the sort on Shift and shows neither hint nor badge', async () => {
            const user = userEvent.setup();
            render(
                <Gridwright<Person> columns={personColumns} data={people} pageSize={10} coreAddons={single()} aria-label="People" />,
            );

            expect(sortButton('Salary')).toHaveAttribute('title', 'Sort ascending');

            await user.click(sortButton('Department'));
            await user.keyboard('{Shift>}');
            await user.click(sortButton('Salary'));
            await user.keyboard('{/Shift}');

            expect(priorities()).toEqual({});
            expect(screen.getByRole('columnheader', { name: 'Department' })).toHaveAttribute('aria-sort', 'none');
            await waitFor(() => expect(announcement()).toBe('Salary, sorted ascending'));
        });
    });
});

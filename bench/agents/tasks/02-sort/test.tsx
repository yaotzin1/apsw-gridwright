import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makePeople, namesOnScreen } from 'bench-harness';
import { Solution } from '../src/Solution';

const people = makePeople(120);
const bySalary = [...people].sort((a, b) => a.salary - b.salary).map((p) => p.name);

const salaryHeader = () => {
    const header = screen.getAllByRole('columnheader').find((h) => h.textContent?.includes('Salary'));
    if (!header) throw new Error('no Salary column header');
    return header;
};
const salaryButton = () => within(salaryHeader()).getByRole('button', { name: /salary/i });

describe('02 sort', () => {
    it('sorts every row by salary ascending, then descending', async () => {
        render(<Solution people={people} />);
        await screen.findByText('Person 1');

        await userEvent.click(salaryButton());
        await waitFor(() => expect(namesOnScreen()).toEqual(bySalary.slice(0, 25)));

        await userEvent.click(salaryButton());
        await waitFor(() => expect(namesOnScreen()).toEqual([...bySalary].reverse().slice(0, 25)));
    });

    it('announces the sort through aria-sort on the header', async () => {
        render(<Solution people={people} />);
        await screen.findByText('Person 1');
        await userEvent.click(salaryButton());
        await waitFor(() => expect(salaryHeader()).toHaveAttribute('aria-sort', 'ascending'));
        await userEvent.click(salaryButton());
        await waitFor(() => expect(salaryHeader()).toHaveAttribute('aria-sort', 'descending'));
    });
});

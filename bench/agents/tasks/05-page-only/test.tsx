import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installServer, makePeople, namesOnScreen } from 'bench-harness';
import { Solution } from '../src/Solution';

const people = makePeople(120);
const firstPageBySalary = people
    .slice(0, 25)
    .sort((a, b) => a.salary - b.salary)
    .map((p) => p.name);

const onlyPaging = (url: URL) => [...url.searchParams.keys()].every((key) => key === 'page' || key === 'pageSize');

const salaryButton = () => {
    const header = screen.getAllByRole('columnheader').find((h) => h.textContent?.includes('Salary'));
    if (!header) throw new Error('no Salary column header');
    return within(header).getByRole('button', { name: /salary/i });
};

describe('05 page-only server', () => {
    it('loads the first page with only page and pageSize', async () => {
        const server = installServer('page-only', people);
        render(<Solution />);
        await screen.findByText('Person 1');
        expect(server.requests.every(onlyPaging)).toBe(true);
        expect(namesOnScreen()).toEqual(people.slice(0, 25).map((p) => p.name));
    });

    it('sorts the loaded page without sending a parameter the server rejects', async () => {
        const server = installServer('page-only', people);
        render(<Solution />);
        await screen.findByText('Person 1');
        await userEvent.click(salaryButton());
        await waitFor(() => expect(namesOnScreen()).toEqual(firstPageBySalary));
        expect(server.requests.every(onlyPaging)).toBe(true);
    });

    it('pages through the server', async () => {
        const server = installServer('page-only', people);
        render(<Solution />);
        await screen.findByText('Person 1');
        await userEvent.click(screen.getByRole('button', { name: /next page/i }));
        await screen.findByText('Person 26');
        expect(server.requests.every(onlyPaging)).toBe(true);
    });
});

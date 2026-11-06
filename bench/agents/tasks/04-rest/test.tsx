import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installServer, makePeople, namesOnScreen } from 'bench-harness';
import { Solution } from '../src/Solution';

const people = makePeople(120);
const bySalary = [...people].sort((a, b) => a.salary - b.salary).map((p) => p.name);

const salaryButton = () => {
    const header = screen.getAllByRole('columnheader').find((h) => h.textContent?.includes('Salary'));
    if (!header) throw new Error('no Salary column header');
    return within(header).getByRole('button', { name: /salary/i });
};

describe('04 rest', () => {
    it('asks for the first page, one-based, and shows it', async () => {
        const server = installServer('rest', people);
        render(<Solution />);
        await screen.findByText('Person 1');
        const first = server.requests[0];
        expect(first?.searchParams.get('page')).toBe('1');
        expect(first?.searchParams.get('pageSize')).toBe('25');
        expect(namesOnScreen()).toEqual(people.slice(0, 25).map((p) => p.name));
    });

    it('shows the total the server reported', async () => {
        installServer('rest', people);
        render(<Solution />);
        await screen.findByText('Person 1');
        // Adjacent elements concatenate in textContent ("of 120Next page"), so no \b here.
        expect(document.body.textContent).toMatch(/(^|\D)120(\D|$)/);
    });

    it('fetches page two from the server', async () => {
        const server = installServer('rest', people);
        render(<Solution />);
        await screen.findByText('Person 1');
        await userEvent.click(screen.getByRole('button', { name: /next page/i }));
        await screen.findByText('Person 26');
        expect(server.requests.some((url) => url.searchParams.get('page') === '2')).toBe(true);
    });

    it('sorts on the server', async () => {
        const server = installServer('rest', people);
        render(<Solution />);
        await screen.findByText('Person 1');
        await userEvent.click(salaryButton());
        await waitFor(() => expect(server.lastRequest()?.searchParams.get('sort')).toBe('salary:asc'));
        await waitFor(() => expect(namesOnScreen()).toEqual(bySalary.slice(0, 25)));
    });
});

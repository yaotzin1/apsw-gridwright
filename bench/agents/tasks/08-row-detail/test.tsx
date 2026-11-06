import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makePeople } from 'bench-harness';
import { Solution } from '../src/Solution';

const people = makePeople(120);

describe('08 row detail', () => {
    it('opens a labelled panel with the email, then closes it', async () => {
        render(<Solution people={people} />);
        await screen.findByText('Person 1');
        expect(screen.queryByRole('region', { name: 'Details for Person 3' })).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Show details for Person 3' }));
        const panel = await screen.findByRole('region', { name: 'Details for Person 3' });
        expect(within(panel).getByText(/person3@example\.com/)).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Hide details for Person 3' }));
        await waitFor(() => expect(screen.queryByRole('region', { name: 'Details for Person 3' })).toBeNull());
    });

    it('puts the panel directly under its row', async () => {
        render(<Solution people={people} />);
        await screen.findByText('Person 1');
        await userEvent.click(screen.getByRole('button', { name: 'Show details for Person 3' }));
        const panel = await screen.findByRole('region', { name: 'Details for Person 3' });

        const rows = [...document.querySelectorAll('tr, [role="row"]')];
        const owner = rows.findIndex((row) => row.textContent?.includes('Person 3') && !row.contains(panel));
        const holder = rows.findIndex((row) => row.contains(panel));
        expect(owner).toBeGreaterThanOrEqual(0);
        expect(holder).toBe(owner + 1);
    });
});

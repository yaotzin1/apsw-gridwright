import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makePeople, namesOnScreen } from 'bench-harness';
import { Solution } from '../src/Solution';

const people = makePeople(120);

describe('01 array basic', () => {
    it('renders the three columns in order', () => {
        render(<Solution people={people} />);
        const headers = screen.getAllByRole('columnheader').map((h) => h.textContent ?? '');
        const order = ['Name', 'Department', 'Salary'].map((label) => headers.findIndex((text) => text.includes(label)));
        expect(order.every((index) => index >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it('shows the first 25 people', async () => {
        render(<Solution people={people} />);
        await screen.findByText('Person 1');
        expect(namesOnScreen()).toEqual(people.slice(0, 25).map((p) => p.name));
    });

    it('moves to the next page', async () => {
        render(<Solution people={people} />);
        await screen.findByText('Person 1');
        await userEvent.click(screen.getByRole('button', { name: /next page/i }));
        await screen.findByText('Person 26');
        expect(namesOnScreen()).toEqual(people.slice(25, 50).map((p) => p.name));
    });
});

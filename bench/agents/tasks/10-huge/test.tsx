import { render, screen } from '@testing-library/react';
import { dataRows, fakeLayout, makePeople } from 'bench-harness';
import { Solution } from '../src/Solution';

const people = makePeople(100_000);

describe('10 huge', () => {
    it('renders the first rows and only a window of the rest', async () => {
        fakeLayout(600, 40);
        render(<Solution people={people} />);
        await screen.findByText('Person 1');
        const rendered = dataRows().length;
        expect(rendered).toBeGreaterThanOrEqual(10);
        expect(rendered).toBeLessThanOrEqual(200);
    });

    it('has no page controls', async () => {
        fakeLayout(600, 40);
        render(<Solution people={people} />);
        await screen.findByText('Person 1');
        expect(screen.queryByRole('button', { name: /next page/i })).toBeNull();
    });
});

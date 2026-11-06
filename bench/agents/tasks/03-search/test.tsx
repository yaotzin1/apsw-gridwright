import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makePeople, namesOnScreen } from 'bench-harness';
import { Solution } from '../src/Solution';

const people = makePeople(120);

const searchBox = () =>
    screen.queryByRole('searchbox', { name: /search/i }) ?? screen.getByRole('textbox', { name: /search/i });

describe('03 search', () => {
    it('finds a person who is not on the first page', async () => {
        render(<Solution people={people} />);
        await screen.findByText('Person 1');
        await userEvent.type(searchBox(), 'PERSON 117');
        await waitFor(() => expect(namesOnScreen()).toEqual(['Person 117']), { timeout: 3_000 });
    });

    it('matches substrings across all rows', async () => {
        render(<Solution people={people} />);
        await screen.findByText('Person 1');
        await userEvent.type(searchBox(), 'son 11');
        const expected = people.filter((p) => p.name.includes('son 11')).map((p) => p.name);
        await waitFor(() => expect(namesOnScreen()).toEqual(expected), { timeout: 3_000 });
    });
});

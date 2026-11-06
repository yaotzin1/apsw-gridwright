import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installServer, isDisabled, makePeople, namesOnScreen } from 'bench-harness';
import { Solution } from '../src/Solution';

const people = makePeople(60); // pages of 25, 25 and 10

/** "of 25", "/ 3", "z 25" or "60 rows" would be a number the server never sent. */
// Lookarounds rather than \b: adjacent elements concatenate in textContent ("Salary25 rows").
const INVENTED = /((?<![a-z])of\s+\d|\/\s*\d|(?<![a-z])z\s+\d|(?<!\d)\d+\s+(rows|records|items|results|pages)(?![a-z]))/i;
const next = () => screen.getByRole('button', { name: /next page/i });

describe('06 no total', () => {
    it('shows the first page without inventing a total', async () => {
        installServer('no-total', people);
        render(<Solution />);
        await screen.findByText('Person 1');
        expect(namesOnScreen()).toEqual(people.slice(0, 25).map((p) => p.name));
        expect(document.body.textContent ?? '').not.toMatch(INVENTED);
    });

    it('pages forward and stops after a short page', async () => {
        installServer('no-total', people);
        render(<Solution />);
        await screen.findByText('Person 1');
        expect(isDisabled(next())).toBe(false);

        await userEvent.click(next());
        await screen.findByText('Person 26');
        expect(document.body.textContent ?? '').not.toMatch(INVENTED);

        await userEvent.click(next());
        await screen.findByText('Person 51');
        expect(namesOnScreen()).toEqual(people.slice(50).map((p) => p.name));
        await waitFor(() => expect(isDisabled(next())).toBe(true));
        expect(document.body.textContent ?? '').not.toMatch(INVENTED);
    });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makePeople, namesOnScreen } from 'bench-harness';
import { Solution } from '../src/Solution';

const people = makePeople(120);
// Lookarounds rather than \b: adjacent elements concatenate in textContent ("1Next page").
const ENGLISH = /(?<![a-z])(next|previous|page|rows|of|loading|no rows|search|sort|select)(?![a-z])/i;

/** Visible text only: accessible names are checked separately, by role. */
const visibleText = () => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    for (const node of clone.querySelectorAll('[aria-live], [role="status"], .sr-only, [hidden]')) node.remove();
    return clone.textContent ?? '';
};

describe('09 polish', () => {
    it('names the headers and page buttons in Polish', async () => {
        render(<Solution people={people} />);
        await screen.findByText('Person 1');
        const headers = screen.getAllByRole('columnheader').map((h) => h.textContent ?? '');
        for (const label of ['Imię i nazwisko', 'Dział', 'Pensja']) {
            expect(headers.some((text) => text.includes(label))).toBe(true);
        }
        expect(screen.getByRole('button', { name: /poprzednia strona/i })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /następna strona/i }));
        await screen.findByText('Person 26');
        expect(namesOnScreen()[0]).toBe('Person 26');
    });

    it('leaves no English visible', async () => {
        render(<Solution people={people} />);
        await screen.findByText('Person 1');
        expect(visibleText().replace(/Person \d+|person\d+@example\.com/g, '')).not.toMatch(ENGLISH);
    });

    it('says there are no rows, in Polish', async () => {
        render(<Solution people={[]} />);
        // A live region may repeat the message for screen readers, so one or more is right.
        expect((await screen.findAllByText('Brak wierszy do wyświetlenia')).length).toBeGreaterThan(0);
    });
});

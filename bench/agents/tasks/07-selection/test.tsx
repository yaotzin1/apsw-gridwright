import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makePeople } from 'bench-harness';
import { vi } from 'vitest';
import { Solution } from '../src/Solution';

const people = makePeople(120);

describe('07 selection', () => {
    it('reports the uuids of the selected rows', async () => {
        const onSelectionChange = vi.fn();
        render(<Solution people={people} onSelectionChange={onSelectionChange} />);
        await screen.findByText('Person 1');

        const boxes = screen.getAllByRole('checkbox', { name: /select row/i });
        expect(boxes.length).toBeGreaterThanOrEqual(25);
        await userEvent.click(boxes[0] as HTMLElement);
        await userEvent.click(boxes[2] as HTMLElement);

        await waitFor(() => {
            const last = onSelectionChange.mock.calls.at(-1)?.[0] as string[] | undefined;
            expect([...(last ?? [])].map(String).sort()).toEqual([people[0]?.uuid, people[2]?.uuid].sort());
        });
    });

    it('reports a deselection', async () => {
        const onSelectionChange = vi.fn();
        render(<Solution people={people} onSelectionChange={onSelectionChange} />);
        await screen.findByText('Person 1');
        const boxes = screen.getAllByRole('checkbox', { name: /select row/i });
        await userEvent.click(boxes[1] as HTMLElement);
        await userEvent.click(boxes[1] as HTMLElement);
        await waitFor(() => expect(onSelectionChange.mock.calls.at(-1)?.[0]).toEqual([]));
    });
});

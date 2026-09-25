import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { coreAddons } from '../../src/react/core-addons';
import type { SelectionOptions } from '../../src/react/core-addons/selection';
import { cellNavigation } from '../../src/react/navigation';
import { virtualRows } from '../../src/react/virtual/addon';
import type { GridRow } from '../../src/core/types';
import type { GridwrightColumn } from '../../src/react/types';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

/**
 * The selection add-on's options, operated the way a reader operates them: by clicking rows and
 * cells and by pressing Space on the focused cell. What is asserted is `aria-selected`, which is
 * the selection a screen reader reports, rather than a class.
 */

const columns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    {
        id: 'open',
        header: 'Open',
        cell: ({ row }) => (
            <button type="button" onClick={() => undefined}>
                Open {row.name}
            </button>
        ),
    },
    { id: 'link', header: 'Link', cell: ({ row }) => <a href={`#person-${row.id}`}>Profile {row.id}</a> },
];

const grid = (selection: SelectionOptions, props: Record<string, unknown> = {}) =>
    render(
        <Gridwright<Person>
            columns={columns}
            data={people}
            pageSize={4}
            selectionMode="multiple"
            aria-label="People"
            coreAddons={coreAddons<Person>({ selection })}
            {...props}
        />,
    );

const rowOf = (name: string): HTMLElement => screen.getByRole('cell', { name }).closest('tr')!;
const selected = (): string[] =>
    screen
        .getAllByRole('row')
        .filter((row) => row.getAttribute('aria-selected') === 'true')
        .map((row) => people.find((person) => row.textContent?.includes(person.name))?.name ?? '');

describe('selection({ selectAll: false })', () => {
    it('keeps the row checkboxes and names the column instead of offering select-all', async () => {
        const user = userEvent.setup();
        grid({ selectAll: false });

        expect(screen.queryByRole('checkbox', { name: 'Select all rows on this page' })).toBeNull();
        // Still a header a screen reader can name the column by.
        expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('Selection');

        await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[1]!);
        expect(selected()).toEqual(['Grace Hopper']);
    });

    it('offers select-all by default', () => {
        grid({});
        expect(screen.getByRole('checkbox', { name: 'Select all rows on this page' })).toBeInTheDocument();
    });
});

describe('selection({ selectOnRowClick: true })', () => {
    it('toggles a row when it is clicked, with no checkbox column needed', async () => {
        const user = userEvent.setup();
        grid({ checkboxes: false, selectOnRowClick: true });

        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
        await user.click(screen.getByRole('cell', { name: 'Ada Lovelace' }));
        await user.click(screen.getByRole('cell', { name: 'Grace Hopper' }));
        expect(selected()).toHaveLength(2);

        await user.click(screen.getByRole('cell', { name: 'Ada Lovelace' }));
        expect(selected()).not.toContain('Ada Lovelace');
        expect(rowOf('Ada Lovelace')).toHaveClass('gw-row--selectable');
    });

    it('leaves a click on a button or a link inside the row to that control', async () => {
        const user = userEvent.setup();
        grid({ checkboxes: false, selectOnRowClick: true });

        await user.click(screen.getByRole('button', { name: 'Open Ada Lovelace' }));
        await user.click(screen.getByRole('link', { name: 'Profile 1' }));

        expect(selected()).toEqual([]);
    });

    it('does not select a row whose text the reader was selecting', async () => {
        grid({ checkboxes: false, selectOnRowClick: true });

        const cell = screen.getByRole('cell', { name: 'Ada Lovelace' });
        const range = document.createRange();
        range.selectNodeContents(cell);
        document.getSelection()!.removeAllRanges();
        document.getSelection()!.addRange(range);

        // The click that ends a drag across the text. Dispatched on its own, because a simulated
        // mouse-down would first collapse the selection the drag made.
        fireEvent.click(cell);
        expect(selected()).toEqual([]);
        document.getSelection()!.removeAllRanges();
    });

    it('still runs the grid onRowClick, before the selection changes', async () => {
        const user = userEvent.setup();
        const seen: boolean[] = [];
        const onRowClick = vi.fn((row: GridRow<Person>) => seen.push(row.selected));
        grid({ checkboxes: false, selectOnRowClick: true }, { onRowClick });

        await user.click(screen.getByRole('cell', { name: 'Ada Lovelace' }));

        expect(onRowClick).toHaveBeenCalledTimes(1);
        expect(seen).toEqual([false]);
        expect(selected()).toEqual(['Ada Lovelace']);
    });

    it('replaces the selection in single mode', async () => {
        const user = userEvent.setup();
        grid({ selectOnRowClick: true }, { selectionMode: 'single' });

        await user.click(screen.getByRole('cell', { name: 'Ada Lovelace' }));
        await user.click(screen.getByRole('cell', { name: 'Grace Hopper' }));
        expect(selected()).toEqual(['Grace Hopper']);
    });

    it('selects nothing and marks nothing when it is off', async () => {
        const user = userEvent.setup();
        grid({ checkboxes: false });

        await user.click(screen.getByRole('cell', { name: 'Ada Lovelace' }));
        expect(selected()).toEqual([]);
        expect(rowOf('Ada Lovelace')).not.toHaveClass('gw-row--selectable');
    });

    it('works the same under virtualRows()', async () => {
        const user = userEvent.setup();
        grid({ checkboxes: false, selectOnRowClick: true }, { addons: [virtualRows<Person>({ rowHeight: 40, height: 400 })] });

        await user.click(await screen.findByRole('cell', { name: 'Grace Hopper' }));
        expect(selected()).toEqual(['Grace Hopper']);
    });
});

describe('Space with cellNavigation()', () => {
    const tabbable = (): HTMLElement => screen.getAllByRole('cell').find((cell) => cell.getAttribute('tabindex') === '0')!;

    it('toggles the focused row when the cell holds no control', async () => {
        const user = userEvent.setup();
        grid({ checkboxes: false, selectOnRowClick: true }, { addons: [cellNavigation<Person>()] });
        await waitFor(() => expect(tabbable()).toHaveTextContent('Ada Lovelace'));

        tabbable().focus();
        await user.keyboard(' ');
        expect(selected()).toEqual(['Ada Lovelace']);

        await user.keyboard('{ArrowDown} ');
        expect(selected()).toEqual(['Ada Lovelace', 'Grace Hopper']);

        await user.keyboard(' ');
        expect(selected()).toEqual(['Ada Lovelace']);
    });

    it('leaves Space on a cell with a control to that control', async () => {
        const user = userEvent.setup();
        grid({ selectOnRowClick: true }, { addons: [cellNavigation<Person>()] });
        const checkboxCell = () => screen.getAllByRole('checkbox', { name: 'Select row' })[0]!.closest('td')!;
        await waitFor(() => expect(checkboxCell()).toHaveAttribute('tabindex'));

        // The checkbox cell: cellNavigation() ticks the checkbox, once, rather than both add-ons acting.
        checkboxCell().focus();
        await user.keyboard(' ');
        expect(selected()).toEqual(['Ada Lovelace']);
    });

    it('does nothing to the selection without selectOnRowClick', async () => {
        const user = userEvent.setup();
        grid({ checkboxes: false }, { addons: [cellNavigation<Person>()] });
        await waitFor(() => expect(tabbable()).toHaveTextContent('Ada Lovelace'));

        tabbable().focus();
        await user.keyboard(' ');
        expect(selected()).toEqual([]);
    });
});

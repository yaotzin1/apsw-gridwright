import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { cellNavigation } from '../../src/react/navigation';
import type { CellNavigationOptions } from '../../src/react/navigation/types';
import type { GridwrightColumn } from '../../src/react/types';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

/**
 * The header row as part of the cursor's grid: `cellNavigation({ headerRow: true })`.
 *
 * Observed the way a keyboard reaches it. Which element is focused, which one is tabbable, and what
 * `aria-sort` says after a key, rather than any class name.
 */

const columns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary' },
];

const renderGrid = (options: CellNavigationOptions = {}, props: Record<string, unknown> = {}) =>
    render(
        <Gridwright<Person>
            columns={columns}
            data={people}
            pageSize={4}
            aria-label="People"
            addons={[cellNavigation<Person>(options)]}
            {...props}
        />,
    );

const headers = (): HTMLElement[] => screen.getAllByRole('columnheader');
const header = (name: string): HTMLElement => headers().find((cell) => cell.textContent?.includes(name))!;
const tabStops = (): HTMLElement[] =>
    [...screen.getByRole('grid').querySelectorAll<HTMLElement>('[tabindex="0"], button:not([tabindex="-1"])')];
const focused = (): HTMLElement => document.activeElement as HTMLElement;

describe('cellNavigation({ headerRow })', () => {
    it('leaves the sort buttons in the Tab order when the header is not part of the cursor', async () => {
        renderGrid();
        await waitFor(() => expect(screen.getAllByRole('cell').some((cell) => cell.getAttribute('tabindex') === '0')).toBe(true));

        // Not `-1`. MUI's ButtonBase writes `tabindex="0"` itself, so "absent" would fail it for a reason
        // that is not the add-on's.
        expect(screen.getByRole('button', { name: 'Name' })).not.toHaveAttribute('tabindex', '-1');
        expect(header('Name')).not.toHaveAttribute('tabindex');
    });

    it('takes the sort buttons out of the Tab order and leaves the grid one Tab stop', async () => {
        renderGrid({ headerRow: true });

        await waitFor(() => expect(tabStops()).toHaveLength(1));
        // On the first row of data, not on the header above it.
        expect(tabStops()[0]).toHaveTextContent('Ada Lovelace');
        expect(screen.getByRole('button', { name: 'Name' })).toHaveAttribute('tabindex', '-1');
    });

    it('reaches the header with ArrowUp, moves along it, and comes back down', async () => {
        const user = userEvent.setup();
        renderGrid({ headerRow: true });
        await waitFor(() => expect(tabStops()).toHaveLength(1));

        tabStops()[0]!.focus();
        await user.keyboard('{ArrowUp}');
        expect(focused()).toBe(header('Name'));
        expect(tabStops()).toEqual([header('Name')]);

        await user.keyboard('{ArrowRight}');
        expect(focused()).toBe(header('Department'));

        await user.keyboard('{ArrowDown}');
        expect(focused()).toHaveTextContent('Engineering');
    });

    it('keeps an arrow key the cursor cannot use at the edge from scrolling the page', async () => {
        const user = userEvent.setup();
        renderGrid({ headerRow: true });
        await waitFor(() => expect(tabStops()).toHaveLength(1));

        tabStops()[0]!.focus();
        await user.keyboard('{ArrowUp}');
        expect(focused()).toBe(header('Name'));

        // `fireEvent` returns false when the handler called `preventDefault`. A key that is left to the
        // browser here scrolls the page, one line per press, because the cursor has nowhere to go.
        expect(fireEvent.keyDown(focused(), { key: 'ArrowUp' })).toBe(false);
        expect(fireEvent.keyDown(focused(), { key: 'ArrowLeft' })).toBe(false);
        expect(fireEvent.keyDown(focused(), { key: 'Home' })).toBe(false);
        expect(fireEvent.keyDown(focused(), { key: 'PageUp' })).toBe(false);
        expect(focused()).toBe(header('Name'));

        // Alt+ArrowLeft is the browser's Back, and it stays the browser's at the first column.
        expect(fireEvent.keyDown(focused(), { key: 'ArrowLeft', altKey: true })).toBe(true);
    });

    it('sorts with Enter and Space, and adds a column with Shift+Enter', async () => {
        const user = userEvent.setup();
        renderGrid({ headerRow: true });
        await waitFor(() => expect(tabStops()).toHaveLength(1));

        tabStops()[0]!.focus();
        await user.keyboard('{ArrowUp}{Enter}');
        await waitFor(() => expect(header('Name')).toHaveAttribute('aria-sort', 'ascending'));
        // The cell keeps the focus, so the next key is still the cursor's.
        await waitFor(() => expect(focused()).toBe(header('Name')));

        await user.keyboard('{Enter}');
        await waitFor(() => expect(header('Name')).toHaveAttribute('aria-sort', 'descending'));

        await user.keyboard('{ArrowRight}{Shift>}{Enter}{/Shift}');
        await waitFor(() => expect(header('Department')).toHaveAttribute('aria-sort', 'ascending'));
        expect(header('Name')).toHaveAttribute('aria-sort', 'descending');

        await user.keyboard('{ArrowRight} ');
        await waitFor(() => expect(header('Salary')).toHaveAttribute('aria-sort', 'ascending'));
    });

    it('stops at the header going up, and reaches it with Ctrl+Home', async () => {
        const user = userEvent.setup();
        renderGrid({ headerRow: true });
        await waitFor(() => expect(tabStops()).toHaveLength(1));

        tabStops()[0]!.focus();
        await user.keyboard('{ArrowDown}{ArrowDown}{Control>}{Home}{/Control}');
        expect(focused()).toBe(header('Name'));

        await user.keyboard('{ArrowUp}');
        expect(focused()).toBe(header('Name'));
    });

    it('keeps the cursor on the header when a sort reorders the rows', async () => {
        const user = userEvent.setup();
        renderGrid({ headerRow: true });
        await waitFor(() => expect(tabStops()).toHaveLength(1));

        tabStops()[0]!.focus();
        await user.keyboard('{ArrowUp}{ArrowRight}{ArrowRight}{Enter}');

        await waitFor(() => expect(header('Salary')).toHaveAttribute('aria-sort', 'ascending'));
        expect(tabStops()).toEqual([header('Salary')]);
    });

    it('is still one Tab stop with no rows to show, the header being all there is', async () => {
        const user = userEvent.setup();
        renderGrid({ headerRow: true }, { data: [] });

        await waitFor(() => expect(tabStops()).toHaveLength(1));
        expect(tabStops()[0]).toBe(header('Name'));

        tabStops()[0]!.focus();
        await user.keyboard('{Enter}');
        await waitFor(() => expect(header('Name')).toHaveAttribute('aria-sort', 'ascending'));
    });
});

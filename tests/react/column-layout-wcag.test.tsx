import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { columnLayout } from '../../src/react/layout/addon';
import { wcag } from '../../src/react/wcag';
import { pl } from '../../src/locales/pl';
import type { ColumnLayoutOptions } from '../../src/react/layout/types';
import type { GridAddon } from '../../src/react/addons/types';
import type { GridwrightColumn } from '../../src/react/types';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

/**
 * The picker's pointer routes to a move and a resize (WCAG 2.5.7, AC-03). They exist under `wcag()`
 * and nowhere else, so the first thing asserted is their absence without it.
 */

const columns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', width: 200, layout: { hideable: false } },
    { id: 'department', header: 'Department', width: 150 },
    { id: 'salary', header: 'Salary', width: 120, layout: { resizable: false, maxWidth: 300 } },
    { id: 'startedOn', header: 'Started', width: 140, layout: { movable: false } },
];

const renderGrid = (options: ColumnLayoutOptions = {}, withWcag = true, props: Record<string, unknown> = {}) => {
    const addons: GridAddon<Person>[] = [columnLayout<Person>(options)];
    if (withWcag) addons.unshift(wcag<Person>());
    return render(<Gridwright<Person> columns={columns} data={people} pageSize={10} aria-label="People" addons={addons} {...props} />);
};

const announcement = (): string => screen.getByRole('status').textContent ?? '';
const headerNames = (): string[] => screen.getAllByRole('columnheader').map((cell) => cell.textContent ?? '');

const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Columns' }));
    return screen.getByRole('menu', { name: 'Columns' });
};

const step = (menu: HTMLElement, name: string): HTMLElement => within(menu).getByRole('menuitem', { name });

describe('the column picker without wcag()', () => {
    it('is the picker it was: no move or width controls (AC-15)', async () => {
        const user = userEvent.setup();
        renderGrid({}, false);

        const menu = await openPicker(user);

        expect(within(menu).queryByRole('menuitem', { name: /earlier|later|narrower|wider/ })).toBeNull();
        expect(menu.querySelector('.gw-column-picker-step')).toBeNull();
    });
});

describe('the column picker under wcag()', () => {
    it('gives every movable column a move earlier and a move later control, named for the column (AC-03)', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);

        for (const column of ['Name', 'Department', 'Salary']) {
            expect(step(menu, `Move ${column} earlier`)).toBeInTheDocument();
            expect(step(menu, `Move ${column} later`)).toBeInTheDocument();
        }
    });

    it('moves a column by a click, with no drag, and says so in the one live region (AC-03)', async () => {
        const user = userEvent.setup();
        renderGrid();
        expect(headerNames().slice(0, 2)).toEqual(['Name', 'Department']);

        const menu = await openPicker(user);
        await user.click(step(menu, 'Move Department earlier'));

        expect(headerNames().slice(0, 2)).toEqual(['Department', 'Name']);
        // Two neighbours swapped, which the order alone cannot attribute: the picker's move records its mover.
        await waitFor(() => expect(announcement()).toBe('Department moved to position 1 of 4'));
    });

    it('moves the other way too, and keeps focus on the control that was pressed', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        await user.click(step(menu, 'Move Name later'));

        expect(headerNames().slice(0, 2)).toEqual(['Department', 'Name']);
        await waitFor(() => expect(announcement()).toBe('Name moved to position 2 of 4'));
        expect(screen.getByRole('menuitem', { name: 'Move Name later' })).toHaveFocus();
    });

    it('refuses to move a column off either end, saying so before it is pressed', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);

        expect(step(menu, 'Move Name earlier')).toHaveAttribute('aria-disabled', 'true');
        expect(step(menu, 'Move Name later')).not.toHaveAttribute('aria-disabled');

        await user.click(step(menu, 'Move Name earlier'));
        expect(headerNames()[0]).toBe('Name');
    });

    it('offers a width control only to a resizable column, and a move only to a movable one', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);

        // Salary is resizable: false, Started is movable: false.
        expect(within(menu).queryByRole('menuitem', { name: 'Make Salary wider' })).toBeNull();
        expect(step(menu, 'Move Salary later')).toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', { name: 'Move Started earlier' })).toBeNull();
        expect(step(menu, 'Make Started wider')).toBeInTheDocument();
    });

    it('widens and narrows a column in steps, and announces the width the way the handle does (AC-03)', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        const header = (): HTMLElement => screen.getByRole('columnheader', { name: /Department/ });
        const width = (): string => header().closest('table')!.style.getPropertyValue('--gw-col-w-department');

        await user.click(step(menu, 'Make Department wider'));
        expect(width()).toBe('166px');
        expect(announcement()).toBe('Department width: 166 pixels');

        await user.click(step(menu, 'Make Department narrower'));
        await user.click(step(menu, 'Make Department narrower'));
        expect(width()).toBe('134px');
        expect(announcement()).toBe('Department width: 134 pixels');
    });

    it('stops at the column\'s bounds, disabled before it is pressed', async () => {
        const user = userEvent.setup();
        renderGrid({}, true, { columns: [{ id: 'name', header: 'Name', width: 200, layout: { maxWidth: 210 } }, columns[1]!] });

        const menu = await openPicker(user);
        await user.click(step(menu, 'Make Name wider'));

        expect(announcement()).toBe('Name width: 210 pixels');
        expect(step(menu, 'Make Name wider')).toHaveAttribute('aria-disabled', 'true');
    });

    it('asks the consumer\'s guard first and leaves a refused change undone', async () => {
        const user = userEvent.setup();
        renderGrid({ canChange: (change) => change.type !== 'move' });

        const menu = await openPicker(user);

        expect(step(menu, 'Move Department earlier')).toHaveAttribute('aria-disabled', 'true');
        await user.click(step(menu, 'Move Department earlier'));
        expect(headerNames().slice(0, 2)).toEqual(['Name', 'Department']);
    });

    it('is reachable by keyboard: the arrow keys walk the new controls with the others', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        const first = menu.querySelector<HTMLButtonElement>('button')!;
        expect(first).toHaveFocus();

        await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
        // Past the item and the two pins, the next stop is a new control.
        expect(document.activeElement).toBe(step(menu, 'Move Name earlier'));
        await user.keyboard('{Enter}');
        expect(headerNames()[0]).toBe('Name');
    });

    it('takes its sentences from the locale (AC-12)', async () => {
        const user = userEvent.setup();
        renderGrid({}, true, { locale: pl });

        await user.click(screen.getByRole('button', { name: 'Kolumny' }));
        const menu = screen.getByRole('menu', { name: 'Kolumny' });

        expect(within(menu).getByRole('menuitem', { name: 'Przesuń kolumnę Department wcześniej' })).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', { name: 'Poszerz kolumnę Department' })).toBeInTheDocument();
    });
});

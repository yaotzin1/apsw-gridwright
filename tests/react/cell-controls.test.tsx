import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { rowDetail } from '../../src/react/detail/addon';
import { cellNavigation } from '../../src/react/navigation';
import { cellControlOf, cellTabIndex } from '../../src/react/navigation/cell-control';
import type { CellNavigationOptions } from '../../src/react/navigation/types';
import { inlineEditing } from '../../src/react/plugins/addons';
import type { GridAddon } from '../../src/react/addons/types';
import type { GridwrightColumn } from '../../src/react/types';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

/**
 * Controls inside cells under `cellNavigation()`: out of the Tab order, operated from the cell, and
 * an editor closed from the keyboard hands focus back instead of dropping it on <body>.
 *
 * Found by the 2026-09-24 keyboard walk-through (specs/cell-navigation-and-clipboard/review.md).
 */

const columns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', edit: { editable: true } },
    { id: 'department', header: 'Department' },
];

const commit = vi.fn();

const renderGrid = (addons: GridAddon<Person>[], props: Record<string, unknown> = {}) =>
    render(
        <Gridwright<Person>
            columns={columns}
            data={people}
            pageSize={3}
            selectionMode="multiple"
            aria-label="People"
            addons={addons}
            {...props}
        />,
    );

const navigated = (options: CellNavigationOptions = {}) => [cellNavigation<Person>(options), inlineEditing<Person>({ commit })];

const rowCheckboxes = (): HTMLElement[] => screen.getAllByRole('checkbox', { name: 'Select row' });
const cellOf = (text: string): HTMLElement => screen.getAllByRole('cell').find((cell) => cell.textContent === text)!;

describe('controls inside navigated cells', () => {
    it('takes them out of the Tab order, so Tab leaves the grid in one press', async () => {
        renderGrid(navigated(), { addons: [...navigated(), rowDetail<Person>({ render: () => 'detail' })] });
        await waitFor(() => expect(rowCheckboxes()).toHaveLength(3));

        expect(rowCheckboxes().every((box) => box.tabIndex === -1)).toBe(true);
        expect(screen.getAllByRole('button', { name: /Show details/ }).every((button) => button.tabIndex === -1)).toBe(true);
        expect(within(cellOf('Ada Lovelace')).getByRole('button').tabIndex).toBe(-1);
        // The one stop left in the body is the cursor's cell.
        const body = screen.getAllByRole('rowgroup')[1]!;
        const stops = [...body.querySelectorAll<HTMLElement>('*')].filter((element) => element.tabIndex >= 0);
        expect(stops).toHaveLength(1);
        expect(stops[0]!.tagName).toBe('TD');
    });

    it('leaves them where they were without the add-on', async () => {
        renderGrid([inlineEditing<Person>({ commit })]);
        await waitFor(() => expect(rowCheckboxes()).toHaveLength(3));

        expect(rowCheckboxes().every((box) => !box.hasAttribute('tabindex'))).toBe(true);
        expect(within(cellOf('Ada Lovelace')).getByRole('button')).not.toHaveAttribute('tabindex');
    });

    it('keeps the checkbox tabbable when the cursor does not visit its column', async () => {
        renderGrid(navigated({ includeExtraColumns: false }));
        await waitFor(() => expect(rowCheckboxes()).toHaveLength(3));

        expect(rowCheckboxes().every((box) => !box.hasAttribute('tabindex'))).toBe(true);
        // The data cells are still visited, so the edit button still leaves the Tab order.
        expect(within(cellOf('Ada Lovelace')).getByRole('button').tabIndex).toBe(-1);
    });
});

describe('operating a control from its cell', () => {
    it('selects the row with Space on the checkbox cell', async () => {
        const user = userEvent.setup();
        renderGrid(navigated(), { initialCell: undefined });
        await waitFor(() => expect(rowCheckboxes()).toHaveLength(3));

        rowCheckboxes()[0]!.closest('td')!.focus();
        await user.keyboard(' ');

        expect(rowCheckboxes()[0]).toBeChecked();
        expect(screen.getAllByRole('row')[1]).toHaveAttribute('aria-selected', 'true');
    });

    it.each(['{Enter}', '{F2}'])('opens the editor with %s on an editable cell', async (key) => {
        const user = userEvent.setup();
        renderGrid(navigated());
        await waitFor(() => expect(cellOf('Ada Lovelace')).toBeDefined());

        cellOf('Ada Lovelace').focus();
        await user.keyboard(key);

        expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    });

    it('leaves a key pressed on the control itself to the control', async () => {
        const user = userEvent.setup();
        renderGrid(navigated());
        await waitFor(() => expect(rowCheckboxes()).toHaveLength(3));

        // Enter on a checkbox does nothing natively; the cell must not turn it into a click.
        rowCheckboxes()[0]!.focus();
        await user.keyboard('{Enter}');

        expect(rowCheckboxes()[0]).not.toBeChecked();
    });

    it('does nothing on a cell that holds no control', async () => {
        const user = userEvent.setup();
        renderGrid(navigated());
        await waitFor(() => expect(cellOf('Engineering')).toBeDefined());

        cellOf('Engineering').focus();
        await user.keyboard('{Enter}');

        expect(cellOf('Engineering')).toHaveFocus();
        expect(screen.queryByRole('textbox')).toBeNull();
    });
});

describe('closing an editor', () => {
    it.each([
        ['Escape', '{Escape}'],
        ['Enter', '{Enter}'],
    ])('returns focus to the edit button on %s', async (_name, key) => {
        const user = userEvent.setup();
        renderGrid(navigated());
        await waitFor(() => expect(cellOf('Ada Lovelace')).toBeDefined());

        cellOf('Ada Lovelace').focus();
        await user.keyboard('{Enter}');
        await user.keyboard(key);

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(document.activeElement).toBe(within(cellOf('Ada Lovelace')).getByRole('button'));
    });

    it('returns focus without cellNavigation() too', async () => {
        const user = userEvent.setup();
        renderGrid([inlineEditing<Person>({ commit })]);
        await waitFor(() => expect(cellOf('Ada Lovelace')).toBeDefined());

        await user.click(within(cellOf('Ada Lovelace')).getByRole('button'));
        await user.keyboard('{Escape}');

        expect(document.activeElement).toBe(within(cellOf('Ada Lovelace')).getByRole('button'));
    });

    it('leaves focus where a click put it', async () => {
        const user = userEvent.setup();
        render(
            <>
                <button type="button">Elsewhere</button>
                <Gridwright<Person> columns={columns} data={people} pageSize={3} addons={navigated()} />
            </>,
        );
        await waitFor(() => expect(cellOf('Ada Lovelace')).toBeDefined());

        cellOf('Ada Lovelace').focus();
        await user.keyboard('{Enter}');
        await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
    });

    it('does not save when Escape closes it', async () => {
        const user = userEvent.setup();
        commit.mockClear();
        renderGrid(navigated());
        await waitFor(() => expect(cellOf('Ada Lovelace')).toBeDefined());

        cellOf('Ada Lovelace').focus();
        await user.keyboard('{Enter}');
        await user.type(screen.getByRole('textbox', { name: 'Name' }), ' Changed');
        await user.keyboard('{Escape}');

        expect(commit).not.toHaveBeenCalled();
    });
});

describe('cellControlOf and cellTabIndex', () => {
    const cell = (...children: HTMLElement[]): HTMLTableCellElement => {
        const td = document.createElement('td');
        td.append(...children);
        return td;
    };
    const element = (tag: string, text: string, attributes: Record<string, string> = {}): HTMLElement => {
        const node = document.createElement(tag);
        node.textContent = text;
        for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
        return node;
    };

    it('prefers anything over a disclosure toggle, which the arrow keys already operate', () => {
        const toggle = () => element('button', 'toggle', { 'data-gw-disclosure': '' });
        expect(cellControlOf(cell(toggle(), element('button', 'edit')))?.textContent).toBe('edit');
        expect(cellControlOf(cell(toggle()))?.textContent).toBe('toggle');
    });

    it('skips a disabled control and finds none in a plain cell', () => {
        expect(cellControlOf(cell(element('button', 'a', { disabled: '' }), element('a', 'b', { href: '/x' })))?.tagName).toBe('A');
        expect(cellControlOf(cell(element('button', 'a', { 'aria-disabled': 'true' })))).toBeNull();
        expect(cellControlOf(cell(element('span', 'plain text')))).toBeNull();
    });

    it('is -1 only for a cell the cursor visits', () => {
        const navigation = { activeCell: null, columnIds: ['gridwright:selection', 'name'], isActive: () => false, focusCell: () => false };
        expect(cellTabIndex(null)).toBeUndefined();
        expect(cellTabIndex(null, 'gridwright:selection')).toBeUndefined();
        expect(cellTabIndex(navigation)).toBe(-1);
        expect(cellTabIndex(navigation, 'gridwright:selection')).toBe(-1);
        expect(cellTabIndex(navigation, 'gridwright:row-detail')).toBeUndefined();
    });
});

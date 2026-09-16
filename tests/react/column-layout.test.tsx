import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { columnLayout } from '../../src/react/layout/addon';
import { search } from '../../src/react/core-addons';
import { exportMenu } from '../../src/react/export/addon';
import { columnWidthProperty } from '../../src/react/layout/layout';
import { pl } from '../../src/locales/pl';
import type { ColumnLayoutOptions } from '../../src/react/layout/types';
import type { GridwrightColumn } from '../../src/react/types';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

/**
 * The add-on through the component, queried the way a reader reaches it: the handle by its role and
 * its name, the picker by its menu items. The arithmetic itself is covered in
 * `tests/unit/column-layout.test.ts`, so nothing here asserts a sum.
 */

const columns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', width: 200, layout: { hideable: false } },
    { id: 'department', header: 'Department' },
    { id: 'salary', header: 'Salary', width: 120, layout: { resizable: false, maxWidth: 300 } },
    { id: 'startedOn', header: 'Started' },
];

const renderGrid = (options: ColumnLayoutOptions = {}, props: Record<string, unknown> = {}) =>
    render(
        <Gridwright<Person>
            columns={columns}
            data={people}
            pageSize={10}
            addons={[columnLayout<Person>(options)]}
            {...props}
        />,
    );

const table = (): HTMLTableElement => screen.getByRole('grid') as HTMLTableElement;
const handleFor = (column: string): HTMLElement => screen.getByRole('separator', { name: `Resize ${column}` });
const announcement = (): string => screen.getByRole('status').textContent ?? '';
const headerNames = (): string[] => screen.getAllByRole('columnheader').map((cell) => cell.textContent ?? '');

const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Columns' }));
    return screen.getByRole('menu', { name: 'Columns' });
};

// jsdom has neither `PointerEvent` nor the capture API, so `fireEvent.pointerDown` delivers an
// event with no `button`, no `clientX` and no `pointerId` at all. A drag is driven here with a
// `MouseEvent` of the right type carrying the one field a mouse event does not have.
beforeAll(() => {
    Element.prototype.setPointerCapture = function setPointerCapture() {};
    Element.prototype.releasePointerCapture = function releasePointerCapture() {};
    Element.prototype.hasPointerCapture = function hasPointerCapture() {
        return false;
    };
});

const pointer = (
    element: HTMLElement,
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    init: { pointerId: number; clientX?: number },
): void => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: init.clientX ?? 0 });
    Object.defineProperty(event, 'pointerId', { value: init.pointerId });
    fireEvent(element, event);
};

describe('the table the add-on renders into', () => {
    it('publishes every column width as a custom property on the table', () => {
        renderGrid();

        expect(table()).toHaveClass('gw-table--fixed');
        expect(table().style.getPropertyValue(columnWidthProperty('name'))).toBe('200px');
        // No width of its own, so the add-on's default.
        expect(table().style.getPropertyValue(columnWidthProperty('department'))).toBe('150px');
    });

    it('gives every cell a width that reads the property rather than a number of its own', () => {
        renderGrid();

        const header = screen.getByRole('columnheader', { name: /Name/ });
        expect(header).toHaveStyle({ width: `var(${columnWidthProperty('name')})` });

        const cell = within(screen.getAllByRole('row')[1]!).getAllByRole('cell')[0]!;
        expect(cell).toHaveStyle({ width: `var(${columnWidthProperty('name')})` });
    });

    // The point of the whole design: one grid that does not list the add-on is untouched by it.
    it('leaves a grid that does not list it alone', () => {
        render(<Gridwright<Person> columns={columns} data={people} pageSize={10} />);

        expect(screen.getByRole('grid')).not.toHaveClass('gw-table--fixed');
        expect(screen.queryByRole('separator', { name: /Resize/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Columns' })).not.toBeInTheDocument();
    });
});

describe('the resize handle', () => {
    it('is a focusable separator carrying the width, in every resizable header', () => {
        renderGrid();

        const handle = handleFor('Name');
        expect(handle).toHaveAttribute('aria-orientation', 'vertical');
        expect(handle).toHaveAttribute('aria-valuenow', '200');
        expect(handle).toHaveAttribute('aria-valuemin', '50');
        expect(handle).toHaveAttribute('tabindex', '0');
        // No ceiling was declared, so none is reported: a maximum nobody set is a limit invented.
        expect(handle).not.toHaveAttribute('aria-valuemax');
    });

    it('reports a ceiling where the column declared one, and refuses to pass it', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={[{ id: 'name', header: 'Name', width: 200, layout: { maxWidth: 210 } }]}
                data={people}
                addons={[columnLayout<Person>()]}
            />,
        );

        expect(handleFor('Name')).toHaveAttribute('aria-valuemax', '210');

        handleFor('Name').focus();
        await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '210');
    });

    it('is absent from a column that opted out, and from every column when the add-on has it off', () => {
        const { unmount } = renderGrid();
        expect(screen.queryByRole('separator', { name: 'Resize Salary' })).not.toBeInTheDocument();
        expect(handleFor('Name')).toBeInTheDocument();
        unmount();

        renderGrid({ resizable: false });
        expect(screen.queryByRole('separator', { name: /Resize/ })).not.toBeInTheDocument();
    });

    it('sits beside the sort button rather than inside it', () => {
        renderGrid();

        const header = screen.getByRole('columnheader', { name: /Name/ });
        const sort = within(header).getByRole('button', { name: /Name/ });
        expect(sort).not.toContainElement(handleFor('Name'));
    });
});

describe('resizing with the keyboard', () => {
    it('steps by five, and by twenty with Shift', async () => {
        const user = userEvent.setup();
        renderGrid();

        handleFor('Name').focus();

        await user.keyboard('{ArrowRight}');
        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '205');

        await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '225');

        await user.keyboard('{ArrowLeft}');
        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '220');
    });

    it('snaps to the floor with Home, and never below it', async () => {
        const user = userEvent.setup();
        renderGrid();

        handleFor('Name').focus();
        await user.keyboard('{Home}');
        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '50');

        await user.keyboard('{ArrowLeft}');
        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '50');
    });

    it('moves the property on the table, so every cell of the column follows', async () => {
        const user = userEvent.setup();
        renderGrid();

        handleFor('Name').focus();
        await user.keyboard('{ArrowRight}');
        expect(table().style.getPropertyValue(columnWidthProperty('name'))).toBe('205px');
    });

    // A width is one of the few things a sighted reader learns by looking, and everyone else learns
    // only if it is said.
    it('says the new width', async () => {
        const user = userEvent.setup();
        renderGrid();

        handleFor('Name').focus();
        await user.keyboard('{ArrowRight}');
        await waitFor(() => expect(announcement()).toBe('Name width: 205 pixels'));
    });

    it('says it in the grid’s language', async () => {
        const user = userEvent.setup();
        renderGrid({}, { locale: pl });

        const handle = screen.getByRole('separator', { name: 'Zmień szerokość kolumny Name' });
        handle.focus();
        await user.keyboard('{ArrowRight}');
        await waitFor(() => expect(announcement()).toBe('Szerokość kolumny Name: 205 pikseli'));
    });
});

describe('resizing with a pointer', () => {
    it('paints the column during the drag without committing, and commits on release', () => {
        renderGrid();
        const handle = handleFor('Name');

        pointer(handle, 'pointerdown', { pointerId: 1, clientX: 100 });
        pointer(handle, 'pointermove', { pointerId: 1, clientX: 160 });

        // The property has moved, so the browser has repainted the column...
        expect(table().style.getPropertyValue(columnWidthProperty('name'))).toBe('260px');
        // ...and React has not been told, so no cell has re-rendered.
        expect(handle).toHaveAttribute('aria-valuenow', '200');

        pointer(handle, 'pointerup', { pointerId: 1, clientX: 160 });
        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '260');
    });

    it('clamps a drag past the floor', () => {
        renderGrid();
        const handle = handleFor('Name');

        pointer(handle, 'pointerdown', { pointerId: 1, clientX: 300 });
        pointer(handle, 'pointermove', { pointerId: 1, clientX: 0 });
        pointer(handle, 'pointerup', { pointerId: 1, clientX: 0 });

        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '50');
    });

    // The column has been at that width on screen; springing back reads as the grid refusing it.
    it('keeps the last width when the drag is cancelled', () => {
        renderGrid();
        const handle = handleFor('Name');

        pointer(handle, 'pointerdown', { pointerId: 1, clientX: 100 });
        pointer(handle, 'pointermove', { pointerId: 1, clientX: 140 });
        pointer(handle, 'pointercancel', { pointerId: 1, clientX: 140 });

        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '240');
    });

    it('ignores a pointer it never captured', () => {
        renderGrid();
        const handle = handleFor('Name');

        pointer(handle, 'pointerdown', { pointerId: 1, clientX: 100 });
        pointer(handle, 'pointermove', { pointerId: 9, clientX: 400 });
        pointer(handle, 'pointerup', { pointerId: 1, clientX: 100 });

        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '200');
    });
});

describe('the column picker', () => {
    it('is a menu of checkable columns, including the ones that may not be hidden', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        const items = within(menu).getAllByRole('menuitemcheckbox');
        expect(items.map((item) => item.textContent)).toEqual(['Name', 'Department', 'Salary', 'Started']);
        for (const item of items) expect(item).toHaveAttribute('aria-checked', 'true');

        // Locked rather than left out: a reader looking for a column they can see has to find it.
        expect(within(menu).getByRole('menuitemcheckbox', { name: 'Name' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('hides a column, and says so', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Department' }));

        await waitFor(() => expect(headerNames()).not.toContain('Department'));
        expect(announcement()).toBe('Department hidden');
        expect(within(menu).getByRole('menuitemcheckbox', { name: 'Department' })).toHaveAttribute('aria-checked', 'false');
    });

    it('refuses to hide a column that declared itself unhideable', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Name' }));

        expect(headerNames().some((name) => name.includes('Name'))).toBe(true);
    });

    it('brings every column back with "show all"', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Department' }));
        await waitFor(() => expect(headerNames()).not.toContain('Department'));

        await user.click(within(menu).getByRole('menuitem', { name: 'Show all columns' }));
        await waitFor(() => expect(headerNames().some((name) => name.includes('Department'))).toBe(true));
    });

    it('puts the widths and the pinning back with "reset layout", and returns focus', async () => {
        const user = userEvent.setup();
        renderGrid();

        handleFor('Name').focus();
        await user.keyboard('{ArrowRight}');
        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '205');

        const menu = await openPicker(user);
        await user.click(within(menu).getByRole('menuitem', { name: 'Reset layout' }));

        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '200');
        expect(screen.getByRole('button', { name: 'Columns' })).toHaveFocus();
    });

    it('closes on Escape without changing anything', async () => {
        const user = userEvent.setup();
        renderGrid();

        await openPicker(user);
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('menu', { name: 'Columns' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Columns' })).toHaveFocus();
    });

    it('is not rendered when the add-on was told not to', () => {
        renderGrid({ picker: false });
        expect(screen.queryByRole('button', { name: 'Columns' })).not.toBeInTheDocument();
    });
});

describe('a hidden column and the engine', () => {
    /** A format that keeps the table it was handed instead of writing a file. */
    const captureFormat = (captured: string[][]) => ({
        id: 'test:capture',
        label: 'Capture',
        serialize: ({ table }: { table: { columns: readonly { header: string }[] } }) => {
            captured.push(table.columns.map((column) => column.header));
        },
    });

    // Hiding through `configure` rather than by filtering the rendered list is the whole reason the
    // add-on touches the engine at all: an export is of the grid the reader is looking at, and a
    // column they cannot see is not part of it.
    it('is left out of an export', async () => {
        const captured: string[][] = [];
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={columns}
                data={people}
                pageSize={10}
                addons={[
                    columnLayout<Person>(),
                    exportMenu<Person>({ formats: [captureFormat(captured) as never], scope: 'page' }),
                ]}
            />,
        );

        const menu = await openPicker(user);
        await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Department' }));
        await waitFor(() => expect(headerNames()).not.toContain('Department'));

        await user.click(screen.getByRole('button', { name: 'Export' }));
        await user.click(screen.getByRole('menuitem', { name: 'Capture' }));

        await waitFor(() => expect(captured).toHaveLength(1));
        expect(captured[0]).toEqual(['Name', 'Salary', 'Started']);
    });

    // `hidden` is about what is rendered and what is exported; `searchable` is the switch for
    // search, and a column hidden from view is not a column nobody wants found. Asserted so that a
    // change to either one has to be a decision rather than an accident.
    it('is still reached by global search, which `searchable` is the switch for', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={columns}
                data={people}
                pageSize={10}
                addons={[search<Person>(), columnLayout<Person>()]}
            />,
        );

        await user.type(screen.getByRole('searchbox'), 'Research');
        await waitFor(() => expect(screen.getAllByRole('row').length).toBe(4));

        const menu = await openPicker(user);
        await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Department' }));
        await waitFor(() => expect(headerNames()).not.toContain('Department'));

        expect(screen.getAllByRole('row').length).toBe(4);
    });
});

describe('pinning', () => {
    const pinned: readonly GridwrightColumn<Person>[] = [
        { id: 'name', header: 'Name', width: 200, layout: { pinned: 'left' } },
        { id: 'department', header: 'Department' },
        { id: 'startedOn', header: 'Started' },
        { id: 'salary', header: 'Salary', width: 120, layout: { pinned: 'right' } },
    ];

    const renderPinned = (props: Record<string, unknown> = {}) =>
        render(
            <Gridwright<Person>
                columns={pinned}
                data={people}
                pageSize={10}
                addons={[columnLayout<Person>()]}
                {...props}
            />,
        );

    it('makes a pinned header and its cells sticky at a computed offset', () => {
        renderPinned();

        const header = screen.getByRole('columnheader', { name: /Name/ });
        expect(header).toHaveAttribute('data-pinned', 'left');
        expect(header).toHaveStyle({ position: 'sticky', insetInlineStart: '0px' });

        const cell = within(screen.getAllByRole('row')[1]!).getAllByRole('cell')[0]!;
        expect(cell).toHaveAttribute('data-pinned', 'left');
        expect(cell).toHaveClass('gw-cell--pinned', 'gw-cell--pinned-left-last');
    });

    it('measures a right-pinned column from the end', () => {
        renderPinned();

        const header = screen.getByRole('columnheader', { name: /Salary/ });
        expect(header).toHaveAttribute('data-pinned', 'right');
        expect(header).toHaveStyle({ insetInlineEnd: '0px' });
        expect(header).toHaveClass('gw-cell--pinned-right-first');
    });

    it('leaves the scrolling columns alone', () => {
        renderPinned();
        expect(screen.getByRole('columnheader', { name: /Department/ })).not.toHaveAttribute('data-pinned');
    });

    // Reached through `extraHeaderAttributes` and `extraCellAttributes`, which every add-on has.
    it('takes another add-on’s checkbox column onto the edge with it', () => {
        renderPinned({ selectionMode: 'multiple' });

        const first = screen.getAllByRole('columnheader')[0]!;
        expect(first).toHaveAttribute('data-pinned', 'left');
        expect(first).toHaveStyle({ insetInlineStart: '0px' });

        // The checkbox is 48 wide by default, so the name it belongs to starts after it.
        expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveStyle({ insetInlineStart: '48px' });
    });

    it('pins nothing extra when no data column is pinned', () => {
        renderGrid({}, { selectionMode: 'multiple' });
        expect(screen.getAllByRole('columnheader')[0]!).not.toHaveAttribute('data-pinned');
    });

    it('groups the picker the way the table paints it', async () => {
        const user = userEvent.setup();
        renderPinned();

        const menu = await openPicker(user);
        expect(within(menu).getByRole('group', { name: 'Pinned to start' })).toBeInTheDocument();
        expect(within(menu).getByRole('group', { name: 'Pinned to end' })).toBeInTheDocument();
    });
});

describe('a layout that is saved and restored', () => {
    it('starts from what it was given', () => {
        renderGrid({ initial: { widths: { name: 320 }, pinned: { department: 'left' }, hidden: { startedOn: true } } });

        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '320');
        expect(screen.getByRole('columnheader', { name: /Department/ })).toHaveAttribute('data-pinned', 'left');
        expect(headerNames().some((name) => name.includes('Started'))).toBe(false);
    });

    // A handler that writes to storage must not overwrite a saved layout on every page load.
    it('says nothing on mount, and reports every change after it', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        renderGrid({ onChange });

        expect(onChange).not.toHaveBeenCalled();

        handleFor('Name').focus();
        await user.keyboard('{ArrowRight}');

        await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        expect(onChange.mock.calls[0]![0]).toEqual({ widths: { name: 205 }, pinned: {}, hidden: {} });
    });

    it('reports a layout that survives a round trip through JSON', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        renderGrid({ onChange, initial: { pinned: { name: 'left' } } });

        const menu = await openPicker(user);
        await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Department' }));

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const reported = onChange.mock.calls.at(-1)![0];
        expect(JSON.parse(JSON.stringify(reported))).toEqual(reported);
    });
});

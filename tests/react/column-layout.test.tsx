import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { columnLayout } from '../../src/react/layout/addon';
import { search } from '../../src/react/core-addons';
import { exportMenu } from '../../src/react/export/addon';
import { columnWidthProperty } from '../../src/react/layout/layout';
import { pl } from '../../src/locales/pl';
import { useColumnLayout } from '../../src/react/layout/context';
import type {
    ColumnLayoutChange,
    ColumnLayoutController,
    ColumnLayoutOptions,
    ColumnLayoutState,
} from '../../src/react/layout/types';
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

/** The visibility checkboxes, which share a role with the pin toggles beside them. */
const visibilityItems = (menu: HTMLElement): HTMLElement[] =>
    within(menu)
        .getAllByRole('menuitemcheckbox')
        .filter((item) => !/^Pin /.test(item.getAttribute('aria-label') ?? ''));

const pinToggle = (menu: HTMLElement, column: string, side: 'start' | 'end'): HTMLElement =>
    within(menu).getByRole('menuitemcheckbox', { name: `Pin ${column} to the ${side}` });

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
        const items = visibilityItems(menu);
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
        expect(onChange.mock.calls[0]![0]).toEqual({ widths: { name: 205 }, pinned: {}, hidden: {}, order: [] });
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

// --- reordering ---------------------------------------------------------------------------------

/**
 * jsdom implements the drag events but not the data transfer behind them, so each gesture is built
 * here with the one object the handlers actually touch. The gesture itself is verified in a real
 * browser at stage 7; what these assert is the state it produces.
 */
const dragTransfer = () => ({ effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: vi.fn() });

const dragColumn = (from: HTMLElement, to: HTMLElement): void => {
    const dataTransfer = dragTransfer();
    fireEvent.dragStart(from, { dataTransfer });
    fireEvent.dragOver(to, { dataTransfer });
    fireEvent.drop(to, { dataTransfer });
    fireEvent.dragEnd(from, { dataTransfer });
};

const headerFor = (name: string | RegExp): HTMLElement => screen.getByRole('columnheader', { name });

const columnOrder = (): string[] =>
    screen.getAllByRole('columnheader').map((cell) => cell.getAttribute('data-column-id') ?? '');

describe('reordering by drag', () => {
    it('marks a movable header as a drag source and advertises the shortcut', () => {
        renderGrid();

        const header = headerFor(/Department/);
        expect(header).toHaveAttribute('draggable', 'true');
        expect(header).toHaveAttribute('data-movable', 'true');
        expect(header).toHaveAttribute('aria-keyshortcuts', 'Control+ArrowLeft Control+ArrowRight');
    });

    it('moves the column to where it was dropped', async () => {
        renderGrid();
        expect(columnOrder()).toEqual(['name', 'department', 'salary', 'startedOn']);

        dragColumn(headerFor(/Started/), headerFor(/Department/));

        await waitFor(() => expect(columnOrder()).toEqual(['name', 'startedOn', 'department', 'salary']));
    });

    it('shows which edge the column will land against while the drag is in flight', () => {
        renderGrid();
        const dataTransfer = dragTransfer();

        fireEvent.dragStart(headerFor(/^Name/), { dataTransfer });
        fireEvent.dragOver(headerFor(/Salary/), { dataTransfer });

        expect(headerFor(/^Name/)).toHaveAttribute('data-dragging', 'true');
        // Name is before Salary, so it lands against Salary's far edge.
        expect(headerFor(/Salary/)).toHaveAttribute('data-drop-target', 'end');

        fireEvent.dragEnd(headerFor(/^Name/), { dataTransfer });
        expect(headerFor(/^Name/)).not.toHaveAttribute('data-dragging');
    });

    it('changes nothing when a drag is abandoned', () => {
        renderGrid();
        const dataTransfer = dragTransfer();

        fireEvent.dragStart(headerFor(/^Name/), { dataTransfer });
        fireEvent.dragOver(headerFor(/Salary/), { dataTransfer });
        // No drop: Escape, or a release over nothing, both arrive as dragend.
        fireEvent.dragEnd(headerFor(/^Name/), { dataTransfer });

        expect(columnOrder()).toEqual(['name', 'department', 'salary', 'startedOn']);
    });

    // A column id dropped into whatever text field happens to be on the page is not something
    // anyone asked for, so the drag carries a private type and never `text/plain`.
    it('puts the column id on a private transfer type only', () => {
        renderGrid();
        const dataTransfer = dragTransfer();

        fireEvent.dragStart(headerFor(/Department/), { dataTransfer });

        expect(dataTransfer.setData).toHaveBeenCalledTimes(1);
        expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-gridwright-column', 'department');
    });
});

describe('reordering by keyboard', () => {
    const move = async (user: ReturnType<typeof userEvent.setup>, key: string) => {
        await user.keyboard(`{Control>}{${key}}{/Control}`);
    };

    it('moves the column with Ctrl and an arrow, from the header that is already focused', async () => {
        const user = userEvent.setup();
        renderGrid();

        within(headerFor(/^Name/)).getByRole('button', { name: /Name/ }).focus();
        await move(user, 'ArrowRight');

        await waitFor(() => expect(columnOrder()).toEqual(['department', 'name', 'salary', 'startedOn']));

        await move(user, 'ArrowLeft');
        await waitFor(() => expect(columnOrder()).toEqual(['name', 'department', 'salary', 'startedOn']));
    });

    it('does nothing at the ends', async () => {
        const user = userEvent.setup();
        renderGrid();

        within(headerFor(/^Name/)).getByRole('button', { name: /Name/ }).focus();
        await move(user, 'ArrowLeft');

        expect(columnOrder()).toEqual(['name', 'department', 'salary', 'startedOn']);
    });

    // The plan's first risk: a contributed handler must not replace what the sorting add-on put on
    // the same cell. A header that reorders still sorts.
    it('leaves sorting working on the same header', async () => {
        const user = userEvent.setup();
        renderGrid();

        within(headerFor(/Department/)).getByRole('button', { name: /Department/ }).focus();
        await move(user, 'ArrowLeft');
        await waitFor(() => expect(columnOrder()[0]).toBe('department'));

        await user.click(within(headerFor(/Department/)).getByRole('button', { name: /Department/ }));
        await waitFor(() => expect(headerFor(/Department/)).toHaveAttribute('aria-sort', 'ascending'));
    });

    // The modifier is a keydown of its own, before any arrow. A guard on the modifier alone fires
    // on Control itself, which would move a column nobody asked to move.
    it('ignores the modifier on its own', async () => {
        const user = userEvent.setup();
        renderGrid();

        within(headerFor(/^Name/)).getByRole('button', { name: /Name/ }).focus();
        await user.keyboard('{Control>}{/Control}');

        expect(columnOrder()).toEqual(['name', 'department', 'salary', 'startedOn']);
    });
});

describe('a column that may not move', () => {
    const locked: readonly GridwrightColumn<Person>[] = [
        { id: 'name', header: 'Name', layout: { movable: false } },
        { id: 'department', header: 'Department' },
        { id: 'salary', header: 'Salary' },
    ];

    const renderLocked = (options: ColumnLayoutOptions = {}) =>
        render(<Gridwright<Person> columns={locked} data={people} addons={[columnLayout<Person>(options)]} />);

    it('is not a drag source', () => {
        renderLocked();
        expect(headerFor(/^Name/)).not.toHaveAttribute('draggable');
        expect(headerFor(/Department/)).toHaveAttribute('draggable', 'true');
    });

    it('refuses to move itself', async () => {
        const user = userEvent.setup();
        renderLocked();

        within(headerFor(/^Name/)).getByRole('button', { name: /Name/ }).focus();
        await user.keyboard('{Control>}{ArrowRight}{/Control}');

        expect(columnOrder()).toEqual(['name', 'department', 'salary']);
    });

    // A wall, not just an immovable block: a column declared first stays first, or locking it
    // would mean nothing.
    it('cannot be moved across', () => {
        renderLocked();
        dragColumn(headerFor(/Salary/), headerFor(/^Name/));
        expect(columnOrder()).toEqual(['name', 'department', 'salary']);
    });

    it('is how the whole add-on switches reordering off', () => {
        renderGrid({ reorderable: false });
        for (const header of screen.getAllByRole('columnheader')) {
            expect(header).not.toHaveAttribute('draggable');
            expect(header).not.toHaveAttribute('aria-keyshortcuts');
        }
    });
});

describe('reordering and the rest of the layout', () => {
    it('does not let a drag from the resize handle reorder', () => {
        renderGrid();
        expect(handleFor('Name')).toHaveAttribute('draggable', 'false');

        pointer(handleFor('Name'), 'pointerdown', { pointerId: 1, clientX: 100 });
        pointer(handleFor('Name'), 'pointermove', { pointerId: 1, clientX: 150 });
        pointer(handleFor('Name'), 'pointerup', { pointerId: 1, clientX: 150 });

        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '250');
        expect(columnOrder()).toEqual(['name', 'department', 'salary', 'startedOn']);
    });

    // A column painted between two frozen ones that scrolls away is not something a reader can have
    // asked for by dropping it there.
    it('pins a column dropped inside a pinned run', async () => {
        render(
            <Gridwright<Person>
                columns={[
                    { id: 'name', header: 'Name', width: 100, layout: { pinned: 'left' } },
                    { id: 'department', header: 'Department', width: 100, layout: { pinned: 'left' } },
                    { id: 'salary', header: 'Salary', width: 100 },
                    { id: 'startedOn', header: 'Started', width: 100 },
                ]}
                data={people}
                addons={[columnLayout<Person>()]}
            />,
        );

        expect(headerFor(/Salary/)).not.toHaveAttribute('data-pinned');

        // Dropped on Department, which puts Salary between two left-pinned columns.
        dragColumn(headerFor(/Salary/), headerFor(/Department/));

        await waitFor(() => expect(columnOrder()).toEqual(['name', 'salary', 'department', 'startedOn']));
        expect(headerFor(/Salary/)).toHaveAttribute('data-pinned', 'left');
    });

    it('says where the column landed', async () => {
        const user = userEvent.setup();
        renderGrid();

        within(headerFor(/^Name/)).getByRole('button', { name: /Name/ }).focus();
        await user.keyboard('{Control>}{ArrowRight}{/Control}');

        await waitFor(() => expect(announcement()).toBe('Name moved to position 2 of 4'));
    });

    it('reports the order through onChange, and restores it from initial', async () => {
        const onChange = vi.fn();
        const { unmount } = renderGrid({ onChange });

        dragColumn(headerFor(/Started/), headerFor(/^Name/));
        await waitFor(() => expect(onChange).toHaveBeenCalled());

        const reported = onChange.mock.calls.at(-1)![0];
        expect(reported.order).toEqual(['startedOn', 'name', 'department', 'salary']);
        expect(JSON.parse(JSON.stringify(reported))).toEqual(reported);
        unmount();

        // And back in through the door it came out of.
        renderGrid({ initial: reported });
        expect(columnOrder()).toEqual(['startedOn', 'name', 'department', 'salary']);
    });

    it('takes the export with it', async () => {
        const captured: string[][] = [];
        const user = userEvent.setup();
        render(
            <Gridwright<Person>
                columns={columns}
                data={people}
                pageSize={10}
                addons={[
                    columnLayout<Person>(),
                    exportMenu<Person>({
                        formats: [
                            {
                                id: 'test:capture',
                                label: 'Capture',
                                serialize: ({ table }: { table: { columns: readonly { header: string }[] } }) => {
                                    captured.push(table.columns.map((column) => column.header));
                                },
                            } as never,
                        ],
                        scope: 'page',
                    }),
                ]}
            />,
        );

        dragColumn(headerFor(/Salary/), headerFor(/^Name/));
        await waitFor(() => expect(columnOrder()[0]).toBe('salary'));

        await user.click(screen.getByRole('button', { name: 'Export' }));
        await user.click(screen.getByRole('menuitem', { name: 'Capture' }));

        await waitFor(() => expect(captured).toHaveLength(1));
        expect(captured[0]).toEqual(['Salary', 'Name', 'Department', 'Started']);
    });
});

describe('pinning from the picker', () => {
    it('offers both edges for every column, unchecked while nothing is pinned', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        expect(pinToggle(menu, 'Department', 'start')).toHaveAttribute('aria-checked', 'false');
        expect(pinToggle(menu, 'Department', 'end')).toHaveAttribute('aria-checked', 'false');
    });

    // "Pinned to the start" means at the start. A column frozen in the middle of the row is not
    // what the reader asked for by pressing it.
    it('pins a column and brings it to that edge', async () => {
        const user = userEvent.setup();
        renderGrid();
        expect(columnOrder()).toEqual(['name', 'department', 'salary', 'startedOn']);

        const menu = await openPicker(user);
        await user.click(pinToggle(menu, 'Salary', 'start'));

        await waitFor(() => expect(columnOrder()).toEqual(['salary', 'name', 'department', 'startedOn']));
        expect(headerFor(/Salary/)).toHaveAttribute('data-pinned', 'left');
        expect(headerFor(/Salary/)).toHaveStyle({ insetInlineStart: '0px' });
    });

    it('stacks a second pinned column after the first', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        await user.click(pinToggle(menu, 'Salary', 'start'));
        await waitFor(() => expect(columnOrder()[0]).toBe('salary'));
        await user.click(pinToggle(menu, 'Started', 'start'));

        await waitFor(() => expect(columnOrder()).toEqual(['salary', 'startedOn', 'name', 'department']));
        // Salary is 120 wide, so the second pinned column starts after it.
        expect(headerFor(/Started/)).toHaveStyle({ insetInlineStart: '120px' });
    });

    it('pins to the end from the other toggle', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        await user.click(pinToggle(menu, 'Name', 'end'));

        await waitFor(() => expect(columnOrder()).toEqual(['department', 'salary', 'startedOn', 'name']));
        expect(headerFor(/^Name/)).toHaveAttribute('data-pinned', 'right');
    });

    // Pressing the edge a column is already pinned to is how it comes off, and it must not be left
    // sitting unpinned between two frozen columns.
    it('unpins on a second press, clear of the run it was in', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        await user.click(pinToggle(menu, 'Salary', 'start'));
        await waitFor(() => expect(headerFor(/Salary/)).toHaveAttribute('data-pinned', 'left'));

        await user.click(pinToggle(menu, 'Salary', 'start'));

        await waitFor(() => expect(headerFor(/Salary/)).not.toHaveAttribute('data-pinned'));
        expect(pinToggle(menu, 'Salary', 'start')).toHaveAttribute('aria-checked', 'false');
    });

    it('moves the column between the picker groups it is listed under', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        expect(within(menu).queryByRole('group', { name: 'Pinned to start' })).not.toBeInTheDocument();

        await user.click(pinToggle(menu, 'Department', 'start'));

        await waitFor(() => {
            const group = within(menu).getByRole('group', { name: 'Pinned to start' });
            expect(within(group).getByRole('menuitemcheckbox', { name: 'Department' })).toBeInTheDocument();
        });
    });

    it('reports the pin and the order it caused through onChange', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        renderGrid({ onChange });

        const menu = await openPicker(user);
        await user.click(pinToggle(menu, 'Salary', 'start'));

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const reported = onChange.mock.calls.at(-1)![0];
        expect(reported.pinned).toEqual({ salary: 'left' });
        expect(reported.order).toEqual(['salary', 'name', 'department', 'startedOn']);
    });

    it('is reachable with the arrow keys like every other item in the menu', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        const first = visibilityItems(menu)[0]!;
        first.focus();
        await user.keyboard('{ArrowDown}');

        expect(pinToggle(menu, 'Name', 'start')).toHaveFocus();
    });
});

describe('refusing a layout change', () => {
    /** Records what it was asked, and refuses whatever the test says to refuse. */
    const guard = (refuse: (change: ColumnLayoutChange) => boolean) => {
        const seen: ColumnLayoutChange[] = [];
        const canChange = (change: ColumnLayoutChange, layout: ColumnLayoutState) => {
            seen.push(change);
            void layout;
            return !refuse(change);
        };
        return { seen, canChange };
    };

    it('is asked before a width is committed, and refuses it', async () => {
        const user = userEvent.setup();
        const { seen, canChange } = guard((change) => change.type === 'width');
        renderGrid({ canChange });

        handleFor('Name').focus();
        await user.keyboard('{ArrowRight}');

        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '200');
        // Asked with the width it would have committed, already clamped.
        expect(seen).toEqual([{ type: 'width', columnId: 'name', width: 205 }]);
    });

    it('is asked before a move, and refuses it', async () => {
        const user = userEvent.setup();
        const { seen, canChange } = guard((change) => change.type === 'move');
        renderGrid({ canChange });

        within(headerFor(/^Name/)).getByRole('button', { name: /Name/ }).focus();
        await user.keyboard('{Control>}{ArrowRight}{/Control}');

        expect(columnOrder()).toEqual(['name', 'department', 'salary', 'startedOn']);
        expect(seen).toEqual([{ type: 'move', columnId: 'name', toIndex: 1 }]);
    });

    it('refuses a drop as well as a keyboard move, because both go through the controller', () => {
        const { canChange } = guard((change) => change.type === 'move');
        renderGrid({ canChange });

        dragColumn(headerFor(/Started/), headerFor(/^Name/));

        expect(columnOrder()).toEqual(['name', 'department', 'salary', 'startedOn']);
    });

    it('is asked before a pin, and disables the toggle that would be refused', async () => {
        const user = userEvent.setup();
        const { canChange } = guard((change) => change.type === 'pin' && change.columnId === 'salary');
        renderGrid({ canChange });

        const menu = await openPicker(user);
        expect(pinToggle(menu, 'Salary', 'start')).toHaveAttribute('aria-disabled', 'true');
        expect(pinToggle(menu, 'Department', 'start')).not.toHaveAttribute('aria-disabled');

        await user.click(pinToggle(menu, 'Salary', 'start'));
        expect(headerFor(/Salary/)).not.toHaveAttribute('data-pinned');

        // The one it allows still works, so the guard narrowed rather than switched pinning off.
        await user.click(pinToggle(menu, 'Department', 'start'));
        await waitFor(() => expect(headerFor(/Department/)).toHaveAttribute('data-pinned', 'left'));
    });

    it('is asked before a visibility change, and disables the item that would be refused', async () => {
        const user = userEvent.setup();
        const { canChange } = guard((change) => change.type === 'visibility' && change.columnId === 'salary');
        renderGrid({ canChange });

        const menu = await openPicker(user);
        const salary = within(menu).getByRole('menuitemcheckbox', { name: 'Salary' });
        expect(salary).toHaveAttribute('aria-disabled', 'true');

        await user.click(salary);
        expect(headerNames().some((name) => name.includes('Salary'))).toBe(true);
    });

    it('is asked before "show all" and "reset"', async () => {
        const user = userEvent.setup();
        const { seen, canChange } = guard((change) => change.type === 'reset');
        renderGrid({ canChange });

        handleFor('Name').focus();
        await user.keyboard('{ArrowRight}');
        await waitFor(() => expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '205'));

        const menu = await openPicker(user);
        await user.click(within(menu).getByRole('menuitem', { name: 'Show all columns' }));
        await user.click(within(menu).getByRole('menuitem', { name: 'Reset layout' }));

        expect(seen.map((change) => change.type)).toContain('showAll');
        expect(seen.map((change) => change.type)).toContain('reset');
        // Reset was refused, so the width it would have undone is still there.
        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '205');
    });

    // The add-on's own rules are the floor. A guard is a ceiling, and a ceiling cannot raise a floor.
    it('cannot allow what the add-on itself refuses', async () => {
        const user = userEvent.setup();
        renderGrid({ canChange: () => true });

        const menu = await openPicker(user);
        // `name` declares `hideable: false`.
        const name = within(menu).getByRole('menuitemcheckbox', { name: 'Name' });
        expect(name).toHaveAttribute('aria-disabled', 'true');

        await user.click(name);
        expect(headerNames().some((header) => header.includes('Name'))).toBe(true);
    });

    it('sees the whole layout, so a rule can be about more than one column', async () => {
        const user = userEvent.setup();
        // At most one pinned column at a time.
        const canChange = (change: ColumnLayoutChange, layout: ColumnLayoutState) =>
            change.type !== 'pin' ||
            change.side === null ||
            Object.values(layout.pinned).filter(Boolean).length < 1;

        renderGrid({ canChange });
        const menu = await openPicker(user);

        await user.click(pinToggle(menu, 'Department', 'start'));
        await waitFor(() => expect(headerFor(/Department/)).toHaveAttribute('data-pinned', 'left'));

        // The budget is spent, so the second one is refused and says so before it is pressed.
        await waitFor(() => expect(pinToggle(menu, 'Salary', 'start')).toHaveAttribute('aria-disabled', 'true'));
        await user.click(pinToggle(menu, 'Salary', 'start'));
        expect(headerFor(/Salary/)).not.toHaveAttribute('data-pinned');
    });

    it('answers the same question through allows as it enforces on commit', async () => {
        const user = userEvent.setup();
        let controller: ColumnLayoutController | null = null;

        function Probe() {
            controller = useColumnLayout();
            return null;
        }

        render(
            <Gridwright<Person>
                columns={columns}
                data={people}
                addons={[
                    columnLayout<Person>({ canChange: (change) => change.type !== 'width' }),
                    { name: 'test:probe', setup: () => ({ toolbar: () => <Probe /> }) },
                ]}
            />,
        );

        await waitFor(() => expect(controller).not.toBeNull());
        expect(controller!.allows({ type: 'width', columnId: 'name', width: 300 })).toBe(false);
        expect(controller!.allows({ type: 'pin', columnId: 'name', side: 'left' })).toBe(true);
        // And still false for what the add-on itself refuses.
        expect(controller!.allows({ type: 'visibility', columnId: 'name', hidden: true })).toBe(false);
        void user;
    });

    // A rule that is silently not running is worse than one that is not there.
    it('allows the change and reports it when the guard throws', async () => {
        const user = userEvent.setup();
        const errors: unknown[] = [];
        const spy = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args));

        renderGrid({
            canChange: () => {
                throw new Error('policy service is down');
            },
        });

        handleFor('Name').focus();
        await user.keyboard('{ArrowRight}');

        expect(handleFor('Name')).toHaveAttribute('aria-valuenow', '205');
        expect(errors.length).toBeGreaterThan(0);
        spy.mockRestore();
    });

    it('changes nothing for a grid that passes no guard', async () => {
        const user = userEvent.setup();
        renderGrid();

        const menu = await openPicker(user);
        expect(pinToggle(menu, 'Salary', 'start')).not.toHaveAttribute('aria-disabled');
        await user.click(pinToggle(menu, 'Salary', 'start'));
        await waitFor(() => expect(headerFor(/Salary/)).toHaveAttribute('data-pinned', 'left'));
    });
});

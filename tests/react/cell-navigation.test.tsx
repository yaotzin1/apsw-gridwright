import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { cellNavigation } from '../../src/react/navigation';
import { treeData } from '../../src/react/tree';
import { virtualRows } from '../../src/react/virtual/addon';
import type { CellNavigationOptions } from '../../src/react/navigation/types';
import type { GridwrightColumn } from '../../src/react/types';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

/**
 * The cursor as a keyboard reaches it: Tab in, arrows across, and the accessible tree read back.
 *
 * Nothing here asserts a class name. What matters is which cell is focused and which single cell is
 * tabbable, and both are observable through the DOM a screen reader sees.
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

/** Every data cell, in painting order. */
const cells = (): HTMLElement[] => screen.getAllByRole('cell');
const tabbable = (): HTMLElement[] => cells().filter((cell) => cell.getAttribute('tabindex') === '0');
const focused = (): string | null => (document.activeElement as HTMLElement | null)?.textContent ?? null;

describe('cellNavigation(): the roving tab stop', () => {
    it('makes exactly one cell tabbable, and the rest reachable only by arrow', async () => {
        renderGrid();

        await waitFor(() => expect(tabbable()).toHaveLength(1));
        expect(tabbable()[0]).toHaveTextContent('Ada Lovelace');
        // Every other data cell is out of the Tab order, which is what makes the grid one Tab stop.
        expect(cells().every((cell) => cell.getAttribute('tabindex') === '0' || cell.getAttribute('tabindex') === '-1')).toBe(true);
    });

    it('moves across columns and down rows with the arrow keys', async () => {
        const user = userEvent.setup();
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveLength(1));

        tabbable()[0]!.focus();
        await user.keyboard('{ArrowRight}');
        expect(focused()).toBe('Engineering');

        await user.keyboard('{ArrowDown}');
        expect(focused()).toBe('Engineering');
        await user.keyboard('{ArrowRight}');
        expect(focused()).toBe('140000');

        await user.keyboard('{ArrowLeft}{ArrowUp}');
        expect(focused()).toBe('Engineering');
        // And the tab stop followed the cursor rather than staying where it started.
        await waitFor(() => expect(tabbable()[0]).toHaveTextContent('Engineering'));
    });

    it('stops at the edges instead of wrapping', async () => {
        const user = userEvent.setup();
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveLength(1));

        tabbable()[0]!.focus();
        await user.keyboard('{ArrowLeft}{ArrowUp}');
        // Wrapping to the last column of the previous row is a cursor the reader did not ask for.
        expect(focused()).toBe('Ada Lovelace');
    });

    it('Home and End go to the first and last column of the row', async () => {
        const user = userEvent.setup();
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveLength(1));

        tabbable()[0]!.focus();
        await user.keyboard('{End}');
        expect(focused()).toBe('120000');
        await user.keyboard('{Home}');
        expect(focused()).toBe('Ada Lovelace');
    });

    it('Ctrl+End goes to the last loaded row, not the last row of the result set', async () => {
        const user = userEvent.setup();
        // Seven people, four per page: the result set is longer than what is loaded.
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveLength(1));

        tabbable()[0]!.focus();
        await user.keyboard('{Control>}{End}{/Control}');

        // The fourth row's last column -- the end of the page, not of the seven.
        expect(focused()).toBe('95000');
        expect(screen.getAllByRole('row')).toHaveLength(5); // header + 4
    });

    it('Ctrl+Home returns to the first cell', async () => {
        const user = userEvent.setup();
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveLength(1));

        tabbable()[0]!.focus();
        await user.keyboard('{Control>}{End}{/Control}');
        expect(focused()).toBe('95000');
        await user.keyboard('{Control>}{Home}{/Control}');
        expect(focused()).toBe('Ada Lovelace');
    });

    it('PageDown moves by a page of rows and clamps at the last loaded one', async () => {
        const user = userEvent.setup();
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveLength(1));

        tabbable()[0]!.focus();
        await user.keyboard('{PageDown}');
        expect(focused()).toBe('Mary Jackson');
        // It does not fetch the next page: the row count is unchanged.
        expect(screen.getAllByRole('row')).toHaveLength(5);
    });

    it('reports a move through onActiveCellChange, but never on mount', async () => {
        const user = userEvent.setup();
        const onActiveCellChange = vi.fn();
        renderGrid({ onActiveCellChange });

        await waitFor(() => expect(tabbable()).toHaveLength(1));
        expect(onActiveCellChange).not.toHaveBeenCalled();

        tabbable()[0]!.focus();
        await user.keyboard('{ArrowRight}');
        await waitFor(() => expect(onActiveCellChange).toHaveBeenCalledWith({ rowId: 1, columnId: 'department' }));
    });

    it('moves the cursor when a cell is clicked, so focus and the tab stop agree', async () => {
        const user = userEvent.setup();
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveLength(1));

        const salaryOfGrace = cells().find((cell) => cell.textContent === '140000')!;
        await user.click(salaryOfGrace);

        await waitFor(() => expect(tabbable()[0]).toHaveTextContent('140000'));
    });

    // Found in the browser, not here: holding an arrow key delivers several keydowns before React
    // re-renders, and a handler reading the rendered cursor computed every one of them from the same
    // cell -- so holding ArrowDown moved one row and stopped. `userEvent` awaits each key, which is
    // exactly why the other tests never saw it.
    it('applies every key of a repeat, not just the last', async () => {
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveLength(1));

        const first = tabbable()[0]!;
        first.focus();
        await waitFor(() => expect(document.activeElement).toBe(first));

        // Three in one task, as key repeat delivers them.
        for (let i = 0; i < 3; i += 1) {
            fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
        }

        await waitFor(() => expect(focused()).toBe('Mary Jackson'));
    });

    it('applies a repeat across columns too', async () => {
        renderGrid();
        await waitFor(() => expect(tabbable()).toHaveLength(1));

        const first = tabbable()[0]!;
        first.focus();
        await waitFor(() => expect(document.activeElement).toBe(first));

        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });

        await waitFor(() => expect(focused()).toBe('120000'));
    });

    it('changes nothing for a grid that does not list the add-on', () => {
        render(<Gridwright<Person> columns={columns} data={people} pageSize={4} aria-label="People" />);

        expect(screen.getAllByRole('cell').every((cell) => !cell.hasAttribute('tabindex'))).toBe(true);
    });
});

describe('cellNavigation(): composing with other add-ons', () => {
    it('reaches the selection checkbox cell with ArrowLeft', async () => {
        const user = userEvent.setup();
        renderGrid({}, { selectionMode: 'multiple' });
        await waitFor(() => expect(tabbable().length).toBeGreaterThan(0));

        // The cursor starts on the checkbox column, because it is painted first.
        const first = tabbable()[0]!;
        expect(first.querySelector('input[type="checkbox"]')).not.toBeNull();

        await user.keyboard('{ArrowRight}');
        first.focus();
        await user.keyboard('{ArrowRight}');
        expect(focused()).toBe('Ada Lovelace');
        await user.keyboard('{ArrowLeft}');
        // Back onto the checkbox cell rather than stopping at the first data column.
        expect((document.activeElement as HTMLElement).querySelector('input[type="checkbox"]')).not.toBeNull();
    });

    it('leaves extra columns out when includeExtraColumns is false', async () => {
        const user = userEvent.setup();
        renderGrid({ includeExtraColumns: false }, { selectionMode: 'multiple' });
        await waitFor(() => expect(tabbable()).toHaveLength(1));

        expect(tabbable()[0]).toHaveTextContent('Ada Lovelace');
        tabbable()[0]!.focus();
        await user.keyboard('{ArrowLeft}');
        expect(focused()).toBe('Ada Lovelace');
    });

    it('does not steal arrow keys from an editor inside a cell', async () => {
        const user = userEvent.setup();
        const withInput: readonly GridwrightColumn<Person>[] = [
            { id: 'name', header: 'Name', cell: ({ value }) => <input defaultValue={String(value)} aria-label="Edit name" /> },
            { id: 'department', header: 'Department' },
        ];
        render(
            <Gridwright<Person>
                columns={withInput}
                data={people}
                pageSize={4}
                aria-label="People"
                addons={[cellNavigation<Person>()]}
            />,
        );

        const input = screen.getAllByLabelText('Edit name')[0]!;
        input.focus();
        await user.keyboard('{ArrowRight}');
        // The caret moved inside the input; the cursor did not move to the next column.
        expect(document.activeElement).toBe(input);
    });
});

describe('cellNavigation(): a windowed grid', () => {
    // AC-05: only the visible slice is in the DOM, so a cursor moved past the edge names a cell that
    // does not exist yet. The add-on scrolls the viewport so the row mounts and the focus lands.
    const many: readonly Person[] = Array.from({ length: 500 }, (_, index) => ({
        id: index + 1,
        name: `Person ${index + 1}`,
        department: 'Engineering',
        salary: 100_000 + index,
        startedOn: '2020-01-01',
        active: true,
    }));

    it('scrolls an unmounted row into the window and focuses it there', async () => {
        render(
            <Gridwright<Person>
                columns={columns}
                data={many}
                pageSize={500}
                aria-label="People"
                addons={[virtualRows<Person>({ rowHeight: 40, height: 200 }), cellNavigation<Person>()]}
            />,
        );

        await waitFor(() => expect(tabbable()).toHaveLength(1));
        const mounted = screen.getAllByRole('row').length;
        // Windowing is doing its job: nothing like 500 rows is in the document.
        expect(mounted).toBeLessThan(100);

        const first = tabbable()[0]!;
        first.focus();
        await waitFor(() => expect(document.activeElement).toBe(first));

        // Far past the mounted window in one move.
        for (let i = 0; i < 60; i += 1) {
            fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
        }

        // The defect this guards: with the cursor on an unmounted row, every rendered cell would be
        // tabIndex="-1" and the grid would have no tab stop at all -- a keyboard user could not get
        // into it until they scrolled back. The stop falls back to a rendered row instead.
        await waitFor(() => expect(tabbable()).toHaveLength(1));

        // The viewport was asked for the row the cursor reached: 60 rows down, at 40px each.
        // jsdom has no layout and assigning scrollTop fires no scroll event, so the window itself
        // does not move here -- what this asserts is that the add-on drives `scrollToIndex`, which
        // is the mechanism AC-05 names. The rest is browser behaviour.
        const wrapper = document.querySelector('.gw-table-wrapper') as HTMLElement;
        await waitFor(() => expect(wrapper.scrollTop).toBeGreaterThan(2_000));
    });

    it('keeps a tab stop on a rendered row while the cursor is scrolled out of view', async () => {
        render(
            <Gridwright<Person>
                columns={columns}
                data={many}
                pageSize={500}
                aria-label="People"
                addons={[virtualRows<Person>({ rowHeight: 40, height: 200 }), cellNavigation<Person>()]}
            />,
        );

        await waitFor(() => expect(tabbable()).toHaveLength(1));
        const first = tabbable()[0]!;
        first.focus();
        await waitFor(() => expect(document.activeElement).toBe(first));

        // Move to a column other than the first, then far out of the window.
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
        await waitFor(() => expect(focused()).toBe('Engineering'));
        for (let i = 0; i < 80; i += 1) {
            fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
        }

        // Exactly one tab stop, it is a rendered cell, and it kept the cursor's column.
        await waitFor(() => expect(tabbable()).toHaveLength(1));
        const stop = tabbable()[0]!;
        expect(document.body.contains(stop)).toBe(true);
        expect(stop).toHaveAttribute('data-column-id', 'department');
    });
});

describe('cellNavigation(): a tree', () => {
    interface Node {
        id: number;
        name: string;
        children?: Node[];
    }

    const tree: readonly Node[] = [
        { id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] },
        { id: 3, name: 'Leaf' },
    ];

    const treeColumns: readonly GridwrightColumn<Node>[] = [{ id: 'name', header: 'Name' }];

    it('expands with ArrowRight and collapses with ArrowLeft', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Node>
                columns={treeColumns}
                data={tree}
                aria-label="Tree"
                getRowId={(row) => row.id}
                addons={[
                    treeData<Node>({ getRowId: (row) => row.id, getChildren: (row) => row.children }),
                    cellNavigation<Node>(),
                ]}
            />,
        );

        await waitFor(() => expect(tabbable().length).toBeGreaterThan(0));
        expect(screen.queryByText('Child')).toBeNull();

        tabbable()[0]!.focus();
        await user.keyboard('{ArrowRight}');
        await waitFor(() => expect(screen.getByText('Child')).toBeInTheDocument());

        await user.keyboard('{ArrowLeft}');
        await waitFor(() => expect(screen.queryByText('Child')).toBeNull());
    });
});

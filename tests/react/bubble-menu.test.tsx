import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { inlineEditing, rowActions } from '../../src/react/plugins/addons';
import { BubbleMenu } from '../../src/react/plugins/BubbleMenu';
import { GridwrightProvider } from '../../src/react/context';
import { useGridwright } from '../../src/react/useGridwright';

/**
 * Where the row menu appears.
 *
 * jsdom lays nothing out, so the two widths the placement depends on are stubbed. That is honest
 * about what this file can prove: the arithmetic and the clamping, not the pixels. The pixels were
 * checked in a browser, which is where the bug this file exists for was found.
 */

interface Item {
    id: string;
    name: string;
}

const items: Item[] = [
    { id: 'a', name: 'Ada' },
    { id: 'b', name: 'Grace' },
];

const columns = [{ id: 'name', header: 'Name' }];
const actions = [{ id: 'open', label: 'Open', onSelect: vi.fn() }];
const rowMenu = [rowActions<Item>({ items: actions })];

const ANCHOR_WIDTH = 800;
const MENU_WIDTH = 180;

let originalOffsetWidth: PropertyDescriptor | undefined;

beforeAll(() => {
    originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get(this: HTMLElement) {
            if (this.classList.contains('gw-bubble')) return MENU_WIDTH;
            if (this.classList.contains('gw-bubble-anchor')) return ANCHOR_WIDTH;
            return 0;
        },
    });
});

afterAll(() => {
    if (originalOffsetWidth) {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
    }
});

/**
 * jsdom has no `PointerEvent`, and Testing Library's `pointerOver` helper then builds a plain event
 * with no coordinates at all. A `MouseEvent` typed as `pointerover` is the same thing to the
 * listener and does carry `clientX`.
 */
const openOn = (rowIndex: number, clientX: number): HTMLElement => {
    const row = screen.getAllByRole('row')[rowIndex]!;
    fireEvent(row, new MouseEvent('pointerover', { bubbles: true, clientX }));
    return screen.getByRole('menu');
};

describe('the row menu', () => {
    it('opens beside the pointer', () => {
        render(<Gridwright<Item> columns={columns} data={items} addons={rowMenu} />);

        // A menu pinned to the far edge of a wide table is a journey away from the row you are
        // pointing at, and it covers the last column when it gets there.
        expect(openOn(1, 300).style.left).toBe('316px');
    });

    it('stays inside the grid when the pointer is near the edge', () => {
        render(<Gridwright<Item> columns={columns} data={items} addons={rowMenu} />);

        // 780 + 16 would hang off the end, so it stops at the last position that fits.
        expect(openOn(1, 780).style.left).toBe(`${ANCHOR_WIDTH - MENU_WIDTH - 4}px`);
    });

    it('goes to the row edge when there is no pointer to be near', () => {
        render(<Gridwright<Item> columns={columns} data={items} addons={rowMenu} />);

        // Focus reaches a row without a pointer, and guessing one would put the menu wherever the
        // mouse happened to be resting. jsdom lays out nothing, so the row's own edge is zero and
        // the clamp is what shows.
        fireEvent.focusIn(screen.getAllByRole('row')[1]!);
        expect(screen.getByRole('menu').style.left).toBe('4px');
    });

    it('opens on a left click, and stays', async () => {
        const user = userEvent.setup();
        render(<Gridwright<Item> columns={columns} data={items} addons={rowMenu} />);

        await user.click(screen.getAllByRole('row')[1]!);

        // Pinned, so it survives the pointer leaving the row. A hover-only menu is a menu you have
        // to keep the mouse still for.
        const menu = screen.getByRole('menu');
        expect(menu).toHaveAttribute('data-pinned', 'true');
        expect(within(menu).getByRole('menuitem', { name: 'Open' })).toBeInTheDocument();
    });

    it('leaves a click on a control inside the row alone', async () => {
        const user = userEvent.setup();
        render(
            <Gridwright<Item>
                columns={[{ id: 'name', header: 'Name', edit: { editable: true } }]}
                data={items}
                addons={[rowActions<Item>({ items: actions }), inlineEditing<Item>({ commit: vi.fn() })]}
            />,
        );

        // The click belongs to the editable cell it landed on. A menu over it would eat the click
        // and the reader would conclude the cell is not editable.
        await user.click(screen.getByRole('button', { name: 'Ada' }));

        // Hovering the row on the way to the button still previews the menu, which is correct. What
        // must not happen is the click pinning it, because that click was the editor's.
        expect(screen.queryByRole('menu')).not.toHaveAttribute('data-pinned');
        expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    });

    it('closes when the next click is somewhere else', async () => {
        const user = userEvent.setup();
        render(
            <div>
                <button type="button">outside</button>
                <Gridwright<Item> columns={columns} data={items} addons={rowMenu} />
            </div>,
        );

        await user.click(screen.getAllByRole('row')[1]!);
        expect(screen.getByRole('menu')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'outside' }));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('moves to the row the pointer moves to', () => {
        render(<Gridwright<Item> columns={columns} data={items} addons={rowMenu} />);

        openOn(1, 200);
        const menu = openOn(2, 500);

        // Placed once per row rather than followed continuously: a menu that slides while you
        // approach it is a menu you cannot click.
        expect(menu.style.left).toBe('516px');
        expect(within(menu).getByRole('menuitem', { name: 'Open' })).toBeInTheDocument();
    });

    it('works as a part on its own, over rows it did not render', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();

        function Composed() {
            const grid = useGridwright<Item>({ columns, data: items });
            return (
                <GridwrightProvider instance={grid}>
                    <div className="gw-root">
                        <BubbleMenu<Item> aria-label="Actions" items={[{ id: 'go', label: 'Go', onSelect }]} />
                        <table>
                            <tbody>
                                {grid.state.rows.map((row) => (
                                    <tr key={String(row.id)} className="gw-row" data-row-id={String(row.id)}>
                                        <td>{row.data.name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </GridwrightProvider>
            );
        }

        render(<Composed />);
        await user.click(screen.getByText('Grace'));

        const menu = screen.getByRole('menu', { name: 'Actions' });
        expect(menu).toHaveAttribute('data-pinned', 'true');
        await user.click(within(menu).getByRole('menuitem', { name: 'Go' }));
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    });
});

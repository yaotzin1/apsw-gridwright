import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';

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
        render(<Gridwright<Item> columns={columns} data={items} rowActions={actions} />);

        // A menu pinned to the far edge of a wide table is a journey away from the row you are
        // pointing at, and it covers the last column when it gets there.
        expect(openOn(1, 300).style.left).toBe('316px');
    });

    it('stays inside the grid when the pointer is near the edge', () => {
        render(<Gridwright<Item> columns={columns} data={items} rowActions={actions} />);

        // 780 + 16 would hang off the end, so it stops at the last position that fits.
        expect(openOn(1, 780).style.left).toBe(`${ANCHOR_WIDTH - MENU_WIDTH - 4}px`);
    });

    it('goes to the row edge when there is no pointer to be near', () => {
        render(<Gridwright<Item> columns={columns} data={items} rowActions={actions} />);

        // Focus reaches a row without a pointer, and guessing one would put the menu wherever the
        // mouse happened to be resting. jsdom lays out nothing, so the row's own edge is zero and
        // the clamp is what shows.
        fireEvent.focusIn(screen.getAllByRole('row')[1]!);
        expect(screen.getByRole('menu').style.left).toBe('4px');
    });

    it('moves to the row the pointer moves to', () => {
        render(<Gridwright<Item> columns={columns} data={items} rowActions={actions} />);

        openOn(1, 200);
        const menu = openOn(2, 500);

        // Placed once per row rather than followed continuously: a menu that slides while you
        // approach it is a menu you cannot click.
        expect(menu.style.left).toBe('516px');
        expect(within(menu).getByRole('menuitem', { name: 'Open' })).toBeInTheDocument();
    });
});

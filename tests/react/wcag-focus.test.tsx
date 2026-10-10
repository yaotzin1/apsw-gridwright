import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { columnLayout } from '../../src/react/layout/addon';
import { cellNavigation } from '../../src/react/navigation/addon';
import { columnFilters } from '../../src/react/filters';
import { wcag } from '../../src/react/wcag';
import { keepFocusClear } from '../../src/react/wcag/focus';
import type { GridAddon } from '../../src/react/addons/types';
import type { GridwrightColumn } from '../../src/react/types';
import type { Person } from '../fixtures';
import { people } from '../fixtures';

/**
 * 2.4.11 Focus Not Obscured (Minimum), AC-06.
 *
 * jsdom has no layout, so every rectangle here is stated by the test: a header 40px tall, pinned
 * columns that cover an edge, a focused cell that sits under one of them. What is asserted is the
 * arithmetic of the correction and that the grid applies it when focus lands; whether a real browser
 * agrees is the recorded pass in `research.md`.
 */

interface Box {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
}

const rect = ({ left, top, right, bottom }: Box): DOMRect =>
    ({ left, top, right, bottom, x: left, y: top, width: right - left, height: bottom - top, toJSON: () => ({}) }) as DOMRect;

const place = (element: Element, box: Box): void => {
    (element as HTMLElement).getBoundingClientRect = () => rect(box);
};

/** jsdom's scroll offsets do not stick, so a plain property stands in for each. */
const scrollable = (element: HTMLElement): void => {
    Object.defineProperty(element, 'scrollLeft', { value: 0, writable: true, configurable: true });
    Object.defineProperty(element, 'scrollTop', { value: 0, writable: true, configurable: true });
};

/**
 * The shape the shell renders: a wrapper holding a sticky header, a start-pinned cell, a plain cell and
 * an end-pinned cell. The wrapper is 600 wide; the pinned cells cover 0-100 and 500-600; the header
 * covers the top 40.
 */
const make = (tag: string, attributes: Record<string, string> = {}, text = ''): HTMLElement => {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    element.textContent = text;
    return element;
};

const table = (dir: 'ltr' | 'rtl' = 'ltr') => {
    const wrapper = make('div', { class: 'gw-table-wrapper', dir });
    const grid = make('table');
    const head = make('th', { id: 'head', class: 'gw-header-cell' }, 'Head');
    const headRow = make('tr');
    headRow.append(head);
    const thead = make('thead');
    thead.append(headRow);
    const row = make('tr');
    row.append(
        make('td', { id: 'start', 'data-pinned': 'left' }, 'start'),
        make('td', { id: 'plain', tabindex: '0' }, 'plain'),
        make('td', { id: 'end', 'data-pinned': 'right' }, 'end'),
    );
    const body = make('tbody');
    body.append(row);
    grid.append(thead);
    grid.append(body);
    wrapper.append(grid);
    document.body.replaceChildren(wrapper);
    scrollable(wrapper);
    wrapper.scrollLeft = 300;
    wrapper.scrollTop = 200;
    const get = (id: string) => document.getElementById(id)!;
    place(wrapper, { left: 0, top: 0, right: 600, bottom: 400 });
    // Clear of both pinned columns; the header's own vertical position is what covers the rows.
    place(get('head'), { left: 150, top: 0, right: 450, bottom: 40 });
    place(get('start'), ltrOrRtl(dir, { left: 0, right: 100 }, { left: 500, right: 600 }, 60, 100));
    place(get('end'), ltrOrRtl(dir, { left: 500, right: 600 }, { left: 0, right: 100 }, 60, 100));
    return { wrapper, plain: get('plain'), start: get('start'), end: get('end'), head: get('head') };
};

const ltrOrRtl = (dir: 'ltr' | 'rtl', ltr: { left: number; right: number }, rtl: { left: number; right: number }, top: number, bottom: number): Box => ({
    ...(dir === 'ltr' ? ltr : rtl),
    top,
    bottom,
});

afterEach(() => {
    document.body.replaceChildren();
});

describe('keepFocusClear', () => {
    it('scrolls a cell back out from under a start-pinned column (AC-06)', () => {
        const { wrapper, plain } = table();
        // 60 wide, with its left edge 40px under the 100px pinned column.
        place(plain, { left: 60, top: 100, right: 160, bottom: 140 });

        keepFocusClear(plain);

        expect(wrapper.scrollLeft).toBe(300 - 40);
    });

    it('scrolls a cell back out from under an end-pinned column', () => {
        const { wrapper, plain } = table();
        place(plain, { left: 450, top: 100, right: 550, bottom: 140 });

        keepFocusClear(plain);

        // Its right edge was 50px past the pinned column's left edge at 500.
        expect(wrapper.scrollLeft).toBe(300 + 50);
    });

    it('mirrors both in a right-to-left page', () => {
        const { wrapper, plain } = table('rtl');
        // The start-pinned column is on the right now, covering 500-600; this cell reaches 20px under it.
        place(plain, { left: 420, top: 100, right: 520, bottom: 140 });

        keepFocusClear(plain);

        expect(wrapper.scrollLeft).toBe(300 + 20);
    });

    it('scrolls a control back out from under the sticky header, wherever focus came from (AC-06)', () => {
        const { wrapper, plain } = table();
        place(plain, { left: 200, top: 10, right: 300, bottom: 50 });

        keepFocusClear(plain);

        // Its top was 30px under the header's bottom edge.
        expect(wrapper.scrollTop).toBe(200 - 30);
    });

    it('does both at once when a cell is under the corner', () => {
        const { wrapper, plain } = table();
        place(plain, { left: 80, top: 20, right: 180, bottom: 60 });

        keepFocusClear(plain);

        expect(wrapper.scrollLeft).toBe(300 - 20);
        expect(wrapper.scrollTop).toBe(200 - 20);
    });

    it('leaves a cell that is clear alone', () => {
        const { wrapper, plain } = table();
        place(plain, { left: 200, top: 100, right: 300, bottom: 140 });

        keepFocusClear(plain);

        expect(wrapper.scrollLeft).toBe(300);
        expect(wrapper.scrollTop).toBe(200);
    });

    it('leaves a pinned cell and a header cell alone: they are the cover, not what it hides', () => {
        const { wrapper, start, end, head } = table();

        for (const element of [start, end, head]) keepFocusClear(element);

        expect(wrapper.scrollLeft).toBe(300);
        expect(wrapper.scrollTop).toBe(200);
    });

    it('does nothing outside a grid', () => {
        const button = make('button', { id: 'b' }, 'x');
        document.body.replaceChildren(button);
        expect(() => keepFocusClear(button)).not.toThrow();
    });
});

const columns: readonly GridwrightColumn<Person>[] = [
    { id: 'name', header: 'Name', width: 200, layout: { pinned: 'left' } },
    { id: 'department', header: 'Department', width: 200 },
    { id: 'salary', header: 'Salary', width: 200 },
];

const renderGrid = (withWcag: boolean, extra: readonly GridAddon<Person>[] = []) => {
    const addons: GridAddon<Person>[] = [columnLayout<Person>(), ...extra];
    if (withWcag) addons.unshift(wcag<Person>());
    return render(<Gridwright<Person> columns={columns} data={people} pageSize={5} aria-label="People" addons={addons} />);
};

describe('focus in a grid', () => {
    it('moves the wrapper when a cell under a pinned column takes focus, under wcag() (AC-06, AC-15)', async () => {
        const user = userEvent.setup();
        renderGrid(true, [cellNavigation<Person>()]);
        const wrapper = document.querySelector<HTMLElement>('.gw-table-wrapper')!;
        scrollable(wrapper);
        wrapper.scrollLeft = 300;
        place(wrapper, { left: 0, top: 0, right: 600, bottom: 400 });
        const pinned = document.querySelector<HTMLElement>('td[data-pinned]')!;
        place(pinned, { left: 0, top: 60, right: 100, bottom: 100 });
        const cell = screen.getAllByText('Engineering', { selector: 'td' })[0]!;
        place(cell, { left: 70, top: 60, right: 270, bottom: 100 });

        await user.click(cell);

        expect(wrapper.scrollLeft).toBe(300 - 30);
    });

    it('does nothing of the kind without wcag(): the default grid scrolls as it did', async () => {
        const user = userEvent.setup();
        renderGrid(false, [cellNavigation<Person>()]);
        const wrapper = document.querySelector<HTMLElement>('.gw-table-wrapper')!;
        scrollable(wrapper);
        wrapper.scrollLeft = 300;
        place(wrapper, { left: 0, top: 0, right: 600, bottom: 400 });
        const pinned = document.querySelector<HTMLElement>('td[data-pinned]')!;
        place(pinned, { left: 0, top: 60, right: 100, bottom: 100 });
        const cell = screen.getAllByText('Engineering', { selector: 'td' })[0]!;
        place(cell, { left: 70, top: 60, right: 270, bottom: 100 });

        await user.click(cell);

        expect(wrapper.scrollLeft).toBe(300);
    });
});

describe('the filter dialog and its own trigger (AC-06)', () => {
    it('opens below the button that opened it and never over it', async () => {
        const user = userEvent.setup();
        const filterable = columns.map((column) => ({ ...column, filterable: true }));
        render(<Gridwright<Person> columns={filterable} data={people} pageSize={5} aria-label="People" addons={[wcag<Person>(), columnFilters<Person>()]} />);
        const trigger = screen.getByRole('button', { name: /^Filter Salary/ });
        place(trigger, { left: 400, top: 10, right: 428, bottom: 46 });

        await user.click(trigger);

        const dialog = screen.getByRole('dialog', { name: 'Filter Salary' });
        // Placed from the trigger's rectangle: its top edge is at the trigger's bottom edge plus the gap.
        expect(parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(46);
    });
});

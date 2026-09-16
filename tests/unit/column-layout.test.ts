import { describe, expect, it } from 'vitest';
import {
    autoFitWidth,
    clampWidth,
    columnWidthProperty,
    columnWidthVar,
    entryOf,
    layoutColumnsOf,
    moveInOrder,
    normalizeLayout,
    orderedColumns,
    pixelWidth,
    stickyOffsets,
    withEntry,
} from '../../src/react/layout/layout';
import type { ColumnPin, LayoutColumn } from '../../src/react/layout/types';

/**
 * The arithmetic behind column layout, without a table.
 *
 * Sticky offsets have to agree with what the browser paints, and a wrong one is a column drawn on
 * top of another rather than an exception. Testing the sums here means the React test can ask
 * whether the offset reached the cell rather than whether it was right.
 */

const column = (id: string, width: number, pinned: ColumnPin | null = null): LayoutColumn => ({ id, width, pinned });

describe('the custom property a width is published under', () => {
    it('leaves an ordinary id alone', () => {
        expect(columnWidthProperty('salary')).toBe('--gw-col-w-salary');
        expect(columnWidthVar('salary')).toBe('var(--gw-col-w-salary)');
    });

    // The id can come from a server, and the name is concatenated into a `var(...)` in a style.
    it('escapes an id that would break out of the property name', () => {
        const property = columnWidthProperty('a); background: url(http://evil.test');
        expect(property).not.toContain(';');
        expect(property).not.toContain(')');
        expect(property).not.toContain(' ');
        expect(property).not.toContain(':');
        expect(property).toMatch(/^--gw-col-w-[A-Za-z0-9_-]+$/);
    });

    it('escapes a quote, a brace and a newline the same way', () => {
        for (const hostile of ['"', '}', '\n', '/*', '\\', 'a{b}']) {
            expect(columnWidthProperty(hostile)).toMatch(/^--gw-col-w-[A-Za-z0-9_-]+$/);
        }
    });

    // Two columns sharing a property would share a width, so the escape has to be reversible even
    // where an id spells out what an escape sequence looks like.
    it('gives two different ids two different properties', () => {
        const ids = ['a b', 'a-b', 'a_b', 'a_20_b', 'ab', 'a.b', 'a:b'];
        const properties = ids.map(columnWidthProperty);
        expect(new Set(properties).size).toBe(ids.length);
    });
});

describe('widths', () => {
    it('clamps to the bounds and rounds to a whole pixel', () => {
        expect(clampWidth(180.4, { min: 50, max: Infinity })).toBe(180);
        expect(clampWidth(10, { min: 50, max: Infinity })).toBe(50);
        expect(clampWidth(900, { min: 50, max: 300 })).toBe(300);
    });

    it('falls back to the floor for a width that is not a number at all', () => {
        expect(clampWidth(Number.NaN, { min: 50, max: 300 })).toBe(50);
    });

    it('reads a pixel count, and refuses a width it cannot add up', () => {
        expect(pixelWidth(240)).toBe(240);
        expect(pixelWidth('240px')).toBe(240);
        expect(pixelWidth(' 240 px ')).toBe(240);
        // Not pixel counts: a sticky offset is a sum, and none of these can be added to one.
        expect(pixelWidth('20%')).toBeNull();
        expect(pixelWidth('auto')).toBeNull();
        expect(pixelWidth('12em')).toBeNull();
        expect(pixelWidth(undefined)).toBeNull();
        expect(pixelWidth(Number.POSITIVE_INFINITY)).toBeNull();
    });

    it('fits a column to the widest thing measured in it, within the bounds', () => {
        expect(autoFitWidth([80, 210.2, 120], { min: 50, max: Infinity })).toBe(211);
        expect(autoFitWidth([80, 900], { min: 50, max: 300 })).toBe(300);
        // Nothing mounted, nothing measurable: the floor, not zero.
        expect(autoFitWidth([], { min: 50, max: Infinity })).toBe(50);
    });
});

describe('sticky offsets', () => {
    it('stacks left-pinned columns in painting order', () => {
        const offsets = stickyOffsets([
            column('select', 48, 'left'),
            column('name', 200, 'left'),
            column('city', 150),
            column('salary', 120),
        ]);

        expect(offsets.left.get('select')).toBe(0);
        expect(offsets.left.get('name')).toBe(48);
        expect(offsets.left.has('city')).toBe(false);
        expect(offsets.lastLeft).toBe('name');
        expect(offsets.firstRight).toBeNull();
    });

    it('stacks right-pinned columns backwards from the end', () => {
        const offsets = stickyOffsets([
            column('name', 200),
            column('salary', 120, 'right'),
            column('actions', 80, 'right'),
        ]);

        expect(offsets.right.get('actions')).toBe(0);
        expect(offsets.right.get('salary')).toBe(80);
        expect(offsets.firstRight).toBe('salary');
    });

    // The scrolling columns between two pinned ones pass underneath, so they add nothing.
    it('ignores the unpinned columns between two pinned ones', () => {
        const offsets = stickyOffsets([
            column('a', 100, 'left'),
            column('b', 400),
            column('c', 100, 'left'),
        ]);

        expect(offsets.left.get('c')).toBe(100);
    });

    it('has no boundary column when nothing is pinned', () => {
        const offsets = stickyOffsets([column('a', 100), column('b', 100)]);
        expect(offsets.lastLeft).toBeNull();
        expect(offsets.firstRight).toBeNull();
        expect(offsets.left.size).toBe(0);
    });
});

describe('the painted column order', () => {
    const input = {
        columns: [
            { id: 'name', hidden: false, width: 200, pinned: 'left' as const },
            { id: 'city', hidden: true, width: 150, pinned: null },
            { id: 'salary', hidden: false, width: 120, pinned: null },
        ],
        extras: [
            { id: 'gridwright:selection', placement: 'start' as const },
            { id: 'acme:actions', placement: 'end' as const },
        ],
        extraWidth: () => 48,
        extraPin: (_id: string, placement: 'start' | 'end') => (placement === 'start' ? ('left' as const) : null),
    };

    it('puts the extra columns at the ends and drops the hidden ones', () => {
        expect(layoutColumnsOf(input).map((entry) => entry.id)).toEqual([
            'gridwright:selection',
            'name',
            'salary',
            'acme:actions',
        ]);
    });

    // The checkbox sits to the left of the name it belongs to; if the name is pinned and the
    // checkbox is not, the name is drawn over the checkbox as soon as anyone scrolls.
    it('gives the pinned extra column the first offset, before the pinned data column', () => {
        const offsets = stickyOffsets(layoutColumnsOf(input));
        expect(offsets.left.get('gridwright:selection')).toBe(0);
        expect(offsets.left.get('name')).toBe(48);
        expect(offsets.lastLeft).toBe('name');
    });
});

describe('the reader’s column order', () => {
    const declared = [{ id: 'name' }, { id: 'title' }, { id: 'email' }, { id: 'salary' }];
    const ids = (order: readonly string[]) => orderedColumns(declared, order).map((column) => column.id);

    it('is the declared order when nothing was saved', () => {
        expect(ids([])).toEqual(['name', 'title', 'email', 'salary']);
        // The same array, not a copy: nothing saved means nothing to do.
        expect(orderedColumns(declared, [])).toBe(declared);
    });

    it('puts the columns the order names first, in that order', () => {
        expect(ids(['salary', 'name'])).toEqual(['salary', 'name', 'title', 'email']);
    });

    // A developer who removes a column must not break every reader who saved a layout.
    it('skips an id that no longer names a column', () => {
        expect(ids(['salary', 'phone', 'name'])).toEqual(['salary', 'name', 'title', 'email']);
    });

    // And a developer who adds one: it appears at the end for a reader with a saved order. This is
    // the surprising half of the rule, so it is pinned by a test rather than left to drift.
    it('puts a column the order does not name after the ones it does', () => {
        expect(orderedColumns([...declared, { id: 'city' }], ['salary', 'name', 'title', 'email']).map((c) => c.id))
            .toEqual(['salary', 'name', 'title', 'email', 'city']);
    });

    it('keeps the unnamed columns in their declared order among themselves', () => {
        expect(ids(['salary'])).toEqual(['salary', 'name', 'title', 'email']);
    });
});

describe('moving a column within an order', () => {
    const order = ['name', 'title', 'email', 'salary'];

    it('moves forwards and backwards', () => {
        expect(moveInOrder(order, 'name', 2)).toEqual(['title', 'email', 'name', 'salary']);
        expect(moveInOrder(order, 'salary', 0)).toEqual(['salary', 'name', 'title', 'email']);
    });

    it('clamps past either end', () => {
        expect(moveInOrder(order, 'name', 99)).toEqual(['title', 'email', 'salary', 'name']);
        expect(moveInOrder(order, 'salary', -5)).toEqual(['salary', 'name', 'title', 'email']);
    });

    // Returning the same array is what lets the caller skip a state update for a move that moved
    // nothing, which is what a drop on the column you started from is.
    it('returns the array it was given when nothing moves', () => {
        expect(moveInOrder(order, 'title', 1)).toBe(order);
        expect(moveInOrder(order, 'nothing', 0)).toBe(order);
    });
});

describe('a layout read back in from storage', () => {
    it('keeps what it recognises', () => {
        expect(
            normalizeLayout({ widths: { name: 200 }, pinned: { name: 'left', city: null }, hidden: { salary: true } }),
        ).toEqual({ widths: { name: 200 }, pinned: { name: 'left', city: null }, hidden: { salary: true }, order: [] });
    });

    it('drops every value that is not the type it claims to be', () => {
        const layout = normalizeLayout({
            widths: { a: Number.NaN, b: -10, c: 'wide', d: 120 },
            pinned: { a: 'middle', b: 'left' },
            hidden: { a: 'yes', b: true },
        } as never);

        expect(layout).toEqual({ widths: { d: 120 }, pinned: { b: 'left' }, hidden: { b: true }, order: [] });
    });

    it('is a complete layout even when it was given nothing', () => {
        expect(normalizeLayout(undefined)).toEqual({ widths: {}, pinned: {}, hidden: {}, order: [] });
        expect(normalizeLayout({} as never)).toEqual({ widths: {}, pinned: {}, hidden: {}, order: [] });
    });

    it('keeps an order of strings and refuses anything else', () => {
        expect(normalizeLayout({ order: ['b', 'a'] }).order).toEqual(['b', 'a']);
        expect(normalizeLayout({ order: ['a', 7, null, 'b'] } as never).order).toEqual(['a', 'b']);
        expect(normalizeLayout({ order: 'a,b' } as never).order).toEqual([]);
        expect(normalizeLayout({ order: { 0: 'a' } } as never).order).toEqual([]);
    });

    // A saved layout is parsed JSON of a shape nobody checked, and this one names a prototype.
    it('refuses a key that would reach a prototype', () => {
        const hostile = JSON.parse('{"widths":{"__proto__":{"polluted":true},"name":120}}') as never;
        const layout = normalizeLayout(hostile);

        expect(Object.keys(layout.widths)).toEqual(['name']);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('refuses to write one either', () => {
        const after = withEntry<number>({ name: 120 }, '__proto__', 999);
        expect(after).toEqual({ name: 120 });
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
});

describe('reading and writing one entry', () => {
    it('answers for an own key only', () => {
        expect(entryOf({ name: 120 }, 'name')).toBe(120);
        expect(entryOf({ name: 120 }, 'salary')).toBeUndefined();
        // An ordinary lookup would answer this one with a function off Object.prototype.
        expect(entryOf({} as Record<string, number>, 'toString')).toBeUndefined();
    });

    it('replaces a value, and removes the key for undefined', () => {
        expect(withEntry<number>({ name: 120 }, 'name', 200)).toEqual({ name: 200 });
        expect(withEntry<number>({ name: 120, city: 90 }, 'name', undefined)).toEqual({ city: 90 });
    });

    it('leaves the record it was given alone', () => {
        const before = { name: 120 };
        withEntry<number>(before, 'name', 200);
        expect(before).toEqual({ name: 120 });
    });
});

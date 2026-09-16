import type { ColumnPin, ColumnLayoutState, LayoutColumn, StickyOffsets, WidthBounds } from './types';

/**
 * The arithmetic behind column layout. No DOM, no React, no state: everything here is a function of
 * its arguments, so the parts that are easiest to get wrong -- offsets that have to agree with what
 * the browser paints -- are testable without rendering a table.
 */

/** Anything not in this set is escaped before it becomes part of a custom property name. */
const UNSAFE_IN_PROPERTY = /[^A-Za-z0-9-]/gu;

/**
 * The custom property a column's width is published under, for example `--gw-col-w-first_20_name`.
 *
 * The id is escaped rather than trusted. A column set can be built from a server response, and this
 * name is concatenated into a `var(...)` in a style, which is one of the places the security rules
 * say a value never arrives unencoded. The escape is injective -- `_` is escaped too, so an id that
 * spells out an escape sequence cannot collide with the id it looks like -- which matters because
 * two columns sharing a property would share a width.
 */
export function columnWidthProperty(columnId: string): string {
    const safe = columnId.replace(UNSAFE_IN_PROPERTY, (character) => `_${character.codePointAt(0)!.toString(16)}_`);
    return `--gw-col-w-${safe}`;
}

/** `var(--gw-col-w-...)`, the value a header or body cell gets for its width. */
export const columnWidthVar = (columnId: string): string => `var(${columnWidthProperty(columnId)})`;

export function clampWidth(width: number, bounds: WidthBounds): number {
    if (!Number.isFinite(width)) return bounds.min;
    return Math.round(Math.min(Math.max(width, bounds.min), bounds.max));
}

/**
 * The pixel count in a column's declared `width`, or null when it has none to give.
 *
 * `240` and `'240px'` are pixel counts. `'20%'`, `'auto'` and `'12em'` are not: they cannot be added
 * into a sticky offset, and an offset has to be a number or the pinned column lands in the wrong
 * place. A column declared that way renders at the add-on's `defaultWidth` until it is resized,
 * which `docs/column-layout.md` says out loud rather than leaving to be discovered.
 */
export function pixelWidth(width: number | string | undefined): number | null {
    if (typeof width === 'number') return Number.isFinite(width) ? width : null;
    if (typeof width !== 'string') return null;
    const match = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/.exec(width);
    return match ? Number(match[1]) : null;
}

interface LayoutColumnsInput {
    readonly columns: readonly {
        readonly id: string;
        readonly hidden: boolean;
        readonly width: number;
        readonly pinned: ColumnPin | null;
    }[];
    readonly extras: readonly { readonly id: string; readonly placement: 'start' | 'end' }[];
    readonly extraWidth: (columnId: string) => number;
    readonly extraPin: (columnId: string, placement: 'start' | 'end') => ColumnPin | null;
}

/**
 * The visible columns in the order they are painted, each with the width and edge it renders at.
 *
 * Extra columns -- another add-on's checkbox column -- are in the list at the end their `placement`
 * puts them. They have no column definition, so no declared width and no `layout` option; they take
 * the layout's own width for them, and they follow the data columns onto an edge, because a
 * checkbox that scrolls out from under the name it belongs to is worse than no pinning at all.
 */
export function layoutColumnsOf(input: LayoutColumnsInput): readonly LayoutColumn[] {
    const data = input.columns
        .filter((column) => !column.hidden)
        .map(({ id, width, pinned }) => ({ id, width, pinned }));

    const extra = (placement: 'start' | 'end'): LayoutColumn[] =>
        input.extras
            .filter((column) => column.placement === placement)
            .map((column) => ({
                id: column.id,
                width: input.extraWidth(column.id),
                pinned: input.extraPin(column.id, placement),
            }));

    return [...extra('start'), ...data, ...extra('end')];
}

/**
 * Where every pinned column sits, in painting order.
 *
 * A left-pinned column's offset is the sum of the widths of the left-pinned columns before it; a
 * right-pinned column's is the sum of those after it, which is why the right side is accumulated
 * backwards. Unpinned columns between two pinned ones contribute nothing: they scroll underneath.
 */
export function stickyOffsets(columns: readonly LayoutColumn[]): StickyOffsets {
    const left = new Map<string, number>();
    const right = new Map<string, number>();
    let lastLeft: string | null = null;
    let firstRight: string | null = null;

    let runningLeft = 0;
    for (const column of columns) {
        if (column.pinned !== 'left') continue;
        left.set(column.id, runningLeft);
        runningLeft += column.width;
        lastLeft = column.id;
    }

    let runningRight = 0;
    for (let index = columns.length - 1; index >= 0; index -= 1) {
        const column = columns[index]!;
        if (column.pinned !== 'right') continue;
        right.set(column.id, runningRight);
        runningRight += column.width;
        firstRight = column.id;
    }

    return { left, right, lastLeft, firstRight };
}

/**
 * The columns in the reader's order: the ones the saved order names, in that order, then everything
 * else in the order it was declared.
 *
 * An empty order is not a special case; with nothing named, every column falls into the second group
 * and keeps its declared position. An id naming a column that no longer exists is skipped, so a
 * developer removing a column does not break every reader who saved a layout. A column the order
 * does not name goes last, which is the one surprising consequence and the one that is documented:
 * the alternatives are guessing where the reader would have put a column they have never seen, or
 * throwing away their whole arrangement because one column changed.
 */
export function orderedColumns<T extends { readonly id: string }>(
    columns: readonly T[],
    order: readonly string[],
): readonly T[] {
    if (order.length === 0) return columns;

    const remaining = new Map(columns.map((column) => [column.id, column]));
    const named: T[] = [];
    for (const id of order) {
        const column = remaining.get(id);
        if (!column) continue;
        named.push(column);
        remaining.delete(id);
    }

    return [...named, ...remaining.values()];
}

/**
 * One order with a column moved to a position, clamped to the ends.
 *
 * `order` here is the full, resolved order rather than the saved one, so the result names every
 * column: a move is the moment the reader's arrangement stops being "the declared order with a few
 * exceptions" and becomes an arrangement of its own.
 */
export function moveInOrder(order: readonly string[], columnId: string, toIndex: number): readonly string[] {
    const from = order.indexOf(columnId);
    if (from === -1) return order;

    const to = Math.min(Math.max(Math.trunc(toIndex), 0), order.length - 1);
    if (to === from) return order;

    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, columnId);
    return next;
}

/** The width that fits the widest thing measured in a column, clamped to what it may be. */
export function autoFitWidth(measurements: readonly number[], bounds: WidthBounds): number {
    const widest = measurements.reduce((best, value) => (Number.isFinite(value) && value > best ? value : best), 0);
    return clampWidth(Math.ceil(widest), bounds);
}

/** Keys that would reach a prototype if a saved layout were trusted and written key by key. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function entriesOf(record: Readonly<Record<string, unknown>> | undefined): readonly (readonly [string, unknown])[] {
    if (!record || typeof record !== 'object') return [];
    return Object.entries(record).filter(([key]) => !FORBIDDEN_KEYS.has(key));
}

/**
 * A layout handed in from outside, read into a fresh object one field at a time.
 *
 * `initial` is whatever came back out of `localStorage` or a preferences endpoint: parsed JSON, of
 * a shape nobody checked, possibly written by an older version of this package. Every value is
 * checked for the type it claims to be and anything else is dropped, so a corrupted entry costs the
 * reader their saved widths rather than their grid. Prototype keys are refused by name as well as
 * by construction, because the cost of saying so is one `Set` and the cost of being wrong is a
 * polluted prototype.
 */
export function normalizeLayout(initial: Partial<ColumnLayoutState> | undefined): ColumnLayoutState {
    const widths: Record<string, number> = {};
    const pinned: Record<string, ColumnPin | null> = {};
    const hidden: Record<string, boolean> = {};

    for (const [key, value] of entriesOf(initial?.widths)) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) widths[key] = value;
    }
    for (const [key, value] of entriesOf(initial?.pinned)) {
        if (value === 'left' || value === 'right' || value === null) pinned[key] = value;
    }
    for (const [key, value] of entriesOf(initial?.hidden)) {
        if (typeof value === 'boolean') hidden[key] = value;
    }

    // Ids are not checked against the columns here: `initial` is read before the columns are known,
    // and an id that no longer names one falls out of `orderedColumns` instead. What is checked is
    // that this is a list of strings at all, so a corrupted entry costs the reader their
    // arrangement rather than their grid.
    const order = Array.isArray(initial?.order)
        ? (initial.order as readonly unknown[]).filter((id): id is string => typeof id === 'string')
        : [];

    return { widths, pinned, hidden, order };
}

/**
 * One entry of a layout record, read as an own property.
 *
 * A column id is a string a consumer chose, and `widths['toString']` on an ordinary object literal
 * answers with a function rather than with `undefined`. Every read of a layout record goes through
 * here so that a column named after something on `Object.prototype` behaves like any other column.
 */
export function entryOf<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
    return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** One record with one key replaced, or with that key gone when the value is `undefined`. */
export function withEntry<T>(
    record: Readonly<Record<string, T>>,
    key: string,
    value: T | undefined,
): Readonly<Record<string, T>> {
    if (FORBIDDEN_KEYS.has(key)) return record;
    const next: Record<string, T> = { ...record };
    if (value === undefined) delete next[key];
    else next[key] = value;
    return next;
}

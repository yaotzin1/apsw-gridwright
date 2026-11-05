import { describe, expect, it } from 'vitest';
import { rowClickSelects, spaceSelectsRow, viewEvent } from '../../src/view';
import type { ViewEventOrigin } from '../../src/view';

/** The selection decisions, with no element anywhere: an origin is plain data, so these run in Node. */

const origin = (patch: Partial<ViewEventOrigin> = {}): ViewEventOrigin => ({ fromControl: false, fromNestedGrid: false, textSelected: false, ...patch });
const cell = (patch: Partial<NonNullable<ViewEventOrigin['cell']>> = {}) => ({ rowId: '2', columnId: 'name', holdsControl: false, targetIsCell: true, ...patch });
const rows = [{ id: 1 }, { id: 2 }, { id: 3 }] as never;

describe('rowClickSelects', () => {
    it('selects on a click on the row itself', () => {
        expect(rowClickSelects(viewEvent({ origin: origin() }))).toBe(true);
    });

    it.each([
        ['a control in the row', { fromControl: true }],
        ['a row of a nested grid', { fromNestedGrid: true }],
        ['the end of a text selection', { textSelected: true }],
    ])('does not select on %s', (_name, patch) => {
        expect(rowClickSelects(viewEvent({ origin: origin(patch) }))).toBe(false);
    });

    it('selects nothing when the adapter said nothing about where the click came from', () => {
        expect(rowClickSelects(viewEvent())).toBe(false);
    });
});

describe('spaceSelectsRow', () => {
    const space = (init: Parameters<typeof viewEvent>[0] = {}) => viewEvent({ key: ' ', origin: origin({ cell: cell() }), ...init });

    it('returns the row of the focused cell', () => {
        expect(spaceSelectsRow(space(), { rows })?.id).toBe(2);
    });

    it('matches a numeric row id against the text the cell carries', () => {
        expect(spaceSelectsRow(space({ origin: origin({ cell: cell({ rowId: '3' }) }) }), { rows })?.id).toBe(3);
    });

    it('leaves a cell that holds a control to that control', () => {
        expect(spaceSelectsRow(space({ origin: origin({ cell: cell({ holdsControl: true }) }) }), { rows })).toBeUndefined();
    });

    it('ignores Space from something inside the cell, not the cell itself', () => {
        expect(spaceSelectsRow(space({ origin: origin({ cell: cell({ targetIsCell: false }) }) }), { rows })).toBeUndefined();
    });

    it.each([['ctrlKey'], ['metaKey'], ['altKey'], ['shiftKey']])('ignores Space with %s held', (modifier) => {
        expect(spaceSelectsRow(space({ [modifier]: true }), { rows })).toBeUndefined();
    });

    it('ignores other keys, a header or nested cell (no cell in the origin), and a row that is gone', () => {
        expect(spaceSelectsRow(space({ key: 'Enter' }), { rows })).toBeUndefined();
        expect(spaceSelectsRow(space({ origin: origin() }), { rows })).toBeUndefined();
        expect(spaceSelectsRow(space({ origin: origin({ cell: cell({ rowId: '99' }) }) }), { rows })).toBeUndefined();
        expect(spaceSelectsRow(viewEvent({ key: ' ' }), { rows })).toBeUndefined();
    });
});

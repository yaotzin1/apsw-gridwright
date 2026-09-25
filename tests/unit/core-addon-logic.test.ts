import { describe, expect, it } from 'vitest';
import type { GridState } from '../../src/core/types';
import type { AnnouncementChange } from '../../src/react/addons/types';
import {
    DEFAULT_PAGE_SIZE_OPTIONS,
    pageFocusAfterChange,
    pageRangeOf,
    pageSizeChoices,
} from '../../src/react/core-addons/pagination-logic';
import { pageSelectionOf } from '../../src/react/core-addons/selection-logic';
import {
    ariaSortOf,
    nextSortAction,
    sortAnnouncement,
    sortPriorityOf,
    sortTitleOf,
} from '../../src/react/core-addons/sorting-logic';

/**
 * The core add-ons' decisions as plain calls. Every view of sorting, selection and pagination (the
 * native controls, the MUI ones, a third party's) gets these answers, so they are pinned here once
 * rather than per view.
 */

const t = (key: string, values: Record<string, string | number> = {}): string =>
    `${key}${Object.keys(values).length ? JSON.stringify(values) : ''}`;

const stateWith = (patch: Partial<GridState<unknown>> & { page?: { pageIndex: number; pageSize: number } }): GridState<unknown> =>
    ({
        rows: [],
        selectedIds: [],
        totalRows: 0,
        isTotalExact: true,
        ...patch,
        query: { sort: [], filters: [], search: '', pagination: patch.page ?? { pageIndex: 0, pageSize: 10 } },
    }) as unknown as GridState<unknown>;

const rows = (...ids: number[]) => ids.map((id, index) => ({ id, index, data: {}, selected: false }));

describe('sorting', () => {
    it('puts the direction on the cell as ARIA spells it', () => {
        expect([ariaSortOf('asc'), ariaSortOf('desc'), ariaSortOf(null)]).toEqual(['ascending', 'descending', 'none']);
    });

    it('names the next action, not the current state', () => {
        expect([nextSortAction(null), nextSortAction('asc'), nextSortAction('desc')]).toEqual(['ascending', 'descending', 'clear']);
    });

    it('wraps the action in the Shift hint only while multi-sort is on', () => {
        expect(sortTitleOf('asc', true, t)).toBe('actionWithShift{"action":"descending"}');
        expect(sortTitleOf('asc', false, t)).toBe('descending');
    });

    it('numbers a column only against another sorted column', () => {
        const two = [
            { columnId: 'dept', direction: 'asc' as const },
            { columnId: 'salary', direction: 'desc' as const },
        ];
        expect(sortPriorityOf(two, 'salary')).toBe(2);
        expect(sortPriorityOf(two, 'name')).toBe(0);
        expect(sortPriorityOf([two[0]!], 'dept')).toBe(0);
    });

    it('announces the column that changed, with its priority once there are several', () => {
        const contributor = sortAnnouncement<unknown>();
        const change = (before: GridState<unknown>['query']['sort'], after: GridState<unknown>['query']['sort']) =>
            contributor.describe({
                previous: { query: { sort: before } },
                next: { query: { sort: after } },
                headers: new Map([
                    ['dept', 'Department'],
                    ['salary', 'Salary'],
                ]),
                t,
            } as unknown as AnnouncementChange<unknown>);

        expect(contributor.priority).toBe(20);
        expect(change([], [{ columnId: 'salary', direction: 'asc' }])).toBe('sortedAscending{"column":"Salary"}');
        expect(
            change(
                [{ columnId: 'dept', direction: 'asc' }],
                [
                    { columnId: 'dept', direction: 'asc' },
                    { columnId: 'salary', direction: 'desc' },
                ],
            ),
        ).toBe('sortedDescendingPriority{"column":"Salary","priority":2}');
        expect(change([{ columnId: 'salary', direction: 'desc' }], [])).toBe('sortCleared{"column":"Salary"}');
    });
});

describe('selection', () => {
    it('says whether the page is wholly or partly selected', () => {
        expect(pageSelectionOf({ rows: rows(1, 2), selectedIds: [1, 2] })).toEqual({ all: true, some: false });
        expect(pageSelectionOf({ rows: rows(1, 2), selectedIds: [2, 9] })).toEqual({ all: false, some: true });
        expect(pageSelectionOf({ rows: rows(1, 2), selectedIds: [9] })).toEqual({ all: false, some: false });
        // An empty page is not "all selected", or an empty grid would show a ticked header.
        expect(pageSelectionOf({ rows: [], selectedIds: [] })).toEqual({ all: false, some: false });
    });
});

describe('pagination', () => {
    it('gives the range, and no total at all when the source sent none', () => {
        const page = { pageIndex: 1, pageSize: 10 };
        expect(pageRangeOf(stateWith({ rows: rows(11, 12, 13), totalRows: 13, page }))).toEqual({ from: 11, to: 13, total: 13 });
        expect(pageRangeOf(stateWith({ rows: rows(11, 12), totalRows: 21, isTotalExact: false, page }))).toEqual({
            from: 11,
            to: 12,
            total: null,
        });
        expect(pageRangeOf(stateWith({}))).toEqual({ from: 0, to: 0, total: 0 });
    });

    it('offers the grid its own page size even when it is not listed', () => {
        expect(pageSizeChoices(DEFAULT_PAGE_SIZE_OPTIONS, 25)).toBe(DEFAULT_PAGE_SIZE_OPTIONS);
        expect(pageSizeChoices(DEFAULT_PAGE_SIZE_OPTIONS, 5)).toEqual([5, 10, 25, 50, 100]);
    });

    it('moves focus only off the button the reader pressed, and only once it disables', () => {
        expect(pageFocusAfterChange('next', { previous: false, next: true })).toBe('previous');
        expect(pageFocusAfterChange('next', { previous: false, next: false })).toBeNull();
        expect(pageFocusAfterChange(null, { previous: false, next: true })).toBeNull();
        // A single page: both disabled, and nowhere in the pager to go.
        expect(pageFocusAfterChange('previous', { previous: true, next: true })).toBeNull();
    });
});

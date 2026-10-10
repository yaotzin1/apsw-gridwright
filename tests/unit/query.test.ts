import { describe, expect, it } from 'vitest';
import { createQuery, DEFAULT_PAGE_SIZE, normalizeQuery, queriesEqual, resetsPage } from '../../src/core/query';

describe('createQuery', () => {
    it('fills in defaults for everything omitted', () => {
        const query = createQuery();
        expect(query.sort).toEqual([]);
        expect(query.filters).toEqual([]);
        expect(query.search).toBe('');
        expect(query.pagination).toEqual({ pageIndex: 0, pageSize: 25 });
    });

    it('keeps the parts that were supplied', () => {
        const query = createQuery({ search: 'ada', pagination: { pageIndex: 2, pageSize: 10 } });
        expect(query.search).toBe('ada');
        expect(query.pagination).toEqual({ pageIndex: 2, pageSize: 10 });
    });
});

describe('normalizeQuery', () => {
    it('repairs a page size of zero instead of dividing by it later', () => {
        const query = normalizeQuery(createQuery({ pagination: { pageIndex: 0, pageSize: 0 } }));
        expect(query.pagination.pageSize).toBe(25);
    });

    it('clamps a negative page index to the first page', () => {
        const query = normalizeQuery(createQuery({ pagination: { pageIndex: -4, pageSize: 10 } }));
        expect(query.pagination.pageIndex).toBe(0);
    });

    it('keeps one sort entry per column, last write winning', () => {
        const query = normalizeQuery(
            createQuery({
                sort: [
                    { columnId: 'name', direction: 'asc' },
                    { columnId: 'name', direction: 'desc' },
                ],
            }),
        );
        expect(query.sort).toEqual([{ columnId: 'name', direction: 'desc' }]);
    });
});

describe('queriesEqual', () => {
    it('is true for structurally identical queries built separately', () => {
        const a = createQuery({ search: 'x', sort: [{ columnId: 'name', direction: 'asc' }] });
        const b = createQuery({ search: 'x', sort: [{ columnId: 'name', direction: 'asc' }] });
        expect(queriesEqual(a, b)).toBe(true);
    });

    it('notices a changed filter value, including inside an array', () => {
        const a = createQuery({ filters: [{ columnId: 'salary', operator: 'between', value: [1, 2] }] });
        const b = createQuery({ filters: [{ columnId: 'salary', operator: 'between', value: [1, 3] }] });
        expect(queriesEqual(a, b)).toBe(false);
    });

    it('notices a changed page', () => {
        const a = createQuery({ pagination: { pageIndex: 0, pageSize: 10 } });
        const b = createQuery({ pagination: { pageIndex: 1, pageSize: 10 } });
        expect(queriesEqual(a, b)).toBe(false);
    });
});

describe('resetsPage', () => {
    const base = createQuery({ pagination: { pageIndex: 3, pageSize: 10 } });

    it('resets when the search term changes', () => {
        expect(resetsPage(base, { ...base, search: 'ada' })).toBe(true);
    });

    it('resets when a filter is added', () => {
        expect(
            resetsPage(base, { ...base, filters: [{ columnId: 'name', operator: 'contains', value: 'a' }] }),
        ).toBe(true);
    });

    it('resets when the sort changes, because page 4 then holds different rows', () => {
        expect(resetsPage(base, { ...base, sort: [{ columnId: 'name', direction: 'asc' }] })).toBe(true);
    });

    it('resets when the page size changes', () => {
        expect(resetsPage(base, { ...base, pagination: { pageIndex: 3, pageSize: 50 } })).toBe(true);
    });

    it('does not reset when only the page index moves', () => {
        expect(resetsPage(base, { ...base, pagination: { pageIndex: 4, pageSize: 10 } })).toBe(false);
    });
});

describe('values of different kinds are different values', () => {
    const withValue = (value: unknown) => createQuery({ filters: [{ columnId: 'a', operator: 'equals', value } as never] });

    it.each([
        ['an empty array and an empty object', [], {}],
        ['a date and an empty object', new Date(0), {}],
        ['an empty array and a date', [], new Date(0)],
    ])('treats %s as different, so the change refetches', (_name, left, right) => {
        expect(queriesEqual(withValue(left), withValue(right))).toBe(false);
        expect(queriesEqual(withValue(right), withValue(left))).toBe(false);
    });

    it('still treats the same shapes as equal', () => {
        expect(queriesEqual(withValue([]), withValue([]))).toBe(true);
        expect(queriesEqual(withValue({}), withValue({}))).toBe(true);
        expect(queriesEqual(withValue(new Date(5)), withValue(new Date(5)))).toBe(true);
    });
});

describe('a page size or index that is not a finite number', () => {
    it.each([Infinity, -Infinity, NaN])('falls back to the default page size for %s', (size) => {
        expect(normalizeQuery(createQuery({ pagination: { pageIndex: 0, pageSize: size } })).pagination.pageSize).toBe(DEFAULT_PAGE_SIZE);
    });

    it.each([Infinity, -Infinity, NaN])('falls back to the first page for an index of %s', (index) => {
        expect(normalizeQuery(createQuery({ pagination: { pageIndex: index, pageSize: 10 } })).pagination.pageIndex).toBe(0);
    });

    it('leaves a finite size and index alone', () => {
        expect(normalizeQuery(createQuery({ pagination: { pageIndex: 3, pageSize: 40 } })).pagination).toEqual({ pageIndex: 3, pageSize: 40 });
    });
});

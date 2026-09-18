import { describe, expect, it } from 'vitest';
import { createQuery } from '../../src/core/query';
import type { ColumnDef, FilterSpec, GridQuery } from '../../src/core/types';
import { formatSearchParams, parseGridQuery, serializeGridQuery } from '../../src/react/url-sync/codec';

interface Ticket {
    id: number;
    status: string;
    score: number;
    code: string;
    flag: boolean;
}

const columns: readonly ColumnDef<Ticket>[] = [
    { id: 'status' },
    { id: 'score' },
    { id: 'code' },
    { id: 'flag' },
    { id: 'id', sortable: false, filterable: false },
];

const query = (partial: Partial<GridQuery>): GridQuery => createQuery(partial);

/** Serialize, format as the browser would show it, read it back, parse. The whole trip a link makes. */
const roundTrip = (value: GridQuery, options: Parameters<typeof serializeGridQuery>[1] = {}) =>
    parseGridQuery(new URLSearchParams(formatSearchParams(serializeGridQuery(value, options))), columns, options);

const parse = (search: string, options: Parameters<typeof parseGridQuery>[2] = {}) =>
    parseGridQuery(new URLSearchParams(search), columns, options);

describe('serializeGridQuery', () => {
    it('writes the compact form, readable once formatted', () => {
        const params = serializeGridQuery(
            query({
                search: 'north wing',
                sort: [
                    { columnId: 'score', direction: 'desc' },
                    { columnId: 'status', direction: 'asc' },
                ],
                filters: [
                    { columnId: 'status', operator: 'in', value: ['open', 'pending'] },
                    { columnId: 'score', operator: 'gt', value: 50 },
                ],
                pagination: { pageIndex: 2, pageSize: 50 },
            }),
        );

        expect(formatSearchParams(params)).toBe(
            'q=north%20wing&sort=score:desc,status:asc&f=status:in:open:pending,score:gt:50&page=3&size=50',
        );
    });

    it('writes nothing for the default query', () => {
        expect(serializeGridQuery(createQuery()).toString()).toBe('');
    });

    // A grid that starts sorted and was unsorted by the reader has to say so, or a reload brings the
    // sort back: absence means "the grid's own value".
    it('writes a facet cleared from a non-empty baseline as empty, and omits one equal to it', () => {
        const baseline = query({ sort: [{ columnId: 'status', direction: 'asc' }], pagination: { pageIndex: 0, pageSize: 50 } });

        expect(serializeGridQuery(baseline, { baseline }).toString()).toBe('');
        expect(serializeGridQuery({ ...baseline, sort: [] }, { baseline }).toString()).toBe('sort=');
        expect(parse('sort=', { baseline })).toEqual({ sort: [] });
    });

    it('prefixes every parameter', () => {
        const params = serializeGridQuery(query({ search: 'x', pagination: { pageIndex: 1, pageSize: 25 } }), { prefix: 'gw_' });
        expect(formatSearchParams(params)).toBe('gw_q=x&gw_page=2');
    });

    it('writes only the facets asked for', () => {
        const params = serializeGridQuery(query({ search: 'x', pagination: { pageIndex: 1, pageSize: 25 } }), { facets: ['page'] });
        expect(params.toString()).toBe('page=2');
    });

    it('leaves out a filter whose value cannot be written, rather than writing something else', () => {
        const params = serializeGridQuery(
            query({
                filters: [
                    { columnId: 'status', operator: 'eq', value: { nested: true } },
                    { columnId: 'score', operator: 'eq', value: Number.NaN },
                    { columnId: 'score', operator: 'between', value: [1] },
                    { columnId: 'code', operator: 'eq', value: 'kept' },
                ],
            }),
        );
        expect(params.get('f')).toBe('code:eq:kept');
    });
});

describe('the round trip', () => {
    // The reason values are typed: a server receives exactly what a click would have sent, and a
    // select choice compared with Object.is still finds its checkbox.
    it('keeps the type of every scalar value', () => {
        const filters: FilterSpec[] = [
            { columnId: 'score', operator: 'gt', value: 50 },
            { columnId: 'code', operator: 'eq', value: '50' },
            { columnId: 'flag', operator: 'eq', value: true },
            { columnId: 'status', operator: 'eq', value: 'true' },
            { columnId: 'status', operator: 'ne', value: null },
            { columnId: 'code', operator: 'in', value: ['7', 7, false, '[1]', '"quoted"', ''] },
            { columnId: 'score', operator: 'between', value: [10, 50] },
            { columnId: 'status', operator: 'isEmpty' },
        ];

        expect(roundTrip(query({ filters })).filters).toEqual(filters);
    });

    it('survives separators and escapes inside values', () => {
        const filters: FilterSpec[] = [{ columnId: 'code', operator: 'contains', value: 'a:b,c%2Cd 100% & more?#' }];
        expect(roundTrip(query({ filters })).filters).toEqual(filters);
    });

    it('reads a single value given to a multi-valued operator back as a list of one', () => {
        expect(roundTrip(query({ filters: [{ columnId: 'status', operator: 'in', value: 'open' }] })).filters).toEqual([
            { columnId: 'status', operator: 'in', value: ['open'] },
        ]);
    });

    it('keeps sort order, search and pagination', () => {
        const value = query({
            search: 'a:b, c',
            sort: [
                { columnId: 'score', direction: 'desc' },
                { columnId: 'status', direction: 'asc' },
            ],
            pagination: { pageIndex: 4, pageSize: 10 },
        });
        expect(roundTrip(value)).toEqual({ search: value.search, sort: value.sort, pagination: value.pagination });
    });
});

describe('parseGridQuery', () => {
    it('returns only the facets the parameters name', () => {
        expect(parse('')).toEqual({});
        expect(parse('q=ada')).toEqual({ search: 'ada' });
    });

    it('fills the missing half of the pagination from the baseline', () => {
        const baseline = query({ pagination: { pageIndex: 0, pageSize: 50 } });
        expect(parse('page=3', { baseline })).toEqual({ pagination: { pageIndex: 2, pageSize: 50 } });
        expect(parse('size=10', { baseline })).toEqual({ pagination: { pageIndex: 0, pageSize: 10 } });
    });

    it('drops an entry naming an unknown, unsortable or unfilterable column and keeps the rest', () => {
        expect(parse('sort=gone:asc,id:asc,score:desc')).toEqual({ sort: [{ columnId: 'score', direction: 'desc' }] });
        expect(parse('f=gone:eq:1,id:eq:1,score:gt:5')).toEqual({ filters: [{ columnId: 'score', operator: 'gt', value: 5 }] });
    });

    it('falls back to the grid\'s own value when nothing in a facet is valid', () => {
        expect(parse('sort=gone:asc&f=gone:eq:1')).toEqual({});
    });

    it('drops malformed entries without throwing', () => {
        const search = [
            'sort=score:sideways,score,:asc,score:asc:extra',
            'f=score:like:5,score:gt,score:gt:1:2,score:between:1,status:isEmpty:x,score:eq:{"a":1},score:eq:[1],score:eq:1e999',
            'page=0',
            'size=-5',
        ].join('&');
        expect(parse(search)).toEqual({});
    });

    it('accepts only positive integers for page and size', () => {
        for (const bad of ['0', '-1', '1.5', '1e3', ' 2', '0x10', '', '9999999999']) {
            expect(parse(`page=${encodeURIComponent(bad)}`)).toEqual({});
        }
    });

    // A link is written by whoever sent it. Without a bound, size=1000000 renders a million rows or
    // asks a server for them.
    it('refuses a page size above maxPageSize, which defaults to the larger of 100 and the grid\'s own', () => {
        expect(parse('size=100')).toEqual({ pagination: { pageIndex: 0, pageSize: 100 } });
        expect(parse('size=101')).toEqual({});
        expect(parse('size=500', { baseline: query({ pagination: { pageIndex: 0, pageSize: 500 } }) })).toEqual({
            pagination: { pageIndex: 0, pageSize: 500 },
        });
        expect(parse('size=40', { maxPageSize: 30 })).toEqual({});
    });

    it('reaches no prototype through a crafted parameter or column id', () => {
        const hostile = ['__proto__', 'constructor', 'prototype'];
        const search = [
            ...hostile.map((name) => `${name}=1`),
            `sort=${hostile.map((name) => `${name}:asc`).join(',')}`,
            `f=${hostile.map((name) => `${name}:eq:{"polluted":true}`).join(',')},score:${hostile[0]}:1,score:constructor:1`,
        ].join('&');

        const parsed = parse(search);

        expect(parsed).toEqual({});
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    });

    it('does not read a facet it was not asked for', () => {
        expect(parse('q=ada&page=2', { facets: ['search'] })).toEqual({ search: 'ada' });
    });

    it('reads a prefixed grid and ignores the unprefixed parameters of another', () => {
        expect(parse('q=other&gw_q=mine', { prefix: 'gw_' })).toEqual({ search: 'mine' });
    });
});

describe('formatSearchParams', () => {
    it('reads back through URLSearchParams to the same parameters', () => {
        const params = new URLSearchParams();
        params.append('a b', 'x+y z&=?#%');
        params.append('list', 'a:b,c');
        params.append('empty', '');

        const formatted = formatSearchParams(params);

        expect(formatted).toBe('a%20b=x%2By%20z%26%3D%3F%23%25&list=a:b,c&empty=');
        expect([...new URLSearchParams(formatted)]).toEqual([...params]);
    });
});

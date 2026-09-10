import type { FilterSpec, GridQuery, SortSpec } from './types';

export const DEFAULT_PAGE_SIZE = 25;

export function createQuery(initial?: Partial<GridQuery>): GridQuery {
    return normalizeQuery({
        sort: initial?.sort ?? [],
        filters: initial?.filters ?? [],
        search: initial?.search ?? '',
        pagination: {
            pageIndex: initial?.pagination?.pageIndex ?? 0,
            pageSize: initial?.pagination?.pageSize ?? DEFAULT_PAGE_SIZE,
        },
    });
}

/**
 * Repairs a query into a shape the pipeline and a remote server can both rely on.
 *
 * Every entry point funnels through here, so a caller passing `pageIndex: -1` or `pageSize: 0`
 * cannot produce a slice that throws deep inside the pagination stage. A `pageSize` of zero in
 * particular used to mean "divide by zero" when computing the page count.
 */
export function normalizeQuery(query: GridQuery): GridQuery {
    const pageSize = Math.max(1, Math.floor(query.pagination.pageSize) || DEFAULT_PAGE_SIZE);
    const pageIndex = Math.max(0, Math.floor(query.pagination.pageIndex) || 0);

    return {
        sort: dedupeSort(query.sort),
        filters: dedupeFilters(query.filters),
        search: query.search ?? '',
        pagination: { pageIndex, pageSize },
    };
}

/** Last write wins per column, and order is preserved: it is the tie-break order for sorting. */
function dedupeSort(sort: readonly SortSpec[]): readonly SortSpec[] {
    const byColumn = new Map<string, SortSpec>();
    for (const spec of sort) {
        byColumn.set(spec.columnId, spec);
    }
    return [...byColumn.values()];
}

function dedupeFilters(filters: readonly FilterSpec[]): readonly FilterSpec[] {
    const byKey = new Map<string, FilterSpec>();
    for (const filter of filters) {
        byKey.set(`${filter.columnId}::${filter.operator}`, filter);
    }
    return [...byKey.values()];
}

/**
 * Structural equality over the parts a fetch depends on.
 *
 * The engine refetches only when this says the query actually moved, so a component that rebuilds
 * its query object on every render does not produce a request per render.
 */
export function queriesEqual(a: GridQuery, b: GridQuery): boolean {
    if (a === b) return true;
    if (a.search !== b.search) return false;
    if (a.pagination.pageIndex !== b.pagination.pageIndex) return false;
    if (a.pagination.pageSize !== b.pagination.pageSize) return false;
    if (a.sort.length !== b.sort.length) return false;
    if (a.filters.length !== b.filters.length) return false;

    for (let index = 0; index < a.sort.length; index += 1) {
        const left = a.sort[index]!;
        const right = b.sort[index]!;
        if (left.columnId !== right.columnId || left.direction !== right.direction) return false;
    }

    for (let index = 0; index < a.filters.length; index += 1) {
        const left = a.filters[index]!;
        const right = b.filters[index]!;
        if (left.columnId !== right.columnId || left.operator !== right.operator) return false;
        if (!sameFilterValue(left.value, right.value)) return false;
    }

    return true;
}

function sameFilterValue(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item, index) => sameFilterValue(item, b[index]));
    }
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (a === null || b === null || a === undefined || b === undefined) return false;
    if (typeof a === 'object' && typeof b === 'object') {
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch {
            return false;
        }
    }
    return false;
}

/**
 * A query change that reshapes the result set must return to the first page.
 *
 * Otherwise filtering a 400-row grid while on page 12 lands the reader on an empty page, which
 * looks exactly like "the filter matched nothing". Re-sorting is in the list for the same reason:
 * page 12 of a differently ordered set holds different rows, and the reader did not ask to move.
 */
export function resetsPage(previous: GridQuery, next: GridQuery): boolean {
    if (previous.search !== next.search) return true;
    if (previous.pagination.pageSize !== next.pagination.pageSize) return true;
    if (!sameFilters(previous.filters, next.filters)) return true;
    return !sameSort(previous.sort, next.sort);
}

function sameSort(a: readonly SortSpec[], b: readonly SortSpec[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((spec, index) => {
        const other = b[index]!;
        return spec.columnId === other.columnId && spec.direction === other.direction;
    });
}

function sameFilters(a: readonly FilterSpec[], b: readonly FilterSpec[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((filter, index) => {
        const other = b[index]!;
        return (
            filter.columnId === other.columnId &&
            filter.operator === other.operator &&
            sameFilterValue(filter.value, other.value)
        );
    });
}

import { createQuery } from '../../core/query';
import type { ColumnDef, ColumnValue, FilterOperator, FilterSpec, GridQuery, PaginationSpec, SortSpec } from '../../core/types';
import type { GridQueryParamsOptions, ParseGridQueryOptions, UrlSyncFacet } from './types';

export const URL_SYNC_FACETS: readonly UrlSyncFacet[] = ['search', 'sort', 'filters', 'page', 'size'];

const PARAMETER: Readonly<Record<UrlSyncFacet, string>> = {
    search: 'q',
    sort: 'sort',
    filters: 'f',
    page: 'page',
    size: 'size',
};

/** The parameter names one grid owns, in the order they are written. */
export const parameterNames = (prefix = ''): readonly string[] => URL_SYNC_FACETS.map((facet) => prefix + PARAMETER[facet]);

type Arity = 'none' | 'one' | 'two' | 'many';

/**
 * How many values each operator takes in a URL. A `Record` over the type, so an operator added to the
 * core fails to compile here instead of being silently unreadable; a `Map` at runtime, so a parameter
 * spelled `__proto__` or `constructor` finds nothing.
 */
const ARITY_BY_OPERATOR: Readonly<Record<FilterOperator, Arity>> = {
    eq: 'one',
    ne: 'one',
    contains: 'one',
    notContains: 'one',
    startsWith: 'one',
    endsWith: 'one',
    gt: 'one',
    gte: 'one',
    lt: 'one',
    lte: 'one',
    between: 'two',
    in: 'many',
    notIn: 'many',
    isEmpty: 'none',
    isNotEmpty: 'none',
};
const ARITY = new Map<string, Arity>(Object.entries(ARITY_BY_OPERATOR));

const POSITIVE_INTEGER = /^[1-9][0-9]{0,8}$/;

// ---------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------

const ESCAPES: Readonly<Record<string, string>> = { '%': '%25', ':': '%3A', ',': '%2C' };

/** Escapes the separators, and the escape character itself, inside one piece. */
const escapePiece = (text: string): string => text.replace(/[%:,]/g, (character) => ESCAPES[character]!);

/**
 * Undoes `escapePiece`, and nothing else: any other `%xx` stays as it was, because it was never
 * this codec's to decode.
 */
const unescapePiece = (text: string): string =>
    text.replace(/%(25|3A|2C)/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

type Scalar = string | number | boolean | null;

const isScalar = (value: unknown): value is Scalar =>
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value));

/**
 * One value as a piece: a string bare unless it would read back as something else, everything else
 * as JSON. That keeps `status:eq:active` readable and still tells `50` from `"50"`, which a server
 * and a `select` choice both care about.
 */
function writeScalar(value: unknown): string | null {
    if (!isScalar(value)) return null;
    if (typeof value !== 'string') return escapePiece(JSON.stringify(value));
    try {
        JSON.parse(value);
    } catch {
        return escapePiece(value);
    }
    return escapePiece(JSON.stringify(value));
}

/** The mirror of `writeScalar`. Anything that parses to more than a scalar is refused, not coerced. */
function readScalar(piece: string): { readonly value: Scalar } | null {
    const text = unescapePiece(piece);
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { value: text };
    }
    return isScalar(parsed) ? { value: parsed } : null;
}

// ---------------------------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------------------------

const writeSort = (sort: readonly SortSpec[]): string =>
    sort.map((spec) => `${escapePiece(spec.columnId)}:${spec.direction}`).join(',');

function writeFilter(filter: FilterSpec): string | null {
    const arity = ARITY.get(filter.operator);
    if (arity === undefined) return null;

    const { value } = filter;
    let values: readonly unknown[];
    if (arity === 'none') values = [];
    else if (arity === 'one') values = [value];
    else if (arity === 'two') {
        // `between` reads the first two bounds and ignores the rest, so the first two are the filter.
        if (!Array.isArray(value) || value.length < 2) return null;
        values = value.slice(0, 2);
    } else values = Array.isArray(value) ? value : [value];

    const pieces = [escapePiece(filter.columnId), filter.operator];
    for (const item of values) {
        const piece = writeScalar(item);
        if (piece === null) return null;
        pieces.push(piece);
    }
    return pieces.join(':');
}

/** A filter whose value cannot be written is left out, rather than written as something it is not. */
const writeFilters = (filters: readonly FilterSpec[]): string =>
    filters.flatMap((filter) => {
        const written = writeFilter(filter);
        return written === null ? [] : [written];
    }).join(',');

/**
 * The query as URL parameters, holding only what differs from `baseline`.
 *
 *     serializeGridQuery(api.getState().query).toString()
 *     // q=north&sort=score%3Adesc&page=3  (see formatSearchParams for the readable form)
 *
 * A facet cleared from a non-empty baseline is written empty (`sort=`), because leaving it out would
 * mean the baseline's value again.
 */
export function serializeGridQuery(query: GridQuery, options: GridQueryParamsOptions = {}): URLSearchParams {
    const baseline = options.baseline ?? createQuery();
    const facets = new Set(options.facets ?? URL_SYNC_FACETS);
    const prefix = options.prefix ?? '';
    const params = new URLSearchParams();

    if (facets.has('search') && query.search !== baseline.search) params.set(prefix + PARAMETER.search, query.search);

    if (facets.has('sort')) {
        const sort = writeSort(query.sort);
        if (sort !== writeSort(baseline.sort)) params.set(prefix + PARAMETER.sort, sort);
    }

    if (facets.has('filters')) {
        const filters = writeFilters(query.filters);
        if (filters !== writeFilters(baseline.filters)) params.set(prefix + PARAMETER.filters, filters);
    }

    const { pageIndex, pageSize } = query.pagination;
    if (facets.has('page') && pageIndex !== baseline.pagination.pageIndex) {
        params.set(prefix + PARAMETER.page, String(pageIndex + 1));
    }
    if (facets.has('size') && pageSize !== baseline.pagination.pageSize) {
        params.set(prefix + PARAMETER.size, String(pageSize));
    }

    return params;
}

type ColumnLookup = ReadonlyMap<string, ColumnDef<unknown, ColumnValue>>;

function readSort(text: string, columns: ColumnLookup): SortSpec[] {
    const sort: SortSpec[] = [];
    for (const entry of text.split(',')) {
        const pieces = entry.split(':');
        if (pieces.length !== 2) continue;
        const columnId = unescapePiece(pieces[0]!);
        const direction = pieces[1];
        if (direction !== 'asc' && direction !== 'desc') continue;
        const column = columns.get(columnId);
        if (!column || column.sortable === false) continue;
        sort.push({ columnId, direction });
    }
    return sort;
}

function readFilter(entry: string, columns: ColumnLookup): FilterSpec | null {
    const [idPiece, operator, ...valuePieces] = entry.split(':');
    if (idPiece === undefined || operator === undefined) return null;

    const arity = ARITY.get(operator);
    if (arity === undefined) return null;
    if (arity === 'none' && valuePieces.length !== 0) return null;
    if (arity === 'one' && valuePieces.length !== 1) return null;
    if (arity === 'two' && valuePieces.length !== 2) return null;

    const columnId = unescapePiece(idPiece);
    const column = columns.get(columnId);
    if (!column || column.filterable === false) return null;

    const values: Scalar[] = [];
    for (const piece of valuePieces) {
        const read = readScalar(piece);
        if (read === null) return null;
        values.push(read.value);
    }

    const typed = operator as FilterOperator;
    if (arity === 'none') return { columnId, operator: typed };
    if (arity === 'one') return { columnId, operator: typed, value: values[0] };
    return { columnId, operator: typed, value: values };
}

function readFilters(text: string, columns: ColumnLookup): FilterSpec[] {
    const filters: FilterSpec[] = [];
    for (const entry of text.split(',')) {
        const filter = readFilter(entry, columns);
        if (filter) filters.push(filter);
    }
    return filters;
}

const readPositive = (text: string | null): number | null =>
    text !== null && POSITIVE_INTEGER.test(text) ? Number(text) : null;

/** The page size a URL may ask for when nothing else was said. */
export const defaultMaxPageSize = (baseline: GridQuery): number => Math.max(100, baseline.pagination.pageSize);

/**
 * The query the parameters describe, as far as they describe it validly.
 *
 * Returns only the facets the parameters name. An entry naming a column the grid does not have, or
 * one that cannot be sorted or filtered, an unknown operator, the wrong number of values, or a page
 * that is not a positive integer is dropped; a facet left with nothing valid is not returned, so the
 * grid's own value stands. An empty `sort=` or `f=` is returned as empty: someone cleared it.
 *
 * Nothing here throws, and nothing is keyed by a parameter's name, so a crafted URL can neither blank
 * the grid nor reach a prototype.
 */
export function parseGridQuery<TRow>(
    params: URLSearchParams,
    columns: readonly ColumnDef<TRow, ColumnValue>[],
    options: ParseGridQueryOptions = {},
): Partial<GridQuery> {
    const baseline = options.baseline ?? createQuery();
    const facets = new Set(options.facets ?? URL_SYNC_FACETS);
    const prefix = options.prefix ?? '';
    const lookup: ColumnLookup = new Map(columns.map((column) => [column.id, column as ColumnDef<unknown, ColumnValue>]));

    const result: { search?: string; sort?: readonly SortSpec[]; filters?: readonly FilterSpec[]; pagination?: PaginationSpec } = {};

    if (facets.has('search')) {
        const search = params.get(prefix + PARAMETER.search);
        if (search !== null) result.search = search;
    }

    if (facets.has('sort')) {
        const text = params.get(prefix + PARAMETER.sort);
        if (text === '') result.sort = [];
        else if (text !== null) {
            const sort = readSort(text, lookup);
            if (sort.length > 0) result.sort = sort;
        }
    }

    if (facets.has('filters')) {
        const text = params.get(prefix + PARAMETER.filters);
        if (text === '') result.filters = [];
        else if (text !== null) {
            const filters = readFilters(text, lookup);
            if (filters.length > 0) result.filters = filters;
        }
    }

    const page = facets.has('page') ? readPositive(params.get(prefix + PARAMETER.page)) : null;
    const requestedSize = facets.has('size') ? readPositive(params.get(prefix + PARAMETER.size)) : null;
    const size = requestedSize !== null && requestedSize <= (options.maxPageSize ?? defaultMaxPageSize(baseline)) ? requestedSize : null;
    if (page !== null || size !== null) {
        result.pagination = {
            pageIndex: page !== null ? page - 1 : baseline.pagination.pageIndex,
            pageSize: size ?? baseline.pagination.pageSize,
        };
    }

    return result;
}

const encodeQueryPart = (text: string): string => encodeURIComponent(text).replace(/%3A/g, ':').replace(/%2C/g, ',');

/**
 * Parameters as a query string, without the `?`, that a person can read.
 *
 * `URLSearchParams.toString()` percent-encodes `:` and `,`, which turns `sort=score:desc` into
 * `sort=score%3Adesc`. Both are legal in a query, so this leaves them alone; everything else is
 * encoded as `encodeURIComponent` does, and a space is `%20`. `new URLSearchParams()` reads the
 * result back to the same parameters.
 */
export function formatSearchParams(params: URLSearchParams): string {
    const parts: string[] = [];
    params.forEach((value, name) => {
        parts.push(`${encodeQueryPart(name)}=${encodeQueryPart(value)}`);
    });
    return parts.join('&');
}

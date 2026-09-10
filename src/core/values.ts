import type { FilterSpec } from './types';

/** Null and undefined sort last in both directions, so a blank never displaces real data. */
const NULLISH_RANK = 1;

export function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined;
}

/**
 * Renders any value as comparable text. Used by global search and by the default cell of an
 * adapter, so a column with no `formatValue` still searches on something sensible.
 */
export function toText(value: unknown): string {
    if (isNullish(value)) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(toText).join(', ');
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value) ?? '';
        } catch {
            return '';
        }
    }
    return String(value);
}

/**
 * The default column comparator.
 *
 * Numbers and dates compare numerically, strings compare with `localeCompare` so accented text
 * orders the way a reader expects, and mixed types fall back to text. Sorting a numeric column
 * lexicographically is the classic grid bug this exists to prevent.
 */
export function compareValues(a: unknown, b: unknown): number {
    const aNull = isNullish(a);
    const bNull = isNullish(b);
    if (aNull && bNull) return 0;
    if (aNull) return NULLISH_RANK;
    if (bNull) return -NULLISH_RANK;

    if (typeof a === 'number' && typeof b === 'number') {
        if (Number.isNaN(a) && Number.isNaN(b)) return 0;
        if (Number.isNaN(a)) return NULLISH_RANK;
        if (Number.isNaN(b)) return -NULLISH_RANK;
        return a - b;
    }

    if (typeof a === 'boolean' && typeof b === 'boolean') {
        return Number(a) - Number(b);
    }

    if (a instanceof Date && b instanceof Date) {
        return a.getTime() - b.getTime();
    }

    if (typeof a === 'bigint' && typeof b === 'bigint') {
        return a < b ? -1 : a > b ? 1 : 0;
    }

    return toText(a).localeCompare(toText(b), undefined, { numeric: true, sensitivity: 'base' });
}

function toComparable(value: unknown): number | string | null {
    if (isNullish(value)) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return Number(value);
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
        const asDate = Date.parse(value);
        if (!Number.isNaN(asDate) && /\d{4}-\d{2}-\d{2}/.test(value)) return asDate;
        const asNumber = Number(value);
        if (value.trim() !== '' && !Number.isNaN(asNumber)) return asNumber;
        return value;
    }
    return toText(value);
}

function relational(value: unknown, target: unknown): number | null {
    const left = toComparable(value);
    const right = toComparable(target);
    if (left === null || right === null) return null;
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right), undefined, { numeric: true });
}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);

const looseEquals = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (isNullish(a) || isNullish(b)) return false;
    if (a instanceof Date || b instanceof Date) return toComparable(a) === toComparable(b);
    if (typeof a === 'number' || typeof b === 'number') {
        const left = toComparable(a);
        const right = toComparable(b);
        return left !== null && right !== null && left === right;
    }
    return toText(a).toLowerCase() === toText(b).toLowerCase();
};

/**
 * Applies one filter to one value using the shared operator vocabulary.
 *
 * A column may replace this entirely with its own `filterFn`. What must not happen is two
 * different meanings for the same operator name: the client-side answer here and a server that
 * implements `contains` are expected to agree, which is why the semantics are written down rather
 * than left to each caller.
 */
export function matchesFilter(value: unknown, filter: FilterSpec): boolean {
    const { operator, value: target } = filter;

    switch (operator) {
        case 'isEmpty':
            return isNullish(value) || toText(value).trim() === '';
        case 'isNotEmpty':
            return !isNullish(value) && toText(value).trim() !== '';
        case 'eq':
            return looseEquals(value, target);
        case 'ne':
            return !looseEquals(value, target);
        case 'contains':
            return toText(value).toLowerCase().includes(toText(target).toLowerCase());
        case 'notContains':
            return !toText(value).toLowerCase().includes(toText(target).toLowerCase());
        case 'startsWith':
            return toText(value).toLowerCase().startsWith(toText(target).toLowerCase());
        case 'endsWith':
            return toText(value).toLowerCase().endsWith(toText(target).toLowerCase());
        case 'gt': {
            const diff = relational(value, target);
            return diff !== null && diff > 0;
        }
        case 'gte': {
            const diff = relational(value, target);
            return diff !== null && diff >= 0;
        }
        case 'lt': {
            const diff = relational(value, target);
            return diff !== null && diff < 0;
        }
        case 'lte': {
            const diff = relational(value, target);
            return diff !== null && diff <= 0;
        }
        case 'between': {
            const bounds = asArray(target);
            if (bounds.length < 2) return false;
            const lower = relational(value, bounds[0]);
            const upper = relational(value, bounds[1]);
            return lower !== null && upper !== null && lower >= 0 && upper <= 0;
        }
        case 'in':
            return asArray(target).some((candidate) => looseEquals(value, candidate));
        case 'notIn':
            return !asArray(target).some((candidate) => looseEquals(value, candidate));
        default: {
            // An unknown operator must not silently drop every row: that reads as "the server
            // returned nothing" and sends the reader looking in the wrong place entirely.
            const exhaustive: never = operator;
            console.warn(`[gridwright] unknown filter operator "${String(exhaustive)}", filter ignored`);
            return true;
        }
    }
}

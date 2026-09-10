import { describe, expect, it } from 'vitest';
import { compareValues, matchesFilter, toText } from '../../src/core/values';

describe('toText', () => {
    it('renders primitives, dates and arrays as readable text', () => {
        expect(toText('a')).toBe('a');
        expect(toText(12)).toBe('12');
        expect(toText(true)).toBe('true');
        expect(toText(new Date('2020-01-02T00:00:00.000Z'))).toBe('2020-01-02T00:00:00.000Z');
        expect(toText(['a', 'b'])).toBe('a, b');
    });

    it('renders null and undefined as an empty string rather than their names', () => {
        // A cell reading "undefined" is the single most common way a grid leaks its internals.
        expect(toText(null)).toBe('');
        expect(toText(undefined)).toBe('');
    });
});

describe('compareValues', () => {
    it('compares numbers numerically, not lexicographically', () => {
        expect(compareValues(9, 10)).toBeLessThan(0);
        expect(compareValues(100, 99)).toBeGreaterThan(0);
    });

    it('sorts nullish values last regardless of direction', () => {
        expect(compareValues(null, 5)).toBeGreaterThan(0);
        expect(compareValues(5, undefined)).toBeLessThan(0);
        expect(compareValues(null, undefined)).toBe(0);
    });

    it('compares dates chronologically', () => {
        expect(compareValues(new Date('2020-01-01'), new Date('2021-01-01'))).toBeLessThan(0);
    });

    it('orders embedded numbers naturally in strings', () => {
        expect(compareValues('item 2', 'item 10')).toBeLessThan(0);
    });
});

describe('matchesFilter', () => {
    const filter = (operator: string, value?: unknown) =>
        ({ columnId: 'x', operator, value }) as never;

    it('matches equality loosely across string and number representations', () => {
        expect(matchesFilter(10, filter('eq', '10'))).toBe(true);
        expect(matchesFilter('Ada', filter('eq', 'ada'))).toBe(true);
        expect(matchesFilter(10, filter('ne', 11))).toBe(true);
    });

    it('matches text operators case-insensitively', () => {
        expect(matchesFilter('Ada Lovelace', filter('contains', 'love'))).toBe(true);
        expect(matchesFilter('Ada Lovelace', filter('notContains', 'grace'))).toBe(true);
        expect(matchesFilter('Ada Lovelace', filter('startsWith', 'ada'))).toBe(true);
        expect(matchesFilter('Ada Lovelace', filter('endsWith', 'LACE'))).toBe(true);
    });

    it('compares relationally on numbers and on date strings', () => {
        expect(matchesFilter(10, filter('gt', 5))).toBe(true);
        expect(matchesFilter(10, filter('gte', 10))).toBe(true);
        expect(matchesFilter(10, filter('lt', 5))).toBe(false);
        expect(matchesFilter('2021-06-01', filter('gte', '2021-01-01'))).toBe(true);
    });

    it('treats between as inclusive on both bounds', () => {
        expect(matchesFilter(5, filter('between', [5, 10]))).toBe(true);
        expect(matchesFilter(10, filter('between', [5, 10]))).toBe(true);
        expect(matchesFilter(11, filter('between', [5, 10]))).toBe(false);
    });

    it('handles set membership and emptiness', () => {
        expect(matchesFilter('a', filter('in', ['a', 'b']))).toBe(true);
        expect(matchesFilter('c', filter('notIn', ['a', 'b']))).toBe(true);
        expect(matchesFilter('   ', filter('isEmpty'))).toBe(true);
        expect(matchesFilter(null, filter('isEmpty'))).toBe(true);
        expect(matchesFilter('x', filter('isNotEmpty'))).toBe(true);
    });

    it('keeps every row when the operator is unknown', () => {
        // Dropping rows for an operator the client does not implement reads as "no results" and
        // sends the reader hunting through their data instead of their filter.
        expect(matchesFilter('anything', filter('sounds-like', 'x'))).toBe(true);
    });

    it('refuses a relational comparison against a nullish value', () => {
        expect(matchesFilter(null, filter('gt', 5))).toBe(false);
        expect(matchesFilter(5, filter('lt', null))).toBe(false);
    });
});

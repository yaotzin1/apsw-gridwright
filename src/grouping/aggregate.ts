import { compareValues } from '../core/values';
import type { AggregateSpecFn } from './types';

function toNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

/**
 * Reduces one column's values (and the rows they came from) to one aggregate result.
 *
 * `sum` and `avg` skip a value that is not a finite number rather than producing `NaN`, the same
 * way a spreadsheet's SUM ignores text in a numeric range. `min` and `max` compare with the same
 * `compareValues` the engine sorts with, so they work on dates and strings too, not only numbers.
 */
export function computeAggregate<TRow>(fn: AggregateSpecFn<TRow>, values: readonly unknown[], rows: readonly TRow[]): unknown {
    if (typeof fn === 'function') return fn(values, rows);

    switch (fn) {
        case 'count':
            return rows.length;

        case 'sum': {
            const numbers = values.map(toNumber).filter((value): value is number => value !== null);
            return numbers.reduce((total, value) => total + value, 0);
        }

        case 'avg': {
            const numbers = values.map(toNumber).filter((value): value is number => value !== null);
            if (numbers.length === 0) return undefined;
            return numbers.reduce((total, value) => total + value, 0) / numbers.length;
        }

        case 'min':
        case 'max': {
            let best: unknown;
            let has = false;
            for (const value of values) {
                if (value === null || value === undefined) continue;
                if (!has) {
                    best = value;
                    has = true;
                    continue;
                }
                const comparison = compareValues(value, best);
                if ((fn === 'min' && comparison < 0) || (fn === 'max' && comparison > 0)) best = value;
            }
            return has ? best : undefined;
        }

        default:
            return undefined;
    }
}

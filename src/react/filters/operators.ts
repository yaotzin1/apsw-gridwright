import type { FilterOperator, FilterSpec } from '../../core/types';
import type { ColumnFilterOptions, ColumnFilterType } from './types';

/**
 * The conditions each type offers, in menu order. The first is where a new filter starts.
 *
 * Every entry is an operator the core already defines and `matchesFilter` already implements, and
 * that a server declaring `filter: true` already receives. The dialog adds no vocabulary of its own:
 * a condition here that the pipeline did not understand would be a filter that silently kept every
 * row.
 */
export const COLUMN_FILTER_OPERATORS: Readonly<Record<ColumnFilterType, readonly FilterOperator[]>> = {
    text: ['contains', 'notContains', 'eq', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'],
    number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'isEmpty', 'isNotEmpty'],
    date: ['eq', 'gt', 'lt', 'between', 'isEmpty', 'isNotEmpty'],
    select: ['in', 'notIn'],
};

export const filterTypeOf = (options: ColumnFilterOptions | undefined): ColumnFilterType =>
    options?.type ?? 'text';

export function operatorsFor(options: ColumnFilterOptions | undefined): readonly FilterOperator[] {
    const offered = options?.operators;
    return offered && offered.length > 0 ? offered : COLUMN_FILTER_OPERATORS[filterTypeOf(options)];
}

/** Conditions that describe the value's absence and so take no input at all. */
export const takesNoValue = (operator: FilterOperator): boolean =>
    operator === 'isEmpty' || operator === 'isNotEmpty';

/**
 * What the dialog is editing. Text in, because every input is text; typed only when applied.
 *
 * `picked` holds indices into the column's choices rather than the values themselves, so a choice
 * whose value is an object or `false` survives a checkbox round trip unchanged.
 */
export interface FilterDraft {
    readonly operator: FilterOperator;
    readonly value: string;
    readonly to: string;
    readonly picked: readonly number[];
}

/**
 * The draft a dialog opens on: the column's current filter, or a blank one.
 *
 * A filter set by code with a condition this column does not offer starts the dialog blank rather
 * than being rewritten into one it does, which would change the rows before the reader chose to.
 */
export function draftFrom(filter: FilterSpec | null, options: ColumnFilterOptions | undefined): FilterDraft {
    const offered = operatorsFor(options);
    const blank: FilterDraft = { operator: offered[0] ?? 'contains', value: '', to: '', picked: [] };
    if (!filter || !offered.includes(filter.operator)) return blank;

    const { operator, value } = filter;
    if (takesNoValue(operator)) return { ...blank, operator };

    if (operator === 'in' || operator === 'notIn') {
        const wanted = Array.isArray(value) ? value : [value];
        const picked = (options?.choices ?? []).flatMap((choice, index) =>
            wanted.some((candidate) => Object.is(candidate, choice.value)) ? [index] : [],
        );
        return { ...blank, operator, picked };
    }

    if (operator === 'between') {
        const [from, to] = Array.isArray(value) ? value : [];
        return { ...blank, operator, value: textOf(from), to: textOf(to) };
    }

    return { ...blank, operator, value: textOf(value) };
}

const textOf = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/**
 * The filter a draft means, or null while it is incomplete.
 *
 * Incomplete is a blank value, a missing bound, a number that does not parse, or no choice ticked.
 * Null keeps Apply off rather than applying something the reader did not finish saying: a blank
 * "contains" matches every row, and a `NaN` bound matches none.
 */
export function specFrom(
    draft: FilterDraft,
    options: ColumnFilterOptions | undefined,
): Omit<FilterSpec, 'columnId'> | null {
    const { operator } = draft;
    if (takesNoValue(operator)) return { operator };

    if (operator === 'in' || operator === 'notIn') {
        const choices = options?.choices ?? [];
        const values = draft.picked.flatMap((index) => (index < choices.length ? [choices[index]!.value] : []));
        return values.length > 0 ? { operator, value: values } : null;
    }

    const type = filterTypeOf(options);
    const from = parse(draft.value, type);
    if (from === null) return null;

    if (operator === 'between') {
        const to = parse(draft.to, type);
        return to === null ? null : { operator, value: [from, to] };
    }

    return { operator, value: from };
}

/**
 * One input's text as the value the column's type means.
 *
 * Text is sent as typed, trimmed only to decide whether anything was typed, because a server
 * matching `contains` on a leading space was asked for one. Dates stay `YYYY-MM-DD` strings, which
 * `matchesFilter` compares as timestamps and which survive JSON unchanged.
 */
function parse(raw: string, type: ColumnFilterType): string | number | null {
    if (raw.trim() === '') return null;
    if (type !== 'number') return raw;
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
}

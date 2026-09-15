import type { FilterOperator } from '../../core/types';
import type { AddonMessages } from '../../i18n/messages';
import type { ColumnFilterType } from './types';

export const FILTERS_ADDON = 'gridwright:filters';

/** English. The translations live in `apsw-gridwright/locales`, under `addons['gridwright:filters']`. */
export const filterMessages: AddonMessages = {
    en: {
        // The header's filter button. Named for the column, and for its state, because the only other
        // sign that a column is filtered is a colour.
        open: 'Filter {column}',
        openActive: 'Filter {column}, filtered',
        condition: 'Condition',
        value: 'Value',
        from: 'From',
        to: 'To',
        values: 'Values',
        apply: 'Apply',
        clear: 'Clear filter',
        clearAll: {
            one: 'Clear {count} filter',
            other: 'Clear {count} filters',
        },
        'op.contains': 'Contains',
        'op.notContains': 'Does not contain',
        'op.eq': 'Equals',
        'op.ne': 'Does not equal',
        'op.startsWith': 'Starts with',
        'op.endsWith': 'Ends with',
        'op.gt': 'Greater than',
        'op.gte': 'Greater than or equal to',
        'op.lt': 'Less than',
        'op.lte': 'Less than or equal to',
        'op.between': 'Between',
        'op.in': 'Is any of',
        'op.notIn': 'Is none of',
        'op.isEmpty': 'Is empty',
        'op.isNotEmpty': 'Is not empty',
        // The same `eq`, `gt` and `lt` on a date column. "Greater than 1 March" is not how anyone says it.
        'op.on': 'On',
        'op.after': 'After',
        'op.before': 'Before',
        // Announced for the same reason as a sort: the trigger that caused it is in a header the
        // reader's focus has already returned to, and nothing else says the rows changed on purpose.
        applied: '{column}, filtered',
        removed: '{column}, filter removed',
    },
};

const DATE_OPERATOR_KEYS: Partial<Record<FilterOperator, string>> = { eq: 'op.on', gt: 'op.after', lt: 'op.before' };

/**
 * A condition's name. A date column says "on", "after" and "before" for eq, gt and lt; every other
 * pairing uses the operator's own key, so a new core operator shows up as a missing key in the audit
 * rather than rendering its id.
 */
export function operatorLabel(t: (key: string) => string, operator: FilterOperator, type: ColumnFilterType): string {
    const dateKey = type === 'date' ? DATE_OPERATOR_KEYS[operator] : undefined;
    return t(dateKey ?? `op.${operator}`);
}

/**
 * The message catalog: the translation contract for the grid.
 *
 * Keys are flat and dot-separated because that is what every translation toolchain already
 * consumes -- i18next, FormatJS, Lingui, Weblate, Crowdin, a plain JSON file in a repository. A
 * nested object would have to be flattened by every one of them.
 *
 * Placeholders are ICU-style `{name}`. Plural forms use the CLDR categories that
 * `Intl.PluralRules` returns, so a language with six of them is expressible without this package
 * shipping a plural library or a table of its own.
 */

/**
 * Every string the grid can render.
 *
 * Adding a key is a minor version. Removing or renaming one is a major, because a translator's
 * catalog is keyed on these and a missing key silently falls back to English.
 */
export type MessageKey =
    | 'search.placeholder'
    | 'search.label'
    | 'status.loading'
    | 'status.empty'
    | 'error.title'
    | 'error.retry'
    | 'error.stale'
    | 'error.staleDetail'
    | 'selection.row'
    | 'selection.all'
    | 'selection.count'
    | 'sort.ascending'
    | 'sort.descending'
    | 'sort.clear'
    | 'filter.open'
    | 'filter.openActive'
    | 'filter.condition'
    | 'filter.value'
    | 'filter.from'
    | 'filter.to'
    | 'filter.values'
    | 'filter.apply'
    | 'filter.clear'
    | 'filter.clearAll'
    | 'filter.op.contains'
    | 'filter.op.notContains'
    | 'filter.op.eq'
    | 'filter.op.ne'
    | 'filter.op.startsWith'
    | 'filter.op.endsWith'
    | 'filter.op.gt'
    | 'filter.op.gte'
    | 'filter.op.lt'
    | 'filter.op.lte'
    | 'filter.op.between'
    | 'filter.op.in'
    | 'filter.op.notIn'
    | 'filter.op.isEmpty'
    | 'filter.op.isNotEmpty'
    | 'filter.op.on'
    | 'filter.op.after'
    | 'filter.op.before'
    | 'pagination.previous'
    | 'pagination.next'
    | 'pagination.rowsPerPage'
    | 'pagination.range'
    | 'pagination.rangeUnknown'
    | 'a11y.sortedAscending'
    | 'a11y.sortedDescending'
    | 'a11y.sortCleared'
    | 'a11y.rowsShown'
    | 'a11y.rowsShownUnknown'
    | 'a11y.rowsTotal'
    | 'a11y.filterApplied'
    | 'a11y.filterCleared'
    | 'export.action'
    | 'export.csv'
    | 'export.excel'
    | 'export.markdown'
    | 'export.print'
    | 'export.inProgress'
    | 'export.complete'
    | 'export.rows'
    | 'export.scopeAll'
    | 'export.scopePage'
    | 'export.scopeSelected'
    | 'export.allUnavailable'
    | 'export.failed'
    | 'tree.expand'
    | 'tree.collapse'
    | 'tree.loadFailed'
    | 'tree.cycle'
    | 'tree.childCount';

/**
 * A message with one form per CLDR plural category.
 *
 * `other` is required and is the only form guaranteed to exist in every language. `zero` is an
 * exact match on the number zero rather than a category, following ICU, where an exact match wins
 * over a keyword. English has no `zero` category but often wants a distinct sentence for it.
 */
export interface PluralMessage {
    readonly zero?: string;
    readonly one?: string;
    readonly two?: string;
    readonly few?: string;
    readonly many?: string;
    readonly other: string;
}

export type Message = string | PluralMessage;

export type MessageCatalog = {
    readonly [K in MessageKey]: Message;
};

/** A catalog plus the locale it is written for. */
export interface LocaleCatalog {
    /** A BCP 47 language tag: `en`, `pl`, `pt-BR`. Drives plural rules and number formatting. */
    readonly locale: string;
    /** Overrides the direction derived from the locale. Rarely needed. */
    readonly direction?: 'ltr' | 'rtl';
    readonly messages: MessageCatalog;
}

/**
 * English, and the fallback for every other locale.
 *
 * A key missing from a translation resolves here rather than rendering the key itself. A reader
 * seeing one English word among their own language has a cosmetic problem; a reader seeing
 * `pagination.rowsPerPage` has a broken product.
 */
export const englishMessages: MessageCatalog = {
    'search.placeholder': 'Search',
    'search.label': 'Search rows',
    'status.loading': 'Loading rows',
    'status.empty': 'No rows to show',
    'error.title': 'The rows could not be loaded',
    'error.retry': 'Try again',
    // Shown when a refresh failed but the previous rows are still on screen. Without it the grid
    // silently presents stale data as current, which is the one thing it must never do.
    'error.stale': 'The rows could not be updated',
    'error.staleDetail': 'Showing what was last loaded',
    'selection.row': 'Select row',
    'selection.all': 'Select all rows on this page',
    'selection.count': {
        zero: 'None selected',
        one: '{count} selected',
        other: '{count} selected',
    },
    'sort.ascending': 'Sort ascending',
    'sort.descending': 'Sort descending',
    'sort.clear': 'Clear sort',
    // The header's filter button. Named for the column, and for its state, because the only other
    // sign that a column is filtered is a colour.
    'filter.open': 'Filter {column}',
    'filter.openActive': 'Filter {column}, filtered',
    'filter.condition': 'Condition',
    'filter.value': 'Value',
    'filter.from': 'From',
    'filter.to': 'To',
    'filter.values': 'Values',
    'filter.apply': 'Apply',
    'filter.clear': 'Clear filter',
    'filter.clearAll': {
        one: 'Clear {count} filter',
        other: 'Clear {count} filters',
    },
    'filter.op.contains': 'Contains',
    'filter.op.notContains': 'Does not contain',
    'filter.op.eq': 'Equals',
    'filter.op.ne': 'Does not equal',
    'filter.op.startsWith': 'Starts with',
    'filter.op.endsWith': 'Ends with',
    'filter.op.gt': 'Greater than',
    'filter.op.gte': 'Greater than or equal to',
    'filter.op.lt': 'Less than',
    'filter.op.lte': 'Less than or equal to',
    'filter.op.between': 'Between',
    'filter.op.in': 'Is any of',
    'filter.op.notIn': 'Is none of',
    'filter.op.isEmpty': 'Is empty',
    'filter.op.isNotEmpty': 'Is not empty',
    // The same `eq`, `gt` and `lt` on a date column. "Greater than 1 March" is not how anyone says it.
    'filter.op.on': 'On',
    'filter.op.after': 'After',
    'filter.op.before': 'Before',
    'pagination.previous': 'Previous page',
    'pagination.next': 'Next page',
    'pagination.rowsPerPage': 'Rows per page',
    'pagination.range': '{from}-{to} of {total}',
    'pagination.rangeUnknown': '{from}-{to} of many',
    // Announced through the live region rather than rendered. `aria-sort` records the sort on a
    // header cell the reader has already left, so activating the control is otherwise silent.
    'a11y.sortedAscending': '{column}, sorted ascending',
    'a11y.sortedDescending': '{column}, sorted descending',
    'a11y.sortCleared': '{column}, not sorted',
    'a11y.rowsShown': 'Showing {from} to {to} of {total}',
    // Never a computed total. A source that paginates without a count has not sent one.
    'a11y.rowsShownUnknown': 'Showing {from} to {to} of many',
    'a11y.rowsTotal': {
        one: '{count} row',
        other: '{count} rows',
    },
    // Announced for the same reason as a sort: the trigger that caused it is in a header the
    // reader's focus has already returned to, and nothing else says the rows changed on purpose.
    'a11y.filterApplied': '{column}, filtered',
    'a11y.filterCleared': '{column}, filter removed',
    'export.action': 'Export',
    'export.csv': 'Export as CSV',
    'export.excel': 'Export as Excel',
    'export.markdown': 'Export as Markdown',
    'export.print': 'Print',
    'export.inProgress': 'Preparing the {format} export',
    'export.complete': '{format} export ready',
    // The group heading above the three scopes in the export menu.
    'export.rows': 'Rows',
    'export.scopeAll': 'All matching rows',
    'export.scopePage': 'This page',
    // Counts only the selected rows that are loaded, because those are the ones the file will hold.
    'export.scopeSelected': {
        zero: 'Selected rows (none)',
        one: '{count} selected row',
        other: '{count} selected rows',
    },
    // Shown when a paginating source cannot hand over the rest. Says what the reader can do instead,
    // in words about the rows, not about the source code.
    'export.allUnavailable': 'Only this page or the selected rows can be exported from here',
    'export.failed': 'The {format} export could not be produced',
    'tree.expand': 'Expand',
    'tree.collapse': 'Collapse',
    'tree.loadFailed': 'The children could not be loaded',
    'tree.cycle': 'Already shown further up',
    'tree.childCount': {
        one: '{count} item inside',
        other: '{count} items inside',
    },
};

export const englishCatalog: LocaleCatalog = {
    locale: 'en',
    messages: englishMessages,
};

/** Every key, so a tool can check a catalog for completeness. */
export const messageKeys = Object.keys(englishMessages) as readonly MessageKey[];

/**
 * Reports the keys a catalog is missing and the keys it invented.
 *
 * Written for a CI step or a test: a catalog that has drifted from the key set fails loudly at
 * build time rather than rendering English into the middle of a translated page.
 */
export function auditCatalog(messages: Partial<MessageCatalog>): {
    readonly missing: readonly MessageKey[];
    readonly unknown: readonly string[];
} {
    const provided = Object.keys(messages);
    const known = new Set<string>(messageKeys);

    return {
        missing: messageKeys.filter((key) => messages[key] === undefined),
        unknown: provided.filter((key) => !known.has(key)),
    };
}

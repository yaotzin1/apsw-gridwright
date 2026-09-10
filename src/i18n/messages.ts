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
    | 'selection.row'
    | 'selection.all'
    | 'selection.count'
    | 'sort.ascending'
    | 'sort.descending'
    | 'sort.clear'
    | 'pagination.previous'
    | 'pagination.next'
    | 'pagination.rowsPerPage'
    | 'pagination.range'
    | 'pagination.rangeUnknown'
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
    'pagination.previous': 'Previous page',
    'pagination.next': 'Next page',
    'pagination.rowsPerPage': 'Rows per page',
    'pagination.range': '{from}-{to} of {total}',
    'pagination.rangeUnknown': '{from}-{to} of many',
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

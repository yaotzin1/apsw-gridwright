/**
 * The message catalog: the translation contract for the grid's shell.
 *
 * Keys are flat and dot-separated because that is what every translation toolchain already
 * consumes -- i18next, FormatJS, Lingui, Weblate, Crowdin, a plain JSON file in a repository. A
 * nested object would have to be flattened by every one of them.
 *
 * Placeholders are ICU-style `{name}`. Plural forms use the CLDR categories that
 * `Intl.PluralRules` returns, so a language with six of them is expressible without this package
 * shipping a plural library or a table of its own.
 *
 * Only the shell's strings live here: the table's status rows and its live region. Every feature is
 * an add-on and carries its own strings, which a locale pack translates under `addons`.
 */

/**
 * Every string the shell can render.
 *
 * Adding a key is a minor version. Removing or renaming one is a major, because a translator's
 * catalog is keyed on these and a missing key silently falls back to English.
 */
export type MessageKey =
    | 'status.loading'
    | 'status.empty'
    | 'error.title'
    | 'error.retry'
    | 'a11y.rowsShown'
    | 'a11y.rowsShownUnknown'
    | 'a11y.rowsTotal';

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

/** One add-on's strings in one language, by the add-on's own keys. */
export type AddonCatalog = Readonly<Record<string, Message>>;

/**
 * An add-on's strings, by language tag. English is required and is the fallback for every other
 * language, so an add-on always renders something readable.
 */
export type AddonMessages = { readonly en: AddonCatalog } & { readonly [locale: string]: AddonCatalog };

/** A catalog plus the locale it is written for. */
export interface LocaleCatalog {
    /** A BCP 47 language tag: `en`, `pl`, `pt-BR`. Drives plural rules and number formatting. */
    readonly locale: string;
    /** Overrides the direction derived from the locale. Rarely needed. */
    readonly direction?: 'ltr' | 'rtl';
    readonly messages: MessageCatalog;
    /**
     * Add-on strings in this language, by add-on name: `{ 'gridwright:filters': { apply: 'Zastosuj' } }`.
     *
     * The packs this package ships translate every built-in add-on here, so `locale={pl}` still
     * translates the whole grid. They outrank an add-on's own catalog for the same language, because
     * the pack is the one the application chose.
     */
    readonly addons?: Readonly<Record<string, AddonCatalog>>;
}

/**
 * English, and the fallback for every other locale.
 *
 * A key missing from a translation resolves here rather than rendering the key itself. A reader
 * seeing one English word among their own language has a cosmetic problem; a reader seeing
 * `status.loading` has a broken product.
 */
export const englishMessages: MessageCatalog = {
    'status.loading': 'Loading rows',
    'status.empty': 'No rows to show',
    'error.title': 'The rows could not be loaded',
    'error.retry': 'Try again',
    'a11y.rowsShown': 'Showing {from} to {to} of {total}',
    // Never a computed total. A source that paginates without a count has not sent one.
    'a11y.rowsShownUnknown': 'Showing {from} to {to} of many',
    'a11y.rowsTotal': {
        one: '{count} row',
        other: '{count} rows',
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

/**
 * Reports, per language, the English keys an add-on catalog is missing and the keys it invented.
 *
 * Pass an add-on's own `messages`, or a locale pack's section for one add-on beside the add-on's
 * English: `auditAddonMessages({ en: english, pl: pl.addons['acme:heatmap'] })`. A clean result has
 * no entries at all.
 */
export function auditAddonMessages(messages: AddonMessages): Readonly<
    Record<string, { readonly missing: readonly string[]; readonly unknown: readonly string[] }>
> {
    const keys = Object.keys(messages.en);
    const known = new Set(keys);
    const report: Record<string, { missing: string[]; unknown: string[] }> = {};

    for (const [locale, catalog] of Object.entries(messages)) {
        if (locale === 'en') continue;
        const missing = keys.filter((key) => catalog[key] === undefined);
        const unknown = Object.keys(catalog).filter((key) => !known.has(key));
        if (missing.length > 0 || unknown.length > 0) report[locale] = { missing, unknown };
    }

    return report;
}

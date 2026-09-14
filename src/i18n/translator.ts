import type { AddonMessages, LocaleCatalog, Message, MessageCatalog, MessageKey, PluralMessage } from './messages';
import { englishMessages } from './messages';

export type TranslateValues = Readonly<Record<string, string | number>>;

/**
 * The shape an external i18n library plugs into.
 *
 * `react-i18next`, `FormatJS` and `Lingui` all expose a function of this shape, so wiring one in
 * is `translate={t}` rather than an adapter package.
 */
export type TranslateFn = (key: string, values?: TranslateValues) => string;

export type TextDirection = 'ltr' | 'rtl';

/**
 * Message overrides: the shell's keys, and any add-on's keys namespaced as `<add-on name>.<key>`,
 * for example `gridwright:filters.apply`.
 */
export type MessageOverrides = Partial<MessageCatalog> & Readonly<Record<string, Message>>;

export interface Translator {
    /** The resolved BCP 47 tag. */
    readonly locale: string;
    readonly direction: TextDirection;
    /** The shell's own strings. */
    readonly t: (key: MessageKey, values?: TranslateValues) => string;
    /**
     * Formats a message the caller already holds, with the same plural rules and placeholder
     * substitution as `t`. This is what an add-on's own catalog is rendered through.
     */
    format(message: Message, values?: TranslateValues): string;
    /**
     * What the application says for a key, from `translate` or the `messages` overrides, or
     * undefined when it says nothing. Add-ons ask this before falling back to their own catalogs, so
     * one `translate={t}` covers the whole grid.
     */
    resolveOverride(key: string, values?: TranslateValues): string | undefined;
    /**
     * One add-on's string. Resolved from `translate` and `messages` under `<add-on>.<key>`, then the
     * locale pack's `addons[<add-on>]`, then the add-on's own catalog for the locale, for its base
     * language, and English. The key itself only when all of those are silent, which
     * `auditAddonMessages` exists to catch.
     */
    translateAddon(addon: string, key: string, values?: TranslateValues, own?: AddonMessages): string;
    /** Locale-aware number formatting, used for counts inside messages. */
    formatNumber(value: number): string;
}

export interface TranslatorOptions {
    /** BCP 47 tag. Drives plural rules, number formatting and text direction. Default `en`. */
    readonly locale?: string;
    /** A full catalog, usually one of the packs from `apsw-gridwright/locales`. */
    readonly catalog?: LocaleCatalog;
    /** Overrides for individual keys, applied over the catalog, add-on keys included. */
    readonly messages?: MessageOverrides;
    /**
     * Delegate translation entirely to an external library. When supplied, the catalog is used
     * only as the fallback for a key the function does not resolve.
     */
    readonly translate?: TranslateFn;
}

/**
 * Languages written right to left, by ISO 639 code.
 *
 * A fallback only. Modern runtimes answer through `Intl.Locale`, and this list covers the ones
 * that do not, without pulling in CLDR data the platform already has.
 */
const RTL_LANGUAGES = new Set([
    'ar', 'arc', 'ckb', 'dv', 'fa', 'ha', 'he', 'khw', 'ks', 'ps', 'sd', 'ur', 'uz-Arab', 'yi',
]);

interface TextInfoCarrier {
    textInfo?: { direction?: string };
    getTextInfo?: () => { direction?: string } | undefined;
    language?: string;
}

/** Asks the platform first, because it has the CLDR data and this package deliberately does not. */
export function resolveDirection(locale: string): TextDirection {
    let language = locale.split('-')[0]?.toLowerCase() ?? 'en';

    try {
        const resolved = new Intl.Locale(locale) as unknown as TextInfoCarrier;
        const info = resolved.textInfo ?? resolved.getTextInfo?.();
        if (info?.direction === 'rtl' || info?.direction === 'ltr') return info.direction;
        if (resolved.language) language = resolved.language.toLowerCase();
    } catch {
        // An unparseable tag is the caller's problem to see in their own logs, not a reason for
        // the grid to throw during a render.
    }

    return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
}

function isPlural(message: Message): message is PluralMessage {
    return typeof message !== 'string';
}

/**
 * Picks the plural form for a count.
 *
 * `zero` is checked first and only for an exact zero, following ICU, where an exact match wins
 * over a category keyword. Everything else comes from `Intl.PluralRules`, so Polish gets its
 * `few` and `many` and Arabic its six forms without this package knowing anything about either.
 */
export function selectPluralForm(message: PluralMessage, count: number, locale: string): string {
    if (count === 0 && message.zero !== undefined) return message.zero;

    let category: Intl.LDMLPluralRule = 'other';
    try {
        category = new Intl.PluralRules(locale).select(count);
    } catch {
        category = count === 1 ? 'one' : 'other';
    }

    return message[category] ?? message.other;
}

/**
 * Substitutes `{name}` placeholders.
 *
 * A placeholder with no value is left in the output rather than replaced with an empty string or
 * the word `undefined`. It is then visible in review and in a screenshot, which is where a missing
 * value should be caught.
 */
export function interpolate(
    template: string,
    values: TranslateValues | undefined,
    formatNumber: (value: number) => string,
): string {
    if (!values || template.indexOf('{') === -1) return template;

    return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
        const value = values[name];
        if (value === undefined) return placeholder;
        return typeof value === 'number' ? formatNumber(value) : String(value);
    });
}

/**
 * Builds the translator the grid renders through.
 *
 * Resolution order for a key: the `translate` function, then `messages`, then the `catalog`, then
 * English. Falling back to English rather than to the key itself is deliberate: one English word
 * inside a translated page is a cosmetic defect, while `pagination.rowsPerPage` rendered in the
 * footer is a broken product.
 */
export function createTranslator(options: TranslatorOptions = {}): Translator {
    const catalog = options.catalog;
    const locale = options.locale ?? catalog?.locale ?? 'en';
    const direction = catalog?.direction ?? resolveDirection(locale);

    let numberFormat: Intl.NumberFormat | null = null;
    const formatNumber = (value: number): string => {
        try {
            numberFormat ??= new Intl.NumberFormat(locale);
            return numberFormat.format(value);
        } catch {
            return String(value);
        }
    };

    const format = (message: Message, values?: TranslateValues): string => {
        const template = isPlural(message)
            ? selectPluralForm(message, Number(values?.count ?? 0), locale)
            : message;
        return interpolate(template, values, formatNumber);
    };

    const external = (key: string, values?: TranslateValues): string | undefined => {
        if (!options.translate) return undefined;
        const answer = options.translate(key, values);
        // A library that has no entry for a key conventionally echoes the key back. Treating
        // that as a translation would put a dotted identifier on screen.
        return typeof answer === 'string' && answer !== '' && answer !== key ? answer : undefined;
    };

    const resolveOverride = (key: string, values?: TranslateValues): string | undefined => {
        const translated = external(key, values);
        if (translated !== undefined) return translated;
        const override = options.messages?.[key];
        return override === undefined ? undefined : format(override, values);
    };

    const t = (key: MessageKey, values?: TranslateValues): string =>
        resolveOverride(key, values) ?? format(catalog?.messages[key] ?? englishMessages[key], values);

    const language = locale.split('-')[0] ?? locale;

    const translateAddon = (addon: string, key: string, values?: TranslateValues, own?: AddonMessages): string => {
        const overridden = resolveOverride(`${addon}.${key}`, values);
        if (overridden !== undefined) return overridden;
        const message =
            catalog?.addons?.[addon]?.[key] ?? own?.[locale]?.[key] ?? own?.[language]?.[key] ?? own?.en[key];
        return message === undefined ? key : format(message, values);
    };

    return { locale, direction, t, format, resolveOverride, translateAddon, formatNumber };
}

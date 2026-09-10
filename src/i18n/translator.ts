import type { LocaleCatalog, Message, MessageCatalog, MessageKey, PluralMessage } from './messages';
import { englishMessages } from './messages';

export type TranslateValues = Readonly<Record<string, string | number>>;

/**
 * The shape an external i18n library plugs into.
 *
 * `react-i18next`, `FormatJS` and `Lingui` all expose a function of this shape, so wiring one in
 * is `translate={t}` rather than an adapter package.
 */
export type TranslateFn = (key: MessageKey, values?: TranslateValues) => string;

export type TextDirection = 'ltr' | 'rtl';

export interface Translator {
    /** The resolved BCP 47 tag. */
    readonly locale: string;
    readonly direction: TextDirection;
    readonly t: TranslateFn;
    /** Locale-aware number formatting, used for counts inside messages. */
    formatNumber(value: number): string;
}

export interface TranslatorOptions {
    /** BCP 47 tag. Drives plural rules, number formatting and text direction. Default `en`. */
    readonly locale?: string;
    /** A full catalog, usually one of the packs from `apsw-gridwright/locales`. */
    readonly catalog?: LocaleCatalog;
    /** Overrides for individual keys, applied over the catalog. */
    readonly messages?: Partial<MessageCatalog>;
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

    const resolveMessage = (key: MessageKey): Message =>
        options.messages?.[key] ?? catalog?.messages[key] ?? englishMessages[key];

    const t: TranslateFn = (key, values) => {
        if (options.translate) {
            const external = options.translate(key, values);
            // A library that has no entry for a key conventionally echoes the key back. Treating
            // that as a translation would put a dotted identifier on screen.
            if (typeof external === 'string' && external !== '' && external !== key) return external;
        }

        const message = resolveMessage(key);
        const template = isPlural(message)
            ? selectPluralForm(message, Number(values?.count ?? 0), locale)
            : message;

        return interpolate(template, values, formatNumber);
    };

    return { locale, direction, t, formatNumber };
}

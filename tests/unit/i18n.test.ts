import { describe, expect, it, vi } from 'vitest';
import {
    auditCatalog,
    englishMessages,
    messageKeys,
} from '../../src/i18n/messages';
import {
    createTranslator,
    interpolate,
    resolveDirection,
    selectPluralForm,
} from '../../src/i18n/translator';
import { de, en, es, fr, pl } from '../../src/locales';

describe('catalog completeness', () => {
    // A catalog that has drifted from the key set renders English into the middle of a translated
    // page, which nobody reports as a bug because it looks like a translation nobody got to.
    it.each([
        ['en', en],
        ['de', de],
        ['es', es],
        ['fr', fr],
        ['pl', pl],
    ])('%s has every key and no invented ones', (_tag, catalog) => {
        const audit = auditCatalog(catalog.messages);
        expect(audit.missing).toEqual([]);
        expect(audit.unknown).toEqual([]);
    });

    it('reports what a partial catalog is missing', () => {
        const audit = auditCatalog({ 'search.placeholder': 'Buscar' });
        expect(audit.missing).toHaveLength(messageKeys.length - 1);
        expect(audit.missing).toContain('pagination.rowsPerPage');
    });

    it('reports a key that is not in the contract', () => {
        const audit = auditCatalog({ ...englishMessages, 'search.magic': 'nope' } as never);
        expect(audit.unknown).toEqual(['search.magic']);
    });

    it('declares its own locale tag', () => {
        expect([en.locale, de.locale, es.locale, fr.locale, pl.locale]).toEqual([
            'en', 'de', 'es', 'fr', 'pl',
        ]);
    });
});

describe('interpolation', () => {
    const identity = (value: number) => String(value);

    it('substitutes named placeholders', () => {
        expect(interpolate('{from}-{to} of {total}', { from: 1, to: 25, total: 500 }, identity))
            .toBe('1-25 of 500');
    });

    it('formats numbers through the locale formatter', () => {
        const formatted = interpolate('{total}', { total: 1234567 }, (value) =>
            new Intl.NumberFormat('en-US').format(value),
        );
        expect(formatted).toBe('1,234,567');
    });

    it('leaves a placeholder with no value visible rather than printing undefined', () => {
        // A visible `{total}` gets caught in review. The word "undefined" in a footer does not.
        expect(interpolate('{from} of {total}', { from: 1 }, identity)).toBe('1 of {total}');
    });

    it('returns a template with no placeholders untouched', () => {
        expect(interpolate('Rows per page', { count: 1 }, identity)).toBe('Rows per page');
    });
});

describe('plural selection', () => {
    const message = {
        zero: 'nothing',
        one: 'one thing',
        few: 'a few things',
        many: 'many things',
        other: 'some things',
    };

    it('uses an exact zero form before consulting the categories', () => {
        // ICU lets an exact match beat a keyword, and English has no `zero` category at all, so
        // without this the sentence for an empty selection could not be written.
        expect(selectPluralForm(message, 0, 'en')).toBe('nothing');
        expect(selectPluralForm(message, 0, 'pl')).toBe('nothing');
    });

    it('selects the English categories', () => {
        expect(selectPluralForm(message, 1, 'en')).toBe('one thing');
        expect(selectPluralForm(message, 5, 'en')).toBe('some things');
    });

    it('selects the Polish categories, which English does not have', () => {
        expect(selectPluralForm(message, 1, 'pl')).toBe('one thing');
        expect(selectPluralForm(message, 3, 'pl')).toBe('a few things');
        expect(selectPluralForm(message, 12, 'pl')).toBe('many things');
        expect(selectPluralForm(message, 22, 'pl')).toBe('a few things');
    });

    it('falls back to other when the chosen category is not written', () => {
        expect(selectPluralForm({ other: 'fallback' }, 3, 'pl')).toBe('fallback');
    });

    it('survives a locale tag the runtime cannot parse', () => {
        expect(selectPluralForm(message, 1, 'not a locale')).toBe('one thing');
        expect(selectPluralForm(message, 7, 'not a locale')).toBe('some things');
    });
});

describe('text direction', () => {
    it.each(['en', 'pl', 'de-AT', 'pt-BR', 'ja'])('%s reads left to right', (tag) => {
        expect(resolveDirection(tag)).toBe('ltr');
    });

    it.each(['ar', 'he', 'fa', 'ur', 'ar-EG'])('%s reads right to left', (tag) => {
        expect(resolveDirection(tag)).toBe('rtl');
    });

    it('defaults to left to right for an unparseable tag', () => {
        expect(resolveDirection('!!!')).toBe('ltr');
    });
});

describe('createTranslator', () => {
    it('answers in English by default', () => {
        const translator = createTranslator();
        expect(translator.locale).toBe('en');
        expect(translator.direction).toBe('ltr');
        expect(translator.t('pagination.rowsPerPage')).toBe('Rows per page');
    });

    it('answers from a catalog', () => {
        const translator = createTranslator({ catalog: pl });
        expect(translator.locale).toBe('pl');
        expect(translator.t('pagination.rowsPerPage')).toBe('Wierszy na stronie');
    });

    it('applies the catalog plural rules to a count', () => {
        const translator = createTranslator({ catalog: pl });
        expect(translator.t('selection.count', { count: 1 })).toBe('zaznaczono 1 wiersz');
        expect(translator.t('selection.count', { count: 3 })).toBe('zaznaczono 3 wiersze');
        expect(translator.t('selection.count', { count: 12 })).toBe('zaznaczono 12 wierszy');
        expect(translator.t('selection.count', { count: 0 })).toBe('Nie zaznaczono wierszy');
    });

    it('formats numbers for the locale inside a message', () => {
        const english = createTranslator({ catalog: en });
        const german = createTranslator({ catalog: de });

        expect(english.t('pagination.range', { from: 1, to: 25, total: 12345 })).toContain('12,345');
        expect(german.t('pagination.range', { from: 1, to: 25, total: 12345 })).toContain('12.345');
    });

    it('falls back to English for a key a catalog omits', () => {
        // One English word inside a translated page is cosmetic. A dotted key in the footer is a
        // broken product, so the fallback is never the key itself.
        const partial = createTranslator({
            locale: 'pl',
            catalog: { locale: 'pl', messages: { ...pl.messages, 'error.retry': undefined as never } },
        });
        expect(partial.t('error.retry')).toBe('Try again');
        expect(partial.t('search.placeholder')).toBe('Szukaj');
    });

    it('applies message overrides above the catalog', () => {
        const translator = createTranslator({
            catalog: fr,
            messages: { 'search.placeholder': 'Filtrer' },
        });
        expect(translator.t('search.placeholder')).toBe('Filtrer');
        expect(translator.t('pagination.next')).toBe('Page suivante');
    });

    it('delegates to an external translate function when one is given', () => {
        const translate = vi.fn(() => 'from i18next');
        const translator = createTranslator({ catalog: es, translate });

        expect(translator.t('search.placeholder')).toBe('from i18next');
        expect(translate).toHaveBeenCalledWith('search.placeholder', undefined);
    });

    it('ignores an external function that echoes the key back', () => {
        // Every major i18n library returns the key when it has no entry for it. Rendering that
        // would put a dotted identifier on screen.
        const translator = createTranslator({
            catalog: es,
            translate: (key) => key,
        });
        expect(translator.t('search.placeholder')).toBe('Buscar');
    });

    it('ignores an external function that returns an empty string', () => {
        const translator = createTranslator({ catalog: es, translate: () => '' });
        expect(translator.t('search.placeholder')).toBe('Buscar');
    });

    it('takes the direction from an explicit catalog override', () => {
        const translator = createTranslator({
            catalog: { locale: 'en', direction: 'rtl', messages: en.messages },
        });
        expect(translator.direction).toBe('rtl');
    });

    it('exposes a locale-aware number formatter', () => {
        expect(createTranslator({ locale: 'fr-FR' }).formatNumber(1234.5)).toMatch(/1\s234/);
        expect(createTranslator({ locale: 'not a locale' }).formatNumber(1234.5)).toBe('1234.5');
    });
});

import { describe, expect, it, vi } from 'vitest';
import {
    auditAddonMessages,
    auditCatalog,
    englishMessages,
    messageKeys,
} from '../../src/i18n/messages';
import type { AddonMessages } from '../../src/i18n/messages';
import {
    createTranslator,
    interpolate,
    resolveDirection,
    selectPluralForm,
} from '../../src/i18n/translator';
import { de, en, es, fr, pl } from '../../src/locales';
import {
    PAGINATION_ADDON,
    paginationMessages,
    SEARCH_ADDON,
    searchMessages,
    SELECTION_ADDON,
    selectionMessages,
    SORTING_ADDON,
    sortingMessages,
    STALE_NOTICE_ADDON,
    staleNoticeMessages,
} from '../../src/react/core-addons/messages';
import { EXPORT_ADDON, exportMessages } from '../../src/react/export/messages';
import { FILTERS_ADDON, filterMessages } from '../../src/react/filters/messages';
import { COLUMN_LAYOUT_ADDON, columnLayoutMessages } from '../../src/react/layout/messages';
import { ROW_DETAIL_ADDON, rowDetailMessages } from '../../src/react/detail/messages';
import { ROW_ACTIONS_ADDON, rowActionsMessages } from '../../src/react/plugins/messages';
import { TREE_ADDON, treeMessages } from '../../src/react/tree/messages';

/** Every built-in add-on's English strings, by add-on name. */
const BUILT_IN_ADDONS: readonly [string, AddonMessages][] = [
    [SORTING_ADDON, sortingMessages],
    [SELECTION_ADDON, selectionMessages],
    [PAGINATION_ADDON, paginationMessages],
    [STALE_NOTICE_ADDON, staleNoticeMessages],
    [SEARCH_ADDON, searchMessages],
    [FILTERS_ADDON, filterMessages],
    [EXPORT_ADDON, exportMessages],
    [ROW_ACTIONS_ADDON, rowActionsMessages],
    [TREE_ADDON, treeMessages],
    [COLUMN_LAYOUT_ADDON, columnLayoutMessages],
    [ROW_DETAIL_ADDON, rowDetailMessages],
];

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
        const audit = auditCatalog({ 'status.loading': 'Cargando' });
        expect(audit.missing).toHaveLength(messageKeys.length - 1);
        expect(audit.missing).toContain('error.retry');
    });

    it('reports a key that is not in the contract', () => {
        const audit = auditCatalog({ ...englishMessages, 'status.magic': 'nope' } as never);
        expect(audit.unknown).toEqual(['status.magic']);
    });

    // The shipped packs translate every built-in add-on, so `locale={pl}` still translates the grid.
    it.each([
        ['de', de],
        ['es', es],
        ['fr', fr],
        ['pl', pl],
    ])('%s translates every built-in add-on, with no invented keys', (tag, catalog) => {
        for (const [addon, messages] of BUILT_IN_ADDONS) {
            const translated = catalog.addons?.[addon];
            expect(translated, `${tag} has no section for ${addon}`).toBeDefined();
            expect(auditAddonMessages({ en: messages.en, [tag]: translated! }), `${tag} ${addon}`).toEqual({});
        }
        expect(Object.keys(catalog.addons ?? {}).sort()).toEqual(BUILT_IN_ADDONS.map(([name]) => name).sort());
    });

    it('reports an add-on catalog that is missing keys or invents them', () => {
        const report = auditAddonMessages({ en: { apply: 'Apply', clear: 'Clear' }, pl: { apply: 'Zastosuj', magic: 'x' } });
        expect(report).toEqual({ pl: { missing: ['clear'], unknown: ['magic'] } });
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
        expect(translator.t('status.loading')).toBe('Loading rows');
    });

    it('answers from a catalog', () => {
        const translator = createTranslator({ catalog: pl });
        expect(translator.locale).toBe('pl');
        expect(translator.t('status.loading')).toBe('Wczytywanie wierszy');
    });

    it('applies the catalog plural rules to a count', () => {
        const translator = createTranslator({ catalog: pl });
        expect(translator.t('a11y.rowsTotal', { count: 1 })).toBe('1 wiersz');
        expect(translator.t('a11y.rowsTotal', { count: 3 })).toBe('3 wiersze');
        expect(translator.t('a11y.rowsTotal', { count: 12 })).toBe('12 wierszy');
    });

    it('formats numbers for the locale inside a message', () => {
        const english = createTranslator({ catalog: en });
        const german = createTranslator({ catalog: de });

        expect(english.t('a11y.rowsShown', { from: 1, to: 25, total: 12345 })).toContain('12,345');
        expect(german.t('a11y.rowsShown', { from: 1, to: 25, total: 12345 })).toContain('12.345');
    });

    it('falls back to English for a key a catalog omits', () => {
        // One English word inside a translated page is cosmetic. A dotted key in the footer is a
        // broken product, so the fallback is never the key itself.
        const partial = createTranslator({
            locale: 'pl',
            catalog: { locale: 'pl', messages: { ...pl.messages, 'error.retry': undefined as never } },
        });
        expect(partial.t('error.retry')).toBe('Try again');
        expect(partial.t('status.loading')).toBe('Wczytywanie wierszy');
    });

    it('applies message overrides above the catalog', () => {
        const translator = createTranslator({
            catalog: fr,
            messages: { 'status.empty': 'Rien' },
        });
        expect(translator.t('status.empty')).toBe('Rien');
        expect(translator.t('error.retry')).toBe('Réessayer');
    });

    it('delegates to an external translate function when one is given', () => {
        const translate = vi.fn(() => 'from i18next');
        const translator = createTranslator({ catalog: es, translate });

        expect(translator.t('status.loading')).toBe('from i18next');
        expect(translate).toHaveBeenCalledWith('status.loading', undefined);
    });

    it('ignores an external function that echoes the key back', () => {
        // Every major i18n library returns the key when it has no entry for it. Rendering that
        // would put a dotted identifier on screen.
        const translator = createTranslator({
            catalog: es,
            translate: (key) => key,
        });
        expect(translator.t('status.loading')).toBe('Cargando filas');
    });

    it('ignores an external function that returns an empty string', () => {
        const translator = createTranslator({ catalog: es, translate: () => '' });
        expect(translator.t('status.loading')).toBe('Cargando filas');
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

    describe('add-on strings', () => {
        const own: AddonMessages = {
            en: { apply: 'Apply', count: { one: '{count} filter', other: '{count} filters' } },
            pl: { apply: 'Zastosuj (own)' },
            pt: { apply: 'Aplicar' },
        };

        it('prefers translate, then messages, under the namespaced key', () => {
            const translate = vi.fn((key: string) => (key === 'acme:filters.apply' ? 'from i18next' : key));
            expect(createTranslator({ translate }).translateAddon('acme:filters', 'apply', undefined, own)).toBe('from i18next');
            expect(
                createTranslator({ messages: { 'acme:filters.apply': 'Go' } }).translateAddon('acme:filters', 'apply', undefined, own),
            ).toBe('Go');
        });

        it('ranks the locale pack above the catalog an add-on ships for the same language', () => {
            const catalog = { ...pl, addons: { 'acme:filters': { apply: 'Zastosuj (pack)' } } };
            expect(createTranslator({ catalog }).translateAddon('acme:filters', 'apply', undefined, own)).toBe('Zastosuj (pack)');
            expect(createTranslator({ catalog: pl }).translateAddon('acme:filters', 'apply', undefined, own)).toBe('Zastosuj (own)');
        });

        it('falls back to the base language, then English, then the key', () => {
            expect(createTranslator({ locale: 'pt-BR' }).translateAddon('acme:filters', 'apply', undefined, own)).toBe('Aplicar');
            expect(createTranslator({ locale: 'de' }).translateAddon('acme:filters', 'apply', undefined, own)).toBe('Apply');
            expect(createTranslator({ locale: 'de' }).translateAddon('acme:filters', 'missing', undefined, own)).toBe('missing');
        });

        it('applies plural rules to add-on strings', () => {
            expect(createTranslator({ locale: 'en' }).translateAddon('acme:filters', 'count', { count: 2 }, own)).toBe('2 filters');
        });

        it('translates a built-in add-on from the shipped pack', () => {
            expect(createTranslator({ catalog: pl }).translateAddon(SELECTION_ADDON, 'count', { count: 3 }, selectionMessages)).toBe(
                'zaznaczono 3 wiersze',
            );
        });
    });
});

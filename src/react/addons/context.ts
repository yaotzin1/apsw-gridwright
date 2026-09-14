import { useCallback } from 'react';
import type { TranslateValues, Translator } from '../../i18n/translator';
import { useGridwrightContext } from '../context';
import type { AddonMessages, ResolvedContributions } from './types';

/** A translate function scoped to one add-on's strings. */
export type AddonTranslate = (key: string, values?: TranslateValues) => string;

/**
 * One add-on's strings, without a hook: for code that runs outside a component, such as an
 * announcement or an export serializer. Components use `useAddonMessages`.
 *
 * `fallback` is the add-on's own catalog when the grid does not list the add-on, which is the case
 * for a part rendered by hand in a layout of your own.
 */
export function addonMessages(
    translator: Translator,
    contributions: ResolvedContributions<unknown> | undefined,
    addon: string,
    fallback?: AddonMessages,
): AddonTranslate {
    const own = contributions?.messages.get(addon) ?? fallback;
    return (key, values) => translator.translateAddon(addon, key, values, own);
}

/**
 * The strings of an add-on, for a component the add-on renders.
 *
 *     const t = useAddonMessages('acme:heatmap', heatmapMessages);
 *     return <button>{t('reset')}</button>;
 *
 * Resolved in this order: the grid's `translate` and `messages` under `acme:heatmap.reset`, the
 * locale pack's `addons['acme:heatmap']`, the add-on's catalog for the grid's locale, for its base
 * language, then English.
 */
export function useAddonMessages(addon: string, fallback?: AddonMessages): AddonTranslate {
    const { translator, contributions } = useGridwrightContext();
    const own = contributions.messages.get(addon) ?? fallback;
    return useCallback(
        (key: string, values?: TranslateValues) => translator.translateAddon(addon, key, values, own),
        [translator, addon, own],
    );
}

/** Every add-on's resolved contribution, for a part of your own that renders slots. */
export function useGridContributions<TRow = unknown>(): ResolvedContributions<TRow> {
    return useGridwrightContext<TRow>().contributions;
}

import { createTranslator } from '../i18n/translator';
import type { Translator } from '../i18n/translator';
import type { AnnouncementLabels } from './behaviour/announcement';

/** The strings the shell renders and speaks. `GridwrightLabels` in the React entry is the same shape. */
export interface ViewLabels extends AnnouncementLabels {
    readonly errorTitle: string;
    readonly retry: string;
}

/**
 * Turns a translator into the label object the shell renders from.
 *
 * The catalog is the single source of truth for interface copy. `labels` remains as an escape
 * hatch above it, for a consumer who wants one string changed without shipping a catalog.
 */
export function labelsFrom(translator: Translator): ViewLabels {
    const { t } = translator;

    return {
        loading: t('status.loading'),
        empty: t('status.empty'),
        errorTitle: t('error.title'),
        retry: t('error.retry'),
        // Not a template with the numbers spliced in: word order around numbers differs by
        // language, and a sentence assembled from fragments cannot be translated correctly.
        rowsShown: (from, to, total, exact) =>
            exact ? t('a11y.rowsShown', { from, to, total }) : t('a11y.rowsShownUnknown', { from, to }),
        rowsTotal: (count) => t('a11y.rowsTotal', { count }),
    };
}

/** English defaults. */
export const defaultViewLabels: ViewLabels = labelsFrom(createTranslator());

export function mergeLabels(translator: Translator, overrides?: Partial<ViewLabels>): ViewLabels {
    const base = labelsFrom(translator);
    return overrides ? { ...base, ...overrides } : base;
}

import { createTranslator } from '../i18n/translator';
import type { Translator } from '../i18n/translator';
import type { GridwrightLabels } from './types';

/**
 * Turns a translator into the label object the parts render from.
 *
 * The catalog is the single source of truth for interface copy. `labels` remains as an escape
 * hatch above it, for a consumer who wants one string changed without shipping a catalog, and for
 * the rare case where a label needs logic a message cannot express.
 */
export function labelsFrom(translator: Translator): GridwrightLabels {
    const { t } = translator;

    return {
        searchPlaceholder: t('search.placeholder'),
        searchAriaLabel: t('search.label'),
        loading: t('status.loading'),
        empty: t('status.empty'),
        errorTitle: t('error.title'),
        retry: t('error.retry'),
        staleTitle: t('error.stale'),
        staleMessage: t('error.staleDetail'),
        selectRow: t('selection.row'),
        selectAll: t('selection.all'),
        selectedCount: (count) => t('selection.count', { count }),
        sortAscending: t('sort.ascending'),
        sortDescending: t('sort.descending'),
        clearSort: t('sort.clear'),
        previousPage: t('pagination.previous'),
        nextPage: t('pagination.next'),
        rowsPerPage: t('pagination.rowsPerPage'),
        // Not a template with the numbers spliced in: word order around numbers differs by
        // language, and a sentence assembled from fragments cannot be translated correctly.
        pageRange: (from, to, total, exact) =>
            exact
                ? t('pagination.range', { from, to, total })
                : t('pagination.rangeUnknown', { from, to }),
        sortAnnouncement: (column, direction) =>
            direction === 'asc'
                ? t('a11y.sortedAscending', { column })
                : direction === 'desc'
                  ? t('a11y.sortedDescending', { column })
                  : t('a11y.sortCleared', { column }),
        rowsShown: (from, to, total, exact) =>
            exact
                ? t('a11y.rowsShown', { from, to, total })
                : t('a11y.rowsShownUnknown', { from, to }),
        rowsTotal: (count) => t('a11y.rowsTotal', { count }),
        treeExpand: t('tree.expand'),
        treeCollapse: t('tree.collapse'),
        treeLoadFailed: t('tree.loadFailed'),
        treeCycle: t('tree.cycle'),
        treeChildCount: (count) => t('tree.childCount', { count }),
    };
}

/** English defaults, kept as a named export so a consumer can spread and adjust a single string. */
export const defaultLabels: GridwrightLabels = labelsFrom(createTranslator());

export function mergeLabels(
    translator: Translator,
    overrides?: Partial<GridwrightLabels>,
): GridwrightLabels {
    const base = labelsFrom(translator);
    return overrides ? { ...base, ...overrides } : base;
}

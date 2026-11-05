import type { AddonMessages } from '../../i18n/messages';

/**
 * The English strings of the core add-ons, by add-on.
 *
 * Plain objects with no React in them, so the locale packs' completeness test can read them. The
 * translations live in `apsw-gridwright/locales`, under each pack's `addons`.
 */

export { SORTING_ADDON, sortingMessages } from '../../view/addons/sorting';
export { SELECTION_ADDON, selectionMessages } from '../../view/addons/selection';
export { PAGINATION_ADDON, paginationMessages } from '../../view/addons/pagination';
export const STALE_NOTICE_ADDON = 'gridwright:stale-notice';
export const SEARCH_ADDON = 'gridwright:search';


export const staleNoticeMessages: AddonMessages = {
    en: {
        // Shown when a refresh failed but the previous rows are still on screen. Without it the grid
        // silently presents stale data as current, which is the one thing it must never do.
        title: 'The rows could not be updated',
        detail: 'Showing what was last loaded',
    },
};

export const searchMessages: AddonMessages = {
    en: {
        placeholder: 'Search',
        label: 'Search rows',
    },
};

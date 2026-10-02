import type { AddonMessages } from '../../i18n/messages';

export const RESPONSIVE_ADDON = 'gridwright:responsive';

/** English. The translations live in `apsw-gridwright/locales`, under `addons['gridwright:responsive']`. */
export const responsiveMessages: AddonMessages = {
    en: {
        // The sort control that stands in for the header row while the rows are cards.
        sortBy: 'Sort by',
        sortDirection: 'Direction',
        sortNone: 'Default order',
        sortAscending: 'Ascending',
        sortDescending: 'Descending',
        // A sort or filter on a column the width has hidden stays in force, so it is said.
        hiddenSort: 'Sorted by {column}, hidden at this width',
        hiddenFilter: 'Filtered by {column}, hidden at this width',
    },
};

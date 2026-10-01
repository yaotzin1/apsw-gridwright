import type { AddonMessages } from '../../i18n/messages';

export const GROUPING_ADDON = 'gridwright:grouping';

/** English. The translations live in `apsw-gridwright/locales`, under `addons['gridwright:grouping']`. */
export const groupingMessages: AddonMessages = {
    en: {
        expand: 'Expand {group} group',
        collapse: 'Collapse {group} group',
        itemsCount: {
            one: '{count} item',
            other: '{count} items',
        },
        summaryTotal: 'Total',
        summaryAverage: 'Average',
    },
};

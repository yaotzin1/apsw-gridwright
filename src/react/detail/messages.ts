import type { AddonMessages } from '../../i18n/messages';

export const ROW_DETAIL_ADDON = 'gridwright:row-detail';

/** English. The translations live in `apsw-gridwright/locales`, under `addons['gridwright:row-detail']`. */
export const rowDetailMessages: AddonMessages = {
    en: {
        // The toggle, named for its row: a column of identical "Show details" buttons tells a
        // screen reader nothing about which row each one belongs to.
        expand: 'Show details for {row}',
        collapse: 'Hide details for {row}',
        // The toggle column's header, visually hidden. A header cell with no accessible name is a
        // column a reader cannot name when they land in it.
        column: 'Details',
        // The panel's region, so a reader moving through landmarks knows whose details these are.
        panel: 'Details for {row}',
        // Said through the live region. Expansion is not grid state, so this cannot come from an
        // announcement contributor.
        expanded: '{row} details shown',
        collapsed: '{row} details hidden',
    },
};

import type { AddonMessages } from '../../i18n/messages';

export const COLUMN_LAYOUT_ADDON = 'gridwright:column-layout';

/** English. The translations live in `apsw-gridwright/locales`, under `addons['gridwright:column-layout']`. */
export const columnLayoutMessages: AddonMessages = {
    en: {
        // The resize handle. Named for its column, because a row of identical separators tells a
        // screen reader nothing about which column each one belongs to.
        resize: 'Resize {column}',
        // The picker: its trigger, and the menu the trigger opens.
        picker: 'Columns',
        showAll: 'Show all columns',
        resetLayout: 'Reset layout',
        // The picker groups columns the way the table paints them, so the order a reader hears
        // matches the order they see.
        pinnedLeft: 'Pinned to start',
        pinnedRight: 'Pinned to end',
        // Announced on release and on each keyboard step. A width is one of the few things a
        // sighted reader learns by looking and everyone else learns only if it is said.
        width: '{column} width: {width} pixels',
        hidden: '{column} hidden',
        shown: '{column} shown',
    },
};

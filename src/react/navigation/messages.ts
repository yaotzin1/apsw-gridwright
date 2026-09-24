import type { AddonMessages } from '../../i18n/messages';

export const CELL_NAVIGATION_ADDON = 'gridwright:cell-navigation';

/**
 * English. The translations live in `apsw-gridwright/locales`, under
 * `addons['gridwright:cell-navigation']`.
 *
 * Only copying says anything. Moving the cursor announces nothing: the browser already says what a
 * focused cell is -- its column header, its row position and its text -- so a live region repeating
 * it would speak over the browser on every arrow key.
 *
 * There is no failure message, because there is no failure this add-on could observe: the copy
 * runs inside the browser's own `copy` event, which cannot be refused, and a browser that never
 * fires one never tells anybody.
 */
export const cellNavigationMessages: AddonMessages = {
    en: {
        copiedRows: {
            one: 'Copied {count} row to the clipboard',
            other: 'Copied {count} rows to the clipboard',
        },
        copiedCell: 'Copied the cell to the clipboard',
    },
};

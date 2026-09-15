import type { GridAddon } from '../addons/types';
import { GridExportMenu } from './GridExportMenu';
import { EXPORT_ADDON, exportMessages } from './messages';
import type { GridExportOptions } from './types';

/**
 * An export control in the toolbar: the formats it was given, and the rows the reader chooses.
 *
 * The default scope is every row matching the query rather than the page on screen. Against a
 * source that paginates for itself that means asking the source for the rest, which it can only
 * answer if it implements `fetchAll`; without one the menu says so rather than saving page one
 * under a name that claims to be everything.
 */
export function exportMenu<TRow>(options: GridExportOptions<TRow> = {}): GridAddon<TRow> {
    return {
        name: EXPORT_ADDON,
        setup: () => ({
            messages: exportMessages,
            toolbar: () => <GridExportMenu<TRow> {...options} />,
        }),
    };
}

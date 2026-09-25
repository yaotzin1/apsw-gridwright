import { staleNotice, type CoreAddonOptions, type GridAddon } from 'apsw-gridwright/react';
import { muiPagination } from './pagination';
import { muiSelection } from './selection';
import { muiSorting } from './sorting';
import { muiTheme } from './theme';

export { muiPagination } from './pagination';
export { muiSelection } from './selection';
export { muiSorting } from './sorting';
export { muiTheme, MUI_THEME_ADDON } from './theme';
export { muiTokens, type GridTokens } from './tokens';

/**
 * The core add-ons as MUI views, plus the theme: pass it where `coreAddons()` would go.
 *
 *     <Gridwright columns={columns} data={rows} coreAddons={muiAddons()} />
 *
 * It takes the same options as `coreAddons(options)` and passes each on the same way. The views keep
 * the native add-ons' names, so locale packs, message overrides and `virtualRows()` treat them as the
 * add-ons they replace. To swap one view into the native set instead, replace it by name:
 * `coreAddons().map((a) => (a.name === 'gridwright:sorting' ? muiSorting() : a))`.
 */
export function muiAddons<TRow>(options: CoreAddonOptions = {}): GridAddon<TRow>[] {
    return [
        muiTheme<TRow>(),
        muiSorting<TRow>(options.sorting),
        muiSelection<TRow>(options.selection),
        muiPagination<TRow>(options.pagination),
        staleNotice<TRow>(),
    ];
}

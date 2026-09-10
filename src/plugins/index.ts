import type { GridPlugin } from '../core/types';
import { filteringPlugin } from './filtering';
import { paginationPlugin } from './pagination';
import { searchPlugin } from './search';
import { sortingPlugin } from './sorting';

export { filteringPlugin, FILTERING_STAGE_ID } from './filtering';
export { paginationPlugin, PAGINATION_STAGE_ID } from './pagination';
export { searchPlugin, SEARCH_STAGE_ID, type SearchPluginOptions } from './search';
export { sortingPlugin, SORTING_STAGE_ID } from './sorting';

/**
 * The four stages the engine installs when the caller does not supply its own plugin list.
 *
 * They are ordinary plugins with no privileged access, which is the point: a replacement written
 * outside this package has exactly the same reach as the built-ins it displaces. Pass your own
 * array to `createGridEngine({ plugins })` to drop, reorder or replace any of them.
 */
export function corePlugins<TRow>(): readonly GridPlugin<TRow>[] {
    return [filteringPlugin<TRow>(), searchPlugin<TRow>(), sortingPlugin<TRow>(), paginationPlugin<TRow>()];
}

import { sorting as neutralSorting } from '../../view/addons/sorting';
import type { SortingOptions } from '../../view/addons/sorting';
import type { GridAddon } from '../addons/types';
import { adaptViewAddon } from '../view/adapt';

export type { SortingOptions };

/**
 * Sorting from the headers: a real button owning each sortable header's label, `aria-sort` on the
 * cell, and a sentence in the live region naming the column the reader just sorted.
 *
 * Written once in the view layer (`apsw-gridwright/view`) and drawn here by the React renderer, so
 * every other adapter gets the same button, the same attributes and the same announcement.
 */
export function sorting<TRow>(options: SortingOptions = {}): GridAddon<TRow> {
    return adaptViewAddon<TRow>(neutralSorting<TRow>(options));
}

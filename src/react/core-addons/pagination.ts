import { pagination as neutralPagination } from '../../view/addons/pagination';
import type { PaginationOptions } from '../../view/addons/pagination';
import type { GridAddon } from '../addons/types';
import { adaptViewAddon } from '../view/adapt';

export type { PaginationOptions };

/**
 * Page controls and the row range, below the table. A windowed body suppresses it.
 *
 * Written once in the view layer (`apsw-gridwright/view`) and drawn here by the React renderer, so every
 * other adapter gets the same pager, the same range wording and the same focus rule.
 */
export function pagination<TRow>(options: PaginationOptions = {}): GridAddon<TRow> {
    return adaptViewAddon<TRow>(neutralPagination<TRow>(options));
}

import { selection as neutralSelection } from '../../view/addons/selection';
import type { SelectionOptions } from '../../view/addons/selection';
import type { GridAddon } from '../addons/types';
import { adaptViewAddon } from '../view/adapt';

export type { SelectionOptions };

/**
 * The view of the engine's selection: checkboxes, `aria-selected` on rows, `aria-multiselectable` on
 * the table, the selected class, and the count.
 *
 * The selection itself stays in the engine, whoever renders it: moving it here would give
 * `GridRow.selected` a second source of truth.
 *
 * Written once in the view layer (`apsw-gridwright/view`) and drawn here by the React renderer, so
 * every other adapter gets the same checkboxes, the same attributes and the same guards.
 */
export function selection<TRow>(options: SelectionOptions = {}): GridAddon<TRow> {
    return adaptViewAddon<TRow>(neutralSelection<TRow>(options));
}

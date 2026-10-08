import type { CSSProperties } from 'react';
import type { GridAddon } from '../addons/types';
import { DensityProvider, useDensityController } from './context';
import { DensityControl } from './DensityControl';
import { DENSITY_ADDON, densityMessages } from './messages';
import { rowHeightFor } from './state';
import type { DensityOptions } from './types';

export { DENSITY_ADDON, densityMessages };

/** `virtualRows()`'s name. A literal, so this add-on does not pull the windowing code into its bundle. */
const VIRTUAL_ROWS = 'gridwright:virtual';

/**
 * How much room a row takes: compact, comfortable or spacious, chosen in the toolbar.
 *
 * It puts `data-gw-density` on the grid's root, which the stylesheet reads to set the cell padding, and
 * writes the level's row height to `--gw-row-height` on the same element. The height is also published
 * to the add-ons listed after this one, so `virtualRows()` places rows by the number the CSS uses and the
 * rows stay in step with the scrollbar.
 *
 * `comfortable` is the grid as it is: it sets no height, so adding the add-on changes nothing until a
 * person chooses another level. Nothing is stored; `onChange` and `initial` are how a consumer remembers.
 */
export function density<TRow>(options: DensityOptions = {}): GridAddon<TRow> {
    return {
        name: DENSITY_ADDON,
        // Listed first among the two, so `virtualRows()` sees the published height in its setup.
        before: [VIRTUAL_ROWS],
        // A named function expression, so the hooks lint rule knows setup is a hook and checks it.
        setup: function useDensitySetup() {
            const controller = useDensityController(options);
            const height = rowHeightFor(controller.level, options);

            return {
                messages: densityMessages,
                ...(height !== undefined ? { rowHeight: height } : {}),
                provide: (children) => <DensityProvider controller={controller}>{children}</DensityProvider>,
                rootAttributes: () => ({
                    'data-gw-density': controller.level,
                    ...(height !== undefined ? { style: { '--gw-row-height': `${height}px` } as CSSProperties } : {}),
                }),
                toolbar: () => (options.control === false || controller.levels.length < 2 ? null : <DensityControl />),
            };
        },
    };
}

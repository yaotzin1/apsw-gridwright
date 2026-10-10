import type { GridAddon } from '../addons/types';
import { WcagProvider } from './context';
import { keepFocusClear } from './focus';
import { WCAG_ADDON } from './messages';
import type { WcagOptions } from './types';

export { WCAG_ADDON };

/**
 * The grid, set to WCAG 2.2 AA where the default is not.
 *
 * It puts `data-gw-wcag="aa"` on the grid's root and nothing else: the stylesheet reads that attribute to
 * draw the checkbox and the toggles at 24px, to use colours that pass for muted text and for the boundary
 * of a control, and to redraw the focus ring, the cursor cell, the selected row and the sort state in
 * system colours under `forced-colors`. It also scrolls the grid back when focus lands under the sticky header
 * or a pinned column. Add-ons that have a pointer route to add (the column picker's
 * move and width controls) read `useWcagEnabled()` and render it. A grid that does not list this
 * add-on is exactly the grid it was before it existed.
 *
 * A grid themed through `muiTheme()` keeps the theme's colours: the theme writes its tokens inline on the
 * root, and an inline declaration beats the stylesheet. That is deliberate, the colours are then the
 * consumer's, so the attribute is set and the colours do not change there.
 */
// `options` is the reserved argument; nothing reads it yet.
export function wcag<TRow>(options: WcagOptions = {}): GridAddon<TRow> {
    void options;
    return {
        name: WCAG_ADDON,
        setup: function useWcagSetup() {
            return {
                provide: (children) => <WcagProvider>{children}</WcagProvider>,
                rootAttributes: () => ({
                    'data-gw-wcag': 'aa',
                    // A focus event bubbles from every element in the grid, so this one handler covers a cursor
                    // move, Tab, a click and a dialog alike (WCAG 2.4.11).
                    onFocus: (event) => keepFocusClear(event.target as Element),
                }),
            };
        },
    };
}

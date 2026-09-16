/**
 * The `columnLayout()` add-on as an application would wire it, plus a small add-on of this page's
 * own that pins columns from the toolbar.
 *
 * The built-in picker shows and hides columns. Pinning is a decision this package does not put a
 * control on, because where a pin button belongs is a choice the application makes -- so the page
 * builds one, out of `useColumnLayout()`, which is the same controller the picker and the resize
 * handles use. There is no second API here: an add-on of yours reaches exactly what the built-in
 * one does.
 */
import { gridwright, h } from '../shared/package.js';

const { columnLayout, useColumnLayout, useGridwrightContext } = gridwright;

const STORAGE_KEY = 'gridwright-playground:layout';

/**
 * The saved layout, or nothing.
 *
 * Whatever comes back out of storage is parsed JSON of a shape nobody checked -- an older version
 * of this page may have written it -- so it goes straight to `initial`, which reads the fields it
 * recognises and drops the rest. A corrupted entry costs the reader their widths, not their grid.
 */
export function savedLayout() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : undefined;
    } catch {
        return undefined;
    }
}

export function clearSavedLayout() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // A browser with storage switched off still gets a working grid, just not a saved layout.
    }
}

/**
 * The add-on, with the layout saved on every change.
 *
 * `onChange` is not called while a column edge is being dragged, and not on mount, so this writes
 * once per change and never overwrites a saved layout with the default one on load.
 */
export const employeeColumnLayout = () =>
    columnLayout({
        initial: savedLayout(),
        onChange: (layout) => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
            } catch {
                // Private browsing, or a full quota. The grid is unaffected; only the saving is.
            }
        },
    });

/** One column's pin state, as three radio-shaped buttons. */
function PinRow({ column }) {
    const layout = useColumnLayout();
    const pinned = layout.pinOf(column.id);

    const button = (side, label) =>
        h('button', {
            key: label,
            type: 'button',
            'aria-pressed': pinned === side,
            onClick: () => layout.setPinned(column.id, side),
        }, label);

    return h('span', { className: 'pin-group' },
        h('span', { className: 'muted' }, column.header),
        button('left', 'start'),
        button(null, 'off'),
        button('right', 'end'));
}

/** Rendered by the `toolbar` slot. A component, so it may call hooks; slot functions may not. */
function PinControls() {
    const { columns } = useGridwrightContext();
    const layout = useColumnLayout();

    return h('div', { className: 'pin-controls' },
        h('span', { className: 'muted' }, 'pin:'),
        ...columns.filter((column) => !layout.isHidden(column.id)).map((column) => h(PinRow, { key: column.id, column })),
        h('button', { type: 'button', onClick: () => { layout.reset(); clearSavedLayout(); } }, 'forget saved layout'));
}

/**
 * The page's own add-on: a pin control per column, in the toolbar.
 *
 *     addons={[columnLayout(), pinControls()]}
 */
export const pinControls = () => ({
    name: 'playground:pin-controls',
    // It reads the layout controller, so it is only useful beside the add-on that publishes one.
    // Named rather than assumed: a missing one is an error naming both, not a crash inside a hook.
    requires: ['gridwright:column-layout'],
    setup: () => ({ toolbar: () => h(PinControls) }),
});

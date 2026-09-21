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
 * How many columns this page lets the reader freeze at once, when the rule is switched on.
 *
 * Three, and two are pinned before anyone touches anything (`name` to the start, `status` to the
 * end), so the rule is visible after one press rather than immediately: the third pin lands, the
 * fourth refuses itself.
 */
const PIN_BUDGET = 3;

/**
 * This page's layout policy, as `canChange` receives it.
 *
 * A column option can say `hideable: false`, but it cannot say anything about *more than one*
 * column, and there is no per-column lock for pinning at all. Both gaps are what a guard is for --
 * and this one is a real rule rather than a demonstration: past three frozen columns the scrolling
 * region on a narrow window is a sliver.
 *
 * **Counted from `resolved`, not from `layout`.** The second argument is the saved state, which
 * holds only what the reader changed; `name` and `status` are pinned by their own column
 * definitions and are not in it. Counting it here would report 0 with two columns already frozen,
 * and the rule would let five through. `resolved.pinOf` answers what is actually painted, and it
 * is the same function the picker and the pin buttons below ask.
 *
 * It narrows and never widens: `name` declares `hideable: false` and stays unhideable whatever
 * this returns, which the picker shows by leaving that item disabled either way.
 */
export const atMostThreePinned = (change, layout, resolved) =>
    change.type !== 'pin' ||
    change.side === null ||
    resolved.order.filter((id) => resolved.pinOf(id) !== null).length < PIN_BUDGET;

/**
 * The add-on, with the layout saved on every change.
 *
 * `onChange` is not called while a column edge is being dragged, and not on mount, so this writes
 * once per change and never overwrites a saved layout with the default one on load.
 */
export const employeeColumnLayout = ({ limitPins = false } = {}) =>
    columnLayout({
        initial: savedLayout(),
        // Absent unless the page asks for it, because a guard is a policy and a policy nobody chose
        // is a grid that refuses things for no reason the reader can see.
        canChange: limitPins ? atMostThreePinned : undefined,
        onChange: (layout) => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
            } catch {
                // Private browsing, or a full quota. The grid is unaffected; only the saving is.
            }
        },
    });

/**
 * One column's pin state, as three radio-shaped buttons.
 *
 * Each asks `allows` before it renders, which is the same question the built-in picker's own pin
 * toggles ask. That is the point of the method existing: this page's controls and the package's
 * controls cannot disagree about what is permitted, because there is one definition of it.
 *
 * `aria-disabled` rather than `disabled`, so a refused button keeps its place in the tab order and
 * can still be read. A control nobody can reach cannot tell anyone why it will not move.
 */
function PinRow({ column }) {
    const layout = useColumnLayout();
    const pinned = layout.pinOf(column.id);

    const button = (side, label) => {
        const refused = !layout.allows({ type: 'pin', columnId: column.id, side });
        return h('button', {
            key: label,
            type: 'button',
            'aria-pressed': pinned === side,
            'aria-disabled': refused || undefined,
            onClick: () => !refused && layout.setPinned(column.id, side),
        }, label);
    };

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
        h(ForgetButton));
}

/**
 * "Forget saved layout", asking first.
 *
 * `reset` is a change like any other, so a guard may refuse it -- and this button clears storage
 * too, which must not happen when the reset did not. Asking `allows` keeps the two in step.
 */
function ForgetButton() {
    const layout = useColumnLayout();
    const refused = !layout.allows({ type: 'reset' });

    return h('button', {
        type: 'button',
        'aria-disabled': refused || undefined,
        onClick: () => {
            if (refused) return;
            layout.reset();
            clearSavedLayout();
        },
    }, 'forget saved layout');
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

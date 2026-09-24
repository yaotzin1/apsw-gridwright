import type { CellNavigationController } from './types';

/**
 * The `tabIndex` a control inside a body cell takes: `-1` when the cursor visits that cell, and
 * `undefined`, which leaves the element's own default, otherwise.
 *
 * The ARIA grid pattern gives the grid one Tab stop. A checkbox that stays tabbable in every row is
 * 25 more of them between the cursor and the rest of the page, so `Tab` would not leave the grid.
 * The cell is reached with the arrow keys instead, and `Enter` or `Space` on it operates the
 * control (`cellControlOf`).
 *
 * Without a `columnId` the caller sits in a data cell, which the cursor always visits. An extra
 * column is visited only when its id is in `columnIds`: `includeExtraColumns: false` leaves the
 * selection checkbox in the Tab order, the way a grid behaved before the add-on.
 */
export function cellTabIndex(navigation: CellNavigationController | null, columnId?: string): -1 | undefined {
    if (navigation === null) return undefined;
    if (columnId === undefined) return -1;
    return navigation.columnIds.includes(columnId) ? -1 : undefined;
}

const CONTROL = 'button, a[href], input, select, textarea, [role="button"], [role="checkbox"], [role="switch"], [role="link"]';

/** Controls that take a keystroke rather than a click: `Enter` puts the reader inside them. */
const TEXT_ENTRY = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), select, textarea';

/**
 * The control `Enter`, `Space` or `F2` on this cell operates, or null when it holds none.
 *
 * The first enabled one, except that a disclosure toggle gives way to anything else in the cell:
 * the tree toggle already answers to the arrow keys, and the edit button beside it has no other key.
 * A toggle says it is one with `data-gw-disclosure`, because the tree's `aria-expanded` is on the
 * row, where the treegrid pattern puts it, and not on the button.
 */
export function cellControlOf(cell: Element): HTMLElement | null {
    const controls = [...cell.querySelectorAll<HTMLElement>(CONTROL)].filter(
        (control) => !control.matches(':disabled') && control.getAttribute('aria-disabled') !== 'true',
    );
    return controls.find((control) => !control.hasAttribute('data-gw-disclosure')) ?? controls[0] ?? null;
}

/** Operates it: a text field or select takes focus, anything else is clicked. */
export function operateControl(control: HTMLElement): void {
    if (control.matches(TEXT_ENTRY)) control.focus();
    else control.click();
}

/** Whether a key operates the control in a focused cell. */
export const isCellActivationKey = (key: string): boolean => key === 'Enter' || key === ' ' || key === 'F2';

/**
 * A row menu, drawn by the page.
 *
 * The React adapter has `BubbleMenu`, which is this plus keyboard navigation, focus handling and
 * placement that respects the writing direction. It is an adapter component because it is DOM work,
 * not because the mechanism needs React: the actions it runs go through the same controller and the
 * same engine as everything else.
 */

/**
 * A click on one of these is not a click on the row.
 *
 * Cells hold buttons: an editable cell's trigger, the selection checkbox, the tree's toggle. A menu
 * opening over them would eat the click that was meant for them.
 */
const INTERACTIVE = 'button, a, input, select, textarea, [contenteditable], [data-page-menu]';

export function openRowMenu(actions, clientX, clientY, host) {
    closeRowMenu();
    if (actions.length === 0) return;

    const menu = document.createElement('div');
    menu.className = 'gw-bubble';
    menu.dataset.pageMenu = 'true';
    menu.setAttribute('role', 'menu');
    menu.style.position = 'fixed';
    menu.style.transform = 'none';
    // Beside the pointer, clamped so the last item is not off the screen.
    menu.style.left = `${Math.min(clientX + 8, window.innerWidth - 240)}px`;
    menu.style.top = `${clientY + 8}px`;

    for (const action of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `gw-bubble-item${action.destructive ? ' gw-bubble-item--destructive' : ''}`;
        button.textContent = action.label;
        button.addEventListener('click', () => {
            closeRowMenu();
            void action.run();
        });
        menu.append(button);
    }

    // Inside the grid root, not on the body. The stylesheet's colours, borders and shadow are all
    // custom properties declared on `.gw-root`, and a menu appended outside it inherits none of
    // them: it renders as bare text on a transparent background and reads as broken.
    host.append(menu);
    menu.querySelector('button')?.focus();
}

export function closeRowMenu() {
    document.querySelector('[data-page-menu]')?.remove();
}

/**
 * Opens the menu for whichever row was clicked, unless the click belonged to a control.
 *
 * Left click as well as right, because nobody discovers a right-click-only menu.
 */
export function menuFromClick(event, host, actionsFor) {
    const row = event.target.closest('.gw-row[data-row-id]');
    if (!row || event.target.closest(INTERACTIVE)) return;
    openRowMenu(actionsFor(row.dataset.rowId), event.clientX, event.clientY, host);
}

/**
 * Closes an open menu when the next press lands anywhere else.
 *
 * `pointerdown` fires before the `click` that opens a menu, so this closes the previous one rather
 * than the one being opened, which is exactly the order wanted.
 */
export function dismissMenuOnOutsidePress() {
    document.addEventListener('pointerdown', (event) => {
        if (!event.target.closest('.gw-bubble')) closeRowMenu();
    });
}

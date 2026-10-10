/**
 * Scrolls the grid's wrapper so a focused element is not left under the sticky header or a pinned column
 * (WCAG 2.4.11 Focus Not Obscured).
 *
 * Focusing an element scrolls it into view the browser's way, and the browser does not know that the
 * header is sticky over the top edge or that a pinned column is sticky over a side: the element arrives
 * at the edge of the scroll area and is exactly as covered as the thing stuck there is wide. Every way
 * focus can land does this, a cursor move, Tab, a click, so this runs from the one place they all pass
 * through, a focus event on the root.
 *
 * The cover is measured, not assumed: the bottom edge of the header cells, and the inner edge of the
 * cells flagged `data-pinned` on each side. A windowed grid scrolls by its own arithmetic and is never
 * left covered, so there the overlap is zero and nothing moves. An element that is itself pinned or
 * itself a header cell is the cover, not what it hides, and is left alone.
 */
export function keepFocusClear(target: Element): void {
    const wrapper = target.closest<HTMLElement>('.gw-table-wrapper');
    if (wrapper === null) return;

    const box = target.getBoundingClientRect();

    if (target.closest('thead') === null) {
        let headerBottom = Number.NEGATIVE_INFINITY;
        for (const header of wrapper.querySelectorAll('thead th')) headerBottom = Math.max(headerBottom, header.getBoundingClientRect().bottom);
        const covered = headerBottom - box.top;
        if (covered > 0) wrapper.scrollTop -= covered;
    }

    if (target.closest('[data-pinned]') !== null) return;

    // The pinned values are logical: `left` is the start edge and `right` the end, whichever way the line runs.
    const rtl = getComputedStyle(wrapper).direction === 'rtl' || wrapper.closest('[dir="rtl"]') !== null;
    const start: DOMRect[] = [];
    const end: DOMRect[] = [];
    for (const pinned of wrapper.querySelectorAll('[data-pinned]')) {
        (pinned.getAttribute('data-pinned') === 'left' ? start : end).push(pinned.getBoundingClientRect());
    }

    // How far the element reaches under each side, as a positive number of pixels, and the scroll that undoes it.
    const underStart = start.length === 0 ? 0 : rtl ? box.right - Math.min(...start.map((r) => r.left)) : Math.max(...start.map((r) => r.right)) - box.left;
    if (underStart > 0) {
        wrapper.scrollLeft += rtl ? underStart : -underStart;
        return;
    }
    const underEnd = end.length === 0 ? 0 : rtl ? Math.max(...end.map((r) => r.right)) - box.left : box.right - Math.min(...end.map((r) => r.left));
    if (underEnd > 0) wrapper.scrollLeft += rtl ? -underEnd : underEnd;
}

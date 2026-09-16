import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useAddonMessages } from '../addons/context';
import { classes, useGridwrightContext } from '../context';
import { useColumnLayout } from './context';
import { autoFitWidth, clampWidth, columnWidthProperty } from './layout';
import { COLUMN_LAYOUT_ADDON, columnLayoutMessages } from './messages';
import type { GridResizeHandleProps } from './types';

/** Arrow keys move a column edge by this much, and by `COARSE_STEP` with Shift held. */
const STEP = 5;
const COARSE_STEP = 20;

/**
 * How wide one cell would like to be: its text, plus everything in it that is not that text.
 *
 * Not `scrollWidth`, which is the obvious answer and the wrong one: it never reports less than the
 * element already is, so a column dragged too wide would auto-fit to the width it was already at and
 * the gesture would look broken in exactly the case it is for. A `Range` over the contents measures
 * the text where it actually is -- laid out on one line and clipped by the cell -- so a column can
 * shrink as well as grow.
 *
 * Everything beside the text is then counted rather than inferred from the space left over. In a
 * header the label is shrink-wrapped inside the sort button, so the gap between the cell's width and
 * the text's is mostly empty space, and subtracting one from the other reports the column's current
 * width back as its ideal one. Walking from the text out to the cell instead, adding each level's
 * padding and whatever sits next to it, counts the sort indicator, the filter button and this handle
 * without naming any of them.
 */
function naturalWidth(cell: HTMLElement): number {
    const label = cell.querySelector<HTMLElement>('.gw-header-label') ?? cell;
    const range = document.createRange();
    range.selectNodeContents(label);
    const text = range.getBoundingClientRect().width;
    range.detach();

    let chrome = paddingOf(label);
    for (let node: HTMLElement = label; node !== cell && node.parentElement; ) {
        const parent = node.parentElement;
        const gap = parseFloat(getComputedStyle(parent).columnGap) || 0;
        chrome += paddingOf(parent) + gap * Math.max(0, parent.children.length - 1);
        for (const sibling of parent.children) {
            if (sibling !== node) chrome += (sibling as HTMLElement).offsetWidth;
        }
        node = parent;
    }

    // A sub-pixel measurement clipped to a whole pixel is an ellipsis on text that fits.
    return Math.ceil(text) + chrome + 1;
}

/** The horizontal padding of an element, in pixels. */
function paddingOf(element: HTMLElement): number {
    const style = getComputedStyle(element);
    return (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
}

/**
 * The control at the trailing edge of a column header that changes its width.
 *
 * A focusable `role="separator"` rather than a button: a separator carries `aria-valuenow`, and a
 * button role would replace the semantics that hold the width with semantics that hold a press.
 * It is reachable by Tab, moves with the arrow keys, snaps to the floor with Home and fits the
 * content with Enter, so the whole feature works without a pointer.
 *
 * A drag never goes through React. The width is written straight onto the table element as a custom
 * property, which repaints one column, and only the final width is committed to state -- the
 * alternative re-renders every mounted cell on every pointer move.
 */
export function GridResizeHandle({ columnId, className }: GridResizeHandleProps) {
    const grid = useGridwrightContext();
    const layout = useColumnLayout();
    const t = useAddonMessages(COLUMN_LAYOUT_ADDON, columnLayoutMessages);
    const handleRef = useRef<HTMLDivElement | null>(null);
    // The drag in flight: where it started and how wide the column was then. Null between drags, so
    // a stray pointermove from a pointer this handle never captured does nothing.
    const drag = useRef<{ pointerId: number; startX: number; startWidth: number; direction: 1 | -1; width: number } | null>(null);

    const bounds = layout.boundsOf(columnId);
    const width = layout.widthOf(columnId);
    const header = grid.columns.find((column) => column.id === columnId)?.header ?? columnId;

    const tableOf = (): HTMLTableElement | null => handleRef.current?.closest('table') ?? null;

    /** Paints a width without telling React about it. Committed separately. */
    const paint = (value: number): void => {
        tableOf()?.style.setProperty(columnWidthProperty(columnId), `${value}px`);
    };

    const commit = (value: number): void => {
        layout.setWidth(columnId, value);
        grid.announce(t('width', { column: header, width: value }));
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
        // Only the primary button, and never a pointer that is already dragging something else.
        if (event.button !== 0 || drag.current) return;
        event.preventDefault();
        event.stopPropagation();
        // Dragging towards the start of the line widens the column in a right-to-left page, because
        // the trailing edge of the header is on the left there.
        const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
        drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidth: width,
            direction: rtl ? -1 : 1,
            width,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const next = clampWidth(active.startWidth + (event.clientX - active.startX) * active.direction, bounds);
        active.width = next;
        paint(next);
    };

    /**
     * The end of a drag, however it ended.
     *
     * A cancelled drag commits the last width the reader saw rather than reverting to the one they
     * started from: the column has been at that width on screen, and snapping back reads as the
     * grid refusing what they did.
     */
    const onPointerEnd = (event: PointerEvent<HTMLDivElement>): void => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (active.width !== active.startWidth) commit(active.width);
    };

    /**
     * The width that fits the widest text in the column.
     *
     * Measured from the cells that are mounted, which under `virtualRows()` is the rows on screen
     * rather than every row in the result: fitting a column to rows nobody has scrolled to would
     * mean fetching them, and a double-click is not a request for a download.
     */
    const autoFit = (): void => {
        const table = tableOf();
        if (!table) return;
        // Every labelled cell, then the ones for this column, rather than a selector built from the
        // id. A column id can come from a server, and the rule for a value that would land in a
        // selector is that it is encoded; a comparison needs no encoding at all, which is the better
        // answer when it is available.
        const measurements = [...table.querySelectorAll<HTMLElement>('[data-column-id]')]
            .filter((cell) => cell.dataset.columnId === columnId)
            .map(naturalWidth);
        commit(autoFitWidth(measurements, bounds));
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        const step = event.shiftKey ? COARSE_STEP : STEP;
        const towardsEnd = getComputedStyle(event.currentTarget).direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';

        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            commit(clampWidth(width + (event.key === towardsEnd ? step : -step), bounds));
            return;
        }
        if (event.key === 'Home') {
            event.preventDefault();
            commit(bounds.min);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            autoFit();
        }
    };

    return (
        <div
            ref={handleRef}
            className={classes('gw-resize-handle', className)}
            role="separator"
            aria-orientation="vertical"
            aria-label={t('resize', { column: header })}
            aria-valuenow={width}
            aria-valuemin={bounds.min}
            // Only when there is one. An unbounded column reporting a maximum would be reporting a
            // limit it does not have.
            aria-valuemax={Number.isFinite(bounds.max) ? bounds.max : undefined}
            tabIndex={0}
            data-column-id={columnId}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onDoubleClick={autoFit}
            onKeyDown={onKeyDown}
            // The sort button is a sibling, so a click here never reaches it. This is for whatever
            // the consumer put above: a header cell or a root with a click handler of its own must
            // not also fire because someone finished dragging a column edge.
            onClick={(event) => event.stopPropagation()}
        />
    );
}

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, FocusEvent, ReactNode, RefObject } from 'react';
import type { GridRow, RowId } from '../../core/types';
import { classes, useGridwrightContext } from '../context';

export interface BubbleMenuItem<TRow> {
    readonly id: string;
    readonly label: ReactNode;
    readonly onSelect: (row: GridRow<TRow>) => void;
    readonly disabled?: boolean | ((row: GridRow<TRow>) => boolean);
    readonly hidden?: (row: GridRow<TRow>) => boolean;
    /** Renders a separator above this item. */
    readonly separatorBefore?: boolean;
    readonly destructive?: boolean;
}

export type BubbleMenuTrigger = 'hover' | 'click' | 'contextmenu' | 'both';

/**
 * A click on one of these is not a click on the row.
 *
 * Cells hold buttons: an editable cell's trigger, the selection checkbox, a link somebody put in a
 * renderer. Opening the menu over them would mean the menu ate the click that was meant for them.
 */
const INTERACTIVE = 'button, a, input, select, textarea, [contenteditable], [role="menuitem"]';

interface Anchor {
    readonly rowId: string;
    readonly rect: DOMRect;
    /**
     * Where the pointer entered the row, relative to the anchor, or `null` when the row was reached
     * by keyboard and there is no pointer to be near.
     */
    readonly pointerX: number | null;
    readonly pinned: boolean;
}

/** The pointer's x for a pointer event, and nothing for a keyboard one. */
function pointerXOf(event: { clientX?: number }): number | undefined {
    const x = event.clientX;
    // A context-menu event raised by the keyboard reports 0, which is a real coordinate for a
    // pointer and a lie for a key press. Treat the row's own edge as the anchor in that case.
    return typeof x === 'number' && x > 0 ? x : undefined;
}

/**
 * The handlers a row needs, for `rowAttributes` or for your own `<tr>`.
 *
 * A type rather than an interface: an attribute contribution carries a `data-*` index signature,
 * and only an object type alias is assignable to one.
 */
export type BubbleMenuRowHandlers = {
    readonly onPointerOver?: (event: ReactPointerEvent<HTMLElement>) => void;
    readonly onPointerLeave?: (event: ReactPointerEvent<HTMLElement>) => void;
    readonly onFocus?: (event: FocusEvent<HTMLElement>) => void;
    readonly onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
    readonly onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
};

/**
 * The state of one row menu: which row it is over, whether it is pinned, and the handlers that
 * open it. Separate from the view so the same menu attaches to rows either way: through an add-on's
 * `rowAttributes`, or by listening on a container for rows it did not render.
 */
export interface BubbleMenuController {
    /** Put on the element the menu is positioned inside: `BubbleMenuView` does. */
    readonly anchorRef: RefObject<HTMLDivElement | null>;
    readonly menuRef: RefObject<HTMLDivElement | null>;
    readonly anchor: Anchor | null;
    open(row: HTMLElement, rowId: RowId, pinned: boolean, clientX?: number): void;
    close(): void;
    /** Keeps a hover menu open that is about to close: the pointer reached the menu itself. */
    hold(): void;
    /** Handlers for one row, honouring the trigger. */
    rowHandlers(rowId: RowId): BubbleMenuRowHandlers;
}

export function useBubbleMenu(trigger: BubbleMenuTrigger = 'both'): BubbleMenuController {
    const anchorRef = useRef<HTMLDivElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [anchor, setAnchor] = useState<Anchor | null>(null);

    const latest = useRef(anchor);
    latest.current = anchor;

    // Leaving a row closes a hover menu a task later rather than at once. The pointer is usually on
    // its way to the menu or to the next row, and both cancel it; a browser that reports where the
    // pointer went and one that does not then behave the same.
    const pendingClose = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hold = useCallback(() => {
        if (pendingClose.current !== null) clearTimeout(pendingClose.current);
        pendingClose.current = null;
    }, []);
    useEffect(() => hold, [hold]);

    const close = useCallback(() => {
        hold();
        setAnchor(null);
    }, [hold]);

    const open = useCallback((row: HTMLElement, rowId: RowId, pinned: boolean, clientX?: number) => {
        const origin = anchorRef.current;
        if (!origin) return;
        hold();

        // Measured against the anchor, not against the grid root. The menu is absolutely positioned
        // inside the anchor, so the anchor is the origin its coordinates mean. Measuring against the
        // root instead put every menu a toolbar's height too low, which reads as "one row below the
        // row you are pointing at".
        const rowRect = row.getBoundingClientRect();
        const originRect = origin.getBoundingClientRect();

        setAnchor({
            // Compared as strings. A numeric id read back from an attribute is "1", and a strict
            // comparison against the number never matches.
            rowId: String(rowId),
            rect: new DOMRect(rowRect.left - originRect.left, rowRect.top - originRect.top, rowRect.width, rowRect.height),
            pointerX: clientX === undefined ? null : clientX - originRect.left,
            pinned,
        });
    }, [hold]);

    const wantsHover = trigger === 'hover' || trigger === 'both';
    const wantsClick = trigger === 'click' || trigger === 'both';
    const wantsContext = trigger === 'contextmenu' || trigger === 'both';

    const rowHandlers = useCallback(
        (rowId: RowId): BubbleMenuRowHandlers => ({
            ...(wantsHover
                ? {
                      onPointerOver: (event) => {
                          const current = latest.current;
                          if (current?.pinned) return;
                          // Placed once per row rather than followed across its cells: a menu that
                          // slides while you approach it is a menu you cannot click.
                          if (current?.rowId === String(rowId)) {
                              hold();
                              return;
                          }
                          open(event.currentTarget, rowId, false, pointerXOf(event));
                      },
                      onPointerLeave: () => {
                          if (latest.current?.pinned || latest.current === null) return;
                          hold();
                          pendingClose.current = setTimeout(close, 0);
                      },
                      // Tabbing into a row opens the menu too, so the actions are reachable without a
                      // mouse even before anyone presses the context-menu key.
                      onFocus: (event) => {
                          if (latest.current?.pinned) return;
                          open(event.currentTarget, rowId, false);
                      },
                  }
                : {}),
            ...(wantsClick
                ? {
                      onClick: (event) => {
                          // The click belongs to whatever control it landed on, if it landed on one.
                          if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
                          open(event.currentTarget, rowId, true, pointerXOf(event));
                      },
                  }
                : {}),
            ...(wantsContext
                ? {
                      onContextMenu: (event) => {
                          event.preventDefault();
                          open(event.currentTarget, rowId, true, pointerXOf(event));
                      },
                  }
                : {}),
        }),
        [wantsHover, wantsClick, wantsContext, open, close, hold],
    );

    return useMemo(
        () => ({ anchorRef, menuRef, anchor, open, close, hold, rowHandlers }),
        [anchor, open, close, hold, rowHandlers],
    );
}

export interface BubbleMenuViewProps<TRow> {
    readonly controller: BubbleMenuController;
    readonly items: readonly BubbleMenuItem<TRow>[];
    /**
     * `top`, the default, floats the menu over the row's trailing edge, centred on it. `bottom`
     * hangs it under the row, for a layout where covering the last column is not acceptable.
     */
    readonly placement?: 'top' | 'bottom';
    readonly className?: string;
    readonly 'aria-label'?: string;
}

/**
 * The menu itself, for the row its controller is over.
 *
 * A real `role="menu"` of buttons, so a keyboard reaches every action, pinned by a click or the
 * context-menu key rather than requiring a mouse to hover. It appears beside the pointer, clamped to
 * stay inside the grid; reached by keyboard, it goes to the row's trailing edge. One measurement of
 * its own width after it renders is the whole of its positioning: no library and no portal.
 */
export function BubbleMenuView<TRow>({
    controller,
    items,
    placement = 'top',
    className,
    'aria-label': ariaLabel,
}: BubbleMenuViewProps<TRow>) {
    const { state } = useGridwrightContext<TRow>();
    const { anchorRef, menuRef, anchor, close, hold } = controller;
    const [left, setLeft] = useState(0);
    // The row's box as last measured, relative to the anchor. `anchor.rect` is the box when the
    // menu opened, and it goes stale without anything scrolling: a folder opening or a detail panel
    // unfolding moves the row and the anchor under the table by different amounts.
    const [rowBox, setRowBox] = useState<{ readonly y: number; readonly height: number } | null>(null);
    const menuId = useId();

    const row = useMemo(
        () => (anchor ? (state.rows.find((entry) => String(entry.id) === anchor.rowId) ?? null) : null),
        [anchor, state.rows],
    );

    const visibleItems = useMemo(() => (row ? items.filter((item) => !item.hidden?.(row)) : []), [items, row]);

    // The rows move under a scrolling container and a re-render, so a stale rectangle would leave
    // the menu floating over the wrong row.
    useEffect(() => {
        if (!anchor) return;
        const container = anchorRef.current?.closest('.gw-root') ?? anchorRef.current?.parentElement;
        if (!container) return;

        const onScrollOrResize = (): void => close();
        container.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);

        return () => {
            container.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [anchor, anchorRef, close]);

    // After every render rather than on a list of causes: tree expansion changes the rows, a detail
    // panel changes only an add-on's state, and a consumer's own layout changes neither. The state
    // is only set when the box moved, so the render this causes measures the same box and stops.
    // No dependency list, deliberately: none of those causes is a value this component can name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const origin = anchorRef.current;
        const element = anchor && origin ? rowElementIn(origin, anchor.rowId) : null;
        if (!origin || !element) {
            if (rowBox !== null) setRowBox(null);
            return;
        }
        const rect = element.getBoundingClientRect();
        const y = rect.top - origin.getBoundingClientRect().top;
        if (rowBox?.y !== y || rowBox.height !== rect.height) setRowBox({ y, height: rect.height });
    });

    useEffect(() => {
        if (!anchor?.pinned) return;
        // Focus the first item so the menu is usable the moment it is pinned.
        menuRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    }, [anchor?.pinned, menuRef]);

    useEffect(() => {
        if (!anchor?.pinned) return;

        // A pinned menu is modal enough to need dismissing. The listener is added after the click
        // that pinned it has finished propagating, so it cannot close the menu it just opened.
        const onPointerDown = (event: Event): void => {
            if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
            close();
        };

        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [anchor?.pinned, menuRef, close]);

    /**
     * Horizontal placement, measured rather than guessed.
     *
     * Beside the pointer, because a menu at the far edge of a wide table is a journey away from the
     * row you are pointing at. It is measured after it renders so it can be kept inside the grid:
     * its width depends on which items this row shows, which is not known until they render.
     */
    useLayoutEffect(() => {
        const menu = menuRef.current;
        const origin = anchorRef.current;
        if (!anchor || !menu || !origin) return;

        const width = menu.offsetWidth;
        const available = origin.offsetWidth;
        const rtl = getComputedStyle(origin).direction === 'rtl';

        const edge = rtl ? anchor.rect.x + 8 : anchor.rect.x + anchor.rect.width - width - 8;
        const beside = rtl ? (anchor.pointerX ?? 0) - width - 16 : (anchor.pointerX ?? 0) + 16;

        const wanted = anchor.pointerX === null ? edge : beside;
        setLeft(Math.max(4, Math.min(wanted, Math.max(4, available - width - 4))));
    }, [anchor, anchorRef, menuRef, visibleItems.length]);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);

        if (event.key === 'Escape') {
            event.stopPropagation();
            close();
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const next = event.key === 'ArrowDown' ? at + 1 : at - 1;
            buttons[(next + buttons.length) % buttons.length]?.focus();
        }
    };

    return (
        <div ref={anchorRef} className="gw-bubble-anchor">
            {anchor && row && visibleItems.length > 0 && (
                <div
                    ref={menuRef}
                    role="menu"
                    id={menuId}
                    aria-label={ariaLabel}
                    className={classes('gw-bubble', className)}
                    data-pinned={anchor.pinned ? 'true' : undefined}
                    data-placement={placement}
                    style={{
                        left: `${left}px`,
                        // Over the row's own middle by default, so it is unambiguous which row an
                        // action will apply to. `bottom` hangs it under the row instead.
                        top:
                            placement === 'top'
                                ? `${(rowBox ?? anchor.rect).y + (rowBox ?? anchor.rect).height / 2}px`
                                : `${(rowBox ?? anchor.rect).y + (rowBox ?? anchor.rect).height}px`,
                    }}
                    onKeyDown={onKeyDown}
                    onPointerEnter={hold}
                    onPointerOver={hold}
                    onPointerLeave={() => {
                        if (!anchor.pinned) close();
                    }}
                >
                    {visibleItems.map((item) => {
                        const disabled = typeof item.disabled === 'function' ? item.disabled(row) : item.disabled;

                        return (
                            <div key={item.id} className="gw-bubble-slot">
                                {item.separatorBefore && <span className="gw-bubble-separator" role="separator" />}
                                <button
                                    type="button"
                                    role="menuitem"
                                    className={classes('gw-bubble-item', item.destructive && 'gw-bubble-item--destructive')}
                                    disabled={disabled}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        item.onSelect(row);
                                        close();
                                    }}
                                >
                                    {item.label}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export interface BubbleMenuProps<TRow> extends Omit<BubbleMenuViewProps<TRow>, 'controller'> {
    /**
     * What opens it. Default `both`, which is every way of asking: it follows the pointer, a left
     * click on the row pins it, and so does a right-click or the context-menu key. A pinned menu
     * stays until Escape, a click elsewhere, or an item being chosen.
     */
    readonly trigger?: BubbleMenuTrigger;
}

/**
 * A row menu for a layout composed by hand, where the rows are not rendered through add-ons.
 *
 * It listens on the grid root for rows it did not render, found by `.gw-row[data-row-id]`. Inside a
 * grid that lists `rowActions()`, the add-on attaches the same menu through `rowAttributes` instead.
 */
export function BubbleMenu<TRow>({ trigger = 'both', ...view }: BubbleMenuProps<TRow>) {
    const controller = useBubbleMenu(trigger);
    const { anchorRef, rowHandlers } = controller;

    useEffect(() => {
        const container = anchorRef.current?.closest('.gw-root') ?? anchorRef.current?.parentElement;
        if (!container) return;

        const rowOf = (target: EventTarget | null): HTMLElement | null =>
            target instanceof Element ? target.closest<HTMLElement>('.gw-row[data-row-id]') : null;

        // Native events handed to the same handlers the add-on uses, so there is one behaviour.
        const forward =
            (name: keyof BubbleMenuRowHandlers) =>
            (event: Event): void => {
                const row = rowOf(event.target);
                if (!row) return;
                const handler = rowHandlers(row.dataset.rowId ?? '')[name] as ((event: unknown) => void) | undefined;
                handler?.({
                    currentTarget: row,
                    target: event.target,
                    relatedTarget: (event as MouseEvent).relatedTarget ?? null,
                    clientX: (event as MouseEvent).clientX,
                    preventDefault: () => event.preventDefault(),
                });
            };

        const listeners: [string, (event: Event) => void][] = [
            ['pointerover', forward('onPointerOver')],
            ['focusin', forward('onFocus')],
            ['click', forward('onClick')],
            ['contextmenu', forward('onContextMenu')],
        ];
        for (const [type, listener] of listeners) container.addEventListener(type, listener);

        // Leaving the whole container, not a row: rows are crossed constantly on the way to the menu.
        const onContainerLeave = (): void => {
            const handler = rowHandlers('').onPointerLeave as (() => void) | undefined;
            handler?.();
        };
        container.addEventListener('pointerleave', onContainerLeave);

        return () => {
            for (const [type, listener] of listeners) container.removeEventListener(type, listener);
            container.removeEventListener('pointerleave', onContainerLeave);
        };
    }, [anchorRef, rowHandlers]);

    return <BubbleMenuView<TRow> controller={controller} {...view} />;
}

/**
 * The row an anchor belongs to, in the anchor's own grid.
 *
 * Filtered by root, because a row detail panel can hold a whole grid whose row ids are the same
 * strings as the outer grid's, and the first match in document order may be one of those.
 */
function rowElementIn(origin: HTMLElement, rowId: string): HTMLElement | null {
    const root = origin.closest('.gw-root');
    if (!root) return null;
    const matches = root.querySelectorAll<HTMLElement>(`.gw-row[data-row-id="${CSS.escape(rowId)}"]`);
    return [...matches].find((element) => element.closest('.gw-root') === root) ?? null;
}

/** The row element for an id, for a consumer positioning something of their own. */
export function rowElement(root: RefObject<HTMLElement | null>, rowId: RowId): HTMLElement | null {
    return root.current?.querySelector<HTMLElement>(`.gw-row[data-row-id="${CSS.escape(String(rowId))}"]`) ?? null;
}

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
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

export type BubbleMenuTrigger = 'hover' | 'contextmenu' | 'both';

export interface BubbleMenuProps<TRow> {
    readonly items: readonly BubbleMenuItem<TRow>[];
    /**
     * What opens it. Default `both`: it follows the pointer, and a right-click or the context-menu
     * key pins it open so it can be driven from the keyboard.
     */
    readonly trigger?: BubbleMenuTrigger;
    /**
     * `top`, the default, floats the menu over the row's trailing edge, centred on it. `bottom`
     * hangs it under the row, for a layout where covering the last column is not acceptable.
     */
    readonly placement?: 'top' | 'bottom';
    readonly className?: string;
    readonly 'aria-label'?: string;
}

/**
 * The element the menu listens on and positions against.
 *
 * The grid root when there is one, and the anchor's own parent otherwise, so the menu also works
 * in a layout composed by hand where no `.gw-root` wraps the table.
 */
function containerOf(anchor: HTMLElement | null): Element | null {
    return anchor?.closest('.gw-root') ?? anchor?.parentElement ?? null;
}

interface Anchor {
    readonly rowId: RowId;
    readonly rect: DOMRect;
    readonly pinned: boolean;
}

/**
 * A floating menu over the row under the pointer.
 *
 * Two things make this more than a hover popup. It is a real `role="menu"` of buttons, so a
 * keyboard reaches every action, and it pins on the context-menu key rather than requiring a
 * mouse. A hover-only menu is decoration that some people cannot use.
 *
 * It positions from the row's own bounding box against the grid root, which is the container it is
 * absolutely placed inside, so it needs no measurement library and no portal.
 */
export function BubbleMenu<TRow>({
    items,
    trigger = 'both',
    placement = 'top',
    className,
    'aria-label': ariaLabel,
}: BubbleMenuProps<TRow>) {
    const { state } = useGridwrightContext<TRow>();
    const rootRef = useRef<HTMLDivElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [anchor, setAnchor] = useState<Anchor | null>(null);
    const menuId = useId();

    const row = useMemo(
        // Compared as strings. `data-row-id` is an attribute, so a numeric row id comes back as
        // "1" and a strict comparison against the number never matches: the menu then silently
        // refuses to open for every grid keyed on numbers.
        () =>
            anchor
                ? state.rows.find((entry) => String(entry.id) === String(anchor.rowId)) ?? null
                : null,
        [anchor, state.rows],
    );

    const visibleItems = useMemo(
        () => (row ? items.filter((item) => !item.hidden?.(row)) : []),
        [items, row],
    );

    const close = useCallback(() => setAnchor(null), []);

    // The rows move under a scrolling container and a re-render, so a stale rectangle would leave
    // the menu floating over the wrong row.
    useEffect(() => {
        if (!anchor) return;
        const container = containerOf(rootRef.current);
        if (!container) return;

        const onScrollOrResize = (): void => close();
        container.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);

        return () => {
            container.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [anchor, close]);

    useEffect(() => {
        if (!anchor?.pinned) return;
        // Focus the first item so the menu is usable the moment it is pinned.
        menuRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    }, [anchor?.pinned]);

    const rowFrom = useCallback((target: EventTarget | null): HTMLElement | null => {
        if (!(target instanceof Element)) return null;
        return target.closest<HTMLElement>('.gw-row[data-row-id]');
    }, []);

    const openFor = useCallback(
        (element: HTMLElement, pinned: boolean) => {
            const origin = rootRef.current;
            if (!origin) return;

            // Measured against the anchor, not against the grid root. The menu is absolutely
            // positioned inside the anchor, so the anchor is the origin its coordinates mean.
            // Measuring against the root instead put every menu a toolbar's height too low, which
            // reads as "one row below the row you are pointing at".
            const rowRect = element.getBoundingClientRect();
            const originRect = origin.getBoundingClientRect();

            setAnchor({
                rowId: element.dataset.rowId ?? '',
                rect: new DOMRect(
                    rowRect.left - originRect.left,
                    rowRect.top - originRect.top,
                    rowRect.width,
                    rowRect.height,
                ),
                pinned,
            });
        },
        [],
    );

    useEffect(() => {
        const container = containerOf(rootRef.current);
        if (!container) return;

        const wantsHover = trigger === 'hover' || trigger === 'both';
        const wantsContext = trigger === 'contextmenu' || trigger === 'both';

        const onPointerOver = (event: Event): void => {
            if (anchor?.pinned) return;
            const element = rowFrom(event.target);
            if (element) openFor(element, false);
            else if (!menuRef.current?.contains(event.target as Node)) close();
        };

        const onContextMenu = (event: Event): void => {
            const element = rowFrom(event.target);
            if (!element) return;
            event.preventDefault();
            openFor(element, true);
        };

        const onFocusIn = (event: Event): void => {
            if (anchor?.pinned) return;
            const element = rowFrom(event.target);
            // Tabbing into a row opens the menu too, so the actions are reachable without a mouse
            // even before anyone presses the context-menu key.
            if (element) openFor(element, false);
        };

        const onPointerLeave = (): void => {
            if (!anchor?.pinned) close();
        };

        if (wantsHover) {
            container.addEventListener('pointerover', onPointerOver);
            container.addEventListener('pointerleave', onPointerLeave);
            container.addEventListener('focusin', onFocusIn);
        }
        if (wantsContext) container.addEventListener('contextmenu', onContextMenu);

        return () => {
            container.removeEventListener('pointerover', onPointerOver);
            container.removeEventListener('pointerleave', onPointerLeave);
            container.removeEventListener('focusin', onFocusIn);
            container.removeEventListener('contextmenu', onContextMenu);
        };
    }, [trigger, anchor?.pinned, rowFrom, openFor, close]);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        const buttons = [
            ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []),
        ];
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
        <div ref={rootRef} className="gw-bubble-anchor">
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
                        insetInlineStart: `${anchor.rect.x + anchor.rect.width - 8}px`,
                        // Over the row's own middle by default, so it is unambiguous which row an
                        // action will apply to. `bottom` hangs it under the row instead.
                        top:
                            placement === 'top'
                                ? `${anchor.rect.y + anchor.rect.height / 2}px`
                                : `${anchor.rect.y + anchor.rect.height}px`,
                    }}
                    onKeyDown={onKeyDown}
                    onPointerLeave={() => {
                        if (!anchor.pinned) close();
                    }}
                >
                    {visibleItems.map((item) => {
                        const disabled =
                            typeof item.disabled === 'function' ? item.disabled(row) : item.disabled;

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

/** The row element for an id, for a consumer positioning something of their own. */
export function rowElement(root: RefObject<HTMLElement | null>, rowId: RowId): HTMLElement | null {
    return root.current?.querySelector<HTMLElement>(`.gw-row[data-row-id="${CSS.escape(String(rowId))}"]`) ?? null;
}

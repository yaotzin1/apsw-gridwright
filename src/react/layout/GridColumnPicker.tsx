import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ColumnValue, ResolvedColumn } from '../../core/types';
import { useAddonMessages } from '../addons/context';
import { classes, useGridwrightContext } from '../context';
import { useColumnLayout } from './context';
import { COLUMN_LAYOUT_ADDON, columnLayoutMessages } from './messages';
import type { ColumnLayoutController, ColumnPin, GridColumnPickerProps } from './types';

/**
 * The column picker: a button, and a menu of every column with a checkbox beside it.
 *
 * A real `role="menu"` of `menuitemcheckbox` items, so the state of each column is announced rather
 * than inferred from a tick, every item is reachable by keyboard, and focus returns to the trigger
 * when the menu closes.
 *
 * Columns are listed in the three groups the table paints them in -- pinned to the start, scrolling,
 * pinned to the end -- so the order a reader hears is the order they see. A column that may not be
 * hidden stays in the list, checked and refusing to change, rather than being left out: a reader
 * looking for a column they can see has to find it somewhere.
 */
export function GridColumnPicker({ className }: GridColumnPickerProps) {
    const grid = useGridwrightContext();
    const layout = useColumnLayout();
    const t = useAddonMessages(COLUMN_LAYOUT_ADDON, columnLayoutMessages);
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const menuId = useId();

    const close = (returnFocus: boolean): void => {
        setOpen(false);
        if (returnFocus) triggerRef.current?.focus();
    };

    // Which edge of the trigger the menu hangs from. The trigger sits at the end of the toolbar,
    // after a search box that takes the rest of the row, and a menu opening outwards from there hangs
    // past the grid. Measured before paint, so it never flashes on the wrong side.
    const [align, setAlign] = useState<'start' | 'end'>('start');
    useLayoutEffect(() => {
        if (!open) return;
        const menu = menuRef.current;
        const bounds = menu?.closest('.gw-root')?.getBoundingClientRect();
        if (!menu || !bounds) return;
        const rect = menu.getBoundingClientRect();
        const rtl = getComputedStyle(menu).direction === 'rtl';
        const overflows = rtl ? rect.left < bounds.left : rect.right > bounds.right;
        if (overflows) setAlign('end');
        return () => setAlign('start');
    }, [open]);

    useEffect(() => {
        if (!open) return;
        menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;

        // Added after the click that opened the menu has finished propagating, so it cannot close
        // the menu it just opened.
        const onPointerDown = (event: Event): void => {
            const target = event.target;
            if (target instanceof Node && menuRef.current?.contains(target)) return;
            if (target instanceof Node && triggerRef.current?.contains(target)) return;
            setOpen(false);
        };

        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);

        if (event.key === 'Escape') {
            event.stopPropagation();
            close(true);
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const next = event.key === 'ArrowDown' ? at + 1 : at - 1;
            buttons[(next + buttons.length) % buttons.length]?.focus();
        }
    };

    const groups: readonly { readonly side: ColumnPin | null; readonly label: string | null; readonly columns: readonly ResolvedColumn<unknown, ColumnValue>[] }[] = [
        { side: 'left', label: t('pinnedLeft'), columns: grid.columns.filter((column) => layout.pinOf(column.id) === 'left') },
        { side: null, label: null, columns: grid.columns.filter((column) => layout.pinOf(column.id) === null) },
        { side: 'right', label: t('pinnedRight'), columns: grid.columns.filter((column) => layout.pinOf(column.id) === 'right') },
    ];

    return (
        <div className={classes('gw-column-picker', className)}>
            <button
                ref={triggerRef}
                type="button"
                className="gw-column-picker-trigger"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen((current) => !current)}
            >
                {t('picker')}
            </button>

            {open && (
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    aria-label={t('picker')}
                    className="gw-column-picker-menu"
                    data-align={align}
                    onKeyDown={onKeyDown}
                >
                    {groups
                        .filter((group) => group.columns.length > 0)
                        .map((group) => (
                            <div
                                key={group.side ?? 'unpinned'}
                                role="group"
                                className="gw-column-picker-group"
                                data-pinned={group.side ?? undefined}
                                // Only the pinned groups are named. Labelling the middle one "not
                                // pinned" would name a state by what it is not, in a grid where
                                // most columns are in it.
                                {...(group.label ? { 'aria-label': group.label } : {})}
                            >
                                {/* Hidden from the reader who hears the group's own label, and
                                    shown to the one who sees the group's own indentation. */}
                                {group.label && (
                                    <span aria-hidden="true" className="gw-column-picker-heading">
                                        {group.label}
                                    </span>
                                )}
                                {group.columns.map((column) => (
                                    // `role="none"` because a menu's children are its items: the row
                                    // is a box, and the three controls in it are what the reader
                                    // moves between.
                                    <div key={column.id} role="none" className="gw-column-picker-row">
                                        <ColumnItem columnId={column.id} header={column.header} layout={layout} />
                                        <PinToggle columnId={column.id} header={column.header} side="left" layout={layout} />
                                        <PinToggle columnId={column.id} header={column.header} side="right" layout={layout} />
                                    </div>
                                ))}
                            </div>
                        ))}

                    <div role="separator" className="gw-column-picker-separator" />
                    <button type="button" role="menuitem" className="gw-column-picker-item" onClick={() => layout.showAll()}>
                        {t('showAll')}
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        className="gw-column-picker-item"
                        onClick={() => {
                            // Widths and pins go back too, so "reset layout" means the whole layout
                            // rather than the part of it the menu happens to show.
                            layout.reset();
                            close(true);
                        }}
                    >
                        {t('resetLayout')}
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * One column's pin control for one edge.
 *
 * Two buttons rather than a three-way cycle, because "which edge" is not an order a reader should
 * have to step through, and because a checkbox for each says the current state without being read.
 * Pressing the edge a column is already pinned to unpins it.
 */
function PinToggle({
    columnId,
    header,
    side,
    layout,
}: {
    columnId: string;
    header: string;
    side: ColumnPin;
    layout: ColumnLayoutController;
}) {
    const t = useAddonMessages(COLUMN_LAYOUT_ADDON, columnLayoutMessages);
    const pinned = layout.pinOf(columnId) === side;
    // Asked of the controller rather than worked out here, so a consumer's guard disables this
    // toggle and their own pin button by the same answer.
    const refused = !layout.allows({ type: 'pin', columnId, side: pinned ? null : side });

    return (
        <button
            type="button"
            role="menuitemcheckbox"
            className="gw-column-picker-pin"
            data-column-id={columnId}
            data-side={side}
            aria-checked={pinned}
            aria-disabled={refused ? true : undefined}
            aria-label={t(side === 'left' ? 'pinStart' : 'pinEnd', { column: header })}
            onClick={() => {
                if (refused) return;
                layout.setPinned(columnId, pinned ? null : side);
            }}
        >
            {/* The edge, drawn rather than named: the button's accessible name is the sentence. */}
            <span aria-hidden="true">{side === 'left' ? '◧' : '◨'}</span>
        </button>
    );
}

function ColumnItem({ columnId, header, layout }: { columnId: string; header: string; layout: ColumnLayoutController }) {
    const hidden = layout.isHidden(columnId);
    // The column's own rules and the consumer's guard in one question, so the item that will refuse
    // says so before it is pressed rather than after.
    const locked = !layout.allows({ type: 'visibility', columnId, hidden: !hidden });

    return (
        <button
            type="button"
            role="menuitemcheckbox"
            className="gw-column-picker-item gw-column-picker-column"
            data-column-id={columnId}
            aria-checked={!hidden}
            // Not `disabled`: a disabled item leaves the arrow-key order, and an item nobody can
            // reach cannot tell the reader why it will not move.
            aria-disabled={locked ? true : undefined}
            // The menu stays open -- showing and hiding several columns is one decision -- so
            // nothing else here says the column went. The add-on's announcement contributor does,
            // because a column appearing or disappearing settles the grid's own state and a
            // sentence said any other way would be spoken over by the row range that follows.
            onClick={() => !locked && layout.setHidden(columnId, !hidden)}
        >
            {header}
        </button>
    );
}

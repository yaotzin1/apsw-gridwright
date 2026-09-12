import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { classes, useGridwrightContext } from '../context';
import { DEFAULT_FORMATS, resolveFormats } from './formats';
import { useGridExport } from './useGridExport';
import type { ExportScope } from '../../core/export';
import type { GridExportOptions } from './types';

export interface GridExportMenuProps<TRow> extends GridExportOptions<TRow> {
    readonly className?: string;
}

/**
 * The export control: a button, and a menu of the formats it was given.
 *
 * Above the formats, unless the `scope` option fixes it, a group of radio items chooses the rows:
 * every matching row, this page, or the selection. One the grid cannot export is still reachable
 * and says why, rather than vanishing or failing only after a format is clicked.
 *
 * A real `role="menu"` of buttons rather than a styled list, so every format is reachable by
 * keyboard, and focus returns to the trigger when the menu closes. Downloading a file moves focus
 * nowhere by itself, which is why returning it explicitly matters: without it the reader is left
 * on the document body with no way back to where they were.
 */
export function GridExportMenu<TRow>({ className, ...options }: GridExportMenuProps<TRow>) {
    const { api, labels } = useGridwrightContext<TRow>();
    const { exportAs, busy, message, error, scope, setScope, isScopeAvailable, selectedCount } =
        useGridExport<TRow>(options);
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const menuId = useId();
    const rowsId = useId();
    const noteId = useId();

    // The choice is shown only when nobody fixed the scope. A fixed scope is the developer saying
    // which rows this control writes, and offering to change it would contradict them.
    const scopes: readonly { id: ExportScope; label: string }[] =
        options.scope !== undefined
            ? []
            : [
                  { id: 'all', label: labels.exportScopeAll },
                  { id: 'page', label: labels.exportScopePage },
                  // A grid without selection has nothing to offer here, so the item is not drawn.
                  ...(api.getSelectionMode() === 'none'
                      ? []
                      : [{ id: 'selected' as const, label: labels.exportScopeSelected(selectedCount) }]),
              ];
    const allUnavailable = scopes.length > 0 && !isScopeAvailable('all');

    // A custom format carries its own label, so the menu renders yours beside the built-in ones
    // with nothing to distinguish them.
    const formats = resolveFormats(options.formats ?? DEFAULT_FORMATS, labels);

    const close = (returnFocus: boolean): void => {
        setOpen(false);
        if (returnFocus) triggerRef.current?.focus();
    };

    // Which edge of the trigger the menu hangs from. The trigger usually sits at the end of the
    // toolbar, after a search box that takes the rest of the row, and a menu opening towards the
    // outside there hangs past the grid. Measured before paint, so it never flashes on the wrong side.
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
        // the menu it just opened. Focus stays where the pointer put it.
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

    return (
        <div className={classes('gw-export', className)}>
            <button
                ref={triggerRef}
                type="button"
                className="gw-export-trigger"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                disabled={busy}
                onClick={() => setOpen((current) => !current)}
            >
                {labels.exportAction}
            </button>

            {open && (
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    aria-label={labels.exportAction}
                    className="gw-export-menu"
                    data-align={align}
                    onKeyDown={onKeyDown}
                >
                    {scopes.length > 0 && (
                        <>
                            <div role="group" aria-labelledby={rowsId} className="gw-export-group">
                                <span id={rowsId} className="gw-export-heading">
                                    {labels.exportRows}
                                </span>
                                {scopes.map((option) => {
                                    const available = isScopeAvailable(option.id);
                                    const described = option.id === 'all' && allUnavailable;
                                    return (
                                        <Fragment key={option.id}>
                                            <button
                                                type="button"
                                                role="menuitemradio"
                                                className="gw-export-item gw-export-radio"
                                                data-scope={option.id}
                                                aria-checked={scope === option.id}
                                                // Not `disabled`: a disabled button leaves the
                                                // arrow-key order, and an item a reader cannot
                                                // reach cannot tell them why it is off.
                                                aria-disabled={available ? undefined : true}
                                                aria-describedby={described ? noteId : undefined}
                                                onClick={() => {
                                                    // Stays open: the scope and the format are one
                                                    // decision, and the format is still to be chosen.
                                                    if (available) setScope(option.id);
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                            {/* Directly under the item it explains, not at the
                                                end of the group where it reads as being about
                                                the last item. */}
                                            {described && (
                                                <span id={noteId} className="gw-export-note">
                                                    {labels.exportAllUnavailable}
                                                </span>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </div>
                            <div role="separator" className="gw-export-separator" />
                        </>
                    )}

                    {formats.map((format) => (
                        <button
                            key={format.id}
                            type="button"
                            role="menuitem"
                            className="gw-export-item"
                            data-format={format.id}
                            onClick={() => {
                                // Closed first, so focus is back on the trigger before the file
                                // arrives and the reader is not left on the body.
                                close(true);
                                void exportAs(format.id);
                            }}
                        >
                            {format.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Its own region rather than the grid's.

                The grid's live region carries one sentence derived from engine state, and an
                export is not engine state: nothing about the rows on screen changed. The two
                never speak at once, because an export announces only while one is running. */}
            <span className="gw-visually-hidden" role="status" aria-live="polite">
                {message}
            </span>

            {error && (
                // Visible, not hidden. An export that produced no file has to say so where the
                // person who asked for it is looking. The sentence is translated and about the
                // rows; the developer's error went to `onError`.
                <p className="gw-export-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

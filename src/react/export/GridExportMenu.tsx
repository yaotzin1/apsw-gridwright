import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { classes, useGridwrightContext } from '../context';
import { DEFAULT_FORMATS, resolveFormats } from './formats';
import { useGridExport } from './useGridExport';
import type { GridExportOptions } from './types';

export interface GridExportMenuProps<TRow> extends GridExportOptions<TRow> {
    readonly className?: string;
}

/**
 * The export control: a button, and a menu of the formats it was given.
 *
 * A real `role="menu"` of buttons rather than a styled list, so every format is reachable by
 * keyboard, and focus returns to the trigger when the menu closes. Downloading a file moves focus
 * nowhere by itself, which is why returning it explicitly matters: without it the reader is left
 * on the document body with no way back to where they were.
 */
export function GridExportMenu<TRow>({ className, ...options }: GridExportMenuProps<TRow>) {
    const { labels } = useGridwrightContext<TRow>();
    const { exportAs, busy, message, error } = useGridExport<TRow>(options);
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const menuId = useId();

    // A custom format carries its own label, so the menu renders yours beside the built-in ones
    // with nothing to distinguish them.
    const formats = resolveFormats(options.formats ?? DEFAULT_FORMATS, labels);

    const close = (returnFocus: boolean): void => {
        setOpen(false);
        if (returnFocus) triggerRef.current?.focus();
    };

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
                    onKeyDown={onKeyDown}
                >
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
                // person who asked for it is looking, and the commonest cause is a source that
                // cannot hand over the rows that are not on screen.
                <p className="gw-export-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

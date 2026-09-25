import type { HTMLAttributes, ReactNode } from 'react';
import { useGridAnnouncement } from '../a11y/useAnnouncement';
import { mergeAttributes } from '../addons/resolve';
import { classes, useGridwrightContext } from '../context';
import { attributesOf, callSlot, renderSlot } from './slots';

export interface GridRootProps {
    readonly className?: string;
    readonly children?: ReactNode;
}

/**
 * The grid's outer element: its theme, direction and language, its one live region, the providers
 * add-ons wrap the grid in, and the overlays they float above it.
 *
 * Providers go inside this element, so a dialog an add-on renders keeps the grid's direction and
 * language, and outside the table, so the table's scrolling never clips it.
 */
export function GridRoot({ className, children }: GridRootProps) {
    const grid = useGridwrightContext();
    const { classNames, state, translator, contributions } = grid;
    const announcement = useGridAnnouncement(grid);

    let content: ReactNode = (
        <>
            {children}
            {renderSlot(grid, 'overlay')}
        </>
    );
    // The first add-on outermost, so wrap from the last one inwards.
    for (let index = contributions.active.length - 1; index >= 0; index -= 1) {
        const { name, contribution } = contributions.active[index]!;
        if (!contribution.provide) continue;
        const inner: ReactNode = content;
        content = callSlot<ReactNode>(name, () => contribution.provide!(inner, grid), inner);
    }

    const attributes = mergeAttributes<HTMLAttributes<HTMLDivElement> & { readonly 'data-status': string }>(
        {
            className: classes('gw-root', classNames.root, className),
            'data-status': state.status,
            // Set only for right-to-left, so a grid inside an already-RTL page does not reset
            // itself to the document direction it is nested in.
            dir: translator.direction === 'rtl' ? 'rtl' : undefined,
            lang: translator.locale,
        },
        // A theme add-on's custom properties land here, on the element every part is inside.
        ...attributesOf(contributions.active, 'rootAttributes', (fn) => fn(grid)),
    );

    return (
        <div {...attributes}>
            {/* A visually hidden live region: without it a screen reader gets no announcement at
                all when the rows change under a paginating grid.

                One sentence, never the rows themselves. A region is read out in full every time it
                changes, so `aria-live` on the tbody would recite a hundred and fifty cells on every
                page change, every sort and every keystroke of the search box. */}
            <span className="gw-visually-hidden" role="status" aria-live="polite">
                {announcement}
            </span>
            {content}
        </div>
    );
}

import type { KeyboardEvent, ReactNode, RefObject, TableHTMLAttributes } from 'react';
import { rowNumbering } from '../a11y/rows';
import { mergeAttributes } from '../addons/resolve';
import { classes, useGridwrightContext } from '../context';
import { attributesOf, callSlot, renderSlot } from './slots';

export interface GridTableProps {
    readonly children: ReactNode;
    readonly caption?: ReactNode;
    readonly 'aria-label'?: string;
}

/**
 * The table element and its scroll container.
 *
 * `role="grid"` goes on a real `<table>` rather than a stack of divs, so the column and row
 * relationships a screen reader announces come from the markup instead of from ARIA attributes
 * that have to be kept in sync by hand. The wrapper scrolls, not the table, which is what lets a
 * wide grid stay inside its column on a narrow screen.
 *
 * Add-ons reach both elements: attributes on the table (a tree makes it a `treegrid`), the wrapper's
 * ref, style and class (a windowed body scrolls it), the table's keyboard, and a `<tfoot>`.
 */
export function GridTable({ children, caption, 'aria-label': ariaLabel }: GridTableProps) {
    const grid = useGridwrightContext();
    const { state, classNames, contributions } = grid;
    const numbering = rowNumbering(state.totalRows, state.isTotalExact);

    let wrapperRef: RefObject<HTMLDivElement | null> | undefined;
    let wrapperStyle: object | undefined;
    const wrapperClasses: string[] = [];
    for (const { name, contribution } of contributions.active) {
        if (!contribution.tableWrapper) continue;
        const wrapper = callSlot(name, () => contribution.tableWrapper!(grid), {});
        if (wrapper.ref) wrapperRef = wrapper.ref;
        if (wrapper.style) wrapperStyle = { ...wrapperStyle, ...wrapper.style };
        if (wrapper.className) wrapperClasses.push(wrapper.className);
    }

    const keyHandlers = contributions.active.filter(({ contribution }) => contribution.tableKeyDown);
    const onKeyDown =
        keyHandlers.length === 0
            ? undefined
            : (event: KeyboardEvent<HTMLTableElement>) => {
                  for (const { name, contribution } of keyHandlers) {
                      if (callSlot(name, () => contribution.tableKeyDown!(event, grid), false)) {
                          event.preventDefault();
                          return;
                      }
                  }
              };

    const attributes = mergeAttributes<TableHTMLAttributes<HTMLTableElement> & Record<string, unknown>>(
        {
            className: classes('gw-table', classNames.table),
            role: 'grid',
            'aria-label': ariaLabel,
            // Counts the header row, because `aria-rowindex` does. The two have to agree, and
            // ARIA numbers every row of the table rather than every row of the body.
            'aria-rowcount': numbering.rowCount,
            'aria-busy': state.status === 'loading' || state.status === 'refreshing',
            onKeyDown,
        },
        ...attributesOf(contributions.active, 'tableAttributes', (fn) => fn(grid)),
    );

    return (
        <div
            ref={wrapperRef}
            className={classes('gw-table-wrapper', classNames.tableWrapper, ...wrapperClasses)}
            style={wrapperStyle}
        >
            <table {...attributes}>
                {caption ? <caption className="gw-caption">{caption}</caption> : null}
                {children}
                {renderSlot(grid, 'tableFooter')}
            </table>
        </div>
    );
}

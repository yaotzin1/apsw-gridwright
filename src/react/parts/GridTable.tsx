import { useCallback, useRef } from 'react';
import type { KeyboardEvent, ReactNode, RefObject, TableHTMLAttributes } from 'react';
import { rowNumbering } from '../a11y/rows';
import { mergeAttributes } from '../addons/resolve';
import { classes, useGridwrightContext } from '../context';
import { attributesOf, callSlot, columnWindowOf, extraColumnsOf, renderSlot } from './slots';

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
 * ref, style and class (a windowed body scrolls it), the table's keyboard, and a `<tfoot>`. Every
 * add-on that contributes a wrapper ref has it set, so a row window and a column window can both
 * read the one element that scrolls.
 */
export function GridTable({ children, caption, 'aria-label': ariaLabel }: GridTableProps) {
    const grid = useGridwrightContext();
    const { state, classNames, contributions } = grid;
    const numbering = rowNumbering(state.totalRows, state.isTotalExact);

    const wrapperRefs: RefObject<HTMLDivElement | null>[] = [];
    let wrapperStyle: object | undefined;
    const wrapperClasses: string[] = [];
    for (const { name, contribution } of contributions.active) {
        if (!contribution.tableWrapper) continue;
        const wrapper = callSlot(name, () => contribution.tableWrapper!(grid), {});
        if (wrapper.ref) wrapperRefs.push(wrapper.ref);
        if (wrapper.style) wrapperStyle = { ...wrapperStyle, ...wrapper.style };
        if (wrapper.className) wrapperClasses.push(wrapper.className);
    }

    // Every add-on that asks for the wrapper gets it: a row window and a column window both scroll
    // it. The refs are read through a ref of their own, so the callback keeps one identity and React
    // does not detach and reattach the element on every render.
    const refs = useRef(wrapperRefs);
    refs.current = wrapperRefs;
    const attachWrapper = useCallback((element: HTMLDivElement | null) => {
        for (const ref of refs.current) ref.current = element;
    }, []);

    // Under a column window not every column is in the DOM, so the table says how many there are.
    const plan = columnWindowOf(grid);
    const extras = plan ? extraColumnsOf(grid) : null;
    const colCount = plan && extras ? extras.start.length + plan.columnCount + extras.end.length : undefined;

    const keyHandlers = contributions.active.filter(({ contribution }) => contribution.tableKeyDown);
    const onKeyDown =
        keyHandlers.length === 0
            ? undefined
            : (event: KeyboardEvent<HTMLTableElement>) => {
                  // Only this table's own keys reach this table's add-ons. A `<table>` an add-on or a
                  // cell renderer put inside this one -- a grid in a detail row, most obviously --
                  // bubbles its keys up to here, and without this guard a `tableKeyDown` contributor
                  // would move the outer grid's cursor for an arrow key pressed in the inner one.
                  const target = event.target as Element | null;
                  if (target?.closest?.('table') !== event.currentTarget) return;

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
            'aria-colcount': colCount,
            'aria-busy': state.status === 'loading' || state.status === 'refreshing',
            onKeyDown,
        },
        ...attributesOf(contributions.active, 'tableAttributes', (fn) => fn(grid)),
    );

    return (
        <div
            ref={attachWrapper}
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

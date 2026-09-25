import type { GridState } from '../../core/types';

/**
 * What the pagination add-on decides, with no renderer: the range, the page-size choices and where
 * focus goes after a page change. The native pager and any other view of it (the MUI one, an add-on
 * of yours) call these, so they cannot disagree about any of it.
 */

export const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100];

/**
 * The rows the page shows, as the range says them.
 *
 * `total` is null exactly when the source sent no count. A view that has no null to show cannot
 * print a total computed from one page, which is the number a reader would act on and get wrong.
 */
export function pageRangeOf(state: GridState<unknown>): { readonly from: number; readonly to: number; readonly total: number | null } {
    const { pageIndex, pageSize } = state.query.pagination;
    const from = state.totalRows === 0 ? 0 : pageIndex * pageSize + 1;
    const to = Math.min(state.totalRows, pageIndex * pageSize + state.rows.length);
    return { from, to, total: state.isTotalExact ? state.totalRows : null };
}

/**
 * The page sizes to offer: the configured ones, plus the grid's actual size when it is not listed.
 *
 * A `<select>` whose value is not among its options renders the first one instead, so a grid with
 * `pageSize={5}` and the default options showed "10" while displaying five rows, and the reader
 * could not get back to five once they had changed it.
 */
export function pageSizeChoices(options: readonly number[], pageSize: number): readonly number[] {
    return options.includes(pageSize) ? options : [...options, pageSize].sort((a, b) => a - b);
}

/**
 * Which page button takes focus once the page has settled, or null to leave focus alone.
 *
 * A focused button that disables itself sends focus to `<body>`, so reaching the last page ejects a
 * keyboard reader from the grid. Only the button the reader pressed earns a move: a page change
 * driven through the API must not steal focus from wherever the reader actually is. And the pressed
 * button keeps focus while it is still usable, because the reader is still pressing it.
 */
export function pageFocusAfterChange(
    pressed: 'previous' | 'next' | null,
    disabled: { readonly previous: boolean; readonly next: boolean },
): 'previous' | 'next' | null {
    if (pressed === null || !disabled[pressed]) return null;
    const sibling = pressed === 'next' ? 'previous' : 'next';
    return disabled[sibling] ? null : sibling;
}

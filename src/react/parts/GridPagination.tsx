import { useLayoutEffect, useRef } from 'react';
import { classes, useGridwrightContext } from '../context';

export interface GridPaginationProps {
    readonly pageSizeOptions?: readonly number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Page controls and the row range.
 *
 * The range respects `isTotalExact`. When a paginating source answers without a total, the grid
 * knows only that another page exists, and saying "1-25 of 25" there would be a lie the reader
 * acts on. `labels.pageRange` receives the flag and words it accordingly.
 *
 * Both controls disable themselves at the end of their travel, which is correct and which loses
 * the keyboard user's place: a focused element that becomes disabled sends focus to `<body>`, so
 * reaching the last page ejects the reader from the grid. Focus moves to the sibling instead.
 */
export function GridPagination({ pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS }: GridPaginationProps) {
    const { api, state, classNames, labels } = useGridwrightContext();

    const previous = useRef<HTMLButtonElement | null>(null);
    const next = useRef<HTMLButtonElement | null>(null);
    // Which control the reader last pressed. Only that one earns a focus move: a page change the
    // consumer drove through the API must not steal focus from wherever they actually are.
    const pressed = useRef<'previous' | 'next' | null>(null);

    useLayoutEffect(() => {
        const from = pressed.current;
        pressed.current = null;
        if (from === null) return;

        const used = from === 'next' ? next.current : previous.current;
        const sibling = from === 'next' ? previous.current : next.current;

        // Still usable: the reader keeps pressing it, which is what they were doing.
        if (!used || !used.disabled) return;
        if (sibling && !sibling.disabled) sibling.focus();
    }, [state.version, state.hasNextPage, state.hasPreviousPage]);

    const { pageIndex, pageSize } = state.query.pagination;
    const from = state.totalRows === 0 ? 0 : pageIndex * pageSize + 1;
    const to = Math.min(state.totalRows, pageIndex * pageSize + state.rows.length);

    return (
        <div className={classes('gw-pagination', classNames.pagination)}>
            <label className="gw-page-size">
                <span className="gw-page-size-label">{labels.rowsPerPage}</span>
                <select
                    className="gw-select"
                    value={pageSize}
                    onChange={(event) => api.setPageSize(Number(event.target.value))}
                >
                    {pageSizeOptions.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </label>

            <span className="gw-page-range" aria-live="polite">
                {labels.pageRange(from, to, state.totalRows, state.isTotalExact)}
            </span>

            <div className="gw-page-controls">
                <button
                    ref={previous}
                    type="button"
                    className="gw-button gw-button--icon"
                    onClick={() => {
                        pressed.current = 'previous';
                        api.previousPage();
                    }}
                    disabled={!state.hasPreviousPage}
                    aria-label={labels.previousPage}
                >
                    &#8592;
                </button>
                <button
                    ref={next}
                    type="button"
                    className="gw-button gw-button--icon"
                    onClick={() => {
                        pressed.current = 'next';
                        api.nextPage();
                    }}
                    disabled={!state.hasNextPage}
                    aria-label={labels.nextPage}
                >
                    &#8594;
                </button>
            </div>
        </div>
    );
}

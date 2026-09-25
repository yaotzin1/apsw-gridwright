import { useLayoutEffect, useMemo, useRef } from 'react';
import { useAddonMessages } from '../addons/context';
import { classes, useGridwrightContext } from '../context';
import { PAGINATION_ADDON, paginationMessages } from '../core-addons/messages';
import { DEFAULT_PAGE_SIZE_OPTIONS, pageFocusAfterChange, pageRangeOf, pageSizeChoices } from '../core-addons/pagination-logic';

export interface GridPaginationProps {
    readonly pageSizeOptions?: readonly number[];
}

/**
 * Page controls and the row range.
 *
 * The range respects `isTotalExact`. When a paginating source answers without a total, the grid
 * knows only that another page exists, and saying "1-25 of 25" there would be a lie the reader
 * acts on. The range is worded from the flag: `range` with a total, `rangeUnknown` without.
 *
 * Both controls disable themselves at the end of their travel, which is correct and which loses
 * the keyboard user's place: a focused element that becomes disabled sends focus to `<body>`, so
 * reaching the last page ejects the reader from the grid. Focus moves to the sibling instead.
 */
export function GridPagination({ pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS }: GridPaginationProps) {
    const { api, state, classNames } = useGridwrightContext();
    const t = useAddonMessages(PAGINATION_ADDON, paginationMessages);

    const previous = useRef<HTMLButtonElement | null>(null);
    const next = useRef<HTMLButtonElement | null>(null);
    // Which control the reader last pressed. Only that one earns a focus move: a page change the
    // consumer drove through the API must not steal focus from wherever they actually are.
    const pressed = useRef<'previous' | 'next' | null>(null);

    useLayoutEffect(() => {
        const target = pageFocusAfterChange(pressed.current, {
            previous: previous.current?.disabled ?? true,
            next: next.current?.disabled ?? true,
        });
        pressed.current = null;
        if (target !== null) (target === 'next' ? next : previous).current?.focus();
    }, [state.version, state.hasNextPage, state.hasPreviousPage]);

    const { pageSize } = state.query.pagination;
    // The grid's actual page size is always one of the choices, whether or not it was listed.
    const options = useMemo(() => pageSizeChoices(pageSizeOptions, pageSize), [pageSizeOptions, pageSize]);
    const { from, to, total } = pageRangeOf(state);

    return (
        <div className={classes('gw-pagination', classNames.pagination)}>
            <label className="gw-page-size">
                <span className="gw-page-size-label">{t('rowsPerPage')}</span>
                <select
                    className="gw-select"
                    value={pageSize}
                    onChange={(event) => api.setPageSize(Number(event.target.value))}
                >
                    {options.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </label>

            {/* Not a live region. The grid's one region already says "Showing 4 to 6 of 7" when the page
                settles; a second region here said the same range again, a moment later. */}
            <span className="gw-page-range">
                {total === null ? t('rangeUnknown', { from, to }) : t('range', { from, to, total })}
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
                    aria-label={t('previous')}
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
                    aria-label={t('next')}
                >
                    &#8594;
                </button>
            </div>
        </div>
    );
}

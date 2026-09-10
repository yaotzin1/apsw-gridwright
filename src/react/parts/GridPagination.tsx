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
 */
export function GridPagination({ pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS }: GridPaginationProps) {
    const { api, state, classNames, labels } = useGridwrightContext();

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
                    type="button"
                    className="gw-button gw-button--icon"
                    onClick={() => api.previousPage()}
                    disabled={!state.hasPreviousPage}
                    aria-label={labels.previousPage}
                >
                    &#8592;
                </button>
                <button
                    type="button"
                    className="gw-button gw-button--icon"
                    onClick={() => api.nextPage()}
                    disabled={!state.hasNextPage}
                    aria-label={labels.nextPage}
                >
                    &#8594;
                </button>
            </div>
        </div>
    );
}

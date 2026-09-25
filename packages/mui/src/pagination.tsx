import IconButton from '@mui/material/IconButton';
import TablePagination from '@mui/material/TablePagination';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
    DEFAULT_PAGE_SIZE_OPTIONS,
    PAGINATION_ADDON,
    pageFocusAfterChange,
    pageRangeOf,
    pageSizeChoices,
    paginationMessages,
    useAddonMessages,
    useGridwrightContext,
    type GridAddon,
    type PaginationOptions,
} from 'apsw-gridwright/react';

/**
 * Page controls and the row range with MUI's `TablePagination`.
 *
 * The same add-on as `pagination()`, with the same name, so `virtualRows()` still replaces it. What
 * it shows is the grid's, not MUI's: the range is always the `range` or `rangeUnknown` message, so
 * MUI's own "more than N" never renders, and Previous and Next are enabled from `hasPreviousPage`
 * and `hasNextPage` rather than from a page count MUI would compute from a total the grid may not
 * have.
 */
export function muiPagination<TRow>(options: PaginationOptions = {}): GridAddon<TRow> {
    const pageSizeOptions = options.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
    return {
        name: PAGINATION_ADDON,
        setup: () => ({
            messages: paginationMessages,
            belowTable: () => <MuiPager pageSizeOptions={pageSizeOptions} />,
        }),
    };
}

function MuiPager({ pageSizeOptions }: { pageSizeOptions: readonly number[] }) {
    const { api, state, classNames } = useGridwrightContext();
    const t = useAddonMessages(PAGINATION_ADDON, paginationMessages);
    const { pageIndex, pageSize } = state.query.pagination;
    const options = useMemo(() => [...pageSizeChoices(pageSizeOptions, pageSize)], [pageSizeOptions, pageSize]);
    const { from, to, total } = pageRangeOf(state);

    return (
        <TablePagination
            component="div"
            className={['gw-pagination', classNames.pagination].filter(Boolean).join(' ')}
            // -1 is MUI's "unknown". The grid never hands it a total it did not receive.
            count={total ?? -1}
            page={pageIndex}
            rowsPerPage={pageSize}
            rowsPerPageOptions={options}
            onPageChange={(_event, page) => api.setPage(page)}
            onRowsPerPageChange={(event) => api.setPageSize(Number(event.target.value))}
            labelRowsPerPage={t('rowsPerPage')}
            // A real <select>, still in MUI's clothes: its options open where the platform opens
            // them rather than in a portal outside the grid, so they keep the grid's direction and
            // language, and every test of the native pager holds against this one unchanged.
            // MUI associates its label with the non-native select only, so the name is given here,
            // in the same words as the visible label.
            slotProps={{ select: { native: true, inputProps: { 'aria-label': t('rowsPerPage') } } }}
            labelDisplayedRows={() => (total === null ? t('rangeUnknown', { from, to }) : t('range', { from, to, total }))}
            ActionsComponent={PageActions}
        />
    );
}

/**
 * Previous and Next, as a documented `TablePagination` extension point rather than its default
 * actions, for two reasons: the enabled state comes from the engine, and the buttons need refs so a
 * button that disables itself under the reader's focus hands focus to its sibling instead of to
 * `<body>`, exactly as the native pager does.
 */
function PageActions() {
    const { api, state } = useGridwrightContext();
    const t = useAddonMessages(PAGINATION_ADDON, paginationMessages);
    const previous = useRef<HTMLButtonElement | null>(null);
    const next = useRef<HTMLButtonElement | null>(null);
    const pressed = useRef<'previous' | 'next' | null>(null);

    useLayoutEffect(() => {
        const target = pageFocusAfterChange(pressed.current, {
            previous: previous.current?.disabled ?? true,
            next: next.current?.disabled ?? true,
        });
        pressed.current = null;
        if (target !== null) (target === 'next' ? next : previous).current?.focus();
    }, [state.version, state.hasNextPage, state.hasPreviousPage]);

    return (
        <div className="gw-page-controls">
            <IconButton
                ref={previous}
                size="small"
                aria-label={t('previous')}
                disabled={!state.hasPreviousPage}
                onClick={() => {
                    pressed.current = 'previous';
                    api.previousPage();
                }}
            >
                {/* The same glyphs as the native pager, so both views read alike. */}
                <span aria-hidden="true">&#8592;</span>
            </IconButton>
            <IconButton
                ref={next}
                size="small"
                aria-label={t('next')}
                disabled={!state.hasNextPage}
                onClick={() => {
                    pressed.current = 'next';
                    api.nextPage();
                }}
            >
                <span aria-hidden="true">&#8594;</span>
            </IconButton>
        </div>
    );
}

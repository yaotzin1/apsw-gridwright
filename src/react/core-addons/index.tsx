import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import { useAddonMessages } from '../addons/context';
import type { GridAddon } from '../addons/types';
import { classes, useGridwrightContext } from '../context';
import { GridPagination } from '../parts/GridPagination';
import { GridStaleNotice } from '../parts/GridStaleNotice';
import { PAGINATION_ADDON, SEARCH_ADDON, searchMessages, STALE_NOTICE_ADDON, staleNoticeMessages, paginationMessages } from './messages';
import { selection } from './selection';
import { sorting } from './sorting';

export { sorting, type SortingOptions } from './sorting';
export { selection, type SelectionOptions } from './selection';
export * from './messages';

export interface PaginationOptions {
    /** Default `[10, 25, 50, 100]`. */
    readonly pageSizeOptions?: readonly number[];
}

/** Page controls and the row range, below the table. A windowed body suppresses it. */
export function pagination<TRow>(options: PaginationOptions = {}): GridAddon<TRow> {
    return {
        name: PAGINATION_ADDON,
        setup: () => ({
            messages: paginationMessages,
            belowTable: () => <GridPagination {...(options.pageSizeOptions ? { pageSizeOptions: options.pageSizeOptions } : {})} />,
        }),
    };
}

/** The banner above the table when a refresh failed and the previous rows are still on screen. */
export function staleNotice<TRow>(): GridAddon<TRow> {
    return {
        name: STALE_NOTICE_ADDON,
        setup: () => ({
            messages: staleNoticeMessages,
            aboveTable: (grid) => (grid.state.status === 'error' && grid.state.rows.length > 0 ? <GridStaleNotice /> : null),
        }),
    };
}

/** The global search box, first in the toolbar. Not in the core set: a grid does not need one. */
export function search<TRow>(): GridAddon<TRow> {
    return {
        name: SEARCH_ADDON,
        setup: () => ({
            messages: searchMessages,
            toolbar: () => <GridSearch />,
        }),
    };
}

export interface GridSearchProps {
    readonly className?: string;
}

/**
 * The search input.
 *
 * Uncontrolled with respect to the engine on purpose: it keeps its own text so typing never waits
 * for a round trip, and a debounced grid stays responsive between keystrokes. It resyncs only when
 * the query changes from somewhere else, such as a cleared filter.
 */
export function GridSearch({ className }: GridSearchProps) {
    const { api, state, classNames } = useGridwrightContext();
    const t = useAddonMessages(SEARCH_ADDON, searchMessages);
    const [term, setTerm] = useState(state.query.search);

    useEffect(() => {
        setTerm((current) => (current === state.query.search ? current : state.query.search));
    }, [state.query.search]);

    const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setTerm(event.target.value);
        api.setSearch(event.target.value);
    };

    return (
        <input
            type="search"
            className={classes('gw-search', classNames.search, className)}
            value={term}
            onChange={onChange}
            placeholder={t('placeholder')}
            aria-label={t('label')}
        />
    );
}

/**
 * The add-ons every grid starts with: sorting, selection, pagination and the stale-rows notice.
 *
 * Spread it to keep them while changing one: `[...coreAddons().filter((a) => a.name !== 'gridwright:pagination'), pagination({ pageSizeOptions: [5, 10] })]`.
 */
export function coreAddons<TRow>(): GridAddon<TRow>[] {
    return [sorting<TRow>(), selection<TRow>(), pagination<TRow>(), staleNotice<TRow>()];
}

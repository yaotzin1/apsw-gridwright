import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, GridApi, GridQuery } from '../../src/core/types';
import type { GridAddon } from '../../src/react/addons/types';
import { search } from '../../src/react/core-addons';
import { Gridwright } from '../../src/react/Gridwright';
import type { GridwrightColumn, GridwrightProps } from '../../src/react/types';
import { urlSync } from '../../src/react/url-sync/addon';
import type { UrlSyncAdapter } from '../../src/react/url-sync/types';
import { virtualRows } from '../../src/react/virtual/addon';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

const columns: readonly GridwrightColumn<Person>[] = personColumns;

/** Hands the test the grid's engine through the public contract, the way any add-on reaches it. */
function captureApi(): { addon: GridAddon<Person>; api: () => GridApi<Person> } {
    let captured: GridApi<Person> | null = null;
    return {
        addon: {
            name: 'test:capture',
            setup: () => ({
                provide: (children, grid) => {
                    captured = grid.api;
                    return children;
                },
            }),
        },
        api: () => captured!,
    };
}

/** An in-memory source that records every query it was asked for. */
function recordingSource(): { source: DataSource<Person>; queries: GridQuery[] } {
    const queries: GridQuery[] = [];
    return {
        queries,
        source: {
            kind: 'recording',
            capabilities: { sort: false, filter: false, search: false, paginate: false },
            fetch: ({ query }) => {
                queries.push(query);
                return { rows: people };
            },
        },
    };
}

// The prototype's method, so a spy on `window.history` sees only what the add-on writes.
const nativeReplaceState = History.prototype.replaceState;
const goTo = (url: string) => nativeReplaceState.call(window.history, null, '', url);
/** What Back does: the URL changes under the page, then `popstate` says so. */
const back = (url: string) =>
    act(() => {
        goTo(url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
const params = () => new URLSearchParams(window.location.search);
const names = () =>
    screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');

const renderGrid = (props: Partial<GridwrightProps<Person>> = {}, addons: readonly GridAddon<Person>[] = [urlSync({ debounceMs: 0 })]) => {
    const capture = captureApi();
    const view = render(<Gridwright<Person> columns={columns} data={people} pageSize={2} addons={[...addons, capture.addon]} {...props} />);
    return { ...view, api: capture.api };
};

beforeEach(() => goTo('/grid'));
afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('the urlSync() add-on', () => {
    // The point of configure: the linked query is the engine's initial query, so the default view is
    // never fetched and never flashes.
    it('opens a link with exactly one fetch, of the linked query', async () => {
        goTo('/grid?sort=salary:desc&page=2&q=e');
        const { source, queries } = recordingSource();

        renderGrid({ data: undefined, dataSource: source });

        await waitFor(() => expect(names()).toHaveLength(2));
        expect(queries).toHaveLength(1);
        expect(queries[0]).toMatchObject({
            search: 'e',
            sort: [{ columnId: 'salary', direction: 'desc' }],
            pagination: { pageIndex: 1, pageSize: 2 },
        });
    });

    it('applies a linked page size over the pageSize prop', async () => {
        goTo('/grid?size=3');
        renderGrid();
        await waitFor(() => expect(names()).toHaveLength(3));
    });

    it('writes a sort into the URL without adding a history entry', async () => {
        const user = userEvent.setup();
        renderGrid();
        const before = window.history.length;

        await user.click(screen.getByRole('button', { name: /Salary/ }));

        expect(params().get('sort')).toBe('salary:asc');
        expect(window.location.search).toBe('?sort=salary:asc');
        expect(window.history.length).toBe(before);
    });

    it('adds a history entry for a page change, so Back returns to the previous page', async () => {
        const user = userEvent.setup();
        renderGrid();
        const before = window.history.length;

        await user.click(screen.getByRole('button', { name: /next/i }));

        expect(params().get('page')).toBe('2');
        expect(window.history.length).toBe(before + 1);
    });

    it('does not push when a filter change moves the page back to the first', () => {
        goTo('/grid?page=3');
        const { api } = renderGrid();
        const before = window.history.length;

        act(() => api().setSearch('a'));

        expect(params().get('page')).toBeNull();
        expect(params().get('q')).toBe('a');
        expect(window.history.length).toBe(before);
    });

    it('applies Back and Forward to the grid without writing them back', () => {
        const { api } = renderGrid();
        const onQueryChange = vi.fn();
        api().on('query:change', onQueryChange);
        const replace = vi.spyOn(window.history, 'replaceState');
        const push = vi.spyOn(window.history, 'pushState');

        back('/grid?sort=name:desc&page=2');

        expect(api().getState().query).toMatchObject({
            sort: [{ columnId: 'name', direction: 'desc' }],
            pagination: { pageIndex: 1, pageSize: 2 },
        });
        expect(onQueryChange).toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
        expect(push).not.toHaveBeenCalled();
    });

    it('returns a facet the URL no longer names to the grid\'s own starting value', () => {
        goTo('/grid?sort=salary:asc&q=ada');
        const { api } = renderGrid({ initialQuery: { sort: [{ columnId: 'name', direction: 'asc' }] } });

        back('/grid');

        expect(api().getState().query.sort).toEqual([{ columnId: 'name', direction: 'asc' }]);
        expect(api().getState().query.search).toBe('');
    });

    // The engine returns to the first page when the filters change unless the page changed too. An
    // entry with a different search on the same page would land on page one and be rewritten there.
    it('keeps the entry\'s page when Back changes the filters but not the page', () => {
        goTo('/grid?q=a&page=2');
        const { api } = renderGrid();

        back('/grid?q=e&page=2');

        expect(api().getState().query.search).toBe('e');
        expect(api().getState().query.pagination.pageIndex).toBe(1);
        expect(params().get('page')).toBe('2');
    });

    // Pushing the engine's own clamp makes Back lead to the page past the end, which clamps and pushes
    // again: a reader who can never leave.
    it('replaces rather than pushes when the engine corrects a linked page past the end', async () => {
        goTo('/grid?page=99');
        const before = window.history.length;

        const { api } = renderGrid();

        await waitFor(() => expect(api().getState().query.pagination.pageIndex).toBe(3));
        expect(params().get('page')).toBe('4');
        expect(window.history.length).toBe(before);
    });

    it('drops what the grid cannot use and still applies the rest', async () => {
        goTo('/grid?sort=nope:asc,name:desc&f=__nope__:eq:1&page=abc');
        const { api } = renderGrid();

        await waitFor(() => expect(names()[0]).toBe('Mary Jackson'));
        expect(api().getState().query.filters).toEqual([]);
        expect(api().getState().query.pagination.pageIndex).toBe(0);
        // What was dropped leaves the URL too, so the link the reader copies is the view they see.
        expect(window.location.search).toBe('?sort=name:desc');
    });

    it('leaves a link that already describes the grid untouched on mount', () => {
        goTo('/grid?sort=salary:desc&page=2');
        const replace = vi.spyOn(window.history, 'replaceState');
        const push = vi.spyOn(window.history, 'pushState');

        renderGrid();

        expect(replace).not.toHaveBeenCalled();
        expect(push).not.toHaveBeenCalled();
    });

    it('keeps other parameters and the hash, and prefixes its own', () => {
        goTo('/grid?tab=people&q=unrelated#section');
        const { api } = renderGrid({}, [urlSync({ prefix: 'gw_', debounceMs: 0 })]);

        act(() => api().setSort([{ columnId: 'name', direction: 'desc' }]));

        expect(window.location.search).toBe('?tab=people&q=unrelated&gw_sort=name:desc');
        expect(window.location.hash).toBe('#section');
        expect(api().getState().query.search).toBe('');
    });

    it('writes only the facets it was given', () => {
        const { api } = renderGrid({}, [urlSync({ facets: ['sort'], debounceMs: 0 })]);

        act(() => api().setSearch('ada'));
        expect(window.location.search).toBe('');

        act(() => api().setSort([{ columnId: 'name', direction: 'asc' }]));
        expect(window.location.search).toBe('?sort=name:asc');
    });

    it('debounces replace writes and writes the latest query once', () => {
        vi.useFakeTimers();
        const { api } = renderGrid({}, [urlSync()]);
        const replace = vi.spyOn(window.history, 'replaceState');

        act(() => api().setSearch('a'));
        act(() => api().setSearch('ad'));
        act(() => api().setSearch('ada'));
        expect(replace).not.toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(300));
        expect(replace).toHaveBeenCalledTimes(1);
        expect(params().get('q')).toBe('ada');
    });

    it('cancels a pending write on unmount rather than writing into whatever route follows', () => {
        vi.useFakeTimers();
        const { api, unmount } = renderGrid({}, [urlSync()]);

        act(() => api().setSearch('ada'));
        unmount();
        act(() => vi.advanceTimersByTime(1000));

        expect(window.location.search).toBe('');
    });

    // A pending replace written after Back would overwrite the entry the reader just moved to.
    it('cancels a pending write when the URL changes from outside', () => {
        vi.useFakeTimers();
        const { api } = renderGrid({}, [urlSync()]);

        act(() => api().setSearch('ada'));
        back('/grid?sort=name:asc');
        act(() => vi.advanceTimersByTime(1000));

        expect(window.location.search).toBe('?sort=name:asc');
        expect(api().getState().query.search).toBe('');
    });

    it('resyncs the search box after Back', async () => {
        renderGrid({}, [search(), urlSync({ debounceMs: 0 })]);

        back('/grid?q=grace');

        await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('grace'));
    });

    // A windowed body moves the page as the reader scrolls; that is a scroll position, not history.
    it('does not write or push the page of a windowed grid', () => {
        const { api } = renderGrid({}, [virtualRows(), urlSync({ debounceMs: 0 })]);
        const before = window.history.length;

        act(() => api().setPage(2));

        expect(params().get('page')).toBeNull();
        expect(window.history.length).toBe(before);
    });

    it('survives Strict Mode\'s double mount with the linked query and a working writer', async () => {
        goTo('/grid?sort=salary:desc');
        const capture = captureApi();
        render(
            <StrictMode>
                <Gridwright<Person> columns={columns} data={people} pageSize={2} addons={[urlSync({ debounceMs: 0 }), capture.addon]} />
            </StrictMode>,
        );

        await waitFor(() => expect(names()[0]).toBe('Grace Hopper'));
        act(() => capture.api().setSort([{ columnId: 'name', direction: 'asc' }]));
        expect(window.location.search).toBe('?sort=name:asc');
    });
});

describe('a router adapter', () => {
    /** A router that delivers parameters by re-rendering, with no subscription at all. */
    function RoutedGrid({ onWrite }: { readonly onWrite: (params: URLSearchParams, mode: string) => void }) {
        const [params, setParams] = useState(() => new URLSearchParams('sort=salary:desc'));
        const adapter: UrlSyncAdapter = {
            getParams: () => params,
            setParams: (next, mode) => {
                onWrite(next, mode);
                setParams(next);
            },
        };
        return (
            <>
                <button type="button" onClick={() => setParams(new URLSearchParams('sort=name:asc&page=2'))}>
                    follow link
                </button>
                <Gridwright<Person> columns={columns} data={people} pageSize={2} addons={[urlSync({ adapter, debounceMs: 0 })]} />
            </>
        );
    }

    it('reads, writes and follows the router instead of the browser', async () => {
        const user = userEvent.setup();
        const onWrite = vi.fn();
        render(<RoutedGrid onWrite={onWrite} />);

        await waitFor(() => expect(names()[0]).toBe('Grace Hopper'));

        fireEvent.click(screen.getByRole('button', { name: 'follow link' }));
        await waitFor(() => expect(names()[0]).toBe('Dorothy Vaughan'));
        expect(onWrite).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: /next/i }));
        expect(onWrite).toHaveBeenCalledTimes(1);
        expect(onWrite.mock.calls[0]![0].toString()).toBe('sort=name%3Aasc&page=3');
        expect(onWrite.mock.calls[0]![1]).toBe('push');
        expect(window.location.search).toBe('');
    });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { search as searchAddon } from '../../src/react/core-addons';
import { createRemoteDataSource } from '../../src/data/remote';
import type { DataSourceRequest } from '../../src/core/types';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

// Long enough that a loaded machine cannot let the timer fire between two keystrokes of one burst.
const DEBOUNCE = 400;

function remoteGrid(props: { strict?: boolean; searchDebounceMs?: number } = {}) {
    const fetcher = vi.fn(async (_request: DataSourceRequest<Person>) => ({ rows: people.slice(0, 3), totalRows: people.length }));
    const source = createRemoteDataSource<Person>({ fetcher, retry: { attempts: 0 } });
    const grid = (
        <Gridwright<Person>
            columns={personColumns}
            dataSource={source}
            pageSize={3}
            addons={[searchAddon()]}
            searchDebounceMs={props.searchDebounceMs ?? DEBOUNCE}
            aria-label="People"
        />
    );
    render(props.strict ? <StrictMode>{grid}</StrictMode> : grid);
    return fetcher;
}

const queryOf = (fetcher: ReturnType<typeof remoteGrid>, call: number) => fetcher.mock.calls[call]![0].query;

describe('typing into a debounced search box', () => {
    it.each([false, true])('sends one request after the pause, not one per keystroke (Strict Mode: %s)', async (strict) => {
        const user = userEvent.setup();
        const fetcher = remoteGrid({ strict });
        await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
        const initial = fetcher.mock.calls.length;

        await user.type(screen.getByRole('searchbox'), 'invoice');

        // The rows for the query the reader left stay on screen while the pause runs.
        expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
        expect(fetcher).toHaveBeenCalledTimes(initial);

        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(initial + 1));
        expect(queryOf(fetcher, initial).search).toBe('invoice');

        await new Promise((resolve) => setTimeout(resolve, DEBOUNCE * 2));
        expect(fetcher).toHaveBeenCalledTimes(initial + 1);
    });

    it('lets a page click go out at once with the latest term and leaves no search timer behind', async () => {
        const user = userEvent.setup();
        const fetcher = remoteGrid();
        await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
        const initial = fetcher.mock.calls.length;

        // One synchronous change, so the click below certainly lands inside the pause.
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ada' } });
        await user.click(screen.getByRole('button', { name: 'Next page' }));

        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(initial + 1));
        const query = queryOf(fetcher, initial);
        expect(query.search).toBe('ada');
        expect(query.pagination.pageIndex).toBe(1);

        await new Promise((resolve) => setTimeout(resolve, DEBOUNCE * 2));
        expect(fetcher).toHaveBeenCalledTimes(initial + 1);
    });

    it('fetches on every keystroke when the option is not set, as before', async () => {
        const user = userEvent.setup();
        const fetcher = vi.fn(async (_request: DataSourceRequest<Person>) => ({ rows: people.slice(0, 3), totalRows: people.length }));
        render(
            <Gridwright<Person>
                columns={personColumns}
                dataSource={createRemoteDataSource<Person>({ fetcher, retry: { attempts: 0 } })}
                pageSize={3}
                addons={[searchAddon()]}
                aria-label="People"
            />,
        );
        await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
        const initial = fetcher.mock.calls.length;

        await user.type(screen.getByRole('searchbox'), 'ada');

        await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(initial + 3));
    });

    it('announces the settled result once, not once per keystroke', async () => {
        const user = userEvent.setup();
        remoteGrid();
        await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Showing 1 to 3 of 7'));

        const seen: string[] = [];
        const region = screen.getByRole('status');
        const observer = new MutationObserver(() => seen.push(region.textContent ?? ''));
        observer.observe(region, { childList: true, characterData: true, subtree: true });

        await user.type(screen.getByRole('searchbox'), 'invoice');
        await new Promise((resolve) => setTimeout(resolve, DEBOUNCE * 2));
        observer.disconnect();

        // One announcement that the rows are loading and one for the result, however many keys were
        // pressed: the waiting keystrokes said nothing, and the aborted request said nothing either.
        expect(seen).toEqual(['Loading rows', 'Showing 1 to 3 of 7']);
    });
});

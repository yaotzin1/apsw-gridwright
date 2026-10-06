import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGridEngine } from '../../src/core/engine';
import { GridwrightError } from '../../src/core/errors';
import { createRemoteDataSource } from '../../src/data/remote';
import { createRestDataSource } from '../../src/data/rest';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

beforeEach(() => {
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
});

describe('what the built-in sources do with the engine signal (AC-15)', () => {
    it('hands the signal of the engine request to the REST transport', async () => {
        const signals: (AbortSignal | null | undefined)[] = [];
        const fetchImpl = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
            signals.push(init?.signal);
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        });
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: createRestDataSource<Person>({ url: 'https://api.test/people', fetchImpl }),
        });
        await vi.advanceTimersByTimeAsync(0);

        api.setSearch('ada');
        await vi.advanceTimersByTimeAsync(0);

        // The first request was abandoned by the second, and the transport saw both abort states.
        expect(signals).toHaveLength(2);
        expect(signals[0]?.aborted).toBe(true);
        expect(signals[1]?.aborted).toBe(false);
        api.destroy();
    });

    it('hands the signal of the engine request to a remote fetcher', async () => {
        const signals: AbortSignal[] = [];
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: createRemoteDataSource<Person>({
                retry: { attempts: 0 },
                fetcher: async ({ signal }) => {
                    signals.push(signal);
                    return { rows: people.slice(0, 2), totalRows: 2 };
                },
            }),
        });
        await vi.advanceTimersByTimeAsync(0);

        api.setPage(1);
        api.setPage(0);
        await vi.advanceTimersByTimeAsync(0);

        expect(signals.length).toBeGreaterThan(1);
        expect(signals.slice(0, -1).every((signal) => signal.aborted)).toBe(true);
        expect(signals.at(-1)!.aborted).toBe(false);
        api.destroy();
    });

    it('stops waiting out a retry delay the moment the request is superseded', async () => {
        let attempts = 0;
        const api = createGridEngine<Person>({
            columns: personColumns,
            dataSource: createRemoteDataSource<Person>({
                retry: { attempts: 3, delayMs: 60_000 },
                fetcher: async ({ query }) => {
                    if (query.search === '') {
                        attempts += 1;
                        throw new GridwrightError('flaky', { status: 503 });
                    }
                    return { rows: people.slice(0, 2), totalRows: 2 };
                },
            }),
            searchDebounceMs: 0,
        });
        await vi.advanceTimersByTimeAsync(0);
        expect(attempts).toBe(1);

        // The first request is now sleeping for a minute before its second attempt.
        api.setSearch('ada');
        await vi.advanceTimersByTimeAsync(0);

        expect(api.getState().status).toBe('ready');
        expect(api.getState().rows).toHaveLength(2);
        expect(vi.getTimerCount()).toBe(0);

        await vi.advanceTimersByTimeAsync(120_000);
        expect(attempts).toBe(1);
        api.destroy();
    });
});

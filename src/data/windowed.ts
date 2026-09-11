import { isAbortError } from '../core/errors';
import type {
    DataSource,
    DataSourceCapabilities,
    DataSourceRequest,
    DataSourceResult,
    GridQuery,
    Unsubscribe,
} from '../core/types';

/** Where the rows the grid is currently holding start in the whole result set. */
export const WINDOW_OFFSET_META = 'gridwright:windowOffset';

export interface RangeRequest {
    /** Zero-based index of the first row wanted. */
    readonly offset: number;
    readonly limit: number;
    /** Sort, filters and search. Pagination is expressed by `offset` and `limit` instead. */
    readonly query: GridQuery;
    readonly signal: AbortSignal;
}

export interface RangeResult<TRow> {
    readonly rows: readonly TRow[];
    /**
     * How many rows match the query in total.
     *
     * Required, not optional: it is the scrollbar's height. A virtual grid that does not know the
     * total cannot draw a scrollbar, and a reader cannot tell whether they are near the end.
     */
    readonly totalRows: number;
}

export interface WindowedDataSourceOptions<TRow> {
    readonly fetchRange: (request: RangeRequest) => Promise<RangeResult<TRow>>;
    /**
     * Rows per fetched block. Default 200.
     *
     * The unit of caching and of network traffic, not of rendering. Smaller means more requests;
     * larger means more waiting the first time a region is reached.
     */
    readonly blockSize?: number;
    /**
     * Blocks kept in memory. Default 12, so roughly 2,400 rows at the default block size.
     *
     * This is the number that makes the table size irrelevant: the browser holds this many blocks
     * whether the result set is ten thousand rows or ten million.
     */
    readonly maxBlocks?: number;
    readonly capabilities?: Partial<DataSourceCapabilities>;
    readonly kind?: string;
}

export interface WindowedDataSource<TRow> extends DataSource<TRow> {
    /** Drops every cached block, for use after a mutation elsewhere in the application. */
    invalidate(): void;
    /** Blocks currently resident. Useful in a test or a diagnostic panel. */
    readonly cachedBlockCount: number;
}

interface Block<TRow> {
    readonly rows: readonly TRow[];
    /** Bumped on every access, so eviction can drop the least recently used. */
    usedAt: number;
}

interface Pending {
    readonly promise: Promise<void>;
    /** Whose request this load belongs to. A load is only worth joining while that request lives. */
    readonly signal: AbortSignal;
}

/**
 * A data source that holds a window rather than a table.
 *
 * The point is what it does *not* do: it never has the whole result set. It fetches the blocks
 * covering the rows the grid is currently showing, keeps a handful of neighbours, and evicts the
 * rest. Memory is therefore a function of `blockSize * maxBlocks`, not of how many rows exist,
 * which is what makes ten million rows a scrolling problem rather than an impossible one.
 *
 * Pair it with the virtualizer. On its own it still renders one window at a time, which is a
 * perfectly good paged grid; with the virtualizer the window follows the scroll position.
 */
export function createWindowedDataSource<TRow>(
    options: WindowedDataSourceOptions<TRow>,
): WindowedDataSource<TRow> {
    const blockSize = Math.max(1, options.blockSize ?? 200);
    const maxBlocks = Math.max(1, options.maxBlocks ?? 12);

    const blocks = new Map<number, Block<TRow>>();
    const inFlight = new Map<number, Pending>();
    const listeners = new Set<() => void>();

    let queryKey: string | null = null;
    let knownTotal = 0;
    let clock = 0;
    /**
     * Which cache the blocks belong to.
     *
     * Bumped whenever the cache is thrown away, so a load that started before that lands in the
     * cache it was meant for or nowhere. Without it, a fetch in flight across an `invalidate()`
     * puts the rows it was already carrying back into the cache that was just cleared.
     */
    let generation = 0;

    function reset(): void {
        blocks.clear();
        inFlight.clear();
        generation += 1;
    }

    /**
     * Everything about the query except which rows are wanted.
     *
     * A changed sort or filter renames every row's position, so every cached block is about a
     * result set that no longer exists. Keeping them would show rows from the previous ordering
     * at positions belonging to the new one.
     */
    const keyOf = (query: GridQuery): string =>
        JSON.stringify([query.sort, query.filters, query.search]);

    function evict(around: number): void {
        if (blocks.size <= maxBlocks) return;

        // Least recently used, then furthest from the window, so a scroll that reverses direction
        // still finds what it just left behind.
        const ordered = [...blocks.entries()].sort((a, b) => {
            const used = a[1].usedAt - b[1].usedAt;
            if (used !== 0) return used;
            return Math.abs(b[0] - around) - Math.abs(a[0] - around);
        });

        for (const [index] of ordered) {
            if (blocks.size <= maxBlocks) break;
            if (inFlight.has(index)) continue;
            blocks.delete(index);
        }
    }

    function loadBlock(index: number, query: GridQuery, signal: AbortSignal): Promise<void> {
        const existing = inFlight.get(index);
        // Only join a load whose own request is still alive. An aborted one resolves carrying
        // nothing, and waiting on it would leave this request with an empty window and no error:
        // the abort belonged to somebody else.
        if (existing && !existing.signal.aborted) return existing.promise;

        const bornAt = generation;
        const pending: { promise: Promise<void>; signal: AbortSignal } = {
            signal,
            promise: undefined as unknown as Promise<void>,
        };

        const settle = (): void => {
            // Only if this is still the entry for that block: a superseded load must not remove
            // the live one that replaced it.
            if (inFlight.get(index) === pending) inFlight.delete(index);
        };

        pending.promise = options
            .fetchRange({ offset: index * blockSize, limit: blockSize, query, signal })
            .then((result) => {
                settle();
                if (generation !== bornAt) return;
                knownTotal = result.totalRows;
                blocks.set(index, { rows: result.rows, usedAt: (clock += 1) });
            })
            .catch((error: unknown) => {
                settle();
                // An abort is the engine superseding this window, not a failure to report.
                if (isAbortError(error)) return;
                throw error;
            });

        inFlight.set(index, pending as Pending);
        return pending.promise;
    }

    /**
     * Loads whatever of `indices` is missing, and looks again.
     *
     * The second look is not belt and braces: a load this request joined can be aborted while it
     * waits, and the block is then still missing with nothing left in flight to wait for.
     */
    async function ensureBlocks(
        indices: readonly number[],
        query: GridQuery,
        signal: AbortSignal,
    ): Promise<void> {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const missing = indices.filter((index) => !blocks.has(index));
            if (missing.length === 0 || signal.aborted) return;
            await Promise.all(missing.map((index) => loadBlock(index, query, signal)));
        }
    }

    return {
        kind: options.kind ?? 'windowed',
        capabilities: {
            sort: true,
            filter: true,
            search: true,
            // Always true. The source answers with exactly the window asked for, so the pagination
            // stage must not slice it a second time.
            paginate: true,
            ...options.capabilities,
        },

        async fetch(request: DataSourceRequest<TRow>): Promise<DataSourceResult<TRow>> {
            const { query, signal } = request;
            const key = keyOf(query);

            if (key !== queryKey) {
                queryKey = key;
                reset();
            }

            const offset = query.pagination.pageIndex * query.pagination.pageSize;
            const limit = query.pagination.pageSize;

            const firstBlock = Math.floor(offset / blockSize);
            const lastBlock = Math.floor(Math.max(offset, offset + limit - 1) / blockSize);

            const wanted: number[] = [];
            for (let index = firstBlock; index <= lastBlock; index += 1) wanted.push(index);

            await ensureBlocks(wanted, query, signal);
            if (signal.aborted) return { rows: [], totalRows: knownTotal };

            const rows: TRow[] = [];
            for (let index = firstBlock; index <= lastBlock; index += 1) {
                const block = blocks.get(index);
                if (!block) continue;

                block.usedAt = clock += 1;
                const blockStart = index * blockSize;

                for (let position = 0; position < block.rows.length; position += 1) {
                    const absolute = blockStart + position;
                    if (absolute < offset || absolute >= offset + limit) continue;
                    rows.push(block.rows[position]!);
                }
            }

            evict(firstBlock);

            return {
                rows,
                totalRows: knownTotal,
                // Which absolute row the first of these is. Published rather than recomputed by the
                // reader, because while a new window loads the previous rows stay on screen and
                // the query has already moved on: the two would disagree.
                meta: { [WINDOW_OFFSET_META]: offset },
            };
        },

        subscribe(onInvalidate: () => void): Unsubscribe {
            listeners.add(onInvalidate);
            return () => {
                listeners.delete(onInvalidate);
            };
        },

        invalidate() {
            reset();
            queryKey = null;
            for (const listener of [...listeners]) listener();
        },

        get cachedBlockCount() {
            return blocks.size;
        },

        dispose() {
            blocks.clear();
            inFlight.clear();
            listeners.clear();
        },
    };
}

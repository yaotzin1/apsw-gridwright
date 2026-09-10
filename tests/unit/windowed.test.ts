import { describe, expect, it } from 'vitest';
import { createWindowedDataSource, WINDOW_OFFSET_META } from '../../src/data/windowed';
import { createQuery } from '../../src/core/query';
import type { DataSourceRequest, DataSourceResult, GridQuery } from '../../src/core/types';

/**
 * A source that holds a window rather than a table.
 *
 * The cases worth writing down are the ones where two requests overlap. The grid aborts the
 * request it no longer wants, and every one of these tests is about what the request it *does*
 * want is left holding afterwards.
 */

interface Person {
    readonly id: number;
    readonly name: string;
}

const TOTAL = 1_000_000;

const query = (pageIndex: number, pageSize: number): GridQuery => ({
    ...createQuery(),
    pagination: { pageIndex, pageSize },
});

/** The engine passes columns and meta too; nothing here reads them. */
const request = (
    pagination: GridQuery,
    signal: AbortSignal,
    overrides: Partial<GridQuery> = {},
): DataSourceRequest<Person> => ({
    query: { ...pagination, ...overrides },
    columns: [],
    signal,
    meta: {},
});

function makeSource(options: {
    readonly delay?: number;
    readonly name?: (index: number) => string;
    readonly onRange?: (offset: number) => void;
} = {}) {
    const gate: Array<() => void> = [];

    const source = createWindowedDataSource<Person>({
        blockSize: 100,
        maxBlocks: 4,
        fetchRange: async ({ offset, limit, signal }) => {
            options.onRange?.(offset);

            if (options.delay === -1) {
                // Held open until the test releases it, which is how two requests are made to
                // overlap deterministically rather than by racing timers.
                await new Promise<void>((resolve) => gate.push(resolve));
            } else if (options.delay) {
                await new Promise((resolve) => setTimeout(resolve, options.delay));
            }

            if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });

            const rows: Person[] = [];
            for (let index = offset; index < Math.min(offset + limit, TOTAL); index += 1) {
                rows.push({ id: index, name: options.name ? options.name(index) : `Person ${index}` });
            }
            return { rows, totalRows: TOTAL };
        },
    });

    return { source, release: () => gate.splice(0).forEach((resolve) => resolve()) };
}

describe('a windowed data source', () => {
    it('answers with exactly the window asked for, and says where it starts', async () => {
        const { source } = makeSource();
        const controller = new AbortController();

        const result = await source.fetch(request(query(3, 50), controller.signal));

        expect(result.rows).toHaveLength(50);
        expect(result.rows[0]!.id).toBe(150);
        expect(result.totalRows).toBe(TOTAL);
        expect(result.meta?.[WINDOW_OFFSET_META]).toBe(150);
    });

    it('serves a second window from the cache when it lands in a loaded block', async () => {
        const offsets: number[] = [];
        const { source } = makeSource({ onRange: (offset) => offsets.push(offset) });
        const controller = new AbortController();

        await source.fetch(request(query(0, 50), controller.signal));
        await source.fetch(request(query(1, 50), controller.signal));

        // Both windows live in block zero, so the second one costs nothing.
        expect(offsets).toEqual([0]);
    });

    it('gives the surviving request its rows when an overlapping one is aborted', async () => {
        const { source, release } = makeSource({ delay: -1 });

        const abandoned = new AbortController();
        const first = Promise.resolve(source.fetch(request(query(0, 100), abandoned.signal)));

        // The engine drops the window it no longer wants and asks for the same one again, which is
        // what any scroll that reverses direction does.
        abandoned.abort();
        const wanted = new AbortController();
        const second = source.fetch(request(query(0, 100), wanted.signal));

        release();
        await first.catch(() => undefined);
        release();
        const result = await second;

        // Waiting on the abandoned request's load would have returned an empty window, with a
        // `ready` grid showing nothing and no error to explain it.
        expect(result.rows).toHaveLength(100);
        expect(result.rows[0]!.id).toBe(0);
    });

    it('does not put rows fetched before an `invalidate` back into the cache', async () => {
        let generation = 1;
        const { source } = makeSource({ delay: 20, name: (index) => `v${generation} ${index}` });

        const stale: Promise<DataSourceResult<Person>> = Promise.resolve(
            source.fetch(request(query(0, 100), new AbortController().signal)),
        );

        // A mutation elsewhere in the application, while the first window is still in flight. The
        // rows already on their way describe the table as it was.
        source.invalidate();
        generation = 2;
        await stale;

        const fresh = await source.fetch(request(query(0, 100), new AbortController().signal));
        expect(fresh.rows[0]!.name).toBe('v2 0');
    });

    it('drops every block when the sort changes', async () => {
        const offsets: number[] = [];
        const { source } = makeSource({ onRange: (offset) => offsets.push(offset) });
        const signal = new AbortController().signal;

        await source.fetch(request(query(0, 100), signal));
        expect(source.cachedBlockCount).toBe(1);

        await source.fetch(request(query(0, 100), signal, { sort: [{ columnId: 'name', direction: 'asc' }] }));

        // The blocks described positions in a result set that no longer exists.
        expect(offsets).toEqual([0, 0]);
        expect(source.cachedBlockCount).toBe(1);
    });

    it('keeps memory a function of the cache rather than of the table', async () => {
        const { source } = makeSource();
        const signal = new AbortController().signal;

        for (let page = 0; page < 40; page += 1) {
            await source.fetch(request(query(page, 100), signal));
        }

        expect(source.cachedBlockCount).toBeLessThanOrEqual(4);
    });
});

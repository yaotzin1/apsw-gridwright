import type { GridState } from '../../core/types';
import type { AnnouncementContributor, AnnouncementLabels } from '../behaviour/announcement';
import { announcementFor } from '../behaviour/announcement';
import { pageRangeOf } from '../behaviour/pagination';

/**
 * What the grid's one live region says, and when it says something new, with no renderer.
 *
 * Working out *what* changed means comparing the state against the last settled one, so the tracker
 * is stateful and is driven from an effect (React) or a subscription (anything else), never from a
 * render, where a double invocation would consume the change on the discarded pass.
 */

const SEPARATOR = '␞';

/** An add-on's announcement contributor with the add-on's own strings already resolved. */
export interface LiveRegionContributor<TRow, TGrid = unknown> {
    readonly contributor: AnnouncementContributor<TRow, TGrid>;
    /** The contributing add-on's strings, resolved exactly as the adapter resolves them. */
    readonly t: (key: string, values?: Readonly<Record<string, string | number>>) => string;
}

export interface LiveRegionInput<TRow, TGrid = unknown> {
    readonly state: GridState<TRow>;
    readonly grid: TGrid;
    readonly labels: AnnouncementLabels;
    /** False for a windowed grid, where a from-to range describes the scroll position. */
    readonly paginated: boolean;
    /** Header text by column id, so a change can be named by the header the reader sees. */
    readonly headers: ReadonlyMap<string, string>;
    readonly contributors: readonly LiveRegionContributor<TRow, TGrid>[];
}

/** An add-on that throws loses its own sentence and nothing else. */
function safely<T>(run: () => T, fallback: T): T {
    try {
        return run();
    } catch (error) {
        console.error(error);
        return fallback;
    }
}

/**
 * What the sentence depends on, as one string: the live region is re-evaluated when this changes and
 * not otherwise. A state publish that moves none of it, selecting a row for instance, has told the
 * reader nothing new, and a region that repeats itself on every selection is a region people switch off.
 */
export function liveRegionKey<TRow, TGrid>(
    state: GridState<TRow>,
    navigation: 'pages' | 'window',
    contributors: readonly LiveRegionContributor<TRow, TGrid>[],
): string {
    return [
        state.status,
        state.error?.message ?? '',
        state.rows.length,
        state.totalRows,
        state.isTotalExact,
        // A group opening changes the records on the page while the row count may not move.
        JSON.stringify(pageRangeOf(state)),
        state.query.pagination.pageIndex,
        state.query.pagination.pageSize,
        navigation,
        ...contributors.map(({ contributor }) => safely(() => contributor.key?.(state) ?? '', '')),
    ].join(SEPARATOR);
}

function bestSentence<TRow, TGrid>(
    input: LiveRegionInput<TRow, TGrid>,
    previous: GridState<TRow>,
    next: GridState<TRow>,
): string | null {
    let best: { priority: number; sentence: string } | null = null;
    for (const { contributor, t } of input.contributors) {
        const sentence = safely(() => contributor.describe({ previous, next, headers: input.headers, grid: input.grid, t }), null);
        // Strictly greater, so a tie goes to the earlier add-on.
        if (sentence && (best === null || contributor.priority > best.priority)) {
            best = { priority: contributor.priority, sentence };
        }
    }
    return best?.sentence ?? null;
}

export interface LiveRegion {
    /**
     * The sentence for this state, or `undefined` when the region should keep what it last said
     * because the query changed and its rows have not arrived yet (a debounce is being waited out).
     *
     * After `undefined`, ask again at the next state even if `liveRegionKey` has not changed: the
     * state that carries the rows often has the same key as the one that announced the query. An
     * adapter that batches publishes (React) never sees the first; one that is told of each must retry.
     */
    sentence<TRow, TGrid>(input: LiveRegionInput<TRow, TGrid>): string | undefined;
}

export function createLiveRegion(): LiveRegion {
    // The last state the sentence was worked out for while settled. A sort against a remote source
    // goes loading, then ready; comparing ready with loading would find nothing changed.
    let settled: GridState<never> | null = null;

    return {
        sentence<TRow, TGrid>(input: LiveRegionInput<TRow, TGrid>): string | undefined {
            const next = input.state;
            const settledNow = next.status !== 'loading' && next.status !== 'refreshing' && next.status !== 'error';

            let contributed: string | null = null;
            if (settledNow) {
                // The baseline moves only when a fetch finishes, which `version` counts. A debounced query
                // is published with the status still `ready` and the old rows on screen; moving the
                // baseline there spent the sort's sentence on rows that had not changed, and the real
                // result then had nothing left to say. Contributors are still asked on every settled
                // change, so an add-on's sentence about its own state is not held back by the engine.
                const previous = settled as GridState<TRow> | null;
                const fetched = previous === null || next.version !== previous.version;
                if (fetched) settled = next as unknown as GridState<never>;
                // A query that changed without a fetch finishing is waiting out a debounce: its rows are
                // not on screen yet, so the region keeps what it last said until they are.
                const pending = !fetched && next.query !== previous!.query;
                if (pending) return undefined;
                // Nothing is said about the first settled state: announcing the initial sort of a grid
                // nobody has touched yet is noise.
                if (previous !== null) contributed = bestSentence(input, previous, next);
            }

            // The range the page footer shows, so the sentence and the footer cannot disagree: under
            // grouping both count records rather than rows that include the group headers.
            const range = pageRangeOf(next);
            return announcementFor({
                status: next.status,
                error: next.error,
                rowCount: next.rows.length === 0 ? 0 : range.to - range.from + 1,
                totalRows: range.total ?? next.totalRows,
                isTotalExact: next.isTotalExact,
                firstRowIndex: range.from - 1,
                paginated: input.paginated,
                contributed,
                labels: input.labels,
            });
        },
    };
}

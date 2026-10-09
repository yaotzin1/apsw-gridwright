import { useEffect, useRef, useState } from 'react';
import type { GridState } from '../../core/types';
import { addonMessages } from '../addons/context';
import type { AnnouncementContributor } from '../addons/types';
import type { GridwrightContextValue } from '../context';
import { pageRangeOf } from '../core-addons/pagination-logic';
import { announcementFor } from './announcement';
import { announcerOf } from './announcer';

const SEPARATOR = '␞';

/**
 * Holds the sentence the live region carries.
 *
 * It is state rather than a value derived during render because working out *what* changed means
 * comparing this state against the last settled one, and a render-phase comparison against a ref
 * gives the wrong answer under Strict Mode, which renders twice and would consume the change on the
 * discarded pass.
 *
 * The sentence is re-evaluated when the shell's inputs or an add-on contributor's `key` change, and
 * not otherwise. A state publish that moves none of them, selecting a row for instance, has told the
 * reader nothing new, and a region that repeats itself on every selection is a region people switch off.
 */
export function useGridAnnouncement<TRow>(grid: GridwrightContextValue<TRow>): string {
    const [message, setMessage] = useState('');
    // The last state the sentence was worked out for while settled. A sort against a remote source
    // goes loading, then ready; comparing ready with loading would find nothing changed.
    const settled = useRef<GridState<TRow> | null>(null);

    const { state, contributions } = grid;
    const contributors = contributions.active.flatMap(({ contribution }) => contribution.announce ?? []);

    const inputKey = [
        state.status,
        state.error?.message ?? '',
        state.rows.length,
        state.totalRows,
        state.isTotalExact,
        // A group opening changes the records on the page while the row count may not move.
        JSON.stringify(pageRangeOf(state)),
        state.query.pagination.pageIndex,
        state.query.pagination.pageSize,
        contributions.navigation,
        ...contributors.map((contributor) => safely(() => contributor.key?.(state) ?? '', '')),
    ].join(SEPARATOR);

    const latest = useRef(grid);
    latest.current = grid;

    useEffect(() => {
        const current = latest.current;
        const next = current.state;
        const settledNow = next.status !== 'loading' && next.status !== 'refreshing' && next.status !== 'error';

        let contributed: string | null = null;
        if (settledNow) {
            // The baseline moves only when a fetch finishes, which `version` counts. A debounced query
            // is published with the status still `ready` and the old rows on screen; moving the
            // baseline there spent the sort's sentence on rows that had not changed, and the real
            // result then had nothing left to say. Contributors are still asked on every settled
            // change, so an add-on's sentence about its own state is not held back by the engine.
            const previous = settled.current;
            const fetched = previous === null || next.version !== previous.version;
            if (fetched) settled.current = next;
            // A query that changed without a fetch finishing is waiting out a debounce: its rows are
            // not on screen yet, so the region keeps what it last said until they are.
            const pending = !fetched && next.query !== previous!.query;
            if (pending) return;
            // Nothing is said about the first settled state: announcing the initial sort of a grid
            // nobody has touched yet is noise.
            if (previous !== null) contributed = bestSentence(current, previous, next);
        }

        // The range the page footer shows, so the sentence and the footer cannot disagree: under
        // grouping both count records rather than rows that include the group headers.
        const range = pageRangeOf(next);
        setMessage(
            announcementFor({
                status: next.status,
                error: next.error,
                rowCount: next.rows.length === 0 ? 0 : range.to - range.from + 1,
                totalRows: range.total ?? next.totalRows,
                isTotalExact: next.isTotalExact,
                firstRowIndex: range.from - 1,
                paginated: current.contributions.navigation === 'pages',
                contributed,
                labels: current.labels,
            }),
        );
        // The translator and the labels too: switching the language changes no state, and the region
        // would otherwise go on speaking the old one until the rows next changed.
    }, [inputKey, grid.translator, grid.labels]);

    // Sentences that are not grid state, such as an export finishing.
    const announcer = announcerOf(grid.announce);
    useEffect(() => announcer?.subscribe(setMessage), [announcer]);

    return message;
}

function bestSentence<TRow>(
    grid: GridwrightContextValue<TRow>,
    previous: GridState<TRow>,
    next: GridState<TRow>,
): string | null {
    const headers = new Map(grid.columns.map((column) => [column.id, column.header]));
    let best: { priority: number; sentence: string } | null = null;

    for (const { name, contribution } of grid.contributions.active) {
        const t = addonMessages(grid.translator, grid.contributions as never, name);
        for (const contributor of (contribution.announce ?? []) as readonly AnnouncementContributor<TRow>[]) {
            const sentence = safely(() => contributor.describe({ previous, next, headers, grid, t }), null);
            // Strictly greater, so a tie goes to the earlier add-on.
            if (sentence && (best === null || contributor.priority > best.priority)) {
                best = { priority: contributor.priority, sentence };
            }
        }
    }
    return best?.sentence ?? null;
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

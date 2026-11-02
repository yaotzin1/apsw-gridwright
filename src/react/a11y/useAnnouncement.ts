import { useEffect, useRef, useState } from 'react';
import { createLiveRegion, liveRegionKey } from '../../view/model/live-region';
import type { LiveRegionContributor } from '../../view/model/live-region';
import { addonMessages } from '../addons/context';
import type { AnnouncementContributor } from '../addons/types';
import type { GridwrightContextValue } from '../context';
import { announcerOf } from './announcer';

function contributorsOf<TRow>(current: GridwrightContextValue<TRow>): LiveRegionContributor<TRow, GridwrightContextValue<TRow>>[] {
    return current.contributions.active.flatMap(({ name, contribution }) => {
        const t = addonMessages(current.translator, current.contributions as never, name);
        return ((contribution.announce ?? []) as readonly AnnouncementContributor<TRow>[]).map((contributor) => ({
            contributor: contributor as LiveRegionContributor<TRow, GridwrightContextValue<TRow>>['contributor'],
            t,
        }));
    });
}

/**
 * Holds the sentence the live region carries.
 *
 * It is state rather than a value derived during render because working out *what* changed means
 * comparing this state against the last settled one, and a render-phase comparison against a ref
 * gives the wrong answer under Strict Mode, which renders twice and would consume the change on the
 * discarded pass. The comparison itself, and when a new sentence is due, are the view layer's
 * (`createLiveRegion`), shared with every adapter; this binds them to React.
 */
export function useGridAnnouncement<TRow>(grid: GridwrightContextValue<TRow>): string {
    const [message, setMessage] = useState('');
    const region = useRef(createLiveRegion());

    const { state, contributions } = grid;
    const inputKey = liveRegionKey(state, contributions.navigation, contributorsOf(grid));

    const latest = useRef(grid);
    latest.current = grid;

    useEffect(() => {
        const current = latest.current;
        const sentence = region.current.sentence({
            state: current.state,
            grid: current,
            labels: current.labels,
            paginated: current.contributions.navigation === 'pages',
            headers: new Map(current.columns.map((column) => [column.id, column.header])),
            contributors: contributorsOf(current),
        });
        if (sentence !== undefined) setMessage(sentence);
        // The translator and the labels too: switching the language changes no state, and the region
        // would otherwise go on speaking the old one until the rows next changed.
    }, [inputKey, grid.translator, grid.labels]);

    // Sentences that are not grid state, such as an export finishing.
    const announcer = announcerOf(grid.announce);
    useEffect(() => announcer?.subscribe(setMessage), [announcer]);

    return message;
}

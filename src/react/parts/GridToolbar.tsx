import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { classes, useGridwrightContext } from '../context';

export interface GridToolbarProps {
    readonly searchable?: boolean;
    readonly children?: ReactNode;
}

/**
 * Search box, selection count, and a slot for whatever else the page needs.
 *
 * The input is uncontrolled with respect to the engine on purpose: it keeps its own text so
 * typing never waits for a round trip, and a debounced grid stays responsive between keystrokes.
 * It resyncs only when the query changes from somewhere else, such as a cleared filter.
 */
export function GridToolbar({ searchable = true, children }: GridToolbarProps) {
    const { api, state, classNames, labels } = useGridwrightContext();
    const [term, setTerm] = useState(state.query.search);

    useEffect(() => {
        setTerm((current) => (current === state.query.search ? current : state.query.search));
    }, [state.query.search]);

    const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setTerm(event.target.value);
        api.setSearch(event.target.value);
    };

    return (
        <div className={classes('gw-toolbar', classNames.toolbar)}>
            {searchable && (
                <input
                    type="search"
                    className={classes('gw-search', classNames.search)}
                    value={term}
                    onChange={onChange}
                    placeholder={labels.searchPlaceholder}
                    aria-label={labels.searchAriaLabel}
                />
            )}

            {state.selectedIds.length > 0 && (
                <span className="gw-selected-count">{labels.selectedCount(state.selectedIds.length)}</span>
            )}

            {children}
        </div>
    );
}

import type { Unsubscribe } from '../core/types';
import type { GroupId } from './types';

export interface GroupingControllerOptions {
    /** Whether a group starts expanded when nothing has toggled it yet. Default true. */
    readonly defaultExpanded?: boolean;
}

/**
 * Owns which groups are expanded.
 *
 * Expansion changes what is visible, not what was fetched, so it lives outside React state and the
 * grid recomputes its pipeline rather than asking the source again — the same reason a tree keeps
 * its own controller.
 */
export interface GroupingController {
    isExpanded(groupId: GroupId): boolean;
    toggle(groupId: GroupId): void;
    /**
     * Notifies subscribers with no change to expansion.
     *
     * `groupingPlugin` reads `groupBy`, `aggregates`, `summary` and `serverGrouped` fresh on every
     * pipeline pass rather than once at plugin creation (a plugin is reconciled by name, so a new
     * plugin object for a name already installed is ignored — recreating it would not reach a live
     * grid). Mutating those values in place, the way `grouping()` does when one of its own options
     * changes, needs this to make the next pipeline pass actually happen.
     */
    refresh(): void;
    subscribe(listener: () => void): Unsubscribe;
}

export function createGroupingController(options: GroupingControllerOptions = {}): GroupingController {
    const expandedDefault = options.defaultExpanded ?? true;
    const overrides = new Map<GroupId, boolean>();
    const listeners = new Set<() => void>();

    const notify = (): void => {
        for (const listener of listeners) listener();
    };

    return {
        isExpanded(groupId) {
            return overrides.get(groupId) ?? expandedDefault;
        },
        toggle(groupId) {
            overrides.set(groupId, !(overrides.get(groupId) ?? expandedDefault));
            notify();
        },
        refresh() {
            notify();
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

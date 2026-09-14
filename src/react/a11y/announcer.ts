/**
 * The channel `instance.announce` speaks through.
 *
 * A tiny store rather than React state in the hook, so saying a sentence re-renders the live region
 * alone instead of the whole grid, and so the function handed to add-ons has one identity for the
 * life of the grid.
 */
export interface Announcer {
    readonly say: (message: string) => void;
    readonly subscribe: (listener: (message: string) => void) => () => void;
}

const announcers = new WeakMap<(message: string) => void, Announcer>();

export function createAnnouncer(): Announcer {
    const listeners = new Set<(message: string) => void>();
    const announcer: Announcer = {
        say: (message) => {
            for (const listener of listeners) listener(message);
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
    announcers.set(announcer.say, announcer);
    return announcer;
}

/**
 * The announcer behind an instance's `announce`, for the live region to listen to. Null for an
 * `announce` that did not come from `useGridwright`, which then has nothing to listen to.
 */
export const announcerOf = (announce: (message: string) => void): Announcer | null => announcers.get(announce) ?? null;

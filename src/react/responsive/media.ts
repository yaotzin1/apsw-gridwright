import { useSyncExternalStore } from 'react';

const never = (): (() => void) => () => undefined;

const supported = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/**
 * Whether a media query matches, kept current. `false` on the server and wherever `matchMedia` does
 * not exist, so the first client render agrees with the server's markup and a test environment
 * without layout renders the desktop form.
 */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (notify) => {
            if (!supported()) return never();
            const list = window.matchMedia(query);
            list.addEventListener('change', notify);
            return () => list.removeEventListener('change', notify);
        },
        () => (supported() ? window.matchMedia(query).matches : false),
        () => false,
    );
}

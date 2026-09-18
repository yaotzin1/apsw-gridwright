import { formatSearchParams } from './codec';
import type { UrlSyncAdapter } from './types';

const inBrowser = (): boolean => typeof window !== 'undefined' && typeof window.history !== 'undefined';

/**
 * The browser's own URL: `location.search`, `history`, and `popstate` for Back and Forward.
 *
 * The URL is rebuilt from `location.href` with only its query replaced, so the path and the hash
 * stay exactly as they were, and `history.state` is handed back unchanged, because a router that
 * keeps its own state there must find it again. On the server it reads no parameters and writes
 * nothing.
 */
export const browserUrlAdapter: UrlSyncAdapter = {
    getParams: () => new URLSearchParams(inBrowser() ? window.location.search : ''),
    setParams(params, mode) {
        if (!inBrowser()) return;
        const url = new URL(window.location.href);
        const search = formatSearchParams(params);
        url.search = search === '' ? '' : `?${search}`;
        if (mode === 'push') window.history.pushState(window.history.state, '', url.href);
        else window.history.replaceState(window.history.state, '', url.href);
    },
    subscribe(onChange) {
        if (!inBrowser()) return () => undefined;
        window.addEventListener('popstate', onChange);
        return () => window.removeEventListener('popstate', onChange);
    },
};

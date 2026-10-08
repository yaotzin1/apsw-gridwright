/**
 * The mock API, answering `fetch` in the browser.
 *
 * `npm run example` serves `/api/*` from a Node server. The hosted demo on GitHub Pages has no
 * server, so `scripts/build-demo.mjs` loads this module ahead of the playground's own scripts. It
 * replaces `fetch` for same-origin `/api/` calls only and hands them to the same `mock-api.js` the
 * server runs, so the hosted playground still negotiates capabilities honestly: a source that
 * declares only `paginate` gets one unsorted page, and the pipeline does the rest.
 *
 * State lives in this tab: an edit survives a page change inside it and is gone on reload, which is
 * what a demo that must not write to anyone's data should do.
 */
import { mockApi } from './mock-api.js';

const realFetch = window.fetch.bind(window);

/** Rejects when the request is aborted, so a superseded request behaves as it does over a network. */
function untilAborted(signal) {
    return new Promise((_, reject) => {
        const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
    });
}

window.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);

    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
        return realFetch(input, init);
    }

    const hasBody = request.method === 'POST' || request.method === 'PUT';
    const needsFormatter = url.pathname === '/api/reports';

    const answer = (async () => {
        const result = await mockApi.handle({
            method: request.method,
            pathname: url.pathname,
            searchParams: url.searchParams,
            text: hasBody ? await request.text() : '',
            formatMarkdownDocument: needsFormatter ? (await import('../../dist/index.js')).formatMarkdownDocument : undefined,
        });
        if (result === null) return new Response('Not found', { status: 404 });
        return new Response(result.body, { status: result.status, headers: { 'Content-Type': result.contentType } });
    })();

    return Promise.race([answer, untilAborted(request.signal)]);
};

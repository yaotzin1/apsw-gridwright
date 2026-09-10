import { isAbortError, isRetryableStatus, toGridError } from '../core/errors';
import type {
    DataSource,
    DataSourceCapabilities,
    DataSourceRequest,
    DataSourceResult,
    Unsubscribe,
} from '../core/types';

export type RemoteFetcher<TRow> = (
    request: DataSourceRequest<TRow>,
) => DataSourceResult<TRow> | Promise<DataSourceResult<TRow>>;

export interface RetryPolicy {
    /** Extra attempts after the first. Default 2. Set 0 to disable retrying entirely. */
    readonly attempts?: number;
    /** Base delay, doubled per attempt. Default 250ms. */
    readonly delayMs?: number;
}

export interface RemoteDataSourceOptions<TRow> {
    readonly fetcher: RemoteFetcher<TRow>;
    /**
     * What the server does for itself. Defaults to all four, because a remote endpoint that
     * returns one page at a time is the reason to be remote at all. Set a facet to false and the
     * pipeline picks it up, which is how a partially capable endpoint is described honestly.
     */
    readonly capabilities?: Partial<DataSourceCapabilities>;
    readonly kind?: string;
    readonly retry?: RetryPolicy;
}

export interface RemoteDataSource<TRow> extends DataSource<TRow> {
    /** Tells any attached grid to refetch, for example after a mutation elsewhere in the app. */
    invalidate(): void;
}

const ALL_RESOLVED: DataSourceCapabilities = {
    sort: true,
    filter: true,
    search: true,
    paginate: true,
};

/**
 * Wraps any async function into a data source.
 *
 * The fetcher receives the whole query plus the abort signal and returns rows with a total. What
 * this adds is the part every project rewrites by hand: capability declaration, backoff on
 * retryable failures only, and an abort that stops the retry loop rather than restarting it.
 */
export function createRemoteDataSource<TRow>(
    options: RemoteDataSourceOptions<TRow>,
): RemoteDataSource<TRow> {
    const capabilities = { ...ALL_RESOLVED, ...options.capabilities };
    const attempts = Math.max(0, options.retry?.attempts ?? 2);
    const baseDelay = Math.max(0, options.retry?.delayMs ?? 250);
    const listeners = new Set<() => void>();

    return {
        kind: options.kind ?? 'remote',
        capabilities,

        async fetch(request) {
            let lastError: unknown;

            for (let attempt = 0; attempt <= attempts; attempt += 1) {
                if (request.signal.aborted) throw abortError();

                try {
                    return await options.fetcher(request);
                } catch (error) {
                    // An abort is the engine superseding this request, not a failure to retry.
                    if (isAbortError(error) || request.signal.aborted) throw error;

                    lastError = error;
                    const normalized = toGridError(error);
                    const worthRetrying =
                        normalized.retryable && isRetryableStatus(normalized.status) && attempt < attempts;
                    if (!worthRetrying) throw error;

                    await delay(baseDelay * 2 ** attempt, request.signal);
                }
            }

            throw lastError;
        },

        subscribe(onInvalidate: () => void): Unsubscribe {
            listeners.add(onInvalidate);
            return () => {
                listeners.delete(onInvalidate);
            };
        },

        invalidate() {
            for (const listener of [...listeners]) listener();
        },

        dispose() {
            listeners.clear();
        },
    };
}

function abortError(): Error {
    const error = new Error('The grid request was aborted.');
    error.name = 'AbortError';
    return error;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
    if (ms <= 0) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);

        function onAbort(): void {
            clearTimeout(timer);
            reject(abortError());
        }

        signal.addEventListener('abort', onAbort, { once: true });
    });
}

import type { GridError } from './types';

/** Raised by a data source that wants to control the message and the retry advice the grid shows. */
export class GridwrightError extends Error {
    readonly retryable: boolean;

    readonly status: number | undefined;

    constructor(message: string, options?: { retryable?: boolean; status?: number; cause?: unknown }) {
        super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
        this.name = 'GridwrightError';
        this.status = options?.status;
        this.retryable = options?.retryable ?? isRetryableStatus(options?.status);
    }
}

/** 408, 429 and 5xx are worth another attempt. A 404 or a 422 will answer the same way forever. */
export function isRetryableStatus(status: number | undefined): boolean {
    if (status === undefined) return true;
    if (status === 408 || status === 429) return true;
    return status >= 500;
}

/**
 * Normalises anything a data source can throw into the one shape the UI renders.
 *
 * A grid that shows `[object Object]` when the network fails is a grid nobody trusts, so this
 * accepts strings, Errors, DOMExceptions and stray objects alike and always produces a sentence.
 */
export function toGridError(cause: unknown): GridError {
    if (cause instanceof GridwrightError) {
        return {
            message: cause.message,
            retryable: cause.retryable,
            ...(cause.status !== undefined ? { status: cause.status } : {}),
            cause,
        };
    }

    if (cause instanceof Error) {
        const status = readStatus(cause);
        return {
            message: cause.message || cause.name || 'Request failed.',
            retryable: isRetryableStatus(status),
            ...(status !== undefined ? { status } : {}),
            cause,
        };
    }

    if (typeof cause === 'string' && cause.trim() !== '') {
        return { message: cause, retryable: true, cause };
    }

    return { message: 'The grid could not load its data.', retryable: true, cause };
}

function readStatus(error: Error): number | undefined {
    const candidate = (error as unknown as { status?: unknown; statusCode?: unknown }).status
        ?? (error as unknown as { statusCode?: unknown }).statusCode;
    return typeof candidate === 'number' ? candidate : undefined;
}

/** True for the abort the engine itself issues when a newer query supersedes an in-flight one. */
export function isAbortError(cause: unknown): boolean {
    if (cause instanceof Error) {
        return cause.name === 'AbortError' || cause.name === 'TimeoutError';
    }
    return false;
}

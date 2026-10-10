import type { GridEventMap, Unsubscribe } from './types';

/**
 * A typed event bus with one deliberate property: a throwing listener never takes down the
 * emit that reached it.
 *
 * Plugins subscribe here, and a plugin is third-party code by design. If one of them throws while
 * handling `fetch:success`, the remaining listeners still run and the grid still renders its rows.
 * The failure surfaces on the `plugin:error` channel instead of vanishing.
 */
export class GridEmitter<TRow> {
    private readonly listeners = new Map<string, Set<(payload: never) => void>>();

    private onListenerError: ((event: string, error: unknown) => void) | null = null;

    setErrorHandler(handler: (event: string, error: unknown) => void): void {
        this.onListenerError = handler;
    }

    on<K extends keyof GridEventMap<TRow>>(
        event: K,
        listener: (payload: GridEventMap<TRow>[K]) => void,
    ): Unsubscribe {
        const key = event as string;
        let bucket = this.listeners.get(key);
        if (!bucket) {
            bucket = new Set();
            this.listeners.set(key, bucket);
        }
        const entry = listener as (payload: never) => void;
        bucket.add(entry);

        return () => {
            const current = this.listeners.get(key);
            if (!current) return;
            current.delete(entry);
            if (current.size === 0) this.listeners.delete(key);
        };
    }

    emit<K extends keyof GridEventMap<TRow>>(event: K, payload: GridEventMap<TRow>[K]): void {
        const key = event as string;
        const bucket = this.listeners.get(key);
        if (!bucket || bucket.size === 0) return;

        // Copied before iteration: a listener is allowed to unsubscribe itself while it runs.
        for (const listener of [...bucket]) {
            try {
                (listener as (value: GridEventMap<TRow>[K]) => void)(payload);
            } catch (error) {
                // Re-entering emit for a failing `plugin:error` listener would recurse forever.
                if (key !== 'plugin:error' && this.onListenerError) {
                    try {
                        this.onListenerError(key, error);
                    } catch (handlerError) {
                        // A handler that throws must not stop the listeners after this one, which is the
                        // guarantee the class makes. Both failures are reported, so neither is lost.
                        console.error(`[gridwright] listener for "${key}" threw`, error);
                        console.error('[gridwright] the listener error handler threw', handlerError);
                    }
                } else {
                    console.error(`[gridwright] listener for "${key}" threw`, error);
                }
            }
        }
    }

    listenerCount(event: keyof GridEventMap<TRow>): number {
        return this.listeners.get(event as string)?.size ?? 0;
    }

    clear(): void {
        this.listeners.clear();
    }
}

/**
 * A value that can be read, replaced and watched: the one shape of state an add-on shares with a
 * renderer, so a feature's state belongs to the feature and not to a framework's hooks.
 *
 * Each adapter binds a store to its own reactivity in one function (`useSyncExternalStore`, a
 * signal, a ref, a rune). The contract it relies on:
 *
 * - `get` returns the current value, and the same value until `set` or `update` changes it.
 * - `set` with a value that `Object.is` the current one does nothing, so a binding never re-renders
 *   for a write that changed nothing.
 * - Listeners run synchronously, in subscription order, after the value has changed.
 * - A listener that unsubscribes during a notification is not called after it has; one added during a
 *   notification is first called for the next change.
 * - A listener that throws does not stop the others: every listener is called, then the first error is
 *   rethrown to the writer. The value is already changed.
 * - A listener that writes to the store starts a nested notification with the newest value, and the
 *   outer one carries on with the listeners it had when it began.
 */
export interface Store<T> {
    get(): T;
    set(next: T): void;
    update(change: (previous: T) => T): void;
    /** Returns the function that stops listening. Calling it twice is harmless. */
    subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
    let value = initial;
    let listeners: readonly (() => void)[] = [];

    const set = (next: T): void => {
        if (Object.is(next, value)) return;
        value = next;
        // The list is replaced, never mutated, so this snapshot is stable however the listeners
        // subscribe or unsubscribe while it is walked.
        const snapshot = listeners;
        let failure: { readonly error: unknown } | null = null;
        for (const listener of snapshot) {
            if (!listeners.includes(listener)) continue;
            try {
                listener();
            } catch (error) {
                // The change is committed, so every other listener must still hear of it.
                failure ??= { error };
            }
        }
        if (failure) throw failure.error;
    };

    return {
        get: () => value,
        set,
        update: (change) => set(change(value)),
        subscribe: (listener) => {
            // The same function subscribed twice is two subscriptions, as an event target would have it.
            const entry = (): void => listener();
            listeners = [...listeners, entry];
            return () => {
                listeners = listeners.filter((candidate) => candidate !== entry);
            };
        },
    };
}

/**
 * The keyed stores of one add-on in one grid: the same key gives the same store, and `initial` is read
 * only the first time. `onChange` hears of a change in any of them, which is how an adapter knows to
 * draw again. A key such as `constructor` is an ordinary key.
 */
export function createStateScope(onChange: () => void = () => undefined): <T>(key: string, initial: T) => Store<T> {
    const stores = new Map<string, Store<unknown>>();
    return <T,>(key: string, initial: T): Store<T> => {
        let store = stores.get(key);
        if (!store) {
            store = createStore<unknown>(initial);
            store.subscribe(onChange);
            stores.set(key, store);
        }
        return store as Store<T>;
    };
}

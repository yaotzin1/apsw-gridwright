// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../../src/view/store';

describe('createStore', () => {
    it('reads the initial value and the latest one', () => {
        const store = createStore(1);
        expect(store.get()).toBe(1);
        store.set(2);
        expect(store.get()).toBe(2);
    });

    it('updates from the previous value', () => {
        const store = createStore({ open: false });
        store.update((previous) => ({ ...previous, open: true }));
        expect(store.get()).toEqual({ open: true });
    });

    it('notifies after the value has changed, in subscription order', () => {
        const store = createStore(0);
        const seen: string[] = [];
        store.subscribe(() => seen.push(`a${store.get()}`));
        store.subscribe(() => seen.push(`b${store.get()}`));
        store.set(1);
        expect(seen).toEqual(['a1', 'b1']);
    });

    it('does not notify for a write that changed nothing', () => {
        const store = createStore('x');
        const listener = vi.fn();
        store.subscribe(listener);
        store.set('x');
        store.update((previous) => previous);
        expect(listener).not.toHaveBeenCalled();
    });

    it('treats a new object with equal contents as a change, and NaN as no change', () => {
        const objects = createStore({ a: 1 });
        const numbers = createStore(Number.NaN);
        const onObject = vi.fn();
        const onNumber = vi.fn();
        objects.subscribe(onObject);
        numbers.subscribe(onNumber);
        objects.set({ a: 1 });
        numbers.set(Number.NaN);
        expect(onObject).toHaveBeenCalledTimes(1);
        expect(onNumber).not.toHaveBeenCalled();
    });

    it('stops notifying after unsubscribe, and unsubscribing twice is harmless', () => {
        const store = createStore(0);
        const listener = vi.fn();
        const stop = store.subscribe(listener);
        store.set(1);
        stop();
        stop();
        store.set(2);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('keeps the same function subscribed twice as two subscriptions', () => {
        const store = createStore(0);
        const listener = vi.fn();
        const stopFirst = store.subscribe(listener);
        store.subscribe(listener);
        store.set(1);
        expect(listener).toHaveBeenCalledTimes(2);
        stopFirst();
        store.set(2);
        expect(listener).toHaveBeenCalledTimes(3);
    });

    describe('reentrancy', () => {
        it('does not call a listener that an earlier listener unsubscribed in the same notification', () => {
            const store = createStore(0);
            const later = vi.fn();
            let stopLater = (): void => undefined;
            store.subscribe(() => stopLater());
            stopLater = store.subscribe(later);
            store.set(1);
            expect(later).not.toHaveBeenCalled();
        });

        it('first calls a listener added during a notification for the next change', () => {
            const store = createStore(0);
            const added = vi.fn();
            let once = true;
            store.subscribe(() => {
                if (once) {
                    once = false;
                    store.subscribe(added);
                }
            });
            store.set(1);
            expect(added).not.toHaveBeenCalled();
            store.set(2);
            expect(added).toHaveBeenCalledTimes(1);
        });

        it('lets a listener write, notifying with the newest value, and the outer pass finish', () => {
            const store = createStore(0);
            const seen: number[] = [];
            store.subscribe(() => {
                if (store.get() === 1) store.set(2);
            });
            store.subscribe(() => seen.push(store.get()));
            store.set(1);
            // The nested write reaches the second listener first, with 2; the outer pass then reaches
            // it with the value as it stands now, which is also 2. It never sees a stale 1.
            expect(seen).toEqual([2, 2]);
            expect(store.get()).toBe(2);
        });

        it('survives a listener that throws only by the caller catching it, and the value is kept', () => {
            const store = createStore(0);
            store.subscribe(() => {
                throw new Error('boom');
            });
            expect(() => store.set(1)).toThrow('boom');
            expect(store.get()).toBe(1);
        });
    });
});

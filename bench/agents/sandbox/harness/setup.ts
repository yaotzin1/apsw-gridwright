import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom has no ResizeObserver; virtualizers in both libraries look for one.
class NoopResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}
if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: typeof NoopResizeObserver }).ResizeObserver = NoopResizeObserver;
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

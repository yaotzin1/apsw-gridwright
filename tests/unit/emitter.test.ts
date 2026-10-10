import { describe, expect, it, vi } from 'vitest';
import { GridEmitter } from '../../src/core/emitter';
import { createQuery } from '../../src/core/query';

const payload = { query: createQuery() };

describe('GridEmitter', () => {
    it('keeps running the other listeners when one throws', () => {
        const emitter = new GridEmitter<unknown>();
        const later = vi.fn();
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        emitter.on('fetch:start', () => {
            throw new Error('listener broke');
        });
        emitter.on('fetch:start', later);

        expect(() => emitter.emit('fetch:start', payload)).not.toThrow();

        expect(later).toHaveBeenCalledTimes(1);
        log.mockRestore();
    });

    it('hands a listener error to the handler', () => {
        const emitter = new GridEmitter<unknown>();
        const handler = vi.fn();
        const failure = new Error('listener broke');
        emitter.setErrorHandler(handler);
        emitter.on('fetch:start', () => {
            throw failure;
        });

        emitter.emit('fetch:start', payload);

        expect(handler).toHaveBeenCalledWith('fetch:start', failure);
    });

    it('survives an error handler that throws, and still runs the remaining listeners', () => {
        const emitter = new GridEmitter<unknown>();
        const later = vi.fn();
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        emitter.setErrorHandler(() => {
            throw new Error('handler broke');
        });
        emitter.on('fetch:start', () => {
            throw new Error('listener broke');
        });
        emitter.on('fetch:start', later);

        expect(() => emitter.emit('fetch:start', payload)).not.toThrow();

        expect(later).toHaveBeenCalledTimes(1);
        // Both failures are reported, so neither is lost.
        expect(log).toHaveBeenCalledTimes(2);
        log.mockRestore();
    });
});

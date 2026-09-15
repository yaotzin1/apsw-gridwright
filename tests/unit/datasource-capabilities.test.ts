import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalDataSource } from '../../src/data/local';
import { createRemoteDataSource } from '../../src/data/remote';
import { createRestDataSource } from '../../src/data/rest';
import type { DataSourceCapabilities } from '../../src/core/types';

afterEach(() => {
    vi.restoreAllMocks();
});

// What a JavaScript consumer can write and TypeScript would have refused.
const loose = (value: Record<string, unknown>) => value as unknown as Partial<DataSourceCapabilities>;

describe('declared capabilities', () => {
    it('applies the ones it recognises over the defaults, silently', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const remote = createRemoteDataSource({ fetcher: () => ({ rows: [] }), capabilities: { sort: false } });
        const local = createLocalDataSource([], { capabilities: { paginate: true } });

        expect(remote.capabilities).toEqual({ sort: false, filter: true, search: true, paginate: true });
        expect(local.capabilities).toEqual({ sort: false, filter: false, search: false, paginate: true });
        expect(warn).not.toHaveBeenCalled();
    });

    it('says so when a capability is misspelled, instead of keeping the default without a word', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const source = createRemoteDataSource({
            kind: 'people',
            fetcher: () => ({ rows: [] }),
            capabilities: loose({ pagination: false }),
        });

        // The default stands, because `pagination` is not a facet. What changed is that it is said.
        expect(source.capabilities.paginate).toBe(true);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown capability "pagination"'));
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('"people"'));
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('sort, filter, search, paginate'));
    });

    it('keeps the default for a value that is not a boolean, and says so', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const source = createRestDataSource({ url: '/api/people', capabilities: loose({ sort: 'false' }) });

        expect(source.capabilities.sort).toBe(true);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('capability "sort" as "false"'));
    });
});

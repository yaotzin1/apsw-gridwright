import { describe, expect, it } from 'vitest';
import { allScenarios, conformanceSuite, ConformanceFailure, sortingScenarios } from '../../src/conformance';
import type { ConformanceDriver } from '../../src/conformance';
import { reactDriver } from '../helpers/react-conformance-driver';

/** The React grid, held to the scenarios every adapter must pass. */
conformanceSuite(reactDriver(), { describe, it });

describe('the kit itself', () => {
    it('lists every scenario once, each with a stable id', () => {
        const ids = allScenarios.map((scenario) => scenario.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.every((id) => /^[a-z-]+\/[a-z-]+$/.test(id))).toBe(true);
        expect(sortingScenarios.length).toBeGreaterThan(0);
    });

    it('fails an adapter that does not behave, naming what it expected', async () => {
        // A driver whose grid never sorts: it must not pass the cycle scenario.
        const real = reactDriver();
        const inert: ConformanceDriver = {
            unmount: () => real.unmount(),
            mount: async (options) => {
                const grid = await real.mount(options);
                return { ...grid, click: async () => undefined };
            },
        };
        const cycle = allScenarios.find((scenario) => scenario.id === 'sorting/cycle')!;
        await expect(cycle.run(inert)).rejects.toThrow(ConformanceFailure);
        await expect(cycle.run(inert)).rejects.toThrow(/aria-sort after one activation/);
    });

    it('refuses to skip a scenario that does not exist, or without a reason', () => {
        const never: ConformanceDriver = { mount: () => Promise.reject(new Error('unused')), unmount: () => undefined };
        const runner = { describe: () => undefined, it: () => undefined };
        expect(() => conformanceSuite(never, runner, { skip: { 'nope/nothing': 'because' } })).toThrow(/not a scenario/);
        expect(() => conformanceSuite(never, runner, { skip: { 'sorting/cycle': '' } })).toThrow(/needs a reason/);
    });

    it('names the reason in the test title of a skipped scenario', () => {
        const never: ConformanceDriver = { mount: () => Promise.reject(new Error('unused')), unmount: () => undefined };
        const titles: string[] = [];
        conformanceSuite(never, { describe: (_name, body) => body(), it: (name) => void titles.push(name) }, { skip: { 'sorting/keyboard': 'tab order not wired' } });
        expect(titles.filter((title) => title.includes('skipped: tab order not wired'))).toHaveLength(1);
    });
});

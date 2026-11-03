/**
 * The conformance kit: scenarios any framework adapter runs against its own grid to show it behaves as
 * the React one does (specs/adapter-architecture). Headless like the view layer: it imports no
 * framework and no test library, so the adapter brings its own runner and its own `ConformanceDriver`.
 */
import { ConformanceFailure } from './assert';
import { selectionScenarios } from './scenarios/selection';
import { sortingScenarios } from './scenarios/sorting';
import type { ConformanceOptions, Runner, Scenario } from './types';

export { ConformanceFailure } from './assert';
export { selectionScenarios } from './scenarios/selection';
export { sortingScenarios } from './scenarios/sorting';
export type { ConformanceDriver, ConformanceOptions, DriverElement, DriverGrid, DriverMountOptions, Runner, Scenario } from './types';

/** Every scenario, in the order they are reported. */
export const allScenarios: readonly Scenario[] = [...sortingScenarios, ...selectionScenarios];

/**
 * Registers every scenario with the adapter's test runner.
 *
 *     conformanceSuite(myDriver, { describe, it }, { skip: { 'sorting/multi-sort': 'Shift is not wired yet' } });
 *
 * A skipped scenario must give its reason, so an adapter cannot quietly drop behaviour; the reason
 * is part of the test name.
 */
export function conformanceSuite(driver: Parameters<Scenario['run']>[0], runner: Runner, options: ConformanceOptions = {}): void {
    const skip = options.skip ?? {};
    for (const id of Object.keys(skip)) {
        if (!allScenarios.some((scenario) => scenario.id === id)) {
            throw new ConformanceFailure(`conformance: "${id}" is not a scenario, so it cannot be skipped`);
        }
        if (!skip[id]) throw new ConformanceFailure(`conformance: skipping "${id}" needs a reason`);
    }
    runner.describe('framework adapter conformance', () => {
        for (const scenario of allScenarios) {
            const reason = skip[scenario.id];
            if (reason !== undefined) {
                runner.it(`${scenario.id}: ${scenario.title} (skipped: ${reason})`, async () => undefined);
                continue;
            }
            runner.it(`${scenario.id}: ${scenario.title}`, () => scenario.run(driver));
        }
    });
}

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { conformanceSuite, selectionScenarios } from '../../src/conformance';
import { nodeDriver } from '../helpers/node-conformance-driver';

/**
 * The go/no-go for the whole architecture: a grid with no DOM and no framework, drawn from the table
 * model, held to the scenarios the React grid passes.
 */
describe('the environment really has no DOM', () => {
    it('has neither document nor window', () => {
        expect(typeof document).toBe('undefined');
        expect(typeof window).toBe('undefined');
    });
});

/**
 * Selection is React-only until T-15 step (d): the grid host runs neutral add-ons, and `selection()` is not one
 * yet. Each scenario is skipped by name, with the reason in its title, so the gap is listed rather than hidden.
 */
const NOT_NEUTRAL_YET = 'selection() is not a neutral add-on yet (T-15 step d)';
const skip = Object.fromEntries(selectionScenarios.map((scenario) => [scenario.id, NOT_NEUTRAL_YET]));

conformanceSuite(nodeDriver(), { describe, it }, { skip });

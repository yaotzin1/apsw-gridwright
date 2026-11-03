// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { conformanceSuite } from '../../src/conformance';
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

conformanceSuite(nodeDriver(), { describe, it });

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Gridwright } from '../../src/react/Gridwright';
import { wcag, WCAG_ADDON } from '../../src/react/wcag';
import { density } from '../../src/react/density';
import type { GridAddon } from '../../src/react/addons/types';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

const grid = (addons: readonly GridAddon<Person>[] = [wcag<Person>()]) => (
    <Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" addons={addons} />
);

const root = (): HTMLElement => screen.getByRole('grid').closest('.gw-root') as HTMLElement;

describe('wcag()', () => {
    it('marks the root with the AA level (AC-15)', () => {
        render(grid());

        expect(root()).toHaveAttribute('data-gw-wcag', 'aa');
    });

    it('changes nothing about a grid that does not list it (AC-15)', () => {
        render(grid([]));

        expect(root()).not.toHaveAttribute('data-gw-wcag');
    });

    it('is a named add-on with no UI of its own', () => {
        expect(wcag().name).toBe(WCAG_ADDON);
        render(grid());

        // Nothing added to the toolbar: no density-style control, no extra live region.
        expect(screen.queryByRole('combobox', { name: 'Density' })).toBeNull();
        expect(screen.getAllByRole('status')).toHaveLength(1);
    });

    it('sets no colour itself: the stylesheet decides, so a theme can still win (AC-15)', () => {
        render(grid());

        expect(root().getAttribute('style') ?? '').not.toMatch(/--gw-/);
    });

    it('composes with density(), each keeping its own attribute', () => {
        render(grid([wcag<Person>(), density<Person>({ initial: 'compact' })]));

        expect(root()).toHaveAttribute('data-gw-wcag', 'aa');
        expect(root()).toHaveAttribute('data-gw-density', 'compact');
    });

    it('is listed once: a second copy is refused by name', () => {
        expect(() => render(grid([wcag<Person>(), wcag<Person>()]))).toThrow(/gridwright:wcag/);
    });
});

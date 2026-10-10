import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { afterAll, describe, expect, it } from 'vitest';
import { createRemoteDataSource } from '../../src';
import { pl } from '../../src/locales';
import { Gridwright } from '../../src/react/Gridwright';
import { density } from '../../src/react/density';
import { columnFilters } from '../../src/react/filters';
import { grouping } from '../../src/react/grouping';
import { columnLayout } from '../../src/react/layout';
import { cellNavigation } from '../../src/react/navigation/addon';
import { responsive } from '../../src/react/responsive';
import { treeData } from '../../src/react/tree';
import { virtualRows } from '../../src/react/virtual/addon';
import { wcag } from '../../src/react/wcag';
import type { GridwrightColumn } from '../../src/react/types';
import type { Person } from '../fixtures';
import { people, personColumns } from '../fixtures';

/**
 * Stage 6, task T-02 of specs/wcag-2-2-aa-conformance: axe-core over the states the audit covers.
 *
 * jsdom has no layout, so this pass is structure, names and ARIA only. Contrast, target size and
 * reflow are computed from the tokens (tests/unit/contrast-tokens.test.ts) or measured in a
 * browser; nothing here says anything about them. Rules axe could not decide are printed at the
 * end, so a green run is not read as more than it is.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Rules that need layout or a canvas, which jsdom lacks. Dropped by name rather than left to throw
// or to report "incomplete" noise; each is covered by the token test or the browser pass.
const NEEDS_LAYOUT = ['color-contrast', 'color-contrast-enhanced', 'target-size', 'scrollable-region-focusable'];
const rules = Object.fromEntries(NEEDS_LAYOUT.map((id) => [id, { enabled: false }]));

interface Item {
    id: string;
    name: string;
    owner: string;
    children?: Item[];
}

const files: readonly Item[] = [
    { id: 'docs', name: 'Documents', owner: 'Ada', children: [{ id: 'cv', name: 'CV.pdf', owner: 'Ada' }] },
    { id: 'photos', name: 'Photos', owner: 'Mary', children: [{ id: 'beach', name: 'Beach.jpg', owner: 'Mary' }] },
];

const fileColumns: readonly GridwrightColumn<Item>[] = [
    { id: 'name', header: 'Name' },
    { id: 'owner', header: 'Owner' },
];

const filterable: readonly GridwrightColumn<Person>[] = personColumns.map((column) => ({ ...column, filterable: true }));

const remote = (fail = false) => {
    let calls = 0;
    return createRemoteDataSource<Person>({
        fetcher: async () => {
            calls += 1;
            if (fail && calls > 1) throw new Error('the server said no');
            return { rows: people.slice(0, 3), totalRows: 7 };
        },
        retry: { attempts: 0 },
    });
};

const base = (extra: Partial<Parameters<typeof Gridwright<Person>>[0]> = {}): ReactElement => (
    <Gridwright<Person> columns={personColumns} data={people} pageSize={3} aria-label="People" {...extra} />
);

type User = ReturnType<typeof userEvent.setup>;

interface State {
    readonly name: string;
    readonly ui: () => ReactElement;
    readonly prepare?: (user: User) => Promise<void>;
}

const states: readonly State[] = [
    { name: 'the default grid, first page', ui: () => base() },
    {
        name: 'sorted by one column',
        ui: () => base(),
        prepare: async (user) => {
            await user.click(screen.getByRole('button', { name: 'Salary' }));
        },
    },
    {
        name: 'sorted by two columns',
        ui: () => base(),
        prepare: async (user) => {
            await user.click(screen.getByRole('button', { name: 'Department' }));
            await user.keyboard('{Shift>}');
            await user.click(screen.getByRole('button', { name: 'Salary' }));
            await user.keyboard('{/Shift}');
        },
    },
    { name: 'column filters, dialog closed', ui: () => base({ columns: filterable, addons: [columnFilters<Person>()] }) },
    {
        name: 'a column filter dialog open',
        ui: () => base({ columns: filterable, addons: [columnFilters<Person>()] }),
        prepare: async (user) => {
            await user.click(screen.getByRole('button', { name: /^Filter Salary/ }));
            await screen.findByRole('dialog', { name: 'Filter Salary' });
        },
    },
    {
        name: 'selection on, one row selected',
        ui: () => base({ selectionMode: 'multiple' }),
        prepare: async (user) => {
            await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]!);
        },
    },
    {
        name: 'selection on, header partly selected',
        ui: () => base({ selectionMode: 'multiple' }),
        prepare: async (user) => {
            await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[1]!);
            expect(screen.getByRole('checkbox', { name: 'Select all rows on this page' })).toBePartiallyChecked();
        },
    },
    {
        name: 'cell navigation, cursor in the middle',
        ui: () => base({ addons: [cellNavigation<Person>({ headerRow: true })] }),
        prepare: async (user) => {
            await user.click(screen.getByText('Grace Hopper'));
            await user.keyboard('{ArrowRight}{ArrowDown}');
        },
    },
    {
        name: 'grouping, expanded',
        ui: () => base({ pageSize: 100, addons: [grouping<Person>({ groupBy: ['department'] })] }),
    },
    {
        name: 'grouping, all collapsed',
        ui: () => base({ pageSize: 100, addons: [grouping<Person>({ groupBy: ['department'], defaultExpanded: false })] }),
    },
    {
        name: 'tree data, a node expanded',
        ui: () => (
            <Gridwright<Item>
                columns={fileColumns}
                data={files}
                pageSize={100}
                aria-label="Files"
                addons={[treeData<Item>({ getRowId: (row) => row.id, getChildren: (row) => row.children })]}
            />
        ),
        prepare: async (user) => {
            await user.click(screen.getAllByRole('button', { name: 'Expand' })[0]!);
        },
    },
    { name: 'virtual rows', ui: () => base({ pageSize: 100, addons: [virtualRows<Person>({ rowHeight: 40, height: 400 })] }) },
    { name: 'responsive, stacked below a width', ui: () => base({ addons: [responsive<Person>({ stackBelow: 640 })] }) },
    {
        name: 'the column picker open',
        ui: () => base({ addons: [columnLayout<Person>()] }),
        prepare: async (user) => {
            await user.click(screen.getByRole('button', { name: 'Columns' }));
            await screen.findByRole('menu', { name: 'Columns' });
        },
    },
    {
        name: 'loading',
        ui: () => base({ data: undefined as never, dataSource: createRemoteDataSource<Person>({ fetcher: () => new Promise(() => undefined), retry: { attempts: 0 } }) }),
    },
    {
        name: 'empty',
        ui: () => base({ data: [] }),
    },
    {
        name: 'error',
        ui: () =>
            base({
                data: undefined as never,
                dataSource: createRemoteDataSource<Person>({
                    fetcher: async () => {
                        throw new Error('the reporting service is down');
                    },
                    retry: { attempts: 0 },
                }),
            }),
        prepare: async () => {
            await screen.findByRole('alert');
        },
    },
    {
        name: 'stale rows with the banner',
        ui: () => base({ data: undefined as never, dataSource: remote(true) }),
        prepare: async (user) => {
            await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
            await user.click(screen.getByRole('button', { name: /Salary/ }));
            await screen.findByRole('alert');
        },
    },
    {
        name: 'density, compact',
        ui: () => base({ addons: [density<Person>({ initial: 'compact' })] }),
        prepare: async () => {
            expect(document.querySelector('.gw-root')).toHaveAttribute('data-gw-density', 'compact');
        },
    },
    { name: 'density, comfortable', ui: () => base({ addons: [density<Person>()] }) },
    {
        name: 'density, spacious',
        ui: () => base({ addons: [density<Person>({ initial: 'spacious' })] }),
        prepare: async () => {
            expect(document.querySelector('.gw-root')).toHaveAttribute('data-gw-density', 'spacious');
        },
    },
    {
        name: 'wcag() listed, with selection and filters',
        ui: () => base({ selectionMode: 'multiple', columns: filterable, addons: [wcag<Person>(), columnFilters<Person>()] }),
        prepare: async () => {
            expect(document.querySelector('.gw-root')).toHaveAttribute('data-gw-wcag', 'aa');
        },
    },
    { name: 'Polish locale', ui: () => base({ locale: pl, columns: filterable, addons: [columnFilters<Person>()] }) },
];

// Rules axe left as "incomplete" in at least one state, with the states that left them so.
const undecided = new Map<string, Set<string>>();

const violationReport = (violations: axe.Result[]): string =>
    violations
        .map((violation) => {
            const where = violation.nodes.map((node) => `    ${node.target.join(' ')}\n      ${node.failureSummary?.replace(/\n/g, '\n      ')}`).join('\n');
            return `${violation.id} (${violation.impact}): ${violation.help}\n${where}`;
        })
        .join('\n\n');

describe('axe-core over the states the audit covers (AC-02)', () => {
    it.each(states.map((state) => [state.name, state] as const))('%s has no violations', async (_name, state) => {
        const user = userEvent.setup();
        const { container } = render(state.ui());
        await state.prepare?.(user);
        // A remote state settles on its own; the others are already there.
        if (!state.prepare) await waitFor(() => expect(container.querySelector('table')).not.toBeNull());

        const results = await axe.run(container, { runOnly: { type: 'tag', values: TAGS }, rules, resultTypes: ['violations', 'incomplete'] });

        for (const rule of results.incomplete) {
            const seen = undecided.get(rule.id) ?? new Set<string>();
            seen.add(state.name);
            undecided.set(rule.id, seen);
        }

        expect(violationReport(results.violations)).toBe('');
    });

    it('can fail: an unnamed button and an image without text are reported', async () => {
        const { container } = render(
            <div>
                <button type="button" />
                <img src="x.png" />
            </div>,
        );

        const results = await axe.run(container, { runOnly: { type: 'tag', values: TAGS }, rules });

        expect(results.violations.map((violation) => violation.id).sort()).toEqual(['button-name', 'image-alt']);
    });

    afterAll(() => {
        console.info(`axe rules not run in jsdom (covered by tokens or the browser pass): ${NEEDS_LAYOUT.join(', ')}`);
        if (undecided.size === 0) return;
        const lines = [...undecided].map(([rule, seen]) => `  ${rule}: not decided in ${seen.size} of ${states.length} states`);
        console.info(`axe could not decide these rules without layout (see research.md):\n${lines.join('\n')}`);
    });
});

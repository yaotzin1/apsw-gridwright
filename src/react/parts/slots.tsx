import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { ColumnValue, GridRow, ResolvedColumn } from '../../core/types';
import { rendersSomething } from '../addons/resolve';
import type { AddonContribution, ColumnWindowEntry, ColumnWindowPlan, ExtraColumn, GridContext } from '../addons/types';
import { useGridwrightContext } from '../context';

type Active<TRow> = GridContext<TRow>['contributions']['active'];

/**
 * Calls one add-on's slot function.
 *
 * A slot that throws renders nothing and reports itself, rather than taking the grid down with it:
 * the same rule a pipeline stage follows. What the slot renders is ordinary React and fails the
 * ordinary way.
 */
export function callSlot<T>(addon: string, run: () => T, fallback: T): T {
    try {
        return run();
    } catch (error) {
        console.error(`[gridwright] the add-on "${addon}" threw while rendering:`, error);
        return fallback;
    }
}

/** Every add-on's content for a slot, keyed by add-on, skipping the ones that render nothing. */
export function renderSlot<TRow>(
    grid: GridContext<TRow>,
    slot: 'toolbar' | 'toolbarStatus' | 'aboveTable' | 'belowTable' | 'overlay' | 'tableFooter',
): ReactNode[] {
    const nodes: ReactNode[] = [];
    for (const { name, contribution } of grid.contributions.active) {
        const render = contribution[slot];
        if (!render) continue;
        const node = callSlot(name, () => render(grid), null);
        if (rendersSomething(node)) nodes.push(<Fragment key={name}>{node}</Fragment>);
    }
    return nodes;
}

/** The same for the slots that are about one column of the header. */
export function renderColumnSlot<TRow>(
    grid: GridContext<TRow>,
    slot: 'headerBefore' | 'headerAfter',
    column: ResolvedColumn<TRow, ColumnValue>,
): ReactNode[] {
    const nodes: ReactNode[] = [];
    for (const { name, contribution } of grid.contributions.active) {
        const render = contribution[slot];
        if (!render) continue;
        const node = callSlot(name, () => render(column, grid), null);
        if (rendersSomething(node)) nodes.push(<Fragment key={name}>{node}</Fragment>);
    }
    return nodes;
}

/** Attribute contributions for one element, in add-on order, ready for `mergeAttributes`. */
export function attributesOf<
    TRow,
    K extends 'rootAttributes' | 'tableAttributes' | 'rowAttributes' | 'cellAttributes' | 'headerAttributes' | 'extraCellAttributes' | 'extraHeaderAttributes',
>(
    active: Active<TRow>,
    slot: K,
    call: (fn: NonNullable<AddonContribution<TRow>[K]>) => object | undefined,
): (object | undefined)[] {
    return active.flatMap(({ name, contribution }) => {
        const fn = contribution[slot];
        return fn ? [callSlot(name, () => call(fn as NonNullable<AddonContribution<TRow>[K]>), undefined)] : [];
    });
}

/** The extra columns every add-on contributes, split by side, in add-on order. */
export function extraColumnsOf<TRow>(grid: GridContext<TRow>): {
    readonly start: readonly ExtraColumn<TRow>[];
    readonly end: readonly ExtraColumn<TRow>[];
} {
    const all = grid.contributions.active.flatMap(({ contribution }) => contribution.columns ?? []);
    return {
        start: all.filter((column) => column.placement === 'start'),
        end: all.filter((column) => column.placement === 'end'),
    };
}

/**
 * How many cells a row spans: the extra columns and every data cell position the header renders.
 *
 * Under a column window that is the mounted columns plus one per gap, not the columns that exist,
 * because a cell spanning more positions than the header row has would add columns to the table.
 */
export function columnCountOf<TRow>(grid: GridContext<TRow>): number {
    const extras = grid.contributions.active.reduce((count, { contribution }) => count + (contribution.columns?.length ?? 0), 0);
    return renderedColumnsOf(grid).length + extras;
}

/**
 * The column window an add-on publishes, or null: none does, or the rows are drawn as cards, where
 * every value of a row is one line of its card and there is no horizontal axis to window.
 */
export function columnWindowOf<TRow>(grid: GridContext<TRow>): ColumnWindowPlan<TRow> | null {
    let cards = false;
    let owner: { name: string; fn: NonNullable<AddonContribution<TRow>['columnWindow']> } | null = null;
    for (const { name, contribution } of grid.contributions.active) {
        if (contribution.cardLayout === true) cards = true;
        if (owner === null && contribution.columnWindow) owner = { name, fn: contribution.columnWindow };
    }
    if (cards || owner === null) return null;
    const { name, fn } = owner;
    return callSlot(name, () => fn(grid), null);
}

/** Every visible column as a mounted entry, shared by every row of one column set. */
const unwindowed = new WeakMap<object, readonly ColumnWindowEntry<unknown>[]>();

/**
 * The data cell positions of one row, in painting order: every visible column, or under a column
 * window the mounted columns with a gap for each run of columns that are not.
 *
 * The header, the default row and any add-on row that renders a cell per column (a summary row) go
 * through this, so they always agree on how many positions a row has. The list is computed once per
 * column set or plan and shared, because this is called once per rendered row.
 */
export function renderedColumnsOf<TRow>(grid: GridContext<TRow>): readonly ColumnWindowEntry<TRow>[] {
    const plan = columnWindowOf(grid);
    if (plan) return plan.entries;
    let entries = unwindowed.get(grid.columns);
    if (!entries) {
        entries = grid.columns
            .filter((column) => !column.hidden)
            .map((column, index) => ({ kind: 'column' as const, column: column as never, index }));
        unwindowed.set(grid.columns, entries);
    }
    return entries as readonly ColumnWindowEntry<TRow>[];
}

/**
 * The rows every add-on renders after this one, in add-on order, or null when none does.
 *
 * Null rather than an empty array because this runs once per rendered row: a grid listing no such
 * add-on, which is most of them, allocates nothing at all. `renderSlot` can afford the array
 * because it runs once per grid.
 */
export function rowsAfterOf<TRow>(grid: GridContext<TRow>, row: GridRow<TRow>): ReactNode[] | null {
    let nodes: ReactNode[] | null = null;
    for (const { name, contribution } of grid.contributions.active) {
        if (!contribution.rowAfter) continue;
        const node = callSlot(name, () => contribution.rowAfter!(row, grid), undefined);
        if (!rendersSomething(node)) continue;
        (nodes ??= []).push(<Fragment key={name}>{node}</Fragment>);
    }
    return nodes;
}

/** The row an add-on renders in place of the default one, if any does. The first add-on wins. */
export function customRowOf<TRow>(grid: GridContext<TRow>, row: GridRow<TRow>): ReactNode | undefined {
    for (const { name, contribution } of grid.contributions.active) {
        if (!contribution.renderRow) continue;
        const node = callSlot(name, () => contribution.renderRow!(row, grid), undefined);
        if (node !== undefined) return node;
    }
    return undefined;
}

export interface GridSlotProps {
    /** Which slot's contributions to render. */
    readonly name: 'aboveTable' | 'belowTable' | 'overlay' | 'tableFooter';
}

/**
 * Renders one slot's contributions, for a layout of your own: put `<GridSlot name="belowTable" />`
 * wherever the add-ons' below-table content belongs on your page.
 */
export function GridSlot({ name }: GridSlotProps) {
    const grid = useGridwrightContext();
    return <>{renderSlot(grid, name)}</>;
}

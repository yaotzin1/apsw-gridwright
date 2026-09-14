import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { ColumnValue, GridRow, ResolvedColumn } from '../../core/types';
import { rendersSomething } from '../addons/resolve';
import type { AddonContribution, ExtraColumn, GridContext } from '../addons/types';
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
    K extends 'tableAttributes' | 'rowAttributes' | 'cellAttributes' | 'headerAttributes' | 'extraCellAttributes' | 'extraHeaderAttributes',
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

/** How many cells a row spans: the visible data columns and every extra column. */
export function columnCountOf<TRow>(grid: GridContext<TRow>): number {
    const extras = grid.contributions.active.reduce((count, { contribution }) => count + (contribution.columns?.length ?? 0), 0);
    return grid.columns.filter((column) => !column.hidden).length + extras;
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

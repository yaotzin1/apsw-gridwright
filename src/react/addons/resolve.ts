import { orderAddons as orderViewAddons, resolveSet, slotValues } from '../../view/resolve';
import type { AddonContribution, AddonEntry, GridAddon, ResolvedAddon, ResolvedContributions } from './types';

export { CONTRIBUTABLE_ATTRIBUTES, isContributable, mergeAttributes } from '../../view/attributes';

/**
 * The add-on list of one grid: the core set, then the grid's own.
 *
 * Validated here rather than while rendering, so the error names both add-ons involved before any
 * of them has run. The rules are the view layer's, shared with every adapter.
 */
export function orderAddons<TRow>(
    core: readonly AddonEntry<TRow>[] | false | undefined,
    defaults: () => readonly GridAddon<TRow>[],
    extra: readonly AddonEntry<TRow>[] | undefined,
): readonly GridAddon<TRow>[] {
    return orderViewAddons<GridAddon<TRow>>(core, defaults, extra);
}

/**
 * Suppression, single ownership and navigation, from the contributions `setup` returned.
 *
 * Pure, so the rules are tested without rendering anything.
 */
export function resolveContributions<TRow>(addons: readonly ResolvedAddon<TRow>[]): ResolvedContributions<TRow> {
    return resolveSet<AddonContribution<TRow>>(addons);
}

type Contributions<TRow> = readonly ResolvedAddon<TRow>[];

/** The values one slot contributes, in add-on order, skipping add-ons that do not provide it. */
export function slotsOf<TRow, K extends keyof AddonContribution<TRow>>(
    active: Contributions<TRow>,
    key: K,
): readonly { readonly name: string; readonly value: NonNullable<AddonContribution<TRow>[K]> }[] {
    return slotValues<AddonContribution<TRow>, K>(active, key);
}

/** Whether slot content renders anything. `0` does; React renders it. */
export const rendersSomething = (node: unknown): boolean =>
    node !== null && node !== undefined && node !== false && node !== true && node !== '';

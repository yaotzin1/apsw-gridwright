import { GridwrightError } from '../core/errors';
import type { AddonMessages } from '../i18n/messages';

/**
 * Ordering, suppression and single ownership for a grid's add-ons, with no renderer.
 *
 * Generic over the add-on and its contribution, so a React add-on and a neutral one are resolved by
 * the same code, and a second adapter inherits the rules instead of rewriting them. What a slot
 * holds (a React element, a node description, a framework's template) is never looked at here.
 */

/** What ordering needs to know about an add-on. */
export interface OrderableAddon {
    readonly name: string;
    readonly requires?: readonly string[];
    readonly after?: readonly string[];
    readonly before?: readonly string[];
    readonly setup: (context: never) => unknown;
}

/** An add-on, or what a conditional leaves behind: `cond && addon()` is `false`. */
export type OptionalAddon<A> = A | false | null | undefined;

/**
 * The add-on list of one grid: the core set, then the grid's own.
 *
 * Validated here rather than while rendering, so the error names both add-ons involved before any
 * of them has run.
 */
export function orderAddons<A extends OrderableAddon>(
    core: readonly OptionalAddon<A>[] | false | undefined,
    defaults: () => readonly A[],
    extra: readonly OptionalAddon<A>[] | undefined,
): readonly A[] {
    // `cond && addon()` leaves `false` behind; a skipped entry is not an add-on, and not an error.
    const list = [...(core === false ? [] : (core ?? defaults())), ...(extra ?? [])].filter(
        (entry): entry is A => entry !== false && entry != null,
    );

    const seen = new Set<string>();
    for (const addon of list) {
        if (typeof addon?.name !== 'string' || addon.name === '' || typeof addon.setup !== 'function') {
            throw new GridwrightError('[gridwright] an add-on needs a non-empty name and a setup function.', { retryable: false });
        }
        if (seen.has(addon.name)) {
            throw new GridwrightError(
                `[gridwright] the add-on "${addon.name}" is listed twice. List it once; to replace a core add-on, pass coreAddons without it.`,
                { retryable: false },
            );
        }
        seen.add(addon.name);
    }

    for (const addon of list) {
        for (const required of addon.requires ?? []) {
            if (!seen.has(required)) {
                throw new GridwrightError(
                    `[gridwright] the add-on "${addon.name}" requires "${required}", which this grid does not list.`,
                    { retryable: false },
                );
            }
        }
    }

    return placeInOrder(list);
}

/**
 * Applies `after` and `before`, keeping the listed order wherever neither says anything.
 *
 * A stable topological sort: at each step the earliest listed add-on with nothing left to wait for
 * goes next. Without constraints the list comes back unchanged, which is the common case.
 */
function placeInOrder<A extends OrderableAddon>(list: readonly A[]): readonly A[] {
    const names = new Set(list.map((addon) => addon.name));
    const waitsFor = new Map<string, Set<string>>(list.map((addon) => [addon.name, new Set<string>()]));

    for (const addon of list) {
        for (const earlier of addon.after ?? []) {
            if (names.has(earlier) && earlier !== addon.name) waitsFor.get(addon.name)!.add(earlier);
        }
        for (const later of addon.before ?? []) {
            if (names.has(later) && later !== addon.name) waitsFor.get(later)!.add(addon.name);
        }
    }

    const constrained = [...waitsFor.values()].some((set) => set.size > 0);
    if (!constrained) return list;

    const placed = new Set<string>();
    const ordered: A[] = [];
    while (ordered.length < list.length) {
        const next = list.find(
            (addon) => !placed.has(addon.name) && [...waitsFor.get(addon.name)!].every((name) => placed.has(name)),
        );
        if (!next) {
            const stuck = list.filter((addon) => !placed.has(addon.name)).map((addon) => `"${addon.name}"`);
            throw new GridwrightError(
                `[gridwright] the add-ons ${stuck.join(', ')} ask to be placed before and after each other. Remove one of the constraints.`,
                { retryable: false },
            );
        }
        placed.add(next.name);
        ordered.push(next);
    }
    return ordered;
}

/** What suppression, ownership and navigation need to read from a contribution. */
export interface ResolvableContribution {
    readonly suppresses?: readonly string[];
    readonly messages?: AddonMessages;
    readonly navigation?: 'pages' | 'window';
    readonly headerLabel?: unknown;
    readonly body?: unknown;
}

export interface ResolvedAddonOf<C> {
    readonly name: string;
    readonly contribution: C;
}

/** The add-ons of one grid after ordering, suppression and ownership checks. */
export interface ResolvedSet<C> {
    /** Every add-on name, in order. */
    readonly names: readonly string[];
    /** Add-ons whose rendering is not suppressed, in order. Slots are read from these. */
    readonly active: readonly ResolvedAddonOf<C>[];
    /** Messages of every add-on, suppressed or not, by add-on name. */
    readonly messages: ReadonlyMap<string, AddonMessages>;
    readonly headerLabel: ResolvedAddonOf<C> | null;
    readonly body: ResolvedAddonOf<C> | null;
    readonly navigation: 'pages' | 'window';
}

/**
 * Suppression, single ownership and navigation, from the contributions `setup` returned.
 *
 * Pure, so the rules are tested without rendering anything.
 */
export function resolveSet<C extends ResolvableContribution>(addons: readonly ResolvedAddonOf<C>[]): ResolvedSet<C> {
    const suppressed = new Set<string>();
    for (const { name, contribution } of addons) {
        for (const target of contribution.suppresses ?? []) {
            if (target !== name) suppressed.add(target);
        }
    }

    const active = addons.filter((addon) => !suppressed.has(addon.name));

    const messages = new Map<string, AddonMessages>();
    for (const { name, contribution } of addons) {
        if (contribution.messages) messages.set(name, contribution.messages);
    }

    return {
        names: addons.map((addon) => addon.name),
        active,
        messages,
        headerLabel: soleOwner(active, 'headerLabel'),
        body: soleOwner(active, 'body'),
        navigation: active.some(({ contribution }) => contribution.navigation === 'window') ? 'window' : 'pages',
    };
}

function soleOwner<C extends ResolvableContribution>(
    active: readonly ResolvedAddonOf<C>[],
    slot: 'headerLabel' | 'body',
): ResolvedAddonOf<C> | null {
    const owners = active.filter(({ contribution }) => contribution[slot] !== undefined);
    if (owners.length > 1) {
        throw new GridwrightError(
            `[gridwright] the add-ons "${owners[0]!.name}" and "${owners[1]!.name}" both render the ${slot === 'body' ? 'table body' : 'header label'}. ` +
                `Only one can: list one of them, or have one suppress the other.`,
            { retryable: false },
        );
    }
    return owners[0] ?? null;
}

/** The values one slot contributes, in add-on order, skipping add-ons that do not provide it. */
export function slotValues<C, K extends keyof C>(
    active: readonly ResolvedAddonOf<C>[],
    key: K,
): readonly { readonly name: string; readonly value: NonNullable<C[K]> }[] {
    const values: { name: string; value: NonNullable<C[K]> }[] = [];
    for (const { name, contribution } of active) {
        const value = contribution[key];
        if (value !== undefined && value !== null) values.push({ name, value: value as NonNullable<C[K]> });
    }
    return values;
}

import { GridwrightError } from '../../core/errors';
import type { AddonContribution, AddonMessages, GridAddon, ResolvedAddon, ResolvedContributions } from './types';

/**
 * The add-on list of one grid: the core set, then the grid's own.
 *
 * Validated here rather than while rendering, so the error names both add-ons involved before any
 * of them has run.
 */
export function orderAddons<TRow>(
    core: readonly GridAddon<TRow>[] | false | undefined,
    defaults: () => readonly GridAddon<TRow>[],
    extra: readonly GridAddon<TRow>[] | undefined,
): readonly GridAddon<TRow>[] {
    const list = [...(core === false ? [] : (core ?? defaults())), ...(extra ?? [])];

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
function placeInOrder<TRow>(list: readonly GridAddon<TRow>[]): readonly GridAddon<TRow>[] {
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
    const ordered: GridAddon<TRow>[] = [];
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

/**
 * Suppression, single ownership and navigation, from the contributions `setup` returned.
 *
 * Pure, so the rules are tested without rendering anything.
 */
export function resolveContributions<TRow>(addons: readonly ResolvedAddon<TRow>[]): ResolvedContributions<TRow> {
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

function soleOwner<TRow>(active: readonly ResolvedAddon<TRow>[], slot: 'headerLabel' | 'body'): ResolvedAddon<TRow> | null {
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

type Contributions<TRow> = readonly ResolvedAddon<TRow>[];

/** The values one slot contributes, in add-on order, skipping add-ons that do not provide it. */
export function slotsOf<TRow, K extends keyof AddonContribution<TRow>>(
    active: Contributions<TRow>,
    key: K,
): readonly { readonly name: string; readonly value: NonNullable<AddonContribution<TRow>[K]> }[] {
    const values: { name: string; value: NonNullable<AddonContribution<TRow>[K]> }[] = [];
    for (const { name, contribution } of active) {
        const value = contribution[key];
        if (value !== undefined && value !== null) values.push({ name, value: value as NonNullable<AddonContribution<TRow>[K]> });
    }
    return values;
}

/** Whether slot content renders anything. `0` does; React renders it. */
export const rendersSomething = (node: unknown): boolean =>
    node !== null && node !== undefined && node !== false && node !== true && node !== '';

/**
 * The attributes an add-on may put on an element the shell renders, besides event handlers,
 * `aria-*` and `data-*`. An allowlist rather than a list of what is refused: nothing here can carry
 * markup, a URL or a script, so an attribute React adds tomorrow is refused until someone decides
 * it is safe, instead of being allowed until someone notices it is not.
 */
export const CONTRIBUTABLE_ATTRIBUTES: ReadonlySet<string> = new Set([
    'className',
    'style',
    'role',
    'id',
    'title',
    'tabIndex',
    'hidden',
    'dir',
    'lang',
    'draggable',
    'scope',
    'colSpan',
    'rowSpan',
    'abbr',
    'headers',
]);

/** Whether an add-on may contribute this attribute with this value. */
export function isContributable(key: string, value: unknown): boolean {
    if (/^on[A-Z][A-Za-z]*$/.test(key)) return typeof value === 'function';
    if (/^(aria|data)-[a-z][a-z0-9-]*$/.test(key)) {
        return value === null || ['string', 'number', 'boolean'].includes(typeof value);
    }
    if (key === 'style') return typeof value === 'object' && value !== null;
    return CONTRIBUTABLE_ATTRIBUTES.has(key) && (value === null || typeof value !== 'object') && typeof value !== 'function';
}

/**
 * Merges attribute contributions onto an element's own attributes.
 *
 * Class names join, styles merge with the later value winning, event handlers run in order (the
 * element's own first), and every other attribute takes the last value.
 *
 * The element's own attributes are the shell's and pass as they are. A contribution passes through
 * `isContributable` whatever its types said, so an add-on can never hand the grid an HTML sink,
 * a URL attribute, children or a handler written as a string: the types are a courtesy, this is
 * the rule.
 */
export function mergeAttributes<T extends object>(base: T, ...contributions: readonly (object | null | undefined)[]): T {
    const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };

    for (const contribution of contributions) {
        if (!contribution) continue;
        for (const [key, value] of Object.entries(contribution)) {
            if (value === undefined || !isContributable(key, value)) continue;

            if (key === 'className') {
                merged.className = [merged.className, value].filter(Boolean).join(' ') || undefined;
            } else if (key === 'style' && typeof value === 'object') {
                merged.style = { ...(merged.style as object | undefined), ...(value as object) };
            } else if (/^on[A-Z]/.test(key) && typeof value === 'function') {
                const previous = merged[key];
                merged[key] =
                    typeof previous === 'function'
                        ? (...args: unknown[]) => {
                              (previous as (...a: unknown[]) => void)(...args);
                              (value as (...a: unknown[]) => void)(...args);
                          }
                        : value;
            } else {
                merged[key] = value;
            }
        }
    }

    return merged as T;
}

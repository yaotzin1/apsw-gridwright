import type { DensityLevel, DensityOptions } from './types';

/** Every level, in the order a control lists them. */
export const DENSITY_LEVELS: readonly DensityLevel[] = ['compact', 'comfortable', 'spacious'];

/**
 * Row heights a level brings with it. `comfortable` has none on purpose: it is the grid as it is, so a
 * grid that adds the add-on and stays on it keeps whatever `--gw-row-height` its own CSS sets.
 */
const DEFAULT_ROW_HEIGHTS: Readonly<Partial<Record<DensityLevel, number>>> = { compact: 32, spacious: 52 };

const isLevel = (value: unknown): value is DensityLevel => DENSITY_LEVELS.includes(value as DensityLevel);

/**
 * The levels on offer: those given, without repeats or unknown names (a plain JavaScript caller can pass
 * anything), in the order given. Nothing usable means all of them.
 */
export function resolveLevels(options: Pick<DensityOptions, 'levels'>): readonly DensityLevel[] {
    const given = (options.levels ?? []).filter((level, index, all) => isLevel(level) && all.indexOf(level) === index);
    return given.length > 0 ? given : DENSITY_LEVELS;
}

/** The level to start on. A preference, not a contract, so a level that is not on offer is not an error. */
export function resolveInitial(options: Pick<DensityOptions, 'initial'>, levels: readonly DensityLevel[]): DensityLevel {
    const wanted = options.initial ?? 'comfortable';
    return levels.includes(wanted) ? wanted : levels[0]!;
}

/** The pixel height a level sets, or undefined when it leaves the height to the stylesheet. */
export function rowHeightFor(level: DensityLevel, options: Pick<DensityOptions, 'rowHeights'>): number | undefined {
    const given = options.rowHeights?.[level];
    if (typeof given === 'number' && Number.isFinite(given) && given > 0) return given;
    return DEFAULT_ROW_HEIGHTS[level];
}

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { resolveInitial, resolveLevels } from './state';
import type { DensityController, DensityLevel, DensityOptions } from './types';

const DensityContext = createContext<DensityController | null>(null);

export function DensityProvider({ controller, children }: { readonly controller: DensityController; readonly children: ReactNode }) {
    return <DensityContext.Provider value={controller}>{children}</DensityContext.Provider>;
}

/**
 * The level and what changes it, from inside a grid that lists `density()`.
 *
 *     const density = useDensity();
 *     <button onClick={() => density.setLevel('compact')}>Tighter</button>
 *
 * Throws in a grid that does not list the add-on, because a control that silently does nothing is
 * harder to find than one that says why. Use `useOptionalDensity` where the add-on is genuinely optional.
 */
export function useDensity(): DensityController {
    const controller = useContext(DensityContext);
    if (!controller) {
        throw new Error('[gridwright] useDensity needs the density() add-on. Add it to the grid’s `addons`.');
    }
    return controller;
}

/** The same, null where the grid does not list `density()`. */
export function useOptionalDensity(): DensityController | null {
    return useContext(DensityContext);
}

/**
 * The level and the controller over it. Called from the add-on's `setup`, so it runs on every render
 * of the grid and may call hooks.
 *
 * The starting level is read once: a person's choice is not undone because the option was written
 * again on a later render. A consumer who wants to start over gives the grid a new `key`.
 */
export function useDensityController(options: DensityOptions): DensityController {
    // The same array while the offer is the same, so the controller below is not rebuilt every render.
    const offered = resolveLevels(options);
    const stable = useRef(offered);
    if (stable.current.join(',') !== offered.join(',')) stable.current = offered;
    const levels = stable.current;
    const [level, setLevelState] = useState<DensityLevel>(() => resolveInitial(options, levels));

    // The latest of both, read when the person chooses, so a handler written inline is not a stale one.
    const latest = useRef({ levels, level, onChange: options.onChange });
    latest.current = { levels, level, onChange: options.onChange };

    const setLevel = useCallback((next: DensityLevel) => {
        const { levels: allowed, level: current, onChange } = latest.current;
        if (next === current || !allowed.includes(next)) return;
        latest.current = { ...latest.current, level: next };
        setLevelState(next);
        onChange?.(next);
    }, []);

    // A level that is no longer on offer (the option changed under a mounted grid) is shown as the first.
    const shown = levels.includes(level) ? level : levels[0]!;
    return useMemo(() => ({ level: shown, levels, setLevel }), [shown, levels, setLevel]);
}

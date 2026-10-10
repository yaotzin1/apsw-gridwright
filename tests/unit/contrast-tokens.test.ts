import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Stage 6, task T-04 of specs/wcag-2-2-aa-conformance (AC-05): the default colour tokens, measured.
 *
 * These are token-pair ratios computed from the stylesheet with the WCAG relative-luminance
 * formula, not what renders: a consumer's theme, a translucent overlay or an image behind a cell
 * changes the real number. Text needs 4.5:1; the boundary of a control and a focus indicator need
 * 3:1.
 *
 * This is the baseline. The default set has pairs under the threshold, and they are asserted as
 * the numbers they are, so a token change moves a number and fails here, whichever way it moves.
 * Task T-12 turns the known failures into expected failures with their criterion and adds the
 * `contrast()` set, which must pass every pair.
 */

const css = readFileSync(join(__dirname, '../../src/styles/styles.css'), 'utf8');

const declarations = (body: string): Record<string, string> =>
    Object.fromEntries([...body.matchAll(/(--gw-[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name!, value!.trim()]));

/** The declarations of every rule whose selector is exactly `selector`, in the order they appear. */
const blocks = (selector: string): Record<string, string>[] => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...css.matchAll(new RegExp(`(?:^|\\n)[ \\t]*${escaped}\\s*\\{([^}]*)\\}`, 'g'))].map((match) => declarations(match[1]!));
};

/** The declarations of the first rule whose selector is exactly `selector`, as name -> value. */
const block = (selector: string): Record<string, string> => {
    const [first] = blocks(selector);
    if (!first) throw new Error(`no rule for ${selector} in styles.css`);
    return first;
};

const light = block('.gw-root');
const dark = block(".gw-root[data-gw-theme='dark']");
// The same palette is written twice so the scheme follows the OS or an explicit attribute.
const darkByMedia = block(".gw-root:not([data-gw-theme='light'])");

const channel = (value: number): number => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
    const match = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!match) throw new Error(`expected a six-digit hex colour, got "${hex}"`);
    const [r, g, b] = [0, 2, 4].map((offset) => channel(parseInt(match[1]!.slice(offset, offset + 2), 16)));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

const ratio = (foreground: string, background: string): number => {
    const [a, b] = [luminance(foreground), luminance(background)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

type Tokens = Record<string, string>;

interface Pair {
    readonly name: string;
    readonly needs: 3 | 4.5;
    readonly foreground: string;
    readonly background: string;
    /** The measured ratio for the default set, light then dark, to two decimals. */
    readonly baseline: readonly [number, number];
}

const pairs: readonly Pair[] = [
    { name: 'text on surface', needs: 4.5, foreground: '--gw-text', background: '--gw-surface', baseline: [17.85, 14.48] },
    { name: 'text on surface-muted', needs: 4.5, foreground: '--gw-text', background: '--gw-surface-muted', baseline: [17.06, 11.87] },
    { name: 'text on surface-hover', needs: 4.5, foreground: '--gw-text', background: '--gw-surface-hover', baseline: [16.3, 11.87] },
    { name: 'text on surface-selected', needs: 4.5, foreground: '--gw-text', background: '--gw-surface-selected', baseline: [16.4, 8.4] },
    { name: 'text-muted on surface', needs: 4.5, foreground: '--gw-text-muted', background: '--gw-surface', baseline: [4.76, 6.96] },
    { name: 'text-muted on surface-muted', needs: 4.5, foreground: '--gw-text-muted', background: '--gw-surface-muted', baseline: [4.55, 5.71] },
    { name: 'text-muted on surface-hover', needs: 4.5, foreground: '--gw-text-muted', background: '--gw-surface-hover', baseline: [4.34, 5.71] },
    { name: 'text-muted on surface-selected', needs: 4.5, foreground: '--gw-text-muted', background: '--gw-surface-selected', baseline: [4.37, 4.04] },
    { name: 'danger text on surface', needs: 4.5, foreground: '--gw-danger', background: '--gw-surface', baseline: [6.47, 9.41] },
    { name: 'accent-contrast on accent (button text)', needs: 4.5, foreground: '--gw-accent-contrast', background: '--gw-accent', baseline: [5.17, 7.02] },
    { name: 'accent on surface (focus ring)', needs: 3, foreground: '--gw-accent', background: '--gw-surface', baseline: [5.17, 7.02] },
    { name: 'border on surface (control boundary)', needs: 3, foreground: '--gw-border', background: '--gw-surface', baseline: [1.23, 1.72] },
    { name: 'border-strong on surface (control boundary)', needs: 3, foreground: '--gw-border-strong', background: '--gw-surface', baseline: [1.48, 2.36] },
];

const measure = (tokens: Tokens, pair: Pair): number => {
    const foreground = tokens[pair.foreground];
    const background = tokens[pair.background];
    if (!foreground || !background) throw new Error(`${pair.name}: ${pair.foreground} or ${pair.background} is missing from the stylesheet`);
    return ratio(foreground, background);
};

describe('the default colour tokens (AC-05 baseline)', () => {
    it('writes the dark palette identically for the OS preference and for the attribute', () => {
        expect(darkByMedia).toEqual(dark);
    });

    it.each(['light', 'dark'] as const)('measures every pair in the %s scheme as recorded in research.md', (scheme) => {
        const tokens = scheme === 'light' ? light : dark;
        const index = scheme === 'light' ? 0 : 1;
        const measured = Object.fromEntries(pairs.map((pair) => [pair.name, Number(measure({ ...light, ...tokens }, pair).toFixed(2))]));
        const recorded = Object.fromEntries(pairs.map((pair) => [pair.name, pair.baseline[index]!]));

        expect(measured).toEqual(recorded);
    });

    it('lists the pairs under their threshold, so a fix or a regression changes this list', () => {
        const failing = (scheme: 'light' | 'dark') =>
            pairs.filter((pair) => measure({ ...light, ...(scheme === 'dark' ? dark : {}) }, pair) < pair.needs).map((pair) => pair.name);

        expect(failing('light')).toEqual([
            'text-muted on surface-hover',
            'text-muted on surface-selected',
            'border on surface (control boundary)',
            'border-strong on surface (control boundary)',
        ]);
        expect(failing('dark')).toEqual([
            'text-muted on surface-selected',
            'border on surface (control boundary)',
            'border-strong on surface (control boundary)',
        ]);
    });

    it('computes the WCAG formula correctly (black on white is 21:1, a colour on itself 1:1)', () => {
        expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 5);
        expect(ratio('#64748b', '#64748b')).toBe(1);
    });
});

describe('the contrast set (AC-15, AC-16)', () => {
    const lightSet = block(".gw-root[data-gw-contrast='aa']");
    const darkSet = block(".gw-root[data-gw-contrast='aa'][data-gw-theme='dark']");

    it('passes every pair, light and dark', () => {
        const failing = (tokens: Tokens) => pairs.filter((pair) => measure(tokens, pair) < pair.needs).map((pair) => pair.name);

        expect(failing({ ...light, ...lightSet })).toEqual([]);
        expect(failing({ ...light, ...dark, ...darkSet })).toEqual([]);
    });

    it('reassigns only the tokens that failed, and no default', () => {
        expect(Object.keys(lightSet).sort()).toEqual(['--gw-border', '--gw-border-strong', '--gw-text-muted']);
        expect(Object.keys(darkSet).sort()).toEqual(['--gw-border', '--gw-border-strong', '--gw-text-muted']);
    });

    it('is the same set whether the reader asked the system or the add-on did', () => {
        // prefers-contrast writes `.gw-root` after the defaults, inside a media query.
        expect(blocks('.gw-root').at(-1)).toEqual(lightSet);
        expect(blocks(".gw-root:not([data-gw-theme='light'])").at(-1)).toEqual(darkSet);
        expect(blocks(".gw-root[data-gw-theme='dark']").at(-1)).toEqual(darkSet);
        expect(block(".gw-root[data-gw-contrast='aa']:not([data-gw-theme='light'])")).toEqual(darkSet);
    });
});

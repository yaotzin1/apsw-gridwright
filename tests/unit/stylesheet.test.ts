import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Rules in the published stylesheet that a renderer cannot check.
 *
 * jsdom neither matches `:hover` nor paints, so these read the source. That proves the rule is
 * there and what it layers, not how it looks; the look was checked in a browser against the MUI
 * theme, whose hover and selected colours are the translucent ones that exposed the bug.
 */
const css = readFileSync(join(process.cwd(), 'src/styles/styles.css'), 'utf8');

/** The declarations of the rule with exactly this selector, or null. */
function ruleFor(selector: string): string | null {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? null;
}

describe('a pinned cell', () => {
    // A theme may make the row's state colour translucent -- MUI's `action.hover` is 4% black -- and
    // a sticky cell painted in it lets the columns scrolling underneath show through its text.
    it.each([
        ['.gw-row:hover .gw-cell--pinned', '--gw-surface-hover'],
        ['.gw-row--selected .gw-cell--pinned', '--gw-surface-selected'],
    ])('keeps an opaque ground under %s', (selector, token) => {
        const rule = ruleFor(selector);
        expect(rule, `no rule for ${selector}`).not.toBeNull();
        expect(rule).toContain(`var(${token})`);
        expect(rule).toMatch(/background-color:\s*var\(--gw-surface\)/);
    });

    // Equal specificity, so order decides. A second copy of the every-cell rule further down the
    // sheet -- there was one, beside the row menu -- quietly undoes the pinned one.
    it.each([
        ['.gw-row:hover .gw-cell', '.gw-row:hover .gw-cell--pinned'],
        ['.gw-row--selected .gw-cell', '.gw-row--selected .gw-cell--pinned'],
    ])('is not overridden by a later %s', (everyCell, pinned) => {
        expect(css.lastIndexOf(`\n${everyCell} {`)).toBeLessThan(css.indexOf(`\n${pinned} {`));
    });
});

describe('pointer targets (WCAG 2.5.8)', () => {
    it('declares the smallest target once, at 24px', () => {
        expect(ruleFor('.gw-root')).toMatch(/--gw-target-min:\s*24px;/);
    });

    it.each(['.gw-checkbox', '.gw-tree-toggle', '.gw-group-toggle', '.gw-detail-toggle'])('draws %s no smaller than the token', (selector) => {
        const rule = ruleFor(selector);
        expect(rule, `no rule for ${selector}`).not.toBeNull();
        expect(rule).toMatch(/(?:inline-size|width):\s*var\(--gw-target-min\)/);
        expect(rule).toMatch(/(?:block-size|height):\s*var\(--gw-target-min\)/);
    });
});

describe('forced colours (AC-07)', () => {
    // box-shadow and background are dropped in this mode, so each of these needs a rule of its own.
    const forced = /@media \(forced-colors: active\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    const inForced = (selector: string): string | undefined => {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(forced)?.[1];
    };

    it('has a forced-colours block', () => {
        expect(forced).not.toBe('');
    });

    it.each([
        ["[class*='gw-']:focus-visible", /outline:\s*2px solid Highlight/],
        ['.gw-cell--focused', /outline:\s*2px solid Highlight/],
        ['.gw-row--selected .gw-cell', /border-block:\s*2px solid Highlight/],
        ["[data-direction='asc']", /border-bottom-color:\s*CanvasText/],
        ["[data-direction='desc']", /border-top-color:\s*CanvasText/],
        ['.gw-sort-priority', /border-color:\s*CanvasText/],
        ['.gw-resize-handle::before', /background:\s*CanvasText/],
    ])('keeps %s visible', (selector, declaration) => {
        const rule = inForced(selector);
        expect(rule, `no forced-colours rule for ${selector}`).toBeDefined();
        expect(rule).toMatch(declaration);
    });

    it('uses system colours only', () => {
        expect(forced).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|var\(--gw-/i);
    });
});

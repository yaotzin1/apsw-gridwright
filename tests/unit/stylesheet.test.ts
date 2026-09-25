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

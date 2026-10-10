import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * AC-11 of specs/wcag-2-2-aa-conformance: no document claims what the conformance report does not support.
 *
 * A blanket sentence ("WCAG compliant", "508 compliant", "accessible by default") is a statement a procurement
 * reader will quote, and the report says several rows are partial or not yet evaluated. The words below are
 * fine where they are technical terms ("accessible name", "accessible state") and inside the report itself,
 * which is the one place that states, row by row, what is and is not supported.
 */

const root = process.cwd();

/** Every Markdown file a reader of the package might read, except the report. */
const documents = (): { path: string; text: string }[] => {
    const files = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'packages/mui/README.md', 'examples/README.md'];
    for (const name of readdirSync(join(root, 'docs'))) if (name.endsWith('.md') && name !== 'conformance.md') files.push(`docs/${name}`);
    return files.flatMap((path) => {
        try {
            return [{ path, text: readFileSync(join(root, path), 'utf8') }];
        } catch {
            return [];
        }
    });
};

/** What may not be said outside the report, and why. */
const BANNED: readonly { readonly name: string; readonly pattern: RegExp }[] = [
    { name: 'a WCAG compliance claim', pattern: /\bWCAG(?:[\s-]*2(?:\.[0-2])?)?(?:[\s-]*(?:A{1,3}))?[\s-]+(?:compliant|compliance|conformant|certified)\b/i },
    { name: 'a Section 508 compliance claim', pattern: /\b508[\s-]+(?:compliant|compliance|conformant)\b/i },
    { name: 'an ADA compliance claim', pattern: /\bADA[\s-]+(?:compliant|compliance)\b/i },
    { name: 'an unqualified "is accessible"', pattern: /\b(?:is|are|be|fully|truly|completely|entirely|100%)\s+accessible\b/i },
    { name: 'an unqualified "accessible by default" or "accessible grid"', pattern: /\baccessible[\s-]+(?:by default|out of the box|data grid|grid|table|component)\b/i },
    { name: '"an accessible `<table>`"', pattern: /\baccessible\s+`<table/i },
];

describe('the wording of what the grid claims (AC-11)', () => {
    const files = documents();

    it('reads the README and the guides', () => {
        const paths = files.map((file) => file.path);
        expect(paths).toContain('README.md');
        expect(paths).toContain('docs/accessibility.md');
        expect(paths).not.toContain('docs/conformance.md');
    });

    it.each(BANNED.map((rule) => [rule.name, rule] as const))('has no %s outside the conformance report', (_name, rule) => {
        const found = files.flatMap(({ path, text }) =>
            text.split('\n').flatMap((line, index) => (rule.pattern.test(line) ? [`${path}:${index + 1}: ${line.trim().slice(0, 100)}`] : [])),
        );

        expect(found).toEqual([]);
    });

    it('catches each phrase it exists to catch', () => {
        // Built from fragments so this file is not itself a document making the claim.
        const samples: readonly [string, string][] = [
            ['a WCAG compliance claim', ['WCAG', 'compliant'].join(' ')],
            ['a WCAG compliance claim', ['WCAG 2.2 AA', 'compliant'].join(' ')],
            ['a WCAG compliance claim', ['WCAG-2.1-AA', 'conformant'].join(' ')],
            ['a Section 508 compliance claim', ['508', 'compliant'].join(' ')],
            ['an ADA compliance claim', ['ADA', 'compliant'].join(' ')],
            ['an unqualified "is accessible"', ['the grid is fully', 'accessible'].join(' ')],
            ['an unqualified "accessible by default" or "accessible grid"', ['accessible', 'by default'].join(' ')],
            ['an unqualified "accessible by default" or "accessible grid"', ['a finished,', 'accessible', 'grid'].join(' ')],
        ];

        for (const [name, sample] of samples) {
            const rule = BANNED.find((candidate) => candidate.name === name)!;
            expect(rule.pattern.test(sample), `${name}: ${sample}`).toBe(true);
        }
    });

    it('leaves the technical terms alone', () => {
        const allowed = ['the accessible name of the grid', 'the accessible state', 'what the accessibility tree exposes', 'WCAG 2.2 AA where the default is not', 'not a conformance claim'];
        for (const sentence of allowed) {
            for (const rule of BANNED) expect(rule.pattern.test(sentence), `${rule.name}: ${sentence}`).toBe(false);
        }
    });
});

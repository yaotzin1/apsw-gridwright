// @vitest-environment node
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * The view layer and the conformance kit are headless by the same rule as the engine. This runs the
 * repository's own ESLint configuration over a hostile snippet at a path in each directory, so
 * removing a directory from the lint block fails here instead of letting a DOM reference in.
 */
const eslint = new ESLint({ cwd: process.cwd() });

async function rulesFor(filePath: string, code: string): Promise<string[]> {
    const [result] = await eslint.lintText(code, { filePath });
    if (!result) throw new Error(`ESLint returned no result for ${filePath}`);
    return result.messages.map((message) => message.ruleId ?? 'parse-error');
}

const HEADLESS = ['src/core/x.ts', 'src/view/x.ts', 'src/view/model/x.ts', 'src/conformance/x.ts'];

describe.each(HEADLESS)('headless lint ban in %s', (file) => {
    it('refuses document and window', async () => {
        const rules = await rulesFor(file, 'export const a = document.title;\nexport const b = window.name;\n');
        expect(rules.filter((rule) => rule === 'no-restricted-globals')).toHaveLength(2);
    });

    it.each(['react', 'react-dom', 'react/jsx-runtime', '@angular/core', 'vue', 'svelte', 'solid-js'])(
        'refuses an import of %s',
        async (specifier) => {
            const rules = await rulesFor(file, `import * as ui from '${specifier}';\nexport { ui };\n`);
            expect(rules).toContain('no-restricted-imports');
        },
    );

    it('allows a plain module', async () => {
        const rules = await rulesFor(file, 'export const add = (a: number, b: number): number => a + b;\n');
        expect(rules).toEqual([]);
    });
});

describe('the adapter directory is not headless', () => {
    it('may import react', async () => {
        const rules = await rulesFor('src/react/x.ts', "import { useState } from 'react';\nexport const s = useState;\n");
        expect(rules).not.toContain('no-restricted-imports');
    });
});

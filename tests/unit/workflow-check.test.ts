// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
    checkCi,
    checkGates,
    checkProject,
    checkSpecDirectory,
    checkStructure,
    ciJobNames,
    runChecks,
    runsCommand,
} from '../../scripts/check-workflow.mjs';
import { parseWorkflowYaml } from '../../scripts/lib/workflow-yaml.mjs';

describe('the workflow parser', () => {
    it('reads nested mappings, lists of mappings, inline lists and quoted scalars', () => {
        const parsed = parseWorkflowYaml(
            [
                '# a comment',
                'version: "2.0"',
                'tracks:',
                '  - id: fix',
                '    stages: [implement, "verify, then review"]',
                '    deliverables:',
                "      - 'a test that fails first'",
                'toolchain:',
                '  vitest: 5 # trailing comment',
                '  strict: true',
            ].join('\n'),
        );

        expect(parsed).toEqual({
            version: '2.0',
            tracks: [{ id: 'fix', stages: ['implement', 'verify, then review'], deliverables: ['a test that fails first'] }],
            toolchain: { vitest: 5, strict: true },
        });
    });

    it('refuses what it does not support instead of guessing, naming the line', () => {
        expect(() => parseWorkflowYaml('run: |\n  echo')).toThrow(/line 1: block scalars/);
        expect(() => parseWorkflowYaml('a: 1\na: 2')).toThrow(/line 2: duplicate key "a"/);
        expect(() => parseWorkflowYaml('a: "open')).toThrow(/unterminated/);
        expect(() => parseWorkflowYaml('a:\nb: 1')).toThrow(/"a" has no value/);
    });
});

describe('the workflow checker', () => {
    const pkg = {
        engines: { node: '>=22.12' },
        peerDependencies: { react: '^18.0.0 || ^19.0.0' },
        devDependencies: { vitest: '^5.0.0' },
    };

    it('passes the repository as it is', () => {
        expect(runChecks()).toEqual([]);
    });

    it('fails a toolchain major the manifest has moved past', () => {
        // The file described "Vitest 2" for a release after the upgrade to vitest 5.
        const project = { runtime: { node: '>=22.12' }, peer_dependencies: { react: '^18.0.0 || ^19.0.0' }, toolchain: { vitest: 2 } };
        expect(checkProject(project, pkg)).toEqual([
            'project.toolchain.vitest is 2 but package.json devDependencies has "^5.0.0"',
        ]);
    });

    it('fails a required check that no CI job produces, which blocks every merge', () => {
        // Branch protection required Node 18 and 20 after the matrix moved to 22 and 24.
        const ciText = [
            'jobs:',
            '  verify:',
            '    name: Verify on Node ${{ matrix.node }}',
            '    strategy:',
            '      matrix:',
            '        node: [22, 24]',
            '  package:',
            '    name: Publishable tarball',
        ].join('\n');

        expect(ciJobNames(ciText).names).toEqual(['Verify on Node 22', 'Verify on Node 24', 'Publishable tarball']);
        expect(
            checkCi({ workflow: 'ci.yml', required_checks: ['Verify on Node 18', 'Verify on Node 22', 'Verify on Node 24', 'Publishable tarball'] }, ciText, pkg),
        ).toEqual(['ci.required_checks names "Verify on Node 18", which no job in ci.yml produces']);
    });

    it('fails a Node matrix that does not test the declared floor', () => {
        const ciText = 'jobs:\n  verify:\n    name: Verify on Node ${{ matrix.node }}\n    strategy:\n      matrix:\n        node: [24]';
        expect(checkCi({ workflow: 'ci.yml', required_checks: ['Verify on Node 24'] }, ciText, pkg)).toEqual([
            'the verify matrix starts at Node 24 but engines.node starts at 22; a declared floor nothing tests is a guess',
        ]);
    });

    it('fails a gate the hook or CI does not run, and accepts npm --silent', () => {
        expect(runsCommand('npm run lint --silent >/dev/null', 'npm run lint')).toBe(true);
        expect(runsCommand('npm run lint:fix', 'npm run lint')).toBe(false);
        expect(checkGates([{ name: 'Tests', command: 'npm test' }], 'npm run lint', 'run: npm test')).toEqual([
            'gate "Tests" (npm test) is not run by .githooks/pre-commit',
        ]);
    });

    describe('spec directories', () => {
        const specKit = {
            required: ['spec.md', 'api-surface.md', 'review.md'],
            optional: ['events.md', 'data-model.md'],
            omission_heading: '## Artifacts not written',
        };
        const spec = (omissions: string) => `# Spec\n\n## 1. Problem\n\ntext\n\n## Artifacts not written\n\n${omissions}\n\n## 2. Next\n`;

        it('accepts an optional artifact omitted with a reason', () => {
            const files = ['spec.md', 'api-surface.md', 'review.md', 'data-model.md'];
            expect(checkSpecDirectory('small', files, spec('- `events.md`: the feature emits no event.'), specKit)).toEqual([]);
        });

        it('fails a missing required file, and an optional one neither written nor explained', () => {
            expect(checkSpecDirectory('small', ['spec.md', 'review.md'], spec(''), specKit)).toEqual([
                'specs/small is missing api-surface.md',
                'specs/small has no events.md; write it, or list it in spec.md under "## Artifacts not written" with the reason',
                'specs/small has no data-model.md; write it, or list it in spec.md under "## Artifacts not written" with the reason',
            ]);
        });

        it('ignores the example bullet the template keeps inside a comment', () => {
            const files = ['spec.md', 'api-surface.md', 'review.md', 'data-model.md', 'events.md'];
            expect(checkSpecDirectory('copied', files, spec('<!--\n- `events.md`: example.\n-->'), specKit)).toEqual([]);
        });

        it('fails an omission without a reason, and a required file listed as omitted', () => {
            const files = ['spec.md', 'api-surface.md', 'review.md', 'data-model.md'];
            expect(checkSpecDirectory('small', files, spec('- `events.md`:\n- `review.md`: later'), specKit)).toEqual([
                'specs/small omits events.md without a reason',
                'specs/small omits review.md, which is not optional',
            ]);
        });
    });

    it('fails a rule without enforcement, a stage led by an unregistered skill, and an unregistered skill directory', () => {
        const workflow = {
            stages: [{ id: 'verify', phase: 7, lead_skills: ['qa', 'ghost'], guidance: 'verification.md' }],
            tracks: [{ id: 'chore', stages: ['verify', 'ship'] }],
            skills: { registry: [{ name: 'qa', path: 'qa.md' }] },
            architectural_rules: [{ rule: 'Be headless.' }, { rule: 'Test it.', enforced_by: '`tests/missing.test.ts`' }],
        };
        const errors = checkStructure(workflow, {
            fileExists: (file) => file !== 'tests/missing.test.ts',
            skillDirectories: ['qa', 'orphan'],
        });

        expect(errors).toEqual([
            'stage "verify" is led by "ghost", which is not in skills.registry',
            'track "chore" names stage "ship", which does not exist',
            '.agents/skills/orphan is not in skills.registry',
            'architectural_rules[0] needs both "rule" and "enforced_by"',
            'architectural_rules[1] is enforced by tests/missing.test.ts, which does not exist',
        ]);
    });
});

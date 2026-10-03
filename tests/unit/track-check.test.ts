// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkCommit, checkRange, globToRegExp, matchesAny, parseTrailers, readConfig } from '../../scripts/check-track.mjs';
import { checkCommitMsgGates, checkEnforcement } from '../../scripts/check-workflow.mjs';
import type { TrackConfig } from '../../scripts/check-track.mjs';

const config: TrackConfig = {
    tracks: ['feature', 'fix', 'chore', 'release'],
    source_paths: ['src/', 'packages/*/src/'],
    test_paths: ['tests/', 'packages/*/tests/'],
    changelogs: ['CHANGELOG.md', 'packages/*/CHANGELOG.md'],
    release_paths: ['package.json', 'package-lock.json', 'src/index.ts', 'CHANGELOG.md'],
    protected_paths: ['workflow.ai.yml', 'scripts/check-*', '.githooks/'],
    public_surface: ['src/index.ts', 'src/react/index.ts'],
    api_reference: 'docs/api.md',
    spec_directory: 'specs',
    spec_required: ['spec.md', 'api-surface.md', 'review.md'],
};

const complete = { name: 'sorting', files: ['spec.md', 'api-surface.md', 'review.md'] };

describe('globs', () => {
    it('treats a trailing slash as a whole directory and * as one path segment', () => {
        expect(matchesAny('src/react/grid.tsx', ['src/'])).toBe(true);
        expect(matchesAny('packages/mui/src/a.ts', ['packages/*/src/'])).toBe(true);
        expect(matchesAny('packages/mui/tests/a.ts', ['packages/*/src/'])).toBe(false);
        expect(matchesAny('scripts/check-track.mjs', ['scripts/check-*'])).toBe(true);
        expect(matchesAny('scripts/lib/x.mjs', ['scripts/check-*'])).toBe(false);
        expect(globToRegExp('a.b').test('axb')).toBe(false);
    });
});

describe('trailers', () => {
    it('reads the last value for each name and ignores comment lines', () => {
        const trailers = parseTrailers('fix: a thing\n\nbody\n\n# Track: chore\nTrack: fix\nCo-Authored-By: someone <a@b.c>\n');
        expect(trailers.get('track')).toBe('fix');
        expect(trailers.get('co-authored-by')).toBe('someone <a@b.c>');
    });
});

describe('checkCommit', () => {
    it('refuses a commit with no track', () => {
        expect(checkCommit('fix: a thing', ['src/a.ts'], config)[0]).toMatch(/no "Track:" trailer/);
    });

    it('refuses a track that does not exist', () => {
        expect(checkCommit('fix: a thing\n\nTrack: tweak', ['src/a.ts'], config)[0]).toMatch(/not a track/);
    });

    it('lets a merge commit through', () => {
        expect(checkCommit("Merge branch 'main' into dev", ['src/a.ts'], config)).toEqual([]);
    });

    it('refuses source changed under the chore track, in the grid and in a workspace package', () => {
        expect(checkCommit('chore: tidy\n\nTrack: chore', ['src/a.ts'], config)[0]).toMatch(/changes source/);
        expect(checkCommit('chore: tidy\n\nTrack: chore', ['packages/mui/src/a.ts'], config)[0]).toMatch(/changes source/);
        expect(checkCommit('chore: tidy\n\nTrack: chore', ['docs/api.md', 'tests/a.test.ts'], config)).toEqual([]);
    });

    it('lets a release touch only version files and changelogs', () => {
        expect(checkCommit('chore(release): 1.0.0\n\nTrack: release', ['package.json', 'CHANGELOG.md', 'src/index.ts'], config)).toEqual([]);
        expect(checkCommit('chore(release): 1.0.0\n\nTrack: release', ['package.json', 'README.md'], config)[0]).toMatch(/more than a release does/);
    });

    it('asks for Workflow-Change when a file that defines the workflow changes', () => {
        const message = 'chore: tighten\n\nTrack: chore';
        expect(checkCommit(message, ['scripts/check-track.mjs'], config)[0]).toMatch(/Workflow-Change/);
        expect(checkCommit(message, ['.githooks/commit-msg'], config)[0]).toMatch(/Workflow-Change/);
        expect(checkCommit(`${message}\nWorkflow-Change: the check`, ['workflow.ai.yml'], config)).toEqual([]);
        expect(checkCommit(`${message}\nWorkflow-Change:`, ['workflow.ai.yml'], config)[0]).toMatch(/Workflow-Change/);
    });
});

describe('checkRange', () => {
    const commit = (message: string, files: string[]) => ({ message, files });

    it('has nothing to say about a range of merges only', () => {
        expect(checkRange([commit("Merge branch 'main' into dev", ['src/a.ts'])], [], config)).toEqual([]);
    });

    it('asks a fix that changed source for a test and a changelog entry', () => {
        const errors = checkRange([commit('fix: a\n\nTrack: fix', ['src/a.ts'])], [], config);
        expect(errors).toHaveLength(2);
        expect(checkRange([commit('fix: a\n\nTrack: fix', ['src/a.ts', 'tests/a.test.ts', 'CHANGELOG.md'])], [], config)).toEqual([]);
    });

    it('does not ask a fix that changed no source for anything', () => {
        expect(checkRange([commit('fix: docs\n\nTrack: fix', ['docs/api.md'])], [], config)).toEqual([]);
    });

    it('counts the tests and the changelog across the commits of the range', () => {
        const range = [
            commit('test: reproduce\n\nTrack: fix', ['tests/a.test.ts']),
            commit('fix: a\n\nTrack: fix', ['src/a.ts']),
            commit('chore: log\n\nTrack: chore', ['CHANGELOG.md']),
        ];
        expect(checkRange(range, [], config)).toEqual([]);
    });

    it('asks a feature for a complete spec directory it touched', () => {
        const files = ['src/a.ts', 'CHANGELOG.md', 'specs/sorting/spec.md', 'specs/sorting/api-surface.md', 'specs/sorting/review.md'];
        expect(checkRange([commit('feat: a\n\nTrack: feature', files)], [complete], config)).toEqual([]);
        expect(checkRange([commit('feat: a\n\nTrack: feature', ['src/a.ts', 'CHANGELOG.md'])], [complete], config)[0]).toMatch(/no specs\/<name>\//);
        const partial = { name: 'sorting', files: ['spec.md'] };
        expect(checkRange([commit('feat: a\n\nTrack: feature', ['src/a.ts', 'CHANGELOG.md', 'specs/sorting/spec.md'])], [partial], config)[0]).toMatch(/no specs\/<name>\//);
    });

    it('asks a feature for a changelog entry, and docs/api.md when the public exports changed', () => {
        const spec = ['specs/sorting/spec.md', 'specs/sorting/api-surface.md', 'specs/sorting/review.md'];
        const noLog = checkRange([commit('feat: a\n\nTrack: feature', ['src/a.ts', ...spec])], [complete], config);
        expect(noLog).toHaveLength(1);
        expect(noLog[0]).toMatch(/CHANGELOG/);
        const exportsChanged = checkRange([commit('feat: a\n\nTrack: feature', ['src/index.ts', 'CHANGELOG.md', ...spec])], [complete], config);
        expect(exportsChanged[0]).toMatch(/docs\/api\.md/);
        expect(checkRange([commit('feat: a\n\nTrack: feature', ['src/index.ts', 'CHANGELOG.md', 'docs/api.md', ...spec])], [complete], config)).toEqual([]);
    });

    it('holds a pull request to the heaviest track, so a feature split into chore commits keeps its deliverables', () => {
        const range = [commit('chore: scaffolding\n\nTrack: chore', ['docs/a.md']), commit('feat: a\n\nTrack: feature', ['src/a.ts'])];
        expect(checkRange(range, [], config).length).toBeGreaterThan(0);
    });
});

describe('the real workflow.ai.yml', () => {
    it('configures every track and a full baseline hash', () => {
        const real = readConfig();
        expect(real.tracks).toEqual(['feature', 'fix', 'chore', 'release']);
        expect(real.baseline).toMatch(/^[0-9a-f]{40}$/);
        expect(real.spec_required).toContain('spec.md');
    });

    it('protects the files that enforce it', () => {
        const real = readConfig();
        for (const file of ['workflow.ai.yml', 'scripts/check-track.mjs', '.githooks/commit-msg', '.github/workflows/ci.yml']) {
            expect(matchesAny(file, real.protected_paths), file).toBe(true);
        }
    });
});

describe('what check-workflow holds the enforcement to', () => {
    const tracks = [{ id: 'feature' }, { id: 'fix' }];
    const enforcement = {
        baseline: 'a'.repeat(40),
        tracks: ['feature', 'fix'],
        source_paths: ['src/'],
        test_paths: ['tests/'],
        changelogs: ['CHANGELOG.md'],
        release_paths: ['package.json'],
        protected_paths: ['workflow.ai.yml'],
        public_surface: ['src/index.ts'],
    };

    it('accepts a complete block', () => {
        expect(checkEnforcement(enforcement, tracks)).toEqual([]);
    });

    it('refuses a missing block, a short baseline, a track out of step and an empty list', () => {
        expect(checkEnforcement(undefined, tracks)[0]).toMatch(/no `enforcement` block/);
        expect(checkEnforcement({ ...enforcement, baseline: 'abc' }, tracks)[0]).toMatch(/40-character/);
        expect(checkEnforcement({ ...enforcement, tracks: ['feature'] }, tracks)[0]).toMatch(/"fix"/);
        expect(checkEnforcement({ ...enforcement, tracks: ['feature', 'fix', 'tweak'] }, tracks)[0]).toMatch(/"tweak"/);
        expect(checkEnforcement({ ...enforcement, protected_paths: [] }, tracks)[0]).toMatch(/protected_paths/);
    });

    it('requires the commit-msg hook to exist and call the script, and CI to run it', () => {
        const gates = [{ name: 'Track', command: 'node scripts/check-track.mjs' }];
        const hook = 'node scripts/check-track.mjs --commit-msg "$1"';
        const ci = 'run: node scripts/check-track.mjs --range a..b';
        expect(checkCommitMsgGates(gates, hook, ci)).toEqual([]);
        expect(checkCommitMsgGates(gates, null, ci)[0]).toMatch(/does not exist/);
        expect(checkCommitMsgGates(gates, '#!/bin/sh\nexit 0', ci)[0]).toMatch(/not run by .githooks\/commit-msg/);
        expect(checkCommitMsgGates(gates, hook, 'run: npm test')[0]).toMatch(/not run by CI/);
    });
});

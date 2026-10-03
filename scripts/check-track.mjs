/**
 * Holds a change to the track it declares (enforced: the commit-msg hook and the CI job
 * "Track and deliverables").
 *
 * The tracks and stages in workflow.ai.yml are guidance: nothing failed when an agent skipped one.
 * This is the part of them a script can check. Every commit declares its track in a trailer, and the
 * diff has to look like that track's work:
 *
 *   Track: feature | fix | chore | release
 *   Workflow-Change: <why>      required when a commit touches the files that define or enforce the workflow
 *
 *   chore     touches no source: a change to src/ cannot be waved through as tooling
 *   release   touches only version files and changelogs
 *   fix       with source changed, the range also changes a test and a changelog
 *   feature   the range carries a complete specs/<name>/ directory, a changelog entry, and docs/api.md
 *             when an index file that carries the public exports changed
 *
 * A pull request is held to the heaviest track any of its commits declares, so splitting a feature
 * into commits labelled `chore` does not shed its deliverables.
 *
 *   node scripts/check-track.mjs --commit-msg <file>    one message and the staged files (hook)
 *   node scripts/check-track.mjs --range <base>..<head> every commit in a pull request (CI)
 *
 * What this cannot do: judge whether a stage was done well, or stop `git commit --no-verify`. CI
 * runs the same range check on the pull request, and a required check on main is the wall.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT_DIR, readWorkflow } from './lib/workflow-yaml.mjs';

const RANK = { chore: 1, release: 1, fix: 2, feature: 3 };

/** A glob with `*` (not across a slash) and `**` (across); a trailing slash means a whole directory. */
export function globToRegExp(glob) {
    const source = glob.endsWith('/') ? `${glob}**` : glob;
    let out = '';
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        if (char === '*' && source[i + 1] === '*') {
            out += '.*';
            i += 1;
        } else if (char === '*') out += '[^/]*';
        else out += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${out}$`);
}

export function matchesAny(file, globs) {
    return (globs ?? []).some((glob) => globToRegExp(glob).test(file));
}

/** The last `Name: value` line for each trailer name, case-insensitively. Comment lines are ignored. */
export function parseTrailers(message) {
    const trailers = new Map();
    for (const line of String(message).split(/\r?\n/)) {
        if (line.startsWith('#')) continue;
        const match = /^([A-Za-z][A-Za-z-]*):[ \t]*(.*\S)[ \t]*$/.exec(line);
        if (match) trailers.set(match[1].toLowerCase(), match[2]);
    }
    return trailers;
}

export function isMergeMessage(message) {
    return /^Merge /.test(String(message).trimStart());
}

/** One commit: its message and the files it changes. Returns the reasons it cannot be accepted. */
export function checkCommit(message, files, config) {
    if (isMergeMessage(message)) return [];
    const errors = [];
    const trailers = parseTrailers(message);
    const track = trailers.get('track');

    if (!track) {
        errors.push(`no "Track:" trailer. Add one line to the message: Track: ${config.tracks.join(' | ')}`);
    } else if (!config.tracks.includes(track)) {
        errors.push(`"Track: ${track}" is not a track; the tracks are ${config.tracks.join(', ')}`);
    }

    const source = files.filter((file) => matchesAny(file, config.source_paths));
    if (track === 'chore' && source.length > 0) {
        errors.push(`"Track: chore" changes source (${source.slice(0, 3).join(', ')}${source.length > 3 ? ', ...' : ''}). A change a consumer can notice is a fix or a feature, and runs the stages those add.`);
    }

    if (track === 'release') {
        const stray = files.filter((file) => !matchesAny(file, config.release_paths));
        if (stray.length > 0) errors.push(`"Track: release" changes more than a release does: ${stray.slice(0, 3).join(', ')}${stray.length > 3 ? ', ...' : ''}`);
    }

    const guarded = files.filter((file) => matchesAny(file, config.protected_paths));
    if (guarded.length > 0 && !trailers.get('workflow-change')) {
        errors.push(`changes ${guarded.slice(0, 3).join(', ')}${guarded.length > 3 ? ', ...' : ''}, which define or enforce the workflow. Add a "Workflow-Change: <why>" trailer so the change is visible.`);
    }
    return errors;
}

/**
 * A pull request: every commit message with its files. `specDirectories` is what exists under
 * `specs/` at the head, as `{ name, files }`, for the feature check.
 */
export function checkRange(commits, specDirectories, config) {
    const counted = commits.filter((commit) => !isMergeMessage(commit.message));
    const tracks = counted.map((commit) => parseTrailers(commit.message).get('track')).filter((track) => track in RANK);
    if (tracks.length === 0) return [];

    const heaviest = tracks.reduce((best, track) => (RANK[track] > RANK[best] ? track : best));
    const files = [...new Set(counted.flatMap((commit) => commit.files))];
    const touches = (globs) => files.filter((file) => matchesAny(file, globs));
    const source = touches(config.source_paths);
    const errors = [];

    if (heaviest === 'fix' && source.length > 0) {
        if (touches(config.test_paths).length === 0) errors.push('the heaviest track is "fix" and source changed, but no test changed. A fix comes with a test that fails without it.');
        if (touches(config.changelogs).length === 0) errors.push('the heaviest track is "fix" and source changed, but no CHANGELOG.md entry was added.');
    }

    if (heaviest === 'feature') {
        const required = config.spec_required;
        const touched = specDirectories.filter((dir) => dir.files.some((file) => files.includes(`${config.spec_directory}/${dir.name}/${file}`)));
        const complete = touched.filter((dir) => required.every((name) => dir.files.includes(name)));
        if (complete.length === 0) {
            errors.push(`the heaviest track is "feature", but no ${config.spec_directory}/<name>/ directory with ${required.join(', ')} was written or changed in this range.`);
        }
        if (touches(config.changelogs).length === 0) errors.push('the heaviest track is "feature", but no CHANGELOG.md entry was added.');
        if (touches(config.public_surface).length > 0 && !files.includes(config.api_reference)) {
            errors.push(`a file that carries the public exports changed (${touches(config.public_surface)[0]}), but ${config.api_reference} did not.`);
        }
    }
    return errors;
}

export function readConfig() {
    const workflow = readWorkflow();
    const enforcement = workflow.enforcement ?? {};
    const specKit = workflow.spec_kit ?? {};
    return {
        baseline: enforcement.baseline,
        tracks: enforcement.tracks ?? [],
        source_paths: enforcement.source_paths ?? [],
        test_paths: enforcement.test_paths ?? [],
        changelogs: enforcement.changelogs ?? [],
        release_paths: enforcement.release_paths ?? [],
        protected_paths: enforcement.protected_paths ?? [],
        public_surface: enforcement.public_surface ?? [],
        api_reference: enforcement.api_reference ?? 'docs/api.md',
        spec_directory: specKit.directory ?? 'specs',
        spec_required: specKit.required ?? [],
    };
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT_DIR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const lines = (text) => text.split('\n').filter(Boolean);

function specDirectoriesAtHead(config) {
    const root = path.join(ROOT_DIR, config.spec_directory);
    return fs
        .readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
        .map((entry) => ({ name: entry.name, files: fs.readdirSync(path.join(root, entry.name)) }));
}

function commitsInRange(range, config) {
    const [base, head] = range.split('..');
    // Commits the baseline already contains predate this check and are not held to it.
    const exempt = config.baseline ? [config.baseline] : [];
    return lines(git('rev-list', '--no-merges', '--reverse', head, '--not', base, ...exempt)).map((sha) => ({
        sha,
        message: git('log', '-1', '--format=%B', sha),
        files: lines(git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha)),
    }));
}

function report(heading, errors) {
    console.error(heading);
    for (const error of errors) console.error(`  - ${error}`);
    console.error('See the tracks in workflow.ai.yml. A change belongs to the heaviest track it needs; it never moves down to skip stages.');
}

function main(argv) {
    const config = readConfig();
    const flag = (name) => {
        const at = argv.indexOf(name);
        return at === -1 ? null : argv[at + 1];
    };

    const messageFile = flag('--commit-msg');
    if (messageFile) {
        const message = fs.readFileSync(messageFile, 'utf8');
        const files = lines(git('diff', '--cached', '--name-only'));
        const errors = checkCommit(message, files, config);
        if (errors.length > 0) {
            report('commit-msg: this commit does not match the track it declares.', errors);
            return 1;
        }
        return 0;
    }

    const range = flag('--range');
    if (range && range.includes('..')) {
        const commits = commitsInRange(range, config);
        const errors = [];
        for (const commit of commits) {
            for (const error of checkCommit(commit.message, commit.files, config)) errors.push(`${commit.sha.slice(0, 7)}: ${error}`);
        }
        errors.push(...checkRange(commits, specDirectoriesAtHead(config), config));
        if (errors.length > 0) {
            report(`${commits.length} commit(s) in ${range} do not match the tracks they declare.`, errors);
            return 1;
        }
        console.log(`${commits.length} commit(s) in ${range} match the tracks they declare`);
        return 0;
    }

    console.error('usage: check-track.mjs --commit-msg <file> | --range <base>..<head>');
    return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (error) {
        console.error(`check-track: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Points git at the versioned hooks in `.githooks/`.
 *
 * `.git/hooks` is not versioned, so a hook written there exists on one machine and nowhere else.
 * `core.hooksPath` moves the hook directory into the repository, where a clone picks it up as soon
 * as this script is run once.
 *
 *   node scripts/install-hooks.mjs
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS_DIR = '.githooks';

const hook = path.join(ROOT_DIR, HOOKS_DIR, 'pre-commit');
if (!fs.existsSync(hook)) {
    console.error(`Missing ${HOOKS_DIR}/pre-commit. Nothing to install.`);
    process.exit(1);
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT_DIR, encoding: 'utf8' }).trim();

git('config', 'core.hooksPath', HOOKS_DIR);

// Windows checkouts do not carry the executable bit, and git only runs a hook it can execute.
try {
    git('update-index', '--chmod=+x', `${HOOKS_DIR}/pre-commit`);
} catch {
    // The file may not be tracked yet on a first install; the mode is set when it is committed.
}

console.log(`core.hooksPath set to ${HOOKS_DIR}`);
console.log('The pre-commit gates now run on every commit in this clone.');
console.log('Document gates always run; the suites run when their toolchain is reachable.');

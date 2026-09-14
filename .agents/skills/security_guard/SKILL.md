---
name: security_guard
description: Use when adding a dependency, changing what the tarball contains, or touching the lockfile, install scripts or the publish gate. Covers supply chain policy and publish safety. Exploit classes in code - XSS, injection, sandboxing, prototype pollution, the dev server - are in application_security.
---

# Supply Chain & Publish Safety

The code-level rules (banned APIs, escaping, sandboxing, the development server) live in
`.agents/skills/application_security/SKILL.md`. Both skills are blocking.

## Zero runtime dependencies

`dependencies` is empty and stays empty. React is a peer dependency, and an optional one.

This is not minimalism for its own sake. Every runtime dependency is a version this package can
force onto a consumer's tree, a package whose maintainer can change, and a transitive surface
nobody audited. A grid is not worth a resolution conflict or a compromised transitive.

Adding one requires a decision recorded in the feature's spec, naming what it does that cannot
reasonably be written here. `scripts/check-exports.mjs` fails the build if `dependencies` is not
empty, so the decision has to be deliberate.

Dev dependencies are held to a lower bar but not to none: prefer well-known tools, pin major
versions, and read what a new one adds to the lockfile.

## Nothing runs on install

No `preinstall`, `install` or `postinstall` scripts. A consumer installing a grid should not be
executing our code before they have imported anything.

## What must never enter the tarball

`files` is an allowlist for a reason. Verify with `npm pack --dry-run` and read the output:

- No `.env`, no credentials, no internal URLs.
- No `specs/`, `.agents/`, `tests/` or `src/`.
- Source maps are fine; source maps whose sources field embeds an absolute path from a developer
  machine are an information leak worth checking after a build config change.

## The lockfile and the registry

- `package-lock.json` is committed and `npm ci` is what CI installs from, so a dependency cannot change
  underneath a build.
- Read what a lockfile diff adds before approving it; a dev dependency that pulls a new transitive
  with an install script is a supply-chain change even though it never reaches the tarball.
- `.npmrc` must not weaken integrity checks (`strict-ssl=false`, a non-https registry).

## Row data is untrusted

Rows are attacker-influenced input. The rules for rendering and exporting them are in
`application_security`, and they are enforced by `scripts/security-audit.mjs`.

## The skills themselves are input

`scripts/validate-skills.mjs` scans every SKILL.md for leaked credentials, prompt-injection
patterns and unsafe path references, and it blocks the commit. Skill files are instructions that
agents follow without review, which makes them worth scanning exactly as carefully as code.

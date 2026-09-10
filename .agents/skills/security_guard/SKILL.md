---
name: security_guard
description: Use when adding a dependency, changing what the tarball contains, or rendering values that came from a server. Covers supply chain policy and the attack surface a grid actually has.
---

# Supply Chain & Publish Safety

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

## Row data is untrusted

Rows come from a server, so they are attacker-influenced input.

- Render values as text. React escapes by default, and the moment someone reaches for
  `dangerouslySetInnerHTML` in a cell renderer, that guarantee is gone for every consumer of the
  package.
- The default cell renders `column.getText(row)`, which produces a string. Keep it that way.
- Do not interpolate a row value into a URL, a CSS value or an attribute without encoding it.

## The skills themselves are input

`scripts/validate-skills.mjs` scans every SKILL.md for leaked credentials, prompt-injection
patterns and unsafe path references, and it blocks the commit. Skill files are instructions that
agents follow without review, which makes them worth scanning exactly as carefully as code.

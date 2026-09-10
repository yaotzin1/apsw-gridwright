---
name: release
description: Use when cutting a release, choosing a version number, or changing what the published tarball contains. Covers the publish gate and the irreversibility of npm.
---

# Release & npm Publishing

## Publishing is close to irreversible

A version can be unpublished for 72 hours and never republished under the same number. Treat every
publish as permanent, and treat the gate below as the thing standing between a mistake and a
permanent one.

## The gate

```bash
npm run verify
```

That runs skill validation, the doc sync check, typecheck, lint, both test suites, the build, the
dist-level smoke suite and the packaging audit. It is wired to `prepublishOnly`, so `npm publish`
cannot proceed without it. Do not reach for `--ignore-scripts` to get past a red gate.

## Choosing the number

The classification is decided in the spec, at stage 3, before the code is written. See the
`api_surface` skill for the table. At release time you are recording a decision, not making one.

Pre-1.0 does not mean anything goes. Consumers install `^0.1.0` and expect `0.1.x` not to break
them. Use `0.2.0` for a breaking change while below 1.0, and say what broke.

## The changelog is for the consumer

Each entry answers three things: what changed, does it affect me, what do I do about it. Group by
Added, Changed, Fixed, Removed. A breaking change gets a migration line with the before and the
after, not just a note that a signature changed.

## What ships

`files` in `package.json` controls the tarball: `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`.
Verify with:

```bash
npm pack --dry-run
```

Read the file list. Nothing from `src`, `tests`, `specs` or `.agents` belongs in it, and a stray
`.env` or a source map pointing at an absolute local path is a leak rather than a nuisance.

## After publishing

Tag the commit, push the tag, and confirm the published version resolves:

```bash
npm view apsw-gridwright versions
```

---
name: release
description: Use when cutting a release, choosing a version number, pushing a tag, or changing what the published tarball contains. Covers the publish gate, the tag that publishes, and the irreversibility of npm.
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

That runs skill validation, the doc sync and workflow checks, typecheck, lint, both test suites, the
build, the dist-level smoke suite, the packaging audit and the security audit. It is wired to
`prepublishOnly`, so `npm publish` cannot proceed without it. Do not reach for `--ignore-scripts` to get past a red gate.

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

## A pushed tag is a publish

`.github/workflows/release.yml` runs on any pushed `v*` tag: it checks the tag against
`package.json`, runs `npm run verify`, and publishes with provenance. So the order is: merge the
release pull request, tag the merge commit on `main`, push the tag. Never publish from a laptop
and tag afterwards, and never push a tag the maintainer has not decided to publish.

The workflow authenticates through npm trusted publishing: npm exchanges the job's OIDC token for
a short-lived credential, so no token is stored in the repository or its secrets. It works only
while the package's trusted publisher on npmjs.com names this repository, `release.yml` and the
`npm-publish` environment; without it the publish step fails and nothing reaches the registry.
A run that failed for that reason can be re-run once it is configured, since the tag already
names the commit. Check which is true before pushing one:

```bash
gh run list --workflow release.yml --limit 3
npm view apsw-gridwright versions
```

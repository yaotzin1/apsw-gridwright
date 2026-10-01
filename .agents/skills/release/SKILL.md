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

## The procedure, step by step

### Bump and sync

```bash
npm version <patch|minor|major> --no-git-tag-version
```

Then update `VERSION` in `src/index.ts` to match. The packaging audit fails if they disagree,
because a bug report that names a version the code never carried is a bug report nobody can act on.

### Run the gate

```bash
npm run verify
npm pack --dry-run
node scripts/check-workflow.mjs --remote
```

Read the tarball listing: `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json`, and
nothing from `src`, `tests`, `specs` or `.agents`. The last command compares the checks GitHub
requires on `main` with `ci.required_checks`; a required check that no job produces blocks every
merge, and nothing in a commit can see it.

### Merge

Open the pull request, wait for the required checks, squash-merge. `main` must already contain
everything the tag will name.

### Tag, which publishes

```bash
git switch main && git pull --ff-only
git tag -a v<version> -m "v<version>"
git push origin v<version>
```

Pushing the tag runs `.github/workflows/release.yml`: it refuses a tag that does not match
`package.json`, runs `npm run verify`, and runs `npm publish --provenance`. **The push is the
publish decision.** It belongs to the maintainer; an agent pushes a tag only when asked to, and says
what the push will start. The workflow authenticates by npm trusted publishing (OIDC), so no token
is stored; it publishes only while the package's trusted publisher on npmjs.com names
`yaotzin1/apsw-gridwright`, `release.yml` and the `npm-publish` environment. Without that, the
workflow stops at the publish step and nothing reaches the registry.

Never `npm publish` from a working copy: it skips provenance, and it publishes whatever the working
copy holds rather than the commit on `main`.

### The second package: apsw-gridwright-mui

`packages/mui` publishes `apsw-gridwright-mui` from the same workflow, on its own tag prefix and its
own version line. Everything above applies to it, with these differences:

- **Its version** is `version` in `packages/mui/package.json`, bumped with
  `npm version <patch|minor|major> --workspace apsw-gridwright-mui --no-git-tag-version`. Its changelog
  is `packages/mui/CHANGELOG.md`.
- **Its tag** is `mui-v<version>`: `git tag -a mui-v0.1.0 -m "mui-v0.1.0"`. A `v*` tag never
  publishes it, and a `mui-v*` tag never publishes the grid.
- **The grid goes first.** Its peer range on `apsw-gridwright` (`^0.12.0` for 0.1.0) must already be
  satisfiable from the registry, or every consumer's install fails. The workflow refuses a `mui-v*`
  tag while no published grid version satisfies the range, so the order is: release the grid, wait
  for `npm view apsw-gridwright versions` to show it, then tag the MUI package.
- **Its trusted publisher** is separate: `apsw-gridwright-mui` on npmjs.com needs its own entry
  naming `yaotzin1/apsw-gridwright`, `release.yml` and the `npm-publish` environment. Setting it up
  is the maintainer's, once, on npmjs.com. If npm will not configure a trusted publisher for a
  package that does not exist yet, the first version has to be published by the maintainer by hand
  from a clean checkout of the tagged commit, and every later one goes through the workflow.
- **Check its tarball** as well: `npm pack --workspace apsw-gridwright-mui --dry-run` lists `dist`,
  `README.md`, `LICENSE`, `CHANGELOG.md` and `package.json`, nothing else.

### Confirm

```bash
gh run list --workflow release.yml --limit 1
npm view apsw-gridwright versions
```

### If something is wrong after publishing

Within 72 hours, `npm unpublish apsw-gridwright@<version>` and note that the number is burned
permanently. After that, publish a patch and deprecate the bad version:

```bash
npm deprecate apsw-gridwright@<version> "Broken export map, use <version+1>"
```

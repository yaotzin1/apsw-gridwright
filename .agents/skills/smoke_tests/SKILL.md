---
name: smoke_tests
description: Use before any release, and when changing the build, the export map or the package manifest. Covers the dist-level smoke suite and the packaging audit the unit tests structurally cannot perform.
---

# Built-Artifact Verification

The unit suite imports `src/`. It cannot see the artifact a consumer installs, and every packaging
failure lives exactly there.

## What ships broken with a green unit suite

- An `exports` entry pointing at a file the build never wrote.
- A CommonJS consumer with no types, because both conditions shared one `.d.ts`.
- React bundled into the core entry, so a Node consumer with no React installed crashes on import.
- Two copies of the engine, one per entry, so `instanceof GridwrightError` fails across the seam
  while both suites stay green.
- `dist` missing from `files`, so the published tarball contains nothing at all.

Each of those has shipped from a repository with a green test suite. That is what this layer is
for.

## The two commands

```bash
npm run test:smoke      # builds, then runs tests/smoke against dist/
npm run check:exports   # audits the manifest, the export map and the bundles
```

`vitest.smoke.config.ts` aliases `apsw-gridwright` and `apsw-gridwright/react` to the built files,
so the tests import the package specifiers a consumer would write.

## What the smoke suite must always cover

- Every documented entry point resolves and is callable.
- One full local grid and one full remote grid, driven end to end.
- The React component renders, sorts, searches and pages from the built bundle.
- `GridwrightError` is the same class through both entries.
- The stylesheet is present and still exposes `--gw-*` properties.

## What the packaging audit must always cover

- Every export condition resolves to a file that exists.
- Both module systems have their own types condition.
- The core bundle and every shared chunk contain no react import.
- `dependencies` is empty.
- `VERSION` matches `package.json`, so a bug report cannot name a release that never had it.

Add to these whenever a new packaging shape appears. The audit is cheap, and the failures it
catches are the expensive ones.

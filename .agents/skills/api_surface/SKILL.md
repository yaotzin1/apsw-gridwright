---
name: api_surface
description: Use when adding, renaming or changing anything exported, when editing the export map, or when deciding whether a change is a patch, a minor or a major. Covers semver classification and type entry points.
---

# Public API & Semver Steward

Everything exported from `src/index.ts` and `src/react/index.ts` is a promise to strangers. You
cannot see who depends on it, and you cannot fix their code.

## Classify before you write

| Change | Version |
| :--- | :--- |
| New optional field, new export, new plugin | minor |
| New required field on an existing options object | **major** |
| Renamed export, changed parameter order, changed return shape | **major** |
| Changed default value | **major** |
| Changed payload of an emitted event | **major** |
| Widened an accepted input type | minor |
| Narrowed an accepted input type | **major** |
| Bug fix with no signature change | patch |
| Changed a rendered class name | **major** in practice: consumers style against them |

A changed default is a major even though nothing fails to compile. That is precisely why it is
dangerous: the consumer's build stays green and their grid behaves differently.

## The type surface is part of the API

- Both module systems need their own types. `exports["."].import.types` points at `.d.ts` and
  `exports["."].require.types` at `.d.cts`. One shared file type-checks as ESM for both, and the
  CommonJS consumer then sees a shape that is not there.
- `scripts/check-exports.mjs` verifies every condition resolves to a file the build wrote. Run it
  through `npm run check:exports` after any change to the export map or the build config.
- **A new subpath needs a `paths` entry in `tsconfig.json` too.** The smoke suite and the examples
  import through the published specifiers, and without a mapping `tsc` falls through to `dist/`.
  That type-checks on a machine that has built and fails in CI, where typecheck runs first. It is
  why `npm run verify` empties `dist/` before it starts.
- A type that appears in an exported signature must itself be exported. A consumer who cannot name
  the type of an argument cannot write a wrapper around it.

## The ColumnValue alias

`ColumnValue` is `any`, deliberately, in exactly one place. A grid holds columns of different value
types in one array, and `unknown` cannot express that under `strictFunctionTypes`: a comparator
written for numbers is not assignable to one declared over `unknown`, so every typed column would
be rejected by the array that holds it. Do not spread `any` beyond that alias, and do not remove it
without a working alternative for heterogeneous arrays.

## Deprecating without breaking

Keep the old export, mark it `@deprecated` with the replacement named in the tag, forward it to the
new implementation, and remove it only in the next major. A deprecation that still works costs one
line; a removal costs every consumer an afternoon.

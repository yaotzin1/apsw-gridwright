# Tasks: Gridwright core

Ordered by dependency. All complete.

## Core

- [x] **T-01** `src/core/types.ts`: the complete public type surface, with `ColumnValue` documented.
- [x] **T-02** `src/core/values.ts`: `toText`, `compareValues`, `matchesFilter` over the operator
      vocabulary, with nullish values sorting last in both directions.
- [x] **T-03** `src/core/columns.ts`: resolution with closed-over accessors, duplicate-id refusal.
- [x] **T-04** `src/core/query.ts`: construction, normalisation, structural equality, page-reset
      policy including the sort case.
- [x] **T-05** `src/core/errors.ts`: `GridwrightError`, retryability by status, normalisation of
      anything thrown into a sentence.
- [x] **T-06** `src/core/emitter.ts`: typed events with a throwing listener isolated.
- [x] **T-07** `src/core/pipeline.ts`: stage ordering, the capability skip rule, stage failure
      contained.
- [x] **T-08** `src/core/engine.ts`: state, sequenced fetches with abort, the synchronous fast
      path, query and selection commands, plugin registry, page clamping after the total is known.

## Data sources

- [x] **T-09** `src/data/local.ts`: synchronous, declares nothing, `setRows` invalidates.
- [x] **T-10** `src/data/remote.ts`: any async function, backoff on retryable failures only, abort
      stopping the retry loop, `invalidate()`.
- [x] **T-11** `src/data/rest.ts`: parameter encoding, envelope tolerance, `X-Total-Count`, server
      error message extraction.

## Plugins

- [x] **T-12** Filtering, search, sorting and pagination as ordinary plugins, plus `corePlugins()`.

## Adapter

- [x] **T-13** `useGridwright`: engine ownership, `useSyncExternalStore`, Strict Mode rebuild,
      column signature, prop synchronisation.
- [x] **T-14** Context and the five parts, each usable on its own.
- [x] **T-15** `Gridwright`: the assembled composition, with the parts attached as statics.
- [x] **T-16** `labels.ts`: every visible string, `pageRange` as a function.
- [x] **T-17** `styles.css`: tokens, dark mode both ways, reduced motion, scroll containment.

## Tests

- [x] **T-18** Unit: values, query, columns, pipeline (65 tests).
- [x] **T-19** Unit: the local engine including page reset, shrinkage and selection (24 tests).
- [x] **T-20** Unit: the remote engine including capability negotiation, the stale-response race,
      aborts, retry policy and inexact totals (17 tests).
- [x] **T-21** Unit: the REST source, parameter and envelope handling (19 tests).
- [x] **T-22** Unit: third-party plugins, teardown, duplicate ids, listener isolation (9 tests).
- [x] **T-22b** Unit: plugin options, column comparator and filterFn overrides, remote backoff and
      abort during the wait (10 tests).
- [x] **T-23** React: rendering, sorting by mouse and keyboard, search, pagination, selection,
      custom cells, states, labels, Strict Mode, composition (21 tests).
- [x] **T-24** Smoke: the built package through its export map (7 tests).

## Build and packaging

- [x] **T-25** tsup: two entries, ESM and CJS, `.d.ts` and `.d.cts`, one shared chunk.
- [x] **T-26** `scripts/check-exports.mjs`: the packaging audit.

## Documentation

- [x] **T-27** README with both data paths, theming, plugins and the API tables.
- [x] **T-28** CHANGELOG 0.1.0.
- [x] **T-29** `specs/DEPENDENCY_MAP.md`.

## Stage 7 — Verification

- [x] `npm run verify` green end to end. Output in review.md.

# Tasks: view state and URL synchronization

Ordered by dependency. Core first, adapter second, documentation last. Each task independently
checkable.

## Core

- [x] **T-01** None: the engine already exposes `initialQuery`, `query:change` and `setQuery`.

## Data sources

- [x] **T-02** None: the add-on serializes `GridQuery`, the same object for every source.

## Adapter

- [x] **T-03** `src/react/url-sync/codec.ts`: `serializeGridQuery`, `parseGridQuery`,
      `formatSearchParams`, typed pieces, validation against the columns.
- [x] **T-04** `src/react/url-sync/adapter.ts`: the browser adapter, safe on the server.
- [x] **T-05** `src/react/url-sync/addon.tsx`: `urlSync()` — `setup`, `configure`, and the lifecycle
      component in `provide` (writes, debounce, push/replace, external changes, page re-apply,
      windowed navigation).
- [x] **T-06** Exports from `src/react/index.ts`.

## Tests

- [x] **T-07** `tests/unit/url-sync-codec.test.ts`: round trips, typed values, escaping, baseline,
      validation, hostile input (`__proto__`, huge sizes, bad operators).
- [x] **T-08** `tests/react/url-sync.test.tsx`: one fetch for a linked query, push and replace,
      debounce, Back and Forward, page re-apply, correction as replace, router adapter without
      subscribe, prefix, windowed navigation, Strict Mode.
- [x] **T-09** Smoke coverage: the new exports resolve through `apsw-gridwright/react`.

## Documentation

- [x] **T-10** `docs/url-sync.md`, `docs/api.md`, `docs/README.md`, README
- [x] **T-11** CHANGELOG entry under Unreleased
- [x] **T-12** `specs/DEPENDENCY_MAP.md` and the AGENTS.md repository map
- [x] **T-13** Examples: a URL sync switch in the playground, `urlSync()` in quickstart step 3 (the step switcher keeps `?step=` so a reload stays on it), and both adapters in `examples/react-remote/App.tsx`

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md

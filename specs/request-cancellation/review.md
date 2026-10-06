# Self-review: request cancellation and search debounce

> Written at stage 8, 2026-10-06. The specification, contract and plan were analysed at stage 5 (below);
> the seven answers and the verification output are for the change as implemented.

## Stage 5 analysis

- Breaks a published signature? No: one optional option. The `queryDebounceMs` timing change is recorded
  as a behaviour change of an opt-in, minor.
- DOM or React under the headless directories? No: `src/core` only gains scheduling.
- Does a built-in need something a third-party add-on could not reach? No: it is an option.
- Runtime dependency? No.
- Keyboard reachability or an announced state? Unchanged; one announcement test is planned.
- Per-row work on the hot path? No: one comparison per committed query.

## Stages run, and what stage 6 changed in the plan

Stages 1 to 5 were run earlier on this branch. Stage 6 returned to Plan, and the corrections are recorded in
`spec.md` ("Amendments at stage 6", C-8) rather than worked around:

1. **AC-10 and section 6** described a `loading` status during the wait. The engine publishes a debounced
   query with the status it had, and `useAnnouncement` depends on that. The criterion now states the
   existing behaviour.
2. **Section 5** said a source without `search` capability skips the fetch. Every query change fetches, a
   local source included, and `queryDebounceMs` already delayed both. The delay does not branch on capability.
3. **C-8**, found by operating the playground: `searchDebounceMs` is read when the engine is created, like
   `queryDebounceMs` and `keepPreviousData`. A live change needs a `GridApi` setter, which this spec does not
   add. Documented, and the playground remounts the grid with a `key`.

None touches `api-surface.md`: the option, its default and the delay formula are as written.
Stage 6 also put the engine tests in `tests/unit/engine-cancellation.test.ts` and
`tests/unit/datasource-abort.test.ts` instead of appending to `engine-remote.test.ts`; plan.md names them.

## 1. Boundary and layering

`src/core` gains `supersede()`, a search-only test and a delay choice. No DOM, no React; lint passes. The
React side only passes the option through `useGridwright`. It is not a plugin or an add-on, for the reason in
spec section 7. The playground's request counter lives in the example's mock source, not in the package.

## 2. The local/remote seam

The delay never branches on `capabilities` or `kind`. A source that resolves nothing (local array) and one that
resolves everything both fetch on every query change, and both are delayed by the same options; the docs say to
leave them unset for an array. No stage narrows rows, so no total changes.

## 3. Public surface and semver

Gained: `searchDebounceMs` on `GridEngineOptions`, `UseGridwrightOptions` and so on `<Gridwright />`. Lost:
nothing. Changed: when `queryDebounceMs` aborts the superseded request (at commit rather than when the
replacement starts). Classified **minor** in `api-surface.md` and `CHANGELOG.md`; no default changes. No new
type is exported, so both module conditions are unaffected; `npm run check:exports` passes.

## 4. Accessibility and i18n

No new control in the package and no new string. The playground adds a select and a button, both native and
labelled; its strings are page copy, not package strings. The live region was checked by a test that records
what it said while seven keys were typed: "Loading rows", then "Showing 1 to 3 of 7", once each.

## 5. Supply chain and packaging

No dependency. `npm pack --dry-run`: 35 files, 885.4 kB, no tests, specs or examples in the tarball.
`check:exports` and `security:audit` pass.

## 6. Honest output

No number is computed. No loading state is published for a source that answers synchronously, and the wait
publishes no state at all (AC-10). An abandoned request never reaches `fetch:error`, `onError` or the error
status (AC-09, tested with a fetcher that rejects with an `AbortError`).

## 7. Verification

Tests that would have caught the absence: nine of the 21 engine tests and four of the five React tests fail
when `src/core/engine.ts` is stashed. Tests that catch regression: the same files, run by `npm test`.

Operated in the real playground (Chrome, 2026-10-06), then every control returned to its default:

| Search debounce | Typed | Counter |
| :--- | :--- | :--- |
| 250ms | "invoice" (7 keys) | 1 request after the pause |
| none | "ada" (3 keys) | 3 requests, 2 abandoned |
| 800ms | "ad", then Next page 100 ms later | 1 request, carrying the term and page 2; none 1.5 s later |

Changing the control had no effect on a live grid until the `key` fix (C-8); that was found here, not by a test.

Mid-session the uncommitted tracked changes were discarded by a mistaken `git checkout -- .` and reapplied
from the session record, so the final `npm run verify` below was run on the reapplied tree, not carried over
from the earlier run. The playground pass above was made before that and uses character-identical example files.

```
> apsw-gridwright@0.14.2 verify
> npm run clean && npm run validate:skills && npm run sync:check && node scripts/security-audit.mjs --source
  && npm run typecheck && npm run lint && npm run test && npm run test:smoke && npm run check:exports
  && npm run security:audit

 Test Files  58 passed (58)
      Tests  1104 passed (1104)
 Test Files  3 passed (3)        (smoke, against dist/)
      Tests  30 passed (30)
exit code 0
```

# Plan: request cancellation and search debounce

## Modules touched

| File | Change |
| :--- | :--- |
| `src/core/types.ts` | `searchDebounceMs` on `GridEngineOptions` |
| `src/core/engine.ts` | `supersede()` (abort and invalidate the sequence) called from `commitQuery` and `performFetch`; `scheduleFetch(delay)` chooses the delay; a search-only test in `commitQuery` |
| `src/react/types.ts` | `searchDebounceMs` on `UseGridwrightOptions` |
| `src/react/useGridwright.ts` | pass it to the engine, beside `queryDebounceMs` |
| `tests/unit/engine-cancellation.test.ts` | the engine guarantees, AC-01 to AC-13 |
| `tests/unit/datasource-abort.test.ts` | AC-15 for REST and remote sources |
| `tests/react/search-debounce.test.tsx` | AC-16 through the real search box, Strict Mode included |
| `docs/data-sources.md`, `docs/api.md`, `README.md`, `CHANGELOG.md` | the contract, the option, the changelog |
| `examples/` | a "search debounce" control in the remote example, with a request counter, so it can be operated |
| `specs/DEPENDENCY_MAP.md` | the new spec |

## Where the behaviour lives

Architecture questions, in order: it is not DOM or React, so it is core. It is not a pipeline stage, because
it decides when the pipeline runs. It does not belong in `GridQuery`, because it is not part of the
query a source sees. It is a scheduling option of the engine, as `queryDebounceMs` is, and the adapter
passes it through. The local and remote seam is untouched: only a change that fetches is delayed.

## Design

1. `supersede()`: abort the in-flight request, clear it, and bump `requestSequence`. Bumping the sequence is
   what makes AC-08 true for a fetcher that ignores the signal. `performFetch()` calls it, so its
   behaviour is unchanged; `commitQuery()` calls it before scheduling.
2. `isSearchOnly(previous, merged)`: `merged.search !== previous.search`, and sort, filters and page size
   are equal, and the page index is equal or reset by the search change itself. Computed from the
   merged query *before* the page reset is applied, so a caller who moved the page explicitly is not a
   search-only change (AC-03).
3. `scheduleFetch(delay)`: `0` fetches now and clears the timer (AC-02); otherwise it restarts the single
   timer. One timer, so a later non-search change at `0` clears a pending search wait.
4. Status while waiting: untouched (AC-10). `supersede()` aborts and invalidates but publishes no state, so a
   `ready` grid stays `ready` and a `loading` one stays `loading` until the replacement starts.

## Trade-offs taken

- **Abort at commit rather than at fetch start.** Costs one behaviour change for `queryDebounceMs` users;
  gains a table that cannot show rows for a query the grid has left. Accepted (C-4).
- **A separate option rather than a facet map** (`debounce: { search: 300, filter: 0 }`). A map invites
  every facet; the pain is typing. The flat name stays, and a map can be added later without breaking it.
- **Trailing edge only.** A leading-edge fetch would send "i" and "invoice", which is the case being removed.

## Risks

| Risk | Mitigation |
| :--- | :--- |
| Aborting at commit leaves `loading` forever if no fetch follows | Every commit that changes the query schedules one; a `queriesEqual` no-op returns before `supersede()` |
| A search change on a local source is delayed | Same as `queryDebounceMs` today; the option is opt-in and the docs say to leave it unset for an array (spec section 5) |
| `url-sync` writes the search into the URL per keystroke | Unchanged: it listens to `query:change`, which still fires immediately |
| The announcer fires on the aborted request | The status is not changed during the wait, so the existing "waiting out a debounce" handling covers it; a test asserts one announcement |

## Out of scope for this change

Default debounce, de-duplication, caching, per-facet maps, leading-edge fetching.

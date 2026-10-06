# Tasks: request cancellation and search debounce

## Core

- [x] **T-01** `GridEngineOptions.searchDebounceMs` (`src/core/types.ts`).
- [x] **T-02** `supersede()` and the sequence bump; `performFetch()` uses it (`src/core/engine.ts`).
- [x] **T-03** `isSearchOnly` and `scheduleFetch(delay)`; `commitQuery()` supersedes then schedules.
- [x] **T-04** Engine tests: AC-01 to AC-13 in `tests/unit/engine-remote.test.ts` (a fetcher that ignores
      the signal; search then page; page then search; search and sort together; both options set;
      refresh clears the timer; destroy; two engines on one source; `fetchAllRows` survives a query change).

## Data sources

- [x] **T-05** `tests/unit/datasource-rest.test.ts`: the engine's signal reaches `fetch`, and an abort stops
      a retry delay, for the REST and the remote source (AC-15). No source code change expected.

## Adapter

- [x] **T-06** `searchDebounceMs` on `UseGridwrightOptions` and through `useGridwright` (`src/react`).
- [x] **T-07** `tests/react/search-debounce.test.tsx`: AC-16 through the real search box, Strict Mode,
      announcement count, `keepPreviousData` rows stay.

## Documentation and examples

- [x] **T-08** `docs/data-sources.md` Aborts section rewritten as the contract; `docs/api.md` option row
      and the `search()` note; README; `docs/react-playbook.md` where it recommends `queryDebounceMs`.
- [x] **T-09** CHANGELOG: Added (the option) and Changed (the opt-in timing).
- [x] **T-10** `specs/DEPENDENCY_MAP.md`.
- [x] **T-11** Examples: a search-debounce control and a request counter in the remote example, operated
      in the browser, every switch turned off again.

## Stage 7 and 8

- [x] `npm run verify`, `npm run test:smoke`, `npm run check:exports`, output in review.md
- [x] `review.md` answered against `.agents/rules/review.md`

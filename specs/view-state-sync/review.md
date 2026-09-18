# Self-review: view state and URL synchronization

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

Stages run: 1–2 (the draft spec was reviewed against the code and corrected, spec §9), 3 (plan,
api-surface, data-model, events, research), 4 (tasks), 5 (analysis, below and in §9), 6, 7, 8.

## 1. Boundary and layering

Nothing under `src/core`, `src/data` or `src/plugins` changed. The add-on lives in
`src/react/url-sync/`; `codec.ts` is pure and touches no DOM, and `adapter.ts` is the only file that
reads `location` or writes `history`. The engine is reached only through `initialQuery`,
`query:change`, `setQuery`, `setPage` and `getColumns`, all public, so a third-party add-on could
have written this one. The shell imports nothing new (`tests/smoke/tree-shaking.test.ts` passes).

## 2. The local/remote seam

The add-on serializes `GridQuery`, which is the same object for every source; nothing branches on
where the rows came from. The React tests run it over an in-memory array and over a recording
`DataSource`; the one-fetch guarantee is asserted against the latter. Typed filter values exist for
the remote side: a server receives `50`, not `"50"`, after a reload. The page correction relies on
`isTotalExact`, so a source without a total is never "corrected" and never mistaken for one.

## 3. Public surface and semver

**Minor.** Added to `apsw-gridwright/react`: `urlSync`, `URL_SYNC_ADDON`, `serializeGridQuery`,
`parseGridQuery`, `formatSearchParams`, and the types `UrlSyncOptions`, `UrlSyncAdapter`,
`UrlSyncHistoryMode`, `UrlSyncFacet`, `GridQueryParamsOptions`, `ParseGridQueryOptions`. Nothing
changed or removed; no existing default changed. Every type in a new signature is exported
(`GridQuery`, `ColumnDef`, `ColumnValue`, `Unsubscribe` from the core entry). Both module
conditions resolve types (`check:exports`). Recorded in api-surface.md and CHANGELOG.md.

## 4. Accessibility and i18n

The add-on renders no markup and no string, so it ships no messages. A linked sort or filter is not
announced on load (the shell asks no contributor about the first settled state); a Back that changes
the sort is announced like any sort. The search box resyncs after Back (tested). No keyboard path
changes.

## 5. Supply chain and packaging

No dependency, no new file in the tarball beyond the built bundles (`npm pack --dry-run`: 35 files,
718.9 kB). `check:exports` passes, including one shared module instance.

Security review questions:

1. **Untrusted inputs:** the URL's parameters — attacker-written, since a link is. They reach the
   engine's query (and so a remote source's request) and `history`. Every column id is checked
   against the grid's columns and its `sortable` / `filterable`; operators against a `Map` of the
   core set with their arity; `page` and `size` against a bounded integer pattern, and `size` against
   `maxPageSize`, so a link cannot request a million rows. `JSON.parse` runs on single value pieces
   only and anything but a scalar is refused. Results are built from known keys; nothing is keyed by
   a parameter name. The codec tests feed `__proto__`, `constructor`, `prototype`, nested objects,
   `1e999`, oversized pages and malformed entries.
2. **Strings that become a URL:** the query string, built by `URLSearchParams` and
   `formatSearchParams` (`encodeURIComponent` with `:` and `,` restored, both legal in a query), set
   on a `URL` built from `location.href` with only `search` replaced, so the path and origin cannot be
   influenced. No markup, selector, style or script is built.
3. **New extension point:** `UrlSyncAdapter`, which the consumer writes; it receives parameters and
   hands them back. It reaches nothing a consumer's own component could not.
4. `scripts/security-audit.mjs`: no findings for source, manifest and `dist`.

## 6. Honest output

Nothing is computed for display. A link past the last page is corrected by the engine from a total it
received, and only when that total is exact.

## 7. Verification

`npm run verify`, exit 0 (2026-09-18):

```
.claude/skills is in sync (16 skills)
AGENTS.md and GEMINI.md are in sync (4 tracks, 8 stages, 16 skills, 8 gates, 14 rules)
workflow.ai.yml matches the repository
security audit: no findings (source, manifest)
> tsc --noEmit                      (no output)
> eslint .                          (no output)
 Test Files  41 passed (41)
      Tests  734 passed (734)
 Test Files  2 passed (2)           (smoke, against a fresh dist/)
      Tests  28 passed (28)
the published package resolves cleanly.
security audit: no findings (source, manifest, dist)
```

New tests: `tests/unit/url-sync-codec.test.ts` (21), `tests/react/url-sync.test.tsx` (21), one smoke
case. Two found real defects during stage 6: a synchronous source's page correction happened before
the listener existed (now reconciled on subscribe, spec §8), and my own spies leaking across tests.

Manual, in Chrome against the playground (`npm run example`, the **url sync** switch): sorting wrote
`?sort=salary:asc` without a history entry; Next page pushed one (`&page=2`); the browser's Back
returned to page 1, still sorted; opening
`?sort=nope:asc,salary:desc&size=5000&page=3&q=an` applied page 3, the salary sort and the search,
dropped the rest and rewrote the URL to `?q=an&sort=salary:desc&page=3`; the tree grid wrote
`team_sort=name:asc` beside the flat grid's parameters; with the switch off again, paging left the URL
alone. No console errors.

## Known gaps

- **Server rendering with the default adapter** renders the starting view on the server and the
  linked view on the client. A router adapter reading the request's parameters avoids it; the default
  cannot read a request it is not given.
- **An add-on listed after `urlSync()` that replaces `initialQuery` outright** would discard the
  linked query. None of the built-in ones does; `after`/`before` exist if one ever needs to.
- **A filter value that is not a scalar** (an object, a `Date`) is left out of the URL. Worth
  revisiting if a built-in filter type ever produces one.
- **A hand-written link to a page under windowed navigation** is applied once at mount; the page is
  never written back.

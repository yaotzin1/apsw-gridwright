# Self-review: column virtualization

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

The arithmetic is in `src/core/virtual-columns.ts` and imports nothing: no DOM, no React. The add-on is in
`src/react/virtual/columns.tsx`. The two seams it needed (`columnWindow`, `columnGeometry`) are added to the
public contract, and the shell reads the window through exported helpers (`columnWindowOf`,
`renderedColumnsOf`), so a third-party add-on can publish a window and be rendered the same way
(`tests/react/third-party-addon.test.tsx`, `tests/react/virtual-columns.test.tsx`). No built-in imports a
private path from another feature; `cellNavigation()` reaches the window through `useVirtualColumnScroll`
and `columnWindowOf`.

## 2. The local/remote seam

Untouched. Column windowing renders; it changes no query facet, no engine state, and asks the source
nothing. With `virtualRows()` and a windowed source, both windows work over the one scroll container.

## 3. Public surface and semver

Minor, as `api-surface.md` lists: one add-on, three core functions, optional contract fields, an optional
`GridCell` prop, exported helpers. A grid without the add-on renders the same markup (tested: no
`aria-colcount`, no `aria-colindex`, no gap). Two corrections change behaviour and are listed there for
review: every wrapper ref is now set rather than only the last, and fixed-layout header content no longer
widens its column. Neither changes a default.

## 4. Accessibility and i18n

No new control, no new string. `aria-colcount` on the table and the true `aria-colindex` on every mounted
cell under a window; gap cells are `aria-hidden`. With `cellNavigation()`: moving to an unmounted column
scrolls to it and focuses it (End reaches column 500 in the tests and in the browser), and the grid keeps
exactly one Tab stop when the cursor's column is scrolled away; that fallback reads the current window
rather than the previous render, which a first version got wrong (a window move re-renders once, so a
previous-render fallback left no stop at all).

## 5. Supply chain and packaging

No dependency added. No file added to the tarball beyond source compiled into the existing entries. The
export map is unchanged; the new names are in the existing `apsw-gridwright` and `apsw-gridwright/react`
entries. `npm run check:exports` and the smoke suite are pending (below).

## 6. Honest output

Every performance number in the README, the CHANGELOG and `docs/virtualization.md` comes from
`research.md`, which says how it was measured and on what. The playground demo shows live counts read
from the DOM, not computed ones.

## 7. Verification

What ran, where this was written (npm's registry was unreachable from the sandbox, so `node_modules`
could not be installed):

- Pure-Node gates, all passing: `validate-skills`, `sync-claude-skills --check`, `sync-agent-docs --check`,
  `check-workflow`, `security-audit --source`.
- `tests/unit/virtual-columns.test.ts`: 18/18, run under Node against the real source with a minimal
  `vitest` stand-in.
- `tests/react/virtual-columns.test.tsx`: 16/16, and the two new cases in
  `tests/react/third-party-addon.test.tsx`: 2/2, run in Chromium (Playwright) against the real source with
  minimal `vitest` and `@testing-library/react` (`render`, `act`) stand-ins.
- TypeScript: `src/core` and the core entry typecheck clean with `tsc` 6.0 under the repository's
  settings. The adapter was checked against a loose stand-in for React's types, and the set of errors is
  identical to the untouched code's under the same stand-in (no new error).
- End to end in Chromium at 500 × 10,000: header and body aligned at every scroll position, table width
  equal to the sum of declared widths at every position, keyboard reaching every column, pinned column
  mounted and sticky.

Not run, and required before merging:

```
npm ci && npm run verify     # typecheck, lint, unit + react suites, build, smoke, check:exports
```

The existing React suites (notably `cell-navigation*.test.tsx`, `grouping.test.tsx`, `column-layout*.test.tsx`)
exercise code this change touched and have not been run against it.

## Known gaps

- `virtualColumns()` re-renders the grid when the window's edges move, about once per column crossed. At
  fling speed that is 2–3 ms of script per frame. A per-row subscription could cut it further; not done
  without a measurement showing the need.
- A cell can be focused under a pinned column when the browser scrolls it into view natively; the add-on's
  own `scrollToColumn` keeps clear of pinned columns, the browser's focus scroll does not. Same as without
  windowing.

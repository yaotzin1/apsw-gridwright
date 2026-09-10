# Self-review: Gridwright core

## 1. Boundary and layering

`src/core`, `src/data` and `src/plugins` reference no DOM global and no React import; the ESLint
config enforces it and the packaging audit confirms the built core bundle and the shared chunk
contain no `react` import. Imports point one way, with one intentional exception: `engine.ts`
imports `corePlugins` for its default plugin set. The plugins depend only on core types, so there
is no cycle at the type level.

Sorting, filtering, search and pagination are plugins, not engine features. A test installs only
`sortingPlugin()` and confirms pagination simply does not happen, which is the proof that the
built-ins hold no privileged position.

## 2. The local/remote seam

Every query facet is covered on both sides. `tests/unit/engine-remote.test.ts` asserts that a
source declaring `sort: true` has its page left untouched, and that a source declaring
`paginate: true` alone has its page sorted in memory. The pipeline test asserts the skip rule
directly with a spy.

Narrowing stages return an updated total. Pagination runs last, so the total counts matches. A
paginating source with no total reports `isTotalExact: false`, and the range renders "of many"
rather than a number computed from one page.

## 3. Public surface and semver

This is the initial surface, recorded in full in `api-surface.md`, including every default. Both
module conditions carry their own types, every type in an exported signature is exported, and
`VERSION` is checked against `package.json` by the audit.

`ColumnValue` is `any` in one documented place, with the reason. It is the only `any` the lint
config permits in `src/`.

## 4. Accessibility and i18n

The sort control is a real button reached by Tab, asserted in a test that tabs to it and presses
Enter. `aria-sort` is on the header cell with `ascending`, `descending` and `none`. Loading, empty
and error render inside the table so the header holds. The error is `role="alert"` and offers retry
only when the failure is retryable. A visually hidden live region announces loading, and the page
range is `aria-live`.

All sixteen visible strings are in `defaultLabels`, and a test replaces two of them with Polish to
prove the path works. `pageRange` is a function because word order around numbers differs by
language.

## 5. Supply chain and packaging

`dependencies` is empty and the audit fails the build if it is not. React is an optional peer
dependency. No install scripts. `files` lists `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, and
CI refuses a tarball containing anything from `src`, `tests`, `specs` or `.agents`.

The smoke suite confirms `GridwrightError` is one class across both entries, which is the failure
that code splitting exists to prevent and that no unit test could see.

## 6. Honest output

No number is displayed that the grid computed rather than received. A synchronous source publishes
no loading state. A failure surfaces the server's own sentence when it wrote one, and the retry
button appears only when retrying could plausibly help. No decorative elements, no placeholder
charts.

## 7. Verification

```
Test Files  10 passed (10)
     Tests  141 passed (141)

Test Files  1 passed (1)     [smoke, against dist/]
     Tests  7 passed (7)

typecheck   exit 0
lint        exit 0
check-exports  the published package resolves cleanly.

Coverage   93.5% statements, 86.0% branches, 92.3% functions
           thresholds 85 / 80 / 85
```

## Known gaps

- **No virtualization.** Named as a non-goal. A grid rendering thousands of rows at once is answered
  by server pagination. Revisit if a consumer demonstrates a case where neither pagination nor
  server-side filtering applies.
- **The `TRANSFORM` stage slot is unused.** It exists for grouping and aggregation, which are not
  in this release. The slot is reserved so that adding them later does not renumber the others.
- **No adapter besides React.** The core is framework-agnostic to make Vue and Svelte adapters
  possible; whether the parts decompose cleanly for a template-driven framework is untested.
- **Filter semantics are implemented but not published as a server-side reference.** A server
  implementing `contains` differently from `matchesFilter` produces results that differ between a
  local and a remote grid. Worth a document before 1.0.

# Self-review: warn when a query covers only the page received

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

Stages run: 1 and 2 (the spec and its clarifications), 3 (api-surface; the other planning artifacts are
named as not written in the spec), 5 (analysis, below), 6, 7, 8. Stage 4 was skipped: one step.

## 1. Boundary and layering

The check is a function in `src/core/engine.ts`. It uses `console.warn`, which `src/core/values.ts` and
`src/data/capabilities.ts` already use, and `globalThis`, so no `document`, `window` or `react` appears
under the headless directories. The React side forwards one option in `useGridwright` and declares it on
`UseGridwrightOptions`. Nothing a third-party add-on could not do is used.

## 2. The local/remote seam

The point of the feature is the seam. It reads `dataSource.capabilities` and the query, the same two
inputs the pipeline reads, so it can only disagree with the pipeline about whether a facet ran on a page
if the two were reading different things. They are not: both are evaluated in `applyResult` against the
query the rows were fetched for. An array (`paginate: false`) and a source that declares every facet are
silent, which the tests assert for a local source, the default remote source and the windowed source.

## 3. Public surface and semver

**Minor.** One optional field, `warnOnPageScopedQuery`, on `GridEngineOptions` and `UseGridwrightOptions`.
No export added, none changed in signature, none removed. See `api-surface.md` for why the new default is
listed although it changes no data.

## 4. Accessibility and i18n

Nothing rendered, nothing announced, no label added. The message is a developer diagnostic on the console
and, like the existing capability warnings, is English and untranslated by design.

## 5. Supply chain and packaging

No dependency, no file in the tarball, no export-map change. `npm run check:exports` and `test:smoke`
pass.

## 6. Honest output

The warning states what happened (which facet, how many rows) and what to do, and does not claim the
result is wrong: page-only is sometimes the intent. It does not fire for a facet the query never used, so
it is not noise on a read-only paged grid. The examples that demonstrate page-only on purpose say so in a
comment and pass the option, rather than leaving a console line in a demo.

## 7. Verification

`tests/unit/page-scoped-warning.test.ts` (25 cases: each facet, once-only, all three together, the row
count, the source kind, replacement source, declared facets, array, windowed source, the option, production
and non-production `NODE_ENV`) and `tests/react/page-scoped-warning.test.tsx` (3 cases through the
component, including that sorting still happens with the warning off).

```
npm run typecheck   ok
npm run lint        ok
npm test            78 files, 2956 passed
npm run test:smoke  ok
npm run check:exports ok
```

The full `npm run verify` output is in the pull request.

## Known gaps

- The warning is console-only. A visible note in the interface that a search covers the page is a separate
  feature with copy and accessibility work, and the condition that would justify it is a consumer asking for
  it or a report of a reader misled by exactly this.
- A runtime that has no `process` and ships a production build warns anyway. Detecting that needs a build
  define the core cannot assume; the cost is one line in a console nobody watches.

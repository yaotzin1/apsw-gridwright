# Self-review: unified options, virtualization and windowing

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

The core gained one file, `src/data/windowed.ts`, which is a data source: no `document`, no
`window`, no React, enforced by the lint config rather than by discipline. Everything visual is
under `src/react/`.

Nothing was added to `STAGE_ORDER`. Virtualization is not a transformation of the row set, so
making it a stage would have put a rendering decision inside the pipeline, where a headless consumer
would inherit it for no reason.

One thing to watch: `GridVirtualBody` imports `WINDOW_OFFSET_META` from `src/data/windowed.ts`, so
the adapter references a constant defined beside a source. The alternative was to move the constant
into `core/types.ts`, which would put a windowing detail into the file every consumer's types come
from. A single string constant crossing the line is the smaller cost, and it is recorded in
`DEPENDENCY_MAP.md` rather than left to be discovered.

## 2. The local/remote seam

Both sides were implemented and both are tested.

A local array with `virtual` renders a window over the pipeline's own output: the pipeline still
filters, searches, sorts and paginates, and `pageSize` becomes the size of the data window rather
than a page anyone navigates. A windowed source declares `paginate: true` always, so the pagination
stage never slices a window that was already exactly the window asked for.

No new code branches on where rows came from. The virtual body reads `state.totalRows` and
`state.rows` exactly as the ordinary body does; the only thing it additionally reads is where the
held rows start, and that is published in `meta` by whatever source knows.

## 3. Public surface and semver

Minor. Six optional props, one optional column field, two optional `GridTable` props, and new
exports. No signature changed, nothing was removed, and no default changed, so a 0.3.0 grid renders
identically under 0.4.0.

`TreeGridwright` keeps its props and behaviour and lost its own implementation. That is invisible to
a consumer's type-checker and to their rendered output, and it is the change that makes a tree able
to use windowing, row menus and icons at all.

`createWindowedDataSource`, `GridVirtualBody` and `useVirtualRows` were added to the expected-export
lists in `scripts/check-exports.mjs`, so the smoke gate fails if any of them stops being reachable
through the export map.

## 4. Accessibility and i18n

`aria-rowcount` is the whole result set and `aria-rowindex` is the true position, which is the
entire reason spacer rows were chosen over absolutely positioned ones: the table stays a real
`<table role="grid">` with real rows, and column alignment survives.

A row whose block has not arrived is a real row marked `aria-busy="true"`, so it is announced as
loading rather than as an empty row.

Both new animations, the skeleton sweep and the menu's entry, are disabled under
`prefers-reduced-motion`. The menu's transform flips for right-to-left.

No new strings, so no catalog changed and no locale fell behind. Icons are `aria-hidden`, because
the text beside them already says what they say.

## 5. Supply chain and packaging

No dependency added, runtime or development. The virtualizer is arithmetic plus one
`ResizeObserver`, and the windowed source is a `Map`. Both entries still resolve under `import` and
`require`, and both still share one module instance.

## 6. Honest output

The claim on the box is "ten million rows", and it was checked in a browser rather than asserted:
row 10,000,000 rendered, two blocks cached, four hundred rows resident, two range requests.

Checking it is what found the browser's element height limit. Before that, `aria-rowcount` said ten
million while scrolling could only reach row 419,000, silently. That is precisely the class of
dishonest output this section exists to catch, and the fix is written down in `docs/virtualization.md`
with its cost rather than hidden: above the cap, one pixel of scrollbar covers more than one row.

The playground's counters read from the source itself (`cachedBlockCount`) rather than from a
number the page computed, so the panel cannot flatter the implementation.

## 7. Verification

```
> apsw-gridwright@0.4.0 verify
> npm run clean && npm run validate:skills && npm run sync:check && npm run typecheck && npm run lint && npm run test && npm run test:smoke && npm run check:exports

✨ All 15 skills validated successfully! (0 Security Threats / 0 Syntax Errors)

> tsc --noEmit
> eslint .

> vitest run
 Test Files  18 passed (18)
      Tests  297 passed (297)

> vitest run --config vitest.smoke.config.ts
 Test Files  1 passed (1)
      Tests  12 passed (12)

> node scripts/check-exports.mjs
  ok   core ESM entry exports 14 expected names
  ok   core CommonJS entry matches the ESM entry
  ok   VERSION matches package.json (0.4.0)
  ok   react ESM entry exports 11 expected names
  ok   both entries share one module instance

the published package resolves cleanly.
```

Plus a manual pass over the playground in Chrome: every switch and every combination, the
ten-million-row demo scrolled to its last row, and an edit committed over the windowed source with
the block cache dropped and refetched.

## Known gaps

- **Variable row heights.** `rowHeight` is a contract, and a row that wraps overflows its slot. A
  measuring virtualizer is the fix, and it is a different piece of work with a different performance
  profile. Justified when a consumer needs wrapped text in a virtualized grid.
- **Select-all over a windowed source** means "everything loaded", because the ids of unfetched rows
  are not known. Justified when selection can be expressed as a predicate rather than a set.
- **Row-exact keyboard movement in scaled mode.** Arrow keys move finer than one pixel above the
  height cap. Justified when the grid owns focus movement, which it does not yet.
- **The diagnostic panel in the playground polls.** Block counts are the source's own state, not
  grid state, so nothing publishes a render when a block lands. Exposing them as grid state would
  make every consumer render for a number only a diagnostic wants.

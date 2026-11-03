# Research: framework-neutral adapter architecture

## What was measured (2026-10-31, `src/react`)

- `sorting.tsx` is a good sample of the split: `ariaSortOf`, `sortAnnouncement`, `sortTitleOf`,
  `sortPriorityOf` and `toggleSort` are neutral; the only React is `SortButton`, a `<button>` with a
  label, an indicator and a priority badge. As a node description that is about fifteen lines.
- `src/react/core-addons/{sorting,pagination}-logic.ts`, `a11y/announcement.ts` and
  `addons/resolve.ts` import no React runtime. `selection-logic.ts` imports React *types* only.
- 36 files under `src/react` call a React state or lifecycle hook. They are spread over 18 directories,
  which is why a single "wrap the hooks" fix would not do: add-on state is the real coupling.
- `AddonContribution` has about thirty fields. Roughly half are data or attribute maps (neutral once the
  HTML types are structural); the slots are `ReactNode`; `setup` and `provide` assume React.
- `apsw-gridwright/react` loads React at import, so helpers exported from it are unreachable without
  React. Moving them is necessary but, on its own, insufficient.

## Prior art (from knowledge, not re-verified here)

- TanStack Table: headless core with per-framework adapters that bind state and leave rendering to the
  user. Adapters stay thin because the table model is built in core. Closest in spirit to this plan.
- Lit/Stencil style web components: portable, but one runtime inside every host and shadow DOM styling.
- Hyperscript-style node descriptions (`h(tag, attrs, children)`) are what Preact, Vue and Solid all
  accept in some form, so a plain-data node maps to each without a library.

These are recalled, not checked; treat them as context for the design, not as claims for the docs.

## Open technical questions

1. **Is a data-only node expressive enough?** The sort button needs a handler, a title and children, all
   expressible. A pagination page-size `<select>` needs controlled value semantics, which frameworks
   handle differently. The stage 4 slice and the pagination task test this.
2. **Controlled inputs.** The select-all checkbox is indeterminate; `indeterminate` is a DOM property,
   not an attribute. The node description needs a `props` channel or a rule for it (React sets it in a
   ref effect today).
3. **Focus.** Returning a focus *action* works for known targets (table, header cell). Focus on an
   element a consumer's `component` rendered needs an id the renderer can resolve.
4. **Measurement.** A baseline of render time and allocations for the 10 000-row and 500-column fixtures
   must be recorded before T-12, so AC-11 compares against a number rather than a feeling.
5. **Hydration and SSR** are renderer concerns; the view layer touches no browser global, so it does not
   block them.

## Deliberately not researched

Packaging of future adapters (workspace or separate repository) and which framework comes first. Neither
changes the architecture, and deciding early would pull the work back toward building one adapter.

## Baseline before any change (T-02, 2026-11-02)

Measured with `npm run bench:render` (jsdom, median of 7 runs after one warm-up, Windows 11, Node 22).
Two runs in a row, to show the noise:

| Fixture | Mount | One sort, run 1 / run 2 |
| :--- | ---: | ---: |
| 10 000 rows x 12 columns, 50 per page | 41.8 / 40.6 ms | 13.6 / 13.3 ms |
| 10 000 rows x 12 columns, `virtualRows()` | 21.2 / 19.4 ms | 6.6 / 8.5 ms |
| 100 rows x 500 columns, `virtualColumns()` | 89.9 / 99.6 ms | 25.6 / 27.1 ms |

Noise is about 10 to 15 percent, so AC-11 reads "no slower than 20 percent over the same command on
the same machine". These are jsdom times, useful only as a ratio; the numbers on another machine
are not comparable. Allocations are not recorded: Node gives no stable per-render count, and the
mount time of the 500-column fixture is the proxy for the per-cell work the table model must not add.

### After T-11 (2026-11-02): sorting() written once and drawn by the React renderer

The protocol changed first. Seven samples after one warm-up put the median inside the JIT's transition: a
profile of the `virtualRows` fixture showed the same two commits per sort in both builds, with render time
swinging from 27 ms in run 3 to 4 ms in run 5 on the *unchanged* code, so an early comparison read as "twice as
slow" and was nothing of the kind. The bench now discards five warm-up runs and takes the median of eleven.
Medians of three invocations each, with the change and at its parent commit, same session:

| Fixture | Mount, change / parent | One sort, change / parent |
| :--- | ---: | ---: |
| 10 000 rows x 12 columns, 50 per page | 40.4 / 38.2 ms (+5%) | 15.2 / 14.3 ms (+6%) |
| 10 000 rows x 12 columns, `virtualRows()` | 27.6 / 27.2 ms (+1%) | 8.9 / 9.5 ms (-6%) |
| 100 rows x 500 columns, `virtualColumns()` | 105.6 / 108.6 ms (-3%) | 31.6 / 29.7 ms (+6%) |

All within 6 percent, against the 20 percent AC-11 allows. The numbers in the earlier tables came from the old
protocol and are kept as recorded; compare a build only against its parent measured the same way, in one session.

### After T-14 (2026-11-02): the live region runs through the view layer

Same protocol and session as the table above, three invocations each, medians. The hook that drives the live region
now delegates to `createLiveRegion`. Paged: mount 33.4 / 32.4 ms (+3%), one sort 11.3 / 11.5 ms (-2%). `virtualRows`: mount
21.3 / 21.2 ms (0%), one sort 6.7 / 6.9 ms (-3%). `virtualColumns`: mount 93.8 / 118 ms, one sort 27.1 / 27.2 ms (0%); the
parent's 500-column mount ranged from 100 to 162 ms across its three runs, so that row says only that the change is
not slower. No regression.

The rendered markup of five states is pinned by `tests/react/markup-baseline.test.tsx`
(a default page, sorted descending, multiple selection with a row selected, the second page, no
rows). The snapshot was committed before any code moved.

### After T-15 (2026-11-03): selection is the neutral add-on, adapted

`selection()` is written once in the view layer and the React `selection()` is that add-on through `adaptViewAddon`. A new
fixture, 10 000 rows x 12 columns, 50 per page, `selectionMode="multiple"`, then the select-page checkbox
(`npm run bench:render`), measures the checkbox column. Parent and change were run interleaved, four invocations each, on one
machine, from a git worktree of the parent commit so the working tree was never touched. Best (minimum) of the four
invocations' medians, mount / one change:

| Fixture | Parent | Change |
| :--- | :--- | :--- |
| paged 50, no selection column | 35.0 / 12.4 ms | 34.8 / 12.4 ms |
| `virtualRows` | 68.1 / 17.8 ms | 61.4 / 17.7 ms |
| `virtualColumns` | 440 / 162 ms | 435 / 162 ms |
| paged 50, selection checkboxes | 213.6 / 104.5 ms | 225.8 / 113.4 ms (+6% / +8%) |

Grids that do not use the checkbox column pay nothing measurable. With checkboxes the change reads 6 to 8 percent slower, and
**this does not settle AC-11**: the same fixture on the same code ranged from 48 ms to 278 ms between invocations here (the
machine was shared), so a gap this size is inside the noise in one direction and may be real in the other. T-17 must repeat it
on a quiet machine with more invocations. If it holds, the saving is known and cheap: each checkbox cell builds a render grid
and a closure per render in `NeutralSlot`, which one grid-level object per render would remove.

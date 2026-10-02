# Self-review: responsive layout

Answers to the seven questions in [`.agents/rules/review.md`](../../.agents/rules/review.md), written
2026-10-02 after Phase 1 and Phase 2 were implemented. What was checked is separated from what was not.

## 1. Boundary and layering

- The new code is `src/react/responsive/` (add-on, width provider, media hook, card controls, messages).
  Outside it, the adapter gained: `plugins/addons.tsx` (the touch trigger), `navigation/` (skip undrawn
  columns, card reading order), `addons/types.ts` and `useGridwright.ts` (`whenNarrow`, `containerWidth`,
  `viewHiddenColumns`, `cardLayout`), the stylesheet and the locale packs.
- Nothing under `src/core`, `src/data` or `src/plugins` changed, and `ColumnDef` is untouched (the
  `responsive` column option is a module augmentation of the React column type). Lint's headless rules pass.
- `responsive()` never takes the table wrapper's ref: it finds the root with `closest` from a zero-size
  sentinel. `virtualRows()` still holds the only ref.
- Honest deviation: the contract was written first for Phase 1 and amended after the code for `whenNarrow`,
  `containerWidth` and the touch trigger; Phase 2's additions were written into `api-surface.md` before the code.

## 2. The local/remote seam

- A width-hidden column stays in the engine. Tests: the cells are still rendered (hidden by attribute), a search for
  a value in the hidden column still finds the rows, a sort on it stays in force (`aria-sort`), and a server
  source is **not refetched** and is sent the same query across resizes and stacking
  (`the width never reaches the query`).
- Export of a width-hidden column: follows from the above (export reads the engine's columns, which are
  unchanged); there is no dedicated test that opens an export. Gap.
- `responsive()` has no branch on where rows come from.

## 3. Public surface and semver

Minor. All additions are optional or new names, and nothing existing changed meaning:

- `responsive(options)`, `RESPONSIVE_ADDON`, `responsiveMessages`, `useContainerWidth()`, `useMediaQuery()`;
  types `ResponsiveOptions`, `ColumnResponsive`, `AddonNarrowVariant`, `NarrowContribution`; the column option
  `responsive: { hideBelow }`; the contribution fields `whenNarrow`, `containerWidth`, `viewHiddenColumns`,
  `cardLayout`. `npm run check:exports` passes (react entry 70 names; core entry unchanged at 29).
- C-1 measured and decided (table below). C-6 confirmed by the maintainer: three-dot trigger.
- Visible changes for every grid, listed in the CHANGELOG: coarse-pointer control sizes, overlay clamping, the
  touch trigger on a no-hover device. The size container is opt-in and only for a grid that lists `responsive()`.
- Not checked: that an existing consumer's own CSS against `.gw-sort-button` and friends is unaffected by the
  coarse-pointer `min-block-size`. A consumer overriding those on touch could see a difference.

## 4. Accessibility and i18n

Checked: the grid role stays; rows, cells and headers carry explicit roles while stacked; header cells stay in
the document so a value has its header; `cellNavigation()` never stands on an undrawn column or the undrawn
header row and walks card values in reading order (tests); the sort control is two labelled selects; the three-dot
trigger has an accessible name from the row-actions messages and is a real button; the width-hidden sort/filter is
said in text. Strings: seven new `gridwright:responsive` keys and one `row-actions` key in en, de, es, fr, pl, and
`auditAddonMessages` covers all of them.

Not checked, and the main open risk: **no screen reader was used** (VoiceOver, NVDA, TalkBack). The AC-22
claim (label heard once, via the column header and a generated label with an empty alternative) rests on the
markup and the CSS Generated Content alt-text syntax, not on listening. The 44 px target (AC-04) is CSS and was seen
with the media query forced in a script, not on a coarse-pointer device. A card's three-dot button sits in the
top corner (CSS) and was seen only in a forced-media page.

## 5. Supply chain and packaging

No dependency added (`ResizeObserver` and `matchMedia` are platform APIs). `npm run check:exports` and the smoke
suite pass: the new names are in the export map for import and require, React did not leak into the core bundle,
the shared chunk is still one instance. `security-audit` is clean (no HTML or script sink, no new `postMessage`).
The `!important` in the stylesheet (pin cap, card alignment) overrides inline styles the grid itself writes; it is
not a security matter.

## 6. Honest output

Nothing is invented: a width-hidden column's active sort or filter is shown (`Sorted by X, hidden at this width`)
rather than dropped (C-5); a layout change is not announced as if the reader had acted (no live-region sentence
for resizing); no placeholder content. The column picker note for a hidden column (spec §5) is **not
implemented**. Gap.

## 7. Verification

`npm run verify`, 2026-10-02, after the last code change: exit 0.

```
Test Files  54 passed (54)      Tests  1050 passed (1050)
Test Files   3 passed (3)       Tests    30 passed (30)        (smoke, against dist/)
ok   core ESM entry exports 29 expected names
ok   react ESM entry exports 70 expected names
the published package resolves cleanly.
security audit: no findings (source, manifest, dist)
```

One earlier full run failed a single unrelated `cellNavigation()` windowed test; it passed on 8 reruns of the
file and on two more full runs. Cause not found: treated as a timing flake.

Browser (Chrome, via the playground with the real stylesheet; the tab must be visible or the observer never fires):

- 375 px and 320 px, stacked cards: hidden columns stay hidden, labels align, no horizontal page scroll, Sort by
  control present. 375 px, columns only: Job title and Email drop out.
- Touch events replayed on the three-dot trigger: one tap opens the pinned menu; one tap on an item runs it; the row
  is not selected.
- **Not done:** 768 and 1280 px, dark mode and forced colours passes, a physical touch device, a screen reader.

## Stage 5 result: C-1 (headless Chrome, the real stylesheet)

| Parent | no containment | `container-type` on `.gw-root` | on inner wrapper | on root + `contain-intrinsic-inline-size` |
| :--- | ---: | ---: | ---: | ---: |
| inline-block | 290 px | **0** | 2 | 480 |
| float | 290 px | **0** | 2 | 480 |
| flex item, no min-width | 290 px | **0** | 2 | 480 |
| block | 1000 px | 1000 | 1000 | 1000 |

Decision: no containment on the default root; opt-in under `[data-gw-responsive]` with the intrinsic size
fallback (`--gw-responsive-fallback-width`, spec C-1).

## Defects found and fixed during the work

- The first touch trigger was limited to hover triggers; the default `both` and `contextmenu` had none on a phone.
- A touch's hover events opened an unpinned menu over the trigger and swallowed the tap (two taps needed).
- Arrow keys could land on a width-hidden column (found by reading the accessibility skill): `viewHiddenColumns`.
- The open row menu carries `data-pinned`, so the rules that release pinned columns (`[data-pinned]`) also forced it to
  `position: static` and dropped it to the bottom of the grid in a stacked layout. Scoped to `th`/`td`; a test guards it.
  The menu is also anchored to the three-dot button, not the row.
- The card layout's `display: grid` out-ranked `display: none` for hidden columns, and a column's inline
  `text-align` misaligned a card's label.

## Known gaps

- No screen-reader pass; no physical touch-device pass; 768 and 1280 px, dark mode and forced colours not viewed.
- The column picker note for a width-hidden column; an export test for a hidden column; the MUI showcase was
  type-checked and linted but not viewed in a browser.
- The stacked sort control sets the primary sort only: a multi-sort made through header clicks is replaced when the
  control is used.
- `apsw-site`: a Responsive section exists on a branch, unbuilt, waiting for the release.

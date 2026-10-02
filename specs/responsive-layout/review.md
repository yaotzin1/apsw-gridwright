# Self-review: responsive layout

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

> **Not yet written.** The feature is at stage 2 and no code exists, so there is nothing to review.
> Each heading below names the question stage 8 has to answer for this feature, so the review is not
> reinvented later. Replace this note and the prompts with the answers.

## 1. Boundary and layering

To answer: that `src/react/responsive/` is the only new code, that nothing under `src/core`,
`src/data` or `src/plugins` gained `window`, `document` or React, and that `ColumnDef` is unchanged.

## 2. The local/remote seam

To answer: that a width-hidden column is still sorted, filtered, searched and exported for a local
array and a server source alike, and that the width never reaches a query.

## 3. Public surface and semver

To answer: the six new names are exported and typed for `import` and `require`; the shrink-to-fit
result for C-1 and the maintainer's decision on C-6 (confirmed 2026-10-02: three-dot trigger) are recorded here.

## 4. Accessibility and i18n

To answer: the scroll region is keyboard reachable; the grid role and header survive stacking; a
label is announced once; the touch targets measure 44 px; all strings exist in five languages.

## 5. Supply chain and packaging

To answer: no new dependency (`ResizeObserver` and `matchMedia` are platform APIs); the smoke suite
finds the new exports through the export map; React did not leak into the core bundle.

## 6. Honest output

To answer: nothing is invented. A width-hidden column's active sort is shown, not silently dropped
(C-5); no layout change is announced as if the reader had done something.

## 7. Verification

```
<paste the actual output of npm run verify, and the browser pass at 320, 375, 768 and 1280 px>
```

## Stage 5 result: C-1 (2026-10-02, headless Chrome, the real stylesheet)

| Parent | no containment | `container-type` on `.gw-root` | on inner wrapper | on root + `contain-intrinsic-inline-size: auto 30rem` |
| :--- | ---: | ---: | ---: | ---: |
| inline-block | 290 px | **0** | 2 | 480 |
| float | 290 px | **0** | 2 | 480 |
| flex item, no min-width | 290 px | **0** | 2 | 480 |
| block | 1000 px | 1000 | 1000 | 1000 |

Decision: no containment on the default root; opt-in under `[data-gw-responsive]` with the intrinsic
size fallback (spec C-1).

## Phase 1 implementation notes (2026-10-02)

- Hiding is render-time (`data-gw-hidden`, `display: none`), not `ColumnDef.hidden`, so the engine, search
  and export keep the column. This also means no `columnSignature` contribution is needed: the plan's item 4
  is superseded.
- Browser pass in headless-equivalent Chrome via the playground: 375 px hides Job title and Email. A tab that
  is not visible runs no frames and the observer never fires (C-9); the pass needs a visible window.
- `whenNarrow` implemented (C-10): `responsive()` publishes `containerWidth` on its contribution; `useGridwright`
  swaps each add-on's narrow slots in after all `setup`s, so the listing order does not matter and the engine
  fields (`configure`, `plugins`, `columnSignature`, `provide`, `messages`) cannot be swapped.
- Built-in toolbar add-ons (search, filters, export, column picker): audited, all wrap with `flex-wrap` and the
  search takes the row under 30 rem; none needs a narrow variant.
- MUI: the views keep the `gw-*` classes, so wrapping and `--gw-touch-target` reach them; `shared-suites` re-runs
  `responsive.test` against `muiAddons()`. No peer-floor change, because the MUI package imports nothing new.
- The three-dot trigger first appeared only for hover triggers and needed two taps on touch; fixed (trigger on
  every no-hover device, the row's hover and click routes off there).
- Not done: the 320/768/1280 and dark/forced-colours pass, a physical touch device, `docs/accessibility.md`.

## Known gaps

- No suite can test the CSS (spec C-9). Until the browser pass is recorded here, the stylesheet
  behaviour is unverified, and the review says so rather than implying otherwise.

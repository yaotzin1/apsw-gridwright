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
result for C-1 and the maintainer's decision on C-6 are recorded here.

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

## Known gaps

- No suite can test the CSS (spec C-9). Until the browser pass is recorded here, the stylesheet
  behaviour is unverified, and the review says so rather than implying otherwise.

# Self-review: MUI integration

> **Not yet reviewed.** This feature is at stage 5; nothing is implemented. The seven answers are
> written at stage 8 against the code that ships. Until then, this file records what each dimension
> will have to answer, so the review cannot quietly skip it.

See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

To answer: no `@mui/*` import outside `packages/mui`, and the helpers in `*-logic.ts` import no
React.

## 2. The local/remote seam

To answer: the pagination view reads `isTotalExact` and `hasNextPage` and never branches on the
source (spec section 5).

## 3. Public surface and semver

To answer: api-surface.md as shipped, and the native core add-ons' output unchanged (T-03).

## 4. Accessibility and i18n

To answer: AC-11 passes; no string literal renders in the MUI views; MUI's own English never
renders; C-5 checked in RTL.

## 5. Supply chain and packaging

To answer: `apsw-gridwright`'s manifest is unchanged by MUI; the MUI package has no
`dependencies`; neither package inlines the other.

## 6. Honest output

To answer: "of many" with an unknown total, and never MUI's "more than N".

## 7. Verification

```
not run: stage 7 has not been reached
```

## Known gaps

- **MUI rows and cells.** The consumer's `components.MuiTableCell` and `MuiTableRow` theme overrides
  do not reach the grid's cells, only the tokens do. Justified when a consumer needs per-cell MUI
  styling that the tokens cannot express: that needs a seam replacing the shell's row and cell
  elements, and it would be its own spec.
- **The other add-ons' controls** stay native, themed by tokens. Each one's MUI view is a later
  minor of the MUI package.
- **Pigment CSS** (R-3) is untested.

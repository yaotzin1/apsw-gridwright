# Review: loading-indicators

> Written ahead of the work so the questions are on the page. Nothing below has been run.

## Stage 5 analysis (to run before stage 6)

- [ ] Does anything break a published signature without the right version? `AddonContribution` gains one optional field.
- [ ] Does anything put the DOM or React under the headless directories? Nothing here goes near `src/core`.
- [ ] Does a built-in need something a third-party add-on could not reach? The status-row slot is public.
- [ ] Does it add a runtime dependency? No: that is the point of drawing them in the package.
- [ ] Does it regress keyboard reachability or an announced state? Indicators are `aria-hidden`; the live region is untouched.
- [ ] Does it add per-row work to the hot path? The skeleton draws a capped number of rows, independent of data size.

## Open questions for the maintainer

1. ~~One package or a separate project~~ Settled 2026-10-16: one package.
2. Is `spinner` the right default variant, with `skeleton` opt-in?
3. Should the tree toggle's loading pulse later move onto `Spinner`?

## Stages run

Stage 1 (specify) and a first pass of stage 2 (clarify). Stages 3 to 8 not run.

## Checks to fill at stage 8

Boundary and layering, the local and remote seam, public surface and semver, accessibility and i18n, supply
chain and packaging, honest output, verification. Each as in `specs/density/review.md`.

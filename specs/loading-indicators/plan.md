# Plan: loading-indicators

## Modules touched

| File | Change |
| :--- | :--- |
| `src/react/addons/types.ts` | `StatusContribution.loadingRows?` |
| `src/react/parts/GridBody.tsx` | `GridStatusBody` renders `loadingRows` as the body's rows when an add-on provides it |
| `src/react/loading/` (new) | `addon.tsx`, `Spinner.tsx`, `spinners.tsx` (the four SVGs), `Skeleton.tsx`, `useDelayed.ts`, `messages.ts`, `types.ts`, `index.ts` |
| `src/styles/styles.css` | spinner and skeleton rules, the `--gw-spinner-*` and `--gw-skeleton-*` tokens, reduced motion, forced colours |
| `src/react/index.ts` | the new exports |
| `src/locales/{de,es,fr,pl}.ts` | `gridwright:loading-indicator` |
| `tests/react/loading-indicators.test.tsx`, `tests/unit/` | behaviour, accessibility, injection |
| `tests/smoke/tree-shaking.test.ts`, `scripts/check-exports.mjs` | the shell does not bundle it; the exports are audited |
| `examples/playground`, `examples/mui-showcase`, README, docs | with the implementation, at stage 8 |

## Where the behaviour lives

Adapter only. Architecture questions: it needs the DOM (SVG, timers), so it is not core; it changes no
query, state or pipeline, so it is not a plugin; it is an add-on contributing three existing slots and one new
optional field. The engine's `state.status` is the only input.

## Trade-offs taken

- **`loadingRows` rather than a skeleton inside `status.loading`.** A skeleton inside the single status cell
  cannot line up with the header's columns, which is its whole point. The cost is one additive contract field.
- **Skeleton row count is a number, not a measurement.** Sized to the viewport would need layout reads and
  would differ between server and client.
- **Delay is a `setTimeout` in a hook** (`useDelayed`), the only timer in the feature, cleared on cleanup.
- **`draw-g` uses `stroke-dashoffset`** from CSS. Not compositor-only; one path, measured at stage 7.

## Risks

| Risk | Mitigation |
| :--- | :--- |
| A skeleton over 500 columns renders 500 cells per row | goes through `renderedColumnsOf`, and rows are capped at 50 and at `pageSize` |
| A custom spinner breaks the announcement rules | the grid wraps it in `aria-hidden` and keeps the text itself |
| SVG slips into a banned sink | JSX elements only; `scripts/security-audit.mjs` runs on the new files |
| The delay flashes the table empty | the status row keeps its place and the hidden text while waiting |

## Out of scope for this change

Placeholder rows for unfetched windowed ranges, a determinate progress bar, moving the tree toggle onto
`Spinner`.

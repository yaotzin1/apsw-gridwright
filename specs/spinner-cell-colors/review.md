# Self-review: Spinner cell colours

## 1. Boundary and layering

Stylesheet only. Nothing under `src/core`, `src/data`, `src/plugins` or `src/react` changed.

## 2. The local/remote seam

Presentation only.

## 3. Public surface and semver

Minor: two optional custom properties; every default unchanged.

## 4. Accessibility and i18n

No string added. The spinner stays `aria-hidden`; forced colours set every cell to `Highlight`; reduced motion is unchanged.

## 5. Supply chain and packaging

No dependency or manifest change.

## 6. Honest output

No decoration, no invented numbers.

## 7. Verification

- `npm run verify`: passed end to end (typecheck, lint, tests, build, smoke, exports, security audit).
- Playground (`index.html`), Chrome: loading indicator on, `cell-colors` chosen, "red, green and blue cells" on and off again. Computed `--gw-spin-cell-color` per cell was red, green, blue by column with it on, and the one accent blue for all nine with it off.

## Known gaps

- Not published: this change waits in Unreleased by the maintainer's decision.
- The animation itself was not watched frame by frame, and forced-colors and reduced motion were checked in the stylesheet test, not in a browser.

# Self-review: density

> Written at stage 8, 2026-10-06. The specification, contract and plan were analysed at stage 5 (below);
> the seven answers and the verification output are for the change as implemented.

## Stage 5 analysis

- Breaks a published signature? No. A new add-on and types; two optional fields on existing interfaces; no
  default changes. `virtualRows()` behaves as before unless an earlier add-on publishes a height. Minor.
- DOM or React under the headless directories? No: nothing under `src/core`, `src/data` or `src/plugins` changes,
  and the pure rules sit in a plain `.ts` file in the adapter.
- Does a built-in need something a third-party add-on could not reach? It did: `virtualRows()` could not learn a
  height from another add-on. The seam (`rowHeight` published and read) is added to the public contract for
  everyone (spec section 7), the way `containerWidth` was.
- Runtime dependency? No.
- Keyboard reachability or an announced state? The control is a native labelled select. Nothing is announced on
  change, deliberately (AC-15). The touch-target minimum is unchanged (AC-11).
- Per-row work on the hot path? None added. A level change re-renders once; the virtual value is memoised on the
  height.
- Security: no HTML or script sink, no URL, no storage. The only dynamic style is `--gw-row-height` set from a
  number the option validation has checked is positive and finite, so a string cannot reach the style.
- Hydration: the level comes from options only.

## Stages run, and what stage 6 changed

All eight. Stage 6 did not return to Plan: `api-surface.md` and `spec.md` are as written, except that
`plan.md`'s test list is now accurate (see Verification) and one test comment was corrected (below). Details the
spec left open and the code settled: `resolveLevels` drops repeated and unknown names, since a plain JavaScript
caller can pass anything; the controller keeps the `levels` array stable so it is not rebuilt each render.

Two pieces of the workflow were touched and are said here on purpose:

- `scripts/check-exports.mjs` gained the five new React export names. It is under the workflow's protected paths,
  so that commit carries `Workflow-Change:`. It adds an expectation; no check was loosened.
- `tests/react/cell-navigation.test.tsx` got a longer timeout on an existing test in a separate `chore` commit
  (`04af11f`). That test failed intermittently under load and made the pre-commit hook refuse commits; it is
  unrelated to density and can be split into its own pull request.

## 1. Boundary and layering

Nothing under `src/core`, `src/data` or `src/plugins` changed; lint passes. The decisions (which levels, the
initial level, which height) are plain functions in `src/react/density/state.ts`, with no React, and the
component only renders a select. The add-on uses public slots only (`toolbar`, `rootAttributes`, `provide`,
`messages`, `before`). The one seam it needed, a published row height, was added to the public contract, and
`tests/react/density.test.tsx` proves a third-party add-on reads it with nothing the built-ins lack.
`virtualRows()` and `density()` do not import each other, and the tree-shaking smoke test proves naming one does
not bundle the other.

## 2. The local/remote seam

Not touched: density changes no query, stage or request. The same markup and tokens apply to a local array and
to a server source, and a level change makes no request.

## 3. Public surface and semver

Gained: `density`, `useDensity`, `useOptionalDensity`, `DENSITY_ADDON`, `densityMessages`, `DensityLevel`,
`DensityOptions`, `DensityController`; `AddonContribution.rowHeight` and `AddonSetupContext.rowHeight`; four CSS
custom properties; the `data-gw-density` attribute; `gridwright:density` messages. Lost: nothing. Changed:
`virtualRows()` reads a published height first, which exists only when `density()` is listed. Classified
**minor** in `api-surface.md` and `CHANGELOG.md`. `npm run check:exports` passes with the new names, and the
smoke suite imports `density` from `dist/` through the export map.

## 4. Accessibility and i18n

The control is a native `<select>` with a `<label>`, first in the tab order, with no `tabindex` of its own. All
four strings are in `gridwright:density`, in `en` and in the `de`, `es`, `fr` and `pl` packs; the existing
completeness test now includes the add-on and passes. No string is in JSX. Changing the level announces nothing
and a test asserts the live region is untouched. The coarse-pointer touch-target rule is asserted still present.

**Not verified:** the arrow keys, Home and End on the select. They are the browser's own behaviour for a native
select; jsdom does not simulate them, and the browser automation used here does not drive even a plain `<select>`
(a control with no app code did not move either), so I cannot claim they were checked. A person should try them
once in a real browser. An earlier draft of a test comment said Chrome had checked this; that was wrong and is fixed.

## 5. Supply chain and packaging

No dependency. `npm pack --dry-run`: 35 files, 893.2 kB, nothing from `src`, `tests`, `specs` or `.agents`.
`check:exports` and `security:audit` pass; the new strings are in `dist/react/index.js` and the four locale packs.

## 6. Honest output

No number is computed or displayed. The row height is written only from a positive finite number (a test covers
`0`, negatives, `NaN`, `Infinity` and a string). No loading state is involved. A grid that does not list the add-on
renders the markup it did before (a test asserts there is no attribute and no control).

## 7. Verification

Tests that would have caught the absence: all of `tests/react/density.test.tsx` and `tests/unit/density-state.test.ts`
import code that did not exist, and stashing only the `virtualRows()` change fails the two ordering tests. Tests
that catch regression: those files, the smoke suite, and `tests/unit/i18n.test.ts`.

Operated in the real playground (Chrome, 2026-10-06), measured from the page, then everything switched off again:

| State | Attribute | `--gw-row-height` | Cell padding | Virtual slot / scroll height of 5,000 rows |
| :--- | :--- | :--- | :--- | :--- |
| comfortable | `comfortable` | none | 8 / 12 px | 40 px / 200,274 |
| compact | `compact` | 32px | 4 / 8 px | 32 px / 160,243 |
| spacious | `spacious` | 52px | 14 / 16 px | 52 px / 260,248 |

The choice was written by `onChange` and read back after the grid remounted. Two things seen there that are not
density's: in that playground a Job title cell wraps to two lines, so rendered rows are taller than their slot at
every level, including with the add-on off (57.6 px in a 40 px slot); that is existing demo content, and the
documented limit that a row taller than `rowHeight` overflows its slot.

```
> apsw-gridwright@0.14.2 verify
> npm run clean && npm run validate:skills && npm run sync:check && node scripts/security-audit.mjs --source
  && npm run typecheck && npm run lint && npm run test && npm run test:smoke && npm run check:exports
  && npm run security:audit

 Test Files  57 passed (57)
      Tests  1113 passed (1113)
 Test Files  3 passed (3)        (smoke, against dist/)
      Tests  32 passed (32)
exit code 0
```

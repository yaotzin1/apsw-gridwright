# Self-review: density

> Written at stage 8. The specification, contract and plan were analysed at stage 5 (below); the seven
> answers and the verification output are filled when the change is implemented.

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

## 1. Boundary and layering

## 2. The local/remote seam

## 3. Public surface and semver

## 4. Accessibility and i18n

## 5. Supply chain and packaging

## 6. Honest output

## 7. Verification

```
<paste the actual output of npm run verify>
```

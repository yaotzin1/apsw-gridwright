# Self-review: request cancellation and search debounce

> Written at stage 8. The specification, contract and plan were analysed at stage 5 (below); the seven
> answers and the verification output are filled when the change is implemented.

## Stage 5 analysis

- Breaks a published signature? No: one optional option. The `queryDebounceMs` timing change is recorded
  as a behaviour change of an opt-in, minor.
- DOM or React under the headless directories? No: `src/core` only gains scheduling.
- Does a built-in need something a third-party add-on could not reach? No: it is an option.
- Runtime dependency? No.
- Keyboard reachability or an announced state? Unchanged; one announcement test is planned.
- Per-row work on the hot path? No: one comparison per committed query.

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

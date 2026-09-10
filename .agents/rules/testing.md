# Testing Rules

Binding.

## 1. No test, no merge

Every feature, fix, refactor and architectural change carries automated coverage. A change without
it is incomplete.

## 2. The three suites answer different questions

| Suite | Imports | Question |
| :--- | :--- | :--- |
| `tests/unit` | `src/` | is the logic right |
| `tests/react` | `src/react` | does the component behave |
| `tests/smoke` | `dist/` | does the published artifact work |

A smoke test that imports `src/` is not a smoke test. The distinction is the point of having three.

## 3. Both sides of the capability seam

Any feature touching the query must be tested against a source that resolves it and a source that
does not. A feature that works for a local array and not for a paginating endpoint works in the
demo only.

## 4. No timers

`vi.waitFor`, `waitFor` and `findBy*`. Where ordering is the subject of the test, use a deferred
promise and resolve it explicitly.

## 5. Query by role

Assertions go through accessible roles and names, never class names or DOM structure. This doubles
as accessibility coverage.

## 6. Coverage thresholds

`vitest.config.ts` enforces 85% statements, functions and lines, 80% branches over `src/`. Lowering
a threshold to make a change pass is a change to the rules, and belongs in a spec.

## 7. Before reporting a change complete

```bash
npm run verify
```

Report what it actually printed. A summary of a test run is not a test run.

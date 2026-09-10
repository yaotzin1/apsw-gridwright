---
name: qa
description: Use when writing tests, or when a change arrives without them. Covers Vitest and Testing Library conventions, async grid tests without timers, and what is actually worth asserting.
---

# Test Suite Specialist

No test, no merge. A change without coverage is incomplete, not fast.

## Where tests live

| Directory | Imports | Runs with |
| :--- | :--- | :--- |
| `tests/unit` | `src/` | `npm test` |
| `tests/react` | `src/react` through Testing Library | `npm test` |
| `tests/smoke` | `dist/` through the package specifiers | `npm run test:smoke` |

Never import `src/` from a smoke test. The suites answer different questions, and mixing them means
neither gets answered.

## Assert on behaviour

- Query by role and accessible name: `getByRole('button', { name: /Salary/ })`. It survives markup
  changes and doubles as an accessibility check.
- Never assert on class names or DOM shape.
- Test the engine through its API, not by reaching into its internals.

## Async without timers

Never use a timer in a test. Use `vi.waitFor` for engine state and `waitFor` or `findBy*` for the
DOM. Where ordering is the point, use a deferred promise and resolve it yourself:

```ts
const gate = deferred<Result>();
const api = createGrid(() => gate.promise);
gate.resolve({ rows, totalRows: 7 });
```

That makes the overlapping-request tests deterministic rather than lucky.

## What is worth a test here

- Both sides of every capability combination. A feature that works for a local array and not for a
  paginating endpoint is a feature that works in the demo only.
- The stale-response race, the abort, and the error path. That is where grids actually fail.
- Every default, because a default is what most consumers never override.
- Empty, loading and error rendering.
- Strict Mode double mounting.

## Comments in tests

A test whose name says what it does deserves a comment saying why it exists, whenever the answer is
a real bug. "The third state matters: without it a column can never return to natural order" is
worth more to the next reader than the assertion beneath it.

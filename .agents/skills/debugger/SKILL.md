---
name: debugger
description: Use when something fails and the cause is not obvious. Covers reading the actual output, isolating engine from adapter, and reproducing a report as a failing test before changing anything.
---

# Systematic Debugging

## Reproduce before you theorise

The first artifact of a bug report is a failing test, not a hypothesis. If the report cannot be
turned into a test, the report is not yet understood, and a fix aimed at an unreproduced bug tends
to add a second one.

## Read the actual output

Paste the real error, the real stack, the real assertion diff. A summary of a failure is not
evidence, and the detail that identifies the cause is usually the one that got summarised away.
Run one file rather than the suite:

```bash
npx vitest run tests/unit/engine-remote.test.ts
npx vitest run tests/react -t "sorts when a header is activated"
```

## Isolate the layer first

Ask one question before anything else: **does the engine already have the right state?**

```ts
api.on('state:change', ({ state }) => console.log(state.status, state.rows.length, state.totalRows));
```

- Engine state wrong: the bug is in the core, the pipeline or the data source, and the adapter is
  reporting faithfully.
- Engine state right, screen wrong: the bug is in `src/react`.

That split removes most of the search space in one step, and it is why the engine is testable with
no DOM.

## Symptoms and their usual causes

| Symptom | Look at |
| :--- | :--- |
| Renders empty but claims ready | a stage returning the wrong rows, or a recompute over an in-flight fetch |
| Rows are stale after a search | a source ignoring `request.signal`, or a stale response applied out of sequence |
| Page count wrong after filtering | a stage that narrowed rows without updating `totalRows` |
| Selection follows the reader across pages | rows with no stable id falling back to a position |
| Sort arrow shows but order unchanged | the source declares `sort: true` and is not sorting |
| Infinite render loop | an effect keyed on an inline array's identity |
| Works in production, empty in development | Strict Mode double mount with no rebuild |

## Fix the cause

When you find it, add the test that would have caught it, and leave a comment saying why the code
is the way it is. The comment is the part that prevents the regression.

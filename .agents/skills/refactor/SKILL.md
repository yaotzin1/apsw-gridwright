---
name: refactor
description: Use when changing structure without changing behaviour, when a module has outgrown its purpose, or when removing something a consumer might depend on.
---

# Refactoring & Technical Debt

## The rule

A refactor changes structure and nothing else. If the tests need editing, it is not a refactor: it
is a behaviour change wearing a refactor's clothes, and it needs a spec entry and a version
classification.

Run the suite before, make the change, run it after. Both green, no edits in between.

## When to split a module

Split when a file has two reasons to change, not when it passes a line count. `engine.ts` is long
because the fetch sequencing, the query commands and the selection commands all need the same
closure state; splitting it would replace private variables with a wider internal API and make the
invariants harder to see, not easier.

The good splits in this codebase follow the existing seams: values, columns, query, pipeline,
errors. Each has one reason to change and no knowledge of the others.

## Removing an export

You cannot see who depends on it. Deprecate instead:

```ts
/** @deprecated Use `createRestDataSource` instead. Removed in 2.0. */
export const createHttpDataSource = createRestDataSource;
```

It keeps working, the consumer is warned at the moment they can act on it, and the removal waits
for the next major. A removal that saves one line of source costs every consumer an afternoon.

## Debt worth recording

When you leave something imperfect on purpose, say so in the code, with the reason and the
condition that would justify fixing it. "This is linear per render; it matters above roughly 5,000
rows, at which point `virtual` or a windowed source is the real answer" is useful. A bare
`// TODO: optimise` is not: it names no threshold, so nobody can tell whether it is still true.

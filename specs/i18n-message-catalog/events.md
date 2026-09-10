# Lifecycle contract: Message catalog and translation

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces.

## Events added

None.

## Events changed

None. No payload, name or ordering guarantee moves.

## Pipeline stages added

None. Translation touches no stage, so a grid renders the same rows in the same order in every
language.

## Why this document is nearly empty

That is the finding. Translation was expected to be a presentation change, and the contract
confirms it: the engine, the query, the state shape, the events and the pipeline are all untouched.
Everything happens between `labels` and the parts.

A change that expected to be presentation-only and turns out to need an event is a change whose
plan was wrong, which is what this document is for.

## Lifecycle of a translator

One per `GridwrightProvider`, memoised on `locale`, `messages` and `translate` by identity. Passing
an inline `messages` object rebuilds it every render, which is cheap (a closure and a lazily
created `Intl.NumberFormat`) but avoidable by hoisting the object.

`Intl.NumberFormat` is created on first use and reused, because constructing one per formatted
number is the standard way to make an otherwise fast path slow.

Nothing here allocates anything requiring teardown, so there is none.

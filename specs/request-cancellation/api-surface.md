# API surface contract: request cancellation and search debounce

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: one optional option is added. No default changes (`searchDebounceMs` is `0`, which
reproduces today's immediate fetch on a search change). One behaviour of an existing *opt-in*
option changes: with `queryDebounceMs > 0` the superseded request is now aborted when the query
changes instead of when the replacement starts (spec C-4). That closes a window in which stale rows
could land, it is observable only with the option set, and the changelog calls it out.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `searchDebounceMs` | `apsw-gridwright` (`GridEngineOptions`) | `readonly searchDebounceMs?: number` |
| `searchDebounceMs` | `apsw-gridwright/react` (`UseGridwrightOptions`, `<Gridwright />` props) | `readonly searchDebounceMs?: number` |

No new function, class or type is exported. Both are options on types that are already exported.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `queryDebounceMs` | delays a fetch after any change; the old request lives until the replacement starts | same delay; the old request is aborted when the change is committed | stale rows no longer land during the wait |

## Exports removed or deprecated

None.

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| `searchDebounceMs` | (did not exist) | `0` |

No existing default changes.

## Semantics

```ts
// A search-only commit: the patch moves `search`, and the only other difference is the page reset.
delay = isSearchOnly ? (searchDebounceMs ?? queryDebounceMs) : queryDebounceMs

// Every committed change, before any delay:
supersede() // abort the in-flight request, invalidate its sequence number
schedule(delay)
```

- A non-negative finite number is used as given; anything else is treated as `0`, as `queryDebounceMs` is.
- A fetch for a non-search change clears any pending timer, so only the latest query is sent.

## Type entry points

- [ ] Every type appearing in a new signature is itself exported
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes

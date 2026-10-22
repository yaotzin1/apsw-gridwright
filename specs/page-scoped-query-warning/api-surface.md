# API surface contract: warn when a query covers only the page received

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: one new optional field on two existing options objects. No required field, no changed
signature, no changed payload, no renamed export. The grid renders and behaves identically; the only
difference a consumer can observe is a line on `console.warn`, which is output and not a contract.
It is nevertheless visible, which is why it is a feature and not a fix, and why it can be silenced.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| _(none)_ | | |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `GridEngineOptions` | no `warnOnPageScopedQuery` | `readonly warnOnPageScopedQuery?: boolean` | minor: optional field |
| `UseGridwrightOptions` (and so `GridwrightProps`) | no `warnOnPageScopedQuery` | `readonly warnOnPageScopedQuery?: boolean` | minor: optional field |

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| _(none)_ | | |

## Defaults introduced or changed

<!-- A changed default breaks consumers without breaking their build. List every one. -->

| Option | Old default | New default |
| :--- | :--- | :--- |
| `warnOnPageScopedQuery` | _(did not exist; nothing was written)_ | `true`: one `console.warn` per used, undeclared facet on a paginating source, not in production |

This is the one entry a reviewer should read twice. It is a default that adds output, not one that changes
data, rows, state, events or rendered markup. A consumer who treats a `console.warn` as a test failure
will see it only if their grid is the page-only configuration the warning is about, and the option turns
it off.

## Type entry points

- [x] Every type appearing in a new signature is itself exported (`boolean` only)
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes

# API surface contract: Spinner cell colours

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: two optional CSS custom properties. No export, type or markup changes, and the default is unchanged because each property falls back to `--gw-spinner-color`.

## Exports added

None. Two stylesheet properties: `--gw-spinner-color-2`, `--gw-spinner-color-3` (published as `apsw-gridwright/styles.css`).

## Exports changed

None.

## Exports removed or deprecated

None.

## Defaults introduced or changed

None. Both properties default to `--gw-spinner-color`, which defaults to `--gw-accent`.

## Type entry points

- [x] Every type appearing in a new signature is itself exported (no signature changes)
- [x] Both `import` and `require` conditions still resolve types (untouched)
- [x] `npm run check:exports` passes

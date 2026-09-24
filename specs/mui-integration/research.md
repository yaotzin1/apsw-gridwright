# Research: MUI integration

## Options considered

### Packaging (C-1)

#### Option A — subpath `apsw-gridwright/mui`, `@mui/material` as an optional peer

**How it works.** A fourth tsup entry, `mui/index`, with `@mui/material` external. The manifest gains
`peerDependencies['@mui/material']` marked optional in `peerDependenciesMeta`. A consumer without
MUI never imports the entry and never installs MUI.

**The cost, measured (R-1).** An optional peer is not ignored when it is present. npm checks the
installed version against the declared range and refuses the install on a mismatch. Reproduced on
2026-09-24 with npm 10.9.3 (the repository's `packageManager`): a package declaring an optional peer
`left-pad@^1.3.0`, installed into an app that has `left-pad@1.1.0`:

```
npm error code ERESOLVE
npm error ERESOLVE could not resolve
npm error While resolving: lib-under-test@1.0.0
npm error Found: left-pad@1.1.0
npm error Could not resolve dependency:
npm error peerOptional left-pad@"^1.3.0" from lib-under-test@1.0.0
```

So under this option, every consumer on MUI 5 or 6 gets an install that fails when they upgrade
`apsw-gridwright` to the minor that adds the entry, **whether or not they ever import it**. That is
a breaking change delivered as a minor. It is avoidable only by declaring a range wide enough to
cover every MUI a consumer might have, which means supporting and testing v5 and v6, or by declaring
a range the code does not honour.

It also needs `workflow.ai.yml` amended ("peer dependencies on React only"), plus
`scripts/check-exports.mjs` and `scripts/security-audit.mjs` taught about the one allowed extra peer.

#### Option A′ — subpath, with no peer declared at all

**How it works.** As A, but the manifest says nothing about MUI. The entry imports `@mui/material`
and relies on the app having it.

**Rejected because.** It works with a hoisting npm install and fails under pnpm's isolated
`node_modules` and Yarn Plug'n'Play. Both resolve an import only against the importing package's
declared dependencies and peers, and the import is in this package's `dist`, which declares neither.
It would also leave npm with no way to warn about a wrong MUI version.

#### Option B — a separate package, `apsw-gridwright-mui`

**How it works.** Its own manifest, with `apsw-gridwright`, `@mui/material` and `react` as peers
(not optional: nobody installs it without them). Its version moves independently. Its peer range on
`apsw-gridwright` pins the add-on contract it was built against.

**Costs.** The repository becomes an npm workspace (`packages/core`, `packages/mui`, or the root
package plus `packages/mui`). The release workflow publishes two packages, the second one needs its
own trusted-publisher entry on npmjs.com, and `release.md` needs a rule for which tags publish
which. The smoke suite gains a second tarball. Of the three options, this is the most work for the
maintainer.

**Why it is the recommendation.** Every cost falls on this repository and none on a consumer. The
main package's manifest, rules and install behaviour do not change at all, which is what US-05 asks
for. A consumer on MUI 5 who never installs the new package is untouched, and one who does gets an
honest peer error naming the version they need. Of the three options, only B makes "add the MUI
option" a pure addition for every existing consumer.

**Chosen:** pending the maintainer (C-1). This file recommends B.

### Theming the root (AC-03, AC-14)

#### Option 1 — a wrapper component (`<MuiGridwright />`)

Rejected. It is a second grid component, the thing AGENTS.md section 1 rules out, and every feature
would need to be threaded through it.

#### Option 2 — `provide` with an extra `<div style={vars}>`

Rejected. It adds an element between the root and its children, which changes the markup of
`gap`/flex layout in `.gw-root` and the root's direct-child selectors in `styles.css`.

#### Option 3 — `tableWrapper` style

Rejected. The wrapper is inside the root, so the toolbar, the pagination bar and the overlays would
not inherit the tokens.

#### Option 4 — a `rootAttributes` slot for every add-on

**Chosen.** It follows the architecture rule: when a feature needs a seam that does not exist, the
seam is added to the public contract for everyone. It has the same shape and the same runtime
allowlist (`mergeAttributes`) as `tableAttributes`, so no URL attribute, markup or children can
arrive through it.

### Replacing the native views (C-2)

**New names with `suppresses`** (`gridwright:mui-sorting` suppressing `gridwright:sorting`):
rejected. Locale packs key translations by add-on name, so every string would fall back to English
unless each pack gained a copy. `virtualRows()` suppresses `gridwright:pagination` by name and would
miss the MUI bar. A `coreAddons()` recipe filtering by name would miss both.

**The same names**: chosen. See spec C-2.

## Prior art

- **MUI's own `TablePagination`** understands an unknown total (`count={-1}`) but words it as "of
  more than N", with N computed from the rows seen. AGENTS.md section 4 forbids exactly that.
  AC-08 always supplies `labelDisplayedRows` from the add-on's messages.
- **MUI's `TablePaginationActions`** disables Next from `count` arithmetic, and with `count={-1}`
  never disables it at all. The engine's `hasNextPage` is the only honest source, so it drives
  `slotProps.actions.nextButton.disabled` (verified present in `@mui/material@9.4.0`
  `TablePaginationActions.d.ts`).
- **`TableSortLabel`** renders `ButtonBase` with `component: "span"` by default (verified in
  `9.4.0`'s `TableSortLabel.js`): a `span` with `role="button"`. The accessibility rule wants a real
  `<button>`, so AC-06 passes `component="button"`.
- **`TablePagination`** defaults to `component={TableCell}`, a `<td>`, for use inside a `<tfoot>`.
  This grid renders pagination below the table, so AC-08 passes `component="div"`.
- **MUI X Data Grid** is a separate grid with its own API; see the non-goal. Nothing is copied.

## Measurements

Not a performance change. The one per-render cost is `muiTheme()` building a token object from the
theme. It is memoised on the theme's identity, so it runs once per theme change, never per row.

## Open questions

- **R-1 (measured above).** It decides C-1 between A and B. Unresolved until the maintainer
  chooses.
- **R-2.** Whether `slotProps.actions.nextButton` accepts a `ref` in both v7 and v9 typings. AC-09
  needs the two buttons' elements. If it does not, the add-on passes its own `ActionsComponent`,
  which receives the same props and is a documented MUI extension point. Settle with a spike at
  the start of stage 6. The API surface is not affected either way.
- **R-3.** Whether `useTheme()` under the Pigment CSS engine returns a usable theme at runtime.
  Recorded as a known gap, not a blocker (non-goal).

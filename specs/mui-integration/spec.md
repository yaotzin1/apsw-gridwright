# Specification: MUI integration

> **Status**: Implemented 2026-09-25 on `feat/mui-integration` (C-1: a workspace in this repository). Not released.
> **Stage entry**: 1
> **Semver impact**: `apsw-gridwright` minor (one new add-on slot and newly exported helpers;
> nothing existing changes shape or default); `apsw-gridwright-mui` 0.1.0 (a new package, C-1);
> confirmed in api-surface.md

---

## 1. The consumer problem

A large share of React applications are built on MUI. Dropped into one today, `<Gridwright />` works
but looks like a stranger:

1. **It ignores the MUI theme.** The grid's colours, radius, spacing and dark mode come from the
   `--gw-*` custom properties in `styles.css`, which know nothing about `createTheme()`. To match,
   a developer reads the MUI palette and writes each `--gw-*` variable by hand, then does it again
   for dark mode. Switching the MUI colour scheme leaves the grid on its old colours.
2. **Its controls are not MUI controls.** The sort button, the row checkboxes and the pagination
   bar are plain native elements. Beside MUI checkboxes, selects and icon buttons elsewhere on the
   same page they look and feel different: no ripple, different sizes, different focus rings.
3. **The only way to fix (2) today is to write add-ons.** The add-on contract can do it (a sorting
   add-on that owns `headerLabel`, a selection add-on that contributes the checkbox column), but
   each one has to re-implement `aria-sort`, the sort announcement, indeterminate select-all, the
   "of many" range and focus handling at the end of pagination. Those are the parts that are easy
   to get wrong, and this package already gets them right once.

What is wanted is **one opt-in line** that makes the grid an MUI citizen, while `<Gridwright />`
without it renders exactly what it renders today:

```tsx
import { Gridwright } from 'apsw-gridwright/react';
import { muiAddons } from 'apsw-gridwright-mui';

<Gridwright columns={columns} data={rows} coreAddons={muiAddons()} />
```

## 2. User stories

- **US-01.** As a developer with an MUI app, I pass `coreAddons={muiAddons()}` and the grid takes
  its colours, typography, radius and spacing from my MUI theme, with no `--gw-*` written by hand.
- **US-02.** As a developer, when my app switches the MUI colour scheme (light/dark, including
  `colorSchemes` with CSS variables), the grid switches with it.
- **US-03.** As a developer, the sort control, row checkboxes and pagination bar are MUI
  components (`TableSortLabel`, `Checkbox`, `TablePagination`), styled and overridden through my
  theme's `components` entries like every other MUI component in the app.
- **US-04.** As a developer already using `coreAddons({ selection: { checkboxes: false } })` or
  locale packs, the MUI set takes the same options and the same translations.
- **US-05.** As a developer who does not use MUI, nothing about my install, bundle or rendered
  markup changes.
- **US-06.** As a keyboard or screen-reader user of a grid built with the MUI set, I get the same
  grid: a real sort button, `aria-sort` on the header cell, the sort sentence in the live region,
  an indeterminate select-all, "of many" when the total is unknown, and focus that stays in the
  grid when a pagination button disables itself.

## 3. Acceptance criteria

- [x] **AC-01** `muiAddons()` returns the core set with the MUI views: `muiTheme()`,
      `muiSorting()`, `muiSelection()`, `muiPagination()` and the existing `staleNotice()`, in that
      order. `muiAddons(options)` accepts `CoreAddonOptions` and passes each entry on exactly as
      `coreAddons(options)` does.
- [x] **AC-02** Each MUI view add-on has the same `name` as the add-on it replaces
      (`gridwright:sorting`, `gridwright:selection`, `gridwright:pagination`), so locale packs,
      `messages` overrides such as `'gridwright:sorting.ascending'`, and anything that suppresses or
      orders against those names keep working. Listing an MUI view and the native one in the same
      grid is the existing duplicate-name error.
- [x] **AC-03** `muiTheme()` sets the grid's `--gw-*` colour, typography, radius and spacing
      tokens from the MUI theme in context, on the grid's root element, per the mapping in
      `plan.md`. With no `ThemeProvider` it uses MUI's default theme.
- [x] **AC-04** When the MUI theme exposes CSS variables (`theme.vars`), the tokens are written as
      `var(--mui-…)` references, so a colour-scheme switch restyles the grid without re-rendering it.
      Without `theme.vars` the resolved values are written and follow the theme on re-render.
- [x] **AC-05** `muiTheme()` sets `data-gw-theme` on the root from the palette mode, so the
      stylesheet's `prefers-color-scheme` block never fights the MUI mode.
- [x] **AC-06** `muiSorting()` renders `TableSortLabel` as a `<button type="button">` (not MUI's
      default `span`), active and directed from `api.getSort`, with the next action as its title.
      `aria-sort` stays on the header cell, Shift adds a column when `multiSort` is on, and the
      live-region sentence is the one `sorting()` speaks.
- [x] **AC-07** `muiSelection()` renders MUI `Checkbox`es with the same labels, the select-all
      indeterminate while part of the page is selected, clicks that do not reach the row handler,
      and the same `aria-selected`, `aria-multiselectable`, selected class and toolbar count as
      `selection()`. `checkboxes` and `count` behave as they do there.
- [x] **AC-08** `muiPagination()` renders `TablePagination` as a `<div>` (not its default table
      cell), with `count` `-1` when `isTotalExact` is false. Its range text is always the add-on's
      `range` or `rangeUnknown` message, so MUI's own "more than N" never renders. Previous and
      Next are disabled from `hasPreviousPage` and `hasNextPage`, not from MUI's arithmetic.
      `pageSizeOptions` behaves as in `pagination()`, including adding the current page size.
- [x] **AC-09** When a pagination button the reader pressed becomes disabled, focus moves to its
      sibling, as in `pagination()`.
- [x] **AC-10** `virtualRows()` still suppresses pagination when the MUI set is used, through the
      shared name, with no change to `virtualRows()`.
- [x] **AC-11** The existing accessibility and core-add-on tests run a second time with
      `coreAddons={muiAddons()}` and pass without an MUI-specific exception.
- [x] **AC-12** `apsw-gridwright`'s manifest, dependencies, peers and built entries are unchanged
      by MUI: no bundle references `@mui/*`, and a consumer without MUI (or on MUI 5 or 6) installs,
      builds and runs exactly as before. Enforced in the smoke suite and `check:exports`.
- [x] **AC-13** The MUI code carries no copy of the engine or of the React adapter: it imports them
      from `apsw-gridwright` and `apsw-gridwright/react` at run time, so there is one engine and
      `instanceof GridwrightError` holds across both. The packaging audit checks the built output.
- [x] **AC-14** A new add-on slot, `rootAttributes`, lets any add-on contribute allowlisted
      attributes to the root element. `muiTheme()` uses only public exports to reach it, and
      `tests/react/third-party-addon.test.tsx` reaches it too.
- [x] **AC-15** A playground example renders the same grid with `coreAddons()` and with
      `muiAddons()`, with an MUI light/dark switch, and boots in the "Example playground boots"
      check.

## 4. Non-goals

- **Changing the default.** `coreAddons()` stays the default and stays native. MUI is opt-in.
- **MUI rows and cells.** The table, rows and cells stay the shell's own `<table>` markup, themed
  through the tokens. Rendering `TableRow`/`TableCell` needs a seam that replaces the shell's row and
  cell elements, which is a larger contract change; see Known gaps in `review.md`.
- **The other add-ons in this change.** Filters, export menu, column picker, inline editing, row
  detail and tree toggles keep their native controls, themed by `muiTheme()`. MUI views for them
  are later minors, one add-on at a time, each reusing the logic it already has.
- **The MUI X Data Grid API.** No prop, name or behaviour is copied from `@mui/x-data-grid`. This is
  this grid, in MUI's clothes.
- **Joy UI, Base UI, Pigment CSS guarantees.** Only `@mui/material`. Whether the Pigment CSS engine
  works is recorded as a known gap, not promised.
- **MUI versions older than the lowest one tested** (C-3).
- **A second styling system.** `styles.css` is still required; `muiTheme()` only sets its variables.

## 5. Behaviour across the capability seam

The feature is views over state the engine already has. It reads `state.totalRows`,
`isTotalExact`, `hasNextPage` and `hasPreviousPage` and never branches on where rows came from.

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | Exact total; `TablePagination` gets the real `count`. |
| everything (server) with a total | Same as local. |
| everything (server) without a total | `count={-1}`, range from `rangeUnknown` ("of many"), Next enabled from `hasNextPage`. |
| pagination only | Same as the row above that matches whether the source sent a total. |
| windowed body (`virtualRows()`) | No pagination bar: suppressed by name, as today. |

## 6. Accessibility and interface copy

No new strings. Every visible or announced string comes from the existing `gridwright:sorting`,
`gridwright:selection` and `gridwright:pagination` messages, so the five shipped locales and every
consumer override apply unchanged. MUI's own built-in English (`labelRowsPerPage`,
`labelDisplayedRows`, `getItemAriaLabel`) is always overridden from those messages and never
reaches the screen.

- **Sort**: `TableSortLabel` as a real `<button>`; `aria-sort` on the `<th>`; the priority-20
  announcement contributor shared with `sorting()`.
- **Selection**: the native `<input type="checkbox">` MUI renders inside `Checkbox` carries the
  `aria-label`. MUI's `indeterminate` prop draws the icon and sets `data-indeterminate` but not the
  DOM property (its own typings say so), so the view also sets the property through the input slot's
  `ref`, as the native checkbox does; without it a screen reader hears "not checked" for a partly
  selected page. *(Corrected at stage 6, 2026-09-25: this line first said MUI set the property.)*
- **Pagination**: the rows-per-page control is MUI's `Select` with `native: true`, a real `<select>`
  named by the `rowsPerPage` message. *(Changed at stage 6: the non-native `Select` opened a portalled
  menu that took MUI's direction rather than the grid's (C-5), and failed the grid's own pager tests,
  which drive a `<select>`.)*
- **Focus**: AC-09. MUI's icon buttons lose focus to `<body>` when disabled, exactly like native
  ones, so the same sibling rule applies.

## 7. Delivery as a plugin

**Engine.** None. No plugin, no state, no event.

**React add-ons**, in the new package (C-1):

| Add-on | Name | Slots |
| :--- | :--- | :--- |
| `muiTheme()` | `gridwright:mui-theme` | `rootAttributes` (new, AC-14): `style` with the token values, `data-gw-theme` |
| `muiSorting()` | `gridwright:sorting` | `headerLabel`, `headerAttributes`, `announce`, `messages` |
| `muiSelection()` | `gridwright:selection` | `columns`, `tableAttributes`, `rowAttributes`, `toolbarStatus`, `messages` |
| `muiPagination()` | `gridwright:pagination` | `belowTable`, `messages` |

**What cannot be an add-on.** Theming the root needs somewhere to put the variables. No slot reaches
the root element today (`tableWrapper` is inside it, so the toolbar and the pagination bar would
not inherit), and wrapping the grid in `provide` would add an element. So the seam is added to the
contract for everyone, as the architecture rule requires, instead of `muiTheme()` reaching into the
shell. Everything else uses existing slots.

**Shared logic.** Per `.agents/rules/architecture.md` section 8, what the three core add-ons decide
(the sort sentence and signature, the page's select-all state, the displayed range, the page-size
choices, and which pagination button gets focus) moves into plain `.ts` files that both the native
and the MUI views call. The native add-ons change structure, not behaviour.

## 8. Clarifications

- **C-1. Where does it ship?** **Resolved 2026-09-25: (b), as an npm workspace in this repository**
  (`packages/mui`), not a second repository. The MUI suites run against the grid's source in the same
  commit, a contract change and its MUI consumer land together, and there is one CI and one set of
  agent rules. The cost is teaching the packaging scripts and the release workflow about a second
  package. The original options follow.
  **(a)** A subpath `apsw-gridwright/mui` in this package, with `@mui/material` as an optional peer
  dependency. One install, one version, one publish pipeline. It requires amending the
  zero-runtime-dependencies rule in `workflow.ai.yml`, which today says "peer dependencies on React
  only". **(b)** A separate package, `apsw-gridwright-mui`, with its own peers. The main package's
  rules stay as they are, and the repository becomes a workspace with a second publish.
  `research.md` sets out both. R-1 was measured there: npm 10 refuses the install (`ERESOLVE`)
  when an optional peer is present at a version outside its range, so under (a) every consumer on
  MUI 5 or 6 would fail to install the minor that adds the entry, whether or not they import it.
  **Recommended: (b).** api-surface.md is written for (b); under (a) only the import specifier and
  the manifest section change.
- **C-2. Same names as the native add-ons, or new ones?** Resolved: **same names** (AC-02). A new
  name would drop the add-on's translations from every locale pack, since packs key strings by
  add-on name, and would break `virtualRows()` suppressing pagination and every `coreAddons()`
  recipe that filters by name. The cost is that a grid cannot list both views of one feature, which
  it should never want to.
- **C-3. Which MUI versions?** Proposed: `^7.0.0 || ^9.0.0` (there is no v8; 9.4.0 is current).
  v7 is the oldest line that has `slotProps` on `TablePaginationActions`, which AC-08 and AC-09
  use. Both lines are tested in CI. v5 and v6 are out (R-1 explains what that costs).
- **C-4. Density.** `muiTheme()` maps cell padding from `theme.spacing` and keeps the grid's
  `--gw-row-height` default. Option `muiTheme({ dense })` is **not** added now: MUI's own
  `size="small"` convention is per table, and the grid already exposes `--gw-row-height` for it.
- **C-5. Portalled menus and RTL.** *Superseded at stage 6: the pager's select is native, so there is
  no portalled menu.* The original resolution follows. Accepted: the rows-per-page menu follows MUI's `direction`
  (the app's `ThemeProvider`), not the grid's locale. A grid whose locale is RTL inside an LTR MUI
  app is unusual, and forcing `disablePortal` would let the table's scroll container clip the menu.
- **C-6. Can one add a single MUI view to the native set?** Yes, by list operation, exactly as any
  add-on replacement: `coreAddons().map((a) => a.name === 'gridwright:sorting' ? muiSorting() : a)`.
  `muiAddons()` is the whole-set convenience, not the only path.

## Artifacts not written

- `data-model.md`: no state, query or type changes shape; the one new contract type
  (`rootAttributes`) and the new option types are in api-surface.md.
- `events.md`: the feature emits no event and adds no pipeline stage.

## Clarifications added at stage 6 (2026-09-25)

- **C-7. Features that landed after this spec.** Multi-column sorting (priority badges, the Shift
  hint) and selection controls (`selectAll`, `selectOnRowClick`, `Space` through `cellNavigation()`)
  shipped in the native add-ons first. The MUI views take the same options and behave the same way,
  through the same helpers, so AC-06 and AC-07 include them: `TableSortLabel` shows the priority
  badge while more than one column is sorted, and `muiSelection()` honours `selectAll` and
  `selectOnRowClick`. The helpers that carry this are added to api-surface.md.
- **C-8. The peer range on `apsw-gridwright`.** 0.11.0 is published without `rootAttributes`, so the
  MUI package's range starts at the minor that ships it, `^0.12.0`.

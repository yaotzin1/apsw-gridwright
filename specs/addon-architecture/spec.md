# Specification: add-on architecture (a fully extensible table)

> **Status**: Clarified (stages 1 and 2, 2026-09-13)
> **Stage entry**: 1
> **Semver impact**: major (removes feature props from `<Gridwright />`). The package is unpublished and
> in development; the classification is recorded so the history reads correctly at first publish.

---

## 1. The consumer problem

The engine is extensible. Filtering, search, sorting and pagination are `GridPlugin`s with no
privileged access, data sources declare what they resolve, and the tree is a real plugin plus a
data-source decorator. The React component is not. Every feature a reader can see is wired into
`<Gridwright />` and its parts by name:

- `Gridwright.tsx` imports the export menu, the filter provider, trigger and clear button, the row
  menu, inline editing, the virtual body, the tree provider and the tree hook, and chooses between
  them with props (`export`, `columnFilters`, `rowActions`, `onCellEdit`, `virtual`, `tree`).
- `GridHeader.tsx` imports the filter trigger. `GridBody.tsx` and `GridTable.tsx` import the tree
  context to add hierarchy ARIA and the `treegrid` role.
- The live region knows sort and filters by name. The message catalog and `GridwrightLabels` are one
  closed set holding every feature's strings.

The consequences are concrete, and all of them were found in this repository:

1. **A third party cannot build what the package builds.** There is no slot beside the sort button,
   no way to wrap the grid, no toolbar contribution, no row or cell attribute seam, no body
   replacement, no announcement contribution, and no way to ship translatable strings. The
   extensibility rule "a built-in must not be able to do something a third-party plugin cannot" is
   broken for everything visible.
2. **Every consumer pays for every feature.** `Gridwright.tsx` imports them all, so a bundler cannot
   drop the ones an application never uses: the React entry grew by about 20 kB (unminified) with
   column filters alone, for applications that never set `columnFilters`.
3. **Features share parts through imports, and drift.** `GridVirtualBody` copies `GridBody`'s row
   markup and missed the tree ARIA, so a virtualized tree has no hierarchy for a screen reader. Tree
   grids silently drop the consumer's `plugins` and `onSelectionChange`.
4. **The engine's own seams stop short.** `plugins` replaces the default set instead of adding to it,
   and is read once at creation. A plugin cannot suppress another plugin's stage, so the tree replaces
   the whole plugin list and cannot compose with anything.
5. **Six draft specs design their feature as another prop** (`multiSort`, `showCheckboxes`,
   `columnPicker`, `cellNavigation`, `syncWith`, grouping in `GridQuery`), which would make all of the
   above worse with each feature.

## 2. User stories

- **US-01.** As a developer, I want every feature of the table to be an add-on I list, so I ship only
  what I use: `<Gridwright addons={[columnFilters(), exportMenu()]} />`.
- **US-02.** As an add-on author, I want the same seams the built-in add-ons use, documented and
  typed, so an add-on of mine can put a control beside the sort button, wrap the grid, add a toolbar
  item, add a column, decorate rows and cells, replace the body, announce a change, bring engine
  plugins, and ship strings in several languages.
- **US-03.** As an add-on author, I want my add-on's column options typed on `GridwrightColumn`, exactly
  as the built-in add-ons type theirs.
- **US-04.** As a developer, I want to replace or remove any built-in behaviour, the sort button, the
  selection column, pagination, the stale notice, the loading, empty and error states, by name.
- **US-05.** As a plugin author, I want to add plugins to the defaults, and to suppress a default
  stage while mine is installed.
- **US-06.** As a person using a screen reader, I want every add-on's changes announced through the one
  live region, and a virtualized tree to report its hierarchy like a paged one.
- **US-07.** As a developer composing my own layout, I want the parts to render every add-on's
  contributions without my wiring each add-on into each part.

## 3. Acceptance criteria

### Engine

- [x] **AC-01** `GridEngineOptions.plugins` adds to the core plugins. `corePlugins: false` installs
      none. `useGridwright` applies a changed `plugins` list to a live engine without rebuilding it.
- [x] **AC-02** `PluginContext.suppressStage(id)` skips a registered stage while the returned
      unsubscribe has not been called, whoever registered it, and a suppressed stage returns when the
      suppressing plugin is removed.
- [x] **AC-03** `PipelineStage.skip(context)` lets a stage decide per pass whether it runs, beside the
      existing `capability` rule.

### Add-ons

- [x] **AC-04** `GridAddon` is `{ name, requires?, after?, before?, setup }`. `setup` is called during render, in add-on
      order, may use hooks, and returns an `AddonContribution`. Names are unique; a missing required
      add-on throws a `GridwrightError` naming both.
- [x] **AC-05** A contribution may: transform the grid options (`configure`), add engine plugins,
      extend the column signature, wrap the grid (`provide`), suppress other add-ons' render slots,
      declare `navigation`, contribute toolbar, above-table, below-table and overlay content, table
      attributes, table wrapper props, table keyboard handling and a table footer, header label (one
      owner), header before/after content and header attributes, extra columns, a body replacement (one
      owner), row attributes, row rendering by kind, cell attributes, status renderers, announcements
      and messages.
- [x] **AC-06** Every slot is a render function returning React nodes, or a function returning
      attributes. No slot accepts an HTML string. Attribute contributions merge: class names join,
      styles merge, event handlers run in add-on order, and other attributes take the last add-on's
      value.
- [x] **AC-07** Two add-ons claiming a one-owner slot (`headerLabel`, `body`) throw a `GridwrightError`
      naming both, unless one suppresses the other.
- [x] **AC-08** `<Gridwright />` imports no feature. Its props are data, engine options, i18n,
      presentation, the consumer's own `toolbar`, `footer` and `caption`, `addons` and `coreAddons`.
- [x] **AC-09** `coreAddons()` returns `sorting()`, `selection()`, `pagination()` and `staleNotice()`.
      `coreAddons` on the component replaces that list; `false` renders none of them.
- [x] **AC-10** Parts (`GridToolbar`, `GridHeader`, `GridBody`, `GridVirtualBody`, `GridTable`,
      `GridRoot`) render add-on contributions from context, so a hand-composed layout under
      `GridwrightProvider` gets them without extra wiring.
- [x] **AC-11** One row renderer serves the paged and the virtual body, including extra columns, row and
      cell attributes and row rendering by kind.

### Messages and types

- [x] **AC-12** An add-on ships `messages: { en, …locales }` under its name. `useAddonMessages(name)`
      resolves a key through `translate`, then the `messages` prop (`'<addon>.<key>'`), then the locale
      pack's `addons[name]` (amended, see §8), then the add-on's catalog for the grid's locale and its
      language, then English, with the same plural rules and
      number formatting as core strings. `auditAddonMessages` reports missing keys per locale.
- [x] **AC-13** The core catalog and `GridwrightLabels` hold only the shell's own strings. Every
      feature's English strings live in its add-on; the four other bundled languages live in the locale
      packs under `addons[name]` (amended, see §8), and a test audits every pack against every built-in
      add-on.
- [x] **AC-14** An add-on types its column options by augmenting `GridwrightColumn` through
      `declare module 'apsw-gridwright/react'`, and the built-in add-ons do the same. Verified against
      the built `.d.ts`.

### Built-in features as add-ons

- [x] **AC-15** `sorting()`, `selection()`, `pagination()`, `staleNotice()`, `search()`,
      `columnFilters()`, `exportMenu()`, `rowActions()`, `inlineEditing()`, `treeData()` and
      `virtualRows()` are add-ons using only the public contribution contract. None is imported by the
      component or by a part.
- [x] **AC-16** `treeData()` composes with other plugins and add-ons: it suppresses the core filter,
      search and sort stages instead of replacing the plugin list, forwards `plugins` and
      `onSelectionChange`, and a virtualized tree reports `aria-level`, `aria-posinset`,
      `aria-setsize` and `aria-expanded`.
- [x] **AC-17** `virtualRows()` replaces the body, contributes the scroll container, suppresses
      `gridwright:pagination`, declares `navigation: 'window'`, and exposes its scroll API through
      `useVirtualScroll()`.
- [x] **AC-18** `rowActions()` attaches to rows through row attributes (pointer, focus, click, context
      menu) instead of querying the DOM for `.gw-row[data-row-id]`.

### Gates

- [x] **AC-19** A test builds a third-party add-on in the test suite, from public exports only, that
      uses every slot, and asserts it renders and behaves like a built-in.
- [x] **AC-20** A bundle test proves tree-shaking: an entry importing only `Gridwright` does not contain
      the column filter, export, tree, virtual or row action code.
- [x] **AC-21** Security: no slot accepts an HTML string, attribute contributions cannot set
      `dangerouslySetInnerHTML`, and `scripts/security-audit.mjs` passes.
- [x] **AC-22** Accessibility: every current accessibility test passes with the add-ons, plus the
      virtualized-tree ARIA test.
- [ ] **AC-23** `npm run verify` passes, and both playground pages work with every add-on switched on
      and off in Chrome.

## 4. Non-goals

- **A second adapter.** The add-on contract is React's. The engine stays headless and its plugins
  stay framework-free.
- **Sandboxing add-on code.** An add-on is code the application chose to install and runs with the
  same rights as a cell renderer. The contract refuses to *widen* that (no HTML-string slots), not to
  confine it.
- **Runtime add-on discovery or loading.** Add-ons are imported and listed; nothing is fetched or
  registered globally.
- **Implementing the draft features** (column layout, cell navigation and clipboard, grouping and
  aggregation, multi-column sort badges, selection controls beyond today's behaviour, view-state
  sync). Their specs are rewritten to deliver as add-ons on this contract, and this spec includes the
  seams they need; building them is their own work.
- **Keeping the removed props as shorthands.** The package is unpublished; a prop that imports a
  feature is exactly what this change removes.

## 5. Behaviour across the capability seam

Unchanged. Add-ons that bring engine plugins obey `capabilities` exactly as core plugins do; add-ons
that only render never branch on where rows came from. `suppressStage` and `skip` are generic: they
do not know about local or remote data.

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | core stages run unless an add-on suppressed them (the tree suppresses filter, search and sort and runs its own) |
| everything (server) | capability-skipped stages stay skipped; add-on stages declare `capability` or `skip` the same way |
| pagination only | unchanged |

## 6. Accessibility and interface copy

- The live region stays single. Add-ons contribute announcements with a priority; the shell keeps its
  rules (loading first, silent on error because an alert already speaks).
- Header content from add-ons renders outside the sort button, never inside it.
- Extra columns render real `<th scope="col">` and `<td>` cells and count toward `colSpan`.
- A virtualized body renders the same row attributes as the paged body.
- Every add-on string is in its add-on's English catalog and in every bundled locale pack's `addons`
  section (`de`, `es`, `fr`, `pl`).

## 7. Clarifications

- **Why render functions instead of components in slots?** `setup` runs on every render. A component
  defined inside it would get a new identity each time and remount, losing its state. A render
  function returns elements of module-level components, whose identity is stable; state lives in
  those components or in the add-on's provider. Render functions must not call hooks; `setup` may.
- **Why is `setup` a hook?** The tree needs a controller that lives as long as the grid, virtualization
  needs a scroll ref, filters need open-dialog state. Calling `setup` in add-on order on every render
  follows the rules of hooks as long as the list of names does not change; a changed list remounts the
  grid, which is the same rule that already applies to switching between a flat grid and a tree.
- **Why do `plugins` now add instead of replace?** Replacement made one add-on's plugins and another's
  mutually exclusive, and made trees drop the consumer's plugins. Suppressing a stage by id gives the
  tree what replacement gave it without taking anything from anyone else.
- **Why is the selection engine not an add-on?** Selection state is part of `GridState` and every
  operation is public `GridApi`. Nothing about it is privileged; only its UI is a feature, and that UI
  becomes `selection()`.
- **Why keep a default set?** A table with no sort buttons, no selection column and no pagination is a
  valid table but a poor default. `coreAddons()` mirrors `corePlugins()`: on by default, replaceable,
  removable, with no privilege.
- **Why `'<addon>.<key>'` for message overrides?** It keeps one `messages` prop and one `translate`
  function for the whole grid, which is what an i18n library integration expects, while add-on keys
  cannot collide with each other or with the shell's.
- **Why declaration merging for column options?** Tested on the built `.d.ts`: an augmentation through
  the relative `./types` path does not survive bundling, and one through `'apsw-gridwright/react'`
  does, for the repository and for a consumer. It is also exactly what a third-party add-on writes.
- **What replaces `TreeGridwright` and `useTreeGridwright`?** `treeData()` as an add-on, on
  `<Gridwright />` or `useGridwright`. The tree controller reaches the application through
  `treeData({ controllerRef })` and inside the grid through `useTreeContext()`.
- **Does an add-on see other add-ons' state?** Only through what they export: contexts, hooks and
  names. `requires` declares the dependency.

## 8. Decisions made during implementation

Recorded at stage 6 rather than silently widened, each with the reason.

- **Translations of the built-in add-ons live in the locale packs, not in the add-ons.** Five languages
  inside each add-on would put every translation into the React bundle of every application, where the
  packs exist precisely so an application pays only for the languages it imports. A pack now carries
  `addons: { '<name>': { … } }`, outranking an add-on's own catalog for the same language because the
  pack is the application's choice. A third-party add-on may still ship its languages in `messages`,
  and a pack of the application's own may translate it. AC-12 and AC-13 are amended to match.
- **`after` and `before` on `GridAddon`.** Inline editing has to wrap a cell before the tree wraps it
  in indentation, whatever order a consumer lists them. A soft, stable ordering constraint is the
  general form; inline editing declares `before: ['gridwright:tree']`, and a third-party cell wrapper
  can declare the same.
- **`toolbarStatus`.** A selection count that makes a toolbar appear pushes the row being ticked out
  from under the pointer. Status items render only while a `toolbar` item or the grid's own `toolbar`
  does.
- **`AnnouncementContributor.key` and `AnnouncementChange.t`.** The live region has to know when to
  re-evaluate without repeating itself on every selection, and a contributor has to phrase its
  sentence in the add-on's own strings outside a component.
- **`instance.announce(sentence)` and no export live region.** An export finishing is not grid state,
  but a second region beside the grid's speaks over it. The announcer re-renders only the region.
- **Slot functions receive the grid context**, the instance plus labels, translator and class names,
  so an add-on can apply `classNames.rowSelected` or translate without a hook.
- **Attributes pass an allowlist, not a denylist.** AC-21 asked that attribute contributions cannot set
  the HTML-injection prop. An allowlist (handlers as functions, `aria-*` and `data-*` as scalars, and a
  short list of inert attributes) also refuses URL attributes and string handlers, and refuses an
  attribute React adds later until someone decides it is safe.
- **A slot function that throws renders nothing and reports the add-on by name**, the rule a pipeline
  plugin already follows.
- **No per-add-on `labels` option.** Every add-on string is overridable through `messages` under the
  add-on's name, which is one mechanism instead of two.
- **Row actions are `useBubbleMenu` plus `BubbleMenuView`, both exported.** The add-on attaches the
  controller's handlers through `rowAttributes` (AC-18). `BubbleMenu` remains for a layout whose rows
  are not rendered through add-ons, and forwards native events into the same handlers, so there is
  one behaviour. A hover menu closes a task after the pointer leaves a row, cancelled by the menu or
  the next row, rather than trusting the leave event's `relatedTarget`.
- **`extraCellAttributes` and `extraHeaderAttributes`.** Added when the draft specs were rewritten onto
  this contract: column pinning and cell navigation both need to reach another add-on's extra column
  cells, and without a seam only a stylesheet keyed on a class name could.
- **A custom export format's `label` and `name` may be `(t) => string`**, resolved through the export
  add-on's strings when the menu renders. `markdownReportFormats` uses it, so "Roster (PDF)" is a
  translatable `reportPdf` string instead of English spliced in code.
- **The live region holds its sentence while a debounced query is pending**, moves its comparison
  baseline only when a fetch settles (`state.version`), and re-speaks when the language changes.
  Found in the browser: a debounced remote sort announced itself early and the result said the row
  range.
- **The pagination range is no longer a live region.** It repeated the grid region's range.
- **The tree controller is destroyed a task after unmount**, not in the effect cleanup, so Strict
  Mode's double effect no longer leaves a destroyed controller that silently stops loading children.

# Lifecycle contract: add-on architecture

> **Immutable during stage 6.**

## Events added or changed

None. Add-ons use `api.on` like any other code.

| Event | Payload | Emitted when |
| :--- | :--- | :--- |
| — | — | — |

## Ordering guarantees

### Resolution, on every render of a grid

1. The add-on list is `coreAddons` (default `coreAddons()`) followed by `addons`. Names must be unique;
   a duplicate throws a `GridwrightError`.
2. `requires` is checked against the list; a missing name throws, naming both add-ons.
3. `setup` is called for each add-on in list order. Each receives the options as the add-ons before it
   left them; its `configure` is applied before the next add-on's `setup` runs.
4. Suppression is applied: an add-on named in any contribution's `suppresses` has its render slots,
   status renderers, announcements and `provide` ignored. Its `configure`, `plugins` and messages still
   apply, because suppressing a view must not change the data.
5. One-owner slots are checked: two unsuppressed owners of `headerLabel` or of `body` throw.
6. The engine is created from the configured options on first render. On later renders it is updated
   exactly as today (columns by signature, data source by identity, page size, selection mode), and
   the plugin set is reconciled by plugin name.

A changed list of add-on names remounts the grid, because `setup` calls hooks in list order.

### Rendering

- `provide` wraps are applied with the first add-on outermost, inside `GridwrightProvider` and inside
  the root element, so an add-on's context sees the translator and the theme.
- Slot content renders in add-on order: toolbar items, above-table, below-table and overlays.
  `toolbar` renders when any item contributes or the consumer passed `toolbar`.
- Header cells render `headerBefore`, then the label (the `headerLabel` owner, or the header text),
  then `headerAfter`, all outside any control another add-on renders.
- Extra columns with `placement: 'start'` render before data columns in add-on order, `'end'` after.
- A row renders through `renderRow` if an add-on returns non-undefined for it (first add-on wins),
  otherwise through `GridRowView` with merged row attributes and cell attributes.
- Attribute merge: `className` joined with spaces in add-on order; `style` shallow-merged, later wins;
  functions whose name starts with `on` run in add-on order; everything else, later wins.
- `tableKeyDown` handlers run in add-on order until one returns `true`.

### Announcements

The shell computes its sentence exactly as before for loading (first) and error (silent). For a
settled state, every unsuppressed contributor's `describe` runs with the previous and next states; the
highest-priority non-null sentence wins, and the shell's range or total is used when all return null.
Ties go to the earlier add-on. `describe` runs in an effect, never during render, so Strict Mode's
double render cannot consume a change.

### Messages

`useAddonMessages(name)(key, values)` resolves in this order: `translate('<name>.<key>')` when it
returns something other than the key; `messages['<name>.<key>']`; the add-on's catalog for the grid's
locale; for its base language; English; and finally the key itself, which `auditAddonMessages` exists
to prevent.

## Pipeline stages added

None. `suppressStage` and `skip` change when existing stages run:

- A stage runs when it is not suppressed, its `capability` is not resolved by the source, and `skip`
  (if any) returns false.
- Suppression is reference-counted: two plugins suppressing one stage keep it off until both release.

## Teardown

- A plugin's suppressions are released when the plugin is removed, through the unsubscribe it
  returned from `setup`, or when the engine is destroyed.
- An add-on's hooks follow React's lifecycle: removing the add-on remounts the grid.
- Reconciling `plugins` on a live engine removes a plugin whose name disappeared (running its
  teardown) and installs one whose name appeared, without refetching unless a stage set changed the
  rows, in which case `invalidatePipeline()` recomputes from the cached result.

# Spec: Conditional add-ons in the list

## Problem

`docs/getting-started.md` says listing an add-on conditionally (`showFilters && columnFilters()`) works. It does not:
`orderAddons` reads `false.name`, finds no string, and throws "an add-on needs a non-empty name". The type
`readonly GridAddon<TRow>[]` rejects the expression at compile time too. The documented pattern has never worked.

## Behaviour

- **AC-01** `addons` and `coreAddons` accept `false`, `null` and `undefined` entries. They are skipped before validation,
  so `[search(), isAdmin && inlineEditing()]` is a valid list.
- **AC-02** A skipped entry takes no part in naming, duplicate, `requires` or ordering checks.
- **AC-03** `<Gridwright />` keys on the names of the add-ons that remain, so a flipped condition remounts the grid as
  any changed list does. That is unchanged and documented as resetting state, not only the page.
- **AC-04** A real malformed add-on (empty name, no `setup`) still throws.

## Out of scope

Keeping state across a changed add-on list. Each `setup` may call hooks, so the remount is required.

## Artifacts not written

- `plan.md`: one filter in `orderAddons` and a widened type; the AC list is the plan.
- `tasks.md`: a single step; nothing worth tracking.
- `data-model.md`: no data or state shape changes.
- `research.md`: nothing to compare; the behaviour was already specified by the docs.
- `events.md`: no event is added or changed.

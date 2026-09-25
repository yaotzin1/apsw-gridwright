# API surface contract: multi-column sorting

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: no export, type or signature changes. The `sorting()` add-on gains three message keys
and renders new markup (a priority badge while more than one column is sorted, and a longer
`title` on the sort button while `multiSort` is on). Adding messages is additive: a consumer
override written against the old keys still resolves, and a missing translation falls back to
English. The rendered-markup change is visible, which is what makes this a feature, but it removes
nothing a consumer could depend on. The button's accessible name is unchanged, because the badge is
`aria-hidden` and the hint is in `title`, which is a description.

## Exports added

None.

## Exports changed

None. `SortingOptions` keeps its one field, `multiSort`.

## Messages added (`gridwright:sorting`)

| Key | English | Used |
| :--- | :--- | :--- |
| `sortedAscendingPriority` | `{column}, sort priority {priority}, sorted ascending` | announcement, while `query.sort.length > 1` |
| `sortedDescendingPriority` | `{column}, sort priority {priority}, sorted descending` | announcement, while `query.sort.length > 1` |
| `actionWithShift` | `{action} (Shift: keep other columns sorted)` | the sort button's `title`, while `multiSort` is on; `{action}` is `ascending`, `descending` or `clear` |

Translated in `de`, `es`, `fr`, `pl` under each pack's `addons['gridwright:sorting']`.

The hint describes what Shift does in every state rather than only the first one: Shift-activating
an unsorted column adds it, an ascending one flips it, and a descending one removes it, and in all
three cases the other sorted columns stay. "Shift to add to the sort", proposed in the spec, is
wrong for two of the three.

## Markup added

| Where | Markup | When |
| :--- | :--- | :--- |
| inside `.gw-sort-button`, after `.gw-sort-indicator` | `<span class="gw-sort-priority" aria-hidden="true">{n}</span>` | the column is sorted and `query.sort.length > 1`; `n` is its 1-based index in `query.sort` |
| `.gw-sort-button` `title` | `Sort ascending (Shift: keep other columns sorted)` instead of `Sort ascending` | `multiSort` is on (its default); unchanged with `multiSort: false` |

The title is copy, not an option: no option's default changes, and a consumer who wants the old text
overrides `gridwright:sorting.actionWithShift` with `'{action}'`.

## Defaults introduced or changed

None.

## Behaviour fixed (patch)

Returned to stage 3 from stage 6 on 2026-09-25, when the badge test showed the order moving.

| Method | Before | After |
| :--- | :--- | :--- |
| `GridApi.toggleSort(id, { additive: true })` on an ascending column | removed it and appended it as descending, so a primary sort became the last tie-breaker | reverses it where it stands |

Spec §1 and AC-02 already said "changes it in place", and `docs/api.md` never described the order, so
this restores the specified behaviour rather than changing a documented one. It does change the
order of `query.sort` that a source with `capabilities.sort` receives after a Shift-reversal, which
is the order the reader now sees in the badges. Covered by `tests/unit/engine-local.test.ts`
("reverses an additive column where it stands in the sort").

## Type entry points

- [x] Every type appearing in a new signature is itself exported (no new signatures)
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes

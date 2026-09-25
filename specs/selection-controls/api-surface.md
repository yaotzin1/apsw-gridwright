# API surface contract: selection controls

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: two optional fields on an exported options type, one message and one class, all additive.
Both new options default to today's behaviour, so a grid that does not set them renders and behaves
exactly as before.

## Exports added

None.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `SelectionOptions` (`apsw-gridwright/react`) | `{ checkboxes?, count? }` | `{ checkboxes?, count?, selectAll?, selectOnRowClick? }` | minor: optional fields |

```ts
export interface SelectionOptions {
    readonly checkboxes?: boolean;
    readonly count?: boolean;
    /** The select-page checkbox in the checkbox column's header. Default true. */
    readonly selectAll?: boolean;
    /**
     * Clicking a row toggles its selection, and with `cellNavigation()` so does Space on a focused
     * cell that holds no control. Default false.
     */
    readonly selectOnRowClick?: boolean;
}
```

Reached as `coreAddons({ selection: { ... } })`, which already passes `SelectionOptions` through.

## Messages added (`gridwright:selection`)

| Key | English | Used |
| :--- | :--- | :--- |
| `selectColumn` | `Selection` | the checkbox column's header name, visually hidden, when `selectAll` is false |

Translated in `de`, `es`, `fr`, `pl`.

## Markup added

| Where | Markup | When |
| :--- | :--- | :--- |
| the checkbox column's `<th>` | `<span class="gw-visually-hidden">Selection</span>` instead of the select-page checkbox | `selectAll: false` |
| each body `<tr>` | class `gw-row--selectable` | `selectOnRowClick` on and `selectionMode` is not `none` |

## Behaviour added

| Trigger | Effect | Unless |
| :--- | :--- | :--- |
| click on a body row | `api.toggleRowSelection(row.id)`, after the grid's own `onRowClick` | the target is inside `button`, `a`, `input`, `select`, `textarea`, `label`, `[role=button]`, `[role=checkbox]`, `[role=switch]`, `[role=link]`, `[role=menuitem]`, `[contenteditable]`; or the click ended a text selection inside the row |
| `Space` on a focused body cell of this table | `api.toggleRowSelection` for its row; default prevented | the cell holds a control (`cellNavigation()` operates it); a modifier is held |

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| `selectAll` | (did not exist; behaved as `true`) | `true` |
| `selectOnRowClick` | (did not exist; behaved as `false`) | `false` |

## Type entry points

- [x] Every type appearing in a new signature is itself exported
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes

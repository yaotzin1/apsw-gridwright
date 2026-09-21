# API surface contract: refusing a column layout change

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor.** One optional option, one added method on an interface consumers receive and never
implement, and one new exported type. Nothing existing changes signature or default, and a grid that
passes no `canChange` behaves exactly as it does today — `allows` returns true for everything the
add-on's own rules permit.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `ColumnLayoutChange` | `./react` (type) | the discriminated union below |
| `ColumnLayoutResolved` | `./react` (type) | the resolved view below |

```ts
/**
 * A change to the layout, described before it happens, for `columnLayout({ canChange })` and
 * `useColumnLayout().allows`.
 *
 * A union rather than a string and a bag of optionals, so a rule about one kind of change cannot
 * accidentally read a field that belongs to another.
 */
export type ColumnLayoutChange =
    | { readonly type: 'width'; readonly columnId: string; readonly width: number }
    | { readonly type: 'pin'; readonly columnId: string; readonly side: ColumnPin | null }
    | { readonly type: 'visibility'; readonly columnId: string; readonly hidden: boolean }
    | { readonly type: 'move'; readonly columnId: string; readonly toIndex: number }
    | { readonly type: 'showAll' }
    | { readonly type: 'reset' };
```

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `ColumnLayoutOptions` | — | `+ readonly canChange?: (change, layout, resolved) => boolean` | Additive, optional |
| `ColumnLayoutController` | — | `+ allows(change: ColumnLayoutChange): boolean`, and now `extends ColumnLayoutResolved` | Additive; received, never implemented |

```ts
/**
 * What is actually true of the layout, as opposed to what was saved. `ColumnLayoutController`
 * extends it, so the guard's resolvers are the controller's and the two cannot drift.
 *
 * No `allows`: `allows` is what calls the guard, so a guard able to call it would recurse.
 */
export interface ColumnLayoutResolved {
    readonly order: readonly string[];
    widthOf(columnId: string): number;
    pinOf(columnId: string): ColumnPin | null;
    isHidden(columnId: string): boolean;
    indexOf(columnId: string): number;
}
```

```ts
export interface ColumnLayoutOptions {
    // ...existing...
    /**
     * Called before every change the add-on commits. Return false to refuse it.
     *
     * It narrows and never widens: a change the add-on already refuses stays refused whatever this
     * returns, so a column declared `movable: false` cannot be unlocked by a guard.
     */
    readonly canChange?: (
        change: ColumnLayoutChange,
        layout: ColumnLayoutState,
        resolved: ColumnLayoutResolved,
    ) => boolean;
}

export interface ColumnLayoutController {
    // ...existing...
    /**
     * Whether that change would be allowed, without making it: the add-on's own rules and then
     * `canChange`. What the built-in controls disable themselves from, and what a control of your
     * own should ask.
     */
    allows(change: ColumnLayoutChange): boolean;
}
```

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |
| — | — | — |

## Defaults introduced or changed

No existing default changes. No rendered markup changes for a grid that passes no `canChange`.

| Option | Old default | New default |
| :--- | :--- | :--- |
| `columnLayout({ canChange })` | — | absent, meaning every change the add-on's own rules allow |

One behaviour worth stating although it changes nothing by default: **the picker's disabled states
now consult `allows`** as well as the column's own options. A grid with no guard sees identical
results, because `allows` is then exactly the add-on's own rules.

> **Returned to stage 3 during implementation.** The first version of this file also said
> `canHide(columnId)` would consult `allows`. It cannot: `allows` consults `canHide` to decide
> whether the add-on's own rules permit hiding, so the two would call each other forever.
> `canHide`, `canResize` and `canMove` keep one meaning — *the column's own rules* — and `allows` is
> the composite that adds the guard on top. The picker asks `allows` directly, which is what AC-05
> actually needs and is the same call a consumer's own control makes.

## Type entry points

- [x] `ColumnLayoutChange` and `ColumnLayoutResolved` are exported, and `ColumnPin` and
      `ColumnLayoutState`, which they and the guard signature name, already are
- [ ] Both `import` and `require` conditions still resolve types — checked at stage 7
- [ ] `npm run check:exports` passes — checked at stage 7

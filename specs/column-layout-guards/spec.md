# Specification: refusing a column layout change

> **Status**: Implemented (all eight stages)
> **Stage entry**: 1
> **Semver impact**: minor (one option on `columnLayout()`, one method on the controller, one new
> exported type; nothing existing changes; confirmed in api-surface.md)

---

## 1. The consumer problem

`columnLayout()` can already lock a column: `layout: { resizable: false }`, `{ hideable: false }`,
`{ movable: false }`. Those are read from the column definition on every render, so they are not
even static — `hideable: user.isAdmin` works today.

What they cannot express is a rule about **more than one column**, or about the layout as a whole:

- "At most three columns pinned at once", because the fourth is what starts pushing the scrolling
  region off screen.
- "The pinned columns may not add up to more than half the grid", for the same reason.
- "Not while a bulk edit is in flight."
- And one gap that is not cross-column at all: **there is no per-column lock for pinning.**
  `layout: { pinned }` sets a value; there is no `pinnable: false`. A developer who wants a column
  the reader may not freeze has nothing to say.

Today the only way to express any of these is to switch the built-in picker off
(`columnLayout({ picker: false })`) and rebuild it, which means reimplementing a `role="menu"`, its
arrow-key handling, its focus return, its grouping and its five translated strings, to change one
rule. That is a large amount of work to say "no".

## 2. User stories

- **US-01.** As a developer, I want to refuse a layout change my application's rules do not allow,
  without replacing the controls that request it.
- **US-02.** As a developer, I want the control that would make a refused change to *look* refused,
  so a reader is not left pressing something that silently does nothing.
- **US-03.** As a developer, I want the rule to see the whole layout, not just the column, so
  "at most three pinned" is expressible.
- **US-04.** As a developer, I want one place for the rule, so a change made from the picker, from a
  drag, from the keyboard and from my own control are all governed by it.

## 3. Acceptance criteria

- [x] **AC-01** `columnLayout({ canChange })` is consulted before every change the add-on commits:
      a width, a pin, a visibility toggle, a move, `showAll` and `reset`. Returning `false` refuses
      the change and nothing is written.
- [x] **AC-02** It receives a described change and the current `ColumnLayoutState`, so a rule can be
      written about the column, about the change, or about the whole layout.
- [x] **AC-03** It **narrows and never widens**: a change the add-on already refuses — a column with
      `movable: false`, the last visible column, reordering switched off — stays refused whatever
      `canChange` returns. A guard cannot grant permission the add-on does not have.
- [x] **AC-04** `useColumnLayout().allows(change)` answers the same question without making the
      change, so a consumer's own control can disable itself, and so the built-in controls can.
- [x] **AC-05** The built-in controls reflect it where the change is knowable in advance:
      - a column the guard refuses to hide is `aria-disabled` in the picker, exactly as
        `hideable: false` already is;
      - a pin toggle the guard refuses is `aria-disabled`.
      A move and a resize are not knowable in advance — the target index and the final width are
      decided by the gesture — so those are refused on commit, which AC-06 covers.
- [x] **AC-06** A refused change is silent in the live region: nothing happened, and a grid that
      announces what it declined is a grid that argues with its reader. What the control looks like
      is the feedback, and where that is impossible the consumer's own rule is the place that knows
      how to explain itself.
- [x] **AC-07** No new string, in any language. A guard is the application's policy and only the
      application can phrase it.
- [x] **AC-08** Zero runtime dependencies, and no change to the add-on contract.

## 4. Non-goals

- **Transforming a change.** `canChange` returns a boolean, not a replacement layout. A hook that
  could rewrite the change would have to be trusted to return something valid, and every clamp,
  every pin rule and every order invariant would need re-checking afterwards. Refusing is the whole
  of what is needed for the problem in §1.
- **An asynchronous guard.** A confirm dialog before a column moves is an application flow, not a
  predicate: the gesture has already happened and the state has to settle. A consumer who wants one
  drives the change themselves through the controller.
- **A reason string.** See AC-07. The package cannot phrase the application's policy, and a generic
  "not allowed" is worse than the control simply being disabled.
- **Guarding what the consumer does directly.** `controller.setWidth` and friends are the same
  entry points the built-in controls use, so a guard applies to them too. This is deliberate and
  worth saying, because it means a consumer cannot use the controller to step around their own rule
  — and if they want to, the rule belongs somewhere else.
- **A second guard for the engine.** Nothing here touches `ColumnDef` or the pipeline.

## 5. Behaviour across the capability seam

Nothing in this feature reads or writes `GridQuery`, makes a request, or asks where a row came from.
A guard governs the add-on's own state.

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | Identical |
| everything (server) | Identical |
| pagination only | Identical |

The one indirect effect is the one `hidden` and `order` already have: a refused visibility change
means the engine's columns do not change, so search and export do not either.

## 6. Accessibility and interface copy

No new string in any language (AC-07).

The accessibility work is in AC-05: a control that will refuse says so before it is pressed, using
the pattern the picker already uses for `hideable: false` — `aria-disabled`, not `disabled`, so the
item keeps its place in the arrow-key order and can still be reached and read. An item a reader
cannot reach cannot tell them why it will not move.

Where the change is not knowable in advance — a resize, whose final width the gesture decides, and a
move, whose destination it decides — the refusal happens on commit and nothing is announced (AC-06).
The alternative is a live region that says "no" to a reader who may not have been trying to do the
thing that was refused.

## 7. Delivery as a plugin

**Engine.** None.

**React add-on.** No new add-on and no new module. `columnLayout()` gains an option, and its
controller gains a method.

| Slot | Use |
| :--- | :--- |
| `setup` (hooks) | the guard is read from options; `allows` closes over it and the current layout |
| `headerAttributes` | unchanged; the drag and keyboard paths call the same controller methods |
| — | no new slot, no new contract seam |

**What cannot be an add-on.** Nothing, and this feature is a smaller version of the same evidence
`specs/column-reordering` gave: it changes no contract. A third-party add-on that wanted its own
layout rules would write its own controller; this option exists so that a consumer using the
built-in one does not have to.

## 8. Clarifications

- **C-1. Why a predicate and not a transform.** Considered and rejected: a hook returning a
  replacement `ColumnLayoutState` would let a consumer express "clamp to 300 instead of refusing",
  at the cost of the add-on having to re-validate everything it just computed — the width clamp, the
  pin rule for a moved column, the order invariants — because the returned state is unvalidated
  input. `layout: { maxWidth: 300 }` already expresses that particular wish. Refusal is the smallest
  thing that solves §1, and it is total: there is no way to return a layout the grid cannot render.
- **C-2. Why the guard cannot widen.** A guard that could return `true` for a column declared
  `movable: false` would make the column option advisory, and two mechanisms saying opposite things
  about one column is the kind of ambiguity that is discovered in production. The add-on's own rules
  are the floor; the guard is a ceiling.
- **C-3. Why `allows` is on the controller rather than the guard being called twice.** A consumer's
  own control needs the same answer the built-in ones get, and the built-in ones need it to render
  `aria-disabled`. One method both ask means one definition of "allowed" and no chance of the picker
  and a consumer's toolbar disagreeing.
- **C-4. Why `reset` and `showAll` are guarded too.** They are changes, and a rule like "at most
  three pinned" is about the state they produce. Guarding the fine-grained operations and leaving
  the coarse ones open would make the rule trivially avoidable by pressing "Reset layout".
- **C-5b. `canHide` does not consult the guard; `allows` does.** Found at stage 6 and sent back to
  stage 3. `allows` asks `canHide` whether the add-on's own rules permit hiding, so a `canHide` that
  asked `allows` would recurse forever. The three `can*` predicates keep one meaning — the column's
  own rules — and `allows` is the composite. The picker asks `allows`, which is what AC-05 needs and
  is the same call a consumer's control makes, so the two cannot disagree.
- **C-5. Why nothing is announced.** A refused change is a thing that did not happen. Announcing it
  means the live region interrupts to describe a non-event, and for the refusals that happen on
  commit the reader may not even have been the one asking.

## Artifacts not written

- `plan.md`: the modules are `types.ts`, `context.tsx` and `GridColumnPicker.tsx`, all named in §7,
  and the change is one predicate consulted in one place. A plan document would restate the
  acceptance criteria in a different order.
- `tasks.md`: the work is a single ordered pass over those three files plus its tests and
  documentation, with nothing that can be done out of order and nothing worth tracking separately.
- `data-model.md`: no state shape changes. The one new type is a described change, and it is written
  out in full in `api-surface.md` where its exportability is also settled.
- `research.md`: one alternative was considered — a transform hook instead of a predicate — and it
  is recorded as clarification C-1 with the reason it was rejected. There is no prior art worth
  citing and no measurement to make: the guard runs once per committed change, not per row or per
  render.
- `events.md`: no event, no pipeline stage, no listener, no timer and no subscription. The guard is
  a pure function the add-on calls; `columnLayout({ onChange })` is unchanged and still fires only
  for changes that were actually committed, which is the one ordering guarantee this feature
  touches and it is stated in `specs/column-layout/events.md`.

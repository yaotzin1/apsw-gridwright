# Self-review: refusing a column layout change

Answer all seven. See [`.agents/rules/review.md`](../../.agents/rules/review.md).

## 1. Boundary and layering

Nothing under `src/core`, `src/data`, `src/plugins`, `src/tree`, `src/i18n` or `src/locales`
changed — not even a locale pack, because the feature adds no string.

Three files under `src/react/layout/`: the type, the controller, and the picker reading it. No new
module, no new component, no DOM, and nothing new in `layout.ts` because a guard is not arithmetic.

The structure that matters is the split between `ownRules` and `allows`. `ownRules` is the add-on's
own answer for one change; `allows` is that answer and then the consumer's guard. Keeping them
apart is what makes "narrows, never widens" structural rather than a promise: the guard is only
reached when `ownRules` already said yes, so there is no path by which a guard grants permission.

## 2. The local/remote seam

Nothing here reads or writes `GridQuery`, makes a request, or asks where a row came from. A guard
governs the add-on's own state, and the same guard runs over an array and over a paginating
endpoint. No `capabilities` facet is involved.

The one indirect effect is the one `hidden` and `order` already have, and it is the desirable
direction: a refused visibility change means the engine's columns do not change, so search and
export do not either. A refusal leaves nothing half-applied.

## 3. Public surface and semver

**Minor.** One optional option, one added method on an interface consumers receive and never
implement, one new exported type. Nothing existing changes signature or default. A grid that passes
no `canChange` renders identical markup and behaves identically, because `allows` is then exactly
the add-on's own rules — asserted by a test rather than assumed.

Added: `ColumnLayoutChange`. Changed: `ColumnLayoutOptions` gained `canChange?`,
`ColumnLayoutController` gained `allows`.

**One return to stage 3 during implementation**, recorded in `api-surface.md` and as clarification
C-5b rather than quietly diverged from: the contract said `canHide` would consult `allows`. It
cannot — `allows` consults `canHide` — so the two would recurse forever. `canHide`, `canResize` and
`canMove` keep one meaning, the column's own rules, and the picker asks `allows` directly, which is
what the acceptance criterion actually needed.

The design decision worth defending is the one in C-1: **a predicate, not a transform.** A hook
returning a replacement state would let a consumer clamp instead of refuse, at the cost of the
add-on re-validating everything it had just computed, because the returned state would be
unvalidated input. `layout: { maxWidth }` already expresses that particular wish. Refusal is total:
there is no way for a guard to produce a layout the grid cannot render.

## 4. Accessibility and i18n

**No new string, in any language** — the one acceptance criterion that is about what was *not*
added. A guard is the application's policy, and a generic "not allowed" from the package would be
worse than silence because it explains nothing. There is deliberately no reason string.

The accessibility work is that a control which will refuse says so **before** it is pressed. The
picker's items and pin toggles are `aria-disabled` when the guard would refuse them, using the
pattern already established for `hideable: false` — `aria-disabled`, not `disabled`, so the item
keeps its place in the arrow-key order and can still be reached and read. An item nobody can reach
cannot tell them why it will not move.

Where the change is not knowable in advance the refusal happens on commit and nothing is announced:
a resize's final width and a drag's destination are decided by the gesture. Announcing a refusal
would have the live region interrupt to describe a non-event, and for a commit-time refusal the
reader may not have been the one asking.

## 5. Supply chain and packaging

No new dependency, no new file, no new entry point, no change to `files` or the export map. The
feature is one optional function call.

The security questions from `application_security/SKILL.md`:

1. **Which untrusted inputs does this change touch, and which sink does each reach?** None that are
   new. The guard is consumer code, not data.
2. **Does any new code create a string that becomes markup, a URL, a selector, a style or a
   script?** No — it creates no string at all.
3. **Does any new extension point let third-party code reach something a consumer's renderer could
   not?** `canChange` is a new extension point, and it is the narrowest shape available: it receives
   a plain described change and the current state, and its only power is to return `false`. It
   cannot write state, cannot render, and cannot widen its own permissions. A guard that throws is
   caught, reported through `console.error`, and treated as permission — failing open rather than
   silently locking a reader out of their own grid, which is the choice that matches every other
   extension point here (a plugin that throws loses its own effect and nothing else).
4. **Did the security audit pass, and did it scan `dist/`?** Yes, both — see §7.

Worth stating because it is a deliberate non-defence: a guard is **not** a security boundary. It
governs the add-on's UI state, not the engine, and a consumer who needs a column genuinely
unreachable should not send it. `docs/column-layout.md` frames it as application policy throughout
and never as protection.

## 6. Honest output

Nothing is displayed that was not asked for and nothing is invented. The feature's entire output is
an `aria-disabled` attribute on controls that would refuse, which is the opposite of the failure
mode this dimension is about: it tells the reader the truth about what will happen before they try.

The one place it could have been dishonest is a control that looks available and then does nothing,
which is precisely what AC-05 exists to prevent for the two cases where the answer is knowable, and
what AC-06 accepts honestly for the two where it is not.

## 7. Verification

`npm run verify`, end to end, on the final tree:

```
> apsw-gridwright@0.7.0 verify
> npm run clean && npm run validate:skills && npm run sync:check && node scripts/security-audit.mjs --source && npm run typecheck && npm run lint && npm run test && npm run test:smoke && npm run check:exports && npm run security:audit

✨ All 16 skills validated successfully! (0 Security Threats / 0 Syntax Errors)

.claude/skills is in sync (16 skills)
AGENTS.md and GEMINI.md are in sync (4 tracks, 8 stages, 16 skills, 8 gates, 14 rules)
workflow.ai.yml matches the repository
security audit: no findings (source, manifest)

> tsc --noEmit
> eslint .

> vitest run
 Test Files  36 passed (36)
      Tests  642 passed (642)

> npm run build && vitest run --config vitest.smoke.config.ts
 Test Files  2 passed (2)
      Tests  25 passed (25)

> node scripts/check-exports.mjs
  ok   core bundle and shared chunks contain no react import
  ok   no runtime dependencies
  ok   react ESM entry exports 43 expected names
  ok   both entries share one module instance
the published package resolves cleanly.

> node scripts/security-audit.mjs
security audit: no findings (source, manifest, dist)
```

642 tests, up from 631: eleven new, all in `tests/react/column-layout.test.tsx` because a guard is
only observable through the controls that consult it.

| Test | Holds |
| :--- | :--- |
| per-operation refusals | a width, a move, a pin and a visibility change are each asked and each refused, with the change the guard received asserted exactly — including that a width and a move arrive already clamped |
| the drag | a drop is refused too, because both gestures go through the same controller |
| `showAll` and `reset` | both asked; a refused reset leaves the width it would have undone |
| **narrows, never widens** | a guard returning `true` for everything still cannot hide a `hideable: false` column |
| cross-column rules | "at most one pinned" allows the first and disables the second, which is the problem §1 opens with |
| `allows` | agrees with what is enforced on commit, for the guard's refusals and for the add-on's own |
| a throwing guard | the change is allowed and the throw is reported |
| no guard at all | identical behaviour, so the default path is asserted rather than assumed |

No browser pass was needed for this feature and none is claimed: it renders no new element and has
no gesture of its own. What it changes is an attribute on controls whose behaviour was driven in
Chrome when they were built, and every branch it adds is observable in the accessibility tree, which
is where the tests query it.

## Returned to at stage 8, after shipping

Two defects were found reviewing this feature against `workflow.ai.yml` once it was already in
`0.8.0`, and both are fixed under `Unreleased`:

1. **"Show all columns" and "Reset layout" did not consult `allows`.** AC-05 exempts a move and a
   resize because a gesture decides their value; it does not exempt these, and neither names a
   column or carries a number. A guard refusing `reset` therefore left a live-looking menu item
   that did nothing, which is exactly US-02. Worse, the refused reset still closed the menu -- the
   one visible consequence of a change that did not happen, which reads as success. Both now carry
   `aria-disabled`, a refused reset leaves the menu open, and the guard is asked only while the menu
   is open so a closed picker does not call it on every render. Three tests, including one that
   asserts both stay live when the guard permits them.
2. **Nothing about the feature was in `CHANGELOG.md`.** The `0.8.0` entry for `columnLayout()`
   enumerates every new export and named none of `canChange`, `allows` or `ColumnLayoutChange`, so a
   consumer reading the changelog could not discover the feature at all. The `0.8.0` entry now
   carries it, marked as documenting what already shipped rather than as a new change.

Also added in the same pass, because the feature existed only in its own reference page: the guard
in `README.md`, a recipe with its reasoning in `docs/react-playbook.md`, rules and a decision line
in `docs/agent-playbook.md`, and a switchable rule in the playground whose own pin buttons and
"forget saved layout" ask `allows` -- which is the pattern AC-04 exists to make possible.

## Known gaps

- **A resize and a drag cannot disable themselves in advance.** The final width and the destination
  are decided by the gesture, so those refusals land on commit and look like nothing happening.
  Making the resize handle ask the guard per pointer move would be a predicate call per frame to
  gray out a control mid-drag, which is worse than the gap.
- **No reason, and no announcement.** Deliberate (AC-06, AC-07), but it does mean a commit-time
  refusal is invisible to a reader who cannot see the control. A consumer who needs to explain
  should say it from their own rule, where the wording belongs.
- **Synchronous only.** "Confirm before moving this column" is an application flow rather than a
  predicate: the gesture has finished and the state has to settle. Such a consumer drives the change
  themselves through the controller.
- **Not a security boundary.** It governs UI state, not the engine. A column that must be
  unreachable should not be in `columns`.

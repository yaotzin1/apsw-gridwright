# API surface contract: WCAG 2.2 AA conformance

> **Provisional.** This feature is at stages 1 and 2. Nothing here is frozen until the clarifications in `spec.md` §8
> are answered and stage 3 completes. It is written now so the surface the spec implies is visible, and so the one
> classification question (C-7) is on the record before any code.

## Semver classification

**minor, provisional.**

Reasoning: the additions are optional and additive (new messages for new picker controls, new CSS custom properties, new
stylesheet rules). No existing signature, option, event payload or export changes.

**The exception, and why it is open.** Contrast fixes (C-7) would change the *default value* of colour custom
properties. The `api_surface` skill's table puts a changed default at **major**, because the consumer's build stays green
and their grid looks different. The change would make a failing default pass, but the table does not exempt that. Until
the maintainer answers C-7:

- if no default colour changes, this feature is a **minor**;
- if any default colour changes, the release carrying it is a **major**, unless this file records an explicit exception,
  with the colours before and after, in a "Changes after release" style section.

The resize handle's wider hit area changes layout in a way a consumer's stylesheet could depend on. It is made with a
pseudo-element so the element's own box does not change, and the audit checks that claim before it is repeated here.

## Exports added

None expected. The picker controls live inside `columnLayout()`, which already exports its add-on, its messages and its
types. New message keys are added to the existing messages object, not to a new export.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `columnLayout()` messages (`gridwright:column-layout`) | keys for show, hide, moved, width | adds keys for "Move {column} earlier", "Move {column} later" and a width control's label and step | additive. Every locale pack must carry the new keys, and `auditAddonMessages` fails if one does not |
| `columnLayout()` column picker | lists columns with a visibility toggle | also renders move and width controls for a movable or resizable column | additive markup inside the picker. A consumer who styles the picker by class name sees new elements, not changed ones |
| `src/styles/styles.css` | no `forced-colors` rules; `9px` resize handle | `forced-colors` rules; a 24px hit area on the handle through a pseudo-element; a `--gw-target-min` token | additive CSS custom property; the handle's visible width is unchanged |
| default colour tokens | as shipped | **only if C-7 is answered yes**, and only where a measured ratio fails | a changed default. See the classification above |

## Exports removed or deprecated

None.

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| `--gw-target-min` | not defined | `24px` |
| any default colour token | as shipped | unchanged unless C-7 says otherwise, and then listed here token by token with the ratio before and after |
| `columnLayout()` picker move and width controls | not rendered | rendered when the column is movable or resizable. No option turns them off, because a control hidden behind a flag is not an accessibility fix |

## Documentation and files this feature will add

| File | What |
| :--- | :--- |
| `docs/conformance.md` | the conformance report, VPAT 2.5 structure, dated and tied to a grid version (AC-10) |
| `docs/accessibility.md` | a "Conformance" section linking the report, and the wording rule from AC-11 |
| `README.md` | the one-line claim the report supports, nothing broader |
| `specs/DEPENDENCY_MAP.md` | the new spec and its relation to `column-layout` and `cell-navigation-and-clipboard` |
| `docs/api.md` | the new picker message keys and the `--gw-target-min` token |

None of these enters the published tarball, which carries `dist`, `README.md`, `LICENSE` and `CHANGELOG.md` only.

## Type entry points

- [ ] Every type appearing in a new signature is itself exported (no new type is expected)
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes
- [ ] `npm pack --dry-run` lists nothing new

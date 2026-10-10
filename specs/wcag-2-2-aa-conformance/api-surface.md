# API surface contract: WCAG 2.2 AA conformance

> **Provisional until stage 5 passes.** Stage 2 is done (C-3, C-7, C-8 and C-15 answered). This file is the contract stage 6 is
> written against; an implementation that finds it wrong stops and returns to stage 3 instead of editing it.

## Semver classification

**minor.**

Reasoning: every addition is optional and additive. One new add-on with its export, new message keys for new picker
controls, new CSS custom properties and stylesheet rules. No existing signature, option, event payload, export or default
value changes.

**Why this is not a major.** Nothing a consumer already has changes. The first draft carried an open exception: contrast
fixes would have changed the defaults of colour custom properties, and the `api_surface` table classes a changed default
as major. The maintainer's answers to C-7 and C-15 remove it: every visual change sits behind one new add-on, `wcag()`,
and the stylesheet's defaults are not touched. A consumer who upgrades and does not list it sees no changed pixel and no
changed DOM node, which `tests/unit/stylesheet.test.ts` and a playground pass check. There is no `prefers-contrast`
rule (C-13 is superseded), so not even a reader's system setting changes a default grid.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `contrast` | `apsw-gridwright/react` | `<TRow>(options?: WcagOptions) => GridAddon<TRow>` |
| `WcagOptions` | `apsw-gridwright/react` | `{}` (an empty options object, reserved so a `level` can be added later without a signature change) |
| `WCAG_ADDON` | `apsw-gridwright/react` | `'gridwright:wcag'` |
| `useWcagEnabled` | `apsw-gridwright/react` | `() => boolean`: whether the grid lists `wcag()`; `false` elsewhere, never throws. The seam the picker reads, public so a third-party add-on can render under the same switch |

Nothing is exported from `apsw-gridwright` (the core entry): the add-on is a React add-on that contributes one root
attribute, like `density()`, and has no engine plugin. It carries no messages, because it has no UI, so there are no
locale keys to add for it. The picker's controls (AC-03) are rendered by `columnLayout()` when `wcag()` is listed, read
through `useWcagEnabled()`, which is exported for that reason.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `columnLayout()` messages (`gridwright:column-layout`) | keys for show, hide, moved, width | adds keys for "Move {column} earlier", "Move {column} later" and a width control's label and step | additive. Every locale pack must carry the new keys, and `auditAddonMessages` fails if one does not |
| `columnLayout()` column picker | lists columns with a visibility toggle | with `wcag()` listed, also renders move and width controls for a movable or resizable column | additive markup, and only when the add-on is listed: a grid without it has the picker it has today |
| `src/styles/styles.css` | no `forced-colors` rules; no `data-gw-wcag` rules; no `prefers-contrast` rules | under `[data-gw-wcag='aa']` only: a `--gw-target-min` token, 24px checkbox and toggles, three reassigned colour tokens (light and dark) and `forced-colors` rules. No default rule or token changes, and the resize handle is not touched | additive and opt-in |
| `docs/accessibility.md`, README | no conformance wording | a "Conformance" section and one sentence the report supports (AC-11) | documentation |

## Exports removed or deprecated

None.

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| `--gw-target-min` | not defined | defined as `24px` under `wcag()` only |
| any existing token, rule or size | as shipped | **unchanged**, by C-7 and C-15 |
| `columnLayout()` picker move and width controls | not rendered | rendered only when `wcag()` is listed, for a movable or resizable column |
| `wcag()` | not listed | not listed. Opt-in, not a core add-on, and not added to the default set |

## Development dependency (not part of the API)

| Name | Where | Why |
| :--- | :--- | :--- |
| `axe-core` (pin the major) | `devDependencies` | the automated pass in AC-02. No dependencies of its own and no install scripts at 4.14.0; licence MPL-2.0, never shipped. Decided under C-3 |

`dependencies` stays empty and `check-exports` keeps failing the build if it is not.

## Documentation and files this feature will add

| File | What |
| :--- | :--- |
| `docs/conformance.md` | the conformance report, VPAT 2.5 structure, dated and tied to a grid version (AC-10), each colour criterion stated twice (C-14) |
| `docs/accessibility.md` | a "Conformance" section linking the report, and the wording rule from AC-11 |
| `README.md` | the one-line claim the report supports, nothing broader |
| `docs/api.md` | `wcag()`, the new picker message keys and the `--gw-target-min` token |
| `docs/addons.md` | the `wcag()` row in the add-on table |
| `specs/DEPENDENCY_MAP.md` | the new spec and its relation to `column-layout`, `density` and `cell-navigation-and-clipboard` |

None of these enters the published tarball, which carries `dist`, `README.md`, `LICENSE` and `CHANGELOG.md` only.

## Type entry points

- [ ] Every type appearing in a new signature is itself exported (`WcagOptions` is)
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes, including the expected-names list for the React entry
- [ ] `npm pack --dry-run` lists nothing new

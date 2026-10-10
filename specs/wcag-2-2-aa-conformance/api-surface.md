# API surface contract: WCAG 2.2 AA conformance

> **Provisional until stage 5 passes.** Stage 2 is done (C-3, C-7, C-8 answered). This file is the contract stage 6 is
> written against; an implementation that finds it wrong stops and returns to stage 3 instead of editing it.

## Semver classification

**minor.**

Reasoning: every addition is optional and additive. One new add-on with its export, new message keys for new picker
controls, new CSS custom properties and stylesheet rules. No existing signature, option, event payload, export or default
value changes.

**Why this is not a major.** The first draft carried an open exception: contrast fixes would have changed the defaults of
colour custom properties, and the `api_surface` table classes a changed default as major. The maintainer's answer to C-7
removes it: the defaults stay as shipped, and AA-passing colours arrive through a new opt-in add-on and the reader's own
`prefers-contrast` setting. A consumer who upgrades and changes nothing sees nothing change, apart from the next paragraph.

**One rendering difference, and why it is still additive.** Under `@media (prefers-contrast: more)` the grid now renders the
AA colours (AC-16, C-13). That changes pixels for a reader whose system asks for more contrast, and for nobody else. It is
the reader's setting being honoured rather than the developer's default being changed, and the changelog says so in those
words. If the maintainer prefers a stricter reading, C-13 can be answered "no" and this paragraph disappears.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `contrast` | `apsw-gridwright/react` | `<TRow>(options?: ContrastOptions) => GridAddon<TRow>` |
| `ContrastOptions` | `apsw-gridwright/react` | `{}` (an empty options object, reserved so a `level` can be added later without a signature change) |
| `CONTRAST_ADDON` | `apsw-gridwright/react` | `'gridwright:contrast'` |

Nothing is exported from `apsw-gridwright` (the core entry): the add-on is a React add-on that contributes one root
attribute, like `density()`, and has no engine plugin. It carries no messages, because it has no UI, so there are no
locale keys to add for it.

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `columnLayout()` messages (`gridwright:column-layout`) | keys for show, hide, moved, width | adds keys for "Move {column} earlier", "Move {column} later" and a width control's label and step | additive. Every locale pack must carry the new keys, and `auditAddonMessages` fails if one does not |
| `columnLayout()` column picker | lists columns with a visibility toggle | also renders move and width controls for a movable or resizable column | additive markup inside the picker. A consumer who styles the picker by class name sees new elements, not changed ones |
| `src/styles/styles.css` | no `forced-colors` rules; `9px` resize handle; no `data-gw-contrast` or `prefers-contrast` rules | `forced-colors` rules; a 24px hit area on the handle through a pseudo-element; a `--gw-target-min` token; token overrides under `[data-gw-contrast='aa']` and `@media (prefers-contrast: more)` | additive. The handle's visible width and every default token are unchanged |
| `docs/accessibility.md`, README | no conformance wording | a "Conformance" section and one sentence the report supports (AC-11) | documentation |

## Exports removed or deprecated

None.

## Defaults introduced or changed

| Option | Old default | New default |
| :--- | :--- | :--- |
| `--gw-target-min` | not defined | `24px` |
| any existing colour token | as shipped | **unchanged**, by the answer to C-7 |
| `columnLayout()` picker move and width controls | not rendered | rendered when the column is movable or resizable. No option turns them off, because a control hidden behind a flag is not an accessibility fix |
| `contrast()` | not listed | not listed. Opt-in, not a core add-on, and not added to the default set |

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
| `docs/api.md` | `contrast()`, the new picker message keys and the `--gw-target-min` token |
| `docs/addons.md` | the `contrast()` row in the add-on table |
| `specs/DEPENDENCY_MAP.md` | the new spec and its relation to `column-layout`, `density` and `cell-navigation-and-clipboard` |

None of these enters the published tarball, which carries `dist`, `README.md`, `LICENSE` and `CHANGELOG.md` only.

## Type entry points

- [ ] Every type appearing in a new signature is itself exported (`ContrastOptions` is)
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes, including the expected-names list for the React entry
- [ ] `npm pack --dry-run` lists nothing new

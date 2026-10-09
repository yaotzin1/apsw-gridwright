# Self-review: WCAG 2.2 AA conformance

> **Not run.** This feature is at stages 1 to 5: the specification, the clarifications, the plan, the tasks and the analysis
> below. The seven answers are written when stage 8 runs, against code and against an audit. Filling them in now would be
> inventing evidence, and for a feature about conformance that would be the worst place to do it.

## Stage 5 analysis (2026-10-10, on paper, before any code)

- **Breaks a published signature without the right version?** No. Every change is additive: one new add-on and its export,
  new picker message keys, new CSS custom properties and rules. The one thing that would have been a major, changing default
  colours, is removed by the answer to C-7: the defaults stay and the AA colours are opt-in.
- **DOM or React under the headless directories?** No. The work is the stylesheet, `columnLayout()`, `cellNavigation()` and a
  new add-on in `src/react`. Nothing under `src/core`, `src/data` or `src/plugins` is touched.
- **Does a built-in need something a third-party add-on could not reach?** No. `contrast()` contributes one root attribute
  through `rootAttributes`, the slot `density()` and every theme add-on already use. The picker controls render inside
  `columnLayout()` through its own slots. The scroll correction is inside `cellNavigation()`.
- **A runtime dependency?** No. `axe-core` is a development dependency, decided under C-3, with no install script and no
  dependencies of its own at 4.14.0. `dependencies` stays empty.
- **A regression in keyboard reachability or an announced state?** Not by design: the new picker controls add Tab stops inside
  the picker only, each with a name, and reuse the existing "{column} moved to position {n} of {total}" announcement. Tests
  T-15 assert it, and the axe pass runs over the picker open. The enlarged resize handle must not take a click from the sort
  button, which T-05 tests and a browser pass confirms.
- **Per-row work in the hot path?** None. The add-on is an attribute and a stylesheet; the focus correction runs on a cursor
  move and walks header cells and pinned columns, which scale with columns, not rows.
- **Security (`application_security` review questions).** (1) No new untrusted input is touched: the add-on writes a fixed
  attribute value, and no row, header or message text reaches a new sink. (2) No new string becomes markup, a URL, a
  selector, a style or a script; the stylesheet rules are static. (3) No extension point is added or widened.
  (4) `security-audit` is part of `npm run verify` and runs at stage 7.

**Result.** The plan passes stage 5, with three points that are decisions and not defects: C-14 (the report may call the
default grid Partially Supports on two colour criteria) needs the maintainer's explicit yes before the report is written;
`virtualRows()` may end in a documented limitation on 1.4.12 instead of a fix (plan, milestone F); and `contrast()` cannot
recolour a MUI-themed grid, which is correct and has to be said.

## 1. Boundary and layering

Not reviewed. The spec expects no change under `src/core`, `src/data` or `src/plugins`: the work is in the stylesheet,
`columnLayout()` and the adapter's scroll handling. No code exists to check that against.

## 2. The local/remote seam

Not reviewed. `spec.md` §5 says the audit must cover loading, refreshing, stale-rows and error states from a remote
source, and a synchronous source's lack of a loading state. Nothing has been run.

## 3. Public surface and semver

Not reviewed. The provisional classification is minor, in `api-surface.md`, with one open exception: a changed default
colour is a major by the skill's table (C-7).

## 4. Accessibility and i18n

Not reviewed. This is the feature's whole subject, and the baseline in `research.md` is a reading of the docs and the
code, not an audit. New picker controls need a keyboard route, an accessible name and strings in five locales; none exists.

## 5. Supply chain and packaging

Not reviewed. The spec's constraints: zero runtime dependencies, nothing new in the tarball, and a development-only
dependency for the automated pass only through the decision recorded under C-3.

## 6. Honest output

Not reviewed. The risk specific to this feature is overstatement: a README or report that claims more than the audit
shows. AC-11 and the wording rule exist for that reason, and the review at stage 8 checks every document against them.

## 7. Verification

```
Not run: no implementation, and no audit.
```

## Known gaps

- C-3, C-7 and C-8 were answered on 2026-10-10 (a dev dependency: yes; colours: opt-in, no default changes; screen readers:
  the maintainer will run them). C-12 and C-13 carry proposed defaults and C-14 needs an explicit yes; C-1, C-2, C-4, C-5,
  C-6, C-9, C-10 and C-11 are on their proposed defaults and were not discussed.
- The baseline in `research.md` has fourteen criteria that are a probable gap or not assessed. Two of them (1.4.3, 1.4.11)
  were measured from the tokens; the layout-dependent ones have not been measured in a browser.
- No screen reader has been used on the grid, including the `stackBelow` layout the docs already call unverified. The
  protocol is in `research.md`, and T-29 is the maintainer's.
- Which edition of EN 301 549 and which national rules apply to a given consumer is for their counsel; this spec does not
  decide it and the research notes say so.
- Nothing in this directory is a statement that the grid conforms. It is the plan for being able to say so.

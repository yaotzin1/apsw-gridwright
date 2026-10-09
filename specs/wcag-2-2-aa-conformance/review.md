# Self-review: WCAG 2.2 AA conformance

> **Not run.** This feature is at stages 1 and 2. The seven answers below are written when stage 8 runs, against code and
> against an audit. Filling them in now would be inventing evidence, and for a feature about conformance that would be the
> worst place to do it.

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

- Every clarification in `spec.md` §8 is unanswered. C-3 (tooling and a development dependency), C-7 (whether default
  colours may change, and the semver consequence) and C-8 (who runs the screen readers) block stage 3.
- The baseline in `research.md` has fourteen criteria that are a probable gap or not assessed, and none of the
  layout-dependent ones has been measured in a browser.
- No screen reader has been used on the grid, including the `stackBelow` layout the docs already call unverified.
- Which edition of EN 301 549 and which national rules apply to a given consumer is for their counsel; this spec does not
  decide it and the research notes say so.
- Nothing in this directory is a statement that the grid conforms. It is the plan for being able to say so.

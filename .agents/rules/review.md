# Self-Review Checklist

Before declaring any change complete, answer all seven in `specs/<feature>/review.md`.

## 1. Boundary and layering

Does anything under `src/core`, `src/data` or `src/plugins` now reference the DOM or React? Do
imports still point one way? Did a behaviour that belongs in a plugin end up in the engine?

## 2. The local/remote seam

Does the change work for a source that resolves nothing and a source that resolves everything? Does
any new code branch on where the rows came from? Does a stage that narrows rows report the new
total?

## 3. Public surface and semver

What did the exported surface gain, lose or change? Is the classification recorded? Does a new type
appear in a signature without being exported? Do both module conditions still have types?

## 4. Accessibility and i18n

Is every new control reachable by keyboard and named for assistive technology? Is `aria-sort` still
on the cell? Did any user-visible string get written into JSX instead of `labels`?

## 5. Supply chain and packaging

Any new runtime dependency? Any new file that would enter the tarball? Did `npm run check:exports`
pass, and did `npm pack --dry-run` list only what it should?

## 6. Honest output

Does the grid display any number it computed rather than received? Is a loading state published for
a source that answers synchronously? Does a failure surface a sentence a person can act on?

## 7. Verification

Did `npm run verify` pass end to end, and are you reporting its actual output? Is there a test that
would have caught this change's absence, and one that would catch its regression?

# Public API Rules

Binding.

## 1. Classify before implementing

The semver impact of a change is decided at stage 3 and written into
`specs/<feature>/api-surface.md`. At release time it is recorded, not discovered. The table lives
in `.agents/skills/api_surface/SKILL.md`.

## 2. A changed default is a breaking change

Nothing fails to compile, and every consumer's grid behaves differently. This is the change most
often misclassified, and the one whose fallout is hardest to trace.

## 3. Everything reachable must be nameable

A type appearing in an exported signature is itself exported. A consumer who cannot name the type
of an argument cannot write a wrapper, a test double or a helper.

## 4. Both module systems get their own types

`exports[path].import.types` points at `.d.ts`, `exports[path].require.types` at `.d.cts`. Never
share one file between the two conditions.

## 5. The export map is verified, not assumed

`npm run check:exports` after any change to `package.json`, `tsup.config.ts` or the barrel files.

## 6. Removal waits for a major

Deprecate with `@deprecated`, name the replacement in the tag, forward the implementation, and
remove in the next major.

## 7. Rendered class names are public

Consumers style against them. Renaming one is a breaking change even though no build fails.

# Security Rules

Binding.

## 1. Zero runtime dependencies

`dependencies` is empty. React is an optional peer dependency. `scripts/check-exports.mjs` fails
the build otherwise, and an addition requires a recorded decision in the feature's spec.

## 2. Nothing runs on install

No `preinstall`, `install` or `postinstall` script, ever.

## 3. The tarball is an allowlist

`files` lists `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`. Verify with `npm pack --dry-run` and
read the output before publishing.

## 4. Row data is untrusted input

Rows come from a server. Render them as text; React escapes by default. `dangerouslySetInnerHTML`
does not appear in this package, and a cell renderer that uses it is a decision the consumer makes
for themselves with full knowledge.

## 5. Never interpolate a row value into a URL, a CSS value or an attribute unencoded.

## 6. Skill files are scanned

`scripts/validate-skills.mjs` audits every `SKILL.md` for leaked credentials, prompt-injection
patterns and unsafe path references, and blocks the commit. Skills are instructions agents follow
without review, which makes them worth scanning as carefully as code.

## 7. No secrets in the repository

No tokens, no internal URLs, no customer data in fixtures. Test fixtures use invented people.

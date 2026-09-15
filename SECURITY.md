# Security policy

## Reporting a vulnerability

Please report it privately, not in a public issue: use GitHub's
[private vulnerability reporting](https://github.com/yaotzin1/apsw-gridwright/security/advisories/new)
for this repository. Include the version, a minimal reproduction, and what an attacker controls in
it (row data, a filter value, a template, an add-on).

You will get an acknowledgement within a few days. A confirmed issue is fixed in a patch release and
recorded under "Security" in `CHANGELOG.md` once the fix is published.

## What is in scope

- The published package: anything in `dist/` that lets data a consumer renders, exports, prints or
  filters execute script, inject markup, reach a URL scheme it should not, or pollute a prototype.
- Extension points that let an add-on or plugin reach more than a consumer's own cell renderer can.
- The playground server in `scripts/serve-example.mjs`, which developers run on their own machines.

## How the package defends itself

The rules are in `.agents/rules/security.md` and are enforced on every commit by
`scripts/security-audit.mjs` and ESLint. In short: no HTML or script sinks anywhere in the
repository, every generated file escapes at its boundary, the print document is sandboxed without
scripts, the package has no runtime dependencies and no install scripts, and the development server
binds to loopback and serves only `dist/` and `examples/`.

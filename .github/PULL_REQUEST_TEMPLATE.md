# What and why

<!-- What a consumer gets from this, in two sentences. Link the spec directory. -->

Spec: `specs/<feature-name>/`

## Semver classification

<!-- Decided at stage 3, recorded in api-surface.md. A changed default is a major even though
     nothing fails to compile. -->

- [ ] patch — no change to the public surface
- [ ] minor — additions only
- [ ] major — a signature, a default, an event payload or a class name changed

Exports added, changed or removed:

## Verification

<!-- Paste what it printed, not a summary of it. -->

```
npm run verify
```

- [ ] typecheck, lint, unit and React suites green
- [ ] `npm run test:smoke` green against a fresh build
- [ ] `npm run check:exports` green
- [ ] `npm pack --dry-run` lists nothing from `src`, `tests`, `specs` or `.agents`

## Self-review

<!-- The seven dimensions from .agents/rules/review.md. Answer them here; "see the spec" means
     the review has not happened. -->

1. **Boundary and layering** —
2. **The local/remote seam** —
3. **Public surface and semver** —
4. **Accessibility and i18n** —
5. **Supply chain and packaging** —
6. **Honest output** —
7. **Verification** —

## Documentation

- [ ] `README.md` updated, or not affected
- [ ] `CHANGELOG.md` entry added under Unreleased
- [ ] `specs/DEPENDENCY_MAP.md` updated, or not affected
- [ ] `antigravity.yml` edited and the sync scripts re-run, if the cycle or the skill set changed

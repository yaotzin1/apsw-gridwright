# What and why

<!-- What a consumer gets from this, in two sentences. Link the spec directory on the feature track. -->

Spec: `specs/<feature-name>/`

## Track

<!-- From workflow.ai.yml. A fix that changes a public type or a default is a feature. -->

- [ ] feature — stages 1 to 8
- [ ] fix — a test that failed before, then 7 and 8
- [ ] chore — 7 and 8
- [ ] release — 7 and 8, then `.agents/workflows/release.md`

Stages run, and any skipped with the reason:

## Semver classification

<!-- Decided when the change was planned, recorded in api-surface.md. A changed default is a major
     even though nothing fails to compile. Below 1.0 a major takes the next minor. -->

- [ ] none — nothing a consumer installs changes
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
- [ ] `node scripts/check-workflow.mjs --remote`, if CI job names or the Node matrix changed

## Self-review

<!-- The seven dimensions from .agents/rules/review.md. Answer them here; "see the spec" means
     the review has not happened. These cover the architectural rules enforced only by review. -->

1. **Boundary and layering** —
2. **The local/remote seam** —
3. **Public surface and semver** —
4. **Accessibility and i18n** —
5. **Supply chain and packaging** —
6. **Honest output** —
7. **Verification** —

## Documentation

- [ ] `README.md` updated, or not affected
- [ ] `docs/api.md` updated in this change for any prop, column field, add-on option or default
- [ ] `CHANGELOG.md` entry added under Unreleased, or not needed on this track
- [ ] `specs/DEPENDENCY_MAP.md` updated, or not affected
- [ ] `workflow.ai.yml` edited and the sync scripts re-run, if the tracks, stages, gates or skills changed

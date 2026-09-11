# Tasks: <feature name>

Ordered by dependency. Core first, adapter second, documentation last. Each task independently
checkable.

## Core

- [ ] **T-01**
- [ ] **T-02**

## Data sources

- [ ] **T-03**

## Adapter

- [ ] **T-04**

## Tests

- [ ] **T-05** Unit coverage for the new behaviour, both sides of the capability seam
- [ ] **T-06** React coverage for any new control, queried by role
- [ ] **T-07** Smoke coverage if the public surface changed

## Documentation

- [ ] **T-08** README
- [ ] **T-09** CHANGELOG entry under Unreleased
- [ ] **T-10** specs/DEPENDENCY_MAP.md

## Stage 7 — Verification

- [ ] `npm run verify` green end to end, output recorded in review.md

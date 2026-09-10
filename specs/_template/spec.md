# Specification: <feature name>

> **Status**: Draft
> **Stage entry**: 1
> **Semver impact**: patch | minor | major (provisional; confirmed in api-surface.md)

---

## 1. The consumer problem

<!-- What a developer using this package cannot do today, or has to write themselves. Concrete,
     not aspirational. If the answer is "it would be nice if", this is not ready. -->

## 2. User stories

<!-- The user here is the developer who installed the package, and the person using the grid they
     built. Both matter. -->

- **US-01.** As a developer integrating a paginating endpoint, I ...
- **US-02.** As a person reading a grid, I ...

## 3. Acceptance criteria

<!-- Checkable statements. Each one becomes at least one test. -->

- [ ] AC-01
- [ ] AC-02

## 4. Non-goals

<!-- Load-bearing. A grid grows into a framework one reasonable addition at a time, and this is
     where that is refused in writing. -->

-

## 5. Behaviour across the capability seam

<!-- Every feature that touches the query must say what happens for a source that resolves
     nothing and a source that resolves everything. A feature that only works for one is not
     finished. -->

| Source resolves | Expected behaviour |
| :--- | :--- |
| nothing (local array) | |
| everything (server) | |
| pagination only | |

## 6. Accessibility and interface copy

<!-- New controls: how are they reached by keyboard, what is announced, which labels are added. -->

## 7. Clarifications

<!-- Stage 2. Every ambiguity resolved, with the resolution. Each default chosen here is inherited
     by every consumer. -->

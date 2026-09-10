---
name: documentation
description: Use when writing specs, README, CHANGELOG or code comments, and at stage 8 of every feature. Covers the 8-artifact Spec-Kit lifecycle and what a comment is for.
---

# Spec-Kit & Documentation Architect

## The 8 artifacts

Every feature directory under `specs/<feature-name>/` contains all eight. They are adapted from the
service-oriented Spec-Kit: a library has no HTTP endpoints, so the two contract documents describe
the public surface and the lifecycle instead.

| File | Answers |
| :--- | :--- |
| `spec.md` | What problem a consumer has, and what done means. No implementation. |
| `plan.md` | How it is built: modules, seams, trade-offs taken. |
| `tasks.md` | An ordered, checkable list. Core first, adapter second, docs last. |
| `data-model.md` | The state and type shapes, before and after. |
| `research.md` | What was considered and rejected, with the reason. Includes measurements. |
| `api-surface.md` | **Contract.** Exported names, signatures, defaults, semver classification. |
| `events.md` | **Contract.** Events, payloads, ordering, pipeline stage slots. |
| `review.md` | The 7-dimension self-review, written after implementation. |

`specs/_template/` holds the blank set. Copy it; do not improvise a structure.

The two contract files are mounted read-only during parallel implementation. They are what lets the
core and adapter workspaces be written at the same time without meeting in the middle and
disagreeing.

## Keeping the repository honest

At stage 8, update `README.md`, `CHANGELOG.md` and `specs/DEPENDENCY_MAP.md`. Documentation that
lags becomes the source future agents hallucinate from, and a wrong README is worse than none: it
is confidently wrong.

`AGENTS.md` and `GEMINI.md` are generated. Edit `workflow.ai.yml` and run the sync scripts.

## Comments explain why

The code already says what it does. A comment earns its place by saying what the code cannot:

- Why a line is load-bearing: "Copied first: the array may be the source's own storage."
- The bug that produced the rule: "Without the page offset, row 0 of page 2 shares an id with row 0
  of page 1, and a selection silently follows the reader around."
- The decision behind a default, and what changes if it is overridden.

Delete comments that restate the line beneath them. In doc comments on exported types, write the
default value: it is the field consumers most often need and least often look up.

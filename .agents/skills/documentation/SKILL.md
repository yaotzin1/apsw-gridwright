---
name: documentation
description: Use when writing specs, README, CHANGELOG, docs/api.md or code comments, and at stage 8 of every change. Covers which spec artifacts a feature needs and what a comment is for.
---

# Spec & Documentation Architect

## The artifacts, in proportion to the feature

Adapted from the service-oriented Spec-Kit: a library has no HTTP endpoints, so the two contract
documents describe the public surface and the lifecycle instead.

| File | Answers | Required |
| :--- | :--- | :--- |
| `spec.md` | What problem a consumer has, and what done means. No implementation. | always |
| `api-surface.md` | **Contract.** Exported names, signatures, defaults, semver classification. | always |
| `review.md` | The 7-dimension self-review, written after implementation. | always |
| `plan.md` | How it is built: modules, seams, trade-offs taken. | or a reason |
| `research.md` | What was considered and rejected, with the reason. Includes measurements. | or a reason |
| `data-model.md` | The state and type shapes, before and after. | or a reason |
| `events.md` | **Contract.** Events, payloads, ordering, pipeline stage slots. | or a reason |
| `tasks.md` | An ordered, checkable list. Core first, adapter second, docs last. | or a reason |

`specs/_template/` holds the full set. Copy it, delete what does not apply, and name each deleted
file under `## Artifacts not written` in `spec.md` with the reason. `scripts/check-workflow.mjs`
fails a directory that does neither. Never write a file to say it does not apply: a padded artifact
reads like a recorded decision and is not one.

Implementation is written against `api-surface.md` (and `events.md` when there is one). Nothing
locks them; an agent that finds one wrong stops and reports instead of editing the version the other
half of the work is using. Details in `.agents/rules/spec_pipeline.md`.

## Keeping the repository honest

At stage 8, update `README.md`, `CHANGELOG.md`, `specs/DEPENDENCY_MAP.md` and `docs/api.md`, the
reference of every prop, column field and add-on option with its type and default: a new or changed
one is not done until its row there is. Documentation that lags becomes the source future agents
hallucinate from, and a wrong README is worse than none: it is confidently wrong.

`AGENTS.md` and `GEMINI.md` are generated. Edit `workflow.ai.yml` and run the sync scripts. A
statement in the workflow that sounds enforced must be enforced: give it a check in
`scripts/check-workflow.mjs`, or write it as guidance.

## Comments explain why

The code already says what it does. A comment earns its place by saying what the code cannot:

- Why a line is load-bearing: "Copied first: the array may be the source's own storage."
- The bug that produced the rule: "Without the page offset, row 0 of page 2 shares an id with row 0
  of page 1, and a selection silently follows the reader around."
- The decision behind a default, and what changes if it is overridden.

Delete comments that restate the line beneath them. In doc comments on exported types, write the
default value: it is the field consumers most often need and least often look up.

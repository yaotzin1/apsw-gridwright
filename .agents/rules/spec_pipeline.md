# Spec-Driven Development Pipeline

All non-trivial work follows the eight stages defined in `antigravity.yml`. Artifacts are tracked
in git under `specs/<feature-name>/`.

## The 8 artifacts

Every feature directory contains all of them. `specs/_template/` holds the blank set.

| File | Stage | Purpose |
| :--- | :--- | :--- |
| `spec.md` | 1, 2 | The consumer problem, stories, acceptance criteria, non-goals |
| `research.md` | 3 | Options considered and rejected, with reasons and measurements |
| `plan.md` | 3 | Modules touched, seams, trade-offs |
| `data-model.md` | 3 | State and type shapes, before and after |
| `api-surface.md` | 3 | **Contract.** Exports, signatures, defaults, semver classification |
| `events.md` | 3 | **Contract.** Events, payloads, ordering, stage slots |
| `tasks.md` | 4 | Ordered checklist: core first, adapter second, docs last |
| `review.md` | 8 | The 7-dimension self-review |

## The two contracts are immutable during implementation

`api-surface.md` and `events.md` are mounted read-only into the parallel implementation
workspaces. They are what lets the core and the adapter be written at the same time without the two
halves meeting and disagreeing. Changing one mid-implementation means returning to stage 3.

## Entering late

A defect fix may enter at stage 6 with a reconstructed spec. Stages 7 and 8 are never skipped:
verification and self-review apply to every change that reaches a branch.

## Non-trivial

A typo fix or a comment does not need a spec directory. Anything that changes behaviour, the public
surface, or what ships does.

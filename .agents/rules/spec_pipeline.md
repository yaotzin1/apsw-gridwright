# Spec-Driven Development Pipeline

Elaborates the `tracks`, `stages` and `spec_kit` sections of `workflow.ai.yml`.

## Pick the track first

| Track | When | Stages |
| :--- | :--- | :--- |
| `feature` | a consumer would notice: an export, prop, column field, add-on, option, default, event or markup | all eight |
| `fix` | restores documented behaviour, with no new surface | implement, verify, review and ship |
| `chore` | docs, agent instructions, tests, CI, tooling, dev dependencies | verify, review and ship |
| `release` | a version number, the changelog section, the tag | verify, review and ship, then `.agents/workflows/release.md` |

A fix that has to change a public type or a default is a feature. When work outgrows its track,
move up and do the stages the larger track adds; never move down to skip them. Stages 7 and 8 apply
to every change that reaches a branch.

## The artifacts a feature writes

Enforced by `scripts/check-workflow.mjs`. `specs/_template/` holds the full set.

| File | Stage | Purpose | Required |
| :--- | :--- | :--- | :--- |
| `spec.md` | 1, 2 | The consumer problem, stories, acceptance criteria, non-goals | always |
| `api-surface.md` | 3 | **Contract.** Exports, signatures, defaults, semver classification | always |
| `review.md` | 8 | The 7-dimension self-review | always |
| `plan.md` | 3 | Modules touched, seams, trade-offs | or a reason |
| `research.md` | 3 | Options considered and rejected, with reasons and measurements | or a reason |
| `data-model.md` | 3 | State and type shapes, before and after | or a reason |
| `events.md` | 3 | **Contract.** Events, payloads, ordering, stage slots | or a reason |
| `tasks.md` | 4 | Ordered checklist: core first, adapter second, docs last | or a reason |

An optional file that does not apply is not written as a page of "N/A". It is named in `spec.md`
under `## Artifacts not written`, one bullet per file, with the reason:

```markdown
## Artifacts not written

- `events.md`: the feature emits no event and adds no pipeline stage.
- `data-model.md`: no state or type changes shape; the one new option is in api-surface.md.
```

A padded artifact is worse than an omitted one: it looks like a decision was recorded when none was.

## Contracts during implementation

`api-surface.md`, and `events.md` when it exists, are what implementation is written against. When
the work is split between a core agent and an adapter agent, both work from the same version. No
tool mounts them read-only; the rule is behavioural: an agent that finds a contract wrong stops and
reports, and the change to the contract goes back through planning before either half continues.

## No spec directory

A typo, a comment, a test-only change, or anything on the `chore` track. A `fix` records any public
type change in the spec of the feature that owns the type.

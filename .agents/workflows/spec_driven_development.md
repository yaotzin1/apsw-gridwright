# Workflow: Spec-Driven Development

The stages from `workflow.ai.yml`, as a procedure. Which of them a change goes through is its track;
the rules are in [`.agents/rules/spec_pipeline.md`](../rules/spec_pipeline.md). This is guidance:
nothing runs these stages for you, and nothing fails when one is skipped except the review.

## Before anything: the track

- `feature`: every stage below.
- `fix`: start at 6 with a test that fails, then 7 and 8.
- `chore`: 7 and 8.
- `release`: 7 and 8, then [`release.md`](release.md).

## 1. Specify

```bash
cp -r specs/_template specs/<feature-name>
```

Fill `spec.md`: the problem a consumer has, the stories, the acceptance criteria, the non-goals, and
a "Delivery as a plugin" section naming the plugin and add-on that deliver it. Non-goals are
load-bearing; a grid grows into a framework one reasonable addition at a time.

Write no implementation detail. If a sentence names a file, it belongs in `plan.md`.

## 2. Clarify

Resolve every ambiguity that would change the public surface: names, defaults, which side of the
capability seam a behaviour sits on. Write the resolutions into `spec.md` under Clarifications.
Each default chosen here is inherited by every consumer.

## 3. Plan

Always `api-surface.md`: every export added, changed or removed, with its signature, its defaults and
the semver classification. Then whichever of these the feature has:

- `research.md`: options considered, rejected, why. Measurements if the change is about speed.
- `plan.md`: modules touched, seams, trade-offs.
- `data-model.md`: the state and type shapes, before and after.
- `events.md`: events emitted, payloads, ordering, any new pipeline stage slot.

Delete the ones that do not apply and name each under `## Artifacts not written` in `spec.md` with
its reason. `scripts/check-workflow.mjs` fails a directory that does neither.

Write `api-surface.md` precisely enough that a core agent and an adapter agent who never speak
produce halves that fit.

## 4. Tasks

When the work has more than one step worth tracking, decompose the plan into `tasks.md`: core, then
adapter, tests alongside each, documentation last. Each task independently checkable.

## 5. Analyze

Audit the plan before writing code:

- Does anything break a published signature without the right version?
- Does anything put the DOM or React under the headless directories?
- Does a built-in need something a third-party add-on could not reach?
- Does it add a runtime dependency?
- Does it regress keyboard reachability or an announced state?
- Does it add per-row work to the hot path?

A failure here returns to Plan. It does not proceed with a note.

## 6. Implement

Against `api-surface.md`. Splitting the work between agents is optional and described in
[`.agents/rules/agent_orchestration.md`](../rules/agent_orchestration.md). An agent that finds the
contract wrong stops and reports rather than editing it.

A feature also updates `examples/` in the same change, so it can be operated in the playground.

## 7. Verify

See [`verification.md`](verification.md). Every gate, actual output reported.

## 8. Review and ship

Write `review.md` (or the review answers in the pull request, off the feature track) against
[`.agents/rules/review.md`](../rules/review.md). Update `README.md`, `CHANGELOG.md`, `docs/api.md`
and `specs/DEPENDENCY_MAP.md` where they changed. Open the pull request; it merges when the required
checks in `workflow.ai.yml` are green.

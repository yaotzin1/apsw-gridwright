# Workflow: Spec-Driven Development

The eight stages from `antigravity.yml`, as a procedure. Rules in
[`.agents/rules/spec_pipeline.md`](../rules/spec_pipeline.md).

## Stage 1 — Specify

```bash
cp -r specs/_template specs/<feature-name>
```

Fill `spec.md`: the problem a consumer has, the stories, the acceptance criteria, and the
non-goals. Non-goals are load-bearing here; a grid grows into a framework one reasonable addition
at a time.

Write no implementation detail. If a sentence names a file, it belongs in `plan.md`.

## Stage 2 — Clarify

Resolve every ambiguity that would change the public surface: names, defaults, which side of the
capability seam a behaviour sits on. Write the resolutions back into `spec.md` under a
Clarifications heading. Each default chosen here is inherited by every consumer.

## Stage 3 — Plan

Produce five artifacts:

- `research.md` — options considered, rejected, why. Measurements if the change is about speed.
- `plan.md` — modules touched, seams, trade-offs.
- `data-model.md` — the state and type shapes, before and after.
- `api-surface.md` — **contract.** Every export added, changed or removed, with its signature, its
  defaults and the semver classification.
- `events.md` — **contract.** Events emitted, payloads, ordering, and any new pipeline stage slot.

The two contracts are what makes stage 6 parallelisable. Write them precisely enough that two
agents who never speak produce halves that fit.

## Stage 4 — Tasks

Decompose `plan.md` into an ordered checklist in `tasks.md`. Order: core, then adapter, then tests
alongside each, then documentation. Each task is independently checkable.

## Stage 5 — Analyze

Audit the plan before writing code:

- Does anything break a published signature without a major version?
- Does anything put the DOM or React under `src/core`?
- Does it add a runtime dependency?
- Does it regress keyboard reachability or an announced state?
- Does it add per-row work to the hot path?

A failure here returns to stage 3. It does not proceed with a note.

## Stage 6 — Implement

Two workspaces, pinned to the contracts:

- `core_developer` — `src/core/`, `src/data/`, `src/plugins/`
- `adapter_developer` — `src/react/`, `src/styles/`

An agent that finds the contract wrong stops and reports rather than editing it.

## Stage 7 — Verify

See [`verification.md`](verification.md). Every gate, actual output reported.

## Stage 8 — Review and ship

Write `review.md` against [`.agents/rules/review.md`](../rules/review.md). Update `README.md`,
`CHANGELOG.md` and `specs/DEPENDENCY_MAP.md`. Then [`release.md`](release.md) if publishing.

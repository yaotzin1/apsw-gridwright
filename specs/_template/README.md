# Spec template

Copy this directory to start a feature:

```bash
cp -r specs/_template specs/<feature-name>
```

`spec.md`, `api-surface.md` and `review.md` are required. Delete any of `plan.md`, `research.md`,
`data-model.md`, `events.md` and `tasks.md` that the feature does not have, and name each deleted
file under `## Artifacts not written` in `spec.md` with the reason. `scripts/check-workflow.mjs`
fails a directory that does neither, and it fails one that lists a file it also kept.

Delete this README from the copy. The stage each file belongs to is in
[`.agents/rules/spec_pipeline.md`](../../.agents/rules/spec_pipeline.md).

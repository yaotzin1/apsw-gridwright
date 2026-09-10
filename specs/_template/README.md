# Spec-Kit template

Copy this directory to start a feature:

```bash
cp -r specs/_template specs/<feature-name>
```

All eight artifacts are required. `api-surface.md` and `events.md` are contracts: they are mounted
read-only into the parallel implementation workspaces at stage 6, which is what lets the core and
the adapter be written at the same time without the two halves disagreeing.

The stage each file belongs to is in [`.agents/rules/spec_pipeline.md`](../../.agents/rules/spec_pipeline.md).

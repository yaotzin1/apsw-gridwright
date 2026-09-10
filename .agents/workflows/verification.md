# Workflow: Verification

Stage 7. A change is unverified until this has passed end to end.

## The one command

```bash
npm run verify
```

It runs, in order:

| Gate | Command | Catches |
| :--- | :--- | :--- |
| Skills | `node scripts/validate-skills.mjs` | malformed or unsafe skill files |
| Doc sync | `node scripts/sync-*.mjs --check` | AGENTS.md or the skill pointers drifting from the YAML |
| Types | `npm run typecheck` | everything TypeScript can prove |
| Lint | `npm run lint` | the headless boundary, unused code, hook rules |
| Tests | `npm test` | engine, pipeline, data sources, component behaviour |
| Smoke | `npm run test:smoke` | the built artifact, through its export map |
| Packaging | `npm run check:exports` | the manifest, the export map, the bundles |

## When a gate fails

Run that gate alone and read its actual output. Do not re-run the whole chain to see the same
failure again.

```bash
npx vitest run tests/unit/engine-remote.test.ts
npx eslint src/react/useGridwright.ts
node scripts/check-exports.mjs
```

Then write the remediation as a task in `tasks.md` and fix it there, so the record shows what
actually went wrong. Three healing iterations is the limit; beyond that the plan is wrong, not the
implementation, and the work returns to stage 3.

## What not to do

- Do not lower a coverage threshold to pass.
- Do not add `--ignore-scripts` or `--no-verify` to get past a gate.
- Do not report a summary of a run instead of the run. If the output said two tests failed, say
  which two and what they said.

## Manual checks the gates cannot make

- Tab through the grid: header sort controls reachable, checkboxes labelled, page controls usable.
- Toggle the operating system to dark mode and confirm the tokens swap.
- `npm pack --dry-run` and read the file list.

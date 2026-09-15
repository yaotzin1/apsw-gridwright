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
| Workflow claims | `node scripts/check-workflow.mjs` | the YAML describing a toolchain, a gate, a CI job or a spec directory the repository does not have |
| Security (source) | `node scripts/security-audit.mjs --source` | banned APIs, sandboxing, the manifest |
| Types | `npm run typecheck` | everything TypeScript can prove |
| Lint | `npm run lint` | the headless boundary, unused code, hook rules |
| Tests | `npm test` | engine, pipeline, data sources, component behaviour, the scripts |
| Smoke | `npm run test:smoke` | the built artifact, through its export map |
| Packaging | `npm run check:exports` | the manifest, the export map, the bundles |
| Security (dist) | `npm run security:audit` | sinks or absolute paths in the built bundles and source maps |

## When a gate fails

Run that gate alone and read its actual output. Do not re-run the whole chain to see the same
failure again.

```bash
npx vitest run tests/unit/engine-remote.test.ts
npx eslint src/react/useGridwright.ts
node scripts/check-exports.mjs
```

On the feature track, write the remediation as a task in `tasks.md` so the record shows what
actually went wrong. After three attempts at the same gate, stop: the plan is wrong, not the
implementation, and the work returns to Plan. Nothing counts the attempts for you.

## What not to do

- Do not lower a coverage threshold to pass.
- Do not add `--ignore-scripts` or `--no-verify` to get past a gate.
- Do not report a summary of a run instead of the run. If the output said two tests failed, say
  which two and what they said.

## Manual checks the gates cannot make

- Tab through the grid: header sort controls reachable, checkboxes labelled, page controls usable.
- Toggle the operating system to dark mode and confirm the tokens swap.
- `npm pack --dry-run` and read the file list.

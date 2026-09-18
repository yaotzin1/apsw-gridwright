# Claude Code entry point

**`workflow.ai.yml` outranks this file and every other document in the repository.** It defines the
stages, the skill registry, the quality gates and the architectural rules. Where anything here
disagrees with it, the YAML wins, and the disagreeing text is a defect to fix rather than a rule to
follow.

The operating rules are in `AGENTS.md`, shared with every other agent that works here. The line
below imports it into this session automatically, so it is loaded rather than merely recommended.

@AGENTS.md

Section 6 of that file carries the operating cycle: the precedence order, the tracks and the stages
they run, which skill leads each stage, the blocking gates, the required checks and the
architectural rules with what enforces each. It is generated from `workflow.ai.yml` by
`scripts/sync-agent-docs.mjs`, and CI fails if the two drift apart. Pick the track before starting.

**Enforced versus guidance.** Only what the cycle marks as enforced will stop you. The stages and
every rule enforced by "review" depend on you following them, so say in your report which stages
you ran and which you did not.

**Splitting work.** `.agents/rules/agent_orchestration.md` describes a core role and an adapter role
working against one `api-surface.md`. Nothing in the repository creates those agents; in Claude
Code, use a subagent per role with worktree isolation, and only when the contract is written.

## Claude Code specifics

**Skills.** The entries under `.claude/skills/` are pointers. Each names a canonical file at
`.agents/skills/<name>/SKILL.md`, which is what `workflow.ai.yml` registers and what
`scripts/validate-skills.mjs` audits. Read the canonical file; the pointer's summary is not the
skill. Underscores become hyphens, so `api_surface` is invoked as `/api-surface` and `data_source`
as `/data-source`.

After adding or editing anything under `.agents/skills/`, run `node scripts/sync-claude-skills.mjs`.
CI and the pre-commit gate run it with `--check`.

**Hooks.** Run `node scripts/install-hooks.mjs` once in a fresh clone. It points `core.hooksPath` at
the versioned `.githooks/`, so the gates actually block a commit instead of merely being listed.

## The traps in this repository

- **A pushed `v*` tag runs the npm publish workflow.** It publishes through npm trusted publishing
  (no stored token), and fails at the publish step while the package's trusted publisher on
  npmjs.com is not configured. Push a tag only when the maintainer asks for one, and say what it
  starts.

- **Branch protection is invisible to a commit.** A CI job renamed or a Node version dropped leaves
  GitHub requiring a check nothing produces, and every pull request then waits forever. Run
  `node scripts/check-workflow.mjs --remote` after changing `.github/workflows/ci.yml`.

- **There is no inline way around the security gate.** `scripts/security-audit.mjs` runs in the
  pre-commit hook without `node_modules`, scans source, tests, scripts and the playground, and also
  refuses an `eslint-disable` for a security rule. If it fires, the design changes. Its tests build
  hostile strings from fragments so the test file itself stays clean.

- **A green `npm test` proves less than it looks.** Both suites import `src/`. Everything about the
  published artifact — the export map, the `.d.cts` types a CommonJS consumer resolves, whether
  React leaked into the core bundle, whether `dist` is even in `files` — is invisible to them.
  `npm run test:smoke` imports `dist/` through the package specifiers, and
  `npm run check:exports` audits the manifest. Run both before reporting a change complete.

- **`npm run build` is required before the smoke suite means anything.** `test:smoke` builds first;
  running vitest against `vitest.smoke.config.ts` directly will test whatever `dist/` happens to
  hold, which may be several commits old.

- **The React entry and the core entry must stay one module instance.** `tsup` is configured with
  `splitting: true` so both import a shared chunk. Turning it off silently gives each entry its own
  copy of the engine, and `instanceof GridwrightError` then fails for anyone who imports the class
  from one path and catches it from the other, while every test still passes. The packaging audit
  checks this specifically.

- **Only one add-on may hold the table wrapper's ref.** `GridTable` merges every `tableWrapper`
  contribution but keeps the **last** `ref` it is handed, silently. `virtualRows()` holds one, so a
  second add-on taking one breaks windowing or itself depending on the listed order, with nothing
  failing. `columnLayout()` reaches the table with `closest('table')` from an element it rendered
  for exactly this reason. Before contributing a `tableWrapper` ref, check what else wants it.

- **Column arrays are written inline, so their identity changes every render.** Any React effect
  that pushes columns into the engine must key on `columnSignature`, not on the array reference.
  Keying on the reference produces an infinite render loop, because `setColumns` publishes state
  and the state publishes a render.

- **React Strict Mode destroys the engine once on mount, on purpose.** `useGridwright` rebuilds
  when it finds a destroyed engine. Remove that branch and the grid renders empty in development
  and correctly in production.

## Local environment

```bash
npm install
npm run hooks:install

npm run verify            # the full gate, in CI order
npx vitest run tests/unit/engine-remote.test.ts
npx vitest run tests/react -t "sorts when a header is activated"
```

Node 22.12 or newer (the floor of the patched test toolchain). There is no server, no database and no container: this is a library, and
everything runs locally in one process.

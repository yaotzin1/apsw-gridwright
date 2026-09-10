# Claude Code entry point

**`workflow.ai.yml` outranks this file and every other document in the repository.** It defines the
stages, the skill registry, the quality gates and the architectural rules. Where anything here
disagrees with it, the YAML wins, and the disagreeing text is a defect to fix rather than a rule to
follow.

The operating rules are in `AGENTS.md`, shared with every other agent that works here. The line
below imports it into this session automatically, so it is loaded rather than merely recommended.

@AGENTS.md

Section 6 of that file carries the operating cycle: the precedence order, the eight stages, which
skill leads each one, the blocking gates and the architectural rules. It is generated from
`workflow.ai.yml` by `scripts/sync-agent-docs.mjs`, and CI fails if the two drift apart.

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

Node 18 or newer. There is no server, no database and no container: this is a library, and
everything runs locally in one process.

# Spec-driven development

This repository is built by humans and AI agents working from the same written process. Every
non-trivial change moves through eight stages and leaves eight artifacts behind. This page explains
what that buys and how to run it. You do not need any of it to *use* the package.

## Why a process at all

An agent will happily write a plausible feature that breaks a published signature, puts the DOM in
the headless core, or invents a total the server never sent. It will also report a green test suite
without having run one. None of those are caught by review alone, at the speed changes now arrive.

So the rules are written down in one file, the parts that matter are generated into the files
agents actually load, and the gates are enforced by a git hook and by CI rather than by intention.
The result is that a change either satisfies the constraints or does not land.

## The source of truth

`workflow.ai.yml` at the repository root is the orchestration file. It defines the stages, the
skill registry, the quality gates and the architectural rules, and nothing else may contradict it.

```
workflow.ai.yml           ← edit here
    │
    ├── AGENTS.md         ← generated block, loaded by AGENTS.md-aware tools
    ├── GEMINI.md         ← generated whole
    └── .claude/skills/   ← generated pointers to .agents/skills/
```

`scripts/sync-agent-docs.mjs` and `scripts/sync-claude-skills.mjs` do the generating, and both run
with `--check` in the pre-commit hook and in CI. A hand-edited `AGENTS.md` fails the build, because
a table that drifts is the one agents obey.

Precedence, highest first:

1. `workflow.ai.yml`
2. `.agents/rules/**` and `.agents/skills/**`
3. `AGENTS.md`
4. `GEMINI.md`
5. `CLAUDE.md`
6. `specs/<feature>/**`

On a conflict the rule is: stop, fix the subordinate document, re-run the sync, continue. Never
settle it by following the lower text.

## The eight stages

| Phase | Stage | Produces |
| :--- | :--- | :--- |
| 1 | Specify | `spec.md`: the consumer problem, stories, acceptance criteria, non-goals |
| 2 | Clarify | resolutions written back into `spec.md` |
| 3 | Plan | `plan.md`, `data-model.md`, `research.md`, `api-surface.md`, `events.md` |
| 4 | Tasks | `tasks.md`, ordered core first, adapter second, docs last |
| 5 | Analyze | a pre-audit; failing here returns to stage 3 |
| 6 | Implement | code, written in parallel against the contracts |
| 7 | Verify | `npm run verify`, every gate, actual output reported |
| 8 | Review and ship | `review.md`, documentation sync, changelog, release gate |

Feature work runs them in order. A defect fix may enter at stage 6 with a reconstructed spec, but
7 and 8 are never skipped.

## The two contracts

Stage 3 produces two documents that are different in kind from the rest:

- **`api-surface.md`** — every export added, changed or removed, with signatures, defaults and the
  semver classification.
- **`events.md`** — events, payloads, ordering guarantees and pipeline stage slots.

These are mounted read-only during stage 6. They are the reason implementation can be split between
an agent working in `src/core` and one working in `src/react` without the halves meeting in the
middle and disagreeing. An agent that finds a contract wrong stops and returns to stage 3; it does
not edit the contract the other half is being written against.

This is the same trick an OpenAPI document plays for a service. A library has no HTTP endpoints, so
the contract describes the public surface and the lifecycle instead.

## Non-goals are load-bearing

Every `spec.md` has a non-goals section, and it is not padding. A grid grows into a framework one
reasonable addition at a time, and each addition is individually defensible. Writing the refusal
down is what makes it survive the next person who asks.

From `specs/gridwright-core/spec.md`: no virtualization, no inline editing, no column resize, no
grouping in 0.1.0. Each with a reason, and for grouping, a reserved stage slot so adding it later
does not renumber the others.

## Classify before you write

The semver impact of a change is decided at stage 3, in `api-surface.md`, before the code exists.
At release time you are recording a decision, not discovering one.

| Change | Version |
| :--- | :--- |
| New optional field, new export, new plugin | minor |
| New required field on an existing options object | major |
| Renamed export, changed parameter order or return shape | major |
| **Changed default value** | **major** |
| Changed payload of an emitted event | major |
| Changed a rendered class name | major, in practice |
| Bug fix with no signature change | patch |

The changed default is the one people misclassify. Nothing fails to compile, the consumer's build
stays green, and their grid behaves differently. That is precisely what makes it dangerous.

## The gates

```bash
npm run verify
```

| Gate | Catches |
| :--- | :--- |
| `validate-skills` | malformed or unsafe agent instructions |
| `sync --check` | AGENTS.md or the skill pointers drifting from the YAML |
| `typecheck` | everything TypeScript can prove |
| `lint` | the headless boundary, unused code, hook rules |
| `test` | engine, pipeline, data sources, component behaviour |
| `test:smoke` | the built artifact, through its export map |
| `check:exports` | the manifest, the export map, the bundles |

The last two exist because a green unit suite proves less than it looks. Both unit suites import
`src/`. The export map, the CommonJS type entry, whether React leaked into the core bundle, whether
`dist` is even in `files`: all invisible to them, and all places where a package ships broken with
every test passing.

The pre-commit hook runs the fast gates and blocks the commit. It is versioned in `.githooks/`, and
`npm run hooks:install` points `core.hooksPath` at it, because `.git/hooks` is not versioned and a
hook that exists on one machine is not a gate.

## Skills

Fifteen documents under `.agents/skills/<name>/SKILL.md`, one per area: the engine architecture,
the public surface, data sources, extensibility, the React adapter, styling, accessibility, tests,
smoke tests, performance, debugging, refactoring, documentation, releases, supply chain.

They are working guidance, not summaries. The debugging one carries a symptom-to-cause table; the
API one carries the semver table above; the data source one explains why understating a capability
is safe and overstating it is not.

Claude Code discovers skills under `.claude/skills`, so pointers are generated there with
underscores turned into hyphens: `api_surface` is invoked as `/api-surface`. Pointers, never
copies, so the two toolchains cannot end up obeying two different texts.

## Running it yourself

```bash
cp -r specs/_template specs/<feature-name>
```

All eight files, blank, with prompts in each explaining what belongs there. Fill them in stage
order. `specs/gridwright-core/` is a completed example: the spec for the package itself, written as
the work was done.

A typo fix or a comment does not need a spec directory. Anything that changes behaviour, the public
surface, or what ships does.

## What it costs

More writing than the code itself, on a small change. The return is that the constraints are
checkable rather than remembered, that two agents can work in parallel without colliding, and that
six months later the reason for a decision is in `research.md` instead of gone.

If you are using this package rather than contributing to it, none of this reaches you. It is why
the grid behaves the way it does, not something you have to adopt.

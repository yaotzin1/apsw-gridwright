# Spec-driven development

This repository is built by humans and AI agents working from the same written process. A change
picks a track, moves through the stages that track names, and a feature leaves its reasoning behind
in a spec directory. This page explains what that buys and how to run it. You do not need any of it
to *use* the package.

## Why a process at all

An agent will happily write a plausible feature that breaks a published signature, puts the DOM in
the headless core, or invents a total the server never sent. It will also report a green test suite
without having run one. None of those are caught by review alone, at the speed changes now arrive.

So the rules are written down in one file, the parts that matter are generated into the files
agents actually load, and the gates are enforced by a git hook and by CI rather than by intention.

## Enforced, or guidance

The most important property of the process is that it does not pretend. Every statement in
`workflow.ai.yml` is one of two kinds:

- **Enforced.** Something fails when it is broken: the pre-commit hook, a CI job, a lint rule, a
  test, or `scripts/check-workflow.mjs`. The gates, the required CI checks, the spec directory rule,
  the facts about the toolchain, and every architectural rule that names its enforcer.
- **Guidance.** What an agent or a contributor is expected to do, with nothing that fails when they
  do not. The tracks, the stages, and the rules whose enforcement is "review".

An earlier version of the file described parallel workspaces, read-only contract mounts and a
self-healing retry loop as settings. Nothing read them. An agent took them as guarantees and a
reviewer assumed something enforced them, which is worse than writing nothing. The file now refuses
that kind of setting: a step worth stating as configuration gets a check, or it is written as
guidance.

## The source of truth

```
workflow.ai.yml           ← edit here
    │
    ├── AGENTS.md         ← generated block, loaded by AGENTS.md-aware tools
    ├── GEMINI.md         ← generated whole
    ├── .claude/skills/   ← generated pointers to .agents/skills/
    └── checked against package.json, .githooks/pre-commit, .github/workflows/ci.yml and specs/
```

`scripts/sync-agent-docs.mjs` and `scripts/sync-claude-skills.mjs` do the generating, and both run
with `--check` in the pre-commit hook and in CI. `scripts/check-workflow.mjs` checks every factual
claim: the Node floor and toolchain majors against `package.json`, each gate against the hook and CI,
the required checks against the CI job names, the skill registry against `.agents/skills/`, and the
spec directories against the artifact rule. GitHub's branch protection cannot be seen from a commit,
so `node scripts/check-workflow.mjs --remote` compares it, and the release procedure runs it.

Precedence, highest first:

1. `workflow.ai.yml`
2. `.agents/rules/**` and `.agents/skills/**`
3. `.agents/workflows/**`
4. `AGENTS.md`
5. `GEMINI.md`
6. `CLAUDE.md`
7. `specs/<feature>/**`

On a conflict the rule is: stop, fix the subordinate document, re-run the sync, continue. Never
settle it by following the lower text.

## Tracks

| Track | When | Stages |
| :--- | :--- | :--- |
| feature | a consumer would notice: an export, prop, column field, add-on, option, default, event or markup | 1 to 8 |
| fix | restores documented behaviour, with no new surface | 6, 7, 8 |
| chore | docs, agent instructions, tests, CI, tooling, dev dependencies | 7, 8 |
| release | a version number, the changelog section, the tag | 7, 8, then the release procedure |

A fix that must change a public type or a default is a feature. Work that outgrows its track moves
up, never down.

## The stages

| Phase | Stage | Produces |
| :--- | :--- | :--- |
| 1 | Specify | `spec.md`: the consumer problem, stories, acceptance criteria, non-goals, delivery as a plugin |
| 2 | Clarify | resolutions written back into `spec.md` |
| 3 | Plan | `api-surface.md`, and `plan.md`, `data-model.md`, `research.md`, `events.md` where they apply |
| 4 | Tasks | `tasks.md`, ordered core first, adapter second, docs last, where the work has steps worth tracking |
| 5 | Analyze | a pre-audit; failing here returns to Plan |
| 6 | Implement | code and examples, written against the contract |
| 7 | Verify | `npm run verify`, every gate, actual output reported |
| 8 | Review and ship | `review.md`, documentation sync, changelog, a pull request with green required checks |

## Artifacts in proportion

A feature always writes `spec.md`, `api-surface.md` and `review.md`. Each of the other five is
either written or named in `spec.md` under `## Artifacts not written` with the reason it does not
apply. A feature with no events does not produce a page saying so; it produces one line.

This used to be "all eight, always", and small features answered with padding. A padded
`events.md` looks like a recorded decision about the lifecycle when none was made, which is the same
fault as a grid displaying a total it computed: output that reads as information and is not.

## The contract

Stage 3's `api-surface.md` is different in kind from the rest: every export added, changed or
removed, with signatures, defaults and the semver classification, written before the code. When a
feature is split between an agent in `src/core` and one in `src/react`, both work against it, and
`events.md` when the feature has one. Nothing locks the files. The rule is that an agent finding a
contract wrong stops and reports rather than editing the version the other half is using.

This is the same trick an OpenAPI document plays for a service. A library has no HTTP endpoints, so
the contract describes the public surface and the lifecycle instead.

## Non-goals are load-bearing

Every `spec.md` has a non-goals section, and it is not padding. A grid grows into a framework one
reasonable addition at a time, and each addition is individually defensible. Writing the refusal
down is what makes it survive the next person who asks.

From `specs/gridwright-core/spec.md`: no virtualization, no inline editing, no column resize, no
grouping in 0.1.0. Each with a reason, and for grouping, a reserved stage slot so adding it later
does not renumber the others.

Two of those refusals have since been lifted, by a feature each with its own spec: inline editing in
0.3.0 and virtualization in 0.4.0. That is the point of writing them down. A refusal with a reason
can be revisited when the reason changes, whereas an unwritten one is relitigated every time
somebody asks.

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

Below 1.0, a major takes the next minor. The changed default is the one people misclassify. Nothing
fails to compile, the consumer's build stays green, and their grid behaves differently.

## The gates

```bash
npm run verify
```

| Gate | Catches |
| :--- | :--- |
| `validate-skills` | malformed or unsafe agent instructions |
| `sync --check` | AGENTS.md or the skill pointers drifting from the YAML |
| `check-workflow` | the YAML claiming a toolchain, gate, CI job or spec directory the repository does not have |
| `security-audit` | banned APIs, unsandboxed documents, supply chain settings, sinks in the bundles |
| `typecheck` | everything TypeScript can prove |
| `lint` | the headless boundary, unused code, hook rules |
| `test` | engine, pipeline, data sources, component behaviour, the scripts |
| `test:smoke` | the built artifact, through its export map |
| `check:exports` | the manifest, the export map, the bundles |

The smoke suite and the packaging audit exist because a green unit suite proves less than it looks.
Both unit suites import `src/`. The export map, the CommonJS type entry, whether React leaked into
the core bundle, whether `dist` is even in `files`: all invisible to them.

The pre-commit hook runs the fast gates and blocks the commit. It is versioned in `.githooks/`, and
`npm run hooks:install` points `core.hooksPath` at it, because `.git/hooks` is not versioned and a
hook that exists on one machine is not a gate.

## Skills

Sixteen documents under `.agents/skills/<name>/SKILL.md`, one per area: the engine architecture,
the public surface, data sources, plugins and add-ons, the React adapter, styling, accessibility,
tests, smoke tests, performance, debugging, refactoring, documentation, releases, supply chain and
application security.

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

The full set, blank, with prompts in each explaining what belongs there. Delete what the feature
does not have and say why in `spec.md`. `specs/gridwright-core/` is a completed example: the spec
for the package itself, written as the work was done.

## What it costs

More writing than the code itself, on a small feature. The return is that the constraints are
checkable rather than remembered, that two agents can work in parallel without colliding, and that
six months later the reason for a decision is in `research.md` instead of gone.

If you are using this package rather than contributing to it, none of this reaches you. It is why
the grid behaves the way it does, not something you have to adopt.

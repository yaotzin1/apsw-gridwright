# Agent Orchestration Rules

Guidance. No tool in this repository creates these agents, limits them to a scope or makes a
contract read-only: whether work is split, and how, is the orchestrating agent's decision, and the
rules below are what that decision should respect. In Claude Code the natural mechanism is a
subagent per half, each in its own worktree; in Antigravity, one agent per workspace.

## When to fan out

Parallel subagents earn their cost when the work splits along a real seam with a written contract
between the halves. In this repository that seam is core versus adapter, and the contract is
`api-surface.md` plus `events.md`.

Do not fan out for: a single-file change, an exploratory task where the shape is not yet known, or
work whose halves would both edit `src/core/engine.ts`.

## Roles

When work is split, give each agent one of these roles and hold it to the scope.

| Role | Scope | Access |
| :--- | :--- | :--- |
| `research` | anywhere | read-only |
| `doc_architect` | `specs/`, docs | full |
| `core_developer` | `src/core/`, `src/data/`, `src/plugins/`, `src/tree/`, `src/i18n/`, `src/locales/` | full, own branch |
| `adapter_developer` | `src/react/`, `src/styles/` | full, own branch |
| `qa_auditor` | `tests/` | full, own branch |
| `api_auditor` | anywhere | read-only |

A subagent stays inside its scope. Work that needs both scopes is coordinated through the contract,
not by widening a scope.

## Contracts do not change during implementation

Nothing makes `api-surface.md` or `events.md` read-only, so this holds only if agents hold it. An
implementation agent that finds the contract wrong stops and reports. It does not edit the
contract, because the other half of the work is being written against the version it was given.

## Reporting

A subagent reports what it actually ran and what the output actually said. A summary of a test run
is not evidence of a test run, and an agent that reports a green suite it did not execute has done
more damage than one that reports a red one.

## Verification is not delegated to the author

The agent that wrote the implementation is the worst judge of whether its tests are meaningful.
Stage 7 runs the full gate independently of who wrote the code.

# Specification: agent compatibility

> **Status**: Draft, not scheduled. One dated item: `.agents/workflows/` stops working in
> Antigravity on 2026-11-01 (see research.md).
> **Stage entry**: 1
> **Track**: chore. Nothing a consumer installs changes. It has a spec directory anyway because it
> spans several tools, and the research behind it should outlive the conversation that found it.
> **Semver impact**: none

---

## 1. The problem

`workflow.ai.yml` is written for every coding agent, but it has only been checked end to end with
Claude Code. Measured on 2026-09-15, against Antigravity's documentation:

- **`AGENTS.md` is 21,832 characters.** Antigravity caps each rules file, `AGENTS.md` included, at
  12,000. The generated operating cycle starts about two-thirds of the way in, so Antigravity sees
  a cut-off copy of it, or none at all.
- **Everything in `.agents/workflows/` stops working on 2026-11-01.** Antigravity stops indexing
  workflow directories and moves to skills. Stages and the release track point at those files.
- **None of the ten files in `.agents/rules/` says when to activate.** Antigravity activates a
  rule as always-on, by glob, by model decision or by @mention. It is not documented what it does
  with a file that says none of these.
- **`GEMINI.md` and the precedence list claim that Antigravity lets `GEMINI.md` win over
  `AGENTS.md`.** Google's documentation states no order between the two.
- **Other agents are unverified.** Codex, Cursor, Windsurf, Copilot and Gemini CLI read
  `AGENTS.md` or `GEMINI.md` with different size limits, import syntax and skill discovery.

The enforcement layer is tool-independent: the pre-commit hook, CI and `scripts/check-workflow.mjs`
stop a bad commit whichever agent wrote it. What differs between tools is whether the agent ever
*sees* the tracks, stages and review-only rules, which are the parts nothing enforces.

## 2. User stories

- **US-01.** As the maintainer switching between Claude Code and Antigravity, I want both agents to
  follow the same tracks and rules without my repeating them in chat.
- **US-02.** As a contributor using Codex, Cursor or Copilot, I want the rules the repository expects
  to reach my agent through the files it already reads.
- **US-03.** As the maintainer, I want the build to fail when an instruction file grows past what a
  supported agent will read, instead of finding out from an agent that ignored half of it.
- **US-04.** As anyone reading the compatibility notes, I want to know which claims were tested,
  with which tool version and when, and which are taken from documentation.

## 3. Acceptance criteria

- [ ] **AC-01** `workflow.ai.yml` lists the supported agents, the files each loads, and the character
      limit of each, with the date and source of every fact.
- [ ] **AC-02** `scripts/check-workflow.mjs` fails when `AGENTS.md`, `GEMINI.md` or any file under
      `.agents/rules/` exceeds the smallest limit among the agents that load it.
- [ ] **AC-03** `AGENTS.md` is under 12,000 characters. It carries the tracks, the gates and one
      line per architectural rule. The stage and skill tables move to a generated rules file that is
      also under the limit and linked from `AGENTS.md`.
- [ ] **AC-04** `.agents/workflows/` no longer exists. Each procedure is a skill under
      `.agents/skills/`, and every `guidance` reference points at a skill or a rule. The release
      procedure merges into the existing `release` skill instead of adding a second skill with the
      same slash command. `check-workflow.mjs` fails if a workflow directory or a reference to one
      reappears.
- [ ] **AC-05** Every file under `.agents/rules/` declares its activation, in Antigravity's syntax
      as verified against the product (see research.md, open question Q1). Architecture and
      security are always on.
- [ ] **AC-06** No document states a precedence between `GEMINI.md` and `AGENTS.md` that the
      vendor does not document. The generated precedence list says the order is unspecified, and
      that neither file carries a rule the other lacks, which makes the order harmless.
- [ ] **AC-07** `GEMINI.md` imports `AGENTS.md` using Gemini CLI's import syntax, so an agent that
      loads only `GEMINI.md` gets the cycle without having to open a second file.
- [ ] **AC-08** `docs/agent-compatibility.md` holds a matrix: per agent, what it loads, what it
      misses, and whether each cell was verified (tool, version, date) or read from documentation.
- [ ] **AC-09** A manual check per agent, written down and repeatable: open the repository cold and
      ask "which track is a documentation-only change, and which gates will block its commit?" The
      expected answer is `chore`, plus the eight pre-commit gates. A tool fails the check if its
      agent cannot answer from the files alone.

## 4. Non-goals

- **Per-tool copies of the rules** (`.cursor/rules/`, `.github/copilot-instructions.md`,
  `.windsurfrules`). A generated pointer, like `.claude/skills/`, is acceptable when a tool reads
  nothing else; a second text is not.
- **Running agents in CI.** AC-09 is a manual check. An automated one would need API keys and
  would test the model rather than the files.
- **Supporting every agent.** The supported set is the one listed under AC-01. An unlisted tool gets
  `AGENTS.md` and the gates, which is what it gets today.
- **Changing what is enforced.** This spec is about delivering the rules to agents. The gates
  already apply to every agent.

## 5. Behaviour across the capability seam

Not applicable: no data source, query or pipeline stage is involved.

## 6. Accessibility and interface copy

Not applicable: nothing is rendered.

## 7. Delivery as a plugin

Not applicable: this changes repository instruction files and scripts, not the package.

## 8. Clarifications

- **Why not now:** nothing is broken for Claude Code, and the enforcement already covers every
  agent. The date that matters is 2026-11-01, when Antigravity stops reading workflows; start AC-04
  before it.
- **Which limit wins:** the smallest limit among the agents that load a file, because a file that is
  too long for one supported agent is broken for that agent.

## Artifacts not written

- `data-model.md`: no state or type shapes; the new `workflow.ai.yml` keys are in api-surface.md.
- `events.md`: no events or pipeline stages.

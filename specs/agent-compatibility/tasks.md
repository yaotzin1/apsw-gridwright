# Tasks: agent compatibility

Ordered by date and risk. Tasks 1 to 3 should land before 2026-11-01.

- [ ] **T1** Confirm the research gaps for every agent listed in research.md, with a source and a
      date. Answer Q1 to Q3 in Antigravity itself and record the version.
- [ ] **T2** Add the `agents` section to `workflow.ai.yml` and the size check to
      `scripts/check-workflow.mjs`, with tests. It fails today on `AGENTS.md`, which is expected, so
      land it together with T3.
- [ ] **T3** Split the generated block: a short `AGENTS.md`, plus a generated
      `.agents/rules/workflow_cycle.md`. Both under the limit. Re-run the sync and the check.
- [ ] **T4** Migrate `.agents/workflows/` to skills (AC-04): `spec_driven_development`,
      `verification`, `branching`, `create_plugin`, `create_data_source`, and `release` merged into
      the existing `release` skill. Update every `guidance` reference and document link. Make the
      check refuse a workflow directory.
- [ ] **T5** Add activation frontmatter to `.agents/rules/*.md` in the syntax T1 verified.
- [ ] **T6** Correct the precedence text about `GEMINI.md` and `AGENTS.md`, and add the Gemini CLI
      import to `GEMINI.md`.
- [ ] **T7** Write `docs/agent-compatibility.md`: the matrix and the manual check. Run the check in
      Claude Code and Antigravity at least, and record the results.
- [ ] **T8** Review (review.md), then `npm run verify`.

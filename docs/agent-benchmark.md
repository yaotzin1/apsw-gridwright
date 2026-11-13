# Agent benchmark

[The agent playbook](agent-playbook.md) says the grid is easy for a coding agent to configure.
This page is the measurement behind that sentence: what was run, what came out, and what the
numbers do not show. The runner and the tasks are in `bench/agents/` in the repository, and
`bench/agents/README.md` is the full methodology.

## What is measured

An agent gets a plain request in a fresh project outside the repository ("a grid over this REST
endpoint, which cannot sort") and writes `src/Solution.tsx`. Hidden behaviour tests it never saw
then grade the file. Three conditions, 10 tasks each:

| Condition | What the agent has |
| :--- | :--- |
| Gridwright, cold | The installed package: its types and its npm README |
| Gridwright, with playbook | The same, plus `docs/agent-playbook.md` in the project |
| TanStack Table 8.21.3 | The installed package, cold. The baseline: a library every model has seen many times |

A trial **passes** only when the file exists, imports the required library, type-checks with zero
errors and passes every hidden test. **API errors** are TypeScript errors that name an export,
prop, option or module that does not exist, counted after the agent finished.

The tasks are the documented trouble spots: one-based paging, a server that rejects `sort`, no
total, identity by `uuid`, a panel under a row, a Polish interface, 100 000 rows.

## Result

Claude Code (Sonnet 5.5, default settings), compiler allowed, 3 repetitions of every cell,
`@apsw/gridwright` 0.24.0, run on 2026-11-06.

| Condition | Trials | Pass | API errors | Mean turns | Mean cost |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Gridwright, cold | 30 | 100% | 0 | 16.8 | $0.24 |
| Gridwright, playbook before the recipes below | 30 | 100% | 0 | 6.9 | $0.13 |
| Gridwright, playbook with the recipes below | 30 | 100% | 0 | 6.3 | $0.12 |
| TanStack Table 8.21.3, cold | 30 | 100% | 0 | 3.8 | $0.08 |

Every task passed 3 out of 3 in every condition.

### What this supports

- A coding agent configures Gridwright correctly with nothing but the installed package, including
  the cases where a plausible guess is wrong (a total computed from one page, zero-based paging, a
  capability the endpoint lacks).
- The playbook roughly halves the work: about 60% fewer turns and 45% less cost than cold.
- Gridwright still costs more to configure than TanStack Table. With the playbook it takes about
  1.6 times the turns and cost; cold, about 4.5 times the turns and 3 times the cost. A model that
  has seen a library often needs fewer turns to use it.

### What it does not support

- **No difference in correctness.** A 100% ceiling in every condition means this run cannot rank
  the libraries on pass rate.
- **Not "the agent never invents API".** With the compiler available an agent can run `tsc` and
  fix what it got wrong, so zero API errors means none were left at the end. Separating "never
  invented" from "invented and corrected" needs `--tools blind`, which has not been run.
- **One agent, one model.** Gemini CLI and IDE agents are supported by the runner and have not been
  measured.
- **The author wrote the tasks.** The prompts describe behaviour, not API, and the TanStack
  references pass with idiomatic v8 code, but a reviewer outside the project should read
  `bench/agents/tasks/` before the numbers are quoted.
- **The playbook was tuned after the first run.** The "Common requests" section was written after
  reading which tasks cost the most turns, and the same author wrote the tasks. The gain it
  produced (6.9 to 6.3 turns) is small, sits inside the run-to-run spread at 3 repetitions, and
  came mostly from the tasks it has a recipe for (04, 06, 10). Read the cold row as the figure that
  was not tuned.
- **jsdom is not a browser.** Task 10 fakes layout, so it checks that a window of rows is rendered,
  not that scrolling feels right.

## Why the grader can be trusted

`node bench/agents/bench.mjs selftest` runs before any agent does:

- A hand-written reference solution for every task and library must pass: 20 of 20.
- Nine negative controls, the mistakes an agent plausibly makes (a REST source that claims sorting,
  an invented total, zero-based pages, invented props, an unvirtualized table), must each fail: 9
  of 9.

The second check caught a real defect while this page was being written. A solution that rendered
all 100 000 rows ran the test process out of memory, vitest reported its tests as pending rather
than failed, and the grader counted that as a pass. A trial now passes only when every test
actually passes.

## Running it

```bash
node bench/agents/bench.mjs setup                      # once: installs the sandbox in ~/.gridwright-bench
node bench/agents/bench.mjs selftest                   # references pass, negative controls fail
node bench/agents/bench.mjs run --agent claude --reps 3
node bench/agents/bench.mjs report --run <id printed by run>
```

`--libs gridwright --conditions docs` re-runs one cell after the playbook changes.
`--tools blind` forbids the compiler. `--agent manual` prepares a trial directory for an IDE agent.
A full run is 90 trials; with Claude Code each takes one to five minutes and costs about
$0.10 to $0.30.

The sandbox lives outside the repository, so a cold agent cannot read `docs/` or `src/`. Web search
is switched off for Claude Code only; say which applied when quoting a number.

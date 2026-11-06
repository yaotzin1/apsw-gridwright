# Agent configuration benchmark

`docs/agent-playbook.md` says the grid is written to be used by coding agents. This benchmark is
the evidence for that claim, or against it: give an agent a plain request ("a grid over this REST
endpoint, which cannot sort"), let it work in a fresh project, then grade the result with tests it
never saw.

It answers three questions:

1. **Does it work?** Pass rate per task, per library, per agent.
2. **Does the agent invent API?** TypeScript errors that name an export, prop, option or module
   that does not exist, counted after the agent finished.
3. **Does the playbook help?** The same Gridwright tasks with and without `docs/agent-playbook.md`
   in the project.

The baseline is `@tanstack/react-table` 8.21.3, the version models have seen most, so the
comparison is conservative: an older, well-known library against one published after every
model's training cutoff.

Results and what they do and do not show: [docs/agent-benchmark.md](../../docs/agent-benchmark.md).

## Running it

Node 22 or newer, and the agent CLIs you want to test, logged in. Windows, macOS and Linux work:
the runner starts `npm`, `tsc` and `vitest` through the current Node, not through `.cmd` shims.

```bash
node bench/agents/bench.mjs setup                     # once: installs the sandbox in ~/.gridwright-bench
node bench/agents/bench.mjs selftest                  # references pass, negative controls fail
node bench/agents/bench.mjs run --agent claude --reps 3
node bench/agents/bench.mjs run --agent gemini --reps 3
node bench/agents/bench.mjs run --agent manual --tasks 04,06 --reps 1   # Codex in IntelliJ, Antigravity
node bench/agents/bench.mjs report --run <id printed by run>
```

`setup --gridwright file:/path/to/apsw-gridwright-0.25.0.tgz` benchmarks an unpublished build
(`npm pack` it first). `--root DIR` moves the sandbox; it refuses a directory inside the repository.

| `run` flag | Default | Meaning |
| :--- | :--- | :--- |
| `--agent` | required | `claude`, `gemini` or `manual`; commands live in `agents.json` |
| `--model` | CLI default | passed through as the CLI's model flag; the report records it |
| `--libs` | `gridwright,tanstack` | which libraries |
| `--conditions` | `cold,docs` | `docs` applies to Gridwright only |
| `--tools` | `compiler` | `compiler`: the agent may run `tsc`. `blind`: it may run nothing, which measures raw API knowledge |
| `--tasks` | `all` | `01,04` or full names |
| `--reps` | `3` | repetitions of every cell |
| `--timeout-min` | `15` | per trial; a timed-out trial is graded on what it left |
| `--keep` | off | keep trial directories instead of deleting them after grading |

The `manual` agent prepares each trial, prints its directory and waits. Open the directory in the
IDE, paste `PROMPT.md` into the agent, let it finish, press Enter. Turn the IDE agent's web access
off if it has a setting for it.

A full run is 10 tasks × 3 cells × 3 reps = 90 trials per agent. With Claude Code each trial takes
one to five minutes.

## What a trial is

1. A fresh directory under `~/.gridwright-bench/trials/<run>/`, with a `package.json` listing only
   the libraries the trial may use, a `tsconfig.json`, and `node_modules` linked to the sandbox.
2. **cold**: nothing else. The agent has the installed package: its types and its npm README.
   **docs**: `docs/gridwright-playbook.md` (a copy of `docs/agent-playbook.md`) and an `AGENTS.md`,
   `CLAUDE.md` and `GEMINI.md` that tell the agent to read it, the way a project would.
3. The prompt (`PROMPT.md`): the library to use, the file to write (`src/Solution.tsx`), the row
   shape, the task, and whether the compiler may be run. Prompts are identical across libraries
   except for the library line.
4. After the agent exits, the grader type-checks `src/`, copies in the hidden test, runs it under
   jsdom with an in-memory `/api/people`, then deletes the test and the trial. `src/`, the prompt
   and the agent's log are archived under `results/<run>/`.

**Pass** means all four: `src/Solution.tsx` exists, it imports the required library (and not the
other one), `tsc` reports zero errors, and every hidden test passes. A test that did not run (a
crashed or out-of-memory test process reports its tests as pending) is not a pass.

## The tasks

| Task | What it asks | What it catches |
| :--- | :--- | :--- |
| 01 array-basic | three columns, 25 per page, a next button | the basic shape of the API |
| 02 sort | header buttons, ascending first, `aria-sort` | numeric columns sorting descending first; missing `aria-sort` |
| 03 search | a search box over every row | searching only the current page |
| 04 rest | server paging and sorting, one-based `page`, total shown | zero-based pages; sorting on the client |
| 05 page-only | a server that answers 400 to anything but `page`/`pageSize` | claiming a capability the server lacks |
| 06 no-total | a bare array with no total; a short page is the last | inventing a total from the pages seen |
| 07 selection | rows identified by `uuid` | keying selection on the wrong id |
| 08 row-detail | a labelled panel directly under its row | panels in the wrong place or unnamed |
| 09 polish | the whole interface in Polish | English left behind |
| 10 huge | 100,000 rows, at most 200 in the DOM | rendering everything |

Accessible names in the prompts are matched loosely (`/next page/i`), so neither library's default
wording is privileged. Where a prompt fixes exact text (08, 09) it is because the reader needs it,
and both libraries must produce it.

## Why the numbers can be trusted, and where they cannot

**Every task is solvable in both libraries.** `references/gridwright/` and `references/tanstack/`
hold a hand-written solution per task; `selftest` requires all twenty to pass.

**Every task fails the mistake it is meant to catch.** `references/negative/` holds wrong
solutions an agent plausibly writes: a REST source that claims sorting, a total computed from one
page, zero-based paging, an unvirtualized table, invented props. `selftest` requires each one to
fail, and the invented-API control to be counted as API errors.

**The agent cannot see the answers.** The sandbox lives outside the repository, so a cold agent
cannot read `docs/` or `src/`; hidden tests exist only during grading; a trial is deleted before the
next starts.

Limits, stated so nobody has to find them:

- **jsdom is not a browser.** Layout is faked for task 10 (`fakeLayout`), so it checks that a
  window is rendered, not that scrolling feels right.
- **Agents are not fully isolated.** Claude Code still reads `~/.claude/CLAUDE.md` and its settings;
  Gemini CLI runs with `--yolo`, which does not switch off its web tools. Web search is switched off
  only for Claude Code (`--disallowedTools`). Say which applied when publishing a number.
- **API errors are counted at the end.** With `--tools compiler` an agent can fix what it invented,
  so a low count can mean "never invented" or "invented and corrected". `--tools blind` separates
  the two; the turn count and cost (Claude Code only) show how much correcting happened.
- **Ten tasks are a sample.** They cover the documented trouble spots, not every feature. Small
  differences at three repetitions are noise; quote pass rates with the trial count.
- **The author wrote the tasks.** The prompts describe behaviour, not API, and the TanStack
  references were written to pass with idiomatic v8 code, but a reviewer outside the project should
  read `tasks/` before a result is used in public.

## Files

```
bench/agents/
  bench.mjs          setup, selftest, run, report
  agents.json        how each agent CLI is started
  sandbox/           installed into the sandbox root: dependencies, tsconfig, vitest, harness
  tasks/<id>/        prompt.md (what the agent reads) and test.tsx (what it never sees)
  references/        a passing solution per task and library, and the negative controls
```

`results/` is written to the sandbox, not to the repository. Commit a `summary.md` from
`report --out` only together with the run's versions and the agent and model it names.

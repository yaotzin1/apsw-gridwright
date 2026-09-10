# Agent Execution Standards

## Before changing anything

Read the file you are about to change, in full, including its comments. The comments in this
codebase record bugs that have already happened once; a change that deletes one usually reinstates
the bug.

## While changing

- Match the surrounding style: four-space indent, single quotes, trailing commas, the comment
  density already present.
- Comments say why, not what. If the comment restates the line, delete the comment.
- Prefer adding a plugin over adding an option, and an option over a special case.

## Paths

No absolute paths anywhere in source, tests, configs or fixtures. No `C:\...`, no `/home/...`.
Resolve from `import.meta.url`, `process.cwd()` or a config-relative base, so the same suite passes
on Windows, in a container and on CI.

## Update the examples with the feature

A feature is not finished when the tests and the docs are. `examples/` has to demonstrate it in the
same change: a page or a section under `examples/playground/`, a section in the type-checked
`examples/react-remote/App.tsx` where the API shape is worth showing, the playground README, and
the CI job that boots the pages.

This is not tidiness. Building the tree page found two defects the whole suite had missed, one of
them present since the first release, because no test had ever swapped a prop the way a real
application does.

## Before reporting complete

Run `npm run verify` and report its actual output. If a gate failed, say which one and what it
printed. A change reported as done while a gate is red is a false report, and it is worse than an
unfinished change because the next agent builds on it.

## When blocked

State what you tried, what happened, and what you need. Do not silently narrow the task, and do not
mark unfinished work as done with a note buried at the end.

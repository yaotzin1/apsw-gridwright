# Workflow: Branching

## Naming

```
feat/<feature-name>      matches the specs/<feature-name> directory
fix/<short-description>
chore/<short-description>
docs/<short-description>
```

The feature branch and the spec directory share a name, so a reviewer can find one from the other.

## Commits

Conventional commits, because the changelog and the version bump are derived from them:

```
feat(core): negotiate search capability with the data source
fix(react): stop the row handler firing on a selection checkbox click
docs(specs): record the semver impact of the labels change
chore(build): split the shared chunk between both entries
```

A `!` after the scope, or a `BREAKING CHANGE:` footer, marks a major.

## Before opening a pull request

```bash
npm run verify
```

Then fill `.github/PULL_REQUEST_TEMPLATE.md` completely, including the semver classification and
the seven review answers. A pull request that says "see the spec" for the review has not had one.

## Merging

Squash. The branch's intermediate commits are working notes; the trunk's history is the changelog's
raw material.

CI must be green. A merge with a red gate is a merge that hands the next person a broken trunk.

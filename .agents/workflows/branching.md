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

## `main` is protected

Enforced by the repository, not by convention:

- **No direct pushes.** Every change arrives through a pull request, including a typo fix.
- **All six checks must pass.** Agent instruction set, Verify on Node 18, 20 and 22, Example
  playground boots, Publishable tarball. A merge with a red gate is refused rather than discouraged.
- **The branch must be up to date** with `main` before merging, so the checks that passed are the
  checks for the code that lands.
- **No force pushes and no deletion**, for anyone including the owner. This is the one restriction
  with no bypass, because it is the one whose damage cannot be undone from a clone.
- **Stale approvals are dismissed** when new commits arrive.

Administrators are not bound by the pull request and status check rules, deliberately: a solo
maintainer who locks themselves out of their own trunk has built an outage, not a safeguard. That
exemption is an escape hatch for an emergency, not the normal route. Use the pull request.

To tighten it so the rules bind everyone:

```bash
gh api -X POST repos/yaotzin1/apsw-gridwright/branches/main/protection/enforce_admins
```

and to relax it again, the same call with `-X DELETE`.

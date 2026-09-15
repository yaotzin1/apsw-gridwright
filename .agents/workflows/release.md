# Workflow: Release

The `release` track in `workflow.ai.yml`. Publishing is close to irreversible: a version can be
unpublished for 72 hours and never republished under the same number.

## 1. Confirm the classification

It was decided when the change was planned and written into `specs/<feature>/api-surface.md` and
the Unreleased entries. You are recording a decision, not making one. The table is in
`.agents/skills/api_surface/SKILL.md`. Below 1.0, a breaking change takes the next minor.

## 2. Update the changelog

Move the Unreleased entries under the new version and date, and add the compare link at the bottom.
Each entry answers: what changed, does it affect me, what do I do. A breaking change carries a
migration line with the before and after.

## 3. Bump and sync

```bash
npm version <patch|minor|major> --no-git-tag-version
```

Then update `VERSION` in `src/index.ts` to match. The packaging audit fails if they disagree,
because a bug report that names a version the code never carried is a bug report nobody can act on.

## 4. Run the gate

```bash
npm run verify
npm pack --dry-run
node scripts/check-workflow.mjs --remote
```

Read the tarball listing: `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json`, and
nothing from `src`, `tests`, `specs` or `.agents`. The last command compares the checks GitHub
requires on `main` with `ci.required_checks`; a required check that no job produces blocks every
merge, and nothing in a commit can see it.

## 5. Merge

Open the pull request, wait for the required checks, squash-merge. `main` must already contain
everything the tag will name.

## 6. Tag, which publishes

```bash
git switch main && git pull --ff-only
git tag -a v<version> -m "v<version>"
git push origin v<version>
```

Pushing the tag runs `.github/workflows/release.yml`: it refuses a tag that does not match
`package.json`, runs `npm run verify`, and runs `npm publish --provenance`. **The push is the
publish decision.** It belongs to the maintainer; an agent pushes a tag only when asked to, and says
what the push will start. While no npm token is configured, the workflow stops at the publish step
and nothing reaches the registry.

Never `npm publish` from a working copy: it skips provenance, and it publishes whatever the working
copy holds rather than the commit on `main`.

## 7. Confirm

```bash
gh run list --workflow release.yml --limit 1
npm view apsw-gridwright versions
```

## If something is wrong after publishing

Within 72 hours, `npm unpublish apsw-gridwright@<version>` and note that the number is burned
permanently. After that, publish a patch and deprecate the bad version:

```bash
npm deprecate apsw-gridwright@<version> "Broken export map, use <version+1>"
```

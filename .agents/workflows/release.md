# Workflow: Release

Publishing is close to irreversible: a version can be unpublished for 72 hours and never republished
under the same number.

## 1. Confirm the classification

It was decided at stage 3 and written into `specs/<feature>/api-surface.md`. You are recording a
decision, not making one. The table is in `.agents/skills/api_surface/SKILL.md`.

## 2. Update the changelog

Move the Unreleased entries under the new version and date. Each entry answers: what changed, does
it affect me, what do I do. A breaking change carries a migration line with the before and after.

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
```

Read the tarball listing. `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json`. Nothing
from `src`, `tests`, `specs` or `.agents`.

## 5. Publish

```bash
npm publish
```

`prepublishOnly` runs `npm run verify` again. Never pass `--ignore-scripts`.

## 6. Tag and confirm

```bash
git tag v<version>
git push --follow-tags
npm view apsw-gridwright versions
```

## If something is wrong after publishing

Within 72 hours, `npm unpublish apsw-gridwright@<version>` and note that the number is burned
permanently. After that, publish a patch and deprecate the bad version:

```bash
npm deprecate apsw-gridwright@<version> "Broken export map, use <version+1>"
```

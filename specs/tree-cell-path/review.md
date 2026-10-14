# Self-review: Tree path in the cell context

## 1. Boundary and layering

No core change. `CellContext.node` is declared by module augmentation in `src/react/tree/TreeCell.tsx`, so `src/react/types.ts` stays free of tree types; `reactTreeColumns` fills it. The augmentation is present in `dist/react/index.d.ts` and `.d.cts`. Nothing under `src/core`, `src/data` or `src/plugins` was touched.

## 2. The local/remote seam

The node comes from the tree index, which is built the same way for a local array and a remote source. Where a paginating source has not loaded a parent, `rowPath` lists what the index knows.

## 3. Public surface and semver

Minor. One optional field on `CellContext`; no export added, none removed, no default changed.

## 4. Accessibility and i18n

No markup and no string added.

## 5. Supply chain and packaging

No dependency, no manifest change. `check:exports` and `test:smoke` pass.

## 6. Honest output

`node` is `undefined` in a flat grid, and a test asserts it.

## 7. Verification

Run individually, after `build`, because `npm run lint` also scans untracked `.claude/worktrees/` (not part of the repo) and fails on those 1744 errors with or without this change:

- `npm run typecheck`: clean
- `npx eslint src tests scripts`: clean
- `npm test`: all pass after adding `plan.md` and `tasks.md` to "Artifacts not written" (the workflow-check tests had failed on that alone)
- `npm run test:smoke`: 33 passed
- `npm run check:exports`: the published package resolves cleanly
- `node scripts/security-audit.mjs --source`: no findings

## Known gaps

- Not yet clicked through in the playground (project rule: verify in Chrome).
- The Material UI package (`apsw-gridwright-mui`) was not checked for a view that rebuilds `CellContext`.

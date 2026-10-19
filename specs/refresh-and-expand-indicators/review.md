# Self-review: Refresh and expand indicators

## 1. Boundary and layering

No core change and no shell change. Everything is in `src/react/loading/` through the public slots `aboveTable`, `renderRow` and `rowAfter`. The add-on reads tree node state through the tree's own context hook, and only for a row whose data has the shape of a tree node. Nothing under `src/core`, `src/data` or `src/plugins` was touched.

## 2. The local/remote seam

Presentation only; it reads the engine's `status` and the tree controller's node state, for any source.

## 3. Public surface and semver

Minor: three optional fields, every default unchanged.

## 4. Accessibility and i18n

No string added. Placeholders and spinners are `aria-hidden`; the live region and `aria-busy` are the grid's own and unchanged. The spinner row under a node carries the grid's "Loading" label, visually hidden. Expansion is not announced, as before.

## 5. Supply chain and packaging

No dependency or manifest change.

## 6. Honest output

No invented numbers or decoration.

## 7. Verification

- `npm run verify`: passed end to end (typecheck, lint, 1374 unit and react tests, build, smoke, exports, security audit).
- Eight new tests in `tests/react/loading-indicators.test.tsx`: the centred spinner, the skeleton swap and restore, the delay holding the old rows, the unchanged default, and the expand spinner, skeleton, default and non-tree cases.
- Playground, Chrome, with a 1.5 s server: on the employees page a real page change under `dim` kept the 25 rows with `aria-busy` and nothing else, under `spinner` kept them and drew one spinner centred on the table, under `skeleton` swapped them for 25 placeholders and restored 25 rows. A failed refresh restored the rows too. On the files page (lazy shape), a folder expanded with `none` pulsed the toggle only, with `spinner` drew a spinner row that went away when the children arrived, and with `skeleton` drew three placeholder rows then the children.

## Known gaps

- `refreshVariant: 'skeleton'` answers `renderRow`, whose first contributor wins, so an add-on listed before this one that renders every row itself would take precedence during a refresh.
- Not published: the change waits in Unreleased by the maintainer's decision.

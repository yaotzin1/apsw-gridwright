# Tasks: `@apsw/gridwright-vue`

- [x] **T-01** Install `vue` (`^3.5.0`) as a root `devDependency` and scaffold `packages/vue/` (`package.json`, `tsup.config.ts`, `tsconfig.build.json`, `LICENSE`, `README.md`, `CHANGELOG.md`).
- [x] **T-02** Wire `packages/vue` into root `package.json` (`build`, `clean`), `tsconfig.json` (`paths`), `vitest.config.ts`, and `scripts/check-exports.mjs`.
- [x] **T-03** Implement `packages/vue/src/render-node.ts` (`renderViewNode`, `toViewEvent`, `originOf`, attribute/property normalization, focus-key registration).
- [x] **T-04** Implement `packages/vue/src/use-gridwright.ts` (`useGridwright` composable with `onScopeDispose` cleanup).
- [x] **T-05** Implement `packages/vue/src/gridwright.ts` (`<Gridwright>` component with focus restoration, `#toolbar`, `#cell`, `#cell-<id>`, and `column.render` support) and `packages/vue/src/index.ts`.
- [x] **T-06** Write `packages/vue/tests/conformance.test.ts` (Vue `ConformanceDriver` running all 17 `conformanceSuite` scenarios) and `packages/vue/tests/vue-adapter.test.ts`.
- [x] **T-07** Run `npm run verify` and fix any issues.
- [x] **T-08** Update documentation (`README.md`, `CHANGELOG.md`, `specs/DEPENDENCY_MAP.md`, `specs/vue-adapter/review.md`).

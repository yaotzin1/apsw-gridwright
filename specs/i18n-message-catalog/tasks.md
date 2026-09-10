# Tasks: Message catalog and translation

Ordered by dependency. All complete.

## Core

- [x] **T-01** `src/i18n/messages.ts`: `MessageKey`, `PluralMessage`, `MessageCatalog`,
      `LocaleCatalog`, the English catalog, `messageKeys`, `auditCatalog`.
- [x] **T-02** `src/i18n/translator.ts`: `{name}` interpolation with locale number formatting,
      plural selection through `Intl.PluralRules` with an exact-zero form, direction through
      `Intl.Locale` with a language fallback, and `createTranslator` with the documented
      resolution order.
- [x] **T-03** Every `Intl` call wrapped, so an unparseable tag cannot throw during a render.

## Locales

- [x] **T-04** `en`, `de`, `es`, `fr`, `pl`, each complete against the key set.
- [x] **T-05** `src/locales/index.ts` as a third entry point.

## Adapter

- [x] **T-06** `labelsFrom` derives the label object from a translator; `defaultLabels` is derived
      from the English one so the two cannot drift.
- [x] **T-07** `GridwrightI18nProps`, accepted by both the provider and the component.
- [x] **T-08** `useTranslator`, and the translator published on the context.
- [x] **T-09** `dir` and `lang` on the grid root, `dir` only for right-to-left.

## Build and packaging

- [x] **T-10** tsup entry for `locales`, export map, `.d.cts` conditions.
- [x] **T-11** The packaging audit checks all five catalogs resolve from the built entry.

## Tests

- [x] **T-12** Unit: catalog completeness for every bundled pack, interpolation, plural selection
      across English and Polish, direction, fallback, external-function handling (39 tests).
- [x] **T-13** React: rendering in Polish and German, plural forms at 1, 2 and 3, locale number
      formatting, the bare tag, message overrides, an external `translate`, `labels` precedence,
      RTL, composition through the provider (14 tests).
- [x] **T-14** Smoke: every pack resolves from `dist/locales`, and a translated grid renders from
      the built bundles including the plural form.

## Documentation

- [x] **T-15** `docs/i18n.md`.
- [x] **T-16** `docs/plugins.md`, `docs/extensibility.md`, `docs/data-sources.md`,
      `docs/spec-driven-development.md`, `docs/README.md`.
- [x] **T-17** README translation section, documentation index, API tables.
- [x] **T-18** CHANGELOG 0.2.0, `specs/DEPENDENCY_MAP.md`.

## Stage 7 — Verification

- [x] `npm run verify` green end to end. Output in review.md.

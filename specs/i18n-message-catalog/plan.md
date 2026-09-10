# Plan: Message catalog and translation

## Modules

| File | Responsibility |
| :--- | :--- |
| `src/i18n/messages.ts` | `MessageKey`, catalog types, the English catalog, `auditCatalog` |
| `src/i18n/translator.ts` | interpolation, plural selection, direction, `createTranslator` |
| `src/i18n/index.ts` | the barrel |
| `src/locales/{en,de,es,fr,pl}.ts` | one catalog each |
| `src/locales/index.ts` | the third entry point |
| `src/react/labels.ts` | derives `GridwrightLabels` from a translator |
| `src/react/context.tsx` | `useTranslator`, translator on the context |
| `src/react/types.ts` | `GridwrightI18nProps` |
| `src/react/Gridwright.tsx` | passes i18n props through, sets `dir` and `lang` |

## Where the behaviour lives

Translation is presentation, so it could have gone in the adapter. It is in the core because a
non-React adapter needs it too, and because `defaultLabels` has to be derived from the English
catalog or the two drift.

Nothing in the pipeline, the engine state or the query changes. The engine does not know the grid
has been translated.

## Layering

```
locales/*          data only
    │
i18n/messages      contract: keys, catalog shape, audit
    │
i18n/translator    Intl.PluralRules, Intl.NumberFormat, Intl.Locale
    │
react/labels       translator -> GridwrightLabels
    │
react/context      one translator per provider, memoised
    │
parts              render labels, unchanged
```

The parts were not touched. They already read from `labels`, which is now derived rather than
written, and that is the whole reason the change is additive.

## Resolution order

`labels` > `translate` > `messages` > catalog > English. One order, documented once, implemented in
`createTranslator` plus `mergeLabels`.

## Trade-offs taken

- **`{placeholder}` rather than ICU.** No parser, therefore no dependency. Cannot select on
  anything but a count; nothing here needs to.
- **The translator is unconditional in the core.** `defaultLabels` needs it, so it cannot be
  tree-shaken. Roughly 3 kB.
- **Catalogs are eagerly imported objects.** Lazy loading is the consumer's to arrange with a
  dynamic import; building it in would mean an async translator and a loading state for text.

## Risks

| Risk | Mitigation |
| :--- | :--- |
| A catalog falls behind the key set | `auditCatalog`, plus a parameterised test over every bundled pack |
| Five locales bloat every bundle | a separate entry point, checked by the packaging audit |
| A locale tag the runtime cannot parse throws mid-render | every `Intl` call is wrapped; tested with `'!!!'` |
| An external library echoing keys puts identifiers on screen | echoed keys treated as untranslated; tested |

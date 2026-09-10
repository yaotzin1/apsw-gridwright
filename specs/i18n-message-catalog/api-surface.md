# API surface contract: Message catalog and translation

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces.

## Semver classification

**minor — 0.2.0.** Everything is additive. `labels` keeps its exact 0.1.0 behaviour and is applied
above the new catalog, so no existing call changes meaning.

## New entry point

| Specifier | Contents |
| :--- | :--- |
| `apsw-gridwright/locales` | `en`, `de`, `es`, `fr`, `pl` |

ESM and CJS, each with its own `types` condition, like the existing two.

## Exports added to `apsw-gridwright`

| Name | Signature |
| :--- | :--- |
| `createTranslator` | `(options?: TranslatorOptions) => Translator` |
| `auditCatalog` | `(messages: Partial<MessageCatalog>) => { missing, unknown }` |
| `interpolate` | `(template, values, formatNumber) => string` |
| `selectPluralForm` | `(message: PluralMessage, count: number, locale: string) => string` |
| `resolveDirection` | `(locale: string) => 'ltr' \| 'rtl'` |
| `englishCatalog`, `englishMessages`, `messageKeys` | the English catalog and its key list |

Types: `LocaleCatalog`, `Message`, `MessageCatalog`, `MessageKey`, `PluralMessage`,
`TextDirection`, `TranslateFn`, `TranslateValues`, `Translator`, `TranslatorOptions`.

## Exports added to `apsw-gridwright/react`

| Name | Signature |
| :--- | :--- |
| `useTranslator` | `(props: GridwrightI18nProps) => Translator` |
| `labelsFrom` | `(translator: Translator) => GridwrightLabels` |

Type: `GridwrightI18nProps`.

## Exports changed

| Name | Change | Impact |
| :--- | :--- | :--- |
| `mergeLabels` | now `(translator, overrides?)` rather than `(overrides?)` | **breaking for direct callers** |
| `GridwrightProviderProps` | gains the i18n props | additive |
| `GridwrightContextValue` | gains `translator` | additive |
| `GridwrightProps` | gains `locale`, `messages`, `translate` | additive |

`mergeLabels` is the one signature that changed. It was exported in 0.1.0, which was never
published, so nothing in the wild calls it. Recorded here rather than waved away, because the
next such change will not have that excuse.

## Defaults introduced

| Option | Default | Consequence |
| :--- | :--- | :--- |
| `locale` | `'en'` | English text, English grouping, `ltr` |
| fallback for a missing key | English | never the key itself |
| `dir` on the root | unset for `ltr` | a grid in an RTL page inherits rather than resets |

## Verification

- [x] Every type in a new signature is exported
- [x] All three entry points resolve types for `import` and `require`
- [x] `npm run check:exports` passes, including the new locales entry
- [x] The core bundle still contains no `react` import
- [x] `dependencies` is still empty

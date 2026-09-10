# Research: Message catalog and translation

## Options considered

### Option A — Keep `labels`, add more functions

**How it works.** `selectedCount` gains a plural-category argument.

**Rejected because** it makes the consumer implement plural selection. The whole difficulty is
knowing that Polish has four categories and which one 22 falls into, and that knowledge belongs
with `Intl.PluralRules`, not with every consumer.

### Option B — Full ICU MessageFormat

**How it works.** Messages are ICU strings: `{count, plural, one {# row} other {# rows}}`.

**Rejected because** it needs a parser. `intl-messageformat` is roughly 10 kB and would be this
package's first runtime dependency, for seventeen strings none of which needs nested selects. A
consumer who does want full ICU already has it, and the `translate` prop hands the whole job over.

### Option C — Flat catalog, `{placeholder}` interpolation, CLDR categories as an object

**How it works.** What shipped.

**Chosen because** it is the intersection of what translation tooling already consumes and what
the platform already provides. Keys are flat because that is what i18next, FormatJS, Lingui,
Weblate and Crowdin read. Plurals are an object keyed by category because `Intl.PluralRules`
returns exactly those strings. Nothing needs parsing, so nothing needs a dependency.

The cost is that a message cannot select on anything but a count. No message in the grid does.

## Prior art

- **react-i18next** is the format most teams already have. Delegating to it entirely, rather than
  competing, is the `translate` prop, which is why that prop takes the exact signature it does.
- **MUI X DataGrid** ships `localeText` objects per locale, structurally close to this, but with
  plural handling written per language inside each pack. Putting it in `Intl.PluralRules` instead
  means a new locale is data rather than code.
- **AG Grid** uses a flat key map with no plural support and documents the workaround. That is the
  gap this deliberately does not reproduce.

## Decisions worth recording

- **`zero` beats the category.** English has no `zero` plural category, so "None selected" could
  not otherwise be written. ICU allows exact matches to win over keywords, so this follows a
  precedent rather than inventing one. It does mean an Arabic `zero` category is shadowed by the
  exact-zero form, which is the same string in practice.
- **Fallback is English, not the key.** One English word among translated text is cosmetic.
  `pagination.rowsPerPage` in the footer is a support ticket.
- **Direction asks the platform first.** `Intl.Locale.prototype.textInfo` has the CLDR data. The
  hardcoded language list is a fallback for runtimes without it, not the primary source.
- **Locales are a third entry point.** Measured: the core ESM bundle is unchanged at roughly 40 kB
  and the locales chunk is roughly 4 kB, so an English-only consumer imports none of it.

## Measurements

Unminified ESM output, as built.

| Bundle | 0.1.0 | 0.2.0 |
| :--- | ---: | ---: |
| `dist/index.js` + shared chunk | 39.9 kB | 43.5 kB |
| `dist/locales/index.js` | — | 4.3 kB |
| `dist/react/index.js` | 18.7 kB | 20.7 kB |

The core grew by 3.6 kB, which is the translator. It is unconditional because `defaultLabels` is
derived from it, so it cannot be tree-shaken away by an English-only consumer. The five catalogs
are outside it and cost nothing unless imported.

The React entry grew by 2 kB: the i18n prop handling and `useTranslator`.

## Open questions

- Whether `pagination.range` should also carry a plural form on `{total}`. No language in the
  bundled set needs it for this sentence, and adding a plural to a message with three placeholders
  makes it harder to translate, not easier.
- Whether to ship an RTL catalog. The mechanism is tested without one; a translation nobody has
  reviewed is worse than none.

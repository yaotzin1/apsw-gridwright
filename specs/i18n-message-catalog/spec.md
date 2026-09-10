# Specification: Message catalog and translation

> **Status**: Implemented
> **Stage entry**: 1
> **Semver impact**: minor (0.2.0). Additive; `labels` keeps working.

---

## 1. The consumer problem

The grid renders seventeen strings. In 0.1.0 they lived in a `labels` object of strings and
functions. That is enough to change wording and not enough to translate a product:

- **No plural forms.** `selectedCount: (count) => \`${count} selected\`` is a template an English
  speaker writes and no Slavic language can express. Polish needs four forms, Arabic six.
- **Nothing a translator can open.** A translator receives `.json` or `.po`, not a TypeScript
  object containing arrow functions.
- **No connection to an existing i18n setup.** An application already running i18next has to
  hand-build the labels object and keep it in sync by hand.
- **Numbers formatted for the author's locale.** A total rendered as `12,345` is wrong in every
  language that groups with a period.
- **No direction.** Nothing set `dir`, so an Arabic page got a left-to-right grid.

## 2. User stories

- **US-01.** As a developer shipping in Polish, I pass one prop and the grid speaks Polish,
  including counting correctly at 1, 3 and 12.
- **US-02.** As a developer already using react-i18next, I pass the `t` I already have.
- **US-03.** As a translator, I receive a flat key-value file in a format my tooling reads.
- **US-04.** As a developer, a catalog that has fallen behind the key set fails my test suite
  rather than showing English in production.
- **US-05.** As a developer shipping in Arabic, the grid lays out right to left.
- **US-06.** As a developer with one wording change, I do not have to ship a catalog for it.
- **US-07.** As a developer bundling for the browser, I pay only for the locales I import.

## 3. Acceptance criteria

- [x] AC-01 A catalog passed as `locale` translates text, plurals, numbers and direction together.
- [x] AC-02 Plural categories come from `Intl.PluralRules`; no plural table ships.
- [x] AC-03 `zero` is an exact match on zero and wins over the category, as in ICU.
- [x] AC-04 A numeric placeholder is formatted with `Intl.NumberFormat` for the locale.
- [x] AC-05 A missing key falls back to English, never to the key.
- [x] AC-06 An external `translate` that echoes the key back is treated as untranslated.
- [x] AC-07 `auditCatalog` reports missing and unknown keys.
- [x] AC-08 An RTL locale sets `dir` on the root; an LTR locale leaves it unset.
- [x] AC-09 `labels` still works and is applied above the catalog.
- [x] AC-10 Locales resolve through their own entry point and are absent from the core bundle.
- [x] AC-11 The translator has no React dependency.

## 4. Non-goals

- **No message parser.** Placeholders are `{name}` and plurals are an object. Full ICU
  MessageFormat, with nested selects and inline plural syntax, is a parser and a dependency, and a
  grid has seventeen strings.
- **No locale negotiation.** The package does not read `navigator.language` or match tags against
  available catalogs. The application knows its own locale, and guessing is how a Canadian user
  ends up reading French they did not ask for.
- **No date or currency helpers.** Column values are formatted by the column, through
  `formatValue`, with `Intl` the consumer already has.
- **No lazy loading.** Catalogs are plain objects; dynamic import is the consumer's to arrange.
- **No RTL catalog.** The mechanism ships and is tested; a translation nobody has reviewed does
  not.

## 5. Behaviour across the capability seam

Not applicable. Translation is presentation and touches no data source.

## 6. Accessibility and interface copy

Every accessible name is a message key, not only the visible text. The row and select-all checkbox
labels, the search field name and the page button labels all translate, which is what makes the
grid usable by a screen reader in the reader's own language.

`lang` is set on the root so a screen reader switches voice.

## 7. Clarifications

- **One prop or two for locale?** One. `locale` takes either a tag or a catalog. Asking for both
  the pack and its own tag is asking twice for the same thing.
- **Does a bare tag translate?** No. It sets plural rules, number formatting and direction while
  the text stays English. Right for `en-GB`, wrong for `pl`, and documented as such.
- **Is `labels` deprecated?** No. It is the escape hatch above the catalog for a single string or
  a label needing logic a message cannot express.
- **What happens to an unknown key from an external library?** Every major library echoes the key
  back when it has no entry. That is treated as untranslated and falls through, because a dotted
  identifier in the footer is worse than an English word.
- **Where do locales live?** Their own entry point. Folding them into the core would put five
  translations in every bundle that uses the grid in English.

# Self-review: Message catalog and translation

## 1. Boundary and layering

The translator is in `src/core`-adjacent `src/i18n`, uses only `Intl`, and references no DOM global
and no React import. Writing this review surfaced that the lint boundary rules covered `src/core`,
`src/data` and `src/plugins` but not `src/i18n` or `src/locales`, so the property held by accident
rather than by enforcement. Both directories are now in the rule's `files` list.

Layering holds: locales depend on the contract, the translator on the contract, the adapter on the
translator. Nothing points back up.

## 2. The local/remote seam

Untouched, and `events.md` says so explicitly. No stage, no query field, no state field. The engine
does not know the grid has been translated, which is the correct outcome for a presentation change
and was worth confirming rather than assuming.

## 3. Public surface and semver

Classified minor and recorded in full. One signature changed, `mergeLabels(translator, overrides)`,
which is breaking for a direct caller; 0.1.0 was never published so nothing in the wild calls it,
and it is written down rather than waved away.

A third entry point resolves types for both module systems. Every new type in a signature is
exported. The packaging audit covers the new entry.

## 4. Accessibility and i18n

Every accessible name is a message key, not only the visible text: the row and select-all
checkboxes, the search field, both page buttons. A test asserts the German accessible names
specifically, because translating visible text and leaving `aria-label` in English is the common
half-done version of this work.

`lang` is set so a screen reader switches voice. `dir` is set only for right-to-left, so a grid
inside an already-RTL page inherits rather than resets.

## 5. Supply chain and packaging

No dependency added. Plural rules, number formatting and direction all come from `Intl`, which is
the reason Option B was rejected: it would have been this package's first runtime dependency, for
seventeen strings.

The five catalogs are in their own entry, so an English-only consumer does not carry them.

## 6. Honest output

A missing key renders English, never a dotted identifier. An external library that echoes an
unknown key back is treated as untranslated rather than as a translation. A placeholder with no
value stays visible instead of printing `undefined`. An unparseable locale tag degrades rather than
throwing.

No invented plural rules: the categories come from the platform, so a language this package has
never heard of counts correctly the moment someone writes a catalog for it.

## 7. Verification

```
Test Files  13 passed (13)
     Tests  194 passed (194)

Test Files   1 passed (1)      [smoke, against dist/]
     Tests   9 passed (9)

typecheck      exit 0
lint           exit 0
check-exports  the published package resolves cleanly.
```

## Known gaps

- **No RTL catalog ships.** Direction resolution is tested with `ar`, `he`, `fa` and `ur`, and the
  layout uses logical properties, but no right-to-left translation has been reviewed. Shipping an
  unreviewed one would be worse than shipping none.
- **Translations beyond English are unreviewed by native speakers.** They are careful but they are
  mine. The completeness test proves every key exists, not that every string is idiomatic.
- **No locale negotiation.** Deliberate, and named as a non-goal, but it does mean every consumer
  writes the same three lines to map their application locale onto a catalog.

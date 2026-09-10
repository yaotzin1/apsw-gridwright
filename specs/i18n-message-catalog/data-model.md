# Data model: Message catalog and translation

## Types added

```ts
type MessageKey =
    | 'search.placeholder' | 'search.label'
    | 'status.loading' | 'status.empty'
    | 'error.title' | 'error.retry'
    | 'selection.row' | 'selection.all' | 'selection.count'
    | 'sort.ascending' | 'sort.descending' | 'sort.clear'
    | 'pagination.previous' | 'pagination.next' | 'pagination.rowsPerPage'
    | 'pagination.range' | 'pagination.rangeUnknown';

interface PluralMessage {
    zero?: string; one?: string; two?: string; few?: string; many?: string;
    other: string;                      // required: the only category every language has
}

type Message = string | PluralMessage;
type MessageCatalog = { readonly [K in MessageKey]: Message };

interface LocaleCatalog {
    locale: string;                     // BCP 47
    direction?: 'ltr' | 'rtl';          // overrides what the tag implies
    messages: MessageCatalog;
}

interface Translator {
    locale: string;
    direction: 'ltr' | 'rtl';
    t: (key: MessageKey, values?: Record<string, string | number>) => string;
    formatNumber: (value: number) => string;
}
```

## Placeholders per key

| Key | Placeholders | Plural |
| :--- | :--- | :--- |
| `selection.count` | `{count}` | yes |
| `pagination.range` | `{from}` `{to}` `{total}` | no |
| `pagination.rangeUnknown` | `{from}` `{to}` | no |
| everything else | none | no |

A numeric placeholder is formatted with `Intl.NumberFormat` for the resolved locale. A placeholder
with no value is left in the output rather than replaced with an empty string, so it is visible in
review.

## State shape

Unchanged. No field was added to `GridState` or `GridQuery`: the engine does not know the grid has
been translated.

## React props added

| Prop | Type | Default |
| :--- | :--- | :--- |
| `locale` | `string \| LocaleCatalog` | `'en'` |
| `messages` | `Partial<MessageCatalog>` | none |
| `translate` | `(key, values) => string` | none |
| `labels` | `Partial<GridwrightLabels>` | unchanged from 0.1.0 |

## Serialisation

A catalog is a plain object of strings and small objects, so it round-trips through JSON. That is
deliberate: it is what lets a catalog live in a `.json` file a translation platform writes.

# Lifecycle contract: report templates and custom formats

> **Immutable during stage 6.**

## Events added

None. A custom format is a serializer, and serializers publish nothing on the engine's bus. A
format that wants to report progress does so through its own code.

| Event | Payload | Emitted when |
| :--- | :--- | :--- |
| — | — | — |

## Events changed

| Event | Before | After |
| :--- | :--- | :--- |
| — | — | — |

## Ordering guarantees

- A serializer is chosen in one order and it is worth stating: an entry in `serializers` by id
  first, then the `serialize` of a custom format, then the built-in writer. A format that matches
  none of the three throws before any rows are serialized.
- A custom serializer receives the rows a scope already resolved, so `scope: 'all'` against a
  paginating source has already refused before the serializer would have run.
- The announcement names the format before the serializer runs and again when it resolves, using
  the format's `name`, or its label, or its id.

## Pipeline stages added

| Stage id | Order | Capability | Changes the total |
| :--- | ---: | :--- | :--- |
| — | — | — | — |

## Teardown

`printMarkdownDocument` returns the same remover `printHtmlDocument` does: the frame goes when the
dialog returns, and on unmount if it did not.

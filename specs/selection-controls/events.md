# Lifecycle contract: selection controls

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it.

## Events added

None. A row click or `Space` calls `api.toggleRowSelection`, which publishes the selection through the
existing state change, exactly as the checkbox does.

## Events changed

None.

## Ordering guarantees

On a row click, the grid's own `onRowClick` runs before the selection toggles (the shell's handler is
merged first). A consumer who reads the selection inside `onRowClick` therefore sees it as it was
before the click.

## Pipeline stages added

None.

## Teardown

The handlers are React props on rendered elements; nothing is subscribed.

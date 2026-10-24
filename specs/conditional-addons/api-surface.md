# API surface contract: Conditional add-ons

## Semver classification

**minor.** The accepted input widens; nothing a consumer has changes.

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `AddonEntry` | `apsw-gridwright/react` | `type AddonEntry<TRow = unknown> = GridAddon<TRow> \| false \| null \| undefined` |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |
| `UseGridwrightOptions.addons` | `readonly GridAddon<TRow>[]` | `readonly AddonEntry<TRow>[]` | widens input; a `GridAddon[]` still type-checks |
| `UseGridwrightOptions.coreAddons` | `readonly GridAddon<TRow>[] \| false` | `readonly AddonEntry<TRow>[] \| false` | as above |
| `orderAddons` | takes `GridAddon[]` | takes `AddonEntry[]`, returns `GridAddon[]` | widens input only |

## Removed or deprecated

None.

## Defaults changed

None.

# API surface contract: <feature name>

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**patch | minor | major**

Reasoning:

## Exports added

| Name | Entry | Signature |
| :--- | :--- | :--- |

## Exports changed

| Name | Before | After | Impact |
| :--- | :--- | :--- | :--- |

## Exports removed or deprecated

| Name | Replacement | Removed in |
| :--- | :--- | :--- |

## Defaults introduced or changed

<!-- A changed default breaks consumers without breaking their build. List every one. -->

| Option | Old default | New default |
| :--- | :--- | :--- |

## Type entry points

- [ ] Every type appearing in a new signature is itself exported
- [ ] Both `import` and `require` conditions still resolve types
- [ ] `npm run check:exports` passes

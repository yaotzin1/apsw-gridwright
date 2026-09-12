# Lifecycle contract: <feature name>

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces.

## Events added

| Event | Payload | Emitted when |
| :--- | :--- | :--- |

## Events changed

<!-- Changing a payload is a major version: consumers destructure these. -->

| Event | Before | After |
| :--- | :--- | :--- |

## Ordering guarantees

<!-- What is guaranteed to have happened by the time a listener runs. State it, because consumers
     will depend on it whether or not it is written down. -->

## Pipeline stages added

| Stage id | Order | Capability | Changes the total |
| :--- | ---: | :--- | :--- |

## Teardown

<!-- What each new listener, timer or subscription releases, and when. -->

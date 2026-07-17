# window.codex Protocol 0.1

## Provider discovery

A conforming browser host exposes a `CodexProvider` as `window.codex` in the top-level document and dispatches `codex#initialized` after installation. The provider surface is defined by `@window-codex/sdk`; consumers must feature-detect methods with `capabilities.list`.

The page-facing contract is independent from Codex app-server. A provider must reject internal or unknown methods and must never expose runtime transports, credentials, identifiers, filesystem paths, or unfiltered events.

## Requests

`request({ method, params }, { signal? })` resolves with the typed result or rejects with a stable `CodexError`. Aborting a pending browser request produces `USER_CANCELLED`. Task cancellation uses `tasks.cancel`.

The stable methods are:

- Provider: `provider.info`, `capabilities.list`
- Connection: `connect`, `disconnect`
- Grants: `permissions.get`, `permissions.request`, `permissions.revoke`
- Workspace: `workspace.select`
- History: `threads.list`, `threads.analyze`
- Tasks: `tasks.start`, `tasks.get`, `tasks.send`, `tasks.cancel`

## Resource handles

Thread, workspace, grant, and task identifiers are opaque. Thread and workspace handles are derived or stored per exact origin and cannot be used by another origin. Task lookup and control are restricted to the origin that created the task.

## Grants

Persistent grants may authorize metadata and event subscription. `threads.analyze` requires an explicit one-action disclosure for an exact thread selection. Workspace selection, task creation, and task follow-ups require trusted extension confirmation.

An exact origin is the URL tuple of scheme, host, and port derived from Chrome sender metadata. The provider ignores any origin value supplied by a webpage.

## Analysis

Protocol 0.1 supports only `reflection.v1`, with one to ten selected threads. It returns coverage, activity, themes, friction, and suggested prompts. It must not return transcript excerpts. Providers may truncate input but must report truncation in `coverage`.

## Task events

Pages may receive agent-message deltas and high-level status only. Each `task.event` includes a monotonically increasing sequence number. Runtime approvals, commands, diffs, paths, reasoning, and user-input requests remain within trusted extension UI.

## Stable errors

`PROVIDER_UNAVAILABLE`, `UNSUPPORTED_METHOD`, `UNSUPPORTED_VERSION`, `PERMISSION_REQUIRED`, `PERMISSION_DENIED`, `GRANT_REVOKED`, `INVALID_SELECTOR`, `USER_CANCELLED`, `TASK_NOT_FOUND`, `RUNTIME_UNAVAILABLE`, and `RUNTIME_ERROR`.

Unknown app-server errors are normalized to `RUNTIME_ERROR`; transport loss is `RUNTIME_UNAVAILABLE` with `data.retryable: true`.

# Reflex reference consumer

Reflex proves that useful history analysis does not require giving a webpage raw Codex transcripts.

## Flow

1. Connect with `threads:metadata` and `events:subscribe`.
2. Render activity and safe thread metadata.
3. Select one to ten opaque thread handles.
4. Request a one-action `reflection.v1` analysis.
5. Render coverage, themes, friction, and suggested prompts.
6. Choose a suggestion and an opaque workspace handle.
7. Submit the exact prompt to `tasks.start`.
8. Let window.codex show the trusted confirmation and any later runtime approvals.
9. Render only sanitized task messages and status.

Reflex imports only `@window-codex/sdk`. It contains no native-host or app-server knowledge and therefore doubles as a conformance example.

## Demo script

- Open Reflex and connect.
- Point out the exact-origin request in the extension side panel.
- Select several recent Codex threads.
- Approve a one-time analysis and show that the result contains findings rather than quotes.
- Choose the highest-value suggestion, select a workspace, and review the exact prompt in the side panel.
- Start the Codex task and show sanitized live progress in Reflex.

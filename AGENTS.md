# AGENTS.md

This repository contains a VS Code extension named **Security Notes**. It uses the VS Code Comments API to create inline security review notes, track statuses, import SAST findings, and manage breadcrumb trails.

## Quick architecture map

- Entry point: `src/extension.ts`
- Comment controller: `src/controllers/comments.ts`
- Core note logic: `src/helpers.ts`
- Note model: `src/models/noteComment.ts`
- Local persistence:
  - Notes: `src/persistence/local-db/index.ts`
  - Breadcrumbs: `src/persistence/local-db/breadcrumbs.ts`
  - Serialization: `src/persistence/serialization/*`
- Collaboration (RethinkDB): `src/persistence/remote-db/index.ts`
- SAST import UI + parsing:
  - Webview provider: `src/webviews/import-tool-results/importToolResultsWebview.ts`
  - Parsers: `src/parsers/*.ts`
- Breadcrumb domain:
  - State store: `src/breadcrumbs/store.ts`
  - Commands: `src/breadcrumbs/commands.ts`
  - Export/format helpers: `src/breadcrumbs/export.ts`, `src/breadcrumbs/format.ts`
  - Webview: `src/webviews/breadcrumbs/*`

## Runtime behavior (important)

- Activation event is `onStartupFinished` (`package.json`).
- Notes are keyed in memory by `thread.contextValue` (UUID for new note threads).
- First comment in a thread is treated as the main finding; status changes rewrite that first comment body to prefix `[TODO]`, `[Vulnerable]`, or `[Not Vulnerable]`.
- Every note mutation persists to local JSON via `saveNotesToFile`.
- If collaboration is enabled, writes are also pushed to RethinkDB and remote changes are subscribed to in real time.
- Paths are serialized as workspace-relative (with Windows path normalization handling in serializer/deserializer).

## Common change points

- Add/update note commands: `src/extension.ts` + helpers in `src/helpers.ts`.
- Change note serialization format: update both `serializer.ts` and `deserializer.ts` together.
- Add new SAST importer: add parser in `src/parsers/`, then wire it in `importToolResultsWebview.ts`.
- Change breadcrumb behavior: start with `src/breadcrumbs/store.ts` and `src/breadcrumbs/commands.ts`.

## Development workflow

- Install: `npm install`
- Compile once: `npm run compile`
- Watch mode for extension debugging: `npm run watch`
- Lint: `npm run lint`
- Run extension: use VS Code “Run Extension” launch config.

## Guardrails for contributors/agents

- Keep note identity stable: do not drop or repurpose `thread.contextValue`.
- Preserve local file compatibility unless intentionally migrating persisted formats.
- If changing thread/comment merge logic (`mergeThread` / remote sync), verify ordering and duplicate detection by timestamp.
- Keep path conversion behavior cross-platform (`isWindows`, `pathToPosix`, `pathToWin32`).
- Prefer minimal, targeted changes in existing modules over broad rewrites.

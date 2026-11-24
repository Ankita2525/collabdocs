# Architecture

> **Status: skeleton (M0).** Filled in as milestones complete. Only describes what is actually built.

## Overview
_TODO_

## Data model (implemented in `db/schema.sql`)
- `users(id, email unique, name)`
- `sessions(token pk, user_id, expires_at)`: server-side sessions; the cookie holds only the random token.
- `documents(id, owner_id, title 1–200 chars, content jsonb, version int, created_at, updated_at)`
- `document_shares(document_id, user_id, role viewer|editor)`, primary key `(document_id, user_id)`, cascades on document delete.
- Row-level security is enabled on all tables with no policies, so the public Supabase REST API cannot read them. The app uses a server-side connection string, which bypasses RLS.

## Editor and content
- Tiptap (ProseMirror) editor; supported formatting: bold, italic, underline, headings 1–3, bulleted and numbered lists, hard breaks, undo/redo. Content is stored as Tiptap JSON in `documents.content` (jsonb), never as HTML.
- `src/lib/editor-extensions.ts` is the single list of allowed nodes/marks, used by the browser editor and by the server validator, so they cannot drift apart.
- **Server-side validation** (`src/lib/content.ts`): envelope check, 1 MB cap, then `getSchema(extensions).nodeFromJSON(json).check()` (ProseMirror, Node, no DOM) which rejects unknown node/mark types, bad nesting and empty text nodes; then explicit attribute checks (heading level 1–3, ordered-list `start`/`type`) because the ProseMirror schema does not validate attribute values. The normalized document (unknown attributes dropped) is what gets stored.

## Saving and conflict detection
- `PATCH /api/documents/:id` is either a rename (`{title}`, owner only) or a content save (`{content, baseVersion}`, owner or editor). Permission is decided by which field is sent, before the body is validated.
- **Atomic optimistic concurrency:** `UPDATE documents SET content=…, version=version+1 WHERE id=… AND version=$baseVersion RETURNING …`. No row returned means 404 (document gone) or 409 (someone saved first). There is no read-then-write window.
- The client keeps the last known `version`, sends it with every save, and adopts the version returned. Explicit Save button (also Ctrl/Cmd+S) plus autosave 1.5 s after the last edit; one request in flight at a time, with edits made during a save triggering a follow-up save. States: Saved / Unsaved changes / Saving… / Save failed (Retry) / Conflict. On conflict autosave stops, the user is told their latest edits were not saved, and can copy their text and reload.
- No network request is made on page unload. When there are unsaved changes the browser's leave-page prompt is shown (and a confirm on the in-app Back link).

## Database access
`src/lib/db.ts` uses the Supabase **transaction-mode pooler** (port 6543). Required settings: `prepare:false` and **`max_pipeline:1`**. Without the latter, concurrent queries on a connection stall indefinitely through the pooler (reproduced; see AI_WORKFLOW.md).

## Authentication (demo only, NOT production authentication)
Login picks one of three seeded users; there are no passwords. A random 32-byte token is stored in `sessions`; the cookie (`httpOnly`, `sameSite=lax`, `secure` in production, 7-day expiry) carries it. Every API call resolves the user from the session row. Real authentication would replace only `src/lib/session.ts` and the login route.

## Access rules
`src/lib/access.ts` is the only place permissions are decided: `getAccess(ownerId, userId, shareRole)` returns `owner | editor | viewer | null`, and `can(access, action)` maps that to read / editContent / rename / delete / share. Unit-tested in `src/lib/access.test.ts`. Every document route goes through `loadDocumentFor` (`src/lib/documents.ts`): load the document with the caller's share role, compute access, check the action. A malformed id or no access gives 404 (existence is not leaked); a visible document with insufficient rights gives 403. Rename and delete are owner-only.

## Trade-offs and limitations
- Demo authentication only; no passwords.
- Concurrent editing is not merged: last saver wins only if they edited the latest version; otherwise they get a conflict and must reload (their text can be copied first). No real-time collaboration.
- The access check and the versioned UPDATE are separate statements; a share revoked in the few milliseconds between them would not stop that one write. Acceptable for this scope.
- API-level tests use an in-memory data layer, so they do not exercise real SQL. The atomic version guard was verified separately against the real database (see AI_WORKFLOW.md).
- The editor UI itself has no automated browser test.

## Future improvements
_TODO_

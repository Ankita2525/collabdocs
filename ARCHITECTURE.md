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
- **Server-side validation** (`src/lib/content.ts`): envelope check, 2 MB cap, then `getSchema(extensions).nodeFromJSON(json).check()` (ProseMirror, Node, no DOM) which rejects unknown node/mark types, bad nesting and empty text nodes; then explicit attribute checks (heading level 1–3, ordered-list `start`/`type`) because the ProseMirror schema does not validate attribute values. The normalized document (unknown attributes dropped) is what gets stored.

## Saving and conflict detection
- `PATCH /api/documents/:id` is either a rename (`{title}`, owner only) or a content save (`{content, baseVersion}`, owner or editor). Permission is decided by which field is sent, before the body is validated.
- **Atomic optimistic concurrency:** `UPDATE documents SET content=…, version=version+1 WHERE id=… AND version=$baseVersion RETURNING …`. No row returned means 404 (document gone) or 409 (someone saved first). There is no read-then-write window.
- The client keeps the last known `version`, sends it with every save, and adopts the version returned. Explicit Save button (also Ctrl/Cmd+S) plus autosave 1.5 s after the last edit; one request in flight at a time, with edits made during a save triggering a follow-up save. States: Saved / Unsaved changes / Saving… / Save failed (Retry) / Conflict. On conflict autosave stops, the user is told their latest edits were not saved, and can copy their text and reload.
- **Lost-response recovery:** a 409 can be the client's own earlier save whose response never arrived. On 409 the client fetches the document; if the stored content equals (key-order-insensitive) what it just sent, it adopts the server version instead of showing a false conflict.
- No network request is made on page unload. When there are unsaved changes the browser's leave-page prompt is shown (and a confirm on the in-app Back link).

## Database access
`src/lib/db.ts` uses the Supabase **transaction-mode pooler** (port 6543). Required settings: `prepare:false` and **`max_pipeline:1`**. Without the latter, concurrent queries on a connection stall indefinitely through the pooler (reproduced; see AI_WORKFLOW.md).

## Import
`POST /api/documents/import` (multipart field `file`) → `prepareImport` in `src/lib/import-text.ts`: extension must be `.txt`, MIME type must be empty, `text/plain` or `application/octet-stream`, size 1..1,000,000 bytes (also rejected early from `Content-Length`), strict UTF-8 decode (NUL bytes or invalid UTF-8 → rejected as binary/non-UTF-8), non-blank content. `parsePlainText` builds the Tiptap document (blank line = new paragraph, single newline = `hardBreak`, CRLF/CR normalised, BOM and control characters removed). The result goes through the same `validateContent` as editor saves, then `createDocument(session user, title, content)`: the owner is always the session user and the title comes from the filename (basename only, extension stripped, whitespace collapsed, max 200 chars, fallback "Imported document"). Limits live in `src/lib/import-limits.ts` so the browser bundle does not pull in server code. The editor document cap was raised to 2 MB so that any valid 1 MB import fits.
The client (`src/components/import-text.tsx`) pre-checks extension/size/empty for instant feedback, uploads with `XMLHttpRequest` to show real progress (fetch cannot), and navigates to the new document on success.

## Export (Markdown and Print / Save as PDF)
Export is entirely client-side. It uses the content the page has already been authorised to load, so there is **no new endpoint, no public access path and no change to authorisation**; viewers, editors and owners can export because they can read. The menu is disabled when the editor has detected revoked access (`lostAccess === "revoked"`); a downgrade to viewer keeps read access, so export stays available.
- **Markdown** (`src/lib/markdown.ts`, pure functions): `docToMarkdown(editor.getJSON())` serialises the *current* editor state (including unsaved edits) and the browser downloads it as a Blob (`text/markdown;charset=utf-8`) named by `markdownFilename(title)`, which strips path separators/reserved characters, control, bidirectional and zero-width characters (they can disguise an extension), leading dots/dashes, trailing dots/spaces and Windows device names, caps length at 100 characters, keeps Unicode and always ends in `.md`.
- Decisions: underline is inline HTML `<u>`; a hard break is a trailing backslash; leading whitespace becomes `&nbsp;`; empty paragraphs and blank headings are dropped; the title is not added to the body; two adjacent lists of the same kind are separated by `<!-- -->`.
- Making the output *valid* needed more than escaping, because CommonMark only reads `*`/`**` as emphasis when the delimiters are "flanking" correctly. The serialiser therefore (a) writes marks as runs so adjacent nodes share delimiters and whitespace sits outside them, (b) checks each span's flanking against the characters actually around it, treating non-ASCII symbols/emoji conservatively because parsers disagree about them, and writes `<strong>`/`<em>` instead of `*` where `*` would not parse, (c) writes overlapping or nested bold/italic as HTML (only an exact `***x***` pair stays compact), (d) never lets a closing and an opening delimiter touch, (e) escapes line-start constructs (`#`, `>`, `-`, `+`, `1.`, `---`, `===`, fences) and (f) puts a blank line before a nested ordered list that does not start at 1 or whose first item is empty, since those cannot interrupt a paragraph.
- **Print / Save as PDF** calls `window.print()` with a print stylesheet (`@media print` in `globals.css` plus Tailwind `print:` variants): the header, toolbar, banners, share/export controls and toasts are hidden; the page shows a print-only title and the document with print typography, 2 cm `@page` margins, `break-after: avoid` on headings, `break-inside: avoid` on list items and orphan/widow control. `document.title` is set to the document title while printing so browsers propose it as the PDF file name. Labelled "Print / Save as PDF" because it relies on the browser's print dialog rather than generating a PDF.

## Sharing
- Owner-only management through `GET/POST /api/documents/:id/shares` and `DELETE /api/documents/:id/shares/:userId` (all use `loadDocumentFor(..., "share")`: strangers get 404, viewers/editors get 403). `POST` is an upsert, so changing a role and creating a share are the same call; it rejects sharing with yourself (400), unknown users (404) and invalid roles (400).
- Share targets are the seeded demo users, chosen from a list in the share dialog (owner, and users who already have access, are excluded from the add list; roles of existing entries are changed inline).
- The dashboard shows an **Owner** badge plus "Shared with N" on owned documents, and a "Shared · Can edit / View only" badge with "Shared by <owner>" on shared ones.
- **Access is re-checked on every request**, so revoking or downgrading takes effect immediately even for an editor that is already open: the next save returns 403 (downgraded) or 404 (revoked) and the content is not written. The open editor reacts by turning read-only, stopping autosave and showing a banner with "Copy my text"; non-owners also re-check access when the tab regains focus (at most every 5 s) so they see it without typing. A viewer who is promoted needs to reload to get the editor.
- Deleting a document cascades to its shares.

## Interface
Restrained identity: an indigo primary on cool neutrals (tokens in `src/app/globals.css`), one logo mark, deterministic initials avatars (`avatar.tsx`, white text on -700 shades for contrast), and a single `RoleBadge` (Owner / Can edit / View only) used on the dashboard, in the editor header and in the share dialog. Dashboard rows are whole-row links with the actions menu layered above; empty states explain what to do next. The editor header wraps on narrow screens, the save status is a pill (Saved / Unsaved changes / Saving… / Save failed + Retry / Conflict / Access changed), and `prefers-reduced-motion` is respected. No new dependencies were added.

## Authentication (demo only, NOT production authentication)
Login picks one of three seeded users; there are no passwords. A random 32-byte token is stored in `sessions`; the cookie (`httpOnly`, `sameSite=lax`, `secure` in production, 7-day expiry) carries it. Every API call resolves the user from the session row. Real authentication would replace only `src/lib/session.ts` and the login route.

## Access rules
`src/lib/access.ts` is the only place permissions are decided: `getAccess(ownerId, userId, shareRole)` returns `owner | editor | viewer | null`, and `can(access, action)` maps that to read / editContent / rename / delete / share. Unit-tested in `src/lib/access.test.ts`. Every document route goes through `loadDocumentFor` (`src/lib/documents.ts`): load the document with the caller's share role, compute access, check the action. A malformed id or no access gives 404 (existence is not leaked); a visible document with insufficient rights gives 403. Rename and delete are owner-only.

## Trade-offs and limitations
- Demo authentication only; no passwords.
- Concurrent editing is not merged: last saver wins only if they edited the latest version; otherwise they get a conflict and must reload (their text can be copied first). No real-time collaboration.
- The access check and the versioned UPDATE are separate statements; a share revoked in the few milliseconds between them would not stop that one write. Acceptable for this scope.
- API-level tests use an in-memory data layer, so they do not exercise real SQL. The atomic version guard was verified separately against the real database (see AI_WORKFLOW.md).
- Export has no automated browser test: the Markdown download, the file name in the browser and the print preview/page breaks are verified only by hand; the serialiser itself is unit-tested and was additionally checked against a CommonMark reference parser during development (see AI_WORKFLOW.md; that check is not part of the repo because it needs an extra dependency).
- The editor UI itself has no automated browser test, and the lost-response recovery in the client is not covered by an automated test (only its comparison helper is).

## Future improvements
_TODO_

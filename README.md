# CollabDocs

A lightweight collaborative document editor inspired by Google Docs. Built as a time-boxed assessment.

**Live demo:** https://collabdocs-blue.vercel.app (demo authentication: pick a seeded user; no passwords).

> **Status:** feature-complete and frozen: create/rename/edit/save/reopen, rich text, `.txt` import, owner/shared documents with viewer/editor roles, validation and server-side authorization, automated tests, public deployment, and document export (Markdown, Print / Save as PDF). The walkthrough video URL is in `WALKTHROUGH.txt` once recorded. What has and has not been verified, and by whom, is listed in `SUBMISSION.md` and `AI_WORKFLOW.md`.

## Stack
Next.js (App Router, TypeScript), Tailwind CSS + shadcn/ui, Tiptap, Next.js Route Handlers, Supabase PostgreSQL (via the `postgres` driver), Zod, Vitest, Vercel.

## Local setup
1. `npm install`
2. Create a free Supabase project. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to the **pooled** connection string (Project Settings → Database → Connection pooling, port 6543). Use the plain password in the URL (URL-encode special characters; no `[brackets]`, no line breaks). Keep it server-side; never commit it.
3. Create the tables and demo users: `node --env-file=.env.local scripts/apply-sql.mjs db/schema.sql db/seed.sql` (or paste both files into the Supabase SQL editor). Both are idempotent.
4. `npm run dev` and open http://localhost:3000

## Importing a file
On the dashboard, **Import .txt** creates a new document from a plain-text file.
- **Supported:** `.txt` files only, UTF-8 encoded, **up to 1 MB** (1,000,000 bytes). Other types (PDF, DOCX, Markdown, …), empty or whitespace-only files, binary data and non-UTF-8 text are rejected with a clear message.
- **Conversion:** a blank line starts a new paragraph; a single line break inside a paragraph is kept as a line break; Unicode (accents, CJK, emoji, RTL) is preserved; leading indentation is kept. Markup such as HTML or Markdown is imported as literal text, not interpreted.
- **Result:** a new document owned by the signed-in user, titled from the filename without `.txt` (e.g. `Trip notes.txt` becomes "Trip notes"), opened in the editor. A progress bar is shown while uploading.
- A 1 MB file made of a very large number of short lines can expand beyond the 2 MB document limit and is then rejected as having too many lines.

## Exporting a document
The editor header has an **Export** menu (available to owners, editors and viewers, since all of them can read the document). It is disabled if the editor detects that your access was removed.
- **Download Markdown (.md)** saves the document as a Markdown file. It exports what is on screen, including edits that are not saved yet. Headings, paragraphs, bold, italic, bulleted and numbered lists (including nested lists) and line breaks are preserved; Unicode is kept and Markdown special characters are escaped so text stays literal. The file name is derived from the title with unsafe characters removed (for example `My plan.md`).
  - **Underline** has no Markdown syntax, so it is written as inline HTML `<u>…</u>` (most Markdown viewers render it).
  - A line break is written as a backslash at the end of the line (CommonMark). Leading indentation is written as `&nbsp;`. Empty paragraphs are dropped, and the title is used for the file name rather than added to the body.
  - Where `*` emphasis would not be valid Markdown (mid-word next to punctuation, overlapping bold and italic) the span is written as inline HTML `<strong>` / `<em>` instead.
- **Print / Save as PDF** opens the browser's native print dialog with a print stylesheet: only the title and the formatted document are printed (navigation, toolbar, buttons, banners and sharing controls are hidden), with 2 cm margins and headings kept with the text that follows them. Choose "Save as PDF" as the destination to get a PDF. **This is not a direct PDF download**: the file name, paper size and exact page breaks come from your browser's print settings.

## Known limitations
- **Demo authentication only**: a user picker with no passwords. Not suitable for production.
- **No real-time collaboration.** Two people editing the same document at once is detected, not merged: the second save is rejected with a conflict message (their text can be copied) and they reload.
- **Import size rules.** A `.txt` file may be up to 1 MB, but it is stored as a structured document with a hard limit of **2 MB after conversion**. Every line break inside a paragraph becomes a separate node, so an unusually structured file (for example about a million lines with one or two characters each) can pass the 1 MB check yet exceed 2 MB once converted. It is then rejected with "too many lines to import as one document". Ordinary text of up to 1 MB always fits. Only `.txt` is supported.
- Export is Markdown or browser print only; there is no server-generated PDF, and Markdown files cannot be re-imported (import accepts `.txt` only). Print layout and page breaks vary between browsers.
- A viewer who is promoted to editor needs to reload the page to start editing; a downgraded or revoked user is told on their next save attempt or when the tab regains focus.
- The share dialog heading shows the title the page was opened with, not a title renamed after opening.
- If a session expires (7 days) while editing, a save fails with "You must be signed in"; copy your text, sign in again and reload.

## Environment variables
| Name | Purpose |
|---|---|
| `DATABASE_URL` | Supabase pooled Postgres connection string. Server-side only. |

## Demo users
| Name | Email |
|---|---|
| Alice Johnson | alice@collabdocs.demo |
| Bob Smith | bob@collabdocs.demo |
| Carol Diaz | carol@collabdocs.demo |

Login is a user picker with no passwords. **This is demo authentication, not production authentication.**

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Start dev server |
| `npm test` | Run Vitest (unit tests + API-level authorization tests against an in-memory data layer; no database needed) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build |

## Manual test script (about 10 minutes, in a browser)
Use the live demo or `npm run dev`. Sign in by choosing a demo user.
1. **Login.** Open `/login`: the "Demo authentication — not for production" notice is shown. Sign in as **Alice**.
2. **Create and format.** Click **New document**, open it, type some text and use the toolbar (bold, italic, underline, headings, bulleted and numbered lists). The status pill goes *Unsaved changes → Saving… → Saved*. Reload the page: content and formatting are still there.
3. **Rename.** Edit the title in the editor header (Enter or click away), and use **Rename** in a document's `…` menu on the dashboard.
4. **Import.** Click **Import .txt** and choose a UTF-8 text file with a few blank-line-separated paragraphs (and some emoji). A new document titled after the file opens. Then try a `.pdf` or an empty `.txt`: a clear error is shown and nothing is created.
5. **Share.** In the editor click **Share**, add **Bob** as *Can view*. Sign out and sign in as **Bob**: the document is under **Shared with me** with a *View only* badge, the editor is read-only, and **Export** still works.
6. **Change and revoke access.** As Alice, change Bob to *Can edit*; as Bob, edit and save. As Alice, remove Bob while Bob has the document open: on Bob's next save attempt (or when his tab regains focus) a banner says the document is no longer available and the editor becomes read-only.
7. **Conflict.** Open the same document in two windows as Alice and Carol (share it with Carol as *Can edit*), edit in both: the later save shows a "changed elsewhere" banner instead of overwriting.
8. **Export.** In the editor click **Export → Download Markdown (.md)** (make an unsaved edit first: it is included) and **Export → Print / Save as PDF** (choose "Save as PDF" as the destination).

## Automated tests
`npm test` runs the whole suite (about 160 tests, no database needed): permission rules, request validation, Tiptap content validation, `.txt` conversion, Markdown serialisation, and API-level authorization tests that call the real route handlers against an in-memory data layer (viewer/editor/stranger access, revocation, stale versions, invalid content, import rejections). Also run `npm run lint`, `npm run typecheck` and `npm run build`.

# CollabDocs

A lightweight collaborative document editor inspired by Google Docs. Built as a time-boxed assessment.

> **Status: all mandatory features are implemented and verified by API; UI polish done; final walkthrough and submission files remain.** Sections marked _TODO_ are filled in as milestones are completed.

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

## Known limitations
- **Demo authentication only**: a user picker with no passwords. Not suitable for production.
- **No real-time collaboration.** Two people editing the same document at once is detected, not merged: the second save is rejected with a conflict message (their text can be copied) and they reload.
- **Import size rules.** A `.txt` file may be up to 1 MB, but it is stored as a structured document with a hard limit of **2 MB after conversion**. Every line break inside a paragraph becomes a separate node, so an unusually structured file (for example about a million lines with one or two characters each) can pass the 1 MB check yet exceed 2 MB once converted. It is then rejected with "too many lines to import as one document". Ordinary text of up to 1 MB always fits. Only `.txt` is supported.
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

## Manual test script
_TODO (V milestone)._

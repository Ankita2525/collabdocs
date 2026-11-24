# CollabDocs

A lightweight collaborative document editor inspired by Google Docs. Built as a time-boxed assessment.

> **Status: in progress (M5: all mandatory features are implemented; final verification, polish and submission files remain).** Sections marked _TODO_ are filled in as milestones are completed.

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

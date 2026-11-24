# CollabDocs

A lightweight collaborative document editor inspired by Google Docs. Built as a time-boxed assessment.

> **Status: in progress (M2: document list, create, rename, delete; editor, sharing and import are not built yet).** Sections marked _TODO_ are filled in as milestones are completed.

## Stack
Next.js (App Router, TypeScript), Tailwind CSS + shadcn/ui, Tiptap, Next.js Route Handlers, Supabase PostgreSQL (via the `postgres` driver), Zod, Vitest, Vercel.

## Local setup
1. `npm install`
2. Create a free Supabase project. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to the **pooled** connection string (Project Settings → Database → Connection pooling, port 6543). Use the plain password in the URL (URL-encode special characters; no `[brackets]`, no line breaks). Keep it server-side; never commit it.
3. Create the tables and demo users: `node --env-file=.env.local scripts/apply-sql.mjs db/schema.sql db/seed.sql` (or paste both files into the Supabase SQL editor). Both are idempotent.
4. `npm run dev` and open http://localhost:3000

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
| `npm test` | Run Vitest |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build |

## Manual test script
_TODO (V milestone)._

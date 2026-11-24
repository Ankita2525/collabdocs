# AI Workflow

Records how AI was actually used. Entries are added only for things that really happened.

## Tools used
- Claude Code (Claude Sonnet 5.5) in the Claude desktop app: planning, scaffolding, implementation, tests, documentation.

## Meaningful contributions
_TODO_

## Suggestions changed or rejected
- Plan review (before implementation): the initial plan was revised on the author's direction. Added an atomic DB-level stale-write guard, Tiptap-schema validation of stored content, API-level authorization tests, removal of any save-on-`beforeunload`, and a reserved final 40 minutes for submission.

## Verification performed
- M1: `npm test` (7 passed, `getAccess`/`can` matrix), lint, typecheck, `npm run build` all clean. Applied schema+seed to the real Supabase DB (3 users listed). Against local `next dev` with curl: `/api/health` ok; `/api/users` 3 users; `/api/me` 401 without cookie; invalid login 400; unknown user 404; login 200 with HttpOnly cookie; `/api/me` 200; `/` 200 with cookie and 307 to `/login` without; logout 200 then `/api/me` 401. Not yet verified: browser rendering of the login page, and anything on Vercel.
- M0: `npm test` (1 smoke test passed), `npm run lint` (clean), `npm run typecheck` (clean), `npm run build` (succeeded), `npm run dev` + `curl /` returned 200. `git check-ignore` confirmed `.env.local` ignored and `.env.example` tracked.

## Implementation and decision log
| When | Milestone | Entry |
|---|---|---|
| M1 | Database/auth | Wrote `db/schema.sql`, `db/seed.sql`, `scripts/apply-sql.mjs`; libs `db`, `repo` (all SQL, swappable for tests), `access`, `errors`, `session`, `schemas`; routes `/api/users`, `/api/session`, `/api/me`, `/api/health`; login page and placeholder home. The scaffold enabled `cacheComponents`/`partialPrefetching` in `next.config.ts`; that made `export const dynamic` and cookie reads fail, so I removed both options (simpler, classic behavior). The `DATABASE_URL` in `.env.local` was malformed (password in `[brackets]`, line break inside); I normalized the file in place. Mistake: my first masking command failed and printed the database password into the session transcript, so the password should be treated as exposed and rotated. |
| M0 | Scaffold | Created Next.js app (create-next-app, TypeScript, Tailwind, App Router, `src/`), installed zod, postgres, Tiptap, Vitest, shadcn/ui components (button, input, dialog, dropdown-menu, select, skeleton, sonner, badge). Bumped `@types/node` to 22 because Vitest 5 requires it. |

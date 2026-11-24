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

## Authentication (demo only, NOT production authentication)
Login picks one of three seeded users; there are no passwords. A random 32-byte token is stored in `sessions`; the cookie (`httpOnly`, `sameSite=lax`, `secure` in production, 7-day expiry) carries it. Every API call resolves the user from the session row. Real authentication would replace only `src/lib/session.ts` and the login route.

## Access rules
`src/lib/access.ts` is the only place permissions are decided: `getAccess(ownerId, userId, shareRole)` returns `owner | editor | viewer | null`, and `can(access, action)` maps that to read / editContent / rename / delete / share. Unit-tested in `src/lib/access.test.ts`. Document routes (M2+) will call it on every operation; no access answers 404.

## Trade-offs and limitations
_TODO_

## Future improvements
_TODO_

# Submission

**Project:** CollabDocs, a lightweight collaborative document editor (time-boxed assessment).
**Status:** feature-complete and frozen. The walkthrough video URL is a placeholder until the candidate provides it (see `WALKTHROUGH.txt`).

## Deliverable inventory
| Item | Where |
|---|---|
| Live deployment (public) | https://collabdocs-blue.vercel.app |
| Source code (GitHub) | https://github.com/Ankita2525/collabdocs (**private repository**: the reviewer must be given access, or use the source archive below) |
| Source archive | `submission-package/collabdocs-<commit>.zip`, produced with `git archive` from the final commit (tracked files only: no `node_modules`, build output, environment files or credentials) |
| Walkthrough video | **placeholder**: see `WALKTHROUGH.txt` (URL not yet provided) |
| README.md | setup, environment, demo users, commands, import and export behaviour, manual test script, limitations |
| ARCHITECTURE.md | architecture, data model, access rules, saving/conflict design, import, sharing, export, trade-offs, future work |
| AI_WORKFLOW.md | AI tool used, contributions, changed/rejected suggestions, decision log, verification results |
| `.env.example` | environment variable names only (`DATABASE_URL`), no values |
| Automated tests | `npm test` (about 160 tests) |

## Implemented functionality
Create, rename, edit, save and reopen documents; rich text (bold, italic, underline, headings, bulleted and numbered lists); `.txt` import (UTF-8, up to 1 MB); owned and shared documents (viewer/editor roles, owner-only sharing management, revocation) with a visible distinction; persistence of content, formatting and sharing in Supabase PostgreSQL; validation and error handling; server-side authorization on every operation; autosave with version-based conflict detection; automated tests; public Vercel deployment.
**Optional enhancement added after the mandatory scope:** document export from the editor's **Export** menu: *Download Markdown (.md)* and *Print / Save as PDF* (the browser's print dialog with a print stylesheet; not a direct PDF download). It lives in its own commit and can be reverted independently.

## AI tools used
**Claude Code (Claude Sonnet 5.5)** planned, wrote and tested the application and wrote the documentation, and executed the automated checks listed below. **ChatGPT** was used by the candidate as a planning, prompt-engineering and review assistant (requirements analysis, stack and architecture proposals, prompts and plan reviews for Claude Code, deployment guidance, review of milestone reports and screenshots, manual-test checklists, export requirements). That description is provided by the candidate and was not visible to Claude Code; ChatGPT did not modify the repository or run tests, database queries or production checks. See AI_WORKFLOW.md for contributions, changed or rejected suggestions and verification, and for which checks were executed by AI tools versus performed by the candidate.

## Reviewer instructions
1. Open https://collabdocs-blue.vercel.app and choose a demo user (Alice Johnson, Bob Smith or Carol Diaz). The login is **demo authentication, not production authentication**; there are no passwords.
2. Follow the 10-minute **manual test script** in README.md (login, create and format, reload, rename, import, share, change/revoke access, conflict, export).
3. To run locally: `npm install`, copy `.env.example` to `.env.local` and set `DATABASE_URL`, apply `db/schema.sql` and `db/seed.sql` (README, "Local setup"), then `npm run dev`. `npm test`, `npm run lint`, `npm run typecheck` and `npm run build` need no database.
4. Please do not rely on the single pre-existing "Untitled document" in the shared demo database: it belongs to the candidate's manual testing.

## Known limitations
See README.md "Known limitations" for the complete list. In brief: demo authentication only; no real-time collaboration (conflicts are detected, not merged); `.txt` is the only import format, and a file up to 1 MB can still be rejected if it expands past the 2 MB converted-document limit (for example about a million very short lines); export is Markdown or browser print only (underline is inline HTML in Markdown, PDF page layout depends on the browser, Markdown cannot be re-imported); a promoted viewer must reload; the private repository needs access to be granted.

## Verification status (kept distinct on purpose)
**Automated, executed by Claude Code (an AI tool; results recorded in AI_WORKFLOW.md):** unit and API-level tests (all passing at the final commit), lint, typecheck and production build; curl-based harnesses against the real database and against the production deployment covering authentication, document CRUD, rich-content persistence, stale-version and concurrent-write protection, sharing and permission enforcement (including downgrade and revocation on an open editor), `.txt` import, and the server-rendered Export control for owner, editor and viewer; before/after database snapshots showing existing documents were not changed by the tests; a Git audit showing no credentials are tracked; a development-time check of the Markdown serializer against a CommonMark reference parser.
**Browser verification by the candidate (human, in Chrome), reported to Claude Code and recorded as reported:** the earlier M2 dashboard flows, and **19 final checks, all reported PASS**: login and session persistence; document creation and renaming; all rich-text formatting options; autosave and content persistence; manual save; share with viewer; viewer cannot edit; upgrade viewer to editor; editor can save; revoke access while the document is open; import a valid `.txt` file; reject invalid files; download Markdown; verify the Markdown content; save a PDF and inspect the output; concurrent editing conflict; unsaved-changes warning; responsive layout; visual consistency. The candidate did not specify the build (production or local) used. Claude Code did not observe these checks.
**Not part of the candidate's report, so not claimed:** that Export is disabled after access is revoked, the downgrade-to-viewer banner, keyboard-only navigation and focus visibility, browsers other than the candidate's Chrome, screen readers, dashboard empty and error states, title-validation messages, upload-progress intermediate states, and any measured colour-contrast check.
**Security note:** the database password was displayed once in the AI session during development (disclosed in AI_WORKFLOW.md); rotating it in Supabase and updating the Vercel environment variable is recommended if not already done.

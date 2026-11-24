# Submission

> **Status: placeholder.** Nothing below is final until the F milestone.

## Deliverables
| Item | Location |
|---|---|
| Source code | _TODO_ |
| Live deployment | _TODO_ |
| Walkthrough video | _TODO (see WALKTHROUGH.txt)_ |
| README.md | repo root |
| ARCHITECTURE.md | repo root |
| AI_WORKFLOW.md | repo root |

## Implemented functionality
Create, rename, edit, save and reopen documents; rich text (bold, italic, underline, headings, bulleted and numbered lists); `.txt` import (UTF-8, up to 1 MB); owner and shared documents with viewer/editor roles, owner-only sharing management, revocation; persistence of content, formatting and sharing in Supabase PostgreSQL; server-side validation and authorization on every operation; autosave with version-based conflict detection; automated tests; Vercel deployment.
**Optional enhancement (added after the mandatory scope): document export** from the editor's Export menu: *Download Markdown (.md)* and *Print / Save as PDF* (native browser print with a print stylesheet; not a direct PDF download). Details and limits are in README.md and ARCHITECTURE.md. This enhancement lives in its own commit and can be reverted independently.

## Reviewer instructions
_TODO_

## Known limitations
See README.md "Known limitations" for the full list. In brief: demo authentication only (no passwords); no real-time collaboration (conflicts are detected, not merged); `.txt` is the only import format and a 1 MB file can still be rejected if it expands past the 2 MB converted-document limit (very many short lines); export is Markdown or browser print only (underline is written as inline HTML in Markdown, PDF page layout depends on the browser, Markdown cannot be re-imported); UI verified by the candidate in Chrome only to the extent recorded in AI_WORKFLOW.md.

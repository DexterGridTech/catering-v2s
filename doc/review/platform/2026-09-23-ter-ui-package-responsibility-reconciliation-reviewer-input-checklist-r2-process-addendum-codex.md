# R2 fresh reconciliation reviewer checklist — process addendum

This addendum supplements (and does not replace) `2026-09-23-ter-ui-package-responsibility-reconciliation-reviewer-input-checklist-r2-codex.md`. Both files are required inputs for the next fresh reviewer. It exists because earlier attempts either exposed deferred review paths during an overly broad search or returned aggregate route counts without the required per-path audit table.

## Blind-stage search boundary

Before the initial independent assessment, do **not** run broad `rg`/grep/searches over `doc/`, `project-memory/`, or `apps/terminal/` if the search can return content or paths from deferred author ledger/evidence, earlier reviewer reports, or Claude reviews. Do not search those deferred files by content or inspect their names/metadata. Scope code searches to explicit current source/test paths listed by the primary checklist.

The confirmed-business corpus search is limited to opening and searching the exact routed source `project-memory/decisions/confirmed-business-language-corpus.md` for the seven terms named in the primary checklist. Do not use a repository-wide search to establish no corpus match. If a route's `sourceRefs` happens to identify a deferred current-task author/review file, mark that edge as deferred during blind review and do not read it until after the independent preliminary result has been returned.

If any command/output nevertheless exposes substantive deferred author/reviewer conclusions before the preliminary verdict, stop that reviewer pass immediately, report exactly what was exposed, and do not submit its source conclusion as a valid blind verdict. A path-only incidental match is still an audit deviation to disclose; never conceal it.

## Route audit output cannot be summarized away

Rerun both exact `scripts/memory/query` commands in the primary checklist. In the initial report, include:

1. Every `.refs[].path` for each route separately, with current SHA-256 and explicit `OPENED`/`NOT_OPENED` status.
2. Every route edge `(hit path, sourceRefs path)` emitted by `.refs[].sourceRefs[]`; list each unique source path, its applicable hit/claim, SHA-256 and `OPENED`/`NOT_APPLICABLE_WITH_REASON`/`DEFERRED` status.
3. A line-by-line reconciliation proving the actual evidence and governance membership sets equal the checklist E/G labels. Matching only 23/27 totals or a 35-path union is insufficient.
4. The exact business-corpus query target and per-term result.

Do not replace these lists with “all paths matched,” a count, sample hashes, or “MISSING=0.” If response size is a concern, provide compact one-path-per-line appendices in the same response. The author materials remain deferred until the full preliminary lists and verdict are returned.


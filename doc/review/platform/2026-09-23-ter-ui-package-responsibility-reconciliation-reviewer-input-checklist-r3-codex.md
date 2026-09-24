# R3 final reconciliation ledger reviewer input checklist

REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION
REVIEW_ROUND=3
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_SEQUENCE=REQUIREMENT_DESIGN_SOURCE_AND_MEMORY_FIRST; FINAL_AUTHOR_LEDGER_AND_R2_REPORT_AFTER_PRELIMINARY_RESULT
SCOPE=Verify that final reconciliation ledger updates and R2 audit-hash disposition are accurate; do not re-review or expand implementation scope.

## Task and boundaries

This is a new fresh read-only reconciliation after R2 author updated the ledger and remediation evidence. The exact post-R2 objects to verify are listed below with SHA-256. Before reading them, independently inspect current requirement/design/plan criteria, current owning source and tests, and required memory. Return an initial source-first assessment before opening any file in the deferred-author list. Then open the deferred files and check whether rows, citations, sourceRef hash discrepancy, S-1 timeline, S-2 coverage, S-3 criteria, and N-1 baseline wording are accurate.

Do not edit files; do not run tests, builds, typechecks, Web, Metro, Android, devices, screenshots, cleanup, or Git commands. Do not infer that focused tests or devices were rerun in this R3 pass. This is not an overall implementation GO/NO-GO review and grants no authority.

## Startup, governance, memory, and source inputs

Read current AGENTS.md, CLAUDE.md, PLATFORM-BLUEPRINT.md, doc/platform/README.md, active-document-index.json, roadmap-program-registry.json, the selected Roadmap authorization fields, project-memory/index.md, project-memory/required-inventory.json, project-memory/decisions/deterministic-context-only.md, scripts/README.md, doc/platform/review-standard.md, and doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md. Follow the R2 primary checklist and process addendum below for complete required-input, corpus, and sourceRef procedure.

R2 route checklist: doc/review/platform/2026-09-23-ter-ui-package-responsibility-reconciliation-reviewer-input-checklist-r2-codex.md  
SHA-256: e4e9e98748c748bd4a922bc702a3bb63fe06207f7e687565277b4b6c246554b4

R2 route process addendum: doc/review/platform/2026-09-23-ter-ui-package-responsibility-reconciliation-reviewer-input-checklist-r2-process-addendum-codex.md  
SHA-256: 74444e2fdd421808d90b0b2678c319232b448203093416c6b77cd7d7b4f86a27

Rerun the two exact six-dimensional memory commands in the R2 checklist and use that checklist/addendum for all 35 routed memory hits, every sourceRef, route memberships, hashes, and business-corpus terms. Applicable sourceRefs must be opened; each non-applicable ref gets an explicit bounded reason. Do not use a broad repository search to replace routed reads.

## Blind-stage owning material

Before preliminary result, open/read:

| Path | SHA-256 |
| --- | --- |
| doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md | 9fca0272f326a9ee56b7182e70d512b38c398d09e28d2a219cbbacc55da8d751 |
| doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-design-codex.md | 530e45da60d2e4c29459c2deb5a6d389b198d42c7f0687db9eeef02396030ea3 |
| doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-plan-codex.md | 6c4786bc8b112722567b03b895721cf0eb4ad53d654f492e9a6a02b14569eab9 |
| apps/terminal/ui/feature/sample-member-desk/src/parts/parts.ts and test/memberDesk.test.tsx | Source/test paths and test hash are in R2 checklist |
| apps/terminal/ui/feature/sample-staff-auth/src/parts/parts.ts and test/staffAuth.test.ts | Source/test paths and test hash are in R2 checklist |
| apps/terminal/ui/feature/sample-wallpaper-picker/src/parts/parts.ts and test/sampleWallpaperPicker.test.tsx | Source/test paths and test hash are in R2 checklist |
| apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx and test/sampleAssembly.test.tsx | Source/test paths and test hash are in R2 checklist |
| apps/terminal/ui/integration/sample-wallpaper-console/src/parts/parts.ts, src/assembly/assembly.tsx, and test/sample2Assembly.test.tsx | Source/test paths and test hash are in R2 checklist |
| doc/platform/foundation-charter.md | Current SHA and relevant §3-B are recorded in R2 independent report |

Inspect the exact ten metadata fields specified by design: partKey, rendererKey, containerKeys, displayModes, workspaces, instanceModes, title, surfaceForm, layerTier, layerGuard. Verify the PRIMARY-only member-form criterion and ensure no production source adjustment was used to fit the tests. The R2 checklist contains the remaining current-source and evidence paths.

## Deferred until after the initial assessment

Do not open these before returning the source-first preliminary finding:

| Path | SHA-256 |
| --- | --- |
| doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-code-design-reconciliation-codex.md | c0dc444d910471718ea5a0bd0c35d9ba8b68b25a78cfd30280b565d3542bf7fb |
| doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-review-remediation-evidence-codex.md | 9a064c09a865f836b00b516a3fa28908f1f3e0740e5924caecf4200d3375a7f6 |
| doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-cp3-execution-evidence-codex.md | Open only after preliminary; obtain current SHA then |
| doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-dynamic/README.md | 1a828a83d1f58a439df1ce2c6d5da51882ee8918a9ed1faec043b9b4e3b5e17a |
| doc/review/platform/2026-09-23-ter-ui-package-responsibility-code-design-reconciliation-review-r2-codex.md | 7abd95503ef8cc28432ad468ad8742b36b497b307ea951f7a20fbbabdd3e8036 |
| doc/review/platform/2026-09-23-ter-ui-package-responsibility-code-design-reconciliation-review-codex.md | Open only after preliminary; obtain current SHA then |
| doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-review-claude.md | 3f898ca30251b6e6bec5971b5dae62b0fa6f7fb1fef03b3551421e77d1a5f70e |

After the blind assessment, verify every applicable item in the R2 checklist’s deferred-author section, all 40 ledger rows for design §§3–8, and these exact claims:

1. Row 42 is MATCHED based on a complete fresh reviewer route/read audit. If not, identify the exact unmet criterion.
2. Row 52 and S-1 timeline distinguish original OPEN, author MATCHED, R1 audit gap, and R2 fresh result. Confirm the ten-field snapshots and real displayModes mutation evidence are not represented as rerun in R2.
3. The two N/A sourceRefs whose hashes R2 could not recover remain visibly audit OPEN, with their R2-returned values UNVERIFIED and separately stated author-side current hashes. They must not be silently rewritten as if the reviewer had returned those current hashes. Decide whether this audit-only OPEN affects row 42 or the reconciliation verdict, with a source-based reason.
4. Design §6 line 219 and implementation plan §4 line 66 both require the non-partKey/non-surface displayModes mutation. Mutation evidence records first red and restoration green.
5. Dynamic README says zero runtime/APK bytes changed and the four Android runs were baseline observation only.
6. Q5, external consumers, v2 heading, dismissal purity, and unauthorized export shrink remain OPEN; no source/export changes were introduced.

Report only MATCHED or OPEN for each reconciliation item. For every OPEN, state first failure, last known good, broken boundary, and next step. Distinguish any audit-provenance OPEN from an implementation mismatch. Do not issue an overall implementation GO.

Reviewer output metadata: reviewerKind=INDEPENDENT_SUBAGENT; include this checklist path and its computed SHA-256; declare blind sequence and authorMaterialReadAfterIndependentVerdict=true. The parent agent will archive the returned verdict; reviewer must not write the archive.

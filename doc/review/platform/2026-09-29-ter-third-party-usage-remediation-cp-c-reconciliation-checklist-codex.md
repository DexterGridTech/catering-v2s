# CP-C 三维对账输入清单

Reviewer kind: `INDEPENDENT_SUBAGENT`
Scope: CP-C only (TP-C1, TP-C2, TP-C3 and any implementation-plan files assigned to CP-C).
Required verdict: `CP_C_RECONCILIATION=MATCHED|OPEN`; no whole-batch verdict.

| Required input | Path / command | Read / result |
|---|---|---|
| Codex entry | `AGENTS.md` full | reviewer records |
| Claude entry | `CLAUDE.md` full | reviewer records |
| Direct assignment and authority | User's current v3.4 implementation authorization, reproduced in the reviewer prompt | reviewer records |
| All project-memory kernels | `project-memory/kernel/*.md` | `READ_ALL` required |
| Six-dimension route | Run each exact command: `scripts/context/recall-memory --task-kind implementation --domain platform --consumer-face platform-admin --owner platform --impact runtime --trigger implementation`; repeat replacing the consumer face with `operations-admin`, then `backend`. Union/deduplicate hits; `all` is not a query value. | all three queries PASS; record each route and the deduplicated hit set |
| Routed memory and applicable owning refs | every route hit plus `project-memory/decisions/terminal-architecture-and-stack-rulings.md`, `project-memory/decisions/terminal-build-order-and-batches.md`, and referenced active sources | reviewer records all opened refs |
| Confirmed business corpus | search `project-memory/decisions/confirmed-business-language-corpus.md` for `Android`, `display`, `splash`, `lifecycle`, `surface`; report each match or `NO_CORPUS_ENTRY_MATCHED` per search | reviewer records |
| Original requirement | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md` full, v3.4 | `READ_FULL` |
| Accepted implementation design | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md` full | `READ_FULL` |
| Implementation plan | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md` CP-C and shared gates | `READ` |
| CP-C pointwise sources | `apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalNativeLoadingModule.kt`; `TerminalNativeLoadingRegistry.kt`; `TerminalExpoSplashScreen.kt`; `TerminalNativeLoadingDispatchTest.kt`; `apps/terminal/application/base/android/src/foundations/nativeLoadingCapability.ts`; `src/foundations/nativeTopology.ts`; package tests and README; both Android display adapters, their implementation/tests/README, `scripts/test/ter-virtual-keyboard-android.mjs` and its tests; `tools/terminal-sample2/check-native-projection.mjs` and `.test.mjs` | inspect complete relevant functions and changed test bodies |
| Per-change reread | requirement + memory hit + owning source + design clause + reusable source before and after each CP-C write; use author-visible source/command history only after forming an independent initial verdict | reviewer records missing pointwise reads as findings |
| Author pointwise record (after blind verdict) | `doc/evidence/platform/2026-09-28-ter-third-party-usage-remediation/cp-c/cp-c-pointwise-reread-20260929.md` | verify each change group against the actual source and focused proof; do not infer unrecorded evidence |
| Relevant decision titles | enumerate `doc/decisions/` titles, open applicable decisions including `doc/decisions/2026-07-24-v2s-verification-governance.md` and the independent-review governance | reviewer records |
| Applicable standards | `doc/platform/terminal-coding-standard.md` (TR-10, TR-11, TR-16, TR-17 as applicable); `doc/platform/third-party-library-usage-standard.md`; `doc/platform/review-standard.md`; `doc/platform/implementation-task-template.md`; implementation-design template | reviewer records |
| Current focused evidence (after initial verdict) | `doc/evidence/platform/2026-09-28-ter-third-party-usage-remediation/cp-c/cp-c-current-validation-20260929.md`; raw runner output `doc/evidence/platform/2026-09-28-ter-third-party-usage-remediation/cp-c/ter-virtual-keyboard-android-focused-20260929.log`; pointwise record; referenced Gradle manifest/XML/logs | verify current source digest, commands, test counts, red/restore outputs and cleanup; do not upgrade focused proof to device/Web |

Blind declaration required: form independent findings and `MATCHED`/`OPEN` verdict before reading the CP-C evidence summary or author disposition; then compare every CP-C work item and focused result against its requirement, design and memory sources. This is a stage reconciliation, not a code-writing task. Do not edit files, install dependencies, build, or start Web, Metro, Android, emulator, device, DEV, L2, seed, reset, or UAT. Command/script-only; no computer use.

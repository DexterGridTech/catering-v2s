# Terminal activation batch 1 · dynamic front admission

```text
DYNAMIC_FRONT_ADMISSION=PASS
SCOPE=STAGE_1_ONLY; TER_TERMINAL_OPTIMIZATION=OUT_OF_SCOPE
BROWSER_L2=NOT_RUN
RESET=NOT_RUN
ACTUAL_SEED=NOT_RUN
```

All four current-byte prerequisites are PASS. This record admits the next authorized Stage 1
Browser L2 lifecycle only; it does not claim Browser L2, reset, actual seed, DEV or UAT results.

| Prerequisite | Current state | Evidence |
|---|---|---|
| CP-stage reconciliation | `PASS` — CP-01/02/05/06 boundary records are matched. CP-03/04 have no separate gate per Dexter's direction; their complete scope is in whole-batch 6b. | CP boundary records named by the current implementation plan; current whole-batch record below |
| Whole-batch 6b | `PASS` — `WHOLE_BATCH_6B=MATCHED`, `M/S/N=0/0/0`, 472 files, source digest `0dca67eb5ce5353e11986bdb7318dc7fc990342591aa0dd06210a8101d5e43d8`. | `doc/review/platform/2026-09-29-v2s-terminal-activation-batch-1-projection-binding-reconciliation-codex.md` |
| §3a and six-case L2 admission | `PASS` — UI design and testId review are PASS; fresh independent admission review is PASS. Current snapshot: six ordered cases, 36 control-plane files, 22 UI files, 58 entries, 48 unique paths, 2,170,957 bytes; admission digest `27abd37ee8548962c49f7688393def93bc473f006088e5bedcace04f2c33fdb1`; policy digest `9e4f136958e21d6e6a2c739fc25f85d9914f508e0bf8ea0ded4c4df71e482e7f`. The previous gate attempt correctly failed closed because its designated record had the prior digest; the fresh independent current-byte record is now appended. `validateAdmission()` returned `PASS` with all six ordered cases and the above counts. | `doc/review/platform/2026-09-28-v2s-terminal-activation-batch-1-l2-admission-review-r3-codex.md`; `contracts/policy/store-terminal-l2-admission.json`; current-byte `computeAdmissionSnapshot()` and `validateAdmission()` output. |
| Full seed current-byte dry-run | `PASS` — non-writing validation; command exited 0 and the executor removes its temporary plan directory in `finally`. No database or remote resource was created; no managed run ID applies. | `scripts/dev/seed --profile r5-full --dry-run` output: `R5_COMPLETE_SEED_DRY_RUN=PASS; COMPONENTS=owner-command,external-collaboration-business-channel,catalog-inventory,sales-menu; SOURCE_ITEMS=73; CREATED_ITEMS=72; EXCLUDED_ITEMS=1; MEDIA=34; TERMINALS=8; TERMINAL_PLAN_DIGEST=b37af605c2a9a9bda924c5455765efd569c96766b7c4e2a11768b03a5f1e4d1c` |

The latest full acceptance preceding this L2 admission is `r5-tc-1790645813448-70364`
(`2026-09-29T01:36:53.456Z–01:45:24.117Z`): 195/195 business scenarios PASS, 39/39 TDS CONTRACT
scenarios PASS, V-S14 compression/frame cases 9/9 PASS, and cleanup PASS. V-S12's 30-second database
outage/recovery passed. Run-scoped logs and evidence are under
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1790645813448-70364/`; the execution status is in
`doc/review/platform/2026-09-27-v2s-terminal-activation-batch-1-execution-status-codex.md`.

The four prerequisites are satisfied on the current bytes. Before Browser L2, the managed runner
must still repeat its launch-time resource/identity preflight and preserve the six-case exact set.
The actual run must follow the required `readiness → same-run activation → generated-chain exact
check → finalize → managed browser run` sequence. No reset or actual seed is included in this
admission record.

## Current dynamic result — 2026-09-29

```text
DYNAMIC_FRONT_ADMISSION=PASS
BROWSER_L2=PASS
L2_RUN_ID=l2-1790647239885-78066-4ecba04a-1016-4274-8c59-5b793be5544a
L2_CASES=6/6; BUSINESS=PASS; JOIN=COMPLETE; CLEANUP=PASS
RESET=NOT_RUN
ACTUAL_SEED=NOT_RUN
DEV=NOT_RUN
UAT=NOT_AUTHORIZED
WHOLE_BATCH_6B=EXISTING_MATCHED_RECORD_REUSED; NOT_REPEATED
```

The run bound the current six-case admission digest `27abd37ee8548962c49f7688393def93bc473f006088e5bedcace04f2c33fdb1`
and repository byte-binding digest `3723b1f8a4a25741e9fa4881e784ddecc650012c450f203fef020d507664ca44`.
All six cases completed in order with no failures. The cross-layer join is `COMPLETE` with 64 HTTP
completions, 124 backend completions and 1,806 DB section rows; there are no missing or unexpected
controls/actions and no invalid case-scoped events. `l2-cleanup-manifest.json` records
`cleanup=PASS`, zero cleanup/artifact errors and the exact remote run root absent after teardown.
Full details and run-scoped logs are in
`.runtime/browser-l2/l2-1790647239885-78066-4ecba04a-1016-4274-8c59-5b793be5544a/` and
`doc/review/platform/2026-09-27-v2s-terminal-activation-batch-1-execution-status-codex.md`.

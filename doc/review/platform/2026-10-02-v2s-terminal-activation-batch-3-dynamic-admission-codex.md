# Batch 3 dynamic admission — 2026-10-02

## Admission decision

`RESET_SEED_ADMISSION=PASS` and final sequence `RESET=PASS → DEV_START=PASS → R5_FULL_SEED=PASS` for the authorized non-production batch-3 run. The completion section below supersedes the earlier “Remaining before reset/seed” snapshot, which was written before the first E1 run and final S-1 repair.

## Preconditions

1. **All implementation CPs:** CP-01 through CP-06 are independently `MATCHED`. Records: `2026-10-02-v2s-terminal-activation-batch-3-cp01-codex.md` through `cp06-codex.md`. CP-06 includes the final Doris runtime-key repair and fresh recheck.
2. **Full-batch reconciliation:** `BATCH_6B=MATCHED`, recorded in `2026-10-02-v2s-terminal-activation-batch-3-6b-codex.md`.
3. **L2 admission:** `§3a=N/A`; this batch adds no UI-bearing action or L2 control. No empty denominator admission was created.
4. **Current-byte full seed dry-run:** `scripts/dev/seed --profile r5-full --dry-run` PASS at 2026-10-02T03:32:08Z. Output: `R5_COMPLETE_SEED_DRY_RUN=PASS`, components `owner-command,external-collaboration-business-channel,catalog-inventory,sales-menu`, 73 source items, 72 created, 1 excluded, 34 media items, 8 terminals, terminal plan digest `b37af605c2a9a9bda924c5455765efd569c96766b7c4e2a11768b03a5f1e4d1c`. The reset runner also performed its required current-byte dry-run before mutation.

## Dynamic evidence supporting admission

- Full managed backend acceptance: run `r5-tc-1790902194579-72507`, 2026-10-02 00:49:54–01:01:40 UTC; `BUSINESS=PASS`, TDS CONTRACT 49/49, backend scenarios 199/199, operation budget 296/296, runner/Testcontainers cleanup `PASS`.
- Default `scripts/verify`: run `r5-verify-16215-1790904019356`, 2026-10-02 01:20:19–01:57:30 UTC; `R5_VERIFY=PASS`, `REMOTE_TESTCONTAINERS_CLEANUP=PASS`. All runtime command exits and managed cleanups are recorded in `.runtime/batch3-dynamic/default-verify-final.log`; terminal verification reports `TERMINAL_VERIFY=PASS` and `TERMINAL_VERIFY_CLEANUP=PASS`.
- The earlier verify attempt and root-cause repairs are preserved in `.runtime/batch3-dynamic/default-verify-first-failure.txt`. The two failures were (a) duplicate `--no-daemon` passed to the managed runner, and (b) missing registration of `scripts/dev/r5-doris-resident.test.mjs` in the explicit Node test inventory. Each was repaired at its owning source and closed with focused proof before the final verify PASS.
- Unchanged CP focused proofs, feasibility evidence, and the Testcontainers host preflight are reused from their cited records; no probe or acceptance scenario was repeated solely to refresh timestamps.

## Final current-byte completion

The final S-1 repair changed only resident Doris credential reconciliation and its preflight profile/test. Current focused proofs (`node --check`, `node --test scripts/dev/r5-doris-resident.test.mjs` 5/5, and `node scripts/dev/r5-doris-resident-feasibility.mjs --self-test`) pass; a new managed DEV start plus `terminal.dev.lifecycle-and-compression` E1 proved the injected current credential against the resident writer. The full backend-acceptance run below remains applicable because it uses an isolated per-run Doris and its owning production/test sources were unchanged by this repair. The prior complete `scripts/verify` run remains historical to its recorded byte; affected post-review paths were verified by the focused tests and read-only preflight rather than rerunning unrelated gates.

Final DEV E1 run `ter-client-dev-1790911220193-47729-9a7e19e4-55d9-4edf-a117-ee77c937ad44`, 2026-10-02T03:20:20.193Z–03:21:58.023Z, scenario `terminal.dev.lifecycle-and-compression`: `BUSINESS=PASS`, `FIXTURE_CLEANUP=PASS`, `RUNNER_CLEANUP=PASS`, exit 0. Doris readback: `CONNECTED=2`, `HEARTBEAT_RTT=3`, `DISCONNECTED=2`, 916 ms. The final reset/start/seed below occurred after this E1 run.

1. Current-byte full seed dry-run PASS at 03:32:08Z, digest above.
2. Reset run `r5-reset-f49ecc36-400c-4f21-8002-29181073e33a`, created 2026-10-02T03:33:38.940Z: business `PASS_DORIS_CLEARED_POSTGRES_ABSENT_READBACK`; Doris SQL readback `0` preceded PostgreSQL absent readback; cleanup `PASS_DORIS_RESIDENT_RETAINED_DEV_STOPPED`; `firstFailure=null`.
3. DEV start run `r5-dev-1790912053964-65452-72a75a8c-8084-4b8c-a339-c213db2eba4f` (03:34:19.964Z start epoch): readiness `PASS`; Java, all three TDS nodes/listeners, HAProxy, both WebSocket entries, local Vite and managed tunnel passed. The same resident Doris 4.1.3 container/image/FE/BE volumes were retained and healthy. TDS observed RSS was 104,812 / 106,080 / 107,716 KiB against 512 MiB each. No seed is implicit in DEV start.
4. Complete seed run `complete-seed-16944083-6487-4df6-bde3-665522894b4e`, 2026-10-02T03:36:05.312Z–03:40:17.907Z: `BUSINESS=PASS`, `CLEANUP=PASS_PRESERVED_DEV_STATE`, `firstFailure=null`. All four owners passed: owner-command, external-collaboration-business-channel, catalog-inventory, sales-menu. Store-terminal post-step passed: created=8, detail readback=8, list readback=7. DEV remains running and seeded for Dexter review.

`current run` manifests and reports:
- Reset: `.runtime/r5/reset/r5-reset-f49ecc36-400c-4f21-8002-29181073e33a/run-manifest.json`.
- Final DEV: `.runtime/r5/run-manifest.json` and `.runtime/r5/readiness-65452.jsonl`.
- Final seed: `.runtime/r5/seed/complete/complete-seed-16944083-6487-4df6-bde3-665522894b4e/run-manifest.json` and `seed-report.json`.
- E1: `.runtime/terminal-client-dev-acceptance/ter-client-dev-1790911220193-47729-9a7e19e4-55d9-4edf-a117-ee77c937ad44/manifest.json`.

## Status lines

当前字节上的最新运行：`complete-seed-16944083-6487-4df6-bde3-665522894b4e`，2026-10-02T03:36:05.312Z–03:40:17.907Z，`BUSINESS=PASS`，`CLEANUP=PASS_PRESERVED_DEV_STATE`。

最后一次通过：同一 run id `complete-seed-16944083-6487-4df6-bde3-665522894b4e`，2026-10-02T03:36:05.312Z–03:40:17.907Z；owner seed输入与实施源码为当前字节，文档后续仅有记录同步；最终DEV health及Doris identity见同一最终DEV manifest。

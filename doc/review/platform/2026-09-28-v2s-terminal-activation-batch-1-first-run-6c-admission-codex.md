# Terminal activation batch 1 · first managed run 6c admission

## Current-byte admission update · 2026-09-28 19:16 UTC

```text
REVIEW_TARGET=FIRST_DYNAMIC_RUN_6C_ADMISSION
STATUS=PASS
M/S/N=0/0/2
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/stage1_6c_currentbyte_admission
EXACT_ADMITTED_INVOCATION=scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight
BUSINESS_SCENARIO_COUNT=1; operation=storeTerminalActivationBusinessPrecedence
WHOLE_BATCH_6B=MATCHED; source set=472 files/0dca67eb5ce5353e11986bdb7318dc7fc990342591aa0dd06210a8101d5e43d8; current report=2026-09-29-v2s-terminal-activation-batch-1-projection-binding-reconciliation-codex.md
CURRENT_BYTE_NORMAL_STATIC=PASS; log=.runtime/r5/evidence/terminal-activation-ordinary-validate-only-20260929.log; SHA256=00212f1a3f952120df26c49d01f734c640f0e328c5ca0cc6eab97491e6e0e137; EXECUTED=46/46
LOCAL_RESOURCE_PREFLIGHT=LAST_OBSERVED_PASS; LIVE_MANAGED_PROCESSES=0; MANAGED_RSS_MB=0; RSS_BUDGET_MB=4096; mandatory launch-time recheck
DEV_STATE=MANDATORY_LAUNCH_TIME_MANAGED_MANIFEST_CHECK; stop only a currently owned matching DEV manifest; if absent, do not start or restart DEV
REMOTE_PREFLIGHT=MANDATORY_INSIDE_MANAGED_INVOCATION_BEFORE_REMOTE_WORKSPACE_PREPARE
TOPOLOGY=NOT_RUN; BUSINESS=NOT_RUN; TDS_CONTRACT=NOT_RUN; DB_OPERATIONS=NOT_RUN; CLEANUP=NOT_RUN
NETWORK=CONNECTED; SSH_OR_ROUTE_CONFIGURATION=UNCHANGED
```

Fresh read-only reviewer `/root/stage1_6c_currentbyte_admission` issued this current-byte `PASS`
after confirming the corrected whole-batch 6b source identity and retained ordinary static log.
The review reports `M/S/N=0/0/2`: its two non-blocking notes require (1) the execution-status
record to carry the corrected source identity, now recorded in its current section, and (2) a
fresh DEV/resource/remote-resource check at the managed runner's launch boundary. The second is a
run-time entry condition, not a claim that preflight or topology has already passed. This admission
authorizes only the exact first invocation above; it claims no dynamic result.

Current-byte latest run: ordinary `scripts/verify --validate-only`, nested run
`ter-local-static-90659-1790622089030`, 2026-09-28 19:01:29–19:03:25 UTC, PASS 46/46; static only.
Last managed PASS: `r5-tc-1790619537737-59512`, 2026-09-28 18:18:57–18:21:25 UTC; historical and
not current-byte topology/business proof.

```text
REVIEW_TARGET=FIRST_DYNAMIC_RUN_6C_ADMISSION
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/stage1_6c_current
ADMISSION_VERDICT=PASS
M/S/N=0/0/0
EXACT_ADMITTED_INVOCATION=scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight
BUSINESS_SCENARIO_COUNT=1; operation=storeTerminalActivationBusinessPrecedence
WHOLE_BATCH_6B=MATCHED; source set=468 files/5886fa6cfd862a4d31b3e3f9bf4dd3618ea6dae23dc9296fad0fc182962699dd; code-layout=23694b4699d15d26d16298665701fa7dea3b0012c1782cb173515291855bd5a2; report=2026-09-28-v2s-terminal-activation-batch-1-6b-reconciliation-r5-codex.md
CP05_RECONCILIATION=MATCHED; fresh current-byte reviewer=/root/cp05_vs12_current_format; report=2026-09-28-v2s-terminal-activation-vs12-listener-recovery-repair-codex.md
LOCAL_RESOURCE_PREFLIGHT=PASS; command=scripts/env/check-runtime-resource-budget --profile admin-validation-with-ter .runtime; LIVE_MANAGED_PROCESSES=0; MANAGED_RSS_MB=0; RSS_BUDGET_MB=4096; preflight does not emit run id
CURRENT_DEV_MANIFEST=ABSENT; V2S_RUNTIME_DIR=UNSET; DEV_WAS_RUNNING=false
REMOTE_RESOURCE_PREFLIGHT=REQUIRED_INSIDE_THIS_MANAGED_INVOCATION_BEFORE_REMOTE_WORKSPACE_PREPARE; current remote inventory=NOT_YET_OBSERVED
TOPOLOGY=NOT_RUN; BUSINESS=NOT_RUN; TDS_CONTRACT=NOT_RUN; DB_OPERATIONS=NOT_RUN; CLEANUP=NOT_RUN
```

## Fresh independent admission verdict

Fresh reviewer `/root/stage1_6c_current` returned `PASS`, `M/S/N=0/0/0` for the single exact
invocation above. The reviewer confirmed that the positive invocation is admitted by the current
runner, the business operation resolves to one scenario, and the current 6b record explicitly
binds `tools/code-layout/cli.mjs` in its 468-file source identity. This closes the source-binding
gap from the reviewer's first pass. The review was read-only and did not execute tests, builds,
SSH, remote inventory or runtime commands.

This PASS supersedes the initial 6c `NO-GO` recorded in
`2026-09-28-v2s-terminal-activation-batch-1-first-run-6c-admission-r4-codex.md`. That review
happened before the current 6b/static evidence was recorded; the blocker was documentary, not a
source or topology finding. The earlier managed V-S12 failure remains preserved as
`r5-tc-1790590651136-97769` and was repaired on the current source bytes; its failure-family
history and repair evidence are in
`2026-09-28-v2s-terminal-activation-vs12-listener-recovery-repair-codex.md`. The fresh reviewer
admitted only the exact single-operation invocation; no dynamic outcome is inferred from this
admission.

The local managed-resource preflight was then run separately and returned the PASS values in the
header. The current DEV manifest is absent and `V2S_RUNTIME_DIR` is unset, so this invocation must
not stop or restart DEV. The managed runner must repeat local checks and perform the remote
container/volume, Node and TDS-capacity preflight before remote workspace preparation. Any failed
preflight remains the run result and must be diagnosed before another attempt.

## Business denominator and separate TDS contracts

The one business scenario is `storeTerminalActivationBusinessPrecedence`. It covers malformed
credential rejection without secret echo or binding/audit writes; generation 1 activation; the
store-disabled denial for another device; same-secret retry returning generation 1; a fresh secret
creating generation 2; and owner readback after re-enabling the store with exactly two audit rows.
The topology preflight separately proves the R3-M1 registration race and the 10-second PostgreSQL
pause/recovery as TDS `CONTRACT`; neither increases the business scenario denominator.

## Required live observations and scope

The managed invocation must prove two isolated business contexts on distinct HTTP ports, a separate
REACTIVE TDS process/classpath/WS port, one shared PostgreSQL endpoint/listener and one database
operation sink, correlated real HTTP and WebSocket traffic, remote Node `22.23.2` with the required
built-in modules, the exact 10-second database pause/recovery, the real verifier-result/HTTP
cancellation registration race, and clean process/resource exit. Record topology, TDS `CONTRACT`,
the selected `BUSINESS` scenario, DB operations and cleanup separately from the run manifest and
logs. This admission does not claim any of those outcomes before execution.

Stage 1 only. This admission does not authorize Browser L2, reset, seed, UAT, production deployment,
device operation, Stage 2/3 or Git actions.

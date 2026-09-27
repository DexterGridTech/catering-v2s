# Terminal activation batch 1 · CP-06 stage reconciliation

```text
CP=CP-06
STEP_RECONCILIATION=MATCHED
M/S/N=0/0/0
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEWER=/root/cp06_review_r2
EVIDENCE_TIER=SOURCE_REVIEW_PLUS_LOCAL_FOCUSED
L2_SCRIPT_ADMISSION=PASS
ADMISSION_SOURCE_DIGEST=0994b6f0b376eeba8b9854039514cdcdb28da2c62e9a98ff8d7c17ad45e46da8
POLICY_DIGEST=9e4f136958e21d6e6a2c739fc25f85d9914f508e0bf8ea0ded4c4df71e482e7f
CASE_COUNT=6
CONTROL_PLANE_FILE_COUNT=36
UI_FILE_COUNT=22
FILE_COUNT=58
BROWSER_L2=NOT_RUN
DEV=NOT_RUN
RESET=NOT_RUN
SEED=NOT_RUN
WHOLE_BATCH_6B=NOT_RUN
FIRST_RUN_6C=NOT_RUN
```

This record supersedes the older CP-06 status at
[`2026-09-27-v2s-terminal-activation-batch-1-cp06-reconciliation-codex.md`](2026-09-27-v2s-terminal-activation-batch-1-cp06-reconciliation-codex.md)
for current-byte evidence. Its admission/policy digests and `25/25` local test count refer to an
older byte set. The current digest is the one independently recorded by the active admission review
and is accepted by the current pure validator test.

## Current focused proof

The main agent ran this non-managed local test command on the current CP-06 bytes:

```text
node --test scripts/dev/r5-dev-command-wrapper.test.mjs scripts/test/store-terminal-l2-admission.test.mjs
```

The following is the exact test-run summary from the current tool execution response, retained here
because it was not previously saved as a standalone log. It is not a live DEV/TDS run:

```text
tests 19
pass 19
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 52.842042
```

The 19 tests include remote Java/TDS control identity validation, remote TDS readiness/RSS probe
construction, TDS-specific configuration/port checks, cleanup receipt behavior, six-case/36-file
admission source closure, stale/missing review rejection, current digest validation, and failure
family blocking. The command's full per-test output is retained in the current task tool transcript;
the summary above is copied from that response, not reconstructed from a later rerun.

## Requirement and source reconciliation

- R-13: the DEV environment selects one trusted remote TDS instance, the same remote PostgreSQL
  endpoint, and a single tunneled TDS WebSocket port. The runner rejects colliding remote ports,
  starts TDS from its separate Gradle target, and forwards only the selected HTTP, asset and TDS
  ports. The current implementation contains no DEV seed-on-start path.
- Managed ownership: the TDS control record binds run id, owned remote root, PID, PGID, boot id,
  process start ticks, command digest, WebSocket port, RSS budget, log path and phase path. Readiness
  checks the same identity, listener, application marker, database listener marker and RSS budget;
  stop collects the TDS log and stops only the validated process group before root cleanup.
- Topology: source uses remote Java and remote TDS; no local Java or PostgreSQL tunnel is admitted.
  The source has one TDS process start call and one TDS listener in the managed manifest. Doris is
  outside batch 1. A live topology claim is deferred to the first exact-operation topology-preflight
  run after the whole-batch 6b and 6c gates, as required by the implementation plan.
- U1/D-18: the edit device-type value is a text observation. `TERMINAL_DEVICE_TYPE_READONLY` is a
  control, not an action; the six-case policy and its digest include the read-only UI/test sources.
- G1 and the §3a admission denominator: the active policy lists six ordered cases and 36 control
  files; the independent admission record additionally binds 22 UI source files. The current focused
  validator accepts the recorded source digest and rejects missing, blocked and stale records.
- Third-party usage: the current official, resolved-version TDS inventory and fixes are recorded in
  [`2026-09-28-v2s-terminal-activation-tds-third-party-usage-audit-codex.md`](2026-09-28-v2s-terminal-activation-tds-third-party-usage-audit-codex.md)
  and linked from the implementation design. This review does not claim that official-source review
  proves live runtime behavior.

## Source identity

```text
scripts/dev/r5-dev-runner.mjs SHA256=f10257417b88386da04ca79a93347ffbfc3f419145689b57f47f7ad095c00e19
scripts/dev/r5-dev-environment.mjs SHA256=2384a26de45bf7847ad8ce427739898f6d3b4c1d2d59130baa95976cfd34f64d
scripts/dev/r5-remote-java.mjs SHA256=fc7be98c9f6a6519929bbb6531887b05e4aa0f2cd91dbe77636ded17217cb45d
scripts/dev/r5-dev-command-wrapper.test.mjs SHA256=ff7aac7af95be63491dd42817380a897b1873f86934575071cfdc219431bb04f
contracts/policy/store-terminal-l2-admission.json SHA256=9e4f136958e21d6e6a2c739fc25f85d9914f508e0bf8ea0ded4c4df71e482e7f
scripts/test/store-terminal-l2-admission.mjs SHA256=5b6a066d36babb8557f138687e3061a3b35b012be5ac87bbde83bde3ef894348
scripts/test/store-terminal-l2-admission.test.mjs SHA256=e21b99073df02faa5eba64eade12b6f0fa5f235d92faedb9f4052fab2d70d9cc
L2 admission review SHA256=6d0229d9a38e615c2239b836a0fa8114a093b4405dd05fa076618e82f03ee340
TDS third-party audit SHA256=34aa2ee811d31155670f7acee1271a61d20fe31335db2dea7e43892995d0f047
implementation design SHA256=c158e2f7257e605a294c7208c526ef6cec6df478ad8506b30819af33c8f16be5
implementation plan SHA256=a01ec5b133d4098955bd693894b517249c16822a9bfbf3fb12bec3cf748f4ff1
requirements SHA256=35ef15fd0b0844426e30da43649a2cfa28136806b326c8b694205c34d1cf238a
```

## Evidence boundary and sequence

The first source-only CP-06 review returned `STEP_RECONCILIATION=MATCHED`, `M/S/N=0/0/0` from
fresh reviewer `/root/cp06_review_r1`. A second fresh read-only reviewer, `/root/cp06_review_r2`,
recomputed the current admission and policy digests, verified the six-case/36-control/22-UI
denominator and this record, and returned `STEP_RECONCILIATION=MATCHED`, `M/S/N=0/0/0`. It
confirmed that CP-06 source/focused closure is distinct from live proof, and that step 8's live
readiness/WS observation belongs to the later 6b/6c-admitted topology-preflight sequence. The
19/19 focused-test summary is transcript-derived rather than a saved standalone log; the second
reviewer accepted it only as local focused evidence, not as live DEV/TDS/WS/L2 proof.

No current-byte managed DEV, TDS readiness, tunneled WebSocket, backend-acceptance, Browser L2,
reset, seed or UAT run is claimed. They remain `NOT_RUN`. The whole-batch 6b and first-run 6c
admission are still mandatory before any managed dynamic execution. This CP reconciliation alone
does not authorize dynamic work.

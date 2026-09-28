# Batch 1 · R-12 static verify registration repair

```text
STATE=IMPLEMENTATION_REPAIR_COMPLETE_CP05_RECONCILIATION_MATCHED
SCOPE=R-12 capability and operation-binding static command registration
OWNER=MAIN_AGENT
THIRD_PARTY_AUDIT=COMPLETED_BEFORE_THIS_VERIFICATION
DYNAMIC_RUN=NOT_RUN
```

## Root cause and repair

The design's §12.3/Q2–Q3 ledger requires `capability-invariants` and `operation-handler-bindings` in `staticCommands`, which is shared by `scripts/verify --validate-only` and the default static phase. The commands themselves passed when invoked directly, but were absent from the verifier, so a standalone PASS did not prove that the required red fixtures ran through either verify mode.

Added four ordered entries to `tools/verify-gates/verify.mjs`:

1. `capability-invariants-self-test` and `capability-invariants`;
2. `operation-handler-bindings-self-test` and `operation-handler-bindings`.

The fixture self-tests precede their corresponding positive checks. All four run before `openapi-contracts`; the existing full materialization check also remains before them. `scripts/test/standards-enforcement-verify.test.mjs` now requires these labels and asserts their pairwise order and position before `openapi-contracts`. Because both verify modes consume `staticCommands`, this covers both modes without duplicating the commands elsewhere.

No direct `edge-codegen` command or Node suite was added: §12.3 already assigns `edge-codegen --check` to `openapi-contracts`/`contract-face`, and the Node test runner already owns the complete Node suite.

## Initial repair evidence (superseded by the follow-up below)

The `42/42` run in this section is historical evidence from the first repair pass. The
2026-09-28 follow-up below records the fresh CP-05 findings, their repair, and current-byte
`46/46` verification.

All raw command output is retained under `.runtime/r5/evidence/` for inspection. The full Node health suite reads the updated static-verifier regression test.

| Command | Result |
|---|---|
| `node --test scripts/test/standards-enforcement-verify.test.mjs` | exit 0; 6/6 pass |
| `node tools/capability-invariants/cli.mjs --self-test` | exit 0; `CAPABILITY_INVARIANTS_SELF_TEST=PASS`; terminal activation/credential negative fixtures pass |
| `node tools/capability-invariants/cli.mjs check` | exit 0; `CAPABILITY_INVARIANTS=PASS`; `MUTATING_OPERATIONS=172` |
| `node scripts/generate/operation-handler-bindings.mjs --self-test` | exit 0; `BP_U02_BINDING_SELF_TEST=PASS`; all enumerated red fixtures pass |
| `node scripts/generate/operation-handler-bindings.mjs --check` | exit 0; `BP_U02_BINDING_CHECK=PASS`; `CONTEXT_KIND_NEGATIVE=PASS`; 16 JSON + 16 Java files |
| `node scripts/test/test-health-entry-runner.mjs --node` | exit 0; 531/531 tests, 45/45 files |
| `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/verify --validate-only` | exit 0; `EXECUTED=42/42`; `R5_VERIFY_VALIDATE_ONLY=PASS`; static-only cleanup N/A. `r5-edge-materialize` duration: 7427 ms |
| `scripts/verify --validate-only` before CP-05 calibration | expected exit 1 at `openapi-contracts` with `BUDGET_PROJECTION_OPERATION_MISSING:cancelOperationsStoreTerminalActivation`; `r5-edge-materialize` duration: 8215 ms. This is the prescribed pre-calibration stop, not a green ordinary-mode baseline |

Raw output files:

- `.runtime/r5/evidence/terminal-activation-focused-verify-test-20260928.log`
- `.runtime/r5/evidence/terminal-activation-capability-invariants-self-test-20260928.log`
- `.runtime/r5/evidence/terminal-activation-capability-invariants-check-20260928.log`
- `.runtime/r5/evidence/terminal-activation-operation-bindings-self-test-20260928.log`
- `.runtime/r5/evidence/terminal-activation-operation-bindings-check-20260928.log`
- `.runtime/r5/evidence/terminal-activation-node-health-20260928-after-r12-gate-registration.log`
- `.runtime/r5/evidence/terminal-activation-identity-only-verify-20260928-after-r12-gates.log`
- `.runtime/r5/evidence/terminal-activation-normal-verify-20260928-pre-calibration.log`

Current source SHA-256:

- `tools/verify-gates/verify.mjs`: `4141b7b3717d448023e7a9acf56c4c46a949d92f5b00065815a894c56fdbe5e2`
- `scripts/test/standards-enforcement-verify.test.mjs`: `e49f1c3d9ad00fb467f8430a8ed4084c0de1adf07891c84e012c8ab7d20c6357`

Evidence output SHA-256 (logs retained under the ignored run-evidence directory):

- focused verifier test: `93c1f84e558a2fe95dd5e52b5829db0ff942f43a7769fd1c12266f82f6fb143c`
- capability self-test: `3d7779fb4d1710873daf5d1d2f7bbbe7d3d641fab4bf2f58cccb98534de61c58`
- capability check: `4e1c3385c87de8f523ea2c1fb3fa51e23fdc5cea2933406cfe00874de3d56e4d`
- operation-binding self-test: `99d9b834c446e9d47fb17c75f895dd2ae23623b8e2ac05408508952c4c6e7fb7`
- operation-binding check: `853f2f22734534777b33d2e7d4deb232d340e5d7a7fca9559e7c5fd93eb104eb`
- Node health suite: `b6f2ab6936caece1042063b4454c8efccbb6fd557562eebbe936b39882b7fa11`
- identity-only static chain: `bfd8b61f160e5a3630f2098c3614223470d0ed62a77009d06819b53b0542040a`
- expected normal-mode budget stop: `4a0a4786b97566fd31ab244a5efb4ce61d279a1a542a4a990d454a2c16a6ffb2`

`shasum -a 256` can recompute each value from its path. `scripts/verify` is a local static check, not a managed TDS or backend runtime; this repair did not start DEV, backend-acceptance, Testcontainers, L2, reset, or seed.

## Third-party source audit boundary

The prior exhaustive TDS package/API audit and official, dependency-version-matched source references are recorded in `2026-09-28-v2s-terminal-activation-tds-third-party-usage-audit-codex.md`. Its scope includes TDS production and test Java imports, the raw Node WebSocket client, runtime/test resolution, relevant Gradle plugins, protocol/framing/compression, Jackson parsing, JDBC notifications, lifecycle, Reactor buffer ownership, and resource limits. That audit is an API-use decision record; this file records the current static/regression results and does not upgrade the audit into real-process wire or backend-acceptance evidence.

## Required remaining gates

- Fresh CP-05 step reconciliation against current bytes.
- Whole-batch 6b and dynamic-run 6c before any first managed runtime.
- CP-05 calibration prerequisites and exactly three all-operation 296-identity reports before projection regeneration.
- First single-scenario backend-acceptance topology run, followed by the authorized full dynamic sequence and independent implementation review.

No dynamic gate is claimed by this repair record.

## CP-05 finding repair and current-byte re-verification · 2026-09-28

```text
STATE=REPAIRS_COMPLETE_CP05_RECONCILIATION_MATCHED
REVIEWER_FINDINGS=R5-S1,R5-S2,R5-N1,R5-N2
IDENTITY_ONLY_STATIC=PASS_46_OF_46
ORDINARY_PRE_CALIBRATION=EXPECTED_STOP_AT_OPENAPI_BUDGET_PROJECTION
CP05_STEP_RECONCILIATION=MATCHED; M/S/N=0/0/0; REVIEWER=/root/cp05_final_reconcile_r6
DYNAMIC_RUN=NOT_RUN
```

The fresh CP-05 reviewer found two missing static registrations, a duplicate runtime
`U01-codegen` invocation, and stale execution-status evidence. These were corrected before
any managed run:

- Added a true missing-emitter mutation to the M1 command-binding self-test. It removes the
  terminal activation emitter from an isolated registry and proves the normal validator emits
  `OPERATION_COMMAND_BINDING_EMITTER_MISSING` for the terminal operation.
- Registered both the M1 command-binding self-test/check and the module-dependency-registry
  self-test/check in the static verify command list. Tests assert their order, exact commands,
  and required positive/red markers. The checks precede the architecture checks and
  `openapi-contracts`.
- Removed runtime `U01-codegen`; `contract-face`/`openapi-contracts` already owns that exact
  generated-code check.
- Kept the earlier 35/35 and 42/42 entries as historical evidence; the execution-status file
  now opens with the current 46/46 result and the expected ordinary-mode budget stop.

Current-byte proof:

| Command | Result |
|---|---|
| `node --test scripts/test/standards-enforcement-verify.test.mjs` | exit 0; 6/6 |
| `node scripts/test/test-health-entry-runner.mjs --node` | exit 0; 531/531 tests, 45/45 files |
| `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/verify --validate-only` | exit 0; `EXECUTED=46/46`; nested terminal run `ter-local-static-59267-1790549650221`; `TERMINAL_STATIC=PASS`; cleanup `NOT_APPLICABLE_STATIC_ONLY` |
| `scripts/verify --validate-only` before CP-05 calibration | expected exit 1 at `openapi-contracts`; `BUDGET_PROJECTION_OPERATION_MISSING:cancelOperationsStoreTerminalActivation`; the newly registered emitter and module-registry checks ran first. This is the prescribed pre-calibration stop, not a green baseline. |

Evidence files and SHA-256:

- `.runtime/r5/evidence/terminal-activation-identity-only-verify-20260928-after-cp05-findings.log` — `2415804fb0a8bae45bbc545545f90a95d642cda37276bc4d060f837b7209595c`
- `.runtime/r5/evidence/terminal-activation-normal-verify-20260928-pre-calibration-after-cp05-findings.log` — `63c2f13cbf9e517b677c288ce19d35d370297f83fc797ed58bb2376e4110befa`

The official, dependency-version-matched TDS library audit remains recorded in
`2026-09-28-v2s-terminal-activation-tds-third-party-usage-audit-codex.md`. It is a source/API
audit and does not claim managed wire, backend-acceptance, or L2 runtime evidence. No managed
process was started by these static checks.

The fresh independent CP-05 reconciliation is preserved in
`2026-09-28-v2s-terminal-activation-batch-1-cp05-reconciliation-r6-codex.md`. It returned
`MATCHED`, `M/S/N=0/0/0`, and ran no builds, tests, scripts, or managed runtime. CP-05 is closed;
the whole-batch 6b and dynamic-run 6c gates still precede any managed run.

## Current-byte verification follow-up · 2026-09-28

```text
SCOPE=STAGE_1_ONLY
ROUTE_BINDING_GENERATOR=PASS; node scripts/generate/operation-handler-bindings.mjs --write; 32 generated outputs
ROUTE_BINDING_SELF_TEST_AND_CHECK=PASS
IDENTITY_ONLY_STATIC=PASS; R5_VERIFY_VALIDATE_ONLY=PASS; EXECUTED=46/46
NESTED_TERMINAL_STATIC=PASS; runId=ter-local-static-16148-1790587733527; 20/20 terminal-data-server tests passed
DYNAMIC_LATEST=PREVIOUS_RUN_ONLY; latest managed run predates the regenerated binding/test bytes
```

The stale catalog-inventory route-source digest was repaired through its owning generator;
the binding registry and JSON/Java projections were not hand-edited. The generator self-test
and `--check` then passed, with all 296 operation identities retained.

The first identity-only retry stopped in `tds-constructor-assembly`: the TDS connection test
still required `MESSAGE_TOO_BIG` as the reason for close code 1009, while D-42 and the shared
protocol prescribe only the 1009 code. A source-wide TDS test scan found the related exact
standard-reason assertions in `TdsPmdOfferGateTest` and `TdsReservedBitsGateTest`; these tests
now preserve the required 1009-code assertions and do not lock the reason text. The reserved-bit
focused test still proves the invalid frame does not reach inbound application handling, without
fixing a close tuple D-42 leaves to the library. The repair changed test oracles only; no
production close behavior was changed.

The first three-class focused rerun had a compile failure because `CloseStatus` was still used in
the Mockito matcher after its import was removed. The import was restored and the same focused
suite passed. This first failure remains visible in the command transcript; the final complete
TDS suite passed 20/20 through the static verifier.

The next identity-only run stopped at `backendJavaUtf8LineLimit`. The Gradle task emits only
`violations.take(3)` per project, so after splitting its first five displayed lines, a complete
read-only byte scan matching the task's `src/**/*.java` scope and exclusions found two more.
All seven lines were split without changing behavior: three in
`TdsWebSocketHandlerTransportFailureTest.java`, two in
`TerminalConnectionContractScenarios.java`, one in `TerminalConnectionFrameCodecTest.java`,
and one in `TerminalConnectionProtocol.java`. The full byte scan returned no lines over 120;
the terminal-data-server and business-server owning tasks passed.

The following identity-only run exposed the rest of that aggregate's formatter diff. The TDS
Spotless diff enumerated seven files: `TdsPmdOfferGate.java`,
`TdsWebSocketPipelineInstaller.java`, `TerminalConnectionFrameCodecTest.java`,
`TerminalConnectionProtocolTest.java`, `TdsPmdAllocationTest.java`,
`TdsReservedBitsGateTest.java`, and `TdsWebSocketHandlerTransportFailureTest.java`. The
versioned formatter was run only for the TDS Java source set; every diff was inspected against
the pre-format snapshot and contained import ordering, whitespace, or line wrapping only. No
logic changed. The full backend `spotlessCheck` passed afterwards.

Current-byte identity-only proof:

| Command | Result |
|---|---|
| `node scripts/generate/operation-handler-bindings.mjs --write` | exit 0; `BP_U02_BINDING_GENERATION=PASS`; 16 JSON + 16 Java = 32 files |
| `node scripts/generate/operation-handler-bindings.mjs --self-test` | exit 0; `BP_U02_BINDING_SELF_TEST=PASS`; all enumerated red fixtures passed |
| `node scripts/generate/operation-handler-bindings.mjs --check` | exit 0; `BP_U02_BINDING_CHECK=PASS`; `CONTEXT_KIND_NEGATIVE=PASS` |
| `./gradlew :apps:backend:terminal-data-server:test --tests 'com.catering.v2s.terminaldataserver.websocket.TdsWebSocketConnectionTest' --tests 'com.catering.v2s.terminaldataserver.websocket.TdsReservedBitsGateTest' --tests 'com.catering.v2s.terminaldataserver.websocket.TdsPmdOfferGateTest'` | exit 0 after restoring the still-used `CloseStatus` import |
| `./gradlew :apps:backend:terminal-data-server:backendJavaUtf8LineLimit :apps:backend:catering-business-server:backendJavaUtf8LineLimit` | exit 0 after the full source-set scan returned zero over-limit lines |
| `./gradlew :apps:backend:spotlessCheck` | exit 0 after reviewing the complete TDS formatter diff |
| `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/verify --validate-only` | exit 0; `EXECUTED=46/46`; nested terminal static run `ter-local-static-16148-1790587733527`; TDS tests 20/20 |

The complete static log is retained at
`.runtime/r5/evidence/terminal-activation-identity-only-verify-20260928-after-full-spotless-repair.log`
with SHA-256 `a8e6fc15aa7c61a49a01883540c7be946e056a5250654ebeec2e7d08d7f0aba9`. This is
static evidence only. Refresh CP-05 and whole-batch 6b against the current bytes before
calibration or another managed run; the earlier managed run does not match this generated/test
source set.

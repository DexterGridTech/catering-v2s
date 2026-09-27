# Batch 1 whole-scope reconciliation follow-up — M1 and capacity

```text
SOURCE_REVIEWER=whole_batch_6b_reconciliation
SOURCE_VERDICT=REPAIRED; CURRENT_PLAN_BYTES_RECHECK_PENDING
SOURCE_M_S_N=0/0/0 (prior pre-status-update review)
REVIEWER_KIND=MAIN_AGENT_REPAIR_RECORD
SOURCE_REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
SCOPE=6B-M1,6B-S1
REQUIREMENT_SOURCE_EDITED=false
FOCUSED_PROOF=PASS
WHOLE_BATCH_RECHECK=PENDING_CURRENT_PLAN_BYTES
```

## 1. Boundary

This record tracks the two confirmed findings from the initial whole-batch review: the TDS close-reason/protocol/DDL mismatch, and the delegated DEV capacity configuration. A fresh read-only whole-batch reconciliation of the preceding plan bytes returned `MATCHED`, `M/S/N=0/0/0`; a new reviewer is checking the current status-transcribed plan and refreshed CP-06/L2 admission. Either verdict is source/focused proof and does not authorize or claim a dynamic run by itself.

## 2. Finding intake and repair

### 6B-M1 — Close reason and protocol close code

**Status:** `CONFIRMED_AND_REPAIRED; FOCUSED_PROOF=PASS; WHOLE_BATCH_RECHECK=MATCHED`.

- The shared protocol distinguishes application close reasons from standard RFC close reasons. `MESSAGE_TOO_BIG` must use the standard `1009` close tuple; it cannot be sent through the application `4000` mapper.
- `TdsWebSocketHandler` now routes payload overflow through `TdsWebSocketConnection.closeStandard(1009)`. Application reasons still use `applicationClose`.
- The `latest_state.close_reason` constraint now accepts every application and standard protocol reason, including `NETWORK_ERROR`, `PROTOCOL_ERROR`, and `MESSAGE_TOO_BIG`.
- `TdsConnectionCloseReasonContractTest` compares the DDL set with both protocol sets; `TdsWebSocketConnectionTest` asserts the standard `1009/MESSAGE_TOO_BIG` tuple.

### 6B-S1 — Configurable DEV capacity

**Status:** `CONFIRMED_AND_REPAIRED; FOCUSED_PROOF=PASS; WHOLE_BATCH_RECHECK=MATCHED`.

- Dexter delegated the choice of a modest DEV budget to the main agent and required file-based configuration with README instructions.
- The main agent selected `512 MiB` RSS, `4` unauthenticated connections, and `8` tracked sessions in `scripts/env/tds-dev-capacity.json`. The 12 configured slots reserve 12 MiB under the 1 MiB-per-connection logical bound. This is a low-load DEV choice only; it is not a production capacity calculation.
- DEV and backend-acceptance load this one file and inject the two required TDS environment keys. Missing, malformed, non-integral, zero, or out-of-range values fail closed. TDS process control and backend-acceptance evidence bind to the configured budget.
- Managed DEV readiness samples `/proc/<pid>/status` for the manifest-owned TDS process and fails above the budget. Backend-acceptance records RSS at readiness and before stop and rejects either over-budget sample. No reset, seed, local Java, or remote run was performed for this repair.
- `apps/backend/terminal-data-server/README.md` names the exact config path, field meanings, current values, edit procedure, restart requirement, and the restriction that these values do not constitute a production capacity claim.

## 3. Focused proof and current status

Focused Node tests, Node syntax checks, the TDS close-reason unit tests, and the applicable identity-only static validation have now been run against these repaired implementation/configuration bytes. Their commands and results are recorded below. A separate fresh whole-batch recheck has confirmed the repairs and complete batch source alignment.

The initial static attempt preserved the first failure `CODE_LAYOUT=FAIL / REPOSITORY_ROOT_DIRECTORY_NOT_ALLOWED:config`. The new top-level `config/` directory violated the code-layout closed root set. The capacity source is now `scripts/env/tds-dev-capacity.json`, under the existing environment-tools root; all runtime launchers, acceptance checks, README links, plan/design references, and this record use that path. A whole-repository path search found no remaining `config/runtime/tds-dev-capacity` references; `scripts/check/code-layout` passes.

The next static attempts found two real Java formatting issues before reaching the later checks: `TdsWebSocketHandler.java` had two 122-byte lines, and `TdsConnectionCloseReasonContractTest.java` differed from Palantir Java format. The broader changed-backend formatter check then found formatting differences in `TdsAcceptanceProcess.java`. The line breaks were corrected and the existing Gradle `spotlessApply` formatter was applied only to the TDS and business-server modules. The four current module checks (`spotlessJavaCheck` and `backendJavaUtf8LineLimit` for each module) now pass; the formatting failure family is closed for these changed backend sources.

Current focused/static proof:

| Check | Current-byte result |
|---|---|
| `node --check` for the capacity loader, DEV runner, remote Java runner, and backend-acceptance runner/tests | PASS |
| `node scripts/dev/r5-remote-java.mjs --self-test` | `R5_REMOTE_JAVA_SELF_TEST=PASS`; TDS red controls `WS_PORT,START_TICKS,RSS_BUDGET` |
| `node --test scripts/dev/r5-dev-command-wrapper.test.mjs scripts/test/r5-remote-testcontainers.test.mjs` | 48/48 PASS |
| `scripts/check/code-layout` and whole-repository old-path search | PASS; no old config path remains |
| TDS `TdsConnectionCloseReasonContractTest` + `TdsWebSocketConnectionTest` | 2/2 tests, 0 failures, 0 errors |
| `:apps:backend:catering-business-server:compileTestJava` | BUILD SUCCESSFUL |
| TDS and business-server `spotlessJavaCheck` + `backendJavaUtf8LineLimit` | BUILD SUCCESSFUL |
| `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/verify --validate-only` | `R5_VERIFY_VALIDATE_ONLY=PASS`, `EXECUTED=35/35`, `TERMINAL_STATIC=PASS`; static-only cleanup is `NOT_APPLICABLE` |

The latest `scripts/verify` run completed in about 3 minutes and its nested terminal static run was `ter-local-static-32206-1790495667521`. This is static evidence only. Ordinary budget-mode verify remains deferred until CP-05 calibration; no managed DEV, SSH tunnel, Testcontainers/backend-acceptance run, L2, reset, seed, UAT, or production operation has run for this repair.

```text
CURRENT_BYTE_LATEST_RUN=IDENTITY_ONLY scripts/verify --validate-only; PASS; 2026-09-27T07:54Z start; EXECUTED=35/35; nested terminal run ter-local-static-32206-1790495667521
LAST_PASS=IDENTITY_ONLY scripts/verify --validate-only; same source bytes for implementation/configuration; repair-record text was updated afterward
DEV=NOT_RUN
BACKEND_ACCEPTANCE=NOT_RUN
SSH_TUNNEL=NOT_STARTED
TESTCONTAINERS=NOT_STARTED
L2=NOT_RUN
RESET=NOT_RUN
SEED=NOT_RUN
```

## 4. Prior whole-batch 6b recheck and historical capacity-note disposition

- Fresh read-only reviewer `/root/terminal_activation_6b_recheck` returned `WHOLE_BATCH_6B_RECONCILIATION=MATCHED`, `M/S/N=0/0/0` against the pre-status-update plan bytes. The reviewer declared it first formed the verdict from canonical requirements/design/IA/memory, current source and evidence, and only then read this repair record. Its full intake, six-dimensional route, blind-first declaration, evidence and limits are recorded in `doc/review/platform/2026-09-27-v2s-terminal-activation-batch-1-6b-reconciliation-codex.md`; fresh confirmation against the current plan bytes is pending.
- The earlier `doc/review/platform/2026-09-27-v2s-terminal-activation-batch-1-cp05-capacity-preflight-repair-codex.md` and CP-05 review describe the then-current `LOCAL_REQUIRED_ENVIRONMENT` approach and missing capacity values. Those statements were accurate for that earlier byte state, before Dexter delegated selection of a modest DEV budget and required repository-file configuration. Current source and README use `scripts/env/tds-dev-capacity.json`; treat the older wording as historical, not as current topology evidence.
- The current configured values are 512 MiB RSS, 4 unauthenticated connections, and 8 tracked sessions. These are a low-load DEV choice, not a production capacity claim. The first managed startup remains subject to the full topology preflight and current dynamic admission gates.

```text
WHOLE_BATCH_6B_RECONCILIATION=PRIOR_BYTES_MATCHED; CURRENT_PLAN_BYTES_RECHECK_PENDING
L2_SCRIPT_ADMISSION=REVIEW_PENDING_FOR_CURRENT_DIGEST
DEV=NOT_RUN
BACKEND_ACCEPTANCE=NOT_RUN
SSH_TUNNEL=NOT_STARTED
TESTCONTAINERS=NOT_STARTED
L2=NOT_RUN
RESET=NOT_RUN
SEED=NOT_RUN
```

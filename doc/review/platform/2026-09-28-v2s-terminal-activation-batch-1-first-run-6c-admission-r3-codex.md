# Terminal activation batch 1 · first current-byte run 6c admission r3

```text
REVIEW_TARGET=FIRST_DYNAMIC_RUN_6C_ADMISSION
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/stage1_6c_admission_r3
ADMISSION_VERDICT=PASS
M/S/N=0/0/0
EXACT_ADMITTED_INVOCATION=scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight
BUSINESS_SCENARIO_COUNT=1
WHOLE_BATCH_6B=MATCHED; source set=467 files/43c6578ad33ec7483ca60147c782466d0132acd79631c64e757c97c99f9fc988
CP05_RECONCILIATION=MATCHED; M/S/N=0/0/0; report=2026-09-28-v2s-terminal-activation-batch-1-cp05-reconciliation-r7-codex.md
REMOTE_INVENTORY_TOPOLOGY_BUSINESS_TDS_CONTRACT_CLEANUP=NOT_YET_OBSERVED
```

## Fresh admission verdict

The reviewer independently inspected the accepted requirements, service-shape decision,
implementation plan, current CP-05 and whole-batch 6b records, exact backend-acceptance entry,
R3-M1/topology preflight path, business scenario and TDS contract executor. It returned
`PASS`, `M/S/N=0/0/0` for the single exact invocation in the header. It did not run tests, builds,
scripts, resource probes, SSH, remote inventory or runtime commands.

The PASS admits only that invocation. It does not pre-assert remote resource inventory, live
topology, TDS CONTRACT, BUSINESS, database-operation counts or cleanup. The managed runner must
perform and persist the run-scoped local/remote preflight before remote workspace preparation; any
failed preflight is the run result and must not be repeated without diagnosing its exact failure.

## Business denominator and separate TDS contracts

The sole business scenario is `storeTerminalActivationBusinessPrecedence`; the scenario covers:

1. malformed credential secret returns validation failure without echoing the marker, leaves the
   binding inactive and writes no terminal-binding audit;
2. first valid activation returns generation 1;
3. while the store is disabled, a different device's new activation is denied with the
   store-disabled reason;
4. same secret/device retry returns original generation 1;
5. same device with a fresh secret creates generation 2;
6. after re-enabling the store, owner readback shows active generation 2 and exactly two audit rows.

The topology preflight separately exercises the real R3-M1 registration race and one real
10-second PostgreSQL pause/recovery through WebSocket. Those are TDS `CONTRACT` evidence and do
not add business operations/scenarios. Required live observations include two isolated business
contexts on distinct HTTP ports, a separate REACTIVE TDS process with its own resolved classpath
and WS port, one shared PostgreSQL endpoint/listener, one database-operation sink, remote Node
22.23.2 with the imported built-in modules, correlated real HTTP/WebSocket traffic, run-scoped
resource identity, and clean exit.

## Current-byte binding and evidence limits

- Whole-batch 6b is `MATCHED`, `M/S/N=0/0/0`, on 467 files with digest
  `43c6578ad33ec7483ca60147c782466d0132acd79631c64e757c97c99f9fc988`; the canonical r2 source
  inventory command was reproduced by the main agent.
- CP-05 is `MATCHED`, `M/S/N=0/0/0`, in the fresh r7 record linked in the header.
- Identity-only `scripts/verify --validate-only` is static `PASS`, 46/46. Ordinary pre-calibration
  verify is expected to stop at `openapi-contracts` with
  `BUDGET_PROJECTION_OPERATION_MISSING:cancelOperationsStoreTerminalActivation`; this is not a
  green ordinary-mode baseline.
- No managed run has yet been performed on the current generated-binding/test/format source bytes.
  The prior managed run is historical and is not upgraded to current-byte evidence.
- The review itself was read-only and did not observe live remote inventory, topology, scenario
  results, database operations or cleanup.

## Scope

Stage 1 only. This admission does not authorize TER terminal optimization, batch 2, batch 3,
Browser L2, reset, seed, UAT, production deployment, device operation or Git actions.

# Terminal activation batch 1 · CP-05 reconciliation r7

```text
CP=CP-05
REVIEW_KIND=STEP_RECONCILIATION
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/stage1_cp05_reconcile_current
STEP_RECONCILIATION=MATCHED
M/S/N=0/0/0
REVIEW_SCOPE=REQUIREMENTS+DESIGN/IA+PROJECT_MEMORY+CURRENT_CP05_SOURCES+SAVED_CURRENT_BYTE_EVIDENCE
SOURCE_SNAPSHOT_FILES=165
SOURCE_SNAPSHOT_SHA256=5c716b0903779b3d4b8cbc64a42628e86509f923b397c8d421f0e348c4d75cb9
TEST_BUILD_SCRIPT_RUNTIME=NOT_RUN_BY_REVIEWER
```

## Verdict

Fresh reviewer `/root/stage1_cp05_reconcile_current` compared D-42/D-43 requirements, CP-05
design and plan, the relevant project-memory standards, acceptance harness, TDS process/runner,
Node WebSocket client, protocol/tests, operation-binding generated outputs, execution status and
the ordinary pre-calibration verify log. It returned `MATCHED`, `M/S/N=0/0/0`.

## Key current-byte evidence

- Requirement/protocol source: `contracts/protocol/terminal-connection-protocol.json` defines
  unknown fields as ignored; the codec enforces required known fields and its tests cover unknown
  AUTHENTICATE/PING fields, malformed JSON, trailing content and size limits.
- Producer/consumer: `scripts/test/terminal-ws-wire-client.mjs` injects the forward-compatible
  fields and expects `SESSION_READY`/same-sequence `PONG`; TDS codec tests cover the receiving
  behavior.
- Runtime topology: `TdsAcceptanceProcess.java` starts a separate reactive TDS process, records
  its runtime classpath, boot JAR hash, PID/start identity, readiness, RSS, log path and cleanup;
  business acceptance does not load TDS runtime classes on its own classpath.
- Scenario execution: `TerminalConnectionContractScenarios.java` covers the relevant V-criteria,
  writes JSONL results and emits the expected CONTRACT marker; the R3-M1 red control observes the
  registration race without directly editing binding state or issuing manual NOTIFY.
- TDS transport diagnostic behavior is paired with
  `TdsWebSocketHandlerTransportFailureTest.java`; PMD negotiation, decoded-size bounds and bounded
  inflation are covered by the focused TDS tests.
- Current operation-binding registry and generated index both contain 296 operations; 32 generated
  JSON/Java outputs include the terminal activation bindings with the required owner, face, context,
  transaction and adapter declarations.
- The ordinary `scripts/verify --validate-only` log records the expected pre-calibration stop at
  `openapi-contracts` with
  `BUDGET_PROJECTION_OPERATION_MISSING:cancelOperationsStoreTerminalActivation`; it is not a green
  ordinary-mode baseline.

The reviewer recorded these source hashes:

| Source | SHA-256 |
|---|---|
| `TerminalConnectionContractScenarios.java` | `49c2c4161670784c93b8af4026dc621e68c4cb414fcbad927c6567a86515e5a3` |
| `TdsAcceptanceProcess.java` | `10d00ac9f4b632485aae57c423941ede51e67d278b70af14eef7470b3131ff90` |
| `terminal-ws-wire-client.mjs` | `11a1740dd3ae08da2675477bf7f8250e53baa7a3f9127e61e11ae53fd17b079b` |
| `TdsWebSocketHandlerTransportFailureTest.java` | `4aaaaa816dc6ac6d8cfdc4d90f3ebed6bc5def03eb38557f371bd90c533da53e` |
| generated operation bindings, aggregate | `1e6d64c201de6caf64d8995fe540b77c0b2d349b246ddc8b17b5dd77f5a5fcf1` |

## Finding disposition and boundary

- No M/S/N findings.
- A stale exact-properties phrase remains in one design passage, but the later D-43 requirement,
  protocol, codec, focused tests and Node producer/consumer consistently implement unknown-field
  ignore. It is retained as a documentation observation, not a CP-05 mismatch.
- Review was read-only. It did not run tests, builds, scripts, remote commands, Testcontainers,
  DEV, L2, reset or seed. Managed acceptance proof remains separate and is admitted by 6c.
- Scope is CP-05 only and Stage 1 only; it does not include TER terminal optimization or later
  batches.

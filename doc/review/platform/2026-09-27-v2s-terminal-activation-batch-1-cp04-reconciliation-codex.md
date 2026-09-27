# Terminal activation batch 1 · CP-04 stage reconciliation

```text
CP=CP-04
CP_RECONCILIATION=MATCHED
M/S/N=0/0/0
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/cp04_stage_reconcile_current
REVIEW_SCOPE=COMPLETE_CP_STAGE
REVIEW_MODE=READ_ONLY
EVIDENCE_TIER=LOCAL_FOCUSED_PLUS_SOURCE_READ
```

## Scope and dimensions

CP-04 is the complete planned stage for single-node TDS transport, authentication/session actors, compression and frame bounds, connection/session capacity, PostgreSQL notification and recovery, coalesced state writes, readiness and graceful drain. The stage was reconciled once after its complete focused proof; CP-internal files, edits, tests and repairs are not separate reviewer gates.

The fresh reviewer checked:

1. **Requirements:** terminal connection authentication, close semantics, heartbeat/state bounds, revocation ordering, graceful shutdown, and V-S1/V-S4/V-S8/V-S9/V-S10/V-S12/V-S14.
2. **Design and plan:** CP-04 invariant/FORBID/RECALL; the TDS implementation shape and local proof face; remaining real remote WebSocket/PostgreSQL proof reserved for later authorized dynamic steps.
3. **Project memory and standards:** the six-dimensional backend/runtime route, all six kernels, all matched routed source documents, the CP-boundary review rule, test/cleanup evidence limits, and main-agent-write/reviewer-read-only boundary.

## Current focused proof

```text
RUN_ID=LOCAL-TDS-CP04-20260927T0233Z
MANAGED_RUN_ID=NONE
OBSERVED_AT=2026-09-27 02:33:05–02:33:07 UTC (JUnit XML timestamps)
COMMAND=./gradlew :apps:backend:terminal-data-server:test :apps:backend:terminal-data-server:spotlessJavaCheck :apps:backend:terminal-data-server:verifyTerminalConnectionProtocolResource --no-daemon --console=plain
RESULT=BUILD SUCCESSFUL; 70 tests, 0 failures, 0 errors, 0 skipped; spotlessJavaCheck PASS; protocol resource digest check PASS
XML=12 files under apps/backend/terminal-data-server/build/test-results/test/
```

The TDS test runtime has no Testcontainers dependency or container test source. This local focused run did not launch TDS, PostgreSQL, SSH, a tunnel, Testcontainers, DEV, L2, reset or seed.

## Reconciled facts

- Both `V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS` and `V2S_TDS_MAX_TRACKED_SESSIONS` are required positive integers and are validated before readiness; authentication/drain deadlines and 65,536-byte frame/message limits are fixed by settings.
- `TdsPmdOfferGate` normalizes only supported permessage-deflate offers on the original Netty request. `TdsReservedBitsGate` rejects residual RSV bits with 1002 and oversize messages with 1009 before application parsing or authentication.
- The real TDS handler enforces handshake/authentication deadlines and unauthenticated permits. Per-terminal actors serialize credential verification, registration, replacement, notification/recovery and close. Tracked-session permits cover active sessions and pending disconnect persistence.
- PostgreSQL listener and bounded recovery reconcile binding generations; coalesced heartbeat writes keep the latest value and disconnects pending until persisted.
- Shutdown order is refusal of new connections, readiness refusal, pending-attempt close, bounded active-session drain, WebServer stop, state writer, then listener. Current focused tests include the lifecycle ordering assertions.
- Activation remains a public, permission-free HTTP operation; a TDS admission cap is a transport resource constraint, not user authorization.

## Evidence anchors

- Complete-stage boundary and work: `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md:31,38`.
- CP-04 invariant, FORBID and failure examples: `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md:233-234`.
- Configuration and capacity: `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/config/TdsRuntimeSettings.java:29-87`.
- PMD negotiation and RSV/size enforcement: `TdsWebSocketConfiguration.java:23-29`; `TdsPmdOfferGate.java:51-55,78-94,139-147`; `TdsReservedBitsGate.java:37-67`.
- Handler and actors: `TdsWebSocketHandler.java:88-100,107-129,181-192,223-289`; `TdsTerminalSessionActors.java:252-377,398-455,479-496`.
- Listener/recovery: `TdsBindingRevocationListener.java:91-100,105-141`.
- Drain order: `TdsGracefulShutdownLifecycle.java:75-95,125-126`; tests `TdsGracefulShutdownLifecycleTest.java:44-52,77-80`.
- Focused XML: all 12 `TEST-*.xml` files under `apps/backend/terminal-data-server/build/test-results/test/` (70/70).
- CP-level memory rule: `AGENTS.md:62`; `project-memory/operations/implementation-source-reread-discipline.md:17-18`; `project-memory/decisions/independent-subagent-adversarial-review.md:65-67`.

## Reviewer result and boundary

The fresh reviewer formed its verdict from current requirements, design, memory, production/test source and current TDS XML before consulting the historical CP-04 work report. It returned `CP_RECONCILIATION=MATCHED`, `M/S/N=0/0/0`, with no findings. The verdict closes only the CP-04 source/design/memory reconciliation and the local focused proof. Real remote WebSocket/PostgreSQL acceptance, listener interruption and outage behavior, managed cleanup, and the overall batch 6b reconciliation remain unproven and are reserved for their planned authorized gates.

The reviewer also found a separate business-app JUnit XML with one failure, timestamped `2026-08-30T08:28:26Z`. It predates the current run and is not current CP-04 proof or a current-byte test result; it is not reported as a fresh failure. The reviewer ran no tests, builds, gates, services or remote actions.

## Source snapshot

Main-agent SHA-256 read immediately before CP-04 status transcription:

| Source | SHA-256 |
| --- | --- |
| Requirements | `35ef15fd0b0844426e30da43649a2cfa28136806b326c8b694205c34d1cf238a` |
| Implementation design | `a469340e665f0ccbc592f31aebd4501adb9ef10979eb2893ba20ed6e1d9ac959` |
| Implementation plan before status transcription | `e0f6940b20e4a8d349b1b95ad95216b4310c51a78b1ffdcb93e734b6638b84de` |

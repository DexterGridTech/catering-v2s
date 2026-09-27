# Terminal activation batch 1 · TDS diagnostic repair

```text
SCOPE=TDS_AND_ACCEPTANCE_DIAGNOSTICS_ONLY
IMPLEMENTATION=AUTHORIZED_IN_PROGRESS
REQUIREMENT_SOURCE_EDITED=false
WHOLE_BATCH_VERDICT=NOT_ISSUED
```

## Preserved first failure

```text
RUN_ID=r5-tc-1790514726970-30692
TIME_UTC=2026-09-27T13:12:06.970Z–13:13:45.381Z
COMMAND=scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight
RESULT=FAIL; BUSINESS=NOT_RUN; CLEANUP=PASS
FAILURE_CATEGORY=TEST_IOEXCEPTION_IOEXCEPTION_STREAM_CLOSED
BROKEN_BOUNDARY=TerminalConnectionContractScenarios.SessionProbe.awaitClose
SIGNAL=ProcessBuilder$NullOutputStream.write -> BufferedOutputStream.flush -> SessionProbe.awaitClose
```

The acceptance Node child can finish after handling a WebSocket close while Java concurrently writes or flushes the next stdin control command. The probe surfaced only `Stream closed` and did not retain the child's bounded protocol result, so the test harness lost the actual close outcome. The preserved JUnit failure was a probe-exit race; it did not establish a TDS business defect.

## Root repair and diagnostic coverage

- `TerminalConnectionContractScenarios.SessionProbe` checks child liveness before and after control writes/flush/close, captures and validates the bounded JSON result if the child exits in that interval, and races marker waits against child exit. It verifies the expected close code/reason and correlates the close to the same `SESSION_READY.sessionId`.
- The Node wire probe logs safe, stable close/failure stages with a correlation marker. It never logs a credential, authorization value, raw frame, or arbitrary error message.
- `TdsWebSocketConnection` now logs `tds_ws_close_started` before sending the close frame, with connection id, session id, protocol close code and allowlisted reason. This is the common transport owner for cancellation, replacement, drain, authentication rejection and protocol closes.
- `TdsTerminalSessionActors` separately logs `tds_session_connection_closed` with generation for an unexpected peer/network close while the session is still active.
- The detailed design §10.5 and backend-acceptance structural tests describe and require both TDS close events, their ordering/fields, the probe-exit handling, and the secret-free boundary.
- One reusable project-memory rule covers parent-controlled child-result preservation across exit races. Task-specific run IDs and diagnosis remain in this delivery record.

The first successful run showed why a transport-owner log is needed: the actor detaches a revoked session before the socket completion callback, so the callback's `tds_session_connection_closed` event correctly does not fire for that commanded close. The close-start event is attached to the connection's close owner and therefore records both commanded and rejected closes.

## Focused gate failures and repair

| Preserved signal | Root cause | Repair and current evidence |
|---|---|---|
| `BACKEND_JAVA_UTF8_LINE_LIMIT` in the new TDS log/test code | New structured log and exception lines exceeded the 120-byte Java source limit. | Wrapped the message and exception lines. Both modules' UTF-8 line-limit tasks pass. |
| `spotlessJavaCheck` on the TDS actor, actor test and acceptance probe | The new edits did not initially match the repository formatter's expression layout. | Applied only the exact reported layout changes. Both module Spotless checks pass. |
| Node structure test expected one contiguous logger literal | The valid logger template uses adjacent Java string literals to meet the line limit. | Asserted the event name and field template independently within the owning close method. Node structure/wire suite passes 25/25. |

These were local formatting/assertion failures, not converted into behavioral PASS. Each was fixed at its owning source/test and rechecked.

## Current-byte evidence

Focused local checks after the final `tds_ws_close_started` source edit:

```text
COMMAND=./gradlew :apps:backend:terminal-data-server:backendJavaUtf8LineLimit :apps:backend:terminal-data-server:spotlessJavaCheck :apps:backend:terminal-data-server:test --tests com.catering.v2s.terminaldataserver.session.TdsTerminalSessionActorsTest --tests com.catering.v2s.terminaldataserver.websocket.TdsWebSocketConnectionTest :apps:backend:catering-business-server:backendJavaUtf8LineLimit :apps:backend:catering-business-server:spotlessJavaCheck :apps:backend:catering-business-server:compileTestJava --no-daemon --console=plain
RESULT=BUILD SUCCESSFUL; 38 tasks; 6 executed

COMMAND=node --test scripts/test/backend-acceptance-structure.test.mjs scripts/test/terminal-ws-wire-client.test.mjs
RESULT=PASS; 25 tests; 0 failures

COMMAND=scripts/check/project-memory
RESULT=PROJECT_MEMORY_CHECK=PASS
```

The last complete identity-only `scripts/verify --validate-only` passed 35/35 as run `ter-local-static-56627-1790515894553`, before the final `tds_ws_close_started` edit. Treat that full static result as stale relative to the final close-start code; the changed Java and Node surfaces have the focused proof above. Do not claim a full verify on the final bytes from that earlier run.

Managed positive verification on the final bytes:

```text
RUN_ID=r5-tc-1790516314218-64728
TIME_UTC=2026-09-27T13:38:34.218Z–13:40:15.354Z
COMMAND=scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight
BUSINESS=PASS; CONTRACT=PASS; DB_OPERATIONS=7; DISCOVERED=195; SELECTED=1; HTTP_SUCCESS=1; REAL_BUSINESS_ASSERTIONS=1
TDS_CONTRACT=PASS; DISCOVERED=3; PASS=3; FAIL=0
CLEANUP=PASS; remote process/workspace and Testcontainers containers/volumes/queries all PASS
DEV_WAS_RUNNING=false; DEV_STOP=NOT_RUN; DEV_RESTORE=NOT_APPLICABLE
```

The run manifest is `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790516314218-64728/run-manifest.json`. The archived TDS log `tds-process.log.gz` contains `tds_ws_close_started` for the real V-S10 `ACTIVATION_CANCELLED` close, the V-S12 new-authentication `SERVER_ERROR`, the post-recovery `ACTIVATION_CANCELLED` close, and the invalid-credential topology probe. The TDS CONTRACT result records the V-S12 PostgreSQL pause at 11,790 ms, one PONG during outage, and the new-authentication close at 5,131 ms. No credential, device identifier or message body was added to those diagnostic fields.

The immediately preceding managed run `r5-tc-1790516064873-59837` also passed BUSINESS, TDS CONTRACT 3/3 and cleanup, but predates `tds_ws_close_started`; it was used to confirm the actor callback did not represent an owner-initiated close.

## R3-M1 expected red-control evidence

```text
RUN_ID=r5-tc-1790516560304-69487
TIME_UTC=2026-09-27T13:42:40.305Z–13:44:49.546Z
MUTATION=tds-registration-pending-generation-check; replaceCount=1; remote staging only
EXPECTED=HTTP=200; BUSINESS=PASS; TDS_VS10_REGISTRATION_RACE_RED_CONTROL; cleanup=PASS
RUNNER=PASS; MUTATION_VERDICT=PASS; RESOURCE_CLEANUP=PASS
```

The V-S10 TDS result is exactly `TDS_VS10_REGISTRATION_RACE_RED_CONTROL`, with
`sessionReadyObserved=true` and wire-client category `TERMINAL_WIRE_SOCKET_READ_TIMEOUT`. The selected
business operation passes with one real business assertion. The TDS topology probe also passes. The
Gradle test `registrationRaceRedControlMutationMustBeCaught()` is intentionally marked failed by its
`assertFalse(registrationRaceRedControlCaught)` assertion when the exact red mutation is caught; the
managed runner checks the JUnit failure, mutation marker, business result and cleanup, then marks the
managed mutation verdict PASS. `run-manifest.json` records `testExecution.expectedFailure=true`, the
exact expected category, `productionMutation.verdict=PASS` and cleanup PASS. This is the expected red
control protocol, not an unclassified production or harness failure.

## Boundary

This record closes the first harness failure and verifies the new TDS close diagnostics on a real managed run. It is not a whole-batch `GO`, a calibration result, full backend-acceptance result, L2 admission, reset/seed authorization, or delivery verdict. Batch 1 remains `AUTHORIZED_IN_PROGRESS`; remaining stages continue under the implementation plan. L2, reset and seed remain unrun here.

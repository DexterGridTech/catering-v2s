# Batch 3 implementation 13c reconciliation

`13C=MATCHED`

## Scope and method

Fresh, read-only, production-source reconciliation against the approved batch 3 design, implementation plan, current CP-01 through CP-06 records, batch 6b, dynamic admission evidence, and current reset/DEV/seed manifests. The reviewer did not run tests, builds, generation, or managed commands. This is a source-to-design reconciliation, not the independent `REVIEW_TARGET=IMPLEMENTATION` verdict.

## Design-to-source and evidence mapping

| Design area | Current production source / artifact producer | Evidence checked |
| --- | --- | --- |
| R-14, resident Doris and per-run acceptance | `BackendAcceptanceTest.java`; `scripts/dev/r5-doris-resident.mjs`; `scripts/dev/r5-dev-runner.mjs` | Feasibility reports, current preflight, DEV manifest, dynamic admission record |
| Binding revocation and session-open notification | `TerminalBindingOwnerService.java`; `TerminalBindingOwnerPersistence.java`; `TdsConnectionStateRepository.java`; `TdsBindingRevocationListener.java` | Managed TDS CONTRACT scenarios for cross-node replacement/revocation and listener recovery |
| PG-authoritative latest session state and commit-before-local-registration race | `TdsConnectionStateRepository.java`; `TdsTerminalSessionActors.java` | Cross-node recovery, stale-write, replacement, and current-state readback assertions |
| Doris failure isolation and bounded writer | `TdsConnectionHistoryEvent.java`; `TdsConnectionHistoryWriter.java`; `TdsDorisStreamLoadClient.java` | Doris outage/bounded-writer acceptance paths and managed backend-acceptance result |
| WebSocket entry and no new business HTTP surface | `TdsWebSocketHandler.java`; existing application route inventory | TDS CONTRACT result; no new batch-3 business HTTP route identified |
| Runtime environment keys and server configuration | `contracts/policy/runtime-environment-keys.json`; `RuntimeEnvironmentKeys.java`; `application.yml`; `TdsAcceptanceProcess.java` | Current verify evidence and acceptance/DEV configuration injection |
| Operational DDL and Doris row shape | `scripts/dev/doris/connection-history.sql`; `TdsConnectionHistoryEvent.java`; `TdsDorisStreamLoadClient.java` | Backend acceptance DDL/readback and Doris row-shape assertions |
| Protected values excluded from Doris history | `TdsConnectionHistoryEvent.java`; `TerminalConnectionContractScenarios.java` | Secret scan/readback assertions in managed TDS CONTRACT scenarios |
| Reset, resident lifecycle, DEV and seed artifacts | `scripts/dev/r5-doris-resident.mjs`; `scripts/dev/r5-reset.mjs`; `scripts/dev/r5-dev-runner.mjs` | Reset manifest, current DEV manifest, complete seed manifest/report |

## Production symbol and artifact closure

The fresh reviewer found named callers/producers for the batch-3 production surface:

- `TdsConnectionHistoryEvent.connected/disconnected/heartbeat` are produced by the TDS actor/WebSocket lifecycle.
- `TdsConnectionHistoryWriter.recordConnected/recordDisconnected/recordHeartbeat` are called on registration, disconnect, and PING/PONG paths; `TdsDorisStreamLoadClient.load` is called by the writer flush path.
- `TdsConnectionStateRepository` read/write methods are consumed by the actor, listener, and WebSocket flow.
- `TdsBindingRevocationListener` consumes notifications from the binding owner and TDS session-state repository, then rereads PostgreSQL as authority.
- Resident Doris helpers are consumed by DEV and reset runners. Doris runtime keys are declared in policy, mirrored in Java constants, bound in TDS configuration, and injected by acceptance/DEV runners.
- No orphan generated/runtime artifact or zero-caller production symbol was found in batch-3 scope.

## Independent verdict

`13C=MATCHED`; no OPEN finding. This result does not replace the required fresh整批 `REVIEW_TARGET=IMPLEMENTATION` verdict.

No user-facing UI/page/action, TER package, Node client, Android path, browser L2, UAT, production deployment, new business HTTP API, new seed business data, Flyway history, MQ/outbox/persistent queue, or statistics page was added in this scope. Therefore §3a UI/L2 admission remains not applicable for this batch; no empty-denominator admission is invented.

## Evidence limits

- CP-02 named focused JUnit XML files are absent at their former build paths; the existing CP record and 6b explicitly treat this as evidence-retention drift and do not claim current raw XML availability.
- CP-01 classpath reports were overwritten by later runs; the required resolved-version facts remain in the current reports, while the old recorded hashes no longer identify those current files.
- Some focused proof stdout is preserved in review/evidence summaries rather than a complete raw transcript. This is not upgraded to a transcript-backed claim.
- This reconciliation did not execute any dynamic command and does not claim a new PASS for generation, tests, DEV, reset, or seed.

## Final implementation-review repair delta

The original 13C=MATCHED was recorded before the final implementation-review repair. Fresh independent reviewer `/root/batch3_final_delta_reconcile` checked the changed resident ensure/preflight producer links against current self-test, read-only preflight, healthy DEV manifest, E1 and Doris SQL readback evidence; `13C_DELTA=MATCHED`. Unaffected source-to-producer mappings remain unchanged and were not re-run. The reviewer performed read-only inspection and did not run generation, builds, tests, verification or managed commands; known historical artifact retention limits remain unchanged.

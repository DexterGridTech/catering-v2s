# TDP · CP-03 focused proof

```text
TASK=Terminal Data Platform data-change and remote-operations
CP=CP-03
PROOF_DATE=2026-10-04
```

## Current-byte focused runs

All runs use the repository-managed remote Testcontainers entrypoints. Business outcome, TDS contract, and resource cleanup are reported separately.

| Run ID | Proof | Result | Evidence |
| --- | --- | --- | --- |
| `r5-tc-1791110779507-3484` | `backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight --tds-contract-scenario terminal.connection.topic.active-store-subscription` | PASS; the first post-update scenario version, one real WebSocket session; business and cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791110779507-3484/` |
| `r5-tc-1791111045380-8717` | TDS `TdsTerminalSessionActorsTest`, `TerminalConnectionFrameCodecTest`, `TdsConnectionStateRepositoryPostgresIntegrationTest` | BUILD/TEST PASS; cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791111045380-8717/` |
| `r5-tc-1791111170715-11211` | TDS `TdsBindingRevocationListenerTest` | BUILD/TEST PASS; cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791111170715-11211/` |
| `r5-tc-1791111360279-16740` | Exact backend acceptance scenario, two independent activated terminals and two independent Node WebSocket clients subscribed to the same STORE identity | BUSINESS PASS; TDS contract 3/3 PASS; runner and Testcontainers cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791111360279-16740/` |
| `r5-tc-1791111706901-23757` | TDS `TdsTerminalSessionActorsTest`, including 12 active CONTRACT identities, notification acceptance, unsubscribe, and disconnect release | BUILD/TEST PASS; cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791111706901-23757/` |
| `r5-tc-1791111909714-27747` | TDS `TdsTerminalTopicRepositoryTest`; all eight exact-topic owner-function mappings and all three snapshot-topic table mappings with complete scope arguments | BUILD/TEST PASS; cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791111909714-27747/` |
| `r5-tc-1791112089661-31418` | TDS active-topic cross-scope rejection, listener-driven active-topic reconciliation, and listener restart re-read calls | BUILD/TEST PASS; cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791112089661-31418/` |
| `r5-tc-1791112321830-35941` | TDS WebSocket capacity-1 outbound rejection/release plus active-topic, repository-route, and listener tests | BUILD/TEST PASS; cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791112321830-35941/` |
| `r5-tc-1791112758404-44392` | Focused backend operation `storeTerminalActivationBusinessPrecedence` plus the selected TDS topic scenario; two live WS clients remained subscribed while the exact PG listener backend was terminated, a real CBS HTTP update committed during the gated outage, then the listener reconnected and both clients ACKed/read the new owner time | BUSINESS PASS; TDS CONTRACT 3/3 PASS; Testcontainers and runner cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791112758404-44392/` |

In `r5-tc-1791111360279-16740`, the two clients independently authenticated as different terminals, read the same STORE raw owner timestamp (`1791111507068`), and accepted the baseline. A real CBS HTTP update through a PROJECT-assigned `BC-ORG-STORE-EDIT` user changed the store revision and raw owner time to `1791111508403`. Both sessions received `TOPIC_CHANGED`, accepted it, read the same updated owner timestamp, and closed normally. Both terminal bindings were cancelled and read back inactive. The run manifest records BUSINESS=PASS, TDS CONTRACT=PASS (3/3), TDS cleanup=PASS, Testcontainers/container/volume cleanup=PASS, and runner/process cleanup=PASS.

`TdsDatabasePrincipal.provision` supplies a separate TDS role. Its positive checks open the TDS-owned session state, read both snapshot tables, and invoke both owner SQL functions; its negative check requires SQLSTATE `42501` for direct `organization.store` UPDATE. The acceptance scenario then exercises the real TDS authentication and exact STORE raw-time read with that role. The separate actor/listener focused runs prove local coalescing, accepted-time reconciliation, listener-thread ownership, wakeup dispatch, session reconciliation, and tracked identity cleanup.

## Preserved failed runs and root fixes

| Run ID | First failure | Disposition | Cleanup |
| --- | --- | --- | --- |
| `r5-tc-1791109806941-85591` | TDS failed readiness because `TdsTerminalTopicRepository` was `final` and Spring repository exception translation attempted a CGLIB subclass | Removed `final`; later TDS boot and acceptance runs passed | PASS |
| `r5-tc-1791110375585-95283` | Gradle surfaced `GRADLE_TEST_FAILURE_DETAILS_UNAVAILABLE` while compiling/running the attempted permission-fixture variant | Reopened current test output and fixed the fixture to use the existing PROJECT-scoped edit capability, not the incompatible STORE role | PASS |
| `r5-tc-1791110473603-97205` | `BC-ORG-STORE-EDIT` was incorrectly assigned to a STORE role; catalog correctly rejected that scope/capability combination | Changed the test actor to the existing `projectUserFixture` capability path | PASS |
| `r5-tc-1791111602879-21642` | New 12-identity actor test left a notification pending, then expected another immediate frame; the actor correctly coalesces changes until acceptance | Corrected the test sequence to accept each pending notification before asserting subsequent delivery | PASS |
| `r5-tc-1791112023470-29963` | Focused tests failed at `compileTestJava` because the new actor test used Mockito `times(2)` without importing `times` | Added the missing static import and corrected the exact read count to include subscribe, reconcile, and accept rereads | PASS |
| `r5-tc-1791112539074-40170` | Gradle executed the selected TDS scenario but the R5 entrypoint correctly rejected the run because method-level `--tests ...selectedTerminalConnectionContracts` excluded the operation's BUSINESS scenarios, leaving the required backend-acceptance result artifact absent. The TDS contract result itself was PASS and captured listener PID 79→80 with both subscriptions receiving the new timestamp. | Corrected only the managed invocation selector to class-level `--tests ...BackendAcceptanceTest`; the entrypoint then selected the same single backend operation and emitted both BUSINESS and TDS CONTRACT evidence. No evidence was fabricated or promoted from the rejected wrapper run. | PASS |

Earlier actor assertion failures with the same normalized Gradle category are retained in their run manifests; the current failed test and earlier actor assertion both exposed an incorrect frame-count expectation. The root cause is the test's failure to model the protocol's TOPIC_ACCEPT barrier; production coalescing remains unchanged. `r5-tc-1791111706901-23757` reran the same actor proof after the correction and passed.

## Current CP-03 evidence boundary

This record does **not** claim CP-03 `MATCHED`. Current evidence covers a real exact STORE subscription, two live sessions receiving one owner update, listener behavior, actor identity capacity/release, positive/negative principal setup, all query-route mappings, wrong-workspace/group wake-up rejection, wrong-store subscription rejection, and selected TDS tests. The CP-03 boundary was corrected in the plan to match the actual owner split: TDS reads a scalar snapshot/raw-time value and sends only a `TOPIC_CHANGED` timestamp; the complete collection body is an HTTP owner response, covered by CP-02/CP-05 rather than copied into TDS.

Remaining CP-03 boundary for the upcoming phase reconciliation:

- complete HTTP collection body, same-snapshot and no-pagination assertions belong to CP-02 CBS owner / CP-05 feature consumers. TDS reads only one scalar snapshot/raw-time timestamp and does not carry collection bodies;
- owner rollback/no-NOTIFY is covered by CP-02's current-byte transactional publisher proof, not repeated here;
- this run proves listener recovery with active subscriptions and two real WebSocket sessions; the separate actor/listener tests prove wrong workspace/group wakeup isolation, wrong-store subscription rejection, 12 active identities, active-topic re-read and reconciliation call chain;
- PONG is still subject to the existing bounded WebSocket sink. CP-03 proves that a full one-frame sink rejects/releases an additional frame without adding a pending queue; the plan explicitly does not claim successful PONG delivery into a socket sink that is itself not consuming frames.

The CP-03 implementation/proof work is complete. Fresh independent three-dimensional reconciliation returned **`MATCHED`**; the scope and evidence are recorded in `2026-10-04-v2s-tdp-cp-03-reconciliation-codex.md`.

The CP-02 owner snapshot and notification proofs remain separately recorded in `2026-10-04-v2s-tdp-cp-02-focused-proof-codex.md`; they do not substitute for TDS consumer-path proof. No CP-03, whole-batch 6b, full acceptance, DEV, Expo Web, or final implementation verdict is claimed here.

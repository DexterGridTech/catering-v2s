SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

# Terminal activation batch 1 · V-S12 listener recovery repair

## Preserved first failure

- Managed invocation: `scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight`.
- Run: `r5-tc-1790590651136-97769`, `2026-09-28T10:17:31.137Z` to `2026-09-28T10:19:24.207Z`.
- Evidence: `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790590651136-97769/run-manifest.json`, `tds-process.log.gz`, `tds-contract-result.jsonl.gz`, and `evidence-artifacts.tsv`.
- First failure: `TEST_TIMEOUT_EXCEPTION_ILLEGALSTATEEXCEPTION_TDS_REGISTRATION_GATE_OBSERVATION_DEADLINE_EXCEEDED_CLIENT_ALIVE_WIRESTAGE`; `lastKnownGood=SOURCE_SYNC`; `brokenBoundary=REMOTE_TEST_EXECUTION`; `business=NOT_RUN`.
- Cleanup: `PASS`, including remote process/workspace and Testcontainers container/volume queries. The manifest records empty resource inventory and the pinned remote Node runtime before workspace preparation.
- This is the only occurrence of this failure family. The same managed invocation has not been retried after repair.

## Root cause and finite boundary

V-S12 paused the exact owned PostgreSQL Testcontainer and exercised an existing WebSocket, but after unpausing it only waited for the listener recovery gate. Pausing the container did not sever the established PostgreSQL listener TCP session. The preserved TDS log contains one `tds_listener_ready ... backendPid=72` event and no `tds_listener_disconnected` event or recovery-gate event. The scenario therefore waited for a transition it had never caused. This is distinct from a PostgreSQL connect/read failure: the database recovered, while that already-established listener remained connected.

The smallest counterexample is the preserved run itself: container pause/unpause plus an unchanged listener connection. A termination-function return value cannot prove that the server backend has terminated; PostgreSQL may already have closed it during the outage. The proof must be the exact pre-outage PID's fresh disconnect event followed by the listener's observed, held recovery gate.

The repair applies only to acceptance V-S12 orchestration. It adds no production behavior or seam. It does not change the separate V-S10 listener-only proof or the pre-registration race gate.

## Repair

After unpausing the same run-owned PostgreSQL container, V-S12 calls the existing `pg_terminate_backend` helper for the exact PID captured from the listener readiness event. The returned boolean is recorded as the SQL function's signal response only. The test then requires, in order:

1. a `tds_listener_disconnected` event for that same PID in the TDS log slice after the pre-outage log offset;
2. observation of the run-owned `TdsListenerRecoveryGate` attempt, which holds reconnect;
3. real HTTP device cancellation while the gate is held, with the same session row still connected;
4. release of that exact gate attempt, listener readiness after the old PID, and closure of the same session as `ACTIVATION_CANCELLED` within the requirement bound.

If PostgreSQL already severed the listener during the pause, the SQL boolean may be false; that is diagnostic information, while the fresh PID event and held gate remain the required proof. The after-offset helper rejects log truncation and matches both event and PID.

## Before/after source reads and focused proof

- Before and after reads used requirements R-7.3, V-S12 and §8.14; design CP-05, §10.5, and the V-S12 map; plan Step 7; the owning acceptance scenario/helper, termination helper, listener gate and structural test; and routed backend-acceptance, test-closed-loop, phase-retrospective, execution-economics and log-first project memory.
- Current SHA-256: `TerminalConnectionContractScenarios.java` `31111761d3cd2344035a41c712ca89ae0403d82dd227278dac855b7c0899ff54`; `TdsAcceptanceProcess.java` `30c861ce394c9dd74b591b53bf006062a0ad5a4a95ffc99d4decde17dd42e18f`; `backend-acceptance-structure.test.mjs` `2844956f9e1ccd1272a26d94ca519d5bd7db813861f52f6c5fb76517001e7cf9`; design `5bbe76bc9aebaf8388f912c14a30e5c8c0f2cef6668c84b9a80fa87c8277bb8e`; plan `599fb1d4fa5020ffdf75301800c2a32e1cf35d6439303007942de2ce9c453f56`.
- `node --test scripts/test/backend-acceptance-structure.test.mjs`: `22/22 PASS`.
- `./gradlew :apps:backend:catering-business-server:compileTestJava`: `BUILD SUCCESSFUL`.
- Fresh read-only CP-05 three-dimensional reconciliation: `MATCHED`, `M/S/N=0/0/0`, reviewer `/root/cp05_vs12_current_format`; the reviewer confirmed the formatter-correct current hashes above and found no gap. This CP-stage result is not whole-batch `GO` or dynamic V-S12 proof.

## Static-format first failure and correction

The first current-byte `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/verify --validate-only`
stopped at `R5_VERIFY_STATIC_FIRST_FAILURE:backend-spotless-check` before later gates. Spotless identified
only the new `log.substring(logOffset).lines()` chain in `TdsAcceptanceProcess.java`; the continuation
dot belongs on its own indented line. Applied that exact formatting, then
`./gradlew :apps:backend:catering-business-server:spotlessJavaCheck
:apps:backend:catering-business-server:compileTestJava` passed and the focused structural test passed
again `22/22`. This static first failure was not a managed runtime failure and was not retried as a
whole chain until its focused formatting proof passed.

## Remaining dynamic evidence

The preserved run remains failed; its CONTRACT failure and cleanup evidence are unchanged. There is no managed run on the repaired bytes yet. Before retrying the same exact operation, refresh whole-batch 6b and first-run 6c on current bytes and complete the current static/resource admission. The next dynamic proof remains only the authorized exact single-operation topology preflight. Do not run later scenarios until this V-S12 failure family is closed by that same focused managed proof.

当前字节上的最新运行：focused structural test `22/22 PASS` and business backend `compileTestJava BUILD SUCCESSFUL`; no repaired-byte managed run.

最后一次通过：managed positive run `r5-tc-1790586025608-67247` is pre-repair and not current-byte evidence.

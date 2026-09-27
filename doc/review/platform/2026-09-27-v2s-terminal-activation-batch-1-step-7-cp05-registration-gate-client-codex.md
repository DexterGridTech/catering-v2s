# Batch 1 implementation record — CP-05 registration gate client

```text
DOC_KIND=CP05_FOCUSED_IMPLEMENTATION_EVIDENCE
CP=CP-05
WORK_ITEM=REGISTRATION_GATE_CLIENT
CP_RECONCILIATION=DEFERRED_UNTIL_CP05_COMPLETION
EVIDENCE_SCOPE=R3-M1 timing seam client and focused protocol tests
EVIDENCE_TIER=LOCAL_FOCUSED
REMOTE_TDS=NOT_RUN
BACKEND_ACCEPTANCE=NOT_RUN
ACTIVATION_AUTHORIZATION=NONE
```

## Scope and current boundary

This slice implements only the TDS side of the R3-M1 registration timing seam and its focused protocol tests. It does not implement the acceptance-side UDS server, TDS process launcher, Node wire client, business HTTP race scenarios, raw TCP forwarding proxy, or remote evidence. CP-05 remains open; the local seam test does not prove that a real verifier, database notification, per-terminal actor or WebSocket session is correctly ordered.

Device activation is anonymous and has no user-authentication or user-permission gate: R-1.1 is public with no login session; `activation.paths.json` declares `security: []` and `x-authorization-mode: NONE`; the handler uses `PUBLIC_PROTOCOL_CONTEXT`; and the controller/operation have no session, IAM, capability, or permission-resolver dependency. This does not bypass R-1.4 business-state checks. In particular, an inactive store blocks activation of a new device and keeps the accepted `403 PLATFORM_COMMON_ACCESS_DENIED` mapping with the explicit detail `门店已停用，无法激活新设备`; this is a state-based business rejection, not a caller permission check. The slice changed none of these activation sources.

## Source inputs reopened before the change and after focused proof

| Source group | Exact current input | Focused work-item scope |
|---|---|---|
| Requirement | `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:85` (R-1.1), `:621-629` (V-S4), `:655-662` (V-S10), plus Claude R3 review `doc/review/platform/2026-09-26-v2s-terminal-activation-batch-1-design-review-r3-claude.md:104-128` | A registration race must be held after successful credential verification; V-S4 and V-S10 require real TDS/PostgreSQL/HTTP evidence. No downgrade to a focused-only proof is proposed. |
| Detailed design and plan | `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md:420-426` (§10.5), `:422` (R-READ-10 boundary), and `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md:32,83` (Step 7 and race row) | The production gate is immediate by default; only remote managed backend-acceptance may opt in through a private UDS path; the gate carries an opaque attempt id and matching release, runs off the Reactor event loop, and does not replace real production behavior. |
| Project memory and standards | All six kernels linked by `project-memory/index.md`; six-dimensional route `implementation/backend/backend/platform/runtime/implementation`; reopened `project-memory/decisions/deterministic-context-only.md`, `project-memory/operations/backend-acceptance.md`, `project-memory/operations/test-closed-loop.md`, `project-memory/operations/execution-economics-and-failure-family-closure.md`, `doc/platform/backend-coding-standard.md` R-READ-10, and `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` | Main agent writes; the real WebSocket CONTRACT stays outside the business scenario catalog; local focused evidence cannot claim managed remote evidence; same failure category must be closed before business progress resumes; production boundary claims must match the exercised source. |
| Owning source and call order | `SessionRegistrationGate.java`; `TdsWebSocketHandler.java:223-250`; `TdsTerminalSessionActors.java:130-148,224-257`; `TdsRuntimeSettings.java`; terminal-binding verifier API | The real verifier has returned and `recordVerification` has accepted the pending attempt before the handler awaits this gate; actor registration follows completion of the gate Mono. The gate does not perform persistence or actor mutation. |
| UI/TER IA | `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md`; `doc/platform/terminal-coding-standard.md` TR-09..TR-11 | `NOT_APPLICABLE_WITH_REASON`: this is a backend TDS seam change; it adds no UI, TER source, event path, user-facing copy, focus behavior or accessibility behavior. |

Source digests captured when the focused proof was recorded (the CP-05 design wording has since been clarified to match the verified production call order):

| Path | SHA-256 |
|---|---|
| `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md` | `35ef15fd0b0844426e30da43649a2cfa28136806b326c8b694205c34d1cf238a` |
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md` | `c960160f2acccadfd378589bfd93407710e0c9994ffddd4f29217e800164b291` |
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md` | `dd397fc20674abe660c3136ea95847799e5c3db1f92dae34f7c7c145ef7394a4` |
| `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/SessionRegistrationGate.java` | `4372b87f703604c123467b699becbe1340142e8191fdd3d9cb466bce065f6dec` |
| `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/session/SessionRegistrationGateTest.java` | `1f9d5902c5dcffc9eb62324883f6313680264b2d87983d153b2858b7bcbb1374` |

## Change and evidence

- `SessionRegistrationGate` returns `Mono.empty()` with no socket property, preserving immediate production behavior. Setting the acceptance socket property without a nonblank `V2S_BACKEND_ACCEPTANCE_RUN_ID` and `V2S_TESTCONTAINERS_EXECUTION_PLANE=remote` fails closed at TDS startup.
- On opt-in, after credential verification and before actor registration, the TDS client sends `CREDENTIAL_VERIFICATION_RETURNED_BEFORE_REGISTER\t<attemptId>\n` over one Unix-domain socket and waits for exactly `RELEASE\t<sameAttemptId>\n`. The line is ASCII and capped at 128 bytes; it carries no credential or business state. The wait runs on Reactor bounded-elastic and cancellation closes the active socket.
- Focused tests cover immediate default behavior, remote-managed selection guard, exact event/release correlation, mismatched release rejection, and cancellation closing a blocked channel.
- Focused command on current bytes:

  ```bash
  ./gradlew :apps:backend:terminal-data-server:test --tests '*SessionRegistrationGateTest' :apps:backend:terminal-data-server:spotlessJavaCheck --no-daemon
  ```

  Result: `BUILD SUCCESSFUL`; JUnit XML reports 5 tests, 0 failures, 0 errors, 0 skipped. `spotlessJavaApply` and `spotlessJavaCheck` both passed. Local run label: `LOCAL-TDS-CP05-REG-GATE-20260926T2324Z`; no managed-run manifest exists for this focused JVM test.

## First failures and closure

1. The first compile failed because this Reactor version's `MonoSink` has no `isCancelled()` method. The implementation was changed to an explicit cancellation flag and a cancellation callback that closes the active channel. The same focused command later passed.
2. A later compile exposed a duplicate three-`String` constructor and recursive delegation after adding the remote-acceptance guard. The validation was moved into the injected constructor; the same focused command later passed.
3. A manual format layout failed `spotlessJavaCheck`; the owning TDS Java formatter was run before the passing check. This was the second `FORMAT_CHECK` occurrence counting the retained CP-04 first failure. Business progress was frozen until current-byte format and focused checks passed. Future Java slices use the owning module formatter before the check rather than manual line-layout guesses.
4. One attempted Gradle command used `/` instead of `:` in the TDS task path, so Gradle ran no task. The corrected task selector above passed; this was a command-entry typo, not an implementation failure.

The first failure outputs remain in the local command transcript. No remote SSH, tunnel, Docker/Testcontainers, DEV, reset, seed, L2, UAT, deployment or data operation occurred. `REMOTE_TDS=NOT_RUN` and `BACKEND_ACCEPTANCE=NOT_RUN` remain the evidence boundary for this record.

## Prior slice-review finding intake (not a CP verdict)

### Main-agent finding intake

The fresh reviewer confirmed the factual mapping `STORE_DISABLED` → `403 PLATFORM_COMMON_ACCESS_DENIED` but treated the permission-shaped code name as evidence of an activation permission restriction. Disposition: `PARTIALLY_CONFIRMED`; the mapping fact is confirmed, while the authorization conclusion is `REJECTED_WITH_EVIDENCE`. R-1.1 and the accepted design explicitly make activation public with authorization `NONE`; the route has `security: []`, its generated handler uses `PUBLIC_PROTOCOL_CONTEXT`, and the controller/operation inject no user session, IAM grant, capability or permission resolver. Separately, R-1.4/D-19 require rejecting a new device for an inactive store; the problem detail identifies that business state, and the acceptance scenario asserts this exact result (`StoreTerminalAcceptanceScenarios.java:295-301`). Changing the code would alter the accepted design/HTTP contract and is not implied by Dexter's instruction that activation have no permission restrictions. Keep the existing business-state mapping; make this distinction explicit in this record.

The prior component-level reviewer output is retained as finding-intake evidence; it is not accepted as a CP-05 reconciliation and does not create a separate gate between work items. CP-05 remains in progress. When all CP-05 harness work, focused proofs and necessary repairs are complete, one fresh reviewer will examine this record together with the complete CP-05 evidence and return `MATCHED` or `OPEN` for the whole CP. This note makes no CP completion or GO claim.

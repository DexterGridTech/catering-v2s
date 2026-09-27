# Batch 1 · CP-04 TDS step reconciliation

```text
DOC_KIND=IMPLEMENTATION_STEP_RECONCILIATION
STEP=CP-04
AUTHOR_READBACK=MATCHED
INDEPENDENT_RECONCILIATION=MATCHED
REVIEW_SCOPE=CP-04 single-node TDS, including shutdown lifecycle ordering
EVIDENCE_TIER=LOCAL_FOCUSED
```

## Purpose and result

CP-04 implements the single-node TDS WebSocket session, state writer, PostgreSQL revocation listener, and bounded graceful drain. Requirement R-4.5 requires new sessions to receive `REDIRECT_TO_NEXT_NODE` first, then existing sessions to close with the same reason within the drain window. V-S9 requires readiness and admission to change before the WebSocket server stops accepting, a bounded close of current/control sessions, and a final listener closure.

The initial source review found that both `TdsConnectionStateWriter` and `TdsBindingRevocationListener` used `GRACEFUL_SHUTDOWN_PHASE - 1`. Spring Boot 4.1.0 runs WebServer graceful shutdown at `GRACEFUL_SHUTDOWN_PHASE`, but stops the actual WebServer at the lower `START_STOP_LIFECYCLE_PHASE`. The two TDS components also shared one phase, so their relative stop order was not established. This failed the requirement that final listener closure follow shutdown work.

The main-agent repair assigns ordered phases relative to the actual server stop:

1. `TdsGracefulShutdownLifecycle`: `GRACEFUL_SHUTDOWN_PHASE + 1`; it marks readiness refusing traffic, rejects new attempts, drains active sessions, and sends redirect close frames.
2. WebServer graceful shutdown: `GRACEFUL_SHUTDOWN_PHASE`.
3. WebServer start/stop: `START_STOP_LIFECYCLE_PHASE`.
4. `TdsConnectionStateWriter`: `START_STOP_LIFECYCLE_PHASE - 1`; pending disconnects are flushed after the WebServer stop.
5. `TdsBindingRevocationListener`: `START_STOP_LIFECYCLE_PHASE - 2`; the PostgreSQL listener exits after the writer.

Spring Framework 7.0.8 stops phases from higher to lower values. The focused test asserts the WebServer phase relationship and the two concrete TDS bean phases. This is a phase-order proof; it is not evidence that a remote shutdown, PostgreSQL write, or managed cleanup has run.

## Three-dimensional reconciliation

### 1. Requirement

- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:186` — R-4.5: refuse new connections with redirect before closing existing connections within the drain window.
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:651-654` — V-S9: readiness/admission order, same redirect for existing sessions, and a control session still receives PONG before closure.
- Reopened before and after the repair. SHA-256 before/after is unchanged: `35ef15fd0b0844426e30da43649a2cfa28136806b326c8b694205c34d1cf238a`.

### 2. Design and IA

- `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md:73-74` — CP-04 and the next-step CP-05 boundary.
- `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md:398-426` — §10.2 writer policy, §10.3 listener/recovery, and §10.5 registration-race boundary.
- `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md:494,525` — readiness journey and V-S9 shutdown order/final listener closure.
- `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md:31` — Step 6 owns TDS readiness and graceful drain; Step 7 owns managed remote harness.
- The design SHA-256 was unchanged across the repair: `0c48c550bf7411dfc7a3b9de46d3b31f48477120a13462089b11bf1fe803f85b`.
- The plan SHA-256 was unchanged across the repair: `3951ad31c29c4004e9d28efa415e8c3a0aff61fcb491aff7e021762eab2aff43`.
- UI IA: `NOT_APPLICABLE_WITH_REASON` — this is a Spring/TDS lifecycle-order change. It adds no user-facing control, copy, focus behavior, or UI state.
- `doc/platform/terminal-coding-standard.md` TR-09, TR-10, and TR-11: `NOT_APPLICABLE_WITH_REASON` to this corrective change. They govern TER package ownership/README and TER event-to-command flow; this change neither changes an `apps/terminal` package nor alters a TER event path. The CP-04 actor and event implementation remains in its owning TDS sources.

### 3. Project memory and constraints

All six entries linked under `project-memory/index.md` “Always-read kernel” were read. Task-specific route:

```text
scripts/context/recall-memory --task-kind implementation --domain backend --consumer-face backend --owner platform --impact runtime --trigger failure
```

The six route dimensions were `implementation / backend / backend / platform / runtime / failure`. The four routed hits were reopened: `project-memory/operations/backend-acceptance.md`, `project-memory/operations/phase-retrospective-and-systemic-repair.md`, `project-memory/operations/test-closed-loop.md`, and `project-memory/operations/execution-economics-and-failure-family-closure.md`. Applied assertions: step-boundary independent reconciliation; local focused PASS is not remote/Testcontainers/DEV/L2/cleanup evidence; retain first failure and close a recurring failure family before proceeding. The backend-acceptance TDS-specific rule keeps WebSocket CONTRACT in the separately managed TDS process; this step did not run that harness.

Kernel SHA-256 values, in index order:

| Path | SHA-256 |
| --- | --- |
| `project-memory/kernel/01-workspace-and-authorization.md` | `38f06c5a5c003947f2f5a052386f593beef4d23634d9c1d2e02525c987f4e50b` |
| `project-memory/kernel/02-service-shape-and-owner.md` | `b4cc00b51fd0a2679d168ee347aa584ba0d28fa78777f61b16e6bf3ba761edfd` |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `4c68d6154af8edaf54fc2069f6cdd111433c231ae9df701b3bf94408337dc8bc` |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `85964b6b5aaec31453f321d990bff54f2ad76f8a5427174a9e2b6c7fe7ff6025` |
| `project-memory/kernel/06-heritage-and-change.md` | `f0fbf34400c0a1d89dfabe52c031e0688a169279423eb5de70dc3154b0915896` |

Routed-memory SHA-256 values (unchanged on post-change readback):

| Path | SHA-256 |
| --- | --- |
| `project-memory/operations/backend-acceptance.md` | `0e26f815d6988f8f975d4c82513bf25539c16970a6d0ac9c60fde9925a4fc54b` |
| `project-memory/operations/phase-retrospective-and-systemic-repair.md` | `ee7eacfb2724946a139046119becc3ebe171e17282abfb846559fea7730fc1a9` |
| `project-memory/operations/test-closed-loop.md` | `0459c5bd0d0e69366e3d8234fe16033f086ee137cccba7862adefb3fcfc65dc7` |
| `project-memory/operations/execution-economics-and-failure-family-closure.md` | `d51110be04a71d3e637d6ec62f41d5072464d0d3adb00aba2e0f8da654698412` |

The corresponding kernel/routed memory SHA-256 values were unchanged after the focused proof. Relevant assertion anchors were reread at `project-memory/operations/phase-retrospective-and-systemic-repair.md:45-56`, `project-memory/operations/test-closed-loop.md:16-20`, and `project-memory/operations/execution-economics-and-failure-family-closure.md:24-38`.

## Owning source and change

Before the edit, the main agent reopened the production lifecycle implementations, actor drain/close path, and lifecycle test. After the focused proof, the same files and assertion were reopened. Post-change SHA-256:

| Path | SHA-256 |
| --- | --- |
| `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateWriter.java` | `352ba0cb2572fe798f5e1aed640505da397a7116da82984514ed01ab37db2f55` |
| `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsBindingRevocationListener.java` | `e5c90ef0270f71f9fad90c66cdbfddde14a244a27f21918e391f864d23e31ef1` |
| `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/session/TdsGracefulShutdownLifecycleTest.java` | `0394e2d255a4144a6012eb3bc3851d42b046c3f269bbb833e80afc1db440f630` |

The Spring sources were read from the exact resolved local dependencies: Spring Boot `4.1.0` (`WebServerApplicationContext`, `WebServerGracefulShutdownLifecycle`, and reactive `WebServerStartStopLifecycle`) and Spring Framework `7.0.8` (`DefaultLifecycleProcessor`). They define the constants and descending phase-stop order used above.

## Focused proof and first failure

1. `LOCAL-TDS-CP04-SHUTDOWN-PHASE-20260926T2051Z`, 2026-09-26 20:51:19 UTC: the selected lifecycle test passed, but `spotlessJavaCheck` failed on formatting in the changed test file. This first failure is retained; it did not exercise a remote/runtime boundary.
2. `./gradlew :apps:backend:terminal-data-server:spotlessApply --no-daemon`, 2026-09-26 20:51:59 UTC: PASS.
3. `LOCAL-TDS-CP04-SHUTDOWN-PHASE-20260926T2052Z`, 2026-09-26 20:52:08 UTC:

   ```bash
   ./gradlew :apps:backend:terminal-data-server:test --tests '*TdsGracefulShutdownLifecycleTest' :apps:backend:terminal-data-server:spotlessJavaCheck --no-daemon
   ```

   `BUILD SUCCESSFUL`; JUnit XML reports `tests=2`, `skipped=0`, `failures=0`, `errors=0`. The test confirms the graceful and WebServer stop phases and requires listener phase `<` writer phase `<` actual WebServer stop phase. No remote SSH/tunnel, Testcontainers, DEV, reset, seed, L2, UAT, production, or device action occurred.

`FORMAT_CHECK` was treated as a recurring failure family: the prior focused CP-04 run had the same formatter category. The formatter identified only the changed test source; after applying the project formatter, the exact focused proof passed. No next implementation step is claimed complete by this record.

## Independent review result

Fresh reviewer: `/root/cp04_recheck_shutdown` (`STEP_RECONCILIATION=OPEN`, read-only; no tests, scripts, builds, remote execution, or files written by the reviewer).

### Confirmed portion

- The changed Spring lifecycle phase ordering and focused local test agree with R-4.5/V-S9 and the implementation design. The reviewer independently confirmed that the writer stops after the actual WebServer start/stop lifecycle phase and the listener stops after the writer.
- Requirement/design/project-memory inputs and the recorded pre/post source readback were checked by the reviewer. UI IA and TER TR-09/TR-10/TR-11 remain `NOT_APPLICABLE_WITH_REASON` for this backend TDS lifecycle change.
- The reviewer confirmed the focused JUnit evidence is local-only and does not prove remote WebSocket shutdown, PostgreSQL writes/listener closure, managed cleanup, V-S10, or V-S14 dynamic behavior.

### Open finding F-CP04-01 — tracked-session disconnect capacity

- **Status at the original tracked-cap review:** `OPEN / DEXTER_DECISION_REQUIRED`.
- **Design evidence:** `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md:398-400` requires a tracked-session permit to remain held until disconnect persistence succeeds or the run fails closed, bounding pending disconnects by admitted tracked sessions.
- **Source evidence:** `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketConnection.java:56-59,70-74` releases the existing unauthenticated-attempt permit after authentication/`SESSION_READY`; `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateWriter.java:31-32,60-63,100-142` stores pending disconnects in an unbounded map with no tracked-session permit/capacity release link; `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java:43-45,189-194,209-214` tracks actors and active/pending sessions without an admitted tracked-session cap.
- **Impact:** A database outage or disconnect-write failure can retain disconnects without the bounded admitted-session guarantee required by §10.2.
- **Minimum acceptance:** Implement and focused-test a tracked-session permit lifecycle whose bound covers active sessions plus pending disconnect persistence, or obtain Dexter’s explicit change to those capacity semantics. The reviewer did not select a product capacity or configuration value.
- **Historical disposition:** the author implemented the tracked-session permit under the existing D-34 implementation authority; Dexter did not change capacity semantics or provide a deployment number. Fresh reviewer `/root/cp04_tracked_cap_reconcile` confirmed that source now matches design. The remaining CP-04 OPEN is the separate shutdown-readiness order in `F-CP04-02`.

## Device activation authorization clarification

The latest source read confirms the activation endpoint is anonymous and permission-free, consistent with requirement R-1.1 and design §5: `contracts/openapi/paths/terminal/activation.paths.json:5-33,79` declares `security: []` and `x-authorization-mode: NONE`; `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/TerminalActivationController.java:15-31` has no session or permission dependency; `ActivateTerminalOperation.java:29-61` only validates activation inputs and delegates owner facts/command; and `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreTerminalAcceptanceScenarios.java:121-136` exercises activation with no session, Cookie, Authorization, or Idempotency-Key. The activation code, request shape, and business eligibility remain protocol/business validation, not user-permission checks. This clarification does not alter CP-04’s OPEN status.

## CP-04 implementation update · tracked-session bound

This is an author implementation update, not an independent verdict. The original `F-CP04-01` tracked-cap gap was confirmed fixed by fresh reviewer `/root/cp04_tracked_cap_reconcile`; that review found the separate shutdown-readiness ordering gap `F-CP04-02`, recorded below. CP-04 remains `OPEN` until that ordering repair receives a fresh recheck.

- **Implementation shape selected:** an independent required `V2S_TDS_MAX_TRACKED_SESSIONS` limit, separate from `V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS`. The former bounds active sessions plus disconnects awaiting persistence; the latter bounds accepted sockets until authentication completes. Reusing one key would merge different lifecycles and invalidate the existing unauthenticated-cap meaning. The tracked deployment value remains unset until measured host capacity is approved.
- **Permit ownership:** `TdsTerminalSessionActors.register` acquires after successful credential verification and before `repository.open`. Cap exhaustion closes only the candidate as `NODE_BUSY` before a state write. `ActiveSession` owns the permit. Every active-session disconnect path passes its idempotent `close` callback to `TdsConnectionStateWriter`; failed writes retain the pending disconnect and permit; successful persistence releases it. A pre-open failure releases immediately. Post-open encoding/send failure queues the opened state for disconnect persistence before release.
- **Anonymous activation remains unchanged:** the activation OpenAPI operation still has `security: []` and `x-authorization-mode: NONE`; the controller has no session/permission dependency. Business validation remains intact. TDS resource-capacity rejection applies only to a WebSocket candidate and does not add permission requirements to activation.
- **Tracked-cap focused tests (historical, before F-CP04-02 repair):** `TdsRuntimeSettingsTest` 27/27; `TdsTrackedSessionLimiterTest` 1/1; `TdsTerminalSessionActorsTest` 13/13; `TdsConnectionStateWriterTest` 2/2; `TdsGracefulShutdownLifecycleTest` 2/2. Total 45, no skips/failures/errors. `spotlessJavaCheck` passed with that successful run.
- **First failure retained:** `LOCAL-TDS-CP04-TRACKED-CAP-20260926T2128Z` at 2026-09-26 21:28:44 UTC ran the focused tests successfully but failed `spotlessJavaCheck` on four changed TDS test sources. This repeated the CP-04 `FORMAT_CHECK` failure family. The formatter diff localized the issue to new long argument/property-value lines and import/layout normalization. `:apps:backend:terminal-data-server:spotlessApply` changed formatting only; the exact focused command then passed as `LOCAL-TDS-CP04-TRACKED-CAP-20260926T2129Z` at 2026-09-26 21:29:29–21:29:38 UTC.
- **Runtime-key gate:** `LOCAL-RUNTIME-ENV-KEYS-CP04-20260926T2128Z` passed the normal check (`CROSS_LAYER_KEYS=20`, `JAVA_KEYS=20`) and self-test. Red fixtures detected policy-count, Java-registry, TDS-config-binding, and script-source mutations; the single-sided negative control stayed accepted. This does **not** prove yet that managed backend-acceptance/DEV TDS launchers pass both values; the exact consumer checks and their red fixtures are deferred to Steps 7 and 8 as recorded in design §12. Until then, this gate result is limited to policy/Java/TDS-config closure.
- **Evidence tier and boundaries:** local focused JVM tests and a static key gate only. The TDS module test dependencies are Spring Boot test, Reactor test, ArchUnit and JUnit launcher; no Testcontainers dependency/source is present. No remote SSH, tunnel, Testcontainers, managed TDS, DEV, acceptance, reset, seed, L2, UAT, production, or device action ran.
- **Historical focused status before the shutdown-order repair:** `LOCAL-TDS-CP04-TRACKED-CAP-20260926T2129Z`, 21:29:29–21:29:38 UTC, PASS, 45 tests plus `spotlessJavaCheck`. It does not cover the later lifecycle-order change. The key-gate run is current for policy/registry/TDS configuration bytes, not managed launcher consumption.
- **Independent recheck required:** re-open R-4.5/V-S9, design §§10.2/10.4/12, CP-04 actor/state-writer sources and focused test XML. Check all permit acquisition/release paths, failed persistence, cap rejection before DB writes, no disturbance to current session, and the activation `NONE` contract. Do not advance to the next implementation step unless the fresh step reconciliation is `MATCHED`.

## Source double-read record for the tracked-cap change

The pre-edit reads were made before writing. For the source files changed here, the pre-edit state was: one `maxUnauthenticatedConnections` field/parser/config key; no tracked-session limiter or permit on `ActiveSession`; actor `register` called `repository.open` without a tracked bound; active close paths passed empty persistence callbacks; the writer held disconnects in a `ConcurrentHashMap` without a bound; runtime policy/Java closure was 18 keys. The exact pre-edit excerpts and line anchors were reopened in this session before patching: `TdsRuntimeSettings.java:5-16,27-90`, `TdsSettingsConfiguration.java:10-25`, `TdsTerminalSessionActors.java:269-341,359-428,466`, `TdsConnectionStateWriter.java:31-63,100-142`, policy lines 4-23, Java registry lines 10-48, and gate lines 1382-1421. The governing pre-edit design and plan digests are already recorded above (`0c48c550bf7411dfc7a3b9de46d3b31f48477120a13462089b11bf1fe803f85b` and `3951ad31c29c4004e9d28efa415e8c3a0aff61fcb491aff7e021762eab2aff43`); their pre-edit capacity statement had no second required key. The requirement source digest remained the unchanged value shown below. No Git history or external checkout was used to recover pre-edit bytes.

After the tracked-cap focused proof, the same requirement/design/plan/source anchors were reopened. Historical digests at that stage (later lifecycle-repair source digests are listed in the post-proof table below):

| Source | Tracked-cap-stage SHA-256 |
| --- | --- |
| `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md` (unchanged; R-1.1, R-4.2, R-4.4) | `35ef15fd0b0844426e30da43649a2cfa28136806b326c8b694205c34d1cf238a` |
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md` (§§10.2, 10.4, 12) | `59c44016280d209aedd98a246292c534b9ac231738402386d9a56a9b3b52459f` |
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md` (Steps 6–8 boundary) | `6cf1ce0dd00ec674fbde0d9956ee6e81fddbca84f53219ff7a1bb898b2efbc5f` |
| `apps/backend/terminal-data-server/README.md` | `7fb9895d57322eaae4d3ad160f8481c44ca05c1a2979c7833e5dec926bd29a72` |
| `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/config/TdsRuntimeSettings.java` | `a8743add06d802c5fac76723ba8974fc706f7208deefce6e5932b88407f666e3` |
| `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/config/TdsSettingsConfiguration.java` | `7340a4319d58ce157cca9494d0353d8d2006c4d358477c807a3a2ef89d25e939` |
| `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTrackedSessionLimiter.java` (new) | `c13f58acabb3a5b207d67b8ae9f05232a7a16ab3212c997992a54f8aa37f8e71` |
| `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java` | `fc411c76bf9b10346a39637009fe860c761349575a00e7d41e4f5fb9418d1183` |
| `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateWriter.java` (unchanged owning boundary) | `352ba0cb2572fe798f5e1aed640505da397a7116da82984514ed01ab37db2f55` |
| `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/config/TdsRuntimeSettingsTest.java` | `26193e56828b86de4ae9eeb56e02ffea5be792990f174534fc6602ef054267c9` |
| `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/session/TdsTrackedSessionLimiterTest.java` (new) | `32b16722ee93e4810957e8732883cb3c0f2360d081e5986fb1ad7865fcbf6358` |
| `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActorsTest.java` | `fd068e80c4093bd133fb841e428cbb0d37b0fe73bb5ab41fd062d11e6fe51ffb` |
| `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateWriterTest.java` | `71812e92b5998629311160f39d029ec3a52567f64366a83ba607ad32308da93d` |
| `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/session/TdsGracefulShutdownLifecycleTest.java` (format-only from prior lifecycle repair) | `4556456ef7df8f2e0ca8c8fbdd564cb03b5e555237cfa0d2d1c328aecb67709b` |
| `contracts/policy/runtime-environment-keys.json` | `7178bf7f4fc7015b8ccc9d30c50704754fb5be1fb754249c8db9fc08ea7b1b96` |
| `apps/backend/catering-business-server/modules/foundation/src/main/java/com/catering/v2s/platform/foundation/runtime/RuntimeEnvironmentKeys.java` | `3f6ff014fbfd03819a4c869f3c83d9a11ea69a0622c53ceb778dc9863a2f2c62` |
| `tools/verify-gates/cli.mjs` | `501eb61c05357572f3c32d41c89e6201db13b6e766ec261a17e144662d6da62d` |
| `tools/verify-gates/verify.mjs` | `4f83dfd10419d675aad508b80cf737528632bf715dd7c73308525dc9e44157cf` |

The activation operation itself was not edited. The current byte readback remains `security: []`, `x-authorization-mode: NONE` at `contracts/openapi/paths/terminal/activation.paths.json:3-33,79` and no session/permission dependency at `TerminalActivationController.java:15-31`. Requirement R-1.1 says the device-facing activation endpoint is public and requires no login session. `V2S_TDS_MAX_TRACKED_SESSIONS` is transport resource admission after terminal-credential verification; it is not authorization and does not restrict the HTTP activation endpoint.

## Independent recheck · tracked-cap and anonymous activation

Fresh reviewer `/root/cp04_tracked_cap_reconcile` returned `STEP_RECONCILIATION=OPEN` after reviewing current source before the author report. It confirmed the tracked-session permit lifecycle and permission-free activation, and identified the next gap: pending attempts were closed before readiness changed. The reviewer read the prior record only after forming that verdict and wrote no files or test output.

### F-CP04-01 disposition · tracked-session disconnect capacity

The tracked-session cap and release paths now match design §§10.2/10.4: `TdsTrackedSessionLimiter.java:23-28,44-47`; `TdsTerminalSessionActors.java:306-319,350-357,467-483`; and `TdsConnectionStateWriter.java:100-120`. Current focused XML records 27 settings tests, 13 actor tests, 1 limiter test, 2 writer tests and 2 lifecycle tests with zero failures/errors/skips. This is local focused evidence only; the separate managed backend-acceptance runtime and capacity sizing remain open for later plan steps.

### F-CP04-02 disposition · readiness precedes pending-attempt closure

- **Confirmed finding:** before repair, `TdsGracefulShutdownLifecycle.stop` invoked `actors.beginDrain()` before publishing `ReadinessState.REFUSING_TRAFFIC`; `beginDrain()` sets the draining flag and closes pending attempts. This contradicted R-4.5/V-S9 and design V-S9, which require refusing new upgrades and publishing readiness before closing current/pending sessions.
- **Minimum repair:** split “refuse new connections” from “close already admitted pending attempts.” `refuseNewConnections()` marks the actor draining under its admission monitor; lifecycle publishes `REFUSING_TRAFFIC`; `beginDrain()` then closes pending attempts and starts the existing bounded window for active sessions. `drainStarted` keeps the second phase idempotent even though admission is already closed.
- **Source and test:** `TdsGracefulShutdownLifecycle.java:75-82`; `TdsTerminalSessionActors.java:46-47,91-115`; `TdsGracefulShutdownLifecycleTest.java:44-50` verifies refusal → readiness event → begin drain; `TdsTerminalSessionActorsTest.java:334-363` verifies pending attempts remain open after admission closes, new attempts receive `REDIRECT_TO_NEXT_NODE`, pending attempts close when drain begins, and active sessions close only at finish.
- **First failure retained:** `LOCAL-TDS-CP04-SHUTDOWN-ORDER-20260926T214246Z`, 2026-09-26 21:42 UTC; `TdsTerminalSessionActorsTest` had one NPE because the test left the active connection’s queued `SESSION_READY` unread, consuming the tiny unauthenticated test permit pool. The new candidate therefore had no permit; the direct actor test had bypassed the real handler admission precondition. This was a test-fixture failure, not a production admission failure. No retry occurred before reading the JUnit failure stack and identifying the missing outbound subscription.
- **Fixture correction:** consume the already queued active `SESSION_READY` from `outboundMessages()` before opening the candidate; this simulates successful transport delivery and releases the unauthenticated permit exactly as the production connection stream does.
- **Same-tier rerun:** `LOCAL-TDS-CP04-SHUTDOWN-ORDER-20260926T214352Z`, started 2026-09-26 21:43:52 UTC. Command: `./gradlew :apps:backend:terminal-data-server:test --tests '*TdsTerminalSessionActorsTest' --tests '*TdsGracefulShutdownLifecycleTest' :apps:backend:terminal-data-server:spotlessJavaCheck --no-daemon`. `BUILD SUCCESSFUL`; actor tests 13/13 and lifecycle tests 2/2, zero skips/failures/errors; `spotlessJavaCheck` passed. JUnit XML timestamps are 21:43:56.670Z and 21:43:57.277Z.
- **Evidence boundary:** the TDS module has no Testcontainers dependency; this was local focused JVM proof. No remote process, SSH/tunnel, PostgreSQL, Testcontainers, DEV, backend-acceptance, reset, seed, L2, UAT, production or device action ran.
- **Activation remains permission-free:** the activation operation still declares OpenAPI `security: []` and `x-authorization-mode: NONE`; the controller and operation have no user-session, IAM, capability or permission dependency. Store/workspace/terminal eligibility errors remain business rules, not access-control requirements.
- **Current/last-pass status:** current latest CP-04 local focused run is `LOCAL-TDS-CP04-SHUTDOWN-ORDER-20260926T214352Z`, PASS, 15 tests plus `spotlessJavaCheck`; last pass is the same run and matches the current lifecycle/actor/test bytes. The earlier first failure is retained above.
- **Fresh recheck:** `/root/cp04_shutdown_order_reconcile` returned `STEP_RECONCILIATION=MATCHED` for the complete CP-04 scope. The local shutdown ordering, tracked-cap lifecycle, permission-free activation, and report readback match the current requirement/design/memory inputs; later managed backend-acceptance and remote cleanup remain for their plan steps.

### Post-proof double-read hashes · lifecycle-order repair

| Source | SHA-256 after focused proof |
| --- | --- |
| `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md` | `35ef15fd0b0844426e30da43649a2cfa28136806b326c8b694205c34d1cf238a` |
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md` | `59c44016280d209aedd98a246292c534b9ac231738402386d9a56a9b3b52459f` |
| `project-memory/decisions/deterministic-context-only.md` | `0137a797b55c18455b9f76ad2b9a54eb299e57f06c3afed5d1764c7f5fcefbca` |
| `project-memory/operations/phase-retrospective-and-systemic-repair.md` | `ee7eacfb2724946a139046119becc3ebe171e172abfb846559fea7730fc1a9` |
| `project-memory/operations/test-closed-loop.md` | `0459c5bd0d0e69366e3d8234fe16033f086ee137cccba7862adefb3fcfc65dc7` |
| `project-memory/operations/execution-economics-and-failure-family-closure.md` | `d51110be04a71d3e637d6ec62f41d5072464d0d3adb00aba2e0f8da654698412` |
| `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsGracefulShutdownLifecycle.java` | `b5b970562310bb42ec4d6b1ccab3bb6130a6b8992ab11f11205ef0cb57ab5c1d` |
| `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java` | `c1ce3b6c231293d661814116e4cbe69c3c050b81ae07616a56392e39ff8ed564` |
| `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/session/TdsGracefulShutdownLifecycleTest.java` | `c9e9106eb46d85c13d7eabfc0c41742dd23991d2156935539d9037ae0f5744c2` |
| `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActorsTest.java` | `0b545b3f42034b5917231094362512df29e93da8615e8db72ee1cdd23a8a87de` |

The post-proof readback reopened requirement R-4.5/V-S9, design V-S9 and plan Step 6, the six routed kernel entries and four routed operation memories, deterministic-context-only, the current lifecycle/actor/test code, and the successful JUnit XML. The shutdown order now reads: close admission → publish readiness refusing traffic → close pending attempts → keep active sessions through the bounded window → close active sessions → WebServer stop → state writer → listener. No UI IA is applicable to this server-lifecycle-only change.

## Final independent step reconciliation

Fresh reviewer `/root/cp04_shutdown_order_reconcile` returned `PASS / STEP_RECONCILIATION=MATCHED` after source-first review. It verified current requirement/design/memory bytes, tracked permit acquisition and release, readiness-before-pending-close order, active-session drain window, Spring lifecycle phases, permission-free activation, local focused JUnit XML and this report’s readback. Reviewer reported no writes, builds, tests, scripts, SSH, or managed runtime actions. The reviewed source hashes are recorded in §F-CP04-02; reviewer found the pre-final report snapshot complete. This final verdict changes only the reconciliation status field and closes CP-04 for progression to Step 7.

# Terminal activation batch 1 · first dynamic run 6c admission

> Historical admission snapshot. Its prior 6b/6c verdict applied to earlier source bytes and its
> launch opportunity has been consumed by later failed managed attempts. It does not admit a new
> current-byte run; use the 2026-09-28 6b/6c records.

```text
REVIEW_TARGET=FIRST_DYNAMIC_RUN_6C_ADMISSION
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/terminal_activation_current_6b_review
WHOLE_BATCH_6B=HISTORICAL_MATCHED_NOT_CURRENT
LAUNCH_ADMISSION=HISTORICAL_PASS_CONSUMED_NOT_CURRENT
FIRST_BUSINESS_OPERATION=storeTerminalActivationBusinessPrecedence
FIRST_RUN_COMMAND=scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight
FIXTURE_DENOMINATOR=INDEPENDENT_SOURCE_REVIEW_PASS
FAILURE_FAMILY_SCAN=LAUNCH_ADMISSION_SNAPSHOT:THREE_PRE-FIX_RUNTIME_PRE-FLIGHT_FAILURES_PLUS_THREE_REMOTE_GRADLE_INITIALIZATION_FAILURES; LATER_RUNS_AND_CLASSIFIER_CORRECTION_ARE_APPENDED_BELOW; BUSINESS=NOT_RUN; CLEANUP=FAIL/PASS/PASS/PASS/PASS/PASS
CURRENT_DEV_MANIFEST=ABSENT; V2S_RUNTIME_DIR=UNSET; DEV_WAS_RUNNING=false
LOCAL_MANAGED_RESOURCE_PREFLIGHT=PASS; LIVE_MANAGED_PROCESSES=0; MANAGED_RSS_MB=0; BUDGET_MB=4096; AT=2026-09-27T09:09:32Z
REMOTE_RESOURCE_PREFLIGHT=NOT_RUN_AFTER_CURRENT_RUNTIME_PIN; TOPOLOGY_RESULT=NOT_RUN; BUSINESS=NOT_RUN; CLEANUP=NOT_RUN
```

## Independent launch verdict

The fresh reviewer confirmed whole-batch 6b as `MATCHED`, `M/S/N=0/0/0`, and separately admitted
only entry to the managed remote preflight for the exact operation below. The selected business
scenario and command remain valid after the runner-only runtime diagnostic change. Remote runtime,
topology, scenario, and cleanup are still unproven and must remain `NOT_RUN` until the next managed
invocation supplies evidence.

The scenario is selected by the real `@AcceptanceScenario` catalog at
`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreTerminalAcceptanceScenarios.java:407-507`.
Its business oracle covers malformed-secret rejection without echo/bind/audit, first activation to
generation 1, disabled-store rejection for another device, same-secret retry returning generation 1,
same-device fresh-secret activation to generation 2, store re-enable, and final active-generation /
audit readback. `--topology-preflight` adds the R3-M1 registration race and V-S12 outage checks as
separate TDS `CONTRACT` results, outside the business denominator.

The exact first invocation is:

```bash
scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight
```

## Preserved failure history and current entry facts

| Run | Evidence | Result | Business | Cleanup |
|---|---|---|---|---|
| `r5-tc-1790498701974-97207` | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790498701974-97207/run-manifest.json` | Runtime preflight failure; initial diagnostics were discarded | `NOT_RUN` | `FAIL` |
| `r5-tc-1790499234402-7993` | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790499234402-7993/run-manifest.json` | Exact observed runtime was Node `22.23.2` / Undici `6.28.0`, then mismatched against the former pin | `NOT_RUN` | `PASS` |
| `r5-tc-1790499453277-12156` | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790499453277-12156/run-manifest.json` | All PATH candidates checked against the former pin; same observed runtime mismatch | `NOT_RUN` | `PASS` |
| `r5-tc-1790500404959-33264` | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790500404959-33264/run-manifest.json` and preserved JUnit XML | Remote preflight passed; Spring initialization failed because a lazy PostgreSQL mapped-port property was resolved before container start | `NOT_RUN` | `PASS` |
| `r5-tc-1790501452342-53694` | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790501452342-53694/run-manifest.json` and preserved JUnit XML | Mapped-port resolution advanced; Spring failed creating the CGLIB proxy for final `ActivateTerminalOperation` | `NOT_RUN` | `PASS` |
| `r5-tc-1790502028184-64811` | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790502028184-64811/run-manifest.json` and preserved JUnit XML | Two Tomcat servers started; harness then incorrectly called `getBean(WebServerApplicationContext.class)` on the returned context | `NOT_RUN` | `PASS` |
| `r5-tc-1790502535383-74594` | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790502535383-74594/run-manifest.json` and preserved JUnit XML | Two business servers started; secondary context scanned acceptance metrics configuration and failed the unique-sink assertion before TDS or business execution | `NOT_RUN` | `PASS` |
| `r5-tc-1790503255454-88325` | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1790503255454-88325/run-manifest.json` and preserved JUnit XML | Both business contexts passed setup; TDS capacity lookup used worker `user.dir` and missed the existing repo-root file before TDS startup | `NOT_RUN` | `PASS` |

The current plan/design pin now exactly matches the observed remote Node `22.23.2` / bundled Undici
`6.28.0` runtime. Focused runner tests and the current-byte static verification pass; they do not
replace the remote retry. Immediately before this admission was recorded, the local managed
resource checker reported zero live managed processes, zero RSS, and `STATUS=PASS`. The managed
runner must still prove an empty remote Testcontainers inventory, valid required TDS capacity, and
an accepted Node runtime before workspace preparation or test execution.

`CURRENT_DEV_MANIFEST=ABSENT` and `V2S_RUNTIME_DIR=UNSET`; no DEV was running, so no DEV stop or
restart is part of this run. This record is launch admission only, not remote resource, topology,
business, or cleanup proof.

## Failure disposition and focused retry entry

The JUnit XML at
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1790500404959-33264/test-results/apps/backend/catering-business-server/build/test-results/test/TEST-com.catering.v2s.app.acceptance.BackendAcceptanceTest.xml:63-68`
identified the exact lifecycle defect: Spring resolved `POSTGRES.getJdbcUrl()` from a dynamic
property while parsing auto-configuration, before the Testcontainers extension had started the
container. `BackendAcceptanceTest.applicationProperties` now starts both mapped-port providers
(PostgreSQL and MinIO) before supplier registration. Its focused regression test proves both
missing-start cases fail with their specific markers and is included in the explicit Node test
health list.

Fresh read-only CP-05 reconciliation of the production source fix returned `MATCHED`, `M/S/N=0/0/0`;
the reviewer did not run tests or remote operations. The additional MinIO red mutation was added
after that review. Current local proof for the updated test is `node --test
scripts/test/backend-acceptance-structure.test.mjs` PASS 5/5; project-memory index/check also PASS.
These close only focused/static evidence. The exact operation remains the sole retry; remote
topology, business and WebSocket checks are still unproven.

Five managed Gradle attempts were persisted with the same opaque `REMOTE_GRADLE_EXIT_NONZERO` category even though retained JUnit files showed five distinct initialization roots. I should have stopped after the second opaque category and repaired the runner's evidence classification before proceeding; I did not. The first cause was fixed by starting mapped-port providers before dynamic property registration. The second was fixed by making both transactional activation coordinators proxyable. The third showed that the harness queried the returned context as a Bean; it now type-checks/casts the returned object. The fourth showed secondary-context test configuration and custom Flyway leakage; profile exclusion and standard-property conditioning isolate it. The fifth showed that `user.dir` was the subproject directory, not repository root; the capacity file now resolves through an explicit Gradle repository-root property with real-path containment. New focused tests cover these repairs, and the R5 runner's JUnit-first category selection has its own regression control. Historical cleanup for all five Gradle failures is PASS. No further remote attempt has run since the fifth failure; the next launch remains the same exact operation.

## Fourth remote initialization failure and repair boundary

`r5-tc-1790502535383-74594` (started `2026-09-27T09:48:55.384Z`) compiled successfully and started two
Tomcat servers, then failed at `BackendAcceptanceTest.java:736` with
`BACKEND_ACCEPTANCE_SECOND_CONTEXT_INSTALLED_METRICS_SINK`. The second context had also run the
custom Flyway `businessFlyway` init bean despite the local `spring.flyway.enabled=false` property.
JUnit XML confirms the test failed in `@BeforeAll` before TDS startup; business is `NOT_RUN` and
cleanup is `PASS`. The runner's missing HTTP event artifact is downstream of the context failure.

Root repair: `BackendAcceptanceMetricsConfiguration` is excluded under the explicit secondary profile;
the app-owned Flyway bean now honors `spring.flyway.enabled`; the secondary-context assertions require
no sink, registration or Flyway bean. Red controls cover removing the profile, exclusion, disable
property and Flyway condition. Current structure proof is 8/8 and project-memory build/check pass.
The local resource preflight at 09:47 UTC predates this run and is stale; run it again before retry.
Do not switch scenarios. No topology or business result has passed yet.

## Fifth remote initialization failure and repair boundary

`r5-tc-1790503255454-88325` (started `2026-09-27T10:00:55.454Z`) passed remote preflight and started both business contexts. The archived JUnit at
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1790503255454-88325/test-results/apps/backend/catering-business-server/build/test-results/test/TEST-com.catering.v2s.app.acceptance.BackendAcceptanceTest.xml:5-6`
shows `TDS_CAPACITY_CONFIG_MISSING` before TDS startup, HTTP requests or WebSocket contracts; business is `NOT_RUN`, cleanup `PASS`. The acceptance worker's `user.dir` is the business subproject, not the repository root, so resolving `scripts/env/tds-dev-capacity.json` from it fails even though the file is present.

The repair injects `rootProject.projectDir` as the required `v2s.acceptance.repository-root`, resolves the file only beneath that root, and checks canonical paths to reject symlink escape. Structure red controls cover the absent property, `user.dir` fallback and missing containment check. Focused proof is backend acceptance structure 9/9 and R5 runner 35/35; memory build/check pass. The new dynamic retry remains pending.

The same five manifests all used an opaque Gradle exit category. I should have frozen after the second; retained JUnit XML shows that their causes were distinct, but that evidence was not reflected in the runner's category field. The R5 runner now selects archived JUnit evidence before Gradle wrapper markers. Its focused test verifies JUnit precedence, meaningful Gradle fallback, unavailable-detail fallback and wiring into the execution failure path. Do not start another managed run until current-byte static checks, reconciliation and resource preflight are refreshed.

Current-byte static status: identity-only `scripts/verify --validate-only` PASS, runId
`ter-local-static-25528-1790504968405`, `EXECUTED=35/35`; R5 runner tests PASS 35/35,
backend-acceptance structure tests PASS 9/9, project-memory build-index/check PASS. The first
identity-only verify stopped at `backend-spotless-check` on a new two-line wrap; that exact format
defect is repaired, preserved here as a first failure, and the full static entry then passed. These
results do not prove TDS startup or business behavior. Reconciliation and a new managed resource
preflight are still required before the same exact remote retry.

## Actual first-run topology and business result

The exact admitted command later completed successfully as managed run
`r5-tc-1790516314218-64728` (`2026-09-27T13:38:34.218Z`–`13:40:15.354Z`). Evidence is bound to
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1790516314218-64728/run-manifest.json` and its
TDS, wire-client, contract, HTTP, DB-operation, and JUnit artifacts in the same directory.

```text
TOPOLOGY=PASS; two business contexts plus separately managed TDS process; shared remote PostgreSQL
RUNTIME=PASS; Node 22.23.2 / Undici 6.28.0; raw socket client and Unix-domain gate available
TDS_CAPACITY=PASS; scripts/env/tds-dev-capacity.json; RSS budget 512 MiB; U=4; tracked sessions=8
BUSINESS=PASS; selected storeTerminalActivationBusinessPrecedence; DB_OPERATIONS=7
TDS_CONTRACT=PASS; 3/3; positive topology, registration race, 10-second database outage/recovery
OUTAGE=PASS; observed pause 11,790 ms; one PONG during outage; recovery close/readback in 5,131 ms
CLEANUP=PASS; remote process/workspace and Testcontainers container/volume query and cleanup all PASS
DEV_WAS_RUNNING=false; DEV stop/restart NOT_APPLICABLE
```

The archived TDS log contains `tds_ws_close_started` for the registration-race cancellation,
outage-triggered `SERVER_ERROR`, post-recovery active-session cancellation, and invalid credential
close. This confirms that the added central close-path diagnostic is emitted by the real TDS process
for owner-initiated and peer-triggered closes. The log fields are allowlisted and contain no secret,
credential, device identity, authorization value, or raw payload.

## R3-M1 expected-red control result

The separately admitted control ran as
`r5-tc-1790516560304-69487` (`2026-09-27T13:42:40.305Z`–`13:44:49.546Z`). It changed only the
remote staging copy of `TerminalActor.generationRevoked` to disable the generation check. The
selected real HTTP business scenario remained `PASS`; the TDS contract observed `SESSION_READY`
and then the exact `TDS_VS10_REGISTRATION_RACE_RED_CONTROL` / wire-read-timeout marker. The JUnit
failure was the intended mutation red, and the runner classified `productionMutation.verdict=PASS`
with `testExecution.expectedFailure=true`; the managed manifest and resource cleanup are `PASS`.
This is expected red evidence, not an implementation regression or an unclassified test failure.

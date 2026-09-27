SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

# Batch 1 implementation · focused compile failure diagnosis

## Preserved first failure

```text
RUN_ID=D40-FOCUSED-2026-09-26T1532Z
COMMAND=./gradlew :apps:backend:catering-business-server:modules:terminal-binding:test --console=plain
TIME_UTC=2026-09-26 15:32 UTC
RESULT=FAIL; the module's compileJava task failed before tests ran
FAILURE_CATEGORY=BACKEND_JDBCTEMPLATE_EXECUTE_OVERLOAD_AMBIGUITY
SOURCE=apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/persistence/TerminalBindingOwnerPersistence.java:268
SIGNAL=reference to execute is ambiguous; JdbcTemplate.execute(PreparedStatementCreator, PreparedStatementCallback<T>) and execute(CallableStatementCreator, CallableStatementCallback<T>) both match
```

The complete compiler output was retained in the task output. This was the first observed failure for this failure category; no retry preceded diagnosis.

## Root cause and finite denominator

The production call passed two inferred lambdas to overloaded `JdbcTemplate.execute` SAM parameters. `Connection.prepareStatement` and the method reference `PreparedStatement::execute` left overload selection ambiguous at Java compile time. The first compile failure arose while compiling the newly added terminal-binding module; this is an owning-source compile defect, not a Testcontainers, Docker, SSH, or environment failure.

Reproduction scan:

```bash
rg -n "(?:jdbc|JdbcTemplate|template|jdbcTemplate)\\.execute\\(" apps/backend --glob '*.java'
```

Complete hit set at diagnosis:

| Location | Form | Disposition |
| --- | --- | --- |
| `modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogCategoryOwnerIntegrationTest.java:2330` | `jdbc.execute(String)` | No overloaded SAM ambiguity. |
| `modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogCategoryOwnerIntegrationTest.java:2340` | `jdbc.execute((ConnectionCallback<List<String>>) ...)` | Explicit callback type; no ambiguity. |
| `modules/platform-admin-iam/src/main/java/com/catering/v2s/platform/iam/application/persistence/PlatformAuthenticationPersistence.java:302` | `jdbc.execute(String)` | No overloaded SAM ambiguity. |
| `modules/platform-admin-iam/src/test/java/com/catering/v2s/platform/iam/application/PlatformAuthenticationServiceTest.java:87` | `jdbc.execute(String)` | No overloaded SAM ambiguity. |
| `modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/persistence/TerminalBindingOwnerPersistence.java:268` | Two inferred functional-interface lambdas | Only ambiguous production call; annotate the first argument as `PreparedStatementCreator`. |
| `modules/workspace-iam/src/test/java/com/catering/v2s/workspace/iam/application/WorkspaceIamIndexMigrationIntegrationTest.java:107` | `jdbc.execute(String)` | No overloaded SAM ambiguity. |

The smaller working local comparison is the explicitly typed `ConnectionCallback` call in `CatalogCategoryOwnerIntegrationTest.java:2340`. The repair keeps the original prepared-statement behavior and adds only the missing `PreparedStatementCreator` type at the call site; SQL, parameters, transaction use, and notification semantics do not change.

## Prevention disposition

`NOT_APPLICABLE_WITH_REASON`: the complete current `JdbcTemplate.execute` call-site family has one ambiguous production instance, and normal `compileJava` type-checking rejects that exact shape before any test can pass. The smallest reusable remedy is an explicit functional-interface type on overloaded SAM calls; no extra gate or project-memory rule is warranted for this single compiler-detectable occurrence. The owner module compile is included in the next focused verification.

## Repair and verification

The explicit `PreparedStatementCreator` annotation closed the compile failure: the next same focused Gradle run compiled `terminal-binding` production and test sources, then ran 18 tests. It exposed a separate test-oracle failure, preserved as:

```text
RUN_ID=D40-FOCUSED-2026-09-26T1533Z
TIME_UTC=2026-09-26 15:33:53.027Z
FAILURE_CATEGORY=TEST_FIXTURE_GROUP_STATUS_MISMATCH
TEST=TerminalCredentialVerificationServiceTest.currentCredentialIgnoresStoreDisabledButRequiresEnabledGroupAndTerminal
EXPECTED=VERIFIED
ACTUAL=GROUP_WORKSPACE_DISABLED
LOCATION=TerminalCredentialVerificationServiceTest.java:33
```

Reading the actual test helper and `TerminalCredentialVerificationService.verify` showed that the fixture passed `groupStatus="DISABLED"`, although this case intends to prove that a disabled store is ignored while group and terminal are enabled. The helper already hard-codes `storeStatus="DISABLED"`; the minimal correction is to set the fixture group to `ENABLED`, preserving the scenario's disabled-store condition. The other group-disabled and terminal-disabled cases remain unchanged. The complete relevant denominator is the fixture calls in `TerminalCredentialVerificationServiceTest`; only this one success case contradicted its own intended state. This is a test-fixture inconsistency, not a production regression, so no new global rule or gate is warranted.

After correcting the contradictory fixture, the same focused task passed:

```text
RUN_ID=D40-FOCUSED-2026-09-26T1534Z
TIME_UTC=2026-09-26 15:34:53Z
COMMAND=./gradlew :apps:backend:catering-business-server:modules:terminal-binding:test --console=plain
RESULT=BUILD SUCCESSFUL; 18 tests across four terminal-binding test classes; XML reports show 0 failures and 0 errors
```

The first failure remains preserved above; the next execution passed only after the production SAM type and the contradictory test fixture changed. The diagnostic closure covers a local module compile/test only. No remote, Docker-backed, DEV, HTTP acceptance or TDS run was started.

## Local formatting-gate failures after D-40 edits

```text
RUN_ID=D40-SPOTLESS-LINE-LIMIT-2026-09-26T1535Z
COMMAND=./gradlew :apps:backend:catering-business-server:modules:terminal-binding:spotlessCheck --console=plain
TIME_UTC=2026-09-26 15:35 UTC
RESULT=FAIL at backendJavaUtf8LineLimit; task output displayed its first three long lines only
```

The owning root gate is `build.gradle.kts:80-104`; it scans every Java source below the module and caps diagnostics with `violations.take(3)`. A full independent byte-length enumeration of `modules/terminal-binding/src/**/*.java` found 12 lines longer than the 120-byte limit (all production sources, none in tests): `TerminalBindingOwnerApi.java:55,76,79`; `TerminalBindingOwnerService.java:56,72,133,134,171,277`; `TerminalBindingOwnerPersistence.java:31,246,301`. All 12 were wrapped without changing tokens or SQL literals. The complete post-edit scan reports zero overlong Java lines.

The line-limit gate then passed, and the same command exposed existing Spotless Java formatting differences in the newly authored terminal-binding files. The output listed `TerminalBindingAuditReadApi.java`, `TerminalBindingOwnerApi.java`, `TerminalCredentialVerificationApi.java`, `TerminalBindingOwnerService.java`, `TerminalBindingAuditEventWriter.java`, `TerminalBindingOwnerPersistence.java`, and four application test classes; the diff itself was truncated after the first files. This was formatting-only, not a production behavior or external-runtime failure. Applied the repository's targeted formatter `./gradlew :apps:backend:catering-business-server:modules:terminal-binding:spotlessJavaApply --console=plain` successfully. The subsequent complete byte-length scan and module `spotlessCheck` plus focused unit test are pending; no remote, SSH, tunnel, Docker/Testcontainers, DEV, HTTP acceptance, TDS, L2, reset, or seed process was started.

```text
RUN_ID=D40-SPOTLESS-CHECK-2026-09-26T1540Z
TIME_UTC=2026-09-26 15:40 UTC
RESULT=PASS; backendJavaUtf8LineLimit, spotlessJavaCheck, spotlessCheck all successful; full Java line-length scan found 0 lines over 120 bytes

RUN_ID=D40-FOCUSED-2026-09-26T1541Z
COMMAND=./gradlew :apps:backend:catering-business-server:modules:terminal-binding:test --console=plain
TIME_UTC=2026-09-26 15:41:01 UTC
RESULT=BUILD SUCCESSFUL; 18 tests across four XML reports, 0 failures, 0 errors, 0 skipped
```

The formatter changed Java layout only; rerunning the owning module tests against the formatted current bytes passed. These remain local module proofs and do not establish migration, HTTP, WebSocket, managed-runtime, remote topology, or L2 behavior.

## First business-app compile failure after Step 3 checks

```text
RUN_ID=BUSINESS-COMPILE-2026-09-26T1549Z
COMMAND=./gradlew :apps:backend:catering-business-server:compileJava --console=plain
TIME_UTC=2026-09-26 15:49:35 UTC
RESULT=FAIL; 6 unresolved generated-wire type references
FAILURE_CATEGORY=STORE_TERMINAL_BINDING_WIRE_SCHEMA_OUTPUT_MISSING
SYMBOLS=com.catering.v2s.app.edge.generated.wire.StoreTerminalBinding, StoreTerminalBindingStatus
CONSUMERS=StoreTerminalBindingWireSerializationConfiguration.java; OperationsStoreTerminalController.java
```

The complete compiler output was retained in the task output. The business modules compiled through `store-terminal` and `audit-read`; failure occurred compiling the application. At the time of the failure, no retry preceded diagnosis. The initial source inspection showed that the controller constructs `StoreTerminalBinding` from the owner detail's `binding()` projection, while the current `contracts/openapi-source/store-terminal.schemas.json` and materialized store-terminal component schema had no `StoreTerminalBinding` schema/property. The root cause and repaired retry are recorded below. No remote process, SSH tunnel, DEV, Testcontainers, reset, seed, or L2 action was involved.

## Step 3 contract-generation repair

R-3.7 (`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:160-164`) requires the operations detail response to include exactly one binding state: `INACTIVE`, or `ACTIVE` with activation time and generation, without device identity or credentials. The implementation design's §9a detail-read row and the existing owner/controller mapping already implement that response. The canonical OpenAPI source omitted the response field and both named schemas, so the generated Java wire classes were absent even though earlier generator checks passed.

The owning source `contracts/openapi-source/store-terminal.schemas.json` now declares `StoreTerminalBindingStatus`, a closed `StoreTerminalBinding`, the two `oneOf` state shapes, and required `StoreTerminalDetail.binding`. The R5 component baseline now names both components so they materialize as first-class components. The R5 catalog hash for this repository-owned source was refreshed to the new source bytes while keeping the fail-closed hash comparison intact; no external source/hash, generator check, or generated output was bypassed. Materialization and edge-codegen remain the only producers for their respective outputs.

Preserved first materializer failure after changing the canonical source:

```text
RUN_ID=TERMINAL-BINDING-MATERIALIZE-2026-09-26T155606Z
TIME_UTC=2026-09-26 15:56:06 UTC
RESULT=FAIL; R5_EDGE_HERITAGE_HASH_DRIFT:contracts/openapi-source/store-terminal.schemas.json
```

The mismatch was the catalog's local source-byte pin, not a path outside the repository or a former-project read. The correction refreshed that local input hash and added the two newly owned named components to `componentFieldBaseline`; it did not remove or weaken the hash check.

Current-byte generation and verification:

| Run ID | Command | Result |
| --- | --- | --- |
| `TERMINAL-BINDING-MATERIALIZE-2026-09-26T155816Z` | `node scripts/generate/r5-edge-materialize.mjs` | PASS; 235 operations, faces 61/162/12 |
| `TERMINAL-BINDING-EDGE-CODEGEN-IDENTITY-WRITE-2026-09-26T155827Z` | `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node scripts/generate/edge-codegen.mjs --write` | PASS; 431 files |
| `TERMINAL-BINDING-R5-CHECK-2026-09-26T155855Z` | `scripts/check/r5-edge-materialize --check` | PASS; 15.45 s |
| `TERMINAL-BINDING-EDGE-CODEGEN-CHECK-2026-09-26T155855Z` | `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/check/edge-codegen --check` | PASS; 431 files, 0.18 s |
| `BUSINESS-COMPILE-REPAIR-2026-09-26T155923Z` | `./gradlew :apps:backend:catering-business-server:compileJava --console=plain` | BUILD SUCCESSFUL; 1 s; four Spring/Jackson deprecation warnings |
| `CP03-REQUIRED-GATES-2026-09-26T160116Z` | module dependency registry; Flyway layout; M1 command bindings `--check` | PASS; rows/emitted 119 |
| `OPERATIONS-ADMIN-TYPECHECK-BINDING-2026-09-26T160139Z` | `yarn typecheck` in `apps/frontend/operations-admin` | PASS; exit 0 |

Generated current-source hashes: canonical source `6b42829a1a227d3d576160be965c6bdffd5beba01d223b41557bcf5198cb966d`; catalog `614025446577bb391a0f9508742896c5353118a97568a407b8052ef4db3bef62`; materialized store-terminal schema `71f77c73d2468a77dbe2d27aa056b7cac61ad302aecd8440cfd274bf128439e3`; generated Java `StoreTerminalBinding.java` `b3a44e0437828f02d558fa998e2dbd481004854378d5be5676bb0e4d6d51efce`; generated Java `StoreTerminalBindingStatus.java` `7ba3ecbb17faab2bc4330f363e4b9aae3dc83fc1a474b5c7fcbbad0a945a0873`; generated operations-admin wire `operations-edge.ts` `487f37f692eef609b1e903c6f5c6dddf9528a873b688a02068fd01b7e3eb6a5f`.

The app compile now resolves both missing types. This is local source/generation/type proof only; the required real HTTP contract readback and its `INACTIVE`/`ACTIVE` behavior remain for the later authorized managed backend-acceptance stage. This change started no remote process, SSH tunnel, DEV, Testcontainers, reset, seed, or L2 run.

## Preserved CP-05 focused-test invocation failure

```text
RUN_ID=NOT_ASSIGNED; direct unmanaged local Gradle invocation
TIME_UTC=2026-09-27 01:27 UTC (captured immediately after the command; command-level timestamp unavailable)
COMMAND=./gradlew :apps:backend:catering-business-server:test --tests com.catering.v2s.app.acceptance.TdsRegistrationGateBrokerTest --no-daemon --console=plain
RESULT=FAIL before test execution; V2S_TESTCONTAINERS_REMOTE_REQUIRED
FAILURE_CATEGORY=BACKEND_ACCEPTANCE_REQUIRES_MANAGED_REMOTE_TESTCONTAINERS
```

The command compiled `catering-business-server:compileTestJava` successfully, then the root test guard rejected the local test task before JUnit or Docker discovery. The guard at `build.gradle.kts` requires every app test task that can reach Testcontainers to run through `scripts/test/r5-remote-testcontainers.mjs`; `scripts/README.md` explicitly prohibits the local Docker fallback. No container, SSH tunnel, DEV process, TDS process, or database action was started. The guard output is the preserved first-failure evidence; there is no managed run manifest or run id for this rejected invocation.

No direct Gradle test retry or alternate local JUnit/classpath route is permitted. The broker test may run only as part of an authorized managed remote Testcontainers invocation, after the whole-batch 6b/6c and topology entry conditions pass. Until then, the new exact-terminal/generation broker case has compile evidence only; execution is `DEFERRED_UNTIL_MANAGED_REMOTE_ACCEPTANCE`. This records an invocation mistake and its fail-closed boundary, not a product or test failure.

## Preserved CP-05 Java formatting failure and repair

```text
RUN_ID=NOT_ASSIGNED; unmanaged local static Gradle invocation
OBSERVED_AT=2026-09-27 01:28:57 UTC; Gradle did not emit a command timestamp
COMMAND=./gradlew :apps:backend:catering-business-server:spotlessJavaCheck :apps:backend:catering-business-server:compileTestJava --no-daemon --console=plain
RESULT=FAIL at spotlessJavaCheck after compileTestJava passed
FAILURE_CATEGORY=BACKEND_ACCEPTANCE_JAVA_FORMATTING
FILES=BackendAcceptanceTest.java; StoreTerminalAcceptanceScenarios.java; TdsAcceptanceProcess.java; TdsRegistrationGateBroker.java; TdsRegistrationGateBrokerTest.java; TerminalConnectionContractScenarios.java
```

The checker supplied formatter diffs for the first file and identified all six violating Java files. The failure was formatting-only. After reading the owning backend Java line-length/format rules and the affected source, applied the repository formatter to the business app Java sources. The current bytes then passed both `spotlessJavaCheck` and `compileTestJava`:

```text
COMMAND=./gradlew :apps:backend:catering-business-server:spotlessJavaApply --no-daemon --console=plain
RESULT=BUILD SUCCESSFUL; 1 formatting task executed

COMMAND=./gradlew :apps:backend:catering-business-server:spotlessJavaCheck :apps:backend:catering-business-server:compileTestJava --no-daemon --console=plain
RESULT=BUILD SUCCESSFUL; 26 tasks; spotlessJavaCheck and compileTestJava passed
```

These are local formatting and compilation checks only. The managed business acceptance tests, including `TdsRegistrationGateBrokerTest`, remain deferred until their authorized remote entry conditions are met.

## Preserved CP-05 formatter failure after race-client category tightening

```text
RUN_ID=NOT_ASSIGNED; local static Gradle invocation without a managed run manifest
OBSERVED_AT=2026-09-27 01:59:31 UTC (captured after repair; Gradle did not emit invocation time)
COMMAND=./gradlew :apps:backend:catering-business-server:spotlessJavaCheck :apps:backend:catering-business-server:compileTestJava :apps:backend:terminal-data-server:spotlessJavaCheck :apps:backend:terminal-data-server:compileTestJava --no-daemon --console=plain
RESULT=FAIL at :apps:backend:catering-business-server:spotlessJavaCheck; the formatter identified one layout difference in TerminalConnectionContractScenarios.java
FAILURE_CATEGORY=BACKEND_ACCEPTANCE_JAVA_FORMATTING
SIGNAL=Map.entry("clientFailureCategory", result.path("failureCategory").asText()) required a wrapped argument layout
```

The command did not reach the business app `compileTestJava` task. The TDS `spotlessJavaCheck` and `compileTestJava` tasks were already up to date. This is the same formatting failure family previously seen in CP-05, so further CP work was frozen until the owning formatter boundary was closed again. The Java source, R3-M1 design, and acceptance scenario were reread; the formatter changed layout only and preserved the assertion that the injected mutant must produce the exact wire-client socket-read timeout after `SESSION_READY`.

Repair and current-byte focused proof:

```text
COMMAND=./gradlew :apps:backend:catering-business-server:spotlessJavaApply --no-daemon --console=plain
RESULT=BUILD SUCCESSFUL; one formatting task executed

COMMAND=./gradlew :apps:backend:catering-business-server:spotlessJavaCheck :apps:backend:terminal-data-server:spotlessJavaCheck --no-daemon --console=plain
RESULT=BUILD SUCCESSFUL; both app format gates PASS

COMMAND=./gradlew :apps:backend:catering-business-server:compileTestJava :apps:backend:terminal-data-server:compileTestJava --no-daemon --console=plain
RESULT=BUILD SUCCESSFUL; both app test source sets compile

COMMAND=node --test --test-name-pattern='backend acceptance supplies every non-production server prerequisite and selection|TDS registration race mutation is exact, remote-only, and verified at the transport contract boundary' scripts/test/r5-remote-testcontainers.test.mjs
RESULT=PASS; 2 tests, 0 failures; shell and Node syntax checks also PASS
```

These are local formatter, syntax, runner-unit and Java compilation proofs only. The test bodies did not run; no remote host, SSH tunnel, Testcontainers, DEV, TDS runtime, L2, reset or seed was started.

## Preserved CP-05 pre-calibration generated-budget fixture failure and repair

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

```text
RUN_ID=NOT_ASSIGNED; direct local Node unit test, no managed runtime
OBSERVED_AT=2026-09-27 UTC; exact timestamp was not captured with the original failing command
COMMAND=node --test scripts/test/r5-remote-testcontainers.test.mjs
RESULT=FAIL; the test "a complete backend acceptance run always enforces generated budgets without an environment opt-in" threw BUDGET_NULL_REJECTED:acceptPublicInvitation
FAILURE_CATEGORY=TEST_PREMATURE_GENERATED_BUDGET_VALIDATION
BROKEN_BOUNDARY=runner unit test treated pre-CP-05 IDENTITY_ONLY generated operation identities as a calibrated budget projection
```

The failure was preserved before rerunning the test. The first failure was read alongside the owning test and runner, the generator's budget validator, the CP-05 plan, and design §12.2. Before the three all-operation CP-05 calibration reports, the plan explicitly keeps generated outputs in `IDENTITY_ONLY`; those rows have identities but intentionally lack `databaseOperationBudget`. The runner correctly rejects such a registry for a complete `ACCEPTANCE` run before it acquires resources (`scripts/test/r5-remote-testcontainers.mjs`, active-budget check). The unit test had incorrectly asked the current uncalibrated generated artifact to pass `validateBudgetRegistry`, preventing the documented pre-CP-05 static/test stage from running.

The finite same-root scan found these registry/budget readers under `scripts/test/`: `backend-performance-cp05-reclassification.mjs`, `backend-performance-operation-reconciliation.mjs`, `backend-performance-operation-reconciliation.test.mjs`, `backend-performance-budget.test.mjs`, `r5-remote-testcontainers.mjs`, and `r5-remote-testcontainers.test.mjs`. The intended identity-only behavior already has an explicit generator test in `backend-performance-budget.test.mjs`; the production runner still validates the real generated budget registry for full acceptance. Only the runner unit fixture was conflating those two stages.

Minimal repair: retain the current generated operation identities (and exact 296-operation check from `validateBudgetRegistry`), supply local test-only fixed/linear budget fixtures to the run-level verifier assertions, retain the null-budget negative mutation and fixed-budget overage assertion, and leave production loading/validation unchanged. This proves the generic acceptance verifier without inventing measured production limits. The real generated budget projection remains deferred until three current-byte calibration reports and is still checked by `scripts/verify` afterward.

Current-byte focused proof:

```text
COMMAND=node --test --test-name-pattern='a complete backend acceptance run requires and enforces budgets without an environment opt-in' scripts/test/r5-remote-testcontainers.test.mjs
TIME_UTC=2026-09-27 02:16:24
RESULT=PASS; tests=1; pass=1; fail=0; exit=0

COMMAND=node --test scripts/test/r5-remote-testcontainers.test.mjs
TIME_UTC=2026-09-27 02:16:35
RESULT=PASS; tests=31; pass=31; fail=0; duration=80.569667ms; exit=0
```

These are local Node test proofs only. No remote SSH tunnel, Testcontainers, DEV, TDS process, L2, reset, seed, database write, or other managed runtime was started. They close this unit-test failure family; they do not prove CP-05 runtime topology, full backend-acceptance, calibration, business behavior, or cleanup.

`INDEPENDENT_3D_RECONCILIATION_AT_CP_BOUNDARY` was re-read at `project-memory/operations/implementation-source-reread-discipline.md:17`; it defines one review after all CP work/focused proofs/repairs and before the next CP, with no independent gate per edit or file. `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md:79` now states the CP and whole-batch calibration preconditions without inventing a per-scenario review gate. The previous CP-02 `MATCHED` was invalidated after its reviewer disclosed that routed-memory coverage was incomplete; a new fresh full-CP review is pending.

Six-dimensional memory route used for the failure repair:

```text
task-kind=implementation; domain=backend; consumer-face=backend; owner=backend; impact=evidence; trigger=failure
```

The six kernel files and every routed path returned by `scripts/context/recall-memory` were reopened. Their SHA-256 values at readback were:

| Repository path | SHA-256 |
| --- | --- |
| `project-memory/kernel/01-workspace-and-authorization.md` | `38f06c5a5c003947f2f5a052386f593beef4d23634d9c1d2e02525c987f4e50b` |
| `project-memory/kernel/02-service-shape-and-owner.md` | `b4cc00b51fd0a2679d168ee347aa584ba0d28fa78777f61b16e6bf3ba761edfd` |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `4c68d6154af8edaf54fc2069f6cdd111433c231ae9df701b3bf94408337dc8bc` |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `85964b6b5aaec31453f321d990bff54f2ad76f8a5427174a9e2b6c7fe7ff6025` |
| `project-memory/kernel/06-heritage-and-change.md` | `f0fbf34400c0a1d89dfabe52c031e0688a169279423eb5de70dc3154b0915896` |
| `project-memory/operations/backend-acceptance.md` | `0e26f815d6988f8f975d4c82513bf25539c16970a6d0ac9c60fde9925a4fc54b` |
| `project-memory/operations/backend-readability-refactor.md` | `2f7e4747641c1f2b558484e4489c6e4ab716522d555c24b647818f84dc703ce0` |
| `project-memory/operations/phase-retrospective-and-systemic-repair.md` | `31f4d814defe1d1a5185827e714b3ca6151da06fb0e79dc2725ba5bb08ce586c` |
| `project-memory/operations/test-closed-loop.md` | `0459c5bd0d0e69366e3d8234fe16033f086ee137cccba7862adefb3fcfc65dc7` |
| `project-memory/operations/execution-economics-and-failure-family-closure.md` | `d51110be04a71d3e637d6ec62f41d5072464d0d3adb00aba2e0f8da654698412` |
| `project-memory/pitfalls/claim-versus-behavior.md` | `818038f3c54b70e5df7d68d1219b0c3ad250b83ea99e4630f422bdac04b28703` |
| `project-memory/pitfalls/green-by-existence-check.md` | `1d984aa79933cc6f396a049c0ac2767805386bd00ba1a1f37cdaa9f48ce0d234` |
| `project-memory/pitfalls/machine-gate-test-api-false-positive.md` | `8ccdd70cd9b9412d56179a02412accd0b73af058b39f8ffa35b61336f17eeee6` |
| `project-memory/pitfalls/negative-universal-claim.md` | `f06221b0894c551b794984f28f5c7938dc921829be70f23fd04e5472fda90f0e` |
| `project-memory/pitfalls/generated-output-and-static-gate-drift.md` | `83a1fcb0b3622df1282441ae51b0a876e3ea2679d635b9f61517bf2d3d8ce56b` |
| `project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md` | `24ecafd9693ea087d514a36548f21ca10222ee4b8a9c74233ebc33b5beec415e` |
| `project-memory/practices/gate-four-pieces.md` | `5b37e2d44f9307b26ea3e805372d1e6cc9e1a84fc4155ae5791646fe86f2df3b` |
```

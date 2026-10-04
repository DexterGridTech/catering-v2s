# TDP CP-01 terminal owner-read implementation delta

## Scope

This delta closes the CBS edge-to-owner execution path for the eight terminal GET operations added through the canonical OpenAPI chain. It supplements, and does not replace, the earlier CP-01 generator proof. The active contract query follows the contract owner's current business-date predicate; credential verification and store binding remain mandatory for every request.

## Source changes

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/TerminalDataReadController.java`: eight GET handlers are wired to their existing task-read owners. Current valid contracts are returned from the owner task read, with wire `VALID` state preserved; owner query order remains contract number.
- `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractTaskReadService.java` and `.../persistence/ContractTaskReadPersistence.java`: the complete fixed-store contract read uses `BusinessDateProvider.today()` and `FIXED_STORE_VIEW_CURRENT` in the same SELECT. It does not load all historical contracts and filter them at the edge.
- `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/persistence/ContractTaskReadServiceSql.java`: the store-scope predicate and existing `ORDER BY` fragment compose the owner query.
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreTerminalAcceptanceScenarios.java`: the real HTTP scenario creates an effective contract through the existing operations command, reads the complete terminal collection and exact detail, checks all eight reads, missing-contract 404 and a guaranteed-different same-length credential secret 403.
- Design/plan SQL baselines now record observed per-operation SQL counts rather than the disproven common two-SELECT estimate.

## Focused proof

- Command: `scripts/test/backend-acceptance --operation terminalDataReadOwnerRoutes`
- Current-byte run: `r5-tc-1791135081532-44283`
- Result: selected 1/1; `CONTRACT=PASS`, `BUSINESS=PASS`, TDS contract `PASS`, scenario `DB_OPERATIONS=9`; remote Testcontainers container cleanup `PASS`, volume cleanup `PASS`, evidence archive `PASS`.
- Evidence: `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791135081532-44283/run-manifest.json`, `backend-acceptance-result.jsonl.gz`, `http-request-events.jsonl.gz`, `tds-contract-result.jsonl.gz`, `gradle.log`.
- The 8 normal GET requests returned 200 and had observed SQL counts respectively: store basic 6; organization path 7; active contracts 2; contract detail 2; area collection 4; area detail 4; point collection 8; point detail 5. All were read-only with 0 SQL mutations. The separate missing detail returned 404 and the wrong-secret request returned 403.
- `./gradlew :apps:backend:catering-business-server:compileTestJava`: PASS after the final SQL and fixture changes.

## Preserved first failures and root repairs

| Run | First failure | Root cause and repair |
| --- | --- | --- |
| `r5-tc-1791134156355-26346` | Owner-created contract absent from active collection | Edge compared owner `StoreContractView.status=VALID` to database vocabulary `ACTIVE`, and did not apply the current effective-date owner query. Moved the current predicate into the contract owner query and preserved the public `VALID` wire vocabulary. |
| `r5-tc-1791134539639-33661` | Active contract GET returned 500 | The first query correction omitted the SQL `ORDER BY` keyword. Reused the existing `CONTRACT_TASK_READ_SERVICE_ORDER_BY` fragment. |
| `r5-tc-1791134726424-37351` | Same active contract GET returned 500 | The identical SQL composition defect repeated before the fix. Per failure-family rule, later route assertions remained frozen; diagnosed the generated SQL tail, then repaired it with the existing SQL fragment before continuing. |
| `r5-tc-1791134904998-40797` | Expected wrong-credential 403, got 200 | Test mutated the last credential character to fixed `A`, which could reproduce the original value. Changed the negative fixture to alter the first character deterministically while retaining valid length/alphabet. |

Each failed run's runner cleanup was separately recorded `PASS`; the above failures remain failures and are not overwritten by the later pass.

## Current reconciliation status

- Focused CP-01 terminal-read proof: `PASS` on runs `r5-tc-1791135081532-44283` and `r5-tc-1791136156911-66469`; the latter ran after adding the dependency-failure handler.
- Dependency failure contract: `TerminalDataReadControllerTest.mapsOwnerDatabaseFailureToTerminalDependencyUnavailable` passes via remote managed runner `r5-tc-1791136001954-63418`; the test drives MockMvc through the terminal route, makes the owner throw `DataAccessResourceFailureException`, and asserts HTTP 503 plus `PLATFORM_DEPENDENCY_UNAVAILABLE`. Business is `NOT_APPLICABLE`; runner process/workspace/container/volume cleanup is `PASS`.
- Latest normal-route run `r5-tc-1791136156911-66469`: `terminalDataReadOwnerRoutes` selected 1/1, `CONTRACT=PASS`, `BUSINESS=PASS`, TDS contract `PASS`, cleanup `PASS`. It covers the eight 200 routes, missing contract 404, invalid credential 403, and real state readback. Observed normal GET SQL counts remain 6/7/2/2/4/4/8/5, all with no writes in the scenario's read requests.
- Preserved runner invocation failures: an initial direct local `./gradlew ...:test --tests ...TerminalDataReadControllerTest` was rejected before tests with `V2S_TESTCONTAINERS_REMOTE_REQUIRED`; it has no managed run ID/manifest and did not start local containers. The first managed remote invocation `r5-tc-1791135809644-59531` used the default `operation=all`, reached the generator, then failed with `BUDGET_PROJECTION_OPERATION_MISSING` before test execution; remote process/container/volume cleanup was `PASS`. The next invocation explicitly used `V2S_BACKEND_ACCEPTANCE_OPERATION=terminalDataReadErrorMapping`, selected the same test, and passed. These are runner/mode failures, not behavior passes.
- Full current CP-01 three-dimensional reconciliation: pending fresh read-only reviewer result after this supplement.
- Whole-batch 6b, full-directory acceptance/calibration, DEV data chains, and Expo Web remain governed by their separate plan stages; this delta does not mark them passed.

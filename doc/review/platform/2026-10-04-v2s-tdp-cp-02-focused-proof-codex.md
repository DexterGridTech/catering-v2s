# TDP · CP-02 focused proof

```text
TASK=Terminal Data Platform data-change and remote-operations, CP-02
SCOPE=owner mutations, collection snapshots, REGION parent migration, serialization/rollback proofs
PROOF_DATE=2026-10-04
```

## Current-byte evidence

These focused runs were executed after the final CP-02 source and fixture edits recorded below. No source file changed between these runs. Testcontainers business outcome and resource cleanup are reported separately.

| Run ID | Entry / selected work | Result | Evidence |
| --- | --- | --- | --- |
| `r5-tc-1791105501262-16594` | `scripts/test/r5-remote-testcontainers.mjs :apps:backend:catering-business-server:modules:organization:test` with three `OrganizationOwnerServiceTest` method filters | BUILD PASS; 3 tests PASS; BUSINESS=N/A; resource cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791105501262-16594/` |
| `r5-tc-1791105625906-19024` | `scripts/test/backend-acceptance --operation storeServicePointAreaAvailability` | CONTRACT PASS; BUSINESS PASS; TDS contract 1/1 PASS; DB_OPERATIONS=27; resource cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791105625906-19024/` |
| `r5-tc-1791105833013-23172` | `scripts/test/backend-acceptance --operation storeServicePointAreaLifecycle` | CONTRACT PASS; BUSINESS PASS; TDS contract 1/1 PASS; DB_OPERATIONS=10; resource cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791105833013-23172/` |
| `r5-tc-1791105989912-26206` | `scripts/test/backend-acceptance --operation contract.lifecycle-preserves-fields` | CONTRACT PASS; BUSINESS PASS; TDS contract 1/1 PASS; DB_OPERATIONS=6; resource cleanup PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791105989912-26206/` |

The three owner tests assert (1) two transactions serialize before reading a previously absent area snapshot row and the final hash/time includes both committed members, (2) a rolled-back area mutation also rolls back its snapshot and PostgreSQL notification, with a committed control notification proving the listener, and (3) a REGION update retains its current CommercialGroup parent. The migration integration evidence is `r5-tc-1791104640737-97161`; its XML reports 15 tests, 0 failures/errors, including `organizationRegionParentMigrationBackfillsRealGroupWithoutChangingHistory` and `organizationRegionParentMigrationRejectsMissingCommercialGroup`. The tests are in `apps/backend/catering-business-server/src/test/java/database/MasterDataLifecycleMigrationIntegrationTest.java`.

The point-availability scenario now checks a complete sorted `SERVICE_POINT_COLLECTION` hash and time after an enabled point is added, then checks the reduced full hash and the disabled point's persisted update time after it leaves the collection. The existing area lifecycle scenario continues to check the full sorted area hash and the R-05 membership-time rule. The contract lifecycle scenario checks the complete ACTIVE contract collection snapshot after the REGION migration is applied.

## Third-party version and official-source check

The organization test runtime classpath archived with `r5-tc-1791105625906-19024` resolves `org.postgresql:postgresql:42.7.7`; the organization module build file declares that exact version and exposes it as `testImplementation`. The Testcontainers fixture in `OrganizationOwnerServiceTest` uses `postgres:16-alpine`.

- The pgJDBC exact release source [`PGConnection.java` at `REL42.7.7`](https://github.com/pgjdbc/pgjdbc/blob/REL42.7.7/pgjdbc/src/main/java/org/postgresql/PGConnection.java) defines `getNotifications()` (available since 7.3; returns null when none are pending). It defines the timeout overload only since 43. The rollback proof therefore uses the no-argument method that exists in the resolved 42.7.7 driver; it does not assume the newer overload.
- PostgreSQL 16 official [advisory lock function docs](https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS) define `pg_advisory_xact_lock` as an exclusive transaction-level advisory lock that waits if necessary. The concurrency proof holds this lock in one transaction and observes the second PostgreSQL backend waiting before releasing the first transaction.
- PostgreSQL 16 official [NOTIFY docs](https://www.postgresql.org/docs/16/sql-notify.html) state that an in-transaction notification is delivered only if/after commit; aborting the transaction also aborts the notification. The rollback proof first observes a committed control notification, then verifies that the rolled-back owner mutation emits none.

These official sources establish the relied-upon database/driver contract. The focused Testcontainers results above establish the corresponding behavior in this repository's current test setup. The PostgreSQL image is specified at major-version tag `16-alpine`, not an immutable minor image digest; no patch-specific behavior is assumed.

## Preserved first failures and root fixes

- `r5-tc-1791105254666-11610` compiled production and test code, then failed three test cases. Two failures came from the new store fixture omitting required TENANT legal name/credit code and using repeated active display names; the third old owner test passed `null` as a REGION's current CommercialGroup parent after the new invariant was introduced. The fixture now supplies required tenant values and per-fixture names; the owner test passes the existing parent identity.
- `r5-tc-1791105425920-14995` showed the remaining duplicate `ux_store_active_name` collision because the helper still used a fixed Store display name. All names created by the helper now include the fixture suffix. No production workaround was made.
- The module test compile initially could not resolve `PGConnection`, although pgJDBC was already declared as `testRuntimeOnly`. The existing `org.postgresql:postgresql:42.7.7` dependency is now `testImplementation` in the organization module; no dependency or version was added. The focused 3-test run above compiles and passes.

## Source identity

SHA-256 of CP-02 files exercised by the final runs:

| File | SHA-256 |
| --- | --- |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationHierarchyService.java` | `942d8da2ef19a29b1cfd7cee03854c7bd68344e687f72875818e00040e37c378` |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationTerminalTopicSnapshotPersistence.java` | `3ffaa12c86a3d8a357eecf1df46c339f357057f119fe68ea593b771f8ee12f51` |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationCommandPersistence.java` | `1989da8b8b791e333fd312b945fa75a9a3d0e4050115fc073ad05e676f20c673` |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationCommandService.java` | `14c02e73744b8d6ea9e4e8856fd2673059883985b701f79be7bae0b30ca3fea7` |
| `apps/backend/catering-business-server/src/main/resources/db/migration/V20261004_010000_000__organization_region_commercial_group_parent.sql` | `5b2a9973dd293d82926ae1de942ed0616aba6e0fd10fc529c2b7ab1d440822a6` |
| `apps/backend/catering-business-server/modules/organization/src/test/java/com/catering/v2s/organization/application/OrganizationOwnerServiceTest.java` | `6e42eb59b8178700133e058f191add329c7f27fb9f1694715deea34c2fc2b9ae` |
| `apps/backend/catering-business-server/src/test/java/database/MasterDataLifecycleMigrationIntegrationTest.java` | `c58572c674de6e3b695228980a064482c6b4a12a38e2a33cd801e7cfe89deebc` |
| `apps/backend/catering-business-server/modules/organization/build.gradle.kts` | `1a0ad1522438d78aa62a2b10d0c2e7727dc3d9a6ffa685a21a27a38e9208c21f` |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreServicePointAcceptanceScenarios.java` | `e8441b4b049c6a4c0731371c87f972427dee7b88b266c94446a98b943f347fa3` |

## Fresh recheck finding intake: legacy store-contract funnels

**Classification: `CONFIRMED`.** The cited package path in the incoming review did not match this checkout; reopening the current owner source located `com/catering/v2s/contract/application/ContractCommandService.java`. Formal requirement §4.1a includes the legacy parameter overloads, and the CP-02 denominator names those funnels. The current typed create/update and shared invalidate core already publish the required topic changes, but the old private `create(...)` core previously inserted and audited without locking/refreshing `VALID_CONTRACT_COLLECTION` or notifying `CONTRACT`; the old private `update(...)` core updated and audited without notifying `CONTRACT`.

The minimum fix is in those existing cores: legacy create now acquires the same collection advisory lock before mutation, then notifies the exact contract and refreshes the active collection after readback/audit; legacy update notifies the exact contract after readback/audit. It does not add an endpoint, owner, cache, or business rule. Update does not refresh the active collection because formal requirement §4.1a lists only `CONTRACT-CREATE` and `CONTRACT-INVALIDATE` as collection triggers; it does notify the exact `CONTRACT` topic, whose time is read from the updated entity.

The added `legacyCreateAndUpdatePublishContractTopicChanges` focused Testcontainers test listens on the actual PostgreSQL channel, asserts both create topics and the persisted collection snapshot, then asserts the update exact-topic notification and updated entity time. `create(...)` and `update(...)` public overloads converge on the modified private cores; invalidation already converges on its existing hooked core. The implementation uses existing JDBC notification and collection snapshot owners.

| Run ID | Command / selected proof | Result | Cleanup | Evidence |
| --- | --- | --- | --- | --- |
| `r5-tc-1791106967577-47734` | Remote focused `store-contract:test --tests ...ContractCommandServiceTest.legacyCreateAndUpdatePublishContractTopicChanges` | First failure preserved: `GRADLE_TEST_FAILURE_DETAILS_UNAVAILABLE`; compile diagnosed missing `org.postgresql.PGConnection` and `PGNotification` because the existing driver was `testRuntimeOnly` | PASS; no owned containers or volumes remained | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791106967577-47734/` |
| `r5-tc-1791107032027-49102` | Same remote focused task after changing the existing pgJDBC 42.7.7 scope to `testImplementation` | PASS; Gradle compiled `compileTestJava`, executed the exact filtered test task, and ended `BUILD SUCCESSFUL` | PASS; owned container and volume checks passed | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791107032027-49102/` |

The dependency scope change adds no artifact or version: `store-contract/build.gradle.kts` already declared `org.postgresql:postgresql:42.7.7` for test runtime. The test's direct use of `PGConnection` makes compile visibility necessary, matching the already-existing `organization` module's `testImplementation` scope.

Current source hashes for this additional proof point:

| File | SHA-256 |
| --- | --- |
| `apps/backend/catering-business-server/modules/store-contract/build.gradle.kts` | `46761085fd2d6a1fac9dbf510d25769c3da61fb7e0fb63ffbaa36348cf296240` |
| `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractCommandService.java` | `761fddb3141b23df8b08f8136c3a679e0dac687ce069111b948e6d30b3458750` |
| `apps/backend/catering-business-server/modules/store-contract/src/test/java/com/catering/v2s/contract/application/ContractCommandServiceTest.java` | `5f9e294721ead64ea2ce33fe49e1a671f20d39af7042c67453761a2a5f918969` |

This intake closes only the legacy contract mutation gap and its focused proof. Full CP-02 remains subject to fresh phase-level three-dimensional reconciliation; no later CP or whole-batch status is implied.

## Fresh CP-02 source recheck: store status transition fan-out

**Classification: `CONFIRMED`.** Formal requirement §4.1a requires every committed root-store mutation to wake both `STORE` and `STORE_OPERATING_RULE`; §4.1b separately names store status transition. Reopening `StoreService.transitionNow` showed it called only `notifyStore`, while the existing create/update paths call both topic owners. `STORE` notification does not imply a `STORE_OPERATING_RULE` notification: each is a distinct exact-topic key consumed by TDS. The smallest correction adds the existing `StorePersistence.notifyOperatingRule(...)` call beside `notifyStore(...)` in the existing transition core; it adds no new event mechanism or business behavior.

The focused regression listens on PostgreSQL `terminal_binding_events`, invokes the real store status transition, and asserts both exact topic notifications. The first attempt `r5-tc-1791107488619-58825` is preserved: production and test compilation reached the new test, then `compileTestJava` failed because the test passed `workspaceId` as the first argument to `BusinessEntityService.requireEntity`; its actual signature is `(String entityType, UUID workspaceUuid, String groupWorkspaceKey, UUID id)`. The fix corrected only this test call's argument order. No production logic or assertion was weakened.

| Run ID | Command / selected proof | Result | Cleanup | Evidence |
| --- | --- | --- | --- | --- |
| `r5-tc-1791107488619-58825` | Remote focused `organization:test --tests ...OrganizationOwnerServiceTest.storeStatusTransitionWakesBothStoreRootTopics` | First failure preserved: `GRADLE_TEST_FAILURE_DETAILS_UNAVAILABLE`; compiler reported `UUID cannot be converted to String` at the `requireEntity` call | PASS | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791107488619-58825/` |
| `r5-tc-1791107578290-60643` | Same remote focused test after correcting the argument order | PASS; `compileTestJava`, `testClasses`, selected `organization:test`, `BUILD SUCCESSFUL` | PASS; owned container/volume and remote runner cleanup passed | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1791107578290-60643/` |

Current source hashes for this finding:

| File | SHA-256 |
| --- | --- |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreService.java` | `a41ad7bdbaecbada80fb9c8f6b44e3d33f612c6f276513b4117ac3342f48ddfa` |
| `apps/backend/catering-business-server/modules/organization/src/test/java/com/catering/v2s/organization/application/OrganizationOwnerServiceTest.java` | `de6ddd95d3a8573ecb81f35fbc331a7f53a87049588d72ed60e1b98aa9500e5b` |

The focused proof closes this store transition fan-out only. Fresh independent CP-02 three-dimensional reconciliation is still required before entering CP-03.

## Boundary

This proof closes only the listed CP-02 focused assertions and supports CP-02 reconciliation. It does not claim all CP-02 mutation fan-out or the whole TDP batch has passed; remaining CP-02 work items must be reconciled against the plan. CP-03 through CP-06, whole-batch 6b, full backend-acceptance, Expo Web, DEV, final 13c and implementation review are not covered by this record. No current full `scripts/verify` verdict is claimed.

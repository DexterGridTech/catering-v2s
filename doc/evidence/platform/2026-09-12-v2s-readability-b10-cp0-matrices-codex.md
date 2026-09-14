# B10 asset CP-0 current-byte matrices

Date: 2026-09-13

This is an implementation evidence document, not a compliance ledger. It records the current source facts needed before B10 behavior pinning and typed persistence execution relocation. It does not claim that B10 has been implemented or dynamically accepted.

## Scope and current facts

| fact | current source evidence |
| --- | --- |
| aggregate/class | `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java`; `@Service` at line 54; `KEEP_SINGLE_AGGREGATE` in the implementation design |
| source size | `wc -l` = 1,989 |
| database handle | `JdbcTemplate` field at line 75 |
| object storage handle | `AssetObjectStorage` field at line 77 |
| transaction manager | `PlatformTransactionManager` field at line 78 |
| SQL text source | `application/persistence/PlatformAssetServiceSql.java`, 123 lines, `SQL_FRAGMENT_001` through `SQL_FRAGMENT_115` |
| direct JDBC invocation count | 31, receiver-qualified `jdbc.query`, `jdbc.queryForList`, `jdbc.queryForObject`, `jdbc.update`, `jdbc.batchUpdate`, `jdbc.execute` scan |
| annotated transaction count | 21 `@Transactional` entries |
| non-transaction staging entries | six public staging entry points at `PlatformAssetService.java:98,103,110,136,156,189` |
| programmatic transaction | `new TransactionTemplate(transactions)` at `PlatformAssetService.java:297` |
| asset owner tests | 29 `@Test` methods in `PlatformAssetServiceTest.java` plus 1 in `PlatformAssetServiceBatchReferenceTest.java`, 30 total |

The B10 implementation target is one minimal named typed persistence execution boundary under `application/persistence` (or the smallest equivalent named boundaries proven necessary by the method matrix). The service keeps owner authorization, target validation, request hashing, object storage, transaction orchestration, stable public APIs, public nested records/exceptions and their FQCNs. No external caller may import the new persistence class.

## Direct JDBC sink matrix

Each row is one current source invocation, not a grouped method count. The `capture key` is a stable proof identity and must not depend on source line or post-move path. `parameter shape` is the current slot shape to preserve; dynamic `N` means one slot per distinct reference in the existing bounded collection query.

| # | current source | current family | SQL source | parameter shape | capture key | current behavior/oracle |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `PlatformAssetService.java:445` | `writeStagedContent` new lifecycle row | `SQL_FRAGMENT_001..006` | 11 positional values | `asset.stage.insert` | stage row is inserted after object I/O and inside `TransactionTemplate` |
| 2 | `PlatformAssetService.java:547` | `releaseStagedSalesMenuItemImage` | `SQL_FRAGMENT_007..009` | 6 positional values | `asset.sales-menu.release-staged` | target/version/owner CAS update changes exactly one row or throws claim rejection |
| 3 | `PlatformAssetService.java:591` | `claimSalesMenuItemImages` | `SQL_FRAGMENT_010..014` | 7 positional values | `asset.sales-menu.claim-grant` | one-time grant is consumed for each locked target binding |
| 4 | `PlatformAssetService.java:622` | generic workspace-logo `claim` grant consumption | `SQL_FRAGMENT_015..019` | 4 positional values | `asset.logo.claim-grant` | valid one-time logo grant is consumed exactly once |
| 5 | `PlatformAssetService.java:633` | generic workspace-logo `claim` activation | `SQL_FRAGMENT_020..022` | 5 positional values | `asset.logo.activate` | claimed row becomes ACTIVE with owner metadata/version increment |
| 6 | `PlatformAssetService.java:681` | `claimCatalogStagedAfterAuthorization` grant consumption | `SQL_FRAGMENT_023..028` | 6 positional values | `asset.catalog.claim-grant` | authorized catalog staged asset consumes its grant |
| 7 | `PlatformAssetService.java:695` | catalog claim activation/readback | `SQL_FRAGMENT_029..032` | 5 setter slots | `asset.catalog.activate` | one row is activated and returned as `AssetReadback` |
| 8 | `PlatformAssetService.java:722` | generic active `release` | `SQL_FRAGMENT_033..034` | 3 positional values | `asset.logo.release` | owner-local ACTIVE row is released; existing no-op/update semantics stay unchanged |
| 9 | `PlatformAssetService.java:737` | generic `releaseStaged` asset update | `SQL_FRAGMENT_035..039` | 4 positional values | `asset.stage.release` | staged row with matching live grant becomes RELEASED |
| 10 | `PlatformAssetService.java:748` | generic `releaseStaged` grant cleanup | `SQL_FRAGMENT_040..041` | 3 positional values | `asset.stage.release-grant` | unconsumed grant is consumed/removed with current predicate |
| 11 | `PlatformAssetService.java:761` | private catalog staged release | `SQL_FRAGMENT_042..044` | 5 positional values | `asset.catalog.release-staged` | catalog owner/version/workspace CAS releases exactly one row |
| 12 | `PlatformAssetService.java:947` | owner-local catalog release with current version | `SQL_FRAGMENT_045..048` | 4 positional values | `asset.catalog.release-owner-local` | current version is read, CAS release occurs, then authoritative readback/receipt |
| 13 | `PlatformAssetService.java:977` | authorized catalog global release | `SQL_FRAGMENT_049..052` | 4 positional values | `asset.catalog.release-authorized` | expected-version/workspace CAS release occurs after receipt replay check |
| 14 | `PlatformAssetService.java:1020` | `lockCatalogReferences` | `SQL_FRAGMENT_053` | 2 setter slots | `asset.catalog.advisory-lock` | sorted distinct asset refs acquire PostgreSQL transaction advisory locks and remain held until completion |
| 15 | `PlatformAssetService.java:1057` | `require` | `SQL_FRAGMENT_054..055` | 1 setter slot | `asset.require` | one lifecycle row is read or typed not-found is raised |
| 16 | `PlatformAssetService.java:1086` | `readSalesMenuItemImages` | `SQL_FRAGMENT_056..059` | dynamic `N` UUID slots | `asset.sales-menu.read-batch` | bounded distinct active sales-menu image metadata is returned; missing/usage mismatch fails |
| 17 | `PlatformAssetService.java:1124` | `requireCatalogAssetInWorkspace` | `SQL_FRAGMENT_060..061` | 2 setter slots | `asset.catalog.require-in-workspace` | catalog asset/workspace ownership is checked before lifecycle command continues |
| 18 | `PlatformAssetService.java:1144` | `requireActivePublicReference` | `SQL_FRAGMENT_062..063` | 1 setter slot | `asset.public-reference.read` | one active asset is read and public URL is materialized by object-storage adapter |
| 19 | `PlatformAssetService.java:1168` | `requireActivePublicReferences` | `SQL_FRAGMENT_064..066` | dynamic `N` UUID slots | `asset.public-reference.read-batch` | one bounded query serves distinct active public references; missing entry fails |
| 20 | `PlatformAssetService.java:1372` | `deleteUnreferencedObjectAfterRollback` | `SQL_FRAGMENT_067` | 2 setter slots | `asset.rollback.reference-check` | physical object is deleted only when no relational reference remains; cleanup failure is logged and remains visible |
| 21 | `PlatformAssetService.java:1393` | `findCatalogByStorageKey` | `SQL_FRAGMENT_068..070` | 2 setter slots | `asset.catalog.find-by-content` | catalog logical reuse is workspace-scoped and content-equivalent |
| 22 | `PlatformAssetService.java:1433` | `restageReleasedCatalogContent` | `SQL_FRAGMENT_071..074` | 5 positional values | `asset.catalog.restage` | RELEASED catalog row is reopened or concurrent winner is re-read |
| 23 | `PlatformAssetService.java:1464` | `issueBindGrant` | `SQL_FRAGMENT_075..078` | 3 positional values | `asset.bind-grant.issue` | one-time grant hash/expiry is upserted for the asset |
| 24 | `PlatformAssetService.java:1517` | `writeSalesMenuAssetTarget` | `SQL_FRAGMENT_079..081` | 9 positional values | `asset.sales-menu.target-write` | exact sales-menu target relation is inserted once |
| 25 | `PlatformAssetService.java:1596` | `readLockedSalesMenuAssetAndTarget` | `SQL_FRAGMENT_082..092` | 1 setter slot | `asset.sales-menu.target-lock-read` | asset and target rows are locked together and matched to owner target |
| 26 | `PlatformAssetService.java:1644` | `activateSalesMenuAsset` | `SQL_FRAGMENT_093..096` | 8 setter slots | `asset.sales-menu.activate` | exact target/version CAS activates and returns metadata |
| 27 | `PlatformAssetService.java:1722` | `findReceipt` | `SQL_FRAGMENT_097..102` | 2 setter slots | `asset.receipt.find` | locked receipt read supplies replay/conflict/corrupt decision |
| 28 | `PlatformAssetService.java:1746` | `lockReceipt` | `SQL_FRAGMENT_103` | 2 vararg values | `asset.receipt.lock` | receipt scope/key advisory lock serializes idempotency decision |
| 29 | `PlatformAssetService.java:1753` | `lockObjectReference` | `SQL_FRAGMENT_104` | 1 vararg value | `asset.object-reference.lock` | content-addressed object reference lock serializes logical reuse |
| 30 | `PlatformAssetService.java:1772` | `recordStageReceipt` | `SQL_FRAGMENT_105..112` | 6 positional values | `asset.receipt.stage-write` | stage receipt upsert is written only after lifecycle decision and rejects mismatch |
| 31 | `PlatformAssetService.java:1799` | `recordReleaseReceipt` | `SQL_FRAGMENT_113..115` | 6 positional values | `asset.receipt.release-write` | release receipt is written after authoritative release readback |

No row is currently classified as `NONE_FOUND`. The two rows added after the first independent review (#13 and #17) are live execution points and must not be omitted from the behavior pin or effective-SQL capture.

## Transaction and persistence matrix

| family | current entry/outer boundary | persistence move | behavior that must remain in the service or outer owner |
| --- | --- | --- | --- |
| stage | public entries `:98,103,110,136,156,189`; `stageContentResult` rejects an already active transaction at `:265-268`; object I/O at `:287-313`; `TransactionTemplate` at `:297` | typed persistence receives only validated materialized metadata and writes relational lifecycle/receipt facts | materialization, digest, object key, object storage put/stat, storage exception mapping, rollback cleanup scheduling; no DB transaction may cover object I/O |
| sales-menu command | annotated public release/claim entries `:519-609`; exact target lock/read `:1577-1630`; activation `:1642-1671` | named typed methods for target lock/read, release, grant consumption, activation and target insert | owner scope/grant validation, request hash and API record mapping; preserve target lock order and version CAS |
| catalog command | annotated entries `:651-899`, `:909-1011`; catalog scope checks `:1671-1718` | named typed methods for catalog grant, activation, release, restage, content reuse, settlement and readback | owner token/grant validation, receipt replay decision, command diagnostics, public exception FQCNs |
| cross-owner lock | `lockCatalogReferences` `:1013-1052`, sorted distinct refs and transaction resource cleanup `:1032-1048` | typed `lockCatalogAssetReferences(Collection<UUID>)` equivalent | same sorted lock order, transaction-local held set, completion cleanup and outer REQUIRED transaction |
| owner reads | `require` `:1055-1067`; sales-menu batch `:1077-1121`; catalog workspace `:1123-1139`; public single/batch `:1142-1197` | typed read methods returning persistence records; service maps them to stable public records and URLs | usage/status/active/missing semantics, bounded query shape, public URL materialization and typed errors |
| rollback cleanup | transaction synchronization `:1355-1367`, reference check `:1370-1390` | typed reference-exists query only | synchronization timing, deletion after rollback, storage failure logging and no-delete-on-reference |
| receipt/idempotency | receipt lock/find/write `:1718-1810`; replay is checked before command execution | typed lock/find/record methods | request hash, replay/conflict/corrupt classification, command supplier sequencing and typed mapping |

The public `PlatformAssetService` API, compatibility constructors, public nested `AssetReadback`, `StageReadback`, `PublicAssetReference` and public nested exceptions are not persistence API. `ContractProblemAdvice` and edge consumers retain the current FQCNs.

## Caller and test-consumer matrix

### Production callers

| path:line | use | required invariant |
| --- | --- | --- |
| `apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/WorkspaceAdministrationService.java:99,223-235` | logo claim/release | claim/release owner scope, version and replay semantics |
| `apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/application/PlatformWorkspaceAdministrationTaskReadService.java:45-63` | bounded active public-reference batch/single read | one owner metadata read; no object-storage health probe |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java:1497` | catalog asset lock port | cross-owner lock ordering and transaction topology |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogCopyService.java:1573` | catalog asset lock port | same lock set and outer REQUIRED transaction |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java:59-96,1129-1151` | catalog settlement API and typed failures | catalog owner API and exception translation |
| `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuItemService.java:1112,1518-1548` | sales-menu image read/claim | active image projection and claim target semantics |
| `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuPublicationService.java:786` | sales-menu image read during publication | active image/readback semantics |
| `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuAssetCommandFacade.java:15-104` | platform asset command facade | typed platform failure translation and API shape |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/OperationsCatalogAuthenticationController.java:39-51,60-114` | passes stable asset owner to session wire mapper | constructor and session logo read paths |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/OperationsWorkspaceLoginEntryController.java:23-29,65-72` | operation-session logo read | null fallback on invalid/not-found |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/WorkspaceSessionWireMapper.java:18,122-129` | session wire logo read | same null fallback and public URL mapping |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/publicentry/invitation/PublicInvitationController.java:35-40,195-203` | public invitation logo read | public-entry output behavior |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/publicentry/passwordrecovery/OperationsPasswordRecoveryController.java:35-41,130-138` | password-recovery logo read | public-entry output behavior |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/publicentry/asset/PublicAssetController.java:14-24` | public active asset content read | public URL/content type/sha256 mapping |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/asset/PlatformAssetController.java:20-60` | platform stage/release | stage outside transaction and typed input failure |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/workspace/PlatformWorkspaceAdministrationController.java:19,201` | public nested reference map | stable `PublicAssetReference` type |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java:176-200,248-265,290-334,375-412,425-455` | asset scope/invariant/not-found/idempotency/validation/storage mapping | stable nested exception FQCN, status/code/message/logging |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/platform/asset/application/operations/StageOperationsCatalogAssetMultipartOperation.java:42` | catalog stage API port | operation readback and owner boundary |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/platform/asset/application/operations/ReleaseOperationsCatalogStagedAssetOperation.java:53` | catalog release API port | operation readback and owner boundary |

### Test consumers

| path:line | current seam | required proof |
| --- | --- | --- |
| `apps/backend/catering-business-server/modules/asset/src/test/java/com/catering/v2s/platform/asset/application/PlatformAssetServiceTest.java:51-108` | real service/Testcontainers fixture and compatibility constructor | current service behavior and constructor remain usable |
| `apps/backend/catering-business-server/modules/asset/src/test/java/com/catering/v2s/platform/asset/application/PlatformAssetServiceBatchReferenceTest.java:19-58` | mocked `JdbcTemplate` batch query shape | one bounded query and exact binding order |
| `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogBatchStatusTransitionIntegrationTest.java:13,66-73` | `CatalogOwnerService` compatibility-constructor seam with `CatalogAssetReferenceLock` | catalog owner construction and cross-owner lock dependency remain injectable |
| `apps/backend/catering-business-server/modules/workspace/src/test/java/com/catering/v2s/platform/workspace/application/PlatformWorkspaceAdministrationTaskReadServiceTest.java:27,38,46,55,61,71` | active-reference batch mock/verify | no extra owner interaction |
| `apps/backend/catering-business-server/modules/sales-menu/src/test/java/com/catering/v2s/salesmenu/application/SalesMenuAssetCommandFacadeTest.java:31,39,62,92,114` | stage/claim/release failure translation | platform-to-sales-menu typed failure mapping |
| `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogCategoryOwnerIntegrationTest.java:84-90,2084,2193-2203,3295-3301,3352-3358,4902-4916` | catalog owner compatibility-constructor seams, coordinator asset settlement seams, recording/task-read construction | constructor, lock dependency, settlement API and task-read topology remain stable |
| `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogAssetGlobalReferenceTest.java:40,57-58,106-119,146-188` | real asset owner lock/require/release/cross-workspace behavior | lock/CAS/readback and typed rejection |
| `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogDictionaryReorderIntegrationTest.java:10,176` | catalog lock-port constructor seam | lock dependency remains injectable |
| `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogInventoryDisplayFactsTest.java:15,60` | catalog lock-port constructor seam | lock dependency remains injectable |
| `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogReceiptFirstUseConcurrencyIntegrationTest.java:9,181` | catalog lock-port concurrency seam | receipt-first/lock topology remains stable |
| `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogSalesMenuTaskReadTest.java:17,281` | catalog lock-port task-read seam | cross-owner read topology remains stable |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/CatalogInventoryReadTransactionTopologyTest.java:23,120` | root transaction topology mock | no transaction boundary regression |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/operations/session/OperationsCatalogAuthenticationControllerTest.java:14,106` | session controller constructor mock | stable service injection |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/publicentry/invitation/PublicInvitationControllerTest.java:8,22` | public-entry controller constructor mock | stable service injection |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/platform/asset/PlatformAssetControllerTest.java:10,17,23` | stage endpoint exception seam | typed input failure remains mapped |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/platform/workspace/PlatformWorkspaceAdministrationControllerTest.java:46-68,83,105` | public nested reference map and no-extra-read verification | stable record and interaction behavior |
| `apps/backend/catering-business-server/src/test/java/edge/problem/ContractProblemAdviceTypedOwnerMappingTest.java:104-267` | nested asset exception/advice mapping | all public exception FQCN mappings remain declared and mapped |
| `apps/backend/catering-business-server/modules/sales-menu/src/test/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerServiceOwnerApiTest.java:23-25,82,550,676-678,744-755,839-848` | sales-menu owner API asset read/command seams and compatibility service construction | typed asset read/command boundary, failure translation and service injection remain stable |

## Unverified items and entry condition

- Historical runtime-before capture for the current source is unavailable. Any before/after effective-SQL proof must state this and use either a reproducible source/data-flow equivalence proof or a same-input capture created before the B10 move; it cannot invent a historical artifact.
- Existing 30 asset tests do not, by existence alone, prove every sink's transaction/self-call/proxy/lock/CAS/idempotency/audit/rollback/readback behavior. Behavior pinning remains a separate action.
- The matrix is complete for the direct sink and current caller/test scans recorded above, but it is author-side repair after the final permitted independent review. The fresh step-level recheck after this repair is recorded separately; no third formal reviewer is requested for this cycle. This document therefore does not by itself authorize or claim B10 implementation entry.

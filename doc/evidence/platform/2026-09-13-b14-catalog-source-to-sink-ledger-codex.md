# B14 Catalog source-to-sink ledger

## CP-0 current-byte baseline

- `STEP=B14`; scope is the Catalog module's `application` sources plus its existing
  `application/persistence/*Sql.java` holders and the Catalog owner tests. No
  contract, migration, frontend, seed, reset, DEV, L2, or Git action is in scope.
- Pre-read completed before the first B14 production write: the deferred-backlog
  requirements, implementation design and plan, routed memory, `R-READ-01..08`,
  review standard, foundation-charter scope boundary, and current Catalog owning
  source. The plan preview is not used as a denominator.
- Pre-write current-byte scan: 11 Service/Coordinator candidates; 17 application
  Java files contain a direct `JdbcTemplate` execution call; the strict
  pre-write call-token count is 277 (case-sensitive
  `jdbc.(query|queryForObject|queryForList|update|execute|batchUpdate)`, excluding
  `*Sql.java`). This is the baseline captured before the first B14 production
  write, not the post-repair denominator.
- Candidate classification is not a size decision: `CatalogAttributeDefinitionService`,
  `CatalogCategoryService`, `CatalogCopyService`, `CatalogDictionaryService`,
  `CatalogItemService`, `CatalogOrderOptionDefinitionService`, and
  `CatalogUnitDefinitionService` are single-aggregate candidates; 
  `CatalogInventoryCoordinator` is a coordinator; `CatalogOwnerService` is a
  facade; `CatalogTaskReadService` and `CatalogWorkbenchReadService` are task-read
  surfaces. The KEEP classes remain in the source-to-sink scan and cannot silently
  retain JDBC execution.

## Cost baseline

- Cost unit: modified/new source files + new or completed behavior fixtures +
  unresolved SQL/data-flow items. This is a B14 baseline, not a completion gate or
  an acceptance denominator.
- Estimate time: `2026-09-13 23:16:23 KST`, before the first B14 production write.
- Baseline location: this section; the measured write set, focused proof and actual
  cost are appended below after each B14 write wave.

## Candidate and direct execution inventory

| candidate / source file | classification | pre-write direct execution tokens | current persistence holder | status |
| --- | --- | ---: | --- | --- |
| `CatalogAttributeDefinitionService.java` | KEEP_SINGLE_AGGREGATE | 0 | none | no SQL sink in current source |
| `CatalogCategoryService.java` | KEEP_SINGLE_AGGREGATE | 24 | `CatalogCategoryServiceSql.java` | OPEN: method-level extraction required |
| `CatalogCopyService.java` | KEEP_SINGLE_AGGREGATE | 29 | `CatalogCopyServiceSql.java` | OPEN: method-level extraction required |
| `CatalogDictionaryService.java` | KEEP_SINGLE_AGGREGATE | 18 | `CatalogDictionaryServiceSql.java` | OPEN: method-level extraction required |
| `CatalogInventoryCoordinator.java` | KEEP_COORDINATOR | 0 | none | coordinator retained; no JDBC sink |
| `CatalogItemService.java` | KEEP_SINGLE_AGGREGATE | 43 | `CatalogItemServiceSql.java` | OPEN: method-level extraction required |
| `CatalogOrderOptionDefinitionService.java` | KEEP_SINGLE_AGGREGATE | 0 | none | no SQL sink in current source |
| `CatalogOwnerService.java` | KEEP_FACADE | 0 | none | facade retained; no JDBC execution |
| `CatalogTaskReadService.java` | KEEP_TASK_READ | 0 | none | no direct JDBC execution in current source |
| `CatalogUnitDefinitionService.java` | KEEP_SINGLE_AGGREGATE | 0 | none | no SQL sink in current source |
| `CatalogWorkbenchReadService.java` | KEEP_TASK_READ | 14 | `CatalogWorkbenchReadServiceSql.java` | OPEN: typed task-read persistence required |
| `CatalogCompositeFacts.java` | helper fact | 14 | `CatalogCompositeFactsSql.java` | OPEN: service consumer must retain typed fact API |
| `CatalogDefinitionFacts.java` | helper fact | 26 | `CatalogDefinitionFactsSql.java` | OPEN: service consumer must retain typed fact API |
| `CatalogIdentifierFacts.java` | helper fact | 4 | `CatalogIdentifierFactsSql.java` | OPEN: service consumer must retain typed fact API |
| `CatalogItemCategoryFacts.java` | helper fact | 5 | `CatalogItemCategoryFactsSql.java` | OPEN: service consumer must retain typed fact API |
| `CatalogItemDefinitionFacts.java` | helper fact | 37 | `CatalogItemDefinitionFactsSql.java` | OPEN: service consumer must retain typed fact API |
| `CatalogItemMediaFacts.java` | helper fact | 6 | `CatalogItemMediaFactsSql.java` | OPEN: service consumer must retain typed fact API |
| `CatalogItemReferenceFacts.java` | helper fact | 7 | `CatalogItemReferenceFactsSql.java` | OPEN: service consumer must retain typed fact API |
| `CatalogPreparationFacts.java` | helper fact | 9 | `CatalogPreparationFactsSql.java` | OPEN: service consumer must retain typed fact API |
| `CatalogSkuFacts.java` | helper fact | 14 | `CatalogSkuFactsSql.java` | OPEN: service consumer must retain typed fact API |
| `CatalogSkuMediaFacts.java` | helper fact | 6 | `CatalogSkuMediaFactsSql.java` | OPEN: service consumer must retain typed fact API |
| `CatalogSkuVariantAxisFacts.java` | helper fact | 11 | `CatalogSkuVariantAxisFactsSql.java` | OPEN: service consumer must retain typed fact API |
| `CatalogUnitDefinitionFacts.java` | helper fact | 10 | `CatalogUnitDefinitionFactsSql.java` | OPEN: service consumer must retain typed fact API |

The 23 rows above intentionally separate the 11 candidate classes from the 12
fact helpers; the scan contains 17 files with execution because the five Service
rows and the 12 fact rows overlap the candidate table only where a Service is a
candidate. Before B14 can close, every execution token must have a named typed
persistence target and a direct caller/transaction/readback row; a file count is
not sufficient proof.

## Post-repair current-byte inventory

- Re-running the same strict receiver-qualified scan after the B14 write waves
  produces 17 files and 273 source call tokens. The five former Service
  execution sites are now the five typed persistence classes (124 tokens total),
  while the 12 existing fact helpers retain 149 tokens. The five former Service
  classes themselves each have zero direct `jdbc.*` execution tokens.
- The 277-to-273 difference is a source-call-site count change, not a claim that
  four runtime database operations disappeared. Three tokens disappear because
  four former Category read methods now share one private `readRow` JDBC call
  site; one token disappears because two former sibling-order update call sites
  now share one persistence `updateSiblingOrder` call site that the application
  invokes twice. The runtime invocation count for the two sibling updates is
  therefore preserved. Both counts use the same case-sensitive receiver-qualified
  regex; neither count is a business or operation-budget denominator.

## Initial CP-0 state

`B14_CP0=OPEN`. The current-byte inventory is complete at file/token level, but
the method-family, caller, transaction/self-call, persistence-boundary and test
coverage rows are not yet fully expanded. No B14 service or fact source has been
modified before this ledger entry.

## B14 implementation waves and focused proof

- The B14 production write set moved the five Catalog task/owner execution surfaces
  into typed persistence boundaries without changing their public owner APIs:
  `CatalogCategoryPersistence`, `CatalogDictionaryPersistence`,
  `CatalogCopyPersistence`, `CatalogItemPersistence`, and
  `CatalogWorkbenchReadPersistence`. The Service/Coordinator classes retain owner
  validation, transaction/replay policy, lock/CAS sequencing, business projection,
  and public response mapping; the persistence classes own the existing SQL
  fragments, JDBC binding, and row mapping.
- After the write waves, a current source scan with the same strict receiver-qualified
  execution tokens used for the baseline found no direct execution in the five
  Service classes outside `application/persistence/*` and `*Sql.java`. The scan is
  a static boundary fact; it does not by itself prove runtime equivalence.
- Two diagnostic managed runs are retained as `FAIL` and are not replaced by the
  passing run: `r5-tc-1789313835977-21535` failed at the remote Catalog module test
  boundary with 35 tests failing; `r5-tc-1789314302597-22615` exposed the next
  2 defects, a missing `catalog_item` unit-query closing parenthesis and missing
  `data_node_ref`/`brand_ref` binds, plus an outdated test RowMapper type and an
  insert wrapper with one extra hard-coded version argument. All diagnostic runs
  recorded managed cleanup PASS.
- The minimal repairs were: restore scope/brand arguments to `readItemStatuses`,
  append the existing `SQL_FRAGMENT_319` closing parenthesis to
  `CatalogItemPersistence.readItemUnitRefs`, keep Workbench unit reads on the
  original `PreparedStatementSetter`/`ResultSetExtractor` overload, remove the
  extra version argument from `insertTemporaryPromotionItem`, and update
  `CatalogInventoryDisplayFactsTest` to consume the new typed persistence row.
  No business rule, public API, contract, migration, frontend, seed, reset, DEV,
  L2 or generated source was changed for these repairs.
- Passing managed remote focused proof is split into three manifests, all on the
  remote Testcontainers execution plane and all with `sourceSync=PASS`, remote
  Gradle status `0`, `firstFailure=null`, and cleanup PASS for remote process,
  remote workspace, Testcontainers containers and volumes:
  `r5-tc-1789314546665-23234` ran `:modules:catalog:test` with 131/131 tests
  green; `r5-tc-1789314717701-25369` ran `:modules:inventory:test` with 52/52
  tests green as the script's required companion phase; and
  `r5-tc-1789314795380-25618` ran the application test task with 10/10 tests
  green. These are focused proofs, not the final full backend acceptance.
- The focused result report is
  `.runtime/r5/results/catalog-inventory-backend-unit-tests.json` with
  `status=PASS`, three phase results PASS, and `business=PASS`; each underlying
  managed manifest independently records `business=NOT_APPLICABLE` because these
  are module/application tests rather than HTTP business scenarios. No DEV was
  running (`devLifecycle.wasRunning=false`) and no local Spring or PostgreSQL
  tunnel was used.
- `B14_CP0` remains `OPEN` until a fresh independent step reconciliation reopens
  the current source, this ledger, the accepted design/plan and routed standards.

## B14 CatalogItem typed-boundary repair and after-proof (2026-09-14)

- The fresh B14 recheck identified a real M-01 boundary gap after the prior
  persistence relocation: `CatalogItemService` still constructed JDBC-shaped
  values and passed them through public `CatalogItemPersistence` methods. The
  affected shapes were `Object[] unitValues` in `updateItem`, `List<Object[]>`
  unit-fact batches, and `List<String> requestedKeys` plus `List<Object> args` in
  `lockDictionaryRefs`. This was a production application-to-persistence
  boundary issue, not a test-only helper.
- The minimal repair is limited to the CatalogItem boundary. `CatalogItemPersistence`
  now exposes `UnitFactValues`, `ItemUnitSnapshotRow`, `SkuUnitFactRow` and
  `DictionaryReference` records. It constructs unit batch argument arrays, tuple
  placeholders and JDBC bind lists internally; `CatalogItemService` supplies
  business-shaped records/refs and retains validation, status policy and
  response mapping. The service-side dead `CatalogItemServiceSql` constructions
  for batch status, dictionary tuple locking and SKU-owner placeholders were
  removed. `CatalogCopyService` already used its own typed `CatalogCopyPersistence`
  row records and required no change.
- Current-byte scan after the repair finds no `CatalogItemServiceSql` reference,
  `List<Object>`, `Object[]`, SQL placeholder/tuple construction or raw JDBC
  execution in `CatalogItemService` for these paths. Public `CatalogItemPersistence`
  methods for the repaired paths no longer accept positional execution arrays,
  raw SQL, fragment text, mapper/executor shapes or generic argument lists. The
  persistence implementation still preserves the existing SQL fragments, bind
  order, duplicate handling, status checks and return mapping.
- The post-repair focused managed proof is recorded in
  `.runtime/r5/results/catalog-inventory-backend-unit-tests.json`: Catalog run
  `r5-tc-1789315947165-31578`, Inventory companion run
  `r5-tc-1789316122216-31872`, and application run
  `r5-tc-1789316197268-32079` all have remote source sync PASS, remote Gradle
  status 0, firstFailure null and cleanup PASS for remote process/workspace and
  Testcontainers containers/volumes. The aggregate status and business field are
  PASS for this focused technical runner; each underlying manifest correctly
  reports `business=NOT_APPLICABLE` because it is not HTTP backend acceptance.
- The focused proof does not close B14 by itself. It is retained as after-proof
  for the boundary repair; the next required gate is a fresh independent B14
  step reconciliation over the current source, this ledger, the accepted
  design/plan and routed standards. No B15 source write is permitted before that
  reviewer returns `STEP_RECONCILIATION=MATCHED`.

## B14 final fresh step reconciliation (2026-09-14)

- Fresh read-only reviewer `01a09b90-3cf4-7991-998b-4a4a9353cebf` reopened the
  current Catalog source, this ledger, the accepted implementation design/plan,
  routed standards and the three managed after-proof manifests. Metadata:
  `REVIEW_TARGET=IMPLEMENTATION_STEP_RECONCILIATION`, `fresh=true`,
  `READ_ONLY=true`, `NO_DYNAMIC=true`, `NO_GIT=true`.
- Independent result: `STEP_RECONCILIATION=MATCHED`,
  `B14_ENTRY=UNBLOCKED`, `M/S/N=0/0/0`. The reviewer re-counted 11 Catalog
  candidates, 17 execution files and 273 current strict direct JDBC execution
  tokens, and confirmed that the five former Service execution surfaces are
  inside typed persistence boundaries.
- The reviewer specifically confirmed that CatalogItemService no longer carries
  `CatalogItemServiceSql`, raw SQL fragments, placeholder/tuple construction,
  `Object[]`, `List<Object>` or positional binds across its public persistence
  boundary; CatalogCopyService's existing typed boundary remains intact. A
  private unused `concatArgs` helper was inspected and does not cross a public
  persistence boundary, so it is not a finding.
- The reviewer confirmed the focused after-proof manifests have remote source
  sync PASS, remote test status 0, firstFailure null and cleanup PASS, while
  preserving the distinction that their underlying `business=NOT_APPLICABLE`
  is not HTTP backend acceptance. B14 is therefore closed for the implementation
  step and B15 is unblocked; this does not close the final full-range reconciliation
  or full backend acceptance.

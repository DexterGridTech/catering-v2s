# B13 Inventory source-to-sink ledger

## Scope and closure rule

This ledger is the CP-0 source-to-sink inventory for B13. It is based on the
current Java bytes, not the preview counts in the implementation plan. A row is
one direct JDBC execution point, including separate branch executions in one
method. `source` is the current application source anchor (or the already moved
persistence anchor for availability and lifecycle); `target` is the named
typed persistence method that owns the execution after B13. The application
service keeps authorization, business validation, transaction boundary,
idempotency, locking protocol, audit/readback and response shaping unless the
row explicitly says that the persistence method only returns a typed fact.

The following obligation profiles make the per-row columns explicit without
repeating the same sentence 87 times:

* `R`: read-only typed projection; preserve scope/owner predicates, result
  mapping, stable ordering and authoritative readback/error semantics.
* `W`: write or update; preserve ordered bind slots, CAS/version predicate,
  affected-row handling, transaction and post-write readback.
* `L`: lock/read prerequisite; preserve lock order and the outer REQUIRED
  transaction; no policy is moved into persistence.
* `I`: receipt/replay; preserve receipt lock, operation/request-hash comparison,
  replay response and receipt write ordering.
* `B`: batch/copy; preserve deterministic source selection, reference mapping,
  batch bind order, rollback and copy readback.
* `D`: dynamic read; persistence owns SQL branch/condition composition and the
  public method accepts business parameters, never SQL text or fragments.

Every target method is required to expose business-level parameters only. SQL
fragment names in this document identify the current source fact and are not
permitted public arguments. `UNKNOWN` is not a closure state; any unresolved
source shape must remain OPEN and be diagnosed before the next B13 production
write.

## Availability and lifecycle already moved

| ID | source/current execution | target typed persistence method | SQL/branch | args/slots and obligations | direct caller |
|---|---|---|---|---|---|
| AV-01 | `application/persistence/InventoryAvailabilityPersistence.java:64`, `readTargets`, complete-unit branch | `InventoryAvailabilityPersistence#readTargets` | `SELECT_PREFIX + TARGET_SELECT_COLUMNS + SQL_FRAGMENT_001..002 + identity predicates + close` | `dataNodeRef, brandRef, ordered (itemRef, productSkuRef)`; `R`, require complete consumption snapshot, duplicate identity rejection | `InventoryAvailabilityService#readSalesMenuAvailability` |
| AV-02 | `application/persistence/InventoryAvailabilityPersistence.java:69`, `readTargets`, partial-unit branch | `InventoryAvailabilityPersistence#readTargets` | same SQL; callback branch uses the optional unit snapshot | same first two slots and pair slots; `R`, preserve optional unit columns and unresolved mapping problem | `InventoryAvailabilityService#readSalesMenuAvailability` |
| LIFE-01 | `application/persistence/InventoryCatalogLifecyclePersistence.java:31`, `readUnitLifecycleUsage` | `InventoryCatalogLifecyclePersistence#readUnitLifecycleUsage` (target-ref query) | `SQL_FRAGMENT_001..002` | `dataNodeRef, brandRef, unitRef, unitRef`; `L`, advisory unit lock precedes query, ordered refs | `InventoryCatalogLifecycleService#validateCatalogUnitLifecycle` |
| LIFE-02 | `application/persistence/InventoryCatalogLifecyclePersistence.java:39`, `readUnitLifecycleUsage` | `InventoryCatalogLifecyclePersistence#readUnitLifecycleUsage` (ledger count) | `SQL_FRAGMENT_003..006` | `unitRef, dataNodeRef, brandRef`; `R`, preserve count fact | `InventoryCatalogLifecycleService#validateCatalogUnitLifecycle` |
| LIFE-03 | `application/persistence/InventoryCatalogLifecyclePersistence.java:48`, `readUnitLifecycleUsage` | `InventoryCatalogLifecyclePersistence#readUnitLifecycleUsage` (BOM count) | `SQL_FRAGMENT_007..009` | `unitRef.toString()`; `R`, preserve count fact and response mapping | `InventoryCatalogLifecycleService#validateCatalogUnitLifecycle` |
| LIFE-04 | `application/persistence/InventoryCatalogLifecyclePersistence.java:67`, `readTargetConsumptionUnitRows` | `InventoryCatalogLifecyclePersistence#readTargetConsumptionUnitRows` | `SQL_FRAGMENT_010..011` | `dataNodeRef, brandRef, itemRef`; `R`, preserve SKU/consumption-unit tuple mapping | `InventoryCatalogLifecycleService#validateCatalogItemBaseMeasureUnitTransition` |
| LIFE-05 | `application/persistence/InventoryCatalogLifecyclePersistence.java:82`, `retireTargets` | `InventoryCatalogLifecyclePersistence#retireTargets` | `SQL_FRAGMENT_012..013 + owner column + enabled suffix` | `now, dataNodeRef, brandRef, subject.ref`; `W`, owner-kind branch stays typed, affected count/readback retained | `InventoryCatalogLifecycleService#retireCatalogVoidInventoryDefinitions` |
| LIFE-06 | `application/persistence/InventoryCatalogLifecyclePersistence.java:95`, `retireBoms` | `InventoryCatalogLifecyclePersistence#retireBoms` | `SQL_FRAGMENT_014..015 + owner column + enabled suffix` | same owner-scoped slots; `W`, preserve retirement ordering and count | `InventoryCatalogLifecycleService#retireCatalogVoidInventoryDefinitions` |
| LIFE-07 | `application/persistence/InventoryCatalogLifecyclePersistence.java:113`, `readBatchRetirementFacts` | `InventoryCatalogLifecyclePersistence#readBatchRetirementFacts` | `SQL_FRAGMENT_016..096`, inbound CTE aliases and `INBOUND_*` suffixes | subject, receipt key/operation/hash and time values in existing order; `W`, one statement's receipt gate, retire facts, inbound summary and readback remain atomic | `InventoryCatalogLifecycleService#retireCatalogVoidInventoryDefinitionsForBatch` |
| LIFE-08 | `application/persistence/InventoryCatalogLifecyclePersistence.java:235`, `dependencyCounts` | `InventoryCatalogLifecyclePersistence#dependencyCounts` | dependency prefix/table + `SQL_FRAGMENT_097..098` + source column/group suffix | `dataNodeRef, brandRef, uuid[]`; `D`, source is a typed enum, no caller SQL; preserve counts by source | `InventoryCatalogLifecycleService#catalogReferenceDependencies` |
| LIFE-09 | `application/persistence/InventoryCatalogLifecyclePersistence.java:302`, `readVoidDependencyFacts` | `InventoryCatalogLifecyclePersistence#readVoidDependencyFacts` | `SQL_FRAGMENT_099..138`, owner-column and item/SKU parent branch | `scope, brand, subject uuid[]`; `D`, subject kind chooses owner column internally, sorted refs and typed fact mapping | `InventoryCatalogLifecycleService#catalogVoidDependencies*` |
| LIFE-10 | `application/persistence/InventoryCatalogLifecyclePersistence.java:325`, `lockCatalogVoidSubjectRows` target lock | `InventoryCatalogLifecyclePersistence#lockCatalogVoidSubjectRows` | `SQL_FRAGMENT_139 + ownerColumn + OWNER_TARGET_LOCK_SUFFIX` | `scope, brand, subject.ref`; `L`, first lock in subject lock order | `InventoryCatalogLifecycleService#retireCatalogVoidInventoryDefinitions*` |
| LIFE-11 | `application/persistence/InventoryCatalogLifecyclePersistence.java:332`, `lockCatalogVoidSubjectRows` BOM lock | `InventoryCatalogLifecyclePersistence#lockCatalogVoidSubjectRows` | `SQL_FRAGMENT_140 + ownerColumn + OWNER_BOM_LOCK_SUFFIX` | same subject slots; `L`, second lock and no policy leakage | `InventoryCatalogLifecycleService#retireCatalogVoidInventoryDefinitions*` |
| LIFE-12 | `application/persistence/InventoryCatalogLifecyclePersistence.java:339`, `lockCatalogVoidSubjectRows` owned-target discovery | `InventoryCatalogLifecyclePersistence#lockCatalogVoidSubjectRows` | `SQL_FRAGMENT_141 + ownerColumn + OWNER_TARGET_ORDER_SUFFIX` | same subject slots; `L`, preserve deterministic target order and early-empty behavior | `InventoryCatalogLifecycleService#retireCatalogVoidInventoryDefinitions*` |
| LIFE-13 | `application/persistence/InventoryCatalogLifecyclePersistence.java:354`, `lockCatalogVoidSubjectRows` component lock | `InventoryCatalogLifecyclePersistence#lockCatalogVoidSubjectRows` | `SQL_FRAGMENT_142..147 + generated placeholders` | `scope, brand, ordered target refs`; `L`, preserve final component lock query and lock order | `InventoryCatalogLifecycleService#retireCatalogVoidInventoryDefinitions*` |
| LIFE-14 | `application/persistence/InventoryCatalogLifecyclePersistence.java:367`, `countActiveOwnedDefinitions` | `InventoryCatalogLifecyclePersistence#countActiveOwnedDefinitions` | `SQL_FRAGMENT_148 + owner column + active target/BOM suffixes` | subject scope/ref values in existing twice-repeated order; `R`, authoritative remaining-count readback | `InventoryCatalogLifecycleService#retireCatalogVoidInventoryDefinitions*` |
| LIFE-15 | `application/persistence/InventoryCatalogLifecyclePersistence.java:384`, `readReceipt` | `InventoryCatalogLifecyclePersistence#readReceipt` | `SQL_FRAGMENT_149..150` | `scope, key`; `I`, receipt advisory lock and replay mismatch semantics retained | `InventoryCatalogLifecycleService#replay` |
| LIFE-16 | `application/persistence/InventoryCatalogLifecyclePersistence.java:397`, `saveReceipt` | `InventoryCatalogLifecyclePersistence#saveReceipt` | `SQL_FRAGMENT_151..154` | generated ref, scope/key/op/hash/response/time in existing order; `I`, receipt is written after successful owner work | `InventoryCatalogLifecycleService#saveReceipt` |

## BOM execution points

| ID | source/current execution | target typed persistence method | SQL/branch | args/slots and obligations | direct caller |
|---|---|---|---|---|---|
| BOM-01 | `application/InventoryBomService.java:370`, `catalogTargetDisplays` | `InventoryBomPersistence#readCatalogTargetDisplays` | `SQL_FRAGMENT_007..010` | scope, brand, item uuid[]; `R`, preserve LEFT JOIN item/SKU and name validation input | BOM service read/copy paths |
| BOM-02 | `application/InventoryBomService.java:532`, `ensureCatalogInventoryTargetCore` existing target update | `InventoryBomPersistence#updateTargetConfiguration` | `SQL_FRAGMENT_011..017` | configuration and counting-unit snapshot, time, scope/brand/ref/expectedVersion; `W`, affected row must remain exactly one or VERSION_CONFLICT | `InventoryBomService#ensureCatalogInventoryTarget*` |
| BOM-03 | `application/InventoryBomService.java:575`, `ensureCatalogInventoryTargetCore` new target insert | `InventoryBomPersistence#insertTarget` | `SQL_FRAGMENT_018..027` | generated ref, scope/brand/item/SKU/codes, modes, unit snapshots, configuration/time; `W`, preserve insert result and readback | `InventoryBomService#ensureCatalogInventoryTarget*` |
| BOM-04 | `application/InventoryBomService.java:766`, `resolveCatalogMaterialStockTarget` | `InventoryBomPersistence#findTargetRefsByItem` | `SQL_FRAGMENT_028..029` | scope, brand, material item; `R`, preserve uniqueness/not-found business decisions in service | `InventoryBomService#resolveCatalogMaterialStockTarget` |
| BOM-05 | `application/InventoryBomService.java:819`, `resolveCatalogMaterialStockTargets` | `InventoryBomPersistence#readTargetsByItemRefs` | `SQL_FRAGMENT_030..037 + generated placeholders` | scope, brand, item uuid[]; `D`, preserve deterministic item/SKU order and enabled predicate | `InventoryBomService#resolveCatalogMaterialStockTargets` |
| BOM-06 | `application/InventoryBomService.java:878`, `deleteCatalogOptionValueBoms` | `InventoryBomPersistence#deleteOptionValueBoms` | `SQL_FRAGMENT_038 + generated placeholders + close` | scope, brand, option-value uuid[]; `W`, preserve count/readback and transaction rollback | `InventoryBomService#deleteCatalogOptionValueBoms` |
| BOM-07 | `application/InventoryBomService.java:932`, `copyCatalogOptionValueBoms` source read | `InventoryBomPersistence#readOptionValueBoms` | `SQL_FRAGMENT_039..043` | scope, brand, item uuid[]; `B`, preserve source version/rows/order and owner validation | `InventoryBomService#copyCatalogOptionValueBoms` |
| BOM-08 | `application/InventoryBomService.java:949`, `copyCatalogOptionValueBoms` target upsert | `InventoryBomPersistence#upsertCopiedOptionValueBom` | `SQL_FRAGMENT_044..051` | generated BOM ref, scope/brand/identity/rows/time and conflict identity; `B/W`, preserve ON CONFLICT semantics and copied readback | `InventoryBomService#copyCatalogOptionValueBoms` |
| BOM-09 | `application/InventoryBomService.java:1369`, `enforceModeSwitchGuard` | `InventoryBomPersistence#readModeSwitchCounts` | `SQL_FRAGMENT_052..059` | scope/brand/item and current definition identity; `R`, preserve guard's counts and typed mode decision in service | BOM rule replacement |
| BOM-10 | `application/InventoryBomService.java:1436`, `saveDirectDefinition` target update branch | `InventoryBomPersistence#updateDirectDefinition` | `SQL_FRAGMENT_060..065` | direct definition fields, version/time, owner identity; `W`, preserve CAS/affected-row handling | `InventoryBomService#replaceCatalogInventoryRulesCore` |
| BOM-11 | `application/InventoryBomService.java:1460`, `saveDirectDefinition` target insert branch | `InventoryBomPersistence#insertDirectDefinition` | `SQL_FRAGMENT_066..074` | generated target ref, owner/item/SKU/unit/config/balance/version/time; `W`, preserve direct fact creation and readback | `InventoryBomService#replaceCatalogInventoryRulesCore` |
| BOM-12 | `application/InventoryBomService.java:1517`, `saveBomDefinition` existing update | `InventoryBomPersistence#updateBomDefinition` | `SQL_FRAGMENT_075..076` | rows/version/time/bom ref/scope/brand; `W`, preserve enabled CAS and version conflict | `InventoryBomService#replaceCatalogInventoryRulesCore` |
| BOM-13 | `application/InventoryBomService.java:1528`, `saveBomDefinition` insert | `InventoryBomPersistence#insertBomDefinition` | `SQL_FRAGMENT_077..080` | generated ref, owner/item/SKU/option/rows/time; `W`, preserve definition status and result | `InventoryBomService#replaceCatalogInventoryRulesCore` |
| BOM-14 | `application/InventoryBomService.java:1616`, `disableTargetDefinitions` | `InventoryBomPersistence#disableTargetDefinitions` | `SQL_FRAGMENT_081..083 + placeholders` | time, scope, brand, ordered target refs; `W`, preserve enabled-only disable and affected count | BOM rule replacement |
| BOM-15 | `application/InventoryBomService.java:1640`, `disableBomDefinitions` | `InventoryBomPersistence#disableBomDefinitions` | `SQL_FRAGMENT_084..086 + placeholders` | time, scope, brand, ordered BOM refs; `W`, preserve enabled-only disable and affected count | BOM rule replacement |
| BOM-16 | `application/InventoryBomService.java:1652`, `loadRuleTargetFacts` | `InventoryBomPersistence#readRuleTargetFacts` | `SQL_FRAGMENT_087..093` | scope, brand, item; `R/L`, preserve `FOR UPDATE` ordering and target version/configuration fact | BOM rule replacement |
| BOM-17 | `application/InventoryBomService.java:1690`, `loadRuleBomFacts` | `InventoryBomPersistence#readRuleBomFacts` | `SQL_FRAGMENT_094..096` | scope, brand, item; `R/L`, preserve `FOR UPDATE` ordering and BOM version/rows fact | BOM rule replacement |
| BOM-18 | `application/InventoryBomService.java:1842`, `saveCatalogProductBomCore` current-row read | `InventoryBomPersistence#readCurrentBomRows` | branch `SQL_FRAGMENT_097..105 + SQL_FRAGMENT_106` | scope, brand, item, product SKU or option identity; `D/R`, branch chosen from typed business identity, enabled `FOR UPDATE`, preserve current version/rows | `InventoryBomService#saveCatalogProductBomCore` |
| BOM-19 | `application/InventoryBomService.java:1911`, `saveCatalogProductBomCore` upsert | `InventoryBomPersistence#upsertCatalogBomRows` | `SQL_FRAGMENT_107..118` | all typed BOM owner fields, rows/time; `W`, preserve conflict identity and update version/rows/readback | `InventoryBomService#saveCatalogProductBomCore` |
| BOM-20 | `application/InventoryBomService.java:1943`, `targetByIdentity` | `InventoryBomPersistence#readTargetByIdentity` | `SELECT_PREFIX + TARGET_SELECT_COLUMNS + SQL_FRAGMENT_119..121` | scope, brand, item, nullable SKU; `R`, preserve enabled identity and unit snapshot validation | BOM service typed helper paths |
| BOM-21 | `application/InventoryBomService.java:1978`, `loadTargetsByRefs` | `InventoryBomPersistence#readTargetsByRefs` | `SELECT_PREFIX + TARGET_SELECT_COLUMNS + SQL_FRAGMENT_123..125` plus enabled branch | scope, brand, uuid[]; `D/R`, enabledOnly is boolean business choice, no SQL text parameter | BOM service read/copy paths |
| BOM-22 | `application/InventoryBomService.java:2035`, `loadCatalogDefinitionFacts` | `InventoryBomPersistence#readCatalogDefinitionFacts` | `SQL_FRAGMENT_126..138 + typed target predicate + combined tail` | scope, brand, item and typed include-direct/include-component flags; `D/R`, preserve CTE fact union, no caller fragment | `InventoryBomService#readCatalogInventoryDefinition` and save paths |
| BOM-23 | `application/InventoryBomService.java:2167`, `consumptionTargetCandidates` | `InventoryBomPersistence#readConsumptionTargetCandidates` | `SQL_FRAGMENT_139..154` | scope, brand, normalized keyword, patterns, limit, offset; `D/R`, persistence owns search condition/order/page assembly and typed row mapping | `InventoryBomService#readCatalogInventoryConsumptionTargetCandidates` |
| BOM-24 | `application/InventoryBomService.java:2277`, `inventoryDeductionSummaries` | `InventoryBomPersistence#readInventoryDeductionSummaries` | `SQL_FRAGMENT_155..168` | scope/brand, item uuid[], SKU uuid[]; `D/R`, preserve DIRECT/BOM union, duplicate fact error and deterministic ordering | `InventoryBomService#readCatalogInventorySummary` |
| BOM-25 | `application/InventoryBomService.java:2418`, `target` | `InventoryBomPersistence#readTarget` | `SELECT_PREFIX + TARGET_SELECT_COLUMNS + SQL_FRAGMENT_169..170` | scope, brand, target ref; `R`, preserve NOT_FOUND mapping and complete unit snapshot | all BOM command rechecks |
| BOM-26 | `application/InventoryBomService.java:2433`, `generation` | `InventoryBomPersistence#readGeneration` | `SQL_FRAGMENT_171` | scope, brand; `R`, preserve zero default | BOM read envelopes |
| BOM-27 | `application/InventoryBomService.java:2443`, `replay` | `InventoryBomPersistence#readReceipt` | `SQL_FRAGMENT_172..173` | scope, idempotency key; `I`, advisory receipt lock, operation/hash conflict and response replay stay in owner contract | BOM command paths |
| BOM-28 | `application/InventoryBomService.java:2457`, `saveReceipt` | `InventoryBomPersistence#saveReceipt` | `SQL_FRAGMENT_174..177` | generated ref, scope/key/op/hash/canonical response/time; `I`, receipt written after owner operation/readback | BOM command paths |
| BOM-29 | `application/InventoryBomService.java:486`, `ensureCatalogInventoryTargetCore` consumption-unit read (delegated helper) | `InventoryBomPersistence#readConsumptionUnitSnapshot` | `SQL_FRAGMENT_001..003` | target ref; `R`, preserve required complete consumption-unit snapshot and the existing typed `CONSUMPTION_UNIT_SNAPSHOT_REQUIRED` problem | `InventoryBomService#ensureCatalogInventoryTarget*`; `resolveCatalogMaterialStockTarget` |
| BOM-30 | `application/InventoryBomService.java:488`, `ensureCatalogInventoryTargetCore` counting-unit read (delegated helper) | `InventoryBomPersistence#readCountingUnitConfiguration` | `SQL_FRAGMENT_004..006` | target ref and fallback consumption snapshot; `R`, preserve returned counting snapshot/factor and `BigDecimal.ONE` fallback when no row exists | `InventoryBomService#ensureCatalogInventoryTarget*` |

## BOM helper execution point

| ID | source/current execution | target typed persistence method | SQL/branch | args/slots and obligations | direct caller |
|---|---|---|---|---|---|
| RESOLVED-01 | `application/ResolvedBomTargets.java:30`, `load` | `InventoryBomPersistence#resolveBomTargets` | `ResolvedBomTargetsSql.SQL_FRAGMENT_001..003` | scope/brand and typed target-ref collection in existing bind order; `R`, preserve enabled/status/component eligibility mapping; caller no longer passes `JdbcTemplate` | `InventoryBomService#replaceCatalogInventoryRulesCore`; `InventoryBomService#saveCatalogProductBomCore` |

## Copy execution points

| ID | source/current execution | target typed persistence method | SQL/branch | args/slots and obligations | direct caller |
|---|---|---|---|---|---|
| COPY-01 | `application/InventoryCopyService.java:298`, `copyCore` first batch | `InventoryCopyPersistence#copyCatalogItems` | `SQL_FRAGMENT_004..012` | typed source/destination scope and item mapping values; `B`, preserve batch order, source-owner checks and rollback | `InventoryCopyService#copy` |
| COPY-02 | `application/InventoryCopyService.java:414`, `copyCore` second batch | `InventoryCopyPersistence#copyCatalogSkus` | `SQL_FRAGMENT_013..024` | typed SKU/item mapping values in setter order; `B`, preserve batch size and generated row semantics | `InventoryCopyService#copy` |
| COPY-03 | `application/InventoryCopyService.java:1082`, `catalogTargetDisplays` | `InventoryCopyPersistence#readCatalogTargetDisplays` | `SQL_FRAGMENT_025..028` | scope, brand, item uuid[]; `R`, preserve optional SKU identity and name readback | copy preflight/execution |
| COPY-04 | `application/InventoryCopyService.java:1169`, `targetRowsByIdentities` identity read | `InventoryCopyPersistence#readTargetRowsByIdentities` | target identity query branch (current method's first `jdbc.query`) | scope, brand, ordered identity pairs; `D/R`, preserve identity and unit snapshot mapping | `InventoryCopyService#preflightCopyCoreWithState` |
| COPY-05 | `application/InventoryCopyService.java:1174`, `targetRowsByIdentities` configuration read | `InventoryCopyPersistence#readTargetRowsByIdentities` | target configuration query branch (current method's second `jdbc.query`) | same typed identity list; `D/R`, preserve duplicate/unresolved mapping semantics | `InventoryCopyService#preflightCopyCoreWithState` |
| COPY-06 | `application/InventoryCopyService.java:1247`, `loadTargetsByItemRefs` | `InventoryCopyPersistence#readTargetsByItemRefs` | `SELECT_PREFIX + TARGET_SELECT_COLUMNS + SQL_FRAGMENT_031..034` | scope, brand, item uuid[]; `R`, preserve deterministic item/SKU/target order | copy source closure |
| COPY-07 | `application/InventoryCopyService.java:1280`, `loadTargetsByRefs` | `InventoryCopyPersistence#readTargetsByRefs` | `SELECT_PREFIX + TARGET_SELECT_COLUMNS + SQL_FRAGMENT_036..038` | scope, brand, target uuid[]; `R`, preserve enabled filter and target mapping | copy source closure |
| COPY-08 | `application/InventoryCopyService.java:1310`, `loadBomOwnersByItemRefs` | `InventoryCopyPersistence#readBomOwnersByItemRefs` | `SQL_FRAGMENT_039..043` | scope, brand, item uuid[]; `R`, preserve BOM owner/version/order facts | copy source closure |
| COPY-09 | `application/InventoryCopyService.java:1337`, `loadTargetConfigurationsByItemRefs` | `InventoryCopyPersistence#readTargetConfigurationsByItemRefs` | `SQL_FRAGMENT_044..045` | scope, brand, item uuid[]; `R`, preserve target configuration snapshot | copy source closure |
| COPY-10 | `application/InventoryCopyService.java:1353`, `loadBomRowsByItemRefs` | `InventoryCopyPersistence#readBomRowsByItemRefs` | `SQL_FRAGMENT_046..048` | scope, brand, item uuid[]; `R`, preserve BOM rows order and JSON snapshot | copy source closure |
| COPY-11 | `application/InventoryCopyService.java:1745`, `target` | `InventoryCopyPersistence#readTarget` | `SELECT_PREFIX + TARGET_SELECT_COLUMNS + SQL_FRAGMENT_049..050` | scope, brand, target ref; `R`, preserve enabled identity and NOT_FOUND mapping | copy recheck |
| COPY-12 | `application/InventoryCopyService.java:1787`, `loadChangeSnapshots` | `InventoryCopyPersistence#readChangeSnapshots` | typed snapshot query currently assembled in method (no SQL holder fragment on sink line) | ordered target refs and business time window; `D/R`, current source expression must be captured before move and no SQL fragment argument allowed | copy readback |
| COPY-13 | `application/InventoryCopyService.java:1881`, `generation` | `InventoryCopyPersistence#readGeneration` | `SQL_FRAGMENT_071` | scope, brand; `R`, preserve zero default | copy envelope |
| COPY-14 | `application/InventoryCopyService.java:1897`, `replay` | `InventoryCopyPersistence#readReceipt` | `SQL_FRAGMENT_072..073` | scope, idempotency key; `I`, preserve receipt lock/hash mismatch/replay | copy commands |
| COPY-15 | `application/InventoryCopyService.java:1911`, `saveReceipt` | `InventoryCopyPersistence#saveReceipt` | `SQL_FRAGMENT_074..077` | generated ref, scope/key/op/hash/response/time; `I`, preserve post-readback ordering | copy commands |

## Target execution points

| ID | source/current execution | target typed persistence method | SQL/branch | args/slots and obligations | direct caller |
|---|---|---|---|---|---|
| TARGET-01 | `application/InventoryTargetService.java:270`, `updateTargetConfiguration` | `InventoryTargetPersistence#updateConfiguration` | `SQL_FRAGMENT_001..006` | configuration/unit snapshot, time, scope/brand/ref/expectedVersion; `W`, CAS exactly one and readback retained | `InventoryTargetService#updateTargetConfiguration` |
| TARGET-02 | `application/InventoryTargetService.java:471`, `writeTypedInventoryChange` ledger insert | `InventoryTargetPersistence#insertLedgerEntry` | `SQL_FRAGMENT_013..018` | typed ledger fields, unit snapshot, time; `W`, preserve balance calculation boundary and insert order | `InventoryTargetService#countTarget/increaseTarget/adjustTarget` |
| TARGET-03 | `application/InventoryTargetService.java:473`, `writeTypedInventoryChange` target balance update | `InventoryTargetPersistence#updateBalance` | `SQL_FRAGMENT_019..020` | balance, time, target ref, expected version; `W`, affected-row CAS and VERSION_CONFLICT retained | same typed mutations |
| TARGET-04 | `application/InventoryTargetService.java:569`, `changePeriodReadback` | `InventoryTargetPersistence#readChangePeriod` | `SQL_FRAGMENT_021..023` | target ref and period boundary; `D/R`, period selection remains business enum, not SQL text | target change summary |
| TARGET-05 | `application/InventoryTargetService.java:578`, `recentChangeReadbacks` | `InventoryTargetPersistence#readRecentChanges` | `SQL_FRAGMENT_024..025` | target ref; `R`, preserve recent ordering/limit and typed readback | target change summary |
| TARGET-06 | `application/InventoryTargetService.java:592`, `catalogTargetDisplays` | `InventoryTargetPersistence#readCatalogTargetDisplays` | `SQL_FRAGMENT_026..029` | scope, brand, item uuid[]; `R`, preserve LEFT JOIN names and SKU identity | target list/readback |
| TARGET-07 | `application/InventoryTargetService.java:658`, `targets` | `InventoryTargetPersistence#readTargetPage` | target page query `SQL_FRAGMENT_030..058` and branch predicates | scope/brand, keyword/status/filter/page business values; `D/R`, persistence owns filter/order/page composition and aggregate facts | `InventoryTargetService#readTargets` |
| TARGET-08 | `application/InventoryTargetService.java:748`, `targetCounts` | `InventoryTargetPersistence#readTargetCounts` | `SQL_FRAGMENT_059..060` | scope, brand, item uuid[]; `R`, preserve counts and empty-input behavior | target list |
| TARGET-09 | `application/InventoryTargetService.java:886`, `currentLedgerFacts` | `InventoryTargetPersistence#readCurrentLedgerFacts` | `SQL_FRAGMENT_061..082` | target ref and current epoch/time; `D/R`, preserve selected-target CTE, periods, recent row and ordering | target detail |
| TARGET-10 | `application/InventoryTargetService.java:928`, `changeSummaryData` | `InventoryTargetPersistence#readChangeSummary` | `SQL_FRAGMENT_083..085` | target ref, since epoch; `R`, preserve period aggregate and count | target detail |
| TARGET-11 | `application/InventoryTargetService.java:943`, `history` | `InventoryTargetPersistence#readHistory` | `SQL_FRAGMENT_086..093` | target ref, limit, offset; `D/R`, allowlisted page only, preserve total and ordering | target detail |
| TARGET-12 | `application/InventoryTargetService.java:975`, `references` | `InventoryTargetPersistence#readReferences` | `SQL_FRAGMENT_094..120` | scope, brand, target ref, page values; `D/R`, preserve JSON expansion, targetRef binding and total | target detail |
| TARGET-13 | `application/InventoryTargetService.java:1006`, `ledger` | `InventoryTargetPersistence#readLedger` | `SQL_FRAGMENT_121..128` | target ref, limit, offset; `D/R`, preserve ledger-only operation filter and ordering | target detail |
| TARGET-14 | `application/InventoryTargetService.java:1066`, `adjust` ledger insert | `InventoryTargetPersistence#insertAdjustmentLedgerEntry` | `SQL_FRAGMENT_129..134` | typed operation/delta/balance/units/note/time; `W`, preserve audit ledger before balance update | `InventoryTargetService#adjustTarget` |
| TARGET-15 | `application/InventoryTargetService.java:1077`, `adjust` balance CAS update | `InventoryTargetPersistence#updateAdjustmentBalance` | `SQL_FRAGMENT_135..136` | balance/time/target ref/version; `W`, preserve CAS and rollback | `InventoryTargetService#adjustTarget` |
| TARGET-16 | `application/InventoryTargetService.java:1101`, `updateConfiguration` | `InventoryTargetPersistence#updateConfigurationForCommand` | `SQL_FRAGMENT_137..142` | configuration/counting-unit snapshot/time/scope/brand/ref/version; `W`, preserve CAS and current readback | `InventoryTargetService#updateConfiguration` |
| TARGET-17 | `application/InventoryTargetService.java:1210`, `target` | `InventoryTargetPersistence#readTarget` | `SELECT_PREFIX + TARGET_SELECT_COLUMNS + SQL_FRAGMENT_143..144` | scope, brand, target ref; `R`, preserve enabled target and NOT_FOUND | target command rechecks |
| TARGET-18 | `application/InventoryTargetService.java:1220`, `loadChangeSnapshots` | `InventoryTargetPersistence#readChangeSnapshots` | typed snapshot query currently assembled in method (no holder fragment on sink line) | ordered target refs and time values; `D/R`, capture exact current SQL and slots before moving, no SQL-text parameter | target mutation readback |
| TARGET-19 | `application/InventoryTargetService.java:1335`, `recentChanges` | `InventoryTargetPersistence#readRecentChangesForDetail` | `SQL_FRAGMENT_165..166` | target ref; `R`, preserve recent limit/order | target detail |
| TARGET-20 | `application/InventoryTargetService.java:1346`, `generation` | `InventoryTargetPersistence#readGeneration` | `SQL_FRAGMENT_167` | scope, brand; `R`, preserve zero default | target envelope |
| TARGET-21 | `application/InventoryTargetService.java:1357`, `replay` | `InventoryTargetPersistence#readReceipt` | `SQL_FRAGMENT_168..169` | scope, idempotency key; `I`, target advisory lock stays in service, preserve receipt/hash mismatch/replay | target commands |
| TARGET-22 | `application/InventoryTargetService.java:1365`, `saveReceipt` | `InventoryTargetPersistence#saveReceipt` | `SQL_FRAGMENT_170..173` | generated ref, scope/key/op/hash/response/time; `I`, preserve receipt-after-readback order | target commands |
| TARGET-23 | `application/InventoryTargetService.java:387`, `consumptionUnitSnapshot` delegate used by write/read projections | `InventoryTargetPersistence#readConsumptionUnitSnapshot` | `SQL_FRAGMENT_007..009` | target ref; `R`, preserve required complete consumption-unit snapshot and typed missing-fact problem | `updateTargetConfiguration`, typed count/increase/adjust, legacy updateConfiguration, target list projection |

## CP-0 acceptance of this artifact

The current full execution closure is 87: AV 2, LIFE 16, BOM 30,
`RESOLVED=1`, COPY 15 and TARGET 23. The earlier 83 count was the strict
receiver-qualified total for the seven Inventory service candidates before the
availability move; it did not include the separate `ResolvedBomTargets`
application helper and did not count the two already-moved availability sinks
as persistence-owned current locations. The source scan for the final ledger
includes application helpers and the already-created persistence boundaries,
with imports excluded and separate branch calls retained. The availability,
lifecycle, BOM, RESOLVED, COPY and TARGET rows now have named typed boundaries;
their focused remote proofs are recorded, while the whole B13 step remains OPEN
until the final independent reconciliation. This ledger was formalized after the
first availability slice; it does not retroactively claim that the first
availability write happened after a complete ledger. No further B13 production
source write is allowed until the ledger ID count, every target boundary and
the remaining self-call/transaction/readback notes are independently reopened.

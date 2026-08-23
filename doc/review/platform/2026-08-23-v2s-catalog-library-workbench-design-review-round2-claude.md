# v2s catalog library workbench design review round 2

REVIEW_CYCLE_ID=CATALOG_LIBRARY_WORKBENCH_20260823_DESIGN  
REVIEW_ROUND=2  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
REVIEW_TARGET=DESIGN  
ACTION_1_VARIANT=1-B  
ROUND_FINAL_DECISION=SELF_DECIDED  
ROUND_SCOPE=ROUND_1_FINDINGS_TARGETED_RECHECK_ONLY  
BLIND_DECLARATION=本轮未采信作者自报、Round 1 结论或聊天摘要；四个修订设计输入重新读取，Round 1 owning sources 重新打开。用户中途通知 implementation design 已同根补强后，已丢弃此前 implementation-design hash/读取结果，并从磁盘重新完整读取 608 行与最新 sha256。  
FORBIDDEN_ACTIONS_OBSERVED=未运行 tests/generators/DEV/reset/start/seed/browser L2/UAT/Git；除本 review 文件外未修改其它文件。

## 0. Fixed verdict block

REVIEW_TARGET=DESIGN  
ACTION_1_VARIANT=1-B 文档提取  
VERDICT=GO_WITH_UNVERIFIED_UI  
M/S/N=0/0/1  
L1_ENGINEERING=PASS_WITH_N: Round 1 M-001/M-002/S-001/S-002/N-001 均 CLOSED；无新增 M/S。N-R2-001 为 implementation design §3 一处陈旧短语“30 UI writes”，已被同文件 §5.2 的 33 exact-set 与 4 条 OUT_OF_SCOPE 表压住，不阻断执行。  
L2_USER_VISIBLE=PASS_STATIC: 47 surface id、24 L2 case id、testId/key/locator 合流规则均已冻结；实际 browser L2 未执行且未授权。  
L3_UNVERIFIED=browser L2 execution; UAT; DEV/reset/start/seed; implementation runtime; generator/test execution; acceptance merge after-code assertion preservation; actual cursor/page behavior for new category/SKU reads.  
SAME_ROOT_SCAN=Round 1 五条 finding 均按同根输入、contract、owner API/task read/coordinator/controller、frontend catalog UI、acceptance annotations、L2 blueprint/locator、seed executor 定向复验；修订引入项只检查新增 M/S，不扩展第三轮议题池。  
DESIGN_GAPS=无阻断性设计缺口；仅 N-R2-001 stale wording follow-up。  
EVIDENCE_TIER=STATIC_DOCUMENT_AND_OWNING_SOURCE_ONLY

## 1. Input hashes

| Input | sha256 |
| --- | --- |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md` | `a6ce51c6fa64b94ec4566630adc8d548923ca009e31074a2000252910ef2bc9b` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md` | `31520cd2e7166544d85ff44d417e7a1c6a4adee2e49438196d7fa310462cd1d3` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md` | `5049c6a858b3710cb501b5ebc1cf8656a39c2a79b09f8f61f4184a9c7c9388c6` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-serial-plan-codex.md` | `2158664dcce01da4595ccce29fe866b7a961ed3cf30877362ea86cda76a0e25e` |

## 2. Round 2 targeted extraction

ACTION_1_VARIANT=1-B 仍有非空 extraction：

| Extracted fact | Round 2 result |
| --- | --- |
| Template omission from Round 1 M-001 | CLOSED: interaction §4.2 now declares `CURRENT_COMMAND_VARIANTS_33`; implementation §5.2 declares write exact-set 33 and adds 4 non-catalog-library inventory writes as `OUT_OF_SCOPE_WITH_REASON`. |
| Cross-document contradiction from Round 1 M-002 | CLOSED: implementation §5.1.1 now separates `CORE_CROSS_SCOPE_ASSERTION_SET=6`, `UI_SCOPED_OPERATION_READS=15`, `PUBLIC_NON_SCOPED_ASSET_READS=1`, `UI_READ_CONSUMERS=16`, and current/planned catalog GET counts `20→22`; IA-CATUI-01 now lists six core reads. |
| Unowned enum/bound from Round 1 S-001 | CLOSED: category query/page protocol now defines `usage`, root/null, keyword/parent exclusivity, cursor identity, `pageSize=1..100 default 50`, `items/total/cursor/nextCursor`, path segment shape, and `disabledReason`. |
| Missing testId/L2 materialization from Round 1 S-002 | CLOSED: implementation §11b now freezes 47 surface IDs, interactive control key API, three mechanical gates, and 24 L2 business case IDs; locator groups explicitly auto-include covered 47 surface testIds. |
| Annotation consolidation uncertainty from Round 1 N-001 | CLOSED_STATIC: four old scenario subcases now each have retained request/fact assertions and red mutation rows. Runtime assertion preservation remains L3 until implementation/test execution. |
| New residual | N-R2-001: implementation §3 mechanism table row still says “30 UI writes”; same file §5.2 and all exact-set rows say 33, so this is stale wording, not a new M/S. |

## 3. Independent recalculation required by Dexter

### 3.1 33 mutation exact rows

Interaction §4.2 contains 33 unique command variant rows:

1. `createOperationsCatalogItem`
2. `saveOperationsCatalogItem`
3. `transitionOperationsCatalogItemStatus`
4. `preflightOperationsTemporaryCatalogItemPromotion`
5. `executeOperationsTemporaryCatalogItemPromotion`
6. `stageOperationsCatalogAsset`
7. `releaseOperationsCatalogStagedAsset`
8. `batchTransitionOperationsCatalogItemStatus`
9. `createOperationsCatalogCategory`
10. `updateOperationsCatalogCategory`
11. `deleteOperationsCatalogCategory`
12. `moveOperationsCatalogCategory`
13. `createOperationsCatalogDictionaryEntry`
14. `updateOperationsCatalogDictionaryEntry`
15. `reorderOperationsCatalogDictionaryEntry`
16. `transitionOperationsCatalogDictionaryEntryStatus`
17. `createOperationsCatalogAttributeDefinition`
18. `updateOperationsCatalogAttributeDefinition`
19. `deleteOperationsCatalogAttributeDefinition`
20. `createOperationsCatalogOrderOptionDefinition`
21. `updateOperationsCatalogOrderOptionDefinition`
22. `deleteOperationsCatalogOrderOptionDefinition`
23. `createOperationsCatalogUnit`
24. `updateOperationsCatalogUnit`
25. `disableOperationsCatalogUnit`
26. `deleteOperationsCatalogUnit`
27. `preflightOperationsLocalCatalogCopy`
28. `executeOperationsLocalCatalogCopy`
29. `preflightOperationsBrandCatalogCopy`
30. `executeOperationsBrandCatalogCopy`
31. `createOperationsProductionTag`
32. `updateOperationsProductionTag`
33. `transitionOperationsProductionTagStatus`

Current owning contract static count remains `CURRENT_CONTRACT_NON_GET=37`; implementation §5.2 now explicitly excludes these 4 inventory writes:

- `countOperationsInventoryTarget`
- `increaseOperationsInventoryTarget`
- `adjustOperationsInventoryTarget`
- `updateOperationsInventoryTargetConfiguration`

Therefore Round 1 M-001 is CLOSED. The one stale “30 UI writes” phrase is N-R2-001, because the exact-set table and out-of-scope table now give an executor a determinate answer.

### 3.2 Read exact sets

Current static contract:

- `operationCount=57`
- current catalog GET operations = `20`
- current catalog non-GET operations = `37`
- `typedProblemCodes=46`
- new reads currently absent, as expected for design-only review:
  - `getOperationsCatalogCategoryCandidates=false`
  - `getOperationsCatalogItemSkus=false`

Design exact-set:

- `CURRENT_CONTRACT_CATALOG_GETS=20`
- `PLANNED_CONTRACT_CATALOG_GETS=22`
- `CORE_CROSS_SCOPE_ASSERTION_SET=6`: context, navigation, parent items, item detail, category candidates, item SKUs.
- `UI_SCOPED_OPERATION_READS=15`: all operations-admin read consumers except public asset.
- `PUBLIC_NON_SCOPED_ASSET_READS=1`: `getPublicAssetContent`.
- `UI_READ_CONSUMERS=16=15+1`.

Implementation §5.1 table independently recounts 16 read consumer rows, with public asset isolated at row 16. IA-CATUI-01 now explicitly includes context/navigation/item page/item detail/category candidates/SKU page as six core reads. Round 1 M-002 is CLOSED.

### 3.3 Category query/page/root/cursor/path/disabledReason

Implementation §5.1 now closes the protocol:

- `usage` required enum: `ITEM_ASSIGNMENT | CATEGORY_REPARENT`.
- `ITEM_ASSIGNMENT`: create/edit/batch item assignment; `currentCategoryRef` null/omitted.
- `CATEGORY_REPARENT`: category move parent; `currentCategoryRef` required.
- `parentCategoryRef` null/omitted means root page; otherwise direct children of that parent.
- Non-empty `keyword` requires `parentCategoryRef` null/omitted and returns matching nodes plus full `path`.
- `cursor` is opaque and valid only for the same scope/brand/usage/current/parent/keyword identity.
- `pageSize` is `1..100`, default `50`.
- Page response is `revision/requestId/data`; `data` contains `items/total/cursor/nextCursor`.
- Each item contains `categoryRef/code/name/parentCategoryRef/displayOrder/hasChildren/path/selectable/disabledReason`.
- `path` is `CategoryPathSegment[]` from root to current, segment `{categoryRef, code, name}`.
- `selectable=true` requires `disabledReason=null`; `selectable=false` requires user-understandable business reason, not problem code/ref/raw enum.
- Reparent current node and all descendants remain visible but unselectable.

Round 1 S-001 is CLOSED.

### 3.4 47 unique surface ids

Implementation §11b.1 has 47 surface IDs, `CATUI-01` through `CATUI-47`, all unique. The parser found 47 IDs and 47 unique IDs across 24 table rows. This satisfies the required 47 surface denominator.

### 3.5 24 exact L2 case IDs

Implementation §11b.3 has 24 unique L2 case IDs:

1. `catalog-find-success`
2. `catalog-find-failure`
3. `catalog-find-recovery`
4. `catalog-view-success`
5. `catalog-view-failure`
6. `catalog-view-recovery`
7. `catalog-create-success`
8. `catalog-create-failure`
9. `catalog-create-recovery`
10. `catalog-edit-success`
11. `catalog-edit-failure`
12. `catalog-edit-recovery`
13. `catalog-config-success`
14. `catalog-config-failure`
15. `catalog-config-recovery`
16. `catalog-batch-success`
17. `catalog-batch-failure`
18. `catalog-batch-recovery`
19. `catalog-copy-success`
20. `catalog-copy-failure`
21. `catalog-copy-recovery`
22. `catalog-governance-success`
23. `catalog-governance-failure`
24. `catalog-governance-recovery`

The latest file also states locator key groups automatically include the covered §11b.1 surface IDs, so no separate element-existence-only case denominator is created. Round 1 S-002 is CLOSED.

### 3.6 Four acceptance subcase assertion-preservation rows

Implementation §11 now provides four subcases with retained assertions and red mutations:

| Old subcase | New scenario/subcase | Static closure |
| --- | --- | --- |
| `sku-removal-blocked-by-inventory` | `catalog.sku-inventory-identity-and-removal` / `removalBlocked` | Retains target/composite/BOM references, 422 + `REFERENCE_BLOCKS_VOID`, no schema leak, unchanged SKU ref/target link/version/facts, with red mutation. |
| `sku-code-change-keeps-inventory` | same scenario / `codeChangeKeepsIdentity` | Retains `ACC-SKU-OLD`→`ACC-SKU-NEW`, stable SKU ref, inventory target same ref, with red mutation. |
| `copy-definition-semantic-conflict` | `catalog.copy-definition-semantic-conflicts` / `attributeDefinitionConflict` | Retains attribute semantic conflict, `BLOCKED`, typed reason/count, execute 422, target product absence, with red mutation. |
| `copy-order-option-definition-semantic-conflict` | same scenario / `orderOptionDefinitionConflict` | Retains order-option semantic conflict, `BLOCKED`, typed reason/count, execute 422, target product absence, with red mutation. |

Current source still has the four original scenario anchors and current acceptance annotation count is 80. Round 1 N-001 is CLOSED_STATIC; post-implementation proof remains L3.

### 3.7 17 mechanism rows

Implementation §3 contains 17 mechanism rows. Required rows for read auth, write auth, cross-owner transaction, collection shape, cache invalidation, RTK/currentData, state residence, error mapping, HTTP mapping, idempotency, generated-source discipline, logging, migration N/A, foundation reuse, candidate sources, business naming, and atomic groups are present.

Residual: row “owner 错误到 HTTP 的映射与注册处” still says “30 UI writes”. Because §5.2 has the exact 33-row write set and four explicit out-of-scope writes, this is recorded as N-R2-001 only.

### 3.8 16/16 anchors

The 16 anchors listed in implementation §9b were counted against current owning source; each literal occurs exactly once. Result: `16/16 unique`.

### 3.9 80 current annotations

Static recount across acceptance sources: `80` `@AcceptanceScenario` annotations. The four old scenario anchors named by the merge plan are present in current `CatalogAcceptanceScenarios.java`.

## 4. Round 1 finding disposition

| Round 1 finding | Round 2 disposition | Evidence |
| --- | --- | --- |
| M-001 write exact-set contradiction | CLOSED | 33 interaction rows; implementation §5.2 33 exact-set; 4 current non-GET inventory writes excluded with `OUT_OF_SCOPE_WITH_REASON`. |
| M-002 read authorization/read denominator mismatch | CLOSED | §5.1.1 separates 6/15/1/16 and current/planned GET 20/22; IA-CATUI-01 now uses six core reads. |
| S-001 category hierarchy cursor shape | CLOSED | Query/page/root/cursor/path/disabledReason are specified with closed `usage` enum and field rules. |
| S-002 testId/L2 denominator not materialized | CLOSED | §11b freezes 47 surface IDs, control API, gates, 24 case IDs, and locator-to-surface merging. |
| N-001 annotation consolidation unverified | CLOSED_STATIC | Four assertion-preservation subcases and red mutations are specified; current annotations remain 80. Runtime remains L3. |

## 5. New M/S scan from latest revisions

No new M/S introduced by the Round 2 repair.

| Candidate | Classification | Reason |
| --- | --- | --- |
| 4 non商品库 inventory writes exclusion | REJECTED_WITH_EVIDENCE | The four rows are explicitly excluded and match current 37 non-GET vs 33 UI writes. |
| `controls.config` `remove`→`delete` | REJECTED_WITH_EVIDENCE | Latest §11b.2 exposes `delete`; no lingering `remove` in the control key exact-set. |
| L2 locator group auto-joins 47 surfaces | REJECTED_WITH_EVIDENCE | Latest §11b.3 states locator key group expansion also includes covered surface IDs; this closes the previous surface-only gap. |
| Stale “30 UI writes” phrase | N-R2-001 CONFIRMED | One stale phrase remains in §3 row 80; exact-set rows close the executable denominator, so no M/S. |

## 6. Final note

This is the final Round 2 decision for this design review cycle. Per the two-round cap, any remaining product/runtime evidence questions should be carried as implementation prerequisites or L3 unverified inventory, not a third design review round.

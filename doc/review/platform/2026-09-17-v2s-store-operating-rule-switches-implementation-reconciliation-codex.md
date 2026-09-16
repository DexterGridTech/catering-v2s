# 门店经营规则开关 · 实施结果与 P9 逐代码对账

ARTIFACT=P9_IMPLEMENTATION_RECONCILIATION
STATUS=P9_COMPLETE
EXECUTOR=主 Codex agent
REVIEW_TARGET=IMPLEMENTATION
P9_OPEN_ITEMS=0
CLASSIFICATION_DATE=2026-09-17
REGISTRY_SOURCE=contracts/registry/operation-handler-bindings.json
REGISTRY_SOURCE_SHA256=29cc1de20b62162030070d0365ae2c926cf6aca8ba2c25e980fba8903eaf4707

## 1. 对账口径与结果

本记录按当前字节逐项重开需求、Journey、交互、IA、详设、实施计划、六维 memory 命中约束和 owning source。P9 是主 agent 的逐代码对账，不是 Claude 的独立 review 结论；Claude 的 `REVIEW_TARGET=IMPLEMENTATION` review 仍待 Dexter 转交。

| 事实 | 当前结果 | 对账状态 |
| --- | --- | --- |
| 规则声明 | 12 项、两个根、最大四层；类型闭集 BOOLEAN/NUMBER/STRING；默认 false/0/空字符串；当前实例 11 BOOLEAN、0 NUMBER、1 STRING | MATCHED |
| operation 分母 | registry 270；mapping 270；集合为 89 STORE-target-possible = 34 READ + 3 PREFLIGHT + 52 MUTATION，非 STORE 181 | MATCHED |
| gate 闭包 | 52 条 STORE mutation 全部在 owner mutation 前经过 typed gate；mapping 逐行与 registry exact set 一致 | MATCHED |
| error 闭包 | 52 条 403 mutation path，加 Store create/update 的 422 path，materialized closed set 54；closure 实测 79/79/157 | MATCHED |
| Store-target rule read | 三个 host 传显式 `storeId`；服务端用 `resolveTaskScope(session, STORE, storeId)`；项目层与门店层 acceptance 均读回目标 Store | MATCHED |
| audit | 四实体共享四态表示、label snapshot、legacy 明示、超过 2000 截断不反噬合法业务、精确 dynamic allowlist | MATCHED |
| seed | 每个体验 Store 显式 12 键 map，`catalogManagementEnabled=true`；owner readback 逐键校验 | MATCHED |
| 动态 evidence | 最终 backend acceptance business PASS、cleanup PASS、DEV restore PASS；reset/DEV/seed 独立 manifest 均已归档 | MATCHED |

## 2. 逐代码与详设对账

行号均按本记录生成时的当前字节。表中每一行都给出具体文件；generated 文件列出其生成边界，不能把生成目录当作未指明的通配 scope。

| 编号 | 当前源码/产物（仓根相对路径与行） | 对应详设/需求 | 核对结果 | 状态 |
| --- | --- | --- | --- | --- |
| P9-01 | `contracts/catalog/store-operating-rule-switches.json:1`；`contracts/catalog/store-operating-rule-switches.schema.json:1`；`scripts/generate/store-operating-rule-catalog.mjs:1` | 详设 §3.1 | 单一声明、树闭集、默认值、父子关系、四类非法声明校验和合法生成正例；generator self-test `cases=6` | MATCHED |
| P9-02 | `contracts/openapi/components/organization/store-operating-rule-schemas.generated.json:1`；`contracts/openapi/components/organization/store.schemas.json:1` 的 operatingRuleSwitches 引用；`contracts/openapi/paths/operations-admin/store-operating-rule.paths.json:1` | 详设 §3.2-3.3 | 12 键 fixed-key values、三类型 schema、Create omission、Update required、Store-target path 均由生成/契约链提供 | MATCHED |
| P9-03 | `contracts/openapi/edge.openapi.json:1`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/OrganizationStore.java:1`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/OrganizationStoreCreateRequest.java:1`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/OrganizationStoreUpdateRequest.java:1`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/OrganizationStoreOperatingRuleValues.java:1`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/StoreWireMapper.java:1` | 详设 §3.3 | schema 400 与 owner 422 分层、完整 values readback、generated wire 无手写第二份规则声明 | MATCHED |
| P9-04 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/domain/generated/StoreOperatingRuleCatalog.java:1`；`StoreOperatingRuleCodec.java:1`；`StoreOperatingRuleReadback.java:1` | 详设 §3.1-4.2 | Java generated definition/default/effective、stored/resolved codec 与 typed values wrapper 保持单一类型边界 | MATCHED |
| P9-05 | `apps/backend/catering-business-server/src/main/resources/db/migration/V20260916_090000_000__store_operating_rule_switches.sql:1`；`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/StorePersistence.java:88-134`；`StoreServiceSql.java:1` | 详设 §4.1 | 一个 JSONB 事实、NOT NULL empty-object default、insert/read/CAS update 同步、无索引/无回填 | MATCHED |
| P9-06 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreService.java:84-217`、`:356-386`、`:405-540`；`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OrganizationOwnerApi.java:1`；`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OperationsStoreCommandApi.java:1` | 详设 §4.2 | Store create/update 同一 REQUIRED transaction 保留 scope/grant/extension/CAS/idempotency，规则规范化后写入，owner readback 返回，audit 与业务命令边界一致 | MATCHED |
| P9-07 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreOperatingRuleController.java:47-67`；`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java:103-138` | 需求 §6 M-01 修复；详设 §4.2、§11 | 专用 Store-target read，不复用 project-target Store-management detail；显式 `storeId` 与 `resolveTaskScope(session, STORE, storeId)`；无 ambient session store 推导 | MATCHED |
| P9-08 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java:1038-1073`；`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/CommandExecutionContextResolver.java:129-137`；`apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/WorkspaceCommandOperationToken.java:79`；`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/StoreOperatingRuleGate.java:11-18` | 需求 §6 R-9.2a-c；详设 §11 | owner public gate 与 generated token/central resolver 对接；非 STORE target 不误判为 Store mutation；disabled 时 mutation 前拒绝 | MATCHED |
| P9-09 | `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java:410-413`；`apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuAssetCommandFacade.java:1`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java:126-146` | 详设 §4.2、§6.1、§13 | sales-menu 直接命令与 asset 命令复用 typed gate；problem advice 输出中文 typed problem | MATCHED |
| P9-10 | `contracts/registry/operation-handler-bindings.json:1`；`contracts/registry/generated/operation-handler-bindings/organization.json:1`；`contracts/registry/generated/operation-handler-bindings/java/com/catering/v2s/generated/operationbindings/organization/OrganizationOperationBindings.java:1`；`apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json:1` | 详设 §6、计划 P4 | registry 与 mapping exact set 270/270；operation bindings 15 JSON + 15 Java；face 物化 61/139/12，source hash 与 mapping 一致 | MATCHED |
| P9-11 | `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-operation-mapping-codex.md:1`（270 行 operation 表，52 条 mutation 行） | 详设 §6；需求 R-9.2a-c | 52 行逐行都指向 `StoreOperatingRuleGate.requireCatalogManagementForStoreTarget(...)`；没有把 34 read、3 preflight、181 non-STORE 接入 gate | MATCHED |
| P9-12 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/EdgeProblemCode.java:1`；`apps/frontend/operations-admin/src/app/api/OperationsTransport.ts:1`；`apps/frontend/operations-admin/src/app/api/operationsProblemFeedback.ts:1`；`apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts:1`；`contracts/catalog/catalog-inventory-edge-contract.json:1`；`scripts/generate/r5-edge-materialize.mjs:1` | 详设 §3.3、§6.1 | 403 typed code、422 owner code、error metadata、generated enum/advice、operations feedback 与 x-error-codes 链闭合；closure=79/79/157 | MATCHED |
| P9-13 | `apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChange.java:6-60`；`apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChangeJson.java:9-90`；`apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChangePolicy.java:9-30`；`apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditValueState.java:1`；`apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditHistoryResultSetReader.java:1` | 详设 §5.1-5.2 | MISSING/NULL/CLEARED/VALUE、空字符串、legacy-unclassified、label snapshot 和截断编码不合并；policy 对未知键 fail closed | MATCHED |
| P9-14 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityValueSupport.java:114-213`；`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessBrandService.java:1`；`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessTenantService.java:1`；`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/HeadCompanyService.java:1`；`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreService.java:743-871` | 需求 §7.3；详设 §5.3 | 四类实体复用同一 extension audit support；dynamic key 来自本次 definition，不用任意 prefix；Store rules 另附 generated diff | MATCHED |
| P9-15 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/audit/AuditHistoryWireMapper.java:1`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/AuditChange.java:1`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/AuditValueState.java:1`；`apps/frontend/operations-admin/src/features/audit-history/ui/OperationsAuditHistoryModal.tsx:1`；`apps/frontend/platform-admin/src/features/audit-history/ui/PlatformAuditHistoryModal.tsx:1`；`apps/frontend/operations-admin/src/features/audit-history/ui/auditChangePresentation.ts:1`；`apps/frontend/platform-admin/src/features/audit-history/ui/auditChangePresentation.ts:1` | 详设 §5.4、§7.3 | 双端使用同一 state/label 语义；不把 fieldKey 当中文文案；legacy 与四种空可读 | MATCHED |
| P9-16 | `apps/frontend/operations-admin/src/features/store-management/ui/StoreEditDrawer.tsx:89-228`、`:338-339`；`apps/frontend/operations-admin/src/features/store-management/storeManagementTestIds.ts:1`；`apps/frontend/operations-admin/src/app/components/OperationsStoreCatalogManagementDisabledSurface.tsx:14-32` | 详设 §7.1 | 规则进入既有 Drawer/Form lifecycle；generated 顺序、父子 disabled、完整 payload、真实动作 testId、失败留稿和 shared disabled surface 均存在 | MATCHED |
| P9-17 | `apps/frontend/operations-admin/src/features/store-operating-rules/model/useStoreOperatingRuleGate.ts:17-56`；`apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/CatalogWorkbenchController.tsx:1`；`apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchContent.tsx:1`；`apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx:1`；`apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx:1` | 详设 §4.2、§7.2；IA-SOS-02 | 三 host 只读显式 Store rule；scope missing/loading/failed/disabled 不挂载列表子树、不发 list request；恢复/refresh 不使用 local mirror | MATCHED |
| P9-18 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementController.java:1`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreProfileController.java:1`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/organization/application/operations/CreateOperationsOrganizationStoreOperation.java:1`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/organization/application/operations/UpdateOperationsOrganizationStoreOperation.java:1`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/organization/application/operations/TransitionOperationsOrganizationStoreStatusOperation.java:1` | 详设 §4.2、§11 | 既有 Store 管理详情保持自身 project-target 边界；command readback 不回退为 request echo；状态命令与 Store 资料命令边界没有把旧 detail 当作规则事实地址 | MATCHED |
| P9-19 | `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/OrganizationAcceptanceScenarios.java:213-320`；`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java:2384-2617`；`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/AuditAcceptanceScenarios.java:1`；`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java:849-888` | 详设 §9.3；计划 P6 | 真实 HTTP 场景含项目层/门店层读、父 false 子 true、closed Store batch/local/brand copy rejection 和 open positive；不是只验证页面空态 | MATCHED |
| P9-20 | `apps/backend/catering-business-server/modules/audit-model/src/test/java/com/catering/v2s/audit/contract/AuditChangeJsonTest.java:1`；`apps/backend/catering-business-server/modules/organization/src/test/java/com/catering/v2s/organization/application/BusinessEntityValueSupportTest.java:1`；`apps/backend/catering-business-server/modules/organization/src/test/java/com/catering/v2s/organization/application/StoreOperatingRuleCodecTest.java:1`；`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/generated/wire/OrganizationStoreOperatingRuleWireBindingTest.java:1`；`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementControllerCandidateScopeTest.java:1`；`apps/backend/catering-business-server/src/test/java/edge/problem/ContractProblemAdviceTypedOwnerMappingTest.java:1` | 详设 §3、§5、§9.3 | focused/unit/architecture tests 对 schema/owner boundary、四态 audit、typed gate、readback 和 seed seam 有正反保护；非 production test seam 已单列 | MATCHED |
| P9-21 | `scripts/dev/owner-command-seed-executor.mjs:151-192`、`:707-713`；`scripts/dev/owner-command-seed-executor.test.mjs:1`；`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json:278-284`；`scripts/dev/r5-seed-plan.mjs:1` | 详设 §9.1；计划 P7 | 完整 12 键 map、`catalogManagementEnabled=true`、request payload 与逐键 owner readback assertion；省略 true 会 red | MATCHED |
| P9-22 | `scripts/generate/backend-performance-budget.mjs:1`；`contracts/policy/backend-performance-cp05-calibration-report.json:1`；`scripts/test/backend-performance-budget.test.mjs:1`；`scripts/test/backend-performance-event-verifier.mjs:1` | 详设 §6、计划 P6 | brand-copy 49 预算 exception 是精确 operation-scoped，CP05 270/270，三次 calibration evidence；不以预算删除业务事实 | MATCHED |
| P9-23 | `scripts/test/catalog-inventory-query-envelope.test.mjs:1`；`scripts/test/catalog-inventory-reference-path-matrix.test.mjs:1`；`scripts/test/catalog-inventory-seed-identity.test.mjs:1`；`scripts/test/base1-three-state-lifecycle-migration.test.mjs:1`；`scripts/test/catalog-p3-model-migration.test.mjs:1`；`scripts/test/sales-menu-l2-fixture.mjs:1` | 详设 §9.3、计划 P1/P6/P7 | 本批发现的 stale test seam 已按当前 owning source 修复，focused/static tests 不再指向不存在的旧路径或过期 fixture shape | MATCHED |
| P9-24 | `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-design-codex.md` §3-19；`doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-plan-codex.md` P0-P9；本文件 §1-5 | 需求全链与计划 P8/P9 | 当前状态、M-01/N-01 处置、reset/DEV/seed evidence、P9 行号和 review pending 口径已同步；没有残留“本轮未执行”作为当前事实 | MATCHED |

## 3. 52 条 STORE mutation 全量映射确认

以下是 mapping 中当前 52 条 gate 行的 exact operationId 集合；它们全部以目标解析后为 STORE 为前提，在 owner mutation 前调用同一 typed gate。batch status、local copy、brand copy 三类旁路单独列入，不能由单条创建测试代替。

```text
createOperationsCatalogItem
saveOperationsCatalogItem
transitionOperationsCatalogItemStatus
batchTransitionOperationsCatalogItemStatus
createOperationsCatalogCategory
updateOperationsCatalogCategory
moveOperationsCatalogCategory
createOperationsCatalogDictionaryEntry
updateOperationsCatalogDictionaryEntry
reorderOperationsCatalogDictionaryEntry
transitionOperationsCatalogDictionaryEntryStatus
createOperationsProductionTag
updateOperationsProductionTag
transitionOperationsProductionTagStatus
executeOperationsLocalCatalogCopy
executeOperationsTemporaryCatalogItemPromotion
executeOperationsBrandCatalogCopy
countOperationsInventoryTarget
increaseOperationsInventoryTarget
adjustOperationsInventoryTarget
updateOperationsInventoryTargetConfiguration
stageOperationsCatalogAsset
releaseOperationsCatalogStagedAsset
createOperationsCatalogAttributeDefinition
updateOperationsCatalogAttributeDefinition
createOperationsCatalogOrderOptionDefinition
updateOperationsCatalogOrderOptionDefinition
createOperationsCatalogUnit
updateOperationsCatalogUnit
transitionOperationsCatalogAttributeDefinitionStatus
transitionOperationsCatalogOrderOptionDefinitionStatus
transitionOperationsCatalogUnitStatus
transitionOperationsCatalogCategoryStatus
addOperationsSalesMenuItems
archiveOperationsSalesMenu
copyOperationsSalesMenu
createOperationsSalesMenu
createOperationsSalesMenuSection
deleteOperationsSalesMenuItem
deleteOperationsSalesMenuSection
moveOperationsSalesMenuItem
moveOperationsSalesMenuSection
publishOperationsSalesMenu
releaseOperationsSalesMenuStagedAsset
renameOperationsSalesMenu
renameOperationsSalesMenuSection
restoreOperationsSalesMenuItemSale
setOperationsSalesMenuActivation
setOperationsSalesMenuItemSoldOut
stageOperationsSalesMenuAsset
updateOperationsSalesMenuItem
updateOperationsSalesMenuSchedule
```

机械复核结果：registry operation set=270，mapping operation set=270，`missing=[]`、`extra=[]`；mapping 计数 `STORE=89`、`READ=34`、`PREFLIGHT=3`、`MUTATION=52`、`non-STORE=181`。当前 registry source SHA-256 与本文件头及 mapping header 均为 `29cc1de20b62162030070d0365ae2c926cf6aca8ba2c25e980fba8903eaf4707`。

## 4. 实际验证与证据索引

### 4.1 静态与 focused

| 验证 | 实际结果 |
| --- | --- |
| `node scripts/generate/store-operating-rule-catalog.mjs --check` | PASS |
| `node scripts/generate/store-operating-rule-catalog.mjs --self-test` | `STORE_OPERATING_RULE_CATALOG_SELF_TEST=PASS cases=6 LEGAL_POSITIVE=PASS outputs=3` |
| `node scripts/generate/r5-edge-materialize.mjs --check` | `R5_EDGE_MATERIALIZE=PASS OPERATIONS=212 FACES=61/139/12` |
| `node scripts/generate/edge-codegen.mjs --check` | `R5_EDGE_CODEGEN_CHECK=PASS FILES=377` |
| `node scripts/generate/operation-handler-bindings.mjs --check` | `BP_U02_BINDING_CHECK=PASS ... JSON_FILES=15 JAVA_FILES=15 FILES=30` |
| `node scripts/generate/catalog-inventory-workspace-command-tokens.mjs --check` | `BP_U03_RUNTIME_TOKEN_CHECK=PASS TOKENS=36 CONTEXT_FORGERY_NEGATIVE=PASS` |
| `./gradlew --no-daemon :apps:backend:catering-business-server:compileJava :apps:backend:catering-business-server:compileTestJava` | `BUILD SUCCESSFUL`；随后 `backendPmdPreserveStackTrace` 亦 `BUILD SUCCESSFUL` |
| operations-admin / platform-admin / admin-ui-foundation | 分别 44/264、11/29、7/56 tests passed；三者 typecheck passed |
| frontend architecture / backend boundaries / OpenAPI / terminology / wireframe checks | PASS |
| backend acceptance operation/budget verifier | 6/6；270/270；UNCLASSIFIED_SQL=0；budget blocked=0 |

仓内已有的非本批静态基线观察单列，不升级为本批失败：code-layout 只命中 Android 生成空目录与本地 `.playwright-cli`/`output`；Spotless 长任务的首个实际问题是多个既有文件的 UTF-8 行长上限；terminal readability 只命中既有 `AdminLauncher` 四参数。这些没有被删除或伪报 PASS。

### 4.2 受管 backend acceptance

证据目录：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789578383813-98101/`。

`run-manifest.json` 当前结果：

```text
status=PASS
testExecution=PASS
business=PASS
cleanup.remoteProcess=PASS
cleanup.remoteWorkspace=PASS
cleanup.testcontainersContainers=PASS
cleanup.testcontainersVolumes=PASS
devLifecycle.wasRunning=true
devLifecycle.stop=PASS
devLifecycle.restore=PASS
devLifecycle.cleanup=PASS
evidenceArchive=PASS
operationSet=270/270
unclassifiedSqlOperations=0
budgetEvidence.exceeded=0
```

backend acceptance result archive 是 `backend-acceptance-result.jsonl.gz`；所有真实场景记录 `contract=PASS`、`business=PASS`、`businessAssertion=HAND_WRITTEN_BUSINESS_ORACLE`。其中 `org.store-operating-rule-read-write-and-assignment-scope` 覆盖项目层和门店层读取，`catalog.closed-store-rejects-batch-status`、`catalog.closed-store-rejects-brand-copy` 以及对应 local-copy 场景覆盖两条重点旁路；这些不是浏览器证据。

### 4.3 reset / DEV / seed

| 动作 | 运行结果 | manifest / report |
| --- | --- | --- |
| reset | `R5_DEV_RESET=PASS`；数据库 absent readback PASS；无持久 reset process | `.runtime/r5/reset/r5-reset-022c56a8-8b6e-4a69-af52-2c6d37a16cf6/run-manifest.json` |
| DEV start/restore | `R5_DEV_START=PASS`；remote Java readiness PASS；HTTP/asset tunnel 与两个本机 Vite identity 已记录；最终 `scripts/dev/check` PASS | `.runtime/r5/run-manifest.json`；DEV run `r5-dev-1789578973390-99236-9ea53594-895a-4a66-b917-d040305b5e0f` |
| complete seed | `R5_COMPLETE_SEED=PASS`；cleanup=`PASS_PRESERVED_DEV_STATE`；owner/collaboration/catalog-inventory/sales-menu 分项 PASS | `.runtime/r5/seed/complete/complete-seed-68fc6676-6659-4472-8d18-9dd31d55f438/run-manifest.json`；`seed-report.json` |

owner seed executor 在 `owner-command-seed-executor.mjs:151-192` 校验完整 12 键、类型和 `catalogManagementEnabled=true`，在 `:707-713` 发送 payload 并逐键验证 owner readback；这才是 seed capability 的事实证据，fixture 本身不被当作 runtime readback。

## 5. 仍未授权与 review 边界

- 当前代码/契约/seed/受管运行均已按本批授权完成；P9 无 OPEN。
- 实施后 fresh 独立静态 review 尚未给出 verdict；本记录不产生 `GO`/`NO-GO`，也不填 `M/S/N`。
- browser L2、UAT、生产部署仍为 `NOT_AUTHORIZED`，不能将 backend acceptance、DEV 或 seed 解释为 browser/UAT 证据。
- 发现并修复的生成 digest drift（`GEN-01`）已在最终生成检查、source hash 和最终 acceptance 前闭合；它不是 Claude 新 finding，也不改变 review 轮次。

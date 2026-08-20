# 统一列表分页 CP-00 至 CP-16：Codex implementation review

REVIEW_CYCLE_ID=UNIFIED_LIST_PAGINATION_IMPLEMENTATION_2026-08-18
REVIEW_TARGET=IMPLEMENTATION
INDEPENDENT_REVIEW_ROUND=1_INVALID_STAGE2_UNAVAILABLE
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT_ATTEMPTED_BUT_NO_COMPLETE_VERDICT
ROUND_FINAL_DECISION=UNVERIFIED_REQUIRES_EVIDENCE

日期：2026-08-18  
作者：Codex  
范围：CP-00 至 CP-16，以及授权的 S-1 取证修正和 N-1 记忆沉淀。  
审查依据：需求分析、implementation-facing 详设、当前源码、当前静态 proof、受管 backend-acceptance 证据；fresh 独立 reviewer 已启动但未形成完整阶段二 verdict。  

## 1. 总结判定

当前判定：**NO-GO · M=1 · S=0 · N=2**，阻断仅表示独立 implementation review 未闭合，不表示当前实现已被证明失败。

最终受管 `backend-acceptance` 已在当前代码与测试树上完成：44/44 场景的 CONTRACT、BUSINESS
与 `businessMode=REAL` 均 PASS，cleanup PASS，且 run 晚于仓内当前 apps/contracts/libraries/scripts/
doc/project-memory 修改。这个结论只覆盖本批静态、编译、focused、真实 HTTP/真实 PostgreSQL
acceptance 证据，不包含浏览器 L2、UAT 或 DEV 体验。代码实现与业务证据已经具备交付条件，但本仓
强制的 fresh 两阶段独立 review 仍缺阶段二 verdict，因此不能把作者自审升级为最终 GO。

N-1：CP09 按批准范围保留已经真实合规的 Catalog/Inventory Cursor，不为统一而重写；因此本批不
声称仓内所有内部 cursor 都已经改成新的 opaque foundation。该保留边界已单独记录在
`doc/evidence/platform/2026-08-18-v2s-unified-list-pagination-cp09-retained-cursor-proof-codex.json`。

## 2. 前一轮 reviewer intake 的历史边界

前一轮 `Carver` 的 verdict 覆盖的是受管 acceptance 尚未形成时的中间树；其中关于资源预算阻断
和缺少当前 BUSINESS 证据的结论已经由本次授权关闭 DEV、重新运行受管 runner 后关闭，不把旧 verdict
冒充当前最终 verdict。fresh implementation reviewer 必须重新打开当前源码、当前 evidence 和本文件，
并按两阶段盲审规则独立复测数字；本节只保留历史 findings 的处置轨迹：

| finding | 状态 | 处置与证据 |
|---|---|---|
| CP02 使用数字 OFFSET/伪 opaque cursor | CONFIRMED（旧状态）→ CLOSED | 新增 `OpaqueCollectionCursor`，四个 fake cursor owner 改为 keyset frontier + query identity；foundation 单测与 affected compile 通过。受管 BUSINESS 仍未运行。 |
| 两个精确 acceptance identity 缺失 | CONFIRMED（旧状态）→ CLOSED | `pagination.workspace-user-candidates-db-page` 与 `pagination.contract-page-owner-boundary` 已写入对应 `AcceptanceScenarios.java`；当前搜索各命中 1。 |
| `InventoryOwnerService.pageEntries` 死私有方法 | CONFIRMED（旧状态）→ CLOSED | 删除后按路径搜索命中数为 0；ledger 孤儿类型/方法搜索数为 0。 |
| 当前代码没有新鲜 managed backend-acceptance | REJECTED_WITH_EVIDENCE（已关闭） | 当前 run `r5-tc-1787057770120-44319` 具有 `backend-acceptance-result.jsonl`、44/44 CONTRACT/BUSINESS PASS、`businessMode=REAL` 与 cleanup PASS，且时序晚于当前源文件。 |
| 本地受管资源预算失败 | CONFIRMED（已处置） | 该阻断发生在前一轮；Dexter 已授权关闭 DEV。`scripts/dev/stop` PASS，随后 `LIVE_MANAGED_PROCESSES=0`、`MANAGED_RSS_MB=0`、`scripts/dev/check` PASS；未按端口或命令名猜测杀进程。 |
| CP09 内部仍存在旧式 cursor/offset 事实 | PARTIALLY_CONFIRMED（有意保留） | CP09 详设明定保留真实合规的 Catalog/Inventory Cursor；这不是本批缺陷，不扩范围改写。 |

### 当前 fresh reviewer 尝试（本轮未形成有效 verdict）

`Cicero` 完成了阶段一，但在作者材料与最终 evidence 解锁前未形成阶段二 verdict；随后按收口规则
受控停止。阶段一明确读到了四种集合判据，并把 83/72/50/45/43/25/9/9、边界集合和前端物理基线
记录为“需求材料基线”，但因其自带 shard `$ref` resolver 落到
`contracts/openapi/paths/common/enum.schemas.json`，没有完成数字 fresh 复测。这个失败只说明该独立
review 阶段一没有拿到完整复测证据，不反证取证件中的根文件扫描结果。

阶段二因此是 `UNVERIFIED_REQUIRES_EVIDENCE`，不是代码 finding：作者详设、作者 review、最终
`backend-acceptance-result.jsonl`、manifest 与结构化日志均未被该 reviewer 读取。按独立审查治理，
本轮不把作者自审或前一轮 reviewer 结果升级为 fresh GO，也不发起第三轮；后续应在独立 review
能力可用时补做同一 cycle 的阶段二核验。

## 3. S-1 与 N-1

### S-1：根级数组取证更正

已按包含两个 OpenAPI 根文件的口径保存取证件：
`doc/evidence/platform/2026-08-18-v2s-unified-list-pagination-root-array-scan-codex.json`。

- operationId 去重后的 GET operation：83；
- 根级数组机械候选：72；
- 取证覆盖 `contracts/openapi/edge.openapi.json` 与
  `contracts/openapi/catalog-inventory.openapi.json`；
- 已补回 catalog-inventory 根文件解引用得到的 8 个 operation：
  `getOperationsBrandCatalogCopyCandidates`、`getOperationsCatalogDictionary`、
  `getOperationsLocalCatalogCopyCandidates`、`getOperationsProductionTags`、
  `getOperationsCatalogItems`、`getOperationsInventoryTargets`、
  `getOperationsCatalogItem`、`getOperationsCatalogNavigation`；
- 43 个分页成员、45 个主集合成员、50 个受审 operation 和 CP 集合未改变；
- 未把 ExtensionDefinition 整体聚合加入分页分母，符合 Dexter 关于“数据库整体保存、业务整体读取”的裁定。

N-1 已写入 `project-memory/pitfalls/denominator-inherited-not-built.md`：以 paths shard 目录作为
OpenAPI 普查唯一入口会遗漏只能经根文件解引用的响应形状；以后必须扫描根文件并保存完整成员清单与
反向差集。

## 4. 43 个分页成员落位

以下清单逐条对应详设 §5.1–§5.3；不使用“其余同上”。模式、owning source、目标边界和 CP 的完整
描述以详设该行原文为准。

### Page：25

| 成员 | CP |
|---|---|
| getOperationsContractPage | CP05 |
| getOperationsOrganizationBusinessEntities | CP06 |
| getOperationsOrganizationCommercialGroups | CP06 |
| getOperationsOrganizationRegions | CP06 |
| getOperationsOrganizationProjects | CP06 |
| getOperationsOrganizationStores | CP06 |
| getOperationsOrganizationTenants | CP06 |
| getOperationsWorkspaceGroupInvitations | CP07 |
| getOperationsWorkspaceGroupUser | CP07 |
| getOperationsWorkspaceHeadCompanyInvitations | CP07 |
| getOperationsWorkspaceHeadCompanyUser | CP07 |
| getOperationsWorkspaceProjectInvitations | CP07 |
| getOperationsWorkspaceProjectUser | CP07 |
| getOperationsWorkspaceRegionInvitations | CP07 |
| getOperationsWorkspaceRegionUser | CP07 |
| getOperationsWorkspaceStoreInvitations | CP07 |
| getOperationsWorkspaceStoreUser | CP07 |
| getPlatformAdminPage | CP08 |
| getPlatformContractOverviewPage | CP05 |
| getPlatformEntityAuditHistory | CP08 |
| getPlatformOrganizationOverviewPage | CP06 |
| getWorkspaceAccounts | CP07 |
| getWorkspaceInvitations | CP07 |
| getWorkspaceRoles | CP07 |
| listPlatformGroupWorkspaces | CP08 |

### Page candidate：9

| 成员 | CP |
|---|---|
| getOperationsContractCandidates | CP05 |
| getOperationsOrganizationCandidates | CP06 |
| getOperationsWorkspaceGroupInvitationCandidates | CP07 |
| getOperationsWorkspaceHeadCompanyInvitationCandidates | CP07 |
| getOperationsWorkspaceProjectInvitationCandidates | CP07 |
| getOperationsWorkspaceRegionInvitationCandidates | CP07 |
| getOperationsWorkspaceStoreInvitationCandidates | CP07 |
| getPlatformOrganizationCandidates | CP06 |
| getWorkspaceInvitationCandidates | CP07 |

### Cursor：9

| 成员 | CP |
|---|---|
| getOperationsBrandCatalogCopyCandidates | CP02 |
| getOperationsCatalogDictionary | CP02 |
| getOperationsCatalogItems | CP09（保留） |
| getOperationsInventoryTargetBusinessHistory | CP09（保留） |
| getOperationsInventoryTargetConsumptionReferences | CP09（保留） |
| getOperationsInventoryTargetLedger | CP09（保留） |
| getOperationsInventoryTargets | CP09（保留） |
| getOperationsLocalCatalogCopyCandidates | CP02 |
| getOperationsProductionTags | CP02 |

另有 B01、B02 两个主集合边界、B03–B07 五个整体聚合 Detail 和 7 行边界矩阵。B02
`getOperationsOrganizationStoreCandidates` 按 Dexter 裁定退役，不改造成 Page 或 Bounded；B03–B07
按整体保存/整体读取规则保持 Detail。

## 5. 受管动态证据与 DEV 关闭

最终受管 run：
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1787057770120-44319/`。

真实 manifest 与 JSONL 对账：

- `runId=r5-tc-1787057770120-44319`；
- `startedAt=2026-08-18T12:56:10.120Z`；
- `completedAt=2026-08-18T12:57:42.616Z`；
- `sourceSync.status=PASS`；`testExecution.status=PASS`；`remoteGradleStatus=0`；
- `discovered=44`、`selected=44`，44 条场景的 `CONTRACT=PASS`、`BUSINESS=PASS`、
  `businessMode=REAL`，`businessAssertion=HAND_WRITTEN_BUSINESS_ORACLE`；
- `cleanup.status=PASS`，且 `remoteProcess`、`remoteWorkspace`、
  `testcontainersContainers`、`testcontainersVolumes` 均为 `PASS`；
- `http-request-events.jsonl` 共 990 条 acceptance HTTP 事件；它不是浏览器 L2 或 RTK 请求集证据；
- 模块分布为 ASSET 2、CATALOG 18、CONTRACT 4、EXTENSION 2、IAM 10、ORG 7、PLATFORM 1。

本次 run 的 shell 退出码为 0，runner 输出为：

```text
BACKEND_ACCEPTANCE_SUMMARY DISCOVERED=44 SELECTED=44 HTTP_SUCCESS=44 REAL_BUSINESS_ASSERTIONS=44 STUB_ONLY=0 DIRECT_FAILURES=0
R5_REMOTE_TESTCONTAINERS=PASS; TASK=:apps:backend:catering-business-server:test; RESOURCE_CLEANUP=PASS
R5_TESTCONTAINERS_FINISHED RUN_ID=r5-tc-1787057770120-44319 TASK=:apps:backend:catering-business-server:test STATUS=PASS
```

DEV 关闭证据：

```text
R5_DEV_STOP=PASS
LIVE_MANAGED_PROCESSES=0
MANAGED_RSS_MB=0
STATUS=PASS
R5_DEV_ENVIRONMENT=PASS; MODE=check; DATABASE=catering_v2s_dev_r5_full
```

时序 proof：以 `startedAt` 为界，`find apps contracts libraries scripts -type f
-newermt '2026-08-18 21:56:10'` 输出 0 条；该命令按本机 Asia/Seoul 时区对应
`2026-08-18T12:56:10.120Z`。因此本 run 晚于可执行生产、契约、foundation 与测试脚本修改。
本 review 文档和本地证据索引属于运行后的审查产物，不把它们伪装成 run 前源码。

本节不把模块 Gradle test、静态门、`response.ok`、DEV 或 HTTP acceptance 事件升格为浏览器 L2、
UAT、RTK 请求集或性能基线。`DB_OPERATIONS` 仅为诊断输出，不是 business oracle。

## 6. CP-00 至 CP-16 状态

| CP | 状态 | 当前结论 |
|---|---|---|
| CP-00 | CONFIRMED_STATIC | 43/45/50 分母、B01/B02、Detail 边界与 11 个 acceptance identity 已锁定；场景代码已存在。 |
| CP-01 | CONFIRMED_STATIC | foundation Page/Cursor 原语与 focused harness 已实现；foundation 4 个 test file、38 tests 真实通过。 |
| CP-02 | CONFIRMED | 四个 owner 已改为 opaque query-identity + keyset；`pagination.brand-copy-candidates-real-cursor`、`pagination.catalog-dictionary-real-cursor`、`pagination.local-copy-candidates-real-cursor`、`pagination.production-tags-real-cursor` 均在当前 run BUSINESS PASS。 |
| CP-03 | CONFIRMED_STATIC | 退役 operation 的 contract/edge/generated/owner 消费链已删除；具体 token/path 反向搜索已做。 |
| CP-04 | CONFIRMED | Workspace candidates 已改为 DB Page 形态；`pagination.workspace-user-candidates-db-page` 与相关 IAM scope 场景在当前 run BUSINESS PASS。 |
| CP-05 | CONFIRMED | Contract Page owner 与 exact acceptance identity 已闭合；`pagination.contract-page-owner-boundary` 在当前 run BUSINESS PASS。 |
| CP-06 | CONFIRMED | Organization Page owner/filter/scope 场景已闭合；`pagination.organization-page-owner-boundary` 与 organization candidate 场景在当前 run BUSINESS PASS。 |
| CP-07 | CONFIRMED | Workspace IAM Page/candidate 形态、scope isolation 与 cursor/page 边界在当前 run BUSINESS PASS。 |
| CP-08 | CONFIRMED | Platform/audit Page surface 已接入 foundation；`pagination.platform-page-owner-boundary` 与相关 platform/organization acceptance 在当前 run BUSINESS PASS。 |
| CP-09 | CONFIRMED_STATIC_NO_ACTION | 按批准边界保留 U03–U07，不为统一重写已正确 owner SQL；详见 retained proof。 |
| CP-10 | CONFIRMED_STATIC_AND_FOCUSED | Page frontend surfaces 与 foundation focused behavior 已通过；本批不宣称浏览器 L2/UAT。 |
| CP-11 | CONFIRMED_STATIC_AND_FOCUSED | Cursor frontend surfaces 与旧手工分页已闭合到 foundation/static/type 层；本批不宣称浏览器 L2/UAT。 |
| CP-12 | CONFIRMED_STATIC | B01 exact set 与 B03–B07 Detail/整体读写边界保持；未伪造 Bounded 或分页。 |
| CP-13 | CONFIRMED_STATIC | OpenAPI/generated/edge/consumer 静态链与 `scripts/verify --validate-only` 通过。 |
| CP-14 | CONFIRMED_MANAGED | 当前 run source sync、真实 HTTP/容器 test、CONTRACT、BUSINESS、businessMode=REAL 与 cleanup 均 PASS，run 晚于当前核验范围修改。 |
| CP-15 | CONFIRMED_STATIC | `pageEntries` 搜索计数为 0；ledger 孤儿类型/方法计数为 0；保留集合反向 proof 已检查。 |
| CP-16 | PENDING_FRESH_INDEPENDENT_REVIEW | 需求-详设-代码三方回读、当前证据与作者自审已完成；fresh 独立 implementation reviewer 尚未给出最终 verdict。 |

## 7. 六项旧代码下线双向 proof

| 下线项 | 删除侧证据 | 保留侧证据 |
|---|---|---|
| 四个 fake cursor 的固定 LIMIT/丢 request/无条件 null | 对 `pageSlice` 的源码搜索为 0 条、对四个退役 fake 形态的具体 token/path 搜索为 0 条；当前 owner SQL 的 page size 绑定仍为参数化 `LIMIT ?`，末页才返回 null cursor | 四个 exact cursor acceptance identity 当前各出现 1 条，`OpaqueCollectionCursor` foundation 与 4 条 BUSINESS PASS 保留 |
| StoreCandidate full-list/pageSlice/selected replacement | `pageSlice` 搜索为 0 条，`slice.set(safeSize - 1, selected)` 搜索为 0 条；不再以全量集合或顶替补丁形成页面 | organization candidate Page 场景当前在 acceptance 中 PASS，selected 不顶替当前页成员 |
| Workspace visible/enabledRoles full-list slice | `visible`/`enabledRoles` 的旧 full-list slice 组合在 workspace owner 目标路径中未命中；健康闭环执行的 20 个 node test file 全部纳入 | `getWorkspaceAccounts` 正确 Page 样板仍在，workspace candidate Page 场景当前 BUSINESS PASS |
| 五个手工 cursor/上一页下一页表格 | 旧业务 surface 的 `pageSlice` 与手工翻页 state 已删除；foundation `cursorPagination.tsx` 中保留 1 组上一页/下一页控件文本，作为真实 Cursor primitive，不误报为旧业务表格 | Cursor foundation、Catalog/Inventory/Production 的真实 Cursor surface 与 U03–U09 保留 |
| Page Table 上的 useCursorStack | `useCursorStack` 当前 17 条引用中，5 条属于 foundation 导出/实现/测试，其余属于 Catalog/Inventory 真实 Cursor surface；Page architecture/focused proof 未发现 Page Table 将其作为任意页码状态 | Cursor surface 继续保留 cursor primitive，避免把真实连续翻页能力误删 |
| 方法/类型/hook/generated 遗留消费 | `InventoryOwnerService.pageEntries`、`ledgerReadbacks`、`InventoryLedgerEntryReadback`、`getOperationsOrganizationStoreCandidates` 各按具体 token/path 搜索均为 0 条；保留集合反向检查通过 | CP09 的真实 Cursor operation、generated bindings、owner readback 与 foundation exports 仍命中 |

## 8. 真实 proof 摘要

静态、编译与 focused proof：

- `./scripts/verify --validate-only`：PASS，`R5_VERIFY_VALIDATE_ONLY=PASS`，`EXECUTED=15/15`，
  static cleanup=`NOT_APPLICABLE_STATIC_ONLY`；其中 backend module boundary 15/15、Spotless、
  PMD、Java 行长、OpenAPI、catalog-inventory gate 均由该入口真实执行。
- `./gradlew spotlessCheck --no-daemon`：PASS，exit 0；`compileJava` 与 `compileTestJava` 在最终
 受管 run 的 Gradle test task 中 PASS。
- `yarn workspace @catering-v2s/admin-ui-foundation test`：4 个 test file、38 tests PASS；三 app
  typecheck exit 0。
- `node scripts/test/test-health-entry-runner.mjs --self-test`：PASS；20 个 discovered/20 个
  executed，缺失、重复、宽 glob 三个 red control 均 PASS。
- `node scripts/test/test-health-entry-runner.mjs --node`：99 tests PASS、0 fail、0 skipped/todo；
  20 个 scripts test file 全部进入显式分母。
- `node --test scripts/test/catalog-inventory-query-envelope.test.mjs scripts/test/frontend-transport-cache-lifecycle.test.mjs`：19 tests PASS。
- `scripts/check/edge-codegen`：PASS，`FILES=247`；`scripts/check/catalog-inventory-p1`：PASS，
  `SHAPES=7 OPERATIONS=43 API_SCENARIOS=26/99 L2_SCENARIOS=18/41 IA_IDS=89`。
- `node scripts/check/protable-compact.mjs`：PASS，`PROTABLE_INSTANCES=15`、`PROTABLE_FILES=14`。
- operations-admin architecture：26 tests，22 PASS、4 TODO、0 FAIL；platform-admin architecture：
  12 tests，11 PASS、1 TODO、0 FAIL。
- 具体下线搜索：`pageSlice=0`、`slice.set(safeSize - 1, selected)=0`、`ledgerReadbacks=0`、
  `InventoryLedgerEntryReadback=0`、`getOperationsOrganizationStoreCandidates=0`；
  `useCursorStack=17`，其中 foundation 与真实 Cursor surface 的保留引用已逐条核对。

受管动态 proof：见第 5 节的 `r5-tc-1787057770120-44319`；它是当前代码的真实 HTTP/容器业务证据，
但不提升为浏览器 L2、UAT、RTK 请求集或性能基线。

## 9. 形态选择登记

- 选择共享 `OpaqueCollectionCursor` + owner-local keyset SQL，而不是每个 owner 自铸 token：四个
  CP02 operation 需要一致的版本/query identity/frontier 校验，但 SQL、scope 和事实仍属于各自 owner。
- 选择 query identity 负夹具，而不是只断言 cursor 字符串非空：同一 cursor 被换到另一个 parent/query
  时必须失败，才能证明缓存/游标不会跨 query 复用。
- 选择保留 CP09 的已有 Cursor SQL，而不是全仓重写：批准的边界要求保留已真实合规实现，统一 foundation
  只收敛消费行为，不制造新的 owner SQL 风险。
- 选择在受管 runner 首败后先关闭已授权 DEV、读取结构化 manifest 并修复测试/runner 的真实根因，
  再进行一次最终 run，而不是延长等待或盲目重复执行；这符合 `log-first-failure-retry` 的同信号诊断门。
- 选择修正显式 test-health 分母和过期 P3 断言，而不是删测试或改宽门：当前源码已经迁移到
  `currentData` 与 keyset CTE 形态，测试必须跟随 owning source 的真实不变量。

## 10. 交付结论

本批代码已达到静态、编译、focused 与受管真实 HTTP/PostgreSQL acceptance 的实现状态；CP14
证据已由 `r5-tc-1787057770120-44319` 关闭，DEV 也已按授权关闭。但当前 fresh 独立
implementation reviewer 只完成了阶段一，阶段二未形成 verdict，故本文件最终保持
`NO-GO · M=1 · S=0 · N=2`：M-1 是强制独立 review 闸门未闭合，N-1/N-2 是复测与最终 evidence
未被该 reviewer 读取，均不等价于实现失败。不能把作者自审当作独立复核，也不发起第三轮 reviewer。
后续独立 review 能力可用时，应补做同一 cycle 的阶段二；若发现真实失败，先读取结构化日志定位
first failure/broken boundary，再按根因修复并重新取证。

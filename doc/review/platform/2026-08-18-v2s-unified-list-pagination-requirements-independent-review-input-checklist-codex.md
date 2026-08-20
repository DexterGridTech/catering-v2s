# 统一列表分页需求分析：独立对抗 Review 输入清单

REVIEW_CYCLE_ID：`2026-08-18-unified-pagination-requirements`
REVIEW_TARGET：`REQUIREMENTS_ANALYSIS`
REVIEW_ROUND：`1`
REVIEW_ROUND_LIMIT：`2`
reviewerKind：`INDEPENDENT_SUBAGENT`
被审对象：`doc/plans/platform/2026-08-18-v2s-unified-list-pagination-requirements-analysis-codex.md`

## 1. 盲审硬约束

本清单是 reviewer 的输入索引，不是被审报告的结论。reviewer 必须：

1. 不派生任何子 agent；
2. Phase 1 先独立读取本清单第 2 至第 6 节的冻结输入、memory、决策与 owning source，独立推导分页标准、集合模式、问题分母和反例；Phase 1 输出自己的初步 verdict 后，才能读取第 7 节的作者报告；
3. Phase 2 读取作者报告后，逐条攻击它的每个数字、成员清单、严重度、边界与 foundation 方向；不能以作者报告或本清单中的事实摘要替代源码复核；
4. 这是一轮需求分析 review，不运行 DEV、reset、seed、浏览器 L2、UAT 或 Testcontainers；
5. 返回 `GO`/`NO-GO`、`M/S/N`，并为每条 finding 标明 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`；
6. 如果确实没有问题，必须直接写“没有问题”，不要为了产生 finding 而扩大范围；
7. 每个声称的数字必须由 reviewer 独立复测并给出命令/输出或明确标记为未复现；不能把静态数字写成动态行为证据。

## 2. 必须读取的仓库入口

以下文件已在作者侧从当前工作树读取；reviewer 必须重新读取，不能只接受摘要。哈希用于识别漂移：

| 路径 | SHA-256 |
|---|---|
| `AGENTS.md` | `9a4e299ca8d824c3f85f7766437b5ba201cfb2e54c1fd7d981e11d3421ad1576` |
| `CLAUDE.md` | `bbdfe0702aad1f9f746481b3067bdaa2ee3763e909e86486e70c194a7c03c42b` |
| `PLATFORM-BLUEPRINT.md` | `e9956c2ee23f905bcdf70b8ad0874abfdd6a497b3fc9d01ea9ad7ca896c13b74` |
| `doc/platform/README.md` | `d358e49c83726528690a9d05aa9f6a1979a0f9d2051fd56ef9db4ff98b573c7f` |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` |
| `project-memory/index.md` | `1c1aeaa95b185df61d6de589e947788f049af3877b469e3ec25022cc58911fe3` |
| `scripts/README.md` | `2e82318aa0b2593228f040141bf7e217ceddfae58d9ace38b7d311f284785986` |

必须重开当前 registry 选择的 Roadmap：
`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`，只读取其 `CURRENT_*` 及与本只读 review 直接相关的边界。

作者侧 `scripts/context/agent-context health` 实际结果为：

```text
STATUS=PASS
CONTEXT_MODE=DETERMINISTIC_ONLY
ENTRY=AGENTS.md
ENTRY=PLATFORM-BLUEPRINT.md
ENTRY=doc/platform/roadmap-program-registry.json
ENTRY=project-memory/index.md
ENTRY=scripts/README.md
```

## 3. Memory 路由与必须回读的原文

reviewer 必须按项目路由执行（合法 task kind 为 `review`，不要使用 `analysis`）：

```text
scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner frontend-platform --impact architecture --trigger review
scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner backend --impact architecture --trigger review
```

两个路由的 kernel 与 sourceRefs 联合集合必须逐文件回读，至少包括：

```text
project-memory/kernel/01-workspace-and-roadmap.md
project-memory/kernel/02-service-shape-and-owner.md
project-memory/kernel/03-transaction-data-and-dependencies.md
project-memory/kernel/04-contract-consumer-and-admin.md
project-memory/kernel/05-evidence-runtime-and-git.md
project-memory/kernel/06-heritage-and-change.md
project-memory/decisions/confirmed-business-language-corpus.md
project-memory/decisions/deterministic-context-only.md
project-memory/decisions/distributed-topology-is-not-current.md
project-memory/decisions/http-crud-efficiency-design-redlines.md
project-memory/decisions/independent-subagent-adversarial-review.md
project-memory/operations/business-corpus-adoption-and-read-policy.md
project-memory/operations/business-corpus-parked-domain-intake.md
project-memory/operations/implementation-source-reread-discipline.md
project-memory/pitfalls/owner-boundary-reverse-inference.md
project-memory/practices/cache-invalidation-granularity.md
project-memory/practices/failure-condition-names-the-wrong-shape.md
project-memory/practices/ordering-only-for-consumer-facing.md
project-memory/practices/preflight-execute-failure-parity.md
project-memory/practices/read-model-granularity.md
project-memory/practices/reuse-projection-within-request.md
project-memory/practices/set-interaction-not-n-times-single.md
```

reviewer 必须特别验证这些原文是否真的支持作者的方向：

- G-05B 的 Name/Code 分列与 relation candidate 约束；
- `read-model-granularity` 的字段闭包、task-read 与 detail 边界；
- `set-interaction-not-n-times-single` 对全 scope 读取后在内存筛单 target 的反例；
- `ordering-only-for-consumer-facing` 对管理元数据不引入 display order 的边界；
- `reuse-projection-within-request` 对同一 request 内共享完整投影的范围；
- `owner-boundary-reverse-inference` 对 owner 与 UI 任务不互相反推的边界。

## 4. 适用产品/规范决策

必须重开：

```text
doc/decisions/2026-08-17-v2s-catalog-metadata-central-modal.md
doc/decisions/2026-08-05-v2s-dual-admin-protable-compact-standard.md
doc/decisions/2026-08-05-v2s-dual-admin-name-code-density-standard.md
```

需要确认：商品元数据中央弹窗固定四个顶层实体、各实体 CRUD、UI 不承载排序语义；ProTable 是当前管理表格标准但不代表所有集合都是 Page list；审计 change set、树、固定闭集与候选下拉不应被机械套用管理表格分页。

业务 corpus 中没有作者侧发现的专门“统一列表分页”条目；应明确写出 `NO_CORPUS_ENTRY_MATCHED`，并使用实际命中的 G-05B/G-11/G-12 及上述 memory 作为相关约束，不能臆造业务分页规则。

## 5. Owning source 与独立复测清单

### 5.1 前端

至少逐文件打开并核对：

```text
apps/frontend/platform-admin/src/features/workspace-iam/ui/PlatformInvitationPanel.tsx
apps/frontend/platform-admin/src/features/workspace-iam/ui/AccountsPage.tsx
apps/frontend/platform-admin/src/features/platform-administration/ui/AdministratorsPage.tsx
apps/frontend/platform-admin/src/features/workspace-iam/ui/RolesPage.tsx
apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx
apps/frontend/platform-admin/src/features/audit-history/ui/PlatformAuditHistoryModal.tsx
apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx
apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx
apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx
apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx
apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx
apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryDetailDrawer.tsx
apps/frontend/operations-admin/src/features/audit-history/ui/OperationsAuditHistoryModal.tsx
apps/frontend/operations-admin/src/features/workspace-user/ui/WorkspaceInvitationPanel.tsx
apps/frontend/operations-admin/src/features/workspace-user/ui/WorkspaceUserPage.tsx
apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx
apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx
apps/frontend/operations-admin/src/features/store-profile/ui/StoreProfilePage.tsx
```

必须独立复测并报告：`ProTable` 物理实例、`Table` 物理实例、独立 `Pagination`、两个 app 计数；`PlatformReadPage` 多 tab、`BusinessEntityManagementPage` 多 entity、`CatalogDictionaryDrawer` master-detail 多实体的展开口径；每个分页配置的 `showSizeChanger`、`showTotal`、`hideOnSinglePage`、`current/pageSize/total` 来源；错误样板与正确样板是否真由源码支持。

### 5.2 Contract

必须读取公开 OpenAPI path shards 与 generated/registry binding，核对作者的 63→45 候选过滤不是人工凑数。重点成员：

```text
getOperationsCatalogDictionary
getOperationsProductionTags
getOperationsLocalCatalogCopyCandidates
getOperationsBrandCatalogCopyCandidates
getOperationsCatalogItems
getOperationsInventoryTargets
getOperationsInventoryTargetBusinessHistory
getOperationsInventoryTargetConsumptionReferences
getOperationsInventoryTargetLedger
getOperationsOrganizationStoreCandidates
getExtensionEntityCatalog
```

另需抽查作者列出的 Page list 25 个、Page candidate 9 个、Cursor 9 个；遇到数组响应但属于 detail/tree/manifest/fixed-set/单次聚合的成员，必须给出排除理由和成员名，不得只给排除数量。

### 5.3 Backend owner

必须逐符号核对：

```text
apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java
  dictionary / loadDictionaryListing / copyCandidates
apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java
  read / readTags
apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreCandidateTaskReadService.java
  candidatePage / pageSlice / platformContractCandidatePage
apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java
  candidates / pageSlice / page
```

重点反例：contract 有 cursor/pageSize 但 owner 不读；固定 `LIMIT 100` 仍返回空 cursor 和当前页长度 total；全量读取后 Java `filter/sort/subList`；SQL 分页是否存在稳定唯一 tie-breaker；scope/权限谓词是否在 count 与 page 中相同。

### 5.4 只读复测命令与边界

至少执行并贴出退出码/关键输出：

```bash
rg -l '<ProTable\\b' apps/frontend/platform-admin apps/frontend/operations-admin --glob '*.tsx'
rg -l '<Table\\b' apps/frontend/platform-admin apps/frontend/operations-admin --glob '*.tsx'
rg -l '<Pagination\\b' apps/frontend/platform-admin apps/frontend/operations-admin --glob '*.tsx'
```

对 contract 分母应使用 JSON 解析而不是 grep 行数；对每个候选操作输出 operationId、response 数组路径、请求分页参数、consumer face、owner 与排除/纳入理由。不能把历史 seed、DEV、L2 或 Testcontainers 证据带入本轮。

## 6. 作者侧已复测的事实（仅作为攻击靶，不是 reviewer 结论）

作者报告当前 SHA-256：
`1a3cbb09bf1c0347cbe530f35ebcd32d1f50e18c4fc60e1f5b2e055ab095f2c3`

作者侧报告的待攻击数字：

- 前端：`ProTable=15`、`Table=14`、独立 `Pagination=2`、platform-admin 表格 surface=12、operations-admin 表格 surface=18；
- contract：数组候选=63、排除=18、主分母=45，Page=25、Page candidate=9、Cursor=9、边界=2；
- 前端问题业务分母：12 个标准 Page 缺页大小选择、2 个 audit pager、5 个手工 cursor table、5 个商品元数据 table，共 24；
- M-1 伪 cursor=4；M-2 内存分页 owner family=2；
- M-1 的 owning source 形态：Catalog 字典/复制候选与 Production tag 的 cursor/pageSize 被忽略或固定 `LIMIT 100`；
- M-2 的 owning source 形态：Store candidate 与 Workspace IAM candidate 在 Java `filter/sort/pageSlice` 后返回 page。

reviewer 必须逐项复测；如果数字不能复现，记录真实数字、计算口径和影响，不要为了迎合作者报告凑数。

## 7. 环境陷阱与证据等级

- 本机没有 `timeout` 命令；不要用它包装命令。
- `scripts/check/` 下脚本按 shebang 选择解释器，红绿由退出码判定。
- 本轮不运行动态环境；静态 source/JSON 解析不能写成 HTTP、浏览器、容器或 UAT PASS。
- `contracts/policy/standards-coverage-matrix.json` 已缺失且相关 compliance-control 已退役；不能把它当本轮阻断，也不能恢复该控制面。
- 不运行 `backend-formatting-bytecode.mjs`，它会触发 Gradle 并写 `.runtime/`。
- 不做任何生产代码、contract、generated artifact、migration、DEV、reset、seed、L2、UAT 修改或运行。

## 8. Phase 2 攻击问题

读取作者报告后，至少回答：

1. “完整分页样板”是否把 AntD 默认行为误当产品保证？ProTable 与 raw `Pagination` 是否需要不同判据？
2. 45/24/29 的分母能否从成员清单复算；`surface` 与物理组件、operation 与 response array 是否混用？
3. 四个伪 cursor 是否确实同一缺陷，还是有些是 bounded collection/合法一次性读取？固定 `LIMIT 100` 是否有真实上界证据？
4. 两类 Java 内存分页是否全部是本需求应处理的 page candidate，还是某些是故意的 bounded/授权闭包；是否遗漏同族问题？
5. 审计 Modal、商品元数据五列表、两个无分页 operation 的业务边界是否需要 Dexter 裁决；报告是否越权替 Dexter 定产品语义？
6. Page/Cursor/Bounded/Tree 四模式是否足够，是否应保留独立 candidate 模式；foundation 是否重复造轮子、万能 repository 或强迫所有数组分页？
7. 需求分析是否已经偷偷写入详设/实施计划；是否缺少失败判据、可证伪反例、数据库/契约/前端三方分母或迁移成本？
8. 若确实没有高风险问题，直接说明没有问题；不要把“需要详设验证”自动升级成 finding。

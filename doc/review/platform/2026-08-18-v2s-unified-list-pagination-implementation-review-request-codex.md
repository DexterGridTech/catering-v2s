# Claude 评审交付：统一列表分页 CP-00 至 CP-16

## 背景

本轮已按统一列表分页 implementation-facing 详设完成 CP-00 至 CP-16 的一批实施，并完成当前
源码上的静态门、编译、focused test 与受管真实 HTTP/PostgreSQL backend-acceptance。所有 DEV
环境已按 Dexter 授权关闭。本交付的作者自审暂记为 `NO-GO · M=1 · S=0 · N=2`，M-1 是 fresh
独立 implementation review 的阶段二没有形成 verdict，不是已证明的业务代码失败；现请 Claude 对
当前树做事后独立 implementation review。

## 评审目标

请独立确认：

1. CP-00 至 CP-16 是否真实满足四种集合边界 Detail、Bounded、Page、Cursor；
2. 四个伪 Cursor、两个内存分页族、selected 顶替补丁、五个手工分页 surface 是否已根因修复并
   完成旧代码下线；
3. contract/OpenAPI/generated Java/generated TypeScript/edge/RTK/owner/consumer/test 是否同步；
4. B01 固定闭集、B03-B07 整体保存/整体读取聚合、CP-09 保留 Cursor 是否没有被统一分页误伤；
5. acceptance evidence 是否确实来自当前代码，且没有把模块 Gradle test、`response.ok`、DEV、
   acceptance HTTP 事件或 DB_OPERATIONS 冒充 BUSINESS、浏览器 L2、UAT 或性能证据；
6. 六项下线的删除侧与保留侧 proof 是否双向成立，test-health 显式分母与 P3 断言是否守住真实
   不变量。

## 需阅读文件

请从 catering-v2s 仓库根打开：

- `doc/plans/platform/2026-08-18-v2s-unified-list-pagination-requirements-analysis-codex.md`：需求、
  业务目标、分母与边界；
- `doc/plans/platform/2026-08-18-v2s-unified-list-pagination-implementation-design-codex.md`：
  CP-00 至 CP-16 详设、RECALL、失败条件、测试闭集、旧代码下线与实施计划；
- `doc/review/platform/2026-08-18-v2s-unified-list-pagination-implementation-review-codex.md`：
  作者逐 CP 对账、自审、证据档位与当前独立 review 闸门状态；
- `doc/evidence/platform/2026-08-18-v2s-unified-list-pagination-root-array-scan-codex.json`：
  含根 OpenAPI 文件解引用后的 83 GET/72 root-array 取证成员清单；
- `doc/evidence/platform/2026-08-18-v2s-unified-list-pagination-acceptance-design-codex.json`：
  acceptance identity、fixture、request、businessOracle 与契约同步记录；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787057770120-44319/run-manifest.json`：
  当前受管 run 的 source sync、test execution、cleanup 与时序；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787057770120-44319/backend-acceptance-result.jsonl`：
  44 条当前 backend-acceptance 的 CONTRACT/BUSINESS/businessMode 结果；
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787057770120-44319/http-request-events.jsonl`：
  acceptance 发出的 HTTP 观测，仅用于 route/operation 对账，不是浏览器 L2 证据；
- `project-memory/practices/collection-boundary-modes.md`：四种集合形态的正本判据与测试反例；
- `project-memory/operations/test-closed-loop.md`：静态/动态证据档位、backend-acceptance 与显式测试分母；
- `project-memory/pitfalls/log-first-failure-retry.md`：首败日志、重复失败诊断与受管资源边界；
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`：Catalog Page/Cursor owner SQL；
- `apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java`：生产标签真实 Cursor；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreCandidateTaskReadService.java`：组织候选 DB Page；
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java`：Workspace user/candidate DB Page；
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`：Inventory readback 与 reference predicate；
- `libraries/frontend/admin-ui-foundation/src/list/usePageQuery.ts`、`libraries/frontend/admin-ui-foundation/src/list/useCursorCandidates.ts`、`libraries/frontend/admin-ui-foundation/src/list/useCursorStack.ts`、`libraries/frontend/admin-ui-foundation/src/list/cursorPagination.tsx`：统一前端 Page/Cursor foundation；
- `scripts/test/test-health-entry-runner.mjs`、`scripts/test/catalog-inventory-query-envelope.test.mjs`、`scripts/test/catalog-p3-model-migration.test.mjs`：当前测试闭环、契约形状与迁移断言；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java` 及其同目录 `*AcceptanceScenarios.java`：受管场景入口、fixture、request、businessOracle。

## 独立核验重点

请重新搜索并给出条数，不采信作者数字快照：

- 83 unique GET、72 root-array candidates、50 semantic、45 主集合、43 分页成员，其中 Page 25、
  Page candidate 9、Cursor 9；B01/B02+B03-B07；B01 fixed host type 8；前端 ProTable 15、Table 14、
  独立 Pagination 2；
- `pageSlice`、`slice.set(safeSize - 1, selected)`、`ledgerReadbacks`、
  `InventoryLedgerEntryReadback`、`getOperationsOrganizationStoreCandidates` 等具体下线 token 的删除侧
 计数，以及真实 foundation/CP-09 保留侧计数；
- 四个 fake Cursor 的 request 消费、query identity、keyset frontier、total、scope/filter/sort；
- acceptance manifest 的 `runId=r5-tc-1787057770120-44319`、`startedAt=2026-08-18T12:56:10.120Z`、
  `discovered=44`、`selected=44`、44/44 CONTRACT、44/44 BUSINESS、`businessMode=REAL`、cleanup PASS，
  并确认该 run 晚于 executable apps/contracts/libraries/scripts 修改；
- DEV 保持关闭；不把 acceptance 的 HTTP 事件当成浏览器 L2/RTK 请求集，不把 DB_OPERATIONS 当性能
  基线；本批不要求 L2/UAT。

若发现失败，必须区分 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、
UNVERIFIED_REQUIRES_EVIDENCE、DEXTER_DECISION，并给出精确仓根相对路径/行号、影响、最小根因修复
建议与是否需要 Dexter 产品/范围裁决。如果确实没有问题，请直接写明“没问题”。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并用 `M/S/N` 表示 finding 严重度。请明确区分：

- 编译、静态门、focused test、受管容器 HTTP、浏览器 L2、UAT 的证据档位；
- 当前 implementation 是否完成，与是否授权 DEV、reset、seed、L2、UAT、下一 Roadmap step。

授权边界：本次只授权 Claude 评审 CP-00 至 CP-16、S-1 根级取证修正、N-1 记忆沉淀及其当前证据。
不授权任何生产代码、契约、生成物、迁移、数据模型、DEV 启动/重启、reset、seed、浏览器 L2、UAT、
下一 Roadmap step 或范围扩展。任何产品/Journey、范围批次、破坏性动作争议请单独标为
`DEXTER_DECISION`，不要自行代裁。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对“统一列表分页 CP-00 至 CP-16”做一次事后独立 implementation review。

背景：本批已完成 CP-00 至 CP-16，并取得当前代码树上的静态、编译、focused 与受管真实 HTTP/PostgreSQL backend-acceptance 证据；所有 DEV 环境已按 Dexter 授权关闭。作者自审当前记录为 NO-GO · M=1 · S=0 · N=2，但 M-1 只表示 fresh 独立 reviewer 的阶段二没有形成 verdict，不表示实现已被证明失败。请不要把作者自审当作结论。

目标：独立核验四种集合形态、四个 fake Cursor、两个内存分页族、旧代码双向下线、CP-09 保留 Cursor、B01/B03-B07 聚合边界、contract/generated/edge/consumer 闭环、test-health 分母，以及当前 backend-acceptance 的 CONTRACT/BUSINESS/cleanup 证据档位。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-08-18-v2s-unified-list-pagination-requirements-analysis-codex.md：需求与分母；
- doc/plans/platform/2026-08-18-v2s-unified-list-pagination-implementation-design-codex.md：详设、测试、下线与实施计划；
- doc/review/platform/2026-08-18-v2s-unified-list-pagination-implementation-review-codex.md：作者对账与证据；
- .runtime/r5/evidence/remote-testcontainers/r5-tc-1787057770120-44319/run-manifest.json 与 backend-acceptance-result.jsonl：当前受管 run；
- project-memory/practices/collection-boundary-modes.md、project-memory/operations/test-closed-loop.md、project-memory/pitfalls/log-first-failure-retry.md：形态与证据边界；
- 当前 Catalog、Production、Organization、Workspace IAM、Inventory owner、foundation、acceptance scenario 与测试文件：核对实现与反例。

请独立复测所有数字与“零/唯一/全仓/只有”断言；重点确认 83/72/50/45/43、25/9/9、B01/B02+B03-B07、8、ProTable15/Table14/Pagination2，以及 run 的 44/44 CONTRACT、44/44 BUSINESS、REAL、cleanup PASS 和时序。不要将 acceptance HTTP 事件称浏览器 L2/RTK，不要将模块 Gradle test 或 DB_OPERATIONS 称 BUSINESS/性能证据。

请按 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE、DEXTER_DECISION 标记每条 finding，并给出明确 GO/NO-GO · M/S/N；如果确实没问题请直说“没问题”。

授权边界：只评审 CP-00 至 CP-16、S-1/N-1 与当前证据；不授权生产代码、契约、生成物、迁移、数据模型、DEV 启动/重启、reset、seed、浏览器 L2、UAT、下一 Roadmap step 或范围扩展。谢谢。
```

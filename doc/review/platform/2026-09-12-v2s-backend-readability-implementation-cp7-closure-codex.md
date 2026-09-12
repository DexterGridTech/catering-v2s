# Backend owner 可读性整改 · CP-7 整批收口记录

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
REVIEW_TARGET=IMPLEMENTATION
CP=CP-7
IMPLEMENTATION_STATUS=CLOSED_WITH_RESET_DEV_SEED
BUSINESS_MODE=REAL
RESET_DEV_SEED=PASS
```

## 1. 范围与证据边界

本记录只覆盖已授权的 backend owner facade 职责拆分：Catalog、Inventory、BusinessEntity、BusinessChannel、SalesMenu。
不扩大到前端、契约/generated、migration、seed、全量 SQL 归位、测试文件切分、部署或切流。Git 控制仍由 Dexter 负责；工作区中与
本批无关的 terminal POC 及其他文档变更未处理。

实施的四张矩阵与逐 CP 记录分别位于：

- `doc/review/platform/2026-09-11-v2s-backend-readability-implementation-cp0-matrices-codex.md`
- `doc/review/platform/2026-09-12-v2s-backend-readability-implementation-cp2-catalog-behavior-codex.md`
- `doc/review/platform/2026-09-12-v2s-backend-readability-implementation-cp3-inventory-behavior-codex.md`
- `doc/review/platform/2026-09-12-v2s-backend-readability-implementation-cp4-business-entity-behavior-codex.md`
- `doc/review/platform/2026-09-12-v2s-backend-readability-implementation-cp5-business-channel-behavior-codex.md`
- `doc/review/platform/2026-09-12-v2s-backend-readability-implementation-cp6-sales-menu-behavior-codex.md`

各 CP 的步骤级 fresh independent review 均记录为 `STEP_REVIEW=MATCHED`、`M/S/N=0/0/0`。本记录不把这些步骤审查替代为整批
implementation review；整批 review 仍在单独进行。

整批 fresh independent implementation review 已按两轮上限闭合。reviewer 为 Carver，只读、未运行动态命令：

```text
REVIEW_CYCLE_ID=BACKEND_READABILITY_IMPLEMENTATION_2026-09-12
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
mode=read-only
ROUND_FINAL_DECISION=OPEN
M/S/N=0/0/0

REVIEW_ROUND=2
ROUND_FINAL_DECISION=SELF_DECIDED
M/S/N=0/0/0
```

终轮没有 confirmed/partially confirmed finding；重点复核了 HeadCompany 授权校验与 owner fact 去重、五个 facade/API/FQCN/Spring
边界、事务/receipt/CAS/lock/readback，以及最终 acceptance 的全量与 cleanup 分层。它确认任何动态结论都来自既有 manifest/result，
没有把静态或 `DB_OPERATIONS` 冒充业务证据。终轮仍不覆盖范围外 frontend/terminal 改动；本批的最新 acceptance、reset、DEV 与 seed 产物另行
按各自 business/cleanup 层级记录。

## 2. 本批 owning source

五个 facade 保留原有 owner API/接口边界，业务实现已按能力和聚合移至同 package target service：

- Catalog：`CatalogOwnerService`、`CatalogOwnerValueSupport`、`CatalogWorkbenchReadService`、`CatalogAttributeDefinitionService`、
  `CatalogUnitDefinitionService`、`CatalogOrderOptionDefinitionService`、`CatalogCategoryService`、
  `CatalogDictionaryService`、`CatalogItemService`、`CatalogCopyService`、`CatalogCommandRouter`。
- Inventory：`InventoryOwnerService`、`InventoryAvailabilityService`、`InventoryTargetService`、
  `InventoryCatalogLifecycleService`、`InventoryBomService`、`InventoryCopyService`、`InventoryReadRouter`、
  `InventoryCommandRouter`。
- BusinessEntity：`BusinessEntityService`、`BusinessEntityValueSupport`、`BusinessEntityTaskReadService`、
  `BusinessBrandService`、`BusinessTenantService`、`HeadCompanyService`、`StoreService`、
  `BusinessEntityCommandRouter`。
- BusinessChannel：`BusinessChannelOwnerService`、`BusinessChannelQuerySupport`、`BusinessChannelService`、
  `BusinessChannelTaskReadService`、`BusinessChannelTemplateService`。
- SalesMenu：`SalesMenuOwnerService`、`SalesMenuDefinitionService`、`SalesMenuSectionService`、
  `SalesMenuItemService`、`SalesMenuPublicationService`、`SalesMenuManualSaleService`、
  `SalesMenuOperationRecordService`、`SalesMenuReadModels`。

测试只保留既有文件拓扑；本批仅调整 Catalog 两个既有 integration test 与 SalesMenu ordering test 的必要构造/反射适配，未切分
`*AcceptanceScenarios.java` 或建立测试基类。

## 3. 最后一次修复与局部证明

全量 acceptance 首次触发 `createOperationsOrganizationBrand` 超预算后，移除了 group existence 的重复读取；第二次触发
`updateOperationsOrganizationBrand` 超预算后，复用已读取的 extension values；第三次触发
`updateOperationsOrganizationHeadCompany` 实际 22、预算 21 后，定位为 `HeadCompanyService.requireHeadCompanyOwnerFact` 调用
`requireOwnerGrant` 后又读取同一 head-company owner fact。`requireOwnerGrant` 现只执行 grant 匹配，授权关系操作仍通过其原有无 scope
命令路径读取并校验实体存在；update/status 的 owner fact 仍由 `requireHeadCompanyOwnerFact` 单次读取并传入 `updateNow`/`transitionNow`。

最后修复的 focused proof：

- 本地 `:apps:backend:catering-business-server:modules:organization:compileJava`：PASS；
- 受管远端 run `r5-tc-1789177573485-87683`，organization focused selectors：Gradle PASS、remote status=0、Testcontainers
  containers/volumes cleanup PASS、`BUSINESS=NOT_APPLICABLE`（技术 focused run，不冒充 HTTP acceptance）。

## 4. 最后一次全量 backend acceptance

命令：

```bash
scripts/test/backend-acceptance --operation all
```

受管 run：`r5-tc-1789181716572-70679`。

manifest：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789181716572-70679/run-manifest.json`。

该 run 的 manifest 起始时间为 `2026-09-12T02:55:16.582Z`（即 `2026-09-12T11:55:16.582+09:00`），完成时间为
`2026-09-12T03:00:10.892Z`。按 `git diff HEAD --name-only`（包含 staged/unstaged）与
`git ls-files --others --exclude-standard` 合并去重后，逐文件读取当前工作区 backend Java 变更全集，共 46 个文件；其中最大
mtime 是 `2026-09-12T02:55:05.203Z`（即 `2026-09-12T11:55:05.203+09:00`，
`CatalogOwnerValueSupport.java`），最大 birthtime 是 `2026-09-12T00:41:14.496Z`
（`SalesMenuOwnerService.java`）。两者均早于 acceptance 起始时间，按 epoch 比较没有晚于 run 的 `.java`；因此当前字节对这次
acceptance 的时序约束是 `CONFIRMED`。此前把 UTC 值直接标成 `+0900` 的写法已更正。source sync=PASS，`verificationMode=ACCEPTANCE`，远端
Gradle=PASS，status=PASS，firstFailure=null。

### 4.1 业务分层

`backend-acceptance-result.jsonl.gz` 共 132 行：1 条 discovery 记录和 131 条场景记录；discovery 为 `discovered=131`、
`selected=131`；随后 131 条场景记录逐条均为：

- `CONTRACT=PASS`；
- `BUSINESS=PASS`；
- `businessMode=REAL`；
- `businessAssertion=HAND_WRITTEN_BUSINESS_ORACLE`；
- `status=PASS`。

脚本输出的 summary 为 `HTTP_SUCCESS=131`、`REAL_BUSINESS_ASSERTIONS=131`、`STUB_ONLY=0`、`DIRECT_FAILURES=0`。本批业务涉及的
Catalog、Inventory、Organization、BusinessChannel、SalesMenu、Collaboration、Contract、IAM、Asset、Pagination 场景均在同一
全量 run 中执行；`DB_OPERATIONS` 仅作为信息性诊断，不作为业务 oracle。

### 4.2 独立 budget 与 measurement

manifest 的 `measurementEvidence.status=PASS`，`verificationMode=ACCEPTANCE`；`operationSet.expected=269`、`observed=269`，
`missing=[]`、`extra=[]`、`drift=[]`；budget evidence `declared=269`、`observed=269`、`exceeded=0`。另有
`unclassifiedSqlOperations=0`、`unclassifiedSqlRatio=0`。这些是独立 run-level evidence，不替代 131 条业务 oracle。

### 4.3 cleanup

同一受管 run 的 cleanup 为 PASS：`remoteProcess=PASS`、`remoteWorkspace=PASS`、`testcontainersContainers=PASS`、
`testcontainersVolumes=PASS`。`devLifecycle.wasRunning=false`，未停止或重启 DEV；本次未启动本地 Spring、未建立 PostgreSQL tunnel。

## 5. 静态门分层

本批相关的静态检查：

- organization compile、backend boundary、logging boundary、database boundary、sales-menu contract/schema、backend diff check：PASS；
- `scripts/env/check-runtime-resource-budget .runtime/r5`：PASS，`LIVE_MANAGED_PROCESSES=0`、`MANAGED_RSS_MB=0`；
- `scripts/verify`：R4 logging/database/backend 与 R5 frontend architecture PASS，但整体被既有
  `apps/frontend/operations-admin/src/tests/architecture/business-channel-scope.test.mjs` 的 frontend-format warning 拒绝；该文件当前
  clean、最后修改早于本批，属于范围外 pre-existing gate，不升级为本批 PASS，也未修改；
- `scripts/check/code-layout`：被范围外既有空目录
  `apps/terminal/assembly/android/sample-terminal/android/.kotlin/sessions` 拒绝，未删除该用户目录，不升级为本批缺陷。

## 6. 已知首败及处置

三次全量 run 的首败均是 budget verifier 发现的真实重复读取，而不是用预算门掩盖业务失败：

1. `r5-tc-1789175477899-41709`：create brand 多 1 次 `requireCommercialGroupId`；按事件对账移除错误重复读；
2. `r5-tc-1789176469573-67621`：update brand 多 1 次 extension values 查询；按旧实现复用 `before.extensionValues()`；
3. `r5-tc-1789177043119-78145`：update head company 多 1 次相同 owner-read；按事件与当前 helper 调用链对账修复。

每次均保留原 run manifest/事件；修复后先做局部 compile/focused proof，未调高预算、未以重试替代根因修复。

## 7. 受管 reset

reset 前没有当前 DEV manifest：`DEV_MANIFEST=ABSENT`。已先执行 dry-run，确认目标数据库为
`catering_v2s_dev_r5_full`、管理方式为远端 SSH、后续入口为 `scripts/dev/start`。

- run：`r5-reset-46c63843-c760-4008-81ea-f8f2e83bfb7f`；
- manifest：`.runtime/r5/reset/r5-reset-46c63843-c760-4008-81ea-f8f2e83bfb7f/run-manifest.json`；
- business：`PASS_DATABASE_ABSENT_READBACK`；
- cleanup：`PASS_NO_PERSISTENT_RESET_PROCESS`；
- 读回事件确认无活动受管 DEV，目标数据库在 reset 前不存在；未使用本机 PostgreSQL、Docker 或数据库 tunnel。

## 8. 受管 DEV

已通过 `scripts/dev/start` 启动当前字节对应的 DEV：

- run：`r5-dev-1789182054235-72732-65d02d5d-653b-466a-8caf-2728863c4365`；
- manifest：`.runtime/r5/run-manifest.json`；
- topology：`java=REMOTE_TRUSTED_HOST`、`database=REMOTE_LOCALHOST`、`tunnel=HTTP_AND_ASSET_ONLY`；
- 远端 Java readiness 为 `REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY`，manifest 记录 host、remoteRoot、PID、bootId、startTicks 与 ready marker；
- 本机仅有 `platform-admin`、`operations-admin` Vite，受管 SSH tunnel 仅转发 `28080→远端 8080` 与 `29000→远端 19000`；
- `scripts/dev/check`：`R5_DEV_ENVIRONMENT=PASS`，数据库为 `catering_v2s_dev_r5_full`，asset prefix 为受管 DEV prefix。

DEV 按用户要求保持运行，供体验使用。启动前的受管资源预检为 `LIVE_MANAGED_PROCESSES=0`、
`MANAGED_RSS_MB=0`、`STATUS=PASS`。当前 manifest 仍拥有远端 Java、HTTP/asset tunnel 与两个本机 Vite 的受管进程；
不得据此按端口或命令名停止它们。

## 9. 受管 seed

已执行：

```bash
R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED scripts/dev/seed --profile r5-full
```

父报告：
`.runtime/r5/seed/complete/complete-seed-9e541054-082c-4daf-8940-bb293abe0ed5/seed-report.json`。

- parent run：`complete-seed-9e541054-082c-4daf-8940-bb293abe0ed5`；
- managed DEV：`r5-dev-1789182054235-72732-65d02d5d-653b-466a-8caf-2728863c4365`；
- overall business：`PASS`；
- overall cleanup：`PASS_PRESERVED_DEV_STATE`；
- first failure：`null`；
- seed 从始至终未直接写数据库，所有写入均经 owner HTTP command。

子阶段真实 readback 与 cleanup：

| 子阶段 | business / cleanup | readback 与完整性 |
| --- | --- | --- |
  | owner-command | `PASS` / `PASS_NO_PERSISTENT_SEED_PROCESS` | 205 API calls、42 endpoint groups、reportedApiCallCount=205、unmatched HTTP/DB events 0；bootstrap 与 expired-invitation 两个非 API stage 均 PASS |
  | external-collaboration-business-channel | `PASS` / `PASS_PRESERVED_DEV_STATE` | 87 API calls、19 endpoint groups、unmatched HTTP/DB events 0；`channelCount=9`、`templateCount=10` |
  | catalog-inventory | `PASS` / `PASS_PRESERVED_DEV_STATE` | 1,338 API calls、34 endpoint groups、unmatched HTTP/DB events 0、`noDirectDatabaseWrites=true`（即未发生） |
  | sales-menu | `PASS` / `PASS_PRESERVED_DEV_STATE` | 249 API calls、27 endpoint groups、unmatched HTTP/DB events 0、`noDirectDatabaseWrites=true`（即未发生）；catalog availability item count 6，并引用 catalog child receipt |

子报告路径分别为：

- `.runtime/r5/seed/r5-dev-1789182054235-72732-65d02d5d-653b-466a-8caf-2728863c4365/seed-report.json`；
- `.runtime/r5/seed/external-collaboration-business-channel/external-business-channel-seed-862ebfdb-6dfc-44a6-a632-319913acf7ab/seed-report.json`；
- `.runtime/r5/catalog-inventory/seed/catalog-seed-37d504e0-f0f4-4263-a6fe-34ea0c8912d7/seed-report.json`；
- `.runtime/r5/seed/sales-menu/sales-menu-seed-b55938da-12c7-4195-95ec-cd1a3878304a/seed-report.json`。

## 10. 最终状态与边界

整批 fresh independent implementation review 已按两轮上限终轮 `GO`，Carver 的 `M/S/N=0/0/0`；Claude 本轮 finding 已在下一节
按当前字节与新产物处置，未遗留已确认的实施缺陷。
最终 backend acceptance、reset、DEV、seed 均已取得各自受管产物；业务与 cleanup 分开判定，未把静态检查或
`DB_OPERATIONS` 冒充业务 oracle。

UAT、部署、切流不在本轮授权范围内，也未执行。当前 DEV 是用户明确要求保留的体验环境，其 cleanup 状态由 seed
报告记录为 `PASS_PRESERVED_DEV_STATE`；后续如需关闭，必须继续使用 manifest 绑定的 `scripts/dev/stop`，不得按端口、
命令名或猜测 PID 处理。

## 11. Claude 实施后 review finding intake

本节按当前源码、当前受管产物和修订后的 CP-0 矩阵重新判读 Claude 的 finding；review 报告只作为待验证输入，
不直接升级为事实。

| finding | 判定 | 事实与处置 |
| --- | --- | --- |
| M-01 acceptance 早于交付字节 | `REJECTED_WITH_EVIDENCE` | 对 `git diff HEAD --name-only` 与 `git ls-files --others --exclude-standard` 合并去重后的 backend Java 逐文件读取，共 46 个 `.java`；最新 acceptance 起始 `2026-09-12T02:55:16.582Z`，最大 mtime 为 `2026-09-12T02:55:05.203Z`，最大 birthtime 为 `2026-09-12T00:41:14.496Z`，均按 epoch 早于 run。Claude 报告的 35/5 结果无法复现；本次 run 在最后一次代码改动之后，不构成该 finding 的阻断。 |
| S-01 acceptance/源码时间跨时区书写 | `CONFIRMED` → `FIXED` | 原文把 UTC 值直接标为 `+0900`；已改为同时记录 UTC 与 `2026-09-12T11:55:05.203+09:00`，并明确比较 epoch。该 finding 是证据文档缺陷，不是生产行为缺陷。 |
| S-02 事务矩阵粒度不足 | `CONFIRMED` → `FIXED` | 原 CP-0 事务表只有 5 个 facade 汇总行。已补 37 个详设 family 的逐行索引，逐 family 记录入口、target、原/现事务形态与 self-call/bean 承接；混合 family 仍逐入口区分默认事务、显式 REQUIRED、readOnly 与无注解。该表证明文档粒度已闭合，不把它冒充为逐方法族运行期事务语义的动态证明。 |
| N-01 DEV 拓扑未证明 | `REJECTED_WITH_EVIDENCE` | 当前 DEV manifest 为 `.runtime/r5/run-manifest.json`，明确记录 `REMOTE_TRUSTED_HOST`、`REMOTE_LOCALHOST`、`HTTP_AND_ASSET_ONLY`；remote Java readiness 为 `REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY`，并带 host/remoteRoot/PID/bootId/startTicks/ready marker；tunnel 只有远端 Java HTTP `28080→8080` 与 asset `29000→19000`，本机进程只有两个 Vite。`scripts/dev/check` 返回 `R5_DEV_ENVIRONMENT=PASS`。该证据足以证明 DEV 拓扑，不能把 `jdbc:127.0.0.1` 误读成本机 PostgreSQL。 |
| N-02 reset 判读 | `CONFIRMED_WITH_SEPARATE_EVIDENCE` | reset manifest 的 `PASS_DATABASE_ABSENT_READBACK` 与 `PASS_NO_PERSISTENT_RESET_PROCESS` 只证明 reset 自身的数据库不存在和 cleanup；seed/DEV 的后续业务读回另由各自报告证明。本次重新执行的 reset、DEV、四个 seed 子阶段均有独立 manifest，parent seed 为 `PASS` / `PASS_PRESERVED_DEV_STATE`，因此不再使用旧产物混合判读。 |
| S-03 Catalog 查询校验重复实现 | `CONFIRMED` → `FIXED` | 同根扫描发现 `CatalogOwnerService.validateItemPageQuery` 与 `CatalogWorkbenchReadService.validateItemPageQuery` 的函数体在去空白后等价，违反详设要求的共享纯值实现。已新增 `CatalogOwnerValueSupport.validateItemPageQuery`，两个既有 public static FQCN 入口仅转发；CP-0 的 `catalog.query-validation` 行与 implementation design 已同步，catalog compile 与随后全量 acceptance 均通过。 |

处置后，动态 acceptance、reset、DEV、seed 产物均保留原 run，不删除、不改写、不以新文档覆盖原始 manifest；本节只修正文档
事实和矩阵索引。UAT、部署、切流仍未执行。

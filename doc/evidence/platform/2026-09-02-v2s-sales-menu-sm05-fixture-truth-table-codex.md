# SM-05 重跑前静态 fixture truth table

- 日期：2026-09-02
- 范围：销售菜单 SM-05 的 13 个 `SALES_MENU` 场景、1 个 `BUSINESS_CHANNEL` 场景、1 个 `ASSET` 场景，共 15 条。
- 性质：静态 fixture truth table 与 SM-05 focused 闭环证据；不把本证据越级为 CP-05、browser L2、DEV/seed 或生产实现完成证明。
- 结论：`STATIC_TRUTH_TABLE=PASS`；`OPEN_STATIC_ORACLE_COUNT=0`；第 1–15 行 focused 场景均为 `CONTRACT=PASS`、`BUSINESS=PASS`、business/cleanup `PASS`；当前 31 条 operation 的真实 completion event 覆盖为 `31/31`。CP-05 `cardinality=1`、`cardinality=20`、`cardinality=100` 三点 calibration 均已通过 exact-set、正常样本、连接门与 cleanup；但当前活动分母为 268 个 operation，其中 20 个销售菜单 operation 超过现行 P3 class ceiling，normal projection、normal verify、全量回归与 SM-06 仍被 CP-05 readiness gate 阻断。

## 输入与判定方法

本表逐条重开并交叉核对以下原文与当前源码：

- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md` §11.1、§11.1a
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md` §1a、§1b、SM-05
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/AssetAcceptanceScenarios.java`
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java` 的 section/item owner read model

判定先按动作序列重新推导分母，再对照测试中的期望值；不沿用前置状态，不把 2xx 当作业务通过。`MATCHED` 只表示静态源码与设计的 oracle 一致，不能替代动态证明。

## Fresh independent recheck

- `reviewerKind=INDEPENDENT_SUBAGENT`；本轮复查者为 fresh 独立只读 agent；未运行动态命令，未修改源码，未运行 Git 或服务。
- 复查输入重新打开了上述需求、IA、交互设计、implementation design/plan、三份 acceptance scenario owning source，以及相关 owner read model。
- 复查结论：静态三维对账 `15/15 MATCHED`、`OPEN_STATIC_ORACLE_COUNT=0`；HTTP completion events、backend-acceptance/Testcontainers、business/cleanup、CP-05 normal projection 仍为 `PENDING`。
- 该结论是 SM-05 当前步骤的静态准入证据，不是整批 implementation review，也不替代后续动态验收。

## 15 条静态 truth table

| # | scenarioId | 动作序列与 fixture 分母 | 重新推导的期望值 | 静态状态 | 动态状态 |
|---:|---|---|---|---|---|
| 1 | `sales-menu.store-scope-and-channel-eligibility` | 一个本店 `INTERNAL/TAKEAWAY` 渠道和一个门店菜单；另造项目级渠道、外部渠道；另用无能力 actor 和同空间 sibling store。 | 列表只返本店 eligible 菜单；项目/外部 create 为 `SALES_MENU_CHANNEL_INELIGIBLE`；无能力 actor 不写入；跨门店读取拒绝；新增 `DINE_IN` eligible 后可见。 | `MATCHED`（源码 69-198） | `PASS`（focused run） |
| 2 | `sales-menu.collection-lifecycle-and-multi-activation` | 一个渠道、21 份菜单；其中两份用于同时启用，最后一份用于第二页；覆盖 rename、schedule、activation、archive。 | menu cursor 为 20+1 且第 21 份可达；同一渠道两份可同时 `ENABLED`；停用不阻断编辑/发布；schedule 权威读回；archive 保留历史；跨 query cursor 拒绝。 | `MATCHED`（源码 204-310） | `PASS`（focused run） |
| 3 | `sales-menu.copy-current-draft-boundary` | 源菜单含已保存脏草稿、一次 publication、人工销售状态、操作记录和 enabled activation，再执行 copy。 | 副本只复制当前 draft 定义与时段；新菜单 ref 独立且 disabled；publication、operation、inventory、manual source、源 activation 不泄漏。 | `MATCHED`（源码 316-568） | `PASS`（focused run） |
| 4 | `sales-menu.ordered-sections-and-items` | 3 个 section；21 个 eligible catalog candidates；首 section 加入 21 个 item；第二 section 再加入同一 catalog item 形成重复销售项；覆盖 section/item rename、move、delete 和边界拒绝。 | candidate 与 item 均为 20+1；首次 section facts 为 `(21,0,0)`；重复加入产生 2 个不同 `salesItemRef`；移动/重命名后为首 section 21、空 section 删除后剩余 item section 为 1；非空删除与首项 `UP` 只返回 typed reject 且不变更。`itemCount` 来自 owner 对同一 version 的真实 `count(*)`，因此 duplicate 后第二 section 必须是 `1`，不是 `0`。 | `MATCHED`（源码 574-824；owner source 1851-1886） | `PASS`（focused run） |
| 5 | `sales-menu.shape-specific-sale-definition` | direct、weighted、composite、service、SKU 五类 catalog item；SKU 含真实 SKU；weighted 含真实 Catalog `salesUnit`。 | 形态分别为 `ORDINARY/WEIGHTED/COMPOSITE/SERVICE/SKU`；普通/套餐/服务使用公共挂牌价；weighted 的起售量与倍数可空且 salesUnit 五字段从 Catalog 读回、请求不携带单位；SKU 无公共挂牌价而按 SKU 维护挂牌价；catalog binding 不变。 | `MATCHED`（源码 830-973） | `PASS`（focused run） |
| 6 | `sales-menu.display-media-owner-transaction` | 一个合法目标；跨 store、跨 menu、跨 item、错误 usage 的目标；STAGED、RELEASED、claimed、错误 grant、无能力 actor。 | 合法 stage/claim/release 读回真实 target、版本和 usage；无能力、跨目标、wrong usage、claimed/released、错误 grant 或版本冲突拒绝；错误保存不产生 menu/asset 部分写入。 | `MATCHED`（源码 `displayMediaOwnerTransaction`，979 行起；ROUND 2 finding 修复后作者静态复核） | `PASS`（修复后 focused run） |
| 7 | `sales-menu.publish-frozen-effective-view` | 一个合法 draft item；先 preview/publish，再改 draft 价格并再次 publish；读取 published sections/items/detail 与 menu revision。 | 首次 publication 冻结首版价格与结构；draft 修改不改旧 publication；再次 publish 只推进最新 revision 并暴露新值；响应不声称 terminal ACK。 | `MATCHED`（源码 `publishFrozenEffectiveView`，1201 行起） | `PASS`（focused run） |
| 8 | `sales-menu.publish-blockers` | malformed price draft；disabled menu；disabled channel；disabled store；activation 单独 disabled。 | malformed draft 的 preview/publish 都是 typed blocker 且不发布；disabled channel/store 阻断；activation disabled 不阻断 publish；失败不推进版本、不生成 publication。 | `MATCHED`（源码 `publishBlockers`，1351 行起） | `PASS`（focused run） |
| 9 | `sales-menu.inventory-availability-matrix` | 六个 published item：无 inventory target、正常库存、低库存、缺货、允许负库存、禁止负库存；再注入 controlled inventory read failure。 | 无 target=`NOT_APPLICABLE`；正常/低库存=`AVAILABLE`；缺货=`AUTO_UNAVAILABLE/OUT_OF_STOCK`；允许负库存仍可售；禁止负库存=`AUTO_UNAVAILABLE/NEGATIVE_NOT_ALLOWED`；读失败=`UNKNOWN/READ_UNAVAILABLE`；库存事实不改写菜单行，manual 状态独立。 | `MATCHED`（源码 `inventoryAvailabilityMatrix`，1514 行起） | `PASS`（focused run） |
| 10 | `sales-menu.manual-sale-status-and-restore` | 两个 eligible channel 共享 published item；只在第一渠道执行 manual sold-out；覆盖缺原因、库存缺货、republish、二次确认与 restore。 | 原因必填；只改变目标渠道；inventory 与 manual 两维不合并；republish/库存变化不自动恢复；错误请求无变更；确认 restore 后回 `NORMAL`、原因为空且恢复记录保留。 | `MATCHED`（源码 `manualSaleStatusAndRestore`，1756 行起） | `PASS`（focused run） |
| 11 | `sales-menu.operation-record-cursor` | 一个菜单、一个 item、17 个空 section，加菜单/加 item/失败删除，形成 20+1 条操作记录。 | records cursor 20+1 无重无漏；1 create menu、1 add items、18 create sections、1 failed delete 的业务事实准确；SUCCESS/FAILED、actor、failureCode 可见；无诊断字段和 raw payload。 | `MATCHED`（源码 `operationRecordCursor`，1930 行起） | `PASS`（focused run） |
| 12 | `sales-menu.command-idempotency-and-cas` | 同一 idempotency key 同体重放；同 key 异体；新 key additive；stale version update。 | 同体重放返回相同 ref/JSON 且不重复写；同 key 异体为 409；新 intent 新增；stale CAS 为 409 且名称和记录不变；owner readback 为权威结果。 | `MATCHED`（源码 `commandIdempotencyAndCas`，2039 行起） | `PASS`（focused run） |
| 13 | `sales-menu.generated-route-contract` | 最小合法菜单 aggregate；通过 generated route constants 触达尚未由其他场景覆盖的读/写 operation。 | 31 个受影响 operation 的 generated identity/handler/face 结构可达；每个成功响应仍须有业务 identity；不以 HTTP 2xx 代替业务 oracle。 | `MATCHED`（源码 `generatedRouteContract`，2120 行起；详设 §11.1a） | `PASS`（focused run；全 31 行聚合对账仍待 SM-05 收口） |
| 14 | `business-channel.sales-menu-eligible-cursor` | 本店 20 个 `TAKEAWAY` + 1 个 `DINE_IN` eligible；项目级 `INTERNAL/TAKEAWAY`；本店 `INTERNAL/GROUP_BUY`；外部本店 `EXTERNAL/TAKEAWAY`；同空间 sibling store。六个 helper 已统一为 typed fixture records。 | STORE sales-menu projection 第一页 20、第二页 1、terminal cursor null、21 个 unique；四类 ineligible 不出现；`sortKey` 变化的 cursor 为 typed validation reject；cursor 跨 store 为 scope reject。外部 helper 必须取 `channelRef`，不能把 binding response 当 channel response。 | `MATCHED`（源码 `salesMenuEligibleCursor`，965 行起；编译已通过） | `PASS`（首个 focused run） |
| 15 | `asset.sales-menu-image-lifecycle` | 合法 store/menu/section/item target；无能力 actor；跨 store/menu/item；catalog wrong usage；claimed、released、replacement、published-bound asset。发布 claimed image 后替换草稿图片并归档菜单。 | 合法 stage 返回 `STAGED`、真实 target、draft version、bind grant；无能力和跨目标拒绝；catalog asset 不能以 sales-menu usage release；claimed/released 不能重复 release；有效 replacement 可 release；发布快照保留原图片；草稿替换和归档后 published-bound `ACTIVE` 图片仍不可释放；不产生跨 owner 部分写入。 | `MATCHED`（源码 129-581） | `PASS`（focused run） |

## 首个 focused 动态证据

- `runId=r5-tc-1788314396385-64490`；`operation=business-channel.sales-menu-eligible-cursor`；`verificationMode=ACCEPTANCE`。
- `run-manifest.json`：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；`cleanup.status=PASS`，其中 remote process/workspace、Testcontainers containers/volumes 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=9`；没有出现 `BUDGET_PROJECTION_OPERATION_MISSING`。
- HTTP completion events 已实际归属该 run；被测 acceptance operation 为 `getOperationsStoreBusinessChannels`，不是只依据 HTTP 2xx 判定。`measurementEvidence.unclassifiedSqlRatio=0`。
- 本证据只关闭第 14 行的动态状态；第 1–13、15 行以及 SM-05 总体仍未完成，必须继续按单场景顺序运行并分别读取 business/cleanup。

### 第 1 行 focused 动态证据

- `runId=r5-tc-1788314708605-71652`；`operation=sales-menu.store-scope-and-channel-eligibility`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=26`。
- HTTP completion events 实际出现 `getOperationsSalesMenus` 的成功请求，`status=200`、`outcome=SUCCEEDED`、`unclassifiedSqlOperationCount=0`；未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。

### 第 2 行 focused 动态证据

- `runId=r5-tc-1788314801004-73290`；`operation=sales-menu.collection-lifecycle-and-multi-activation`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=26`。
- HTTP completion events 实际出现 `createOperationsSalesMenu` 的 21 个成功请求，`status=201`、`outcome=SUCCEEDED`、`unclassifiedSqlOperationCount=0`；未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。

### 第 3 行 focused 动态证据

- `runId=r5-tc-1788314891480-74912`；`operation=sales-menu.copy-current-draft-boundary`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=44`。
- HTTP completion events 实际出现 `copyOperationsSalesMenu` 的成功请求，`status=201`、`outcome=SUCCEEDED`、`unclassifiedSqlOperationCount=0`；未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。

### 第 4 行 focused 动态证据

- `runId=r5-tc-1788317354480-14166`；`operation=sales-menu.ordered-sections-and-items`；`verificationMode=ACCEPTANCE`。该 run 是补充 fixture 后的当前证明；早先 `r5-tc-1788314985835-76618` 只作为历史 PASS 保留，不作为最终 31-operation 分母的 row 4 证明。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=40`。
- HTTP completion events 实际覆盖 section 查询、创建、删除成功及预期 typed delete reject；补充 run 真实出现 `deleteOperationsSalesMenuItem DELETE 200 SUCCEEDED`，目标 `getOperationsSalesMenuDraftSections` 成功请求为 200，`unclassifiedSqlOperationCount=0`。真实业务断言已通过 duplicate 后 `itemCount=1`，未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。

### 第 5 行 focused 动态证据

- `runId=r5-tc-1788315085087-78428`；`operation=sales-menu.shape-specific-sale-definition`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=40`。
- HTTP completion events 实际覆盖 `getOperationsSalesMenuDraftItem` 与 `updateOperationsSalesMenuItem`，成功请求为 200/SUCCEEDED，`unclassifiedSqlOperationCount=0`；五种定义的业务 oracle 已通过，未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。

### 第 6 行 focused 动态证据

- `runId=r5-tc-1788316330139-1642`；`operation=sales-menu.display-media-owner-transaction`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`，evidence archive 也为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=44`。
- HTTP completion events 实际覆盖：`stageOperationsSalesMenuAsset` 为 `201×3/404×3/403×1`，`updateOperationsSalesMenuItem` 为 `200×1/422×1`，`releaseOperationsSalesMenuStagedAsset` 为 `200×2/403×1/409×3`，`getOperationsSalesMenuDraftItem` 为 `200×6`；`unclassifiedSqlOperationCount=0`。
- 业务 oracle 已实际通过合法 target claim、cross-store/menu/item、catalog wrong-usage、claimed ACTIVE、STAGED wrong grant、already RELEASED、stale asset version、no-capability 以及失败后 asset/menu readback；未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。这只关闭第 6 行，不代表 SM-05 15/15 或 31-operation closure。

### 第 7 行 focused 动态证据

- `runId=r5-tc-1788316482190-2109`；`operation=sales-menu.publish-frozen-effective-view`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=28`。
- HTTP completion events 实际覆盖 preview、publish 两次、published sections/items/detail、draft reads、menu revision、draft schedule 与 catalog mutation；成功请求均为预期 200/201，`unclassifiedSqlOperationCount=0`。业务 oracle 已证明旧 publication 在 draft 改价后冻结、第二次 publish 只产生新 revision，未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。

### 第 8 行 focused 动态证据

- `runId=r5-tc-1788316581570-2292`；`operation=sales-menu.publish-blockers`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=40`。
- HTTP completion events 实际覆盖 malformed draft、disabled menu/channel/store blockers 与 activation-disabled 的允许路径：`publishOperationsSalesMenu` 成功 `201×1`、预期 blocker `422×3`；`getOperationsSalesMenuPublicationPreview` `200×3`；disabled menu 的 published read 为预期 `404`；`unclassifiedSqlOperationCount=0`。未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。

### 第 9 行 focused 动态证据

- `runId=r5-tc-1788316689421-2485`；`operation=sales-menu.inventory-availability-matrix`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=44`。
- HTTP completion events 实际覆盖六种库存对象与 published menu reads：`getOperationsInventoryTarget` `200×11`、`adjustOperationsInventoryTarget` `200×2`、`countOperationsInventoryTarget` `200×3`、`updateOperationsInventoryTargetConfiguration` `200×6`，published sections/items/detail 与 catalog/item reads 均成功；`unclassifiedSqlOperationCount=0`。六类库存事实及 controlled read failure 的业务 oracle 已通过，未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。

### 第 10 行 focused 动态证据

- `runId=r5-tc-1788316792816-3591`；`operation=sales-menu.manual-sale-status-and-restore`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=44`。
- HTTP completion events 实际覆盖两个 eligible channel 的 publish/read、manual sold-out 与 restore：`setOperationsSalesMenuItemSoldOut` `200×1/422×1`，`restoreOperationsSalesMenuItemSale` `200×1/422×1`，published item read `200×8`，`unclassifiedSqlOperationCount=0`。原因必填、目标渠道隔离、republish/inventory 不自动恢复与显式 restore 的业务 oracle 已通过，未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。

### 第 11 行 focused 动态证据

- `runId=r5-tc-1788316892630-5537`；`operation=sales-menu.operation-record-cursor`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=26`。
- HTTP completion events 实际覆盖 `createOperationsSalesMenuSection` `201×18`、`getOperationsSalesMenuOperationRecords` `200×2` 与非空 section 删除的预期 typed `409×1`；操作记录 cursor 的 20+1 无重无漏、SUCCESS/FAILED 与 failureCode 业务 oracle 已通过，`unclassifiedSqlOperationCount=0`，未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。

### 第 12 行 focused 动态证据

- `runId=r5-tc-1788316984284-7208`；`operation=sales-menu.command-idempotency-and-cas`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=28`。
- HTTP completion events 实际覆盖 create 的同体 replay、同 key 异体 409、new intent additive 与 owner readback：`createOperationsSalesMenu` `201×3/409×1`，`renameOperationsSalesMenu` 的 stale/idempotency conflict 为 `409×1`，`getOperationsSalesMenu` 与 menu list readback 均为 200，`unclassifiedSqlOperationCount=0`。未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。

### 第 13 行 focused 动态证据

- `runId=r5-tc-1788317082743-9041`；`operation=sales-menu.generated-route-contract`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=26`。
- 本 run 的 generated-route 代表性请求均有真实 completion event 与业务 identity，包含 menu/channel/catalog、draft/published、candidate/preview/records、activation、schedule、manual status、publish 等 route；成功请求为预期 200/201，`unclassifiedSqlOperationCount=0`。它只证明该场景自身，不单独宣称 31 行全量实际覆盖；全 31 行将从 SM-05 15 条 focused run 的实际 completion events 聚合确认。

### 第 15 行 focused 动态证据

- `runId=r5-tc-1788317192888-11002`；`operation=asset.sales-menu-image-lifecycle`；`verificationMode=ACCEPTANCE`。
- manifest：`status=PASS`、`testExecution=PASS`、`business=PASS`、`firstFailure=null`；remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- backend acceptance：`CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`、`selected=1`、`HTTP_SUCCESS=1`、`REAL_BUSINESS_ASSERTIONS=1`、`DIRECT_FAILURES=0`、`DB_OPERATIONS=48`。
- HTTP completion events 实际覆盖 `releaseOperationsSalesMenuStagedAsset` `200×1/403×1/409×3`、`stageOperationsSalesMenuAsset` `201×3/403×1/404×3`、`updateOperationsSalesMenuItem` `200×2`、`publishOperationsSalesMenu` `201×1`、`archiveOperationsSalesMenu` `200×1` 与 published item reads `200×3`；`unclassifiedSqlOperationCount=0`。
- 业务 oracle 已通过合法 target、无能力/跨目标拒绝、catalog wrong usage、claimed/released 生命周期边界、有效 replacement release，以及发布后替换草稿并归档仍保留原 published-bound 图片；未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。

## CP-05 校准与连接失败族收敛

- 首次 CP-05 `cardinality=1` 校准 run 为 `r5-tc-1788318083119-36559`；P2 与 99 个业务场景完成，Testcontainers cleanup `PASS`，但 `p2ReadConnectionScopeProof` 失败，`BUDGET_PROJECTION_OPERATION_MISSING` 未出现，measurement 未启动。
- 首败根因是校准 fixture 的 `calibrationDeleteLocallyUnboundExternalBinding` 对 `EXTERNAL/STORE/GROUP_BUY` channel 调用了会抛异常的 `find()`，把按设计应不存在的负向分母当成了异常路径；不是生产 owner 逻辑缺陷。随后一次同族复发 run 为 `r5-tc-1788318745735-52796`，按 stop condition 停止继续校准，并将 absence oracle 改为对真实 sales-menu 列表做非抛异常 membership 检查。
- 修复后首个 run `r5-tc-1788319021935-72567` 已关闭上述 P2 oracle 失败，但暴露了同一 read-only connection-scope 根因族：11 个 sales-menu GET operation 的 operation-level connection borrow 均超过 `max=1`，其中 `getOperationsSalesMenuDraftSections` 首败为 `actual=5/max=1`；business 与 cleanup 均为 `PASS`，因此未进入下一 cardinality。
- 最小修复是复用既有 `ReadOnlyTaskConnectionScopeInterceptor`，把 11 个 sales-menu GET operation 加入现有 P2 read-only transaction scope，并在 `scripts/test/backend-performance-budget.test.mjs` 增加 11 个 operation 的静态回归约束；未改变产品语义、owner、权限、数据模型或 operation。
- 修复后的 `cardinality=1` 校准 run 为 `r5-tc-1788319609680-86472`：`status=PASS`、远端 Gradle/99 个业务场景/`business=PASS`、Testcontainers containers/volumes 与 evidence archive 均 `PASS`；generated exact-set `268/268`，`missing=0`、`extra=0`、`drift=0`，`unclassifiedSqlOperations=0`，连接门 `declared=268/observed=268/exceeded=0`，normal sample matrix `268/268`，`firstFailure=null`。11 个 sales-menu GET operation 的实测最大 operation connection borrow 均为 `1`。
- 该结果只关闭 `cardinality=1` 校准与当前连接失败族的零复发；仍需按授权顺序完成其余 CP-05 cardinality、normal projection/edge-codegen/verify 与后续全量回归。它不证明 browser L2、DEV/reset/seed、UAT 或生产 owner 行为。

- `cardinality=20` 校准 run 为 `r5-tc-1788320287269-6452`：`status=PASS`、远端 Gradle/99 个业务场景/`business=PASS`、Testcontainers containers/volumes 与 evidence archive 均 `PASS`；generated exact-set `268/268`，`missing=0`、`extra=0`、`drift=0`，`unclassifiedSqlOperations=0`，连接门 `declared=268/observed=268/exceeded=0`，normal sample matrix `268/268`，`firstFailure=null`。
- 该 run 的 batch operation `batchTransitionOperationsCatalogItemStatus` 真实 completion event 为 `requestCardinality=20`、`databaseOperationCount=112`、`connectionBorrowCount=21`、`transactionBeginCount=21`；normal sample matrix 对应 `normalSampleCount=1`、`maxDatabaseOperationCount=112`。该结果只关闭 `cardinality=20` calibration，不替代 `cardinality=100` 或 normal fixed-budget projection。
- `cardinality=100` 校准 run 为 `r5-tc-1788320589426-13563`：`status=PASS`、远端 Gradle/99 个业务场景/`business=PASS`、Testcontainers containers/volumes 与 evidence archive 均 `PASS`；generated exact-set `268/268`，`missing=0`、`extra=0`、`drift=0`，`unclassifiedSqlOperations=0`，连接门 `declared=268/observed=268/exceeded=0`，normal sample matrix `268/268`，`firstFailure=null`。
- 该 run 的 batch operation `batchTransitionOperationsCatalogItemStatus` 真实 completion event 为 `requestCardinality=100`、`databaseOperationCount=512`、`connectionBorrowCount=101`、`transactionBeginCount=101`；normal sample matrix 对应 `normalSampleCount=1`、`maxDatabaseOperationCount=512`。`1/20/100` 三个受控 cardinality 均已有真实成功 completion event，线性形态与 `15+5×N` 一致；该结果仍不等于 normal fixed-budget projection 已生成。
- 因此 CP-05 calibration 的三点分母、exact-set、正常样本、连接门与 cleanup 证据现已闭合；但它不等于 normal projection readiness。当前 268-operation 分母仍有 20 个销售菜单 P3 blocker，必须先在 owning source 做根因收敛并重新复核，不能先写入预算例外或推进 normal projection/edge-codegen/verify。它不证明 browser L2、DEV/reset/seed、UAT 或生产 owner 行为。

## 当前 SM-05 focused aggregate

- 当前分母是 15 条最新 focused run：`r5-tc-1788314396385-64490`、`r5-tc-1788314708605-71652`、`r5-tc-1788314801004-73290`、`r5-tc-1788314891480-74912`、`r5-tc-1788315085087-78428`、`r5-tc-1788316330139-1642`、`r5-tc-1788316482190-2109`、`r5-tc-1788316581570-2292`、`r5-tc-1788316689421-2485`、`r5-tc-1788316792816-3591`、`r5-tc-1788316892630-5537`、`r5-tc-1788316984284-7208`、`r5-tc-1788317082743-9041`、`r5-tc-1788317192888-11002`、`r5-tc-1788317354480-14166`。历史 row 6 首败与 row 4 旧 PASS 不混入当前 15 行 closure 分母。
- 每个当前 run 的 backend-acceptance result 均为 `CONTRACT=PASS`、`BUSINESS=PASS`、`businessMode=REAL`；每个 run manifest 均为 `status=PASS`、`business=PASS`、`firstFailure=null`，remote process/workspace 与 Testcontainers containers/volumes cleanup 均为 `PASS`。
- 对上述 15 个 run 的真实 `http-request-events.jsonl.gz` 聚合：详设 §11.1a 的 31 个 expected `operationId` 实际 unique coverage 为 `31/31`，`missing=[]`；每行至少有真实事件，且 `owner` 与 `consumerFace` 均非空，未发现不在允许集合内的 HTTP status。row 4 的 `deleteOperationsSalesMenuItem` 由补充 run 实际补齐。
- 当前 15 个 run 未出现 `BUDGET_PROJECTION_OPERATION_MISSING`。此前同一失败族的历史首败仍作为诊断边界保留；本 aggregate 只证明当前 focused recovery 的零复发，不等同于 CP-05 normal projection 已生成或全量回归已通过。
- 该 aggregate 是 SM-05 动态覆盖证据，不以 `sales-menu.generated-route-contract` 的代表性请求、场景数量或 HTTP 2xx 替代 operation 的实际 completion event，也不替代下一步 fresh 独立整批三维对账。

## 当前步骤 fresh 独立复核

- `REVIEW_CYCLE_ID=SM05-STEP-BUSINESS-CHANNEL-20260902`；`REVIEW_ROUND=1`；`REVIEW_ROUND_LIMIT=2`；`reviewerKind=INDEPENDENT_SUBAGENT`。
- 独立复核结论：当前 BusinessChannel 步骤 `GO`，`M/S/N=0/0/0`。需求、IA/交互、详设映射、项目记忆、owning source 与本次 manifest/result/events 已重新核对。
- 独立复核同时确认：四类负向分母、DINE_IN、20+1 cursor、typed helper 身份均匹配；该 GO 只覆盖本场景，不覆盖其余 14 条、31-operation closure、CP-05、L2、seed/DEV 或生产实现。

### Media row 6 review disposition

- `REVIEW_CYCLE_ID=SM05-STEP-MEDIA-20260902` 的 `REVIEW_ROUND=1` 已确认 cross-store 与 wrong-usage 的 exact problem code 修复，但指出 lifecycle 与 grant 分母仍混合；该轮 `PARTIAL`、row 6 `NO-GO`、`M/S/N=1/1/0`。
- `REVIEW_ROUND=2` 为最终独立复核，确认精确 code 与独立前置状态已补齐，但指出 claimed ACTIVE、already RELEASED、no-capability 三条拒绝分支缺少失败后 menu/asset 无部分写入读回；该轮 `NO-GO`、`M/S/N=1/0/0`、`ROUND_FINAL_DECISION=SELF_DECIDED`，动态未运行。
- 随后仅在 `SalesMenuAcceptanceScenarios.java` 补充三条失败后 asset lifecycle/menu binding readback，并通过 `spotlessCheck`、`testClasses`；根据同一 review cycle 的两轮上限，不再召集第三轮，作者对当前字节完成逐项静态复核，row 6 静态状态收敛为 `MATCHED`，动态状态仍为 `PENDING`。

### SM-05 whole-step fresh independent review

- `REVIEW_TARGET=IMPLEMENTATION`；`REVIEW_CYCLE_ID=SM05-STEP-WHOLE-20260902`；`REVIEW_ROUND=1`；`REVIEW_ROUND_LIMIT=2`；`reviewerKind=INDEPENDENT_SUBAGENT`；`READ_ONLY=true`；`NO_DYNAMIC=true`；`NO_GIT=true`。
- 独立 verifier 重新打开需求、IA、交互设计、implementation design/plan、项目记忆设计规范、三份 acceptance owning source，以及当前 15 个 run 的 manifest/result/HTTP events；未信任作者的 aggregate 结论。
- 复核结论：`GO`，范围仅为“SM-05 focused closure 可以进入 CP-05 / full regression preparation”；`M/S/N=0/0/0`。确认 15 个最新 focused run 的 `CONTRACT/BUSINESS/businessMode=REAL`、manifest business/cleanup/evidence archive、row 4 `deleteOperationsSalesMenuItem DELETE 200 SUCCEEDED`、row 6/15 media failure-after-readback、row 14 四类分母，以及真实 31/31 operation union 均匹配。
- 该 `GO` 不证明 CP-05 normal projection、normal `edge-codegen`/verify、browser L2、DEV/reset/seed、UAT 或生产 owner 行为；这些仍是后续独立证据边界。本轮不再召集第二轮或第三轮。

### CP-05 connection-scope step fresh independent reconciliation

- `REVIEW_TARGET=IMPLEMENTATION`；`REVIEW_CYCLE_ID=SM05-CP05-CONNECTION-20260902`；`REVIEW_ROUND=1`；`REVIEW_ROUND_LIMIT=2`；`reviewerKind=INDEPENDENT_SUBAGENT`；`READ_ONLY=true`；`NO_DYNAMIC=true`；`NO_GIT=true`。
- Hypatia fresh 独立复核重新打开当前需求、详设/IA、项目记忆设计约束、`ReadOnlyTaskConnectionScopeInterceptor.java`、`backend-performance-budget.test.mjs` 与 `r5-tc-1788319609680-86472` 全部归档 evidence；结论 `STEP_RECONCILIATION=PASS`，11 个维度全部 `MATCHED`，`OPEN=0`，`M/S/N=0/0/2`。
- 复核确认 11 个 sales-menu GET 只是加入既有 operationId 闭集的 read-only transaction scope，未改变 controller/service/business branch、owner、权限、schema/data model、route、用户文案或 UI；静态回归约束与 `cardinality=1` calibration 的 `268/268`、connection `observed=268/exceeded=0` 证据一致。
- 两项 N 仅为边界声明：本轮没有新动态执行；该结论不能升级为 CP-05 全 cardinality、整体销售菜单完成、browser L2、DEV、UAT 或生产实现证明。该步骤可进入 `cardinality=20`，不产生待修 finding。

### CP-05 calibration readiness fresh independent reconciliation

- `REVIEW_TARGET=IMPLEMENTATION`；`REVIEW_CYCLE_ID=SM05-CP05-CALIBRATION-20260902`；`REVIEW_ROUND=1`；`REVIEW_ROUND_LIMIT=2`；`reviewerKind=INDEPENDENT_SUBAGENT`；`READ_ONLY=true`；`NO_DYNAMIC=true`；`NO_GIT=true`。
- Parfit fresh 独立复核确认三次 calibration archive、268 operation exact-set、`cardinality=1/20/100`、`15+5N` batch 线、connection gate、business/cleanup/archive 证据均成立；但重建当前 readiness 后为 `budget.generated=false`、`blockedCount=20`，硬门为 `BUDGET_NOT_READY_CP05_BLOCKED:20`，不能进入 normal projection、edge-codegen 或 verify。
- 20 个 blocker 均为当前销售菜单 operation 的 P3 class ceiling 超限；当前 checked-in CP-05 report 仍是旧 238-operation 分母，不能当作活动 268-operation readiness 证明。该 finding 不是整体 implementation review verdict。
- 11 维对账为 `M/S/N=1/1/1`：M 为 20 个 P3 blocker 未关闭；S 为“calibration 已完成”与“normal readiness 已就绪”之间存在证据表述越级风险；N 为 calibration 证据可保留为后续修复输入。最小下一步是扫描 SalesMenu owner/repository 与可复用 owner/context 机制，消除不必要 DB 操作且保留全部业务事实；本诊断与当前授权均不新增预算例外。

## 关键修复与边界

1. ordered 场景之前的纸面错误已在当前源码中被修复并重新对账：第二 section 加入 duplicate 后 `itemCount=1`，删除空 section 后该值仍为 `1`。owner SQL 对同一 version 的 item 做真实 `count(*)`，故将它写成 `0` 会把业务事实错误地当作 oracle。
2. BusinessChannel 当前分母不再只有 `TAKEAWAY`：20 个 `TAKEAWAY` 加 1 个 `DINE_IN`；项目、`GROUP_BUY`、外部 `TAKEAWAY` 是显式负向分母。六个原裸 `BackendAcceptanceTest.Response` helper 已改为 `CreatedTemplate`、`CreatedChannel`、`CreatedBinding`、`CreatedExternalStoreBinding` 记录，避免 channel/binding 身份混读。
3. 本轮静态复核未发现第三条 oracle mismatch；静态和 focused 动态分母现已闭合，但不把它们越级为 CP-05 normal projection、browser L2、DEV/reset/seed 或生产实现证明。
4. `BUDGET_PROJECTION_OPERATION_MISSING` 在当前 15 个 focused run 中零复发，且 fresh whole-step review 已 `GO`；CP-05 三次 calibration 的真实 exact-set、正常样本、连接门与 cleanup 已闭合，但 normal readiness 仍被 20 个销售菜单 P3 blocker 阻断，不能推进后续投影或 SM-06。

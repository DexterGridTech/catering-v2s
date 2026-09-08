# R5 销售菜单目标选择与细粒度沽清整批 implementation 三维对账

```text
REVIEW_KIND=AUTHOR_WHOLE_BATCH_THREE_DIMENSION_RECONCILIATION
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=R5-SM-TARGET-SELECTION-AVAILABILITY-IMPLEMENTATION-20260908
REVIEWER_KIND=AUTHOR_MAIN_AGENT
INDEPENDENT_REVIEW_ROUND_1=GO_WITH_UNVERIFIED_UI_M0_S0_N0
INDEPENDENT_REVIEW_ROUND_2=NO_GO_M1_S0_N2_AUTHOR_REPAIRED
IMPLEMENTATION_AUTHORITY=true
DYNAMIC_STATUS=BLOCKED_EXTERNAL_RUNTIME_AFTER_MANAGED_DIAGNOSIS
```

本记录是整批动态验证后的作者逐项三维对账，不是 fresh independent subagent verdict，也不把静态结果当作 HTTP、浏览器、DEV 或 seed 证据。三维输入重新打开了：

- `doc/decisions/2026-09-07-v2s-sales-menu-target-selection-availability-journey-amendment.md`
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-requirements-amendment.md`
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-ia-amendment.md`
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-interaction-design-codex.md`
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-implementation-design-codex.md`
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-implementation-plan-codex.md`
- 当前任务命中的 project-memory kernels、backend/frontend/review 标准与 `cs-managed-runtime-execution` 约束
- 当前 contract、owner、migration、edge、frontend、acceptance、fixture/seed、L2 source

## 1. 业务事实逐条对账

| 业务事实 | 需求/IA/交互规定 | 当前 owning source 与证据入口 | 结果 |
| --- | --- | --- | --- |
| 同一 Catalog 商品可有多个 SalesItem | 每个 SalesItem 独立保存目标集合，不做跨 SalesItem 去重 | `SalesMenuOwnerService` 的 item aggregate/update；`SalesMenuAcceptanceScenarios.skuSubsetSelectionAndRepeatItem`；L2 SKU fixture 的两个相同 candidate baseline | `MATCHED` |
| SKU 子集与独立挂牌价 | `SKU_SELECTION` 必须非空；每个选中 SKU 的挂牌价是菜单事实 | `SalesMenuSaleContentInput`/`SalesMenuOwnerService.authoritativeSkuRows`；`sales_version_item_sku`；编辑 Drawer SKU checkbox/price state | `MATCHED` |
| 普通选项值子集 | 每个 Catalog definition 必须显式提交；Catalog 事实解析为 SalesMenu snapshot | `authoritativeOrderOptionRows`；`sales_version_item_order_option*`；`selectedOrderOptions` editor/detail/readback | `MATCHED` |
| optional 零选择与 required 非空 | optional 空数组合法；required 按 Catalog min 校验；缺失 definition 不等于空选择 | `CAESAR_TOPPINGS` required MULTIPLE fixture、`CAESAR_DRESSING` optional fixture；negative acceptance；Drawer required validation | `MATCHED` |
| ITEM/SKU/ORDER_OPTION_VALUE target | 一个既有 manual operation 通过 typed target identity 表达三种粒度 | `SalesMenuManualSaleTarget`、controller mapping、`requirePublishedManualTarget`、状态 Modal target tree | `MATCHED` |
| manual、inventory 独立 | parent/child 不级联；恢复人工状态不恢复库存 | `manualStatusByTarget` 与 `inventoryAvailabilityByItem` 分开；acceptance `targetStatusInventoryIndependence`；Modal 独立文案 | `MATCHED` |
| publish child detach | 只清理新 published set 外 child current row；不写 detach event；重新加入从 NORMAL 开始 | `removeUnpublishedChildManualStatuses`；migration/current key；acceptance detach 场景与 `event_kind` 负断言 | `MATCHED` |
| DISABLED/VOIDED SKU | 不进销售菜单候选；save 与 publish revalidation 都拒绝；stale 唯一 SKU 不能在 Drawer 内伪造修复 | Catalog SalesMenu task read 只返回 ENABLED candidate；SalesMenu update/publish status recheck；stale readback 与 acceptance `disabledSkuIsNotSelectable` | `MATCHED` |
| SKU/option shape 边界 | SKU 与 option selection 互斥；Catalog `admittedShapes` 不在本批改动 | `authoritativeOrderOptionRows` 对非 DIRECT 显式 typed reject；未修改 Catalog admittedShapes | `MATCHED` |

## 2. 形态、动作、失败与数据来源对账

| 对账维度 | 当前实现核对点 | 结果 |
| --- | --- | --- |
| Drawer 形态与动作 | `SalesMenuItemEditorDrawer` 使用 foundation Drawer/form lifecycle；SKU 选择、全选、清空、逐 SKU 价格、option group/value、stale Alert 均来自 `salesMenuTestIds.ts`，动作落在真实 Checkbox/Button/Input 节点；round 2 后清空会移除 stale ref，替换候选可保存 | `MATCHED_AFTER_REPAIR` |
| Status Modal 形态与动作 | `SalesMenuPage` 使用 `useSubmissionLifecycle`、`useOverlayLock`；目标 Radio、状态 Radio、reason TextArea、submit Button 使用 target/ref 动态 testId | `MATCHED` |
| candidate 与 selected snapshot | draft 由 Catalog task read 提供 `skuCandidates`/`catalogOrderOptions`，保存快照由 SalesMenu owner 解析；published 只从 SalesMenu snapshot 读，不从当前 Catalog 补写 | `MATCHED` |
| UI 文案与边界 | required、optional 零选择、stale 唯一 SKU、人工与库存独立、恢复不改库存均有用户可见文案；失败不关闭/不清空表单 | `MATCHED` |
| owner 事务与 no-partial-write | update/publish/manual 是 REQUIRED transaction；校验在删除/重插 snapshot 前完成；typed problem 在 owner 侧产生 | `MATCHED` |
| migration identity | option group/value snapshot 有 parent FK、PK、display-order unique/check、published immutable trigger；manual current/event 有 target kind/ref 与旧 ITEM 结构回填 | `MATCHED` |
| HTTP/契约/生成链 | 手写 `sales-menu.schemas.json` 是 source；target/selection/problem 已进入 materialize/codegen/generated edge/RTK/binding；未手改 generated | `MATCHED` |
| owner boundary | SalesMenu 只 task-read Catalog/Inventory，不直写别的 schema；本批未触碰 Catalog backend admittedShapes、TDP、部署/UAT | `MATCHED` |
| 错误与审计 | `SALES_MENU_SKU_REFERENCE_INVALID`、option 三类 typed problem、`SALES_MENU_MANUAL_TARGET_INVALID` 已映射；operation record 保存真实 targetRef、targetKind、resolved display snapshot；reason 不记录敏感值 | `MATCHED` |

## 3. fixture、acceptance、L2 与 seed 对账

| 工件 | 逐项核对 | 结果 |
| --- | --- | --- |
| Catalog fixture | LATTE 有两个 ENABLED SKU，同时保留 DISABLED/VOIDED；CAESAR required/optional option assignment 遵守当前 Catalog owner 的 SINGLE/MULTIPLE 约束；未修改 admittedShapes | `MATCHED` |
| Backend acceptance | 新场景位于既有 `SalesMenuAcceptanceScenarios.java`；覆盖 repeat SKU subset、option subset、required/optional、三类 target、detach、inventory independence、missing/extra/duplicate/required-empty，以及 value-level duplicate/unknown red mutations、DISABLED/VOIDED save/publish | `MATCHED_AFTER_REPAIR` |
| SalesMenu seed | plan/executor 使用真实 Catalog readback refs；显式 SKU subset 与 per-SKU price；显式 option subset；manual target 使用 published refs；无 SQL/fixture fallback | `MATCHED` |
| L2 fixture | DIRECT 使用 required+optional options；SKU candidate 有两个 SKU 且同一 Catalog candidate 在同一 case baseline 中出现两次；MANUAL candidate 有两个 SKU child target | `MATCHED` |
| L2 bootstrap | 已修复 baseline 聚合点：同一 fixture definition 内的显式重复不再被 `includes` 压缩；不同 case source 仍按 source id 聚合 | `MATCHED` |
| L2 controls | blueprint、generated bindings、spec 与 production `salesMenuTestIds.ts` 的新增/扩展控制保持一致；manual case 已改为通过 DIRECT candidate 的 `ORDER_OPTION_VALUE` target，未使用 role/文本/index/CSS/XPath locator | `MATCHED_AFTER_REPAIR` |
| dynamic boundary | backend acceptance 已有 business/cleanup PASS；browser L2 在受管远端 middleware/DB/tunnel 边界连续首败，未形成 full business PASS；reset/reseed 未执行，DEV 保持关闭 | `BLOCKED_EXTERNAL_RUNTIME` |

### 3.1 受管动态证据与首败保留

| Run | business | cleanup | first failure / broken boundary | 诊断结论 |
| --- | --- | --- | --- | --- |
| `.runtime/backend-acceptance/backend-acceptance-1786632597738-b5a9c7c6/run-manifest.json` | `PASS`（contract/business/performance） | `PASS` | none | backend acceptance 已真实完成；该证据不替代 browser L2 |
| `l2-1788805698523-73261-cd17f86e-c08c-4529-af51-056a4854df6b` | focused `NOT_RUN` | `PASS` | pre-correction `SALES_MENU_L2_OPERATION_REQUEST_BUDGET_EXCEEDED` on `sales-menu-edit-sku-prices` | blueprint exact budget 已由 3 修正为 4；focused static regression `70/70`，未改 timeout |
| `l2-1788806673323-93623-66c1de6e-8abc-4f5f-86c4-70a94ceda4be` | `FAIL` | `PASS` | `L2_OWNER_HTTP_NETWORK` at `MENU-10` | local 30,001 ms abort；server completion HTTP 201/38,449 ms，remote DB/middleware latency |
| `l2-1788807520300-11447-6de879b6-d590-4b5f-a14f-86033d0ac89b` | `FAIL` | `PASS` | `L2_PROCESS_READINESS_TIMEOUT` | Spring/Flyway stalled during remote migration before ready marker |
| `l2-1788811845727-98640-7ada1b0d-2063-4189-845d-d645933caca5` | `NOT_RUN` | recovery `PASS` | `L2_PROCESS_EXITED_BEFORE_READY` | remote SSH timeout/broken pipe；Spring PostgreSQL `08006`/`EOFException`；initial cleanup fail 已按同一 run 受管 recovery 关闭 |

上述动态证据只证明首败、恢复与 cleanup 边界；不证明 full 18-case browser L2、reset/reseed 或 UAT。当前没有受管 L2/DEV 残留。

## 4. 静态复核结论与剩余边界

本对账在吸收 round 2 findings 后没有遗留 `OPEN` 的需求/详设/owning-source 偏移。M-1 已完成最小 UI 修复，N-1/N-2 已补齐静态实现与生成接线；L2 fixture static test、runtime JavaScript syntax check、前端 typecheck/unit、后端 testClasses、backend acceptance business/cleanup 均已取得相应证据。当前仍不能把下列内容写成完成事实：

1. 受管 browser L2 的完整真实 HTTP、页面 action、18-case business/cleanup 结果；
2. 受管 DEV reset/start/seed 的 business/cleanup 结果；
3. Claude implementation review 的结果。

round 2 的原始独立 verdict 仍保持 `NO-GO M=1/S=0/N=2`，并且未启动第三轮；本节只记录作者修复后的 intake 与动态边界。N-1 的 HTTP mutation 已包含在 backend acceptance PASS 中；N-2 的 option-value browser action 已完成 source/fixture 接线，但 full browser L2 未跑通，不能把静态接线写成动态 PASS。

当前唯一安全下一步是待远端 middleware/DB/tunnel 恢复后，按 `cs-managed-runtime-execution` 的 manifest、资源与日志边界从 fresh run 重启 browser-L2 验证；不得通过延长 timeout、重写状态、删除 fixture 或启动 DEV/reset/seed 绕过首败。Catalog backend `admittedShapes` 仍是既定 handoff 欠账，不属于本批修复范围。

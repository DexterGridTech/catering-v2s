# v2s 门店销售菜单目标选择与细粒度沽清 implementation-facing 设计草案

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-requirements-amendment.md
JOURNEY_REFS=doc/decisions/2026-09-07-v2s-sales-menu-target-selection-availability-journey-amendment.md
IA_REF=doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-ia-amendment.md
BASELINE_DESIGN=doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md
TEMPLATE_REF=doc/decisions/templates/implementation-design-template.md
STATUS=READY_FOR_IMPLEMENTATION_AFTER_ROUND_2_REPAIR
AUTHORIZED=本 Journey 的生产代码、契约生成、Flyway、测试、fixture/seed、backend acceptance、browser L2 与受管 reset/reseed；不扩大产品/Journey/权限/operation/数据模型范围
NOT_AUTHORIZED=Catalog backend admittedShapes enforcement；apps/terminal 或 TDP；部署、切流、UAT；任何未由本 Journey 直接授权的动态动作
IMPLEMENTATION_AUTHORITY=true
INDEPENDENT_SUBAGENT_REVIEW=ROUND_2_COMPLETE_NO_GO_AUTHOR_REPAIRED
AUTHOR_SELF_DECISION=IMPLEMENTATION_MAY_PROCEED_AFTER_ACCEPTANCE_REPAIR
```

> 本文把两个用户问题落到完整业务闭包，尚不是实施完成声明。所有生成文件由唯一 generator 产生；本轮不写生产实现。

## 1. 真实问题与方案

现有实现把“商品的全部候选事实”误当成“本销售项的全部销售目标”，并把“销售项人工状态”误当成“每个可销售目标的人工状态”。因此：

- UI 没有 SKU checkbox，虽然 owner 已有 `sales_version_item_sku` 子集存储；
- option 只有 Catalog 当前 read-only projection，没有 menu-owned selected snapshot；
- manual table/command/readback 只含 `salesItemRef`，不能表达 SKU/value target；
- seed 全量选两个启用 SKU，但没有证明选择子集，也没有 option selection 和 child status。

推荐最小方案是：**复用 SKU 选择的 owner 模式，增加 normalized option snapshot；用 typed target identity 扩展同一 manual status command/readback。** 不新增一组平行 operation，不把业务事实压回 JSON 或前端。

方案取舍：

- A：为每个 SKU/选项值复制商品，拒绝，破坏 Catalog owner 与同商品多 SalesItem 语义。
- B：前端隐藏 child，拒绝，不是权威状态，不能约束真实 HTTP/前台。
- C：JSON blob，拒绝，无法稳定查询/复制/审计/集合读回。
- D：typed target + normalized snapshot，采用，改动集中在 SalesMenu owner，能用集合读和发布事务证明闭包。

**我选了 D 而不是 A/B/C，因为 D 是同时满足目标选择、发布冻结、目标级审计和 owner 边界的最小可验证方案。**

### 1.1 CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-00 | 契约与生成链 | edge contract/platform catalog | source schema、error/operation registration、generated equality | 需求/IA/交互 review |
| CP-01 | SalesMenu domain/schema | sales-menu owner | option snapshot、target identity、事务/readback、Flyway | CP-00 wire shape |
| CP-02 | HTTP/权限/read model | operations edge + owner | body mapping、typed problem、set-read、operation record | CP-01 |
| CP-03 | backend acceptance | backend-acceptance | SKU/option/target/inventory business scenarios | CP-00..02 |
| CP-04 | operations-admin | operations-admin | Drawer、target Modal、state/invalidation/testId | CP-00..02 |
| CP-05 | browser L2 | shared runner | approved P1、generated locator/action、业务/cleanup proof | CP-03..04 |
| CP-06 | fixture/seed | Catalog + sales-menu seed | exact selector、subset/status matrix、parent readback | CP-01..03 |
| CP-07 | overall reconciliation | whole batch | generated/static/dynamic/business/cleanup/三维对账 | CP-00..06 |

## 2. 领域模型与数据事实

### 2.1 草稿/发布内容

保留现有 `SalesMenuSaleContent.skuPrices` 作为 SKU 选中子集快照，并新增菜单拥有的 option selected snapshot：

```text
SalesMenuSaleContent
  kind
  listedPriceCents
  skuPrices[]                         // SKU_SELECTION 时非空
  selectedOrderOptions[]              // DIRECT 时按经营入口纳入集合；不是顾客订单选择
  salesUnit                         // Catalog read-only

SalesMenuSelectedOrderOption
  definitionRef, name, selectionMode, displayOrder
  required, minSelectionCount, maxSelectionCount
  values[]

SalesMenuSelectedOrderOptionValue
  definitionValueRef, name, displayOrder, defaultValue, extraPrice
```

`selectedOrderOptions` 是 SalesMenu owner 在保存/发布时根据 Catalog 当前 facts 解析出的 snapshot，不接受客户端 name/price/constraint 作为权威。

Draft readback 同时需要候选事实给编辑器：

```text
SalesMenuDraftItemView
  catalogOrderOptions[]    // 当前 Catalog 全量候选，原 orderOptions 重命名
  skuCandidates[]          // 当前 Catalog status=ENABLED 的可选 SKU 候选
  staleSelectedSkuRefs[]   // 已保存但当前变为 DISABLED/VOIDED 的 SKU，仅用于终态提示
  saleContent.selectedOrderOptions[]
```

当 `staleSelectedSkuRefs` 覆盖了该 SalesItem 唯一已保存 SKU，且 `skuCandidates` 为空时，这是终态而不是 Drawer 内可修复状态：保存与发布均保持不可用，提示“请删除该销售项，或在 Catalog 恢复此 SKU”。不提供在 Drawer 内恢复 Catalog 状态、替换为未知 SKU 或静默删除 stale row 的动作。

Published readback 只暴露已发布菜单事实：

```text
SalesMenuPublishedItemView
  saleContent.selectedOrderOptions[]
  manualSaleStatus         // ITEM target
  manualSaleTargetStatuses[] // SKU / ORDER_OPTION_VALUE targets
```

不再把当前 Catalog 全量 `orderOptions` 作为 Published 菜单销售事实，避免 Catalog 后续改值悄悄改写已发布菜单。

### 2.2 option snapshot 表

新增 owner 表（名称按现有 schema 命名规范落地）：

```text
sales_version_item_order_option
  version_ref, sales_item_ref, definition_ref
  resolved_definition_name, selection_mode, required
  min_selection_count, max_selection_count, display_order
  PRIMARY KEY (version_ref, sales_item_ref, definition_ref)

sales_version_item_order_option_value
  version_ref, sales_item_ref, definition_ref, definition_value_ref
  resolved_value_name, display_order, default_value, extra_price
  PRIMARY KEY (version_ref, sales_item_ref, definition_ref, definition_value_ref)
  FK to option group snapshot/version/item
```

每个提交的 Catalog option definition 都有一行 group；optional 且未纳入值时 group 保留、value 行为零，这是合法的菜单销售定义事实，不表达终端是否渲染。required 组必须至少有一个 value 行。发布复制 group/value snapshot，并由 published-child mutation trigger 保护不可变边界。

### 2.3 manual target identity

对既有 `sales_menu.sales_manual_status_current` 与 event 表新增：

```text
target_kind VARCHAR NOT NULL CHECK (ITEM | SKU | ORDER_OPTION_VALUE)
target_ref  UUID NOT NULL
PRIMARY KEY (sales_item_ref, channel_ref, target_kind, target_ref)
CHECK (target_kind <> ITEM OR target_ref = sales_item_ref)
```

实现采用一份 target identity，不建立三份 current 表；Catalog ref 不建跨 schema FK，SalesMenu owner 在 command 内验证 published snapshot membership。发布只删除不再属于新 published set 的 child current status row，不写额外 detach event；`event_kind` 保持 `SOLD_OUT` 与 `RESTORED` 两个值。旧 item event 通过 `ITEM + salesItemRef` 表示。

## 3. Contract source 与生成链

只修改手写 source，随后重生成：

1. `contracts/openapi-source/sales-menu.schemas.json`
   - 新增 `SalesMenuOrderOptionSelectionInput`。
   - `SalesMenuSaleContentInput` required 加 `orderOptionSelections`。
   - `SalesMenuSaleContent` required 加 `selectedOrderOptions`。
   - 新增 `SalesMenuSelectedOrderOption`、`SalesMenuSelectedOrderOptionValue`、`SalesMenuManualSaleTarget`、`SalesMenuManualSaleTargetStatus`、`SalesMenuSkuCandidate`。
   - `SalesMenuDraftItemView.orderOptions` 改为 `catalogOrderOptions`，新增只含 `ENABLED` candidate 的 `skuCandidates`；如需修复并发失效草稿，增加 `staleSelectedSkuRefs` 读回字段。
   - `SalesMenuPublishedItemView.orderOptions` 移除，新增 `manualSaleTargetStatuses`。
   - `SalesMenuManualSoldOutRequest`/`SalesMenuManualRestoreRequest` required 加 `target`。
   - publication blocker 增加 option reference/selection problem kind（使用 error catalog 的 canonical code）。
2. `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`、placement/error/catalog registry：登记 source shape、operation request/response、typed problems 和 owner/recheck。
3. 运行既有 materialize/codegen/binding：
   - `scripts/generate/r5-edge-materialize.mjs`
   - `scripts/generate/edge-codegen.mjs`
   - `scripts/generate/operation-handler-bindings.mjs`
4. 生成物只读回核对：backend wire records、OpenAPI、operations-admin RTK/types、route registry、operation identity budget。

不手改 `apps/backend/.../edge/generated/**`、`apps/frontend/operations-admin/src/app/api/generated/**` 或 registry generated 输出。

## 4. Backend owner 设计

### 4.1 Domain/input

- `SalesMenuSaleContentInput` 增加 `List<SalesMenuOrderOptionSelectionInput>`。
- 增加 typed domain records：选项选择输入、resolved selected option group/value、manual target。
- `SalesMenuEdgeSupport.saleContent(...)` 只把 UUID refs 与数值映射到 domain；不接受客户端名称/默认值/extraPrice。
- `CatalogOwnerService.salesMenuSkuFacts(...)` 是 SalesMenu task-shaped candidate projection，当前只跳过 `VOIDED`；本批改为只把 `ENABLED` SKU 暴露为可选 candidate，不改变 Catalog 其他通用 SKU 查询对 `DISABLED` 的管理事实表达。
- `SalesMenuOwnerService.authoritativeSkuRows(...)` 同根修复：非空、无重复、属于 item、当前状态必须为 `ENABLED`、standard price readback 一致；`DISABLED`/`VOIDED` 统一返回 `SALES_MENU_SKU_REFERENCE_INVALID`。
- 新增 `authoritativeOrderOptionRows(...)`：批量读 Catalog facts；DIRECT 提交的 definitionRef 集合必须与当前 Catalog definition 集合 exact 相等，缺失、额外或重复 definition 均返回 `SALES_MENU_ORDER_OPTION_SELECTION_INVALID`；检查每个 value ref、required 至少一个暴露值、无重复；optional 的显式空数组仍写入 group snapshot 的 0 value rows；以 Catalog facts 生成 snapshot rows。
- `DIRECT` 允许 option selection，`SKU_SELECTION` 必须 option selection 为空；其他 kind 也必须为空。若 owner 读回到非 `DIRECT` facts 带有 option facts，返回 `SALES_MENU_ORDER_OPTION_SHAPE_UNSUPPORTED` 这一显式失败，不把它静默投影为空；Catalog `admittedShapes` 的后端 enforcement 作为 handoff 欠账登记，不在本批修改。

### 4.2 update transaction

`updateItem` 在一项 REQUIRED transaction 内：

1. 锁定 menu/channel/draft version 并 CAS `expectedVersion`。
2. 读取 item Catalog facts 一次，得到 SKU candidates、option definitions、sales unit、图片事实。
3. 校验 sale shape、SKU 子集、option selection；客户端原始名称/价格只作为非权威输入，不能覆盖 owner facts。
4. 更新 `sales_version_item`、删除并重插 `sales_version_item_sku` 与 option group/value snapshot rows。
5. 处理媒体/ordering 既有逻辑，增加 operation receipt/readback。
6. 递增 draft version，返回 DraftItemView：candidate facts + selected snapshot。

失败时 rollback 全部 child rows；不先删后校验，不把 Catalog/Inventory 写入事务。

### 4.3 publish transaction

发布在现有复制边界中增加 option group/value snapshot：

- draft → published 复制 selected SKU 与 selected option rows；published rows 使用 immutable snapshot。
- publish 前重新验证当前 Catalog target membership 和 status=`ENABLED`，避免草稿长期未发布时选入已 `DISABLED`/`VOIDED`/删除的 ref。
- 发布后 published readback 只用 snapshot，不实时替换名字/选项值；inventory 仍为 task-shaped read overlay。
- 计算当前 published child target set；删除不再属于新 published set 的 child current status，不写额外 detach event；重新加入的新 target 没有 current row，读回为 `NORMAL`。
- 不自动创建新 target status row；无 row 即 `NORMAL`。

### 4.4 status command/readback

保留 operation IDs 与 path，扩 request body：

```text
setOperationsSalesMenuItemSoldOut
  path: salesMenuRef/salesItemRef
  body: target, reason, expectedVersion

restoreOperationsSalesMenuItemSale
  path: salesMenuRef/salesItemRef
  body: target, confirm, expectedVersion
```

owner command 规则：

- `ITEM.ref == salesItemRef`；`SKU.ref` 必须在 published SKU snapshot；`ORDER_OPTION_VALUE.ref` 必须在 published selected option value snapshot。
- target parent 必须与 URL item、channel、published version 同时匹配。
- 先锁 menu/channel/item，CAS，再写 current/event；operation record targetRef 为 target.ref，成功 readback 返回同一 target。
- 页面列表/detail 使用一条集合读：按 page item refs 读取 item current + child target current，禁止 N+1；operation record/readback 同时带 `targetKind` 与脱敏 resolved target display snapshot，历史 child record 不依赖当前 published snapshot 反查。
- `PublishedItemView.manualSaleStatus` 继续表示 ITEM；`manualSaleTargetStatuses` 只列 child targets，按 published display order 稳定排序。

### 4.5 HTTP/权限/错误

- GET 继续按 selected node scope，零新增 read capability。
- update/publish/manual commands 继续 `EDIT_STORE_SALES_MENU` + SalesMenu owner actual-target recheck。
- 新 typed problem 至少包括：
  - `SALES_MENU_ORDER_OPTION_REFERENCE_INVALID`
  - `SALES_MENU_ORDER_OPTION_SELECTION_INVALID`
  - `SALES_MENU_ORDER_OPTION_SHAPE_UNSUPPORTED`
  - `SALES_MENU_MANUAL_TARGET_INVALID`
  - `SALES_MENU_TARGET_STATUS_CONFLICT`（如需要专门区分）
  - operation record 的 `targetKind` 与 resolved target display snapshot 是同一 target identity 的审计字段，不新增平行 operation。
- 原 `SALES_MENU_SKU_REFERENCE_INVALID`、`SALES_MENU_SKU_SELECTION_EMPTY` 保留。
- 所有 problem 进入 error catalog/source，不在 controller 手写字符串；日志遵守脱敏标准，不记录 token、cookie、raw payload。

## 5. Frontend 设计

### 5.1 API/model/state

- 由 generated RTK/types 提供 candidate、selected snapshot、target status 类型。
- `SalesMenuItemEditorDrawer` 将 `skuPrices` state 改为 `selectedSkuPrices`，增加 `orderOptionSelections` state；以 `detail.saleContent` 初始化，不从旧 `detail.catalogOrderOptions` 误判已选。
- `SalesMenuItemDetailDrawer` 展示 selected snapshot；draft 编辑区另外展示 candidate/selected 标识。
- `SalesMenuPage` published status modal 读 `manualSaleTargetStatuses` 并生成 target tree；库存列继续读取 `inventoryAvailability`。
- save command always sends `orderOptionSelections` and `skuPrices`，即使为空也显式发送；不依赖可选字段 fallback。

### 5.2 UI test IDs

在 `salesMenuTestIds.ts` 增加：

```text
itemSkuSelection
itemSkuSelectAll
itemSkuClear
itemSkuOption(skuRef)
itemSkuPrice(skuRef)
itemOrderOptionGroup(definitionRef)
itemOrderOptionValue(definitionRef, valueRef)
itemStaleSkuNotice
statusTarget(kind, ref)
statusTargetState(kind, ref, state)
statusTargetReason
statusTargetSubmit
```

动态部分只用 stable UUID ref，测试 ID 置于真实 checkbox/radio/button/input；不使用 label、placeholder、文本、数组 index、CSS/XPath。

## 6. Test/seed change surface

### 6.1 Backend acceptance

只扩展既有 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`，遵守 active backend acceptance business scenario standard；不新建 route provider/registry。

必须增加/扩展的真实 HTTP business scenarios：

| 场景 | 业务 oracle |
| --- | --- |
| `sales-menu.sku-subset-selection-and-repeat-item` | 同一商品两个 SalesItem 各自选不同 SKU；draft/published readback exact set；不相互覆盖 |
| `sales-menu.order-option-subset-selection` | 普通商品选择 subset；published 只读 selected snapshot，Catalog current candidate 不冒充已选 |
| `sales-menu.child-target-manual-status` | SKU 与 option value 分别沽清/恢复；item/其他 child 状态不变；reason/target audit 正确 |
| `sales-menu.publish-detaches-removed-target-status` | 新发布移除 child，current 清理且不写额外 detach event，重新加入为 NORMAL |
| `sales-menu.target-status-inventory-independence` | inventory AUTO_UNAVAILABLE 与 manual target 同时存在，restore manual 不改变 inventory |
| `sales-menu.selection-negative-boundaries` | 空 SKU、陌生 option ref、required 零值、shape mismatch、陌生 target 全部失败且 DB business facts 不变 |

每个场景必须有非空 identity/fixture/request/businessOracle；CONTRACT/BUSINESS/DB_OPERATIONS 分离；按 active standard 指定 `SalesMenuAcceptanceScenarios.java` owning class。

### 6.2 Frontend/static/focused

- `salesMenuUiShared.test.tsx`：selected option display、SKU subset price display、child manual states、inventory/manual independent display。
- `SalesMenuPage.static.test.ts`：real action node testId、status target tree、save payload always includes explicit arrays、published view 不读取 current Catalog `orderOptions`。
- `SalesMenuItemEditorDrawer` focused tests：SKU select/unselect/empty validation；option group selection/required validation；failure preserves form。
- architecture/static boundary tests：禁止 `catalogDraft.orderOptions=` 写回 Catalog；禁止文本/index locator；禁止前端本地拼 target ref。

### 6.3 Browser L2 设计入口

后续实现后再修改批准的 sales-menu P1 与 generated case/locator chain，至少覆盖：

1. SKU 候选中只选一个，保存并读回。
2. 同商品第二 SalesItem 选择另一 SKU，确认两个 published item 都存在且目标不串。
3. 普通商品取消一个 option value，保存/发布，确认前台仅展示 selected snapshot。
4. 目标状态 Modal 对 child 设置沽清/恢复，确认父项和其他 child 不变。
5. inventory auto unavailable 与 manual restore 独立。

本轮没有执行 browser L2；在实现和 testId 落地前，`L2_SCRIPT_ADMISSION=BLOCKED`，不能以静态文档代替动态证明。

### 6.3a L2 脚本开发前 UI/testId 前置复核

```text
UI_DESIGN_REVIEW=ACCEPTED_2026-09-07
TESTID_DESIGN_DENOMINATOR=READY
TESTID_IMPLEMENTATION_REVIEW=OPEN
L2_SCRIPT_ADMISSION=BLOCKED
```

本轮是 UI-bearing 设计，Dexter 已接受线框与交互边界；fresh independent subagent blind review 仍待执行。因此在实现和 focused/static proof 完成前不写 L2 spec、runner adapter、locator binding 或 blueprint action。实施前必须逐行盘点以下 action denominator，补齐实际节点与 focused/static proof：

| case/action | UI owning source | testId source | 实际动作节点 | L2 状态 |
| --- | --- | --- | --- | --- |
| SKU 勾选/取消 | `SalesMenuItemEditorDrawer.tsx` | `salesMenuTestIds.ts:itemSkuOption(skuRef)` | `Checkbox` action node | `OPEN` |
| SKU 选择全选 | `SalesMenuItemEditorDrawer.tsx` | `itemSkuSelectAll` | `Button` action node | `OPEN` |
| SKU 选择清空 | `SalesMenuItemEditorDrawer.tsx` | `itemSkuClear` | `Button` action node | `OPEN` |
| SKU 逐项挂牌价 | `SalesMenuItemEditorDrawer.tsx` | `itemSkuPrice(skuRef)` | `InputNumber` native input | `OPEN` |
| option group scope | `SalesMenuItemEditorDrawer.tsx` | `itemOrderOptionGroup(definitionRef)` | `fieldset` semantic scope, not action | `OPEN` |
| option value 勾选 | `SalesMenuItemEditorDrawer.tsx` | `itemOrderOptionValue(definitionRef,valueRef)` | `Checkbox` action node | `OPEN` |
| stale SKU 终态提示 | `SalesMenuItemEditorDrawer.tsx` | `itemStaleSkuNotice` | `Alert` message node, not action | `OPEN` |
| 保存销售项 | `SalesMenuItemEditorDrawer.tsx` | 既有 `itemSave` | `Button` action node | `OPEN` |
| 选择状态 target | `SalesMenuPage.tsx`/status modal | `statusTarget(kind,ref)` | `Radio`/等价真实选择节点 | `OPEN` |
| 选择状态 | `SalesMenuPage.tsx`/status modal | `statusTargetState(kind,ref,state)` | `Radio` action node | `OPEN` |
| 填写原因 | `SalesMenuPage.tsx`/status modal | `statusTargetReason` | `Input.TextArea` native input | `OPEN` |
| 提交状态 | `SalesMenuPage.tsx`/status modal | `statusTargetSubmit` | `Button` action node | `OPEN` |

任一 action 仍为 `OPEN`，L2 admission 保持 BLOCKED；不得用 role、label、placeholder、text、index、CSS/XPath 或 wrapper 补偿。

### 6.4 Seed

由 `scripts/dev/sales-menu-seed-plan.mjs` / `sales-menu-seed-executor.mjs` 扩展，Catalog prerequisite 继续来自 `catalog-inventory-seed-plan.mjs`：

- SKU：当前 fixture 只有 `LATTE-001` 且仅有一个 `ENABLED` SKU，不能支撑两个互斥非空 SKU subset；实施 CP-06 必须在 Catalog fixture generator/source 中增加第二个 `ENABLED` SKU（并保留至少一个 `DISABLED` 与一个 `VOIDED` 反例），再由两个 SalesItem 各选一个。不得把 `DISABLED` 当作第二个可选 SKU，也不得继续引用不存在的 `BEV-LATTE-001`/`PASTA-BOLOGNESE-001`。
- 普通 option：Catalog fixture generator/source 中必须有一个 `required=true` 且 `minSelectionCount=1` 的 `CAESAR_DRESSING` assignment，同时保留 optional assignments 做零选择对照；sales-menu seed 运行时由 Catalog readback 解析 definition/value ref/name/price，不在 plan 复制 Catalog 定义。现有 selector denominator 的任何替换都必须同步 plan exact-set test 和 executor expected readback。
- child status：发布后对一个 SKU target 和一个 option value target 做人工沽清、readback、恢复；保留 item-level status 矩阵。
- seed plan 必须说明目标选择与状态期望，executor 只能调用 owner HTTP；不直接写 DB，不复用 acceptance/L2 fixture。
- seed static self-test 增加 red mutation：清空 SKU subset、将 option ref 换成别的 definition、移除 child target、把 target kind 改错，均必须 fail closed。

## 7. 横切机制、operation 规模与 owner 边界

### 7.1 复用机制矩阵

| 机制 | 复用现有能力 | 本批如何扩展 | 证明方式 |
| --- | --- | --- | --- |
| Catalog candidate task read | `CatalogOwnerApi.readSalesMenuItemFacts(dataNodeRef, brandRef, Set<UUID>)` | 一次读取 SKU/option candidates；不逐目标调用 Catalog | acceptance `DB_OPERATIONS` + owner query test 证明 set-read |
| SalesMenu version snapshot | `sales_version_item_sku`、`copyPublicationRows`、published immutable trigger | 平行增加 option group/value snapshot，并在 publish 复制 | owner integration + migration trigger test |
| Manual status current/event | `manualStatusByItem`、现有 item status command | 扩为 target identity，按 item/page set-read child rows | backend business oracle + no-N+1 observation |
| HTTP contract chain | sales-menu OpenAPI source → materialize → wire/RTK/binding | 新字段/typed problems 只改 source，生成全链 | generator reverse equality + compile |
| Admin overlay/form lifecycle | foundation `adminWideDrawerSurfaceProps`、`useDrawerFormLifecycle`、`useSubmissionLifecycle`、`useDirtyFormLock` | 选择表和 target Modal 使用现有 lock/focus/submission | frontend focused/static test + browser action node |
| Managed dynamic execution | `scripts/test/backend-acceptance`、browser L2、`scripts/dev/seed --profile r5-full` | 扩既有 sales-menu scenario/seed，不复制 runner/fixture | 后续授权后 business/cleanup 分账 |

### 7.2 operation/path/face/collection scale

| 业务动作 | operationId | method/path | 唯一 face | 集合规模与增长驱动 |
| --- | --- | --- | --- | --- |
| 销售项更新 | `updateOperationsSalesMenuItem` | `PUT /api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/draft/items/{salesItemRef}` | `operations-admin` | 一个 SalesItem aggregate；candidate 随 Catalog SKU/option 数增长 |
| 发布 | `publishOperationsSalesMenu` | `POST /api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/publications` | `operations-admin` | 一个 menu draft → 一个 immutable published snapshot |
| item/SKU/option 状态设置 | `setOperationsSalesMenuItemSoldOut` | `POST /.../{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-sold-out` | `operations-admin` | 一次一个 target；target 数随已发布 child 集合增长 |
| item/SKU/option 状态恢复 | `restoreOperationsSalesMenuItemSale` | `POST /.../{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-restore` | `operations-admin` | 一次一个 target；confirm + CAS |
| 草稿/前台读回 | `getOperationsSalesMenuDraftItem` / `getOperationsSalesMenuPublishedItem` | `GET /.../{salesMenuRef}/draft/items/{salesItemRef}` / `GET /.../{salesMenuRef}/published/items/{salesItemRef}?channelRef=...` | `operations-admin` | 一个 aggregate read；列表页 refs 用 set-read，禁止逐行 Catalog/status N+1 |

本批不新增第二个“SKU 沽清”或“选项沽清” operation；目标种类由 typed body 表达，operation record 的 `targetRef` 真实指向目标。

### 7.3 跨 owner 写矩阵

| 事实 | owner | SalesMenu 本批行为 | 禁止 |
| --- | --- | --- | --- |
| Catalog item/SKU/option definition/value、默认价、extra price | Catalog | task-shaped read，保存时重读并解析 snapshot | SalesMenu 直写 Catalog schema 或把客户端名称/价格当权威 |
| Inventory availability/balance | Inventory | published item read overlay | 状态 Modal 恢复/修改库存 |
| BusinessChannel/activation | BusinessChannel | 读取并复用现有发布/入口条件 | 目标状态命令绕过 channel owner |
| SalesMenu selected snapshots/manual current/event | SalesMenu | REQUIRED transaction 内写入 | 其他 owner 直写菜单表 |
| 自定义展示媒体 | Asset owner + 既有 SalesMenu asset command | 仅沿用既有 stage/claim/release 边界 | 为 target selection 新建媒体 owner 或直接改 asset schema |

### 7.4 declaration → transfer → consumption

| 用户/上游声明 | owner transfer/resolve | 下游消费 | 不变量 |
| --- | --- | --- | --- |
| `orderOptionSelections(definitionRef, selectedValueRefs)` | SalesMenu 读取 Catalog facts，写 group/value resolved snapshot | Draft editor 显示 candidate vs selected；published/front 只消费 selected snapshot | 客户端不传 name/price/constraint 权威值 |
| `skuPrices(skuRef, listedPriceCents)` | SalesMenu 读取 Catalog SKU facts，写 selected SKU snapshot | Draft/published price presenter | SKU ref 必须属于当前商品且选中集合非空 |
| `target(kind, ref)` | SalesMenu 校验 published membership，写 current/event | status Modal/front item target state | targetRef 与 URL item/channel/published version 一致 |
| Catalog current facts | Catalog task read | 只作为编辑候选/保存发布校验 | Catalog 后续修改不改 published snapshot |
| Inventory current facts | Inventory task read | 独立 inventoryAvailability | 不推导 manual state，不被 restore 改写 |

## 8. L2 前置 review 与 CP gates

### 8.1 L2 前置 review

本轮 `L2_SCRIPT_ADMISSION=BLOCKED`。实现前/后必须分别检查：

- Journey action 是否真的有业务需要，且没有更简单的现有 action 可复用；
- 每个 checkbox/radio/button/input 是否有来自 `salesMenuTestIds.ts` 的稳定 testId，动态部分只用 stable ref；
- scenario/locator/network/timing source 是否由批准 P1 生成，未手写 path、text、index、CSS/XPath；
- browser 只证明真实 HTTP/owner readback，不把静态文档、seed fixture 或 DEV 环境事实当作 L2 business proof；
- cleanup、failure recovery、inventory/manual 两条事实均有 action/readback。

### 8.2 CP gates

| CP | 失败判定 | 不变量 | 禁止 | 证据与形态理由 | Recall |
| --- | --- | --- | --- | --- | --- |
| CP-00 contract | source/generated/operation identity 不等；typed problem 漏注册 | 唯一 source 到所有 generated | 手改 generated、删字段过门 | generator equality + compile；复用现有 edge chain | requirements §2、IA、contract source |
| CP-01 owner/schema | snapshot 可被 Catalog 后续变更、target 越权、失败半写 | owner transaction + published freeze | 跨 schema DML、JSON fallback | migration/owner integration；normalized rows 可读/可审计 | owner source、backend standard |
| CP-02 HTTP | target/body/permission/readback 不一致 | capability + owner recheck + CAS | 新建平行 status route | real HTTP contract/business；复用现有 route denominator | edge/controller/registry |
| CP-03 acceptance | 只断言 2xx、无 no-write/child oracle | CONTRACT/BUSINESS/DB_OPERATIONS 分离 | direct service、provider 壳 | active scenario standard；按业务闭环而非 route 壳 | acceptance standard |
| CP-04 frontend | 候选与已选混淆、失败清表、测试控件不可定位 | readback authoritative + foundation lifecycle | 本地乐观事实、文本/index locator | focused/static/typecheck；复用 foundation | interaction design/frontend standard |
| CP-05 L2 | action 无稳定 testId、fixture 代 HTTP、cleanup 缺失 | managed chain + business/cleanup 分账 | 第二 runner、删 case 降分母 | generated P1/spec；同 Journey 复用 runner | browser L2 standard |
| CP-06 seed | selector denominator 漂移、全量 SKU 掩盖 subset、child status 不回读 | owner HTTP + parent ordering + cleanup | SQL、start 隐式 seed、复用 L2 fixture | plan/executor static + future managed run | scripts README/seed sources |

## 8.3 业务规则 → owner 判定点

| 规则 | owner 判定点 |
| --- | --- |
| SKU selection 非空 | `SalesMenuOwnerService` update 与 publish 的 authoritative SKU validation |
| SKU ref 属于当前 Catalog item 且可销售 | update 读取 `SalesMenuItemFacts.skus`；publish 再校验 enabled/standard price |
| option definition/value ref 属于当前 Catalog item | update 的 `authoritativeOrderOptionRows`；publish 再验证 membership |
| required option group 至少一个 exposed value | SalesMenu owner；不由前端唯一保证 |
| optional group 可以零 exposed value | SalesMenu owner；零 value 仍保存 group snapshot |
| `DIRECT` 才能有 option selection | sale-content shape validation |
| `SKU_SELECTION` 只能有 SKU selection | sale-content shape validation |
| published target 只能是 item/selected SKU/selected option value | manual command membership validation |
| target parent/channel/version 一致 | command lock + owner recheck |
| reason 必填、restore confirm 必须 true | existing command validation + new target body |
| item/child manual state不级联 | current table keyed by target identity；business oracle |
| inventory 与 manual 独立 | inventory task read 与 manual current 分开；restore 不调用 Inventory command |
| publish 移除 child 不复活 status | publication transaction 清理不再属于新 published set 的 child current row；不写额外 detach event |

### 8.4 owner API 与消费者清单

| owner 方法/能力 | 消费者 |
| --- | --- |
| `CatalogOwnerApi.readSalesMenuItemFacts` | `SalesMenuOwnerService.updateItem`、publication validation、sales-menu readback |
| `SalesMenuOwnerApi.updateItem` | `OperationsSalesMenuController` 的 `updateOperationsSalesMenuItem` binding |
| `SalesMenuOwnerApi.publish` | `OperationsSalesMenuController` 的 `publishOperationsSalesMenu` binding |
| `SalesMenuOwnerApi.setManualSoldOut` | `OperationsSalesMenuController` 的 `setOperationsSalesMenuItemSoldOut` binding、acceptance、seed executor |
| `SalesMenuOwnerApi.restoreManualSale` | `OperationsSalesMenuController` 的 `restoreOperationsSalesMenuItemSale` binding、acceptance、seed executor |
| `SalesMenuOwnerApi.readDraftItem` | draft detail edge、operations-admin editor/detail |
| `SalesMenuOwnerApi.readPublishedItem` | published detail edge、operations-admin status/detail、acceptance/seed readback |
| `SalesMenuOwnerApi.listDraftItems/listPublishedItems` | operations-admin paged tables、acceptance |

没有消费者的方法不得作为本批“预留能力”添加；所有表格中的消费者必须在 implementation/acceptance/seed 变更中逐一回读。

## 8.5 实施前全链同步变更清单

| 变更事实 | 契约/生成源/生成物 | Backend owner/edge/migration | Frontend model/surface/state | focused/static/HTTP/L2 | fixture/seed | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| SKU selected subset | `sales-menu.schemas.json` `skuPrices`；generated OpenAPI/wire/RTK | existing SKU snapshot validation/readback；no new table | editor checkbox + selected price state；detail/published presenter | owner + acceptance exact subset；L2 SKU actions | sales-menu plan/executor distinct subsets | 同步修改 |
| option selected subset | new `orderOptionSelections` and `selectedOrderOptions` generated chain | new option snapshot tables/copy/validation | option group/value controls；selected snapshot display | focused + acceptance + L2 option actions | sales-menu selector replaced with `CAESAR-001`/`MILK-TEA-001` | 同步修改 |
| child manual target | new target request/status types; existing routes | target columns/PK/event; membership/CAS/set-read | target tree/modal/state mapping | acceptance child status/detach/inventory; L2 target actions | executor target sold-out/restore | 同步修改 |
| Catalog candidate facts | existing `SalesMenuItemFacts` read contract | batch task read only | draft candidate models | query/no-N+1 proof | Catalog owner fixture/readback only | 生成/复用派生 |
| inventory/manual independence | existing inventory + manual facts, new child status output | no Inventory write from status | separate columns/copy | acceptance oracle | seed matrix retains inventory stage | 同步修改 |
| testId/action identity | App testId source (not generated) | N/A | new dynamic testIds on real nodes | focused/static then generated L2 | no fixture locator | 同步修改 |
| seed reports/cleanup | seed plan is owner input, no generated contract | owner HTTP only | N/A | seed static + managed business/cleanup | sales-menu plan/executor/tests | 同步修改 |

## 8.6 数据迁移设计

| 迁移 | 加/改什么 | 旧行回填取什么值 | 可否回滚 |
| --- | --- | --- | --- |
| 新 sales-menu Flyway migration | option group/value snapshot tables；manual current/event `target_kind/target_ref`；新 PK/check；published child trigger | 本批不设计历史兼容/业务回填；最终按 reset/reseed 重新物化。若 Flyway 在已有本地库执行，结构迁移只把旧 item 状态确定为 `ITEM + sales_item_ref`，不添加应用层 fallback | 仅由受管 reset/reseed 重建；不得用手工 SQL 回滚生产事实 |

迁移不能依赖 Catalog 跨 schema FK，也不能从 current Catalog 重新猜历史 option selection。旧行的唯一可识别事实只有 item-level manual state，因此结构迁移最多把它标识为 ITEM；child selection/status 必须由新 seed 重新建立。

## 8.7 Seed 数据全集与覆盖判据

| seed 文件 | 受影响事实 | 处置 |
| --- | --- | --- |
| `scripts/dev/sales-menu-seed-plan.mjs` | selector denominator、SKU subset、option subset、target status matrix | 同批改静态唯一 source 与 exact-set tests |
| `scripts/dev/sales-menu-seed-executor.mjs` | update payload、publish readback、manual target commands | 同批改 owner HTTP executor 与 business/cleanup report |
| `scripts/dev/sales-menu-seed-plan.test.mjs` | 旧 plan shape、red mutations | 同批更新 subset/option/target 断言 |
| `scripts/dev/sales-menu-seed-executor.test.mjs` | 旧 payload/operation/readback shape | 同批更新 request/readback/cleanup 断言 |
| `scripts/dev/profiles/sales-menu.json` | stage source binding | 仅在 source/digest 约定变化时更新；默认保留 |
| `scripts/dev/catalog-inventory-seed-plan.mjs` / fixture tests | Catalog fixture 必须提供至少两个 `ENABLED` SKU，并保留 `DISABLED`/`VOIDED` 负向样本；CAESAR/MILK-TEA option facts 仍需按 owning source 复核 | 同批修改 Catalog fixture/seed prerequisite 与 exact tests；不得由 sales-menu seed 复制 Catalog 事实 |

覆盖必须包含：一个 SKU item 单选一个 `ENABLED` candidate、同商品另一 SalesItem 选另一 `ENABLED` candidate、`DISABLED`/`VOIDED` candidate omission 与 direct-ref rejection、一个 ordinary item 暴露 option subset、一个 child target manual sold-out/restore、一个 removed-target detach、一个 item-level manual state、inventory auto unavailable 并存，以及空/陌生 ref/shape mismatch red mutations。Acceptance fixture 与 seed fixture 独立。

## 8.8 验收场景设计

| scenario id | owner 文件 | identity | fixture | request | businessOracle |
| --- | --- | --- | --- | --- | --- |
| `sales-menu.sku-subset-selection-and-repeat-item` | `SalesMenuAcceptanceScenarios.java` | real HTTP operation identities | Catalog item with ≥2 enabled SKU + same product twice | update two SalesItems with disjoint `skuPrices`, publish, read | each published `saleContent.skuPrices[].skuRef` exact and independent |
| `sales-menu.order-option-subset-selection` | same | update/publish/read operations | CAESAR or MILK-TEA option item | `orderOptionSelections` subset | published `selectedOrderOptions` exact; current Catalog candidates not published fact |
| `sales-menu.child-target-manual-status` | same | existing sold-out/restore operation IDs | published SKU + option child targets | target body + reason/confirm/CAS | child state changes only targeted row; audit targetRef/reason |
| `sales-menu.publish-detaches-removed-target-status` | same | update/publish/status/read | first publication with child status, next without child | update subset, publish, read | current row absent and no detach event, re-add NORMAL |
| `sales-menu.target-status-inventory-independence` | same | inventory read + status commands | inventory AUTO_UNAVAILABLE item with selected child | manual child restore | inventory fact unchanged, manual fact changed |
| `sales-menu.selection-negative-boundaries` | same | typed problems | same valid fixture plus mutated refs | empty SKU, wrong option/value, required empty, wrong target, missing option definition, extra option definition, duplicate option definition | 422 typed code and no owner business fact mutation |

`sales-menu.selection-negative-boundaries` 的 HTTP red mutation 必须保持三个 definition exact-set 反例为独立可辨识输入：

- `missing-definition`: 从一个当前 Catalog definition 集合中省略一个 definition（包括省略 optional definition）；断言 `SALES_MENU_ORDER_OPTION_SELECTION_INVALID`，且 draft/version rows、published rows、operation business fact 均不变。
- `extra-definition`: 提交一个当前 Catalog 不存在的 definitionRef；断言同一 typed problem，且无部分写入。
- `duplicate-definition`: 在 JSON 数组中重复同一 definitionRef；断言同一 typed problem，且无部分写入。

这三个反例必须由真实 HTTP request 逐个发送，不能由前端校验替代；acceptance 结果仍按 `CONTRACT`、`BUSINESS`、`DB_OPERATIONS` 分开记录。
| `sales-menu.disabled-sku-is-not-selectable` | same | candidate + update/publish/read | Catalog item with at least two `ENABLED` SKU plus `DISABLED` and `VOIDED` negative samples | omit disabled/voided from candidate; mutate request with each invalid ref | typed `SALES_MENU_SKU_REFERENCE_INVALID`, no draft/publication mutation |

每条场景的 contract/business/DB operations 结果分开；不使用 `response.ok` 作为 business oracle；夹具必须超过目标选择边界，不能只造一条无法区分全量/子集的数据。

## 9. 逐代码与详设对账（实施前置门）

实施 agent 在每个 CP 写入前后，必须用本文件、需求补充、交互详设、原始销售菜单需求/IA/当前 owning source 做同一组双读。对账表至少包含：

| 变更点 | owning source/符号 | 需逐项核对 | 结果 |
| --- | --- | --- | --- |
| Contract | `sales-menu.schemas.json` + generators | 字段、required、enum、operation body、typed problem、generated equality | `MATCHED` / `OPEN` |
| Domain/owner | `SalesMenuSaleContent*`、`SalesMenuOwnerService` | shape、subset、snapshot、事务、CAS、owner recheck | `MATCHED` / `OPEN` |
| Migration | sales-menu Flyway | PK、snapshot FK、immutable trigger、manual target identity | `MATCHED` / `OPEN` |
| HTTP | controller/edge support/registry | path、target、error、authorization、readback | `MATCHED` / `OPEN` |
| Frontend | editor/detail/page/testIds | 真实控件、文案、loading/error/focus、candidate vs selected | `MATCHED` / `OPEN` |
| Acceptance | `SalesMenuAcceptanceScenarios` | 业务 oracle、negative no-write、DB operations | `MATCHED` / `OPEN` |
| Seed | plan/executor/tests | real refs、subset、target status、cleanup | `MATCHED` / `OPEN` |
| L2 | approved P1/locator | action coverage、stable testId、cleanup | `MATCHED` / `OPEN` |

任何 `OPEN` 都阻止进入整批测试；不得用后续 browser 或 Claude review 掩盖实现阶段偏移。

## 10. 本草案的状态

- 这份文件已经覆盖契约、生成链、数据库、owner、HTTP、前端、focused/HTTP/L2、fixture/seed、reset/reseed 与证据边界。
- Dexter 已接受本 Journey 的实现范围并授权进入实施；当前仅保留 fresh independent subagent blind review 这一强制前置复核，不再开启第三轮设计评审。
- 实施前必须明确复核 option snapshot 的 published freeze、target status cleanup、shape matrix、seed candidate 充足性、stale SKU 无候选终态、required option 输入和 no-N+1 readback；实施后按 CP 逐点双读并保留 MATCHED/OPEN 结果。

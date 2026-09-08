# v2s 销售菜单目标选择与细粒度沽清 IA 修订

```text
IA_SCOPE=IA-SM-ITEM-LIST-001,IA-SM-ITEM-001,IA-SM-ITEM-DETAIL-001,IA-SM-SALE-STATE-001
BUSINESS_SOURCE=doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-requirements-amendment.md
JOURNEY_REFS=doc/decisions/2026-09-07-v2s-sales-menu-target-selection-availability-journey-amendment.md
UI_INTERACTION_REF=doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-interaction-design-codex.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-07
IMPLEMENTATION_AUTHORITY=true
```

这是 2026-08-31 销售菜单 IA 的 implementation-facing amendment。它只补齐本 Journey 新增选择、发布快照、目标状态及其不可见行为；原 IA 未被本文件覆盖的页面结构继续有效。本文件不单独构成实施授权。

## 1. IA-SM-ITEM-LIST-001 销售项表修订

| 维度 | 规定 |
|---|---|
| `businessTask` | 在前台菜单中识别销售项当前库存事实和人工销售事实，并打开对应目标状态操作。 |
| `actorAndScenario` | 有门店销售菜单编辑权限的门店运营人员，在查看已发布菜单并临时调整销售状态时到达。 |
| `entryAndSurface` | 既有销售菜单页面的“前台菜单”表；点击销售状态列打开 `IA-SM-SALE-STATE-001`，点击销售项名称打开 `IA-SM-ITEM-DETAIL-001`。 |
| `controlType` | 已发布表格只读库存状态文字；销售状态为可点击的状态入口；不增加独立查看或操作列。 |
| `validationAndError` | 目标状态 Modal 的失败映射见 §5；列表以 owner readback 刷新，不用本地状态推断目标结果。 |
| `accessibilityAndTestId` | 库存与人工状态同时以文字表达；销售状态入口使用 `salesMenuTestIds.statusAction(salesItemRef)`；焦点关闭后回到该入口。 |
| `emptyLoadingErrorStates` | 表格沿用原分页空态/加载态；已发布集合读取失败时保留表格壳和错误提示，不展示旧查询的成功事实，不打开状态 Modal。 |
| `containerBehaviorUnderLoad` | 表格继续固定每页 20 条并由唯一表格容器横向滚动；列头、状态入口和分页不得溢出视口；销售规格多行换行，不改变列对齐。 |

不可见观察：

- `[acceptance]` 仅拥有 A 门店授权的身份请求 B 门店的 published list、published detail 和 manual command，四条边界均返回授权拒绝；任一返回 B 的目标树即缺陷。`[静态]` edge 方法继续调用既有 store/channel 授权与 SalesMenu owner recheck。
- `[静态]` 状态命令成功只失效 published list/detail 的相关 query；不写入或刷新 Inventory owner 数据。`[组件]` status Modal 的成功 readback 同时保留 `inventoryAvailability`。
- `[acceptance]` 一个 published item 的 child target 数增长时，owner 返回完整当前 published snapshot 集合，前端不抽干其他 item 或以 index 切片；`[浏览器 L2]` 仅在获批动态执行时验证可视滚动。
- `[静态]` 列表不得从当前 Catalog `orderOptions` 生成 published 销售规格；published item 只从 SalesMenu immutable snapshot 读已选值。

## 2. IA-SM-ITEM-001 编辑销售项 Drawer 修订

| 维度 | 规定 |
|---|---|
| `businessTask` | 为一个独立 SalesItem 选择可纳入经营入口的 SKU/普通商品选项值集合，并保存菜单挂牌价。 |
| `actorAndScenario` | 有 `EDIT_STORE_SALES_MENU` 的门店运营人员，在草稿菜单分区中编辑一个销售项时到达。 |
| `entryAndSurface` | 草稿菜单某销售项名称进入现有 wide Drawer；Drawer 内依次显示菜单名称、销售内容与挂牌价、适用约束、展示图片。 |
| `controlType` | SKU 使用 ENABLED 候选复选框、全选/清空按钮和已选 SKU 的挂牌价输入；DIRECT 使用每个 Catalog option definition 的值复选框；stale SKU 只读提示；其他基础控件沿用原 IA。 |
| `validationAndError` | 空 SKU、失效 SKU、陌生 option definition/value、required 空选择、非 DIRECT option selection 与版本冲突分别映射到 §5；错误留在 Drawer，不清空未提交选择。 |
| `accessibilityAndTestId` | 每个 Checkbox/InputNumber/Button 使用交互工件 §4.1 的唯一 testId；option group 以 `fieldset/legend` 提供语义；stale 提示不承担动作；键盘可达、状态不只靠颜色。 |
| `emptyLoadingErrorStates` | 详情或 Catalog facts 加载中保留 Drawer 壳且不复用上一个商品候选；读取失败保留未提交表单并禁用保存；无 option 显示“该商品没有可配置销售选项”；无 ENABLED SKU 且无 stale 时显示无可选规格。 |
| `containerBehaviorUnderLoad` | 使用 `adminWideDrawerSurfaceProps` 的宽度与唯一 Drawer 内容滚动；SKU/option 表格在内容区滚动且 footer 固定；长名称/编码在表格内换行或截断提示，不撑宽 Drawer；基础信息与销售内容列基于既有 Drawer 标签列对齐。 |

不可见观察：

- `[acceptance]` update 继续由 SalesMenu owner 在同一 REQUIRED 事务中重读 Catalog facts；客户端提交的名称、默认价、extra price 不得成为保存事实。`[静态]` edge 只映射 refs、挂牌价和 selection 数组。
- `[acceptance]` DIRECT 请求的 `definitionRef` 集合必须与当前 Catalog option definitions **exact 相等**；缺失、额外或重复 definition 均返回 typed problem，optional 缺失不得被当作零选择，显式空数组才写入 group snapshot。`[组件]` required min=1 的空值失败且无任何 child row 变更。
- `[acceptance]` Catalog 将已保存唯一 SKU 改为 DISABLED/VOIDED 后，draft readback 返回 stale ref；无 ENABLED candidate 时保存/发布均失败，Drawer 只引导“删除销售项或在 Catalog 恢复此 SKU”，不提供 Drawer 内修复入口。
- `[静态]` Catalog task-shaped sales-menu facts 只把 `status=ENABLED` SKU 放入候选；`[acceptance]` 直接提交 DISABLED/VOIDED ref 返回 `SALES_MENU_SKU_REFERENCE_INVALID` 且 draft business facts 不变。
- `[静态]` Draft snapshot 的 Catalog definition/value 改变不会替换已保存 selected snapshot；publish 再次校验 SKU status 和 option membership 后才复制 immutable rows。
- `[组件]` save success 只重取当前 draft item/list；save failure 保留表单值；Catalog facts query failure 不发送 update command。
- 本 screen 禁止：Catalog 编辑/恢复控件、SKU/shape/definition/ref 技术标签、编辑 option extra price/default/约束、库存或人工销售状态控件、把未选候选静默提交为已选。

## 3. IA-SM-ITEM-DETAIL-001 前台销售项详情修订

| 维度 | 规定 |
|---|---|
| `businessTask` | 核对已发布 SalesItem 实际纳入菜单的 SKU、option value、挂牌价以及库存/人工事实。 |
| `actorAndScenario` | 门店运营人员在前台菜单中点击销售项名称查看已发布定义时到达。 |
| `entryAndSurface` | 现有只读 detail Drawer；从 published item 名称打开，只有关闭动作；不进入编辑流程。 |
| `controlType` | selected SKU/option snapshot 为只读表格/文本；库存和人工状态为两个独立只读区块；无 Checkbox、Radio、输入框或保存按钮。 |
| `validationAndError` | published detail 读取失败显示错误与重试，保持当前 Drawer identity；不以当前 Catalog option facts 补齐或改写 published snapshot。 |
| `accessibilityAndTestId` | 详情继续使用 `adminDrawerSurfaceProps` 与 `testId(salesMenuTestIds.itemDetail)`；状态区块有可读标题，库存和人工状态不依赖颜色。 |
| `emptyLoadingErrorStates` | published detail 加载中显示读取提示；无 child snapshot 时显示无规格/未配置，不制造空状态控件；错误不显示旧销售项详情。 |
| `containerBehaviorUnderLoad` | 使用唯一 Drawer 内容滚动；SKU/option 详情表在内容区换行，Drawer header/关闭动作不溢出；库存与人工状态两栏在窄视口按既有 Row/Col 规则换行并保持各自标题。 |

不可见观察：

- `[静态]` published detail 只调用 SalesMenu published readback 与 Inventory task read，不调用 Catalog `orderOptions` 作为已发布事实；`[acceptance]` Catalog 在发布后改变 option 名称/值时 published detail 保持原 snapshot。
- `[组件]` selected option group/value 的显示来自 `saleContent.selectedOrderOptions`；未选 Catalog candidate 不出现在详情；selected snapshot 为空时显示明确业务空值。
- `[acceptance]` manual child status 与 inventory auto-unavailable 并存时，详情同时返回两者；restore manual 只改变 manual status readback，不改变 inventory fact。
- 本 screen 禁止：编辑或删除动作、Catalog 当前候选、未发布目标状态控件、将库存和人工事实合并成单一“不可售”。

## 4. IA-SM-SALE-STATE-001 目标状态 Modal 修订

| 维度 | 规定 |
|---|---|
| `businessTask` | 对当前已发布 SalesItem 的一个 ITEM、SKU 或 ORDER_OPTION_VALUE 设置人工沽清或恢复正常销售。 |
| `actorAndScenario` | 有门店销售菜单编辑权限的门店运营人员，在前台菜单销售状态入口临时调整一个目标时到达。 |
| `entryAndSurface` | 既有“销售状态” Modal；目标树列出整个销售项及当前 published snapshot 中的 selected SKU/option value；一次保存只提交一个目标。 |
| `controlType` | 目标选择 Radio、目标状态 Radio、沽清原因 TextArea、保存/取消 Button；目标标签使用业务名称，不能以 ref 或 target 技术词代替。 |
| `validationAndError` | reason 缺失、restore 未确认、CAS 冲突、published target 已移除分别按 §5 处理；失败保留目标和状态选择，成功后按 owner readback 更新该目标。 |
| `accessibilityAndTestId` | 目标与状态选择使用 `statusTarget(kind,ref)`、`statusTargetState(kind,ref,state)`；原因和保存使用 `statusTargetReason`、`statusTargetSubmit`；Modal overlay lock、键盘焦点与 loading 沿 foundation hook。 |
| `emptyLoadingErrorStates` | published snapshot 无 child 时只显示 ITEM；target readback 失败保留 Modal 与选择，不宣称成功；目标被新发布移除时提示刷新 published target tree。 |
| `containerBehaviorUnderLoad` | Modal 使用唯一内容滚动容器，底部操作区固定；目标树按 published display order 稳定排序，长名称换行，不让目标行或操作按钮撑出 Modal/视口。 |

不可见观察：

- `[acceptance]` target membership 必须命中同一 salesItem/channel/published version snapshot；陌生 SKU、未选 option value 和未发布目标均返回 `SALES_MENU_MANUAL_TARGET_INVALID`，不写 current/event。
- `[acceptance]` ITEM、SKU、ORDER_OPTION_VALUE 的 current PK 独立；对 child 沽清/恢复不改变 ITEM、其他 child 或 Inventory；`[组件]` Modal 只发送一个 target。
- `[acceptance]` 成功 operation record 必须带 `targetRef`、`targetKind` 和脱敏 resolved target display snapshot；publish 移除 child 只清理不再属于新 published set 的 current row，不生成 detach event，历史 record 仍可解释。
- `[静态]` status Modal 使用 `useSubmissionLifecycle`、`useOverlayLock`、`testId`；成功后只重取 published item/page 与 operation record 查询，失败不清空选择。
- 本 screen 禁止：对候选但未发布目标操作、批量隐式发出多个 command、恢复库存、写 Catalog、以颜色单独表达人工/库存状态、显示 authorization/token/raw payload。

## 5. 错误语义与界面映射

| problem code | HTTP | 业务规则映射 | 触发界面/owner | 用户可见处理 |
|---|---:|---|---|---|
| `SALES_MENU_SKU_SELECTION_EMPTY` | 422 | SKU_SELECTION 未选择 SKU | 编辑 Drawer / SalesMenu owner | 指向“可售规格”，提示至少选择 1 个；保留表单 |
| `SALES_MENU_SKU_REFERENCE_INVALID` | 422 | SKU 不属于商品、无标准价或当前非 ENABLED | 编辑 Drawer / update 或 publish | 提示规格已不可用；刷新候选；stale 唯一 SKU 引导删除销售项或恢复 Catalog |
| `SALES_MENU_ORDER_OPTION_REFERENCE_INVALID` | 422 | definition/value 不属于当前 Catalog 商品 | 编辑 Drawer / update | 提示选项定义已变化，保留编辑值并要求重读 |
| `SALES_MENU_ORDER_OPTION_SELECTION_INVALID` | 422 | definition exact-set 不成立、重复或 required min 不满足 | 编辑 Drawer / update 或 publish | 指向对应选项组，提示补齐必选值；不关闭 Drawer |
| `SALES_MENU_ORDER_OPTION_SHAPE_UNSUPPORTED` | 422 | 非 DIRECT 携带 option facts/selection | 编辑 Drawer / owner read/update | 提示当前商品形态不支持选项选择，不静默丢弃 |
| `SALES_MENU_MANUAL_TARGET_INVALID` | 422 | target 不属于当前 published snapshot | 状态 Modal / manual owner | 提示发布内容已变化，关闭或刷新后重新选择目标 |
| `SALES_MENU_MANUAL_REASON_REQUIRED` | 422 | SOLD_OUT 没有合法原因 | 状态 Modal / edge/owner | reason 输入获得焦点，保留 target/state |
| `CONFIRMATION_REQUIRED` | 422 | restore 未显式确认 | 状态 Modal / owner | 保留目标和状态，要求确认恢复人工状态 |
| `SALES_MENU_VERSION_CONFLICT` | 409 | 草稿/状态 CAS 过期 | Drawer 或状态 Modal | 提示权威内容已更新，保留用户选择并要求刷新 |
| `SALES_MENU_PUBLICATION_REQUIRED` | 422 | 对无 published snapshot 的目标状态操作 | 状态 Modal / owner | 不打开或关闭当前目标操作，提示先更新到前台 |

## 6. 交叉对账与完成判定

| 检查 | 判据 |
|---|---|
| IA ↔ 交互工件 | 四个 IA-ID 的入口、Drawer/Modal 形态、SKU/option/target 文案、stale 终态、唯一滚动容器与交互工件 §2-§4 一致。 |
| IA ↔ 详设 | candidate/selected snapshot、exact-set、published freeze、target membership、operation record `targetKind`/display snapshot、refresh 与 forbidden UI 与 implementation design §2-§5 一致。 |
| IA-ID ↔ Journey | `IA-SM-ITEM-001` 对应目标选择与保存，`IA-SM-ITEM-LIST-001`/`IA-SM-SALE-STATE-001` 对应目标沽清，`IA-SM-ITEM-DETAIL-001` 对应发布快照核对。 |
| 计数自证 | `IA_SCOPE` 声明 4 个 IA-ID，本文有 4 个对应小节。 |

```text
IA_DIMENSIONS=IA-SM-ITEM-LIST-001,IA-SM-ITEM-001,IA-SM-ITEM-DETAIL-001,IA-SM-SALE-STATE-001;visible_and_invisible_complete
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=是
FORBIDDEN_UI=explicit_per_surface
TYPED_PROBLEMS=10 mapped
CROSS_CHECK_WITH_DESIGN=PASS_PENDING_DYNAMIC_VALIDATION
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-07
IA_STATUS=IMPLEMENTATION_RECONCILIATION_MATCHED_PENDING_DYNAMIC_VALIDATION
```

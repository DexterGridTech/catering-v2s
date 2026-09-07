# v2s 门店销售菜单目标选择与细粒度沽清交互详设

```text
DESIGN_KIND=UI_INTERACTION_DESIGN
STATUS=DESIGN_ACCEPTED_FOR_IMPLEMENTATION
JOURNEY_REF=doc/decisions/2026-09-07-v2s-sales-menu-target-selection-availability-journey-amendment.md
REQUIREMENTS_REF=doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-requirements-amendment.md
IA_BASELINE=doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md
INTERACTION_BASELINE=doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-07
IMPLEMENTATION_AUTHORITY=true
INDEPENDENT_SUBAGENT_REVIEW=ROUND_2_COMPLETE_NO_GO_AUTHOR_REPAIRED
AUTHOR_SELF_DECISION=IMPLEMENTATION_MAY_PROCEED_AFTER_ACCEPTANCE_REPAIR
```

## 1. 交互原则

- 选择发生在 SalesItem 编辑 Drawer；Catalog 页面仍负责维护 Catalog SKU/选项定义。
- 状态发生在 published SalesItem 的同一状态 Modal；用户先看清目标层级，再提交单一目标。
- 页面永远显示 owner 读回的 candidate、selected snapshot、manual state 与 inventory state，不用本地数组充当事实。
- 复用 `libraries/frontend/admin-ui-foundation`：`adminWideDrawerSurfaceProps`、`useDrawerFormLifecycle`、`useSubmissionLifecycle`、`useDirtyFormLock`、`testId`。不在 App 里重新造 Drawer/overlay/提交生命周期。

## 2. 屏幕 A：编辑销售项 Drawer

### 2.1 Surface contract

| 字段 | 规定 |
| --- | --- |
| `UI_SURFACE` | `SalesMenuItemEditorDrawer` 的现有 wide Drawer |
| `HOST_AND_ENTRY` | 门店销售菜单 → 草稿菜单 → 某分区 → 某销售项 → 编辑 |
| `ACTOR` | 有 `EDIT_STORE_SALES_MENU` 的门店运营人员 |
| `BUSINESS_SCENARIO` | 决定本 SalesItem 暴露的 SKU/选项集合并维护菜单挂牌价 |
| `BUSINESS_GOAL` | 保存后可读回 exact selected set；发布后 immutable |
| `USER_VISIBLE_COPY` | “可售规格/选项”“已选择 N 项”“至少选择 1 个规格”“必选选项组至少保留 1 个选项值” |
| `TECHNICAL_BOUNDARY` | candidate 来自 Catalog task read；save 只发送 ref 与挂牌价；owner 重读并快照 |
| `FOUNDATION_PRIMITIVE` | `adminWideDrawerSurfaceProps`、`useDrawerFormLifecycle`、`testId` |
| `CONTAINER_LAYOUT` | Drawer header → 基本信息 → 销售内容 → 适用约束 → 展示图片；内部区域滚动，footer 固定取消/保存 |

### 2.2 SKU 商品区域

当 `productShape=SKU`：

```text
销售内容与挂牌价
┌──────────────────────────────────────────────────────────────┐
│ 销售方式：按规格销售                                           │
│ 已选择 1/3 个规格                         [全选] [清空]         │
│ ┌─┬──────────────┬──────────┬────────┬───────────────┐        │
│ │□│ 规格名称       │规格编码   │商品默认价│菜单挂牌价       │        │
│ ├─┼──────────────┼──────────┼────────┼───────────────┤        │
│ │☑│ 小杯拿铁       │LATTE-S   │¥28.00  │[¥] [28.00]     │        │
│ │□│ 中杯拿铁       │LATTE-M   │¥32.00  │—              │        │
│ │□│ 大杯拿铁       │LATTE-L   │¥36.00  │—              │        │
│ └─┴──────────────┴──────────┴────────┴───────────────┘        │
│ 未选规格不会进入本销售项；新建 SKU 不会自动进入。                 │
└──────────────────────────────────────────────────────────────┘
```

- 复选框放在真实 checkbox action node，动态 testId 以 `skuRef` 为业务稳定键。
- 未选行的挂牌价输入禁用且不提交；重新勾选时恢复该行候选/已保存值，最终以整表提交为准。
- 新的 candidate table 只展示 Catalog status=`ENABLED` 的可选规格；`DISABLED`/`VOIDED` 不作为可勾选 candidate 返回，避免用户把停用规格加入顾客菜单。
- 若当前 draft 已保存的 SKU 后来变为 `DISABLED`/`VOIDED`，该行只能作为“已选但当前不可用”的 stale selected row 读回并置为不可操作，提示用户移除；保存/发布前由 owner 再次拒绝，不静默删行。
- 若某 SalesItem 只保存了一个 SKU，且该 SKU 后来失效并没有任何 `ENABLED` candidate，Drawer 显示终态提示“请删除该销售项，或在 Catalog 恢复此 SKU”；保存/发布保持不可用。Drawer 不提供修复 Catalog 状态或把失效 SKU 重新选入的动作。
- SKU 选择为非空集合；保存按钮在客户端可做即时提示，但 owner 仍必须做最终校验。

### 2.3 普通商品选项区域

当 `productShape=ORDINARY` 且 Catalog 有选项：

```text
销售内容与挂牌价
┌──────────────────────────────────────────────────────────────┐
│ 销售方式：普通销售商品                         菜单挂牌价 [¥] │
│ 可售选项                                                     │
│ 酱汁（单选，非必选）                         已选择 2 项       │
│   ☑ 凯撒酱       +¥0.00        ☑ 少酱       +¥0.00           │
│ 加料（多选，每单最多 2 项）                     已选择 3 项     │
│   ☑ 培根         +¥2.00        ☑ 鸡蛋       +¥1.00           │
│   ☑ 鸡胸肉       +¥3.00                                      │
│ 选项值加价由商品目录维护，本处不可编辑。                         │
└──────────────────────────────────────────────────────────────┘
```

- 每个 Catalog option definition 一组；值按 Catalog `displayOrder` 展示。
- group `required=true` 且选中值为空时显示组级错误；optional group 可以清空，表示本销售项在该经营入口不纳入该组的任何选项值，不表达终端是否渲染。
- `selectionMode` 只作为说明，不限制菜单暴露值数量；`MULTIPLE max=2` 的说明是顾客每单最多选择 2 项。
- 提交值为 `definitionRef` + `selectedValueRefs[]`，不从表单提交 name、extraPrice、defaultValue 或约束。
- 无选项普通商品显示“该商品没有可配置销售选项”，仍可维护普通挂牌价。

### 2.4 Drawer 状态与失败恢复

- candidate query loading：保留 Drawer shell，展示 loading skeleton；禁止用旧商品的 candidate 候选填充当前商品。
- candidate query failure：展示 Catalog facts 读取错误和“重试”，保存按钮禁用；已编辑未提交内容保留。
- save 422 typed problem：把错误映射到具体 SKU/选项组/选项值；不关闭 Drawer、不清空用户输入。
- save conflict：提示“销售项已被其他操作更新，请刷新后重新编辑”，保留用户草稿但必须重新读权威版本。
- save success：关闭 Drawer，刷新 draft item detail/list；不声称已发布。

## 3. 屏幕 B：已发布目标状态 Modal

### 3.1 Surface contract

| 字段 | 规定 |
| --- | --- |
| `UI_SURFACE` | 现有 published item “销售状态” Modal 扩展为目标列表 |
| `HOST_AND_ENTRY` | 前台菜单 → 某销售项 → 销售状态操作；详情 Drawer 复用同一入口 |
| `ACTOR` | 有 `EDIT_STORE_SALES_MENU` 的门店运营人员 |
| `BUSINESS_SCENARIO` | 某一商品/规格/选项临时人工沽清或恢复 |
| `BUSINESS_GOAL` | 只改变一个 target 的人工状态，并读回目标审计事实 |
| `USER_VISIBLE_COPY` | “销售状态”“整个销售项”“规格”“销售选项”“库存状态是独立事实，本弹窗不能恢复库存自动不可售” |
| `TECHNICAL_BOUNDARY` | target candidate 只能来自 published snapshot；command 保留 CAS/reason/confirm |
| `FOUNDATION_PRIMITIVE` | `useSubmissionLifecycle`、`useOverlayLock`、`testId` |
| `CONTAINER_LAYOUT` | Modal 内目标树可滚动；目标行状态操作；底部提交/取消固定 |

### 3.2 状态 Modal wireframe

```text
销售状态                                                  ×
当前销售项：珍珠奶茶 / MILK-TEA-001
库存状态：正常可售（库存状态与人工状态独立）

目标                                  当前状态        操作
○ 整个销售项                           正常销售        [设置沽清]
  销售规格
  ○ 128G                                正常销售        [设置沽清]
  ○ 256G                                人工沽清        [恢复销售]
  销售选项：加料
  ○ 椰果                                正常销售        [设置沽清]
  ○ 仙草                                人工沽清        [恢复销售]

选中目标：销售选项 / 仙草
销售状态   ● 人工沽清  ○ 正常销售
沽清原因   [____________________________]

                              [取消] [保存]
```

- 列表中的“设置沽清/恢复销售”是选择目标并预填状态，不在列表中直接发起多个隐式 command。
- 每次保存只提交一个 `target`；成功后更新该行并保留 Modal 打开，便于连续处理多个 child target。
- item target、SKU target、option value target 使用不同动态 testId；禁止用文本、行序号或 CSS selector 定位。
- 正常销售恢复只对人工状态做 command；如果库存是 `AUTO_UNAVAILABLE`，Modal 明确保持该事实，按钮文案不承诺库存恢复。
- published snapshot 无 child target 时不显示空的 SKU/选项组；不展示未选候选。

### 3.3 状态失败/恢复

- 目标已被新发布版本移除：command 返回 `SALES_MENU_MANUAL_TARGET_INVALID`，关闭/刷新 Modal 后按新的 published target tree 重新操作。
- CAS 冲突：保留已选 target 但刷新其状态与版本，要求用户重新确认。
- reason 缺失：焦点回到 reason 输入，不清除 target/state。
- 网络失败：保留 Modal 和用户选择，显示重试；不把 loading 当成功。
- 成功：以 published item readback 确认 `manualSaleStatus` 或 `manualSaleTargetStatuses`，同时再次确认 `inventoryAvailability` 未变化。

## 4. Foundation 与测试交互

使用的现有 foundation exports：

```text
libraries/frontend/admin-ui-foundation/src/index.ts
- adminWideDrawerSurfaceProps
- useDrawerFormLifecycle
- useSubmissionLifecycle
- useDirtyFormLock
- testId
```

计划新增/扩展 `apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts`：

```text
itemSkuSelection
itemSkuSelectAll
itemSkuClear
itemSkuOption(skuRef)
itemSkuPrice(skuRef)
itemOrderOptionGroup(definitionRef)
itemOrderOptionValue(definitionRef, definitionValueRef)
itemStaleSkuNotice
statusTarget(kind, ref)
statusTargetState(kind, ref, state)
statusTargetReason
statusTargetSubmit
```

每个 testId 必须落在真实可操作节点：checkbox/radio/button/input；不得落在 table row、Card、文本 span 或 Drawer 容器上。

### 4.1 控件与 L2 locator 精确表

下表是新增/扩展控件的唯一分母。`testId` 的字符串由本表固定，动态片段只使用稳定业务 ref；实际实现必须把它直接绑定到表中列出的动作节点或提示节点。

| 控件键 | 精确 testId | 所在真实动作/提示节点 | `COMPOSITE_OPTION_ANCHOR` |
| --- | --- | --- | --- |
| SKU 选择表 | `sales-menu-item-sku-selection` | SKU 选择区的 `Button`（显示已选数量，非行容器） | `否` |
| SKU 全选 | `sales-menu-item-sku-select-all` | SKU 区“全选” `Button` | `否` |
| SKU 清空 | `sales-menu-item-sku-clear` | SKU 区“清空” `Button` | `否` |
| 单个 SKU 选入/取消 | `sales-menu-item-sku-option-${slug(skuRef)}` | 对应 ENABLED/stale 行的原生 `Checkbox` action node | `否` |
| 单个 SKU 菜单挂牌价 | `sales-menu-item-sku-price-${slug(skuRef)}` | 对应已选 SKU 的 `InputNumber` 原生输入节点 | `否` |
| 选项组语义锚点 | `sales-menu-item-order-option-group-${slug(definitionRef)}` | 该组 `fieldset`/`legend` 语义节点，仅用于 locator scope，不承载点击动作 | `否` |
| 单个选项值选入/取消 | `sales-menu-item-order-option-value-${slug(definitionRef)}-${slug(definitionValueRef)}` | 对应选项值的原生 `Checkbox` action node | `否` |
| stale SKU 终态提示 | `sales-menu-item-stale-sku-notice` | Drawer 内 `Alert` 提示节点；非动作，明确引导删除销售项或恢复 Catalog SKU | `否` |
| 状态目标定位 | `sales-menu-status-target-${slug(kind)}-${slug(ref)}` | 状态 Modal 目标树中对应目标的 `Radio` action node | `否` |
| 状态选择 | `sales-menu-status-target-state-${slug(kind)}-${slug(ref)}-${slug(state)}` | 该目标状态的 `Radio` action node | `否` |
| 沽清原因 | `sales-menu-status-target-reason` | 状态 Modal 的 `Input.TextArea` 原生输入节点 | `否` |
| 状态提交 | `sales-menu-status-target-submit` | 状态 Modal 的“保存” `Button` action node | `否` |

本批没有需要 `COMPOSITE_OPTION_ANCHOR` 例外的 Segmented/复合 option 控件；所有可执行动作都绑定直接可标记节点。`fieldset` 与 `Alert` 是语义/提示节点，不被当作可点击控件分母。

## 5. Accessibility 与边界

- SKU/选项值选择控件有可读 label，选项组使用 fieldset/legend 或等价语义；stale selected row 有状态说明，普通 `DISABLED`/`VOIDED` candidate 不进入可选列表。
- 状态目标树使用可读层级，不只依赖缩进或颜色；人工沽清/正常销售有文本状态。
- 打开 Drawer/Modal 后使用 foundation overlay lock，关闭后焦点回到原 action node；未保存变更触发 dirty guard。
- 表格列在窄屏允许内部横向滚动，但不把目标选择压成无法操作的 ellipsis；状态 Modal 的目标列表独立纵向滚动。

## 6. 已裁决约束与实施前复核

1. optional group 允许保存 0 个值；这是菜单销售定义集合事实，不表达终端渲染语义；required group 按 Catalog `minSelectionCount` 至少保留 1 个值。
2. 发布移除 child target 时只删除不再属于新 published set 的 current row，不写 `TARGET_DETACHED_BY_PUBLICATION` 事件；`event_kind` 仍只有 `SOLD_OUT`/`RESTORED`。
3. `SKU_SELECTION` 与 option selection 在本批及后续互斥；Catalog 后端 `admittedShapes` enforcement 登记为 handoff 欠账，本批只实现 SalesMenu 侧显式失败，不静默丢弃。
4. 普通商品选项只读边界已由本 Journey supersede；Catalog 拥有定义事实，SalesMenu 拥有选择集合与发布快照。

`DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-07`。五项实施前修订已写入本工件；fresh independent subagent blind review 仍是本 cycle 的实施前复核，不再开启第三轮设计评审。

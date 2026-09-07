# v2s 门店销售菜单目标选择与细粒度沽清需求补充

```text
DATE=2026-09-07
STATUS=DESIGN_ACCEPTED_FOR_IMPLEMENTATION
BUSINESS_SOURCE=本文件 + doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md
SUPERSEDES=仅 supersede doc/plans/platform/2026-09-07-v2s-sales-menu-specification-display-amendment-codex.md 中“普通销售选项只读”的菜单边界
JOURNEY_REF=doc/decisions/2026-09-07-v2s-sales-menu-target-selection-availability-journey-amendment.md
IMPLEMENTATION_AUTHORITY=true
INDEPENDENT_SUBAGENT_REVIEW=ROUND_2_COMPLETE_NO_GO_AUTHOR_REPAIRED
AUTHOR_SELF_DECISION=IMPLEMENTATION_MAY_PROCEED_AFTER_ACCEPTANCE_REPAIR
```

## 1. 需求背景

当前销售菜单已经有两个不同层次的 Catalog 事实，但菜单 owner 没有把它们表达完整：

1. **SKU 销售项**：Catalog owner 能读到一个商品下的多个 SKU，菜单 owner 的 `sales_version_item_sku` 也能保存选中的 SKU 与每个 SKU 的挂牌价；但 `SalesMenuItemEditorDrawer` 把当前 `skuPrices` 当成完整数据源，没有复选选择列，用户无法建立“同商品 128G 销售项”和“同商品 256G 销售项”两个不同销售项。
2. **普通商品选项**：当前 `DraftItemView.orderOptions`/`PublishedItemView.orderOptions` 是 Catalog 当前选项事实的只读投影，`SalesMenuSaleContentInput` 没有选项选择字段，发布快照也没有菜单自己的选项集合。因此页面只能展示所有选项，不能决定某个菜单销售项暴露哪些选项值。
3. **人工沽清**：`sales_manual_status_current` 的唯一键是 `(sales_item_ref, channel_ref)`，HTTP command 只有 `salesItemRef`，`manualStatusByItem` 也只读销售项级状态。用户可以沽清整个商品，却不能沽清某一个 SKU 或某一个点单选项值。

这不是一个表格控件缺失问题，而是**销售项的可销售目标集合与可售状态都被错误地压缩到了 SalesItem 单层**。如果只改前端，其他 HTTP 消费者仍会看到错误的销售集合，且用户状态无法在 owner、发布、审计和前台读模型中闭合。

## 2. 业务目标

### 2.1 目标一：销售项拥有可编辑的目标集合

- 同一个 Catalog 商品可以被同一个销售菜单重复加入多个 SalesItem。
- `SKU_SELECTION` 销售项必须保存一个非空 SKU 子集；每个已选 SKU 保留独立菜单挂牌价。
- `DIRECT` 普通商品可以保存每个 Catalog 选项定义要暴露的选项值子集；Catalog 仍拥有选项定义、顺序、模式、默认值和加价事实。
- 同一 SKU/选项值可以出现在多个 SalesItem 中；不增加跨销售项唯一约束。
- Catalog 后续新建的 SKU/选项值不自动进入已有草稿或发布快照。
- Catalog SKU 只有 `status=ENABLED` 才属于菜单可选候选；`DISABLED`/`VOIDED` 既不能由 UI 选中，也不能由直接 HTTP 写入草稿或发布版本。

### 2.2 目标二：人工沽清拥有目标粒度

人工状态的规范化身份为：

```text
(salesItemRef, channelRef, targetKind, targetRef)
targetKind = ITEM | SKU | ORDER_OPTION_VALUE
targetRef  = salesItemRef                  when ITEM
targetRef  = selected published skuRef     when SKU
targetRef  = selected published valueRef   when ORDER_OPTION_VALUE
```

- 销售项、SKU、选项值都可以独立设置 `MANUAL_SOLD_OUT` 或恢复 `NORMAL`。
- 目标必须属于当前已发布销售项快照；不能对候选但未发布的目标沽清。
- 父项与子目标不级联，库存事实不被写入或恢复。
- 人工沽清必须有原因；恢复必须显式确认；既有 CAS、授权、审计与 operation record 保持有效。

## 3. 明确业务语义

### 3.1 商品形态矩阵

| 商品形态 | 菜单 `saleContent.kind` | 可选择目标 | 菜单价格 | 本次是否允许 |
| --- | --- | --- | --- | --- |
| 普通销售商品 | `DIRECT` | Catalog 选项定义的选项值子集；无选项时为空 | `listedPriceCents` | 是 |
| 销售属性商品 | `SKU_SELECTION` | Catalog SKU 的非空子集 | 每个 `skuPrices[].listedPriceCents` | 是 |
| 称重/组合/服务 | `WEIGHTED`/`COMPOSITE`/`SERVICE`（按现有枚举） | 不新增目标子集 | 沿用现有规则 | 否 |

`SKU_SELECTION` 与 `DIRECT` 的 option selection 在本批及后续都是互斥的产品形态规则：提交不匹配的组合由 owner 返回 typed problem，而不是由前端静默丢弃字段。Catalog 后端 `admittedShapes` enforcement 是 Catalog owner 的 handoff 欠账，本批不修改；SalesMenu owner 必须先把不匹配输入显式拒绝。

### 3.2 普通商品选项的菜单选择

新增的 `orderOptionSelections` 是**菜单暴露集合**，不是顾客实际下单选择：

```json
[
  {
    "definitionRef": "<Catalog option definition ref>",
    "selectedValueRefs": ["<value ref 1>", "<value ref 2>"]
  }
]
```

- 更新请求必须对当前 Catalog 返回的每个选项定义提交一条 entry；无选项商品提交空数组。
- 提交的 `definitionRef` 集合必须与当前 Catalog 返回的 definition 集合 exact 相等；缺失、额外或重复 definition 都由 owner 返回 typed problem，不由前端默认补齐或静默忽略。
- `selectedValueRefs` 必须无重复，且全部属于同一个 `definitionRef` 的当前 Catalog 值。
- optional 选项组可以提交空数组，表示本销售项在该经营入口不纳入该组的任何选项值；这是菜单销售定义事实，不表达终端是否渲染。required 选项组至少保留一个值。
- `selectionMode`、`required`、`min/maxSelectionCount` 继续由 Catalog owner 管理，不由菜单复制为可编辑字段；它们只作为 owner 校验与 snapshot 的只读事实。
- 一个 `MULTIPLE maxSelectionCount=2` 的组可以暴露 3 个值；这个上限约束顾客每单选择数量，不限制菜单暴露值数量。
- 选项值的 `extraPrice` 只读快照，不新增菜单级覆盖价格。
- 编辑器首次面对新销售项时，使用 Catalog 当前全部值作为候选并按商品语义初始化：若用户未取消，保存全部候选；required/optional 的顾客选择约束仍以 Catalog 事实为准。seed 明确写出期望选择集合，不依赖 UI 默认。

### 3.3 SKU 选择

- 编辑器读取当前 Catalog 中状态为 `ENABLED` 的 SKU candidates，显示 SKU 名称、编码、默认价和当前菜单挂牌价；`DISABLED`/`VOIDED` 不进入新的可选候选集。
- 复选框只作用于选入集合；只有已选行显示可编辑挂牌价。
- 保存要求至少选择一个 SKU；每个已选 SKU 必须有非负整数挂牌价。
- SalesMenu owner 保存和发布复核都要求每个 SKU 的当前 Catalog status 仍为 `ENABLED`；客户端直接提交 `DISABLED`/`VOIDED` ref 必须返回 `SALES_MENU_SKU_REFERENCE_INVALID`，且不得产生部分写入。
- 若已保存草稿目标在后续变为 `DISABLED`/`VOIDED`，draft readback 可以把该行标记为“已选但当前不可用”，但 owner 不得静默删除，也不得继续发布含有该目标的版本；是否存在可用替换由当前 candidate 集合决定。
- 若某 SalesItem 唯一已保存 SKU 后来变为 `DISABLED`/`VOIDED`，且当前已无 `ENABLED` candidate，保存/发布都不可继续；Drawer 只显示“删除销售项或在 Catalog 恢复该 SKU”的终态提示，不提供在 Drawer 内伪造/修复 Catalog 事实的动作。
- 两个 SalesItem 可以分别选择同一个商品的不同 SKU，菜单 owner 不去重、不合并。

本裁决只约束候选、保存和发布时的“选入菜单”行为；已发布 immutable snapshot 在 Catalog 后续变为 `DISABLED` 后是否自动下架，不在本次需求中自动推导。

### 3.4 目标级状态

状态弹窗打开后显示本已发布 SalesItem 的目标树：

```text
整个销售项       正常销售 / 人工沽清
规格
  128G           正常销售 / 人工沽清
  256G           正常销售 / 人工沽清
选项：加料
  椰果           正常销售 / 人工沽清
  仙草           正常销售 / 人工沽清
```

- 只列出当前 published snapshot 的 SKU 和已选选项值；未选候选不显示状态控件。
- 一次状态提交只改变一个 target；同一弹窗切换目标后可以继续操作，成功后逐目标 readback。
- 操作记录同时保存 `targetKind` 与脱敏的 resolved target display snapshot；历史记录不得依赖当前 published snapshot 反查 child target 的业务含义。
- `inventoryAvailability` 和 `manualSaleStatus`/`manualSaleTargetStatuses` 独立展示。库存 `AUTO_UNAVAILABLE` 不能通过“恢复正常销售”被清除。

## 4. 失败与一致性要求

| 场景 | 结果 | 不得发生 |
| --- | --- | --- |
| SKU 选择为空 | `SALES_MENU_SKU_SELECTION_EMPTY` | 保存空 SKU 销售项 |
| SKU ref 不属于商品，或当前 status 不是 `ENABLED`（包括 `DISABLED`/`VOIDED`） | `SALES_MENU_SKU_REFERENCE_INVALID` | 接受客户端名称/价格/status 作为权威，或产生部分写入 |
| option definition/value ref 不属于当前商品 | `SALES_MENU_ORDER_OPTION_REFERENCE_INVALID` | 跨商品拼接选项 |
| required 组无暴露值 | `SALES_MENU_ORDER_OPTION_SELECTION_INVALID` | 发布一个顾客无法选择的必选组 |
| option selection 出现在非 `DIRECT` | `SALES_MENU_ORDER_OPTION_SHAPE_UNSUPPORTED` | 前端静默丢弃字段 |
| target 不是当前 published snapshot | `SALES_MENU_MANUAL_TARGET_INVALID` | 对未发布/未选目标写状态 |
| reason 缺失或超长 | 既有 reason typed problem | 写空审计原因 |
| CAS 版本过期 | 既有 conflict problem | 覆盖并发草稿/状态 |
| 发布移除已有 child target | 发布成功；不再属于新 published set 的 child current target row 被清理；不写额外 detach 事件 | 状态“复活”到下次重新选择；`event_kind` 仍只能是 `SOLD_OUT`/`RESTORED` |
| inventory 不可售 | 只读库存事实继续保留 | 恢复动作写库存 owner |

保存、发布、状态命令都必须在 SalesMenu owner 的 REQUIRED 事务内完成；跨 owner 只调用 Catalog/Inventory 任务读 API，不得直写别的 schema。

## 5. 方案比较与选择

| 方案 | 判断 | 原因 |
| --- | --- | --- |
| A. 为每个 SKU/选项值创建独立 Catalog 商品 | 拒绝 | 污染 Catalog，重复图片/库存/商品事实，不能表达同商品多 SalesItem 的菜单差异 |
| B. 保持 item 级状态，前端隐藏被沽清的 SKU/选项 | 拒绝 | 不是 owner 权威事实，HTTP/前台/其他消费者仍可能售卖；没有目标级审计 |
| C. 用 JSON 在 SalesItem 行内保存 option/SKU/status | 拒绝 | 发布快照、目标查询、CAS、目标清理和 set-based readback 均变成弱类型解析；难以复用现有 SKU snapshot 结构 |
| D. 一个 typed target identity + normalized selection snapshot + 目标状态表 | **采用** | 保持 SalesMenu owner 主权，复用现有 SKU 子集模型，最少新增概念，可做发布冻结、批量读回和目标级审计 |

**我选了 D 而不是 A/B/C，因为 D 同时保持 Catalog 与 SalesMenu owner 边界、支持同商品多销售项、让发布快照真正冻结，并能用一个明确 target identity 覆盖 ITEM/SKU/OPTION_VALUE 三类状态。**

## 6. 验收口径

设计完成后，必须可由后续实现和验证证明：

1. 两个 SalesItem 使用同一 Catalog SKU 商品，各自保存不相交 SKU 子集，发布后两者读回集合独立。
2. `DISABLED`/`VOIDED` SKU 不出现在可选候选集；直接提交任一失效 SKU ref 由真实 HTTP 拒绝，草稿/发布业务事实不变。
3. 一个普通商品的两个选项值分别被两个 SalesItem 选择；发布后 selected option snapshot 与 Catalog candidate 事实分离。
4. 对 published 的 SKU/option value 设置人工沽清，只影响目标状态；同项其他目标和 item-level 状态不变。
5. 发布下一版本移除某个 child target 后，current 状态清理且不写额外 detach 事件；重新加入默认为 NORMAL。
6. 库存自动不可售与目标人工沽清可以同时读回，恢复人工状态不改变库存。
7. 所有负向场景通过真实 HTTP 证明业务事实未写入；seed 重新创建上述矩阵；浏览器从真实 testId 操作，不靠文本/index/CSS。

## 7. 不在本轮执行的事项

本文件已由 Dexter 接受进入实施范围；fresh independent subagent blind review 仍是本 cycle 的实施前复核。实施后才执行代码、契约生成、数据库迁移、reset、DEV、seed、backend acceptance、browser L2；所有动态命令继续按实施计划的受管入口执行，不扩大到 Catalog backend admittedShapes、部署或 UAT。

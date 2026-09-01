# 商品作废的 BOM 引用语义：J-CIB-001 Journey / UI / IA 修订草案

```text
DECISION_STATUS=DRAFT_FOR_REVIEW
JOURNEY_ID=J-CIB-001
UI_BEARING=true
IA_SCOPE=IA-CIB-VOID-01
IMPLEMENTATION_AUTHORITY=false
```

## 1. 修订关系与目标

`doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md` 已接受的 J-CIB-001 负责“配置库存扣减方式与 BOM”。本文件不是另起 Journey，也不推翻已接受的配置交互；它只为同一商品治理入口补充“商品作废时如何解释库存 BOM 关系”的生命周期语义。

现有 `doc/plans/platform/2026-08-26-v2s-catalog-workbench-observed-remediation-plan-codex.md` 的 R-09/R-10 将商品自有 BOM 列为作废 blocker。本修订草案明确指出：那一条与本次用户问题冲突，不能在实现时静默覆盖，必须由本轮 review 明确接受或拒绝。

## 2. 用户任务与成功结果

用户在 operations-admin 的商品详情治理入口查看并执行“作废商品”：

1. 看到当前商品的 catalog 结构化关系与库存引用限制；
2. 能区分“当前商品自己配置了库存/BOM”和“其他商品正在用料引用当前商品”；
3. 若只有自有库存/BOM定义，点击作废后一次提交成功，库存 owner 的有效定义同步变为 `DISABLED`，历史事实保留；
4. 若被其他有效 BOM 用料引用，看到来源商品的可理解摘要，作废操作失败且没有部分写入；
5. 刷新详情后，`status`、`voidAvailability`、阻断原因和库存 owner readback 相互一致。

## 3. 信息架构修订

商品详情的治理内容固定分为两个语义区，不合并：

```text
商品治理
├─ 商品关联（catalog composite inbound/outbound）
│  └─ 没有结构化商品关系时显示“没有与其他商品的关联”
└─ 作废限制（all current blocking facts）
   ├─ 被其他商品用料引用（N 项）
   ├─ 被其他商品组合使用（N 项）
   ├─ 包含规格 / 已设置条码与标识 / 已设置生产标签（已有语义）
   └─ 其他经 owner 明确返回的业务 blocker
```

商品自己的“已配置库存对象 / 已配置用料”不再作为作废限制展示；它们是成功作废时要由 inventory owner 退休的自有定义事实。库存配置编辑页仍可展示这些配置，不把本修订扩展成库存配置 UI 重做。

## 4. 低保真布局与交互

沿用现有商品详情 Drawer、治理 tab 和 `adminWideDetailDescriptionsProps`，不新增页面、不新增弹窗、不新增“先处理 BOM”的中间流程：

```text
┌ 商品详情 / 治理 ───────────────────────────────────────┐
│ 商品关联（0）                                          │
│   没有与其他商品的关联                                  │
│                                                        │
│ 作废限制                                                │
│   被其他商品用料引用（1 项）                             │
│   来源：双人晚餐套餐                                    │
│                                                        │
│ [作废]（无阻断时可用）                                  │
└────────────────────────────────────────────────────────┘
```

交互规则：

- `voidAvailability.canVoid` 和 `blockingReasons[]` 都由后端同一份 owner blocking-facts 派生；前端不从 `references`、`inventoryRules` 或 JSONB 猜测。
- `商品关联` 的 count 仅统计 catalog composite 关系；库存 BOM 入向引用只出现在“作废限制”，避免把两个 count 相加或显示两个同名“依赖”。
- `USED_BY_INVENTORY_BOM` 的用户文案为“被其他商品用料引用”，可附来源商品名称；无法确认名称时后端 typed failure，不显示“暂时无法读取”作为成功 read model。
- own inventory/BOM 只有在 mutation 成功后通过 detail refresh 消失为 active definition；不会在编辑 Drawer 中插入“删除自己的用料”步骤。
- 失败保持当前状态，焦点回到作废操作/错误摘要；不得部分作废 catalog 而留下 inventory active definition，或反向留下孤立 disabled 状态。

## 5. 状态与边界矩阵

| 当前事实 | 治理页显示 | 作废效果 |
| --- | --- | --- |
| 自有 active `stock_target` / `stock_bom` | 不作为 blocker | inventory owner 同事务转为 `DISABLED`，保留定义/余额/流水/历史；catalog 成功转 `VOIDED`。 |
| 其他有效 BOM 行的 `targetRef` 指向当前商品 target | “被其他商品用料引用（N 项）” | fail closed，catalog 与 inventory 均不写入。 |
| catalog composite 被其他商品使用 | 现有“被其他商品使用” | 保持现有阻断。 |
| 本商品包含 SKU、条码、生产标签 | 现有业务 blocker | 保持现有语义，本修订不把它们误归为库存 BOM。 |
| BOM owner/row 为 `DISABLED`、历史快照或不在当前 scope/brand | 不显示 current blocker | 不阻断；历史事实不删除。 |
| active BOM row 命中当前 subject 的 `DISABLED` target，或关系无法唯一解析 | 不把它伪装成普通业务 blocker | typed invariant/mapping failure，fail closed，不写入。 |
| reference path 无法解析、scope 不唯一、owner readback 缺失 | 失败态/不可判断 | typed fail closed；不以空数组或 false-green 继续。 |

## 6. UI reason / IA contract

现有 `voidAvailability` shape 保留，增量仅为业务 reason：

```text
blockingReasons[].reasonCode = USED_BY_INVENTORY_BOM
blockingReasons[].count      = current-scope active inbound BOM row count
blockingReasons[].relatedItemNames = source catalog item names, when resolved
```

不得把 `stock_bom.item_ref` 当成这个 reason 的 count。`references[]` 继续表示 catalog composite 关系；若未来要展示完整 inventory reference 列表，必须另立 UI/IA 决策，不能借本字段偷偷改变 count 语义。

## 7. 方案合理性与裁决状态

推荐“自有定义自动退休、入向引用阻断”是因为它直接对应用户所说的 A/B 关系，并保留历史；相比只改文案或让用户手工删除，操作更短、失败面更小、owner 责任清晰。

仍待 Dexter 裁决的业务语义有一项，不能由实现者猜测：

1. 是否接受“商品作废成功时自动停用该商品自有 active inventory definitions”。若不接受，必须明确要求用户先在库存配置中停用，再保留自有配置 blocker；不能在实现时一边保留 blocker 一边把页面文案改成可作废。

已裁决：批量作废中，若 A 的 active BOM 在同一批请求中引用 B，即使 A、B 同批，也仍按 batch-start graph 的 active inbound reference 阻断 B；不允许通过排序、预加载或先退休 A 进行同批拓扑释放。该裁决已同步至 implementation-facing 详设与实施方案。

另两项 contract 层裁决（不保留 reference row status、不保留 candidate status）不改变本 Journey 的用户任务，记录于 `doc/review/platform/2026-08-31-v2s-catalog-item-void-bom-reference-round2-decision-disposition-codex.md`，并由 implementation CP-01/CP-04 负责全链路删除。

本修订不改变：库存扣减方式切换 A-05、CP05 阈值、BOM 数量/单位、销售语义、商品编辑 dirty guard、reset/seed/L2 授权边界。

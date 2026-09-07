---
title: 销售菜单目标选择与细粒度沽清 Journey 裁决草案
status: DEXTER_ACCEPTED
governanceRef: doc/decisions/2026-07-25-v2s-design-governance-batch-1.md
---

# Journey 裁决：R5-SM-TARGET-SELECTION-AVAILABILITY 销售项目标选择与细粒度沽清

```text
JOURNEY_ID=R5-SM-TARGET-SELECTION-AVAILABILITY
STATUS=DEXTER_ACCEPTED
SKILL_USED=cs-spec-to-plan@repo
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=2026-09-07-current-workspace
DEXTER_REVIEW=ACCEPTED_FOLLOWUP_2026-09-07
IMPLEMENTATION_AUTHORITY=true
INDEPENDENT_SUBAGENT_REVIEW=ROUND_2_COMPLETE_NO_GO_AUTHOR_REPAIRED
AUTHOR_SELF_DECISION=IMPLEMENTATION_MAY_PROCEED_AFTER_ACCEPTANCE_REPAIR
```

## 1. 用户任务与成功结果

- **Actor**：拥有门店销售菜单编辑权限的门店运营人员。
- **此刻任务**：在已经加入销售菜单的同一个 Catalog 商品上，决定本销售项向该经营入口暴露哪些 SKU 或点单选项；发布后，当某一个 SKU/选项临时不可售时，只将该目标人工沽清，而不下架同一销售项的其他目标。
- **成功结果**：
  1. 编辑草稿时，SKU 商品可以勾选一个非空 SKU 子集并分别维护每个已选 SKU 的菜单挂牌价；普通商品可以勾选每个选项组要暴露的选项值子集。
  2. 发布读回只包含本销售项保存的目标快照；同一 Catalog 商品可以在同一菜单中有多个 SalesItem，各自绑定不同 SKU/选项子集。
  3. 已发布销售项的状态操作可以定位到“整个销售项 / 某 SKU / 某选项值”，并对目标设置或恢复人工沽清。
  4. 库存自动不可售、销售项人工沽清、SKU/选项值人工沽清仍是可分别读回的事实。
- **失败后仍成立的事实**：保存、发布、状态变更任一步失败时，既有草稿/发布快照、目标选择、人工状态、审计事件和库存事实不得出现半写入或跨目标误变更。

## 2. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型（三选一） | 产生/确认位置 | 来源证据 | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 门店运营人员 | 已建立的 workspace session 与当前门店节点 | `ESTABLISHED_SOURCE` | 登录/session | `PLATFORM-BLUEPRINT.md`；`WorkspaceSessionEntry.selectedDataNode` | 页面保持无权/无可管理经营入口，不用默认账号补位 |
| 访问资格 | 门店运营人员 | 已有页面访问范围及 `EDIT_STORE_SALES_MENU` 写能力 | `ESTABLISHED_SOURCE` | IAM/operations edge | `contracts/registry/iam-org-governance-manifest.json`；既有销售菜单 operation requirement | GET 按角色节点范围拒绝；写按 capability + owner recheck 拒绝 |
| 入口数据 | 门店运营人员 | 当前门店可管理的经营入口、菜单、销售分区和销售项 | `IN_SCOPE_PRODUCED` | SalesMenu owner readback | `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md` §2–§4 | 显示 typed empty/denial，不把 Catalog 或 seed fixture 当页面事实 |
| SKU 业务数据 | 门店运营人员 | 当前 Catalog 商品中状态为 `ENABLED` 的 SKU candidate、默认价和稳定 ref；已保存但后来失效的目标只能作为无效已选项读回 | `ESTABLISHED_SOURCE` | Catalog owner task read | `CatalogOwnerApi.SalesMenuItemFacts`；`getOperationsCatalogItemSkus` | 无 `ENABLED` candidate 时阻止 SKU 保存；直接提交 `DISABLED`/`VOIDED` ref 由 owner 返回 typed problem |
| 选项业务数据 | 门店运营人员 | 当前 Catalog 普通商品的选项组、选项值、选择模式、必选约束和价格事实 | `ESTABLISHED_SOURCE` | Catalog owner task read | `CatalogOwnerApi.SalesMenuOrderOptionFact`；catalog fixture `SEED-CAESAR`/`SEED-MILK-TEA` | 无选项时显示“无可选销售选项”；提交陌生 ref 由 owner 拒绝 |
| 发布目标 | 门店运营人员 | 当前销售项已有 published version，且目标属于该已发布版本 | `IN_SCOPE_PRODUCED` | SalesMenu publish/readback | `SalesMenuOwnerService` publication boundary；现有 published item operation | 无发布版本或目标未发布时拒绝状态操作，不自动改草稿 |

## 3. 任务边界、非目标与禁推

### 3.1 范围内动作

1. 打开销售项编辑 Drawer，读取当前 Catalog 的可选 candidate 与已保存草稿目标；`DISABLED`/`VOIDED` 不进入新的可选 candidate 集合。
2. 在 SKU 商品的选择表中选择/取消 SKU，并给每个已选 SKU 输入挂牌价。
3. 在普通商品的选项选择表中按选项组选择/取消本销售项在经营入口中纳入的选项值；保存时只提交 ref，名称、默认值、加价和约束由 Catalog owner 复核并快照。
4. 通过同一个 SalesItem 更新 operation 保存整体目标集合；发布时把草稿目标快照复制到 published version。
5. 在已发布销售项状态入口中定位销售项、SKU 或选项值目标，设置带原因的人工沽清或带确认的恢复。
6. 读回目标级人工状态，并在菜单展示中保持库存状态与人工状态分开。

### 3.2 非目标

- 不重建 Catalog SKU、选项定义、选项值、库存余额或库存自动状态。
- 不在本批增加按选项值独立挂牌价；选项值加价继续是 Catalog 只读事实。
- 不支持一个 SKU 销售项同时再维护普通商品选项子集；业务形态边界已确定为 `DIRECT` 使用 option selection、`SKU_SELECTION` 使用 SKU selection，本批及后续均不预留混合 shape。Catalog owner 的 `admittedShapes` 后端强制属于独立 handoff 欠账，不在本批修改。
- 不让菜单编辑人员修改选项组的 `selectionMode`、`required`、`min/maxSelectionCount` 或 Catalog 默认值。
- 不为未选入 published version 的 Catalog SKU/选项值建立人工沽清状态。
- 不把 manual sold-out 转换成库存自动不可售，也不提供从本弹窗恢复库存状态的动作。
- 不支持历史数据兼容分支、旧行回填策略或旧客户端兼容字段；本次实现前按 Dexter 安排 reset/reseed。
- 本次“不可选入”裁决约束候选展示、草稿保存和发布复核；不自动回写已经发布的 immutable snapshot。已发布目标在 Catalog 后续变为 `DISABLED` 后是否自动下架，是另一个发布生命周期裁决，本轮不代为推断。

### 3.3 禁推

- Catalog 新增 SKU/选项值不会自动进入既有草稿或已发布菜单。
- 选项组的客户选择约束不是菜单暴露值数量约束：例如 `MULTIPLE max=2` 可以暴露 3 个候选值，但顾客一次最多选 2 个。
- 父销售项人工沽清不会级联子目标；子目标人工沽清也不会改变父状态。
- `NORMAL` 只表示该人工目标没有人工沽清，不代表库存一定可售。

## 4. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 销售项可重复加入同一商品 | `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md` §4.1 | 允许同商品不同 SalesItem 绑定不同目标集合 | 无 | 否 |
| SKU 规格收窄 | 同文 §4.1 “规格收窄”及现有 SKU `skuPrices` | 只从 `ENABLED` candidate 选择非空 SKU 子集；`DISABLED`/`VOIDED` 不自动进入也不能被直接提交 | 当前编辑器没有真实选择控件；旧设计把失效 candidate 与可选 candidate 混在一起 | 否，已按 Dexter 裁决修复详设 |
| 普通商品选项当前只读 | `doc/plans/platform/2026-09-07-v2s-sales-menu-specification-display-amendment-codex.md` | 该片段由本 Journey supersede：改为 menu-owned selected subset，Catalog 仍拥有定义事实 | 已由 Dexter 裁决 supersede | 否 |
| 库存与人工状态独立 | 原需求 §4.5、现有状态弹窗文案 | 目标级人工状态沿用独立维度 | 状态 target 从 item 扩展到 child | 否，详设修复 |
| optional 选项组可零选择 | Catalog `required=false` 与 `minSelectionCount` 事实 | optional 组保存零个菜单选项值是合法销售定义；不把它解释为终端渲染语义 | 已由 Dexter 裁决 | 否 |
| 被发布移除目标的状态 | 现有发布复制边界没有 child manual target | 发布清理不再属于新 published set 的 child current row，不写额外 detach event；重新加入从 NORMAL 开始 | `event_kind` 保持 `SOLD_OUT`/`RESTORED` | 否 |

## 5. UI 适用性与后续工件

`UI_BEARING=true`。对应交互工件为：

- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-interaction-design-codex.md`。
- `doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-requirements-amendment.md`。

上述 optional 零选择、child current 清理与普通选项 supersede 均已由 Dexter 裁决；本 Journey 的 implementation-facing 工件可按本轮授权进入实施，但 fresh independent subagent blind review 仍是本 cycle 的强制前置复核。

## 6. Dexter 裁决

- **裁决状态**：Dexter 已接受本 Journey 的整体范围与实施授权；Claude follow-up DESIGN review 已完成，fresh independent subagent blind review 仍待执行。
- **2026-09-07 产品裁决（本轮新增）**：Catalog SKU 只有 `status=ENABLED` 才能成为销售菜单的可选候选；`DISABLED` 与 `VOIDED` 均不得被新建或更新命令选入。候选读取和 SalesMenu owner 保存/发布复核必须同时执行该规则；直接调用 HTTP 也必须失败，不能只依赖前端禁用控件。
- **2026-09-07 产品裁决（optional 选项组）**：optional 组可以保存零个菜单选项值；这只是销售定义集合事实，不表达终端是否渲染或“向顾客隐藏”。required 组仍由 SalesMenu owner 按 Catalog 的 `minSelectionCount` 校验。
- **2026-09-07 产品裁决（发布移除目标）**：发布只删除不再属于新 published set 的 child current status row，不新增 `TARGET_DETACHED_BY_PUBLICATION` 事件；`sales_manual_status_event.event_kind` 仍只有 `SOLD_OUT` 与 `RESTORED`。
- **2026-09-07 产品裁决（形态边界）**：`SKU_SELECTION` 与 option selection 互斥，本批及后续不支持混合 shape。Catalog 后端 `admittedShapes` enforcement 登记为 handoff 欠账，本批仅在 SalesMenu owner 侧做 shape-aware rejection/visible failure。
- **2026-09-07 产品裁决（普通选项 supersede）**：普通商品选项“当前只读”的既有边界由本 Journey supersede；Catalog 继续拥有定义事实，SalesMenu 拥有选中集合与 published snapshot。
- **过期草稿处理**：如果一个已保存草稿目标在后续变为 `DISABLED`/`VOIDED`，读回可将其标记为无效已选目标供用户移除；保存/发布不得静默删行或继续发布。已发布 immutable snapshot 是否因后续 Catalog 状态变化自动下架，仍是独立未决语义。
- **精确范围**：仅新增销售项目标选择与目标级人工沽清；保留销售菜单既有 owner、发布冻结、库存独立和权限边界。
- **已知前提**：Catalog fixture 已有至少一个 SKU 商品和两个普通选项商品，可支撑 reset/reseed 后的真实验证；不以历史数据库行作为设计输入。
- **未决项**：仅保留“已发布 immutable snapshot 后续遇到 Catalog `DISABLED` 是否自动下架”的独立发布生命周期语义；本批不代为推断。Catalog owner 的 `admittedShapes` 后端 enforcement 是 handoff 欠账，不改变本批范围。
- **后续允许动作**：在完成交互控件表、required option fixture、stale SKU 终态说明、Catalog fixture candidate 前提及 fresh independent subagent blind review 后，按已授权 CP 实施本 Journey；不得扩大到 Catalog 后端 admittedShapes、其他 Journey、TDP、部署或 UAT。

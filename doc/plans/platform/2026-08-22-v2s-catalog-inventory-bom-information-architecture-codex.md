# 商品库存与 BOM 配置信息架构

<a id="catalog-inventory-bom-information-architecture"></a>

## 1 · 元数据

```text
IA_SCOPE=IA-CIB-01,IA-CIB-02
BUSINESS_SOURCE=doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md#catalog-inventory-bom-formal-requirements
JOURNEY_REFS=doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md#catalog-inventory-bom-configuration-journey
UI_INTERACTION_REF=doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md#catalog-inventory-bom-configuration-interaction
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-08-22
IMPLEMENTATION_AUTHORITY=false
```

本 IA 只固化已经批准的商品库存/BOM配置任务。它不授权修改契约、代码、数据库或环境，也不把销售扣减链路、生产配方或可售判断带入本专题。

## 2 · 维度

### 2.1 IA-CIB-01 · 商品 Drawer 宿主

#### 可见维度

| 维度 | 本屏取值 |
|---|---|
| `businessTask` | 在不离开当前商品上下文的前提下完成商品资料与库存扣减规则的一次整体保存，并明确知道失败发生在哪个配置对象。 |
| `actorAndScenario` | 总部或门店商品资料维护者正在新建或编辑一个商品；门店库存配置维护者正在确认该商品销售/使用时如何影响库存。 |
| `entryAndSurface` | `/operations/{groupWorkspaceKey}/catalog/store-items` 或 `/catalog/brand-items` 的商品工作台；点击新建商品或商品名称打开右侧 Drawer；“库存与 BOM”是 Drawer 内容 Tab。 |
| `controlType` | 查看态：标题、shape/状态标签、只读 tabs 与关闭；编辑态：既有各业务 Tab、取消、保存。保存是整个 Drawer 唯一提交入口；库存 Tab 不另造局部保存。 |
| `validationAndError` | 字段校验定位到字段/当前 owner；结构、方式切换、组件资格、版本或授权问题显示 owner 原因并保持 Drawer 与草稿；未知结果先回读，不直接重发。 |
| `accessibilityAndTestId` | Drawer 标题由 `aria-labelledby` 关联；Tab、取消、保存、关闭可键盘到达；提交锁同时体现 disabled 与忙碌文本；错误有 `role=alert` 且不只靠颜色。沿用 `CATALOG_ITEM_DRAWER`、`CATALOG_ITEM_TABS`、`CATALOG_ITEM_SAVE`、`CATALOG_ITEM_PROBLEM`、`CATALOG_DIRTY_CONTINUE`、`CATALOG_DIRTY_DISCARD`。 |
| `emptyLoadingErrorStates` | 首次详情加载显示 Drawer 骨架；读失败显示持久错误和重试，不用空 Drawer 冒充；重试保留当前 item identity；无库存配置是合法的“不参与库存”readback，不显示错误。 |
| `containerBehaviorUnderLoad` | Drawer header/footer 固定在既有 surface，body 统一纵向滚动；Tab 标题不横向撑出视口。内容很长时只有 body 滚动，保存/取消始终可达；长商品名截断并提供完整提示，不挤压操作区。 |

#### 不可见维度（可执行观察）

| 维度 | 取值与最低证据档位 |
|---|---|
| `stateAndPermission` | `[静态]` 商品详情、shape manifest、单位候选、组件候选四条读边界都从已确认 `WorkspaceScope/queryContext` 取 `dataNodeRef/brandRef`，不得从浏览器 URL 自证授权；保存 edge 调 catalog initiating command，catalog 与 inventory owner 均复核 scope/grant。`[backend-acceptance]` 用只授权 A 门店的身份向四条读边界和保存命令提交 B 门店 owner ref，全部返回 `SCOPE_FORBIDDEN`；任一返回 B 的结构、单位、组件或写入成功即缺陷。 |
| `navigationAndRefresh` | `[静态]` 保存成功只失效当前 item detail、当前 catalog result identity、受影响 inventory target list/detail 与 BOM component candidate identity；不失效单位库、分类树、标签/属性/点单选项定义。`[组件 test]` 保存失败或 conflict 时上述 refetch 均不发生且 Drawer 草稿仍在。 |
| `collectionShapeAndScale` | Drawer tabs 与商品详情为 `Detail aggregate`；预期一个商品 1 个详情聚合，增长由 SKU、点单选项值和 BOM 行驱动，必须整体保存、整体 CAS，不在客户端分页或 slice。`[静态]` detail/save 契约不出现 cursor/pageSize，前端不抽干列表再拼 aggregate；`[acceptance]` 多 SKU、多选项、多 BOM 行保存后逐项回读，少一项或重复一项即缺陷。 |
| `dataSourceAndCascade` | `[组件 test]` 切换 scope/brand/item identity 后取消旧 generation，清空旧 item 草稿与 owner selection，再由新 detail hydrate；旧响应晚到不得覆盖。切换 Tab 不复制服务端 detail 到第二份本地事实。 |
| `forbiddenUI` | `[静态/组件 test]` 以下任一 DOM/control key 出现即缺陷：库存 Tab 的局部保存按钮、第二个 Drawer、任意 scope/ownerRef 文本输入、把 `response.ok` 当成功的分支、提交失败后自动关闭 Drawer、把 `StockTarget` 技术名作为一级用户动作。 |

### 2.2 IA-CIB-02 · 库存与 BOM 内容 Tab

#### 可见维度

| 维度 | 本屏取值 |
|---|---|
| `businessTask` | 先识别当前商品结构中的配置对象，再为它选择唯一的“销售/使用时怎么扣库存”方式，并只填写该方式真正需要的事实。 |
| `actorAndScenario` | 用户已经进入当前商品 Drawer 的库存 Tab：普通/称重商品配置商品本身；按 SKU 商品逐个配置 SKU；点单选项值只在其改变物料耗用时配置 BOM。 |
| `entryAndSurface` | CIB-01 内的“库存与 BOM”内容 Tab。单节点商品隐藏结构树，直接显示“当前配置对象”；多节点采用左 280px 结构区与右侧详情区，小于 920px 改上下布局。 |
| `controlType` | 查看态：结构/当前对象/方式摘要、库存配置或物料耗用明细只读；编辑态：方式单选、低库存阈值、负库存开关、盘点单位与换算、BOM 添加/移除行、耗用对象搜索、增减、每份用量。根商品、shape、node identity、消耗单位快照和版本只读。 |
| `validationAndError` | 缺基础计量单位显示“未配置基础计量单位，暂不能启用库存”；组件无 StockTarget 显示“请先为该原料启用库存管理”；空 BOM、重复/自引用、非法 shape/node/mode、数量精度与方式切换阻断定位到当前对象或当前行；owner 文案不得改写为通用失败。 |
| `accessibilityAndTestId` | 结构树支持方向键与 Enter 选择并暴露当前项；方式 Radio/Segmented 有 fieldset/legend；BOM 表每行删除按钮包含耗用对象名称；错误与对象标题关联。新增 testId 固定为 `CATALOG_INVENTORY_OWNER_TREE`、`CATALOG_INVENTORY_OWNER_CURRENT`、`CATALOG_INVENTORY_MODE`、`CATALOG_INVENTORY_DIRECT_CONFIG`、`CATALOG_INVENTORY_BOM_LINES`、`CATALOG_INVENTORY_BOM_ADD`、`CATALOG_INVENTORY_BOM_COMPONENT`、`CATALOG_INVENTORY_BOM_QUANTITY`。 |
| `emptyLoadingErrorStates` | contract/detail 未齐时展示结构骨架，不生成 fallback 节点；组件候选独立 loading/empty/failed/retry，失败不清空已填 BOM 行；无候选显示引导而非空 Select；选择 BOM 但 0 行是 validation，不是合法空态；不准入 shape 不显示配置入口。 |
| `containerBehaviorUnderLoad` | **多节点时采用左 280px 结构区+右侧 minmax(0,1fr) 详情区，24px 间距；小于 920px 时改为上下布局；单节点时隐藏结构区并由“当前配置对象”摘要占位；不新增局部纵向滚动，内容随 CIB-01 Drawer body 滚动；方式按钮、表头和每行字段必须在内容宽度内换行/收缩，不产生横向滚动。** Detail aggregate 到当前实际长度时由 Drawer body 承担纵向增长；长名称/编码在树中单行截断加提示、在 BOM 行内名称可两行换行；方式区、表头、行操作绝不溢出视口，左右栏按顶部而非行数对齐。 |

#### 不可见维度（可执行观察）

| 维度 | 取值与最低证据档位 |
|---|---|
| `stateAndPermission` | `[静态]` 前端只消费 contract/detail 返回的 owner tree/allowed modes，不能以本地 shape 常量授权；组件候选 query 与 whole-save command 都把 item owner 交由 owner 重新派生。`[backend-acceptance]` 对普通/称重、SKU、选项值、物料、半成品、套餐、服务、权益壳逐一提交合法与篡改 node/mode，owner 结果必须与 shape×node×mode 矩阵一致。 |
| `navigationAndRefresh` | `[组件 test]` 切换当前 owner 只切换右侧草稿，不发 item detail 重读；保存成功由 CIB-01 统一回读；盘点单位候选、组件候选的失败重试只重取自身 query。组件候选选择成功不触发 catalog 列表请求。 |
| `collectionShapeAndScale` | owner tree 与每个 owner 的 BOM 行均为 `Detail aggregate`：跟随当前商品整体 CAS；常态为 1–几十个 owner/行，增长驱动是 SKU、选项值和组件行，不静默截断。单位候选为 `Bounded`，硬上限 99；组件候选为 `Cursor`，默认 20、最大 100，增长驱动是同范围可用库存对象。`[静态]` 单位候选无 cursor，组件候选真实声明/消费 cursor+pageSize，owner tree/BOM 无客户端 slice；`[acceptance]` 组件候选造 101 个合格对象时第二页可达、无重复遗漏且 total 不等于本页长度。 |
| `dataSourceAndCascade` | `[组件 test]` owner 变化后 mode/detail 来自该 owner readback；选择“不参与库存”隐藏并清空待提交的 direct/BOM active payload；盘点单位清除同时清除换算；耗用对象改变清除数量和旧单位快照；scope/brand/item 改变取消候选旧 generation 并清空 stale selection。历史 readback 不被上述 UI 清理物理删除。 |
| `forbiddenUI` | `[静态/组件 test]` 以下任一命中即缺陷：顶层“新增独立库存对象”或“新增 BOM”；直接扣本品时出现其他商品选择器；选项值出现直接库存；普通/称重出现 SKU owner；按 SKU 商品根节点可编辑；标签、SKU 销售属性值、商品属性进入 owner tree；物料/半成品出现 BOM；套餐/服务/权益出现配置入口；自由 counting/consumption unit 文本；salesUnitRefs；measureMode 被展示为消耗单位；空 BOM 被标记为已配置。 |

## 3 · 共用信息架构规则

1. **唯一事实来源**：shape、owner grain、allowed modes、单位快照、版本与 disabled reason 来自 generated contract/readback；前端本地 state 只保存未提交草稿和当前选中 owner，不镜像服务端集合。
2. **级联顺序**：scope/brand/item → contract/detail → owner tree → current owner/mode → direct 或 BOM 分支 → 单位/组件候选；上游改变必须取消旧请求并清理不再成立的下游值。
3. **只读/编辑**：目录节点、按 SKU 商品根、技术 identity、历史快照和服务端版本只读；只有 contract 允许的 owner/mode/字段可编辑。无写授权不渲染伪可写控件。
4. **候选来源**：盘点单位只来自 catalog unit owner；BOM 耗用对象只来自 inventory owner 的 typed cursor candidate read。二者不共用自由文本或当前已加载商品列表。
5. **方式互斥**：同 owner readback 只有 `NONE | DIRECT | BOM` 一个值；option value 只有 `NONE | BOM`；物料/半成品只有 `NONE | DIRECT`。UI 不保存两份 active payload 等待后端猜。
6. **失败恢复**：validation/denied/conflict 保留当前 owner 和草稿；unknown 先读回 owner version/mode，再决定是否需要用户重试；不得自动补建 StockTarget、自动换 owner 或自动搬余额。
7. **通用禁止 UI（可搜索证伪）**：DOM 与源码不得出现 `新增独立库存对象`、`salesUnitRefs`、自由 `countingUnit`/`consumptionUnit` 输入、以 `measureMode` 输出单位、库存 Tab 局部保存、商品标签/SKU 属性值作为 owner tree node。

## 4 · 错误语义与界面映射（全量）

下表是本专题必须处理的 typed problem 全集。标为“新增”的 code 要进入契约单一生成源、owner exception 与前端闭集映射；HTTP 注册仍走既有 catalog/inventory problem registry，不另造 response envelope。

| problem code | HTTP | 业务规则映射 | 触发界面/owner | 用户可见处理 |
|---|---:|---|---|---|
| `SCOPE_FORBIDDEN` | 403 | 当前会话无目标数据节点/品牌读写权 | 四条读边界、whole-save；edge+owner | 显示 owner 原因；不渲染其他范围的结构、候选或草稿。 |
| `NOT_FOUND` | 404 | item、SKU、option value、unit 或 component ref 不存在/不属当前 aggregate | 详情、候选、保存；catalog/inventory owner | 定位当前对象/行，提示重新加载；不把它改写成空结果。 |
| `VERSION_CONFLICT` | 409 | catalog 或 inventory expectedVersion 过期 | whole-save | 保留草稿，显示“配置已被其他操作更新，请重新加载后核对”；不自动覆盖。 |
| `STRUCTURE_INCOMPATIBLE` | 409 | shape、SKU 结构、商品级/SKU级粒度不闭合 | owner tree/whole-save；catalog owner | 阻断保存并显示具体结构原因；不生成 fallback owner。 |
| `OWNER_REFERENCE_LEAK` | 422 | payload 的 item/SKU/option owner ref 不属于当前商品 | whole-save；catalog+inventory owner | 显示“配置对象与当前商品不一致，请重新加载”；保持草稿供核对。 |
| `INVENTORY_DEDUCTION_MODE_NOT_ALLOWED`（新增） | 422 | shape×node×mode 矩阵拒绝该方式 | mode/whole-save；inventory owner | 显示“当前商品结构不支持这种库存扣减方式”；恢复 latest readback，不静默改成 NONE。 |
| `INVENTORY_DEDUCTION_MODE_CHANGE_BLOCKED`（新增） | 409 | A-05 的余额、流水、BOM引用、历史定义任一存在；历史定义精确为命令开始前同 owner 已有的 DISABLED StockTarget/ProductBom definition | 切换 mode/whole-save；inventory owner | 逐字显示“已有库存或历史依赖，不能自动切换扣减方式”；details 的 `blockingFacts` 只返回 `BALANCE/LEDGER/BOM_REFERENCE/HISTORICAL_DEFINITION` 与计数用于当前对象摘要，不提供强制切换。 |
| `INVENTORY_BOM_EMPTY`（新增） | 422 | 选择 BOM 后 active 行为 0 | BOM 行/whole-save；inventory owner | 当前 owner 显示“至少添加一条物料耗用明细”；不把空 BOM 当配方。 |
| `INVENTORY_BOM_SELF_REFERENCE`（新增） | 422 | owner 直接引用自身库存对象 | component 行/whole-save；inventory owner | 当前行显示“不能把当前商品或 SKU 作为自身耗用对象”。 |
| `INVENTORY_BOM_COMPONENT_NOT_ELIGIBLE`（新增） | 422 | 组件不满足同范围、可用、BOM_COMPONENT、已有 StockTarget、单位完整五条件之一 | 候选被并发改变后的 whole-save；inventory owner | 保留当前行并显示 owner 原因；`reasonCode` 区分 `SCOPE/UNAVAILABLE/CAPABILITY/TARGET/UNIT`，其中 TARGET 使用“请先为该原料启用库存管理”。 |
| `INVENTORY_TARGET_REQUIRED_FOR_OPTION_MATERIAL` | 422 | 选项实际用量引用的物料没有 StockTarget | option BOM/whole-save；inventory owner | 对应选项值行显示“请先为该原料启用库存管理”。 |
| `CONSUMPTION_UNIT_INCOMPATIBLE` | 422 | 单位维度、快照或换算与组件消耗单位不一致 | direct/BOM 行；inventory owner | 定位单位/数量字段，显示 owner 的兼容原因；不自行换单位。 |
| `CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED` | 409 | 已有 target 且新基础单位会造成消耗快照漂移 | 基础资料/whole-save；catalog owner | 定位基础计量单位并显示 owner 文案；不静默更新 target。 |
| `VALIDATION_ERROR` | 422 | 必填、非负、decimal、precision、重复 BOM 行等字段规则 | 当前字段/行；owner | 使用 field path 定位；precision=0 显示“只能填写整数”；输入值不由前端四舍五入。 |
| `RESULT_UNKNOWN` | 503 | 提交结果未知 | whole-save edge | 保留 Drawer 和草稿，先回读 item detail/versions；确认未写入后才允许用户重新提交。 |

“不准入 shape 不出现 Tab”“禁止项不出现在 DOM”“空 BOM 不得显示已配置”属于可见红夹具，不为它们另造 HTTP code；篡改 request 才由上表 typed problem 证明 owner 防线。

## 5 · 交叉对账

| 检查 | 结果 |
|---|---|
| IA ↔ 交互工件 | `CIB-01/CIB-02`、Drawer/内容 Tab、单节点退化、左 280px+右 `minmax(0,1fr)`、小于 920px 上下布局、统一 body 滚动、全部用户文案逐字一致。 |
| IA ↔ 详设 | PASS：shape×node×mode、四条读边界、Detail/Bounded/Cursor 三种集合形态、保存失效全集、15 个 typed problem 与 forbidden UI 已逐字对账。 |
| IA-ID ↔ Journey | `IA-CIB-01` 对应 Journey 入口、整体保存与失败恢复；`IA-CIB-02` 对应结构派生、三种 mode、direct/BOM/option 配置。 |
| 计数自证 | IA-ID 共 2 个；typed problem 共 15 个（现有 10、新增 5）；组件候选五条件共 5 个；读边界共 4 条。 |

## 6 · 完成判定

```text
IA_DIMENSIONS=IA-CIB-01,IA-CIB-02；可见与不可见两组逐项齐全
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=是
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=15 mapped
CROSS_CHECK_WITH_DESIGN=PASS
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-08-22
IA_STATUS=DESIGN_DRAFT_COMPLETE；不构成 implementation authorization
```

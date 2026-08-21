---
title: 商品计量单位模型交互工件
status: DEXTER_WIREFRAME_REVIEW_PENDING
governanceRef: doc/decisions/2026-07-25-v2s-design-governance-batch-1.md
---

# 交互工件：UNIT-MODEL 商品计量单位、销售单位与库存单位

> 本工件只定义运营用户看见、输入和确认的交互，不构成契约、数据库、代码或运行授权。低保真线框须由 Dexter 看图后，才可成为 implementation-facing 详设的输入。

## 1. 工件元数据

```text
JOURNEY_DECISION=doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md#unit-model-journey
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-08-21-v2s-catalog-unit-model-optimization-requirements-analysis-codex.md#unit-formal-model
BUSINESS_PROBLEM=一个商品可同时选择多个销售单位，且库存把计件/称重方式误当成实际单位，运营人员无法判断一件商品的售卖、扣料和盘点口径。
BUSINESS_USER_OR_OWNER=维护商品资料、SKU 与门店库存的运营用户。
CURRENT_TASK=用一套计量单位库为商品、SKU、库存与盘点建立清楚而不混淆的单位口径。
SUCCESS_OUTCOME=运营用户能维护合法计量单位；一个销售单元只选择一个销售单位；库存只显示从商品资料带入的消耗单位；盘点换算只用于录入；复制后只使用目标门店的单位。
UI_BEARING=true
SKILL_USED=cs-code-structure-recall
DEXTER_WIREFRAME_REVIEW=ACCEPTED
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=operations-admin
```

### 1.1 已裁定交互边界

- **单位库容量与集合形态**：**典型十几个、最多几十个；上限固定为99，owner 读取第100条即拒绝，前端不分页、不无限加载、不静默截断。** 因此单位库、商品单位候选、SKU 单位候选均为当前范围内的 **Bounded 完整集合**；页面不做分页、游标或“加载更多”。
- **单位生命周期**：零引用单位可以修改或删除；已经被商品、SKU、库存、盘点换算、BOM、复制闭包或历史快照引用的单位，删除由 owner 拒绝，只能停用。停用后，它不再出现在为商品、SKU、库存新选择单位的候选中，但既有商品配置和历史快照继续按原单位显示、不会被改写。已引用单位仅可修改**名称**；编码、单位类别和小数位数不可修改，若业务含义需要改变，必须新建单位并在后续商品或库存配置中重新选择。
- **数量输入**：源单位输入数量按源单位自身 `precision` 向零截断；转换后的目标消耗数量按目标消耗单位自身 `precision` 向零截断。前端动态限制与 owner 采用同一向零截断语义，不把目标 precision 当源输入上限，也不四舍五入；`precision=0` 时提示“只能填写整数”。
- **用户可见语言**：可见文案使用“计量单位、销售单位、基础计量单位、消耗单位、盘点单位、单位类别、小数位数”。不显示 `ref`、scope、owner、snapshot、precision、measureMode、BOM、transaction 或内部状态枚举。
- **非目标**：不提供任意单位互相换算、不让库存页创建单位、不把停用当删除、不把商品标签等其他多选字段改成单选。

## 2. Interaction map

| 顺序 | 前提 | route / 屏幕 | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 已进入当前总部或门店商品库且具备商品资料维护权限 | 商品工作台 / 商品元数据 Modal | 维护本范围可用的计量单位 | 打开“商品元数据”，切换“计量单位” | 当前范围的单位完整列表与引用/状态摘要 | 停留当前 Modal | 关闭不改动单位；读取失败可重试 |
| 2 | 商品元数据 Modal 已打开 | 计量单位 Tab / 行内编辑与生命周期确认 Modal | 新建、修改零引用单位、改名、删除零引用单位或停用计量单位 | 新建计量单位、编辑单位、编辑名称、保存、删除、停用 | catalog 单位定义 owner | 回到最新列表；定义、名称或状态立即更新 | 失败保留输入，不假定已保存 |
| 3 | 商品已新建或正在编辑，且“基础”Tab 对当前形态开放 | 商品资料 / 基础 Tab | 设定默认销售单位和基础计量单位 | 两个单选候选；已停用但仍被当前商品使用的单位以“已停用”只读显示 | catalog item detail、启用单位候选 | 保存商品资料后回到详情 | 字段错误留在当前 Tab；取消恢复最近一次保存值 |
| 4 | 商品使用 SKU，且 SKU 资料对当前形态开放 | 商品资料 / SKU 单位设置 | 需要时用 SKU 覆盖商品默认单位 | 每个 SKU 的销售单位、基础计量单位“继承/改为”单选设置 | SKU detail、商品默认单位、启用单位候选 | 保存后 SKU 行显示“继承”或实际单位 | 改回继承即清除覆盖；失败保留草稿 |
| 5 | 门店库存对象存在 | 库存对象详情 / 盘点设置 Drawer | 确认消耗单位来源，仅配置盘点录入单位及换算 | 只读消耗单位；盘点单位、1 个盘点单位等于多少个消耗单位 | inventory StockTarget detail 与单位候选 | 保存后库存余额单位不变，盘点说明更新 | 非法换算不提交；取消不改变库存余额或 BOM |
| 6 | 总部商品复制到门店，预检已完成 | 从品牌复制 / 复制检查 Drawer | 确认单位是否在目标门店重新对应 | 单位处理结果、不可复制原因、继续/关闭 | copy coordinator 预检 readback | 无阻断后进入既有复制确认；完成后只读回目标门店单位 | 同编码不同语义、目标缺少合法对应或预检过期时停止，不给覆盖确认 |

## 3. v2 对应页面盘点

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线 / 摹本标注 | 差异及原因 |
| --- | --- | --- | --- | --- |
| catalog-metadata-modal | `PARTIAL_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | 以 v2s `CatalogDictionaryDrawer` 商品元数据 Modal 为静态基线。 | 既有“销售单位”Tab 改为唯一“计量单位”Tab；不新增库存专用单位库。 |
| item-basic-unit-settings | `PARTIAL_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | 以 v2s `CatalogItemDrawer` 的“基础”Tab 静态结构为基线。 | 旧销售单位多选替换为单个销售单位；新增基础计量单位。 |
| sku-unit-settings | `NO_V2_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | 检索范围：all-v2 SKU 编辑与商品销售单位字段。 | 新增“继承/覆盖”业务表达，避免一个 SKU 挂多个单位。 |
| stocktaking-unit-settings | `PARTIAL_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | 以 v2s `InventoryDetailDrawer` 与库存配置表单为静态基线。 | 消耗单位由商品资料带入并只读；盘点单位从自由文本改为单位库候选。 |
| brand-copy-unit-check | `PARTIAL_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | 以 v2s `BrandCatalogCopyDrawer` 预检步骤为静态基线。 | 复制检查新增单位引用重写结果；不允许保留总部单位或自动覆盖门店同编码但语义不同的单位。 |

## 4. 低保真线框

### Screen: catalog-metadata-modal

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=商品工作台的“商品元数据”按钮；打开既有 CatalogDictionaryDrawer。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=在同一个商品库中维护商品标签、计量单位、SKU 销售属性、商品处理标签、商品属性和点单选项。
BUSINESS_GOAL=在不离开商品管理的情况下，进入正确的基础资料维护入口。
USER_VISIBLE_COPY=商品字典与关联维护；商品标签；计量单位；SKU 销售属性；商品处理标签；商品属性库；点单选项库；关闭。
TECHNICAL_BOUNDARY=当前商品库和品牌范围由服务端确定；各 Tab 独立读取自己的业务事实。
FOUNDATION_PRIMITIVE=useDrawerFormLifecycle,useOverlayLock,useRefreshVersion
CONTAINER_LAYOUT=宽高与来源：沿用既有 CatalogDictionaryDrawer 的 Modal 宽度与 body 最大高度；不得超出视口：Modal 外框、标题、六个 Tab 头和关闭控件；唯一纵向滚动：Modal body，所有 Tab 内容不得另造纵向滚动祖先；关键对齐：六个 Tab 位于同一行，Tab 内容的标题、表头与操作区沿 Modal 内容栅格对齐。1280px 以下出现 Modal 横向滚动，或 Modal body 与 Tab 内容同时纵向滚动，即不成立。
```

```text
┌ 商品字典与关联维护 ────────────────────────────────────────────────┐
│ 商品标签 | 计量单位 | SKU 销售属性 | 商品处理标签 | 商品属性库 | 点单选项库 │
├─────────────────────────────────────────────────────────────────┤
│                    <当前选中的内容 Tab>                           │
└─────────────────────────────────────────────────────────────────┘
```

**Tab 归属**：既有“销售单位”Tab 更名并扩展为“计量单位”；它是全范围唯一单位库入口。不能在商品工作台顶层、库存页或运维管理后台再造第二个单位库入口。

### Screen: metadata-unit-library-tab

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=商品元数据 Modal 的“计量单位”Tab。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=维护当前总部或门店可选择的合法计量单位。
BUSINESS_GOAL=快速找到单位、查看它是否仍在使用，并新建、修改、改名或停用而不误删既有业务资料。
USER_VISIBLE_COPY=计量单位；新建计量单位；按名称或编码查找；名称；编码；单位类别；小数位数；状态；正在使用；停用；删除；确认删除；当前没有计量单位；新建第一个计量单位。
TECHNICAL_BOUNDARY=列表是当前商品库完整且至多99条的服务端返回；计量单位定义由 catalog owner 维护，商品与库存中的使用摘要由协调读取汇总；引用范围、状态变更权限与是否可停用由提交时的 owner 判断最终核验。
FOUNDATION_PRIMITIVE=adminListState,useRefreshVersion,NameCodeText,EllipsisTooltip
CONTAINER_LAYOUT=宽高与来源：沿用 CatalogDictionaryDrawer 的 Modal body 内容栅格；不得超出视口：Modal 外框、六个 Tab 头、搜索框、表头和“新建计量单位”；唯一纵向滚动：CatalogDictionaryDrawer 的 Modal body，计量单位 Tab 不另造纵向滚动祖先；关键对齐：名称为首列普通文本，编码、单位类别、小数位数、状态、正在使用和操作列各与表头对齐，长名称截断后可查看完整名称。1280px 以下若出现 Modal 横向滚动，或 Modal body 与本 Tab 同时纵向滚动，即不成立。
```

```text
┌ 计量单位 ─────────────────────────────────────────────────────────┐
│ [按名称或编码查找________________]                 [+ 新建计量单位] │
│ 名称         │ 编码 │ 单位类别 │ 小数位数 │ 状态 │ 正在使用 │ 操作 │
│ 克           │ g    │ 重量     │ 0        │ 启用 │ 18        │ [停用] │
│ 千克         │ kg   │ 重量     │ 2        │ 停用 │  2        │ —        │
│ 毫升         │ ml   │ 体积     │ 0        │ 启用 │  0        │ [删除] │
└─────────────────────────────────────────────────────────────────┘
```

**列表规则**：单位名称不是详情入口，不提供单位详情页或详情 Drawer。名称或编码查询仅过滤已从服务端完整读回的当前范围集合；它不改变服务端可见范围、不会作为授权或候选来源。停用单位保留在列表中并显示状态与正在使用状态；仅当 owner readback 明确“正在使用”为 `0` 时才显示“删除”，其他行不显示删除动作。

### Screen: unit-lifecycle-confirm-modal

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=计量单位列表行的“删除”或“停用”；删除只在 owner readback 为零引用时出现。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=即将做不可逆删除，或停用一个已被业务资料使用的单位。
BUSINESS_GOAL=在提交前理解本次动作影响的范围，避免把停用误解为删除或误删已被使用单位。
USER_VISIBLE_COPY=确认删除计量单位；将删除“{单位名称}”，且无法恢复；确认停用计量单位；停用后，后续为商品或库存选择单位时将不再显示此单位；已有商品、SKU、库存、盘点换算、配方和历史记录不会改变；取消；确认删除；确认停用。
TECHNICAL_BOUNDARY=当前引用数与允许动作由提交时的协调命令重新取得 catalog 与库存使用判断；前端不以先前列表数字作最终判断。
FOUNDATION_PRIMITIVE=useSubmissionLifecycle,useOverlayLock
CONTAINER_LAYOUT=宽高与来源：沿用 Ant Design 标准确认 Modal；不得超出视口：确认框、标题、影响说明和底部操作区；唯一纵向滚动：Modal body，确认说明不另造滚动祖先；关键对齐：风险说明置于动作按钮上方，取消在左、确认操作在右。1280px 以下若确认框横向溢出或出现嵌套纵向滚动，即不成立。
```

```text
┌ 确认停用计量单位 ───────────────────────────────┐
│ 停用后，后续为商品或库存选择单位时将不再显示此单位。│
│ 已有商品、SKU、库存、盘点换算、配方和历史记录不会改变。│
│                                      [取消] [确认停用]│
└─────────────────────────────────────────────────┘
```

**确认变体**：零引用删除时标题和正文替换为“确认删除计量单位 / 将删除‘{单位名称}’，且无法恢复”，确认按钮为“确认删除”。两种确认均不能通过关闭确认框而提交。

### Screen: unit-library-row-edit-modal

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=“新建计量单位”或计量单位列表行的“编辑单位/编辑名称”；不提供单位详情入口。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=为当前商品库新增单位，或维护已经存在的单位名称与使用状态。
BUSINESS_GOAL=用业务可理解的信息建立单位，并在不改变已有单位含义的前提下维护名称或停用状态。
USER_VISIBLE_COPY=新建计量单位；编辑计量单位；编辑名称；单位名称；单位编码；单位类别；小数位数；小数位数为0表示只能填写整数；已被使用后不可修改；正在使用；停用计量单位；删除计量单位；确认删除；停用后，后续为商品或库存选择单位时将不再显示此单位；已有商品和库存记录不会改变；取消；保存；确认停用。
TECHNICAL_BOUNDARY=是否已引用决定编码/类别/小数位数的可编辑性；引用统计由协调读取汇总，状态与权限由 catalog owner 核验；不显示内部引用标识或状态枚举。
FOUNDATION_PRIMITIVE=useDrawerFormLifecycle,useDirtyFormLock,useOverlayLock,useSubmissionLifecycle
CONTAINER_LAYOUT=宽高与来源：沿用 metadata Modal 内的标准编辑 Modal；不得超出视口：Modal 外框、标题、字段与底部操作区；唯一纵向滚动：Modal body，单位表单不另造纵向滚动祖先；关键对齐：名称/编码/类别/小数位数沿同一输入列起点对齐，引用限制说明紧邻只读字段。1280px 以下若 Modal 横向滚动，或表单与 Modal body 同时纵向滚动，即不成立。
```

```text
┌ 编辑计量单位 ─────────────────────────────────────────────────────┐
│ 单位名称       [千克________________________________]              │
│ 单位编码       [kg________________]  已被使用后不可修改            │
│ 单位类别       [重量 ▼]              已被使用后不可修改            │
│ 小数位数       [2  ▼]                2位小数；已被使用后不可修改   │
│ 正在使用       18 个商品、SKU 或库存记录                            │
│ 状态           启用                    [停用计量单位]               │
│ 提示：停用后不能再选择；已有商品和库存记录不会改变。                │
│ 零引用单位才显示：[删除计量单位]                                    │
├────────────────────────────────────────────── [取消] [保存] ─────┤
└─────────────────────────────────────────────────────────────────┘
```

**创建、改名与停用规则**：

- 新建时填写名称、编码、单位类别和小数位数；类别是“数量、重量、体积、服务时长、包装”，小数位数是非负整数数字输入，不预设业务最大值；`0` 显示“只能填写整数”。
- 零引用单位：名称、编码、单位类别和小数位数均可改；保存时按最新引用数由 owner 重新核验。已被使用的单位：仅名称可改；编码、单位类别和小数位数只读，并紧邻显示“已被使用后不可修改”。若业务需要不同类别或小数位数，用户新建单位，随后在**后续**商品或库存配置中重新选择；界面不提供替换既有资料的批量动作。
- 仅当 owner readback 明确零引用时才显示“删除计量单位”；确认删除后该单位从列表和未来候选中移除。任何已引用单位都不显示删除，停用前以确认 Modal 说明“已有商品和库存记录不会改变”；确认后只从**以后新选择**的候选中消失。重新启用不在本批产品范围内。

### Screen: item-basic-unit-settings

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=CatalogItemDrawer 的“基础”Tab，处于编辑状态且当前商品形态开放基础资料时。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=为无 SKU 的商品或 SKU 默认继承场景建立商品级单位口径。
BUSINESS_GOAL=明确顾客购买的一件商品使用什么单位，以及需要库存/BOM时按什么单位计算。
USER_VISIBLE_COPY=销售单位；基础计量单位；请选择销售单位；请选择基础计量单位；未设置；该单位已停用，保留用于当前商品；库存或配方需要基础计量单位；商品已有库存余额，暂不能修改基础计量单位；保存。
TECHNICAL_BOUNDARY=可销售/库存/BOM能力、商品形态、SKU 是否覆盖、单位启用状态和最终必填条件由 catalog owner 核验；当前商品或 SKU 已关联非零库存余额时，基础计量单位固定只读，保存事务内新单位与既有消耗快照不一致即返回 `CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED`；不显示数组、字段名或计件/称重内部值。
FOUNDATION_PRIMITIVE=useDrawerFormLifecycle,DescriptorFieldRenderer,useAsyncGenerationGuard,useRefreshVersion
CONTAINER_LAYOUT=宽高与来源：adminWideDrawerSurfaceProps；不得超出视口：商品 Drawer 外框、Tab 头、顶部保存操作；唯一纵向滚动：商品 Drawer body，“基础”Tab 不另造纵向滚动祖先；关键对齐：基础资料原生字段后的销售单位与基础计量单位使用相同标签列、输入列和校验提示起点，候选下拉仅在自身弹层滚动。1280px 以下若 Drawer 横向滚动，或内容 Tab 与 Drawer body 同时纵向滚动，即不成立。
```

```text
┌ 基础 ─────────────────────────────────────────────────────────────┐
│ 商品名称        [凯撒沙拉________________________________]         │
│ 销售单位        [份 ▼]                                             │
│ 基础计量单位    [未设置 ▼]                                         │
│                 库存或配方需要基础计量单位。                       │
│ 已停用单位：千克（保留用于当前商品，不能重新选择）                 │
└─────────────────────────────────────────────────────────────────┘
```

**单值与候选规则**：销售单位和基础计量单位均是单选，不出现标签式多选、可自由输入或“同时适用多个单位”。可销售商品必须能解析一个有效销售单位；直接库存管理或作为配方原料的商品必须能解析一个有效基础计量单位。已停用单位若已保存到当前商品，仅在当前值位置以“已停用”只读显示；用户一旦清除它，只能从启用单位中重新选择。若当前商品或 SKU 已关联有非零库存余额，基础计量单位固定为只读，并显示“商品已有库存余额，暂不能修改基础计量单位”；保存事务拒绝会改变既有消耗快照的请求，不同步 target、不改写余额或历史。

### Screen: unit-candidate-picker

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=表单控件
HOST_AND_ENTRY=商品基础资料、SKU单位设置或库存盘点设置中的单位单选框；点击单选框或输入名称/编码后打开。
ACTOR=商品或库存维护运营用户
BUSINESS_SCENARIO=需要为当前业务对象选择一个合法的启用计量单位。
BUSINESS_GOAL=按名称或编码找到一个单位，知道它的类别和小数位数，并且不会重新选到已停用单位。
USER_VISIBLE_COPY=请选择单位；按名称或编码查找；{单位名称}；{单位编码}；{单位类别}；保留{小数位数}位小数；当前没有可选的计量单位；先维护计量单位；加载计量单位失败；重试。
TECHNICAL_BOUNDARY=候选由 catalog owner 在当前范围、关联商品/SKU/库存上下文和启用状态下返回；前端不通过当前表格、本地名称或已选值补造候选。
FOUNDATION_PRIMITIVE=useAsyncGenerationGuard,NameCodeText
CONTAINER_LAYOUT=宽高与来源：沿用 Ant Design Select 弹层并与触发输入同宽；不得超出视口：候选弹层左右边界及其空态/重试；唯一纵向滚动：候选弹层列表，宿主 Drawer/Modal body 不随下拉滚动；关键对齐：名称为首行，编码、类别和小数位数为次行，所有候选与输入框左边界对齐。1280px 以下候选弹层必须向可用视口内翻转，不能使宿主横向溢出。
```

```text
┌ 按名称或编码查找 ───────────────────────────────┐
│ 千克                                             │
│ kg · 重量 · 保留2位小数                          │
│ 克                                               │
│ g · 重量 · 只能填写整数                          │
└─────────────────────────────────────────────────┘
```

**候选规则**：该控件的 `ITEM_*`/`SKU_*` 角色从 catalog owner 一次读回当前范围内至多99条的启用单位；`STOCKTAKING_UNIT` 角色只读回与当前消耗单位同类别的至多99条启用单位。所有角色仅在弹层内按名称或编码筛选；已停用但已绑定到当前商品、SKU 或库存对象的单位不在下拉列表中，而在宿主字段原位显示“已停用”。切换商品范围、切换 SKU、target、消耗单位类别或关闭宿主时作废旧读取；同一返回名称的候选以编码和类别辅助区分。候选为空时显示“当前没有可选的计量单位 / 先维护计量单位”，不降级为自由文本。

### Screen: sku-unit-settings

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=CatalogItemDrawer 的“条码与识别”Tab内，SKU 行的“单位设置”展开区。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=同一商品的某个 SKU 因包装、价格、条码或扣减口径不同，需要覆盖商品默认单位。
BUSINESS_GOAL=让每个 SKU 明确继承商品单位，或独立选择一套单一单位，而不是给 SKU 勾选多个单位。
USER_VISIBLE_COPY=SKU单位设置；销售单位；继承商品销售单位；改为此SKU的销售单位；基础计量单位；继承商品基础计量单位；改为此SKU的基础计量单位；当前使用；未设置；该单位已停用，保留用于当前SKU；保存。
TECHNICAL_BOUNDARY=SKU 状态、是否可销售/库存/BOM、商品默认值、继承和覆盖合法性由 catalog owner 核验；前端不由条码或价格推断单位。
FOUNDATION_PRIMITIVE=useDrawerFormLifecycle,DescriptorFieldRenderer,useAsyncGenerationGuard
CONTAINER_LAYOUT=宽高与来源：adminWideDrawerSurfaceProps；不得超出视口：商品 Drawer 外框、Tab 头与保存区；唯一纵向滚动：商品 Drawer body，SKU 表与展开区不创建第二个纵向滚动祖先；关键对齐：SKU 名称/编码为列表首列，展开行中的继承开关与候选框使用统一标签列，当前使用单位紧随该 SKU 设置显示。1280px 以下 SKU 表在其容器内保持列对齐且不让 Drawer 横向溢出；候选下拉弹层滚动是唯一例外。
```

```text
┌ 条码与识别 · SKU 单位设置 ────────────────────────────────────────┐
│ SKU 名称(可展开) │ 条码 │ 当前销售单位 │ 当前基础计量单位          │
│ 330ml 瓶装可乐   │ ...  │ 瓶            │ 毫升                     │
├ 展开：330ml 瓶装可乐 ────────────────────────────────────────────┤
│ 销售单位：  ○ 继承商品销售单位（份）  ● 改为 [瓶 ▼]               │
│ 基础计量单位：○ 继承商品基础计量单位（毫升）● 改为 [毫升 ▼]       │
└─────────────────────────────────────────────────────────────────┘
```

**覆盖规则**：每一个“改为”只能选一个启用单位；选择“继承”立即清除该 SKU 对应覆盖并展示商品当前默认值。商品默认值改变后，选择继承的 SKU 读回新值，已覆盖 SKU 不变。SKU 若启用销售或直接库存/BOM且仍无法解析相应有效单位，保存时给出业务字段错误。

**SKU 动态集合、归属与保存边界**：商品是主项，SKU 是其从属集合。SKU 列表是稳定的当前 SKU 定位面，展开某一行时只显示该 SKU 的两个单位设置；切换展开行立即替换该行设置，绝不把不同 SKU 的候选或覆盖值平铺混排。没有 SKU 时显示“当前商品没有 SKU”；已有 SKU 时不再显示该空态。SKU 的增加、作废与排序仍由既有 SKU 资料规则管理，本屏不新增这些动作；本屏只改当前商品草稿中的 SKU 单位覆盖，点击商品 Drawer 的一次“保存”后统一保存商品默认单位与全部 SKU 覆盖，服务端 readback 后才更新列表。

### Screen: stocktaking-unit-settings

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=库存管理的库存对象名称链接打开 InventoryDetailDrawer；“盘点设置”打开当前 Drawer 内的设置面。
ACTOR=门店库存维护运营用户
BUSINESS_SCENARIO=查看库存余额的消耗单位，并按包装单位设置盘点录入便利。
BUSINESS_GOAL=确认库存余额和配方不被改写，只为录入设置可审计的盘点换算。
USER_VISIBLE_COPY=库存对象详情；消耗单位；来自商品基础计量单位；盘点设置；盘点单位；请选择盘点单位；1个盘点单位等于；个消耗单位；库存余额仍按；保存盘点设置；取消；盘点单位与消耗单位相同时，换算固定为1；换算必须大于0。
TECHNICAL_BOUNDARY=消耗单位快照来自关联商品或 SKU，不能在库存页改选；换算数值、单位状态、库存权限、余额和历史记录由 inventory owner 最终核验。
FOUNDATION_PRIMITIVE=adminWideDrawerSurfaceProps,useDrawerFormLifecycle,useDirtyFormLock,useOverlayLock,useSubmissionLifecycle,useAsyncGenerationGuard
CONTAINER_LAYOUT=宽高与来源：adminWideDrawerSurfaceProps；不得超出视口：库存详情 Drawer 外框、标题、只读消耗单位、盘点表单和底部保存区；唯一纵向滚动：Drawer body，盘点表单不另造纵向滚动祖先；关键对齐：只读消耗单位的说明、盘点单位候选和换算输入从同一输入列开始，单位名称紧随换算数字，底部保存区固定。1280px 以下若 Drawer 横向滚动，或盘点表单与 Drawer body 同时纵向滚动，即不成立。
```

```text
┌ 库存对象详情 · 面粉 ─────────────────────────────────────────────┐
│ 消耗单位        克                                                    │
│                 来自商品基础计量单位，不能在此修改                    │
├ 盘点设置 ────────────────────────────────────────────────────────┤
│ 盘点单位        [包 ▼]                                               │
│ 1 个盘点单位等于 [1000________] 个消耗单位（克）                     │
│ 提示：库存余额仍按克记录。                                           │
├────────────────────────────────────────────── [取消] [保存盘点设置]┤
└─────────────────────────────────────────────────────────────────┘
```

**盘点规则**：盘点单位是当前范围内、与消耗单位**同一单位类别**的启用单位单选候选；消耗单位只读，绝不成为候选框。盘点单位与消耗单位相同，换算固定为 `1` 且不允许另填。不同单位时换算必须是正数、有限并能审计；盘点输入先按盘点单位自身 precision 向零截断，换算结果再按消耗单位 precision 向零截断，不显示“四舍五入”或内部算法名称。保存盘点设置不会改余额单位、配方单位或历史流水。

### Screen: brand-copy-unit-check

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=商品工作台“从品牌复制”打开 BrandCatalogCopyDrawer，进入预检结果步骤。
ACTOR=总部商品维护运营用户
BUSINESS_SCENARIO=在把总部商品复制到门店前，确认商品、SKU 和库存/BOM所需单位能在门店中正确对应。
BUSINESS_GOAL=看清哪些单位将复制/对应、哪些冲突阻止复制，避免门店继续指向总部单位或把不同含义的单位当作同一个。
USER_VISIBLE_COPY=复制检查；计量单位处理结果；将复制到门店；门店已有可使用的计量单位；暂时不能复制；同编码的计量单位含义不一致；请先整理门店中的计量单位后重试；关闭；继续复制。
TECHNICAL_BOUNDARY=复制闭包、单位语义、目标门店对应、预检摘要和执行前重检由 copy coordinator 与 catalog/inventory owners 确定；不显示 scope/ref/digest。
FOUNDATION_PRIMITIVE=adminWideDrawerSurfaceProps,useDrawerFormLifecycle,useOverlayLock,adminListState
CONTAINER_LAYOUT=宽高与来源：adminWideDrawerSurfaceProps；不得超出视口：Drawer 外框、步骤标题、单位处理结果表和底部操作区；唯一纵向滚动：Drawer body，结果表不另造纵向滚动祖先；关键对齐：单位名称、编码、处理结果、原因按表头列对齐，长原因换行但不撑宽，底部“关闭/继续复制”固定。1280px 以下若 Drawer 横向滚动，或结果表与 Drawer body 同时纵向滚动，即不成立。
```

```text
┌ 复制检查 ─────────────────────────────────────────────────────────┐
│ 计量单位处理结果                                                     │
│ 名称 │ 编码 │ 结果                       │ 原因                     │
│ 克   │ g    │ 将复制到门店               │ 门店尚无此单位           │
│ 千克 │ kg   │ 暂时不能复制               │ 同编码单位类别或小数位数不同 │
│ 请先整理门店中的计量单位后重试。                                    │
├──────────────────────────────────────────────────── [关闭] ──────┤
└─────────────────────────────────────────────────────────────────┘
```

**复制规则**：不存在阻断项时才显示“继续复制”。相同编码但名称、单位类别或小数位数不同是硬阻断，不提供“复用、覆盖或仍然继续”的确认按钮。执行前服务端重新预检；成功后的商品、SKU、库存/BOM只读回门店单位，不显示总部单位。

## 4.1 表单控件依赖图

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 单位库查找 | 完整列表上的名称/编码包含筛选 Input | 当前范围 bounded 单位列表 | 无 | 清空查询恢复完整列表 | 只影响展示 | 列表加载；空态“当前没有计量单位”；失败可重试 | 不进入 mutation |
| 单位名称 | Input | 用户填写/新建或列表行编辑表单 | 无 | 改名后只刷新本行和候选标签 | 非空、当前范围合法 | 新建时无初始值；失败保留文本 | 编码唯一范围、状态和改名权限 |
| 单位编码 | Input | 新建表单/列表行编辑表单 | 零引用单位可填；已被使用后只读 | 无 | 非空、同范围唯一 | 失败保留输入 | 当前引用、不可变、唯一性 |
| 单位类别 | 固定 Select | 已裁定单位类别词表/列表行编辑表单 | 零引用单位可选；已被使用后只读 | 改变前不生成隐式换算 | 数量/重量/体积/服务时长/包装 | 无候选不应发生；失败保留 | 当前引用、不可变、合法类别 |
| 小数位数 | 非负整数 Number Input | 用户填写/列表行编辑表单 | 零引用单位可选；已被使用后只读 | 无 | 非负整数；0显示“只能填写整数”；不预设业务最大值 | 失败保留 | 当前引用、不可变、合法精度 |
| 销售单位 | 单选 searchable Select | catalog 启用单位 bounded 候选 | 当前商品可销售或需预置销售口径 | 清除旧单值；不影响标签 | 一次仅一项；已停用当前值只读 | 候选加载；无启用单位提示先维护计量单位；失败可重试 | 形态/销售能力/单位状态 |
| 基础计量单位 | 单选 searchable Select | catalog 启用单位 bounded 候选 | 当前商品直接库存管理或作为配方原料时必选；关联非零库存余额时固定只读 | 清除旧单值；库存事实不在浏览器改写；非零库存余额时不提供清除或重选 | 一次仅一项；已停用当前值只读；非零库存余额时显示“商品已有库存余额，暂不能修改基础计量单位” | 同上 | 库存/BOM需要、单位状态；保存事务内 `CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED` |
| SKU 继承/覆盖 | 单选 Radio + 单选 searchable Select | 当前商品默认值、SKU detail、启用单位候选 | 先确定商品默认值或明确 SKU 自行覆盖 | 选继承即清覆盖；商品默认值变化重读继承显示 | 每项覆盖一次仅一项 | 无默认值时继承态显示未设置；失败保留草稿 | SKU状态、有效单位解析 |
| 盘点单位 | 单选 searchable Select | catalog 启用单位 Bounded 候选，按已读消耗单位类别过滤 | 已取得只读消耗单位及其单位类别 | 改盘点单位重置换算；同单位固定为1 | 一次仅一项、只出现同类别单位 | 候选加载；无候选提示先维护同类别计量单位 | 权限、启用状态、单位类别、不能替代消耗单位 |
| 换算数量 | Decimal Input | 当前盘点设置/用户输入 | 先选盘点单位；消耗单位由详情只读给出 | 改盘点单位重算为1或清空 | 正数、有限；目标单位小数位数适用向零截断 | 非法值显示字段提示；失败保留输入 | owner重复检查、余额单位不变 |

## 4.2 新建、编辑与确认 mutation 字段事实矩阵

`FORM_MUTATION_DENOMINATOR`：create-unit、update-zero-reference-unit、rename-referenced-unit、delete-unit、transition-unit-status、save-item-unit-settings、save-sku-unit-overrides、save-stocktaking-unit-conversion、copy-preflight、copy-execute。每个 variant 的当前商品库/门店、授权、版本、幂等信息和 owner readback 都是 `HIDDEN_OWNER_FACT`，不能由页面猜测或从已加载列表拼出。

| command variant | 业务字段或 command 事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request 取值与唯一来源 | 变更、级联与校验 | command owner 最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| create-unit | 名称、编码、单位类别、小数位数 | 单位名称、单位编码、单位类别、小数位数 | EDITABLE | FR-UNIT-01/02 | 用户输入 | 0表示只能填写整数；不造全局换算 | catalog 当前范围唯一/授权/类别/数值 | 留在 Drawer，显示具体字段原因 |
| update-zero-reference-unit | 名称、编码、单位类别、小数位数 | 单位名称、单位编码、单位类别、小数位数 | EDITABLE | Dexter 生命周期裁定 | latest detail + 用户输入 | 只在零引用时可保存；保存前期间若被引用，改为只允许名称 | catalog 版本、授权、引用数、唯一性和合法性 | 保留详情，提示“已被使用，只能修改名称” |
| rename-referenced-unit | 单位名称 | 单位名称 | EDITABLE | Dexter 生命周期裁定 | latest detail + 用户输入 | 不改变编码、类别、小数位数、已有配置或历史快照 | catalog 版本/授权/已引用仍仅允许改名 | 保留详情与输入，重读最新名称 |
| rename-referenced-unit | 编码、单位类别、小数位数 | 已被使用后不可修改 | FIXED_READONLY | Dexter 生命周期裁定 | latest detail | 需要不同含义时新建单位、后续重新选择 | catalog 拒绝改写 | 不提供提交字段 |
| delete-unit | 删除确认中的名称、当前引用判定 | 删除计量单位、确认删除 | CONDITIONAL_EDITABLE + HIDDEN_OWNER_FACT | Dexter 生命周期裁定 | 最新列表行 + owner readback + 确认动作 | 仅零引用单位可见；若最新 readback 有任意引用，隐藏动作并拒绝删除 | catalog 重新检查引用、版本与授权 | 拒绝时保留当前列表，显示“该计量单位正在使用，不能删除。” |
| transition-unit-status | 启用/停用、引用影响 | 停用计量单位/确认停用 | CONDITIONAL_EDITABLE + HIDDEN_OWNER_FACT | Dexter 生命周期裁定 | 最新列表行 + 确认动作 | 停用只排除未来候选，不改写已有配置与历史快照；已引用时不显示删除 | catalog 判断版本、引用、授权和有效状态 | 不确定时重读，不显示“已停用” |
| save-item-unit-settings | 商品默认销售单位、商品默认基础计量单位 | 销售单位、基础计量单位 | CONDITIONAL_EDITABLE | FR-UNIT-03/05 | 启用单位候选或已保存停用值 | 单值；可销售/库存/BOM条件决定必填 | catalog 判断有效销售/基础单位 | 字段错误保留在基础 Tab |
| save-sku-unit-overrides | SKU销售单位覆盖、SKU基础计量单位覆盖、继承标志 | 继承商品…/改为此SKU的… | CONDITIONAL_EDITABLE | FR-UNIT-03/05/04 | SKU detail、商品默认值、启用单位候选 | 继承清覆盖；覆盖单值 | catalog 判断 SKU 实际有效值 | 展开行保留草稿，重读最新 SKU |
| save-stocktaking-unit-conversion | 盘点单位、1盘点单位等于消耗单位数量 | 盘点单位、换算数量 | EDITABLE + FIXED_READONLY | FR-UNIT-06/07 | 启用候选/用户输入/StockTarget detail | 消耗单位只读；同单位=1；正数有限；目标精度向零截断 | inventory 判断余额单位、权限、换算 | 字段提示，余额/BOM不变 |
| copy-preflight | 源、目标、单位处理结果 | 复制检查、单位处理结果 | HIDDEN_OWNER_FACT | FR-UNIT-12 | copy owner readback | 同编码不同语义阻断 | coordinator 重新判断闭包与映射 | 保留检查结果，不能本地改成可继续 |
| copy-execute | 已通过预检的复制范围 | 继续复制 | HIDDEN_OWNER_FACT | FR-UNIT-12 | fresh preflight/readback | 执行前重检，不保留总部单位 | coordinator + catalog/inventory | 过期或冲突不写入，回到预检 |

## 4.3 搜索与候选选择详设

`SEARCH_CAPABILITY_DENOMINATOR`：metadata-unit-library-tab（APPLICABLE）；item-basic-unit-settings（APPLICABLE）；sku-unit-settings（APPLICABLE）；stocktaking-unit-settings（APPLICABLE）；catalog-metadata-modal 与 brand-copy-unit-check（NOT_APPLICABLE_WITH_REASON：只有 Tab/只读结果，没有由用户查找或选择业务对象的控件）；unit-library-row-edit-modal 的名称/编码/类别/小数位数（NOT_APPLICABLE_WITH_REASON：它们是用户输入或固定词表，不是增长型候选）。

**统一候选查询协议（适用于所有单位候选）**：

| 协议项 | 声明 |
| --- | --- |
| `subjectType` | `ITEM_SALES_UNIT`、`ITEM_BASE_UNIT`、`SKU_SALES_UNIT_OVERRIDE`、`SKU_BASE_UNIT_OVERRIDE` 或 `STOCKTAKING_UNIT`。 |
| 依赖 | 当前商品库范围、字段角色；`STOCKTAKING_UNIT` 额外依赖已读出的 target 消耗单位类别。依赖未就绪时不发候选请求。 |
| 查询 | 前四类调用 `listOperationsCatalogUnits(includeInactive=false)`；盘点调用同一 operation 并带 `dimension={target消耗单位类别}`。结果是至多99条完整 Bounded 集合，按名称、编码稳定排序；用户输入只在该集合中匹配名称/编码。 |
| 取消与重读 | `useAsyncGenerationGuard` 在范围、商品、SKU、target、消耗单位类别变化或宿主关闭时作废旧请求；单位 mutation 的统一 refresh 仅使当前候选重读，不覆盖 dirty 草稿。 |
| 返回与失败 | 返回 `unitRef/name/code/dimension/precision/status`；停用单位不在候选；空/加载/失败沿各字段声明处理，失败可重试且绝不降级为自由文本。 |
| 请求信封 | `queryText?`：不发送；本批完整 Bounded 集合仅在客户端按名称/编码筛选。`page?`、`pageSize?`：不发送；`consistencyToken?`：不使用。`dependencies[]`：`[scope,subjectType]`，盘点额外为 `[targetRef,consumptionUnit.dimension]`。 |
| 返回信封 | 统一为 `{ items: UnitCandidate[], dependencies: EchoedDependencies }`；`items[]` 永远是完整 Bounded 集合，不出现 next cursor、hasMore 或部分页。 |

| screen / 业务对象 / 用户问题 | 条件的用户可见文案 | 匹配语义与控件形态 | 值或候选的唯一来源 | 上游级联、清理与重载 | 请求/提交 owner 核验 | 适合性与排除的替代方案 | contract 缺口或不适用处置 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| metadata-unit-library-tab / 计量单位 / 找到本范围内的单位 | 按名称或编码查找 | 完整 bounded 列表内的包含筛选 Input | catalog 单位库完整列表 | 清空筛选恢复完整列表；保存/停用后重读完整列表 | catalog 限定当前范围 | 至多99条，完整集合筛选比额外搜索接口直接；不用分页/游标 | GAP：需新单位库 list read，明确限制≤99，超限失败而非截断 |
| item-basic-unit-settings / 启用单位 / 选择商品的单一销售或基础单位 | 销售单位、基础计量单位 | searchable Select；输入匹配名称或编码 | `listOperationsCatalogUnits` 默认启用视图；完整 bounded 返回 | 商品范围变化取消旧请求并清空新建草稿；清除当前值后不可恢复停用候选 | catalog 对商品能力、单位启用与单值性复核 | 候选≤99，搜索可处理重名/名称定位；不用自由文本或多选 | GAP：新增单位 Bounded list operation及商品单值字段 |
| sku-unit-settings / 启用单位 / 选择 SKU 覆盖单位 | 改为此SKU的销售单位、改为此SKU的基础计量单位 | searchable Select；同一 consumer protocol | `listOperationsCatalogUnits` 默认启用视图；完整 bounded 返回 | 选继承取消候选请求并清覆盖；商品默认值变更后重读继承值 | catalog 对 SKU/商品关系、能力、启用状态复核 | 有明确业务对象且≤99；不用 SKU 表全量文本过滤伪造候选 | GAP：SKU单值覆盖字段/readback；候选不另建 SKU cursor task read |
| stocktaking-unit-settings / 启用单位 / 选择盘点录入单位 | 盘点单位 | searchable Select；同一 consumer protocol | `listOperationsCatalogUnits(includeInactive=false,dimension={target消耗单位类别})` | 消耗单位读取后才开放盘点选择；消耗单位类别变化即取消旧读取、清空盘点单位/换算；选择同消耗单位固定换算1，不同单位清空旧换算 | inventory 最终验证当前门店、单位启用、同类别和换算 | 盘点也是统一单位库候选；不使用库存自由文本或另建单位库 | GAP：catalog bounded list 增 `dimension` 过滤；inventory command 改接同类别 unitRef，不允许 string unit |

## 5. 状态与边界表

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face 边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 单位库读取与筛选 | Modal 内骨架；保留上次完整列表直至新列表可用 | 不适用 | 不适用 | 最新列表与当前筛选同时可见 | 仅显示业务错误，可重试读取 | 不把旧列表称为最新，重试读取 | catalog 决定当前范围与列表内容 |
| 新建/改名单位 | 列表读取完成后打开编辑 Modal | 名称、编码、类别、小数位数；已引用单位改名仅名称 | 禁用重复保存并保留生命周期锁 | 关闭 Modal、列表/候选重读；零引用单位仍可修改全部字段，已引用单位编码/类别/小数位数只读 | 唯一、版本、状态或授权失败保留输入 | 不宣称成功，重读后再试 | catalog 拥有单位定义 |
| 删除/停用 | 读取最新引用和状态 | 删除仅零引用；停用确认必须理解“已有记录不变” | 防重复提交 | 删除则列表移除；停用则当前列表状态和未来候选更新 | 引用变为非零时拒绝删除，提示“该计量单位正在使用，不能删除。” | 重新读取最新状态 | catalog 判断引用/授权；前端不能凭引用数字决定 |
| 保存商品/SKU单位 | 候选加载时禁用选择；既有值优先；有非零库存余额时基础计量单位固定只读 | 单值与形态/销售/库存/BOM必填关系；基础计量单位变更由保存事务内安全守卫拒绝 | Drawer 保存锁 | 显示有效单位；刷新库存/BOM相关 readback | 显示“商品已有库存余额，暂不能修改基础计量单位”；草稿不被清空 | 查询最新资料再决定重试 | catalog 最终解析继承与覆盖；不静默同步既有 target |
| 保存盘点设置 | 消耗单位先读取；候选随后打开 | 正数有限、同单位=1、目标位数截断 | 禁止重复保存 | 换算摘要更新；余额/配方/历史单位保持不变 | 业务错误保留输入 | 重读库存详情；不假定余额变动 | inventory 拥有库存与换算 |
| 品牌复制预检/执行 | 显示检查中 | 前端不计算映射 | 执行前重检，禁重复 | 目标门店 detail 只出现目标单位 | 任何语义冲突硬阻断，不显示继续 | 只重新预检 | coordinator 与 catalog/inventory 共同决定 |

## 6. 逐操作任务合理性

| 操作 | 批准 Journey 来源 | 用户为何此时操作 | 是否有更短路径 | 不选替代的理由 | 约束归因（产品/owner/contract/旧文档） | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- | --- | --- |
| 打开商品元数据并进入计量单位 | Journey `J-UNIT-001` | 在同一商品库维护基础资料 | 顶层新增单位库 Tab | 商品元数据已有正确上下文；第二入口会制造多处真相 | 产品：FR-UNIT-13 | 否 |
| 按名称或编码筛选单位 | Journey `J-UNIT-001` | 十几到百条单位中定位目标 | 分页或新建搜索页 | 当前 bounded 完整集合，筛选最快且不改变权限范围 | Dexter 规模裁定 | 否 |
| 新建计量单位 | Journey `J-UNIT-001` | 当前范围没有可用单位时建立合法候选 | 商品输入自由文本 | 单位需复用并带类别、小数位数和状态 | 产品：FR-UNIT-01/02 | 否 |
| 编辑单位 | Journey `J-UNIT-001` | 零引用单位可修正定义；已引用单位只维护业务名称 | 行内编辑全部字段 | 编辑 Modal 依据最新引用事实区分完整编辑与仅名称可改，保留停用影响说明 | Dexter 生命周期裁定 | 否 |
| 删除零引用单位 | Journey `J-UNIT-001` | 清理尚未被任何业务资料使用的错误单位 | 停用 | 零引用时删除不会伤及既有商品、库存或历史；owner 在提交时仍重新检查 | Dexter 生命周期裁定 / catalog owner | 否 |
| 停用 | Journey `J-UNIT-001` | 阻止以后选择过时单位但保留已有记录 | 删除单位 | 删除会破坏既有引用和历史含义；停用满足业务目标 | Dexter 生命周期裁定 | 否 |
| 选择商品销售/基础单位 | Journey `J-UNIT-001` | 确定销售和库存/BOM两个不同口径 | 一个多选“销售单位” | 多选无法说明一件商品是什么；两个字段各有固定业务职责 | 产品：FR-UNIT-03/05 | 否 |
| SKU继承或覆盖 | Journey `J-UNIT-001` | 包装/价格/条码/扣减不同的 SKU 需独立口径 | 商品多选多个单位 | 覆盖可表达真实 SKU 差异，继承避免重复维护 | 产品：FR-UNIT-04 | 否 |
| 配置盘点单位换算 | Journey `J-UNIT-001` | 按包等包装录入盘点，不改变库存真相 | 改库存消耗单位 | 余额与配方必须继续按消耗单位；盘点仅是输入便利 | 产品：FR-UNIT-06/07 | 否 |
| 查看单位复制检查 | Journey `J-UNIT-001` | 复制前识别门店不能安全使用的单位 | 自动复用或覆盖 | 同编码不同含义必须阻断，不能把选择交给用户确认 | 产品：FR-UNIT-12 | 否 |

## 7. Face / owner 对齐矩阵

| 屏幕/动作 | consumer face | 页面准入 | server operation | owner readback / command | 不可由前端替代的判定 |
| --- | --- | --- | --- | --- | --- |
| 商品元数据/计量单位库 | operations-admin | 当前商品库页面访问与商品资料维护授权 | 新增 unit library read/create/rename/status edge operations | catalog unit owner | 当前范围、唯一性、已引用判断、状态变更权限 |
| 商品与SKU单位设置 | operations-admin | 商品详情编辑授权 | item/SKU detail + save operations | catalog item/SKU owner | 形态能力、单值、继承/覆盖、停用候选和版本 |
| 库存消耗单位与盘点设置 | operations-admin | 门店库存对象查看/编辑授权 | StockTarget detail + configuration command | inventory owner；catalog 仅提供单位候选 read | 消耗单位快照、余额单位、换算、历史解释 |
| 单位复制检查 | operations-admin | 品牌复制授权 | copy preflight/execute | copy coordinator + catalog/inventory owners | 单位语义、闭包、目标门店重写、执行前重检 |

## 8. Manifest B.4/B.5 命中对照

| manifest 条文 | 本 Journey 的命中或不适用理由 | 遵循方式 / 待 Dexter 裁决 | Heritage 原文（冻结路径@hash） |
| --- | --- | --- | --- |
| B.4 前端架构与状态 | 命中：Modal/Drawer 表单状态、全局内容页刷新、候选读取和提交错误均使用 foundation。 | `useDrawerFormLifecycle` 管理所有可变 Drawer；候选不能由已加载表格或 URL 推导。 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/admin-frontend-runtime-architecture-must-not-follow-journey-ids.md@registry-selected` |
| B.5 交互与信息架构 | 命中：名称首列进入详情、单位库只在商品元数据 Modal、库存消耗单位只读、盘点设置独立于余额。 | 低保真线框逐面声明唯一滚动容器、可见业务语言和操作分母。 | 同上 |
| 高保真 demo | N/A | 单位维护、单值选择与盘点换算可由低保真结构充分裁决；不新增静态 demo。 | N/A |

## 9. Surface ownership 自检

| screen id | 声明 UI_SURFACE | 线框可见元素分母 | 每项是否属于当前 surface | USER_VISIBLE_COPY 可见项是否全有位置 | 结论 |
| --- | --- | --- | --- | --- | --- |
| catalog-metadata-modal | Modal | 标题、六个Tab、关闭 | 是 | 是 | PASS |
| metadata-unit-library-tab | 内容 Tab | 标题、查询、表头、名称文本、新建/状态动作 | 是 | 是 | PASS |
| unit-lifecycle-confirm-modal | Modal | 删除/停用确认、影响说明、取消/确认 | 是 | 是 | PASS |
| unit-library-row-edit-modal | Modal | 标题、四字段、使用说明、停用确认、保存/取消 | 是 | 是 | PASS |
| item-basic-unit-settings | 内容 Tab | 销售单位、基础计量单位、已停用提示 | 是 | 是 | PASS |
| unit-candidate-picker | 表单控件 | 查询、候选名称/编码/类别/小数位数、空态/重试 | 是 | 是 | PASS |
| sku-unit-settings | 内容 Tab | SKU列表、展开设置、继承/覆盖候选 | 是 | 是 | PASS |
| stocktaking-unit-settings | Drawer | 消耗单位只读、盘点单位、换算、保存/取消 | 是 | 是 | PASS |
| brand-copy-unit-check | Drawer | 复制检查、结果表、原因、关闭/继续复制 | 是 | 是 | PASS |

## 10. Dexter 看图结论

- 看图日期：`UNSET`
- 低保真线框结论：`UNSET`
- 高保真 demo 结论：`NOT_REQUIRED`
- 修改意见/已接受的操作顺序：`待 Dexter 看图。`
- 允许进入 implementation-facing design：**否**；原因是本工件的 `DEXTER_WIREFRAME_REVIEW=UNSET`，不构成实现授权。

---
title: 商品属性库、点单选项库与两步新建 UI 交互工件
status: DEXTER_WIREFRAME_REVISION_REQUIRED
createdAt: 2026-08-20
implementationAuthority: false
---

# 交互工件：CATALOG_LIBRARY_CONFIGURATION 商品属性库、点单选项库与两步新建

## 1. 工件元数据

```text
JOURNEY_DECISION=doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md#7-dexter-裁决
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md#3-正式功能需求
BUSINESS_PROBLEM=相同属性/点单规则在每个商品内重复创建，造成取值、顺序和扣料意图不一致。
BUSINESS_USER_OR_OWNER=总部或门店当前商品库的商品维护运营用户。
CURRENT_TASK=维护私有定义库、配置商品，并两步创建商品。
SUCCESS_OUTCOME=定义可复用，商品只维护自己的填写内容；创建草稿商品后直接编辑。
UI_BEARING=true
SKILL_USED=cs-spec-to-plan
DEXTER_WIREFRAME_REVIEW=REVISE@2026-08-20（Dexter 裁定：取消商品工作台整个顶层 Tab 容器；两个定义库必须置于既有“商品元数据”Modal，与商品标签、销售单位、SKU 销售属性、商品处理标签并列）
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=operations-admin
```

## 2. Interaction map

| 顺序 | 前提 | route / 屏幕 | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 当前商品库可查看 | `/operations/:workspace/catalog/...` 的商品管理内容页 | 查看和维护商品；需要维护共享资料时进入商品元数据 | 无顶层 Tab 容器的商品主面；商品元数据按钮；首列名称进入详情 | 当前商品库、列表与可操作范围 | 留在商品主面，或打开商品元数据 Modal | 保留上次成功数据并显示读取失败。 |
| 1a | 当前商品库可查看 | 商品元数据 Modal | 在一个集中入口维护商品相关资料，而不离开商品工作台 | 商品标签、销售单位、SKU 销售属性、商品处理标签、商品属性库、点单选项库六个并列 Tab | 当前商品库、元数据与可操作范围 | 当前 Tab；关闭则返回无顶层 Tab 的商品主面 | 保留上次成功数据并显示读取失败。 |
| 2 | 可维护商品库 | 新建商品弹窗 | 确定不能更改的商品形态并创建最少资料的草稿商品 | 编码、名称、可不选的单一分类树、形态说明 | 返回新商品资料 | 弹窗完全关闭后打开商品编辑抽屉 | 字段错误留在弹窗；取消不创建。 |
| 3 | 草稿或已有商品可维护 | 商品编辑抽屉 / 属性页签 | 从库选择属性并按类型填写值 | 属性选择、文本/单选/多选填写 | 属性与填写内容的保存结果 | 留在抽屉 | 保存失败不丢草稿。 |
| 4 | 草稿或已有商品可维护 | 商品编辑抽屉 / 点单选项页签 | 选择库中点单选项并维护本商品设置 | 三栏：已添加点单选项、本商品设置、只读库预览 | 点单选项、可选项、扣料原料与原料用量保存结果 | 留在抽屉 | 业务规则错误定位到设置项。 |
| 5 | 可维护当前商品库 | 商品元数据 Modal / 商品属性库 Tab 与属性定义抽屉 | 维护属性定义及选择项；可改编码/可级联删除 | 列表、详情、删除影响确认 | 定义详情 / 删除结果 | 返回商品元数据内的属性库并刷新受影响商品详情 | 删除失败不关闭详情。 |
| 6 | 可维护当前商品库 | 商品元数据 Modal / 点单选项库 Tab 与定义抽屉 | 维护点单选项、可选项、顾客端顺序和扣料原料 | 基本资料 + 可排序可选项表 + 当前可选项的扣料原料面板；一次保存整项定义 | 原材料候选与定义详情 | 返回商品元数据内的选项库并刷新受影响商品详情 | 原材料不可用、可选项为空或待删除项未确认时阻止保存。 |
| 7 | 总部→门店复制入口 | 品牌复制抽屉 / 复制检查结果 | 看见同编码定义不一致并停止复制 | 不可复制的定义、差异原因 | 最新复制检查结果 | 仅没有阻断时可继续既有复制流程 | 没有确认或覆盖路径。 |

## 3. v2 对应页面盘点

检索范围为 frozen all-v2 registry 与 `doc/heritage/frozen/catering-all-v2` 中 catalog、商品、属性、点单选项、两步创建词干；未发现与本 Journey 的“私有定义库 + 商品设置覆盖 + 扣料原料”同一用户任务。现有 catalog workbench 的视觉/交互先例在 v2s 当前生产源码而非 Heritage，不能把它伪称为 all-v2 counterpart。

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线 / 摹本标注 | 差异及原因 |
| --- | --- | --- | --- | --- |
| catalog-workbench / catalog-metadata-modal | `PARTIAL_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | 以 v2s 当前 `CatalogDictionaryDrawer` 的商品元数据 Modal 为静态基线；检索范围见本节。 | 工作台取消整个顶层 Tab 容器、商品主面直出；两个私有定义库与既有四类商品元数据并列于同一 Modal。 |
| item-create-modal | `NO_V2_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | 新画。 | 新裁决：Modal、单分类、形态充分说明、DRAFT→编辑 Drawer。 |
| item-attribute-tab / item-option-tab | `PARTIAL_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | 保留当前 v2s 三栏与 Drawer 密度作为静态基线，不继承旧业务语义。 | 质量修复/新裁决：删除 JSON、内联定义和 FIXED。 |
| metadata-attribute-library-tab / metadata-option-library-tab / copy-conflict | `PARTIAL_COUNTERPART` | `PENDING_HERITAGE_REGISTRATION` | 两个定义库复用现有商品元数据 Modal 的 Tab 容器；库列表与定义 Drawer 为本批新画。 | 定义库不是 SKU 销售属性，亦不是商品工作台内容页。 |

### 3.1 面向运营用户的文案规则

线框和 `USER_VISIBLE_COPY` 只使用运营人员能从业务任务理解的词：**点单选项、可选项、扣料原料、原材料商品、每份用量、计量单位、草稿商品、暂时不能复制**。实现概念（例如 `StockTarget`、BOM、owner、ref、scope、组件、事务、状态枚举）只能放在 `TECHNICAL_BOUNDARY`、字段事实矩阵或后续详设中，不能出现在按钮、字段标签、空态、校验提示、确认提示或列表列名。

特别是动态数据采用“点单选项 → 可选项 → 扣料原料”的可见层级：左侧可选项表只用“无 / N种”概览扣料原料，右侧只展示当前选中可选项的原材料商品和计量单位；不向用户暴露“组件数”“库存对象”或内部身份字段。该规则来源于 `project-memory/decisions/confirmed-business-language-corpus.md` 的业务语料和本 Journey 的“原材料商品、每份用量”裁决。

## 4. 低保真线框与逐屏声明

### Screen: catalog-workbench

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容页
HOST_AND_ENTRY=CatalogWorkbenchPage；运营管理后台商品目录入口；“商品元数据”打开 `CatalogDictionaryDrawer` Modal。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=在当前总部或门店商品库查看或维护商品；需要统一维护商品资料时再打开商品元数据。
BUSINESS_GOAL=在无顶层 Tab 容器的商品主面完成商品任务；商品属性库和点单选项库只从商品元数据进入，不混同 SKU 销售属性。
USER_VISIBLE_COPY=商品；商品元数据；新建商品；复制到门店；名称；编码；分类；商品形态；暂无商品。
TECHNICAL_BOUNDARY=当前 scope、页面准入和写 capability 由服务端/会话决定；不显示 ref、owner 或 schema。
FOUNDATION_PRIMITIVE=adminListState, operationsContentTabRefreshSignal（现有 operations app export）
CONTAINER_LAYOUT=宽高与来源：沿用 CatalogWorkbenchPage 宿主内容区，不在 app 内另设固定页宽；不得超出视口：内容页外框、商品主面标题/操作区、列表表头和“商品元数据/复制到门店/新建商品”操作区；唯一纵向滚动：宿主内容区；关键对齐：商品主面标题与右侧操作区同一基线，表头与列内容按同一列宽。1280px 以下若出现页面横向滚动条，或宿主内容区外再出现第二个纵向滚动条，即不成立。
```

```text
┌ 商品目录 ─────────────────────────────────────────────┐
│ 商品                         [商品元数据] [复制到门店] [+ 新建商品] │
├──────────────────────────────────────────────────────┤
│ 名称(可点击) | 编码 | 分类 | 商品形态 | 状态                         │
│ 美式薯条      | FF001| 小食 | 普通销售 | 草稿                         │
└──────────────────────────────────────────────────────┘
```

`SEARCH_CAPABILITY_DENOMINATOR=APPLICABLE：商品列表按现有 owner 提供的名称/编码搜索。商品属性库与点单选项库的搜索属于商品元数据 Modal 内对应 Tab 的独立读取任务，绝不在商品工作台从已加载行反推。`

### Screen: catalog-metadata-modal

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CatalogWorkbenchPage 的“商品元数据”按钮打开既有 CatalogDictionaryDrawer；仅当前商品库已选定时可打开。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=需要集中维护商品标签、销售单位、SKU 销售属性、商品处理标签，或可复用的商品属性和点单选项。
BUSINESS_GOAL=在同一个商品元数据入口选择正确的资料类别；商品属性库与 SKU 销售属性保持独立。
USER_VISIBLE_COPY=商品元数据；商品标签；销售单位；SKU 销售属性；商品处理标签；商品属性库；点单选项库；关闭。
TECHNICAL_BOUNDARY=CatalogDictionaryDrawer 是既有 Modal 容器；六个 Tab 各自读取当前商品库事实，定义库的关系事实与 SKU 销售属性分离；不显示 ref、owner、scope 或 schema。
FOUNDATION_PRIMITIVE=useDrawerFormLifecycle（既有 CatalogDictionaryDrawer 的 Modal 生命周期）；CatalogDefinitionLibraries（现有业务内容容器）
CONTAINER_LAYOUT=宽高与来源：沿用既有 CatalogDictionaryDrawer 的 Modal 宽度与 body 最大高度；不得超出视口：Modal 外框、标题、六个 Tab 头和关闭控件；唯一纵向滚动：Modal body，Tab 内容不得自行创建第二个纵向滚动祖先；关键对齐：六个 Tab 在同一 Tab 行，内容区表头、标题和操作区沿 Modal 内容栅格对齐。1280px 以下若出现 Modal 横向滚动条，或 Modal body 与 Tab 内容同时纵向滚动，即不成立。
```

```text
┌ 商品元数据 ───────────────────────────────────────────┐
│ [商品标签] [销售单位] [SKU 销售属性] [商品处理标签]     │
│ [商品属性库] [点单选项库]                         [关闭] │
├──────────────────────────────────────────────────────┤
│ <当前资料类别的列表、说明和操作区>                       │
└──────────────────────────────────────────────────────┘
```

控件依赖：打开时保留既有元数据初始 Tab 规则；切换到商品属性库或点单选项库只读取相应定义库，不把 SKU 销售属性或其它 Tab 的数据当候选；在定义详情 Drawer 保存或删除后，仍停留在原商品元数据 Tab，刷新该库和受影响商品详情；关闭 Modal 不撤销已成功保存的结果。

### Screen: item-create-modal

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Modal
HOST_AND_ENTRY=CatalogWorkbenchPage 的“新建商品”；仅当前 scope 有写 capability 时可打开。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=尚未创建商品，需先确认商品的最小身份与不可改形态。
BUSINESS_GOAL=一次创建一个带可空单分类的草稿商品，并进入编辑抽屉。
USER_VISIBLE_COPY=新建商品；商品编码；商品名称；分类（可不选）；商品形态；创建后不可修改；形态说明；取消；创建并继续编辑；请选择分类；创建失败，请检查后重试。
TECHNICAL_BOUNDARY=shapeKey、categoryRef、scope、idempotency 和 DRAFT 状态由 owner 核验；不显示 attributes JSON。
FOUNDATION_PRIMITIVE=useOverlayLock,useSubmissionLifecycle,createContentIdempotencyKey,useDetailDrawer
CONTAINER_LAYOUT=宽高与来源：Ant Design Modal，内容宽度由两列“编码/名称”表单与形态说明所需宽度决定，窄屏时以视口左右留白收缩而不横向滚动；不得超出视口：Modal 外框、标题、形态说明和底部“取消/创建并继续编辑”操作区；唯一纵向滚动：Modal body；关键对齐：编码/名称同一栅格基线，分类、形态说明与底部主操作左/右对齐。1280px 以下若出现 Modal 横向滚动条，或 body 与 Modal 同时纵向滚动，即不成立。
```

```text
┌ 新建商品 ────────────────────────────────────────────┐
│ 商品编码 [____________]   商品名称 [________________] │
│ 分类(可不选) [在分类树中选择一个分类 ▼]                │
│ 商品形态  ○ 普通销售  ○ 原材料  ○ 套餐  ○ 服务 …       │
│ ┌ 形态说明 ────────────────────────────────────────┐ │
│ │ 此形态决定是否维护规格、计量方式和原料用量；创建后不可修改 │ │
│ └─────────────────────────────────────────────────┘ │
│                              [取消] [创建并继续编辑]  │
└────────────────────────────────────────────────────┘
```

控件依赖：商品编码/名称无上游；分类为 owner 返回的树、可空单选，改变时无下游；形态为 createAllowed manifest，选择后更新说明，禁用项显示原因；提交前 owner 复核 scope、编码唯一、单分类、形态与 DRAFT 创建。Modal 成功时先关闭，`afterOpenChange(false)` 后以初始编辑态打开同一商品 Drawer；不可与 Drawer 重叠。

### Screen: item-attribute-tab

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=CatalogItemDrawer 的“商品属性”Tab；Drawer 编辑态。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=商品已存在，需要填写其被选择定义的具体值。
BUSINESS_GOAL=选择多个属性定义，并按类型完成合法赋值。
USER_VISIBLE_COPY=商品属性；添加属性；属性名称；属性类型；属性值；删除此属性；暂无商品属性；文本；单选；多选。
TECHNICAL_BOUNDARY=definitionRef/optionRef 是稳定关系；编码或名称改动不改变关系；不显示 JSON、ref。
FOUNDATION_PRIMITIVE=useDrawerFormLifecycle,DescriptorFieldRenderer
CONTAINER_LAYOUT=宽高与来源：adminWideDrawerSurfaceProps（min(1024px, calc(100vw - 48px))）；不得超出视口：Drawer 外框、商品 Drawer 页签头和 sticky footer；唯一纵向滚动：adminWideDrawerSurfaceProps 的 Drawer body；关键对齐：属性名称、类型、属性值与移除操作在同一行基线，长值截断并提示而不撑宽。1280px 以下若出现 Drawer 横向滚动条，或 body 之外再有内容纵向滚动，即不成立。
```

```text
┌ 商品属性 ────────────────────────────────────────────┐
│ [添加属性]                                             │
│ 过期时间  文本  [三个月________________]           [移除]│
│ 辣度      单选  [中辣 ▼]                           [移除]│
│ 配料      多选  [芝士,培根 ▼]                     [移除]│
└────────────────────────────────────────────────────┘
```

控件依赖：添加属性为 owner 返回的当前商品库未关联属性候选；选定属性后生成唯一填写控件，改变属性清空旧值；文本使用 Input，单选使用单选 Select，多选使用多选 Select；候选仅为属性已启用的可选项；保存由 catalog owner 再核验类型、范围、去重和选项归属。

### Screen: item-order-option-tab

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=CatalogItemDrawer 的“点单选项”Tab；Drawer 编辑态。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=商品选择一个或多个已定义点单组，并维护仅属于该商品的策略。
BUSINESS_GOAL=配置必选、多选时的最少/最多可选、默认、加价和每份扣料原料用量，且不改库中定义。
USER_VISIBLE_COPY=点单选项；从点单选项库添加；已添加的点单选项；本商品设置；顾客端显示效果；必选；最少可选；最多可选；默认；加价；每份用量；多选（最多 1 项）；此点单选项由点单选项库统一维护。
TECHNICAL_BOUNDARY=组/值/排序/选择方式/组件不可在此编辑；BOM target/单位由 inventory owner 复核；不显示 attributeValueRef。
FOUNDATION_PRIMITIVE=useDrawerFormLifecycle,adminWideDrawerSurfaceProps,useCursorCandidates
CONTAINER_LAYOUT=宽高与来源：adminWideDrawerSurfaceProps（min(1024px, calc(100vw - 48px))）；不得超出视口：Drawer 外框、商品 Drawer 页签头、三栏标题与 sticky footer；唯一纵向滚动：adminWideDrawerSurfaceProps 的 Drawer body，三栏不各自再造滚动祖先；关键对齐：三栏标题同一基线，左侧已添加点单选项、中间本商品设置、右侧顾客端显示效果按固定栅格列对齐，长名称截断并提示。1280px 以下若出现 Drawer 横向滚动条，或三栏与 Drawer body 同时纵向滚动，即不成立。
```

```text
┌ 已添加的点单选项 ┬ 本商品设置 ───────────────┬ 顾客端显示效果 ───┐
│ + 从库添加    │ 蘸料（多选）                 │ 蘸料              │
│ 蘸料          │ 必选 [开关]  最少[0] 最多[1] │ 番茄酱             │
│               │ 蛋黄酱 默认[✓] 加价[0.00]    │ 蛋黄酱             │
│               │ 黑松露酱 默认[ ] 加价[2.00]  │ 黑松露酱           │
│               │ └ 瓶装黑松露酱  每份[15]克    │ 显示顺序和扣料原料由库统一维护 │
└───────────────┴────────────────────────────┴───────────────────┘
```

控件依赖：从库添加读取未关联点单选项候选；选择后读回可选项和扣料原料，前端不得自行增加可选项；单选隐藏最少/最多可选且至多一个默认项；多选显示最少/最多可选，`max=1` 仍显示“多选（最多 1 项）”，允许多选控件但选择第二项会显示字段错误，不改写选择方式；默认项数量不得超过最多可选，最少不得大于最多，每份用量为非负小数且计量单位只读。保存由 catalog/inventory owners 在同一业务动作重新核验。

### Screen: metadata-attribute-library-tab

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=CatalogDictionaryDrawer（商品元数据 Modal）的“商品属性库”Tab；名称链接或“新建商品属性”打开属性定义 Drawer。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=当前商品库需统一定义商品描述属性。
BUSINESS_GOAL=找到或新建属性定义。
USER_VISIBLE_COPY=商品属性库；新建商品属性；属性名称；编码；属性类型；已关联商品；暂无商品属性。
TECHNICAL_BOUNDARY=定义范围和读取授权由 owner 决定；不显示 definitionRef。
FOUNDATION_PRIMITIVE=adminListState,useDetailDrawer
CONTAINER_LAYOUT=宽高与来源：沿用 CatalogDictionaryDrawer 的 Modal body 内容栅格，不另设页面宽度；不得超出视口：商品元数据 Modal 外框、六个 Tab 头、列表表头和“新建商品属性”操作区；唯一纵向滚动：CatalogDictionaryDrawer 的 Modal body，商品属性库 Tab 不另造纵向滚动祖先；关键对齐：名称首列、编码、类型和已关联商品列与表头对齐，名称列可收缩并截断提示。1280px 以下若出现 Modal 横向滚动条，或 Modal body 与商品属性库 Tab 同时纵向滚动，即不成立。
```

```text
┌ 商品属性库 ──────────────────────────────────────────┐
│ [+ 新建商品属性]                                      │
│ 属性名称(可点击) | 编码 | 属性类型 | 已关联商品         │
│ 过期时间          | outdate | 文本 | 12                │
└────────────────────────────────────────────────────┘
```

### Screen: attribute-definition-drawer

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=商品元数据 Modal 内“商品属性库”Tab 的名称链接或“新建商品属性”。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=需要维护一个可被多个商品引用的属性定义。
BUSINESS_GOAL=维护名称、在当前商品库内唯一且可改的编码、类型和选择项；知情删除级联。
USER_VISIBLE_COPY=商品属性详情；名称；编码；属性类型；选择项；添加选项；保存；删除商品属性；删除后将移除关联商品的该属性和值，商品仍保留。
TECHNICAL_BOUNDARY=编码唯一、已使用定义更新规则、删除级联由 owner；不显示 definitionRef。
FOUNDATION_PRIMITIVE=useDrawerFormLifecycle,adminWideDrawerSurfaceProps
CONTAINER_LAYOUT=宽高与来源：adminWideDrawerSurfaceProps（min(1024px, calc(100vw - 48px))）；不得超出视口：Drawer 外框、名称/编码/类型表单、选择项区和 sticky footer；唯一纵向滚动：adminWideDrawerSurfaceProps 的 Drawer body；关键对齐：名称、编码、类型按表单栅格对齐，选择项表头与行列对齐，长选项截断并提示。1280px 以下若出现 Drawer 横向滚动条，或 body 之外再有内容纵向滚动，即不成立。
```

```text
┌ 商品属性详情 ─────────────────────────────────────────┐
│ 名称[过期时间] 编码[outdate] 类型[文本 ▼]              │
│ 选择项（仅单选/多选类型显示） [ + 添加选项 ]            │
│ [删除商品属性]                              [保存]     │
└────────────────────────────────────────────────────┘
```

### Screen: metadata-option-library-tab

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=CatalogDictionaryDrawer（商品元数据 Modal）的“点单选项库”Tab；名称链接或“新建点单选项”打开点单选项定义 Drawer。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=当前商品库要统一维护顾客点单时会看到的选项，以及对应的扣料原料。
BUSINESS_GOAL=找到或新建点单选项组定义。
USER_VISIBLE_COPY=点单选项库；新建点单选项；点单选项名称；编码；选择方式；可选项数；暂无点单选项。
TECHNICAL_BOUNDARY=定义范围和读取授权由 owner 决定；不显示 definitionRef。
FOUNDATION_PRIMITIVE=adminListState,useDetailDrawer
CONTAINER_LAYOUT=宽高与来源：沿用 CatalogDictionaryDrawer 的 Modal body 内容栅格，不另设页面宽度；不得超出视口：商品元数据 Modal 外框、六个 Tab 头、列表表头和“新建点单选项”操作区；唯一纵向滚动：CatalogDictionaryDrawer 的 Modal body，点单选项库 Tab 不另造纵向滚动祖先；关键对齐：名称首列、编码、选择方式和可选项数列与表头对齐，名称列可收缩并截断提示。1280px 以下若出现 Modal 横向滚动条，或 Modal body 与点单选项库 Tab 同时纵向滚动，即不成立。
```

```text
┌ 点单选项库 ──────────────────────────────────────────┐
│ [+ 新建点单选项]                                      │
│ 点单选项名称(可点击) | 编码 | 选择方式 | 可选项数      │
│ 蘸料              | dip | 多选 | 3                   │
└────────────────────────────────────────────────────┘
```

### Screen: option-definition-drawer

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=商品元数据 Modal 内“点单选项库”Tab 的名称链接或“新建点单选项”。
ACTOR=商品维护运营用户
BUSINESS_SCENARIO=需要维护顾客选择的点单选项，以及每个可选项对应的扣料原料。
BUSINESS_GOAL=在一个清晰的层级中维护点单选项基本资料、创建后不可修改的组和值编码、顾客端有序可选项及当前可选项的多条扣料原料。
USER_VISIBLE_COPY=点单选项详情；点单选项名称；编码；创建后不可修改；选择方式；可选项；添加可选项；可选项编码；顾客端显示顺序；正在编辑的可选项；扣料原料；添加扣料原料；原材料商品；计量单位；不扣减原料；删除可选项；删除点单选项；保存；删除后将移除商品中的此点单选项设置和相关原料用量，商品与原材料商品仍保留。
TECHNICAL_BOUNDARY=组件候选必须已有可解析 StockTarget；target/单位、scope、授权、值删除级联和完整集合保存由 owners 最终核验。组选项和值编码在创建后不可改；不显示 ref/BOM/target。
FOUNDATION_PRIMITIVE=useDrawerFormLifecycle,useCursorCandidates,adminWideDrawerSurfaceProps
CONTAINER_LAYOUT=宽高与来源：adminWideDrawerSurfaceProps（min(1024px, calc(100vw - 48px))，内容区采用左右分栏；不得超出视口：Drawer 外框、顶部基本资料、两栏标题和 sticky footer；唯一内容纵向滚动：adminWideDrawerSurfaceProps 的 Drawer body，左右栏不得各自造滚动祖先；关键对齐：左侧选中行高亮，右侧固定显示“正在编辑：<当前可选项名称>”，两栏标题与各自第一行同一基线，切换左侧选中行立即替换右侧内容；宽度不足两栏最低内容宽度时整块按“可选项→当前可选项的扣料原料”纵向堆叠。候选下拉弹层滚动是唯一例外。1280px 以下若 Drawer 横向滚动，或任一分栏与 Drawer body 同时纵向滚动，即不成立。
```

```text
┌ 点单选项详情 · 蘸料 ──────────────────────────────────────────────┐
│ 点单选项名称 [蘸料______________]  编码 [dip________]（创建后不可修改）│
│ 选择方式       [多选 ▼]     说明：顾客端显示顺序由下表决定          │
├───────────────────────────┬───────────────────────────────────────┤
│ 可选项（顾客端显示顺序）   │ 正在编辑：3 · 黑松露酱                  │
│ [ + 添加可选项 ]           │ 编码创建后不可修改；名称在左表编辑       │
│ ┌────────────────────────┐│ ─ 扣料原料（可不设置） ───────────── │
│ │序│编码 │名称    │扣料原料││ [ + 添加扣料原料 ]                     │
│ │1 │tomato│番茄酱 │ 无     ││ 1. 原材料商品 [瓶装黑松露酱（BT001） ▼]│
│ │2 │mayo  │蛋黄酱 │ 无     ││    计量单位   克              [移除]   │
│ │3 │truffle│黑松露酱│ 1种   ││                                       │
│ └────────────────────────┘│                                       │
│ [上移] [下移] [删除可选项] │                                       │
├───────────────────────────┴───────────────────────────────────────┤
│ [删除点单选项]                              [取消] [保存点单选项] │
└───────────────────────────────────────────────────────────────────┘
```

**布局与动态数据规则**：这是一个点单选项的单一 Drawer，不是把每个可选项和扣料原料堆成连续卡片。顶部只放点单选项的基本资料，组编码仅在新建时可填写、创建后只读；左列为 `EditableProTable`，一行即一个顾客可见的可选项，新加项可填写编码、名称和顺序，保存后的既有项编码只读，选中行决定右列内容。右列只展示当前可选项的扣料原料集合：可添加多条短行，使用 `ProFormList`，每行只能搜索选择一个原材料商品，随后只读显示其计量单位。可选项和扣料原料均先写入 Drawer 草稿，底部“保存点单选项”一次保存整项定义；不允许逐行即时保存、返回外层列表后继续编辑，或把不同可选项的扣料原料混在一起。

**选择、排序与删除**：新增可选项后成为当前行；删除当前可选项先在本地标为“待删除”，若该可选项已用于商品，保存前弹出影响确认，明确会移除商品中的此点单选项设置和相关原料用量，但不会删除商品或原材料商品；取消确认即撤销待删除标记。顾客端显示顺序只通过当前可选项的“上移/下移”维护，管理员列表不另设排序。当前选中可选项没有扣料原料时，右列集合位置才显示“不扣减原料”；图中黑松露酱已有一条扣料原料，因此不显示该空态。没有当前可选项时右列显示“先从左侧选择或添加可选项”，不得显示一个无归属的扣料原料表单。

**控件依赖与校验**：新建组时组编码必填且同商品库唯一，保存后不再提供编辑控件；可选项表至少保留一个未删除可选项，新加项编码/名称非空且同一项内唯一，保存后的既有项编码不可改；选择方式只能是单选或多选，不能出现“固定包含”。扣料原料候选来自 inventory owner 的当前商品库读取，候选必须已经具备可用库存对象；选中候选后只读回填计量单位，改候选会清除旧单位。扣料原料允许为 0 条；存在时每行必须有一个原材料商品和完整回填。保存时 catalog/inventory owners 在同一业务动作复核范围、权限、稳定关联、顺序、级联、组/值编码不可变和库存对象，不由前端承诺。

### Screen: brand-copy-conflict

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=既有 BrandCatalogCopyDrawer 的预检结果步骤。
ACTOR=总部商品维护运营用户
BUSINESS_SCENARIO=把总部商品复制到门店前需确认闭包和同编码语义。
BUSINESS_GOAL=发现并定位 hard-block 的定义冲突，不用确认绕过。
USER_VISIBLE_COPY=复制检查；暂时不能复制；同编码的定义不一致；属性类型不同；可选项不同；扣料原料不同；请先整理门店中的定义后重试。
TECHNICAL_BOUNDARY=preflight/execute 都重新比较语义；前端不计算或确认冲突。
FOUNDATION_PRIMITIVE=useDrawerFormLifecycle,adminListState,adminWideDrawerSurfaceProps
CONTAINER_LAYOUT=宽高与来源：adminWideDrawerSurfaceProps（min(1024px, calc(100vw - 48px))）；不得超出视口：Drawer 外框、步骤标题、冲突定义列表和底部操作区；唯一纵向滚动：adminWideDrawerSurfaceProps 的 Drawer body；关键对齐：冲突定义名称/编码与差异原因按同一列表列对齐，长原因换行但不撑宽，关闭操作固定在 footer。1280px 以下若出现 Drawer 横向滚动条，或 body 之外再有内容纵向滚动，即不成立。
```

```text
┌ 复制检查：暂时不能复制 ─────────────────────────────────┐
│ 同编码的点单选项不一致：蘸料（dip）                      │
│ 门店中的可选项或扣料原料与总部不同。                     │
│ 请先整理门店定义后重试。                                │
│                                              [关闭]      │
└──────────────────────────────────────────────────────┘
```

## 4.1 Surface ownership 自检

| screen id | 声明 surface | 线框可见元素分母 | 归属 | USER_VISIBLE_COPY 有位置 | CONTAINER_LAYOUT 四项齐全 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| catalog-workbench | 内容页 | 商品主面标题、列表、商品元数据/创建/复制入口 | 是 | 是 | 是 | REVISE_PENDING_DEXTER |
| catalog-metadata-modal | Modal | 标题、六个元数据 Tab、关闭 | 是 | 是 | 是 | REVISE_PENDING_DEXTER |
| item-create-modal | Modal | 四字段、形态说明、取消/提交 | 是 | 是 | 是 | PASS |
| item-attribute-tab | 内容 Tab | 选择/typed editor/移除 | 是 | 是 | 是 | PASS |
| item-order-option-tab | 内容 Tab | 三栏、配置字段、只读预览 | 是 | 是 | 是 | PASS |
| metadata-attribute-library-tab | 内容 Tab | 列表/新建入口 | 是 | 是 | 是 | REVISE_PENDING_DEXTER |
| attribute-definition-drawer | Drawer | 定义字段/选择项/删除确认 | 是 | 是 | 是 | PASS |
| metadata-option-library-tab | 内容 Tab | 列表/新建入口 | 是 | 是 | 是 | REVISE_PENDING_DEXTER |
| option-definition-drawer | Drawer | 点单选项、创建后不可改的组/值编码、可选项与扣料原料/删除确认 | 是 | 是 | 是 | REVISE_PENDING_DEXTER |
| brand-copy-conflict | Drawer | 冲突原因/关闭 | 是 | 是 | 是 | PASS |

## 4.2 Mutation 字段事实矩阵

`FORM_MUTATION_DENOMINATOR`：create-item-draft、save-item-attributes、save-item-order-options、create-attribute-definition、update-attribute-definition、delete-attribute-definition、create-order-option-definition、update-order-option-definition、delete-order-option-definition、copy-preflight、copy-execute。每个 variant 的 scope、grant、idempotency/版本与 owner readback 是 `HIDDEN_OWNER_FACT`，不得由页面或已加载列表伪造。

| command variant | 业务事实与可见控件 | 分类 | 唯一来源 | 级联/校验 | owner 最终复核与失败恢复 |
| --- | --- | --- | --- | --- | --- |
| create-item-draft | code/name/categoryRef/shapeKey；Modal 输入、单树、形态单选 | EDITABLE | 用户输入/owner tree/manifest | category 可空单值；shape 固定 | scope、唯一、createAllowed、DRAFT；字段错误留 Modal，成功 readback 后才 handoff。 |
| save-item-attributes | definitionRef 与 typed value；定义候选与文本/单选/多选 editor | EDITABLE | owner candidate/detail | 改定义清旧值；类型/选项归属；同一属性不可重复 | catalog；失败保留草稿。 |
| save-item-order-options | group definitionRef、required/min/max/default/extraPrice/actual quantity；三栏配置 | EDITABLE | owner candidate/library detail | MULTIPLE min≤max；max=1 保持多选；库的原料不可增删换 | catalog+inventory；字段级错误，商品页不重判库存就绪。 |
| create-attribute-definition | 名称/编码/类型与选择项；属性定义 Drawer | CONDITIONAL_EDITABLE | 用户输入 | TEXT 不出现选择项；编码同 scope 唯一 | catalog；失败不关闭 Drawer。 |
| update-attribute-definition | 名称/编码/类型与选择项；属性定义 Drawer | CONDITIONAL_EDITABLE | definition detail/readback | U-03 不提前承诺已使用定义的类型/选项更新规则 | catalog；typed 问题留在 Drawer。 |
| delete-attribute-definition | 删除确认中的影响范围；商品保留提示 | HIDDEN_OWNER_FACT | owner impact readback | 清本 scope assignment/value，不删商品 | catalog；拒绝后保留 detail。 |
| create-order-option-definition | 名称/编码/选择方式、左侧可选项、右侧当前项扣料原料 | CONDITIONAL_EDITABLE | 用户输入/inventory candidate | SINGLE/MULTIPLE；扣料原料若存在必须已有可解析 StockTarget | catalog+inventory；失败不关闭 Drawer。 |
| update-order-option-definition | 基本资料、顺序、当前可选项及其扣料原料；待删除可选项的影响确认 | CONDITIONAL_EDITABLE + HIDDEN_OWNER_FACT | definition detail/inventory candidate/owner impact readback | 切换当前项只替换右侧集合；待删除项作为 aggregate 差集随底部“保存点单选项”一次提交，清其 override/对应 BOM；商品页不得改定义 | catalog+inventory；保存完整 aggregate，失败保留草稿、不得提前删除。 |
| delete-order-option-definition | 删除确认中的影响范围与三类保留事实 | HIDDEN_OWNER_FACT | owner impact readback | 清所有引用该组的 config/override/option-value BOM | catalog+inventory；失败整体不删。 |
| copy-preflight | 源/目标及冲突列表 | EDITABLE + HIDDEN_OWNER_FACT | copy readback | 同码语义差异 BLOCKED，不进确认集合 | coordinator；失败保留选择，不能本地算冲突。 |
| copy-execute | 已通过预检的范围；没有 BLOCKED 确认按钮 | HIDDEN_OWNER_FACT | fresh preflight/digest | execute 前重检、深复制与引用重写 | coordinator；BLOCKED/过期不写入、不显示覆盖路径。 |

## 4.3 搜索与候选选择详设

| screen / 对象 / 用户问题 | 文案 | 形态 | 唯一来源 | 级联 | owner 核验 | 适合性 | 缺口处置 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 商品元数据内的商品属性/点单选项库列表 / 找到定义 | 名称、编码 | Bounded 全量读取，不分页 | 定义 owner list operation | 在各自商品元数据 Tab 变更后重取、取消旧请求 | owner scope/read | 常规约100、源码上界500，适合一次完整展示 | 501 owner typed reject，不截断、不改 cursor/page。 |
| 商品属性候选 / 添加未关联定义 | 添加属性 | Bounded 全量候选 + 本地仅展示过滤 | definition owner candidate/list operation | 选定后清空旧 typed value | catalog scope/type | 与定义库500上界一致，不从商品列表反推 | 不加 cursor/page；501使用同一 typed reject。 |
| 点单组候选 / 添加组 | 从点单选项库添加 | Bounded 全量候选 + 本地仅展示过滤 | option owner candidate/list operation | 选定后读回组值/扣料原料 | catalog | 禁止本地造组；与定义库500上界一致 | 不加 cursor/page；501使用同一 typed reject。 |
| 扣料原料 / 选择原材料商品 | 原材料商品 | searchable cursor candidate | inventory task read，含可用库存对象/单位 | 改原料清数量，重新读单位 | inventory | 需要按名称/编码找当前商品库内可用库存对象 | 无候选即不能保存，不能用文本输入。 |
| 分类 / 新建商品 | 分类（可不选） | TreeSelect | catalog category tree read | 改分类无下游 | catalog | 树层级是业务结构 | 旧多选 array contract 不得复用。 |

## 5. 状态与边界表

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face 边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 首步新建 | shape/tree loading；失败保留输入 | code/name/单分类/形态 | 禁用重复提交 | 关闭 Modal 后开编辑 Drawer | 唯一/shape/grant 原文可见 | 不宣称创建；重读后再试 | catalog owner 决定。 |
| 商品元数据内属性/点单选项库保存 | 保留最新详情 | 填写字段/扣料原料 | 提交锁定 | 保存结果刷新当前商品元数据 Tab 与相关商品详情 | 当前商品库、编码、原材料或关联关系不符合要求时显示服务端业务原因 | 不清空草稿 | catalog/inventory owners。 |
| 定义删除 | 先读影响范围 | 必须确认 | 禁止重复 | 定义消失、范围内配置刷新 | 保留详情并显示原因 | 不假设已删 | 删除级联由 owners。 |
| 复制检查 | 显示加载 | 无本地计算 | 执行前重新检查 | 没有阻断才沿用既有步骤 | 不可复制时没有确认或执行按钮 | 只重试检查 | copy coordinator/owners。 |

## 6. 逐操作任务合理性

| 操作 | Journey 来源 | 用户为何操作 | 更短路径 | 不选替代理由 | 约束归因 | Dexter 裁决 |
| --- | --- | --- | --- | --- | --- | --- |
| 进入商品元数据并切换六个 Tab | Journey §2 | 在同一商品库集中切换商品资料维护任务 | 新路由 | CatalogDictionaryDrawer 保留同一 scope/上下文；商品工作台不再承载定义库 Tab | Dexter 2026-08-20 UI 裁定/现有商品元数据 Modal | 否 |
| 新建商品 | Journey §2 | 先锁定最小身份/形态 | 直接 Drawer | Modal 强制先确认不可改形态 | 产品 | 否 |
| 添加属性/组选项 | Journey §2 | 复用定义而非重造 | 自由输入 | 关系稳定且可级联 | 产品/owner | 否 |
| 编辑库定义 | Journey §2 | 在 scope 内集中维护模板 | 商品内编辑 | 商品不得改定义 | 产品 | 否 |
| 删除定义 | Journey §2 | 清除不再使用的定义及当前配置 | 仅禁用 | Dexter 已裁定有限级联 | 产品/owner | 否 |
| 查看复制冲突 | Journey §2 | 防止语义不同的同码定义被误复用 | 确认继续 | hard block 是已裁定 | 产品/owner | 否 |

## 7. Face / owner 对齐矩阵

| 屏幕/动作 | face | 页面准入 | server operation | owner readback / command | 前端不可替代 |
| --- | --- | --- | --- | --- | --- |
| 所有 catalog screens | operations-admin | operations catalog page policy | 新/改 operations catalog edge operations | catalog owner | scope/grant/状态。 |
| 组件候选/实际 BOM | operations-admin | 同上 | inventory candidate + public command | inventory owner | target 解析、单位、BOM。 |
| 复制冲突 | operations-admin | 既有 copy 准入 | copy preflight/execute | coordinator + catalog/inventory | semantic hard block parity。 |

## 8. Manifest B.4/B.5 命中对照

| 条文 | 命中或不适用 | 遵循方式 | Heritage |
| --- | --- | --- | --- |
| B.4 前端架构与状态 | 命中 | workbench 仍由 operations app 管理；server fact 不镜像本地。 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/admin-frontend-runtime-architecture-must-not-follow-journey-ids.md`（registry 所列冻结副本） |
| B.5 交互与信息架构 | 命中 | 名称为列表首列并打开详情；Modal→Drawer 不重叠；三栏只保留任务密度。 | 同上 |
| 高保真 demo | N/A | 标准配置工作台可由低保真线框表达；不新增静态 demo。 | N/A |

## 9. Dexter 看图结论

- 看图日期：`2026-08-20`
- 低保真线框结论：`ACCEPTED@2026-08-20`。
- 高保真 demo 结论：`NOT_REQUIRED`
- 修改意见/已接受的操作顺序：`Dexter 会话确认`；本记录只记确认结论，不声称 Dexter 已逐屏审阅低保真线框。
- 允许进入 implementation-facing design：是；仍不构成实施授权。

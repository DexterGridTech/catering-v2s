---
title: 商品属性库、点单选项库与两步新建 IA 详设
status: DEXTER_WIREFRAME_REVISION_REQUIRED
createdAt: 2026-08-20
implementationAuthority: false
---

# IA：商品属性库、点单选项库与两步新建

## 1. 元数据

```text
IA_SCOPE=CATLIB-IA-01..10（十个交互工件 screen）
BUSINESS_SOURCE=doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md#3-正式功能需求
JOURNEY_REFS=doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md#7-dexter-裁决
UI_INTERACTION_REF=doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ui-interaction.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-implementation-design.md
DEXTER_WIREFRAME_REVIEW=REVISE@2026-08-20（Dexter 裁定：商品属性库、点单选项库移入既有商品元数据 Modal，与商品标签、销售单位、SKU 销售属性、商品处理标签并列；取消工作台整个顶层 Tab 容器，商品主面直出）
IMPLEMENTATION_AUTHORITY=false
```

## 2. 共用信息架构规则

- 唯一 face 是 `operations-admin`；platform-admin 不新增商品、属性库或点单选项库入口。
- `CatalogWorkbenchPage` 取消整个顶层 Tab 容器，商品主面直出；商品属性库、点单选项库只在既有 `CatalogDictionaryDrawer` 商品元数据 Modal 内，与商品标签、销售单位、SKU 销售属性、商品处理标签同级并列。它们与 SKU 销售属性是不同业务事实，不能互作候选或替代。
- 定义库在当前总部或门店商品库私有；品牌复制到门店时深复制定义与配置并改写引用，之后门店独立。
- 库定义持有名称、可选项、顾客端顺序、单选/多选和扣料原料；商品只持有属性值，或点单选项的必选、最少/最多可选、默认、加价和每份用量。`MULTIPLE max=1` 仍显示并保存为“多选（最多 1 项）”。
- 用户可见文案仅用业务语言；“组件、target、BOM、ref、scope”等仅可出现在技术边界。
- 每个 screen 的静态容器取值逐字采用交互工件同名 screen 的 `CONTAINER_LAYOUT`；本 IA 只补“数据变多时”的行为。

### 2.1 逐屏静态容器声明（交互工件原文；IA 不另立取值）

下列十项逐字复制自交互工件；`containerBehaviorUnderLoad` 只增加数据量、长内容及多栏不等高时的行为，不改写这些静态取值。

| screen | `CONTAINER_LAYOUT` |
| --- | --- |
| catalog-workbench | 宽高与来源：沿用 CatalogWorkbenchPage 宿主内容区，不在 app 内另设固定页宽；不得超出视口：内容页外框、商品主面标题/操作区、列表表头和“商品元数据/复制到门店/新建商品”操作区；唯一纵向滚动：宿主内容区；关键对齐：商品主面标题与右侧操作区同一基线，表头与列内容按同一列宽。1280px 以下若出现页面横向滚动条，或宿主内容区外再出现第二个纵向滚动条，即不成立。 |
| catalog-metadata-modal | 宽高与来源：沿用既有 CatalogDictionaryDrawer 的 Modal 宽度与 body 最大高度；不得超出视口：Modal 外框、标题、六个 Tab 头和关闭控件；唯一纵向滚动：Modal body，Tab 内容不得自行创建第二个纵向滚动祖先；关键对齐：六个 Tab 在同一 Tab 行，内容区表头、标题和操作区沿 Modal 内容栅格对齐。1280px 以下若出现 Modal 横向滚动条，或 Modal body 与 Tab 内容同时纵向滚动，即不成立。 |
| item-create-modal | 宽高与来源：Ant Design Modal，内容宽度由两列“编码/名称”表单与形态说明所需宽度决定，窄屏时以视口左右留白收缩而不横向滚动；不得超出视口：Modal 外框、标题、形态说明和底部“取消/创建并继续编辑”操作区；唯一纵向滚动：Modal body；关键对齐：编码/名称同一栅格基线，分类、形态说明与底部主操作左/右对齐。1280px 以下若出现 Modal 横向滚动条，或 body 与 Modal 同时纵向滚动，即不成立。 |
| item-attribute-tab | 宽高与来源：adminWideDrawerSurfaceProps（min(1024px, calc(100vw - 48px))）；不得超出视口：Drawer 外框、商品 Drawer 页签头和 sticky footer；唯一纵向滚动：adminWideDrawerSurfaceProps 的 Drawer body；关键对齐：属性名称、类型、属性值与移除操作在同一行基线，长值截断并提示而不撑宽。1280px 以下若出现 Drawer 横向滚动条，或 body 之外再有内容纵向滚动，即不成立。 |
| item-order-option-tab | 宽高与来源：adminWideDrawerSurfaceProps（min(1024px, calc(100vw - 48px))）；不得超出视口：Drawer 外框、商品 Drawer 页签头、三栏标题与 sticky footer；唯一纵向滚动：adminWideDrawerSurfaceProps 的 Drawer body，三栏不各自再造滚动祖先；关键对齐：三栏标题同一基线，左侧已添加点单选项、中间本商品设置、右侧顾客端显示效果按固定栅格列对齐，长名称截断并提示。1280px 以下若出现 Drawer 横向滚动条，或三栏与 Drawer body 同时纵向滚动，即不成立。 |
| metadata-attribute-library-tab | 宽高与来源：沿用 CatalogDictionaryDrawer 的 Modal body 内容栅格，不另设页面宽度；不得超出视口：商品元数据 Modal 外框、六个 Tab 头、列表表头和“新建商品属性”操作区；唯一纵向滚动：CatalogDictionaryDrawer 的 Modal body，商品属性库 Tab 不另造纵向滚动祖先；关键对齐：名称首列、编码、类型和已关联商品列与表头对齐，名称列可收缩并截断提示。1280px 以下若出现 Modal 横向滚动条，或 Modal body 与商品属性库 Tab 同时纵向滚动，即不成立。 |
| attribute-definition-drawer | 宽高与来源：adminWideDrawerSurfaceProps（min(1024px, calc(100vw - 48px))）；不得超出视口：Drawer 外框、名称/编码/类型表单、选择项区和 sticky footer；唯一纵向滚动：adminWideDrawerSurfaceProps 的 Drawer body；关键对齐：名称、编码、类型按表单栅格对齐，选择项表头与行列对齐，长选项截断并提示。1280px 以下若出现 Drawer 横向滚动条，或 body 之外再有内容纵向滚动，即不成立。 |
| metadata-option-library-tab | 宽高与来源：沿用 CatalogDictionaryDrawer 的 Modal body 内容栅格，不另设页面宽度；不得超出视口：商品元数据 Modal 外框、六个 Tab 头、列表表头和“新建点单选项”操作区；唯一纵向滚动：CatalogDictionaryDrawer 的 Modal body，点单选项库 Tab 不另造纵向滚动祖先；关键对齐：名称首列、编码、选择方式和可选项数列与表头对齐，名称列可收缩并截断提示。1280px 以下若出现 Modal 横向滚动条，或 Modal body 与点单选项库 Tab 同时纵向滚动，即不成立。 |
| option-definition-drawer | 宽高与来源：adminWideDrawerSurfaceProps（min(1024px, calc(100vw - 48px))，内容区采用左右分栏；不得超出视口：Drawer 外框、顶部基本资料、两栏标题和 sticky footer；唯一内容纵向滚动：adminWideDrawerSurfaceProps 的 Drawer body，左右栏不得各自造滚动祖先；关键对齐：左侧选中行高亮，右侧固定显示“正在编辑：&lt;当前可选项名称&gt;”，两栏标题与各自第一行同一基线，切换左侧选中行立即替换右侧内容；宽度不足两栏最低内容宽度时整块按“可选项→当前可选项的扣料原料”纵向堆叠。候选下拉弹层滚动是唯一例外。1280px 以下若 Drawer 横向滚动，或任一分栏与 Drawer body 同时纵向滚动，即不成立。 |
| brand-copy-conflict | 宽高与来源：adminWideDrawerSurfaceProps（min(1024px, calc(100vw - 48px))）；不得超出视口：Drawer 外框、步骤标题、冲突定义列表和底部操作区；唯一纵向滚动：adminWideDrawerSurfaceProps 的 Drawer body；关键对齐：冲突定义名称/编码与差异原因按同一列表列对齐，长原因换行但不撑宽，关闭操作固定在 footer。1280px 以下若出现 Drawer 横向滚动条，或 body 之外再有内容纵向滚动，即不成立。 |

## 3. 十个 IA-ID

### CATLIB-IA-01 · 商品目录工作台

- `businessTask`：查看和维护当前商品；需要统一维护商品资料时进入商品元数据。
- `actorAndScenario`：当前总部或门店商品库的商品维护运营用户。
- `entryAndSurface`：`CatalogWorkbenchPage` 无顶层 Tab 容器的商品主面；名称首列进入详情，“商品元数据”按钮打开 Modal。
- `controlType`：商品主面标题、商品树/列表、商品元数据按钮；工作台没有顶层 Tab、定义库名称链接或定义库列表。
- `validationAndError`：读取失败保留上一次成功结果并显示服务端业务原因；不由前端猜测可写性。
- `accessibilityAndTestId`：商品主面标题、商品元数据、名称链接和新建/复制操作可键盘到达；状态不只用颜色；沿用 catalog feature `testId` 命名。
- `emptyLoadingErrorStates`：商品列表为空显示“暂无商品”；加载不清空旧结果。
- `containerBehaviorUnderLoad`：静态取值逐字采用交互工件 `catalog-workbench` 的 `CONTAINER_LAYOUT`。商品列表按既有 owner 读取；长名称截断并提示，商品主面标题、操作区和表头不溢出视口。定义库的 500 条边界只在商品元数据 Modal 内的对应 Tab 处理。[静态：工作台无顶层 Tab、定义库 list/cursor/page；focused：商品元数据按钮不改变商品列表 query identity。]
- `stateAndPermission`：主对象读取按当前角色数据范围；写命令由 owner 的实时 grant 复核。[acceptance：无当前商品库读取权限时商品列表与商品元数据读取均拒绝。]
- `navigationAndRefresh`：商品写入只刷新商品列表与当前详情；定义库写入只由商品元数据 Modal 的对应 IA 管理，工作台不以全局轮询补偿。[focused：refresh signal 只使声明 query identity 重取。]
- `collectionShapeAndScale`：工作台只承载商品列表；商品属性库和点单选项库的 `Bounded(500)`、常规约 100、501 typed reject 见 CATLIB-IA-06/08，不在工作台重复读取或展示。
- `dataSourceAndCascade`：商品列表、详情和可写能力来自 catalog owner；定义删除 readback 使已打开的受影响商品详情失效并重取，但不把定义列表搬进工作台。
- `forbiddenUI`：不得在 platform-admin 增加入口、不得用技术术语、不得恢复商品工作台顶层 Tab 容器，也不得把商品属性库或点单选项库做成工作台 Tab。

### CATLIB-IA-02 · 商品元数据 Modal

- `businessTask`：在一个集中入口选择并维护当前商品库的商品标签、销售单位、SKU 销售属性、商品处理标签、商品属性库或点单选项库。
- `actorAndScenario`：当前总部或门店商品库的商品维护运营用户，从商品工作台需要维护商品资料时进入。
- `entryAndSurface`：`CatalogWorkbenchPage` 的“商品元数据”按钮打开既有 `CatalogDictionaryDrawer` Modal；两个定义库是该 Modal 内与既有四项并列的内容 Tab。
- `controlType`：六个并列 Tab；商品属性库和点单选项库只在自己的 Tab 显示列表与新建入口。SKU 销售属性继续只管理可售规格，不能用来定义商品属性或点单选项。
- `validationAndError`：切换 Tab 不复用其它 Tab 的候选、选择或错误；读取失败保留当前成功数据和服务端业务原因。
- `accessibilityAndTestId`：Tab、关闭控件与内容区的首个操作可键盘访问；当前 Tab 有文字和 aria 状态，不能只靠颜色。
- `emptyLoadingErrorStates`：每个 Tab 独立保留已有数据；商品属性库空态为“暂无商品属性”，点单选项库空态为“暂无点单选项”，不影响其它元数据 Tab。
- `containerBehaviorUnderLoad`：静态取值逐字采用交互工件 `catalog-metadata-modal` 的 `CONTAINER_LAYOUT`。六个 Tab 头始终同一行；长 Tab 标签不得撑出视口，内容多时只由 Modal body 滚动。[focused：切换商品属性库/点单选项库时不形成第二纵滚，也不触发 SKU 销售属性 query。]
- `stateAndPermission`：[acceptance] 仅有 A 商品库权限的身份读取 B 商品库的任一元数据 Tab 均拒绝；[static] Modal 只在 operations-admin 入口可达。
- `navigationAndRefresh`：定义保存/删除后只刷新当前商品元数据 Tab、当前定义详情和受影响商品详情；关闭 Modal 不撤销成功 readback，也不刷新无关四项元数据。[focused：属性库 mutation 不重取 SKU 销售属性 query，反之亦然。]
- `collectionShapeAndScale`：这是容器，不自行聚合六类数据；商品属性库和点单选项库各按 CATLIB-IA-06/08 的 `Bounded(500)` 独立读取，不能由 Modal 的其它 Tab 合并、分页或本地筛选。
- `dataSourceAndCascade`：每个 Tab 由其 owner 读取；属性/点单定义关系来自 catalog owner，与 SKU 销售属性的 dictionary facts 无关联。
- `forbiddenUI`：不得把商品属性库或点单选项库放回商品工作台顶层 Tab；不得把商品属性库改名、复用或隐藏在 SKU 销售属性之下。

### CATLIB-IA-03 · 首步新建商品 Modal

- `businessTask`：确认编码、名称、可不选分类和不可改商品形态后创建草稿商品。
- `actorAndScenario`：尚未有该商品的商品维护运营用户。
- `entryAndSurface`：工作台“新建商品”打开 Modal；成功后 Modal 完全关闭才打开同一商品编辑 Drawer。
- `controlType`：编码/名称 Input、可空单选分类树、形态单选和按形态更新的业务说明；不显示 JSON 属性。
- `validationAndError`：名称/编码/形态必填，分类至多一个；形态创建后不可改；typed owner 问题就地显示。[focused：singleton array 形状或 JSON 属性输入出现即失败。]
- `accessibilityAndTestId`：焦点先到标题再到字段，形态说明由 aria 描述关联；关闭和提交均有 testId。
- `emptyLoadingErrorStates`：分类树加载失败不能提交；空树允许“未分类”；失败保留用户输入。
- `containerBehaviorUnderLoad`：静态取值逐字采用交互工件 `item-create-modal` 的 `CONTAINER_LAYOUT`。资料字段固定且不随库集合增长；长形态说明在 Modal body 换行，footer 不溢出视口。[focused：1280 宽度布局规则与 afterOpenChange handoff。]
- `stateAndPermission`：create command 在 catalog owner 中从实时 grant 与当前 scope 首读生成授权。[acceptance：无写 capability 的身份不产生草稿。]
- `navigationAndRefresh`：成功 readback 为 DRAFT/resourceRef/version；Modal `afterOpenChange(false)` 后以编辑态打开 Drawer；关闭 Drawer 只关闭编辑面，草稿保留。[focused：无重叠 surface；acceptance：DRAFT readback。]
- `collectionShapeAndScale`：分类树为既有树 read；首步只保存一个 categoryRef 或空，不使用数组兼容层。
- `dataSourceAndCascade`：形态由 owner manifest，分类由 catalog tree；形态变更仅更新说明，提交后不允许再变。
- `forbiddenUI`：不得用 Drawer 代替 Modal、不得创建后再补分类、不得把商品编码不可改从旧规则推入新需求。

### CATLIB-IA-04 · 商品属性页签

- `businessTask`：从商品属性库选择定义，并按文本/单选/多选填写商品属性值。
- `actorAndScenario`：编辑草稿或已有商品的商品维护运营用户。
- `entryAndSurface`：商品编辑 Drawer 的“商品属性”页签。
- `controlType`：添加属性候选、文本 Input、单选 Select、多选 Select、移除行；关系键为稳定定义引用而不是编码。
- `validationAndError`：同一属性不可重复；切换属性清空旧值；多选值只能来自该属性启用的可选项。[focused：自由 key/value JSON 输入出现即失败。]
- `accessibilityAndTestId`：每行名称/类型/输入/移除按阅读顺序可达；多选不只以颜色表示选择。
- `emptyLoadingErrorStates`：无赋值显示“暂无商品属性”；候选加载失败保留当前草稿。
- `containerBehaviorUnderLoad`：静态取值逐字采用 `item-attribute-tab` 的 `CONTAINER_LAYOUT`。属性赋值为单商品 Detail 聚合；一个商品使用的属性数量受其业务描述天然限制，超过可视高度由唯一 Drawer body 滚动，单条长值截断提示，不撑宽。[focused：stable definitionRef key、无第二内容滚动。]
- `stateAndPermission`：[acceptance] 删除属性定义后，同 scope 商品仍在而其属性赋值和值均消失；不能由商品页本地删除冒充定义级级联。
- `navigationAndRefresh`：保存后重取当前商品 detail；定义删后同时使受影响 detail 失效。
- `collectionShapeAndScale`：`Detail` 聚合。今天为 0 条（Dexter 已裁定清库）；上线后由一个商品实际选择多少描述属性驱动，预期为单商品的小集合而非定义库总量。若单商品累积到 1,000 条，仍以同一 item aggregate 读写、唯一 Drawer body 滚动和长值截断呈现，不分页/截断/拆成独立列表；这会作为异常配置压力暴露，不能偷偷用定义库的 500 上界替代。[focused：1,000 assignment draft 仍稳定以 definitionRef 定位且无第二滚动。]
- `dataSourceAndCascade`：catalog owner 返回定义候选和当前赋值，定义变化/删除由 owner 清理失效值。
- `forbiddenUI`：不得保留自由 JSON、不得复用 SKU 销售属性库。

### CATLIB-IA-05 · 商品点单选项页签

- `businessTask`：从库添加点单选项，并维护本商品的必选、最少/最多、默认、加价和每份用量。
- `actorAndScenario`：编辑草稿或已有商品的商品维护运营用户。
- `entryAndSurface`：商品编辑 Drawer 的“点单选项”页签。
- `controlType`：左侧已添加点单选项、中间本商品设置、右侧顾客端显示效果；当前组以稳定 definitionRef 选择。单选隐藏最少/最多；多选显示最少/最多，即使最多为 1 仍保留多选控件和“多选（最多 1 项）”。
- `validationAndError`：`min≤max`、默认数不超过 max、每份用量为非负小数；第二默认或第二选择超过 max=1 时字段级错误，不变更库的选择方式。[focused：FIXED 拒绝且 max=1 不转单选。]
- `accessibilityAndTestId`：三栏按左→中→右阅读；选择项、默认、加价、每份用量均可键盘访问。
- `emptyLoadingErrorStates`：未添加时显示从库添加引导；定义候选失败保留既有商品设置。
- `containerBehaviorUnderLoad`：静态取值逐字采用 `item-order-option-tab` 的 `CONTAINER_LAYOUT`。商品组选项配置为 Detail 聚合；增长由单商品使用多少点单选项和库值决定，窄宽时三栏整体堆叠，唯一 Drawer body 滚动；候选下拉弹层滚动是唯一例外。[focused：stable ref 切换三栏、无跨组混排。]
- `stateAndPermission`：catalog/inventory owners 在同一业务动作重新核验商品可写性、库引用和每份用量；商品侧不重判库存是否就绪。[acceptance：库定义的扣料原料无既有 StockTarget 时不能建立；商品配置只验证数量。]
- `navigationAndRefresh`：保存后重取当前商品和相关库存 BOM 摘要，且仅失效该商品 detail。
- `collectionShapeAndScale`：`Detail` 聚合。今天为 0 条（Dexter 已裁定清库）；上线后由一个商品实际提供多少点单服务、每组的库值数及原料行数驱动，预期为单商品的小集合而非定义库总量。若单商品累计到 1,000 条配置行，仍保持同一商品 aggregate、窄屏整体堆叠及唯一 Drawer body 滚动，不分页/截断/跨组混排；这会暴露为异常配置压力，不能借定义库 500 上界或改为 item-local cursor。[focused：1,000 config draft 仍按 stable group/value ref 选中并不出现独立栏滚动。]
- `dataSourceAndCascade`：删除库组/值时 owner 清除所有商品组配置、值覆盖和相应 option-value BOM，但保留商品、StockTarget、原材料商品。[acceptance：三保留+三清除。]
- `forbiddenUI`：商品不得新增/重命名/隐藏/重排库可选项，不得替换或增删库定义的扣料原料。

### CATLIB-IA-06 · 商品属性库

- `businessTask`：查找、新建或进入商品属性定义详情；名称为首列链接，编码单列展示。
- `actorAndScenario`：在当前总部或门店维护可复用商品属性的运营用户。
- `entryAndSurface`：商品元数据 Modal 的“商品属性库”内容 Tab。
- `controlType`：名称链接、新建按钮、无分页列表；不是 SKU 销售属性入口。
- `validationAndError`：同 scope 编码唯一；第 501 条定义存在时 owner 返回 typed problem，页面不显示截断的前 500 条。
- `accessibilityAndTestId`：首列链接、搜索、创建可键盘到达；数量异常和加载错误不只用颜色。
- `emptyLoadingErrorStates`：空态“暂无商品属性”；加载时保留当前数据，失败时显示 owner 原因。
- `containerBehaviorUnderLoad`：静态取值为 §2.1 `metadata-attribute-library-tab`。常规约 100 条；一次全量读取，500 是五倍余量和异常信号，501 owner 拒绝而不分页/截断。长名称截断加提示，商品元数据 Tab 头、表头和新建操作不随行数滚出视口。[acceptance：501 fixture。]
- `stateAndPermission`：catalog owner 按当前 scope 与实时 grant 决定读写。[acceptance：跨 scope 拒绝。]
- `navigationAndRefresh`：创建/更新/删除后只刷新当前库列表与当前详情，受影响商品 detail 失效。
- `collectionShapeAndScale`：今天为 0 条（Dexter 已裁定清库）；上线常规约100条，由一个总部/门店不断增加可复用描述定义驱动。`Bounded(500)` 是源码上界（常规约100的五倍余量），501 是异常而非扩容触发：owner typed reject、界面不渲染截断前500条、不分页；达到1,000条时同样在第501条被拒绝，并作为数据异常处理。[acceptance：501条即拒绝，故1,000条不能被静默读出。]
- `dataSourceAndCascade`：catalog owner list/detail/readback；定义删除使同 scope assignment/value 被清理。
- `forbiddenUI`：不得分页、不得复用 SKU 属性库、不得显示技术实现术语。

### CATLIB-IA-07 · 商品属性定义详情

- `businessTask`：维护属性名称、可改编码、类型和可选值；删除前理解商品会保留、已填属性会移除。
- `actorAndScenario`：当前 scope 的属性库维护运营用户。
- `entryAndSurface`：商品元数据 Modal 内“商品属性库”Tab 的名称链接打开 Drawer。
- `controlType`：名称/编码 Input，类型 Select；文本类型不出现可选值，单选/多选显示可编辑选择项明细。
- `validationAndError`：编码同 scope 唯一；已使用定义的类型/选项更新为 U-03，不在 UI 擅自承诺；删除 readback 明确赋值和值移除而非商品删除。
- `accessibilityAndTestId`：字段标签、可选值行、删除确认可达且有明确业务名称。
- `emptyLoadingErrorStates`：文本类型显示“此属性由商品填写文字”；可选值为空时给出新增引导；失败保留草稿。
- `containerBehaviorUnderLoad`：静态取值为 §2.1 `attribute-definition-drawer`。选择项是当前定义的 Detail 子集合，不独立分页；长值截断加提示，由唯一 Drawer body 滚动。[focused：文本类型不渲染选择项区。]
- `stateAndPermission`：catalog owner 做 scope/grant、编码唯一和级联范围判定。
- `navigationAndRefresh`：成功后刷新当前定义与受影响商品 detail；关闭不产生 app 本地事实副本。
- `collectionShapeAndScale`：今天为 0 条（Dexter 已裁定清库）；每个定义的选择项由该业务含义决定，不跟库总量增长，属于 definition `Detail` 子集合。若定义被维护到1,000个选择项，仍以整个定义读写和唯一 Drawer body 滚动呈现，不分页/截断；它是异常配置压力，不能借库定义500上界或把选择项提升为独立库。 [focused：1,000行草稿的选择项仍归同一定义。]
- `dataSourceAndCascade`：catalog owner aggregate；删除止于本 scope assignment/value，商品继续存在。[acceptance：商品仍可读。]
- `forbiddenUI`：不以字典作废阻塞替代已裁定级联，不混同 SKU 属性。

### CATLIB-IA-08 · 点单选项库

- `businessTask`：查找、新建或进入点单选项定义详情。
- `actorAndScenario`：当前 scope 的点单规则维护运营用户。
- `entryAndSurface`：商品元数据 Modal 的“点单选项库”内容 Tab。
- `controlType`：名称链接、新建按钮、无分页列表；名称为首列、编码为次列。
- `validationAndError`：501 owner typed reject；不将 `FIXED` 显示为可选选择方式。
- `accessibilityAndTestId`：名称链接和操作可键盘到达；加载/空态/错误清晰区分。
- `emptyLoadingErrorStates`：空态“暂无点单选项”；加载不清屏、错误不改写。
- `containerBehaviorUnderLoad`：静态取值为 §2.1 `metadata-option-library-tab`。常规约 100 条；全量读取，500 为五倍余量和异常信号，501 拒绝并显示业务错误；长名称截断提示、不分页。[acceptance：501 fixture。]
- `stateAndPermission`：catalog owner 以 scope 和实时 grant 判断。
- `navigationAndRefresh`：定义变更只刷新当前库及当前详情，删除使受影响商品 detail 失效。
- `collectionShapeAndScale`：今天为 0 条（Dexter 已裁定清库）；上线常规约100条，由当前商品库增加可复用点单规则驱动。`Bounded(500)` 是源码上界（常规约100的五倍余量），501 owner typed reject、不分页/截断；达到1,000条时同样在第501条被拒绝并作为数据异常处理。[acceptance：501条即拒绝，故1,000条不能被静默读出。]
- `dataSourceAndCascade`：catalog owner aggregate list/detail/readback。
- `forbiddenUI`：不得把商品内联组当库定义，不得用 cursor/page 绕开 501 拒绝。

### CATLIB-IA-09 · 点单选项定义详情

- `businessTask`：维护一个点单选项的名称、创建时确定的编码、单选/多选、有序可选项，和当前可选项所需的扣料原料。
- `actorAndScenario`：当前 scope 的点单规则维护运营用户。
- `entryAndSurface`：商品元数据 Modal 内“点单选项库”Tab 的名称链接打开 Drawer。
- `controlType`：顶部基本资料；选项组编码只在新建时填写，已有定义只读展示“创建后不可修改”；左侧有序“可选项”稳定选择当前项，每项编码只在新增时填写，已有项只读展示；右侧仅显示“正在编辑：当前可选项”及其“扣料原料”。新增值自动成为当前项，删除后选相邻项或空态；整个定义一次保存。
- `validationAndError`：仅 SINGLE/MULTIPLE；选项组编码和可选项编码在创建后均拒绝变更；扣料原料可为零项，存在时只能选择同 scope 且已有可解析 StockTarget 的原材料商品；不在这里填商品实际用量。typed 错误就地呈现。[acceptance：无可用库存对象的原材料被拒绝；update 带改变后的组/值编码即拒绝。]
- `accessibilityAndTestId`：左项选择、排序、右侧原材料增删均键盘可达；选中状态不只依赖颜色，当前项名称可读。
- `emptyLoadingErrorStates`：无可选项时右侧显示“请先新增可选项”；当前项无扣料原料时显示“该可选项不扣减原材料”；候选失败保留草稿。
- `containerBehaviorUnderLoad`：静态取值为 §2.1 `option-definition-drawer`。左、右不是两个滚动集合：Drawer body 统一滚动；左项与右侧当前项稳定关联，切换立即替换右集合，绝不混排不同项的原料。右侧原材料是当前项 Detail 子集合，长商品名截断加提示；宽度不足时整块按左后右堆叠。[focused：选择/删除/排序与当前项切换。]
- `stateAndPermission`：catalog owner 审核当前 scope/grant；保存强制原料时在同一写动作调用 inventory public resolution judgement。
- `navigationAndRefresh`：aggregate 成功 readback 后刷新当前库和引用它的商品候选；不逐行提交。
- `collectionShapeAndScale`：今天为 0 条（Dexter 已裁定清库）；定义自身为 `Detail`，可选项数量由一个点单问题的业务范围、单项原材料数量由配方驱动，均不随库总量增长。若当前定义累计1,000条可选项/原料明细，仍只在同一 Drawer body 中呈现，左侧定位当前项、右侧只呈现该项原料，不分页/截断/混排；这是异常配置压力，不能套用库定义500上界。 [focused：1,000行草稿切换当前项时右侧集合仍只属于该项。]
- `dataSourceAndCascade`：catalog definition owns group/value/template intent；inventory owns StockTarget/BOM。删除组/值时清除商品 config/override 与对应 option-value BOM，但保留商品、StockTarget、原材料商品。[acceptance：三清除、三保留。]
- `forbiddenUI`：不得跨当前可选项混排原料、不得显示“组件/target/BOM”等技术词、不得把库存对象当独立点单选项。

### CATLIB-IA-10 · 品牌复制冲突

- `businessTask`：在复制预检中理解并处理同编码、不同语义的定义冲突。
- `actorAndScenario`：有源品牌读取和目标门店写权限的运营用户。
- `entryAndSurface`：既有品牌复制 Drawer 的预检步骤。
- `controlType`：冲突定义名称、编码、差异原因列表；硬阻断只可关闭或先整理定义，不出现确认/覆盖选择。
- `validationAndError`：同编码但类型、可选项或强制原材料不同即 `BLOCKED`；执行前重跑预检，过期结果不能执行。
- `accessibilityAndTestId`：每条冲突可读且可定位，硬阻断状态有文字说明。
- `emptyLoadingErrorStates`：无冲突展示正常预检；预检失败保留已选复制范围与服务端原因。
- `containerBehaviorUnderLoad`：静态取值为 §2.1 `brand-copy-conflict`。冲突行随唯一 Drawer body 滚动，长差异原因换行/提示但不撑宽；footer 始终在可操作区域，无列表内二次纵滚。[focused：BLOCKED 不进入确认集合。]
- `stateAndPermission`：owner 在 preflight 与 execute 都重检 scope、grant、闭包和 digest。
- `navigationAndRefresh`：成功复制后重取结果、目标门店定义与商品；被阻断时不触发前端补偿刷新。
- `collectionShapeAndScale`：今天为 0 条（Dexter 已裁定清库）；预检结果由一次复制闭包的定义/商品数驱动，是 copy-request `Detail` readback，非定义库500上界。若结果到1,000条，仍随唯一 Drawer body 滚动、长原因换行/提示，不分页/截断或把 BLOCKED 隐藏；这提示一次复制范围异常，但不改变 hard block 语义。[focused：1,000条结果中任一 BLOCKED 仍不进确认集合。]
- `dataSourceAndCascade`：catalog preflight 产生 definition compatibility，inventory/production 按既有 coordinator 合成；深复制后重写 definition/assignment/BOM 引用。
- `forbiddenUI`：不得把 `BLOCKED` 转成可确认项，不得自动复用/覆盖。

### 3.1 不可见维度的可证伪观察（逐 IA-ID 补充）

| IA-ID | stateAndPermission | navigationAndRefresh | collectionShapeAndScale | dataSourceAndCascade | forbiddenUI |
| --- | --- | --- | --- | --- | --- |
| 01 | [acceptance] 无当前商品库读取权限时商品列表与商品元数据读取均拒绝。 | [focused] 商品写入不重取定义库 query。 | [static] 工作台没有顶层 Tab、定义库 list/cursor/page。 | [acceptance] 定义删除令受影响 item detail 无赋值/配置。 | [static] 商品工作台没有顶层 Tab 容器及商品属性库/点单选项库入口。 |
| 02 | [acceptance] 仅授权 A 商品库的身份读取 B 商品库任一元数据 Tab 均拒绝。 | [focused] 属性库 mutation 不重取 SKU 销售属性 query。 | [focused] 切换定义库 Tab 不合并/分页六类元数据结果。 | [static] CatalogDictionaryDrawer 只将相应 Tab 的查询传给 CatalogDefinitionLibraries。 | [static] 两个定义库只出现于商品元数据 Modal，不在商品工作台。 |
| 03 | [acceptance] 无 create capability 不产生 DRAFT。 | [focused] `afterOpenChange(false)` 前 Drawer 未 open，之后以 edit intent 打开。 | [static] request 只有 `categoryRef?`，无 `categoryRefs[]`。 | [acceptance] create readback 同时有 DRAFT 与唯一分类/空分类。 | [static] 创建 surface 是 Modal 且无 attributes JSON 控件。 |
| 04 | [acceptance] 删除定义后商品仍可读、assignment/value 均不存在。 | [focused] 成功 save 以 owner item detail readback 覆盖 draft。 | [focused] 1,000 assignment draft 不引入 item-local page/cursor 或第二滚动。 | [acceptance] SINGLE/MULTIPLE 值只接受所属启用选择项。 | [static] `attributes` free-map/editor 不再为该页写入来源。 |
| 05 | [acceptance] 商品保存只校验用量；无 StockTarget 的原料只在建库保存被拒绝。 | [focused] 当前 group ref 改变时三栏都从同一 ref 重算，移除后选相邻或空态。 | [focused] 1,000 config draft 仍无跨组混排/独立栏滚动。 | [acceptance] 删除库组/值后 config/override/option-value BOM 消失而三类保留事实仍可读。 | [static] 不存在 FIXED 控件或商品内新建/改名/重排库值写入。 |
| 06 | [acceptance] A scope 身份不能读取 B scope 属性库。 | [focused] 成功删除只刷新商品元数据内当前属性库 Tab 及受影响 item detail。 | [acceptance] 501 即拒绝，1,000 不会返回局部列表。 | [acceptance] catalog owner list/readback 是唯一来源。 | [static] 库列表没有 cursor/page 参数或前端 slice。 |
| 07 | [acceptance] 同 scope 重复编码拒绝；删除后商品仍在。 | [focused] aggregate save 之后重取 detail 而非保留 local mirror。 | [focused] 1,000选择项仍归一个 definition aggregate。 | [acceptance] 删除只级联 assignment/value，不删除商品。 | [static] TEXT 类型没有选择项编辑区。 |
| 08 | [acceptance] A scope 身份不能读取 B scope 点单选项库。 | [focused] 保存/删除只刷新商品元数据内当前点单选项库 Tab 与引用 detail。 | [acceptance] 501 即拒绝，1,000 不会返回局部列表。 | [acceptance] catalog owner list/detail/readback 是唯一来源。 | [static] 不存在 item-local 点单定义入口或 FIXED mode。 |
| 09 | [acceptance] 定义保存时无同 scope 可解析 StockTarget 的原料拒绝。 | [focused] whole aggregate success 后才刷新商品元数据当前 Tab/候选，不逐行 mutation。 | [focused] 1,000行时右侧仍仅订阅 current value ref。 | [acceptance] 组/值删除同时清 config/override/BOM，商品/StockTarget/原料仍可读。 | [static] 左右无独立内容滚动，右侧不出现其他可选项原料；组和值编码创建后均不可编辑。 |
| 10 | [acceptance] execute 重新 preflight，BLOCKED 时无写入。 | [focused] blocked result 不触发确认集合、不会刷新为成功结果。 | [focused] 1,000冲突行仍在唯一 Drawer body 内且 BLOCKED 不隐藏。 | [acceptance] copy readback 表明 definition/assignment/BOM ref 被重写。 | [static] BLOCKED 行没有 checkbox、确认或覆盖操作。 |

## 4. 错误语义与界面映射

| problem code | HTTP | 业务规则映射 | 触发界面/owner | 用户可见处理 |
| --- | --- | --- | --- | --- |
| `CATALOG_DEFINITION_LIMIT_EXCEEDED` | 4xx，具体 status 在契约正本冻结 | 501条定义：常规约100、500为五倍余量的源码上界，禁止截断/分页 | 两个库列表 / catalog owner | “定义数量异常，暂不能继续新增，请先整理后重试。” |
| `CATALOG_ATTRIBUTE_DELETE_CASCADE` | 4xx 或成功 readback，按删除确认/执行契约冻结 | 属性定义删除只清 assignment/value，商品保留 | 属性定义 Drawer / catalog owner | 删除前展示影响范围与保留事实；成功后刷新，不伪称未受影响。 |
| `CATALOG_OPTION_DELETE_CASCADE` | 4xx 或成功 readback，按删除确认/执行契约冻结 | 组选项或单个可选项删除清 config/override/对应 BOM，三类事实保留 | 点单选项 Drawer / catalog+inventory | 删除前展示影响范围与保留事实；成功后刷新，不伪称未受影响。 |
| `CATALOG_COPY_DEFINITION_CONFLICT` | 4xx preflight/execute，具体 status 在契约正本冻结 | 同码而类型、可选项或强制原材料不同即 BLOCKED | 品牌复制 Drawer / copy coordinator | “暂时不能复制”，列出定义和差异；无确认按钮。 |
| `CATALOG_OPTION_SELECTION_RANGE_INVALID` | 4xx，具体 status 在契约正本冻结 | MULTIPLE 的 min/max/default 不合法；max=1仍MULTIPLE | 商品点单选项页 / catalog owner | 就地字段错误，保留输入。 |
| `INVENTORY_TARGET_REQUIRED_FOR_OPTION_MATERIAL` | 4xx，具体 status 在契约正本冻结 | 建库选择的原材料没有同 scope 可解析 StockTarget | 点单选项定义 Drawer / catalog+inventory | 仅在点单选项库中提示选择其他原材料；商品页不显示库存就绪检查。 |

## 5. 交叉对账与完成判定

| 检查 | 结果 |
| --- | --- |
| IA ↔ 交互工件 | 十个 screen 的入口、surface、可见业务文案、容器静态取值一致：工作台无顶层 Tab 容器、商品主面直出；两个定义库只在商品元数据 Modal 的并列 Tab。 |
| IA ↔ 详设 | 本文的 500/常规100/五倍余量/501 typed reject、owner、refresh、删除止点、copy hard block 与后续详设逐字一致。 |
| IA ↔ Journey | CATLIB-IA-01..10 都追到 Journey §2、§4、§7。 |

```text
IA_DIMENSIONS=CATLIB-IA-01..10，全部可见/不可见维度已声明
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=是
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=6（名称为设计占位；实现前以契约正本收敛）
CROSS_CHECK_WITH_DESIGN=REVISE_PENDING_DEXTER_WIREFRAME（本次已同步 UI/IA/详设/串行计划；等待修订线框确认）
DEXTER_WIREFRAME_REVIEW=REVISE@2026-08-20（商品元数据 Modal 裁定）
IA_STATUS=DEXTER_WIREFRAME_REVISION_REQUIRED；不构成 implementation authorization
```

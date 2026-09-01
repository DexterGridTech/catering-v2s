# 商品库编辑、引用与套餐体验根因整改方案

`PLAN_KIND=EXPERIENCE_REMEDIATION`

状态：`IMPLEMENTATION_READY_DEFAULT_PATHS_ONLY`

日期：2026-08-26

> 2026-08-30 Dexter 裁决：商品编辑抽屉的整单草稿仅存在当前打开会话内；关闭经统一 dirty guard 确认后丢弃，商品编辑不再提供异常关闭/刷新后的持久化恢复。本文涉及商品编辑草稿恢复的旧表述以 `doc/decisions/2026-08-30-v2s-catalog-item-editor-transient-draft-close-discard.md` 为准；编辑内元数据 child task 的“不读写过渡 session”边界不变。

> 2026-08-30 Dexter 后续裁决：规格属性和属性值选择变化后自动生成规格组合；不再提供重复的“生成规格”按钮或每行“维护属性值”入口。规格属性库维护保留在第一步顶部唯一入口，属性值选择框使用所在区域的满宽档；第二步规格矩阵及其逐行编辑边界不变。

独立对抗审查已完成两轮：Round 1 的四项结构缺口与 Round 2 的分母问题均已在本文件修订；根据两轮上限，后续以本体逐点源码对账收口。附录 B 的三项产品裁定不进入默认实施路径。

## 1. 目的、授权与边界

本方案处理运营管理后台商品库中“看不懂正在选什么、编码替代名称、编辑被打断、规格和套餐像技术表单、引用关系不能解释动作限制”的同根问题。它不是对十四张截图逐点调样式：任何改动都必须同时闭合 owner 事实、任务 read、contract、draft、surface、焦点恢复与测试。

本文件只提出整改方案，不启动动态环境、不重置、不 seed，也不把静态分析表述为浏览器验证。通过独立对抗审查并取得必要产品裁定后，才可实施。

继续遵守下列已确认事实：商品库是唯一工作台；查看与编辑分离；商品分类为最多三级的树；商品与规格均有独立生命周期；生产标签是商品级 0..1；规格是消费者可见的有序集合；套餐不得套套餐；商品标准价允许未设置。V4 只作为交互参照，不能回退 V2S 的 owner、单值、whole-save、术语或 surface 边界。

## 2. 从用户任务出发的根因

| 用户任务                                     | 当前失败                                         | 真实根因                                                                                                                          | 不能采用的“修复”                                               |
| -------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 在编辑中判断选中的分类、标签、物料或商品     | UUID 或编码成了控件主文本                        | task read 没有带名称，或已选 ref 未回填标签；前端只能把稳定身份当展示名                                                           | 把 UUID/编码改成另一个前端猜测文本；全量拉取字典               |
| 在一个商品草稿内持续完成规格、套餐与引用核对 | 行内碎控件、技术字段、跳转后丢失上下文           | 以持久化 JSON/数组形状直接铺 UI，而没有主从任务面；编辑和只读治理混在同一 tabs                                                    | 用 CSS 压缩卡片；把 disabled 表单当详情；再开候选 Drawer       |
| 缺少字典定义时继续编辑                       | 维护入口样式不一致，切换后用户不知道草稿去了哪里 | 曾将编辑内维护错误建模为顶层“编辑→配置”接力，迫使草稿落到过渡存储并制造返回卡片；现裁定为编辑抽屉保持打开、配置作为其唯一子任务面 | 关闭父编辑；让配置任务覆盖商品草稿；让子任务自行持有第二份草稿 |
| 看引用并判断能否作废                         | 无引用与不能作废并列，且只给编码                 | `references`、`voidAvailability`、相关商品标签是三份不完整 read projection；没有“哪里使用→造成何限制”的统一模型                   | 前端按 boolean 或 JSON 猜阻断原因；把引用关系做成可编辑字段    |
| 维护消费者看到的规格和套餐顺序               | 用户手填“顺序”数字                               | displayOrder 的技术持久化值被直接暴露，未映射为可访问的重排动作                                                                   | 删除消费者顺序；只提供拖拽而没有键盘/按钮替代                  |

## 3. 静态分母与追踪方法

本轮前端根共有 **102** 个 TS/TSX 文件，其中排除 `test/spec` 后的生产文件为 **86** 个。唯一可复现的第一层扫描命令是：

```sh
rg -l '规格|套餐|引用|字典|分类|NameCodeText|displayOrder' \
  apps/frontend/operations-admin/src/features/catalog-management -g '*.{ts,tsx}' \
  | rg -v '(/|\\.)(test|spec)\\.' | sort
```

它当前得到 **46** 个生产候选（含 model 与 UI，不等于都要改）；带测试的同一扫描为 **57**。`<TreeSelect` 有 **5** 个 JSX 调用点（分布于 4 文件），`NameCodeText` 消费者 **23** 个。`composite` 的 **19** 个、`governance|references|voidAvailability` 的 **17** 个只是风险路由扫描，完整命令和成员见附录 C；不得误作全部变更分母。此前 84/21/15 不是可由定义命令复现的数字，已退役，不得作为实施分母。

| 问题族               |                                                当前静态候选分母 | 已确认的实际宿主                                                                                                                               | 完整链路                                                                                         |
| -------------------- | --------------------------------------------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 名称优先而非编码     | `NameCodeText` consumer 23 文件；代码展示候选从 46 文件逐项分类 | `CatalogItemCompositeEditor`、`CatalogItemReadOnlyPresenters`、`CatalogItemGovernanceView`、`CatalogItemGovernanceEditor`、库存/BOM 导航       | `CatalogCompositeFacts`/detail reference projection → edge contract → `catalogModel` → presenter |
| 分类已选项可读       |                                   `<TreeSelect` 5 个 JSX 调用点 | `CatalogItemBasicEditor`、`CatalogItemCreateDrawer`、`CatalogBatchActionModal`、`CatalogCategoryActionModal`（新建父级、挪父）；批量空值是反例 | category candidates → `useCatalogCategoryCandidates` → TreeSelect selected-value rendering       |
| 规格编辑与排序       |                46 文件候选中的规格读写路径；可见“顺序”输入 1 处 | `CatalogItemSkuSpecificationsEditor`、草稿适配器、规格 matrix/read view                                                                        | dimension/value draft → matrix rows → whole-save/readback                                        |
| 套餐编辑与查看       |                                    `composite` 生产候选 19 文件 | `CatalogItemCompositeEditor`、`CatalogItemCompositeView`、`CatalogItemReadOnlyPresenters`                                                      | composite facts → detail contract → draft → child task/view                                      |
| 快捷维护与选择器规范 |                             4 个 editor entry；候选 picker 5 类 | `CatalogDescriptorPicker`、`CatalogItemEditorSectionAssembler`、`CatalogItemProductionEditor`、`CatalogDictionaryDrawerState`                  | editor draft/session → workspace task reducer → configuration query/candidate refresh            |
| 引用与治理           |                                                     `governance | references                                                                                                                                     | voidAvailability` 生产候选 17 文件                                                               | `CatalogItemGovernanceView`、`CatalogItemGovernanceEditor`、view/editor tabs、detail decoder | catalog+inventory owner read → detail contract → RTK currentData → view only |

附录 A 是 46 个成员的逐个处置表。每项实施前必须重新运行上述命令；没有被列入变更的候选文件必须登记为“正确反例/非用户面/测试专用/已正确消费名称”，而不是因为本次截图未触及就默认无关。

## 4. 整改目标交互

### 4.1 统一的“业务名称 + 次级编码”呈现

1. 所有**引用另一个商品、规格、物料、单位、分类、标签或套餐组件**的可见主文本为名称；编码仅在需要区分同名项时作为次行/括号辅助信息，并由 Tooltip 给出完整值。
2. 能打开当前工作区内详情的名称使用链接型按钮；纯展示名称不伪装成链接。主实体的名称和编码仍按既有列表列模型分层，不能在名称中拼入编码。
3. task read 必须返回展示所需的 `name` 与必要的 `code`；前端不根据 ref、UUID、当前页候选或另一张列表反查名称。BOM 是已有正确反例：它已返回并优先消费 `itemName/skuName`，应复用该模式而不是重写。
4. 套餐组件 read model 增加商品名称、规格名称（若适用）；引用关系 read model 增加关联对象名称、业务方向和用户可读关系说明。阻断原因与 `canVoid` 从同一 owner blocking-facts 投影派生。

#### 引用投影矩阵：不同事实不能混成一条“关系”

| 路径              | 事实 owner / 来源                                           | task read 的名称投影                                     | 用户 surface                        | 可维护性与缺失策略                                                  |
| ----------------- | ----------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| 套餐分组内容      | catalog `catalog_composite_component` → 被选商品/规格       | `itemName`、`itemCode`、可空 `skuName`、`skuCode`        | 套餐查看、套餐编辑已选摘要          | 是套餐草稿的一部分；无名称不是 code fallback，而是 owner read 失败  |
| 系统派生引用边    | catalog/inventory 的 `CatalogItemReference` / inbound facts | `relationLabel`、关联对象 `name`、必要 `code`、direction | 查看/编辑内的只读治理摘要、作废说明 | 不可编辑；没有关联对象名称即 owner read failure，不把边变成用户关系 |
| 用户维护商品关系  | `CatalogItemRelation`（若当前 shape/read 已暴露）           | 关系类型业务名称、另一端 `name`、必要 `code`             | 查看关系明细                        | 只有此路径才可有维护动作；不得与系统守卫边共用写入口或表格          |
| 库存/BOM 耗用对象 | inventory target/BOM task read                              | 已有 `itemName/skuName` 优先，`itemCode/skuCode` 仅辅助  | 库存与 BOM 查看/编辑                | 可修改的是 BOM 行选择，不是关联事实；名称缺失按 task read 失败处理  |
| 复制/预检结果     | copy owner 的执行/预检 readback                             | 业务对象 `name` + 必要 `code`                            | 复制向导与结果报告                  | 执行报告可显示编码作审计性辅助，不把 code 当名称；不反查当前工作台  |

这张矩阵是名称投影的单一消费者边界；它不把 `CatalogItemReference`（系统派生的归档/作废守卫）与 `CatalogItemRelation`（用户维护的业务数据）合并。

### 4.2 分类树：稳定 ref 不得泄漏为 UUID

分类持久化仍为 opaque ref，分类候选仍走 owner cursor tree；显示层另建**已选节点回填**：编辑、新建、分类新建/挪父打开时，当前 ref 必须带 owner 返回的 name/code/path 进入 `TreeSelect` 的 label 形态。根节点按需加载与搜索树仍独立；清空、禁用和三级 owner 约束不变。

禁止把 code 改写为 value、把整个树预取到浏览器，或在未能解析已选 ref 时显示 UUID。解析失败应显示可恢复的“分类信息已变化，请重新选择”，并保留其它草稿。

| TreeSelect surface | 初始值                        | label/path 唯一来源                                             | identity 改变时                                          | 解析失败                                             |
| ------------------ | ----------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| 编辑商品分类       | 现有 `categoryRef` 或空       | detail 的分类路径；缺少时由 category candidate read 按 ref 回填 | itemCode/version 变化时清旧 label 与旧 search generation | 字段下显示“分类信息已变化，请重新选择”，其余草稿保留 |
| 新建商品分类       | 可空父/分类 ref               | create candidate/read 回填                                      | 关闭或 scope/brand 变化清空                              | 同上                                                 |
| 批量移动分类       | 可空目标分类 ref              | category candidate read                                         | 批量对象或 scope/brand 变化清空                          | 原位阻止提交并说明                                   |
| 新建分类的父级     | 可空 `parentCategoryRef`      | category candidate read                                         | modal 关闭、scope/brand 变化清空                         | 原位提示，不能传 UUID                                |
| 挪动分类的目标父级 | 当前/可空 `parentCategoryRef` | category candidate read（包含三级、循环禁用原因）               | 当前分类或 scope/brand 变化清空                          | 原位提示，owner 仍作最终深度/循环拒绝                |

搜索仍只复用 `useCursorCandidates` 的 debounce/cursor 生命周期；tree 的逐父加载和 selected-label hydration 分别只处理树节点与既有值，不能形成第三套候选状态。

### 4.3 表单控件与快捷维护的一致性

只消费 `frontend-coding-standard.md` §3-K-1 的唯一四档字段宽度（短 `160px`、中 `320px`、长 `560px`、满宽 `100%`），不在本计划或 catalog helper 定义第二套数值。catalog helper 只将既有档位映射到字段角色：编码/数量/单位/状态/选择规则为短；名称和单值规格属性为中；说明为长；商品分类、商品标签、生产标签、套餐组件搜索和动态矩阵/集合为满宽。多选 Tag 在控件内换行，不能按内容收窄。

所有“维护〈字典〉”属于当前表单的**次级动作按钮**：相同尺寸、相同位置（字段标题右侧）、相同文案与相同焦点回归规则；不再一处是 link、一处是 button。动作不是保存，不用 primary。

### 4.4 编辑内维护商品元数据：保留父编辑、删除过渡状态

Dexter 已于 2026-08-26 推翻旧“关闭编辑后配置再恢复”的过渡方案。整改以以下四项为准：

1. 触发按钮打开“维护商品元数据”子任务，父编辑不关闭；
2. 子任务标题说明其维护范围，关闭后不出现工作台 return card；
3. 关闭动作回到原区段和触发控件，刷新对应候选但不覆盖 dirty draft；
4. 所有编辑内配置入口使用同一 `onOpenConfig(kind, triggerTestId)` 和 foundation `useDrawerFormLifecycle`；其 child task 不创建 return token。

Dexter 于 2026-08-26 裁定：编辑内维护商品元数据是 Editor 的一层子任务，父编辑抽屉不得关闭；该子任务的过渡路径
不得读写过渡 session、`returnToEdit` 或工作台“继续编辑”状态。按 2026-08-30 的后续裁决，商品整单草稿也不跨关闭或刷新恢复，仅在当前编辑会话内保留并由 dirty guard 控制；工作台直接打开的配置仍是第一层 Drawer。

### 4.5 规格：采用 V4 的任务顺序，不复制 V4 的旧术语/局部保存

规格编辑改为两个连续区：

```text
规格维度（选择维度） → 可选值（多选、可新建） → 规格矩阵（每行一个规格）
```

- 规格维度使用中档、动态属性值集合使用满宽；选择维度后清其旧值，删除或更换值前说明受影响规格。
- 规格属性或属性值选择变化时自动生成可编辑矩阵；不再额外提供“生成规格”按钮。矩阵是规格身份、名称、价格、单位、状态、默认项、图片与识别码的唯一编辑处。每行有稳定 `editorId`/已落库 ref，不能用 code 或 index 作 React key。
- 消费者顺序通过“上移/下移”操作维护，保存时由数组位置派生连续 `displayOrder`；支持拖拽可作为增强，但必须有上述键盘可达替代。不得再显示可编辑数字“顺序”。
- 规格子任务面只用于一行的复杂识别码、制作信息或媒体，不再把这些字段挤进维度配置区；关闭回矩阵原行，保存仍是商品 whole-save。

**矩阵 reconcile（禁止静默丢行）**：以已选规格属性值按规格维度顺序组成的稳定组合 digest 作为匹配键；重建后同 digest 的行必须复用原 `editorId` / 已落库 `productSkuRef`，并保留名称、价格、单位覆盖、状态、默认项、媒体、识别码和制作覆盖。新 digest 只生成待填写的新行；不再存在的 digest 进入“将移除的规格”影响清单，逐行展示名称和将失去的事实，确认前不改草稿。改变维度导致多个旧行映射到同一 digest 时，阻止并逐行说明冲突，不能 pick-first。默认项只有原 digest 仍存在时才保留；否则在确认清单中说明“需重新选择默认规格”。保存前要求 digest 唯一、消费者 displayOrder 连续；whole-save readback 逐行按 `productSkuRef`/digest 验证保留字段与移除字段，无 index 匹配。

### 4.6 套餐内容：主从工作台 + 专注候选子任务

套餐用户的心智顺序是“套餐 → 套餐分组 → 该组可选内容”，不是 JSON 行数组。编辑区改为：

```text
左：套餐分组列表（名称、选择方式、已配内容数、错误/未保存）
右：当前分组
  ├─ 分组名称与选择方式
  ├─ 已选内容表（商品名称、规格、数量/单位、加价、状态、默认）
  └─ 添加内容 → 专注候选子任务（分类树 + 名称/编码搜索 + 已选摘要 + 应用到草稿）
```

- 选择商品后才允许选择其规格；改商品清旧规格。候选面只显示可用于套餐的商品，保留 owner 准入，不能前端按商品形态猜测。
- 当前套餐组件 `unit` 是 catalog owner 保存的自由字符串；现有契约也没有说明它与所选商品/规格的何种单位事实的关系。因此不能把 Input 直接换成 Select，也不能擅自宣称是库存耗用单位。本项登记为 **D-EC-02**：Dexter 需要裁定套餐组件数量的业务单位是“所选商品/规格的销售单位”、其他已存在的单位事实，还是该数量根本不应独立保存。裁定前，CP-EX-04 不得修改 `unit` 的用户文案、校验、候选来源、保存或 readback 语义；只能改善名称投影、分组层级和候选子任务。
- 分组和内容使用上移/下移而不是手填顺序；删除、切换选择方式、改变最少/最多选择在会丢失不兼容草稿时先 confirm。
- 查看态使用同一层级：分组标题 → 选择方式中文说明 → 内容行（名称、规格、数量/单位、加价/默认/状态）。不显示 group/component code、`FIXED/SINGLE` 枚举、ref 或技术“组件”。

V4 可借其稳定树定位、分组/内容分层和规格依赖选择；不能复刻它的 index 身份、候选 Drawer 叠层、raw `SKU` 术语或局部提交。

### 4.7 引用关系与治理：只读事实族，禁止伪装为可编辑表单

“引用关系”不是用户可以编辑的商品事实。已批准的编辑抽屉仍保留“引用关系与治理摘要”这个**只读事实族**，但不给它注册 Form、draft slice 或保存字段；查看 Drawer 承载完整关系明细。这样保留既有 IA/交互的编辑区段分母，又不把只读治理误导为“编辑商品的一部分”。

1. “正在使用”按业务位置分组（例如套餐内容、库存用料、商品关联），每行展示名称、必要的次级编码和关系说明；可打开只读详情的名称提供链接。
2. “为什么暂不能作废”只在 `canVoid=false` 时出现，逐条展示来自 owner 的业务阻断原因和相应下一步；无阻断不展示黄色告警。
3. 编辑内只读区段与 header 都只显示紧凑治理摘要（例如“当前不能作废：包含 3 个规格”）；完整引用与阻断明细只在查看 Drawer 的治理区打开。不得为了从编辑跳查看而同时叠开两个第一层 Drawer，也不得把完整引用 tab 变成整单保存字段。

**待 Dexter 裁定 D-EC-03**：若产品要彻底取消编辑中的只读治理事实族，应先同步更新正式需求、交互稿和 IA 的区段分母，再实施；本计划默认不做这项范围变更。

这既保留店长的治理信息，也避免把只读关系伪装成可编辑区段。

## 5. Contract、状态与控制权

| 事实或状态                            | 单一住址与控制者                                          | 前端使用者                       | 禁止                                                                 |
| ------------------------------------- | --------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| 关联项/套餐组件的展示名称、编码、状态 | catalog owner task read / detail contract                 | View、套餐编辑摘要、候选选中摘要 | 用 ref/code/current page 反查或伪造名称                              |
| 分类 ref 的可见 label/path            | category owner candidate/read projection                  | 5 个 TreeSelect                  | UUID 直接进入 input；全量预取树                                      |
| 商品编辑草稿及其规格/套餐 slices      | `useCatalogItemDraft`；仅当前打开会话内存持有，关闭后清空 | 编辑 Drawer/子任务               | 子任务或配置直接写 owner；用 index 作集合身份；跨关闭/刷新持久化恢复 |
| 选中分组、选中套餐内容、候选查询输入  | 编辑 UI local reducer                                     | 套餐编辑/候选子任务              | 进入持久化草稿；切换项自动保存                                       |
| 编辑内商品元数据维护                  | editor child-task state + `useCatalogConfigLibrary`       | 编辑内维护面                     | 关闭编辑、写/读过渡 session 或 return token；配置持有商品草稿        |
| 作废可用性与阻断说明                  | owner 同一 blocking facts readback                        | 查看治理/动作确认                | 前端从 references、status 或 JSON 重新推断                           |
| 控件宽度/动作层级/省略策略            | 前端编码规范 + shared catalog presentation helper         | 全部 catalog editors             | app 内散写 `width`、同义动作按钮                                     |

## 6. 实施阶段与逐步对账

### CP-EX-00：实时分母与不变量复核

- 重跑附录 C 的全部命令并对照附录 A：102 个 TS/TSX、86 个 non-test production、46 个词法候选、5 个 TreeSelect JSX、23 个 `NameCodeText` 消费者，以及词法扫描之外的 3 个已确认实质宿主；数字或成员不同即更新本计划，不按快照实施。composite/governance 扫描只用于补充同根反例，不作为 CP 放行分母。
- 重开正式需求、IA、交互设计、frontend coding standard、foundation capability 目录、V4 参照和本计划；逐项登记原文约束。
- 验收：每个候选分类为变更、已正确反例或测试/非用户面；没有“未检查的候选”。

### CP-EX-01：先补任务 read，再消费名称

- 用 P1 唯一生成源扩展套餐组件与引用关系的 detail read contract；owner 对同一批 refs set-based 读名称与必要 code，不逐行查询。
- 更新 model decode、whole-save/readback、copy/seed fixture expectations；retire 只返回 code 的正向展示链。
- 验收：同名商品可由次级 code 区分；任何引用/套餐 UI 不出现 UUID，名称缺失有 typed/read failure，不静默显示 code 作为名称。

### CP-EX-02：分类标签 hydration 与标准候选外观

- 复用 `useCursorCandidates` 搜索分支和现有 tree per-parent cursor；补 selected-ref label hydration，不新建第三套 candidate lifecycle。
- 建立 catalog field-width helper/token，并迁移商品标签、生产标签、规格属性值、套餐候选等全部同类选择控件。
- 验收：三条带预填分类的入口在 root 未加载时仍显示名称/路径；连续输入使用既有 debounce；各宽度档在同类字段一致。

### CP-EX-03：规格矩阵与消费者顺序

- 将维度/值编辑与规格矩阵拆为专职 View/Editor；移除手填顺序输入，以重排动作连续派生 displayOrder。
- 按 V4 主从顺序恢复可理解操作，但继续使用 V2S whole-save、稳定 editorId、生产标签/单位规则和中文术语。
- 验收：新增/删除/重排值后矩阵与 draft 同步；上移/下移、键盘焦点和 tooltip 可用；没有 `addonBefore="顺序"` 可见输入。

### CP-EX-04：套餐主从工作台与候选子任务

- 引入当前分组 UI 选中态和专注候选子任务，不再以内嵌碎控件或二次候选 Drawer承载商品选择。
- 用 CP-EX-01 名称投影渲染选中表和只读详情；D-EC-02 未裁定时保留 `unit` 的当前业务语义和输入，只将其放入清晰的内容行，不伪造新的候选来源。
- 验收：商品切换清规格；取消候选子任务不动草稿；保存前可看清每组将保存什么；查看态和编辑态层级一致。

### CP-EX-05：治理退出编辑 Form，并完成快捷维护回归

- 保留编辑内只读“引用关系与治理摘要”事实族，删除其 Form/草稿/保存参与；查看 Drawer 提供完整治理 section，用 owner blocking facts 解释 action availability。
- 统一四个快捷维护入口为编辑内子任务；父编辑保持打开，关闭子任务归还原触发焦点，候选精确失效而商品草稿不变。
- 验收：无引用商品没有“存在关联或依赖”告警；有阻断时列出事实；快捷维护的关闭、Esc、dirty、焦点均走 foundation lifecycle，且该路径零 `returnToEdit`/过渡 session。

### CP-EX-06：逐步对账与证明

每完成 CP-EX-01 至 05，主 agent 用其 RECALL 自查后交 fresh 独立子 agent 做行为、形态、动作、关系、位置、用户文案、限制、state/control、失败/恢复、可访问性/焦点、数据来源/失效边界的对账；有 OPEN 必须先修复并复查，才能进入下一 CP。

静态/Focused 至少覆盖：名称投影与同名次级识别；TreeSelect 已选 label；宽度档；规格重排与 stable key；套餐商品→规格依赖、取消和应用；引用/作废投影一致；编辑内配置保持父编辑、关闭后焦点归还且不走过渡恢复；所有用户可见术语扫描。浏览器 L2 另行验证键盘重排替代、焦点回归、子任务关闭、长文本 Tooltip、横向表格与详情链接。

### 6.1 实施期用户反馈逐项对账（2026-08-26，未以截图外观代替源码核验）

下表是当前工作树的真实结论。`待运行验证` 不是“已完成”：它表示源码与 focused proof 已闭合，但远端 DEV 尚未加载本轮 Java 产物；必须在受管 restart 后重新观察。`未闭合` 必须继续进入对应 CP，不能因同类问题已有一处修复而结案。

| 用户反馈                                                       | 根因与唯一控制者                                                                                                        | 当前处置                                                                                                                                                                            | 当前状态                     | 关闭证据                                                                                                                         |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 商品名称应是链接；SKU 展开控件在名称左侧；SKU 有层级缩进       | 列表唯一渲染器 `CatalogItemListTable`                                                                                   | 名称为 link Button，显式展开控件位于名称前，SKU 行保留 24px 缩进与层级线；选择列只负责批量勾选                                                                                      | 已闭合（静态）               | `CatalogItemListTable.test.tsx` 的 link/expander/indent 断言；DEV 视觉复核待做                                                   |
| 列首行字体不得特殊、短标签不得被省略、图片与列宽需一致         | 同一列表渲染器和 `catalogTableColumnWidths`                                                                             | 第一行统一 12px；单个短标签不截断；父商品 72px、SKU 60px，横向滚动保留全部列                                                                                                        | 已闭合（静态）               | `CatalogItemListTable.test.tsx` 的 visual-rhythm、short-tag、width 断言                                                          |
| 分类输入框出现 UUID                                            | 分类 owner detail 必须给出 category path；TreeSelect 只能消费 path/name                                                 | 已选节点回填现收敛到唯一的 `useCatalogCategoryCandidates`；编辑、新建、创建分类和挪动分类均传入 owner-backed 路径。批量移动初始值为空，是不应伪造“已选分类”的反例                   | 已修复待运行验证             | focused 证明“祖先未加载仍显示业务路径、已在深层加载时不重复”；DEV 再验证预填编辑和挪动分类                                       |
| 商品标签、生产标签、规格属性值的选择框宽度和快捷维护动作不一致 | `CatalogDescriptorPicker` 与前端字段宽度标准                                                                            | 已对本次点名的 descriptor 迁移宽度；但尚未用四档 helper 覆盖全部选择控件，不能按局部一致误报全局收口                                                                                | 未闭合                       | CP-EX-02 完成同根选择控件分母与四档宽度迁移；以 JSX 不再散写未命名宽度为静态判据                                                 |
| 用户不应手填“顺序”                                             | 草稿数组位置是 displayOrder 的唯一事实                                                                                  | 上移/下移重排后连续派生 `displayOrder`；旧手填 SKU 卡片整块已删除                                                                                                                   | 已闭合（静态）               | `CatalogItemSkuSpecificationsEditor` 无旧 card、`CatalogItemSkuMatrixTable` 为唯一矩阵                                           |
| 快捷维护关闭编辑抽屉令人困惑                                   | 顶层配置与编辑内维护混为同一 task，强迫过渡持久化                                                                       | 维护商品元数据改为 Editor child task；父编辑不关闭、draft 不持久化/恢复、关闭归还原触发控件                                                                                         | 已闭合（静态）；浏览器待验证 | child reducer/焦点 helper/组件接线 focused proof；浏览器 L2 验证 Esc、遮罩、dirty、焦点与草稿不变                                |
| 套餐内容详情与编辑过于技术化                                   | 套餐组件 readback、候选与主从编辑分散                                                                                   | 现有 readback 已有商品/规格名称、编辑已有分组主从表；但商品选择仍是内嵌 Select，缺少专注候选子任务。D-EC-02 的数量单位语义仍冻结                                                    | 未闭合                       | CP-EX-04；名称/候选任务可先做，D-EC-02 裁定后才改单位语义                                                                        |
| 引用关系是否属于编辑、为何不能作废                             | owner `actionAvailability.voidAvailability.blockingReasons` 是唯一事实；编辑区只读                                      | 编辑中不进入 draft/save；但 owner 没有解释时前端仍显示“当前商品暂不能作废”的无因告警，不能把这个 fallback 当解释                                                                    | 未闭合                       | CP-EX-05 必须把 `canVoid=false && blockingReasons=[]` 定为 readback 错误并显式可诊断，不能静默泛化                               |
| 任何引用/候选/BOM 不得把编码当名称                             | 关联名称是 catalog owner task-read/readback 事实，编码仅次级识别；BOM owner 本身即使没有库存对象也必须解析 catalog 名称 | 本轮修复 inventory owner 的 candidate、BOM component 与 BOM owner projection：一次 set-based catalog task-read 返回 `itemCode/itemName/skuCode/skuName`；前端删除“（已保存）”伪标签 | 已修复待运行验证             | 前端 focused 134 PASS；后端 `compileTestJava` PASS；新增 candidate + saved BOM readback 业务断言，待 Testcontainers/DEV          |
| BOM 下拉里的“已保存”含义不明                                   | 前端为不在当前 cursor 页的 targetRef 临时造了状态文字                                                                   | 当前 Vite 源模块与 focused 渲染均无该文字，库存 owner 的 BOM readback 已返回名称；但用户正在打开的页面仍出现旧文字，说明运行态尚未逐请求证实                                        | 未闭合（运行态不一致）       | 先在不丢失草稿的前提下重新载入该 surface；若仍出现，保存实际 HTTP body 与模块路径，沿 response/renderer 链定位，不以源码扫描结案 |

以下台账把同一轮截图中的具体反馈拆开；它是上表的实施明细，不用“同类问题已改一处”合并结案。`运行态不一致`只表示当前用户会话、实际 HTTP readback 与当前被 Vite 提供的源码尚未三方逐请求核验；它既不能被解释为“旧源码必然在运行”，也绝不构成已验证通过。

| 编号 | 用户可见问题                                         | 根因                                                                                 | 当前源码事实                                                                                                                                                                                                                                                            | 状态与下一动作                                                                                                  |
| ---- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| F-01 | 名称应是链接                                         | `CatalogItemListTable` 决定主实体名称的动作样式                                      | 名称使用 link Button；编码是次行文本                                                                                                                                                                                                                                    | 静态已对账；待浏览器验证焦点与打开详情                                                                          |
| F-02 | 所有引用与候选不得以编码代替名称                     | task-read/readback 没有完整名称投影时，旧 UI 把稳定 code 当主文本                    | inventory candidate、BOM owner 投影与协调器现在都拒绝“名称等于编码”的坏事实；BOM、套餐候选/已选摘要、生产标签和配置对象均名称主行，必要编码只作次级消歧                                                                                                                 | 部分修复：复制预检与复制 readback 仍缺名称 projection；当前 HTTP readback 也必须逐面核验                        |
| F-03 | 分类框不能显示 UUID                                  | 已选 ref 的业务 path 没有统一注入候选树                                              | `withSelectedCategoryPath` 已收敛进唯一树候选 hook；编辑/新建/分类新建/挪父传 owner-backed path，批量移动初始为空不造假值                                                                                                                                               | 静态已对账；待浏览器验证                                                                                        |
| F-04 | 标签和规格属性值选择框不能按内容收缩、宽度必须有标准 | 部分调用点直接给 literal width，未全量映射到四档字段宽度                             | SKU 的单值规格属性使用中档 `320px`；动态规格属性值占满其所在行宽 `100%`；字典搜索/状态筛选和创建/编辑面分别收敛到 `320/160` 与 `480/720` 标准档；仍需完成其余 descriptor call site 的逐面核验                                                                           | 部分修复：按字段角色迁移为标准四档并做全分母扫描                                                                |
| F-05 | 不让用户填“顺序”                                     | `displayOrder` 的持久化字段曾直出为 Input                                            | 规格值已用上移/下移派生连续顺序                                                                                                                                                                                                                                         | 静态已闭合；SKU 全体验仍需重做                                                                                  |
| F-06 | 快捷维护不能让用户不知编辑内容去了哪里               | 将编辑内维护错误建模为顶层切换                                                       | 编辑抽屉保持打开；元数据维护是唯一 child task；关闭后回原控件，商品草稿不写/读过渡存储                                                                                                                                                                                  | 静态 focused 已闭合；浏览器待验证 Esc、遮罩、dirty、焦点与草稿不变                                              |
| F-07 | SKU 编辑应采用 V4 的任务顺序                         | 现有维度/值/矩阵仍把草稿结构直接堆成密集卡片                                         | 已显式收敛为“选择规格属性和可选值（自动生成规格组合）→ 检查并补充每个规格”；规格库维护只保留第一步顶部入口，值排序仍只使用上移/下移，whole-save 边界不变                                                                                                                | 部分修复：仍需浏览器核验矩阵可读性、焦点及长值组合                                                              |
| F-08 | 套餐查看不能展示编码/技术枚举                        | `CompositeGroupsReadOnly` 把 group/component 的存储字段串成一行                      | 已改为分组名、中文选择方式、商品/规格名称、数量、加价与状态的层级呈现；名称位含 code 时明确显示读取异常                                                                                                                                                                 | 部分修复：仍需浏览器核验长内容、空组及状态组合                                                                  |
| F-09 | 套餐编辑的候选列表与组件表难用                       | `CompositeCandidatePicker` 是嵌入式 Select，所有字段平铺进横表                       | 已改为“添加内容”后的 720px 专注选择子任务和分组主从卡片；该子任务是获批“编辑抽屉上仅一层子任务面”的唯一实例，不另开 Drawer。候选请求显式声明 `COMPOSITE_COMPONENT` 用途并由 catalog owner 排除当前套餐，保存 owner 再拒绝自引用；首次渲染的已选分组现会立即显示右侧内容 | 部分修复：单位语义冻结；仍需浏览器核验子任务焦点归还与窄屏布局                                                  |
| F-10 | 引用关系不应被当作可编辑事实；不能作废要说明原因     | 系统派生引用与编辑 draft 混淆，且 `undefined` 被当作 `canVoid=false`                 | 编辑区只读；`canVoid` 仅在 owner 明确 false 时显示限制；owner 缺关联对象名称改为 read failure                                                                                                                                                                           | 已修复待远端 Java restart 验证；完整“哪里使用/为何限制”仍未闭合                                                 |
| F-11 | BOM 选择项中要显示商品名称，不要“已保存”             | 名称投影错误与旧 renderer 的 cursor-page selected-option 伪状态叠加                  | 当前源已无“已保存”；候选、已选行和 owner projection均拒绝把编码视为名称。用户页面仍显示旧文字，说明实际 HTTP readback/已加载模块/页面会话尚未逐请求证实                                                                                                                 | 未闭合：抓取该面实际 response 与已加载模块，确认是陈旧页面会话、旧数据响应还是遗漏 renderer；未证实前不宣称修好 |
| F-12 | “当前不可作废”不能与“无引用”矛盾                     | 前端把缺失 `voidAvailability` 错当 false，且旧远端 Java 未含 owner read-failure 保护 | 当前 View/Editor 只对 `canVoid === false` 告警；没有原因时显示“限制信息暂时无法确认”而非泛化拒绝                                                                                                                                                                        | 已修复待远端 Java restart 验证                                                                                  |

下面是本轮以前及本轮页面反馈的补充分母。它们与 F-01 至 F-12 同样受逐项关闭规则约束；不因问题未出现在最近一张截图而降级。

| 编号 | 用户可见问题                                            | 同根与唯一控制者                                                                             | 当前状态                                                                                                                                                                                                                        | 关闭判据                                                                                                                     |
| ---- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| F-13 | “未启用商品”数量与草稿列表不一致                        | `CatalogOwnerService.readNavigation` 是导航计数唯一事实，RTK navigation cache 是显示唯一事实 | 源码统计已包含 `DRAFT` 和 `DISABLED`；真实页面仍为 0，未闭合                                                                                                                                                                    | 实际 navigation response 的 `INACTIVE.count` 与同 scope 下 `DRAFT/DISABLED` 列表总数一致；刷新后树显示该数                   |
| F-14 | 树节点数量被推到行最右侧                                | `CatalogTreeLine` 的 flex layout                                                             | 已静态修为名称后紧随数量、操作仍独立在末端；待视觉核验                                                                                                                                                                          | 所有智能视图、形态、标签、生产标签、分类节点都遵守同一位置                                                                   |
| F-15 | 列表首行文字有不必要的特殊字号                          | `CatalogItemListTable` 的 cell presentation                                                  | 静态已统一首行字阶；待视觉核验                                                                                                                                                                                                  | 十列表的商品、形态、价格、规格/选项、属性、制作、库存/BOM、更新时间、状态、来源首行字阶一致                                  |
| F-16 | SKU 父子展开与视觉层级不清                              | `CatalogItemListTable` 的 expander/child row presentation                                    | 静态已在商品名左侧显示展开动作，SKU 行有缩进；待视觉核验                                                                                                                                                                        | 勾选列只用于批量，展开控件与名称同行，子规格可读且不参与父级批量                                                             |
| F-17 | 商品草稿而子规格启用的含义不清                          | item/SKU 独立生命周期是 owner 事实，列表必须表达其组合含义                                   | 静态已修：父商品不是启用状态时，规格状态次行明确“商品未启用，规格暂不对外使用”                                                                                                                                                  | 浏览器核验真实 Tag 与次行语义，不让两个状态看似矛盾                                                                          |
| F-18 | 库存/BOM 配置对象列表像技术字符串，难以选择             | `CatalogInventoryRuleOwnerNavigation` 把持久化 node 直接串成弱层级文本                       | 已改为“选择要配置的对象”任务导航：商品与规格分组、名称主文本、对象类型 Tag、库存方式次行、明确选中态；禁止 code 作标题                                                                                                          | 部分修复：需浏览器核验长名称、选中切换和小屏布局                                                                             |
| F-19 | 商品详情中的库存/BOM、引用关系缺少可解释的事实          | owner task read → readonly presenter                                                         | 部分 owner/前端修复；完整关系明细与动作限制仍未闭合                                                                                                                                                                             | 每个“不能作废”都有 owner 阻断事实、业务名称、关系方向和下一步；无阻断不出现警告                                              |
| F-20 | 商品分类层级前端和 seed 不一致                          | category contract + owner command + copy + candidate + seed 是同一不变量                     | 三层限制已落入主写路径；品牌复制深度拒绝已补，待全链验证                                                                                                                                                                        | 任意新建、挪父、复制都不能写出第四层；三层叶节点不再提供新建子分类入口                                                       |
| F-21 | 生产标签不是路由前可选集合，而是商品唯一归属            | singular `productionTagRef` + production tag navigation                                      | owner/contract/seed 已单值；导航分支已存在，待体验核验                                                                                                                                                                          | 商品至多一个生产标签；树有“生产标签”一级和二级标签筛选，不把它混作商品标签                                                   |
| F-22 | 标签短文本被无意义截断                                  | list cell tag presentation                                                                   | 静态已针对短标签取消截断；待视觉核验                                                                                                                                                                                            | 短标签完整显示；只有超过单元格可读范围时截断并给 Tooltip                                                                     |
| F-23 | 商品列宽与图片尺寸失衡                                  | `catalogTableColumnWidths` 和 item cell media                                                | 静态列宽/72px 父图/60px SKU 图已调整；待视觉核验                                                                                                                                                                                | 全部十列保留横向滚动，图片不挤压商品名称、编码、分类和标签四行信息                                                           |
| F-24 | 引用关系既是详情 Tab 又出现在编辑区，用户不知是否可编辑 | 只读治理事实与 draft/save boundary                                                           | 查看态保留“引用关系”，并按业务位置分组展示关联商品名称，可在同一查看抽屉打开关联商品；编辑态 Tab 改为“关联与依赖（只读）”，只保留紧凑分组摘要且不随本次保存                                                                     | 静态已修：编辑保存请求没有 relation/governance 字段；浏览器核验两种 surface 的标题和关联商品返回路径                         |
| F-25 | 任意引用位置把编码当名称                                | task read 的 display projection，而非前端兜底                                                | BOM candidate、BOM/readback、套餐候选、系统引用、库存/BOM 配置对象和 descriptor 已选值已接入名称优先；owner 也拒绝“名称等于编码”的坏 readback。复制预检仍待逐面复核                                                             | 部分修复：主文本必为名称；编码只作为同名消歧次级信息；名称缺失成为 task-read failure，不回退 code                            |
| F-26 | 所有选择器宽度、快捷维护动作和状态不一致                | `frontend-coding-standard.md` 四档宽度与 action family 是唯一规范                            | 已新增 `catalogFieldWidths` 作为商品库字段宽度唯一来源，并迁移商品创建、基础资料、识别码、筛选、字典和 SKU 规格字段；规格属性值选择框使用满宽，SKU 第一步只保留顶部规格属性维护入口；仍需完成剩余 dynamic collection 的逐面归类 | 部分修复：每个选择器按字段角色映射短/中/长/满宽；“维护…”一律次级 Button，且离开/返回反馈一致                                 |
| F-27 | SKU 配置区把结构化草稿直接暴露给用户                    | `CatalogItemSkuSpecificationsEditor` 必须以 V4 任务顺序重组                                  | 已实施连续任务文案和宽度档：选择规格属性和值后自动生成规格组合、逐规格补充；矩阵仍是唯一逐规格编辑处                                                                                                                            | 部分修复：浏览器需验证无障碍、焦点与长组合；不得重回手填顺序                                                                 |
| F-28 | 套餐查看内容把 code、枚举和所有事实挤成一行             | `CompositeGroupsReadOnly` presenter                                                          | 已按业务层级呈现，拒绝 code/枚举作为主文本                                                                                                                                                                                      | 部分修复：浏览器需验证长内容和空态                                                                                           |
| F-29 | 套餐编辑像 JSON 行数组，没有完成任务的步骤              | `CatalogItemCompositeEditor` + candidate subtask                                             | 已有左分组、右组详情、“添加内容”专注子任务；商品后才允许选规格；候选用途和排除自身均由 owner 约束，whole-save 边界不变                                                                                                          | 部分修复：浏览器需验证焦点归还、窄屏和 unit 冻结边界                                                                         |
| F-30 | 刷新/重启后仍显示旧 UI/旧统计，误导是否已修复           | DEV 运行 identity 与 RTK cached currentData 的失效边界                                       | 未闭合                                                                                                                                                                                                                          | 受管 DEV run identity 变化后，工作台 navigation/items/detail 不得把上一 run cache 当当前事实；保留未保存草稿，不强制丢弃编辑 |
| F-31 | 物料/BOM 已选项出现“已保存”且没有名称                   | inventory owner display projection + BOM selected option renderer                            | 未闭合，当前页面是反例                                                                                                                                                                                                          | 真实 HTTP readback 同时带 itemName/skuName；渲染只用名称标签，不产生“已保存”；任何一侧缺失即明确故障而非 code fallback       |
| F-32 | 套餐候选不能由通用列表和前端形态猜测决定                | 通用商品列表没有声明套餐用途，且保存 owner 原先允许当前套餐引用自身                          | `CatalogItemPageQuery.candidateUsage=COMPOSITE_COMPONENT` + `excludeItemCode` 是契约化候选用途；catalog owner 按同 scope、非作废、排除当前商品读取，保存 owner 复核并拒绝自引用                                                 | 静态已对账；待 HTTP 证明候选不含当前商品，篡改 self-reference 被 owner 拒绝                                                  |
| F-33 | 完整引用明细需要按“哪里使用”而非平铺文案呈现            | relationLabel 作为位置事实未被消费，查看抽屉无单层关联商品导航                               | 查看态按 owner `relationLabel` 分组，名称链接在同一查看抽屉打开关联商品；编辑态仅显示位置计数摘要                                                                                                                               | 静态已对账；待浏览器验证导航、返回和长名称                                                                                   |
| F-34 | 复制向导把当前目标商品伪称为“当前打开商品”并只带编码    | copy task state 只携带稳定 code，UI 没有读取当前目标详情                                     | 向导以现有 `getOperationsCatalogItem` readback 取目标名称；名称缺失明确显示读取异常，不用编码冒充名称                                                                                                                           | 静态已对账；待 HTTP/browser 验证首步、来源选择和复制范围三处一致                                                             |
| F-35 | SKU 与制作信息仍混用技术式前缀输入和不匹配的宽度        | `addonBefore` 与固定长档由持久化字段形状直接外露                                             | 制作信息改为标签在上、帮助在下；规格属性使用中档，动态属性值占满可用行宽，顺序仍只由重排动作控制                                                                                                                                | 静态已对账；待浏览器验证窄屏和错误态                                                                                         |

逐项对账规则：每行必须再核验行为、位置、文案、状态来源、可编辑性、恢复路径、数据来源和失效边界；任何一个维度不一致，该行回到“未闭合”，不得由“同文件已有改动”代替。

## 7. 禁止项与停机条件

- 禁止以 CSS、placeholder、fallback code、隐藏 UUID 或当前页面搜索结果掩盖 task read 缺字段。
- 禁止把引用关系、作废判断、套餐准入、分类可选性或单位语义移到前端推断。
- 禁止复制 V4 的 raw `SKU`、index identity、局部保存、第二个候选 Drawer、多 Tab 大配置 Modal 或旧销售/菜单事实。
- 禁止以手填数字保留消费者顺序；禁止仅拖拽没有按钮/键盘替代。
- 若 D-EC-01 的 surface 决策与既有 overlay 约束冲突，或名称投影需要跨 owner 写入，立即停在对应 CP，提交源码事实与最小裁定，不用 fallback 继续。D-EC-02 未裁定只阻断套餐 `unit` 的语义改造，不阻断名称、层级、布局和只读投影整改。

## 8. 对抗审查请求

审查人须独立重开 V4、V6、正式需求/IA/交互工件、102 文件前端根、contract、owner task read 与 foundation，不采信本计划。重点证伪：

1. “名称优先”是否误伤主实体编码列、已确认业务编码或无 name 的合法事实；
2. category label hydration 是否确实覆盖全部预填 TreeSelect，且没有创造第三套候选生命周期；
3. 规格/套餐是否真的可以借 V4 的主从体验但不回退 V2S whole-save/术语/层级；
4. 引用关系移出编辑是否遗漏一个真正可编辑事实；
5. 编辑→配置的现行裁定与 D-EC-01 是否清晰分开；
6. 宽度档、排序替代、焦点和 L2 oracle 是否可证伪。

## 附录 A：46 个生产候选的处置清单

下列名单由 §3 命令生成；`变更` 是本方案已确认的用户面或模型消费点，`正确反例/非用户面` 不得因为同根搜索就顺手重写，`复核` 是同根任务面、实施前必须给出明确“变更或反例”结论。所有名单均为仓根相对路径。

| 处置              | 成员                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 变更              | `model/catalogModel.ts`；`ui/CatalogBatchActionModal.tsx`；`ui/CatalogCategoryActionModal.tsx`；`ui/CatalogDescriptorPicker.tsx`；`ui/CatalogInventoryBomWorkbench.tsx`；`ui/CatalogInventoryRuleOwnerNavigation.tsx`；`ui/CatalogItemBasicEditor.tsx`；`ui/CatalogItemCompositeEditor.tsx`；`ui/CatalogItemCreateDrawer.tsx`；`ui/CatalogItemEditorFieldPresentation.tsx`；`ui/CatalogItemListTable.tsx`；`ui/CatalogItemProductionEditor.tsx`；`ui/CatalogItemReadOnlyPresenters.tsx`；`ui/CatalogItemSkuSpecificationsEditor.tsx`；`ui/useCatalogCategoryCandidates.tsx`；`ui/controllers/useCatalogCategoryActionController.tsx`                                                                                                                                                                                                                                                                        |
| 复核              | `model/catalogDefinitionForm.ts`；`model/catalogItemSaveRequest.ts`；`model/catalogTabLabels.ts`；`model/useCatalogItemEditorSession.ts`；`ui/CatalogConfigurationDrawerSurface.tsx`；`ui/CatalogConfigurationLibraryNavigation.tsx`；`ui/CatalogDefinitionLibraries.tsx`；`ui/CatalogDictionaryAtomModals.tsx`；`ui/CatalogDictionaryDrawerState.tsx`；`ui/CatalogInventoryBomView.tsx`；`ui/CatalogItemAttributesEditor.tsx`；`ui/CatalogItemBasicView.tsx`；`ui/CatalogItemEditorWorkspace.tsx`；`ui/CatalogItemIdentifiersEditor.tsx`；`ui/CatalogItemOrderOptionsEditor.tsx`；`ui/CatalogItemViewDrawer.tsx`；`ui/CatalogSkuAttributeLibrary.tsx`；`ui/CatalogWorkbenchItemList.tsx`；`ui/CatalogWorkbenchNavigationTree.tsx`；`ui/CatalogWorkbenchToolbar.tsx`；`ui/controllers/useCatalogSkuRows.ts`；`ui/controllers/useCatalogWorkbenchReadModel.tsx`；`ui/useCatalogItemEditorWorkspaceState.tsx` |
| 正确反例/非用户面 | `model/catalogIdentificationPreparationFeedback.ts`（服务端问题反馈，不是引用显示）；`model/catalogManifestLabels.ts`（manifest 标签）；`ui/BrandCatalogCopyDrawer.tsx` 与 `ui/LocalCatalogCopyDrawer.tsx`（复制审计报告允许业务编码辅助）；`ui/CatalogLifecycleStatusTag.tsx`（状态呈现）；`ui/CatalogTemporaryPromotionTask.tsx`（促销任务）；`ui/useCatalogItemEditorMediaActions.ts`（媒体生命周期）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

词法扫描之外已确认的实质宿主是 `ui/CatalogItemCompositeView.tsx`、`ui/CatalogItemGovernanceView.tsx` 与 `ui/CatalogItemGovernanceEditor.tsx`；它们必须作为 CP-EX-01/04/05 的变更点，但不偷改“46 个词法扫描成员”的分母。`ui/controllers/useCatalogWorkbenchReadModel.tsx` 只列一次，归入“复核”。附录中的“正确反例”不等于永久豁免：若 CP-EX-00 发现其把 ref/code 当名称，必须移至变更并完成同根证明。

## 附录 B：不进入默认实施的产品裁定

| 编号    | 问题                                           | 默认实施                                                                                  | 只有 Dexter 裁定后才可替代                                                     |
| ------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| D-EC-01 | 快捷维护时是否不关闭原编辑抽屉                 | **Dexter 2026-08-26 裁定：配置定义为编辑的一层子任务；编辑不关闭，不做过渡草稿保存/恢复** | 不适用                                                                         |
| D-EC-02 | 套餐组件数量的业务单位                         | 冻结当前自由文本 `unit` 的语义与存储；仅改善名称、层级和候选任务                          | 明确为销售单位、其他既有单位事实或删除独立单位语义后，才可改 contract/owner/UI |
| D-EC-03 | 是否取消编辑内的只读“引用关系与治理摘要”事实族 | 保留只读事实族，零 Form/零 draft/零保存字段；查看 Drawer 给完整明细                       | 同步修订正式需求、交互稿与 IA 后才可完全移出编辑                               |

## 附录 C：分母命令与同根风险扫描

以下命令均从仓根执行，`root=apps/frontend/operations-admin/src/features/catalog-management`；命令本身是分母的唯一解释，输出不得由人工估计替代。

```sh
rg --files "$root" -g '*.{ts,tsx}' | wc -l
# 102：全部 TS/TSX

rg --files "$root" -g '*.{ts,tsx}' | rg -v '(/|\.)(test|spec)\.' | wc -l
# 86：non-test production

rg -l '规格|套餐|引用|字典|分类|NameCodeText|displayOrder' "$root" -g '*.{ts,tsx}' \
  | rg -v '(/|\.)(test|spec)\.' | sort
# 46：附录 A 的词法成员；移除末尾 | sort 后取行数

rg -n '<TreeSelect' "$root" -g '*.tsx' | wc -l
# 5：JSX 调用点，不是文件数

rg -l 'NameCodeText' "$root" -g '*.{ts,tsx}' \
  | rg -v 'NameCodeText\.tsx$|(/|\.)(test|spec)\.' | wc -l
# 23：消费者，不含定义和测试

rg -il 'composite' "$root" -g '*.{ts,tsx}' \
  | rg -v '(/|\.)(test|spec)\.' | sed "s#^$root/##" | sort
# 19：风险路由，不是变更放行分母

rg -il 'governance|references|voidAvailability' "$root" -g '*.{ts,tsx}' \
  | rg -v '(/|\.)(test|spec)\.' | sed "s#^$root/##" | sort
# 17：风险路由，不是变更放行分母
```

`composite` 19 个成员：`catalogTestIds.ts`、`model/catalogItemEditorDraftAdapters.ts`、`model/catalogItemSaveRequest.ts`、`model/catalogModel.ts`、`model/catalogTabLabels.ts`、`model/useCatalogItemDraft.ts`、`model/useCatalogItemEditorSession.ts`、`ui/CatalogFactSectionBoundary.tsx`、`ui/CatalogItemCompositeEditor.tsx`、`ui/CatalogItemCompositeView.tsx`、`ui/CatalogItemCreateDrawer.tsx`、`ui/CatalogItemEditorFieldPresentation.tsx`、`ui/CatalogItemEditorSectionAssembler.tsx`、`ui/CatalogItemEditorSectionProps.ts`、`ui/CatalogItemReadOnlyPresenters.tsx`、`ui/CatalogItemViewSections.tsx`、`ui/CatalogWorkbenchNavigationTree.tsx`、`ui/LocalCatalogCopyDrawer.tsx`、`ui/useCatalogItemEditorWorkspaceState.tsx`。

`governance` 17 个成员：`catalogTestIds.ts`、`model/catalogModel.ts`、`model/catalogTabLabels.ts`、`model/useCatalogItemDraft.ts`、`ui/CatalogCategoryActionModal.tsx`、`ui/CatalogDictionaryDrawerState.tsx`、`ui/CatalogFactSectionBoundary.tsx`、`ui/CatalogInventoryRuleOwnerNavigation.tsx`、`ui/CatalogItemEditorFieldPresentation.tsx`、`ui/CatalogItemEditorSectionAssembler.tsx`、`ui/CatalogItemGovernanceEditor.tsx`、`ui/CatalogItemGovernanceView.tsx`、`ui/CatalogItemReadOnlyPresenters.tsx`、`ui/CatalogItemSkuSpecificationsEditor.tsx`、`ui/CatalogItemViewDrawer.tsx`、`ui/CatalogItemViewSections.tsx`、`ui/useCatalogItemEditorWorkspaceState.tsx`。

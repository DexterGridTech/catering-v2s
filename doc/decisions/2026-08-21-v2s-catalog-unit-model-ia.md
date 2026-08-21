---
title: 商品计量、销售单位与库存单位优化 · IA 详设
status: ACCEPTED_FOR_IMPLEMENTATION
---

# 商品计量、销售单位与库存单位优化 · IA 详设

## 1. 元数据

```text
IA_SCOPE=UNIT-IA-01..UNIT-IA-09
BUSINESS_SOURCE=doc/plans/platform/2026-08-21-v2s-catalog-unit-model-optimization-requirements-analysis-codex.md#unit-formal-model
JOURNEY_REFS=doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md#unit-model-journey
UI_INTERACTION_REF=doc/decisions/2026-08-21-v2s-catalog-unit-model-ui-interaction.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-08-21-v2s-catalog-unit-model-implementation-design.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED
IMPLEMENTATION_AUTHORITY=false
```

Dexter 要求先形成可整体审阅的五份工件；本文件因此完整表达设计，但不绕过交互工件的线框确认门。任何代码、契约、数据库、seed、DEV 或浏览器动作仍不在本文件授权范围内。

## 2. IA-ID

### UNIT-IA-01 · 商品元数据 Modal

| 维度 | 声明 |
| --- | --- |
| businessTask | 在一个既有入口内进入当前商品库的全部元数据维护面。 |
| actorAndScenario | 商品维护运营用户；在商品工作台点击“商品元数据”。 |
| entryAndSurface | `operations-admin` 商品工作台 → 既有 `CatalogDictionaryDrawer` Modal。 |
| controlType | 六个并列 Tab：商品标签、计量单位、SKU 销售属性、商品处理标签、商品属性库、点单选项库；不再新增工作台顶层 Tab。 |
| validationAndError | 当前 Tab 读取失败只在该 Tab 显示“加载失败 / 重试”；不把错误改写成“无数据”。 |
| accessibilityAndTestId | Tab 可用方向键和 Enter 切换；选中状态不只依赖颜色；`catalog-metadata-modal`。 |
| emptyLoadingErrorStates | Modal 首次打开保持已有 Modal loading；各 Tab 只显示本身的空态、加载态或错误态。 |
| containerBehaviorUnderLoad | 静态形态逐字采用交互工件 `catalog-metadata-modal`：Modal body 是唯一纵向滚动区，Tab 内容不另造纵向滚动祖先；六个 Tab 头、标题与关闭控件不出视口。数据多时单位列表随 body 滚动，Tab 头保持可见；1280px 以下 Modal 不横向滚动。 |
| stateAndPermission | **[backend-acceptance]** 使用没有商品元数据写能力的当前范围身份，读取可成功但任何单位写命令均被 owner 拒绝；UI 隐藏按钮不是授权依据。 |
| navigationAndRefresh | **[focused]** 单位创建、改名、停用或删除成功后发布 `operationsContentTabRefreshSignal`；Modal 仅重读当前单位 Tab，商品工作台与已打开的干净商品 Drawer 订阅同一信号。 |
| collectionShapeAndScale | Modal 是既有 metadata surface；单位 Tab 的集合另见 UNIT-IA-02。Tab 不产生独立分页或轮询。 |
| dataSourceAndCascade | 入口由商品工作台拥有；每个 Tab 的事实仍归各自 owner。关闭 Modal 必须完成当前列表行编辑/确认草稿的 lifecycle reset，不能保留子草稿。 |
| forbiddenUI | 不出现第二个单位库页面、顶层商品工作台单位 Tab、platform-admin 入口，或“技术状态/引用 ID”文案。 |

### UNIT-IA-02 · 计量单位库列表

| 维度 | 声明 |
| --- | --- |
| businessTask | 找到、查看当前范围可用计量单位，并决定新建、维护、停用或删除。 |
| actorAndScenario | 商品维护运营用户；在商品元数据 Modal 的“计量单位”Tab。 |
| entryAndSurface | `metadata-unit-library-tab` 内容 Tab。 |
| controlType | 首列“名称”为普通文本；名称、编码、单位类别、小数位数、状态、正在使用；本地名称/编码筛选；“新建计量单位”。没有详情入口或重复“查看”。 |
| validationAndError | 至多99条的 owner 列表读取超限时显示“计量单位数量超过可维护范围，请先整理单位库”；删除或停用冲突显示 owner 返回的业务原因。 |
| accessibilityAndTestId | 表头和名称文本有可读名称；长名称截断有完整名称提示；`unit-library-list`。 |
| emptyLoadingErrorStates | 空态“当前没有计量单位 / 新建第一个计量单位”；刷新时保留 `currentData`；失败保留旧列表并提供重试。 |
| containerBehaviorUnderLoad | 静态形态逐字采用交互工件 `metadata-unit-library-tab`：CatalogDictionaryDrawer Modal body 是唯一纵向滚动区，列表不另造滚动祖先；表头与“新建计量单位”不出视口。上界99条时表格随 Modal body 滚动，长名称截断，不创建分页、无限加载或表格内纵滚。 |
| stateAndPermission | **[backend-acceptance]** 相同商品库 scope 可以读其单位列表；换成另一 scope 的列表或命令必须拒绝。**[static]** GET 不声明 capability，写命令才有 capability/grant。 |
| navigationAndRefresh | **[focused]** 成功 mutation 只失效 `catalog-unit-list`、使用该单位的商品详情与库存详情 readback 标签；不会全局 refetch 无关标签或 SKU 属性库。 |
| collectionShapeAndScale | **Bounded**。典型十几个、最多几十个，上限固定99；owner scoped ordered query 取第100条检测位，第100条即 typed problem，不能返回前99条静默截断。到1000条的行为是第100条即拒绝，不渲染“1000条”。 |
| dataSourceAndCascade | catalog owner 返回同 scope 完整单位定义；协调读取一次合并 catalog 与 inventory 的使用摘要。停用后列表仍显示该行但候选集合移除它；删除成功后行移除。前端不扫描商品或库存来推算使用数。 |
| forbiddenUI | 不使用 cursor、分页、无限滚动、手写“刷新”按钮、按前端现有商品反推引用数，或管理员排序/上移下移。 |

### UNIT-IA-03 · 计量单位行内编辑与生命周期确认

| 维度 | 声明 |
| --- | --- |
| businessTask | 新建一个单位，或依照其是否已被使用，安全地修改、停用或删除它。 |
| actorAndScenario | 商品维护运营用户；从单位列表行操作或点击“新建计量单位”。 |
| entryAndSurface | 单位列表行内编辑 Modal；删除/停用使用其上的确认 Modal。不提供单位详情页或详情 Drawer。 |
| controlType | 新建/零引用：名称、编码、单位类别、小数位数均可编辑；已引用：仅名称可编辑，编码、类别、小数位数只读；零引用显示删除，已引用显示停用。`precision=0` 显示“只能填写整数”。 |
| validationAndError | 编码同范围唯一；小数位数为非负整数；停用/删除提交时重新检查引用数和版本。引用后改变编码、类别或小数位数显示“该单位已被使用；如需改变此项，请新建计量单位后在后续配置中选择”。 |
| accessibilityAndTestId | 所有只读原因有文字；确认 Modal 初始焦点在风险说明后的取消按钮；`catalog-unit-edit-modal`、`catalog-dictionary-status-change-modal`、删除确认 Modal。 |
| emptyLoadingErrorStates | 新建和行编辑不另读详情；列表读失败不显示空白编辑表单；保存失败保留用户输入，关闭后由 lifecycle reset。 |
| containerBehaviorUnderLoad | 行编辑使用现有 metadata Modal 内的标准编辑 Modal；确认 Modal body 是唯一滚动区。字段说明换行，不引入 Drawer、第二个纵向滚动祖先或独立详情 surface。 |
| stateAndPermission | **[backend-acceptance]** 零引用 update/delete 成功；在命令前插入商品/SKU/库存/盘点/BOM/历史任一引用后，delete 与非名称 update 均被 owner typed rejection，名称 update 成功。 |
| navigationAndRefresh | **[focused]** close 通过 `useDrawerFormLifecycle` 先进行 dirty/submit guard；`afterOpenChange(false)` 才 reset/rekey。成功后发布统一 refresh，失败不关闭。 |
| collectionShapeAndScale | 一个单位没有可编辑子集合；引用状态是 owner readback，不是前端扫描。 |
| dataSourceAndCascade | catalog owner 单独拥有 unit definition；协调命令提交时一次取得 catalog 与 inventory 的使用判断，任一引用均拒绝删除或定义性修改。停用只改变将来候选，不修改商品、SKU、库存对象、盘点换算、BOM 或历史快照。删除仅在两个 owner 均为零引用时物理删除。 |
| forbiddenUI | 不出现单位详情页/详情 Drawer、重新启用、本批之外的批量替换、删后级联清理、自由文本类别/小数位数，或三个生命周期写法。 |

### UNIT-IA-04 · 商品基础资料的两个单位

| 维度 | 声明 |
| --- | --- |
| businessTask | 为商品建立一个销售单位和一个基础计量单位。 |
| actorAndScenario | 商品维护运营用户；编辑商品基础 Tab。 |
| entryAndSurface | `CatalogItemDrawer` 的“基础”内容 Tab。 |
| controlType | “销售单位”“基础计量单位”均为单选；已停用但已保存的值只读显示“已停用”，清除后不可重新选择。前端不按余额或 `StockTarget` 自行固定基础计量单位；若新基础计量单位会使既有库存对象的消费单位快照发生漂移，允许进入保存并由 owner 在事务内拒绝。 |
| validationAndError | 可销售商品必须解析一项销售单位；直接库存管理或作为 BOM 组件的商品必须解析一项基础计量单位；不同于标签，不能多选。只要当前商品或 SKU 已有 `StockTarget` 且新基础计量单位与其当前消费单位快照不一致，catalog 保存事务内以 `CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED` 拒绝，显示“基础计量单位变更会改变既有库存对象的消费单位”；不按余额决定，不同步 target、不改写余额或历史，前端以 owner 返回的业务原因和文案为准。 |
| accessibilityAndTestId | 单选框含名称、编码、类别与精度辅助文本；`item-sales-unit`、`item-base-unit`。 |
| emptyLoadingErrorStates | 候选读取中禁用提交该字段；候选失败保留已绑定值和“重试”；没有候选时链接到“先维护计量单位”。 |
| containerBehaviorUnderLoad | 静态形态逐字采用交互工件 `item-basic-unit-settings`：商品 Drawer body 是唯一纵向滚动区；候选弹层自身滚动是唯一例外；1280px 以下不得横向滚动。长单位名在字段显示处截断并可查看完整名称。 |
| stateAndPermission | **[backend-acceptance]** Catalog owner 在 save 的同一事务校验当前 scope、状态、商品用途和有效单位；UI 传入停用/跨 scope ref 必须拒绝。 |
| navigationAndRefresh | **[focused]** 单位库 refresh 只重取候选；dirty 商品草稿不自动覆盖。保存成功后 item detail、工作台行与受影响库存 readback 刷新。 |
| collectionShapeAndScale | **Bounded field set**：每个商品恰有两个0..1标量槽位，不是独立列表；到1000个商品时仍由既有商品 Page/Cursor 负责，单位字段不抽干全商品。 |
| dataSourceAndCascade | 单位候选来自 catalog owner 的启用单位 Bounded read；item save 将有效商品级单位传给同一 REQUIRED coordinator。SKU 覆盖另见 UNIT-IA-06。 |
| forbiddenUI | 不出现 `salesUnitRefs[]`、多选标签、多个默认销售单位、手工输入单位名，或从库存 `measureMode` 推导单位。 |

### UNIT-IA-05 · 单位候选选择器

| 维度 | 声明 |
| --- | --- |
| businessTask | 在商品、SKU 或库存设置中选择一项可用单位。 |
| actorAndScenario | 商品/库存维护运营用户；打开任一单位单选字段。 |
| entryAndSurface | `unit-candidate-picker`；是字段控件，不是独立页面。 |
| controlType | 可搜索的单选下拉；每项显示名称、编码、单位类别和“小数位数”说明；无自由录入。 |
| validationAndError | 只列启用单位；当前已绑定停用单位不在候选中；盘点候选在读取时已按 target 消耗单位类别过滤，owner 仍复核维度不符并显示字段错误。 |
| accessibilityAndTestId | combobox、键盘上下/Enter、aria-live 空态；`unit-candidate-{fieldKey}`。 |
| emptyLoadingErrorStates | “当前没有可选的计量单位 / 先维护计量单位”；失败有控件内重试；旧选中值保留。 |
| containerBehaviorUnderLoad | 静态形态逐字采用交互工件 `unit-candidate-picker`：Ant Design Select 弹层与输入同宽，候选弹层是唯一可滚动例外，并在视口内翻转；长名称截断，不能撑出宿主 Drawer/Modal。 |
| stateAndPermission | **[backend-acceptance]** 同 scope 启用单位可读，停用单位不在候选 readback；已绑定停用单位只能由详情投影显示，不能由候选 read 取得。 |
| navigationAndRefresh | **[focused]** 选择新单位后只更新所属字段草稿；改变单位类别不产生前端换算。切换商品/SKU/关闭宿主时 `useAsyncGenerationGuard` 作废旧请求。 |
| collectionShapeAndScale | **Bounded**，与 UNIT-IA-02 完全相同：典型十几个、最多几十个、上限99；一次完整读取，第100条 owner 拒绝；1000条行为同样是拒绝而非分页。 |
| dataSourceAndCascade | 前四个 subjectType 调用 `listOperationsCatalogUnits(includeInactive=false)`；`STOCKTAKING_UNIT` 用 target 消耗单位类别调用同一 operation 的 `dimension` 过滤。元数据列表才传 `includeInactive=true`。候选不能由当前表格、名称文本或存量绑定值拼造。 |
| forbiddenUI | 禁止 cursor 抽干、分页、自由文本、新建另一个单位库、从已加载字典列表作本地权限真相。 |

### UNIT-IA-06 · SKU 单位覆盖

| 维度 | 声明 |
| --- | --- |
| businessTask | 让某 SKU 继承商品默认单位，或为该 SKU 覆盖成一个单一单位。 |
| actorAndScenario | 商品维护运营用户；编辑 SKU 行时。 |
| entryAndSurface | 商品 Drawer 的“条码与识别”Tab，SKU 行展开区。 |
| controlType | SKU 行列表+一个展开行；销售单位和基础计量单位各有“继承商品”或“改为此 SKU”两态，改为时各单选一个单位。 |
| validationAndError | 继承清除 override；覆盖必须有效且启用；商品默认变更只影响继承 SKU；用途要求单位而无有效继承/覆盖时字段报错。 |
| accessibilityAndTestId | SKU 名称为可展开控制；展开状态读出；`sku-unit-row-{skuRef}`。 |
| emptyLoadingErrorStates | 无 SKU 显示“当前商品没有 SKU”；候选失败不折叠现有覆盖；保存失败保留所有 SKU 草稿。 |
| containerBehaviorUnderLoad | 静态形态逐字采用交互工件 `sku-unit-settings`：商品 Drawer body 是唯一纵向滚动区；SKU 表与展开行不造第二纵滚；1280px 以下列不使 Drawer 横向溢出。 |
| stateAndPermission | **[backend-acceptance]** 同一 item save 在 owner 中逐 SKU 核验有效覆盖和继承结果；前端不能由条码、价格或 SKU 名称推断单位。 |
| navigationAndRefresh | **[focused]** 展开行切换时只替换该 SKU 的草稿视图，不混排别的 SKU 值；商品 Drawer 一次保存原子提交 item defaults 与所有 SKU overrides。 |
| collectionShapeAndScale | **Detail child collection**，SKU 数量沿用既有 SKU 矩阵边界；每个 SKU 固定两个0..1 override 槽位，单位本身不形成 per-SKU 候选分页。到1000个 SKU 时沿用 SKU 矩阵既有虚拟/分页决策，不把所有单位复制1000次。 |
| dataSourceAndCascade | catalog owner 解析 `SKU override → item default`；有效基础单位作为 inventory command 输入。 |
| forbiddenUI | 不出现多选单位、同 SKU 两个销售单位、SKU 列表内的单位排序、或将包装差异塞入同一 SKU 多单位。 |

### UNIT-IA-07 · 库存消耗单位快照与盘点设置

| 维度 | 声明 |
| --- | --- |
| businessTask | 查看库存余额真实使用的消耗单位，并仅为盘点录入设置换算单位。 |
| actorAndScenario | 门店库存维护运营用户；打开库存对象详情和“盘点设置”。 |
| entryAndSurface | `InventoryDetailDrawer` 内的只读消耗单位区和 `stocktaking-unit-settings` 设置区。 |
| controlType | 消耗单位只读（名称、编码、类别、小数位数快照）；盘点单位单选+“1盘点单位等于多少消耗单位”的正数有限数/分数输入。 |
| validationAndError | 不允许选择/改写消耗单位；盘点单位必须与消耗单位同维度，换算必须正且有限；输入和计算均按目标消耗单位 precision 向零截断。 |
| accessibilityAndTestId | 余额单位与盘点输入标签分开读出；截断说明文字可见；`stock-consumption-unit`、`stock-counting-conversion`。 |
| emptyLoadingErrorStates | target 尚无消耗快照显示“库存对象尚未建立”；盘点设置读取失败不伪造自由文本；提交失败保留换算草稿。 |
| containerBehaviorUnderLoad | 静态形态逐字采用交互工件 `stocktaking-unit-settings`：`adminWideDrawerSurfaceProps` Drawer body 是唯一纵向滚动区、footer 固定；换算说明在输入下方换行，长单位名截断，候选弹层独立滚动。 |
| stateAndPermission | **[backend-acceptance]** inventory owner 的 count/increase/adjust/configuration 只接受本 target 的消耗快照和可选盘点快照，不能传不同 target 或跨店单位 ref。 |
| navigationAndRefresh | **[focused]** 盘点换算保存成功只刷新该 target 详情、其库存列表行和盘点 action；不刷新商品单位草稿。 |
| collectionShapeAndScale | **Bounded field set**：每个 StockTarget 恰有一个不可编辑消耗单位快照和一个0..1盘点换算；不是 unit list。到1000个 StockTarget 时沿用库存列表既有 Page/Cursor，详情一次只读一个 target。 |
| dataSourceAndCascade | inventory owner 持有 target/ledger/BOM/盘点换算；catalog whole-save 在同一 REQUIRED transaction 传入有效基础单位快照。盘点换算不改写余额、BOM 或历史流水。 |
| forbiddenUI | 不出现自由文本单位、由 `measureMode` 作为单位、前端正则解析换算、固定6位精度、或库存页新建单位。 |

### UNIT-IA-08 · 品牌/本地复制的单位引用检查

| 维度 | 声明 |
| --- | --- |
| businessTask | 在复制商品前理解单位能否在目标范围被安全重建和改写。 |
| actorAndScenario | 总部或门店商品维护运营用户；品牌/本地复制预检。 |
| entryAndSurface | 既有 `BrandCatalogCopyDrawer` 与本地复制预检差异区。 |
| controlType | compatibility 行显示单位名称、编码和业务差异；可复制项正常展示，语义冲突显示“无法复制”且无确认框。 |
| validationAndError | 目标不存在时必须由 catalog 创建目标 scope 单位并映射；同编码类别/小数位数不同为 BLOCKED；不得复用总部 UUID。 |
| accessibilityAndTestId | BLOCKED 有文字原因和行定位，非仅颜色；`catalog-copy-unit-conflict-{code}`。 |
| emptyLoadingErrorStates | 预检中禁用执行；预检失败显示重试；没有单位依赖不显示空的冲突面板。 |
| containerBehaviorUnderLoad | 静态形态逐字采用交互工件 `brand-copy-unit-check`：复制 Drawer body 是唯一纵向滚动区，差异列表随 body 滚动，步骤头和底部动作不出视口。 |
| stateAndPermission | **[backend-acceptance]** target scope 不可见 source unitRef；preflight 和 execute 均重算 reference map，任何 sourceRef 出现在 target readback 即失败。 |
| navigationAndRefresh | **[focused]** BLOCKED 不进入确认集合且不可执行；复制成功后只刷新目标 scope 的商品/单位/库存读模型。 |
| collectionShapeAndScale | Detail preflight aggregate；其单位 dependency 子集最多等于当前商品、SKU、BOM 和盘点涉及的有限 refs，不是全库扫描。单位库本身仍上限99。 |
| dataSourceAndCascade | catalog owner 写单位映射；inventory owner 用映射写目标 target/BOM snapshots；coordinator 不拥有任何单位事实。 |
| forbiddenUI | 不自动复用 source UUID、按显示名称模糊匹配、前端补偿复制、确认 BLOCKED，或把无目标单位静默省略。 |

### UNIT-IA-09 · 截断反馈与历史只读显示

| 维度 | 声明 |
| --- | --- |
| businessTask | 输入盘点、增加、调整或 BOM 用量时看懂将按什么单位精度保存，并在历史中看到当时的单位快照。 |
| actorAndScenario | 门店库存维护运营用户；提交数量或查看流水/BOM。 |
| entryAndSurface | 既有 `InventoryActionModal`、库存详情流水与 BOM 只读区。 |
| controlType | 源输入数量按当前录入单位自身 `precision` 限制；目标消耗数量按目标消耗单位自身 `precision` 限制；旁显“将按 {单位} 保留 {precision} 位小数”；历史行显示自己的单位名称/编码/精度快照。 |
| validationAndError | 正数/允许的零值遵循既有动作语义；非法数、非有限数或换算不合法显示字段错误；源输入和目标消耗均超出各自 precision 时向零截断，不四舍五入，提交 readback 必须显示目标精度截断后的数值。`precision=0` 时提示“只能填写整数”。 |
| accessibilityAndTestId | 截断反馈使用文本，非只颜色/浮层；`quantity-precision-hint`、`ledger-unit-snapshot-{entryRef}`。 |
| emptyLoadingErrorStates | 无流水显示既有空态；快照缺失是 owner 数据完整性错误，不回退从当前单位定义重算。 |
| containerBehaviorUnderLoad | 静态形态随既有库存 Detail/Action Drawer：Drawer body 是唯一纵滚；账本行长名称截断并可查看；表头、底部提交区不出视口。 |
| stateAndPermission | **[backend-acceptance]** 0.3567kg 转为目标 g precision=0 时，target/ledger readback 数值为356且单位快照仍为g；任何357或从当前定义重解释旧行均失败。源输入先按 kg precision 处理，转换结果再按 g precision 处理。 |
| navigationAndRefresh | **[focused]** 成功 action 刷新当前 target、ledger 与列表余额；失败保留输入。修改当前单位定义名称不会重新格式化历史快照。 |
| collectionShapeAndScale | Ledger 是既有 Page/Cursor collection；单位快照是每行 Detail value。到1000条流水遵循现有服务器分页，不能抽干后在前端重新换算。 |
| dataSourceAndCascade | inventory owner 在 command 内先按源单位 snapshot precision 截断，再转换并按目标消耗单位 snapshot precision 截断，持久 target/ledger/BOM snapshot；前端只提供同一向零截断语义的输入限制，不是精度真相。 |
| forbiddenUI | 禁止四舍五入、输入与计算两套规则、把目标 precision 错当源 precision、从最新 catalog unit definition 重解释历史、或把盘点单位写入余额。 |

## 3. 共用 IA 规则

1. `unitDimension` 是 owner/contract 值；用户文案固定为“单位类别”。`measureMode` 继续表示计量方式，不能出现在单位候选或余额单位位置。
2. 单位库及候选的完整限定值逐字一致：**“典型十几个、最多几十个；上限固定为99，owner 读取第100条即拒绝，前端不分页、不无限加载、不静默截断。”**
3. 所有可变 Drawer/Modal 复用 `useDrawerFormLifecycle`：脏草稿关闭确认、提交期关闭锁、成功后 `afterOpenChange(false)` reset/rekey；不得出现多种 `maskClosable` 策略。
4. 通用 refresh 逐字一致：**“成功 mutation 发布 `operationsContentTabRefreshSignal`；订阅者只重读自己拥有的当前视图，dirty 商品草稿不自动覆盖。”**
5. 价格以分存储、以元展示/输入；用户填写“加价”时显示 `¥` 和“元”，前端转换但 owner 金额精度规则仍为真相。

## 4. Typed problem → 用户可见处理

| typed problem（设计冻结名） | 用户可见处理 |
| --- | --- |
| `CATALOG_UNIT_LIMIT_EXCEEDED` | “计量单位数量超过可维护范围，请先整理单位库” |
| `CATALOG_UNIT_CODE_DUPLICATE` | “该单位编码已被使用，请更换编码。” |
| `CATALOG_UNIT_IN_USE`（删除） | “该计量单位正在使用，不能删除。” |
| `CATALOG_UNIT_IN_USE`（定义修改） | “该单位已被使用；如需改变此项，请新建计量单位后在后续配置中选择” |
| `CATALOG_UNIT_DISABLED` | “该计量单位已停用，不能再次选择。” |
| `CATALOG_EFFECTIVE_SALES_UNIT_REQUIRED` | “请为可销售商品设置销售单位。” |
| `CATALOG_EFFECTIVE_BASE_UNIT_REQUIRED` | “库存或配方需要基础计量单位。” |
| `INVENTORY_COUNTING_UNIT_DIMENSION_MISMATCH` | “盘点单位与库存消耗单位类别不一致。” |
| `INVENTORY_CONVERSION_FACTOR_INVALID` | “换算值必须是正数且为有限小数或分数。” |
| `INVENTORY_UNIT_SNAPSHOT_MISMATCH` | “库存消耗单位由商品资料确定，不能在此处修改。” |
| `CATALOG_COPY_UNIT_CONFLICT` | “目标范围存在同编码但含义不同的计量单位，无法复制。” |

## 5. 交叉对账与完成判定

| 对账面 | 结果 |
| --- | --- |
| Journey → 交互 → IA | 单值销售/基础单位、被引用后的生命周期、Bounded<100、停用仅影响后续候选、operations-admin 唯一入口一致。 |
| IA → implementation design | 截断规则、单位快照、集合形态、授权点、刷新、错误与日志字段必须逐字一致；详设尚为整体审阅草案。 |
| IA → 不适用反例 | 商品标签仍多选；SKU销售属性、点单选项、套餐的现有语义不被单位单值化误伤。 |

**完成判定**：九个 IA-ID 已覆盖用户可见和不可见维度；但 `DEXTER_WIREFRAME_REVIEW=UNSET`，所以本文件仅可供整体设计审阅，不能成为实现准入。

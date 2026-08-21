---
title: 商品库存与 BOM 配置交互工件
status: DEXTER_WIREFRAME_ACCEPTED
createdAt: 2026-08-22
journeyId: J-CIB-001
consumerFace: operations-admin
implementationAuthority: false
---

# 交互工件：J-CIB-001 按商品结构配置库存扣减方式

<a id="catalog-inventory-bom-configuration-interaction"></a>

## 1. 工件元数据

```text
JOURNEY_DECISION=doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md#catalog-inventory-bom-configuration-journey
BUSINESS_REQUIREMENT_SOURCE=doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md#catalog-inventory-bom-formal-requirements
BUSINESS_PROBLEM=用户在当前扁平卡片中无法分清正在配置哪个商品结构对象、直接扣谁、BOM 又扣哪些耗用品
BUSINESS_USER_OR_OWNER=总部或门店商品资料维护者；门店库存配置维护者
CURRENT_TASK=在商品 Drawer 内按商品结构为当前商品、SKU 或点单选项值选择唯一库存扣减方式
SUCCESS_OUTCOME=用户能识别当前配置对象、合法方式、必要字段与切换后果；整体保存后按 owner readback 回显且非法组合被拒绝
UI_BEARING=true
SKILL_USED=cs-spec-to-plan@3f223891a0d93ce08a8c84829822d220399e0cdcb46153edac6d4b101613e6b4
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-08-22
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=operations-admin
```

### Screen: CIB-01 商品 Drawer 宿主

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=Drawer
HOST_AND_ENTRY=/operations/{groupWorkspaceKey}/catalog/store-items 或 /catalog/brand-items；从商品工作台新建商品或打开商品详情/编辑进入
ACTOR=总部或门店商品资料维护者
BUSINESS_SCENARIO=用户正在维护一个商品，并需要在同一次商品编辑中完成库存扣减方式配置
BUSINESS_GOAL=在不离开商品上下文的前提下进入库存与 BOM 配置，并以一次整体保存提交商品与库存配置
USER_VISIBLE_COPY=Drawer 标题“商品名称（编码）”；Tab“库存与 BOM”；底部“取消”“保存”；未保存关闭确认“当前填写内容尚未保存”
TECHNICAL_BOUNDARY=Drawer 只拥有整体编辑会话、dirty/submitting/close 与一次 whole-save；shape/owner/mode/权限/版本合法性由服务端 owner 最终复核
FOUNDATION_PRIMITIVE=adminWideDrawerSurfaceProps,useDrawerFormLifecycle,useOverlayLock,testId
CONTAINER_LAYOUT=宽度使用 adminWideDrawerSurfaceProps=min(1024px,calc(100vw - 48px))；Header/Tab 头/Footer 不得横向溢出；Drawer body 是唯一纵向滚动容器，Footer 固定；Tab 内容不再创建第二个纵向滚动祖先
```

### Screen: CIB-02 库存与 BOM 内容 Tab

```text
CONSUMER_FACE=operations-admin
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=CIB-01 商品 Drawer 内；仅 contract 对当前 shape 声明 inventory/BOM 可配置时出现
ACTOR=总部或门店商品资料维护者；门店库存配置维护者
BUSINESS_SCENARIO=用户需要判断当前商品结构中的哪一个对象在销售/使用时产生库存影响，并完成该对象的唯一方式配置
BUSINESS_GOAL=先定位当前商品、SKU 或点单选项，再配置“不参与库存 / 直接扣当前商品或 SKU / 按 BOM 扣组件”及其必要明细
USER_VISIBLE_COPY=“这里配置商品销售或使用时的库存扣减方式；实际余额和流水请到门店库存管理查看。”；“当前配置对象”；“销售/使用时怎么扣库存”；“不参与库存”“直接扣当前商品或 SKU”“按 BOM 扣组件”；“物料耗用明细”“添加耗用项”；“耗用商品或原料”“增减”“每份用量”“计量单位”“移除”；“未配置基础计量单位，暂不能启用库存”；“请先为该原料启用库存管理”；“已有库存或历史依赖，不能自动切换扣减方式”
TECHNICAL_BOUNDARY=contract 派生 shape×node×mode；客户端不得提交任意 nodeType/ownerRef 关系；组件候选五条件、自引用、模式互斥、A-05 四维守卫、expectedVersion 与同事务 owner 写均由服务端复核
FOUNDATION_PRIMITIVE=useCursorCandidates,useAsyncGenerationGuard,testId
CONTAINER_LAYOUT=多节点时采用左 280px 结构区+右侧 minmax(0,1fr) 详情区，24px 间距；小于 920px 时改为上下布局；单节点时隐藏结构区并由“当前配置对象”摘要占位；不新增局部纵向滚动，内容随 CIB-01 Drawer body 滚动；方式按钮、表头和每行字段必须在内容宽度内换行/收缩，不产生横向滚动
```

## 2. Interaction map

| 顺序 | 前提 | route / 屏幕 | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 有商品页准入且当前范围完整 | 商品工作台 | 找到或新建要配置的商品 | 商品名称/编码入口、新建商品 | catalog item/detail | 打开 CIB-01 | 列表失败可重试；范围缺失先补上下文 |
| 2 | 商品 Drawer 已打开 | CIB-01 | 进入库存配置 | “库存与 BOM”Tab；不准入 shape 不显示该 Tab | manifest/contract + detail | 打开 CIB-02 | 无写权限保持只读；关闭进入统一 dirty guard |
| 3 | contract 已返回且商品草稿结构合法 | CIB-02 | 找到当前要配置的对象 | 单节点直接详情；多节点结构树；每项业务摘要 | 派生 owner tree、当前规则、禁用原因 | 选中可配置对象 | loading 保留骨架；结构不合法显示阻断原因，不造 fallback 节点 |
| 4 | 当前 owner 可配置 | CIB-02 | 选择唯一扣减方式 | 方式选项和当前配置摘要 | allowedModes/default/disabledReason | 展示对应字段 | 非法切换由 owner 拒绝并恢复最新 readback |
| 5A | 选择直接扣本品 | CIB-02 | 配置当前商品/SKU自己的库存 | 当前对象只读、消耗单位、阈值、负库存、可选盘点单位及换算 | StockTarget draft/readback | 回到 CIB-01 保存 | 缺基础单位阻断；不显示其他商品选择器 |
| 5B | 选择按 BOM 扣组件 | CIB-02 | 维护该 owner 的物料耗用 | 组件候选、正/负方向、每份用量、单位快照、添加/移除 | ProductBom draft + candidate task read | 回到 CIB-01 保存 | 无候选提示先启用原料库存；空 BOM 不可提交 |
| 5C | 选项值 owner | CIB-02 | 配置附加/替换耗用 | “不改变物料耗用 / 按 BOM 增减耗用”；正/负/实际用量 | option-value BOM readback | 回到 CIB-01 保存 | 不出现直接库存；篡改由 owner 拒绝 |
| 6 | 表单合法且有写能力 | CIB-01 | 一次保存商品与库存配置 | “保存”；提交锁 | catalog + inventory 同一事务 readback | Drawer 保持打开并显示最新 readback，或按既有成功路径关闭并刷新商品 | validation 留在当前字段；conflict/denied 展示 owner 文案并保留草稿；unknown 先读回再决定重试 |

## 3. v2 对应页面盘点

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线 / 摹本标注 | 差异及原因 |
| --- | --- | --- | --- | --- |
| CIB-01 | `PARTIAL_COUNTERPART` | all-v2 商品 Drawer：在 `../catering-all-v2/apps`、`packages`、`libraries` 对“库存与 BOM / InventoryBom / inventory-bom”静态检索无业务面命中；现有 Drawer 结构只作为通用宿主，不构成库存/BOM对应页 | 本工件线框的 Drawer 宿主摹自当前 v2s `CatalogItemDrawer.tsx`；v4 交互基线为 `../catering-server-v4/docs/design/2026-06-08-catalog-item-integrated-inventory-bom-redesign.md@cf80065a33e46a9488052ab956178d73c6a7cac3a84f48a0c0ec6385175dcca8` | 保留同 Drawer 一次保存和既有 tabs；只重做库存/BOM内容。原因：新裁决+质量修复 |
| CIB-02 | `NO_V2_COUNTERPART` | 同上，all-v2 静态检索范围内无对应库存/BOM工作台 | `doc/plans/platform/wireframes/2026-08-22-v2s-catalog-inventory-bom-configuration.svg`；结构摹自 v4 `CatalogItemInventoryBomWorkbench.tsx@45a488dac0c2bd559e29b5df9c36753298136186af841916ae8c9f541d568352`、`CatalogItemInventoryBomTree.tsx@0eee49263be1927e7f87537326821b5471d9a9a47eac955cb2205f49513649a1`、`CatalogItemInventoryBomDetail.tsx@ce08d7c170982b3bfe1ac632b0f037a2b70cf1b797d621f6652d7142d6bb933f` | 保留“结构树+当前详情”；删除 v4 销售单位作消耗单位、自由盘点单位、固定四位精度和 HAS_SKU 动态粒度。原因：新裁决+单位模型+质量修复 |

## 4. 低保真线框

### Screen: CIB-01 商品 Drawer 宿主

唯一视觉工件：`doc/plans/platform/wireframes/2026-08-22-v2s-catalog-inventory-bom-configuration.svg` 中“宿主与保存边界”区域。

### Screen: CIB-02 库存与 BOM 内容 Tab

唯一视觉工件：同一 SVG 中“单节点退化”“多节点结构树”和“选项耗用”三种状态。三种状态属于同一内容 Tab，不是三个独立 route/surface。

#### Surface ownership 自检

| screen id | 声明 UI_SURFACE | 线框可见元素分母 | 每项是否属于当前 surface | USER_VISIBLE_COPY 可见项是否全有位置 | 结论 |
| --- | --- | --- | --- | --- | --- |
| CIB-01 | Drawer | 商品标题、tabs、取消、保存、dirty 关闭确认说明 | 是；库存 Tab 内字段归 CIB-02 | 是 | PASS |
| CIB-02 | 内容 Tab | 顶部说明、当前配置对象、结构树、方式、直接库存字段、物料耗用表、添加/移除、阻断/空态 | 是；Drawer header/footer 不在本 screen 重画为内容元素 | 是 | PASS |

### 4.1 表单控件依赖图

| 用户可见控件 | 控件形态/搜索方式 | owner 候选或初始值来源 | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束 | loading/empty/failed | 提交时 owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 当前配置对象 | 单节点只读摘要；多节点 Tree 单选 | 商品草稿 + contract 派生树 + detail readback | contract 与商品结构已加载 | 切换对象只切换右侧草稿，不混排其他对象明细 | 目录只读；不可准入 shape 无节点 | loading 骨架；结构错误阻断；无 fallback | 重新派生 shape、node、ownerRef、归属 |
| 销售/使用时怎么扣库存 | Segmented/Radio 单选 | 当前 owner 的 allowedModes/readback | 选中可配置 owner 且有写能力 | 切换只更换本 owner 的草稿分支；旧 active 事实由保存事务按 A-05 处理 | 商品/SKU 三方式；选项值无直接库存；物料无 BOM | 不适用原因直接展示；失败恢复 latest readback | 方式矩阵、互斥、四维切换守卫 |
| 低库存阈值 | 数量输入 | StockTarget readback | 直接扣本品且基础计量单位完整 | 方式离开直接库存时不作为新方式 payload | 非负；按消耗单位 precision 向零截断 | 单位缺失时禁用并提示 | 目标单位、precision、非负 |
| 允许负库存 | Switch | StockTarget readback | 直接扣本品 | 无 | 当前 owner 独立配置 | 读失败不提供默认成功态 | owner 当前配置与权限 |
| 盘点单位 | allowClear searchable Select | 当前 scope 有效单位候选 | 直接扣本品；盘点单位可选 | 清除单位同时清除换算；换单位重置不兼容换算 | 同维度、启用候选；已有停用绑定仍可见 | loading/empty/failed 均可恢复；不退自由文本 | 单位状态、维度、precision、引用语义 |
| 盘点换算 | 十进制输入 | 用户输入 + 单位 readback | 已选盘点单位 | 清除盘点单位即清除 | 换算因子本身为正数、有限且不得由控件四舍五入；实际盘点/调整的源数量按源单位 precision，换算后的目标数量按消耗单位 precision 向零截断 | 无单位时不显示 | 换算因子合法性，以及实际输入时的源/目标 precision |
| 添加耗用项 | Button | 当前 BOM 草稿 | 当前 owner 选择 BOM | 新行仅属于当前 owner | active BOM 至少一条；不得重复同一业务行 | 无候选时不添加并显示引导 | owner、候选资格、空 BOM、重复/自引用 |
| 耗用商品或原料 | searchable Select，连续加载候选 | inventory owner 组件候选 task read；implementation design 必须冻结 operationId/response field | 当前 owner 选择 BOM | 上游 owner/scope 变化清空并取消旧请求 | 同 scope、可用、BOM_COMPONENT、已有 StockTarget、单位完整、非自引用 | loading、无候选、失败+重试；不使用已加载列表本地凑选项 | 五条件、自引用、当前状态与单位 |
| 增减 | Select | contract 固定词表 POSITIVE/NEGATIVE 的业务映射 | 已选耗用对象 | 无 | 商品/SKU BOM 默认正向；选项值允许正/负；实际用量规则沿用现有 owner 语义 | 不适用项不显示 | lineSign 与 owner 类型 |
| 每份用量 | 原始文本十进制 Input | 用户输入，单位来自组件 StockTarget 快照 | 已选耗用对象 | 换组件后清除数量 | 按组件消耗单位 precision 向零截断；不得由前端四舍五入 | 单位加载中禁提交；错误定位当前行 | 数量、precision、单位快照、实际用量规则 |

### 4.2 FORM_MUTATION_DENOMINATOR

`FORM_MUTATION_DENOMINATOR=ITEM_NONE,ITEM_DIRECT,ITEM_BOM,SKU_NONE,SKU_DIRECT,SKU_BOM,OPTION_NONE,OPTION_BOM,MATERIAL_NONE,MATERIAL_DIRECT`。套餐、服务、权益壳无 mutation variant；篡改属于拒绝场景。

| 业务字段或 command 事实 | 用户可见文案/控件 | 分类 | 原始业务来源 | request 取值与唯一来源 | 变更、级联与校验 | command owner 最终复核 | 冲突/失败恢复 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| shape 与 owner 粒度 | 当前配置对象/结构树 | `FIXED_READONLY` | 正式需求 A-01 | latest catalog draft/readback + contract | shape 变化时整棵树重新派生，非法旧草稿进入阻断态 | catalog owner 重派生 | 保留草稿并定位冲突，不猜测转换 |
| owner node identity | 当前配置对象 | `HIDDEN_OWNER_FACT` | 正式需求 §4/§5 | 由商品结构与服务端 readback 产生，非用户输入 | 节点删除时对应新草稿移除；历史事实按治理规则 | catalog owner 归属 + inventory owner 引用 | 任意 ref/nodeType 篡改被拒 |
| mode | 销售/使用时怎么扣库存 | `EDITABLE` | A-01/A-02/A-05 | 用户选择 contract 准入值 | 切换受四维守卫；同 owner 一值 | shape×node×mode、互斥、生命周期 | typed problem + latest readback |
| StockTarget 配置 | 阈值/负库存/盘点单位/换算 | `CONDITIONAL_EDITABLE` | 正式需求 §7.3/§9 | 用户输入 + 单位候选 + current readback | 仅 DIRECT；单位级联清理 | inventory owner 校验单位、precision、版本 | 字段级错误；unknown 后读回 |
| BOM 行集合 | 物料耗用明细 | `CONDITIONAL_EDITABLE` | 正式需求 §7.3/§8 | 用户行操作 + owner 候选 | 仅 BOM；至少一行；当前 owner 隔离 | 候选五条件、非自引用、单位、数量、版本 | 当前行错误；整单不部分写 |
| expected catalog/inventory versions | 不显示 | `HIDDEN_OWNER_FACT` | owner CAS 既有机制 | latest detail/readback | refresh/readback 后更新，不由浏览器发明 | catalog/inventory 各自 CAS | conflict 保留草稿并提供重新加载 |
| 权限 grant、scope、brand | 不显示；只显示业务范围上下文 | `HIDDEN_OWNER_FACT` | G-05A | session + server-minted grant + current scope | scope 变化关闭或重载 Drawer | owner 在写前复核 | denied 不伪装 validation |
| 历史依赖计数 | 切换拒绝文案 | `HIDDEN_OWNER_FACT` | A-05 | inventory owner 锁定查询；只数命令开始前已有的 DISABLED StockTarget/ProductBom definition | 不由 UI 预估或缓存 | 余额/流水/引用/历史定义四维；当前命令新停用行不计入本次 | typed problem 的 `blockingFacts=HISTORICAL_DEFINITION`，不补偿 |

### 4.3 SEARCH_CAPABILITY_DENOMINATOR

`CIB-01=NOT_APPLICABLE_WITH_REASON`：Drawer 宿主不新增搜索任务；商品定位由宿主工作台既有 Journey 负责。

`CIB-02=APPLICABLE`：盘点单位与 BOM 耗用对象是两个独立候选控件。

| screen / 业务对象 / 用户问题 | 条件的用户可见文案 | 匹配语义与控件形态 | 值或候选的唯一来源 | 上游级联、清理与重载 | 请求/提交 owner 核验 | 适合性与排除的替代方案 | contract 缺口或不适用处置 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CIB-02/计量单位/选择盘点录入单位 | 盘点单位 | 按名称/编码搜索的 Select；集合上限 99 | catalog unit owner 当前 scope 候选 read | scope/当前 owner 改变取消旧请求并清空不成立值；已有停用绑定单独 readback | 保存时复核单位状态、维度和 precision | 不是自由文本；不需要表格分页 | 复用现有单位候选 contract，implementation design 绑定 operationId |
| CIB-02/库存对象/选择本次耗用的商品或原料 | 耗用商品或原料 | searchable Select；连续加载 | inventory owner 组件候选 task read | owner/scope/brand 改变即取消、清空、重取 | query 与 command 均复核 scope、状态、能力、StockTarget、单位、自引用 | 业务对象会增长且可能重名，不能本地枚举或自由文本 | `GAP_TECHNICAL_CONTRACT`：当前扁平 `bomTarget` picker 不是目标 typed candidate；implementation-facing design 必须新增/重塑 owner task read 并冻结 operationId，不是产品未决 |

候选统一协议在实施设计中复用 `useCursorCandidates`；`subjectType=INVENTORY_BOM_COMPONENT` 仅作为待设计技术枚举候选，本文不把它写成已存在 contract。

## 5. 状态与边界表

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face 边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CIB-01 打开/关闭 | Drawer 骨架；detail 未完成不 hydrate 伪默认 | 关闭 dirty 时统一确认 | 提交中遮罩/Esc/重复提交锁定 | 最新 readback 后清 dirty | denied 只读；version conflict 保留草稿 | unknown 先读 detail；不能直接重发 | operations-admin shell + whole-save coordinator |
| CIB-02 派生结构 | contract/detail/candidates 分层 loading | 非法 shape/结构直接阻断 | 随宿主提交锁 | 树与摘要来自 readback | 篡改节点由 owner 拒绝 | contract/detail 未知可重试，不显示 fallback | catalog 解释结构；inventory 解释规则 |
| 选择/切换方式 | 先显示 current readback | 缺单位、空 BOM、非法 mode 定位当前对象 | 保存期间不可改 | 唯一 active 方式 readback | A-05 四维任一成立时 typed 拒绝 | unknown 后重读，比较 version 与 mode | owner 同事务锁定并终判 |
| 组件候选/行 | 候选可独立 loading | 五条件、自引用、数量/precision | 提交期间行锁定 | BOM 行带单位快照 readback | 失效候选明确拒绝 | 候选失败可重试，不丢当前草稿 | inventory owner task read + command |

## 6. 逐操作任务合理性

| 操作 | 批准 Journey 来源 | 用户为何此时操作 | 是否有更短路径 | 不选替代的理由 | 约束归因 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- | --- | --- |
| 打开“库存与 BOM”Tab | Journey §2 | 正在维护当前商品的库存语义 | 无；独立库存规则页更长 | 同 Drawer 保持商品上下文和一次保存 | 产品 | 否 |
| 选择结构树对象 | Journey §2.1/2.3 | 多 owner 时先确认正在配谁 | 单节点有：隐藏树直接详情 | 多节点不能用平铺卡片；单节点已采用更短路径 | 产品/IA | 否 |
| 选择扣减方式 | A-01/A-02 | 明确一次销售/使用如何影响库存 | 无 | 同时 active 会产生未裁的双扣 | 产品/contract | 否 |
| 配置当前商品/SKU库存 | Journey §2.2 | 直接扣本品需要阈值、负库存和盘点录入 | 无需选择其他商品 | 目标就是当前 owner | 产品/owner | 否 |
| 添加/移除耗用项 | Journey §2.2 | BOM 需要维护当前 owner 的多条耗用 | 顶层“新增 BOM 组件”更差 | 行必须归属于当前 owner | 产品/owner | 否 |
| 搜索并选择耗用商品或原料 | Journey §3 组件候选 | 从真实可库存对象中找到耗用品 | 自由文本/本地列表不合法 | 必须由 inventory owner 返回合法候选 | owner/contract | 否 |
| 切换方式 | A-05 | 配置尚未产生历史时纠正策略 | 无 | 有历史时自动切换会重解释事实 | 产品/owner | 否 |
| 保存 | Journey §2.4 | 一次提交当前商品整体草稿 | 前端串两次请求更差 | 必须同一事务整体成败 | owner/transaction | 否 |
| 取消/关闭 | Journey §2 失败后事实 | 放弃未保存修改 | 无 | 统一 dirty guard 防丢失 | foundation | 否 |
| 重试候选/重载冲突 | Journey §2/§5 | 从暂时失败恢复 | 整页刷新会丢草稿 | 局部恢复且 owner readback 可核对 | owner/foundation | 否 |

## 7. Face / owner 对齐矩阵

| 屏幕/动作 | consumer face | 页面准入 | server operation | owner readback / command | 不可由前端替代的判定 |
| --- | --- | --- | --- | --- | --- |
| CIB-01 打开/保存 | operations-admin | 既有商品页准入；写 capability 按 store/head-company scope 分开 | 既有 item detail + whole-save；目标 operation exact-set 待 implementation design 冻结 | catalog initiating command + inventory coordinated command，同一 REQUIRED | 实时 grant、CAS、事务整体性 |
| CIB-02 结构/方式 | operations-admin | 随 CIB-01 | 目标 typed manifest/detail 与 save payload 待详设 | catalog shape/结构 readback；inventory mode/readback | shape×node×mode、owner 归属、互斥 |
| CIB-02 组件候选 | operations-admin | 随 CIB-01 | `GAP_TECHNICAL_CONTRACT`，待详设冻结 operationId | inventory owner component candidate task read | scope、状态、能力、StockTarget、单位、自引用 |
| CIB-02 切换方式 | operations-admin | 写 capability | whole-save 内 inventory command | inventory owner 锁定余额/流水/引用/快照 | A-05 四维守卫及优先级 |

## 8. Manifest B.4/B.5 命中对照

| manifest 条文 | 本 Journey 的命中或不适用理由 | 遵循方式 / 待 Dexter 裁决 | Heritage 原文 |
| --- | --- | --- | --- |
| B.4 管理后台状态与共享 foundation | Drawer 生命周期、候选 generation、自动化定位和 generated HTTP 必须复用已有能力 | interaction 已逐 screen 声明；exact imports 待详设绑定 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/frontend-runtime-and-admin-architecture-standard.md`（实施详设前复核 registry/hash） |
| B.5 商品内嵌库存/BOM交互 | all-v2 无对应库存/BOM screen；v4 有已验证左树右详情心智 | 只继承静态交互基线；新 contract/单位/shape 裁决优先 | v4 path@hash 见 §3；不作 runtime/build fallback |

## 9. 高保真静态 demo

`NOT_APPLICABLE_WITH_REASON`：这是既有 Drawer 中的信息层级与表单重组，低保真线框足以让 Dexter 判断树/详情、单节点退化和字段归属；不需要高保真视觉稿替代业务确认。

## 10. Dexter 看图结论

- 看图日期：`2026-08-22`
- 低保真线框结论：`ACCEPTED`
- 高保真 demo 结论：`NOT_REQUIRED`
- 修改意见/已接受的操作顺序：`无修改；接受普通/称重商品单节点直接详情、按 SKU 商品左树右详情且根只读、点单选项值仅配置物料耗用而不拥有库存对象`
- 允许进入 IA 与 implementation-facing design：`是；仅允许设计工件，不构成实施授权`

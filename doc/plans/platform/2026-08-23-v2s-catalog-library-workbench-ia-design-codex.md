---
title: 商品库唯一工作区 IA 详设
status: READY_FOR_DEXTER_CLAUDE_DESIGN_REVIEW
date: 2026-08-23
---

# 商品库唯一工作区 IA 详设

## 1. 元数据

```text
IA_SCOPE=IA-CATUI-01..IA-CATUI-08
BUSINESS_SOURCE=doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md
JOURNEY_REFS=doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md#J-CATUI-01..J-CATUI-08
UI_INTERACTION_REF=doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED_FOR_IA_DETAIL_COMPLETION@2026-08-23
IMPLEMENTATION_AUTHORITY=false
CONSUMER_FACE=operations-admin
SURFACE_DENOMINATOR=47
STATE_RESIDENCE_DENOMINATOR=3
WORKSPACE_TASK_VARIANTS=8
CATALOG_PROBLEM_CODE_DENOMINATOR=46
```

本工件只细化已经确认的交互，不改变以下冻结结论：目录树总体方式不变；顶部工具区与结果域筛选区不变；
父商品与规格使用同一张树形表；查看与编辑是两个组件；第一层 Drawer 同层互斥；商品分类一律使用单选
树形选择器；关于商品的任务都从唯一商品库工作台发起。2026-08-24 最终裁定新增：目录树扩展“生产标签”
一级节点；生产标签是商品级 0..1，规格与点单选项不得覆盖；本期不实现生产路由；表格十个业务列全部常显。

## 2. 状态模型：三个住址，每项状态一个唯一控制者

### 2.1 状态唯一住址总表

| 状态层 | 唯一住址 | 控制者 | 谁可以改变 | 消费者 | 持久化与失效 | 禁止形态 |
| --- | --- | --- | --- | --- | --- | --- |
| 服务端事实 | generated RTK query 的 `currentData` | 对应 query identity 与 catalog/inventory/asset/fulfillment-production owner | 只有 HTTP readback、精确 tag 失效或内容页统一刷新 | 工作台、View、Editor 的只读基线、配置库、候选、批量/复制/治理结果 | RTK cache；scope、brand、query args 或 tag 变化即换 identity | 禁止 `useState` 镜像 page/detail/tree/actionAvailability；退役 `acceptedPage`；禁止读取旧 `data` 冒充当前 identity |
| 整单业务草稿 | App 内唯一 `useCatalogItemDraft` store | `CatalogItemDraftController` | 区段 Editor、子任务“应用”、恢复/放弃、保存 readback | 九类 Editor、左侧 dirty/error 徽标、常驻保存栏 | 仅非秘密、可重放值进入 `sessionStorage`；以 scope+brand+itemCode+baselineVersion 为键 | 禁止各区段各存一份同义 draft；禁止 View 消费 draft；禁止 RTK refetch 覆盖 dirty 值 |
| 界面瞬态 | 最近拥有该交互的组件或专用 hook | 工作台 task reducer、Drawer/Modal lifecycle、picker/list hook | 用户交互与明确的状态迁移 | 当前控件与焦点/横纵滚动/展开/选中表现 | 默认不跨关闭持久化；只按本工件明确规则保留；十个业务列无显隐偏好 | 禁止把权限、准入、版本、候选资格放本地；禁止多个 `open` 布尔组合出 surface；禁止数组 index 作为业务身份；禁止列显隐 state |

`admin-ui-foundation` 只拥有机械生命周期，不拥有 catalog 业务草稿或 owner 事实：

- `useDrawerFormLifecycle`：`dirty`、`submitting`、关闭三径、脏确认、成功关闭、`closedSessionKey`、可选幂等键；
- `useSubmissionLifecycle`：非 Drawer 单次业务意图的幂等键与 reset；
- `useCursorCandidates`：搜索候选的输入防抖、累计投影、cursor 与加载更多；每一页事实仍住 RTK `currentData`；
- `useCursorStack` / query identity：父商品分页和规格子页 cursor；
- `OverlayLockProvider` / `useOverlayLock` / `useDirtyFormLock`：锁定 Shell 与脏数据离开；
- generated RTK tags：精确失效。若某 query 已走 tags，不得再为同一事实叠加 `dictionaryRevision`、全局
  refresh counter 或手工镜像。

### 2.2 工作区 surface 状态机

工作台只能维护一个判别联合，而不是 `createOpen/copyOpen/dictionaryOpen/detailOpen/...` 多个布尔值：

```ts
type CatalogWorkspaceTask =
  | { kind: 'NONE' }
  | { kind: 'VIEW'; itemCode: string; focus?: CatalogViewFocus; triggerTestId: string }
  | { kind: 'EDIT'; itemCode: string; baselineVersion: number; resume?: CatalogEditResume }
  | { kind: 'CONFIG'; library: CatalogLibraryKind; returnTo?: CatalogEditResume }
  | { kind: 'COPY'; flow: 'BRAND_TO_STORE' | 'LOCAL_SETTINGS'; targetItemCode?: string }
  | { kind: 'CREATE_ITEM'; prefill?: CatalogCreatePrefill }
  | { kind: 'CATEGORY_ATOM'; action: CatalogCategoryAction; categoryRef?: string }
  | { kind: 'BATCH'; action: CatalogBatchAction; selectedItemCodes: string[] };
```

规则：

1. `CatalogWorkspaceTask` 是第一层任务唯一住址；从任一非 `NONE` 迁移到另一非 `NONE` 必须先完成当前
   surface 的关闭协议，禁止两个第一层 Drawer 或一个 Drawer 与工作台直接 Modal 并存。
2. `VIEW` 与 `EDIT` 是不同组件，不是同一个组件的 `readOnly` 分支。
3. `EDIT` 内可有一个 `CatalogEditorChildTask`：`SKU_ROW / BOM_COMPONENT / COMPOSITE_COMPONENT /
   OPTION_MATERIAL / ASSET_PREVIEW / NONE`。子任务使用稳定业务身份或稳定本地 `editorId`；“应用”只写
   父草稿，取消丢弃子任务 working copy，不发 whole-save。
4. `VIEW` 内可有一个 `CatalogViewChildTask`：图片预览、生命周期确认、临时商品治理。第三层只能是 confirm。
5. `CONFIG` 内只有 `CatalogConfigAtom` 小 Modal 或 confirm；复杂定义详情必须在右栏同栏切换，禁止再开 Drawer。
6. 每个任务记录打开控件 `triggerTestId`；正常关闭、取消、已知失败后的关闭均把焦点归还该控件。接力任务
   （创建成功进入编辑、编辑绕行配置）将焦点交给新 surface 的标题或恢复字段，而不是归还旧入口。

### 2.3 整单草稿状态

```ts
type CatalogItemDraftSession = {
  key: {
    scopeRef: string;
    dataNodeRef: string;
    brandRef: string;
    itemCode: string;
    baselineVersion: number;
  };
  values: CatalogItemDraftSections;
  dirtySections: CatalogSectionKey[];
  fieldErrors: Record<CatalogFieldPath, string>;
  sectionErrors: Partial<Record<CatalogSectionKey, string>>;
  activeSection: CatalogSectionKey;
  scrollAnchor?: { section: CatalogSectionKey; fieldPath?: CatalogFieldPath; offset: number };
  recovery: 'CLEAN' | 'RECOVERABLE' | 'STALE_SERVER_VERSION';
};
```

- 九类事实族各自拥有 typed slice，但只能由 `useCatalogItemDraft` 统一装配、持久化、dirty/error 定位和提交。
- 首次进入编辑时，以相同 query identity 的最新 detail readback hydrate 一次；dirty 后的 refetch 只能刷新
  `serverBaseline`、候选和动作事实，不能改 `values`。
- 刷新或意外关闭后，同一商品同一版本可“恢复草稿 / 放弃草稿”。服务端版本已变化时标
  `STALE_SERVER_VERSION`，保留草稿但禁止静默合并和直接保存；用户选择“查看最新内容”或“放弃草稿后重开”。
  本批不发明自动 merge。
- `sessionStorage` 不保存候选页、actionAvailability、raw problem、临时访问地址、上传授权、对象存储签名、
  staged asset grant 或任何认证信息。未保存集合行使用 `crypto.randomUUID()` 生成持久化 `editorId`；已保存行
  使用 owner ref/code。数组 index 只可算显示顺序，不能用于 Modal 回写、异步上传归属、测试定位或错误路径。
- 保存已知成功后用权威 readback 替换 RTK 当前 detail、清除该 key 草稿并关闭；已知拒绝保留草稿并定位错误；
  `RESULT_UNKNOWN` 或 transport outcome unknown 时保留草稿，按同一幂等意图精确读回目标，不伪造成功或失败。

### 2.4 配置抽屉状态

`useCatalogConfigLibrary` 是以下 state 的唯一业务 hook：

```text
currentLibrary
libraryQueryIdentity
librarySearchDraft / appliedLibrarySearch
selectedParentDefinitionRef
selectedDefinitionRef
definitionMode = LIST | CREATE | EDIT
definitionDraft
fieldErrors / problem
candidateState（只在复杂定义当前字段需要时存在）
returnToEdit（只读接力令牌，不持有商品草稿）
```

左侧切库、scope/brand 变化或关闭配置抽屉时，必须经当前 definition draft 的 dirty guard。配置抽屉不读取、
不写入商品整单草稿；保存配置只失效对应库、对应候选和真实受影响的商品读模型。返回编辑时由工作台的
`returnToEdit` 接力，`useCatalogItemDraft` 自己恢复原草稿。

### 2.5 控件控制权与规则来源

任何组件 props、hook state 或 reducer field 只能承担下表一个角色；“前端也写一份方便展示”不构成第二住址：

| 控制对象 | contract 声明 | generated RTK / App 控制 | foundation 控制 | owner 最终复核 | 禁止前端重建 |
| --- | --- | --- | --- | --- | --- |
| 区段/字段是否适用 | shape manifest 的 section/field admission、可改性与原因 | 只按声明裁剪 View/Editor；锁定事实用文本 | 无 | whole-save 拒绝不适用/锁定字段篡改 | 按商品类型 switch 复制 admission |
| 必填、格式、闭集、数量边界 | request schema、descriptor、problem field path | 表单即时提示与错误定位；值住 create/draft | 表单生命周期，不拥有规则 | 同规则再次校验 | 把推荐值伪装必填；独立正则/上限 |
| 动作入口 | `actionAvailability(action, available, reason)` | 决定显示的动作和业务原因 | overlay/confirm 生命周期 | command 内重读权限、状态、引用和版本 | 从 status/capability 字面量拼动作矩阵 |
| 分类/关联候选 | identity、path、displayOrder、selectable、disabledReason、cursor/total | query `currentData` + TreeSelect/候选 hook 瞬态；选择值住表单/draft | 防抖/cursor/加载更多 | create/save/move 再验资格 | 从 navigation/detail 本地算叶子、后代、可选性 |
| 父商品/规格表 | parent page 与 parent-scoped SKU page、total/cursor/summary | 直接渲染 `currentData`；展开/滚动/选择住列表局部 state | cursor/query identity | read task 校验范围和父子关系 | `acceptedPage`、detail N+1、SKU 进入父分母 |
| 商品/规格标准价 | catalog schema 明确 `nullable`；readback 保留 null | 有值按金额展示/编辑，无值只显示中性“未设置”；草稿允许 null | Form 生命周期与金额输入，不拥有必填语义 | catalog owner 接受合法 null 并校验有值时的金额格式；菜单/销售集合 owner 在菜单项写入时另行复核必须有价 | `missingPriceCount`、红色缺价风险、商品启用阻断，或把菜单定价准入复制到商品库 |
| 整单编辑 | detail readback、baseline version、typed save/problem | `useCatalogItemDraft` 唯一草稿；section/dirty/error/focus | dirty close、submission/idempotency、overlay | 同事务 owner commands 与 readback | 分区保存、RTK 草稿镜像、自动 merge |
| 配置库 | list/detail/action/引用/版本与候选 | `useCatalogConfigLibrary` + 当前 definition draft | Drawer/Modal lifecycle、candidate mechanics | 各库 owner | `dictionaryRevision` 粗刷新、六库同义 state |
| 批量/复制/治理 | batch 上界/逐项 receipt、preflight token/结果、promotion gaps | task reducer 展示阶段并保存用户输入；不改写 receipt | submission/close/overlay | 每项/execute 重验 | 把逐项尽力伪装原子；本地重算 closure/token |
| 错误与恢复 | typed code、field path、readback outcome | 映射 IA §6 逐字业务 copy、保留或清理规定 state | 生命周期和 safe logger | 失败保证事实不变/未知可读回 | 按 HTTP 猜业务原因、展示 raw detail |

诊断信息不是第四个 state 住址。日志只能观察 task、request 与 owner 阶段，不能驱动按钮可用性、草稿值、
候选资格或“是否成功”。当前实现的 `acceptedPage` 与分类本地 `treeData/disabled` 解析是已知 gap：前者必须删除，
后者只能保留纯展示，直到独立 category candidate task read 的 `path/selectable/disabledReason` 全链闭合；不得以
现有实现尚未具备为由改回设计。

## 3. 控件级联与状态控制矩阵

### 3.1 工作台、目录树、结果表

| 控件/事件 | 直接 state 与控制者 | 上游 | 必须级联 | 明确不级联 | 服务端消费/复核 |
| --- | --- | --- | --- | --- | --- |
| 树表视图/仅表格 | `viewMode`，工作台本地 | 无 | 切到仅表格隐藏目录树；结果 query identity 不变 | 不清筛选、分页、选择、展开 | 无写入 |
| 品牌选择（仅存在多品牌入口时） | `catalogIdentity.brandRef`，工作台 context controller | scope/session | 关闭当前 task；树回全部商品；清树搜索、筛选、cursor、父行选择、规格展开与子页 state；重新取 context/navigation/manifest/list | 不保留旧品牌任何 Drawer 或 Modal | 所有 scoped read 按新 brandRef；不得混用旧 `currentData` |
| 目录树搜索 | `treeSearchDraft`，目录树本地 | navigation `currentData` | 只改变过滤与展开的树节点；搜索命中子节点保留祖先 | 不改变当前结果域、不请求商品列表、不清父行选择 | 无写入 |
| 选择智能视图/标签/分类 | `appliedTreeSelection`，工作台本地 | 当前 navigation | parent cursor 回首页；清父行选择、规格展开、规格子页错误/加载更多；重取父列表 | 保留关键词、状态、来源筛选 | list task read 最终解释选择语义 |
| 结果域关键词输入 | `keywordDraft`，筛选区本地 | 当前结果域 | 仅回车/搜索按钮把值提交到 `appliedFilters.keyword`；随后回首页并清选择/展开 | 输入过程不发请求 | list owner 按关键词解释 |
| 状态/来源筛选 | `appliedFilters`，筛选区本地 | manifest 的有限候选 | 回首页；清父行选择、规格展开、子页 state | 不改变树选择 | list owner 复核闭集 |
| 跨分类路径 | 无独立 mirror；直接消费父列表 `currentData.items[].categoryPathLabels` | `appliedTreeSelection.kind` 只决定是否展示 | 智能视图、标签、全部商品等跨分类结果域显示；单一分类结果域隐藏冗余副信息 | 不从 navigation 可见子树拼路径，不缓存第二份名称 | list owner 输出 scope 内完整业务路径 |
| 重置 | `keywordDraft/appliedFilters` | 当前结果域 | 清关键词、状态、来源并回首页；清选择/展开 | 不改变品牌、树节点、树搜索和顶部工具区 | 重取当前结果域第一页 |
| 父表分页 | `useCursorStack` | 当前 list query identity | 清当前页父行选择和规格展开；只展示新 `currentData` | 不改筛选/树 | total/hasNext/cursor 全取 owner |
| 父商品展开 | `expandedItemCodes` + `skuPageByItemCode`，列表本地/子 query | 父行 `hasSkuChildren` | 第一次展开才按 itemCode 请求规格摘要；加载/失败/加载更多各占一条规格子行；收起只隐藏 | 不改变父列表 total、分页、排序；不把 SKU 加入选择分母 | 轻量 SKU task read；GAP 未闭合前不得用全详情 N+1 fallback |
| 父商品收起 | `expandedItemCodes` | 当前父行 | 隐藏子行；同 query identity 内 RTK 页可缓存 | 不移动父行、不清其它父行展开 | 无写入 |
| 父行复选 | `selectedParentItems`，列表本地 | 当前 list query identity/version | 选择集合变化更新批量入口摘要 | 不允许 SKU 行进入；子行只留对齐占位 | 提交时每项 owner 重新复核版本 |
| 点击父商品名 | `workspaceTask=VIEW` | itemCode | 打开 View；记录触发 testId | 保留树、筛选、分页、选择、有效展开 | detail query |
| 点击规格名 | `workspaceTask=VIEW` + focus | parent itemCode + skuCode | 打开父商品 View 并定位规格与价格/对应规格 | 不创建第五种 Drawer | detail query |
| 内容页统一刷新 | Shell refresh signal + generated tags | 当前 scope | 重取工作台 context/navigation/manifest/list 和已打开只读 View；保留有效界面瞬态 | 不覆盖 dirty Editor，不重置筛选/分页/展开 | 各 read 的当前 query identity |

### 3.2 分类树形选择器

| 场景 | 直接 state | 候选上游 | 级联与清理 | 选择资格 | owner 复核 |
| --- | --- | --- | --- | --- | --- |
| 新建商品分类 | create form `categoryRef` | 当前 scope+brand、`usage=ITEM_ASSIGNMENT` 的 category hierarchy task read | scope/brand 变化清空；搜索只改变树展示；选择分类不清名称、编码、shape | contract 的 `selectable/disabledReason`；显示完整路径 | create command 再验 scope、分类、shape、版本 |
| 编辑商品分类 | Basic draft `categoryRef` | latest detail + `usage=ITEM_ASSIGNMENT` hierarchy read | 选择新分类只标 Basic dirty；不自动改标签、单位、价格或库存；候选失败保当前已绑定路径 | 既有停用绑定可见；新候选资格由 contract | whole-save 再验 scope、分类和版本 |
| 批量移动分类 | batch draft 单值 `targetCategoryRef` | `usage=ITEM_ASSIGNMENT` hierarchy read | 切换 batch action 清目标；改变目标更新影响摘要；不清已选父商品 | 单值，不允许平铺或多选 | 每个 item 独立复核版本与分类 |
| 分类挪父 | category atom `parentCategoryRef` | `usage=CATEGORY_REPARENT`、`currentCategoryRef` 的 hierarchy read + 当前分类影响摘要 | 切换目标只改草稿；当前 categoryRef 变化形成新 query identity 并重取；失败保树与已填值 | 当前节点与全部后代不可选并显示原因 | move command 拒自环、后代环、越范围、版本漂移 |

分类层级协议当前缺少完整路径、统一 `selectable` 与场景化 `disabledReason`，是 contract GAP；实施不得从平铺
`navigation.tree` 猜叶子资格，也不得先用普通 `Select` 止血。
`usage` 只由打开该任务的 surface 固定注入，用户界面不显示技术枚举；scope/brand/usage/currentCategoryRef
任一变化都由 candidate hook 清 cursor、累计节点和搜索结果，组件不得保留旧 identity 的候选镜像。

### 3.3 新建与超宽编辑抽屉

| 控件/事实族 | state 住址与控制者 | 上游改变时的级联 | 不允许的隐式行为 | 最终复核 |
| --- | --- | --- | --- | --- |
| 新建名称/编码/商品类型 | create Modal form + `useSubmissionLifecycle` | scope/brand 变化关闭并清空；商品类型改变不清名称、编码、分类 | 不提前建立半个商品；不在前端猜编码唯一 | create owner 原子复核 |
| 新建分类 | create form | 见 §3.2 | 不平铺 | create owner |
| 编辑区段导航 | draft `activeSection` + UI scroll controller | 错误定位可切区段并聚焦首错；配置绕行保存 section/field | 不用 Tab 隐藏错误；不因滚动改 dirty | 无写入 |
| 商品名称、短名、分类、标签 | Basic draft | 切分类只改分类；停用标签从新候选消失但既有绑定可见；移除绑定只改草稿 | 不从分类自动填标签；不把停用解释为删除 | whole-save catalog owner |
| 销售单位/基础计量单位 | Basic 或 SKU draft，有限候选 | 选择“继承商品”清 SKU override；选择“单独设置”以当前有效值初始化显式草稿并标 dirty；单位变化使依赖该单位的未保存数量字段重新校验 | 不改变历史快照；不把 measureMode 当单位；不四舍五入 | unit lifecycle + whole-save + inventory owner |
| 商品价格/规格价格 | Basic/SKU draft | 价格粒度来自 shape manifest；商品价与 SKU 价各自独立 | 不从一个粒度静默覆盖另一个；不猜税/渠道价 | catalog owner |
| 图片上传 | 资产子 state + draft media ref | stage 成功才写 draft；替换/移除只改草稿；关闭或放弃时释放本任务拥有且未保存的 staged asset | 不持久化签名地址/grant；上传失败保现图；异步结果必须按稳定 editorId 归属 | asset owner + whole-save catalog owner |
| 条码与标识集合 | identification slice；每行稳定 editorId/ref | 改类型后清除不适用于该类型的格式错误并按新规则重验值；删除行只改草稿 | 不用 index；不显示 normalizedValue；不在 UI 发明唯一域 | catalog owner |
| 规格维度/规格值 | SKU slice + SKU 子任务 working copy | 删除已有维度/值会影响 SKU 时先展示影响并 confirm；确认后重建待保存组合并把对应区段标 dirty/error | 不静默删除现有 SKU 事实；不把点单选项混成规格 | whole-save catalog owner |
| SKU 单位覆盖 | SKU row slice | “继承商品”清 override；商品默认值变化立即更新 effective preview，但不生成 override | 不把 effective 值误存成 owner override | whole-save catalog owner |
| 点单选项组/值 | order-option slice；组/值均稳定 ref/editorId | 切换选项组前若有规则先 confirm；确认后清旧组值规则、物料和制作影响；多选顺序按业务 displayOrder | 不用 index 回写；不把 option value 变 SKU | catalog + inventory/production owner |
| 商品属性定义/值 | attribute slice | 切换定义清旧定义的值；TEXT/SINGLE/MULTI 控件由定义返回；候选停用不清既有值 | 不按字段名猜控件；不把原始 ref 显示给用户 | catalog owner |
| 制作信息 | preparation slice + 商品级 `productionTagRef|null` | 规格选择“继承”清名称/时长/说明 override；“单独设置”从当前有效商品制作内容初始化完整草稿但不复制标签；选项影响只做非负时长增量与追加说明 | 生产标签只在商品级单选；不按 UUID 决定说明顺序；不在 View 读 draft 冒充有效制作信息 | fulfillment-production/catalog owner |
| 库存扣减方式 | inventory-rules slice | `NONE↔DIRECT↔BOM` 若会丢弃当前未保存配置，先 confirm；确认后只清与新方式不兼容的 draft；BOM 模式必须有行 | 不用 disabled 表单做详情；不静默保留隐藏 BOM | catalog/inventory owner |
| BOM/库存目标 | inventory 子任务；行稳定 editorId/ref | 改组件清该行旧 quantity 与单位快照并重新取目标消费单位；改盘点单位只改变录入换算，不改余额消费单位 | 不保留 stale unit；不以自由字符串保存单位 | inventory owner + whole-save |
| 套餐组件 | composite slice + 搜索候选子任务 | 改组件目标清旧 SKU 选择；取消子任务不改父草稿 | 不用 group/component index 作为身份 | catalog owner |
| 引用与治理摘要 | 只读 RTK currentData | refetch 可更新摘要，但不能覆盖其它 dirty slice | 不给只读区注册 Form；不可改原因不用 disabled 输入表达 | 对应 owner task read |
| 保存 | `useDrawerFormLifecycle` + draft controller | 前端先聚合 field/section errors；成功采用 readback、精确失效并清 session；已知失败保草稿；未知结果精确读回 | 不拆成区段保存；不无差别 refetch 全工作台；不只 toast | same-transaction owner commands |
| 取消/X/Esc/遮罩 | `useDrawerFormLifecycle.requestClose` | clean 直接关闭；dirty 统一 confirm；submitting 期间受统一门控 | 任一路径不得绕 dirty；关闭后不得残留子任务/error/candidate | 无写入 |

### 3.4 配置、批量、复制与治理

| 控件/事件 | state 与控制者 | 级联关系 | 精确失效/读回 | 禁止 |
| --- | --- | --- | --- | --- |
| 配置左侧六库导航 | `currentLibrary`，`useCatalogConfigLibrary` | 当前 definition dirty 时先确认；确认切库后清该库 search/cursor/selection/editor problem，再取新库 | 只取当前库；左栏不因右栏 loading 消失 | 顶部 Tabs；切库后保留旧库详情 |
| 简单库搜索/状态 | library local/applied filter | 提交搜索回首页；不影响其它库 | 当前库 list `currentData` | 全部库同时请求 |
| 简单库新建/改名/启停/删除 | 小 Modal draft + submission lifecycle | 打开先清旧 problem；失败保输入；成功关闭并清 draft | 对应库 list、对应候选与确实展示该名称的 read model | 配置之上开 Drawer；把停用说成删除 |
| 规格维度选择 | `selectedParentDefinitionRef` | 选择父维度后才取右侧值；切父清子 cursor/error/未提交子选择，不重取父列表 | 当前父级的值列表 | 无父时发子查询；父/子混成平铺列表 |
| 属性填写方式 | complex definition draft | TEXT→SINGLE/MULTI 初始化空选项；SINGLE↔MULTI 保留兼容选项；转 TEXT 且已有选项须 confirm 后清空 | 保存后定义 list/detail、商品候选 | 隐藏选项但仍提交旧值 |
| 点单选项选择方式/可选项 | complex definition draft | 切选择方式保留可选项；删除/重排按稳定 value ref/editorId；改可选项目标清其旧物料规则 | 定义 list/detail、商品候选、相关 inventory candidate read | index 身份；再开候选 Drawer |
| 编辑→配置 | workspace task reducer + draft controller | 先持久化 draft/section/focus，再关闭 EDIT，再打开 CONFIG；禁止叠开 | 配置完成后保存 `returnToEdit`，工作台显示继续编辑；恢复时重取候选 | 配置错误清商品草稿；同时打开两个 Drawer |
| 批量动作选择 | batch Modal reducer | 改动作清 action-specific target/summary/result，不清父商品选择 | 无请求直到摘要/提交需要 | 沿用上一次动作目标 |
| 批量提交 | submission lifecycle + server receipt | 提交时冻结 itemCode+version 快照并锁选择；结果按项显示；失败项可重试，成功项从当前选中移除 | 只重取当前父列表、导航受影响聚合和成功项详情；刷新失败单独显示 | 把逐项尽力伪装原子回滚；SKU 参与批量 |
| 复制流程/来源/目标/范围 | copy Drawer reducer | 改 flow 清来源/目标/范围/preflight/token/result；改来源、目标或范围即使 preflight stale，执行禁用直至重新检查 | 影响检查不写；执行用 token；成功精确重取目标 list/detail/navigation | 用旧 token；一步表单；一条 message 覆盖逐项结果 |
| 临时商品治理字段 | View child task draft | 每个字段变化使 preflight stale；重新检查后才能执行；关闭丢局部 draft不改商品 | 执行成功采用 readback并刷新 View/list | 混入普通编辑；跳过影响检查 |
| 生命周期动作 | View child confirm | actionAvailability 改变即关闭失效动作；危险确认展示影响 | 成功刷新 item/list/navigation；拒绝保事实与版本 | UI 从 status 自行拼可用动作；一排灰按钮 |

## 4. 精确刷新与恢复矩阵

| 写任务 | 成功后必须更新 | 必须保持 | 失败/未知 |
| --- | --- | --- | --- |
| 新建商品 | 当前父列表、导航计数；用 readback 打开新商品 EDIT | 当前树、筛选、分页尽量保持；若新商品不在当前页，不强行跳页 | 已知失败留 create form；未知按幂等键查 readback，不打开伪编辑 |
| 保存商品 | 当前 detail、命中该商品的父行摘要、必要导航聚合、受影响候选 | 其它父行、其它库、工作台筛选/分页/展开；dirty 未保存值直到确认成功 | 已知失败定位字段；未知保草稿并精确读目标 |
| 单项生命周期 | 该 item detail/list row、导航聚合、actionAvailability | 无关 item、配置库 | 拒绝后 status/version 不变 |
| 批量生命周期/整理 | 逐项 receipt 中成功项、当前 list、导航聚合 | 失败项选中与结果 receipt；无关页面 | 失败项事实不变；刷新失败与业务结果分开 |
| 分类新建/改名/挪父/删除 | navigation 与分类层级候选；当前结果域受影响时重取 list | 工作台工具区、非分类库 | 失败保 atom form；树/version 不变 |
| 商品标签/单位/生产标签 | 当前配置库与对应有限候选；确实显示改名事实的当前 detail/list/navigation | 其它配置库；历史快照不因定义变化重解释 | 失败留小 Modal draft |
| 规格维度/值 | 当前父/子库与 SKU 候选；受影响商品 detail/list 摘要 | 其它库 | 已引用拒绝不清编辑草稿 |
| 商品属性/点单选项定义 | 当前 definition list/detail、商品候选、受影响 item detail/list；物料关联改变时相关 inventory candidate | 无关 definition 库 | 失败停留同栏 editor |
| 本地/品牌复制 | 目标 item/list/navigation、逐项 readback | 来源 item、工作台上下文 | 影响检查失败零写；execute 未知按 token/receipt 读回 |
| 临时商品治理 | 当前 item detail/list/navigation、actionAvailability | 其它 item | 拒绝后版本和事实不变 |
| 图片 stage/release | 当前 asset read；whole-save 成功后 item detail/list 图片 | 其它 asset | stage 失败保旧图；release cleanup 结果单独可见 |

禁止“保存任意事实后同时 refetch 品牌、context、navigation、manifest、全部字典和全部列表”的大水漫灌。
内容页统一刷新是用户显式动作；命令成功后的精确失效是命令生命周期，两者不得用同一全局 revision 代替。

## 5. 共用信息架构规则

1. **数据来源与级联**：控件只消费本文件指明的 owner read/candidate；上游变化按 §3 清理下游。没有 contract
   候选协议即标 GAP，不得从详情、列表或 UUID 文本反向拼候选。
2. **只读/编辑**：View 零 Form、零 disabled 编辑控件、零 dirty hook；Editor 只显示适用区段，锁定事实用文本摘要
   和业务原因。View 与 Editor 不共享控件树。
3. **稳定身份**：父行 itemCode，规格行 itemCode+skuCode；服务端集合 ref/code，本地新行 editorId。搜索以下
   任一模式命中业务回写即缺陷：`skuIndex`、`dimensionIndex`、`valueIndex`、`lineIndex`、`groupIndex`、
   `componentIndex`、`row-${index}`。
4. **任务互斥**：工作区 surface 只能由 `CatalogWorkspaceTask` 控制；搜索多个第一层 `open` 布尔并可同时为真即缺陷。
5. **分类**：新建、编辑、批量分类、分类挪父及未来同类控件均为单选 searchable TreeSelect；出现普通平铺
   `Select`、Radio、Autocomplete 或自由文本即缺陷。
6. **业务语言**：DOM、提示、aria-label 中出现 `SKU`、`shapeKey`、scope、owner、contract、UUID、ref、profile、
   effect、payload、readback、manifest、problem code、raw exception、`ENABLED/DISABLED/ARCHIVED` 原始枚举即缺陷；
   商品编码、规格编码、条码、PLU、BOM 是已确认业务词，不受该禁令影响。`SKU` 仅允许出现在代码标识、接口名、
   testId 和本设计技术说明，用户一律看到“规格/规格编码/规格行”。
7. **候选形态**：有限候选与 cursor 搜索候选之外出现第三套 picker 生命周期即缺陷；TreeSelect 是层级业务对象
   的搜索候选呈现，不是第三套生命周期。
8. **状态不能只靠颜色**：生命周期 Tag、dirty/error 徽标、批量成功/失败均同时有中文文本或图标 aria-label。
9. **自动化**：全部交互控件从 `catalogTestIds.ts` 导出，kebab-case `catalog-` 前缀；动态行用业务码/editorId，
   不用 index。声明集合减 locator binding、L2 触达集合都必须为空。
10. **冻结入口例外**：“商品元数据”“当前结果域”只因 U-CATUI-06 保留在原入口；配置 Drawer 正文必须用六类
    业务名称与说明，新增 copy 不得再使用“元数据/结果域”。从品牌路径统一叫“从品牌复制/从品牌复制到门店”，
    不得与非目标中的文件“导入/导出”混用。

## 6. 错误语义与界面映射（46/46）

HTTP 状态沿 owning operation 的 typed problem contract；UI 不按 HTTP 猜业务语义。字段或集合问题定位到字段/行，
跨字段问题定位到分组，任务级问题放 surface 顶部。表中“用户可见处理”与 interaction §2.2 共同构成逐字文案
基线：允许插入对象名、字段名和数量，不得改写“事实是否改变、下一步、主/次动作与焦点”。

| problem code | 业务规则映射 | 触发界面/owner | 用户可见处理 |
| --- | --- | --- | --- |
| `ASSET_NOT_READY` | 图片尚未处理完成 | 图片编辑/asset | 保留原图与草稿，在图片行提示“图片仍在处理中，请稍后再保存” |
| `ASSET_PROCESSING_FAILED` | 图片处理失败 | 图片编辑/asset | 图片行提示重新上传，不清其它草稿 |
| `ASSET_REFERENCE_PROTECTED` | 图片仍被使用 | 图片移除/asset | 确认面提示仍被商品使用，保留图片 |
| `CATALOG_BASE_MEASURE_UNIT_CHANGE_BLOCKED` | 已有库存对象且新单位会造成快照漂移 | 基础/规格单位/catalog+inventory | 定位单位字段，提示“已有库存记录，不能改为这个基础计量单位” |
| `CATALOG_COPY_DEFINITION_CONFLICT` | 复制定义与目标冲突 | 复制/catalog | 冲突步骤逐项列出，要求改范围或取消，不执行 |
| `CATALOG_DEFINITION_LIMIT_EXCEEDED` | 定义数量达到上限 | 配置/catalog | 当前库顶部提示上限，新建入口不可继续，既有列表保留 |
| `CATALOG_IDENTIFIER_DUPLICATE` | 同范围识别码重复 | 条码与标识/catalog | 定位重复行和值，提示已被其它商品使用 |
| `CATALOG_IDENTIFIER_OWNER_MISMATCH` | 识别码目标不属于当前商品/规格 | 条码与标识/catalog | 定位集合行，提示重新选择当前商品或规格；不显示 owner/ref |
| `CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED` | 当前商品类型不允许该识别方式 | 条码与标识/catalog | 定位类型字段，说明当前商品可用的识别方式 |
| `CATALOG_IDENTIFIER_VALUE_INVALID` | 识别码格式不合法 | 条码与标识/catalog | 字段下显示格式要求并聚焦原值 |
| `CATALOG_OPTION_PREPARATION_CHANGE_NOT_ALLOWED` | 选项制作影响超出已裁边界 | 点单选项/catalog | 定位选项值，提示“这里只能增加制作时长或追加制作说明” |
| `CATALOG_PREPARATION_DURATION_INVALID` | 制作时长不是非负整数 | 制作信息/catalog | 定位时长字段，提示“请填写 0 或更大的整数秒数” |
| `CATALOG_PREPARATION_NOT_ALLOWED` | 当前商品/层级不允许制作信息 | 制作信息/catalog | 区段顶部说明当前商品不适用，保留其它区段草稿 |
| `CATALOG_PREPARATION_TARGET_MISMATCH` | 制作信息目标与商品/规格/选项不匹配 | 制作信息/catalog | 定位目标卡片，提示重新选择当前商品内对象 |
| `CATALOG_PREPARATION_UNKNOWN_FIELD` | 请求含退役或未知制作字段 | 制作信息/catalog | 任务级提示“制作信息已更新，请重新打开后再试”，不显示字段 key |
| `CATALOG_UNIT_IN_USE` | 单位已有引用，受保护属性不可改/不可删 | 计量单位/catalog | 行内说明“正在使用，只能改名称或停用” |
| `CATALOG_UNIT_LIMIT_EXCEEDED` | 单位库达到 99 个上限 | 计量单位/catalog | 列表顶部逐字提示上限，不提交 |
| `CATEGORY_DEPTH_EXCEEDED` | 分类层级超过允许深度 | 分类原子任务/catalog | TreeSelect 字段下提示需选择更高层上级 |
| `CONSUMPTION_UNIT_INCOMPATIBLE` | 消费单位维度/快照不兼容 | 库存与 BOM/inventory | 定位库存节点或 BOM 行，要求重选目标/单位 |
| `COPY_CLOSURE_TOO_LARGE` | 复制闭包超过本次上限 | 复制/catalog | 影响检查结果提示缩小复制范围，执行保持禁用 |
| `COPY_SELECTED_ITEMS_TOO_LARGE` | 选择商品数超过上限 | 品牌复制/catalog | 来源步骤提示减少选择，保留当前勾选 |
| `DEPENDENT_FACTS_BLOCK_VOID` | 依赖事实阻止作废 | 生命周期/catalog | 危险确认内列业务影响与下一步，不改变状态 |
| `DUPLICATE_CODE` | 业务编码重复 | 新建/配置/catalog | 定位编码字段，提示换一个编码 |
| `HIERARCHY_CYCLE` | 分类挪父会形成循环 | 分类挪父/catalog | TreeSelect 字段提示不能移到自身或下级；树/version 不变 |
| `IDEMPOTENCY_MISMATCH` | 同一提交意图内容发生变化 | 任一写任务/coordinator | 任务顶部提示内容已变化，要求重新确认并生成新提交意图 |
| `INVENTORY_BOM_COMPONENT_NOT_ELIGIBLE` | 所选对象不能作为 BOM 用料 | BOM/inventory | 定位组件行，提示重新选择可用原料 |
| `INVENTORY_BOM_EMPTY` | 已选择按用料扣减但没有用料行 | 库存与 BOM/inventory | 定位 BOM 分组，提示至少添加一项用料 |
| `INVENTORY_BOM_SELF_REFERENCE` | 商品把自身作为用料 | BOM/inventory | 定位组件行，提示不能选择当前商品或规格 |
| `INVENTORY_DEDUCTION_MODE_CHANGE_BLOCKED` | 余额/流水/引用/历史定义阻止切换 | 库存方式/inventory | 方式分组说明阻止原因与下一步，保留旧方式 |
| `INVENTORY_DEDUCTION_MODE_NOT_ALLOWED` | 当前商品类型/粒度不允许该方式 | 库存方式/inventory | 方式分组显示允许方式，不保留非法隐藏配置 |
| `INVENTORY_TARGET_REQUIRED_FOR_OPTION_MATERIAL` | 选项物料没有可消费库存对象 | 点单选项/inventory | 定位物料行，提示先配置该原料库存 |
| `MOVE_BOUNDARY` | 分类不能越当前业务范围移动 | 分类挪父/catalog | TreeSelect 字段提示只能选择当前商品库内分类 |
| `NEGATIVE_STOCK_NOT_ALLOWED` | 操作会产生不允许的负库存 | 库存相关/inventory | 定位数量/目标，显示当前不足，不改余额 |
| `NOT_FOUND` | 当前对象已不存在或不在本范围 | View/Edit/配置/owner | 关闭失效编辑入口并提示刷新当前结果；有草稿时先保留草稿供放弃，不伪造对象 |
| `OWNER_REFERENCE_LEAK` | 请求引用了其它 owner/范围事实 | 任一关联选择/coordinator | 任务顶部提示“所选内容已失效，请重新选择”，不显示内部边界 |
| `PRODUCTION_TAG_NOT_BINDABLE` | 生产标签已停用或不可新绑定 | 制作信息/production | 定位生产标签控件，既有绑定可见，新绑定要求重选 |
| `REFERENCE_BLOCKS_DELETE` | 既有引用阻止删除 | 配置删除/catalog | 危险确认显示“正在使用，不能删除；可以停用” |
| `REFERENCE_BLOCKS_VOID` | 既有引用阻止作废 | 生命周期/catalog | 影响区显示引用阻止原因，不改变状态 |
| `REFERENCE_MAPPING_UNRESOLVED` | 复制/治理的引用无法映射 | 复制或治理/catalog | 影响检查逐项列“需要重新选择的内容”，执行禁用 |
| `RESULT_UNKNOWN` | 请求结果未知 | 任一写任务/coordinator | 保留草稿/receipt 区，显示“结果正在确认”，立即按同一业务意图精确读回；禁止提示成功或失败 |
| `SCOPE_FORBIDDEN` | 当前用户无权访问该范围 | 全部/catalog 等 | 当前 surface 显示无权限并停止 scoped 子查询；不得泄露旧范围数据 |
| `STALE_COPY_PREFLIGHT` | 复制影响检查已过期 | 复制/catalog | 标记影响检查失效，保留选择，要求重新检查后执行 |
| `STRUCTURE_INCOMPATIBLE` | 来源与目标结构不兼容 | 复制/whole-save/catalog | 冲突区显示不兼容的业务区段，要求调整范围/目标 |
| `VALIDATION_ERROR` | 字段或集合校验失败 | 任一写任务/owner | 按 field path 定位首错；无 path 时放所属分组，不只 toast |
| `VERSION_CONFLICT` | 打开后事实已被他人更新 | Edit/配置/分类/owner | 保留草稿，提示查看最新内容或放弃后重开；禁止自动覆盖/合并 |
| `VOIDED_RECORD_IMMUTABLE` | 已作废事实不可原地修改 | Edit/配置/catalog | 显示只读摘要与“作废并重建”入口（可用时），不显示 disabled 表单 |

非 typed 的断网、超时、协议破损统一进入 transport feedback：读取失败按 §7 各 IA-ID 保留或清空旧数据；写请求
在无法确认是否到达 owner 时按结果未知处理，不将 raw exception、response body 或内部字段显示给用户。

### 6.1 失败类 exact-set 与焦点

46 个 code 必须各自映射到 interaction §2.2 恰好一个失败类；查询失败、无权限、版本冲突、结果未知、脏关闭和
业务已保存但页面未更新是非 code 的 6 类固定恢复路径。实现时导出的 mapping 必须满足：

```text
generated problem code set - mapped code set = ∅
mapped code set - generated problem code set = ∅
mapped code with zero or multiple presentation class = ∅
```

field path 存在时焦点必须落到对应字段/稳定集合行；只有无法定位的跨字段问题落所属分组标题；任务级问题落
surface 结果/问题区。任何路径都必须明确“哪一项、为什么、事实是否改变、下一步”；只显示“创建失败原因”、
“转正失败原因”、服务端 detail 或一条全局 message 均为缺陷。

### 6.2 诊断与 L2 的不可见观察

- `[focused]` 每个 task transition、draft restore/save、candidate load 和 submit 都调用 operations-admin 的统一
  safe logger；事件只含 operation instance、phase、section key/count、outcome，不含字段值、搜索词、商品名、
  识别码、draft 或 raw problem。
- `[L2，另行授权]` 每个声明 action 生成 `caseId/actionId/testId` 记录，并与前端 request log 的
  `generatedOperationId/requestId/correlationId`、后端 completion 和 DB section rows 关联。删除任一 join key，
  runner 必须在该 action 首个相关阶段报告断链，而不是等 case timeout。
- `[L2，另行授权]` action 的 expected-event matrix 声明 Playwright step、frontend lifecycle/request、backend
  completion、DB rows、runner heartbeat 哪些必须新增；无新增事件时报 `NO_NEW_EVENT:<source>`，日志文件缺失报
  `LOG_NOT_AVAILABLE:<source>`。background refresh 必须显式归类，不能成为无法解释的请求。
- `[L2 admission]` 现行 `FRAMEWORK_ONLY/ACTIVE_CASES=0`、缺受管 runner、本批 TEST fixture 或 24-case/控件 exact-set
  任一成立时，L2 入口必须 fail closed。旧 18 scenario/41 case、DEV seed、静态/focused proof 都不能满足准入。
- `[cleanup]` L2 只有 business、local cleanup、remote DB cleanup、remote asset cleanup 全部 PASS 才完成；报告必须
  分列 firstFailure、lastKnownGood、brokenBoundary、business 和 cleanup。

## 7. IA-ID 逐项维度

### IA-CATUI-01 · 查找、筛选与父商品/规格树形表

**可见维度**

- `businessTask`：在当前商品库范围内定位并横向比较父商品与每个规格。
- `actorAndScenario`：商品资料维护者或店长进入商品库，要找商品、比较价格/扣减方式并选父商品做批量处理。
- `entryAndSurface`：`/operations/:workspaceKey/catalog/store-items` 内容页；冻结顶部工具区和结果筛选区；下方
  Ant Design 原生树形 Table；商品名/规格名打开查看 Drawer。
- `controlType`：目录树（含“生产标签”一级节点和标签二级节点）、树搜索、关键词搜索、状态/来源 Select、重置、
  父行展开、父行 checkbox、cursor 分页；规格子行 checkbox 位置只占位不可选；没有“显示列”控件。
- `validationAndError`：读取失败保留相同 query identity 的最后确认父表并显示原位重试；新 identity 不显示旧范围；
  规格失败是一条可重试子行，不影响其它父行。
- `accessibilityAndTestId`：展开按钮含商品名 aria；父/子行层级可由 screen reader 识别；动态 testId 用 itemCode/skuCode；
  状态有中文文本。
- `emptyLoadingErrorStates`：父列表 loading 用表体骨架且工具区/筛选区不消失；空态“当前结果域还没有商品”并给
  “新建商品”；无规格不出现箭头；子页加载/失败/加载更多均占一条子行。
- `containerBehaviorUnderLoad`：父列表 cursor 分页，规格子页按父商品 cursor 加载；页面本身不横向溢出，表体
  横向滚动是默认承载方式而非降级；十列不得压缩到 formal §4.2 的最小宽度以下。选择/展开/商品列固定左侧，
  表头与表体同步；每单元格最多四行，单行与集合溢出均由 `EllipsisTooltip` 可读；父子共享列宽，窄屏不转卡片、
  不丢业务列、不增加第二条 range 滚动控件。

**不可见维度**

- `stateAndPermission`：[backend-acceptance] 用仅授权 A 节点的身份请求 B 节点的 context/navigation/item page/
  item detail/category candidates/SKU page 共六条核心 read，全部拒绝；任一返回 B 数据即缺陷。[静态] 六条 edge
  均消费相同 scope/session helper。其余九条 operations-admin read 仍按详设 §5.1.1 的 scoped exact-set
  各自保留越范围反例；public asset 只走 active public reference 守卫，不伪装成 operations session read。
- `navigationAndRefresh`：[focused] 改树、筛选、分页会清父行选择与规格展开；只开关 View 不清。[focused] 列表
  渲染直接消费 `currentData`，不存在 page mirror 或列显隐偏好。[L2，另行授权]
  关闭 View 后回到同一滚动位置和展开状态。
- `collectionShapeAndScale`：父列表 `Page`/cursor，预期几十至数千父商品；规格为每父商品独立 cursor page，预期
  0–几十，极端更多；total 与 hasNext 由 owner 返回。初始请求数不随父商品数线性增长。
- `dataSourceAndCascade`：[focused] brand/scope 改变关闭 task 并清所有 query-derived state；树搜索不触发父列表；
  展开一父行只请求该 item 的 SKU page；SKU 不改变父 total；跨分类路径只取父页 `categoryPathLabels`，不从树推导；
  选择生产标签只提交专用 `productionTagRef`，计数与匹配均由 owner 按父商品去重；展开后不二次过滤规格；
  父/规格库存单元格只消费 owner 返回的结构化 `inventoryDeductionSummary`，不得从 target/BOM 数量或详情拼接；
  标准价直接消费 nullable readback，null 不触发风险、动作禁用或本地完整度计算。菜单项必须有价只在菜单/销售集合
  写入边界复核，不由商品列表、商品草稿或 catalog owner 前移代办。
- `forbiddenUI`：[静态+render proof] `expandedRowRender` 文本块、斜杠复合列、重复表头、raw status、SKU checkbox、
  `acceptedPage` server mirror、隐藏任一业务列、列显隐入口、为避免横向滚动删列/改卡片、第二条 range 横滚控件
  任一存在即缺陷；把商品/规格未设置价格渲染为红色风险、缺价数量、配置缺口或动作阻断同样是缺陷。

### IA-CATUI-02 · 查看商品

**可见维度**

- `businessTask`：不改变事实地回答商品是什么、各规格怎么卖、怎么制作、怎样扣库存和被谁使用。
- `actorAndScenario`：维护者、店长、后厨或库存员从父/规格行进入只读事实面。
- `entryAndSurface`：第一层宽 Drawer；父行打开概览，规格行打开同一 Drawer 并定位规格；最多一个编辑主动作。
- `controlType`：Descriptions/摘要组、只读列表、图片区、区段锚点、普通/危险动作菜单；零 Form 和 disabled 控件。
- `validationAndError`：detail 读取失败原位重试；动作拒绝映射 §6；actionAvailability 原因用业务语言。
- `accessibilityAndTestId`：标题、区段、动作、图片预览均有 catalog testId；关闭焦点回触发行；状态不只靠颜色。
- `emptyLoadingErrorStates`：空区段按“还没有 X + 影响说明 + 下一步动作”；loading 不渲染上一个 item；失败保工作台。
- `containerBehaviorUnderLoad`：标题与动作栏固定，唯一内容区滚动；长说明换行，长集合渐进展开；Drawer 不横向溢出。

**不可见维度**

- `stateAndPermission`：[acceptance] 越 scope 读 detail/refs 均拒绝；View 动作集合取 contract，不由 status 本地推导。
- `navigationAndRefresh`：[focused] 关闭只清 View child/task，不清工作台；显式内容刷新重取 View；命令成功只精确更新
  当前 item/list/navigation。
- `collectionShapeAndScale`：单对象 Aggregate；引用/集合必须为 Bounded 或 Page，沿 contract 上界；不得抽干无限页。
- `dataSourceAndCascade`：[focused] target itemCode 变化时旧 `currentData` 不渲染；规格 focus 只改变定位，不改变读目标。
- `forbiddenUI`：[render proof] `Input/Select/Radio/Switch/InputNumber/TextArea`、保存/取消、dirty hook、raw ref/UUID/owner/
  problem code 任一在 View DOM 出现即缺陷。

### IA-CATUI-03 · 新建商品

**可见维度**

- `businessTask`：用最少身份原子建立商品草稿，成功后继续完善。
- `actorAndScenario`：资料维护者从冻结顶部“新建商品”进入。
- `entryAndSurface`：中型 Modal；字段为名称、编码、商品类型、商品分类；成功后接力超宽 Edit Drawer。
- `controlType`：Input、有限 shape Select、单选 searchable TreeSelect；取消在左、创建在右。
- `validationAndError`：字段问题就地；重复编码定位编码；分类/权限/未知结果按 §6；失败不打开编辑。
- `accessibilityAndTestId`：初始焦点名称；TreeSelect 层级可读；关闭回“新建商品”；成功焦点进入编辑标题。
- `emptyLoadingErrorStates`：shape/category 候选 loading 只锁对应控件；分类空/失败原位；scope 未就绪不挂 Modal form。
- `containerBehaviorUnderLoad`：Modal 不滚动整页；Tree 下拉在视口内滚动，长路径省略加提示。

**不可见维度**

- `stateAndPermission`：[acceptance] 创建越 scope、非法 shape/category、重复编码均拒绝且列表零新增。
- `navigationAndRefresh`：[focused] 成功 readback 后关闭 create、精确刷新 list/navigation并打开 EDIT；失败保 form。
- `collectionShapeAndScale`：单对象原子命令；shape 为 Bounded，分类为层级搜索候选，不抽干平铺页。
- `dataSourceAndCascade`：[focused] scope/brand 变化清 form；分类变化不清名称/编码/shape；shape 变化不猜其它字段。
- `forbiddenUI`：[静态+render proof] 平铺分类 Select、全量商品编辑字段、创建前空白 Edit Drawer、失败后伪 itemCode 出现即缺陷。

### IA-CATUI-04 · 编辑商品与草稿恢复

**可见维度**

- `businessTask`：修改适用的九类事实并一次整单保存，错误可定位、草稿可恢复。
- `actorAndScenario`：维护者从 View 点击编辑，或创建成功/配置绕行后继续编辑。
- `entryAndSurface`：第一层全高超宽 Drawer；左区段导航、右唯一滚动内容区、常驻保存栏；子任务最多一层。
- `controlType`：按 §3.3 每类 Editor；生产标签为可清空单选；规格制作子面只编辑名称/时长/说明；点单选项
  制作变化只编辑非负时长与追加说明；锁定事实是文本摘要；保存/取消常驻；恢复提示为专注小 Modal。
- `validationAndError`：field/row/group/section 四级定位；左栏错误徽标；已知拒绝保草稿，冲突/未知结果给明确下一步。
- `accessibilityAndTestId`：区段锚点和首错可键盘聚焦；关闭三径同一 dirty confirm；子任务关闭回触发控件；动态行稳定 ID。
- `emptyLoadingErrorStates`：首次 detail loading 后才 hydrate；候选 loading 只锁字段；空集合有添加动作；保存失败不清面。
- `containerBehaviorUnderLoad`：左栏固定，右栏滚动；保存栏不遮聚焦字段；动态集合内部按正本滚动/折叠，长说明换行；
  任何子面不超视口，第三层只有 confirm。

**不可见维度**

- `stateAndPermission`：[acceptance] 篡改 denied/locked/shape-inapplicable 字段均被 owner 拒绝且 version 不变；
  [focused] UI 只从 contract 取 section/action admission。
- `navigationAndRefresh`：[focused] dirty 时 detail refetch 不覆盖 draft；成功才清 session；X/Esc/mask/cancel 四径同一结果；
  配置绕行恢复原 section/value/error。[L2另行授权] 刷新后真实恢复与焦点。
- `collectionShapeAndScale`：单 Aggregate + 九类 Bounded/Page 子集合；候选只用 finite/cursor；各上界取 contract/owner，
  不拿 seed 当前行数当上界。
- `dataSourceAndCascade`：[focused] §3.3 每条上游改变的清理均有行为测试；子任务 apply 只写 parent draft；稳定身份
  在重排后仍把错误/上传结果回写正确行。商品生产标签草稿只有一个 `productionTagRef|null`；清空或改选不清
  规格制作内容或选项时长/说明。规格切换继承/覆盖不得创建标签字段；选项变化不得创建标签增删字段。
- `forbiddenUI`：[静态+render] View/Editor 共享 `readOnly` 控件树、区段独立保存、index 业务身份、RTK dirty mirror、
  sessionStorage 敏感/临时资产字段、同时 EDIT+CONFIG、生产标签多选、规格生产标签控件、选项生产标签控件
  任一出现即缺陷。

### IA-CATUI-05 · 商品配置六库

**可见维度**

- `businessTask`：维护商品复用的商品标签、单位、规格维度、生产标签、商品属性和点单选项。
- `actorAndScenario`：维护者从冻结“商品元数据”入口进入，或编辑缺候选时绕行。
- `entryAndSurface`：第一层全高配置 Drawer；左六库导航；右简单列表、父子两列、复杂定义同栏三形态。
- `controlType`：列表搜索/筛选、行名入口、小 Modal、主从列表、同栏 definition editor；配置内零 Drawer。
- `validationAndError`：字段/行/当前库定位；引用阻止删除给停用下一步；失败保配置 draft和待恢复编辑入口。
- `accessibilityAndTestId`：左库导航和右区标题关联；切库 dirty confirm；列表首列业务名称可操作；焦点回触发项。
- `emptyLoadingErrorStates`：左导航始终在；右栏按当前库独立 loading/empty/error；父未选显示下一步；候选失败只影响字段。
- `containerBehaviorUnderLoad`：Drawer 全高，左栏固定、右栏滚动；主从列各自滚动并按选中父对齐；复杂定义列表/编辑同栏；
  长名称省略提示，操作列与表头固定不溢出。

**不可见维度**

- `stateAndPermission`：[acceptance] 六库 read/write 越 scope 均拒绝；引用、上限、版本守卫由 owner 复核。
- `navigationAndRefresh`：[focused] 保存只失效当前库、对应候选与受影响 read model；其它五库 query 不被调用；关闭后
  `returnToEdit` 仍在。[L2另行授权] “继续编辑”恢复草稿。
- `collectionShapeAndScale`：简单库 Bounded/Page 依 owner（单位 hard max 99）；父子库父/子分别 Page；复杂定义 Page+
  Bounded child options；不得前端抽干后伪分页。
- `dataSourceAndCascade`：[focused] 切库/父维度/填写方式/选项目标按 §3.4 清理；配置不读写商品 draft；existing inactive
  binding 与 new candidate 分开。
- `forbiddenUI`：[静态+render] 顶部六 Tabs、1200px 万能 Modal、配置内 Drawer、简单字典详情页、第三套 candidate picker、
  切库后旧详情任一出现即缺陷。

### IA-CATUI-06 · 批量整理

**可见维度**

- `businessTask`：对选中父商品批量改分类、标签、状态或归档，并逐项理解结果。
- `actorAndScenario`：维护者在当前结果域选择父商品后进入批量任务。
- `entryAndSurface`：工作台直接宽 Modal；提交前摘要→提交中→结果三态；分类使用 TreeSelect。
- `controlType`：动作选择、对象摘要、目标控件、确认、进度、成功/失败筛选、逐项表格、关闭/重试失败项。
- `validationAndError`：零选择不能打开；版本/状态/引用逐项映射；刷新失败单列，不覆盖业务 receipt。
- `accessibilityAndTestId`：结果表有成功/失败文本；长结果区有界滚动；关闭焦点回批量入口。
- `emptyLoadingErrorStates`：候选失败保选中商品；提交中锁重复提交；协议非法/空结果不伪造成功层。
- `containerBehaviorUnderLoad`：对象摘要和结果最多在 100 项有界滚动区；表头/总计固定，长原因换行，Modal 不撑出视口。

**不可见维度**

- `stateAndPermission`：[acceptance] SKU 篡改、越 scope、非法 action、旧 version 各有拒绝且失败项事实不变。
- `navigationAndRefresh`：[focused] action change 清目标/result；提交冻结快照；成功项离开选择、失败项保留；刷新失败可见。
- `collectionShapeAndScale`：Bounded batch，上界来自 contract；结果与输入一一对应，不能只返回计数。
- `dataSourceAndCascade`：[focused] 分类 target 只来自 hierarchy；标签只来自有限候选；每项在 owner 中重新读 scope/version/status。
- `forbiddenUI`：[render] SKU 计入选择、平铺分类、多动作目标共存、全成全败假象、raw exception/内部 code、无界结果页即缺陷。

### IA-CATUI-07 · 本地复制与从品牌复制

**可见维度**

- `businessTask`：明确来源、目标、覆盖范围和冲突后安全复制，并逐项对账结果。
- `actorAndScenario`：维护者从冻结“从品牌复制”或 View“从已有商品复制配置”进入。
- `entryAndSurface`：第一层复制向导 Drawer；步骤保持上下文；两个 flow 标题与业务说明不同。
- `controlType`：搜索候选、来源/目标摘要、范围 checkbox、兼容性/冲突、上一步/继续/执行、逐项结果。
- `validationAndError`：preflight 问题停在冲突步；token stale 要求重新检查；execute unknown 保留结果确认区。
- `accessibilityAndTestId`：步骤标题、当前来源目标持续可读；关闭回入口；结果状态不只靠颜色。
- `emptyLoadingErrorStates`：候选 loading/empty/error 原位；影响检查中不显示旧结果；执行失败不丢来源/范围。
- `containerBehaviorUnderLoad`：候选 cursor 滚动；范围与冲突摘要内部滚动；Drawer footer 固定，长冲突换行。

**不可见维度**

- `stateAndPermission`：[acceptance] 越 scope/source/target、结构不兼容、过大闭包均拒绝且目标 version 不变。
- `navigationAndRefresh`：[focused] flow/source/target/scope change 使 token stale；只有执行成功刷新目标；来源 query 不刷新。
- `collectionShapeAndScale`：来源搜索 Page/cursor，选择与闭包有 contract 上界，result 与选定区段/项一一对应。
- `dataSourceAndCascade`：[focused] preflight token 绑定来源/目标/version/range；任一改变禁止 execute；不从 UI 重算闭包。
- `forbiddenUI`：[静态+render] 一步大表单、无 preflight 执行、旧 token、只显示一条成功 message、隐藏目标/version冲突即缺陷。

### IA-CATUI-08 · 生命周期与临时商品治理

**可见维度**

- `businessTask`：执行当前合法生命周期动作，或补全外部临时商品后转为正式商品。
- `actorAndScenario`：治理处理人或维护者从 View 的动作区进入。
- `entryAndSurface`：View 第二层专注任务；普通/危险确认分级；治理是 preflight→补缺口→确认。
- `controlType`：动作菜单、影响摘要、必要输入、重新检查、确认/取消；不可执行动作不显示灰按钮阵列。
- `validationAndError`：引用/依赖/版本/作废保护按 §6；失败后状态、版本、引用不变。
- `accessibilityAndTestId`：危险标题和按钮明确动作；焦点关闭后回原动作；影响数量同时有文本。
- `emptyLoadingErrorStates`：actionAvailability loading 不显示猜测动作；无可执行动作给原因；preflight failure 原位重试。
- `containerBehaviorUnderLoad`：影响列表有界滚动；确认按钮始终可见；技术细节不进入用户面。

**不可见维度**

- `stateAndPermission`：[acceptance] UI 未提供的篡改 action、越 scope、旧 version 均由 owner 拒绝；拒绝后 readback 不变。
- `navigationAndRefresh`：[focused] action availability 更新会关闭已失效 child task；成功精确刷新 item/list/navigation，失败不刷新成伪状态。
- `collectionShapeAndScale`：单对象命令 + Bounded 影响摘要；大量引用须分页/截断策略由 contract 声明，不抽干隐藏集合。
- `dataSourceAndCascade`：[focused] 治理字段变化使 preflight stale；execute 只消费 owner token；生命周期动作只消费 actionAvailability。
- `forbiddenUI`：[render] status 本地 switch、灰按钮阵列、治理混入普通 Editor、跳过 preflight、把“作废并重建”写成删除/编辑即缺陷。

## 8. 当前实现必须退役的状态反例

1. `CatalogWorkbenchPage` 的 `acceptedPage`：服务端 page 本地镜像。
2. `copyOpen/createOpen/dictionaryOpen/detail.isOpen/categoryAction/batchAction`：平行布尔值组合 surface。
3. 工作台“大水漫灌” refresh：一次动作重取品牌、context、navigation、manifest、全部字典和列表。
4. `detailQuery.data` / SKU query `data`：旧 identity 数据短暂冒充当前商品。
5. `CatalogItemDrawer` 同一控件树用 mode/readOnly 表达查看与编辑。
6. 各区段 `useState` draft 与 whole-save 父镜像并存。
7. `skuIndex/dimensionIndex/valueIndex/lineIndex/groupIndex/componentIndex` 作为异步或回写身份。
8. `CatalogDictionaryDrawer` 的顶部 Tabs + 万能 Modal，以及复杂定义继续叠 Drawer。
9. `dictionaryRevision` 用一个数字代替不同库、候选和 read model 的精确失效。
10. 品牌/scope 切换后旧 surface 继续打开。

实施者不得围绕这些旧状态追加兼容层；目标是删除旧控制路径并迁移到 §2 的三个住址。

## 9. 交叉对账

| 检查 | 结果 |
| --- | --- |
| IA ↔ 交互工件 | `PASS`：15 个 screen 的入口、surface、叠层、冻结区域、TreeSelect、父/规格同表、十列视觉契约、生产标签单选与容器行为一致；IA 只补状态与级联 |
| IA ↔ 正式需求 | `PASS`：U-CATUI-01/02/03/05/06/07/08/09/10/11/12、47 surface、三状态住址、六库、草稿恢复与 testId/L2 双分母均保留 |
| IA-ID ↔ Journey | `PASS`：IA-CATUI-01..08 分别对应 J-CATUI-01..08 |
| problem exact-set | `PASS`：generated `CATALOG_INVENTORY_PROBLEM_CODES` 46 项全部映射，无额外伪 code |
| 计数自证 | `PASS`：IA-ID=8；实际 `### IA-CATUI-` 小节=8 |
| IA ↔ implementation design | `PASS`：详设 §3/§7 与本文件逐字保持三状态住址、task union、控件级联、精确刷新、46 problem、生产标签商品级 0..1、8 IA-ID；实施 CP 逐项引用本文件，不另建状态语义 |

## 10. 完成判定

```text
IA_DIMENSIONS=IA-CATUI-01..IA-CATUI-08,可见与不可见维度逐项齐全
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=是
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=46 mapped
CROSS_CHECK_WITH_DESIGN=PASS
DEXTER_WIREFRAME_REVIEW=ACCEPTED_FOR_IA_DETAIL_COMPLETION@2026-08-23
IA_STATUS=PROPOSED_FOR_DESIGN_REVIEW;不构成 implementation authorization
```

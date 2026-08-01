---
title: RM1 P6 IA-04 运营组织、经营实体、门店与合同交互
status: DEXTER_ACCEPTED_FOR_IMPLEMENTATION_FACING_REFREEZE
programId: V2S_W0_W4_EXECUTION
implementationAuthority: false
---

# IA-04 运营组织、经营实体、门店与合同交互

```text
JOURNEY_DECISION=doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md#scenario-d02-s02；另见本文件 D03-S01/S02/S03 的同一 Journey 表
BUSINESS_REQUIREMENT_SOURCE=D02-S02（集团—大区—项目与项目分期）、D02-S03（品牌、经营租户、总公司及品牌授权）、D02-S04（门店主数据）、D03-S01/S02/S03（合同创建、CAS 编辑、失效）、D03-S04（门店角色只读合同三态）。
BUSINESS_PROBLEM=运营管理人员需要在其当前任职与数据范围内维护组织和实体资料；这些事实彼此有关，但不能把不同的业务对象、只读角色和状态动作塌成一个泛化“管理页”。
BUSINESS_USER_OR_OWNER=运营管理后台中获授权的集团/大区/项目/总公司/门店用户；组织、门店和合同 owner 各自返回并复核事实。
CURRENT_TASK=补齐 OPERATIONS-ORG-STRUCTURE、OPERATIONS-BUSINESS-ENTITIES、OPERATIONS-STORES、OPERATIONS-CONTRACTS、OPERATIONS-STORE-PROFILE 的逐 screen 严格 IA。
SUCCESS_OUTCOME=用户用业务对象、当前范围和明确确认完成维护或只读核对；不把内部类型、范围令牌、版本或候选机制暴露成界面语言。
UI_BEARING=true
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-07-29
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=operations-admin（运营管理后台）
```

## 1. 原始来源与静态基线

| surface / pageDesignKey | 原始业务任务 | Heritage 静态摹本来源 | 本稿不扩展的边界 |
| --- | --- | --- | --- |
| OPERATIONS-ORG-STRUCTURE / PG-ORG-STRUCTURE | D02-S02 | `OrganizationHierarchyPage.tsx@116c878d01954e1642df7a6c2b5b7fc4524cefd0da7aa01e3b83c942e96d2626` | 树只承载集团、大区、项目；不得变成通用图谱。 |
| OPERATIONS-BUSINESS-ENTITIES / PG-ORG-BRAND、PG-ORG-TENANT、PG-ORG-HEAD-COMPANY | D02-S03 | `BusinessEntityManagementPage.tsx@ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f` | 品牌、经营租户、总公司是三张独立内容页；总公司品牌授权不伪装成普通字段。 |
| OPERATIONS-STORES / PG-ORG-STORE-MANAGE | D02-S04 | `StoreManagementPage.tsx@4a4d270aefd097cd6f842327439c56180af396c63c642300997fb553e5d292a5` | 门店启停只改变门店主数据可用状态，不混入经营或资质结论。 |
| OPERATIONS-CONTRACTS / PG-CONTRACT-STORE-MANAGE | D03-S01/S02/S03 | `ContractManagementPage.tsx@7bd2bd086555904ba4a33c9350a7af8fb28a220f2bff5b1e54efacffc5a6c3e3` | 合同编辑保留历史分期快照与冲突重读；失效不是删除。 |
| OPERATIONS-STORE-PROFILE / PG-STORE-PROFILE | D02-S07、D03-S04 | `StoreProfilePage.tsx@24511b42b2f589c6034a16ae12abacd4e41c2cea7915cf949fd63e5673c1e3c9` | 门店角色只有资料和合同只读页，不画创建、编辑或状态动作。 |

所有内容页都在运营管理后台的既有 Shell、当前任职和已选择数据范围下打开。当前任职或数据范围不满足时，显示“当前范围无法查看此内容”，不以 URL、浏览器缓存或用户所选机构猜测补足。

## 2. 逐 screen 声明与低保真线框

每行都是一个独立 user-facing screen，表中的 `F` 是 implementation 时必须从 `admin-ui-foundation` 对接的能力；`O` 是读回或写入事实的 owner。列表无“操作”列：名称/业务标识链接进入详情 Drawer；详情关闭后才打开编辑 Drawer 或确认 Modal。

| screen | surface、形态、入口 | actor / 场景 / 业务目标 | 用户可见内容与低保真线框 | F / 技术边界 / O |
| --- | --- | --- | --- | --- |
| IA04-ORG-TREE | `PG-ORG-STRUCTURE`；内容页内左右 panel；组织架构菜单 | 有组织维护权限的运营用户查看并定位集团、大区或项目 | `组织架构 [新建大区]`<br>`┌集团 / 大区 / 项目树────┬组织详情──────────┐`<br>`│ 华东大区 > 上海项目      │ 名称 / 编码 / 状态 │`<br>`└───────────────────────┴──────────────────┘` | `contextScopedQueryArgs,testId`；不显示内部分类或范围参数；organization read |
| IA04-REGION-CREATE | Drawer；树页“新建大区” | 在集团下建立一个大区 | `新建大区`：所属集团（只读）、大区名称、编码、备注、取消/创建 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId`；organization create |
| IA04-PROJECT-CREATE | Drawer；选中大区后“新建项目” | 在正确大区下建立项目并录入项目分期名称 | `新建项目`：所属大区（只读）、项目名称、编码、项目分期名称（可添加、删除、排序）、取消/创建 | 同上；项目分期是项目聚合属性，不变成独立组织或日期模型；organization create |
| IA04-ORG-EDIT | Drawer；关闭详情后编辑 | 修订已选大区或项目的可编辑资料 | `编辑大区/项目资料`：名称、编码、备注；项目另有“项目分期名称”动态列表；取消/保存 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId`；不可见版本；项目分期为完整替换且可为零项；organization update |
| IA04-ORG-STATUS | Modal；详情上下文动作 | 明确启用或停用大区/项目 | `确认启用/停用“<名称>”？`；说明停用影响由系统在提交后如实提示；取消/确认 | `useOverlayLock,useSubmissionLifecycle,testId`；organization transition |
| IA04-BRAND-PAGE | `PG-ORG-BRAND`；独立内容页 | 品牌维护者查询、新建或进入品牌详情 | `品牌管理 [新建品牌]`；筛选“品牌名称/状态”；表“品牌名称(链接)/编码/状态/更新时间” | `contextScopedQueryArgs,testId`；organization list |
| IA04-TENANT-PAGE | `PG-ORG-TENANT`；独立内容页 | 经营租户维护者查询、新建或进入详情 | `经营租户管理 [新建经营租户]`；筛选“名称/状态”；表“名称(链接)/统一标识/状态/更新时间” | 同上；organization list |
| IA04-HEAD-COMPANY-PAGE | `PG-ORG-HEAD-COMPANY`；独立内容页 | 总公司维护者查询、新建或进入详情 | `总公司管理 [新建总公司]`；筛选“名称/状态”；表“名称(链接)/编码/状态/更新时间” | 同上；organization list |
| IA04-BUSINESS-DETAIL | Brand/Tenant/Head Company 的详情 Drawer；名称链接 | 先核对业务资料，再决定编辑、启停或品牌授权 | `<品牌/经营租户/总公司>详情 [编辑][启用/停用]`；owner 返回的资料后直接显示当前启用的定义字段；总公司另有“经营品牌” | `adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId`；不展示 owner id；organization detail |
| IA04-BUSINESS-CREATE | 各独立页的创建 Drawer | 建立对应经营实体 | `新建品牌`：编码、名称、别名、备注及其后当前启用的定义字段；`新建经营租户/总公司`：编码、名称、法定名称、统一社会信用代码、备注及其后当前启用的定义字段；取消/创建 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId`；三种 command 不合并；organization create |
| IA04-BUSINESS-EDIT | 详情关闭后的编辑 Drawer | 修订对应经营实体资料 | `编辑品牌`：编码、名称、别名、备注及其后当前启用的定义字段；`编辑经营租户/总公司`：编码、名称、法定名称、统一社会信用代码、备注及其后当前启用的定义字段；取消/保存 | 同上；organization update |
| IA04-HEAD-COMPANY-BRANDS | Drawer；总公司详情“经营品牌” | 为总公司维护可经营品牌集合 | `经营品牌`：可选品牌搜索选择、逐项添加或移除已授权品牌、关闭 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId`；候选由 owner 返回，不把候选 id 暴露；逐项 command，不设多选草稿保存；organization authorization |
| IA04-BUSINESS-STATUS | Modal；详情上下文动作 | 明确启用或停用一个经营实体 | `确认启用/停用“<名称>”？ [取消][确认]` | `useOverlayLock,useSubmissionLifecycle,testId`；organization transition |
| IA04-STORE-PAGE | `PG-ORG-STORE-MANAGE`；独立内容页 | 门店维护者筛选、创建并打开门店详情 | `门店管理 [新建门店]`；筛选“门店名称/门店编码/项目/状态”；表“门店名称(链接)/编码/项目/品牌/经营租户/总公司/状态” | `contextScopedQueryArgs,testId`；organization list |
| IA04-STORE-DETAIL | Drawer；门店名称链接 | 核对门店归属和资料后再编辑或启停 | `门店详情 [编辑][启用/停用]`；门店名称、编码、项目、品牌、经营租户、总公司、状态、备注及其后当前启用的定义字段 | `adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId`；organization detail |
| IA04-STORE-CREATE | Drawer；门店页“新建门店” | 在正确项目及经营关系下建立门店 | `新建门店`：项目、品牌、经营租户、总公司、门店名称、编码、备注及其后当前启用的定义字段、取消/创建 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId`；organization create |
| IA04-STORE-EDIT | Drawer；详情关闭后编辑 | 在固定归属下修订允许资料 | `编辑门店资料`：项目/品牌/经营租户/门店编码只读、门店名称、总公司、备注及其后当前启用的定义字段、取消/保存 | 同上；organization update |
| IA04-STORE-STATUS | Modal；详情上下文动作 | 明确门店主数据启用或停用 | `确认启用/停用“<门店名>”？`；“此操作仅改变门店资料可用状态。” | `useOverlayLock,useSubmissionLifecycle,testId`；organization transition |
| IA04-CONTRACT-PAGE | `PG-CONTRACT-STORE-MANAGE`；独立内容页 | 合同维护者先定位项目，再检索、创建并打开合同详情 | `门店合同管理 [新建合同]`；筛选“项目/合同编号/门店/分期/经营租户/状态”；表“合同编号(链接)/门店/分期/经营租户/起止日期/状态” | `contextScopedQueryArgs,testId`；contract list |
| IA04-CONTRACT-DETAIL | Drawer；合同编号链接 | 先核对当前或历史合同事实 | `合同详情 [编辑][作废]`；编号、门店、项目分期、经营租户、货号、起止日期、状态、备注、更新时间及其后当前启用的定义字段 | `adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId`；contract detail |
| IA04-CONTRACT-CREATE | Drawer；合同页“新建合同” | 选择门店后建立一份归属准确的合同 | `新建合同`：门店、项目分期、经营租户（随门店确定，只读）、合同编号、起止日期、货号、备注及其后当前启用的定义字段、取消/创建 | `adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId`；contract create |
| IA04-CONTRACT-EDIT | Drawer；详情关闭后编辑 | 用最新合同事实修订允许字段 | `编辑合同`：门店（只读）、经营租户（只读）、合同编号（只读）、项目分期、起止日期、货号、备注及其后当前启用的定义字段、取消/保存 | 同上；冲突时展示“合同已更新，请查看最新内容后重试”；contract CAS update |
| IA04-CONTRACT-INVALIDATE | Modal；详情“作废” | 明确让一份合同失效而非删除 | `确认作废合同“<编号>”？`；“作废后保留历史记录。”取消/确认 | `useOverlayLock,useSubmissionLifecycle,testId`；contract invalidate |
| IA04-STORE-PROFILE | `PG-STORE-PROFILE`；独立内容页 | 门店角色读取本门店资料 | `我的门店`；名称、编码、项目、品牌、经营租户、总公司、门店状态及其后当前启用的定义字段；无编辑控件 | `contextScopedQueryArgs,testId`；organization task read |
| IA04-STORE-PROFILE-CONTRACT | 内容页内 Tab“合同”；进入门店资料后 | 门店角色读取合同三态 | `合同`；Tab“当前/历史/已作废”；表“合同编号(链接)/项目分期/经营租户/起止日期/状态”与只读详情 | `contextScopedQueryArgs,testId`；contract task read |

## 3. 表单级联、选择规则与提交边界

| screen | 必须先后顺序与结果 |
| --- | --- |
| IA04-PROJECT-CREATE | 先固定所属大区；项目分期只属于该项目，用户逐条填写“项目分期名称”，空名称、重复名称、删除到零项均不可提交；拖动排序仅改变项目内名称顺序，owner 提交时重核验。 |
| IA04-HEAD-COMPANY-BRANDS | 搜索候选只来自 owner；每次选择一个候选即刻添加，当前授权按行即时移除；每条 command 由 owner 再核验总公司和品牌仍可用。 |
| IA04-STORE-CREATE | 先选项目和品牌；经营租户候选由当前项目与品牌重新返回；总公司候选再由已选品牌和经营租户返回。任何上游选择改变，都清空所有不再适用的下游选择并重新加载。 |
| IA04-STORE-EDIT | 项目、品牌、经营租户是已建立门店的归属事实，显示只读；仅总公司和允许资料可改，候选仍由 owner 复核。 |
| IA04-CONTRACT-CREATE | 先选门店；改门店立即清空并重取项目分期，经营租户随门店确定、只读显示。当前 contract candidate readback 未返回租户展示值：final 实施设计必须由 contract owner 将门店已确定的经营租户加入 candidate readback；不得向 create command 增加租户 mutation，也不得由浏览器反查/猜测。 |
| IA04-CONTRACT-EDIT | 门店、经营租户和合同编号均不可改；仅项目分期、起止日期、货号、备注及 owner 支持的实体扩展字段可编辑。打开 Drawer 时保存其当前合同快照，提交时如 owner 返回变化，关闭编辑并让用户从详情读取最新内容后重新决定。 |

## 4. 统一状态、文案与不允许的替代

加载、空结果和失败分别使用“正在加载”“暂无<对象>”和“暂时无法获取，请重试”；候选加载失败不伪装成没有可选项。所有筛选、分页、排序、版本、内部分类和范围参数均留在实现协议中，不进入用户文案。

禁止以一个“组织管理”页面用切换参数代替品牌、经营租户、总公司三张 pageDesignKey；禁止在门店资料页增加写操作；禁止把合同作废画成删除；禁止从当前任职或浏览器已知信息推测应可选的组织、门店或经营实体。

## 5. 接受条件

本稿的接受要求逐 screen 回读 R5 业务任务、静态基线、下列 surface ownership roster、§3 级联
和 §10 表单事实矩阵。所有列表保持“业务标识链接→详情 Drawer→关闭详情后才进入编辑/状态确认”；
不因对象相近、候选相近或合同/门店关系相近而把多个独立 surface 合并。

#### Surface ownership roster（25 个可实施 screen）

| screen id | 声明 UI_SURFACE | 线框可见元素分母 | ownership / copy 对账 | 结论 |
| --- | --- | --- | --- | --- |
| IA04-ORG-TREE | 内容页 | 标题、新建、组织树、只读详情 panel | 不画行尾操作 | PASS |
| IA04-REGION-CREATE | Drawer | 标题、所属集团只读、字段、取消/创建 | 全部属创建 Drawer | PASS |
| IA04-PROJECT-CREATE | Drawer | 标题、所属大区只读、字段、分期列表、取消/创建 | 全部属创建 Drawer | PASS |
| IA04-ORG-EDIT | Drawer | 标题、资料/分期字段、取消/保存 | 全部属编辑 Drawer | PASS |
| IA04-ORG-STATUS | Modal | 标题、状态说明、取消/确认 | 只承载状态确认 | PASS |
| IA04-BRAND-PAGE | 内容页 | 标题、新建、筛选、名称链接表格 | 不画操作列 | PASS |
| IA04-TENANT-PAGE | 内容页 | 标题、新建、筛选、名称链接表格 | 不画操作列 | PASS |
| IA04-HEAD-COMPANY-PAGE | 内容页 | 标题、新建、筛选、名称链接表格 | 不画操作列 | PASS |
| IA04-BUSINESS-DETAIL | Drawer | 标题、资料、定义字段槽位、状态、经营品牌、上下文动作 | 定义字段在原生资料后直接显示；写操作拆入独立面 | PASS |
| IA04-BUSINESS-CREATE | Drawer | 标题、对应实体字段、定义字段槽位、取消/创建 | 实体种类由入口固定，不让用户选内部类型 | PASS |
| IA04-BUSINESS-EDIT | Drawer | 标题、允许资料、定义字段槽位、取消/保存 | 定义字段在原生资料后直接显示 | PASS |
| IA04-HEAD-COMPANY-BRANDS | Drawer | 标题、品牌选择、已选项、添加/移除、关闭 | 只承载品牌授权集合 | PASS |
| IA04-BUSINESS-STATUS | Modal | 标题、状态说明、取消/确认 | 只承载状态确认 | PASS |
| IA04-STORE-PAGE | 内容页 | 标题、新建、筛选、名称链接表格 | 不画操作列 | PASS |
| IA04-STORE-DETAIL | Drawer | 标题、门店事实、定义字段槽位、上下文动作 | 定义字段在原生事实后直接显示；写操作拆入独立面 | PASS |
| IA04-STORE-CREATE | Drawer | 标题、级联候选、资料字段、定义字段槽位、取消/创建 | 全部属创建 Drawer | PASS |
| IA04-STORE-EDIT | Drawer | 标题、固定归属、可编辑资料、定义字段槽位、取消/保存 | 定义字段在原生资料后直接显示 | PASS |
| IA04-STORE-STATUS | Modal | 标题、状态说明、取消/确认 | 只承载状态确认 | PASS |
| IA04-CONTRACT-PAGE | 内容页 | 标题、新建、筛选、编号链接表格 | 不画操作列 | PASS |
| IA04-CONTRACT-DETAIL | Drawer | 标题、合同事实、定义字段槽位、上下文动作 | 定义字段在原生事实后直接显示；编辑/作废拆入独立面 | PASS |
| IA04-CONTRACT-CREATE | Drawer | 标题、级联候选、资料字段、定义字段槽位、取消/创建 | 全部属创建 Drawer | PASS |
| IA04-CONTRACT-EDIT | Drawer | 标题、固定事实、可编辑字段、定义字段槽位、取消/保存 | 定义字段在原生事实后直接显示 | PASS |
| IA04-CONTRACT-INVALIDATE | Modal | 标题、保留历史说明、取消/确认 | 只承载作废确认 | PASS |
| IA04-STORE-PROFILE | 内容页 | 标题、门店资料、定义字段槽位、只读状态 | 定义字段在原生资料后直接显示；不画写操作 | PASS |
| IA04-STORE-PROFILE-CONTRACT | 内容 Tab | Tab、三态合同表、编号链接、只读详情 | 不画合同写操作 | PASS |

## 6. 逐 screen Heritage 对应矩阵

`H-ORG`、`H-ENTITY`、`H-STORE`、`H-CONTRACT`、`H-PROFILE` 分别是 §1 同名行的**完整
path@SHA-256**。每项以该静态基线为摹本，但不同业务对象与 owner command 不因同一视觉骨架而合并。

| screen | 对应关系 / 静态摹本 | 差异与原因 |
| --- | --- | --- |
| IA04-ORG-TREE | EXACT_COUNTERPART / H-ORG | 固定左右树/详情，不画通用图谱。 |
| IA04-REGION-CREATE | PARTIAL_COUNTERPART / H-ORG | D02-S02 的大区创建需独立 Drawer。 |
| IA04-PROJECT-CREATE | PARTIAL_COUNTERPART / H-ORG | 项目与首个分期必须属于已选大区。 |
| IA04-ORG-EDIT | EXACT_COUNTERPART / H-ORG | 详情关闭后编辑，避免同面叠写。 |
| IA04-ORG-STATUS | EXACT_COUNTERPART / H-ORG | 启停只从详情进入确认。 |
| IA04-BRAND-PAGE | EXACT_COUNTERPART / H-ENTITY | 品牌有独立 pageDesignKey。 |
| IA04-TENANT-PAGE | EXACT_COUNTERPART / H-ENTITY | 经营租户有独立 pageDesignKey。 |
| IA04-HEAD-COMPANY-PAGE | EXACT_COUNTERPART / H-ENTITY | 总公司有独立 pageDesignKey。 |
| IA04-BUSINESS-DETAIL | PARTIAL_COUNTERPART / H-ENTITY | 标题随三种对象变化，详情后才开放上下文动作。 |
| IA04-BUSINESS-CREATE | PARTIAL_COUNTERPART / H-ENTITY | 三种对象分别新建，不以泛化实体类型交给用户选择。 |
| IA04-BUSINESS-EDIT | EXACT_COUNTERPART / H-ENTITY | 仅修改 owner 允许的资料。 |
| IA04-HEAD-COMPANY-BRANDS | PARTIAL_COUNTERPART / H-ENTITY | D02-S03 的总公司品牌授权是独立任务。 |
| IA04-BUSINESS-STATUS | EXACT_COUNTERPART / H-ENTITY | 不附加无出处的经营/资质后果。 |
| IA04-STORE-PAGE | EXACT_COUNTERPART / H-STORE | 保留名称链接和无操作列。 |
| IA04-STORE-DETAIL | EXACT_COUNTERPART / H-STORE | 先核对归属，再进入写动作。 |
| IA04-STORE-CREATE | PARTIAL_COUNTERPART / H-STORE | D02-S04 的门店归属候选级联在 §3 明确。 |
| IA04-STORE-EDIT | PARTIAL_COUNTERPART / H-STORE | 已建立的项目、品牌、经营租户保持只读事实。 |
| IA04-STORE-STATUS | EXACT_COUNTERPART / H-STORE | 明确仅改变门店资料可用状态。 |
| IA04-CONTRACT-PAGE | EXACT_COUNTERPART / H-CONTRACT | 维持合同的独立内容页。 |
| IA04-CONTRACT-DETAIL | EXACT_COUNTERPART / H-CONTRACT | 历史事实由详情读取。 |
| IA04-CONTRACT-CREATE | PARTIAL_COUNTERPART / H-CONTRACT | 门店先决条件决定项目分期和只读经营租户；展示值须由 contract owner candidate readback 提供。 |
| IA04-CONTRACT-EDIT | PARTIAL_COUNTERPART / H-CONTRACT | D03-S02 的并发变化必须重读后再决定。 |
| IA04-CONTRACT-INVALIDATE | EXACT_COUNTERPART / H-CONTRACT | D03-S03 是作废并保留历史，不是删除。 |
| IA04-STORE-PROFILE | EXACT_COUNTERPART / H-PROFILE | 门店角色只有资料只读面。 |
| IA04-STORE-PROFILE-CONTRACT | PARTIAL_COUNTERPART / H-PROFILE | D03-S04 以当前/历史/已作废三态只读呈现。 |

本稿是已获 Dexter 接受、等待 implementation-facing re-freeze 的静态交互详设，`DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-07-29`，不授权任何实现。实施者仍须逐 screen 回读本稿的业务任务、可见面、级联、owner 与静态摹本；后续还需按 package-exit、foundation import equality 与 focused evidence 另行设计和验证。

## 7. 严格 screen sheets（第一组：组织树）

全部摹自 `all-v2/apps/frontend/operations-admin/src/features/organization-hierarchy/ui/OrganizationHierarchyPage.tsx@116c878d01954e1642df7a6c2b5b7fc4524cefd0da7aa01e3b83c942e96d2626`；原始业务来源为 R5 D02-S02。

<a id="IA04-ORG-TREE"></a>
### Screen: IA04-ORG-TREE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=组织架构菜单；当前任职和可查看范围已由 IA02 确认
ACTOR=具有组织维护资格的运营用户
BUSINESS_SCENARIO=查看集团、大区、项目并开始维护正确对象
BUSINESS_GOAL=在正确层级定位对象或开始新增
USER_VISIBLE_COPY=标题“组织架构”；按钮“新建大区”；树“集团/大区/项目”；详情“名称”“编码”“状态”“备注”；选中大区时“新建项目”
TECHNICAL_BOUNDARY=内部对象类型、范围与标识不显示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/organization-hierarchy/ui/OrganizationHierarchyPage.tsx@116c878d01954e1642df7a6c2b5b7fc4524cefd0da7aa01e3b83c942e96d2626
```
```text
组织架构 [新建大区]
集团 > 大区 > 项目                 组织详情
选中大区后 [新建项目]              名称 / 编码 / 状态 / 备注
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 组织树 | Tree | organization readback | 当前范围可读 | 选大区才启用新建项目 | 固定三层 | 加载/空/失败分离 | organization owner |

<a id="IA04-REGION-CREATE"></a>
### Screen: IA04-REGION-CREATE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA04-ORG-TREE 的“新建大区”
ACTOR=具有组织维护资格的运营用户
BUSINESS_SCENARIO=集团下需要新增一个大区
BUSINESS_GOAL=在正确集团归属下建立大区
USER_VISIBLE_COPY=标题“新建大区”；“所属集团（只读）”“大区名称”“编码”“备注”；按钮“取消”“创建”
TECHNICAL_BOUNDARY=父对象标识、版本与范围不显示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/organization-hierarchy/ui/OrganizationHierarchyPage.tsx@116c878d01954e1642df7a6c2b5b7fc4524cefd0da7aa01e3b83c942e96d2626
```
```text
新建大区
所属集团（只读） 大区名称 [____] 编码 [____] 备注 [____] [取消] [创建]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 大区名称/编码/备注 | 输入 | 用户填写 | Drawer 打开 | 无 | 格式提示 | 提交中禁编辑 | 父归属/唯一性/资格 |

<a id="IA04-PROJECT-CREATE"></a>
### Screen: IA04-PROJECT-CREATE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA04-ORG-TREE 选中大区后的“新建项目”
ACTOR=具有组织维护资格的运营用户
BUSINESS_SCENARIO=大区下需要新增项目并配置项目内分期名称
BUSINESS_GOAL=在正确大区归属下建立项目及其分期名称集合
USER_VISIBLE_COPY=标题“新建项目”；“所属大区（只读）”“项目名称”“编码”“项目分期名称”；按钮“添加分期”“删除”“取消”“创建”
TECHNICAL_BOUNDARY=父对象标识、排序字段和内部类型不显示；分期不是日期或独立组织
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/organization-hierarchy/ui/OrganizationHierarchyPage.tsx@116c878d01954e1642df7a6c2b5b7fc4524cefd0da7aa01e3b83c942e96d2626
```
```text
新建项目
所属大区（只读） 项目名称 [____] 编码 [____]
项目分期名称 [____] [删除] [添加分期]             [取消] [创建]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 项目分期名称 | 动态输入列表 | 用户填写 | 已有项目资料草稿 | 添加/删除/拖动只改名称集合 | 空/重复/零项不可提交 | 无效行标注 | 项目内唯一性/排序 |

<a id="IA04-ORG-EDIT"></a>
### Screen: IA04-ORG-EDIT
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=关闭组织详情后选择“编辑”
ACTOR=具有组织维护资格的运营用户
BUSINESS_SCENARIO=需更正大区或项目允许修改的资料
BUSINESS_GOAL=保存正确的名称、编码、备注与项目分期资料
USER_VISIBLE_COPY=标题“编辑大区资料/编辑项目资料”；“名称”“编码”“备注”；编辑项目时另有“项目分期名称”；按钮“取消”“保存”
TECHNICAL_BOUNDARY=内部标识和版本不显示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/organization-hierarchy/ui/OrganizationHierarchyPage.tsx@116c878d01954e1642df7a6c2b5b7fc4524cefd0da7aa01e3b83c942e96d2626
```
```text
编辑大区资料  名称 [____] 编码 [____] 备注 [____] [取消] [保存]
编辑项目资料  名称 [____] 编码 [____] 备注 [____]
项目分期名称  [____________] [删除]  [+ 添加项目分期]                 [取消] [保存]
```

<a id="IA04-ORG-STATUS"></a>
### Screen: IA04-ORG-STATUS
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=组织详情的“启用/停用”
ACTOR=具有组织维护资格的运营用户
BUSINESS_SCENARIO=准备改变大区或项目可用状态
BUSINESS_GOAL=确认正确对象和状态操作
USER_VISIBLE_COPY=“确认启用/停用“<名称>”？；按钮“取消”“确认”
TECHNICAL_BOUNDARY=状态枚举、版本与内部标识不显示
FOUNDATION_PRIMITIVE=useOverlayLock,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/organization-hierarchy/ui/OrganizationHierarchyPage.tsx@116c878d01954e1642df7a6c2b5b7fc4524cefd0da7aa01e3b83c942e96d2626
```
```text
确认启用/停用“<名称>”？ [取消] [确认]
```

## 8. 严格 screen sheets（第二组：经营实体）

全部摹自 `all-v2/apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx@ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f`；原始来源为 R5 D02-S03。品牌、经营租户、总公司保留独立 pageDesignKey，不能让用户用“实体类型”泛化切换。

<a id="IA04-BRAND-PAGE"></a>
### Screen: IA04-BRAND-PAGE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=品牌管理菜单
ACTOR=具有品牌维护资格的运营用户
BUSINESS_SCENARIO=查找、查看或新建品牌
BUSINESS_GOAL=管理品牌主数据
USER_VISIBLE_COPY=“品牌管理”“新建品牌”；筛选“品牌名称”“状态”；列“品牌名称”“编码”“状态”“更新时间”
TECHNICAL_BOUNDARY=分页、内部标识不显示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx@ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f
```
```text
品牌管理 [新建品牌]  品牌名称 [____] 状态 [全部] [查询]
品牌名称（链接） | 编码 | 状态 | 更新时间
```

<a id="IA04-TENANT-PAGE"></a>
### Screen: IA04-TENANT-PAGE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=经营租户管理菜单
ACTOR=具有经营租户维护资格的运营用户
BUSINESS_SCENARIO=查找、查看或新建经营租户
BUSINESS_GOAL=管理经营租户主数据
USER_VISIBLE_COPY=“经营租户管理”“新建经营租户”；筛选“名称”“状态”；列“名称”“统一标识”“状态”“更新时间”
TECHNICAL_BOUNDARY=分页、内部标识不显示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx@ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f
```
```text
经营租户管理 [新建经营租户] 名称 [____] 状态 [全部] [查询]
名称（链接） | 统一标识 | 状态 | 更新时间
```

<a id="IA04-HEAD-COMPANY-PAGE"></a>
### Screen: IA04-HEAD-COMPANY-PAGE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=总公司管理菜单
ACTOR=具有总公司维护资格的运营用户
BUSINESS_SCENARIO=查找、查看或新建总公司
BUSINESS_GOAL=管理总公司主数据
USER_VISIBLE_COPY=“总公司管理”“新建总公司”；筛选“名称”“状态”；列“名称”“编码”“状态”“更新时间”
TECHNICAL_BOUNDARY=分页、内部标识不显示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx@ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f
```
```text
总公司管理 [新建总公司] 名称 [____] 状态 [全部] [查询]
名称（链接） | 编码 | 状态 | 更新时间
```

<a id="IA04-BUSINESS-DETAIL"></a>
### Screen: IA04-BUSINESS-DETAIL
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=三类实体内容页的名称链接
ACTOR=具有对应实体维护资格的运营用户
BUSINESS_SCENARIO=修改或启停前核对实体资料
BUSINESS_GOAL=查看正确对象并进入获批动作
USER_VISIBLE_COPY=“<品牌/经营租户/总公司>详情”“编辑”“启用/停用”；总公司另有“经营品牌”；资料字段为 owner 返回的业务资料；其后按 displayOrder 升序直接显示由运维管理后台定义且当前启用的字段，字段标签由 definition 返回，缺失值显示“—”，无独立分组标题
TECHNICAL_BOUNDARY=标识、版本不显示；详情关闭后才开后续面
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx@ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f
```
```text
<对象>详情 [编辑] [启用/停用] [经营品牌（仅总公司）]
品牌：编码 / 名称 / 别名 / 状态 / 备注 / 更新时间
经营租户、总公司：编码 / 名称 / 法定名称 / 统一社会信用代码 / 状态 / 备注 / 更新时间
当前启用的定义字段（按顺序直接显示，无分组标题）
```

<a id="IA04-BUSINESS-CREATE"></a>
### Screen: IA04-BUSINESS-CREATE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=对应独立内容页的“新建品牌/经营租户/总公司”
ACTOR=具有对应实体维护资格的运营用户
BUSINESS_SCENARIO=新增一个明确类型的经营实体
BUSINESS_GOAL=建立该类型所需主数据
USER_VISIBLE_COPY=“新建品牌/新建经营租户/新建总公司”；全部为“编码”“名称”“备注”；仅经营租户和总公司额外为“法定名称”“统一社会信用代码”；其后按 displayOrder 升序直接插入由运维管理后台定义且当前启用的字段，标签、必填与控件由 definition 返回，无独立分组标题；“取消”“创建”
TECHNICAL_BOUNDARY=实体类型由入口固定，不作为用户控件；owner 核验唯一性
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx@ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f
```
```text
新建品牌：编码 [____] 名称 [____] 别名 [____] 备注 [____]
新建经营租户/总公司：编码 [____] 名称 [____] 法定名称 [____] 统一社会信用代码 [____] 备注 [____]
当前启用的定义字段（按顺序直接插入，无分组标题）
                                                        [取消] [创建]
```

<a id="IA04-BUSINESS-EDIT"></a>
### Screen: IA04-BUSINESS-EDIT
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=关闭 IA04-BUSINESS-DETAIL 后选择“编辑”
ACTOR=具有对应实体维护资格的运营用户
BUSINESS_SCENARIO=更正 owner 允许的实体资料
BUSINESS_GOAL=保存该对象的正确业务资料
USER_VISIBLE_COPY=“编辑品牌/编辑经营租户/编辑总公司资料”；品牌字段“编码”“名称”“别名”“备注”；经营租户/总公司字段“编码”“名称”“法定名称”“统一社会信用代码”“备注”；其后按 displayOrder 升序直接插入由运维管理后台定义且当前启用的字段，标签、必填与控件由 definition 返回，无独立分组标题；“取消”“保存”
TECHNICAL_BOUNDARY=类型、版本、内部标识不显示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx@ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f
```
```text
编辑品牌：编码 [____] 名称 [____] 别名 [____] 备注 [____]
编辑经营租户/总公司：编码 [____] 名称 [____] 法定名称 [____] 统一社会信用代码 [____] 备注 [____]
当前启用的定义字段（按顺序直接插入，无分组标题）
                                                        [取消] [保存]
```

<a id="IA04-HEAD-COMPANY-BRANDS"></a>
### Screen: IA04-HEAD-COMPANY-BRANDS
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA04-BUSINESS-DETAIL 中总公司的“经营品牌”
ACTOR=具有总公司维护资格的运营用户
BUSINESS_SCENARIO=维护该总公司可经营的品牌集合
BUSINESS_GOAL=保存正确的经营品牌授权
USER_VISIBLE_COPY=标题“经营品牌”；“可选品牌”“添加”；每项已授权品牌的“移除”；“关闭”
TECHNICAL_BOUNDARY=品牌候选与授权标识不显示；候选仅由 owner 返回
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx@ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f
```
```text
经营品牌  可选品牌 [搜索选择] [添加]
已授权品牌  <品牌名称> [移除]  <品牌名称> [移除]                 [关闭]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 添加品牌 | 搜索选择 + 按钮 | owner 候选 | Drawer 读到总公司 | 添加成功后重读授权列表 | 只显示 owner 候选 | 失败保留当前已授权列表 | 单条 add command 重验总公司/品牌 |
| 移除品牌 | 每项确认按钮 | owner 当前授权 | 当前品牌未被门店引用 | 成功后重读授权列表 | 被引用品牌不可移除 | owner 拒绝说明“该品牌仍被门店使用” | 单条 remove command 重验引用关系 |

<a id="IA04-BUSINESS-STATUS"></a>
### Screen: IA04-BUSINESS-STATUS
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=IA04-BUSINESS-DETAIL 的“启用/停用”
ACTOR=具有对应实体维护资格的运营用户
BUSINESS_SCENARIO=准备改变实体可用状态
BUSINESS_GOAL=明确确认该对象和操作
USER_VISIBLE_COPY=“确认启用/停用“<名称>”？；“取消”“确认”
TECHNICAL_BOUNDARY=状态、版本、内部标识不显示；不说明无出处的经营后果
FOUNDATION_PRIMITIVE=useOverlayLock,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx@ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f
```
```text
确认启用/停用“<名称>”？ [取消] [确认]
```

## 9. 严格 screen sheets（第三组：门店）

全部摹自 `all-v2/apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx@4a4d270aefd097cd6f842327439c56180af396c63c642300997fb553e5d292a5`；原始来源为 R5 D02-S04。

<a id="IA04-STORE-PAGE"></a>
### Screen: IA04-STORE-PAGE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=门店管理菜单
ACTOR=具有门店维护资格的运营用户
BUSINESS_SCENARIO=查找、查看或新建门店
BUSINESS_GOAL=定位正确门店或开始创建
USER_VISIBLE_COPY=“门店管理”“新建门店”；“筛选功能准备中”；筛选“门店名称”“门店编码”“项目”“状态”；列“门店名称”“编码”“项目”“品牌”“经营租户”“总公司”“状态”
TECHNICAL_BOUNDARY=分页、范围、内部标识不显示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx@4a4d270aefd097cd6f842327439c56180af396c63c642300997fb553e5d292a5
```
```text
门店管理 [新建门店] 门店名称 [待补服务端筛选] 门店编码 [待补服务端筛选] 项目 [待补服务端筛选] 状态 [待补服务端筛选] [查询（不可用）]
门店名称（链接） | 编码 | 项目 | 品牌 | 经营租户 | 总公司 | 状态
```

<a id="IA04-STORE-DETAIL"></a>
### Screen: IA04-STORE-DETAIL
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA04-STORE-PAGE 的门店名称链接
ACTOR=具有门店维护资格的运营用户
BUSINESS_SCENARIO=编辑或启停前核对门店归属和资料
BUSINESS_GOAL=确认正确门店并进入获批动作
USER_VISIBLE_COPY=“门店详情”“编辑”“启用/停用”；“门店名称”“编码”“项目”“品牌”“经营租户”“总公司”“状态”“备注”；其后按 displayOrder 升序直接显示由运维管理后台定义且当前启用的字段，字段标签由 definition 返回，缺失值显示“—”，无独立分组标题
TECHNICAL_BOUNDARY=内部标识、版本和范围不显示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx@4a4d270aefd097cd6f842327439c56180af396c63c642300997fb553e5d292a5
```
```text
门店详情 [编辑] [启用/停用]
门店名称 / 编码 / 项目 / 品牌 / 经营租户 / 总公司 / 状态 / 备注
当前启用的定义字段（按顺序直接显示，无分组标题）
```

<a id="IA04-STORE-CREATE"></a>
### Screen: IA04-STORE-CREATE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA04-STORE-PAGE 的“新建门店”
ACTOR=具有门店维护资格的运营用户
BUSINESS_SCENARIO=在正确项目和经营关系下新增门店
BUSINESS_GOAL=建立归属、经营主体和资料均正确的门店
USER_VISIBLE_COPY=“新建门店”；“项目”“品牌”“经营租户”“总公司”“门店名称”“门店编码”“备注”；其后按 displayOrder 升序直接插入由运维管理后台定义且当前启用的字段，标签、必填与控件由 definition 返回，无独立分组标题；“取消”“创建”
TECHNICAL_BOUNDARY=候选标识、范围和 owner 规则不显示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx@4a4d270aefd097cd6f842327439c56180af396c63c642300997fb553e5d292a5
```
```text
新建门店
项目 [选择] 品牌 [选择] 经营租户 [选择] 总公司 [选择]
门店名称 [____] 门店编码 [____] 备注 [____]
当前启用的定义字段（按顺序直接插入，无分组标题）       [取消] [创建]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 项目/品牌 | 搜索选择 | owner 候选 | Drawer 加载完成 | 改任一上游清空经营租户/总公司 | 只选当前范围候选 | 失败禁用下游 | 项目/品牌资格 |
| 经营租户 | 搜索选择 | 当前项目+品牌 owner 候选 | 已选项目、品牌 | 改选清空总公司 | 不显示其他组合 | 无候选明确提示 | 归属仍有效 |
| 总公司 | 搜索选择 | 当前品牌+经营租户 owner 候选 | 已选品牌、经营租户 | 上游变化重取 | 不用客户端猜测 | 无候选不可提交 | 总公司品牌授权 |

<a id="IA04-STORE-EDIT"></a>
### Screen: IA04-STORE-EDIT
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=关闭 IA04-STORE-DETAIL 后选择“编辑”
ACTOR=具有门店维护资格的运营用户
BUSINESS_SCENARIO=修订既有门店允许修改的资料
BUSINESS_GOAL=保持已建归属不变并更新门店资料
USER_VISIBLE_COPY=“编辑门店资料”；“项目（只读）”“品牌（只读）”“经营租户（只读）”“门店编码（只读）”“门店名称”“总公司”“备注”；其后按 displayOrder 升序直接插入由运维管理后台定义且当前启用的字段，标签、必填与控件由 definition 返回，无独立分组标题；“取消”“保存”
TECHNICAL_BOUNDARY=内部标识、版本不显示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx@4a4d270aefd097cd6f842327439c56180af396c63c642300997fb553e5d292a5
```
```text
编辑门店资料  项目/品牌/经营租户/门店编码（只读） 门店名称 [____] 总公司 [选择] 备注 [____]
当前启用的定义字段（按顺序直接插入，无分组标题）       [取消] [保存]
```

<a id="IA04-STORE-STATUS"></a>
### Screen: IA04-STORE-STATUS
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=IA04-STORE-DETAIL 的“启用/停用”
ACTOR=具有门店维护资格的运营用户
BUSINESS_SCENARIO=准备改变门店资料可用状态
BUSINESS_GOAL=确认正确门店和状态动作
USER_VISIBLE_COPY=“确认启用/停用“<门店名>”？；“此操作仅改变门店资料可用状态。”；“取消”“确认”
TECHNICAL_BOUNDARY=内部状态、版本不显示
FOUNDATION_PRIMITIVE=useOverlayLock,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; all-v2/apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx@4a4d270aefd097cd6f842327439c56180af396c63c642300997fb553e5d292a5
```
```text
确认启用/停用“<门店名>”？ 此操作仅改变门店资料可用状态。 [取消] [确认]
```

## 10. 严格 screen sheets（第四组：合同与门店资料）

`H-CONTRACT`=`all-v2/apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx@7bd2bd086555904ba4a33c9350a7af8fb28a220f2bff5b1e54efacffc5a6c3e3`，原始来源 R5 D03-S01/S02/S03；`H-PROFILE`=`all-v2/apps/frontend/operations-admin/src/features/store-profile/ui/StoreProfilePage.tsx@24511b42b2f589c6034a16ae12abacd4e41c2cea7915cf949fd63e5673c1e3c9`，原始来源 D02-S07/D03-S04。

<a id="IA04-CONTRACT-PAGE"></a>
### Screen: IA04-CONTRACT-PAGE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=门店合同管理菜单
ACTOR=具有合同维护资格的运营用户
BUSINESS_SCENARIO=查找、查看或新建门店合同
BUSINESS_GOAL=定位正确合同或开始创建
USER_VISIBLE_COPY=“门店合同管理”“新建合同”；筛选“项目”“合同编号”“门店”“分期”“经营租户”“状态”“起止日期”；列“合同编号”“门店”“分期”“经营租户”“起止日期”“状态”
TECHNICAL_BOUNDARY=分页、范围、版本不显示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-CONTRACT
```
```text
门店合同管理 [新建合同] 项目 [搜索选择] 合同编号 [____] 门店 [搜索选择] 分期 [____] 经营租户 [____] 状态 [全部 v] 起止日期 [日期范围] [查询]
合同编号（链接） | 门店 | 分期 | 经营租户 | 起止日期 | 状态
```

<a id="IA04-CONTRACT-DETAIL"></a>
### Screen: IA04-CONTRACT-DETAIL
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA04-CONTRACT-PAGE 的合同编号链接
ACTOR=具有合同维护资格的运营用户
BUSINESS_SCENARIO=编辑或作废前核对合同事实
BUSINESS_GOAL=确认正确合同、当前/历史事实与获批动作
USER_VISIBLE_COPY=“合同详情”“编辑”“作废”；“合同编号”“门店”“项目分期”“经营租户”“货号”“起止日期”“状态”“备注”“更新时间”；其后按 displayOrder 升序直接显示由运维管理后台定义且当前启用的字段，字段标签由 definition 返回，缺失值显示“—”，无独立分组标题
TECHNICAL_BOUNDARY=版本和内部标识不显示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDetailDrawer,useOverlayLock,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-CONTRACT
```
```text
合同详情 [编辑] [作废]
编号 / 门店 / 项目分期 / 经营租户 / 货号 / 起止日期 / 状态 / 备注
当前启用的定义字段（按顺序直接显示，无分组标题）
```

<a id="IA04-CONTRACT-CREATE"></a>
### Screen: IA04-CONTRACT-CREATE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=IA04-CONTRACT-PAGE 已选择项目后点击“新建合同”；未选择项目时按钮禁用并提示“请先选择项目”
ACTOR=具有合同维护资格的运营用户
BUSINESS_SCENARIO=为一间门店建立立即有效合同
BUSINESS_GOAL=在正确门店、分期和经营租户下创建合同
USER_VISIBLE_COPY=“新建合同”；“项目（已选择，只读）”“门店”“项目分期”“经营租户（随门店确定）”“合同编号”“起始日期”“结束日期”“合同商品明细”“货号编码”“货号名称”“添加商品”“移除商品”“备注”；其后按 displayOrder 升序直接插入由运维管理后台定义且当前启用的字段，标签、必填与控件由 definition 返回，无独立分组标题；“取消”“创建”
TECHNICAL_BOUNDARY=经营租户不是 mutation 字段；由 contract owner 随门店在 candidate readback 中返回展示值，浏览器不反查或猜测
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-CONTRACT
```
```text
新建合同 项目（只读）[<已选择项目>] 门店 [搜索选择] 项目分期 [选择] 经营租户（随门店确定，只读） [____] 合同编号 [____]
起始日期 [____] 结束日期 [____]
合同商品明细 货号编码 [____] 货号名称 [____] [移除]  [添加商品]
当前启用的定义字段（按顺序直接插入，无分组标题）
备注 [____] [取消] [创建]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 项目 | 只读已选事实 | IA04-CONTRACT-PAGE 的 owner-returned项目选择 | 仅该项目已选择时才能打开 Drawer | 改项目必须先关闭 Drawer、清其全部草稿后从列表页重新进入 | 不可编辑、不可从 scopeRef/表行推断 | 未选项目不打开 Drawer | `GAP-CONTRACT-PROJECT-SCOPE-AUTHORIZATION` 闭合前，不得声称当前范围已由 contract owner 再验 |
| 门店 | 搜索选择 | `CandidateQuery(subjectType=门店, dependencies=[项目])` adapter 路由 contract owner readback | Drawer 有已确认 projectId | 改门店清空分期及只读租户展示值 | 仅返回该项目候选 | 失败禁下游 | 门店资格；当前任职/数据范围再验见 GAP |
| 项目分期 | 选择 | 已选门店 owner 候选 | 已选门店 | 改门店重取 | 不选历史外候选 | 空候选不可提交 | 当前门店归属 |
| 经营租户（随门店确定） | 只读展示 | contract owner candidate readback 的门店租户展示值 | 已选门店且 candidate readback 成功 | 改门店清空并重读 | 不可编辑、不可提交为 mutation | readback 缺失时不允许创建并显示“暂时无法获取门店经营信息，请重试” | command 从 store context 确定 tenantId |
| 合同商品明细 | `Form.List`，每行两个 Input | 用户输入 | Drawer 打开即保留一空行 | 末行不可删；添加/移除只改草稿 | 至少一项；编码/名称必填且编码在合同内唯一 | 行校验失败不提交 | contract owner 重验 `items[]` |

<a id="IA04-CONTRACT-EDIT"></a>
### Screen: IA04-CONTRACT-EDIT
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Drawer
HOST_AND_ENTRY=关闭 IA04-CONTRACT-DETAIL 后选择“编辑”
ACTOR=具有合同维护资格的运营用户
BUSINESS_SCENARIO=在 owner 最新快照上修订允许合同字段
BUSINESS_GOAL=更新项目分期、日期、合同商品明细或备注而不改变固定事实
USER_VISIBLE_COPY=“编辑合同”；“门店（只读）”“经营租户（只读）”“合同编号（只读）”“项目分期”“起始日期”“结束日期”“合同商品明细”“货号编码”“货号名称”“添加商品”“移除商品”“备注”；其后按 displayOrder 升序直接插入由运维管理后台定义且当前启用的字段，标签、必填与控件由 definition 返回，无独立分组标题；“取消”“保存”；冲突提示“合同已更新，请查看最新内容后重试”
TECHNICAL_BOUNDARY=expectedVersion、历史快照和内部标识不显示
FOUNDATION_PRIMITIVE=adminDrawerSurfaceProps,useDrawerFormLifecycle,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-CONTRACT
```
```text
编辑合同 门店/经营租户/合同编号（只读） 项目分期 [选择] 日期 [____]
合同商品明细 货号编码 [____] 货号名称 [____] [移除] [添加商品]
当前启用的定义字段（按顺序直接插入，无分组标题）
备注 [____] [取消] [保存]
```
| 控件 | 形态 | 候选来源 | 可用条件 | 级联 | 约束 | 状态 | owner 再核验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 项目分期 | 选择 | 合同 readback/owner | Drawer 已读合同 | 冲突后清空并回详情 | 门店/租户/编号不允许改 | 冲突不伪装成功 | 快照/版本/字段边界 |
| 合同商品明细 | `Form.List`，每行两个 Input | latest detail + 用户修改 | Drawer 已读合同 | 增删仅改草稿 | 至少一项；编码/名称必填、编码唯一 | 行校验失败不提交 | contract owner 重验 `items[]` |

<a id="IA04-CONTRACT-INVALIDATE"></a>
### Screen: IA04-CONTRACT-INVALIDATE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=Modal
HOST_AND_ENTRY=IA04-CONTRACT-DETAIL 的“作废”
ACTOR=具有合同维护资格的运营用户
BUSINESS_SCENARIO=合同需要失效但仍保留历史
BUSINESS_GOAL=明确确认作废而非删除
USER_VISIBLE_COPY=“确认作废合同“<编号>”？；“作废后保留历史记录。”；“取消”“确认”
TECHNICAL_BOUNDARY=状态版本和内部标识不显示
FOUNDATION_PRIMITIVE=useOverlayLock,useSubmissionLifecycle,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-CONTRACT
```
```text
确认作废合同“<编号>”？ 作废后保留历史记录。 [取消] [确认]
```

<a id="IA04-STORE-PROFILE"></a>
### Screen: IA04-STORE-PROFILE
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容页
HOST_AND_ENTRY=门店资料菜单；门店任职用户
ACTOR=门店运营用户
BUSINESS_SCENARIO=核对本人门店主数据
BUSINESS_GOAL=只读了解门店归属、状态和资料
USER_VISIBLE_COPY=“我的门店”；“名称”“编码”“项目”“品牌”“经营租户”“总公司”“门店状态”；其后按 displayOrder 升序直接显示由运维管理后台定义且当前启用的字段，字段标签由 definition 返回，缺失值显示“—”，无独立分组标题；无编辑控件
TECHNICAL_BOUNDARY=任职、内部标识和范围不显示
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=EXACT_COUNTERPART; H-PROFILE
```
```text
我的门店  名称 / 编码 / 项目 / 品牌 / 经营租户 / 总公司 / 门店状态
当前启用的定义字段（按顺序直接显示，无分组标题）
```

<a id="IA04-STORE-PROFILE-CONTRACT"></a>
### Screen: IA04-STORE-PROFILE-CONTRACT
```text
CONSUMER_FACE=operations-admin（运营管理后台）
UI_SURFACE=内容 Tab
HOST_AND_ENTRY=IA04-STORE-PROFILE 的“合同”Tab
ACTOR=门店运营用户
BUSINESS_SCENARIO=查看本门店合同的当前、待生效、历史、已作废事实
BUSINESS_GOAL=只读核对合同四态
USER_VISIBLE_COPY=Tab“合同”；子 Tab“当前”“待生效”“历史”“已作废”；列“合同编号”“项目分期”“经营租户”“起止日期”“状态”
TECHNICAL_BOUNDARY=版本、内部标识不显示；无创建、编辑或作废按钮
FOUNDATION_PRIMITIVE=contextScopedQueryArgs,testId
HERITAGE_COUNTERPART=PARTIAL_COUNTERPART; H-PROFILE
```
```text
合同 [当前] [待生效] [历史] [已作废]
合同编号（链接） | 项目分期 | 经营租户 | 起止日期 | 状态
```

## 11. P6 搜索与候选选择详设（2026-07-29）

`SEARCH_CAPABILITY_DENOMINATOR=9`。原始业务问题分别是 R5 `D02-S02`（在集团—大区—项目结构中定位
组织）、`D02-S03`（维护品牌、经营租户、总公司及其经营关系）、`D02-S04`（按门店主数据办理门店）和
`D03-S01/S02/S03`（按门店合同事实创建、查询、修订和作废）。这些对象不是可随意填写的技术标识；
每项查询或候选均由 organization/contract owner 的已读事实约束。详情、状态确认、只读门店资料和合同
三态 Tab 无独立搜索任务，`NOT_APPLICABLE_WITH_REASON`。

| screen / 业务对象 / 用户问题 | 条件的用户可见文案 | 匹配语义与控件形态 | 值或候选的唯一来源 | 上游级联、清理与重载 | 请求/提交 owner 核验 | 适合性与排除的替代方案 | contract 缺口或不适用处置 |
| --- | --- | --- | --- | --- | --- | --- |
| `IA04-ORG-TREE` / 集团、大区、项目 / 在三层组织中定位要查看或维护的机构 | “组织架构”树项 | owner readback `Tree` 导航；不是搜索文本框 | organization task read | 选中大区才启用“新建项目”；切选仅更新详情上下文 | organization owner 依当前范围重验读/写 | 层级和父子归属是业务事实，Tree 最能表达；输入名称会丢同名/路径关系 | 无；不得从现有门店/合同反推组织树 |
| `IA04-BRAND-PAGE` / 品牌 / 按品牌名称或状态定位维护记录 | “品牌名称”“状态” | 名称为文本 `Input`；状态为固定 `Select` | organization list query；状态为冻结业务词表 | 无级联；清空回 owner 默认分页 | organization owner 重验范围与状态 | 品牌名称是用户可键入的业务标识，状态有限；不需候选服务 | 无 |
| `IA04-TENANT-PAGE` / 经营租户 / 按名称或状态定位经营租户 | “名称”“状态” | 名称文本 `Input`；状态固定 `Select` | organization list query / 冻结状态词表 | 无 | organization owner 重验 | 同上；统一标识为展示列，未获业务/contract 支持前不擅加为条件 | 无 |
| `IA04-HEAD-COMPANY-PAGE`、`IA04-HEAD-COMPANY-BRANDS` / 总公司及可经营品牌 / 定位公司并维护其允许经营的品牌集合 | 总公司页“名称”“状态”；Drawer“可选品牌”“添加”及每项“移除” | 名称文本 `Input`、状态固定 `Select`；品牌为 owner searchable single-`Select` 加“添加”按钮 | organization list；总公司详情的品牌候选 task read 与当前授权 readback | 选择一个候选后明确点击“添加”即刻提交单条 add；每项“移除”即刻提交单条 remove；每次成功均以 owner detail readback 替换可见授权；无草稿、无保存 | 每条 add/remove command 重验总公司、品牌可用性、授权关系与引用关系 | 品牌会增长、同名可能存在且关系受授权约束，不能手填 brand id 或用全局固定表；多选草稿会恢复已退役 collection-replace 形状 | 无；候选读取失败不显示旧缓存为可提交值，失败保留 owner-confirmed 当前授权 |
| `IA04-STORE-PAGE` / 门店 / 按名称、编码、项目或状态定位门店主数据 | “门店名称”“门店编码”“项目”“状态” | 名称为文本 contains `Input`；编码为精确/contract 语义 `Input`；状态固定 `Select`；项目为 searchable `Select` | OpenAPI `getOperationsOrganizationStores` 声明 `name/code/brandId/tenantId/headCompanyId/status`，但 current `OperationsStoreManagementController.list` 只接 context/page/pageSize；项目也缺 query 与候选 task read | 项目改选清空页码并重新查；其他条件独立 | organization owner 未来必须在当前范围内应用全部条件并以同一谓词计算 total | 项目是增长型、可能同名的业务归属，必须搜索选择，不能文本；名称/编码则是用户已知检索词 | `GAP-STORE-LIST-FILTER-SEMANTICS`：必须补 controller/task-read 的 name/code/brand/tenant/head-company/status server filtering + same-predicate total；`GAP-STORE-PROJECT-FILTER`：另补 projectId + 项目候选 read。线框不把任一项假称当前可工作，禁止 client-side filter |
| `IA04-STORE-CREATE` / 新门店的项目、品牌、经营租户、总公司 / 在建立门店前选择一组真实可经营关系 | “项目”“品牌”“经营租户”“总公司” | 四项均为 owner searchable `Select`；名称/编码/备注才是文本 `Input` | 统一 `CandidateQuery` adapter 以各 subjectType + 已选项目/品牌/租户 dependencies 路由 organization owner | 先选项目和品牌；二者变更清经营租户/总公司；经营租户变更清总公司；每次重载候选 | create command 重验项目、品牌、租户、总公司之间的经营关系 | 这四项均为跨 owner 引用事实，手填会产生静默错归属；级联选择直接表达“先确定经营上下文再建门店” | `GAP-STORE-CREATE-CASCADE`：current owner candidates 仅接收 expectedContextVersion/brandId，未证明项目与租户约束。必须扩展 organization owner candidate contract；在此之前不能以客户端筛选、全量候选或自由文本冒充正确级联 |
| `IA04-CONTRACT-PAGE` / 门店合同 / 先定位项目，再依合同编号、门店、项目分期、经营租户、状态和日期定位合同 | “项目”“合同编号”“门店”“项目分期”“经营租户”“状态”“起止日期” | 项目、门店为 searchable `Select`；编号/项目分期/经营租户名称为 contract 文本 `Input`；状态固定 `Select`；日期为 `DateRangePicker` | 合同列表仍用 `getOperationsContracts` 文本 query；项目/门店选择统一经 CandidateQuery adapter，项目来自 IA02 当前数据范围 owner source，门店由 contract owner source 提供 | 未选项目不发列表请求；改项目清门店、页码和候选，再重取门店；其余条件独立；日期清空恢复默认 | `GAP-CONTRACT-PROJECT-SCOPE-AUTHORIZATION` 未闭合前，当前 contract path 不得声称已以当前任职/数据范围重验；其余 workspace/relationship facts 仍由 contract owner 复核 | 项目是 API 强制且是合同归属，必须先搜索选择；门店受项目范围约束，随项目搜索；编号/阶段/租户名是用户已知检索词，文本更合适；日期范围回答有效期间问题 | `GAP-CONTRACT-PROJECT-SCOPE-AUTHORIZATION`：必须让 workspace-IAM 提供当前可写项目 public task input，并由 contract list/candidates/create/update 同一 owner 再验；不得由 scopeRef、URL 或页面选择代替 |
| `IA04-CONTRACT-CREATE` / 新合同所归属的门店及项目分期 / 先选门店，再选择该门店可用分期 | “门店”“项目分期”“经营租户（随门店确定）” | 门店为服务端 searchable `Select`；分期为已选门店的 `Select`；经营租户只读 readback | `getOperationsContractsCandidates`，contract owner | 改门店立刻清分期和租户展示，重取门店候选事实；未选门店禁用分期 | create command 重验门店、分期和只读租户关联 | 门店/分期是合同归属事实，不能键入；租户来自门店而不是一项 mutation，避免错配 | `GAP-CONTRACT-TENANT-READBACK`：候选 readback 尚未返回租户展示值；须由 contract owner 同一 readback 补齐，禁止浏览器反查或向 command 添加租户 mutation |

## 12. 创建、编辑与确认表单事实矩阵修订（2026-07-29）

`FORM_MUTATION_DENOMINATOR=15 core create/edit variants + 7 status/void confirmations`。原始业务来源是
R5 `D02-S02`（维护集团→大区→项目及项目分期名称数组）、`D02-S03`（分别维护品牌、实际经营租户、
总公司及总公司品牌授权）、`D02-S04`（锁定项目+经营租户+品牌创建/维护/启停门店）和
`D03-S01/S02/S03`（创建立即有效合同、编辑时重选当前分期或保留历史快照、作废保留历史）。G-02、
G-04、G-06、G-08、G-09 的不得推导边界同样适用：项目分期不是组织层级，品牌授权不推门店写权，
门店停用不推合同失效，合同状态不推门店状态。

### 12.1 组织树：4 个 core variants + 2 个状态确认

| variant / 业务事实 | 用户可见控件 | 分类 | request 取值与唯一来源 | 级联、约束与 owner 复核 | 失败/恢复 |
| --- | --- | --- | --- | --- | --- |
| 新建大区：所属集团、类型、初始状态 | 集团仅在页面上下文中显示；其他不显示 | `HIDDEN_OWNER_FACT` | hierarchy owner 的商业集团 readback；endpoint 固定 REGION；owner 默认 ENABLED | 用户不能输入集团、类型或状态；owner 校验根/层级 | 读失败不开放创建 |
| 新建大区：编码、名称、备注 | Input、Input、TextArea | `EDITABLE` | 用户输入 | 仅商业集团下创建；owner 校验格式/唯一性 | 失败保留草稿 |
| 新建项目：所属大区、类型、初始状态 | “所属大区（只读）” | `FIXED_READONLY` / `HIDDEN_OWNER_FACT` | 选中大区 detail；endpoint 固定 PROJECT；owner 默认 ENABLED | 只能从大区详情进入；不能自由改父级 | 父级已变化时回树重选 |
| 新建项目：编码、名称、备注、项目分期名称列表 | Input、Input、TextArea、短列表 `+/-` | `EDITABLE` | 用户输入 | 分期每项仅名称、去空/去重、按列表顺序保存；**可以为零项**，因为当前 owner 允许空数组，G-02 只要求可维护而未规定至少一项 | owner 校验 parent/type/unique phases；失败定位到行 |
| 编辑大区：对象、商业集团、父级为空、类型、分期空、版本/proof | “所属集团（只读）”“大区类型（只读）”；其余不显示 | `FIXED_READONLY` / `HIDDEN_OWNER_FACT` | latest hierarchy detail + lifecycle | update request 必须带 `parentId=null`、`phases=[]`，不能因 UI 不展示而漏传 | conflict 回树详情 |
| 编辑大区：编码、名称、备注 | Input、Input、TextArea | `EDITABLE` | latest detail + 用户修改 | 不产生父级/分期 mutation | owner 重验 immutable 事实、版本 |
| 编辑项目：对象、商业集团、所属大区、类型、版本/proof | “所属大区（只读）”“项目类型（只读）”；其余不显示 | `FIXED_READONLY` / `HIDDEN_OWNER_FACT` | latest hierarchy detail + lifecycle | `parentId` 必须原样回传；不得用当前 data scope 或树位置猜父级 | conflict 回详情并重载整个分期列表 |
| 编辑项目：编码、名称、备注、项目分期名称列表 | Input、Input、TextArea、短列表 `+/-` | `EDITABLE` | latest detail + 用户修改 | 分期为**完整替换**；每项非空/唯一/保序，可删除至零项；项目分期改名不回写历史合同快照 | owner 重验 parent、PROJECT type、version，并原子 replace phases |
| 大区/项目启用或停用 | 名称、当前状态、“启用/停用”确认 | `HIDDEN_OWNER_FACT` | latest detail 的对象、目标动作、version + lifecycle | Modal 无可编辑业务资料；不暗示启停会改变合同或实际经营状态 | conflict/denied 回详情 |

### 12.2 经营主体、品牌授权与门店：9 个 core variants + 4 个状态确认

| variant / 业务事实 | 用户可见控件 | 分类 | request 取值与唯一来源 | 级联、约束与 owner 复核 | 失败/恢复 |
| --- | --- | --- | --- | --- | --- |
| 新建品牌：类型、初始状态 | 不显示 | `HIDDEN_OWNER_FACT` | endpoint 固定 BRAND；owner 默认 ENABLED | 不让用户选主体类型/状态 | owner 拒绝不关闭 Drawer |
| 新建/编辑品牌：编码、名称、别名、备注、受控扩展字段 | Input、Input、Input、TextArea、直接插入原生字段后的动态字段 | `EDITABLE` | 用户输入；扩展定义见 §12.4 | 别名仅品牌适用；编辑时对象/version/proof hidden | owner 以 BRAND、version 和当前 definition 无条件重验字段值；不接收规则 revision |
| 新建经营租户：类型、初始状态 | 不显示 | `HIDDEN_OWNER_FACT` | endpoint 固定 TENANT；owner 默认 ENABLED | 不混入品牌表单 | owner 重验 |
| 新建/编辑经营租户：编码、名称、**法定名称、统一社会信用代码**、备注、受控扩展字段 | Input、Input、Input、Input、TextArea、直接插入原生字段后的动态字段 | `EDITABLE` | 用户输入；法律属性的业务依据为 G-04 | 后两项必填且不是“业务编码”的别名；编辑时对象/version/proof hidden | owner 以 TENANT、version 和当前 definition 无条件重验字段值；不接收规则 revision |
| 新建总公司：类型、初始状态 | 不显示 | `HIDDEN_OWNER_FACT` | endpoint 固定 HEAD_COMPANY；owner 默认 ENABLED | 不混入品牌表单 | owner 重验 |
| 新建/编辑总公司：编码、名称、**法定名称、统一社会信用代码**、备注、受控扩展字段 | Input、Input、Input、Input、TextArea、直接插入原生字段后的动态字段 | `EDITABLE` | 用户输入；G-04 legalProfile | 后两项必填；编辑时对象/version/proof hidden | owner 以 HEAD_COMPANY、version 和当前 definition 无条件重验字段值；不接收规则 revision |
| 总公司经营品牌：总公司、现有授权、候选品牌 | 只读总公司；当前授权列表的逐项“移除”；候选品牌 searchable Select + “添加” | `FIXED_READONLY` / `CONDITIONAL_EDITABLE` | latest owner detail + authorized/candidate brand task reads | **逐条 add/remove 即时 owner command**，而非多选草稿整体保存；移除被门店引用时不可提交并说明原因 | add/remove 各自 owner 重验总公司、品牌、引用关系；失败重读该行 |
| 新建门店：项目、品牌、经营租户、总公司 | 四个 owner searchable Select | `CONDITIONAL_EDITABLE` | organization candidate task read | 先项目+品牌；变更清租户/总公司，变更租户清总公司；所有关系事实不手填 | `GAP-STORE-CREATE-CASCADE` 未闭合前不可提交：current candidate read 未证明项目/租户约束，浏览器不能补筛 |
| 新建门店：编码、名称、备注、初始状态、扩展 values | Input、Input、TextArea；状态不显示，动态字段直接插入原生字段后 | `EDITABLE` / `HIDDEN_OWNER_FACT` | 用户输入；状态 owner 默认 ENABLED；扩展见 §12.4 | G-04 的项目+租户+品牌在创建后锁定 | owner 重验四关系、状态与当前 definition 的字段值；不接收规则 revision |
| 编辑门店：项目、品牌、经营租户、**编码**、对象、版本/proof | 四项业务只读 + “门店编码（只读）” | `FIXED_READONLY` / `HIDDEN_OWNER_FACT` | latest store detail + lifecycle | 当前 edge adapter 以 latest owner detail 重取并传入固定关系/编码；浏览器不能提交或从 data scope 补写 | conflict 回 detail |
| 编辑门店：名称、总公司、备注、受控扩展字段 | Input、合规总公司 searchable Select、TextArea、直接插入原生字段后的动态字段 | `EDITABLE` / `CONDITIONAL_EDITABLE` | latest detail + owner candidate | 总公司候选必须对固定品牌有效；清总公司只能显式选择“未关联” | owner 重验固定 project/tenant/brand/code、总公司品牌授权、version 与当前 definition 的字段值；不接收规则 revision |
| 品牌/经营租户/总公司/门店启用或停用 | 名称、当前状态、“启用/停用”确认 | `HIDDEN_OWNER_FACT` | latest detail 的对象、类型、目标状态、version + lifecycle | 无编辑业务资料；门店停用不写“合同失效/停止经营” | owner conflict/denied 回详情 |

### 12.3 合同：2 个 core variants + 1 个作废确认

| variant / 业务事实 | 用户可见控件 | 分类 | request 取值与唯一来源 | 级联、约束与 owner 复核 | 失败/恢复 |
| --- | --- | --- | --- | --- | --- |
| 新建合同：项目 | “项目（已选择，只读）” | `FIXED_READONLY` | 合同列表页 owner-returned 已选项目 | 未选项目不可打开 Drawer；改项目必须关闭 Drawer、清草稿后重新进入 | **GAP-CONTRACT-PROJECT-SCOPE-AUTHORIZATION**：当前 controller/owner 只校验 workspace 与门店-项目关系，未以当前任职/数据范围作最终授权。implementation-facing design 必须让 workspace-IAM 以 public task input 解析当前可写项目，并由 contract list/candidates/create/update 同一 owner 再验；不得由 scopeRef、URL 或页面选择代替 |
| 新建合同：门店、项目分期、经营租户展示 | 门店 searchable Select、项目分期 Select、“经营租户（随门店确定，只读）” | `CONDITIONAL_EDITABLE` / `FIXED_READONLY` | contract candidate task read | 先项目后门店；改门店清分期和租户；分期必须是 owner 返回的项目分期快照候选，不能手填 | candidate/command 重验门店项目归属、租户与分期；`GAP-CONTRACT-TENANT-READBACK` 未闭合前不显示伪租户也不提交 |
| 新建合同：编号、起始/结束日期、备注 | Input、DatePicker、DatePicker、TextArea | `EDITABLE` | 用户输入 | 结束日期按 current contract 允许为空；日期由 contract owner 校验 | 失败保留非安全草稿 |
| 新建合同：商品明细 | “合同商品明细” `Form.List`，每行“货号编码”“货号名称” +/− | `EDITABLE` | 用户输入 | 至少一行；末行不可删空；编码非空、合同内唯一、名称非空；按视觉顺序提交 `items[]` | owner 重验 `{code,name}` 二元组及最小项；不得用单一“货号”或 `itemCodes[]` |
| 新建合同：状态、对象、租户 id、扩展 values、idempotency proof | 不显示 | `HIDDEN_OWNER_FACT` | status owner 默认 ACTIVE；tenant 从已选门店 owner context；extension definition readback/lifecycle | 经营租户不能提交为 mutation；合同创建立即有效但不推门店经营状态 | owner 事务内重验关系、当前 definition 的字段值与 idempotency；不接收规则 revision |
| 编辑合同：项目、门店、经营租户、合同编号、状态、对象、版本/proof | 四项只读 + 不显示 version/proof | `FIXED_READONLY` / `HIDDEN_OWNER_FACT` | latest contract detail + lifecycle | 仅 ACTIVE 合同可编辑；不能换门店/项目/租户/编号或状态 | owner 以 latest object/status/version 再验；冲突回详情 |
| 编辑合同：项目分期、日期、备注、商品明细、受控扩展字段 | Select、DatePicker、DatePicker、TextArea、Form.List、直接插入原生字段后的动态字段 | `EDITABLE` | latest detail/candidate read + 用户输入 | 可从当前候选分期重选，或保留 latest 历史快照；商品明细同创建规则；未知历史扩展值保留 | owner 重验合同固定归属、items 与当前 definition 的字段值；冲突重新读 detail 后再编辑，不接收规则 revision |
| 作废合同：对象、当前状态、version/proof | 编号与“确认作废” | `HIDDEN_OWNER_FACT` | latest detail + lifecycle | 无可编辑业务资料；作废是保留历史，不删除 | owner 仅允许正确状态转换；回详情读三态 |

### 12.4 五类实体的 definition 驱动字段：所有适用 form 的共同规则

Dexter 已裁定：业务上不存在“经营资料”或“补充资料”这类独立分组；只有**实体的扩展字段**，由运维管理后台
定义，运营管理后台在实体原生表单和详情中无感使用。因此品牌、经营租户、总公司、门店与合同的每个 create/edit
Drawer 都在原生业务字段之后，按 `displayOrder` 升序直接插入当前启用的 definition 字段，**没有分组标题**。
字段标签、required、控件类型与 SELECT 选项均由 definition 返回：`TEXT→Input`、`NUMBER→InputNumber`、
`DATE→DatePicker`、`BOOLEAN→Switch`、`SELECT→owner options Select`。同一规则也适用于 IA04-BUSINESS-DETAIL、
IA04-STORE-DETAIL、IA04-CONTRACT-DETAIL、IA04-STORE-PROFILE 的原生详情字段之后；缺失值显示“—”。已存的
未知或已停用 key/value 由 owner 保留，但因没有可用业务标签，不另造“历史资料”用户可见分组。

definition 读取不是 GAP：STORE 使用 `getOperationsOrganizationStoreExtensionDefinition`，BRAND/TENANT/
HEAD_COMPANY 使用 `getOperationsOrganizationBusinessEntityExtensionDefinition`，CONTRACT 使用
`getOperationsContractExtensionDefinition`。三个 operationId 分别覆盖五类 host type，并由对应 owner 对当前
session/context 重验；前端不得复用另一 host type 的 definition、平台缓存或显示名称。

`extensionValues` 是动态控件的 request fact；但**所有实体扩展字段写请求都不得传入 extension rule revision**。
`GAP-ENTITY-EXTENSION-REQUEST-REVISION-REMOVAL` 是 implementation-facing 关闭条件：五类 host × create/edit 的
10 条请求、edge 传递与 owner create/update CAS 必须一并移除 `extensionRuleRevision` /
`expectedExtensionRuleRevision`；owner 每次仍以提交瞬间的 current definition 无条件校验字段 key、必填、类型与
选项，并把该 definition revision 仅作为 owner readback/持久化留痕。实体自身 `expectedVersion`、关系、授权与
idempotency 复核不受影响。当前门店 create 缺 request revision 却被 edge 硬编码 `0L` 的反例属于此同一问题族，
不得反向给 request 增 revision；规则读取失败时不能提交，未知值不能用空对象静默覆盖。

本节取代 IA04 早先把三类经营实体合并为“名称、业务编码或统一标识”的表达，取代合同单一“货号”输入，
并把所有状态/作废面固定为无自由业务字段的确认动作。它不授权新增 contract、owner、前端或动态运行；
四个 `GAP-*` 是最终 implementation-facing design 的明确关闭条件。

本节的 15 个 core 和 7 个 status/void command 必须与
`doc/evidence/platform/rm1/p6/rm1-u09-form-command-variant-ledger.md` 的 C10–C12、C14–C25、S04–S10 逐条相等；
本 IA 的字段矩阵不能把同一 controller 下的不同业务 command 合并为一项。

本 IA 的项目、品牌、经营租户、总公司、门店和项目分期 searchable Select 统一使用 P6 `CandidateQuery`
consumer protocol；每一项的 `subjectType` 和已选上游 dependencies 只由 adapter 传给对应 owner public task
read。既有 `get...Candidates` 只作为过渡 adapter 后端，不能继续成为每个 Drawer 的独立前端接口；固定状态、
合同文本筛选与商品明细不属于候选搜索。所有已登记 `GAP-*` 仍按对应 owner 闭合，统一协议不补候选事实。

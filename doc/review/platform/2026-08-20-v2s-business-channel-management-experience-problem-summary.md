---
title: v2s 两个管理后台经营渠道管理体验问题与根因总结
status: RETROSPECTIVE_ANALYSIS
scope: platform-admin/external-collaboration + operations-admin/project-and-store-business-channels
date: 2026-08-20
---

# 两个管理后台经营渠道管理体验问题与根因总结

## 0. 文档定位

这是一份基于 Dexter 实际体验反馈的**问题族回溯与防再犯分析**，不是新的产品裁决、implementation authorization、reset/seed/L2/UAT 授权，也不是对某一份已有总结的质量评分。

本文回答四件事：

1. Dexter 在 `platform-admin` 与 `operations-admin` 两个经营渠道相关页面实际遇到了哪些问题；
2. 每个现象的直接缺陷、系统根因、所属责任层和同根影响面是什么；
3. 它与需求说明书、IA、UI 交互设计、implementation-facing 详设、契约/数据库、项目记忆和前后端规范的关系是什么；
4. 后续需求迭代要增加哪些最小而有效的约束，才能在进入实施前暴露同类问题。

本文把“用户看到什么”与“当前源码声称什么”分开。当前源码中已经存在若干修复后的形态（例如稳定浏览器路由、用户输入编码、内部渠道即时生效、详情/编辑分离），这些是修复证据，不代表原始体验问题不存在；原始问题仍说明需求到真实页面之间的闭环曾经断裂。

## 1. 结论先行

这不是一组零散的文案或布局瑕疵，而是五个相互关联的问题族：

| 问题族 | 核心失败 | 典型体验 |
|---|---|---|
| F1 业务任务到 UI surface 的追踪断裂 | 需求/IA 已规定“哪个入口打开哪个 surface”，实现仍按普通表格/普通 Card 组装 | 首列不进详情 Drawer；详情与编辑混用；动作不在 section header；P3 字段跑到 Tab 外 |
| F2 跨层契约与业务显示闭环断裂 | 机器枚举、中文名称、能力当前值、兼容旧数据没有形成同一条 readback 链 | 页面显示 `GROUP_BUY`；能力当前值全是 `—`；provider config 形状变化后页面崩溃 |
| F3 条件状态机被拆成了局部前端判断 | `DINE_IN`、`INTERNAL/EXTERNAL`、认证类型和生效状态没有以同一个状态矩阵实现 | 选了 POS 仍提示必填；内部渠道显示外部授权回填和草稿 |
| F4 浏览器导航、会话 scope 与 owner ref 混淆 | 把数据节点 UUID 放进 canonical browser URL | 项目/门店 URL 与其他页面不一致，URL 变成了数据 scope 选择器 |
| F5 设计期/实现期验证只证明“有代码或有文档”，没有证明真实任务闭环 | 静态材料、实现、浏览器行为和同类页面对照没有在一个有限问题分母内闭合 | 只有 Dexter 真实点页面、输入、切换、失败路径后才暴露一族问题 |

这些问题的共同根因不是“开发粗心”四个字，而是：**需求迭代时主要冻结了领域对象和后端规则，未把用户可执行的入口、surface、显示、条件字段、scope 和亲验方式作为同等规范性事实；实施时又没有把每条事实逐点传播到契约、edge、owner、generated wire、双后台、测试和浏览器证据。**

## 2. 事实范围与材料

### 2.1 Dexter 的原始体验反馈

以下按用户反馈原样归纳，不把 Codex 的事后判断当作原始输入。

#### platform-admin：外部系统接入配置

1. 系统/接入档案的“启用、停用、刷新”出现在详情内容底部，应该在详情 section 头部右侧。
2. “接入档案详情”基础 Descriptions 不应该漂在 Tab 上方，应该放到下面的“详情”Tab 内。
3. “目录标记：计划中；停用对象仍保留在列表和详情中。”这段内部解释性文字应删除；不是删除保留停用对象的业务事实。
4. 需要明确什么情况下可以“新建绑定”；Dexter 明确指出这与权限无关，而是业务/认证类型准入规则。
5. `GROUP_BUY`、`TAKEAWAY` 等技术编码直接出现在用户界面，用户看不懂；需要扫描两个管理后台，contract 中补中文名称，界面统一显示中文名称。
6. 能力属性以卡片内多段文字展示，要求改为属性/当前值/说明三列的表格。
7. 能力当前值出现 `—`，需要查明为什么没有值，而不是把空值当作正常完成。
8. 点开 provider config 后页面崩溃，说明 readback 形状变化或缺失字段没有在消费边界安全处理。
9. 外部协作页面应采用与组织概览一致的“左侧树 + 右侧详情”布局。
10. “当前集团空间的外部系统、接入档案和空间开放状态由 collaboration owner 回读。”是内部实现说明，对用户无用，应删除；布局也应重新整理。

#### operations-admin：项目/门店经营渠道

11. 新建模板时选择 `POS`，明明已经选对，却仍提示“请选择到店点餐形式”。
12. “到店渠道只能使用内部接入。”这段说明没有帮助，应删除；规则本身仍必须保留在前后端校验中。
13. 项目页大标题“项目经营渠道管理”与 Tab 重复，应去掉重复标题。
14. section 文案“经营渠道”应改为“项目主体经营渠道”，“渠道模板”应改为“经营渠道模板”。
15. 页面整体不符合前端操作规范；表格第一列应点击进入详情抽屉，且详情和编辑必须是两套标准 Drawer。
16. 两个经营渠道页面曾使用 `/operations/aurora/projects/<uuid>/business-channels` 这类把数据节点 UUID 放进浏览器路由的形式，与其他页面不一致。
17. 渠道模板缺用户手填的模板编码、列表缺模板编码列；编码必须在项目内判重，创建后不能改。
18. 渠道第一列应为渠道名称，点击名称进入详情；当前第一列却是“待生成”的渠道编码。
19. 渠道编码显示“待生成”，但要求用户创建时手填、判重、创建后不能编辑。
20. 内部接入渠道却显示“待外部授权回填”，这是外部接入语义污染内部渠道。
21. 内部接入渠道显示“草稿”，但内部渠道不依赖 binding，创建后应立即生效。

### 2.2 主要规范性材料

- 原始/冻结需求：`doc/review/platform/2026-08-13-v2s-business-channel-requirements-final-claude.md`、`doc/review/platform/2026-08-18-v2s-external-platform-collaboration-and-business-channel-requirements-claude.md`、`doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md`。
- 旅程与 IA：`doc/decisions/2026-08-19-v2s-business-channel-management-journey.md`、`doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md`、`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md`。
- UI 交互：`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md`。
- 实施详设与计划：`doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md`、`doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md`。
- 前后端规范：`doc/platform/frontend-coding-standard.md`、`doc/platform/backend-coding-standard.md`。
- 既有复核：`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-1-verdict.md`、`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-2-verdict.md` 及对应 author intake/Claude review。

### 2.3 当前源码对照入口

- platform-admin：`apps/frontend/platform-admin/src/features/external-collaboration/ui/ExternalCollaborationPage.tsx`、`ExternalSystemDetail.tsx`、`ProviderProfileDetail.tsx`、`OwnerBindingList.tsx`、`OwnerBindingDetailDrawer.tsx`、`OwnerBindingFormDrawer.tsx`。
- operations-admin：`apps/frontend/operations-admin/src/features/business-channel/ui/ProjectBusinessChannelPage.tsx`、`StoreBusinessChannelPage.tsx`、`BusinessChannelList.tsx`、`BusinessChannelTemplateDrawer.tsx`、`BusinessChannelCreateDrawer.tsx`、`BusinessChannelDetailDrawer.tsx`、`BusinessChannelEditDrawer.tsx`、`BusinessChannelBindingDrawer.tsx`。
- backend/契约：`apps/backend/catering-business-server/modules/businesschannel/.../BusinessChannelPolicy.java`、`.../BusinessChannelOwnerService.java`、`apps/backend/catering-business-server/modules/collaboration/.../CollaborationBindingPolicy.java`、两个 edge controller/wire mapper、`contracts/openapi-source/collaboration.schemas.json`、`contracts/openapi-source/business-channel.schemas.json`。

## 3. 逐项问题、根因与规范关系

状态说明：

- `CONFIRMED`：用户现象与需求/源码链路均可对上。
- `PARTIALLY_CONFIRMED`：现象确定，但原始失败版本已经被后续修复覆盖，不能凭当前源码武断还原旧行号。
- `REJECTED_WITH_EVIDENCE`：目前证据不支持该归因。
- `UNVERIFIED_REQUIRES_EVIDENCE`：需要实际浏览器/运行证据才能闭合。
- `DEXTER_DECISION`：产品语义不能由实现者替代裁决。

### 3.1 platform-admin 问题

| ID | 用户看到的现象 | 直接缺陷 | 根因层 | 规范/材料关系 | 结论与修复边界 |
|---|---|---|---|---|---|
| P-01 | 启用/停用/刷新在详情底部 | action 没有挂在详情 Card 的 `extra`/section header | IA→实现 surface 映射断裂 | IA P2/P3、交互 P2/P3 明确“详情面板内提供启停控件”“header action”；详设 CP-05 要求详情 action 在 header `extra` | `CONFIRMED`。动作语义不变，只移动到用户识别的详情头部；不要把动作放回普通内容流 |
| P-02 | provider 基础详情在 Tab 外 | P3 的事实区与 Tab 容器分离 | 设计层把“内容页 Tab”误实现成“Tab 下方附加内容” | IA P3 的 `UI_SURFACE=内容 Tab`；交互 Screen P3 明确默认“详情”Tab和“绑定关系”Tab | `CONFIRMED`。基础 Descriptions 进入详情 Tab；绑定关系仍只在绑定 Tab |
| P-03 | 停用/计划中解释性句子无用 | 把内部治理解释直接暴露给用户 | 领域事实、用户文案、实现说明没有分层 | BR-13/14要求停用对象不删除/不隐藏；交互 P2/P3只要求状态/信息标记，不要求展示“停用对象仍保留…”内部解释 | `CONFIRMED`。保留“计划中/已停用”等业务事实，删除实现解释；不能误删历史可读性 |
| P-04 | 不知道何时可以新建绑定 | 入口显示条件/认证类型准入没有清晰落实 | 将“权限可见性”和“业务状态机准入”混成一件事 | BR-10/11/12、UC-04、IA P4/P6；P4规定仅启用且 `INTERNAL_MAPPING`/`NO_MAPPING` 可新建，`EXTERNAL_GRANT` 由外部授权流程创建 | `CONFIRMED`。这是业务 admission，不是简单 role permission。platform 只允许非外部授权 binding 的新建/编辑；`EXTERNAL_GRANT` 仅详情和删除/解绑相关操作 |
| P-05 | 只显示 `GROUP_BUY` 等编码 | contract/readback 有 code 但没有可靠 display projection，或 UI直接渲染 code | 跨边界 string/display agreement 未闭合 | 需求 §8、BR-38；IA P2/P3/P4/O1/O4 要求业务标签；详设 CP-01/CP-05 的 `*DisplayName` 与 descriptor `label/helpText`；前端能力表已有 `NameCodeText`/descriptor renderer | `CONFIRMED`。机器值仍用于提交和匹配，用户可见处统一用 owner/contract readback 的中文名称；两 app 不能各自造第二份 label map |
| P-06 | 能力属性不是三列表格 | 以 capability 卡片内段落拼装，而不是 `属性/当前值/说明` 表 | IA 的可见几何没有成为实现验收项 | 交互 P2 的三列表格草图；详设能力 descriptor 明确 `label/helpText/attributeValueLabels` | `CONFIRMED`。不是单纯 CSS 问题，必须按 descriptor 行渲染，并保持“无属性”和“有属性但当前值缺失”两种状态 |
| P-07 | 能力当前值全是 `—` | readback 未提供/未正确映射 `attributeValueLabels`，或 fixture 没有对应 attribute values | contract/readback/fixture/UI 的 display-value 链断裂 | 详设 CP-01：当前值来自 `capabilities[].attributeValues` 与 `attributeValueLabels[fieldKey]`；缺失才允许显示 `—`，不能回退机器字面量 | `CONFIRMED`（空值体验）；具体首个断点需以运行 readback/fixture 定位。`—` 只有在 owner 明确无值时才是合法结果 |
| P-08 | provider config 一点就崩 | consumer 假定新 readback 字段始终存在，缺少兼容的空/缺字段处理 | 读契约演进没有在 generated→mapper→UI 边界形成安全降级 | IA/详设要求 typed problem、旧 readback 保留、display name 缺失显示 `—` 且不显示 token/UUID；`claim-versus-behavior`要求打开真实读写路径 | `PARTIALLY_CONFIRMED`。崩溃现象确定；当前源码已有大量 optional fallback，不能臆造旧版本具体异常行。Claude需独立检查所有 provider/system/binding readback consumer |
| P-09 | 页面不像组织概览的左树右详情 | 外部协作页面没有复用组织概览的主从布局形态 | 先按领域自建页面壳，没有先查仓内前端能力和既有样板 | IA P1、交互 P1 明确使用 `platform-master-detail-layout`；前端能力记忆指定 `PlatformReadPage.tsx` 为树+详情样板 | `CONFIRMED`。应复用 layout/foundation，不合并两个 app 的 shell/theme |
| P-10 | 页面上出现“由 collaboration owner 回读”等内部说明 | 把 owner/控制面说明当成用户任务描述 | owner 边界反向污染用户界面 | IA P1/P2/P3 的 `BUSINESS_TASK/BUSINESS_GOAL` 是用户任务；`TECHNICAL_BOUNDARY`明确技术事实不作为用户可见技术名；`owner-boundary-reverse-inference`要求后台 owner 不外化为用户成本 | `CONFIRMED`。删除内部 owner 旁白，保留真实业务标签、状态和错误；不能因为删文案而删 owner 约束 |

### 3.2 operations-admin 问题

| ID | 用户看到的现象 | 直接缺陷 | 根因层 | 规范/材料关系 | 结论与修复边界 |
|---|---|---|---|---|---|
| O-01 | 选择 POS 仍提示请选择到店点餐形式 | 字段值没有被当前 Form validation 识别，或条件字段清理/校验时序与提交值不一致 | 条件字段没有按一个完整状态机实现 | BR-06/07；需求规定 `DINE_IN` 必须 `INTERNAL` 且 `dineInForm` 必填；交互 O2要求选择到店形式；详设 CP-03/CP-05 和后端 `BusinessChannelPolicy`同时约束 | `PARTIALLY_CONFIRMED`。用户误报不是规则错误；当前源码已将 Form.Item name、提交字段和后端 policy 对齐，但原始失败版具体断点需 Claude按源码/浏览器复验。正确修复不是删除必填规则，而是修复值生命周期并保留正反例 |
| O-02 | “到店渠道只能使用内部接入”说明无用 | 表单中加入解释性 Alert，而不是让选项和错误指向表达规则 | 将内部实现/规则旁白混进操作表单 | BR-06仍必须存在；IA O2 的 `validationAndError` 要求 typed problem；交互 O2要求用户选择合法组合，不要求重复解释 | `CONFIRMED`。删除 Alert，不删除 Radio 禁用、字段联动和后端拒绝 |
| O-03 | 项目页标题与 Tab 重复 | page shell、content tab、feature heading 都声明同一 page identity | 页面 catalog/Tab/page body 的 copy ownership 未提前定清 | 前端规范的用户可见 shell/catalog 扫描、IA O1 `USER_VISIBLE_COPY`；应确定一个页面身份承载处，其余只表达 section | `CONFIRMED`。删除重复层级，不改变 Tab 路由或 pageDesignKey |
| O-04 | “经营渠道”“渠道模板”文案不符合用户任务 | section copy 未按 IA 的准确业务主体命名 | IA 到 copy 的逐字传播漏项 | IA O1与交互 O1明确“经营渠道模板”“项目主体经营渠道”；用户反馈正好命中 IA 规定的词 | `CONFIRMED`。这是业务语义而非个人偏好；项目页与门店页必须分别体现 PROJECT/STORE 主体 |
| O-05 | 首列没有按标准进入详情；详情/编辑不是两套标准 Drawer | 表格入口、详情 surface、编辑表单 surface 的职责混在页面实现 | 没有把 `entryAndSurface`、`HOST_AND_ENTRY` 和 foundation primitive 作为实现硬约束 | IA O1/O3/O4/O5；交互 O1/O3/O4/O5；详设 CP-05明确“详情 action 在 header extra”“详情与表单独立 Drawer”；前端能力表有 `useDetailDrawer`、`adminDrawerSurfaceProps`、`useDrawerFormLifecycle` | `CONFIRMED`。首列名称进入只读详情，详情内的编辑再开独立表单；不能用“详情里嵌表单”替代，也不能把表格操作列当详情入口 |
| O-06 | 项目/门店 URL 携带数据节点 UUID | canonical browser route 使用 `projects/:scopeRef`/`stores/:scopeRef` | 把 browser page identity、WorkspaceScope data scope、API owner ref 三种 ref 合并 | 前端规范 §3-H、后端规范 §2-G、IA O1/O5、交互 O1/O5；项目记忆 `browser-route-data-scope-drift`已记录此实例 | `CONFIRMED`。正确形态为 `/operations/:groupWorkspaceKey/business-channels/project|store`；API 仍可用 `/projects/{projectRef}`、`/stores/{storeRef}`，不能连 API 一起改成无 owner ref |
| O-07 | 模板没有用户手填模板编码/列表列 | 数据模型、wire、表单、列表没有同时承载 `templateCode` | 将系统 identity/技术 ref 当成业务编码，或只实现名称字段 | 需求 §5.8、UC-05；IA O1/O2；详设 CP-03/CP-05；migration `V...003`与 owner policy均要求用户输入、scope uniqueness、immutable | `CONFIRMED`。模板编码项目内判重；创建后 immutable；历史空值只能兼容显示 `—`，不能伪造“待生成” |
| O-08 | 渠道第一列是“待生成”，渠道名称不在第一列 | list column order 与 entry contract 不一致，编码被当作默认技术主键 | 业务 identity、展示名称、详情入口没有在 IA 中形成同一列顺序 | 需求 §5.9；IA O1/O3/O4；交互 O1草图固定“渠道名称、渠道编码、来源模板、状态、绑定状态” | `CONFIRMED`。渠道名称第一列且可点击进入详情；编码独立第二列；空历史编码显示 `—` |
| O-09 | 渠道编码应用户手填、判重、只能新建不能改 | create/edit surface没有分开不可变字段 | 只在表单层做了“自动生成/可编辑”的默认假设，未下沉到 owner/DB concurrency | 详设 §0.4、CP-03明确 `DUPLICATE_CODE`、DB unique index、创建后不可变；migration `V...003`；`BusinessChannelCreateDrawer`与`BusinessChannelEditDrawer`应各自只承载允许字段 | `CONFIRMED`。渠道编码按集团空间判重；重复由 owner typed problem 返回；不能依赖前端预查代替数据库并发唯一约束 |
| O-10 | 内部接入被显示为“待外部授权回填” | 外部 `EXTERNAL_GRANT` 状态说明被无条件套到内部渠道 | accessKind/authenticationKind 分支不在展示/状态模型的同一判定点 | BR-09/10/12；IA O4 stateAndPermission；详设 CP-03明确内部不显示外部授权占位 | `CONFIRMED`。内部渠道外部主体编号显示 `—`；外部授权回填只属于 `EXTERNAL_GRANT` |
| O-11 | 内部接入显示“草稿” | 使用了外部渠道的 binding-effective gate，未先按 accessKind 分支 | 渠道状态机和 binding 状态机耦合错误 | 需求 BR-09、UC-06；详设明确 `INTERNAL` 创建即 `EFFECTIVE`，`EXTERNAL` 只有有效 binding 才生效；migration `V...004`修复历史安全遗留行 | `CONFIRMED`。内部渠道无 binding 也能生效；外部渠道仍必须等待有效 binding，不能为了修内部状态放宽外部门槛 |

### 3.3 验证闭环问题

| ID | 复盘结论 | 根因 | 证据关系 |
|---|---|---|---|
| V-01 | 设计文档写了很多可见形态，但实现早期仍漏了首列、Tab、header action、中文展示 | 设计审查偏重文档内一致，未把每个 screen 的 `HOST_AND_ENTRY/UI_SURFACE/USER_VISIBLE_COPY/LAYOUT_GEOMETRY` 做成逐点浏览器验收 | IA/交互文件已经给出这些事实；`phase-retrospective-and-systemic-repair`要求 IA reconciliation 必须证明 user-observable controls，静态存在不能代替 physical screen |
| V-02 | 需求、详设、契约、源码和运行数据对同一字段的含义曾不一致 | 缺少“字段/状态/枚举/文案/入口/正反例/证据”逐行传播矩阵 | `invisible-dimension-drifts-at-implementation`指出不可见维度要写成可执行观察；`cross-boundary-string-agreement`指出跨边界字面量必须有单一来源 |
| V-03 | 已有组织概览、foundation Drawer、NameCode/descriptor能力没有在早期实现中完全复用 | 实施前没有按意图查 capability，先按当前页面白纸组装 | `designing-from-conversation-not-system`与`frontend-capability-lookup`均把“先查现有能力”作为动作，不是口头提醒 |
| V-04 | implementation review 已抓到部分 scope/contract/surface 缺口，但用户仍能在浏览器发现交互问题 | review 的静态边界与真实体验边界不同；“有组件/有 testId/有文档”不能证明用户操作成立 | `claim-versus-behavior`；既有 implementation review 明确“没有 browser L2”时不能作真实 UI 行为结论 |

## 4. 根因分层：为什么会出现这组问题

### 4.1 产品/需求层：定义了领域事实，未把体验事实同等冻结

需求已经明确了很多关键业务规则：`DINE_IN` 必须内部、外部渠道要 binding 才生效、平台类别决定 binding 创建方式、模板/渠道编码的业务意义、停用对象保留历史事实、能力目录 `PLANNED` 不是启用门槛等。

但对实施最关键的体验事实分散在后续 IA/交互文档中，没有在需求迭代的同一事实表里与以下字段一起冻结：

- 入口：点击哪一列/哪一个按钮；
- surface：页面、Card、Tab、只读详情 Drawer、编辑表单 Drawer；
- 显示：机器值、中文名称、空值、历史兼容；
- 条件：字段出现/隐藏/清理/必填/提交/错误后的状态；
- scope：browser route、session scope、API owner ref 各自来源；
- 亲验：用什么具体输入和屏幕行为证明它成立。

因此需求“正确”并不自动保证页面“正确”。后续 IA 说明了这些事实，但没有形成一个跨层逐项传播、实施前对账、浏览器验收的有限清单。

### 4.2 设计层：IA 维度存在，但同一事实在多份设计中没有成为不可漂移的原子

IA O1 已写明稳定 route、两张 bounded table、名称首列进入只读详情、详情编辑进入独立表单；IA P3 已写明详情 Tab；交互工件也有三列表格和布局草图。问题说明“文档中有”仍不够：

- `UI_SURFACE` 和 `HOST_AND_ENTRY` 没有被实现 review 逐条核对；
- `USER_VISIBLE_COPY` 与 contract `*DisplayName` 没有统一成为同一条 readback 事实；
- 条件状态机没有在 IA 中用“条件组合→控件→清理→提交→状态→错误→验证”完整表达；
- route 事实在 IA、page registry、OperationsApp、API path 和 edge scope recheck 之间没有一开始就做三种 ref 分离表。

这正是 `invisible-dimension-drifts-at-implementation`描述的失败：能打开页面看见的部分可能被实现，不能直接看见的边界（scope、readback shape、状态判定）更容易留到后期。

### 4.3 契约/owner 层：状态和显示投影曾分裂

同一个业务事实需要同时穿过：owner readback → edge mapper → OpenAPI → generated Java/TS → 前端 renderer。此次问题暴露出三种分裂：

1. enum literal 有，但显示名称没有或 UI 自己反推；
2. descriptor 有，但当前值没有随 readback/fixture 形成闭环；
3. access kind、authentication kind、binding status、channel status 各自正确，却没有在同一个 owner policy/state matrix 中决定最终页面状态。

后端现有修复已体现最小正确方向：`BusinessChannelPolicy`集中判断 `DINE_IN`、`INTERNAL/EXTERNAL` 和 binding；`BusinessChannelWireMapper`输出 `*DisplayName`；`V...003`支持用户输入编码及唯一索引；`V...004`修复可安全修复的历史内部草稿。它们说明根因不是“页面多写几个 if”可以解决，而是事实必须由 owner/contract 先闭合。

### 4.4 前端实现层：页面局部方便性压过了仓内既有形态

早期实现表现出几个实现倾向：

- 用普通 Card/body 拼 action，而不是 `extra`/标准详情 surface；
- 用普通 Table 默认第一列和操作方式，而不是按 IA 入口绑定详情 Drawer；
- 在页面内直接渲染 enum code 或解释性 Alert；
- 用页面/URL参数推导 scope；
- 将详情和编辑共享一套状态或把编辑入口放错层；
- 条件字段由局部 `onChange` 修补，而不是与后端同一状态矩阵。

这些做法单独看都能编译、也能显示一部分数据，但会同时破坏用户任务、跨层一致性和后续可验证性。它们也违反“先查现有前端能力”的记忆动作。

### 4.5 验证层：没有在进入实现前建立“用户问题族分母”

本批后来出现的反馈不是一个页面上的一个点，而是两个 app、至少 21 个现象、五个根因族。若验收只列“页面能打开、接口返回 200、组件文件存在”，就不会覆盖：

- 两个 app 的所有 code/display consumer；
- PROJECT/STORE 两个相似页面；
- P2/P3/P4/P5/P6/O1/O2/O3/O4/O5 所有 entry/surface；
- 正常、空值、旧数据、停用、内部、外部、EXTERNAL_GRANT、PLANNED、条件字段切换等状态矩阵；
- URL 改动后 session scope 是否仍正确。

正确的验证不是增加一个更大的合规台账，而是把上述问题族拆成有限的可操作场景，再对源码、契约、focused test 和浏览器行为各自取证。

## 5. 需求、IA、详设、规范、记忆之间的关系矩阵

| 事实 | 需求/BR/UC | IA/交互 | implementation-facing 详设 | 规范/项目记忆 | 应有证据 |
|---|---|---|---|---|---|
| `DINE_IN` 只能内部且 POS/QR/KIOSK 必填 | BR-06/07、UC-05 | IA O2、交互 O2 | CP-03、CP-05；policy + DB + form | 条件字段不能只写属性，必须是可执行观察 | 选择 POS 后保存成功；清空 POS 必须失败；改成非 DINE_IN 清除字段 |
| 外部档案候选与 binding admission | BR-03/04/10/11/12、UC-04/06 | IA P4/P6、交互 P4/P6 | CP-02/04/05 | owner boundary 不等于 permission；平台与运营 consumer face 分离 | enabled + INTERNAL_MAPPING/NO_MAPPING 可新建；EXTERNAL_GRANT 平台无新建；非 bindable node 拒绝 |
| 技术枚举/能力值显示中文 | §8、BR-38、UC-01 | IA P2/P3/P4/O1/O4、交互三列表格 | CP-01/05 display projection | `cross-boundary-string-agreement`、`DEV_SEED_DISPLAY_LABEL_MUST_NOT_DERIVE_FROM_TECHNICAL_KEY` | contract label/helpText 非空；两端页面无裸 enum；当前值来自 readback，不靠 key 推导 |
| provider 三列表格与缺值处理 | 能力 descriptor 规则 | 交互 P2、IA P2 | CP-01 descriptor mapping | `claim-versus-behavior`、不可见维度记忆 | 有值显示中文；无值显示 `—`；缺字段不崩；无属性显示空态 |
| 停用对象保留但不可编辑 | BR-13/14/26/31/32 | IA P2/P3/O4、交互状态说明 | CP-02/03/05 | 业务事实与内部说明分离 | 停用后仍在列表/详情；编辑和删除禁用；解释性旁白不出现 |
| 详情与编辑两种 Drawer | UC-01/04/05 | IA O1/O3/O4/O5、交互 O1/O3/O4/O5 | CP-05 | `frontend-capability-lookup`、foundation 对接 | 首列名称→只读详情；详情 header action→独立编辑表单；脏表单/overlay 生命周期正确 |
| browser route 与 data scope 分离 | G-10、O1/O5 | IA O1/O5、交互 O1/O5 | CP-04/05 | frontend §3-H、backend §2-G、`browser-route-data-scope-drift` | canonical URL 不带 project/store UUID；旧 URL只迁移不回填 scope；跨节点访问被拒绝 |
| 用户输入业务编码 | §5.8/5.9、UC-05/06、BR-15/19/26 | IA O1/O3/O4 | CP-03/05、migration | `cross-boundary-string-agreement`、并发唯一性原则 | create 表单输入；list/detail显示；重复 typed `DUPLICATE_CODE`；edit 不可改；历史空值只读 `—` |
| 内部即时生效/外部 binding 生效 | BR-09/10/12、UC-06/07 | IA O4/O5 | CP-02/03 | owner state machine、跨 owner command/同一 REQUIRED 事务 | 内部无 binding=EFFECTIVE；外部无有效 binding=DRAFT；历史安全内部草稿 repair；两类占位文案不串 |
| 页面标题/section 文案 | 业务语料与 UC | IA `USER_VISIBLE_COPY`、交互 O1 | CP-05 | shell/catalog copy ownership、避免技术说明外泄 | 页面 identity 只出现一次；section 文案分别为模板/项目主体/门店主体 |

## 6. 最小防再犯方案：后续需求迭代应改变什么

目标不是重新引入已退役的控制面，也不是为每个编辑动作增加一套台账。只增加以下十类“能被下一位实施者直接使用、能被 review/浏览器直接核对”的材料。

### R-01 需求条目必须同时冻结六种事实

每个新字段、状态或页面能力都必须有同一行的：

`业务目的 | owner | 用户入口 | UI surface | 正常/空值/失败状态 | 契约 read/write | 唯一性/不可变/范围 | 亲验动作`。

只写“有一个 providerCode/有一个状态”而不写“用户在哪里看到、何时能提交、哪个状态能操作”不得进入实现详设。

### R-02 建立一张需求→实现传播矩阵

每个事实至少有以下链路：

`requirements BR/UC → IA screen 九维度 → UI interaction screen → implementation CP → contract/OpenAPI → owner/edge → generated wire → platform-admin/operations-admin consumer → focused test → browser scenario`。

同一事实在多份文档中出现时，要求每层写出本层具体值；不能用“见上文”让实施期自行弥合。

### R-03 route/scope 三分表作为前端页面准入项

每个页面在 IA 和详设中同时写清：

- browser route：只定位 app/page/workspace；
- WorkspaceScope/queryContext：唯一数据节点选择来源；
- API owner ref：资源读写所需的 ref，由 edge 重新授权。

必须有一个负例：把另一个 project/store UUID 塞进旧 URL，页面不能把它当作当前 scope。API 路径保留 owner ref 不算 route 漂移。

### R-04 显示契约与业务 code 契约一起设计

每个跨边界 enum/attribute/状态至少声明：

`machine value | displayName/label | helpText | 空值语义 | old readback 兼容语义 | 使用方`。

前端禁止为 contract 已有字段重新维护 label map；contract/edge readback 未提供中文名称时，不能先写 UI code fallback 再补契约。

### R-05 条件字段必须用状态矩阵，而不是一句“联动”

对 `accessKind × orderKind × dineInForm × authenticationKind × bindingStatus` 列出：

`显示 | 可选 | 自动清理 | 必填 | 提交值 | 后端 typed problem | 最终业务状态`。

至少包含 `DINE_IN+POS`、`DINE_IN+空`、`DINE_IN+EXTERNAL`、`TAKEAWAY+旧 dineInForm`、`INTERNAL+无 binding`、`EXTERNAL+PENDING`、`EXTERNAL_GRANT+平台新建` 等正反例。

### R-06 每个列表先定义入口列和两种 Drawer

在 IA 的每张表格旁固定写：

`第一列/点击对象 → 只读详情 Drawer → header action → 独立编辑表单 Drawer → 保存后回读`。

模板、渠道、绑定分别定义，不能用一个通用“详情/编辑”描述覆盖三者。实现前必须先查 foundation 和仓内同形页面。

### R-07 业务 identity 不能被技术 identity 代替

每个业务编码必须在需求阶段写清：输入方、生成/输入时机、判重 scope、不可变性、历史空值、并发唯一性、错误码和 list/detail 展示位置。前端预查只能改善体验，不能代替 owner + DB 唯一约束。

### R-08 把“同类页面扫描”写进交付范围

新增项目页面时，最小 sibling denominator 至少包括门店对应页、同 app 的组织概览样板、另一 app 的相同业务事实消费者、共享 foundation 能力。扫描项不是“看起来像不像”，而是：route、scope、title、section copy、first-column entry、detail/edit Drawer、状态动作、display labels、空态、error、refresh。

### R-09 设计验收增加用户可执行正反例

每个 screen 至少有一条可复现动作和一条反例：

- P2：属性三列、有值/空值、provider 缺字段不崩；
- P4/P6：不同认证类型的新建/编辑/删除入口；
- O1/O2：POS保存、错误提示、内部即时生效、外部等待 binding；
- O3/O4/O5：首列进入详情、详情编辑、停用对象可读不可改；
- 两页：canonical route、旧 URL迁移、跨节点拒绝。

静态 `PASS` 只能说明形态存在，不能替代这些浏览器行为证据。

### R-10 Claude/独立 review 必须问“如何防复发”

后续每次需求迭代的独立评审 brief，除“找问题”外固定增加：

1. 本次问题族的有限分母是什么；
2. 哪些是需求缺失、IA 漂移、契约缺失、owner 状态错误、前端实现错误、数据/fixture 错误或验证缺失；
3. 每个根因应落到哪个最小防线：需求模板、IA、详设矩阵、规范、project-memory、focused test 或浏览器场景；
4. 给出一个能打红的反例，而不是只提出“加强检查”。

这正是本次 Claude handoff 的任务，且不是请 Claude 评价本总结写得好不好。

## 7. 2026-08-20 外部协作与内容 Tab 追加问题族

Dexter 在同一轮继续体验后补充的九项问题，归入既有 F1/F2/F5，而不是另起一套局部修复清单：

| 追加现象 | 根因归属 | 当前根因修复方向 | Testcontainers/浏览器反例 |
|---|---|---|---|
| 目录商品页的树表视图能力需统一；外部协作启停不应使用 Switch/radio | F1：共享交互形态未按业务动作区分；视图切换与实体命令混淆 | 目录视图切换保持纯展示状态；外部系统/provider 启停改为标准按钮+确认，owner 命令不变 | 切换视图不发无关读请求；启停前确认且成功后 owner readback 状态改变 |
| 绑定关系搜索项未拆开，分页/排序不标准 | F1/F5：自定义 Table 绕过 ProTable、服务端 Page 与统一刷新生命周期 | P4 使用 ProTable，绑定名/节点名独立搜索，服务端分页/排序，`scroll.x` | bindingName 与 nodeQueryText 各自命中不同记录；sort/page metadata 与真实 SQL 读回一致 |
| 绑定详情 Drawer 过宽、操作在正文底部 | F1：详情 surface 与表单 surface、header action 未按 foundation 区分 | 使用标准窄 detail Drawer，实体操作进入 Drawer `extra`；编辑仍用独立 form Drawer | 打开详情的几何/动作位置与标准详情 Drawer一致；刷新不清空详情 |
| P3 基础详情和绑定 Tab 的层级不清 | F1：Tab 被实现为内容后附加区 | 基础 Descriptions 归入详情 Tab，绑定 Page 归入绑定关系 Tab | 两个 Tab 的读模型独立且刷新覆盖各自内容，不出现重复事实 |
| 绑定业务列显示 `—`、内部绑定显示“待外部授权回填” | F2：`capabilityClass` 空值语义未由 owner readback 完整表达；前端按 null 统一翻译 | contract/owner 返回 `businessScopeDisplayNames`；按 `authenticationKind` 显示主体空值语义 | INTERNAL_MAPPING/NO_MAPPING 无 capabilityClass 但显示 provider 中文业务；NO_MAPPING 显示无需映射，EXTERNAL_GRANT 才显示待回填 |
| 内容 Tab 的刷新未覆盖所有命令式读模型 | F5：Shell 刷新只依赖 RTK invalidation，未纳入 imperative read lifecycle | 两个 App 导出 content-tab refresh signal；页面/列表/打开详情用 foundation `useRefreshVersion` 订阅 | 真实变更后点击“刷新当前页”，列表、排序 Page、详情均回读，脏表单保持 |
| 后端绑定 Page 的查询/排序缺少真实业务验证 | F5：静态字段/Controller 存在不等于 owner SQL 语义闭合 | acceptance 增加独立搜索、排序/分页、显示名和认证类型负例；运行真实远端 Testcontainers | CONTRACT/BUSINESS 分离；失败首次信号来自日志；cleanup 单独 PASS |

### 7.1 后端 acceptance 本身也暴露了三类验证根因

本轮加强 Testcontainers 时，除了真实的 disabled-store 创建授权缺口，还发现了三种会让测试“看起来在测，
实际上没有测到目标”的问题：

1. **嵌套资源路由身份错误**：binding page 场景曾漏掉 provider 下的 `/owner-bindings` 子资源段，命中了
   provider detail endpoint。HTTP 仍为 200，因此只看状态码会把错误资源当成空绑定列表；这属于测试 route/operation
   组装缺陷，不是 provider owner 读模型本身的结论。修复要求核对 exact path、`routeTemplate`、`operationId` 和
   `items/metadata` 响应形状。
2. **夹具未到达目标策略**：adapter 解绑场景曾漏传生产必填 `channelCode`，请求在通用校验层以 422 结束，尚未
   进入 adapter 的解绑约束。补齐真实必填字段后，场景才实际证明 adapter-unbind-required。
3. **断言对象混淆**：跨节点拒绝断言曾对完整 problem JSON 搜索目标 UUID；公开 `instance` 定位 URI 合法包含
   该 UUID，造成假失败。修复为移除 transport `instance` 后再判断业务字段，仍保留敏感业务数据不可泄漏的断言。

这三类问题的共同根因不是“测试多写几条”即可解决，而是 acceptance 缺少 route identity、fixture reachability
和 business-oracle 三件事的分层。现已固化为 `project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md`：
每个场景必须证明命中正确资源、已到达目标规则、断言只针对业务事实；短路径、删除必填字段和把 `instance` 当业务
数据的三个反例都必须能打红。它与本轮真实生产缺陷严格区分：disabled Store 创建原先确实被正常 owner scope
拒绝，现已通过仅允许 Store target 的窄化 disabled-target policy 修复。

全量受管 Testcontainers 回归结果：`r5-tc-1787189731901-38760`，60/60 场景
`CONTRACT=PASS`、`BUSINESS=PASS`、`HTTP_SUCCESS=60`、`REAL_BUSINESS_ASSERTIONS=60`、`STUB_ONLY=0`，
并且 remote process、Testcontainers containers、volumes、workspace cleanup 全部 PASS。该证据证明当前 acceptance
覆盖已真实执行，不把静态场景数量当作后台行为通过。

这组追加问题的共同边界：目录商品页的 segmented control 是显示视图选择，不应被误改成“刷新/过滤”；
启停按钮是实体命令，不能用 radio 语义表达；`—` 只有 owner 明确没有该事实时才是合法空值，不能作为
契约缺字段和错误认证语义的兜底。追加问题不改变既有 BR/IA 的业务裁决，只要求把已定事实贯通至同一
readback、surface、刷新和真实 HTTP acceptance。

## 8. 不应误修的边界

- 修正浏览器 route 不等于删除 API 的 `/projects/{projectRef}`、`/stores/{storeRef}` owner 资源路径。
- 删除内部实现说明不等于删除停用对象保留、`PLANNED` 信息标记或 owner 约束。
- 增加中文 displayName 不等于把机器枚举改名；提交和判定仍使用冻结 literal。
- 修复内部渠道即时生效不等于放宽外部渠道的 binding-effective gate。
- `EXTERNAL_GRANT` 的 platform 新建限制不是“权限不够”，而是授权流程的业务 ownership/admission；不能用新增权限绕过。
- 项目和门店页面应共享 foundation 与交互形态，但不能合并 PROJECT/STORE 的 owner scope、API ref、授权 target 或业务事实。
- 详情与编辑必须分开，但“同一个用户任务需要跨 owner 读数据”不能因为 owner 不同就从页面删除。

## 9. 当前结论与下一步

本次回溯结论为：

`问题现象 CONFIRMED；根因以 F1-F5 为主；部分具体旧版本断点需独立源码/浏览器复验；后续需求迭代必须采用 R-01 至 R-10 的最小传播与验证控制。`

本文本身不宣布实现 GO，不替代 Claude 独立分析，也不授予任何运行或数据操作权限。Claude 的任务见同批文件：

`doc/review/platform/2026-08-20-v2s-business-channel-management-experience-problem-claude-independent-analysis-brief.md`。

## 附录 A：本次六维记忆路由与复读记录

本次按项目入口要求执行六维路由，并重新打开命中的 memory 原文与 owning source；查询输出只用于找路径，不作为规则原文。使用的路由命令为：

```text
scripts/context/recall-memory --task-kind review --domain admin-ui --consumer-face operations-admin --owner frontend-platform --impact architecture --trigger review
scripts/context/recall-memory --task-kind review --domain admin-ui --consumer-face platform-admin --owner frontend-platform --impact architecture --trigger review
scripts/context/recall-memory --task-kind review --domain backend --consumer-face backend --owner backend --impact transaction --trigger review
scripts/context/recall-memory --task-kind review --domain contract --consumer-face backend --owner contract --impact contract --trigger review
scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner platform --impact evidence --trigger review
```

以下为本次 union 命中集合的 SHA-256 记录；涉及本文根因的路径包括 route drift、cross-boundary string、source reread、phase retrospective、frontend capability、independent review 等。

```text
project-memory/decisions/confirmed-business-language-corpus.md 3dba1c80579d4a0eca281efd59d27fbfb20aa86572648f8e36c83a68a603b4f3
project-memory/decisions/deterministic-context-only.md c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263
project-memory/decisions/distributed-topology-is-not-current.md c578afa258d1a7cb610aa87f8a80f5693f0477cfebd0795c8a5c863633c7664e
project-memory/decisions/http-crud-efficiency-design-redlines.md 8a479436fbc6000d9f494a40ebd2fcdd6c0b8717cb3f64f7c9596a117e74cd34
project-memory/decisions/independent-subagent-adversarial-review.md 9d2903a17c1d71738f530fe00f0abdedf99b2d5370ce6219e63ce1fc082381f1
project-memory/kernel/01-workspace-and-roadmap.md f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63
project-memory/kernel/02-service-shape-and-owner.md 45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032
project-memory/kernel/03-transaction-data-and-dependencies.md f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44
project-memory/kernel/04-contract-consumer-and-admin.md 1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d
project-memory/kernel/05-evidence-runtime-and-git.md 254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8
project-memory/kernel/06-heritage-and-change.md 5c52b17aad29ba9d78e327ebe550a740d73f974020c9f4d31c8df38615566c
project-memory/operations/claude-review-handoff-standard.md 35ee335e19c74ac3bdcd1e93281d60e2f36c5a4a9bf23ccf0759a43f9ab1137f
project-memory/operations/implementation-source-reread-discipline.md 6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce
project-memory/operations/phase-retrospective-and-systemic-repair.md 5785cfc62006232bd9d2161eab59fe8224a375a428c6db21a81f5aad83a10d9f
project-memory/operations/test-closed-loop.md 1aff29c6e67893818c9b80bd8db09b0358ddf8cb5aca8d0ef689c38380fe81e9
project-memory/operations/verification-governance.md 3094cf61cea315208323f7d3f9266f719ea6ca9d828094378ede375dfe9f3005
project-memory/operations/business-corpus-adoption-and-read-policy.md d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9
project-memory/operations/business-corpus-parked-domain-intake.md 739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e
project-memory/pitfalls/browser-route-data-scope-drift.md 064c942e9013e419adf319c67bdfea580fca57c1410caa2cb07c9b9f16ac5850
project-memory/pitfalls/claim-versus-behavior.md 10f9a42b5bd806fb25671366a12447e8e1154f886aa28a7e2e3102011f60f6f2
project-memory/pitfalls/designing-from-conversation-not-system.md 18f43e56f97f53f9124bd05aedc458d94abdd210922a79cefa7e3fb8304daddf
project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md 8236548a682e0ec408b34d6a4d99c64b95fe784fbbda300ad6d84f8f379726b7
project-memory/pitfalls/owner-boundary-reverse-inference.md b782f694c3b9599195557e19a300d79676f42d202377abb16e5d10ed33bf2f00
project-memory/pitfalls/catalog-code-rule-invention.md cd82b29624b5afd94e385656df38124cd5d97ec2917e21c1bd216e0298768c7a
project-memory/pitfalls/green-by-existence-check.md 1d984aa79933cc6f396a049c0ac2767805386bd00ba1a1f37cdaa9f48ce0d234
project-memory/pitfalls/count-without-member-list.md 61e238bfdc55261156617d7a38023dbf6032ed68983080ff4de66a99c5016f8f
project-memory/pitfalls/denominator-inherited-not-built.md 5550e3d4eb2dd3bf86b5af158c403849aecd73078fb3d5a3f89b453a69ddb8a2
project-memory/pitfalls/negative-universal-claim.md 9c46425d4c69a62e1547adce401dd35078e428677d737aea95a42bed5a3ef79f
project-memory/practices/cross-boundary-string-agreement.md 320eced45cc1741c86ca74d1eaa63bf357dae2d284cb06e51a446902ca317f8d
project-memory/practices/frontend-capability-lookup.md 8ac0fc474432f207b7fdf469656a8d3470570c6ba3bc4cbe938a912dfdadf77b
project-memory/practices/cache-invalidation-granularity.md 222f5270a90c16f284457ea35b0a342b369e2c46561c707a225fd5cfbffbf4fc
project-memory/practices/failure-condition-names-the-wrong-shape.md 92cc9e6a11c44f994d7c63690d2b24eb74a2c583ee8d5f2f4aa0deab6ec08d1a
project-memory/practices/insert-as-claim-ownership.md 80e90765d1ddef12a778d1c66a66267e74e3a99985c3eef24a88262da4dcf80c
project-memory/practices/ordering-only-for-consumer-facing.md b99739901809665421077bc973acd184854a8285f1b5e6e1b5f1d93eaa18c57f
project-memory/practices/read-model-granularity.md 04134d03353778390e16fd70645633e592ae56416215abcd9e659f25998cd093
project-memory/practices/collection-boundary-modes.md 7e1b7c4bd9b568aaeac810a8e4b5ee2b03e89348ede83383d5d2e69f7d79b0b
project-memory/practices/set-interaction-not-n-times-single.md e8941f729fef1272262608a065a26d7cc2f56a0b48d51063541c28200b917083
```

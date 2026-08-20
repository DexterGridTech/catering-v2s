---
title: Claude 独立分析：两个管理后台经营渠道管理体验问题族与需求迭代防复发
status: READY_FOR_CLAUDE_HANDOFF
reviewTarget: RETROSPECTIVE_PROBLEM_FAMILY_AND_PREVENTION
scope: platform-admin/external-collaboration + operations-admin/project-and-store-business-channels
date: 2026-08-20
---

# Claude 独立分析话术

## 背景

本次不是请你评价 Codex 写的问题总结“好不好”，也不是请你对这份总结做文字润色。Dexter 在实际体验 `platform-admin` 的外部系统接入配置页、`operations-admin` 的项目/门店经营渠道管理页时，连续发现了一组跨布局、交互、契约显示、条件状态、路由 scope、业务编码和验证闭环的问题。

请把下面的用户原始反馈当作待调查输入，独立重新打开需求、IA、UI 交互设计、implementation-facing 详设、契约、项目记忆、前后端规范和真实源码，重新分析：

1. 每个用户现象是否真实；
2. 真实根因属于需求缺失、IA/交互映射漂移、契约/readback 缺口、owner 状态机错误、前端实现错误、fixture/数据问题还是验证闭环问题；
3. 是否存在同根的 sibling surface 或第二个管理后台问题；
4. 后续需求迭代应该改变哪些需求/IA/详设/规范/测试/review 做法，才能在实施前或第一次浏览器体验前阻止这类问题复发。

请独立形成你的分析，不要把 `doc/review/platform/2026-08-20-v2s-business-channel-management-experience-problem-summary.md` 当作结论输入；该文件只可以作为最后的对照材料，而且不能替代你自己从原始反馈和 owning source 得出的判断。

## 评审目标

本轮 `REVIEW_TARGET=RETROSPECTIVE_PROBLEM_FAMILY_AND_PREVENTION`，目标不是重新批准实现，而是对一组真实用户问题做独立的根因与防复发分析。

请重点回答：

- Dexter 的全部原始体验问题应如何建立有限分母，是否还漏了同族页面/同类消费者；
- 每个问题的“用户现象 → 直接缺陷 → 系统根因 → owning source → 规范/材料关系 → 最小修复/防线”；
- 哪些问题是 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`；
- 为什么已有需求、IA、详设、项目记忆和前端规范仍没有在首次体验前拦住它们；
- 后续需求迭代应把防线放在哪里：需求模板、IA 九维度、UI 交互工件、implementation matrix、contract/readback、owner policy、frontend foundation、focused test、浏览器 scenario、独立 review checklist 或 project-memory；
- 对每个防线给出最小可执行形态和一个能打红的反例，不要只写“加强检查”“加强测试”；
- 明确哪些结论需要 Dexter 做产品语义裁决，哪些是从已有规格可以直接确认的。

本轮不要求你执行 reset、seed、DEV 重启、UAT、L2 或任何 Git 操作；如没有当前浏览器运行证据，请诚实标记为 `UNVERIFIED_REQUIRES_EVIDENCE`，不要把静态存在当作真实行为。

## 需阅读文件

请从 `catering-v2s` 仓库根阅读以下文件。先读原始需求/问题材料，再读设计与源码；不要只从现有 review 结论反推。

### 原始需求与用户任务

- `doc/review/platform/2026-08-13-v2s-business-channel-requirements-final-claude.md`：业务渠道较早的最终需求、UC、字段和状态语义。
- `doc/review/platform/2026-08-18-v2s-external-platform-collaboration-and-business-channel-requirements-claude.md`：外部协作与经营渠道的合并需求、BR、UC、显示/状态/绑定语义。
- `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md`：冻结规格，重点阅读 BR-03～BR-15、BR-17～BR-20、BR-25～BR-39、UC-01～UC-08、P2/P3/P4/P5/P6/O1/O2/O3/O4/O5 相关段落。
- `doc/decisions/2026-08-19-v2s-business-channel-management-journey.md`：项目/门店经营渠道的 Dexter 旅程与产品意图。
- `doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md`：platform-admin 外部协作配置旅程与入口边界。

### IA、交互与实施详设

- `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md`：P1～P6、O1～O5 的九维度，尤其是 `entryAndSurface`、`USER_VISIBLE_COPY`、`TECHNICAL_BOUNDARY`、`stateAndPermission`。
- `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md`：Screen P1～P6、O1～O5 的布局、首列入口、Tab、header action、三列表格和失败反馈。
- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md`：CP-01～CP-06，contract descriptor/display projection、owner policy、route/scope、编码、状态机、双 app foundation 与验收场景。
- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md`：CP-00～CP-09 的实施顺序、跨层传播和 proof 设计。

### 规范与项目记忆

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`：执行入口、双 admin 边界、owner/edge/route、源码双读和验证边界。
- `doc/platform/frontend-coding-standard.md`：尤其 §3-H browser route 与 data scope、页面/Tab/catalog 文案、foundation 复用和 Drawer/list 约束。
- `doc/platform/backend-coding-standard.md`：尤其 §2-G browser route 与 owner scope 分离、edge recheck、owner command 和跨 owner 写边界。
- `project-memory/pitfalls/browser-route-data-scope-drift.md`：本批项目/门店 URL 把数据节点 UUID 放入 browser route 的同类失败模式。
- `project-memory/pitfalls/designing-from-conversation-not-system.md`：从对话白纸设计、没有先查仓内已有形态的失败模式。
- `project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md`：不可见 scope/contract/状态维度为什么容易在实施期漂移。
- `project-memory/pitfalls/claim-versus-behavior.md`：文档、字段名、测试名不能代替真实行为证据。
- `project-memory/pitfalls/owner-boundary-reverse-inference.md`：不能用 owner 划分反推用户任务。
- `project-memory/practices/cross-boundary-string-agreement.md`：跨模块/进程字面量与 display agreement 的判据。
- `project-memory/practices/frontend-capability-lookup.md`：现有 Drawer、list、descriptor、NameCode、layout 等能力与样板。
- `project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md`：acceptance exact route、fixture 到达目标规则和 business oracle 的完整性边界。
- `project-memory/operations/implementation-source-reread-discipline.md`：每个变更点重开原始业务/IA/memory/design/owning source 的双读习惯。
- `project-memory/operations/phase-retrospective-and-systemic-repair.md`：用户问题族有限分母、IA reconciliation、source/runtime 层和根因防再犯要求。
- `project-memory/operations/claude-review-handoff-standard.md`：独立、可复制、相对路径、授权边界要求。

### 真实源码与契约入口

- `apps/frontend/platform-admin/src/features/external-collaboration/ui/ExternalCollaborationPage.tsx`
- `apps/frontend/platform-admin/src/features/external-collaboration/ui/ExternalSystemDetail.tsx`
- `apps/frontend/platform-admin/src/features/external-collaboration/ui/ProviderProfileDetail.tsx`
- `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingList.tsx`
- `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingDetailDrawer.tsx`
- `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingFormDrawer.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/ProjectBusinessChannelPage.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/StoreBusinessChannelPage.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelList.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelCreateDrawer.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelDetailDrawer.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelEditDrawer.tsx`
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelBindingDrawer.tsx`
- `apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx`
- `apps/frontend/operations-admin/src/OperationsApp.tsx`
- `apps/frontend/operations-admin/src/tests/architecture/business-channel-scope.test.mjs`
- `apps/backend/catering-business-server/modules/businesschannel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationBindingPolicy.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/BusinessChannelWireMapper.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/PlatformExternalCollaborationController.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/ExternalCollaborationWireMapper.java`
- `contracts/openapi-source/collaboration.schemas.json`
- `contracts/openapi-source/business-channel.schemas.json`
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_003__business_channel_codes.sql`
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_004__business_channel_internal_effective_repair.sql`

### 已有复核材料（只作为交叉证据，不作为你的结论）

- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-1-verdict.md`
- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-2-verdict.md`
- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-review-claude.md`
- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-remediation-independent-review-round-1-verdict.md`

## 独立核验重点

### A. 先用原始反馈建立问题分母

请逐条核对下列 21 个原始现象，并主动扫描同族页面；不要只判断“当前源码是不是已经修过”。

#### platform-admin 原始现象

1. 启用/停用/刷新按钮在内容底部，应该在详情 section header 右侧。
2. provider 的基础详情在 Tab 外，应该放在“详情”Tab 内。
3. “目录标记：计划中；停用对象仍保留在列表和详情中。”解释文字应删除，但停用对象历史事实仍要保留。
4. 需要说明“新建绑定”的业务准入条件；Dexter 已明确这不是权限问题。
5. 页面直接显示 `GROUP_BUY`、`TAKEAWAY` 等技术编码；两个后台都应显示中文名称，contract 补齐名称。
6. 能力属性应使用“属性/当前值/说明”三列，而不是连续卡片文本。
7. 能力当前值显示 `—`，需要确认是合法空值还是 readback/fixture/映射缺陷。
8. 点 provider config 后页面崩溃，需要追踪 readback shape、optional 字段、mapper 和 frontend consumer。
9. 外部协作页应与组织概览保持左树右详情的既有布局。
10. “当前集团空间的外部系统、接入档案和空间开放状态由 collaboration owner 回读。”是内部实现说明，应删除并重新整理布局。

#### operations-admin 原始现象

11. 选择 `POS` 后仍提示“请选择到店点餐形式”。
12. “到店渠道只能使用内部接入。”说明应删除，但 BR-06/07 校验不能删除。
13. “项目经营渠道管理”页标题与 Tab 重复，应去掉重复标题。
14. “经营渠道”应改成“项目主体经营渠道”，“渠道模板”应改成“经营渠道模板”。
15. 项目页不符合标准表格/Drawer 操作方式：第一列应进入详情 Drawer，详情和编辑是两套标准 Drawer。
16. 项目/门店浏览器 URL 曾包含数据节点 UUID，如 `/operations/aurora/projects/<uuid>/business-channels`。
17. 模板缺用户手填模板编码、缺列表编码列；项目内判重、创建后不能修改。
18. 渠道名称应为第一列并进入详情；当前第一列是“待生成”编码。
19. 渠道编码应该用户手填、判重、只新建不编辑，不能显示“待生成”。
20. 内部接入渠道显示“待外部授权回填”。
21. 内部接入渠道显示“草稿”，但内部渠道创建后应立即生效。
22. 外部协作绑定关系表必须使用项目标准表格，绑定名称与节点名称分开搜索，并支持服务端分页、排序和横向滚动。
23. 外部系统和接入档案的启停使用标准按钮加确认，不使用 Switch/radio；详情 Drawer 与编辑 Drawer 分离，实体操作统一放在详情 Drawer 右上角。
24. 绑定业务显示不能因 capabilityClass 为空而显示 `—`；内部映射和无需映射的主体空值不能显示“待外部授权回填”。
25. 所有内容 Tab 的“刷新当前页”必须覆盖 RTK 查询、命令式读取、分页列表和已打开的只读详情，但不能覆盖脏表单；视图切换不应被误当作刷新。
26. 后台绑定 Page 的独立搜索、排序、分页以及认证类型对应的显示语义，必须用真实 Testcontainers acceptance 场景验证，而不能只依赖静态或浏览器证据。

### B. 对每条问题做独立六步追踪

请对每条问题按下面固定格式输出，而不是只给一个总评：

```text
问题 ID / 原始现象：
状态：CONFIRMED | PARTIALLY_CONFIRMED | REJECTED_WITH_EVIDENCE | UNVERIFIED_REQUIRES_EVIDENCE | DEXTER_DECISION
直接缺陷：
系统根因：需求 / IA / UI交互 / contract / generated wire / owner policy / edge scope / frontend / fixture / verification 中的哪一层或哪几层
最小 owning source：相对路径:行号或明确 heading
需求与设计关系：BR/UC、IA screen、interaction screen、CP/plan
同根扫描范围：另一个 app、PROJECT/STORE sibling、其他 provider/状态/字段是否受影响
最小修复或防线：
可复验反例：
是否需要 Dexter 产品裁决：
```

特别注意：

- 不要因为当前源码已经出现修复后的代码，就把用户原始问题改写成“从未发生”；应区分历史现象、当前静态状态和当前运行行为。
- 不要因为 review 文档声称“已覆盖”就放行；请打开真实 read/write path 和 consumer。
- 对 POS 误报、provider 崩溃、能力值为空，如果原始失败版本已被覆盖，请标记 `PARTIALLY_CONFIRMED` 或 `UNVERIFIED_REQUIRES_EVIDENCE`，不要猜旧实现的具体异常。
- 对 route 需区分 browser route 与 API resource path：不能因为 API 仍有 `/projects/{projectRef}` 就接受 UUID 进入 browser URL，也不能反过来删除 owner API ref。
- 对“新建绑定”请明确是业务 admission/authenticationKind 状态规则，不要把答案简化成角色权限。

### C. 必须独立回答“为什么已有材料没有防住”

请不要停留在“实现没有按文档做”。请检查以下可能的根因是否成立，并给出证据或反例：

1. 需求冻结了领域对象和 BR，却没有把入口/surface/display/条件字段/scope/亲验动作作为同等级事实。
2. IA/交互文档有这些事实，但没有在 implementation-facing matrix 中逐字段、逐页面、逐 app 对账。
3. contract/readback 提供了机器值，但 displayName、attributeValueLabels、旧数据空值和中文 label 没有形成同一条跨层链。
4. accessKind、authenticationKind、binding status、channel status 各自有规则，但没有一个集中状态矩阵决定页面展示和命令结果。
5. 实施前没有先查组织概览、foundation Drawer/list/NameCode/descriptor 等已存在的仓内形态。
6. 静态 review 证明了文件/组件/字段存在，却没有证明首列点击、Tab 位置、条件保存、错误 feedback、route scope 和真实 readback。
7. 项目问题发生后是否只修一个点，还是已扫描第二个后台、PROJECT/STORE sibling 和同族字段。

若上述判断不成立，请给出具体源码/文档证据推翻它，而不是礼貌接受。

### D. 必须回答后续需求迭代的防复发方案

请给出一张“问题族 → 最小防线 → 落点 → red example → 成本/边界”的表，至少覆盖：

| 问题族 | 你需要判断的防线 |
|---|---|
| 页面入口、section header、Tab、详情/编辑 Drawer | 需求/IA 是否必须固定 `HOST_AND_ENTRY/UI_SURFACE/first-column entry/header action`；如何用 sibling 页面和浏览器动作打红 |
| 枚举、中文名称、能力属性当前值、旧 readback | contract 是否必须声明 `machine value/displayName/label/helpText/empty semantics`；如何防止前端再造 label map或把 `—` 当成功 |
| DINE_IN/POS、内部/外部、认证类型、binding 生效 | 如何把条件字段和状态机写成完整矩阵；前端正反例与 owner typed policy 如何保持一致 |
| 模板/渠道编码 | 如何在需求阶段固定输入时机、唯一性 scope、immutable、DB 并发、typed duplicate 和历史空值 |
| browser route/data scope/API owner ref | 如何在 route 设计阶段阻断 `:scopeRef`；如何证明旧 URL 迁移不改变 scope、edge 仍重验 |
| 两个 admin app 与 sibling 页面 | 如何定义有限扫描分母，防止只修用户点名的页面而漏掉另一端 |
| 设计/实现/review/浏览器证据 | 哪些事实应由静态检查证明，哪些必须由 focused test，哪些必须由真实浏览器；`GO` 的边界如何写清 |
| 需求迭代本身 | 下一轮 requirement/IA/详设模板最小需要新增哪些列或问题；哪些现有记忆/规范足够，哪些应新增为 project-memory 或 checklist |

请明确区分：

- 真正能降低漏项的最小控制；
- 只是增加文档/台账但不会提升行为正确性的形式主义控制；
- 需要 Dexter 产品裁决的业务变化；
- 只需要 Codex/Claude/实现者按现有规范执行的工程动作。

### E. 可选验证命令与边界

可做只读静态核验；若运行命令不会启动或修改环境，可使用仓内已有检查。不要执行 reset/seed/DEV 重启/L2/UAT。重点可核对：

```text
scripts/check/claude-review-handoff --file doc/review/platform/2026-08-20-v2s-business-channel-management-experience-problem-claude-independent-analysis-brief.md
node --test apps/frontend/operations-admin/src/tests/architecture/business-channel-scope.test.mjs
```

以上命令只能证明话术结构或 route 静态约束，不能替代你对所有用户问题的独立分析，也不能据此宣称浏览器体验通过。

## 期望结论

请给出明确的独立分析 verdict：

- `GO`：问题族分母、根因分层和需求迭代防复发方案已足够闭合；
- `NO-GO`：仍有重大问题族遗漏、根因误归因、关键材料未读或防线不可执行。

请同时报告 `M` / `S` / `N` 数量。每条 finding 必须带：

- 精确仓库相对路径与行号/heading；
- 影响的 app、screen、owner、contract 或用户任务；
- 最小修复建议及同根扫描边界；
- 是否需要 Dexter 产品裁决；
- 静态事实、运行事实、推论和未验证事项的区分。

这里的 `GO/NO-GO` 只表示“这份问题族与防复发分析是否闭合”，不表示当前 implementation、DEV、seed、L2、UAT 或产品方案获得授权。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请不要评价 Codex 的问题总结写得好不好，也不要只做文字 review。请基于下面的 Dexter 原始体验反馈和仓库材料，独立重做一次“两个管理后台经营渠道管理页面的问题族、根因与后续需求迭代防复发”分析。

背景：Dexter 在 platform-admin 的外部系统接入配置页、operations-admin 的项目/门店经营渠道管理页实际体验到一组跨布局、交互、契约显示、条件状态、路由 scope、业务编码和验证闭环的问题。请不要把 `doc/review/platform/2026-08-20-v2s-business-channel-management-experience-problem-summary.md` 当成你的结论输入；可以最后对照，但必须先从原始反馈和 owning source 自己推导。

目标：请独立判断这些现象是否真实、根因在哪一层、是否存在同根 sibling 问题，以及后续需求迭代应该怎么改才能避免复发。

原始体验反馈：
1. platform-admin 的启用/停用/刷新按钮在详情内容底部，应放到详情 section header 右侧。
2. provider 基础详情在 Tab 外，应放到“详情”Tab 内。
3. “目录标记：计划中；停用对象仍保留在列表和详情中。”这段内部解释文字应删除，但停用对象仍要保留可读。
4. 需要分析什么情况下可以新建绑定；Dexter 已明确这不是权限问题，而是业务/认证类型准入规则。
5. `GROUP_BUY`、`TAKEAWAY` 等技术编码直接显示，要求 contract 补中文名称、两个后台统一显示中文名称。
6. 能力属性应使用“属性/当前值/说明”三列表格。
7. 能力当前值显示 `—`，需要查明是合法空值还是 readback/fixture/映射缺陷。
8. 点 provider config 后页面崩溃，需要追踪 readback shape 与前端消费边界。
9. 外部协作页应与组织概览保持左树右详情布局。
10. “当前集团空间的外部系统、接入档案和空间开放状态由 collaboration owner 回读。”是内部实现说明，应删除并调整布局。
11. operations-admin 新建模板选择 POS 后仍提示“请选择到店点餐形式”。
12. “到店渠道只能使用内部接入。”说明应删除，但业务校验不能删除。
13. “项目经营渠道管理”与 Tab 标题重复，应去掉重复标题。
14. section 文案应改为“经营渠道模板”“项目主体经营渠道”。
15. 页面不符合标准列表操作：第一列应进入详情 Drawer，详情和编辑是两套标准 Drawer。
16. 项目/门店 URL 曾把数据节点 UUID 放进 browser route，例如 `/operations/aurora/projects/<uuid>/business-channels`。
17. 模板缺用户手填模板编码和列表编码列；项目内判重、创建后不可修改。
18. 渠道名称应为第一列并点击进入详情，不能以“待生成”的编码占第一列。
19. 渠道编码应用户手填、判重、创建后不可编辑，不能显示“待生成”。
20. 内部接入渠道显示“待外部授权回填”。
21. 内部接入渠道显示“草稿”，但内部渠道创建后应立即生效。
22. 外部协作绑定关系表必须拆开绑定名称/节点名称搜索，使用项目标准表格的分页、排序和横向滚动。
23. 外部系统和接入档案的启停使用标准按钮与确认，不使用 Switch/radio；详情 Drawer 与编辑 Drawer 分离，实体操作统一放在详情 Drawer 右上角。
24. 绑定业务列不能因 `capabilityClass` 为空就显示 `—`；内部映射和无需映射的主体空值不能显示“待外部授权回填”。
25. 所有内容 Tab 的“刷新当前页”必须覆盖 RTK 查询、命令式读取、分页列表和已打开的只读详情，但不能覆盖脏表单；视图切换不是刷新。
26. 后台绑定 Page 的独立搜索、排序、分页和认证类型显示语义必须用真实 Testcontainers acceptance 验证，不能只依赖静态或浏览器证据。

请从 catering-v2s 仓库根先读原始需求和用户任务，再读：
- `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md`、`doc/review/platform/2026-08-18-v2s-external-platform-collaboration-and-business-channel-requirements-claude.md`：冻结 BR/UC/显示/状态/绑定语义；
- `doc/decisions/2026-08-19-v2s-business-channel-management-journey.md`、`doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md`：用户旅程；
- `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md`、`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md`：P1-P6/O1-O5 的入口、surface、布局、copy 和可见行为；
- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md`、`doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md`：CP-01-CP-06 的 contract/owner/edge/双 app/验证链；
- `doc/platform/frontend-coding-standard.md`、`doc/platform/backend-coding-standard.md`、`AGENTS.md`、`PLATFORM-BLUEPRINT.md`：route、scope、owner、foundation、验证边界；
- `project-memory/pitfalls/browser-route-data-scope-drift.md`、`project-memory/pitfalls/designing-from-conversation-not-system.md`、`project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md`、`project-memory/pitfalls/claim-versus-behavior.md`、`project-memory/pitfalls/owner-boundary-reverse-inference.md`、`project-memory/practices/cross-boundary-string-agreement.md`、`project-memory/practices/frontend-capability-lookup.md`、`project-memory/operations/phase-retrospective-and-systemic-repair.md`：同根失败模式和防复发边界；
- `apps/frontend/platform-admin/src/features/external-collaboration/`、`apps/frontend/operations-admin/src/features/business-channel/` 下对应 page/list/detail/edit/form/query 源码；
- `apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx`、`apps/frontend/operations-admin/src/OperationsApp.tsx`、`apps/frontend/operations-admin/src/tests/architecture/business-channel-scope.test.mjs`：browser route 与 session scope；
- `apps/backend/catering-business-server/modules/businesschannel/`、`modules/collaboration/`、两个 edge controller/wire mapper、`contracts/openapi-source/`、`V20260819_230000_003__business_channel_codes.sql`、`V20260819_230000_004__business_channel_internal_effective_repair.sql`：owner policy、readback、contract、唯一性和状态修复；
- 既有 implementation review 只作交叉材料，不直接继承它的 verdict。

请逐条独立输出：问题 ID/原始现象、`CONFIRMED`/`PARTIALLY_CONFIRMED`/`REJECTED_WITH_EVIDENCE`/`UNVERIFIED_REQUIRES_EVIDENCE`/`DEXTER_DECISION`、直接缺陷、系统根因、精确 owning source、与 BR/UC/IA/交互/详设/规范/记忆的关系、同根扫描范围、最小修复/防线和可复验反例。特别注意：POS 误报和 provider 崩溃的旧失败版本可能已被修复，不能猜旧代码；route 要区分 browser route 与 API owner ref；“新建绑定”要分析业务 admission，不要简化成权限。

然后请单独回答：后续需求迭代如何避免同类问题？请给出“问题族 → 最小防线 → 落点（需求/IA/详设/contract/owner/frontend/test/browser/review/memory）→ 一个 red example → 适用边界/成本”的表。至少覆盖：入口与 Drawer、枚举与中文 display、能力当前值、条件字段/状态机、模板/渠道编码、browser route/scope、两个 app 和 PROJECT/STORE sibling 扫描、内容 Tab 刷新、静态与浏览器证据边界，以及 backend acceptance 的 exact route/fixture reachability/business oracle。请区分真正有效的最小控制、只增加台账的形式主义控制、需要 Dexter 产品裁决的事项和已有规范即可执行的工程动作。

请特别独立分析本轮后台测试暴露的三个验证失败模式：嵌套 binding 场景漏掉 `/owner-bindings` 仍收到 HTTP 200、adapter 场景因缺 `channelCode` 在通用校验层失败、跨节点拒绝断言把合法 `instance` URI 当成业务数据。判断它们分别是测试路由、fixture 可达性还是 oracle 设计问题，并说明后续如何用一个最小反例把每类问题打红；不要把这三项与真实的 disabled Store owner scope 生产缺陷混为一谈。

烦请给出明确 `GO` 或 `NO-GO`，并报告 `M`/`S`/`N`。该 verdict 只表示“问题族与防复发分析是否闭合”，不表示 implementation、DEV、reset、seed、L2、UAT、产品方案或 Git 获得任何授权。没有运行证据的部分请明确标记为 `UNVERIFIED_REQUIRES_EVIDENCE`。

授权边界：本轮只授权独立 retrospective problem-family/root-cause/prevention analysis；不授权生产代码、契约、数据库、migration、reset、seed、DEV、L2、UAT、部署、产品语义裁决或 Git 控制动作。谢谢。
```

## 授权边界

本 brief 只请求 Claude 做独立的 retrospective problem-family/root-cause/prevention analysis。无论 Claude 给出 GO 还是 NO-GO，都不授权：生产代码修改、契约/数据库/migration 修改、reset/seed/DEV 重启、L2/UAT、部署、切流、产品语义裁决或任何 Git 控制动作。

---
title: R3 范围、运营端登录与 UI 设计方法缺口审查请求
status: ACTIVE_REVIEW_REQUEST
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewKind: SCOPE_AND_UI_METHOD_GAP
currentReviewCycle: R3-J02-DESIGN
currentCycleRoundLimit: 2
implementationAuthority: false
---

# R3 范围、运营端登录与 UI 设计方法缺口审查请求

## 结论摘要

当前 R3-J02 设计不应被视为可接受的 implementation-facing design。它把
`operations-admin` 的“独立登录/session”写入范围，但 J02 同时明确不创建账号、
任职或角色；已确认业务语料又规定新增任职只能由邀请并经受邀人接受而生效。因而，
没有一个被批准的首位运营用户来源，运营端的真实登录无法闭环。

这不是技术实现细节，也不能以测试账号、seed、匿名 bootstrap、隐式创建账号或只返回
`/current-session` 来补上。它是需要 Dexter 裁决的产品/Journey 范围缺口。

同时，本轮没有产出登录页或操作页的线框图。根因分为两层：

1. **执行错误（已确认）**：作者把“J02 不创建运营业务页面”错误扩大为“运营端登录
   可以只作技术 shell、无需按用户 UI 审查”，从而没有追问登录者是谁、其账号和任职从
   何而来。这违反 `UI_USER_TASK_VALIDATION` 与 `AMBIGUITY_REQUIRES_DEXTER`。
2. **设计方法的可操作化缺口（已确认）**：现行 policy 要求评估 UI 的用户任务、操作
   逻辑、替代路径和歧义，但当前 implementation-design granularity manifest/checker
   只机械要求每个 unit 写 `pageKey` 或 `notApplicableReason`，不要求逐屏交互规格、
   状态转移表或低保真线框图。因此“写了文字 UI contract”可以通过门，却不能证明
   登录、进入、错误恢复等交互已经被设计。

第 2 点解释为何没有形成线框图，但**不能替作者开脱**：即使现行模板没有强制线框图，
现行 policy 也足以要求在发现“登录”这个用户动作时先证明其业务前提。

本文件不重开或伪造第三轮 Codex 对抗审查；`R3-J02-DESIGN` 已达到两轮上限。它记录
Dexter 在审阅中指出的实质 scope/UI 问题，请 Claude 独立验证，并把产品取舍留给
Dexter。它不修改 R3 范围、不撤销既有文件、不授权实现。

## 背景

### R3 原始意图与当前入口

Roadmap 的 R3 目标是一个“最薄真实链路”：两个独立 admin app，完成“登录 + 一个真实
页面”的 walking skeleton。它没有定义两个登录者各自如何获得可登录身份。

Dexter 后续接受的 J02 只批准一个真实业务任务：已登录平台管理员为既有、已启用、
尚未初始化商业集团的集团空间，独立输入商业集团编码和名称，初始化唯一商业集团并
读回。J02 同时明确：不得创建账号、任职或角色；运营端本切片“不虚构组织页或业务
操作”，原文仍写“仅证明独立登录/session”。

当前 J02 设计延续了这个矛盾：它把 operations-admin 定义为独立 login/current-session/
logout shell，且要求 L2 中“每个 app 登录、读 current session、退出”。这不是一个
没有用户交互的纯内部组件；它已经主张了一个用户能够完成登录的页面行为。

### 业务语义链

以下是现行语料能证明的链，不是新设计：

```text
运营用户（个人）
  → 账号（登录名+密码或手机号验证码）
  → 运营角色
  → 任职（某人以角色服务于具体节点）
  → 登录运营管理后台、切换任职后取得页面与动作能力

新增任职：邀请 → 受邀人接受 → 生效
```

这条链不允许从“集团空间存在”或“商业集团已初始化”推导账号、角色、任职或门店。
所以当前 J02 可以合法停在“空集团空间 / 已初始化商业集团”，但不能据此让任何商场
运营方登录 operations-admin。

### 已发生的方法与产物

作者实际采用的设计方法是 implementation-facing delivery-unit 设计：

1. 以 J02 选择文件的用户任务为入口；
2. 用文字 UI contract 描述平台侧“列表 → 详情 Drawer → 初始化 Drawer → 读回”的
   操作序列、字段和错误恢复；
3. 以 delivery unit 拆分 owner、数据、contract、UI、L1/L2/L3/business/cleanup；
4. 用 granularity manifest 记录每个 unit 的 `pageKey` 或 `notApplicableReason`；
5. 用机械 checker 检查字段、锚点、hash、证据分母和 red fixture，不把业务语义写成
   关键词 checker。

这个方法对平台初始化任务的 owner、事务和错误恢复有一定覆盖，但它不等于完整的
interaction design 方法。尤其是它没有要求：每一个 user-facing route/page 的入口
条件、身份前提、屏幕结构、控件状态、操作后的去向、失败恢复与退出状态都以可视的
低保真线框或等价的逐屏交互规格呈现。

## 需 Claude 独立核验的问题

### M-01：运营端真实登录没有来源，当前范围不能闭环

**作者初步分类：`CONFIRMED`。**

证据链：

- J02 禁止创建账号、任职和角色，却要求运营端仅证明独立登录/session；
- G-05 把运营后台使用者定义为集团空间内的个人账号及其任职；
- G-07 规定新增任职必须邀请并接受，且不存在直接编辑任职；
- Heritage 的账号管理说明账号由 invitation acceptance 提供，账号管理本身不直接
  创建账号；邀请生命周期还依赖商业集团/组织树、角色与页面目录。

因此，当前设计中“operations-admin 可以登录”的前提既没有被 J02 批准，也不能由
J02 初始化动作产生。把一个匿名、测试、seed 或默认运营账号称为 R3 的真实用户
结果，都是以技术手段伪造业务前提。

需要 Claude 判断：这是否应使当前 J02 design 为 `NO-GO`，直至 Dexter 对 R3 的
“两个 admin 登录”范围作出明确裁决。

### M-02：platform-admin 的登录前提也应显式标注，而不是被静默吞掉

**作者初步分类：`UNVERIFIED_REQUIRES_EVIDENCE`。**

J02 的业务任务从“已登录平台管理员”开始。系统服务提供者使用平台管理后台是现行
业务分类，但在目前 R3/J02 文件中，没有批准平台管理员账号如何被创建、是否是部署
前提、是否来自外部身份系统，或是否属于 R3 之外的受控运维准备。

这不必然意味着要把 platform-admin 账号生命周期纳入 R3；更小且可能正确的做法是把
它写为**外部、已存在的系统服务提供者身份前提**，不把它伪装为 J02 创建的业务结果。
但该前提目前没有来源，不能由作者自行固定。请 Claude 判断它是否需要 Dexter 明确
确认，以及确认粒度应是“外部前提”还是“R3 内 Journey”。

### M-03：登录页被当成 session shell，导致没有交互规格或线框图

**作者初步分类：`CONFIRMED`。**

当前设计有文字形式的 session 和错误语义，也有平台初始化 Drawer 的文字操作链，
但没有任何 login、session-expired、sign-out、platform 初始化页的线框图，亦没有
逐屏结构（信息区/输入区/主次操作/错误区）、可达状态、跳转或恢复图。

这并非因为“UI 不重要”，而是错误地把 operations login 视为没有业务 UI 的 shell；
加上现行 manifest/checker 没有要求 wireframe/interaction artifact，缺口没有被机械
门暴露。机械门不应据此改成判断“设计是否好”的伪语义 gate；应保留为 Claude/Codex
的独立语义审查要求，并在 UI-bearing Journey 的设计模板中要求可人工评审的工件。

需要 Claude 判断：对当前 R3 这种含登录与平台侧 Drawer 操作的范围，最低充分 UI
交付物是否应是“用户任务 → 路由/屏幕 → 状态/操作 → 反馈/恢复”的 interaction map
加低保真线框，而不是仅靠文字段落。

### M-04：不能以补画线框图替代产品裁决

**作者初步分类：`CONFIRMED`。**

若现在直接为 operations-admin 画登录、邀请或首用户页面，就会暗中选择“谁邀请首位
运营用户、角色在哪个节点、何时可登录、登录后做什么”，这是新的产品 Journey。现有
来源既不批准，也未给出足以选择的业务答案。

所以正确顺序应是：先由 Dexter 决定 R3 是否真的包含运营端用户登录；若包含，先批准
最小首用户来源及成功结果，再为该批准 Journey 产出 interaction map 与线框。若不
包含，则从 R3 设计、contract denominator、L2/business evidence 中删除“运营端真实
登录”声明，不能继续用它作为 R3 的完成条件。

## 不是建议的伪修复

- 以 seed/test 用户、默认账号、匿名 session、健康检查或 `/current-session` 200 冒充
  运营端真实登录；
- 在商业集团初始化时自动创建账号、角色、任职、组织节点或门店；
- 为了让登录可演示，直接新增“首用户邀请”页面、role template 或账号 bootstrap；
- 把 UI 合理性写成关键词匹配 checker，或以 checker 绿冒充产品裁决；
- 只补一张漂亮的登录线框图，却仍不说明该用户是谁、为何能登录、成功后进入什么
  已批准任务；
- 因为发现本问题而第三次重开 `R3-J02-DESIGN` 的 Codex 对抗审查。

## 建议的裁决框架（不预设结论）

Dexter 的最终决定至少需要在以下两条路径中选择或给出第三条有来源的路径：

| 候选 | R3 的变化 | 收益 | 代价 / 必须明确的事项 |
| --- | --- | --- | --- |
| A. R3 保留运营端真实登录 | 新增一个明确、最小的首位运营用户来源 Journey | Roadmap 的“双 admin 登录”变成真实用户结果 | 谁发起、角色/节点如何准备、邀请接受如何完成、首次登录后的批准任务；这会实质改变 scope，需要新的 Dexter 批准与新的 design cycle |
| B. R3 不再宣称运营端真实登录 | 保留独立 app 架构边界，但从 R3 交付/验收中移除 operations 登录与 business evidence | 不创造未批准业务 | 与 Roadmap “两个 admin app、登录 + 真实页面”的原文是否仍一致；若不一致，需要 Dexter 修订 R3 范围 |
| C. Dexter 给出已有的外部身份/预置前提 | 将前提写成可审查的外部边界，不把它变成 J02 产物 | 保持当前 J02 聚焦 | 必须有一手业务来源，定义适用者、生命周期、测试/生产边界和为何不属于 R3；不能只写“默认存在” |

作者的推荐不是选 A/B/C 中任一项，而是先由 Claude 判断问题是否成立、所需裁决的
最小粒度；在 Dexter 裁决前，当前 R3-J02 design 不得继续被表述为 ready。

## 若 Dexter 之后批准 UI-bearing Journey，建议采用的最小设计法

这不是当前的新增要求或实现授权，而是为避免同类遗漏提出的、可由 Dexter/Claude
评审的最小工件组合：

1. **Journey interaction map**：逐项列出 actor、前置身份/任职、入口 route、屏幕、
   用户意图、服务器 owner readback、成功去向、失败/超时恢复与退出；
2. **低保真线框图**：每个 user-facing 屏幕至少表达信息层级、输入/只读字段、主次操作、
   禁用条件、错误提示与返回/下一步；不等于视觉稿，也不预先规定组件库；
3. **状态与边界表**：列出 initial/loading/validation/submitting/success/conflict/expired/
   timeout/unknown 等状态，及哪些状态由 server/owner 判定；
4. **任务合理性审查**：逐操作说明它来自哪条批准 Journey、为什么用户在此时执行、是否
   有更短路径、是否受 contract/owner/文档歧义限制；
5. **实施前 review matrix**：把以上工件与 OpenAPI face、owner、L2/readback 和 failure
   evidence 对齐。这里的矩阵是人工审查材料，不是业务语义 checker。

对已批准的 J02 平台初始化任务，若其范围在审查后仍成立，至少应画出：平台登录前提
（仅作为明确前提，不自行发明生命周期）、集团空间管理列表、空间详情、初始化 Drawer、
字段校验、成功读回、重复/并发、超时先查询和未知错误。operations-admin 的任何线框
必须等待其用户来源 Journey 被裁决。

## 评审目标

请 Claude 独立判断：

1. 当前 R3 Roadmap、J02 selection、确认语料与 J02 design 是否确实存在“运营端登录
   无业务来源”的范围冲突；
2. 该冲突应标为 `M`、是否使 J02 design `NO-GO`，以及最小的 Dexter 裁决问题是什么；
3. 作者对于 platform-admin 登录前提的 `UNVERIFIED_REQUIRES_EVIDENCE` 分类是否恰当，
   还是现有来源已经足以处理；
4. “没有 wireframe”究竟是 policy 缺失、模板/checker 缺失、作者执行不当，还是三者
   的何种组合；
5. 上述最小 UI 设计法是否足够且不过度设计，尤其不能以增加图或 gate 的方式越权扩张
   R3；
6. 当前旧 Claude review request 是否应停止使用，直至 Dexter 决定范围。

## 需阅读文件

- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：R3 原始“登录 + 一个真实
  页面”范围与验收；
- `doc/decisions/2026-07-24-v2s-r3-specialized-design-authorization.md`：R3 仅 design
  授权、Journey 需由 Dexter 接受的边界；
- `doc/decisions/2026-07-25-v2s-r3-j02-commercial-group-initialization-selection.md`：J02
  接受的业务任务、不得创建账号/任职/角色与 operations session 限制；
- `project-memory/decisions/confirmed-business-language-corpus.md`：G-01、G-03、G-05 与
  G-07 的已确认业务语言；
- `doc/plans/platform/2026-07-25-v2s-r3-j02-commercial-group-initialization-implementation-design.md`：
  当前被质疑的 session/UI/九操作设计；
- `doc/review/platform/2026-07-25-v2s-r3-j02-design-granularity-manifest.json`：现行 UI
  字段与 operations session evidence 声明；
- `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md`：既有 UI 用户
  任务与歧义求证强制规则；
- `tools/implementation-design-granularity/cli.mjs`：现行 checker 对 UI 只验证
  `pageKey/notApplicableReason/requiresDexterDecision`，不验证线框/逐屏交互；
- `../catering-all-v2/doc/specs/platform/modules/workspace-account-administration.md`：交叉
  印证账号不由账号管理直接创建，邀请接受提供账号；
- `../catering-all-v2/doc/specs/platform/modules/workspace-invitation-lifecycle.md`：交叉印证
  邀请接受、角色/组织前置与公开接受流程；只用于解释，不能替代 v2s 当前裁决。

## 独立核验重点

- 从当前最高层的 J02 和 confirmed corpus 开始，而不是从作者的设计或 Heritage 倒推；
- 区分“两个独立 app 的技术边界”与“某个业务用户能够真实登录”的不同主张；
- 验证账号、任职、邀请和登录之间的因果链是否被错误截断；
- 对 M-02 主动寻找反例：平台管理员是否已有明确的外部身份来源；找不到时不要把推测
  写成结论；
- 验证 UI policy 是否已经要求足够的语义判断，并区分“policy 本身没有线框格式要求”
  与“作者未按已有 policy 审查登录前提”；
- 审核所提最小 UI 工件是否真的帮助人工理解用户任务，且不把 visual artifact、checker
  或 Heritage 模块当作新 R3 产品范围；
- 审核是否应撤回/停止使用当前 J02 Claude handoff，而非带着未闭环前提继续审架构细节。

## 期望结论

请给出 `GO` 或 `NO-GO`。findings 按 `M` / `S` / `N` 标注，并附精确文件与行号、影响面、
最小修复、反例/适用条件，以及是否需要 Dexter 产品裁决。

`GO` 至多表示这份“问题识别与裁决框架”可供 Dexter 使用；它不等于接受 A/B/C 中的
任何产品选择。`NO-GO` 不授权作者自行扩张邀请、角色或账号实现。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 R3 范围、运营端登录与 UI 设计方法缺口。

背景：R3 原始 Roadmap 要求两个独立 admin app 的“登录 + 一个真实页面”walking skeleton。Dexter 已接受的 J02 只批准平台管理员显式初始化商业集团，并明确不创建账号、任职或角色；但当前 J02 设计仍把 operations-admin 的独立登录/session 写入范围。已确认语料又规定运营用户须有账号与任职，新增任职只能邀请并由受邀人接受后生效。我们担心当前范围没有首位运营用户来源，登录无法作为真实业务结果闭环；同时现有设计没有登录或任务页的线框图/逐屏交互规格。

目标：请独立核验该范围冲突是否成立、是否使当前 J02 design NO-GO、最小应交 Dexter 裁决的问题是什么；并判断“没有 wireframe”是 policy 缺失、模板/checker 可操作化缺口、作者执行失误还是组合问题。请特别审查：不能以补画线框、测试账号、seed、默认账号或新增未批准邀请流程来伪造闭环。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-07-25-v2s-r3-scope-login-and-ui-design-method-gap-review-request.md：本次问题、证据链、候选裁决框架和作者初步分类；
- doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md：R3 原始范围与验收；
- doc/decisions/2026-07-25-v2s-r3-j02-commercial-group-initialization-selection.md：已接受 J02 与明确排除；
- project-memory/decisions/confirmed-business-language-corpus.md：集团空间、运营用户、账号、任职与邀请的现行语义；
- doc/plans/platform/2026-07-25-v2s-r3-j02-commercial-group-initialization-implementation-design.md：被质疑的 session/UI 设计；
- doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md：既有 UI 用户任务和歧义求证规则；
- tools/implementation-design-granularity/cli.mjs：当前机械 checker 的 UI 校验边界；
- ../catering-all-v2/doc/specs/platform/modules/workspace-account-administration.md 与 ../catering-all-v2/doc/specs/platform/modules/workspace-invitation-lifecycle.md：仅作跨代印证，不作当前产品真相。

请重点独立核验：登录与独立 app 边界是否被混为一谈；首位运营用户是否有任何已批准来源；platform-admin 登录前提是否已有来源；现有 policy 是否已足以要求 UI 任务审查而仅缺少可审查工件；以及 interaction map + 低保真线框是否为最小且不过度设计的补强。请主动寻找反例与适用条件，不要只接受作者的分类。

烦请给出明确 GO 或 NO-GO；如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复、反例/适用条件，以及是否需要 Dexter 产品裁决。

授权边界：本次只评审范围缺口和设计方法。它不授权 R3/W1 implementation、contract、migration、app、DEV、动态运行、数据库、seed/reset 或 Git；即使 GO，也不代表接受任何首用户/邀请方案，产品取舍仍由 Dexter 裁决。谢谢。
```

---
title: RM1 P6 交互接受前的严格详设准备与 re-freeze 设计
status: DEXTER_ACCEPTED_FOR_IMPLEMENTATION_FACING_REFREEZE
createdAt: 2026-07-29
programContext: V2S_RM1_REMEDIATION
decisionOwner: Dexter
implementationAuthority: false
---

# RM1 P6：交互接受前的严格详设准备与 re-freeze 设计

```text
SKILL_USED=cs-spec-to-plan@repository-local
DESIGN_STATUS=DEXTER_ACCEPTED_FOR_IMPLEMENTATION_FACING_REFREEZE
IMPLEMENTATION_AUTHORITY=false
CURRENT_P6_MANIFEST_STATE=BLOCKED_FOR_INTERACTION_ACCEPTANCE
```

## 1. 结论与正确次序

P6 原先只有 whole-scope plan，不是可以开工的 implementation-facing 详设：U09 manifest 的 D5
仍是 `BLOCKED_FOR_INTERACTION_ACCEPTANCE`，两份 required IA 工件不存在，change surface 也只有
两个 feature 根和 `doc/decisions`，无法覆盖 P-U1/P-U2/P-U3/P-U4/P-U5、P-Q1/5/7、ST-2/6/11。

本稿和 IA-01/IA-02 把“交互为何存在、用户怎样完成、失败如何恢复、谁拥有最终事实”写到可看图
裁定的粒度；它们没有伪造 Dexter 已接受的交互，也没有把未来契约/测试路径假称存在。严格流程是：

```text
原始业务和问题材料
  → IA-01 + IA-02 看图接受
  → P6 final implementation-facing detail design（exact paths/ops/tests/denominators/hash）
  → fresh DESIGN independent review
  → Dexter implementation authorization
  → production implementation
```

任何跳过第二步的“详设”都会把产品决策伪装成技术细节，违反
`doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md` §3/§9 和
`.agents/skills/cs-writing-plans/SKILL.md` 的 accepted UI 前置条件。

## 2. 原始业务问题与设计输入

| 问题族 | 用户/业务问题 | 原始 owning source | 本稿的设计约束 |
| --- | --- | --- | --- |
| P-N1 | 平台管理员需可选 OTP；Dexter 裁定 DEV/UAT 可显示本次验证码，生产绝不显示 | RM1 plan §P-N1；Dexter 2026-07-29 OTP 裁决 | OTP 是拟新增平台能力；调试展示只能是服务端配置门的受控响应，不能把 G-05 的运营凭据规则外推为既有 platform contract。 |
| R-5、G-07 | 新增任职只能邀请，platform invitation 面退役 | RM1 plan R-5；business corpus G-07 | 保留 public acceptance 七 operation 协议与五 target invitation 管理；不得笼统“删 invitation”。 |
| P-U2/R-7/G-10 | platform required pages 应共享端内选中空间，而 URL 不授权 | R6 inventory §9；business corpus G-10 | 一个 platform context authority；无选择为空态/导航 guard，不能补 URL key。 |
| P-U3/R-7 | 管理页负责 edit/status，总览只读 | R6 inventory §9；RM1 plan R-7 | 写 action 迁回 `PLATFORM-WORKSPACES`，不是增加新能力。 |
| P-U4/R-12/G-05 | 任职=“我是谁”，数据节点=“我在哪”，不应整页切换或合并 | R6 inventory §9；business corpus G-05 | shell 内 role switch、独立 scope drawer、owner candidates/readback。 |
| P-U1/ST-2 | typed problems 被固定中文/手工拼接，且 P1 consumer ledger 已漂移 | R6 inventory §9/§11；P1 authority ledger | current-tree consumer denominator 先重新对账，不能用旧 20 文件清单假绿。 |
| P-Q1/5/7、ST-6/11 | 双 face 重复 foundation、feature 结构/locator/barrel 不一致 | R6 inventory §10/§11 | 先审计 foundation 覆盖，再定义共享或 app-owner边界；22 feature roots和25 page keys逐项 disposition。 |

<a id="p6-business-search-capability-denominator"></a>

### 2.1 P6 业务搜索与候选选择分母（Dexter 指令，2026-07-29）

**为什么新增这条分母**：D02-S02/S03/S04、D03-S01/S02/S03、D04-S01/S02/S05O 与 G-05/G-07/G-10
要求用户定位真实组织、经营关系、合同、任职或工作上下文；它们不允许浏览器以文本、URL、当前任职或
已加载表格猜测 owner 事实。此前 IA04 把“项目”画为一般文本筛选，且 current 门店 list contract 根本
没有 `projectId`，暴露出“展示列/组件习惯替代业务搜索设计”的问题。

**完整 P6 正分母 = 27 screen family**：IA01 的两个（邀请列表与创建候选）+ IA02–IA04 的二十个 +
IA05 五个固定 target 用户列表。固定 target 不允许 target 选择器，却仍有“在该人群内找人”的业务任务。
每一行的完整字段、来源、
级联、owner 再核验、适合性与 GAP 均在下列 IA 的 §9/§13 原文，不在本表复写为第二真相。

| IA | 正分母 screen family | 业务问题来源 | 详设原文 | 当前结论 |
| --- | --- | --- | --- | --- |
| IA01 | `IA01-USER-INVITATION-ACTIONS`、`IA01-USER-INVITATION-CREATE-DRAWER` | D04-S05O、G-05/G-07 | IA01《P6 搜索与候选选择复核》 | 邀请列表是 owner 已实现筛选；创建候选 readback 缺口保留为 GAP |
| IA02 | `IA02-OPERATIONS-SHELL-HEADER`、`IA02-OPERATIONS-INITIAL-ROLE-SELECTION`、`IA02-OPERATIONS-DATA-SCOPE`、`IA02-PLATFORM-WORKSPACES-ACTIONS`、`IA02-PLATFORM-WORKSPACE-SIDER-CONTROL` | D04-S01/S02、G-05、G-10、P-U2/P-U4 | IA02《P6 搜索与候选选择复核》 | 5/5 已按 owner readback、固定词表或文本 contract 定义 |
| IA03 | `IA03-ADMIN-LIST`、`IA03-ORG-OVERVIEW`、`IA03-CONTRACT-OVERVIEW`、`IA03-ROLE-CREATE/EDIT`、`IA03-EXTENSION-PAGE`、`IA03-EXTENSION-EDIT` | D04-S11、D02-S02/S03、D03-S01、D04-S01/S02、D02-S07 | IA03《P6 搜索与候选选择复核》 | 6/6 已定义；组织/合同概览的 owner filter semantics 与候选读取为明确 GAP |
| IA04 | `IA04-ORG-TREE`、`IA04-BRAND-PAGE`、`IA04-TENANT-PAGE`、`IA04-HEAD-COMPANY-PAGE`、`IA04-HEAD-COMPANY-BRANDS`、`IA04-STORE-PAGE`、`IA04-STORE-CREATE`、`IA04-CONTRACT-PAGE`、`IA04-CONTRACT-CREATE` | D02-S02/S03/S04、D03-S01/S02/S03 | IA04《P6 搜索与候选选择复核》 | 9/9 已定义；门店筛选语义/项目筛选、门店创建级联、合同租户展示均为明确 GAP |
| IA05 | `IA05-GROUP-USERS`、`IA05-REGION-USERS`、`IA05-PROJECT-USERS`、`IA05-HEAD-COMPANY-USERS`、`IA05-STORE-USERS` | D04-S05O、G-05/G-07 | IA05《P6 搜索能力不适用声明》 | 5/5 已定义；当前 OpenAPI 声明但 owner 未实现筛选，统一为 GAP |

**准入结论**：任何 `GAP` 未由 owner contract + generated client + command revalidation 的同一设计闭环
解除前，相关 search-capable surface 不能进入 implementation-facing design，也不能在前端以文本、全量候选
或 client-side filter 伪装实现。这个约束不授权本 P6 修改 contract 或生产代码。

## 3. 交互工件接受输入（唯一 UI 决策入口）

| amendment | canonical path | unique screen anchors | 需要 Dexter 接受的业务决策 | 明确未授权事项 |
| --- | --- | --- | --- | --- |
| RM1-IA-01 | `doc/decisions/2026-07-28-v2s-rm1-ia-01-platform-otp-and-invitation-interaction.md` | `IA01-PLATFORM-LOGIN`、`IA01-PUBLIC-INVITATION`、`IA01-USER-INVITATION-ACTIONS` | platform OTP tab；public invitation completion 去登录；平台 invitation management 退役、五 target 页保留 | operation names/contract diff、前端实现、public protocol 删除 |
| RM1-IA-02 | `doc/decisions/2026-07-28-v2s-rm1-ia-02-operation-context-interaction.md` | `IA02-OPERATIONS-CONTEXT-SWITCHER`、`IA02-OPERATIONS-DATA-SCOPE`、`IA02-PLATFORM-WORKSPACE-CONTEXT`、`IA02-PLATFORM-WORKSPACES-ACTIONS`、`IA02-PLATFORM-WORKSPACE-OVERVIEW` | shell role selector；独立 data scope；platform required-page empty state；管理/总览职责 | 当前 session contract 重写、owner data candidate 推导、任何生产代码 |

### 3.1 已确认的命名漂移及处置

P6 plan §7.1 使用 `...-interaction-amendment.md`，而 current U09 manifest D5 已指向上述两个
`...ia-0{1,2}-...-interaction.md` canonical path。不是另建第三份文档：本次按 manifest path
产出，接受后 final re-freeze 要把 plan/manifest/reference 统一到同一路径，并在 package-exit 的
`identifiedFindingSet` 记录 `RM1-P6-IA-CANONICAL-PATH-01`。在此之前不得声称 D5 已恢复。

## 4. final implementation-facing design 的硬性内容

Dexter 接受两份 IA 后，作者必须在**新的 final P6 详设**中一次性生成下列固定内容；缺任何一行
不得请求 implementation，也不得以本预备稿蒙混：

| delivery unit | 要解决的业务问题 | exact owning source | exact current-to-final change set（不得泛写目录） | command/readback & failure/recovery | test contract minimum |
| --- | --- | --- | --- | --- | --- |
| U09-A | P-U1/ST-2 typed problem 一致显示 | P1 ledger + 20 current consumers + generated catalog | generated error catalog、两 app transport、每一 consumer 的 `update/retain` disposition | transport maps typed problem；unknown 保持上下文；不手拼 code/detail | L2，red：恢复固定中文或手拼 consumer 必须具名红 |
| U09-B | P-Q1/ST-6 audit/password presentation 无双份漂移 | 2 audit modal、2 password Drawer、foundation exports | foundation 与四 consumer 逐 path disposition | lifecycle/dirty/overlay/field label ownership；无跨 app state | L2，red：重新引入 face copy/import bypass |
| U09-C | P-Q5/P-Q7 feature model/locator/barrel | all 22 feature roots、app route imports | 22 roots × `model/automation/index` explicit disposition | locators only testing contract；barrel direction closed features | STATIC_GATE/L2，red：删 locator 或 deep import |
| U09-D | P-U2 selected workspace app state | platform app state/registry + six REQUIRED pages | app state, route guard, exact six page consumers | selection is locator; missing/stale clears/requires reselect; no server auth bypass | L2，red：local duplicate selection 或 missing selection query |
| U09-E | P-U3 management/overview responsibility | two platform workspace pages + operations contract catalog | exact page/action imports and route registry entries | update/status only management; overview task read only | L2，red：action appears overview or absent management |
| U09-F | P-U4 role/scope separation | OperationsApp, RoleAssignmentSelector, ContextSelector, session contract | exact component/foundation/query-cache paths | full entry readback; unknown reads before replay; dirty lock; navigation reset | L2，red：whole-page takeover, wrong depth, dirty switch |
| U09-G | P-U5 + P-N1 + R-5 surface closure | carry-over manifest 22/25, IA-01, public and invitation surfaces | every surface/page key CARRY/ADAPT/NOT_CARRIED exact reason | no public protocol retirement without explicit operation disposition; debug code only under server configuration | L2/STATIC_GATE, red：omit surface row; debug code returned while exposure=false; OTP derived from session/request input |

For every row final design must declare: path `create|update|retain|delete`, owner, prerequisite source/hash,
interaction anchor, generated operation or exact N/A reason, failure/recovery, foundation reuse/non-reuse reason,
red mutation, `testContract`, incremental verification, and package-exit assertion. Runtime/test file names use
stable capability names only; RM/P/U ids remain documentation metadata.

### 4.1 UI 详设标准（final P6 的机械缺项即 NO-GO）

Claude IA review intake `RM1-P6-IA-FOUNDATION-AND-ADMISSION-20260729` 已确认：IA 的逐 screen 声明
还必须增加 `FOUNDATION_PRIMITIVE`，列出一个或多个当前 `admin-ui-foundation` export，或
`NONE_WITH_REASON:<具体理由>`。它是 UI 详设 admission，不以“会复用 foundation”的散文替代；每个
export 必须由 `libraries/frontend/admin-ui-foundation/src/index.ts` 当前 bytes 支持。见
`doc/evidence/platform/rm1/p6/rm1-u09-ia-review-foundation-and-waiver-problem-family.json`。

每项声明还必须重开当前生产消费者和既有休眠/退役处置；不能只因 export 存在就让 final import 对账
强制导入已经登记为休眠、且不服务当前业务任务的原语。一个 screen 可以是新原语的首个生产消费者，
但必须在 IA 写出不可替代的业务需要与唯一 owner；“当前零消费者”不是可机械代替此判断的信号。

每一个 UI-bearing delivery unit 的 final detail design 都必须逐个 screen/surface 写明：
`CONSUMER_FACE`（运维管理后台 / 运营管理后台 / public）、`UI_SURFACE`（独立页面、内容页、内容 Tab、
Drawer、Modal、Popover、Header 控件、侧栏底部控件或表单控件）、`HOST_AND_ENTRY`、`ACTOR`、`BUSINESS_SCENARIO`、
`BUSINESS_GOAL`、`USER_VISIBLE_COPY` 与 `TECHNICAL_BOUNDARY`。不得把一个 screen 的角色、场景或目的
埋在实现步骤中，也不得以“弹窗”或“当前页面”替代准确形态。一个 screen 只表达一种 surface；宿主页
与其 Drawer/Modal/Tab/控件、同一路由的多个步骤必须分别有 screen id、线框和状态行。

所有用户可见标题、字段、按钮、空态、错误和确认文案必须使用业务语言；`node`/“节点”及 contract、
schema、capability、session、owner、page key、target、scope、errorCode、detail 等技术词不得作为用户可见文案。每个技术字段进入 UI 时
必须有可审阅的业务词映射；无 corpus/Journey 依据的词保持 `待 Dexter 裁决`。两个管理后台的登录页
都必须指定为 `@ant-design/pro-components` `LoginFormPage` 独立页面；public invitation/recovery 不是
管理后台登录页，不被错误套用。

每次绘制或修订任一管理后台登录页前，作者必须先重开该仓锁定版本的 `LoginFormPage` 官方类型和实现，
再在 IA 与 final design 写出 `logo/title/subTitle/message/children/submitter/actions` 的逐项映射，并声明
`activityConfig`、背景图、背景视频是否不用及原因。默认复用官方页面画布、container、header、描述、
328px 主表单区、全宽 large submit 与响应式行为；`Card + Form`、自建登录壳或为摹写旧系统而绕开官方
结构均为 NO-GO。任何覆盖默认视觉的差异必须有原始业务来源、响应式影响和 foundation 复用说明。
锁定版 `LoginFormPage` 的 header 是 `logo + title` 左右并列（44px 标识、16px 间距），`subTitle` 独立
位于其下；任何将 LOGO、标题和副标题绘成三行上下堆叠的登录稿均为 NO-GO，两个后台必须同样遵守。
运营管理后台登录页还必须把所属集团空间的已配置 LOGO 传入 `LoginFormPage.logo` 并显示；只有没有
配置或已批准图片 URL 加载失败时才可回落到统一默认标识。登录 entry 必须由 owner 返回可展示的批准
URL，前端不得从 asset ref 拼接或猜测 URL；若当前 readback 只提供 ref 或固定 null，final P6 详设必须
把 contract、owner readback、generated client、页面和测试作为同一变更闭环，不能以默认标识掩盖缺口。
运营管理后台所属的 public invitation/recovery 也必须逐页声明 `APPLICATION_AFFILIATION=operations-admin`：
它们不是已登录后台 session，却必须显示该集团空间的已配置 LOGO、名称和运营管理后台标题。公开 view
必须消费 owner-approved branding readback；任一缺失都要以 contract、owner、generated client、共享 header
和四步页面测试闭环，不得从 URL、token 或 asset ref 推导或伪造品牌。
四步 public invitation 的页面标题一律为动态 `加入{运营管理后台标题}`（后续步骤附“· 手机验证”/
“· 完善账号”/“· 完成”）；不得保留固定“加入运营管理后台”文案或由 client 创造标题 fallback。

**未认证自助恢复的额外准入标准（Dexter 2026-07-29 裁决）**：两个管理后台的“忘记密码”必须是
`账号 + 本人手机号 + 验证码 → 设置新密码`，并且是与已登录本人改密、管理员发起凭据恢复不同的业务能力。
运维管理后台由 platform-iam 自己拥有匿名恢复 flow；运营管理后台从已经 owner-brand-readback 的集团空间
入口进入，不额外输入集团空间，workspace-IAM 仍是账号/手机号/OTP/密码/会话最终 owner。现有
`resetGenerationKey` 管理恢复链必须 retain，不能被登录页拼接、显示或猜测；新增自助链以短时、owner-bound
opaque flow 与一次性 complete grant 取代它作为登录页入口。start/send 对不存在、停用与不匹配账号返回同一
业务提示，限频至少按 face、规范化账号、手机号和 HMAC 化来源；verify/complete 重验全部事实并在成功后
作废有效 session。任何一项没有 current contract/owner/readback 的，必须登记 GAP，不能画成已可用。

所有含输入的 UI 线框还必须逐控件提供 `表单控件依赖图`：用户可见控件、控件形态/搜索方式、owner
候选或初始值来源、上游依赖与可用条件、变更后的清理/重载、可选项约束、loading/empty/failed 与提交时
owner 再核验。无依赖控件也必须列出。若 B 依赖 A，图和表必须明确“先选择 A 才能选择 B”、A 改变时
B 如何清空并从哪个 owner readback 重建；禁止用本地角色、URL、page key 或旧选择推导候选，前端筛选
不替代 owner command 的最终校验。

每一张线框还要以 screen 为分母做 `UI_SURFACE` ownership 对账：线框内每个标题、字段、按钮、提示和
状态都必须属于该 screen 声明的物理面，且能回指 `USER_VISIBLE_COPY`。Header 控件不得夹带侧栏、账户
菜单、另一个 Header 控件或内容页；内容页/空态不得夹带全局 Header；Drawer、Modal、Tab 均须独立
screen。禁止将“不显示某功能”画成用户可见的一行。最终 P6 详设附逐屏 ownership roster，任一跨面元素
或无位置文案为 NO-GO。

每个可见操作还须做独立的 **操作分母对账**：按钮、链接、行点击、Select 变更、菜单/Tab、刷新/重试、
取消/确认均逐项回指批准 Journey 原文、进入条件、目标 surface 和 owner action/readback。接口存在、旧页面
存在或“页面似乎需要”都不是新增按钮的依据；实体列表默认名称链接进入详情，写/确认操作只能从详情的
上下文动作继续。原始 Journey/ledger 与现有 v2 实现互相冲突时，必须保留冲突并交 Dexter 裁决，禁止自行
选择一个版本画入线框。

`EXACT_COUNTERPART` / `PARTIAL_COUNTERPART` 默认要有静态摹本或截图。若 Dexter 对一批 IA 明确免画，
每一条适用盘点记录都必须写 `DEXTER_WAIVED_<date>`、豁免范围和等价 review/source evidence；它不是
“无对应页”，也不解除原始 source/hash、差异理由与其他 IA 分母。surface ownership roster 的允许状态为
`PASS`、`REVISE`、`REVISE_PENDING_DEXTER`；最后一项只表示冲突候选仍等待 Dexter 裁决，绝不代表接受。

### 4.2 final P6 foundation import equality（implementation-facing design 前置）

当 final P6 为每个 screen 冻结 exact implementation path 后，必须在
`scripts/check/frontend-architecture` 增加声明—实现 import 对账：每一个 `FOUNDATION_PRIMITIVE` export
必须在该 screen 的实现路径或其唯一、同 surface 的共享 owner 中导入；`NONE_WITH_REASON` 不得出现该
export 的 app-local 替代。该控制要读取 final manifest，而不是从 IA 文本猜路径；它必须有两类真实红变异：
删掉已声明 import，以及以 local state/手写 lifecycle 重做同一共享行为。休眠/首个消费者的语义适用性
由详设 source reopen 与人工复核判断，不把“零消费者”伪造成未来 import gate 的关键词规则。当前 IA 还没有 final path，故本
阶段只冻结此机械控制契约，不能伪称 import check 已通过或越权修改实现 gate。

## 5. Six-denominator package-exit design

The final U09 manifest/exit must carry, not merely cite, these exact source-compliance denominators:

| ID | denominator and owner | final required assertion |
| --- | --- | --- |
| D1 | all six-dimension `recall-memory` hits for U09, with reopened path+hash+selector | dynamic exact owning source set equals package source set |
| D2 | P-Q1/5/7, P-U1/2/3/4/5, P-N1, R-5, ST-2/6/11 | every id has an implementation disposition and exit assertion |
| D3 | RM1 plan §5 + R-5/R-12/R-13 prohibitions | no pageKey/backend authorization, no scope inference, no platform invitation page, no duplicated foundation |
| D4 | final delivery-unit table and actual changed file receipts | actual changed paths exactly equal non-empty incremental checks |
| D5 | `frontend-asset-carryover-manifest.json` surfaces + pageDesignKey crosswalk, accepted IA hashes/anchors | 22 surfaces and 25 keys each have exact CARRY/ADAPT/NOT_CARRIED reason; all IA-bound UI units include accepted hash/anchor |
| D6 | current `standards-coverage-matrix.json` for current phase | every due standard maps to gate/checklist/evidence, with a real red mutation where it is a machine control |

No `PENDING` is permitted in final design or exit. The only current state is the honest pre-design status
`BLOCKED_FOR_INTERACTION_ACCEPTANCE`; it is not a disguised completion result.

## 6. Finding generalization and prevention set

### RM1-P6-ST2-CONSUMER-DENOMINATOR-01

| field | value |
| --- | --- |
| root-cause class | authority ledger follows renamed/moved paths by hand and has no current-tree reconciliation |
| finite search surface | both frontend apps' non-generated `.ts/.tsx` UI consumers of typed `errorCode/detail`; P1 ledger rows; generated catalog excluded as producer |
| confirmed siblings | P1's two obsolete `features/workspace-membership/...` rows; actual `features/workspace-user/ui/WorkspaceInvitationPanel.tsx` and `WorkspaceUserPage.tsx`; all other current consumers must be re-scanned before final design |
| counterexample boundary | a source that imports a typed Problem but only passes it through without rendering is not a renderer; record retain/N/A with line evidence rather than force a consumer migration |
| minimum prevention | extend an admitted existing P6 architecture/authority check so the current source-derived renderer set equals the P1 ledger set; real red mutation replaces one current renderer path with a nonexistent path and must name `AUTHORITY_CONSUMER_DENOMINATOR_STALE` |
| prevention owner | U09-A final design, P6 package exit and P8 transfer input |

The final exit must contain `identifiedFindingSet` exactly equal to its prevention dispositions, including this
finding and `RM1-P6-IA-CANONICAL-PATH-01`. A single string replacement is not closure.

## 7. Re-freeze procedure and review boundary

1. Dexter 已于 2026-07-29 接受 IA-01…IA-05 的交互设计，所有 IA 均记录 `DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-07-29`。
2. Reopen current bytes of the plan, U09 manifest, carry-over manifest, P1 ledger, standards matrix, all D1 memory
   hits, current contracts and UI surfaces; record path+SHA-256+anchor.
3. Write one final P6 implementation-facing detail design to the then-authorized path, including §4/§5 fields and
   concrete existing/future test file paths. Update U09 only with the accepted IA path+hash+anchor, exact surface
   dispositions, and no blocked placeholders.
4. Run `scripts/check/implementation-design-granularity` and `scripts/check/standards-coverage --phase <CURRENT_STEP>`;
   resolve any failure before review.
5. Run a new fresh independent `REVIEW_TARGET=DESIGN` cycle for this narrowly re-frozen P6 scope; at most two rounds.
6. Only after that verdict and Dexter's explicit implementation authority may a P6 active package permit production paths.

## 8. Why this is the smallest safe design

Alternative A—write implementation detail now from current components—looks faster but would decide OTP/self-service
recovery protocol, role-switch navigation, platform context empty state and page responsibility from code; it violates
the original business/user-task order. Alternative B—ask Dexter to choose without a wire—shifts design labor to Dexter
and gives no verifiable state/recovery evidence. This package chooses the minimum: five bounded IA artifacts plus an
exact re-freeze contract. It adds no app behavior, retains the administrator-issued reset chain, and refuses to claim
the newly approved self-service chain exists before its contract/owner prerequisites do.

<a id="RM1-P6-OTP-DEBUG-CODE-EXPOSURE-01"></a>
## 8.1 Amendment：DEV/UAT 短信验证码受控展示（Dexter 2026-07-29 裁决）

`RM1-P6-OTP-DEBUG-CODE-EXPOSURE-01` 显式修订 P-N1 的旧字节：P6 本稿原“响应绝不泄露
`testCode`”、IA-01 的“响应无 testCode”、以及 RM1 plan §P-N1 的“响应永不含 testCode”与两条
“OTP 响应出现 testCode 即红”负面用例，均由下列受控规则取代。该 amendment 不改写历史 plan；final
implementation-facing design 必须把它作为对这些指定行的 superseding P6 设计输入。

1. 只允许服务端配置 `platform.otp.debug-code-exposure: ${CATERING_OTP_DEBUG_CODE_EXPOSURE:false}` 决定
   是否暴露；默认 `false`。DEV 与 UAT 显式配置为 `true`；生产保持未配置/`false`。前端开关、URL 参数、请求
   参数、构建变量或 session 状态均不得控制该行为。
2. OTP 必须仍为随机值；`debugVerificationCode` 只是在门开启时回传本次真实 OTP 的 optional、nullable
   response field。门关闭时字段**缺省**，不是空字符串；OTP 不得由 sessionId、请求参数或任何可预测输入派生。
3. 五个 surface 仅在 owner response 返回非空 `debugVerificationCode` 时显示非生产 Alert：
   IA01-PLATFORM-LOGIN、IA01-OPERATIONS-LOGIN、IA01-PUBLIC-INVITATION-OTP、
   IA01-PLATFORM-RECOVERY-VERIFY、IA05-RECOVERY-VERIFY。文案固定为“当前为测试环境，验证码：<code>”；
   生产环境不存在该 Alert。它不写入草稿、日志、URL、session 或诊断文本。
4. 红门反转而不删除：`debug-code-exposure=false` 时响应出现非空 debug code 必须失败；任何 OTP 可由
   sessionId 或请求参数推导也必须失败。v4 的无环境门、由 sessionId 派生验证码的实现明确不适用。

这项裁决只定义未来 contract/owner/edge/UI 的最小闭环，当前 package 不修改上述实现、契约、codegen、
动态环境或测试。

## 9. Dexter visual acceptance required

Dexter 已在 2026-07-29 作出“两个管理后台均支持账号+手机号+验证码自助恢复”的产品裁决；该项不再是
待决产品问题。仍须按 IA-01 的 §11、IA-02–IA-05 各自接受条件审阅全部线框，特别确认两个“忘记密码”
入口、运营恢复的品牌继承和管理员链 retain 边界。`ACCEPTED` 仅允许进入 final P6 implementation-facing
detail design、独立 DESIGN review 和后续单独 implementation 请求；它不授权 P6 code changes。

## 10. 22 surface / 25 pageDesignKey 交互总台账（Dexter 指令，2026-07-29）

本表不是第三份 IA，不改变 IA-01/IA-02，也不授权实现。分母是
`frontend-asset-carryover-manifest.json` 的 `surfaces` 与 `pageDesignKeySurfaceCrosswalk`。
`DEXTER_ACCEPTED_INTERACTION` 表示该 surface 已随整包 P6 交互设计获 Dexter 接受；它是
implementation-facing 详设的输入，不是 implementation authority。所有 IA 均仍受本文件的
六分母、逐 screen 和 owner-first 约束，不能以接受状态跳过实施详设或实施后 review。

| # | surface / pageDesignKey | 原始业务需求（R5 Journey） | 当前 IA / R5 交互来源 | 当前状态 | IA-01/02 标准统一后的动作 |
| --- | --- | --- | --- | --- | --- |
| 1 | PLATFORM-AUTH / 非 catalog | D01-S01 平台人员登录；Dexter 2026-07-29 未认证自助恢复裁决 | IA01 `#IA01-PLATFORM-LOGIN`、`#IA01-PLATFORM-RECOVERY-VERIFY`；R5 `#PLATFORM-LOGIN` | DEXTER_ACCEPTED_INTERACTION | P6-1 补齐平台 OTP 与账号+手机号+验证码自助恢复协议 GAP |
| 2 | PLATFORM-WORKSPACES / PLATFORM-WORKSPACES | D01-S02/S03/S04/S05 空间创建、资料、状态、初始化 | IA02 空间链；R5 `#PLATFORM-WORKSPACES` | DEXTER_ACCEPTED_INTERACTION | P6-2 维持名称链接→详情→动作 |
| 3 | PLATFORM-ADMIN-USERS / PLATFORM-ADMIN-USERS | D04-S11 平台管理员治理 | IA03 `#IA03-ADMIN-LIST` 至 `#IA03-ADMIN-STATUS` | DEXTER_ACCEPTED_INTERACTION | P6-2 实现列表、详情、创建、状态与凭据恢复 |
| 4 | PLATFORM-WORKSPACE-OVERVIEW / PLATFORM-WORKSPACE-OVERVIEW | D01-S06 已选空间后的只读概览 | IA02 context/overview；R5 `#PLATFORM-OVERVIEWS` | DEXTER_ACCEPTED_INTERACTION | P6-2 不把总览变管理页 |
| 5 | PLATFORM-ORGANIZATION-OVERVIEW / PLATFORM-ORGANIZATION-OVERVIEW | D02-S06 平台人员只读组织搜索 | IA03 `#IA03-ORG-OVERVIEW` 至 `#IA03-ORG-DETAIL` | DEXTER_ACCEPTED_INTERACTION | P6-2 实现只读搜索、详情和失败态 |
| 6 | PLATFORM-CONTRACT-OVERVIEW / PLATFORM-CONTRACT-OVERVIEW | D03-S06 平台人员只读合同概览 | IA03 `#IA03-CONTRACT-OVERVIEW` 至 `#IA03-CONTRACT-DETAIL` | DEXTER_ACCEPTED_INTERACTION | P6-2 实现筛选、合同详情和失败态 |
| 7 | PLATFORM-ROLES / PLATFORM-ROLES | D04-S01/S02 角色、页面准入、独立动作能力 | IA03 `#IA03-ROLE-LIST` 至 `#IA03-ROLE-STATUS` | DEXTER_ACCEPTED_INTERACTION | P6-2 保持两棵授权树独立 |
| 8 | PLATFORM-WORKSPACE-ACCOUNTS / PLATFORM-WORKSPACE-ACCOUNTS | D04-S03 空间账号状态、凭据恢复、任职撤销 | IA03 `#IA03-ACCOUNT-TAB` 至 `#IA03-ACCOUNT-ACTION` | DEXTER_ACCEPTED_INTERACTION | P6-2 实现账号详情与上下文动作；邀请子流仍引用 IA01 |
| 9 | PLATFORM-EXTENSION-FIELDS / PLATFORM-EXTENSION-FIELDS | D01-S07P 扩展字段定义 | IA03 `#IA03-EXTENSION-PAGE` 至 `#IA03-EXTENSION-SAVE` | DEXTER_ACCEPTED_INTERACTION | P6-2 实现定义详情/整组编辑与冲突反馈 |
| 10 | PLATFORM-PASSWORD / 非 catalog shell Drawer | D04-S12P 本人改密、其他会话失效 | IA03 `#IA03-PASSWORD-DRAWER` 至 `#IA03-PASSWORD-RESULT` | DEXTER_ACCEPTED_INTERACTION | P6-2 实现 platform Drawer 与重新登录结果 |
| 11 | OPERATIONS-AUTH / 非 catalog | D04-S08 带空间入口的运营登录 | IA01 `#IA01-OPERATIONS-LOGIN`；R5 `#OPERATIONS-LOGIN` | DEXTER_ACCEPTED_INTERACTION | P6-1 实现品牌 readback |
| 12 | PUBLIC-INVITATION / 非 catalog | D04-S06 邀请查看、同意、验证、完善、完成 | IA01 public invitation 四步；R5 `#INVITATION-ACCEPTANCE` | DEXTER_ACCEPTED_INTERACTION | P6-3 不创建登录 session |
| 13 | PUBLIC-ACCESS-RECOVERY / 非 catalog | D04-S10 本人验证后重设密码；Dexter 2026-07-29 明确账号+手机号+验证码自助入口 | IA05 `#IA05-RECOVERY-VERIFY` 至 `#IA05-RECOVERY-COMPLETE` | DEXTER_ACCEPTED_INTERACTION | P6-1 保留管理员链，新增匿名 owner flow 与品牌 readback |
| 14 | OPERATIONS-SHELL / 非 catalog | D04-S09 切任职、可查看范围、刷新导航/数据 | IA02 shell/data scope；R5 `#OPERATIONS-SHELL` | DEXTER_ACCEPTED_INTERACTION | P6-3 任职与范围不得合并 |
| 15 | OPERATIONS-PASSWORD / 非 catalog shell Drawer | D04-S12O 运营用户本人改密 | IA05 `#IA05-PASSWORD-DRAWER` 至 `#IA05-PASSWORD-RESULT` | DEXTER_ACCEPTED_INTERACTION | P6-3 实现 operations Drawer 与会话失效结果 |
| 16 | OPERATIONS-ORG-STRUCTURE / PG-ORG-STRUCTURE | D02-S02 维护集团→大区→项目与项目分期 | IA04 `#IA04-ORG-TREE` 至 `#IA04-ORG-STATUS` | DEXTER_ACCEPTED_INTERACTION | P6-3 实现树、详情、创建/编辑、项目分期 |
| 17 | OPERATIONS-BUSINESS-ENTITIES / PG-ORG-BRAND、PG-ORG-TENANT、PG-ORG-HEAD-COMPANY | D02-S03 品牌、经营租户、总公司、品牌授权 | IA04 `#IA04-BRAND-PAGE` 至 `#IA04-BUSINESS-STATUS` | DEXTER_ACCEPTED_INTERACTION | P6-3 三张页面和总公司品牌授权分别实现 |
| 18 | OPERATIONS-STORES / PG-ORG-STORE-MANAGE | D02-S04 创建、维护、启停门店 | IA04 `#IA04-STORE-PAGE` 至 `#IA04-STORE-STATUS` | DEXTER_ACCEPTED_INTERACTION | P6-3 实现候选级联、详情、编辑与状态确认 |
| 19 | OPERATIONS-CONTRACTS / PG-CONTRACT-STORE-MANAGE | D03-S01/S02/S03 创建、编辑、失效合同 | IA04 `#IA04-CONTRACT-PAGE` 至 `#IA04-CONTRACT-INVALIDATE` | DEXTER_ACCEPTED_INTERACTION | P6-3 实现候选级联、分期快照、冲突重读和作废确认 |
| 20 | OPERATIONS-USERS / PG-IAM-GROUP-USERS、PG-IAM-REGION-USERS、PG-IAM-PROJECT-USERS、PG-IAM-HEAD-COMPANY-USERS、PG-IAM-STORE-USERS | D04-S04 查任职/撤销；D04-S05O 邀请、复制、取消、重发 | IA01 邀请子流；IA05 `#IA05-GROUP-USERS` 至 `#IA05-USER-REVOKE` | DEXTER_ACCEPTED_INTERACTION | P6-3 五类目标用户页、任职详情与撤销分别实现；邀请仍由 IA01 承担 |
| 21 | OPERATIONS-STORE-PROFILE / PG-STORE-PROFILE | D02-S07、D03-S04 门店角色只读归属、启停、合同三态 | IA04 `#IA04-STORE-PROFILE` 至 `#IA04-STORE-PROFILE-CONTRACT` | DEXTER_ACCEPTED_INTERACTION | P6-3 实现门店资料和合同三态只读 |
| 22 | OPERATIONS-FIVE-HOME-BOOTSTRAPS / HOME-GROUP、HOME-REGION、HOME-PROJECT、HOME-HEAD-COMPANY、HOME-STORE | D04-S08/S09 登录或切任职后的路由落点 | IA05 `#IA05-HOME-GROUP` 至 `#IA05-HOME-STORE` | DEXTER_ACCEPTED_INTERACTION | P6-3 五条路由只保留 Shell/content outlet，不新增 dashboard |

**25-key 对账**：platform 8（表中 2–9）；operations business 12（表中 16–21，其中 users=5、entities=3）；
operations home 5（表中 22）；合计 `8 + 12 + 5 = 25`。非 catalog surface 为表中其余 7 项，22 surface
与该 25-key 集合由 manifest `bySurface` / `byPageDesignKey` 逆映射闭合。

IA-01…IA-05 已随 P6 整包交互设计获 Dexter 接受，并已有 Claude 复审 GO；本台账将该接受状态与
implementation authority 明确分离。每一行仍须进入本轮 implementation-facing 详设与独立设计审查；
台账本身不构成 implementation authority。

## 11. 剩余 surface 严格 IA 独立复核与作者 intake

```text
REVIEW_CYCLE_ID=RM1-P6-REMAINING-STRICT-IA-20260729
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
implementationAuthority=false
```

第二轮独立复核以 `NO-GO M=1/S=0/N=2` 硬停止。作者重新打开
`StoreContractCreateRequest`、`StoreContractCandidatePage`、`ContractTaskReadService`、
`ContractWireMapper` 与 `ContractCommandService` 后确认 M1：合同创建 command 不接收经营租户，
而是从已选门店的 owner context 确定 `tenantId`；当前 candidate readback 又未返回可展示的租户。
因此 `IA04-CONTRACT-CREATE` 已从“经营租户选择”改为“经营租户（随门店确定，只读）”，并明确 final
implementation-facing design 的最小 contract-owner readback 扩展：为候选门店返回其已确定的经营租户展示值；
不得增加 tenant mutation，也不得前端反查或猜测。该修订是 `CONFIRMED`，不会改变 D03-S01 的合同归属事实。

N1 已将 IA04/IA05 顶层 Journey 引用改为真实 anchor 加表内 D-ID 说明；N2 记录为
`NOT_APPLICABLE_WITH_REASON`：`ui-wireframe-traceability` 只覆盖 R4，未被用于证明本 P6 的逐 screen
完整性。P6 的当前静态分母由 22/25 台账、IA03/IA04/IA05 的 24/25/17 screen-anchor 脚本检查，以及
R5 standards coverage 共同证明。该历史两轮上限已用尽，不启动第三轮；P6 交互设计已获 Dexter 接受，
但当前字节仍不构成 implementation authority。

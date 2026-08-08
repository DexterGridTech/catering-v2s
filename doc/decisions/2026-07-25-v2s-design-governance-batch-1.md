---
title: v2s 设计法治第一批：Journey 裁决与交互工件治理
status: DEXTER_ACCEPTED
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
---

# 设计法治第一批：Journey 裁决与交互工件治理

## 1. 目的与范围

本批只建立设计进入 implementation-facing design 前的法治工件与机械引用校验，解决
“技术 session / 页面文字存在，却没有业务用户前提与可审查交互设计”的遗漏。它不
裁决任何 R3–R6 业务 Journey，不重写 Roadmap 范围，也不授权 implementation、contract、
数据库、DEV、seed/reset、动态运行或 Git。

Claude 已给出 GO；Dexter 于 2026-07-25 接受本批。第二批现可对 R3–R6 未完成范围建立
Journey inventory 并交 Dexter 排序裁决。

## 2. 规范工件与责任分层

| 工件 | 路径 | 负责回答 | 不负责回答 |
| --- | --- | --- | --- |
| Journey 裁决 | `doc/decisions/templates/journey-decision-template.md` | 用户任务、成功结果、每个 actor 的身份/数据前提来源、非目标、禁推、corpus 命中与 Dexter 裁决 | owner/schema/contract/UI 实现细节 |
| 交互设计工件 | `doc/decisions/templates/ui-interaction-design-template.md` | interaction map、低保真线框、状态/边界、逐操作合理性、face/owner 对齐 | 未批准 Journey 的业务选择或视觉品牌稿 |
| implementation-facing design | 现有 `doc/plans/**` 与 granularity manifest | owner、事务、contract、数据、实现单元与 evidence | 替代 Journey 裁决或 Dexter 的看图确认 |
| 机械检查 | `scripts/check/implementation-design-granularity` | UI-bearing delivery unit 是否引用存在且唯一锚点的交互工件 | 判断线框是否好、前提链是否符合业务、Journey 是否该做 |

模板只定义工件的字段和交接次序；既有语义要求继续以
`doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md`、
`doc/decisions/2026-07-24-v2s-verification-governance.md` 和
`contracts/policy/standards-coverage-matrix.json` 为准，不复制这些正文。

## 3. 强制管线

对每个新的或实质变更的 Journey，顺序固定为：

```text
Journey 裁决
→ UI-bearing 时完成交互工件
→ Dexter 看线框并裁决
→ implementation-facing design + granularity manifest
→ fresh 独立子 agent 对抗盲审（最多两轮）
→ 作者会话辩证 intake 与处置
→ Claude 独立评审
```

- Journey 裁决中的每一 actor 身份与必需数据前提必须在
  `IN_SCOPE_PRODUCED`、`ESTABLISHED_SOURCE`、`EXTERNAL_PREREQUISITE_DEXTER_DECISION`
  三者之一落位；禁止空白、默认账号或“测试时再说”。
- `EXTERNAL_PREREQUISITE_DEXTER_DECISION` 不是可实施前提：未裁决时 Journey 不得进入
  implementation-facing design。
- UI-bearing 指一个 delivery unit 通过 `pageKey` 声明用户可见页面/route/Drawer/公开
  页面或登录/会话交互。该 unit 必须引用交互工件的存在文件和唯一锚点。
- 低保真线框必须在 Dexter 看图后才可进入 implementation-facing design；线框服务于
  信息层级与操作/恢复，不预先选择组件库或视觉稿。
- 无 UI 的 unit 应明确 `notApplicableReason`，不得把未决 UI 或登录前提伪装为无 UI。

<a id="generic-detailed-design-admission"></a>

### 3.1 通用详设准入（所有后续设计）

所有 implementation-facing 详设（无论是否 UI-bearing）都必须先回读原始业务需求或问题材料，并在工件
开头声明 `BUSINESS_REQUIREMENT_SOURCE=<repo-relative path#unique anchor>`、`BUSINESS_PROBLEM`、
`BUSINESS_USER_OR_OWNER`、`CURRENT_TASK` 和可观察的 `SUCCESS_OUTCOME`。这些字段回答“为什么做、为谁
解决什么、做成后什么事实改变”；技术 plan、接口或现有代码不是原始业务来源的替代品。没有来源、只有
技术改动清单，或无法说明业务问题的详设不得进入 implementation-facing design。

UI-bearing 详设还必须完整使用交互模板的逐 screen 准入：逐面明确 consumer face、实际 surface/入口、
业务用户、场景、目标、业务文案、技术边界与 foundation primitive；按 screen 分配可见元素 ownership，
说明输入控件依赖/级联、逐操作用户任务与 owner 边界，并在适用时记录 Heritage 静态基线或 Dexter 豁免。
产品、Journey、物理 surface 或文案存在冲突时，保留 owning-source 原文并交 Dexter 裁决；不得以技术词、
接口形状或猜测的旧页面填补空白。

凡是创建、编辑、凭据、状态/作废或集合替换表单，还必须按交互模板的“新建、编辑与确认 mutation 的字段
事实矩阵”完成有限 `FORM_MUTATION_DENOMINATOR`。每个 command variant 的全部事实都要在
`EDITABLE / FIXED_READONLY / CONDITIONAL_EDITABLE / HIDDEN_OWNER_FACT / GAP` 中恰有一项处置，并同时
回指原始业务任务、request/edge/owner source、唯一取值来源、级联和最终 owner 复核。不得以字段名称
相近、页面复用或“技术字段不展示”为理由合并不同 command，漏掉 immutable/版本/状态/规则 revision，
或让浏览器发明 stable key、资产 grant 与授权范围。动态明细、受控扩展字段和纯确认动作同样适用；这是
后续所有详设的强制人工准入标准。

凡有列表查询、筛选、搜索框、搜索选择、候选多选、级联选择或远程候选控件的 UI-bearing 详设，必须再按
交互模板的“业务驱动的搜索与候选选择详设”建立有限分母。每个 screen 都要先说明用户要找/选的业务对象
及其原始业务问题，再对每一项条件说明控件形态、匹配语义、冻结词表或 owner/contract 来源、级联清理、
owner 再核验，以及为何该形式最适合、为何不采用文本或本地枚举。展示列不等于搜索字段；不支持的 query
参数或候选 read 只能登记为 `GAP` 并进入独立 contract/Journey 裁决，不能由浏览器猜测、用已加载列表
过滤，或以自由文本假装已经支持。无搜索业务任务的 screen 也必须写
`NOT_APPLICABLE_WITH_REASON`，且回指 owning source。这是后续所有设计的强制人工准入标准。
OpenAPI 已声明的 query 也不能单独构成“来源已具备”的证据：详设必须重开 owner controller/task read，
确认其实际接收并服务端应用条件、分页 `total` 使用同一谓词；任一环缺失即 `GAP`，不得由前端代偿。

这是人工详设准入与审查分母，不把自然语言做成伪语义 checker。实际目标路径确定后，才可按三问原则建立
可机械验证的 import、路径或其它结构性控制及真实 red mutation。

#### 3.1.1 后台 operation 设计合同

凡 implementation-facing 详设声明 backend HTTP operation，必须为完整 operation exact-set 的每一行冻结：

1. 有序逻辑步骤，说明校验、载入、owner 判断、写入和 readback 的正常顺序；
2. 有序“条件 → typed problem”映射，映射的 problem code 集合与 operation 的 `problemCodes[]`
   exact-equal；多条件同时成立时以显式 precedence 决定用户可见错误；
3. edge → security/trusted context → application coordinator → initiating/coordinated owner 的调用链、
   owner 用途和事务边界；call chain 中 coordinated owner 集合必须与 assertion matrix exact-equal；
4. 一个具名 canonical normal fixture 下的 request-local `databaseOperationCount` 设计值、逐 owner
   read/write breakdown 与假设。该值包含 request tracker 实际观察到的 session/security、幂等回执、
   CAS、审计及必要 readback，是逐 operation 设计限定，不是通用 SQL 上限或性能结论。

机器门只验证字段存在、顺序连续、集合相等、owner exact-set、非负整数及 breakdown 求和；逻辑是否正确、
异常优先级是否符合用户任务、调用链是否合理、DB 次数是否 set-based 且保留正确性成本，仍由 fresh 独立
审查与 Claude 判断。P2 exit 使用 `RequestCompletionEvent.databaseOperationCount` 对具名 fixture 实测；
设计值与实测值必须相等，差异必须具名记录 operation、设计值、实测值、原因与是否重开设计，不能用
“未超过预算”或“更少也更好”掩盖 N+1 或遗漏 audit/readback。

#### 3.1.2 assertion 到 scenario 的语义可追踪性

需求/IA 到 scenario 的 exact-set 只能证明零漏项，不能证明映射有判别力。每条 assertion 必须写明可观察的
具体业务行为（前提、动作、结果）并指向实际承载它的 scenario；禁止只复述编号、接口名，或把大量无关
IA-ID 挂到同一个通用成功场景。该要求不做自然语言 checker。独立设计 review 与 Claude review 应抽查
绑定数最高的场景、每个 delivery unit 的代表 assertion，以及复制、权限、库存写等高风险行为；逐项对读
owning requirement/IA、fixture 输入和预期结果。不能指出 scenario 实际证明哪条行为时，即使 exact-set
机器门全绿也应形成 finding。

### 3.2 UI 实施与 L2 前的交互符合性准入

#### 3.2.1 首次 UI 源码写入前的 IA baseline 硬门

对已有完整 IA/交互详设的 UI-bearing implementation package，实施者在**第一次**改动任何实际 UI
consumer（页面、Shell、内容 Tab、Drawer、Modal、selector、表单或其直接 UI state owner）前，必须先形成
`UI_IA_PREWRITE_BASELINE`。它以每个 consumer 为一行，绑定全部 approved screen ID、原始业务任务、入口/
surface、控件核对维度，以及 IA 与 physical screen contract 的 path+SHA-256；分母必须等于该 package 将改的
所有 UI consumer。

受管 `PreToolUse` 对 `.tsx` production consumer 的每一次写入必须机械读取当前 implementation package 的
baseline：缺 admission、baseline 不为 PASS、IA/physical source hash 漂移、consumer 不在分母，均 fail closed。
这个机械门只证明“动手前已重开并绑定批准 IA”，不判断自然语言交互的语义，也不替代下面的逐控件最终
conformance record；语义忠实度仍由实施者、独立 review 和 Dexter 判断。无 IA 的 UI work 必须在 package 中写
`NOT_APPLICABLE_WITH_REASON`，不得静默绕过。

凡已有完整交互详设的 UI-bearing 开发步骤，完成源码实现后、启动任何 L2 前，实施者必须逐一对读批准
IA/交互工件与实际页面、内容 Tab、Drawer、Modal、selector、表单字段和其他可操作控件。每项记录必须至少
覆盖：consumer face、用户角色与业务场景、用户目标、入口及界面形态、用户可见文案、数据/候选来源、前提
条件、级联及清理、loading/empty/error/recovery 状态、owner 再核验和禁止项。实现在任一项与批准工件不一致、
没有明确 `NOT_APPLICABLE_WITH_REASON`，或没有定位到物理 consumer 时，L2 不得启动；不得拿 L2 绿、API 绿或
截图代替这次逐项符合性对照。L2 只验证已经获准的交互在真实环境的行为，不能反向证明设计忠实度。

该记录是 implementation package 的人工 review checklist 与 package-exit evidence，不把自然语言交互判断
伪装成新机器门。独立 implementation review 与 Claude review 必须重开该记录、批准 IA 和真实 production
consumer；缺记录或分母不全时只能 NO-GO。

## 4. 机械门与人工判断的边界

granularity checker 只验证 UI-bearing unit 的交互工件 `path` 存在、`anchor` 存在且唯一；
其 self-test 必须证明缺失引用和重复锚点会真红。从下一个 review cycle 起，它仅额外机械检查
独立子 agent 留痕字段与输入清单文件存在性；不读取清单内容或裁决审查语义。它不读取自然语言来
裁决“前提链对不对”、“线框好不好”或“Journey 是否合理”。这些仍由独立子 agent、Claude
独立语义审查和 Dexter 产品裁决处理。

对 schema v2 的 implementation-facing manifest，granularity checker 还读取 hash-bound
`backendOperationDesignContract`，机械验证 §3.1.1 的存在性与 exact-set；历史 schema v1 manifest 不倒灌
新义务。它不读取自然语言 action/condition 来判断业务含义，也不把 DB 次数变成通用 ceiling。

第二轮 hard stop 后的 author remediation 绑定由
`doc/decisions/2026-07-26-v2s-post-remediation-review-binding-governance.md` 修订：旧 review
hash 不得回填；current manifest 只能以诚实的 `postRemediationDeclaration` 绑定历史 review 与
intake，并保持 `AWAITING_CLAUDE`，不能冒充当前字节已被子 agent 审过。

standards matrix 的 `JOURNEY_INTERACTION_REVIEW` 追加两条人工检查项：

1. **前提链对读**：逐 actor 对读身份与数据来源，确认三选一完整、来源适用且未把
   外部/未决前提偷换为既有事实；
2. **交互工件齐备**：UI-bearing Journey 已有 interaction map、低保真线框、状态与
   边界表、逐操作合理性及 face/owner 对齐矩阵，并已由 Dexter 看图；无 UI 的说明
   可被独立核验。

这是 review checklist 的扩展，不是新语义 checker。

## 5. 与既有规范的引用关系

| 既有来源 | 本批引用方式 |
| --- | --- |
| `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md` | 保持其业务用户、Dexter 意图、替代方案、UI 合理性、歧义求证和两轮上限的语义权威；新增第 9 节只引用本批管线与模板 |
| `.agents/skills/cs-spec-to-plan/SKILL.md` | 把本批管线固化为开始 implementation-facing plan 前的独立子 agent 盲审操作顺序 |
| `tools/implementation-design-granularity/cli.mjs` | 接入 UI 交互工件与独立盲审留痕的机械存在性检查及真 red mutation |
| `contracts/policy/standards-coverage-matrix.json` | 只扩充 `JOURNEY_INTERACTION_REVIEW` 人审证据文字，不新增规则分母或语义 gate |
| `doc/platform/claude-review-handoff-template.md` | 继续负责 Claude handoff 的可复制结构；本批不复制它的正文 |

## 6. R3-J02 资产回收台账

以下资产保留为历史输入与问题证据，统一标记 `PENDING_RECOVERY`：不得继续作为
implementation-ready 的依据、不得再次运行其 Claude handoff，也不得删除或改写其
既有对抗审查结论。

| 路径 | 身份 | 回收前不可使用的主张 |
| --- | --- | --- |
| `doc/decisions/2026-07-25-v2s-r3-j02-commercial-group-initialization-selection.md` | 已接受的 J02 平台初始化任务输入 | 它不能单独证明 operations-admin 有真实可登录用户 |
| `doc/plans/platform/2026-07-25-v2s-r3-j02-commercial-group-initialization-implementation-design.md` | implementation-facing 设计草案 | operations 独立登录/session 已闭环、九 operation 分母已可实施 |
| `doc/review/platform/2026-07-25-v2s-r3-j02-design-granularity-manifest.json` | 历史粒度 manifest | 可作为当前 handoff 或 implementation gate 输入 |
| `doc/review/platform/2026-07-25-v2s-r3-j02-design-*.md` 与 `*.json` | 历史 Codex 评审/处置证据 | 可替代新的 Journey 裁决、交互工件或 Claude 结论 |
| `doc/review/platform/2026-07-25-v2s-r3-j02-design-review-request.md` | 已暂停的 Claude handoff | 可继续发送或得出当前 GO/NO-GO |

`PENDING_RECOVERY` 不表示 J02 被废弃：第二批完成 inventory 后，Dexter 可以决定保留、
收窄、拆分或终止该候选 Journey。任何恢复都必须从新的 Journey 裁决和（如 UI-bearing）
交互工件开始，而不是修补旧 manifest。

## 7. 冻结与后续

第一批冻结条件：本 decision、两个模板、skill/policy 引用、checker 的 path+unique-anchor
真红证明、standards checklist 更新，以及 Claude review handoff 均已存在并通过相应
机械检查。冻结后只等待 Claude 与 Dexter；不得开始第二批 inventory，不得重启 J02。

## 8. 2026-07-25 独立子 agent 对抗审查修订

从下一个 `REVIEW_CYCLE_ID + REVIEW_TARGET + 批准范围` 起，`REVIEW_TARGET=DESIGN` 与
`REVIEW_TARGET=IMPLEMENTATION` 的每一轮对抗审查必须由与作者会话不同、fresh 上下文的独立子
agent 执行。作者会话仅可在独立 verdict 形成后进行辩证 intake、逐条 reopen 与处置；不得以作者
自审代写或取代该 verdict。两轮上限和第二轮 `SELF_DECIDED` 收口规则不变，但其依据是独立子
agent 的 findings 与作者处置证据。详见
`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`。

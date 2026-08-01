# 已识别问题的通用化与防再犯裁决

Dexter 于 2026-07-27 明确要求：

> 对于已经识别的实施过程中的问题，不管是设计问题还是实施问题还是测试问题，必须抽象成通用的问题描述与解决办法，并沉淀成项目记忆或门中，尽量下次可以避免再犯同样的错误。

## 1. 强制原则

`IDENTIFIED_FINDING_GENERALIZATION_REQUIRED`：任何已确认的设计、实施、测试或验证问题，
都不能以修复一个文件、一个调用点或一条测试作为完整关闭。关闭前必须把具体症状抽象为：

1. 不依赖当前文件名的通用失败模式；
2. 根因所属层（设计遗漏、实施偏离、控制假绿、测试缺口或证据失真）；
3. 有限适用分母与明确反例边界；
4. 可复用的最小解决办法；
5. 防再犯落点及其验证证据。

`USER_REPORTED_PROBLEM_FAMILY_DISCOVERY_REQUIRED`：用户指出的任何问题都必须先作为一个
待验证的问题族入口处理，不得把用户点名的文件、字段、字符串或失败信号直接等同于完整分母。
开始修改前必须完成并留痕：

1. 与文件名无关的通用问题描述和根因类别；
2. 可枚举的有限分母、实际检索面与检索式；
3. 同根症状的全量命中清单；
4. 主动寻找的反例、合法边界与 `NOT_APPLICABLE` 成员；
5. findings 集合与防再犯处置集合的 set equality。

若用户输入不是问题报告，必须显式处置为 `NOT_A_PROBLEM` 并说明理由；不得用该分支逃避
已经明确指出的设计、实施、测试、控制或证据缺陷。

`PROBLEM_FAMILY_DENOMINATOR_BEFORE_FIX`：问题族证据未形成前，PreToolUse 必须拒绝业务、
契约、测试、脚本或控制源码修改。机械 hook 只验证 prompt intake、disposition、证据字段、
有限分母非空及 findings/prevention 集合相等，不判断语义是否穷尽；语义完整性仍由 agent
负责，并在 package-exit 与后续独立 review 中重新核验。

## 2. 防再犯落点

`IDENTIFIED_FINDING_PREVENTION_DESTINATION_REQUIRED`：每个已确认问题必须且只能选择下列
一种主要落点，并说明为什么：

- `PROJECT_MEMORY`：需要语义判断、上下文路由或实施纪律才能避免的问题；
- `EXISTING_MACHINE_CONTROL`：会复发、判定纯机械且维护成本低于未来返工的问题；
- `REVIEW_CHECKLIST`：重要但不能由机器诚实判断的问题；
- `NOT_APPLICABLE_WITH_REASON`：问题不具备可迁移性，必须写出具体反例与不泛化理由。

不得为了“有门”而新增门类别。进入 `EXISTING_MACHINE_CONTROL` 的项仍须满足验证治理建门三问，
复用既有 gate/ArchUnit/negative fixture，并在 production validator 上完成真实 red mutation；
做不到就回到 project-memory 或 review checklist，不得用关键词门冒充理解业务。

## 3. 包级闭合

每个 implementation package 的 package-exit 必须将本包已识别问题集合与预防处置集合做
set equality。每项至少记录：

`findingId / genericProblem / rootCauseClass / applicability / preventionDestination /
owningSourceOrControl / evidence`。

存在已确认问题但没有预防处置时，package-exit 不得 PASS。Pre/Post hook 继续只记录路径、
哈希与机械结果，不读取聊天或自动生成语义结论；问题抽象由 agent 完成，集合完整性由既有
package-exit 机械核对。

每次 UserPromptSubmit 只记录 prompt hash 与待处置状态，不保存或注入 prompt 正文，不查询
memory/code。PreToolUse 在写入前读取对应 disposition；package-exit 枚举本包全部 intake，
要求逐条完成 `NOT_A_PROBLEM` 或 `PROBLEM_FAMILY_DISCOVERY_COMPLETE`。这属于合规闸口，
不改变 `PROMPT_RECOMMENDS_ONLY` 的上下文注入边界。

## 4. 与既有规则的关系

- 本裁决强化 `SYSTEMIC_REPAIR_BEFORE_NEXT_PHASE`，不替代具体业务、测试或 cleanup closure；
- 不改变 `MACHINE_GATES_MECHANICAL_ONLY` 与 `GATE_ADMISSION_THREE_QUESTIONS`；
- 不授权新的业务范围、runtime、DEV、seed/reset 或跨 package 实施；
- 修复与沉淀应在发现问题的当前包内完成；若 owning package 不同，必须登记明确 successor
  obligation，禁止用 `PENDING` 或泛化 HANDOFF 冒充关闭。

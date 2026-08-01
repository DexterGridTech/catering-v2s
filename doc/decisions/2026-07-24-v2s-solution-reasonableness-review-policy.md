---
title: catering-v2s 方案合理性优先评审策略
status: active
createdAt: 2026-07-24
programContext: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
---

# catering-v2s 方案合理性优先评审策略

## 1. 强制原则

本策略的主要执行者是 **Codex**：Codex 在完成 design 或 implementation、对外宣称 evidence/closure 就绪之前，必须先做一次本策略规定的对抗式自审。Claude 的独立复核继续执行同一质量底线，但不能替代 Codex 自审。

任何 design、implementation、UI、contract、evidence 或 closure 的 Codex 对抗式自审，必须先从业务用户与 Dexter 的立场判断“问题是否正确、方案是否合理、代价是否匹配”，再检查报告、代码、测试与证据是否完整闭环。

`SOLUTION_REASONABLENESS_FIRST` 的含义是：

- “`1+1=2` 算对且闭环”只是地板，不是 GO 的充分条件；
- reviewer 必须独立构造至少一个更简单或更直接的替代方案，例如比较 `3-1`，并判断 Dexter 真正要解决的是否其实是 `5-4`；
- 方案方向错误、用户任务错误、复杂度与收益不匹配，即使代码完整、门全绿，也必须形成 finding；
- reviewer 必须先独立推导预期问题与候选方案，再读作者结论，禁止被作者报告锚定。

## 2. 固定审查顺序

每次 Codex 对抗式自审按以下顺序输出：

1. 业务用户此刻真正要完成的任务与成功结果；
2. Dexter 的范围、阶段与成本立场；
3. 作者方案之外至少一个可行替代，以及为什么不选；
4. 当前方案的复杂度、收益、不可逆代价与失败路径；
5. 方案合理性 verdict；
6. 最后才核验 owner、transaction、schema、security、contract、UI、代码、测试、evidence 与 cleanup 闭环。

缺少前五项的评审不得标 GO，也不得以“代码/报告完整”“门全绿”代替。

## 3. UI 与交互特别规则

`UI_USER_TASK_VALIDATION` 要求任何 UI 设计或实施审查逐项回答：

- 这个操作是否来自用户明确要求或已批准 Journey，而不是从接口、表结构、旧页面或实现便利反推；
- 用户为什么会在此时做这个操作，前后步骤、信息层级、默认值、反馈与恢复是否合逻辑；
- 是否存在更短、更自然、更少选择或更少上下文切换的路径；
- 当前交互若不合理，根因是后台接口限制、owner/contract 边界、旧文档模糊、历史实现惯性，还是产品语义尚未裁决；
- 页面形状是否服务任务，而不是用 CRUD 表格、disabled 表单、万能组件或静态壳冒充完成；
- UI 隐藏、路由、按钮状态或生成面不能替代服务端授权与 owner readback。

UI/交互不适用时必须写清 `NOT_APPLICABLE` 及理由，不能静默省略。

## 4. 歧义与求证

`AMBIGUITY_REQUIRES_DEXTER` 要求 reviewer 在无法从批准 Journey、decision、contract 或用户原话判断真实意图时：

1. 列出候选理解与各自影响；
2. 明确指出歧义来源；
3. 给出推荐选项及理由；
4. 在会改变产品语义、Journey、页面操作或范围时向 Dexter 求证；
5. 未获裁决前保持 design/implementation `NO_GO` 或受阻，不让接口现状、模糊旧文档或作者偏好偷偷代替产品决定。

技术实现细节可在批准边界内自行判断；产品/Journey 语义不得由实现反推。

## 5. 强制落点

本策略必须同时出现在：

- `AGENTS.md` 与 `CLAUDE.md` 的评审入口约束；
- Codex 设计/实施交付前的自审产物与 `.agents/skills/cs-spec-to-plan/SKILL.md`；
- always-read `project-memory/kernel/04-contract-consumer-and-admin.md`；
- `project-memory/required-inventory.json` 的 assertion/source 完整性；
- `contracts/policy/standards-coverage-matrix.json` 的 Journey/interaction review checklist；
- `scripts/check/codex-self-review` 的 production validator、self-test、closure-only 与 blind-finding-acceptance red fixture；
- `CLAUDE.md` 保持独立审查的同等质量下限，但 Claude 审查不能替代 Codex 自审。

任一落点缺失或 handoff 未含“方案合理性”与 UI/交互适用性声明，都不得声称该约束已执行。

## 6. 实施后代码对抗自审

设计通过不豁免实施代码。Codex 完成实现后必须以 `REVIEW_TARGET=IMPLEMENTATION` 重新执行同一套对抗自审，并额外：

- 重开实际生产源码、调用链、配置、contract/generated consumer 与数据库/运行边界，不能只读 implementation report；
- 通过编译器、focused test、L2/L3 或受管动态 evidence 观察真实用户行为；
- 再次判断实现出来的操作是否仍符合业务用户任务与 Dexter 意图，而不是只判断“代码是否忠实实现设计”；
- 若代码暴露设计本身不合理、后台接口迫使 UI 绕路、旧文档含糊或有更优路径，必须重开设计 finding，不能以“按设计实现”为免责理由；
- UI 实现必须亲验真实操作顺序、反馈、失败恢复、权限与 owner readback；截图像、组件齐、接口通都不是合理性的充分证明。

`scripts/check/codex-self-review` 对 implementation target 强制要求“实施代码核验”段，包含源码回读、可执行 evidence 与业务用户行为复查。

## 7. 对抗审查结果接收门

`ADVERSARIAL_FINDING_DIALECTICAL_INTAKE` 要求 Codex 把任何 reviewer finding 当作待验证输入，而不是新权威。独立 reviewer、Claude、Codex 子审查或工具报告都不能因为“独立”“专业”或写得完整就被全盘接受，也不能因结论不方便就直接拒绝。

Codex 必须逐条完成：

1. 分类 finding 属于仓内事实、外部版本/规范事实、推理判断、产品/Journey 裁决，还是证据不足的假设；
2. 重开 owning source、真实代码/contract/evidence；外部且可能漂移的事实用官方文档、一手规范或可复现实验印证，并把事实与推论分开；
3. 主动寻找反例、适用条件和与当前阶段/拓扑不匹配之处，判断 finding 是 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 还是 `DEXTER_DECISION`；
4. 只让已确认部分驱动修订；`UNVERIFIED` 不得升级为强制范围，产品/Journey 歧义不得由 reviewer 或实现反推；
5. 对 reviewer 提出的修复同样比较至少一个更小替代、阶段成本、收益与新风险，拒绝为满足审查形式而过度设计；
6. resolution 必须保留原 finding、复核证据、接收/拒绝理由、最小修复和残余风险，不能只写“已处理”。

信息不全时允许保持 `NO_GO / UNVERIFIED` 并继续求证；不允许用自信措辞填补缺失证据。

## 8. Codex 对抗审查最多两轮

`CODEX_ADVERSARIAL_REVIEW_MAX_TWO_ROUNDS` 防止审查变成无休止的自我对抗。对同一个 `REVIEW_CYCLE_ID + REVIEW_TARGET + 批准范围`：

1. Codex 对抗审查最多两轮。第一轮用于独立暴露盲点和补足信息；只有逐条辩证处置后仍有值得验证的实质不确定性，才进入第二轮定向复核；
2. 第二轮是硬停止点。Codex 必须综合两轮 finding、owning source、反例、适用边界、成本与残余风险，自行给出 `GO / NO_GO / DEXTER_DECISION`，不得再召集第三个 Codex reviewer 或以“再确认一次”延长循环；
3. 换 reviewer、换模型、改文件名、重算 hash、措辞调整或对同一方案做局部修订，都不重置轮次；
4. 只有 `REVIEW_TARGET` 从 DESIGN 变为 IMPLEMENTATION，或 Dexter 实质改变产品 Journey、批准范围、授权边界，或 reviewed implementation/evidence 的目标发生实质变化，才可建立新的 `REVIEW_CYCLE_ID`；必须记录旧 cycle 与重置触发事实，不能用普通 finding 修复冒充新周期；
5. 每份 Codex 自审必须声明 `REVIEW_CYCLE_ID`、`REVIEW_ROUND=1|2` 与 `REVIEW_ROUND_LIMIT=2`。第二轮还必须声明 `ROUND_FINAL_DECISION=SELF_DECIDED`，并把未决产品/权限事项直接交 Dexter，而不是继续内部审查；
6. design 与 implementation 各自最多两轮；implementation target 不能借用 design 轮次豁免代码审查，也不能因代码反复修改无限重启 implementation 审查。

两轮上限限制的是 Codex 自身对抗循环，不削弱必需的一手资料查证、测试、Claude 独立评审或 Dexter 裁决；它要求 Codex 在信息已足够时承担决策责任。

## 9. Journey 裁决与交互工件的前置次序

本策略的 UI 审查义务通过
`doc/decisions/2026-07-25-v2s-design-governance-batch-1.md` 及其两个模板获得可审查的
工件落点。对新的或实质变更的 Journey，必须先完成 Journey 裁决；UI-bearing Journey
再完成 interaction map、低保真线框、状态/边界、逐操作合理性和 face/owner 对齐，并由
Dexter 看图后，才可以写 implementation-facing design。

这条次序不新增产品语义，也不把线框质量交给 checker 判断。actor 身份/数据前提未能
落入“范围内产生、已有来源、外部前提待 Dexter 裁决”之一时，保持 `NO_GO` 或受阻；
不得借账号、seed、技术 session 或页面壳推导出一个用户 Journey。

## 10. 2026-07-25 独立子 agent 修订

自下一个 review cycle 起，本策略中由作者会话执行和写出 `REVIEW_TARGET=DESIGN` 或
`REVIEW_TARGET=IMPLEMENTATION` 对抗 verdict 的表述，均由
`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`
替代：每一轮须由 fresh 独立子 agent 在未读作者自审材料前，以证伪目标为立场形成 findings 与
verdict。作者只能在 verdict 后执行第 7 节的辩证 intake 与处置，不得代写 verdict。

第 8 节的两轮上限、cycle 重置条件和第二轮 `ROUND_FINAL_DECISION=SELF_DECIDED` 保持不变；
其收口依据改为独立子 agent findings 加作者的可审计 disposition。缺少最小输入清单、盲审声明、
`reviewerKind=INDEPENDENT_SUBAGENT` 或输入清单文件时，该轮无效。已收口 cycle 不追溯重开。

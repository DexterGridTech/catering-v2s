---
id: kernel.contract-admin
status: active
layer: kernel
taskKinds: ["all"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["all"]
assertions: ["X_CONSUMER_FACES_ONLY","TWO_ADMIN_APPS","OWNER_RECHECKS_COMMAND","SOLUTION_REASONABLENESS_FIRST","UI_USER_TASK_VALIDATION","AMBIGUITY_REQUIRES_DEXTER","IMPLEMENTATION_CODE_REVIEW_SAME_STANDARD","ADVERSARIAL_FINDING_DIALECTICAL_INTAKE","INDEPENDENT_SUBAGENT_ADVERSARIAL_REVIEW","CODEX_ADVERSARIAL_REVIEW_MAX_TWO_ROUNDS","MAIN_AGENT_REVIEW_FALLBACK_AFTER_REPEATED_SUBAGENT_FAILURE"]
sourceRefs: ["doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md","doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md","doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md","doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md"]
---
# Contract, consumer and admin kernel

- `X_CONSUMER_FACES_ONLY`: `x-consumer-faces` 是 HTTP operation 暴露面的单一真相。
- `TWO_ADMIN_APPS`: `platform-admin` 与 `operations-admin` 必须是两个独立 app。
- `OWNER_RECHECKS_COMMAND`: owner 在命令事务内复核授权、状态和当前事实。
- `SOLUTION_REASONABLENESS_FIRST`: 对抗式审查先从业务用户与 Dexter 立场独立判断真实问题、替代方案和代价，再检查报告、代码与证据闭环。
- `UI_USER_TASK_VALIDATION`: UI 操作必须来自用户明确要求或批准 Journey，符合真实任务且比较过更优路径；不得从接口、表结构或旧页面反推。
- `AMBIGUITY_REQUIRES_DEXTER`: 产品/Journey/页面操作语义不清时列出候选、归因歧义并向 Dexter 求证，未裁决前不得 GO。
- `IMPLEMENTATION_CODE_REVIEW_SAME_STANDARD`: 代码实现完成后 Codex 必须按同一标准重开生产源码与真实用户行为 evidence 做对抗自审；忠实实现已批设计不构成豁免。
- `ADVERSARIAL_FINDING_DIALECTICAL_INTAKE`: reviewer finding 只是待验证输入；Codex 必须重开证据、查一手资料、找反例与适用边界，区分确认/部分确认/有证据拒绝/待求证/Dexter 裁决，并比较更小修复，禁止全盘接受、过度设计或信息不足下武断裁决。
- `INDEPENDENT_SUBAGENT_ADVERSARIAL_REVIEW`: 自下一 review cycle 起，DESIGN/IMPLEMENTATION 的每轮对抗审查由 fresh 独立子 agent 盲审；作者仅在 verdict 后 intake 与处置，不得代写 verdict。
- `CODEX_ADVERSARIAL_REVIEW_MAX_TWO_ROUNDS`: 只管 agent 自己的需求/详设/实施计划（`REVIEW_TARGET=DESIGN`）由 fresh 子 agent 做的对抗审查：同一 cycle/批准范围最多两轮；第二轮后作者基于独立子 agent findings 与处置证据按既有 `SELF_DECIDED` 规则收口，换 reviewer、模型、文件、hash 或局部修订不得重置，只有 Dexter 实质改变 Journey/范围/授权/目标才建立新 cycle。以下不受两轮上限（Dexter 2026-09-14）：经 Dexter 中转的 Codex↔Claude review；实施过程中的实施结果对账；实施完成后整批 `REVIEW_TARGET=IMPLEMENTATION` 对抗 review（必须依据详设）。详见 `decisions.independent-subagent-adversarial-review`。
- `MAIN_AGENT_REVIEW_FALLBACK_AFTER_REPEATED_SUBAGENT_FAILURE`: 正常路径仍必须优先使用 fresh 独立子 agent；仅当同一 review 任务的 fresh reviewer 因工具错误、运行失败、明确越界或经诊断确认的卡死，连续至少三次都未能产出可用 verdict/对账结论时，主 agent 才必须接管完成同一范围。每次失败都要保留真实 status、已读范围、first failure、broken boundary 和原因；NO-GO 本身不是失败，不得用该回退绕过有效 finding。主 agent 的回退结果对本任务同样有效，但必须明确标记 `REVIEW_FALLBACK=MAIN_AGENT_AFTER_REPEATED_SUBAGENT_FAILURE`，不得冒充 `INDEPENDENT_SUBAGENT`，不得伪造 fresh checklist/verdict；缺少可核实输入的部分仍为 `OPEN`，并把回退及失败记录交 Dexter/Claude 可见。

---
id: operations.verification-governance
status: active
layer: routed
taskKinds: ["design", "implementation", "testing", "review"]
domains: ["platform", "backend", "contract", "admin-ui"]
consumerFaces: ["all"]
owners: ["platform", "backend", "contract", "frontend-platform", "product"]
impacts: ["evidence", "governance"]
triggers: ["implementation", "review", "runtime"]
assertions: ["MACHINE_GATES_MECHANICAL_ONLY", "SEMANTIC_QUALITY_INDEPENDENT_REVIEW", "DEXTER_OWNS_INTENT_AND_SEVERITY", "GATE_ADMISSION_THREE_QUESTIONS", "PRODUCTION_RED_MUTATION_REQUIRED", "CONTROL_RETIREMENT_AFTER_FIVE_PACKAGES", "SMALL_BATCH_FREEZE_REVIEW", "VERIFY_MINUTE_BUDGET", "UI_INTERACTION_CONFORMANCE_BEFORE_L2"]
sourceRefs: ["doc/decisions/2026-07-24-v2s-verification-governance.md", "doc/decisions/2026-07-25-v2s-design-governance-batch-1.md", "project-memory/operations/verification-governance.md"]
---

# Verification governance

- `MACHINE_GATES_MECHANICAL_ONLY`: 机器门只处理一行可说清、无需理解业务的机械判定，代码与文档冻结输入同等 hash。
- `SEMANTIC_QUALITY_INDEPENDENT_REVIEW`: 业务语义、用户任务、方案与交互合理性由 fresh 独立对抗审查及 Claude review 判断；不得编码为伪语义 checker。
- `DEXTER_OWNS_INTENT_AND_SEVERITY`: 方案该不该做、产品意图与 severity 接受度由 Dexter 裁定。
- `GATE_ADMISSION_THREE_QUESTIONS`: 新门必须同时证明错误会复发、判定纯机械、维护成本低于未来返工；否则进入 review checklist。
- `PRODUCTION_RED_MUTATION_REQUIRED`: 每个门必须驱动 production 本体，并有已验证会改变行为的真实 red mutation；伪语义门按 finding 处理。
- `CONTROL_RETIREMENT_AFTER_FIVE_PACKAGES`: 机器门、分母或记录要求若在最近五个 package 中一次都没有变红，必须在下一个 package 显式处置为人工 checklist、最小化保留或删除；保留时必须写明仍需保留的理由及预期拦截的具体失效模式。该判据只约束治理控制的生命周期，不削弱曾经真实变红的门。
- `SMALL_BATCH_FREEZE_REVIEW`: 交付超过评审者半小时可核量时，先切小、冻结并送独立审查，不以叠加轮次替代。
- `VERIFY_MINUTE_BUDGET`: `scripts/verify` 保持分钟级；变慢先砍最弱门，既有过重门不再扩展或仿效。
- `UI_INTERACTION_CONFORMANCE_BEFORE_L2`: 对已有完整交互详设的 UI-bearing 实施，逐页面/控件对读批准 IA、物理 consumer 与真实交互记录是 L2 的前置准入。必须逐项覆盖用户任务、入口/形态、文案、数据来源、前提、级联/清理、状态/恢复、owner 再核验和禁止项；任一偏差或未处置项禁止启动 L2。该项属于人工 package-exit/review checklist，L2 不可替代它。

---
id: decisions.deterministic-context-only
status: active
layer: routed
taskKinds: ["memory-recall","design","implementation","review","testing"]
domains: ["platform","backend","contract","admin-ui"]
consumerFaces: ["all"]
owners: ["platform","backend","product"]
impacts: ["memory","session","architecture","transaction","database","contract","evidence","governance"]
triggers: ["session-start","task-start","implementation","review","status-question"]
assertions: ["NO_PROVIDER","NO_DAEMON","PROMPT_RECOMMENDS_ONLY","MACHINE_OR_REVIEW_DESTINATION","CLAUDE_ENTRY_INTENTIONAL","RETIRED_COMPLIANCE_CONTROL_TRACEABILITY"]
sourceRefs: ["doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md","doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","doc/review/platform/2026-08-13-v2s-compliance-control-retirement-decision-claude.md"]
---
# Deterministic context only

- `NO_PROVIDER`: project-memory 不依赖语义 provider。
- `NO_DAEMON`: 不运行后台索引 daemon 或 index service。
- `PROMPT_RECOMMENDS_ONLY`: Prompt hook 只推荐一个仓内 skill，不查询或注入 memory/code。
- `RETIRED_COMPLIANCE_CONTROL_TRACEABILITY`: manifest Part B-D、`standards-coverage-matrix.json`、原文 hash 与 package traceability 已于 2026-08-13 退役；它们不得再作为会话、设计、实施或评审的准入条件。原始材料与真实源码仍须按任务需要亲验。
- `MACHINE_OR_REVIEW_DESTINATION`: 每条规则必须绑定真实 gate/ArchUnit/negative fixture，或诚实标为 `UNENFORCEABLE_BY_MACHINE` 并绑定明确评审清单。
- `CLAUDE_ENTRY_INTENTIONAL`: Claude review 当前由人从仓根发起并按 `CLAUDE.md` 读取同一入口链；未验证真实客户端 hook 契约前不创建第二套 hook 配置。

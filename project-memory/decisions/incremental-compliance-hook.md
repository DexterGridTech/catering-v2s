---
id: decisions.incremental-compliance-hook
status: retired
layer: routed
taskKinds: ["design","implementation","review","testing"]
domains: ["platform","backend","contract","admin-ui"]
consumerFaces: ["all"]
owners: ["platform","backend","contract","frontend-platform","product"]
impacts: ["evidence","governance","memory"]
triggers: ["task-start","implementation","review"]
assertions: ["RETIRED_COMPLIANCE_CONTROL"]
sourceRefs: ["doc/plans/platform/2026-07-27-v2s-r5-compliance-remediation-implementation-design-and-plan.md", "project-memory/decisions/incremental-compliance-hook.md"]
---

# Incremental compliance hook — RETIRED

2026-08-13 Dexter 裁定：PreToolUse/PostToolUse compliance、package entry/exit、receipt、hash-chain 与 active-package recovery 全部退役，不得以本文件重开或恢复。逐点重开原始材料与源码仍是实施纪律，但只由人和真实编译、测试、运行结果判断，不再机械记账。

## Source

`doc/plans/platform/2026-07-27-v2s-r5-compliance-remediation-implementation-design-and-plan.md`
§2.2–§3；当前 CR00 canary evidence 绑定于
`doc/evidence/platform/2026-07-27-v2s-r5-cr00-hook-canary-evidence.json`。

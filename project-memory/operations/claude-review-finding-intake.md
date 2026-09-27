---
id: operations.claude-review-finding-intake
title: Claude 评审 finding 由主 agent 核验和处置
type: operation
status: active
layer: routed
scope: every Claude review finding relayed to Codex by Dexter
createdAt: 2026-09-26
taskKinds: ["review"]
domains: ["platform"]
consumerFaces: ["all"]
owners: ["platform"]
impacts: ["evidence", "governance"]
triggers: ["task-start", "review"]
assertions: ["CLAUDE_REVIEW_FINDINGS_MAIN_AGENT_OWNS_INTAKE_AND_REPAIR"]
sourceRefs: ["project-memory/operations/claude-review-finding-intake.md"]
---

# Claude 评审 finding 由主 agent 核验和处置

Dexter 转交 Claude 的 review findings 是待核验输入，不自动成为事实、severity 或修复授权。对这些 findings 的 intake、事实判断、产品/方案取舍与修改由 Codex 主 agent 亲自完成；不得把核验、裁决、修复或 finding disposition 文稿派给子 agent。

主 agent 必须逐条重开 finding 指向的 owning source、当前被审文档与适用证据，检验 reviewer 的前提，主动寻找反例和适用边界；外部漂移事实用官方一手资料或可复现实验核实。每条 finding 记录 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，并写清证据、影响、最小修正与剩余不确定性。不能核实的部分保持 OPEN，不能以子 agent 的意见代替主 agent 亲验。

主 agent 独自比较更小的修复和阶段成本，并独自修改获授权的文件；完成后逐项回读修改与 owning source，确保没有扩展授权范围。已有子 agent 输出最多只能作为检索线索，不是此类 findings 的独立验证或结论。

本规则只界定 Claude findings 的核验和处置责任，不取代单独适用的独立对抗 review 治理。任何另行强制的独立 review 必须是范围清楚、与 Claude finding intake 分开的审查阶段；不得声称它替主 agent 完成了 Claude finding 核验或修复。本规则不授予实现、测试、动态运行、数据或其他超出 Dexter 当前明确指派的权限。

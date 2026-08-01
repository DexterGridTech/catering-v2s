---
id: operations.claude-review-handoff-standard
title: Claude 评审交付必须可复制且自足
type: operation
status: active
layer: routed
scope: every Codex-to-Dexter Claude review handoff
createdAt: 2026-07-24
taskKinds: ["review", "design", "implementation"]
domains: ["platform"]
consumerFaces: ["platform-admin", "operations-admin"]
owners: ["platform", "product"]
impacts: ["evidence", "governance"]
triggers: ["review", "implementation"]
assertions: ["CLAUDE_HANDOFF_COPYABLE_SELF_CONTAINED", "CLAUDE_HANDOFF_RELATIVE_PATHS_ONLY", "CLAUDE_HANDOFF_EXPLICIT_AUTHORITY_BOUNDARY"]
sourceRefs: ["CLAUDE.md", "doc/platform/claude-review-handoff-template.md"]
---

# Claude 评审交付必须可复制且自足

## 规则

当交付需要 Dexter 转交 Claude 评审时，Codex 的最终回复必须**直接**给出一段可复制粘贴、礼貌的中文话术。话术顺序固定为：背景、评审目标、从仓库根可打开的相对路径、独立核验重点、`GO`/`NO-GO` 与 `M/S/N` finding 格式、结论授权边界。

不得只给 review 文件链接、不得只说“请 review”、不得用本机绝对路径替代仓库相对路径。review 文件必须采用 `doc/platform/claude-review-handoff-template.md`，并在交付前通过 `scripts/check/claude-review-handoff --file <review-request>`。

## 适用与边界

该检查只验证仓库内 review 文件的结构与可复制话术，不能机械读取聊天最终回复。因此，`AGENTS.md`、`CLAUDE.md` 和本规则共同把“最终回复直接渲染话术”设为交付硬要求；任一缺失时，只能报告评审材料未就绪。

这条规则不替代 Claude 的独立审查，也不把 Claude 的 `GO` 自动升级为产品批准、业务实现、Git、动态运行或切流授权。

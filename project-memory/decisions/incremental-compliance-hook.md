---
id: decisions.incremental-compliance-hook
status: active
layer: routed
taskKinds: ["design","implementation","review","testing"]
domains: ["platform","backend","contract","admin-ui"]
consumerFaces: ["all"]
owners: ["platform","backend","contract","frontend-platform","product"]
impacts: ["evidence","governance","memory"]
triggers: ["task-start","implementation","review"]
assertions: ["INCREMENTAL_COMPLIANCE_HOOK_NO_CONTEXT_INJECTION","CODEX_MUTATION_HOOK_CONTRACT_UNVERIFIED","PACKAGE_EXIT_CHANGED_PATH_LIST_ONLY"]
sourceRefs: ["doc/plans/platform/2026-07-27-v2s-r5-compliance-remediation-implementation-design-and-plan.md", "project-memory/decisions/incremental-compliance-hook.md"]
---

# Incremental compliance hook

## Assertions

- `INCREMENTAL_COMPLIANCE_HOOK_NO_CONTEXT_INJECTION`：PreToolUse 与 PostToolUse 只校验仓库写入路径、包级授权与哈希 receipt；它们不读取聊天、memory 或业务源码来生成 prompt context，因而不改变 `PROMPT_RECOMMENDS_ONLY` 的边界。
- `CODEX_MUTATION_HOOK_CONTRACT_UNVERIFIED`：在真实 Codex client positive/negative invocation canary 未绑定当前 hook 与 control bytes 前，任何 package 不得声称文件级增量核对已生效。
- `PACKAGE_EXIT_CHANGED_PATH_LIST_ONLY`：implementation package exit 只保留本包实际变更文件的路径清单，供人工与评审定位；不再要求 actualChangedPaths 与 incrementalChecks 双向 exact-set、逐条 afterSha256 复算或 sourceComplianceDisposition hash 绑定。真正的语义与契约风险由 typecheck、focused test、generated drift、真实 red mutation 和独立 review 负责。
- `POINTWISE_REREAD_IS_ADVISORY_ONLY`：逐点重开 IA、原始业务、项目记忆、详设与可复用源码仍是建议性的实施纪律，但不再要求 prewrite baseline、correction audit、逐点读取记录或把其缺失作为 hook/package-exit 阻断项；不可事后机械证明的思考过程不伪造为证据。
- `ACTIVE_PACKAGE_RECOVERY_AND_DECLARED_SCOPE`：active package 的 exact `allowedChangeSurfaces` 只作为证据与 package-exit 分母；实施期的新增同根文件必须落在 package 声明的 `changeSurfaceScopes` 内并取得真实 receipt/readback，不能因未提前列名而被误判越界。active package 解析失败时，Pre/Post 只允许固定 recovery request/control-plane 路径，recovery command 必须重新通过 schema、当前 delivery binding、manifest surface 与 UI admission 校验；不得以恢复通道放开源码写入。

## Source

`doc/plans/platform/2026-07-27-v2s-r5-compliance-remediation-implementation-design-and-plan.md`
§2.2–§3；当前 CR00 canary evidence 绑定于
`doc/evidence/platform/2026-07-27-v2s-r5-cr00-hook-canary-evidence.json`。

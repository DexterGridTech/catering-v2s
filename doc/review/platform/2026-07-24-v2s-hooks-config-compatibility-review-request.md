# catering-v2s Codex hooks 配置兼容性修复复核请求

```text
REVIEW_STATUS=READY
REVIEW_KIND=R2_CONTROL_PLANE_DEFECT_FIX
PROGRAM_ID=V2S_W0_W4_EXECUTION
CURRENT_STEP=R2
CURRENT_STATUS=IN_REVIEW
CODEX_VERSION=0.144.6
HOOKS_CONFIG_SHA256=82b43833b89f257cc8d7b4431215a325bee6f5b5cf6f9eb82f3455a02bbfaafe
AGENT_LIFECYCLE_SHA256=0a82ac8d9dc78e80426491837f4b935d7c2729bf9dc1ad4f1811f7ee0e0698ac
DEFECT_EVIDENCE_SHA256=0ad5115a59237f53c46b4e7ef8b402fd7400da8c067dd8311f7d02c87df01bf7
DEFECT_RESOLUTION_SHA256=3962f426f2ba92ba0b41cc10abfb6429358f13f24c78e7b915271a1eb72f4c1e
ROADMAP_SHA256=a36fc88b0c151fdae719365b11925941a20e7de771b970f8e6eb11b03ac50392
STANDARDS_MATRIX_SHA256=358dc6bea08b6094ce7bf633bf68ffcbb4dab777c895f87627b7b5d9b4a18ce9
```

## 背景

Dexter 在 `catering-v2s` 根开启 fresh Codex 会话时，Codex 0.144.6 在 hook 执行前报告 `.codex/hooks.json` 顶层 `schemaVersion` 不受支持。Codex 使用原生 `codex exec --ephemeral` 路径独立复现后发现，三个 lifecycle event 同时使用了旧的扁平注册结构，而既有 `agent-lifecycle` checker 把同一旧结构当作 expected value并绕过客户端 parser，形成假绿。

Dexter 只授权完成 hook schema 兼容性修复、回归门和缺陷证据。当前 Roadmap 仍为 R2 `IN_REVIEW`。

## 评审目标

请独立核验：

1. `.codex/hooks.json` 是否符合当前 Codex event-group/typed-command schema，同时保持唯一三个批准事件、原命令和 5 秒 timeout；
2. `agent-lifecycle` 是否通过生产 validator 同时拒绝未知顶层字段和旧式扁平注册，而非另写只展示不接线的 self-test；
3. checker 是否仍从生产配置解析并执行三个真实注册命令，原有 Prompt injection、active goal 与 cleanup controls 是否未退化；
4. Codex 原生客户端复验是否真正消除了 parse failure，而没有把静态 checker PASS 冒充 fresh R2 acceptance；
5. immutable R1 evidence、Roadmap 状态、Heritage、runtime/data/Git 边界是否保持。

## 需阅读文件

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`
- `doc/platform/roadmap-program-registry.json`
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`
- `project-memory/index.md`
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/pitfalls/log-first-failure-retry.md`
- `contracts/policy/standards-coverage-matrix.json`
- `.codex/hooks.json`
- `scripts/hooks/session-start`
- `scripts/hooks/prompt-route`
- `scripts/hooks/stop`
- `scripts/check/agent-lifecycle`
- `doc/evidence/platform/2026-07-24-v2s-hooks-config-compatibility-fix.json`
- `doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-resolution.md`

## 独立核验重点

1. Fresh 运行：

   ```bash
   scripts/check/agent-lifecycle
   scripts/check/provider-free-context
   scripts/check/foundation-standard-actions
   scripts/check/standards-coverage --phase R2
   scripts/check/standards-coverage --self-test
   scripts/check/project-memory
   scripts/check/roadmap-program-registry
   scripts/check/roadmap-control-plane-transfer
   scripts/check/handoff-debt
   scripts/check/heritage-registry
   ```

2. 在 scratch copy 上分别：
   - 给 `.codex/hooks.json` 加回顶层 `"schemaVersion":1`；
   - 把 `SessionStart` 改回 `[{command,timeout}]`；
   - 确认 `scripts/check/agent-lifecycle` 两次均非零退出且原因精确。
3. 用本机 Codex 从 scratch/fresh v2s root 走原生启动路径，确认不存在 `failed to parse hooks config`，并确认 SessionStart 项目入口可见；不要只运行 hook 脚本。
4. 独立检查生产 checker 的 command extraction 路径确为 `.hooks.<Event>[0].hooks[0].command`，且 fixture 调用的是这些真实命令。
5. 复算 request 声明的所有 hash；重点确认以下 immutable R1 hash 未变：

   ```text
   implementationClosure=e1bcbf43c8c6a0b475e14169ebc0e0dcc1248e54bbefc8097a384ed1ae1add91
   postTransferClosure=8093559204490c147aa9cf8ff0828c9441428f85b53b8ca0dafe03e86f4d5b21
   transferReceipt=61bf4f4729efbb5bfbd8d5cbea1c43987503067c306deaf28a34ce7e350cefda
   ```

6. 确认没有 `apps/**`、migration、DEV、seed/reset、数据库、Heritage write-back 或 Git 写操作，Roadmap 仍为 R2 `IN_REVIEW`。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，findings 按 `M` / `S` / `N` 标注文件/位置、影响、最小修复和是否需要 Dexter 裁决。只有 `GO(0 M / 0 S / N*)` 才表示本 hook 兼容性修复达到可接受条件。

该结论只复核本缺陷修复，不关闭 fresh R2 acceptance，不授予 R3/W1、业务代码、DEV、seed/reset、数据库、生产切流或 Git 写操作。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请从 catering-v2s 仓库根以 fresh 会话独立复核本次 Codex hooks 配置兼容性修复。

背景：Dexter 首次从 v2s 根开启 Codex 时，Codex 0.144.6 在 hook 执行前报告 `.codex/hooks.json` 的顶层 `schemaVersion` 无法解析。Codex 用原生启动路径复现后确认，三个事件还使用旧式扁平注册，而 `scripts/check/agent-lifecycle` 把同一旧结构当作预期值并绕过客户端 parser，造成假绿。Dexter 仅授权修复该缺陷、回归门和证据；Roadmap 仍停在 R2 IN_REVIEW。

目标：请独立确认生产 hooks 配置符合当前 event-group/typed-command schema；checker 的未知顶层字段与扁平注册两类 red control 真能失败；三个真实 hook 命令、Prompt injection、active goal 与 cleanup controls 未退化；Codex 原生启动不再出现 parse failure；同时未破坏 R1 immutable hash、Roadmap、Heritage、runtime/data/Git 边界。

请从仓库根阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md；
- doc/platform/roadmap-program-registry.json；
- doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md；
- project-memory/index.md、project-memory/decisions/deterministic-context-only.md、project-memory/pitfalls/log-first-failure-retry.md；
- contracts/policy/standards-coverage-matrix.json；
- .codex/hooks.json；
- scripts/hooks/session-start、scripts/hooks/prompt-route、scripts/hooks/stop；
- scripts/check/agent-lifecycle；
- doc/evidence/platform/2026-07-24-v2s-hooks-config-compatibility-fix.json；
- doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-resolution.md；
- doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-review-request.md。

请 fresh 复跑 review request 中列出的全部门，在 scratch copy 上分别恢复顶层 schemaVersion 和扁平 SessionStart 注册，确认 production validator 精确真红；再走本机 Codex 原生启动路径，不能只直接执行 hook 脚本。请独立复算全部 hash，并确认 Roadmap 仍是 R2 IN_REVIEW、R1 immutable evidence 未变、all-v2 仍只读、没有 runtime/data/Git 写入。

烦请给出明确 GO 或 NO-GO；findings 请按 M / S / N 标注精确位置、影响、最小修复及是否需要 Dexter 裁决。

授权边界：本结论只复核 hook 兼容性修复，即使 GO 也不关闭 fresh R2 acceptance，不授权 R3/W1、业务代码、DEV、seed/reset、数据库、生产切流或任何 Git 写操作。谢谢。
```

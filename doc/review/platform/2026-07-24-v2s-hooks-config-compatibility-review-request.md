# catering-v2s Codex hooks 配置兼容性修复复核请求

```text
REVIEW_STATUS=REREVIEW_READY
REVIEW_KIND=R2_CONTROL_PLANE_DEFECT_REREVIEW
PROGRAM_ID=V2S_W0_W4_EXECUTION
CURRENT_STEP=R2
CURRENT_STATUS=IN_REVIEW
CODEX_VERSION=0.144.6
BASE_HEAD_AT_REREVIEW_PREP=331984e8147e435e1ac7029f66fe38ff9cc8214e
ORIGIN_MAIN_AT_REREVIEW_PREP=331984e8147e435e1ac7029f66fe38ff9cc8214e
HOOKS_CONFIG_SHA256=82b43833b89f257cc8d7b4431215a325bee6f5b5cf6f9eb82f3455a02bbfaafe
AGENT_LIFECYCLE_SHA256=0a82ac8d9dc78e80426491837f4b935d7c2729bf9dc1ad4f1811f7ee0e0698ac
SCRIPTS_README_SHA256=0228e1e8a2bc75d718cc8e34936ef7bafde736b43503c3d1d40ffd52c9584b8b
DEFECT_EVIDENCE_SHA256=9567d05163bfeb5c02c5c3b67836aa65a241b35f69bdc4ec02b844cecaa2d493
DEFECT_RESOLUTION_SHA256=526e5d77d05b7a2a401e525552a52f761f6e952133cf547178b2c733b79c3aef
PRIOR_CLAUDE_REVIEW_SHA256=3dd5c02bc514a1969c2ce452faa7218437d68503240640f321fa00a55e8fdf3e
POST_NO_GO_CLOSURE_SHA256=af0d3a0e977de2e101d6bc0228c21a01445b0a85026532408b961d2f4fcb49e1
ROADMAP_SHA256=a36fc88b0c151fdae719365b11925941a20e7de771b970f8e6eb11b03ac50392
STANDARDS_MATRIX_SHA256=358dc6bea08b6094ce7bf633bf68ffcbb4dab777c895f87627b7b5d9b4a18ce9
```

## 背景

Dexter 在 `catering-v2s` 根开启 fresh Codex 会话时，Codex 0.144.6 在 hook 执行前报告 `.codex/hooks.json` 顶层 `schemaVersion` 不受支持。Codex 使用原生 `codex exec --ephemeral` 路径独立复现后发现，三个 lifecycle event 同时使用了旧的扁平注册结构，而既有 `agent-lifecycle` checker 把同一旧结构当作 expected value并绕过客户端 parser，形成假绿。

Claude 首轮复核给出 `NO-GO(1 M / 1 S / 2 N)`，并记录其读取的 checker hash 前缀为 `d1e59383…`。该评审保留不改。NO-GO 后 Codex 从当前 v2s 路径重新读取到的 checker hash 为 `0a82ac8d…`，且已包含嵌套提取与两类 schema 红夹具；当前仓和同级工作区没有找到 `d1e59383…` 对应文件。由于现有材料无法证明两种观察视图为何不同，本次不伪造根因、不把旧 NO-GO 改写为成功，而是新增 post-NO-GO closure，重新绑定当前交付 bytes、fresh gates、独立 scratch 变异与原生客户端 probe。

Dexter 只授权完成 hook schema 兼容性修复、回归门和缺陷证据。当前 Roadmap 仍为 R2 `IN_REVIEW`。

## 评审目标

请独立核验：

1. `.codex/hooks.json` 是否符合当前 Codex event-group/typed-command schema，同时保持唯一三个批准事件、原命令和 5 秒 timeout；
2. `agent-lifecycle` 是否通过生产 validator 同时拒绝未知顶层字段和旧式扁平注册，而非另写只展示不接线的 self-test；
3. checker 是否仍从生产配置解析并执行三个真实注册命令，原有 Prompt injection、active goal 与 cleanup controls 是否未退化；
4. Codex 原生客户端复验是否真正消除了 parse failure，而没有把静态 checker PASS 冒充 fresh R2 acceptance；
5. post-NO-GO closure 是否真实绑定当前文件，request 中四方 hash 是否全部一致，且旧 NO-GO 没有被覆盖；
6. `CODEX_CLI_VERSION_CHANGED` 是否在 `scripts/README.md` 形成明确重跑原生 probe 的标准动作，同时没有破坏 `HANDOFF.md` 的冻结七项生产欠账分母；
7. immutable R1 evidence、Roadmap 状态、Heritage、runtime/data 边界是否保持；Git 写操作是否仅由 Dexter 执行，当前 `main/origin-main` 是否同为 request 记录的交付提交。

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
- `scripts/README.md`
- `doc/evidence/platform/2026-07-24-v2s-hooks-config-compatibility-fix.json`
- `doc/evidence/platform/2026-07-24-v2s-hooks-config-compatibility-post-no-go-closure.json`
- `doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-resolution.md`
- `doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-review-claude.md`

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
5. 复算 request 声明的所有 hash，并确认 post-NO-GO closure 内绑定的原始 evidence、resolution、Roadmap、matrix 与 R1 immutable hash 均和当前字节一致；不得只相信文档自报。
6. 对比 prior Claude review 记录的 `d1e59383…` 与当前 checker `0a82ac8d…`。若 fresh 当前路径仍是 `0a82…` 且行为证据成立，可按当前交付树判定，但必须保留这次 view divergence 的诚实记录，不能声称已经解释原因。
7. 确认 `scripts/README.md` 明确登记 `CODEX_CLI_VERSION_CHANGED` 触发器，并 fresh 运行 `scripts/check/handoff-debt`，证明 frozen `HANDOFF.md` 仍保持精确七项。
8. 重点确认以下 immutable R1 hash 未变：

   ```text
   implementationClosure=e1bcbf43c8c6a0b475e14169ebc0e0dcc1248e54bbefc8097a384ed1ae1add91
   postTransferClosure=8093559204490c147aa9cf8ff0828c9441428f85b53b8ca0dafe03e86f4d5b21
   transferReceipt=61bf4f4729efbb5bfbd8d5cbea1c43987503067c306deaf28a34ce7e350cefda
   ```

9. 确认没有 `apps/**`、migration、DEV、seed/reset、数据库或 Heritage write-back，Roadmap 仍为 R2 `IN_REVIEW`；确认 Codex 未执行 Git 写操作，并只读核对 Dexter 的当前 `main/origin-main` 提交。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，findings 按 `M` / `S` / `N` 标注文件/位置、影响、最小修复和是否需要 Dexter 裁决。只有 `GO(0 M / 0 S / N*)` 才表示本 hook 兼容性修复达到可接受条件。

该结论只复核本缺陷修复，不关闭 fresh R2 acceptance，不授予 R3/W1、业务代码、DEV、seed/reset、数据库、生产切流或 Git 写操作。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请从 catering-v2s 仓库根以 fresh 会话复审本次 Codex hooks 配置兼容性修复。

背景：Dexter 首次从 v2s 根开启 Codex 时，Codex 0.144.6 在 hook 执行前报告 `.codex/hooks.json` 的顶层 `schemaVersion` 无法解析。您首轮复核给出 `NO-GO(1 M / 1 S / 2 N)`，记录当时 checker hash 前缀为 `d1e59383…`；该评审原文保留不改。NO-GO 后，Codex 从当前 v2s 路径重新读取到 checker hash `0a82ac8d…`，其中已有嵌套命令提取和两类 schema 红夹具，当前仓及同级工作区未找到 `d1e59383…` 对应文件。现有材料无法解释两种观察视图，因此没有伪造根因，而是新增 post-NO-GO closure，按当前交付 bytes 重跑证据并请求您 fresh 复审。Dexter 仅授权修复该缺陷、回归门和证据；Roadmap 仍停在 R2 IN_REVIEW。

目标：请独立确认当前生产 hooks 配置符合 event-group/typed-command schema；checker 的未知顶层字段与扁平注册两类 red control 真能失败；三个真实 hook 命令、Prompt injection、active goal 与 cleanup controls 未退化；Codex 原生启动不再出现 parse failure；post-NO-GO closure 与 request 四方 hash 一致；`CODEX_CLI_VERSION_CHANGED` 重跑原生 probe 的标准动作已登记且未破坏 HANDOFF 精确七项；同时未破坏 R1 immutable hash、Roadmap、Heritage、runtime/data 边界，且 Git 写操作只来自 Dexter。

请从仓库根阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md；
- doc/platform/roadmap-program-registry.json；
- doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md；
- project-memory/index.md、project-memory/decisions/deterministic-context-only.md、project-memory/pitfalls/log-first-failure-retry.md；
- contracts/policy/standards-coverage-matrix.json；
- .codex/hooks.json；
- scripts/hooks/session-start、scripts/hooks/prompt-route、scripts/hooks/stop；
- scripts/check/agent-lifecycle、scripts/README.md；
- doc/evidence/platform/2026-07-24-v2s-hooks-config-compatibility-fix.json；
- doc/evidence/platform/2026-07-24-v2s-hooks-config-compatibility-post-no-go-closure.json；
- doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-resolution.md；
- doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-review-claude.md；
- doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-review-request.md。

请 fresh 复跑 review request 中列出的全部门，在 scratch copy 上分别恢复顶层 schemaVersion 和扁平 SessionStart 注册，确认 production validator 精确真红；再走本机 Codex 原生启动路径，不能只直接执行 hook 脚本。请独立复算 request、post-NO-GO closure 与当前文件的全部 hash；若当前 checker 确为 `0a82…`，请仍保留此前 `d1e5…` view divergence 为未解释事实，不把它改写为从未发生。另请确认 Roadmap 仍是 R2 IN_REVIEW、R1 immutable evidence 未变、HANDOFF 仍为精确七项、all-v2 仍只读、没有 runtime/data 写入；Git 请确认 Codex 无写操作且当前交付提交只来自 Dexter。

烦请给出明确 GO 或 NO-GO；findings 请按 M / S / N 标注精确位置、影响、最小修复及是否需要 Dexter 裁决。

授权边界：本结论只复核 hook 兼容性修复，即使 GO 也不关闭 fresh R2 acceptance，不授权 R3/W1、业务代码、DEV、seed/reset、数据库、生产切流或任何 Git 写操作。谢谢。
```

# TER-local verify 可观测性与 Unit A 验证回归 review request

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TER_TERMINAL_VERIFY_OBSERVABILITY_IMPLEMENTATION_2026_09_01
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW_REQUIRED=true
IMPLEMENTATION_AUTHORITY=false
AUTHOR=Codex

## 背景

TER gate defect remediation Unit A 的既有实现已完成此前批准范围内的修复。近期发现
TER-local `verify` 在静态模型测试期间长时间没有可见输出，无法区分正常的 fixture/TypeScript
分析耗时与真正卡死。当前新增了统一的结构化调试边界：`verify.mjs` 与 `verify-static.mjs`
在每个 `spawnSync` 子进程前后输出 run id、阶段、cwd、命令、状态、信号、错误码和耗时；
原有 marker、首败语义、cleanup 语义与 TER-local 过滤保持不变。

本轮建立新的 review cycle，范围是这次可观测性改动及其对 Unit A 验证语义的回归，
不重置也不延长此前 review cycle。请先从当前源码独立重建事实，不要采信 Codex 自述的
PASS 或耗时结论。

## 评审目标

请判断：

1. 每一个 TER-local 验证子进程是否都在启动前有可见边界、结束后有可关联结果，且异常路径仍保留首败；
2. 调试日志是否为结构化、脱敏、可关联信息，是否改变既有 stdout marker、失败退出码或 cleanup 语义；
3. `model-test` 约 28 秒、完整 static 约 38 秒是否确由临时 fixture 复制、反向 mutation 与重复 TypeScript 分析造成，还是存在真实卡死/无界等待；
4. `verify` 是否始终只消费 `apps/terminal` 的 TER-local 范围，未偷偷接入仓级 `scripts/verify`、normal runtime 或外部环境；
5. 最新 Unit A 门、red fixture、包 owner、类型检查、测试与 Expo export 证据是否仍与实现一致，是否存在“日志显示 PASS 但实际验证被跳过”的路径；
6. 是否还有一个满足现有测试与门、但删掉或伪造调试字段/子进程边界仍能通过的实现。

## 需阅读文件

- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-registry-claude.md`：缺陷事实与验收边界；
- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-design-codex.md`：Unit A 详细设计；
- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-plan-codex.md`：Unit A 实施顺序与停机条件；
- `doc/evidence/platform/2026-09-01-v2s-terminal-gate-defect-remediation-unit-a-implementation-evidence-codex.md`：既有 Unit A 与最新 TER-local 运行证据；
- `tools/terminal-skeleton/verify.mjs`：TER-local 完整验证入口、子进程边界、marker 与 cleanup；
- `tools/terminal-skeleton/verify-static.mjs`：静态模型/真实树验证编排与首败；
- `tools/terminal-skeleton/verify.test.mjs`：验证 marker、失败边界、owned task contract 与 debug 字段的模型测试；
- `tools/terminal-skeleton/check-static.mjs`、`check-static.test.mjs`：六道规则门、support 与 red/green mutation；
- `tools/terminal-contracts/`、`tools/terminal-platform-ports/`、`tools/terminal-state/`、`tools/terminal-runtime/`：四个 TER 包的静态门与模型测试；
- `tools/terminal-shared/`：owned test runner、package invariant 与共享检查器；
- `apps/terminal/package.json`、`apps/terminal/kernel/base/*/terminal-invariants.json`、`apps/terminal/skeleton-graph.ts`：TER-local 脚本、分母、包 owner 与图规格；
- `doc/platform/terminal-coding-standard.md`、`doc/platform/review-standard.md`：TER 规范正本与 review 动作；
- `project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/independent-subagent-adversarial-review.md`、`project-memory/operations/terminal-coding-standard.md`、`project-memory/kernel/05-evidence-runtime-and-git.md`：适用治理、证据和 TER 记忆。

## 当前新鲜运行证据（请独立复跑或标 UNVERIFIED）

```text
node --check tools/terminal-skeleton/verify.mjs
node --check tools/terminal-skeleton/verify-static.mjs
node tools/terminal-skeleton/verify.test.mjs
exit=0
TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS
```

```text
yarn workspace @catering-v2s/terminal verify:static
exit=0
TERMINAL_STATIC=PASS
model-test durationMs=28637
real-static-tree durationMs=1548
TERMINAL_CONTRACTS_STATIC=PASS
TERMINAL_PLATFORM_PORTS_STATIC=PASS
TERMINAL_STATE_STATIC=PASS
TERMINAL_RUNTIME_STATIC=PASS
```

```text
yarn workspace @catering-v2s/terminal verify
exit=0
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=9
TERMINAL_TURBO_DRY_LINT=PASS packages=22 tasks=22 executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS packages=22 tasks=22 executable=0
TERMINAL_TEST_MARKERS=PASS real=4 noTests=5
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
static durationMs=38527
model-test durationMs=28238
```

本轮没有运行仓级 `scripts/verify`、normal runtime、DEV、seed、reset、native、Gradle、设备、
browser L2、UAT 或部署。Expo export 仅作为 Metro/JS 打包证据，不升级为 native 或设备证明。

## 独立核验重点

1. 从 `verify.mjs` 与 `verify-static.mjs` 的全部 `spawnSync` 入口逐一核对，确认不存在绕过
   `spawnLogged`/debug 边界的 TER-local 子进程；失败时是否仍不打印最终 PASS。
2. 核对 debug JSON 的 run id、phase/state、cwd、command、status、signal、errorCode、durationMs；
   确认不记录 token、cookie、Authorization、手机号、登录名、原始 IP 或 raw payload。
3. 独立阅读 `check-static.test.mjs` 的 fixture 复制、依赖链接、所有 mutation 与 `finally` 清理，
   说明约 28 秒的实际构成；若无法从源码或运行证据确认，标 `UNVERIFIED_REQUIRES_EVIDENCE`。
4. 检查 `verify.test.mjs` 的 fake-yarn 无 stdout/stderr 失败路径，确认它会断言 start/finish、
   status、signal、errorCode、durationMs、首败 marker 与无假 PASS；再构造删字段或跳过 finish 的反例。
5. 复核 TER-local filter、22/22 typecheck、9/9 test、REAL=4/NO_TEST=5、Expo export 与 cleanup，
   并确认没有改动仓级 normal verify 语义。
6. 对 Unit A 的 D-1、D-2、D-3、D-4、D-8、D-22 现有门及其 red vector 做同根扫描，确认日志改动
   没有掩盖或移除任何原有反向证明；如只静态核验，必须分档说明。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 写明精确文件与行号、
仓内事实/推论/尚缺证据、可证伪失败条件、最小修复，以及
`CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、
`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION` 分类。

请按 review 标准补齐：

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=<数量>
L1_ENGINEERING=<PASS / findings>
L2_USER_VISIBLE=NOT_APPLICABLE（本轮无 UI-bearing 变更）
L3_UNVERIFIED=<逐条列出>
SAME_ROOT_SCAN=<每条 finding 的全集与判定>
DESIGN_GAPS=<缺失的正本判据>
EVIDENCE_TIER=<静态 / 模型测试 / TER-local 动态输出分档>
```

若不运行命令，所有运行类结论必须标为 `UNVERIFIED_REQUIRES_EVIDENCE`，不得以静态阅读替代。

## 结论授权边界

本 brief 只请求当前 TER-local verify 可观测性及 Unit A 验证回归的 IMPLEMENTATION review。
Review 结论不授权修改源码、不授权单元 B 或下一个 owner 包、不授权 workspace/display-context、
仓级 normal `scripts/verify`、native、Gradle、设备、DEV、seed、reset、browser L2、UAT、部署或任何数据操作。
是否接受当前修复、是否继续 TER 后续建设，由 Dexter 裁定。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 TER-local verify 可观测性与 Unit A 验证回归做独立 IMPLEMENTATION review。

背景：TER gate defect remediation Unit A 的既有批准修复已完成。近期发现 TER-local verify 在
静态 model-test 期间长时间没有可见输出，因此新增了 `verify.mjs` 与 `verify-static.mjs` 的
结构化 debug 边界：每个 `spawnSync` 子进程启动前立即输出 run id、phase、cwd、command，
结束后输出 status、signal、errorCode、durationMs；原有 marker、首败、cleanup 和 TER-local
过滤语义应保持不变。本轮是新的 `REVIEW_CYCLE_ID=TER_TERMINAL_VERIFY_OBSERVABILITY_IMPLEMENTATION_2026_09_01`，
`REVIEW_ROUND=1/2`，请不要采信 Codex brief、自述数字或历史 verdict，先从当前源码独立重建事实。

目标：请判断调试日志是否覆盖所有 TER-local 子进程并在失败时保留首败；是否结构化、脱敏、可关联；
约 28 秒的 model-test 与约 38 秒的 static 是否确由 fixture 复制、反向 mutation 和重复
TypeScript 分析造成；是否存在无界等待或日志/marker 假绿；Unit A 的 D-1/D-2/D-3/D-4/D-8/D-22
门与 red fixture 是否仍被真实执行；以及是否存在“测试和门都绿但删除/伪造 debug 边界仍通过”的路径。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-registry-claude.md`：缺陷事实与验收边界；
- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-design-codex.md`：Unit A 详细设计；
- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-plan-codex.md`：Unit A 计划与停机条件；
- `doc/evidence/platform/2026-09-01-v2s-terminal-gate-defect-remediation-unit-a-implementation-evidence-codex.md`：Unit A 与最新 TER-local 证据；
- `tools/terminal-skeleton/verify.mjs`、`verify-static.mjs`、`verify.test.mjs`、`check-static.mjs`、`check-static.test.mjs`：verify 编排、debug 边界、模型夹具与规则门；
- `tools/terminal-contracts/`、`tools/terminal-platform-ports/`、`tools/terminal-state/`、`tools/terminal-runtime/`、`tools/terminal-shared/`：四包门与共享 runner/invariant；
- `apps/terminal/package.json`、`apps/terminal/skeleton-graph.ts`、`apps/terminal/kernel/base/*/terminal-invariants.json`：TER-local 脚本、图规格、owner 与分母；
- `doc/platform/terminal-coding-standard.md`、`doc/platform/review-standard.md`、`project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/independent-subagent-adversarial-review.md`、`project-memory/operations/terminal-coding-standard.md`、`project-memory/kernel/05-evidence-runtime-and-git.md`：适用规范与证据边界。

请重点复跑或独立核验这些命令：
- `node --check tools/terminal-skeleton/verify.mjs && node --check tools/terminal-skeleton/verify-static.mjs`；
- `node tools/terminal-skeleton/verify.test.mjs`，应有 `TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS`；
- `yarn workspace @catering-v2s/terminal verify:static`，应有 `TERMINAL_STATIC=PASS`；
- `yarn workspace @catering-v2s/terminal verify`，应有 TER-local dry-run、`TERMINAL_TEST_MARKERS=PASS real=4 noTests=5`、
  `TERMINAL_VERIFY_CLEANUP=PASS` 与 `TERMINAL_VERIFY=PASS`。
请逐一核对 `TERMINAL_VERIFY_DEBUG` 的 start/finish、status/signal/errorCode/durationMs，
以及 model-test 所有 mutation 的定向红与 finally 清理。不要运行仓级 `scripts/verify` normal、DEV、
seed、reset、native、Gradle、设备、browser L2、UAT 或部署；Expo export 只可作为 Metro/JS 打包证据。

请给出 `GO` 或 `NO-GO`，报告 `M/S/N` 数量。每条 finding 请写精确文件与行号、事实/推论/未验证边界、
可证伪失败条件、最小修复和 `CONFIRMED` / `PARTIALLY_CONFIRMED` /
`REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION` 分类。
请声明 `REVIEW_TARGET=IMPLEMENTATION`、`ACTION_1_VARIANT=1-A 代码提取`，并补充
`L1_ENGINEERING`、`L2_USER_VISIBLE=NOT_APPLICABLE`、`L3_UNVERIFIED`、`SAME_ROOT_SCAN`、
`DESIGN_GAPS`、`EVIDENCE_TIER`。如果没有实际运行命令，所有运行结论必须标为
`UNVERIFIED_REQUIRES_EVIDENCE`。

授权边界：本 brief 只请求当前 TER-local verify 可观测性及 Unit A 验证回归的 IMPLEMENTATION review。
不授权修改源码、不授权单元 B 或下一个 owner 包、不授权 workspace/display-context、仓级 normal verify、
native、Gradle、设备、DEV、seed、reset、browser L2、UAT、部署或数据操作。是否接受当前修复、
是否继续 TER 后续建设，由 Dexter 裁定。谢谢。
```

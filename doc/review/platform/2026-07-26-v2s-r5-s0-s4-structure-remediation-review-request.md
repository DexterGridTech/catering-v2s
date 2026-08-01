---
title: R5 S0-S4 内部代码结构整改评审请求
status: READY_FOR_CLAUDE_REVIEW_WITH_INDEPENDENT_NO_GO
createdAt: 2026-07-26
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5
reviewKind: IMPLEMENTATION_STRUCTURE_CHECKPOINT
scope: R5 S0-S4 static source-organization remediation only
authorityBoundary: A verdict here evaluates the completed S0-S4 structure remediation only. It neither accepts the whole R5 implementation nor substitutes for the one required whole-scope R5 implementation review. It does not authorize DEV, seed, reset, dynamic execution, new business capability, contract/schema behavior, or a new Journey.
---

## 背景

R5 的全范围 implementation 已授权，但在继续 S5 的 DEV/seed 与动态证据前，Dexter 发现
前后端源码被过度平铺。经已获 Claude `GO(M=0 / S=0 / N=2)` 的整改计划，Codex 在既有
R5 授权内提交了 S0-S4 的静态结构整改：后端 edge 按 face/capability 归位，两个 admin app
归为 shell/route/session，UI 归到命名 feature，transport、typed Problem 和 capability-boundary
控制同步归位。

但 fresh 独立子 agent 盲审已对当前字节给出 **`NO_GO (M=2 / S=1 / N=1)`**：M-01 指向仍在
controller 内的 Servlet/手写 wire 职责；M-02 指向 operations 的 generic registry 仍承载多个
capability；S-01 指向 `security-boundaries --self-test` 的变异没有触及 production input。故本请求
不是“请确认已完成”，而是请 Claude 独立复核这四项事实、严重性和最小修复，并裁断结构整改应否
继续或先修复。

这不是对 R5 拆分验收：R5 的唯一全范围 implementation review 仍须在 S5/U12 的完整 DEV、seed、
L1/L2/L3、32 个 scenario、104 个 operation、business 与 cleanup 证据完成后一次性进行。本次只请
独立确认：作为那次最终 review 的内部证据，已完成的 S0-S4 是否真实、忠实、无假绿，且其证据边界
是否诚实。

## 评审目标

独立判断 S0-S4 整改是否恢复了长期可维护的 `app shell + edge/feature capability` 结构，同时保留
v2s 的一个业务 deployable、七个 owner schema、104 operation / 32 scenario / 22 surface 分母，且没有
以移动文件掩盖 controller、transport、错误信封或 UI 职责错误。

## 需阅读文件

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`：执行入口、架构与评审/授权边界。
- `doc/platform/roadmap-program-registry.json` 与 `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：当前 R5 授权及最终全范围 review 仍未发生的边界。
- `doc/review/platform/2026-07-26-v2s-r5-code-structure-retrospective-and-remediation-plan.md`：整改目标树、S0-S5 顺序与非目标。
- `doc/evidence/platform/2026-07-26-v2s-r5-code-structure-s0-baseline.md`：S0 分母、路径归位与现有控制 readback。
- `doc/evidence/platform/2026-07-26-v2s-r5-implementation-evidence-assembly.md`：最终 R5 证据的五账边界及未完成动态分母。
- `doc/evidence/platform/r5-u01-edge-placement-resolution.json`：104 operation / 38-55-11 face、owner 与 edge path 的静态落位。
- `doc/plans/platform/2026-07-25-v2s-r5-whole-scope-implementation-design.md`、`doc/review/platform/2026-07-25-v2s-r5-whole-scope-design-granularity-manifest.json`：获接受的 R5 全范围设计与固定分母。
- `contracts/policy/frontend-asset-carryover-manifest.json`、`contracts/policy/standards-coverage-matrix.json`：22 surface / 25 page key 与 standards 分母。
- `doc/review/platform/2026-07-26-v2s-r5-s0-s4-structure-remediation-adversarial-review-round-1.json`：fresh 独立子 agent 的盲审 verdict（生成后纳入；不得以其结论替代源码重开）。

## 独立核验重点

1. 重开 `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/`：24 个 controller 是否按
   `edge/<face>/<capability>` 落位，且 edge 不直接读 Cookie/Servlet、JDBC/repository 或抛
   `IllegalArgumentException`；生成物、bootstrap、configuration、cross-face Problem 是否各归其位。
2. 重开 `apps/frontend/platform-admin/src/` 与 `apps/frontend/operations-admin/src/`：app 是否只持有
   shell/route/session/transport，业务页面是否落在命名 feature；审查 operations registry 是否以显式
   page/capability 映射而非动态 JSON / generic feature 偷掉能力边界；审查是否优先消费
   `libraries/frontend/admin-ui-foundation`，未覆盖的 app-local 能力是否有理由。
3. 复跑静态命令：
   `scripts/check/code-layout`、`scripts/check/code-layout --self-test`、
   `scripts/check/frontend-architecture`、`scripts/check/frontend-architecture --self-test`、
   `scripts/check/security-boundaries`、
   `node scripts/generate/edge-codegen.mjs --check`、
   `gradle :apps:backend:catering-business-server:compileJava --no-daemon`、
   `gradle :apps:backend:catering-business-server:test --tests architecture.BackendModuleBoundariesTest --no-daemon`、
   `yarn --cwd apps/frontend/platform-admin build`、
   `yarn --cwd apps/frontend/operations-admin build`、
   `scripts/check/standards-coverage --phase R5`。
   除 build/compile/test/check 外，不启动动态环境。
4. 核验每项控制的 production path 与真实 red mutation；尤其确认 layout gate 用真实两层 frontend
   路径、frontend gate 不是对旧巨型文件的 substring 假绿、ArchUnit fixture 真能拒绝 cookie 与
   framework-default exception 的回归。
5. 必须保留并报告未完成项：`scripts/check/affected-l2` 目前因真实 focused L2 文件尚未在 S5/U12
   创建而红；L3、business 与 cleanup 均为未运行，不能被 static PASS 代替。Vite chunk-size warning 如仍在，
   作为 N 记录，不冒充 build FAIL。
6. 独立盲审的 `M-01/M-02/S-01/N-01` 只是待验证输入：请逐项重开 owning source 与 fresh 输出，
   特别判断 generated wire 的当前适用性、operations registry 是否确实违反已批准 capability 结构，及
   self-test 是否应变异实际 production input；不得因 reviewer 结论直接采信或直接拒绝。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。`GO` 只能表示 S0-S4 静态结构整改可作为后续 R5 全范围 evidence 的一部分；
不表示 R5 业务、DEV、seed、L2/L3、32 scenario、104 operation 或 cleanup 已完成。findings 使用
`M` / `S` / `N`：每项带精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 R5 S0-S4 内部代码结构整改 checkpoint。

背景：R5 全范围 implementation 已获授权，但在进入 S5 的 DEV/seed 与动态证据前，Dexter 发现前后端源码过度平铺。整改已在既有 R5 授权内提交；fresh 独立子 agent 对当前字节给出 NO_GO(M=2 / S=1 / N=1)，所以本次不是确认完成，而是请你复核这批静态结构整改是否真实、无假绿且证据边界诚实。它不是 R5 全范围 implementation 的拆分验收；最终仍须在 S5/U12 完成全部动态 evidence 后一次性 review。
目标：请独立复核盲审的四项发现：controller 残留 Servlet/手写 wire 职责、operations generic registry 的 capability 边界、security self-test 的 production-input 假红，以及 affected-l2 的如实未完成；同时核验 104 operation / 32 scenario / 22 surface 分母未被漂移。

请从 catering-v2s 仓库根阅读：
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`：入口、架构与评审边界；
- `doc/platform/roadmap-program-registry.json`、`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：R5 授权与最终全范围 review 边界；
- `doc/review/platform/2026-07-26-v2s-r5-code-structure-retrospective-and-remediation-plan.md`：整改目标树与 S0-S5 计划；
- `doc/evidence/platform/2026-07-26-v2s-r5-code-structure-s0-baseline.md`、`doc/evidence/platform/2026-07-26-v2s-r5-implementation-evidence-assembly.md`：静态证据和五账未完成边界；
- `doc/evidence/platform/r5-u01-edge-placement-resolution.json`、`doc/plans/platform/2026-07-25-v2s-r5-whole-scope-implementation-design.md`、`doc/review/platform/2026-07-25-v2s-r5-whole-scope-design-granularity-manifest.json`：固定分母与实施输入；
- `contracts/policy/frontend-asset-carryover-manifest.json`、`contracts/policy/standards-coverage-matrix.json`：surface/page-key/standard 分母；
- `doc/review/platform/2026-07-26-v2s-r5-s0-s4-structure-remediation-adversarial-review-round-1.json`、`doc/review/platform/2026-07-26-v2s-r5-s0-s4-structure-remediation-adversarial-input-manifest.md`：独立子 agent 的输入清单与 NO_GO verdict（请仍自行重开源码验证）。

请重点独立核验：盲审 M-01 的 Servlet/手写 wire/controller 职责是否成立，M-02 的 operations generic registry 是否确实违反 capability-first 结构，S-01 的 `security-boundaries --self-test` 是否对真实 production input 变异失败；同时核验 24 controller 是否真实落于 `edge/<face>/<capability>`、以及 `affected-l2` 当前红色、L3/business/cleanup 未运行是否如实保留。对每个 finding 请重新打开 owning source，不要转述采信。

烦请给出明确 `GO` 或 `NO-GO`。如有问题，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO/NO-GO 仅评价已完成的 S0-S4 静态结构整改，既不接受完整 R5 implementation，也不授权 DEV、seed、reset、动态执行、新业务能力、contract/schema 行为或新 Journey。谢谢。
```

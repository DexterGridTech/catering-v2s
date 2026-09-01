# TER `kernel.base.state` 实施复核 · S/N 闭合定向复核请求

## 背景

TER `kernel.base.state` 已完成本批实施。上一轮独立 `REVIEW_TARGET=IMPLEMENTATION`
结论为 `GO`，`M/S/N=0/1/3`；本请求只覆盖该轮提出的 S-1、S-2 与三条 N 的闭合核验，
不重开已经通过的实现范围。Codex 已按授权修订源码、README、详设、实施计划与实施证据，
并重新运行 TER-local 验证。请以当前仓库字节和原始输出为准，不采信作者摘要。

## 评审目标

请独立确认：

1. `RegisteredStateRuntimePersistence` 的类型闭合是否真正消除了可选字段袋导致的静默丢数据路径；
2. `PersistenceHealth.lastFailure` 的历史诊断语义是否与实现、测试和 README 一致；
3. contracts README 的 `AppError` 适用范围说明与 state README 的拆分阈值说明是否已落地；
4. 实施证据与 TER-local 验证是否仍只主张已证明的静态/typecheck/test/Metro 边界；
5. 是否仍存在全部门与测试通过但 state 包未建成、数据静默丢失或重启后错误的路径。

## 需阅读文件

- `apps/terminal/kernel/base/state/src/types/slice.ts`：内部 persistence registration 的判别式联合；
- `apps/terminal/kernel/base/state/src/foundations/defineStateRuntimeSlice.ts`：公开 descriptor 到内部形态的归一化与构造期断言；
- `apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts`：hydrate、flush、migration、reset 与 health 的消费路径；
- `apps/terminal/kernel/base/state/src/types/persistence.ts`：`PersistenceHealth.lastFailure` 类型说明；
- `apps/terminal/kernel/base/state/README.md`：运行语义、失败边界和拆分阈值；
- `apps/terminal/kernel/base/contracts/README.md`：`AppError` 与构造期 `Error` 的适用边界；
- `apps/terminal/kernel/base/state/test/`：67 条 state 用例及其反向控制夹具；
- `tools/terminal-state/check-static.mjs`、`tools/terminal-state/check-static.test.mjs`：四道规则门、support 与 red mutation；
- `tools/terminal-skeleton/verify.mjs`、`tools/terminal-skeleton/verify.test.mjs`：TER-local owner、marker 与过滤验证；
- `doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-implementation-design-codex.md`：已批准详设；
- `doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-implementation-plan-codex.md`：已批准实施计划；
- `doc/evidence/platform/terminal-kernel-base-state/implementation-codex.md`：实施记录、修复落点和新鲜命令输出；
- `doc/review/platform/2026-08-31-v2s-terminal-state-implementation-review-claude.md`：上一轮独立 findings，仅作对照，不能替代本轮独立判断；
- `doc/platform/terminal-coding-standard.md`、`project-memory/decisions/deterministic-context-only.md`：适用规范与确定性上下文边界。

## 独立核验重点

- 以 `slice.ts` 的 field/record 两分支为准，逐项确认 field 的 `stateKey/storageKey/readField/writeField` 与 record 的 `storageKeyPrefix/getEntries/applyEntries` 均为必填，互斥字段不能构成可选袋；
- 以 `persistenceEngine.ts` 的 `descriptorStorageKey`、`applyDecodedEntry`、flush 和 migration 路径为准，确认不存在 reviewer 指出的 optional callback、`field`/`record` 字面量兜底或静默跳过；允许区分 descriptor 自身的可选策略回调与 erased registration 的必填能力；
- 检查公开 descriptor 的可选 key 是否只在 registration 阶段归一化，且构造期仍 fail closed；
- 检查 `lastFailure` 是历史值，当前健康只由 `status`、`dirtyKeys`、`blockedStorageKinds` 判定，并核对恢复、订阅和日志断言；
- 核对 67 条测试、四道 state 规则门及 support 的真实 red/green 形态，尤其 blocked rebaseline、baseline unknown、逐键失败和跨 runtime 重启；
- 核对实施证据中的新鲜输出：state typecheck/test、state static model/static、TER-local `verify:static`、TER-local `verify`、memory build-index/check 与六维 recall；不要把 TER-local Metro export 升格为 native、Gradle、设备或 adapter 能力；
- 复查是否有新的“所有判据通过但包未建成、数据丢失或重启错误”路径，并说明更小修复为何不足；
- 本轮可复跑命令（如自行运行）只限 state 与 TER-local 面：不得运行仓级 normal `scripts/verify`、设备/Gradle、DEV、seed、reset、浏览器 L2、UAT 或部署。

## 期望结论

请给明确 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 请给精确仓库相对路径与行号、事实和证据、后果、最小修复、为什么更小替代不足，并标注 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`。请另列已核与未核边界，不要把本轮未运行的命令写成已亲验。

## 可直接复制给 Claude 的话术

```text
您好 Claude，TER kernel.base.state 上一轮 IMPLEMENTATION review 的 1S/3N 已按授权闭合，请做同一 review cycle 的定向独立复核。

REVIEW_CYCLE_ID=TER_KERNEL_BASE_STATE_IMPLEMENTATION_2026_08_31
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2

背景：上一轮 `REVIEW_TARGET=IMPLEMENTATION` 结论为 `GO`、`M/S/N=0/1/3`。本轮只核 S-1、S-2 与三条 N 的闭合，不重开已通过的实现范围；请先以当前仓库源码与证据独立判断，再对照上一轮 finding。
目标：确认内部 persistence registration 已 fail closed、health.lastFailure 语义已收口、README/详设/计划/证据一致，并找出新的“全部门与测试通过但包未建成或重启后数据错误”路径。

请从 catering-v2s 仓库根阅读：
- `apps/terminal/kernel/base/state/src/types/slice.ts`：field/record 内部注册联合；
- `apps/terminal/kernel/base/state/src/foundations/defineStateRuntimeSlice.ts`：归一化与构造期断言；
- `apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts`：registration 消费、hydrate/flush/migration/reset/health；
- `apps/terminal/kernel/base/state/src/types/persistence.ts`、`apps/terminal/kernel/base/state/README.md`：lastFailure 与拆分阈值语义；
- `apps/terminal/kernel/base/contracts/README.md`：AppError 适用边界；
- `apps/terminal/kernel/base/state/test/`、`tools/terminal-state/check-static.mjs`、`tools/terminal-state/check-static.test.mjs`：67 条测试、四道门、support 与 red/green 控制；
- `tools/terminal-skeleton/verify.mjs`、`tools/terminal-skeleton/verify.test.mjs`：TER-local verifier 接线；
- `doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-implementation-design-codex.md`、`doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-implementation-plan-codex.md`：批准的设计与计划；
- `doc/evidence/platform/terminal-kernel-base-state/implementation-codex.md`：本轮修复落点和命令原始输出；
- `doc/review/platform/2026-08-31-v2s-terminal-state-implementation-review-claude.md`：上一轮 findings 对照；
- `doc/platform/terminal-coding-standard.md`、`project-memory/decisions/deterministic-context-only.md`：适用规范与上下文边界。

请重点独立核验：
1. `RegisteredStateRuntimePersistence` 是否为 field/record 判别式联合，field 的 `stateKey/storageKey/readField/writeField` 与 record 的 `storageKeyPrefix/getEntries/applyEntries` 是否必填且互斥；`persistenceEngine.ts` 是否已删除 reviewer 指出的 optional callback 与 `field`/`record` 字面量兜底，同时区分 descriptor 可选策略回调与 erased registration 必填能力。
2. `PersistenceHealth.lastFailure` 是否明确是历史诊断值，当前健康是否只看 `status`、`dirtyKeys`、`blockedStorageKinds`；contracts README 的 AppError 适用范围与 state README 的拆分阈值是否一致落地。
3. 67 条测试、四道规则门与 support 的正负控制是否真正观察端口/引擎产出，尤其 blocked rebaseline、baseline unknown、逐键失败、跨 runtime 重启与 test 目录 typecheck。
4. evidence 是否只陈述当前实际验证：state typecheck/test、state static、TER-local `verify:static`/`verify`、memory build-index/check 与六维 recall；TER-local Metro export 不得被表述为 native、Gradle、设备、adapter 能力。
5. 是否仍存在“全部判据通过但 state 包未建成、数据静默丢失或重启后错误”的路径；若有，请给精确代码位置和最小修复。

本轮可复跑范围：只允许 state 与 TER-local 命令；不要运行仓级 normal `scripts/verify`、设备/Gradle、DEV、seed、reset、浏览器 L2、UAT 或部署。

请给出明确 `GO` 或 `NO-GO`，报告 `M/S/N` 数量。每条 finding 写精确路径与行号、事实/证据、后果、最小修复、为什么更小替代不足，并标注 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`；另列已核与未核边界。

授权边界：本轮只请求同一 implementation review cycle 的定向复核；不授权修改源码、不授权批三、不授权 adapter/native 能力、设备/Gradle、仓级 normal verify、DEV、seed、reset、浏览器 L2、UAT 或部署。谢谢。
```

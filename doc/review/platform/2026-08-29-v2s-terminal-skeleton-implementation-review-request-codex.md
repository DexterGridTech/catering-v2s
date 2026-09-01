# TER 骨架批一 + 批二 · implementation 独立复核请求

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TER_SKELETON_IMPLEMENTATION_20260829
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
AUTHOR_VERDICT=NOT_PREJUDGED

## 背景

TER 骨架批一 14 个包与批二新增 8 个包已经在 `apps/terminal` 落地，最终投影为 22 个叶子 workspace。
本轮只建工程骨架，不实现 command、slice、端口行为、持久化、双屏行为或其他终端能力。
批一既有 CP-7 一次性 Android 模拟器证据覆盖批一的 14 包投影；Dexter 进一步要求补齐最终树证明后，
已对批二完成后的 22 包最终树补跑一次 Android 模拟器验收。
Dexter 已授权批一与批二实施，并要求 TER 后续只运行 TER-local verify，不运行仓级 `scripts/verify`。

请不要采信作者的状态总结或旧 review verdict；从当前真实源码、当前 evidence 和可复跑命令重新判断。
本文件是 review 请求，不是 Codex 的 GO/NO-GO 结论。

## 评审目标

请独立判断最终 22 包 TER 骨架是否真的按需求、implementation-facing 详设、实施计划和 TER 正本落地，
重点找出“所有判据看似通过但 package root、入口消费、workspace 关系或原生骨架其实没有建成”的路径。
请区分 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、
`UNVERIFIED_REQUIRES_EVIDENCE` 与 `DEXTER_DECISION`，不要把静态/类型/Metro 证据升级成设备或能力证据。

## 需阅读文件

请从 catering-v2s 仓库根阅读：

- `AGENTS.md`：执行边界、TER-only 验证授权、日志与独立对账纪律；
- `PLATFORM-BLUEPRINT.md`：平台架构边界；
- `project-memory/decisions/deterministic-context-only.md`：上下文与证据确定性要求；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`：TER 四层、版本与包形态裁定；
- `project-memory/decisions/terminal-build-order-and-batches.md`：F/D/N 分档、批一 14、批二 8 与最终 22；
- `project-memory/operations/terminal-coding-standard.md`：TER coding-standard 指针；
- `doc/platform/terminal-coding-standard.md`：TR-01 至 TR-09 正本与骨架例外；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md`：接受的需求正本；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-design-codex.md`：详设及 CP-8 当前收口；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-plan-codex.md`：实施顺序、最终分母与边界；
- `apps/terminal/skeleton-graph.ts`：唯一 22 节点规格与 `activeSkeletonBatch`；
- `apps/terminal/package.json`、`turbo.json`、`package.json`、`.gitignore`：workspace、Turbo 与生成物边界；
- `tools/terminal-skeleton/graph-model.mjs`、`check-static.mjs`、`check-static.test.mjs`、
  `verify-static.mjs`、`verify.mjs`、`verify.test.mjs`：图门、静态门、hygiene、marker 与 TER verify；
- `tools/verify-gates/verify.mjs`、`scripts/test/standards-enforcement-verify.test.mjs`、
  `scripts/test/standards-enforcement-execution-catalog.test.mjs`：仓级 tuple 的源码形状（本轮不运行仓级入口）；
- `doc/evidence/platform/terminal-skeleton/batch-1/cp7-android-device-codex.md`：批一设备证据及其主张边界；
- `doc/evidence/platform/terminal-skeleton/batch-2/cp8-batch2-skeleton-codex.md`：批二与最终 22 包证据。

此外请逐个读取 `apps/terminal` 下 22 个 child workspace（排除聚合包 `apps/terminal/package.json`）的
`package.json`、`tsconfig.json`、`src/moduleName.ts`、`src/dependencies.ts`、`src/index.ts`；
四个批二 Android adapter 还要读取 `android/`、`expo-module.config.json` 与最小 Kotlin Module；
assembly 还要读取 `index.ts`、`App.tsx`、`src/skeletonBootstrap.ts`。

## 独立核验重点

请实际从当前字节复核并在结论中给出命令、退出码和关键输出：

1. 22 个 child workspace census、`activeSkeletonBatch=2`、graph 的 22 节点/21 条 assembly direct edges，
   无孤儿、环、层级反向、深层 import、未声明 import 或多余 workspace；
2. 每个包的三重命名、`private`、root-only `exports`、依赖类别和 `dependencies.ts` exact-set，
   以及 `plannedKind` 是否只位于规格文件；
3. `ui.base.input`、`ui.base.admin-shell` 到 integration 的正式依赖，四个新 adapter 到 platform-ports 的唯一边，
   assembly/package.json、assembly/dependencies.ts、bootstrap 的 21 条 root 集合是否逐字一致；
4. `index.ts → App.tsx → skeletonBootstrap.ts` 入口是否真实可达，App 是否实际渲染 22 个 `moduleName`，
   是否存在通过 `src/index.ts` 转发、type-only、动态 import、require、深层路径或旁路常量制造 false-green 的路径；
5. 四个批二 adapter 的官方 `create-expo-module@latest --source` scratch 重跑：exit 0、原始树、native diff=0、
   package-local `node_modules`/LICENSE/嵌套元数据清理，Kotlin 只有最小注册类；不得把它升级成能力实现；
6. `node tools/terminal-skeleton/check-static.test.mjs`、`node tools/terminal-skeleton/check-static.mjs`、
   `node tools/terminal-skeleton/verify.test.mjs` 的真实 red/green 控制、六道规则门 + 单列 hygiene、marker 契约；
7. TER-local `yarn workspace @catering-v2s/terminal run verify` 的实际日志：静态门、Turbo dry-run 的
   22/22/22 与 test executable=5、22/22 typecheck、Expo export 647 modules、cleanup 与总时长；
8. Turbo filter 是否只触发 `apps/terminal`，不触发 `apps/frontend`、`libraries/frontend` 或 aggregate 自递归；
9. 最终 22 包设备证据是否真实证明 Gradle 构建、5/5 adapter autolinking、APK install、Activity start、
   JS main 与 22/22 moduleName 渲染；同时是否准确保留未证明边界：Kotlin 能力、adapter 业务能力、
   双屏/重启、DEV、seed、浏览器 L2、UAT、部署、EAS，以及本轮未完成授权的仓级 `scripts/verify`
   验收（文案扫描中的事故性静态首败另有记录，不作为验收证据）；
10. 文档数字和命令是否还有批一旧口径（14/1/“批二未执行”）与当前最终实现冲突；每个 finding 必须给精确文件/行号、
    后果、最小修复，以及为什么更小替代不足。请扫描同族全集，不能只修一个包或一条边。

可复跑输出位于：

- `.runtime/terminal-skeleton/batch-2/ter-verify.log`；
- `.runtime/terminal-skeleton/batch-2/typecheck-all-per-package.log`；
- `.runtime/terminal-skeleton/batch-2/verify-test-final.log`；
- `.runtime/terminal-skeleton/batch-2/check-static-post-cleanup.log`；
- `.runtime/terminal-skeleton/batch-2/scaffold-rerun/run-meta.log` 及其逐 target tree/hash/diff/log；
- `.runtime/terminal-skeleton/batch-2/device-final/final-device-acceptance.log`、
  `expo-run-android-final.log`、`runtime-assertions.log`、`ui.xml`、`module-names-expected.log`、
  `module-names-rendered.log`、`logcat-app-assertion.log`、`cleanup.log`、`ter-verify-post-device.log`、
  `accidental-root-verify-static-first-failure.log`；
- `.runtime/terminal-skeleton/batch-1/` 下的既有批一证据（只读）。

请把 `.runtime` 中的摘要当作待核证据，必要时重跑 TER-local 命令；本轮不执行仓级 `scripts/verify`，不重跑
Gradle/模拟器，不执行 DEV/L2/UAT 或任何 Git 操作。
注意：`accidental-root-verify-static-first-failure.log` 记录的是一次 shell quoting 失误导致的 root verifier
静态首败，不是授权验收证据；请只把它作为边界事故核查输入。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并给出 `M` / `S` / `N` 数量。每条 finding 至少包含：

- 精确位置（仓根相对路径与行号/节号）；
- 当前仓内事实、外部事实、推论和仍缺证据的假设分别是什么；
- 失败条件与实际后果；
- 最小修复及更小替代为何不足；
- `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` /
  `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION` 分类；
- 本 finding 对同族全集的扫描结果；
- 静态已证、测试已证、无人验证的分层清单。

请在结论中明确：本轮是否满足“完整骨架实施完成”，以及是否还有需要 Dexter 裁决的产品、范围或授权问题。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 TER 骨架批一 + 批二实施做独立 `IMPLEMENTATION` 复核。

背景：TER 骨架批一 14 个包与批二新增 8 个包已落地，最终为 22 个 child workspace；本轮只建骨架，不实现任何终端能力。批一 CP-7 的一次性 Android 模拟器证据覆盖 14 包投影；Dexter 进一步要求补齐最终树证明后，已对最终 22 包树补跑一次 Android 模拟器验收。Dexter 已授权实施，并明确后续验证只运行 TER-local verify，不运行仓级 `scripts/verify`。这份请求不是作者结论，请从当前源码与证据重新判断。

目标：请找出“所有门都绿但骨架其实未建成”的路径，独立核验 22 包 census、唯一 skeleton graph、21 条 assembly direct edges、三重命名、package.json/dependencies.ts/bootstrap exact-set、真实 `index.ts → App.tsx → skeletonBootstrap.ts` 消费链、四个新 adapter 的官方 source 重跑与 native diff、静态红/绿控制、22/22 typecheck、Turbo 过滤、Expo export、最终 22 包设备运行与 cleanup，并准确区分静态/类型/Metro/设备/Kotlin/能力证据。

请从 catering-v2s 仓库根阅读：
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`；
- `project-memory/decisions/deterministic-context-only.md`；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`；
- `project-memory/decisions/terminal-build-order-and-batches.md`；
- `project-memory/operations/terminal-coding-standard.md` 与 `doc/platform/terminal-coding-standard.md`；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md`；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-design-codex.md`；
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-plan-codex.md`；
- `apps/terminal/skeleton-graph.ts`、`apps/terminal/package.json`、根 `package.json`、`turbo.json`、根 `.gitignore`；
- `tools/terminal-skeleton/` 全部六个工具文件及 `tools/verify-gates/verify.mjs`；
- `doc/evidence/platform/terminal-skeleton/batch-1/cp7-android-device-codex.md`；
- `doc/evidence/platform/terminal-skeleton/batch-2/cp8-batch2-skeleton-codex.md`；
- `apps/terminal` 下 22 个 child workspace 的 manifests、tsconfig、src 入口；四个新 adapter 另读 Android/config/Kotlin；assembly 另读 App/entry/bootstrap；
- `.runtime/terminal-skeleton/batch-2/ter-verify.log`、`typecheck-all-per-package.log`、`verify-test-final.log`、`check-static-post-cleanup.log`、`scaffold-rerun/run-meta.log`。
- `.runtime/terminal-skeleton/batch-2/device-final/final-device-acceptance.log`、`expo-run-android-final.log`、`runtime-assertions.log`、`ui.xml`、`module-names-expected.log`、`module-names-rendered.log`、`logcat-app-assertion.log`、`cleanup.log`、`ter-verify-post-device.log`、`accidental-root-verify-static-first-failure.log`。

说明：`accidental-root-verify-static-first-failure.log` 记录的是一次 shell quoting 失误导致的 root verifier 静态首败，不是授权验收证据；请只把它作为边界事故核查输入。

请重点独立核验：
1. 22/21 exact-set、graph 无孤儿/环/反向边，package.json、dependencies.ts、bootstrap 同步且无旁路 false-green；
2. 22 个包的三重命名、exports/root-only、依赖方向/声明完整、plannedKind 单点来源、hygiene 与 package-local node_modules 清理；
3. 四个批二 adapter 的 `create-expo-module@latest --source` 原始闭包和 native diff=0；只保留最小 Module 注册，不把它升级为 Kotlin/业务能力；
4. TER-only static/test/verify 的真实退出码与 marker：22/22 typecheck、Turbo test executable=5（仅 dry-run）、Metro 647 modules、cleanup PASS、总时长；
5. 最终 22 包设备证据是否真实证明 Gradle 构建、5/5 adapter autolinking、APK install、Activity start、JS main 与 22/22 moduleName 渲染；并核对文档是否仍残留 14/1/批二未执行等旧口径，及哪些边界仍应写 `UNVERIFIED_REQUIRES_EVIDENCE`；本轮不得运行仓级 `scripts/verify`、不得重跑 Gradle/设备/DEV/L2/UAT 或 Git。

烦请给出明确 `GO` 或 `NO-GO`，并给出 `M` / `S` / `N` 数量。每条 finding 请写精确文件与行号/节号、事实与证据、失败后果、最小修复、同族全集扫描结果，并分类为 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`。请分别列出静态已证、测试已证和无人验证边界；若无 finding 也要明确写出核验覆盖，不要用“看起来一致”代替证据。

授权边界：本次只评审 TER 骨架批一 + 批二的实施是否完成；不授权批三、任何终端能力实现、Kotlin 能力、重复设备运行、双屏/杀进程重启、DEV、reset、seed、浏览器 L2、UAT、部署、EAS 或任何 Git 操作。谢谢。
```

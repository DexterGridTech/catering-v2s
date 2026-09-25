# TER 包布局整理 IMPLEMENTATION 代码静态复核请求

REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CODE_ONLY
VERDICT_REQUEST=GO|NO-GO|GO_WITH_OPEN_EVIDENCE

## 背景

本轮实现依据 `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md`、
`doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md`、
`doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md` 与
`doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md`：

- `apps/terminal/assembly` 改为 `apps/terminal/application`；
- `apps/terminal/ui/base/console-assembly` 改为 `apps/terminal/ui/base/integration-assembly`，并同步包名、moduleName、源码中的基础设施身份与消费者；
- 下线三个未使用包：`ui/base/automation`、`kernel/base/workflow`、`kernel/base/test-support`；
- 将 `ui/base/test-support` 的能力并回 `kernel/base/platform-ports`；
- 按 D-6 删除 TER 产品运行与配置中的 `darkMode` 语义，同时保留 TR-08 的明确 OPEN guard；
- 保持包内 `src/assembly/` 作为编码规范 §7.1 规定的语义目录，不把它误判为顶层 `apps/terminal/assembly`。

Dexter 已明确本次不再收集或评审动态证据；本请求只要求对当前源码、测试、脚本和代码配置做独立静态审查。此前的 Web、Android、虚拟机、截图、runner、cleanup 与 evidence 结论不属于本轮判定对象。

## 评审目标

请只判断代码实现是否正确、完整、可维护，重点覆盖：

1. 顶层目录改名后，active source、workspace package identity、moduleName、exports、依赖图和应用入口是否一致；
2. `integration-assembly` 的基础设施身份改名是否完整，两个 integration 的产品名（例如 `WallpaperConsoleAssembly`、`createSampleWallpaperConsoleAssembly`）是否被错误机械改写；
3. 三个下线包是否已从 active code、测试、静态门与依赖图中退出，`ui/base/test-support` 并入 `platform-ports` 后是否没有丢失公共类型、端口能力或行为；
4. Android/Kotlin package、namespace、Expo module 清单、Gradle 配置和 TypeScript application module identity 是否只反映本次布局改名，没有意外改动 applicationId、持久化身份、业务命令或 UI 语义；
5. D-6 的 active production/config 语义是否已删除，保留的 TR-08 guard 是否只是明确的后续待办检查，不应被误判成运行时残留；
6. 静态门和 focused test 是否真正依赖被测代码、是否能由唯一变异触发失败，是否已经移除废弃的 `plannedDependencies` 检查机制与退休夹具；
7. 当前 TER 代码改动是否存在明显的旧路径残留、错误导出、循环依赖、行为漂移或与本次布局整理无关的代码回归。

本轮不要求评审动态证据，也不要求重新运行 Web、Metro、Android、虚拟机、设备或 runner。

## 需阅读文件

请从仓库根按需读取：

- `AGENTS.md`：仓库执行边界、主 agent 写入与评审职责；
- `doc/platform/terminal-coding-standard.md`：TER 包层级、`src/assembly/` 语义目录、TR-08/TR-10/TR-16/TR-17；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`：TER 架构与命名边界；
- `project-memory/operations/terminal-coding-standard.md`：包 identity、moduleName、依赖与公共面规则；
- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md`：需求与 AC-0 至 AC-13；
- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md`：方案与 D-1 至 D-6；
- `doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md`：实现详设、CP 文件集与代码判据；
- `doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md`：实施步骤、红变异和逐代码对账要求；
- `apps/terminal/application/`：改名后的两个 Android app、base/android、原生 Kotlin/Gradle/Expo 配置与 application 入口；
- `apps/terminal/ui/base/integration-assembly/`：改名后的基础 integration assembly、公共导出、依赖、测试与 invariants；
- `apps/terminal/kernel/base/platform-ports/`：合并后的公共端口类型、实现、导出、测试与 invariants；
- `apps/terminal/ui/integration/sample-console/` 与 `apps/terminal/ui/integration/sample-wallpaper-console/`：两个 integration 的消费者、exports、module 与 assembly 入口；
- `apps/terminal/skeleton-graph.ts`：active module graph；
- `tools/terminal-skeleton/check-static.mjs`、`tools/terminal-skeleton/check-static.test.mjs`：骨架、依赖与命名静态门及其变异；
- `tools/terminal-ui-state/check-static.mjs`、`tools/terminal-ui-state/check-static.test.mjs`：active UI state 静态门及其变异；
- `tools/terminal-sample2/check-production-bundle.mjs` 与对应测试：D-6 与 TR-08 guard 的代码边界；
- 受影响包的 `package.json`、`src/index.ts`、`src/moduleName.ts`、`src/dependencies.ts`、`README.md`、`terminal-invariants.json`、`tsconfig.json`、`exports`、Android/Gradle/Expo 配置及其 focused tests。

`doc/evidence/**`、截图、动态日志、APK/设备产物、Web/Android runner 记录和 cleanup 记录均不是本轮输入；请不要据此给出或升级结论。当前工作区中与 TER 无关的 seed、catalog、frontend 等既有改动也不在本轮范围内，不要回退或把它们作为本轮 finding。

## 独立核验重点

请以当前源码字节为准，使用只读检索和静态测试代码阅读，重点核验：

- active corpus 中不再存在旧的顶层 `apps/terminal/assembly`、`ui/base/console-assembly`、旧 UI package name/moduleName，以及三个已下线包的 active import、workspace locator、skeleton graph、测试和配置残留；包内 `src/assembly/` 的语义性保留应判为正确；
- `apps/terminal/application/android/*` 的 TypeScript moduleName、两个 sample app 的入口和 `application/base/android` 的 Kotlin package、Gradle namespace/group、Expo module 类名是否构成一致映射；不得将 applicationId、持久化 key、业务 command 或 UI 语义误改为布局名；
- `@catering-v2s/ui-base-integration-assembly` 的 root export、依赖和两个 integration consumer 是否一致；`ui.base.integration-assembly` 的 owner/writer/source 标识是否只出现在该基础设施语义中；integration 自有产品 assembly 名称是否合理保留；
- `platform-ports` 合并后的 export set、端口类型、logger/storage/device/app-control 等能力与 `terminal-invariants.json` 是否一致；原 `ui/base/test-support` 的能力是否有明确替代而非静默丢失；
- `tools/terminal-skeleton` 与 `tools/terminal-ui-state` 的规则是否检查真实 package/index/dependency/graph 关系；测试变异是否针对真实 owning source，是否存在字符串计数或恒真测试；废弃的 `plannedDependencies`/`plannedWorkspaceDependencies` 机制不应继续成为 active gate；
- D-6 的生产 app/config 不应含 `darkMode` 语义；`check-production-bundle.mjs` 中若保留用于检测残留的 red mutation/guard，应明确属于测试防线而非 production configuration；
- 每项 finding 请区分 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，并找出最小根因修复，不以动态证据或截图代替代码判断。

## 期望结论

请输出：

`REVIEW_TARGET=IMPLEMENTATION,VERDICT=GO|NO-GO|GO_WITH_OPEN_EVIDENCE,M/S/N=x/y/z`

每条 finding 必须包含精确的仓库相对路径与行号、事实或反例、影响面、最小修复建议、状态分类，以及是否需要 Dexter 做产品/Journey 裁决。若只能靠动态运行才能判断，请明确写为本轮不判定，而不要把它升级为代码 PASS 或代码缺陷。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 TER 包布局整理做一次只看代码的 IMPLEMENTATION 静态 review。

背景：本轮已按 v5 需求与实施详设完成当前源码改动：apps/terminal/assembly 改为 apps/terminal/application；ui/base/console-assembly 改为 ui/base/integration-assembly；三个未使用基础包退出 active code，ui/base/test-support 并回 kernel/base/platform-ports；D-6 删除 TER active production/config 中的 darkMode 语义并保留 TR-08 明确 guard。Dexter 已授权本轮不再收集或评审动态证据，因此请只审当前源码、测试、脚本与代码配置，不读取或评价 evidence、截图、Web/Android/虚拟机/runner/cleanup 结果。

目标：独立确认 package path、package name、moduleName、exports、依赖图、skeleton graph、README/invariants、Android/Kotlin/Gradle/Expo 配置和 focused/static tests 是否在当前字节中一致；确认旧包与已下线包没有 active 残留；确认 platform-ports 合并没有丢公共能力；确认 D-6 没有误删 TR-08 guard，也没有留下 active darkMode 语义；确认测试和静态门依赖真实 owning source，能抓住唯一变异，并且不存在明显的布局改名回归。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md：需求与验收条件；
- doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md：方案与决策；
- doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md：实现详设；
- doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md：实施计划与代码判据；
- apps/terminal/application/：改名后的 Android application、Kotlin/Gradle/Expo 配置与入口；
- apps/terminal/ui/base/integration-assembly/：改名后的公共 integration assembly；
- apps/terminal/kernel/base/platform-ports/：合并后的平台端口公共面；
- apps/terminal/ui/integration/sample-console/ 与 apps/terminal/ui/integration/sample-wallpaper-console/：两个 integration 消费者；
- apps/terminal/skeleton-graph.ts、tools/terminal-skeleton/check-static.mjs、tools/terminal-skeleton/check-static.test.mjs、tools/terminal-ui-state/check-static.mjs、tools/terminal-ui-state/check-static.test.mjs、tools/terminal-sample2/check-production-bundle.mjs：代码级图、静态门与 D-6/TR-08 guard。

请重点独立核验：active corpus 是否仍有旧顶层 assembly、旧 console-assembly identity 或三个下线包的 active 残留；包内 src/assembly/ 是否按 §7.1 正确保留；application 与 integration-assembly 的 package/index/exports/dependencies/moduleName 是否深相等；Kotlin package、namespace、Expo modules 是否一致且未改变 applicationId、持久化身份、业务命令或 UI 语义；platform-ports 的完整公共导出和行为是否保留；plannedDependencies 旧机制是否已退出；测试是否依赖真实代码且变异能使正确 gate 变红；D-6 active darkMode 是否清理而 TR-08 guard 是否只作为明确待办保留。请忽略 doc/evidence、截图、动态运行与 cleanup 结果，也不要把当前工作区中与 TER 无关的 seed/catalog/frontend 改动归入本轮。

烦请给出明确 `GO`、`NO-GO` 或 `GO_WITH_OPEN_EVIDENCE`，并按 `M` / `S` / `N` 标注每条 finding 的精确路径与行号、事实或反例、影响、最小修复建议、状态分类，以及是否需要 Dexter 产品/Journey 裁决。本轮结论只覆盖代码静态实现，不覆盖动态、视觉、业务或设备验收。

授权边界：本次 review 只授权检查当前源码、测试、脚本和代码配置；不授权修改代码、不授权重新收集动态证据、不授权将证据或手工体验升级为代码以外的验收结论。谢谢。
```

# sample 基础设施上收 base · v3 需求分析 Claude 复评交接

REVIEW_STATUS=READY
REVIEW_TARGET=DESIGN
EVIDENCE_TIER=static;isolated-scratch-fixture;official-expo-docs;no-runtime-device-web-acceptance

## 背景

本轮评审对象是 sample 基础设施上收 base 的第 3 版需求分析，不是详设或实施。第 2 版经 Codex 独立评审为 NO-GO 3M/10S/4N；第 3 版按 §9 逐条 intake，并把实现机制、判据执行体与取值细节移入 §7。Codex fresh v2s-rooted 复评仍暂得 NO-GO 2M/6S/3N：问题是真问题，整体上收方向可取，但仍有需求级边界与验收 oracle 缺口。

## 评审目标

请独立判断：

1. 第 3 版是否真正解决第 2 版 findings，而不是只把机制改写进详设；
2. 两个新 base 包、Splash、运行期依赖和根配置的方案是否优于更小替代；
3. §5 的 U1–U12 与 §7 的 D-1–D-13 是否能执行，且不能被自然捷径或无意回归绕过；
4. §4.0 前置条件、§6 不做项和 §8 UNVERIFIED 划界是否合理。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`：执行边界与架构总约束；
- `doc/platform/README.md`、`doc/platform/roadmap-program-registry.json` 及当前程序 Roadmap 授权字段：授权范围；
- `project-memory/index.md`、命中的 `project-memory/decisions/independent-subagent-adversarial-review.md`、`project-memory/operations/claude-review-handoff-standard.md`、`project-memory/operations/terminal-coding-standard.md` 及相关 kernel：评审与终端架构规则；
- `scripts/README.md`：脚本与验证边界；
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md`：本轮评审对象，先独立读 §0–§8，再读 §9；
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-analysis-claude.md`：可选的成稿讨论背景；
- `tools/terminal-skeleton/graph-model.mjs`、`tools/terminal-skeleton/check-static.mjs`、`tools/terminal-layering/check-static.mjs`：graph、workspace/census、依赖方向及投影门；
- `apps/terminal/kernel/base/platform-ports/src/types/appControl.ts`、`apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts`、`apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`：当前 port、启动诊断消费和 PRIMARY mount 事实；
- 两个 App 的 `android/app/src/main/res/values/styles.xml`、`android/app/build.gradle`、`android/settings.gradle`、`android/app/src/main/AndroidManifest.xml`、`MainActivity.kt`：Splash 原生事实；
- `doc/platform/terminal-coding-standard.md` 的 TR-11、TR-13：事件路径和共享 admin console 边界。

## 独立核验重点

请先不接受本交接中的 provisional verdict，先由源码和规则自行推导结论，再对照 §9：

1. **量化证据**：在文档声明的 `apps/terminal` cwd 复跑 §1 的 `diff`、`wc`、grep 命令；确认“逐字相同”确实由 `diff` 退出码 0 支撑，并检查非空/反向对照是否完整。
2. **新包接入**：实测新增 `assembly/base/android` 与 `ui/base/console-assembly` 时，root workspaces、census、graph、Turbo、invariants、entry reachability、身份/资产校验分别由什么抓住；确认是否存在静默漏项。不要把“缺一即门红”当作前提。
3. **base 反向依赖**：复跑 §3.0 graph=31、base→非base=0，并扫描源码导入，覆盖跨包相对路径、`import type`、type-only named import、type re-export、动态导入/require 的适用范围。当前 graph collector 的实际范围见 `graph-model.mjs`。
4. **三处依赖声明**：不要只看 package/graph；验证 `src/dependencies.ts` 的运行期模块数组与另外两处是否真的由既有门强制一致。若不一致，判断“不合并”是合理范围选择还是错误事实前提。
5. **Splash**：核对两个 Android 工程是否只是模板 `Theme.App.SplashScreen`，还是已集成 `expo-splash-screen`；查官方一手资料确认 bare 手动配置、`preventAutoHideAsync` 首帧时序、`hideAsync` 前置条件，以及 development build 是否足以证明真实 Splash 行为。官方参考：`https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/`、`https://github.com/expo/expo/blob/main/packages/expo-splash-screen/README.md`。
6. **R-S5/TR-11**：判断 PRIMARY first mount → hide native splash 是否必然进入业务逻辑；若是 assembly/base 内部基础设施副作用，是否应无条件 command/actor 化；若经 runtime actor，command owner、bridge、去重和分层依赖是否明确。
7. **§5 绕过面**：重点挑战 U1–U4、U8、U10–U12 的未列反例：未触发的第二 writer、共享 helper 导致的假因果、重复 complete、失败/finally/旧 run 日志、`preventAutoHideAsync` 太晚或 rejected、development build、私有 tsconfig/generated env、batch 投影静默丢边。蓄意复制标识符可由 implementation review 兜底，但自然捷径和无意回归不能归入“恶意”。
8. **脏日志与 batch**：sample1 的 56 个一次 complete、1 个两次 complete、16 个有 surfaces 无 complete 是否影响 §2.1 定性；`projectSkeletonGraph` 对投影外依赖的静默过滤是否使 batch=1 的新节点产生假绿。

Codex 已取得但请重新核对的只读事实：当前 terminal static 首败为 `graph-comparison`，具体是 `ui.feature.sample-wallpaper-picker` 多出 `kernel.base.platform-ports` devDependency；layering static PASS；当前 graph 31 节点且声明 base→非base=0；源码 AST 扫描当前 base 包未发现跨包相对或 type-only 反向违反。隔离 scratch fixture 显示只改 `src/dependencies.ts` 的运行期数组、保持 package.json/graph 不变时，相关 graph/direction/declaration completeness 门仍 PASS。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`（major）、`S`（significant）、`N`（note）数量。每条 finding 请写明：

- 状态：`CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`；
- 仓内事实、外部事实、推论、尚缺证据的假设；
- 精确仓库相对路径与行号、影响面、可复现核验方式、最小修复；
- 不同意时给出反例；说明是否需要 Dexter 产品/Journey/范围裁决。

请特别逐项评价 §9 对第 2 版 findings 的处置：R-S5/TR-11 是否应条件化、type-only 是否应在需求层定下、无元门是否成立、三处声明不合并的理由是否成立、Splash 裁决②和 batch 裁决③撤回是否恰当。不要把静态 review 升级为 implementation acceptance、visual PASS、Web PASS 或 release PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 sample 基础设施上收 base 的第 3 版需求分析做一轮独立、证伪优先的复评。

背景：评审对象是需求分析，不是详设或实施。第 2 版经 Codex 独立评审为 NO-GO 3M/10S/4N；第 3 版按 §9 处理 findings，并把机制、判据执行体和取值细节移入 §7。Codex fresh 复评的 provisional 结论仍是 NO-GO 2M/6S/3N，但请先独立推导，不要顺着这个数字或 §9 的作者结论走。

目标：请判断第 3 版是否解决上一轮 findings；两个新 base 包、运行期依赖、Splash、根配置的方案是否优于更小替代；以及 §5 U1–U12 和 §7 D-1–D-13 是否能实际执行并挡住自然捷径/无意回归。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md：先独立读 §0–§8，再读 §9；
- AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、doc/platform/roadmap-program-registry.json 及当前程序 Roadmap 授权字段：执行和授权边界；
- project-memory/index.md 及命中的独立审查、Claude handoff、terminal coding standard memory：评审规则；
- tools/terminal-skeleton/graph-model.mjs、tools/terminal-skeleton/check-static.mjs、tools/terminal-layering/check-static.mjs：现有门与 batch 投影；
- apps/terminal/kernel/base/platform-ports/src/types/appControl.ts、apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts、apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx：当前 Splash/port/PRIMARY mount 事实；
- 两个 App 的 android/app/src/main/res/values/styles.xml、android/app/build.gradle、android/settings.gradle、AndroidManifest.xml、MainActivity.kt：原生 Splash 事实；
- doc/platform/terminal-coding-standard.md 的 TR-11、TR-13：事件与 integration 边界。

请重点独立核验：
1. §1 的 diff/wc/grep 命令是否真的支撑所有量化断言，尤其逐字相同、非空和反向对照；
2. 新包漏接 root workspaces、census、graph、Turbo、invariants、entry、身份/资产校验时分别由谁抓住；root workspaces 逐层枚举是否会静默漏包；
3. §3.0 的 graph=31、base→非base=0 与源码扫描是否都覆盖 dependencies、devDependencies、跨包相对路径、import type、type-only re-export、动态导入/require；
4. `src/dependencies.ts`、package.json、graph 三处声明是否真的由既有门强制一致；如不一致，判断“不合并”是否只是合理范围选择；
5. 两个 Android 工程是否只有模板 Theme.App.SplashScreen，而非已集成 expo-splash-screen；用官方资料核对 bare 手动配置、preventAutoHideAsync、hideAsync 和 dev/release 证据边界；
6. R-S5/TR-11 是否应无条件适用于 PRIMARY mount → hide native splash，还是只在事件进入业务/runtime 写路径时适用；
7. U1–U4、U8、U10–U12 的已知绕过是否遗漏未触发第二 writer、共享 helper 假因果、重复 complete、失败/finally/旧 run、prevent 过晚、development build、私有 tsconfig/generated env 和 batch 静默丢边；
8. sample1 的 56/1/16 脏日志是否影响 §2.1 定性，及 batch=1 投影是否会让新依赖假绿。

请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请区分仓内事实、外部事实、推论与尚缺证据假设，给精确仓库相对路径/行号、影响面、可复现核验方式、最小修复和是否需要 Dexter 裁决；不同意时请给反例。请逐项评价 §9 对上一轮 findings 的处置，特别是 R-S5/TR-11、type-only、无元门、三处声明不合并、Splash 裁决②撤回和 batch 裁决③撤回。

授权边界：本次只评审需求分析并输出 GO/NO-GO；不开始详设、实施、源码修改、测试修复、Web/Metro/Android/DEV/seed/UAT/部署、Computer Use 或任何 Git/仓库控制动作。静态 review 不得升级为 implementation acceptance、visual PASS、Web PASS 或 release PASS。谢谢。
```


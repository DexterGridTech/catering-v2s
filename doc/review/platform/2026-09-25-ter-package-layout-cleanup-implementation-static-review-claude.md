# TER 包布局整理 · 实现静态评审（Claude，只看代码）

```text
REVIEW_TARGET=IMPLEMENTATION（只看代码）
VERDICT=NO-GO
M/S/N=0/2/3
```

```text
依据：需求 v5、方案 v5、Codex 详设与实施计划（2026-09-25）
范围：当前源码、测试、脚本与代码配置；按 Dexter 授权，不读取、不评价 evidence、截图、Web/Android/虚拟机/runner/cleanup 结果
EVIDENCE_TIER=仅静态：Claude 回读当前字节；未运行任何命令、门、构建或设备
SESSION=CONTINUED_SESSION（v2s 仓根，经上下文压缩续接，不是 fresh acceptance）
AUTHORITY=结论只覆盖代码的静态实现，不覆盖动态、视觉、业务或设备验收；不授权任何修改
```

## 1. 结论

主体实现正确：
- 目录与身份四元组一致；
- 原生改名一致，applicationId 未变；
- platform-ports 合并没有丢失公共能力；
- D-6 清理干净，TR-08 守卫保留；
- 第 0 步的代码修复到位。

挡住 GO 的是两处：
- AC-3 要求新增的三条红测试没有进入仓内测试；
- integration-assembly 的 README 定位没有按要求重写。

## 2. 核实成立

- **目录**：旧的 `apps/terminal/assembly`、`ui/base/console-assembly` 与四个下线包目录均已不存在；`application/{android/sample-terminal, android/sample-wallpaper-terminal, base/android, electron}` 与 `ui/base/integration-assembly` 均已存在。
- **残留扫描**（活跃文件，排除四个历史目录与 `node_modules`）：
  - 以下字面量零命中：`apps/terminal/assembly`、`@catering-v2s/assembly-`、`assembly-base-android`、`console-assembly`、`kernel(-|.)base(-|.)workflow`、`kernel(-|.)base(-|.)test-support`、`ui(-|.)base(-|.)test-support`、`plannedDependencies`、`Console 基础装配`。
  - PCRE `assembly\.(android|base)\.` 与旧 Console 标识禁用集零命中。
  - `\bassembly[A-Z]\w*` 只剩两处，都属装配含义：`assemblyPromises`（`AndroidTerminalApp.tsx:23,44,45`）与 `assemblyModule`（`sample-console/test/testExpoApp.test.tsx:51-52`）。
  - 引号层名字面量只命中 `assembly-rejection`、readability 白名单第 21 行，以及 sample-console README 第 58 行登记过的装配对象。
  - `ui.base.automation` 与 `@catering-v2s/ui-base-automation` 只出现在 TR-08 守卫 `check-production-bundle.mjs:9-10` 及其红夹具 `check-production-bundle.test.mjs:18`。
- **身份四元组一致**：三个 application 包与 integration-assembly 的 package.json name、moduleName、`terminal-invariants.json` 的 package，以及包图节点相互一致；根 `package.json:18-19` 的 glob 已改；包内 `src/assembly/` 保留（`check-static.mjs:507,512` 仍按装配目录校验）。
- **包图**：
  - 节点数 29（批次一 13）已同步到检查器与测试（`check-static.mjs:650-651`、测试第 23–25 行）；
  - 两个 App 节点含 `ui.base.input`、`ui.base.primitives`；
  - 三个 UI feature 的 dev 边为 `kernel.base.platform-ports`；
  - 四个下线包没有节点。
- **层检查器**：`terminal-layering/check-static.mjs:117,166,184,185` 与 `terminal-skeleton/check-static.mjs:495,666,669,680,705,1141` 均已改为 application。
- **原生**：
  - 7 个 Kotlin 文件均为 `com.catering.v2s.terminal.application.base.android`，目录同步；
  - `build.gradle:6,10` 的 group 与 namespace、`expo-module.config.json` 的三个全名、两个 `MainActivity.kt:14` 的 import 均已同步；
  - 两个 applicationId 未变（`app/build.gradle:106`）。
- **运行期字符串**：
  - testID 默认值为 `application.base.android:loading`；
  - 配置助手错误前缀为 `[application-base-android]`；
  - integration-assembly 的 writer（`startupDiagnosticsWriter.ts:66`、`startupReady.ts:44`）、错误前缀与 `check-startup-diagnostics.mjs:8,58` 均为新值。
- **platform-ports 合并**：
  - `platform-ports/src/index.ts` 未改动（修改时间停在 09-20），公共导出完整；
  - 只有 `types/logging.ts:19,26` 的 layer 联合改为 `'application'`，这是允许的差异；
  - 三个 feature 的 package.json devDependency、`src/dependencies.ts` 的 `devDependencyModuleNames` 与 4 个测试文件的 type import 均指向 platform-ports，没有新增 production 依赖。
- **D-6**：`darkMode` 只剩 native projection 检查器的反向守卫（`check-native-projection.mjs:346`）与其红测试（`check-native-projection.test.mjs:88-89`，`DARK_MODE_RESIDUAL`）。
- **第 0 步**：
  - `PrimitiveForm` 与冻结接口一致：Web 下是一个 form 并先 `preventDefault`，原生下只是片段；
  - StaffLoginForm 已不再直接创建宿主标签；
  - 两个 harness 已移入 `src/components/`；
  - transport 夹具已补 `moduleName`。
- **键盘状态机重构抽查**：
  - `InputSurfaceFrame` 的 `presentationScrollFieldIdOf` 与原先各阶段取的字段一致；动画 effect 的依赖仍只有 phase、serial 与稳定回调，同一 serial 不重放的修复没有回退。
  - `InputScrollArea` 的 `layoutRectOf` 保留了原先的校验与三种失败原因。

## 3. Findings

### S-1 · AC-3 要求新增的三条红测试没有进入仓内测试 · CONFIRMED · 需 Dexter 裁决：否

**仓内事实**
- 需求 AC-3 要求补三条新红测试，分别对应：ui 依赖 application、adapter 依赖 application、application 包下出现 `node_modules`。详设 §9.3 也冻结了对应的 gate 与报文。
- 在 `tools/**`、`scripts/**` 中检索：
  - `reverse dependency ui->application`、`reverse dependency adapter->application` 零命中。layering 测试只有 `kernel->ui`（第 105、134 行）与 `adapter->ui`（第 289 行）两种红断言。
  - `scaffold metadata remains` 只出现在检查器 `check-static.mjs:1157`。skeleton 测试中的 hygiene 只有 PASS 断言（第 49、84、101 行），没有 application 夹具的红用例。

**影响**：这几条层规则本次都被改过名，但没有测试守着。以后若把 layering 第 184–185 行或 skeleton 第 1141 行的 `application` 写错，规则会空转，门照样全绿。R1B-03 与需求 AC-3 当初要防的正是这一点。

**最小修复**：
- 在 `tools/terminal-layering/check-static.test.mjs` 加两个变异：一个 ui 包依赖 application 包，一个 adapter 包依赖 application 包，分别断言 `p-5a-direction` 报 `reverse dependency ui->application (`、`reverse dependency adapter->application (`；
- 在 `tools/terminal-skeleton/check-static.test.mjs` 加一个在 application 包下创建 `node_modules` 的夹具，断言 hygiene 为 FAIL，且报文含 `scaffold metadata remains:`；
- 三条都先在未变异时通过，恢复变异后再次通过。

### S-2 · integration-assembly 的 README 定位没有重写 · CONFIRMED · 需 Dexter 裁决：否

**仓内事实**
- `apps/terminal/ui/base/integration-assembly/README.md` 的标题已改为“Integration 基础装配”，但“定位”一节仍是原句：“两个 terminal integration 共用的启动诊断写入 owner。它只写一次结构化 `startup.complete` 事实……”。
- 需求 PL-R02 与 AC-11 要求按实际职责重写定位：它是两个 integration 共用的整机装配壳，负责读设备与屏幕事实、合并 parts、建并启动 runtime、为每块屏幕生成界面树，启动诊断只是其中一项（TR-10）。

**影响**：README 对包职责的描述与代码不符，后来人会低估这个包的职责。

**最小修复**：按实际职责重写“定位”一节，并写明它导出 `createIntegrationAssembly`。

### N-1 · 死规则“application 包自环”被改名保留，没有删除 · CONFIRMED

- `tools/terminal-skeleton/check-static.mjs:766` 仍有 `moduleName.startsWith('application.') && dependency === moduleName`。
- 自环已由 `graph-model.mjs:155-157` 先行拒绝，这条规则永远走不到。需求 PL-R01 与详设第 456 行都要求删除。
- 最小修复：删除这条规则。

### N-2 · ui-state 检查器仍依赖相邻节点 · CONFIRMED

- `tools/terminal-ui-state/check-static.mjs:412` 改为以 `'ui.base.render':` 为结束锚点，只是换了一个相邻节点。需求 PL-R03 要求“不依赖相邻节点也能找到 ui-state 节点”。
- 它失败时会直接抛错，不会静默放过，所以记 N。
- 最小修复：以条目自身的缩进边界截取，例如匹配到下一个同级 `\n  },`，或直接读取包图模块的导出；再补一个“在 ui-state 之后插入一个节点仍能解析”的用例。

### N-3 · 个别 README 行的“装配义”归类理由偏弱 · PARTIALLY_CONFIRMED

- 这两行按上下文更像指层本身：
  - `application/android/sample-terminal/README.md:22`：“src/moduleName.ts 本 assembly 的固定 moduleName”，而该 moduleName 就是 `application.android.sample-terminal`；
  - `kernel/base/platform-ports/README.md:33`：“UI / assembly 控制面”。
- 详设分类表把它们登记为“装配义、保留”（AC-11-readme-007、-002）。
- 最小修复：这两行改用 application 的说法，或在分类理由中写得更具体。其余 README 的保留判断，本评审不推翻。

## 4. 观察（不计 finding）

- `InputScrollArea` 两个 `measureLayout` 回调改为元组剩余参数 `(...measurement)`，以满足 TR-R04。平台回调天生是 4 个位置参数，用带类型的元组接住、再由 `layoutRectOf` 统一转成具名的 `LayoutRect`，属于合理的适配；它没有改变行为。
- `InputSurfaceFrame` 的 `startPresentationAnimation` 实际做的是启动计划中的滚动，不是启动动画，名字容易误导。可以顺手改名，不影响正确性。

## 5. 方案合理性与边界

实现与详设方向一致，没有发现夹带的行为改动。两处 S 都是按需求补齐测试与文案，修正的代价很小。

TR-08 在代码层保持现状：harness 未改，守卫 token 保留。TR-08 仍为 OPEN，本评审不把它视为已关闭。

UI 自问：NOT_APPLICABLE。用户可见的表单、交互与失败码都未改变。

本结论只覆盖代码静态实现，不授权修改，也不覆盖动态、视觉、业务或设备验收。

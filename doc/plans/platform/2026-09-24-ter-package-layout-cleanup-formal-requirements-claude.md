# TER 包布局整理正式需求（v5）

> STATUS: REVISED_AFTER_CODEX_V4_REVIEW；`REVIEW_TARGET=DESIGN`（需求）；不是详设或实施计划。
> REVIEW_CYCLE_ID: `TER_PACKAGE_LAYOUT_CLEANUP_2026-09-24`。
> REVIEW HISTORY：
> - Claude 侧两轮 fresh 独立盲审（5 份）已收口；
> - Codex 第 1 次评审 NO-GO 3/7/3，作者处置见 `doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-intake-claude.md`；
> - Codex v4 复核 NO-GO 3/2/2（`doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-v4-codex.md`），Codex 同意第 974 行保留；v5 按该复核逐条修订，见方案 §11。
>
> DECISIONS：
> - Dexter 2026-09-24 “你来决定吧”：D-3、D-4、D-5 由 Claude 决定；
> - Dexter 2026-09-24 “把本批范围扩大到所有门全部通过。你拥有所有授权。接不接受修订，你决定”：本批以三道门及其全部子门全绿收尾；
> - Dexter 2026-09-25 “darkMode是啥，没用的东西就删除下线吧”：darkMode 配置整体删除（D-6）。
>
> SOLUTION: `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md`（下称“方案”）。
> BASELINE（SHA-256 前 16 位）：`apps/terminal/skeleton-graph.ts` 91a81528bc254f4a；根 `package.json` d619eea47415ad24；
> `doc/platform/terminal-coding-standard.md` 48cb9523844c613b；`tools/terminal-layering/check-static.mjs` fc9427c512aa6df3；
> `tools/terminal-skeleton/check-static.mjs` 0138abe64251d927；`apps/terminal/ui/base/console-assembly/src/index.ts` 84a10bcdd23513c4；
> `apps/terminal/ui/base/test-support/src/index.ts` bd58db631138a65f；`apps/terminal/assembly/base/android/expo-module.config.json` 15c41017acc4ae8a；
> 两个 `debug.keystore` 均为 221e0a3106aa4c3c。

## 1. 用户任务、现状与选择

### 1.1 Dexter 原文（逐字）

> TER包调整优化需求：
> 1，apps/terminal/assembly目标，我希望重命名为apps/terminal/application，不叫assembly了
> 2，apps/terminal/ui/base/console-assembly包重命名为apps/terminal/ui/base/integration-assembly
> 3，apps/terminal/ui/base/automation、apps/terminal/kernel/base/workflow、apps/terminal/kernel/base/test-support、apps/terminal/ui/base/test-support这四个包仔细看看，如果暂时没有用，就做下线处理，以后用的时候再加。

同日补充（逐字）：

> ui/base/test-support，我看内容很少，如果可以，就合并到其他包里
>
> 键盘批次已经结束了
>
> 你来决定吧。
>
> 把本批范围扩大到所有门全部通过。你拥有所有授权。接不接受修订，你决定
>
> darkMode是啥，没用的东西就删除下线吧

第 1 条的“目标”按“目录”理解。

### 1.2 真实目标

一是让 TER 的目录名和包名直接说明它是什么，并去掉当前没有用的空壳，减少维护面和误导。二是按 Dexter 的扩大授权，本批结束时三道门（typecheck、test、`verify:static`）及其全部子门全绿。

改名与下线部分不改运行行为。基线修复只修门报出的问题；若某条修复确属缺陷修正而会改变运行行为，必须逐条列明并单独验证（PL-R05）。

### 1.3 现状事实（2026-09-24 当前字节）

**`assembly` 的两种用法**，第 1 条只针对第一种：

- **层名**：`apps/terminal/assembly/` 是可运行 App 层。
  - `android/sample-terminal`、`android/sample-wallpaper-terminal`：两个 Expo Android App 壳。
  - `base/android`：两者共用的原生基座。
  - `electron/`：只有一份预留 README，不是 workspace。
- **“装配”动作**：
  - `ui/base/feature-assembly`、`ui/base/console-assembly`；
  - 各包 `src/assembly/` 目录。编码规范 §7.1 的 `src/` 目录词表第 974 行正是这个含义，应保留。
  - `createXxxAssembly`、`AndroidTerminalApp` 的 `createAssembly` prop；
  - 失败码 `assembly-rejection`、日志事件 `sample.assembly-created`。

**目录、包名与 moduleName 绑在一起。**
- `tools/terminal-skeleton/graph-model.mjs:177-191` 由 moduleName 推导包路径和包名。
- npm 包一改名，Expo 自动链接生成的 Gradle 工程名就随之改变（`expo-modules-autolinking` 的 `build/platforms/android/android.js:142-144`）。

**`ui/base/console-assembly`** 是两个 integration 共用的整机装配壳：
- `createConsoleAssembly` 读设备与屏幕事实、合并 parts、建并启动 runtime、为每块屏幕生成界面树，并只写一次 `startup.complete`。
- README 标题“Console 基础装配”，“定位”只写了“启动诊断写入 owner”，与实际不符。

**四个待看的包**

| 包 | 源码 | 消费者 | 仍被引用之处 |
|---|---|---|---|
| `ui/base/automation` | 3 个文件 10 行，无 README、无测试 | 无 | 包图节点与 primitives 边（`skeleton-graph.ts:106,115`）；primitives `plannedDependencies`（`package.json:8-10`）与 README 第 75–78 行；`TR-08` 守卫 token（`check-production-bundle.mjs:9-10`）及红夹具（`check-production-bundle.test.mjs:16-22`）；skeleton 测试夹具（`check-static.test.mjs:844`）；ui-state README 第 10 行；yarn.lock |
| `kernel/base/workflow` | 3 个文件 11 行 | 无 | 包图节点（第 49 行）；ui-state 测试夹具（`tools/terminal-ui-state/check-static.test.mjs:138`）；yarn.lock |
| `kernel/base/test-support` | 3 个文件 11 行 | 无 | 包图节点（第 67 行）；skeleton 测试夹具（`check-static.test.mjs:727,731`）；ui-state 检查器用它作正则边界截取 ui-state 节点（`tools/terminal-ui-state/check-static.mjs:411-419`）；yarn.lock |
| `ui/base/test-support` | 4 个文件 15 行，只转出 platform-ports 已导出的 5 个类型（`platform-ports/src/index.ts:18-33,135-139`；本包 `src/index.ts:3`） | 三个 feature 的测试 | 三个 feature 的 package.json devDependency、`src/dependencies.ts`、4 个测试文件；包图节点与三条 dev 边；dev-host README 第 7 行 |

另有两处写死的检查器数据：
- skeleton 检查器写死节点数 33（`check-static.mjs:667-668`，测试第 23–25 行）；
- `plannedDependencies` 机制（`check-static.mjs:460-468,600-613`）只有 primitives 一处实例。

**`ui/base/test-support` 的来历与先例**：
- 2026-09-14 R-E6、M-1、N-8 因门不扫 `test/`，改由它转出类型，并明确“不给 feature 声明 platform-ports”；
- 三个 kernel feature 早已在 `src/dependencies.ts` 的 `devDependencyModuleNames` 声明 platform-ports（如 `kernel/feature/sample-staff-session/src/dependencies.ts:4,7`）。

**下线先例**：2026-09-15 两个零消费 adapter 空壳按 `OFFLINE_MOVE_NOT_DELETE` 移出仓库并留有记录，同批同步更新了包图、检查器计数与红变异、yarn.lock。记录见 `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/obsolete-file-cleanup-round2.md`。

**当前基线（Codex 2026-09-24 实跑；Claude 未复跑，只做了静态根因核查）**

| 门 | 结果 | 已知失败与根因 |
|---|---|---|
| `yarn --cwd apps/terminal typecheck` | PASS（33/33） | — |
| `yarn --cwd apps/terminal test` | FAIL | transport `test/identityClient.test.ts` 2 处 `invalid topology identity response`。根因：2026-09-18 身份响应契约新增必填字段 `moduleName`（`contracts/src/foundations/topologyWire.ts:216-225`），原生发送方已发送该字段（`TerminalTopologyServer.kt:140`），而该测试的夹具（第 4–11 行）早于契约变更、缺这个字段，属于**夹具过时** |
| `yarn --cwd apps/terminal verify:static` | FAIL，首败为 readability-real-static，含 TR-R03/04/05/06 | 已知：<br>- 两个 App 的 `src/controlledKeyboardHarness.tsx` 位于源码根（TR-R06）；<br>- `ui/feature/sample-staff-auth/src/components/StaffLoginForm.tsx:13` 的 `createElement('form', …)`（TR-R03）。<br>其余 TR-R03/04/05/06 条目需第 0 步实跑后列全 |
| skeleton 子门 | FAIL `RULE_GRAPH_COMPARISON` | 两个 App 节点缺 `ui.base.input`、`ui.base.primitives` 两条边 |
| layering 子门 | FAIL | `StaffLoginForm.tsx:13` 在 feature 内直接创建宿主标签 `form`（P-5d） |
| ui-state 子门 | PASS | — |
| `tools/terminal-sample2/check-native-projection.test.mjs` | FAIL（Codex v4 复核实跑） | `sample-terminal has an unallowed darkMode difference`。该检查器（`check-native-projection.mjs:346-351`）只允许 wallpaper 设 `darkMode`，而 sample-terminal 的 `tailwind.config.cjs:3` 在 2026-09-24 键盘批次中加了 `darkMode: 'class'`；同批的 `assembly/base/android/test/keyboardThemeConfig.test.ts:47` 又要求两个 App 都设 `'class'`，两处互相矛盾。见 D-6 |
| scaffold hygiene | 未定 | Claude 静态看到的三处 Vitest 缓存目录 `node_modules/`（`assembly/base/android`、`adapter/android/device`、`adapter/android/dual-screen`）会被 `run-owned-tests.mjs` 清理；Codex 复核时部分已被清掉。现状必须在任何会清理的 runner 之前盘点（PL-R00） |

**darkMode 没有作用（Claude 静态核查）**
- 设置位置：两个 App 与两个 integration 的 `tailwind.config.cjs` 都设了 `darkMode: 'class'`；基座 `config/index.cjs:178-179` 支持透传该参数；两处测试断言它存在，即 `keyboardThemeConfig.test.ts:47` 与 `ui/integration/sample-console/test/theme.test.ts:68`。
- 没有作用的依据：
  - 全 TER 的 `ui/**`、`assembly/**` 没有任何 `dark:` 样式变体；
  - 全部 CSS 中没有 `.dark` 或 `prefers-color-scheme` 块；
  - 没有代码调用 `colorScheme.set`、`setColorScheme` 或 `useColorScheme`。
- 因此无论设成 `'class'` 还是不设，界面都不变。

**harness 与 TR-08**
- 两个 `App.tsx:8-19` 无条件接入 `controlledKeyboardHarness`，release 包中可被显式 intent 切到测试页。
- `TR-08`（规范第 278–294 行）要求自动化与测试入口在生产包编译期即不存在。
- 现有生产包守卫的 token（`check-production-bundle.mjs:8-17`）不含 harness。

**被忽略但必须随迁的文件**：两个 App 的 `android/app/debug.keystore`（`.gitignore:16`），debug 与 release 都用它签名（`app/build.gradle:114-129`）。

## 2. 名词与范围

- **application 层**：原 `assembly` 层。
- **装配（assembly）**：把部件拼起来的代码或步骤。除 console-assembly 包本身外不改。
- **活跃文件清单**：`git ls-files -co --exclude-standard` 的输出，即受控文件加上未跟踪、未被忽略的文件，扣除历史记录目录。它包括源码、配置、检查器、脚本，以及 `doc/platform/**`、`doc/decisions/**`、`AGENTS.md`、`CLAUDE.md`、`HANDOFF.md`、`project-memory/**`、`.agents/skills/**`、各包 README。
- **历史记录**：`doc/plans/**`、`doc/review/**`、`doc/handoffs/**`、`doc/evidence/**` 下的既有文件，不改写。
- **三道门**：`yarn --cwd apps/terminal typecheck`、`yarn --cwd apps/terminal test`、`yarn --cwd apps/terminal verify:static`，以及 `verify:static` 调用的全部子门。

## 3. 必须满足的要求

### PL-R00 · 第 0 步：基线全绿

1. **先盘点，再跑门**。在运行任何会清理现场的 runner 之前，先只读盘点全部被忽略产物（Vitest 缓存目录、构建产物、`.runtime/`、keystore），记录存在性、目录清单与字节数。然后实跑三道门，并单独跑各子门，包括 skeleton、layering、ui-state、readability，以及 AC-6 列出的全部工具测试。逐条记录命令、退出码、首败、gate、文件、行、报文，冻结为**基线失败清单**。同时记录两个 keystore 的哈希。
2. 清单中每一条都按根因修复。已知条目的修法如下：
   - 包图两个 App 节点补上 `ui.base.input`、`ui.base.primitives`，与 package.json、`src/dependencies.ts` 及实际 import 一致。
   - `controlledKeyboardHarness.tsx` 原样移入 `src/components/`（D-5）。这是生产可导入的合法目录；不能放 `testing/`，按规范它不进生产导入图。
   - 删除盘点到的 Vitest 缓存目录。
   - transport 的 identity 夹具补上 `moduleName`，与现行契约及原生发送方一致。
   - darkMode 整体删除（D-6），涉及：
     - 四个 `tailwind.config.cjs` 中的 `darkMode: 'class'`；
     - 基座 `config/index.cjs:178-179` 的 `darkMode` 参数；
     - `keyboardThemeConfig.test.ts:47` 与 `sample-console/test/theme.test.ts:68` 两处断言；
     - `check-native-projection.mjs:346-351` 给 wallpaper 开的例外，改为任何 App 都不得出现 `darkMode`；
     - 检查器的红测试同步。
   - `StaffLoginForm.tsx` 不再在 feature 内创建宿主标签：Web 下的 `form` 宿主由 `ui/base/primitives` 提供，原生子树与 Web 提交语义保持不变。具体接口由详设定。
   - 其余 readability 条目（TR-R03/04/05/06）按规则重构：拆函数、参数对象化、提前返回、移动到词表目录，不改运行行为。
3. 如果某条修复需要做产品或 Journey 取舍，停下来报 Dexter（DEXTER_DECISION）。如果某条修复属于缺陷修正、会改变运行行为，按 PL-R05 逐条登记。
4. 第 0 步完成时，三道门及全部子门全绿，才进入第 1 步。

### PL-R01 · assembly 层更名为 application

- 在同一块盘上整体移动 `apps/terminal/assembly/` 为 `apps/terminal/application/`，被忽略的 `debug.keystore` 与 `.runtime/` 随之过去。构建前删除新目录下绑定旧路径的可重建产物：`.expo/`、`.turbo/`、`android/.gradle/`、`.kotlin/`、`app/.cxx/`、`app/build/`、`android/build/`、`dist/`。
- 以层命名的标识一并改名，不保留别名或兼容层：
  - **npm 包名与 moduleName**：`assembly-` 改为 `application-`，`assembly.` 改为 `application.`。
  - **工作区与包图**：根 `package.json:18-19` 的两条 workspace glob；包图节点与边。
  - **检查器与工具**：以层命名的规则谓词与字面量。以下行号仅供定位：
    - `tools/terminal-layering/check-static.mjs` 第 117、166、184、185 行；
    - `tools/terminal-skeleton/check-static.mjs` 第 507、683、686、697、722、1158 行；
    - `tools/terminal-skeleton/verify.mjs` 的 `assembly-export*`；
    - `tools/terminal-sample2/check-native-projection.mjs:264-265`，这里写死了旧 npm 名；
    - 各运行脚本中的路径。
  - **运行期字符串**：
    - `LogScope`、`LogScopeBinding` 的 `layer` 成员 `'assembly'`（`platform-ports/src/types/logging.ts:19,26`）；
    - 错误前缀 `[assembly-base-android]`（`config/index.cjs:18,53,62`）；
    - 开机画面 testID 默认值 `assembly.base.android:loading`（`AndroidTerminalApp.tsx:33`）。
  - **Android 原生**：Kotlin 包 `com.catering.v2s.terminal.assembly.base.android` 改为 `…application.base.android`，含 `build.gradle:6,10`、`expo-module.config.json:5-7`、6 个主源文件与 1 个测试文件的声明和目录、两个 `MainActivity.kt:14`。
  - **正本文档中指这一层的 assembly**：按 AC-11 的逐处分类清单处理。
- `tools/terminal-skeleton/check-static.mjs:783` 的“assembly 包自环”规则是死代码：`graph-model.mjs:155-157` 已先拒绝任何自环。删除这条规则。
- **不改**：
  - Android `applicationId`、持久化键、`LOG_TAG`；
  - 装配含义的名字，包括规范 §7.1 的 `src/assembly/`；
  - readability 白名单 `'application'`、`'assembly'`（第 15、21 行）；
  - 历史记录。

### PL-R02 · console-assembly 更名为 integration-assembly

- 目录、npm 名、moduleName 改为 integration-assembly，包图与两个 integration 的依赖声明同步。
- 包内全部以 `Console`/`console` 命名的标识改为 `Integration`/`integration`，含：
  - 导出的 `createConsoleAssembly`、`ConsoleAssembly`、`ConsoleAssemblyInput`、`ConsoleSurfaceCreationInput`、`ConsoleSurfaceDeclarations`；
  - 内部的 `ConsoleDefinedPart`、`ConsoleRuntimeBundle`、`ConsoleRuntimeSubscription`、`ConsoleSurfaceInputFrame`（含 Props）；
  - 文件 `consoleAssembly.tsx`。
- 以包名为值的字符串同步改：
  - 启动诊断 `owner`（第 418 行）；
  - `writer`（`startupDiagnosticsWriter.ts:66`、`startupReady.ts:44`）；
  - 日志 `source`（第 295、318、647、669、687、696、720 行）；
  - 错误前缀（第 114–179 行）；
  - 日志文案（第 667 行）；
  - 检查器 `tools/terminal-sample2/check-startup-diagnostics.mjs:8,58`。
- README 按实际职责重写标题与定位（TR-10）。
- **不改**：integration 自有的名字，例如 `WallpaperConsoleAssembly`、`createSampleWallpaperConsoleAssembly`、`sample-console`。

### PL-R03 · 三个空壳包下线

- `ui/base/automation`、`kernel/base/workflow`、`kernel/base/test-support` 按 D-4 移出仓库，仓内不再存在。
- 删除它们在活跃文件中的引用：
  - 包图节点与边；
  - primitives 的 `plannedDependencies`；
  - README 中关于这些包与边的陈述。primitives README 中“为将来自动化接入提供挂点”的设计意图保留。
  - yarn.lock 条目，由安装重新生成。
- 检查器同步：
  - skeleton 检查器与测试的节点计数；
  - ui-state 检查器改为不依赖相邻节点取 ui-state 节点；
  - 四处夹具换靶（AC-3）；
  - 删除 `plannedDependencies` 机制。
- **保留**：`TR-08` 守卫中 automation 的点号与 npm 两种写法 token，以及它的红夹具。

### PL-R04 · ui/base/test-support 并回 kernel/base/platform-ports

- 三个 feature 的测试直接从 `@catering-v2s/kernel-base-platform-ports` 导入 5 个类型。
- 三个 feature 的 package.json `devDependencies`、包图 `devDependencies`、`src/dependencies.ts` 的 `devDependencyModuleNames` 三处一致，与 kernel feature 先例同形。
- platform-ports 的生产 index 与导出不变。
- `ui/base/test-support` 按 D-4 移出；dev-host README 第 7 行同步。

### PL-R05 · 行为边界与验证

- 改名与下线（第 1–3 步）不改运行行为。只允许以下差异：
  - 包名、moduleName；
  - 日志 `owner`、`writer`、`source`、错误前缀，以及含旧包名的日志文案；
  - `LogScope.layer` 成员；
  - testID 默认值；
  - Kotlin 全名；
  - 工具阶段标签。
- 第 0 步的修复原则上不改运行行为。确属缺陷修正而改变运行行为的，逐条登记改前改后、根因与专门测试，并纳入 AC-10 的场景或另加场景。
- 验证：
  - 静态：AC-0 至 AC-8；
  - 原生：AC-9；
  - TR-16 配对：AC-10。
  - `TR-08` 不在本批关闭范围内：AC-13。

## 4. 可证伪验收条件

扫描口径：
- 对 §2 的活跃文件清单逐文件扫描。字面量用固定字符串匹配，正则用 PCRE（如 `git grep --untracked -P` 或 `rg -P`，必须覆盖清单中的未跟踪文件）。
- 每条模式先在改动前的树上做正控制并记录命中数。
- 删掉一个扫描输入文件、把旧名改成未列出的同义标识，这两种变异都必须被发现。

**AC-0 基线**
- 改动前的基线失败清单（逐条 gate、文件、行、报文）与 keystore 哈希留档。
- 第 0 步后三道门及全部子门全绿；清单中每一条都有对应的修复与根因记录。
- 需要产品取舍的条目，登记为 DEXTER_DECISION 并停下。

**AC-1 目录与下线记录**
- 不存在：`apps/terminal/assembly/`、`apps/terminal/ui/base/console-assembly/`、四个下线包目录。
- 存在：`apps/terminal/application/{android/sample-terminal, android/sample-wallpaper-terminal, base/android, electron}`、`apps/terminal/ui/base/integration-assembly`。
- 四个下线包各有一份记录，含：
  - 仓外持久根路径（不用 `/tmp`）；
  - 不碰撞的命名：日期、包名、短哈希；
  - 源与目标相对路径、文件数、字节数、逐文件 sha256 清单、移出时间、恢复命令；
  - test-support 那一份另注明 5 个类型的来源。
- 按清单恢复出的字节必须与原字节一致。
- 清理只触及本批包。

**AC-2 活跃文件残留扫描**
- (a) 字面量零命中：
  - `apps/terminal/assembly`、`@catering-v2s/assembly-`、`assembly-base-android`、`console-assembly`、`Console 基础装配`、`plannedDependencies`；
  - `ui-base-automation`、`kernel-base-workflow`、`kernel.base.workflow`、`kernel-base-test-support`、`kernel.base.test-support`、`ui-base-test-support`、`ui.base.test-support`；
  - 正则转义写法 `assembly\.`。
- (b) PCRE 零命中：
  - `assembly\.(android|base)\.`；
  - 层名的标识符写法 `\bassembly[A-Z]\w*`。
    - 改动前正控制约 50 处，涉及 `assemblyModuleName`、`assemblyDirectory`、`assemblyRoot`、`assemblyBaseAndroid`、`assemblyModuleNames`、`assemblyBaseGraphPattern`、`assemblyBaseFile`、`assemblyModule`、`assemblyBasePackagePath`、`assemblyBaseIndexPath`、`assemblyAdapterDependencyViolation`、`assemblyPromises` 等。
    - 详设逐处分类：层义的改为 `application…`；确属装配义的（例如指 `createAssembly` 返回的 promise）逐处登记理由，不能按文件整体放行。
    - 红变异：把一个已改的标识改回 `assemblyRoot` 或 `assemblyDirectory`，扫描必须报出文件、行与规则。
    - 反向控制：`src/assembly/` 路径、装配变量 `assembly`、`createAssembly` 回调、integration 自有 Console 名不得被误报；
  - 由旧 console-assembly 包的标识清单（导出与内部）生成的词边界禁用集，例如 `\b(createConsoleAssembly|ConsoleAssembly|ConsoleAssemblyInput|ConsoleSurface\w*|ConsoleDefinedPart|ConsoleRuntime\w*|consoleAssembly)\b`。它不能命中 integration 自有的 `WallpaperConsoleAssembly`、`createSampleWallpaperConsoleAssembly`。
- (c) 代码与配置（`tools/**`、`scripts/**`、`apps/terminal/**`）中，PCRE ``['"`]assembly['"`.\-]`` 只允许命中：
  - readability 白名单第 21 行；
  - `assembly-rejection`；
  - 详设逐条登记、写明理由的装配含义命中，例如 sample-console README 第 58 行的 `` `assembly.createSurface(...)` ``。
- (d) `ui.base.automation` 与 `@catering-v2s/ui-base-automation` 只允许出现在 `TR-08` 守卫及其测试夹具中。
- (e) 正本散文按 AC-11 的逐处分类清单核对。

**AC-3 检查器红测试**
- 规则按谓词识别；每条红测试断言具体 gate 名与报文前缀。
- 已有以 assembly 包为夹具的红断言，改名后照常计数，例如 skeleton 测试第 347、402、412、525 行。
- 需要补新红测试的规则：
  - ui 包依赖 application 包；
  - adapter 包依赖 application 包；
  - application 包下出现 `node_modules`。
- 四处换靶夹具：详设写明输入文件、唯一变异、预期 gate、报文前缀与恢复步骤，并先证明未变异时通过。
- `plannedDependencies` 删除后的控制由 AC-2(a) 负责，不新增检查器规则。

**AC-4 包图**
- 节点集合等于工作区实际包集合，检查器计数与之相符。
- 四个下线包没有节点。
- 三个 feature 的 dev 边为 `kernel.base.platform-ports`。
- primitives 没有 automation 边。
- App 节点含 `ui.base.input`、`ui.base.primitives`。

**AC-5 feature 测试类型**
- 三个 feature 的测试从 platform-ports 导入 5 个类型，PL-R04 的三处声明一致，graph comparison 通过。
- platform-ports 的生产 index 与改动前字节相同。

**AC-6 编译、测试与静态门**
- 每一步结束时三道门及全部子门全绿。
- 本批改过的工具测试全部实跑通过：terminal-skeleton、terminal-layering、terminal-ui-state、terminal-sample2（含 `check-production-bundle.test.mjs`）、terminal-image-compare、`ter-virtual-keyboard-android.test.mjs`。
- 每步只允许出现该步预定的 workspace 条目变化；干净安装后，yarn.lock 不含下线包与旧名条目。
- 锁文件只由本条验收。

**AC-7 启动诊断**：两个 integration 的 `startup.complete` 中 `owner`、`writer` 为 `ui.base.integration-assembly`；把 writer 改回旧值时检查器必须失败。

**AC-8 没有夹带改动**
- **快照文件集**：等于改动前的**全部**活跃文件清单，不再只取“源码与配置”，另加 keystore 与 `.runtime/`。
- **清单格式**：快照清单（manifest）逐文件记录 `path`、`category`、`sha256`、`allowedDiffRef`。
  - `category` 取以下之一：源码、配置、检查器与工具、脚本、测试、README、正本、记忆、skill、keystore、runtime。
  - `allowedDiffRef` 指向允许差异表中的条目；没有条目的文件必须逐字节不变。
- **比对顺序**：先比文件集合。新增、删除、改名的文件都必须在允许差异表中登记（目录迁移按映射表整体登记）。再对每个文件用锚定 token 表反向映射后比 sha256。
  - 包内 `src/assembly/`、`createXxxAssembly`、`assembly-rejection`、integration 自有 Console 名不参与映射。
- **允许差异表**：与 AC-11 的逐处分类表是同一张表。正本、记忆、skill 的文案差异引用 AC-11 的分类行；其余引用本需求的 PL 条目，例如：
  - 下线与合并；
  - 第 0 步修复，并注明是否改变行为；
  - 检查器计数、夹具与规则删除；
  - darkMode 删除。
- **不参与比对**：锁文件归 AC-6；可重建产物不比较。
- **红变异**：以下情况都必须失败：
  - 快照为空；
  - 多出一行无关改动；
  - 未登记的新增或删除文件；
  - 一个文件没有分类；
  - 改了一个不在允许表中的字符串；
  - 扩大允许表。
- 本条只证明没有夹带改动；改名是否完整由 AC-2 证明。快照清单的具体生成方式由详设给出。

**AC-9 原生**：两个 application 包分别构建、分别核对，不能共用一次读取。
- 两个 application 包 release 构建成功。
- **生成的模块清单**：Expo 自动链接的产物目前生成在共享位置 `apps/terminal/node_modules/expo/android/build/generated/expo/src/main/java/expo/modules/ExpoModulesPackageList.kt`，每次构建都会覆盖。因此每个 App 构建完成后立即读取一次，并记录读取时间与构建标识。
  - 其 `modulesMap` 必须恰含三个新全名、不含旧全名；
  - 注意不能误读 React Native 的 `PackageList.java`，那不是同一个产物。
- **APK 内核对**：每个 APK 内的 dex 必须含三个新全名的类、不含旧全名的类。命令（`apkanalyzer` 或等价工具）由详设写明。
- **签名**：
  - 两个 `debug.keystore` 哈希与基线相同；
  - 每个 APK 的证书摘要（`apksigner verify --print-certs` 或等价命令）等于对应 keystore 的证书摘要（`keytool -printcert` 或等价命令）。
- **红变异**：以下情况都必须失败：
  - 改错一个模块类名；
  - 换一个 keystore；
  - 读到错误的生成文件或另一个 App 的构建结果。

**AC-10 TR-16 配对矩阵**：先 Web 后设备，逐行并列；两端源码摘要相同，Web 时间早于设备。

| Web（integration 的 `web` 脚本） | 设备 |
|---|---|
| sample-console，mobile 形态，冷启动到首屏，不交互 | sample-terminal APK，mobile 虚拟机，冷启动 |
| sample-wallpaper-console，laptop 双屏预览，冷启动到首屏 | sample-wallpaper-terminal APK，单机双屏虚拟机，冷启动，PRIMARY 与 SECONDARY 分别观察 |

- **启动证据入口**：`startup.complete` 由 integration-assembly 的 `startupDiagnosticsWriter.ts:52-65` 写出（改名前是 console-assembly），readiness 由 `consoleAssembly.tsx:374-385` 建立。字段路径冻结如下：
  - `data.client.owner`、`data.writer`；
  - `data.groups` 下的六组；
  - `data.primaryDeclared`、`data.primaryMeasured`、`data.primaryRealReady`；
  - `data.primaryReadyPartKey`、`data.primaryContentFailure`；
  - `data.startupRunId`、`data.appName`、`data.surfaceProvenance`。
- **读取入口**：
  - Web：该日志经 logger 端口输出后的读取方式；
  - 设备：按 `LOG_TAG` 过滤 logcat。
  - 两端的确切命令由详设写明。
- **SECONDARY 证据**：release 包中没有带 partKey 的 SECONDARY 结构化日志，不为取证新增日志。
  - 改为从界面树读取 SECONDARY 上 part 根节点的 testID：设备端用 uiautomator 按 displayIndex 1 抓取，Web 端从双屏预览的 DOM 读取；
  - 由 part 的 testID 约定映射到 partKey。
- **证据记录格式**：每行一条 JSON，字段为 `row`、`end`（web 或 device）、`sourceDigest`、`capturedAt`、`runId`、`startupComplete`（上列字段）、`secondary`（`displayIndex`、`partKey`、`testID`，仅双屏行）、`cleanup`。Web 与设备两端用同一个 schema。
- **期望值**：`primaryReadyPartKey` 与 SECONDARY partKey 的具体值，由详设从源码列出并经评审冻结；`primaryContentFailure` 为空；`owner` 与 `writer` 为 `ui.base.integration-assembly`。
- **变异**：以下情况都必须在明确字段上失败：
  - 交换 SECONDARY partKey；
  - 清空 readiness；
  - 把 writer 改回旧包名；
  - 两端源码摘要不同；
  - 用截图代替 JSON 记录。
- **设备端追加**：开机画面由原生 NativeLoading 关闭，并有对应日志。
- 实施阶段执行前，AC-10 一律记为“未执行”。

**AC-11 正本文档逐处分类**
- 详设先列出活跃文件中正本类文件里 `assembly` 的每一处出现，逐处标为“层，改为 application”或“装配，保留并写理由”。已知必改的有：
  - 编码规范 `TR-16`（第 655–662 行）与 `TR-17`（第 705、745 行）；
  - `doc/platform/implementation-task-template.md:173`；
  - `AGENTS.md:53`、`CLAUDE.md:48`；
  - skill `cs-managed-runtime-execution/SKILL.md:85`、`cs-spec-to-plan/SKILL.md:35-40`、`cs-writing-plans/SKILL.md:60-63`；
  - `project-memory/decisions/terminal-architecture-and-stack-rulings.md:23-28`；
  - `project-memory/operations/terminal-coding-standard.md:47`；
  - `project-memory/practices/ter-input-and-virtual-keyboard-usage.md:38`。
- 已知保留：规范 §7.1 第 974 行的 `assembly/`。Codex v4 复核同意这一点。
- 分类范围包括 `doc/decisions/**` 中仍生效的文件，例如 `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md`。
- `project-memory/decisions/terminal-build-order-and-batches.md` 是 `status: active` 的记忆文件：
  - 追加带日期的规范性取代条目，写明第 20–54 行所列建设顺序中已下线的包、层名变更，以及其优先级；
  - 同步 assertion、`required-inventory.json`（含第 4863 行的 TR-16 锚点）与 index；
  - 运行 `scripts/memory/build-index`、`scripts/memory/build-index --check`、`scripts/check/project-memory`；
  - 用查询证明新结论优先返回，且不再把已下线包作为当前建设步骤。
- integration-assembly README 的标题与定位与实际一致。

**AC-12 历史记录不改写**：§2 的四个历史记录目录下的既有文件不因本批而修改。

**AC-13 TR-08 口径**
- 交付记录明确写 `TR-08=OPEN/OUT_OF_SCOPE`。生产包检查器绿、AC-6 与 AC-8 通过，都不代表 TR-08 关闭。
- 后续待办写明 owner、输入与首个 gate：harness 改为只在 debug 构建中存在，或删除，届时由 Dexter 裁定。

## 5. 决策

- **D-1 Kotlin 包名随层改名**：SELF_DECIDED 为改。npm 改名已使原生重构建必然发生；改 Kotlin 包只多出机械改动，错了会在编译期或 AC-9 暴露。
- **D-2 包内 Console 标识全部改名**：SELF_DECIDED 为改。integration 自有的名字不在其列。
- **D-3 ui/base/test-support 并回 platform-ports**：按 Dexter 授权决定。这 5 个类型本来就是 platform-ports 的根导出，且仓内有同形先例；不选 feature-assembly 或 dev-host，理由见方案 §6。
- **D-4 下线方式**：按 Dexter 授权决定，沿用 09-15 先例（线下移出、不删除、留记录），并按 AC-1 补齐可恢复证据。
- **D-5 harness**：按 Dexter 授权决定，第 0 步原样搬入 `src/components/`，行为不变；`TR-08` 保持 OPEN（AC-13）。
- **M-3 范围**：Dexter 决定扩大范围，本批以三道门及全部子门全绿收尾（PL-R00）。
- **D-6 darkMode 整体删除**：Dexter 2026-09-25 决定。
  - 依据：它在 TER 中没有任何作用，见 §1.3。
  - 删除后界面不变，属于行为不变的第 0 步修复。
  - 这推翻了 native projection 检查器中“wallpaper 按需求保留 darkMode 差异”的旧规定。
  - 若详设发现有代码依赖它，停下来报 Dexter。

## 6. 非目标与授权边界

- 不改 Android `applicationId`、持久化键、装配含义的名字、integration 包名及其自有 API 名。
- 不改 `TR-08`，不下线其它包。
- 不改写历史记录。
- 第 0 步只修门报出的问题，不借机重构门未报的代码。
- 实施授权：Dexter 已给出全部授权。实施前仍须由 Codex 出详设与实施计划，并按仓规评审。

## 7. 与现行正本、既有裁定的关系

- 落地后，`TR-16`、`TR-17` 等正本中指这一层的 assembly 改为 application；规范 §7.1 的 `src/assembly/` 保留。
- PL-R04 取代 2026-09-14 的 N-8，并推翻同批 R-E6、M-1 中“不给 feature 声明 platform-ports”的处置。当时的判断出自门的扫描机制，本需求按 kernel feature 的先例显式声明 dev 边。
- 2026-08-29“workflow 属于地基”与建设顺序：Dexter“以后用的时候再加”已覆盖时序；按 AC-11 追加规范性取代条目。
- `TR-08` 不变，保持 OPEN。
- D-6 取代以下两处旧规定：`check-native-projection.mjs` 中“wallpaper 保留按需求列明的 darkMode 差异”，以及键盘批次 `keyboardThemeConfig.test.ts` 中“两个 App 都须 `darkMode: 'class'`”。

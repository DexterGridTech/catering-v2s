# TER 包布局整理方案（v5）

> STATUS: REVISED_AFTER_CODEX_V4_REVIEW；`REVIEW_TARGET=DESIGN`（方案）；不是详设或实施计划。
> REVIEW_CYCLE_ID: `TER_PACKAGE_LAYOUT_CLEANUP_2026-09-24`；评审记录见 §11。
> REQUIREMENTS: `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md`（下称“需求”）。

## 1. 结论

一个批次、五个阶段：

0. **基线全绿**（需求 PL-R00）：
   - 先只读盘点被忽略产物，再实跑三道门、全部子门与 AC-6 的工具测试，冻结基线失败清单；
   - 逐条按根因修到全绿。已知条目：
     - 包图补边；
     - harness 原样搬到 `src/components/`；
     - 删除盘点到的 Vitest 缓存；
     - transport 身份夹具补上 `moduleName`；
     - `StaffLoginForm` 的 Web `form` 宿主移到 primitives；
     - darkMode 整体删除（D-6）；
     - 其余 readability 条目。按 Codex 复核实跑，TR-R03 1 条、TR-R04 7 条、TR-R05 4 条、TR-R06 2 条，以第 0 步冻结清单为准。
   - 遇到需要产品取舍的条目，停下来报 Dexter。
1. **四个包下线与合并**（PL-R03、PL-R04）。
2. **console-assembly 改名**（PL-R02）。
3. **assembly 层改名**（PL-R01）。
4. **收尾证明**：
   - AC-2 扫描（每条模式先做正控制）；
   - AC-8 快照比对；
   - AC-9 原生证据；
   - AC-10 TR-16 配对；
   - AC-11 正本与记忆同步；
   - AC-13 写明 `TR-08=OPEN`。

第 0 步之后，每一步都安装一次，并保证三道门与全部子门全绿；锁文件只允许出现该步预定的变化。

## 2. 改后的命名模型

| 词 | 含义 | 例子 |
|---|---|---|
| application（层） | 可运行 App 包及其共用原生基座 | `apps/terminal/application/android/sample-terminal`、`application/base/android` |
| assembly（装配） | 把部件拼起来的代码或步骤 | `ui/base/feature-assembly`、`ui/base/integration-assembly`、包内 `src/assembly/`（规范 §7.1）、`createXxxAssembly`、`assembly-rejection`、事件 `sample.assembly-created` |
| `src/application/`（包内目录） | 包的组装与入口（规范 §7.1） | `ui/integration/*/src/application/module.ts` |

application 从此有两种用法：顶层的层名，和包内的 `src/application/` 目录。两者在路径上不会撞；落地时在规范的术语处用一句话讲清楚。

## 3. 改名映射

**assembly 层**

| 旧 | 新 |
|---|---|
| `apps/terminal/assembly/`（同盘整体移动，含被忽略文件） | `apps/terminal/application/` |
| `@catering-v2s/assembly-{android-sample-terminal, android-sample-wallpaper-terminal, base-android}` | `@catering-v2s/application-…` |
| moduleName `assembly.…` 三个 | `application.…` |
| 根 `package.json:18-19` 两条 glob | `apps/terminal/application/{base,android}/*` |
| `LogScope`、`LogScopeBinding` 的 `layer` 成员 `'assembly'` | `'application'` |
| 错误前缀 `[assembly-base-android]` | `[application-base-android]` |
| testID 默认值 `assembly.base.android:loading` | `application.base.android:loading` |
| Kotlin 包 `com.catering.v2s.terminal.assembly.base.android` | `…application.base.android` |
| `verify.mjs` 阶段 `assembly-export*` | `application-export*` |
| skeleton“assembly 包自环”规则 | 删除（死代码） |

**console-assembly**

| 旧 | 新 |
|---|---|
| `ui/base/console-assembly/`；`@catering-v2s/ui-base-console-assembly`；`ui.base.console-assembly` | `ui/base/integration-assembly/`；`@catering-v2s/ui-base-integration-assembly`；`ui.base.integration-assembly` |
| 包内全部 `Console*`/`console*` 标识，文件 `consoleAssembly.tsx`，README 标题“Console 基础装配” | `Integration*`/`integration*`，`integrationAssembly.tsx`，按实际职责重写的标题 |
| `owner`/`writer`/`source`/错误前缀中的旧 moduleName；日志文案 “Shared console assembly …” | 新 moduleName；“Shared integration assembly …” |

## 4. 影响面清单

本清单是详设的起点。改名完整性由 AC-2（含正控制）证明，没有夹带改动由 AC-8 证明。

**第 0 步：基线修复**
- **包图**：`skeleton-graph.ts:281-299` 两个 App 节点。
- **harness**：两个 App 的 `src/controlledKeyboardHarness.tsx` 移到 `src/components/`，`App.tsx` 的 import 同步。
- **缓存**：删除 `assembly/base/android/node_modules`、`adapter/android/device/node_modules`、`adapter/android/dual-screen/node_modules`。
- **transport 测试夹具**：`kernel/base/transport/test/identityClient.test.ts:4-11` 补 `moduleName`，与 `topologyWire.ts:216-225`、`TerminalTopologyServer.kt:140` 一致。
- **StaffLoginForm**：`ui/feature/sample-staff-auth/src/components/StaffLoginForm.tsx:13` 的 `createElement('form')` 移入 `ui/base/primitives`，由它提供 Web 下的 form 宿主、原生下原样透传；feature 改用该 primitive。同时满足 layering P-5d 与 TR-R03。
- **readability**：其余 TR-R03/04/05/06 条目以第 0 步实跑清单为准。
- **darkMode（D-6）**：
  - 删除四个 `tailwind.config.cjs` 第 2 或 3 行的 `darkMode: 'class'`，涉及两个 App 与两个 integration；
  - 删除基座 `config/index.cjs:178-179` 的参数；
  - 删除 `assembly/base/android/test/keyboardThemeConfig.test.ts:47` 与 `ui/integration/sample-console/test/theme.test.ts:68` 两处断言；
  - `tools/terminal-sample2/check-native-projection.mjs:346-351` 改为任何 App 都不得出现 `darkMode`，并同步其红测试。
- **盘点**：第 0 步最先只读盘点被忽略产物，再运行任何会清理现场的 runner。

**工作区与锁文件**：根 `package.json:18-19`；`yarn.lock` 由安装重新生成。

**application 层自身**
- 三个包的 `package.json`、`src/moduleName.ts`、`src/dependencies.ts`、`terminal-invariants.json`、README；
- 两个 App 经 `@catering-v2s/assembly-base-android/config` 引用基座的配置文件：`babel.config.cjs`、`metro.config.js`、`tailwind.config.cjs`、`tsconfig.json`、`global.d.ts`、`nativewind-env.d.ts`；
- `App.tsx` 的 import；
- 基座的 `config/index.cjs` 与 `AndroidTerminalApp.tsx:33`；
- wallpaper App 引用的 `WallpaperConsoleAssembly`、`createSampleWallpaperConsoleAssembly` 属于 integration 自有名，不改。

**Android 原生**：`build.gradle:6,10`；6 个 Kotlin 主源文件与 1 个测试文件；`expo-module.config.json:5-7`；两个 `MainActivity.kt:14`。

**platform-ports**：`src/types/logging.ts:19,26`。生产 index 不变。

**包图**：`apps/terminal/skeleton-graph.ts`
- application 节点：第 281–301 行；
- console-assembly 节点：第 84 行；
- 四个下线包节点：第 49、67、106、144 行；
- primitives 指向 automation 的边：第 115 行；
- feature dev 边：第 187、201、218 行。

**检查器与其测试**（行号仅供定位）
- `tools/terminal-layering/check-static.mjs`：第 117、166、184、185 行。
- `tools/terminal-skeleton/check-static.mjs`：
  - 第 507、683、686、697、722、1158 行；
  - 第 783 行，删除；
  - 第 667–668 行，计数；对应测试在第 23–25 行；
  - 第 460–468、600–613 行，`plannedDependencies`，删除。
- `tools/terminal-skeleton/verify.mjs`。
- `tools/terminal-ui-state/check-static.mjs:411-419`。
- 夹具：skeleton 测试第 727、731、844 行，ui-state 测试第 138 行；转义写法在 skeleton 测试第 319、365 行。
- `tools/terminal-sample2/check-startup-diagnostics.mjs:8,58`、`check-behavior.mjs:181`、`check-native-projection.mjs:264-265`。
- `tools/terminal-readability/check-static.mjs:15,21` 不改。

**运行脚本与工具中的路径**
- `scripts/test/ter-virtual-keyboard-android.mjs` 及其测试；
- `tools/terminal-sample2` 下的 `check-native-projection`、`check-u8-focused`、`run-a9-runtime`、`run-sample1-frozen-journey`、`run-sample2-frozen-journey`、`run-u8-release-cold-start`；
- `tools/terminal-topology/run-dual-device.mjs`；
- `tools/terminal-android-dual-screen/check-behavior.mjs`；
- `tools/terminal-image-compare/test/compare.test.mjs`。

**console-assembly 的使用方**：两个 integration 的 `package.json`、`src/dependencies.ts`、`src/assembly/assembly.tsx`、`src/application/*.ts`、测试、`test-expo/App.tsx`、`terminal-invariants.json`、README。

**正本与记忆**：按需求 AC-11 做逐处分类。已知必改与保留的条目见该条。

## 5. 四个包的处置

**三个空壳：按 09-15 先例移出**（需求 PL-R03、D-4、AC-1）
- 移到仓外持久根（不用 `/tmp`）。命名包含日期、包名和短哈希。
- 每个包写一份记录：逐文件 sha256 清单、文件数、字节数、移出时间、恢复命令。
- 按清单恢复出的字节必须与原字节一致。
- 同步修改：
  - 删包图节点与边，更新计数；
  - ui-state 检查器不再依赖相邻节点；
  - 四处夹具换靶（需求 AC-3）；
  - 删除 `plannedDependencies` 机制，由 AC-2(a) 的零命中做控制。
- 保留 `TR-08` 守卫的 automation 两种写法 token 与红夹具。

**ui/base/test-support：并回 platform-ports**（PL-R04、D-3）
- 三个 feature 各改四处：package.json 的 dev 依赖、包图的 dev 边、`src/dependencies.ts` 的 `devDependencyModuleNames`、测试的 type import。
- 写法与 kernel feature 先例同形。
- platform-ports 的生产 index 字节不变（需求 AC-5）。
- 包本身同样按上面的方式移出并记录；记录里注明 5 个类型的来源。

## 6. 关键取舍

| 备选 | 为什么不选 |
|---|---|
| 只改目录，不改包名和 moduleName | 工具由 moduleName 推导路径和包名，三者拆不开 |
| 保留 Kotlin 包名（D-1） | npm 改名已使原生重构建必然发生；保留只会让旧层名长期留在原生代码里 |
| 保留包内 `Console*` 名（D-2） | `integration-assembly` 包里会出现新旧混名 |
| 直接删除三个空壳（D-4） | 没有恢复手段；09-15 先例已被接受 |
| 删掉 TR-08 的 automation token | 要改写 TR-08 判定口径；以后重建 automation 时没有守卫 |
| harness 放 `src/testing/` | 规范规定 `testing/` 不进生产导入图，而 D-5 要求行为不变、App 仍需导入它 |
| 本批顺手关闭 TR-08（harness 只在 debug 存在，或删除） | 会改变 release 行为；Codex 与 Claude 都认为不应自行扩大 D-5，保持 OPEN 并另立待办 |
| 既有红冻结，另立批次（M-3 的 a） | Dexter 选了 b：本批修到全绿 |
| test-support 并入 feature-assembly | 会多出与“打包格式”无关的职责，并新增一条 production 依赖 |
| test-support 并入 dev-host | 职责不符 |
| 分批做 | 多几轮验证；批内分步、每步全绿同样能定位失败 |
| 只做静态验证 | 自动链接清单、签名与原生加载，只有构建和运行才能证明 |
| 以改名前的设备运行作对照 | 要多跑一轮设备；AC-8 快照比对加逐场景绝对期望值更便宜，也更强 |
| 设备上验键盘、两个 APK 各跑两台设备 | 改名能破坏的只有自动链接、签名和启动；两行配对足够 |

## 7. 风险与控制

1. **第 0 步范围不确定**：完整失败清单要实跑后才知道。凡需要产品取舍的条目，停下来报 Dexter；凡会改变运行行为的缺陷修正，逐条登记并单独验证（需求 PL-R05）。
2. **readability 重构**：拆函数、参数对象化、提前返回，都必须保持行为不变。由既有测试与 AC-8 兜底，改动逐文件列入允许差异。
3. **StaffLoginForm**：Web 的回车提交语义与原生子树必须保持不变。给新 primitive 与登录表单补 focused 测试；Web 行为在 AC-10 的 sample-console 行中观察。
4. **签名身份**：同盘整体移动，keystore 随目录过去；AC-9 比对 keystore 哈希与 APK 证书摘要。
5. **可重建产物带旧路径**：构建前删除，由干净构建重新生成。
6. **自动链接**：模块类全名与 Gradle 工程名都会变；AC-9 核对生成的模块清单。
7. **安装与锁文件**：每步只允许该步预定的 workspace 条目变化（需求 AC-6）。安装由 Codex 执行。
8. **日志值变化**：历史 evidence 保留旧值；检查器与 runner 改用新值（需求 AC-7）。
9. **检查器红测试换靶**：每个夹具只做唯一变异，并断言具体 gate 与报文（需求 AC-3）。
10. **Vitest 缓存复发**：残留来自绕过 runner 直接跑的 Vitest；第 0 步删除，以后测试走 `run-owned-tests.mjs`。
11. **记忆路由**：active 记忆追加规范性取代条目，同步 assertion 与 index，并用查询证明新结论优先返回（需求 AC-11）。
12. **扫描空过**：对活跃文件清单逐文件扫描，覆盖未跟踪文件，并对每条模式做正控制（需求 AC-2）。

## 8. 验证策略

- **静态**：需求 AC-0 至 AC-8、AC-11、AC-12。
- **原生**：需求 AC-9。
- **动态**：需求 AC-10 的两行 TR-16 配对。实施阶段执行前，一律记“未执行”。
- **TR-08**：需求 AC-13，保持 OPEN。

## 9. 交给详设的事项

- **第 0 步**：基线失败清单与逐条修法；StaffLoginForm 所用 primitive 的接口与测试；readability 各条的重构方式。
- **每一步（CP）**：完整文件集、安装命令、预期锁文件差异、门的期望。
- **扫描**：AC-2 的活跃文件清单生成方式、各模式的正控制与命中数，包括 `\bassembly[A-Z]\w*` 标识符的逐处分类；AC-11 的逐处分类表，它与 AC-8 的允许差异表是同一张。
- **红测试**：AC-3 四处夹具的输入、唯一变异、gate 与报文，以及三条新增红测试。
- **下线**：AC-1 仓外根路径、命名、记录格式与恢复命令。
- **快照比对**：AC-8 的快照清单生成方式（全部活跃文件，按 `path`、`category`、`sha256`、`allowedDiffRef`）、锚定 token 表与红变异。
- **原生**：AC-9 每个 App 构建后立即读取共享生成物 `ExpoModulesPackageList.kt` 的方法；APK 内 dex 类核对命令；证书摘要命令与期望值。
- **TR-16**：AC-10 两端读取 `startup.complete` 的命令；SECONDARY 界面树读取方式与 testID 到 partKey 的映射；`primaryReadyPartKey` 与 SECONDARY partKey 的冻结值；JSON 证据记录的实现。
- **TR-08**：AC-13 后续待办的 owner、输入与首个 gate。

## 10. 方案合理性

- **问题对不对**：Dexter 要的是名字说真话、去掉没用的空壳，并在本批把所有门修到全绿（他的扩大授权）。本方案只做这三件事；第 0 步只修门报出的问题，不借机重构门未报的代码。
- **方案优不优**：见 §6。改名与下线部分，“更小”的备选要么在工具上不可行，要么留下旧名。基线部分，按根因逐条修复是唯一能让门真实转绿的做法。
- **代价配不配**：范围扩大使第 0 步的工作量取决于实跑清单，这是 Dexter 明确接受的代价。其余部分由带正控制的扫描、快照比对、原生证据与两行配对兜住，仍符合“分钟级、零基建、防回归”。

**UI 自问**：
- 改名与下线：NOT_APPLICABLE。不新增、不改变任何用户操作、控件、文案或 Journey；失败码 `assembly-rejection` 不变；harness 原样搬位。
- 第 0 步的 StaffLoginForm 调整，只把 Web `form` 宿主从 feature 移到 primitives，用户可见的表单、按钮、回车提交与原生界面都不变。它的 Web 表现由 AC-10 的 sample-console 行观察。

## 11. 评审记录

**Claude 侧第 1 轮**（三位 fresh 独立子 agent）：NO-GO 0/4/3、0/7/3、0/4/3。
去重后十组问题，均经作者重开源码核实并处置：
1. AC-2 的 `ConsoleAssembly` 误伤；
2. 漏列的检查器耦合，TR-08 token 由删除改为保留；
3. 漏列的活跃残留；
4. 基线不绿，新增第 0 步；
5. keystore 等被忽略文件；
6. “与改名前一致”无基线；
7. D-1 代价描述；
8. 下线先例；
9. R-E6、M-1 登记；
10. 原文与口径。

**Claude 侧第 2 轮**（两位 fresh 独立子 agent）：NO-GO 0/5/3、0/3/3。处置：
- TR-08 token 与 AC-2 的矛盾；
- 扫描空过（改用 PCRE 并加正控制）；
- AC-3 落地（死代码删除、断言具体 gate 与报文）；
- AC-8 定位为“没有夹带改动”；
- TR-16 配对；
- 第 0 步口子；
- harness 由 D-5 处理；
- 被忽略文件改为同盘整体移动；
- 原生验证收窄；
- 另两处 Vitest 缓存；
- 表述更正。

DESIGN 两轮上限用满后 SELF_DECIDED 收口。

**Codex DESIGN 评审**：NO-GO 3/7/3，见 `doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-codex.md`。

作者处置见 `doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-intake-claude.md`：
- **驳回**：把规范第 974 行当成顶层层名。它位于 §7.1 的 `src/` 目录词表，指装配含义的 `src/assembly/`，应保留。
- **接受**：其余全部，已写入需求 v4。
  - M-1 → AC-8 契约；
  - M-2 → AC-10 的证据字段、变异与冻结要求；
  - M-3 → Dexter 选扩大范围，PL-R00、AC-0 改为全绿；
  - S-1 → 活跃文件清单与逐处分类；
  - S-2 → AC-9 三类证据；
  - S-3 → AC-11 逐处分类与记忆取代；
  - S-4 → AC-1 可恢复记录；
  - S-5 → AC-13；
  - S-6 → 每步全绿与锁文件边界；
  - S-7 → 换靶要求与 `plannedDependencies` 零命中。

**Dexter 决定**（2026-09-24）：
- D-3、D-4、D-5 由 Claude 决定；
- M-3 选扩大到全部门全绿；
- 全部授权；
- 是否接受修订由 Claude 决定。

**Codex v4 复核**：NO-GO 3/2/2，见 `doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-v4-codex.md`。Codex 同意第 974 行保留。Claude 逐条核实后全部接受，并写入需求 v5：
- **M-1 层名标识符扫描**：AC-2(b) 增加 `\bassembly[A-Z]\w*`。改动前约 50 处，逐处分类，并补红变异与反向控制。
- **M-2 证据入口**：AC-10 的入口改为 `startupDiagnosticsWriter.ts:52-65` 与 `consoleAssembly.tsx:374-385`。
  - 冻结字段路径与 JSON 证据格式；
  - SECONDARY 改为从界面树读 testID，因为 release 包没有带 partKey 的 SECONDARY 日志，也不为取证新增日志。
- **M-3 基线**：
  - `check-native-projection.test.mjs` 的 darkMode 失败并入基线。经 Claude 静态核查，darkMode 在 TER 中没有任何作用。Dexter 2026-09-25 决定整体删除（D-6），作为行为不变的第 0 步修复。
  - 第 0 步先只读盘点被忽略产物，再运行会清理现场的 runner。
- **S-1 快照范围**：AC-8 的快照文件集改为全部活跃文件，逐文件分类，先比集合；允许差异表与 AC-11 合为一张。
- **S-2 原生证据**：AC-9 改为每个 App 构建后立即读取共享生成物，并加 APK 内 dex 类核对，不能误读 `PackageList.java`。

下一步：交 Codex 复核 v5；通过后由 Codex 出详设与实施计划。

**出处**：作者会话是续接会话，经上下文压缩，不是 fresh acceptance。Codex 的门结果由 Codex 实跑，Claude 只做静态核查。

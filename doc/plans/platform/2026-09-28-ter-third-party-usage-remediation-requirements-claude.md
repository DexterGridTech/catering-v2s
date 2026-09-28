# TER 第三方库用法整改正式需求（v3.4 · 定稿）

```text
DOC_TYPE=正式需求（REVIEW_TARGET=DESIGN 的被审对象）
VERSION=v3.4 定稿
  v3.4：Claude 设计评审期间 Dexter 的三项裁定——错误提示点按“知道了”后经 port 重启 JS（非原生），取代选择 4、5 的局部重挂；两台 laptop 拓扑测试虚拟机可以清 App 数据；RNTL 改用 v14。另写明 TP-A11 的设备范围，并补强 TP-A8、TP-B3、TP-B5 各一条判据（§9）
  v3.3：按 Dexter 2026-09-28 补充的验收要求，最终验收拆为两部分：非拓扑情况在单机双屏真机与 mobile 虚拟机上，拓扑情况在两台单机单屏（laptop）虚拟机上；新增 F-32（§9）
  v3.2：Codex 复评 GO 0/0/0 之后，按 Dexter 2026-09-28 原话同步设备验证面（双屏真机 + mobile 虚拟机）与“详设和计划写完先交 Dexter 与 Claude review”；作者连带补 TP-A11、TP-C3 各一条验收，并注明 TP-D1 的 POC 不留作实施成果（§9）
  v3.1：吸收 Codex 需求评审（NO-GO 1/3/1）的处置，以及 Dexter 选择 6（Sentry 延期）
  v1、v2 分别经第 1、2 轮独立盲审，结论均为 NO-GO；
  第 2 轮盲审员给出 ROUND_FINAL_DECISION=SELF_DECIDED，作者据此处置后收口；
  v3 吸收了两轮全部处置、Dexter 的五项选择与一项流程裁决（见 §1.1、§9）；v3.1 增加选择 6
DATE=2026-09-28
AUTHOR=Claude 写需求；Codex 写详设与实施计划，并负责实施
INPUT=doc/review/platform/2026-09-28-ter-third-party-library-usage-health-check-claude.md（下称体检报告）
  体检报告中与本需求冲突的旧口径一律以本需求为准（§7）
BYTE_STATE=现状事实以 2026-09-28 的工作区字节为准。TER 有他人在并行修改，详设开工前与每个阶段开工前都须重核（§2）
AUTHORITY=Dexter 2026-09-28 已授权据此写详设与实施计划（§1.1）；详设与计划经 Dexter 与 Claude review 之后再进入实施
```

## 1. 用户任务、现状与选择

### 1.1 Dexter 原文（逐字）

**体检委托：**

> 我现在要对TER做一个专项的检查和优化，就是TER中涉及到调用第三方库的地方，是否都符合官方的用法，并需要在第三方官网查证。请你帮我做一个TER体检，可以用多个子agent来查证，最后生成一份体检及整改报告

**对体检报告待裁决项的答复：**

> D-1，c
> D-2，a
> D-3，a
> D-4，必须纳入
> D-5，不支持大屏竖屏
> D-6，不要
> D-7，不允许
> D-8，APP会一直在前台，成立

**本文件的委托：**

> 先不给codex，你先生成正式的需求文档，对抗式review几轮

**按键音**（本会话，2026-09-28）：

> 哦哦，跟随系统就好了，我以为不会调用系统声音

**交付方式**（2026-09-28）：

> 不要，不管你几批，我要一次性详设，一次性按顺序做完

**详设授权与设备验证面**（2026-09-28，Codex 需求复评 GO 之后）：

> 授权他根据需求和项目各类要求写详设和实施计划，最后需要在双屏真机与mobile虚拟机中完成动态验证，写完给我和Claude做review

**最终验收的补充**（2026-09-28，紧接上一条）：

> 再补充一点验收要求，刚才说要在真机的单机双屏和虚拟机的mobile上完成动态验收（所有非拓扑情况），这个有调整，还需要在两个单机单屏（laptop）的虚拟机，完成动态验收（拓扑情况）。才算最终验收。

**错误提示的恢复方式**（2026-09-28，Claude 评审详设期间；取代选择 4、5 中“点按后重新挂载该 screen / 该层”）：

> “SystemFailureNotice：只有一个“知道了”按钮”这样可以，点击按钮后，调用port方法，重启JS（非原生）

同时给出的评审口径：

> 特别边缘的场景，可以不考虑，不要过度设计
>
> 抓大放小

**以选项作答**（2026-09-28，Claude 评审详设期间）：

7. 题干「拓扑验收用的两台 laptop 虚拟机，现有 runner 每次冷启动都会清 App 数据（pm clear）……允许在这两台测试虚拟机上清数据吗？」Dexter 以自由文本作答：

   > 两台测试虚拟机，我关注的是WS数据同步是否能正常运行。一台master 一台slave，如果清空数据也能完整走完双机配对与会员旅途，也可以呀
8. 题干「测试渲染器迁移（D-2 选了 a，迁到 RNTL）用哪个大版本？」所选「用 v14，一次迁到位」：

   > 不再依赖已弃用的渲染器，以后不用再迁一次。代价是要重做单包 POC，用到那三种写法的测试要改写成 RNTL 的查询方式。

**以选项作答**（2026-09-28）。题干与所选项的说明均为原文：

1. 题干「整改怎么分批？」所选「检测器先行 + 高价值小批」：

   > 先做一小批：接上 lint（react-hooks 规则）、原生单测接入例行入口、DEV 用例真正执行；同时修 M-1 主题、M-2 拓扑读超时、解压上限、锁序、React 单实例声明、加密 key（赶在终端激活批次二存凭证之前）。之后按验证面分 UI 批和原生批；测试渲染器迁移与全量格式化单独一批；N 级随所触文件顺带，其余登记。

   后来 Dexter 裁定“一次性详设，一次性按顺序做完”，所以这里的“批”只作为实施顺序（阶段 A → B → C → D），不再是单独的交付单元。
2. 题干「D-7「不允许」的具体范围是？」所选「只禁长按菜单」：

   > 只去掉长按弹出的系统选择/粘贴菜单，其他粘贴途径不管。
3. 题干「开层与关层时，输入框的焦点怎么处理？」所选「关层不回焦，开层拦住硬件输入」：

   > 关层后不自动回到原输入框（两端现状）；开层期间，硬件键盘或扫码输入不得落进被弹层遮住的输入框。
4. 题干「T-3 已定 screen 级边界、重挂 screen。页面崩溃后具体怎么恢复？」所选「显示提示，点按后重挂」：

   > 出错的 screen 区域显示现有的 SystemFailureNotice（系统提示 / 操作没有完成，请重试），用户点按后重新挂载该 screen；同屏其他区域和另一块屏不受影响。
5. 题干「弹层（例如登录层、管理层）渲染崩溃时怎么恢复？」所选「层内提示，点按重挂该层」：

   > 与 screen 同样处理：层区域显示同一个 SystemFailureNotice，点按后重新挂载该层。不会绕过登录这类守卫；连续崩溃时靠管理入口脱困。

   选择 4、5 的恢复动作（重新挂载）已由 Dexter 改为点按“知道了”后重启 JS（见本节“错误提示的恢复方式”）；提示的位置与呈现不变。
6. 题干「T-3 定的是“Sentry + react-error-boundary”。这次整改要不要把 Sentry 故障上报也做了？」所选「延期，登记到 HANDOFF」：

   > 本次只落实 T-3 的错误边界部分，边界捕获的错误照常写结构化日志。Sentry（含离线队列、上传窗口、脱敏、上报服务与 DSN）属于生产化可观测项，延期并登记到 HANDOFF.md；T-3 的 Sentry 部分保持待办。需求里“遵循 T-3”改为“落实 T-3 的边界部分”。

### 1.2 真实目标

1. TER 中凡是正确性依赖第三方行为的地方，都要符合**实际解析版本**的官方契约，不依赖未承诺的行为、内部字段或隐式默认值。
2. **Web 预览与设备表现一致**（TR-16）。样式、焦点、测量、启动这类在 Web 上看不出来的差异，要在需求层面锁住。
3. **先接检测器，再改代码**。lint、原生单测、DEV 用例要在修复之前接上，让同类问题以后自动暴露（AGENTS.md「已识别问题必须抽象并防再犯」）。
4. 一切整改都在 Dexter 的裁决边界之内，并与已生效的技术栈裁定一致，尤其是 T-3 的错误边界部分与 T-4（T-3 的 Sentry 部分按选择 6 延期）（`project-memory/decisions/terminal-architecture-and-stack-rulings.md`）。

### 1.3 现状事实

证据来源：体检报告 §3、§7，两轮盲审的回源重核，以及 Codex 评审后作者的回源自查（F-29 至 F-32）。状态栏中“已复核”，指回读过源码，或逐字核对过官方 tag 源码。

| 编号 | 事实 | 位置 | 状态 |
|---|---|---|---|
| F-1 | App 主题有 54 个颜色键，两个 integration 各有 57 个。App 缺 `surface-elevated`、`surface-inset`、`focus` 三个键，而 primitives 的 tokens 正在用它们。颜色**值**只有一个住址：App 也用所装配 integration 的 `global.css` 里的 CSS 变量。漂移出在三张“键 → 变量”映射表上 | `application/base/android/config/index.cjs:121-183`；`application/android/*/metro.config.js:9`；`ui/integration/*/theme/global.css`；`ui/base/primitives/src/theme/tokens.ts` | 已复核 |
| F-2 | 拓扑服务端调用无参 `start()`。NanoHTTPD 2.3.1 的默认读超时是 5000ms，作用在每个接入的 socket 上。心跳配置为间隔 10000ms、超时 30000ms。Registry 使用 `android.util.Log` | `TerminalTopologyHostRegistry.kt:3,78`；`topology-transport.config.json:4-5` | 已复核（官方 tag 源码） |
| F-3 | NanoWSD 按对端声明的帧长直接 `new byte[...]` 分配内存 | 库源码；`TerminalTopologyServer.kt:199-200` | 已复核（官方 tag 源码） |
| F-4 | TER 中没有任何 Error Boundary，也没有声明 `react-error-boundary` | 全 TER 检索 | 已复核 |
| F-5 | InputProvider 在渲染期写 ref（第 57 行），并在渲染期读 ref 来构造下发的状态（第 212–243 行） | `ui/base/input/src/components/InputProvider.tsx` | 已复核 |
| F-6 | 关层后用 `{focus: focused.focus}` 恢复焦点，在 RN 0.86.3 下是空操作；RNW 没有 `currentlyFocusedInput` | `ui/base/render/src/components/LayerStack.tsx:155-168` | 已复核 |
| F-7 | 在 Android 上，对非 TextInput 的 View 调用 `focus()` 一律是空操作（`enableImperativeFocus` 默认 false）；tabIndex 与 focusable 冲突属实；`accessibilityViewIsModal` 在两端都无效 | `LayerStack.tsx:164,237-239`；RN `View.js:81-83`；`ReactNativeElement.js:155-161` | 已复核 |
| F-8 | beginHide/releaseHide 是同步 `Function`，内部 `task.get` 最长等 2000ms | `TerminalNativeLoadingModule.kt:10-26`；`TerminalNativeLoadingRegistry.kt:28-29,316` | 已复核 |
| F-9 | MainActivity 使用了 expo-splash-screen 未写进文档的原生成员 `preventAutoHideCalled` 与 `hide()` | 两个 App 的 `MainActivity.kt:24,31` | 已复核 |
| F-10 | 仓根 react 是 19.2.5，TER 是 19.2.3；两个 app.json 都没有 `experiments` 字段，所以单实例依赖 @expo/cli 在 workspace 下的隐式默认值 | `app.json`；@expo/cli `instantiateMetro.js:209` | 已复核 |
| F-11 | 拓扑状态解压调用 `unzlibSync(encoded)`，没有给输出上限 | `createTopologyStateTransfer.ts:258,300-301` | 已复核 |
| F-12 | 两把锁的加锁顺序相反 | `TerminalTopologyServer.kt:87,160-169`；`TerminalTopologyHostRegistry.kt:112-118,186-188` | 已复核 |
| F-13 | MMKV 加密 key 的有效部分在所有设备上都是 `catering-v2s.per` | `TerminalPersistKvModule.kt:175,210-212,302`；MMKV v2.4.2 `AESCrypt.cpp` | 已复核（官方 tag 源码） |
| F-14 | 选副屏时没有按 presentation 类别过滤 | `TerminalDualScreenActivityHandler.kt:119-121,632,710-714`；`TerminalDeviceModule.kt:74-77,360` | 已复核 |
| F-15 | react-test-renderer 19.2.3 已弃用；TER 有 29 个测试文件依赖它，另有 10 份手写 `.d.ts` | 包内 README | 已复核 |
| F-16 | 27 个 vitest 配置都写死 `__DEV__: 'false'`。DEV 断言有两种写法：`skipIf(!__DEV__)` 与 `if (!__DEV__) {…; return}` | `kernel/base/platform-ports`、`kernel/base/runtime`、`ui/base/render` 三个包的 `startupDiagnostics.dev.test.*` | 已复核 |
| F-17 | 门测试读 TS 内部字段 `parseDiagnostics`；门工具设了已弃用的 `baseUrl`，而且不读诊断 | `ui/integration/*/test/publicSurface.test.ts:10,46-47`；`tools/terminal-shared/typescript-analysis.mjs:137` | 已复核 |
| F-18 | 拓扑服务端 Kotlin 单测缺 `moduleName` 参数，编译不过。今天没有任何例行入口在跑 TER 的 Kotlin 单测。`check-behavior.mjs` 是一个在原地改写生产源码的手工脚本，没有任何地方引用它 | `TerminalTopologyServerTest.kt:44-53`；`check-behavior.mjs:9-21,48,63-67` | 已复核 |
| F-19 | `eslint.config.mjs:11-29` 是**共享块**，`files` 同时覆盖 `apps/frontend/*/src/**`、`libraries/frontend/admin-ui-foundation/src/**` 与 `apps/terminal/**/src/**`。两个 frontend 的 build 串联了 `lint:architecture --max-warnings=0`（`tools/verify-gates/cli.mjs:574-592`）。29 个 TER 包的 invariants 都是 lint ABSENT，`verify.mjs:126-128` 在这种声明下禁止出现 lint 脚本。`apps/terminal/package.json:13` 的 turbo lint 实际执行 0 个任务。eslint-plugin-react-hooks 7.0.1 提供 `refs` 与 `purity` | 同左 | 已复核 |
| F-20 | 技术栈裁定 T-3：Sentry 加 `react-error-boundary`，boundary 做到 **screen 级**，“重新挂载 screen 而不是重启 App”。T-4：react-hooks 规则「从第一天就设 error」。T-3 的 Sentry 部分按选择 6 延期；恢复动作按 §1.1 改为重启 JS（非原生） | `00-ter-build-order-claude.md:819-820,909-935`；`terminal-architecture-and-stack-rulings.md:56` | 已复核 |
| F-21 | 终端规范 §7.1 规定 `vendor/` 只放外部代码的原样拷贝；但 `ui/base/primitives/src/vendor/` 的 6 个文件是按 TER 需要改过的 copy-in 实现 | `terminal-coding-standard.md:976`；`ui/base/primitives/README.md:6,28,87,164` | 已复核 |
| F-22 | 生产代码中没有任何 slice 声明受保护持久化。但按代码路径，**凡是跑过这段 hydration 的设备，都会建起受保护命名空间**：hydration 把全部持久化条目以“旧存储种类”并入受保护组，并调用 listKeys；原生侧打开受保护存储时，如果命名空间不存在，就用现行弱 key 写入 marker。一旦 key 推导改变，这些设备就会报 `PERSIST_KV_PROTECTED_KEY_MISMATCH`。各设备的实际状态由 TP-A11 验证。另外，终端激活批次二会把凭证持久化到 TER 状态 | `persistencePrimitives.ts:150-190`；`persistenceHydration.ts:76-82`；`androidPlatform.ts:40`；`TerminalPersistKvModule.kt:164-195`；激活 journey 第 48、54 行 | 已复核（虚拟机上命名空间实际存在为推论） |
| F-23 | mobile 形态（sw&lt;581dp）锁竖屏，laptop 形态锁横屏 | `TerminalDualScreenActivityHandler.kt:35-73` | 已复核 |
| F-24 | 输入 owner 已有开层接缝：suspend 清空 owner 的活动字段，但不 blur 原生输入框；restore 只解除挂起 | `LayerStack.tsx:151-173`；`useInputFocusController.ts:270-282` | 已复核 |
| F-25 | render 包有现成的 `SystemFailureNotice`，两端共用，默认文案为「系统提示 / 操作没有完成，请重试」。“请重启终端”这句文案的 owner 是 render 包的 `ScreenReadyBoundary.tsx:10-14`，启动失败页与运行异常页都在用；Android App 通过 `App.tsx:27` 的 `StandaloneStartupFailurePage` 接入 `renderFailurePage` | `SystemFailureNotice.tsx:29-37`；`ScreenReadyBoundary.tsx:10-14` | 已复核 |
| F-26 | 就绪信号只在已解析的 PRIMARY 真实 part 首次布局时发出，fallback 不计；内容失败另有 `contentFailure` 上报路径。LayerStack 与 ScreenContainer 是兄弟节点。AdminLauncher 包在整个 surface 内容之外 | `ScreenReadyBoundary.tsx:205-297`；`ScreenContainer.tsx:103-121`；`SurfaceRoot.tsx:13-24`；`integrationAssembly.tsx:772` | 已复核 |
| F-27 | ESLint 9.39.5 自带批量豁免（`--suppress-all`、`--suppress-rule`、`--prune-suppressions`、`--pass-on-unpruned-suppressions`），按“文件 × 规则 × 条数”比对；存在未使用的豁免时，退出码为 2 | `node_modules/eslint/lib/options.js`、`lib/services/suppressions-service.js`、`lib/cli.js` | 已复核 |
| F-28 | TER 中唯一的 RN `TextInput` 在 primitives 的共享 slot 里，固定 `showSoftInputOnFocus: false` | `ui/base/primitives/src/vendor/slots.tsx` | 已复核 |
| F-29 | `HANDOFF.md` 有两张同表头的表：TER 登记表（引言只写双机拓扑，门不校验）与“十项生产化欠账”正本表。`scripts/check/handoff-debt` 只校验含已批准 id 的那张表，行数写死为 10，并与门内 `APPROVED` 逐行比对 | `HANDOFF.md:7-28`；`scripts/check/handoff-debt` 的 `APPROVED`、`parseTable`、`validateRows` | 已复核 |
| F-30 | 三个 TER 原生测试源集共 4 个测试文件、26 处 `@Test`，依赖 `junit:junit:4.13.2`；没有 `@Ignore`、assumption、`@RunWith` 或参数化 | 三个模块的 `android/src/test`；各自 `build.gradle` 的 `testImplementation` | 已复核 |
| F-31 | 现有受管 TER 设备运行入口按 serial 指定设备：`scripts/test/ter-virtual-keyboard-android.mjs` 要求 `--dual-serial` 与 `--mobile-serial`，`scripts/test/ter-admin-display-android.mjs` 接收一个 serial；两者源码中未检索到模拟器专用命令（emu、qemu、avd）。它们在真机上能否跑通，尚无证据 | 同左 | 已复核（静态；真机可用性待详设核实） |
| F-32 | 现有双机拓扑受管入口 `tools/terminal-topology/run-dual-device.mjs`：第一阶段要求主、从两台设备各只有一个逻辑显示、没有虚拟显示，默认 serial 为 `emulator-5554`、`emulator-5556`，对应两台单机单屏虚拟机；默认输出目录写死为 2026-09-17 批次的路径，可用 `--output` 覆盖。它第二阶段的 dual 形态要求 SurfaceFlinger 中有 `Virtual Display`，是按模拟器写的 | 同左，`parseArgs`、`captureDeviceShape`、`captureStage2Shape` | 已复核（静态；真机的物理副屏能否通过第二阶段检查未实测，推论为通不过） |

## 2. 名词、范围与执行规则

- **TER**：`apps/terminal`。
- **两端**：`ui/integration/*` 的 Expo Web 预览，以及 `application/android/*` 在设备或虚拟机上的运行。
- **交付方式**（Dexter 裁定）：
  - 整个整改是**一个原子交付单元**：一份详设、一份实施计划，一次性覆盖全部要求。
  - 实施按阶段 A → B → C → D 顺序一次做完。阶段之间不停下来等 Claude 复核；Claude 在全部完成后做一次全范围评审。
  - 需要事先定的点（TP-D1 的 POC 等）在这份唯一的详设阶段完成，并在实施之前处理。
  - 详设与实施计划写完，先交 Dexter 与 Claude review，之后再进入实施（§1.1）。
- **设备验证面**（Dexter 原话见 §1.1）：
  - 最终验收分两部分，两部分都完成才算最终验收：
    - **非拓扑情况**（全部非拓扑场景）：在**单机双屏真机**与 **mobile 虚拟机**上完成动态验收；
    - **拓扑情况**：在**两台单机单屏（laptop）虚拟机**上完成动态验收。
  - 拓扑情况的场景清单由详设给出全集，至少包括：TP-A7、TP-A8、TP-A9 各自写明的两机验收；现有双机拓扑受管入口已有的配对与同步场景的回归（F-32）。
  - 拓扑行为先用 JVM 级真 socket 测试证明，两台 laptop 虚拟机上的运行是最终验收，不替代 JVM 判据。
  - 两台 laptop 拓扑测试虚拟机上，两个 sample 包在拓扑运行前可以清 App 数据（选择 7），以便完整走完双机配对与会员旅途；单机双屏真机与 mobile 虚拟机上仍不得清数据。
  - 开发过程中可以借助其他设备调试（例如现有的单机双屏虚拟机），但不能替代上述最终验收。
  - 设备运行优先走仓内现有的受管 TER 运行入口。这些入口按 serial 指定设备（F-31、F-32），它们在真机上能否跑通，由详设核实并写明；没有受管入口覆盖的，详设写明手工步骤与证据档位，这类证据只算辅助。
- **例行入口**：
  - 指 `scripts/verify`（静态段或运行段），或 terminal 的 `verify:static`。
  - 新接入的检查按实测耗时放置：静态段总耗时不得因此超出分钟级，超出的放到运行段。
  - 放到其他位置须交 Dexter。
- **重核**：
  - 详设开工前，对全部发现在当前字节上重核一次。
  - 每个阶段开工前，再对该阶段涉及的发现快速重核。
  - 已被修好的标 `ALREADY_RESOLVED` 并附证据；事实变化的，按升级规则处理。
- **范围内**：
  - `apps/terminal/**`、`tools/terminal-*/**`；
  - 为把 TER 纳入 lint 与 format 所必需的根配置与脚本改动，但不得改变 frontend 与 foundation 的 lint 行为；
  - 与 TER 相关的门；
  - 治理登记：TP-A1 的 decision 文件、`HANDOFF.md` TER 登记表中的一行，以及项目记忆中的两处指针（T-3 的延期状态；§7 所列的失效文件引用）。
- **范围外**：后端与两个管理后台；L2、DEV、seed、reset、UAT；§6 列出的非目标。
- **N 级处理规则**：
  - 详设列出全部所触文件。落在所触文件里的 N 项，逐项处置：要么做，要么说明理由。
  - 其余 N 项在全部完成时，逐项登记到对应包 README 的迭代一节，并注明体检报告编号。
  - 有指定归属的，见附表。
- **升级规则**：
  - 单项卡在需要 Dexter 裁决或缺外部证据时，只冻结这一项，不停整体。
  - 带 OPEN 项收口时，必须逐条列出，并经 Dexter 接受。
  - 基线判定按“测试标识 + 首个失败特征”比较，不只比失败集合。
  - 他人并行写入造成的新失败，举证归因于范围外字节后，允许重取基线，并留下记录。
  - 需求事实有误时，由 Claude 修订并记录；涉及语义的修订，须经 Dexter 重新接受。
- **格式化的进入条件**：确认 TER 没有其他在途写入。

## 3. 必须满足的要求

- 每条都写明：来源（体检报告编号）、要求、验收、验证面。
- 验收必须能被假实现证伪。凡是修复缺陷的判据，都要求修复前的字节判红。
- **UI_BEARING**：带此标记的要求会改变用户可见行为，详设须适用 `implementation-design-template` 的 §3a 控件分母表。本需求不涉及 L2，所以 L2 控制面全集为 NOT_APPLICABLE，界面验证按 TR-16。

### 3.0 重核与基线

- **要求**：按 §2 重核；详设开工前取新鲜基线，包括 TER typecheck、terminal `verify:static`，以及涉及的既有测试。
- **验收**：
  - 详设包含一张重核表，列为「发现 → 当前位置 → 结论 → 防再犯去处」。“防再犯去处”只能是：门、lint、可运行的测试、包 README 的迭代一节。
  - 基线输出附在详设里。

### 阶段 A · 检测器与高价值修复

**TP-A1 · 裁决落档**（M-3、S-13、D-1..D-8、选择 6）

- **要求**：新增一份 decision，写入以下内容：
  - §1.1 的全部原话，以及选择 1–8 的题干与所选项说明（含 Dexter 对错误提示恢复方式的改定）；
  - T-3 的 Sentry 部分按选择 6 延期，T-3 的状态记为“边界部分由本整改落实、Sentry 部分待办”；T-3 的“重新挂载 screen”改为点按“知道了”后重启 JS（非原生），见 §1.1；
  - 每项裁决的问题原文、选项原文与影响范围；
  - 拓扑端口只用于可信门店局域网，以及 M-3 按 D-1 接受风险；
  - D-5 的影响范围：sw≥600dp 的设备竖放不在支持范围内，mobile 竖屏形态不受影响，S-13 关闭且不改代码；
  - D-8：不做前台服务；
  - 本需求与 T-3、T-4 的对齐关系。
- 同时在 `HANDOFF.md` 登记 Sentry 延期（F-29）：
  - 登记在已有的 TER 登记表里（`TER_NANOHTTPD_REPLACEMENT` 所在的那张表）。按该表的七列写明：现状边界；推迟理由；风险（包括门店离线时故障不可见）；激活触发条件（与该表现有行同一写法）；将来的验收证据（包括离线队列与上传窗口）；decisionSource（指向本 decision）。该表的引言目前只写双机拓扑，需同步改为能涵盖这一条。
  - 不加入“十项生产化欠账”正本表，也不改 `scripts/check/handoff-debt`。该门把正本表写死为 10 行，并与门内的已批准清单逐行比对，新增一行会直接判红。
- 在项目记忆 `project-memory/decisions/terminal-architecture-and-stack-rulings.md` 的 `TER_STACK_RULINGS_T1_T13` 条目中，给 Sentry 注明“按选择 6 延期”，并指向本 decision。只改正文，不改 frontmatter。这样后来者不会按原裁定去补 Sentry，也不会把它的缺失当成缺陷。
- **验收**：
  - HANDOFF 的 TER 登记表中有这一条；`scripts/check/handoff-debt` 新鲜运行仍然通过，证明十项正本表没有被改动。
  - 项目记忆中的 T-3 指向本 decision；`scripts/check/project-memory` 新鲜运行通过。
  - 不另建第二份 decision 记录这些裁决；今后新写的文档引用这一份。
  - 本需求与体检报告中已有的裁决原文照旧保留。
  - decision 里的引文逐字，可与 §1.1 对照。

**TP-A3 · lint 接线与棘轮**（D-4、T-4、N-30）

- **要求**：
  1. 新增规则（`react-hooks/refs`、`react-hooks/purity`）只作用于 `apps/terminal/**`，不改变 frontend 与 foundation 的规则集。共享块中已有的 TER 规则保留。
  2. 各 TER 包 invariants 中的 lint 由 ABSENT 改为实际拥有；`verify.mjs:126-128` 这条门规则本身不削弱。
  3. lint 在例行入口中执行。实际执行 lint 的包集合，必须等于全部 TER 包。
  4. 存量违例用 ESLint 9.39.5 自带的批量豁免（F-27）做**计数级**棘轮，只降不升。它只按“文件 × 规则”比较条数，不记位置，所以同一文件、同一规则下修掉一条旧违例再新增一条，过渡期内可能不被发现。这个风险由第 5 点的阶段清零兜住：清零后，对应规则的豁免条目必须删除。阶段 D 结束时批量豁免文件为空（TP-D4），交付后的状态不含任何计数级豁免，所以这个风险只存在于实施过程中，不构成需要 Dexter 另行接受的范围取舍。某条规则在某个包清不了零时，按 §2 的升级规则作为 OPEN 项交 Dexter。
     - 不得把规则降为 warn；
     - 不得在文件头用 eslint-disable 整文件豁免（ESLint 自带的按“文件 × 规则 × 条数”计的批量豁免不属于这一类）；
     - 行内豁免必须写明理由，并计入报告。
  5. 基线按“规则 × 包”计数，清零时间按验证面分派：
     - 会改变运行行为的规则（`rules-of-hooks`、`exhaustive-deps`、`refs`、`purity`、`no-floating-promises`）：`ui/*` 与 `kernel/*` 在阶段 B 清零，`adapter/*` 与 `application/*` 在阶段 C 清零；
     - 行为中性的规则（如 `no-unused-vars`）在阶段 D 清零；
     - 某规则在某包清零后，批量豁免文件中该包该规则的条目必须同时删除；
     - 为清零所做的逻辑改动，各自附 focused proof；涉及键盘的，按 TR-16、TR-17 两端复核。
  6. 阶段 A 不做全量格式化。
- **验收**：
  - 新鲜输出显示 lint 在例行入口中执行，执行的包集合等于全部 TER 包（可复用 TER verify 现有的 `expectedTaskOwners` 与 turbo dry-run）。
  - 对任一 frontend 文件与 foundation 文件运行 `eslint --print-config`，接入前后一致。
  - 红夹具落在**没有豁免记录**的文件与规则上，保证判定稳定：加入一处 rules-of-hooks 违例，门变红；加入一处渲染期读 ref，门也变红。
  - `scripts/verify` 保持分钟级，实测耗时附上。

**TP-A4 · 原生单测接入例行入口**（S-18）

- **要求**：
  1. 所有带 `src/test` 的 TER 原生模块（目前 3 个），其 Kotlin 单测都能编译，并在例行入口中实际执行。先修好 `HostConfig` 缺参。
  2. 红夹具只在拷贝上改测试源集，不得原地改写生产源码。
  3. `check-behavior.mjs` 退役，或改为在拷贝上执行。
  4. JVM 测试需要的测试侧配置与依赖（例如 Android API 的默认返回、org.json）在授权范围内（§6）。
- **验收**：
  - 逐个测试类比对：源码中声明的 `@Test` 方法数（发现数）= JUnit XML 报告中的执行数 + 跳过数。每个含 `@Test` 的测试类都必须有对应的报告。跳过数、失败数、出错数都为 0。
  - 2026-09-28 的字节上没有任何跳过标记（F-30），所以不设跳过允许清单。详设重核时如有变化，按 §2 处理。
  - 在拷贝上做两个红夹具，例行入口都要变红：一个让测试构造缺必填参数（编译失败），一个让某条断言失败（证明测试真的执行了）。
  - 实测耗时，并按 §2 放置。

**TP-A5 · DEV 分支在唯一测试入口下执行**（S-15、D-3）

- **要求**：
  - 全部 `*.dev.test.*` 中的每个 `__DEV__` 分支（DEV 与 PROD 各算一个）都在唯一测试入口下实际执行。
  - PROD 分支原有的断言保留，并继续执行。
- **验收**：
  - 分母由详设按文件枚举，至少覆盖 F-16 列出的三个文件。
  - 每个分支各有红夹具。
  - skipped 数不增加。

**TP-A6 · 颜色键只有一个正本**（M-1）· UI_BEARING

- **要求**：
  - 语义色的**键**注册表只有一个正本，App 与两个 integration 的 Tailwind 配置都从它派生。
  - 色**值**仍由各 integration 的 `global.css` 负责。
- **验收**：
  1. 在正本中新增、删除或改名一个键，App 与两个 integration 的生效键集合同时变化，无需改第二处。
  2. 两端 Tailwind content 中出现的每个静态颜色类都有键。红夹具：删一个在用的键，门变红；在 content 中加一个未定义的颜色类，门变红。动态拼接的类名超出本条的静态识别范围，详设须说明如何避免这类写法，或逐一列出。
  3. 经真实设备构建入口（含 cwd 前提）生成的产物，包含所用的颜色类；这些类引用的 CSS 变量，在所装配的 `global.css` 中有定义。
  4. 做一次两端对照，截图只作辅助。

**TP-A7 · 只有心跳流量时，拓扑连接不被断开**（M-2）

- **要求**：服务端读超时不得早于心跳超时；半开连接与连接线程要在有界时间内回收。
- **验收**：JVM 级真 socket 测试。服务端必须经由与 registry **相同的生产启动调用**启动，测试不得自选读超时。
  1. **修复前必红**：用生产配置证明，在当前字节上，只有心跳流量的连接会在约 5–10 秒内被断开。
  2. 修复后，在生产配置下，只有心跳流量时，连接保持不少于 3 倍 `heartbeatTimeoutMs`。
  3. 对端以略小于 `heartbeatTimeoutMs` 的间隔发帧，连接保持。这一条专门抓“读超时早于心跳超时”的错误实现。
  4. 对端半开（没有 FIN，也不发任何字节）时，连接在 `heartbeatTimeoutMs` 加一个心跳间隔之内关闭。可观测物是：对端看到 TCP 关闭，并有 close 事件与原因码发布。
  5. 反复连接、断开 20 次，其中至少 5 次是半开。最后一次之后，在 `heartbeatTimeoutMs` 加一个 `heartbeatIntervalMs` 的观察窗口内（参数缩小时按缩小后的值），与连接处理相关的线程数回到开始前的基线。线程怎样识别（例如线程名前缀或线程组），由详设写明。
  - 例行运行时，判据 4、5 可以按比例缩小心跳参数，并写明读超时与配置的关系；判据 1、2 用生产配置，至少跑一次作为证据。
  - JVM 路线不可行时，改走设备日志路线，由详设写明对端如何构造。
  - 两机验收（§2 拓扑情况）：两台 laptop 虚拟机配对后，只有心跳流量时连接保持不少于 3 倍 `heartbeatTimeoutMs`（生产配置），期间不断开、不重连。

**TP-A8 · 解压输出有上限**（S-9）

- **要求**：解压输出以对端声明的 `rawBytes` 为上限。数据流超出 rawBytes 还在继续时，必须失败；即使对端声明的校验和与前缀一致，也要失败。
- **验收**：
  - 单测覆盖三种情况：朴素压缩炸弹、校验和与前缀一致但数据流继续超出、正常数据。
  - “内存不超上限”以静态审查为准：本仓缓冲区按 rawBytes 分配且不会扩容，并且**包括库内部的分配**——按所选调用形态写出峰值上界（例如每次送入解压器的输入上限），用例要能让“一次把全部输入送进去”的实现判红。这一条能区分修复前后。
  - 两机验收（§2 拓扑情况）：正常的拓扑状态传输照常完成。

**TP-A9 · 拓扑服务端不会死锁**（S-10、N-24）

- **要求**：
  - 任何路径都不在持有 peerLock 时去拿 registry lock；发送、关闭、发布都在锁外进行。
  - close 事件的原因码，优先采用本端的意图。
- **验收**：
  - 用一个经由生产 registry 路径的并发测试，通过**只在测试中生效的同步点**，确定性地建立反向持锁的前置状态：一条线程持有 peerLock、等待 registry lock，另一条持有 registry lock、等待 peerLock。然后同时放行两条生产路径。
  - 修复前的字节上，连续 10 次运行都在有界等待后判红；修复后，两条路径都在有界时间内完成，并断言预期的 close 原因码。
  - 同步点不得改变生产行为；它如果属于调试面，遵守 TR-08。
  - 给出“本端调用 → 原因码”的对照用例表。
  - 两机验收（§2 拓扑情况）：断开与关闭路径在两端都于有界时间内完成，不挂住；close 原因码与对照用例表一致。

**TP-A10 · React 单实例显式声明**（S-8）

- **要求**：
  - 两个 app.json 显式写出依赖的实验开关。
  - vitest 的 RN 桩入口不得使用 hooks。
- **验收**：
  - 配置中存在这个开关；它在改前不存在，所以能区分修复前后。
  - 对桩入口做静态检查。
  - Metro 模块清单只有一份 react，作为一次性辅助证据。

**TP-A11 · 加密 key 真正包含设备身份，且不打断现有设备**（S-11、N-25）

- **要求**：
  1. 在调用点实际使用的重载（截断到 16 或 32 字节）之下，设备身份的**每一个字节**都影响有效 key。
  2. key 推导变更**不得**让现有设备进入 `PERSIST_KV_PROTECTED_KEY_MISMATCH`（F-22）。例如可以给受保护命名空间升一个版本号，新命名空间首次创建时不会 mismatch；具体方式由详设比较后选定。
  3. 身份变化时，仍按 mismatch 失败，不自动 rekey。
  4. initialize 在进程内只做一次。
  5. 必须在终端激活批次二持久化凭证之前完成。本项若处于 OPEN，与激活批次二之间的先后由 Dexter 排定。
- **验收**：
  - 对 key 推导做纯函数单测，证明身份的每个字节都影响按实际重载截断后的有效 key；并静态核对调用点所用的重载与单测一致。
  - 在单机双屏真机与 mobile 虚拟机上各做一次：设备上须先有旧命名空间（没有的，先用改前的构建建立）；再装改后的构建启动，受保护存储的 listKeys 成功，日志中没有 `KEY_MISMATCH`。
  - 旧命名空间只含 marker，保留并登记；删除它属于设备数据清除，不在授权之内。

### 阶段 B · UI 正确性与两端一致

**TP-B0 · `vendor/` 的归属判定**（F-21、N-20）

- **要求**：
  - 对 `ui/base/primitives/src/vendor/` 下每个文件，判定它是不是外部代码的原样拷贝。
  - TER 自写或改写过的，迁出 `vendor/`；§7.1 本身不改。
  - 真正的原样拷贝不直接改写。
  - README 中“vendor 是唯一接触 RN value API 的 slot”这条包内不变式，随迁移同步到新位置。
  - css-interop 的深导入（N-20）一并处置。
  - 本项必须在 TP-B5 之前完成。
- **验收**：
  - 留在 `vendor/` 的文件，与包 README 中记录的上游来源与版本逐字节一致。
  - 迁出后，primitives 的现有测试与两端场景没有回归。

**TP-B1 · 错误边界：screen 与层**（S-1、T-3、选择 4、选择 5、选择 6）· UI_BEARING

- **要求**：
  1. 按 T-3 的边界部分使用 `react-error-boundary`，边界做到 **screen 级**，层（LayerStack 中的每一层）也各有自己的边界。故障上报（Sentry）按选择 6 延期，本条只要求结构化日志。
  2. 某个 screen 或某一层渲染出错时：
     - 该区域显示现有的 `SystemFailureNotice`（默认标题与文案）；
     - 用户点按提示上现有的“知道了”按钮后，经 port（`appControl.resetRuntime`）重启 JS，不重启原生；按 TR-11 由 command 与 actor 调用 port，不在组件里直接调用；
     - 不绕过登录这类守卫；
     - 点按之前，同一 surface 的其他区域和另一块屏不受影响；点按之后，两块屏随 JS 重启一起重载。
  3. **启动期首屏出错**时：两端都释放启动或加载状态，显示同样的提示，点按后经 JS 重启恢复；就绪上报带上 `contentFailure` 原因，不得冒充“真实 part 已就绪”（F-26）。
  4. 错误持续抛出时，提示显示期间管理入口仍然可用。
  5. 日志只记 errorName，以及 screen 或层的标识。
  6. 被新边界捕获的渲染错误，不得表述为“启动失败”，也不得要求重启终端。`ScreenReadyBoundary` 现有的启动失败页与运行异常页不在本条范围内，改动它们属于范围扩大，须交 Dexter。
  7. screen 与层之外抛出的异常，同样显示该提示，点按后重启 JS；不得留下空白屏。
- **验收**：场景清单先在 Web 上跑，再上设备（TR-16），包括：
  - 运行期 screen 出错；
  - 运行期某一层出错；
  - 启动期首屏出错。启动画面的释放只能在设备上证明，其余部分两端都证明。
  - 错误持续抛出时，管理入口仍可用。
  - 设备上的注入方式由详设写明，并遵守 TR-08（调试面编译期剔除）。
  - 红夹具：去掉边界，测试变红。

**TP-B2 · 渲染保持纯净**（S-2、N-1、N-2，以及同文件中的 N-4、N-5）

- **要求**：TER 的组件与 hooks 不在渲染期读写 ref（惰性初始化除外），也不在渲染期做外部副作用。
- **验收**：
  1. `ui/*` 与 `kernel/*` 中，`react-hooks/refs`、`purity`、`rules-of-hooks` 的违例为零，而且 S-2、N-1 点名的位置**零豁免**，行内、文件级、配置覆盖都不行。其余豁免逐条列入详设，并在评审中接受。
  2. lint 识别不到的渲染期副作用（写日志、上报诊断、置位就绪标志、`new Date()` 等），由详设按位置逐一枚举，每项各附 focused 证据。
  3. 按 TR-17 的键盘场景清单，在两端各跑一遍。另有一个 StrictMode 包裹下的键盘回归测试，前提是先完成 N-4：关层命令只在真实卸载时下发，并有正向用例证明真实卸载时仍会下发。
  4. `useAdminSectionBinding` 在生产环境不再每次渲染都打日志。

**TP-B3 · 开层与关层时的输入与焦点**（S-3、S-4、D-6、选择 3）· UI_BEARING

- **要求**：
  1. **开层期间**：被弹层遮住的输入框**拒绝一切写入**，与焦点怎样到达无关（点按、硬件 Tab/Shift+Tab、扫码字符串带 Tab/Enter 后缀）。这不是焦点陷阱，因为焦点本身不受限制，符合 D-6。
  2. **关层之后**：owner 没有活动字段，也不显示虚拟键盘。在用户重新点选某个字段之前，硬件输入和扫码输入不落进任何字段。原生焦点与 owner 的活动字段不得不一致，也就是不能留下一个“看起来没选中、却握着原生焦点”的字段。
  3. 不引入焦点陷阱，也不引入模态无障碍语义（D-6）。两端都无效或只在一端有效的焦点、模态属性与调用，一律删除。
  4. 保留 `notifyFocusBoundary('suspend'/'restore')` 这个接缝。如果需要做原生 blur，由输入 owner 在这个接缝内完成（TR-17 第 6 条），不放在 LayerStack 或业务代码里。
- **验收**：
  - 场景清单要求层下至少有两个可聚焦字段，并使用真实按键事件：点按、键入、Tab/Shift+Tab、带 Tab/Enter 后缀的扫码字符串。分别观察开层期间与关层之后的落点。
  - 先在 Web 上跑，再上设备，两端结果一致。
  - 正向对照：开层期间，弹层自身的输入框照常可写。否则“挂起期间丢弃一切写入”的实现也能通过。
  - 单测必须使用真实组件实例或等价物。
  - 按键事件在设备上如何注入，由详设写明。

**TP-B4 · 管理入口的坐标随几何更新**（S-5）· UI_BEARING

- **要求**：画布缩放、宿主几何变化或祖先位移之后，管理入口手势按当前几何换算。
- **验收**：
  - Web 上调整窗口后，手势仍能正确识别；测试中带负控制：关闭几何刷新，测试变红。
  - 这段换算逻辑与平台无关，已在 Web 上用负控制证明，所以设备上只验证标准场景没有回归。

**TP-B5 · 长按不出系统菜单**（D-7、选择 2）· UI_BEARING

- **要求**：
  - 在 TER 任意 TextInput 上长按，都不出现系统的选择菜单与粘贴菜单。其他粘贴途径不在范围内。
  - 在唯一的共享 TextInput slot（F-28）中实现，业务代码零改动。
- **验收**：
  - 分母为 TER 全部 TextInput 渲染路径，由详设枚举。
  - 设备端的主证据：剪贴板非空作为前提，空字段与有内容两种状态分别长按，用 UI dump 或 window dump 证明没有浮动的选择或插入工具栏窗口；同一观测在修复前的字节上判红一次。另按 TP-X1 附上依据，证明所用属性在 RN 0.86.3 下同时关闭了选择菜单与插入菜单。
  - Web 端按 RNW 0.21.2 的实际能力处理。做不到时，作为有官方依据、明确登记的两端差异；不得以静默的部分实现代替。

阶段 B 同时完成 `ui/*` 与 `kernel/*` 中其余行为规则的 lint 清零，包括 `exhaustive-deps` 与 `no-floating-promises`（TP-A3 第 5 点）。

### 阶段 C · 原生正确性

**TP-C1 · 原生加载不阻塞 JS 线程**（S-6、N-16）

- **要求**：
  1. JS 可调用的函数与模块生命周期回调中，不存在任何跨线程阻塞等待，有超时的也不行。OnCreate、OnDestroy 只投递任务，不等待结果。
  2. Application 级回调只有一个生命周期归属，并与注释一致。
  3. 主线程工作超过上限仍未完成时，给出 typed 失败并记录日志。
- **验收**：
  - 主证据：静态审查全部 Function、AsyncFunction 函数体与生命周期回调。
  - 行为证据：在 debug 构建中，以编译期剔除的方式注入主线程占用（遵守 TR-08）。
  - 设备时序日志只作辅助。

**TP-C2 · 启动画面对未文档成员的依赖收敛**（S-7、N-13）

- **要求**：
  - 未文档成员的引用只保留一处，并在包 README 的迭代一节登记为“升级 expo-splash-screen 时必须复核”。
  - 删除不起作用的调用与自相矛盾的注释；JS 侧注释写清实际语义。
- **验收**：
  - 主判据是 `TER-Splash` 日志的先后顺序：冷启动与 resetRuntime 时，首屏就绪都先于启动画面释放。
  - 录屏只作辅助。

**TP-C3 · 副屏按 presentation 类别选择**（S-12、N-28）

- **要求**：选择副屏与统计显示数量时，都只计 presentation 类别的显示。
- **验收**：
  - 先抽出保持旧行为的纯函数，拿到修复前的红；再修复，用含非 presentation 显示的列表单测证明结果正确。
  - 设备上构造不出非 presentation 显示时，以单测为主证据。
  - 双屏真机上，修复后副屏仍被选中并正常显示；这台设备的显示列表（含各显示的类别）附在证据里。

阶段 C 同时完成 `adapter/*` 与 `application/*` 中行为规则的 lint 清零（TP-A3 第 5 点）。

### 阶段 D · 测试渲染器迁移、TS 门与全量格式化

**TP-D1 · 迁移到 @testing-library/react-native**（S-14、N-31、D-2）

- **要求**：
  1. 目标版本是 RNTL v14（选择 8；2026-09-28 的当前主线为 14.0.1，peer 为 `test-renderer`，不再依赖 react-test-renderer）。**POC 在本次唯一的详设阶段完成**，用一个包验证 v14、Vitest 与 TER 的 RN 桩这一组合，能满足 29 个测试文件的实际需要：渲染、`act`、查询、重新渲染、卸载，以及原来用 `createNodeMock`、`UNSAFE_root`、`update` 的那些测试的 v14 写法；同一文件多个用例之间的清理与 act 环境也要覆盖。POC 只为详设取证：结论、所用版本与证据写进详设，POC 的改动不留作实施成果，依赖在阶段 A 正式引入（第 3 点）。
  2. v14 的 POC 不通过时，在实施前交 Dexter 决定：改用 v13（必须保留 react-test-renderer 这个 peer），还是改走 D-2 的 b。
  3. POC 通过时，在阶段 A 引入依赖；阶段 B、C 新写的组件测试一律使用它；阶段 D 一次迁完存量的 29 个文件，并删除手写的类型声明。
- **验收**：
  - TER 中 react-test-renderer 的 import 数与依赖声明数都为 0。
  - 逐文件用例数不减少。
  - 抽样变异后仍判红。
  - 不得用 `IS_REACT_NATIVE_TEST_ENVIRONMENT` 压告警。
  - v14 及其 peer `test-renderer` 的版本与所依赖的行为，按 TP-X1 留下依据。

**TP-D2 · TS 编译器 API 与 tsconfig 合规**（S-16、S-17、N-32）

- **要求**：
  - 门测试只使用公开 API；
  - 门工具不再设置已弃用的选项，并读取诊断；
  - TER 全部测试文件都在 tsconfig 的检查范围内。
- **验收**：
  - 对故意写错语法的样例，门仍然判红。
  - `getOptionsDiagnostics()` 为空，且 workspace 包的解析结果与改前一致。
  - typecheck 覆盖全部测试文件，发现数等于检查数，并且通过。

**TP-D3 · 全量格式化**（D-4）

- **要求**：
  - 纯格式化改动单独一步，不夹带逻辑改动；
  - 满足 §2 的进入条件；
  - 完成后，format 检查接入例行入口。
- **验收**：
  - 用机械方法核验这一步没有逻辑变化，例如 AST 等价比对；
  - format 检查零差异；
  - `scripts/verify` 保持分钟级。

**TP-D4 · lint 收尾清零**（TP-A3 第 5 点）

- **要求**：行为中性规则的违例清零；批量豁免文件为空。
- **验收**：
  - 零违例、零批量豁免；
  - 保留的行内豁免，每条都写明理由，并在评审中接受。

### 贯穿全程

- **TP-X1 · 第三方依据留痕**
  - 凡依赖第三方行为的要求，详设按 `doc/platform/third-party-library-usage-standard.md` 记录：坐标、实际解析版本、经版本核对的官方来源，以及所依赖的具体语义。
  - 原生库的解析版本以 Gradle 依赖报告为准。
- **TP-X2 · README 同步**
  - 改到的每个包，中文 README 都同步到新的行为（TR-10）。
- **TP-X3 · N 级登记**
  - 按 §2 与附表执行。

### 附表：N 级归属

| 编号 | 内容 | 处置 |
|---|---|---|
| N-1、N-2 | 渲染期写 ref；渲染期副作用 | TP-B2 |
| N-3 | forwardRef 与 `.Provider` | 新代码用 React 19 写法；存量登记，不强制迁移 |
| N-4、N-5 | 关层命令只在 cleanup 中下发；用 useMemo 创建资源 | TP-B2（同文件） |
| N-6 至 N-12、N-14、N-15、N-17、N-18、N-21 至 N-23、N-29、N-33、N-34 | 各类局部问题 | 所触则做，否则登记。N-33、N-34 在阶段 D 迁移测试时一并检查 |
| N-13 | JS 侧 splash 注释 | TP-C2 |
| N-16 | 生命周期归属 | TP-C1 |
| N-19 | worklets 插件被注册两次 | 先取证（U-8）；证实有害再改，否则登记 |
| N-20 | css-interop 深导入 | TP-B0 |
| N-24 | close 原因码 | TP-A9 |
| N-25 | MMKV 初始化 | TP-A11 |
| N-26、N-27 | 广播 flag；系统栏颜色属性 | 登记。N-27 在证据证明对 API 35 以下没有影响之前不删 |
| N-28 | 死调用 | TP-C3 |
| N-30 | TER 不跑 lint 与 format | TP-A3、TP-D3、TP-D4 |
| N-31 | 手写的测试渲染器类型声明 | TP-D1 |
| N-32 | tsconfig 未覆盖测试 | TP-D2 |
| N-35 | 未使用的依赖与权限 | 依赖：所触则做，否则登记。权限：登记不删，因为 JS 与第三方库的使用面尚未核实 |
| N-36、N-37 | 隐式依赖；版本与副本分叉；NODE_PATH 私有 API | 登记 |

## 4. 验证与交付规则

1. **流程**：按 AGENTS.md 与 `doc/platform/implementation-task-template.md` 执行：
   - 一份详设与一份实施计划（含 TP-D1 的 POC）；
   - 独立子 agent 做 DESIGN 盲审；
   - 详设与实施计划交 Dexter 与 Claude review，之后再进入实施（§1.1）；
   - 按阶段 A → B → C → D 实施，逐点双读；
   - 每个已批准的实施步骤（CP）结束后，做步骤级独立对账；
   - 全部完成后，做整体三维对账；再完成最终动态验收：非拓扑情况在单机双屏真机与 mobile 虚拟机上（按 TR-16，Web 在前），拓扑情况在两台单机单屏（laptop）虚拟机上，两部分都完成才算最终验收（§2）；然后做交付前的逐代码与详设对账；
   - 独立子 agent 做 IMPLEMENTATION 审查；
   - 按模板一次性交 Claude 做全范围评审。
2. **验证顺序**：
   - UI_BEARING 与不涉及 adapter 的要求，按 TR-16 先跑 Web，再上设备，两端用同一份场景清单。
   - 原生要求以 JVM 测试与设备日志为主。
   - 静态要求以新鲜的门输出为准。
3. **Web 预览**：开发期在 Web 上边改边看，不受“持有运行期间不改源码”的限制。作为证据的 Web 运行，要与对应的设备运行在同一份字节上完成。
4. **动态运行纪律**（适用于受管设备运行与证据运行）：
   - 同一失败族第二次出现时，只冻结该族之后的推进，先做根因修复并用同一 focused proof 关到零复发，再继续；不结束实施，也不等 Dexter（`doc/platform/implementation-task-template.md` 的「失败族阶段准入」）；
   - 相关字节没改，不得重跑；
   - 持有运行期间不改源码；
   - 同一时间只允许一个受管运行；
   - 状态报告同时写“当前字节上的最新运行”和“最后一次通过”两行。
5. **证据档位**：
   - 截图、录屏、设备上的目视观察都只作辅助；
   - 静态通过不写成设备或业务通过；
   - 官方文档只证明库的约定，本仓的装配是否正确要另有证据。
6. **授权**：Dexter 已授权写详设与实施计划（§1.1）。详设与计划经 Dexter 与 Claude review 之后再进入实施；进入实施后，各阶段与受管运行都不需要再次授权，只有出现新的产品语义问题时才回 Dexter。

## 5. 决策

### Dexter 裁决

问题与选项原文取自体检报告 §5。

| 编号 | 问题原文 | 选项原文 | 裁决 |
|---|---|---|---|
| D-1 | NanoWSD 帧长问题怎么处置？ | a. 换成仍在维护、能在分配前限长的实现；b. 在仓内维护最小 fork；c. 接受风险，只用于可信局域网。 | **c** |
| D-2 | react-test-renderer 迁移路径？ | a. 迁到 @testing-library/react-native。官方推荐，但它与 Vitest 加 TER 的 RN 桩这种组合没有官方验证，需要先做单包 POC。b. 冻结现状，React 升级前再迁。 | **a** |
| D-3 | DEV 启动诊断要不要自动化覆盖？ | a. 要覆盖，例如单独给 dev 用例配 `__DEV__: 'true'`；b. 不覆盖，删除 DEV 分支和跳过的用例。 | **a** |
| D-4 | TER 要不要纳入 lint 与 format？ | （无选项，推荐纳入） | **必须纳入** |
| D-5 | 大屏设备竖放是否属于支持范围？ | 如果不支持，就在设备规格里写明，只用于固定横屏的 POS 硬件；如果支持，laptop 界面要能容忍竖屏窗口。 | **不支持大屏竖屏**（落档用原话；mobile 竖屏形态不受影响） |
| D-6 | 开层时，Android 上要不要焦点陷阱或模态无障碍语义？ | （无选项） | **不要** |
| D-7 | TextInput 长按时会弹出系统的选择和粘贴菜单，粘贴会绕过虚拟键盘。是否允许？ | （无选项） | **不允许**；范围按选择 2：只禁长按菜单 |
| D-8 | 拓扑主机能一直可用，前提是 App 始终在前台（没有前台服务）。这个产品假设是否成立？ | （无选项） | **成立** |
| — | 按键音 | — | **跟随系统** |
| — | 交付方式 | — | **一次性详设，一次性按顺序做完** |
| — | 错误提示的恢复方式 | — | **点按“知道了”后经 port 重启 JS（非原生）**，取代选择 4、5 的局部重挂 |
| 选择 7 | 两台 laptop 测试虚拟机能否清数据 | 见 §1.1 | **可以**，前提是能完整走完双机配对与会员旅途 |
| 选择 8 | RNTL 用哪个大版本 | 见 §1.1 | **v14，一次迁到位** |
| 选择 1–6 | 见 §1.1 | 见 §1.1 | 顺序：检测器先行；D-7：只禁长按菜单；焦点：关层不回焦、开层拦住硬件输入；screen 崩溃：提示后点按；层崩溃：层内提示后点按（恢复动作已改为重启 JS，见 §1.1）；Sentry：延期，登记到 HANDOFF |

### 需求侧的取舍

以下由 Claude 在需求层面决定，并已披露，可以被挑战。

- **TP-A1 放在阶段 A。** 它是纯文档，不在选择 1 的清单里，但越早落档，后续引用越稳。
- **TP-B0（vendor 迁移）放在阶段 B**，与唯一依赖它的 TP-B5 同处一个验证面。
- **S-16、S-17 放在阶段 D**，与测试迁移同属静态工具面。
- **测试框架依赖在阶段 A 引入。** POC 在本次唯一的详设阶段完成，通过后即在阶段 A 引入依赖，阶段 B、C 新写的测试直接使用，避免返工；存量迁移仍在阶段 D。
- **TP-A6：正本放在“键注册表”这一层。** 色值本来就只有一个住址，漂移出在键表上。
- **TP-A7：只写结果，不写机制。** 修复前的红用生产配置证明。
- **TP-A3：用 ESLint 自带的批量豁免做棘轮，按验证面分阶段清零。** 新代码从第一天就受约束（T-4），存量在各自的验证面上清零。计数级的替换风险只存在于实施过程中，交付时豁免为零。
- **TP-A1：Sentry 延期登记在 HANDOFF 的 TER 登记表，不进十项正本表。** 与 `TER_NANOHTTPD_REPLACEMENT` 等 Dexter 裁定的 TER 延期项同表；进正本表要改门的已批准清单与行数，超出这次需要。
- **TP-B3：“被遮字段拒绝写入”不属于焦点陷阱。** 焦点不受限制，所以符合 D-6；如果 Dexter 认为两者相同，本条回裁决。
- **TP-A11：用结果来约束迁移。** 只要求“不打断现有设备”，不指定具体机制。
- **N-3：不做全量迁移。** forwardRef 与 `.Provider` 在 19.2 中仍然受支持。

## 6. 非目标与授权边界

**非目标**：
- 替换或 fork NanoHTTPD（D-1）；
- 支持大屏竖屏（D-5）；
- 焦点陷阱与模态无障碍语义（D-6）；
- 前台服务（D-8）；
- 由应用自己控制按键音；
- 快捷键粘贴与输入法剪贴板（选择 2）；
- 关层后自动回焦（选择 3）；
- T-3 中的 Sentry 部分：按选择 6 延期，登记到 HANDOFF.md（TP-A1）；
- 修改 `ScreenReadyBoundary` 现有启动失败页与运行异常页的文案与呈现。TP-B1 第 3 点对就绪上报的改动不在此列；
- 删除旧的受保护命名空间；
- L2、DEV、seed、reset、UAT；
- 后端与管理后台，包括它们的 lint 行为。

**授权边界**：
- 本文件经 Dexter 接受之前，不授权任何实施。
- 接受之后，授权 §2 范围内的改动，包括：
  - 按 T-3 新增 `react-error-boundary`；
  - 按 D-2 与选择 8 新增 @testing-library/react-native v14 及其 peer `test-renderer`；
  - JVM 单测所需的测试侧配置与依赖；
  - 新鲜运行静态门；
  - 在设备验证面上运行。
- 设备数据清除不在授权之内；唯一例外是两台 laptop 拓扑测试虚拟机上的两个 sample 包（选择 7）。

## 7. 与现行正本、既有裁定的关系

- **遵循**：T-3 的边界部分（TP-B1；Sentry 部分按选择 6 延期，T-3 处于部分落实状态）、T-4（TP-A3）、第三方规范、终端规范 TR-10、TR-16、TR-17。TR-11 不受影响。
- **门规则**：`verify.mjs:126-128` 本身不改也不削弱，只把各包的 lint 声明由 ABSENT 改为实际拥有（TP-A3）。
- **TR §7.1 不改**：通过把自写代码迁出 `vendor/` 来满足它（TP-B0）。
- **缺判据的地方（DESIGN_GAPS）**：以下三项交回各正本的 owner 补写。本需求只做本整改范围内的约定：
  - 原生单测必须由例行入口运行；
  - 红夹具必须在拷贝上做；
  - Expo Web 预览与受管运行之间的关系。
- **体检报告中已被取代的口径**，以本需求为准：
  - §4 的分批方案；
  - §5 中 D-7 的影响段；
  - S-3、S-4 的整改建议；
  - S-1 的整改建议（已在报告中标注更正）。
- **与 2026-09-25 TER 包整理批的关系**：F-18 与当时的 transport 夹具漂移同属一族，TP-A4 负责补上防再犯的门。
- **顺带更正**：项目记忆 `decisions.terminal-build-order-and-batches` 第 66 行引用的 `doc/plans/platform/2026-09-25-ter-package-layout-cleanup-formal-requirements-claude.md` 不存在，实际文件的日期是 09-24。随 TP-A1 一并更正，只改路径。

## 8. 风险与未决

| 编号 | 内容 | 由哪条要求关闭 |
|---|---|---|
| U-1 | 原生库的实际解析版本 | TP-X1 |
| U-2 | 设备上的颜色 | TP-A6 验收 3 |
| U-3 | 空闲断连 | TP-A7 |
| U-4 | 压缩炸弹 | TP-A8；帧长已按 D-1 接受 |
| U-5 | 开层期间的硬件输入 | TP-B3 |
| U-6 | 主线程等待 | TP-C1 |
| U-7 | react 是否单实例 | TP-A10 |
| U-8 | worklets 插件被注册两次 | 附表 N-19 |

**待运行证据的平台行为**，由对应要求在实施中取证：
- 硬件 Tab 在两端的焦点导航（TP-B3）；
- 首屏崩溃时，启动画面会停住还是触发看门狗（TP-B1）；
- 验证面两台设备上旧受保护命名空间的实际状态（TP-A11）；
- 双屏真机上各显示的类别，以及修复后副屏的选择结果（TP-C3）；
- 现有受管入口在真机上能否跑通（§2、F-31、F-32）；
- 两台 laptop 虚拟机上拓扑验收的实际结果（§2、TP-A7、TP-A8、TP-A9）；
- Gradle 单测的耗时（TP-A4）。

**其他风险**：
- TP-D1 的 POC 可能失败，届时回 Dexter；
- 存量 lint 违例的规模未知，按验证面分阶段清零，可能拉长 B、C 两个阶段；
- 他人并行修改 TER，由 §2 的重核与升级规则处理。

## 9. 评审记录

完整的处置记录见 `doc/review/platform/2026-09-28-ter-third-party-remediation-requirements-blind-review-claude.md`。

- **第 1 轮（v1）**：三位盲审均为 NO-GO。
  - 事实组 1/6/8，机制组 1/16/6，合理性组 1/7/4。
  - 三位共同的 M 是与 T-3 冲突。
  - 需要裁决的四项已由 Dexter 作答。
- **第 2 轮（v2）**：两位盲审均为 NO-GO。
  - 收口组 0/6/6，忠实度组 0/4/6。没有 M。
  - 收口组给出 `ROUND_FINAL_DECISION=SELF_DECIDED`。
  - 层崩溃的恢复方式已由 Dexter 作答（选择 5）。
  - 其余意见全部由作者处置，写入 v3。
  - 按两轮上限，本 cycle 以 v3 收口，不召集第三轮。
- **Codex 需求评审（v3）**：NO-GO，1/3/1（`doc/review/platform/2026-09-28-ter-third-party-usage-remediation-requirements-review-codex.md`）。
  - M-1：Sentry 与“遵循 T-3”不一致。CONFIRMED，Dexter 选择 6（延期，登记到 HANDOFF）。登记在 HANDOFF 的 TER 登记表，并在项目记忆的 T-3 处加指针。
  - S-1：批量豁免只计数。CONFIRMED，TP-A3 改写为计数级棘轮，清零时删除条目，红夹具落在无豁免位置；交付结束时豁免为零，风险只存在于实施过程中。
  - S-2：跳过测试的计数。CONFIRMED，TP-A4 把发现数定义为源码中的 `@Test` 数，要求跳过、失败、出错都为 0；现有测试没有跳过，不设允许清单。
  - S-3：并发交错不确定。CONFIRMED，TP-A9 改用确定性同步点，并要求修复前连续 10 次判红。
  - N-1：重复次数未定。CONFIRMED，TP-A7 定为 20 次（至少 5 次半开）并给出观察窗口。
  - F-22：部分确认。CONFIRMED，改为代码路径推论，设备状态由 TP-A11 验证。
  - 作者回源自查另修两处：`scripts/check/handoff-debt` 把十项正本表写死为 10 行，所以登记改到 TER 登记表；TP-A4 原先的“允许清单”与“跳过数为 0”互相矛盾，已删去允许清单。
  - 以上写入 v3.1。
- **Codex 需求复评（v3.1）**：GO，0/0/0（`doc/review/platform/2026-09-28-ter-third-party-usage-remediation-requirements-rereview-codex.md`）。
- **Dexter 2026-09-28**：授权据此写详设与实施计划（原话见 §1.1）。v3.2 按原话改了两处：设备验证面改为双屏真机与 mobile 虚拟机；详设与计划写完先交 Dexter 与 Claude review。作者连带补了三处：TP-A11 验收加上“设备上须先有旧命名空间”的前提；TP-C3 加上真机副屏回归；TP-D1 注明 POC 不留作实施成果。新增事实 F-31。
- **Dexter 2026-09-28 补充验收**（原话见 §1.1）：v3.3 把最终验收拆为两部分：非拓扑情况在单机双屏真机与 mobile 虚拟机上；拓扑情况在两台单机单屏（laptop）虚拟机上；两部分都完成才算最终验收。作者据此在 TP-A7、TP-A8、TP-A9 各补一条两机验收，其中 TP-A7 的两机判据与 JVM 判据 2 同口径；新增事实 F-32。
- **Dexter 2026-09-28 改定恢复方式**（原话见 §1.1，在 Claude 评审详设期间）：v3.4 把 TP-B1 的恢复动作改为点按“知道了”后经 `appControl.resetRuntime` 重启 JS（非原生），外层异常同样处理；同时把 TP-A11 的“验证面的两台设备”写明为单机双屏真机与 mobile 虚拟机（v3.3 新增 laptop 虚拟机后原写法有歧义）。
- **Dexter 2026-09-28 选择 7、8**（原话见 §1.1）：两台 laptop 拓扑测试虚拟机可以清 App 数据；RNTL 改用 v14，POC 重做。另按 Claude 设计评审，补强三条原本过弱的判据：TP-A8 的内存上界包括库内部分配；TP-B3 增加弹层自身输入框可写的正向对照；TP-B5 增加剪贴板非空前提与修复前判红。

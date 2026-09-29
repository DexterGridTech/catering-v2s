SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
REVIEW_CYCLE_ID=TER-THIRD-PARTY-REMEDIATION-DESIGN-V3-4-2026-09-28
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
IMPLEMENTATION_AUTHORITY=true
IMPLEMENTATION_AUTHORITY_SOURCE=Dexter 2026-09-28 session instruction: revise S-1..S-3 and immediately execute the approved v3.4 implementation plan; no design rereview required.
SOURCE_REQUIREMENT=doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md#v3.4
STATUS=IMPLEMENTATION_AUTHORIZED

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md#scope
JOURNEY_REFS=N/A_WITH_REASON: 本批 UI 变化仅附着于现有 TER surfaces/controls，不新增业务任务、screen、route 或 Journey。
IA_REF=本文件 §5 control inventory 与 §7 non-visible behavior matrix
INTERACTION_REF=需求 TP-B1/B3/B4/B5 与本文件 §5；无新 surface/copy，因此不新建 wireframe。
AUTHORIZED=详设与实施计划修订、按 CP-0..CP-D 实施、白名单依赖安装、构建、Web/Metro 与获准的双屏真机/mobile/laptop 虚拟机受管验证；两个 laptop 拓扑虚拟机按门控可各清 App 数据一次。
NOT_AUTHORIZED=L2/DEV/seed/reset/UAT；双屏真机/mobile 清数据；删除旧受保护命名空间；范围外设备、依赖、产品 UI/Journey。
IMPLEMENTATION_AUTHORITY=true
```

# TER 第三方库用法整改详设

> 本文冻结经复评修订后的实现边界、当前字节基线与证伪条件；Dexter 已授权本批实施，来源与边界见前置 metadata。唯一需求输入为上方 `SOURCE_REQUIREMENT` v3.4。TP-A1 至 TP-D4、TP-X1 至 TP-X3 全部在范围内。阶段 A→B→C→D 是同一批次的先后次序，不是独立 review 单元。本次依据 v3.4 裁定：错误恢复经新 command→actor→`appControl.resetRuntime`；仅两台 laptop 拓扑 VM 可清数据；RNTL v14；按“抓大放小”收敛。

## 1. 目标与不变量

目标是让 TER 的第三方库行为有当前解析版本依据、让已有检测入口真实执行、修复 v3.4 明确列出的缺陷，并使修复可以被静态门、测试、Web、单机双屏真机、mobile 虚拟机与两台 laptop 拓扑虚拟机证伪。不得扩展到 backend、管理后台、L2、DEV、seed、UAT 或其他设备。新增依赖只限 v3.4 明确授权的 `react-error-boundary`、TP-D1 POC 通过后阶段 A 引入的 RNTL v14 及其 React 19.2 对应 renderer peer，以及 TP-A4 明确允许的 test-scoped `org.json`；TP-X1 只登记实际使用的第三方，不构成依赖新增授权。

Dexter 已定事项逐项继承：NanoWSD 风险接受；拓扑端口仅可信门店局域网；Sentry 延期；错误提示唯一“知道了”按钮经 command→actor→`appControl.resetRuntime` 重启 JS，screen/layer/其外异常同一恢复语义；两台 laptop 拓扑 VM 可清 App 数据，但双屏真机和 mobile VM 不得清；RNTL v14 一次迁移；DEV 测试分支实际执行；大屏 sw≥600dp 竖屏不支持、mobile 竖屏保留；TP-B3 不引入焦点陷阱/模态无障碍；TP-B5 只禁止系统菜单，不限制其他粘贴路径。边缘复杂性按“抓大放小”控制，不增加无判据的通用机制。

### 1.1 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A · 只改文档与检查脚本 | 能描述风险，但仍保留本需求明确要求修复的运行时缺陷、未执行的原生测试和 renderer 迁移债务 | 拒绝：无法满足 TP-A/B/C/D 验收 |
| B · 顺手升级 TER 的 React Native/Expo/测试栈并统一依赖 | 可能减少版本分叉，但改变批准范围，扩大 native/build 风险，且掩盖当前版本实际行为 | 拒绝：v3.4 未授权框架升级；第三方来源必须按现有解析版本核验 |
| C · 严格按 TP-A→B→C→D 修复 owner、检测器与测试入口，仅引入需求允许的依赖，并将证据运行留在批次最终阶段 | 保持应用/adapter owner 与批准 Journey；按现有栈和精确来源逐项证明；所有阶段属于一次原子交付 | **采用** |

我选了 C 而不是 A/B，因为它实现 v3.4 的完整修复与设备验收分母，又不借机改变技术栈或产品语义；若当前版本官方证据不足，受影响的单项标记 `OPEN`，不拿近似版本代替。

硬不变量：

1. 不改变既有 owner、command、模块身份、持久化业务语义和已批准 Journey；TP-A11 只能采用不使现有设备触发 `PERSIST_KV_PROTECTED_KEY_MISMATCH` 的迁移形态。
2. 三个受管 Kotlin 源集必须动态发现并真实编译、执行；不得冻结当前 `@Test` 数字或用源字符串存在性替代运行报告。
3. UI 变化仅限 TP-B1、B3、B4、B5；TP-A6 只同步语义色键。TP-B1 按已裁定文案保留唯一“知道了”按钮，不加第二操作；其 command 经 actor 调用 `appControl.resetRuntime`，重启 JS 而非原生。
4. 调试注入按 `TR-08` 编译期剔除。生产日志不得包含密码、动态口令、token、cookie、Authorization、手机号、登录名、原始 IP 或 raw payload。
5. T-3 依据 `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md#T-3` 与 `project-memory/decisions/terminal-architecture-and-stack-rulings.md#TER_STACK_RULINGS_T1_T13`：本批落实 screen、layer 与 surface-content 错误边界；唯一“知道了”按钮派发新建的 `resetRuntimeAfterSystemFailureCommand`，由 `kernel/base/runtime` 的 `reset-runtime-after-system-failure` actor 调用 `appControl.resetRuntime` 重启 JS；Sentry 延期。T-4 的 React Hooks 规则按 `project-memory/decisions/terminal-architecture-and-stack-rulings.md` 的现行裁定执行。

## 2. 新鲜基线与准入记录（2026-09-28）

本节只记录本轮命令的实际结果，不消费需求、体检报告或旧运行的快照。需求与范围均以 v3.4 为准。

| 门 | 本轮命令 | 当前字节结果 | 首个失败/边界 |
|---|---|---|---|
| TER typecheck | `yarn --cwd apps/terminal typecheck` | PASS；Turbo 覆盖 29 个包；29/29 successful | 本轮 29 个任务均为本地缓存命中；原始输出见 CP-0 evidence `yarn-typecheck.log`，不视为当前修改字节的重编译证据；CP-A 后相关门须强制执行 |
| TER 静态门与全部子门 | `yarn --cwd apps/terminal verify:static` | PASS；runId `ter-local-static-75627-1790593697530`；终态 `TERMINAL_STATIC=PASS`；全部静态子门通过 | 原始 stdout/stderr 与 run events 见 CP-0 evidence `yarn-verify-static.log`；预计红变异后恢复并 cleanup PASS |
| TER 全量现有测试 | `yarn --cwd apps/terminal test` | FAIL；Turbo 24 successful / 27 total；`@catering-v2s/ui-integration-sample-wallpaper-console` 有 2 个失败、24 个通过 | 原始确认运行见 CP-0 evidence `yarn-test-first-failure.log`。两项为 `sample2 terminal surface adapter > exposes the package defaults without duplicating the shared parser matrix` 与 `keeps one logical canvas for laptop dual surfaces and rejects mobile secondary`，都将过时高度 800 与 owning `package.json` 的 1280×720 landscape PRIMARY/SECONDARY 对比。CP-A 只修复这两处 test oracle 为 720；产品配置保持 1280×720。该失败族第二次出现后已冻结，修复前不再运行全包测试 |
| renderer census | `rg -l "from ['\"]react-test-renderer|require\(['\"]react-test-renderer" apps/terminal -g '*.{ts,tsx}'` | 29 个测试文件实际 import renderer；另有 10 个手写 `.d.ts`；RNTL imports=0 | 完整 path inventory 见 CP-0 evidence `renderer-import-paths.txt`、`renderer-declaration-paths.txt` |
| `__DEV__` census | `rg --files apps/terminal | rg '\.dev\.test\.'` | 当前 5 个 `*.dev.test.*` 文件，分支形式以需求 TP-A5 两态清单为准 | 需求来源 F-16 还指明 27 个 Vitest 配置；CP-0 要逐配置复算 |
| Kotlin 测试 census | `rg --files apps/terminal | rg '/src/test/.*\.kt$'` | 当前三个模块、4 个测试文件、26 处 `@Test` | `kotlin-test-paths.txt`；application-base 缺 `moduleName` 是已知基线根因 |
| 其他 census | active-file `rg --files`、token/import searches 与设计 owner 表 | 29 个非根 package manifests / invariants；27 个 Vitest 配置；5 个 `*.dev.test.*`；TextInput token search 11 个文件（含 1 个 `/src/vendor/` 文件，非 vendor=10）；6 个 NativeWind vendor 文件；N-1..N-37 全部有 owner 映射 | 逐项路径见 CP-0 evidence 同名 inventory 文件；生产控件分母仍按 §5 的 7 条路径冻结，不按 token 文件数缩减 |

测试基线的错误不能改写成“全绿”。两项失败是测试 oracle 与 owning package defaults 漂移：CP-A 仅把两处测试期望批量改为当前 720 配置，不改产品分辨率，并以同一 focused tests 验证。第二次相同失败后已冻结全量测试门，修复前不再重跑。记录保留首败签名、最新失败原始日志及 `最后一次通过=UNKNOWN_NOT_REUSED`；CP-0 的原始门日志与完整分母路径清单位于 `doc/evidence/platform/2026-09-28-ter-third-party-usage-remediation/cp-0/`。

### 2.1 TP-D1 POC 状态

`TP-D1_POC=PASS`。本次授权明确允许一次性 POC；临时 manifest/config/setup/test 改动只用于详设计证，结束后已移除，并卸载临时依赖，不作为实施成果或测试分母。POC 结果：

| v14 旧 API 替代 | POC 实际观察 | 结果 |
|---|---|---|
| `createNodeMock` | 不再依赖 renderer host mock；将需要的 imperative handle 放到 TER RN 桩可注入的组件边界，在测试中提供最小 fake component 并验证调用/参数 | PASS |
| `UNSAFE_root` | 改用 RNTL render result 的公开 `container`/查询结果；不遍历 renderer 私有树 | PASS |
| `update` | 改用 render result 的 `rerender(<Probe value="next" />)`，断言新可见输出 | PASS |
| `render` / 查询 | RNTL v14 async `render`，用返回对象的 `getByTestId`/`getByText` 查询用户可见状态 | PASS |
| `fireEvent` / `act` | async `fireEvent` 驱动输入；RNTL async `act` 驱动状态更新并断言结果 | PASS |
| 多用例清理与共享 setup | `expect` 仍需要：POC 的 RNTL matcher 在静态导入时从 `globalThis.expect` 注册；Vitest setup 顶层先赋 `globalThis.expect=expect` 并快照、设置 `IS_REACT_ACT_ENVIRONMENT=true`，Vitest `globals` 保持关闭。setup 显式导入 `beforeAll`、`afterEach`、`afterAll`；`beforeAll` 重设 act flag，`afterEach` 动态导入已加载的 RNTL 模块并调用 `cleanup()` 卸载所有 render，`afterAll` 恢复进入 suite 前的 act 环境值。去掉 cleanup 接入的 focused mutation 必须令跨用例残留测试失败。 | 同一文件先后运行两例；第二例确认第一例节点/状态不残留且 `act` 环境无警告 | PASS |

POC 实际使用 `@testing-library/react-native@14.0.1`、`test-renderer@1.2.0`、TER 解析的 React 19.2.3、React Native 0.86.3、Vitest 4.1.10 与 `tools/terminal-shared/react-native-vitest-entry.ts` RN 桩。4/4 focused tests 通过，耗时 1.49s；本轮没有正式改动 manifest/lock，POC 临时测试文件、临时 node_modules 与独立缓存已移除。首轮 `npm` 临时安装遇到共享缓存 `EEXIST`，改用独立缓存；第一处解析到仓根 React 19.2.5 导致 invalid hook call，随后将临时 POC 放到 TER 解析边界而使用 React 19.2.3；RNTL 模块静态导入初次测试未能取得 `screen` 单例，最终使用 async render result 查询通过。以上是 POC 夹具/解析边界的首败与修正，不是正式依赖安装结果。POC 也经历临时文件路径和导出可见性修正。`.yarn/install-state.gz` 当前仍是已跟踪的 modified 字节（本机 mtime `2026-09-28 16:37:09 KST`，与 POC 时段重合）；不能据此证明它仅由 POC 引起，也未覆盖或回滚该用户工作区文件，因此 POC 的 install-state cleanup 记为 `OPEN`，不冒称清理通过。

官方行为依据：[RNTL v14 migration guide](https://github.com/callstack/react-native-testing-library/blob/v14.0.1/website/docs/14.x/docs/start/migration-v14.mdx)。正式依赖在阶段 A 引入：精确锁定 v14 POC 解析到的 RNTL/test-renderer 版本；所有引用文件迁移后 TER `react-test-renderer` import 与 manifest 依赖声明都为零。POC 成功只证明 API 组合可行，不代替正式依赖解析、迁移或整包测试。

## 3. 需求事实重核表

下表是对 v3.4 F-1 至 F-32 的当前字节追踪。路径均从仓根起；行号只作为本轮查找提示，执行时以符号/锚点重定位。第三方行为的依据与版本见 §8。发现字节与原事实不一致时，不按旧事实硬改，记录首个差异并按 v3.4 §2 升级。

| 事实 | 本详设采用的 current-source 锚点 | 状态/进入步骤 |
|---|---|---|
| F-1 | `ui/base/primitives` 的语义键 CJS 公共子路径；两个 app 与两个 integration 的 `tailwind.config.cjs`；`ui/base/primitives/src/theme/tokens.ts`；两 integration 的 `theme/global.css` | CP-A 从合法下层正本派生四份 Tailwind 键集合，逐个检查静态类；CSS 值仍由 integration 持有，不移入键 registry |
| F-2/F-3/F-11/F-12 | `application/base/android/android/src/main/.../TerminalTopologyHostRegistry.kt`、`TerminalTopologyServer.kt`；`kernel/base/contracts/topology-transport.config.json`；`kernel/base/transport/src/foundations/createTopologyStateTransfer.ts` | CP-A 按实际 package 与源码重新定位；生产 registry 同路径 JVM socket 与锁并发测试 |
| F-4/F-20/F-25/F-26 | `ui/base/render/src/components/{ScreenContainer,LayerStack,ScreenReadyBoundary,SystemFailureNotice,SurfaceRoot}.tsx`；`ui/base/integration-assembly/src/foundations/integrationAssembly.tsx` | CP-B 每个 ScreenContainer 实例及每层均有独立边界；启动 readiness 不伪造 real-ready |
| F-5/F-6/F-7/F-24 | `ui/base/input/src/components/InputProvider.tsx`、`ui/base/input/src/hooks/useInputFocusController.ts`、`ui/base/render/src/components/LayerStack.tsx` | CP-B 状态 reducer/store 与真实 native focus owner 同步；不保留脱离实例的 `focus` 方法 |
| F-8/F-9/F-13/F-14/F-22/F-23/F-30 | 三个原生模块 `application/base/android`、`adapter/android/dual-screen`、`adapter/android/persist-kv`；两 App `MainActivity.kt`；Hydration paths in `kernel/base/state` 与 `adapter/android/persist-kv` | CP-A/A6 在任何 persist-kv 修改前用授权的改前 APK 建立并读回旧 marker；CP-C async lifecycle、display class、splash lifecycle；最终 W10 在双屏真机与 mobile 上观察迁移 |
| F-10/F-17/F-19/F-27/F-29 | `apps/terminal/application/android/*/app.json`；`tools/terminal-shared/typescript-analysis.mjs`；root `eslint.config.mjs`、TER package invariants、`tools/terminal-skeleton/verify.mjs`；ESLint 9.39.5 in root `node_modules` | CP-A exact runtime/test resolution and lint set; CP-D compiler API; handoff/coding standards sync only per v3.4 |
| F-15/F-31 | 29 current renderer-importing tests, 10 hand-authored renderer declaration files; `scripts/test/ter-virtual-keyboard-android.mjs` and `scripts/test/ter-admin-display-android.mjs` | CP-D migration; runner serial viability is checked only after dynamic identity/shape discovery at each run, not presumed from an earlier listing |
| F-16 | Five current `.dev.test.*` sources; 27 existing package Vitest configs per requirement | CP-A branch census and two-way branch tests; exact package/config count revalidated at CP-0 |
| F-18 | `application/base/android/android/src/test/.../TerminalTopologyServerTest.kt`; `tools/terminal-android-dual-screen/check-behavior.mjs` | CP-A repair host fixture; retire unsafe in-place script or run only in copy; all test source sets integrated |
| F-21/F-28 | `ui/base/primitives/src/vendor/` (six files); `src/vendor/slots.tsx` single RN `TextInput` slot | CP-B byte-compare every vendor candidate to exact upstream source; customized code leaves vendor; TextInput behavior stays in this single slot |
| F-27 | `node_modules/eslint/lib/{options.js,services/suppressions-service.js,cli.js}` resolved 9.39.5 | CP-A/D count ratchet; count by file×rule; after each rule/package reaches zero delete its bulk suppression entry |
| F-29 | `HANDOFF.md` TER register and `scripts/check/handoff-debt` approved table | CP-A add one TER row only; fresh `scripts/check/handoff-debt` remains PASS, approved ten-row list unchanged |
| F-31 | `scripts/test/ter-virtual-keyboard-android.mjs`, `scripts/test/ter-admin-display-android.mjs` | read-only current device IDs below; whether managed entry succeeds on a physical device remains OPEN until final run |
| F-32 | `tools/terminal-topology/run-dual-device.mjs`: `parseArgs`, `captureDeviceShape`, `captureStage2Shape`, `runProfile`, `runMemberJourney`; checked-in serial defaults are historical runner defaults, not target identity; stage-1 shape is one logical display and zero SurfaceFlinger virtual displays; `--output` overrides dated default; both profiles currently set `memberJourney: false`; stage-2 `dual` requires SurfaceFlinger `Virtual Display` | CP-A topology harness dynamically discovers connected devices at run time, requires explicit discovered serials (no checked-in fallback), and invokes the existing cross-device sync journey without changing its default; final topology uses only stage 1 on two freshly identified laptop VMs |

拓扑 CP-A 的精确触及文件至少包括 `apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalTopologyHostRegistry.kt`、同目录 `TerminalTopologyServer.kt`、`apps/terminal/application/base/android/src/foundations/nativeTopology.ts`、`apps/terminal/kernel/base/transport/src/foundations/createTopologySession.ts`、生产配置 `apps/terminal/kernel/base/contracts/topology-transport.config.json`、`tools/terminal-topology/run-dual-device.mjs` 及其 focused runner tests，以及对应 Android JVM server/registry tests。仅在 owning source 实际需要时扩展同目录 transport event 类型；不得把 raw frame、IP、token 或可识别 payload 写入日志。

## 4. Current device facts (read-only)

只作最终验证前置盘点，不是 app 动态验证：

| 目标 | 本轮观察到的 serial | 显示观察 | 结论 |
|---|---|---|---|
| 双屏真机 | 不冻结；本轮观察值不得用于后续选机 | display 0 内屏 1920×1080 density 240；display 2 外接 presentation 屏 1920×1080 density 213，状态 ON | 双屏硬件当时可见；每次验证开始前重新发现并确认，受管入口可用性仍待最终验证 |
| mobile 虚拟机 | 不冻结；本轮观察值不得用于后续选机 | 仅 display 0，720×1280 density 320 | 形态当时匹配 mobile；每次验证开始前按 AVD 身份与实时显示事实重新确认 |

只执行过 `adb devices -l` 与当时枚举到的设备的 `dumpsys display` 读取；未安装/启动/停止 App，未清数据、改设置、构建或采集画面。

serial 是可变连接句柄，不是设备身份；不得将任何本轮观察值或仓内旧默认编号固化为目标。每次实际运行必须从当前 `adb devices -l` 获取在线候选；对每个 emulator 候选按其当次 serial 执行 `adb -s <serial> emu avd name` 并读取 `getprop ro.product.model`、`getprop ro.kernel.qemu`、`cmd display get-displays`、`dumpsys SurfaceFlinger --displays`、`wm size`、`wm density`。按已确认 AVD 名、物理/模拟器属性和实时显示形态唯一绑定目标角色，再把刚发现的 serial 显式传 runner 并写入本次 manifest。设备重建后必须重做发现；候选数量不符、同一角色有多个候选、身份/形态矛盾、offline/unauthorized 候选影响唯一性、预检后 serial 改变或 runner 默认值被使用时 fail closed；禁止按编号、ADB 列表次序、历史截图或上轮 manifest 猜设备。

拓扑虚拟机入口不得把 serial 或固定 AVD 名当默认身份。每次启动由 Dexter/操作者提供本轮的两个期望 AVD 名（`--master-avd-name`、`--slave-avd-name`）；runner 用 `emulator -list-avds` 和 `adb devices -l` 建立当前映射，并通过 `adb -s <serial> emu avd name` 逐一确认精确名称。serial 必须由该映射唯一推出；master/slave 按显式参数分派，不按枚举顺序。启动前计算显示形态：`cmd display get-displays` 必须恰有一个逻辑 display，SurfaceFlinger 不得含 Virtual Display，`wm size` 与 `wm density` 换算出的最短逻辑边长至少 600dp 且本轮 AVD 名明确属于 laptop 目标。形态不满足或目标 AVD 名尚未由 Dexter/操作者提供时拒绝启动；VM 删除重建后重新读取 AVD 列表并传入新名称。

## 5. UI-bearing interaction 与控件分母（模板 §3a）

这不是新业务 Journey，也不新增 screen、业务文案、业务操作或入口；行为附着在现有 screen、LayerStack、input owner、管理入口手势和现有 `SystemFailureNotice` 上。产品交互由已接受需求 §1.1 与 TP-B1/B3/B4/B5 冻结；实现不得自行设计新 fallback 样式。已有展示原件：`ui/base/render/src/components/SystemFailureNotice.tsx`，沿用其标题/正文与唯一“知道了”按钮；按钮仅派发 `resetRuntimeAfterSystemFailureCommand`（定义于 `kernel/base/runtime/src/features/commands/resetRuntimeAfterSystemFailure.ts`），由 `kernel/base/runtime/src/features/actors/resetRuntimeAfterSystemFailureActor.ts` 处理并调用 `context.platformPorts.appControl.resetRuntime` 重启 JS，不重启原生。UI 不涉及后台管理 app，故前端后台规范 `§3-K-1..10` = `N/A_WITH_REASON: 本批是 TER 独立 runtime UI，不消费 platform-admin/operations-admin screen 或 admin-ui-foundation`。

| TP / control inventory | surface 与当前 owner | 用户可见文案/交互基准 | 可做的逐控件观察 | 验证范围 |
|---|---|---|---|---|
| TP-A6 semantic colors | 键注册表正本位于 `ui/base/primitives` 的 Node CJS 公共子路径；三个配置 owner 是 application 的 `createTailwindConfig` factory 与两个 integration 配置。两个 App wrapper 继续调用 factory；application-base-android 与两个 integration 可合法依赖该下层包。CSS 色值仍由两个 integration 的 `theme/global.css` 定义 | 既有控件 class、几何、文案不改；只有颜色键来源统一 | 单变异只改正本一个键，focused gate 断言三份 owner mapping 均同步变化，并解析两个 App wrapper 与两个 integration 配置得到四份有效输出；扫描四份 Tailwind content 中静态颜色类；动态类名只允许完整静态 token 映射/条件分支枚举，禁止无法静态枚举的字符串拼接；真实构建产物含键且所用 CSS variable 存在 | `application/base/android/config/index.cjs`、两个 integration `tailwind.config.cjs` 三个配置 owner，以及两个 App wrapper 的四份输出；Web 先行、设备仅最终验证 |
| TP-B1 screen error | 每个 App 实际 `ScreenContainer` 渲染的 screen；fallback 为 `SystemFailureNotice` | 原标题/正文，唯一按钮“知道了”；`SystemFailureNotice` 只派发 `resetRuntimeAfterSystemFailureCommand`（`kernel/base/runtime/src/features/commands/resetRuntimeAfterSystemFailure.ts`），其 `kernel/base/runtime/src/features/actors/resetRuntimeAfterSystemFailureActor.ts` handler 调用 `appControl.resetRuntime` 重启 JS，不重启原生 | screen render throw 落在本 screen 区域；按钮不直接调用 port、不本地卸载 notice；Web port 不可用时 actor 记录不可用结果且不声称重启成功；冷启动失败报告 `contentFailure`，不得报 real-ready | 两 integration Web；两个 App 的 PRIMARY/SECONDARY 实际挂载 screen |
| TP-B1 layer error | `LayerStack` 当前声明且运行时可见的每个 layerId；完整集合在下表按当前源冻结 | 同一 notice 与唯一“知道了” | 注错只替换目标 layer 的呈现区域；相邻 screen/layer 保持；点按经同一 command/actor/port 重启 JS | 两 integration Web 与两个 App 的所有可达 display |
| TP-B1 startup / outer error | PRIMARY `ScreenReadyBoundary`/readiness reporter；外层 `ErrorBoundary` 是 surface-owned wrapper，包住 `SurfaceRoot` 子树；`AdminLauncher` 保持为该边界外的可操作 sibling | 同一 notice，只有“知道了” | 首屏 render throw 记 `contentFailure`、释放启动遮罩但 `primaryRealReady=false`；错误持续时仍能进入 AdminLauncher 并看到 notice；screen/layer 外但属于 surface 内容的异常也进入该 boundary 并走同一 resetRuntime；Web port 不可用时不伪报成功 | 两 integration 的 production screen/layer；debug 注入走受管 debug build；真实启动顺序在双屏真机/mobile 证明 |
| TP-B3 overlay boundary | 层下被遮字段为 StaffAuth 中 `StaffLoginOperatorNameInput` 与 `StaffLoginPasscodeInput`；overlay 自身正向对照为拓扑页 `TopologySectionLaptop` 主机地址 `TextInput`；owner seam 为 `notifyFocusBoundary` | 被遮输入拒绝所有写入；overlay 自身输入可写；焦点非陷阱 | pointer、Tab/Shift+Tab、扫码字符+Tab/Enter 后缀后，被遮字段值不变且 actor owner 与 Android 原生 focused node 一致；overlay 输入值确实改变；关层后 owner/native focus 清空。设备通过受管 ADB 输入字符与 `KEYCODE_TAB`/`KEYCODE_ENTER`；Shift+Tab 以 Shift down→Tab→Shift up；扫描后缀由受管扫码注入序列发送 | 两 integration Web 与双屏真机/mobile 同一场景清单；输入字段和正向对照在设备逐项核对 |
| TP-B4 admin launcher gesture | `AdminLauncher` (`ui/base/admin-shell/src/components/AdminLauncher.tsx`) 包住 integration surface content | 双击/手势意图、位置与提示保持现状 | Web 改 viewport/host scale/祖先位移后，在当前视觉位置执行手势只触发一个 admin entrance；不刷新几何的负控必须失败 | Web 为主，两设备只跑标准场景 |
| TP-B5 all TextInput paths | 七条 TextInput 路径：`StaffLoginOperatorNameInput`；`StaffLoginPasscodeInput`；`CustomerMemberAgeField`；`MemberFormScrollContent`（姓名、电话、alpha/financial probe 共用该组件路径）；`TopologySectionLaptop` 主机地址；sample-terminal `controlledKeyboardHarness`；sample-wallpaper-terminal `controlledKeyboardHarness` | 值与提交语义保持；系统选择/粘贴菜单不可出现 | 先确认系统剪贴板非空；每条可达路径在空字段/已有文本两种状态分别长按。修复前同一 production slot focused/device 负控须红；Android 依据 RN 0.86.3 `ReactEditText` 实际选择与插入菜单行为；Web 单列 RNW 0.21.2 观察 | 两 integration Web 先；双屏真机/mobile 对可达路径逐项验证 |

TP-B1 控件分母（按代码当前入口；CP-0 只允许核对新增调用点，不缩减）：

| 类别 | 全集 | 注入/观察 |
|---|---|---|
| Screens | sample-console PRIMARY：`sample.auth.login`、`sample.desk.member-list`、`sample.desk.member-form`；SECONDARY：`sample.desk.customer-welcome`、`sample.desk.customer-member`；sample-wallpaper-console PRIMARY：`sample.auth.login`；SECONDARY：`sample.wallpaper-console.waiting`、`sample.wallpaper-console.welcome` | debug-only 注入按 partKey 定向；startup 首帧单独冷启动；屏幕树/partKey、contentFailure 与 primaryRealReady 同读 |
| Layers | sample-console：`admin.console.layer`、`admin.console.power-confirmation.layer`、`sample.auth.notice`、`sample.auth.system-notice`、`sample.desk.waiting-confirm`、`sample.desk.registry-notice`、`sample.desk.discard-confirm`、`sample.desk.withdraw-confirm`、`sample.desk.system-notice`；sample-wallpaper-console：前两项 admin layers、`sample.auth.notice`、`sample.auth.system-notice`、`sample.wallpaper.system-notice` | 按每个 layerId 定向注入；错误持续时测试 AdminLauncher；按树确认只显示目标 fallback，其他 region 存活 |
| Outer | SurfaceRoot 以下 screen/layer 之外的 surface-owned sibling 与最外 surface boundary | 注入 outer boundary 之外的唯一测试 child；确认唯一 notice、点按 resetRuntime；不可吞掉 AdminLauncher |

集合以两 integration 的 parts、feature `src/parts/parts.ts`、AdminShell `adminIdentity.ts` 与 layer action callsites 当前字节冻结；若实施前新增实际 screen/layer，作为新增分母加入而不能覆盖或删除现列项。若某列出的 screen/layer 在目标 display 没有生产消费者，记录 `NOT_COVERED_BY_PRODUCT_CONSUMER` 与具体挂载条件，不将其伪装为 PASS。

§3a 集合性核验：L2 控制面全集 `NOT_APPLICABLE_WITH_REASON: v3.4 明确不涉及 L2，且授权禁止 L2`；seed §10b `NOT_APPLICABLE_WITH_REASON: 本批没有业务 seed、数据库事实或 seed executor 变更`。以上不免除 UI 控件分母与 TR-16。

## 6. 每条机制的实现契约

以下先按模板 §3 的完整固定行集逐行作答；后面的 CP 专项表补充本批具体实现契约。模板行不删除，N/A 均附原因；所有新增测试/工具由主 agent 编写。

### 6.1 模板 §3 固定机制行

| 模板机制 | ①现成能力/规范 | ②可执行观察 | ③无成文规范时的实现形态 | ④本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | N/A：不新增业务数据读取或权限节点 | N/A：无对应 consumer | N/A | 本批零新增业务读取节点 |
| 写授权与 grant 复核 | N/A：不新增业务写授权 | N/A：无 grant | N/A | 本批零业务授权写入 |
| 跨 owner 写与事务 | N/A：不改业务 owner/数据库写路径 | N/A | N/A | 本批无跨 owner DB write |
| 集合形态与分页 | 本文 §7 的 screen/layer registry 有界集合 | focused 枚举全部实际注册项并断言渲染/错误边界逐项可达 | 复用 `ScreenContainer` 与 `LayerStack` registry，不以动态索引创建隐式项 | §5 列出的全部 screen 与 layer |
| 缓存失效/改完刷新什么 | N/A：不新增服务端缓存或 query | N/A | N/A | 本批无缓存/服务端数据刷新 |
| RTK 数据读取与加载判定 | N/A：不引入 RTK Query 消费者 | N/A | N/A | 本批无 RTK Query 变更 |
| 同一事实只有一个住址 | `input` owner、persist-kv owner、semantic-color registry | focused 检查 keyboard/focus、旧/新 namespace marker 与颜色键分别只有 owning source 提供；consumer 不镜像派生状态 | 局部派生值由既有 owner 暴露，遵循 §6.2 的 input/persistence/color 实现行 | TP-A6、TP-A11、TP-B3 的状态与键正本 |
| 失败可见且原因不得改写 | §5 TP-B1；`SystemFailureNotice` 与新 runtime command/actor | screen/layer/startup/outer 注错，断言唯一提示、typed result、readiness 与脱敏日志 | fallback 只在 owning boundary 呈现；恢复经 runtime command→actor→appControl port | §5 完整 screen/layer 分母与 surface outer boundary |
| owner 错误到 HTTP 映射与注册处 | N/A：不改 HTTP/edge API | N/A | N/A | 本批无 HTTP owner error |
| 新 owner 审计三件套 | N/A：不新增 owner/schema | N/A | N/A | 本批无审计表/路由/实体类型 |
| 幂等键构成与重放语义 | N/A：不改业务 command 或幂等 operation | N/A | N/A | 本批无业务幂等键 |
| 生成物不得手搓字符串 | 现有 Expo module、typed command、Gradle 与 package manifests | focused/static 验证模块名、command id 与 native API 来自声明/解析结果，而非复制生成物 | 遵循各 generator 与 public API source，不手改 generated output | TP-A4、A10、C1–C3、D2 所触 generated/type/config edges |
| 日志落点与脱敏字段 | AGENTS.md observability；`TerminalPersistKvModule` 与 runtime structured logging | 检查 first failure、reset、persist marker、native lifecycle 日志字段且敏感字段不出现 | 日志由实际 owner 产生，保留 category/event/request 身份并过滤异常 raw payload | TP-A1、A7–A11、B1–B5、C1–C3、设备与拓扑 runners |
| 迁移回填与可逆性 | TP-A11 namespace 迁移契约 | 两台目标设备改前日志见旧 marker；W10 断言新 namespace 初始不存在、迁移后可读且旧 marker 保留 | 采用版本化 namespace，不清数据、不原地重写旧 key；见 §6.2 行 6 | sample-terminal 与 sample-wallpaper-terminal，在 dual physical 与 mobile VM |
| 前端共享行为 | input owner、render boundaries、`useDispatchCommand`；frontend coding standard | focused 检查关闭/失败后的焦点 owner、键盘 cleanup、错误恢复以及双形态一致 | feature 不直连 native port；复用现有 input/render/runtime shared owners | TP-B0–B5 的两个 integration 与生产 consumers |
| 管理后台交互一致性 | N/A：本批不改 platform-admin/operations-admin，也不消费 admin-ui-foundation screen | N/A | N/A | 零管理后台 screen |
| 候选/下拉数据源 | N/A：无候选或下拉业务控件 | N/A | N/A | 本批零候选/下拉消费者 |
| 编码与名称呈现 | v3.4 固定现有 UI 文案；TR-10 中文 README | 检查唯一“知道了”与 touched package README 四节/迭代内容 | 命令、port 与失败 code 使用单一 typed 名称；文案沿用现有组件 | TP-B1 error notice、全部本批触及包 README 与 TP-X1 版本登记 |
| 会同时坏的东西是否已声明为原子组 | foundation-charter §5-C；批次原子交付 | CP 级对账与整批测试前整体三维对账，最终按 W/T 同一字节矩阵 | CP-A→D 只按依赖顺序执行，不拆成独立交付/review | 四 CP、两个 integration、两个 application 与两类动态验收 |

### 6.2 CP 专项实现契约

| CP 专项 | 现成能力 / 精确 owner | 本批可执行观察 | 新代码无成文规范时需仿照的源码形态 | 完整适用分母 |
|---|---|---|---|---|
| 1 Error boundary | `react-error-boundary`；`render/SystemFailureNotice.tsx`；`ScreenContainer.tsx`；`LayerStack.tsx`；surface owner；新 command `kernel/base/runtime/src/features/commands/resetRuntimeAfterSystemFailure.ts` 与 handler `kernel/base/runtime/src/features/actors/resetRuntimeAfterSystemFailureActor.ts` | screen/layer/startup/outer 四种真实 owner 树分别注错并验证 fallback/readiness；按钮只派发 `resetRuntimeAfterSystemFailureCommand`，runtime actor 调用 `appControl.resetRuntime`，重启 JS 不重启原生 | `kernel/base/runtime` 声明 public `reset-runtime-after-system-failure` command 并在 `createInternalRuntimeModule` 注册；UI 用 `useDispatchCommand` 派发，不接触 port；actor 以 command 的 requestId 调 `context.platformPorts.appControl.resetRuntime`。不可用/失败时返回 typed command outcome 并以 `category=runtime.system-failure`、`event=runtime.system-failure.reset-unavailable|reset-failed`、`commandId`、`requestId`、`portStatus` 记录，不记录异常 raw payload；Web 维持 notice 且不伪报成功。外层 ErrorBoundary 包含 SurfaceRoot 内容但不包 AdminLauncher；debug 注入遵守 TR-08 编译期剔除 | §5 全量 screens、layers、outer boundary；两 integration 与两 App 的 PRIMARY/SECONDARY 实际 consumers |
| 2 Keyboard/focus owner | `ui/base/input/src/hooks/useInputFocusController.ts`、`notifyFocusBoundary` 接缝；`terminal-coding-standard.md` TR-17 | covered field text 从所有事件源保持不变；关闭后 owner/native focus 都为空 | 延续 input owner seam，而不是 LayerStack/feature 直接 blur；关键绑定处 focused tests 按真实事件层次 | `LayerStack` 调用者全集与已列 TextInput consumers |
| 3 App/native colors | `ui/base/primitives` 包的 `semantic-color-keys.cjs` CJS public subpath 是唯一键正本；`application/base/android/config/index.cjs` factory 与两个 integration configs 消费它；两个 App wrapper 仍通过 factory 派生，两个 integration `global.css` 继续持有色值 | 一条红变异只改正本一个键，断言三个 owner mapping 均同步变化，并重新载入两个 App wrapper 与两个 integration 得到四份有效 key set；content 中静态键集合及 CSS variable 映射检查 | key source 作为 config-only CJS export，不导入 React Native runtime；三个 config owners 消费同一导出；动态颜色类只允许完整字符串映射或枚举，禁止无法穷举的模板字符串拼接 | application config factory、两个 integration `tailwind.config.cjs` 三个 owner；两个 app wrapper 加两 integration 的四份有效输出；两 integration CSS 色值与静态 colors token |
| 4 socket/thread behavior | `TerminalTopologyHostRegistry.start` 生产注册路径与 `topology-transport.config.json`；`TerminalTopologyServer` | JVM 真实 loopback socket；生产参数 3×timeout；control Pong 与无帧静默分开；5 half-open、20 cycles；原因表逐路径断言；锁内不得 I/O；运行线程基线收敛 | read timeout 取值统一为 `[heartbeatTimeoutMs, heartbeatTimeoutMs + heartbeatIntervalMs)`；+ε 变异必须判红。线程基线在 Registry 已运行且首个观测窗口前采集；20 轮最后一轮后、Registry 仍运行时再采集；不得在 `Registry.stop` 后取数。测试同步点仅在测试 JVM 注入，形态遵守 TR-08 的 test-only 注入边界；先安装同步钩子，再在修复前用独立 JVM 判红，每次变异独立 JVM。`rejectionFrame()` 用 test-scoped `org.json`；发送、关闭、发布均在锁外。本端意图→原因码表按 §7 逐行断言，T4 对照同表 | `TerminalTopologyServerTest.kt` + Registry；owner 为 `application/base/android` |
| 5 compiler/lint/test runner | `apps/terminal/package.json` scripts; root verify; Turbo `expectedTaskOwners`; TS public APIs | package set equality; red fixture proving each named rule/test actually runs | use existing `tools/terminal-skeleton/verify.mjs` child-task orchestration pattern; use `run-owned-tests.mjs` for owned unit commands | every TER package in current workspace; all three Kotlin source sets; every `*.dev.test.*` file |
| 6 persistence | `TerminalPersistKvModule.kt`, `persistenceHydration.ts`, `persistencePrimitives.ts` | 在任何生产 persist-kv 字节变更前，受管 build 改前 APK 并记录源码/APK 摘要；双屏真机与 mobile VM 对两个目标 App 使用覆盖安装、启动并由 App 自身脱敏日志确认旧 namespace marker 已建立。最终升级观察开始时断言新 namespace 尚不存在，升级后断言新 namespace 可用、旧 marker 保留且无 mismatch。观测窗口之间不装中间 APK | 比较：(a) 原 namespace 原地换 key 会触发 mismatch；(b) 逐条解密/重加密需要业务迁移与原子回滚；(c) 版本化新 namespace、旧 marker namespace 原样保留。选 (c)，避免重解密和数据清除；保留并登记旧 namespace。仅两台 laptop 拓扑 VM 可按受管入口清数据；TP-A11 的双屏真机与 mobile 始终禁止清数据。 | 双屏真机 + mobile VM；laptop topology VM 不属于 TP-A11 |
| 7 display selection | `TerminalDualScreenActivityHandler.kt`, `TerminalDeviceModule.kt` | pure list with presentation+nonpresentation; real device list with category and visible secondary | API filtered by presentation category; maintain existing display owner and secondary React surface lifecycle | `adapter/android/dual-screen`, `adapter/android/device`, dual-screen real device |
| 8 splash and readiness | `TerminalNativeLoadingModule.kt`, registry, `ScreenReadyBoundary.tsx`, `integrationAssembly.tsx` | cold start/command-triggered `resetRuntime` log ordering: real primary ready precedes hide; content failure releases startup without claiming readiness; main-thread dispatch timeout returns `TERMINAL_NATIVE_LOADING_MAIN_THREAD_TIMEOUT` from the Android Expo module boundary and records `operation`, `failureCode`, `timeoutMs`, `elapsedMs` | Expo module async APIs from resolved `expo-modules-core` version; JS-callable functions and lifecycle callbacks never block waiting across threads; bounded async main-thread dispatch reports the typed timeout code | three native modules as applies; both apps; both surfaces where mounted |
| 9 renderer migration | current RNTL-importing files; Vitest RN stub in `tools/terminal-shared/react-native-vitest-entry.ts`; RNTL v14 POC | RNTL `14.0.1`/`test-renderer@1.2.0` POC 4/4 PASS；逐文件保留断言/用例；共享 setup 顶层赋 `globalThis.expect=expect` 并快照/设置 `IS_REACT_ACT_ENVIRONMENT=true`；`beforeAll` 重设 act 环境，`afterEach(async () => (await import('@testing-library/react-native')).cleanup())`，`afterAll` 恢复原值；移除 cleanup 的跨用例残留 mutation 必红；迁移后 `react-test-renderer` import 与 TER manifest 直接依赖声明均为 0 | v14 async render/fireEvent/act、render-result public queries、`rerender`、公开 `container`；imperative mock 以可注入 fake component/module boundary 替代 `createNodeMock`；Vitest `globals=false`，setupFiles 必须先于测试模块求值 | CP-0 现取 RNTL import 与声明文件分母；POC 不冻结分母 |
| 10 format & third-party proof | `third-party-library-usage-standard.md`; lockfile; official versioned docs/repos | resolve package version from actual workspace; record upstream URL/tag/commit, semantic statement and exact focused test | maintain a per-TP version table, no memory-based API assumptions | all dependencies added, removed, or whose relied-on behavior changes |
| 11 runtime topology/device | `TR-16`; `scripts/test/ter-virtual-keyboard-android.mjs`, `scripts/test/ter-admin-display-android.mjs`, `tools/terminal-topology/run-dual-device.mjs` | non-topology: same source digest and scene IDs, Web timestamp before device; topology: two laptop VMs pass shape gate and separate TP-A7/A8/A9 + existing pair/sync scene rows; cleanup separately observed | use current managed runners only; stage 1 for two single-display VMs; do not use stage-2 `dual` on physical secondary-display hardware because its shape gate requires `Virtual Display`; use explicit `--output` | two integrations; dual-screen physical + mobile VM for all non-topology scenes; two single-display laptop VMs for topology scenes |
| 12 L2 controls | N/A | No L2 command, profile, seed, DB, Playwright remote lane executes | N/A: excluded in v3.4 and explicitly unauthorized | complete L2 control-plane inventory = NOT_APPLICABLE |

拓扑最终验收分母固定为 T1–T5，独立于非拓扑 Web→设备清单；设备身份、serial 动态映射、形态阈值、AVD 名输入及 master/slave 分派只按 §4 的唯一协议执行，不在本节复制；不得以 JVM 测试替代 T1–T5，也不得以 T1–T5 替代 JVM 判据：

| 场景 | 需求/来源 | 两台 laptop VM 上的动作与可证伪 oracle | Web/证据边界 |
|---|---|---|---|
| T1 配对与拓扑状态 | F-32 既有受管双机入口 | 对 `sample-terminal` 与 `sample-wallpaper-terminal` 两个 profile 分别运行；现取两台 serial 并确认每台恰一逻辑 display、无 Virtual Display；经生产配对入口完成配对；两端读回已配对、可达且 master/slave 角色相反 | 原生拓扑场景，不要求 Web；保存双端界面树、事件/阶段日志与受管 manifest |
| T2 心跳保活 | TP-A7 两机验收 | 每个 app profile 在首轮同步静默后进入至少 `3 × heartbeatTimeoutMs` 的 UI-idle 窗口；生产 timeout 30,000ms，即至少 90,000ms。只允许协议自动心跳，runner 不发 UI/sync/recovery。JVM TP-A7 真 socket 判据单独确认 control Pong；VM 只观察窗口首尾双端仍 paired/reachable、连接生命周期未变化，且没有任何非心跳业务动作；不新增生产逐帧计数器，也不声称 JS 可观察 control frame。窗口内出现断开/重连、生命周期变化或业务动作即失败。不得记录 payload/address/identity | JVM 生产配置真 socket 先独立证明 control Pong；VM 记录生产配置来源、单调时钟首尾与双端状态读回 |
| T3 状态传输与同步 | TP-A8 两机验收 + 既有配对/同步 Journey | `runMemberJourney` 函数体中 18 个 observe/progress 标签做静态 exact-set；运行产物要求 18 个都出现，但不要求整个 run 没有其它标签。路径覆盖 Alice pending→slave restart→withdraw/cancel→无残留 popup→Bob 再提交/确认→SECONDARY 确认→PRIMARY 持久化和 master cold restart。两个传输方向各至少一次从现有 `state-full-transfer-planned` 读到 `codec=zlib-base64`，之后接收端状态读回与发送端一致；任一方向无法由生产操作产生时标 OPEN，不伪造 | JVM 解压上限测试先 PASS；逐标签 UI tree、双向 codec/state readback 与 manifest |
| T4 断开与关闭 | TP-A9 两机验收 | 分别走 client/slave 发起断开及 master unpair/host-stop；两端在源码界定的有界时间内完成，无挂起，close cause 与逐路径对照一致 | JVM 锁序/close cause 真 socket 测试先 PASS；记录双端关闭事件及状态读回 |
| T5 既有拓扑回归 | `tools/terminal-topology/run-dual-device.mjs` `runProfile` 当前无条件调用全集 | 两个 profile 分别完整执行 `pairDevices`（含 host 占用失败/重试、host 重启、direct-pair 失败后恢复、成功配对、PRIMARY/SECONDARY 角色读回与角色占用拒绝）、`runDisconnectRecovery`、`runSlaveUnpairCoverage`、`rePairAfterSlaveUnpair`、`runUnpairAndStop`；sample-terminal 的 `runMemberJourney` 单独列在 T3。该函数清单就是场景分母，不因 CP-0 日后发现的标签差异删减；CP-0 只把源码中的每个 `record.steps`/timeline 记录映射到此固定分母 | 两台 laptop VM 同一受管 run；保存每步场景 ID、双端读回、日志与 cleanup；stage-2 `dual` 不适用于该形态 |

拓扑运行仅用 stage 1，以 `--app all` 覆盖两个 profile。每轮显式输入当轮 `master-avd-name` 与 `slave-avd-name`，managed runner 从当前 AVD/ADB inventory 唯一映射 serial，按 landscape、shortest edge ≥600dp、单逻辑 display、无 Virtual Display 准入，并以显式 AVD name 分配 master/slave，不按列表顺序分派。runner 在 managed wrapper 下登记进程/PID start token、预算与互斥，构建目标 APK 并在 manifest 绑定 APK SHA-256 与源码 digest；输出目录经 `--output` 指向本批 `.runtime`。member Journey opt-in 仅 sample-terminal 生效，默认两 profile 关闭。stage-1 `pm clear` 仅准用于通过身份/形态门的两台 laptop topology VM；双屏真机/mobile 不清数据。禁止将双屏真机副屏当 stage-2 `Virtual Display`，topology run 不得与其他受管运行并发。T2 不新增生产逐帧计数；VM 以窗口首尾双端 paired/reachable 状态与连接生命周期不变、窗口内无非心跳业务动作证明连接持续；JVM 用 control Pong 判据证明协议心跳。生产诊断不得改变业务消息、心跳节奏、owner 或恢复语义；无法观察时对应场景 OPEN。

stage-1 `coldLaunch` 可在受管 runner 明确确认两台 laptop topology VM 的 AVD identity 与形态之后，按已授权范围调用 `pm clear` 准备拓扑初态；同一代码路径必须在任何非 laptop/双屏真机/mobile 角色上 fail closed，且 focused runner 变异证明设备角色检查先于清理命令。清理只适用于 topology 两 VM，不扩展到 TP-A11 的双屏真机/mobile，也不清其他数据。cleanup 仅 force-stop 本次 manifest 拥有的进程。不得将物理双屏硬件传入依赖 Virtual Display 的 stage-2 `dual`。

stage-1 `pairDevices` 还会顺带采集平台端口与 runtime 管理页；这些只是拓扑 runner 的既有附带步骤，不构成非拓扑场景在双屏真机/mobile VM 的最终验收证据，也不减少 W 场景分母。

### 6.1 UI control and interaction restrictions

`SystemFailureNotice` remains the sole visible failure presentation with its existing “知道了” button. The button only dispatches the new public `kernel.base.runtime.reset-runtime-after-system-failure` command, defined at `kernel/base/runtime/src/features/commands/resetRuntimeAfterSystemFailure.ts`; `kernel/base/runtime/src/features/actors/resetRuntimeAfterSystemFailureActor.ts`, registered by `createInternalRuntimeModule`, handles it and calls `context.platformPorts.appControl.resetRuntime`. This restarts JS, not the native process. No local retry/remount. The outer ErrorBoundary wraps the SurfaceRoot content subtree, while AdminLauncher remains outside and available. A failed first screen reports `contentFailure` and never `primaryRealReady`. When Web has unavailable `appControl`, the actor returns a typed unavailable outcome, records the bounded command/request/port fields, and the notice remains without claiming reset succeeded. Screen/layer-external surface content errors use this same path.

Input suspension state and native focus are one owner contract: `notifyFocusBoundary('suspend'/'restore')` remains the only LayerStack→input seam. The input owner performs native blur in its own boundary callback. The visible layer is not focus-trapped and receives no modal accessibility semantics. Covered fields may retain logical keyboard navigation, but each attempted text/scan write must be dropped before the value owner receives it. On close, input owner clears `activeFieldId`, releases keyboard visibility, blurs any native TextInput, and does not restore a field focus implicitly.

## 7. IA / data and non-visible behavior matrix

本批没有业务数据集合、授权读写、服务端刷新或 seed；以下机制义务写成可执行观察，不能用属性词替代：

| IA dimension | 本批取值 / observation | evidence tier |
|---|---|---|
| state/permission | `N/A_WITH_REASON`: changes are local UI runtime failure/input suppression; no server data authorization changes | source+focused UI tests |
| navigation/refresh | failure “知道了” dispatches new public `resetRuntimeAfterSystemFailureCommand`; its runtime actor calls `appControl.resetRuntime`; JS runtime restarts. No local screen/layer remount, business query invalidation or native process restart | component and Web/device shared scenario |
| collection shape/scale | no new collection API; boundary coverage population is bounded by current screen registry and runtime LayerStack collection. At CP-0 freeze screen entries per `uiCatalog` and layer test fixture count; production list isn't turned into arbitrary paging | static registry census + mounted integration tests |
| data source/cascade | no new data source or dependent selector; errors are local render exceptions, error log fields are only `errorName` and screen/layer ID | focused log assertion |
| forbidden UI | no Sentry/network reporting; no “重启终端” for caught content error; no extra admin modal/focus trap; no system select/paste toolbar on covered TextInputs; no secret in logs | source forbiddance + UI dump/logs |

TP-A9 本端意图→原因码对照（由 JVM 测试经生产 Registry 路径逐行断言；无本端意图时才保留有效对端 close reason）：

| 本端调用/事件 | 期望原因码 | 证伪重点 |
|---|---|---|
| 角色已占用，拒绝新 peer | `TOPOLOGY_ROLE_OCCUPIED` | rejection send、close、publish 均不持锁 |
| heartbeat timeout / half-open timeout | `TOPOLOGY_TIMEOUT` | timeout 是本端关闭意图，不被 EOF/异常覆盖 |
| registry host-stop | `TOPOLOGY_HOST_STOPPED` | host-stop 本端意图优先于随后的 socket 异常 |
| 本端 `closePeer()` | `TOPOLOGY_HOST_STOPPED` | closePeer 本端意图优先于 peer-close reason |
| 本端 unpair | `TOPOLOGY_UNPAIRED` | 本端 unpair reason 传至 peer-close |
| 对端主动 close 且没有本端 close intent | 有效对端 reason；空/未知 reason → `TOPOLOGY_PEER_UNREACHABLE` | 不把未知对端码冒充为本端意图 |
| 网络断开且无本端 close intent | `TOPOLOGY_PEER_UNREACHABLE` | 与主动 close 分开造例 |

每条生产路径检查发送、关闭、发布都发生在释放 `peerLock` 与 registry lock 之后。确定性交错 seam 放在 registry/server 的测试可替换锁等待边界，只存在于 test source set，归类 `TR-08_TEST_ONLY` 且生产构建无符号；先加此行为中性 seam，再在未修复字节上逐次启动独立 JVM 进行 10 次有界判红，最后修复。不得在已死锁的同一 JVM 中循环。`rejectionFrame()` 需要真实 `org.json` test dependency，不能用 `unitTests.returnDefaultValues` 替代。

## 8. Third-party version and official-source record

本轮从解析安装读取到：TER `react@19.2.3`、`react-native@0.86.3`、`react-native-web@0.21.2`、`react-test-renderer@19.2.3`、`expo@57.0.18`、`expo-splash-screen@57.0.9`、`expo-modules-core@57.0.14`、`react-native-css-interop@0.2.6`；root `nativewind@4.2.6`、`tailwindcss@3.4.19`、`vitest@4.1.10`、`typescript@6.0.3`、`eslint@9.39.5`、`eslint-plugin-react-hooks@7.0.1`、`fflate@0.8.3`。root 另解析 `react@19.2.5`，因此按实际 app Metro resolution 判断，不能仅凭 workspace 版本宣称单实例。一次性 POC 实测 RNTL `14.0.1` 与 `test-renderer@1.2.0`；未保留在 manifest/lock。`react-error-boundary@6.1.6` 为拟新增版本，正式安装前仍核对 lock 与 peer graph，不升级 React/RN。

以下每行限定本批真正依赖的行为。上游依据与本仓验证分开：版本化 source 说明库契约；focused/native/Web 证明 TER 的接线。实施 CP-0 需再以 lock/Gradle resolution 输出绑定精确坐标，并重新核对 source tag，不消费旧摘要。

| 依赖坐标 / 解析状态 | 精确官方来源与依赖语义、限制 | 本仓可失败的验证 |
|---|---|---|
| `@testing-library/react-native@14.0.1` + `test-renderer@1.2.0`（详设 POC；正式解析阶段 A） | [RNTL v14 migration guide](https://github.com/callstack/react-native-testing-library/blob/v14.0.1/website/docs/14.x/docs/start/migration-v14.mdx)：v14 async APIs、`createNodeMock`/`UNSAFE_root`/`update` 的移除与替代；v14 的 renderer peer。本地 POC 与 TER RN 桩、Vitest 4.1.10 一起实跑。 | POC 证明 Vitest `globals=false` 时仍需 setup 顶层把 Vitest `expect` 赋给 `globalThis.expect`，setupFiles 在测试模块前执行；共享 setup 顶层快照并设置 `IS_REACT_ACT_ENVIRONMENT=true`，`beforeAll` 重设该值、`afterEach(async () => (await import('@testing-library/react-native')).cleanup())` 清理每例、`afterAll` 恢复原 act 环境。跨用例残留 focused mutation 移除 cleanup 后必须红；迁移后 `react-test-renderer` import 与 TER manifest 直接依赖声明双零。Vitest `globals=false`。 |
| `react-error-boundary@6.1.6`（拟新增） | [v6.1.6 upstream source](https://github.com/bvaughn/react-error-boundary/tree/v6.1.6)：使用公开 `ErrorBoundary` 与 fallback callback；事件处理器/异步 render 外错误不在边界捕获范围。官方 package peer 与当前 React 19 兼容待安装前重核。 | screen、layer、首屏和 outer surface 逐点注错；错误恢复统一 command→actor→`appControl.resetRuntime`，不使用局部 retry/remount。 |
| `fflate@0.8.3`（当前） | [v0.8.3 `src/index.ts`](https://github.com/101arrowz/fflate/blob/v0.8.3/src/index.ts)：`Unzlib.push()` 一次处理此次 push 的全部压缩输入，再调用 `ondata`；流式缓冲会按需扩容。TP-A8 最大 base64 输入为 `reassemblyMaxBytes=8,388,608`，`rawBytes≤8,388,608`；每次向 inflater push **≤1,024 compressed bytes**。保守按每输入 byte 可能造成 `8×258=2,064` 输出 byte，单 push 突发≤2,113,536 bytes=2.016MiB；累计库输出≤8MiB+2.016MiB。按 fflate 倍增容量上界，内部保留缓冲≤2×10.016MiB=20.032MiB。另有 base64 payload≤8MiB、固定结果缓冲≤8MiB、当前 1KiB 输入切片；本解压阶段工作集上界约 36.04MiB（不含 JS 字符串/对象表示与 JSON parse 后的业务对象；这些有独立输入 rawBytes 上限但不伪称同一字节上界）。每片 `ondata` 到达后检查累计 rawBytes，超限立即失败且本地输出缓冲不扩容；分段解码，不再整体 concat 所有 compressed bytes。 | 三类固定 fixture；测试观察每次 push 输入长度≤1024且至少发生多次 push，单次 full-input 变异立即因最大 push size 断言判红；超限输入保证本地结果缓冲长度不超过 rawBytes；校验 checksum 与前缀一致但尾段越限仍拒绝。 |
| `expo@57.0.18` / `@expo/cli` resolved by app | [Expo Autolinking docs](https://docs.expo.dev/modules/autolinking/) 与 [SDK 54 changelog](https://expo.dev/changelog/sdk-54)：`experiments.autolinkingModuleResolution=true` 将 autolinking resolution 应用于 Expo CLI/Metro，帮助 monorepo 消除模块副本/React 多实例。配置键精确为 `experiments.autolinkingModuleResolution`，不是泛称 singleReact。 | 两 app.json 都有该键；从已解析 `@expo/cli` 包及其 Metro/autolinking source 读取实际消费路径；静态 gate 断言两 app 配置存在；两 app bundler resolution 对 React 指向同一文件。 |
| `react-native@0.86.3` / `react-native-web@0.21.2`（当前） | RN v0.86.3 `ReactAndroid/src/main/java/com/facebook/react/views/textinput/ReactEditText.java` 与 [RNW 0.21.2 source tag](https://github.com/necolas/react-native-web/tree/0.21.2)：核对 Android `ReactEditText` 实际长按菜单行为及 `contextMenuHidden` 传递，不假定 Web/Android 一致；TP-B5 只禁系统选择/粘贴菜单，不关闭其他粘贴路径。 | 七条 TextInput 路径，剪贴板非空；空值/已有文本两态均长按。Web、双屏真机、mobile 分别观察实际系统菜单。Prop 存在不等于菜单不可见。 |
| `expo-splash-screen@57.0.9` / `expo-modules-core@57.0.14`（当前） | 精确发布物：[expo-splash-screen 57.0.9](https://unpkg.com/expo-splash-screen@57.0.9/) 与 [expo-modules-core 57.0.14](https://unpkg.com/expo-modules-core@57.0.14/)；resolved source `SplashScreenManager.hide()` 将进程级 `keepSplashScreenOnScreen` 置为 false，故 Activity 初始化调用会提前释放，不是无效调用；公开 JS `SplashScreen.hide()` 是文档 API，且在 loading capability 的 gate 释放后才调用。 | native/source focused proof：只有 `preventAutoHideCalled` 一处未文档成员引用；启动与 resetRuntime 均先有 primary ready / `contentFailure` 归因，再执行 Activity gate release 与公开 splash hide；不得以 `SplashScreenManager.hide()` 提前释放。模块 async/queue 与 lifecycle 另由 native tests 核验。 |
| MMKV Android `2.4.2`（当前） | [Tencent/MMKV v2.4.2 `AESCrypt.cpp`](https://github.com/Tencent/MMKV/blob/v2.4.2/Core/aes/AESCrypt.cpp) 加仓内实际重载核实有效 AES key bytes/长度；未核对调用重载前，不把 KDF 产物长度当成有效 key 长度。 | 纯 key vectors 验证身份每字节影响实际截断结果；静态核实 production constructor overload；两目标设备均先读旧 namespace marker，再升级读回，不能清数据造前置条件。 |
| `org.nanohttpd:nanohttpd` / `nanohttpd-websocket:2.3.1`（Gradle 当前声明，resolution CP-0 复核） | [NanoHTTPD 2.3.1 upstream source](https://github.com/NanoHttpd/nanohttpd/tree/nanohttpd-project-2.3.1)：仅按精确 source 核验 NanoWSD/NanoHTTPD timeout、close 与线程生命周期；不改变已接受的 LAN 风险。若该 tag 与 Gradle artifact 不匹配，按 Maven source archive 与 resolution coordinate 重对。 | 同 production `TerminalTopologyHostRegistry` 起真实 JVM socket；按 TP-A7/A9 的 heartbeat/half-open/20 cycle/thread baseline 和 lock order。测试不得自选生产 read timeout。 |
| `nativewind@4.2.6` / `tailwindcss@3.4.19` / `react-native-css-interop@0.2.6`（当前） | [NativeWind v4.2.6 source](https://github.com/NativeWind/NativeWind/tree/v4.2.6)、[Tailwind v3.4.19](https://github.com/tailwindlabs/tailwindcss/tree/v3.4.19)、[css-interop v0.2.6](https://github.com/NativeWind/react-native-css-interop/tree/v0.2.6)：只用各自版本的配置扫描、生成与 public export；不依赖 css-interop 私有深路径。 | 两 app 的真实 build cwd 与 output；静态类 token registry 反例；Web global.css variable mapping；Android artifact class presence。 |
| `typescript@6.0.3` / `eslint@9.39.5` / `eslint-plugin-react-hooks@7.0.1` / `vitest@4.1.10`（当前） | 精确 tags：[TypeScript v6.0.3](https://github.com/microsoft/TypeScript/tree/v6.0.3)、[ESLint v9.39.5](https://github.com/eslint/eslint/tree/v9.39.5)、[React Hooks plugin v7.0.1](https://github.com/facebook/react/tree/eslint-plugin-react-hooks%40v7.0.1)、[Vitest v4.1.10](https://github.com/vitest-dev/vitest/tree/v4.1.10)。TP-D2 只使用此版本公开 compiler API 与 diagnostics；Vitest 的 setup-file 顺序用该版本配置语义与已跑 POC 双重核验。 | malformed TS fixture 指向具名 gate 并 red；options diagnostics 为空；eslint 规则在 TER owner packages 实际运行；RNTL matcher import 前 `expect` 已在 globalThis。 |
| `junit:junit:4.13.2`（当前 test scope） | 从 Gradle test runtime resolution 确认；只做测试执行报告，不进入 production configuration。 | 每个含 `@Test` 类都有 XML，发现数 = executed + skipped 且 skipped/failure/error 为零。 |

以上未列出的第三方包只有在 TP-X1 consumer census 证明本批依赖其具体行为时才进入同样格式的来源表；普通类型引用不扩表。官方 tag/archive 若无法确认精确坐标或不能支撑表述，则该 TP 保持 `OPEN`，不得引用近似版本或 current/latest 页面。

## 9. Cross-layer declaration / transfer / consumption matrix

| Fact/contract | Declaration | Transfer | Consumption | Proof |
|---|---|---|---|---|
| Semantic colors | one key registry in `ui/base/primitives` CJS public config subpath | application `createTailwindConfig` factory and two integration configs consume it; two App wrappers continue using the factory; integrations own CSS values in `theme/global.css` | primitives token classes in generated native and Web consumers | mutate one registry key and prove all three owner maps and four effective app/integration config outputs change; actual device output and CSS variable existence |
| Error outcome | v3.4 TP-B1: screen, layer, startup, or outer surface-content exception | owner-scoped `ErrorBoundary` + failure log + startup `contentFailure`; sole button command→actor→`appControl.resetRuntime` | same visible `SystemFailureNotice`, JS runtime reset; AdminLauncher remains outside outer boundary | injected screen/layer/startup/outer scenarios, Web unavailable-port behavior, device behavior; no local retry or Sentry call |
| Input suspension | LayerStack detects transition in layer signature | `notifyFocusBoundary` delegates to input owner; owner handles native blur, input gating | virtual keyboard state and TextInput focus | hardware/touch/scanner event matrix; value remains unchanged while covered |
| Persisted key | device identity bytes + accepted effective key length from real MMKV overload | pure key derivation and initialization owner | encrypted protected namespace on app start | old namespace precondition on both devices; listKeys succeeds and no mismatch; marker retained |
| Topology timeouts | config `heartbeatIntervalMs`, `heartbeatTimeoutMs` | production Registry uses read timeout in `[timeout, timeout+interval)` | NanoWSD connection and close event | real socket control-Pong, silent half-open and thread lifecycle via same Registry production start; `interval+ε` mutation red |
| Test discovery | each JUnit source test method and each TS config scope | package runner emits JUnit XML / TS diagnostics | exact per-class totals, tests, typecheck | discovered = run + skipped; skipped/fail/error=0; wrong syntax/fixture causes gate failure |
| Verification order | shared scenario IDs and source-byte digest | Expo Web before device, then both target devices | paired Web→device result table | TR-16 timestamps + same byte fingerprint; adapter-only exceptions are explicit |

## 10. Fixed-set compliance, owner and seed applicability

Implementation design template rows §3a are filled in §5; §10b is N/A because no business seed/DB write. L2 inventory is N/A for the same requirement-level exclusion. New owner audit trio is `N/A_WITH_REASON: no business owner, endpoint, database schema or authorization policy changes`; Kotlin module and runtime callbacks remain owned by their existing TER modules.

No data migration in business storage is designed. TP-A11 marker-only namespace transition is device storage compatibility; clear-data is forbidden on its physical dual-screen and mobile targets, while the separately authorized two topology laptop VMs may clear app data only for topology initialization. The two TP-A11 devices' old namespace facts remain unverified until the authorized implementation runtime stage; the required precondition and fallback prohibition are in the plan.

## 11. Requirement-to-design closure and N disposition

| Requirement group | Design treatment and main owning source | Required red/focused observation |
|---|---|---|
| TP-A1 | Decision + HANDOFF TER row + two memory pointers only; retain Sentry deferred; `scripts/check/handoff-debt`, `scripts/check/project-memory` | exact quote, only TER register grows, memory checks pass |
| TP-A3/A4/A5 | TER-scoped lint execution, all 29 package invariants, ESLint suppression ratchet; 3 Kotlin modules/JUnit XML; all five current DEV test sources | rules-of-hooks and render-ref red; Kotlin compile + assertion red; both DEV/PROD branch mutations red |
| TP-A6..A11 | registry, production socket behavior, bounded decompress, lock order, MMKV key, explicit autolinking, type/fixtures, production display filter | each v3.4 acceptance’s pre-fix red or positive dual-signal as specified; exact evidence is frozen in plan |
| TP-B0..B5 | vendor byte census; React purity lint and effects; render boundaries; input owner; AdminLauncher geometry; shared TextInput menu contract | per-source mutations and UI cases in §5 and plan |
| TP-C1..C3 | asynchronous native bridge; splash ordering; presentation-only display filter | source audit, focused tests, cold-start device ordering, real dual display |
| TP-D1..D4 | migrate after design-stage RNTL v14 POC PASS (six API/lifecycle capabilities exercised by four focused tests); public compiler API; isolated formatter step; suppression empty | POC record, shared config/setup proof, parse-error test, TS option diagnostics, AST equivalence and zero suppressions |
| TP-X1..X3 | version/source register, Chinese README per touched package, N findings disposition table | static check plus package README owner and version evidence |

N-level disposition is exhaustive by health-check identifier; current review must verify each touched candidate against the current source. In-scope adjustments are not an invitation to opportunistically clean adjacent findings:

### 11.1 体检报告 M/S findings 的当前落点与防回归

此表以体检报告编号为分母；“结论”是本批设计处置，不表示代码已实施。N-1 至 N-37 逐项见下表。

| 发现 | 当前位置 / owner | 结论 | 防再犯去处 |
|---|---|---|---|
| M-1 | primitives semantic key registry；application Tailwind factory；两个 integration config | TP-A6：下层唯一正本，三映射 owner、四份有效输出 | 单键变异检查三 owner maps 与四份输出；扫描动态类名可枚举性 |
| M-2 | `kernel/base/transport` 压缩重组 owner；fflate inflater | TP-A8：每次输入 ≤1,024 bytes，分段输出并按上限拒绝 | full-input 单次 push 红变异；超限与尾段越限 focused tests |
| M-3 | `scripts/test/ter-virtual-keyboard-android.mjs`、admin-display runner、双屏 adapter | CP-C 增补物理双屏准入与受管 debug 变体；W1–W11 矩阵统一在最终证据阶段运行 | runner 对物理双屏/虚拟双屏各有正控，debug 注入只在 debug 包；Web→设备同 SHA |
| M-4 | `adapter/android/persist-kv` key derivation 与两 App wiring | TP-A11：任何 key 改动前先构建改前 APK、覆盖安装并读回旧 marker；随后设备冻结至最终观察 | manifest 绑定源码/APK 摘要；最终迁移前断言新 namespace 不存在；双屏真机/mobile 禁止清数据 |
| M-5 | `application/base/android` `TerminalTopologyServer` / `TerminalTopologyHostRegistry` | TP-A9：锁外 I/O 与本端意图优先原因码表 | 生产 Registry 真 socket JVM 用例逐表行断言；T4 对照同表 |
| S-1 | `TerminalTopologyServer` timeout 与 heartbeat watchdog | TP-A7：读超时统一 `[timeout, timeout+interval)`；control Pong 与静默 half-open 分别验证 | `interval+ε` 红变异；线程基线在 Registry 运行期间采集 |
| S-2 | registry/server 测试锁等待边界 | TP-A9：行为中性 test-only 同步钩子，先钩子后修复前判红 | 每次判红由独立 JVM 执行；TR-08_TEST_ONLY；test-scoped `org.json` |
| S-3 | `tools/terminal-topology/run-dual-device.mjs` 与 managed wrapper | topology 输入本轮 AVD 名并动态映射 serial，按形态门分派 master/slave | 双角色映射/形态/serial 漂移 focused tests；APK hash 绑定 source digest |
| S-4 | TER ESLint task 与 root ESLint config | TP-A3：逐包真实 lint，生产源实际检查数 >0 且等于分母 | lint 覆盖生产源中的拷贝变异必须触发具体规则 |
| S-5 | 29 个现有 renderer 测试消费者及 TER RN Vitest stub | TP-D1：先通过 v14 POC，再在阶段 A 引依赖、CP-D 完成迁移 | v14 async API、rerender、fake component、跨用例 cleanup/act focused tests；import 与声明归零 |
| S-6 | `ScreenContainer`、`LayerStack`、startup readiness、surface owner | TP-B1：唯一 notice/“知道了”，command→actor→`resetRuntime`；startup `contentFailure`；outer boundary 不包 AdminLauncher | 按 §5 全 screen/layer 分母注错；Web port unavailable 不伪报成功；错误持续时管理入口可用 |
| S-7 | input owner、`LayerStack`、七条 TextInput consumer | TP-B3/B5：被遮字段拒写而 overlay 字段可写；剪贴板非空，空/有值均测长按 | Tab、Shift+Tab、扫码后缀、native focus owner 正反控；Android 依据 ReactEditText |
| S-8 | `runMemberJourney` 及 state-transfer codec | T3 要求两个方向各有 `codec=zlib-base64` 与一致 readback | 无法生产触发的方向标 OPEN，不以状态较小的普通同步冒充 |
| S-9 | TP-D3 formatter 与 TER tracked/in-scope 文件集 | 格式化前确认无其他 TER 在途写入，只处理冻结的已跟踪范围 | 红变异在 disposable copy 执行；不碰未跟踪文件 |
| S-10 | 体检报告 N-1..N-37 与 v3.4 附表 | 每项严格按需求列出的 FIX/登记/不改口径处置 | 下表逐项映射 owner、结论与防再犯位置 |
| S-11 | TER lint、format、Gradle unit tasks、TP-A7 长窗口 | 指定真实入口并记录各自实测耗时 | §7.2 固定 `elapsed_ms`、退出码和业务结果字段 |
| S-12 | `app.json` autolinking、RN test stub、native loading bridge、DEV matrix | TP-A10、TP-C1、TP-A5 分别补配置依据/无 hooks 守卫、typed failure、双态唯一入口 | 具体 gate 与分支变异见计划 §4.2、§6、§9 |

| 发现 | 当前位置 / owner | 结论 | 防再犯去处 |
|---|---|---|---|
| N-1 render-time ref writes | `useInputField.ts`, `InputSurfaceFrame.tsx`, `AdminLayerFrame.tsx` | TP-B2 FIX；仅保留合法 lazy init | refs/purity lint 与 render-time mutation focused tests |
| N-2 render effects/logging/date | integrationAssembly、resolvePart、useAdminSectionBinding、useAdminLogin | TP-B2 FIX：副作用移出 render，移除 per-render admin logs | render purity tests 与脱敏日志断言 |
| N-3 forwardRef/Context.Provider forward-looking APIs | React API usages | 存量登记，不强制迁移；本批新代码使用 React 19 写法 | owning README 登记；新建代码 lint/typecheck 不引入已弃用写法 |
| N-4 StrictMode layer cleanup | AdminLayerFrame | TP-B2 FIX | StrictMode 与真实 unmount/remount focused tests |
| N-5 stateful resource in useMemo | `ui/base/dev-host/.../testExpoApp.tsx` | TP-B2 FIX | unmount/remount identity focused test |
| N-6 Reselect requestId unbounded memo | runtime owner | REGISTER_README_ITERATION；无本批语义授权 | owning runtime README 登记，不变更缓存语义 |
| N-7 RTK checks vs NODE_ENV | runtime owner | REGISTER_README_ITERATION | README 分别说明独立 gates；无关行为保持不变 |
| N-8 measurement watchdog | input measurement owners | TP-B3/B4 消费到的精确行为才 FIX，否则登记 | CP-B consumer census 与边界 focused tests |
| N-9 momentum scroll semantics comment | input scroll owner | TP-B3 触及时修正，否则登记 | owner README/source comment 与 scroll tests |
| N-10 cross-platform accessibility props | LayerStack/InputSurfaceFrame | 仅 TP-B3 相关无效 props FIX；不加 modal semantics | Web/native boundary tests；其余登记 |
| N-11 PrimitiveData windowing | primitives README | REGISTER_README_ITERATION；无生产 caller | README 登记，不新增窗口行为 |
| N-12 Platform optional chain for test stub | RN Vitest stub + consumers | TP-B2 FIX | 完整 `Platform` stub 与对应 Web 分支测试 |
| N-13 Expo splash JS alias | nativeLoadingCapability、TerminalExpoSplashScreen 与 owning README | 保留一处未文档 `preventAutoHideCalled` 引用并登记升级复核；移除 Activity 初始化时有效但过早的未文档 `SplashScreenManager.hide()`；由公开 `SplashScreen.hide()` 在 Activity-owned gate 释放后关闭启动画面 | startup/resetRuntime `TER-Splash` 顺序用例；检查器对恢复 native `hide()` 的红变异；README 迭代条目 |
| N-14 LegacyEventEmitter | device、surfaceHost、nativeTopology | TP-C1/C3 所触路径迁至模块 `addListener` | 每个触及调用路径的 native test |
| N-15 Expo wrapper lifecycle bypass | dual-screen README | REGISTER_README_ITERATION；只有证明丢 TP-C1 callback 才扩本批 | README 明确生命周期约束，不改 delegate shape |
| N-16 native loading lifecycle callbacks/reload | TerminalNativeLoadingModule/Registry | TP-C1 FIX；回调 enqueue，不等待 JS | lifecycle/reload focused native tests |
| N-17 Metro extraNodeModules/CJS | 两 integration Metro configs 与 app autolinking | TP-A10 按当前字节确认后 FIX | resolver/config gate 与两 App 解析测试 |
| N-18 dropped reload task | application-base README | REGISTER_README_ITERATION；除非证明同一 TP-C1 阻断 | README 登记；不扩范围时保持原行为 |
| N-19 duplicate worklet plugins | 两 app Babel config owners | 先按健康报告 U-8 获取一个含 worklet 文件的 Babel 产物；证实有害才修，否则登记 | 产物证据与裁定写入 owning README；无证据不改配置 |
| N-20 css-interop deep import | cssInterop/nativeVariable owners | TP-B0 用精确 4.2.6 public export FIX | export-resolution focused test |
| N-21 SVG color loss | primitives slot/tests | TP-A6 若属当前语义色消费者则 FIX | StyleSheet color 两路径断言 |
| N-22 `whitespace-nowrap` native | primitives tokens/consumer | TP-A6 仅修已确认 token consumer，否则登记 | 具体一行裁切 focused test |
| N-23 NativeWind cwd | NativeWind configs/README | TP-A6/X1 触及时 FIX | 两 integration README 记录真实 app cwd 与配置测试 |
| N-24 peer-close reason | topology README + production-registry JVM tests | TP-A9 FIX，逐来源遵循本端意图优先 | §7 reason table 的 JVM 逐行断言及 T4 对照 |
| N-25 MMKV initialize marker scope | persist-kv owner | TP-A11 FIX | React instance reload 后仅初始化一次的 module test |
| N-26 exported receiver | TerminalDeviceModule README | REGISTER_README_ITERATION；不改权限 | README 登记并保留 permission/export 配置 |
| N-27 Android 15+ system bars | 两 app README | REGISTER_README_ITERATION | README 记录；不变更本批 manifest/UI |
| N-28 dead Display.getMetrics | TerminalDeviceModule | TP-C3 FIX | presentation-display selection test |
| N-29 dual-screen Jest/types/scripts | dual-screen package manifests/scripts | 仅触及且 use census 为零时 TP-D3 FIX | 删除前逐消费者核验与 package checks |
| N-30 lint/Prettier dependencies/config | adapter manifests + root lint config | TP-A3、TP-D3、TP-D4 按实际 use census FIX | TER lint/format exact task and file denominators |
| N-31 handwritten renderer declarations | 10 declaration files 当前事实，执行分母 CP-0 现取 | TP-D1 在迁移与 typecheck 通过后 FIX | renderer import/typecheck gate 与声明零残留 |
| N-32 test files outside TS project | CP-0 当前未覆盖测试源清单 | TP-D2 FIX | discovered source count = checked source count 的 checker test |
| N-33 `vi.runAllTicks()` no-op | runtime test fixture | TP-A5 仅当 DEV fixture 依赖时 FIX | controlled timer contract 与分支红变异 |
| N-34 mocks after failed tests | primitives.test、testExpoApp.test | TP-D1/D2 FIX | `afterEach`/`finally` 清理，故意失败后的隔离测试 |
| N-35 declared deps/permissions | touched package README 与 Android manifests | REGISTER_README_ITERATION；权限不删 | README 登记，manifest permissions 保持原样 |
| N-36 undeclared/transitive deps | owning package README | REGISTER_README_ITERATION；不新增依赖 | README 登记，不因本 N 项添加直接依赖 |
| N-37 versions/copies/private Node API | owning package README | REGISTER_README_ITERATION；不改 `Module._initPaths` | README 登记，不做 resolver rewrite |

When exact package README is touched, add only its assigned N item(s) under its existing iteration section with health-report identifier. Cross-package code N entries must map one-to-one to README owner or a gate/test prevention; no “N items cleared” rollup without path-based evidence.

## 12. Design gaps / explicit OPENs

1. TER integration landscape canvas is 1280×720 in both owning package manifests. CP-A synchronizes stale canvas assertions and wallpaper-console README to that current value; mock display-fact fixtures remain separate because they describe host facts, not the package's logical canvas.
2. Physical-device managed runner viability is OPEN until final run. The device is online and dual displays observed, but read-only inventory is not runtime proof.
3. Existing old MMKV protected namespace presence on both actual TP-A11 target devices is OPEN until CP-A/A6's explicitly authorized pre-change release APK is built, installed with `install -r` without clearing data, and App logs show `event=persist-kv operation=<operation> mode=protected status=<status>` for the marker-bearing namespace. This single precondition procedure is allowed only before any persist-kv change; it is not an intermediate final-byte install.
4. `react-error-boundary@6.1.6` is the selected candidate. Its exact lock resolution and peer graph must be verified before installation; if incompatible with resolved React/RN, keep that dependency step OPEN and do not override React/RN versions.
5. A separate Journey, UI surface, route, copy, or wireframe is not applicable: v3.4 changes attach only to existing controls; §5 freezes the control denominator and TP-B1/B3/B4/B5 are the interaction source. No new UI semantics or visual artifact is introduced.

## 13. Template completion

| Template requirement | Location / result |
|---|---|
| §0 metadata and authorization boundary | front-matter + metadata block under title |
| §1 real objective and ≥3-option comparison | §1 and §1.1 |
| §3 every fixed mechanism row, exact existing capability, observation, source precedent, finite scope | §6.1（模板全部 19 个固定机制行）；CP 专项契约见 §6.2 |
| §3a UI control denominator and full L2 inventory | §5 |
| §6 cross-owner write matrix | `N/A`: no business commands/DB owners touched; see §10 |
| §7 cross-layer declaration/transfer/consumption including collection, authorization, cache, error, log | §9 |
| §8 business rule→owner判定 | `N/A`: no business business rule or backend owner changes |
| §9a full synchronization and owner/source census | staged file and consumer manifest specified in implementation plan §3 and frozen at CP-0 |
| §10 migration | `N/A`: no business data migration; device namespace compatibility has TP-A11 plan in CP-A/A6 |
| §10b seed | `N/A_WITH_REASON` in §5 and §10 |
| §11 business acceptance scenarios | `N/A`: no backend acceptance operation or business HTTP route change |
| §12 OPEN items | §12 |
| §13 stop conditions | requirement §2 and implementation plan §2.1 step 6 / §14; no new stop authority |
| §13b 3D CP reconciliation | implementation plan §2.1, before overall testing |
| §13c line-by-line code/design reconciliation | implementation plan §12, explicit pre-review delivery gate |

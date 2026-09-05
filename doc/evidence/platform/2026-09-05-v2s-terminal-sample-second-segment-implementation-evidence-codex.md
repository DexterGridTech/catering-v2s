# TER sample 第二段实施证据（2026-09-05）

~~~text
REVIEW_TARGET=IMPLEMENTATION
IMPLEMENTATION_AUTHORITY=DEXTER_2026-09-05
SCOPE=CP-7_CP-8_CP-10_CP-11
BUSINESS_SOURCE=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md
DESIGN_SOURCE=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-implementation-design-codex.md
EXECUTION_PLAN=doc/plans/platform/2026-09-04-v2s-terminal-sample-two-segment-execution-plan-claude.md
ANDROID_ENV=双屏 Android 模拟器 emulator-5554；Pixel Tablet；API 35；arm64-v8a
APP_ID=com.anonymous.sampleterminal
CURRENT_STATUS=IMPLEMENTED_PENDING_CLAUDE_REVIEW_AFTER_ROUND_2_INTAKE
~~~

## 1. 范围与证据分层

本批完成三个 Android adapter、`sample-terminal` 端口表与 native carrier，随后在双屏 Android
模拟器上复验 CP-10，并完成 CP-11 的静态、focused、构建和运行对账。没有实施真实 POS、浏览器
自动化/L2、DEV、seed、UAT、部署、NativeWind、React Native Reusables 或 automation backend。

以下证据分开解释：

- 模型红向量的 `FAIL` 表示门抓住了被注入的违规形态；真实树的 `PASS` 表示当前源码干净，二者不是同一个结论。
- TypeScript/Kotlin 编译、静态门、focused test 与 Expo bundle export 不等于 Android 运行或业务旅途完成。
- Android 运行结果是模拟器结果，不表述为真实 POS 真机结果。
- S-12 的 Web 刷新语义与 S-26 第一项的浏览器 resize 行为没有做浏览器自动化；本批只保留 focused 层能证明的落盘/尺寸声明证据。

## 2. 首败、根因与 last known good

### 2.1 本批首个验证失败

最终收口前第一次运行验证模型时，`tools/terminal-skeleton/verify.test.mjs` 的测试分母仍把
`adapter-android-device` 和 `adapter-android-persist-kv` 误列为 `NO_TEST_FILES`，但当前两个包
已经有真实 `vitest` 测试与 `REAL_TESTS` invariant。模型的旧分母因此不能代表当前仓。

同一模型测试还曾递归复制整个 `apps/terminal`，把约 1GB 的 `node_modules` 与构建产物带入每个
fixture，造成高 CPU/内存与不必要的长等待。根因是 fixture 复制器没有按源码分母过滤，而不是
业务运行时死循环。主 agent 将模型分母重建为当前 19 个 test owner，并让 fixture 复制排除
`node_modules`、`.expo`、`dist`、`.vite`、`.vite-temp`；之后模型测试与静态验证通过。

### 2.2 last known good

最新全量命令（S-1 修复后）：

~~~text
yarn workspace @catering-v2s/terminal verify
~~~

结果：

~~~text
runId=ter-local-81724-1788553783696
TERMINAL_SKELETON_MODEL_TEST=PASS
TERMINAL_STATIC=PASS
TERMINAL_RENDER_STATIC=PASS
TERMINAL_LAYERING=PASS
TERMINAL_TEST_MARKERS=PASS real=16 noTests=3
Tasks: 19 successful, 19 total
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
~~~

模型输出中的违规红向量仍按预期为 `FAIL`，例如 P-5a/P-5c/P-5d/P-10、render forbidden
imports、display-context 越界形态和真实字符串控件变异；这些是门的正向证据，不是当前生产树失败。

### 2.3 独立实现复核 round 1 与处置

`REVIEW_CYCLE_ID=2026-09-05-TER-SAMPLE-VERIFICATION-SLICE-IMPLEMENTATION-01` 的 fresh 独立只读复核
（`REVIEW_ROUND=1`，`reviewerKind=INDEPENDENT_SUBAGENT`）没有发现 M 级实现偏差，但确认一条
`S-1 / PARTIALLY_CONFIRMED`：详设要求 `writeMany` 首个失败 entry 返回 operation/key，原实现只在
`MMKV.encode` 返回 `false` 时带 key；如果某个 entry 的 `encode` 抛异常，外层 `withStore` 会丢失失败 key。

主 agent 已按最小范围修复 `TerminalPersistKvModule.kt`：`writeMany` 在每个 entry 边界捕获
`encode` 异常，与 `false` 分支统一返回 `PERSIST_KV_WRITE_FAILED`、`capability=writeMany` 和当前
entry key；外层 catch 仍只处理打开实例/初始化等没有 entry 归属的失败。详设和 README 已同步该
“false 或异常的首个 entry 均带 key”语义，未改变端口签名、存储格式或 envelope 边界。

本次处置后的证据：persist-kv typecheck PASS，3 个 focused tests PASS，`:app:compileDebugKotlin`
与 `:app:assembleDebug` PASS，`verify:static` 与全量 `verify` PASS。第一次尝试的 Gradle
`:persist-kv:compileDebugKotlin` 因根项目不存在该子项目任务而失败；已确认是任务选择错误，随后用
当前 Expo 工程实际任务 `:app:compileDebugKotlin` 成功完成，不作为源码失败。

S-1 修复后的 APK 最小启动复核也保留了首败与恢复边界：第一次直接启动 debug APK 时没有 Metro，
日志明确为 `Unable to load script`，随后 carrier 记录 `secondary-start-failed` 并执行
`stop`/`detach`/`clear` cleanup；这不是 Kotlin carrier 或 persist-kv 源码错误，而是 debug APK 的
开发脚本服务未运行。启动当前 Expo Metro 后重新启动同一 APK，日志出现 `isMetroRunning(): Async result = true`、
`secondary-start-completed`、MMKV 2.4.2 与 device `displayCount=2`，并随后执行干净 cleanup。

### 2.4 独立实现复核 round 2 与处置

`REVIEW_ROUND=2` 已按 `REVIEW_ROUND_LIMIT=2` 完成，fresh reviewer 给出 `NO-GO · M=0/S=1/N=2`。
该结论是修复前状态的独立输入，不能伪装成修复后的再次 GO；本轮不再召集同一 cycle 的第三轮 reviewer。

- `S-01 / CONFIRMED` 的事实部分成立：当时 `terminalSurfaces.layout` 在源码与 test 为 `column`，而
  requirements、IA、interaction、implementation design 的示例仍为 `row`。
- 但“将源码改回 `row`”不是当前 owning decision 的正确处置。用户此前已明确裁定本 sample 的体验为主屏与
  客显上下排列、左右居中，且 requirements 本身允许 `row`／`column` 两种通用值。因此主 agent 将当前
  `column` 选择同步回 requirements、IA、interaction、implementation design，并明确 `row` 仍是通用配置选项；
  未改运行时契约或产品行为。该 S 的实际闭合是设计资料与当前 UI 决策重新一致，而不是回退已批准的纵向体验。
- `N-01 / CONFIRMED`：evidence 中 9 个 fenced block 的关闭标记曾是 `~~`；已全部修为 `~~~`，不改变证据内容。
- `N-02` 是 reviewer 对自身盲审顺序的过程披露，不是源码 finding；主 agent 不把它包装成实现证据，也不以
  自述补造不存在的机器留痕。

本轮处置后的新鲜局部证明：

~~~text
sample-console test: 5 files passed, 7 tests passed
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-console
verify:static runId=ter-local-static-2573-1788554852430
TERMINAL_STATIC=PASS
UI_LAYOUT=column（主屏与客显上下排列并在外壳内水平居中；row 仍为通用配置选项）
EVIDENCE_FENCES=PASS
~~~

## 3. 实施结果对账

### 3.1 dual-screen carrier 与 S-1

实现文件：

- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`
- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenPackage.kt`
- `apps/terminal/adapter/android/dual-screen/expo-module.config.json`

实现形态与详设一致：

- `TerminalDualScreenPackage` 通过 Expo package 机制返回 `ReactActivityHandler`；`expo-module.config.json`
  只登记 JS module，未添加不会被消费的伪 handler 字段。
- handler 在 `onDidCreateReactActivityDelegate` 读取一次不可变 displays snapshot，同时把该 snapshot
  交给副屏 `ensureSecondarySurface` 和主屏 `PrimaryLaunchOptionsDelegate`。
- 主屏通过覆盖 `getLaunchOptions()` 送 `displayIndex=0`、同一 snapshot 的 `displayCount`；副屏通过
  公开 `ReactHost.createSurface(Presentation context, componentName, Bundle)` 送 `displayIndex=1`、同一
  `displayCount`。
- carrier 只复用应用的 `ReactHost` 创建第二个 `ReactSurface`，没有第二个 host、ReactInstanceManager、
  React instance、JS VM、store、Android process 或反射私有成员。
- 只有一个同步 `registerRootComponent(App)`；`MainActivity` 与 assembly 没有 bootstrap。
- Presentation 删除或宿主销毁时按 `stop` → `detach` → `clear` → dismiss/清引用收尾；stop 失败也继续
  detach/clear，并保留结构化诊断。

### 3.2 device adapter

实现文件：

- `apps/terminal/adapter/android/device/android/src/main/java/com/catering/v2s/terminal/adapter/android/device/TerminalDeviceModule.kt`
- `apps/terminal/adapter/android/device/src/androidDevice.ts`

Kotlin 每次调用从 `DisplayManager.displays` 同步读取真实 snapshot，返回可序列化 typed result；不缓存、
不轮询、不重试、不自设 timeout。未绑定/不支持和读取异常分别返回 typed unavailable/failed。真实
`Int` 路径不会主动制造 malformed；malformed 由 `DevicePort` 替身构造并由 display-context focused test
覆盖，交付口径明确为「malformed 已由替身覆盖，真实 device adapter malformed 路径未覆盖」。

### 3.3 persist-kv adapter

实现文件：

- `apps/terminal/adapter/android/persist-kv/android/build.gradle`
- `apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/TerminalPersistKvModule.kt`
- `apps/terminal/adapter/android/persist-kv/src/androidPersistKv.ts`

Kotlin 使用静态 `com.tencent:mmkv:2.4.2`，`MMKV.initialize(applicationContext)`，并以固定 namespace
加 UTF-8 percent-encoded `persistenceKey` 创建专属 `mmkvWithID(..., MMKV.SINGLE_PROCESS_MODE)` 实例。
八个 `StateStoragePort` 方法均落到专属实例；值写入只用 `encode(String, String)`，读取只用
`decodeString`，删除/枚举/清空分别使用 `removeValueForKey`、`removeValuesForKeys`、`allKeys`、
`clearAll`。不建 envelope、不调用 typed API、不执行 `String(value)`/`JSON.parse`。

typed failure 包含静态 code、operation 和适用的失败 key；`writeMany` 对 `encode` 返回 false 或
抛异常的首个失败 entry 都返回其 key，所以批写不能把未完成批次报告为成功。

### 3.4 sample-terminal

实现文件：

- `apps/terminal/assembly/android/sample-terminal/App.tsx`
- `apps/terminal/assembly/android/sample-terminal/src/platformPorts.ts`
- `apps/terminal/assembly/android/sample-terminal/index.ts`

`sample-terminal` 只提供十项 `PlatformPortBindings`：五个 Android adapter、`platform-ports` 与
`sample-console` 七条声明边，以及其余能力的 typed unavailable。它不 import `display-context`，
不判断屏数、不决定挂几棵树、不写 bootstrap、不持有 store，也不感知 `surfaceMode`。`App.tsx` 只
读取 Android launch props 的 `displayIndex`，并从同一个 assembly 创建 PRIMARY/SECONDARY surface。

## 4. 静态、类型、focused 与构建证据

### 4.1 静态与模型门

最新 `verify` 的关键结果如第 2.2 节所列。特别核对：

- P-5d 的真实字符串控件、模板字符串、JSX host-tag 变异均使门为 `FAIL`；当前 feature、dev-host、
  sample-console 真实树保持干净。
- P-5c 的真实 `createSlice`、`react-redux`、runtime handle 与变更拼写的能力变异均为 `FAIL`；
  owner 的 `defineCommand`/`RuntimeModule` 正控制为 `PASS`。
- 空分母断言包含 P-5d；fixture 不再复制大目录构建物。
- `sample-terminal` 的十项 binding、模块声明和 assembly export 仍与当前实现一致。

### 4.2 focused test

~~~text
@catering-v2s/adapter-android-device   test: 1 file, 2 tests passed
@catering-v2s/adapter-android-persist-kv test: 1 file, 3 tests passed
@catering-v2s/kernel-base-display-context test: 5 files, 57 tests passed
@catering-v2s/ui-base-dev-host          test: 3 files, 5 tests passed
@catering-v2s/ui-base-primitives        test: 1 file, 4 tests passed
@catering-v2s/ui-base-render             test: 8 files, 31 tests passed
@catering-v2s/ui-integration-sample-console test: 5 files, 7 tests passed
~~~

全量测试 marker 为 16 个真实测试 owner、3 个 `NO_TEST_FILES` owner；总 Turbo task 为 19/19 successful。
RN `act`/react-test-renderer deprecation warnings 是测试框架告警，不被当作业务失败；没有把它们伪装成
浏览器或 Android acceptance。

### 4.3 Android 构建与版本解析

在 `apps/terminal/assembly/android/sample-terminal/android`：

~~~text
./gradlew --no-daemon --console=plain :app:compileDebugKotlin  => BUILD SUCCESSFUL
./gradlew --no-daemon --console=plain :app:assembleDebug   => BUILD SUCCESSFUL
adb -s emulator-5554 install -r app-debug.apk                         => Success
Gradle minSdkVersion=24
Gradle ndkVersion=27.1.12297006
MMKV runtime log=version v2.4.2, arch arm64-v8a
~~~

这证明本机 Gradle 配置解析、Kotlin 编译、APK 打包与安装成功；不把它扩大为真实 POS 或全 ABI 覆盖证明。

## 5. Android 模拟器运行证据

### 5.1 环境与 carrier

~~~text
adb devices -l => emulator-5554 Pixel_Tablet sdk_gtablet_arm64 model:Pixel_Tablet
adb shell cmd display get-displays -i => 0, 2
physical display => 2560x1600
secondary display => displayId=2, FLAG_PRESENTATION, 1280x720
app process => one com.anonymous.sampleterminal pid at each fresh run
window dump => Presentation window package=com.anonymous.sampleterminal, mDisplayId=2,
               frame=[0,0][1280,720]
~~~

当前日志（fresh reopen，已脱敏）：

~~~text
TerminalDualScreen: event=display-snapshot-read displayCount=2 secondaryDisplayId=2
TerminalDualScreen: event=secondary-start-requested displayId=2 displayCount=2
TerminalDualScreen: event=secondary-start-completed
TerminalDevice: event=display-info-read status=succeeded displayCount=2
MMKV: version v2.4.2, page size 4096, arch arm64-v8a
~~~

S-1 修复后的 APK 在 Metro 已启动的条件下重新启动成功，进程保持存活且双屏 carrier 完成。新鲜日志还出现
一次 React Native 的 `ReactNoCrashSoftException: Tried to access onWindowFocusChange while context is not ready`；
它发生在 React context 完成初始化前的窗口 focus 回调，随后同一进程继续 `loadJSBundleFromMetro`、创建 context/instance、
完成两棵 surface 和 MMKV/device 初始化，没有 `FATAL EXCEPTION`、进程退出或业务加载失败。该条是可解释的非致命
框架生命周期告警，已单独记录，不能表述为“启动期零告警”；它不属于 persist-kv 修复路径，也没有被静默吞掉。

Metro 输出中的 `persistSecure.listKeys: adapter not injected`、`protected storage baseline is unavailable`
和 `ui-state.content.persistence-failed` 是当前 `sample-terminal` 明确绑定
`unavailablePersistSecurePort` 的预期 typed-unavailable 诊断；`subscribePowerStatus` unavailable 同样来自
未注入的可选设备能力。它们不是 `persistKv` 的失败，也不影响本批要求的明文 KV MMKV 路径；本批按需求保留
该 unavailable 边界并把这些日志作为已解释诊断记录，不宣称“无 error-level 日志”。

`dumpsys window` 只显示一个主 Activity 与同一 app 包的 Presentation window；源码扫描目标 production
路径无 `android:process`、第二 `ReactHost`、`ReactInstanceManager`、bootstrap 或 `display-context`
依赖。静态与运行证据共同支持同一 carrier 形态；“同一 JS VM/store”的业务对应证据见 5.2。

### 5.2 CP-7 第一刀、S-27 与业务同 store

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| Presentation context/theme → `createSurface` | PASS | 双屏启动后 display 2 出现同一注册组件的 customer surface；carrier 使用 `presentation.context` 的公开 `ReactHost.createSurface`，没有另建 host |
| display removal 收尾 | PASS | 禁用 display 2 后日志顺序为 `secondary-cleanup-requested` → `secondary-stop-completed` → `secondary-detached` → `secondary-cleared` → `secondary-cleanup-completed`；PRIMARY 仍保留并可继续操作 |
| Expo host 与 RN multi-surface | PASS | 应用使用 `ExpoReactHostFactory.getDefaultReactHost` 的标准 host；一个 app 进程/主 Activity 配合 display 2 Presentation window；同一业务 assembly 在两侧显示不同 surface |
| S-27 ①单屏 no launch | PASS | 禁用 display 2 后 `cmd display get-displays -i` 仅返回主 display，未出现副屏 Presentation |
| S-27 ②正确 display | PASS | Presentation window `mDisplayId=2`，与非默认 display 一致 |
| S-27 ③ initial props | PASS（源码＋行为） | handler 同一 snapshot 给主屏 `displayIndex=0` 与副屏 `displayIndex=1`，两处 `displayCount=2`；主屏显示店员路径，副屏显示顾客路径 |
| S-27 ④幂等/回滚 | PASS | handler 有 `launchRequested`/`secondaryState` 幂等守卫；启动成功只有一个副屏；失败路径清理 surface/presentation 并复位请求标记 |
| S-27 ⑤同步注册 | PASS | `index.ts` 静态 import `App` 后同步调用 `registerRootComponent(App)`，未改成异步注册 |
| S-27 ⑥同一 JS VM/store | PASS（可证伪业务对应） | 主屏提交登记后副屏确认，确认后的 member row 出现在主屏；随后杀进程重开仍由同一 MMKV namespace 读回。若两侧独立 store，副屏确认不会改变主屏 owner members |

业务链路使用当前 APK 完成：店员登录 → 新增唯一测试会员 → 主屏进入 waiting-confirm → 副屏出现
customer-member → 副屏确认 → 主屏出现 member row。该结果是跨 surface 的共享 state/command 证据，不是
仅“两个窗口都画出来”的形状证据。

拒绝路径也使用当前 APK 完成：副屏拒绝后，主屏保留 registry notice 与 waiting-confirm，副屏回
customer-member preview；关闭 notice 后主屏回 form，拒绝的会员未进入 members。双屏与单屏的回退
行为分别验证，未把一次 notice 点击误认成流程完成。

### 5.3 S-28 真实 display info

~~~text
双屏：TerminalDevice event=display-info-read status=succeeded displayCount=2
单屏：禁用 display 2 后，业务保持 PRIMARY；单屏 no-secondary 分支成立
malformed：由 DevicePort 替身构造，display-context focused test 分类为 malformed 并降级单屏；
           真实 Kotlin DisplayManager.displays.size 路径未覆盖 malformed
~~~

S-28 与 S-27 分开取证：S-27 证明副屏 carrier/window，S-28 证明业务端口实际读到 DisplayManager 的屏数。

### 5.4 S-29 MMKV persistence 与字符串保真

~~~text
MMKV version=v2.4.2
mode=SINGLE_PROCESS_MODE
namespace=catering-v2s.terminal.state.v1.<encoded persistenceKey>
reopen log=loaded key-values from the same namespace
business readback=confirmed member row survived kill/reopen
~~~

focused adapter test 覆盖 string-only bridge 与 `writeMany` 首个失败 key 诊断；静态 production mutation
用 typed API 或值转换时会使 S-29 相关规则为 `FAIL`。当前 Kotlin production code 使用字符串 API，没有
envelope、typed API、`String(value)` 或 `JSON.parse`。五类 state 值与 `null`/`"null"` 的编码语义由
state codec 负责，adapter 只原样存取。

## 6. 未覆盖边界与清理

必须如实保留：

- 本批是在双屏 Android 模拟器上验证，未在真实 POS 硬件上验证。
- 未覆盖厂商定制 ROM 对 `Presentation`/多显示的行为差异。
- 未覆盖真实 POS 的分辨率、DPI 与性能特征。
- 未覆盖真实 POS ABI 的全体组合；本机运行的是 arm64-v8a，MMKV 2.4.2 的本次版本选择基于 Dexter
  对目标 POS 全部 64 位的裁定，若引入 32 位或 API 21–22 设备必须重新评估版本线。
- S-12 Web「刷新后重建 JS 上下文」与 S-26 浏览器 resize 行为未做浏览器自动化；focused test 只证明
  真实 storage/固定尺寸声明及其红向量。
- malformed 是替身构造路径，真实 device adapter 路径未覆盖坏 payload。

Android 动态 cleanup：完成双屏/单屏切换与 kill/reopen 后，已停止受控 app；不保留需要用户继续体验的
后台 Android 验证进程。之前用于 Web 的 Metro 若需继续运行，不属于本证据的 Android 业务结果；本任务收尾
时由主 agent 仅按精确命令/进程身份清理。

## 7. CP-11 结论

CP-7、CP-8、CP-10 与 CP-11 的实施对象、静态门、focused test、Kotlin compile/APK build、双屏模拟器
业务运行和清理证据已在本文件分层记录。当前结论是：

~~~text
CP-7=PASS（含三项第一刀局部验证）
CP-8=PASS（sample-terminal port table + native wiring）
CP-10=PASS（双屏 Android emulator；不等同 real POS）
CP-11=EVIDENCE_COMPLETE_PENDING_CLAUDE_REVIEW
S-12_WEB_REFRESH=NOT_AUTOMATED_AS_PREVIOUSLY_REGISTERED
S-26_BROWSER_RESIZE=NOT_AUTOMATED_AS_PREVIOUSLY_REGISTERED
OVERALL_IMPLEMENTATION=COMPLETED_PENDING_CLAUDE_REVIEW
~~~

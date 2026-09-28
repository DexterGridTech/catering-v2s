# TER 第三方库用法体检与整改报告（Claude）

```text
REPORT_TYPE=专项体检（不是批次 GO/NO-GO 评审）
SCOPE=apps/terminal 全部第三方库调用点：生产代码、测试、影响行为的构建配置与原生工程
BASIS=doc/platform/third-party-library-usage-standard.md；.agents/skills/cs-third-party-library-usage
RESULT=M/S/N=3/18/37。经 Dexter 2026-09-28 裁决：M-3 接受风险，S-13 关闭（见 §5）
EVIDENCE_TIER=静态。依据为本机安装包源码（精确版本）、官方文档与官方仓库 tag 源码；未运行构建、测试、Metro、Gradle 或设备
SESSION=CONTINUED_SESSION（v2s 仓根）。6 个只读子 agent 分组查证；Claude 汇总，并逐条复核承重结论（见 §7）
BYTE_STATE=2026-09-28 约 12:00–13:30 的工作区字节
  审计期间 ui/base/primitives/src/vendor/slots.tsx 被他人改过两次（12:10、12:24），相关结论以 12:24 版为准
  react-native-css-interop 的 .cache 在 12:25 被清空，说明 Metro 当时重启过
AUTHORITY=本报告不授权任何修改。是否整改、分几批做，由 Dexter 决定
SUPERSEDED=整改的范围、顺序与口径，以 doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md（v3）为准。
  本报告以下内容已被取代：§4 的分批方案；§5 中 D-7 的影响段；S-3 与 S-4 的整改建议；S-1 的整改建议（已在原处标注更正）。
  发现与证据部分仍然有效。
```

## 1. 结论

**总体判断**：TER 的第三方库版本配套是健康的，核心 API 用法大体合规。

问题集中在三处：
- **拓扑服务端依赖的 NanoHTTPD**：2.3.1 版，已约 10 年未发布新版。它的默认值与帧处理方式，带来两条 M。
- **Android 构建的主题配置与 Web 预览不一致**：一条 M，Web 上看不出来。
- **测试与工具链**：建在已弃用或不承诺的接口上。

**已经合格、不用动的部分**
- **版本配套**：expo 57.0.18 与 `bundledNativeModules.json` 对表逐项一致。react 19.2.3、react-native 0.86.3、RN 内置渲染器、react-test-renderer、react-dom 版本完全一致；reanimated 4.5.1 与 worklets 0.10.1 也兼容。
- **React 19 已移除的 API**：一处都没有用。包括 defaultProps、propTypes、字符串 ref、findDOMNode、ReactDOM.render。
- **RTK 2 与 Immer 11**：middleware 与 enhancers 用回调写法，没有对象写法的 extraReducers；reducer 里没有“既改 draft 又返回新值”的写法。
- **Expo 模板与模块配置**：MainApplication 与 SDK 57 模板逐行一致；Expo 模块配置、自动链接、事件名、AsyncFunction 队列都合规。
- **RN 旧接口**：没有用 findNodeHandle、UIManager、旧桥 NativeModules 等被淘汰的接口。

**建议优先处理**：M-1、M-2、M-3；然后是 S-1（Error Boundary）、S-3/S-4（关层焦点）、S-6（启动阻塞）、S-9/S-10（拓扑解压与死锁）。

## 2. 范围与方法

### 实际解析版本

以本机安装包的 package.json 为准。原生库是 Gradle 声明版本，未生成解析报告，见 §6。

| 类别 | 库与版本 |
|---|---|
| React 与状态 | react / react-dom 19.2.3；@reduxjs/toolkit 2.12.0（其下 redux 5.0.1、immer 11.1.15、reselect 5.2.0）；use-sync-external-store 1.6.0 |
| RN 与 Web | react-native 0.86.3（新架构与 Hermes 已开启）；react-native-web 0.21.2 |
| Expo | expo 57.0.18；expo-modules-core 57.0.14；expo-splash-screen 57.0.9；expo-status-bar 57.0.1；@expo/metro-config 57.0.12；metro 0.84.5；babel-preset-expo 57.0.9 |
| 样式与图形 | nativewind 4.2.6；react-native-css-interop 0.2.6；tailwindcss 3.4.19；react-native-svg 15.15.4；reanimated 4.5.1；worklets 0.10.1；fflate 0.8.3 |
| 原生 | react-android（随 RN 0.86.3）；MMKV 2.4.2；nanohttpd-websocket 2.3.1；androidx core-ktx 1.17.0。SDK 为 compileSdk 36 / targetSdk 36 / minSdk 24（由 RN 版本目录静态推导） |
| 测试与工具 | vitest 4.1.10；react-test-renderer 19.2.3；jest 29.7.0 与 jest-expo 57.0.5；typescript 6.0.3；eslint 9.39.5；prettier 3.9.6 |

### 调用点分母

- **JS/TS**：762 个文件。其中生产代码 138 个 React 与状态调用点、39 个 RN 调用点、41 个样式与图形调用点。
- **测试**：129 个 vitest 引用点、30 个 react-test-renderer 引用点。
- **原生与配置**：原生 Kotlin 调用点 166（Expo 与 RN 宿主）+ 181（第三方库与平台 API）；配置文件 90 个。
- 各组逐点标注了“行为依赖（已核）”或“普通用法（无需核）”。清单留存在子 agent 的回报中，本报告只列有问题的点。

### 取证口径

- 按仓内规范，官方文档页面如果不能证明与安装版本匹配，只作佐证，不作证据。react.dev、redux-toolkit.js.org 等页面没有版本标识；reactnative.dev 只精确到次版本。
- 承重结论一律以本机安装的精确版本源码、或官方仓库对应 tag 的源码为准。
- WebFetch 返回的是模型摘要，不作承重证据。凡用到的，都要求逐字摘录。

## 3. 发现

每条都写明：位置、事实、依据、影响、整改和证据状态。“仓内事实”指 Claude 或子 agent 在本仓源码中读到的事实；“推论”指尚未经运行证实的后果。

### M 级（3 条）

**M-1　Android App 构建出的主题少了 3 个语义色，设备上对应样式整片失效，Web 预览看不出来**

- **位置**：
  - `application/base/android/config/index.cjs:121-183`：sharedColors 与 createTailwindConfig；
  - 两个 App 的 `tailwind.config.cjs`：都没有传 theme。
- **仓内事实**（Claude 已复核）：
  - App 主题有 54 个颜色键，integration 有 57 个，缺 `surface-elevated`、`surface-inset`、`focus`。
  - `ui/base/primitives/src/theme/tokens.ts` 至少有 10 处用到这三个颜色，例如第 5、34、56、71、72 行的 `bg-surface-elevated`，以及 PIN 格的 `border-focus bg-surface-inset`。
- **依据**：
  - tailwind 3.4.19 只为主题里已有的颜色键生成 `bg-*` 类（`corePlugins.js:2802`）。
  - nativewind 4.2.6 启动 Tailwind 子进程时不传 `--config`（`metro/tailwind/v3/child.js:35-38`），由子进程在 cwd 下查找配置。
- **影响**：
  - 设备上会丢失：admin 卡片与折叠区的 elevated 底色、PIN 格的底色与聚焦边框、下拉框与 surface map 的底色。
  - 这类问题在 integration Web 预览里完全正常，按 TR-16 做两端对照时会出现系统性差异。
- **整改**：
  - 最小做法：在 sharedColors 里补齐这 3 个键。
  - 更稳的做法：让 App 直接复用它所装配的 integration 的主题（createTailwindConfig 已有 `theme` 参数），从根上消除两份颜色表各自漂移。
  - 验收：`tokens.ts` 里出现的每个颜色类，在 App 和 integration 两套主题中都有对应的键。
  - 另加一条机器门：比对两套主题的颜色键集合。这满足“会复发、可机械判定、维护便宜”三问。
- **证据**：静态 CONFIRMED；设备截图见 §6 的 U-2。

**M-2　NanoHTTPD 默认 5 秒读超时，会把空闲的拓扑 WebSocket 断开；30 秒心跳设计实际不起作用**

- **位置**：
  - `application/base/android/.../TerminalTopologyHostRegistry.kt:78`，调用的是不带参数的 `created.start()`；
  - `kernel/base/contracts/topology-transport.config.json:4-5`，配置为心跳 10000ms、超时 30000ms。
- **依据**（Claude 按 NanoHttpd 官方仓库 tag `nanohttpd-project-2.3.1` 源码逐字核对）：
  - `public static final int SOCKET_READ_TIMEOUT = 5000;`
  - `public void start() throws IOException { start(NanoHTTPD.SOCKET_READ_TIMEOUT); }`
  - 每个接入的连接都会执行 `finalAccept.setSoTimeout(this.timeout)`。
  - NanoWSD 的 `readWebsocket()` 捕获 IOException 后，在 finally 中执行 `doClose(...)`。
- **影响（推论）**：
  - 服务端每 10 秒收到的上行帧只有两股：客户端回的 pong，和 SLAVE 端 JS 发的应用层 ping。帧与帧之间的空隙会达到或超过 5 秒。
  - 结果是读超时触发，连接被关闭，客户端退避后重连，并发布 `TOPOLOGY_PEER_UNREACHABLE`。
  - 30 秒心跳超时分支会被 5 秒读超时抢先，永远轮不到。
- **整改**：
  - 显式调用 `start(timeout, daemon)`。timeout 取一个有限值，且不小于心跳超时。
  - 不要用 0：有限的读超时还负责回收半开连接和连接线程。
  - 验收：只有心跳流量时，连接能保持不少于 3 倍心跳超时；对端静默时，在约一个心跳超时内关闭并上报。
- **证据**：库行为 CONFIRMED（官方 tag 源码逐字）；端到端 UNVERIFIED（U-3）。

**M-3　NanoWSD 按对端声明的帧长先分配内存，局域网内任何主机都能让主机 App 内存溢出；这个库已约 10 年未发布**

- **位置**：`TerminalTopologyServer.kt:189-213`。第 199–200 行的 64 KiB 检查，发生在库已经分配内存并解码之后。
- **依据**（官方 tag 源码逐字）：
  - 帧长只做一项检查：`_payloadLength > Integer.MAX_VALUE`。
  - `readPayload` 直接执行 `this.payload = new byte[this._payloadLength];`。
  - 分片消息的累积没有上限。握手不鉴权。每个连接开一个线程，线程数也没有上限。
  - 维护状态：Maven Central 上 2.3.1 就是最新版，最后更新于 2016-08-12（子 agent 查证）。
- **影响（推论）**：
  - 能连到 43172 端口的主机，发一个声明约 2GB 的帧头，就会在连接线程上触发 OutOfMemoryError。
  - 库和 ClientHandler 都不捕获 Error，进程可能被终止。
  - 门店局域网（包括顾客 Wi-Fi 与主机同网段的情况）是现实的触发面。
- **整改**：2.3.1 版本内无法在分配内存之前限制帧长。处置方式需要 Dexter 裁决（DEXTER_DECISION，见 §5 D-1）：
  - 换用一个能在分配前限制帧长和消息长度、且仍在维护的 WebSocket 服务端实现；
  - 或在仓内维护一个最小 fork。
  - 过渡期可以在连接边界兜住 Throwable，让单个超长帧只断开该连接。这对分片累积无效。
  - 验收：声明长度超过 64 KiB 的单帧、以及累计超过 64 KiB 的分片消息，都在分配内存之前被拒绝；进程和已连接的对端不受影响。
- **证据**：库行为 CONFIRMED；崩溃结果 UNVERIFIED（U-4）。

### S 级（18 条）

**UI 渲染与交互**

**S-1　整个 TER 没有 Error Boundary，渲染期异常会让整个显示面空白，设计好的失败页不会出现**

- **位置**：`application/base/android/src/components/AndroidTerminalApp.tsx:67-76`。这里的 try/catch 只接得住 `renderSurface` 同步抛出的异常，接不住子树渲染时的异常。
- **仓内事实**：全 TER 中 `componentDidCatch` 与 `getDerivedStateFromError` 的出现次数都是 0。渲染期会主动 throw 的地方有多处，例如 `RenderContext.ts:38,44`、`SurfaceContext.ts:20`，以及经 `useUiStateSelector` 执行的 selector。
- **依据**：
  - react.dev 的 Error Boundary 说明；
  - RN 0.86.3 渲染器遇到未捕获的渲染错误时，调用 `handleException(error, false)` 并卸载整棵根（ReactFabric-dev.js:15966-15981）。
- **整改**：~~在每个 surface 根外包一个类组件 Error Boundary，降级到现有的 `renderFailurePage`。~~
  - **更正（2026-09-28）**：这条建议只做 surface 级、并提示重启终端，违背了已生效的 T-3 裁定（boundary 不能只有 root，要做到 screen 级，重新挂载 screen 而不是重启 App）；而且 Web 端没有 `renderFailurePage`。在 screen 级边界之外再加一层外层兜底，并不违背 T-3。
  - 以需求 v2 的 TP-B1 为准：screen 级 `react-error-boundary`，出错时显示 `SystemFailureNotice`，用户点按后重新挂载。验收：注入一个渲染期抛错的 part，Web 和设备上都显示失败页，并有错误日志。

**S-2　InputProvider 在渲染期读 ref 作为状态来源，靠计数器强制刷新**

- **位置**：`ui/base/input/src/components/InputProvider.tsx:57-67,212-246`（Claude 已复核）。
- **依据**：react.dev 的 useRef 页要求渲染期不读写 `ref.current`（惰性初始化除外），并要求渲染是幂等的。
- **影响**：当前是同步渲染，未开启 StrictMode、transition 或 Suspense，所以还没有故障。一旦启用这些特性，键盘显示状态会与真实焦点对不上。
- **整改**：把键盘状态收进 useReducer，或改为外部 store 加 useSyncExternalStore（render 包已有这个模式）；ref 只在事件处理器和 effect 里使用。

**S-3　关闭弹层后恢复原输入框焦点，在 Android 和 Web 两端都不生效**

- **位置**：`ui/base/render/src/components/LayerStack.tsx:155-168`。第 159 行只保存了拆下来的方法 `{focus: focused.focus}`，第 168 行再调用它。
- **依据**（Claude 已复核 RN 0.86.3 源码）：
  - `ReactNativeElement.focus()` 先用 `TextInputState.isTextInput(this)` 判断，此时的 this 是包装对象，所以判断为假；
  - 走到 `enableImperativeFocus`，它默认是 false（`ReactNativeFeatureFlags.js:331`），结果是空操作；
  - RNW 0.21.2 没有 `currentlyFocusedInput`；
  - 现有单测用 `{focus: vi.fn()}` 作桩，发现不了这个问题。
- **整改**：由 input 控制器统一记录并恢复活动字段；或者保存实例本身、以实例调用 focus（Web 端需改用 `currentlyFocusedField`）。验收：在 Web 和设备上各做一次“聚焦 → 开层 → 关层”，关层后原字段重新获得焦点。

**S-4　开层时把焦点移入顶层，只在 Web 上生效；Android 上顶层不可聚焦**

- **位置**：`LayerStack.tsx:164,237-239`。
- **依据**：RN `View.js:82-83` 中 `focusable = !tabIndex`，而代码给顶层传了 `tabIndex=-1`，把 focusable 覆盖成 false；`accessibilityViewIsModal` 只在 iOS 上有效。
- **影响**：
  - 按 TR-16 在 Web 先验时，得到的焦点状态与真机相反。
  - 真机开层期间，背景输入框仍持有原生焦点，外接键盘或扫码枪的输入可能落进被遮住的输入框（推论，U-5）。
- **整改**：
  - 去掉与 tabIndex 冲突的 focusable；
  - 开层（suspend）时显式 blur 当前原生输入框；
  - Android 上是否需要模态语义，见 §5 D-6。

**S-5　AdminLauncher 只在自身 onLayout 时测量窗口坐标，画布缩放后坐标会过期**

- **位置**：`ui/base/admin-shell/src/components/AdminLauncher.tsx:107-119,191,241`。
- **依据**：RN 的 transform 不改变布局（官方 transforms 页），缩放或祖先位移都不会触发子组件的 onLayout；而画布缩放恰好是用 transform 实现的（`SurfaceHostController.tsx:129-135`）。
- **整改**：在手势发生时现场测量；或者在宿主几何变化时重新测量。

**原生宿主与拓扑传输**

**S-6　原生加载模块用同步 Function 阻塞 JS 线程，最长等主线程 2 秒；超时会被放大成启动失败页**

- **位置**：`application/base/android/.../TerminalNativeLoadingModule.kt:10-26`，`TerminalNativeLoadingRegistry.kt:28,316`（Claude 已复核）。
- **依据**：
  - Expo Modules 文档说明，Function 在调用线程上同步执行（`SyncFunctionComponent.kt:21-29`）；
  - 57.0.14 提供 `AsyncFunction(...).runOnQueue(Queues.MAIN)`（`BaseAsyncFunctionComponent.kt:8-23`）；
  - 生命周期分发没有异常隔离（`ModuleRegistry.kt:95-103`）。
- **影响**：
  - 主线程短暂繁忙就会触发超时，ScreenReadyBoundary 随即 `setFailure`。
  - OnCreate/OnDestroy 如果超时抛错，会中断其他模块的生命周期回调。
- **整改**：beginHide/releaseHide 改用 `AsyncFunction(...).runOnQueue(Queues.MAIN)`，JS 侧已经是 await，无需改；OnCreate/OnDestroy 只投递到主线程，不等待结果。

**S-7　MainActivity 依赖 expo-splash-screen 未写入文档的原生成员**

- **位置**：两个 App 的 `MainActivity.kt:24,26,31`：`preventAutoHideCalled = true`，接着 `hide()`（Claude 已复核）。
- **依据**：官方只提供 JS API，config plugin 只生成 `registerOnActivity(this)`。57.0.9 的 `hide()` 只是把一个进程级字段置为 false。
- **影响**：启动画面的时序建立在未承诺的语义上，升级时可能不经预告就变化。第 24 行紧跟在 hide 之前，已无效果。
- **整改**：
  - 把对这两个成员的依赖收敛到一处，并登记为升级复核点；
  - 或改走有文档的路径（候选：直接用 AndroidX `installSplashScreen()`，需实施方验证）；
  - 删除无效的第 24 行与自相矛盾的注释。

**S-8　“整个应用只有一份 React”依赖 Expo CLI 在 workspace 里的隐式默认值**

- **位置**：两个 App 的 app.json 都没有 `experiments` 字段；`application/base/android/config/index.cjs:67-90` 把 css-interop 固定到仓库根的那一份。
- **仓内事实**（Claude 已复核）：
  - 仓库根的 react 是 19.2.5，TER 的是 19.2.3。
  - 根目录那份 css-interop 的 `require("react")` 按层级查找，会先命中 19.2.5。
  - 目前是 @expo/cli 57.0.20 在 workspace 中默认开启的“sticky 解析”（`instantiateMetro.js:209`）把它统一到了 19.2.3。
- **影响（推论）**：这个默认值一旦改变，Android 包里就会出现两份 React，运行期报 Invalid hook call。测试侧的 `tools/terminal-shared/react-native-vitest-entry.ts` 也会解析到根目录那份 react，所以不要在测试桩里用 hooks。
- **整改**：在两个 App 的 app.json 里显式写 `"experiments": {"autolinkingModuleResolution": true}`。这等于把现状写明，不改变任何行为。

**S-9　拓扑状态解压没有设输出上限，对端可以用压缩炸弹制造巨量内存分配**

- **位置**：`kernel/base/transport/src/foundations/createTopologyStateTransfer.ts:300`，调用的是 `unzlibSync(encoded)`（Claude 已复核）。
- **依据**：fflate 0.8.3 的 out 选项可以预先给出输出缓冲区，超出部分会被截断（`browser.d.ts:46-49`）；不给时按倍数扩容（`browser.js:227-238`）。
- **整改**：改为 `unzlibSync(encoded, {out: new Uint8Array(chunk.rawBytes)})`，保留后面的长度与校验和检查。

**S-10　拓扑服务端两把锁的加锁顺序相反，可能死锁**

- **位置**：
  - 连接线程：`TerminalTopologyServer.kt:160-169`，在持有 peerLock 时 `publishConnection`，而后者会去拿 registry 的 lock；
  - JS 线程：`TerminalTopologyHostRegistry.kt:112-118,186-188`，持有 lock 调 `sendFrame`，而后者要拿 peerLock。
  - Claude 已复核两条路径。
- **影响（推论）**：第二个连接被拒绝的同时，如果恰好有 sendFrame、stop 等调用，两个线程会永久互相等待。
- **整改**：onOpen 在锁内只做判定和状态变更，发送、关闭、发布都移到锁外。

**S-11　MMKV 加密 key 被截断到 16 字节，设备身份实际上没有参与加密**

- **位置**：`adapter/android/persist-kv/.../TerminalPersistKvModule.kt:175,210-212,302`。key 是 31 字节的前缀拼上 ANDROID_ID。
- **依据**（Claude 按 MMKV 官方 tag v2.4.2 核对）：`AESCrypt.cpp` 中 `memcpy(m_key, key, (keyLength > maxKeyLen) ? maxKeyLen : keyLength)`；三参数的 `mmkvWithID` 用 AES-128，最大 16 字节。
- **影响**：
  - 有效 key 在所有设备上都恒为 `catering-v2s.per`，“身份不一致时拒绝解密”的设计永远不会触发。
  - App 又设了 `allowBackup="true"`，备份恢复到新设备后会直接解开（备份范围未核）。
  - 如果 persistSecure 将来承载激活凭据之类的数据，应升为 M。
- **整改**：让设备身份落在有效长度之内（16 字节，或 aes256 重载的 32 字节）。验收：两个不同的 ANDROID_ID 得到不同的有效 key。

**S-12　选副屏时没有按 presentation 类别筛选**

- **位置**：`adapter/android/dual-screen/.../TerminalDualScreenActivityHandler.kt:119-121,632,710-714`；`adapter/android/device/.../TerminalDeviceModule.kt:74-77,360`。
- **依据**：Presentation 的官方用法是 `getDisplays(DISPLAY_CATEGORY_PRESENTATION)`；如果选中的显示没有 FLAG_PRESENTATION，`show()` 会抛异常（依据取自 AOSP main 分支，部分证实）。
- **影响**：存在虚拟显示、投屏或录屏时，可能选错显示、显示数量被放大，甚至直接放弃副屏。
- **整改**：两处都改为按 presentation 类别选择。

**S-13　targetSdk 36 下，Android 16 在大屏（sw≥600dp）上会忽略方向锁**

- **位置**：`TerminalDualScreenActivityHandler.kt:40,69-73,549`。
- **依据**：Android 16 行为变更页说明，此时忽略 `setRequestedOrientation()`，临时 opt-out 到 targetSdk 37 失效。
- **影响**：固定横屏的 POS 硬件不受影响；大屏设备竖放时，横屏界面会以竖屏窗口运行。
- **整改**：需先裁定支持范围，见 §5 D-5。

**测试与工具链**

**S-14　react-test-renderer 已弃用，TER 全部 UI 单测都建在它上面**

- **位置**：29 个测试文件、10 个包；共 67 处 create、654 处 act。
- **依据**：19.2.3 包内 README 第一行即为 `(DEPRECATED)`（Claude 已复核），说明它不再维护、计划移除。每次 create 都会输出弃用告警，并强制使用并发根。
- **整改**：迁移路径见 §5 D-2。在裁决之前，先冻结新增用法。

**S-15　27 个 vitest 配置都把 `__DEV__` 写死为 false，`*.dev.test` 里的 DEV 断言在唯一测试入口下永不执行**

- **位置**：各包 `vitest.config.ts` 的 `define: {__DEV__: 'false'}`。例如 `kernel/base/platform-ports/test/startupDiagnostics.dev.test.ts:38,47` 的 `it.skipIf(!__DEV__)` 永远被跳过。Claude 已复核：27/27 个配置如此，仓内没有任何地方设为 true。
- **影响**：DEV 启动诊断回归时，单测仍然全绿。
- **整改**：见 §5 D-3。

**S-16　两个门测试读取 TypeScript 的内部字段 `parseDiagnostics`**

- **位置**：两个 integration 的 `test/publicSurface.test.ts:10,46-47`。
- **依据**：6.0.3 的公开类型声明中该字段出现 0 次（Claude 已复核）；对应的公开接口是 `Program.getSyntacticDiagnostics()`。
- **整改**：改用公开接口。验收：对故意写错语法的样例，门仍然判红。

**S-17　门工具使用 TS 6.0 已弃用的 `baseUrl`，而且从不读取诊断**

- **位置**：`tools/terminal-shared/typescript-analysis.mjs:137`（Claude 已复核），该文件里读取诊断的调用为 0 处。
- **影响**：弃用提示被静默吞掉。TS 7 之后 paths 的解析基准会改变，可能静默改变 workspace 包的解析结果（推论）。
- **整改**：去掉 baseUrl，paths 改用绝对路径。验收：`getOptionsDiagnostics()` 为空，且解析结果与改前一致。

**S-18　（顺带发现，与第三方用法无关）拓扑服务端的 Kotlin 单测编译不过，也没有任何门在跑它**

- **位置**：`application/base/android/android/src/test/.../TerminalTopologyServerTest.kt:44-53`。它构造 `HostConfig` 时缺少必填的 `moduleName`，而 `TerminalTopologyHostRegistry.kt:17-27` 中该参数没有默认值（Claude 已复核）。
- **仓内事实**：唯一跑 Kotlin 单测的门是 `tools/terminal-android-dual-screen/check-behavior.mjs:17`，只覆盖 dual-screen 适配器。
- **影响**：M-2、M-3、S-10 所在的模块，实际上没有可运行的单测。这与 2026-09-25 发现的 transport 夹具漂移同属一族：moduleName 字段加进来时，只改了 JS 侧的测试。
- **整改**：补上参数；并把 application-base-android 的 Kotlin 单测接入某个会实际运行的门。

### N 级（37 条，按类归并）

**React 与状态（7）**
- **N-1** 渲染期写 ref：`useInputField.ts:52-53,70-72`、`InputSurfaceFrame.tsx:519-520`、`AdminLayerFrame.tsx:31-34` 等。
- **N-2** 渲染期副作用：
  - `integrationAssembly.tsx:279-305` 在渲染期置就绪标志并写日志；
  - `resolvePart` 在渲染期上报诊断；
  - `useAdminSectionBinding.ts:50-79` 在生产环境每次渲染打两条日志；
  - `useAdminLogin.ts:78` 在渲染期调用 `new Date()`。
  - 注：子 agent 原先列出的 slots.tsx trace 已在 12:24 版中删除，不再计入。
- **N-3** forwardRef 与 `<Context.Provider>` 将在未来的 React 版本弃用：`slots.tsx:58,72,79,83,87`、`PrimitiveScrollView.tsx:28`，另有约 10 处 `.Provider`。新代码直接用 ref prop 和 `<Context value>`。
- **N-4** `AdminLayerFrame.tsx:40-75` 只在 effect cleanup 里下发“关闭层”命令，一旦开启 StrictMode，层会被自动关闭。
- **N-5** `testExpoApp.tsx:769-809` 用 useMemo 创建有状态的资源，并把它当作启动 effect 的依赖；应改用 `useState(() => create())`。
- **N-6** `selectRequestExecutionView.ts:175-186` 以 requestId（原始值）作参数，Reselect 5 的 weakMapMemoize 会强持有缓存，缓存无界增长。Claude 已复核 `reselect.development.cjs:602-613`。
- **N-7** `createStateStore.ts:57-61` 按 environmentMode 设置检查开关，而 RTK 只在 `NODE_ENV!=='production'` 时挂载这两项检查（`redux-toolkit.modern.mjs:436`），release 包里这个开关不起作用，应写清两层门控的关系。

**RN 与 Web（5）**
- **N-8** measureLayout 在 Web 上从不调用失败回调，在原生上遇到卸载的节点也不调用。三个 `*-measurement-failed` 分支在 Web 上走不到；看门狗应在发起测量之前就启动。
- **N-9** `types.ts:89-90` 的注释称 `onMomentumScrollEnd` 是“统一终止信号”，但官方只定义它为惯性滚动结束，RNW 也从不触发。应按实际语义改写注释。
- **N-10** `accessibilityElementsHidden`、`importantForAccessibility` 在 Web 上无效（`InputKeyboard.tsx:86-87`、`InputSurfaceFrame.tsx:910-911`），应改用 `aria-hidden`。
- **N-11** `PrimitiveData.tsx` 在 VirtualizedList 之外又自建了一层内容窗口（`windowSize={1}`），行数一多会出现空白。目前还没有生产调用方。
- **N-12** 生产代码里有为迁就测试桩写的可选链（`Platform?.OS` 等），而 vitest 桩没有导出 Platform，导致 Web 分支没有单测覆盖。应在桩里补上 Platform，再删掉这些可选链。

**Expo（7）**
- **N-13** `nativeLoadingCapability.ts:5-9,39-45` 的 JS splash 调用在 Android 上是空操作，注释描述的顺序约束也不存在；兼容别名 `hideAsync` 应改为 `hide`。
- **N-14** `androidDevice.ts:163`、`surfaceHost.ts:268`、`nativeTopology.ts:388` 仍在用已弃用的 `LegacyEventEmitter`，应直接调用模块自身的 `addListener`。
- **N-15** dual-screen 替换了 ReactActivityDelegate，之后 Expo wrapper 除 onCreate 以外的生命周期转发都被绕过。目前没有影响，需在 README 或详设里登记这条约束。
- **N-16** `TerminalNativeLoadingModule` 的 OnCreate/OnDestroy 会随 React 实例重建（包括 reload），与 registry 注释写的“独立于 JS 运行时”相矛盾。
- **N-17** 两个 integration 的 `metro.config.js:12-15,27-30` 里 `extraNodeModules` 起不到固定 css-interop 的作用（metro-resolver 先按层级查找）。另外，这两个文件在 `"type": "module"` 的包里写的是 CommonJS，靠 Expo 加载器回退才能运行。应删除无效配置，文件改名为 `.cjs`。
- **N-18** `TerminalAppControlModule.kt:11-27` 丢弃了 `reactHost.reload()` 返回的任务，reload 失败时没有任何日志。
- **N-19** worklets 的 Babel 插件由 babel-preset-expo 和 nativewind/babel 各注册一次。这是两套官方配置叠加的结果，TER 本身没有 worklet 代码。在拿到运行证据之前不要改。

**样式与图形（4）**
- **N-20** `cssInterop.native.ts:1`、`nativeVariable.native.ts:1` 深度导入 css-interop 的 `dist` 路径，并使用文档标注为 UNSTABLE 的 API。应改为从 `nativewind` 公开入口导入。
- **N-21** `slots.tsx:151,169-172` 的 SVG 取色依赖未承诺的路径，Web 侧的 cssInterop 还是空实现，调用方一传 `StyleSheet.create` 的样式就会丢色。
- **N-22** `whitespace-nowrap` 在原生上会被丢弃（css-interop 0.2.6 不支持 white-space），应在原生 Text 上用 `numberOfLines={1}`。
- **N-23** withNativeWind 4.2.6 的产物依赖进程 cwd：content 路径与 setupTypeScript 都以 cwd 为基准。应写明“cwd 必须是 App 目录”这一前提；两份 `nativewind-env.d.ts` 的“由 NativeWind 生成”注释与事实不符。

**原生 Android（5）**
- **N-24** 拓扑 close 事件的 reason 依赖对端回显和时序，只影响诊断的准确性。
- **N-25** MMKV 的 initialize 标志是实例级的，reload 后会重复初始化；应改为进程级一次性标志。
- **N-26** `TerminalDeviceModule.kt:190-202` 只收系统广播，却显式传了 `RECEIVER_EXPORTED`；官方建议这种情况不传 flag。
- **N-27** 两个 App 的 `styles.xml:6-7` 中系统栏颜色属性在 Android 15+ 已无效。
- **N-28** `TerminalDeviceModule.kt:345-347` 中 `getMetrics` 的结果没有被使用，是死调用。

**测试与工具（6）**
- **N-29** dual-screen 包里的 jest、jest-expo、@types/jest，以及三份 `internal/module_scripts`，都没有被使用。
- **N-30** TER 不跑 ESLint 和 Prettier，三个 adapter 里的 eslint/prettier 依赖是多余的，根配置里 TER 那一段也是死配置。是否要纳入，见 §5 D-4。
- **N-31** 10 份手写的 `react-test-renderer.d.ts` 与真实 API 不一致，测试只能靠 `as unknown as` 强转。
- **N-32** 15 个测试文件不在任何 tsconfig 覆盖范围内：admin-shell、transport、三个 adapter、application/base/android。
- **N-33** `roleAndRoute.test.ts:203` 的 `vi.runAllTicks()` 在默认伪造范围下是空操作。
- **N-34** `primitives.test.tsx:222,239`、`testExpoApp.test.tsx:53-54` 的全局替身只在用例成功时才恢复，失败时会污染后续用例。

**依赖声明卫生（3）**
- **N-35** 声明了但没用到：
  - expo-status-bar；
  - androidx core-ktx（原生源码中没有任何 `import androidx.`）；
  - 两个 App 冗余声明了 nanohttpd；
  - TER 根冗余声明了 use-sync-external-store；
  - 两个 App 声明了 SYSTEM_ALERT_WINDOW、VIBRATE 和存储权限，但原生代码未使用（JS 与第三方库是否使用未核）。
- **N-36** 隐式或幽灵依赖：
  - integration 包没有声明 react-native-svg；
  - dual-screen 用到的 appcompat 靠 react-android 传递；
  - 部分包的 `@types/node` 靠依赖提升；
  - 根 `eslint.config.mjs` 导入了 typescript-eslint，但根 package.json 没有声明。
- **N-37** 版本或副本分叉：
  - vitest：两个包装的是 4.1.11，其余是 4.1.10；
  - vite：根 8.0.0，apps/terminal 8.1.5；
  - react-native-css-interop、babel-preset-expo 各有两份物理副本（版本相同）；
  - `NODE_PATH` 加 `Module._initPaths()` 依赖 Node 的私有 API。

## 4. 整改计划（建议分批，由 Dexter 决定）

**批 A：立即处理 M 级与安全问题**
- 内容：M-1、M-2、M-3（按 D-1 的裁决），以及 S-9、S-10、S-18。
- 验证顺序：
  - M-1：先比对两套主题的颜色键，再在设备上截图对照。
  - M-2、M-3、S-9、S-10：都属于 adapter 或原生行为，用设备或模拟器的聚焦实验加日志验证，并补上可运行的 Kotlin 单测（S-18）。

**批 B：正确性与平台差异（S 级）**
- 内容：S-1 至 S-8、S-11、S-12。S-13 按 D-5 的裁决处理。
- 验证顺序：
  - 不涉及 adapter 的 S-1 至 S-5，按 TR-16 先在 integration 的 Expo Web 上跑同一份场景清单，再上设备，两端对照。
  - S-6、S-7、S-11、S-12 属于原生，需要设备日志。

**批 C：测试与工具链**
- 内容：S-14 至 S-17（按 D-2、D-3、D-4 的裁决），以及 N-29 至 N-34。
- 验证：新鲜运行 typecheck 与 terminal 的 verify:static，确认覆盖了全部测试文件。

**批 D：N 级清理**
- 内容：其余 N 条，可以随各批次顺手处理，也可以单独成批。

**每批的共同要求**
- 所有改动都按第三方规范执行：在详设里记录实际解析版本与经版本核对的官方来源。
- 官方文档只证明库本身的约定。本仓的装配与运行是否正确，要各自拿出证据，不能用文档代替。

## 5. 需要 Dexter 裁决的事项

- **D-1（M-3）NanoWSD 帧长问题怎么处置？**
  - 选项：a. 换成仍在维护、能在分配前限长的实现；b. 在仓内维护最小 fork；c. 接受风险，只用于可信局域网。
  - 推荐 a。这个库已约 10 年没有发布，M-2 也会一并得到处理。选型需另按第三方规范核验。
- **D-2（S-14）react-test-renderer 迁移路径？**
  - 选项：a. 迁到 @testing-library/react-native。官方推荐，但它与 Vitest 加 TER 的 RN 桩这种组合没有官方验证，需要先做单包 POC。b. 冻结现状，React 升级前再迁。
  - 推荐：先冻结新增用法并做单包 POC；POC 通过后，在一个批次里整体迁完。
- **D-3（S-15）DEV 启动诊断要不要自动化覆盖？**
  - 选项：a. 要覆盖，例如单独给 dev 用例配 `__DEV__: 'true'`；b. 不覆盖，删除 DEV 分支和跳过的用例。
  - 推荐 a。启动诊断是 AGENTS.md 规定的可观测性硬约束。
- **D-4（N-30）TER 要不要纳入 lint 与 format？**
  - 推荐纳入。仓库根已有的 eslint-plugin-react-hooks 7 带有 refs/purity 类规则，按其定位能自动抓住 S-2、N-1、N-2 这类问题（该插件在 TER 上的实际效果尚未核实）。
- **D-5（S-13）大屏设备竖放是否属于支持范围？**
  - 如果不支持，就在设备规格里写明，只用于固定横屏的 POS 硬件；如果支持，laptop 界面要能容忍竖屏窗口。
- **D-6（S-4）开层时，Android 上要不要焦点陷阱或模态无障碍语义？**
- **D-7** TextInput 长按时会弹出系统的选择和粘贴菜单，粘贴会绕过虚拟键盘。是否允许？
- **D-8** 拓扑主机能一直可用，前提是 App 始终在前台（没有前台服务）。这个产品假设是否成立？

**已裁决、关闭**：Android 上按键会播放系统触摸音，Dexter 2026-09-28 裁定跟随系统设置，不另做按键音。

### Dexter 裁决（2026-09-28，原话）

```text
D-1，c
D-2，a
D-3，a
D-4，必须纳入
D-5，不支持大屏竖屏
D-6，不要
D-7，不允许
D-8，APP会一直在前台，成立
```

**对各条发现的影响**
- **M-3**：接受风险。拓扑端口只用于可信的门店局域网，不换库、不 fork，也不做过渡兜底。状态记为 `ACCEPTED_RISK`。这条信任假设需要写进 decision。
- **M-2**：不受 D-1 影响，仍要修。这是库默认值导致的功能错误，与信任假设无关。
- **S-9**：与 M-3 属于同一信任假设。修复只需一行，而且能挡住数据损坏的情况，建议照做。
- **S-14**：迁移到 @testing-library/react-native。先做单包 POC，POC 不通过就停下来报告。
- **S-15**：DEV 分支必须在唯一测试入口下被执行并通过。
- **N-30**：TER 必须纳入 lint 与 format。
- **S-13**：关闭，不改代码。落档时只用 Dexter 的原话“不支持大屏竖屏”，含义是 sw≥600dp 的设备竖放不在支持范围内；mobile 的竖屏形态不受影响。
  - 更正（2026-09-28）：此处原先写成“只用于固定横屏的 POS 硬件”，那是选项说明里的文字，不是 Dexter 的原话，而且会否定 mobile 的竖屏形态。
- **S-3 / S-4**：不做焦点陷阱，也不做模态无障碍语义。开层与关层的焦点行为必须在两端一致（TR-16）。现有代码在 Android 上不生效的焦点“移入与恢复”，要么两端都真正生效，要么两端都删除，由详设论证选哪种。
- **D-7**：新增要求。输入框不得出现系统的选择与粘贴菜单，也不得通过粘贴绕过虚拟键盘写入。实现前须按第三方规范，核实 RN 0.86.3 与 RNW 0.21.2 对此的实际支持；Web 端做不到的，要写明差异。
- **D-8**：成立。拓扑主机不需要前台服务。未决项 D-8 关闭。

## 6. 需要运行证据或构建报告的未决项

- **U-1**：两个 App 的 Gradle 依赖报告（releaseRuntimeClasspath），用来确认原生库的实际解析版本、ExpoModulesPackageList 的内容，以及构建日志里的 SDK 数值。
- **U-2（M-1）**：设备上的截图，或 Android 构建产物中是否含有 `.bg-surface-inset` 等类名；另需确认各启动入口的实际 cwd。
- **U-3（M-2）**：设备日志中，空闲超过 5–10 秒后拓扑连接是否被关闭。
- **U-4（M-3、S-9）**：在隔离的模拟器上，用超长帧头和压缩炸弹做聚焦实验，看是抛异常还是进程被终止。
- **U-5（S-4）**：真机开层期间，外接键盘或扫码枪的输入落在哪里。
- **U-6（S-6）**：冷启动和 resetRuntime 时，`TER-Splash` 的等待时长，以及是否出现 TimeoutException。
- **U-7（S-8）**：Metro 模块清单中是否只有一份 react。
- **U-8（N-19）**：一个含 worklet 的文件的 Babel 产物，看是否被处理了两次。

## 7. 取证说明与复核记录

**Claude 亲自复核过的承重结论**

读源码或逐字核对了官方 tag：
- M-1：两套主题颜色键的实际差异，以及 tokens 中的用法；
- M-2、M-3：NanoHTTPD 与 NanoWSD 官方 tag `nanohttpd-project-2.3.1` 源码逐字；
- S-1：没有 Error Boundary；
- S-2：InputProvider 在渲染期读 ref；
- S-3：RN 0.86.3 的 focus 分派逻辑与 feature flag 默认值；
- S-6：同步 Function 与 2 秒等待；
- S-7：MainActivity 的 splash 写法；
- S-8：app.json 中没有 experiments，以及 react 19.2.5 与 19.2.3 两份并存；
- S-9：解压调用；
- S-10：两条锁路径；
- S-11：MMKV 官方 tag v2.4.2 的截断逻辑；
- S-14 至 S-17：README、27 个配置、内部字段与 baseUrl；
- S-18：参数缺失与唯一的 Kotlin 单测门；
- N-6、N-7：Reselect 与 RTK 源码。

**由子 agent 取证、Claude 未逐条复核的条目**

其余 S 条与 N 条。子 agent 给出了精确版本源码的行号或官方页面出处，可以按行号复核。子 agent 引用的官方页面，凡是不能证明与安装版本匹配的，都已降为佐证。

**已剔除或修正的内容**
- 子 agent 列出的 `slots.tsx` 调试 trace，12:24 版中已不存在，已剔除。
- `slots.tsx` 的行号已按当前字节更新。
- 三组都提到的“React 双实例”，合并为 S-8。
- css-interop 固定无效，合并为 N-17。
- worklets 插件重复注册，合并为 N-19。

**局限**
- 原生库只有声明版本，未生成 Gradle 解析报告（U-1）。
- Android 平台的部分依据（如 Presentation）取自 AOSP main 分支，不是 API 36 的精确版本。
- 本报告不包含任何运行、设备或视觉证据，不能替代 TR-16 规定的两端对照。

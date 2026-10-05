# TER 统一 UI 自动化包 · 需求讨论稿

```text
DOC_TYPE=需求讨论稿（讨论项已全部裁定；不是正式需求、详设或实施授权）
DATE=2026-10-05
AUTHOR=Claude
INPUT=Dexter 2026-10-05 会话原话（§1）；apps/terminal 当前源码与规范；newPOSv1 POC 的 ui-automation-runtime；
  doc/review/platform/2026-08-28-newposv1-package-analysis-claude/u-05、u-06；第三方官方资料（2026-10-05 实查）
SESSION=续接会话（非 fresh v2s-rooted）；仓内事实为本会话读源码与 grep 所得，第三方事实为本会话读官方文档、npm 与源码所得
AUTHORITY=只用于讨论。不授权新建包、改源码、改规范、新增依赖、构建、设备或任何运行
```

## 1. Dexter 原话（逐字）

> 我现在有个问题希望和你讨论一下，就是现在TER在原生端跑自动化测试很麻烦，1，定位组件很麻烦。2，触发组件动作很麻烦。3，state现在是黑盒，只能靠打日志验证数据准确性。之前POC的过程中newPOSv1工程，有做过一个简易的ui automation的包，可以读state，但是只能发command，不能实际触发UI。请你仔细读一下我当前TER的包结果，如果我希望自建一个新的ui automation包，以统一的逻辑，既可以满足intergration包的expo web自动化测试，又可以满足application包的原生Android测试，既可以定位空间查询控件状态触发控件动作，又可以读取redux state的结果，用自研的自动化脚本来跑完整自动化用户旅途测试。有可行性么？请生成一个需求讨论稿，我们先讨论

**能力与使用场景（Dexter 已裁定）：**

> 1，我希望这个automation包是个超级全能包，可以发command，可以访问full state，可以访问任何包的selector，没有任何能力限制。2，不限制automation包的使用场景，在package.json中增加开关及连接服务器参数，只要打开就能用，不管是生产包还是调试包。3，我希望本地测试脚本的访问与控制能力能发挥automation包的能力。

**对上一条的修正与细化（Dexter 已裁定）：**

> 1，修改TR-08的要求，对automation是例外。所有代码都要包含automation包，只在package.json中做开关。2、3，我说错了，automation不需要直接访问full state，全部通过selector访问数据，每个包都需要在runtime中登记selector。4，不需要automation包执行动态脚本，automation需要提供基础能力，比如外部的测试脚本要订阅TDC的连接状态，就要传连接状态的selector和参数给automation包，收到后就执行订阅，每次数据变化就将数据通过WS传出来。再比如腕部的测试脚本要执行command，将参数给automation包，收到后就发送command并订阅requestID，讲command执行结果通过WS传出来，等等

## 2. 结论先行

**可行。** 发 command、按 selector 订阅数据、把结果经 WS 推出去，这些现有 runtime 已有的接口足以支撑（§3.2）。真正要解决的是四件事：

1. 在 Android 上把控件的逻辑位置换算成真实屏幕像素，包括 surface 的非等比缩放和副屏 `Presentation`。
2. 把控件注册放在 `ui/base/primitives` 统一完成，业务组件零感知（§4-C）。
3. 每个包在 runtime 中登记自己的 selector。现有 runtime 只登记 command 名、slice 名和 actor，不登记 selector（§5.3）。
4. 按 Dexter 的裁定修订 TR-08：automation 是例外，所有构建都包含 automation 包，只由 package.json 开关决定是否启用（§3.3）。

推荐形态（§5）：

- **App 内一个 agent**：Web 与 Android 共用同一份 TS 代码，只提供基础能力，不执行动态脚本。它负责：
  - 控件：维护注册表，记录 testID、角色、状态、所在 surface，按需测量 bounds，执行语义动作；
  - 数据：只通过已登记的 selector 读取。按“selector 名 + 参数”订阅，数据每次变化都经 WS 推出；
  - command：按“command 名 + 参数”分发，再订阅这次的 requestId，把执行进展和结果经 WS 推出。
- **一个主机侧 driver**：Node 写的脚本库，完整暴露 agent 的全部基础能力，旅途脚本只写一份。
- **两端各自的真实输入通道**：
  - Web 用 Playwright 点击 DOM；
  - Android 用 `adb shell input -d <displayId> tap x y`，坐标由 agent 给出。
- **统一传输**：App 作为 WebSocket 客户端，连到 package.json 里配置的服务器地址。
  - 本地测试时，Android 经 `adb reverse` 连主机，Web 直接连 localhost；
  - 也可以连局域网或远端的测试服务器。
  - 两端同一协议、同一连接方式，不需要原生 socket 服务。
- **开关**：所有构建都包含 automation 代码。application 的 package.json 中的开关与连接参数决定启动时是否启用、连到哪里。生产包与调试包一视同仁。

这样同一份旅途脚本可以先跑 Expo Web、再跑设备。TR-16 要求的“同一场景清单两端对照”就由结构直接保证，不再靠人工维护两套脚本。

## 3. 当前痛点与仓内事实

### 3.1 现有 runner 的做法与代价

| runner | 行数 | 定位 | 触发 | 读结果 |
|---|---|---|---|---|
| `scripts/test/ter-virtual-keyboard-android.mjs` | 8848 | `uiautomator dump --windows`，正则匹配 `resource-id`（即 testID）与 bounds（`tapResource`，5883 行起） | 取 bounds 中心，`adb shell input -d <id> tap` | 抓 logcat `ReactNativeJS` 结构化日志 |
| `tools/terminal-topology/run-dual-device.mjs` | 4909 | 自带 `NoIdleUiDump.java`（经 `app_process` 运行），绕过标准 dump 等待设备 idle | 坐标点击 | 日志；有 1.5 s / 4 s 固定等待 |
| `tools/terminal-sample2/run-sample{1,2}-frozen-journey.mjs` | 1006 / 840 | dump 重试 5 次、每次间隔 200 ms；250 ms 轮询 | 中心点击 | 全量 `logcat -d` |
| `scripts/test/ter-admin-display-web.mjs` | 2922 | Playwright `getByTestId` | Playwright click | 轮询结构化日志文件，间隔 50–100 ms |

合计约 1.85 万行 runner。共同问题：

- **定位慢且脆**：uiautomator dump 慢、依赖 idle，还要为它写 Java 绕过工具。
- **结果只能从日志反推**：state 对脚本是黑盒（Dexter 原话第 3 点）。
- **Web 与 Android 是两套脚本**，TR-16 的场景对照只能人工维护。
- `doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-execution-retrospective-review-claude.md:28-110` 记录了三次 runner 假失败：ADB 空白解析、APK mtime、`sh -c` 参数切分。

### 3.2 可以直接复用的能力

- **runtime 公开面**（`kernel/base/runtime/src/types/runtime.ts:43-64`）：
  - `getState()` 返回整棵 `StateRoot`；
  - `subscribe(listener)`；
  - `journal` 可列出并订阅 command 与 actor 事件；
  - `dispatchCommand(commandName: string, payload, options)` 支持按名分发，public command 必须带 `requestId`（子 agent 读 `createCommandDispatcher.ts:513`，本人未复读）。
  - store 是 Redux Toolkit 2.12.0。
- **一个 runtime 承载两块屏**：Android 用同一个 ReactHost 承载两个 surface，副屏是 `Presentation`，经 `createSurface` 建立（`adapter/android/dual-screen/README.md`）。`AndroidTerminalApp.tsx` 按 `surfaceForm` 缓存同一个 assembly。因此一个 agent、一条连接就能覆盖单机双屏。
- **primitives 已要求 testID 必填**（`ui/base/primitives/src/types/types.ts:21-23`），README 已预留“未来接入 automation 时由本包统一接入注册”（README 第 13 行附近）。`PrimitiveButton` 已经带 `accessibilityRole` 和 `accessibilityState`（disabled、busy、selected）。
- **testID 在两端都能映射到平台属性**（第三方源码实查）：
  - RNW 0.21.2 把 `testID` 写成 `data-testid`，Playwright `getByTestId` 默认读这个属性；
  - RN 0.86 Android 下非空 testID 会设成 `viewIdResourceName`，并且阻止 Fabric 把该 View 拍平。
- **`input -d <displayId>` 已在现有 runner 中实际使用**（`ter-virtual-keyboard-android.mjs:1121` 等），副屏注入路径有实践基础。
- **cleartext 已允许**：两个 App 的 main `AndroidManifest.xml` 均设 `usesCleartextTraffic="true"`，连接 `adb reverse` 后的 `ws://localhost` 不受默认明文限制。
- **production 产物扫描门已存在但未接线**：`tools/terminal-sample2/check-production-bundle.mjs` 的禁用词已包含 `@catering-v2s/ui-base-automation`、`ui.base.automation`，但只被它自己的测试调用（本会话 grep）。

### 3.3 现有约束（规范正本，本稿不改写）

- **TR-08（按 Dexter 裁定修订）**：
  - 现行原文要求：automation 控制面、诊断 socket、`runtime.getState`、`ui.*` 调试入口在 production 产物里必须不存在，不能只是不启动；门是 production bundle 符号扫描，并且要有红夹具。
  - Dexter 已裁定：automation 是本条的例外。所有构建都包含 automation 包，只在 package.json 中开关。
  - 例外只覆盖 `ui/base/automation-agent` 包及其启动装配（Dexter 已裁定）。其余调试面（例如 `ter-vk://`、`ter-failure://` 这类测试钩子）仍按原规则剔除。
  - `tools/terminal-sample2/check-production-bundle.mjs` 的禁用词里有 `@catering-v2s/ui-base-automation`、`ui.base.automation`、`TerminalAutomation`，须同步移除，否则门与新规则相互矛盾。其中 `@catering-v2s/ui-base-automation` 恰好是新包名 `@catering-v2s/ui-base-automation-agent` 的前缀，不删就会命中。
- **TR-03**：跨包读取只能走 selector。automation 也只通过已登记的 selector 读取数据，不读 full state，因此不需要例外。
- **§4-C**：可寻址注册由控件层统一提供，业务组件零感知。虚拟键盘是已登记的例外，须单独设计寻址方式（虚拟节点加 bounds、专用 command，或两者并存）。
- **TR-16**：非 adapter 功能先过 Expo Web，再在设备上用同一清单对照。
- **TR-R07**：`src/testing/**` 不得进入 production import graph。
- **依赖方向**：以 `tools/terminal-skeleton/check-static.mjs` 与 `apps/terminal/skeleton-graph.ts` 为准。新包要登记，check-static 中硬编码的节点数要同步。
- **platform-ports README:33**：automation 不进端口。
- **ui-state README**：ui-state 不是 automation owner。

### 3.4 testID 现状

- 没有中央构造函数。前缀风格不一致：
  - `ui.base.input:`（点分）；
  - `ui-base-render:`（连字符）；
  - `terminal.admin:`；
  - `application.base.android:loading`；
  - `<appName>:test-expo:surface:PRIMARY|SECONDARY`。
- 两块屏上存在同名 testID，例如 `ui-base-render:surface-root`。现在靠 dump 中的 display id 区分。

## 4. POC（newPOSv1）为什么“只能发 command，不能触发 UI”

位置：`newPOSv1/2-ui/2.1-base/ui-automation-runtime`（约 1,685 行），Android 侧另有 JS dispatcher 与 Kotlin socket server。下面是子 agent 读源码的结论，关键行号见 u-05 分析与 POC 源码：

1. **“按下”其实是直接调回调。** `ui.performAction` 调用控件手工注册的 `onAutomationAction` 闭包，等于直接执行 `onPress()`。没有任何触摸注入，命中测试、遮挡、禁用态、按压反馈都没有被验证到。
2. **只有手工注册的节点。** 没有注册的控件对它不存在。全仓只有 16 个文件调用了 `registerNode`；`semanticId` 52 处，而 `testID` 221 处。
3. **状态是自报的，没有测量。** `visible: true` 硬编码 45 处，基本没有 bounds。
4. **有声明动作却没有 handler。** Web 端把这种情况判成 `ok: true`，形成静默假成功。
5. **Web 与 Android 只是共用协议形状，实现不对等。** Web 端缺 `command.dispatch` 和多个 `wait.*`，落到 METHOD_NOT_FOUND。
6. **实际已在产物中启用。** 装配层把它硬编码为开启，PROD 下以 `internal` 档运行；`command.dispatch` 没有任何门控。这正是 TR-08 的反例。
7. **Android 桥是阻塞式的**：每个请求在 latch 上占一个线程，最长 30 s。

**可以继承的**：state、journal、command 读写和事件化等待的价值（u-05 已裁定保留），以及“注册下沉到控件层”的教训。

**不继承的**：手工注册、自报可见性、把回调调用当成真实点击且不加区分、设备上开监听端口的阻塞式原生桥。

## 5. 推荐形态（候选，待讨论）

### 5.1 三层分工

```text
旅途脚本（只写一份）
  └─ 主机 driver（Node，tools/ 下）：WS 服务端；完整暴露 agent 基础能力；按平台选输入通道
       ├─ 传输：App 内 agent 作为 WS 客户端，连 package.json 配置的地址
       │     本地 Web：ws://localhost:<port>
       │     本地 Android：adb reverse 后同上
       │     局域网 / 远端测试服务器：按配置地址连接（§5.6）
       ├─ 输入：Web → Playwright 在 locator 上 click/type
       │        Android → adb shell input -d <displayId> tap x y（坐标来自 agent）
       └─ 截图/录屏：沿用 Playwright 与 adb screencap
App 内 agent（ui/base/automation-agent，RN/TS，Web 与 Android 同一份；不执行动态脚本）
  ├─ 控件：注册表查询、bounds、语义动作
  ├─ 数据：selector 订阅与读取（只经 runtime 中登记的 selector）
  ├─ command：分发并跟踪 requestId
  └─ 运行信息：已登记的 selector / command / surface / 设备事实
```

### 5.2 基础能力清单

agent 只提供下列基础能力。外部脚本把“名字 + 参数”发给 agent，agent 执行后经 WS 返回结果或持续推送变化。App 内不解释任何脚本。

| 能力 | 脚本发送 | agent 做什么 | 经 WS 返回或推送 |
|---|---|---|---|
| 订阅 selector | selector 名、参数 | 用 `runtime.subscribe` 监听 store；每次变化都重新计算这个 selector，结果变了才推送 | 订阅建立时先推一次当前值；之后每次变化推送新值；可退订；连接断开时自动退订 |
| 读一次 selector | selector 名、参数 | 计算一次 | 当前值 |
| 发 command | command 名、payload，可选 requestId | 没给 requestId 就自动生成；调用 `runtime.dispatchCommand`；同时订阅这次 requestId 的执行进展 | 先返回受理结果；之后推送进展（command 开始、各 actor 运行/完成/出错/超时、command 完成）；最后推送 `CommandDispatchResult` |
| 查控件 | testID、surface、role、文本等条件 | 在注册表中查询 | 匹配节点的 testID、role、label、状态、可见性、所属 surface |
| 取 bounds | 节点 | 调用 `measureInWindow`，按 surface 缩放与像素密度换算 | 目标 display 的物理像素矩形与 displayId |
| 语义动作 | 节点、动作（press、changeText 等）、参数 | 直接调用控件回调 | 执行结果；结果中标明 `semantic` |
| 订阅控件 | 查询条件 | 注册表或节点状态变化时重新匹配 | 匹配结果的变化 |
| 运行信息 | — | 读 runtime 描述 | 模块、已登记的 selector 与 command、surface、设备与 App 身份 |

Dexter 举的两个例子按上表对应：

- **订阅 TDC 连接状态**：脚本发送“订阅 selector：TDC 连接状态 selector + 参数”。agent 收到后建立订阅，先推当前状态，之后每次变化都推送新状态，直到脚本退订或连接断开。
- **执行 command**：脚本发送“command 名 + payload”。agent 分发 command 并订阅这次的 requestId，把执行进展和最终结果推送给脚本。

**command 跟踪可以复用的仓内能力**（本会话读源码）：

- `runtime.dispatchCommand` 返回 `CommandDispatchResult`，内容是 requestId、commandId、聚合状态、actor 结果（`kernel/base/runtime/src/types/execution.ts:40-45`）。
- runtime journal 已有 `command.started`、`command.completed`、`actor.running/completed/error/timed-out`、`actor.late-completed/late-error` 等事件（`types/journal.ts`）。
- runtime 已有按 requestId 查看执行过程的 selector `selectRequestExecutionView`（`selectors/selectRequestExecutionView.ts`），包含本机与 peer 两个来源。
- 因此“订阅 requestId”本身也是一次 selector 订阅，不需要另建跟踪机制。用 journal 还是用这个 selector，由详设定。

**触发控件的两种方式都提供，由脚本选择：**

- **真实输入**：由 driver 完成。Web 用 Playwright 点击，Android 用 `input -d` 在 agent 给出的坐标上点击。能证明命中、遮挡、禁用态与按压态。
- **语义动作**：由 agent 直接调用控件回调。速度快，但不证明 UI。
- 结果中标明走的是 `real` 还是 `semantic`。这只是证据标签，不限制用法。
- 文本输入可以走 TER 虚拟键盘逐键真实点击，也可以用语义动作直接写值。键盘键是 primitives 控件，会自动注册。

### 5.3 每个包在 runtime 中登记 selector（Dexter 已裁定）

- **仓内事实**：`RuntimeModuleDescriptor`（`kernel/base/runtime/src/types/module.ts:96-108`）登记了 `stateSliceNames`、`commandNames`、`actorKeys`，没有 selector。selector 现在只是各包导出的普通函数，例如 runtime 自己的 `selectRequestExecutionView`、`selectRuntimeInstanceMode`。
- **要求**：每个包在模块定义中登记自己的 selector，runtime 提供按名查找。这和 command 按名分发是同一种形态：在哪里定义，就在哪里登记，不会随代码量增长而漏登。
- **automation 只经这个登记表访问数据**，不 import 任何业务包，依赖方向不变。
- 需要详设定的细节：
  - 命名：建议 `<moduleName>.<selectorName>`，与 command 名一致；
  - 参数：有参数的 selector 需要声明参数形状，以便校验 WS 传来的 JSON；
  - 返回值：必须可以 JSON 化，不可序列化的值给出明确错误，不能静默丢字段（K5）；
  - 登记范围：该包对外公开的 selector 全部登记（Dexter 已裁定）；
  - 机械门（Dexter 已裁定）：公开 selector 漏登记时门必须报红，并配红夹具。判定口径（例如“包公开面导出的 `select*` 函数集合 = 该模块登记的 selector 集合”）由详设定，不用关键词匹配冒充语义检查。

### 5.4 统一传输：App 作 WS 客户端

- RN 与浏览器都自带 WebSocket 客户端，**零原生代码**。
- 连接地址来自 package.json 配置：
  - 本地测试时填 `localhost:<port>`，Android 配合 `adb reverse`；
  - 也可以填局域网或远端测试服务器地址，不依赖 adb。
- 主机 driver 只开一个 WS 服务端，按连接区分设备与 App。双机场景就是两条连接，各自带 deviceId。
- App 重启或 JS reload 后自动重连。driver 以新的 runtime 身份识别新会话，旧会话上的订阅随之失效（K4）。
- 推送需要处理的边界：
  - selector 高频变化时，是逐次推送还是合并后推送；
  - 连接慢时消息积压怎么办。
  - 这两点由详设定，原则是不丢最后一次值（K6）。
- 对比两个备选：
  - POC 的做法（Kotlin `ServerSocket` + TurboModule + latch）要多写一套原生代码、阻塞式，而且在设备上开了一个监听端口。
  - Hermes CDP 只在 debug 构建可用，不满足“生产包也能用”。

### 5.5 开关与构建（Dexter 已裁定）

- **所有构建都包含 automation 包**：生产包与调试包相同，没有“按构建剔除”的分支。
- **开关和连接参数写在 package.json**：
  - Android：每个 `apps/terminal/application/android/<app>/package.json`；
  - Expo Web：对应 integration 的 package.json；
  - 与现有 `terminalSurfaces`、`serverSpaces` 是同一种 application 输入。字段名由详设确定。
- **开关关闭**：agent 不启动、不连接、不注册监听。primitives 的上报接缝保持 no-op，不影响渲染。
- **开关打开**：启动时装配 agent，按配置连接服务器，连接成功即可使用全部基础能力。
- 开关在打包时读入，改开关要重新打包（Dexter 已裁定）。不提供已安装包的运行期修改入口。

### 5.6 连接面的安全

automation 不读 full state，只经登记的 selector 读数据，暴露面比直接读 state 小得多。但连上 agent 的人仍然能发任何 command、读任何已登记 selector、操作任何控件，等于完全控制这台终端。

- **仓内事实**：TDC 的终端凭证保存在 state 里（`kernel/base/terminal-data-client/src/features/slices/terminalDataClient.ts:18,46,171`，`protection: 'protected'`）。能返回凭证、令牌等敏感值的 selector 照常登记，不做脱敏（Dexter 已裁定），因此凭证可以经 automation 读出。
- **App 主动外连，设备上不开监听端口**：网络上没人能主动连进终端，只有配置的服务器能控制它。
- 连接面最小要求（不限制能力，只限制谁能连；Dexter 已裁定四条全做）：
  1. 开关默认关闭，必须在 package.json 中显式打开；
  2. 连接参数里带一个会话令牌，driver 校验后才下发指令；
  3. 地址不是 localhost 时使用 `wss`；
  4. 开关打开的构建，在启动日志和本机 admin 中能看出“automation 已启用、连接到哪里”，防止误把测试包当正式包发出去。
- 按项目的尺度标准，生产化安全（审计、轮换、权限分级）不在本期范围，登记到 `HANDOFF.md` 欠账即可。
- 与 TER 版本更新专项的关系：开关打开的 bundle 也可能经 HOT 下发，须在那个专项里一并考虑。

### 5.7 包名与位置

- 三重标识按 `terminal-coding-standard.md` §2-A 由目录唯一派生：

| 目录 | moduleName | npm 包名 |
|---|---|---|
| `apps/terminal/ui/base/automation-agent` | `ui.base.automation-agent` | `@catering-v2s/ui-base-automation-agent` |

- 放在 `ui/base`，而不是 `kernel/base`：注册表依赖 RN 组件引用和 `measureInWindow`，而 kernel 不得依赖 react / react-native（check-static）。
- 依赖方向：
  - automation-agent 依赖 `kernel.base.runtime`、`ui.base.primitives`、`ui.base.render`；
  - primitives 只提供上报接缝，不反向依赖 automation-agent；
  - 装配点读取开关后安装 agent。Android 与 Expo Web 都经 `ui.base.integration-assembly` 进入，具体由详设定。
- 主机侧对应命名为 automation-driver，放在 `tools/` 下，不进入 `apps/terminal` 依赖图。
- 新包登记进 `apps/terminal/skeleton-graph.ts`，并同步 check-static 中硬编码的节点数。

### 5.8 删除现有 runner（Dexter 已裁定）

- 范围是全部现有 TER 自动化 runner，至少包括：
  - `scripts/test/ter-virtual-keyboard-android.mjs`（8848 行）；
  - `scripts/test/ter-admin-display-web.mjs`（2922 行）及其 `-contract.mjs`；
  - `tools/terminal-topology/run-dual-device.mjs`（4909 行）及 `NoIdleUiDump.java`；
  - `tools/terminal-sample2/run-sample1-frozen-journey.mjs`、`run-sample2-frozen-journey.mjs`。
- 完整清单由详设按源码重新盘点，包括调用它们的 package.json 脚本、文档与测试。删除时一并清理，不留下指向已删文件的入口。
- 不属于 runner、仍然有效的门不删。例如 `check-production-bundle.mjs` 只按 TR-08 修订调整禁用词。
- 删除后，这些 runner 覆盖过的场景在新包上重写之前没有自动回归。本批只重建首个旅途，其余场景列入清单、后续逐批重写（Dexter 已裁定）。

### 5.9 testID 完全重建（Dexter 已裁定）

- 废弃现有各包自定的前缀，例如 `ui.base.input:`、`ui-base-render:`、`terminal.admin:`、`application.base.android:loading`、`<appName>:test-expo:surface:*`。
- 统一用一个构造函数生成 testID，格式为 `<moduleName>:<part>[:<element>][:<key>]`，前缀是所在包的点分 moduleName（Dexter 已裁定）。
- 所属 surface 不写进 testID，由注册表的 surface 字段区分。两块屏上同名的节点靠 `{testID, surface}` 定位。
- 构造函数由 `ui/base/primitives` 提供，primitives 的 `testID` 必填规则不变。
- 须有机械门：TER 源码中的 testID 只能由构造函数生成，手写字符串字面量即报红，并配红夹具。门的判定口径由详设定。
- 旧 runner 已全部删除（§5.8），所以重建不需要兼容旧 ID，也不保留别名。
- 引用旧 testID 的现行设计文档与 README 同步更新。历史评审与证据文件不回改。

### 5.10 配套 skill（Dexter 已裁定）

- 新建项目 skill，放在 `.agents/skills/` 下（项目 skill 的唯一真相根，见 AGENTS.md）。名称建议 `cs-terminal-automation`，与现有 `cs-*` 一致。
- 详设阶段起草，实施阶段随实现完成，内容以实际源码与协议为准。至少包括：
  - 怎么打开开关、填写连接参数、启动 driver；Android 需要的 `adb reverse`；
  - 基础能力清单与调用示例：订阅 selector、发 command 并跟踪 requestId、查控件、取 bounds、真实点击与语义动作；
  - 新包怎么登记 selector，漏登记时机械门怎么报；
  - testID 构造规则；
  - 怎么写一条旅途：先 Expo Web 再设备、同一脚本（TR-16），结果中 `real` 与 `semantic` 的含义；
  - 常见失败与排查：连接不上、坐标偏移、订阅没推送、旧会话残留。
- 验收：由一个只读过这份 skill 的 fresh agent，独立写出并跑通一条小旅途。跑不通，就说明 skill 或实现有缺口。
- skill 随 automation-agent 的协议与能力一起维护。协议改了而 skill 没改，视为未完成。

## 6. 方案比较

| 方案 | 做法 | 得 | 失 | 判断 |
|---|---|---|---|---|
| A 现成工具 | Maestro / Detox / Appium | 不用自研 | Maestro 已明确不支持 Android 多屏（官方 issue #3015 仍开着，PR #3029 于 2026-03-31 被拒）；Detox 官方只测到 RN 0.84，没有多屏说明；Appium UiAutomator2 8.7.0 在 API 30+ 支持 `currentDisplayId`。三者都订阅不了 selector、发不了 command，也不能在生产包上按开关使用 | 不选。Appium 可作为设备侧输入通道的后备 |
| B 平台树定位 + 只读桥 | 定位继续用 DOM / uiautomator，桥只读数据 | 不用注册表 | 设备侧仍要 dump，最慢、最脆的环节原样保留 | 不选 |
| C 自建 agent：基础能力 + 真实输入与语义动作并存 | §5 | 一份脚本两端跑；定位不需要 dump；数据经 selector 订阅透明可见；command 全程可跟踪 | 坐标换算、selector 登记、连接面安全 | **推荐** |
| D POC 原样复用 | 手工注册回调，原生 socket 服务端，读 full state | 已有代码 | 不证明 UI；手工注册会漏；阻塞式桥；设备上开监听端口；绕过 selector | 不选 |

第三方事实出处（2026-10-05 实查）：

- [Detox README](https://github.com/wix/Detox/blob/master/README.md)
- [Maestro issue #3015](https://github.com/mobile-dev-inc/Maestro/issues/3015)
- [Appium UiAutomator2 README](https://github.com/appium/appium-uiautomator2-driver/blob/master/README.md)
- [RN Debugging（release 构建禁用 DevTools）](https://reactnative.dev/docs/debugging)
- [RNW 0.21.2 createDOMProps](https://github.com/necolas/react-native-web/blob/0.21.2/packages/react-native-web/src/modules/createDOMProps/index.js)
- [Playwright locators](https://github.com/microsoft/playwright/blob/main/docs/src/locators.md)

版本以详设时按 `doc/platform/third-party-library-usage-standard.md` 重核为准。

## 7. 决定

### 7.1 Dexter 已裁定（2026-10-05）

- automation 能发任何 command；数据全部通过 selector 访问，不直接访问 full state。
- 每个包都要在 runtime 中登记自己的 selector。
- automation 不执行动态脚本，只提供基础能力：外部脚本传入 selector 名和参数，agent 订阅并在每次变化时经 WS 推出数据；外部脚本传入 command 和参数，agent 发送 command、订阅 requestId，并经 WS 推出执行结果；其余能力同理。
- TR-08 修订：automation 是例外。所有构建都包含 automation 包，只在 package.json 中开关。
- 不限制使用场景：package.json 中有开关和连接服务器参数，打开就能用，生产包与调试包一样。
- 本地测试脚本要能完整发挥 automation 包的能力，driver 暴露全部基础能力，不做子集。
- 控件能力全部保留：定位、查询、bounds、语义动作和控件订阅。
- 每个包对外公开的 selector 全部登记，漏登记由机械门报红。
- 能返回凭证、令牌等敏感值的 selector 照常登记，不做脱敏。
- TR-08 的例外只覆盖 automation 包，其他测试钩子仍按原规则剔除。
- 包名：`automation-agent`，即 `ui/base/automation-agent`（§5.7）。
- 开关在打包时读入，改开关需重新打包。
- 连接面最小要求四条全做（§5.6）。
- 现有 runner 全部删除（§5.8）。
- testID 完全重建（§5.9）。
- 先做 spike，通过后再成批（§11）。
- 首个落地旅途是 sample-console（单机双屏）的现有冻结旅途。
- 旧 runner 删除后的场景重建：本批只重建首个旅途；其余场景（虚拟键盘全布局、双机拓扑、admin 显示等）先列清单，后续逐批在新包上重写。Dexter 知悉并接受期间这些场景没有自动回归。
- testID 格式：`<moduleName>:<part>[:<element>][:<key>]`，前缀用点分 moduleName（§5.9）。
- 详设与实施阶段必须建立对应的项目 skill，否则后续 agent 不知道 automation-agent 怎么用（§5.10）。

### 7.2 待 Dexter 讨论

无。讨论项已全部裁定。

## 8. 风险与需要 spike 实测的事实

| # | 未决事实 | 状态 | spike 判据 |
|---|---|---|---|
| K1 | `measureInWindow` 在 surface 缩放与 `Presentation` 窗口下能否换算出正确的 display 像素 | UNVERIFIED | 两块屏、四个角加中心点：agent 给出的坐标点击后命中预期控件，误差不超过 1 px |
| K2 | 注册与按需测量对大量节点的开销 | UNVERIFIED | 最重页面的注册数与查询耗时；开关关闭时不改变渲染行为 |
| K3 | 开关在 Gradle / Metro / Expo Web 下读入后生效 | 设计项 | 开关开、关各打一次包：关闭时不连接、不注册；打开时基础能力可用 |
| K4 | WS 客户端在应用重启、JS reload、断网和双机场景下的重连 | UNVERIFIED | driver 能认出新会话并区分新旧 runtime；旧订阅失效、新订阅可重建 |
| K5 | selector 参数与返回值的 JSON 化 | 设计项 | 全部已登记 selector 都能按名调用；不可序列化的给出明确错误，不静默丢字段 |
| K6 | 高频 selector 推送与连接积压 | 设计项 | 高频变化下不丢最后一次值，不阻塞 UI 线程 |
| K7 | 系统 installer、系统对话框等非 React 界面 | 边界 | 不在注册表内，必要时用 uiautomator 兜底，并在设计中写明 |

## 9. 范围与非目标（建议）

**范围**：

- `ui/base/automation-agent` App 内 agent 与基础能力协议；
- runtime 的 selector 登记，以及现有各包补登记；
- primitives 上报接缝；
- package.json 开关与连接参数；
- 主机 driver 与两端输入通道；
- TR-08 修订与扫描门禁用词同步；
- testID 完全重建及其机械门；
- 删除现有全部 runner；
- `cs-terminal-automation` skill；
- 一条 Web→设备同脚本的完整旅途（sample-console 冻结旅途）。

**非目标**：

- 不读 full state；
- 不执行动态脚本；
- 不替代 Jest 单测；
- 不做录制回放；
- 不做视觉比对；
- 本期不覆盖 Electron 与 iOS；
- 不做生产化的权限分级、审计和密钥轮换（登记到 HANDOFF 欠账）。

## 10. 方案合理性

- **问题对不对**：对。三个痛点都对准测试成本本身。现有约 1.85 万行 runner、自写的 Java dump 工具、三次 runner 假失败，都是实际发生的代价。
- **方案优不优**：
  - agent 只做基础能力，脚本逻辑全在主机侧：App 内代码小，容易验证；测试逻辑改动不用重新打包。
  - 数据只经 selector：与业务包遵守同一条 TR-03，不会出现“测试读到的和业务读到的不是一回事”。selector 登记顺带让 runtime 有了一份完整的数据读取目录。
  - command 跟踪复用现有 requestId 账本，不另建机制。
  - 真实输入与语义动作并存、由脚本选择，用证据标签保留“是否证明了 UI”的区分。
  - App 主动外连，设备上不开监听端口。
- **代价配不配**：
  - 新增 agent、注册接缝、selector 登记（kernel 契约加一个字段，现有各包补登记）、driver、skill 和一条旅途；
  - testID 全量重建会改动所有 UI 包；旧 runner 全部删除后，未重写的场景在一段时间内没有自动回归（Dexter 已接受）；
  - 收益是旅途脚本只写一份、删除旧 runner、数据不再是黑盒、command 全程可跟踪、TR-16 对照由结构保证。
  - 前提是 K1、K4、K5 的 spike 通过。不通过就停下来，由 Dexter 决定是否改用 Appium 作为设备侧输入，或缩小范围。
- **需要 Dexter 知悉的代价**：所有生产包都带着 automation 代码。开关打开的包，任何能连上配置服务器的人都能发任何 command、读任何已登记 selector，包括终端凭证。§5.6 只降低“谁能连上”的风险，不改变能力。

## 11. 下一步

讨论项已全部裁定。后续：

1. 先做 spike（K1、K4、K5），只在 scratch 或受管验收环境中进行；
2. spike 通过后，写正式需求，经独立盲审后进入详设。

本稿不授权其中任何一步。

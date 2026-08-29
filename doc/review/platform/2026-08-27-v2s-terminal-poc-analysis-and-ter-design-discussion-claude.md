# TER（apps/terminal）构建讨论稿 · POC(newPOSv1) 全量分析

- 日期：2026-08-27 · 作者：Claude · 状态：**讨论稿，非评审结论，不授权任何实施**
- 分析对象：`/Volumes/idea/newPOSv1`（只读 Heritage，本稿不回写）
- 目标对象：`catering-v2s` 仓内 `apps/terminal`
- 本稿性质：原始需求陈述 + 事实盘点 + 待裁决问题清单。**不含 GO/NO-GO。**

## 0 · 阅读方式

| 编号族 | 含义 |
|---|---|
| `F-xx` | POC 事实（已亲验，带文件路径） |
| `K-xx` | 建议继承的做法 |
| `P-xx` | 需要在 TER 避免的问题 |
| `R-xx` | Dexter 已提出的需求，逐条评估 |
| `X-xx` | Dexter 未提但绕不开的事项 |
| `Q-xx` | **需要 Dexter 裁决的问题** |

标注约定：`已亲验` = 打开源码看过；`推论` = 由已验事实推导；`UNVERIFIED` = 需要现场实验或查一手资料才能确认。

---

## 1 · POC 全景（已亲验）

### F-01 分层与规模

```text
1-kernel/1.1-base/     13 包   ┐
1-kernel/1.2-business/  6 包   ├ 645 文件 / 61,594 行
1-kernel/server-config-v2      ┘
2-ui/2.1-base/          7 包   ┐
2-ui/2.2-business/      1 包   ├ 308 文件 / 27,347 行
2-ui/2.3-integration/   1 包   ┘
3-adapter/android/      2 包     59 文件 /  4,240 行 + Kotlin adapter-lib
4-assembly/android/     1 包     26 文件 /  5,064 行（其中 src 只有 1 个文件）
0-mock-server/          3 包    133 文件 / 53,220 行
```

依赖方向由目录序号编码，`README.md` 明确禁止反向依赖；`3-adapter/host-runtime-rn84` 明确禁止依赖任何 business 包。

### F-02 每个包的固定骨架

`1-kernel/1.1-base/*/src` 与 `2-ui/2.1-base/*/src` 全部是同一套目录：

```text
application/    createModule.ts · moduleManifest.ts
features/       actors/ · commands/ · slices/
foundations/    该包的核心算法与运行时
hooks/  selectors/  supports/  types/
generated/packageVersion.ts
moduleName.ts   index.ts
```

这不是文档要求，是 13 个包逐个打开确认的实际形态。**这套骨架本身就是"功能模块化"的物理载体。**

### F-03 架构灵魂一：广播式 command

`1-kernel/1.1-base/runtime-shell-v2/src/foundations/runtimeCommandDispatcher.ts` 第 100 行注释即原话：

> v2 的 Command 天然是广播语义，同一个 commandName 可以被多个 Actor 处理并聚合结果。

实际语义（已亲验）：

1. 一条 `commandName` → N 个已注册 actor handler，`Promise.all` 并发执行，聚合为 `CommandAggregateResult`；
2. 聚合状态四态：`COMPLETED / PARTIAL_FAILED / FAILED / TIMEOUT`；
3. 每条 command 自带 `timeoutMs`（默认 60s）、`allowNoActor`、`allowReentry`、`visibility`、`defaultTarget`；
4. 重入保护键是 `requestId + commandName + actorKey`，允许 actor 派子 command（继承同一 requestId，`parentCommandId` 串链）；
5. `target: 'local' | 'peer'`，`peer` 时经 `installPeerDispatchGateway` 注入的网关转发到对端 runtime，本地仍先登记 request 以便 selector 立刻看到"已开始"；
6. `requestLedger`（427 行）把整条 request 生命周期落进 state，UI 用 selector 读进度。

### F-04 架构灵魂二：读走 selector

`createSelector` 只在 12 个文件出现（全部 `from '@reduxjs/toolkit'`，即 reselect），集中在真正有读模型的包；其余 selector 是纯函数。UI 侧通过 `react-redux` 的 `useSelector` 消费，`runtime-react` 内部另用 `useSyncExternalStore` 桥接非 redux 的 controller。

### F-05 UI 灵魂：页面数据与页面状态全进 store

`1-kernel/1.1-base/ui-runtime-v2` 把 UI 状态拆成三个 slice：

| slice | 内容 |
|---|---|
| `screen` | 每个 ScreenContainer 当前显示哪个 screen |
| `overlay` | 主/副屏 overlay 栈 |
| `uiVariables` | 通用 UI 临时变量 |

且 `spec/kernel-core-ui-runtime-dev-methodology.md` §0.1 明文禁止业务 slice 复制导航选中态：

> 业务 UI 包不得在自己的 feature slice 中新增 `selectedTab`、`currentPage`、`activeScreen` 这类导航镜像状态。

**这是"崩溃后恢复原状"能真正成立的原因** —— 只有一个真相源，重启即恢复。

### F-06 状态运行时：声明式持久化 + 声明式同步

`1-kernel/1.1-base/state-runtime` 的 slice descriptor 只有六个字段：

```ts
{name, reducer, persistIntent, syncIntent, persistence, sync}
```

- `persistIntent: 'never' | 'owner-only'`
- `syncIntent: 'isolated' | 'master-to-slave' | 'slave-to-master'`
- `persistence`：`field`（按字段一 key）或 `record`（按条目一 key + `__manifest__`），带 `protection: 'plain' | 'protected'`（普通/加密两个 storage port）和 `flushMode: 'immediate' | 'debounced'`
- `sync`：record 语义，值包 `SyncValueEnvelope {value, updatedAt, tombstone}`，LWW 合并

**没有用 redux-persist**（`foundations/store.ts` 只有 71 行纯 RTK `configureStore`）。持久化是自研的按字段/按条目写入，不是整块 blob。清空语义是写 `value: null + updatedAt`，不是 `delete` —— 因为 `delete` 无法同步给对端。

### F-07 scoped slice：同一份状态按轴复制多份

`state-runtime/src/supports/scopedSlice.ts` 提供三个轴：`workspace` / `instanceMode` / `displayMode`。
`ui-runtime-v2` 的 screen slice 实际展开成 `<base>.main` 与 `<base>.branch` 两份，各自声明同步方向：

```ts
syncIntent: {main: 'master-to-slave', branch: 'slave-to-master'}
```

**这一条对 TER 的单机双屏方案极其关键**（见 R-04）。

### F-08 通讯层：多地址故障切换已经内建

`1-kernel/1.1-base/transport-runtime`：

- `serverCatalog`：`serverName -> TransportServerAddress[]`（每个地址有 `addressName / baseUrl / timeoutMs`）
- `httpRuntime.call()` 的循环：`for 重试轮 { for 该轮地址列表 { 尝试 } }`，成功即 `rememberPreferredAddress`（黏住有效地址），`replaceServers` 时清空偏好
- `failoverStrategy: 'ordered' | 'single-address'`，`retryRounds`，`shouldRetry(error, request)` 可注入
- 并发闸门 + 滑窗限流（`HttpExecutionController`）
- 每次尝试产出 `HttpAttemptMetric`，整次调用产出 `HttpCallMetric`
- 注释明确写：**transport 层故意不解释业务 envelope 的成功/失败语义**

`server-config-v2/src/dev.ts` 里 `mock-terminal-platform` 就配了 `lan / local / localhost` 三个地址。

socketRuntime 用同一套地址选择 + 偏好记忆做 WS 重连。

### F-09 拓扑：一主一副 pair，四个场景一个模型

`docs/superpowers/specs/2026-04-18-topology-runtime-v3-design.md` §5 的结论（已亲验）：

| 场景 | master | slave |
|---|---|---|
| A 单机双屏 | primary runtime | managed secondary runtime |
| B 双机单屏 | A 机 | standalone slave |
| C 双机双屏 | 本次业务 pair 的 master | 本次业务 pair 的 slave |

运行上下文由 `deriveTopologyV3RuntimeContext` 推导：

```ts
standalone   = displayIndex === 0
instanceMode = config ?? (standalone ? 'MASTER' : 'SLAVE')
displayMode  = config ?? (standalone ? 'PRIMARY' : 'SECONDARY')
workspace    = (SLAVE && PRIMARY) ? 'BRANCH' : 'MAIN'
```

持久化闸门规则只有一条：`displayMode === 'SECONDARY' && standalone === false` 时禁止本地业务持久化（只禁 managed secondary，不禁 standalone slave）。

pair link 协议消息：`hello / hello-ack / state-snapshot / state-update / command-dispatch / command-event / request-snapshot / projection-mirror / state-diff`。

### F-10 单机双屏当前是两套 JS 环境（要被替换的那个）

已亲验的物理形态：

- `SecondaryDisplayLauncher.kt`：`DisplayManager` 找第二块屏，`ActivityOptions.launchDisplayId` 启 `SecondaryActivity`
- `SecondaryActivity.kt` 类注释原话："它运行在独立进程 `:secondary` 中，用于承载第二套完全独立的 RN JS 运行时"
- `SecondaryProcessController` 用**广播**做跨进程生命周期：started / stopped / restart-request / restart-ack，受控关闭时 `Process.killProcess`
- 副屏延迟约 3s 启动（方法论文档记为"业务需要"）
- 两端 ready 后，主屏 state 传到副屏 state/UI 实测约 100ms 量级

代价（推论，但依据充分）：双份 JS 堆内存、双份 store、双份持久化（副屏被 gate 掉）、双份 TDP 会话考量、一整套跨进程生命周期协议、以及"副屏没起来"这一类独立故障面。

### F-11 TDP：WS 推 + HTTP 拉，本来就是混合

- WS 上行：`HANDSHAKE / PING / STATE_REPORT / ACK / BATCH_ACK`
- WS 下行：`SESSION_READY / FULL_SNAPSHOT / SNAPSHOT_BEGIN|CHUNK|END / CHANGESET / PROJECTION_CHANGED / PROJECTION_BATCH / COMMAND_DELIVERED / PONG / EDGE_DEGRADED / SESSION_REHOME_REQUIRED / ERROR`
- HTTP：`GET /api/v1/tdp/terminals/{terminalId}/snapshot`、`GET .../changes`（`foundations/httpService.ts`）

持久化只留最小恢复集：`tdpSync.lastCursor` / `lastAppliedRevision`；`projection` / `commandInbox` / `session` / `controlSignals` 全部不持久化。

### F-12 automation：自研 JSON-RPC 控制面

`2-ui/2.1-base/ui-automation-runtime`（1,685 行）+ Kotlin `AutomationSocketServer`。方法面 28 个，分五类：

| 类 | 方法 |
|---|---|
| runtime | `getInfo` `getState` `selectState` `listRequests` `getRequest` `getCurrentScreen` |
| ui | `getTree` `queryNodes` `getNode` `getFocusedNode` `getBounds` `performAction` `revealNode` `scroll` `setValue` `clearValue` `submit` |
| wait | `forNode` `forScreen` `forState` `forRequest` `forIdle` |
| 控制 | `command.dispatch` `scripts.execute` |
| 观测 | `events.subscribe/unsubscribe` `automation.getLastTrace/getTraceHistory/clearTrace` |

target 模型：`primary | secondary | host | all`（`wait.*` 与有副作用的方法禁止 `all`）。

UI 语义源是**TS 侧手工注册的 semantic registry**，不是 Fabric shadow tree、不是 Android Accessibility。带 stale grace window、按 screen 上下文清理、`performAction` 前重新校验 mounted/visible/enabled。

传输：Android 走 `adb forward` + 本机 socket；Web/Expo 走 WebSocket。Product 环境默认完全不启动。

### F-13 测试体系：三层，且已经有 Web 那一层

| 层 | 形态 | 位置 |
|---|---|---|
| 包内语义 | vitest，node 环境 | `test/scenarios/*.spec.ts` |
| 真实闭环 | vitest + 真 mock server / 双 runtime | `test/helpers/liveHarness.ts` |
| **浏览器** | **Expo Web + 浏览器自动化** | **`test-expo/runAutomation.mjs`** |

`2-ui/2.1-base/runtime-react/test-expo/` 是 670 行的自动化运行器，已实测覆盖：真实 kernel 启动、主副 root 渲染、navigate/replace/modal/uiVariable/displayMode 命令、**两个浏览器页分别当 `displayIndex=0` 与 `displayIndex=1`**、以及真实 `dual-topology-host-v3` 的 WS 连通。`expo ~54.0.31` 已经是 `runtime-react` 的 devDependency。

> **更正一条前提**：您说"web 方式测试 POC 当前没有用"——实际上 `runtime-react` 与 `admin-console` 两个包已经建成并在用；只是没有推广到全部包。TER 是**扩大**它，不是从零建。

`spec/kernel-core-dev-methodology.md` 记的 `dev/index.ts` + `full/seed/verify` 三阶段真重启 harness：**当前仓内已无 `dev/` 目录**，该模式已被 `test/scenarios` + `liveHarness` 取代。文档相对代码滞后。

### F-14 原生适配层：纯 Kotlin 库 + 独立 dev-app

`3-adapter/android/adapter-android-v2/adapter-lib` 能力（按 Kotlin 包）：
`interfaces`(IConnector/IDeviceManager/IScriptEngine/ILogManager/IStateStorage) · `storage` · `logger` · `device` · `appcontrol` · `connector`(HID 键盘扇出、系统文件选择) · `camera`(扫码) · `scripts`(原生脚本引擎) · `hotupdate`(boot marker + 包安装) · `topologyhostv3`(设备上跑 WS server) · `automation`(socket server)。

带 `dev-app`：一个独立 Android App 逐能力手测，**不依赖 RN**。另有 JUnit 测试 9 个。

### F-15 platform-ports：kernel 唯一的平台事实入口

`PlatformPorts = {environmentMode, logger, terminalLogs?, scriptExecutor?, stateStorage?, secureStateStorage?, device?, appControl?, hotUpdate?, topologyHost?, localWebServer?, connector?}`

`LoggerPort` 是结构化的：`{timestamp, level, category, event, message, scope{moduleName,layer,subsystem,component}, context{requestId,commandId,commandName,sessionId,connectionId,nodeId,peerNodeId}, data, error, security{containsSensitiveRaw, maskingMode}}`，支持 `scope()` / `withContext()` 派生。

### F-16 assembly 极薄（目标达成了）

`4-assembly/android/mixc-catering-assembly-rn84/App.tsx` 全文 30 行，只是 `createHostApp({RootScreen, createShellModule, extraKernelModules, productConfig})`。`src/` 下只有一个 `generated/releaseInfo.ts`。

`spec/layered-runtime-communication-standard.md` 里列的一堆 "Priority A/B/C 待迁移 assembly 逻辑"，代码里已经迁到 `host-runtime-rn84`。**文档滞后于代码。**

### F-17 mock-server：53K 行的完整对手方

`mock-terminal-platform` 服务端模块：`tcp`（激活控制面）、`tdp`（数据面）、`master-data`、`admin`、`sandbox`（多租户隔离）、`hot-update`、`terminal-log`、`fault`（故障注入）、`benefit-center`、`scene`、`export`，外加一个 Web 管理台。
`dual-topology-host-v3` 是独立的主副配对 host（HTTP+WS）。

### F-18 代码卫生

全仓 production 源码 `TODO/FIXME/HACK/XXX/workaround` **命中 0 条**（唯一一条中文"临时"是页面文案）。与 `AGENTS.md` 的"不用临时方案"红线一致。

---

## 2-3 · POC 好/坏清单 → 已合并到台账

⚠️ 原 §2「建议继承（K-01..K-20）」与 §3「需要避免的问题（P-01..P-10）」**已全部合并**进单一台账：

**`2026-08-27-v2s-terminal-poc-findings-ledger-claude.md`**

台账用三组编号：`KEEP-01..24`（做对了、要保住）· `FIX-01..16`（缺陷、要改形状）·
`CON-01..04`（平台约束、不是 POC 的对错）。每条带证据路径、行号或穷举计数、证据档位与 TER 动作。

**本节不再复述内容** —— 同一条规则住两处必然漂移。

## 4 · 需求逐条评估（R）

### R-01 用 Expo（SDK 57）替代 RN 裸工程

**POC 现状**：RN 0.84.1 裸工程 + 自建 `MainApplication/MainActivity/SecondaryActivity` + `AdapterPackage` 注册 9 个 TurboModule + 自定义 metro resolver。同时 `expo ~54` 已作为 web 测试面存在。

**影响面（推论）**：
1. Expo 的 Continuous Native Generation（prebuild）与 POC 手写的 Android 壳冲突 —— 手写的 `SecondaryActivity`、`launchDisplayId`、`:secondary` 进程、`AppRestartManager` 都必须改写成 **config plugin + expo-module**，否则 prebuild 会覆盖；
2. 好处很实在：`expo-updates`（对 R-09 热更新）、`expo-secure-store`（对 `KEEP-04` 的 `protected` 存储）、`expo-sqlite`（对 adapter/persist-sqlite）、统一的 Metro/Babel 配置（消掉 `FIX-13`）、`expo-dev-client` 让 automation 与真机调试链路标准化；
3. 代价：任何 Expo 未覆盖的原生能力都必须写 expo-module —— 而 POC 的原生能力**恰恰大部分是 Expo 未覆盖的**（HID 键盘、扫码、脚本引擎、设备上 WS server、热更新 boot marker、automation socket）。所以 R-03 不是可选项，是 R-01 的必要条件。

**UNVERIFIED**：Expo SDK 57 对应的 RN 版本、React 版本，以及它对 React Compiler 的默认支持状态。我的知识不足以给准数，需要现场 `npx create-expo-app` 或查官方 changelog 确认。→ **Q-10**

### R-02 保持 `kernel / ui / adapter / assembly` 目录结构

**您给的结构与 POC 的对照**：

| 您的 TER | POC 对应 | 差异 |
|---|---|---|
| `kernel/base` | `1-kernel/1.1-base` | 去掉数字前缀 |
| `kernel/feature` | `1-kernel/1.2-business` | **business → feature** |
| `ui/base` | `2-ui/2.1-base` | 同 |
| `ui/feature` | `2-ui/2.2-business` | business → feature |
| `ui/integration` | `2-ui/2.3-integration` | 同 |
| `adapter/android/*` | `3-adapter/android/adapter-android-v2`（单包） | **拆成能力粒度多包** |
| `adapter/electron/*` | 无（`3-adapter/harmony` 是空目录） | 新增 |
| `assembly/android` | `4-assembly/android/*` | 同 |
| `assembly/electron` | 无 | 新增 |

**无家可归的三样**（需要决定）：
1. `server-config-v2`（运行时服务器空间与地址配置，被 kernel 和 adapter 都依赖）
2. `1-kernel/test-support`、`2-ui/2.1-base/test-support`（测试脚手架）
3. `0-mock-server`（53K 行对手方，是 dev 基础设施不是终端产品）

**一个需要注意的取舍**：数字前缀 `1-/2-/3-/4-` 不只是排序，它让"依赖只能往小序号走"这条规则**在文件树里肉眼可见**。去掉之后，依赖方向只剩命名约定与 review 兜底。v2s 仓已有 `scripts/check/code-layout` 这类机械门的先例，可以补一道 —— 但要先决定要不要。→ **Q-12**

### R-03 adapter/android 用 expo-module 实现

**评估：方向正确，且是 R-01 的必要条件。**

POC 的 `adapter-lib` 已经是**纯 Kotlin、不依赖 RN** 的库（只有 `host-runtime-rn84` 里的 TurboModule 薄壳依赖 RN）。这意味着迁移路径很干净：`adapter-lib` 的 Kotlin 代码可以几乎原样成为各 expo-module 的实现体，只换掉最外层的 TurboModule 声明为 Expo Modules API 的 `ModuleDefinition`。

您列的 `persist-mmkv` / `persist-sqlite` 并列引出一个问题：POC 只有一个 `IStateStorage`（MMKV 实现），`StateStoragePort` 是纯 KV。两个后端并存意味着要回答"什么状态走哪个"。→ **Q-09**

**建议的 module 切分（供讨论）**：`persist-kv`(MMKV) · `persist-sql`(SQLite) · `persist-secure` · `device` · `app-control` · `logger` · `connector`(HID/文件/外设) · `scanner`(相机扫码) · `script-engine` · `hot-update` · `dual-screen`(Presentation/多 surface) · `automation-host`。每个都能被独立的 dev-app 验证（`KEEP-01`）。

### R-04 单机双屏：一套 JS 环境、两个 screen、内存通讯 ★ 本轮最大的架构变更

**这是本次需求里唯一会动到 kernel 语义的一条，值得单独讲。**

POC 现状见 F-10：两个 Android 进程、两套 JS runtime、走设备上的 WS（`TopologyHostV3Server` 跑在 adapter 里）。

**两条可行路线，差别很大：**

**路线 A —— 一个 runtime，两个 React root，靠 scoped slice 分屏**

- 一个 store，`ui-runtime-v2` 的 screen/overlay 已经天然按 `workspace: main | branch` 分开（F-07），主屏渲染 `main`，副屏渲染 `branch`
- 本机两屏之间**根本不需要"通讯"**——它们读同一个 store 的不同 slice
- `topology-runtime-v3` 的 pair link 只在**跨设备**时才建立
- 持久化闸门（F-09 那条 `SECONDARY && !standalone`）自动消失，因为只有一个持久化 owner
- `FIX-17` 那套跨进程广播协议整体删除
- **代价**：单机双屏与跨机双终端**不再是同一套机制**。方法论文档 §5.1 的"四场景一个模型"被打破 —— 单机变成"无 link"，跨机才有 link

**路线 B —— 一个 JS 环境内两个逻辑 runtime，走内存 peer link**

- 保留 `master runtime` 与 `slave runtime` 两个逻辑实例，把 `TopologyPeerOrchestratorV3` 的实现从 WS 换成内存 channel
- 现成的接缝就在 `topology-runtime-v3/src/types/runtime.ts` 的 `TopologyPeerOrchestratorV3` 接口（`startConnection / stopConnection / dispatchRemoteCommand / sendStateSnapshot / sendStateUpdate / sendCommandDispatch / ...`），换实现不改 kernel 语义
- 单机与跨机**完全同构**，业务真的无感，测试用例可以一套跑两种 transport
- **代价**：一个 JS 环境里两个 store、两份 slice、两份持久化 —— 内存并没有省多少，而且要处理"同一个 storage 后端两个 owner 写"的问题；LWW 时间戳在同进程内退化成无意义的自比较

**我的初步倾向（供辩论，不是结论）**：**路线 A 是对的**，理由是它消掉的不是代码而是**整类故障**（副屏没起来、副屏 state 落后、副屏持久化误写、跨进程重启握手）。您说"业务无感"——路线 A 下业务确实无感，因为业务写 command、读 selector，根本不知道对面是同一个 store 还是一条 link。
而"一套逻辑支持双终端通讯"这一条，靠的是 `topology-runtime-v3` 在**跨设备时**照常工作，不是靠本机也走一遍 link。

但这条要您裁：它改变了 F-09 那个"四场景一个模型"的既有裁定。→ **Q-03**

**共同的原生前提（两条路线都要）**：Android 侧需要**同一个 ReactHost 挂两个 surface**，其中一个投到第二块 Display（`Presentation` 或同进程的 `launchDisplayId` Activity）。

**已亲验（RN 0.84.1 字节）**：这条在 RN 新架构里 API 层是成立的 ——
`node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactHost.kt` 第 83-88 行
`public fun createSurface(...): ReactSurface`，配套有 `runtime/ReactSurfaceView.kt`、`runtime/ReactSurfaceImpl.kt`、
`interfaces/fabric/ReactSurface.kt`。**一个 ReactHost 创建 N 个 surface 是官方 API，不是 hack。**

**仍 UNVERIFIED**：(1) Expo SDK 57 的 prebuild 产物是否允许接管 Activity/ReactHost 到这个程度；
(2) `Presentation` 里挂 `ReactSurfaceView` 的实际生命周期、触摸、尺寸与 DPI 行为；
(3) 两块屏不同分辨率/密度下 Fabric 的布局上下文是否需要单独配置。
这三条需要最小原型验证。这是 TER 的**第一个技术风险点**，建议在任何业务代码之前先打通。→ **Q-03b**

### R-05 HTTP 全走 RTK Query + OpenAPI 生成 + 多地址自动切换

**三个诉求，难度不一样：**

1. **OpenAPI 生成**：`@rtk-query/codegen-openapi` 成熟，v2s 已有 `contracts/openapi/` 与 `scripts/check/edge-codegen` 的先例。**但**：v2s 当前 `x-consumer-faces` 只有 `operations-admin`(1083) / `platform-admin`(291) / `public`(58)，**没有 `terminal` face**；`apps/backend/terminal-data-server` 是空占位，`AGENTS.md` 明文禁止在当前阶段为 TDP 加契约。→ 这不是技术问题，是**授权与顺序问题**。→ **Q-02**

2. **多地址自动切换**：`fetchBaseQuery` 只有单个 `baseUrl`。要保留 F-08 的全部语义（多地址 × 重试轮 × 偏好黏住 × 失败切换 × 并发闸门 × 限流 × per-attempt metric），必须自己写一个 `baseQuery` 包装器。这是**可行且干净的**：把 `httpRuntime` 的循环搬进 `customBaseQuery`，RTK Query 只负责缓存/失效/hooks。生成的 endpoints 不受影响。

3. **RTK Query 与"写走 command / 读走 selector"的冲突** —— **这条最关键，必须先裁**：
   - RTK Query 自带缓存与 `useQuery` hooks。如果 UI 直接 `useGetXxxQuery()`，那么读路径就绕过了 selector，数据住在 RTKQ 的 cache slice 里而不是业务 slice 里；
   - 而您的 UI 灵魂是"页面数据和页面状态全走 store，崩溃重启能恢复原状"—— **RTKQ 的 cache 默认不持久化，且 `keepUnusedDataFor` 到期即清**。直接用 hooks 会让"重启恢复原状"这条失效；
   - 两条互斥路线：
     - **(a) RTKQ 当 transport**：只在 actor 里 `dispatch(endpoint.initiate(...))`，把结果写进业务 slice，UI 仍只读 selector。保住灵魂，但放弃 RTKQ 大半价值（hooks、自动重取、tag 失效），而且 v2s 前端规范 §3-C 明确记着 `initiate` 必须配 `.unsubscribe()/.reset()` 否则泄漏（实测 3 query + 1 mutation = 4 次 HTTP）；
     - **(b) UI 直接用 hooks**：拿满 RTKQ 价值，但要为"哪些数据必须重启后仍在"单独设计持久化，且读路径从此有两个住址（selector 与 RTKQ cache）——正是 v2s 前端规范 §3-E 禁的"同一个事实两个住址"。
   - 还有第三种：**(c) 分层** —— 主数据（TDP 投影来的）走 kernel slice + selector + 持久化；**纯请求响应式的**（一次性查询、提交结果）走 RTKQ hooks。判别式是"这条数据重启后还需要吗"。
   → **Q-06**

### R-06 automation 能力评估：能不能换第三方

**我的评估结论：不能整体替换；应当拆成两半。**

把 F-12 的 28 个方法按"第三方能不能提供"分类：

| 能力 | 第三方替代 | 判断 |
|---|---|---|
| `ui.queryNodes/performAction/setValue/scroll/submit` | **Maestro** / Detox / Appium | ✅ 可替代，且 Maestro 对 Expo 支持好、YAML 流程、无需改 App |
| `wait.forNode/forScreen` | Maestro 内建 | ✅ 可替代 |
| `runtime.getState/selectState` | **无** | ❌ 没有任何黑盒工具能读你的 Redux state |
| `runtime.listRequests/getRequest` | **无** | ❌ request ledger 是自研概念 |
| `wait.forState/forRequest` | **无** | ❌ 依赖上面两项 |
| `command.dispatch` | **无** | ❌ 直接驱动 kernel、绕开 UI，是排障与用例隔离的核心 |
| `wait.forIdle` | Detox 有同步机制但语义不同 | ⚠️ 部分 |
| `target: primary/secondary` | **无**（多屏寻址） | ❌ |
| `scripts.execute` | **无** | ❌ 且这是 escape hatch，可考虑不带 |

**关键判断**：POC 的 automation 的真正价值**不在 UI 驱动**（那部分是重复造轮子），而在**把 runtime 内部事实（state / request / command）暴露成可断言、可等待的东西**。这一半没有第三方，因为它绑定的是你自己的架构概念。

**建议形态（供讨论）**：
- **保留并加强**"runtime 控制面"那一半 —— `selectState / getRequest / command.dispatch / wait.forState / wait.forRequest`，Product 环境仍默认 inert；
- **UI 驱动那一半评估换 Maestro** —— 它跑在 App 外，不需要 semantic registry（用 accessibility/testID），能直接消掉 `FIX-08` 的手工注册负担；
- 两者结合：Maestro 驱动 UI，控制面断言业务事实。**比 POC 现状更好**，因为不再要求每个新组件手工注册才能被测到。
- Web 那一层（`test-expo`）继续用浏览器自动化，天然有 DOM。

→ **Q-07**

### R-07 引入 React Compiler

**前置条件（已亲验，必须先做）**：
1. `FIX-07` 的 5 处条件 hook 必须清零 —— 它们正在最核心的两个渲染组件里；
2. v2s 根已装 `eslint-plugin-react-hooks@7.0.1`（含 compiler 规则），可以直接开门；
3. POC 的渲染路径大量依赖 `useSelector` + 手写 memo 边界，Compiler 接管后要重新看：`shallowEqual` 的用法、`useSyncExternalStore` 的 getSnapshot 稳定性。

**UNVERIFIED**：React Compiler 在 RN/Hermes/Expo SDK 57 下的成熟度与官方推荐配置（`all` vs `annotation` 模式）。建议 TER 起步用 `annotation` 模式（只编译标注过的组件），全绿后再放开。→ **Q-10**

**一个诚实的提醒**：POC 的性能瓶颈**我没有实测数据**。React Compiler 解决的是"重渲染过多"，而 POS 终端的卡顿也可能来自 TDP 大批量 projection 应用、持久化写盘、或副屏同步。**建议先测再上**，否则可能是"精确地做 1+1"。→ **Q-11**

### R-08 NativeWind + React Native Reusables

**评估：合理，且与 `FIX-08` 有一个可以顺手解决的耦合。**

POC 完全没有 UI 框架，样式是内联 `style={{}}`。品牌定制需求下自建控件库是对的。

**关键机会**：RNR 的控件是**你自己仓里的源码**（shadcn 模式，不是 node_modules 依赖），意味着可以在每个 primitive 上**统一挂 semantic 注册**（`FIX-08` 的做法铺开），一次性解决 `FIX-08`。这是我建议把 R-06 与 R-08 一起设计的原因。

**待确认**：NativeWind 版本与 Expo SDK 57 / RN 新架构的兼容矩阵；RNR 的可用控件清单是否覆盖 POS 需要的形态（数字键盘、PIN、大按钮触控区、双屏不同 DPI）。POC 的 `input-runtime`（虚拟键盘 / PIN / 数字输入 + 输入持久化）是 POS 专有的，RNR 大概率不覆盖，需要保留自研。

### R-09 Sentry + react-error-boundary

**评估：真缺口（`FIX-09` 已证），建议做。**

**接入点已经现成**：`LoggerPort`（F-15）是结构化的且带 `security.containsSensitiveRaw` —— 加一个 Sentry sink，把 `warn/error` 转成 Sentry event，`scope/context` 直接映射成 Sentry 的 tags/contexts，`containsSensitiveRaw === true` 的直接丢弃或脱敏。**不需要业务代码改一行。**

**边界要先定**：
1. 终端在门店内网、可能长期离线 —— Sentry 需要离线队列与上传窗口策略（POC 已有 `versionReportOutbox` 的 outbox 先例可参考）；
2. `react-error-boundary` 的粒度：root 一层肯定要，但 POS 更需要**screen 级**（一个业务页崩了不该让收银台白屏）—— `ScreenContainer` 是天然的边界；
3. 崩溃后的**恢复动作**：您的 store 灵魂本来就支持恢复原状，error boundary 的 reset 应该重新挂载 screen 而不是重启 App。

### R-10 继承功能模块化 + 广播 command + reselect

**已在台账 `KEEP-02` / `KEEP-06` / `KEEP-03` 展开。**补一条需要补齐的：POC 的"可组合测试"目前靠 `test/helpers/liveHarness.ts` 各包自建（`tdp-sync-runtime-v2` 与 `ui-runtime-v2` 各一份，结构相似但独立）。`spec/kernel-core-dev-methodology.md` §六自己写了"还可以继续抽象一个真正通用的 shared-dev harness"—— **TER 建议一开始就建这个共享 harness**，否则每个包一份 liveHarness 就是 `KEEP-02` 的反面。

您提到的三种测试方式，对应到 POC 已有的物理形态：

| 您说的 | POC 现状 | TER 建议 |
|---|---|---|
| node 测试 | `vitest environment: node` + liveHarness，58+42 个 spec | 继承，补共享 harness |
| web 方式 | **已存在**：`test-expo/` Expo Web + 浏览器自动化 | 从 2 个包铺到全部 UI 包 |
| Jest | 未用 | **需要决定要不要**：vitest 已经在用且 RN 生态正在向它迁移；引入 Jest 会是第二套 runner。→ **Q-08** |

### R-11 TDP 通讯从 WS 改 SSE（web + native 都要）

**好消息**：F-11 显示 TDP **本来就是 WS 推 + HTTP 拉的混合**，snapshot/changes 已经是 HTTP GET。所以"推"的部分换 SSE 是自然的。

**必须先解决的问题**：**SSE 是单向的（server→client）**。当前 WS 上行有五类消息：

| 上行消息 | 作用 | 改 SSE 后怎么办 |
|---|---|---|
| `HANDSHAKE` | 带 `lastCursor / subscribedTopics / subscriptionHash / runtimeIdentity` 建会话 | 变成 SSE 连接的 query/header，或先 POST 建会话再连 SSE |
| `PING` | 心跳 | SSE 有服务端 keep-alive comment；客户端存活靠 HTTP 层 |
| `ACK` / `BATCH_ACK` | **游标推进**，`nextCursor` + `subscriptionHash` | 必须改成 POST。**这是最有语义风险的一条** |
| `STATE_REPORT` | 客户端指标回报 | POST，可批量低频 |

**风险点（推论）**：ACK 从"同一条连接内有序"变成"独立 POST"，就要回答：ACK 乱序怎么办？ACK 丢了怎么办？服务端如何判断"这个 ACK 属于哪一次 SSE 连接"？POC 现在靠同一条 WS 天然有序 + `sessionId` 绑定。改 SSE 需要重新设计会话身份与游标推进的幂等语义。

**其它待确认**：
1. **RN 原生没有内置 `EventSource`** —— 需要 polyfill（`react-native-sse` 之类）或用 `expo/fetch` 的流式响应自己解析。**UNVERIFIED**，需要现场验；
2. HTTP/1.1 下浏览器同域 6 连接上限（web 端要注意），HTTP/2 无此问题；
3. 中间设备（门店网络的代理/防火墙）对长连接的处理，SSE 与 WS 各有各的坑，需要现场数据；
4. **多地址切换（R-05）与 SSE 断线重连要合成一套** —— SSE 自带 `Last-Event-ID` 重连语义，正好可以承载 cursor。

→ **Q-05**

---

## 5 · 您没提但绕不开的（X）

### X-01 TER 在 v2s 治理体系中的位置

`apps/terminal` 现在只有一个 `package.json`（name: `nextpos`），且**不在根 workspaces 里**（根 `package.json` 只有 `apps/frontend/*` 与 `libraries/frontend/*`）。

进 v2s 仓意味着 TER 落入现有红线：R-atomic 交付、Roadmap 授权字段、`x-consumer-faces` 单一真相、"能力命名而非流程命名"、fresh 独立子 agent 对抗审查、两轮上限。这些是为后台设计的，套到终端上有些合身、有些不合身。→ **Q-01**

### X-02 v2s 与 POC 的工具链差异

| | v2s | POC |
|---|---|---|
| 包管理 | Yarn 4.17.0 | Yarn 3.6.4 |
| Node | >= 22 | 未声明 |
| 任务编排 | 无（`scripts/verify` 聚合） | turbo |
| 测试 | vitest + node:test + Playwright | vitest |
| lint | eslint 9 + react-hooks 7.0.1 + prettier | eslint（配置在 POC 根） |

TER 用不用 turbo、要不要进 `scripts/verify` 的门、`scripts/verify` 的"分钟级"预算能不能容纳 RN 类型检查，都要定。

### X-03 服务端对手方缺位

TER 的三条通讯链路（TCP 控制面激活 / TDP 数据面 / topology pair link）在 v2s 一条都没有对手方：
- `terminal-data-server` 是空占位（只有 README + build.gradle.kts）；
- 契约里无 `terminal` face；
- POC 的 53K 行 `mock-terminal-platform` 是唯一可用的对手方。

不解决这条，TER 只能做到"本地能跑 + 双屏能同步"，做不到端到端。→ **Q-02**

### X-04 v2s 前端规范对 TER 适用多少

`doc/platform/frontend-coding-standard.md` 是 659 行、基于 React 19 + antd 6 + RTK 2.12 的 Web 规范。其中：
- **通用的**：§1-0 门只写禁止句、§3-B `currentData` vs `data`、§3-C `initiate` 的义务、§3-E 同一事实一个住址、§3-G 幂等键按操作性质划边界、§4-A/4-B/4-D 评审纪律 —— **这些对 TER 直接适用**；
- **Web 专属的**：antd 相关、§3-K 七族交互一致性（基于 antd 控件形态）、prettier/格式条款 —— 需要 TER 版本。

是新写一份 `terminal-coding-standard.md`，还是扩展现有那份？→ **Q-13**

### X-05 Electron 的真实优先级

POC 里 Electron **完全不存在**（`3-adapter/harmony`、`4-assembly/harmony` 是空目录；`electron` 字样只出现在热更新设计文档与 mock server 的类型里）。您的目标结构里有 `adapter/electron` 与 `assembly/electron`。

如果现在只建空目录，那是"为想象中的未来付费"（v2s charter §2-A 明确禁止）。如果现在真做，工作量与 Android 同量级。→ **Q-14**

### X-06 主数据规模与性能的真实约束

POC 的 `1.2-business` 有 catering-product / catering-store-operating / organization-iam 三个主数据包 + benefit 三包。TDP 投影是全量快照 + 增量。**我没有找到任何关于数据量级的记载** —— 一家门店多少商品、多少 SKU、投影多大、快照传输多久。

这直接决定：要不要 `persist-sqlite`（R-03）、要不要虚拟列表、React Compiler 是不是真的对症（R-07）。→ **Q-11**

### X-07 离线能力边界

POS 终端断网时要能继续卖。POC 里我看到的离线设计只有：TDP 断线重连 + cursor 恢复、`versionReportOutbox`。**没有看到订单侧的离线队列**（benefit-session 有会话概念但我没深入）。TER 的离线边界要先划出来，因为它决定持久化策略、SQLite 需求和冲突解决模型。

### X-08 安全边界

`StateStoragePort` 有 `secureStateStorage` 分支和 `protection: 'protected'`，`LoggerPort` 有 `containsSensitiveRaw`。但 automation socket（`adb forward` + localhost）、`scripts.execute`（任意脚本执行）、topology host（设备上开 WS server）在生产环境的关闭证明，POC 是靠"Product 环境默认不启动"的约定。TER 需要把它变成可验证的（编译期剔除 / 构建变体 / 运行时断言）。

---

## 6 · 需要 Dexter 裁决的问题（Q）

> 按对后续设计的阻塞程度排序。前四条不定，设计无法开始。

### Q-01 【阻塞】TER 在 v2s 的授权与治理形态
TER 是 v2s 的一个新 Roadmap program（如 `V2S_TERMINAL`），还是现有 program 的新 R？它是否受现有全部红线约束（R-atomic 一次性交付、两轮独立审查上限、`x-consumer-faces` 单一真相、`scripts/verify` 分钟级）？`apps/terminal` 要不要进根 workspaces？

### Q-02 【阻塞】服务端对手方从哪来
三选一（或组合）：
- **(a)** 把 POC 的 `mock-terminal-platform` + `dual-topology-host-v3` 搬进 v2s 作为 TER 的 dev 依赖（53K 行，但即刻可用）；
- **(b)** 先在 v2s 定 `terminal` consumer face 与 TDP 契约，TER 等契约（顺序正确，但 `AGENTS.md` 当前禁止为 TDP 加契约，需要您先解禁）；
- **(c)** TER 第一阶段只做本地闭环（双屏 + UI + 持久化 + 恢复），不接服务端。

这条直接决定 R-05（RTK Query + OpenAPI）什么时候能真做 —— **没有 OpenAPI 就没有生成，没有 terminal face 就没有 OpenAPI。**

### Q-03 【阻塞】单机双屏走路线 A 还是路线 B
见 R-04。A = 一个 runtime 两个 React root 靠 scoped slice 分屏（本机无 link）；B = 一个 JS 环境两个逻辑 runtime 走内存 peer link（与跨机同构）。
我倾向 A（消掉整类故障），但它打破 POC 已有的"四场景一个模型"裁定，必须您定。

### Q-03b 【阻塞·技术验证】多 surface 原型
无论 A 还是 B，Android 侧都要"同一个 ReactHost 挂两个 surface，其一投到第二块 Display"。
**RN 侧 API 已亲验存在**（`ReactHost.createSurface` + `ReactSurfaceView`，RN 0.84.1 源码）；
未验的是 Expo prebuild 的接管边界、`Presentation` 内 surface 的生命周期/触摸/DPI 行为。
**建议：这是 TER 的第一个技术风险，在写任何业务代码之前先做最小原型。** 您是否同意先做这个原型再谈设计？

### Q-04 双终端（跨机）的拓扑边界
仍然严格是"一主一副 pair"吗？还是要支持一主多副（比如一台主机 + 收银屏 + 客显 + 叫号屏）？这决定 `topology-runtime-v3` 的模型能不能原样继承 —— POC 的 V3 设计明确把"多 peer 图网络"作为已被证伪的错误方向记录在案。

### Q-05 SSE 的上行方案
SSE 单向，TDP 现有五类上行消息（HANDSHAKE / PING / ACK / BATCH_ACK / STATE_REPORT）必须重新落位。
- 会话建立：POST 建会话拿 sessionId 再连 SSE，还是把参数放进 SSE 的 query？
- **ACK/游标推进**：改 POST 后如何保证幂等与顺序？能不能用 SSE 的 `Last-Event-ID` 承载 cursor，让重连自带续传？
- 心跳与"客户端还活着"如何判定？
另外：RN 原生的 EventSource 方案（polyfill vs `expo/fetch` 流式解析）需要现场验，您希望我在讨论阶段就做这个验证，还是先定协议再验？

### Q-06 RTK Query 与"读走 selector / 全走 store"的关系
三选一（见 R-05.3）：
- **(a) RTKQ 只当 transport**：actor 里 initiate，结果写业务 slice，UI 只读 selector。保住灵魂，放弃 RTKQ 大半价值；
- **(b) UI 直接用 hooks**：拿满 RTKQ，但读路径两个住址，且"重启恢复原状"要单独设计；
- **(c) 分层**：TDP 投影来的主数据走 kernel slice + selector + 持久化；一次性查询/提交走 RTKQ hooks。判别式 = "这条数据重启后还需要吗"。

我倾向 (c)，但这是您的产品语义判断，不是我能代裁的。

### Q-07 automation 的组合形态
接受"自研 runtime 控制面（state/request/command/wait）+ Maestro 驱动 UI"的组合吗？还是坚持全自研一套（POC 现状的加强版）？
第二问：`scripts.execute`（任意脚本执行）要不要带到 TER？它是 escape hatch，也是安全面。

### Q-08 测试 runner
vitest 一套到底，还是引入 Jest？您提到"有些用 Jest"，但 POC 全用 vitest 且 RN 生态正在向 vitest 迁移。引入第二套 runner 的收益是什么？

### Q-09 persist-mmkv 与 persist-sqlite 的分工
POC 只有 KV（MMKV）。两个后端并存的判别式是什么？我的猜测是"KV 存运行时状态与小配置，SQLite 存主数据（商品/SKU/菜单）与订单流水"，但这取决于 X-06 的数据量级，需要您给真实数字或至少量级。

### Q-10 Expo SDK 57 / React Compiler 的版本事实
我的知识不足以给准 SDK 57 对应的 RN/React 版本与 React Compiler 支持状态。您是希望我现场跑 `npx create-expo-app` 建一个空工程验证，还是您已有确定信息？

### Q-11 性能问题的真实来源
R-07（React Compiler）解决的是重渲染。您观察到的 POC 性能问题具体是什么现象？（首屏慢 / 列表滚动卡 / 双屏同步延迟 / 大批量投影应用时卡顿 / 内存增长）
**这条直接决定 React Compiler 是不是对症** —— 也决定要不要虚拟列表、SQLite、投影批处理。

### Q-12 目录规范如何强制
去掉 `1-/2-/3-/4-` 数字前缀后，"依赖只能往下层走"靠什么保证？
- 靠命名约定 + review（POC 现状）
- 补一道机械门（v2s 有 `scripts/check/code-layout` 先例）
- 靠 TS project references / eslint import 规则

另：`server-config`、`test-support`、`mock-server` 在您给的结构里没有位置，放哪？

### Q-13 TER 的编码规范正本
新写 `doc/platform/terminal-coding-standard.md`，还是扩展现有前端规范？我倾向新写一份并**指针引用**现有前端规范里的通用条款（§3-B/§3-C/§3-E/§3-G/§4-A/§4-B/§4-D），不复制内容 —— 符合"同一条规则只住一处"。

### Q-14 Electron 的时机
现在只建空目录（=为想象中的未来付费，v2s charter §2-A 禁止），还是同步做，还是明确推迟到某个触发条件？

### Q-15 第一批范围
建议第一批**只做地基**，不碰业务：
`kernel/base` 的 execution/state/transport/contracts/platform-ports + `ui/base` 的 runtime-react + `adapter/android` 的 2-3 个 expo-module + `assembly/android` 的最薄壳 + 双屏原型（Q-03b）+ 一条端到端"启动→恢复原状"证明。
您认可这个切法吗？还是希望第一批就带一个真实业务 Journey？

---

## 7 · 第二轮：Dexter 裁定与由此产生的新问题（2026-08-27）

### 7.1 已裁定（记录，不再讨论）

| 原问题 | 裁定 | 对设计的影响 |
|---|---|---|
| Q-02 服务端对手方 | **当前不接服务器**；后续对手方是 `apps/backend/catering-business-server` 与 `apps/backend/terminal-data-server`；POC 的 mock-server **不带过来** | 见 7.3 —— 决定第一批能做到哪 |
| Q-03 单机双屏 | 一个 ReactHost 挂多个 Root Surface，两个 Activity，Kotlin 按屏传不同参数，JS 自行判断渲染，**共享同一个 Hermes VM 与 JS 线程**；command 由一层逻辑判断走 WS 还是本机直传 | 见 7.2 |
| Q-03b 原型时机 | 当前只讨论方案，不做任何实施 | 原型列为方案确定后的第一个执行项 |
| Q-05 SSE | **放弃 SSE，回到 WS** | TDP 上行五类消息无需重新设计；POC 的 WS 协议与 socketRuntime 可直接继承。整块风险消除 |
| Q-06 RTK Query 定位 | ⚠️ **本行已被 2026-08-28 二次裁定取代**：最终裁定为 **不使用 RTK Query**（`T-5`），改为 OpenAPI → 类型化 client 生成 + `kernel.base.transport` 执行全部策略。原裁定「RTKQ 只当 transport」保留仅作过程留痕 | 最终形态与理由见 `2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md` §4B.10 T-5 |
| Q-07 automation | **完全自研**，用 helper 尽量减少对业务代码的侵入 | 不引 Maestro。侵入性问题改由 primitive 层统一注册解决 |
| Q-09 持久化分工 | MMKV：UI 状态、各类配置；不持久化：一次性查询结果；**SQLite：核心业务数据（订单等）需要本机查询/汇总的** | 引出一个 POC 没有的新概念，见 7.4 |
| Q-10 Expo 版本 | Dexter 有把握，不用管 | 不再列为风险 |
| Q-11 React Compiler | **当前不引入**；性能等有真实业务后再针对性优化 | 但 hooks 规则仍建议从第一天就开 error，见 7.6 |
| Q-13 编码规范 | 按 Claude 建议：新写 `terminal-coding-standard.md`，通用条款指针引用现有前端规范 | |
| Q-14 Electron | 先把 Android 做完整；**当下建空目录**（kernel 与 UI 共用） | 与 v2s 对 `terminal-data-server` 的做法一致：空目录 + README 写明边界 |
| Q-15 第一批 | **只打地基** | 见 7.7 |

### 7.2 Q-03 的技术答案（已亲验 RN 0.84.1 源码）

**结论：能做到，而且 POC 现在只差一个 manifest 属性。**

证据：

1. `ReactApplication.kt` —— `ReactHost` 挂在 **Application** 上，同进程内所有 Activity 共享同一个；
2. POC 副屏之所以是第二套 JS 环境，唯一原因是
   `4-assembly/.../android/app/src/main/AndroidManifest.xml` 里 `SecondaryActivity` 节点上的
   **`android:process=":secondary"`** —— 独立进程 → 独立 Application → 独立 ReactHost → 独立 Hermes VM；
3. `ReactHostImpl.kt` 第 336-347 行
   `createSurface(context, moduleName, initialProps): ReactSurface` —— **initialProps 是 per-surface 的**，
   正是"Kotlin 传不同参数给 JS"；
4. `LaunchOptionsFactory.create(context, displayIndex)` 已经在按屏产出不同 Bundle，原样可用；
5. JS 侧 `UiRuntimeRootShell display="primary"|"secondary"` 已是"各自渲染"的形态。

**必须绕开的坑（已亲验）**：`ReactHostImpl` 只有**一个** `currentActivity` 槽位。

- 第 252 行：`onHostResume(activity)` → `currentActivity = activity`
- 第 266-288 行：`onHostPause(activity)` 检查 `activity === currentActivity`，不等时抛
  `"Pausing an activity that is not the current activity, this is incorrect!"`，
  默认走 `Assertions.assertCondition`（断言失败），只有 `skipActivityIdentityAssertionOnHostPause()`
  feature flag 打开才降级为 `FLog.w`。

双屏设备上两个 Activity 在不同 Display 上**同时 resumed**。两个都走标准 `ReactActivity`/`ReactDelegate`
就会互抢 `currentActivity`。两种绕法：

| 形态 | 做法 | 取舍 |
|---|---|---|
| **一（Claude 倾向）** | 只有 `MainActivity` 是 `ReactActivity` 并独占 host 生命周期；副屏用 `android.app.Presentation` + `reactHost.createSurface(...)` 挂 `ReactSurfaceView` | 少一层，生命周期竞争在物理上不存在；副屏无独立返回键/输入法/configChanges |
| **二（Dexter 描述）** | 去掉 `android:process`；`SecondaryActivity` **不继承 `ReactActivity`**，用普通 Activity 自行 `createSurface`，**不调** `onHostResume/onHostPause/onHostDestroy` | 保留副屏独立 window flags/theme/输入行为；`launchDisplayId` 投屏逻辑不变 |

两种都满足"共享 VM、各自渲染、各传参数"。副屏若将来要独立处理输入（客显触摸、扫码枪直连副屏），形态二更稳。
**建议用最小原型实测再定** —— `Presentation` 内挂 Fabric surface 的触摸/DPI/尺寸行为无实测数据。

**关于"副屏发 command 主屏也能收到"**：共享 VM 且**只有一个 store** 时，本机不存在"传递" ——
同一个 dispatcher、同一个 actor 注册表、同一份 state，两块屏各自重渲染。真正的判别式不是"哪块屏"，
而是**"对端在不在这台机器上"**：

| 场景 | 机制 |
|---|---|
| 同机双屏 | `target: 'local'` → 同一 dispatcher，零传输 |
| 跨机双终端 | `target: 'peer'` → peer gateway → WS |

接缝 POC 已有：`CommandDefinition.defaultTarget: 'local' \| 'peer'` +
`RuntimeModuleContextV2.installPeerDispatchGateway(gateway)`。
`topology-runtime` 跨机时装 WS 网关，同机时不装。**kernel 一行不改。**

### 7.3 【新】不接服务器时，地基做到哪（Q-02 的后果）

三个包直接受影响：

| 包 | 状态 | 理由 |
|---|---|---|
| `transport`（HTTP 多地址 failover + socket 生命周期） | **建议做** | 纯基础设施，与协议无关；测试用 vitest 内 `http.createServer` / `ws` 起临时 server 即可，那是 test fixture 不是 mock-server 包 |
| `tcp-control`（激活控制面） | **建议不做** | 它编码的是 POC 与 mock-terminal-platform 共同设计的协议；v2s 的 `catering-business-server` 会定自己的。现在做 = 建在沙上 |
| `tdp-sync`（数据面 6,903 行） | **建议不做** | 同上，且 `terminal-data-server` 是空占位 |

**判别式**：这个包编码的是**机制**还是**协议**？机制可以先做，协议必须等对手方。

### 7.4 【新】SQLite 不是 KV —— POC 没有这个概念（Q-09 的后果）

POC 的持久化引擎是 **slice → KV 条目**（`StateStoragePort` 只有 `getItem/setItem/removeItem/multiGet/...`）。
"订单需要本机查询、汇总"表达不成 KV，它需要一个**本地数据库**：自己的 schema、自己的迁移、自己的查询。

由此产生的设计问题：**订单到底进不进 store？**

- 全量进 store + 镜像到 SQLite ⇒ store 无界增长，SQLite 的意义消失；
- SQLite 是真相、store 只放**读模型** ⇒ "页面数据全走 store、崩溃恢复原状"**仍然成立**，
  因为页面用的读模型在 store 里，而它的来源（SQLite）是持久的。

建议按后者，落成三件新东西：

1. `platform-ports` 新增 `LocalDatabasePort`（与 `StateStoragePort` 并列，不是它的扩展）；
2. slice descriptor 新增一档来源语义（POC 只有 `persistIntent: never|owner-only`），
   区分"我是 MMKV 持久化的真相"与"我是 SQLite 投影出来的读模型，重启由 owner 重建而非从 KV 恢复"；
3. 本地 schema 迁移机制（相当于终端侧的 Flyway），并明确谁 owner、谁写、谁投影。

⚠️ 这是 TER 相对 POC **最大的一处新增架构**，不是搬运。建议单独开一轮讨论。

### 7.5 【新】RTKQ-as-transport 的两个具体注意事项（Q-06 的后果）

1. **`initiate` 的生命周期义务适用于 100% 的调用点**。
   v2s 前端规范 §3-C 记着：`dispatch(endpoint.initiate(...))` 必须配 `.unsubscribe()`（query）/
   `.reset()`（mutation），或传 `{subscribe:false}` / `{track:false}`；实测泄漏形态是
   3 个 query + 1 个 mutation = **4 次 HTTP**（对照组加 `{subscribe:false}` 是 1 次），
   且 mutation 条目会带完整响应体永久驻留。
   POC 的形态里这条只影响少数命令式读；TER 的形态里**每一次取数都走 initiate**。
   ⇒ 必须把它包成**一个共享 helper**（`callEndpoint(endpoint, args)`），义务只履行一次，
   不能交给每个 actor 自己记。

2. **诚实的方案合理性提醒**：RTKQ 当纯 transport 时，它的 cache / tag 失效 / hooks 全部用不上，
   实际用到的只有"OpenAPI 生成 + 类型化 endpoint + baseQuery 接缝"。
   同等能力的更轻方案存在（`openapi-typescript` + `openapi-fetch`，或 orval / hey-api，
   配 POC 的 `httpRuntime`）。
   ⚠️ **本段结论已自我推翻（2026-08-28）**：最终裁定为**不使用 RTKQ**（`T-5`）。
   下面这段"不建议换"的论证保留仅作过程留痕 ——
   其错误在于：TER 本就要以完全不同的方式使用 RTKQ（无 hooks / 无缓存 / 无 tag 失效），
   "同一个库、相反的用法"比"不同上下文用不同工具"更容易误导后来者；
   且 RTKQ 会自装 reducer 绕开 actor 路径，与 `TR-01` 冲突，需永久豁免。
   原文如下：**我不建议换**，理由是"统一标准"压过"更轻"：v2s 两个后台已经全用 RTKQ，
   codegen 链路（`scripts/check/edge-codegen`）已存在，Codex 与 Claude 都熟。
   多一个工具的长期成本高于这里省下的那点重量。记录此判断供后续复核。

### 7.6 React Compiler 不引入，但两件事仍建议做（Q-11 的后果）

1. `eslint-plugin-react-hooks` 从第一天就设 **error**（v2s 根已装 7.0.1）——
   将来想开 Compiler 时是"打开开关"，不是"先还三个月技术债"；
2. **`FIX-07` 那 5 处条件 hook 不能搬过来**，理由与 Compiler 无关：
   `const x = xProp ?? useOptionalXxx()` 在 `xProp` 从 `undefined` 变成有值时，
   **hook 调用数会变化**，React 直接抛 `Rendered fewer hooks than expected`。
   这是潜伏的崩溃，不是风格问题。

### 7.7 【新】依赖方向怎么强制（Q-12 的答案）

三层，缺一层就会被绕过：

| 层 | 机制 | 作用 |
|---|---|---|
| 真相源 | 每个包 `package.json` 的 `dependencies`，用 `workspace:*` | 这是 Yarn 实际解析的东西，不是注释 |
| 机械门 | 一个 checker 脚本（约 60-80 行） | 见下面两条断言 |
| 即时反馈 | eslint `no-restricted-imports` 路径模式 | 写代码时就红，不用等门 |

**checker 必须有两条断言，只有第一条会变成纸糊的门**：

- **(a) 方向断言**：按目录把每个包映射到层（kernel/ui/adapter/assembly），
  断言 `dependencies` 里没有反向或跨层非法依赖；
- **(b) 声明完整性断言**：源码里每一个 `@ter/*` import，
  在本包 `package.json` 里都必须有对应声明。

没有 (b)，(a) 就能被绕过 —— Yarn 的 node_modules linker 会 hoist，
**未声明的包在运行时照样 import 得到**，于是 (a) 检查的那份 `dependencies` 根本不是真实依赖图。

**红夹具**：在 `kernel/base/<x>` 的 package.json 加一条对 `ui/base/<y>` 的依赖 → 门必须红；
在 `kernel/base/<x>` 源码里 import 一个未声明的 `@ter/*` → 门也必须红。
**反例栏**：deep import（`@ter/pkg/src/internal/...`）绕过 exports 边界 —— 这条 (a)(b) 都抓不到，
需要第三条断言或靠包的 `exports` 字段收口。

### 7.8 【新】server-config 与 test-support 的落位（Q-12 后半的答案）

**`server-config`：建议不要单独成包，取消这个概念。**
理由是 `FIX-12`：POC 把开发机 LAN IP（`http://192.168.0.172:5810`）硬编码进 `server-config-v2/src/dev.ts`，
这本身就是问题。正确的切法是：**类型/形状**留在 `kernel/base/contracts`（`TransportServerConfig` 本来就在那），
**具体地址值由 assembly 作为产品/环境配置注入**。这样既少一个包，又顺手修掉 `FIX-12` ——
符合"assembly 拥有产品与环境策略"的既有分工。

**`test-support`：保留两份，一层一份。**
`kernel/base/test-support` 与 `ui/base/test-support`，都只做 devDependency。
分两份的硬理由：kernel 侧必须保持 React-free / RN-free（否则 node 测试跑不起来），
放在 kernel 内部才好用同一道门管住。
⚠️ 并且建议**第一天就建共享 live-harness** —— POC 的
`tdp-sync-runtime-v2/test/helpers/liveHarness.ts` 与 `ui-runtime-v2/test/helpers/liveHarness.ts`
结构相似却各写一份，`kernel-core-dev-methodology.md` §六自己也写了"还可以继续抽象一个通用 shared-dev harness"。
每包一份 liveHarness 正是 `KEEP-02` 的反面。

### 7.9 【新】测试 runner：不引 Jest（Q-08，Claude 判断）

**判断：vitest 一套到底，不引 Jest。**

理由：

1. POC 129 个 spec 全在 vitest 上，API 面与 Jest 对我们的用法没有区别；
2. POC 真正缺的不是"Jest"，是**DOM 环境**（前端规范 §1-1 记着：单元层走 `renderToStaticMarkup`，
   **effect 不跑、remount 观察不到**）。而这个缺口 **Expo Web 浏览器那条道覆盖得比 jsdom 更好** ——
   真浏览器、真 effect、真布局、真事件，`test-expo/` 已有 670 行可运行实例；
3. 引 Jest = 第二套 runner 配置、第二套 transform、第二套 mock 体系，
   外加一个长期存在的"这个用例该写哪边"的问题。

**必须诚实说出的反面**：`jest-expo` 是 Expo 官方支持的 preset，
`@testing-library/react-native` 的文档默认 Jest。
如果将来遇到**只能用 RN 自己的 renderer 才能测**的原生组件，vitest 需要额外配置工作。
我的判断是接受这个风险，把这类用例放到**设备自动化那条道**去覆盖，而不是为它引入第二个 runner。

**三条道的最终形态**：

| 道 | 跑什么 | 用什么 |
|---|---|---|
| node | kernel 全部、UI 的纯逻辑、真实 runtime 闭环（多 runtime、持久化重启） | vitest（node env）+ 共享 live-harness |
| 浏览器 | UI 渲染行为、effect、交互、双屏预览 | Expo Web + 浏览器自动化 |
| 设备 | 原生能力、真机双屏、端到端 | 自研 automation 控制面（Q-07）+ 各 expo-module 的 dev-app |

### 7.10 【新】POC 有两个死包，不要搬（亲验）

`1-kernel/1.1-base/execution-runtime`（966 行）与 `1-kernel/1.1-base/host-runtime`（3,174 行）
在全仓 `*.ts`/`*.tsx` 中的 import 命中数均为 **0**（穷举范围：`1-kernel` `2-ui` `3-adapter` `4-assembly`
`0-mock-server` 下所有 ts/tsx，排除 node_modules）。只有它们自己的 `package.json` 提到自己。

真正在用的是 `runtime-shell-v2`（**225 处** import）。
合计 4,140 行死代码，占 kernel/base 的约 6.7%。**TER 不要继承这两个包。**

---

## 8 · POC 架构评价（重构视角，非搬运视角）

> 本节回答的是"这套架构哪里对、哪里错、重构后该长什么样"，不是"有哪些功能"。
> 判断依据全部来自亲验的源码，引用处给路径与行号。

### 8.0 三条前一轮的自我纠正

| # | 我前一轮说错的 | 事实 |
|---|---|---|
| 1 | 把仓规的"R 原子交付"与"超过半小时先切小"讲成互相冲突，因此建议 TER 另立一份治理载体 | **不冲突，是我读错了。** 两条的正确读法是"R 的**范围**要定得足够小"，而不是"定大了再拆"。规矩一套即可，TER 与主仓同规。**不再建议第二份治理文件。** |
| 2 | 建议 `platform-ports` 新增 `LocalDatabasePort`，与 `StateStoragePort` 并列 | **方向错了。** Dexter 的要求是：**非 adapter 层对 MMKV / SQLite / webstorage 完全无感**。kernel 只声明"这份数据要什么能力"，选后端是 adapter 的事。所以端口形状必须是**能力型**（"持久 + 可本机查询汇总"），不能是技术型（"SQLite"），更不能让 kernel 写 SQL |
| 3 | 把 SQLite 数据描述成"store 里的读模型 + 落 SQLite" | **半对。** 正确的是：**要进 SQLite 的数据不走 store 的自动 persist**。store 里可以有它的查询结果（一次性的、不持久化的），但那份数据的持久化真相在 adapter 后面，不由 slice descriptor 的 `persistence` 描述 |

⚠️ 第 2、3 条对应的能力 Dexter 已裁定 **"等有真实业务再补"**，此处只留纠正后的约束，不展开设计。

### 8.1-8.2 好的与不好的 → 见台账

逐条内容在 **`2026-08-27-v2s-terminal-poc-findings-ledger-claude.md`** 的第一部分（`KEEP-01..24`）与第二部分（`FIX-01..17`）。
平台约束在第三部分（`CON-01..04`）。本节只保留 §8.0 的自我纠正与 §8.3 的整体判断。

### 8.3 整体判断

**这是一套明显高于平均水平的架构，它的缺陷几乎全在"边界的形状"，而不在"边界是否存在"。**

- 该有的边界都真实存在并且**被字节验证过**（kernel 零 React、assembly 30 行、adapter 纯 Kotlin）；
- 全仓 production 代码 `TODO/FIXME/HACK` **零命中**，说明"不留临时方案"这条红线是真执行的；
- 设计文档会记录被推翻的方案。

**而"边界形状不对"是最便宜的一类问题** —— 重新切包、给端口补类型、换一个时钟策略，都是在既有骨架内动手；比"没有边界、要从头引入"便宜一个数量级。

所以我对重构范围的判断是：**骨架整体继承，八处形状重做。**
真正需要新设计的只有两处：**单机双屏改一个 store 一个 VM**（§7.2）与**本地可查询业务数据的能力型端口**（8.0-2，已裁定推迟）。其余都是把已有的东西换个切法。

---

## 9 · 本稿的边界

1. 本稿只做事实盘点与问题澄清，**不构成设计、不构成评审结论、不授权实施**；
2. POC 仓为只读 Heritage，本稿未回写任何内容；
3. 标注 `UNVERIFIED` 的条目（Expo SDK 57 版本事实、React Compiler on RN 成熟度、RN 多 surface 可用性、RN 的 SSE 方案、NativeWind/RNR 兼容矩阵）需要现场实验或官方一手资料，我在此环境未验证，不以确定语气陈述；
4. 我的方案倾向（R-04 路线 A、R-05 分层 (c)、R-06 拆两半）都是**待辩论输入**，不是结论。产品语义、范围与优先级归 Dexter。

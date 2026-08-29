# POC(newPOSv1) 好/坏台账 · TER 重构输入

- 日期：2026-08-27 · 作者：Claude · 分析对象：`/Volumes/idea/newPOSv1`（只读 Heritage）
- 本文性质：**事实台账，唯一内容源**。讨论过程、需求评估与待裁问题在
  `2026-08-27-v2s-terminal-poc-analysis-and-ter-design-discussion-claude.md`，那份**只指过来，不复述**。
- 不构成评审结论，不授权实施。

## 0 · 怎么读

| 编号 | 含义 |
|---|---|
| `KEEP-xx` | POC 做对了，TER 重构时必须保住 |
| `FIX-xx` | POC 的缺陷，TER 必须改形状 |
| `CON-xx` | 不是 POC 的对错，是平台/框架的既有约束，重构时必须绕开 |

**证据档位**（每条必标）：

- `已亲验` — 打开源码看过，给出路径与行号或穷举计数
- `推论` — 由已验事实推导，推导链写出来
- `UNVERIFIED` — 需要现场实验或一手资料，本轮未验证

**穷举范围**（凡计数类结论，分母都取自这个范围）：
`1-kernel/` `2-ui/` `3-adapter/` `4-assembly/` `0-mock-server/` 下的 `*.ts` `*.tsx` `*.kt` `*.json`，
排除 `node_modules/` `dist/` `build/` `.turbo/`。

**规模基线**：kernel 645 文件 / 61,594 行 · ui 308 / 27,347 · adapter 59 / 4,240（另有 Kotlin adapter-lib）
· assembly 26 / 5,064 · mock-server 133 / 53,220 · 测试 spec 129 个 · 工作区包 33 个。

---

# 第一部分 · KEEP（做对了，要保住）

## KEEP-01 分层纪律落到了字节，不是文档里的声称

**证据 · 已亲验**

1. `1-kernel/**` 全部 13 个包**零 `react` / `react-native` / `react-redux` import**；
2. `4-assembly/android/mixc-catering-assembly-rn84/App.tsx` **全文 30 行**，只调
   `createHostApp({RootScreen, createShellModule, extraKernelModules, productConfig})`；
   该包 `src/` 下只有 `generated/releaseInfo.ts` 一个文件；
3. `3-adapter/android/adapter-android-v2/adapter-lib` 是**纯 Kotlin、不依赖 RN**，
   另带 `dev-app`（独立 Android App，逐能力手测）与 9 个 JUnit 测试。

**为什么**：边界的价值不在于画出来，在于**它挡住了什么**。这三条各挡住一类退化 ——
kernel 挡 UI 泄漏、assembly 挡业务下沉、adapter 挡"必须起 RN 才能验原生"。
kernel 零 React 是它能在 node 环境跑 129 个 spec 的**物理前提**，不是风格偏好。

**TER 动作**：三条全部继承，作为地基硬约束。adapter 的 dev-app 形态在 expo-module 下等价保留。

## KEEP-02 每个包一套固定骨架

**证据 · 已亲验**：`1-kernel/1.1-base/*` 与 `2-ui/2.1-base/*` 全部 20 个包同一套目录 ——
`application/`（createModule · moduleManifest）· `features/{actors,commands,slices}/` ·
`foundations/` · `hooks/` · `selectors/` · `supports/` · `types/` · `generated/packageVersion.ts` ·
`moduleName.ts` · `index.ts`。逐包打开确认，零变形。

**为什么**：这不是文档要求，是"功能模块化"的**物理载体**。人和 AI 打开任何包都知道去哪找什么，
这是"可单独或组合测试验证"的前提。

**TER 动作**：继承整套骨架。命名上 `business` → `feature`（Dexter 已定）。

## KEEP-03 slice descriptor：六个字段声明完持久化与同步

**证据 · 已亲验**：`1-kernel/1.1-base/state-runtime/src/types/slice.ts`

```ts
{name, reducer, persistIntent, syncIntent, persistence, sync}
```

- `persistIntent: 'never' | 'owner-only'`
- `syncIntent: 'isolated' | 'master-to-slave' | 'slave-to-master'`
- `persistence`：`field`（按字段一 key）/ `record`（按条目一 key + `__manifest__`），
  带 `protection: 'plain' | 'protected'`、`flushMode: 'immediate' | 'debounced'`
- `sync`：record 语义，值包 `SyncValueEnvelope {value, updatedAt, tombstone}`

约 40 个 slice 在用；业务包**写零行持久化代码、零行同步代码**。

**为什么**：它满足"抽象要有多个实现才建"的判据；而且抽的是**声明**不是**行为**，
所以新增一个 slice 不需要理解持久化引擎。这是好抽象与坏抽象的分水岭。

**TER 动作**：整体保留。唯一要补的是"这份数据的真相不在 KV 里"这一档语义（见 `FIX-15` 关联项）。

## KEEP-04 按字段/按条目落盘，不是整块 blob；普通与加密两个后端

**证据 · 已亲验**：`state-runtime/src/foundations/createStateRuntime.ts`（690 行）自研持久化引擎，
**没有用 redux-persist**（`foundations/store.ts` 只有 71 行纯 RTK `configureStore`）。
storage key 形态 `<persistenceKey>:<sliceName>:<field 或 entryKey>`，record 型另写 `__manifest__`。
`protection: 'protected'` 走 `secureStateStorage` 端口。

**为什么**：整块 blob 写盘在终端上是两个问题 —— 写放大（改一个 UI 变量重写全部状态）
和恢复粒度（一处损坏全部丢失）。按条目落盘两个问题同时消失。

**TER 动作**：继承。后端选择（MMKV / SQLite / webstorage）由 adapter 决定，kernel 无感（Dexter 已定）。

## KEEP-05 清空写 `null + updatedAt`，不用 `delete`

**证据 · 已亲验**：`ui-runtime-v2/src/features/slices/screenState.ts` 的 `resetScreen`
写 `{value: null, updatedAt: nowTimestampMs()}`；
方法论 `spec/kernel-core-ui-runtime-dev-methodology.md` §1.3 写明理由。

**为什么**：`delete` 在同步语义里是**没有事件**的 —— 对端收不到一次明确覆盖，
只能靠"我这有、你那没有"去猜，而那正好和"还没同步到"无法区分。

**TER 动作**：继承。即便本机双屏改成一个 store（无同步），跨机同步仍成立。

## KEEP-06 广播式 command + 聚合四态

**证据 · 已亲验**：`runtime-shell-v2/src/foundations/runtimeCommandDispatcher.ts`
第 100 行设计意图注释；实现语义为

- 一条 `commandName` → N 个 actor handler，`Promise.all` 并发，聚合为 `CommandAggregateResult`
- 四态 `COMPLETED / PARTIAL_FAILED / FAILED / TIMEOUT`
- 每条 command 自带 `timeoutMs`（默认 60s）· `allowNoActor` · `allowReentry` · `visibility` · `defaultTarget`
- 重入保护键 `requestId + commandName + actorKey`；actor 可派子 command，继承同一 `requestId`，
  `parentCommandId` 串链

**为什么**：POS 里一个用户动作经常要多个 owner 同时反应（下单 = 订单 + 库存 + 打印 + 客显）。
写成"调 A 再调 B 再调 C"的编排代码是最容易腐烂的那类；写成"一条 command、N 个 actor、聚合状态"，
编排代码就不存在了。
而且 **`PARTIAL_FAILED` 是一等状态** —— 多数系统假装它不存在，然后在生产里发现它存在。

**TER 动作**：整体继承，包括四态与串链。

## KEEP-07 request ledger 进 state，UI 不持有 in-flight 状态

**证据 · 已亲验**：`runtime-shell-v2/src/foundations/requestLedger.ts`（427 行），
请求生命周期落进 state，UI 用 selector 读进度；
`ActorExecutionContext.queryRequest(requestId)` 供 actor 侧查询。

**为什么**：这是"崩溃后恢复原状"能成立的**真正原因** ——
没有任何 in-flight 状态只活在闭包或 promise 里。UI 因此不需要回调、不需要持有 promise。

**TER 动作**：继承。`requestLedger` 427 行值得在重构时重新看能不能更薄。

## KEEP-08 需要确认的领域行为拆成两段

**证据 · 已亲验**：`spec/layered-runtime-communication-standard.md` "Interaction Requests Are Separate
From Execution Commands"；实例是 topology 电源触发显示模式切换 ——
`topology-runtime-v3` 发 `request-*` → UI bridge 开确认框 → 用户确认 → dispatch 执行 command。

**为什么**：一条 command 同时意味着"弹个确认框"和"改状态"，会让**业务时序散进 UI 组件**。
拆两段之后时序留在 runtime 层，UI 只负责"渲染请求 + 把用户的答复发回去"。

**TER 动作**：继承，作为规范条目写进 `terminal-coding-standard.md`。

## KEEP-09 区分"恢复真相源"与"运行时观察值"

**证据 · 已亲验**：`spec/kernel-core-dev-methodology.md` §1 提出两问 ——
"重启后是否必须保留它，否则只能全量重建？" / "它是否只是某次连接、某次命令的运行态观察值？"。
且**真的实现了**：TDP 只持久化 `tdpSync.lastCursor` / `lastAppliedRevision`；
`tdpProjection` / `tdpCommandInbox` / `tdpSession` / `tdpControlSignals` 全部不持久化；
bootstrap 只 reset runtime 字段，保留恢复游标。

**为什么**：绝大多数"持久化 bug"的根因就是把观察值当真相源，
重启后拿到一个**看起来像新状态的旧状态**。

**TER 动作**：写进 `terminal-coding-standard.md`，作为设计 slice 的第一问。

## KEEP-10 scoped slice：同一份状态按轴复制

**证据 · 已亲验**：`state-runtime/src/supports/scopedSlice.ts` 提供
`workspace` / `instanceMode` / `displayMode` 三轴；`ui-runtime-v2` 的 screen slice 实际展开为
`<base>.main` 与 `<base>.branch`，各自声明同步方向
`{main: 'master-to-slave', branch: 'slave-to-master'}`。

**为什么**：它把"同一类状态按屏/按角色存多份"从**每个业务包各写一遍**变成**声明一个轴**。
并且这正是"一个 store 也能承载双屏"的现成机制（见讨论稿 §7.2）。

**TER 动作**：继承。单机双屏改一个 store 后，两块屏读不同 scope，天然不打架。
⚠️ 已知约束：scope 取值列表在声明期固定（`['main','branch']`），不是运行期动态的。

## KEEP-11 一主一副 pair 模型统一四种场景

**证据 · 已亲验**：`docs/superpowers/specs/2026-04-18-topology-runtime-v3-design.md` §5 ——
单机双屏 / 双机单屏 / 双机双屏都建模成"一个 master + 一个 slave + 一条 pair link"；
运行上下文由 `deriveTopologyV3RuntimeContext` 推导
（`standalone = displayIndex === 0`；`workspace = (SLAVE && PRIMARY) ? 'BRANCH' : 'MAIN'`）。

**为什么**：该文档 §1.4 明确记录了上一轮"把业务拓扑误建模成图网络"的错误并给出证据链改正。
**这是已经被证伪过的方向，不要重走。**

**TER 动作**：跨机部分继承 pair 模型。同机部分因"一个 store"而不再需要 link（见讨论稿 §7.2）。
⚠️ 若将来出现"一主多副"（收银屏 + 客显 + 叫号屏），这条要重新裁决，不能默默扩展成 mesh。

## KEEP-12 多地址故障切换 + 偏好地址黏住

**证据 · 已亲验**：`transport-runtime/src/foundations/httpRuntime.ts`

- `serverCatalog`：`serverName → TransportServerAddress[]`（`addressName / baseUrl / timeoutMs`）
- 调用循环：`for 重试轮 { for 该轮地址列表 { 尝试 } }`
- 成功即 `rememberPreferredAddress(serverName, addressName)`；`replaceServers` 时清空偏好
- `failoverStrategy: 'ordered' | 'single-address'` · `retryRounds` · 可注入 `shouldRetry(error, request)`
- `HttpExecutionController`：并发闸门 + 滑窗限流
- 每次尝试产出 `HttpAttemptMetric`，整次调用产出 `HttpCallMetric`
- `socketRuntime` 用同一套地址选择与偏好记忆做 WS 重连

**为什么**：门店网络有多条可达路径（LAN / 本机 / 域名），任何一条都可能间歇不可用。
"多地址 + 失败切换 + 成功后黏住"是这个场景的正确形状，而且**它是我们的策略，不是 HTTP client 的**。

**TER 动作**：继承，并且**必须留在 transport runtime 里**，不交给任何 HTTP client 实现
（RTKQ 也好、生成的 fetch client 也好，都只是它下面的一层）。

## KEEP-13 transport 不解释业务成功语义

**证据 · 已亲验**：`httpRuntime.ts` 顶部注释原文 ——
"它故意不解释业务 envelope 成功/失败语义，避免 transport 和业务完成语义再次混在一起"。

**为什么**：HTTP 200 ≠ 业务成功。两者一旦在 transport 层混同，
后面每一处业务判断都要重新拆开，而且拆不干净。

**TER 动作**：原样继承。

## KEEP-14 结构化 LoggerPort，脱敏是类型里的字段

**证据 · 已亲验**：`platform-ports/src/types/logging.ts`

```
LogEvent = {timestamp, level, category, event, message,
            scope{moduleName, layer, subsystem, component},
            context{requestId, commandId, commandName, sessionId, connectionId, nodeId, peerNodeId},
            data, error,
            security{containsSensitiveRaw, maskingMode}}
```

支持 `scope()` / `withContext()` 派生。

**为什么**：`security.containsSensitiveRaw` 是**类型里的字段**而不是口头约定 ——
写日志的人必须回答这个问题。而且这套结构天然可以映射到任何 APM：
`scope` → tags，`context` → contexts，`error` → exception。

**TER 动作**：继承。Sentry 以 sink 形式接入（`FIX-09`），业务代码零改动。

## KEEP-15 platform-ports 是 kernel 唯一的平台事实入口

**证据 · 已亲验**：`platform-ports/src/types/ports.ts` 定义
`terminalLogs / scriptExecutor / stateStorage / secureStateStorage / device / appControl /
hotUpdate / topologyHost / localWebServer / connector`；
`spec/layered-runtime-communication-standard.md` "Facts Flow Up Through Ports" 明确外部事实只从这里进。

**为什么**：这是 `KEEP-01` 里"kernel 零 React/RN"能成立的机制 —— 有唯一入口，才谈得上守住。

**TER 动作**：继承机制。⚠️ 但端口的**形状**要改，见 `FIX-03` / `FIX-04`。

## KEEP-16 assembly 极薄

**证据 · 已亲验**：`App.tsx` 30 行（见 `KEEP-01`）。
`spec/layered-runtime-communication-standard.md` 里列出的一批 "Priority A/B/C 待迁移 assembly 逻辑"，
代码里已经全部迁到 `host-runtime-rn84`。

**为什么**：assembly 是最容易变成"什么都往里塞"的层，因为它是唯一能同时看到所有层的地方。
POC 定了硬约束"应迁尽迁、越薄越好"并且**真的迁完了**。

**TER 动作**：继承。`assembly/android` 的目标形态就是一个产品配置文件 + 打包配置。

## KEEP-17 测试三层：包内语义 / 真实闭环 / 浏览器

**证据 · 已亲验**

| 层 | 形态 | 位置 | 规模 |
|---|---|---|---|
| 包内语义 | vitest（node env） | `test/scenarios/*.spec.ts` | kernel 58 · ui 42 · assembly 19 · mock 10 |
| 真实闭环 | vitest + 真服务端 / 多 runtime | `test/helpers/liveHarness.ts` | tdp-sync、ui-runtime 各一份 |
| 浏览器 | **Expo Web + 浏览器自动化** | `test-expo/runAutomation.mjs` | runtime-react 670 行；admin-console 另一份 |

`runtime-react/test-expo/` 已实测覆盖：真实 kernel 启动、主副 root 渲染、navigate/replace/modal/
uiVariable/displayMode 命令、**两个浏览器页分别当 `displayIndex=0` 与 `1`**、
真实 `dual-topology-host-v3` 的 WS 连通。`expo ~54.0.31` 已是 devDependency。

**为什么**：这三层各自回答不同的问题 ——
"语义对不对" / "真跑起来对不对" / "渲染出来对不对"。少任何一层都会有一类缺陷永远发现不了。

**TER 动作**：继承三层。⚠️ 浏览器那层 POC 只有 2 个包在用，TER 要铺到全部 UI 包。
⚠️ `liveHarness` 目前每包一份且结构相似，TER **第一天就建共享 harness**
（POC 自己的方法论文档 §六也提出了这一点，只是没做）。

## KEEP-18 automation 在 Product 环境默认完全不启动

**证据 · 已亲验**：`docs/superpowers/specs/2026-04-18-ui-automation-runtime-design.md` §2.1 ——
Product 可以编入代码，但**默认不创建 runtime registry、不启动 socket/ws server、
不注册自动化 target、不保留 trace/snapshot listener**；需要显式调用启动入口。

**为什么**：automation 控制面能读全部 state、能 dispatch 任意 command、能执行脚本。
它在生产环境就是一个完整的后门。"默认 inert"是最低限度的正确姿态。

**TER 动作**：继承，并且**加强成可验证的**（见 `FIX-14`）—— 目前靠约定，不靠机制。

## KEEP-19 automation 的真正价值是暴露 runtime 内部事实

**证据 · 已亲验**：`ui-automation-runtime`（1,685 行）28 个方法，其中

- **无第三方可替代的**：`runtime.getState` / `selectState` / `listRequests` / `getRequest` ·
  `wait.forState` / `forRequest` · `command.dispatch` · `target: primary|secondary` 多屏寻址
- **第三方可替代的**：`ui.queryNodes / performAction / setValue / scroll / submit` ·
  `wait.forNode / forScreen`（Maestro、Detox 都能给）

**为什么**：这套东西的价值**不在驱动 UI**（那部分是重复造轮子），
而在**把 runtime 内部事实变成可断言、可等待的东西**。后者绑定的是自己的架构概念，没有外部替代品。

**TER 动作**：Dexter 已裁定完全自研。继承时重点保住"控制面"那一半的能力面，
并按 `FIX-08` 把 UI 语义来源从加法改成减法。

## KEEP-20 UI 状态三 slice + 禁止业务 slice 复制导航态

**证据 · 已亲验**：`ui-runtime-v2` 拆 `screen` / `overlay` / `uiVariables` 三个 slice；
`spec/kernel-core-ui-runtime-dev-methodology.md` §0.1 明文禁止 ——
"业务 UI 包不得在自己的 feature slice 中新增 `selectedTab`、`currentPage`、`activeScreen` 这类导航镜像状态"；
§0.2 要求容器默认页初始化统一走 `useUiScreenOrSetDefault` helper，
禁止业务组件手写 `selectUiScreen + useEffect + navigateTo(default)`。

**为什么**：这是"崩溃/被关闭后重启能恢复原状"能成立的机制性原因 ——
**当前在哪一页只有一个真相源**。有第二份镜像，恢复就会出现"页面对了但 tab 不对"这类不一致。

**TER 动作**：继承整条，包括那两条禁止句，写进 `terminal-coding-standard.md`。

## KEEP-21 按屏传不同 launch options，JS 侧自行判断渲染

**证据 · 已亲验**：`host-runtime-rn84/android/.../startup/LaunchOptionsFactory.kt`
`create(context, displayIndex)` 产出
`{deviceId, screenMode, displayCount, displayIndex, isEmulator, topology{role, localNodeId, ...}}`；
JS 侧 `UiRuntimeRootShell display="primary"|"secondary"` 各自渲染。

**为什么**：这正是"Kotlin 传不同参数给 JS、JS 自己判断"的现成机制，
而且它与"一个 ReactHost 挂多 surface"天然契合（`createSurface` 的 `initialProps` 是 per-surface 的）。

**TER 动作**：整体继承，`displayIndex` 从"进程参数"变成"surface 参数"。

## KEEP-22 踩过的坑写在代码旁边

**证据 · 已亲验**：`transport-runtime/src/foundations/socketProfile.ts` `buildSocketUrl` 内有一段注释：
RN84 + Hermes 在 Android 上 `new URL('ws://...')` 的 host 解析不可靠，会得到空 host，
导致原生 WebSocketModule 抛 `Invalid URL host: ""`，因此这里坚持纯字符串拼接。

**为什么**：这类"看起来多余、其实是踩过的坑"的代码，**没有注释就一定会被后人"优化"掉**。

**TER 动作**：继承这个习惯。TER 的规范里应有一条：绕过标准做法的写法必须就地写明原因与失败形态。

## KEEP-23 代码卫生：production 源码零 TODO/HACK

**证据 · 已亲验**：全仓 production `*.ts` `*.tsx` 中
`TODO / FIXME / HACK / XXX / workaround / 绕过 / 暂时` 命中 **0 条**
（唯一一条中文"临时"是页面文案，不是代码标记）。

**为什么**：与 `AGENTS.md` 的"不偷懒、不用临时方案"红线一致，说明那条红线是**真执行**的。
这在同规模项目里少见。

**TER 动作**：继承这个标准。

## KEEP-24 设计文档会记录被推翻的方案

**证据 · 已亲验**：`topology-runtime-v3-design.md` §1.4 白纸黑字 ——
"上一轮设计有一个根本性偏差：把业务拓扑误建模成图网络"，随后给出三处证据
（旧工程 `preInitiateInstanceInfo.ts`、v2 的 slave→master 同步测试、Android host 的 pair-oriented 实现）并改正。

**为什么**：记录**被证伪的设计**比记录最终设计更值钱 —— 它防止下一个人重走那条路。

**TER 动作**：继承这个习惯，不是这份文档。

---

## KEEP-25 动态脚本优先交给平台端口，不在 kernel 里绑死沙箱

**证据 · 已亲验**：`workflow-runtime-v2/src/foundations/scriptRuntime.ts` 的 `executeScript`
先取 `platformPorts.scriptExecutor`，有就用它；注释写明设计意图是
"让 Android/Electron/Node 用各自安全边界执行动态 JS，不把脚本沙箱策略绑死在 kernel 包内"。
Android 侧 `adapter-lib/.../scripts/ScriptEngineManager.kt` 用 **QuickJS**
（`com.whl.quickjs`），每次执行 `QuickJSContext.create()` 并在 finally 销毁，
即**独立于 App 自身 Hermes VM 的沙箱**；另有 `ScriptExecutionGate`（`ReentrantLock`）串行化执行。

**为什么**：动态脚本的沙箱策略是**宿主的事**，不是 kernel 的事。
把它做成端口，Android 用 QuickJS、Electron 可以用别的、Node 测试用别的，kernel 不变。
这个直觉是对的。⚠️ 但它的**回退路径**有缺陷，见 `FIX-22`。

**TER 动作**：保留"脚本执行走端口"的形状。是否还需要动态脚本能力本身，见 `FIX-18`。

## KEEP-26 引擎的各项限额走参数目录，不是硬编码常量

**证据 · 已亲验**：`workflow-runtime-v2/src/supports/parameters.ts` 定义 5 个参数 ——
`defaultWorkflowTimeoutMs`(60s) · `defaultStepTimeoutMs`(15s) · `eventHistoryLimit`(100) ·
`completedObservationLimit`(100) · `queueSizeLimit`(100)，全部带 `validate`；
`engineConfig.ts` 通过 `resolveParameter` 读取，可被运行时参数目录覆盖。

**为什么**：终端是**一整片设备**，超时和上限需要现场调而不是发版调。
把限额做成参数只在"参数目录机制本来就存在"时才划算 —— 这里正好成立
（`runtime-shell-v2` 的 `parameterCatalogState` + TDP 的 `parameterCatalog` topic）。

**TER 动作**：继承这个做法，作为"运行期可调限额"的统一形态。

## KEEP-27 workflow 引擎：一次目标明确、验证到位的机制 POC

**证据 · 已亲验**：`workflow-runtime-v2` src 3,823 行 / 43 文件，test 2,397 行（比约 0.63）。
它用**一个真实业务场景**（管理员扫码导入拓扑配对）把整条机制跑通：
声明式步骤树 → `external-call` → connector → 真机相机 INTENT → 解码结果回业务。
另有 289 行 live spec 单独验证"定义经 TDP projection 下发即可执行"。

**为什么算做对了**：POC 的判据是"**拿真实业务场景验证机制是否可行**"，
不是"是否已被多处采纳"、也不是"是否前后全面贯通"。
按这个尺子，它把五件事验证清楚了：真机端到端、沙箱内动态求值、远端下发、
排队/观察/取消/超时、限额运行期可调。

**其中三个形状本身值得继承**（与是否采纳引擎无关）：

1. **确认/长过程要有 observation + 队列 + 取消 + 超时四件套**，且进展经 state/selector 可读；
2. **动态执行走平台端口**，沙箱策略归宿主（`KEEP-25`）；
3. **限额走参数目录**，运行期可调（`KEEP-26`）。

**TER 动作**：形状继承。引擎本身是否采纳是独立的产品判断，见 `FIX-18`。

## KEEP-28 动作与事实成对：public 动作 + internal `*Succeeded` 广播

**证据 · 已亲验**：`tcp-control-runtime-v2` 的 11 条 command 里，5 条 public 动作各配一条 internal 事实广播
（`activateTerminal` / `activateTerminalSucceeded`、`refreshCredential` / `credentialRefreshed` …）；
`catering-shell/src/features/actors/tcpLifecycleActor.ts` 订阅 `activateTerminalSucceeded` 驱动 screen 路由。

**为什么**：下游模块订阅**"发生了什么"**，而不是轮询 selector 猜"状态变了没有"。
广播 command 在这里被当作**事实总线**用，不只是写指令。

**TER 动作**：形态继承。⚠️ 但要解决 `allowNoActor` 默认 `false` 导致
"纯广播必须有人接、否则自己报 FAILED"的问题（见 `FIX-26`）。

## KEEP-29 可用性判定返回原因码，不是布尔

**证据 · 已亲验**：`topology-runtime-v3/src/foundations/eligibility.ts` ——
`{allowed: boolean, reasonCode: TopologyV3EligibilityReasonCode}`，七种原因码
（`managed-secondary` / `slave-instance` / `already-activated` /
`activated-master-cannot-switch-to-slave` / …）。

**为什么**：UI 不只是"按钮置灰"，而是能说清**为什么不能**。
与 v2s 后台规范 2-H 的 `deletionAvailability: {blocked, reason, count}` 是同一形态。

**TER 动作**：整体继承，并写进 TER 前端规范：**禁用态必须带可解释原因**。

## KEEP-30 全量快照双缓冲，分块期间读不到半份数据

**证据 · 已亲验**：`tdp-sync-runtime-v2/src/features/slices/tdpProjection.ts` ——
`{activeBufferId, activeEntries, stagedBufferId?, stagedEntries?}`；
`SNAPSHOT_BEGIN` 建 staged → `SNAPSHOT_CHUNK` 填 staged → `SNAPSHOT_END` 校验 snapshotId 后整体提升为 active；
中途断线直接丢弃 staged。

**为什么**：分块传输里最容易做错的一处。没有双缓冲，业务会在快照应用期间读到半份数据。

**TER 动作**：整体继承。任何"分块全量替换"都用这个形态。

## KEEP-31 服务端时钟偏移用于 TTL 判定

**证据 · 已亲验**：`tdp-sync-runtime-v2` 的 `serverClockOffsetMs` ——
`messageActor.ts:51` 从下行消息 `timestamp` 推出 → 存进 `tdpSync` slice 并**持久化** →
`estimateTdpServerNow(localNow, offset)` 用于 projection TTL 过期判定。

**为什么**：**这个代码库是有时钟纪律的**，只是放在真正需要它的地方（TTL 判定），
而不是 topology 同步（那里靠 authority 决胜，不需要）。
我在 `FIX-05` 第一版里说"没有任何时钟纪律"是错的。

**TER 动作**：继承，并把它上升为**通用能力**（`contracts` 的可注入 clock），供其它时间判定复用。

## KEEP-32 外部数据入口做三重校验，错误是返回值不是异常

**证据 · 已亲验**：主数据三包的 `foundations/decoder.ts` ——

```ts
if (!isXxxTopic(topic))                              return {error: `Unsupported topic ...`}
if (change.operation === 'delete')                   return {record: {...tombstone: true}}
if (!isRecord(change.payload))                       return {error: 'Missing retained-state payload'}
if (envelope.schema_version !== 1)                   return {error: `Unsupported schema_version ...`}
if (envelope.projection_kind !== kindByTopic[topic]) return {error: `Unexpected projection_kind ...`}
if (!isRecord(envelope.data))                        return {error: 'Missing envelope.data'}
```

四点：不抛异常（一条坏数据不打断整批）· 校验 schema 版本 ·
校验 kind 与 topic 匹配（防止服务端把 A 的数据发到 B 的 topic）· delete 显式产 tombstone。

**为什么**：这是 `FIX-19`（workflow 远程定义 `as any` 零校验）的**正面对照** ——
同一个团队在这里做对了。

**TER 动作**：作为 TER"外部数据入口"的标准形态写进编码规范。

## KEEP-33 空闲等待带阻塞原因

**证据 · 已亲验**：`ui-automation-runtime/src/foundations/waitEngine.ts` 的 `forIdle` ——
`pendingRequests === 0 && inFlightActions === 0 && inFlightScripts === 0`
且距最后一次 `runtime.stateChanged/screenChanged/requestChanged` 超过 quiet window（默认 300ms）；
超时时返回 `blocker`（`pending-requests:3` / `quiet-window` / …）。

**为什么**：自动化超时是**可诊断**的，不是"等了 5 秒没等到"。
且这是外部工具（Maestro 等）给不了的 —— 它不知道你的 request ledger。

**TER 动作**：继承，并把 blocker 原因扩展到所有 wait 方法。

## KEEP-34 输入持久化三档，密码类在类型层禁止落盘

**证据 · 已亲验**：`ui-base-input-runtime` ——
`InputPersistencePolicy = 'transient' | 'recoverable' | 'secure-never-persist'`；
`toPersistedInputValue(state) = canPersistInputValue(state.persistence) ? state.value : null`。

**为什么**："重启恢复原状"对输入框也成立（半输入的激活码还在），
同时 PIN/密码**在类型层就不可能被持久化**。
把密码顺手存进可恢复状态是很常见的错误，这里从源头堵了。

**TER 动作**：继承，并与 kernel 的 `uiVariables` descriptor 合一（当前两处定义同一组字面量）。

## KEEP-35 启动编排从 Activity 抽出 + 专门的启动审计日志

**证据 · 已亲验**：`host-runtime-rn84/android/.../startup/StartupCoordinator.kt`（172 行），
注释写明三条约定：主屏 `onAppLoadComplete(0)` 后 **1.5 秒关遮罩**、**3 秒启副屏**、**两者并行不串行**；
冷启动显遮罩、重启跳过；只认 `displayIndex === 0` 的 ready 信号。
配套 `StartupAuditLogger.kt`（192 行）记录冷启/重启/副屏启动/加载完成/进程退出。
另有 `ReactLifecycleGate.kt`（11 行）在 RN context 未就绪时拦截 `onNewIntent`/`onWindowFocusChanged`。

**为什么**：启动期故障是最难查的一类（现场只看到"起不来"）。
把编排从 Activity 抽出 + 专门审计日志 + 生命周期闸门，三件都是现成资产。

**TER 动作**：三个文件的形态整体继承（多 surface 后时序需重新评估）。

## KEEP-36 release manifest 把四类版本分开

**证据 · 已亲验**：`4-assembly/.../release.manifest.json` ——
`assemblyVersion`（App 版本）· `buildNumber`（构建号）· `bundleVersion`（JS 包版本，`1.0.0+ota.25`）·
`runtimeVersion`（原生运行时兼容标识 `android-mixc-catering-rn84@1.0`）· `minSupportedAppVersion`；
外加 bundle 与 sourceMap 的 `sha256` + `size` + `modifiedAt`。

**为什么**：热更新的兼容判断靠 `runtimeVersion` + `minSupportedAppVersion`，
而不是 App 版本 —— 这是对的。产物带 hash 可校验。

**TER 动作**：四类版本分离的形态整体继承；Expo 下映射到 `expo-updates` 的对应概念。

# 第二部分 · FIX（TER 要改形状的地方）

## 2.0 ⚠️ 判据校准（2026-08-27 Dexter 纠正后重写）

**本节第一版用错了尺子，全部重新分档。**

原稿把 `charter §2-A`（"这个抽象现在有几个实现？只有一个 ⇒ 不建"）之类的**产品阶段判据**
直接套到 POC 上，于是把"机制先于业务建好、只用一个真实场景验证过"读成了过度设计。

**POC 的判据不是这个。** Proof of Concept 的目的是：
**拿一个真实业务场景，验证这条机制是否实际可行。**
它本来就不要求前后全面贯通、不要求多处采纳、不要求产品化配套齐备。
按 POC 自己的目的衡量，"机制建成 + 一个真实场景跑通"就是成功。

因此本节的每一条现在都带一个**档位**，同一条事实在不同档位下的含义完全不同：

| 档位 | 含义 | 对 POC 的评价 | 对 TER 的意义 |
|---|---|---|---|
| `本质缺陷` | 在任何语境下都是错的；**而且会让 POC 自己的结论不可信**（它让"跑通了"这个结论本身站不住） | 是 POC 的问题 | 必须修，且修法要写进规范 |
| `产品化欠账` | POC 阶段这样做完全合理，**产品化前必须补** | 不是 POC 的问题 | TER 要补，属于范围而非返工 |
| `POC 残留 / 形态偏好` | POC 探索过程的合理产物（并行方案、临时命名、演进痕迹） | 不是 POC 的问题 | TER 换个形状即可，不必视为债 |

**全表分档**

| 档位 | 条目 |
|---|---|
| `本质缺陷`（6 条） | `FIX-07` 条件调用 hook · `FIX-20` 未知 step 静默成功 · `FIX-22` 脚本假超时 · **`FIX-24` HTTP 不检查状态码** · **`FIX-25` protected 未加密** · **`FIX-28` 自动刷盘失败静默** |
| `产品化欠账`（8 条） | `FIX-03` 端口 `Record<string,unknown>` · `FIX-04` 端口全可选无 fail-fast · `FIX-09` 零 error boundary/崩溃上报 · `FIX-11` 无机制发现"没人用" · `FIX-12` server config 硬编码地址 · `FIX-14` automation 生产 inert 靠约定 · `FIX-16` 错误码目录无统一消费方 · `FIX-19` 远程下发链路的接线缺口 |
| `POC 残留 / 形态偏好`（9 条） | `FIX-05` 不可达的 LWW 死路径（**已从本质缺陷降级**）· `FIX-01` 包切分轴 + 两个被取代的包 · `FIX-02` 版本号进包名 · `FIX-06` ScreenContainer 体量 · `FIX-08` 语义注册是加法 · `FIX-10` 方法论文档漂移 · `FIX-13` metro resolver · `FIX-17` 副屏跨进程广播 · `FIX-21` 定义持久化形态 |
| `设计取舍 / 待裁`（3 条） | `FIX-15` 本地可查询数据能力（已裁定推迟）· `FIX-18` workflow 能力是否采纳 · `FIX-23` 进展观察是否保留 Observable |

⚠️ **6 条是"POC 做错了"**（2026-08-28 逐包精读后由 3 条增至 6 条）。其余 27 条要么是产品化范围，要么是 TER 换形状即可。

> 分档表下方的三组明细未随 `FIX-24`..`FIX-33` 逐条重排；每条的档位见其标题。
下面每条的标题都带上了档位；证据与行号未改动。

> 排序仍按影响面 × 修复成本。前五条会影响 TER 的包结构与地基形状，必须在动手前定。

## FIX-01 【POC 残留 / 形态偏好 · 对 TER 最高优先】包的切分轴：按 runtime 名切，不是按 owner 切

**证据 · 已亲验**

- **太细**：`1-kernel/1.1-base/execution-runtime`（966 行）与
  `1-kernel/1.1-base/host-runtime`（3,174 行）在全仓 `*.ts`/`*.tsx` 中 import 命中 **0**
  （穷举范围见 §0）；只有它们自己的 `package.json` 提到自己。
  真正在用的是 `runtime-shell-v2`（**225 处** import）。合计 **4,140 行死代码**，占 kernel/base 约 6.7%。
- **太粗**：`tdp-sync-runtime-v2` 单包 **6,903 行 / 19 个 actor / 7 个 slice**，
  同时拥有 TDP 会话与游标、增量同步、**热更新状态机**（`tdpHotUpdate` slice +
  `hotUpdateNativeBootActor` + `hotUpdateCompatibility` + `hotUpdateProjectionReducer` +
  `hotUpdateVersionReporter`）、**终端日志上传命令路由**（`terminalLogUploadCommandRouterActor`）、
  **system catalog 桥接**、**用户操作记录**、**TCP reset**。

**根因（推论）**：两件事看着相反，成因是同一个 —— 包是按"这是一个 runtime"切的，
不是按"**这是一份事实的 owner**"切的。于是"TDP 连接"这个名字底下什么都能塞；
而"execution runtime"这种名字没有对应的事实，自然长不出消费者。

**TER 动作**：包 = **owner 边界**。判别式两问 ——
① 这个包独占哪一份事实（哪些 slice 只有它能写）？
② 拿掉它，谁会因为拿不到那份事实而坏掉？
①答不上就不该是包；②答"没人"就是死包。
按这个轴，`tdp-sync` 至少拆成"TDP 会话与游标"/"热更新"/"日志上传"三个 owner；
`execution-runtime` 与 `host-runtime` 不建。

**配套**：`FIX-11` 的依赖 checker 顺手报"零消费者的包"。

## FIX-02 【POC 残留 / 形态偏好】版本号与框架名写进了包名（33 个包里 11 个）

**证据 · 已亲验**：`runtime-shell-v2` · `tcp-control-runtime-v2` · `tdp-sync-runtime-v2` ·
`terminal-log-upload-runtime-v2` · `topology-runtime-v3` · `ui-runtime-v2` · `workflow-runtime-v2` ·
`server-config-v2` · `adapter-android-v2` · `host-runtime-rn84` ·
`assembly-android-mixc-catering-assembly-rn84`。

**为什么这是架构问题不是命名洁癖**

1. 版本进包名 ⇒ 进**每个消费者的 import 路径**。`runtime-shell-v2` 有 **225 处** import；
   出 v4 时要么改 225 处，要么让名字长期说谎
   （`topology-runtime-v3` 现已是那次重写之后的第 N 次修订，"v3"只是化石）。
2. `rn84` 更糟：**框架版本成了包身份的一部分**。TER 一换 Expo，`host-runtime-rn84` 当天就是错的。
3. 与 v2s 已有的"**能力命名而非流程命名**"红线是同一类问题：
   名字应说"它是什么能力"，不说"它是第几版"或"它跑在什么上"。

**TER 动作**：**包名禁止出现版本号与框架名**（可做机械门）。
演进用"同名包内改实现"表达；真要两代并存就用两个**能力不同**的名字。
adapter 按能力命名（`persist-kv` / `device` / `scanner` / `dual-screen` …），宿主框架是实现细节。

## FIX-03 【产品化欠账】端口退化成 `Record<string, unknown>`

**证据 · 已亲验**：`platform-ports/src/types/ports.ts`

- `DevicePort.addPowerStatusChangeListener(listener: (event: Record<string, unknown>) => void)`
- `HotUpdatePort.readBootMarker / readActiveMarker / readRollbackMarker / confirmLoadComplete`
  全部返回 `Record<string, unknown> | null`
- `ConnectorPort` 的 `call / subscribe / on / isAvailable / connect / disconnect`
  入参与返回几乎全是 `Record<string, unknown>`

`spec/layered-runtime-communication-standard.md` 的迁移地图自己把"归一化 power payload"
列为待办，说明作者知道。

**为什么**：端口的全部意义是**有类型的边界**。退化成 `Record<string, unknown>` 之后它不是边界，是洞：
消费侧只能手搓字段名，而那些字段名立刻变成**跨层字符串、零编译器保护**
（这正是 v2s charter §3-D "跨界字面量按谁必须达成一致分类"要治的那类东西）。

**TER 动作**：端口方法的入参/返回必须是具名类型。
这条**可以做成机械门** —— 扫 port 类型定义文件里的 `Record<string, unknown>`，禁止句形态，
红夹具 = 给任一端口方法改回 `Record<string, unknown>`，门必须红。

## FIX-04 【产品化欠账】`PlatformPorts` 12 个字段里 10 个可选，缺失时无 fail-fast

> ✅ **解法已定（Dexter 2026-08-28）**：改为**端口注册器 + 默认实例** ——
> 端口取消全部可选字段，永远存在；有人注册用注册的实现，没人注册用**声明处自带的默认实例**
> （必须零额外依赖），默认分「可用默认」与「不可用默认（typed `CAPABILITY_UNAVAILABLE`）」。
> **本条由此整条消解**，降级只在端口声明处发生一次。详见 `00-ter-build-order` §4B.1。
> 下文保留问题描述作为证据。

**证据 · 已亲验**：只有 `environmentMode` 与 `logger` 必填；
`terminalLogs / scriptExecutor / stateStorage / secureStateStorage / device / appControl /
hotUpdate / topologyHost / localWebServer / connector` 全部 `?`。

**为什么**：于是每个消费者写 `ports.device?.getDeviceId()`，
并且**在每一个调用点**决定"没有这个能力时怎么办"。
真正该回答一次的问题 ——"这个模块没有 device 能力还能不能工作" ——
被推迟到运行时，且推迟到处处。降级行为因此散落且不一致。

**TER 动作**：能力从"可选字段"改成"**模块声明所需能力，runtime 在 install 阶段 fail fast**"。
模块 manifest 加 `requiredCapabilities: [...]`，缺失时启动即报清楚的错，
而不是在某个页面上静默降级。

## FIX-05 【已撤回 → 降为 POC 残留】同步语义有一整条不可达的 LWW 死路径

> ⛔ **本条第一版判错了，2026-08-28 逐包精读时自我推翻。**
> 原稿断言"跨端状态同步用墙钟 LWW，时钟快的那台永远赢，且 `hostTime` 从不被读取" ——
> 我只读了 `state-runtime/supports/sync.ts` 的 `mergeSyncRecordState`，
> **没有追到调用它的那条路径是否可达**。这是"声称≠行为"的错误，而且是我自己犯的：
> 我看到代码里写着 LWW，就断定行为是 LWW。

### 真实模型（已亲验，穷举 `1-kernel` `2-ui` `3-adapter` 下 `*.ts`）

**同步冲突由 per-slice 静态 authority 决定，与墙钟无关。**

1. **方向由 `syncIntent` 静态决定**。
   `topology-runtime-v3/src/foundations/syncRegistry.ts`：
   ```ts
   const toDirection = ctx => ctx.instanceMode === 'MASTER' ? 'master-to-slave' : 'slave-to-master'
   const filterSlicesByDirection = (slices, direction) =>
       slices.filter(slice => slice.syncIntent === direction && slice.sync)
   ```
   ⇒ 一个 slice **只有一个权威方**；另一端只收不发。
2. **模式恒为 `authoritative`**。三个构造点全部显式传 `{mode:'authoritative'}`；
   `runtime-shell-v2/src/foundations/runtimeStateSync.ts` 第 15-17 行的三元
   因 `direction` 是二值联合而**条件恒真**，`'latest-wins'` 不可达。
3. **`updatedAt` 只作变化检测**：发送侧用 `!==`（有没有变），不是 `<`（谁更新）；
   接收侧在 authoritative 下**无条件应用**，不比时间戳。

⇒ **POC 采用的正是我当时"建议"的第 3 条方案（按 slice authority 决胜，不比墙钟）。作者已经做对了。**

### 降级后仍成立的部分（`POC 残留 / 形态偏好`）

| # | 事实（已亲验） | 影响 |
|---|---|---|
| a | `runtimeStateSync.ts:15-17` 的三元分支不可达 | 读代码者会以为 latest-wins 是可能模式 |
| b | `state-runtime/supports/sync.ts` 的 `mergeSyncRecordState` 与整条 latest-wins 分支**生产不可达**（生产调用点仅第 148 行自身，位于该分支内；其余命中全在测试） | 一整套 LWW 语义作为死路径存在 |
| c | `ui-runtime-v2` 的 `screenState.applySyncEntries` 与 `uiVariableState.applySyncEntries` **零 dispatch 点**（穷举确认只在定义处出现），而其实现是 `if (!local \|\| local.updatedAt < incoming.updatedAt)` —— **LWW 语义，与实际生效的 authoritative 相反** | **最危险的一条**：照着这两个 reducer 读会得出错误的同步模型结论。机制原因是 `applySlicePatches` 走 `createReplaceStateRuntimeAction` 整片替换 slice state，**绕过 slice 自己的 reducer** |

### 仍然真实的次级问题

`updatedAt` 是墙钟（`contracts` 的 `nowTimestampMs() = Date.now()`），
在 authoritative 模式下用于 `!==` 变化检测。两端时钟偏差会造成**误判有变化 ⇒ 多发一次**，
是性能噪音，**不是正确性缺陷**。`hello-ack.hostTime` 未被读取这条事实成立，但不再构成缺陷论据。

### TER 动作

1. **删掉 latest-wins 整条死路径**（a/b/c 三处）；
2. **把 authority 模型写进 TER 编码规范**："每个可同步 slice 恰有一个权威方，由 `syncIntent` 静态决定；
   时间戳只作变化检测，不作冲突裁决" —— 这是 POC 做对但没写下来的一条；
3. 变化检测建议改用**内容 hash 或版本号**而非墙钟，消掉时钟偏差导致的多余重发；
4. 同机双屏改一个 store 后，本机根本不走这条路径（讨论稿 §7.2）。

### 这条错误本身的教训

我看到 `mergeSyncRecordState` 里写着 `local.updatedAt < incoming.updatedAt` 就下了结论，
**没有追它是否可达**。正确做法是：读到一段实现之后，先问"谁调用它、在什么条件下调用"，
再决定它是不是行为。这与 `claim-versus-behavior` 是同一条，只是这次的"声称"不是注释，
而是**一段真实存在但不可达的代码**。已并入台账 §2.0 的判据校准。

## FIX-06 【POC 残留 / 形态偏好】`ScreenContainer.tsx` 980 行 —— renderer 变成了编排器

**证据 · 已亲验**：`runtime-react/src/ui/components/` 八个文件共 1,487 行，
`ScreenContainer.tsx` 一个占 **980 行**（第二名 `DefaultAlert.tsx` 158 行）。
它同时拥有 screen 生命周期、缓存、ready gate、activity controller、子 screen 解析、自动化节点注册。
而 `spec/layered-runtime-communication-standard.md` 明写
"UI Renderers Stay Renderers … should not become the owner of domain orchestration"。

**关联**：`FIX-07` 那 5 处条件 hook 里有 **3 处就在这个文件**（第 547、549、553 行）。
大文件与 hook 违规同时出现不是巧合。

**TER 动作**：把 ready gate / activity controller / 缓存策略从渲染组件里拆出来 ——
它们是**状态机**，不是渲染。渲染组件只剩"读当前 screen → 渲染对应 part"。目标 150 行以内。

## FIX-07 【本质缺陷】条件调用 hook（潜伏崩溃，不只是风格）

**证据 · 已亲验**：5 处，2 个文件

```
2-ui/2.1-base/runtime-react/src/ui/components/UiRuntimeRootShell.tsx 第 35、37 行
2-ui/2.1-base/runtime-react/src/ui/components/ScreenContainer.tsx   第 547、549、553 行
```

形态：`const x = xProp ?? useOptionalXxx() ?? undefined` —— `??` 短路后 hook 不被调用。

**为什么是崩溃不是风格**：`xProp` 初始为 `undefined` 时 hook **被调用**；
之后 `xProp` 变成有值时 hook **不被调用** ⇒ **hook 调用数变化** ⇒
React 直接抛 `Rendered fewer hooks than expected`。
而这两个文件正是最核心的渲染组件。
（附带：将来若要开 React Compiler，这一族也会让它 bail out。Dexter 已裁定当前不引入 Compiler。）

**TER 动作**：不搬这个形态。`eslint-plugin-react-hooks` 从第一天设 error
（v2s 根已装 7.0.1）—— 将来想开 Compiler 时是"打开开关"，不是"先还三个月技术债"。

## FIX-08 【POC 残留 / 形态偏好】自动化语义靠手工注册，覆盖率是纪律的函数

**证据 · 已亲验**：`2-ui` 下 `semanticId:` 出现 **52 次**，`testID=` 出现 **221 次**。
primitive 层自动注册的正确做法已经存在
（`terminal-console/src/ui/components/TerminalSectionPrimitives.tsx:217` 的 `semanticId: testID`，
`admin-console/src/ui/screens/AdminSectionPrimitives.tsx` 同型），但没有铺开。
设计文档 §6.2 明确第一版语义源是"TS 侧手工维护的 semantic registry"，
不走 Fabric shadow tree、不走 Android Accessibility。

**根因（推论）**：注册是**加法**（写一行才有），不是**减法**（默认有、除非声明不要）。
加法型机制的覆盖率必然随代码量下降。

**TER 动作**：把注册下沉到 **NativeWind + React Native Reusables 的 primitive 包装层** ——
所有业务组件都由那一层构建 ⇒ 默认全部可被自动化寻址，业务代码零感知。
这一步把机制从加法变成减法。

## FIX-09 【产品化欠账】生产代码零 error boundary、零崩溃上报

**证据 · 已亲验**：全仓 `ErrorBoundary / componentDidCatch / getDerivedStateFromError`
**只在 `test-expo/RuntimeReactExpoShell.tsx` 出现**（测试外壳，不是生产代码）；
`Sentry / crashlytics / ErrorUtils.setGlobalHandler / unhandledrejection` **零命中**。

**为什么 POC 阶段可以、TER 阶段不行**：POS 终端崩了，门店当场停止收银，
而现场没有开发者、没有 logcat。**没有崩溃上报 = 没有故障可见性。**

**TER 动作**：`LoggerPort`（`KEEP-14`）已经是结构化且带 `containsSensitiveRaw`，
加一个 sink 即可，业务代码零改动。三条边界要先定：

1. 终端可能长期离线 ⇒ 需要离线队列与上传窗口（POC 的 `versionReportOutbox` 是现成先例）；
2. boundary 粒度不能只有 root ⇒ **screen 级**（`ScreenContainer` 是天然边界），
   一个业务页崩了不该让整台收银机白屏；
3. boundary reset 之后应**重新挂载 screen 而不是重启 App** —— store 的恢复能力本来就有。

## FIX-10 【POC 残留 / 形态偏好】方法论文档两个月内就与代码漂移

**证据 · 已亲验**（两处）

1. `spec/layered-runtime-communication-standard.md` 列出的 Priority A/B/C
   "待迁移 assembly 逻辑"，代码里已经全部迁到 `host-runtime-rn84`；
2. `spec/kernel-core-dev-methodology.md` 通篇讲的 `dev/index.ts` +
   `full / seed / verify` 三阶段真重启 harness，**仓内已无任何 `dev/` 目录**
   （`find 1-kernel 2-ui -type d -name dev` 零命中），该模式已被
   `test/scenarios` + `test/helpers/liveHarness.ts` 取代。

**规律（推论）**：描述"**怎么干活**"的文档，比描述"**裁定了什么**"的文档腐烂得快 ——
前者随实现变，后者只随决策变。

**TER 动作**：TER 只留两类文档 —— **裁定记录**（长寿）与**编码规范正本**（自带反例、可判对错）。
方法论型叙述要么变成规范条目，要么变成能跑的模板代码
（共享 live-harness 本身就是最好的方法论文档）。

## FIX-11 【产品化欠账】没有任何机制会注意到"没人用"

**证据 · 已亲验**：三件事的共同点是"只要不报错就没人发现" ——
两个被取代仍留下的包（`FIX-01`）· 三处不可达的 LWW 死路径（`FIX-05`）·
`server-config-v2/src/dev.ts` 里硬编码的开发机 LAN IP（`FIX-12`）。

**TER 动作**：依赖 checker（讨论稿 §7.7）顺手承担两条报告：
零消费者的包；`exports` 里导出但全仓零 import 的符号。
几十行的事，但它把"发现"从人的注意力变成机器的。

## FIX-12 【产品化欠账】server config 是硬编码 TS，含开发机 LAN IP

**证据 · 已亲验**：`1-kernel/server-config-v2/src/dev.ts` 写死
`http://192.168.0.172:5810`（`addressName: 'lan'`），另有 `local` / `localhost` 两个候选。

**为什么**：地址是**环境策略**，不是 kernel 事实。放进 kernel 源码之后，
换网络就要改 kernel 包并重新出包。

**TER 动作**：**取消这个包**。
`TransportServerConfig` 的**类型/形状**本来就在 `kernel/base/contracts`；
**具体地址值由 assembly 作为产品/环境配置注入**。
少一个包，顺手修掉硬编码，并且符合"assembly 拥有产品与环境策略"的既有分工。

## FIX-13 【POC 残留 / 形态偏好】metro 自定义 resolver 绕 monorepo 版本冲突

**证据 · 已亲验**：`4-assembly/android/mixc-catering-assembly-rn84/metro.config.js` 有一段
`resolveRequest`，把 `react` / `react-native` / `@react-native*` / `@react-navigation*`
强制解析到 assembly 本地 `node_modules`。注释写明原因：仓库根 hoist 了 RN 0.77，
而该 assembly 必须用 RN84，否则 JS 与原生 binary 版本不一致。

**为什么**：**根因在依赖版本策略，解法却落在打包器**。
这类补丁的问题是它只在 Metro 生效 —— tsc、vitest、eslint 各自看到的还是 hoist 后的版本。

**TER 动作**：从版本策略上根除 —— 全工作区单一 RN/React 版本，由 Expo 的版本矩阵统一。
**不再允许在打包器里做版本重定向。**

## FIX-14 【产品化欠账】automation 的"生产不启动"靠约定，不靠机制

**证据 · 已亲验**：设计文档 §2.1 规定 Product 环境默认 inert（见 `KEEP-18`），
但这是**运行期的初始化选择**，代码仍然编进产物。
同时 automation 能力面包含 `runtime.getState`（读全部状态）、`command.dispatch`（执行任意命令）、
`scripts.execute`（执行任意脚本）；Android 侧另有 `AutomationSocketServer` 与
`TopologyHostV3Server`（设备上开 WS server）。

**为什么**：约定型防线在"有人改了初始化顺序"或"某个产品配置写错"时无声失效，
而失效的后果是一个完整后门。

**TER 动作**：把它变成**可验证的** —— 构建变体剔除 / 编译期常量裁剪 / 启动时断言，
任选但必须有一条能机械判定。
~~另外单独裁决 `scripts.execute` 要不要进 TER~~ —— ⛔ **已裁定**：
Dexter 2026-08-28 定 **`T-11`：`scripts.execute` 保留，且必须支持运行期远端下发脚本源，不设来源限制**
（"程序的自由度和可扩展性是第一位的，安全问题业务自己会保障"）。
本条 `TR-08` 的剔除范围**只针对 automation 调试控制面**，不含 `scripts.execute`。

## FIX-17 【POC 残留 / 形态偏好 · 随架构变更消失】副屏生命周期靠跨进程广播

**证据 · 已亲验**：`host-runtime-rn84/android/.../startup/SecondaryProcessController` 用四条广播
维持跨进程生命周期 —— secondary-started / secondary-stopped / restart-request / restart-ack；
`SecondaryActivity.kt` 在受控关闭时 `Process.killProcess(Process.myPid())`；
`SecondaryDisplayLauncher.kt` 用 `DisplayManager` + `ActivityOptions.launchDisplayId` 启动副屏；
方法论文档记录副屏延迟约 `3s` 启动、主副屏 ready 后 state 传播约 `~100ms` 量级。

**为什么列为 FIX 而不是 KEEP**：这套协议的**存在理由只有一个** ——
副屏是独立进程（`AndroidManifest.xml` 上的 `android:process=":secondary"`，见 `CON-02`）。
它带来的成本是一整套跨进程握手，以及"副屏没起来"这一类独立故障面
（方法论文档专门写了"副屏本该起来却没起来，应先按 crash/hang 排查，
不要用手动再拉起来掩盖问题"—— 说明这类故障真实发生过）。

**TER 动作**：改成一个 ReactHost 挂多 surface（`CON-01` / `CON-02`）之后，
**这套协议整体删除，不搬运**。副屏成为同一进程内的一个 surface，
生命周期由 Activity/Presentation 自身承担，无需跨进程握手、无需 ACK、无需 killProcess。

## FIX-15 【设计取舍 · 已裁定推迟】本地可查询业务数据没有对应能力（POC 未做）

**证据 · 已亲验**：`StateStoragePort` 只有
`getItem / setItem / removeItem / multiGet / multiSet / multiRemove / getAllKeys / clear` ——
纯 KV。持久化引擎是 slice → KV 条目，没有"本机查询/汇总"这类能力。

**约束（Dexter 已明确）**

1. 要进 SQLite 的数据**不走 store 的自动 persist**；
2. **非 adapter 层对 MMKV / SQLite / webstorage 完全无感** —— 选后端是 adapter 的事
   （Electron 上可能就是 webstorage）；
3. ⇒ 端口必须是**能力型**（"持久 + 可本机查询汇总"），不能是技术型（"SQLite"），
   更不能让 kernel 写 SQL。

**状态**：**Dexter 已裁定"等有真实业务再补"**。此处只登记纠正后的约束，不展开设计。

## FIX-16 【产品化欠账】错误码目录没有统一的消费方约定

**证据 · 已亲验**：`runtime-shell-v2` 有 `errorDefinitions` / `parameterDefinitions` 与
`runtimeCatalogBootstrap` / `errorCatalogState`，各包也确实声明了 error definition；
但 UI 侧如何把 error key 映射成用户可读文案，未形成统一约定或全集对账。

**对照正例**：v2s 前端 `operationsProblemFeedback.ts` 对生成的 problem code 闭集做**全量文案覆盖**，
漏一个 code 就是编译错误。

**TER 动作**：错误码 → 用户文案的映射做成**闭集全覆盖**，漏一个即编译错误。

---

## FIX-18 【设计取舍 · 需 Dexter 裁决】workflow 能力 TER 是否采纳

> ⚠️ **本条第一版判错了，已整体重写。** 原稿按 `charter §2-A` 把"3,823 行只有一个调用点"
> 断为过度设计。那是产品阶段的判据，**不适用于 POC**。
> POC 的目的就是"机制先建好，用一个真实业务场景验证它可行"，
> 不要求多处采纳，也不要求前后贯通。按这个尺子，本包是一次**成功的机制验证**。

### POC 证明了什么（这是评价它的正确问题）

已亲验，五条都有真实运行路径支撑：

1. **声明式步骤树能驱动真实原生能力，端到端跑通。**
   `builtinTasks.ts` 的 `singleReadBarcodeFromCamera` →
   `external-call` 步骤 → `connectorRuntime` →
   `platformPorts.connector.call({channel:{type:'INTENT',target:'camera'}, action:'…CAMERA_SCAN'})`
   → 真机相机 → 解码结果回到业务
   （`admin-console/topologyAdminActor.ts:77-104` 用它导入拓扑配对二维码）。
   **这是真实硬件上的真实业务场景，不是 mock。**
2. **动态 JS 表达式能在与 App 隔离的沙箱里求值。**
   `scriptRuntime.executeScript` 优先走 `platformPorts.scriptExecutor`；
   Android 侧 `ScriptEngineManager.kt` 用 **QuickJS**，每次 `QuickJSContext.create()` 并在 finally 销毁。
   即：动态脚本**不在 App 自己的 Hermes VM 里跑**。
3. **工作流定义能经 TDP projection 下发并成为可执行体。**
   `workflowRemoteDefinitionActor` + 289 行 live spec
   （`workflow-runtime-v2-live-remote-definitions.spec.ts`：新增/更新/删除、GROUP scope policy 下发）。
4. **运行可排队、可观察、可取消、可超时**，且进展经 `workflowObservations` slice + selector 读出
   （`engine.ts` 的全局串行队列 + `activeRun`/`queue`，`cancel`，`withTimeout`）。
5. **各项限额运行期可调**，走参数目录而非硬编码（见 `KEEP-26`）。

**这五条合起来是一个连贯且不小的验证成果。**

### POC 没有证明什么（这才是 TER 采纳前的设计议程）

这一节不是指责，是**把 POC 的边界写清楚**，因为它正好就是产品化要补的清单：

| 未证维度 | 从哪看出来它没进 POC 范围 |
|---|---|
| **下发的安全模型** | `workflowRemoteDefinitionActor` 里 `item.payload as any`，远程定义零校验直接进 registry。谁能下发、内容如何校验、错误下发如何回滚，都没进范围 |
| **沙箱的真实约束** | 本地回退路径的超时挡不住死循环（`FIX-22`）；QuickJS 侧的 CPU/内存/中断限制在真机上的表现没有被验证 |
| **并发是否够用** | 引擎是**全局串行**（一次一个 workflow，队列上限 100）。只跑过单个扫码，没有"扫码同时打印"这类并发场景 |
| **定义的版本与生命周期** | 定义数组累积不裁剪（`FIX-21`），说明升级/回滚/清理路径没进范围 |
| **生产接线** | 模块未声明 `tdpTopicInterests`（`FIX-19`）—— 这正是"POC 不要求前后贯通"的具体表现 |

### TER 的裁决点

**问题不是"这个设计好不好"，是"TER 现阶段要不要这个能力"。**

- 若 TER 需要"**不发版就能改设备操作流程**"（不同门店外设组合不同，扫码/称重/打印的编排要现场调）
  ⇒ 这个能力是真需求，POC 已证机制可行，产品化按上表五个未证维度补。
- 若 TER 现阶段只需要"**调参数**"（超时、上限、开关）
  ⇒ `KEEP-26` 的参数目录已经够，不需要引擎。
- 若 TER 现阶段只需要"**扫个码**"
  ⇒ 一个 `scanner` 能力端口即可；引擎留到真需求出现。

⚠️ 无论选哪条，**采纳时调用点的形状要改**：当前唯一调用点要手剥四层
`Record<string, unknown>`（`topologyAdminActor.ts:90-93`），
错误消息要三级 `??` 兜底。这是 `FIX-03`（端口/返回值类型退化）在 workflow 出口的同一个毛病，
与引擎本身的设计无关。


## FIX-19 【产品化欠账】远程下发链路的接线缺口 + 下发内容零校验

> ⚠️ **本条第一版把它写成"设计意图从未兑现"，判重了。**
> POC 不要求前后贯通；这条缺口正是"未接线"，不是"接错了"。
> 保留它是因为**采纳时必须闭合**，且它引出的机械门对 TER 有价值。

**证据 · 已亲验（完整链条，穷举范围见 §0）**

1. `workflowRemoteDefinitionActor.ts` 监听 `tdpSyncV2CommandDefinitions.tdpTopicDataChanged`，
   接受三个 topic key（`remoteDefinitionTopicKey` / `'workflow.definition'` / `'kernel.workflow.definition'`）；
2. **`workflow-runtime-v2/src/application/moduleManifest.ts` 未声明 `tdpTopicInterests`**；
3. 订阅只从模块描述符算出：`topicSubscription.ts:66`
   `resolveTdpSubscriptionFromDescriptors(descriptors)` 只读 `descriptor.tdpTopicInterests`，
   **无运行期追加路径**（`sessionConnectionRuntime.ts:166` 是唯一调用点）；
4. 握手原样发出：`sessionConnectionRuntime.ts:219-228`
   `capabilities: [TDP_TOPIC_SUBSCRIPTION_CAPABILITY_V1, …]` + `subscriptionMode: 'explicit'`；
5. 服务端据此只投交集：`subscriptionPolicy.ts:126,143`
   `acceptedTopics = requestedTopics ∩ allowedTopics`（**只收窄不追加**）；
   `service.ts:101` `acceptsTopicForSubscription`；`service.ts:561` 投影推送路径用它筛 session；
6. 全仓声明 `tdpTopicInterests` 的模块穷举：`tdp-sync-runtime-v2`（errorCatalog / parameterCatalog /
   hotUpdate / terminal.group.membership / config.delta）· `organization-iam-master-data` ·
   `catering-product-master-data` · `benefit-session` · `catering-shell`（`order.payment.completed`）。
   **无一声明 `kernel.workflow.definition`。**

**结论**：**真实 App 里这条链路当前是未接线的** —— 终端不订阅该 topic，服务端也就不推。
这在 POC 阶段是正常的（机制已由 live spec 单独验证），采纳时补一行声明即可。

✅ **原 `UNVERIFIED` 已可解释（2026-08-28 实测）**：此前记为"静态链条与 live spec 通过不可能同时为真"。
实测发现 **POC 的整套 live 测试在当前环境根本跑不起来** ——
`better-sqlite3` 原生模块按 `NODE_MODULE_VERSION 137` 编译，本机 Node v26.5.0 需要 147：

```
Error: better_sqlite3.node was compiled against a different Node.js version
using NODE_MODULE_VERSION 137. This version requires 147.
```

⇒ **"那条 spec 通过"这个前提本身无从确认**，它可能已因环境原因红了很久。
矛盾消失：静态链条成立，spec 的通过状态未知。
（该次尝试**未在 POC 仓留下任何文件**；测试服务器写 `os.tmpdir()`。）

⚠️ **由此产生一条更广的下调**：本台账此前多处默认"POC 的 129 个 spec 是绿的"，
**这个假设不成立** —— 至少全部依赖 mock server 的 live 测试当前跑不起来。
凡引用"某某已由测试验证"的结论，应读作"**存在覆盖该行为的测试代码**"，
而非"**该行为已被验证通过**"。纯 node 环境的单测未受影响，但本轮也未逐个复跑。

📌 **Dexter 2026-08-28 裁定**：不纠结这条链路现在通不通 ——
"**现在不通，不代表以后不通**"。远端下发是 TER 的**硬需求**（见下）。
本条因此从"缺陷"降为 **TER 接线工作项**。

**另一半是真欠账（与接线无关）**：`item.payload as any` ——
远程定义**零校验**进 registry。POC 不做校验合理；产品化必须做，
因为它与 `FIX-20`（未知 step 静默成功）叠加后，
一条格式错误的下发会**静默空跑并报成功**。

**TER 动作**：
① 采纳时，拥有该 topic 的模块必须声明 `tdpTopicInterests`；
并建一道**机械门**：`actor 监听的 topic ⊆ 该模块声明的 topic`
（禁止句形态，红夹具 = 删掉一条声明，门必须红）；
② 远程下发内容必须经 schema 校验才进 registry，拒绝走 typed error 且可观测。


## FIX-20 【本质缺陷】未知/未实现的 step 类型静默成功

**证据 · 已亲验**

- `types/definition.ts:37-43` 声明 6 种 step 类型：
  `flow / command / external-call / external-subscribe / external-on / custom`；
- 实现穷举：`engineExecutor.ts:313` 处理 `flow`；
  `engineStepExecutor.ts:36 / 70 / 83 / 96` 处理 `command / external-call / external-subscribe / external-on`；
- **`'custom'` 在整个 `src/` 下只出现一次，就是那行类型声明**，没有任何处理分支；
- 兜底分支（`engineStepExecutor.ts:109-119`）：

```ts
return await withTimeout({
    promise: (async () => {
        if (typeof input.stepInput?.delayMs === 'number' && input.stepInput.delayMs > 0) {
            await delay(input.stepInput.delayMs)
        }
        return input.stepInput?.output ?? input.stepInput ?? {}
    })(),
    …
})
```

**后果**：`type: 'custom'`（已声明但未实现）或 `type: 'custm'`（拼错）的 step
会**什么都不做然后报 COMPLETED**。叠加 `FIX-19` 的"远程定义零校验"，
一条拼错的远程定义会静默空跑并声称成功。

这正是 `backend-coding-standard` 2-B 的原话所禁：
**"任何'什么都没做'的路径不得返回成功。"**

⚠️ **为什么这条在 POC 语境下反而更重要**：POC 的产出是"结论"。
一个会**把没执行的步骤报成 COMPLETED** 的引擎，
会让"这条工作流跑通了"这个结论本身不可信 —— 它损害的正是 POC 自己的目的。
故列为 `本质缺陷`，与采纳与否无关。

**TER 动作**：step 类型分发必须**穷尽**（TS 的 `never` 穷尽检查 + 运行期 default 分支抛 typed error）。
声明了但未实现的类型不得留在联合类型里。

## FIX-21 【POC 残留 / 形态偏好】定义持久化：整块 blob + 立即刷盘 + 数组无界累积

**证据 · 已亲验**：`features/slices/workflowDefinitions.ts:87-98`

```ts
persistIntent: 'owner-only',
persistence: [{kind: 'field', stateKey: 'bySource', flushMode: 'immediate'}],
```

`bySource` 结构是 `{module|host|remote|test: Record<workflowKey, WorkflowDefinition[]>}`。

四个问题叠在一起：

1. **整块 blob**：`kind: 'field'` 落的是整个 `bySource`，
   即四个来源的全部定义写在**一个 storage key** 里 —— 正是 `KEEP-04` 说这个引擎已经避免的形态；
2. **`flushMode: 'immediate'`**：每注册一次就重写整块；
3. **数组无界累积**：`registerDefinitions` 的合并逻辑（第 38-49 行）——
   无 `definitionId` 时按 `updatedAt` 去重，有 `definitionId` 时按 id 去重。
   于是**同一个 `workflowKey` 每来一个新的 `updatedAt`/`definitionId` 就多留一条历史版本**，
   `sortDefinitions` 只负责让最新的排前面，**没有任何裁剪**。
   跨版本升级时 `bySource.module` 里的旧内置定义也永远留着（install 只 register，不清理）；
4. **远程 JS 落盘**：`source: 'remote'` 的定义（内含可执行 JS 源码字符串）随之持久化，
   重启后仍在，**不依赖服务端再次下发**。

**TER 动作**：若保留该能力 ——
① 定义按 `workflowKey` 落 `kind: 'record'`，一条一个 key；
② 同一 key 只保留当前生效版本，历史版本不是终端要管的事；
③ `module` 来源的定义**不持久化**（每次从代码重建），只持久化 `remote`/`host`；
④ **远程来源内容的持久化策略**需明确（这是**生命周期问题，不是安全问题**）：
   落盘则重启后仍用旧版本、需要显式失效机制；不落盘则每次启动依赖服务端重新下发。
   ⚠️ 与 `T-11` 无关 —— `T-11` 已定远端下发**不设来源限制**，此处只问"存不存、怎么失效"。

## FIX-22 【本质缺陷（假超时）+ 产品化欠账（静默降级）】脚本执行

**证据 · 已亲验**：`foundations/scriptRuntime.ts`

**其一 · 静默降级**：`executeScript` 里 ——

```ts
const executor = input.platformPorts.scriptExecutor
if (executor) { …走端口… }
return executeLocalScript({...})   // 无端口时直接本地 new Function
```

`executeLocalScript` 用 `new Function(...argumentNames, source)` **在当前 JS 上下文求值**，
并有一个 200 条的全局 `functionCache`。
Android 上 `host-runtime-rn84/src/platform-ports/createPlatformPorts.ts:29` 确实接了
`scriptExecutor: nativeScriptExecutor`（QuickJS 沙箱，见 `KEEP-25`）；
但**任何忘记接端口的宿主**（未来的 Electron assembly、Expo 早期、任何测试台）
会**无声地**退回到"在主 JS 上下文里 eval"。
这正是 `FIX-04`（端口可选 ⇒ 降级散落）的一个具体实例，而且降级的是**安全边界**。

**其二 · 假超时**：本地路径的超时是

```ts
setTimeout(reject, timeoutMs)  +  Promise.resolve().then(() => runner(...))
```

`runner` 是同步函数体。脚本里写 `while(true){}` 会**阻塞 JS 线程**，
定时器回调根本没机会执行 ⇒ **超时不可能触发**。
这个超时只对"返回慢 promise"的脚本有效，对最常见的死循环无效。

**TER 动作**：
① 端口缺失时**不得静默降级**，应 fail closed 并给 typed error（对齐 `FIX-04` 的 fail-fast 形状）；
② 若确需本地回退，只允许在测试环境显式开启，且必须写明"此路径无沙箱、无有效超时"；
③ 真正的执行超时只能由沙箱侧（QuickJS 的中断机制）提供，JS 侧定时器不算。

## FIX-23 【设计取舍 · 待裁】进展观察是否保留 Observable 这条路

> ⚠️ 本条第一版写成"缺陷"，判错了。POC 里探索"进展该怎么被观察"并试 Observable 是合理的。
> 对 TER 这是一个**取舍问题**，不是债。

**证据 · 已亲验**：全仓 `from 'rxjs'` 命中 **4 个文件，全部在 `workflow-runtime-v2`**
（`engine.ts` / `engineObservationRuntime.ts` / `engineRunState.ts` / `types/runtime.ts`）；
`rxjs` 只被这一个 `package.json` 声明（根 `resolutions` 另有 `redux-observable ^3.0.0-rc.3`，全仓零使用）。
对外 API 是 `run$(input): Observable<WorkflowObservation>`。

**取舍的两面**

- **支持保留**：工作流是**长过程 + 多次进展事件**，流式 API 表达它最自然；
  RxJS 的组合子在"等某个步骤 + 超时 + 取消"这类编排上确实比手写省事。
- **支持取消**：同一份观察数据**已经进了 `workflowObservations` slice**，
  selector 那条路是通的 ⇒ Observable 是**第二个住址**
  （对照 `frontend-coding-standard` §3-E "同一个事实只能有一个住址"）；
  且它为一个包引入了一整套范式，kernel 其余部分是 command/actor/selector。

**TER 动作 · 需裁决**：建议**对外只保留 selector 那条路**，
内部实现若确需流式组合可以用，但**不要把 rxjs 类型泄漏到包的公开签名上**。
这样既不丢表达力，也不产生第二个真相源。

## FIX-24 【本质缺陷】HTTP 全链路不检查状态码，故障切换在 5xx 下不触发

**证据 · 已亲验**：穷举 `transport-runtime/src/foundations/`、`supports/`、`types/http.ts`
下全部 `.status` 命中，只有两处，**均非判定**：

```
foundations/fetchHttpTransport.ts:52-53   // 放进返回对象
foundations/httpRuntime.ts:271            // 放进日志 data
```

**没有任何一处检查 `response.ok` 或状态码区间。**
生产 transport（`host-runtime-rn84/src/platform-ports/transport.ts` 的
`createAssemblyFetchTransport`）同样不检查。

**后果链（推论，推导链如下）**：

1. 服务端返回 500/502/404 且响应体是合法 JSON ⇒ transport 返回成功 ⇒
   `httpRuntime` 的 `try` 不抛 ⇒ **`rememberPreferredAddress` 把坏地址记为首选**；
2. 多地址故障切换**只在 fetch 本身 reject 时触发**（DNS 失败、连接拒绝、abort），
   "服务器活着但坏了"时不切换且坏地址被粘住；
3. `callHttpEnvelope` 的 `envelope.success` 兜住的是**业务失败**，不回流成 transport 失败；
4. 500 返回 HTML 时 `JSON.parse` 抛 ⇒ 才被当传输失败 ⇒ 切换。

⇒ **行为不一致**：`500 + JSON` 不切换且粘住坏地址，`500 + HTML` 切换。
两种在门店网络都会发生（网关 502 常返 HTML，业务服务 500 常返 JSON）。

**为什么是本质缺陷**：多地址故障切换是这个包的招牌能力，
而它在**最常见的服务端故障形态下失效**。"多地址容错跑通了"这个结论因此不成立。

**TER 动作**：transport 层判定状态码，非 2xx（或可配置的可重试集合）视为传输失败，
触发切换且**不记为首选地址**；状态码策略可注入（某些业务用 4xx 表达正常分支）。

## FIX-25 【本质缺陷】`protection: 'protected'` 没有加密

**证据 · 已亲验**（完整链条）：

| 层 | 事实 |
|---|---|
| slice descriptor | `tcp-control` 把 `accessToken` / `refreshToken` 标 `protection: 'protected'` |
| `state-runtime` | 据此路由到 `secureStateStorage`，缺失时 **fail closed 抛 typed error** |
| `host-runtime-rn84` | `createAssemblyStateStorage('secure-state')` → MMKV namespace `host-runtime-rn84::secure-state` |
| `adapter-android-v2` | `StateStorageManager.kt` 用 `MMKV.mmkvWithID(storageId)` —— **单参重载，无 `cryptKey`，无 `MMKVMode`** |

⇒ **`secure-state` 只是"另一个 MMKV 文件"，与普通存储同等无加密。**

**为什么是本质缺陷**：整条机制（描述符 → 路由 → 独立端口 → 独立命名空间 → fail closed）都建好了，
**只差最后一公里**；而当前的**命名是过度承诺的** ——
类型与描述符说 "protected"，实现给的是"另一个同样明文的文件"。
凭据在 rooted / ADB 可达设备上可读。

**TER 动作**：二选一，不能维持现状 ——
① 落到真加密（MMKV cryptKey + Android Keystore 管密钥）；
② 改名不再承诺加密（如 `isolated-state`），并在文档写明边界。

## FIX-26 【产品化欠账】纯事实广播必须有人接，否则自己报失败

**证据 · 已亲验**：`CommandDefinition.allowNoActor` 默认 `false`；
dispatcher 在 `handlers.length === 0 && !allowNoActor` 时聚合为 `FAILED`。
于是 `tcp-control/src/features/actors/stateMutationActor.ts` 出现 5 个空 actor：

```ts
onCommand(bootstrapTcpControlSucceeded, () => ({})),
onCommand(activateTerminalSucceeded,    () => ({})),
onCommand(credentialRefreshed,          () => ({})),
onCommand(deactivateTerminalSucceeded,  () => ({})),
onCommand(taskResultReported,           () => ({})),
```

**为什么**：这是"**命令**"与"**事件**"共用一个机制的代价。
广播一个事实本来就不该要求有订阅者。TER 里事实广播会更多（`KEEP-28`），这个代价会放大。

**TER 动作**：事件类定义默认 `allowNoActor: true`，或引入独立的 `defineEvent`。

## FIX-27 【POC 残留】主数据整块落盘 + 每次立即刷

**证据 · 已亲验**：三个主数据包**逐字相同**：

```ts
persistence: [
    {kind: 'field', stateKey: 'byTopic',       flushMode: 'immediate'},
    {kind: 'field', stateKey: 'diagnostics',   flushMode: 'immediate'},
    {kind: 'field', stateKey: 'lastChangedAt', flushMode: 'immediate'},
],
sync: {kind: 'record', getEntries: ... `${topic}:${itemKey}` ...}
```

**同步是逐条的（`record`），持久化却是整块的（`field` on 整个 `byTopic`）。**
`byTopic` 是 `Record<topic, Record<itemKey, record>>` —— organization-iam 有 **26 个 topic**。

**后果（推论）**：任意一条 projection 变化 ⇒ 立即刷盘 ⇒
`state-runtime` 重写**全部**持久化条目（`FIX-28`）⇒ 一次商品改价重写整个主数据 blob。

⚠️ 这正是 `KEEP-04`（按条目落盘）要防的形态，**而机制就在手边**
（`kind: 'record'` 已被同一 descriptor 用在 `sync` 上）。**用错了自己已有的能力。**

**TER 动作**：持久化改 `kind: 'record'` 按 `topic:itemKey` 一条一个 key；
`flushMode` 改 `debounced`，只有游标类用 immediate。

## FIX-28 【本质缺陷】自动刷盘失败静默，且每次全量重写

**证据 · 已亲验**：`state-runtime/src/foundations/createStateRuntime.ts`

**其一 · 静默失败**：
```ts
if (mode === 'immediate') { ...; void flushPersistence(); return }
flushTimer = setTimeout(() => { flushTimer = null; void flushPersistence() }, debounceMs)
```
两条自动路径都 `void` 掉返回的 Promise。手动调用方能拿到异常（末尾 `await persistenceChain` 会重抛），
**但自动持久化写盘失败没有任何信号**：不打日志、不改 state、不上报。

**其二 · 全量重写**：`setEntries(plainStorage, nextPlainEntries)` 里的 `nextPlainEntries`
是**当前全部**持久化条目；`persistedValueCache` 只用于陈旧键清理，
**没有用来跳过未变化的条目**。N 个条目时任一变化写 N 次。

**为什么其一是本质缺陷**：终端存储写满或权限异常时，**界面一切正常，重启后状态丢失**。
"崩溃恢复原状"这个结论因此在存储异常时不成立，且现场无从发现。

**TER 动作**：`void flushPersistence()` 改为带 `.catch()` 打 error 日志 + 置 `persistenceHealth` 状态位；
用已有的 `persistedValueCache` 比对 encoded 值做差量写入。

## FIX-29 【产品化欠账】测试归属与代码归属不一致

**证据 · 已亲验**：`host-runtime-rn84` 有 **4,240 行 TS + 4,026 行 Kotlin，零 `test/` 目录**；
而 `4-assembly/.../test/` 有 **4,991 行、19 个 spec**，其中
`assembly-create-app` / `assembly-platform-ports` / `assembly-bootstrap-runtime` /
`assembly-native-wrappers` / `assembly-state-storage` / `assembly-automation-dispatcher` /
`assembly-admin-console-config` / `assembly-report-terminal-version` / … **实际测的是 host-runtime 的行为**。

**为什么会这样（推论）**：assembly 是唯一能把 native wrapper、platform ports、RN 环境凑齐的地方，
所以"能跑起来的测试"自然长在那里。

**TER 动作**：测试迁回被测包；若确实需要完整宿主环境，
把那套环境做成 test-support 能力，而不是把测试放到下游包。

## FIX-30 【POC 残留】README 声明了一个不存在的包

**证据 · 已亲验**：`2-ui/2.1-base/hot-update-runtime-bridge/` 下
**0 个文件**（只有空的 `src/` 与 `test/`）；全仓 `rg` 确认它只在
`2-ui/2.1-base/README.md` 的包清单表里出现一次。
该能力实际住在 `runtime-react/src/ui/components/HotUpdateProgressModal.tsx`（65 行）。

**为什么**：与 `FIX-11`（没有机制注意到"没人用"）同根，方向相反 ——
**没有机制注意到"不存在"**。

**TER 动作**：结构 checker 增加一条：README 包清单必须与实际存在的包一致；空目录不进仓。

## FIX-31 【产品化欠账】依赖声明与实际 import 不符

**证据 · 已亲验**：`topology-runtime-v3/package.json` 只声明 `@next/kernel-base-contracts` 一个
`@next` 依赖，而源码实际 import **四个**（另有 `runtime-shell-v2` / `state-runtime` / `transport-runtime`）。

**为什么**：这是 `CON-03`（Yarn hoist 让未声明依赖照样能 import）的**真实实例**。
只查 `package.json` 的依赖门会放过它，因为被检查的那份 `dependencies` 根本不是真实依赖图。

**TER 动作**：依赖门必须有第二条断言 ——
**源码里每一个 `@ter/*` import 在本包 `package.json` 里都有对应声明**。
本条即该断言的红夹具素材。

## FIX-32 【产品化欠账】release manifest 的 targetPackages 不是从依赖图算的

**证据 · 已亲验**：`release.manifest.json` 的 `targetPackages` 列了 22 个包，
其中含 `@next/kernel-base-execution-runtime` 与 `@next/kernel-base-host-runtime` ——
这两个包全仓 **零 import**（`FIX-01`）。

⇒ manifest 声明"这次发布包含这两个包"，而 bundle 里没有它们的代码。

**TER 动作**：`targetPackages` 从实际依赖图生成并加校验；
顺带它能成为"发现零消费者包"的机制之一（`FIX-11`）。

## FIX-33 【POC 残留】同一路由有两个触发源

**证据 · 已亲验**：`catering-shell` 中 `replaceCateringShellRootScreen(...)` 被两条路径调用：

- **事件驱动**：`features/actors/tcpLifecycleActor.ts` 监听
  `activateTerminalSucceeded` / `deactivateTerminalSucceeded` / `resetTcpControl`；
- **状态驱动**：`application/createModule.ts` 的 `install` 里
  `context.subscribeState(...)` + `JSON.stringify({activationStatus, terminalId})` 指纹比对。

**本机激活时两条都会触发** ⇒ `replaceScreen` 被 dispatch 两次（各两条：主屏 + 副屏 = 四条 command）。
`replaceScreen` 幂等所以**无可见 bug**，但"何时路由"有两个答案；
`source` 字段的存在说明作者知道有多个触发源，却没有一处写明为什么两条都要。

**TER 动作**：收敛成一条（建议只保留状态驱动，它覆盖事件、同步、恢复三类场景）；
若保留两条，必须写明各自覆盖哪些场景并加测试证明都必要。

# 第三部分 · CON（平台约束，不是 POC 的对错）

## CON-01 `ReactHostImpl` 只有一个 `currentActivity` 槽位

**证据 · 已亲验**（RN 0.84.1 源码）：
`node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactHostImpl.kt`

- 第 252 行：`onHostResume(activity)` → `currentActivity = activity`
- 第 266-288 行：`onHostPause(activity)` 检查 `activity === currentActivity`，不等时给出
  `"Pausing an activity that is not the current activity, this is incorrect!"`，
  默认走 `Assertions.assertCondition`（断言失败），只有 feature flag
  `skipActivityIdentityAssertionOnHostPause()` 打开才降级为 `FLog.w`

**影响**：双屏设备上两个 Activity 在不同 Display 上**同时 resumed**。
若两个都走标准 `ReactActivity` / `ReactDelegate`，会互抢 `currentActivity` 并触发上述断言。

**绕法（两种，见讨论稿 §7.2）**：
① 只有主 Activity 是 `ReactActivity` 并独占 host 生命周期，副屏用 `Presentation` + `createSurface`；
② 两个 Activity，但副屏**不继承 `ReactActivity`**、**不调** `onHostResume/onHostPause/onHostDestroy`。

## CON-02 一个 ReactHost 挂多 surface 是官方 API

**证据 · 已亲验**（RN 0.84.1 源码）

- `com/facebook/react/ReactHost.kt` 第 83-88 行：
  `public fun createSurface(context, moduleName, initialProps): ReactSurface`
- 实现：`runtime/ReactHostImpl.kt` 第 336-347 行，内部 `ReactSurfaceImpl` + `ReactSurfaceView`
- `ReactApplication.kt`：`reactHost` 挂在 **Application** 上 ⇒ 同进程内所有 Activity 共享同一个
- **`initialProps` 是 per-surface 的**

**推论**：POC 副屏之所以是第二套 JS 环境，唯一原因是
`4-assembly/.../AndroidManifest.xml` 中 `SecondaryActivity` 节点上的 **`android:process=":secondary"`**
（独立进程 → 独立 Application → 独立 ReactHost → 独立 Hermes VM）。**去掉它即共享。**

**仍 UNVERIFIED**：Expo SDK 57 prebuild 对 Activity/ReactHost 的接管边界；
`Presentation` 内挂 `ReactSurfaceView` 的生命周期、触摸、尺寸与 DPI 行为；
双屏不同分辨率/密度下 Fabric 布局上下文是否需要单独配置。**需最小原型验证。**

## CON-03 Yarn 的 node_modules linker 会 hoist，未声明的依赖照样能 import

**影响**：只按 `package.json` 的 `dependencies` 检查层级方向的门，**是可以被绕过的** ——
未声明的包在运行时照样解析得到，于是被检查的那份 `dependencies` 根本不是真实依赖图。

**TER 动作**：依赖门必须有两条断言 ——
① 声明的依赖不违反层级方向；
② **源码里每一个 `@ter/*` import 在本包 `package.json` 里都有对应声明**。
缺 ② 则 ① 是纸糊的。
**已知反例栏**：deep import（`@ter/pkg/src/internal/...`）两条都抓不到，需靠包的 `exports` 字段收口。

## CON-04 RTK Query 本质是缓存引擎

**影响**：Dexter 已定"纯当封装好的 HTTP client、不要缓存"。
要做到这点需 `keepUnusedDataFor: 0` + `{subscribe: false}`，等于把它的主体关掉；
实际用到的只剩 **OpenAPI 代码生成 + 类型化 endpoint + 一个 `baseQuery` 接缝** 三样。
另外 v2s 前端规范 §3-C 记着：`dispatch(endpoint.initiate(...))` 必须配
`.unsubscribe()` / `.reset()` 或 `{subscribe:false}` / `{track:false}`，
实测泄漏形态 3 query + 1 mutation = **4 次 HTTP**（对照组 1 次），
且 mutation 条目带完整响应体永久驻留。TER 的形态里**每一次取数都走 `initiate`**。

**TER 动作**：

1. 不急着定用哪个客户端 —— terminal 契约还不存在。
   **现在只定接缝形状**：actor 只认一个 typed `httpService` facade，
   底下是 RTKQ 还是生成的 fetch client 是一个文件的事；
2. **不管选哪个**，多地址故障切换 / 重试轮 / 偏好地址 / metric / 结构化日志
   都必须留在 transport runtime（`KEEP-12`），不交给客户端；
3. ~~若最终用 RTKQ，`initiate` 的生命周期义务必须包成一个共享 helper~~ ——
   ⛔ **已不适用**：Dexter 2026-08-28 二次裁定 **不使用 RTK Query**（`T-5`）。
   `initiate` 的生命周期义务因此**整条消失**。本条其余内容保留，作为该裁定的依据。

---

# 第四部分 · 整体判断

## 4.1 先说尺子（本节因 2026-08-27 Dexter 纠正而重写）

评价一个 POC，正确的问题是 **"它证明了什么 / 它把什么留作未证"**，
不是"它是否已经产品化"。第一版台账用产品阶段的判据量 POC，把
"机制先于业务建好、只用一个真实场景验证过"读成了过度设计 —— 那是判错了尺子。
第二部分 §2.0 已按四档重新分类。

## 4.2 结论

**这是一套明显高于平均水平的架构。**

- 该有的边界都真实存在并且**被字节验证过**（`KEEP-01`）；
- production 源码零 `TODO/HACK`（`KEEP-23`），说明"不留临时方案"是真执行的；
- 设计文档会记录被推翻的方案（`KEEP-24`）；
- 机制型 POC（workflow、权益框架）目标明确、验证到位，并留下可继承的形状（`KEEP-27`）。

**35 条 FIX 里，真正"POC 做错了"的有 6 条**
（2026-08-27 首轮判 4 条 → `FIX-05` 自我推翻降级为 3 条 → 2026-08-28 逐包精读新增 3 条）：

| # | 为什么它在任何语境下都错 |
|---|---|
| `FIX-07` 条件调用 hook | prop 由 `undefined` 变为有值时 hook 数变化，React 直接抛 |
| `FIX-20` 未知 step 静默成功 | 把没执行的步骤报成 COMPLETED，**损害 POC 自己的结论可信度** |
| `FIX-22` 脚本假超时 | `setTimeout` 无法中断同步 `new Function` 体，死循环永远等不到超时 |
| **`FIX-24` HTTP 不检查状态码** | 5xx 被当传输成功 ⇒ 故障切换不触发、坏地址被记为首选。**"多地址容错跑通了"这个结论不成立** |
| **`FIX-25` `protected` 未加密** | 类型与描述符承诺加密存储，实现是"另一个同样明文的 MMKV 文件"。**过度承诺** |
| **`FIX-28` 自动刷盘失败静默** | 存储异常时界面一切正常、重启后状态丢失。**"崩溃恢复原状"这个结论在存储异常时不成立** |

**共同点**：这六条都不是"还没做"，而是**会让某个已经声称成立的结论其实不成立**。
其余 29 条中，多数是产品化范围或 TER 换形状即可，另有 3 条是待裁的设计取舍。
（2026-08-29 补录 `FIX-34`/`FIX-35` 两条，均非本质缺陷，故 6 条不变。）

**三类反复出现的形态**（TER 应作为规范条目防再犯）：

1. **静默失败**：HTTP 5xx 当成功（`FIX-24`）· 刷盘失败无信号（`FIX-28`）·
   未知 step 报 COMPLETED（`FIX-20`）· 脚本假超时（`FIX-22`）· 坏 JSON 静默跳过 ·
   端口缺失静默降级（`FIX-04`/`FIX-22`）—— **六处形态不同，本质一样**。
2. **边界名义存在、实际是洞**：`Record<string, unknown>` 穿透端口（`FIX-03`）·
   十个端口全可选无 fail-fast（`FIX-04`）· `protected` 不加密（`FIX-25`）·
   依赖声明与实际不符（`FIX-31`）· manifest 与依赖图不符（`FIX-32`）。
3. **有机制却没用自己的机制**：主数据同步逐条、持久化整块（`FIX-27`）·
   `multiGet` 端口有但 hydrate 不用（`k-06` §6.4）· `persistedValueCache` 在手却不做差量（`FIX-28`）。

## 4.3 重构范围

**骨架整体继承（36 条 KEEP）。**
先修 6 条本质缺陷 → 再按 TER 需要换形状 → 产品化欠账随范围补 → 3 条取舍交 Dexter。

**建议下手顺序**：`FIX-01`（包按 owner 重切）——
因为 `FIX-02` `FIX-03` `FIX-04` `FIX-11` 都挂在包结构上，切法定了它们顺手解决。

**真正需要新设计的仍只有两处**：单机双屏改一个 store 一个 VM（`CON-01` / `CON-02`），
与本地可查询业务数据的能力型端口（`FIX-15`，已裁定推迟）。

---

## FIX-34 【产品化欠账】overlay 分流靠具体 part key，声明好的 `kind` 没人读

**证据 · 已亲验**

`2-ui/2.1-base/runtime-react/src/ui/components/`：

- `AlertHost.tsx:22-24` —— 挑出 alert：
  `screenPartKey === 'ui.base.default-alert' || rendererKey === 'ui.base.default-alert' || id.startsWith('overlay.alert')`
- `OverlayHost.tsx:21-23` —— **同一个三段谓词的精确反面**（三条全部取反并改 `&&`）

两者构成严格互补的分区，**当前行为正确，不会重复渲染**（本轮已逐条件比对确认）。

**为什么仍是缺陷**

1. **分流键选错了层级。** `defineUiAlertPart` 明明在 definition 上写了 `kind: 'alert'`
   （`foundations/defineUiAlertPart.ts`），**两个宿主都不读它**，
   而是去匹配 `'ui.base.default-alert'` 这个**具体 part 的 key**。
   ⇒ 宿主认得的是"默认 alert 这一个 part"，不是"alert 这一类"。
2. **自定义 alert 只能靠命名约定兜住。** 业务注册 `biz.checkout-alert` 时，
   前两个 clause 全不匹配，**唯一接住它的是 `id.startsWith('overlay.alert')`** ——
   用字符串前缀代替类型判断。若自定义 alert 指定了别的 `containerKey`，
   它会被 `AlertHost` 漏掉、被 `OverlayHost` 接走。
3. **同一谓词两处反写。** 改一处必须记得改另一处，且要正确取反 —— 无门保护。

**归入 §4.2 第三类形态**：「有机制却没用自己的机制」——
`kind` 字段就是为这件事准备的，建了没用。

**TER 的方向**：宿主按 `kind` / `containerKey` 分流，
**源码中不得出现任何具体 part 的 key 字面量**；分流谓词只写一处。

---

## FIX-35 【POC 残留】`DefaultAlert` 内联 style，9 处硬编码色值

**证据 · 已亲验**

`2-ui/2.1-base/runtime-react/src/ui/components/DefaultAlert.tsx` ——
`#d1d5db` `#ffffff` `#111827` `#374151` `#2563eb` 等**共 9 处**色值字面量
（行 85、86、93、99、106、124、129、144、149），尺寸、圆角、间距同样内联。

**为什么在 POC 语境下不算错**：POC 期没有设计系统，内联 style 是最短路径，
且这是**兜底件**，不是产品外观。按 §2.0 的尺子，这是 **POC 残留**，不是本质缺陷。

**为什么 TER 必须换形状**：TER 已裁定 UI 统一走 **NativeWind + React Native Reusables**，
一套内联 style 的组件既进不了设计系统，也没法跟着主题走。

**一条要一起带走的判断（Dexter 2026-08-29）**：
**真实场景中 alert 一定是自定义组件。** 所以 TER 里 fallback 的定位必须是
**「诊断兜底」而非「可用外观」** —— 一个做得"能看"的默认 alert 会挤掉真正的注册，
最后线上跑的是兜底件。判据：**不能被误当成成品**。

---

## 补录说明（2026-08-29）

`FIX-34` / `FIX-35` 来自 2026-08-29 对 `runtime-react` 渲染宿主的定向精读，
不在 2026-08-27/28 两轮的覆盖内。触发原因：Dexter 指出
"render 的默认 alert 用裸 RN 组件"这个说法不对 —— 真实场景 alert 一定是自定义组件。

**本轮已扫**：`AlertHost` · `OverlayHost` · `ScreenContainer` · `UiRuntimeRootShell`
（后两者**无**具体 part key 字面量，本条缺陷只在前两者）。

**尚未扫**：`runtime-react` 的 hooks 层（`useUiOverlays` / `useScreenPartsByContainer` /
`useChildScreenPart`）是否也有同类的具体 key 依赖 —— **`UNVERIFIED`**，
留待包级精细化设计时补扫。

---

## 边界

1. 本台账只记录事实与判断，**不构成评审结论、不授权实施**；
2. POC 仓为只读 Heritage，未回写任何内容；
3. 标注 `UNVERIFIED` 的条目本轮未验证，不以确定语气陈述；
4. 所有计数类结论的穷举范围见 §0，可复算。

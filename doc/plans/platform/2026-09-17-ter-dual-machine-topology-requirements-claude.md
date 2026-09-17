# TER 双机拓扑 · 需求分析(第 1 版)

- 作者:Claude｜日期:2026-09-17
- 前身:`2026-09-17-ter-dual-machine-topology-requirements-discussion-claude.md`(讨论稿,经四轮独立盲审全部 NO-GO 后重写为本稿;本稿此后又经多轮作者自审与三条新裁定的回改)
- 取向:**不过度设计,接受有限有损**(Dexter 2026-09-17)

## 0. 方向、核心目的与已定裁决

### 0.1 方向

一台**主机**带一台**副机**,副机能在**主屏/副屏之间切换**。副机通过**输入主机 IP** 完成配对(POC 用扫二维码,TER 简化)。

**核心目的**:把 TER 已经声明但从未接通的几条链路接起来——传输、拓扑连接、跨机命令、角色切换——让两台设备成对跑起来。

### 0.2 证据档位

| 档位 | 含义 |
|---|---|
| 【源】 | 打开源码亲验,附 `文件:行` |
| 【检索】 | 检索得出的**否定结论**,附检索范围;行级检索对多行写法有盲区 |
| 【推】 | 由多处【源】组合推出 |
| 【正本】 | 引自仓内既有需求正本 |
| 【外部】 | **引自 v2s 仓之外的 POC 仓**(见下),从 v2s 仓根**打不开**;属外部输入,不得当作本仓现状 |

⚠️ **关于 POC 引用(Codex M-4)**:本稿所有 `TopologyHostV3*.kt`、`topology-runtime-v3`、`topology-runtime-bridge`、`connectionActor`、`fetchHttpTransport`、`AppRestartManager.kt`、`DefaultAlert.tsx`、`resolveTopologyLaunch.ts`、`instanceInterconnection.ts` 等引用**全部位于两个独立的 POC 仓,不在 catering-v2s 仓内**。作者对它们逐行亲验过,但**评审方与实施方从 v2s 仓根无法打开**。⇒ 凡引 POC 之处一律按**【外部】**读,**不得升级为当前仓源码事实**;需据以实现的部分,必须在详设中冻结为本仓自己的契约(见 R-8 的 wire contract)。

POC 路径:**v1** = v1 版 POC 仓,**v2** = v2 版 POC 仓。TER 路径为仓根相对路径。

### 0.3 已定裁决(Dexter 2026-09-17,11 条编号 + 3 条具名)

**第一轮七条**:

| # | 事项 | 裁定 |
|---|---|---|
| ① | 配对入口放哪 | **admin console 中单独开一个 tab 控制页** |
| ② | IP 输入形态 | **只输入 IP** |
| ③ | 是否显示主机身份 | **要** |
| ④ | 电源触发主副屏切换是否确认 | **要弹窗用户确认** |
| ⑤ | `enableSlave` 默认值 | **默认关** |
| ⑥ | 受管副屏存储闸 | **暂不做** |
| ⑦ | 第一版跨机远程命令 | **必须有**;且 `apps/terminal/assembly/android` 的**两个 APP 都要跑通** |

**第二轮四条**:

| # | 事项 | 裁定 |
|---|---|---|
| ⑧ | 为配对改 `ui/base` 派发类型契约 | **"当然要改"** |
| ⑨ | 角色切换生效方式 | **可以重启,但重启的是副机侧的 JS 端(不是 APP)**;并要求 **TER 在 adapter 补充重启能力** |
| ⑩ | 传输包通用性本期无法证明 | **"可以"**(认这笔赊账) |
| ⑪ | 拓扑控制页落点 | **"双机拓扑是 base 能力,不是 feature"** |

**〔适用范围裁定〕**(Dexter 2026-09-17,本轮新增):

> **mobile 机型不支持拓扑;laptop 单机双屏也不支持。**

⇒ 双机拓扑只支持 **laptop 形态 + 单屏设备**。**裁决⑦"两个 APP 都要跑通"须按此范围读**——是两个 APP 在 laptop 单屏形态下都跑通,不是所有机型都跑通。落点见 R-2a、§6。

**〔等价性裁定〕**(Dexter 2026-09-17,本轮新增):

> 第一版 `sample-terminal` 要能在**双机双屏**与**单机双屏**下都完美运行,且**行为一致**。

⇒ 这不是"选一个同步方案",而是给出了**可推导、可对照的目标**:单机双屏下副屏显示什么、何时变化,双机下副机就必须一样。**"同步哪些切片"因此不再是判断题**——副屏 part 实际读的那些,就是必须下行的集合;多同步是浪费,少同步就是行为不一致。落点见 R-5a、R-11、U-19。

⚠️ 两条裁定不冲突:**单机双屏是不参与拓扑的独立形态**,双机是两台单屏 laptop 组成的拓扑,二者是同一个 APP 的两种部署。

**另有三条针对 D 项的裁定(Dexter 2026-09-17),正文落在 §7**:D-1 拓扑 tab **恒可见**、闸口下移到功能可用性;D-6 **主机/副机是 base 能力**,不存在每 APP 的角色矩阵;D-17 掉线后**不断重连**、不退化、不设放弃条件。

**〔`enableSlave` 语义裁定〕**(Dexter 2026-09-17),正文落在 R-4:

> "`enableSlave`,开启后,会启动 Android 端的 web 服务,即使机器重启了,也会根据这个标记启动的 web 服务。"

⇒ 它是**主机侧开关**,直接驱动原生 web 服务的起停,且**持久化;APP/JS 启动后按标记恢复服务**。⚠️ Dexter 2026-09-17 补充前提:**终端目前只是普通 APP,需人工启停,系统不自动拉起** ⇒ D-20 据此收口为"APP 启动后恢复",**不做设备级开机自启**。

**另有一条更早的裁定,不在上表编号内,但本稿多处依赖**——下称**〔信任边界裁定〕**:

> "不做认证。没有所谓的陌生不陌生的设备,**一个 master 只能匹配一个 slave**,不要过度设计。"

⚠️ 它与 ⑥(受管副屏存储闸暂不做)**是两件无关的事**,不得混引。R-8、R-13、§6 引的都是这一条。

---

## 1. 当前实现事实

> ⚠️⚠️ **本章 §1.1–§1.4 全部是 POC 的事实,不是 catering-v2s 的事实。** 其中标注的【源】指"作者在 POC 仓逐行亲验",**一律按 §0.2 的【外部】读**——这些文件从 v2s 仓根打不开,**不得作为本仓现状或实现依据**(Codex 二轮 M-4)。本仓自身的现状从 **§1.5 起**。

### 1.1 POC 出厂形态比设计稿简单得多

v2 仓里有两套东西,必须分清:

- **未接线的设计稿**:`host-runtime` 包(ticket 签发、session 状态机、离线队列、重绑、resume 栅栏、兼容性裁决)。**全仓无任何源码 import 它**【检索:newPOSv1 全域排除 node_modules/dist 搜 `kernel-base-host-runtime`,仅命中自身 package.json 与 vitest.config】。
- **真正在跑的宿主**:Android 原生 `TopologyHostV3*.kt` 与 mock server。

| 机制 | 出厂实现 | 证据 |
|---|---|---|
| 配对 | **只判角色占位**,MASTER/SLAVE 各一坑,冲突回 `ROLE_OCCUPIED` | `TopologyHostV3Runtime.kt:35-69`【源】 |
| 认证 | **没有**。Hello 无 token 字段;路由 `/ws` `/status` `/stats` `/diagnostics` `/fault-rules` 全部无鉴权 | `TopologyHostV3Server.kt:111-134`【源】 |
| 对端离线 | **静默丢弃**,无队列、无补发 | `TopologyHostV3Server.kt:245-251`【源】 |
| 心跳 | 服务端定时 ping,超时踢连接 | 同上 `:191-213`【源】 |

⇒ **第一版不需要 ticket、session、离线队列。出厂 POC 自己都没有。**

### 1.2 双屏机与双机是同一套机制的两种对端

`resolveTopologyLaunch.ts` 的设计意图注释原文(`:20-24`)【源】:**"Android assembly 的主副屏都必须通过真实 loopback topology host 通讯"**。`:28-30` 单屏直接返回不起宿主;`:43-48` 双屏主屏取 `role:'master'`;`:55-70` 副屏取 `role:'slave'`。`bootstrapRuntime.ts:13-18` 双屏主屏**显式派发 `setEnableSlave(true)`**【源】。

⚠️ 但 **TER 侧有相反的裁定**:display-context 正本 §4.6 ① 引 Dexter 2026-08-31 裁定「**双屏设备不能整体作为 pair 的副机 ⇒ 副机必为单屏设备**」,判据为 `getDisplayInfo()` 屏数 > 1 即拒【正本】。⇒ **TER 不继承 POC 的"双屏机也当拓扑对端"形态**,见 R-2 与 R-2a(〔适用范围裁定〕进一步明确"laptop 单机双屏也不支持拓扑")。

### 1.3 POC 的主副屏显示逻辑(逐环)

```
App.tsx:9-10            createHostApp({RootScreen, ...})
createHostApp.tsx:204-8 <UiRuntimeProvider><RootScreen/></UiRuntimeProvider>
RootScreen.tsx:41-53    display = displayIndex>0 ? 'secondary'
                                : (topology displayMode==='SECONDARY' ? 'secondary' : 'primary')
RootScreen.tsx:114      <UiRuntimeRootShell display={display}/>
RootShell.tsx:39-41     container = display==='secondary' ? secondaryRootContainer : primaryRootContainer
ScreenContainer:555     useChildScreenPartResolution(containerPart)
useChildScreenPart:29   selectUiCurrentScreenOrFirstReady(state, containerKey)
selectors:130-136       selectUiScreen(containerKey) ?? findFirstReady(containerKey, -1, ctx)
screenRegistry:10-15    ctx 三轴同时与:screenModes ∧ workspaces ∧ instanceModes
screenRegistry:61-75    命中集按 indexInContainer 升序,取第一个 readyToEnter
```

全部【源】。**当前 screen 由本机自己写入**:`runtimeInitializeActor.ts:19-40` 在本机 initialize 里调 `replaceCateringShellRootScreen`;后者(`rootScreenRouter.ts:18-40`)按 `activated` 算出 primary/secondary **两个** target,**连发两条 `replaceScreen`**;路由由 definition 自带的 `containerKey` 决定(`screenRuntimeActor.ts:55-74`)。

> ⇒ **副机显示的是它自己 initialize 时推进去的页面,不是主机远程推的。** 主机只同步状态,不推屏。

⚠️⚠️ **这是 POC 的模型,TER 不能照抄**:POC 副机的页面由它自己 initialize 决定,只有一套静态首屏;而 TER 按〔等价性裁定〕要求副屏**随主机的业务事件逐步迁移**(欢迎页 ⇄ 顾客确认页)。⇒ TER 必须另有一条让屏幕迁移到达副机的路径(D-17),**不得引用本节这句话作为"不用推屏"的依据**。

**三个坑**:

1. **`screenModes` 里的 `'PRIMARY'`/`'SECONDARY'` 是死条目。** `buildUiScreenRegistryContext:101` 是 `overrides.screenMode ?? 'DESKTOP'`,而**全仓无任何调用点传 overrides**【检索:三个选择器的全部调用点枚举,`useChildScreenPart.ts:29`、`useScreenPartsByContainer.ts:17` 均只传两参】⇒ 该轴恒为 `'DESKTOP'`,**真正分主副屏的是 `containerKey`**。
2. **display 判定必须 `displayIndex` 优先**。POC 注释自陈(`RootScreen.tsx:45-47`):"topology displayMode 不再承担首次选容器的职责,否则副屏会受 initialize 时序影响,短暂落到 primary root"。
3. **主副屏渲染同一棵组件树**(`RootScreen.tsx:103-125`),差别只有往下传的 `display` prop。

### 1.4 v1 值得继承的一件事

**重连时的 LWW 对账**:双方交换 `updatedAt` 摘要 → 算差异 → 补推 → 才开始增量同步(`instanceInterconnection.ts:61-73`、`:92-102`、`:114-172`)【源】。比 v2 的离线队列便宜得多。

### 1.5 TER 已有、可直接复用

| 能力 | 证据 |
|---|---|
| `SyncIntent` / `SyncStateDiff` / `SyncValueEnvelope` 与 v2 同形 | `state/src/types/sync.ts:4-19,48-61`【源】,注释自陈 "POC-compatible contract" |
| 全量同步载荷 + 落地 | `state/src/foundations/sync.ts:58-115`【源】 |
| **传输配置契约**(space→servers→addresses) | `contracts/src/types/transport.ts:11-46`,公开导出【源】 |
| 跨机命令派发器(四态生命周期、超时竞速、迟到补发) | `createCommandPeerDispatcher.ts` 全文【源】 |
| 网关安装口 | `types/module.ts:70` `installPeerDispatchGateway`【源】 |
| 浮层与确认框机制(`alert` 层 + `decisive` guard) | `LayerStack.tsx:59-67,177-178,201-205,224`【源】,行为已核;member-desk 已有三个确认组件在产 |
| 管理台 section 机制 | `admin-shell/src/parts/parts.ts`【源】;`consoleAssembly.tsx:316` 无条件并入 |
| 显示派生与资格、电源触发切换 | `displayDerivation.ts:16-62`【源】 |
| **电源桥的播种与去重**(POC 教训已落地) | **本仓事实**:`createPowerStatusBridge.ts` 首个事件只播种、同值去重、`dispatchTail` 串行【源】。**外部对照**:与 POC `topology-runtime-v3/createModule.ts:107-123` 逐条同形【**外部**】⇒ **这一环 TER 已经对齐,本批只需不破坏**(U-12)。⚠️ 本行曾把两者同标【源】,易被误读为都在本仓,已分开 |
| **`DevicePort.getDisplayInfo()`** | 端口 `device.ts:60`;Android 真实现 `androidDevice.ts:100-114`(`state:'real'`)【源】 |
| **管理台调起门禁用物理事实** | `AdminLauncher` 由 `consoleAssembly.tsx:603` **无条件挂载**;`isHostPrimaryDisplay` 取 `displayIndex === 0`(`surfaceHost.ts:79`)【源】 |

### 1.6 TER 的缺口

| 缺口 | 性质 | 证据 |
|---|---|---|
| **主机侧原生宿主** | **最长的一根杆,且含原生 Kotlin** | 三处独立验证【源】:`androidPlatform.ts:44` 绑 `unavailableTopologyHostPort`(两个 Android APP 唯一绑定点;`dev-host/webPlatform.ts:87` 是第三处平台绑定,同样 unavailable);Kotlin 注册名恰好四个(PersistKv/Device/DualScreen/NativeLoading);TS 侧 `requireNativeModule` 桥接恰好四处,与前者一一对应。**16 个 `.kt` 与 8 个 gradle 里没有任何网络类/网络库**;`topologyHost` 的引用枚举里**无任何 actor/module/command 驱动其起停** |
| HTTP + WS 客户端 | 全新 | `transport` 包仅 `dependencies/index/moduleName` 三个源文件;全仓无 HTTP 客户端【检索】。⚠️ **成本不对称**:宿主侧(服务端)是绿地含 Kotlin【源】;客户端侧 RN 运行时自带 HTTP/WS,原生可能无需新增【推,未核 RN 全局是否到达 TER 包】。但 `tsconfig.base.json` 无 `lib`/`types`/DOM、`files` 只含仅声明 `__DEV__` 的 `terminal-env.d.ts`【源】⇒ **继承它的 kernel 包拿不到 `fetch`/`WebSocket` 类型,新传输包须自带** |
| 副机侧拓扑端口 | 未声明 | `platform-ports/src/types` 12 个文件里只有主机侧的 `topologyHost.ts`【源】 |
| 跨机线上信封契约 | 全新 | TER contracts 无 v2 那五类 Envelope【源】 |
| `enableSlave` / `masterLocator` 概念 | 全新 | 全仓零命中【检索:apps/terminal 排除 node_modules/.turbo】 |
| 增量差分生产者 | 缺(消费侧已有) | `applySliceSyncDiff` 已实现 `replaceMissing:false` 分支【源】 |

### 1.7 三条已知假绿

1. **启动门 `ports` 恒绿**:`consoleAssembly.tsx:91-92` 只判绑定非空,`topologyHost` 绑 unavailable 也过【源】。
2. **切换命令从未在生产跑过**:`switchDisplayRoleCommand`/`switchInstanceModeCommand` **生产零派发方**【检索】,生产靠三个 actor 直接 `dispatchAction` 绕过(`powerStatusActor.ts:80`、`validateHydratedDisplayRoleActor.ts:37`、`runtimeRoleChangedActor.ts:30`)。
3. **同步引擎有实现、无业务消费方**:`createStateRuntime.ts` 生产调用全量载荷与落地,但**没有任何业务切片被搬运**;生产里唯一非 isolated 切片是 `requestLedger`(`requestLedger.ts:153-163`)【源】。

### 1.8 本批必须尊重的既有正本

| 正本 | 管辖内容 | 对本批的约束 |
|---|---|---|
| display-context 需求正本 §4.4 | **准入判据**:`CHIEF→VICE` 要求 `instanceMode==='SLAVE'` **且** `routeContext.displayMode==='PRIMARY'`;`VICE→CHIEF` 要求 `SLAVE` | 配对必走 `CHIEF→VICE`,**必须满足** |
| 同 §4.4a | **所有写 `VICE` 路径的共同前置**:`getDisplayInfo().status==='succeeded'` 且 `displayCount===1`,**每条路径各自实时求值,不得复用上次结果**;点名三条写路径,第三条是 **hydrate** | 本批的"重启 JS 生效"正走 hydrate |
| 同 §4.4b | **启动校验**:hydrate 之后、runtime `started` 之前,用新鲜 `getDisplayInfo()` 重验 `VICE`;形态照 TR-11(command + actor) | 同上 |
| 同 §4.5 | 电源链路 `subscribePowerStatus → 桥(播种/去重) → powerStatusChangedCommand → PowerStatusActor → displayRole`;**已裁定派发前有一步 UI 确认** | 裁决④ 是**还这笔账**,不是新增 |
| 同 §4.6 ① | **双屏设备不得整体切 SLAVE**(Dexter 2026-08-31),屏数 > 1 即拒 | R-2 必须实现 |
| 同 §5 | `masterLocator`、TCP 激活/连接/重连 **归 `transport`/topology**;"确认交互的呈现"v1 无独立确认步,将来若加**确认动作自己也是一条 command** | 本批持有 masterLocator 是对的;确认步形态已被规定 |
| 同 §6 S-1 🔴 | **每个 Root Surface 在其发出的所有命令上自动盖 `routeContext` 的 `displayMode` 与 `workspace`;不得让业务组件自己传** | 见 R-2、§8 |
| 同 §7 T-1 🔴 | "已激活主机不得切 SLAVE"因 `transport` **零声明**而推迟 | 本批建 transport ⇒ 具备还账条件 |
| admin console 正本 AC-5 | admin-shell **不得 import 任何 `ui/feature` 包**;section 以 part 声明、用 `admin.*` 容器键、进同一 `UiCatalog`、由 console 层枚举;顺序即列表顺序;**每个 section 自带可见性声明,不得留成摆设** | R-1 的落点与形态 |
| 同 AC-6.1 | admin-shell 自带 kernel/base 界面,**本期全部只读**;"写能力是 admin 的应有之义,但立项前必须先解决 **admin console 正本的 D-5**" | 本批即该立项;**admin console 正本的 D-5** 已因门禁改用物理事实而**结构上不可能发生**(正本 `:68-70`,本稿 §1.5 末行亲验)。⚠️ **与本稿 §7 自己的 D-5 同名不同物**,不得混引 |
| sample-infrastructure 正本 R-S1 | 就绪按**物理表面**判定;其勘误明写 `VICE && SLAVE` 会把物理 0 号屏判为逻辑 SECONDARY,**单屏 SLAVE 设备按旧定义永远等不到就绪** | 副机配对后的就绪**已被解决**,本批直接引用,不重新推导。⚠️ **正因如此,R-5a 不得就地改 `resolveSecondarySurfaceAvailable` 的物理语义**——就绪与本批的内容路由共用这一个函数,改它会越过本行的"不重新推导" |

---

## 2. 与目标的差距

| 目标 | 今天 | 差距 |
|---|---|---|
| 副机输入 IP 即可配对 | 无传输、无拓扑状态、无 `masterLocator` | 全新 |
| 配对后副机显示副屏内容 | ① 业务 part 全声明 `instanceModes: ['MASTER']`;② 驱动副屏的 actor 判的是**本机物理屏数**(`hasSecondarySurface`,12 个调用点) | ① 放开白名单(R-5);② **改判"本拓扑有无副屏表面"(R-5a)** ——只做 ① 的话 part 解析得出来却没人把它推上屏 |
| 配对动作从管理台发起 | 管理台可派命令(已亲验),但 §4.4 准入依赖的 `routeContext` **无人盖章** | 实现 S-1 |
| 主机可被连接 | **两层都缺**:① `topologyHost` 绑 unavailable、原生零实现;② **没有驱动它起停的概念**——`enableSlave` 全仓零命中,也无对账 actor | ① 原生 Kotlin 服务端(R-8);② `enableSlave` 持久化标记 + desired/actual 对账(R-4) |
| 跨机下命令 | 网关接缝齐、零安装 | 实现网关 |
| 状态跨机同步 | 契约齐、无搬运方 | 实现搬运 |
| 副机角色切换生效 | surface 的 displayMode/画布是**一次性快照**:`createSurfaceForDisplayIndex` 取一次 `getState()` 算出 `displayMode` 即定,**不订阅**(`consoleAssembly.tsx:207-212`)【源,此前为【推】】 | 重启 JS(裁决⑨) |

---

## 3. 需求

### 3.1 配对

**R-1 拓扑控制页(裁决① + ⑪)**

- 在 admin console 中新增**一个独立 tab**,承载双机拓扑的全部操作。
- **落点是 `ui/base/admin-shell`**,不是 feature 包。依据:裁决⑪;`AC-5.1` 明令 admin-shell **不得 import 任何 `ui/feature` 包**(若做成 feature 再被引用即违规);POC 的唯一拓扑 UI 先例也在 base 的 admin-console 包内。
- 形态照 `AC-5`:以 part 声明、容器键 `admin.sections`、进同一 `UiCatalog`、由 console 层枚举;partKey 取 `admin.console.topology`;section 顺序即 `parts` 数组位置。
- 每个 section 须**自带可见性声明且与实际一致**(`AC-5.6`)。⇒ 拓扑 section 声明为**恒可见**,主机 / 副机 / 未配对 / 各机型一律显示(D-1),该条因此恒真。
- ⚠️ 新增 section 须同步 `adminTestIds.ts` 的 partKey→testId 分支(`:20-23`)与 **laptop/mobile 两个变体**,照既有 section 模式即可(`admin-shell/src/parts/parts.ts`)。⚠️ 作者初稿曾主张"只声明 laptop、mobile 上不出现",**已被 D-1 推翻**:tab 恒显示,机型限制表达为功能不可用 + 可读原因,**不做显隐**。
- ⚠️⚠️ **拓扑控制能力的注入边界必须冻结,不得留给实施方自选**(Codex 二轮 S-2):现状是 section 的 `commandBoundary` 无条件抛错(`adminSectionSelection.ts:26-30`),而 `AdminLauncher`/`AdminLayer` 又在直接用 `useDispatchCommand` 绕过它【源】。⇒ 两条都不可取:**不冻结则拓扑 section 派不出配对/解绑/`enableSlave`;放宽通用 boundary 则所有 admin section 都能发拓扑命令**。详设须定死:**只有拓扑 section 获得一个 typed 的窄拓扑 capability**,其余 section 维持现状;该 capability **不得暴露 `Runtime`**,**不得 import `ui/feature`**(AC-5.1),**不得让 section 自己管原生宿主生命周期**(R-8)。落点并入 D-16。

**R-2 配对写入链路与准入**

配对的写入顺序是**硬约束**,顺序错即落入错误状态:

```
① 用户在拓扑 tab 输入主机 IP
② 合成 wsUrl = ws://<ip>:<固定端口>/ws,httpBaseUrl = http://<ip>:<固定端口>
③ 取回并显示主机身份,由用户确认(裁决③,见 R-3)
④ 写 masterLocator(本批持有,依据 display-context 正本 §5)
⑤ 派发 switchInstanceMode(SLAVE)   ← 准入:§4.6 ①③
⑥ 派发 switchDisplayRole(VICE)      ← 准入:§4.4 + §4.4a 共同前置
⑦ 重启副机 JS(R-6)
⑧ hydrate 启动校验(§4.4b)后建立连接
```

- **⑤⑥ 不可交换**:`runtimeRoleChangedActor.ts:27-30` 在 instanceMode 变化时把非 CHIEF 的角色**无条件重置为 CHIEF**【源】;先写 VICE 再切 SLAVE 会被重置掉。
- **⑥ 必须满足 §4.4a 共同前置**:`getDisplayInfo().status === 'succeeded'` 且 `displayCount === 1`,**实时求值**。端口非 `succeeded`、`displayCount` 缺失/非整数/`<1` 一律 **fail-closed 拒**。
- **⑤ 必须满足 §4.6 ①**:`getDisplayInfo()` 屏数 > 1 ⇒ 拒(双屏设备不得整体当副机)。
- **⑥ 必须满足 §4.4**:`routeContext.displayMode === 'PRIMARY'`。
- ⚠️ **`routeContext` 今天无人盖章,这是 S-1 未实现,不是本批发明的问题**。修法**只能**是实现 S-1(Root Surface 在其发出的所有命令上自动盖章),**不得让拓扑控制页自己传**——正本明令禁止,漏一处即静默写错屏。见 R-9。
- ⚠️ 当前"`routeContext` 缺失时 typed reject"是 display-context §8 v1 required 明确要求的**正确行为**,**不得为了让配对通过而放宽准入**。

⚠️ **`masterLocator` 的归属、持久化与失败回滚必须一并定死(Codex S-6)**——写入顺序只说了"第 ④ 步写 locator",但这是整条配对恢复链的真实状态边界:

- locator 属于**哪个拓扑切片**、`syncIntent` 与 `persistIntent` 各是什么;
- 字段构成:IP、端口、以及 R-3 取回的主机身份,**哪些入持久化**;
- **第 ⑤⑥ 步(切 mode / role)失败时,第 ④ 步写入的 locator 是否清除**——不清则留下"有 locator 但角色没切"的半配对态;
- **hydrate 时 locator 无效**(主机换 IP、被回收)如何处理:是保留并持续重连(D-17"不断重连"),还是判失效;
- **解绑是否原子清除**(locator + mode + role 三者要么全回退要么全不动);
- **stale locator 是否阻止本机进入 MASTER**——这与 T-1"已激活主机不得切 SLAVE"是对称问题。

**R-2a 机型准入门(〔适用范围裁定〕)**

拓扑准入必须**同时**满足:**`surfaceForm === 'laptop'`** 且 **单屏**。取不到 `surfaceForm` 一律 **fail-closed 拒**。

- **屏数这一半已有正本覆盖**:display-context §4.6① 的"屏数 > 1 即拒"即是,**本批不另造机制**。
- ⚠️ **机型这一半今天是个真空子**:mobile 是单屏设备,`displayCount === 1` 照样放行 ⇒ 现有判据会**允许 mobile 切进 VICE**,然后在重启后撞上 `createSurfaceForDisplayIndex` 的 SECONDARY 拒绝(`consoleAssembly.tsx:213-215`)【源】。三份既有正本都没有机型判据,**这是本批新增的**。
- 撞上时不是崩溃:`AndroidTerminalApp.tsx:68-77` 接住 throw 走 `renderFailurePage({reason:'surface-rejection:…'})`【源】。**但"能优雅失败"不是"可以让它发生"**——应在准入处拒,不靠失败页兜底。
- **判定只有一个,消费方有三处,口径不得漂移**:① 本准入门;② `enableSlave` 的可用性(R-4);③ 拓扑 tab 内各操作的置灰与原因文案(D-1)。三者必须调同一个纯函数(D-16)。
- ⚠️⚠️ **不得用 catalog 的 `surfaceForm` 轴把 tab 在 mobile 上过滤掉**——作者初稿曾主张这么做("白送"),**已被 Dexter 2026-09-17 裁定推翻**:tab 恒显示,不可用就告诉用户,**做显隐逻辑是白费的成本**。⇒ 拓扑 part 与其他 section 一样声明 `surfaceForm: ['laptop','mobile']`,**闸在功能不在显隐**。

⚠️ **落点受既有依赖边限制,详设须解(D-16),不得随手 import**:

- `skeleton-graph.ts:44-55` 里 **`ui-state` 依赖 `display-context`**;`display-context/package.json` 的依赖只有 contracts/platform-ports/runtime/state【源】。⇒ 在 display-context 内 `import {selectSurfaceForm}` 会**反转既有边并成环**,非法。
- `SurfaceForm` 类型现居 `ui-state/src/types/catalog.ts:7`【源】,display-context 同样取不到。
- `createDisplayContextModule.ts:18` 今天是 `(): RuntimeModule =>`,**无构造入参**【源】。
- 可参照的既有先例:两个资格函数**全部靠入参、不读 state**(`displayCount`、`routeDisplayMode` 皆为传入,`displayDerivation.ts:16-55`);而 `createUiStateModule.ts:51,79,82` 正是"`surfaceForm` 由模块构造入参传入"的现成形态【源】。**选哪条由详设定,本稿不指定修法。**

**R-3 主机身份的取得与显示(裁决③)**

- 身份必须在**连接前**取回并让用户确认,不是配对成功后展示。理由:裁决③ 的实际用途是让用户发现 IP 输错了;配对后才显示对这个用途毫无帮助。
- **机制上可行,不需要发明新通道**:`TopologyHostPort` 是**本机**端口(`start`/`stop`/`getStatus` 都只管本机),副机查不到对端;可行路径是副机对合成出的 `httpBaseUrl` 发一次 HTTP GET。POC 的宿主正好暴露了无鉴权的 `/status`(`TopologyHostV3Server.kt:111-134`)【源】,TER 的主机侧宿主(R-8)须提供同类可查询端点。
- 身份字段、可读形式、端点路径与失败时的呈现由详设定(D-2)。
- ⚠️ POC 的 share payload 强制要求 `masterNodeId`,但**副机的连接路径并不需要它**:`processHello` 的 `ROLE_CONFLICT` 只在 `role==='master'` 时校验,副机 hello 带的是自己的 nodeId【源】。⇒ **只输 IP 不需要额外发明"主机身份发现"步骤**,身份仅用于显示。

**R-4 `enableSlave` 开关(裁决⑤)**

- TER 今天无此概念(全仓零命中),属净新增。
- 落在拓扑包的**持久化配置位**,由 R-1 的控制页开关。**默认关**。

⚠️ **语义已由 Dexter 2026-09-17 裁定:这是主机侧开关,开启即启动 Android 端 web 服务;标记持久化,`APP/JS 启动后`按该标记恢复服务。** ⚠️ 措辞须精确到这一层:**不是"设备开机即起"**——终端目前只是普通 APP、需人工启停,系统不自动拉起(D-20 已据此收口为方案 (a))。 POC 的实现形态如下,TER 照此继承。⚠️⚠️ **本小节以下每一条引用(`hostLifecycleActor.ts`、`configState.ts`、`TopologyHostV3Service.kt`、`runtimeDerivation.ts`、以及 BOOT_COMPLETED 检索)一律为【外部】**——作者在 POC 仓逐行亲验,但**从 v2s 仓根打不开,不得当作本仓事实或实现依据**:

- **它是"主机侧"的**:`hostLifecycleActor.ts:19-26` 的 `shouldRunTopologyHost` 是四条与——`displayCount===1 && displayIndex===0 && instanceMode==='MASTER' && enableSlave===true`。⇒ **在副机上打开它不会起服务**(instanceMode 不满足),不存在"在副机上误启服务端"的风险。
- **持久化且立即落盘**:`configState.ts:21-32` 的切片 `persistIntent:'owner-only'`、`syncIntent:'isolated'`,四个字段 `flushMode:'immediate'`——`instanceMode`、`displayMode`、**`enableSlave`**、`masterLocator`。⇒ 重启后水合即恢复。
- ⚠️⚠️ **但"重启后自动起服务"的机制是 JS 水合,不是 Android 开机自启**:全仓 `.kt`/`.xml` 搜 `BOOT_COMPLETED`/`BootReceiver`/`autoStart` **零命中**【检索:newPOSv1 全域排除 node_modules/build】;`TopologyHostV3Service.kt:20-27` 由程序调 `startForegroundService` 拉起。⇒ 真实链路是 **APP 启动 → JS 水合 `enableSlave` → fingerprint 变化 → `syncTopologyHostLifecycle` → `topologyHost.start()`**。**设备重启后若无人打开 APP,服务不会自己起来。** ⇒ **此形态已被接受**(D-20 收口为方案 (a)):终端目前只是普通 APP、需人工启停,系统本就不自动拉起,因此"无人开 APP 时服务不跑"与产品现状一致,**不构成缺口**。其运营后果(主机没开 APP 则副机连不上)已单列进 R-12。
- **服务本身是前台服务**,起来后活得住:`TopologyHostV3Service.kt:48-52` 在 `onCreate` 即 `startForeground` 并建常驻通知(`:120-135`,`setOngoing(true)`,IMPORTANCE_LOW),`:78` 把 wsUrl 写进通知文案。
- ⚠️ **默认值与裁决⑤ 表面冲突、实则一致**:`runtimeDerivation.ts:34` 未显式设置时取 `displayCount > 1 && standalone`,即 POC 的单机双屏默认开。但那是因为 POC 里双屏机自身就是拓扑对端(走 loopback);**TER 已裁定双屏机不参与拓扑、拓扑机必为单屏**,该式恒为 false ⇒ 落到 TER 就是"默认关",与裁决⑤ 一致。**TER 不继承这条默认派生,直接写死默认关。**
- "默认关"必然隐含"用户要能打开",该入口是拓扑 tab 的核心职能之一。
- ⚠️ **mobile 机型上不得可开**(〔适用范围裁定〕/ R-2a):否则用户能打开一个必然失败的开关。⚠️ **"不得可开"是置灰 + 给原因,不是把开关藏起来**(D-1);判定须与 R-2a 准入门、D-1 的可用性呈现调同一个纯函数(D-16)。

### 3.2 显示

**R-5 副机显示什么(裁决①"POC 会显示什么就显示什么")**

- 配对后副机处于 `SLAVE + VICE` ⇒ `resolveSurfaceDisplayMode` 得 `SECONDARY`,`resolveWorkspace({SLAVE, VICE})` 得 **`MAIN`**(不是 BRANCH)。与 display-context 正本 §2.3 的 **C 副机**形态逐行一致【正本】。
- TER **不需要**新建副屏根容器:POC 用两个根容器区分主副屏,TER 全部挂同一个 `main` 容器、靠 `displayModes` 过滤,更简单。
- TER **已有 secondary 变体**(`sample-wallpaper-console/parts.ts:15,28`、`sample-member-desk/parts.ts:129` 均 `displayModes: secondary`)【源】,不必新建界面。
- **要改的第一处是白名单**:业务 part 的 `instanceModes` 今天全是 `['MASTER']`(含那几个 secondary 变体)【源】,必须放开到含 `SLAVE`,否则配对成功那一刻两个 APP 的业务容器同时失去全部可用 part。
- ⚠️ **但白名单不是唯一要改的——作者一度这么写,是错的**,见 R-5a:part 能否解析与"谁把它推上屏"是两件事。
- ⚠️ 放开范围见 D-3。**〔等价性裁定〕已把它收窄**:副机要显示的就是单机双屏下副屏显示的那些,即声明了 SECONDARY 的 part;**不是"全部放开"**。

**R-5a 副屏可用性的判定必须由"本机物理屏数"改为"本拓扑有无副屏表面"(〔等价性裁定〕)**

这是满足〔等价性裁定〕的**硬阻塞**,不是优化项。

- `member-desk/src/features/actors/actors.ts:45-46` 的 `hasSecondarySurface` = `resolveSecondarySurfaceAvailable(readDisplayInfo(context.platformPorts.device))`,而后者是 `input.status === 'valid' && input.displayCount >= 2`(`displayDerivation.ts:65-66`)——**判的是本机物理屏数**【源】。
- ⇒ **单机双屏**:`displayCount === 2` ⇒ true ⇒ 走 `actors.ts:118-126`,确认页推到副屏、主屏挂"等待顾客确认"浮层。
- ⇒ **双机**:主机按〔适用范围裁定〕**必为单屏**,`displayCount === 1` ⇒ false ⇒ 走 `:128`,**退化成主屏上的"手持确认"形态**(还多一个"交还店员"按钮,`CustomerMember.tsx:135-144`)。**这正是"行为不一致"。**
- 影响面不是一处:`hasSecondarySurface` 在该文件有 **12 个调用点**(`:85, 90, 95, 103, 117, 139, 156, 167, 186, 191, 199, 207`)【源】,覆盖登录、会话恢复、登出、待确认、已确认、被拒、撤回、放弃等**全部导航分支**。
- ⇒ 需要的是一条语义为"**本拓扑当前有无可用副屏表面**"的判据,并把 `member-desk` 的 `hasSecondarySurface` 切到它上面。
- ⚠️⚠️ **必须带角色条件**(Codex 一轮 S-1):若只写"本机双屏 ∨ 已配对在线副机",**副机自己也满足"已配对且在线"会返回 true**,误以为自己还挂着一块副屏。**"对端存在"不等于"我有副屏",方向必须判。**
- ⚠️⚠️ **更要命的是"在线"这个词本身——它与 D-17「断线不降级」正面冲突**(Codex 二轮 M-1,作者确认成立):副机 WS 暂时断开 ⇒ `online=false` ⇒ 谓词转 false ⇒ 下一个 `memberPending` 落回 `actors.ts:128` 手持确认分支,**这正是 D-17 明令禁止的退化**。两条需求各自都对,**合起来自相矛盾**,是作者拼接时未检查其可组合性。
- ⇒ **必须拆成两个正交概念,不得合并成一个布尔**:
  - **拓扑副屏语义是否存在**(= 已配对且本节点为 MASTER,**与当前可达性无关**)——`hasSecondarySurface` 及一切**布局/页面形态**判定只看这个,所以断线期间副屏语义保持、不退化;
  - **peer 当前是否可立即派发**(可达性)——只影响**命令能否送达**与重连期间的提示,**不得反过来改变布局分支**。
- ⚠️ **三分支并非天然互斥**(Codex 二轮 S-6):双屏 master 若残留一个已配对 slave,①② 会同时为真。⇒ 详设须二选一并写死:**要么给出准入不变量**(拓扑激活态与本机物理双屏互斥——与 §4.6① "屏数>1 即拒"配套,但须补 master 侧),**要么给出确定优先级**。只写"三选一"不算数。
- ⚠️ 12 个调用点是**覆盖义务,不是改动量**:它们全部经同一个 `hasSecondarySurface` helper(`actors.ts:45-46`),**最小实现只替换该 helper 的实现体**即可。但验收必须覆盖全部 12 处所在的导航分支(U-19)。
- ⚠️⚠️ **但既有的 `resolveSecondarySurfaceAvailable` 必须原样保留,不得就地改语义**——作者初稿曾写"改动应落在 display-context",**那是错的**。调用面亲验【源+检索:apps/terminal 全域排除 node_modules/dist/.turbo/build】:
  - 生产调用方**三个**,不止 member-desk:`sample-wallpaper-console/src/features/actors/actors.ts:29`、`ui/base/dev-host/src/components/testExpoApp.tsx:822`(后者已写成 `surfaceForm === 'laptop' && resolveSecondarySurfaceAvailable(...)`,**"与 laptop 相与"的先例现成**);
  - 测试**四处**钉着它现在的物理语义:`display-context/test/derivation.test.ts:13-19`、`publicDisplayInfo.test.ts:12-22`、`sample-console/test/hostShape.test.ts:9-11`、`dev-host/test/webPlatform.test.ts:10-12`;
  - ⚠️ 且 §1.8 的 **R-S1 正本明写"就绪按物理表面判定"** ——就地改语义会**顺带改掉启动就绪行为**,而本稿 §1.8 声明"直接引用、不重新推导"。
- ⇒ **正确做法是新增一条拓扑判据、只切 member-desk 的调用**,物理判据留给就绪与 dev-host。形态与落点见 D-17。
- ⚠️ **两个概念的易变程度不同,不要混为一谈**:物理屏数在一次运行内基本不变;**"是否已配对"只在配对/解绑时改变——掉线不改变它**,这正是断线不降级能够成立的原因;**真正会频繁翻转的是"peer 当前可达"**,而它**不进副屏语义判据**,只影响命令能否送达与重连提示。⚠️ 作者初稿把可变性归因于"副机是否在线"并写进同一条判据,那是二轮 M-1 的病根,已改。

**R-6 副机侧重启 JS(裁决⑨)**

- 配对完成后**重启副机的 JS 端**使角色生效;**不是重启 APP**。
- 契约已在:`AppControlPort.resetRuntime`,终态观测 `SUCCESSOR_RUNTIME_STARTED`【源】。**不改端口契约**,补实现即可。
- 原生能力已在:两个 APP 的 `MainApplication.kt:19-20` 均有 `override val reactHost: ReactHost by lazy { ExpoReactHostFactory.getDefaultReactHost(...) }`,与 POC 调 `reload("manual-restart")` 是同一类型【源】。
- 缺的是**接线**:`assembly/android` 下只有 **4 个 `.kt`**(两个 APP 各 `MainActivity` + `MainApplication`;全仓 16 个)【源】,里面**没有 appControl 模块**;照现有四个 Expo 模块先例(Device/PersistKv/DualScreen/NativeLoading)新增一个,把 `resetRuntime` 接到 `reactHost.reload(...)`。
- ⚠️ **最小处置不是实现完整 `AppControlPort`**(Codex M-5):只补一个 assembly 自有的 `resetRuntime` 能力即可。但该能力的契约必须在详设里定死(D-9),至少包含:① 是否调用**唯一那个** `ReactHost.reload()`;② 重启前是否需先停宿主(主机侧需要、副机侧不需要,见上一条);③ 重启后如何 hydrate;④ **失败时 `masterLocator` / `instanceMode` / `displayRole` 是否回滚**(见 R-2 的配对状态边界);⑤ Activity 重建与进程重启的边界——本批只做前者,不碰后者。
- **主机侧重启前须先停宿主并等停稳**(条件性约束):POC 注释写明理由(`AppRestartManager.kt:120-124`【外部】)——"server 可能还处于 STOPPING 过渡态……容易出现端口占用、旧连接未清理"。**副机侧没有宿主在跑,此环不适用**——现由 R-4 的 `shouldRunTopologyHost` 要求 `instanceMode==='MASTER'` 佐证,不再是推断。
- **不抄 POC 两处**:① 跨进程请求/ACK 握手(POC 副屏是独立进程,TER 是同进程 Activity surface,`assembly/android` 下无 `android:process`)【源+检索】;② 热更进程重启分支(TER `hotUpdate` 端口绑 unavailable,暂无场景)。
- ⚠️ 同进程的代价:**TER 重启 JS 会同时重启主副两块 surface**。此前记为【推】,现已升为【源】:`adapter/android/dual-screen` 的 handler 类注释自陈"owns the secondary Presentation **without creating another React host, instance, process, or store**"(`TerminalDualScreenActivityHandler.kt:529-532`),README `:49-51` 亦写明"主屏与副屏共享同一个 React host/store";两个 APP 的 manifest **无任何 `android:process`**【检索:assembly/android 全量 xml】⇒ `reactHost.reload` 掀的是唯一那个共享 host。双机场景无影响(副机是另一台设备,且按〔适用范围裁定〕必为单屏);本地双屏机将来用这条能力时主屏会跟着重启,记入 `HANDOFF.md`。
- ⚠️ **双屏机上重启后副屏能否自行回来,本仓源码答不了**:副屏只在 `onDidCreateReactActivityDelegate` 内经 `ensureSecondarySurface` 创建(`:600-602`),且有 `launchRequested` 幂等闸(`:697-703`)——已创建则直接 return。若 `reload()` 不重建 Activity delegate,副屏是否随 RN 的 surface 重挂而恢复**取决于 `ReactHostImpl.reload()` 对已注册 surface 的处理,属仓外行为**,标 `UNVERIFIED`,详设须实测。⚠️ 这条**不影响本批**(副机单屏,`snapshot.secondaryDisplay == null`,`ensureSecondarySurface` 根本不执行),但要记入 `HANDOFF.md`。
- ⚠️ 重启后走 hydrate,**必须满足 §4.4b 启动校验**:用新鲜 `getDisplayInfo()` 重验持久化的 `VICE`,形态照 TR-11。
- ⚠️ **重启会重新订阅电源,播种一旦失效就会误切一次角色**:重启后 `subscribePowerStatus` 重新订阅,**首个事件是当前电源状态的快照而非跃迁**。`createPowerStatusBridge` 今天靠"首个事件只播种不派发"挡住它【源】。⇒ 本批必须保证该行为在重启路径上仍然成立(U-12),否则每次配对重启都可能顺带把 `displayRole` 翻一次。

### 3.3 传输与连接

**R-7 传输基座(裁决⑩)**

- 填进已有的 `kernel/base/transport` 空壳。`skeleton-graph.ts:27-32` 已把它钉为 batch 2 / `plannedKind:'owner'`,依赖恰为 contracts/platform-ports/state/runtime【源】。
- **消费 `contracts` 已有的配置契约**(`TransportServerConfig` / `TransportServerDefinition` / `TransportServerAddress` / `ResolveTransportServerConfigOptions`),**不得重新声明一套同形类型**。
- 能力要求(对标 POC `transport-runtime`,**全部为【外部】,不是本仓事实**):地址**有序故障转移**、重试轮次、**粘滞首选地址**、并发上限与限流、逐次尝试 metric;WS 侧 profile 注册/连接/收发/事件/`replaceServers`;重连节奏控制器须继承 POC 的 `connectionToken` 防"旧 connect 慢返回覆盖新决策"(避免幽灵连接)。
- **边界**:传输层**不解释业务 envelope 的成功/失败语义**(POC 设计意图注释,`httpRuntime.ts:22-26`【**外部**】)。
- 新包须自带 `fetch`/`WebSocket` 类型声明(§1.6)。
- ⚠️ **通用性本期赊账(裁决⑩)**:TER 今天没有任何活的网络消费方(`androidPlatform.ts:38-44` 把 `logUpload`/`hotUpdate`/`connector`/`appControl`/`script` 全绑 unavailable,只有 `device` 是实的)【源】,本期无法证明它不是拓扑专用。按通用形状建,**但不为"证明通用"制造第二个消费方**。
- ⚠️ **Codex S-7 提出本条属过度设计,作者部分不采纳,理由须记录**:Codex 指出多地址 failover、`replaceServers`、粘滞地址、通用限流在"一主一副一 IP"下没有真实消费者。**该事实为真,但结论与 Dexter 已有指示冲突**——Dexter 明确要求这个包"不是只为双机拓扑准备的,后续也会用来连接远端服务器,而且后续要支持多个 IP 切换、多个 workspace",裁决⑩ 亦已认下"本期无法证明通用性"这笔账。⇒ **按已有裁定保留通用形状,不按 S-7 收窄。**
- ⚠️ 但 Codex 的**成本提醒仍然有效,已上报 Dexter 复核**:若他改判为"本期收窄",则保留 bounded retry/backoff、取消 token、消息边界与 `connectionToken`,其余(多地址 failover、`replaceServers`、粘滞、通用限流)降为单 locator 的最小传输,**U-15 随之作废**。裁定前按上一条执行。

**R-8 拓扑运行时与主机侧宿主(裁决⑦隐含)**

- 新建拓扑 kernel 包(建议 `kernel/base/topology`),不得塞进 `transport`——`skeleton-graph` 里 transport 的声明依赖**没有 display-context**,而拓扑语义必然要用它。新增包须同步修订 `skeleton-graph.ts`。
- 拓扑只是 transport 之上的一个 socket profile,**不 fork 传输**(POC `protocol.ts` 全文 28 行【**外部**】)。
- **主机侧原生宿主在本批范围内**(裁决⑨的连带:没有它功能不存在)。`TopologyHostPort` 已声明四方法(`start`/`stop`/`getStatus`/`getDiagnosticsSnapshot`)与 `TopologyHostConfig`/`TopologyHostAddress` 类型【源】,**补 Android Kotlin 实现 + 起停驱动**。
- 宿主起停按"**推导 + 对账**"形态,由拓扑包的 actor 驱动;**管理台只表达意图,不拥有原生生命周期**。POC 的形态已逐行亲验(`hostLifecycleActor.ts:132-267`【外部】),TER 照此继承:
  - **期望态与实际态分开存**:`desiredRunning = shouldRunTopologyHost(context)` 先写入 host state,再与 `actualRunning` 比对;只有两者不一致才动原生。
  - **起的顺序**:`start()` → 拿 addressInfo → 派 `updateTopologyHostBinding`(用自己的 nodeId 写 `masterLocator`)→ 派 `startTopologyConnection` → 取 status/diagnostics 快照 → 置 `actualRunning:true`。停的顺序相反。
  - **全程串行**:`:85-96` 用一条 promise 链把所有生命周期同步排队,**并发的 sync 不交错**——这是必须继承的,否则 start/stop 竞态会留下"实际在跑但状态说没跑"。
  - **失败写 `lastError` 并抛**,不静默吞;端口缺失返回 `SKIPPED` + `topology-host-port-unavailable`,不当作成功。
  - **触发源是 fingerprint**:POC 对 `{instanceMode, displayMode, displayCount, displayIndex, enableSlave, standalone, masterLocator, connectionStatus}` 八项做 JSON 指纹(`createModule.ts:78-103`【**外部**】)。⚠️⚠️ **这八项 TER 不得照抄,须逐字段自证**(Codex 三轮 N-1):把 `connectionStatus` 放进宿主生命周期指纹,**短暂断连就会反复唤起该 actor**——若只是 no-op,该字段纯属冗余;**若真触发 start/stop,就把一次重连变成了服务重启**,与 D-17"不断重连"直接冲突。⇒ **必须继承的是 desired/actual 分离 + 串行排队 + 失败留痕**;**触发字段集由详设按 TER 自身 owner 重新论证**,每一项都要回答"它变化时宿主该不该起停"。
  - ⚠️ **副机侧另有一条自动重连路径**:`:28-53` 的 `createStandaloneSlaveAutoStartKey` 在"单机 SLAVE + 有 masterLocator + 当前 DISCONNECTED + key 变化"时自动派 `startTopologyConnection`,并记 `lastAutoStartKey` 防重复。⇒ **这正是副机重启后自动连回已存主机的机制**,与 D-17"不断重连"、N-2"已配对从何时起算"是同一组语义,须一并设计。
- **宿主必须按角色占位保证 1:1**:MASTER/SLAVE 各一个坑,同角色第二个 nodeId 连入即拒,错误可区分(照 POC `TopologyHostV3Runtime.kt:35-69` 的 `ROLE_OCCUPIED`)【**外部**】。**这是〔信任边界裁定〕"一个 master 只能匹配一个 slave"在主机侧的落点**,也是不做认证的前提——没有占位就没有任何东西限制第二台设备接入。
- 主机须提供**可被副机查询的身份端点**(R-3),且只暴露身份所需的最小信息。
- ⚠️ **必须在详设中冻结本仓自己的最小 wire contract**(Codex 一轮 M-4):本稿引用的 POC 宿主源码**在 v2s 仓外**(见 §0.2 的【外部】说明),**不能作为实现依据**。两个 APP 要互操作、U-7..U-20 要有真实验收对象,就必须先把线上协议写死在本仓。⇒ **八项内容与 owner 见 D-21**(二轮 S-5 指出原先没有任何 D 项逐项承接它,已单列)。

**R-9 `routeContext` 盖章(还 S-1 这笔账)**

- 实现 display-context 正本 §6 **S-1**:**每个 Root Surface 在其发出的所有命令上自动盖 `routeContext` 的 `displayMode` 与 `workspace`**。
- ⚠️ **`workspace` 不是顺手就能盖的(Codex M-3)**:`SurfaceContextValue` 只有 `displayMode`、`containerKey`、`surfaceForm`、`isHostPrimaryDisplay` 等,**没有 `workspace`**(`SurfaceContext.ts:5-14`)【源】;workspace 另在 `createCatalogContext.ts:23` 由 `resolveWorkspace({instanceMode, displayRole})` 派生【源】。⇒ 详设须明确 workspace 在盖章点的**来源与更新时机**,不得只盖 `displayMode` 就算实现了 S-1。
- 修复面横跨两个 base 包,且是**类型契约级**:
  - `ui/base/render/src/types/props.ts:32-39` —— `RenderDispatchOptions` 整个类型**只有 `requestId`**(且 NonNullable),从类型上就不允许传 routeContext【源】;
  - `ui/base/console-assembly/src/foundations/consoleAssembly.tsx:198-201` —— `createDispatchCommand` 只转发 `requestId`;`:578` 是 RenderProvider 那个 `dispatchCommand` 的**唯一产出点**(跨 console-assembly / dev-host / render 三处检索确认)【源+检索】。
- **已尝试证伪、未找到退路**:`RenderContextValue` 全部 13 个字段里唯一派发口就是那个窄化的 `dispatchCommand`,**无原始 `Runtime`**;`RenderSubscriptionContextValue` 只有 `{stateSource, snapshotReader}`;全 `render/contexts` 与 `render/hooks` 检索 `useRuntime|runtime:|Runtime` 为空【源+检索】。
- ⚠️ 影响面**不扩大到内容派发**:`contentActors.ts:223`、`variableActors.ts:122` 的 `routeContext: {workspace}` 是从 state 自算的分区键,传给 state 包的 `createWorkspaceActionDispatcher`,与 `CommandRouteContext` 同名不同物【源】。

**R-9a 命令目标路由(Codex M-1;与 R-9 同一道缝,合并实现)**

没有这条,R-11 的单写者与 §6"不做双向对账"都不成立。

- **内核侧机制已经齐备,不需要发明**:`CommandTarget = 'local' | 'peer'`(`command.ts:13`);`createCommandDispatcher.ts:499` 逐字 `const target = options.target ?? definition.defaultTarget`,`:562` 按 `target === 'peer'` 分流;派发选项本就带 `target?`(`command.ts:68,77`)【源】。⇒ **逐次覆盖的能力现成,缺的只是谁来决定、以及 UI 怎么传进去。**
- ⚠️ UI 侧的窄口与 R-9 相同:`RenderDispatchOptions` 只有 `requestId`(`props.ts:32-39`)、`dispatchWithRequestId.ts:13-16` 与 `createDispatchCommand`(`consoleAssembly.tsx:198-201`)均只转发 requestId【源】。
- ⚠️⚠️ **但策略不能放在 render 边界——作者初稿放错了层**(Codex 二轮 M-2,作者已回源码确认):**member-desk 的屏幕迁移全部由 actor 派发**,走 `createCommandActorDispatcher.ts:183-201` 的 `dispatchInternal`,**根本不经过 `RenderContext`**。只扩 render 边界会整片漏掉 actor 路径。⇒ **策略必须落在 UI 与 actor 共同汇入的 runtime dispatch 边界**。
- ⚠️⚠️ **`local` 与 `peer` 严格互斥,一次派发落不到两侧**:`createCommandDispatcher.ts:559-571` 逐字——`target==='local'` 才取本地 handlers,`target==='peer'` 时 `handlers` 置空、只走 `dispatchPeer`【源】。⇒ 凡"主副两侧都要变"的场景,**必须由上游拆成两次派发**,不得指望一次 fan-out;若详设选择 fan-out,则须一并定义 origin 标记、重复派发抑制、ledger 归属与**回环防护**。
- ⚠️ **判别依据是每次派发的 payload,不是命令身份**:`showScreenCommand` 在 `displayMode: primary` 时该 local、在 `secondary` 时该 peer(见 `member-desk/actors.ts:118-126` 同一流程内两者并存)【源】。⇒ 策略**不能写成"哪些命令走 peer"的静态名单**,必须按派发时的 payload/上下文求值(D-19)。
- **必须是集中式、拓扑感知的策略**(Codex 原话),**不得**:① 把 member command 的 `defaultTarget` 一律改 `peer`(会打坏主机自己的本地路径);② 让业务组件自己传 target(与 S-1 禁止业务组件传 routeContext 同理,漏一处就静默写错机器)。
- **方向是双向的,两侧都要定**:
  - **上行(slave → master)**:会员确认 / 拒绝 / 撤回等**意图类**命令,在本节点为 SLAVE 时路由到 peer;本节点为 MASTER 时保持 local。
  - **下行(master → slave)**:屏幕迁移类命令(`showScreen` / `openLayer` / `clearLayers`)——它们今天同样默认 local(Codex M-2 已核),**只同步状态不会让副机换屏**。该方向与 D-17 ④ 是同一个决定,不得分开定。
- 哪些命令进入策略、按什么维度判定(命令自身声明?模块声明?集中注册表?)由详设定(**D-19**)。

⚠️ **这条是 Codex 评审推翻作者结论后新增的需求**,原稿没有它,详见 §8.3 第 6 条。

### 3.4 跨机能力

**R-10 跨机命令(裁决⑦)**

- 实现 `PeerDispatchGateway` 并在拓扑模块 `install(context)` 时经 `installPeerDispatchGateway` 装上【源:`types/module.ts:70`】。
- 派发器已完整(四态生命周期、按 `definition.timeoutMs` 本地超时竞速、超时后迟到完成/迟到失败仍补发事件、资源清理)【源】,**不重写**。
- **`routeContext` 不上线**:`contracts/src/types/command.ts:1-5` 明文 "Local-only routing context. It must not cross a wire boundary before a dedicated serialization and compatibility review"【源】。网关在过线前剥离该字段。**有损:跨机命令不带路由上下文。**
- **两个 APP 都要跑通**(裁决⑦),⚠️ **范围限定在 laptop 单屏形态**(〔适用范围裁定〕)——是两个 APP 都跑通,不是所有机型都跑通。⇒ 详设须给出"跑通"的判据(D-6)。⚠️ 原文此处还要"角色矩阵",**已随 D-6 作废**(主机/副机是 base 能力,不存在每 APP 的角色选择);但验收须覆盖**同一个 APP 分别作主机与作副机**两种跑法。(Codex 二轮 S-1)

**R-11 状态同步**

- 沿用 TER 既有契约:方向声明在切片的 `syncIntent` 上,每切片单写者。**不重新设计模型**。
- **第一版只发全量,不做增量差分**。断线期间的变更**接受丢失**;重连后**各自把自己拥有的切片单向全量推给对端**(方向按 `syncIntent`)。
- ⚠️ `requestLedger` 是 TER 生产里唯一声明了跨机方向的切片(`requestLedger.ts:153-163` 按 mode 产出 `master-to-slave`/`slave-to-master`,经 `createInternalRuntimeModule.ts:62-64` 注册)【源】。⚠️ **作者原写"第一版不搬运它",现改为待定(D-18)**:〔等价性裁定〕之后发现副屏的 `canDecide` 依赖 in-flight 状态(见下表)。无论结论是搬还是不搬,**都必须显式标记**,不得留下一个"声明了方向却永远搬不动"的切片。

**第一版要同步的集合,由〔等价性裁定〕推导得出,不是选择题。** 对 `sample-terminal` 逐 part 亲验的结果:

| 切片 | 今天 | 副屏是否读 | 第一版 |
|---|---|---|---|
| `sample-member-registry` 的 members 切片 | `syncIntent: 'isolated'`(`slice.ts:39`)【源】 | **读 `pending`**(`CustomerMember.tsx:37` 的 `selectPendingMember`)【源】 | **改 `master-to-slave`** |
| `sample-staff-session` 的 session 切片 | `syncIntent: 'isolated'`(`slice.ts:36`)【源】 | **不读**(两个 SECONDARY part 均未引用)【源】 | **不同步** |
| `requestLedger` | 已声明方向、未生效 | **间接读**:`CustomerMember.tsx:48-50` 用 `useRequestInFlight` 算 `canDecide`,据此禁用确认/拒绝按钮与输入框(`:115,122,129`)【源】 | **待定(D-18)** |

- `sample-terminal` 的 SECONDARY part **恰好两个**:`customerWelcomePart`(`displayModes: secondary`)与 `customerMemberPart`(`displayModes: both`)【源:`member-desk/parts.ts:125-149`】。
- `CustomerWelcome.tsx` **读零状态**(纯静态文案 + DEV 布局日志)【源】⇒ 待机态不需要任何同步。
- ⚠️ 切片的 `syncIntent` 是**整片声明、不分字段**:开了 members 切片,`members` 数组也会一并下行,而副机从不显示它。第一版接受这点,不为此发明字段级同步。

⚠️⚠️ **单写者在今天的路由下并不成立——作者原先的论证是错的,已由 Codex 评审推翻并经作者回源码复核**:

- 作者原写:"顾客的确认/拒绝是派 command 不写 state,所以副机只上行意图、主机唯一写入"。**前半句为真,后半句是没验证的跳跃**。
- 亲验反例:`defineCommand.ts:33` 逐字 `defaultTarget: input.defaultTarget ?? 'local'`;`sample-member-registry/commands.ts:7-45` 的**八条 member command 无一设 `defaultTarget`**;`dispatchWithRequestId.ts:13-16` 只传 `{requestId}`【源】。⇒ **副机派 `confirmMemberCommand` 走的是 local,它自己的 `createConfirmMemberActor` 会写它自己的 members 切片**——双写者,§6"不做双向对账"的前提当场失效。
- ⇒ **本批必须建立命令的目标路由,否则 R-11 与 §6 都不成立。** 落点与形态见 R-9a。
- ⚠️ **不得用"把 member command 的 `defaultTarget` 一律改成 `peer`"来解决**:主机自己确认时也走同一条命令,改默认会把主机的本地路径一并打坏。逐次覆盖的机制**本来就有**(见 R-9a)。

修好路由之后,单写者的目标形态仍然是:**状态单向下行(master→slave)、意图上行走命令**;写 members 的地方集中在 `member-registry/actors.ts:40,61,75` 一处【源】,这一点不变。

⚠️ **光同步切片不会让副机换屏**:actor 只对 command 反应、不对 state 反应(TR-11),而驱动屏幕的 `registryMemberPendingCommand` 是在**主机**上派的。⇒ 屏幕迁移如何到达副机是独立问题,见 D-17。

### 3.5 失败路径与信任边界

**R-12 失败路径的期望行为**

| 情形 | 第一版行为 |
|---|---|
| IP 填错 / 连不上(**配对建立阶段**) | 控制页显示连接失败与原因,可重试;**不无限自动重试**——此时尚未配对,死循环重试只会掩盖"IP 敲错了" |
| ⚠️ **"已配对"从哪一刻起算**(Codex 二轮 N-2,**本稿未定,详设须定死**) | R-2 的写入顺序在**首次 WS 建连之前**就写了 `masterLocator`、`instanceMode`、`displayRole`(第 ④⑤⑥ 步),并在第 ⑦ 步重启。⇒ **若身份已确认、但重启后首次 WS 连接失败,这算"已配对"(走无限重连)还是"配对失败"(走有界重试)?** 该分界直接决定错误 IP、主机暂时不可用、以及用户解绑三条路径的行为,**不能靠实现方猜**。与 S-6 的 locator 回滚语义须一致 |
| 主机重启 / 掉线(**已配对之后**) | ⚠️ **不断重连**(Dexter 2026-09-17 裁定),**不设放弃条件**;副屏语义保持、不回落手持确认形态(D-17 ③);连上后双方各自按 R-11 单向全量推 |
| **主机那台没人打开 APP**(D-20 (a) 的已知后果) | ⚠️ 宿主随 APP 才起(终端是普通 APP、人工启停)⇒ **副机连不上、也重连不上**,表现为按上一行持续重试而不报错。**这是已接受的取舍,不是缺陷**;副机侧须能让用户看出"连不上主机"而非静默卡住(呈现形态归 D-1 的不可用原因)。⚠️ 不得为此加"放弃重连"的终止条件——与 D-17 冲突 |
| 第二台副机来连 | 主机拒绝(角色已占),副机侧显示"该主机已有副机" |
| 两机版本不一致 | **第一版不做版本协商**。有损:不一致时行为未定义,记入 `HANDOFF.md` |
| 同步冲突 | 每切片单写者 ⇒ 结构上不产生冲突 |
| 解除配对 | 控制页提供"断开并清除主机":清 `masterLocator` + 回 `MASTER`。⚠️ **顺序须先回 CHIEF 再切 MASTER**,理由见下方 ⚠️ |

⚠️ **实现 S-1 会制造一个今天不存在的解绑问题,必须一并处理**:

- **今天**(S-1 未实现,`routeContext` 恒空):`getSwitchInstanceModeEligibility` 对 `targetMode==='MASTER'` 的判据是 `routeDisplayMode === 'SECONDARY' ? 拒 : 放行`,空值 ⇒ **放行**,解绑没问题。
- **S-1 实现后**:副机处于 `SLAVE+VICE` ⇒ 其 surface 的 `displayMode` 为 `SECONDARY` ⇒ 从该副机控制页发出的 `switchInstanceMode(MASTER)` 会被盖上 `routeContext.displayMode==='SECONDARY'` ⇒ **被 `managed-secondary` 拒**。
- ⇒ 解绑必须**先 `switchDisplayRole(CHIEF)`**(该方向只要求 `instanceMode==='SLAVE'`,§4.4)使 surface 回到 PRIMARY,**再** `switchInstanceMode(MASTER)`。落点见 D-10。

**R-13 信任边界(〔信任边界裁定〕)**

> **同网段 + 知道主机 IP = 有权配对。第一版不做认证,也不做"配对授信确认"。**

⚠️ **术语澄清(Codex 二轮 S-4),两者不冲突,不得据此删掉 R-2 第 ③ 步**:

- 本条禁止的是**认证与授信握手**——没有凭据、没有"这台设备是否可信"的判断、没有任何东西需要用户授权对端接入。
- R-2 第 ③ 步与 R-3 的"取回主机身份并由用户确认/取消"是**另一件事**:它来自裁决③,用途是**让用户发现 IP 敲错了**,确认的是"我连的是不是我想连的那台",**不授予任何信任、不构成准入判断**。⇒ **正确命名是"主机身份确认(非认证、非授信)"**,实施方**不得**把它当作被禁止的配对确认而删除(删了 U-16 直接变红)。

- 裁定原文见 §0.3 末。⚠️ **不是裁决⑥**——⑥ 是受管副屏存储闸,与本条无关。
- 1:1 由**角色占位**天然保证。
- ⚠️ 实施约束:POC 的 `/fault-rules` 是**无鉴权的 POST/DELETE 变更端点**(`TopologyHostV3Server.kt:120-133`)【**外部**】——那是故障注入的测试装置,**TER 不照抄**。
- 认证按右尺寸标尺属生产化项,记入 `HANDOFF.md`。

**R-14 电源触发切换的确认步(裁决④)**

- 为 `displayRole` 的电源触发切换补一步 **UI 确认**。
- 这是**还既有欠账**,不是新增需求:display-context 正本 §4.5 已裁定"派发前有一步 UI 确认",而 TER 生产里 `powerStatusActor.ts:80` 是直接 `dispatchAction`,无确认步【源】。
- 形态已被正本规定死(§5):**确认动作自己也是一条 command(TR-11),呈现归 UI**。⇒ 不得做成回调或 effect 列表。
- 确认框用现成机制:`alert` 层 + `decisive` guard 的一个 part,照 member-desk 已有的三个确认组件。

**POC 有一套完整且真接线的先例,照抄形态即可,不要重新发明**(⚠️ **下列全部为【外部】,作者在 POC 仓逐行亲验,但从 v2s 仓根打不开,不得当作本仓事实或实现依据**;且已验证 `host-runtime-rn84/createApp.ts:243` 的 `modules` 数组里确有 `createTopologyRuntimeBridgeModule()`,**不是 `host-runtime` 那种无人引用的货架包**):

```
topology-runtime-v3/createModule.ts:105-140   电源监听
  :107-109  同值去重
  :110-123  首个事件只播种(记 power-display-switch-seeded 日志),不切
  :125-131  resolvePowerDisplaySwitchTarget 算目标,无目标则 return
  :132-139  派发 requestPowerDisplayModeSwitchConfirmation{displayMode, powerConnected, reason}
    → topology-runtime-bridge/createModule.ts:36-75   actor 监听,派 openOverlay
         confirmAction.commands = [closeOverlay, confirmPowerDisplayModeSwitch]
         cancelAction.commands  = [closeOverlay]
      → powerDisplaySwitchActor.ts:20-37   收确认 → 派 setDisplayMode
```

从中必须继承的三条:

- ⚠️ **确认时必须重新求值,不得信提问时那次**:`powerDisplaySwitchActor.ts:21-27`【**外部**】 收到确认后**重新 select 一遍**,`standalone !== true || instanceMode !== 'SLAVE'` 即返回 `{skipped:true, reason:'not-standalone-slave'}` 并**不切**。理由显然:弹窗到用户点确认之间状态可能已变。**这与 display-context 正本 §4.4a「每条路径各自实时求值,不得复用上次结果」是同一条要求**——POC 独立得出了相同结论。⇒ TER 的确认 actor 必须在**确认时**用新鲜 `getDisplayInfo()` 重验 §4.4a 共同前置,而不是弹窗时验一次就放行。判据见 U-11。
- **取消不记状态**:cancel 只关浮层,不写任何"已拒绝"标记 ⇒ 下次电源跃迁会**再问一次**。第一版照此,不做"不再提示"。
- **请求确认这条 command 声明 `allowNoActor: true`**(`commands/index.ts:13-15`):无人处理时静默放过而非报错,等于把确认步做成可插拔。TER 是否继承这个宽容度须在详设论证(D-15)——TER 若**不**设 `allowNoActor`,缺 UI 模块时会变成硬失败,反而更安全。

**自动确认应当继承**(POC 默认 `autoConfirmAfterMs: 3_000`,`topology-runtime-bridge/createModule.ts:30`;`DefaultAlert.tsx:57-74` 倒计时到点自动执行 `confirmAction`,并渲染"N 秒后自动确认"——**两处均为【外部】**):

⚠️ 作者一度把它写成"等于没有确认、与裁决④冲突",**这是错的,已由 Dexter 更正**:**副屏的电源变化只可能由用户亲手拿起/放下造成,人必在跟前**。因此这 3 秒不是"替用户做决定",而是**用户已用物理动作表达意图后给他的否决窗口**;取消按钮随时可按。所谓"无人值守"在本场景不成立。⇒ 详设默认继承此形态,只需定倒计时取值。

---

## 4. 方案与影响面

### 4.1 方案要点

**契约已对齐、运行时全缺**——分界干净:同步契约、传输配置契约、派生与资格、跨机命令派发器、浮层机制均已就位;传输、拓扑连接、原生宿主、网关实现、routeContext 盖章全缺。⇒ **不要重新设计契约,把预算压到运行时。**

### 4.2 预期改动面

| 包 | 改动 |
|---|---|
| `kernel/base/transport` | 填实(HTTP + WS 基座) |
| `kernel/base/topology`(新建) | 拓扑状态、命令、actor、socket profile、peer gateway、**跨机状态同步的搬运方**(R-11 的全量推;`state` 包只提供载荷与落地,不拥有过线) |
| `kernel/base/platform-ports` | **不新增副机侧拓扑端口**——副机是 WS 客户端、纯 JS,不需要原生能力;POC 侧同样没有客户端拓扑端口(它的 `platform-ports/topology.ts` 是 assembly 接线不是平台端口)。缺的是**类型环境**不是端口(§1.6)。`appControl.resetRuntime` 与 `topologyHost` 两处契约均**不改** |
| `ui/base/render` | **类型契约**:`RenderDispatchOptions` 加 `routeContext`(S-1)**与 target 相关字段**(R-9a)——两者卡在同一个窄口,一次性放开 |
| `ui/base/console-assembly` | `createDispatchCommand` 透传 routeContext 与 target;Root Surface 盖章。⚠️ **不承载目标路由策略**——策略须落在 UI 与 actor 共同汇入的 **runtime dispatch 边界**(二轮 M-2:屏幕迁移由 actor 派发,不经过本层);本行原写"承载集中式策略求值点",**已更正** |
| `kernel/base/runtime` | **目标路由策略的求值点**(R-9a / D-19):UI 与 actor 两条派发路径的共同汇入处;按每次派发的 payload/上下文判定 local 或 peer |
| `kernel/base/display-context` | **R-14 的确认步**:新增"请求确认"与"确认"两条 command + actor(形态照正本 §4.5 与 TR-11),`powerStatusActor` 从直接 `dispatchAction` 改为经确认;确认 actor 须在**确认时**重验 §4.4a。**R-2a 机型门**:若详设选"加构造入参"方案,则 `createDisplayContextModule` 签名与资格判据入参各加一项(**不得 import `ui-state`**,见 D-16)。**不改既有派生函数的语义** |
| `ui/base/admin-shell` | 新增拓扑 section(**laptop/mobile 两变体,照既有 section 模式**;tab 恒显示,闸在功能不在显隐——D-1)+ testId 分支;**确认框 part**(`alert` 层 + `decisive` guard,照 member-desk 现有三个确认组件);**README 定位修订** |
| `ui/feature/sample-member-desk` | ① 业务 part 的 `instanceModes` 放开(范围见 D-3);② **`hasSecondarySurface` 切到新的拓扑判据**(R-5a),12 个调用点全切 |
| `ui/feature/*` 其余、`ui/integration/*` | 业务 part 的 `instanceModes` 放开(范围见 D-3)。⚠️ **`sample-wallpaper-console/actors.ts:29` 与 `dev-host/testExpoApp.tsx:822` 继续用物理判据,不动** |
| `adapter/android`(新增) | appControl 原生模块(`resetRuntime` → `reactHost.reload`);topologyHost 原生实现(HTTP+WS 服务端) |
| `apps/terminal/skeleton-graph.ts` | 新增 `kernel.base.topology` 条目 |

---

## 5. 验收判据

| # | 判据 | 绕过方式(反例) |
|---|---|---|
| U-1 | **配对写入顺序**:先 `switchInstanceMode(SLAVE)` 后 `switchDisplayRole(VICE)`,终态 `instanceMode==='SLAVE' && displayRole==='VICE'`。red mutation:交换两步顺序,终态 `displayRole` 必须变成 `CHIEF`(被 `runtimeRoleChangedActor` 重置)而判据变红 | 只断言两条命令都被派发;只看命令结果不看最终 slice 值;用纯函数结果冒充端到端 |
| U-2 | **§4.4a 共同前置被真正执行**:`getDisplayInfo()` 返回 `succeeded + count===1` ⇒ 允许写 VICE;`count>1` / 非 `succeeded` / `count` 缺失或非整数或 `<1` ⇒ **拒且状态不变**。四条同时观察**端口调用、命令结果与最终 slice 值** | 只在电源 actor 加前置而 `switchDisplayRole` 直接写 VICE(既有 v1 required 已点名这种绕过);断言"命令被派发"而不看写入;把"测不出屏数"当成放行 |
| U-3 | **S-1 盖章生效**:从 PRIMARY surface 发起的 `switchDisplayRole(VICE)` 被允许;从 SECONDARY surface 发起的 `switchInstanceMode` **被拒**且状态不变;**`routeContext` 缺失时仍 typed reject**(既有行为不得放宽) | 让控制页自己传 routeContext(正本明令禁止,且漏一处即静默写错屏);为让配对通过而放宽准入;只测 PRIMARY 不测 SECONDARY 与缺失 |
| U-4 | **副机业务屏不空**:配对后(SLAVE+VICE、workspace=MAIN)`main` 容器解析出的 part 非空,且**两个 APP 各自都验**。red mutation:把业务 part 的 `instanceModes` 改回 `['MASTER']`,本判据必须变红。⚠️ **本判据只证"part 解析得出来",不证内容正确、不证屏幕会迁移**——那两件归 U-19,**不得拿 U-4 全绿冒充功能可用** | 只验 catalog 里有条目而不验容器真的解析出 part;只测一个 APP;用自造 part 做夹具(证明不了真实 part 集合);**把 U-4 当成副机功能的充分判据** |
| U-5 | **重启 JS 后角色仍生效**:跨两个 runtime 实例、共享持久存储 —— 单屏持久化 `VICE` → 重启仍单屏 ⇒ **保留 VICE**;重启时已是双屏 ⇒ **改回 CHIEF**;端口非 `succeeded` ⇒ **改回 CHIEF** 且留 typed 诊断(§4.4b 三条) | 只测"重启后仍是 VICE"这条正向(既有正本已点名:正向测试全绿也证明不了校验存在);同一 runtime 实例内伪造重启;不改变屏幕拓扑 |
| U-6 | **`resetRuntime` 真的重启 JS**:调用后产生 `SUCCESSOR_RUNTIME_STARTED` 终态观测,且新 runtime 实例可见配对前写入的持久化值 | 断言端口返回 `succeeded` 就收工;用 mock 端口冒充;不验持久化值是否跨过重启 |
| U-7 | **主机侧宿主真的起得来且能被连上**:`topologyHost.start()` 返回可用的 `wsUrl`/`httpBaseUrl`,`getStatus()` 报 running,**且副机确实经该地址建立连接并完成 hello**。⚠️ **宿主必须是经 `enableSlave` → 对账链路自行起来的**。⚠️⚠️ **"夹具不得直接调 `start()`"是禁令不是 oracle,单靠它无法证伪**(Codex 三轮 S-3):夹具照样可以先调 `start()` 再断言 running,即使生产链路完全断开也全绿。⇒ 必须冻结成**能力约束 + 因果红变异**:① 夹具**只能触发控制页/typed 拓扑能力**,**不得持有 `TopologyHostPort.start` 的引用**;② 起始状态必须是 **stopped 且无地址**;③ **摘掉生命周期 actor 后,宿主必须仍然 stopped 且拿不到地址**(这才是因果证明);④ 断言真实的 `start` 调用与 desired/actual 变迁来自 `enableSlave` 链路。red mutation:把绑定换回 `unavailableTopologyHostPort` ⇒ 变红;**摘掉对账 actor ⇒ 必须变红** | 只验端口返回 `succeeded` 不验真的能连上;用 `unavailableTopologyHostPort` 跑通(今天的启动门正是这样过的);拿同进程 fake 冒充真实宿主;**夹具直接 `start()` 绕过 `enableSlave` 链路**。⚠️ **本判据不声称修好了启动门**:`platformPortBindingsAreComplete` 只判绑定非空这一缺陷(§1.7 ①)**本批不修**,只是绑上真实现后它变成合法的绿 |
| U-8 | **跨机命令端到端**:副机派发 → 主机执行 → 回传 `CommandDispatchResult`;超时路径与迟到补发各一条;**两个 APP 都验** | 只验网关被安装;只验发出不验回传;用同进程 fake peer 冒充跨机 |
| U-9 | **1:1 占位**:第二台副机连入被拒,错误可区分(角色已占),且**主机侧既有副机不受影响** | 只断言连接失败;不验既有连接存活;不区分拒绝原因 |
| U-10 | **重连后全量补齐**:断开期间主机侧改动 → 重连 → 副机侧该切片值与主机一致。red mutation:去掉重连后的全量推,判据必须变红 | 不制造断线期间的改动;只验连接恢复;只验切片存在不验值一致 |
| U-11 | **电源确认步存在且是 command**:电源跃迁 ⇒ 弹出确认 ⇒ 用户确认后 `displayRole` 才改变;用户取消则**不变**。形态须是 command + actor(TR-11),不得是回调。⚠️ **必含"提问后、确认前状态已变"这一条**:弹窗期间使 §4.4a 前置不再成立(如屏数变 >1),用户随后点确认 ⇒ **必须拒且状态不变**。red mutation:把确认 actor 改成信任弹窗时的判定结果,本判据必须变红 | 只验 `displayRole` 变了(没有确认步也会变);把确认做成回调或 effect 列表;不测取消分支;**只测"弹窗时合法且确认时仍合法"这条顺风路径**(POC `powerDisplaySwitchActor.ts:21-27`【**外部**】正是为此才在确认时重新 select) |
| U-12 | **电源桥播种仍有效**:重启 JS 后重新订阅,首个电源事件**只播种不切换**(既有行为不得被本批破坏) | 不测重启后的首个事件;只测跃迁 |
| U-13 | **拓扑 section 在两个 APP 都出现**,且可见性声明与实际一致(`AC-5.6`——因 tab 恒可见,该子句现为恒真,重点转为"声明可见就真的渲染得出");两个 APP 各自的生产分区分母分别冻结。⚠️ **机型维度的期望行为不在本条**,归 U-18(mobile 下同样出现、但操作不可用) | 只测一个 APP;共用一份分区分母(两个 integration 分区集合不同);声明可见却渲染不出;**把机型限制做成本条的隐藏逻辑**(D-1 明令禁止) |
| U-14 | **`requestLedger` 的处置是显式的**:该切片声明了跨机方向,D-18 无论结论是搬还是不搬,都须有可判定的标记或文档化断言,不得静默。⚠️ 若 D-18 定为"要搬",本判据升级为"副屏的 in-flight 门控在双机下与单机双屏一致"(并入 U-19 对照) | 什么都不做就当作已处理;**拿本稿早先那句"第一版不搬运"当已决结论**(它已被〔等价性裁定〕推翻为待定) |
| U-15 | **传输基座的地址故障转移真的生效**:首地址不可用时自动切次地址并**粘滞**。⚠️ **`replaceServers` 的可观察结果本批不作强判据**(Codex 二轮 N-1):本批只有一个 master、一个 IP,没有第二地址消费者,"替换 server 后哪些连接/缓存/retry 状态必须变化"缺少真实场景可证。⇒ 详设须**显式标注该行为为「本批未验证」**,或给出明确的 contract vector;**不得让它以"已实现"的姿态留在包里** | 只配一个地址;只测成功路径;不验粘滞;**把 `replaceServers` 的存在当作它已被验证** |
| U-16 | **主机身份在连接前取回并可确认**(裁决③):输入 IP 后、建立 WS 连接**之前**,控制页展示从主机查得的身份;用户取消则**不写 `masterLocator`、不切角色**。red mutation:把身份查询挪到配对成功之后,本判据必须变红 | 配对成功后才显示身份(对"发现 IP 输错了"这个用途毫无帮助);只断言展示了某个字符串而不验它来自对端;不测取消分支 |
| U-17 | **`enableSlave` 默认关、可打开、且真的驱动宿主**(裁决⑤ + Dexter 2026-09-17 语义裁定):① 全新安装该值为**关**;② 经拓扑 tab 打开后持久化,重启 JS 后仍为开;③ ⚠️ **翻转该开关必须真的起停 Android web 服务**——开 ⇒ `topologyHost` 实际 running 且给出可连的 wsUrl/httpBaseUrl;关 ⇒ 实际 stopped;④ **重启 JS 后按持久化标记自动恢复**该起/该停的状态(D-20 (a));⑤ 在 **SLAVE** 节点上打开它**不得起服务**(`shouldRunTopologyHost` 要求 `instanceMode==='MASTER'`)。red mutation:把默认值改成开 ⇒ 变红;**把开关与宿主起停解耦(只写 state 不对账)⇒ 必须变红** | 只验开关能被写;不验默认值;不跨重启验持久化;**只验标记值不验宿主实际起停**(这样一个纯装饰的布尔也能全绿);不验 SLAVE 上不起服务;拿 `desiredRunning` 字段冒充 `actualRunning` |
| U-18 | **mobile 机型被拒在准入处、但 tab 照常显示**(〔适用范围裁定〕/ R-2a / D-1):`surfaceForm==='mobile'` 时,`switchDisplayRole(VICE)` **被拒且状态不变**、`enableSlave` 不可开;**同时拓扑 tab 必须照常出现**,其中各操作置灰并给出可读的不可用原因。`surfaceForm` 取不到时同样拒。red mutation:去掉机型判据 ⇒ 变红;把 tab 在 mobile 上隐藏 ⇒ **同样变红**(Dexter 已裁不得做显隐逻辑) | 只验 laptop 放行不验 mobile 被拒;用隐藏 tab 来"实现"不支持(裁定明令禁止);置灰但不给原因;不验 `surfaceForm` 缺失分支 |
| U-19 | **双机与单机双屏行为一致**(〔等价性裁定〕,`sample-terminal`):同一条会员登记流程(登录 → 建草稿 → 提交 → 顾客确认/拒绝 → 回列表),在**单机双屏**与**双机**两种部署下,副屏侧的页面迁移序列与主屏侧的浮层序列**逐步对照一致**。⚠️ **必须同时断言两侧的最终呈现**(Codex 二轮 M-2):每一步都要验**主机本地页面/浮层**与**副机页面**各自变成了什么,**不得只断言命令上带了 `target` 字段**——字段对了而某一侧没更新,正是本批最可能出现的失败。⚠️ 另须验**断线期间副屏不退化**(D-17):断开 WS 后再触发 `memberPending`,副机侧仍保持副屏形态、不落入手持确认。red mutation:保持 `hasSecondarySurface` 现语义(判本机物理屏数)⇒ 变红;把"在线"并入副屏语义判据 ⇒ 断线用例变红 | 只验副机能显示某个页面而不做两种部署的**逐步对照**;只测稳态不测迁移序列;拿"手持确认也能完成登记"冒充一致;只验 `pending` 到达而不验屏幕真的换了;**只断言 target 字段不断言两侧结果**;不测断线分支 |

| U-20 | **命令目标路由真的生效、单写者成立**(R-9a):副机上顾客点"确认" ⇒ 该命令以 `target:'peer'` 到达主机、**由主机写入 members**;**副机自己的 members 切片在该次操作中不被本地写入**,其新值只能来自 master→slave 同步。red mutation:去掉目标路由策略(回到今天的 `defaultTarget: 'local'`),副机会写自己的切片、两侧 store 分叉,本判据必须变红。另须验主机自己确认时**仍走 local**,未被策略误路由 | 只断言命令带了 `target:'peer'`;**只看主机侧写对了,不看副机侧有没有也写**(双写时主机侧同样是对的,这条最容易骗过去);用单 runtime 假 peer 冒充;不验主机本地路径未被影响 |
| U-21 | **解除配对的顺序真的成立**(R-12 / D-10):从副机控制页执行"断开并清除主机",终态须是 `instanceMode==='MASTER' && displayRole==='CHIEF' && masterLocator` 已清。⚠️ **必须覆盖 S-1 生效后的那条路径**:副机处于 `SLAVE+VICE` 时其 surface 为 SECONDARY,直接派 `switchInstanceMode(MASTER)` 会被 `managed-secondary` 拒 ⇒ 正确顺序是**先 `switchDisplayRole(CHIEF)` 再 `switchInstanceMode(MASTER)`**。red mutation:把两步顺序交换,本判据必须变红 | 只验 `masterLocator` 被清而不验角色终态;在 S-1 未生效的环境里测(那时顺序错也能过,恰好测不出);只测顺序对的那一条;不验解绑后宿主/连接是否随之停 |
| U-22 | **宿主不暴露无鉴权的变更端点**(R-13):对主机宿主枚举其对外路由,**不得存在任何无鉴权的 POST/DELETE/PUT 变更端点**;身份查询端点(R-3)只返回身份所需的最小字段。red mutation:照 POC 加一个 `/fault-rules` 式的无鉴权变更端点,本判据必须变红 | 只验身份端点可读而不枚举全部路由;把故障注入端点留在 release 产物里只靠"不会有人调"辩护;只验返回码不验字段集(身份端点多吐字段同样算失败) |

⚠️ **全表口径**:以上各条中的"两个 APP"一律指 **laptop 单屏形态**(〔适用范围裁定〕);mobile 形态的期望行为**不是"也要跑通",而是"tab 照常显示、但拓扑功能被拒并给出可读原因"**(D-1),由 U-18 单独规定。U-4、U-8、U-13 据此读。⚠️ 本句曾写作"被拒且 tab 不可见",与 D-1 矛盾,**已更正**(Codex 二轮 M-3)。

⚠️ 视觉类标 `UNVERIFIABLE_BY_MACHINE`,按仓内惯例由视觉证据承接:**laptop 与 mobile 下控制页都出现且未裁剪**,区别只在 mobile 下各操作呈**不可用态并带可读原因**(D-1)。⚠️ 本条先后错过两次——初稿写"两机型下均可见"(当时与〔适用范围裁定〕矛盾),继而改成"mobile 下不出现"(被 D-1 推翻);**现行口径以 D-1 为准:恒显示,不做显隐**。

⚠️⚠️ **U-7 至 U-20 目前没有可执行的载体(Codex 一轮 S-5)**:仓内 `tools/` 只有单机双屏与静态检查工具,**没有双机 topology runner**,`scripts/README.md:38-56` 也无该类受管入口。⇒ **本批必须把"双设备受管执行体"作为交付物之一**,否则这些判据没有真实验收对象,只能退化成单机夹具——而单机夹具恰好测不出本批的核心(跨机路由、行为一致)。

⚠️⚠️ **该执行体的边界必须一并冻结,否则最省事的实现就是作弊(Codex 二轮 S-5)**:**最省事但不合规的做法是单进程内起两个 runtime 冒充两台设备,或只测消息序列化**——那恰好绕开了本批要验的一切。详设须写死:① 两个 runtime 必须跨**真实进程/设备边界**,并给出如何排除单进程模拟;② HTTP/WS 服务端与客户端各自的 owner;③ 连接、重连、停止、cleanup 的可审计证据;④ 日志与 first failure 的采集方式。**判据不得接受"两个 runtime 在同一进程内"的证据。**

⚠️ **U-19 的"逐步对照"必须逐项列出对照维度**,不得只比最终页面或截图:主/副角色、当前 `partKey`、layer 栈、`members.pending`、request in-flight 状态、命令顺序,以及**断线与重连后允许存在的差异**(D-17"不断重连"意味着重连期间两侧会短暂不一致,该差异须被显式允许而不是被判失败)。

---

## 6. 明确不做

| 不做 | 理由 |
|---|---|
| ticket / session 机制 | 出厂 POC 自己就没有(§1.1);1:1 由角色占位保证 |
| 离线队列 / 重绑 / resume 栅栏 | 同上;重连全量推更便宜(R-11) |
| 增量差分 | 一主一副规模下全量够用;消费侧已在,将来加不返工 |
| v1 的双向 `updatedAt` 摘要对账 | 单写者模型下单向全量天然无冲突 |
| `routeContext` 跨机 | TER 契约明文禁止(R-10) |
| 认证 / 配对确认 | 〔信任边界裁定〕;记入 HANDOFF |
| 多副机 | 角色占位天然给出 `ROLE_OCCUPIED` |
| 受管副屏存储闸 | 裁决⑥"暂不做";属互斥的另一条拓扑 |
| 故障注入注册表 / demo 切片与命令 | POC 的测试装置与脚手架;v2 的 20 条拓扑命令里 8 条是 demo 专用 |
| 为"证明通用"接第二个传输消费方 | 裁决⑩;TER 今天没有任何活的网络消费方 |
| 版本协商 | 第一版不做,行为未定义记入 HANDOFF |
| 让业务组件自己传 `routeContext` | 正本明令禁止;漏一处即静默写错屏 |
| 把拓扑页做成 `ui/feature` | 裁决⑪;且 `AC-5.1` 禁止 admin-shell import feature 包 |
| 新建副屏根容器 | TER 用同一 `main` 容器 + `displayModes` 过滤,更简单(R-5) |
| 为 POC 的 `screenModes` 在 TER 新造字段 | 那一轴在 POC 里本就是死条目(§1.3 坑 1) |
| **mobile 机型的双机拓扑**(**功能**不做,**tab 照显**) | 〔适用范围裁定〕。且既有代码在**类型、校验器、错误文案三层**禁止 portrait 声明 SECONDARY(`terminalSurfaces.ts:19`、`:62-70`、`:35-38`)【源】,而副机进 VICE 必被推成 SECONDARY ⇒ **结构上不成立,不是配置疏漏**。⚠️ 不得为此放开 portrait 的 SECONDARY 声明。⚠️ **也不得把"不做"实现成隐藏 tab**——D-1 已裁 tab 恒显示,只告知不可用 |
| **laptop 单机双屏的双机拓扑** | 〔适用范围裁定〕;已由 display-context 正本 §4.6① 的"屏数 > 1 即拒"覆盖,本批不另造机制 |

---

## 7. 详设必须明确

- **D-1 拓扑 tab 的可用性呈现**(Dexter 2026-09-17 已裁,原"可见性规则"作废):**tab 恒显示,任何状态、任何机型都不隐藏**(含 mobile)。裁定理由是成本:**做一套 tab 显隐逻辑本身就是白费的工**。⇒ **不得实现任何 tab 显隐判断**。闸口全部下移到**功能可用性**:各项操作(输入 IP、配对、解绑、开 `enableSlave`)按条件置灰或拒绝,**并给出可读原因**(如"此机型不支持双机拓扑""本机为双屏设备")。详设只需定每个操作的可用条件与不可用文案。`AC-5.6` 因 tab 恒可见而恒真,不再是风险点。
- **D-2 主机身份**:字段(deviceId?nodeId?可读名?)、查询端点的路径与形状(主机侧宿主须提供,见 R-3)、连接前确认的交互、取不到时的呈现。⚠️ 该端点**无鉴权**(R-13),须确认只暴露身份所需的最小信息,不照抄 POC 的 `/stats` `/diagnostics` `/fault-rules`。
- **D-3 `instanceModes` 放开范围**:⚠️ **不再是"全放还是少放"的选择题**——〔等价性裁定〕已定为"单机双屏下副屏显示什么,副机就显示什么",即**声明了 SECONDARY 的 part**(`sample-terminal` 下恰好 `customerWelcomePart` 与 `customerMemberPart` 两个)。详设只需落实:是逐个 part 加 `SLAVE`,还是给这批 part 统一一个常量;以及 PRIMARY-only 的 part **是否也要加**(加了不会显示,但会让白名单失去表达力)。
- **D-4 固定端口取值**:裁决②"只输入 IP"要求端口是常量;HTTP 与 WS 是否同端口(POC 同端口不同路径)。
- **D-5 S-1 的盖章实现形态**:`RenderDispatchOptions` 加哪些字段;Root Surface 在哪一层盖;既有调用点如何迁移;`routeContext` 缺失时的 typed reject 行为不得改变。
- **D-6 "两个 APP 都跑通"的判据**(Dexter 2026-09-17 已裁,原"角色矩阵"部分作废):⚠️ **不存在"每个 APP 各自选角色"这回事**——裁定原文"**本身能当主机又能当副机是 base 的能力**"。⇒ 两个 APP(`sample-terminal` 与 `sample-wallpaper-terminal`)**都自动同时具备主机与副机能力**,这是 base 提供的,不是装配层配置项。作者原先把它写成待定矩阵,是**凭空造出的伪问题**,已废。
  - 剩下要定的只有"跑通"的判据本身:是"能配上",还是"能同步 + 能跨机下命令并拿回结果"。⚠️ 范围仍限 laptop 单屏形态(〔适用范围裁定〕)。
  - ⇒ 由于角色是 base 能力,验收须覆盖**同一个 APP 分别作主机与作副机**两种跑法,不得只验一个方向。
- **D-7 拓扑包的边界与 `skeleton-graph` 条目**:包名、依赖边(必含 display-context)、与 transport 的分工;**并明确线上协议契约(D-21)由哪个包拥有**——它同时被 JS 客户端与原生宿主消费,owner 不定就会两边各写一份而漂移。
- **D-8 原生宿主的实现形态**:Kotlin HTTP+WS 服务端的最小形态;`TopologyHostConfig` 的端口/basePath/心跳取值;是否照 POC 做成**前台服务 + 常驻通知**(`TopologyHostV3Service.kt:48-52,120-135`【外部】——收银终端上不做前台服务很可能被系统回收,但通知文案与图标需产品确认)。⚠️ 原文还问"起停由哪个 actor 驱动",**该问题已由 R-8 答定**(拓扑包的生命周期 actor,desired/actual 对账,fingerprint 触发),不再是待定项。
- **D-9 `resetRuntime` 的原生实现**:Expo 模块形态;与 `reactHost.reload` 的对接;主机侧"先停宿主再重启"的条件判定落点。
- **D-10 解除配对的顺序**:回 MASTER 的准入(`routeContext.displayMode==='SECONDARY'` 时 `targetMode==='MASTER'` 会被拒)如何满足;是否需先回 CHIEF。
- **D-11 传输基座的交付顺序**:`skeleton-graph` 已把 transport 定为 batch 2,拓扑依赖它,故传输先行。⚠️ **"拆成几批"不是决策点**(Dexter 2026-09-17:"不管你拆成几批,都是要按顺序按整体目标完成交付")⇒ 详设只需给出**依赖顺序**,不必论证批次边界,也不得以"分批"为由缩减整体目标。
- **D-12 admin-shell 定位修订的具体文字**:README 三处只读表述与 part 描述如何改写(见 §8)。
- **D-13 视觉证据**:⚠️ **不再有"可见性判定"可证**(D-1:tab 恒显示、不做显隐)。本条改为定**不可用态的呈现证据**:laptop 正常态、mobile 不可用态(操作置灰 + 可读原因)、以及未配对/已配对两态,各自的取证方式与产物落点。
- **D-14 同步集合的落实**(R-11):〔等价性裁定〕已把集合钉死为"副屏 part 实读的切片",**不再是选择题**。详设只需落实:members 切片改 `master-to-slave` 的具体写法、重连后单向全量推的触发点、以及"整片同步会带上 `members` 数组"是否需在文档标注。
- **D-15 R-14 确认步的交互形态**:两条 command 的命名与 payload(POC 用 `requestPowerDisplayModeSwitchConfirmation` / `confirmPowerDisplayModeSwitch`,payload 见 `commands/index.ts:9-18`);确认框 part 的 partKey 与落点;是否继承 `allowNoActor: true` 的宽容度(不继承则缺 UI 模块时硬失败,更安全)。**自动确认默认继承 POC 形态**(理由见 R-14:电源变化必由用户亲手拿起/放下触发,倒计时是否决窗口而非代替确认),详设只需定倒计时取值与文案。
- **D-16 机型准入门的落点与类型归属**(R-2a):`surfaceForm` 从哪条路径到达准入判据。⚠️ **硬约束:不得让 `display-context` 依赖 `ui-state`**(会反转 `skeleton-graph.ts:44-55` 的既有边并成环)。
  - **Codex S-3 给出的最小方向,作者认同,建议作为默认案**:把**纯 `SurfaceForm` 类型**归到 `display-context` 或 `contracts`,由 `display-context` 暴露一个**纯 eligibility 函数**(与既有两个资格函数同形、只吃入参不读 state);**在线 peer 状态则归新建的拓扑包**。⚠️ **不得复制 union 类型**,也**不得让准入门、tab 可用性、`enableSlave` 三处各自判一遍 mobile/单屏**——三处必须调同一个纯函数,否则口径必然漂移。
  - 备选(须论证为何更优):给 `createDisplayContextModule` 加构造入参(照 `createUiStateModule.ts:51,79,82` 先例);或把门整个放进拓扑包(它可同时依赖两边)。
  - ⚠️ 注意 `SurfaceContextValue` **已经带 `surfaceForm`**(`SurfaceContext.ts:9`)【源】,UI 侧本就取得到;真正取不到的是 **kernel 准入侧**。不要用"UI 能拿到"论证 kernel 也能拿到。
  - ⚠️⚠️ **该纯函数的输入与输出必须一并写死,否则 M-1 会换个地方复发**。输入至少五项,**其中后两项必须彼此独立、不得合成一个布尔**:① `surfaceForm`;② 物理屏数;③ 本机角色(MASTER / SLAVE / 未配对);④ **peer 是否已建立拓扑(已配对)**;⑤ **peer 当前是否可达**。输出至少三项:**(a)** 准入是否允许;**(b)** 副屏语义是否存在(**只由 ①②③④ 决定,不看 ⑤**——这是断线不降级的支点,见 R-5a);**(c)** **不可用原因**(D-1 要求 tab 内给出可读文案,原因必须由本函数产出,不得让 UI 自己拼)。
  - ⚠️ 三个消费方(准入门、`enableSlave` 可用性、tab 内置灰与文案)**只能读本函数的输出**,**不得各自重新组合布尔条件**——重组就是口径漂移的入口。
  - ⚠️⚠️ **但"一个纯函数"缺了操作维度,原样落地会自相矛盾**(Codex 三轮 S-4):**配对、解绑、开启服务不是同一个操作**——未配对时"配对"可用而"解绑"不可用;已配对时反过来;已配对但 peer 掉线时副屏语义仍在、而"立即下发命令"可能不可用。⇒ 没有 `operation` 维度,三个消费方拿不到各自正确的 `allowed/reasonCode`;而让它们自己叠 `paired`/`reachable` 又正好违反上一条。**详设必须二选一并写死**:**(甲)** 函数接收 `operation` 并返回操作级结果;**(乙)** 函数只输出公共事实,由**一个指名的 owner** 统一算出操作级结果。**不接受只保留"共用一个纯函数"这句话。**
  - ✅ **POC 有现成原型,照抄形态即可**(`topology-runtime-v3/src/foundations/eligibility.ts` 全文 87 行【外部】):统一返回 `{allowed, reasonCode}`;**allowed 为 true 时也带 reasonCode**(`:73`),所以 UI 永远不必自己拼文案;`isTopologyV3ManagedSecondary` 等共享谓词被四个 eligibility 函数复用,**没有任何消费方自行重组布尔**;`AdminTopologySection.tsx:141-149` 则把多个 eligibility 的 reasonCode 按优先级收敛成一个 `primaryReasonCode` 供展示。
  - ⚠️ **注意 POC 把两件事拆成了两个函数,TER 不要合并**(两处均为【**外部**】):`getTopologyV3EnableSlaveEligibility`(`:58-74`)判的是"**谁可以拨这个开关**";`hostLifecycleActor.ts:19-26` 的 `shouldRunTopologyHost` 判的是"**宿主该不该跑**"。前者是 UI 可用性,后者是运行时对账,条件集不同、变化时机也不同。
- **D-17 拓扑副屏判据的新增形态与屏幕迁移的到达路径**(R-5a):① 新判据叫什么、住哪个包、签名如何——⚠️ **其语义是"本机双屏 ∨(本节点为 MASTER 且已配对 SLAVE)",不含"在线"**(二轮 M-1:把可达性并进来会与 D-17 第三项的"断线不降级"直接打架;可达性是另一个正交概念,只影响能否派发,见 R-5a)——⚠️ **既有 `resolveSecondarySurfaceAvailable` 的物理语义必须原样保留**,它另有 wallpaper-console 与 dev-host 两个生产调用方和四个测试文件在依赖;② 只把 `member-desk` 的 `hasSecondarySurface` 切到新判据,切换时 12 个调用点**全切,不得只切一部分**(半切会造成同一流程内前后判据不一致);③ **掉线时不退化,持续重连**(Dexter 2026-09-17 裁定原文"不断重连"):副机掉线**不回落到手持确认形态**,副屏语义保持,系统持续尝试重连直至恢复或用户主动解绑;"确认进行到一半掉线"同样按此处理,重连后由 R-11 的单向全量推补齐。⚠️ 详设须定重连节奏(退避上限)与**重连期间副屏呈现什么**(保持当前页?加一条连接状态提示?),但**不得设"放弃重连"的终止条件**。⚠️ 与 R-12"IP 填错不无限重试"不矛盾:那条管**配对建立阶段**,本条管**已配对后掉线**,两种语义须分别实现;④ **屏幕迁移怎么到达副机**——是主机的 `showScreenCommand` 跨机下发(R-10),还是副机本地由 state 变化桥成 command(须符合 TR-11,不得做成 effect 列表)。两条路的失败语义不同,须论证后择一。
- **D-18 `requestLedger` 是否必须跨机**(R-11):`CustomerMember` 的 `canDecide` 依赖 `useRequestInFlight`(`:48-50`),据此禁用确认/拒绝按钮与输入框。单机双屏下同 store 天然一致;双机下取决于**跨机派发器如何在副机本地落 ledger 条目**。⚠️ Codex S-2 已静态核出:`createCommandPeerDispatcher.ts:71-122` 先在本地产生 peer actor running、再收终态,`createLifecycleEmitter.ts:450-460` 把生命周期交给 ledger writer ⇒ **静态看副机本地即可形成完整四态,`requestLedger` 大概率不必跨机**。但该结论**以 R-9a 的 peer 路由真正生效为前提**,须用 focused 夹具证明:副机发起 peer command、本地 ledger 四态完整、`useRequestInFlight` 正确阻塞与释放、且 ledger 未被重复镜像。
- **D-19 命令目标路由策略的形态**(R-9a,已按 Codex 二轮 M-2 修正):
  - **求值层**:必须落在 **UI 与 actor 共同汇入的 runtime dispatch 边界**——`member-desk` 的屏幕迁移全由 actor 经 `createCommandActorDispatcher.ts:183-201` 派发,**只扩 render 边界必然漏掉它们**。
  - **判别依据是每次派发的 payload/上下文,不是命令身份的静态名单**:`showScreenCommand` 在 `primary` 时该 local、`secondary` 时该 peer,同一流程内两者并存(`member-desk/actors.ts:118-126`)。
  - **两侧都要变的场景如何表达**:`local`/`peer` 严格互斥(`createCommandDispatcher.ts:559-571`),一次派发落不到两侧。⇒ 二选一并写死:**上游拆成两次派发**(推荐,语义最简),或 **fan-out**——后者必须一并定义 origin 标记、重复派发抑制、ledger 归属与**回环防护**。
  - **主机本地路径必须保持 local**,以及策略对既有 `defaultTarget: 'local'` 的四条 runtime 命令(`setRuntimeInstanceMode`、`runtimeInstanceModeChanged`、`initialize`、`cleanupRequestLedger`)**不得产生影响**。
  - ⚠️ 路由判定用的是 **peer 可达性**,与 R-5a 的"拓扑副屏语义是否存在"**是两个正交概念,不得共用一个布尔**(见 R-5a)。
- **D-20 "重启后按标记启动 web 服务"取哪一种 —— 已裁定为 (a)**(R-4;Dexter 2026-09-17 补充前提后收口):裁定原文是"开启后会启动 Android 端的 web 服务,即使机器重启了,也会根据这个标记启动的 web 服务"。当时未声明的前提现已明确:**终端目前只是普通 APP,需人工启停,系统不自动拉起**。两条候选:
  - **(a) APP 启动后恢复**(POC 现状,本批几乎零额外成本):设备重启 → **用户或系统启动 APP** → JS 水合 `enableSlave` → 对账 → `topologyHost.start()`。服务是**前台服务**,起来后活得住(`TopologyHostV3Service.kt:48-52`【**外部**】)。⚠️ **但没人打开 APP 时,服务不会自己起来**——POC 全仓无 `BOOT_COMPLETED`/`BootReceiver`【检索】。
  - **(b) 设备开机即起,不依赖有人打开 APP**(POC **没有**,本批净新增):需要 `RECEIVE_BOOT_COMPLETED` 权限 + BootReceiver + 在无 JS 运行时也能读取该标记的原生侧持久化(今天该标记只存在 JS 的持久化里),外加厂商 ROM 自启白名单与电池策略的现实问题——**收银终端上这一类往往需要逐机型配置,不是纯代码能保证的**。
  - ⚠️⚠️ **真正的岔口不是"选 a 还是 b",而是一条本稿从未声明的前提**(Codex 三轮 M-1):**收银终端开机后,APP 是否由系统/桌面/厂商定制自动拉起?**
    - **该前提为真** ⇒ (a) 的弱实现**足以满足裁定的业务目标**(设备重启 → 系统拉起 APP → JS 水合 → 服务恢复)。但**必须把"APP 由系统自动启动"写成外部前置条件并标明本批不保证它**,同时把 R-4 的措辞从"设备重启后自动启动服务"改为"**APP/JS 启动后按标记恢复服务**"——否则文字承诺大于实际能力。
    - **该前提为假** ⇒ (a) **不满足**裁定原意(会出现"设备开着、服务没起、副机连不上、且没人知道"),必须走 (b)。
  - ✅ **结论:取 (a)**。理由不只是成本——**(b) 与当前产品形态自相矛盾**:web 服务活在 APP 进程内,而 APP 本身就需人工启停;要求"设备开机、无人开 APP、服务却在跑"等于另造一个脱离 APP 的常驻组件,超出本批范围。
  - ⇒ 裁定在此前提下的**准确含义是"开关要持久化,重启后再开 APP 时不必重新拨一遍"**,不是"无人开 APP 服务也自行运行"。R-4 措辞已据此改准。
  - ⚠️ **随之必须接受并明写的运营后果**(不是缺陷,是取舍):**主机那台没人打开 APP 时,副机连不上、也重连不上**;在 D-17"不断重连"语义下,表现为副机持续重试而不报错。⇒ 已记入 R-12 失败路径;若将来产品要求"无人值守也能配对",再单独立项做 (b),届时须承认厂商 ROM 自启白名单属于代码闭合不了的风险。
- **D-21 线上协议契约(wire contract)**(R-8;Codex 一轮 M-4 + 二轮 S-5 的落点):⚠️ **这是"两个 APP 能互操作"的唯一保证,必须单列冻结,不得散在 R-8 正文或分摊进 D-7/D-8/D-11**。须逐项写死:① hello 与身份;② 角色占位与 `ROLE_OCCUPIED`;③ 命令请求/结果与四态生命周期;④ 全量 state sync 的载荷形状;⑤ 心跳、断线、重连(配合 D-17"不断重连"与 R-9a 的可达性判定);⑥ 最大消息大小、超时与取消;⑦ **`routeContext` 过线前剥离**的规则(R-10);⑧ server start/stop 与资源释放(配合 R-8 的 desired/actual 对账)。⚠️ **不得引 POC 的实现当契约**——POC 源码在 v2s 仓外(§0.2【外部】),本仓必须有自己的一份可读契约,否则 U-7..U-22 没有真实验收对象。

⚠️⚠️ **仅有上述八类分类还不可执行,必须补到字段级**(Codex 三轮 S-2):
- **命令信封的字段约束**:`requestId`、`commandId`、`parentCommandId` 的存在性与关系,以及**错误如何序列化**(两端对 `CommandDispatchResult` 的错误字段解释不一致,就会出现"都连上了但结果读不懂")。
- ⚠️ **接收侧的归一化规则——这是回环风险**:发送方以 `target:'peer'` 过线,**接收方必须把它归一为本地执行**,不得再次按 peer 分流,否则两端互相转发成环。须显式写死。
- **HTTP 身份端点**的 method、path、成功/失败响应形状与**最小字段集**;并明确它归 D-2 还是本条。
- **消息类型判别**:类型字段如何取、**缺字段与未知类型如何处理**(丢弃?报错?),两端必须同解。
- **state sync 载荷**:切片名、方向、完整字段集(与 R-11 的集合一致)。

---

## 8. 授权边界、已定裁决与本批修订的既有正本

需求分析,**不是实施授权**。作者会话只做静态核验,未修改任何源码(本文件及其讨论稿前身除外);未运行任何构建、测试或设备命令。

### 8.1 本批修订的既有正本(必须同批改)

⚠️ **只改本稿等于在仓里留一组互相矛盾的权威文件。**

| 正本 | 位置 | 修订内容 |
|---|---|---|
| `apps/terminal/ui/base/admin-shell/README.md` | `:3-4` "本包承载终端本地、**只读**的 admin console shell……**不拥有业务 feature、不写业务数据**" | 拓扑控制页要派命令改 instanceMode/displayRole、要写 masterLocator,**同时撞上"只读"与"不写业务数据"两条** |
| 同上 | `:10` "登录和**只读 section** 的呈现" | 同上 |
| 同上 | `:24` "迭代时先扩展既有 owner API 或契约……**不得引入业务 feature import**" | 须说明拓扑 section 的依赖边如何合规(依赖拓扑 kernel 包,不 import feature) |
| `admin-shell/src/parts/parts.ts:41` | part 描述"终端本地**只读**诊断外壳" | 同上 |
| admin console 需求正本 `AC-6.1` | "admin-shell 自带 kernel/base 的界面。**本期全部只读**" | 本批即 `:51` 所说的"写能力立项"。⚠️ 其前置 **admin console 正本的 D-5**(**不是本稿 §7 的 D-5**,同名不同物)**已解决**:门禁改用物理事实后锁死链前提消失(正本 `:68-70`),本稿 §1.5 末行亲验 `AdminLauncher` 由 `consoleAssembly.tsx:603` 无条件挂载、`isHostPrimaryDisplay` 取 `displayIndex === 0` |

### 8.2 本批要还的既有欠账

| 欠账 | 正本 | 本批的关系 |
|---|---|---|
| **S-1** 🔴 Root Surface 自动盖 `routeContext` | display-context §6 | 配对准入直接依赖它;本批必须实现(R-9) |
| **T-1** 🔴 "已激活主机不得切 SLAVE"因 `transport` 零声明而推迟 | display-context §7 | 本批建 transport ⇒ **具备还账条件**;是否本批还由详设定 |
| **§4.5 确认步** 已裁定未实现 | display-context §4.5 | 裁决④ 即还此账(R-14) |

### 8.3 作者在本稿形成过程中的错误(供实施方避坑)

`routeContext` 这条链我**连续错了三次**,每次都是少读一层正本。记录在此,是为了让实施方不要沿着前两版的错误方向做:

1. 先误判为"解绑会被拒"——实际被拒的是**配对**(`targetMode==='MASTER'` 在 routeContext 为空时是放行的)。
2. 再误判为"UI 层掐掉了 routeContext,要改派发契约让控制页自己填"——**方向错**:正本明令**不得让业务组件自己传**。
3. 最终正确表述:**S-1 这条标 🔴 的跨包接缝从未实现,而 §4.4 准入直接依赖它**;当前的拒绝是 §8 v1 required 明确要求的 typed reject,是**正确行为**;修法是实现 S-1,**不是放宽准入**。

**另外两条(R-5a 相关,同样是少查一层):**

4. ⚠️ **R-5a 初稿写"就地改 `resolveSecondarySurfaceAvailable` 的语义"——错,且危险**。我当时只看了 member-desk 一个调用方。全域调用面亲验后发现它还有 `sample-wallpaper-console/actors.ts:29` 与 `dev-host/testExpoApp.tsx:822` 两个生产调用方、四个测试文件钉着物理语义,**且 R-S1 正本的"就绪按物理表面判定"也压在同一个函数上**。⇒ **实施方不得就地改它**,正确做法是新增拓扑判据、只切 member-desk(见 R-5a 与 D-17)。
5. ⚠️ **"只放开 `instanceModes` 白名单就够了"——不够**。part 能否解析与"谁把它推上屏"是两件事:前者是 catalog 三轴过滤,后者是 `hasSecondarySurface` 分支。只做前者的话,part 解析得出来却没有任何 actor 把它推上副屏(见 R-5 与 R-5a)。
6. ⚠️⚠️ **"顾客确认是派 command,所以副机只上行意图、主机唯一写入"——错,这是本稿被推翻得最狠的一条**(Codex **一轮** M-1,作者已回源码复核确认)。我验到"派的是 command"(真)就直接跳到"所以它会过到主机"(**从未验证**),**全程没看过命令的 target**。实际 `defaultTarget` 默认 `local`、八条 member command 无一覆盖 ⇒ 副机会写自己的切片,双写者,§6"不做双向对账"的前提当场失效。修法是新增 R-9a,**不是**把 `defaultTarget` 改成 `peer`。⇒ **给实施方的教训:凡涉及"这条命令会在哪台机器上执行",必须打开 target 解析路径亲验,不能从"它是一条 command"推断。**
7. ⚠️ **把"已配对**并在线**的副机"写进副屏语义判据——与 D-17「断线不降级」自相矛盾**(Codex **二轮** M-1)。两条需求**各自都对,拼在一起才错**:副机一掉线,谓词转 false,下一个 `memberPending` 就落回手持确认。⇒ **教训:新增一条需求后,要回头检查它与既有需求的"可组合性",而不只是检查它自身是否成立。** 修法是把"拓扑语义存在"与"peer 当前可达"拆成两个正交概念(R-5a)。
8. ⚠️ **把命令路由策略放在 render 边界——选错了层**(Codex **二轮** M-2)。`member-desk` 的屏幕迁移全部由 actor 派发,根本不经过 `RenderContext`。⇒ **教训:确定"某类命令都会经过哪里"之前,先枚举它的实际派发方,不要只看 UI 那一条。**
9. ⚠️ **方法错误,代价是二轮 M-3 与 S-1 漏网**:我做完 D-1 反转后跑了一次"残留扫查",搜的是 `显不显示|待定标注|不出现|隐藏`,**偏偏没搜「不可见」和「角色矩阵」**,然后据此宣布"真残留为 0"。⇒ **教训:自选关键词的 grep 只能证明"搜到的存在",不能证明"没搜到的不存在"。** 推翻一条既有说法后,应改为**正面枚举该说法可能的所有表述**,或直接重读受影响章节,**不得用一次关键词扫查下"已清干净"的结论**。

### 8.4 未验事项

1. POC 的 `connectionActor` 与各 slice 未读,本稿未对其下结论。(`powerDisplaySwitchActor`、`topology-runtime-bridge` 全套与 `DefaultAlert` 已读毕并验证接线,结论落在 R-14——**均为【外部】**。)
2. v2 的 `fetchHttpTransport` / `httpEndpoint` / `socketProfile` 未读;§3.3 的能力清单来自 runtime 与 types。
3. **一切运行时行为均未验证**;本稿无任何结论依赖运行结果。
4. **工作量全部未估**——属 Codex 的实施视角。
5. 装配层类型环境未核(`assembly-base-android/config/global` 未读),§1.6 的类型环境结论只对继承 `tsconfig.base.json` 的 kernel 包成立。
6. 客户端侧"RN 自带 HTTP/WS 故原生无需新增"为【推】,未核 RN 全局是否到达 TER 包。

### 8.5 授权边界

本稿不授权详设或实施,不推进任何 Roadmap step,不替代 Codex 的实施可行性评审。§7 的 D-1..D-21 须在详设中逐条明确;§8.1 的修订面须与本批同批交付。

# TER 双机拓扑需求讨论分析稿(主机主屏 + 副机主副屏切换)

- 作者:Claude
- 日期:2026-09-17
- 版本:**v3**(经四个独立盲审全部 NO-GO 后重写)
- 状态:**讨论稿**,不构成实施授权
- 取向:**不过度设计,接受有限有损**(Dexter 2026-09-17 指令)

## 0. 这一版改了什么

v2 经四维度独立盲审:POC 事实 3M/2S/5N、TER 现状 1M/4S/3N、推理与方案 2M/5S/3N、裁决忠实度 3M/5S/3N,**全部 NO-GO**。下列 13 条错误已由我逐条重新打开源码亲验确认,本版已更正。

| # | v2 的错误 | 实际 |
|---|---|---|
| 1 | 把 ticket/session/relay 说成 v2 的配对与补发机制 | `host-runtime` 包**全仓无人 import**(只命中自身 package.json 与 vitest.config),是未接线的货架包 |
| 2 | 双屏机与双机是互斥的两条拓扑 | **反了**。`resolveTopologyLaunch.ts:20-24` 注释原文:"主副屏都必须通过真实 loopback topology host 通讯";`:43-70` 双屏主屏起宿主、副屏拿 `role:'slave'` |
| 3 | v1 断线即静默丢弃、无补救 | v1 **有重连对账**:`instanceInterconnection.ts:61-73`、`:92-102` 交换 `updatedAt` 摘要,`:114-172` 按 LWW 算差异补推 |
| 4 | 管理台"没有注入点",构成唯一阻塞项 | **没有这个阻塞**。`AdminLayer.tsx:26,38-42` 与 `AdminLauncher.tsx:74,98-100` 生产代码已在用 `useDispatchCommand()` 派真命令;`AdminSectionContent.tsx:14` 的 `commandBoundary?` 本就是可选 prop |
| 5 | §4.7「副机主副屏切换几乎是免费的」 | **假**。见 §3.1 |
| 6 | 主副屏切换"✅ 在用" | 两条切换命令**生产零派发方**(我的 grep 为空),生产靠三个 actor 直接 `dispatchAction` 绕过 |
| 7 | 传输契约"❌ 空壳" | `contracts/src/types/transport.ts:11-46` **已有** space→servers→addresses 全套并公开导出 |
| 8 | `TopologyHostPort` 实现"❓未核" | `androidPlatform.ts:44` 绑 `unavailableTopologyHostPort`,原生零实现。**且启动门假绿**:`consoleAssembly.tsx:91-92` 只判非空,`ports` 因此恒为真 |
| 9 | admin-shell 是唯一能覆盖两个 APP 的位置 | `sample-console/src/assembly/assembly.tsx:25-36` 自己就注册了 admin section |
| 10 | 「保留 masterLocator 结构与 setMasterLocator 命令」 | TER 全仓无 `enableSlave`/`masterLocator`/`masterNodeId`,是净新增不是保留 |
| 11 | 跨机命令"除网关外全齐" | `contracts/src/types/command.ts:1-5` 明文:`CommandRouteContext` "must not cross a wire boundary before a dedicated serialization and compatibility review",而 `peer.ts:9-14` 强制要求带它 |
| 12 | QR→IP 能"整块删掉编解码层" | 同模块的 `resolveTopologyV3SocketServerFromUrls` 等是非 QR 路径的承重件,只有 parse/紧凑编码/版本闸可删 |
| 13 | §4.3 立规"词表不能同名不同义",§5.2 自己就把 Dexter 的"多 workspace"等同于 transport `spaces` | TER 生产已有 `WorkspaceKey`=MAIN/BRANCH。同一稿内两个 workspace。见 §4 D-四 |

**根因**:①我把一个未接线包的能力当成 POC 的实际行为——这正是我用来审 TER 的"接缝齐、生产零实现"标准,却没用在 POC 上;②多条结论只读了一条链路就下断言;③多条"恰好让工作量变小"的结论未被自己怀疑。

### 0.1 证据档位

| 档位 | 含义 |
|---|---|
| 【源】 | 打开源码亲验,附 `文件:行` |
| 【检索】 | 由检索得出的**否定结论**,附检索范围;行级检索对多行写法有已知盲区 |
| 【推】 | 由多处【源】组合推出 |
| 【问】 | 需 Dexter 裁决 |

POC 路径:**v1** = v1 版 POC 仓,**v2** = v2 版 POC 仓。TER 路径写仓根相对路径。

---

## 1. 两版 POC:只留对 TER 有决策价值的部分

> v2 稿这里有两大章考古,也是错误集中地。本版只保留影响 TER 怎么建的结论。

### 1.1 出厂形态:比设计稿简单得多

v2 仓里有两套东西,必须分清:

- **未接线的设计稿**:`host-runtime` 包(ticket 签发、session 状态机、离线队列、重绑、resume 栅栏、兼容性裁决)。**全仓无人 import**【检索:newPOSv1 全域排除 node_modules/dist 搜 `kernel-base-host-runtime`,只命中自身两处配置】。
- **真正在跑的宿主**:Android 原生 `TopologyHostV3*.kt` 与 mock server。它们做的事只有——

| 机制 | 出厂实现 | 证据 |
|---|---|---|
| 配对 | **只判角色占位**,`MASTER`/`SLAVE` 各一个坑,冲突回 `ROLE_OCCUPIED` | `TopologyHostV3Runtime.kt:35-69`【源】 |
| 认证 | **没有**。Hello 无 token 字段;路由 `/ws` `/status` `/stats` `/diagnostics` `/fault-rules` 全部无鉴权 | `TopologyHostV3Server.kt:111-134`【源】 |
| 对端离线 | **静默丢弃**,无队列、无补发 | `TopologyHostV3Server.kt:245-251`【源】 |
| 心跳 | 服务端定时 ping,超时踢连接 | `:191-213`【源】 |

**对 TER 的含义:第一版不需要 ticket、session、离线队列。出厂 POC 自己都没有,它们属于"设计稿里有但没跑过"的部分。**

### 1.2 双屏机与双机是同一套机制的两种对端

`resolveTopologyLaunch.ts`【源】:`:28-30` 单屏直接返回不起宿主;`:43-48` **双屏主屏**调 `prepareLaunch` 拿 `role:'master'`;`:55-70` 副屏拿 `role:'slave'`、nodeId 为 `${masterNodeId}:display-${displayIndex}`。设计意图注释(`:20-24`)原文:**"Android assembly 的主副屏都必须通过真实 loopback topology host 通讯"**。

`bootstrapRuntime.ts:13-18`【源】双屏主屏**显式派发 `setEnableSlave(true)`**。

所以 v2 的模型是:**本地副屏走 loopback、远程副机走网络,同一套拓扑**。而 JS 侧 `shouldRunTopologyHost` 要求 `displayCount === 1`(`hostLifecycleActor.ts:19-26`),与原生 launch 链路的 `displayCount > 1` 互补——两条起宿主的路径,不是一条。

### 1.3 值得抄的三件事

1. **传输与拓扑分层**:拓扑只是 transport 上的一个 socket profile,不 fork 传输(`protocol.ts` 全文 28 行)。
2. **同步方向声明在切片上**:`syncIntent` + 按方向过滤(`syncRegistry.ts:34-37`)。**TER 已有同形契约**。
3. **重连节奏的并发防护**:`socketLifecycleController.ts:60,77-80` 用 `connectionToken` 防"旧 connect 慢返回"覆盖新决策,注释说明是为避免幽灵连接。

### 1.4 v1 值得抄的一件事

**重连时的 LWW 对账**:双方交换 `updatedAt` 摘要 → 算差异 → 补推 → 才开始增量同步(`instanceInterconnection.ts:61-73`、`:92-102`、`:114-172`)【源】。

这是比 v2 的离线队列**便宜得多**的断线补救,而且 TER 已有全量快照能力(`createFullSliceSyncPayload`)。**第一版取这条。**

### 1.5 POC 的主副屏显示逻辑(逐环,不留给 Codex 猜)

> Dexter 要求把这块吃透讲透。以下每一环都【源】,按调用顺序排。

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

**当前 screen 是谁写进去的**(这条最容易做反):`runtimeInitializeActor.ts:19-40` 在**本机自己的 initialize** 里调 `replaceCateringShellRootScreen`;后者(`rootScreenRouter.ts:18-40`)按 `activated` 算出 primary/secondary **两个** target,**连发两条 `replaceScreen`**。

路由机制已亲验【源】:`screenRuntimeActor.ts:55-74` 读 `definition.containerKey`,缺失即抛 `invalidScreenTarget`,然后 `setScreen({containerKey, entry})`。**所以"推到哪个容器"完全由 part 定义自带的 containerKey 决定,调用方不指定容器。**

导航目标**成对提供**(`navigationTargets.ts:5-12`)【源】:`activation`/`activationSecondary`、`welcome`/`welcomeSecondary`、`masterDataWorkbenchPrimary`/`masterDataWorkbenchSecondary`——三对六个。

⚠️ **"当前 screen" 的存储是 (workspace, containerKey) 双键作用域**(`selectUiScreen:56-68`)【源】:先按 `selectUiRuntimeCurrentWorkspace` 选中 workspace 分片,再按 containerKey 取。**切 workspace 会整体换掉所有容器的当前页面。** 这正是 §3.2"先设 mode 再设 role"那条顺序约束的根据。

> ⇒ **副机显示的是它自己 initialize 时推进去的页面,不是主机远程推过来的。** 主机只同步状态,不推屏。`findFirstReady` 只是兜底。

**三个必须交代给实施方的坑**:

1. **`screenModes` 里的 `'PRIMARY'`/`'SECONDARY'` 是死条目。** `buildUiScreenRegistryContext:101` 是 `overrides.screenMode ?? 'DESKTOP'`,而全仓**无人传 overrides**(`useScreenPartsByContainer:17` 只传两个参数)。所以三轴里 screenMode 那一轴恒等于 `'DESKTOP'`,part 写 PRIMARY/SECONDARY 不起作用——**真正分主副屏的是 `containerKey`**。`terminalScreenParts.ts:37` 那个挂在 secondary 容器却声明 `['PRIMARY','SECONDARY','DESKTOP']` 的 part 就是佐证。
2. **display 判定必须 `displayIndex` 优先。** POC 注释自陈原因:*"topology displayMode 不再承担 RootScreen 首次选容器的职责,否则副屏会受 initialize 时序影响,短暂落到 primary root"*(`RootScreen.tsx:45-47`)。这是他们踩过的坑。
3. **主副屏渲染的是同一棵组件树**(`RootScreen.tsx:103-125`),没有独立的副屏组件,差别只有往下传的 `display` prop。

**映射到 TER**:TER **没有**两个根容器,所有 part 挂同一个 `main`,靠 `displayModes` 过滤(§3.1 表)。TER 也**已有** secondary 变体。所以这套逻辑在 TER 的等价物是:`resolveSurfaceDisplayMode` 定出 surface 的 displayMode → `main` 容器按 `displayModes` 选中 secondary 变体。**唯一缺的是把业务 part 的 `instanceModes` 放开到含 SLAVE。**

**两边过滤规则的差异(实施时别照抄 POC 的轴)**【源】:

| | POC `screenRegistry.ts:10-15` | TER `isUiCatalogEntryAvailable:151-158` |
|---|---|---|
| 轴数 | 3:screenModes ∧ workspaces ∧ instanceModes | **5**:containerKeys(placement) ∧ displayModes ∧ workspaces ∧ instanceModes ∧ **surfaceForm** |
| 主副屏靠哪轴 | **containerKey**(screenModes 那轴恒为 DESKTOP,见坑 1) | **displayModes** |
| 非法 context | 不校验 | **校验并抛错**(`:147-150`) |

⇒ TER 多一条 `surfaceForm` 轴(laptop/mobile),这是 POC 没有的;POC 的 `screenModes` 在 TER 没有对应物,**不要为它新造一个字段**。

---

## 2. TER 现状

### 2.1 可直接复用

| 能力 | 证据 |
|---|---|
| `SyncIntent` / `SyncStateDiff` / `SyncValueEnvelope` 与 v2 同形 | `state/src/types/sync.ts:4-19,48-61`【源】,注释自陈 "POC-compatible contract" |
| 全量同步载荷 + 落地 | `state/src/foundations/sync.ts:58-115`【源】 |
| **传输配置契约**(space→servers→addresses) | `contracts/src/types/transport.ts:11-46`,公开导出【源】 |
| 跨机命令派发器(四态生命周期、超时竞速、迟到补发) | `createCommandPeerDispatcher.ts` 全文【源】 |
| 网关安装口(在模块 install 上下文) | `types/module.ts:70`【源】 |
| 浮层与确认框机制(`alert` 层 + `decisive` guard) | `LayerStack.tsx:59-67,177-178,201-205,224`【源】,行为已核;**且 member-desk 已有确认组件在产可照抄** |
| 管理台 section 机制 + **section 可直接派命令** | `parts/parts.ts`;`AdminLayer.tsx:26`、`AdminLauncher.tsx:74`【源】 |
| 显示派生与资格、电源触发切换 | `displayDerivation.ts:16-62`【源】 |

### 2.2 缺口

| 缺口 | 性质 | 证据 |
|---|---|---|
| **主机侧原生宿主** | **最长的一根杆,且是原生 Kotlin** | 三处独立验证【源】:①`androidPlatform.ts:44` 绑 `unavailableTopologyHostPort`(两个 **Android** APP 的唯一绑定点;`dev-host/webPlatform.ts:87` 是第三处平台绑定,同样 unavailable);②Kotlin 侧注册名恰好四个(PersistKv/Device/DualScreen/NativeLoading);③TS 侧 `requireNativeModule` 桥接恰好四处,与②一一对应。**无任何 topology 桥接,16 个原生文件与 8 个 gradle 里没有任何网络类/网络库,且 `topologyHost` 的引用枚举里没有任何 actor/module/command 驱动其起停** |
| HTTP + WS 客户端实现 | 全新 | `transport` 包三个源文件;全仓无 HTTP 客户端【检索】。**成本不对称**:宿主侧(开服务端)是绿地含 Kotlin【源】;客户端侧 RN 运行时自带 HTTP/WS,原生可能无需新增【推,未核 RN 全局是否到达 TER 包】。但 `tsconfig.base.json` 无 `lib`/`types`/DOM、`files` 只含仅声明 `__DEV__` 的 `terminal-env.d.ts`【源】,**继承它的 kernel 包拿不到 `fetch`/`WebSocket` 类型,新传输包须自带** |
| 副机侧拓扑端口 | 未声明 | `platform-ports/src/types` 12 个文件里无客户端侧拓扑端口【源】 |
| 跨机线上信封契约 | 全新 | TER contracts 无 v2 那五类 Envelope【源】 |
| `enableSlave` / `masterLocator` 概念 | 全新 | 全仓零命中【检索:apps/terminal 排除 node_modules/.turbo】 |
| 增量差分生产者 | 缺(消费侧已有) | `applySliceSyncDiff` 已实现 `replaceMissing:false` 分支【源】 |

### 2.3 两条已知假绿

1. **启动门 `ports` 恒绿**:`consoleAssembly.tsx:91-92` 只判绑定非空,`topologyHost` 绑 unavailable 也过【源】。
2. **切换命令从未在生产跑过**:`switchDisplayRoleCommand`/`switchInstanceModeCommand` 零派发方【检索】,其四类拒绝分支的行为在生产从未执行。

---

## 3. 第一版做什么、不做什么

> 本节是本版的核心。按"不过度设计、接受有限有损"给出**显式的取舍**,而不是把盲审提出的每条缺口都变成一个机制。

### 3.1 必须先解决的一件事:配对会让业务屏变空

**现象是真的,但 v3 初稿把根因归错了,这里更正。**

现象:派发 `switchInstanceMode(SLAVE)` 后,两个 APP 的业务容器失去全部可用 part。

v3 初稿归因于"workspace 翻到 BRANCH"。**不对。** 对照 POC 后的正确归因:

| 环节 | POC | TER | 是不是根因 |
|---|---|---|---|
| workspace | `SLAVE+SECONDARY → main`(`runtimeDerivation.ts:6-14`) | `SLAVE+VICE → MAIN`(`displayDerivation.ts:11-14`) | **不是**。副机本就该是 SECONDARY/VICE,按"先设 mode 再设 role"的顺序不会翻 BRANCH |
| 主副屏区分 | 两个根容器 `primaryRootContainer`/`secondaryRootContainer` + `screenModes` | **同一个 `main` 容器 + `displayModes` 过滤**,TER 更简单 | 不是 |
| secondary 变体 | `secondaryWelcome`/`secondaryWorkbench` 成对提供 | **TER 已有**:`sample-wallpaper-console/parts.ts:15,28`、`sample-member-desk/parts.ts:129` 均 `displayModes: secondary` | 不是,不必新建 |
| **`instanceModes`** | 业务 part 全部显式含 SLAVE(`cateringShellScreenParts.ts:26,39`;`masterDataWorkbenchScreenParts.ts:23,36`) | **全部写死 `['MASTER']`**,连 secondary 变体也是(member-desk `:129-131`、wallpaper-console `:14-17`) | **是,唯一根因** |

所有【源】。`screenRegistry.ts:13-15` 的 `matchesContext` = screenModes ∧ workspaces ∧ instanceModes,三条同时与。

**⇒ 落实 D-一「POC 会显示什么就显示什么」= 副机切 SLAVE + VICE,显示已有的 secondary 变体,把业务 part 的 `instanceModes` 放开到含 SLAVE。改的是白名单,不是补界面。**

### 3.2 第一版的有限有损清单(我已定,不提请裁决)

| 项 | 取舍 | 理由 |
|---|---|---|
| 角色切换生效方式 | **副机侧重启 JS 端生效**(Dexter 裁决;不是重启 APP) | surface 的 displayMode/画布是一次性快照(`createSurfaceForDisplayIndex` 读一次 `runtime.getState()`,`AndroidTerminalApp` 不订阅 runtime)【源】,让它响应角色变化要动 base 层。改为重启 JS——**TER 需在 adapter 补这条能力,详见 §3.2.2**。**有损:配对后副机需重启 JS 才生效** |
| 配对时的角色写入顺序 | **先 `setInstanceMode(SLAVE)`,再设 VICE** | `runtimeRoleChangedActor.ts:27-30` 会在 instanceMode 变化时把角色重置为 CHIEF【源】;顺序反了会落在 `SLAVE+CHIEF → BRANCH`。这是实施约束,不是取舍,但必须写明否则必踩 |
| 断线期间的变更 | **接受丢失**;重连后**各自把自己拥有的切片单向全量推给对端**(方向按 `syncIntent`) | 不做 v1 的双向 `updatedAt` 摘要对账,也不做 v2 的离线队列/重绑/resume 栅栏——出厂 POC 自己就是静默丢弃。§2.4 已是"每切片单写者",单向全量天然无冲突,比摘要对账便宜得多。**有损**:重连瞬间会覆盖对端同切片的中间态,但既然是单写者,对端本就不该改它 |
| ticket / session | **不做** | 出厂 POC 没有;1:1 由角色占位保证即可 |
| 增量差分 | **不做**,只发全量 | TER 已有全量能力;一主一副规模下够用。消费侧(`replaceMissing:false`)已在,将来要加不返工 |
| `routeContext` 跨机 | **不上线** | 零成本满足 `contracts/src/types/command.ts:1-5` 的明文禁令;有损:跨机命令不带路由上下文 |
| 传输包第二个消费方 | **本期不强接**。有损:**本期无法证明它不是拓扑专用,通用性按形状赊账** | **TER 今天没有任何活的网络消费方**——`androidPlatform.ts:38-44` 把 `logUpload`/`hotUpdate`/`connector`/`appControl`/`script` 全绑成 `unavailable*Port`,只有 `device` 是实的【源】。所以"指一个现成端口当第二消费方"并不便宜,同样要配原生实现。**Dexter 已裁决认这笔账,见 §4.1 N-三** |
| 故障注入 / demo 脚手架 | **不抄** | POC 的测试装置 |
| 多副机 | **不支持**,第二台直接拒 | 角色占位天然给出 `ROLE_OCCUPIED` |
| `requestLedger` 跨机同步 | **第一版不同步**,显式标记为"已声明方向、暂未生效" | 它是 TER 生产里**唯一**声明了跨机方向的切片(`requestLedger.ts:153-163` 按 mode 产出 `master-to-slave`/`slave-to-master`,经 `createInternalRuntimeModule.ts:62-64` 注册)【源】。第一版不搬它,但**必须写明是暂不生效而不是默默不管**,否则留下一个"声明了方向却永远搬不动"的切片 |
| `enableSlave` 归属 | **落在拓扑包的持久化配置位,由控制页开关** | D-5 裁"默认关"就必须有人能开,那正是 D-1 那个 tab 的核心职能;TER 今天无此概念,是净新增 |
| 主机身份显示时机 | **连接前确认,不是配对后展示** | D-3 的实际用途是让用户发现 IP 输错了;配对成功后才显示对这个用途毫无帮助 |

#### 3.2.1 ⚠️ 阻塞级实施约束:配对所需的两条命令今天从 UI 派不出去

D-一 落地必须派 `switchInstanceMode(SLAVE)` 与 `switchDisplayRole(VICE)`。**这两条今天都会被 TER 自己的资格门拒掉**,原因是 `routeContext` 在 UI 链路上恒为空。逐环【源】:

| # | 位置 | 事实 |
|---|---|---|
| 1 | `render/src/foundations/dispatchWithRequestId.ts` 全文 | options 只放 `{requestId}` |
| 2 | `console-assembly/src/foundations/consoleAssembly.tsx:198-201` | `createDispatchCommand` **只转发 `requestId`**,给了 routeContext 也丢掉 |
| 3 | `runtime/src/foundations/createCommandDispatcher.ts:500-502` | `options.routeContext === undefined ? null : ...` —— **默认 `null`,无注入** |
| 4 | `display-context/.../switchInstanceModeActor.ts:64`、`switchDisplayRoleActor.ts:43,94` | 读 `context.command.routeContext?.displayMode` ⇒ `undefined` |
| 5 | `displayDerivation.ts:46-48` | 切 SLAVE 时 `routeDisplayMode == null` ⇒ **`missing-display-route`,拒绝** |
| 6 | `displayDerivation.ts:26-28` | 切 VICE 同理 ⇒ **拒绝** |

**这解释了 §2.3 的第二条假绿**:两条切换命令生产零派发方,所以这条分支从未在生产暴露过。

**修复面横跨两个 base 包,而且是类型契约级的**【源】:

- `ui/base/render/src/types/props.ts:32-39` —— `RenderDispatchOptions` **整个类型只有 `requestId` 一个字段**(且 NonNullable)。所以不是"`createDispatchCommand` 选择丢掉 routeContext",是**UI 派发契约从类型上就不允许传**。
- `ui/base/console-assembly/src/foundations/consoleAssembly.tsx:198-201` —— 实现侧同样只转发 `requestId`;`:578` 是 RenderProvider 那个 `dispatchCommand` 的**唯一产出点**(跨 console-assembly / dev-host / render 三处检索确认),没有别的更宽实现可绕。

⇒ 要让控制页派得出这两条命令,得**同时改 render 的类型契约与 console-assembly 的实现**,再由派发方按当前 surface 的 displayMode 填入。**这不是改调用点就能了事的,实施方必须提前知道范围。**

**已尝试证伪、未找到退路**(省得实施方再找一遍)【源】:`RenderContextValue` 的全部 13 个字段里,唯一的派发口就是那个窄化的 `dispatchCommand`,**没有原始 `Runtime`**;`RenderSubscriptionContextValue` 只有 `{stateSource, snapshotReader}`;全 `render/contexts` 与 `render/hooks` 检索 `useRuntime|runtime:|Runtime` 为空。**section 组件没有第二条能带 `routeContext` 的路。**

> ✅ **Dexter 已裁决:改。** 原话"当然要改"。理由与本节一致——`CommandDispatchOptions` 本就有 `routeContext`,是 UI 层单方面掐掉的,才导致这两条命令在生产从未被走通(§2.3 第二条假绿的成因)。

> 顺带澄清一条容易搞反的:`routeDisplayMode` **不是** surface 推导出的 displayMode,而是"命令从哪块屏派发"的路由上下文(可选,类型 `CommandRouteContext`)。它那条 `must not cross a wire boundary` 的注释(§0 第 11 条)与此无关——这里是本机命令,不过线。

#### 3.2.2 副机侧重启 JS:TER 要补什么(N-二)

Dexter 裁决:配对后**副机侧重启 JS 端**生效,不是重启 APP;并要求 **TER 在 adapter 中补充这条能力**。

**好消息:契约已声明,原生能力也现成,缺的只是接线。**

| 环节 | TER 现状 | 证据 |
|---|---|---|
| 端口契约 | **已声明**:`AppControlPort.resetRuntime`,终态观测 `SUCCESSOR_RUNTIME_STARTED`(后继运行时已启动)——语义正是 JS 端重启 | `platform-ports/src/types/appControl.ts:5,12,16`【源】 |
| 实现 | **零实现**:`unavailableAppControlPort.resetRuntime` 返回 unavailable;全仓除类型与桩之外**只有测试引用**,生产零调用 | `defaults/unavailableAppControl.ts:7` +【检索】 |
| 原生能力 | **现成**:两个 APP 的 `MainApplication.kt:19-20` 都有 `override val reactHost: ReactHost by lazy { ExpoReactHostFactory.getDefaultReactHost(...) }` | 【源】 |
| 原生模块 | **缺**:`assembly` 下只有 6 个 `.kt`(两对 MainActivity/MainApplication + 两个 NativeLoading),全仓 16 个 `.kt`(§2.2)里**没有 appControl 模块**;但有四个 Expo 模块先例(Device / PersistKv / DualScreen / NativeLoading) | 【源】 |

⇒ **要做的是**:照现有 Expo 模块形态新增一个原生模块,把已声明的 `resetRuntime` 接到 `reactHost.reload(...)`。**不改端口契约。**

**从 POC 继承一条顺序约束,但只在主机侧适用**:POC 的重启链路是「停拓扑宿主 → **轮询等它真到 STOPPED** → 关副屏实例 → reload」,其注释写明原因(`AppRestartManager.kt:120-124`)【源】:

> 「server 可能还处于 STOPPING 过渡态。如果直接退出重启,下一轮 JS 又马上启动 server,**容易出现端口占用、旧连接未清理**」

⇒ **主机侧重启前必须先停宿主并等停稳;副机侧没有宿主在跑,这一环不适用。** 写成条件约束,别无条件照抄。

**两处明确不抄 POC**:

1. **跨进程握手不需要。** POC 的副屏是**独立进程**,重启要走广播请求 + ACK(4s 超时)+ 进程存活判断(`SecondaryProcessController`)【源】。**TER 的副屏是同进程 Activity surface**(Expo `ReactActivityHandler`,`assembly/android` 下无 `android:process`)【源+检索】,整环省掉。

   ⚠️ **但同进程有代价**:TER 重启 JS 会**同时重启主副两块 surface**,做不到 POC 那样只重启副进程。**双机场景无影响**(副机是另一台设备,重启的是它自己);但**本地双屏机将来用这条能力时主屏会跟着重启**——本期不处理,记入 `HANDOFF.md`。
2. **热更重启进程分支暂不需要。** POC 的 `reloadReactHost` 命中热更包时会走 `relaunchProcess`(launch intent + CLEAR_TASK)【源】;TER 的 `hotUpdate` 端口目前绑 unavailable,该分支暂无对应场景——但要**留意将来接热更时会回来**。

### 3.3 失败路径:第一版的期望行为

> 盲审指出 v2 稿只转述了 POC 的拒绝码、没写成 TER 需求。这里只写第一版要有的,不追求完备。

| 情形 | 第一版行为 |
|---|---|
| IP 填错 / 连不上 | 控制页显示连接失败与原因,可重试;不自动重试到天荒地老 |
| 主机重启 | 副机按重连节奏自动重连;连上后双方各自按 §3.2 单向全量推自己拥有的切片 |
| 第二台副机来连 | 主机拒绝(角色已占),副机侧显示"该主机已有副机" |
| 两机版本不一致 | **第一版不做版本协商**。有损:不一致时行为未定义,记入 HANDOFF |
| 同步冲突 | 每切片单写者,方向在切片上声明 ⇒ 结构上不产生冲突 |
| 解除配对 | 控制页提供"断开并清除主机",清 locator + 回 MASTER |

### 3.4 落点

- **拓扑控制页放 `ui/base/admin-shell`**(Dexter 裁决:"双机拓扑是 base 能力,不是 feature")。我原先建议放共享 feature 包是**错的**,已撤回。三条证据同向:
  - **POC 就是这么做的**:它唯一的拓扑 UI 先例是 `2-ui/2.1-base/admin-console/src/ui/screens/AdminTopologySection.tsx`——放在 base 的管理台包里。而同层的 `topology-runtime-bridge` **不是 UI 包**(7 个文件全是 `application/`+`types/`,无组件),它只做运行时桥接【源】。
  - **依赖边合规**:`admin-shell/package.json` 已依赖 `kernel-base-display-context`【源】——正是 `switchDisplayRole`/`switchInstanceMode` 所在的包。放进去**不需要为这两条命令新增任何依赖边**,只需再加一条对新拓扑 kernel 包的依赖;而 base 包依赖 kernel-base 能力包在本仓是惯例(admin-shell、console-assembly 皆然)。
  - **新建 base 包反而更贵**:`consoleAssembly.tsx:316` 只无条件并入 `adminShellAssembly.parts`【源】,新包的 part 不会自动进去,要么两个 integration 各传一次,要么改 console-assembly。
  - 顺带排除:`ui/base/feature-assembly` **不是**落点——其 README 明写它是"`ui/feature` owner 共用的 module/assembly 结构工具包,不是业务 feature、App assembly 或 runtime state owner"【源】。
- **若需要运行时侧接线**(如电源切换的确认弹窗 actor),照 POC 的 `topology-runtime-bridge` 形态**另起一个无 UI 的桥接模块**,不要塞进控制页组件里。
- **传输基座**填进已有的 `kernel/base/transport` 空壳。`skeleton-graph.ts:27-32` 已把它钉为 batch 2 / `plannedKind:'owner'`,依赖恰为 contracts/platform-ports/state/runtime【源】。
- **拓扑包**新建,不能塞进 transport——`skeleton-graph` 里 transport 的声明依赖**没有 display-context**,而拓扑语义必然要用它。新建包需同步补 `skeleton-graph` 条目。

### 3.5 信任边界(显式记录,不实现认证)

出厂 POC 全链路零认证(§1.1)。**Dexter 已裁决:不做认证,也不做配对确认。**

> **同网段 + 知道主机 IP = 有权配对。一主一从由角色占位天然保证,没有"陌生设备"这个概念。**

裁决原文要点:*"不做认证。没有所谓的陌生不陌生的设备,一个 master 只能匹配一个 slave,不要过度设计。"*

仍写明一条实施约束:POC 的 `/fault-rules` 是**无鉴权的 POST/DELETE 变更端点**(`TopologyHostV3Server.kt:120-133`)【源】,那是故障注入的测试装置,**TER 不照抄**(与 §3.2"故障注入不抄"同一条)。

认证按右尺寸标尺属生产化项,进 `HANDOFF.md` 欠账。

---

## 4. 裁决记录(四条已闭)

| | 问题 | 裁决 | 落点 |
|---|---|---|---|
| **D-一** | 配对后副机显示什么 | **"POC 会显示什么就显示什么"** | §3.1。即副机切 SLAVE+VICE、显示已有的 secondary 变体,**放开业务 part 的 `instanceModes`**。我原先倾向的"副机不切 instanceMode"被此裁决否掉——POC 是切的,只是把 part 对 SLAVE 开放 |
| **D-二** | 主机侧原生宿主这期做不做 | **问题本身无效** | 没有原生宿主功能就不存在,只有一个可能答案。我把非问题摆成裁决项,浪费一次决策。**主机侧原生 Kotlin 宿主在本期范围内** |
| **D-三** | 信任边界 | **不做认证,不做配对确认** | §3.5。"没有所谓的陌生不陌生的设备,一个 master 只能匹配一个 slave" |
| **D-四** | "多个 workspace"指哪个 | **指一组服务器地址** | 即 transport 的 `spaces`,与 TER 的 `WorkspaceKey`(MAIN/BRANCH)无关。§4.3 的词表要把两者分开命名 |

### 4.1 第二轮裁决(四条,均已闭)

| | 问题 | 裁决 | 落点 |
|---|---|---|---|
| **N-一** | 为配对改 `ui/base` 的派发类型契约,要不要动 | **"当然要改"** | §3.2.1。授权改 `render` 的 `RenderDispatchOptions` 与 `console-assembly` 的 `createDispatchCommand` |
| **N-二** | 角色切换"重启生效"能否接受 | **可以,但重启的是副机侧的 JS 端,不是 APP**;并要求 **TER 在 adapter 中补充重启能力** | §3.2 对应行 + §3.2.2 |
| **N-三** | 传输包通用性本期只能赊账,认不认 | **"可以"** | 第一版按通用形状建、消费 `contracts` 既有配置契约,只有双机一个消费方 |
| **N-四** | 拓扑控制页放哪 | **"双机拓扑是 base 能力,不是 feature"** | §3.4。我原先的 feature 包建议已撤回 |

---

## 5. 未验与边界

0. **本稿按 Round 1 收口,Round 2 未读。** 对抗审查第一轮四个维度全部 NO-GO(3M/2S/5N、1M/4S/3N、2M/5S/3N、5M/4S/2N),其 finding 已逐条 intake 并重写本稿;第二轮两个盲审已发起但**Dexter 叫停,其结果未纳入**。按治理 DESIGN 上限两轮,本稿以 `SELF_DECIDED` 收口。

0b. **此后 Dexter 追加"自己再 review 几轮",作者自审四轮**(不替代已完成的独立盲审,仅作留痕):
   - R1 核 §1.5 的四条承重引用 → 全部属实,补入 `replaceScreen` 路由与 (workspace, containerKey) 双键作用域
   - R2 核 §3.1/§2.1 依赖的常量别名(`masterInstance` / `secondary` 等)→ 全部属实,无需改稿
   - R3 把 §1.5 "screenMode 无人 override" 从"grep 为空"升级为**调用点穷举**;查出 §3.4 落点**在仓内无先例**并已标注;核实 §3.2 的 requestLedger 引用
   - R4 追 `routeDisplayMode` 链路 → 查出 **§3.2.1 这条阻塞级约束**(原稿完全没有),并两次修正自己:先误判为"解绑被拒"(实为配对被拒),再低估修复范围(实为跨两个 base 包的类型契约)
   - R5 **反方向证伪 §3.2.1 的严重度**:专门去找能绕开的退路(原始 `Runtime`、第二个更宽的派发口),`RenderContextValue` 13 个字段与 `render/hooks` 全查过,确认不存在 ⇒ 定性未被抬高

0c. **第二轮裁决后的落实核查**(为 N-一..N-四 补事实,非评审轮次):POC 的重启链路与顺序教训(`AppRestartManager.kt`)、`SecondaryProcessController` 的跨进程模型、TER 两个 APP 的 `ReactHost`、TER 同进程 Activity surface 模型、`resetRuntime` 的声明与零实现、落点三证(POC 先例 / admin-shell 依赖 / `consoleAssembly:316` 合并约束)与 `feature-assembly` 的排除。过程中修正自己两处:把 `assembly` 下的 6 个 `.kt` 误写成"原生侧只有 6 个"(全仓 16),以及遗漏"同进程重启会连带主屏"这一后果。
1. **POC 的 `connectionActor` / `powerDisplaySwitchActor` / 各 slice 未读**,本稿未对其下结论。
1b. **装配层类型环境未核**:`assembly-base-android/config/global` 的内容没读,§2.2 的类型环境结论只对继承 `tsconfig.base.json` 的 kernel 包成立。
2. **一切运行时行为均未验证**;按分工只做静态阅读,不跑任何构建、测试或设备命令。
3. **工作量全部未估**——这是 Codex 的实施视角,不是我的。
4. 【检索】档位的否定结论对多行写法有盲区,已在各条注明检索范围。
5. §3.1 第 4 步(业务屏变空)是由前三步【源】推出的**推论**,未跑设备验证。

### 5.1 授权边界

讨论稿。不授权详设或实施,不推进任何 Roadmap step,不替代 Codex 的实施可行性评审。**D-一与 D-二未闭之前不应进详设**——前者决定要建什么,后者决定能不能建成。

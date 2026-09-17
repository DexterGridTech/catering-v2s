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
| **主机侧原生宿主** | **最长的一根杆,且是原生 Kotlin** | `androidPlatform.ts:44` 绑 unavailable;adapter 下只有 device/dual-screen/persist-kv【源】 |
| HTTP + WS 客户端实现 | 全新 | `transport` 包三个源文件;全仓无 HTTP 客户端【检索】 |
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

**这是 v2 稿最严重的错误(§4.7「几乎免费」)的真实后果。**

链条(逐环【源】):
1. `runtimeRoleChangedActor.ts:27-30`:instanceMode 一变,非 CHIEF 即**无条件写回 CHIEF**
2. `displayDerivation.ts:11-14`:`resolveWorkspace({SLAVE, CHIEF})` = **`BRANCH`**
3. 生产业务 part **全部只声明 `MAIN` + `MASTER`**(member-desk 9、staff-auth 3、wallpaper-picker 2、wallpaper-console 若干)【检索 + 抽样源】
4. ⇒ 派发 `switchInstanceMode(SLAVE)` 的那一刻,**两个 APP 的业务容器同时失去全部可用 part**

而 D-7 要的正是"两个 APP 都跑通"。**所以配对流程不能简单地在业务 runtime 上派 `switchInstanceMode`。** 这是 §4 D-一。

### 3.2 第一版的有限有损清单(我已定,不提请裁决)

| 项 | 取舍 | 理由 |
|---|---|---|
| 角色切换生效方式 | **接受"重启生效"** | 让 surface 响应角色变化要动 `console-assembly` 的 `createSurface` 签名与 `AndroidTerminalApp` 的订阅,是 base 层手术;重启便宜且诚实 |
| 断线期间的变更 | **接受丢失**,重连时全量快照补齐 | 抄 v1 的重连对账思路;出厂 POC 自己就是静默丢弃。不做离线队列/重绑/resume 栅栏 |
| ticket / session | **不做** | 出厂 POC 没有;1:1 由角色占位保证即可 |
| 增量差分 | **不做**,只发全量 | TER 已有全量能力;一主一副规模下够用。消费侧(`replaceMissing:false`)已在,将来要加不返工 |
| `routeContext` 跨机 | **不上线** | 零成本满足 `contracts/src/types/command.ts:1-5` 的明文禁令;有损:跨机命令不带路由上下文 |
| 传输包第二个消费方 | **本期不强接** | 按通用形状建、消费 `contracts` 已有的配置契约即可;不为"证明通用"制造工作量 |
| 故障注入 / demo 脚手架 | **不抄** | POC 的测试装置 |
| 多副机 | **不支持**,第二台直接拒 | 角色占位天然给出 `ROLE_OCCUPIED` |
| `enableSlave` 归属 | **落在拓扑包的持久化配置位,由控制页开关** | D-5 裁"默认关"就必须有人能开,那正是 D-1 那个 tab 的核心职能;TER 今天无此概念,是净新增 |
| 主机身份显示时机 | **连接前确认,不是配对后展示** | D-3 的实际用途是让用户发现 IP 输错了;配对成功后才显示对这个用途毫无帮助 |

### 3.3 失败路径:第一版的期望行为

> 盲审指出 v2 稿只转述了 POC 的拒绝码、没写成 TER 需求。这里只写第一版要有的,不追求完备。

| 情形 | 第一版行为 |
|---|---|
| IP 填错 / 连不上 | 控制页显示连接失败与原因,可重试;不自动重试到天荒地老 |
| 主机重启 | 副机按重连节奏自动重连,连上后走全量快照 |
| 第二台副机来连 | 主机拒绝(角色已占),副机侧显示"该主机已有副机" |
| 两机版本不一致 | **第一版不做版本协商**。有损:不一致时行为未定义,记入 HANDOFF |
| 同步冲突 | 每切片单写者,方向在切片上声明 ⇒ 结构上不产生冲突 |
| 解除配对 | 控制页提供"断开并清除主机",清 locator + 回 MASTER |

### 3.4 落点

- **拓扑控制页**放**被两个 integration 共同依赖的 feature 包**,不放 `admin-shell`。理由:两个 integration 都能自己注册 admin section(`sample-console/assembly.tsx:25-36` 就是现成例子),而把业务行为塞进自称"只读诊断外壳"的 base 包会让它长出对拓扑 kernel 的依赖边。代价是两次显式装配。
- **传输基座**填进已有的 `kernel/base/transport` 空壳。`skeleton-graph.ts:27-32` 已把它钉为 batch 2 / `plannedKind:'owner'`,依赖恰为 contracts/platform-ports/state/runtime【源】。
- **拓扑包**新建,不能塞进 transport——`skeleton-graph` 里 transport 的声明依赖**没有 display-context**,而拓扑语义必然要用它。新建包需同步补 `skeleton-graph` 条目。

### 3.5 信任边界(显式记录,不实现认证)

出厂 POC 全链路零认证(§1.1)。TER 第一版**接受同样的假设**:

> **同网段 + 知道主机 IP = 有权配对。第一版不做认证。**

但有两点必须写明:
1. D-7 裁决了必须有跨机远程命令,所以"知道 IP"的后果从"能看到画面"变成**"能驱动对端业务命令"**。
2. 主机对外暴露的诊断路由要收窄——POC 的 `/fault-rules` 是**无鉴权的 POST/DELETE 变更端点**(`TopologyHostV3Server.kt:120-133`)【源】,TER 不要照抄这个。

认证本身按右尺寸标尺属生产化项,进 `HANDOFF.md`。

---

## 4. 需要 Dexter 裁决(只有四条)

> v2 稿加上盲审建议共有 13 条候选。按"不过度设计",我只保留**会改变要建什么**的四条,其余在 §3.2 自行定了。

**D-一(阻塞)配对后副机显示什么?**
见 §3.1:直接派 `switchInstanceMode(SLAVE)` 会让业务屏变空。两条路:
- **(a) 副机不切 instanceMode**,只作为主机内容的第二块屏——最便宜,不需要补任何 part
- (b) 副机进 SLAVE/BRANCH,为两个 APP 补一套 BRANCH part 集——工作量大得多

*倾向*:(a)。但它决定了"副机"到底是什么,必须你定。

**D-二 主机侧原生宿主这期做不做?**
TER 没有任何原生网络能力,主机侧是 100% 绿地的 Kotlin 工作(对照 POC 是 7 个 Kotlin 文件)。**不做则整个功能跑不起来,D-7 无从谈起。**

**D-三 信任边界按 §3.5 记录、本期不做认证——认可吗?**
附带:主机首次被陌生设备请求配对,要不要像 D-4 那样弹窗确认?(你已裁电源切换都要确认,这是同类问题)

**D-四 你说的"多个 workspace"指哪一个?**
TER 生产里 `WorkspaceKey` = MAIN/BRANCH 已在用;transport 的 `spaces` 是另一回事(一组服务器地址集)。我 v2 稿把两者混为一谈了。

---

## 5. 未验与边界

1. **POC 的 `connectionActor` / `powerDisplaySwitchActor` / 各 slice 未读**,本稿未对其下结论。
2. **一切运行时行为均未验证**;按分工只做静态阅读,不跑任何构建、测试或设备命令。
3. **工作量全部未估**——这是 Codex 的实施视角,不是我的。
4. 【检索】档位的否定结论对多行写法有盲区,已在各条注明检索范围。
5. §3.1 第 4 步(业务屏变空)是由前三步【源】推出的**推论**,未跑设备验证。

### 5.1 授权边界

讨论稿。不授权详设或实施,不推进任何 Roadmap step,不替代 Codex 的实施可行性评审。**D-一与 D-二未闭之前不应进详设**——前者决定要建什么,后者决定能不能建成。

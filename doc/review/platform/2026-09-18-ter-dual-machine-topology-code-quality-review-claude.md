# TER 双机拓扑 · 代码质量评审(简单 / 高效 / 健壮)+ POC 对照

- 评审人:Claude｜日期:2026-09-18
- 范围:TER 的 TS(contracts / topology / transport / admin-shell)与 Android Kotlin;对照 `newPOSv1` 的 POC 实现
- 性质:**静态代码评审**,非 IMPLEMENTATION 验收。本轮只读,未运行任何构建、测试或设备动作。

## 0. 总评

**结论:TER 这版在"简单"和"健壮"两条轴上明显优于 POC,"高效"上有两处真实热点;另有一处相对 POC 的退步(M-3),以及一条与 POC 无关、但违反详设自设门槛的依赖选型问题(M-5)。**

规模对照(仅供参考,不作为质量判据):

| | TER | POC |
|---|---|---|
| 拓扑 TS | 1779 行 | 3087 行 |
| 传输 TS | 178 行 | 2344 行 |
| Android Kotlin | 535 行(4 文件) | 1221 行(7 文件) |

⚠️ 行数差不能直接读成"更简单":POC 含 TER 明确排除的内容(demo 切片 93 + demo actor 56、扫码 `sharePayload` 259),而 POC 的 `transport-runtime` 2344 行是**通用 HTTP/WS 基座**,TER 没建(见 §4.2)。

## 1. 简单

### 1.1 做得好的

- **包结构与既有 kernel 包同构**:`topology` 的 `application / features{actors,commands,slices} / foundations / selectors / types` 与 `display-context`、`ui-state` 完全一致,没有自成一套。
- **职责切分清楚**:`evaluateTopologyOperation`(操作可用性,73 行纯函数)与 `hostShouldRun`(宿主该不该跑,`actors.ts` 内 8 行)分开;前者服务 UI,后者服务对账。这与 POC 的 `eligibility.ts` / `shouldRunTopologyHost` 的分法一致,没有退化成一个布尔。
- **UI 没有重组可用性**:`TopologySection.tsx` 调 `capability.getOperationEligibility(operation)`,不从 facts 自算;文案统一走 `topologyReasonMessages`。这是设计评审里我担心的点,实现侧守住了。
- **依赖方向正确**:`runtime` 不依赖 `topology`,而是暴露 `CommandTargetResolver` 类型 + 可选注入点,由 topology 提供实现。图没有被反转。

### 1.2 S-1 同一批里两套 JSON 校验,其中一套更弱

`contracts/src/foundations/topologyWire.ts` 的 `isJsonValue` 有**深度上限 12**、键长上限、有限数检查;`topology/src/application/createTopologyModule.ts` 又定义了一个同名 `isJsonValue`,**没有深度上限、没有键长检查**。

后者用在 `readSyncStateDiff` —— 即**跨机 state-full 载荷的校验路径**。虽然 `parseTopologyWireMessage` 已经用强版本校验过整帧,但模块内这份弱版本是第二道防线却更弱,形成"同一事实两套标准"。

**最小修复**:从 contracts 导出强版本供模块复用,删除弱版本。

### 1.3 S-2 三处小重复

- `topologyPeerWsUrl` 在 `actors.ts` 与 `createTopologyModule.ts` 各写一份,函数体相同。
- `isRecord` 同样两份。
- `hostStatusValue`(`actors.ts`,约 35 行手写 `Reflect.get` 校验)与 contracts 的 `parseTopologyIdentityResponse` / `parseTopologyWireMessage` **风格不一致**:同一批里,线上帧走契约 parser,而原生 status 走手写校验。

### 1.4 S-3 固定端口 43172 有 7 个落点(与 IMPLEMENTATION 评审的 S-1 同源)

`TopologySection.tsx:30`、`TerminalTopologyHostRegistry.kt:8`、`actors.ts:426`、`createTopologyModule.ts:58`、`evaluateTopologyOperation.ts:66`(**写在用户可见文案里**)、`createTopologyIdentityClient.ts:34`(URL 模板)、`run-dual-device.mjs:12`。

### 1.5 N-1 646 行模块里有 17 个可变闭包变量

`createTopologyModule` 用闭包变量手搓了一台状态机:`active / scheduled / reconciling / rerun / lastHostSignature / lastPeerSignature / currentSession / currentConnectionId / closingConnectionId / peerAccepted / reconnectTimer / reconnectAttempt / membersSyncRevision / lastMembersFingerprint / lastReceivedMembersRevision` + 两个集合。

**这不比 POC 差**(POC `connectionController.ts` 667 行,同量级),但 POC 额外拆出了 `pairLinkController`(86)与 `syncRegistry`(159)。TER 把连接、握手、同步、网关、调度集中在一个文件里,是本批最难读的一处。不建议现在重构,登记为可读性欠账。

### 1.6 N-2 selector 不读 root

`TopologySection.tsx` 的 `factsSelector = (_root: StateRoot) => capability?.getSnapshot()` —— 形参 `_root` 未使用,实际数据来自捕获的 capability。功能上靠 `areTopologyFactsEqual` 兜住,但它绕过了 selector"从 root 派生"的约定,与仓内其它 selector 用法不一致。

## 2. 高效

### 2.1 做得好的

- `schedule` 有**重入保护 + 微任务合并**(`reconciling` → `rerun`,`scheduled` 去重),不会因连续 state 变化触发风暴。
- `hostSignature` / `peerSignature` 指纹比对,只有真变化才派对账命令。
- `hostStatusActionIfChanged` 避免了重复 dispatch 同值。
- 重连用指数退避并封顶(`min(10_000, 500 * 2**n)`),`reconnectAttempt` 在 accept 时归零。

### 2.2 M-1 已配对主机上,每次 state 变化都会全量序列化 members

`install` 里订阅:

```
context.subscribeState(() => { sendMembersSnapshot(context); schedule(context) })
```

而 `sendMembersSnapshot` 在通过前置检查后会执行 `context.createFullSyncPayload(membersSliceName)` 再 `JSON.stringify(payload.payload)` 求指纹。

⇒ **在"MASTER + 已配对 + session 打开"的状态下,运行时任何一次 state 变化**(任何命令、任何 UI 状态写入)**都会构造一次完整 members 同步载荷并整体 JSON 序列化一次**,只为比对指纹。会员表越大,单次 state tick 的开销越大。

**缓解现状**:非 MASTER、未配对、无 session 时会提前返回,所以副机和未配对主机不受影响——热点只在"正在工作的主机"上,而那恰恰是最忙的节点。

**最小修复**:把指纹改为对 `state[membersSliceName]` 的引用相等判断(Redux slice 不变时引用不变),引用变了再构造载荷;或只在 members 切片订阅上触发。

### 2.3 M-2 每帧发送都要"序列化 + 再解析一次"

`serializeTopologyWireMessage` 在 `JSON.stringify` 之后**调用 `parseTopologyWireMessage(raw)` 自检**再返回。

设计意图是好的(发送侧自证协议合规),但对 `state-full` 这类大帧,配合 §2.2 的指纹序列化,一次 members 变更最多会对同一份数据做 **三趟**完整处理:指纹 stringify → 发送 stringify → 自检 parse。

**最小修复**:自检只在 `__DEV__` 或非 `state-full` 帧上执行;或对 `state-full` 只做"顶层字段 + sliceName/direction"检查而不深度遍历 payload。

### 2.4 N-3 起宿主路径上有两次原生 `getStatus`

`reconcileTopologyHostCommand` 先 `readHostStatus`,不满足则 `start`,起完再 `readHostStatus` 一次确认。每次都是 5s 超时的原生 IPC。因为有指纹门控,频率不高,**记为观察而非缺陷**——"起完确认"本身是健壮性优点。

## 3. 健壮

### 3.1 做得好的(多数强于 POC)

- **用真库而非手写协议**:Kotlin 侧基于 `NanoWSD`/`NanoHTTPD`。POC 是**手写 WS 握手与 HTTP 解析**(`TopologyHostV3Server.kt` 直接 import `ServerSocket`、`Socket`、`BufferedReader`、`OutputStream`、`MessageDigest`、`Base64`)。这是本次对照中差距最大的一条。
- **线上帧校验极严**:`keysAreExactly` 同时拒绝多字段与少字段;`isJsonValue` 有深度上限;错误码是封闭 union;`state-full` 把 `sliceName` 与 `direction` **写死在 parser 里** —— 同步白名单因此在协议层就漂不了。
- **防幽灵连接**:`handlePeerLoss` 比对 `connectionId` 与 `currentConnectionId`、并识别 `closingConnectionId`,旧连接的迟到事件不会覆盖新决策。这正是 POC `connectionToken` 的同类保护。
- **同步有单调 revision**:`state-full` 的 `revision <= lastReceivedMembersRevision` 直接忽略,防重放/乱序。
- **纵深防御**:方向与角色在 parser 里检查过,应用处再查一次。
- **失败大声**:非法载荷或 `applyAuthoritativeSync` 被 skip,都直接 `handlePeerLoss` 断连,不静默吞。
- **资源清理完整**:`registerResource` 清定时器、拒未决命令、关 session、退订、dispose channel;Kotlin `shutdown()` 关心跳线程 + 关 peer + stop。
- **角色占位**:Kotlin `onOpen` 在已有活跃 peer 时发 `hello-rejected` 再以 `PolicyViolation` 关闭;TS 侧 hello 还额外校验 MASTER↔SLAVE 与 `isExpectedPeer` 的 nodeId。
- **端口占用归一**:`BindException` → `TOPOLOGY_HOST_PORT_OCCUPIED`,且 `retryable = false`(占用重试无意义,判断正确)。
- **跨机命令有上游超时**:`createCommandPeerDispatcher.ts:126-134` 用 `definition.timeoutMs` 做 `Promise.race`,故 `pendingPeerCommands` 不会让调用方永挂。

### 3.2 M-3 `lastPongAt` 跨线程读写未同步 —— 相对 POC 的退步

`TerminalTopologyServer.kt`:

- `onPong` / `onOpen` 在 `synchronized(peerLock)` 内写 `lastPongAt`;
- 心跳 lambda 里 `if (now - lastPongAt > config.heartbeatTimeoutMs)` 是**锁外读**(该处的 `synchronized(peerLock)` 只包了取 `peer`);
- 字段**不是 `@Volatile`**。

心跳跑在独立的 `ScheduledExecutorService` 线程,与 WS 回调线程不同。JVM 下这是可见性隐患:心跳线程可能读到陈旧的 `lastPongAt`,导致**误判超时踢掉健康连接**,或**漏判超时让死连接长期不被回收**。

**POC 在同一位置做对了**:`TopologyHostV3Server.kt` 有 3 个 `@Volatile` 字段,`TopologyHostV3WebSocket.kt` 既有 `@Volatile` 也有 `synchronized(out)` 保护写出。

**最小修复**:`@Volatile private var lastPongAt`,或心跳内改为在 `peerLock` 中一并读取 `peer` 与 `lastPongAt`。

### 3.3 M-4 `hostAddress` 只在构造时解析一次,IP 变化后对外播报陈旧地址

```
private val hostAddress: String = findHostAddress()
```

`address()` 返回的 `httpBaseUrl` / `wsUrl` 全部基于它。设备切换 Wi-Fi、DHCP 续租或热点重连后 IP 变化,宿主仍报旧 IP;副机据此写入的 `masterLocator` 指向一个不存在的地址,而重连逻辑会**永不放弃地重试一个错误地址**(D-17 不设放弃条件)。

⚠️ 两条设计约束在此叠加放大后果:地址一次性解析 + 永不放弃重连。

**最小修复**:`address()` 每次调用时解析(成本很低,仅在 `getStatus` 路径),或在网络变化广播上刷新并通过 `onTopologyConnection` 事件让 JS 侧更新 locator。

### 3.4 S-4 64KB 上限按"字符数"而非字节数计,两侧同错

- TS:`raw.length > topologyMaxFrameBytes`(`topologyMaxFrameBytes = 64 * 1024`)
- Kotlin:`if (raw.length > 64 * 1024)`

`String.length` 在两端都是 UTF-16 码元数。含中日韩或 emoji 的载荷,实际字节数可达上限的 2–4 倍。常量命名为 `...Bytes` 而实际按字符裁剪,属命名与语义不符;上限本身仍然存在,所以是"松了",不是"没有"。

**最小修复**:改名为 `topologyMaxFrameChars`,或两端统一按 UTF-8 字节长度判断。

### 3.5 M-5 依赖已确认停止维护,且带未修复 CVE —— 与 DR-01 的"受维护"门直接冲突

三个 gradle 均声明 `org.nanohttpd:nanohttpd-websocket:2.3.1`(`sample-terminal`、`sample-wallpaper-terminal`、`assembly/base/android` 各一处)。

**已联网核实的一手事实(2026-09-18)**:

- **Maven Central** 上 `org.nanohttpd:nanohttpd-websocket` 仅有三个版本:2.2.0(2015-11-15)、2.3.0(2016-02-22)、**2.3.1(2016-08-12)**。`2.3.1` 是最新版,距今约十年。
- **GitHub 仓库最后一次提交:2019-07-03**(经 GitHub API 取得),距今约七年;当前 **162 个未关闭 issue、39 个未合并 PR**。README 至今仍写着 "The next release will come soon" —— 这句话本身已存在十年。
- **Snyk 对 CVE-2022-21230 的结论原文**:"There is no fixed version for org.nanohttpd:nanohttpd... no patches are available. **The maintainers have been unresponsive. It may be appropriate to consider this project unmaintained at this point.**"

⇒ 详设 DR-01 原文要求"必须确认一个 Android 兼容、**受维护的** server 依赖",并把它列为 CP-0 的红线。**该条件不成立**:这不是"版本旧",是上游已停止维护、且官方明确"无可用补丁"。CP-0 要么没核维护状态,要么核了仍放行 —— 两种情况都需要交代。

**CVE 适用性(分开说,不混为一谈)**:

- **CVE-2020-13697**(`RouterNanoHTTPD.GeneralHandler` 的反射型 XSS,影响 "through 2.3.1")—— TER 只 import `NanoHTTPD` 与 `NanoWSD`,自行重写 `serve()`,**未使用 `RouterNanoHTTPD`** ⇒ **判定为不适用**。
- **CVE-2022-21230**(请求体 >1024 字节时写入权限不安全的临时文件,**无修复版本**)—— 机制上取决于 NanoHTTPD 是否在调用 `serve()` **之前**解析请求体。若是,则任何人向该端口 POST 一个大 body,即可在 TER 的 `serve()` 拒绝它之前触发。⚠️ **该顺序我未能核实**(上游源码 URL 两次 404,经 Dexter 指示停止深挖);Android 的 `java.io.tmpdir` 为应用私有目录,会显著削弱"同机其他用户可读"的影响面。**结论:机制可能可达,影响面在 Android 上被沙箱缓解,未定论。**

⚠️ 放大因素:该组件**对外监听网络端口**,且按〔信任边界裁定〕**不做认证**——任何同网段设备都能连上。上游无维护意味着未来出现新漏洞时**没有补丁可打**。

**最小处置(三选一,需 Dexter 裁定)**:① 更换为受维护的 Android 兼容 server 依赖(仍禁止手写协议);② 保留 NanoHTTPD 但在 `HANDOFF.md` 显式登记"上游停更 + 无补丁"风险,并明确由谁在出现 CVE 时负责;③ 若判定 CVE-2022-21230 不可达,需给出该判定的源码依据后再按 ② 登记。

### 3.6 N-4 两个集合没有 TTL,长会话下只增不减

- `cancelledRemoteCommands`:只在对应命令 settle 时 `delete`。若取消到达时命令**从未收到**或**已经结束**,该 id 永久留存。
- `pendingPeerCommands`:上游超时后调用方已解脱,但 map 条目要等迟到结果或 `handlePeerLoss` 才清除。

两者都只在断连时被整体清空,而 D-17 要求"永不放弃重连"——长期在线的会话不会有这个清空时机。增长很慢,**不构成当前缺陷**,但属无界结构。

**最小修复**:给两者加上以 `wireId`/时间戳为界的容量或 TTL 上限。

## 4. 与 POC 的逐项对照

### 4.1 TER 更好的

| 维度 | TER | POC |
|---|---|---|
| 原生协议实现 | NanoWSD/NanoHTTPD 真库,服务端 230 行 | **手写** WS 握手(SHA-1+Base64)与 HTTP 解析,7 文件 1221 行 |
| 线上帧校验 | `keysAreExactly` 多/少字段全拒、深度上限、封闭错误码、白名单写进 parser | 逐字段 ad-hoc 判断,无统一严格度 |
| 范围纪律 | 无 demo 切片、无扫码路径 | 含 demo 切片/命令与 `sharePayload` 259 行 |
| 对端模型 | 单 peer + 单锁,语义与"一主一副"一致 | `ConcurrentHashMap` 多连接管理,超出实际需要 |
| 发送侧自证 | `serialize` 后自 parse 校验 | 无 |
| 同步防重放 | `revision` 单调 + 方向二次校验 | 依赖 `updatedAt` LWW 对账,更复杂 |

### 4.2 POC 更好的

| 维度 | POC | TER |
|---|---|---|
| **内存可见性** | `Server.kt` 3 个 `@Volatile` + `WebSocket.kt` 的 `@Volatile`/`synchronized(out)` | `lastPongAt` 非 volatile 且锁外读(**M-3**) |
| **传输层通用性** | `transport-runtime` 2344 行,含 HTTP/WS 运行时、server catalog、socket profile、地址候选、生命周期控制 | `transport` 178 行,仅 identity client + wire session;端口写死在 URL 模板;`contracts` 的四个传输配置契约至今零消费方 |

⚠️ 4.2 第二行与裁决⑩("按通用形状建,但不为证明通用制造第二个消费方")的张力,已在 IMPLEMENTATION 评审中记为 M-1,此处不重复计数。

## 5. 汇总

| 轴 | 级别 | 条目 |
|---|---|---|
| 高效 | M | M-1 已配对主机上每次 state 变化全量序列化 members |
| 高效 | M | M-2 每帧发送做"序列化 + 再解析"自检,大帧上三趟处理 |
| 健壮 | M | M-3 `lastPongAt` 跨线程未同步(相对 POC 的退步) |
| 健壮 | M | M-4 `hostAddress` 一次性解析,IP 变化后播报陈旧地址 |
| 简单 | S | S-1 两套 `isJsonValue`,跨机载荷路径用的是弱版本 |
| 简单 | S | S-2 `topologyPeerWsUrl` / `isRecord` 重复;`hostStatusValue` 与契约 parser 风格不一 |
| 简单 | S | S-3 端口 43172 有 7 个落点(含用户文案) |
| 健壮 | S | S-4 64KB 上限按字符数而非字节数,两端同错 |
| 健壮 | **M** | **M-5 NanoHTTPD 2.3.1 上游已停更(最后提交 2019-07-03)、带无修复 CVE,与 DR-01 的"受维护"门冲突** |
| 简单 | N | N-1 646 行模块 17 个可变闭包变量 |
| 简单 | N | N-2 selector 不读 root |
| 高效 | N | N-3 起宿主路径两次 `getStatus`(观察,非缺陷) |
| 健壮 | N | N-4 两个集合无 TTL |

**M/S/N = 5/4/4**

## 6. 本轮读过与未读

**已通读**:`topologyWire.ts`(188)、`evaluateTopologyOperation.ts`(73)、`resolveCommandTarget.ts`(39)、`actors.ts`(459)、`createTopologyModule.ts`(646)、`createTopologyIdentityClient.ts`(40)、`createTopologySession.ts`(46)、`TerminalTopologyServer.kt`(230)、`TopologySection.tsx` 前 90 行;POC 的 `TopologyHostV3Service.kt`、`hostLifecycleActor.ts`、`eligibility.ts`、`configState.ts`、`runtimeDerivation.ts`、`topology-runtime-v3/createModule.ts`。

**未读**:`createTopologyAdminCapability.ts`(127)、`TerminalTopologyHostRegistry.kt`(202,只按关键词检索)、`TerminalTopologyHostModule.kt`(66)、`TerminalAppControlModule.kt`(37)、`topology/test/topology.test.ts`、member-desk 的 12 个改造点、`run-dual-device.mjs`(1831,只看结构)、POC 的 `connectionController.ts`(667)与 `transport-runtime` 全部。

**未做**:未运行任何构建、测试、静态分析或设备动作;**NanoHTTPD 的维护状态与 CVE 已联网核实**(Maven Central、GitHub API、Snyk),但 CVE-2022-21230 在 TER 路径上的可达性未核实(上游源码两次 404 后按指示停止);性能结论(§2)来自代码路径推演,**没有实测数据**。

## 7. 授权边界

本评审只读,不授权修改源码、测试、脚本、依赖或构建产物。本文是代码质量意见,**不构成 implementation acceptance、release PASS 或产品验收 PASS**。

# TER 双机拓扑 · 基建加固 · 需求分析

- 作者:Claude｜日期:2026-09-18
- 输入正本:`doc/review/platform/2026-09-18-ter-dual-machine-topology-code-quality-review-claude.md`(代码质量评审,M/S/N=5/4/4)
- 追加裁定:Dexter 2026-09-18 会话(§0.2)
- ⚠️ **评审性质声明**:本稿由作者会话自审数轮,**非独立盲审**,不满足 `REVIEW_TARGET=DESIGN` 的治理形式要求(Dexter 2026-09-18 明示"不用盲审了,你自己 review 几轮")。如需正式收口,仍须补一轮独立盲审。

## 0. 方向

### 0.1 这批要解决什么

**对双机拓扑基建做加固。** 两件事:

1. **代码质量评审的 13 条 finding**(健壮 / 高效 / 简单三轴)。
2. **基建不得把业务上限写死** —— 今天传输层的帧上限静默变成了一条**业务天花板**(量级见 §5.1 实测,强依赖数据分布),而且越限的表现是永久死循环。

sample 侧若有调整,只会是基建要求的下游,不是本批的目的。

### 0.2 Dexter 裁定(2026-09-18,原话)

| 裁定 | 落点 |
|---|---|
| "那不换了"、"成本没关系。继续用" | 不换 HTTP/WS 依赖,NanoHTTPD 保留,走 HANDOFF 登记(§2、R-1) |
| "我认为基建应该支持大数据,就像 TCP 协议一样,不会限制用户不能下载超过 1GB 的电影" | 阶段 2 的方向 |
| "我要的是健壮的基建能力,可以整个 slice 同步,但**压缩、分片必须要有**" | R-8 / R-9 / R-10 |
| "一个 slice 的某个数据变化了,可以这个 slice 里的数据都同步" | INV-4 的精确含义(§0.4) |
| "单机双屏的重启和双屏恢复,不是拓扑基建,但也是基建的一部分,**必须保障正常**" | R-4 |
| "transport,本次可以仅仅满足拓扑通讯" | R-5 |

### 0.3 ⚠️ 输入正本有四条事实已过期(本稿据当前树实测修正)

前几版最大的错误是**沿用输入正本的行号而未回源复核**。当前工作树实测:

| 输入正本所述 | 当前真值 | 处置 |
|---|---|---|
| S-3 端口 43172 有 7 个落点 | production **仅 1 处**(`contracts/topology-transport.config.json:2`),`DEFAULT_PORT` 已删,其余 20 处全在测试夹具 | **S-3 作废,本批无动作** |
| S-2 含"`isRecord` 在 `actors.ts`/`createTopologyModule.ts` 各一份" | `actors.ts` **无** `isRecord`;两份在 `createTopologyModule.ts:63` 与 `contracts/topologyWire.ts:18`(跨包),全仓另有 7 份 | **该半条删除**(R-13) |
| S-4 一个判定点、"两端同错"暗示两端不一致 | 判定点有 **三个**(`:87` 接收、`:161` identity、`:185` 发送),Kotlin `:177` 一处;且两端**今天口径一致**(都是 UTF-16 码元) | 并入阶段 2(R-10) |
| N-4 "两者只在断连时整体清空" | `pendingPeerCommands` 确在 `:195` 清空;`cancelledRemoteCommands` **全文无 `clear`**,连断连也不清 | R-14 分别陈述 |

⚠️ **Codex 在本稿成文期间做过 bug 修复**,改动了 `createTopologyModule.ts`、`actors.ts`、`TopologySection.tsx`、`evaluateTopologyOperation.ts`、`TerminalTopologyHostRegistry.kt`、`transport/*`、`topology.ts`(slice)、`nativeTopology.ts`。本稿全部行号断言与语义锚点已对改动后的树逐条重验:**13 条 finding 无一被该次修复关闭**(`@Volatile` 仍为 0、`hostAddress` 仍是构造期 `val`、`cancelledRemoteCommands.clear` 仍为 0、`subscribeState` 仍无条件调 `sendMembersSnapshot`、transport 三个新件包外引用仍为 0)。**但树仍在动,实施前所有行号须再回源复核一次。**

### 0.4 "整片同步"的精确含义

Dexter 原话:"一个 slice 的某个数据变化了,可以这个 slice 里的数据都同步"。

- ✅ 片内任一数据变化 ⇒ **该片整体下行**,不要求片内 key 粒度增量、不要求业务侧把 slice 拆细。
- ❌ **不是**指"一个 slice 变化就同步所有 slice" —— 那既不是要求,今天也做不到(`topologyWire.ts:143` 协议层写死只允许 `members` 一个 sliceName 过线)。
- ⚠️ **分片(R-8)与同步粒度无关** —— 分片切的是**字节流**,不是业务数据;重组后交给业务层的仍是完整的一整片。两者不得混为一谈,否则详设很可能把"分片"做成"片内增量同步",既违背本裁定,又会破坏 `revision` 单调与 `applyAuthoritativeSync` 全量替换的语义。

## 1. 13 条 finding + 5 条追加裁定的处置总表

| 来源 | 轴 | 级 | 需求 | 阶段 | 判据 |
|---|---|---|---|---|---|
| M-5 NanoHTTPD 上游停更、DR-01"受维护"门不满足 | 健壮 | M | **R-1** HANDOFF 登记 | 1 | U-1 |
| M-3 `lastPongAt` 跨线程未同步 | 健壮 | M | **R-2** | 1 | U-2 |
| M-4 `hostAddress` 一次性解析 | 健壮 | M | **R-3** | 1 | U-3 |
| 裁定:单机双屏必须保障正常 | 基建 | — | **R-4** | 1 | U-4 |
| 裁定:transport 只满足拓扑通讯(触发上游 R-7 的收窄条款) | 基建 | — | **R-5** | 1 | U-5 |
| N-2 selector 不读 root | 简单 | N | **R-6** | 1 | U-6 |
| N-3 起宿主路径两次 `getStatus` | 高效 | N | **R-7** | 1 | U-7 |
| 裁定:分片必须要有 | 基建 | — | **R-8** | 2 | U-8 |
| 裁定:压缩必须要有 | 基建 | — | **R-9** | 2 | U-9 |
| **S-4** 帧上限名实不符 + 触顶永久死循环 | 健壮 | S | **R-10** | 2 | U-10 |
| — (作者裁定) | 基建 | — | **R-16** 副机侧存活检测 | 2 | U-18 |
| **M-2** 每帧"序列化 + 再解析"自检 | 高效 | M | **R-10**(同一条管道重写,一并处置) | 2 | U-11 |
| M-1 已配对主机每次 state 变化全量序列化 members | 高效 | M | **R-11** | 3 | U-13 |
| S-1 两套 `isJsonValue` | 简单 | S | **R-12** | 3 | U-14 |
| S-2 `topologyPeerWsUrl` 重复;`hostStatusValue` 手写校验 | 简单 | S | **R-13** | 3 | U-15 |
| N-4 两个集合无界 | 健壮 | N | **R-14** | 3 | U-16 |
| N-1 646 行模块 17 个可变闭包变量 | 简单 | N | **R-15** | 3 | U-17 |
| S-3 端口 43172 多落点 | 简单 | S | **作废** —— 已在更早一轮整改中消除 | — | — |

**13 条 finding(12 条有需求 + 1 条作废)+ 5 条追加裁定 + 1 条作者裁定(R-16)→ 16 条需求 → 18 条判据。无遗漏、无孤儿。**

⚠️ 判据比需求多两条,因为两条判据服务的是**不变量**而非单条需求:**U-11** 服务 R-10 的自检重设计与 INV-3(接收侧强校验不得削弱),**U-12** 服务 INV-2(业务层不感知)与 INV-4(整片同步语义不变)。

⚠️ **S-4 与 M-2 合并进 R-10 的理由**:两者都落在 `serializeTopologyWireMessage` 这同一个六行函数上(`:185` 长度判定、`:186` 自检),而阶段 2 会整体重写该发送管道。**先改名、先优化自检都是白做**,还会让判据的红变异失去落点。

## 2. M-5 的处置:不换库,按 HANDOFF 登记

### 2.1 两个 CVE 都已判定(源码依据)

**CVE-2020-13697**(`RouterNanoHTTPD` 反射型 XSS)—— **不适用**。`RouterNanoHTTPD` 属 `nanohttpd-nanolets` artifact,三处 gradle 只声明 `nanohttpd-websocket`,`websocket/pom.xml` 只依赖 core `nanohttpd` ⇒ **不在 classpath 上**;全仓 `fi.iki.elonen` 仅出现在 `TerminalTopologyServer.kt`,无该 import。

**CVE-2022-21230**(请求体达 1024 字节即写入权限不安全的临时文件,无修复版本)—— **不可达**,拦住它的是**两道闸**:

1. `TerminalTopologyServer.kt:102` 只把 **URI 等于 `${basePath}/ws` 且 method 为 GET** 的请求交给 `super.serve(session)`,其余一律自答 405/404(`:105-110`)。
2. 上游默认 `serve(IHTTPSession)` 只对 **PUT/POST** 调 `parseBody`;`getTmpBucket()` 的唯一调用者是 `parseBody`,`parseBody` 在 core 内唯一调用点即该默认实现;`HTTPSession.execute()` 无其他触达路径。TER 全文 230 行无 `parseBody`。

⚠️ **不能写成"`NanoWSD.serve()` 不读请求体"** —— 它在非升级分支会 `serveHttp(session)` → `super.serve(session)`,即落回默认实现。结论不变,理由必须按上面两道闸写。
⚠️ **这两道闸都很脆**:任一放宽(把非 `/ws` 分支也交给 `super.serve()`,或给某端点放行 POST),CVE 立即重新可达。**该脆弱性必须写进 R-1 的 `deferredReason`。**
⚠️ 触发阈值以上游源码为准:`MEMORY_STORE_LIMIT = 1024`,判定为 `if (size < MEMORY_STORE_LIMIT)` 留内存 ⇒ 触发临时文件的是 **≥1024**,不是 NVD 文案的 ">1024"。

### 2.2 仍然要登记的理由

当前**无可达漏洞**,但上游确已停更(最新发布 2.3.1 / 2016-08-12;default branch HEAD 最后提交 2019-07-03;201 个未关闭 issue+PR;Snyk 对 CVE-2022-21230 明载 "no patches are available. The maintainers have been unresponsive…"),**将来出现新漏洞时没有补丁通道**。

⚠️ **登记 ≠ 门已关闭**。详设 DR-01(`doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md`)把"Android 兼容、**受维护的** server 依赖"列为 CP-0 红线。本裁定**不满足该门**,属一次被记录的偏离,不得写成"已评估通过"。

⚠️ **裁定理由不是成本**。Dexter 作出裁定前已获知换 Ktor 的全部代价(依赖体积约 37×、需先把终端侧 Kotlin 从 2.0.21 升到 2.3.x、Ktor 内建关闭的 close reason 硬编码因而无法保持 `TOPOLOGY_TIMEOUT`),并明确表示成本不是考量。⇒ **将来"有预算了"不构成重启换库的理由**;重启的唯一触发是 R-1 登记条目里的 `activationTrigger`。

## 3. 阶段划分与不变量

本批分三阶段顺序执行。**不得并行** —— 阶段 2 重写的发送管道正是阶段 3 部分需求的落点。

| 阶段 | 主题 | 不变量 |
|---|---|---|
| **1** | 独立止血(不碰 wire 发送路径,也不碰 `createTopologyModule`) | **INV-1 对外可观察行为零变化** |
| **2** | 传输容量能力(压缩 + 分片 + 触顶安全失败) | **INV-2/3/4/5**,协议**必然变更** |
| **3** | `createTopologyModule` 内的质量项 + 模块拆分 | **INV-1 对外可观察行为零变化** |

**INV-1 对外**契约**零变化 + 行为修正须在册**(阶段 1 与阶段 3)

⚠️ **前一稿写成"对外可观察行为零变化,无例外",与 R-2/R-3 自相矛盾**(Codex M-3,已坐实):R-3 要求地址按需解析,IP 变化时**必然**改变 `/status` 的响应体,而 U-3 正是要验证这个变化。本版更正为契约级不变 + 变更登记制。

**不得变**(契约面):线上帧字段集与形状、close code 与 reason 的**取值域**、原生事件名与 payload 形状、错误码 union 的既有成员、`stats()` 字段集、`start()` 幂等分支、bind 失败分类与 `retryable`、HTTP 响应码与 Content-Type、UI 可见文案、`TopologyHostPort` 契约、`getOperationEligibility` 的裁决规则。

**允许变,且必须逐条在册**:

| # | 行为变化 | 出自 | 阶段 |
|---|---|---|---|
| C-1 | 地址解析时机:构造期一次 → 每次查询 ⇒ IP 变化后 `/status` 响应体随之变化 | R-3 | 1 |
| C-2 | `lastPongAt` 的读写同步边界 ⇒ 竞态窗口下的心跳判定结果变化 | R-2 | 1 |
| C-3 | 大帧的压缩、分片与重组 ⇒ 线上字节形态变化 | R-8/R-9 | 2 |
| C-4 | 错误码 union **新增**触顶/重组失败成员(既有成员不变) | R-10 | 2 |
| C-5 | 触顶时的终态与诊断 ⇒ 用户可见文案新增 | R-10 | 2 |

⚠️ **表外的任何行为变化都是本批的缺陷。** 实施方发现需要第六条,须先改本表再动手。

**INV-2 分层不被打破**(阶段 2):业务侧(`createTopologyModule` 的同步调用点)**不感知**压缩与分片 —— 它仍然只说"同步这个切片"。切分/重组/压缩/解压全部封装在 wire 层之下。

**INV-3 接收侧强校验不得削弱**(全批):解压与重组之后,仍须经过与今天同等严格的 `parseTopologyWireMessage`(`keysAreExactly` 多/少字段全拒、深度上限、封闭错误码、`sliceName`/`direction` 写死)。**压缩不得成为绕过校验的通道。**

**INV-4 整片同步语义不变**(全批):见 §0.4。不引入片内增量、不引入 key 粒度、不改同步白名单。

**INV-5 接收侧内存必须有界**(阶段 2):分片重组是典型的内存放大面。未完成的分片集必须有容量与时限上限,触顶时按 R-10 安全失败,**不得 OOM、不得静默丢弃后当作成功**。

**INV-6 不动产品语义与裁定**(全批):四条裁定原样成立;不引入认证、不支持多副机。

**INV-7 不借机扩范围**(全批):评审没记、裁定没提的东西不许顺手改。⚠️ **本批有且只有一条具名例外:R-16**(副机侧存活检测),它是作者在核 R-5 时发现的缺口,据 Dexter"按最优方案定"的授权立项,理由与边界写在 R-16 本体。**除此之外任何扩范围都是缺陷。**

## 4. 阶段 1 —— 独立止血

**R-1 把上游正本裁进 HANDOFF 的**全部**条目补齐**

`HANDOFF.md` 当前 10 行,**上游需求正本点名要登记的四条一条都不在**:

| 上游出处 | 条目 |
|---|---|
| `:463`、`:572` | 认证 / 配对确认 |
| `:441`、`:577` | 版本协商(两机版本不一致时行为未定义) |
| `:331` | 双屏机将来用同进程能力时,JS 重启会连带重启主屏 |
| `:332` | 双屏机重启后副屏能否自行回来,`UNVERIFIED`,属仓外行为 |

加上本批的 NanoHTTPD 停更,共 **五条**,按该文件既有七列格式补齐。

- `activationTrigger` 必须是**可验收的 exact token**(该表明写"激活 token 只允许上表 exact 值"),不得用 `WHEN_NEEDED` 这类自由文本。
- NanoHTTPD 条目的 `deferredReason` 须写明 §2.1 的两条 CVE 判定结论、**两道闸的具体形态**与**其脆弱性**,使后续读者不必重做考证、且知道什么改动会让结论失效。
- ⚠️ **措辞必须条件化**(Codex N-3):只能写成"**在当前 NanoHTTPD 2.3.1、当前 serve 路由与当前 HTTP 方法限制下,该 CVE 的 body-parse 路径静态不可达**",**不得**写成"已实测不存在漏洞"。若将来放开 POST/PUT 或扩大 `super.serve` 的委托范围,须重新评估。

**产出物是文档行,不是代码改动。**

**R-2 `lastPongAt` 的跨线程访问必须安全**

- 现状:`TerminalTopologyServer.kt:25` 无 `@Volatile`(全文无任何 `@Volatile`),`:47` 心跳线程**锁外读**(`:44` 的 `synchronized` 只包了取 `peer`),`:150`/`:193` 锁内写。心跳跑在独立 `ScheduledExecutorService` 线程。
- 后果:可见性隐患 —— 误踢健康连接,或漏判超时让死连接长期不被回收。
- 要求:`@Volatile private var lastPongAt`,或把 `:47` 的读并入 `:44` 已有的 `synchronized(peerLock)`。**一处改动。**

**R-3 `address()` 每次调用时解析主机地址**

- 现状:`:27` `private val hostAddress: String = findHostAddress()`,构造期一次性解析;`:30`/`:33` 等全部基于它。
- 后果:换网或 DHCP 续租后 IP 变化,副机 `masterLocator` 指向死地址,而上游 D-17"永不放弃重连"会**无限重试一个错误地址**。两条约束叠加放大后果。
- 要求:改为按需解析(如 `get() = findHostAddress()`)。
- 成本:`address()` 的调用方只有 `TerminalTopologyHostRegistry.kt:60`、`:77`(start 路径)与 `:147`(getStatus 路径)三处,**不在每帧路径上**。**一处改动。**

**R-4 单机双屏的 JS 重启与副屏恢复必须实测**

- Dexter 原话:"单机双屏的重启和双屏恢复,不是拓扑基建,但也是基建的一部分,**必须保障正常**"。这比上游裁定的"记入 HANDOFF"(= 挂账不做)**强一档**。
- 上游 `:332` 原文标 `UNVERIFIED`,并明写副屏能否自行回来"**取决于 `ReactHostImpl.reload()` 对已注册 surface 的处理,属仓外行为**" ⇒ **静态看不出来,必须上设备实测**。
- 要求:在单机双屏机型上实测 JS 重启后主屏与副屏的实际行为。若副屏不能自行恢复,那是**要修的缺陷**,不是台账行 —— 修法进详设(D-3)。
- ⚠️ **修法范围不设默认边界**:实测尚未进行,缺陷是否存在、修它要动多少都是未知。若修法超出"在 `adapter/android/dual-screen` 内的局部改动",**须单独交 Dexter 裁定,不得静默吸收进本批**。
- ⚠️ 实测归实施方;作者会话只做静态核验,不跑设备。

**R-5 按上游 R-7 已写好的收窄条款执行 `transport`(不是删除)**

⚠️ **前一稿写成"这三个文件查不到授权来源、属无消费方自造,应删除",是错的**(Codex S-1,已由作者回源坐实):

- 实施计划 CP-2 的"预定落点"**逐个列着**这三个文件;步骤 3 明写"用 bounded retry controller、外部 cancellation token、attempt metrics、**heartbeat controller**、concurrency/**rate limiter** 和 **WS profile controller** 闭合 **R-7 的通用原语**"(见 `doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md` 的 CP-2 一节)。
- 上游 R-7(裁决⑩)记录了 Dexter 的长期指示:transport"**不是只为双机拓扑准备的,后续也会用来连接远端服务器,而且后续要支持多个 IP 切换、多个 workspace**"。
- Codex 当时已以 S-7 提过"过度设计",作者**部分不采纳**并写下理由。

⇒ 它们是**已批准的 CP-2 交付物**,不是未授权铺路。作者的检索没穷举(那份计划与上游稿都在仓内),属方法错误。

**但上游 R-7 已经为今天这个裁定写好了执行条款**,原文:

> 若他改判为"本期收窄",则保留 bounded retry/backoff、取消 token、消息边界与 `connectionToken`,其余(多地址 failover、`replaceServers`、粘滞、通用限流)降为单 locator 的最小传输,**U-15 随之作废**。

**Dexter 2026-09-18 的"transport,本次可以仅仅满足拓扑通讯"即该条款的触发。** 本条据此逐项执行:

| 能力 | 上游条款 | 落点(行数) | 处置 |
|---|---|---|---|
| bounded retry / backoff / 取消 token | **保留** | `createTransportRetryController`(75) | 保留 |
| 消息边界、`connectionToken` | **保留** | `createTransportWebSocketController` 内该部分 | 保留 |
| 多地址 failover、粘滞首选地址 | 条款写"降为单 locator" | `resolveTransportServerAddresses`(85) | ⚠️ **不动** —— 理由见下 |
| `replaceServers`、WS profile 注册 | **降为单 locator** | `createTransportWebSocketController`(152) | **不接线**(代码保留,本期不新增消费方) |
| 通用并发/限流 | **降为单 locator** | `createTransportLimiter`(67) | **删除** |
| 心跳控制器 | ⚠️ 条款两侧都未点名 | `createTransportHeartbeat`(74) | **保留** —— 理由见下 |

- **`createTransportHeartbeat` 保留**(作者据 Dexter 2026-09-18"需要我定的你按最优方案定"裁定)。⚠️ **前稿说它是"第三份心跳实现"是错的**,回源后事实相反:

  | 件 | 层次 | 方向 | 现状 |
  |---|---|---|---|
  | Kotlin `startHeartbeat`(`TerminalTopologyServer.kt:40-56`) | **WebSocket 协议层** `ping(ByteArray(0))` | **服务端 → 副机**,单向 | 在跑;对端由 OkHttp 自动回 protocol pong,**JS 层看不见** |
  | wire 的 `type: 'ping'`/`'pong'`(`contracts/src/types/topology.ts:170`) | **应用层** | 双向 | ⚠️ **零生产发送方**;`createTopologyModule.ts:381-382` 只会*回复*一个永不到来的 ping,`:385` 忽略 pong ⇒ **半拉子协议面** |
  | `createTransportHeartbeat`(74) | 应用层控制器 | 可双向 | 未接线 |

  ⇒ 三者**不重复**:Kotlin 那份是协议层、服务端单向;wire ping/pong 是**只有协议没有控制器**的半边;`createTransportHeartbeat` 正是缺的那个控制器。

- ⚠️ **由此暴露一个真实缺口,本批决定处置(见 R-16)**:**副机侧没有任何存活检测**。它只对 `onclose`/`onerror` 反应,而网络分区(无 FIN)时 WS 不会关闭 ⇒ 副机抱着僵尸 socket、显示陈旧数据、**永远不知道要重连**,上游 D-17"永不放弃重连"在该场景下落空。主机方向有保护(10s ping / 30s 超时),**副机方向没有**。
  - ⇒ 删掉 `createTransportHeartbeat` 等于删掉该缺口唯一的候选实现,将来还要重建。**这是保留它的决定性理由**,而不是"因为它已被批准"。
  - ⇒ **本批接线,立为 R-16**(作者据 Dexter 2026-09-18"按最优方案定"裁定)。理由:回复那半边**已经存在**(`createTopologyModule.ts:381-382` 收到 wire ping 即回 pong),阶段 2 本来就要重写 session 层,而该缺口**直接使上游 D-17 在静默分区下落空** —— 本批的名义就是基建加固。边界与红线见 R-16 与 D-14。
- **上游 U-15 随之作废**,须在本批显式记录,并说明作废理由指向本条。
- ⚠️ 收窄不是只删源文件:`index.ts` 导出、`terminal-invariants.json` 登记、README 描述与测试**同属公共面**,须一并维护。⇒ 前稿"包外引用 0"的测量只扫了 `.ts`/`.tsx` 的 import,**未含这三处**,该表述须按此修正(Codex S-1)。
- ⚠️ **"降为单 locator"的边界须重新界定**(Codex 二轮 S-2)。上游条款是**前瞻性写的**,当时假设这些通用件都没有消费方;回源后事实不同:
  - `resolveTransportServerAddresses:64` 返回**多个**候选地址,`createTopologyIdentityClient:51` **确实在遍历并 failover** ⇒ 它**已被消费、已在跑、有测试**,不是未经证明的通用性。
  - 当前默认配置只有一个地址(`topologyTransportConfig.ts:30`),所以**今天的运行行为不冲突**;但若注入两个地址,现有 identity client 会成功 failover —— 真把 selector 收窄就会**改变这个行为**,与 U-5"identity client 不受影响"直接冲突。
  - ⇒ **作者裁定(据 Dexter 2026-09-18"按最优方案定"):`resolveTransportServerAddresses` 与 `createTransportRetryController` 原样不动。** 收窄只作用于**尚未接线**的部分:删除 `createTransportLimiter`、不接线 `replaceServers` 与 WS profile 注册、本期不新增多地址配置。
  - **理由**:"仅满足拓扑通讯"应当靠**减去没用上的**达成,而不是**回退已经在用的**。改写一段被消费、有测试、在跑的代码去满足一句措辞,是制造回归风险换取零收益,正撞 `CLAUDE.md`"避免为了看起来更优雅而增加实际复杂度"。
  - ⚠️ **这是对上游条款字面的一次有据偏离**,须在详设中显式记录,不得默默执行。
- ⚠️ **旧 CP-2 计划必须同步**(Codex 二轮 S-2):该计划仍要求 `createTransportLimiter`、`replaceServers` 与完整 generic 原语。**不同步就会让实施方同时拿到两套相反指令。** 同步属详设首步,见 D-15。
- ⚠️ **收窄须可逆**:Dexter 的长期方向(多 IP、多 workspace、远端服务器)未变,只是本期不建 —— 保留 selector 正好使这条天然成立(D-12)。

**R-6 `factsSelector` 改用现成的 root selector**

- 现状 `TopologySection.tsx:57-60` `useMemo(() => (_root: StateRoot) => capability?.getSnapshot(), [capability])`,`_root` 在 `:58`,形参未用,数据来自捕获的 capability。
- 现成件:`selectTopologyFacts(state: StateRoot)` 在 `topology/src/selectors/selectTopologyFacts.ts:28`,已由 `topology/src/index.ts:10` 导出,`TopologySection.tsx:11` 已 import 同包;`createTopologyAdminCapability.ts:110` 的 `getSnapshot` 本身就是它。
- ⚠️ **不是"一处改动"**。`selectTopologyState.ts:11` 在切片缺失时**抛错**(`throw new Error('Missing topology slice: …')`),而 `selectTopologyFacts.ts:29` 第一行就无保护地调它;capability 是可选的(`adminSection.ts:12`、`consoleAssembly.tsx:414` 的 `?.`),`useUiStateSelector` 只在 `snapshot.root === undefined` 时跳过 selector。⇒ 直接替换会让"装了 admin-shell 拓扑分区但没装 topology 模块"的装配在订阅回调里**抛错**,而不是返回 `undefined` 走既有的 `TOPOLOGY_UNAVAILABLE` 分支。
- 当前两个 sample integration 都注入了(`sample-console/src/assembly/assembly.tsx:112`、`sample-wallpaper-console/src/assembly/assembly.tsx:95`),**出厂装配上是否可达 `UNVERIFIED`**;但需求层不得按"安全一行"下手。改法见 D-1。

**R-7 起宿主路径的两次 `getStatus` 保留并写下理由**

- 现状 `actors.ts:397` 与 `:440` 各一次,每次经 `:100` 的 `getStatus({timeoutMs: topologyCallTimeoutMs})`,5s 超时的原生 IPC。
- 评审定性为"**记为观察而非缺陷** ——'起完确认'本身是健壮性优点"。
- **本批结论:保留。** 须在起宿主分支写下一行理由注释。去掉需要实测支撑,而本批无性能实测能力(§8)。

## 5. 阶段 2 —— 传输容量能力

### 5.1 为什么这是基建问题而不是 sample 问题

**传输层的帧上限,静默变成了一条业务容量上限,而且越限时的表现是永久死循环。**

- 常量 `topologyWire.ts:12` `topologyMaxFrameBytes = 64 * 1024`,但四个判定点全用 `raw.length`(**UTF-16 码元**,不是字节):TS `:87` 接收、`:161` identity、`:185` 发送;Kotlin `:177`。
- 一条 `Member`(`sample-member-registry/src/types/types.ts:1`:`memberId`/`name`/`phone`/`age`/`registeredAt`)的实际大小**强依赖数据分布**。Codex 2026-09-18 用 Node 独立实测:

| 数据分布 | 570 条的 UTF-8 字节 | 是否超 64 KiB |
|---|---|---|
| 紧凑、重复、ASCII | 约 **65,127** | 勉强不超 |
| 真实长度 ID + 中文 + 变化字段 | 约 **75,957** | **已超** |

⇒ ⚠️ **"约 570 会员"只是紧凑 ASCII 下的乐观估算,真实分布下更早触顶。该数字不得冻结进 HANDOFF、容量配置或验收判据**(Codex N-1)。

- ⚠️ **压缩比同样不稳定**(Codex N-2 实测):高度重复数据 deflate 约 **19–40 倍**,真实变化数据只有约 **2.36–2.73 倍**。⇒ **前稿"5–10 倍"是错的,不得写成承诺。** 这反过来加强了"分片必须要有"的结论 —— 压缩买不到数量级的余量。
- ⚠️ 触顶后的失败链(逐环打开源码读过):
  1. `createTopologyModule.ts:226` `createFullSyncPayload` → `:232` `sendMessage` → `session.send`
  2. `createTopologySession.ts:23-27`(`send` 起于 `:21`)`try { input.write(serializeTopologyWireMessage(message)) } catch { input.onProtocolError(...) }` —— **超限的 throw 被吞成协议错误**
  3. `createTopologyModule.ts:495-498` `onProtocolError` → `handlePeerLoss`
  4. `:282` `mode !== 'SLAVE'` ⇒ **主机自己不重连**
  5. 副机按上游 D-17 无限重连(`reconnectAttempt` 无上限、无放弃条件)
  6. 重连后 `:253` `markPeerAccepted` 调 `sendMembersSnapshot(context, **force = true**)` —— **绕过指纹检查**,同一份超限载荷再发一次

  ⇒ **永久的"连上—发失败—断开—重连"循环。** 且 `:231` `membersSyncRevision += 1` 在发送**之前**执行,每失败一次就涨一次;抛出的 `'topology frame exceeds maximum size'` 不在封闭错误码 union 内,用户拿不到可读原因。

⚠️ **诚实的边界**:TCP 也不是无限 —— 它有窗口、有流控,连接照样会失败。本阶段要的不是"没有上限",而是:**上限是传输层的、可配置的、远高于业务现实的,并且触顶时安全、可诊断、不循环。**

### 5.2 两端形态不对称(决定改动落点)

- **主机(server)**:Kotlin,`NanoWSD`(`TerminalTopologyServer.kt`)
- **副机(client)**:**JavaScript** —— `assembly/base/android/src/foundations/nativeTopology.ts:204-206` 读 `globalThis.WebSocket`(RN 的 JS WebSocket),**没有原生 socket**
- `state-full` **只走 master → slave**(`topologyWire.ts:143` 写死 `direction === 'master-to-slave'`)

⇒ **压缩与分片可以整个做在 TS 的 wire 层**:主机 JS 切分/压缩 → 原生 `sendFrame` 当哑管道透传 → 副机 JS 重组/解压。**Kotlin 不需要改**,它那个 `raw.length > 64*1024` 的每帧检查正好变成"单分片上限",语义反而对了。

⚠️ **唯一会逼 Kotlin 改动的分支**:压缩产出是二进制,而 wire 只接受 Text 帧(`TerminalTopologyServer.kt:167-170` 非 Text 即 `TOPOLOGY_PROTOCOL_REJECTED`)。走 base64 则 Kotlin 不动;放开二进制帧则 Kotlin 要改(D-5)。

### 5.3 需求

**R-8 分片传输**

- `state-full` 帧超过单帧上限时,由 wire 层自动切分为多个分片发送,接收侧重组后再交给业务层。
- 业务上限不再由单帧上限决定;新的容量上限由**接收侧重组缓冲的显式配置**决定(D-8),该值须**远高于业务现实**并写进配置而非散落常量。
- 分片集必须:有序或可重排、可检测缺失、可检测超时、**半套分片绝不 apply**。
- ⚠️ `revision` 单调与防重放语义必须在分片下继续成立(D-7)。

**R-9 压缩传输**

- `state-full` 的载荷在发送前压缩、接收后解压。
- ⚠️ **压缩是容量的乘数,不是替代品** —— 它降低触发分片的频率,但不改变"必须有分片"这一条。两者都要。
- 小帧压缩是负收益,须裁定适用范围与阈值(D-6)。
- 压缩或解压失败必须按 R-10 安全失败,不得静默发送/接收未压缩内容而让对端困惑。

**R-10 上限重定义 + 触顶安全失败 + 发送侧自检重设计**(吸收 S-4 与 M-2)

- **上限重定义**(S-4):`topologyMaxFrameBytes` 重定义为"**单分片的 UTF-8 字节上限**",名实相符。⚠️ **只改 TS 侧三个判定点**(`:87`/`:161`/`:185`);**Kotlin `:177` 的 `raw.length` 不改**,它退化为一道更松的兜底 —— 因为 UTF-8 字节数恒 ≥ UTF-16 码元数,一个"≤64KB 字节"的分片必然"≤64K 码元",永远过得了 Kotlin 那一关。这与 §5.2 的"Kotlin 保持哑管道"一致,**不构成矛盾**。
- ⚠️ 不再需要"改名 vs 改口径"的取舍 —— 分片落地后按真实 wire 字节计量才有意义。
- **触顶安全失败**:无论触的是单分片上限、重组缓冲上限、还是压缩失败,**都不得进入"必然失败还无限重试"的循环**。必须:① 有终止态(不再对同一份必然失败的载荷重试);② 有**封闭 union 内**的错误码与可读文案;③ 不污染 `membersSyncRevision` 等单调量。
- ⚠️ **终态的粒度必须先定,否则与上游 D-17 正面冲突**(Codex M-2,已坐实)。上游 D-17 要求断线后**持续重连、永不放弃**,本条要求"不再重试同一失败载荷",两者相遇时:若终态被实现成**停掉整条 topology 重连** ⇒ 违反上游 D-17,而"没有重复重试"却是绿的;若每次重连都 `membersSyncRevision += 1` 再发同一份 ⇒ 违反本条。
- ⇒ **终态只能落在"该 payload / 该 slice"这一层,绝不能落在 session 或 peer 这一层。** 身份、心跳、连接恢复与其余 slice 必须继续正常工作。解除条件与失败期间的诊断见 D-13。
- **发送侧自检重设计**(M-2):`topologyWire.ts:186` 在 `stringify` 后再 `parseTopologyWireMessage` 自检,对大帧是重复深度遍历。新管道下须保留"发送侧自证协议合规"的意图,但不得对 `state-full` 的 payload 做深度重遍历。⚠️ **只动发送侧**,接收侧强校验不得削弱(INV-3)。
- ⚠️ `createTopologySession.ts:23-27` 把 throw 吞成协议错误的行为,正是 §5.1 链条的第 2 环,须一并重新设计。

**R-16 接线副机侧存活检测(应用层心跳)**

⚠️ **这条不回指任何 finding,也不出自 Dexter 的五条裁定**,是作者在核 R-5 时发现缺口后、据"按最优方案定"的授权立的。**INV-7 因此有一条具名例外,见 §3。**

- **缺口**(事实见 R-5 的三层对照表):副机对"主机静默失联"零检测。Kotlin 那份心跳是**服务端单向**的协议层 ping;wire 的 `ping`/`pong` 有类型但**零生产发送方**;副机只对 `onclose`/`onerror` 反应,而网络分区(无 FIN)时 WS 不会关闭 ⇒ 副机抱着僵尸 socket、显示陈旧数据、**永远不知道要重连**。
- **要求**:用 `createTransportHeartbeat` 接线副机侧应用层心跳 —— 定期发 wire `ping`,主机以既有的 `:381-382` 路径回 `pong`,超时则判定失联。取值与 Kotlin 侧一致(间隔 10s、超时 30s),由配置传入。
- ⚠️ **红线一:超时后走的是普通 peer-loss 与重连,不是 D-13 的 payload 终态。** 心跳超时属上游 D-17 的**正常路径**(连接断了就重连),与"某个载荷必然失败"完全是两回事。两者混淆会让副机因一次心跳抖动而永久停止同步。
- ⚠️ **红线二:在途的分片传输不得触发心跳超时。** 一次大切片的分片传输可能持续数秒,期间 pong 仍须正常往返;若实现让分片占满发送队列而饿死心跳,会造成**传大数据必断连**的自伤。
- ⚠️ **未验**:"OkHttp 自动回协议层 pong"属仓外运行时事实,仓内源码不能证明(Codex 二轮 S-3);本条**不依赖**该事实成立 —— 它走的是应用层 wire ping/pong,与协议层 ping 无关。

## 6. 阶段 3 —— `createTopologyModule` 内的质量项与拆分

**R-11 members 同步不得在每次 state 变化上构造全量载荷**

- 现状:`:608-609` `subscribeState` 每 tick 调 `sendMembersSnapshot`,后者 `:226` `createFullSyncPayload` + `:228` `JSON.stringify` 只为求指纹。热点落在**最忙的节点**(正在工作的已配对主机)。
- 要求:先做廉价判定(`state[membersSliceName]` 引用相等),仅在可能变化时才构造载荷;或只在 members 切片订阅上触发。
- ✅ **"引用相等可安全跳过"已核实**:`createFullSyncPayload` 只读 `store.getState()[slice.name]`(`state/src/foundations/createStateRuntime.ts:196-215`),RTK store 在切片未变时保留引用;`createStateStore.ts:42-47` 的 `APPLY_AUTHORITATIVE_SYNC` 分支虽每次重建 root 但保留各切片引用,且只在 SLAVE 跑,不影响 MASTER 热点。
- ⚠️ **但"收益多大"未核实**:仓内先例(`persistableSliceRefs`)在引用不同后仍要做字段级比对,即把"引用不同"当作**不确定**。收益由 U-13 实测,不得在需求层预判。
- ⚠️ **指纹必须算在未压缩载荷上**(D-9),否则阶段 2 的压缩会让指纹失效。
- ⚠️ **不得因此丢同步**:任何一次真实 members 变化仍必须下行。

**R-12 删除 `createTopologyModule` 内的弱 `isJsonValue`,改用 contracts 的强版本**

- 现状:`contracts/topologyWire.ts:21` 有深度上限 12、键长上限、有限数检查;`createTopologyModule.ts:66` 无深度上限、无键长检查。
- ⚠️ **本条不含行为增益,理由须据实收窄**:`topologyWire.ts:145` 的 `state-full` 分支**已经**以 `depth=0` 用强版本校验过 `value.value`,而 `readSyncStateDiff` 在 `:417` 之后才跑,弱版本只能看到已通过强校验的值(深度账:`value.value`(0)→`entries`(1)→candidate(2)→envelope(3)→`envelope.value`(4),强版本尚余 8 层)。⇒ 理由是"**同名两份定义、标准不一**",**不是**"跨机载荷用弱校验有安全缺口"。
- 要求:从 contracts 导出强版本,`readSyncStateDiff` 改用它,删除本地弱版本。

**R-13 消除 `topologyPeerWsUrl` 重复,原生 status 改走契约 parser**

- `topologyPeerWsUrl` 在 `actors.ts:128` 与 `createTopologyModule.ts:93` 各一份,函数体相同 → 合并到单一住址。
- `actors.ts:44-78` 约 35 行手写 `Reflect.get` 的 `hostStatusValue` → 改为与 `parseTopologyIdentityResponse` 同风格的契约 parser。**新 parser 对畸形 status 的拒绝行为不得弱于现状。**
- ⚠️ **归属必须先定(D-2)**:`TopologyHostStatus` 定义在 `platform-ports/src/types/topologyHost.ts:27`,而 `contracts/src/dependencies.ts` 是 `[] as const`(零依赖)、`platform-ports` 反过来依赖 `contracts`。⇒ **放进 contracts 需要反转依赖方向,或在 contracts 再复制一份类型 —— 后者正是本批要消除的那类重复。** 候选落点是 `platform-ports` 或 `topology`,不是 contracts。
- ⚠️ `isRecord` **不在本条内**(§0.3):全仓 9 份同名定义,按字面消重会波及 7 个包、撞 INV-7;按包内消重则本来就唯一、是恒真判据。

**R-14 两个集合分别有界(现状不同,不得合并处置)**

- `cancelledRemoteCommands`(`:187` 建、`:387` add、`:460`/`:472` delete)—— **全文无 `clear`**,连断连也不清。若取消到达时命令从未收到或已结束,该 id 永久留存。
- `pendingPeerCommands`(`:186` 建)—— 在 `:194-195` `rejectPendingPeerCommands` 内 reject + clear,由 `handlePeerLoss:278` 与 dispose 调用;问题是**断连之前无上限**,而上游 D-17 要求持续重连、长期在线会话罕有断连。
- 要求:两者各自有界(容量或 TTL),**丢弃行为不得影响正确性** —— 丢弃一个早已 settle 的取消记录是安全的,丢弃一个在途命令不是。
- ⚠️ 评审原文定性为"增长很慢,**不构成当前缺陷**,但属无界结构"。按该定性执行,不得升格为紧急项。

**R-15 `createTopologyModule` 按职责拆分(⚠️ 排最后,有硬前置)**

- 现状 646 行,15 个 `let` + 2 个集合 = 17 个可变闭包变量,连接、握手、同步、网关、调度集中在一个文件。
- 要求:按职责拆出至少连接控制与同步注册两块,拆分后各块可变状态归属明确。
- ⚠️ **"926 行测试网就是正确性信号"只对了一半**。实测 `topology/test/topology.test.ts`(926 行,`:244` 直接驱动 `createTopologyModule`)确实覆盖连接/配对/宿主生命周期七类(`:588`/`:675`/`:715`/`:741`/`:815`/`:870`/`:908`),但检索 `state-full`、`members`、`createFullSyncPayload`、`applyAuthoritativeSync`、`cancel`、`membersSyncRevision`、`lastMembersFingerprint`、`sample-member` —— **八个关键词全部零命中**。⇒ **R-11 与 R-14 要改、R-15 要搬的那四个同步/取消变量,当前零行为覆盖。**
- ⇒ **硬前置(Codex S-4 收紧:"补一个测试文件"不算数)**。R-15 动手前必须存在**真实 module 级**用例(驱动 `createTopologyModule` 本体,不是测一个纯 helper),至少覆盖八项并各带红变异:
  1. members slice 变化 ⇒ 发送**完整** slice;
  2. **无关** slice 变化 ⇒ **不**发送;
  3. 新 peer 被 accept ⇒ 完整补齐(`markPeerAccepted` 的 `force=true` 路径);
  4. send 失败 ⇒ pending command 收敛结束,不悬挂;
  5. remote cancel 之后 ⇒ 该命令不再执行;
  6. disconnect ⇒ pending command 全部收敛;
  7. `completed` / `partial-failed` / `timed-out` / `error` 四态各有断言;
  8. 删除任一对应调用、或清空取消集合的 mutation ⇒ **必须变红**。
- ⚠️ U-13 的观测点落在第 1、2 项上,**按阶段顺序先做 R-11/R-14 会顺带建起其中一部分**,但覆盖不到 3–8 项,须补齐。
- ⚠️ 评审原文建议"**不建议现在重构,登记为可读性欠账**";本批按 Dexter 2026-09-18 指示("那里面所有的需要优化的都放到这个需求里")纳入。该分歧如实记录。**本条是全批风险最高的一条。**

## 7. 验收判据

### 7.1 阶段 1

| # | 判据 | 假绿方式 |
|---|---|---|
| U-1 | **HANDOFF 五行齐备**:逐条对上游正本点名处(`:331`/`:332`/`:441`/`:463`/`:572`/`:577`)核对,加 NanoHTTPD 一行。七列齐全,`activationTrigger` 为可验收 exact token,NanoHTTPD 条目的 `deferredReason` 含 §2.1 两道闸与其脆弱性 | 只补 NanoHTTPD 一行;`activationTrigger` 写成自由文本;只写"已评估"不写闸的形态 |
| U-2 | **`lastPongAt` 的读写不再跨线程无同步**:字段为 `@Volatile`,或 `:47` 的读已在 `peerLock` 内。⚠️ **无机器门,见 D-4** | 只改注释;把读挪进另一个锁对象 |
| U-3 | **地址按需解析**:`address()`(`TerminalTopologyServer.kt:29`)每次调用都重新解析,其三个调用方(`TerminalTopologyHostRegistry.kt:60`/`:77`/`:147`)看到的地址随之刷新。⚠️ **无机器门,见 D-4** | 改成 `lazy` 仍是一次性;只在 start 时刷新 |
| U-4 | **实测有结论**:单机双屏机型上 JS 重启后,主屏与副屏各自的实际行为被**记录下来**(而非推断);若副屏不能自行恢复,须有修复并复测。⚠️ **必须上设备** —— 上游 `:332` 已明写该行为属仓外 | 拿静态代码推断冒充实测;只测主屏不测副屏;记了现象不给结论 |
| U-5 | **收窄只作用于未接线部分**:`createTransportLimiter` 已删除;`replaceServers` 与 WS profile 注册无新增消费方;**`resolveTransportServerAddresses` 与 `createTransportRetryController` 行为一字未改** —— 注入两个地址时 `createTopologyIdentityClient` 仍按序 failover(与今天一致)。`index.ts` 导出、`terminal-invariants.json`、README、测试**四处公共面同步**;上游 U-15 已显式记为作废;旧 CP-2 计划已同步(D-15)。red:改动 selector 的多地址语义须变红 | 只删源文件留下导出或 invariant 登记;把 selector 也收窄导致 identity client failover 行为静默改变;计划未同步,实施方拿到两套指令 |
| U-6 | **约束返回值来源而非形参写法**:替换成一个会投出**不同 facts** 的 capability(或置 `undefined`)后,返回值随之改变;并写明判等用 `areTopologyFactsEqual` 还是 `Object.is`。⚠️ 且**切片缺失时不得抛错** | `(root) => { void root; return capability?.getSnapshot() }` —— 形参已"使用"但行为一字未变;只验正常路径不验切片缺失 |
| U-7 | 起宿主分支有写下的保留理由,两次 `getStatus` 原样保留(`actors.ts:397`/`:440`) | 文档说保留、代码被顺手删了一次;两边都不提 |

### 7.2 阶段 2

| # | 判据 | 假绿方式 |
|---|---|---|
| U-8 | **必须使用 D-12 冻结的权威业务 fixture**(真实长度 ID + 中文 + 变化字段,不得用高度重复的合成数据),断言四项:① 完整数据可传输、重组后**逐字段相等**;② 单分片确实受上限约束;③ 人为丢弃任意一片,副机切片**保持原值不变**并产出封闭 union 内错误码;④ 超过业务容量时进入 R-10 的终态。red:关掉分片、去掉完整性校验,各须变红 | 用高度重复 fixture 把 5000 条压进一帧(实测重复数据可压 19–40 倍、真实数据仅 2.36 倍);只比对条数不比对内容;把"5000 条"当成业务上限而不冻结真实分布 |
| U-9 | **用 D-12 的同一份真实 fixture**:① 帧上带 codec 标记;② 完整 round-trip 后**逐字节相等**;③ **至少一个超阈值的真实 fixture 强制经过 codec**(不得走 raw);④ raw fallback 只在 D-6 的封闭理由码集合内发生;⑤ **分片上限判定作用在压缩后的 wire payload 上**。red:恒等 codec、删除 codec 调用、总是走 raw —— 三种变异**各须变红** | 把 D-6 阈值设为 0 或判定真实 fixture"低于阈值"⇒ 所有大 payload 走 raw + 任意理由码,判据仍绿而"压缩必须要有"实际没生效;用高度重复 fixture 刷比值 |
| U-10 | **触顶不再永久循环**(§5.1 的直接红):构造一个超过**重组缓冲上限**的载荷,系统停在可诊断的终止态 —— 不得出现"连上—发失败—断开—重连"反复,`membersSyncRevision` 不得持续增长,用户可见文案能说明原因。red:恢复今天的吞错行为须变红。⚠️ 另需:重组缓冲**有界** —— 持续发送永不完整的分片集,接收侧内存收敛而非增长 | 只验报错不验"不再循环";只看一次往返就下结论;靠断连清掉缓冲冒充有界 |
| U-11 | **必须写明统计边界,否则与阶段 2 的分片天然打架**(Codex 二轮 S-5)。逐层计数:`createFullSyncPayload`(业务完整 slice 构造)**= 1**;canonical **未压缩**快照序列化 **= 1**;压缩 **允许 1 次**;**chunk framing 允许 N 次,不计入"重复完整 slice 构造"**。场景:① **无关 slice 变化** ⇒ 不得产生任何 logical payload;② **members 变化** ⇒ 上述计数成立。⚠️ 同时断言**接收侧强校验仍执行**。red:删除引用短路 ① 须变红;删除接收侧校验须变红 | 把多次物理帧序列化藏进 `encodeChunks()`,只 spy `createFullSyncPayload` ⇒ 判据绿而完整 payload 仍被重复构造;**删掉发送前校验把计数"降下来"**;只数代码行不看实际调用 |
| U-12 | **业务层不感知**(INV-2):`createTopologyModule` 的同步调用点**未因分片/压缩而增加分支**;且整片同步语义不变(INV-4)——单调 revision 防重放、`applyAuthoritativeSync` 全量替换、白名单仍只允许 members | 把切分逻辑写进业务层然后说"能跑";顺手引入片内增量同步 |
| U-18 | **三项都要**:① 主机静默失联(不发 FIN、不回 pong)时,副机在超时窗内**判定失联并发起重连**,不再抱着僵尸 socket;② 心跳超时走的是**普通 peer-loss 与重连**,`handlePeerLoss` 行为与拔网线一致,**不进入 D-13 的 payload 终态**;③ **一次跨数秒的分片传输期间 pong 仍正常往返**,不得因分片占满发送队列而误判超时。red:去掉心跳 ① 须变红;把超时接到 payload 终态上 ② 须变红 | 只验"能发 ping";用拔网线(有 FIN)冒充静默分区;不验分片期间的心跳存活 ⇒ 上线后"传大数据必断连" |

### 7.3 阶段 3

| # | 判据 | 假绿方式 |
|---|---|---|
| U-13 | **两项都要**:① 在"MASTER + 已配对 + session 打开"下触发一次**与 members 无关**的 state 变化,`createFullSyncPayload(membersSliceName)` 的**调用次数为 0**;② 触发一次**真实 members 变化**,下行同步照常且内容正确。red:去掉廉价判定 ① 变红;把判定写成恒假 ② 变红 | 只验 ①(靠"干脆不发"即可通过);把观测点选在 `JSON.stringify` 上(保留 `createFullSyncPayload` 即可字面通过,热点仍在) |
| U-14 | **对 R-12 的实际产出可证伪**:`createTopologyModule.ts` 内不再有本地 `isJsonValue` 定义,且 `readSyncStateDiff`(`:87`)使用的谓词来自 contracts 的导出。red:把该导出换回无深度上限的实现须变红。⚠️ **不得写成"两包内定义唯一"—— 那今天就是真的**(topology 1 份、contracts 1 份、ui-state 另有 1 份属他包) | "两包内唯一"式的恒真判据;删了弱版本却在别处留等价实现 |
| U-15 | `topologyPeerWsUrl` 定义唯一;`hostStatusValue` 已由契约 parser 取代且 owning package 与 D-2 结论一致;对畸形 status(缺字段/多字段/类型错)的拒绝行为**不弱于**整改前 —— 逐类对照 | 只合并不验行为;新 parser 比旧手写校验更松;为放进 contracts 而复制类型;把 `isRecord` 一并改了(越界) |
| U-16 | **在不断连的前提下**持续制造取消与跨机命令,两者规模**收敛而非单调增长**;且在途命令不被错误丢弃。red:去掉任一上限须变红 | 靠断连清空冒充有界(`cancelledRemoteCommands` 连断连都不清,`pendingPeerCommands` 在上游 D-17 下罕有断连);只验上限不验在途安全 |
| U-17 | **三项都要**:① R-15 硬前置的八项覆盖**在动手前已存在且红变异全部会红**;② 拆分后测试全绿且**一行未改**(改测试即视为改行为);③ 以 R-15 动手前的即时快照为基线。⚠️ **仅有 ② 是恒真判据** —— 一行不改即为真,证明不了拆分前后行为等价 | 只做 ②;补了测试但只测纯 helper,不触发 `subscribeState` / `markPeerAccepted(force=true)` / cancel / disconnect 分支;为迁就拆分改测试 |

## 8. 明确不做

| 不做 | 理由 |
|---|---|
| 更换 HTTP/WS 依赖 | Dexter 2026-09-18 裁定不换(§0.2) |
| 片内 key 粒度 / 增量同步;业务侧拆 slice | INV-4;Dexter 明确"可以整个 slice 同步"。⚠️ 若将来要做,**基建前置是放开 `topologyWire.ts:143` 的单 sliceName 写死**(改为注册集合,而非任意字符串),那是另一批 |
| S-3 端口收敛 | 已在更早一轮整改中完成(§0.3) |
| `isRecord` 跨包消重 | 全仓 9 份,消重越界、包内消重假绿(R-13) |
| 引入认证 / 多副机 / 版本协商 | INV-6 |

## 9. 详设必须明确

- **D-1 R-6 的抛错路径**:`selectTopologyFacts` 在 topology slice 缺失时抛错。新写法须在切片缺失时**返回 `undefined` 而非抛**;guard 放哪一层(selector 内、`TopologySection` 内、还是 capability 内)须裁定,并说明 `admin-shell` 是否因此获得"topology slice 必须已装"的硬运行期依赖。
- **D-2 R-13 新 parser 的 owning package**:`platform-ports` 还是 `topology`。**不能是 `contracts`** —— 它零依赖而 `TopologyHostStatus` 在 `platform-ports`。
- **D-3 单机双屏副屏恢复的修法**:若 R-4 实测发现副屏重启后不能自行恢复,修法落在 `adapter/android/dual-screen` 的哪一层(`ensureSecondarySurface` 的 `launchRequested` 幂等闸是已知可疑点,上游 `:332` 点名)。⚠️ 实测未出结论前不得预设修法。
- **D-4 Kotlin 侧无机器门,二选一**。`assembly/base/android/android/src/` **只有 `main`,没有 test source set**(对比 `adapter/android/persist-kv` 与 `adapter/android/dual-screen` 都有 `src/test`)⇒ `TerminalTopologyServer.kt` **零测试**。这是**两个洞**,须一并处置:
  - ① **新行为无门**:U-2 / U-3 无承接门。且唯一双设备载体 `tools/terminal-topology/run-dual-device.mjs:36` 用 `hostAliasForAndroidEmulator = '127.0.0.1'`,副机**从不消费** `findHostAddress()` 的真实 IPv4 ⇒ U-3 在现有载体上不可执行。
  - ② **旧行为无防回归**:INV-1 的三项 —— close code 与 reason(`safeCloseReason` `:207-213`)、`stats()` 字段(`:79-86`)、HTTP 响应码/Content-Type/响应体(`serve()` `:94-111`)—— 唯一实现在这个文件,而 R-2/R-3 都改这个文件,判据无一触及。
  - **优先采用**新建 JVM test source set:注入 address resolver、注入或控制 heartbeat 时钟,覆盖地址每次读取、`lastPongAt` 并发访问、HTTP status、WS close code/reason、既有错误响应、`stats()` 行为。若不建 JVM 测试,则**必须**给出逐项人工 checklist(验什么、源码在哪几行、怎么跑、留什么证据产物),否则 U-2/U-3 只是"源码看起来正确"(Codex S-2)。**不得只承认 ① 而漏掉 ②。**
- **D-5 压缩实现:落点、依赖与帧形态**。TS 侧仓内**零压缩能力**,RN 无内置 zlib;主机与副机**两端都是 JS**(§5.2),故纯 JS 方案可行(一个依赖),Kotlin 保持哑管道。同时须裁 **base64 vs 二进制帧**:base64 使 Kotlin 不动但抵掉约 1.33 倍(按 §5.1 实测的真实分布压缩比 **2.36–2.73 倍**计,净得约 **1.8–2.1 倍**);放开二进制帧收益更高但要改那个零测试的文件。⚠️ **取舍必须按实测比值算,不得沿用任何旧估算。**⚠️ `CLAUDE.md`"不要随意新增依赖" —— 本条是 Dexter 明确要求的能力,依赖是必要代价,要论证的是**选型**不是**要不要**。
- **D-6 压缩的适用范围与最低收益约束**(Codex 二轮 S-4):只压 `state-full` 还是所有帧;小帧阈值多少(小帧压缩是负收益)。⚠️ **必须同时钉死四件,否则 U-9 可被极端取值绕过**:① 最低收益阈值必须是**非零且可解释**的具体值,不得留空或取 0;② D-12 的 fixture 规模必须**大到会触发压缩**;③ raw fallback 的理由码是**封闭集合**,且**不得允许"始终 raw"**;④ 至少一个超过阈值的真实 fixture **必须强制经过 codec**。
- **D-7 分片的协议形状与 `revision` 语义**:新 message type 还是既有信封加 `chunkId`/`index`/`total`;`keysAreExactly` 的严格度如何在新形状上保住;分片集跨越多帧期间 revision 归属哪一片、乱序到达怎么判、重连后半套分片如何作废。
- **D-8 重组缓冲上限 = 新的真实业务上限**:这个数是多少、凭什么(按会员数折算给出业务可理解的量级)、放在哪个配置里;分片丢失/超时多长、超时后是重取整片还是断连、与上游 D-17"永不放弃重连"如何共存而**不退化成 §5.1 的循环**。
- **D-9 指纹与压缩的关系**:若 R-11 落地为纯引用比对,则不再有序列化指纹,本条自然关闭;但若详设保留任何**序列化**形式的指纹(含降级路径),它必须算在**未压缩载荷**上,否则压缩的非确定性会让指纹失效。须明确说明落地形态属哪一种。
- **D-10 R-14 的丢弃安全性**:两个集合失控机制不同源(一个"压根没有清空路径",一个"清空时机不到"),须**分别**论证超限丢弃为何不影响正确性,并说明"在途"如何判定。
- **D-11 R-15 的拆分边界与前置覆盖**:members 同步与 command-cancel 两条路径的行为覆盖怎么补、补在哪、与 U-13 的观测点如何复用;拆分边界依据;U-17 的即时快照在哪个 CP 冻结。

- **D-12 权威业务容量 fixture 与收窄可逆性**。两件事都必须冻结成物:① **冻结一份可复现的最大业务 fixture**(真实长度 ID + 中文 + 变化字段),作为 U-8/U-9 的唯一数据源与"业务容量下限"的定义;D-8 的"远高于业务现实"不得只留为文字(Codex M-1)。② R-5 的收窄**须可逆** —— Dexter 的长期方向(多 IP、多 workspace、远端服务器)未变,只是本期不建,收窄后的形态不得堵死将来重新展开的路。
- **D-13 终态的解除条件与失败期诊断**(Codex M-2)。须逐条回答:终态落在 payload 还是 slice 粒度;**新 revision 是否解除阻塞**;**新 peer session 是否解除阻塞**;连接恢复但 payload 未变化时是否继续重试;失败期间 UI、诊断与**其余 slice** 如何处理;并明写**不得因一个失败 payload 而停止身份、心跳与连接恢复**。

- **D-14 R-16 的接线半径与上游 D-17 的适用边界**(Codex 二轮 S-3)。① 接线落点与半径(是否只需在 session 层挂一个控制器、`createTopologyModule` 的 `:381-382` 回复路径是否够用);② **写死上游 D-17 在静默分区下的含义** —— 接线后上游 D-17 覆盖"应用层心跳判定的失联",不再只限于"`onclose` 可观测的断开";③ 心跳超时与 D-13 终态的**隔离证明**(超时进普通 peer-loss,绝不进 payload 终态);④ 分片在途期间心跳的存活保证(发送队列不得饿死心跳);⑤ ⚠️ "`createTransportHeartbeat` 就是缺失的 controller"目前是**推论** —— 它还需接入 session 的 send、pong 回调与 timeout→重连路径才成立,详设须证明其形状确实够用,或说明要改什么。

- **D-15 旧 CP-2 实施计划的同步**(Codex 二轮 S-2,**详设首步**)。旧计划仍要求 `createTransportLimiter`、`replaceServers` 与完整 generic 原语,与本批 R-5 相反。**详设第一件事就是同步它**,并显式记录 R-5 对上游条款字面的那次有据偏离(保留 selector)。不同步则实施方同时持有两套相反指令。

⚠️ 本批 D 项与上游需求正本的 D-1..D-21 是**不同命名空间**;本文引用上游时一律写作"上游 D-17"。

## 10. 授权边界与未验事项

需求分析,**不是实施授权**。作者会话只做静态核验与公开资料查证,未修改任何源码(本文件除外),未运行任何构建、测试或设备命令。

**未验事项**:

1. §2.1 的 CVE 判定基于 NanoHTTPD 2.3.1 tag 源码与本仓源码的**静态**调用链;未构造实际攻击验证。`saveTmpFile`(上游 `:1199`)是第二条临时文件产生路径,同样只在 `parseBody` 之下,不改变结论。
2. 容量与压缩比**已由 Codex 2026-09-18 独立实测**(数值见 §5.1),但仅覆盖两种构造分布,**不等于真实门店数据的分布**;D-12 要求冻结的权威 fixture 尚未落成带路径与哈希的设计产物。⇒ 实测值可用于取舍论证,**不得冻结为容量承诺**。
3. RN 的 JS WebSocket 是否对大文本帧有自身限制(独立于本仓的 64KB),**未验**;分片后的端到端吞吐与延迟影响未评估。
4. §5.1 的失败链为静态推导(逐环打开源码读过),**未在设备上复现**。
5. R-11 的收益大小无实测数据;R-7 的"两次 `getStatus` 是否造成可感知延迟"同样无实测 —— 这正是它应保留观察定性的原因。
6. Kotlin 侧两条需求(R-2/R-3)在当前载体上**无法机器验证**,INV-1 的三项 Kotlin 行为同样无防回归门(D-4)。
7. R-6 的抛错路径在**出厂装配**上是否可达 `UNVERIFIED`(两个 sample integration 都注入了 topology 模块)。
8. ~~R-5 三个 transport 件的来源批次未知~~ —— **已由 Codex 答复并经作者回源坐实**:属实施计划 CP-2 交付物、闭合上游 R-7。本条关闭。
9. 工作树在本会话期间仍在变动(§0.3);本文所有行号须在实施前回源复核一次。
10. 工作量未估——属实施方视角。

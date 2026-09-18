# TER 双机拓扑 · 代码质量整改 · 需求分析(第 2 版)

- 作者:Claude｜日期:2026-09-18
- 输入正本:`doc/review/platform/2026-09-18-ter-dual-machine-topology-code-quality-review-claude.md`(M/S/N=5/4/4)
- 第 1 版结论:NO-GO(三路独立盲审 3/5/4、4/4/4、4/6/7)。本版按盲审结论与**当前工作树实测**重写。

## 0. 方向与全批不变量

### 0.1 这批要解决什么

双机拓扑已通过 IMPLEMENTATION 验收并在双设备上跑通。本批**不加功能、不改产品语义**,只处理代码质量评审的 13 条 finding。**不更换依赖**(见 §2)。

⚠️ **这不是重构批**。每条需求必须回指一条已记录的 finding;**评审没记的东西不许顺手改**。

### 0.2 ⚠️ 输入正本有两条事实已过期(本版据当前树修正)

第 1 版最大的错误是**沿用输入正本的行号而未回源复核**。当前工作树实测:

| 输入正本所述 | 当前真值 | 处置 |
|---|---|---|
| S-3 端口 43172 有 7 个落点 | production **仅 1 处**(`contracts/topology-transport.config.json:2`),`DEFAULT_PORT` 已删,其余 20 处全在测试夹具 | **S-3 作废,本批无动作** |
| S-2 含"`isRecord` 在 `actors.ts`/`createTopologyModule.ts` 各一份" | `actors.ts` **无** `isRecord`;两份在 `createTopologyModule.ts:63` 与 `contracts/topologyWire.ts:18`(跨包),全仓另有 7 份同名 | **该半条删除**,S-2 只保留另两项 |
| S-4 一个判定点 | `topologyMaxFrameBytes` 有 **三个**:`:87` 接收、`:161` identity、**`:185` 发送侧** | R-4 按三点重写 |
| N-4 "两者只在断连时整体清空" | `pendingPeerCommands` 确在 `:195` 清空;`cancelledRemoteCommands` **全文无 `clear`**,连断连也不清 | R-10 分别陈述 |
| transport 178 行 / 9 文件 | **670 行**,新增 5 个 foundations | 见 §6 |

⇒ **凡本文引用行号处,实施方仍须回源复核一次;本版已逐条实测,但树仍在动。**

### 0.3 全批不变量

**INV-1 对外可观察行为零变化**,仅 §0.4 一处例外:
线上帧字段集与取值、close code 与 reason、原生事件名与 payload 形状与 reason 取值、错误码 union、`stats()` 字段、`start()` 幂等分支、bind 失败分类与 `retryable`、HTTP 响应码/Content-Type/响应体、UI 可见文案、`TopologyHostPort` 契约、`getOperationEligibility` 裁决结果 —— **逐项与整改前一致**。

**INV-2 不动产品语义与裁定**:四条裁定原样成立;不引入认证、不支持多副机、不改同步白名单、不改 wire 协议字段结构。

**INV-3 不借机扩范围**:`transport` 包本批不动(§6)。

### 0.4 INV-1 的唯一例外

| 例外 | 行为变化 | 为什么不得不变 |
|---|---|---|
| R-4(帧上限改按 UTF-8 字节) | 一个"UTF-16 码元数未超、字节数超限"的帧,整改前被接受,整改后被拒 | 这正是 S-4 要修的缺陷本身 |

⚠️ close code 与 reason **不在例外内** —— 不换库,`TOPOLOGY_TIMEOUT` / `TOPOLOGY_PROTOCOL_REJECTED` 原样保留。

## 1. 13 条 finding 的处置总表

| finding | 轴 | 级 | 需求 | 判据 |
|---|---|---|---|---|
| M-5 NanoHTTPD 上游停更、与 DR-01"受维护"门冲突 | 健壮 | M | **R-1**(HANDOFF 登记,非代码改动) | U-1 |
| M-3 `lastPongAt` 跨线程未同步 | 健壮 | M | **R-2** | U-2 |
| M-4 `hostAddress` 一次性解析 | 健壮 | M | **R-3** | U-3 |
| S-4 帧上限按字符数而非字节数 | 健壮 | S | **R-4** | U-4 |
| M-1 已配对主机每次 state 变化全量序列化 members | 高效 | M | **R-5** | U-5 |
| M-2 每帧"序列化 + 再解析"自检 | 高效 | M | **R-6** | U-6 |
| S-1 两套 `isJsonValue` | 简单 | S | **R-7** | U-7 |
| S-2 `topologyPeerWsUrl` 重复;`hostStatusValue` 手写校验 | 简单 | S | **R-8** | U-8 |
| N-2 selector 不读 root | 简单 | N | **R-9** | U-9 |
| N-4 两个集合无界 | 健壮 | N | **R-10** | U-10 |
| N-1 646 行模块 17 个可变闭包变量 | 简单 | N | **R-11** | U-11 |
| N-3 起宿主路径两次 `getStatus` | 高效 | N | **R-12** | U-12 |
| S-3 端口 43172 多落点 | 简单 | S | **作废** —— 已在更早一轮整改中消除 | — |

**13 条 finding → 12 条需求 + 1 条作废;12 条判据。无遗漏、无孤儿。**

## 2. M-5 的处置:不换库,按 HANDOFF 登记

### 2.1 Dexter 裁定(2026-09-18)

评审原文给的是**三选一**:① 换受维护依赖;② 保留并登记 HANDOFF;③ 判定 CVE 不可达后按 ② 登记。**Dexter 裁定(原话):"那不换了"、"成本没关系。继续用" —— 即不换依赖,继续用 NanoHTTPD,走 ②+③。**

⚠️ **裁定理由不是成本**。作出裁定前 Dexter 已获知换 Ktor 的全部代价(依赖体积约 37×、需先把终端侧 Kotlin 从 2.0.21 升到 2.3.x、Ktor 内建关闭的 close reason 写死因而无法保持 `TOPOLOGY_TIMEOUT`),并明确表示成本不是考量。⇒ **将来"有预算了"不构成重启换库的理由**;重启的唯一触发是 R-1 登记条目里的 `activationTrigger`。

### 2.2 两个 CVE 都已判定(源码依据,非"未定论")

- **CVE-2020-13697**(`RouterNanoHTTPD` 反射型 XSS)—— **不适用**。`RouterNanoHTTPD` 属 `nanohttpd-nanolets` artifact,三处 gradle 只声明 `nanohttpd-websocket`,**不在 classpath 上**;全仓 `fi.iki.elonen` 仅出现在 `TerminalTopologyServer.kt`,无该 import。
- **CVE-2022-21230**(请求体 >1024 字节写入权限不安全临时文件,无修复版本)—— **不可达**。上游 2.3.1 源码:`getTmpBucket()` 的唯一调用者是 `parseBody(Map)`;`parseBody` 的唯一调用点在**默认实现** `serve(IHTTPSession)` 内。而 `TerminalTopologyServer.kt:94` **完全重写了 `serve()`,全文 230 行无 `parseBody`**;唯一走 `super.serve()` 的 `/ws` 升级落到 `NanoWSD.serve()`,后者只读 headers、不读请求体。

⚠️ 第 1 版把可达性问成"NanoHTTPD 是否在 `serve()` **之前**解析请求体" —— **问错了**。解析顺序不决定任何事,决定因素是**应用调不调 `parseBody`**,而这一眼可查。本版按源码依据判定为不可达。

### 2.3 R-1 仍然成立的理由

当前**无可达漏洞**,但上游确已停更(最新发布 2.3.1 / 2016-08-12,default branch HEAD 最后提交 2019-07-03,Snyk 对 CVE-2022-21230 明载"no patches are available. The maintainers have been unresponsive…"),**将来出现新漏洞时没有补丁通道**。这与"认证缺失""两机版本不一致"同属右尺寸标尺下的生产化欠账,处置方式一致:**登记,不立即建设**。

⚠️ **登记 ≠ 门已关闭**。详设 DR-01(`doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md`)把"Android 兼容、**受维护的** server 依赖"列为 CP-0 红线。本裁定**不满足该门**,属一次被记录的偏离。R-1 的 HANDOFF 条目必须让这一点对后来者可见,不得写成"已评估通过"。

## 3. 需求

⚠️ **本节按评审的三条轴(健壮/高效/简单)分组,需求编号因此不连续** —— 例如 R-10 在 §3.2、R-12 在 §3.3、R-11 在 §3.4。完整清单以 §1 总表为准,按编号顺序找会漏。


### 3.1 依赖欠账登记

**R-1 在 `HANDOFF.md` 登记 NanoHTTPD 上游停更风险**

按该文件既有七列格式补一行:`id` / `currentBoundary` / `deferredReason` / `risk` / `activationTrigger` / `futureAcceptanceEvidence` / `decisionSource`。

- `activationTrigger` 必须是**可验收的 exact token**(该表明写"激活 token 只允许上表 exact 值"),不得用 `WHEN_NEEDED` 这类自由文本。
- `deferredReason` 须写明 §2.2 的两条 CVE 判定结论与其源码依据,使后续读者不必重做这次考证。
- ⚠️ 上游需求正本已裁定入 HANDOFF 的另两项(**认证缺失**、**两机版本不一致**)**至今未落地**;本条一并补齐,三行同批。

**产出物是文档行,不是代码改动。**

### 3.2 健壮

**R-2 `lastPongAt` 的跨线程访问必须安全**

- 现状:`TerminalTopologyServer.kt:25` 无 `@Volatile`,`:47` 心跳线程**锁外读**(`:44` 的 `synchronized` 只包了取 `peer`),`:150`/`:193` 锁内写。心跳跑在独立 `ScheduledExecutorService` 线程。
- 后果:可见性隐患 —— 误踢健康连接,或漏判超时让死连接长期不被回收。
- 要求:`@Volatile private var lastPongAt`,或把 `:47` 的读并入 `:44` 已有的 `synchronized(peerLock)`。**一处改动。**

**R-3 `address()` 每次调用时解析主机地址**

- 现状:`:27` `private val hostAddress: String = findHostAddress()`,构造期一次性解析;`:30`/`:33` 等全部基于它。
- 后果:换网或 DHCP 续租后 IP 变化,副机 `masterLocator` 指向死地址,而上游 D-17"永不放弃重连"会**无限重试一个错误地址**。两条约束叠加放大后果。
- 要求:改为按需解析(如 `get() = findHostAddress()`)。成本仅在 `getStatus` 路径。**一处改动。**

**R-4 帧上限按 UTF-8 字节判定,三个判定点同口径**

- 现状三点全部用 `raw.length`(UTF-16 码元):`topologyWire.ts:87` 接收、`:161` identity、**`:185` 发送侧**;Kotlin `TerminalTopologyServer.kt` 同错。
- ⚠️ **只改接收侧会造成永久同步中断**:主机把一份超限 CJK `state-full` 帧通过发送检查发出,副机按新规则拒收 → `onProtocolError` → `handlePeerLoss` → 按上游 D-17 无限重连,每次重连第一帧同样失败,**无终止态、无错误码告诉用户为什么**。这正是 S-4 本要消灭的两端不一致。
- 要求:**三个 TS 判定点 + Kotlin 侧**统一按 UTF-8 字节,阈值 65536 不变;常量名 `topologyMaxFrameBytes` 与语义对齐。

**R-10 两个集合分别有界(现状不同,不得合并处置)**

- `cancelledRemoteCommands`(`:187` 建、`:387` add、`:460`/`:472` delete)—— **全文无 `clear`**,连断连也不清。若取消到达时命令从未收到或已结束,该 id 永久留存。
- `pendingPeerCommands`(`:186` 建)—— 在 `:195` `rejectPendingPeerCommands` 内 `clear`,由 `handlePeerLoss:278` 与 dispose 调用;问题是**断连之前无上限**,而上游 D-17 要求持续重连、长期在线会话罕有断连。
- 要求:两者各自有界(容量或 TTL),**丢弃行为不得影响正确性** —— 丢弃一个早已 settle 的取消记录是安全的,丢弃一个在途命令不是。
- ⚠️ 评审原文对本条的定性是"增长很慢,**不构成当前缺陷**,但属无界结构"。本条按该定性执行,不得升格为紧急项。

### 3.3 高效

**R-5 members 同步不得在每次 state 变化上构造全量载荷**

- 现状:`:608-609` `subscribeState` 每 tick 调 `sendMembersSnapshot`,后者 `:226` `createFullSyncPayload` + `:228` `JSON.stringify` 只为求指纹。热点落在**最忙的节点**(正在工作的已配对主机)。
- 要求:先做廉价判定(`state[membersSliceName]` 引用相等),仅在可能变化时才构造载荷;或只在 members 切片订阅上触发。
- ✅ **承重前提已核实**:`createFullSyncPayload` 只读 `store.getState()[slice.name]`(`state/src/foundations/createStateRuntime.ts:196-215`),RTK store 在切片未变时保留引用;仓内已有同款先例 —— `persistableSliceRefs` 正是用引用比对驱动持久化 flush。**"引用相等"不是假设。**
- ⚠️ **不得因此丢同步**:任何一次真实 members 变化仍必须下行。

**R-6 发送侧自检不得对大帧做深度重遍历**

- 现状:`topologyWire.ts:186` 在 `stringify` 后再 `parseTopologyWireMessage` 自检;配合 R-5 的指纹序列化,一次 members 变更最多对同一份数据做三趟。
- 要求:保留"发送侧自证协议合规"的意图,但不得对 `state-full` 的 payload 做深度重遍历(自检仅 `__DEV__` 生效,或只校验顶层字段 + `sliceName`/`direction`)。
- ⚠️ **只动发送侧**,接收侧强校验是 TER 优于 POC 的核心一条,不得削弱。

**R-12 起宿主路径的两次 `getStatus` 须给出结论并落地**

- 现状 `actors.ts:397` 与 `:440` 各一次,每次 5s 超时的原生 IPC。
- 评审定性为"**记为观察而非缺陷** ——'起完确认'本身是健壮性优点"。
- 要求:**保留是可接受且预期的结论**,但须写下理由(一行代码注释即可)。若去掉,须有实测支撑 —— 而本批无性能实测能力(§8)。

### 3.4 简单

**R-7 `isJsonValue` 在 topology 与 contracts 两包内定义唯一**

- 现状:`contracts/topologyWire.ts:21` 有深度上限 12、键长上限、有限数检查;`createTopologyModule.ts:66` 无深度上限、无键长检查。
- ⚠️ **本条不含行为增益,理由须据实收窄**:`topologyWire.ts:140-146` 的 `state-full` 分支**已经**用强版本校验过 `value.value`,`readSyncStateDiff` 在其之后运行,弱版本只能看到已通过强校验的值(深度账:`value.value`→`entries`→candidate→envelope→`envelope.value` = 4 层,强版本尚余 8 层)。所以理由是"**同名两份定义、标准不一**",**不是**"跨机载荷用弱校验有安全缺口"。
- 要求:从 contracts 导出强版本供模块复用,删除弱版本。

**R-8 消除 `topologyPeerWsUrl` 重复,原生 status 改走契约 parser**

- `topologyPeerWsUrl` 在 `actors.ts:128` 与 `createTopologyModule.ts:93` 各一份,函数体相同 → 合并到单一住址。
- `actors.ts:44-78` 约 35 行手写 `Reflect.get` 的 `hostStatusValue` → 改为与 `parseTopologyIdentityResponse` 同风格的契约 parser。**新 parser 对畸形 status 的拒绝行为不得弱于现状。**
- ⚠️ `isRecord` **不在本条内**(§0.2):全仓 9 份同名定义,按字面消重会波及 7 个包、撞 INV-3;按包内消重则本来就唯一、是恒真判据。两种读法一个越界一个假绿,故删除该半条。

**R-9 `factsSelector` 改用现成的 root selector**

- 现状 `TopologySection.tsx:57-58` `useMemo(() => (_root: StateRoot) => capability?.getSnapshot(), …)`,形参未用,数据来自捕获的 capability。
- ✅ **改法已确定,不需要详设**:`selectTopologyFacts(state: StateRoot)` 定义在 `topology/src/selectors/selectTopologyFacts.ts:28`,已由 `topology/src/index.ts:10` 导出,而 `TopologySection.tsx:11` **已经在 import 同一个包**。`createTopologyAdminCapability.ts:110` 的 `getSnapshot` 本身就是 `selectTopologyFacts(runtime.getState())`。
- ⚠️ 唯一需想清楚的:现写法在无 capability 时返回 `undefined`,改用 selector 后总是有 facts。须确认该语义变化不影响 `TopologySection` 的渲染分支。**一处改动。**

**R-11 `createTopologyModule` 按职责拆分**

- 现状 646 行,15 个 `let` + 2 个集合 = 17 个可变闭包变量,连接、握手、同步、网关、调度集中在一个文件。POC 在同量级代码上另拆出 `pairLinkController`(86)与 `syncRegistry`(159)。
- 要求:按职责拆出至少连接控制与同步注册两块,拆分后各块可变状态归属明确。
- ✅ **第 1 版说"没有任何行为变化可作为正确性信号"是错的**:`topology/test/topology.test.ts` **926 行**直接驱动 `createTopologyModule`,覆盖入站 peer 命令归一、desired/actual 对账、JS 重启后 hydrate 不重复起宿主、配对的有序 reset、解绑的 CHIEF→MASTER 顺序、协议解析失败断连、端口占用错误码保型,以及 `closingConnectionId` 这类拆错最易踩的迟到事件保护。**这就是信号,现成可跑。**
- ⚠️ 评审原文建议"**不建议现在重构,登记为可读性欠账**";本批按 Dexter 2026-09-18 指示("那里面所有的需要优化的都放到这个需求里")纳入。该分歧如实记录。

## 4. 影响面与排序

| 位置 | 需求 |
|---|---|
| `HANDOFF.md` | R-1(三行:NanoHTTPD 停更 + 认证缺失 + 版本不一致) |
| `assembly/base/android/.../TerminalTopologyServer.kt` | R-2、R-3、R-4(Kotlin 侧) |
| `contracts/src/foundations/topologyWire.ts` | R-4(三个判定点)、R-6、R-7(导出强版本) |
| `topology/src/application/createTopologyModule.ts` | R-5、R-7、R-8、R-10、**R-11** |
| `topology/src/features/actors/actors.ts` | R-8、R-12 |
| `ui/base/admin-shell/.../TopologySection.tsx` | R-9 |

**硬排序(唯一一条):R-11 必须排在最后。** R-5 / R-7 / R-8 / R-10 的编辑点全部落在 R-11 要搬动的区域内;先改语义再改位置,复核者才不必对同一处做两次对照。⚠️ 因此 **U-11 的基线是"R-11 动手前的即时快照",与其余判据的整改前基线解耦** —— 否则该基线里混入四条有意变更,"拆分前后一致"必然对不上。

## 5. 验收判据

| # | 判据 | 假绿方式(反例) |
|---|---|---|
| U-1 | **HANDOFF 三行齐备**:NanoHTTPD 停更、认证缺失、两机版本不一致各一行,七列齐全,`activationTrigger` 为可验收 exact token,`deferredReason` 含 §2.2 两条 CVE 判定的源码依据 | 只补 NanoHTTPD 一行;`activationTrigger` 写成自由文本;只写"已评估"不写依据 |
| U-2 | **`lastPongAt` 的读写不再跨线程无同步**:字段为 `@Volatile`,或 `:47` 的读已在 `peerLock` 内。⚠️ **无机器门,见 D-1** | 只改注释;把读挪进另一个锁对象 |
| U-3 | **地址按需解析**:`address()`/`status()` 每次调用都重新解析,不持有构造期缓存。⚠️ **无机器门,见 D-1** | 改成 `lazy` 仍是一次性;只在 start 时刷新 |
| U-4 | **三个 TS 判定点 + Kotlin 侧全部按 UTF-8 字节**,且**同一份超限载荷在发送侧即被拒、不得发出**。red:任一判定点改回按码元须变红。构造样本:21846 个 CJK 字符 = 21846 码元(<65536)/ 65538 字节(>65536) | 只改接收侧(制造永久同步中断);只用 ASCII 构造超限帧(测不出码元/字节差异);只验一端 |
| U-5 | **两项都要**:① 在"MASTER + 已配对 + session 打开"下触发一次**与 members 无关**的 state 变化,`createFullSyncPayload(membersSliceName)` 的**调用次数为 0**;② 触发一次**真实 members 变化**,下行同步照常且内容正确。red:去掉廉价判定 ① 变红;把判定写成恒假 ② 变红 | 只验 ①(靠"干脆不发"即可通过);把观测点选在 `JSON.stringify` 上(保留 `createFullSyncPayload` 即可字面通过,热点仍在) |
| U-6 | **`state-full` 发送路径上 `parseTopologyWireMessage` 的调用次数为 0**。⚠️ 附带断言"接收侧仍拒多字段/少字段/超深度/非法 `sliceName`/错方向"**今天即为真**,只作防退化,**不构成 R-6 的完成证据** | 只数代码行不看实际调用;把防退化断言当成完成证据 |
| U-7 | **机械判据**:`topology` 与 `contracts` 两包内 `isJsonValue` 定义唯一。⚠️ **本条不含行为增益** —— 超深度载荷今天就会被 `:140-146` 的强校验拒掉,不得用它冒充 R-7 的成效 | 删了弱版本却在别处留等价实现;拿"超深度被拒"当 R-7 的成果 |
| U-8 | `topologyPeerWsUrl` 定义唯一;`hostStatusValue` 已由契约 parser 取代,且对畸形 status(缺字段/多字段/类型错)的拒绝行为**不弱于**整改前 —— 须逐类对照 | 只合并不验行为;新 parser 比旧手写校验更松;把 `isRecord` 一并改了(越界) |
| U-9 | **约束返回值来源而非形参写法**:对同一 root 两次调用返回相等值,且**替换 capability 实例不改变返回值** | `(root) => { void root; return capability?.getSnapshot() }` —— 形参已"使用"、旧判据通过、行为一字未变 |
| U-10 | **在不断连的前提下**持续制造取消与跨机命令,两者规模**收敛而非单调增长**;且在途命令不被错误丢弃。red:去掉任一上限须变红 | 靠断连清空冒充有界(`cancelledRemoteCommands` 连断连都不清,`pendingPeerCommands` 在上游 D-17 下罕有断连);只验上限不验在途安全 |
| U-11 | **`topology.test.ts` 全绿且一行未改** —— 改测试即视为改行为。以 R-11 动手前的即时快照为基线 | 为迁就拆分改测试;与全批基线混用导致判据恒红后被迫放宽 |
| U-12 | 详设与代码一致:保留则有写下的理由,去掉则第二次 `getStatus` 确已不在起宿主路径上 | 文档说去掉、代码还在;两边都不提 |

## 6. 明确不做

| 不做 | 理由 |
|---|---|
| 更换 HTTP/WS 依赖 | Dexter 2026-09-18 裁定不换(§2.1) |
| **`transport` 包的 5 个新 foundations** | INV-3。⚠️ **但须向 Dexter 报一件新事实**:`createTransportHeartbeat` / `createTransportLimiter` / `createTransportRetryController` / `createTransportWebSocketController` / `resolveTransportServerAddresses` 共 453 行,全部从 `index.ts` 导出,**包外引用计数全为 0**。这是裁决⑩("按通用形状建,但不为证明通用制造第二个消费方")的同类问题,且比 IMPLEMENTATION 评审记录的"四个零消费方契约"更重。**不在本批范围,但需单独裁定。** |
| S-3 端口收敛 | 已在更早一轮整改中完成(§0.2) |
| `isRecord` 跨包消重 | 全仓 9 份,消重越界、包内消重假绿(§3.4 R-8) |
| 引入认证 / 多副机 / 版本协商 | INV-2 |
| 改 wire 协议字段结构、改同步白名单 | INV-2;R-4 只改长度判定口径 |

## 7. 详设必须明确

- **D-1 Kotlin 侧的红变异由哪个门承接**(⚠️ 最重要)。`assembly/base/android/android/src/` **只有 `main`,没有 test source set**(对比:`adapter/android/persist-kv` 与 `adapter/android/dual-screen` 都有 `src/test/`)。⇒ U-2 / U-3 / U-4 的 Kotlin 半边**今天没有任何机器门**。唯一双设备载体 `tools/terminal-topology/run-dual-device.mjs` 走 ADB 桥(`hostAliasForAndroidEmulator = '127.0.0.1'`),副机**从不消费** `findHostAddress()` 的真实 IPv4,也无改变设备 IP 的手段 ⇒ U-3 在现有载体上不可执行。详设二选一:新建 JVM test source set 并把地址解析器改为可注入,或明确标 `UNVERIFIABLE_BY_MACHINE` 转人工并说明谁验、怎么验。
- **D-2 R-4 的发送侧行为**:发送侧超限时现状是 `throw`(`topologyWire.ts:185`)。改按字节后,一份"本机能构造但超限"的 members 载荷会在发送侧抛错 —— 该异常的处置路径是什么?会不会把主机自己带进 `handlePeerLoss` 循环?须给出结论。
- **D-3 R-10 的丢弃安全性**:两个集合失控机制不同源(一个"压根没有清空路径",一个"清空时机不到"),须**分别**论证超限丢弃为何不影响正确性,并说明"在途"如何判定。
- **D-4 R-9 的 `undefined` 语义**:改用 `selectTopologyFacts` 后,无 capability 时从 `undefined` 变为总有 facts,`TopologySection` 的渲染分支是否受影响。
- **D-5 R-11 的拆分边界**:拆成哪几块、边界依据、以及 U-11 的即时快照在哪个 CP 冻结。
- **D-6 R-12 的取舍**:保留还是去掉第二次 `getStatus`,给出结论与理由。
- **D-7 R-8 的畸形 status 对照清单**:U-8 要求"不弱于整改前",须逐类列出旧手写校验实际拒掉哪些形态。

⚠️ 本批 D 项与上游需求正本的 D-1..D-21 是**不同命名空间**;本文引用上游时一律写作"上游 D-17"。

## 8. 授权边界与未验事项

需求分析,**不是实施授权**。作者会话只做静态核验与公开资料查证,未修改任何源码(本文件除外),未运行任何构建、测试或设备命令。

**未验事项**:

1. §2.2 的 CVE 判定基于 NanoHTTPD 2.3.1 tag 源码与本仓源码的**静态**调用链;未构造实际攻击验证。
2. R-5/R-6 的收益大小**无实测数据**,结论源自代码路径推演。R-12 的"两次 `getStatus` 是否造成可感知延迟"同样无实测 —— 这正是它应保留观察定性的原因。
3. Kotlin 侧三条需求(R-2/R-3/R-4 半边)在当前载体上**无法机器验证**(D-1)。
4. §6 所述 transport 453 行零消费方为本会话实测,但**其来源批次与授权边界未知**,需 Dexter 或 Codex 澄清。
5. 工作树在本会话期间仍在变动(§0.2);本文所有行号须在实施前回源复核一次。
6. 工作量未估——属实施方视角。

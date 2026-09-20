# TER 双机拓扑基建加固 · implementation-facing 详设

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

~~~text
DOCUMENT_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_TARGET=DESIGN
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-design-granularity.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-design-adversarial-review-codex.json
BUSINESS_SOURCE=doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-requirements-claude.md
JOURNEY_REFS=N/A_WITH_REASON：本批不新增 Journey、入口或产品语义，只加固既有双机拓扑基础设施
IA_REF=N/A_WITH_REASON：不改变页面信息架构；U-4 设备观察只验证既有双屏恢复
INTERACTION_REF=N/A_WITH_REASON：不改变用户动作、文案或焦点；R-10 的失败原因沿既有诊断通道呈现
AUTHORIZED=按 Claude 第二轮 DESIGN review GO 与 Dexter 2026-09-18 明确授权，执行 CP-0～CP-4、两阶段动态验证和交付复评；U-4 在第一阶段保持 OPEN，等待单机双屏设备
NOT_AUTHORIZED=超出本详设的产品语义、未列出的生产机制、数据库、设备级开机自启、Git
IMPLEMENTATION_AUTHORITY=true
DESIGN_STATUS=GO_BY_CLAUDE_DESIGN_REVIEW_ROUND2
INDEPENDENT_SUBAGENT_REVIEW=OPEN：本文件不冒充 fresh 独立 verdict；Dexter 已明确豁免该前置并授权按本文件推进；OPEN 不得改写为已完成
SCOPE_DECISION=三阶段严格顺序：阶段一止血，阶段二压缩/分片/应用层心跳，阶段三 topology module 质量项与拆分；R-15 最后
EVIDENCE_STATUS=DESIGN_ONLY；本文件不宣称任何 focused、Kotlin、Android、设备、release 或容量运行结果
~~~

本文件定义实现者要落到哪里、为什么这样落、如何测试以及如何拒绝假绿；它不表示源码已修改或验收已通过。所有源码行号只是本次写作时对当前树的定位，实施 CP-0 必须按符号锚点重新核对，不能把行号当作稳定接口。

## 0 · 当前字节恢复与边界

### 0.1 真实问题

当前 topology wire 把单个文本帧限制为 64 KiB，发送侧先 JSON.stringify 再重新 parse，主机每次 state 变化都可能重建完整 members payload；超限异常又被 session 当作协议错误，副机重连后强制重发同一份必然失败的 payload，形成“连接—发送失败—断开—重连”的循环。这个问题不是 sample 的会员列表设计问题，而是传输层没有把大数据、完整性、重组、失败粒度和重试边界分开。

并行存在的基础设施问题是：NanoHTTPD 的停更风险只登记在 HANDOFF；Android 服务器的 lastPongAt 读写没有明确跨线程语义；host address 在构造期只解析一次；单机双屏 JS reload/副屏 Presentation 恢复缺设备证据；transport 的未接线 limiter 需要按上游收窄条款清理，但已经被 identity client 消费的多地址 selector 与 retry controller 不能为“看起来只服务 topology”而回退。

### 0.2 已核实的 owning source

- Android server：apps/terminal/assembly/base/android/android/src/main/java/com/catering/v2s/terminal/assembly/base/android/TerminalTopologyServer.kt
- Android host registry：apps/terminal/assembly/base/android/android/src/main/java/com/catering/v2s/terminal/assembly/base/android/TerminalTopologyHostRegistry.kt
- wire contract：apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts、apps/terminal/kernel/base/contracts/src/types/topology.ts
- transport session/primitives：apps/terminal/kernel/base/transport/src/foundations/createTopologySession.ts、createTransportHeartbeat.ts、createTransportWebSocketController.ts、resolveTransportServerAddresses.ts、createTopologyIdentityClient.ts
- topology owner：apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts、src/selectors/selectTopologyFacts.ts、src/foundations/createTopologyAdminCapability.ts
- dual-screen restore owner：apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt
- authoritative member shape：apps/terminal/kernel/feature/sample-member-registry/src/types/types.ts
- old conflicting plan：doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md 的 CP-2
- existing runner：tools/terminal-topology/run-dual-device.mjs

当前 transport package 没有 fflate/pako 或其他压缩直接依赖；不能把 node_modules 的传递包当作直接依赖。当前 Android base module 的 Kotlin source set 只有 main，故 D-4 采用 JVM test source set，而不是把 Kotlin 语义交给设备截图或人工读源码。

### 0.3 D-12 fixture 家族与职责边界

需求要求的权威业务 fixture 仍只有一份，不能被辅助压力数据替换：

- 路径：doc/plans/platform/fixtures/ter-dual-machine-members-capacity-fixture.json
- fixtureId：ter-dual-machine-members-capacity-v1
- recordCount：570
- shape：sample-member-registry.Member[] 的完整成员对象，包含真实长度变化的 memberId、中文 name、变化 phone、可选 age、变化 registeredAt
- 文件 SHA-256：05d7b0736a229da36839236bee598eefa3cd172e6cd66709577b7729a5f19e58
- 文件字节数：90,556；members 数组规范化 JSON 的逻辑载荷：62,389 UTF-8 字节
- members 规范化载荷 SHA-256：1e545ad3f510b1075c55f1096122aaaa659880ee908362f40bddfdeea911adee
- 角色：U-8 的业务逐字段 round-trip、U-9 的超阈值 forced codec；不代表未来容量上限，也不单独承接多片边界。

为使同一判据的物理边界有真实执行体，另有三份辅助 fixture；它们不是业务容量承诺，也不改变“权威业务 fixture 必须参与 U-8/U-9”的要求：

| fixture | 路径 | 规范化 members 字节 / SHA-256 | 用途 |
|---|---|---|---|
| multi-chunk stress | `doc/plans/platform/fixtures/ter-dual-machine-members-multi-chunk-stress-fixture.json` | 466,323 / `cdcaf036fcd42b3bb629217d611e10a839093ef62835913c672acc4bb8dbe86d` | U-8 乱序、重复、丢片、半套、inflight/TTL；U-18 delayed multi-chunk |
| low-compressibility | `doc/plans/platform/fixtures/ter-dual-machine-members-low-compressibility-fixture.json` | 23,985 / `906f2d32330ae94bf009539090ec14a59697dbc514a03997be5a8d73eb76ea98` | 4 条高熵 member 记录；CP-0 实测 fflate encoded 30,224 bytes、1 片，U-9 `compression-not-beneficial` raw fallback |
| small-raw | `doc/plans/platform/fixtures/ter-dual-machine-members-small-raw-fixture.json` | 213 / `f8b5f6f8b497f1dbd9c38d3506a0c13a9a72135b022ffb7006b89410d03f4831` | U-9 `below-threshold` raw fallback |

辅助 fixture 的文件 SHA、recordCount、规范化字节、用途和 CP-0 实测值统一登记在
`doc/plans/platform/fixtures/ter-dual-machine-members-fixture-manifest.json`。设计期 node-zlib 数字只作为预览；当前实际 fflate 0.8.3 结果为：权威 fixture 16,180 bytes/1 片、multi-chunk 392,012 bytes/8 片、low-compressibility 30,224 bytes/1 片、small-raw 160 bytes/1 片。multi-chunk 的 4 片是最低门槛，实际 8 片已记录在 manifest；这些测量不是容量承诺。

8 MiB overflow 不落盘：CP-0 已用固定 seed 的 `Member[]` 生成器持续增加高熵 name 段，得到 canonical 10,896,174 bytes、fflate encoded 8,443,440 bytes，超过 `topologyReassemblyMaxBytes=8,388,608`；CP-2 仍需用该输入验证发送侧预检和接收侧防御闸，记录触发的 typed reason。它只验证物理上限，不伪称业务 fixture。

## 1 · 真实业务目标与方案比较

### 1.1 不做会怎样

- 真实分布的 members slice 会在当前单帧边界前触顶，失败被误当作连接失败，副机持续重连而没有 payload 级终态。
- 压缩如果没有分片承接，只是延后触顶；分片如果没有完整性与重组上限，则会把 OOM 和半套 apply 引入接收端。
- 如果把 transport 收窄成单 locator 并误删已被 identity client 消费的 selector，会改变既有 failover 行为；如果只改 README/导出，不改实现，后续接入方会得到虚假的能力承诺。
- 如果先拆 646 行 createTopologyModule，再补 members/cancel 行为覆盖，拆分前后差异无法定位，测试会把未覆盖路径误当作等价。
- 如果应用层心跳超时停掉整个 peer，而不是走正常 peer-loss/reconnect，则会违反上游“持续重连”语义；如果没有副机侧心跳，静默网络分区下副机永远不会进入重连。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A. 只把单帧上限调大，继续发送完整文本帧 | 仍有有限上限；Kotlin、RN WebSocket、内存和业务分布会继续形成隐式天花板；失败循环仍存在 | 拒绝 |
| B. 改 Android/Kotlin 为二进制 WebSocket，再在两端重写字节管道 | 可减少 base64 开销，但要改变 Kotlin zero-test 文件、Expo/RN native payload 形状、JS WebSocket 事件解码和双 App 接线，风险集中在当前最薄的边界 | 拒绝本批 |
| C. TS transport wire 内使用 fflate zlib + base64 文本分片；Kotlin 保持文本哑管道；接收侧有界重组并做一次强校验 | 只增加一个直接纯 JS 依赖，绕开 native 二进制事件迁移；压缩和分片都真正落在传输层，业务 module 仍只发送完整 slice | **采用** |
| D. 按 key 做增量同步或新增全局 delta protocol | 可能减少 payload，但改写整片同步裁定、revision、applyAuthoritativeSync 和业务 slice 边界，问题规模远大于本批目标 | 拒绝 |

我选了 C 而不是 A/B/D，因为它在当前主机 JS → Native 文本管道下以最小跨平台表面积同时满足压缩、分片、完整性、失败隔离和充分测试；“减少 native 改动”只是风险结果，不是放宽测试要求。fflate 的官方说明提供纯 JavaScript、Uint8Array 的 zlibSync/unzlibSync 形态；实施仍须在 CP-0/CP-2 通过本仓解析、typecheck 和 Android supporting proof，不能只凭外部说明宣称 RN 已验证。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-0 | D-15 旧计划同步、源码分母与依赖预检、fixture 冻结 | 主 agent + 只读独立对账 | 无矛盾的旧 CP-2 指令、fixture hash、文件/公共面分母、fflate 解析结论 | 设计 review 通过 |
| CP-1 / 阶段一 | 独立止血与可观察恢复 | assembly/base/android、transport、topology、dual-screen | R-1～R-7；JVM test source set；设备 U-4 结果 | CP-0 |
| CP-2 / 阶段二 | wire 容量、压缩、分片、终态与 R-16 心跳 | contracts、transport、topology session | R-8～R-10、R-16；U-8～U-12、U-18 focused proof | CP-1 全部收口 |
| CP-3 / 阶段三 | topology module 质量项与职责拆分 | topology | R-11～R-15；U-13～U-17 | CP-2 全部收口 |
| CP-4 | 全批证据、逐代码/详设对账、review handoff | 主 agent | U-1～U-18 矩阵、三维对账、逐行 MATCHED/OPEN、Claude brief | CP-3；不得新增机制 |

阶段一、二、三不得并行。阶段二改变 session/wire send path，阶段三只能在该路径的完整 focused proof 和全批三维对账之后开始；R-15 是最后一个生产结构变化。

## 3 · 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 验证观察 | ③ 无现成时形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | terminal-coding-standard.md TR-03；contracts/topology parser | 静态 import/selector 对账 + parser focused | 只从 owner selector 读 state，不用字符串 slice key | topology facts、members slice、peer status |
| 写授权与 grant 复核 | TR-01；createTopologyModule actor/command | topology module focused 断言 command → actor → action | 不在 codec/session 写 Redux state；只通过回调向 owner 报结果 | peer loss、payload diagnostic、members apply |
| 跨 owner 写与事务 | N/A_WITH_REASON：本批无 DB/schema/HTTP owner | 静态确认无 migration/seed/DB 变化 | N/A | 全部 |
| 集合形态与分页 | topology config 的 bounded maps/sets；D-10 | U-16 并发制造多个 command/取消并观察逐 command 收敛 | pending map 有 call timeout/容量；remote cancel 只记录在途 commandId 集合；未知/已 settle 为 no-op | pendingPeerCommands、remote cancellation、reassembly transfers |
| 缓存失效/改完刷新 | U-13 members reference gate；D-13 payload diagnosis | members 变更必传；无关 slice 不构造；transfer plan 失败不递增 revision；新 revision 清 terminal block | 不缓存压缩结果跨 revision；同一失败 payload 不循环重试；revision owner 不依赖 fingerprint | members reference gate、membersSyncRevision、payload terminal state |
| RTK 数据读取与加载判定 | N/A_WITH_REASON：非 React Query/RTK Query 批 | 静态确认未引入 RTK Query | N/A | 全部 |
| 同一事实只有一个住址 | contracts/topology-transport.config.json 与 typed projection | rg 检查 port/basePath/timeout/retry bounds 的生产复制 | 新常量只在 contracts config；其他层只消费 projection | port、basePath、heartbeat、timeouts、buffer bounds |
| 失败可见且原因不得改写 | terminal coding standard TR-02、既有 topologyReasonMessages | U-10/U-18 断言 typed code、文案、retryable 和 slice 保留 | payload 终态只锁 payload/slice，不锁 session/peer | wire errors、payload diagnosis、peer loss |
| owner 错误到 HTTP 的映射/注册处 | existing TerminalTopologyHostRegistry + contracts parser | Kotlin JVM tests + native supporting | 不新增 HTTP parser；继续 NanoHTTPD route owner | status、WS、bind failure |
| 幂等键与重放 | existing revision/wireId + D-7 | U-8/U-10 重放/乱序/重复 chunk focused | transferId + slice/revision/checksum；完整后只 apply 新 revision；revision 只在合法 transfer plan 建立后递增 | state-full transfer |
| 生成物不得手搓字符串 | existing topology config projection、terminal invariants | static public-surface/config scan | 不把协议字段或端口复制到 runner/UI/Kotlin | wire error union、transport config、README/invariants |
| 日志落点与脱敏 | AGENTS observability rule；topologyPeerLog/Android Log | evidence 读取结构化事件，检查无 raw payload/token/phone | 记录 transferId、slice、revision、chunk index/total、reason，不记 payload | session、reassembly、heartbeat、Kotlin host |
| 迁移回填与可逆性 | N/A_WITH_REASON：无 DB/schema | static changed-file set 无 migration | R-5 保留 selector/replaceServers API 形态，不新增多地址配置 | transport public surface |
| 前端共享行为 | N/A_WITH_REASON：无 UI 行为变化 | static no UI files changed except any existing diagnostics consumer only if required | N/A | 全部 |
| 候选/下拉数据源 | N/A_WITH_REASON：无 UI 候选 | static | N/A | 全部 |
| 编码与名称呈现 | TR-10 中文 README；terminal-invariants | README 示例回源码核对 | 说明 transport 本批实际 owner，不写未实现能力 | contracts、transport、topology、assembly/base/android |
| 原子组 | TR-09、package.json/graph/invariant/readme/test public surface | CP-1/CP-2 static diff + owned tests | 能力源、导出、invariant、README、测试同批 | createTransportLimiter removal；wire codec/chunk/error union；Kotlin server+JVM tests |

## 4 · 传输与状态设计

### 4.1 逻辑消息与物理帧

业务层仍只产生完整的 logical state-full，sliceName 仍只允许既有 members slice，direction 仍只允许 master-to-slave，revision 仍是 logical slice revision。业务层不得看到 codec、base64、chunk index、reassembly map 或 buffer limit。

state-full 的物理传输统一使用严格的 state-full-chunk frame，即使 total=1 也使用同一形状，避免单帧/多帧两套解析语义。控制帧 hello、command-request/result/cancel、ping/pong、closed-error 仍是单帧文本消息。

state-full-chunk 固定字段：

- type、protocolVersion、wireId
- sliceName、direction、revision
- transferId、index、total
- codec：zlib-base64 或 raw-base64
- rawBytes、encodedBytes、checksum
- payload：base64 文本

同一 transfer 的所有 chunk 必须在 parser 层通过 exact-key、类型、范围、总数、slice、direction、revision、codec、rawBytes、checksum 一致性校验。未知字段、多字段、未知 codec、index 越界、total 为零、encodedBytes 超单片 UTF-8 上限都 fail closed。解析完成前不得 apply。

发送顺序：

1. 从成员 slice 得到完整 logical payload，并一次性规范化序列化为 UTF-8 bytes。
2. 若 raw bytes 小于 16 KiB，使用 raw-base64，fallback reason 为 below-threshold。
3. 若达到阈值，使用 fflate zlib level 6 压缩；只有 base64 后的 encoded bytes 同时比 raw bytes 少至少 1,024 bytes 且少至少 10% 时才使用 zlib-base64；否则使用 raw-base64，reason 为 compression-not-beneficial。
4. 压缩失败不走 raw fallback，直接产生 codec failure 终态；raw fallback 不是吞压缩异常的后门。
5. 压缩或 raw 编码完成后，先以 `encodedBytes` 对照 `topologyReassemblyMaxBytes` 做发送侧总量预检；超过上限时直接产生与接收侧相同的 typed deterministic `reassembly-overflow` 终态，不建立 chunk plan、不分配 transferId、不发送任何 frame。发送侧优先检出，接收侧仍必须保留同一上限作为防御闸。
6. 对未超限的 encoded payload 按 48 KiB 的单片目标切分，最终每个实际文本帧必须小于 64 KiB UTF-8 字节上限。48 KiB 留出 envelope/base64/JSON 头部余量，实际 validator 仍以完整 frame UTF-8 字节数判定。
7. checksum 作用于解压后的 canonical UTF-8 bytes；revision 和 transferId 在 logical transfer 层分配一次，不能每个 chunk 递增。
8. 阶段二允许暂存 fingerprint 作为发送去重实现细节，但跨阶段不把它当作 revision 正确性的 owner；阶段三按 R-11 删除序列化 fingerprint 后，仍必须先成功建立合法 transfer plan，再递增 `membersSyncRevision`。任何 send/write failure 都不得预先改变 revision；该不变量与 fingerprint 是否存在无关。

接收顺序：

1. parser 只接受合法 chunk；以 session generation + transferId 为 key 收集。
2. 允许乱序；拒绝同 index 不同 payload；重复相同 chunk 幂等。
3. 收齐 total 后按 index 拼接 encoded bytes，检查 encodedBytes、rawBytes、checksum，再解压。
4. 对解压后的完整 logical state-full 做一次既有强 parser/readSyncStateDiff 校验，最后才调用 applyAuthoritativeSync。
5. 只允许大于 lastReceivedMembersRevision 的 revision apply；半套、超时、校验失败都不改变 slice。
6. session loss 清掉未完成 transfer；新 session 的 transferId generation 不可复用旧集合。

### 4.2 压缩依赖和 base64 选择

CP-0 以 fflate 0.8.3 作为 transport 的直接 runtime dependency，落在 apps/terminal/kernel/base/transport/package.json，不放进 contracts。原因是压缩/编码是物理传输 owner 的责任，contracts 只拥有封闭 wire types/parser；transport 已依赖 contracts，依赖方向不反转。

使用 fflate 的 zlibSync/unzlibSync 与 Uint8Array；base64 使用 transport 内部无平台依赖的明确 helper，不使用 Node Buffer，不依赖 Android/Kotlin parser。CP-0 若当前 Yarn 解析、TypeScript 类型或 Expo/RN bundling 证明 fflate 0.8.3 不可用，必须停在 CP-0，不能手写压缩算法、不能退回只提高 frame limit。

选择 base64 文本而不是二进制帧，是为了保持 TerminalTopologyServer 当前 Text frame 与 JS WebSocket raw string contract。二进制帧是后续独立批次，不在本批偷偷扩展 Kotlin/Expo bridge。

### 4.3 重组上限与终态

配置新增 typed topology transport values：

- topologyCompressionThresholdBytes = 16 * 1024
- topologyCompressionMinimumSavingsBytes = 1 * 1024
- topologyCompressionMinimumSavingsRatio = 0.10
- topologyChunkTargetBytes = 48 * 1024
- topologyReassemblyMaxBytes = 8 * 1024 * 1024
- topologyReassemblyMaxInflightTransfers = 2
- topologyReassemblyTimeoutMs = 15_000
- topologyPeerCommandMaxInflight = 256
- topologyCancelledCommandTtlMs = topologyTransportConfig.callTimeoutMs

8 MiB 是接收侧安全上限，不是产品会员数承诺；按 D-12 权威 fixture 的 members 规范化 bytes/member（62,389 / 570）只能得到约 76,000 条同分布记录的解释性量级，不能把它当作容量承诺。辅助 multi-chunk fixture 和程序化 overflow fixture 专门验证物理边界，不参与业务容量推导。实际业务容量仍受压缩分布、协议头、设备资源和未来配置约束，不能把这个折算数字写进 HANDOFF 作为承诺。

终态只锁定一个 logical payload/slice，键为 sliceName + revision + checksum：

- deterministic payload failure：codec failure、checksum failure、decoded payload invalid、payload/reassembly size overflow。发送侧与接收侧都可检出 `reassembly-overflow`，发送侧在切片前优先拒绝且不发 frame，接收侧仍拒绝超限累计数据。记录 payload terminal diagnosis，当前同一 checksum/revision 不再重发；身份、心跳、session reconnect、其他 slice 继续工作。
- transfer transient failure：chunk timeout、session loss、缺片。清掉半套 transfer，不把 slice 标成永久失败；新 session 可以为同一 logical payload 重新建立一次 transfer，但须受 bounded retry/backoff 约束。
- 新 revision 总是解除旧 payload block；新 session 不解除 deterministic block，只清 session-owned partial state。
- 连接恢复但 payload 未变化时：deterministic failure 不重试；transfer transient failure 允许新 session 重试；两者必须有不同 typed reason。
- UI 继续显示最后一次成功的 members slice；诊断显示当前 slice 的可读错误。不得清掉 identity、peerReachable、heartbeat 或其他 slice。
- membersSyncRevision 只有 logical payload plan 成功建立后才递增；重复失败不能单调膨胀。

### 4.4 R-16 应用层心跳

createTopologySession 在 SLAVE/client session 上挂一个 createTransportHeartbeat controller：

- markOpen 时 start；close/error/peer-loss 时 stop。
- tick 以 topologyTransportConfig 的 10s interval、30s timeout 发送应用层 ping；sendPing 使用 session 的 control-priority queue。
- 收到 pong 时先 markPong，再把消息交给既有 module handler；收到 ping 的回复仍走现有 createTopologyModule 的 pong 路径，或在 session 边界等价回复，但不得出现双回复。
- timeout 只调用 onPeerTimeout → topology module 的普通 handlePeerLoss → reconnect；绝不写 D-13 payload terminal。
- chunk data queue 不能饿死 ping/pong control queue；U-18 使用 D-12 multi-chunk stress fixture 的实际多片 plan，配合 fake clock + delayed multi-chunk writes 证明。
- 主机 Kotlin 的协议层 ping 继续保留；R-16 是副机应用层补齐，不把两者混成一套。
- OkHttp 是否自动回应 protocol pong 不参与 R-16 的正确性论证。

## 5 · D-1 至 D-15 逐项结论

| D | 结论 | owning source / 落点 | 证明与红变异 |
|---|---|---|---|
| D-1 | 在 selectTopologyFacts 入口先检查 topology slice；缺失返回 undefined，不调用会抛错的 selectTopologyState。createTopologyAdminCapability.getSnapshot/getOperationEligibility、resolveTopologyCommandTarget、member-desk secondary 判断都显式处理 undefined；admin-shell 无 topology slice 时显示 unavailable，不获得硬运行期依赖 | topology selectors、createTopologyAdminCapability、resolveCommandTarget、TopologySection、sample-member-desk actor | U-6：移除 slice guard 或恢复 root 形参捕获；focused 夹具断言缺 slice 不抛且操作返回 unavailable |
| D-2 | 新的 host status parser 放在 platform-ports，复用该包已有 TopologyHostStatus owning type；不复制到 contracts，不让 contracts 反向依赖 platform-ports | kernel/base/platform-ports parser/index；topology actors 只消费 parser | U-15：缺字段、多字段、错误类型、错误状态逐类与旧行为对照；反向把 parser 放 contracts 作为 red |
| D-3 | 不预先猜设备结果。先在 CP-1 做单机双屏 JS reload 观察；若副屏不能恢复，唯一条件修法 owner 是 adapter/android/dual-screen 的 TerminalDualScreenActivityHandler.ensureSecondarySurface 及 finishCleanup/releaseUnstarted 生命周期闸，增加可重复 attach/清理后的 generation-safe restore；不改 topology/transport | dual-screen Android handler；U-4 evidence | 设备 red：只恢复 primary 或让 launchRequested 永久卡住必须失败；若设备结果 PASS，不产生无证据代码改动 |
| D-4 | 选择 JVM test source set，不走人工 checklist fallback。给 TerminalTopologyServer 注入 hostAddressResolver、clock 和可控 scheduler/heartbeat state；覆盖新 R-2/R-3 与旧 close/status/stats/HTTP contract | assembly/base/android/android/src/test；android/build.gradle | U-2/U-3 及 INV-1 JVM tests；移除 @Volatile、改回构造期 address、放宽 HTTP/close/stats 任一项都须红 |
| D-5 | 采用 transport 直接依赖 fflate 0.8.3 + base64 文本；Kotlin 不改二进制协议；若 CP-0 解析/Android supporting 失败则停，不手写 compressor/parser | transport package.json、codec/base64/session | U-9 codec round-trip/forced codec；反例换成二进制或 node Buffer 不能悄悄通过类型与 RN boundary |
| D-6 | 只压 state-full logical payload；16 KiB 触发阈值；实际 encoded payload 需同时节省至少 1,024 bytes 和 10%；raw fallback 仅 below-threshold/compression-not-beneficial，codec exception 终态。权威 fixture 用于 forced codec；low-compressibility 与 small-raw 辅助 fixture 分别关闭两个 raw 分支，禁止以一个高度结构化 fixture 假装覆盖全部分布 | contracts topology config + transport codec + D-12 fixture manifest | U-9：恒等 codec、删除 codec、总是 raw、把两个辅助 fixture 强行判为 codec 三个 mutation 均红 |
| D-7 | state-full-chunk 统一形状，revision 属 logical transfer，transferId/total/index/checksum 严格校验；乱序可重排、缺片超时、session generation 作废半套 | contracts wire frame/parser、transport reassembly | U-8：乱序/重复/丢片/重放/未知字段/错 checksum；删除 checksum 或 revision guard 必红 |
| D-8 | 8 MiB encoded payload/reassembly max、2 个并发 transfer、15s partial timeout，均从 contracts typed config 读取；发送切片前与接收累计时各有同一上限闸；按 D-12 fixture 折算只作解释，不是产品容量承诺 | contracts topology config、transport codec/session/reassembly | U-10：发送侧超限零 frame、接收侧超限拒绝且不 apply；删除任一上限须红 |
| D-9 | R-11 采用 slice reference equality，不保留序列化 fingerprint；压缩只对真正变化的 logical payload 执行。跨阶段不丢失另一条不变量：transfer plan 未成功建立前不得递增 `membersSyncRevision`，发送失败不得污染 revision | topology sendMembersSnapshot、U-13 | U-13：无关 slice 不构造、members 变化照常下行、发送失败 revision 不变；若恢复序列化 fingerprint 或提前递增，均须红 |
| D-10 | cancelled remote commands 按**当前在途 commandId 集合**分别记录取消标记，不能实现成单槽；同一 WS 的 request/cancel 有序只证明未知或已 settle cancel 可 no-op。pending peer commands 按 call timeout 与 256 上限收敛；在途命令只能显式 settle/reject，不能因 eviction 静默丢失 | topology command gateway | U-16：并发发起多个远端命令并交叉取消；删除 pending timeout、改成单槽或 remote active bound 须红，断连清空不能作为唯一证明 |
| D-11 | R-15 按 peer/session、state sync、command gateway 三块拆；先在 CP-3 前冻结真实 module 级八项测试及测试文件 hash，拆分后测试文件一行不改 | topology test/module、new internal foundations | U-17：八项 red mutation、拆分前后同一 test bytes/hash、行为全绿 |
| D-12 | 权威业务 fixture 与三份辅助物理边界 fixture 均落盘并哈希固定；权威 fixture 仍是 U-8/U-9 的业务主数据源，辅助 fixture 只覆盖多片、低压缩性和小载荷分支；overflow 使用固定 seed 程序化生成。R-5 收窄保持 selector/retry/connectionToken/replaceServers 可逆公共形态，只删除 limiter、不给 replaceServers/profile 新增消费、不新增多地址配置 | fixture manifest；transport public surface/README/invariants | U-5：四处公共面同步；U-8/U-9/U-18 的 fixture role、canonical bytes、hash、实际 fflate chunk plan 全部 readback；把 selector 收窄、只保留单一 fixture或把辅助数据写成业务容量承诺须红 |
| D-13 | 终态按 payload/slice，不按 session/peer；deterministic 与 transient 分码；新 revision 解锁，new session 只清 partial/transient；最后成功 slice/UI 保留，身份/心跳/其他 slice继续 | transport reassembly + topology diagnostic reducer/actor | U-10/U-18：payload 失败后仍能 heartbeat/reconnect；新 revision恢复；同 revision deterministic 不循环 |
| D-14 | 只在 client session 层挂一个 controller；保留 module 的 ping→pong 业务路径，session 负责 pong mark 与 timeout；control queue 优先；D-17 扩展为“应用层心跳判定的静默失联” | createTopologySession、createTransportHeartbeat、createTopologyModule | U-18：静默失联、普通 reconnect、D-13隔离、分片期间 pong；把 timeout 接 payload terminal 必红 |
| D-15 | 详设和实施计划的第一实施步骤先同步旧 CP-2；明确本批 R-5 对上游字面的有据偏离：保留已消费 selector/retry，删除 limiter，不接线 replaceServers/profile，不新增多地址配置 | old plan CP-2 + current design/plan | U-5/D-15 static search；旧计划残留相反命令即 CP-0 红，不得进入 CP-1 |

## 6 · CP 门控设计

### CP-0

- 可证伪失败：旧 CP-2 仍同时要求 limiter/full generic transport；D-12 manifest 或任一 fixture hash/readback 不一致；fflate 不是 transport direct dependency 或不能通过本仓 resolver。
- 不变量：只有一套 R-5 指令；fixture 读取后 recordCount/hash 与文档一致；所有生产 source/README/invariant/test 分母列出。
- FORBID：修改源码、先写 codec、用 node_modules 传递依赖冒充 direct dependency、更新旧 fixture 原文件。
- 形态理由：先解决两套指令和事实分母，否则后续 focused 结果无法归属。
- RECALL：本需求 §0.2、§3、§4.5、§5、§7、§9 D-12/D-15；旧 plan CP-2；transport package/public surface。

### CP-1 / 阶段一

- 可证伪失败：Kotlin R-2/R-3 无 JVM proof；R-4 只观察 primary；R-5 删除 limiter 后公共面残留或 selector failover 被改变；R-6 缺 slice 抛错；R-7 两次 getStatus 被删除。
- 不变量：旧 HTTP/WS、close/stats、UI 文案、TopologyHostPort contract 保持；动态 R-4 仅在授权设备上观察。
- FORBID：在阶段一改 wire send path/createTopologyModule；没有设备证据不得改 dual-screen restore。
- 形态理由：止血先隔离 wire rewrite，减少 R-8/R-9 失败归因。
- RECALL：R-1～R-7、D-1～D-5、U-1～U-7、TR-02/TR-03/TR-05/TR-06/TR-10。

### CP-2 / 阶段二

- 可证伪失败：压缩后帧未分片、半套 apply、超限会重连循环、raw 总是 fallback、心跳被数据队列饿死、heartbeat timeout 进入 payload terminal。
- 不变量：business module 仍只发送完整 slice；接收侧强 parser 仍运行一次；单片 UTF-8 上限、重组 buffer、TTL、revision、checksum、typed errors 全生效。
- FORBID：Kotlin 二进制协议、key-level delta、关闭接收校验、用断连清内存冒充 bounded。
- 形态理由：C 方案把变更留在 TS transport，最小化 native 表面积但不减少测试。
- RECALL：R-8/R-9/R-10/R-16、D-5～D-9/D-13/D-14、U-8～U-12/U-18、INV-2～INV-5。

### CP-3 / 阶段三

- 可证伪失败：无关 slice 仍构造 full payload；弱 isJsonValue 回归；parser 归属复制；两个集合靠断连才有界；拆分后八项 module behavior 缺失。
- 不变量：R-15 前冻结的 module test bytes 不变；members/cancel 行为不改；U-13/U-16/U-17 全部 real proof。
- FORBID：在没有 CP-2 全批三维 MATCHED 前开始；为拆分改测试以迁就实现；扩大到全仓 isRecord 消重。
- 形态理由：拆分是最高风险的可读性变更，必须把真实行为网先建立再搬代码。
- RECALL：R-11～R-15、D-9～D-12、U-13～U-17、TR-01/TR-02/TR-03/TR-09。

### CP-4 / 交付收口

- 可证伪失败：任一 U 无真实执行体/红变异；步骤级或全批三维对账 OPEN；逐代码与详设对账只抽样；证据档位混写。
- 不变量：U-1～U-18 逐行有结果；static/focused/native/Android/device 分档；未跑项写 OPEN；implementation 未授权前不改源码。
- FORBID：用测试名、退出码、路径存在代替业务 oracle；把设计 fixture hash 当 runtime PASS；把 Claude review request 当 GO。
- 形态理由：交付只收证据，不在 CP-4 增加机制。

## 7 · U-1 至 U-18 执行体与红变异

| 判据 | 执行体/产物 | 红变异 |
|---|---|---|
| U-1 | static：root HANDOFF 五个上游条目+NanoHTTPD 七列；逐字段 source readback | 删除一行、activation token 自由文本、NanoHTTPD 不写双闸 |
| U-2 | assembly/base/android JVM test + static field/lock inspection | 移除 @Volatile 或把 read 放回无锁路径 |
| U-3 | JVM test 注入两次不同 resolver result，检查三调用方/identity status 的第二次值 | lazy/构造期缓存、只在 start refresh |
| U-4 | native/Android supporting：单机双屏冷启动、JS reload、主副屏 UI XML/截图/timeline；结果若失败则按 D-3 修复复测 | 只 dump primary、跳过 reload 后 secondary 或把 OPEN 说成 PASS |
| U-5 | static + transport focused/public-surface test；两个地址 identity failover 与 limiter removal | 删除 selector failover、残留 export/invariant/README、旧 CP-2 指令 |
| U-6 | topology focused：替换 capability facts、缺 slice、equality/undefined；检查返回来源 | 形参 void 后仍读 capability、缺 slice throw |
| U-7 | topology actor focused/readback：每个起宿主路径保留两次 status 与注释 | 删除第二次 status 或删除保留理由 |
| U-8 | contracts/transport/topology focused：先用 D-12 权威 fixture 做完整逐字段 round-trip，再用 multi-chunk stress fixture（CP-0 实测压缩后至少 4 片）覆盖乱序、重复、丢片、checksum、半套不 apply、inflight/TTL；overflow 用固定 seed 生成器触发 | 关分片、删完整性、只断言条数、把 overflow 伪装成普通多片 fixture |
| U-9 | transport codec focused：权威 fixture 做 forced codec 与逐字节 roundtrip；low-compressibility fixture 必须走 compression-not-beneficial；small-raw fixture 必须走 below-threshold；三者均检查 codec 标记和封闭 fallback reason | identity codec、删除 codec、always raw、阈值为0、把辅助 fixture 强行判成 zlib |
| U-10 | transport/topology focused with deterministic fake session：发送侧 encoded 总量超限时零 frame 且产生 `reassembly-overflow`；接收侧注入超限 chunk 时拒绝且不 apply；两侧均不 reconnect loop、revision 不增长、payload diagnosis、reassembly 收敛；overflow generator 的实际 encodedBytes 必须超过 8 MiB | 删除发送侧预检、恢复原吞错/handlePeerLoss whole session、删除接收侧上限、无 buffer TTL、仅用 disconnect 清理代替 overflow |
| U-11 | spies at logical payload/canonical serialization/compress/frame boundaries；接收 parser仍执行 | 把 serialization藏进 encodeChunks、删除发送前 guard、删除接收校验 |
| U-12 | static import boundary + topology focused logical call sites；members revision/apply full slice | codec/chunk branch进入 createTopologyModule、key delta |
| U-13 | topology module real focused with non-members state tick + real members mutation + injected send failure；分别断言无关 slice 不构造、members 照常下行、transfer plan/send failure 不递增 membersSyncRevision | 恢复 unconditional send、只保留不发送而删掉真实 members path、把 revision 在 send 前递增 |
| U-14 | static + focused malformed JSON value test，证明 transport 重组与 topology module 直接调用 contracts 强谓词；另证明 4,097 条 members 数组在字节上限内可 round-trip，而 command payload 仍受 4,096 条数组保护 | 回退无深度/键长/有限数校验；给 state-full 重新加业务数组硬上限；transport 恢复本地 predicate |
| U-15（本稿） | topology focused/status parser对缺/多/错类型逐类拒绝；parser owning package readback | 复制类型到 contracts、放宽任一畸形状态 |
| U-16 | topology module long-lived pressure test：并发发起多个远端命令，交叉取消不同 commandId，观察逐 command settle、pending/cancel entry count 和 TTL/容量收敛 | 删除任一容量/TTL、把取消实现成单槽、只靠 disconnect 清理 |
| U-17 | CP-3 precondition evidence：八项 real module tests + 8 mutation red；拆前后 test file hash及全绿 | 少测一项、纯 helper、改 test 文件、删 force/cancel/disconnect调用 |
| U-18 | transport/topology fake clock + multi-chunk stress fixture 的 delayed multi-chunk session；静默 no FIN/no pong → peer loss/reconnect；chunk期间 pong | 去掉 heartbeat、timeout进 payload terminal、使用单片 fixture、低优先级导致 chunk期间无 pong |

特别说明：需求 R-5 中“上游 U-15 随之作废”指上游 2026-09-17 需求的 U-15，不是本需求 §7.3 的 U-15 parser 判据。本详设保留本稿 U-15，避免两个命名空间互相覆盖。

## 8 · 测试覆盖设计（Dexter 要求：基建能力充分覆盖）

### 8.1 contracts

新增/扩展 topologyWire tests：

- 每种 control frame 和 state-full-chunk 的 exact-key/type/range 解析；
- unknown field、missing field、wrong direction、unknown codec、index/total 越界、raw/encoded bytes 不匹配；
- revision stale/replay、same index conflicting chunk、checksum mismatch；
- TOPOLOGY_* error union 只接受闭合成员；
- golden vectors：hello、identity、command request/result/cancel、state-full-chunk、ping/pong、closed-error。

### 8.2 transport

新增/扩展 owned tests：

- fflate codec + base64 roundtrip；
- D-12 权威 fixture 强制 codec；
- low-compressibility 与 small-raw 辅助 fixture 分别覆盖 compression-not-beneficial/below-threshold 两个 raw fallback；
- multi-chunk stress fixture 经过实际 fflate 后必须形成至少 4 片，并用于乱序、重复、丢片、半套、inflight/TTL 与 heartbeat 饥饿测试；
- 固定 seed overflow generator 产生超过 8 MiB encoded payload，不把它写成业务容量 fixture；
- no raw on codec exception；
- session write queue 控制帧优先；
- reassembly乱序/重复/缺片/TTL/max bytes/max inflight/session generation；
- heartbeat start/markPong/timeout/stop/sequence；
- U-11 spy 层级；
- identity client 两地址 failover 必须与 R-5 之前一致。

### 8.3 topology

在 R-15 前扩展现有 topology/test/topology.test.ts 的真实 module 级行为（不是纯 helper）：

1. members slice 变化发送完整 slice；
2. 无关 slice 变化不发送；
3. accept peer 强制补齐；
4. send failure pending settle；
5. remote cancel 不执行/不错误回传；
6. disconnect pending settle；
7. completed/partial-failed/timed-out/error 四态；
8. 任一删除/错误清理 mutation 变红。

R-15 只移动生产实现，不修改这份测试文件；如果测试 import 需要改，视为设计/实现未就绪，必须先回到 CP-3 重新调整拆分边界。

### 8.4 Kotlin/JVM

新增 assembly/base/android 的 android/src/test，依赖 JUnit 4.13.2。通过可注入 clock/resolver/scheduler 或可单测的 package-private behavior helper 覆盖：

- @Volatile lastPongAt 的跨线程可见性承接；
- address() 每次查询读取 resolver；
- status JSON、HTTP status/Content-Type/body；
- TOPOLOGY_ROLE_OCCUPIED、TOPOLOGY_TIMEOUT 等 safeCloseReason；
- stats 字段集与 bind failure 分类；
- R-2/R-3 mutation 与旧 contract mutation 均能红。

这不是声称 Android 设备行为已验证；它是为当前零测试 Kotlin source set 建立最低可重复门。

## 9 · 跨层同步矩阵（对应模板 §9a）

| 变更事实 | 唯一源/契约 | 消费者 | 测试/fixture | 结论 |
|---|---|---|---|---|
| transport config、端口、basePath、heartbeat、timeout、buffer bounds | contracts/topology-transport.config.json + typed projection | TS transport/topology、Kotlin HostConfig、runner readback | contracts parser、Kotlin JVM、runner evidence | 同步修改；不在消费者复制 |
| state-full physical chunk shape | contracts topology.ts/topologyWire.ts + INV-1 C-3 | transport session、native text pipe、topology logical consumer | golden vectors、chunk/reassembly tests、D-12 fixture family | `state-full` → `state-full-chunk`（含 `total=1`）登记为 C-3；生成/消费链同步 |
| codec/raw fallback | transport codec owner | session send/receive only | authoritative fixture + low-compressibility/small-raw fixtures、U-9 red | transport 直接依赖 fflate；各 fixture role 不混写 |
| payload typed errors/terminal diagnosis | contracts error union + topology diagnostics owner | topology UI/admin log projection | U-10/U-18 | 新成员登记 C-4/C-5 |
| R-5 transport public surface | transport index/invariants/README/test + old CP-2 plan | identity client、future consumers | U-5 public surface/failover | limiter 删除；selector/retry保留 |
| R-6 facts undefined semantics | topology selector/capability/TopologySection/member actor | admin shell、member navigation | U-6 | selector guard及消费者同步 |
| R-2/R-3 Kotlin server behavior | TerminalTopologyServer + JVM tests | HostRegistry/native port | U-2/U-3 + JVM legacy tests | server与test source set原子组 |
| D-12 fixture family | doc/plans/platform/fixtures/ter-dual-machine-members-fixture-manifest.json | U-8/U-9/U-18 focused executor，不允许生产 import；overflow 由固定 seed 生成器承接 | 每项 file hash、canonical members bytes/hash、CP-0 fflate chunk plan | 权威 fixture 仍是业务主数据源；辅助 fixture 不进入 runtime、seed 或 HANDOFF 容量承诺 |
| R-15 module state ownership | createTopologyModule split anchors | topology module public API | frozen topology.test.ts hash | stage 3 only |

## 10 · owner API / consumer 清单

| owner | consumer |
|---|---|
| contracts topology config/protocol parser | transport session/codec；topology only through session |
| transport createTopologySession | createTopologyModule peer session |
| transport createTransportHeartbeat | createTopologySession client-side heartbeat |
| topology selectTopologyFacts | topology capability、TopologySection、member-desk actor、command target resolver |
| platform-ports parseTopologyHostStatus | topology actors/native status consumer |
| TerminalTopologyHostRegistry | existing platformPorts/native module only |
| D-12 fixture family | U-8/U-9/U-18 focused test executor；overflow generator；不允许生产 import |

任何新 owner 若在实施后零消费者，CP-4 逐代码对账必须标 OPEN；不能用 README 或类型导出制造“支持”。

## 11 · seed / migration / UI

- §10 migration：N/A_WITH_REASON；无数据库、schema、Flyway或持久化模型变更。
- §10b seed：N/A_WITH_REASON；D-12 fixture family 是 acceptance/design 输入，不是 DEV seed，不得写入 sample seed。
- §3a UI/L2：N/A_WITH_REASON；不新增 UI-bearing Journey、不改 testId、不写浏览器脚本。U-4 的 native/Android 观察是双屏基础设施 evidence，不是 L2。
- README：transport、contracts、topology、assembly/base/android 需按 TR-10 同步，示例只能引用真实 owner；不能继续写未接线 limiter/replaceServers/profile 是本批拓扑能力。

## 12 · 未决外部事实与处理

| 项目 | 状态 | 本批处理 |
|---|---|---|
| RN WebSocket 独立文本帧上限 | UNVERIFIED | CP-0 记录为外部风险；CP-2 仍以 48 KiB chunk target + runtime supporting evidence 验证；不得宣称无限容量 |
| OkHttp 自动 protocol pong | UNVERIFIED | R-16 不依赖；只验证应用层 ping/pong |
| R-4 ReactHostImpl.reload 后 Presentation 恢复 | UNVERIFIED until U-4 | 设备观察决定是否触发 D-3 条件修法 |
| fflate 0.8.3 在本仓 Expo/RN resolver | PRECHECK_REQUIRED | CP-0 typecheck/Metro-independent resolver check；失败即停，不换成手写压缩 |

这些不是 D-1～D-15 的空缺；它们是设计明确知道的外部证据档位，未执行时必须保持 OPEN。

## 13 · 停机条件

- CP-0 发现 fflate 不能成为 transport direct dependency、或旧 CP-2 无法同步成一套指令：停，不写 codec。
- CP-1 JVM source set 无法在 assembly/base/android 可重复运行，或 Kotlin 旧 HTTP/close/stats contract 无法建立测试：停在 D-4。
- U-4 发现 dual-screen 修法超出 adapter/android/dual-screen，需 Dexter 决定，不得静默扩大。
- CP-2 若需要 binary WebSocket、改变 native payload 类型、或需要 key-level delta 才能通过：停并交范围裁决。
- 任何 payload 终态方案会停止 session/peer/heartbeat/reconnect：停，违反 D-13/R-16。
- R-15 若测试必须改写或八项 coverage 有一项无法对真实 module 证伪：停，不拆。
- 逐代码/详设对账任一 OPEN：交付语句只能是“实施未就绪”。

## 14 · 实施节奏与三维对账

每个 CP 结束后、下一个 CP 开始前，由 fresh 只读独立子 agent 逐项核对三维：

1. 需求：R/INV/U、Dexter 裁定、明确不做；
2. 本详设及计划：D、owner、字段、失败/恢复、测试和证据；
3. 项目 memory：terminal coding standard、verification governance、failure/retry、handoff and scope rules。

三维对账不是测试，也不能由主 agent 的自读或 Claude review 冒充。全部 CP 完成后、任何整体测试/设备动作前，再做全批三维对账；交付前主 agent 逐代码与详设逐行对账，结果只能 MATCHED 或 OPEN。

## 15 · 交付状态

当前状态：

- 需求：已由 Claude 第二轮复评后收口，Dexter授权本轮产出详设与实施计划。
- 设计：本文件 PROPOSED_FOR_DESIGN_REVIEW。
- fixture：D-12 权威 fixture、三份辅助 fixture和 manifest 已实际创建并哈希；manifest 已写入 CP-0 的 fflate 0.8.3 encodedBytes/chunkCount/branch 实测；这些数据仍不是容量承诺。
- 源码：未修改。
- 验证：未运行。
- implementation：未授权、未开始。
- Claude/Dexter review：Claude round2 GO；Dexter 已授权实施；本详设不宣称 implementation acceptance。

## 16 · Claude DESIGN review finding intake（本轮）

本节只记录对本轮 Claude review 的辩证处置，不把历史 NO-GO 改写成 GO，也不代表源码已实施。

| finding | 状态 | 处置 | 最小性与验证边界 |
|---|---|---|---|
| M-1 fixture 无法承接多片、重组上限和 delayed multi-chunk | CONFIRMED | 保留权威业务 fixture；新增 multi-chunk stress fixture；overflow 改为固定 seed 程序化生成；U-8/U-18 分别绑定执行体 | 不调小 48 KiB 生产配置；CP-0 用实际 fflate 冻结 chunk plan，CP-2 才执行 focused proof |
| M-2 高结构化 fixture 无法关闭两个 raw fallback | CONFIRMED | 新增 low-compressibility 与 small-raw fixture，分别固定 `compression-not-beneficial` 与 `below-threshold`；权威 fixture仍负责 forced codec | 不把辅助数据称为业务分布或容量承诺；U-9 逐 fixture 校验 branch/reason |
| S-1 D-10 单数表述无法约束并发取消 | CONFIRMED（源码当前已用 Set） | 改成在途 commandId 集合；U-16 并发交叉取消 | 不增加新的取消机制，只把设计契约与既有集合形态对齐 |
| S-2 信封字节误作 logical payload | CONFIRMED | 改为 members 规范化 62,389 字节，并要求 CP-0 走真实 payload→codec→chunk plan | 62,535 仅保留为完整 fixture 文件/信封大小，不再用于容量推导 |
| S-3 fingerprint 删除后 revision 不变量失去 owner | CONFIRMED | 明确 transfer plan 成功后才递增 revision；U-13 加发送失败不变断言与 red mutation | revision 不依赖 fingerprint，阶段二/三均适用 |
| N-1 U-1/U-4 red 类型需标注 | CONFIRMED | U 表格注明文档/证据方法 mutation 与 production mutation 的区别 | 不伪造 production red |
| N-2 limiter 与 control-priority queue 易混淆 | CONFIRMED | 在阶段二明确 queue 是优先级调度，不是阶段一删除的 limiter | 不恢复 limiter |
| N-3 state-full-chunk 未登记 C-3 | CONFIRMED | 跨层矩阵将 `state-full`→`state-full-chunk`（含 total=1）登记到 C-3 | 不新增需求编号，使用现有登记 |

上一轮修改仅触及本详设、实施计划和 `doc/plans/platform/fixtures/` 设计输入；没有修改 apps/源码、测试、依赖、脚本、Gradle 或构建产物。该历史状态已由 Claude round2 DESIGN GO 与 Dexter 的实施授权取代；本节不记录 implementation acceptance。

## 17 · Claude DESIGN review round2 intake 与授权状态

| finding | 状态 | 处置 | 实施边界 |
|---|---|---|---|
| S-1 发送侧缺少 encoded 总量预检 | CONFIRMED → 真修复并已验证 | 发送顺序在切片前读取 `topologyReassemblyMaxBytes`；超限产生与接收侧相同的 `reassembly-overflow`，不建立 plan、不分配 transferId、不发 frame；U-10 覆盖发送零 frame与接收防御闸 | `createTopologyStateTransferPlan` focused；详见 CP-2 evidence |
| N-1 manifest 的 fflate 溯源标注不一致 | CONFIRMED → 真修复并已实测 | manifest 不再把 multi/low 的值写成未区分来源的预览；四份 fixture 和 overflow generator 均写入 `CP-0_ACTUAL: fflate 0.8.3` 及实际 encoded/chunk 数据，Node zlib 仅保留在历史说明中 | manifest 与 CP-0 evidence 逐项一致 |
| N-2 low fixture 单记录 | CONFIRMED → fixture 修复 | low-compressibility fixture 改为 4 条高熵记录，保持 `compression-not-beneficial` 分支，并同步 manifest/hash | CP-0/CP-2 复核 branch 与逐记录 round-trip |
| N-3 fresh 独立子 agent 盲审 OPEN | OPEN（DEXTER_WAIVER） | 不改写为完成；明确记录 Dexter 已豁免该前置并授权进入实施 | 不把 Claude round2 或本表当作 fresh blind verdict；实施仍须真实三维对账和复评 |

Claude round2 已给出 DESIGN GO，Dexter 已授权实施；本节只记录授权来源和 OPEN 状态，不构成 implementation acceptance。U-4 第一阶段仍因缺少单机双屏设备保持 OPEN。

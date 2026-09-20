# TER 双机拓扑基建加固 · 实施计划

SKILL_USED=cs-spec-to-plan@local-.agents/skills/cs-spec-to-plan
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
DOCUMENT_KIND=IMPLEMENTATION_PLAN
REVIEW_TARGET=DESIGN
DESIGN_SOURCE=doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-design-codex.md
BUSINESS_SOURCE=doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-requirements-claude.md
OLD_PLAN_SOURCE=doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md
DESIGN_GRANULARITY_MANIFEST=doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-design-granularity.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-design-adversarial-review-codex.json
IMPLEMENTATION_AUTHORITY=true
PLAN_STATUS=IMPLEMENTATION_AUTHORIZED_BY_DEXTER_2026-09-18
AUTHORIZED_NOW=按 Claude 第二轮 DESIGN review GO 与 Dexter 明确授权，执行 CP-0～CP-4、两阶段动态验证和实施复评交接；U-4 第一阶段保持 OPEN
NOT_AUTHORIZED_NOW=超出本计划的产品语义、未列出的生产机制、数据库、设备级开机自启、Git

## 1. 计划目标、用户价值与范围

### 1.1 要解决的真实问题

当前拓扑的 members 完整同步在单个文本帧上承受 64 KiB 的隐式上限；超限后传输失败会被误当作连接问题，副机可能进入连接、发送失败、重连的循环。与此同时，Android host 的地址读取和心跳可见性存在并发边界，副机没有应用层静默分区检测，拓扑 module 的 members/cancel 路径缺少真实 module 级覆盖。

本计划要交付的是可靠的拓扑基础能力：

- 完整 slice 同步可压缩、可分片、可校验、可有界重组；
- 一个 payload 失败不会关闭 peer、session、身份、心跳或其他 slice；
- 主机与副机的 host 生命周期、地址、心跳和重连行为可测试；
- transport 的本期公共面与实际消费一致，同时保留未来可逆形态；
- createTopologyModule 在真实行为网建立后再拆分，拆分不改变行为；
- 基建能力有充分的 contracts、transport、topology、Kotlin/JVM、native supporting 和设备级覆盖。

Dexter 对“充分测试覆盖”的要求是本计划的交付条件，不是建议项。每个新增机制必须有正常路径、失败/恢复路径、边界路径和能改变 production 行为的 red mutation；只有测试名称、退出码、路径存在或截图差分不能作为业务 oracle。

### 1.2 已采纳方案

采用详设中的 C 方案：transport 直接使用 fflate 0.8.3 的 zlib 与纯 TypeScript base64 helper，JS 侧分片，Kotlin 保持文本管道。业务层仍只产生完整 state-full slice；codec、chunk、reassembly 和 buffer 上限均封装在 contracts/transport/session 边界。

不采用：

- 只扩大单帧上限：仍有 RN、设备内存和未来业务分布的隐式天花板；
- 本批改二进制 WebSocket：会把 Kotlin、Expo/RN bridge、JS 解码和设备证据一起扩大；
- key 粒度 delta：违反整片同步裁定；
- 在本批构建尚未接线的多地址、profile 注册或通用 limiter 消费者；
- 先拆 topology module 再补行为测试：会把未覆盖误当作拆分等价。

### 1.3 非目标

不新增认证/授信、设备级 BOOT_COMPLETED 自启、mobile 或双屏 laptop 拓扑支持、数据库/schema/migration/seed、Web/L2 代替终端证据、二进制 WebSocket、key-level delta、业务容量承诺、未在需求 R-1～R-16 或本详设中列出的生产机制。

## 2. 前置条件与交付物

### 2.1 开工前置条件

设计 review 未 GO 前，不执行本计划的任何源码、依赖、Gradle、构建或设备动作。设计 review GO 后，真正进入实现还必须满足：

1. 需求当前字节仍为 doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-requirements-claude.md，且 R-5 的收窄、R-16、D-12/D-13/D-14/D-15 没有被新版本覆盖；
2. D-12 fixture manifest、权威/辅助 fixture 的路径、recordCount、canonical members bytes/hash 和文件 SHA-256 一致；
3. fflate 0.8.3 能作为 apps/terminal/kernel/base/transport/package.json 的直接 runtime dependency 被当前 Yarn/TypeScript/Expo resolver 解析；否则停在 CP-0；
4. 两个 integration 的真实装配和本批 allowlist 分母可从源码重算；
5. 可提供真实跨进程或跨设备的双设备边界；不能用单进程两个 runtime 冒充；
6. 每个 CP 都能在下一 CP 前安排 fresh 只读独立三维对账；没有该对账，不得推进；
7. 旧 CP-2 计划在 CP-0 首步同步为本计划和详设的单一指令；
8. 任何硬约束没有 owning source、测试或可执行证据时，状态为 OPEN，不以设计文字代替。

### 2.2 交付物

| 交付物 | owner | 计划落点 | 关闭条件 |
|---|---|---|---|
| D-15 旧计划同步 | 主 agent | 旧 CP-2 文档、当前详设/计划交叉引用 | 不再存在相反实施指令，U-5 静态核对 MATCHED |
| HANDOFF/CVE 登记 | 主 agent | HANDOFF.md | 五条上游事实、两道 CVE 闸和条件化措辞可逐字段回源 |
| Android host 可测试边界 | assembly/base/android | TerminalTopologyServer.kt、JVM test source set | U-2/U-3 与旧 HTTP/close/stats 契约全绿 |
| R-5 transport 收窄 | transport | public export/invariant/README/test | limiter 删除；selector/retry/connectionToken 保留；无新增未授权消费者 |
| config/wire/parser | contracts | config、types、parser、golden vectors | U-8/U-9/U-10/U-15 的 typed oracle 可运行 |
| codec/chunk/session/heartbeat | transport | codec、session、reassembly、control queue | U-8～U-12/U-18 及 red mutation 全绿 |
| topology 行为覆盖与拆分 | topology | 真实 module tests、内部职责文件 | U-13～U-17；拆分前后测试文件 bytes 不变 |
| D-12 fixture family | 文档/测试输入 | doc/plans/platform/fixtures/ter-dual-machine-members-fixture-manifest.json 及其四份 JSON fixture | 权威业务 fixture 与三份辅助 fixture 的版本、路径、hash、canonical bytes/readback 已记录；overflow generator 规则已记录；不进生产、seed 或 HANDOFF |
| 证据与交接 | 主 agent | doc/evidence/platform/、doc/review/platform/ | static/focused/native/device 分档；逐代码与详设对账为 MATCHED |

## 3. 总顺序与不可并行规则

CP-0 / D-15 首步、源码分母与依赖预检
→ CP-1 / 阶段一：R-1～R-7 独立止血
→ CP-2 / 阶段二：R-8～R-10、R-16 压缩/分片/终态/心跳
→ CP-3 / 阶段三：R-11～R-15，R-15 最后
→ CP-4 / 全批测试、证据、逐代码与详设对账、review handoff

阶段一、阶段二、阶段三不得并行。阶段二重写 session 的发送、接收和心跳控制队列，阶段三必须等阶段二的 full focused proof 和全批三维对账 MATCHED 后才开始。R-15 是最后一个生产结构变化；CP-4 不新增机制。

每个 CP 的闭环固定为：

1. 主 agent 逐项重读对应需求、详设、项目 memory 与 owning source；
2. 主 agent 完成该 CP 的代码、测试、依赖、README 或证据变更；
3. 主 agent 运行最小 focused proof，保存原始输出；
4. fresh 只读独立子 agent 逐项做需求、详设/IA、项目 memory 三维对账；
5. 任一项 OPEN，主 agent 按 owning source 最小修复，focused 重验，再让独立审查复查；
6. 只有全部 MATCHED 才进入下一个 CP。

全部 CP 完成后、任何整体测试或设备运行之前，另做一次全批三维对账；它不能由步骤级结果汇总替代。交付前再做逐代码与详设逐行对账；该对账与三维对账也不能互替。

## 4. CP-0：D-15 首步、事实分母与依赖预检

### 4.1 D-15 必须是第一实施步骤

主 agent 获得实施授权后，第一件事不是写 codec，而是修改并回读：

doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md

同步内容必须逐项写成当前唯一指令：

- 删除或改写旧 CP-2 中要求本批新增/接线 createTransportLimiter 的语句；
- 保留 resolveTransportServerAddresses、createTransportRetryController 和 identity client 已消费的多地址 selector/failover 行为；
- 保留可逆的 connectionToken/替换形态，但本批不新增 replaceServers 或 WS profile 的生产消费；
- 本批不新增多地址配置来源，不把未来通用形态写成当前已接线能力；
- createTransportHeartbeat 的新增消费放入阶段二 R-16，并写明是副机应用层心跳，不等于 Kotlin server 单向协议 ping；
- 把“上游 U-15 随之作废”标成上游 2026-09-17 文档的 U-15；本需求 §7.3 的 U-15 parser 判据保留；
- 同步本计划、详设和旧计划的交叉引用。

完成后以 rg 检索旧 CP-2 中的 limiter、replaceServers、profile registration、full generic transport 等词，逐条分类为“已删除指令”“保留但本批不消费”“阶段二 R-16”，不能只改标题。任一相反指令残留，CP-0 为 OPEN，禁止 CP-1。

### 4.2 CP-0 只读事实与预检步骤

1. 重开需求 §0.3、§3、§4.5、§5、§7、§9、§10；建立本次实现输入版本记录。
2. 重算 transport public surface：源文件、index export、terminal-invariants.json、README、owned tests 四处；确认 limiter 的完整移除分母和 selector/retry 的保留分母。
3. 读取两个 integration 的 assembly/parts，确认真实 secondary allowlist 与 member fixture 适用边界。
4. 读取 Kotlin build.gradle、source set、Native host port、现有 HTTP/WS route；确认 D-4 的 JVM test source set 可以接入。
5. 将 fflate 0.8.3 作为 transport direct dependency 做 resolver/typecheck preflight；不得用传递依赖、Node Buffer 或手写压缩替代。
6. 读取 D-12 fixture manifest，验证权威 fixture 仍为 U-8/U-9 的业务主数据源；逐项核对四份 JSON 的 recordCount、canonical members 字节/hash、文件 SHA-256 和用途；不得覆盖旧权威 fixture。
7. 用当前已解析的 fflate 实际跑一次 `createFullSyncPayload → canonical bytes → codec → chunk plan`：权威 fixture 必须可 forced codec，多片 fixture 压缩后至少 4 片，low-compressibility 必须走 `compression-not-beneficial`，small-raw 必须走 `below-threshold`。记录实际 encodedBytes/chunkCount；不得把 node-zlib 预览值当作 fflate 事实。
8. 预演固定 seed overflow generator，证明它能在不进入生产 import 的情况下生成超过 8 MiB encoded payload；只记录生成规则与结果，不把它登记为业务容量 fixture。
9. 检查 v1/废弃源文件；不存在时记录 OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED，存在时只登记候选，不在本计划内扩大删除。
10. 建立 CP-0 evidence：D-15 diff/readback、依赖解析输出、fixture manifest/hash/readback、实际 fflate codec/chunk plan、overflow generator readback、分母清单、first failure/last known good/broken boundary（如有）。

### 4.3 CP-0 收口

CP-0 必须证明：

- 旧计划和当前计划只有一套 R-5 指令；
- D-12 权威与辅助 fixture 是真实、可复现、有 hash 的独立产物，且每份用途和 canonical members 分母明确；overflow generator 可复现但不被伪称业务 fixture；
- fflate 是 direct dependency 且 resolver 可用；
- 后续所有 source/test/public-surface owner 已列出；
- 未开始 codec、整体测试或设备运行。

失败处理：fflate 不可解析、D-15 不能同步、fixture hash 不符或 owning source 缺失时停在 CP-0；保留原始输出，不延长 timeout、不盲目重跑、不退回单纯扩大帧上限。

CP-0 后必须由 fresh 只读独立子 agent 做三维对账，结果逐项仅允许 MATCHED 或 OPEN。

## 5. CP-1 / 阶段一：独立止血与可观察恢复

### 5.1 实施范围

#### R-1 / HANDOFF 与外部风险登记

在 HANDOFF.md 增补五个可回源条目：

- NanoHTTPD 保留及 HANDOFF 登记；
- activation token 不等于认证/授信；
- 协议版本协商未实现且不得宣称已完成；
- JS reload 后副屏恢复为 U-4 的设备证据项；
- CVE-2022-21230 的条件化静态结论：TER GET/WS route 与上游 serve 的 PUT/POST body parse 链条需要完整覆盖，不能写成实际攻击不存在。

每条必须有 owning source、适用条件、当前证据档位和下一步，不把 HANDOFF 登记写成安全 PASS。

#### R-2 / R-3 / R-4 Android host

在现有 TerminalTopologyServer.kt owner 内：

- lastPongAt 读写采用明确跨线程可见语义，保留锁边界；
- address() 每次读取动态 resolver，不缓存构造时地址；
- bind/role occupied/timeout 等错误使用闭合 typed reason；
- 不新增 BOOT_COMPLETED、BootReceiver 或设备级开机自启；
- host start/stop/status/close/stats 的已有行为保持。

D-4 选择 JVM test source set：在 assembly/base/android/android/src/test 建立 JUnit 测试及可注入 clock/resolver/scheduler，必要时只抽取 package-private behavior helper，不把业务协议复制到测试。覆盖 R-2/R-3 和旧 HTTP status、Content-Type/body、close、stats、safeCloseReason。

#### R-5 transport 收窄

删除 createTransportLimiter 的 source、export、type、invariant、README 和 owned test 记录。保留并不改行为：

- resolveTransportServerAddresses；
- identity client 的多地址顺序 failover；
- createTransportRetryController；
- connectionToken 的可逆 public shape。

本期不新增 replaceServers、WS profile 注册、多地址配置或新的消费者。README 只能描述真实已消费能力；不能用 public export 假装接线已完成。

#### R-6 / R-7 topology facts

- selectTopologyFacts 缺 slice 时返回 undefined，消费者显式转换为 unavailable，不调用会抛错的 root selector；
- operation evaluator 接收操作维度，只返回 operation-level allowed/reason；paired/reachable facts 由独立 selector 提供；
- member-desk 的所有 12 个调用点使用新的 topology-aware predicate；既有物理 resolveSecondarySurfaceAvailable 的两个生产调用方和四个测试不改；
- 保留 topology host 起停路径中的两次 status 读取，并保留解释性注释；
- 不让 UI 自行用 paired/reachable 重组 operation availability。

### 5.2 CP-1 focused proof 与红变异

| 范围 | 最小 proof | 必须变红的反例 |
|---|---|---|
| Kotlin visibility/address | JVM test | 去掉 @Volatile、恢复构造时 address、只在 start 刷新 |
| old server contract | JVM test | 改 HTTP status/body/content-type、跳过 close/stats/safe reason |
| R-5 public surface | static + transport owned test | 只删源文件留下 export/invariant/README；收窄 selector 使 identity failover 改变；旧 CP-2 相反指令残留 |
| R-6 facts | topology focused | 缺 slice 抛错；UI 从 paired/reachable 自算 allowed；selector 形参 void 后仍读取 capability |
| R-7 status | topology focused/source readback | 删除第二次 status read 或删除其原因注释 |
| U-4 | 已授权 native/device supporting | 只 dump 主屏、跳过 JS reload 后副屏、把未执行写成 PASS |

U-4 只验证现有 single-machine dual-screen JS reload/secondary restore。设备结果失败时，按 D-3 只在 TerminalDualScreenActivityHandler 的 attach/cleanup/generation-safe restore 边界修复；设备结果未拿到前不得预先改代码。

### 5.3 CP-1 收口

阶段一不得改 state-full send path、压缩、分片、reassembly 或 createTopologyModule 拆分。CP-1 收口要求 U-1～U-7 的 focused/static 证据完成；U-4 未授权或未执行则保持 OPEN。完成后 fresh 独立子 agent 做步骤级三维对账，全部 MATCHED 才进入 CP-2。

## 6. CP-2 / 阶段二：容量、终态与双向应用层心跳

### 6.1 contracts 先行

在 contracts 中先完成并测试：

- typed transport config：16 KiB compression threshold、1 KiB/10% minimum saving、48 KiB chunk target、64 KiB full-frame guard、8 MiB reassembly max、2 inflight、15s partial timeout、256 pending commands；
- state-full-chunk exact-key wire type、protocol version、slice/direction/revision、transferId/index/total、codec、rawBytes/encodedBytes/checksum/payload；即使 `total=1` 也统一使用该帧形状，并把 `state-full` → `state-full-chunk` 的线上形态变化登记为需求 INV-1 的 C-3，不另造未批准的 C-6；
- closed error union：below-threshold、compression-not-beneficial、codec failure、checksum failure、decoded-invalid、reassembly overflow/timeout、peer loss 等按其生命周期分类；
- golden vectors：hello、identity、command request/result/cancel、state-full-chunk、ping/pong、closed-error；
- parser fail closed：未知字段、多字段、类型/范围/方向/codec/总数/index/bytes 不合法均拒绝。

contracts 只拥有类型、config 和 parser，不 import transport，不调用 fflate。

### 6.2 transport codec/session/reassembly

在 transport：

1. 以 fflate 的 zlibSync/unzlibSync 和无平台依赖 base64 helper 实现 codec；不使用 Node Buffer；
2. 只压完整 members state-full logical payload，不压 control frame，不做 key-level delta；
3. 超过阈值且同时满足最小 bytes/ratio 才走 codec；codec exception 不静默 raw；
4. 编码完成后，以 `encodedBytes` 对照 `topologyReassemblyMaxBytes` 做发送侧总量预检；超限直接产生与接收侧相同的 typed deterministic `reassembly-overflow`，不建立 chunk plan、不分配 transferId、不发送 frame；
5. 未超限的 encoded payload 按 48 KiB 目标切片，完整文本帧以 UTF-8 64 KiB guard 判定；
6. checksum 作用于解压后的 canonical bytes，收齐后才 apply；
7. 接收允许乱序和相同 chunk 重复，不允许同 index 不同内容；超时、session generation 变化、超限清理半套；接收侧仍保留同一 `topologyReassemblyMaxBytes` 防御闸；
8. deterministic payload failure 锁定 slice/revision/checksum；new revision 解锁；new session 只清 partial/transient；
9. 最后成功 members 保留，identity、heartbeat、peer reconnect、其他 slice 保持；
10. session control queue 高于 data chunk queue；R-16 心跳在同一 session 层接入；
11. 发送失败不得预先污染 `membersSyncRevision`；阶段三删除序列化 fingerprint 后，该不变量仍由“合法 transfer plan 成功建立后才递增 revision”承载，不得依赖 fingerprint 存在。

这里的 control-priority queue 是阶段二的发送调度优先级，不是阶段一 R-5 删除的 `createTransportLimiter`。limiter 是并发/速率限制；queue 是在同一 session 内让 ping/pong、cancel 等控制帧先于 data chunk，不能以换名方式恢复 limiter。

### 6.3 R-16 心跳

在 SLAVE/client createTopologySession 上挂 createTransportHeartbeat：

- open 启动、close/error/peer-loss 停止；
- 每 10 秒发应用层 ping，30 秒无 pong 触发普通 peer-loss/reconnect；
- pong 先更新 heartbeat controller，再交给现有 module handler；
- ping/pong 为 control-priority，数秒分片传输不能饿死；
- timeout 不能产生 D-13 payload terminal；
- 主机 Kotlin 的协议层 ping 保留，OkHttp 自动 protocol pong 不参与本批正确性；
- 主机收到应用层 ping 的回复路径保持单一，不产生双回复。

### 6.4 CP-2 测试覆盖

| 覆盖面 | 测试内容 | 红变异 |
|---|---|---|
| contracts parser | exact-key、golden vectors、字段/方向/范围/bytes/revision | 放宽字段、复制 union、删 checksum/revision guard |
| D-12 transfer | 权威 570-member fixture 做完整逐字段 round-trip；multi-chunk stress fixture 经过实际 fflate 后至少 4 片，覆盖乱序/重复/丢片/checksum/半套/inflight/TTL；overflow 用固定 seed generator | 关分片、只比条数、删完整性、把 overflow 降成普通多片 |
| codec | 权威 fixture forced codec/逐字节 roundtrip；low-compressibility fixture 走 compression-not-beneficial；small-raw fixture 走 below-threshold；所有 branch 检查封闭 reason | 恒等 codec、删 codec 调用、总是 raw、阈值设 0、把辅助 fixture 分支判错 |
| reassembly | 发送侧 encoded 总量预检零 frame；接收侧 max bytes、max inflight、partial TTL、session generation；两侧共用 `reassembly-overflow` typed reason | 删除发送侧预检、删除接收上限/TTL、只靠断连清理 |
| terminal failure | deterministic/transient 分类、payload terminal、新 revision、新 session、最后成功 slice 保留 | payload failure 关闭 peer、反复重传同 revision、无限 reassembly |
| U-11 count | full payload=1、canonical serialize=1、compress=1、frames=N 不计重复 slice | 把 frame serialize 藏进 chunk、删发送 guard、删接收校验 |
| heartbeat | fake clock、multi-chunk stress fixture 的 delayed writes、静默无 FIN/no pong、普通 reconnect、chunk 期间 pong | 去心跳、timeout 入 payload terminal、改用单片 fixture、data queue 饿死 control |
| R-5 regression | two-address identity failover 与 CP-1 相同 | selector 收窄、错误改 URL owner |

### 6.5 CP-2 收口

CP-2 必须完成 U-8～U-12 和 U-18 focused proof，且所有 D-13/R-16 终态隔离断言成立；U-13 的“发送失败后 revision 不变”在 CP-3 实际 module test 中补齐，但其 owner 和跨阶段约束必须在 CP-2 收口前 MATCHED。不得在本 CP 提前拆 createTopologyModule。阶段二完成后，先做一次全批三维对账；全批任何 OPEN 时不得进入 CP-3。

## 7. CP-3 / 阶段三：topology module 质量项与最后拆分

### 7.1 R-11～R-14 先建立行为网

在当前 apps/terminal/kernel/base/topology/test/topology.test.ts 的真实 createTopologyModule 驱动下，先补齐并执行八项 module-level tests：

1. members slice 变化发送完整 slice；
2. 无关 slice 变化不发送；
3. peer accepted 强制补齐；
4. send failure 明确 settle/reject；
5. remote cancel 不执行且不错误回传；
6. disconnect 清理 pending 并可重连；
7. completed、partial-failed、timed-out、error 四个真实 status；
8. members/cancel/revision/cleanup 的错误分支各有一个真实反例；其中 send failure 必须证明 `membersSyncRevision` 保持不变。

每项测试必须驱动 createTopologyModule 本体，不能只测纯 helper；在 R-15 前保存测试文件即时 bytes/hash。八项各自先应用 production red mutation 并保留红输出，再恢复并 focused re-run。

### 7.2 R-11～R-14 实施

- R-11 用 members slice 的 reference identity gate；不恢复序列化 fingerprint，不因无关 root/state 变化重建完整 payload；合法 transfer plan 建立前不递增 revision，发送失败保持原 revision；
- R-12 的共享 `isTopologyJsonValue` 负责 JSON 结构、有限数、深度和键长；state-full 业务数组不设独立条数上限，encoded payload 与 8 MiB reassembly 上限是其真实边界。command-request/result 在 contracts parser 内沿用同一递归实现的 4,096 条数组选项；transport 重组直接 import contracts predicate，不得定义本地副本；
- R-13 parser 继续归 platform-ports，new URL 后以 origin + pathname 做唯一性，禁止 parser 复制到 contracts；
- R-14 pending peer commands、remote cancellation、reassembly transfer 均使用有界 TTL/容量；settled/unknown cancel no-op，不能以 disconnect 清理作为唯一上限证明。

### 7.3 R-15 最后拆分

只有以下条件同时 MATCHED 才能拆：

- CP-2 全批三维对账 MATCHED；
- 八项真实 module-level tests 已存在且八个 red mutation 全红；
- R-11～R-14 focused proof 已完成；
- 测试文件 bytes/hash 已冻结；
- fresh 子 agent 已重新读取需求、详设、memory 和测试源码确认拆分边界。

拆分只移动生产实现为职责明确的内部模块；不改变 public API、wire shape、slice/revision/cancel semantics，不改测试文件一行。若必须改 test import 或断言才能迁就拆分，停止并回到 CP-3 重新设计边界。

### 7.4 CP-3 收口

U-13～U-17 必须逐条有执行体和 red mutation，特别是 U-17 的“测试一行未改”不能单独作为等价性证明；必须和八项测试的真实行为结果、拆分前即时 hash、拆分后全绿一起成立。CP-3 完成后不能再有生产结构变化。

## 8. CP-4：全批验证与交付闸门

### 8.1 执行顺序

1. CP-3 步骤级三维对账 MATCHED；
2. 全批三维对账 MATCHED；
3. 主 agent 按当前 package scripts 运行 focused/typecheck；
4. 如授权且资源允许，按下述两阶段运行 Kotlin JVM、native supporting、设备证据；
5. 读取日志和产物，分别整理 business/evidence 与 cleanup；
6. 主 agent 做逐代码与详设逐行对账；
7. 只有所有必需的 reconciliation 行为项为 MATCHED，且每个证据档位都有真实结果或明确 OPEN，才准备 review handoff。

### 8.1.1 动态验证两阶段与硬停机

阶段一只使用 Dexter 当前提供的两台**单机、单屏、laptop**虚拟机。先完成所有可以由双机单屏承载的动态场景：主副机配对/解绑、U-5 两地址 identity failover、U-6/U-7 host 生命周期与 JVM supporting、U-8 完整 transfer 与多片乱序/重复/丢片/半套、U-9 四 fixture 分支、U-10 两侧 overflow/终态收敛、U-11 计数、U-12 业务层隔离、U-13 revision、U-16 并发交叉取消、U-17 拆分回归、U-18 静默失联与分片期间 heartbeat，以及双机侧会员登记逐步记录。设备 runner 必须使用真实跨进程/设备边界和仓内受管入口。

阶段一唯一声明式 OPEN 是 U-4：单机双屏冷启动、JS reload 与副屏 Presentation 恢复不能由两台单屏机替代。阶段一结束后必须完成两台虚拟机的受管 cleanup，并立即硬停机；向 Dexter 报告 CP/U-1～U-18 结果、U-4 OPEN 的具体原因和所需设备。不得启动阶段二，不得把单屏观察、截图差分或 focused mock 升格成 U-4。

阶段二只有在 Dexter 明确启动单机双屏虚拟机后才开始，只验证 U-4 的冷启动、JS reload、主副屏恢复，并以 UI XML 与 timeline 为主证据、截图为辅助。若副屏不能恢复，只能按 D-3 在 `TerminalDualScreenActivityHandler` 的 attach/cleanup/generation-safe restore owner 修复；如生产改动超出该包，停止并交 Dexter 裁决。阶段二若有生产改动，先重做逐代码与详设对账，再按影响范围重跑阶段一判据；未取得双屏设备前不得预先修改 dual-screen restore 代码。

### 8.2 预定验证命令

下列命令是实施授权后的计划，不是本次文档任务已执行的命令：

    yarn --cwd apps/terminal/kernel/base/contracts typecheck
    yarn --cwd apps/terminal/kernel/base/contracts test
    yarn --cwd apps/terminal/kernel/base/transport typecheck
    yarn --cwd apps/terminal/kernel/base/transport test
    yarn --cwd apps/terminal/kernel/base/topology typecheck
    yarn --cwd apps/terminal/kernel/base/topology test
    yarn --cwd apps/terminal/kernel/base/platform-ports typecheck
    yarn --cwd apps/terminal/kernel/base/platform-ports test
    yarn --cwd apps/terminal/assembly/base/android typecheck
    yarn --cwd apps/terminal/assembly/base/android test
    yarn --cwd apps/terminal verify:static

Kotlin JVM supporting 使用两个 app 的现有 Gradle wrapper，在对应 app 的 android 目录运行 :app:testDebugUnitTest；若实际 module 名不同，先由 CP-0 读取 settings.gradle，不能猜路径。设备 runner 只使用仓内受管入口 tools/terminal-topology/run-dual-device.mjs，不得手写临时 adb/端口猜测脚本。

### 8.3 失败处理

任何命令或动态动作失败：

- 保存原始命令、stdout/stderr、日志路径和受管 process identity；
- 记录 first failure、last known good、broken boundary、business result、cleanup result；
- 先定位 owning source，再做最小修复；
- 只对受影响的 focused proof 重跑；
- 不延长 timeout、不盲目重跑、不把 exit code 或测试名称写成 PASS；
- 若无法安全继续，交付语句为“实施未就绪”。

## 9. U-1～U-18 交付矩阵

| 判据 | CP/档位 | 执行体与 oracle | 红变异 |
|---|---|---|---|
| U-1 | CP-1/static（document mutation，不是 production red） | HANDOFF 五条逐字段 readback；CVE 两道闸条件化；NanoHTTPD 依赖登记 | 删除条目、把 token 当认证、把静态结论写成实攻 PASS |
| U-2 | CP-1/focused JVM | lastPongAt 可见性、锁、status/close/stats | 去 @Volatile、无锁读、破坏旧 HTTP/close |
| U-3 | CP-1/focused JVM | resolver 两次不同地址，address/status 第二次可见 | 构造时缓存、只在 start refresh |
| U-4 | CP-1/native/device（evidence-method mutation，不是 production red） | 单机双屏冷启动、JS reload、副屏恢复；UI XML/timeline/screenshot | 只取 primary、跳过 reload、把 OPEN 升 PASS |
| U-5 | CP-1/static/focused | limiter 四处公共面删除；selector/retry/failover 行为保持；旧 CP-2 无冲突 | selector 收窄、残留 export/invariant/README、旧计划相反指令 |
| U-6 | CP-1/focused | 缺 topology slice 不抛错；facts 与 operation evaluator 分离 | 缺 guard、UI 自算 allowed、root selector 捕获 |
| U-7 | CP-1/focused/readback | host 起停路径两次 status read，注释与源码一致 | 删除第二次 read/说明 |
| U-8 | CP-2/focused | 权威 D-12 fixture 逐字段 round-trip；multi-chunk stress fixture 实测至少 4 片并覆盖乱序/重复/丢片/checksum/半套/inflight/TTL；overflow generator 超过 8 MiB | 关闭分片、只比 recordCount、删除完整性、把 overflow 降为普通多片 |
| U-9 | CP-2/focused | 权威 fixture forced codec；low-compressibility 与 small-raw fixture 分别验证两个 raw fallback；逐字节 roundtrip、codec 标记、封闭 reason、wire-size gate | 恒等 codec、删 codec、always raw、threshold=0、辅助 fixture 分支错判 |
| U-10 | CP-2/focused | 发送侧 encoded 总量超过 `topologyReassemblyMaxBytes` 时零 frame 且产生 `reassembly-overflow`；接收侧注入超限 chunk 时拒绝且不 apply；两侧均验证 deterministic/transient 分类、payload terminal、新 revision、新 session、最后成功 slice 保留；overflow generator 的实际 encodedBytes 超过上限 | 删除发送侧预检、删除接收侧上限、payload failure 关闭 peer、反复重传同 revision、无限 reassembly、只靠 disconnect 清理 |
| U-11 | CP-2/focused/spies | full payload=1、canonical=1、compress=1、frames=N；接收 parser once | 把 physical serialization 藏进 chunk、删发送 guard、删接收校验 |
| U-12 | CP-2/static/focused | module 只生成完整 slice；codec/chunk 只在 session/transport | key delta、module import codec、业务层看 chunk |
| U-13 | CP-3/focused | members reference equality；无关 slice 不构造 payload；真实 members 变化下行；注入 send failure 后 revision 不变 | 恢复 unconditional send、删真实 members mutation、把 revision 提前到 send 前 |
| U-14 | CP-3/focused | transport 与 topology module 直接复用 contracts predicate；4,097 条 members 数组在字节上限内可 round-trip；command payload 仍拒绝超过 4,096 条数组 | 回退宽松 JSON check、给 state-full 恢复 4,096 条业务上限、transport 新增本地 predicate |
| U-15（本稿） | CP-3/focused | platform-ports parser 对缺/多/错类型/非法状态逐类拒绝 | parser 复制到 contracts、放宽畸形状态 |
| U-16 | CP-3/focused | 并发发起多个远端命令并交叉取消，逐 command settle；pending/cancel entry 有 TTL/容量并收敛 | 删除一项上限、把取消实现成单槽、只靠 disconnect 清理 |
| U-17 | CP-3/focused/reconciliation | 八项 module tests、八 mutation red、拆前后同一 test bytes/hash、拆后全绿 | 少测、纯 helper、改测试、删 force/cancel/disconnect |
| U-18 | CP-2/focused | fake clock + multi-chunk stress fixture 的 delayed writes；静默 no FIN/no pong→普通 peer-loss/reconnect；chunk 期间 pong | 删除 heartbeat、timeout 入 D-13、使用单片 fixture、control queue 被数据饿死 |

### 9.1 测试覆盖的最低充分性

每个 U 至少有一个真实执行体和一个对应缺陷的 red mutation。以下类型不能独立关闭任何 U：

- 只检查测试文件存在；
- 只检查命令退出码；
- 只匹配字符串或路径；
- 只测纯 helper 而未进入真实 module/session；
- 只用高度重复的合成 payload；本计划必须使用权威业务 fixture + 对应的辅助边界 fixture，不能让单一分布承担所有分支；
- 只用有 FIN 的断线冒充静默网络分区；
- 只看截图差分而无状态、日志、UI XML 或业务 oracle；
- 只看测试名/注释而不读取实际输出。

Dexter 要求的“充分测试覆盖”在本计划中具体化为：contracts 的每字段/边界、transport 的每状态/上限/恢复、topology 的真实 module 行为、Kotlin 的新旧 host contract、设备 supporting 的双屏恢复，以及每个跨阶段边界的 red mutation 全部有落点。

## 10. 三层对账与逐代码交付闸门

### 10.1 步骤级三维对账

执行者：每个 CP 结束后由 fresh 只读独立子 agent。

范围：

1. 需求 R/INV/U、Dexter 裁定和明确不做；
2. 本详设 D、owner、字段、失败/恢复、测试与证据；
3. project-memory 中的 terminal coding standard、verification/failure/handoff/scope 规则。

对账逐项比较形态、动作、关系、位置、文案/错误码、状态、恢复、日志脱敏和测试 oracle。结果只允许 MATCHED/OPEN。

### 10.2 全批三维对账

CP-3 完成后、任何整体测试或设备运行前，由 fresh 独立子 agent 重新从头核对全批。它不能引用步骤级“已经看过”作为替代，尤其要重查：

- R-5 与旧 CP-2 的单一指令；
- R-16 心跳与 D-13 payload terminal 的隔离；
- D-12 fixture 是否被生产 import；
- R-15 是否最后实施；
- U-8/U-9/U-11 的真实 fixture、阈值和 spy 层级；
- Kotlin JVM 与旧 HTTP/close/stats contract 的原子组。

任一 OPEN 时不得开始整体测试，状态为“实施未就绪”。

### 10.3 逐代码与详设对账

执行者：交付前主 agent；必要时请独立只读 agent复核，但不能由测试或 Claude review 替代。

范围：每一处 changed line、删除/新增 public export、package.json、invariant、README、test、fixture、runner 和证据路径，逐行映射到详设 §4/§5/§7/§8/§9。必须确认：

- 实现没有新增详设未列出的生产落点；
- D-15 已先于其他 CP；
- D-4 选定 JVM test source set 且没有偷偷使用人工 checklist；
- D-13/D-14 的 failure/reconnect/heartbeat 语义没有漂移；
- 所有 U 行都有真实结果和 red 记录；
- fixture manifest、每份 fixture hash/canonical members 分母和 production import 分母一致；fflate 实测 chunk plan 已记录。

结果只允许 MATCHED 或 OPEN。任一 OPEN 时最终交付语句只能是“实施未就绪”，不能创建或发送 implementation PASS 话术。

## 11. 证据、日志和清理

证据按 static、focused、native/Android、device、cleanup 分档。低档证据不能升格高档：

- static：依赖、public surface、README/invariant、D-15、graph/config；
- focused：contracts/transport/topology/JVM 测试和 red mutation；
- native/Android：Kotlin supporting、server status/WS/readback；
- device：U-4 双屏 reload/restore 与其他获授权设备行为；
- cleanup：受管 runner 的进程、socket、emulator/device、临时文件和日志回收。

脚本与业务代码日志必须结构化、脱敏且可关联；不得记录 password/hash、OTP、token、cookie、Authorization、手机号、登录名、raw IP 或 raw payload。日志至少包含 run id、stage、role、wireId/transferId、slice/revision、chunk index/total、reason、retryable 和 cleanup status。

任何未知进程、残留 host、残留 emulator、缺日志或无法读取 evidence 都不是 cleanup PASS。业务 PASS 与 cleanup PASS 分开报告。

## 12. 需求/详设/计划逐项映射

| 需求 | 详设 | 计划 |
|---|---|---|
| R-1～R-7 | 详设 §5、§6 CP-1、§7 U-1～U-7 | 本计划 §4、§5 |
| R-8～R-10 | 详设 §4.1～§4.3、§6 CP-2 | 本计划 §6 |
| R-11～R-15 | 详设 §5 D-9～D-12、§6 CP-3 | 本计划 §7 |
| R-16 | 详设 §4.4、D-14、U-18 | 本计划 §6.3、§9 |
| D-1～D-5 | 详设 §5、CP-1 gates | 本计划 §5 |
| D-6～D-10 | 详设 §4、CP-2 gates | 本计划 §6 |
| D-11～D-15 | 详设 §5、CP-3/CP-0 gates | 本计划 §4、§7 |
| U-1～U-7 | 详设 §7.1 | 本计划 §5、§9 |
| U-8～U-12、U-18 | 详设 §7.2 | 本计划 §6、§9 |
| U-13～U-17 | 详设 §7.3 | 本计划 §7、§9 |

### 12.1 D-1～D-15 逐项落地索引

| D | 详设结论 | 计划落点 | 实施收口 |
|---|---|---|---|
| D-1 | topology slice 缺失时 facts 为 undefined，消费者显式 unavailable | §5 R-6 | U-6 focused |
| D-2 | host status parser 归 platform-ports，不复制到 contracts | §5 R-6 与 §9 U-15 | U-15 focused |
| D-3 | 先做 U-4 设备观察，失败才改 dual-screen handler | §5 U-4 | native/device evidence |
| D-4 | assembly/base/android 采用可注入依赖的 JVM test source set | §5 R-2/R-3、§8.2 | U-2/U-3 JVM |
| D-5 | transport 直接依赖 fflate，base64 文本，CP-0 不可用即停 | §4.2、§6.1～§6.2 | dependency/typecheck + U-9 |
| D-6 | 只压 state-full，非零 bytes/ratio 阈值，封闭 raw fallback | §6.1～§6.4 | U-9 red mutation |
| D-7 | 统一 chunk shape、revision/transfer/checksum/reassembly | §6.1～§6.2 | U-8/U-10 |
| D-8 | 8 MiB、2 inflight、15s timeout、256 pending typed bounds | §6.1～§6.4 | U-10/U-16 |
| D-9 | members reference identity；transfer plan 成功后才递增 revision，不恢复序列化 fingerprint | §7.2 | U-13 |
| D-10 | pending/cancel 有界 TTL/容量；按在途 commandId 集合取消，settled/unknown cancel no-op | §7.2 | U-16 |
| D-11 | 八项真实 module tests 先于 R-15，拆分后测试文件不变 | §7.1～§7.3 | U-17 |
| D-12 | 权威业务 fixture + 三份辅助 fixture + overflow generator；R-5 收窄保持可逆 public shape | §4.2、§6.4、§9 | U-5/U-8/U-9/U-18 |
| D-13 | payload terminal 与 session/peer/reconnect 隔离，新 revision 解锁 | §6.2～§6.3 | U-10/U-18 |
| D-14 | client session 心跳、control priority、静默分区适用范围 | §6.3 | U-18 |
| D-15 | 实施第一步先同步旧 CP-2，消除两套指令 | §4.1～§4.3 | U-5/D-15 static |

## 13. 失败模式与再犯防止

| 已知失败模式 | 根因层 | 本计划防线 | 反例边界 |
|---|---|---|---|
| 旧计划与新需求相反 | 交付文档边界 | D-15 CP-0 首步 + U-5 静态检索 | 后续新计划若改变 R-5，必须新 review，不可静默覆盖 |
| 单一 fixture 被过度复用 | evidence/fixture 分母 | D-12 manifest 按职责绑定权威/辅助 fixture；CP-0 记录实际 fflate plan | 权威 fixture 代表业务样本；辅助 fixture 只关闭物理边界 |
| 估算被当容量承诺 | evidence/容量语义 | D-12 canonical members hash；禁止把折算数写 HANDOFF | fixture 只代表当前业务分布，不代表未来上限 |
| 阶段二/三删除 fingerprint 后 revision 不变量漂移 | 跨阶段 owner | transfer plan 成功后递增 revision + U-13 send failure red | revision 正确性不依赖 fingerprint |
| 取消语义按单槽实现 | 并发状态边界 | D-10 在途集合 + U-16 并发交叉取消 | 未知/已 settle cancel 可 no-op，但在途 commandId 不能丢 |
| codec 形同虚设 | 判据过弱 | U-9 forced codec、非零阈值、closed fallback、三种 mutation | 未来换 codec 仍需新 red vectors |
| payload 失败关闭全 peer | 生命周期边界 | D-13 typed separation + U-10/U-18 | session/auth failure 仍可走 peer loss，不能混同 payload |
| 大模块先拆后补测试 | 结构变更归因 | U-17 八项真实 module tests + bytes/hash | 测试必须依赖新公共接口时停回 CP-3 |
| 只用断连清理假装有界 | 资源/状态边界 | U-10/U-16 长寿命压力和 TTL/capacity | disconnect 是额外清理，不是唯一上限 |

## 14. 当前状态与后续交付

当前已完成设计修订和 D-12 fixture family；Claude round2 DESIGN review 为 GO，Dexter 已授权按 CP-0～CP-4 实施。源码、测试、依赖、Gradle、设备和动态证据仍须在实施中真实执行；任何阶段的 OPEN 都必须如实报告，U-4 第一阶段因缺少单机双屏设备保持 OPEN。

本计划最终的 implementation review 交接必须同时附：

- D-15 old plan sync readback；
- CP-0～CP-3 步骤级三维对账；
- CP-3 后、整体测试前的全批三维对账；
- 主 agent 逐代码与详设逐行对账；
- U-1～U-18 逐条执行结果与 red mutation；
- D-12 fixture manifest、每份 fixture path/hash/canonical members bytes 和实际 fflate chunk plan；
- native/device/cleanup 分档结果；
- 可复制给 Claude 的 REVIEW_TARGET=IMPLEMENTATION 或 DESIGN 请求，且不把任何本计划状态写成 acceptance PASS。

若实现期间需要改变需求语义、扩大 R-16 以外的范围、换二进制协议、引入数据库/设备自启或新增用户行为，必须停在 owning boundary，提交事实、反例和更小替代，不在代码中悄悄绕过。

## 15. Claude DESIGN review finding intake（本轮）

本节记录上一轮 Claude DESIGN review 的逐条处置；其后 round2 已复评为 GO，且 Dexter 已授权实施。

| finding | 状态 | 计划处置 | 关闭条件 |
|---|---|---|---|
| M-1 | CONFIRMED | CP-0 固定 D-12 fixture manifest；权威 fixture负责业务 round-trip，multi-chunk stress负责多片/重组，overflow 使用固定 seed generator；CP-2 绑定 U-8/U-18 | 实际 fflate chunk plan、丢片/乱序/TTL/inflight/overflow focused 全部有结果 |
| M-2 | CONFIRMED | 增加 low-compressibility 与 small-raw fixture，U-9 按 fixture branch 绑定；移除“一个 fixture 覆盖全部分布”的表述 | 两个 raw fallback 各自真实触发且 reason 封闭 |
| S-1 | CONFIRMED | D-10 改为在途 commandId 集合，U-16 并发交叉取消；源码当前 Set 形态不被误写成单槽 | A/B 多命令交叉取消不丢墓碑，unknown/settled 为 no-op |
| S-2 | CONFIRMED | 所有容量计算改用 members 逻辑载荷 62,389 字节；62,535 只保留为 envelope/file 事实 | CP-0 端到端 payload→codec→chunk readback 与文档一致 |
| S-3 | CONFIRMED | 阶段二/三显式交接 revision owner；U-13 增加发送失败 revision 不变和提前递增 red mutation | send failure focused 证明 revision 不变 |
| N-1 | CONFIRMED | U-1/U-4 标记为 document/evidence-method mutation，不冒充 production red | 矩阵按 mutation type 读取 |
| N-2 | CONFIRMED | 计划解释 limiter 与 control-priority queue 的不同职责，禁止阶段二换名重建 limiter | CP-2 reconciliation 明确两者不等价 |
| N-3 | CONFIRMED | `state-full` → `state-full-chunk`（含 total=1）登记为 C-3 | 全批逐代码/详设对账能回指 C-3 |

上一轮写入仅包含本实施计划和设计 fixture；本轮进入实施后，源码、测试、依赖、脚本、Gradle 与证据会按 CP 顺序产生。round2 的 OPEN 盲审状态不被改写为完成，详见下一节。

## 16. Claude DESIGN review round2 intake 与授权状态

| finding | 状态 | 本轮处置 | 实施边界 |
|---|---|---|---|
| S-1 发送侧缺少 encoded 总量预检 | CONFIRMED → 已纳入实施清单 | 详设发送顺序新增切片前 `topologyReassemblyMaxBytes` 预检；发送侧与接收侧共用 `reassembly-overflow` typed reason；U-10 分别断言发送零 frame与接收拒绝，并以删除发送预检作为 red mutation | CP-2 focused 实现；未实现前不宣称关闭 |
| N-1 manifest 的 fflate 溯源标注不一致 | CONFIRMED → 文档修复并已实测 | manifest 四份 fixture 与 overflow generator 均标记 `CP-0_ACTUAL: fflate 0.8.3`，并写入实际 encodedBytes/chunkCount；Node zlib 仅作历史预览 | manifest 与 CP-0 evidence 逐项一致 |
| N-2 low fixture 单记录 | CONFIRMED → fixture 修复 | low-compressibility fixture 改为 4 条高熵记录，保持 `compression-not-beneficial` 角色并更新 manifest/hash | CP-0/CP-2 复核 branch 与逐记录 round-trip |
| N-3 fresh 独立子 agent 盲审 OPEN | OPEN（DEXTER_WAIVER） | 不改写为完成；详设/计划明确记录 Dexter 已豁免该前置并授权推进 | 不把 Claude round2 或本表当作 fresh blind verdict；实施仍须真实对账与复评 |

本轮文档修订已由主 agent完成；随后进入 CP-0。上述授权不扩大需求范围，不取消 U-4 的阶段一 OPEN，也不构成 implementation acceptance。

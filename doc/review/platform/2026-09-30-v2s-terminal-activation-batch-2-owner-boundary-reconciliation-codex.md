# 终端激活与长连接 · 批次二 review finding intake 与处置

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TERMINAL-ACTIVATION-BATCH-2-OWNER-BOUNDARY-2026-09-30
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=AUTHOR_INTAKE_PENDING_INDEPENDENT_SUBAGENT
AUTHOR=MAIN_AGENT
INPUT_VERDICT=NOT_A_FULL_INDEPENDENT_VERDICT
INPUT_FINDING_COUNTS=0M/12S/6N
EVIDENCE_TIER=STATIC_SOURCE_AND_OFFICIAL_DOCUMENTATION
PROJECT_MEMORY_ROUTING=CURRENT_QUERY_PASS_PRIOR_FAILURE_NOT_REPRODUCED
IMPLEMENTATION_AUTHORITY=false
```

## 1. 范围、方法与当前结论边界

本记录核对 `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-owner-boundary-review-codex.md` 汇总的 S-1～S-12、N-1～N-6，并重开其引用的需求、Journey、共享协议、现行规范与 owning source。原汇总所列 0M/12S/6N 是输入清单分组，不是本记录或本轮独立盲审的 verdict。

当前唯一产品裁决是 Dexter 本轮给出的三包职责：终端激活身份只属 `terminal-data-client`；激活/取消激活走其 command，TDS 业务帧、心跳、关闭原因及相应 selectors 也归该包；`server-config` 管服务地址配置；`transport` 仅管通讯、连接可靠性与切换。它不授权改需求、Journey、decision、源码、依赖、生成物或运行环境。本次仅修改批次二详设和计划，并新增本 intake 记录；不运行构建、生成、测试、DEV、reset/seed、L2、UAT 或部署。

定位“代理密码”时，按 R-11.9/D-35 区分服务代理凭证与终端激活凭证；本轮裁决没有要求搬移或删除代理设置。保留唯一的 `server-config` 配置状态读取路径，禁止从其外绕过 owner 直接读保护存储。

六维查询使用：

```text
scripts/memory/query --task-kind review --domain platform --consumer-face backend --owner platform --impact governance --trigger task-start
```

当前字节返回 21 条命中，且 query 会在返回前校验 active memory 与全部 owning-source anchor；本轮查询退出成功。旧输入稿记录的 `TdsTrackedSessionLimiter.java` 缺失失败目前不可复现：该路径不再是当前 active required-inventory 的 anchor；旧复盘中仍出现该类名不等于它仍是活动索引来源。未修改记忆或库存文件。直接读取命中原文用于理解规则，不能替代对这次查询结果的记录。

## 2. S findings 逐条 intake

每项“最小修订”列的是当前详设/计划中可验收的修订或实施退出判据；是否需要 Dexter 裁决指本轮产品语义裁决，不指未来实施授权。

| Finding / 原文位置 | 核验结论、性质与仓内证据 | 影响与反例边界 | 最小修订及验收判据 | Dexter 裁决 |
|---|---|---|---|---|
| **S-1**；本轮 owner review §4 S-1（L86-L90），Journey L48/L54/L60 | **PARTIALLY_CONFIRMED。** 事实：Journey 仍有终端凭证/重置/多节点边界与新裁决不一致，且 R-10.5 引用错误；本轮凭证 owner 已由 Dexter 明确，不存在重复待裁决项。详设 §0（L29-L33）和计划 CP-01（L77）列明冲突与约束，不把“只清凭证 slice”当作 R-9.6，也区分批次二多实例与批次三跨节点协调。 | 旧 Journey 能误导后续实现按 server-config 保存激活凭证，或把多节点部署整个延期；反例：代理密码仍按 R-11.9 属服务连接配置，不能因凭证只归 client 而迁入 client。 | 保持 Journey 原文不改（本授权只含详设/计划）；CP-01 开始时必须并列重读 Dexter 本轮裁决、需求 R-9.6 与 Journey 原行，实际实现采用裁决和 R-9.6 的范围；不得新增第二凭证库。当前设计/计划不得再把 owner 裁决设为待决。 | 否；本轮裁决已明确。Journey 正本漂移保留为来源风险，不伪称已同步。 |
| **S-2**；§4 S-2（L92-L96），现有 V-S9 场景 | **PARTIALLY_CONFIRMED。** 原评审“withdrawal 一开始必拒新、必然失败”被当前需求 R-4.5 的明文反例否定；真实缺口是旧测试仅从停止请求起算 10 秒，未覆盖“readiness 下降→等待摘除→等待中继续接纳新会话→drain”的新闭环。证据：需求 R-4.5（L190-L193）；`BackendAcceptanceTest.java:874-880` 的 V-S9 factory 仅 `--operation all` 执行；详设 CP-04（L173-L177）与 §11a（L368-L369）重订时序。 | 若沿用旧 10 秒总预算，则新 4 秒等待与现有 8 秒 drain 无法同时满足；若拒新过早，会破坏等待期仍可服务入口的行为。反例：不能把 V-S15 塞进 `--operation all`，那会无意运行全业务场景。 | 一条真实 TDS HTTP/WS 场景先证明 readiness 变非 UP；4,000ms 等待期旧会话仍 PING/PONG 且至少一个新会话完成 SESSION_READY 和登记；等待期满才拒新；8,000ms 内 drain 关闭旧与新会话；总上界 14,000ms（含 2,000ms observer/scheduler 容差）。原 V-S9 不再保留矛盾的旧时序断言。新增 TDS CONTRACT 选择器只能选唯一 V-S15 ID，并要求一个既有 BUSINESS operation 与 topology preflight；新增验收控制环境键须在 runtime key exact-set test、shell/remote parser 与 run manifest 闭集同步，且与 TDS app runtime key 计数分开。 | 否。该定时参数与判据来自现行需求和已有 acceptance 上限，尚待实现时证明。 |
| **S-3**；§4 S-3（L98-L100） | **CONFIRMED。** 原设计只把默认节点值放 unit/runner 测试；需求要求未配置默认值。详设 CP-04（L178）和 §11a（L367）添加真实 HTTP 激活、真实 WS `SESSION_READY` 和 PostgreSQL latest-state 对照。 | 只看配置常量不能证明装配、握手、数据库写入共同使用默认值。反例：V-S15 的显式非默认 nodeId 不能证明缺省行为。 | 单独 acceptance TDS 进程不设置 `V2S_TDS_NODE_ID`；真实 owner HTTP fixture 激活后连接，断言 `SESSION_READY.nodeId` 和 DB `node_id` 均为 `terminal-data-server`；结束时真实取消并 readback，清理单报 PASS。 | 否。 |
| **S-4**；§4 S-4（L102-L104） | **CONFIRMED。** DEV `r5-full` seed 只属 DEV 生命周期；它不能为 Testcontainers acceptance 提供 fixture。现有 `TerminalConnectionContractScenarios` 提供场景内建 fixture helper（owner review §4 S-4 引用）。详设 CP-06 V-B15（L366）按 backend-acceptance 自己创建请求与业务数据。 | 跨执行面复用 DEV seed会把 acceptance 绑定到当前 DEV 数据状态，也可能由脚本直写数据库。反例：V-E* DEV 场景可以继续使用获批的 DEV fixture。 | V-B15 在其 owning acceptance scenario 内调用现有 fixture/helper，并用真实 HTTP 测 unknown fields 行为；不得加载 seed 或直接写业务绑定；CONTRACT、BUSINESS、DB_OPERATIONS、cleanup 分开输出。 | 否。 |
| **S-5**；§4 S-5（L106-L110） | **CONFIRMED。** R-1.4 的设备类型匹配与 §8 第17条 fixture 复原要求必须覆盖每个被触碰的 DEV 记录。详设 CP-05/计划 CP-05（计划 L135-L138）已要求选择匹配 laptop/mobile、每场景以真实 backend owner HTTP 取消并 readback。 | 错形态会让激活业务被拒；只清进程/容器不等于还原了终端业务。反例：未触碰的 seed fixture 不需额外取消。 | 每条 DEV 场景在选择前证明设备类型与 client `SurfaceForm` 相符；被场景改变的 fixture 均经真实 owner cancel 后 readback 为未激活；业务复原与资源 cleanup 分开报告，二者均 PASS。 | 否。 |
| **S-6**；§4 S-6（L112-L114） | **CONFIRMED。** 需求 R-1.2/V-G1 要求后端设备类型闭集与 TER `SurfaceForm` 双向相等。详设 CP-03（L149-L160）与 §12.2（L457）增加双方 exact equality 与两向红 mutation。 | 单向子集检查会允许一边多出未被另一边消费的设备形态。反例：不需要抽象成新的共享 registry；现有两个事实源可在 TER 类型门对账。 | 两侧各增加一个值时，`scripts/verify` 均以专属 marker 失败；恢复后门通过；测试证明比较双向 exact set。 | 否。 |
| **S-7**；§4 S-7（L116-L120） | **CONFIRMED。** 当前 generated-slice gate 的集合未包括 TER，readability 词表不识别 `generated`（来源见 owner review §4 S-7 L118）。详设 §12.2（L457）与计划 CP-01（L77、L79）加入 TER producer/policy/output 三方 exact-set、生成目录词汇、对应门和反例。 | 只生成文件但不证明 producer、配置、face projection 同步，会出现漏接口或误进前端切片。反例：现有 FE slices 的字节保持不变，不意味着 TER 可免于自己的闭环。 | exact-set 必须比较终端暴露面的 operation projection、TER generation policy/producer、TER `src/generated` 产物；FE projection 不含 terminal；移除/错配任一侧均由指定 verify 门以具体 marker 变红，readability gate 接受且仅接受约定的 `generated` 目录。 | 否。 |
| **S-8**；§4 S-8（L122-L126） | **CONFIRMED。** R-10.3 对 socket 握手失败与 handshake 后业务未 ready 有不同退避时序；详设 CP-03（L149-L160）与计划 CP-03（L107-L108）已区分。 | 把两者合并会对业务拒绝立即轮转或对握手失败错误地睡完整周期。反例：收到已就绪连接的 redirect 仍沿 D-45 保持当前 preferred entry 策略。 | focused tests 分别触发握手未完成、socket open 后 SESSION_READY 未完成/拒绝，断言当前尝试是否换址、下次尝试起点及 backoff；ready redirect 单独断言 preferred entry 不被误改。 | 否。 |
| **S-9**；§4 S-9（L128-L130） | **CONFIRMED。** 代理密码是 server-config 受保护状态，不是 terminal-data-client 的激活凭证。R-11.9 与 D-35 允许 server-config 保存按服务代理密码，selector 脱敏；详设 CP-02（L140-L147）统一 hydrate/snapshot 读取，拒绝网络层直接读持久库。 | 绕过状态 owner 会造成第二条秘密访问路径/状态不同步。反例：终端激活秘密仍只属于 terminal-data-client；二者不能因都属于 secret 而合并。 | WebSocket/HTTP 每次建连只消费 server-config owner 提供的当前配置快照；代理密码不出现在 selector、日志或 transport state；保护存储的唯一 hydrate/更新通过该 owner 能力。任何直接 storage 读取或凭证跨 owner 持久化均失败于 focused proof/code review。 | 否；本轮未改变 R-11.9。若后续另有裁决明确取消代理才需另裁。 |
| **S-10**；§4 S-10（L132-L138） | **PARTIALLY_CONFIRMED。** “Undici 默认无限”被精确版本源码反证；Undici 8.11.2 `DispatcherBase` 的默认 `maxPayloadSize` 为 128 MiB，WebSocket 将 dispatcher 值传入 ByteParser/PMD。它仍超过协议 65,536 字节，显式收紧仍是必须项。详设 §1.2（L54）、§3.1、CP-05/Node 验收（计划 L135）记录该链路与“lock/runtime 实际版本重核”。官方证据：[dispatcher](https://github.com/nodejs/undici/blob/v8.11.2/lib/dispatcher/dispatcher-base.js)、[WebSocket](https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/websocket.js)、[receiver](https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/receiver.js)、[PMD](https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/permessage-deflate.js)。 | 依赖默认会留下 128 MiB 接收上限；只测未压缩帧也不能证明 inflater 与分片累计受约束。反例：初值 0 不表示协议默认无限，配置入口不是 `WebSocketInit`。 | 绑定实际解析版本与入口 Node 版本；dispatcher 对 direct `Client` 和 `ProxyAgent` 显式设 `webSocket.maxPayloadSize=65536`；focused tests 覆盖恰好上界、超过上界、压缩单帧/分片累计及 direct/proxy 参数确已到达 PMD inflater。未达到上界时不得进入 Node 联调。 | 否；剩余是实现验证，不是新产品语义。 |
| **S-11**；§4 S-11（L140-L144） | **PARTIALLY_CONFIRMED。** 当前源码没有证明 TER 支持或不支持多实例；旧 `.mjs` 入口确未说清 TS 包如何加载。详设 CP-05 与计划 CP-05（计划 L135）选择由受管 `.mjs` 管 manifest/process，精确启动锁中 Vitest CLI，以该 package 自有 acceptance config 装载 TS tests，不让 parent `.mjs` 导入 TS。仓内普通 runner 只扫 `test/**/*.test.ts` 且不接受路径参数（`tools/terminal-shared/run-owned-tests.mjs:92-97,116-135`），故 Node 脚本不可假设原 runner可单场景选择。 | 仅两套 state reducer 实例并不能证明 namespace、commands、连接与 dispose 隔离。反例：不能据 TS 源码导出直接断言“不支持多实例”。Vitest CLI/TS 能否按新 package 入口运行还需实施时依锁核版本，官方 v4 CLI/include/TS 文档仅说明 loader 能力，不是本仓运行结果：[CLI](https://v4.vitest.dev/guide/cli)、[include](https://v4.vitest.dev/config/include)、[TypeScript tests](https://v4.vitest.dev/guide/learn/writing-tests)。 | 同一受管 Node 进程构造两个真实 package compositions，分别使用独立 runtime registry/state namespace/secure store/network adapters；交错执行激活、连接、selector、storage、retry 与 dispose，另一实例状态必须保持不变；记录实际 Node/Vitest resolved version 和 exact selected test child。未能加载或不隔离则 implementation finding，不能退回“架构不支持多实例”。 | 否；当前是待实现证明，不需要先作产品裁决。 |
| **S-12**；§4 S-12（L146-L152） | **CONFIRMED。** 新裁决前详设确把 SESSION_READY 与心跳数据放 transport，且没有闭合 AUTHENTICATE/PONG/seq/RTT；新设计的职责表（详设 L68-L72）、CP-03、状态/接线表与计划 CP-03（L104-L110）均把 HTTP/TDS 业务和 selectors 放 client，把 transport 限于通用 ready/invalid/stop 等信号。反例：复用 transport 的通用心跳时钟并不等于它解析 TDS PING/PONG。 | 若只看 package import 关系，帧解释仍可能隐藏在 transport callback 中；激活状态、在线态和 RTT 也会没有单一 selector owner。 | 全链路 focused tests 从 client command 发起激活/取消、编码 AUTHENTICATE、验证 SESSION_READY、发 PING、匹配 PONG.seq 并形成 RTT selectors；transport 在不认识 TDS frame 的 fake socket 下仅消费通用信号完成稳定连接/切换。HTTP endpoint schema/error/reply 也留在 client，transport 只执行注入网络请求。 | 否；精确裁决已生效。 |

## 3. N findings 逐条 intake

| Finding / 原文位置 | 核验结论、性质与仓内证据 | 影响与反例边界 | 最小修订及验收判据 | Dexter 裁决 |
|---|---|---|---|---|
| **N-1**；owner review §5（L156-L158） | **CONFIRMED。** 本批没有浏览器 action；详设 §3a 已标 `N/A_WITH_REASON`，计划未要求空分母 `L2_SCRIPT_ADMISSION=PASS`，也保留适用的 Expo Web 冒烟与 seed/reset 规范。 | 旧 store-terminal 控制面扩写会错误改变无关 L2 准入；反例：本批既有 UI/platform-port smoke 仍照跑。 | 不改旧 L2 control plane；§3a N/A 说明可被重新核验；适用 DEV/reset/seed 进入条件仍单独成立。 | 否。 |
| **N-2**；owner review §5（L158-L159） | **CONFIRMED。** 详设 CP-05（L181-L190）将 `/actuator` 与 `/actuator/` 分别用 HAProxy ACL 拒绝，节点 loopback readiness 仍由健康检查读取；计划 CP-05（L134）有路径规则与双侧判据。 | 仅拒绝子树而不拒根路径可能泄露 management endpoint；反例：loopback 上的 readiness 不应因用户入口封闭而无法健康检查。 | config focused proof 断言两个入口对精确 `/actuator` 与 `/actuator/health` 均 403；同一 TDS loopback `/actuator/health/readiness` 为 200。 | 否。 |
| **N-3**；owner review §5（L159-L160） | **CONFIRMED。** Undici 8.11.2 官方 `engines.node` 是 `>=22.19.0`；详设 §1.2（L54）选 Node 22.23.3 基线且实施前绑定实际 runtime/lock。 | 精确钉死无必要的 patch 版本会增加环境维护；反例：最低 Node engine 不代表所有未来版本均已验过。 | Node 版本约束保持满足官方 engine 的范围；每次受管 run 记录 `node --version`、解析 Undici version 与 dispatcher API。官方：[v8.11.2 package.json](https://github.com/nodejs/undici/blob/v8.11.2/package.json)。 | 否。 |
| **N-4**；owner review §5（L160-L161） | **PARTIALLY_CONFIRMED。** R-16.3/R-16.4 允许 standalone Undici；详设已经选择独立包路线并解释 Node 内置版本差异。实际 lock、Node 运行时及加载路径当前未运行，不能宣称组合已验证。 | 以 official engine 范围替代实际版本对账仍可能遇到 bundled/standalone API 分歧。反例：这不是要求立即更换方案或增加 `ws`。 | 实施前从本仓 lock 与受管 Node 的实际版本打印解析值；direct 与 ProxyAgent 都从同一独立 Undici package 构建；配置/压缩 focused proof 验证上界实效，再进入联调。 | 否。 |
| **N-5**；owner review §5（L161-L162） | **CONFIRMED（当前源码复核）。** 当前 `TdsWebSocketConfiguration.java` 已使用 Reactor Netty 原生压缩；`TdsMessageSizeCloseHandler.java` 保持解压后消息大小闭界。详设 CP-04/CP-05（L169、后续 Node 项）不恢复已清理的手写 PMD。 | 把旧 N-1 写手动 decoder/协议边角带回批次二会造成重复实现；反例：Node 注入客户端仍需按 R-10.5 验 PMD。 | 仅按当前 Reactor Netty 锁和源码承接 TDS native PMD 与 64 KiB 上限；受管/Node client 按各自对应契约验证；源码及 focused tests 中不存在已退役组件引用。 | 否。 |
| **N-6**；owner review §5（L162-L163） | **CONFIRMED。** TR-09 当前没有 server-config 这个新增精准保留例外。详设 CP-02/计划 CP-02（计划 L94-L96）已明确这是拟新增条款：仅保留 server-config 注册配置 slice，排除激活凭证、其他 owner 与孤儿 key，不声称原文已存在。 | 将提案冒充既有规范会造成实施者漏做规范同步；过宽保留会留下多 owner/orphan 数据。反例：R-9.6 本来就要求保留 server-config 配置。 | 详设给出精确新增正文；实施 CP-02 逐 owner 验证保留与清除，过保留/少保留/孤儿键至少各一红例；同步规范改动仅在获批实施期执行。 | 否。 |

## 4. 当前设计/计划修订索引

1. 三包职责、R-11.9 代理秘密区分及 Journey 来源漂移：详设 §0、§1、owner 表与 CP-01/02/03；计划 CP-01/02/03。
2. 旧 V-S9 与等待期新连接：详设 CP-04、§11a；计划 CP-04/CP-06/首次验收步骤。
3. V-S1 默认 nodeId、V-B15 场景内建数及联调 fixture 类型匹配/恢复：详设 §11a/CP-04/CP-05；计划 CP-04/CP-05。
4. 设备闭集、generated 三方对账、错误退避分段：详设 CP-01/CP-03/§12.2；计划 CP-01/CP-03。
5. 代理唯一状态路径、Undici 真实 maxPayload 参数链及 Node 多实例验证：详设 §1.2/§3.1/CP-02/CP-05；计划 CP-03/CP-05。
6. `/actuator` 双路径隔离、L2 无关控制面不扩写、TR-09 新例外：详设 §3a/CP-02/CP-05；计划 CP-01/CP-02/CP-05。
7. 主会话末轮文档自查补充（非输入 reviewer 新 finding）：新增的 TDS acceptance selector 环境键也必须进入 `RuntimeEnvironmentKeys` exact-set、测试与 runner manifest闭集；详设 CP-04/§12.2（当前 L177、L459 后新增一行）和计划 CP-04 明列，不与 TDS 两项应用配置键混计。

修改路径仅为：

- `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md`
- `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md`
- `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-design-review-request-codex.md`（Dexter 后续要求转 Claude 静态复评后更新）
- 本报告。

需求与 Journey 的正本仍保留来源漂移，未修改；batch-3 的跨节点会话协调、Doris 与 topic 同步仍不进入本批。UI/Node/TDS acceptance/DEV/cleanup 未作动态证明。Round 1 fresh 独立 DESIGN reviewer 已返回 `GO`、`M/S/N=0/1/1`；其 verdict 由 reviewer 消息给出，本报告只记录作者对两条 finding 的 intake 与处置，不冒充 reviewer verdict。文档针对性修正后仍需 round 2 fresh 复核，当前不宣称 cycle 已收口。

## 5. 独立复核输入与状态

本 cycle round 1 reviewer 必须先从原始需求、Journey、协议、详设、计划、项目规范和 memory routing 形成盲审 findings/verdict，再允许查看本 intake。本轮审查者只读，不运行代码/测试，也不编辑文件。输入清单：

- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`doc/platform/review-standard.md`、`doc/platform/implementation-task-template.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/third-party-library-usage-standard.md`；
- `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`、`doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`、`doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`、`contracts/protocol/terminal-connection-protocol.json`；
- 本批次二详设与计划；
- 本批 TDS/TER/backend-acceptance 对应当前源码和项目 memory 的全六维命中原文。

明确排除之前的 reviewer 结果、原 Claude review 与本报告作为第一阶段盲审输入；它们可在 reviewer 完成并提交独立 verdict 后作为作者 intake 背景。cycle 元数据见本报告顶部和两个设计文档头部。

## 6. Round 1 独立 verdict 与作者处置

下列 verdict 来自 fresh reviewer `/root/batch2_design_independent_review` 的最终消息。审查者自报未读取 forbidden review/intake/Claude 文件、未写文件、未运行 build/test/generate/runtime；这是 reviewer 的证据声明，不由作者升级为动态证据。

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TERMINAL-ACTIVATION-BATCH-2-OWNER-BOUNDARY-2026-09-30
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=GO
M/S/N=0/1/1
```

| Reviewer finding | 作者独立核验与状态 | 处置与验收边界 | Dexter 裁决 |
|---|---|---|---|
| Round1-S-1：详设 §9 表中 server-config public selectors 的消费者把 `terminal-data-client` assembly boundary 列入其中，可能被解释为 client 直接 import selector。 | **CONFIRMED（措辞歧义）**。旧文位置为详设 §9 `server-config public selectors` 行；详设其他位置虽禁止 client 直接依赖 owner，但该表允许读出另一种实现。反例是应用组合层读取 owner 配置并注入值快照，这仍符合裁决。 | 已将详设 §9 消费者改为未来 admin console 与 application/test composition；补明 client/transport 不直接导入 selector/state/persistence。计划 CP-03 同步为 application/test composition 读取 owner 配置后注入不可变 snapshot/provider。静态验收：`terminal-data-client`、`transport` 的 import graph 不得出现 `server-config` selector/owner-state 依赖；只允许 composition 注入快照。对应当前详设 §9 与计划 CP-03。 | 否，按 reviewer 建议收紧边界用语。 |
| Round1-N-1：详设把 Spring Boot 4.1 line API 链接标为 4.1.0 精确 API 来源。 | **CONFIRMED**。本轮打开 `https://docs.spring.io/spring-boot/4.1/api/...` 后页面重定向到未版本化 `/spring-boot/api/...`，页面标题显示 Spring Boot 4.1.1；第三方库规范要求精确核对解析版本。 | 已将详设 §3.1 链接标成 4.1 line 导航而非 exact evidence，并明确 CP-04 须从 TDS 实际 Gradle 解析版本取对应官方 Javadoc/source 或精确 tag，记录坐标、版本、来源与 class/API；计划 CP-04 RECALL 与退出条件同步。当前未获得 4.1.0 exact class/Javadoc 来源，也未运行 Gradle；因此精确版本核验仍是实施 CP-04 的硬前置，不在本轮声称已验证。 | 否，按 reviewer 建议修正文档证据等级。 |

官方依据复核：Spring 的 `/4.1/` Javadoc 地址当前显示 4.1.1，不能被标成 4.1.0 精确来源；官方 release 列表存在 `v4.1.0`，但本轮没有取得并核准足以替代的 exact class/source URL，所以详设保留 4.1 line 页面仅作导航，并把 exact source 查证留作 CP-04 的进入条件。参见 [Spring Boot 4.1 line API](https://docs.spring.io/spring-boot/4.1/api/java/org/springframework/boot/availability/ReadinessState.html) 与 [官方 releases](https://github.com/spring-projects/spring-boot/releases)。

Round 2 fresh reviewer 的定向核验输入是上述两条 finding 与更新后的详设、计划、第三方库规范、Dexter 三包裁决及需求/协议中相关职责判据；其未读取本 author-intake 文件或原 Claude review。Round 2 是本 `REVIEW_CYCLE_ID` 最后一轮，详见下节的独立 verdict 与作者收口。

## 7. Round 2 独立 verdict 与最终作者收口

以下 Round 2 verdict 来自 fresh reviewer `/root/batch2_design_blind_r2` 的最终消息；reviewer 自报只读、未运行构建/测试/生成/受管运行，且未读取 owner-boundary report、author intake 或原 Claude review。

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TERMINAL-ACTIVATION-BATCH-2-OWNER-BOUNDARY-2026-09-30
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
VERDICT=NO-GO
M/S/N=0/1/0
EVIDENCE_TIER=STATIC_SOURCE_AND_OFFICIAL_DOCUMENTATION
DYNAMIC_EVIDENCE=NOT_RUN
```

| Finding | 作者核验与处置 | 最小验收/当前状态 | Dexter 裁决 |
|---|---|---|---|
| Round2-S-1：详设 §6/CP-03 原行仍写 terminal-data-client 注入 `server-config selector/snapshot provider`，与 §9 新收紧边界冲突。 | **CONFIRMED。** 仅不直接 import 并不足以避免依赖 selector 语义；client 注入 `serverConfigSelectors.selectEffectiveConfig` 仍可绕过组合边界。 | 已把详设 §6/CP-03 改为：terminal-data-client 只调用通用 transport command；application/test composition 经 server-config 内部解析 API 取得网络配置，再将 provider 注入 transport network adapter/profile；client/transport 不消费 server-config public selector、owner state 或持久化。详设 §9 和计划 CP-03 已同义。作者回读 §3、§6/CP-03、§9、组合依赖说明与计划 CP-03，检索不再命中 client 消费 server-config selector/provider 的表述。此处置后的字节未有第三轮独立 reviewer 复核；按两轮上限由作者 SELF_DECIDED 收口。 | 否，纯文档边界一致性修正。 |

Round 2 确认首轮 Spring finding 已关闭。Spring Boot `/4.1/` 链接仍只作 4.1 line 导航；CP-04 保留“实际 Gradle 解析版本 + 对应精确官方 source/Javadoc/tag”实施前置。首轮、次轮独立 verdict 分别为 `GO 0/1/1` 与 `NO-GO 0/1/0`；Round 2 的 `NO-GO` 针对修改前尚含 Round2-S-1 的字节。

**最终作者收口（非独立 reviewer verdict）**：

```text
ROUND_FINAL_DECISION=SELF_DECIDED
AUTHOR_FINAL_DESIGN_DISPOSITION=GO
OPEN_FINDINGS_AFTER_DISPOSITION=0
M/S/N_OPEN=0/0/0
```

依据：Round2 唯一 S finding 已按其最小判据修复；它不涉及产品语义或授权变更，且需求裁决、详设职责表、依赖边界与实施计划现在一致。该自决只收口批次二 DESIGN 文档，不构成独立 reviewer 对最后一次文档改动的 GO，也不授权源码实施或任何动态验证。Dexter 后续要求转 Claude 静态复评，交接材料已更新至 `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-design-review-request-codex.md`；需由 Dexter 转达，不把文件准备描述成已送达。实施开始仍须遵循本批次的 CP/准入/官方版本核验与独立对账要求；当前未核实的实际 Gradle/Node 解析、包装配、DEV、UI、Node 联调、TDS acceptance、cleanup 均为后续实施证据，不在本轮冒称通过。

# 终端激活与长连接批次二：新 owner 裁决与原评审整理

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B
REVIEW_SCOPE=原补充评审与其来源核对、新 owner 裁决落稿、范围内静态对账
VERDICT=NO-GO
M/S/N=0/12/6
REVIEWER=Codex 主会话（承接 Dexter 指派的 Claude 评审职责）
reviewerKind=MAIN_AGENT_CONSOLIDATION
INDEPENDENT_INPUT=/root/boundary_review（fresh、只读、owner 边界与部分原 findings 核对）
INDEPENDENT_FULL_BATCH_VERDICT=NOT_PRODUCED
EVIDENCE_TIER=STATIC_SOURCE_AND_OFFICIAL_DOCUMENTATION
PROJECT_MEMORY_ROUTING=OPEN
IMPLEMENTATION_AUTHORITY=false
```

本稿的结论是：三包分工按 Dexter 本次裁决执行；凭证 owner 已经明确，不再要求 Dexter 重复裁定。现有详设和计划仍有需要修订的业务协议归属、来源漂移、验证缺项与执行路径问题，所以当前文档不具备实施放行条件。

`M/S/N` 是下列 12 个 S 与 6 个 N 的问题清单计数，包含逐项标明的部分确认项；不继承旧稿的全范围核验声明，也不声称完成全批 fresh 独立盲审。本次只新增本评审文件，原评审、需求、Journey、详设、计划、源码与契约均未改写。没有执行构建、生成、测试或动态环境。

## 1. 来源与新裁决

### 1.1 原文关系

本次读取并对照的文件如下。后文用简称引用，行号对应本稿整理时的字节。

| 简称 | 仓根相对路径 | 用途 |
|---|---|---|
| 原补充评审 | `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-design-review-supplement-claude.md` | 原 11S/6N 合并结论，逐项重新分类 |
| 原评审 | `doc/review/platform/2026-09-30-v2s-terminal-activation-batch-2-design-review-claude.md` | 原补充评审所指的另一份评审 |
| 详设 | `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md` | 被审设计 |
| 计划 | `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md` | 被审实施计划 |
| 需求 | `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md` | 原始业务条款、裁决及验收要求 |
| Journey | `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md` | 来源漂移核对 |
| 协议 | `contracts/protocol/terminal-connection-protocol.json` | AUTHENTICATE、SESSION_READY、PING/PONG、关闭原因与尺寸上界 |

原评审当前止于 S-9，保留 `<!--APPEND_MARKER-->`，所引用的部分后续 findings 没有正文及最终结论。该不完整状态可以从当前文件确认；原补充评审叙述的覆盖、恢复历史没有在本次独立证明，不作为权威。原补充评审的 11S/6N 是核查入口，不自动等于成立。

### 1.2 Dexter 新裁决原文

> 凭证只存在 terminal-data-client。terminal-data-client要提供command来做激活和取消激活，负责ping/pong等跟terminal data server匹配的业务逻辑，要提供selector来查询激活状态、连接状态、连接延时。server-config 只做地址配置，并有command可以更新地址，有selector查询地址。transport不做业务，只关注通讯和连接的稳定性与切换等等。

该裁决优先于上述旧文档中的冲突表述。本稿记录裁决及修订要求，不把“裁决已明确”写成“相关正本已经改完”。本次没有获得修改需求、Journey、详设或计划的任务。

“凭证只存在 terminal-data-client”在本次三包划分中指 **TER 终端激活身份的 owner**：state/安全持久化是它复用的基础能力，不是第二个身份 owner。发送认证首帧、HTTP Authorization 时允许必要的瞬时传递；transport、server-config、装配报告、日志和诊断不得成为第二份终端凭证存储或公开查询面。这不取消服务端原有凭证摘要与身份核验事实。

## 2. 三包职责与调用方向

| 包 | 拥有的事实与行为 | command / selector 要求 | 不应承担的职责 |
|---|---|---|---|
| `terminal-data-client` | 唯一终端激活身份；激活/在线及离线取消；TDS 认证、业务帧、业务心跳、关闭原因处置；激活态、业务连接态、RTT | 激活与取消必须走 owner command→actor；保留详设已有连接/断连 command；提供激活状态、连接状态、连接延时 selector，禁止返回凭证 | 不复制地址权威值，不另写连接轮转、退避、网络恢复 loop |
| `server-config` | 地址配置、既有环境/服务覆盖、默认值解析与配置版本 | command 更新完整服务配置；selector 查询有效地址与配置状态 | 不持有终端激活凭证、绑定代次、激活状态；不做认证、PING/PONG、重连控制或可达性探测 |
| `transport` | 通用 HTTP/WS 通讯、连接尝试、超时、退避、地址切换、网络状态恢复及资源释放 | 接受调用方给出的地址/版本、通用重试属性及 ready/invalid/stop 信号；输出原始消息与连接事件 | 不识别 TDS 帧名、字段或关闭原因的业务含义；不决定取消激活，不拥有终端身份或 TDS RTT 样本 |

调用方向：terminal-data-client 经 server-config 获取当前地址配置，用 transport 发送请求和不透明消息；transport 不反向读取 client 身份或配置持久库。socket callback 通过 command 进入 owner actor，不直接改 owner state。

**业务 ready 与 socket open 分开**：client 校验 SESSION_READY 后，向 transport 报告通用 ready，并提供需要的稳定期参数。transport 可以按参数更新首选地址、归零退避计数，但不得直接读取 `SESSION_READY.heartbeatIntervalMs`。传输失败由机制处理，业务拒绝、退出和身份处理由 client 决定。

**业务心跳的闭包**：client 发送 AUTHENTICATE；验证 SESSION_READY 的会话与参数；发送 PING；匹配 PONG.seq；记录本次发送时间、计算 RTT、维护两小时样本；处理迟到/旧会话事件、心跳超时和关闭原因；取消/断连时停止本会话心跳。具体枚举、时限与 seq 边界从需求和共享协议读取，不在评审里另创一套。

**HTTP 也遵守同一边界**：generated client/terminal-data-client 解释端点 schema、业务错误码与结果；transport 只执行通用送达状态与调用方声明的安全重试规则。不得把 `UNKNOWN_BUSINESS_REJECTION`、terminal operation 错误闭集等业务解析职责留在 transport 内。

**代理配置的解释边界**：需求 R-11.9 与 D-35 将可选代理作为某个后台服务的地址连接配置，并要求整体更新服务。代理密码不等于终端激活凭证。保留这一既有解释时，应写明 server-config 仍只管理连接配置，密码由该配置 owner 保密保存，公开 selector 不返回。若设计侧认为本次“只做地址配置”还取消了既有代理配置，应把冲突准确交 Dexter，而不能默默删除代理要求、把代理密码塞入 client，或新增秘密 owner。本稿不擅自作这种产品变更。

## 3. 方案合理性与模板抽取

三包方向成立：配置、业务会话和通讯机制各有唯一住址，继续复用 runtime command/actor、state、安全持久化、配置 resolver 与现有 transport 原语。最小修订是把边界写到每条实际调用和状态更新上，不是增加 mediator、event bus、第二个 session manager 或凭证库。

本次按设计审查 1-B 抽取到的缺口：

| 设计/模板位置 | 当前缺口或矛盾 | 处理位置 |
|---|---|---|
| 详设 §0、§4 CP-01；计划 §0/CP-01 | 新裁决已明确，但仍等待同一 owner 裁定；Journey 漂移清单不全 | S-1 |
| 详设 §4 CP-03、§7～§9；计划 CP-03 | 协议语义与机制信号未分清，心跳/RTT 的 owner 闭包未明确 | S-8、S-12 |
| 详设 §10.2 与 CP-03 | 密码从 owner state 读取与直接解密持久库并存 | S-9 |
| 详设 §11a；计划 CP-04/CP-06 | 默认节点号、原 V-S9、设备闭集与联调恢复遗漏 | S-2、S-3、S-5、S-6 |
| 详设 §12.2；计划 CP-01 | TER generated 三方对账与可读性词汇漏领 | S-7 |
| 详设 §3.1/CP-05；计划 CP-05 | 实际 inflater 上界与 Node 装配路径未闭合 | S-10、S-11 |
| 详设 §3a；计划 CP-01/CP-06 | 无本批浏览器 action，却扩写旧门店终端 L2 控制面 | N-1 |

本批没有新页面或交互控件，独立新 IA/交互工件的创作为 N/A；V-T16/V-T17 的既有平台端口能力投影仍适用，不能因没有新控件免除它。以上是范围内抽取，不宣称四模板全章节和全部原始需求已经完成全批独立审查。

## 4. S findings：保留旧编号，加入新裁决缺口

### S-1 · 来源漂移未同步；同一凭证 owner 不再待决

**PARTIALLY_CONFIRMED；原 DEXTER_DECISION 中的凭证 owner 部分已由本次裁决解决。** Journey 第 48、54 行仍把终端凭证写在 server-config；第 54 行“只清凭证 slice”与 R-9.6 非配置 owner 全量清理不符；第 60 行仍将多节点 TDS 整体排为非目标；R-10.5 的身份引用也错误。详设 §0/CP-01 与计划 CP-01 仍把 owner 修订或 Dexter 再次裁定设为前置。

最小修订：登记全部漂移；按新裁决改详设/计划中的等待理由；Journey 应区分批次二多实例部署和批次三跨节点取代。取消激活的 reset 范围仍依 R-9.6，不能缩成只清 client 凭证。修改哪些正本需服从后续任务范围，本稿不替代修改授权。

### S-2 · V-S9 与新摘除/下线顺序的回归覆盖不完整

**PARTIALLY_CONFIRMED；纠正旧稿“立即拒新、必然失败”的推断。** 当前 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java:888–918` 先等待 drain/refused 日志，再测试新连接；它没有直接证明请求下线瞬间就拒新。实证缺口是计时从 requestGracefulStop 前开始、总上界仍为 10 秒，而新设计先等待 3 秒再最多 drain 10 秒；等待期间仍可登记新会话的覆盖也未并入旧 V-S9。

CP-04 明确同步 V-S9 与 V-S15、分开等待与 drain 的计时和断言，§11a/计划列齐。优先复用现有 TDS CONTRACT 场景能力，比较在最后执行的下线场景中补齐断言，与新增单 ID CLI/改 V-S1 通道的成本；不能只增加 V-S15 后让旧场景继续按旧时序。

### S-3 · 默认节点号缺少原要求的真实验收读回

**CONFIRMED（设计覆盖缺口）。** 需求 V-S15 要求非默认节点号以及未配置时默认值；详设 §11a/计划 CP-04 只把默认值列为 unit/runner tests，真实场景使用非默认值。补一个默认启动的真实 TDS 场景，核对 SESSION_READY 与 PostgreSQL 最新值；如拟降档，按 D-48 明确交 Dexter，不把 unit 结果代作 acceptance。

### S-4 · V-B15 引用了不属于 acceptance lifecycle 的 DEV seed

**CONFIRMED。** 计划第 191 行使用 `r5-full` 8 条终端 fixture；需求 V-B1 明确后台验收不加载 DEV seed，当前 `TerminalConnectionContractScenarios.java` 已有 `createConnectionContractFixture` 场景内建数路径。复用 owning acceptance fixture，在真实 HTTP 内完成新建/激活/取消与 readback，不以 seed 或直接数据库造绑定替代。

### S-5 · 联调 fixture 形态匹配与业务复原未进入清理闭包

**CONFIRMED（设计覆盖缺口）。** 需求 R-1.4 要求设备形态匹配；§8 第 17 条要求用过的终端复原为未激活。详设 CP-05 仅选 1/4 条 fixture、控制进程/容器清理；计划 CP-05 未给出逐场景业务复原与类型筛选要求。

写明选取 laptop/mobile 匹配的终端；每场景通过真实 owner command 恢复未激活并 readback。业务复原与 process/container cleanup 分开记录，失败保留 first failure，禁止为了再跑而未经授权 reset/seed。

### S-6 · 设备形态闭集的双向一致性漏项

**CONFIRMED。** 需求 R-1.2 第 91 行与 V-G1 第 899 行明确两侧闭集一致、任一侧加值使默认 `scripts/verify` 失败；详设/计划未列该对应工作项。CP-03 补 `SurfaceForm` 与生成设备形态类型的双向相等断言，归属现有 TER 类型检查；两侧各一条真实 red mutation，不新造闭集登记表。

### S-7 · TER generated 对账与目录词汇未接入

**CONFIRMED。** `tools/verify-gates/cli.mjs:1028–1074` 的 generated slice 集合未含 TER；`tools/terminal-readability/check-static.mjs:9–26` 词表未含 `generated`。需求 R-12 已要求承接。

CP-01/§12.2 写明现有三方 exact-set 对账如何纳入 TER producer、登记表与生成切片，加入 `generated` 词汇并同步终端规范；列明各自 verify 模式与 marker-specific red mutation。不得仅生成 terminalApi.ts 后宣称生成闭包完成。

### S-8 · 握手失败与握手后未就绪失败的节奏混同

**CONFIRMED。** 详设第 194 行要求未 ready 被拒时同周期继续下一个 entry；R-10.3 区分握手阶段失败的同次换址，与握手后未就绪结束的下一节奏尝试。补齐两个阶段，V-T7 验证尝试起点间隔。

transport 只识别通用阶段/信号；client 判断业务 ready 或业务拒绝。已就绪连接被 redirect 后的首选入口策略按 D-45 保留，不能把所有 redirect 都改成立即切入口。

### S-9 · 代理密码存在两条相互矛盾的读取路径

**CONFIRMED。** 详设 CP-02 的网络快照、§10.2 hydrate 至 owner slice，与第 199 行“request/socket 创建时从 protected persistence 解密”不一致。保留 state 的 hydrate/persistSecure 能力和 owner 状态快照这一条路径；网络调用方不得直接访问持久库或另缓存密码。公开 selectors/诊断排除密码，验证 owner 路径与秘密负向检索。新裁决没有自动修好此矛盾。

### S-10 · 需要收紧 inflater 上界；旧稿“默认无限”的结论不成立

**PARTIALLY_CONFIRMED；默认无限的前提 REJECTED_WITH_EVIDENCE。** 只读 `permessage-deflate.js` 的字段初始值 0 不足以判定 WebSocket 实际默认值。官方 v8.11.2 的 DispatcherBase 提供 `maxPayloadSize` 默认 128 MiB；WebSocket 建连后从 dispatcher 读取该值，再交给 ByteParser/PMD。它仍大于本仓协议要求的 65,536 字节，所以显式收紧及 focused 边界证明仍必要。[DispatcherBase](https://github.com/nodejs/undici/blob/v8.11.2/lib/dispatcher/dispatcher-base.js)，[WebSocket](https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/websocket.js)，[receiver](https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/receiver.js)，[PMD](https://github.com/nodejs/undici/blob/v8.11.2/lib/web/websocket/permessage-deflate.js)。

详设写明所选 dispatcher 的 `webSocket: { maxPayloadSize: 65536 }` 配置及实际取值链；直连和代理都要验证，不能把字段猜加到 WebSocketInit。Client 构造接收 `webSocket`，ProxyAgent 调用 `super(opts)`；这些是版本源码依据，不能代替运行证明。[Client](https://github.com/nodejs/undici/blob/v8.11.2/lib/dispatcher/client.js)，[ProxyAgent](https://github.com/nodejs/undici/blob/v8.11.2/lib/dispatcher/proxy-agent.js)。

补恰好等于上界、超上界、高倍压缩和分片累计的适用反例。CONNECT 非 200 的源码路径会产生 RequestAbortedError；不据此把所有代理失败都判为确定未送达，按实际错误边界分别证明。

### S-11 · Node 联调的 TS 加载与多实例隔离尚未设计闭合

**PARTIALLY_CONFIRMED。** transport 的 `package.json:5–7` 导出 TS 源码，详设 CP-05/计划 CP-05 定义 `.mjs` 入口和同进程四套组合，未指定完整加载方式。当前 `createStateRuntime.ts:73` 起可见实例局部状态，不能因此断言 TER 天生不支持多实例；runtime registry、namespace、持久存储和释放仍须证明。

选一种仓内支持的加载/构建路径，明确同进程或多进程及所复用能力；focused proof 起两套真实组合，核对 state、commands、selectors、连接、存储、dispose 互不串扰。无需为了验证四个逻辑客户端另建平台框架。

### S-12 · 新裁决要求的业务协议 owner 尚未完整落稿

**CONFIRMED（新增设计明确性缺口）。** 详设第 194/195 行直接在 transport 段使用 SESSION_READY 与其心跳参数；第 197 行只列 client 接收 SESSION_READY/PONG 的 actor，没有明确认证首帧、PING 编码、PONG.seq 匹配、RTT 计算及心跳计时的归属。HTTP 段第 193 行也未分清通用 executor 与端点业务解析边界。

按 §2 完整同步 CP-03、状态表、command/selector、接线表及计划：client 解释 TDS/HTTP 业务；transport 收通用信号执行通讯机制；server-config 提供地址。不把“无反向 import”当作职责证明。

focused 反例至少包括：socket open 但未 ready 不算业务连接成功；不匹配/旧会话 PONG 不更新 RTT；业务取消由 client exactly-once 停重连再 reset；地址更新不主动关闭已有连接；transport 在不知 TDS 帧名的替身下仍可完成通用 ready/失效/切换。实际 API 名与状态闭集以修订后的详设确定，不由本评审新增生产契约。

## 5. N findings：改进与边界澄清

| 编号 | 核验状态 | 当前问题与最小处置 |
|---|---|---|
| N-1 | CONFIRMED（不必要的设计扩面） | 计划 CP-01/CP-06 将两份本批文档加入旧 store-terminal L2 controlPlane，并要求无本批 action 的 L2 admission PASS。移除无依赖的控制面扩写，§3a 写本批 N/A 理由；保留真正适用的 Expo Web、managed runtime 与 seed 条件，不能顺带取消它们。 |
| N-2 | CONFIRMED（配置明确性缺口） | HAProxy 用户入口“不转发 `/actuator/**`”只有原则。给出路径拒绝规则及经入口被拒、节点 loopback readiness 仍能被健康检查读取的证明。不得因共端口而开放管理路径。 |
| N-3 | CONFIRMED（可简化项） | Undici v8.11.2 engine 是 Node `>=22.19.0`；精确锁 Node 22.23.3 若没有其他需要，可改为受支持版本范围及真实运行版本记录，保留实际 loader/API 兼容校验。不能据最低 engine 推断任意后续版本都已验证。[官方 package.json](https://github.com/nodejs/undici/blob/v8.11.2/package.json)。 |
| N-4 | PARTIALLY_CONFIRMED | 详设已给 standalone Undici 方案和不同代 dispatcher 的理由；补明确标注其为 R-16.3/R-16.4 允许的替代路径。Node bundled 精确版本/兼容性不能直接继承旧报告，实施前绑定实际 Node 与 package/lock 再核验。 |
| N-5 | CONFIRMED（当前源码重读要求） | 当前 `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketConfiguration.java:29–33` 已采用 Reactor Netty 原生压缩与解压/帧上界。CP-04/CP-05 按当前锁、限流与压缩源码重新对齐，不把旧手写 inflater 清理写成尚未发生的事实。 |
| N-6 | CONFIRMED（措辞与范围澄清） | 计划 CP-02 把 TR-09 的新 reset 保留范围写作细化既有例外。给出拟修订正文，区分既有例外与本批新增的 server-config 精确保留范围，避免把拟实施条款冒充当前规范字节。 |

## 6. 同根扫描、反例与防再犯

本次 owner 同根扫描限定为需求 R-9/R-10/R-11、Journey 两条持久身份行、详设 CP-02/CP-03 与状态/接线/存储章节、计划对应 CP，以及当前 transport 的 `README.md`、`createTransportHeartbeat.ts`、`createTopologySession.ts`、`createTransportWebSocketController.ts` 四处。其余三处也已核对，不能只修改详设的一句 SESSION_READY 就结束。

重要反例：`createTransportHeartbeat.ts` 是注入 sendPing/markPong 的通用计时原语；`createTopologySession.ts:122–162` 处理既有 topology 小写 ping/pong，不能自动等同新 TDS 大写 PING/PONG 业务协议。本批不据新裁决无依据扩大成旧 topology 整体重构。可以复用不解释业务帧的 helper，TDS 编码/解析/seq/RTT/身份处置仍由 client 拥有。扫描未在这四处发现新 TDS 业务帧实现；这不等于整个仓库或未来实施已经通过。

可复用 review checklist：

1. 对每项事实分别指出谁持有、谁判断、谁发 command、谁提供 selector、谁持久化；依赖箭头不能代替行为归属。
2. 从实际 socket/HTTP 回调追至 actor、state、selector；TDS 帧、错误码和身份处理不能藏在通用 transport。
3. 区分终端激活凭证、代理密码、服务端摘要；每类只沿自己的 owner 能力使用，不为“统一秘密”新造存储。
4. 配置更新、取消激活、迟到事件与重连分别验证，不从网络断开推导取消激活。
5. 上界沿 dispatcher→parser→inflater 的实际参数链核对；字段初始值不等于运行默认值。
6. 下线计时分阶段，场景内建数与 DEV seed 分执行面，业务复原与资源 cleanup 分结果。

这些条目用于下次核验同类缺口；判据的权威仍是 Dexter 裁决、需求、协议及其 owning 规范，不新增机器门或 receipt 控制面。

## 7. 未验证清单与独立输入的限制

| 范围 | 本次证据 | 尚未证明 |
|---|---|---|
| 三包 owner | 文档/协议/有限当前源码静态核对 | 新包实际实现、状态与 selector 行为 |
| UI 能力投影 | 需求 V-T16/V-T17、既有投影设计 | Expo Web 真实显示与冒烟，L3_UNVERIFIED 非空 |
| Node/代理/压缩 | 精确 Undici 官方 tag 源码 | 实际解析依赖、TS loader、多实例、proxy、上界运行表现 |
| TDS 下线与场景 | 现有 V-S9 源码、V-S15 需求 | readiness/等待/drain/default nodeId 的真实 acceptance |
| DEV 联调 | 计划与需求 | 真实 3TDS/2入口、终端复原、两侧 cleanup |
| 全批审查 | 一个 fresh 只读子 agent 的有限输入报告 | 全批最小输入完整盲审及独立 GO/NO-GO |

六维查询实际返回：

```text
PROJECT_MEMORY=FAIL
REASON=missing owning source: apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTrackedSessionLimiter.java
```

入口、kernel、deterministic-context-only 和相关项目记忆原文已直接读取；直接阅读不能替代完整六维路由 PASS。缺失锚点与当前 `TdsConnectionCapacityLimiter.java` 应由后续适用任务核对，但本次不改索引、不生成记忆、不把 routing OPEN 隐藏成通过。

只读子 agent `/root/boundary_review` 已完成，真实状态为 completed；未超时中断，未运行测试、环境或写文件。它提供 owner、新裁决、S-2/S-4/S-7/S-8/S-9/S-11/N-5 的范围内核查及反例，明确没有全批 verdict。主会话重开来源后裁决并唯一写入本稿；没有将子 agent 的未核验项升级为其已确认结果。

## 8. 后续修订与复核范围

给设计侧的可复制 brief：

> 背景：批次二详设与实施计划已有原 Claude 补充评审，Dexter 现明确凭证只归 terminal-data-client；client 拥有激活/取消 command、TDS 业务心跳及三个状态 selector；server-config 只管地址配置；transport 只管通讯稳定与切换。请以本稿 §1 的仓根相对路径重开需求、Journey、协议、详设、计划和两份原评审，按 §4/§5 逐条 intake，输出 CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION，注明原文与修改位置。重点核验 S-12 全部业务协议 owner、S-1 不再重复等待凭证裁决、S-2 的真实计时反例、S-10 的 128 MiB 默认链与 65,536 显式上界、以及原需求验证项完整承接。当前结论 NO-GO，问题清单 M/S/N=0/12/6；本稿不是全批 fresh 独立 verdict。依当前修订授权整批修改、统一复核，不按 finding 拆成交付。未得到相应授权前不实施源码、依赖、生成、测试、DEV、reset/seed、L2、UAT 或部署。需求/Journey 正本若需变更，先明确任务范围；不得把本评审当作该修改权限。

本稿不重开已收口的作者 DESIGN 两轮 cycle，也不创造第三轮自行审查授权；这是 Dexter 新裁决驱动的补充整理。后续 cycle/审查范围依实际指派与现行 review governance 确定。

## 9. 主要输入字节绑定

以下 SHA-256 仅绑定本次读取输入，不是运行或合规 receipt。

| 输入简称 | SHA-256 |
|---|---|
| 原补充评审 | `322636659273d165935add6f7b3bf3977880e36c667ec08271c966127dd94857` |
| 原评审 | `bd9da980ad3885def90632006fb7705a8fb63ba0e5cb0c806e024e6d3162256e` |
| 详设 | `91ce9a3c044481391dbc2c1ffc1e15b2eed2c4f280ebd57318dad315fc75d3df` |
| 计划 | `15a8b9c303b860452326f7d4973dfabaa3130d878bc847c9698973afb5d89a01` |
| 需求 | `d5547971f87cf9041e162734de910db5a116d026faf91a73aaa9487e8d62ff28` |
| Journey | `fb3c6b1f70b746f16404420647ac974fdfb77e0b081efc0d78920f7123233c0a` |
| 协议 | `e5a6c77d0f1872b0b8fa9bdcbd38fda123176e6cac7c00d817ca8628ef8193b8` |

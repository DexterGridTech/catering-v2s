# 终端激活与长连接 · 批次三实施计划

DESIGN_STATUS=GO_M0_S0_N1_CLAUDE_INDEPENDENT_REVIEW
IMPLEMENTATION_AUTHORIZED=DEXTER_2026-10-02
RESET_DEV_START_FULL_SEED_AUTHORIZED=AFTER_CP_6B_ACCEPTANCE_AND_SEED_DRY_RUN
R14_DESIGN_PREREQUISITE=RESIDENT_PROBE_PASS_WITH_BOUNDS

详设：doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md
需求：doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md
R-14 evidence：doc/review/platform/2026-10-01-v2s-terminal-activation-batch-3-doris-feasibility-codex.md；doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-resident-feasibility-codex.md
amendment：doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md（按Dexter本次授权同步为ACCEPTED；实现授权来自本次指派）

授权边界：Dexter于2026-10-02授权按本详设与计划完成批次三全部生产实现、测试、脚本、Doris operational DDL、必要治理与amendment同步、正式DEV Doris接线、生成/编译/测试/verify、受管backend-acceptance及适用Node/DEV验收；动态验收完成后，在全批CP与6b MATCHED、适用准入完成且当前字节完整r5-full seed dry-run PASS后，执行非生产reset→DEV start→完整r5-full seed。范围不含L2、UAT、生产部署或批次外功能。

## 目标与顺序

批次三为单一交付单元：资源/版本准入 → Doris写入与跨节点正确性 → 远端DEV与acceptance生命周期 → 各CP focused proof及门 → 每CP三维对账 → 全批6b → 整体动态验收/cleanup → 逐代码13c → fresh整批IMPLEMENTATION review。批次二三TDS/双HAProxy拓扑复用，不重建部署；不做topic同步，不加统计API/页面。

历史Testcontainers探针证明远端临时容器启动、健康、SQL与cleanup；本轮resident probe另证明完整DEV服务共存时官方Doris缓存镜像启动、SQL、同一持久挂载stop/start读回及受管cleanup。run `r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5` 的瞬时资源值和证据边界见resident feasibility记录。该样本未限Doris cgroup内存，不等于峰值/长期容量。Stream Load/权限/readback、reset与业务行为仍是未来批次实施验证，不会被此probe升级为PASS。

## 通用执行纪律

- 每CP开始前按RECALL重读需求、详设、六维命中记忆、owning source和可复用实现；focused proof后用同组原文回读。
- 主agent唯一写入者；每个完整CP结束后fresh独立agent做需求/详设/项目记忆三维对账，OPEN修好并fresh复查同一CP到MATCHED。全部CP后另做全批6b；MATCHED后才进入整体动态验收。
- 所有受管服务只在远端；远端Docker daemon与PG/TDS同侧。本机不启Docker/PostgreSQL/Doris、不建PG或Doris tunnel；不连外部云服务、不配置镜像中转。
- 每run按manifest预检PID/start token、host/boot id/start ticks、Docker资源空集及预算；cleanup必须独立PASS。已有DEV身份匹配时按AGENTS Testcontainers/DEV联动先受管stop，测试业务与cleanup均PASS后才恢复。
- first failure保留；同failureCategory第二次出现只冻结该族后续场景，查看日志和owning source，根因修复后用同一focused proof零复发再继续。不得换场景、延长timeout或盲重跑。
- 当前文档阶段不执行以下CP命令，不宣称任何新PASS。
- reset/seed前提：本次已授权，但仍须CP与全批6b MATCHED、适用准入完成、整批适用动态验收及临时运行cleanup PASS，并在reset前取得当前字节完整r5-full seed dry-run PASS。DEV start不隐式seed。L2仅当真实有适用控件时准入，不造空分母。
- 每次状态分开报告当前字节最新运行/最后一次通过，附run id、时间、结果与代码字节是否一致；按详设§11a逐条报告，CONTRACT/BUSINESS/DB_OPERATIONS/cleanup分列。

## CP-01 · 实施输入、资源与R-14可行性闭合

RECALL：需求R-6.5～R-6.7、R-7.2～R-7.3、R-12～R-14、V-G1；详设§1～§4、§12；AGENTS远端拓扑、D-41和manifest预算规则；官方Doris/Testcontainers/JDK资料。

1. 只读重开TdsConnectionStateRepository.open/latest-state、TdsBindingRevocationListener LISTEN/reconcile、TdsTerminalSessionActors、TdsConnectionStateWriter、remote Testcontainers和DEV manifest lifecycle。
2. 使用`node scripts/dev/r5-doris-resident-feasibility.mjs preflight`受管只读入口刷新host/boot id、CPU、available/total RAM、swap、Docker数据盘、Docker memory、PG容器身份与`server_version`、缓存Apache image ID/repo digest及Testcontainers残留；和R-14 resident run基线比对。此入口不启动DEV、不创建/清理资源、不拉镜像。PG容器ID须匹配resident原始服务清单，boot id与Doris镜像身份漂移时按后续受管resident流程重核；资源不足则用实测事实评估是否影响本批预算，不据单次快照推导长期上限。本次run `r5-doris-preflight-1790875962405-28711-15a18ff2-7737-455d-82b6-8bf126ed492d`确认PG容器ID、boot id、Doris image ID/repo digest与resident基线一致；读取PG `server_version=16.13`，CPU 8、总/可用RAM 30665/23336 MiB、swap 0、Docker数据盘可用6519 MiB，Testcontainers容器与卷均为空。详见`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-cp01-codex.md`。
3. 已有临时容器与resident探针证据见两份R-14记录。复用resident run `r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5`：完整DEV在远端运行时，以唯一manifest创建带隔离持久挂载的Apache官方`apache/doris:all-in-one-4.1.3`，等待health、执行SQL、写入marker、停止并重启同一容器/挂载、读回marker；采集host CPU/RAM/disk、Docker cgroup限制、DEV的PG/MinIO/HAProxy/TDS与Doris资源。输出绑定host/boot id、container ID、image digest、mount、PID/start ticks及cleanup；结果为feasibility PASS、probe cleanup PASS、启动DEV的runner cleanup PASS。DEV原先未运行，由本步骤受管启动并在probe后受管停止。该证据已关闭本设计的R-14 resident feasibility前置，不代表峰值/长期容量或业务写入。除非host、镜像digest、挂载/runner字节或资源基线发生漂移，不重复resident probe；保留远端image cache，不用AlwaysPull。
4. CP-01刷新并核对Testcontainers实际解析：business test runtime为core 2.0.5与JUnit/PostgreSQL/JDBC/database-commons adapters 1.21.4；TDS runtime为Reactor Netty HTTP 1.3.7、Reactor Core 3.8.7、Netty 4.2.18.Final、pgjdbc 42.7.11，TDS test runtime含BlockHound 1.0.17.RELEASE。当前报告与哈希见CP-01记录；后续依赖输入变更时再重算。PG服务器实际16.13，按PostgreSQL 16官方LISTEN/NOTIFY文档实现顺序；CP-03做行为证明。Doris 4.1.3 Stream Load权限、直连与Duplicate Key仍在CP-02以真实容器验证。
5. 每次run把pull/image-ready、container-created、health-ready、SQL-ready、cleanup的阶段时间戳、image digest/ID、主机资源快照和manifest身份写入可归档artifact；区分business NOT_APPLICABLE、DEV resident probe、临时资源cleanup。不得只引用控制台里不可独立重算的单个总时长。
6. 本次R-14 resident probe通过本仓受管`r5-doris-resident-feasibility`入口执行；该入口仅运行隔离probe，按run manifest管理自己创建的容器/卷/临时目录，不提供DEV业务能力。所有后续R-14 resident/resource证据仍走受管remote entry，禁止手写SSH/Docker操作。

输出：临时与resident两类探针的分档证据、host资源与版本、image digest/cache策略，以及当前解析classpath。R-14 resident feasibility在health/SQL/volume-restart/readback、当前host共存快照、manifest身份与cleanup PASS后，对本次host与字节限定关闭；不将单次、未限memory样本扩展为峰值/长期容量结论。Stream Load/权限/readback和业务事实仍留在实施CP。fresh CP01三维MATCHED后进入CP-02。

## CP-02 · Doris operational schema与TDS异步writer

RECALL：需求R-2.3/R-6.5～R-6.7；详设§3、§4 CP-02、§7、§9a、§10；backend编码/日志规范；实际classpath与Doris官方4.1.3文档。

1. 仅新增详设点名的TdsConnectionHistoryEvent、TdsConnectionHistoryWriter、TdsDorisStreamLoadClient。CONNECTED来自TdsTerminalSessionActors成功登记；HEARTBEAT_RTT来自TdsWebSocketHandler.receivePing在PONG发送/seq校验成功后；DISCONNECTED在actor close callback每session一次。
2. 使用single worker与bounded serialized-event queue：最多4096条、单条≤1024字节、累计≤4MiB、batch≤128/128KiB；queue.offer非阻塞；full drop newest并计数。Stream Load只在worker等待JDK HttpClient `sendAsync`结果。500ms连接超时；一个10s总deadline覆盖发送、响应头与完整受限响应body，到期取消原future/exchange并返回REQUEST_TIMEOUT；最多3次及100/500ms退避；稳定batch UUID label与原payload重试。
3. DDL：新增scripts/dev/doris/connection-history.sql；Duplicate Key(event_id)，字段仅connection/disconnection/RTT所需；replication_num=1。schema建表非Flyway，DEV reset清数据而不删schema。无历史自动TTL。
4. 用4.1.3真实容器证明表级最低权限、BE 8040直连PUT、表创建/三类事件写入及SQL readback。通过精确TDS场景`terminal.connection.history-records`观察真实WS认证、两次PING/PONG（第二次携带第一次测得的RTT）、真实设备取消激活与`ACTIVATION_CANCELLED`，并按terminal/session身份在Doris读回1条CONNECTED、2条HEARTBEAT_RTT（含精确匹配测得值）、1条DISCONNECTED。该首次focused run同时执行一次topology preflight。Apache文档列出的Success/Publish Timeout/Label Already Exists状态按详设处理；未知状态有限重试，耗尽drop/uncertain。若4.1.3表级权限不够或必须扩全局授权，停Dexter。
5. focused tests：TdsConnectionHistoryWriterTest证明queue上限、caller不阻塞、drop与可观测性；TdsDorisStreamLoadClientTest证明URI/headers/body、稳定label、响应头前timeout、响应头后body停顿仍受总deadline限制并取消exchange、超时后下一batch成功、响应体上限、状态映射与脱敏。JDK 21.0.11+9的取消future可能以`CompletionException`包装`CancellationException`，用例断言cause链，不依赖`CompletableFuture.isCancelled()`；容器验证相同label不重载重复事件。
6. 命令：按实际Gradle任务核验后运行TDS单测（初步入口 ./gradlew :apps:backend:terminal-data-server:test）；通过`scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight --tds-contract-scenario terminal.connection.history-records`进行首次聚焦真实容器验收并完成拓扑预检。门失败保留first failure并修复根因。

输出：DDL和事件完整往返、上界与丢弃证据、精确Doris权限。CP02三维MATCHED后进入CP03。

## CP-03 · PG同事务通知、跨节点取代与listener恢复

RECALL：需求R-4.4/R-7.2/R-7.3/V-S4/S5/S6/S13；详设CP-03/§7/§8/§9b；现有publisher/listener/repository/actor。

1. 更新terminal-binding既有notification publisher、TDS payload parser、fixtures为typed union：binding revoke保留terminal/generation语义；session-open仅version/kind/terminalRef，无凭证、摘要或deviceId。
2. 在PG事务中写latest-state并pg_notify。PG open提交后、本地登记与SESSION_READY之前，candidate保持pending；不得先回SESSION_READY。
3. candidate开始本地登记前，按terminalRef向PG重读权威latest，并在现有per-terminal actor command顺序中比较/推进单调sequence水位；只有candidate identity与PG latest一致且sequence不低于已观察水位时才安装active并回SESSION_READY，否则关闭candidate，不登记。该复核与通知reconcile经同一per-terminal actor串行应用；通知仅唤醒，不取代PG读取。即使新通知先于旧candidate继续执行而被消费，actor保留观察到的高水位，旧candidate之后也不得回退。若`repository.open`已提交但此处权威readback抛错，只关闭该pending candidate并对精确identity调用stateWriter `queueDisconnect(SERVER_ERROR, persistedCallback)`；不能连带关闭既有active。候选无SESSION_READY/CONNECTED历史；tracked permit仅由断开已持久化后的callback释放，保留断开待写语义。
4. session-open通知只唤醒；listener按terminalRef重读PG latest。actor仅在本地sequence更小、PG最新行断开或session identity不符时关旧连接；旧/乱序通知不得关闭高sequence会话。
5. listener启动/恢复时先LISTEN并commit，再批量读取本节点tracked terminal的latest-session并reconcile；LISTEN前提交的通知由read覆盖，LISTEN后提交的通知由listener收到后重读覆盖。不得增加定时状态轮询；R-7.3的30秒重建上界保持。
6. focused actor与PostgreSQL proof：actor测试确定性注入open成功后的`readCurrentSession`失败，断言无SESSION_READY、candidate disconnect被排队、previous active保持打开、permit在persisted callback前不可复用；PostgreSQL repository测试以两个连续identity证明迟到的旧identity disconnect不覆盖新session。之后执行受管真实PostgreSQL事务focused proof：
   `node scripts/test/r5-remote-testcontainers.mjs :apps:backend:terminal-data-server:test --tests com.catering.v2s.terminaldataserver.state.TdsConnectionStateRepositoryPostgresIntegrationTest`
   验证事务rollback后latest row不存在且listener收不到通知；事务commit后row与通知同时可见。该类含Testcontainers，禁止通过本机Gradle直跑。
7. 真实双TDS/真实HTTP focused acceptance：
   `scripts/test/backend-acceptance --operation storeTerminalActivationBusinessPrecedence --topology-preflight --tds-contract-scenario terminal.connection.vs13.cross-node-recovery`
   结果分别核对TDS CONTRACT、HTTP BUSINESS/fixture cleanup、PostgreSQL最新会话事实与runner cleanup。场景覆盖A监听断开期间B提交较新会话、A恢复后30秒内按PG最新row关闭旧session；还验证候选A在PG open已提交但本地登记前被确定性屏障暂停、A监听器消费B的高sequence后水位、A随后不得回退登记或发SESSION_READY；B仍有效，错误凭证不影响B，真实HTTP设备取消只关闭目标会话，控制会话持续PONG。测试不得手工NOTIFY或修改业务绑定状态。

输出：PG commit、本地pending登记、权威复核、active安装、SESSION_READY与通知reconcile的顺序证据；保留上述PostgreSQL integration test与V-S13场景的run ID及独立cleanup结果。CP03三维MATCHED后进入CP04。

## CP-04 · 远端DEV/reset/acceptance容器所有权

复用 resident Doris 时，ensure 必须用当前受管 credential 中的 writer 密码执行 ALTER USER 后再校验表级授权；adoption focused proof 预置旧密码，证明 CREATE USER IF NOT EXISTS 不会掩盖凭证漂移，且密码不进入日志。

RECALL：R-6.7/R-13/R-14；AGENTS远端环境/资源/cleanup；详设§4 CP-04/§9a/§11a。

1. scripts/dev/r5-dev-runner.mjs增加manifest-owned resident Doris官方镜像容器、loopback-only端口、官方持久mount、container/image/mount identity、资源预算与readiness。start检查或复用identity完全匹配且健康的容器，不配置AlwaysPull；普通DEV stop停止业务/TDS/HAProxy，不停Doris、不删mount/image；由单独基础设施生命周期owner负责Doris停机。image cache保留。
2. scripts/dev/r5-reset.mjs在reset前完成当前字节完整seed dry-run并核实DEV与Doris基础设施manifest；先受管stop全部连接历史生产者并cleanup PASS，再核对同一resident Doris container/image/mount identity与健康，truncate history并SQL readback=0，成功后才执行既有PG reset/readback。Doris清理失败则不得执行PG reset；PG reset在Doris已清空后失败则记录partial-reset、保持DEV停止，不start/seed。reset保留DEV Doris container/schema/mount/image。
3. scripts/test/r5-remote-testcontainers.mjs、scripts/test/backend-acceptance、BackendAcceptanceTest和TdsAcceptanceProcess每run创建一个远端GenericContainer Doris、同宿主连接，不加Doris tunnel；容器/卷/进程写manifest并在业务成功或失败后cleanup；cache保留。
4. runner红夹具覆盖缺manifest身份、本机fallback、Doris非loopback绑定/Doris tunnel、reset删DEV volume、cleanup删image cache；每个夹具以稳定marker失败。
5. readiness不等待Doris连接成功以保护业务主流程；配置endpoint必须存在/可解析，Doris暂时失败由异步writer隔离。不得把Doris设为可跳过组件。
6. 本CP脚本focused测试验证manifest与cleanup形态；真实DEV start/reset仅在本批实施授权的reset准入完成后运行。

输出：远端实例身份、数据挂载、reset读回、每run cleanup。CP04三维MATCHED后进入CP05。

## CP-05 · 场景与业务Oracle focused proof

RECALL：详设§11/§11a；需求V-B1/B9、V-S4/S5/S6/S7/S11/S13、V-E1/E3；backend-acceptance业务scenario标准。

1. 扩展TerminalConnectionContractScenarios.java真实TDS CONTRACT。跨节点替换与登记竞态由实际动态测试`terminal.connection.vs13.cross-node-recovery`执行：它在一条测试及一条aggregate结果行中分别断言online takeover与`commit-before-local-registration`屏障交错；`terminal.connection.latest-state-stale-write`另写独立结果行。PG `session_sequence`是唯一跨节点顺序；源码路径不读节点时钟，因此用源码不变量加动态sequence读回证明时钟独立性，不伪称注入了时钟偏差。不得把逻辑子路径误报为独立运行场景。
2. 在StoreTerminalAcceptanceScenarios.java既有storeTerminalActivationBusinessPrecedence方法加真实HTTP activation/reactivation/cancel/void路径，断言PG audit事实与Doris outage不影响业务。无新operationId、route或BUSINESS分组。
3. BackendAcceptanceTest维持两个业务上下文与原PG，新增一个run-scoped Doris；三节点拓扑按R-14增加一个TDS场景实例。CONTRACT、BUSINESS、DB_OPERATIONS、fixture cleanup和runner cleanup分栏。
4. V-S7将queue cap设为小于挂起写入量；Doris挂起接请求不响应；各操作20次最大响应<1秒；队列止于界限并可读到drop。DB outage与Doris outage分开场景。
5. V-B1/V-S11扫描TDS日志、runner报告和Doris rows；不把secret fixture打印入运行日志。
6. 扩展现有terminal-client-dev-acceptance.mjs的V-E1 Doris readback；不添加TER UI。本批任何adapter无关终端行为都先Expo Web再设备，TR-16限制不扩大测试范围。
7. 本CP仅运行新增/修改场景的focused proof，逐条报告CONTRACT、BUSINESS、DB_OPERATIONS与cleanup；完整适用目录及DEV验收留到全部CP和全批6b匹配后的批次级整体验收。

输出：仅列本CP新增或修改场景的focused结果、实际测试ID/aggregate结果行及其已执行子断言、run ID和cleanup；逻辑子路径须映射到实际测试ID和结果字段，不得伪装成单独场景。后置或未运行项标记为NOT_RUN。完整§11a逐条最终结果由全部CP完成且全批6b MATCHED后的批次级整体验收产出。CP05三维MATCHED后进入CP06。

## CP-06 · 本批适用静态门与focused proof

RECALL：R-12/V-G1；scripts/verify默认/validate-only模式；诊断、run manifest、清理规范。

1. 只实现详设§9a.1有限门映射列出的本批适用既有门，并为受影响门补原违规形状red fixture与稳定marker；无HTTP/OpenAPI/TER generated/Flyway/seed变化的门按表中N/A理由处置。
2. 本CP运行适用focused gate/test与`scripts/verify --validate-only`静态部分，记录入口、verify模式、marker/结果与耗时；默认`scripts/verify`含运行段，推迟至批次级整体验收。
3. 每个完整CP的工作与focused proof完成后、进入下一CP前fresh三维对账MATCHED。本CP退出条件只有适用静态门、focused proof和本CP三维MATCHED；不包含整体验收、跨CP cleanup、13c或IMPLEMENTATION review。

## 批次级整体验收与交付收口（不属于CP-05/CP-06退出）

全部CP-01～CP-06完成且各自三维MATCHED后，先由fresh reviewer做一次全批6b三维对账并MATCHED；再做受管拓扑预检、focused动态场景、完整适用backend-acceptance/DEV验收与默认`scripts/verify`，分开报告business与每次cleanup。所有临时受管运行cleanup均PASS且reset/seed准入齐全后，先对当前最终字节做完整r5-full seed dry-run，再受管reset（先停止历史生产者、清空Doris并readback=0，再执行PG reset）、独立DEV start/readiness、完整r5-full seed并readback。最终健康受管DEV保留供Dexter review。完成后fresh reviewer做13c逐代码与详设对账（仅MATCHED/OPEN），再执行整批`REVIEW_TARGET=IMPLEMENTATION`独立对抗review。NO-GO按finding intake、最小修复和新fresh复审闭环。

## 阶段对账、逐代码与交付

每CP完整工作与focused proof结束、下CP开始前fresh独立agent三维对账MATCHED。全部CP匹配后、第一次整体动态运行前fresh独立agent全批6b MATCHED。OPEN由主agent修复后用fresh reviewer复查同范围。13c为批次级整体验收后的交付前另一步、逐代码不是抽样，结论只能MATCHED/OPEN。

交付材料：文件清单；每条V判据对应当前run ID/执行档位/结果；业务与cleanup分开；两行最新运行/最后通过；冷拉/cache hit分开；实际Docker资源、image digest、PG server_version；CP对账、6b、13c、独立implementation verdict；Doris丢弃/重试可观测证据；保留的DEV与必须释放的临时container分别列出。

## failure pattern 防再犯

| 问题族 | 根因 | 预防 |
|---|---|---|
| 多节点按本地时钟排序 | 缺少共享权威顺序 | PG session_sequence反例测试；review checklist禁止以节点时钟决定接管 |
| 将LISTEN payload视为真相 | 通知可丢/乱序 | 通知后查询PG latest；reconnect integration proof |
| Doris不可用导致内存增长 | 异步写无界 | 有界queue生产red proof；queue满caller非阻塞/drop测试 |
| 容器资源归属不明 | Docker生命周期脱离manifest | runner结构门检查identity/cleanup/loopback；不按名字停未知容器 |
| 历史证据被说成当前PASS | 缺少run/字节范围区分 | 每项V绑定当前runId/source bytes，历史R-14只保留历史档位 |

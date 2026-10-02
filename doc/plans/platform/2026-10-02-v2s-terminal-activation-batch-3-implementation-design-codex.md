SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# 终端激活与长连接 · 批次三详设

BUSINESS_SOURCE=doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md
JOURNEY_REFS=doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md#batch-3
IA_REF=N/A（纯后端与运行拓扑，无 UI-bearing 行为）
INTERACTION_REF=N/A（同上）
AUTHORIZED=批次三详设与实施计划；Dexter于2026-10-02授权批次三全部生产实现、动态验收、受管非生产reset→DEV start→完整r5-full seed及本详设列出的必要amendment/治理同步
NOT_AUTHORIZED=L2、UAT、生产部署、批次外功能
IMPLEMENTATION_AUTHORITY=true (Dexter 2026-10-02; subject to CP/6b/admission/dry-run conditions)
DESIGN_STATUS=GO_M0_S0_N1_CLAUDE_INDEPENDENT_REVIEW
R14_DESIGN_PREREQUISITE=RESIDENT_PROBE_PASS_WITH_BOUNDS
REVIEW_CYCLE_ID=2026-10-02-terminal-activation-batch-3-design
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED

受管resident feasibility probe已完成：run `r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5`，在批次二DEV全栈同机运行时启动Apache官方Doris 4.1.3缓存镜像，health/SQL、隔离持久挂载停止重启读回、host资源采样与cleanup均PASS。证据及首败处置见`doc/review/platform/2026-10-02-v2s-terminal-activation-batch-3-resident-feasibility-codex.md`。证据只覆盖一次、未限memory的短时可行性样本；不证明峰值/长期容量、Stream Load/权限、reset或跨节点业务。Doris/多节点amendment已由Dexter于2026-10-02接受，详见`doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md`；实施授权来自本次指派。

## 1 · 真实业务目标与方案比较

### 1.1 结构性问题

批次二已有三个TDS节点，但节点不共享会话内存。同一终端新会话落到另一节点后，旧节点可能继续把旧连接当作当前连接；监听器断线重建也可能漏掉窗口内的新会话。连接历史尚未持久记录。批次三用PostgreSQL最新会话序号作为唯一排序事实，通过事务通知和重建核验让旧连接失效；连接、断开及每次RTT写入Doris，且Doris故障不得拖慢主流程。

绑定与审计仍由业务owner写PostgreSQL。Doris只接收连接类历史，不写绑定历史，不承载业务权限、接口、统计页面或读取API。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| 各节点靠本地会话表或节点时钟协调 | 节点崩溃、时钟偏差、并发登记时无法确定全局最新会话 | 拒绝：不能满足R-6.3、R-7.2、V-S4 |
| 定时扫描PostgreSQL或Doris找新会话 | 将变化变为常态轮询，违反R-7.3，且仍需处理关闭竞态 | 拒绝：不引入轮询 |
| PostgreSQL序号行 + 同事务LISTEN/NOTIFY唤醒 + 重连核验；Doris单线程有界异步Stream Load | PG序号承担顺序事实，通知只唤醒；Doris故障经有界队列隔离 | 采用：复用现有latest-state、listener、actor与受管容器 |

我选了方案C而不是A/B，因为它沿用PostgreSQL唯一顺序事实与已有监听器，不引入通用消息系统、轮询或第二套会话目录。

### 1.3 形态理由

我选数据库序号而不是节点时钟，因为V-S4明确要求节点时钟落后时仍正确取代旧会话。
我选事务内通知作为唤醒而不是通知载荷作为真相，因为通知可能延迟或丢失；节点收到后重读PostgreSQL最新行。
我选单TDS writer与内存有界队列而不是MQ/outbox，因为需求只要求有限重试与丢弃。
我选Apache官方固定版本Doris测试/开发镜像而不是本地安装或云服务，因为Dexter已明确要求远端本机部署；不宣称此镜像是生产拓扑。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-01 | 实施输入、资源与版本前置 | 主agent/managed runner | 同机资源复测、镜像digest、PG版本、R-14补证 | 本稿与受管探针记录 |
| CP-02 | Doris表与有界连接历史writer | terminal-data-server | DDL、配置、事件、批写客户端、限额与日志 | CP-01 |
| CP-03 | 跨节点会话取代与监听重建核验 | TDS + terminal-binding notification publisher | 同事务会话通知、actor compare-and-close、重建核验 | CP-01、PG latest-state |
| CP-04 | 远端DEV/reset与acceptance容器接线 | managed scripts/backend-acceptance | 远端常驻Doris、每run独立Doris容器、reset清表 | CP-01/02 |
| CP-05 | 场景实现与focused proof | backend-acceptance/TDS CONTRACT | V-S4/S5/S6/S7/S11/S13、V-B1/B9、V-E1/E3的场景与focused proof | CP-02～04 |
| CP-06 | R-12适用门与静态验证 | TDS/gates/managed scripts | 有限门映射、red fixtures、诊断日志及validate-only | CP-01～05 |

每个完整CP完成全部实现、focused proof与必要修复后、下一CP开始前，fresh独立reviewer做CP三维对账；CP-06不包含跨批动态验收、cleanup、13c或最终IMPLEMENTATION review。全部CP MATCHED后另做全批6b，再做批次级整体验收、cleanup、13c及整批review。

## 3 · 横切机制对照表

| 机制 | ①现成能力/规范 | ②如何验证 | ③无现成时形态 | ④本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | N/A：无业务读取operation；Doris readback仅managed acceptance | 静态确认无新增route；验收读取受runner身份约束 | 若需产品读取入口先改需求与授权 | TDS历史入Doris、DEV/reset受管readback |
| 写授权与 grant 复核 | N/A：TDS Doris writer用专用表级LOAD身份 | CP-02对4.1.3做最小权限Stream Load反例 | 表级权限不足停Dexter，不扩大成全局授权 | 单Doris表写入 |
| 跨 owner 写与事务 | TdsConnectionStateRepository.open、PG latest-state；session-open NOTIFY同一PG事务 | PG focused test断言rollback无通知、commit后row与通知同时可见 | 同一事务/statement，不写业务binding schema | 新会话latest-state+NOTIFY |
| 集合形态与分页 | N/A：无业务集合/API | 静态无route/model变化 | 不建统计查询 | Doris append-only历史，仅受管reset清空 |
| 缓存失效 / 改完刷新什么 | N/A：无前端/缓存 | 静态无consumer cache变更 | 不新增缓存 | N/A |
| **RTK 数据读取与加载判定**（currentData / isFetching） | N/A：无前端 | 静态无RTK slice变化 | 不加UI | N/A |
| **同一事实只有一个住址**（不把服务端数据镜像进本地state） | backend owner标准、R-6.1/6.5 | PG只保留binding/latest；Doris只连接历史 | 不把PG binding/audit/credential复制到Doris | PG绑定/审计/latest；Doris连接/断开/RTT |
| **失败可见且原因不得改写** | AGENTS观测标准；TdsConnectionStateWriter与TdsAsyncLog | focused模拟超时/拒绝/队满并读日志/counters | writer失败转脱敏分类与计数，不抛进HTTP/WS路径 | Doris网络、HTTP、语义错误及满队列 |
| **owner错误到HTTP的映射与注册处** | N/A：无新业务operation/Problem | 静态edge route不变 | 不增错误码 | N/A |
| **新owner的审计三件套** | N/A：无新业务owner | V-B9对比PG审计完整且Doris无binding event | 复用TerminalBindingOwnerService审计 | 激活/取消/作废只在PG audit |
| 幂等键构成与重放语义 | Stream Load每批稳定UUID label | fake HTTP与4.1.3证明超时重试不重复 | 同批沿用同label及同payload；未知结果有限重试后drop/uncertain | 所有Doris批次 |
| **该用生成物的地方不得手搓字符串** | N/A：无HTTP/client生成 | 静态无生成源变化 | Doris JSON使用typed event encoder，不拼业务API path | Doris payload |
| 日志落点与脱敏字段 | AGENTS日志规范；TdsAsyncLog、run-scoped runner | 搜secret原值、摘要、激活码、deviceId、Authorization无命中；队列/load counters可读 | structured event只写runId/nodeId/批大小/耗时/状态/失败类 | TDS writer、Doris容器、reset、跨节点通知/reconcile |
| 迁移回填与可逆性 | PG schema/Flyway不变；Doris operational DDL | 对比Flyway清单无变化；DDL可重复执行检查 | DDL放scripts/dev/doris，不进Flyway | Doris table |
| 前端共享行为（Drawer/列表/表单生命周期） | N/A：无UI | 静态无UI | 不增加screen | N/A |
| **管理后台交互一致性** | N/A：无交互 | 静态无UI | 不增加UI | N/A |
| 候选/下拉数据源 | N/A：无前端 | 静态无selector | 不加业务查询 | N/A |
| 编码与名称呈现 | N/A：无用户可见名称 | 静态无UI | 表内用稳定enum，不生成业务文案 | eventType、closeReason |
| **会同时坏的东西是否已声明为原子组** | foundation-charter §5-C及批次原子交付 | 每CP与全批6b检查整条事实链 | PG通知、actor close、Doris writer、reset/runner同一批验收 | 跨节点接管/重建；连接历史写入与生命周期 |

### 第三方库依据与验证

- Apache Doris：官方镜像apache/doris:all-in-one-4.1.3。官方资料把它定位为测试/开发单容器，含FE/BE/Meta Service，支持health、9030/8030/8040端口和持久目录；不适用于生产。本次受管探针实际以官方healthcheck等待并在容器内执行`SELECT 1`，结果与限制见R-14证据记录。
- Testcontainers：CP-01后由 `./gradlew --no-daemon :apps:backend:catering-business-server:verifyBackendAcceptanceRuntimeClasspaths` 刷新当前解析。当前 business 报告为 `apps/backend/catering-business-server/build/reports/backend-acceptance/runtime-classpaths.txt`（SHA-256 `5e439e9d15adaf4274fe880509d6832e7fafe884e9889e2c737f2d3d4d7f871e`），TDS 报告为 `apps/backend/terminal-data-server/build/reports/backend-acceptance/tds-runtime-classpaths.txt`（SHA-256 `92e229c52125eb5a5f6e9755514c676b1fcf042ba1ccf828cfae072731b07f02`）。business test runtime 解析为 core `org.testcontainers:testcontainers:2.0.5`，JUnit/PostgreSQL/JDBC/database-commons adapters 为 `1.21.4`；TDS main runtime 解析 Reactor Netty HTTP `1.3.7`、Reactor Core `3.8.7`、Netty `4.2.18.Final`、PostgreSQL JDBC `42.7.11`；TDS test runtime 在此基础上加入 BlockHound `1.0.17.RELEASE`，Testcontainers core `2.0.5` 与 database-commons/JDBC/JUnit-PostgreSQL adapters `1.21.4`，供 `TdsConnectionStateRepositoryPostgresIntegrationTest` 使用。GenericContainer、image pull policy与health wait属core `testcontainers:2.0.5`；adapter仍是`1.21.4`，不得把整个Testcontainers依赖组简写成一个版本。官方pull-policy依据使用2.0.5精确标签；health-wait只引用维护方文档的可用等待策略，不假定其他版本专属API。Testcontainers测试只经受管远端入口运行，不能进入本机TDS静态单元测试命令。运行记录证明远端Testcontainers命中Docker daemon缓存；删除本次容器/卷不会删除镜像，除非显式prune、换daemon、镜像digest改变或配置AlwaysPull。不得启用AlwaysPull。focused proof须把pull/image-ready、container-created、health-ready、SQL-ready、cleanup的时间戳写入可归档run artifact。精确API核验：`PostgreSQLContainer(String)` 与默认健康等待见Testcontainers Java 1.21.4源码；JUnit Jupiter容器扩展生命周期见同标签官方文档。
- JDK：Java toolchain 21；Stream Load使用JDK java.net.http.HttpClient。Oracle Java 21 API明确同步send会阻塞，故只能在单独writer线程执行；connect/request timeout和响应体上限用focused stub proof。
- PostgreSQL：受管只读预检实际读取远端既有服务 `server_version=16.13`（镜像标签为 `postgres:16-alpine`，标签本身不用于推断版本），对应 pgjdbc runtime `42.7.11`。PostgreSQL 16 官方 `LISTEN` 说明要求先提交 `LISTEN`，再在新事务检查状态，此后依赖通知捕获后续变化，可覆盖初始检查与通知注册之间的竞态；`NOTIFY` 事务提交后才交付。本批监听初始化按此顺序实现并用CP-03重建/并发focused proof验证。版本与远端主机/镜像绑定，不推断其他环境版本。
- Doris Stream Load通过HTTP PUT；直接指定BE 8040避免redirect；同一批重用label。Apache手册列出Success、Publish Timeout、Label Already Exists与ExistingJobStatus。CP-02须在精确4.1.3实测表级最低权限、直连和SQL读回；不能拿4.1.4行为替代。
- 官方资料：Apache All-in-One https://doris.apache.org/community/developer-guide/all-in-one-image/；Stream Load https://doris.apache.org/docs/4.x/data-operate/import/import-way/stream-load-manual/；Duplicate Key https://doris.apache.org/docs/4.x/table-design/data-model/duplicate/；Testcontainers 2.0.5 image pull policy https://github.com/testcontainers/testcontainers-java/blob/2.0.5/docs/features/advanced_options.md#image-pull-policy；精确版本健康等待API https://github.com/testcontainers/testcontainers-java/blob/2.0.5/core/src/main/java/org/testcontainers/containers/wait/strategy/Wait.java；精确版本容器生命周期API https://github.com/testcontainers/testcontainers-java/blob/2.0.5/core/src/main/java/org/testcontainers/containers/Container.java；Testcontainers startup/wait维护文档 https://java.testcontainers.org/features/startup_and_waits/；Java 21 HttpClient https://docs.oracle.com/en/java/javase/21/docs/api/java.net.http/java/net/http/HttpClient.html；PostgreSQL 16 LISTEN https://www.postgresql.org/docs/16/sql-listen.html；NOTIFY https://www.postgresql.org/docs/16/sql-notify.html；16.13 release notes https://www.postgresql.org/docs/16/release-16-13.html。

## 3a · L2 脚本开发前 UI/testId 前置复核

UI_DESIGN_REVIEW=NOT_APPLICABLE_WITH_REASON:无UI-bearing Journey、screen、操作控件或浏览器L2。
TESTID_REVIEW=NOT_APPLICABLE_WITH_REASON:不新增/修改testId与L2控制面。
L2_SCRIPT_ADMISSION=N/A:不执行L2，不制造空分母。

## 4 · 每个 CP 的门控

### CP-01 设计输入、资源与版本

失败条件：远端不能运行官方精确镜像；health或SQL失败；DEV同机预算不能与PG、MinIO、HAProxy、三个TDS共存；持久卷重启读回失败；或受管resident生命周期无法安全管理。
不变量：远端Docker daemon唯一承载Doris；不本机fallback/外部云/mirror/tunnel；读取真实host资源、Docker限额、PG server_version、image repo digest/image ID。
FORBID：非Apache镜像、AlwaysPull、无host数据即写死DEV资源上限。
验证：历史临时Testcontainers probe证明远端临时容器health、SQL、单次资源采样及cleanup。当前resident probe通过受管`r5-doris-resident-feasibility`入口，在完整DEV同机服务运行时证明loopback-only start/health/SQL/stop/restart/readback及marker持久化；记录host/boot id、container/image/mount identity、CPU/RAM/disk、Docker cgroup限制与PG/MinIO/HAProxy/三TDS/Doris资源观察。run ID、限度和DEV cleanup见resident feasibility report。实现CP-01只在host、镜像digest、挂载/runner字节或资源基线发生漂移时重新测resident；否则复用该证据并只刷新身份/资源预检。此probe只关闭R-14设计前置，不代表后续业务实现验证。
形态理由：先用远端缓存降低慢冷拉；digest不匹配时从Apache官方渠道拉取一次并记耗时。
RECALL：需求R-13/R-14；AGENTS环境矩阵、manifest/预算纪律；R-14 feasibility report。

### CP-02 Doris表与writer

失败条件：Stream Load同步阻塞PING/SESSION_READY/HTTP；队列无界；Doris失败变成业务失败；同批重试重复写入。
不变量：单worker；ArrayBlockingQueue最多4096条已序列化event，每条≤1024 bytes，总队列≤4MiB；每批≤128条/128KiB；offer非阻塞；满队列丢最新事件并计数；connect timeout 500ms、request timeout 10s、最多3次、退避100ms/500ms；同批重试复用payload与label。最终RSS预算由CP-01实测约束核定。
event仅含event id、TDS UTC event time、workspace UUID、terminal ref、node id、session id、PG session sequence、nullable RTT、nullable close reason；事件类型闭集为CONNECTED、DISCONNECTED、HEARTBEAT_RTT。禁止credential/摘要、激活码、deviceId、Authorization和binding/audit事实。
Duplicate Key保留所有event；单BE/单副本，DEV DDL创建；无自动TTL，本批不制定生产保留期，只有managed reset清表。
HTTP client只在独立writer线程同步send，不阻塞reactor或PG actor。Success/Publish Timeout完成；Label Already Exists+FINISHED完成；RUNNING有限重试；耗尽后drop/uncertain，不换label。
观测：queue深度/bytes、enqueue/drop、load成功/失败/耗时、retry、last failure category、node id；不记录payload/密码。
focused：TdsConnectionHistoryWriterTest覆盖上界、drop、caller不阻塞、稳定label；TdsDorisStreamLoadClientTest覆盖timeout、response cap和状态映射；真实4.1.3验schema/load/readback。
RECALL：R-2.3/R-6.5～R-6.7、backend coding/logging rules、现有TdsConnectionStateWriter、Doris 4.1.3官方资料。

### CP-03 跨节点会话接管与监听恢复

失败条件：B已提交较新会话而A仍能PONG；乱序低sequence通知关掉高sequence会话；A监听断开时B新建会话，A放行后30秒仍不关闭旧session；A的PG open已提交、但本地登记尚未完成时B提交并被A监听器核验，之后A仍发出SESSION_READY。
不变量：PG latest_state.session_sequence唯一排序源；open latest row与session-open NOTIFY同事务；通知只携带version/kind/terminalRef且只作唤醒；接收方重读PG最新行。`repository.open`提交后，候选连接保持provisional且不得发SESSION_READY；登记路径再读该terminal的PG latest row，并把读回结果与候选应用经同一个该terminal actor串行入口处理。actor单调保留已观察的最大session_sequence，即使当前尚无active session；候选sequence低于水位或权威PG行与候选identity不一致时，关闭候选且不登记。若候选先完成核验与登记、更新会话随后提交，则后到的通知仍须经同一actor串行核验并关闭较旧连接。仅当本地sequence更小、最新行已断开或身份不匹配时关本地旧session，原因SESSION_REPLACED。未成功占据latest row的连接不得发SESSION_READY或本地登记。
复用现有listener生命周期、binding revoke、10秒health probe、30秒重建；无周期扫描。
重建时LISTEN commit后查询本节点所有tracked terminal最新会话并reconcile。LISTEN前通知由这次批量read覆盖；LISTEN后commit由通知唤醒并按PG重读覆盖。验收不手发NOTIFY、不写binding状态。
focused：`TdsConnectionStateRepositoryPostgresIntegrationTest` 通过远端受管Testcontainers对真实PostgreSQL证明rollback不发通知、commit后latest row与NOTIFY一起可见；不得由测试手工发NOTIFY。listener union/乱序/reconnect；actor比较sequence并精准关闭旧session。受管 `terminal.connection.vs13.cross-node-recovery` 场景用真实HTTP与双独立TDS进程，以屏障在A监听器离线期间让B提交较新sequence，恢复A监听后30秒内确认它按PG最新row关闭旧session；同时断言B存活、错误凭证不影响B、真实HTTP设备取消只关闭目标会话且控制会话仍PONG。该场景还覆盖A PG open提交后、本地登记前B成为latest的登记闸门反例；若实现的闸门不能确定性暴露此窗口，应由实现测试接缝实现而不得用sleep猜时序。补一个相反顺序：A先通过权威核验/登记，之后B提交并触发reconcile，断言最终只保留B。
形态理由：通知可能丢/乱序，PG行作为真相。Testcontainers精确依赖依据：`PostgreSQLContainer` 1.21.4 官方源码 https://github.com/testcontainers/testcontainers-java/blob/1.21.4/modules/postgresql/src/main/java/org/testcontainers/containers/PostgreSQLContainer.java；JUnit 5 扩展 https://github.com/testcontainers/testcontainers-java/blob/1.21.4/docs/test_framework_integration/junit_5.md。
RECALL：R-4.4/R-7.2/R-7.3/V-S4/S5/S6/S13；owner发布器、TdsBindingRevocationListener、TdsTerminalSessionActors。

### CP-04 远端DEV、reset与acceptance生命周期

DEV Doris为远端resident official 4.1.3 container；loopback只暴露9030/8030/8040；persistent mounts采用官方目录/opt/apache-doris/fe/doris-meta与/opt/apache-doris/be/storage；独立基础设施manifest绑定container/mount/digest/resource budget。start检查/复用owned健康容器，不额外强制pull；DEV stop仅停止业务/TDS/HAProxy进程与入口，按远端PostgreSQL的基础设施边界保留Doris容器、mount和image，不停止、不删除；不删image cache。TDS要求Doris endpoint配置，但Doris可用性不进入业务ready gate，writer异步隔离失败。
reset顺序固定：完成当前字节seed dry-run并校验DEV/基础设施manifest；先经现有受管DEV stop停掉所有连接历史生产者且cleanup PASS；再校验同一个resident Doris的container/image/mount identity与健康，在同一远端host执行history truncate并SQL readback=0；成功后才执行既有PostgreSQL reset/readback。Doris reset或读回失败时不执行PostgreSQL reset；若PostgreSQL reset在Doris已清空后失败，记录明确的partial-reset，保持DEV停止，不启动/seed。整条reset不停止或重建resident Doris，不删除schema/mount/image。Acceptance每run在同远端Docker daemon用GenericContainer启动一个隔离Doris实例；container/volume写入run manifest，失败同样cleanup；TDS通过远端本机映射地址连接，不建tunnel。
red fixtures：manifest缺identity、local Docker fallback、Doris端口暴露公网/tunnel、reset误删DEV volume、cleanup删除image cache均应失败。
focused：script tests与manifest parser tests。DEV/reset实际生命周期由本次批次三实施授权覆盖，须在CP/6b/准入及当前字节完整seed dry-run条件满足后按受管顺序运行；当前尚未运行。
RECALL：R-6.7/R-13/R-14、AGENTS环境矩阵、runner/testcontainers源。

### CP-05 场景与focused proof

TDS CONTRACT只走真实WebSocket；业务BUSINESS通过真实HTTP；不新增operation identity，不手写DB状态/通知。此CP实现本批场景及其focused proof，不运行backend-acceptance全目录；完整场景与每条判据见§11/§11a。
失败条件：跨节点由同节点/轮询/人工通知伪造；V-B9只看状态码；Doris没有connection/disconnection/RTT readback。
failure artifacts：run-scoped TDS日志、PG latest row、Doris SQL结果、container manifest；业务与cleanup分开。阶段退出只要求本CP场景/focused proof及CP三维对账MATCHED。
RECALL：需求各V判据、backend-acceptance scenario standard、详设§11/§11a。

### CP-06 gates、诊断与静态验证

只执行§9a.1列出的本批适用既有门、其red fixture与`--validate-only`静态验证；新红fixture记录精确marker和入口。默认`scripts/verify`含运行段，推迟到全批6b之后的整体验收阶段；分别记录两种模式耗时，默认scripts/verify保持分钟级。
阶段退出仅为本CP工作、focused proof与fresh CP三维MATCHED；整批验收、cleanup、13c和implementation review不属于CP退出条件。
RECALL：R-12/V-G1、scripts/verify、observability/cleanup标准。

### 批次级整体验收与交付收口（不属于CP-05/CP-06退出）

顺序固定为：CP-01～CP-06各自完成并独立MATCHED → 全批6b MATCHED → 单场景拓扑预检 → focused动态场景 → 完整backend-acceptance/适用DEV验收及默认`scripts/verify` → 各运行cleanup PASS → 逐代码13c MATCHED → fresh整批IMPLEMENTATION review。整体验收与最终review不回填CP退出条件；有失败时保留首败并只按批准动态授权推进。

## 5 · operation / path / face / 集合形态

N/A：不增加HTTP route、operationId、consumer face或业务集合。

## 6 · 跨owner写矩阵

N/A：不改业务owner binding/audit写入。TDS只写已有PG latest connection state并在同事务发通知；Doris history异步且不参与PG业务事务。绑定类历史仍由terminal-binding owner写PG。

## 7 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| 会话先后 | PG session_sequence | TDS open upsert与session-open NOTIFY同事务 | 节点读最新行并关闭低序号session | V-S4/S13 |
| notification loss | R-7.3 | LISTEN恢复后bulk query；每次新session通知触发单terminal query | actor比较PG row与本地session identity | listener test/V-S13 |
| connection history | R-6.5 | session open/close callback入bounded queue | 专用writer批量Stream Load | V-S7/V-E1 |
| RTT历史含义 | 有效PING.lastRttMs | 每个PING对应一条RTT event；表示设备上一次成功PONG测得的RTT | Doris row.rtt_ms | V-S7 |
| binding history | R-6.5 | terminal-binding owner写PG audit | V-B9检查PG且Doris不含binding event | V-B9 |
| Doris故障隔离 | R-6.6 | async queue、finite retry/drop | WS、HTTP和PG业务不等待Doris | V-B9/V-S7 |
| Doris运行位置 | R-6.7/R-13/Dexter远端澄清 | managed manifest绑定远端host/container/mount/digest | DEV resident/acceptance per-run container | V-E1/V-E3/cleanup |
| secret boundary | R-2.3/AGENTS | typed event schema没有secret字段 | Doris rows、logs和reports | V-B1/V-S11 |

## 8 · 业务规则 → owner判定点

| 规则 | owner判定点 |
|---|---|
| R-4.4跨节点同terminal新session取代旧session | TdsConnectionStateRepository.open、TdsBindingRevocationListener、TdsTerminalSessionActors |
| R-6.5 | terminal-binding审计保留PG；TdsConnectionHistoryWriter接收3类event |
| R-6.6 | queue.offer非阻塞，限额/重试/丢弃/可见性由writer负责 |
| R-6.7 | managed DEV resident、acceptance per-run、reset仅清表 |
| R-7.2 | binding revoke既有通知保留；session-open由TDS事务发wake-up |
| R-7.3 | listener reconnect后核验latest state；无轮询，30秒上限 |
| R-2.3 | encoder/label/log/table都不存credential、activation code、raw deviceId |
| R-12/R-13/R-14 | remote only、same-host、manifest ownership、门与cleanup边界 |

## 9 · owner API与消费者清单

| owner method / entry | consumer |
|---|---|
| proposed TdsConnectionHistoryWriter.connected(SessionIdentity) | TdsTerminalSessionActors，在PG session登记成功后 |
| proposed TdsConnectionHistoryWriter.heartbeat(SessionIdentity,lastRttMs) | TdsWebSocketHandler.receivePing，PONG已发送及seq已验证后 |
| proposed TdsConnectionHistoryWriter.disconnected(SessionIdentity,closeReason) | TdsTerminalSessionActors，每个session close transition一次 |
| proposed TdsConnectionStateRepository.readLatestSessions(Collection<TrackedSessionKey>) | TdsBindingRevocationListener startup/reconnect/notification |
| proposed TdsTerminalSessionActors.reconcileLatest(CurrentSessionState) | listener重建与notification wake-up |
| proposed TdsTerminalSessionActors.sessionOpened(terminalRef, openedIdentity) | TDS本地登记路径：PG open提交后、SESSION_READY前做PG latest权威读与同terminal actor串行应用，更新单调sequence水位 |
| terminal-binding notification publisher | 现有cancel/void/reactivation owner路径；publisher/parser/fixture同步 |
| Doris DEV lifecycle entry | scripts/dev/r5-dev-runner.mjs的start/check/stop/reset |
| Doris acceptance lifecycle entry | scripts/test/r5-remote-testcontainers.mjs + BackendAcceptanceTest，一run一个容器 |

所有新方法在同CP必须有上述真实consumer；零调用者则删除。

## 9a · 实施前全链同步变更清单

| 事实 | canonical/source | backend/edge/migration | frontend | test/acceptance | fixture/runner/seed | disposition |
|---|---|---|---|---|---|---|
| typed PG event union | no OpenAPI | terminal-binding publisher + TDS listener；无migration | N/A | parser/publisher/listener tests，V-S13 | recovery gate复用 | 源与consumer一起修改 |
| cross-node session order | no contract | TDS repository/actor；PG schema unchanged | N/A | repository/actor tests，V-S4/S5/S6/S13 | 真实HTTP/WS，不手写DB | 实现源码和测试 |
| Doris append-only history | no API/protocol change | TDS history package；no Flyway | N/A | writer/client tests、V-S7/E1 | scripts/dev/doris/connection-history.sql；不进seed | operational DDL |
| Doris配置/秘密 | no public contract | TDS runtime settings，不迁移代理/凭证owner | N/A | startup/redaction tests | managed remote secret config | manifest不含密码 |
| DEV lifecycle/reset | no contract | no business migration | N/A | script tests/V-E3 | r5-dev-runner.mjs/r5-reset.mjs | remote manifest/readback |
| acceptance lifecycle | no new business operation | BackendAcceptanceTest/TdsAcceptanceProcess | N/A | StoreTerminalAcceptanceScenarios/TerminalConnectionContractScenarios | backend-acceptance/r5-remote-testcontainers | same runner, one Doris per run |
| R-12 gates | no generated slice | TDS logging/dependency/resource gates | N/A | §9a.1有限门映射及red fixtures | CP-06适用既有门；其余N/A有具体理由 | no retired control plane |

### 9a.1 · R-12/V-G1 批次三有限门映射

以下只列批次三新增或修改的TDS、Doris与runner形态会触及的既有门；`scripts/verify --validate-only`运行静态段，默认`scripts/verify`运行静态段及后续运行段（`tools/verify-gates/verify.mjs`）。新改写的门必须保留同违规形状红例；未改写的门不虚构新门。

| 检查面 | 入口与命令 | verify模式 | red proof/marker | 不适用边界 |
|---|---|---|---|---|
| TDS禁止MQ/outbox及运行边界 | `scripts/check/backend-boundaries --self-test`；`scripts/check/backend-boundaries` | validate-only静态段；默认模式静态段 | `R4_TDS_MQ_RED=PASS`、`R4_TDS_OUTBOX_RED=PASS`；红例在TDS生产树引入禁用类型/token | 不适用项无；保留现有规则 |
| TDS生产日志脱敏与无自由console/System输出 | `node tools/verify-gates/cli.mjs logging --self-test`；`scripts/check/logging-boundaries` | validate-only静态段；默认模式静态段 | `R4_LOGGING_TERMINAL_BINDING_RED=PASS`、`R4_LOGGING_TDS_RED=PASS`；两例分别在terminal-binding与TDS生产树加入受禁日志调用 | 不适用项无；日志门已扫描两棵生产树 |
| Doris/TDS运行时配置键闭包 | `node tools/verify-gates/cli.mjs runtime-environment-keys --self-test`；`scripts/check/runtime-environment-keys` | validate-only静态段；默认模式静态段 | `R5_RUNTIME_ENVIRONMENT_KEYS_TDS_CONFIG_RED=PASS`；红例分别移除TDS声明键、Spring配置绑定或配置消费者，闭集门均须检出 | 不适用项无；新增Doris键必须进唯一配置闭集 |
| TDS包/目录组织 | `scripts/check/code-layout --self-test`；`scripts/check/code-layout` | validate-only静态段；默认模式静态段 | 门自测要求`CODE_LAYOUT_SELF_TEST=PASS`及`GREEN_FIXTURE_APPROVED_TDS_RUNTIME=PASS`；生产结果标记`CODE_LAYOUT=PASS`；负例覆盖非法根、正例覆盖批准TDS根 | 新增源码仍使用既有terminaldataserver根，不设新根 |
| PostgreSQL查询与TDS数据库边界 | `scripts/check/database-boundaries`；`scripts/check/query-boundaries` | `scripts/verify --validate-only`静态段与默认模式静态段 | 默认门输出标记分别为`R4_DATABASE_BOUNDARIES=PASS`、`R4_DATABASE_QUERY_BOUNDARIES=PASS`；本批不改门实现或其已保护的不变量，沿用现有门，不新增专属红夹具 | 不新增Flyway schema、业务owner写边或PostgreSQL database；Doris DDL不进入Flyway。若CP改动触及门规则，必须沿用所属门的原违规输入做focused red proof |
| TDS focused/unit tests进入默认verify | `./gradlew --no-daemon :apps:backend:terminal-data-server:test --tests <批次三focused类>`；纳入`tds-constructor-assembly`选择器 | 默认模式运行段；`--validate-only`不执行 | 各named test反例必须失败；证据为Gradle失败用例名及JUnit XML，不伪造通用marker | 不以validate-only PASS冒充TDS单测PASS |
| OpenAPI、TER生成、operation budget、edge security、前端架构、Flyway/seed | `tools/verify-gates/verify.mjs`中对应既有门照常按所选verify模式执行，本批不新增或改写其输入 | validate-only中执行的静态门；默认模式再加运行段 | N/A：本批不改HTTP operation/schema、TER生成目标、operation身份/预算、edge auth、前端页面、Flyway或业务seed；这些输入一旦被CP改动即移除此N/A并列所属门与红例 | 不得把不适用解释成跳过全仓既有verify；只是不新增本批专属红例 |

CP-06逐项记录适用命令、退出码、输出marker和耗时；默认verify运行段只在全批6b匹配后执行。

## 9b · 变更定位

- apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateRepository.java: OPEN_SESSION、READ_LATEST_SESSION。
- apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsBindingRevocationListener.java: parsePayload、listenAndReconcile、poll。
- apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java: register、revoked、trackedBindings。
- apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketHandler.java: receivePing。
- apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/persistence/TerminalBindingOwnerPersistence.java: notifyRevoked。
- Proposed production files:
  - apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/history/TdsConnectionHistoryWriter.java
  - apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/history/TdsDorisStreamLoadClient.java
  - apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/history/TdsConnectionHistoryEvent.java
- Tests: apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/history/TdsConnectionHistoryWriterTest.java; TdsDorisStreamLoadClientTest.java.
- DDL: scripts/dev/doris/connection-history.sql.
- Acceptance: apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java; StoreTerminalAcceptanceScenarios.java; BackendAcceptanceTest.java; TdsAcceptanceProcess.java.
- Managed scripts: scripts/dev/r5-dev-runner.mjs; scripts/dev/r5-reset.mjs; scripts/test/r5-remote-testcontainers.mjs; scripts/test/backend-acceptance.

## 10 · 数据迁移

| 迁移 | 加/改 | 回填 | 唯一恢复事实 | 回滚 |
|---|---|---|---|---|
| PostgreSQL/Flyway | N/A，复用latest_state.session_sequence | N/A | N/A | N/A |
| Doris operational DDL | database/table；DUPLICATE KEY(event_id)，replication_num=1 | 无旧行 | 从实施日起产生连接事件 | 受管清表或删除run-owned容器；不碰DEV image cache |

CP-02确认Duplicate Key保留每条事件；event_id为显式事件标识，但Duplicate Key不作为唯一约束。无时间保留策略，不自动过期；DEV reset才清表。生产保留期不在本批权限内。DDL列固定为event_id VARCHAR(36)、event_time_epoch_millis BIGINT、event_type VARCHAR(24)、workspace_uuid VARCHAR(36)、terminal_ref VARCHAR(36)、node_id VARCHAR(128)、session_id VARCHAR(128)、session_sequence BIGINT、rtt_ms DOUBLE NULL、close_reason VARCHAR(48) NULL；DUPLICATE KEY(event_id)，HASH(event_id) BUCKETS 1，replication_num=1。TDS以Instant.toEpochMilli()记录事件时刻，Doris同样保存epoch毫秒，避免写入和读回过程中发生时区转换。

## 10b · seed数据

- seed文件全集：N/A。Doris连接历史非业务seed事实，不改业务seed plan、owner command seed executor或seed角色。
- DEV schema由managed runner初始化，不属于r5-full；acceptance使用独立fixture。
- 旧seed变非法：N/A，无业务schema、route、permission或fixture identity变化。
- reset/seed实际执行仍需独立明确授权；本稿不授权执行。

## 11 · 验收场景设计

acceptance复用真实PG、两个业务上下文及批次二三节点/双HAProxy拓扑，批次三增加一个TDS进程与每run一个远端Doris GenericContainer。TDS事实输出CONTRACT；真实业务HTTP输出CONTRACT/BUSINESS/DB_OPERATIONS；cleanup独立报告。

| scenario ID | owner file | identity | fixture | request | businessOracle |
|---|---|---|---|---|---|
| terminal.connection.vs13.cross-node-recovery · 子断言：online-takeover | TerminalConnectionContractScenarios.java | aggregate selector下的terminalRef、node A/B、PG session sequence | 真实HTTP激活；WS先连A再连B | 两次合法首帧认证 | 聚合结果行含`onlineTakeoverOldSessionId`、`onlineTakeoverCurrentSessionId`与`nodeACloseReason`；断言A收到SESSION_REPLACED，B仍是PG latest并可PONG。时钟偏差由实现不变量证明：顺序只取PG `session_sequence`，不读节点时钟；本场景不修改系统时钟，也不将其结果声称为时钟偏移样本 |
| terminal.connection.vs13.cross-node-recovery · 子断言：commit-before-local-registration | 同上 | aggregate selector下的terminalRef、A/B PG session sequence与两条真实WS | A的PG open已提交后、actor登记前由屏障暂停；B提交并等待A监听器把PG最新sequence应用到terminal actor水位后释放A | B完成真实WS登记；随后继续A登记 | 同一聚合结果行含`registrationRaceCandidateSequence`、`registrationRaceWinnerSequence`与`registrationRaceCandidateCloseReason`；断言A不发SESSION_READY、不进入active且关闭，B仍为PG latest。该确定性交错覆盖旧稿“cross-node-session-race”意图；不另存在“两节点在PG open前同步释放”的场景 |
| terminal.connection.cross-node-revocation | StoreTerminalAcceptanceScenarios.java + TerminalConnectionContractScenarios.java | 被取消终端及control terminal | 会话A在node A | 真实HTTP取消/作废 | A跨节点ACTIVATION_CANCELLED；control PONG；PG audit actor/reason正确 |
| terminal.connection.latest-state-stale-write | TerminalConnectionContractScenarios.java | old A/new B session identities | A迟到heartbeats/disconnect由既有barrier扣住，B先取代；另以受管入口强制终止A后让客户端改连B | 释放迟到写入并读回 | latest仍为B seq/session；旧写更新0行；节点未写断开时新会话仍取代旧状态 |
| terminal.connection.history-records | TerminalConnectionContractScenarios.java | 一节点、一会话、run label | Doris healthy，真实WS连接、PING与关闭 | 每个有效PING均带已测RTT | Doris有CONNECTED、每条有效PING的HEARTBEAT_RTT、DISCONNECTED和准确原因；schema无secret字段 |
| terminal.connection.history-outage-bounded | TerminalConnectionContractScenarios.java | 一会话及control会话 | Doris接请求但挂起响应；测试队列限额调小 | 真实WS连接/PING和真实HTTP激活/取消，各20次测耗时 | 每种主流程最大响应<1秒；writer 10秒超时、至多3次；队列不越界、超量drop可观察；PG业务历史完整 |
| terminal.connection.listener-reconcile-new-session | TerminalConnectionContractScenarios.java | node A旧session、node B当前session及control | DB侧终止A listener并用既有recovery gate保持断线 | A离线时B登记更新会话，随后放开gate | A 30秒内重建并以SESSION_REPLACED关闭同一旧session；B/control存活 |
| store-terminal.history-remains-in-postgres | StoreTerminalAcceptanceScenarios.java | 激活/再激活/取消/作废owner fixture | 真实HTTP owner流程，Doris挂起 | 激活与取消照常执行 | PG audit历史含发起方/原因/时间；响应不受影响；Doris无binding/audit事件 |
| terminal.connection.history-secret-scan | BackendAcceptanceTest.java | 本run已知secret fixture | 执行跨节点与history场景后扫描 | scan TDS日志、reports、Doris rows | credential原值/摘要、激活码、deviceId与auth token无泄漏 |
| terminal.dev.connection-history | 现有terminal-client-dev-acceptance.mjs | 一个DEV terminal client | 现有V-E1动作流 | 激活、连接、心跳、取消、重激活、主动取消 | Doris readback有连接、RTT、断开事件；不增加UI范围 |
| terminal.dev.reset-history | scripts/dev/r5-reset.mjs | reset前marker event | resident DEV Doris有history | managed reset/readback | reset前count>0、之后为0；schema/container/mount/image保留，cleanup合规 |

### 11a · 验收判据对照

| 判据 | 场景/测试ID | 执行档位 | 文件 |
|---|---|---|---|
| R-2.3/V-B1 Doris不含credential、激活码、raw deviceId | terminal.connection.history-secret-scan | backend-acceptance | BackendAcceptanceTest.java |
| R-4.4/V-S4 跨节点顺序取代、PG提交后本地登记前取代、时钟独立性 | `terminal.connection.vs13.cross-node-recovery`（一个真实动态测试；分别断言`online-takeover`、`commit-before-local-registration`子路径，子路径结果字段见§11场景表）。时钟独立性由源码不变量加该动态场景的PG sequence读回证明，不伪称注入了节点时钟偏差 | backend-acceptance TDS CONTRACT + source invariant | `TerminalConnectionContractScenarios.java`; `TdsConnectionStateRepository.java`; `TdsTerminalSessionActors.java` |
| R-6.3/V-S6 跨节点迟到心跳/断开不覆盖最新值；节点强制终止后新连接成为最新会话 | terminal.connection.latest-state-stale-write | backend-acceptance TDS CONTRACT + PostgreSQL latest-state readback | TerminalConnectionContractScenarios.java |
| R-6.5/V-B9 binding history留PG且actor/reason事实正确 | store-terminal.history-remains-in-postgres | backend-acceptance BUSINESS | StoreTerminalAcceptanceScenarios.java |
| R-6.5/V-S7 connection/disconnect/每次RTT读回 | terminal.connection.history-records | backend-acceptance TDS CONTRACT + Doris SQL readback | TerminalConnectionContractScenarios.java |
| R-6.6/V-B9 Doris挂起不影响激活/取消或PG历史、不写binding history | store-terminal.history-remains-in-postgres | backend-acceptance BUSINESS + Doris SQL | StoreTerminalAcceptanceScenarios.java |
| R-6.6/V-S7 queue bound、10秒timeout、20次最大响应<1秒、drop可见 | terminal.connection.history-outage-bounded | backend-acceptance TDS CONTRACT | TerminalConnectionContractScenarios.java |
| R-2.3/V-S11 凭证原值、激活码、deviceId不进入日志、报告或Doris | terminal.connection.history-secret-scan | backend-acceptance log/report/Doris scan | BackendAcceptanceTest.java |
| R-6.7/V-E1 per-run Doris start/health/cleanup | terminal.connection.history-records | managed backend-acceptance | BackendAcceptanceTest.java; r5-remote-testcontainers.mjs |
| R-6.7/V-E3 reset前有记录、后归零、DEV容器/schema/image保留 | terminal.dev.reset-history | managed DEV/reset | r5-reset.mjs |
| R-7.2/V-S5 业务取消在另一节点关闭ACTIVATION_CANCELLED | terminal.connection.cross-node-revocation | real HTTP + TDS CONTRACT | StoreTerminalAcceptanceScenarios.java; TerminalConnectionContractScenarios.java |
| R-7.3/V-S13 listener重建30秒内核验最新会话 | terminal.connection.listener-reconcile-new-session | backend-acceptance TDS CONTRACT | TerminalConnectionContractScenarios.java |
| R-12/V-G1 Doris/TDS新增门red fixture | §9a.1有限映射 | `--validate-only`静态段及默认verify静态段；TDS focused test在默认verify运行段 | 表内逐项列明入口、模式、marker或N/A反例 |
| R-13 remote same-host DEV Doris、无tunnel | terminal.dev.connection-history; terminal.dev.reset-history | managed DEV | r5-dev-runner.mjs; r5-reset.mjs |
| R-14 临时容器start/healthy/SQL/stop/cleanup；DEV resident、持久卷重启与同机资源样本 | 历史Testcontainers运行 + resident probe | managed remote Testcontainers + `r5-doris-resident-feasibility` | `2026-10-02` feasibility report；resident run ID见报告；后续Stream Load/权限/峰值仍在CP-02验证 |

R-14证据必须区分历史Testcontainers事实、本次resident feasibility probe与未来业务实施验证。此次在完整DEV服务共存时记录8 CPU、总内存约29.95 GiB、启动Doris前可用内存约20,172 MiB、Doris健康后约18,530 MiB、磁盘可用约6,242 MiB；Docker显示Doris约1.60 GiB，未设置Doris cgroup内存上限。该单次样本证明镜像与持久挂载能和当前DEV服务共存，不作为峰值/长期SLO或固定内存上限。CP-01在无配置漂移时复用，若资源基线或镜像/runner字节变更再测；CP-02验证实际Stream Load、权限及业务写入/readback。Acceptance TDS scenario不加入业务operation identity或BUSINESS断言组。

## 12 · 未决项处置

| 项目 | 当前状态 | 本批允许 | 本批禁止 |
|---|---|---|---|
| R-14远端临时容器可行性 | 本次受管运行PASS：健康32.215秒、SQL 119毫秒、cleanup PASS；单实例RSS约1.45 GiB，未限memory | 证据见feasibility记录及run XML | 不将一次性探针等同resident或全栈容量 |
| DEV是否容纳Doris+PG+MinIO+HAProxy+3 TDS及resident生命周期 | LIMITED_PASS：同一run中服务容器共存；可用内存从约20,172 MiB降至18,530 MiB，Doris约1.60 GiB；持久目录stop/start后marker读回PASS；未设memory cap且只取瞬时样本 | CP-01只刷新host/boot/镜像/资源身份；出现漂移才重做resident probe。CP-02实测写入负载与配置上限 | 不把单样本升级成长时峰值保证；未测Stream Load与写入持续负载 |
| Doris 4.1.3表级LOAD与BE 8040直连 | OPEN：历史只做SELECT 1 | CP-02精确版本proof | 拿4.1.4行为替代、扩大到全局权限 |
| V-S1“只配置数据库连接” | 按R-6.7解释为PG与必选Doris endpoint；对象存储等无关配置不要求 | 按此解释配置并验收 | 静默让Doris可选；若Dexter明确指仅PG则需需求裁定 |
| 历史保留期限 | 未定义；本批不自动过期，DEV reset清表 | 资源观察写入容量证据 | 擅加TTL/统计API |
| 官方Doris image id/repo digest | LIMITED_PASS：resident probe实测4.1.3缓存命中及image/repo digest见R-14报告 | host或镜像发生漂移时刷新；不为同一字节重复拉取 | 不把当前digest套用到其他host/版本 |
| remote PostgreSQL server_version | VERIFIED_FOR_THIS_HOST：受管只读预检读取为16.13，PG容器identity与R-14 resident基线一致；依据PostgreSQL 16官方LISTEN/NOTIFY文档 | CP-03验证LISTEN提交→新事务状态检查→通知的初始化顺序与恢复路径 | 不凭镜像tag或本地classpath推断服务器版本；不把只读版本预检写成业务监听验收PASS |
| 跨节点history event time | TDS UTC wall clock仅用于历史显示；跨节点先后只由PG序号决定 | event保留node/session/sequence | 用时钟决定会话谁更新 |

交Dexter裁决：同机资源不足；最小权限验证需要超出表级权限；或产品方将V-S1解释为PG-only。其他OPEN先由CP取得证据。

## 13 · 停机条件

若远端硬约束阻止官方镜像运行、同机预算不足、Doris 4.1.3最小权限无法实现或需求必须依赖未批消息系统/轮询/云服务/业务路径同步写Doris，停止并把原文、证据、候选与推荐交Dexter。不得切换云服务、本机Docker、镜像代理或Doris tunnel。

CP阶段独立三维对账按每个完整CP执行；全部CP MATCHED后在整体动态运行前另做全批6b。整批13c逐代码检查由fresh reviewer完成，只返回MATCHED/OPEN。OPEN未闭不得交实施review。

### 13c · 逐代码与详设对账

实施计划必须含显式逐代码步骤。fresh只读reviewer逐生产文件、符号、DDL、runner产物映射到本稿§3/§7/§8/§9/§9a/§10/§11a；确认每个生产符号有调用者、每个产物有producer、无零调用者command/selector。结论仅MATCHED/OPEN，OPEN不闭不得交付。

## 14 · 交付前自查

| 检查 | 判据 |
|---|---|
| §3固定行集 | 全部保留，N/A有原因 |
| 第三方依据 | 当前解析版本、官方来源、实际行为、focused proof均列出；PG 16.13由受管只读预检实测，业务通知顺序与失败边界仍待CP-03验证 |
| §3a | N/A有原因，无空分母 |
| CP门 | 六阶段都有失败条件、不变量、FORBID、验证与RECALL |
| §5/§6 | 无新增HTTP operation、无业务owner跨写 |
| §7 | PG序号/通知/actor、Doris writer、reset链路具名 |
| §9a | source、runtime、测试、runner、DDL、seed全链同步表 |
| §10b | 业务seed N/A有原因 |
| §11a | 本批每条需求判据到可执行测试/场景 |
| 证据档位 | R-14历史临时容器、当前resident probe与后续业务实施验证分别标注；未验证项不得写PASS |
| 授权 | 只设计与R-14；不宣称实现、DEV或reset通过 |

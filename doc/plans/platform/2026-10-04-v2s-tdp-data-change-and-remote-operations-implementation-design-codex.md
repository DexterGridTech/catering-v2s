# TDP 数据变化通知与远程运维 · implementation-facing 详设

```text
DOC_KIND=IMPLEMENTATION_DESIGN
DATE=2026-10-04
AUTHOR=Codex
REVIEW_CYCLE_ID=TDP_DATA_CHANGE_REMOTE_OPERATIONS_DESIGN_2026-10-04
REVIEW_TARGET=DESIGN
REVIEW_ROUND_LIMIT=2
BUSINESS_SOURCE=doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md
JOURNEY_REFS=N/A_WITH_REASON：本批无页面 Journey
IA_REF=N/A_WITH_REASON：本批无前台/管理页面
INTERACTION_REF=N/A_WITH_REASON：本批无 UI
AUTHORIZED=按 Dexter 2026-10-04 转交：TDP 设计最小修订、CP-01～06整批实现、必要生成/编译/测试/verify、受管 backend-acceptance/DEV，TER仅Expo Web动态验证
NOT_AUTHORIZED=Android/VM/真机、独立浏览器L2、reset/seed、UAT、生产部署及新增业务范围
IMPLEMENTATION_AUTHORITY=true
DESIGN_EVIDENCE=静态设计证据与后续分层实施/运行证据分开记录；尚未运行项保持NOT_RUN
```

## 0 · 元数据与授权边界

本详设将正式需求 R-01～R-20 转为实施方案；Dexter 已明确授权本专项整批实施、必要生成/编译/测试/verify、受管 backend-acceptance/DEV，以及 TER 的 Expo Web 动态验证。Android/VM/真机、独立浏览器 L2、reset/seed、UAT、生产部署及新增业务范围不在授权内。需求中指定的 `R-14` 为业务条款编号；对外部回包未知、时间相等漏失、在线-only 运维、TDS 不拥有业务正文等限制保持原样。TER Web-only 验证裁决只适用于本专项验证，不改变功能语义或全仓 TR-16。

当前关键依赖状态：CBS owner 写事实/时间/范围缓存；TDS 已有 PG 会话权威与有界 WebSocket outbound；TDC 已有激活、transport、Runtime command dispatch、slice persistence 和 topology sync。尚没有 TDP topic/remote-operation 协议。本文不把这些静态能力写成新链已实现。

## 1 · 真实业务目标与方案比较

### 1.1 结构性问题

若批次只加一条 WebSocket 通知而没有 owner 时间、scope 闭包和 TDC/feature 接收路径，终端不能判断自己应读什么，也不能证明列表成员增退、详情差异、主副投影或远程执行结果。反过来若 TDS 复制业务正文/范围缓存，CBS owner 更新与 TDS 副本会分叉；若运维请求只在 socket 发出、不在两端保存事实，断链后会把“结果未知”误作失败或成功。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A：TDS 自己扫描业务表、保存缓存与正文，并由 TDS 推送业务 API | 越过 CBS owner，形成第二业务读模型，TDS 每节点事实容易分叉 | 拒绝 |
| B：CBS owner 持久化原始时间与范围摘要；提交后经既有 PG wake-up 通知；TDS 只按当前会话订阅投递；feature 经 TDC command 刷新自己的 HTTP 数据 | owner 单一，通知不承载大集合，失败边界可观察；离线可靠性仍严格受需求所限 | **采用。TDS 使用有界、只读、按当前 binding scope 的 task query 读取 owner cache；不引入内部 HTTP/client 或副本** |
| C：加通用 outbox、MQ、持久消息队列、全局版本或周期扫描 | 可提高离线补偿能力但正式需求明确排除，增加 deployable/维护面 | 拒绝 |

我选了 B 而不是 A/C，因为它复用 CBS owner 事实和现有 PG 唤醒、TDS 会话与 TDC Runtime command，把业务正文留在唯一 owner。三种集合 topic 读取 owner snapshot；八种精确 topic 只经窄 owner query 读取实体原始时间。两种查询均受当前binding的workspace/group/store范围约束；不增加CBS内部HTTP、不复制业务正文。

**在线远程执行的数据库通路（Dexter 2026-10-04 明确裁决）**：CBS 与 TDS 不直接通信，唯一跨进程投递介质为 PostgreSQL。CBS `terminal-control` 在自己的事务中持久化在线操作意图和权威目标 TDS 节点/session，在同一事务中执行只含 operation identity 的 PostgreSQL `NOTIFY`；只有事务成功提交后，TDS 的 PG listener 才收到它并把它当唤醒信号。TDS 随后调用 `terminal-control` owner 暴露的窄 SQL command：按 operation identity、目标节点、session 与 binding generation 原子认领并读出意图；只在本次认领成功后才经既有 TDS↔TDC WebSocket 投递。TDS数据库角色对terminal-control记录只获owner具名SQL command的`EXECUTE`权限，不获该owner表的`SELECT/INSERT/UPDATE/DELETE`；对CP-03明确的topic snapshot表仅获只读`SELECT`。TDS 执行后调用同一 owner 的具名 SQL command 原子写入实际执行结果；SQL commit 成功后才经 WebSocket 确认 TDC 已持久收录。CBS 不接收 callback 或结果通知；CBS 的调用方按需主动查询既有 `terminalControlRead`，读取 owner 已提交状态/结果。没有终端连接时 CBS 持久化 typed offline refusal，不留稍后执行的操作。NOTIFY 只唤醒，不是事实、不承载参数或结果；不增加轮询、通用队列、MQ、outbox 或 HTTP/OpenAPI client。

远程操作记录是 `terminal-control` 的具名业务事实，不是通用 outbox/离线队列。状态从已提交待投递、已认领到实际结果均由 owner SQL command 原子推进；重复 `NOTIFY`、重复认领或 TDS 重启不得再次执行已认领 operation。认领后 TDS 故障且无实际结果时，CBS 主动查询显示结果未知并禁止自动重派；NOTIFY 丢失时该记录保持可查询的未完成状态，也不因查询触发重发。“已提交/已通知”不代表已执行。读取只返回持久化当前事实，不作期限扫描或隐式状态迁移。
TDC在持久化slice中用一个普通JSON对象map（`Record<string, RemoteOperationFact>`）保存尚未释放的远程操作事实。每个键对应一个operation，只保留执行、确认与补报所需的身份和当前事实；阶段推进更新同一项，终态结果ACK持久化成功后删除该项。map最多64项，仅限制项数、不设缓存字节容量上限。普通断线重连且server-config与binding身份不变时保留map；server-config更新或root reset按各owner默认清空规则删除旧map，不增加第二`resetIntent: retain`。CBS已提交历史仍永久保留；被清除的未ACK终端事实不使用新配置重发，CBS仍显示最后已提交状态（可仍为UNKNOWN）。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-01 | canonical wire/OpenAPI 与生成闭环 | contracts、edge generator、TDC generated | 11种 topic type、subscribe/notify/accept、remote request/result typed wire；终端读取 HTTP 生成客户端；既有503 code激活及422/503 Problem response | §4已定义身份与读取边界 |
| CP-02 | CBS 原始时间、REGION 关系、范围 cache 与事务触发 | organization、store-contract | 11 topic 时间来源、三集合 cache、同事务维护/提交后唤醒、owner read API | CP-01 schema；现有写入入口盘点 |
| CP-03 | 订阅/通知（RECALL: R-01～03/R-06/R-08） | TDS；`TdsBindingRevocationListener`、`TdsConnectionStateRepository`、`TdsWebSocketConnection` | 当前session授权、认证所需只读事实、TDS自有session表、三集合snapshot与八精确raw-time读取；listener重建、scope隔离、bounded queue；只验证本CP已创建权限 | CP-01契约；CP-02 snapshot与两项raw-time SQL入口；terminal-control SQL函数不属于CP-03前置 |
| CP-04 | TDC 订阅协议/selector 与失败投影 | terminal-data-client | command 注册意图、ready后发送、时间确认、重复/过期拒绝、只在 MASTER 广播 | CP-01、CP-03 |
| CP-05 | 单一 store-basic feature | TER store-basic | 11 topics、HTTP、持久化、集合详情差量订退、恢复/主副读取 | CP-01、CP-04、现有 Runtime/state/topology |
| CP-06 | 在线远程执行与结果回传（RECALL: R-13～17） | CBS `terminal-control`、TDS、TDC与Runtime本地/peer dispatch | 在线具名command、claim once、实际result透传、ACK阶段更新/终态删除、清理后迟到结果丢弃；同一remote operation身份覆盖本地与peer结果 | CP-01～05；terminal-control SQL函数在本CP创建并授权；Runtime/Topology现有command-request/result与dispatch身份 |

CP-02 与 CP-06 内任何跨 owner write 由调用方事务先后调用 owner public command；依赖方向只向被调 owner，不反向 import。CP-01～06 是唯一实施 CP。每个完整 CP 的三维对账在其实现与 focused proof 完成后、下一 CP 前；全部 CP MATCHED 后另做批次级 6b。全量验收、cleanup、13c 与整批 IMPLEMENTATION review 均在 6b 之后进行，不属于 CP 退出条件。

## 3 · 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 可观察验证与档位 | ③ 无现成形态约束 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `doc/platform/backend-coding-standard.md` §2；terminal authentication 及 CBS task read owner | 跨 workspace/store 的 terminal read HTTP 返回拒绝；backend-acceptance | 仅新增显式 task read projection，验证当前 binding 范围；不从 ref 推导权限 | Store、Project、Region、CommercialGroup、Contract list/detail、Area list/detail、ServicePoint list/detail、StoreOperatingRule |
| 写授权与 grant 复核 | 对应 CBS owner command 与 `terminal-control` public capability API | command 由非 terminal-control 调用者触发仍遵守模块访问边界；focused/architecture | 不增角色/后台入口；仅已有内部业务模块调用 | 本批 helloWorld 与 terminal-control send/ack/report |
| 跨 owner 写与事务 | `doc/platform/backend-coding-standard.md`；owner public command；Spring REQUIRED | 中途 owner 失败时所有业务事实/范围 cache 回滚；backend-acceptance | module command 加入调用方事务；不直写对方 schema | organization→topic cache、store-contract→topic cache、terminal-control→TDS dispatch intent |
| 集合形态与分页 | 正式需求 R-05/R-06；owner read SQL 有序结果 | 构造超过分页上限集合，验证完整 refId 和稳定 hash；focused + backend-acceptance | scope contract 是有限条件集合；业务 HTTP返回完整一致快照，不能客户端拼页冒充同快照 | 合同、区域、服务点三个集合；终端只保存真实 owner 数据 |
| 缓存失效/改完刷新 | CBS owner timestamps；现有 terminal feature actor command | 一次真实写入读回对应实体时间/hash及在线通知；backend-acceptance/DEV | cache 只存完整 topic identity/hash/time，不存 refIds/body/memberCount | 上述三个集合；11个精确/集合 topic 的维护 |
| RTK 读取/加载判定 | N/A_WITH_REASON：本批不涉及 RTK 前端 | N/A_WITH_REASON | N/A_WITH_REASON | 无 |
| 同一事实一个住址 | `foundation-charter.md` §1-K；业务 owner + feature slice | 对照 HTTP 正文、owner state 与TDC时间不得互相冒充；focused | TDC 只持 accepted topic time/remote execution records，不镜像业务实体正文 | CBS原事实、CBS collection cache、TDC订阅时间、store-basic数据、terminal-control记录 |
| 失败可见且原因不得改写 | backend/frontend coding standards；`AGENTS.md` 结构化日志 | 断开/HTTP/DB/storage故障沿 typed failure 可区分；focused + acceptance | 错误由失败 owner 记录并返回，外层不得吞成“无变化” | CBS事务/cache、TDS subscription/send、TDC parse/storage、feature HTTP/apply、remote execution/report |
| owner错误到HTTP映射 | edge OpenAPI catalog 与错误目录；生成链禁止手改 paths | 每个新增 operation 对应唯一 face、error set 与生成 contract；静态 generator check | terminal 面只登记真实读取/运维接口；不增加 operations-admin API | CBS terminal read operations、terminal-control invoke/read/report |
| 审计三件套 | N/A_WITH_REASON：需求为内部纯能力，不要求后台审计功能；若已有审计边界被调用仍保留其原路径 | 不为本批增加 audit entity/history API | 不新建跨 owner audit API | N/A；remote operation record 是运行事实不是业务审计替代物 |
| 幂等与重放 | `terminal-control` 现有 operation request identity；TDC runtime request ledger只作当前运行观察 | 重复 request 在需求保留关联范围内不再次派发；late result 不覆盖旧未知；focused | 仅有限关联，不声称永久 exactly-once；不同身份/绑定不得复用 | online send request、terminal execution record、CBS report ingestion |
| generated wire | `terminal-client-api.mjs` 只生成 HTTP OpenAPI client；`terminal-connection-protocol.json` 是TDP WS canonical | `scripts/generate/terminal-connection-protocol.mjs --check` 对Java records/字段闭集与TS message union；缺消息/字段闭集漂移/根外或符号链接输入均非零 | 新生成器只读本仓protocol JSON，输出TDS Java message records/field-name closure与TDC `terminalConnectionProtocol.ts` message types；TDS现有`TerminalConnectionProtocol`/`TerminalConnectionFrameCodec`及TDC parser/actor负责运行时值校验并消费生成闭集，不另生成第二套validator/codec。不得手改生成物 | subscribe、unsubscribe、notification、accept、remote command、progress/result/report |
| 日志与脱敏 | `AGENTS.md` observability；现有 TDS structured logging | failure 可用 run/request/session/topic id关联，不含秘密、完整业务 payload；focused/static | 只记不可逆标识摘要、类型、长度、阶段、结果，禁止 credential/token/raw payload | CBS、TDS、TDC、store-basic、terminal-control及其 runner |
| 迁移/回填 | Flyway 单一 history；organization owner迁移先例 | migration后 PG readback完整引用一致；真实PG acceptance | 新 REGION.parent_id 必填，旧数据以同空间商业集团 UUID补齐；不得猜测或回写原更新时间 | organization schema、terminal read projections、fixtures/seed，执行授权另行满足 |
| 前端共享行为 | N/A_WITH_REASON：无 UI-bearing 范围 | N/A_WITH_REASON | N/A_WITH_REASON | 无 |
| 管理后台交互 | N/A_WITH_REASON：无新增管理后台页面 | N/A_WITH_REASON | 不加运维页面/权限 | 无 |
| 候选/下拉数据源 | N/A_WITH_REASON：无选择 UI | N/A_WITH_REASON | N/A_WITH_REASON | 无 |
| 编码与名称呈现 | `terminal-connection-protocol.json` 已有 64KiB wire bound；TER string validation标准 | boundary sized UTF-8 payload accepted/rejected as specified；focused | wire identity不以显示名替代 UUID/key | service-space/store/group refs 与 operator-defined command payload |
| 会同时坏的原子组 | `foundation-charter.md` §5-C | canonical→materialize→generation→TDC/TDS and CBS owner→cache→NOTIFY→TDS full chain | 每个 CP 的 source、生成物、测试和 fixture 同批同步 | §9a所列变更事实全集 |

### 第三方库行为核验

本详设不把未核实的第三方行为写成 PASS。当前构建定义静态约束 TDS 的 Spring Boot 为 4.1.0、Reactor BOM 2025.0.7、Reactor Netty HTTP 1.3.7、Reactor Core 3.8.7、Netty 4.2.18.Final（`apps/backend/catering-business-server/build.gradle.kts` 的 `verifyTdsRuntimeClasspath`）；TDC 声明 Undici 8.11.2（package manifest 与 yarn.lock）。这些是仓内声明/构建断言，不是本专项依赖解析报告。仅在某CP正确性依赖第三方API、默认值、时序、资源上限或协议行为时，才按 `doc/platform/third-party-library-usage-standard.md` 在该CP核验实际运行/测试 classpath及精确tag/API：CP-02核验PostgreSQL JDBC与`pg_advisory_xact_lock`/LISTEN-NOTIFY；CP-03核验Reactor Netty WebSocket/backpressure及PostgreSQL JDBC通知读取；CP-04核验AsyncStorage/platform adapter；CP-05核验Undici dispatcher/response bounds；CP-06核验实际用到的HTTP/数据库/序列化行为。TDS PostgreSQL runtime driver当前由Boot管理、版本尚未解析确认，须在CP-03首次依赖该行为前查实。CP-01只使用Node内建`fs/os/path/url/child_process/crypto`及Ruby标准库YAML解析，不依赖第三方库行为；因此该CP的第三方核验为`N/A_WITH_REASON`，并非将后续CP的版本证据提前或豁免。本轮设计不运行依赖报告或动态实验。

## 3a · L2 脚本开发前 UI/testId 前置复核

`NOT_APPLICABLE_WITH_REASON`：本批没有 UI-bearing screen、testId、新增 L2 action 或浏览器 L2 授权。未来功能验收有 Expo Web 和受管 DEV；该安排不创建 Browser L2 场景，也不制造空分母 admission。

## 4 · 每个 CP 的门控与 RECALL

| CP | 当前能力与本项RECALL | 红条件/不变量/FORBID | 验证观察 | 若缺现成代码的形态 | 方案理由 |
| --- | --- | --- | --- | --- | --- |
| CP-01 | RECALL: formal R-03/R-13；当前 protocol JSON；`terminal-client-api.mjs`（HTTP only）；edge catalog/materializer | canonical消息漏生成；terminal GET误设NONE/后台session；产物手改；输入根外/符号链接逃逸 | 新 protocol generator `--check` 对Java/TS输出；每个terminal HTTP operation在OpenAPI、catalog、materialize security、edge-codegen、TDC generated闭合；mutate缺字段/错auth/root escape逐个红 | 新生成器用`scripts/generate`现有Node CLI/self-test形态，单一JSON输入，生成Java records+TS union，`--write/--check`；输入经`resolveInsideRoot`；所有新终端HTTP读操作`TERMINAL_CREDENTIAL`，激活仍NONE | 当前wire JSON没有TDP消息，故明确新增生成器，不冒称已有HTTP生成器支持WS |
| CP-02 | RECALL: R-04～06/R-11.1、organization/store-contract真实mutation路径与Flyway单history | 同owner写漏topic；cache与事实半提交；并发旧hash覆盖新hash；跨店scope污染；首次空集漂移 | PG读回实体与cache；rollback均旧；多门店隔离；hash四种transition；首次空cache基线0；REGION迁移保留原updated_at/version且不发历史通知；barrier证明首次缺行时两个并发成员写不丢失 | owner表分别为`organization.terminal_topic_snapshot`与`contract.terminal_topic_snapshot`，列为完整scope/topic identity、collection_hash、topic_time_epoch_millis。同一完整owner scope的mutation在查询集合前取得transaction-scoped `pg_advisory_xact_lock`；无snapshot行时也先互斥，多个scope按稳定键排序加锁。另由organization与store-contract owner各建一个`read_terminal_topic_time(...)`窄函数，供8类精确topic返回实体原始时间或typed missing/denied。hash为lowercase SHA-256(规范UUID按字典序排序、以LF连接的UTF-8字节)，空值固定SHA-256(empty bytes)；首次无row空集时间0；row existence区分“未计算”与“已计算为空” | 0仅为cache初始化比较基线，不写回业务更新时间；锁只串行化同一owner/scope，不引入通用锁框架；实际PostgreSQL版本/API官方依据在CP-02核验 |
| CP-03 | RECALL: R-01～03/R-06/R-08；TDS session repository 与认证 owner | 缺少认证所需只读事实、session自有状态权限或精确topic入口；把CP-06尚未创建函数的EXECUTE提前作退出条件 | 验证两节点session/认证、snapshot与8类raw-time读取；跨scope拒绝；未授权owner DML失败；只验证本CP已建立权限 | 独立TDS角色列级SELECT auth facts、USAGE自有sequence、SELECT/INSERT/UPDATE自有latest_state、snapshot SELECT、CP-02 raw-time函数EXECUTE；CP-06函数延后 | 依§5.1a权限矩阵；精确topic只走owner窄SQL函数，不回落CBS账号、不授schema-wide权限 |
| CP-04 | RECALL: R-07～10；TDC command/actor/selectors，Runtime broadcast `allowNoActor` | duplicate subscribe丢时间；ready广播到SLAVE；退订一feature取消他人订阅；accept old identity | fake WS deterministic protocol, selector's accepted time; focused | owner map by full topic+subscriber; dispatch feature command via Runtime registered command，非事件总线 | 保持 TDC 唯一业务协议入口 |
| CP-05 | RECALL: R-07～12；state persistence/topology owner；HTTP generated client | app restart skips initial load；range partial data当全集；detail变化全量重拉；SLAVE自己HTTP | selector和 fake/真实HTTP业务断言；Expo Web可行行为先行；真实DEV未运行 | 单 `kernel/feature/store-basic` slices/commands/actors，遵守现有 feature module registration与command actor ownership | 一个feature避免双包跨序依赖 |
| CP-06 | RECALL: R-13～17；Runtime `dispatchCommand(name,payload)`、execution selectors、TDC persistent state | 离线command入队；未知结果伪成功；重复NOTIFY造成副作用重复；TDC的remoteOperations map达到64项后仍接纳；ACK阶段误关闭运行中的operation；删除未ACK；迟到本地/peer结果关联丢失 | helloWorld读回无副作用；重复NOTIFY/operation claim只执行一次；丢失通知与claim后故障均保持UNKNOWN且不重派；late local/peer result经真实handoff携带实际结果且不重派；reset/config清理后的迟到结果不复活map项；CBS确认历史永久可查；TDC仅在各phase ACK本地持久化后释放相应正文 | `terminal-control`具名能力；TDC的`remoteOperations` map最多保留64项，达到数量上限时拒绝新操作并保留已有项；只限制项数，不设缓存字节容量上限；WebSocket单消息仍遵守既有65,536 UTF-8 bytes协议边界。CBS对已提交远程操作历史永久保留，不做删除、归档或时间清理，也不设应用层条数上限；参数与结果按远程操作契约校验。首次意图INSERT失败同步typed拒绝且不dispatch；已有结果UPDATE失败不ACK，CBS只显示最后已提交状态；读库失败返回typed unavailable，不声称在同一不可用DB持久化新失败。数据库中介采用terminal-control owner的窄DB command API；TDS无owner表直写权限 | 同一map项保留operation、binding、wire request、Runtime local request身份及当前阶段事实。每次阶段ACK先持久化并更新该项；started ACK只更新状态，操作未终结时保留该项；终态结果ACK持久成功后删除该项。ACK写入失败则保留原项和待确认事实，重复ACK是no-op，不复活已删除项。结果/阶段/ACK只更新仍存在且完整身份匹配的map项，清理后迟到结果丢弃且释放observer，不得重建旧项。server-config变更或root reset按已裁决边界清除本地map；普通同配置断线重连保留。 |

#### CP-01 验证门闭包（新增8个 terminal GET 的完整分母）

terminal GET 新增身份全集：`terminalReadStoreBasic`、`terminalReadStoreOrganizationPath`、`terminalReadStoreActiveContracts`、`terminalReadContract`、`terminalReadStoreServicePointAreas`、`terminalReadServicePointArea`、`terminalReadStoreServicePoints`、`terminalReadServicePoint`。这8项均须同时进入 canonical OpenAPI、R5 catalog、auth requirements、materializer allowlist、edge generated face projections 与 `contracts/policy/terminal-client-generation.json`；face均为`terminal`，security均为`TERMINAL_CREDENTIAL`，不得手写生成物或只改 policy 计数。

本批新增terminal read在生成绑定时使用`TERMINAL_CREDENTIAL_READ_CONTEXT`，不是普通`READ_CONTEXT`。edge在凭证核验成功后，仅把workspace UUID、groupWorkspaceKey、已验证storeRef、terminalRef及binding generation组成该上下文，不传secret；并先核对请求路径中的groupWorkspaceKey/storeRef与已验证身份一致。单项详情的`contractRef`、`areaRef`、`pointRef`经各自生成query record传给owner；门店级读取从已验证context取storeRef，不把未核验路径值交给owner。该上下文区别于凭证command上下文，只表示edge已核验的读取身份，不授权写入。

这8个新增READ也进入 `operation-handler-bindings` 的显式route映射和当前 operation count source：本次源闭合后 `operations=304, reads=132, commands=172`，commands各face分布不变。映射使用既有 owner namespace `organization` 或 `store-contract → store.contract`，wire request 为`NoBody`、response为对应canonical生成wire类型；由 `node scripts/generate/operation-handler-bindings.mjs --write/--check` 更新与核验，不在绑定文件里手改生成条目。

| 输入/变化 | 首个读取者/入口 | 执行模式 | 红夹具与首个失败标记 |
| --- | --- | --- | --- |
| `contracts/protocol/terminal-connection-protocol.json` 的TDP消息闭集 | 新 `scripts/generate/terminal-connection-protocol.mjs --check`；接入`tools/verify-gates/verify.mjs`静态段 | 直接`--check/--self-test`；`scripts/verify --validate-only`；默认` scripts/verify`静态段 | 缺消息/字段闭集与过期Java/TS生成物；生成器独立错误标记，且对应verify gate必须失败 |
| 8个HTTP canonical operation及响应schema | `scripts/generate/r5-edge-materialize.mjs --check`先消费OpenAPI source/catalog/auth policy | `scripts/check/r5-edge-materialize --check`；`scripts/verify --validate-only` 的`r5-edge-materialize`；默认verify | 单项改`NONE`或漏credential requirements→`R5_EDGE_TERMINAL_ANONYMOUS_AUTH_DRIFT` / `R5_EDGE_TERMINAL_CREDENTIAL_AUTH_DRIFT` |
| edge catalog、security requirements 与生成响应/错误闭包 | `scripts/generate/edge-codegen.mjs --check`，由`tools/verify-gates/cli.mjs openapi`经`scripts/check/openapi-contracts`调用 | `scripts/check/openapi-contracts`；`scripts/verify --validate-only` 的`openapi-contracts`；默认verify | 删/错一条credential security→`R5_EDGE_CODEGEN_TERMINAL_CREDENTIAL_AUTH_DRIFT`；generated contract变更但未再生成→`R4_OPENAPI_GENERATED_DRIFT` |
| terminal authorization mode 与 resolver/manifests | `tools/capability-invariants/cli.mjs check` | 直接`check/--self-test`；`scripts/verify --validate-only` 的`capability-invariants`；默认verify | 单项 authorization mode/resolver 不匹配→`CAPABILITY_TERMINAL_CREDENTIAL_CONTRACT_DRIFT:<operationId>`；每个新operation均有单项反例 |
| route registry、generated wire type 与 operation handler binding | `scripts/generate/operation-handler-bindings.mjs --check`；8个新GET的`NoBody`/canonical response schema须进入wire闭集与READ binding | 直接`--self-test/--check`；`scripts/verify --validate-only` 的operation-handler-bindings；默认verify | route source digest陈旧、缺wire映射、owner namespace未知或304/132/172计数不一致时必须非零；self-test覆盖route digest与binding闭集 |
| `terminal-client-generation.json` 的8项目标分配与TDC generated客户端 | `scripts/generate/terminal-client-api.mjs --check`，由`openapi-contracts` gate调用 | 直接`--check/--self-test`；`scripts/verify --validate-only` 的`openapi-contracts`；默认verify | policy漏选/双重分配/非credential auth/生成物过期→`TERMINAL_CLIENT_OPERATION_FACE_CLOSURE` / `TERMINAL_CLIENT_OPERATION_SECURITY_DRIFT` / `TERMINAL_CLIENT_OPERATION_CATALOG_DRIFT` |
| edge generated terminal face registry、每个face投影和TDC generated operation IDs | `tools/verify-gates/cli.mjs frontend` | `scripts/check/frontend-architecture --self-test`；`scripts/verify --validate-only` 的`frontend-architecture`；默认verify | 从terminal registry移除1条已生成操作但不改其余投影→`R5_TERMINAL_GENERATED_FACE_DRIFT`；self-test必须打印`R5_TERMINAL_GENERATED_FACE_RED=PASS`。counts必须由operation数组派生，禁止写死旧terminal数量 |

机器门自身存在不等于新增接口已闭环：每行都须核对8个operation逐项进入所有适用输入，红夹具在所述模式中实际触发该行第一读取者；对遮蔽门须用直接入口证明。默认`verify`的静态段不得在CP-05标定前声称全绿。实际环境键是`V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY`；`DEFERRED_UNTIL_CP05`只是状态标签，不是CLI模式。CP-01直接证明预算无关门；预算相关红例标记延后。CP-05只运行其本阶段focused proof，不运行全目录标定。所有CP完成并且全批6b MATCHED后，才按`backend-acceptance --operation all --calibration`和已存在的batch cardinality 1/20/100运行全目录标定，更新投影后补跑预算红例、普通`--validate-only`与默认verify；该命令运行完整业务场景目录，不能作为CP-05 focused proof或6b之前的基线。

## 5 · Operation / path / face / collection

| 业务意图 | operation / 候选ID | method/path | face | 集合返回形态 |
| --- | --- | --- | --- | --- |
| 终端读取门店基础/经营规则 | `terminalReadStoreBasic` | `GET /api/terminal/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/basic` | terminal；`TERMINAL_CREDENTIAL` | 一对象；响应携带Store与StoreOperatingRules各自的原始时间 |
| 读取 PROJECT/REGION/CommercialGroup | `terminalReadStoreOrganizationPath` | `GET /api/terminal/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/organization-path` | terminal；`TERMINAL_CREDENTIAL` | 当前门店完整父链；三个独立topic时间 |
| 读取有效合同集合/详情 | `terminalReadStoreActiveContracts` / `terminalReadContract` | `GET /api/terminal/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/contracts`; `GET /api/terminal/group-workspaces/{groupWorkspaceKey}/contracts/{contractRef}` | terminal；`TERMINAL_CREDENTIAL` | 有效合同完整同快照结果；单详情按ID；集合不分页、不截断 |
| 读取区域集合/详情 | `terminalReadStoreServicePointAreas` / `terminalReadServicePointArea` | `GET /api/terminal/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-point-areas`; `GET /api/terminal/group-workspaces/{groupWorkspaceKey}/service-point-areas/{areaRef}` | terminal；`TERMINAL_CREDENTIAL` | 全门店`status=ENABLED`完整目录及详情 |
| 读取服务点集合/详情 | `terminalReadStoreServicePoints` / `terminalReadServicePoint` | `GET /api/terminal/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/service-points`; `GET /api/terminal/group-workspaces/{groupWorkspaceKey}/service-points/{pointRef}` | terminal；`TERMINAL_CREDENTIAL` | 全门店`status=ENABLED`完整目录及详情 |
| CBS内部发起在线 terminal-control command | terminalControlInvoke | internal module API；无HTTP endpoint | N/A internal | 单目标一operation；在线session才准入 |
| 查询/接收远程执行状态与补报 | terminalControlRead / terminalControlClaim / terminalControlAcceptReport（设计名） | CBS内部invoke/read API；TDS经PostgreSQL调用owner具名SQL claim/result commands；无管理页面 | N/A internal | CBS历史不自动删除、不设人为条数上限；已提交记录始终可查询，数据库无法持久化时显式失败 |

表中各路径均写出完整前缀 `/api/terminal/group-workspaces/{groupWorkspaceKey}`。上述每个 HTTP operation 在 edge catalog 的 face 固定为`terminal`、authorizationMode/security 固定为`TERMINAL_CREDENTIAL`，并在授权 requirements 加 `x-required-terminal-credential`。`activateTerminal` 保持`NONE`。CP-01 同步更新 `r5-edge-materialize.mjs` 的 terminal credential operation allowlist、edge-codegen catalog/operation 对账、`contracts/policy/terminal-client-generation.json`、TDC generated client 与 operation bindings。edge凭证核验通过后生成不含secret的`TerminalCredentialReadContext`；请求路径的groupWorkspaceKey/storeRef必须先与核验身份相等，单项详情ref使用具名typed query wire，不能让`NoBody`丢失owner任务所需参数。materializer self-test对一个terminal GET分别证明NONE、workspace session、credential requirement缺失三类错误拒绝；operation-binding self-test对8个GET逐一证明错误context拒绝，并对三个详情GET逐一证明错误wire request拒绝。HTTP DTO、operationId、errorSetRef与response schema由上述operation行为正本，协议WS消息另走本详设指定的新生成器。

### 5.1 · 八个 terminal GET 的实施前逐 operation 设计事实

下表记录实现前的逻辑契约以及首次真实 focused backend-acceptance 的当前实测基线。共同前置顺序为：edge 校验路径/UUID 与请求形状；按既有 `TERMINAL_CREDENTIAL` resolver 解析凭证并调用 terminal-binding 当前绑定核验；拒绝后不调用业务 owner；成功后以核验返回的 workspace/group/store identity 调用该行唯一 owner task read；只序列化该任务 DTO。所有读取是只读、无写事务。具名正常 fixture 为同一有效绑定且目标记录/集合完整的 `tdp.http.normal.<operationId>`。最初的“每项2条SELECT”是实施前估算，真实路径证明并非统一两条：下面列出run `r5-tc-1791135081532-44283` 逐请求 `sqlOperationCount`（均为SELECT、mutation=0）；`databaseOperationCount`另含1次连接与2次事务边界，因此分别为SQL数+3。该实测值用于本批验收解释，不削弱认证、scope或owner读取；后续若owner路径改变，按新run重新记录，不把单次基线冒充通用常数。

| Operation | 有序 owner 路径及成功投影 | 条件 → typed problem | 正常 fixture 的预期 DB 读写 |
| --- | --- | --- | --- |
| `terminalReadStoreBasic` | credential/current binding → organization按已绑定store读取Store与OperatingRules同一任务投影；各自原始时间 | `TERMINAL_DATA_READ`：输入缺失/格式错误→`PLATFORM_COMMON_VALIDATION_FAILED`/422；credential invalid/cancelled→`TERMINAL_BINDING_CREDENTIAL_INVALID`/403；workspace disabled→`PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED`/403；terminal disabled→`STORE_TERMINAL_DISABLED`/409；scope mismatch→`PLATFORM_COMMON_ACCESS_DENIED`/403；store absent→`PLATFORM_COMMON_RESOURCE_NOT_FOUND`/404；DB unavailable→`PLATFORM_DEPENDENCY_UNAVAILABLE`/503 | `tdp.http.normal.terminalReadStoreBasic`：实测6 SELECT / 0 mutation |
| `terminalReadStoreOrganizationPath` | credential/current binding → organization一条显式task join读取bound store的PROJECT/REGION/CommercialGroup父链及三个各自原始时间 | `TERMINAL_DATA_READ`闭集：PLATFORM_COMMON_VALIDATION_FAILED/422、TERMINAL_BINDING_CREDENTIAL_INVALID/403、PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED/403、STORE_TERMINAL_DISABLED/409、PLATFORM_COMMON_ACCESS_DENIED/403、PLATFORM_DEPENDENCY_UNAVAILABLE/503；父链缺失/跨workspace→PLATFORM_COMMON_ACCESS_DENIED/403；不得返回部分父链 | `tdp.http.normal.terminalReadStoreOrganizationPath`：实测7 SELECT / 0 mutation |
| `terminalReadStoreActiveContracts` | credential/current binding → store-contract一条一致快照task query读取当前有效合同完整集合及原始时间 | `TERMINAL_DATA_READ`闭集：PLATFORM_COMMON_VALIDATION_FAILED/422、TERMINAL_BINDING_CREDENTIAL_INVALID/403、PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED/403、STORE_TERMINAL_DISABLED/409、PLATFORM_COMMON_ACCESS_DENIED/403、PLATFORM_DEPENDENCY_UNAVAILABLE/503；空集合为200空集合，不返回PLATFORM_COMMON_RESOURCE_NOT_FOUND | `tdp.http.normal.terminalReadStoreActiveContracts`：实测2 SELECT / 0 mutation |
| `terminalReadContract` | credential/current binding → store-contract按bound store与contractRef读取精确详情/原始时间 | `TERMINAL_DATA_READ`闭集：PLATFORM_COMMON_VALIDATION_FAILED/422、TERMINAL_BINDING_CREDENTIAL_INVALID/403、PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED/403、STORE_TERMINAL_DISABLED/409、PLATFORM_COMMON_ACCESS_DENIED/403、PLATFORM_COMMON_RESOURCE_NOT_FOUND/404、PLATFORM_DEPENDENCY_UNAVAILABLE/503；不存在或不属于bound store→PLATFORM_COMMON_RESOURCE_NOT_FOUND/404 | `tdp.http.normal.terminalReadContract`：实测2 SELECT / 0 mutation |
| `terminalReadStoreServicePointAreas` | credential/current binding → organization一条一致快照task query读取bound store全部ENABLED areas | `TERMINAL_DATA_READ`闭集：PLATFORM_COMMON_VALIDATION_FAILED/422、TERMINAL_BINDING_CREDENTIAL_INVALID/403、PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED/403、STORE_TERMINAL_DISABLED/409、PLATFORM_COMMON_ACCESS_DENIED/403、PLATFORM_DEPENDENCY_UNAVAILABLE/503；空集合为200空集合，不返回PLATFORM_COMMON_RESOURCE_NOT_FOUND | `tdp.http.normal.terminalReadStoreServicePointAreas`：实测4 SELECT / 0 mutation |
| `terminalReadServicePointArea` | credential/current binding → organization按bound store与areaRef读详情/原始时间 | `TERMINAL_DATA_READ`闭集：PLATFORM_COMMON_VALIDATION_FAILED/422、TERMINAL_BINDING_CREDENTIAL_INVALID/403、PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED/403、STORE_TERMINAL_DISABLED/409、PLATFORM_COMMON_ACCESS_DENIED/403、PLATFORM_COMMON_RESOURCE_NOT_FOUND/404、PLATFORM_DEPENDENCY_UNAVAILABLE/503；不存在或不属bound store→PLATFORM_COMMON_RESOURCE_NOT_FOUND/404 | `tdp.http.normal.terminalReadServicePointArea`：实测4 SELECT / 0 mutation |
| `terminalReadStoreServicePoints` | credential/current binding → organization一条一致快照task query读取bound store全部ENABLED points | `TERMINAL_DATA_READ`闭集：PLATFORM_COMMON_VALIDATION_FAILED/422、TERMINAL_BINDING_CREDENTIAL_INVALID/403、PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED/403、STORE_TERMINAL_DISABLED/409、PLATFORM_COMMON_ACCESS_DENIED/403、PLATFORM_DEPENDENCY_UNAVAILABLE/503；空集合为200空集合，不返回PLATFORM_COMMON_RESOURCE_NOT_FOUND | `tdp.http.normal.terminalReadStoreServicePoints`：实测8 SELECT / 0 mutation |
| `terminalReadServicePoint` | credential/current binding → organization按bound store与pointRef读详情/原始时间 | `TERMINAL_DATA_READ`闭集：PLATFORM_COMMON_VALIDATION_FAILED/422、TERMINAL_BINDING_CREDENTIAL_INVALID/403、PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED/403、STORE_TERMINAL_DISABLED/409、PLATFORM_COMMON_ACCESS_DENIED/403、PLATFORM_COMMON_RESOURCE_NOT_FOUND/404、PLATFORM_DEPENDENCY_UNAVAILABLE/503；不存在或不属bound store→PLATFORM_COMMON_RESOURCE_NOT_FOUND/404 | `tdp.http.normal.terminalReadServicePoint`：实测5 SELECT / 0 mutation |

八个GET的共同请求输入与错误闭集：TDC从凭证唯一owner读取`Authorization: Terminal <generation>.<secret>`、`X-Terminal-Ref`、`X-Terminal-Device-Id`，通过generated client发请求；各operation路径提供`groupWorkspaceKey`及业务ref。edge由既有`TerminalCredentialParser`解析Authorization，再将generation/digest与路径/请求身份组成`TerminalCredentialVerificationApi.Credential`执行当前绑定核验。secret只在Authorization传输且不得记录日志；terminalRef/deviceId只用于credential核验，不替代授权。校验成功后edge将`Verification`映射成`TerminalCredentialReadContext`，先核对路径groupWorkspaceKey/storeRef与已验证身份，再调用owner。单项详情请求由generated `TerminalContractReadQuery(contractRef)`、`TerminalServicePointAreaReadQuery(areaRef)`或`TerminalServicePointReadQuery(pointRef)`承载对应路径ref；其余四个门店级读取用已验证context中的storeRef，不再传`NoBody`掩盖所需scope。全部operation的`errorSetRef=TERMINAL_DATA_READ`，闭集为：`PLATFORM_COMMON_VALIDATION_FAILED` 422（缺失/格式错误输入）、`TERMINAL_BINDING_CREDENTIAL_INVALID` 403（无效/已取消凭证）、`PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED` 403、`STORE_TERMINAL_DISABLED` 409、`PLATFORM_COMMON_ACCESS_DENIED` 403、`PLATFORM_COMMON_RESOURCE_NOT_FOUND` 404（仅单项详情不存在或越权隐藏）、`PLATFORM_DEPENDENCY_UNAVAILABLE` 503。集合为空仍为200空集合。上表逐operation列出该闭集及其局部差异，不得以“同上”替代。

### 5.1a · TDS 数据库账号权限矩阵与CP时序

TDS 使用独立数据库账号；不以CBS账号回落。授权按实际SQL闭合，禁止通配owner schema权限：

| 对象 | TDS权限 | 用途 / 创建阶段 |
| --- | --- | --- |
| database | `CONNECT` | CP-03创建principal时授予本数据库连接；不授予其他数据库 |
| `platform_workspace`、`store_terminal`、`organization`、`terminal_binding`、`terminal_connection`、`contract` schema | `USAGE` | CP-03仅为实际读取/调用对象开放schema解析；不授予`CREATE`。`terminal_control` schema 的`USAGE`仅在CP-06对象创建后授予 |
| `platform_workspace.group_workspace`、`store_terminal.terminal`、`organization.store`、`terminal_binding.latest_binding` | 仅授予认证、当前binding复核SQL实际读取列的`SELECT`；无`INSERT/UPDATE/DELETE` | CP-03读取workspace/store/终端状态与当前凭证generation；精确列由实施SQL逐列列出，不用`SELECT *` |
| `terminal_connection.session_sequence` | `USAGE` | CP-03由`TdsConnectionStateRepository`生成session sequence；无其他序列权限 |
| `terminal_connection.latest_state` | `SELECT/INSERT/UPDATE` | CP-03由TDS维护自己的session、heartbeat与disconnect状态；不授予DELETE |
| `organization.terminal_topic_snapshot`、`contract.terminal_topic_snapshot` | `SELECT` | CP-02创建后由CP-03读取三类集合topic snapshot；不授予写权限 |
| `organization.read_terminal_topic_time(...)`、`contract.read_terminal_topic_time(...)` | `EXECUTE` | CP-02由各owner迁移角色创建。两个函数均为`SECURITY DEFINER`、固定安全`search_path`、owner限定对象名、撤销PUBLIC执行；只返回对应实体原始时间或typed missing/denied。CP-03在对象已建立后验证 |
| `terminal_control.claim_online_operation(...)`、`terminal_control.accept_terminal_report(...)` | `EXECUTE`，不授予相关owner表直接权限 | CP-06由terminal-control owner迁移角色创建并按同样的`SECURITY DEFINER`/固定安全`search_path`/撤销PUBLIC执行规则授权；只在CP-06验证 |

认证事实列及两个raw-time函数的完整签名在CP-02/03按owning SQL登记。topic映射固定为：`organization.read_terminal_topic_time(...)`服务`STORE`、`PROJECT`、`REGION`、`COMMERCIAL_GROUP`、`STORE_OPERATING_RULE`、`SERVICE_POINT_AREA`、`SERVICE_POINT`七类；`contract.read_terminal_topic_time(...)`服务单项`CONTRACT`。函数只对闭集kind执行对应owner task query。受管DEV与backend-acceptance分别创建相同边界的独立角色并单独注入TDS。CP-03正向验证已创建的认证事实列、TDS自有session状态、snapshot与八种raw-time入口；负向验证已存在owner对象上的未授权DML失败。principal bootstrap 若尚无`terminal_control` schema及对象，须明确记为对象尚未建立并跳过该组授权/权限探测；schema一旦存在则要求表与两个函数完整，否则以`TDS_TERMINAL_CONTROL_OBJECT_SET_INCOMPLETE`失败，不能把缺对象写成权限拒绝。CP-06建表/函数并授予schema USAGE、具名函数EXECUTE后，再正向验证函数调用、负向验证直接表SELECT/INSERT/UPDATE/DELETE及未授权函数调用失败；失败必须能区分对象缺失与permission denied。不得把允许的认证列/snapshot SELECT误判为越权，也不得通过共享CBS账号或schema-wide授权补救遗漏。

### 5.2 · 三种完整集合响应与订阅资源边界

完整响应指CBS owner在一个一致数据库快照内返回的全量有效合同、全量ENABLED区域或全量ENABLED服务点；不分页、不截断、不让TDC把部分响应当全集。正式需求没有为合同/区域/服务点规定每店条数上限，本详设不新增`maxItems`、响应字节上限或每session业务身份上限；数据规模由现有业务入口与owner数据事实控制。65,536 UTF-8 bytes只约束既有WebSocket单消息（full/decompressed），不套到业务HTTP完整集合。

每条当前有效详情topic identity对应一项订阅；active subscription set仅保存当前注册身份，退订、binding失效或connection disposal时删除其条目。dirty set只能引用active subscription set中的identity，按identity合并重复变化，不另积累历史队列；现有容量1 outbound sink维持串行写，无法立即发送时沿既有typed失败路径，不截断当前数据或制造部分集合。CP-03验证合法响应包含12个以上身份时完整接纳，逐条取消订阅/断开后对应条目释放，重复dirty只保留一个键；不要求推导最大合法C/A/P，也不增加业务数量限制。
## 6 · 跨 owner 写矩阵

| 起始事实 | 首个owner动作 | 后续owner动作 | 事务/失败 |
| --- | --- | --- | --- |
| organization实体写 | org public command在真实mutation分支写实体并更新本owner topic cache | commit后wake TDS | 同事务；cache失败回滚实体 |
| contract写 | store-contract public command写实体并更新合同列表cache | commit后wake TDS | 同事务；receipt replay/no-op不发变化 |
| 区域/点写 | organization public service-point command写事实、对应详情cache与受影响目录cache | commit后wake TDS | 同事务；仅真实变动登记，MOVE只覆盖需求列明业务入口 |
| online remote invoke | 调用模块调用 terminal-control public command，在CBS事务内持久化send request与目标节点/session | 提交后PG NOTIFY唤醒目标TDS；TDS从owner command API读意图、原子claim，再走已连接WS | 无当前在线session则记录typed未送达、不排队；丢失唤醒不扫描补发；重复通知不得二次claim/dispatch |
| terminal report | TDS调用terminal-control owner的窄DB command API写入实际执行事实 | CBS不接收回调；其read API主动查询owner记录。DB commit成功后TDS经WS确认TDC | TDS无owner表直写权；报告写失败不ACK，重复/乱序事实幂等且不得回退完成状态 |

## 7 · 声明—传递—消费矩阵

| 事实 | 声明 | 传递 | 消费 | Proof |
| --- | --- | --- | --- | --- |
| 11 topic identity/scope | protocol canonical + finite topic catalog | generator→TDC; CBS cache uses full identity | TDC subscribe、CBS owner查询 | V-01/02 |
| 原始topic时间 | entity owner原始`updated_at_epoch_millis` | notification topic identity+time；no receive time | feature selector accepted time独立持有 | V-03/08/09 |
| collectionHash | owner SQL有序ref list编码后hash | CBS cache only，不经wire传hash | CBS对比旧摘要决定唤醒 | V-04/06 |
| entity body | CBS业务 owner | terminal HTTP canonical→generated client→TDC transport | store-basic单一业务slice | V-07/13/14 |
| subscribe/accept | TDC typed command / message | WS only after SESSION_READY | TDS active connection actor | V-02/03/09 |
| online operation intent | terminal-control owner | CBS transaction→PostgreSQL durable row + NOTIFY identity→TDS owner DB query/claim→WS→TDC→Runtime named command | exact actor/registered package | V-16/17/18 |
| execution fact | TDC remote-only persistent state + terminal-control server fact | TDC→TDS→terminal-control DB command; CBS read API主动查owner记录；数据库commit后TDS确认TDC | terminal-control read | V-19/20/21/22 |
| master/slave | topology peer sync declarations | MASTER persisted state sync | SLAVE selectors only | V-15, DEV-DATA-15 |
| failure/logging | owning layer typed result | correlated event ids sans payload/secrets | run log and businessOracle | V-17/21/23 |

## 8 · 业务规则 → owner 判定点

需求判据全集：R-01～R-20（20条）；R-11含store-basic与service point明细，R-19含V-01～V-24及DEV-DATA-01～16。编号未拆为新业务规则。

| 需求规则 | owner判定点 |
| --- | --- |
| R-01～03 | contracts生成身份；CBS/TDS按当前credential+binding/session校验topic；TDC持协议，不让client ref授予权限 |
| R-04 | each business entity owner的真实更新时间；TDS只发在线变化；TDC/feature按时间不等触发刷新 |
| R-05～06 | CBS owner计算/持久范围摘要并同事务提交；TDS仅唤醒，不保存范围成员 |
| R-07～08 | store-basic初始化链与同topic accepted time；TDC的accept不可写回business updatedAt |
| R-09 | store-basic根据完整scope新成员列表差量管理详情订退；HTTP/apply/订退任一失败分别保留失败事实 |
| R-10 | topology MASTER连接/订阅/HTTP，SLAVE仅读state sync projection |
| R-11～12 | 单一store-basic拥有11类数据和其ref chain；organization/store-contract各守own事实 |
| R-13～14 | terminal-control只允许在线投递具名Runtime command；超时/断线未知且不可盲重发 |
| R-15 | TDC仅持远程过程/结果持久事实，重连只补报，不重新dispatch |
| R-16 | 所有queue、message、payload和record有界，失败/丢弃可见；11种topic是type闭集，不等于订阅实例数；完整owner集合及其identity数量由业务数据决定，不另设TDP业务上限；dirty identity只在当前active订阅中按键合并 |
| R-17 | helloWorld只更新自己的request记录，验证端到端链不产生副作用 |
| R-18 | 每个候选CBS owner对时间来源/缺口出具静态全集，不以自然过期或audit time造变化 |
| R-19 | §11a逐项真实验收与未运行状态，backend business/CONTRACT/cleanup分列 |
| R-20 | 详设给出可执行owner形态与异常判据；数据库通路/旧binding/历史保留按Dexter已裁决内容实施，实际依赖解析与存储规模证据须在对应CP关闭前完成 |

## 9 · Owner API 与消费者清单

| owner API | 唯一消费者 |
| --- | --- |
| CBS organization/store-contract existing typed + legacy command funnels | 同 owner cache hook；不得从 controller 重复发布 |
| CBS terminal-control `invokeOnline` / `readOperation` / `claimOnlineOperation` / `acceptTerminalReport`（设计名） | CBS内部具名业务module调用`invokeOnline/readOperation`；TDS经PostgreSQL调用terminal-control owner的具名DB command API，不直接写owner表 |
| TDS connection-scoped subscribe/accept/remote-dispatch service（设计名） | TDC protocol adapter；CBS PG wake listener |
| TDC `subscribeTopic` / `unsubscribeTopic` / `acceptTopicTime` / `sendRemoteReport` commands（设计名） | store-basic and TDC own actors |
| store-basic `initializeAfterActivation` / `refreshTopic` / range-reconcile commands（设计名） | terminal activation success, TDC typed topic broadcast |
| Runtime named command dispatch | TDC remote command actor; only exact registered Runtime command names |
| Runtime exact-request late-outcome handoff（设计能力） | TDC remote command actor在dispatch前按local requestId订阅一次性结果；本地actor真实结果由Runtime actor dispatcher交subscriber，不写入diagnostic journal。peer结果经Topology command-request/command-result回传；普通5秒call timeout先产生UNKNOWN，但不释放已显式登记的结果订阅。两端以同一requestId/commandId关联，expiry取Runtime实际`requestMaxResidenceMs`（默认7,200,000ms）；TTL随登记请求传给peer，并由接收Runtime以本地同项上限裁剪。仅容纳现存请求，复用`maxCommandsPerRequest`与request max residence约束；终态、expiry、config clear、root reset或Runtime disposal释放观察资源。TDC以同一remote operation/binding/wire/local request身份持久化结果后释放observer与结果槽。 |

任一新增owner API进入详设及代码前，再全仓确认至少一个具名consumer；不能留下空方法作为“未来能力”。selector只读该owner持有的 state；credential由TDC唯一保存，server-config凭证代理字段与TDP无关。

Runtime late-outcome handoff的peer通路沿现有单次dispatch关联闭合：Topology `command-request`和`command-result`均保留同一`requestId`/`commandId`；结果投影只含实际`ActorExecutionRecord`字段（actorKey/status/start/completion/result/typed error），不传actor context、journal、业务state或原始payload。普通`Topology callTimeoutMs=5,000`及Runtime command timeout仍立即让调用方得到UNKNOWN/timeout；只有预先登记late handoff的请求保留实际结果观察。handoff期限取发送Runtime有效`requestMaxResidenceMs`，默认`7,200,000ms`，请求携带剩余毫秒；接收Runtime以本地同项上限裁剪，拒绝非正数或超出上限的期限。发送侧peer关联在期限结束、实际终态被消费、config clear、root reset、Runtime disposal或连接生命周期结束时释放；接收侧listener在终态/expiry/disposal释放。任一会话断连导致实际结果无法送达时继续保持UNKNOWN，不重派。每个peer关联受现有`peerCommandMaxInflight`限制。发送投影经真实`serializeTopologyWireMessage`进行完整64KiB UTF-8检查，接收端由`parseTopologyWireMessage`检查完整envelope、12层深度、数组上限4,096及字段闭集；不截断、不丢字段后伪报成功。无法编码或完整消息超界时不传部分结果，回传`TOPOLOGY_CODEC_FAILED`并让TDP事实保持UNKNOWN；接收消息若与`ActorExecutionRecord`闭集不符则按`status=error`、空结果接收，不构造成功结果。未登记handoff的其它command维持当前cancel语义；不新增peer结果持久账本。

TDC结果更新的门槛是当前slice仍存在同一个`remoteOperationId`，且binding identity、server-config identity、wire requestId与local requestId均匹配。config更新或root reset开始时，先按现有remoteOperations map中的identity释放相应handoff observer，再清除map；使用reset callback提供的`previousState`取得旧项，不另建追踪表。任何旧response在清理后到达均被忽略并释放观察资源，不可重新插入map；普通同配置断线重连不清理该map。阶段ACK和终态ACK遵循相同的“原项存在且身份相同”规则。

## 9a · 实施前全链同步变更清单

| 事实 | 契约/生成源 | CBS owner/edge/migration | TER state/surface | 测试/runner | fixture/seed | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| topic/remote WS messages | `contracts/protocol/terminal-connection-protocol.json`→`scripts/generate/terminal-connection-protocol.mjs`→TDC/TDS generated wire | TDS parser/dispatch, no business SQL | TDC actor/types/selectors | protocol contract focused | current WS fixture | 同步+生成；HTTP generator不生产WS wire |
| terminal business HTTP | OpenAPI terminal canonical→r5 edge materialize→terminal-client-api | organization/store-contract read facades | TDC generated client; store-basic | contract + owner acceptance | backend fixtures | 同步+生成 |
| 11 topic时间/cache | protocol topic catalog | org + store-contract schema/cache/hooks | TDC accepted times; feature data stores | SQL/hash focused + acceptance | 11 valid owner records | 同步 |
| REGION.parentId补齐 | canonical schema/OpenAPI DTO/source | Flyway, create/update funnels, read model, seed/fixtures | generated read fields + store-basic | migration/readback focused | existing data fixture complete | 同步 |
| feature init/订退 | topic canonical | read paths above | one `store-basic` module/slice/actor | focused + Expo Web + DEV | fixture identity | 同步 |
| remote invocation/results | protocol + terminal-control operation definitions | terminal-control owner记录/读与DB command API；PG NOTIFY只唤醒 | TDC persistent remote-only slice | focused + backend-acceptance/DEV | helloWorld no-effect | 同步 |
| remote operation count/retention | contract message bounds | CBS已提交远程操作历史永久保留；单条远程消息按协议字节边界校验 | TDC持久化slice中的单一`remoteOperations` map最多64项；只限制map项数，不设缓存字节容量上限；终态结果ACK持久成功后删除map项 | red count-bound tests | 65th-retained-operation fixture | ACK写入失败时保留原map项；成功后按阶段更新或删除map项；topic type闭集不构成业务身份数量上限，active identity随订退与连接生命周期管理 |

## 9b · 变更定位

定位使用能力锚点而不是当前行号。前置搜索须列出完整 owner command/reload/legacy overload 清单。当前canonical route/source清单尚需 CP-01 现字节重跑；不得使用本文历史需求中的行号定位修改。

## 10 · 数据迁移

预计新增 Flyway migration：organization REGION 的真实 CommercialGroup parent ref 非空关系约束与现有行补齐；`organization.terminal_topic_snapshot`、`contract.terminal_topic_snapshot` owner cache表；两个owner各自的窄raw-time函数；terminal-control远程 operation record 表。顺序：查存量所有 REGION → 依同 workspace/store→PROJECT→REGION 关系与当前commercial group resolve候选 → 逐行校验唯一归属 → 更新真实 parent ref；有歧义/无候选 migration fail closed，不自动猜。迁移只写 parent ref 与非空约束，不改历史 `updated_at_epoch_millis`、version，不发历史变化通知。只初始化三种范围集合topic的cache（有效合同、服务区域、服务点）；空集合按需求基线初始化，非空集合使用R-05的B。八种精确topic不创建snapshot，不做实体时间镜像，由owner窄SQL函数读取原始时间。operation record migration不搬运历史runtime ledger。

所有migration只有implementation授权后执行，符合单一 Flyway history 和 DEV additive migration；本次未执行迁移、seed或DB写入。

## 10b · Seed 数据

### 10b.1 受影响 seed 全集

当前输入全集与同步责任：`scripts/dev/profiles/r5-full.json`选择seed profile；`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`拥有稳定组织、门店、项目、大区、商业集团、合同、服务区域和服务点实体；`scripts/dev/r5-seed-plan.mjs`读取profile、该契约、`contracts/catalog/store-terminal-rules.json`与`contracts/policy/catalog-inventory-fixture-catalog.json`生成计划；`scripts/dev/r5-complete-seed-executor.mjs`编排seed stages；`scripts/dev/owner-command-seed-executor.mjs`通过owner command创建组织/门店/服务点/合同；`scripts/dev/store-terminal-seed-executor.mjs`只负责终端绑定，不拥有topic实体。当前无TDP专属acceptance fixture；新增业务fixture分别归对应CBS `*AcceptanceScenarios.java`或TER focused test。CP-02/06开工前逐项复核当前来源漂移并列出新增fixture唯一来源与同步owner；本详设不授权执行seed。

### 10b.2 两类改动

- 新增可验的测试/DEV事实：本批范围的合法 store/project/region/group、有效/INVALID合同、ENABLED/DISABLED area/service point、在线terminal以及helloWorld操作。
- 调整既有事实：REGION.parentId补齐与任何已有fixture/seed里对应REGION必须同批一致。

### 10b.3 覆盖判据

fixture必须有多店/多合同/多area、多point，形成外店隔离、订退差量、完整快照与容量边界反例。不得在seed本地手填terminal state替代业务HTTP链。

### 10b.4 同步项

Migration → current `r5-full` owner insert/readback → backend acceptance fixture → DEV controlled setup清单。seed definitions只更新一个权威来源，所有下游派生。

### 10b.5 边界

不得把 operation persistence测试结果seed成业务状态；不得使用Doris存储业务或远程操作历史；不得自动seed DEV。

### 10b.6 执行前提/角色

本次仅设计。未来真实reset/seed前需要当前有效授权、当前字节完整dry-run PASS、适用CP/6b/准入和owned namespace预检；种子仅由受管 `scripts/dev/seed --profile r5-full` 入口执行。DEV start不隐式seed。

## 11 · 验收场景设计

所有以下执行均是未来计划，`NOT_RUN`。未关闭§12的路径不得实施或用假成功通过。

| Scenario ID | owning test/runner domain | identity/fixture | 真实业务 oracle | execution |
| --- | --- | --- | --- | --- |
| `tdp.topic.identity.scope` | protocol/TDS focused | same UUID in two stores/groups | only currently authorized identity receives; other store HTTP/topic denied | focused + backend acceptance |
| `tdp.topic.time.equal-online` | CBS/TDS contract | same raw millis, two real updates | online subscribed TDC receives second notification | backend acceptance + Expo Web |
| `tdp.topic.time.reconnect` | CBS/TDS/TER | cached accepted time differs incl backward | reconnect compares inequality, refreshed owner body+time persists | focused + backend acceptance + Expo Web |
| `tdp.collection.hash.transitions` | CBS owner test | empty/equal order/added/removed/member update; ACTIVE合同自然过期但状态仍ACTIVE | cache hash/time follows R-05 matrix, natural expiry does not remove ACTIVE, INVALID does; no refIds/memberCount stored | focused + PostgreSQL |
| `tdp.collection.concurrent.rollback` | owner acceptance | same scope competing membership writes + injected rollback | final rows/hash match committed snapshot; failed tx leaves prior cache | backend acceptance |
| `tdp.collection.concurrent.first-row` | owner acceptance | two transactions barrier before locking the same scope whose cache row is absent; each adds a different valid member | second transaction queries after first commit; final membership/hash/time contain both committed members; unrelated scope proceeds independently | focused + backend acceptance |
| `tdp.cache.restart.readback` | owner acceptance | existing empty-scope cache row with nonzero A, CBS/TDS restart; separately remove row in isolated fixture | existing row preserves hash=empty and original A; absent row is distinct initial-no-cache state and uses R-07 baseline; no recomputation overwrites stored A | focused + backend acceptance |
| `tdp.listener.rebuild.current-cache` | owner/TDS acceptance | commit a scope update, rebuild PG listener, inject failed owner transaction | failed transaction emits no NOTIFY; after rebuild TDS rereads current owner cache and only targets currently valid session | focused + backend acceptance |
| `tdp.collection.scope.isolation` | owner acceptance | A/B store same valid contract candidates | changing A never changes B hash/time/notifications | backend acceptance |
| `tdp.http.complete.snapshot` | owner acceptance | result above page size | response full list and times from one database snapshot | backend acceptance |
| `tdp.topic.exact.raw-time` | CBS owner/TDS contract | all eight exact topic types; missing entity and unauthorized scope | reads return only the exact owner raw timestamp; no snapshot mirror/body read; exact subscription does not depend on collection snapshot row; missing/unauthorized is typed | focused + backend acceptance |
| `tdp.store-basic.init.order` | store-basic actor tests | activation, HTTP delay/fail, service data | service HTTP count=0 until this binding's store HTTP applied+persisted; later same-package command begins | focused + Expo Web + DEV |
| `tdp.topic.accept.order` | TDC/store-basic tests | T1 pending, T2 arrival, duplicate/old binding | only relevant successful apply+persist ack advances TDC accepted time; body time remains source | focused + Expo Web |
| `tdp.feature.co-subscription` | TDC tests | features X/Y, same topic; X success/Y fail | X accepted, Y failure visible, X unsubscribe leaves Y channel active | focused + Expo Web |
| `tdp.range.detail.delta` | store-basic tests | `{A,B}`→`{A,C}`; complete C detail | one same-list update, unsub B/sub C, no redundant C HTTP; late B not reinserted | focused + Expo Web + DEV |
| `tdp.region.parent.migration` | backend acceptance | legacy REGIONS with valid/ambiguous parent | correct same-space commercialGroup UUID after migration; ambiguous source blocks | PostgreSQL acceptance |
| `tdp.master.slave.projection` | terminal paired contract | MASTER+SLAVE fixture | only MASTER TDC/HTTP/subscription; SLAVE selector mirrors persisted data without fetching | Expo Web where representable + DEV paired fixture |
| `tdp.remote.hello-world` | terminal-control/TDS/TDC/runtime | current active terminal and registered no-effect command | exact command runs once, remote result readback exists, protected business data unchanged | backend acceptance + DEV + Expo Web |
| `tdp.remote.offline.unknown` | terminal-control focused | disconnect before/after send/ack | offline rejects new invocation; uncertain sent attempt remains unknown, no silent retry/queue | focused + backend acceptance |
| `tdp.remote.persisted-report`, `tdp.remote.cbs-history-retention` | TDC/CBS tests | running operation receives durable started ACK, then completes and receives durable terminal ACK; app restart, dropped/duplicate ACK, reconnect; completed+acknowledged CBS record then restart | started ACK updates the same map entry; terminal ACK removes that entry; duplicate ACK is no-op; request count/execution count remains one; CBS history remains queryable permanently | focused + backend acceptance + Expo Web |
| `tdp.remote.cbs-history-retention` | terminal-control owner acceptance | completed and acknowledged operation, then CBS process restart; separately force a result write failure | acknowledged history remains queryable permanently; failed DB write does not alter/delete prior history or report success | focused + backend acceptance |
| `tdp.remote.database-failures` | terminal-control/TDC owner acceptance | fail first CBS intent INSERT; fail UPDATE for an existing operation; separately make CBS read unavailable | first INSERT failure returns synchronous typed refusal and never dispatches; result UPDATE failure is not ACKed and CBS read remains last committed state; read failure is typed unavailable; no promise to persist a new failure into the same unavailable DB | focused + backend acceptance |
| `tdp.remote.runtime-late-result` | Runtime/Topology/TDC focused | 先按精确local `requestId`订阅，再让root timeout；分别让本地actor完成与通过真实Topology transfer callback返回peer actor结果，并覆盖5秒普通超时、跨接收端timeout及7,200,000ms默认expiry | peer wire保留commandId/requestId及实际actor result/error；gateway恢复结果；Runtime先交late handoff再发不含payload的journal；TDC只更新仍存在且身份匹配的原map项并报告，不redispatch；expiry/超界保持UNKNOWN并释放observer | focused + Expo Web |
| `tdp.remote.cache-clear-late-result` | TDC/runtime focused | operation尚在执行时分别触发server-config更新与root reset并清空既有map；之后释放本地/peer observer结果；另跑同配置普通断线重连 | 已清理的键不被late stage/result/ACK重新插入；observer/handoff按既有owner释放；CBS读到最后已提交状态或UNKNOWN且没有旧配置补报；普通断线重连仍保留原map | focused |
| `tdp.remote.invalid-target` | CBS/TDS contract | other store/group/stale session | no dispatch and no cross-scope records; owner returns typed refusal | backend acceptance |
| `tdp.bounds.backpressure`, `tdp.remote.cbs-history-retention` | TDS/TDC/CBS focused | max message, queue full, 65+ sequential successful operations with durable ACK, started ACK before completion, dropped/duplicate ACK, CBS DB write failure | ≤64 retained entries in the persisted `remoteOperations` map; no cache byte-capacity limit. Each WebSocket message remains within 65,536 bytes. A durable phase ACK updates the same map entry; terminal result ACK removes it; duplicate ACK is a no-op; dropped ACK retains the entry; the 65th retained operation is rejected without eviction; after 65 fully terminal+ACKed operations the map is empty. CBS history permanent; heartbeat serviceable, overflow visible, no false ACK | focused |
| `tdp.binding.old-report` | terminal-control/TDC | 同一配置下binding失效但未发生config change/root reset；另以root reset清理旧map | 前者保留原项并标`BLOCKED_BINDING_INVALID`，不跨binding发送；后者仅清除TDC本地map，不补发旧事实，CBS仍保留最后已提交状态或UNKNOWN | focused/backend acceptance planned, NOT_RUN |

## 11a · 验收判据对照

| Requirement criterion | Test/scenario ID | CBS/TDS execution | TER execution | Adapter coverage | File/runner |
| --- | --- | --- | --- | --- | --- |
| R-01 TDP terms/online session reuse | `tdp.topic.identity.scope` | focused/backend-acceptance（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | TDS/TDC contract tests |
| R-02 owner boundaries & no body mirror | `tdp.collection.hash.transitions` | focused/backend-acceptance（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | owner cache tests |
| R-03 generated full identity/scope | `tdp.topic.identity.scope` | static或focused（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | canonical schema generator |
| R-04 original timestamp/equal online/different reconnect | `tdp.topic.time.equal-online`, `tdp.topic.time.reconnect` | focused/backend-acceptance（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | CBS/TDS + store-basic |
| R-05 all hash transitions | `tdp.collection.hash.transitions` | focused/backend-acceptance（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | owner persistence test |
| R-06 transaction/concurrency/readback | `tdp.collection.concurrent.rollback`, `tdp.collection.concurrent.first-row`, `tdp.http.complete.snapshot`, `tdp.cache.restart.readback`, `tdp.listener.rebuild.current-cache` | focused/backend-acceptance（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | owner acceptance scenarios |
| R-07 activation/restart/init ordering | `tdp.store-basic.init.order` | focused/backend-acceptance（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | store-basic/DEV scenario |
| R-08 HTTP persist then accept exact time | `tdp.topic.accept.order` | static或focused（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | TDC/store-basic tests |
| R-09 member/detail subscribe delta and stale guard | `tdp.range.detail.delta` | focused/backend-acceptance（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | store-basic tests |
| R-10 MASTER only connection, SLAVE projection | `tdp.master.slave.projection` | focused/backend-acceptance（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | TER scenario |
| R-11 one store-basic package/7 data types | `tdp.store-basic.init.order` | static或focused（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | package module test |
| R-11.1 REGION reference repair | `tdp.region.parent.migration` | focused/backend-acceptance（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | backend acceptance |
| R-12 4 service point types, sequencing | `tdp.store-basic.init.order`, `tdp.master.slave.projection` | focused/backend-acceptance（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | store-basic/TER |
| R-13 runtime command and terminal-control owner | `tdp.remote.hello-world` | focused/backend-acceptance（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | terminal-control scenarios |
| R-14 online-only and finite request association | `tdp.remote.offline.unknown` | focused/backend-acceptance（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | terminal-control/TDS |
| R-15 durable terminal execution report/reconnect and retained CBS history | `tdp.remote.persisted-report`, `tdp.remote.cbs-history-retention`, `tdp.remote.runtime-late-result` | focused/backend-acceptance（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | TDC/terminal-control/Runtime |
| R-16 limits, failure visibility, cleanup | `tdp.bounds.backpressure`, `tdp.remote.cbs-history-retention`, `tdp.remote.database-failures` | focused/backend-acceptance（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | TDS/TDC/runner |
| R-17 helloWorld no side effects | `tdp.remote.hello-world` | focused/backend-acceptance（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | terminal-control acceptance |
| R-18 current entity timestamp/source inventory | `tdp.collection.hash.transitions` plus source inventory static | static或focused（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | CBS source-to-topic mapping |
| R-19 all 24 acceptance criteria | every row in this matrix | static或focused（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | corresponding owner files; none run now |
| V-01 contract/owner/interface closure | `tdp.topic.identity.scope` | static或focused（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | protocol and CBS tests |
| V-02 authorized scope | `tdp.topic.identity.scope` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | backend acceptance |
| V-03 equal live/different reconnect | `tdp.topic.time.equal-online`, `tdp.topic.time.reconnect` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | TDS/store-basic |
| V-04 hash transitions | `tdp.collection.hash.transitions` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | CBS test |
| V-05 ACTIVE expiry/INVALID exclusion | `tdp.collection.hash.transitions` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | backend acceptance |
| V-06 race/rollback/rebuild | `tdp.collection.concurrent.rollback`, `tdp.collection.concurrent.first-row`, `tdp.cache.restart.readback`, `tdp.listener.rebuild.current-cache` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | backend/TDS |
| V-07 complete snapshot and dependency refusal | `tdp.http.complete.snapshot`, `tdp.http.dependency-unavailable` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | terminal read acceptance; `TerminalDataReadControllerTest.mapsOwnerDatabaseFailureToTerminalDependencyUnavailable` asserts 503/errorCode |
| V-08 init/restart/late package | `tdp.store-basic.init.order` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | TER/DEV |
| V-09 accepted topic time | `tdp.topic.accept.order` | static或focused（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | TDC/store-basic |
| V-10 out-of-order/old result | `tdp.topic.accept.order` | static或focused（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | TER |
| V-11 co-subscribe/unsubscribe | `tdp.feature.co-subscription` | static或focused（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | TDC |
| V-12 collection/detail diff | `tdp.range.detail.delta` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | CBS/TER |
| V-13 REGION/owner references | `tdp.region.parent.migration` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | CBS/TER |
| V-14 service point scopes/moves | `tdp.store-basic.init.order` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | CBS/TER |
| V-15 master/slave | `tdp.master.slave.projection` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | focused；动态执行面仅Expo Web，只验证逻辑投影 | NOT_COVERED：真实持久化/设备配对由adapter与设备运行证明 | TER |
| V-16 remote helloWorld | `tdp.remote.hello-world` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | CBS/TDS/TDC/runtime |
| V-17 invalid command/target | `tdp.remote.invalid-target` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | terminal-control/TDS |
| V-18 duplicate/unknown request | `tdp.remote.offline.unknown` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | terminal-control/TDC |
| V-19 persist after restart | `tdp.remote.persisted-report`, `tdp.remote.cbs-history-retention` | static或focused（计划/NOT_RUN） | NOT_COVERED：真实双设备/持久化adapter不由Expo Web证明 | NOT_COVERED | TDC |
| V-20 retries/order/late result | `tdp.remote.persisted-report` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | CBS/TDC |
| V-21 storage/capacity failure | `tdp.bounds.backpressure`, `tdp.remote.cbs-history-retention` | static或focused（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | TDC/TDS/CBS |
| V-22 old binding report boundary | `tdp.binding.old-report` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | terminal-control/TDC；Dexter已裁定A |
| V-23 all resource bounds/log redaction | `tdp.bounds.backpressure` | focused/backend-acceptance；需要真实owner时再DEV（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | TDS/TDC |
| V-24 owner timestamp inventory | static source inventory | static或focused（计划/NOT_RUN） | N/A：后端owner判据 | N/A：该判据不触及TER platform adapter | owner map in design and focused source assertions |
| DEV-DATA-01 store data mutation | `tdp.dev.store-update` | `updateOperationsOrganizationStore`：已存在fixture门店改真实可编辑名称/备注 | terminal GET返回新值与organization原始时间；CBS行、TDC accepted time、TER持久selector一致，无手动刷新 | N/A：不触及platform adapter | operations-admin + TDP; future DEV-DATA detail matrix |
| DEV-DATA-02 store status | `tdp.dev.store-status` | 受管DEV真实业务修改链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | existing operations admin + TDP |
| DEV-DATA-03 project mutation | `tdp.dev.project-update` | 受管DEV真实业务修改链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | operations admin + TDP |
| DEV-DATA-04 region mutation | `tdp.dev.region-update` | 受管DEV真实业务修改链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | operations admin + TDP |
| DEV-DATA-05 commercial group mutation | `tdp.dev.group-update` | 受管DEV真实业务修改链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | operations admin + TDP |
| DEV-DATA-06 operating rules | `tdp.dev.operating-rules` | 受管DEV真实业务修改链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | operations admin + TDP |
| DEV-DATA-07 contract set transitions | `tdp.dev.contract-set` | 受管DEV真实业务修改链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | operations admin + TDP |
| DEV-DATA-08 contract details | `tdp.dev.contract-detail` | 受管DEV真实业务修改链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | operations admin + TDP |
| DEV-DATA-09 area set | `tdp.dev.area-set` | 受管DEV真实业务修改链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | operations admin + TDP |
| DEV-DATA-10 area detail | `tdp.dev.area-detail` | 受管DEV真实业务修改链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | operations admin + TDP |
| DEV-DATA-11 service point set | `tdp.dev.point-set` | 受管DEV真实业务修改链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | operations admin + TDP |
| DEV-DATA-12 service point detail | `tdp.dev.point-detail` | 受管DEV真实业务修改链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | operations admin + TDP |

DEV-DATA-01～12均使用r5-full已有的同一workspace与store基础fixture；准备/恢复只走受管owner命令，不直接写PG。每项记录变更前后CBS权威字段、CBS原始时间、通知topic identity、TER真实HTTP请求种类、feature selector及持久state。01～06不改变scope成员；07/09/11只用新增/状态转换产生集合成员变更，不制造需求排除的移店、移项目、移区操作。

| Scenario | 真实 Operations Admin command/API 与合法差异输入 | 预期topic | 最终业务断言 |
| --- | --- | --- | --- |
| DEV-DATA-01 | `updateOperationsOrganizationStore`：修改测试门店的`name`或`notes` | STORE | `organization.store.updated_at_epoch_millis`与store-basic DTO均对应新字段；CBS、selector、持久state一致 |
| DEV-DATA-02 | `transitionOperationsOrganizationStoreStatus`：将测试门店按现有合法状态机停用后重新启用 | STORE | 返回真实status与原始时间；同步状态，不给TER增加停用业务判断 |
| DEV-DATA-03 | `updateOperationsOrganizationNode`：选绑定门店所属PROJECT，修改`name`/`notes`或其允许编辑的phase名称，不改parent关联 | NODE-PROJECT | project DTO与project原始时间更新；store/region时间不冒充 |
| DEV-DATA-04 | `updateOperationsOrganizationNode`：选同scope REGION，修改`name`/`notes`，不改commercialGroup父关系 | NODE-REGION | region DTO与自身原始时间更新；不依赖STORE通知 |
| DEV-DATA-05 | `updateOperationsCommercialGroup`：修改既有商业集团`groupName` | GROUP | commercialGroup DTO与自身原始时间更新；不读取workspace或GROUP组织节点代替 |
| DEV-DATA-06 | `updateOperationsOrganizationStore`：修改门店`operatingRuleSwitches`中一个可编辑开关 | STORE + STORE_OPERATING_RULES | 同一store更新时间唤醒两条精确topic；允许一次业务HTTP响应供两条topic复用，规则与store字段均持久一致 |
| DEV-DATA-07 | `createOperationsContract`创建合法ACTIVE合同、`invalidateOperationsContract`使其失效；复用同店隔离fixture完成空→非空→非空不同→空 | STORE_ACTIVE_CONTRACTS | 完整集合ref/hash/time符合R-05；对应CONTRACT_DETAIL订退差量正确；不作合同经营资格判断 |
| DEV-DATA-08 | `updateOperationsContract`：修改同一ACTIVE合同的可编辑正文，不改变其状态和store scope | CONTRACT_DETAIL | 只刷新该合同详情及原始时间；集合成员/hash不变，不重读所有合同 |
| DEV-DATA-09 | `postOperationsStoreServicePointArea`新增、`postOperationsStoreServicePointAreaStatus`合法启停测试area | STORE_SERVICE_POINT_AREAS | 全门店ENABLED area集合及area详情订退正确；空集合保留集合topic，不改point自身状态 |
| DEV-DATA-10 | `patchOperationsStoreServicePointArea`：修改仍ENABLED area的name/code/areaType | SERVICE_POINT_AREA_DETAIL | area详情与原始时间更新；范围成员不变，不误发集合内容变化 |
| DEV-DATA-11 | `postOperationsStoreServicePoint`新增、`postOperationsStoreServicePointStatus`合法启停测试point | STORE_SERVICE_POINTS | 全门店ENABLED point集合与详情订退正确；不按area拆scope、不做移区 |
| DEV-DATA-12 | `patchOperationsStoreServicePoint`：修改仍ENABLED point的name/code等现有可编辑字段 | SERVICE_POINT_DETAIL | point详情和原始时间更新；point集合成员不变，不推导下单/可用性业务 |

| Scenario | 测试行为 | fixture / scenario | CBS/TDS 执行面 | TER 执行面 | Adapter coverage | owner |
| --- | --- | --- | --- | --- | --- |
| DEV-DATA-13 | initialization failure/order | `tdp.store-basic.init.order` | focused + 受管DEV真实链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | store-basic/DEV |
| DEV-DATA-14 | offline update/equal online | `tdp.topic.time.reconnect` | 受管DEV真实业务修改链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | CBS/TDS/TDC |
| DEV-DATA-15 | master/slave projection | `tdp.master.slave.projection` | 受管DEV真实业务修改链（计划/NOT_RUN） | Expo Web逻辑投影fixture；真实双设备结果NOT_COVERED | NOT_COVERED：持久化/设备配对adapter不由Expo Web证明 | TER topology |
| DEV-DATA-16 | partial failure/late results | `tdp.range.detail.delta` | focused + 受管DEV真实链（计划/NOT_RUN） | focused；动态执行面仅Expo Web | N/A：该判据不触及TER platform adapter | store-basic |

本专项TER执行面裁决（Dexter本次会话指派，2026-10-04）：凡TER动态验证只安排Expo Web，不安排Android、VM、真机，也不要求Web→设备等价。此例外仅限本专项，不修改正式需求其他批次/全仓TR-16。表中TER列仅写focused与Expo Web；CBS/TDS后端列独立列出backend-acceptance/DEV。真实双设备拓扑、platform persistence/network/display adapter在Expo Web不能证明，写`NOT_COVERED`且不得由backend DEV或mock代替。全部执行状态现在均为`NOT_RUN`。
## 12 · 未决事项与边界

Dexter于2026-10-04已裁定远程执行只通过数据库投递、CBS历史永久保留；同一会话后续明确：TDC command结果仅为本地缓存，普通断线重连保留，server-config改变或root reset时清理。较早的binding-invalid A裁决仍要求同一配置下不跨binding补报；不得将它解释为跨root reset永久保留。下表保留工程边界与第三方证据缺口；精确依赖解析版本与官方依据仍OPEN。

| 项目 | 分类与影响 | 候选与推荐 | 当前边界 |
| --- | --- | --- | --- |
| CBS↔TDS数据库投递边界 | `DEXTER_RULING_APPLIED`：仅PostgreSQL中介；CBS写入后NOTIFY唤醒TDS执行；TDS经owner DB command写实际结果；CBS不接收通知而主动查owner read。 | 使用terminal-control具名持久意图 + 只含identity的NOTIFY + terminal-control owner控制的窄DB command API进行读取/认领/写事实；不让TDS直写owner表，不建generic queue/outbox，不轮询。 | 在线session失效时typed未送达且不留待执行项；丢失通知不扫描补发。CP-06须定义claim/UNKNOWN语义及SQL授权红例。 |
| 旧绑定远程事实/本地结果缓存 | `DEXTER_DECISION_RESOLVED`：同一配置下binding失效事实按原判决转`BLOCKED_BINDING_INVALID`并不跨binding补报；Dexter本次明确执行结果是本地缓存，server-config改变或root reset可清理 | 普通断线重连且server-config/binding不变时保留待ACK正文；server-config改变或root reset时按TR-09默认清空TDC remote result cache，不增加第二`resetIntent: retain`例外；CBS已提交历史永久保留 | 若清除的是未ACK结果，CBS保留最后已提交状态/UNKNOWN；新配置不得补发旧操作。这是明确的缓存生命周期边界。
| CBS已确认远程事实保留 | `DEXTER_RULING_APPLIED`：CBS不删除已确认历史。 | CBS已提交历史永久保留，不按时间删除，不设应用层条数上限；无TTL、归档或清理任务。数据库存储失败按typed失败返回，不得丢弃旧记录或假报成功；既有PostgreSQL卷容量为唯一总量边界，不引入功能专属quota。 | 不删除、不截断、不引入本功能专属quota；单条记录边界、既有数据库容量预检及DB写失败路径由CP-06验证。 |
| TDS完整响应与订阅/dirty身份 | `DEXTER_DECISION_RESOLVED`：业务集合没有本期条数上限，不得由TDP增加；11是type闭集，实例随owner完整集合 | 三类HTTP集合完整同快照返回；TDC/TDS按实际详情身份维护当前active subscription；dirty是active identity子集、按键合并；退订/失效/disposal释放。65,536 bytes仅为WS单消息边界 | 无maxItems、HTTP总字节或每店身份数量限制；不计算最大合法C/A/P、不引入独立容量框架。Focused/acceptance证明12+身份可完整处理、退订释放、重复dirty合并。
| 第三方运行/测试解析版本与官方API | `UNVERIFIED_REQUIRES_EVIDENCE`：构建文件静态约束不等于本轮已解析的runtime/test classpath | CP开始前生成实际依赖图并按 `third-party-library-usage-standard.md` 精确版本标签复核所有被调用API；不升级/猜用法 | 设计暂不宣称依赖解析PASS；PostgreSQL JDBC runtime版本尤其待确认 |

其他实施边界提案：WS wire message full/decompressed≤65,536 UTF-8 bytes；业务HTTP合同/区域/服务点返回完整owner集合，不加条数或HTTP响应字节上限。TDS只维护当前active subscription identity；dirty identity属于该集合并按键合并，退订/失效/disposal清除；沿用容量1 outbound sink，不建历史dirty队列。TDC持久化slice只含一个`remoteOperations` map，以`remoteOperationId`为键，每个尚未释放的operation占一个map项；map最多64项，达到数量上限时拒绝新操作并保留已有项。只限制项数，不设缓存字节容量上限；WebSocket单消息仍遵守65,536 bytes协议边界。阶段ACK更新同一map项，终态结果ACK持久成功后删除该项；普通同配置断线重连保留map，server-config更新/root reset按TR-09清理。CBS已提交历史永久保留、不设人为条数上限。NOTIFY仅唤醒且不记账；REGION迁移保留原更新时间及version并不发布历史通知。

TER验收范围只Expo Web的本次裁决不改变CBS/TDS真实acceptance/DEV计划；TER逻辑投影可用Expo Web fixture验证，adapter与真实双设备运行仍为`NOT_COVERED`，不由Web证据代替。

## 13 · 停机条件

设计期：若独立 reviewer 证明核心认证、TDS snapshot read、同事务范围cache或有限远程事实语义无法在正式需求/既有owner规则内闭合，标OPEN并提交Dexter；不编造接口或秘密owner。实施期未来只有真实硬约束或需实质改变业务目标时停整批；模块依赖/测试失败是根因修复点，不自动停工。不得引入MQ/outbox/轮询、Doris业务内容、第二business deployable、终端管理页面、离线命令排队或通用Exactly-once。

## 13b · 实施节奏与三维对账

未来完整 CP-01～CP-06 每个CP完成实现、focused proof与根因修复后，由fresh独立子agent对“原始需求 + 本详设 + 六维记忆/治理规范”做阶段三维对账，只有逐项 `MATCHED` 才进入下一CP。全部CP MATCHED后另做全批6b，随后批次级整体动态验收、cleanup、13c及review；这些不属于CP退出条件。设计评审不能替代任何实施对账。此次文档编辑没有实施CP或运行证据。

## 13c · 逐代码与详设对账（交付前置）

未来计划必须有显式步骤：由fresh只读子agent逐文件逐符号、非抽样核对新增生产类型/method调用者与生成物/生产者的双向闭包，并按本详设逐条核代码。逐行记录只有 `MATCHED` / `OPEN`。任一OPEN先最小修复并仅复查受影响链；全部MATCHED后才能将实现交给Dexter/Claude。不能用CP对账、测试绿或旧GO替代。

## 14 · 交付前自查

| 检查 | 判定 |
| --- | --- |
| 正式需求R-01～R-20、V-01～24、DEV-DATA-01～16覆盖 | 已列映射；动态均NOT_RUN |
| template sections 0–14 | 已包含；seed部分按无UI/无本轮seed说明适用边界 |
| 方案比较与形态理由 | 已写；数据库中介通路、旧binding按A保留、CBS历史不按时间删除均按Dexter 2026-10-04裁决同步 |
| 真实owner、source与dependency | 指名CBS organization/store-contract、TDS、TDC、Runtime、store-basic；TDS只读cache task query已定义 |
| 实际第三方版本/官方依据 | 未据记忆定API；在实施前必须按版本标准完成 |
| 生成物不手改及D-41 | canonical唯一源、root containment明确 |
| §13c及计划交付对账步骤 | 已明确要求逐代码非抽样、MATCHED/OPEN |
| 当前TDP实施/动态状态 | NOT_AUTHORIZED / NOT_RUN |

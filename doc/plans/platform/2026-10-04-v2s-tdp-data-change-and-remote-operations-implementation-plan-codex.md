# TDP 数据变化通知与远程运维 · implementation plan

```text
DOC_KIND=IMPLEMENTATION_PLAN
DATE=2026-10-04
AUTHOR=Codex
DESIGN=doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md
REVIEW_CYCLE_ID=TDP_DATA_CHANGE_REMOTE_OPERATIONS_DESIGN_2026-10-04
REVIEW_TARGET=DESIGN
AUTHORIZED_NOW=Dexter 2026-10-04已授权TDP整批实施、必要生成/编译/测试/verify、受管backend-acceptance/DEV；TER仅Expo Web
IMPLEMENTATION_AUTHORITY=true
DYNAMIC_STATUS=修订前证据与后续当前字节运行分开记录；未运行场景为NOT_RUN
```

## 1. 目标与范围

按正式需求 R-01～R-20 完成单一 TDP 批次：CBS owner 数据变化通知 + `kernel/feature/store-basic` 真实业务消费；CBS `terminal-control` → 当前 TDS session → TDC → 已注册 Runtime command 的在线远程运维；TDC 保存执行事实并在重连后补报。本专项 TER 非adapter业务验收只安排 Expo Web；不安排 Android、VM、真机与 Web→设备等价检查。adapter 行为 Expo Web 无执行能力，标 `NOT_COVERED`。CBS真实数据库/HTTP、TDS真实WS及DEV执行计划保留，但当前均未运行。

排除：批次外业务、生产/长期HA、L2、UAT、管理页面、MQ/outbox/通用持久队列/轮询、离线执行补发、通用Exactly-once、将业务数据放Doris、额外业务deployable。任何需求/范围变化返回Dexter。

## 2. 实施纪律与阶段门

主agent唯一源码、测试、脚本与文档写入者；fresh reviewer只读。每个实际修改点写入前重新打开正式需求对应段、项目记忆六维命中、owning source和此详设；同根扫描完后修改。每点以同组输入回读。完整CP工作与focused proof全部完成后，fresh独立三维核对当前CP，所有项 `MATCHED` 才进入下一个CP；修复OPEN仅复查受影响范围及同根。CP全部MATCHED后另做全批6b，然后整体动态验收。实施动态前真实owner与测试fixture先静态review；首败保留，第二次同failureCategory冻结其后业务推进，读日志和owning source，以同一focused proof根因关闭后继续。代码未改不重跑，受管run期间不改受测源码，business与cleanup分开，cleanup非PASS不收口。

远端backend-acceptance/TDS与数据库保持同侧，用仓内managed入口、manifest、PID/host/boot/start ticks及预算预检。本专项已获Dexter授权执行计划内受管backend-acceptance/DEV；TER动态验收只在Expo Web执行。该授权不包括Android/VM/真机、独立浏览器L2、reset/seed、UAT或生产部署。

## 3. CP序列

### CP-01 · Canonical 协议、HTTP contract 与生成链

- **第三方核验适用性：** 本CP生成器只使用Node内建模块（`fs/os/path/url/child_process/crypto`）与Ruby标准库YAML解析，CP-01正确性不依赖第三方库API、默认值或运行行为，故本CP该项为`N/A_WITH_REASON`。第三方实际解析版本及官方依据在实际依赖这些行为的CP核验，不将N/A扩展为免核验。

- **现成能力/RECALL：** `contracts/protocol/terminal-connection-protocol.json` 原有AUTHENTICATE/SESSION_READY/PING/PONG，本CP扩充TDP消息；`scripts/generate/terminal-client-api.mjs` 消费HTTP OpenAPI；`r5-edge-materialize.mjs` 的terminal credential allowlist从修订前2项扩为当前10项（activate/cancel + 8个read GET）；`operation-handler-bindings.mjs`按route registry闭合wire/owner/face，并由本CP加入明确的terminal credential read context/query wire映射；D-41规定生成器输入路径必须解析在仓内。
- **canonical→生成闭包：** protocol JSON定义TDP有限topic、subscribe/unsubscribe、notification/accept、remote invoke/progress/result/report message schema；`scripts/generate/terminal-connection-protocol.mjs`输入仅该canonical JSON，生成TDS Java message records/字段名闭集与TDC `src/generated/terminalConnectionProtocol.ts` message types。TDS `TerminalConnectionProtocol`/`TerminalConnectionFrameCodec`与TDC parser/actor是运行时值校验owner并消费生成闭集，不重复生成validator/codec；`--write`更新、`--check`拒绝漂移，D-41相对/绝对根外及符号链接输入红例。
- **HTTP error canonical 闭环：** 当前`doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`将`PLATFORM_DEPENDENCY_UNAVAILABLE`映射为自身且`RETAIN`；基线错误schema与生成`EdgeProblemCode`均含该值，`r5-edge-materialize.mjs`为Problem response闭集含422/503，8个terminal read operation的`TERMINAL_DATA_READ` error set引用active 422/503 codes。CP-01用所属materialize/codegen入口证明移除RETAIN映射、移除terminal operation的422或503 response、或从terminal error set删除相应active code都会以具名标记失败；实现期再由真实owner条件产生对应HTTP status/code，不手改materialized/generated产物。
- **terminal HTTP闭包：** 按详设§5的8个GET operation加入`contracts/openapi-source` canonical schemas、R5 operation catalog、security requirements、materialize terminal allowlist、edge-codegen和`terminal-client-generation.json`；同时更新`operation-handler-bindings`显式wire映射及route digest/count source，新增后当前源分母为304 operation/132 READ/172 COMMAND。face=`terminal`，所有新增operation均`TERMINAL_CREDENTIAL`，Authorization scheme=`terminalCredential`，只有activate仍`NONE`。TDC从唯一credential state提供Authorization、`X-Terminal-Ref`、`X-Terminal-Device-Id`；路径提供workspace与业务ref，经generated client发送；edge复用`TerminalCredentialParser`和`TerminalCredentialVerificationApi`，核验成功后生成不含secret的`TerminalCredentialReadContext`，并先核对workspace/store路径身份。单项详情的contract/area/point ref由三个typed query wire record分别承载；其余读取取已核验context中的storeRef。八个operation共用具名`TERMINAL_DATA_READ` errorSet：PLATFORM_COMMON_VALIDATION_FAILED/422、TERMINAL_BINDING_CREDENTIAL_INVALID/403、PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED/403、STORE_TERMINAL_DISABLED/409、PLATFORM_COMMON_ACCESS_DENIED/403、详情PLATFORM_COMMON_RESOURCE_NOT_FOUND/404、PLATFORM_DEPENDENCY_UNAVAILABLE/503；逐operation闭合适用条件。feature不得读credential或自行拼URL。每个operation在catalog→materialize→edge-codegen→TDC generated及operation binding context/request逐operation闭合。
- **edge→owner运行接线：** CBS `TerminalDataReadController` 实现八个生成GET，不增加新的凭证owner或跨模块读旁路。当前有效合同由store-contract owner按`BusinessDateProvider.today()`及既有`FIXED_STORE_VIEW_CURRENT`条件在单条完整集合task query返回；generated status继续使用`VALID`/`INVALID`词表。focused backend-acceptance `terminalDataReadOwnerRoutes` 真实创建并读回有效合同、读取八个GET、断言缺失合同404与错误凭证403。run `r5-tc-1791135081532-44283` 的SQL基线为6/7/2/2/4/4/8/5，0 mutation；新增局部异常handler后的当前字节run `r5-tc-1791136156911-66469` 再次通过同一真实HTTP scenario，SQL计数不变。依赖不可用由controller handler将`DataAccessResourceFailureException`与`TransientDataAccessException`映射为503；MockMvc owner failure proof `r5-tc-1791136001954-63418`断言`PLATFORM_DEPENDENCY_UNAVAILABLE`。三次run的结果和cleanup见`doc/review/platform/2026-10-05-v2s-tdp-cp-01-terminal-read-delta-proof-codex.md`；详设§5.1记录实测基线，不把统一2 SELECT估算继续当预算事实。
- **实现形态：** 当前HTTP生成器保留为HTTP producer；新WS generator是独立producer，同一个JSON contract生成TS/Java两端类型及Java字段名闭集。生成器self-test覆盖message type缺失/未知、根外相对/绝对路径与符号链接；运行时字段值由后续CP的codec/parser覆盖。`operation-handler-bindings`为八个terminal GET固定`TERMINAL_CREDENTIAL_READ_CONTEXT`，只含核验后的workspace/group/store/terminal/generation身份、不含secret；三种单项详情由各自typed path-query wire传入ref。edge先确认路径workspace/store与核验身份一致，再调用owner。
- **如何验证：** canonical合法样本生成两端同字段/同enum；修改一个字段后`--check`非零直到重新生成；每条terminal GET从operation identity查询到两端相同path/auth/success/error closure与credential-read context；materializer self-test对一个terminal GET分别用NONE、workspace session、删除credential requirement证明拒绝；operation-binding self-test对八个GET逐一构造错误context、对三个详情GET逐一构造错误wire request并按标记失败；source escape夹具失败；TER generated typecheck。数据库资源不可用的映射由`TerminalDataReadControllerTest.mapsOwnerDatabaseFailureToTerminalDependencyUnavailable`经MockMvc触发`DataAccessResourceFailureException`并断言HTTP 503及`PLATFORM_DEPENDENCY_UNAVAILABLE`；有效数据库下八个正常GET、缺失详情404、凭证拒绝403由真实`terminalDataReadOwnerRoutes` acceptance验证。
- **不变量/FORBID：** 不把ref当授权；terminal read都须现有credential；credential只由TDC持有；HTTP数据获取与WS事件分开；D-41 root containment；不把流程ID放runtime名称。
- **阶段出口：** WS canonical→Java/TS producer与HTTP canonical→materialize→edge-codegen→TDC generated两条链分别MATCHED；认证红例及生成红例都被门执行。

### CP-02 · CBS 原始时间、范围摘要、REGION引用与owner写路径

- **现成能力/RECALL：** `doc/platform/backend-coding-standard.md`、`project-memory/practices/backend-capability-lookup.md`；organization与store-contract现有command/service事务和SQL owner；Flyway单一history；`TdsBindingRevocationListener`只作为PG wake-up的复用先例，不复制revocation业务。
- **完整改动分母：** formal requirements §4.1b中STORE、NODE-PROJECT、NODE-REGION、GROUP、CONTRACT-CREATE/UPDATE/INVALIDATE、AREA-CREATE/UPDATE/STATUS/MOVE、POINT-CREATE/UPDATE/STATUS/MOVE与所列typed/legacy funnels；REGION read/create/update、后台DTO、seed与fixture；三种范围cache owner schema。
- **实现形态：** 在各owner真实mutation core的正文全部成功后、提交前，同事务重算精确受影响scope。范围集合查询前按owner schema + 完整workspace/group/store scope取得transaction-scoped `pg_advisory_xact_lock`，即使snapshot行尚不存在也先锁后查；单次事务触及多个scope时按稳定lock key排序获取。精确topic不写缓存：organization/store-contract各自提供`read_terminal_topic_time(...)`具名窄SQL入口，仅返回八类闭集topic相应实体raw `updated_at_epoch_millis`或typed missing/denied；TDS仅获EXECUTE。`organization`入口服务STORE、PROJECT、REGION、COMMERCIAL_GROUP、STORE_OPERATING_RULE、SERVICE_POINT_AREA、SERVICE_POINT；`contract`入口服务单项CONTRACT。函数仅对闭集topic kind执行其owner query。三个集合topic在锁内以同一事务读取完整有序ref列表并计算hash/time。SQL保证主键唯一与固定排序，不在Java重复去重排序。cache只存完整identity/hash/time。原实体和cache同回滚。commit成功后publish有限NOTIFY wake-up，transaction失败不得通知；active订阅与cache维护无关。具体PG版本与lock API官方依据在CP-02按项目规范核实。
- **REGION迁移：** Flyway补必填同space CommercialGroup UUID。实施前只读盘点缺失、唯一候选、多候选数据；无法唯一解析拒绝迁移；不猜归属。迁移只改父ref与非空约束，不改`updated_at_epoch_millis`或version，不发布历史通知；详设明确该迁移策略。首次无row空范围用0基线，完整集合使用R-05中的B。
- **如何验证：** 每个真实command正向一例与receipt replay/CAS fail/rollback红例；PG读回实体+cache atomic；hash输入顺序改变不变、3个transition按R-05的A/B时间矩阵；barrier令两个事务在同一此前无snapshot row的scope锁前并发到达，分别新增不同成员，断言后一个查询发生在前一提交后，最终集合/hash/time包含两个成员；不同scope可独立进展；既有空集cache row重启后保留A、无row仍按0初始化且两者可区分；两店隔离；历史REGION迁移读回正确父UUID且歧义数据migration红；owner read返回同快照完整集合，不分页、不截断、不按业务数量拒绝。Focused+backend-acceptance。
- **阶段出口：** 搜索正本§4.1b真实命中全集并对到owner hook，所有entity writes/cache/notification精确一次；REGION迁移歧义数据 fail closed；初始空集合时间按R-07取0，只作为首次计算基线，不回写业务更新时间。

### CP-03 · TDS 按有效session订阅、唤醒与通知

- **现成能力/RECALL：** `TdsTerminalSessionActors`只以当前session authority管理connection；`TdsBindingRevocationListener`有PG listener重建路径；`TdsWebSocketConnection`的outbound sink当前容量为1；`TdsConnectionStateRepository`读权威PG session。实际Reactor/JDBC行为按third-party标准在实施CP实查。
- **权限矩阵：** 使用详设§5.1a的精确表。CP-03受管bootstrap授予数据库CONNECT及`platform_workspace`、`store_terminal`、`organization`、`terminal_binding`、`terminal_connection`、`contract`的USAGE，不授CREATE；另授认证事实列级SELECT、`terminal_connection.session_sequence` USAGE、TDS自有`latest_state` SELECT/INSERT/UPDATE、两个snapshot SELECT、CP-02创建的两个raw-time函数EXECUTE；不授owner表直接写权限。principal bootstrap 遇`terminal_control` schema 尚不存在时跳过该组授权和权限探测；schema存在但表或claim/report函数不完整时显式失败，不报告成permission denied。CP-03只对已建对象验证权限，未建对象不能当作权限拒绝。terminal-control的schema USAGE、claim/report函数EXECUTE及直接表DML负例均在CP-06对象建立以后验证，区分缺对象和权限拒绝；TDS始终不回落CBS账号。
- **权威read path：** session完成terminal-binding credential与当前generation核验后，三个集合topic（有效合同、门店区域、门店服务点）从owner snapshot表读取；八个精确topic（门店、项目、大区、商业集团、门店经营规则、单合同、单区域、单服务点）调用CP-02的owner窄SQL函数，仅读对应实体原始时间，不读业务正文。完整授权键为`(workspace_uuid, group_workspace_key, bound_store_ref, topic_key, owner_ref)`，scope store从PG当前binding取得，不接受客户端store作权威。精确实体不存在/越权返回typed not-found/denied；集合无snapshot行按首次基线规则，不一概拒绝。CBS owner拥有query实现与读取事实；TDS不依赖CBS Java模块或新内部HTTP。
- **实现形态：** connection actor登记full identity+TDC last accepted time；提交后PG NOTIFY只唤醒，TDS再读当前binding与相应owner权威事实后投递。listener启动/重建先核对当前session/有效订阅。11是type闭集，不是实例上限；三类HTTP完整集合不设业务数量/HTTP字节上限，按owner同快照完整返回。每条详情identity对应active subscription；退订、binding失效与connection disposal删除条目。dirty identity只能来自active set并按键合并，不另建历史队列。WS消息仍遵守65,536 UTF-8 bytes full/decompressed上限。outbound sink容量1按actor串行写，command不能排队；写失败走既有typed dispatch failure/unknown，心跳保持可用。
- **如何验证：** backend acceptance用两个TDS真实WS session，验证在线同时间owner变化使两session各收到一次通知并通过ACK读回相同raw time。TDS对三种集合只读取owner snapshot的一行更新时间，不承载集合正文或分页；完整HTTP集合内容、同快照和无截断由CP-02 owner及CP-05 feature消费判据验证。八类精确topic逐一核对到owner raw-time函数，函数仅返回时间或typed missing/denied。focused actor tests验证错误workspace/group唤醒不派发、其他store ownerRef订阅被拒、12个合法identity同时保留、unsubscribe/disconnect释放、listener重建会重读仍有效订阅的owner时间；listener test确认重建路径调用该reconcile。失败owner事务不发NOTIFY由CP-02事务回滚/通知证明覆盖。outbound sink继续容量1：未消费时第二帧明确拒绝并立即释放，不建立无界待发队列；topic dirty identity仍按键合并并等待下一次数据库唤醒，网络发送不阻塞owner HTTP/事务。心跳工作不排在topic dirty队列之后；若底层socket outbound slot本身无法接收PONG，按现有协议错误关闭，不承诺向不消费的socket无限保留心跳。focused WebSocket connection test证明队列拒绝与buffer释放，既有真实WS场景证明正常连接及心跳/数据消息使用同一发送通路。DEV与acceptance分别使用独立TDS principal；正向证明允许的认证事实列、TDS自有session表读写、两张snapshot SELECT与八类raw-time函数调用成功；反向证明未授予的owner写权限失败，以及TDS不能直接SELECT/INSERT/UPDATE/DELETE terminal-control记录表。CP-03不验证尚未创建的terminal-control函数；其EXECUTE仅在CP-06创建后验证。
- **FORBID：** TDS读业务正文、TDS本地业务cache、MQ/outbox/常态poll、按裸node/socket路由、新CBS HTTP/internal-client。
- **阶段入口：** 从正式需求与owner源码确认三类完整集合没有本期业务数量上限；按实际完整数据和有效订阅工作，不人为设C/A/P最大值或HTTP总字节cap。实现前确认active subscription与dirty set只存当前身份、可随退订/disposal释放；WS消息继续按既有65,536 bytes边界。
- **阶段出口：** 三类snapshot与八类raw-time query权限有正反验证；TDS订阅仅消费snapshot/raw-time标量，不承载集合正文；owner完整集合的无分页/截断由CP-02/CP-05各自证明。12+身份可订阅，错误workspace/group唤醒与其他store订阅被拒，listener rebuild重读仍有效订阅的owner时间，退订/失效/disposal释放active条目，重复dirty合并；容量1 outbound slot被占时拒绝新帧并释放其buffer、不延长队列；心跳工作不被topic dirty集合排队阻塞。所有单条WS消息仍受65,536-byte协议界限。DEV/acceptance各自独立配置TDS principal，授权读取/执行成功；未授权owner写操作及terminal-control记录表直接读写失败。TDS PostgreSQL JDBC解析版本及API官方依据也须留证。

### CP-04 · TDC topic command、selector 与连接生命周期

- **现成能力/RECALL：** `apps/terminal/kernel/base/terminal-data-client`已有commands/actor/selectors及activated identity；`runtime/createCommandDispatcher.ts`支持command向已注册actors广播及`allowNoActor`；`createRuntime.ts`按注册名dispatch；topology定义MASTER/SLAVE。
- **实现形态：** TDC唯一拥有topic protocol state和accepted times。feature以TDC command登记自己的有效topic意图，本地intent先保存；未ready暂存到有效slice，SESSION_READY后逐项发送；取消只删自己的topic registration，底层channel最后一个owner退出才关闭。Notification按topic+binding/session+notification identity传入一个public TDC command广播相关feature command；业务selector只公开已接受协议态。SLAVE不连TDS、不subscribe、不收ready/topic广播；仅selectors读MASTER持久peer projection。
- **如何验证：** same topic两feature共同订阅/分别接受；一个fail不回滚另一个、一个退订保留另一个；重复/退订后/旧binding accept拒绝；ready/reconnect重发已accepted time而不采用旧initial value覆盖。Focused + Expo Web。
- **阶段出口：** CP-04的subscribe/unsubscribe/accept由TDC actor消费；`topic-changed` 是明确允许零消费者的Runtime fanout command，具名 `store-basic` consumer 在CP-05建立并于CP-05出口验证。TDC订阅与通知selector、协议发送及失败结果可由本CP focused proof观察；无feature可绕过TDC协议command直接读transport业务帧。

### CP-05 · 单一 `kernel/feature/store-basic` 业务feature

- **现成能力/RECALL：** package module/state/slice/commands/selectors/actor registration形态参照`kernel/feature/sample-member-registry`、`kernel/feature/sample-staff-session`；persist与peer sync使用现有state/topology public API；TDC generated HTTP调用通过transport公开command。
- **本批消费全集：** Store基础信息、Project、Region、CommercialGroup、StoreOperatingRules、Contract valid集合、Contract detail、区域集合、区域detail、服务点集合、服务点detail。无第二`store-service-point` package；无UI。
- **实现形态：** 单package持11类domain DTO及原始更新时间、集合refId与读结果状态；owner feature actor收activation-success public command，先用当前binding通过真实terminal HTTP加载Store，成功后更新并persist；然后本feature command读取全部service area/point并独立更新，Store失败绝不发service-point requests。其他topic query可独立完成；没有全包屏障。集合响应完整返回，先复用响应中已有详情，再只补缺失详情；读入持久化后以command更新TDC topic accepted time，再差量subscribe详情。退出成员不重插。唯一数据state归store-basic，TDC不镜像正文。
- **如何验证：** store失败时service HTTP计数0；store persist之前无service command；service分区失败不回滚store；`{A,B}`到`{A,C}`保留A/退B/加C一次且不重复GET C；late B不插回；重复init/current binding和app restart行为读回准确。Focused + Expo Web only（本专项TER边界）；后续DEV data chain按用户批准。
- **阶段出口：** 从CBS terminal API到generated client到TDC transport公开command到store-basic actor/source state闭环，无手写URL/operation字符串；`topic-changed` 至少由具名 `store-basic` actor消费，失败与接受各自保持本consumer独立，其他feature的订退不受影响。

### CP-06 · `terminal-control` 在线远程执行与结果回传

- **现成能力/RECALL：** CBS module public commands/owner persistence/audit patterns；TDS current session authority；TDC remote actor/path；TER Runtime按已注册command name dispatch；Runtime execution selectors提供本机过程观察但不是持久history。
- **实现形态：** CBS terminal-control仅为具名能力，调用者是同CBS内部业务module；无HTTP admin page、permission product或script upload。invoke在CBS事务内校验operation身份及当前有效binding/session，持久化意图与目标TDS节点；session不存在则同步持久化typed offline refusal，不留下稍后待执行项。事务提交时NOTIFY目标listener，仅传operation identity。TDS只监听唤醒，按identity经terminal-control owner具名SQL command原子认领/读意图，复核目标节点、session与binding generation后走现有WS；TDS专属DB principal不得直写owner表；重复通知/claim不重复dispatch，claim后故障保留UNKNOWN且禁止自动重派。首次intent INSERT失败同步typed拒绝且绝不NOTIFY/dispatch；已有结果UPDATE失败不ACK，CBS读取只展示最后已提交状态；读库失败返回typed unavailable，不声称能把新失败记录写入同一不可用DB。TDC在持久化slice的单一普通JSON对象map（`Record<string, RemoteOperationFact>`）中以`remoteOperationId`为键保存未释放操作，包含binding identity、wire requestId、Runtime local requestId及当前事实；阶段推进更新同一项，不另建关联表/队列。本地actor实际result/error进入Runtime有限handoff；peer实际actor result/error先沿现有Topology `command-request`→`command-result` wire→peer gateway回到Runtime，requestId/commandId不变，再进入同一handoff。TDC在dispatch前按精确local requestId注册observer；root timeout后的peer cancel不得抑制这个已登记request的迟到实际结果。Runtime先将实际结果交给有界request-scoped handoff，再发不含payload的diagnostic journal；TDC持久化后释放observer/槽，expiry仍为UNKNOWN且不重派。运行结果和阶段ACK仅更新仍存在且operation/binding/server-config/wire/local request身份全匹配的原map项；server-config变更/root reset在清map前根据map及reset input的`previousState`释放observer，清理后晚到result/ACK丢弃，不得重建旧项。普通同配置断线重连保留map。TDS经owner SQL command原子写实际执行事实，commit成功后才经WS确认TDC；CBS不收结果通知，由调用方主动查询。started ACK更新原map项；终态result ACK持久成功后删除；ACK写失败保留原项。TDC map最多64项，只限项数无字节配额；CBS已提交历史永久保留。无轮询、离线queue、通用outbox/MQ或CBS↔TDS HTTP/OpenAPI。
- **如何验证：** helloWorld执行且实际业务数据字段全不变；duplicate operation在有效关联期只执行一次；offline不入队；send后断线保持UNKNOWN；root timeout后分别让local actor完成、让peer actor通过真实transfer callback完成，验证Topology command-result携带actor result/error、gateway恢复`CommandDispatchResult.actorResults`、Runtime在diagnostic journal之前将实际结果交给精确local requestId handoff；TDC仅更新仍存在且operation/binding/wire/local request身份全匹配的原map项，成功持久化后释放observer/handoff且不redispatch。config change/root reset先清map再释放迟到local/peer结果，map不得复活；同配置普通断线重连保留。结果已存而ACK丢失时重报同identity、CBS一条record、Runtime invocation count=1；started ACK更新原map项，65次完整终态ACK后map为空，重复ACK no-op；TDC存储失败不dispatch；CBS首次INSERT失败不dispatch、已有UPDATE失败不ACK、读失败typed unavailable；乱序result不回退terminal-control已推进记录。Focused+backend acceptance+受管DEV，均未来授权后。
- **FORBID：** 通用ledger/恢复框架、离线命令、blind retries、永久exactly-once承诺、手工任意dispatch输入。


## 4. §11a 对应场景清单

逐项场景id、判据、owner test位置、fixture、业务oracle、执行面以详设 §11 和 §11a 为唯一分母。本计划必须产生的结果表复用完全相同的 24 条 V 与16条 DEV-DATA行；不删除、合并或重新编号。所有初始状态 `NOT_RUN`。本计划TER执行面落Dexter专项裁决：Expo Web only；Android/VM/device不计划，adapter `NOT_COVERED`。CBS backend-acceptance/DEV场景仍为计划值，不虚报已授权已跑。

## 5. 六步控制与失败处置

1. **冻结设计输入：** 复核需求、详设§0/§12、契约、owner源码、六维记忆命中与第三方实际版本；技术/产品OPEN逐项列明并等待有权人，不写推测结论。普通`--validate-only`基线要记录其真实首fail，不叫绿基线。
2. **静态源/生成闭环：** 先实现CP-01生成链和所有root escape red proof；检查canonical输入清单逐项映射入口/mode/red fixture；真实写端点不承担TDS owner task query。CP-05完成前，普通`--validate-only`可以按当前字节真实停在`openapi-contracts`预算投影缺项处，不得标为绿基线；对预算无关门使用现有`V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY`证明，对预算相关红例标`DEFERRED_UNTIL_CP05`（该词仅为状态，不是CLI参数）。CP-05只做本阶段focused proof，不跑`--operation all --calibration`。CP-01～06全部MATCHED并完成全批6b后，才按现有`backend-acceptance --operation all --calibration`分别提供`V2S_BACKEND_ACCEPTANCE_BATCH_CARDINALITY=1|20|100`；该命令会执行全目录业务场景，不是预算专用focused门。保存三份报告并据其实测值更新投影，再补证预算相关红例，随后跑普通`--validate-only`与默认`scripts/verify`。具体入口与当前字节在执行时重读。
3. **CBS写source：** CP-02按照§4.1b逐entry绑定，真实owner time/cache事务/rollback与migration focused proof完成并CP三维MATCHED。
4. **TDS/TDC/feature/remote：** CP-03、04、05、06依序推进，每CP自身全闭合后独立三维MATCHED。CP-03/06按详设§1、§5.1a、§6、§12及Dexter 2026-10-04裁决采用PostgreSQL-only投递和terminal-control owner DB command，不采用CBS↔TDS HTTP/OpenAPI。CP-03由受管bootstrap分别创建/提供独立TDS数据库principal：DEV与backend-acceptance均配置认证事实列级SELECT、TDS自有session sequence/table权限、两张snapshot SELECT及CP-02 raw-time函数EXECUTE；正向证明这些允许的读取/写入成功，反向证明未授权owner写操作与terminal-control记录表直接读写失败。CP-03不授予也不要求尚未由CP-06创建的terminal-control函数EXECUTE。CP-06建立其具名函数后再添加、验证对应EXECUTE，仍不授予owner表直接权限。两处均单独注入TDS用户名/密码，不回落CBS凭证。CP-06覆盖首次意图写失败不dispatch、既有结果写失败不ACK、读失败typed unavailable、Topology真实command-result携带实际actor result/error并经peer gateway恢复、requestId/commandId保持关联、Runtime精确requestId late handoff、本地/peer root timeout、以有效`requestMaxResidenceMs`（默认7,200,000ms）界定双方观察关联、config/reset清map后的迟到结果/ACK丢弃、完整wire超界返回`TOPOLOGY_CODEC_FAILED`且不截断或伪成功、接收的actor结果违反闭集时返回error/空结果并保持UNKNOWN，以及单map项ACK更新/终态删除。测试script只加入已需的固定能力，不新建通用registry。
5. **全批门：** CP-01～06 MATCHED后单独做全批6b MATCHED。此后才开始批次级整体验收：依详设§11a逐行跑适用的backend-acceptance/真实TDS WebSocket、真实DEV数据链及TER Expo Web；逐条报告CONTRACT/BUSINESS与cleanup，保留首败并按failure family规则处理。TER adapter与真实双设备为NOT_COVERED，不冒充通过。
6. **逐代码与详设对账及交付：** 最终fresh只读子agent非抽样对照每个生产符号、consumer、canonical producer/generated artifact、测试与本详设§13c；逐项只写MATCHED/OPEN。OPEN修复后仅补受影响proof/对账；全MATCHED后准备review handoff。最终reset/seed非本专项默认步骤。

### 首次整体运行的限定

第一动态场景只挑一条single scenario，并先确认manifest资源身份、真实后端/TDS拓扑、DB/HTTP/WS可达、Node/Expo Web入口、日志与受控cleanup，不以脚本快照代替预检。此专项TER验证按当前裁决只在Expo Web，不创建Android/VM受管run。CBS/TDS动态拓扑使用正式受管backend-acceptance/DEV入口，单次一个run。运行中不改源码。

## 6. 验证入口与预计产物

| 层 | 命令/入口（未来具体flag须开工时复核） | 观察 | 当前状态 |
| --- | --- | --- | --- |
| Protocol/codegen | 对应`node scripts/generate/... --check` | canonical改动可生成、stale生成物非零 | NOT_RUN |
| Backend compile/static | CBS root Gradle compile/spotless/static verify | 当前owner依赖无环；generated mapping无漏 | NOT_RUN |
| Owner focused | 相应模块JUnit+Testcontainers/pg fixture | atomic cache/time/transaction/refuse | NOT_RUN |
| TDS contract | backend-acceptance TDS scenario |真实WS subscribe/update/ack/session authority | NOT_RUN |
| TER focused | 每包既有Vitest runner | TDC/store-basic/runtime命令和persist/readback | NOT_RUN |
| TER Expo Web | project managed Expo Web入口；先当时确认owner与资源 | 本专项非adapter页面输入输出、business selector真实绑定 | NOT_RUN；专项唯一TER动态面 |
| DEV-DATA | 受管DEV runner + 管理后台真实mutation | owner before/after + notification + HTTP + selector+persist | NOT_RUN |
| Cleanup | 对应manifest-owned stop/runner cleanup | 所有临时受管资源释放，业务/cleanup分列 | NOT_RUN |

不执行Android/VM/真机，不运行任何范围外UT/Browser L2。动态验收已获本专项范围授权；运行前仍须满足计划中的受管拓扑、资源身份、CP/6b与cleanup准入。

## 7. 修改范围与全链同步

预期实施修改只包括：protocol canonical/generator/TDS/TDC generated闭环；CBS organization/store-contract owner timestamp/cache/hooks/read paths/R-11.1 migration；TDS/TDC protocol/session actor/commands/selectors；一个store-basic feature；terminal-control owner/module API/schema/read API；有具名业务consumer的integration composition；backend-acceptance/TER focused和Expo Web scenario；必要静态门与日志；seed/fixture中同一REGION引用。详细目标在各CP RECALL重开后按当前代码搜全，不按此预测文件清单机械创建。

`scripts/test/ter-terminal-interaction-android.mjs` 仍是上一TER专项详设/计划明确的未交付源码义务；本TDP任务不实现它、不运行Android，且不声称上一专项完整交付。若后续要撤销该义务，单独走原专项决策。

## 8. 变更前/后对账

实现前用同一source manifest和owner命令全集做 `rg`/生成器目录盘点；CP阶段和全批对账详设§13b。focused proof不替代三维对账。测试全量前，报告全部CP与批次级6b各自状态；交付前执行计划第5步逐代码与详设对账，fresh reviewer出具非抽样结果，仅`MATCHED/OPEN`。每份运行记录含当前source bytes/run id/timestamp/command/raw transcript/hash/业务结果/cleanup；历史run仅保留原字节证据。

## 9. 风险与未决决定

1. R-15旧binding执行事实按原身份保留且仅原binding有效时补报；CBS历史永久保留。TDC在持久化slice的单一`remoteOperations` map中最多保留64个尚未释放的operation项；只限制map项数，不设缓存字节容量上限。阶段推进更新原项，终态ACK持久成功后删除该项；普通断线重连保留map，server-config改变或root reset清理。WebSocket消息仍遵守65,536 bytes协议边界。CBS不设应用层条数上限；CP-06分别证明65项计数拒绝、终态ACK释放、ACK写失败保留、首次CBS intent INSERT失败不dispatch、既有结果UPDATE失败不ACK、数据库读取失败typed unavailable。
2. 第三方运行/测试实际解析版本与精确tag官方依据在各CP开始时核验；TDS JDBC runtime实际版本未生成解析报告，不标PASS。
3. 上一TER Android runner缺项仍OPEN，TDP不实现、不运行、不声称TER专项完整交付。

## 10. 完成定义

本实施计划对未来批次的定义：CP-01～06逐CP完成并MATCHED；之后全批6b MATCHED，再完成批次级整体验收、cleanup、13c与整批review；§11a每行有真实结果，适用性明确；全批6b、资源cleanup、逐代码与详设对账均完成；design gaps与产品决策关闭。当前文档阶段不产出上述实现PASS。后续任务需要独立实施授权；本计划不是源码实施许可。

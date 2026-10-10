---
title: TER 应用内远程控制 implementation-facing 详设草案
status: DRAFT_FOR_DEXTER_CLAUDE_REVIEW
---
# TER 应用内远程控制详设

## 0. 元数据、当前字节与授权
BUSINESS_SOURCE=doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md；JOURNEY_REFS=doc/decisions/2026-10-10-ter-remote-control-journey-claude.md；IA_REF=doc/decisions/2026-10-10-ter-remote-control-ia-claude.md；INTERACTION_REF=doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md；SOURCE_APPENDIX=doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md。
SKILL_USED=cs-spec-to-plan,cs-writing-plans,cs-review；AUTHORIZED=本包文档与独立静态审查；IMPLEMENTATION_AUTHORITY=false。
NOT_AUTHORIZED=源码、规范、需求修改、依赖安装/生成、编译/测试/verify、DEV、reset/seed、Web/Android/设备、L2/UAT/部署。
这是遵照Dexter完整设计包指派产出的可评审草案。DEXTER_WIREFRAME_REVIEW=UNSET；T-01～T-04 OPEN。不冻结未经原生proof确认的具体供应商桥接API，不把该草案或GO_WITH_UNVERIFIED_UI变成实施授权。
阶段C仍在并发实施，不改它的文件，也不把读到的中间源码当最终出口。实施CP-01必须重开其最终字节；不恢复旧MASTER逐次grant中转、不让SLAVE连TDS。

## 1. 真实目标与方案比较
### 1.1 结构性问题
项目管理员只能查终端记录，无法看到现场应用正在显示什么，更不能通过原业务控件帮助操作。仅增加一个视频播放器、或只让后台直接发业务command，都不能解决“看到并正常操作”的任务。
### 1.2 比较
| 方案 | 结果 | 结论 |
| --- | --- | --- |
| 系统远程桌面/Accessibility/MediaProjection | 可控系统面，需要额外授权并扩大范围 | 拒绝；与应用内、终端无感不一致 |
| 生产化automation-agent或直接查React callback/onPress | 把调试机制变成业务入口，可能绕过原手势/控件 | 拒绝；agent只作验收观察与本地操作，不是远控实现 |
| LiveKit媒体与DataChannel，自有Window采样+正常MotionEvent | 复用成熟传输/编码，最小新增采样与输入接缝 | 采用；必须先证明真实SDK桥、双Window与输入 |
我选了第三种而不是前两种，因为它保持原业务owner和原控件链，新增成本只用于看画面、运送单指输入和结束清理。无新MQ/outbox、媒体业务库、token库、通用恢复框架或持久触摸流水。

## 2. CP总览
| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-01 | 来源准入、兼容/有限可行性、公共契约 | 主agent、ports/adapter/contract owner | 阶段C最终读回，精确依赖图，T前置最小proof与契约 | UI确认、后续实施授权、实际部署输入 |
| CP-02 | CBS独占、在线查询、认证与标准审计 | terminal-control，显式read edge | 六operation、session表、权限、集合online读面 | CP-01 MATCHED |
| CP-03 | TER owner、Android接缝、peer与composition | remote-control/adapter/TDC/topology | 一套生命周期、双屏轨道、正常输入 | CP-02 MATCHED；T-01～03关闭 |
| CP-04 | 运营工作区和普通交互 | operations-admin/foundation | 原Tab/Drawer加入口，全屏媒体与pointer | CP-03 MATCHED |
| CP-05 | 受管部署、seed、真实场景脚本 | scripts、automation driver | Compose生命周期、角色fixture、脚本/cleanup | CP-04 MATCHED |
| CP-06 | 整合focused与交付准备 | 主agent | API/包文档、受影响门、场景完整接线 | CP-05 MATCHED |
CP内部focused与最小可行性proof不等于整体验收。全CP退出后单独全批6b→动态前整体准入→整批动态→13c→IMPLEMENTATION review；CP-06不等待整体验收，避免循环。

## 3. 横切机制对照（固定行集）
| 机制 | 现成能力/规范 | 可执行观察 | 无现成时的形态 | 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | WorkspaceCapabilityScopeResolver/现有projectReadSession | 其他PROJECT请求列表/详情/会话均403，无描述泄露 | 服务端解析terminal→store→project | 原page/detail及4运营operation |
| 写授权与grant复核 | resolveGeneratedOperation、TerminalUpdateRuleOwnerService.requireGrant先例 | 撤权后重放request仍拒绝，不发token | remote session owner先requireGrant再幂等 | start/controllerGrant/end，MASTER续约；GET不附写capability |
| 跨owner写与事务 | terminal-control.invokeOnline REQUIRED | start session与operation同事务；拒绝不遗留占用 | 同owner调用，不直接写binding/TDS表 | start/stop，审计 |
| 集合形态与分页 | 原TerminalUpdateReportPersistence.page/cursor | 51终端翻页，online一次SQL join无N+1 | 工作区描述固定1/2屏，不分页 | 原page/detail、readyScreens |
| 缓存失效/刷新 | createRefreshSignal/useRefreshVersion | 结束只刷新当前终端列表/详情，不刷规则 | 会话缓存仅当前内存 | 3交互面 |
| RTK数据读取与加载 | 前端§3-B、现有query client | context改变时旧ready不可发起，新currentData未到禁用 | 保持当前client形态，不另建全局store | list/detail/controller读 |
| 同一事实一个住址 | 前端§3-E | ONLINE只来自PG，媒体状态只在当前会话，不镜像业务slice | CBSsession与TER本机资源非重复业务事实 | 全批 |
| 失败可见/不改原因 | typed problem/前端§3-D | 占用不是离线；cleanup失败独立可见 | 使用需求R-20有限码 | 6HTTP/六Data消息/port |
| owner错误HTTP映射及注册 | edge implementation catalog+error disposition catalog | 逐op输出等于基础errorSet∪augmentation | RemoteControlProblemAdvice集中有限映射 | 6新op+原page/detail |
| 新owner审计三件套 | audit-model AuditEventWriter、audit-read | start/end经标准audit-history回读一次 | 不是新owner；terminal-control补自有audit表/writer/read/entity enum | REMOTE_CONTROL_SESSION start/end |
| 幂等键/重放 | 前端§3-G；既有receipt形态 | 同request同target返回原session；不同target冲突 | 独占unique+request unique，auth先于重放 | start/terminalRegister/end |
| 生成物不得手搓字符串 | canonical/catalog→materialize→codegen | generatedroute/error/cap/DTO与输入一致 | remote数据协议唯一JSON输入 | CBS/TDC/operations/codec |
| 日志/脱敏 | SafeLogger/LoggerPort/受管日志 | 只session/stream/phase/finitecode/count，不记录JWT/触摸payload | 外部SDK调试日志默认关闭或按既有sink脱敏 | CBS/TER/driver/Compose |
| 迁移回填/可逆 | 单Flyway history | 新空session/audit表；旧业务行不伪造ONLINE | 无历史媒体回填；只新增 | CP-02migration |
| 前端共享行为 | useDetailDrawer/AdminDetailActionMenu/useOverlayLock/createAsyncGenerationGuard | 无app-local第二Drawer lifecycle或context lock | 新Modal媒体内容为本域，不泛化foundation | LIST/DETAIL/WORKSPACE |
| 管理后台交互一致性 | frontend-coding-standard §3-K-1..10 | 动作在详情菜单，状态文字、闭合焦点和全屏布局 | 需求R02承载例外，具体线框UNSET | 3screen |
| 候选/下拉源 | N/A：无新增业务选择表单 | 目标取原最新详情，不让用户填ref/endpoint | 禁止猜门店/peer | start目标 |
| 编码名称呈现 | formatNameCode/原terminal标题 | 用门店/终端名称，不把UUID/SDK identity渲染为标题 | 本域原因中文见交互§5 | list/detail/modal |
| 原子组 | foundation-charter §5-C | 两屏任一失败结束整个会话；不留另一屏控制 | 一session固定拓扑，1/2endpoint | 4拓扑 |

第三方实际解析版本与官方依据见附件§2；所有新增依赖未解析，不写resolved PASS。现有服务地址校验已允许http/https/ws/wss，不新增server-config类型体系。

### 3.1 业务弹层生命周期
业务overlay上限=1：原终端详情Drawer与全屏远控Modal、规则/审计等业务Drawer同层互斥。点击远控时先在当前Drawer执行start并显示菜单loading，HTTP拒绝留在Drawer显示原因；成功且当前context/terminal/本次意图仍有效后，调用原详情关闭cleanup（取消detail/history代次、清详情与分页），关闭Drawer，再打开STARTING Modal。remote请求代次与原detail代次分离，不能因该正常关闭丢掉成功start，也不mirror详情slice；过期start成功只结束它自己的session，不打开工作区。
Modal maskClosable=false；初始焦点放标题或关闭按钮，不自动把键盘焦点交给视频。关闭按钮与Esc走同一workspace owner的禁输入/CANCEL/end/Room cleanup；结束只在原Modal呈现ENDED，重新发起也复用该Modal，不开结果或确认弹层。退出后焦点返回当前项目列表的terminalUpdateTestIds.reportOpen(terminalRef)终端名称Button；原行/项目已失效则返回当前终端更新状态Tab查询Button（reportQuerySubmit），若已离开该页交现有router目标页焦点处理，不聚焦已销毁菜单、不自动重开Drawer。复用原useOverlayLock/close生命周期，不新造dirty或overlay stack。

### 3.2 动态测试前的完整链路诊断与两轮源码审查
按Dexter 2026-10-10裁决，唯一规则正文为 `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md` §3 同日补充。实施时先补齐下表日志，再做两轮 `TEST_CHAIN_PREFLIGHT` fresh只读对抗审查，确认低级错误/缺日志已闭合才运行。当前只是日志设计，两轮运行前源码审查均NOT_RUN；本次文档DESIGN R1/R2不计入。
| 实际测试边界 | 日志owner/既有入口与计划source | 必需的有界诊断 | 运行前检查及失败定位 |
| --- | --- | --- | --- |
| 受管入口、资源/fixture与权限前提 | automation runner/managedRun、remoteControlTestSession、browser-l2、r5-livekit-resident；沿原run-scoped日志 | run/phase、owned host/process/container/device identity、fixture符号key、权限角色、准入结果、子步骤关联/耗时 | 配置/串行/显式serial/资源门/激活与PROJECT scope可静态核对；不写账号/activationCode/credential |
| 运营UI→六HTTP与原列表读取 | admin-ui-foundation logger/observed HTTP；remote feature client/session与原page装配 | request/operation/session代次、按钮动作阶段、status/errorCode、旧响应拒收、Drawer关闭与Modal打开/退出 | 明确请求目标、错误合同、testId真实节点、context隔离、焦点；不落raw body/token/pointer |
| CBS auth→owner锁/事务→TDP投递 | platform-foundation correlation/context与安全logger；application operation、remote owner/persistence/LiveKit adapter | 授权/资格结果、锁内分支、session transition、目标TDP identity、online_operation关联、提交/签发成功失败与耗时 | 正常、拒绝、重放、占用、未知结果和依赖不可用可区分；audit不能替代日志 |
| TDS/TDC→remote actor/peer→Android port | 原TDS logger/TDC LoggerPort、remote actor、topology既有logger、adapter SDK事件到安全sink | command/request/session/endpoint/stream、MASTER/peer接纳、generated HTTP status、await后代次、Room状态、Window/track建成或释放 | 不复制凭证/不把副机接TDS；迟到事件只操作自身资源；SDK raw调试输出不得直出 |
| 媒体与Data→普通输入→原业务结果 | remote protocol/port、RemoteWindowCapture/RemoteTouchDispatcher；原feature logger；driver selector观察 | 首帧/SCREEN_READY、有限type/seq/关联状态、gesture开始/取消/拒绝/结果、业务request关联和oracle成败 | 无须每帧/每MOVE日志；只汇总计数和失败，native坐标/原payload不落盘；DISPATCHED不当business PASS |
| 全端结束/cleanup与读回 | workspace/actor/port、SDK资源关闭、managed owned cleanup | 禁输入/CANCEL、track/capture/Room/unsubscribe/timer和owned映射的逐类结束结果、CBS ENDED、business与cleanup分别判定 | 首败仍继续必要diagnostic/cleanup；未知资源不删除，释放失败不被退出/ENDED覆盖 |

第一轮沿受管入口→实际UI/HTTP→CBS/PG/TDP→TDC/peer/native→业务oracle→cleanup检查上述全链及fixture。主agent逐条核实最小修复后，新的fresh第二轮核验修复、同根遗漏和诊断充分性；与全CP/6b复核可以共享同字节材料，但不能用设计报告或空日志计划替代源码审查。CP-01 T proof在启动前先完成其有限真实链路的这两轮；完整链路具备后、整体动态前补核新增部分。相关字节未变且已覆盖的部分不重复对账。
首败读实际日志确定first failure/last known good/broken boundary，下一次先验证改变的具体假设，不能反复全量重跑或加timeout/等待。缺口未闭合停动态，不停可继续的源码诊断/修复；不增加第二runner、通用恢复框架或日志平台。

## 3a. L2控件分母与控制面全集
UI_DESIGN_REVIEW=OPEN；TESTID_REVIEW=OPEN；L2_SCRIPT_ADMISSION=BLOCKED。静态动作/节点计划已列，真实UI、binding与focused均NOT_RUN，不能标MATCHED。以下是业务case清单；逐动作九列表、控件roster及精确控制面在本节和附件§4/§4b，是已有模板要求，不建新台账或扫描门。
| case | fixtureRef | actions | 最終断言 |
| --- | --- | --- | --- |
| remote.online | term-front/term-handheld+inactive/offline fixture | 查询、翻页、打开终端详情 | 四态、当前终端身份、原分页/版本查询不变 |
| remote.permission | 同PROJECT有权/只读/另PROJECT账号 | 点击/HTTP伪造scope/重复request | 正确拒绝，未创建token或operation；菜单状态 |
| remote.start | term-front在线、两controller Tab | 真实菜单click→等待所有画面→第二Tab发起 | 首TabACTIVE，第二OCCUPIED；不复用grant |
| remote.input | 明确设备四拓扑和App | 浏览器视频真实pointer点击/拖动/虚拟键盘；本机正常点击 | 原feature selector/request变化；不是直接dispatch原业务command |
| remote.end | 同session | 结束/close/context变更/断一participant | 全屏禁输入、CBSENDED、全端资源释放；手动新session可用 |
逐动作九列表唯一正文为附件§4a（逐行动作、UI source、TestIds、真实节点、binding、focused、独立复核、结论）；交互工件§4.1引用同表，不复制testId值。附件§4b为已点名的完整拟改控制面，CP-01重开的是这份精确清单，而不是到实施期才自行建立分母。static节点字段不能代替未来UI focused/binding证明；实际节点不符先修source/设计，禁止role/text/index/CSS/XPath补缺口。
五组case的执行层分开：remote.online/permission以及start拒绝/STARTING/结束的后台承载在隔离browser L2；ACTIVE实际媒体与remote.input以及端点断开在DEV/device受管父run，复用相同后台动作binding。L2 fixture以真实TDS wire ready形成在线PG事实，不伪造ONLINE；不把该wire fixture说成生产Android捕获。ACTIVE、普通TER控件输入与两屏视频必须由DEV/device真实端点证明，不用虚假Room或状态替代。

## 4. CP退出条件
每CP完成全部工作项、focused及最小proof、逐点前后双读后，fresh子agent对该完整CP做需求/详设IA/项目记忆三维证伪对账，结果MATCHED/OPEN，不给整批GO。OPEN先根因修复再复查同CP，不逐文件另开关。
CP-01的T前置proof只在未来实施授权含有相应原生/媒体受管运行时执行；不能拿编译通过代替双Window/触摸/track proof。输入不满足停该CP，不让后续实现猜替代库/双SDK/MediaProjection。

## 5. Operation、路径与暴露面
六operation的精确path/method/input/output及逐operation errorSetRef∪augmentation、wire code/HTTP/优先级见附件§3/§3a，已在本设计选定，不留到CP-01自行发明。运营3个POST每次复核live写grant，1个GET只核有效session/context、页面/角色PROJECT读取范围、本session发起账号及terminal归属，不调用resolveGeneratedOperation、不附写capability；终端2项由TDC构造credential。原page/detail仅增加顶层connectionStatus/observedAt/evaluatedAt，不新增第二目录或在线查询服务。
现有terminal-control保留通用remote operation事实和投递；新增remote session属同owner。TDS仅运输在线root command，CBS不把视频/输入装进TDP frame。
scope=(workspace_uuid,group_workspace_key,terminal_ref)；project_ref必须由当前store组织关系复核，不由请求正文或client缓存决定。相同credential代表同terminal，但remote会话起点只接受当前有效MASTER的TDP目标。

## 6. Owner与事务
### 6.1 CBS独占与幂等
`TerminalRemoteControlOwnerService.start`为REQUIRED事务：授权grant复核→锁同workspace/terminal（复用AdvisoryLock.acquire(JdbcTemplate,int,UUID)，用具名remote-control namespace）→读current binding/latest PG session→先结束到期旧session→检查同account/requestId重放与target一致→检查活跃占用→insertSTARTING→同事务invokeOnline(startRemoteControlCommand)→标准audit。
requestId由Tab每次手动发起生成规范UUID；网络返回未知时同request重读/重放，不新建第二会话。已结束同request返回原ENDED，不创建Room。不同target复用request返回IDENTITY_CONFLICT；授权变化先于receipt处理。
锁前后的读取保持同事务权威；partial unique index约束活跃STARTING/ACTIVE terminal；unique(workspace,actor_account_ref,request_id)保护Tab重放。数据库now提供startedAt/deadlineAt/leaseExpiresAt。deadline初始30秒；独占不会因数据包重发延长。
Room名`rc_<sessionUUID>`，participantIdentity从endpoint/controllerUUID构造，无PII。Room在SDK第一次connect时创建；start事务不调用外部RoomService，不把HTTP/RPC等待放在DB锁内。签grant使用官方JVM SDK本地签名，key由CBS环境读取。签名/依赖不可用不能返回伪成功。
若invokeOnline拒绝，回滚session/audit，按原因返回；通用operation不能写成已成功执行。command完成仅表示STARTING接纳，不等于ACTIVE。
### 6.2 登记、续约、结束
register认证绑定与stored启动node/session/sequence仍是当前PG事实；description只第一次写入，重复等值返回，内容冲突拒绝。冻结topology→endpoint/slot与peerIdentity；CBS不生成新slave业务终端。MAX endpoints=2/screens=2来自四拓扑，不是业务数量配额。
report/renew：锁session，先有效credential/binding和当前PG启动身份及actor权限复核；expired/ENDED拒绝续约，不能复活；ACTIVE要求所需screen恰好齐、endpoint归属正确。ready集合变化只更新现存stream，不能换endpoint/peer。STARTING不能把初始期限重设30s；ACTIVE租约更新为now+30s。ENDED同事实幂等，第一次才audit。
运营end先事务writeENDED+audit/release，after-return调用现有online stop与官方RoomService.removeParticipant/DeleteRoom做有限best-effort清理；外部RPC失败写脱敏诊断，不回滚已结束业务事实。end owner返回需清理的本session公开descriptor给application orchestration，不另建outbox/重试队列。
GET只读：发现租约到期时按已有deadline导出公开ENDED/LEASE_EXPIRED，endedAt取leaseExpiresAt，不更新session、不写audit、不发stop。仅新start/report/end的写事务持久化过期结束并按幂等规则写一次审计，不建扫描器。撤销写capability后，只要原session/context/页面与PROJECT读scope及发起账号仍有效，仍可GET观察本次结束事实；grant/续约仍拒绝，不能继续控制。仅HTTP/房间kick不能证明SLAVE已停；MASTER退出、pair/liveness和SLAVE本机watchdog保证有限结束，原生cleanup另报。
### 6.3 列表连接事实
在现有TerminalUpdateReportPersistence.page/detail显式task join active binding+terminal_connection.latest_state。只有当前绑定对应device与generation能确认PGsession时才ONLINE；冲突UNCONFIRMED，无binding NOT_ACTIVATED，无current未断session OFFLINE。node/seq不返回UI。page每item和detail顶层均追加`connectionStatus: NOT_ACTIVATED|OFFLINE|UNCONFIRMED|ONLINE`、`observedAt: canonical timestamp|null`、`evaluatedAt: canonical timestamp`，不另包connection对象或使用connection.state别名；schema→edge→generated→UI/fixture逐层同形。
不新增heartbeat权威行、不通过Doris判断ONLINE、不按“多久没ping”另加应用公式。远端进程刚崩时旧PG可能暂时ONLINE，点击时仍30s内失败；该事实及时间字段供用户理解。不能逐终端调用owner来制造N+1。

## 7. 声明→传递→消费矩阵
| 事实/机制 | 声明 | 传递 | 消费与反例 |
| --- | --- | --- | --- |
| HTTP权限 | admin-catalog+IAM manifest+edge catalog | generated requirement→application grant | CBS owner先于replay；撤权后不能领token |
| POST身份 | frozen session target | TDP envelope node/session/sequence，root参数sessionId/bindingGeneration/targetSessionId | TER复核本机MASTER+当前TDC selector，不接受caller自封角色 |
| token | register/controller grant短期响应 | TDC request ledger/现有peer参数 | adapter私有Room输入；root result/公开slice/持久operation均不含token |
| screen | description slots+endpoint | SCREEN_READY stream/track/pixel | browser绑定实际SDKsender/track并按slot渲染，不按到达顺序 |
| pointer | canonical sixmessages | 点名endpoint LiveKit data | remote actor校验→port→原控件→原业务command，不直调用onPress |
| 配置 | server-config livekit地址/revision | composition provider注入port | TER只消费provider；HTTPgrant没有TER URL，不能用CBS前缀拼信令 |
| 集合 | 原page cursor/limit | 原generated DTO追加connection | 保持服务端分页，无客户端slice/N+1 |
| 授权执行点 | 3运营POST generated+ownerrequireGrant；GET原projectReadSession | application server-resolved PROJECT；GET本session发起者与terminal归属 | POST重新核写grant；GET只读scope，不附capability；终端credential仍复核stored会话 |
| 缓存失效 | 当前session/context代次 | async guard/refresh signal | 旧HTTP不打开新工作区，end不刷ruleTab |
| 错误 | canonical有限problem和protocolreason | advice/generated/adapter typed result | 原原因中文，不把CAPTURE_FAILED改离线 |
| 日志 | IDs/phase/reason/count | SafeLogger/LoggerPort/managed sink | JWT、credential、触摸原文、rawSDK错误不落盘 |

## 8. TER规则、command与adapter
### 8.0 正式R-01～R-20逐条owner判定点
| 正式规则 | 唯一判定/实现落点 | 场景判据 |
| --- | --- | --- |
| R-01 | 原ReportPersistence.page/detail当前binding+PG集合join；顶层connectionStatus | V-01 |
| R-02 | operations原Tab/Drawer装配＋remote feature工作区；foundation动作/overlay | V-02/03/14 |
| R-03 | CBS实时PROJECT写grant、GET原read scope；TER无新增UI | V-02/12 |
| R-04 | terminal-control/remote actor/TDC/ports/Window/composition按§8.1分工 | V-03/13 |
| R-05 | CBSsession/audit持久化；TERephemeral isolated，reload不join | V-12/15 |
| R-06 | CBSstart事务锁/partial unique/请求幂等/current PGtarget | V-02/03 |
| R-07 | 附件§3六HTTP、TDC两具名POST、GET无token | V-02/03/11/13 |
| R-08 | TDP既有root command及精准peer join/stop；快速STARTING | V-03/06/12 |
| R-09 | CBS STARTING→registration→grant→所有轨道ready→ACTIVE | V-03/11 |
| R-10 | topology/display selectors→冻结description→adapter当前Window | V-04/05/06 |
| R-11 | 原Window owner窄接口→PixelCopy→唯一RN SDK track桥 | V-05/08/14 |
| R-12 | native normal MotionEvent/local冲突CANCEL；不调callback | V-04/09 |
| R-13 | 新canonical六消息输入→两端TScodec，4096bytes及seq | V-10 |
| R-14 | endpoint首帧/mapping声明＋browser实际track可见；几何失效 | V-03/08 |
| R-15 | pointer归一/目标/gesture/队列/边界结果，port原触摸 | V-04/09/10 |
| R-16 | SDK事实＋KEEPALIVE/KEEPALIVE_ACK/watchdog，不自动恢复 | V-07/11/12 |
| R-17 | CBS30slease＋MASTER保守本地deadline＋各端有限cleanup | V-07/12/15 |
| R-18 | server-config具名livekit provider；配置变化结束 | V-13 |
| R-19 | adapter/frontend SDK与受管官方Compose，CP01版本/原生proof | V-05/15 |
| R-20 | canonical状态/reason＋UI§5中文，资源释放事实独立 | V-10/11/12 |
正式需求共20项、无空号；编号只在doc/场景元数据，不进入生产目录/类名。

### 8.1 精确package职责
`kernel/base/remote-control`拥有本业务command/actor/ephemeral slice/selectors。它只依赖base runtime/contracts/platform-ports/TDC/topology/display-context；不依赖ui、React、LiveKit/WebRTC或组织feature。
`adapter/android/remote`依赖官方RN LiveKit与native WebRTC桥；TS管理唯一SDKRoom，Kotlin只管Window/帧/正常触摸。不能另外引入Android LiveKitRoom形成两个Room；不能手写编码器。`platform-ports`只value-type协议，不带SDK/Window/React类型。
原`dual-screen`仍唯一Window登记owner，必须增加窄public native借用接缝：按PRIMARY/SECONDARY与当前windowIdentity取当前Window、输入入口及生命周期订阅；不复制registry、不直接访问private map。Activity与Presentation各自正常dispatchTouchEvent。窗口移除不能因缓存snapshot仍在就继续触摸。
application/base、两个integration只装配remote模块/provider/ports和生命周期signal，不能写租约、输入、JWT或业务路由逻辑。
### 8.2 公共command/selector与私有事件
| 名称（计划新增） | caller/target | actor动作与result |
| --- | --- | --- |
| startRemoteControlCommand | CBS经TDP，local MASTER | 验证启动目标→TDC register request→本端port begin→paired精准peer join；快速返回{sessionId,status:'STARTING',reason:null}，不等待CBSACTIVE |
| joinRemoteControlCommand | MASTER现有target:'peer'→SLAVE | 当前accepted MASTER/同App/pair连接/secondary归属复核→本端begin；只返回公开STARTING不回传grant |
| stopRemoteControlCommand | CBS/root及MASTERpeer/end lifecycle | 仅同session，STOPPING立即拒绝新输入→清理；旧stop不影响新session |
| remoteControlPortEventCommand | adapter subscription→local owner；private | carry session/eventSequence/window generation，媒体/data/liveness事实只进入owneractor；不另用事件总线 |
| remoteControlTickCommand | 当前actor定时器→local；private | 当前session租约/watchdog/gesture检查，destroy清timer，不复用TDPheartbeat作媒体租约 |
| selectRemoteControlStatus | UI/automation readonly | sessionId、phase、topologyKind、screen公开摘要、error/cleanup，无token/SDKhandle |
| selectRemoteControlScreen | 按main/secondary查询 | streamId/trackSid/publishedSize/ready与归属；非当前返回null |
TDC计划新增registerTerminalRemoteControlCommand与reportTerminalRemoteControlCommand，分别调用新增两个generated terminal POST；复用credential/transport HTTP构造和typed status，**不能用只支持terminalRead*的readTerminalDataCommand硬塞POST**。认证失败不在remote owner重造秘密。
root参数/结果固定需求R08；peerjoin{description,grant}按需求，token只在普通非持久request结果和当前adapter闭包。需要await peer接纳但有界于剩余启动期限，不等待媒体；错误/超时结束整个session。终止时不要求成功HTTP才能本机停。
### 8.3 状态与异步提交
CBS/TER状态和原因完整闭集只取需求R20及canonical；TERslice={sessionId,phase,description,screens,lastError,cleanup}，persistIntent=never/syncIntent=isolated，reset清空；token、Room、track、Window和timer在adapter/actor私有资源中。
一个当前session代次贯穿HTTP、SDKevent、peer、timer。每次await后重读当前session+role+binding+connection+配置revision；旧结果只清它自己的资源，不能提交或停止新session。STARTING重复同session等值幂等；不同session在旧资源cleanup未完成时返回NOT_READY，不抹掉释放失败。rootreset/reload/dispose先调用port.stop并聚合unsubscribe/leave/capture/CANCEL失败，不能静默吞错。
paired SLAVE仅校验currentpair和本session，不有独立CBSlease/renew；不连接TDS。MASTER TDP/binding失效、角色/peer/moduleName/配对连接改变即本地停止并peerstop；迟到join必须复核当前accepted连接，不以nodeId相同代替连接身份。
### 8.4 RemoteControlPort形状（value-only，CP-01最小proof后冻结）
port提供`subscribeEvents(listener):unsubscribe`、`begin({sessionId,description,grant,localScreens}):PortResult<STARTING>`、`sendData({sessionId,destinationIdentities,payload})`、`dispatchPointer({sessionId,screen,streamId,gestureId,phase,u?,v?})`、`end({sessionId}):PortResult<cleanupFacts>`。必须逐能力descriptor；生产Web提供unavailable。测试enabled Web仅注入typed fixture，与真实Android形状相同，不把fixture编入production。
adapter事件是connected/disconnected/screen-ready/data/geometry-changed/capture-failed/local-input-conflict/cleanup-failed有限union；仅owneractor处理它，调用方不可注册任意业务callback。SDK/data handler先做4096bytes边界和JSON判别再command，不把全帧或Bitmap过JS。
命令与资源操作都是请求式PortResult，未注入时明确UNAVAILABLE，不返回假成功。definition完整publicexports/static registrations与既有ports形态同批同步。
### 8.5 Capture与正常输入
四拓扑Window映射按需求R10：mobile/laptop single PRIMARY→main；同机PRIMARY→main、SECONDARY Presentation→secondary；paired MASTER PRIMARY→main，SLAVE PRIMARY→secondary（不把SLAVE的SECONDARY作为视频来源）。
PixelCopy真实Window，以各Window实际physical几何归一到视频帧；最长边1280、初始15fps、同时最多1个in-flight copy/有界复用buffer，慢帧丢弃。SDK现有WebRTC VideoSource/frame接口负责编码，bitmap→I420/track桥具体native方法须T01通过后写入附件，不凭master分支猜可调用方法。没有可复用安全桥则停CP，不改成双SDK/MediaProjection/私有反射。
React业务、admin、ui/base/input虚拟键盘必须实测同Window；系统安装/设置与其他App不在范围。自有独立Dialog/Popup/Surface清单CP01读取，普通必测界面无法覆盖不能以UNSUPPORTED_SURFACE豁免；额外系统面仅禁该面输入并提示。
同一Window原触摸dispatcher处理MotionEvent，native仅保留当前remote gesture downTime、pointerId及stream。本地触摸到来先CANCEL冲突remote，再让本地正常dispatch，不拦本地；远端DOWN与正在本地gesture冲突拒INPUT_CONFLICT，避免混成多指。Session/end/geometrychange保障CANCEL。
### 8.6 协议、队列与图像映射
协议唯一输入计划`contracts/protocol/terminal-remote-control-protocol.json`，逐字段完全取需求R13～R16；新generator产TS（backend没有逐触摸协议消费者，不造Javacodec）。两端消费同一生成类型/闭集，校验与handle由本域纯函数实现，不造通用协议平台。
六类型、全session per-sender seq、4096UTF8bytes、duplicate/foreign处理、手势10s、边界回执3s、move30/s与队列64均按需求；map只保留当前endpoint最新seq/currentgesture/probe当前前一个，非历史日志。每类direction/destination/身份校验与自动CANCEL关联详见附件§3b。
SCREEN_READY只有native当前mapping可用且首帧轨道已准备才发；browser实际track可见+描述全部slot齐才开输入。endpoint收到KEEPALIVE用新seq重发当前SCREEN_READY，覆盖浏览器晚加入；不额外CONTROL_OPEN/READY握手。几何变更即时失效旧stream、CANCEL，重建本地map与首帧后发新stream声明；MASTER已知任一不ready则不续CBSlease。
浏览器用VideoTrack实际video contentRect计算u/v，object-fit黑边无DOWN；pointercapture并离开有效画面CANCEL；move合并，不合并down/up/cancel。实际trackSid、SDKsenderidentity、descriptionslot必须同时匹配，输入不能指向屏幕到达顺序。
### 8.7 Watchdog、lease与结束
controller加入即KEEPALIVE，每5s一轮到全部endpoints；15s必要KEEPALIVE_ACK缺失end；endpoint15s无KEEPALIVE end。关联probe取当前/前一个，seq仍全局单调。SDK进入reconnecting/requiredparticipantdisconnected即end，不等SDK自动恢复；ICE内部切换但连接未断不误结束。永久unpublish目标track等同屏断。
MASTER每10s report当前ready，只有控制端存活/各端点ready/当前participant身份成立才续；local deadline=HTTP发出前monotonic t0+remainingLeaseMs（保守，不按收到时重新加30s）；最多一个当前renew请求。逾期先停止本机，再peerstop/Roomleave，无成功HTTP依赖。SLAVE借主机participant/pair信号和自己的KEEPALIVEwatchdog有限停止，不增加第二lease。新start在CBS事务回收expired占用，不靠扫库或token过期。
结束先owner/native禁输入→CANCEL→stopcapture/unpublish→Roomdisconnect→unsubscribe/timer清理→报告CBSENDED；每项资源身份限定session/Window/track。失败聚合cleanup，不以ENDED或退出Modal掩盖。旧调用不删新资源，不回收其他run/别App。

## 9. Owner API与消费者
| owner方法/能力 | 唯一真实caller（计划） |
| --- | --- |
| start/controllerGrant/end | operations application TerminalRemoteControlOperation→OperationsRemoteControlController；browser RemoteControlWorkspace |
| read | OperationsRemoteControlController的GET复用projectReadSession→owner纯task-read，不经写capability resolver；只返回发起者当前scope内本session无token事实 |
| register/report | TerminalRemoteControlController→TerminalRemoteControlOwnerService；TDC两具名commands |
| invokeOnline | start事务与end后stop编排，原TDSclaim/report不变 |
| connection task-read | 原TerminalUpdateReportPersistence.page/detail显式join，不暴露通用跨schema CRUD |
| RemoteControlPort | remoteControlActor；Android factory注入，Web不可用或automation fixture |
| join/stop peer | remoteControlActor→既有Topology gateway→当前SLAVE actor |
零caller新增方法不得落地；不发布“将来可能需要”的任意input/HTTP/grant API。

## 9a. 全链同步清单
| 变更事实 | 契约/唯一生成输入/生成物 | 后端/edge/migration | 前端/TER | 测试 | fixture/seed |
| --- | --- | --- | --- | --- | --- |
| 远控HTTP六能力 | 新remote-control.schemas.json；catalog/placement/error/IAM；materialize→edge-codegen→terminal-client-api | terminal-control owner+两controllers+application grant | generated operationsClient/TDC terminalApi+两具名commands | 每op真实HTTP场景 | 权限seed/activation共享helper |
| 新PROJECT权限 | admin-catalog、iam manifest→generated IAM | resolver/ownergrant、标准auditread | actionCapabilityKeys，不能借版本管理权限 | 无权/错scope/replay撤权 | role-project具名新cap；GROUP_SEED_CAPABILITIES保留原集；r5-seed-plan |
| 顶层连接字段 | 原terminal-update.schemas.json扩page/detail；catalogSHA→generator | 原显式query+edge mapping | 原reportColumns/Drawer | 四态/51条分页/无N+1 | 现有terminalfixtures＋测试状态fixture |
| 六Data消息 | 新terminal-remote-control-protocol.json→新generate脚本→TS | CBS/TDS不消费逐触摸；N/A理由是传输绕过它们 | remote-control codec/operations codec | 边界、方向、seq、geometry | 无持久seed消息 |
| ports/Window接缝 | value-type remote port，无HTTPgenerated | N/A后端无Window | ports bindings/defaults/descriptors、adapter与原dual-screen | native/focused及两屏真实输入 | Webfixture只automation构建 |
| 标准审计 | audit-history entity enum/catalog→generated | owneraudit table/writer/read，audit-read依赖/switch | 标准audit读取能力，非本期新页面 | HTTPauditread | 不seed假session/audit |
| 运行控制面 | §3a全集、profile/run kind、runnerphase | 远端Compose/health/stop cleanup | 最新driver新remotephase/fixture | red unowned resource、首败诊断 | seed父流程/roles/assertions |

## 9b. 精确变更定位
附件§1是create/update/retain清单，所有锚点按当前symbols定位，不拿旧行号作改代码指令。实施写前重开source并确认唯一锚点；列不出的受影响输入不能留给动态猜。

## 10. 数据迁移
新具名Flyway `V20261010_120000_000__terminal_remote_control.sql`（实施前确认命名未占用）仅terminal_control.remote_session和audit_event及session索引。字段见附件§3c；snapshot和token不进DB。现有terminal_control.online_operation保留，Rootstart/stop params/result不含JWT；TDS没有新增表权限需求。旧行无回填，不修改binding/connection事实定义。rollback只允许非生产空新表，不能丢已提交审计；正式回滚需另裁决，不写自动降级migration。

## 10b. Seed与实际执行前提
### 10b.1 受影响文件全集
`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`（权限预期与服务配置fixture声明）；`scripts/dev/owner-command-seed-executor.mjs`；`scripts/dev/r5-seed-plan.mjs`及两者test；`r5-complete-seed-executor.mjs`及test（若增加计数同步expectedCounts/COUNT_KEYS）；两个application package.json serverSpaces新增livekit；对应defaults生成/static test。不改terminal-update-seed工件域数据，不增加另一套终端激活码。
### 10b.2 两类改动
新功能只有PROJECT远控capability、已声明角色授权与服务配置；原term-front/term-handheld按seed key共享，activationCode从契约读，不另存。旧shape未改变不迁移；当前有版本管理权限不自动推远控权，新能力必须显式列在角色计划。
### 10b.3 覆盖
DEV正常使用有权账号与当前项目终端；无权/其他project/inactive/offline/UNCONFIRMED/occupied/leaseexpired等场景用独立acceptance fixture或合法动态动作制造，不seed假ONLINE/假Room。DEV seed具名授权差量见附件§5：只给role-project加入新cap，role-group保留原cap/page且无远控权；正常操作选asg-multi-project，读取无写权选asg-multi-group的同项目可见scope。独立acceptance/L2 fixture另用remote-readonly/remote-controller测试role和不同account，不能把无任职account当只读者；边界在fixture而非更改整个DEV组织状态。
### 10b.4 同步
seed static test验证新能力属于PROJECTscope及同源catalog；完整dry-run后父报告计数和首败原因同步。不得把不存在的新session业务种子凑成COUNTS。
### 10b.5 边界
本轮不执行seed/reset。未来仅明确运行授权可执行；完整seed从reset后空库开始，冲突失败，不做重跑兼容。当前task不授予实施agent自行reset权。
### 10b.6 父流程、身份、网络
owner-command seed使用现有受管workspace会话/权限写入，凭据取既有环境变量，不在文档写值；具体变量名和fixturekey见附件§5。完整seed角色父步骤先于业务fixture；不单起seed绕父流程。
媒体服务未来由r5-livekit-resident受管在同一受信远端非生产host起单实例官方GoLiveKit/所需Caddy或TURN，具体版本/digest/端口来自CP01冻结部署文件。不增加业务deployable，不本地起Java/DB/Doris，不建立PG tunnel。HTTP/TDS沿既有受管tunnel/reverse；RTC需要真实可达地址，不能用adb reverse冒充UDP通路。
双虚拟机沿阶段C最终driver owned adb forward/reverse实现pair控制面；每台explicit serial，主副身份/映射run-owned。未具备两模拟器通路停在CP01，不自造pair runner。

## 11. 验收场景设计
新增 `RemoteControlAcceptanceScenarios.java` 属terminal-control能力组；复用BackendAcceptanceTest生命周期，不把方法堆回入口。每条operation identity与fixture/request/businessOracle见附件§6。
### 11a. 需求逐条判据映射
| 判据 | 场景 | 执行档位 | 所在文件（计划） |
| --- | --- | --- | --- |
| V-01 | remote.online | focused＋backend-acceptance＋ops L2 | RemoteControlAcceptanceScenarios/remoteControlTestSession/ProjectTerminalUpdatePage.test |
| V-02 | remote.permission | backend-acceptance＋ops L2 | 同acceptance＋remote.web.test.ts |
| V-03 | remote.start | focused＋真实Room/DEV | remoteControlActor.test＋remote.web/android |
| V-04 | remote.input.single | Android mobile/laptop-single | remote.android.test.ts |
| V-05 | remote.input.dual | Android真机双屏 | remote.android.test.ts |
| V-06 | remote.input.paired | 两Android虚拟机，同App | remote.android.test.ts |
| V-07 | remote.end.peer | focused＋两VM真实Room | remote.android.test.ts |
| V-08 | remote.geometry | focused＋Android实际Window | native tests＋remote.android.test.ts |
| V-09 | remote.input.conflict | focused＋Android本地和视频输入 | remote.android.test.ts |
| V-10 | remote.protocol | TS/JVM无touchcodec＋两端TS focused | codec.test.ts/browserprotocol.test.ts |
| V-11 | remote.start.failure | focused＋backend-acceptance＋managed DEV | owner/actor tests＋remote suites |
| V-12 | remote.lifecycle | focused＋backend-acceptance＋Android/pair | owner tests＋remote.android.test.ts |
| V-13 | remote.config | focused＋credentialHTTP＋DEV | TDC tests＋remote suites |
| V-14 | remote.surface | Android真机/VM＋browser工作区 | remote.android.test.ts |
| V-15 | remote.deployment | 受管远端LiveKit/网络/cleanup | r5-livekit-resident tests＋remote suites |
执行面不是自动授权；所有NOT_RUN。四拓扑/两App按附件§7的5个设备交叉覆盖run，不要求8个笛卡尔组合、不称未跑组合PASS。Web非adapter行为两个integration先跑，真实PixelCopy/Window触摸为TR16 adapter例外直接device；同一scenario清单表标明共享项与adapter项。

## 12. 未决项与冻结界限
| 项 | 状态 | 本批文档允许 | 实施前禁止/关闭目标 |
| --- | --- | --- | --- |
| 看图 | UNSET | 完整草案/线框提交Dexter | 未确认不冻结UI实现 |
| 阶段C最终出口 | OPEN | 当前source导航 | 重开最终credential/TDC/topology/driver，不能继承中间字节 |
| T01 SDK/bridge/JVM | OPEN | 精确候选与官方source导航 | 实际解析、public frame桥及双track证明后冻结port供应商实现 |
| T02持续捕获/覆盖 | OPEN | Window与普通控件分母 | 首帧不能代替持续两屏/native释放 |
| T03正常输入 | OPEN | MotionEvent接缝与singlepointer | 禁直接callback、Accessibility或第二inputengine替代 |
| T04网络/停止/预算 | OPEN | 官方Compose方向/当前managed形态 | 域名TLS/ICE/TURN、SDK事件、资源budget实测后冻结 |
这些技术项不另立产品方案；失败只报告最小具体缺口交Dexter，不能私自换路线或少测拓扑。没有本轮新增库resolved version，不伪造锁文件结果。

## 13. 停机条件
新的用户操作/新增终端提示、系统输入、不同App配对、额外身份鉴权、轨道桥需反射/双SDK、实际资源cleanup失败、external部署输入不具备，或同scope授权歧义。先主agent重开owner/官方依据找反例，只对产品/范围问题求裁。
所有review finding是待核输入；只有CONFIRMED部分驱动最小修改，比较更小方案，不借review增加恢复或保密机制。

## 13b. 实施三维对账
每实际点前后重开原需求、IA/详设、六维命中全部原文及复用source。CP全部完成后fresh独立三维对账MATCHED再下一CP。全CP退出后再做新的全批6b，不能以CP汇总代替。当前全部NOT_RUN，不建旧receipt/hook/分母控制平台。

## 13c. 逐代码与详设对账
计划显式列出全批所有changed lines、零caller符号、详设点名未产文件的fresh独立对账；仅MATCHED/OPEN。任一OPEN不得交实施结果review；此项在动态收尾后，不替代动态前全批6b。

## 14. 交付检查
六文档逐事实一致，protocol/root/peer边界不越owner，三UI面均具模板字段；独立DESIGN最多两轮，本轮范围是新设计包不是重开需求cycle。GO_WITH_UNVERIFIED_UI只描述静态可接受＋明确OPEN，不承诺技术/运行PASS。

最终作者处置与字节边界见 doc/review/platform/2026-10-10-ter-remote-control-design-review-intake-r2-codex.md。内部R2原始NO-GO保留，后来修订不继承独立verdict；本包仍是技术前置OPEN/看图UNSET的外部评审草案。

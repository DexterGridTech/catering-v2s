---
title: TER 应用内远程控制实施计划
status: IMPLEMENTATION_AUTHORIZED
---
# TER 应用内远程控制实施计划

## 0. 批次与边界
需求=doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md；详设=doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md；附件=doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md；Journey/IA/UI为同日同前缀三份工件。
Dexter 2026-10-11 已授权本计划范围内阶段C R4差量修复与远控CP-01～CP-06实施，包括必要生成/依赖/编译/测试/verify、受管backend-acceptance、DEV、Expo Web、operations-admin L2、受管非生产LiveKit部署及计划内设备验证。此前实现、生成、运行与cleanup均不得由授权本身升级为PASS；按实际证据逐项记录。UI线框已于2026-10-10确认。
范围是应用内看与正常单指操作、独占与释放，两个App四拓扑。只做当前90%常见流程，不新增远控恢复平台、输入历史、系统桌面、通用track框架、加密store或另一套终端目录。
Dexter 2026-10-11 明确本轮 LiveKit 非生产联调只用裸 IP `http://47.106.121.27:7880` / `ws://47.106.121.27:7880`，不配置域名、证书、TLS 或 TURN。信令与 API 使用 HTTP/WS；画面媒体走 LiveKit 自带的直接 WebRTC/UDP 通道，不另加中继服务。此项仅限定本轮运行配置：composition 从 `server-config` 读取当前 LiveKit 地址并传给 adapter，adapter 不硬编码协议限制；配置为 `ws/wss/http/https` 时按当前 LiveKit SDK 行为使用。本轮只验证 HTTP/WS，WSS/TLS、TURN 的运行行为标记 `NOT_COVERED`，不表示 adapter 判其非法。

## 1. 实施进入条件（当前未满足）
1. 三态已由Dexter确认并同步至正式需求R-01/R-02/R-20；三个交互面线框已确认（2026-10-10）。
2. Dexter 2026-10-11 会话明确授权本计划实施及所列动态面；不授权无条件reset/seed、UAT、生产部署、扩大设备矩阵或阶段外工作。
3. 阶段C整批历史 IMPLEMENTATION verdict 保持原 NO-GO；R4 两个差量 finding 已局部修复并完成受影响 focused test/typecheck。根据本次指派，不等待阶段C全矩阵重跑或另一轮外部评审；CP-01重开最终 credential/TDC/topology/driver 来源并复用未受影响证据。
4. 已按 AGENTS→BLUEPRINT→平台README→项目记忆→scriptsREADME→需求/详设/IA/owning source 恢复；附件§1继续按当前真实源码核验。
5. 裸 IP HTTP/WS 的 LiveKit URL、RTC/UDP端口与 API 配置、API≥29 explicit serial及双屏Window身份仍是CP-01需关闭的技术输入；不要求域名或证书，缺失时不得使用本地服务fallback。资源按受管profile与明确身份核验，不按进程名/端口停止未知资源。

## 2. 固定实施节奏与原文双读
主agent唯一写入/运行；子agent只读。每实际变更前重开原需求/IA对应条款、全部六维命中记忆、详设、owning与可复用source；完成该点focused后用同组原文读回实现/证据。每完整CP全部完成才派fresh独立三维对账，任一OPEN修复后复查同CP，MATCHED才下一CP；不把每文件拆成关。
本包附带技术前置的最小受管proof可在CP内先完成，不需要先伪造CP MATCHED；每CP退出必须包含该CP proof。整批L2/设备主流程在全CP及6b之后，避免CP退出依赖整体验收再反向等待CP。

### 2.1 日志先行和两轮动态前源码对抗审查（新增执行前置）
执行规范见observability-and-acceptance-standard §3 2026-10-10补充，日志落点见详设§3.2。任何CP内动态技术proof或整体验收之前，主agent先把该次实际全链日志补齐，再做第一轮fresh源码证伪；确认并最小修复后，由新的fresh第二轮核验同根遗漏、fixture/oracle、身份/参数/时序及cleanup。两轮 `TEST_CHAIN_PREFLIGHT` 与确认项关闭完成后才启动获授权focused动态。本次DESIGN文档审查不算这两轮，当前均NOT_RUN。
CP01只审其SDK依赖与服务准备proof链；CP03审并执行正式TER owner接入后的原生/媒体/浏览器观察/cleanup链；CP02所需HTTP动态先审HTTP链。CP05补整批组合日志，CP06检查新增/改变链路；整体动态前使用同批源码的两轮报告及差量关闭，已覆盖未变部分不重新审两遍。仍需完整CP/6b和UI/testId准入，不因两轮完成跳过它们。
首败先保留并读日志，定位broken boundary、改具体假设、先focused后受影响回归；不以不断重跑替代源码推理，不延长timeout/放宽oracle止血。缺日志或未关闭低级错误禁止按运行键。

## 3. CP-01：来源准入、公共契约、有限技术proof
### 顺序工作项
1. 重新读取需求R01～20/T01～04、当前C出口/设备矩阵，按附件§1及详设§0.1确认接口变化；服务配置呈现已并入admin-shell，不能恢复server-config-panel依赖。确认CBS HTTP不含设备鉴权头、TDS AUTHENTICATE仍有deviceId、共享凭证flush资格及仅MASTER的远控register/report；读回Web与Android的decoded HTTP上界，WS/Data边界保持独立。建立本批完整文件清单、L2控制面、普通React/admin/input窗口分母。
2. 使用当前解析图选择并锁定RN LiveKit、WebRTC、Expo插件、JSclient、React components和JVMSDK；只安装本批需要的库。核对包体/重复WebRTC/native namespace；记录官方精确tag与实际API，不以官网main版本冒充resolved。当前基线版本见附件§2。
3. 复用 `LiveKitServerSdkContractTest` 完成T01服务端SDK的token/grant与RoomService调用focused proof，并锁定resolved dependency/API。应用侧T01 native frame→RN WebRTC track→LiveKit、T02双Window连续捕获及释放、T03正常触摸与本地冲突，移至CP03：当前 `remote-control` 包还没有Runtime module/command，automation-agent只能分发已注册Runtime command，提前加调用路径会形成第二条临时业务实现；CP03实现正式owner/command后，在CP03退出前通过唯一automation入口完成同一事实proof。成功标准与范围不变，仍要求双屏两轨、浏览器可见、原selector改变、点击/滚动/键盘、本地输入冲突及dispose。
4. CP01核对远端配置、解析图及受管资源门；T04真实WS会话、直接WebRTC/UDP媒体、SDK reconnecting/leave、30s租约和释放读回与CP03的正式adapter/actor接线一起完成，并在CP03退出前关闭。本轮只使用裸 `ws://`/HTTP，不配置TURN或验证WSS/TLS。远端服务沿受管resident的明确所有权。`r5-livekit-resident start` 在镜像拉取前、Compose启动前分别读取并记录MemAvailable、HOME与Docker根分区可用空间；两次都要求内存及两个磁盘路径至少保留2,048 MiB。该值是本次受管启动的主机剩余资源门，不是LiveKit容量/SLO；不清Docker镜像缓存。冻结镜像digest、服务配置、预算读数与可验收清理；不把瞬时RSS当长期容量/SLO。
5. 确定value-onlyport/source bridge，填写native/API精确符号与版本出处到附件。按附件§3/§3a已确定的errorSetRef/完整augmentation/状态码与判定顺序新增canonical六HTTP/六Data协议/能力/错误输入，核对权限登记、唯一生成链与所有消费者。只在契约冻结后生成；不手改派生模型。
6. 本CP如需先增加受管proofcase/新run kind/资源profile/health登记，必须同CP完成focused/red及纯读取身份门，不能把资源登记推到CP06。新media service预算单独标明，不把未知进程豁免。
### 退出
T01服务端SDK/API focused proof、实际解析图及官方依据关闭，远端服务配置/资源前置与契约/port输入齐；应用级T01～T04运行proof不在CP01伪造调用路径，必须在CP03正式owner/adapter接入后、CP03退出前关闭。UI/授权/阶段C来源明确。CP-01独立三维MATCHED。动态与设备权限已由本次Dexter指派授予，但这不替代日志、资源、身份及两轮测试链路准入。

## 4. CP-02：CBS owner、online、权限与审计
1. 新增同terminal-control的remote_session/audit表与index；实现固定terminal advisory锁、request幂等、权限复核先于replay、expired回收，session与invokeOnline同REQUIRED事务。签token不在数据库中保存；外部RoomService不得卡事务锁。
2. 实现register/controllerGrant/report/end写能力，以及纯GET read；GET复用projectReadSession，不附写capability，不在GET修改过期session；registration冻结描述1/2endpoint，renew current绑定/PG target/权限/state复核；start只在线投递，失效不补发。end事务提交后的Room kick/stop有限编排，不能为RPC失败回滚ENDED或新增outbox。
3. 同步6operation canonical/error/capability/IAM/placement、r5-edge-materialize credential operation集合、codegen与terminal-client-generation输入；执行catalogSHA→materialize→edge-codegen→terminal-client-api，读回Java/ops/TDC consumers。
4. 原page/detail追加顶层connectionStatus/observedAt/evaluatedAt并显式集合join（同scope当前ACTIVE binding/latest_state关系；仅NOT_ACTIVATED/OFFLINE/ONLINE三态，不查询connection表不存在的device/generation列），保持原enabled项目store/terminal、版本过滤、cursor分页，禁止新heartbeat公式/Doris权威/N+1。
5. 同标准AuditEventWriter写本owner表；audit-read依赖/entity switch/enum读回接线，验证start/end各一次可读，不复用update审计writer。
6. 每个HTTP operation的真实fixture/request/businessOracle实施到RemoteControlAcceptanceScenarios，标准backend acceptance远端生命周期；纯owner/SQL并发focused与业务acceptance区分。断言CBS经TDP投递的start/stop `commandName` 精确匹配TER Runtime注册全名。计数根据实际event链登记generated预算，不为数字省掉业务正确性。
### 必须反例与退出
两并发start只有一占用/operation；重放前撤权拒绝；同request不同target冲突；换binding/PG seq不能register/renew；expired不能复活；重复end只一审计；不同project/账号读不到grant；51终端跨页一次join；失败rollback没有半成session。全CP对账MATCHED。

## 5. CP-03：TER owner、ports、Android与peer
1. 创建base remote-control标准包/command/actor/slice/selectors/公开exports/static registrations；注册ephemeral、isolated并确认为唯一state writer。新增TDC register/report具名command→generated HTTP，复用credential和transport，不允许remote直接建Authorization。
2. platform-ports补remote完整binding/descriptor/unavailable；原dual-screen唯一Registry增加当前Window borrow/input/lifecycle接口；adapter接LiveKit唯一Room、帧/track桥、各屏物理坐标与normal MotionEvent。禁止复制Windowregistry/触摸新业务callback。
3. root start复核当前TDP目标+MASTER角色→register→begin→paired target:peer join；只回公开STARTING，启动媒体不占根command60s。SLAVE验证当前accepted MASTER/同App/连接身份/screen归属，收到grant自己Roomjoin，无TDS/独立renew。
4. 用统一当前session/event代次隔离所有await/subscribe/timer/HTTP/peer回包；旧Session只释放自己资源。server-config livekit provider由composition注入adapter；slice不复制其他owner，配置改变结束不迁移。配对/解绑不保证Runtime重启，必须注册当前role/pair连接/TDC资格的公开selector观察并释放；显式解绑TDC清state→完成command后旧远控已失效。普通断链虽保留credential，也结束远控且只能手工重新发起。focused覆盖同Runtime解绑、迟到join、旧stop不能关闭新session，不借更新候选readiness做远控准入。
5. 实现需求六Data消息全部校验/方向/seq/gesture/results/KEEPALIVE/SCREEN_READY重发。geometrychange本机先失效旧stream并CANCEL→首帧/map→声明，浏览器晚加入无需额外handshake。
6. 输入队列64有界、move30/s合并、边界不重发；本地冲突单gesture CANCEL；MASTERlease/port事件/participant/pair/timer清理闭合。dispose/subscribe失败进入cleanup聚合，并保持session identity。
7. 两App/application/bootstrap只装配，productionWebport unavailable，typed fixture仅automation-enabled Web test。SDKregisterGlobals一次在Android初始化，不写Reactroom业务页面。
### 必须反例与退出
role/取消激活/TDP迟到start；失效pair旧join；同机两屏密度不同；native窗口删除旧snapshot仍在；browser晚加入；oldstream输入；UP迟到命中新gesture；lease HTTP慢响应不能延长deadline；participant断开不自动重连；原生CANCEL/track/Room释放失败可见。CP03实现正式owner/adapter调用链后，通过唯一automation入口完成T-01应用侧桥接/双轨及T-02/T-03/T-04 proof；所有focused proof与授权原生proof完成后全CP对账MATCHED。

## 6. CP-04：运营界面与数据通道
1. 在既有ProjectTerminalUpdatePage右Tab增加连接Tag；终端报告Drawer加AdminDetailActionMenu远控项，不挂规则Drawer；权限取新增CONTROL_PROJECT_TERMINAL，不借用版本管理能力。
2. 按交互§1.4实现overlay上限1：start在原Drawer发送，拒绝留Drawer；成功经current context/intent guard后复用原Drawer关闭cleanup，再打开全屏Modal。Modal关闭/Esc同一路径，焦点归原终端名称，失效时归当前查询按钮；不会保留Drawer叠层或自动重开。新remote-control feature承载Modal/LiveKitroom/video/pointer，引用foundation当前baseApi/observability/overlay/generation能力；原列表只装配callback，不再堆领域代码。
3. start后state最多每2s读取15次、绝对CBS初始30s，不常态轮询；registered后controllerGrant/connect；按冻结description+实际track/stream/sender绑定主副屏，每必要画面实际visible才允许指针。
4. 视频contentRect normalized坐标/blackbar/noDOWN/离开CANCEL、pointercapture、blur、singlegesture全实现；只从真实VideoTrack区域产生输入，DISPATCHED不等业务结果。
5. context/nav/end/close先禁输入并结束；retry手动新request；旧异步响应不创建/关闭后继Room。existingoverlay生命周期仅一个owner，无第二dirty guard。
6. TestId唯一表、有限原因中文和无终端新UI按交互逐面读回；组件focused覆盖有权/无权/三online状态/两slots/窄容器/结束错误。
### 退出
3交互面、六HTTP及protocol调用与表格正文一致；GET按原read scope，三运营POST按写grant；无秘密渲染、无未调用新增API、无手写业务控制旁路，CP04 MATCHED。组件测试不证明视频或原生控制通过。

## 7. CP-05：受管运行、seed和共享场景
1. 按详设§3.2同步全链安全结构化日志及日志读取/首败路径，再准备两轮运行前源码审查；不得等动态失败后才补诊断。single remote LiveKit官方Compose与r5-livekit-resident init/check/start/stop依现有resident形态，manifest记录host/boot/container/digest/网络；不删cache，不碰未知资源。DEV start只additive配置，不seed，stop收本run owned resources。
2. 按附件§5具名角色表更新seed：admin catalog、仅role-project显式新增cap、r5-seed-plan/source static tests、父expectedCounts与首败原因；GROUP_SEED_CAPABILITIES维持原集、不把PROJECT新cap塞进去；业务fixture仍term-front/term-handheld同源activationCode，先REQUIRE_INACTIVE及manifest identity核对。
3. 完整§3a控制面从import和按路径登记两类重开；在现有automation runner新增remote phase/topology/sample/case union、日志诊断与serial/资源owned cleanup；脚本首次业务失败停止后续业务动作，仅继续必要diagnostic/cleanup。
4. 新remoteControlTestSession复用两App同样的operations fixture、真实start菜单与浏览器pointer；TER selector预订阅+baseline关联真实业务结果，不用remote command shortcut。隔离后台L2使用browser-l2 runtime；DEV/设备journey由terminal-automation父run直接通过Playwright创建/回收browser/context，复用附件§4b bindings，只借用受管DEV的Vite/tunnel。browser/context纳入同一父run cleanup，不调用隔离browser-l2生命周期、不另起数据库/TDS栈；不复活tools/terminal-topology和旧TERrunner。
5. paired网络复用阶段C最终androidAutomationConnection.attachTopologyHostForward及owned journal/recovery、现有reverse；两serial明示，新增LiveKit RTC网络不能假定reverse支持UDP；错误端口/未授权container/别run设备cleanup红例应拒绝，不删除其他run资源。主副两端日志各自记录READ或LOG_NOT_AVAILABLE；采集失败单列diagnostics失败，不改business/cleanup事实，也不得被父run成功摘要吞掉。不复制旧update case的payload或另起pair runner。
6. 构造所有§11a适用场景的真实正常/拒绝/断开和cleanup断言，App与四topology矩阵固定为附件§7；日志覆盖浏览器信令WS收发、video readback、ICE/RTP统计、有限 native capture事件和run/session/stream/window/track关联标识。RTC video readback在各屏就绪后、输入操作和结束会话前记录一次；异常message/stack、网络endpoint及ICE候选地址在当前run日志中原样保留并限长。业务结构化日志不写JWT或原始触摸payload；driver采集的Android fatal stack作为独立run-scoped诊断原样保留，详见详设§3.2及观测规范§5。加入日志/fixture/roster静态测试防假绿。新resource profile在调用前完成，不等CP06。
### 退出
脚本source可执行shape且测试断言真实结果，seed静态/dry-run计划同源；资源读回/firstfailure路径齐。CP05 MATCHED，不代表L2/DEV设备主流程已运行。

## 8. CP-06：整合focused与质量准备
1. 运行本批受影响typecheck/lint/unit/native focused、contract生成check/selftest、backend-acceptance选择操作、frontend architecture/TestId/terminal owner/static gates；别扩大到不相关全仓verify。第三方officialtag记录与实际resolved version读回。
2. 同步API README/scriptsREADME/testcase列表，删除proof用临时产品路径（正式同port最小实现保留，无第二HOT/remote方案）；执行同族检查当前新command都有真实caller，协议一输入两消费者，ports所有binding齐。
3. 独立CP06三维MATCHED后，另派fresh对全批范围重新三维6b对账；不是CP结论汇总。任何OPEN先同根修，不进入整体测试。

## 9. 动态前整体准入（未来授权后）
先满足§2.1全链日志和两轮TEST_CHAIN_PREFLIGHT、确认问题关闭，再满足原四项：全CP三维MATCHED；全批6bMATCHED；详设§3a控件/控制面当前字节经过fresh独立L2_SCRIPT_ADMISSION=PASS；任何reset前current-byte完整r5-full seed dry-run PASS。UI/TestId/source generation与当前schema一致；Fixture角色/actor/source/设备身份具名，无本地Java/DB fallback。
所有实际资源启动前核对ownedidentity/budget；Testcontainers若已有identity-matched DEV先按受管stop，business+cleanup PASS再restore原DEV，不能seed。已存在DEV长期服务不被普通profile任意杀。
reset/seed仅在Dexter后续明确授权时按scripts/dev/reset/start/seed独立步骤，不向实施agent默许破坏未知业务数据；若本批使用已合法完整seed可只REQUIRE_INACTIVE，不为跑测试无条件reset。

## 10. 整批验证顺序与明确执行命令
此节是未来实施目标，当前全NOT_RUN。命令已有/计划新增分开，失败不能只改timeout重试。
### 10.1 已有能力与计划新增入口
| 类型 | 命令 | 条件 |
| --- | --- | --- |
| 现有 | scripts/test/backend-acceptance --operation terminalRemoteControlHttpLifecycle | 选择现有 `@AcceptanceScenario` 聚合场景；场景内逐请求使用6个远控 command/report/read operationId，并覆盖版本 page/detail 与审计 read。生成 operationId 是路由身份，不是 runner 的场景选择值；远端受管容器与真实TDS生命周期不变 |
| 现有 | node scripts/generate/r5-edge-materialize.mjs → node scripts/generate/edge-codegen.mjs → node scripts/generate/terminal-client-api.mjs --check/--self-test | 生成正常模式按各script现有CLI核实；表中不是串shell自动执行 |
| 现有 | yarn workspace <本批包name> typecheck；其test/lint脚本 | 精确包name及scripts按package读回；新包复制既有TER骨架规范，不自造runner |
| 计划新增 | scripts/test/terminal-automation.mjs --phase remote --platform web --remote-topology mobile-single --sample console --case remote.main | parser/suite/fixture完成后才可用；wallpaper同清单另run |
| 计划新增 | 同entry --platform android --remote-topology mobile-single --sample <console\|wallpaper> --case remote.main --device-serial <explicitSerial> --device-kind physical | L2前真机smoke；manifest记录同serial的白名单设备属性及分类；console、wallpaper各一次 |
| 计划新增 | 同entry --platform android --remote-topology laptop-dual --sample console --case remote.main --device-serial <explicitSerial> | 真机双屏，当前APK含新增native SDK |
| 计划新增 | 同entry android mobile-single/laptop-single/laptop-paired + sample及explicitSerial；paired加peer-device-serial | 按附件§7的5个交叉覆盖run；全部四拓扑和两App均覆盖，不声称未跑组合PASS |
| 现有＋本批新增 | browser-l2-runtime readiness→same-run P1 activation→本批完整generated-chain check→same-run finalize→run→owned cleanup | 原L2唯一顺序；不能只readiness/run跳过中间；专题fixture/source接线CP05实现 |
### 10.2 流程
1. 远端backend-acceptance：六HTTP及online/audit完整oracle；CONTRACT/BUSINESS/DB info/CLEANUP分开。
2. 非adapter共享remote场景先两个ui/integration Expo Web当前字节通过；typed media fixture只能证明owner/codec/路由，不冒充真实PixelCopy。
3. 按Dexter后续执行顺序调整，Expo Web通过后先用唯一 `terminal-automation` driver 在真机跑 `mobile-single/remote.main`：console和wallpaper各一次，`--device-kind physical` 必须由runner读取所选serial的设备属性并记录到run manifest/log。两次均验证真实连接、远控开始、primary画面可用、远程输入和业务selector结果；这只是V-04 mobile/single-screen smoke，不关闭V-05、L2或整批Android矩阵。
4. 上述真机smoke通过后运行运营后台独立L2，验证实际入口/中文/状态/权限/Modal布局；真实媒体走受管LiveKit。
5. 再用同一场景清单与当前byte进行四topology Android原生主流程：按附件§7：console真机dual、wallpaper mobile VM、console laptop single、console与wallpaper各一组同App双VM pair（5个run）。真实视频输入必须从运营工作区click/drag，经DataChannel→native→原控件，business selector/视图证明结果；本地并用同样要真触摸。明确TR16 adapter例外为PixelCopy/Window input/双VM拓扑主机，非adapter部分不能借例外跳Web。
6. 合并必要失败反例到相应run：任一screen/participant/pair断开、几何变化旧stream、输入冲突、关闭/配置变化与cleanup；不做全组合Chaos平台，不以极端场景拖慢正常交付。
7. 没有实际部署、device或资源proof一律OPEN/NOT_RUN；测到与路线不同，保留firstfailure/lastknown/brokenboundary，再最小修复focused及受影响项，不无理由重跑已通过无影响矩阵。
### 10.3 成功与cleanup
controller/endpoint Room数、capture/track/Window输入订阅/timers、CBS占用ENDED、peerdisconnected、ownedadb mapping与process/container/tunnel分别实际读回。业务PASS不能掩cleanup失败。失败诊断写入当前run日志，原样保留并限长message/stack及网络endpoint/ICE候选地址；业务结构化日志不含JWT/rawpointer。automation采集的Android fatal stack是独立run-scoped原始诊断，按观测规范§5保留，不复制到业务结构化日志；不重启未知资源。

## 11. 逐代码与详设对账（显式交付门）
主agent收拢全部changed lines与正式source，fresh只读子agent逐代码对本详设/附件，检查所有新符号caller、详设点名却缺产物、生成源/派生模型与原需求所有R/V映射。结果仅MATCHED/OPEN，任何OPEN不得交Dexter/Claude实施review。
这是动态之后的13c，不替代动态之前全批6b；已MATCHED且字节不再变化的CP无需重复，对后来影响仅复查真实差量；不把范围无关旧代码重新对账。

## 12. 独立IMPLEMENTATION review与交付
完成目标后fresh独立子agent重开真实代码/用户Journey/evidence形成IMPLEMENTATION GO/NO-GO M/S/N及DESIGN_GAPS；按批准范围与证据档位，不拿“按设计做”豁免合理性。NO-GO已确认项最小修复/受影响focused与差量对账，再freshreview，不扩功能。
向Dexter与Claude提交：本六工件、source changes、逐点读回与CP/6b/13c记录、当前-byte场景结果及business/cleanup、firstfailure与NOT_RUN/OPEN、独立review。交付必须中文可复制话术，静态GO不产生实施授权。当前交付只为设计review，所有实施门未执行。

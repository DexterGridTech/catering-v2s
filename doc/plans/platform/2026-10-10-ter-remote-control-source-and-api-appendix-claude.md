---
title: TER 应用内远程控制 source 与 API 附件
status: DRAFT_FOR_DEXTER_CLAUDE_REVIEW
---
# Source、API、协议与验收附件
本附件被详设/计划引用，不是运行报告。所有新路径均是计划create/update，存在的能力与尚未存在的能力分开。当前阶段C进行中，实施前必须重开最终源码。

## 1. 当前源码与精确变更清单
### 1.1 已读源码事实
| 事实 | 当前source（以symbol定位，不用行号派活） | 本批处置 |
| --- | --- | --- |
| 项目报告表/终端Drawer | operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx#reportColumns/#openVersion | 仅此既有终端Drawer加remote动作，不加到rule Drawer |
| 当前page/detail集合SQL | CBS/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/persistence/TerminalUpdateReportPersistence.java#page/#detail | update显式connection task join；保留项目启用store/terminal和分页 |
| 运营授权 | CBS/modules/workspace-iam/.../WorkspaceCapabilityScopeResolver.java#resolveGeneratedOperation；app/application/terminalupdate/CreateOperationsProjectTerminalUpdateRuleOperation.java#execute | 复用generated requirement/currentContext/actorGrant形态 |
| owner重放前复核 | CBS/modules/terminal-update/.../application/TerminalUpdateRuleOwnerService.java#requireGrant | 新owner方法同形；旧receipt不替代live grant |
| 线上投递 | CBS/modules/terminal-control/.../application/TerminalControlOwnerService.java#invokeOnline；persistence/TerminalControlPersistence.java#readActiveBinding/#readOnlineSession | retain通用队列/claim/report，新增同owner session能力，不新投递平台 |
| TDC HTTP | kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts#createTerminalClientForTransport | 新两具名remote认证command；readTerminalDataCommand仅terminalRead*不可复用为POST |
| request结果 | kernel/base/runtime/src/features/slices/requestLedger.ts | retain非持久isolated ledger，root结果不嵌套grant |
| 精准peer | topology/src/application/createTopologyPeerCommandController.ts#installGateway；selectTopologyFacts | retain现有target:peer运输与关联；remote actor补当前MASTER/pair资格 |
| nativeWindow | adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt#TerminalSurfaceHostRegistry/#TerminalPresentation | update窄public borrowWindow/input/lifecycle接口；不误把captureWindow几何采集当视频 |
| 标准UI | libraries/frontend/admin-ui-foundation/src/index.ts | 原Drawer/list/overlay/generation/logger，不复制foundation |
| runner | tools/terminal-automation/src/runner.ts#parseAutomationRunArguments/#phaseSuite | 新remote phase/scenario源；当前phase并不包含remote，不能把计划命令说成已可运行 |

### 1.2 create/update/retain 文件全集（路径前缀缩写仅用于此表）
CBS=apps/backend/catering-business-server；TER=apps/terminal；JAVA包前缀=com/catering/v2s。
| 类别 | 路径 | 责任/锚点 |
| --- | --- | --- |
| create contract | contracts/openapi-source/terminal-remote-control.schemas.json | 六HTTP DTO与有限error/type闭集 |
| create protocol | contracts/protocol/terminal-remote-control-protocol.json；scripts/generate/terminal-remote-control-protocol.mjs及对应test | 六Data消息唯一输入/TS派生；根内路径验证与红例沿用terminal-connection generator |
| update contract | contracts/catalog/admin-catalog.json；contracts/registry/iam-org-governance-manifest.json；doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json；2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json；2026-07-26-v2s-r5-error-code-disposition-catalog.json | capability/operations/errors/placement/schema SHA；不手改OpenAPI |
| update generating | scripts/generate/r5-edge-materialize.mjs；edge-codegen.mjs；contracts/policy/terminal-client-generation.json；terminal-client-api.mjs及对应selftest | terminal credential POST include集合/shape；派生所有Java/两后台/TDC生成物 |
| update page contract | contracts/openapi-source/terminal-update.schemas.json与catalog输入SHA | connection字段加入现有page/detail |
| create CBS owner | CBS/modules/terminal-control/src/main/java/JAVA/terminalcontrol/api/TerminalRemoteControlOwnerApi.java；application/TerminalRemoteControlOwnerService.java；persistence/TerminalRemoteControlPersistence.java；persistence/TerminalRemoteControlAuditWriter.java；application/TerminalRemoteControlAuditHistoryService.java | session/grant/live授权/readmodel/标准审计，value-only公开API |
| create CBS orchestration | CBS/src/main/java/JAVA/app/application/terminalcontrol/TerminalRemoteControlOperation.java；edge/operations/terminalcontrol/OperationsRemoteControlController.java；edge/terminal/TerminalRemoteControlController.java；edge/terminalcontrol/RemoteControlProblemAdvice.java | sessionContext/ownergrant、HTTP映射、事务后RoomService清理；不把typed-error散各controller |
| create SDK adapter | CBS/modules/terminal-control/src/main/java/JAVA/terminalcontrol/foundations/LiveKitControlAdapter.java；module build.gradle.kts | 官方JVMtoken/RoomService，secret/config仅CBS环境，不自写JWT/RPCclient |
| create migration | CBS/src/main/resources/db/migration/V20261010_120000_000__terminal_remote_control.sql | 仅本owner两表/索引，单Flyway；实施前确认文件名未占用 |
| update audit | CBS/modules/audit-read/build.gradle.kts；OperationsAuditTaskReadService；OperationsAuditHistoryController实体switch；canonical audit-history.paths输入entityType | REMOTE_CONTROL_SESSION标准读取，不借terminal-update审计表 |
| update reads | CBS/modules/terminal-update/.../TerminalUpdateReportPersistence/ReportOwnerApi/ReportOwnerService；CBS/src/main/java/JAVA/app/edge/operations/terminalupdate/OperationsTerminalUpdateReadController.java | 集合显式join并DTO映射，不改历史升级报告意义 |
| create TER base | TER/kernel/base/remote-control/package.json；src/moduleName.ts；src/dependencies.ts；src/index.ts；src/application/createRemoteControlModule.ts；src/features/commands/remoteControlCommands.ts；src/features/actors/remoteControlActor.ts；src/features/slices/remoteControl.ts；src/selectors/selectRemoteControlStatus.ts；src/selectors/selectRemoteControlScreen.ts；src/types/remoteControl.ts；src/foundations/remoteControlProtocol.ts；test/actor.test.ts；test/codec.test.ts | 既有骨架/owner模式；生成protocol放本包generated；无React/SDK依赖 |
| update TDC | TER/kernel/base/terminal-data-client/src/types/client.ts；features/commands/terminalDataClientCommands.ts；features/actors/terminalDataClientActor.ts；application/createTerminalDataClientModule.ts；index.ts；test/terminalDataClientActor.test.ts | 两remote authenticated commands，认证和status原路径；协议cmdcatalog根start/stop可下发集合 |
| update ports | TER/kernel/base/platform-ports/src/types/remote.ts；types/platformPorts.ts；types/result.ts；defaults/unavailableRemote.ts；defaults/createUnavailable.ts；foundations/createPlatformPorts.ts；index.ts；对应tests | remote typed value-only能力、全部bindings/defaults/descriptors，不optional半接线 |
| create Android adapter | TER/adapter/android/remote/package.json；src/index.ts；src/createAndroidRemoteControlPort.ts；android/src/main/java/JAVA/terminal/adapter/android/remote/TerminalRemoteModule.kt；RemoteWindowCapture.kt；RemoteTouchDispatcher.kt；build配置/module声明与tests | TS唯一SDKRoom；Kotlin narrowWindow/frame/input；无第二Room |
| update original native | TER/adapter/android/dual-screen/.../TerminalDualScreenActivityHandler.kt及tests | 窄publicWindow/inputowner接口与删除/几何event，跨adapter变更明确纳入CP03 |
| update composition | TER/ui/base/integration-assembly、ui/base/dev-host Web不可用port、两个ui/integration/*/src/application/module.ts、application/base/android装配与两个application的package.json/app config | 原provider注入；SDK registerGlobals原生bootstrap一次；LiveKit/plugin/fullAPK配置；无业务logic移到integration |
| create operations feature | apps/frontend/operations-admin/src/features/remote-control/api/remoteControlClient.ts；model/remoteControlProtocol.ts；model/remoteControlSession.ts；ui/RemoteControlWorkspace.tsx；ui/RemoteControlVideo.tsx；test/* | 复用baseApi/generatedClient/foundation；DataChannel领域逻辑不能塞原列表巨型组件 |
| update operations | ProjectTerminalUpdatePage.tsx；app/automation/remoteControlTestIds.ts；对应page test；package.json/lock | 原入口仅装配新feature及callback，@livekit/components-react仅该app |
| update managed | scripts/test/terminal-automation.mjs保持唯一入口；tools/terminal-automation/src/runner.ts/managedRun.ts/driver.ts/android*owned cleanup；新remoteControlTestSession.ts/fixtures/remoteControl.ts/journeys/remote.web.test.ts/remote.android.test.ts | 详设§3a完整控制面，新phase非新runner；只按identity回收 |
| create deployment | scripts/dev/livekit/docker-compose.yaml与配置模板；scripts/dev/r5-livekit-resident.mjs及test | 单远端官方部署，宿主网络RTC端口；秘密只环境，不进模板/日志 |
| update resource/docs | scripts/dev/r5-dev-runner.mjs、scripts/env/check-runtime-resource-budget、scripts/README.md、两个package API文档/invariants publicExports | profile明确新resident ownership/kind；不任意豁免其他live树 |
| update seed | 详设§10b所列全部source/tests | 新cap/角色服务配置，不另存activationCode或假session |
| create/extend tests | CBS/modules/terminal-control/src/test/.../TerminalRemoteControlOwnerTest.java与PersistenceTest；CBS/src/test/java/JAVA/app/acceptance/RemoteControlAcceptanceScenarios.java；catalog显式组接线；两TER integration focused；operations component tests | 每正常/拒绝/竞态/清理反例，source命名按能力非Journey编号 |
| retain | TDS生产运输、通用terminal_control.online_operation表、Runtime request/peer ledger、topology业务pair协议、transport通信实现 | 仅需闭合集成测试；不新media TDS消息、不改变业务执行机制；若阶段C最终接口差异，先更新本附件再实施 |
生成物与lock未来由原生成/包管理链派生，不手改；本轮仅描述、不执行。上表逐项新native名字是本批计划能力，不假称现成第三方API。

## 2. 第三方实际解析状态/官方依据
| 坐标 | 当前状态 | 官方来源及已核实行为 | 本批必须proof |
| --- | --- | --- | --- |
| Expo57/RN0.86.3 | 当前TER源码依赖基线，实施CP01再读lock/native实际图 | 仓内package/lock/native host | SDK与双Window装配兼容，不凭peer宽范围断言 |
| @livekit/react-native 3.0.0 | 候选未安装，非resolved | https://github.com/livekit/client-sdk-react-native/tree/@livekit/react-native@3.0.0；package peers需官方WebRTC/JSclient | exact npm解析tag+Expo plugin/nativenamespace，Android build并两track |
| @livekit/components-react 2.9.24 | 候选未安装 | https://github.com/livekit/components-js/tree/@livekit/components-react@2.9.24；VideoTrack按实际trackRef | operations React/JSclient兼容、单/双track真实渲染 |
| livekit-client、@livekit/react-native-webrtc、Expo plugins | 尚未解析；取RN候选peer的相容精确版本 | https://docs.livekit.io/transport/sdk-platforms/expo/ （必须native development build，非ExpoGo） | 不装两套WebRTC；registerGlobals/桥API按对应tag源码确认 |
| io.livekit:livekit-server | 尚未解析，版本不可取main当已解析 | https://github.com/livekit/server-sdk-kotlin；官方Java AccessToken/RoomServiceClient示例 | 精确Maven依赖图、token decode授权、Room踢出/删除有界请求 |
| LiveKit Go镜像/Compose | 未下载/解析；固定release+digest CP01待决技术输入 | https://docs.livekit.io/transport/self-hosting/vm/ 、ports-firewall | 同远端WSS/RTC/TURN网络、host身份、容器和端口cleanup |
| Android PixelCopy/MotionEvent | Android API≥29本批设备准入 | https://developer.android.com/reference/android/view/PixelCopy 、Activity#dispatchTouchEvent、Presentation | 两Window持续采样/完整原业务控件/冲突cancel/Window删除 |
| 数据包/Room SDK | 官方行为仅支持路线，不代表本仓验证 | https://docs.livekit.io/transport/data/packets/ ，reliable有序有限重传但仍会丢/无离线缓存 | 4096bytes、destinationIdentities、实际sender、两端keepalive与结束 |

特别：官方WebRTC主分支的 `WebRTCModule` 有包内factory/track注册，**不是已核实public customTrack导入接口**；源码 https://github.com/livekit/react-native-webrtc/blob/master/android/src/main/java/com/oney/WebRTCModule/WebRTCModule.java 和 src/MediaStreamTrack.ts 只能作T01研究入口。不得靠反射、改node_modules私有字段或把原生VideoTrack对象当JS MediaStreamTrack。CP01需找到版本相符的可维护帧接缝并做真实track proof；找不到报告Dexter技术阻断，不暗中引入第二SDKRoom。无需为“可能的未来”写通用桥插件框架。
依赖确认记录须填写版本、lock/Gradle来源、精确官方tag/commit、实际依赖行为、proof边界，当前全部新增行为OPEN。选库不能替代真实桥验证。

## 3. HTTP唯一计划矩阵
O=/api/operations/group-workspaces/{groupWorkspaceKey}；T=/api/terminal/group-workspaces/{groupWorkspaceKey}。所有运营路径用当前session expectedContextVersion query与projectRef；路径不得包含客户端账号身份。所有终端认证只由TDC从credential生成，C最终认证形状读回后沿用，不添加副机physical鉴权条件。
| operationId（计划新增） | method/path | 输入/成功输出 | owner与授权 | 错误合同 |
| --- | --- | --- | --- | --- |
| startOperationsTerminalRemoteControl | POST O/projects/{projectRef}/terminals/{terminalRef}/remote-control-sessions | body{requestId}；需求R07 start输出 | CONTROL_PROJECT_TERMINAL live grant；server-resolved terminal归project；同事务session+invokeOnline | 下表OWNER_COMMAND及本行augmentation；失败保留Drawer，不开Modal |
| getOperationsTerminalRemoteControl | GET 同上/{sessionId} | R07本session状态/description/时间 | 原发起账号+有效session/context/页面和角色PROJECT读取范围+session terminal归属；不附写capability、不调用resolveGeneratedOperation、不返回token | 下表AUTHZ_READ及增补；过期按leaseExpiresAt导出ENDED/LEASE_EXPIRED，不写库/audit/stop |
| issueOperationsRemoteControlGrant | POST 同上/{sessionId}/controller-grant | 无正文或规范空对象；R07 URL/token/description | 原发起账号、运营session、未过期registered描述与live写grant；Tab不共享Room；新Tab发起用新requestId | 下表OWNER_COMMAND及本行augmentation；未ready与已结束分开 |
| endOperationsTerminalRemoteControl | POST 同上/{sessionId}/end | reason仅ADMIN_ENDED/WORKSPACE_CLOSED；返回ENDED公开事实 | 原发起账号/currentContext/live写grant；同session幂等，不end后继session | 下表OWNER_COMMAND及增补；已ENDED等值成功，不以410破坏幂等 |
| registerTerminalRemoteControl | POST T/remote-control-sessions/{sessionId}/registration | body{sessionId,topologyKind,peerIdentity}；R07 description/grants/remainingLeaseMs | TDC credential terminal/binding+stored currentTDP目标，MASTER本机自核 | 下表TERMINAL_REMOTE_CONTROL_COMMAND及本行augmentation；凭证无效403 |
| reportTerminalRemoteControl | POST T/remote-control-sessions/{sessionId}/status | body{sessionId,state,reason,readyScreens}；R07 lease输出 | 同credential+stored启动身份，MASTER-only caller | 同一终端基础集及增补；已ENDED相同结束报告幂等；ACTIVE/renew不能复活 |

主体sessionId必须与path相同；UUID不存在/不可见用现有隐藏存在性策略，不透露Room/token。terminal根prefix复用当前group空间，generated suffix只remote后缀。

### 3a. 逐operation错误闭集、状态码与判定先后（本包已选定，不留给实施猜测）
现有canonical `errorSets` 与 `operationErrorAugmentations` 在 `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`；错误code登记在 `2026-07-26-v2s-r5-error-code-disposition-catalog.json`。`TERMINAL_CREDENTIAL`仅为security/authorizationMode，不是errorSetRef。wire沿既有generated `Problem`（type/title/status/detail/errorCode/correlationId等），复用ContractProblemAdvice/foundation factory；不加新错误信封。以下新增remote code只在未来本批canonical内登记，不宣称当前已存在。

基础集准确成员：
- `AUTHZ_READ`：PLATFORM_COMMON_AUTHENTICATION_REQUIRED、PLATFORM_COMMON_ACCESS_DENIED、PLATFORM_COMMON_CONTEXT_STALE、PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED、PLATFORM_COMMON_RESOURCE_NOT_FOUND。
- `OWNER_COMMAND`：上述AUTHZ_READ五项，加PLATFORM_COMMON_VALIDATION_FAILED、PLATFORM_COMMON_VERSION_CONFLICT、PLATFORM_COMMON_IDEMPOTENCY_CONFLICT、PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION、PLATFORM_COMMON_RESULT_UNKNOWN。版本冲突仅在该op实际有版本前提时产生，不为凑基础集增加CAS。
- 计划新增 `TERMINAL_REMOTE_CONTROL_COMMAND`：PLATFORM_COMMON_VALIDATION_FAILED、PLATFORM_COMMON_ACCESS_DENIED、PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED、PLATFORM_COMMON_RESOURCE_NOT_FOUND、PLATFORM_DEPENDENCY_UNAVAILABLE、STORE_TERMINAL_DISABLED、TERMINAL_BINDING_CREDENTIAL_INVALID、PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION、PLATFORM_COMMON_RESULT_UNKNOWN。复用既有terminal认证语义，不借用TERMINAL_UPDATE_REPORT_WRITE的update专属identity码，不新造terminal鉴权框架。

下表增补均是**完整增补集合**；最终合同=基础集∪该行增补。缩写RC_=TERMINAL_CONTROL_REMOTE_，仅为表格显示简写；canonical/code实际使用完整前缀。
| operationId | errorSetRef | operationErrorAugmentations（完整集合） |
| --- | --- | --- |
| startOperationsTerminalRemoteControl | OWNER_COMMAND | PLATFORM_DEPENDENCY_UNAVAILABLE、RC_NOT_ACTIVATED、RC_TERMINAL_OFFLINE、RC_CONNECTION_UNCONFIRMED、RC_OCCUPIED、RC_IDENTITY_CONFLICT |
| getOperationsTerminalRemoteControl | AUTHZ_READ | PLATFORM_COMMON_VALIDATION_FAILED、PLATFORM_DEPENDENCY_UNAVAILABLE |
| issueOperationsRemoteControlGrant | OWNER_COMMAND | PLATFORM_DEPENDENCY_UNAVAILABLE、RC_NOT_READY、RC_IDENTITY_CONFLICT、RC_SESSION_ENDED |
| endOperationsTerminalRemoteControl | OWNER_COMMAND | PLATFORM_DEPENDENCY_UNAVAILABLE、RC_IDENTITY_CONFLICT |
| registerTerminalRemoteControl | TERMINAL_REMOTE_CONTROL_COMMAND | RC_IDENTITY_CONFLICT、RC_NOT_READY、RC_SESSION_ENDED |
| reportTerminalRemoteControl | TERMINAL_REMOTE_CONTROL_COMMAND | RC_IDENTITY_CONFLICT、RC_SESSION_ENDED |

| wire errorCode | HTTP | 精确触发条件→业务reason/UI与动作 |
| --- | --- | --- |
| PLATFORM_COMMON_AUTHENTICATION_REQUIRED | 401 | 运营会话无效；沿原认证处理，停止当前输入，不隐式换账号 |
| PLATFORM_COMMON_ACCESS_DENIED | 403 | 页面/role项目读取范围、原发起者或写capability不成立；OUT_OF_SCOPE/PERMISSION_DENIED/AUTHORIZATION_INVALID按当前有界typed判据给中文；不泄露他人session |
| PLATFORM_COMMON_CONTEXT_STALE | 409 | expectedContextVersion与当前session不符；清旧目标、重读context，禁止自动新start |
| PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED | 403 | 当前集团空间停用；停止本次操作 |
| PLATFORM_COMMON_RESOURCE_NOT_FOUND | 404 | 在已授权范围内目标/session不存在或不可见；不返回Room/token |
| PLATFORM_COMMON_VALIDATION_FAILED | 422 | UUID、body/path一致性、state/reason闭集、readySlots格式/数量或不合法状态转换；不重试原坏参数 |
| PLATFORM_COMMON_VERSION_CONFLICT | 409 | 只沿已有版本前提；本六op无新增用户version字段，不凭此启动自动CAS |
| PLATFORM_COMMON_IDEMPOTENCY_CONFLICT | 409 | 同requestId改变目标/意图正文；IDENTITY_CONFLICT，需手动新意图 |
| PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION | 500 | 不可能的owner写回/数量条件；保留诊断，停止本次，不输出异常原文 |
| PLATFORM_COMMON_RESULT_UNKNOWN | 500 | 写提交结果不能确定；先用同session GET（start用同requestId幂等回读），不创建第二requestId/第二会话 |
| PLATFORM_DEPENDENCY_UNAVAILABLE | 503 | DB/本地签发依赖当前不可用；SERVICE_UNAVAILABLE，不假装成功，旧资源本地仍须关闭 |
| STORE_TERMINAL_DISABLED | 409 | terminal认证后owner读回终端停用；沿既有terminal data typed条件，拒绝本次注册/续约 |
| TERMINAL_BINDING_CREDENTIAL_INVALID | 403 | 凭证/binding失效；ACTIVATION_INVALID，不清TDC凭证、不把副机物理deviceId另当认证条件 |
| RC_NOT_ACTIVATED | 409 | start当前terminal未激活；NOT_ACTIVATED |
| RC_TERMINAL_OFFLINE | 409 | start绑定有效但PG权威会话离线；TERMINAL_OFFLINE |
| RC_CONNECTION_UNCONFIRMED | 409 | start当前PG在线身份无法完整确认；CONNECTION_UNCONFIRMED |
| RC_OCCUPIED | 409 | 已满足前述资格而仍有未到期另一session；OCCUPIED，只点击后提示 |
| RC_IDENTITY_CONFLICT | 409 | path/body、固定binding/启动TDP目标或登记description/peer已改变；IDENTITY_CONFLICT；格式错误用422，二者不混 |
| RC_NOT_READY | 409 | grant尚无完整registered描述，或register存在本次仍在准备且不可取grant的owner前提；NOT_READY。仅STARTING内沿原30s有界读回，不创建新session |
| RC_SESSION_ENDED | 410 | grant/register/ACTIVE续约请求遇已结束或过期session；返回公开终态原因，停止；end及等值ENDED报告仍幂等成功 |

判定顺序：先既有协议/格式校验（不读业务事实），再认证和context/页面/role或credential；scope不成立先403，不泄露存在性；scope内不存在404；三运营POST live写授权始终先于receipt/replay。start在锁内依次核当前激活→PG离线/未确认→同request等值回读/正文冲突→回收过期事实→另一有效占用；receipt仍须核当前资格，不借重放恢复失效控制。其他写op先session归属/发起者→固定身份→终态/期限→状态和ready前提→实际写回。GET不触发上述写回。依赖读取失败用503，提交是否完成不可判才用500 RESULT_UNKNOWN，不承诺DB不可写时能写失败记录。R20会话reason和Data输入reason是各自闭集，不把它们全部增补到每个HTTP operation。

所有grant response Cache-Control:no-store；token仅短期运行输入，不新增加密/私密channel。授权TTL初始60s（两倍启动30s，充分覆盖常见首次join，不提供长期重连）；准确SDK seconds/Instant方法在CP01官方tag确认。expires不证明已撤权；本session独占lease独立30s。token不续签自动恢复，断连手动新session。
operation预算：先列授权、读current、锁、幂等、session/audit、invokeOnline每事件SQL与事务数，复用既有interceptor。CP01针对当前解析来源填写catalog预算依据；不为降预算删live grant/锁/readback。存在合理超限时仅按AGENTS允许的operation-scoped决策，不设置新的全域条数上限或把budget未测说成PASS。

### 3b. 六Data消息的方向与处理闭包
完整字段唯一来源需求R13～R16；generator按其JSON逐字字段落实。公共envelope={v:1,type,sessionId,seq,body}、UUID与安全整数/4096UTF8bytes先校验。participant sender取SDK事件实际对象，不body字段。按每actualsender当前session保留一个lastSeq，非法关联不推进；消息无额外通用ERROR/lease/OPEN协议。
| type | caller→destination | body与前置 | 返回/退出 |
| --- | --- | --- | --- |
| SCREEN_READY | endpoint→controller+MASTER（自身MASTER用localfact） | endpointId/screen/streamId/trackSid/widthPx/heightPx；本机mapping+首帧先准备，description归属及actualsender匹配 | browser按track存在且可见，MASTER各slotready；KEEPALIVE附带重发当前声明(newseq) |
| POINTER | controller→description中的目标endpoint | endpointId/screen/streamId/gestureId/phase及u/v规则；当前endpoint已ready；controller identity | down/up/cancel或拒绝回复INPUT_RESULT；正常move不reply；不同目标不执行 |
| INPUT_RESULT | endpoint→controller | forSeq/gestureId/status/reason；必须关联当前gesture及边界request | 3s没结果end INPUT_RESULT_UNKNOWN；asyncCANCEL关联acceptedDOWNseq，不误取消后续gesture |
| KEEPALIVE | controller→全部endpoints | probeId UUID；加入立即发，5s；endpoint15s未收到end | KEEPALIVE_ACK相同probe，重发当前SCREEN_READY；不延长CBS lease |
| KEEPALIVE_ACK | endpoint→controller | probeId属于当前/前一个；actualsender是描述required endpoint | 15s缺required KEEPALIVE_ACK结束；不含readyStreams，也不对KEEPALIVE_ACK再回执 |
| SESSION_END | 已授权member→其他members | reason取需求R20结束闭集，当前session | 拒输入、CANCEL、资源关闭；重复结束幂等，不发送回执循环 |

duplicate POINTER只REJECTED DUPLICATE不重执行，其余重复丢弃。未知version/type仅授权当前participant可触发SESSION_END UNSUPPORTED_PROTOCOL；foreign/错误session直接计数丢弃，不驱逐合法会话。输入参数不落盘，不运行任意脚本。对INPUT_RESULT无有限association者丢弃，不能用晚到UP清新gesture。

### 3c. CBS记录与约束
remote_session：session_id UUID PK；workspace_uuid/group_workspace_key/project_ref/store_ref/terminal_ref；binding_generation/device_identity、target_node_id/target_session_id/target_session_sequence；actor_account_ref、actor_session_ref、request_id；state STARTING/ACTIVE/ENDED；reason nullable；description_json nullable；ready_screens_json（最大2）；started_at/deadline_at/lease_expires_at/ended_at。
identity来源device只为绑定与PG current目标核验，不改CBS credential-only认证。无JWT、按压、画面、rawpeer地址或回放输入。session可以保留始末状态作为标准审计引用，没有主动历史页面/媒体留存需求，不添加定期删库机制。
partial unique terminal where state in STARTING,ACTIVE；request unique(workspace,actor_account_ref,request_id)；project+startedAt读回索引按实际查询必要性添加，不猜统计索引。audit_event同owner标准JSON facts仅terminal/project/session/start/end/finite reason，复用AuditEventWriter事务adapter。

## 4. TestId唯一常量表与原控件复用
所有新增常量位于 `apps/frontend/operations-admin/src/app/automation/remoteControlTestIds.ts`；通过foundation testId挂载，UI/driver引用同一源。以下是未来定义，不是已存在的source。动态键用终端UUID/固定slot，不用索引；同terminal不同菜单/状态控件值不能冲突。
| 符号 | 唯一值/构造规则 | 实际节点/消费 |
| --- | --- | --- |
| onlineStatus(terminalRef) | operations-remote-control-online-${terminalRef} | 原表连接Tag/文本；仅观察 |
| detailActions(terminalRef) | operations-remote-control-actions-${terminalRef} | 原终端Drawer中AdminDetailActionMenu的真实Button |
| start(terminalRef) | operations-remote-control-start-${terminalRef} | AdminDetailActionLabel真实可点击菜单anchor |
| workArea | operations-remote-control-workspace | Modal领域媒体容器，仅观察/限定查找 |
| screen(slot) | operations-remote-control-screen-${slot}；slot=main/secondary | 接收PointerEvent的video；若SDK组件不公开video属性，使用紧贴该video的输入层并在focused证明内容矩形一致，不用祖先wrapper猜坐标 |
| status | operations-remote-control-status | 当前工作区状态文本，仅观察 |
| end / close / restart | operations-remote-control-end / -close / -restart | 各自真实Button，不借Modal外框testId |

原Tab/query/terminalName/list/detail保留 `terminalUpdateTestIds`。只将当前查询重置Button的字面量 `terminal-update-report-filter-reset` 移为同对象 `reportQueryReset`、分页prefix `terminal-update-report-pagination` 移为 `reportPagination`；值不改、不新增UI行为。分页真实Button由CursorPagination拼出 `${reportPagination}-previous/-next`。原TER业务控件仍各包createTestId/品牌TestId，无remote专用TER按钮。

### 4a. 逐动作九列：UI实现后、L2脚本开发前必须逐行读回
UI owning source缩写：P=`apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx`；W=`apps/frontend/operations-admin/src/features/remote-control/ui/RemoteControlWorkspace.tsx`；V=同feature `RemoteControlVideo.tsx`。binding文件见§4b；以下B=该文件的具名action，D=remoteControlTestSession同名helper。所有拟新增节点均需实施focused与fresh复核，当前OPEN/NOT_RUN。
| 用户动作 / case-action | 实际控件 | UI owning source | TestIds常量 | 实际挂载节点 | wrapper/native | L2 binding/touch | focused/static proof | 复核结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| online.reportsTab | 终端更新状态Tab | P | terminalUpdateTestIds.reportsTabLabel | Tab可见label span | COMPOSITE_OPTION_ANCHOR，保持现有点击语义 | B.reportsTab / D.openReports | page组件切Tab读报告而非规则 | OPEN |
| online.queryText | 原终端查询 | P | terminalUpdateTestIds.reportQuery | Input的真实input | native；fieldProps转发须读回 | B.queryText / D.queryTerminal | 输入后未提交不查询 | OPEN |
| online.querySubmit | 查询 | P | terminalUpdateTestIds.reportQuerySubmit | Button | native | B.querySubmit / D.queryTerminal | 显式提交；目标terminalRef唯一 | OPEN |
| online.queryReset | 重置 | P | terminalUpdateTestIds.reportQueryReset（计划迁入） | Button | native | B.queryReset | 原查询清理/刷新相同 | OPEN |
| online.previous/next | 原列表翻页 | P/CursorPagination | reportPagination派生-previous/-next | 两个Button | native；不是分页wrapper | B.previous/B.next | 51行fixture实际cursor上下页不重复 | OPEN |
| online.openTerminal | 原终端名称 | P | terminalUpdateTestIds.reportOpen(terminalRef) | 原Button | native稳定UUID | B.openTerminal / D.openTerminal | latest detail身份/四态一致 | OPEN |
| start.openActions | 操作 | P | remoteControlTestIds.detailActions(terminalRef) | AdminDetailActionMenu触发Button | native | B.openActions / D.start | header菜单真实打开，不借ruleDetailActions | OPEN |
| start.remoteControl | 远程控制 | P/AdminDetailActionLabel | remoteControlTestIds.start(terminalRef) | 可见菜单label span | COMPOSITE_OPTION_ANCHOR；明确同一菜单动作 | B.start / D.start | 无权/不可用禁用；有权POST真实目标 | OPEN |
| input.main.down/move/up/cancel | 主屏视频单指 | V | remoteControlTestIds.screen('main') | 真实video输入接缝 | native或上述具名紧贴输入层，focused先定一种 | B.main / D.pointer('main') | 内容矩形去黑边、同gesture目标/结果；真实媒体限DEV/device | OPEN |
| input.secondary.down/move/up/cancel | 副屏视频单指 | V | remoteControlTestIds.screen('secondary') | 第二路真实video输入接缝 | 同主屏；不能按到达顺序 | B.secondary / D.pointer('secondary') | 单屏无节点；dual/pair正确endpoint，旧stream拒绝 | OPEN |
| end.endSession | 结束远程控制 | W | remoteControlTestIds.end | Button | native | B.end / D.end | 本地先禁输入，CBS当前session结束 | OPEN |
| end.closeWorkspace | 关闭 | W | remoteControlTestIds.close | 显式Button；Modal默认closeIcon关闭，键盘onCancel同一个owner | native | B.close / D.close | 关闭/CANCEL/cleanup一次且先关原Drawer再开Modal；overlay上限1，退出焦点归当前列表reportOpen(terminalRef)，失效时归当前Tab reportQuerySubmit，离页交router；不聚焦已销毁菜单 | OPEN |
| end.restart | 重新发起 | W | remoteControlTestIds.restart | ENDED区Button | native | B.restart / D.restart | 新requestId/session，非重连旧Room | OPEN |
| online.connection/status.workspace | 状态观察 | P/W | onlineStatus(terminalRef)/status/workArea | 具名Tag/状态文本/容器 | observation-only，不作为动作locator | B.connection/B.status/B.workspace | 中文/四态/STARTING/ENDED各oracle | OPEN |

门店和版本等原筛选字段不在本批自动化新增动作中，仍是既有业务控件；remote.online只操作queryText/submit/reset/翻页/终端入口。本批不以Select宿主wrapper假装真实input，不增加通用CSS兜底。context/login是共享fixture合法HTTP前提，不伪称上述UI动作；错scope/撤权通过backend-acceptance及fixture HTTP，真正页面切换结束由组件focused与现有shell接缝证明。若未来增加该UI动作，先补真实节点表再写binding，不能隐式扩大场景。

### 4b. 精确控制面文件：同入口扩展，不是第二runner
所有下列路径create/update为未来实施内容；CP01核对现状，CP05按本表完成场景接线。无“到时自己找入口”的省略项。
| 处置 | 精确路径 | 职责与完成时机 |
| --- | --- | --- |
| update | scripts/test/terminal-automation.mjs；tools/terminal-automation/src/runner.ts、managedRun.ts、driver.ts、androidAutomationConnection.ts、androidCleanupRecovery.ts、journeyFailureDiagnostics.ts；tools/terminal-automation/vitest.journeys.config.ts | 原唯一入口新增remote判别式、device/topology/sample参数与owned子资源；CP05；实际原C forward/reverse接缝先重开，不复制pair runner |
| create | tools/terminal-automation/src/remoteControlTestSession.ts；test/remoteControlTestSession.test.ts；fixtures/remoteControl.ts；journeys/remote.web.test.ts、remote.android.test.ts | 组合现有浏览器驱动/TER观察与真实pointer；首败停止业务、清理所有owned资源；CP05 |
| update | tools/terminal-automation/test/runner.test.ts、managedRun.test.ts、journeyFailureDiagnostics.test.ts、androidCleanupRecovery.test.ts | 参数拒绝/未知资源拒绝/首败/cleanup反例；CP05 |
| retain/update共享接缝 | tools/terminal-automation/fixtures/managedActivation.ts、terminalActivation.ts、terminal.ts；apps/terminal/kernel/base/terminal-data-client/acceptance/operationsFixture.ts及devScenarios.test.ts | 当前operationsSession最终选STORE，不能拿其cookie/context冒充PROJECT读页。复用httpJson与登录/session/context公共段，抽出具名PROJECT scope会话helper供remote fixture；旧STORE路径和TDC acceptance保持原语义、focused验证，不复制登录实现；CP05 |
| create静态source | contracts/policy/terminal-remote-control-l2-fixture.json、terminal-remote-control-l2-case-blueprint.json、terminal-remote-control-l2-scenarios.json、terminal-remote-control-l2-locator-bindings.json、terminal-remote-control-l2-timing-budget.json、terminal-remote-control-l2-admission.json | §3a五case的隔离L2适用动作/fixture/oracle；bindings唯一对应§4a；deadline取已批准30s启动/普通HTTP，不自造等待平台；CP05 |
| create生成入口/产物 | scripts/generate/terminal-remote-control-l2-p1.mjs；scripts/test/terminal-remote-control-l2-p1.test.mjs；contracts/policy/terminal-remote-control-l2-activation-candidate.json、terminal-remote-control-l2-execution.json | 前两为P1生成/自测，后两仅同run合法owner操作和readback派生、不手写伪identity；CP05 |
| create准入/spec | scripts/test/terminal-remote-control-l2-admission.mjs及terminal-remote-control-l2-admission.test.mjs；apps/frontend/operations-admin/src/tests/l2/terminal-remote-control.spec.ts | 复用store-terminal同源P1与locator准入形态，不另建compliance控制面；CP05 |
| update/retain | scripts/test/browser-l2、browser-l2-runtime.mjs、browser-l2-runtime.test.mjs、browser-l2-credentials.mjs；scripts/test/terminal-ws-wire-client.mjs | 原closed suite map增加terminal-remote-control；隔离L2合法激活/真实TDS wire ready，不冒充Android输入。DEV/device主run复用浏览器控制库/配置，不调用隔离runner再开另一套DEV；CP05 |
| update | scripts/env/check-runtime-resource-budget；scripts/test/test-health-entry-runner.mjs及其test；tools/terminal-shared/run-terminal-format.mjs；scripts/README.md | profiles定义就在预算入口中，非profiles目录。调用前登记现有ter-validation-with-dev与admin-validation-with-ter的父子run根/kind，新的远端LiveKit resident根/kind/预算只按manifest所有权添加；health/format同步新文件；CP05 |
| create/update | scripts/dev/r5-livekit-resident.mjs及r5-livekit-resident.test.mjs；scripts/dev/livekit/docker-compose.yaml、livekit.yaml.template；scripts/dev/r5-dev-runner.mjs及直接test；scripts/dev/profiles/r5-full.json | 同受管resident check/start/stop，明确RTC/WSS网络readiness、容器/volume/host身份；启动前预算；CP05，不删除镜像cache |
| update | contracts/catalog/admin-catalog.json；contracts/registry/iam-org-governance-manifest.json；doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json；scripts/dev/r5-seed-plan.mjs、owner-command-seed-executor.mjs、r5-complete-seed-executor.mjs及各直接test | §5新cap/原role-project，role-group不变、角色数量不变；fixture身份/readonly拒绝断言；CP02声明CP05seed接线 |
| create/update生成链 | scripts/generate/terminal-remote-control-protocol.mjs及scripts/test/terminal-remote-control-protocol.test.mjs；scripts/generate/r5-edge-materialize.mjs、edge-codegen.mjs、terminal-client-api.mjs及现有selftest | canonical/schema/catalog→materialize→edge-codegen→TDC；Data协议一source两消费者；CP01形状CP06check；输入根内校验不依赖外仓 |
| retain | 原store-terminal L2的policy/P1/准入/spec；静态skeleton/runtime门；旧phase各tests | 只复用能力形态，不删除别的业务套件；退役TER runner不复活 |

资源新根建议 `.runtime/livekit-resident/`、kind=`livekit-resident`，只用于未来managed manifest来源；本轮不读取该路径。DEV/device子记录沿原terminal-automation run根、不建第二账本。新profile必须核对当前C最终runner的预算形状；独立L2根沿原browser-l2同run根，二者证据分档。若资源门尚不识别新kind，先同步门与真实red再启动，不用临时豁免跳过。

## 5. 管理环境、seed与凭据唯一来源

以下仅是本批DEV/test fixture计划，不改变真实用户的产品授权政策；页面准入与新写cap分别处理。

| role fixture key | page/新cap差量 | actor/assignment与scope | 写入来源/断言 |
| --- | --- | --- | --- |
| role-project | 保留PG-PROJECT-TERMINAL-VERSION-RULES，显式加CONTROL_PROJECT_TERMINAL | account-multi-role/asg-multi-project，project-river | owner-command完整seed父流程createWorkspaceRole；r5-seed-plan检查此role新cap，操作必须选择该assignment |
| role-group | 保留既有页面和所有cap；不加远控cap | account-multi-role/asg-multi-group，选择原角色允许的project-river读取scope | GROUP_SEED_CAPABILITIES原集合不变；断言GET可读、3POST拒绝，不因版本管理权推远控权 |
| acceptance/L2 remote-controller | 原页面＋PROJECT远控cap | 本run合法创建controller-account/assignment于fixtureProjectA | RemoteControlAcceptanceScenarios/remoteControl fixture调用既有IAM owner API构造；不写DEV seed |
| acceptance/L2 remote-readonly | 原页面/PROJECTscope，无新cap | 本run独立readonly-account/assignment；另projectB用于错scope | 同受管fixture合法owner API；无权POST不产生session/operation；其他发起者不能获grant |

上述两条DEV role只改原role字段不增角色/账号/任职；完整父seed计数如未改变保持原值，实际涉及cap计数则同步其既有期望，不伪造新session计数。两个测试role的名字是fixture符号键，不写账号、密码或登录名值。
复用r5-full seed contract stableFixtures.organization.storeTerminals：dual/laptop用term-front，mobile用term-handheld，不新终端数据。激活码只读seed契约。账号/权限使用owner-command seed既有workspace账号和登录环境接缝；当前managedActivation.ts读取V2S_TERMINAL_DEV_MANIFEST、V2S_TERMINAL_DEV_HTTP_BASE_URL、V2S_SEED_OPERATIONS_DEFAULT_PASSWORD，账号定位取共享operations fixture，不在文档写值，不另造登录helper。CP01重开最终helper核对变量名。
LiveKit配置输入（本批计划新增）：R5_LIVEKIT_PUBLIC_URL、R5_LIVEKIT_API_KEY、R5_LIVEKIT_API_SECRET、R5_LIVEKIT_IMAGE_DIGEST；实际server公共域名/证书及RTC/TURN端口由受管部署文件单源定义。没有可用值时拒绝部署proof；不fallback本机/外部云或猜证书。TERM serverSpaces livekit只含信令地址，不含API secret；主副沿原配置同步。
Compose使用官方VM生成路线的单实例形态；具体服务/版本/Redis需要按选定官方release配置定稿，而非假设所有release都需要第二数据库。RTC端口应直接可达，信令/CBS/tunnel端口分别登记；Docker host与boot ID、container ID、映射/卷、process start token必须归受管manifest。不回收官方镜像cache、不删除未知容器/端口。

## 6. 真实HTTP验收及用户Journey
六新operation放RemoteControlAcceptanceScenarios；原page/detail连接断言放原TerminalUpdateAcceptanceScenarios或该新能力组通过既有OperationID调用；场景不堆入口，不新增provider。
| identity | fixture | request | businessOracle |
| --- | --- | --- | --- |
| terminalRemoteControl.start | A项目有权账号、当前绑定/PG TDSready、B项目终端 | 真实startPOST；同request与并发另一request | stored目标generation/session/seq；唯一STARTING；一条invoke operation/audit；同id等值重放、异target冲突、错scope无写 |
| terminalRemoteControl.read | 同session发起账号/另一账号/另一项目 | readGET | descriptor登记前null、登记后固定slots；读不到别人控制grant，ended原因/时间真实 |
| terminalRemoteControl.controllerGrant | 初始/registered/expired/撤权session | grantPOST | identity/room与descriptor相符、permission只有subscribe video/pubdata、无audio/camera；NOT_READY/ended/撤权无token |
| terminalRemoteControl.end | 已ACTIVE/ENDED | endPOST两次 | 单ENDED事实、一次end审计、nextstart可占用；不误end后继session |
| terminalRemoteControl.register | credential A/失效binding/同App拓扑 | terminalregisterPOST | 1/2grants准确，不返回TER URL；同描述幂等、换peer拒绝；认证错误无session改写 |
| terminalRemoteControl.status | MASTER当前session/oldsequence/expired | reportPOST ACTIVE/renew/ENDED | 全slot才ACTIVE；lease返回毫秒；过期不复活、状态倒退拒绝、旧请求不改新会话 |
| terminalRemoteControl.online | 51个enabled终端+四态不同绑定 | 原versionpage/detail GET | 排除disabled store/terminal；原分页/version条件成立；四态准确，DB集合读取不N+1 |
| terminalRemoteControl.audit | start/end合法事实 | 标准audit-historyGET | owner entity/actions/actor/时间，无token/pointer/媒体；只读scope成立 |

共享场景清单是上述remote.*能力名加详设§11a细分；TestId/控件操作来源本附件§4。backend聚焦用 `scripts/test/backend-acceptance --operation <对应generated operationId>`（实施注册后）；完整本批select集合由现有runner闭集扩展，不新增测试平台，不盲跑全仓不相关suite。

## 7. 设备、Web与生命周期验收顺序
两个ui/integration（console/wallpaper）先各跑非adapter部分：actor资格/stream失效、command/selector、配对接纳纯codec、失败/超时、配置/结束；真实捕获不可由fixture宣称PASS。
按90%主流程做交叉覆盖，而非两个App×四拓扑笛卡尔积：console真机laptop dual；wallpaper mobile VM；console laptop single VM/单屏设备；console同App双VM pair；wallpaper同App双VM pair，共5个设备run。四拓扑均真实覆盖、两个App均真实运行且各自pair均验证；未跑App×拓扑组合标NOT_COVERED，不能从交叉覆盖声称全矩阵PASS。每case只增加证明需求必要的断连/输入反例，不搞全组合故障爆炸。同Apppair两端屏业务与currentstate确认；不同App拒绝沿既有static/focused，不新造业务。
所有设备 explicit serial，不依赖adb列表顺序；paired使用两个不同serial，manifest分别标MASTER/SLAVE，single/dual/handheld明确。一次一个受管run复用seed终端；冲突时REQUIRE_INACTIVE，只有本driver manifest deviceId与绑定读回相同才取消；日志/manifest不落原值秘密。
计划新增CLI（当前不可运行）：`scripts/test/terminal-automation.mjs --phase remote --platform web|android --remote-topology mobile-single|laptop-single|laptop-dual|laptop-paired --sample console|wallpaper --case remote.main`；Android另传`--device-serial`，paired再传`--peer-device-serial`。remote phase不接受旧shape来猜拓扑；扩展runner execution union/phaseSuite/预算/kind/tests，旧phase完全保留约束。对应remote.main一次执行共享场景适用成员；red/failure用独立fixture但同managedentry。
browser端真实operations UI click与video pointer由现有浏览器L2能力承担（复用browser-l2生命周期和Playwright库，不另造浏览器runner）；TER状态观察/本地交互用最新automation driver，不能用agent.sendCommand替代远控POINTER。remoteControlTestSession只组合当前两个受管能力，不拥有第二process/cleanup账本；父run登记children identities/logs/readiness与末尾归一business/cleanup。
为了原生媒体的DEV多端Journey，未来明确受管DEV/device授权可使用已启动DEV＋media resident＋本机operations Vite，而不能冒充每run隔离browser L2。UI权限/布局L2仍按隔离数据库/资产/TDS/LiveKit资源运行，current-byte真实设备用户Journey另标DEV/device；两者标签不可混用。需要新runner支持时CP05先接线/红例，不能用手工常驻服务替代。

# TER T1 · 全包责任与源码/API附件

## 0 · 读法与覆盖边界

正式需求、详设为判据；本附件把当前手写能力按owner/入口/事实/资源/失败/目标归因。当前源码导航中的40个package.json包括根workspace，39个功能包如下；生成/vendor/test/config单列，不把行数作为缺陷。原导航JSON不是本附件的完成证明。下表是**逐能力/逻辑组设计决定**，不是宣称所有叶子组件的每一个分支已经运行或语义审计PASS。未来主agent逐点重开当前源码；若同能力有漏成员，先补附件，不能照旧清单跳过。

路径省略`apps/terminal/`；表内src相对对应包。`keep`指职责与身份保留，不等于该包不改imports/declarations/README。没有行为的index/dependencies/moduleName不制造业务流程；没有需要的不建errors/parameters空文件。

## 1 · 全功能包的逐能力归属

| 包 | 能力输入→输出、事实/资源、真实caller、失败责任 | 保留/迁移/删除决定 |
|---|---|---|
| kernel/base/contracts | brand/identity、模块类型、Error/Parameter工厂；无store/native；所有owner使用 | keep纯定义；errors/parameters实际按声明消费，删除无消费者AppModule登记字段；moduleName/dependencies/root分开 |
| kernel/base/platform-ports | 平台port/result/unavailable、capability描述、logger facade；入口注入，owner消费 | keep类型/抽象；策略默认归declarations；诊断按现日志规范，不建新安全层 |
| kernel/base/state | 定义slice/codec/keyspace、单store、persist/flush/reset、sync produce/apply；Runtime装载 | keepdescriptor事实；registration资格派生；IO/调度application具名，dispose取消旧订阅/timer；别包raw读取不外放 |
| kernel/base/runtime | command/actor/selector工厂、验证、模块顺序、dispatch/ledger/peer/late、role/interaction；allmodules+automation消费 | concrete派生；登记定义/资源/timeout各现唯一owner；不识别sample-console command字符串；namedledger/selector单元 |
| kernel/base/display-context | 设备观测→display role/mode、generation；UI与topology selectors | keepdevice订阅和PortResult；错误定义集中，有状态observer不冒充purefoundation |
| kernel/base/ui-state | catalog→content MAIN/BRANCH、variable MAIN/BRANCH、surface-form；UI actors/render写读 | 8actors具名；4工作区slice分文件；catalog/registry/codec规则pure；保留原key/owner方向 |
| kernel/base/server-config | defaults＋persisted override/proxy→有效配置、revision、host projection；transport/UI/入口 | 具名resolver统一；取消cap各hydration/sync/input和UI add按钮同根；公开serviceContext selector不含密码；typedvalidation |
| kernel/base/transport | 配置/profile→HTTP/WS/重连/地址偏好/pending请求；TDC/平台binding | keepowner、唯一连接/pending resources；按name地址匹配；错误/策略统一声明，不拥有业务API |
| kernel/base/topology | role/host/pair/identity、commandwire、State projection→peer；Runtime/UI | keep单currentconnection和两controller；State资格接缝；删App名单/rawslice访问；mayPair窄selector注入防循环 |
| kernel/base/terminal-data-client | activation/credential、TDP/session/topic/heartbeat、remote命令/ACK；features依赖 | keep唯一credential、WS和remoteOperations；privateactivate/cancel；新增窄auth执行；删除其他owner5业务command/DTOcatalog |
| kernel/base/terminal-update | localcandidate→fixedtask/artifacts/install/boot/recent/reportqueue；project发command | keep单task/action、retain字段、fixedboot身份；privategrant/report；不拥有project规则cache/资格；拆helper不拆任务事实 |
| kernel/base/remote-control | CBSstart→Room/nativeport/peer/control/end/report；运营远控+TDPcommand | keepsession与tracks/capture终态；private register/report；remote自身消费signalconfig；不复制TDCsecret/业务鉴权 |
| kernel/feature/store-basic | 激活/store-ready/topic→store/rule/contracts/servicepoints；project/UI消费 | keepstore事实；先store自有readycommand后余数据并行；private7API；collection/detail订阅diff及旧结果隔离 |
| kernel/feature/project-basic | store-ready→project/region/group、snapshot/候选；update消费 | keep两API和ready/候选资格；组织路径不能按operation前缀误归update；候选匹配从assembly移公开selector |
| kernel/feature/sample-staff-session | login/logout→host session；UI auth、业务策略 | 三actor分别login/logout/mode；sessionunique；错误声明/并发policy显式，不能迁入UI |
| kernel/feature/sample-member-registry | add/confirm/pending→sharedmemberlist及branchpending；LMP/LSP/LMS | 四actor具名；operationId、response-loss及hostprojection identity不变；shared本包helper，不外放slice |
| kernel/feature/sample-wallpaper | selection→localwallpaper、主机projection；picker | keeplocalbackground与MAIN/BRANCH；无跨Appsharedbiz；真实参数/错误声明 |
| ui/base/primitives | semanticnode/TestId、真实native事件/focus/rnr/theme；所有UI | keeptoolkit无业务slice；只可用现TestIdfactory；node注册surface来自provider不App名单 |
| ui/base/input | inputfield/focus/selection/scroll/keyboardhandoff→UI；components消费 | keep唯一InputProvider registry/presentationclock；五hook分文件；frame/presenter/overlay具名拆，无perfieldtimer |
| ui/base/render | catalog+UI-state→surface/layer tree、requestobserve/readiness/errorpage；integration | keeprender；纯规则foundation，Reacthooks/components具名；不借根state直接取其他owner |
| ui/base/admin-shell | launcher/password/adminsection→本机admin；任何topology可恢复 | keep标准容器、gesture与catalogsections；server-config呈现迁真实config-panel贡献；update提醒/状态单一UI归属见§2；不加section registry |
| ui/base/terminal-activation | code/activeview→TDCcommand及MMP/LMP/LMS/LSPguides；integrationstage | parts/route actor自包；active-success仅文案，由integration后续路由，取消当前space行为保留 |
| ui/base/automation-agent | opt-in config→WSsession/controls/selectors/requests；driver | toolkitruntime modulekeep；session绑定、晚到有限观察、最新waitFor、JSONbudget同source；UI编译开关隔离不改 |
| ui/base/dev-host | Webports/storage/surfacepreview/loading/automationtestbridge→Expo host | keep调试host与Web unavailableports；大App具名拆，不能成为业务Runtime第二owner |
| ui/base/feature-assembly | UI模块定义/parts/variables shape及factory→integration | UI extensions不进kernel；共享Runtime派生factory；删三个feature空转发assembly；不扫描workspace |
| ui/base/integration-assembly | explicitmodules+ports/surface/theme→RuntimeBundle/RenderProvider/host生命周期 | keepruntime唯一创建/retry/cleanup；收contributions，bundle原子换；删stateSyncSlices helper与parts第二输入 |
| ui/feature/sample-staff-auth | kernel结果→login/nav/notice、parts/variables；integration | 四actors具名，自包展示command；kernelpolicy保留，UI不调login后台privateclient |
| ui/feature/sample-member-desk | form/pending/confirmed/rejected→UI；registry业务command | 七actors具名；LSP本机确认、LMShostprojection，不把branchpending交sharedregistry外 |
| ui/feature/sample-wallpaper-picker | localpicker→壁纸command/present；integration | 两actors具名；MMP/LMPlogout，LSP无logout；parts/errors声明自包 |
| ui/integration/sample-console | Appstage/required/provenfixture/externalbindings→console；application/Web | 保留阶段policy与owner selectors；删activation展示及candidate/credential/信号重复逻辑；只loadpkg+外部inputs |
| ui/integration/sample-wallpaper-console | 同类wallpaperAppstage/required→wallpaper | 仍独立App，不合并两个stage；welcome/exit部分本App贡献；defaultsversion统一输入 |
| adapter/android/device | Exponative device/power/display→ports；entry与display/topology | keepnative观测resource；pureparse分离，README说明真实能力不是旧unavailable |
| adapter/android/persist-kv | namespace/plain/protectedMMKV→storage；State | keep唯一MMKV/processinit/sync，wireparserpure；protected失败不回退plain，业务明文credential不变 |
| adapter/android/dual-screen | Activity/Display/Presentation→surfaceidentity/window/density；App/UI | keep一个ReactHost、registrywindowlease；具名policy/snapshot/Presentation；不副屏另VM |
| adapter/android/update | updateport→download/archive/APKinstaller/selectedbundle/boot；updateowner | index纯barrel；native record/action唯一；提helper依原流程，keepZipFile主路不恶意archive专项 |
| adapter/android/remote | port→LiveKitRoom/track/capture/touch；remoteowner | keep同activeSession/releasePromise；TS拆track/cleanuphelper，native四职责keep；protocol私有生成不反依赖业务owner |
| application/base/android | App/ReactHost/splash/nativeautolink/入口binding；两App调用 | 平台network/topology/appcontrol迁真实adapter；loading入口协作、AndroidTerminalApp及ports组合keep；foundations IO移application/implementations |
| application/android/sample-terminal | consoleApp身份/版本/defaults/resources+surface；系统启动 | keepnamespace+Application/Activity+signedbundlemetadata；envresolver复用，不One/Two和group硬写 |
| application/android/sample-wallpaper-terminal | wallpaper独立App入口同上 | keep独立applicationId/namespace/defaults；不mergeconsole版本和persist数据 |

新增目标 `ui/base/server-config-panel`不是当前39包之一：从admin-shell的`src/components/serverConfig/{ServerConfigPanel,ConfigField}.tsx`和`src/parts/serverConfigParts.tsx`迁入同名呈现/输入helper、`declarations/parts.tsx`与`application/module.ts`；只读kernel/server-config，写ownercommand。依赖admin-shell的公共section类型与key，不再由admin-shell引用新包，所以无循环。package/index/dependencies/invariants/README/直接测试沿真实UIbase模板；现TestId/文案/readonlyslave语义保持。

## 2 · 定义与大单元的确切迁移

以下都是将现逻辑迁移/提取，只有同能力无法表达才新增行为；不按CP/V给运行文件命名。旧文件全部消费者迁完后删除，不能重复export实现。

### 2.1 · 单定义文件

| 当前（包内src） | 目标 |
|---|---|
| runtime/features/slices/requestLedger.ts | requestLedgerMaster.ts、requestLedgerSlave.ts；共享规则foundations/requestLedgerState.ts |
| runtime/selectors/selectRequestExecutionViews.ts | 同名保留；另selectRequestExecutionCommands.ts |
| ui-state/features/actors/contentActors.ts | showScreenActor/openLayerActor/closeLayerActor/clearLayersActor/pruneHydratedContainersActor/pruneHydratedLayersActor.ts |
| ui-state/features/actors/variableActors.ts | setUiVariablesActor/clearUiVariablesActor.ts |
| ui-state/foundations/workspaceSlices.ts | features/slices/contentMain.ts、contentBranch.ts，纯validation/codec/helper仍foundations |
| ui-state/foundations/variableSlices.ts | features/slices/variablesMain.ts、variablesBranch.ts；surfaceForm slice具名保留 |
| ui-state/selectors/selectContent.ts | selectScreen.ts、selectLayers.ts；workspaceOwnership公开读定义进selectors/isCurrentWorkspaceOwnedByInstance.ts |
| server-config/selectors/selectServerConfiguration.ts | 保留同名；另resolveServerNetworkSnapshot.ts、selectServerConfigServiceContext.ts |
| staff-session/features/actors/actors.ts | staffBootstrapActor.ts、staffLoginActor.ts、staffLogoutActor.ts |
| member-registry/features/actors/actors.ts | submitMemberActor.ts、confirmMemberActor.ts、registerBranchConfirmedMemberActor.ts、rejectMemberActor.ts；共享handler support本包actors/shared |
| staff-auth/features/actors/actors.ts | authResultActor/authNavigationActor/authNoticeActor/authSystemNoticeActor.ts |
| member-desk/features/actors/actors.ts | deskNavigationActor/deskFormActor/deskPendingActor/deskConfirmedActor/deskRejectedActor/deskNoticeActor/deskSystemNoticeActor.ts |
| wallpaper-picker/features/actors/actors.ts | wallpaperPickerActor.ts、wallpaperPickerEntryActor.ts |
| 两integration/application/module.ts | declarations/commands.ts；features/actors/ownerStageRouteActor.ts；具名route/interlock/loginAllowed/mutationAllowed selectors；module只factory |
| 两integration中的activationRoute逻辑 | terminal-activation/features/actors/terminalActivationRouteActor.ts；integration删掉对应实现 |
| input/contexts/context.ts 的多hook | hooks/useInputController/useInputPendingFocusCommit/useInputKeyboardState/useInputFieldKeyboardState/useInputScrollAncestor.ts；context只创建/types |
| render/hooks/useRequest.ts | useRequestInFlight.ts、useTrackedRequest.ts；RenderContext多个hook各具名 |

所有现commands与parts/variables/foundations错误迁declarations；保留身份字符串。命令无需一cmd一文件。现FeatureAssembly三UI包的assembly/assembly.ts转发迁`application/module.ts`完整模块返回，旧公开factory从实际消费者迁完后删。admin-shell的服务配置parts迁server-config-panel/declarations/parts.tsx并由其module返回；update安装提示继续admin-shell呈现、只读update selector并发updateownercommand，不顺手建新update UI包。activation自己的admin status不留admin-shell重复名单。

### 2.2 · 大actor/基础设施

| 当前anchor | 目标能力文件（相对本包src）与共享owner |
|---|---|
| TDC/features/actors/terminalDataClientActor.ts | 保留唯一actor/install入口；actors/shared/installCredentialCommands.ts、installConnectionCommands.ts、installTopicCommands.ts、installRemoteOperationCommands.ts、installTerminalHttpCommands.ts；features/actors/shared/createTerminalDataClientSession.ts持同一epoch/socket/subscriptions/map资源；纯parser仍foundations |
| update/features/actors/terminalUpdateActor.ts | 保留唯一actor；actors/shared/installUpdateAdmissionCommands.ts、installUpdateArtifactCommands.ts、installUpdateBootCommands.ts、installUpdateReportCommands.ts；features/actors/shared/createTerminalUpdateExecution.ts持同一task/readback/report-inflight，纯decision→foundations |
| remote/features/actors/remoteControlActor.ts | 唯一actor＋actors/shared/installRemoteSessionCommands.ts、installRemotePeerCommands.ts、installRemotePortEvents.ts；features/actors/shared/createRemoteControlSession.ts同session/lease |
| topology/features/actors/actors.ts | topologyRoleActor.ts、topologyPairActor.ts等按实际factory定义；application现stateSync/peerCommandController保持；nativeconnection/epoch同模块session不多controller |
| store/features/actors/actors.ts | storeBasicActor.ts唯一definition；actors/shared/loadStore.ts、refreshStoreCollections.ts、refreshStoreDetails.ts、reconcileStoreTopicSubscriptions.ts；共享当前generation/inflight/ref state |
| project/features/actors/actors.ts | projectBasicActor.ts；actors/shared/loadProjectContext.ts、refreshProjectRuleSnapshot.ts、reconcileProjectTopicSubscriptions.ts；候选matching纯selector私有helper |
| runtime/foundations/createCommandDispatcher.ts | 运行协调移application/createCommandDispatcher.ts；application/createRequestLedgerWriter.ts共享ledger，actor/peer dispatchpureaggregates保留现责任；删具体UIcmd diagnostic特判改通用journalobserver |
| runtime lifecycle大单元 | application/createRuntimeLifecycle.ts保留现资源registry、setup/reset/cleanup顺序；无第二失败存储 |
| state/foundations/PersistenceEngine.ts | purecodec/keyspacehelper保留；IOengine移application/PersistenceEngine.ts；共享唯一Promise/cache/dirty/blocked；createPersistenceFlushScheduler.ts单timerdispose |
| input/components/InputSurfaceFrame.tsx | 保留frame/provider/layout；components/InputSurfaceFrameContents.tsx、InputKeyboardOverlay.tsx；hooks/useKeyboardPresentation.ts持唯一animationserial；types/keyboardPresentation.ts、puregeometryfoundations |
| render内startup/failure组件 | components/ScreenReadyBoundary.tsx、StartupFailurePage.tsx、StandaloneStartupFailurePage.tsx，唯一readycompletionowner不复制 |
| admin-shell/TopologySection.tsx | 保留组件，hooks/useTopologyAdminForm.ts收draft+request观察；pureviewfoundation；adminFrameRegistry保留唯一输入/lease事实，puregeometry具名提取 |
| automation-agent module install | application/createAutomationConnection.ts持WS/stop/retry；application/createSelectorSubscription.ts、createCommandObservation.ts现session内具名逻辑；无新协议/registry |
| dev-host/testExpoApp.tsx | components/SurfaceCanvas/SurfaceFormSwitcher/SurfaceWidthControl/HeaderStatus/HostStateCard.tsx；preview状态仍host，不写业务slice |

有读store/dispatch/IO的helper放application或actors/shared，不借名字foundation豁免TR-06；纯函数、types、声明才在各自目录。不同actor如果已有唯一session，提一个模块内部closure供它们使用，不把一个handler复制为两个actor。

### 2.3 · 原生目标

新增adapter/android/transport、topology的package.json/moduleName/dependencies/index/README/invariants/autolink/android目录按现adapter模板；两个新包分别实际执行网络、拓扑socket/host，非纯forward。迁移原application/base/android对应TS/Kotlin实现，保持Expo Name/event/action符号、原server path及系统身份。 AppControl同NativeUpdate的reload事实已有实际共享住址，移入既有adapter/update的`implementations/androidAppControl.ts`和同包`TerminalAppControlModule.kt`，沿本包TerminalUpdateProcess.reload，不新增app-control包或第二reloader。对应source AppControl FQN改update，JS Name仍TerminalAppControl；old base Expo config/Gradle移除，twoApp binding/alias/invariants同步。原生loader/splash仍App入口协作；TSIO在implementations，不foundations。

dual-screen大handler提`TerminalSurfaceFormPolicy.kt`、`TerminalDisplaySnapshotPolicy.kt`、`TerminalSurfaceHostSnapshot.kt`、`TerminalSurfaceHostRegistry.kt`、`PrimaryLaunchOptionsDelegate.kt`、`TerminalPresentation.kt`；ActivityHandler只生命周期/secondarycarrier。update提`TerminalUpdateNativeRecord.kt`、`TerminalUpdateBootController.kt`、`TerminalUpdateBundleSelection.kt`、`TerminalUpdateInstaller.kt`，全接同recordsession；Preparer提download/archive/fullvalidation/hotextraction私有helpers，JDK ZipFile不换库。remote现`RemoteWindowVideoCapturer/RemoteTouchDispatcher/ArgbToI420`责任已清楚保持，只改import和单canonical协议输出。不要为拆文件再加SDKwrapper层。

## 3 · 包私有API完整分配及生成

所有输出为对应owner `src/generated/terminalApi.ts`，只包内application/actors可调用。

| operation | CBS事实owner | TER消费owner | inputs/purpose |
|---|---|---|---|
| activateTerminal | terminal-binding | TDC | body activationCode/deviceId/surfaceForm/appVersion/credentialSecret |
| cancelTerminalActivation | terminal-binding | TDC | terminalRef path；捕获取消前credential |
| terminalReadStoreBasic | organization | store-basic | storeRef→store+operatingrules |
| terminalReadStoreActiveContracts | store-contract | store-basic | storeRef→当前合同集合 |
| terminalReadContract | store-contract | store-basic | contractRef→detail |
| terminalReadStoreServicePointAreas | organization | store-basic | storeRef→启用area集合 |
| terminalReadServicePointArea | organization | store-basic | areaRef→detail |
| terminalReadStoreServicePoints | organization | store-basic | storeRef→启用point集合 |
| terminalReadServicePoint | organization | store-basic | pointRef→detail |
| terminalReadStoreOrganizationPath | organization | project-basic | storeRef→project/region/group |
| terminalReadProjectUpdateRuleSnapshotPage | TERMINAL_UPDATE_RULE | project-basic | projectRef/collectionHash/cursor/limit |
| issueTerminalUpdateArtifactDownloadGrant | TERMINAL_UPDATE_RULE | terminal-update | artifactRef→短期downloadgrant |
| submitTerminalUpdateReport | TERMINAL_UPDATE_REPORT | terminal-update | Idempotency-Key+report body |
| registerTerminalRemoteControl | TERMINAL_REMOTE_CONTROL | remote-control | sessionId+topologyKind/peerIdentity |
| reportTerminalRemoteControl | TERMINAL_REMOTE_CONTROL | remote-control | sessionId+state/reason/readyScreens |

JSON union15；binary download明确排除；canonical事实路径不变。

改`contracts/policy/terminal-client-generation.json`五target；`scripts/generate/terminal-client-api.mjs`中loadModel、renderClient/response schema closure、multitargetcheck；`tools/verify-gates/cli.mjs`中terminalgeneratedface跨targetunion检查；对应`terminal-client-generation`直接测试。原“同operation分给第二owner必红”改合法多消费者，保留同target重复/错face/漏项/输出duplicate/路径escape红。不新建generator。

规范DTO与success/problem解析按真正terminal edge引用：`contracts/openapi/edge.openapi.json`→common `problem.schemas.json`，不是另一个旧code/title Problem文件。status/body.status须一致，2xxsuccessStatus及successschema精确，known/unknown code分开，5xx保持deliveredfailure。canonical不容许extra fields时测试不能用future字段证明“unknowncode合法”；分别测非法body和合法unknowncode。API状态从生成器经TDCrawreceipt到消费owner完整保留。

认证profile统一单常量`terminal-data-client:http`；不再执行该profile、接受偏好时另用`terminal-data-client`。ownerdecoder本次response局部receipt→现transport地址可用command，transport再复核profile/server/configRevision。无需第二TDCaccept接口/响应缓存；状态重读失败只不记偏好，不反转业务成功。TDCcapturedcredential/epoch及owner当前generation/task/session双层fence。当前protocol/logshape不需加凭证到receipt。

## 4 · errors/parameters/既定机制采用

| 逻辑组 | 原机制/漏洞入口 | 最小采用与反例 |
|---|---|---|
| config用户可修正输入 | normalizeAddresses/group/override/proxy/hostOnly普通Error | declarations/errors.ts保留VALIDATION/BUSINESS（host-only为AUTHORIZATION）；constructor默认配置仍Error；请求结果/UI分别断言 |
| Runtime不变量 | brand/registered/owner等runtime错误 | 现规范错误保持；实际可调默认只ParameterDefinition，不把command传参当参数目录 |
| adapter失败 | PortResult/unavailable | 保留不伪装业务AppError；native异常日志原信息，不credentials副本 |
| HTTP业务拒绝 | canonicalproblem | owner私有generated解码复用，status/errorCode不丢；unknowncode不是SYSTEM吞掉 |
| transport timeout/retry/stable | 当前defaultTimeout/retryIntervals/stable窗口 | owner declarations/parameters.ts默认取当前源码，单位ms；override合法类型/范围、默认消费精确值 |
| state debounce | persistenceDebounceMs当前input/default | 参数归State；入口若覆盖显式传一次；dispose无旧timer重入 |
| TDC reconnect/topic/latecache策略 | 当前finite defaults | 实际可调策略集中；WS/protocol cap不参数化，64项既有remoteOps策略不新增总字节quota |
| update boot/安装提醒/报告重试 | 当前bootdeadline、规则N/M、retry | 规则N/M是业务输入，不归静态parameter；boot策略default单源显式传native；不改立即/闲时产品行为 |
| remote帧率/尺寸/queue策略 | 当前adapter配置和canonicalpayloadlimit | 策略拥有者声明、传入SDK，wirelimit固定generated；不重复Kotlin独立fallback |
| UI数值 | 主题/样式尺寸 vs策略 | 局部样式留theme/const；request/presentation策略具名ParameterDefinition，不所有px变配置 |
| definition factory | error 5包使用、parameter此前无生产调用 | 有实际消费才抽；删除无人读AppModule definitions登记，保留静态工厂供direct callers |
| selector参数schema | automation求值真实使用 | 保留注册/导出按名求值；ParameterDefinition不替代SelectorParameterSchema |
| commands/parts/variables | 现brand/factory | declarations集中真实符号，Root只显式barrel，无class/service/getter业务旁路 |
| input/primitives/TestId | 现统一输入/品牌/节点registry | 所有生产入口继续factory；迁目录同步品牌检查，不换测试触发方式 |

defaults值按**当前真实声明逐点机械提取而不改值**；本设计不凭旧摘要指定新秒数。原策略类型、验证条件和消费者数量必须相等。不存在实际可调整行为的算法值/协议常量是合法不提取反例。

## 5 · 不得改变的持久/运行事实

| owner | 唯一identity与恢复事实 | 清除/释放边界 |
|---|---|---|
| contracts/Runtime | moduleName/commandName、RuntimeInstanceId、request/actor/command关联、有限lateobserver | reload新Runtime、旧subscription/retrytimer清；不要fieldmove改brand字符串 |
| State/ui-state | slice names/workspace MAIN/BRANCH、catalogpartkeys、变量owner、descriptor persistedFields | 正常重启恢复合法fields、非persist不恢复；unknown/isolated不apply |
| server-config | selectedSpace/defaultsoverride/proxy与serviceRevision、syncedHostDefaults | 同角色恢复按现owner；retain只实际persistfields，非persist清 |
| TDC | credential同一terminal/binding，acceptedTopicTimes、remoteOpsmap | 普通断线不清；unpair/changehost显式清/flush；cancelrootreset清，不retainsecret |
| terminal-update | currentTask/recentStatus/failedArtifactIds、fixedtarget、actionId/actionKind/publication/bootId | retain按descriptor；executeBoot不在confirm覆写；APK变化作废选包资格，原报告pending不任意截断 |
| native persist | `catering-v2s.terminal.state.v1.`、protected v2、旧protectedv1 marker、MMKV sync | protected失败不plainfallback；不因TS/Kotlin包迁移换namespace |
| 两App | sample-terminal-android / sample-wallpaper-terminal-android、applicationId、native/build/bundlepublication | 保留独立产品/keys；AppVersion单一外部输入派生，不一个dev另一个1.0.0 |
| native update | terminal-update-native.json、terminal-update/prepared、INSTALL_STATUS action/extras、embedded APK身份、bootreservation | owner精确身份清prepared；不按目录名删除他run；FULL/HOT/回退samecurrentrecord |
| native dualscreen | 一个ReactHost/VM/store、PRIMARY/SECONDARY/displayIndex/windowIdentity/generation/lease | Activity/Presentation各window释放；globalregistry唯一，迟到identity拒绝 |
| native topology/network | currentconnection/socket/requestidentity、peerprotocol/moduleName | 旧回调仅归旧socket，remove模块释放listener/thread，不更换wire身份 |
| remote | sessionId/controlseq/screen main/secondary、paired PRIMARY→secondary映射 | track/capture/window按现session释放；无语音、新权限和新终端提示 |

原生协议常量从现`terminal-remote-control` generator额外输出adapter私有generated描述；adapter不反依赖kernel业务owner。JS/JVM字节序、字段、名称都同canonical，公开SDK调用与既有依赖版本不变。

## 6 · 地址producer→consumer闭包

1. 两AndroidApp `package.json`、两integration `package.json`各一份自己的serverSpacesdefaults；不合并或全局fallback。
2. server-config `resolveServerConfigEnvironment.ts`纯具名全service地址替换；defaults validator、actornormalize、slicehydrate/sync使用同地址合法性规则并取消>4；原admin-shell/components/serverConfig/ServerConfigPanel.tsx的add按钮`draft.addresses.length < 4`同根移除，迁新panel后1/2/10都能新增/编辑/保存。
3. 两App `src/assembly/managedServerSpaces.ts`变薄读取自己的defaults及统一environment resolver；两`platformPorts.ts`删除One/Two型inputs；两`test-expo/App.tsx`同型；appversion/defaults从真实入口一个输入传出。
4. `scripts/dev/r5-dev-runner.mjs`及`.d.mts`明确输出clientserverSpacesEnvironment（具名space/service/完整addresses）；HAProxy受管one/two与三TDSnodes数量保持。当前managedfixture的workspaceprefix由source构造，不Android/runner硬写aurora。
5. `tools/terminal-automation/src/runner.ts`读取该集合；androidBuild/entry child env用单`TER_SERVER_CONFIG_ENVIRONMENT_JSON`（Web打包沿同输入Vite允许前缀）；只当前run构建注入，prod无fixturedefaults。
6. `scripts/test/terminal-client-dev-acceptance.mjs`、TDC acceptance/devScenarios.test.ts、driver fixtures/terminalActivation.ts消费同集合；保留bindinggeneration/deviceownership验证。此runner日志受当前规范，不字段级遮盖原stdout/stderr。
7. transport `resolveTransportServerAddresses`不按index继承addressName/timeout，现profilecache/address偏好/configRevision/readback与networkfactory保持；update native首地址download策略不借此改failover。

正常配置可1/2/10，非空和名字唯一而非固定数量；unknownservice/非法URL/timeout整体拒绝，不部分修改owner。环境换名/换集团/切space后“成功HTTP目标”由真实requestreadback证明，不能仅比较序列化字符串。

## 7 · 正本、生成器、门及文档影响面

未来实施同步，当前未修改：`doc/platform/terminal-coding-standard.md`目录/公开边界/参数/装配条款；对应TERpackage模板、`.agents/skills/cs-terminal-automation/SKILL.md`、routed `terminal-coding-standard`指针；`tools/terminal-skeleton/check-static.mjs`、`tools/terminal-runtime/check-static.mjs`及现fixtures；每真实影响包package exports/dependencies/terminal-invariants/README；runtime/ui/state/TDC/API公共使用文档；`scripts/README.md`配置与现CLI；真实generator和target文件。

机械规则只负责：合法目录、indexbarrel、publicexport、foreignprivateimports/reexports（root/alias/relative/require/dynamic）、品牌factory/声明归属、重复身份、nativeclasspath/module登记、schema/pathrootclosure。每新机械形状给生产red；语义归属不做万能数据流AST。实现开始重读模板path和nodealiases，改实际文件，不对不存在模板硬建空框。retired compliance/hash台账不恢复。

zero-use API、private client公开、dead转发assembly、unuseddefinitionsmetadata、重复One/Twoconsumer等在真正callers迁完后删。新adapter建立真实资源能力后移旧native code，不保留旧forward实现。保留contracts纯type、正常typedDTO共享、现admincatalog和Stateopaque注册是合法反例。

## 8 · 第三方依据与证据层级

静态安装/锁图：TypeScript6.0.3、Redux5.0.1、RTK2.12.0、ReactRedux9.3.0、目标React19.2.3、Vitest4.1.10；Expo57.0.18/core57.0.14/splash57.0.9、RN0.86.3、LiveKitRN3.0.0/WebRTC144.2.0/client2.22.4、Playwright1.61.1。全仓另有React/Vitest版本，不声称全仓唯一。native声明MMKV2.4.2/OkHttp4.9.2/NanoHTTPD2.3.1不等同actualGradleclasspath，未来managedfocused必须读actualresolvedgraph。

本批不改变SDK API，主要依赖：Redux subscribe返回unsubscribe，cleanup时取消订阅而非仅丢引用；TypeScriptchecker现机械品牌/import检查；RN/ExposharedHost、LiveKittrack/session释放按现adapter同调用形状。官方依据：Redux精确tag `https://github.com/reduxjs/redux/blob/v5.0.1/src/createStore.ts`；TS `https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/types.ts`；RN `https://github.com/facebook/react-native/tree/v0.86.3`；Expo/LiveKit源码的已安装版本与当前A/remote附件官方精确依据需要在对应CP写前读回，不能以另一版本source解释行为。引用5.9.3/ReactRedux9.2资料不能证明本批6.0.3/9.3，用不到的资料不纳入行为证明。

版本核对/官方约定只说明API，C/F/W/D装配运行都NOT_RUN。native移包改变classpath时仍必须关闭实际解析OPEN；不得为通过而自动升级SDK或新增第三方。


## 9 · 当前canonical方法/path/face

统一prefix=`/api/terminal/group-workspaces/{groupWorkspaceKey}`；下列suffix由generator消费，消费owner不另手写。全部consumer face=terminal，成功status=200，problem statuses按当前canonical400/401/403/404/409/422/429/500/503闭包，不猜每code状态。

| operation | 方法/suffix |
|---|---|
| activateTerminal | POST /activation |
| cancelTerminalActivation | POST /terminals/{terminalRef}/activation/cancel |
| terminalReadStoreBasic | GET /stores/{storeRef}/basic |
| terminalReadStoreOrganizationPath | GET /stores/{storeRef}/organization-path |
| terminalReadStoreActiveContracts | GET /stores/{storeRef}/contracts |
| terminalReadContract | GET /contracts/{contractRef} |
| terminalReadStoreServicePointAreas | GET /stores/{storeRef}/service-point-areas |
| terminalReadServicePointArea | GET /service-point-areas/{areaRef} |
| terminalReadStoreServicePoints | GET /stores/{storeRef}/service-points |
| terminalReadServicePoint | GET /service-points/{pointRef} |
| terminalReadProjectUpdateRuleSnapshotPage | GET /update-rules/projects/{projectRef} |
| issueTerminalUpdateArtifactDownloadGrant | POST /update-artifacts/{artifactRef}/download-grant |
| submitTerminalUpdateReport | POST /update-reports |
| registerTerminalRemoteControl | POST /remote-control-sessions/{sessionId}/registration |
| reportTerminalRemoteControl | POST /remote-control-sessions/{sessionId}/status |

platform-ports承接真正平台网络/peer接口，transport消费这份定义不另定义同名副本；profile/command/retry仍transportowner。新adapter无需import transport/runtime/contracts实现，纯protocol描述由generator私有输出。真实network snapshot读取函数由App现factory绑定owner公开selector，不让adapter读业务store。

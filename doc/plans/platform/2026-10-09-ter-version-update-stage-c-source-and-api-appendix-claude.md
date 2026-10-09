# TER 更新阶段 C：源码、API与验收附件

## 1. 来源与截面

2026-10-09纯读取。B正并行写入，所有行号仅导航；不复制或修改B报告/接口。本附件不是A/B交付review、独立verdict或运行结果。正式需求、同日期C详设/Journey/IA/UI、A/B批准工件为输入。

## 2. 实际复用与尚缺接缝

| 真实文件/锚点（仓根） | 静态事实 | C处理 |
| --- | --- | --- |
| apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts#refreshRuleSnapshot/targetFromRuleSnapshot/executeNextArtifact/reconcile | B完整snapshot与指定rule、A同执行核/HTTPgrant/报告 | 自动择新/N-M尚缺；不新建任务核 |
| 同包src/types/terminalUpdate.ts#FixedUpdateTarget/StoredTerminalUpdateRule | policy仅attempts/T；stored有N/M | port前固定N/M；不猜旧task参数 |
| 同包src/features/slices/terminalUpdate.ts#terminalUpdateRegistration | 全state isolated；task/recent/failed/report持久 | record sync只规则，local事实仍isolated |
| 同包src/application/createTerminalUpdateModule.ts#install | 当前先await reconcile/refresh再subscribe | 改先订阅后初始化检查；resource释放 |
| apps/terminal/kernel/base/platform-ports/src/types/update.ts#UpdatePort | 六方法，无presentation技术观察 | 技术read/subscribe/present接口，命令定义在update非端口 |
| apps/terminal/kernel/base/runtime/src/types/module.ts#RuntimeModuleContext | subscribeState/registerResource/AsyncResource/flush/command | 单份本机点击ephemeral；技术桥不获跨owner写权 |
| apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx#SurfaceRoot | 根View目前onLayout；覆盖sharedRuntime承载 | capture起点，不吞responder；portal另枚举 |
| apps/terminal/ui/base/render/src/components/LayerStack.tsx#layerSelector | BRANCH只合并MAIN业务＋本地admin | 复用 alert tier，local-primary scope＋BRANCH/PRIMARY 本机上下文，不投影 |
| apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts#HELLO / features/actors/actors.ts#pairByHost | 两处moduleName equality、协议1 | 保留同 App/protocol 检查，不扩矩阵；规则 projection 同组 |
| apps/terminal/kernel/base/topology/src/selectors/selectTopologyState.ts#selectTopologyRequiredProjectionsReady | 当前connection/revision资格 | BRANCHupdategate独立必要集合 |
| apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts#sendStateSnapshots | 每slice发送record snapshot、可chunk | 规则专门entry，无跨slice总包假设 |
| apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts#projectActorResults | result原样JSON、帧64KiB | compactgrant，不传完整manifest |
| apps/terminal/kernel/base/transport/src/foundations/createTopologySession.ts#sendStateFull | 分片只statefull，不是command | 不新增peer result分片 |
| apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts#requestTerminalUpdateDownloadGrantCommand/submitTerminalUpdateReportCommand | MASTER/active/credential，仅TDC注入认证 | 副机先经MAINupdate命令grant；report永远local |
| apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx、sample-wallpaper-console同路径#createTerminalUpdateModule | reader本机activation＋store/projectflushed；sync无update | BRANCH独立投影reader，不能copyactive |
| apps/terminal/adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateRuntime.kt#resumePendingInstallerConfirmation | foreground旧exactIntent恢复；session持久事实 | N由owner，native只present当前系统确认 |
| 同目录TerminalUpdateArtifactPreparer.kt#prepare/extractFull/extractHot | JDKZipFile、流式摘要、既有清单/file校验 | summaryexpectation加入同path；不新解析库 |
| tools/terminal-automation/src/runner.ts#updateCases/phaseSuite/parseArgs | Aupdatecases；peer-device仅capabilitiesdual当前允许 | C显式扩policy/pair，未知未实现reject |
| tools/terminal-automation/src/androidDevice.ts#attachDriver/attachManagedServicePorts、androidAutomationConnection.ts、androidCleanupRecovery.ts及对应tests | 当前只管理 reverse；pair forward、两 session 与精确映射清理尚缺 | 沿现有 driver 增加 run-owned forward/reverse；详设 §10b.6.1，零旧 runner复活 |
| tools/terminal-automation/src/managedRun.ts#TerminalAutomationManifest | 已有peerDeviceSerial类型但非C双device生命周期 | exact两serial/两package/清理identity，不假称已实现 |

B当前前置OPEN精确入口：RuleOwnerApi.java#RuleSnapshotItem、TerminalUpdateRuleOwnerService.java#readSnapshot、TerminalUpdateRuleReadController.java#mapItem与generatedwire required createdAt；报告schemaUUID与TERtaskId语义；CBSreportPOST/persistence及無任务actual producer。模块根均 apps/backend/catering-business-server/modules/terminal-update 或 src/main/java/com/catering/v2s/app/edge/terminal。这些列为B待最终读回，不转成C新增业务。

## 3. 第三方实际版本与官方行为

本轮仅package/source读取，**没有安装或classpath重新解析/编译/运行**。node_modules实际package为react-native0.86.3、react-native-web0.21.2；依赖树/NativeHermes/Androidtools最终实际解析仍在CP-01重核。Expo57.0.18及Aloader路线继续其精确版本依据，C不升级或装expo-updates。

| 能力 | 对应版本一手依据 | 本次结论/未来最低proof |
| --- | --- | --- |
| RN responder捕获/不抢输入 | [RN0.86.3 ViewPropTypes](https://github.com/react/react-native/blob/v0.86.3/packages/react-native/Libraries/Components/View/ViewPropTypes.js)；仓内251附近capture契约 | onStartShouldSetResponderCapture返回false只观察；组件原action＋真实Web/Android点击证明 |
| Web View同responder | [RNW0.21.2 View](https://github.com/necolas/react-native-web/blob/0.21.2/packages/react-native-web/src/exports/View/index.js)、[useResponderEvents](https://github.com/necolas/react-native-web/blob/0.21.2/packages/react-native-web/src/modules/useResponderEvents/index.js) | 实际View拆出capture交ResponderSystem；不能假设任意DOMpointerCapture都被转发 |
| RN前后台观察 | [RN0.86.3 AppState](https://github.com/react/react-native/blob/v0.86.3/packages/react-native/Libraries/AppState/AppState.js)；change listener返回可remove订阅，initialState可能null | 技术adapter桥read＋subscribe→本包command，null不可呈现；foreground/systemUI实际测试 |
| Android sessioncommit | [SessionInfo.isCommitted官方API](https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionInfo#isCommitted())（API29）、[Session.commit](https://developer.android.com/reference/android/content/pm/PackageInstaller.Session#commit(android.content.IntentSender)) | 未来最低API≥29已Dexter裁决；pendingIntent/state以A当前精确SDK源码和focused为准，非API存在即证明 |
| FULL/HOT加载/资源 | A附件Expo公开Hosthandler、RN0.86.3 asset/file资源及APK metadata | C不换路线；summarysource影响清单校验做focused，未改loader不重做全部 |
| timers | Runtime现有setTimeout/clearTimeout资源用法；N/M上界86400s | 非准实时后台能力；单deadline/resume重读，fakeclock及真实至少1分钟，不轮询 |
| automation | tools/terminal-automation当前vitest/driver/RxJS/ws/adbkit源码、.agents skill | 不新增runner；systemUI仅现有窄例外。actual版本CP-01核对，不复制网络生命周期 |

新增网络依据：本机 SDK `source.properties` 静态读到 Platform Tools **37.0.1**、Emulator **37.2.12**；根 node_modules 的 @devicefarmer/adbkit **3.3.9**。这些是安装截面，实际 ADB_PATH/设备系统/启动参数仍 CP-01 读回，未运行 adb。官方 [Platform Tools 37.0.1 release notes](https://developer.android.com/tools/releases/platform-tools#37-0-1-july-2026)、[ADB 命令一手源码](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/client/commandline.cpp)支持 forward/reverse、no-rebind/list/remove 的一般语法；该源码为 main，不是37.0.1的精确发布tag，本次尝试的tag未能取得，故“精确版本行为”仍 OPEN。未来 CP-01 核实际37.0.1 `adb help` 的参数与相应版本官方源码，CP-05 focused/真实pair证明建连与清理，不能把网页当运行PASS。

网络前提须区分版本：[官方 emulator interconnection](https://developer.android.com/studio/run/emulator-networking-interconnect) 说明36.5起共享Wi-Fi可直接互通，早期实例默认隔离；不能把“两模拟器永远互不可达”当事实。C统一采用显式owned forward＋[10.0.2.2宿主loopback](https://developer.android.com/studio/run/emulator-networking-address)，不依赖其发现/动态IP，不新增两种运行方案。当前 topology normalizePairHost只接受裸host，locator固定43172/basePath；所以forward宿主端口沿其固定值，SLAVE填10.0.2.2，不用tcp:0另选端口后偷偷给host加冒号。

已读 adbkit3.3.9 `dist/src/adb/command/host-serial/forward.js` 和 `host-transport/reverse.js`：现有实现没有 no-rebind 分支。新 pair 映射沿 driver 已有参数数组式 adb 子进程，避免另写ADB wire或新增依赖；原有reader/identity/资源生命周期复用。精确命令与manifest/预算/失败/cleanup见详设§10b.6.1。以上仅静态源码和官方说明，实际网络仍NOT_RUN。

官方链接本轮已打开RN精确tag/RNW精确tag/AndroidAPI。API说明不是本仓native配置/装配PASS；API29不是全部设备静默安装保证。

## 4. 有限容量、协议与摘要链

1. TDP与topologypeer command单帧65,536字节不变。grant完整manifest可能任意多file，command下行只摘要、相对path、43字符grant、expiry、artifactRef，不含files/完整JSON或ZIP。完整信封按现有codec字符串/depth/frame规则检查，真实大清单仍compact；path沿Bschema，不截断。超限可见failure，不增加result分片。
2. 当前 topology reassemblyMaxBytes=8,388,608、maxInflight=2、chunkTarget=49,152、maxChunkCount=512 沿用，**不为假设最大项目规则扩预算或新增分片机制**。B HTTP 集合上界不能直接当作含 context 的 projection 一定可传；按现有完整序列化/帧门判定，超过原技术边界明确 projection-failed、未固定资格不 ready，不静默截断。主流程 focused 使用正常少量规则及现有边界拒绝；不新增项目规则条数上限，不建设最大规模专项或内存峰值探针。若真实业务规模触及限制，再以具体输入回评，不提前改协议。
3. snapshot逐slice传输：不累计所有owner状态变成一个巨大scope包。generation/readiness沿现有controller，chunks完成并apply成功才ready，失效/failed不能择新；无“部分规则也可执行”。
4. native summary 判别：固定 artifactRef/ZIP SHA → MAIN grant 授权 → BRANCH 验 ZIP。HOT 从 ZIP 的 terminal-update-publication.json 核固定 identity/entry/files；FULL ZIP 只有 APK，summary.apk 取现有 grant.manifest.apk 的 path/sha256/certificateSha256 → 同 extractFull/validateFull ，summary 只重建既有 platform/applicationId/nativeVersion/nativeBuildNumber/apk，不解析未安装 APK metadata。已安装 boot 的 metadata 身份读取仍保留。摘要来自 CBS，不相信任意自描述。ZIP SHA、APK SHA、publicationId 不混用；沿现有 JDK ZipFile，不改容器格式/HTTP operation/loader。
5. 任务/报告容量及历史由B最终accepteddesign处理，C不新增总字节quota/第二失败存储。onebootone规则/oneactive timer/onegrant attempt来自实际业务不变量，不限制项目规则数量。

## 4.1 执行 boot 与报告持久化

复用 types/terminalUpdate.ts:51 的 task.bootId，不新增 executionBootId。actor 当前 L673/677 执行前准入改为本 boot 首次 prepare/apply 前一致更新＋flush；L710/L1006 结果确认不覆写；L969 FULL→HOT 只恢复 fixed，HOT 真正执行前再写；L1194 初始 null；L900–905 终态跨 boot释放沿用。全部写/读点表见详设 §8.2，包括 prepared 直接 apply 路径。

报告新枚举/原因优先消费 B 最终 canonical/Flyway；CP-01 重开其 terminal_report state/reason 类型/约束及 taskId=null、recent 非空合法性。若需 SQL，唯一具名差量为 apps/backend/catering-business-server/src/main/resources/db/migration/V<实际下一版本>__terminal_update_report_policy_states.sql，按详设 §10 只改既有表约束；无约束则零迁移，不能凭旧“无新 Flyway”跳过检查。

## 5. TestId唯一表（计划新增，非当前存在）

唯一源 `apps/terminal/ui/base/terminal-update-presentation/src/foundations/terminalUpdatePresentationTestIds.ts`，品牌TestId只createTestId(module,part,{element?,key?})。

| 常量 | 元素 | 表达式语义 |
| --- | --- | --- |
| invitation | 容器（仅可见性） | createTestId(moduleName,'install-invitation') |
| versions | 实际Text | createTestId(moduleName,'install-invitation',{element:'versions'}) |
| deferInstall | 实际Button | 同part，element:'defer' |
| confirmInstall | 实际Button | 同part，element:'install' |

UI/IA/driver只引用上述同名常量，不散写字符串；display/surface在query参数，不进TestId。内容/admin/键盘/配对/后台控件取原owner既有常量，C不造重复ID。

## 6. 验证/fixture API接缝

唯一受管入口scripts/test/terminal-automation.mjs。拟扩--phase update --case update.auto-selection/update.idle/update.install-reminder/update.pair/update.supply-chain；具体已有phase闭集由CP-05统一扩，不能在文档假称今日可运行。两个样本取--sample console/wallpaper；Web/Android同共享businessJourney；Android serial/peer-device-serial 唯一匹配 assigned identity；交叉矩阵：console 真机双屏、wallpaper mobile 虚拟机、console 双虚拟机配对、wallpaper 双虚拟机配对，共 4 个设备 run，Web 两 integration 在前、13c 在后。pair 不跑 Web topology、不跑未改的不同 App 拒绝设备用例。pair 是 laptop 单屏：display 映射复用现有 mobile 单屏能力，case 明确注入 application surfaceForm=laptop；不能由 shape 推成 mobile 业务机型。

真实data来源Bcanonical generatedHTTP和r5-fullseedkey；主机激活与fixturecleanup复用driveroperationshelper，不复制devScenarios逻辑。副机从已paired非秘密state开始，不激活term-handheld；该key仅是assignedfixture/形态导航，不将其独立绑定然后再称副机。

后台流程账号由managed reader读，权限PROJECTscope/capability；报告消费者是运营右Tab，生产者是主机TER update HTTP；不能用直接SQL造report、伪TDSmessage、fixturetargetaccept替换自动择新。供给链复用B §15.2a现有同父run：`terminal-automation`的`update.supply-chain`通过`terminalUpdateSupplyUi.ts`做后台DOM操作，通过agent做TER React操作；该run拥有新建browser/context/session和设备资源，DEV的Vite/tunnel仅借用。当前runner已注册Android supply-chain，C的Web/自动策略/双机场景仍须CP-05接线，不能据现有注册声称C可运行。未来运行前详设§3a控件与准入精确复核。

## 7. 实施期同步全集与OPEN

原子组见详设§9a；publicexports/README/terminal-invariants注册、platformports defaultUnavail、两App composition、topology existingprotocol/types、state sync/codec、nativeadapter同组。包layout按标准src/moduleName/dependencies/application/features/selectors/components建立；没有未消费公开API。

OPEN包括A/B在途出口/接口、B最终报告新枚举及taskId=null recent形状、C真实UI行为、技术/权限/真实安装/双机/资源预算；Dexter已确认IA及低保真邀请内容，不代表动态通过。本次运行均NOT_RUN。恶意ZIP/symlink/bomb专项目标按A/B最新收敛保持NOT_COVERED，不因C追补极端基础设施；普通有效/摘要/path检查不能删。

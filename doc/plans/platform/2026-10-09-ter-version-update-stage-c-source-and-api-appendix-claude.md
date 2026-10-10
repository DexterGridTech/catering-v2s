# TER 更新阶段 C：源码、API与验收附件

## 1. 来源与截面

2026-10-10 当前源码纯读取，未读运行产物；B 未由本次静态评审宣告验收，所有行号仅导航；不复制或修改B报告/接口。本附件不是A/B交付review、独立verdict或运行结果。本轮追加输入为共享凭证PROPOSED提案及Dexter“CBS仅凭证鉴权、所有修改纳入C”；正式正本未改，当前差量是设计计划，非实现。正式需求、同日期C详设/Journey/IA/UI、A/B批准工件为输入。

## 2. 实际复用与尚缺接缝

| 真实文件/锚点（仓根） | 静态事实 | C处理 |
| --- | --- | --- |
| apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts#refreshRuleSnapshot/targetFromRuleSnapshot/executeNextArtifact/reconcile | B完整snapshot与指定rule、A同执行核/HTTPgrant/报告 | 规则HTTP/topic/数据搬至project-basic；update公开local command及actor接候选、比较/固定/执行；不新建任务核 |
| 同包src/types/terminalUpdate.ts#FixedUpdateTarget/StoredTerminalUpdateRule | policy仅attempts/T；stored有N/M | port前固定N/M；不猜旧task参数 |
| 同包src/features/slices/terminalUpdate.ts#terminalUpdateRegistration | 全state isolated；task/recent/failed/report及规则字段按当前源码核 | 移出规则descriptor与旧读面；整个update slice仍isolated，fixed task.target保留已接受执行事实 |
| 同包src/application/createTerminalUpdateModule.ts#install | 当前先await reconcile/refresh再subscribe | 规则启动/刷新搬project-basic；update仅执行初始化/reconcile及技术观察，先订阅后检查、resource释放 |
| apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts#loadOrganizationAndContracts、src/features/slices/slice.ts、selectors/selectors.ts | 当前organizationPath/三个组织topic/项目加载门在store，组织失败会阻断同函数后续合同 | 拆成project-basic组织链和store合同链；门店成功广播仍在store，服务点前提不变，不留旧组织selector兼容转发 |
| apps/terminal/kernel/base/platform-ports/src/types/update.ts#UpdatePort | 六方法，无presentation技术观察 | 技术read/subscribe/present接口，命令定义在update非端口 |
| apps/terminal/kernel/base/runtime/src/types/module.ts#RuntimeModuleContext | subscribeState/registerResource/AsyncResource/flush/command | 单份本机点击ephemeral；技术桥不获跨owner写权 |
| apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx#SurfaceRoot | 根View目前onLayout；覆盖sharedRuntime承载 | capture起点，不吞responder；portal另枚举 |
| apps/terminal/ui/base/render/src/components/LayerStack.tsx#layerSelector | BRANCH只合并MAIN业务＋本地admin | 复用 alert tier，local-primary scope＋BRANCH/PRIMARY 本机上下文，不投影 |
| apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts#HELLO / features/actors/actors.ts#pairByHost | 两处moduleName equality、协议1 | 保留同 App/protocol 检查，不扩矩阵；规则 projection 同组 |
| apps/terminal/kernel/base/topology/src/selectors/selectTopologyState.ts#selectTopologyRequiredProjectionsReady | 当前connection/revision资格 | BRANCHupdategate独立必要集合 |
| apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts#sendStateSnapshots | 每slice发送record snapshot、可chunk | 规则专门entry，无跨slice总包假设 |
| apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts#projectActorResults | result原样JSON、帧64KiB | 不再承载artifact grant，删中转command，不新result分片 |
| apps/terminal/kernel/base/transport/src/foundations/createTopologySession.ts#sendStateFull | 分片只statefull，不是command | 不新增peer result分片 |
| apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts#requestTerminalUpdateDownloadGrantCommand/submitTerminalUpdateReportCommand | 当前MASTER/active gate；仅TDC注入认证 | 十类普通HTTP允许持久credential的两端本机直调，report仍MASTER；详设§8.6.2逐operation闭集 |
| apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx、sample-wallpaper-console同路径#createTerminalUpdateModule | reader本机activation＋store/projectflushed；sync无update | 装配project-basic模块及两个record entry，更新纯selector身份接缝/当前周期gate；不复制feature业务逻辑，不copyactive |
| apps/terminal/adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateRuntime.kt#resumePendingInstallerConfirmation | foreground旧exactIntent恢复；session持久事实 | N由owner，native只present当前系统确认 |
| 同目录TerminalUpdateArtifactPreparer.kt#prepare/extractFull/extractHot | JDKZipFile、流式摘要、既有清单/file校验 | 直接HTTP manifest沿原path，不加peer summary分支/解析库 |
| tools/terminal-automation/src/runner.ts#updateCases/phaseSuite/parseArgs | Aupdatecases；peer-device仅capabilitiesdual当前允许 | C显式扩policy/pair，未知未实现reject |
| tools/terminal-automation/src/androidDevice.ts#attachDriver/attachManagedServicePorts、androidAutomationConnection.ts、androidCleanupRecovery.ts及对应tests | 当前只管理 reverse；pair forward、两 session 与精确映射清理尚缺 | 沿现有 driver 增加 run-owned forward/reverse；详设 §10b.6.1，零旧 runner复活 |
| tools/terminal-automation/src/managedRun.ts#TerminalAutomationManifest | 已有peerDeviceSerial类型但非C双device生命周期 | exact两serial/两package/清理identity，不假称已实现 |

B 当前已存在的精确入口：`TerminalUpdateRuleOwnerApi.java#RuleSnapshotItem`（规则自身 createdAt）、`TerminalUpdateRuleOwnerService.java#terminalSnapshot`、`TerminalUpdateRuleReadController.java#wire`；`TerminalUpdateReportController.java#submit`、`TerminalUpdateReportOwnerService.java#record`、`TerminalUpdateReportPersistence.java` 和 `V20261014_000000_000__terminal_update_report_history.sql`。TER taskId 用 createProtocolUuid。未闭合行为见本轮 B 源码评审：自然无任务 observation、同 binding 序号、HTTP 处置/状态映射、候选 await 重核及 owner 当前绑定复核；有限整快照重读随最终规则链搬移。静态接口存在不等于这些行为正确或运行通过，不转成 C 第二报告能力。

### 2.0 共享凭证与CBS认证源码事实（未修改源码）

| 来源锚点 | 当前事实/最小C差量 |
| --- | --- |
| TDC types/client.ts:25–32，slices/terminalDataClient.ts:35–48,211–223 | 六字段credential；replaceCredential会置active，protected/isolated。只原slice改plain/单record，SLAVE不伪active；其他TDC字段不复制。 |
| TDC actor:913–926,932,1104,1147,1213,1457；generated/terminalApi.ts:343–358 | 当前13项catalog全有MASTER gate；initialize把hydrate与connect绑一起。C十类HTTP两端，bootstrap/cancel/report/TDS仍主机；拆初始化，不全包放开。 |
| state/foundations/persistencePrimitives.ts:129–150、persistenceEngine.ts#hydrate/#flush | 同key跨plain/protected旧存储已支持先写后删。C复用迁移/flush，不重造credential migration。 |
| Android persist-kv/TerminalPersistKvModule.kt:159–184 | plain不crypt，protected有crypt key；本次仅credential descriptor变plain。 |
| state/foundations/createStateRuntime.ts:137–180,233–268；TopologyStateSyncController.ts:355–404 | 同步apply/记revision不await保存；C TDC owner flush＋identity后才HTTP/publish。 |
| topology/features/actors/actors.ts:592–671,741–751 | unpair先改角色、未清TDC；瞬断保留pair。C显式transition前TDC clear/flush，普通断链不清。 |
| terminal-binding/api/TerminalCredentialVerificationApi.java:29–37；application/TerminalCredentialDecision.java:12–32；edge/terminal/TerminalCredentialEdgeVerifier.java:20–40 | 当前deviceId必填且与boundDeviceId比较。Dexter新裁决删除后续CBS设备认证，不能把旧字节说成已兼容；同owner新增CBS具名无设备入口、保留TDS原verify/设备匹配；共用查询/分类，不复制认证器。 |
| edge/terminal/TerminalActivationCancellationController.java:40–49；terminal-binding/application/TerminalBindingOwnerService.java:119–160 | cancel body要求deviceId并共用Decision，成功锁绑定/审计/notify。C移除设备认证body、保留撤销闭包与副机command拒绝。 |
| stateSlice/status projection及两assembly stateSyncSlices | 已有原slice及非秘密status投影装配。C只新增credential单entry保存接缝，status不复制credential。 |

13项caller、准入与最新认证规则仅定义于详设§8.6.2；本附件不另建第二规则表。当前源码所有修改/测试/动态NOT_RUN，行号只截面导航。

### 2.1 2026-10-10 project-basic搬移与依赖核对

当前源码仍是旧owner：store-basic的types/types.ts、features/actors/actors.ts、features/slices/slice.ts和selectors/selectors.ts拥有organizationPath、PROJECT/REGION/COMMERCIAL_GROUP及projectStatus/projectRef；terminal-update的actors/module/slice/selectors拥有规则分页、topic及ruleSnapshot。以下是C计划，不是已实现。

| 创建/修改/删除范围 | 唯一落点与验收 |
| --- | --- |
| 创建kernel/feature/project-basic标准包，src/{moduleName,dependencies,index}.ts、types、application/module、features/{actors,commands,slices}、selectors、test/projectBasic.test.ts、package/README/invariants | 组织资料/完整规则HTTP、topic、保存flush/接受、当前周期状态、两个record entry；feature选业务候选并发送update公开local command |
| 修改store-basic对应源与test/storeBasic.test.ts | 保留store及经营规则/合同/服务点；组织函数搬出，拆开合同加载；loaded no-op handler改为本包合同/服务点入口，删除广播返回后的重复初始化及门店失败旧helper；已成功initialize只重发同command。删除旧组织字段/descriptor、项目前提、三个topic及四个组织selector，不做兼容转发 |
| 修改terminal-update对应源与test/terminalUpdate.test.ts | 删除规则HTTP/topic/快照descriptor及selectTerminalUpdateRuleSnapshot、refreshTerminalUpdateRuleSnapshotCommand；规则用例搬projectBasic.test.ts；公开requestTerminalUpdateCommand与actor保留实际比较、固定、执行、报告 |
| 两integration的src/assembly/assembly.tsx、dependencies/package/invariants、直接测试 | 安装project-basic，登记两record投影；用新公开组织/规则selector绑定身份复核。assembly零业务HTTP/effect选规则；feature→base单向，store不反向import project，update不import feature |
| publicExports/README/selector注册、验收与automation中的实际引用 | 删除selectStoreOrganizationPath/selectStoreProject/selectStoreRegion/selectStoreCommercialGroup旧导出，改selectProjectOrganizationPath/selectProject/selectRegion/selectCommercialGroup及新readiness/rules selector；不重造生成HTTP |

主机具体门店HTTP/flush成功后发既有storeBasicInformationLoadedCommand；同command的store listener启动合同/服务点，project listener核具体store.id/space/project.id、当前runtime/binding/flushed后才启动组织→规则；Runtime fan-out可等待两listener，但两个下游互不等待。project先注册再initialize，晚装经initializeStoreBasicCommand请当前成功store重发同command，零重复门店首查；两listener各自in-flight/完成身份去重，loaded handler不能initialize循环。失败门店不发成功command、零下游首查。组织路径仍用terminalReadStoreOrganizationPath；副机只读当前connection应用成功且值身份匹配的投影，MAIN失败对应entry导出tombstone，不以旧正文择新，零组织/规则HTTP/TDP；升级请求也是本机local command。已有store DTO的project关联标签保留，不冒充权威项目详情。

移除descriptor后旧键不再hydrate，不能声称会自动物理删除；只能由之后获授权的既有root reset清orphan。首次project数据通过真实HTTP重建，不reset搬移、不增回填层。update已固定task.target是已接受执行事实，task/recent/failed/report按A/B retain保持；project-basic不retain。TDC订阅本身不持久，新Runtime按新subscriberKey重建，接受时间不迁移成第二订阅账本。

有限同根核对：组织字段/三个topic/四个旧selector及项目门、update规则加载/旧读面、两assembly装配与测试；未来focused覆盖组织失败不挡合同、当前周期/late install、通知保存再接受、候选command身份、投影apply与本机任务隔离。详设§8.0/§9a.7为实施落点。

## 3. 第三方实际版本与官方行为

本轮仅package/source读取，**没有安装或classpath重新解析/编译/运行**。node_modules实际package为react-native0.86.3、react-native-web0.21.2；依赖树/NativeHermes/Androidtools最终实际解析仍在CP-01重核。Expo57.0.18及Aloader路线继续其精确版本依据，C不升级或装expo-updates。

| 能力 | 对应版本一手依据 | 本次结论/未来最低proof |
| --- | --- | --- |
| RN responder捕获/不抢输入 | [RN0.86.3 ViewPropTypes](https://github.com/react/react-native/blob/v0.86.3/packages/react-native/Libraries/Components/View/ViewPropTypes.js)；仓内251附近capture契约 | onStartShouldSetResponderCapture返回false只观察；组件原action＋真实Web/Android点击证明 |
| Web View同responder | [RNW0.21.2 View](https://github.com/necolas/react-native-web/blob/0.21.2/packages/react-native-web/src/exports/View/index.js)、[useResponderEvents](https://github.com/necolas/react-native-web/blob/0.21.2/packages/react-native-web/src/modules/useResponderEvents/index.js) | 实际View拆出capture交ResponderSystem；不能假设任意DOMpointerCapture都被转发 |
| RN前后台观察 | [RN0.86.3 AppState](https://github.com/react/react-native/blob/v0.86.3/packages/react-native/Libraries/AppState/AppState.js)；change listener返回可remove订阅，initialState可能null | 技术adapter桥read＋subscribe→本包command，null不可呈现；foreground/systemUI实际测试 |
| Android sessioncommit | [SessionInfo.isCommitted官方API](https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionInfo#isCommitted())（API29）、[Session.commit](https://developer.android.com/reference/android/content/pm/PackageInstaller.Session#commit(android.content.IntentSender)) | 未来最低API≥29已Dexter裁决；pendingIntent/state以A当前精确SDK源码和focused为准，非API存在即证明 |
| FULL/HOT加载/资源 | A附件Expo公开Hosthandler、RN0.86.3 asset/file资源及APK metadata | C不换路线；直接HTTP工件输入影响按差量focused，未改loader不重做全部 |
| timers | Runtime现有setTimeout/clearTimeout资源用法；N/M上界86400s | 非准实时后台能力；单deadline/resume重读，fakeclock及真实至少1分钟，不轮询 |
| automation | tools/terminal-automation当前vitest/driver/RxJS/ws/adbkit源码、.agents skill | 不新增runner；systemUI仅现有窄例外。actual版本CP-01核对，不复制网络生命周期 |

新增网络依据：本机 SDK `source.properties` 静态读到 Platform Tools **37.0.1**、Emulator **37.2.12**；根 node_modules 的 @devicefarmer/adbkit **3.3.9**。这些是安装截面，实际 ADB_PATH/设备系统/启动参数仍 CP-01 读回，未运行 adb。官方 [Platform Tools 37.0.1 release notes](https://developer.android.com/tools/releases/platform-tools#37-0-1-july-2026)、[ADB 命令一手源码](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/client/commandline.cpp)支持 forward/reverse、no-rebind/list/remove 的一般语法；该源码为 main，不是37.0.1的精确发布tag，本次尝试的tag未能取得，故“精确版本行为”仍 OPEN。未来 CP-01 核实际37.0.1 `adb help` 的参数与相应版本官方源码，CP-05 focused/真实pair证明建连与清理，不能把网页当运行PASS。

网络前提须区分版本：[官方 emulator interconnection](https://developer.android.com/studio/run/emulator-networking-interconnect) 说明36.5起共享Wi-Fi可直接互通，早期实例默认隔离；不能把“两模拟器永远互不可达”当事实。C统一采用显式owned forward＋[10.0.2.2宿主loopback](https://developer.android.com/studio/run/emulator-networking-address)，不依赖其发现/动态IP，不新增两种运行方案。当前 topology normalizePairHost只接受裸host，locator固定43172/basePath；所以forward宿主端口沿其固定值，SLAVE填10.0.2.2，不用tcp:0另选端口后偷偷给host加冒号。

已读 adbkit3.3.9 `dist/src/adb/command/host-serial/forward.js` 和 `host-transport/reverse.js`：现有实现没有 no-rebind 分支。新 pair 映射沿 driver 已有参数数组式 adb 子进程，避免另写ADB wire或新增依赖；原有reader/identity/资源生命周期复用。精确命令与manifest/预算/失败/cleanup见详设§10b.6.1。以上仅静态源码和官方说明，实际网络仍NOT_RUN。

官方链接本轮已打开RN精确tag/RNW精确tag/AndroidAPI。API说明不是本仓native配置/装配PASS；API29不是全部设备静默安装保证。

## 4. 有限容量、协议与摘要链

1. TDP与topology command单帧65,536字节不变。C删除artifact grant peer中转，manifest经本机TDC HTTP取得，不走peer。credential只六字段或null，经现有record/state分片；不复制connection/PING/topic/result等。原完整信封/深度/帧规则保留，无新增result分片。CBS短期download grant仍沿原HTTP/content校验。
2. 当前 topology reassemblyMaxBytes=8,388,608、maxInflight=2、chunkTarget=49,152、maxChunkCount=512 沿用，**不为假设最大项目规则扩预算或新增分片机制**。B HTTP 集合上界不能直接当作含 context 的 projection 一定可传；按现有完整序列化/帧门判定，超过原技术边界明确 projection-failed、未固定资格不 ready，不静默截断。主流程 focused 使用正常少量规则及现有边界拒绝；不新增项目规则条数上限，不建设最大规模专项或内存峰值探针。若真实业务规模触及限制，再以具体输入回评，不提前改协议。
3. project-basic organization/rules两个entry沿既有record snapshot逐slice传输；update不提供规则entry。不累计所有owner状态变成一个巨大scope包。generation/readiness沿现有controller，chunks完成并apply成功才ready，失效/failed不能择新；无“部分规则也可执行”。
4. native既有输入：固定工件→各机TDC HTTP取得CBS grant/manifest→本机ZIP验证。HOT核ZIP publication/entry/files；FULL从grant.manifest.apk取path/sha/cert，沿extractFull/validateFull及platform/applicationId/nativeVersion/nativeBuildNumber，不解析未安装metadata、不增加peer summary分支。ZIP SHA/APK SHA/publicationId独立，已安装boot metadata路径保留，沿JDK ZipFile不换格式/下载器。
5. 任务/报告容量及历史由B最终accepteddesign处理，C不新增总字节quota/第二失败存储。onebootone规则/oneactive timer/onegrant attempt来自实际业务不变量，不限制项目规则数量。

## 4.1 执行 boot 与报告持久化

复用 types/terminalUpdate.ts 的 task.bootId，不新增 executionBootId。当前 actor 锚点：executeNextArtifact L998–1017 为执行前准入；其 selected=null 成功 L1045–1052 不覆写；reconcile FULL→HOT fixed L1308–1316 只恢复 fixed，HOT 真执行前再写；action updated L1347–1352 不覆写；accept next task L1560–1579 初始 null；终态跨 boot释放 L1246–1255 沿用。全部写/读点表见详设 §8.2，包括 prepared 直接 apply 路径。

当前 report history migration 的 actual/recent 是 JSONB object，未按状态/原因枚举设 SQL CHECK，taskId=null observation 合法且 recent 为对象；C 新有限码默认零 Flyway，只原子同步 canonical/generated、CBS controller/owner 校验、TER 与运营 formatter。CP-01 重开最终形状，真有 SQL 约束差异才列具体迁移，不预建假设 migration。descriptor/counter/pending/pause 留 base/update，同 binding context 变化保留 counter；project-basic 不复制报告职责。

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

唯一受管入口scripts/test/terminal-automation.mjs。拟扩--phase update --case update.project-data/update.auto-selection/update.idle/update.install-reminder/update.pair/update.supply-chain；具体已有phase闭集由CP-05统一扩，不能在文档假称今日可运行。两个样本取--sample console/wallpaper；Web/Android同共享businessJourney；Android serial/peer-device-serial 唯一匹配 assigned identity；交叉矩阵：console 真机双屏、wallpaper mobile 虚拟机、console 双虚拟机配对、wallpaper 双虚拟机配对，共 4 个设备 run，Web 两 integration 在前、13c 在后。pair 不跑 Web topology、不跑未改的不同 App 拒绝设备用例。pair 是 laptop 单屏：display 映射复用现有 mobile 单屏能力，case 明确注入 application surfaceForm=laptop；不能由 shape 推成 mobile 业务机型。

真实data来源Bcanonical generatedHTTP和r5-fullseedkey；主机激活与fixturecleanup复用driveroperationshelper，不复制devScenarios逻辑。副机从已paired业务projection及已持久化的共享TDC credential开始，不激活term-handheld；该key仅是assignedfixture/形态导航，不将其独立绑定然后再称副机。

后台流程账号由managed reader读，权限PROJECTscope/capability；报告消费者是运营右Tab，生产者是主机TER update HTTP；不能用直接SQL造report、伪TDSmessage、fixturetargetaccept替换自动择新。供给链复用B §15.2a现有同父run：`terminal-automation`的`update.supply-chain`通过`terminalUpdateSupplyUi.ts`做后台DOM操作，通过agent做TER React操作；该run拥有新建browser/context/session和设备资源，DEV的Vite/tunnel仅借用。当前runner已注册Android supply-chain，C的Web/自动策略/双机场景仍须CP-05接线，不能据现有注册声称C可运行。未来运行前详设§3a控件与准入精确复核。

## 7. 实施期同步全集与OPEN

原子组见详设§9a；publicexports/README/terminal-invariants注册、platformports defaultUnavail、两App composition、topology existingprotocol/types、state sync/codec、nativeadapter同组。包layout按标准src/moduleName/dependencies/application/features/selectors/components建立；没有未消费公开API。

OPEN包括CBS仅凭证鉴权与canonical/generated差量、TDC plain迁移/flush/角色及A/B在途出口/接口、B最终报告新枚举及taskId=null recent形状、C真实UI行为、技术/权限/真实安装/双机/资源预算；D-52涉及的正式需求、配对需求与TER规范已按阶段C授权同步，但不代表实现或动态通过。本次运行均NOT_RUN。恶意ZIP/symlink/bomb专项目标按A/B最新收敛保持NOT_COVERED，不因C追补极端基础设施；普通有效/摘要/path检查不能删。

# TER 重点代码结构 T1 优化 · 实施计划

## 0 · 当前授权和产物

本计划基于同目录`2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md`及`…-owner-and-source-appendix-codex.md`，需求SHA `b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e`。Dexter最新明确授权：确认问题修订完成后由Codex实施本批全部目标并最终交Dexter/Claude review，`IMPLEMENTATION_AUTHORITY=DEXTER_AUTHORIZED_AFTER_DOCUMENT_FIXES`。本作者会话仅完成文档修订，下列生成、编译、测试、设备矩阵和cleanup尚为计划/NOT_RUN。必要C/F/W/D与受管DEV已获授权；reset/seed、后台L2、UAT、部署不自动附带。需求cycle及两轮详设cycle已关闭，不因局部修订重开。

没有新增UI，因此不重新请求逐屏确认；既有Journey、admin与业务行为仍在验证范围。没有CBS新operation/DBshape，backend新acceptance与browserL2非本批；真实TERWeb/device不是后台L2。

## 1 · 实施进入条件

详设§11a是唯一V01～V18验收落点表，已逐行写具体文件、场景ID、档位和业务oracle；本计划实施每一行，不维护第二份可漂移路径表。现有文件须在所属CP扩例，拟新增文件先建并注册才可执行；不能因旧测试文件存在而宣称新机制被覆盖。尤其CP01/04的transport/parameters.test.ts、CP02的integration-assembly/moduleContributions.test.ts与state/syncRegistration.test.ts、CP04的server-config/environmentResolver.test.ts及automation/serverConfigEnvironmentWiring.test.ts、CP03的updateOwnerFlow.ts均为未来产物，完整路径以该表明确住址为准。静态owner/README责任需独立源码review，不能用机械计数门代替。

1. Dexter已明确授权修订完成后进入实施，范围为本批全包/两个真实native能力新增包/规范模板门同步与计划C/F/W/D。Codex先读本轮外部intake确认修订位置，再开始CP01；不要求重复取得相同实施授权，也不把最新授权或作者CLOSED改写成独立设计GO。
2. 主agent重开当前AGENTS/BLUPRINT/kernel/六维route全部原文、原需求及詳设，确认currentbytes；重枚举实际手写调用者/生成/原生/driver，不把旧导航JSON当真相。
3. native实际解析图、设备serial/API≥29、现managedDEV/seed/LiveKit前提在需用前关闭；没有即停具体执行面报告，不自动seed或猜账号。
4. 第一个实际变更前只准备当前点所需输入，逐点双读；main唯一写，readonly子agent做每完整CP对账。不存在逐文件独立关卡。

## 2 · CP-01：声明、定义和基础设施

1. 按详设§8.1和附件§2迁declarations，在同一CP改全部imports/rootexports/invariants/tests和实际目录checker/模板；retain moduleName/dependencies/index；无emptyfile义务。
2. RuntimeModule只concrete输入、describe/validate派生；createRuntimeModule共用现注册，brands/owner/duplicate/internal/依赖排序不削弱。现UIfeaturefactory迁通用Runtimefactory，UI字段暂保留现能力，不建第二catalog。
3. State persistence IO与autoflush职责具名，State.dispose登记Runtime资源registry；失败/retry/reset无旧timer写；requestledger两slice及公开selectors具名分开。
4. 当前真实默认策略抽ParameterDefinition但值/单位不改；constructError/business rejection/PortResult边界明确。规范目标基线已按补充授权同步，当前源码/模板/机械门未跟进；本CP同步实际生产形状、模板和红例，不重复改已对齐的规范，也不把当前规范写入当这些能力PASS。
5. focused：改动所有包`yarn workspace <package.name> typecheck`及其当前owned test；runtime/state module/lifecycle/visibility/persist/sync tests；目录/brand/duplicate红。调用当前package.json脚本，不绕过dev-matrix wrapper。
6. 完整CP fresh三维对账，MATCHED才CP02。修复只重开实际影响行及其共同机制，未动已核点不重复。

## 3 · CP-02：模块自闭环、UI/sync和assembly

1. UiRuntimeModule presentationContributions只UI层；各pkg parts/variables自返回，dismissals沿现Readonly<Record<string,RenderLayerDismissal>>保留partKey→owner函数；收集逐键拒绝重复，不无键数组/spread覆盖；adminSections是parts，不新registry。服务配置section保留admin-shell，由其自身module提供贡献，不新开server-config-panel包。
2. 两integration模块先构造，catalog→uiState→Runtime；retry重新module闭包及整bundle原子replace，surface/inputs/namespace/theme/App选择外部传入；migration所有callers后删三UI转发assembly及手工parts列表。
3. State资格view→RuntimeModuleContext→topology install；删stateSyncSlices参数/helper；同步稳定projection引用由State负责，topology不rawslice读。两Apprequiredprojection不改，无关sync不阻塞。
4. activation等通用呈现进本包；integration仅stage/required/Apppolicy；projectcandidate matching移project公开selector，remoteconfig由remoteowner消费，crossbase canPair只窄selector绑定不造循环。
5. focused：featureAssembly、runtimeOwner/partSelection/startupReady、uiState、topology.sync、两App businessInterlock/ownerStageRegression；三feature失败层完整变体。会员MAIN/BRANCH两个partKey均映射现owner关闭命令，memberDesk.test.tsx与render/layerStack.test.tsx分别验证按钮/back/backdrop后层关闭且pending/list不误清；runtimeOwner.test.ts验证重复dismissal键拒绝/retry新bundle；loaded/unloaded/retry/nooverlap与unknown/isolated、stale/force/inflight/latest投影反例。将旧stateSyncSlices.test迁真实State/Runtime路径，不在测试重造同步实现。
6. CP02 fresh三维MATCHED。

## 4 · CP-03：API消费ownership

1. 修改现policy/generator/template/check union；15operation五targets按附件§3；canonicalproblem/success/status闭包、仓根/symlink/重复/漏项红；只经generator产物，当前不能手改generated。
2. TDC新增executeTerminalHttpCommand及secret-freecontext、server-config serviceContext selector（仅现credentialRevision/readiness，无RuntimeID），executor从ActorExecutionContext.runtimeId组装expectedContext；pre/post现epoch/credential/config/role复核，原transportgateway和有限pending/late机制保持。response receipt每次携带，删除acceptedResponse单槽；地址偏好同profile/currentrevision，不能把地址优化失败当业务失败。
3. store/project/update/remote使用自身privateclient；原handlergeneration/snapshot/task/session fences保留。cancel仍TDC内部捕获credential完成，不因cancelling不能走普通HTTPready而卡死。
4. 全callers移完删TDC五businesscommands/DTOunion/operation解析/rootgeneratedexport/alias；publicDTO只确有业务command/selector需要的type导出。staticprivate边界红覆盖root/reexport/deep/relative/alias/dynamic/require，不加新semanticgate。scripts/test/terminal-client-generation.test.mjs当前单输出/13op断言要迁五owner/完整15op，TDC generatedTerminalApi/actor旧业务断言随owner迁移，不能沿用旧测试形状假绿。
5. focused：现`terminal-client-generation`测试、五owner真实actor→generated→TDC→transport tests；known/unknown problem/HTTPstatus/nonJSON、并发A/B关联、role/reset/config迟到、写timeout未知。`C`生成检查和typecheck与`F`运行分报。
6. CP03先完成详设§11b的`updateOwnerFlow.ts`及existing update suite/runner `update.owner-flow`注册与F：实际project候选→fixedtarget→真实grant/report/运营readback。同步修改现automationFixture.ts：prepare保留实际source.artifact，apply/readAction保留同prepared/kind/task/action/publication身份，release精确释放；模拟readFacts与同artifact一致，非全a及不同FULL/HOT身份正反测试先完成。automation-only typed UpdatePort fixture仅替代平台，不注入synthetic sourceProvider、不弱化生产身份校验，不把artifact生成当W。CP05补完共享步骤所有UI/配置相依变更，日志preflight后CP06实际W→D。
7. CP03 fresh三维MATCHED。

## 5 · CP-04：环境集合和原生能力

1. 修改四入口defaults→共同namedresolver，defaults/actor/hydrate/sync及原ServerConfigPanel add按钮取消cap，transportname匹配；DEV producer/d.mts、automation childenv、Androidbuild、TDCacceptance一同消费具名完整service集合。DEVone/two内部拓扑、原生下载首地址保持。
2. 新Android transport/topology真实实现包，AppControl复用既有adapter/update的reload住址，原application/base相应资源迁入；ports类型无反向native依赖，App只bindings/ReactHost系统入口。所有autolink/Gradle/native module Name/事件/bridge字段一起调整，不保留旧native实现。
3. 现device/persist/dual/update/remote按附件职责具名提取，index纯barrel，protocol同canonical输出adapterprivate常量；boot/record/window/VM/identity/namespace不改。
4. focused：config/transport/entry/driver1/2/10与invalid/乱序/switch/hydrate/sync；actualnativeclasses解析图和受管focused。既有入口 `node tools/terminal-shared/run-owned-android-tests.mjs --module <alias>`；新两能力及remote先补该runner真实alias/discovery和cleanup测试，再可运行，不能写不存在alias已支持。
5. nativeSDK相关default/顺序依实际resolved版本官方源，发现版本变动停受影响点读图修设计，不自动升依赖。
6. CP04 fresh三维MATCHED。

## 6 · CP-05：责任与维护收口

1. 完成附件§1全39包中尚未迁的大actor/helper/component/native单元；同CP把所有定义按具名文件分开，资源事实仍owner单closure，不每handler另actor。前CP已迁内容只核当前变化，不复做。
2. errors/parameters按真实消费者采用；rawstring/rawnumber按符号identity/策略/算法/UI样式分类，合法常量不一律catalog化；AppVersion单来源，rootreset/retain现判据不扩。
3. 迁Runtime具体sample启动特判到现UI诊断observer，日志仍真实boundary；所有改动命令及source支持原始开发诊断，不能额外保密框架。
4. 每实际改包中文README：定位/作用、每逻辑单元、公开commands/selectors、privateAPI、inputs、资源cleanup、失败、如何扩展；terminal标准/模板/currentmemory指针、staticred、API示例、scriptsREADME/automation skill同步；无新退役控制面。
5. focused所有受影响包owned test/typecheck＋真实READMEusage/type/publicsurface；same-root source readback确认无旧职责/重复身份/零调用新API。
6. CP05 fresh三维MATCHED后做一次**全批6b独立三维对账**，不是CP汇总；全批OPEN不进入整体动态。

## 7 · CP-06：整体测试、动态和交付

### 7.1 · 日志与动态前准入

整链必要日志先齐，再两轮fresh `TEST_CHAIN_PREFLIGHT`只读源码审查：producer env/driver/controls→Runtime→owner→privateAPI→TDC/transport→CBSresponse→ownercommit/selector→UI/nativeboot/report/history及cleanup。日志后的相同链路既有有效审查可复用；变动只差量检查受影响点，不重开关闭的DESIGNcycle。

非adapterCPfocused不依赖动态授权；如果CP内需要动态focused，先完成该链logging/preflight，不反向要求尚在进行CP先MATCHED。整体W/D之前前CP均MATCHED＋6bMATCHED。**动态前整体准入**单列：若执行browserL2/reset/seed，还须适用§3a L2_SCRIPT_ADMISSION PASS＋reset之前当前完整seed dry-run PASS及单独授权。本批无例行L2/reset/seed，不捏造其PASS；当前seed有效时只读契约/拥有性后用现fixture。

### 7.2 · 实际命令与共享场景

以下只为未来执行形状，serial/前提不足不能启动；全量default scripts/verify不是本批默认步骤。改动所有terminal包类型/测试可用根workspace既有`yarn --cwd apps/terminal typecheck/test`，它可能含dev-matrix，实际调用前读脚本并按受管资源规则。生成直接用当前owninggenerator/check，不记codegen等于业务PASS。原生focused按CP04实际aliases。

```sh
node scripts/test/terminal-automation.mjs --phase journey --platform web --shape mobile --sample console --case normal --age empty
node scripts/test/terminal-automation.mjs --phase journey --platform web --shape dual --sample console --case normal --age 37
node scripts/test/terminal-automation.mjs --phase journey --platform web --shape mobile --sample wallpaper
node scripts/test/terminal-automation.mjs --phase remote --platform web --remote-topology mobile-single --sample console --case remote.main
node scripts/test/terminal-automation.mjs --phase remote --platform web --remote-topology mobile-single --sample wallpaper --case remote.main
node scripts/test/terminal-automation.mjs --phase update --platform web --shape mobile --case update.artifacts
node scripts/test/terminal-automation.mjs --phase update --platform web --shape mobile --sample console --case update.owner-flow
node scripts/test/terminal-automation.mjs --phase update --platform web --shape mobile --sample wallpaper --case update.owner-flow

node scripts/test/terminal-automation.mjs --phase journey --platform android --shape dual --sample console --case normal --age 37 --device-serial <真机serial>
node scripts/test/terminal-automation.mjs --phase journey --platform android --shape mobile --sample wallpaper --device-serial <mobile模拟器serial>
node scripts/test/terminal-automation.mjs --phase update --platform android --shape dual --sample console --case update.supply-chain --device-serial <真机serial>
node scripts/test/terminal-automation.mjs --phase update --platform android --shape mobile --sample console --case update.pair --device-serial <MASTER模拟器serial> --peer-device-serial <SLAVE模拟器serial>
node scripts/test/terminal-automation.mjs --phase update --platform android --shape mobile --sample wallpaper --case update.pair --device-serial <MASTER模拟器serial> --peer-device-serial <SLAVE模拟器serial>
node scripts/test/terminal-automation.mjs --phase remote --platform android --remote-topology laptop-dual --sample console --case remote.main --device-serial <真机serial> --device-kind physical
```

设备四形态run集合与详设§11一致；以上命令含同一设备集合的不同业务suite，不称“总共只运行4命令”。如果要合并避免重复build/install，复用当前runner的suite/subcase组合能力，不能新造pairrunner。两App远控Web及mobile/pair当前CLI支持面以currentparser读回，无支持时不能自行猜参数，先补现runner注册和focused红。主sharedscenario常量/fixture在currentmainSampleJourney及sampleConsoleJourney/sampleWallpaperJourney，update/remote使用其现suite；不要另写一份samebusiness脚本。

TR16：非adapter同清单W通过才D；update.artifacts是产物构建，不等同Web验证project→update/报告，所以CP03/05先用实际integrationRuntime+owner directtests/ExpoWeb共享步骤证明固定/HTTP业务接缝。确切新增落点为详设§11b `updateOwnerFlow.ts`，由当前update.test及Android两update suites共同调用；CP03/05已完成代码与F/前置诊断，CP06按上述update.owner-flow命令运行两App W，再执行D共享断言。当前 parser 已注册该 case，执行前仍按当前 parser 和 suite 映射读回。配对/installer/capture系统行为直接D，F只闭codec/owner，Web unavailable不硬模拟原生配对。

两个 Web `update.owner-flow` suite 必须使用受管环境注入的 `TERMINAL_AUTOMATION_WEB_ORIGIN` 启动 Expo 并以同一 origin 打开页面，因为 DEV 只放行清单中的精确浏览器 origin；不得另分配临时端口后把预检失败误作 CBS/业务失败。只访问本地 driver、且不访问受此 CORS 控制的 DEV API 的 artifact/visual suite 可继续使用临时端口。

### 7.3 · 结果与收敛

同一时间一个受管run，持有期间不改源码；serial明确、资源manifest+starttoken/bootidentity绑定，预算/preflight/firstfailure/business/cleanup分开。不删除unknown/nativeprepared/sharedcache。首败读日志→实际brokenboundary→最小修复→focused后只重跑受影响suite；无修改不得盲重跑已PASS。不因一族失败重跑整个矩阵。

非本批CBSschema/HTTP operation不默认backend-acceptance整批重跑；必要仅API消费联动范围，先解释真实受影响点并取得该环境运行授权。DEV生命周期按现managed规则，不在terminalrun顺手reset/seed。

完成整体C/F/W/D必要验证后CP06整体三维MATCHED；随后**逐代码与详设对账**：fresh reviewer核全部改动行/目标文件/零调用者/规范生成文档与driver，结果MATCHED或OPEN；OPEN不能交付review。之后fresh整批`REVIEW_TARGET=IMPLEMENTATION`重新判断方案/用户行为，不能用“按设计实现”豁免；只有业务和cleanup闭合才给Dexter/Codex/Claude整批review。

## 8 · 失败族与不可越界

当前方案只满足常见结构/主流程，不扩恶意归档、长期容量、无用户需求的恢复机制。发现问题先枚举同根逻辑、反例和最小替代，主agent亲自验证classification，仅确认项驱动修复。已完成未改对账不重复；共享机制改动只复查依赖影响，不能因此默认跨批次扩scope。

若有必要产品语义变化、身份迁移、执行面外权限/数据需求，给Dexter具体差异/方案，禁止自由发挥。所有未运行/未授权分开记录，局部C/F PASS不得写成W/D/整批PASS。

## 9 · 文档审查与当前交接

新DESIGNcycle最多R1/R2，fresh reviewer只读盲审需求/现source/标准/完整详设计划附件后先独立verdict，之后才能读作者intake。主agent逐条CONFIRMED/PARTIALLY/REJECTED_WITH_EVIDENCE/UNVERIFIED/DEXTER_DECISION，保存原verdict/SHA/当前行号、失败族与最小防再犯位置。R2后SELF_DECIDED硬收口，若修订当前字节未审不能伪装R2 GO。

当前交付仅完整设计包及评审/处置，交Codex请求GO/NO-GO及M/S/N；不安排实现、运行或数据动作。需求、详设、实施证据三层必须分别声明。

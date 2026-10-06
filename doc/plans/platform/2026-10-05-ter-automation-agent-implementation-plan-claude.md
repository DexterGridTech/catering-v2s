---
title: TER automation-agent 单批次实施计划
status: IMPLEMENTATION_AUTHORIZED
implementationAuthority: true
---

# TER automation-agent 实施计划

## 0. 目标、输入与授权

以同日正式需求与 `2026-10-05-ter-automation-agent-implementation-design-claude.md` 为行为判据，完成一个批次：统一 agent/driver、Runtime selector、全部 testID、规范/skill、首旅途、旧 runner 退役。内部 CP 顺序进行，不拆独立产品交付。
Dexter 已确认设计方向并明确授权完成 CP-01～CP-06 实施及计划内适用验证；命令结果须逐项绑定当前字节与受管 run，历史结果仍保持其原证据等级。reset/seed、L2、UAT、部署仍不在本授权范围。
实施前置：重开当前源字节、已完成的设计/规格与适用记忆；目前 source inventory 只用于定位，不作为实施最终分母。

## 1. 固定执行纪律

1. 使用本仓 `.agents/skills/cs-spec-to-plan`、`cs-writing-plans`、实施时 `cs-managed-runtime-execution`，不从全局同名skill取规则。
2. 每点写前与focused proof后，重开需求条款/IA、全部六维命中记忆、详设与当前可复用源码；主agent独自写全部文件。子agent只读、独立、证伪。
3. 每个CP第一次动态运行前，fresh独立做需求、详设/IA、记忆规范三维静态对账；这不是CP退出MATCHED。同CP后续动态运行不重复，除非字节变化影响已对账范围，此时补差量。完整CP的proof/根因修复完，fresh子agent做整个CP三维对账，MATCHED才进入下一CP。
4. 各CP已经MATCHED且字节/依赖判据未受影响的内容不重复对账。修复只重开受影响CP范围；整体6b是跨CP新检查，不能用已有CP结果的汇总代替。13c另有职责，不是重复的6b。
5. 同时只跑一个受管运行；运行前冻结源码与构建输入；运行期间不改源码。无源码/环境变化且无新未决反例，不重跑相同proof。
6. 日志/诊断/首败、last known good、broken boundary、business与cleanup分列；受管dynamic超过30秒按规范报告，其他持续工作不超过60秒。报告必须区分「当前字节上的最新运行」「最后一次通过」。
7. 同失败族第二次出现只冻结该族后续业务，根因修复+相同focused proof关闭后继续；不靠sleep/延长timeout/换场景重置计数。硬约束或实质设计偏离需要Dexter时才停。
8. F闸不成立时停止下一CP；允许CP内最小根因修复，不擅自换输入技术/缩水判据。VM缺双display不能用mobile结果代替双屏。

## 2. 实施范围与具体产出

| 范围              | 产出                                                                               | 不做                                         |
| ----------------- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| agent             | `apps/terminal/ui/base/automation-agent`，三标识、README、module与protocol subpath | 无feature依赖、adapter port、业务slice、eval |
| driver            | `tools/terminal-automation`独立workspace；root只登记该tools路径                    | 不进入App依赖图，不借hoisted依赖             |
| Runtime           | selector定义/登记/求值，descriptor元数据                                           | 不重写现有request ledger/command实现         |
| primitives/render | 无依赖接缝、surface上下文、真实ref、唯一ID构造器                                   | 不创建多余布局View/注入业务回调              |
| assembly/admin    | 两integration/two application全部装配一次；两条常量行                              | 不加runtime开关、连接状态slice或新Tab        |
| 识别/门/规范      | inventory全部ID、selector/testID两门、TR-08/T12修订、skill、HANDOFF                | 不恢复compliance-control或生产扫描接线       |
| 退役              | 详设§9a.1全部判别为旧runner与独占辅助的文件及引用                                  | 不删检查器、协议验收、历史review/evidence    |

新增路径按能力命名，不把CP/Journey编号放进runtime/test文件名。driver命令：Android 必须显式传入设备 serial；`adb devices -l` 只用于查看当前设备清单，操作者须依据本次明确分配的 VM 身份匹配清单中的 serial，不能按行序自动选择；零个或多个匹配时不得启动。双机 capabilities 另显式传入不同的 peer serial，二者均记入本次 run execution 身份；不支持的 phase/platform 在创建 managed run 前 fail closed。`f4` Android 使用一台指定 VM；`shape=dual` 表示该 VM 提供两个 display，不传 peer serial。

```text
node ./scripts/test/terminal-automation.mjs --phase feasibility --platform web --shape mobile|dual
node ./scripts/test/terminal-automation.mjs --phase feasibility --platform android --shape mobile|dual --device-serial <explicit-adb-serial>
node ./scripts/test/terminal-automation.mjs --phase capabilities --platform web --shape mobile|dual
node ./scripts/test/terminal-automation.mjs --phase capabilities --platform android --shape mobile --device-serial <explicit-adb-serial>
node ./scripts/test/terminal-automation.mjs --phase capabilities --platform android --shape dual --device-serial <explicit-adb-serial> --peer-device-serial <different-explicit-adb-serial>
node ./scripts/test/terminal-automation.mjs --phase journey --platform web --shape mobile --sample console --case normal --age 37
node ./scripts/test/terminal-automation.mjs --phase journey --platform web --shape mobile --sample wallpaper
node ./scripts/test/terminal-automation.mjs --phase journey --platform android --shape mobile --sample console --case normal --age 37 --device-serial <explicit-adb-serial>
node ./scripts/test/terminal-automation.mjs --phase journey --platform android --shape mobile --sample wallpaper --device-serial <explicit-adb-serial>
node ./scripts/test/terminal-automation.mjs --phase skill --platform web --shape mobile --sample console --case normal --age empty
node ./scripts/test/terminal-automation.mjs --phase skill --platform android --shape mobile --sample console --case normal --age empty --device-serial <explicit-adb-serial-matched-to-assigned-vm>
node ./scripts/test/terminal-automation.mjs --phase f4 --platform android --shape mobile|dual --device-serial <explicit-adb-serial>
```

上述是待实现的单一受管入口，不是假装已经存在的命令；JSON manifest/control参数指向仓根内文件，realpath校验。`journey` 必须用 `--sample console|wallpaper` 选择应用：console 仅运行成员登记主旅途（`--case normal --age 37`），wallpaper 仅运行店员登录、选壁纸并确认；非主旅途 case 被拒绝。Web 与 Android 使用同一 Journey helper；`createWebJourneyUiPort`/`createAndroidJourneyUiPort` 在 driver 中承接 registered-node 点击、输入框聚焦、surface映射及虚拟键盘输入；`enterFormValues`、`enterTextAndComplete`、`completeInputSteps`封装常见字段序列与键盘推进，registered-input adapter 负责等待目标键可见/可操作。`prepareWebJourneySurface`/`prepareAndroidJourneySurface`封装表单/显示拓扑前置检查。共用 `loginSampleStaff` 封装真实输入、login command 关联、身份 selector 与目标页面读回；`clickObservedJourneyCommand`/`dispatchObservedJourneyCommand`、`waitForJourneyScreen` 封装实际控件动作与命令/页面观察。Runner 只提供平台连接上下文、本次业务测试数据与业务结果断言，不在 runner 重复编写控件交互、键盘按键、登录步骤、surface准备或命令观察。

## 3. CP-01：最小连接、注册与几何

### RECALL

正式需求R-01～04、R-08～10、F-1/F-2；详设§4.1；SurfaceRoot/SurfaceHostController/AdminLauncher；primitives nativeSlots；Runtime resetRuntimeAfterSystemFailureActor；旧runner的display与process identity；第三方标准。

### 工作顺序

1. 先核对拟用库实际版本与精确tag；补精确API读法与测试；按owner直接声明，不把RxJS/Zod扩散给primitives或kernel。
2. scaffold新agent/toolworkspace，固定protocol v1、错误闭集、token/wss校验与JSON容量边界；同步skeleton graph/三重标识/publicExports计数。
3. 构建配置与assembly初始通路（此CP先落最小启动接线；CP-03补两App全集装配/可见行/F4）；一个Runtime一个agent。
4. primitives无依赖sink与render surface scope，仅接入现存且经自动化消费者盘点需要保留的testID；不因primitive身份新增ID。注册/卸载/press真实事件、bounds+revision、Web真实input。
5. driver迁移当前受管身份/build/install/launch/reverse/cleanup，Android多display映射；只迁需要的通用能力。普通 Vitest config 只发现 `test/` 单测，受管 runner 用独立 journey config 显式运行选择的 journey 文件，禁止包级 test 意外启动 Expo/Android。Android feasibility APK 使用runId派生的唯一 `applicationIdSuffix` 和 run-scoped Gradle build directory，manifest记录实际packageId；安装前精确包名读回，预存即拒绝，仅本run确认空缺后尝试安装的包由本run卸载并读回。构建通过一次性EXPO_PUBLIC loopback URL/token启用agent，token不入manifest/日志。设计详设§9a.2列出Expo、Android Gradle与ADB官方依据；本CP核实际解析版本与接线。另在本步完成新运行根 .runtime/terminal-automation/<runId>/run-manifest.json 与 kind=terminal-automation-run-manifest，启动前调用 ter-validation-with-dev；DEV侧 admin-validation-with-ter 登记该根+精确kind并验证错kind/alias/旧live tree/startToken红例，之后才允许本CP首次动态。同步 health/format 登记本CP新文件，以后各CP随新增文件登记；旧路径/根豁免留到CP-06删除。
6. F-2 的实现通路仍按详设保留，但本次动态范围按 Dexter 2026-10-06 指示仅覆盖两个 sample 应用主旅途；Web/Android reload、force-stop/relaunch、adb reverse 恢复与双机隔离不作为本次 CP-01/02 的动态退出条件，逐项记录 `NOT_RUN`。不得把两条主旅途 PASS 写成 R-03/F-2 全部关闭。Android JS reload 如后续单独授权，仍只能由既有 Runtime `resetRuntimeAfterSystemFailureCommand` 经 `command.dispatch` 调用，不增 agent reload 方法、platform port 或测试后门。
7. 本批动态验收运行两个主旅途：先各自 Expo Web，再对应 Android application；F-1 几何、基础连接恢复与 F-2 额外场景不是本轮动态必跑项，保持 `NOT_RUN`。另按 Dexter 2026-10-06 当前任务要求，在 console 主旅途完成后，同一 Web/Android Runtime 会话执行一次 TDP `DEV-DATA-01` 门店数据变化验收：runner 先订阅 `store-basic.selectStore` 与 `selectStoreBasicTopicState('STORE')`，再由 seed 固定的 `r5-account-multi-role` 项目角色通过现有真实 Operations owner HTTP command 修改门店备注；角色权限由 `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` 的 `role-project.pageAccessKeys/actionCapabilityKeys` 提供。若当前已 seed 的 DEV 仍缺该权限，测试 fixture 仅通过平台现有 `updateWorkspaceRole` owner API 向唯一匹配的启用项目角色补齐 `PG-ORG-STORE-MANAGE` 与 `BC-ORG-STORE-EDIT`，保留已有角色权限并核验 API readback，不直写数据库、不执行 seed/reset。必须断言 selector 收到与 CBS 返回相同的新备注和原始更新时间，随后经同一 owner 恢复并读回原值。此补充只覆盖该门店更新场景，不扩大到 TDP 其它 DEV-DATA 场景或 adapter 行为，也不以 TDC 日志代替 selector 断言。disconnect、JS/App 重启和网络恢复的身份语义继续保留为实现约束，但不以未运行动态场景冒充证明。

### proof与退出

unit/component：错误token/wss、旧session、node卸载/ambiguous、双重缩放、关闭不注册、readonlyref不抢占、normal complete与error恢复、dispose不恢复。
CP-01 focused unit/component proof：几何换算覆盖两轴非等比、offset、滚动及双屏映射边界；卸载/重复节点、close/error/reverse、本地 dispose 与双Runtime覆盖现有 owner 行为。按 Dexter 后续“只跑两个 application/integration 主旅途”的范围收敛，F-1 专项 Web 四角/scroll/scale/offset 及 Android 双屏 AdminLauncher 受管运行均记 `NOT_RUN`，不属于 CP-01 退出条件，也不把主旅途动态 PASS 作为 F-1 证据。CP-01 不把基础 abnormal-close 用例说成完整 F-2；重启/reload/断网身份差异与旧订阅判据保持 `NOT_RUN`。first failure 和 cleanup 证据要求仅适用于实际执行的受管 run。
首次运行前静态对账；F proof修复完成后CP整体三维MATCHED；不提前宣告退出。

## 4. CP-02：Runtime读取、订阅与request跟踪

### RECALL

R-05～07、R-11～12、R-19；详设§4.2；RuntimeModule/RuntimeDescriptor/RuntimeJournal/CommandDispatcher/ActorDispatcher/late peer路径；附件42selector的root exports及原函数。

### 工作

1. type checker重扫当前全部root导出；逐项参数tuple、JSON返回分析；纯helper/factory/hook明确排除。
2. defineStateSelector preserving callable与selectorDefinitions登记，同步全部11个所属RuntimeModule包和publicExports；新增state selector同规则。
3. Runtime按名求值+简单参数descriptor；重复名/参数数错/JSON非法显错；server-config公开defaults参数仍要求完整结构，不私读defaults。
4. agent initial+state合并/dequal/trailing、读一次/退订、全部元数据与controls订阅；每流绑定sessionEnd；无getState/无slice string。
5. journal真实订阅先于dispatch；requestId自动生成；同步拒绝、complete、mixed timed-out/late完成与error、peer终态与有限期限；不建新账本，不重发command。
6. agent发送窗口：以welcome确认hello，以driver的ack确认每个后续信封；未确认完整UTF-8 wire bytes合计最多1 MiB，越界关闭该连接并清除窗口；不重发command。
7. selector机械门及red：删登记/多登记/非select命名漏登/误登helper；接现有skeleton静态流程。

### proof与退出

所有selector有参数有效/无效、empty/非JSON分支；特别验证NON_JSON值状态不退订、随后JSON与再次NON_JSON正常推送，抛错/预算超限明确结束；simple input schema不依赖Zod。可订阅同一selector不同参数，断链清零。多actor首个完不能提前结束；实际late事件继续推。
完成本CP所辖 selector/command shared-schema focused proof 后，stage proof 和 cleanup 后 fresh 整CP三维MATCHED。按 Dexter 2026-10-06 动态范围指示，F-2 reload、reverse 恢复与双机隔离场景本轮 `NOT_RUN`，不作为 CP-02 运行退出判据，也不据两条主旅途 PASS 声称已验证这些行为；公开 `command.dispatch` 仍按当前 protocol schema 与 Runtime handler 测试。

## 5. CP-03：全集装配、admin与F-4

### RECALL

R-02/04/15/19/20、F-4a/b；本包Journey/IA/UI及Dexter看图结论；四package.json、integrationAssembly、两个RuntimeSection。

### 工作与proof

1. 两integration+两application 全部类型检查；sample-console 与 sample-wallpaper-console 各由自己的 integration assembly 测试证明 Runtime 恰装配一个 automation-agent。两个 composition 直接声明实际解析的 `expo-crypto@57.0.3`，把官方 `Crypto.randomUUID()` 注入 TDC 的协议 ID 依赖；TDC kernel 不读取平台全局 API。focused proof 核验 subscription/report ID 闭集；Android journey 验证 TOPIC_SUBSCRIBE 到达服务端。Android 权威配置传递逐包回读 `src/assembly/platformPorts.ts` 并由两个 application typecheck 覆盖；F-4b 在最重的 sample-terminal release 页验证真实 Android build/运行，wallpaper application 不复制整套设备旅途。关闭路径还由 wallpaper assembly focused test 检查 `connection.disabled` 且没有 `connection.opened`；agent 关闭时不接线，开关只随 bundle 输入变化，不增加下载/更新系统。
2. admin只显示「自动化」「连接地址」；一次注入只读常量。PrimitiveFactGrid item增valueTestID挂实际value文本，保留item外框ID；组件测试不能用wrapper ID冒充文本。layout/长URL/可访问性focused。
3. F-4a两个构建同条件Playwright DOM截图，不依赖agent；动态mask单列，pixelmatch红例：多一个可见像素差/错误mask/尺寸不一致要失败。
4. F-4b release VM最重生产page、100次query、1000state bursts、最大128订阅负载；测量口径/60Hz依据按详设§4.3，分别报告同步flush与query的P95/max。管理员进入Runtime页按实际UI形态操作：mobile 点击下拉触发器并选Runtime；dual/laptop 点击 `terminal.admin:section:runtime` 直接导航节点。所有Android控制查询将同名控件按 `surface=PRIMARY` 筛选，再按返回的 `displayIndex` 实际输入；失败诊断列出观测到的匹配surface，不能把跨屏重名报告成节点缺失。账本样本使用默认30分钟 `requestRetentionMs` 窗口内真实连续累积的 workspace request view，记录基线及每100次的条数/完整bytes/求值与编码成本，并记录设备上真实触发的预算拒绝；不做无请求的30分钟墙钟等待，也不假设条数上限。保留期到期删除由 Runtime 既有 fake-clock 清理测试覆盖，明确不冒充设备端 soak。Hermes会用HBC覆盖Gradle生成的packager JS，故不能用最终二进制 bundle 与编译后 `.map` 做JS切片；按详设§4.3用本次相同release Expo CLI/entry/inputs生成run-local packager JS/source map，并要求 `sources`、`names`、`mappings` 与本次Gradle的 `.packager.map` 一致。逐段统计automation-agent/RxJS/Zod Mini/dequal的源映射归属原始字节与gzip参考值，并报告完整Metro JS bundle、release APK、命中模块数、哈希及实际解析版本；不把运行开关前后差值当作代码增量。1 MiB门按原始归属字节判断，超限先优化，改预算必须报Dexter。
5. release/debug两端完整能力一致；开/关产物都包含包；关不connect/register/measure。不能以默认off隐藏额外debugUI。
   F-4a/b与ownedproof后CP退出MATCHED。

## 6. CP-04：旧ID主旅途与application执行面

### RECALL

R-17及冻结需求§4.3～4.5、sample interaction原文；当前activation/staff/member路由、store-basic启动；`terminal-data-client/acceptance/devScenarios.test.ts#operationsSession`、`operationsTerminal`、`prepareFixture`、`cancelByOperations`及其HTTP路径；原冻结runner全部case/age。

### 前提准备（不能隐式授权）

先迁 scripts/test/terminal-business-fixtures.mjs 的顾客生成能力到 tools/terminal-automation/fixtures/member.ts，首次顾客输入前完成共享消费/敏感数据内存边界的 focused；同步新文件 health/format 登记，旧独占 helper/入口在 CP-06 最后删除。
先从 TDC acceptance 抽取 acceptance/operationsFixture.ts，共享五函数及所需HTTP能力，输入化常量，owner保留；devScenarios.test.ts与新driver共同消费，不import测试文件或复制。新增operationsFixture.test.ts的TDC focused、原acceptance owned typecheck/lint、driver共享消费验证；未受影响整旅途不重跑。
CP-04 同时在该共享 Operations fixture 中复用现有登录、PROJECT/STORE选择及真实门店读写路径，为终端自动化增加 `tdp.dev.store-update` proof。Web 与 Android 的 console journey 测试各自在同一已激活 app/runtime 完成主旅途后执行该 proof；fixture 经真实 CBS `updateOperationsOrganizationStore` 请求写入唯一 run marker，不直接改数据库。seed 的 `role-project` 固定包含 `PG-ORG-STORE-MANAGE` 与 `BC-ORG-STORE-EDIT`，使 `r5-account-multi-role` 可通过正常授权改备注；此前缺少该权限会导致 owner 403。若当前 DEV 已 seed 角色仍缺权限，fixture 通过平台现有 `updateWorkspaceRole` owner API 仅向唯一匹配的启用项目角色补齐这两个权限，保留其余 grants 并核验返回值，不直写数据库且不运行 seed/reset。selector observer 必须在 mutation 前完成两个订阅；核对 `store-basic` binding 与被测 store 一致、topic 状态为 loaded、`selectStore` 事件中的备注和 `updatedAtEpochMillis` 与 CBS mutation/readback 的值相同。最后恢复原备注并分别读回 CBS 与 selector，selector unsubscribe/fixture恢复独立作为 cleanup。测试不读取 TDC 日志作业务 oracle，不启动第二个 app/runtime，也不把该场景扩成全量 TDP DEV-DATA 验收。
driver复用真实operations登录→PROJECT身份→STORE数据节点→terminals列表/详情→合法fixture terminal/code的既有链。账号r5-account-multi-role、密码env V2S_SEED_OPERATIONS_DEFAULT_PASSWORD，现有受管DEV环境变量名与角色核验按详设§10b.6，禁止落值/账号到日志。仅在已获当前实施授权的受管DEV执行，不运行Node E1整旅途，也不读取旧运行结果当fixture。
Web使用受管run-scoped deviceId/process-memory protectedStorage；Android fixture 从已认证 automation-agent 的 `runtime.info.deviceIdentity` 读取 integration composition 通过生产 `DevicePort.getDeviceInfo()` 得到的应用上下文身份，不用 ADB shell 的 `Settings.Secure.ANDROID_ID` 代替应用身份，不把 Web 的合成 deviceId 注入 Android fixture。Android 在专用可回收测试VM与自己的sample App持久化namespace激活。终端按唯一 seed 契约 stableFixtures.organization.storeTerminals 选取：dual=term-front、mobile=term-handheld；activationCode 只从该契约内存读取，不在受管 JSON 另存。manifest 仅记 seedKey/terminalRef/storeRef/deviceId 等非秘密身份；不新增终端、不改 seed。与 TDC 五 fixture 共享，依同一时间仅一个受管运行防争用，不与 TDC acceptance 并行；CBS及受管readback唯一匹配后先确认INACTIVE。未知ACTIVE拒绝。上次本driver ACTIVE仅在其manifest同DEV/空间/store/terminal的预存deviceId与binding读回一致（已有generation也匹配）时，用当前generation既有cancel CAS并readback INACTIVE；身份缺失不猜、不cancel他人。完整规则见详设§10b.4；HTTP detail当前没有deviceId，复用已有managed readManagedTerminalBindingByName远端只读readback并最小增projection/parse字段和 scripts/dev/r5-dev-runner.d.mts 两函数声明及 parser 红例（跨 owner 改动，未来实施授权须单独点名）；bound_device_id原值只内存核验、不落盘，错manifest/deviceId/store拒绝，取消仍走HTTP owner，无新产品API/PG tunnel。若可用fixture不足，不自动创建产品数据/reset/seed。
“同DEV身份”指稳定数据平面一致（数据库地址、远端host/fingerprint、拓扑、远端bootId），不是进程型runId相等；受管DEV restart后runId变化，但上述身份与seed实体未变时可凭历史driver manifest和当前binding权威读回核实并回收该driver自有绑定。任一稳定身份或fixture身份不一致仍拒绝取消。
真激活由TDC现有command完成，标semantic准备；真实binding selector/readback一致后才开始店员/顾客真实操作。sample staff凭据来自当前本地常量，落盘不记录。prepared阶段失败不执行business步骤。`ensureMainSampleActivated` 是两个平台runner共用的fixture入口：调用显式普通Promise `driver.fixtures.ensureActivated({shape,deviceId,runId})` 并统一核对seedKey/deviceId；不在纯连接proof隐式激活。真实点击 request 关联复用详设 §4.4 的 requests.observeUiAction 薄封装，不复制账本。

### 旅途

主旅途分为两个现有应用入口，不混用业务 fixture：`sample-console` 通过真实 UI 输入并登记一个成员，断言 exact Runtime request、唯一成员、年龄 37、pending 清除；`sample-wallpaper-console` 通过真实 UI 完成店员登录、选择 `w2` 并确认，断言登录资格、选择与确认 Runtime request、pending/confirmed selector，并断言 mobile 主屏仍是 picker。当前 mobile 部件集合不含 `sample.wallpaper.home`（该部件只注册 laptop），故确认后的业务终点是 confirmed selector，不能要求跳到不存在的 mobile home。两者共用受管 activation fixture、selector/request observer 与注册节点 click，不直接 dispatch 业务 command。`ensureMainSampleActivated` 统一处理fixture缺失、调用和终端身份读回；平台runner不重复编写fixture identity 校验。driver 的 `createWebJourneyUiPort` 与 `createAndroidJourneyUiPort` 分别拥有 registered-node click/focus、surface命名转换及虚拟键盘字段输入接线；runner只传入平台连接上下文，journey只提供业务控件、测试数据和值与业务结果断言。两端共用 `parseMainSample`、`parseMainSampleJourneyConfig` 及 app/seed 身份 helper，避免平台runner重复维护业务闭集。Web 键盘节点先等待可见，再由 Playwright 1.61.1 trial actionability 等待可交互；挂载和过渡态共用2秒总期限，不发固定sleep或先点后判。Android 订阅同一surface的节点变化，等待键盘节点注册且非disabled后重新读bounds。过渡中的未挂载/disabled不是失败，超时才失败并输出目标状态；错surface、重复节点和身份变化立即失败。最终press事件仍须匹配目标testID/surface/revision和实际nodeInstanceId。Android 等待目标按键的可交互状态后重新测量；真实坐标 tap 后须收到同一 `nodeInstanceId + layoutRevision` 的 press-in，press-out作为诊断事件记录但不作为完成门。每个旅途仍须用最终Runtime request与业务selector证明输入和操作结果，单独 press-in 不算业务成功。成员表单最后一个输入字段的 `complete` 会关闭键盘，旅途不得在键盘关闭后再发送虚拟键盘按键。
每次click/submit前先建node/selector/request观察；按可见part、member pending/list、request结果分别断言；reject/abandon/withdraw不能有新增member，normal有唯一member及age对应值。
按 Dexter 2026-10-06 的范围，仅跑两个 sample 应用及各自 integration 的主旅途：sample-console 主旅途是会员录入，sample-wallpaper-console 主旅途是店员登录后选择并确认壁纸。另在 console 测试同一 Runtime 中完成一次 TDP `DEV-DATA-01` 门店资料变化 selector proof；这是本任务当前指令添加的单场景执行面，不等同于 TDP 全套 DEV-DATA 验收。先在两个 integration 的 Expo Web 分别跑通，再在对应 Android application 上按相同步骤验证；只保留自动化实际点击或读取断言所需的 testID，纯展示 Primitive 不新增。原 R-17 的 reject-retry、abandon、withdraw、render-smoke、其它年龄/形态变体及 F-2 双机连接隔离不作为本轮动态必跑项，逐项结果保持 NOT_RUN，不据此宣称通过。Android 仍须真实安装、启动和输入，不能用 APK-only 冒充动态结果。
旧ID两端focused全部通过与CP三维MATCHED之后，才进入重建ID。DEV只消费受管tunnel，不开PG tunnel/本机Java fallback。

## 7. CP-05：全部testID重建

### RECALL

R-14、详设§4.5、完整source inventory、各包实际testID消费者与历史/现行文档分类。

### 工作与proof

1. createTestId唯一构造器+validate，动态key稳定业务ref且编码，不拼surface。每包唯一 *TestIds.ts；内部derived节点同规则。
2. 附件145个文件、639个TSX testID属性位置是分类盘点分母，不是要新增或保留的数量；逐项核查现有声明和实际消费者，不要求每个节点都有 ID。只给自动化要点击/定位，或要读取几何/可见状态作为断言对象的节点保留或新增 testID；纯装饰、静态且不被自动化交互或断言的 Primitive 不新增。
3. `createTestId` 返回唯一强类型 `TestId`；已有项目testID props/转发/nativeSlots收窄为 `TestId`，现有typecheck检查传递。literal/模板拼接/旧string传强类型prop必须编译失败；隔离红夹具覆盖正常构造与编译失败。对TER生产TSX中实际声明的每个testID/testId属性，checker在属性处取表达式类型，不可赋给唯一 `TestId` 即门红，覆盖现有直接RN元素55处/12文件（实施重扫新增）；该门不要求未声明属性的节点新增ID。直接 `<View testID="x">` 即使RN类型允许仍须门红，强类型值传View须绿。窄AST门禁止构造文件外as TestId（含别名/尖括号和定点any绕过），不自写符号流分析；测试消费者导入同源常量。
4. 同步当前规范/memory/README/现行design引用；历史review/evidence不改。
5. 同一script的新ID回归W dual→D dual、W mobile→M；map变更仅常量源，不留第二套旅途。stage静态/退出MATCHED。

## 8. CP-06：skill、规范、最后退役

### RECALL

R-15/16/18；详设§9a.1、§4.6；所有旧runner imports/scripts/README实际消费者；TR-04/08/T12；三维与main-only治理。

### 工作

1. skill随真实协议/命令定稿；fresh仅读skill，在只读报告逐项转录其中完整的旅途步骤/断言及Web/Android命令模板，不复制被导入的旅途源码。main按该报告执行；命令只允许将显式设备serial占位符替换为通过`adb devices -l`核对、且与本次明确分配VM身份唯一匹配的serial，不得变更其余参数。若步骤、断言或参数无法从skill唯一确定，先修skill并换新的fresh从头读取，不能由main补齐。执行结果交回同一fresh核对，保存步骤/断言与命令模板的逐项相等检查及实际serial替换记录。selector订阅+command跟踪+realclick、W→M及cleanup均须通过；无唯一写入规则豁免。
2. 起草并同步norms、记忆与required-inventory及索引（仅实施授权后）；精确TR-08例外、T12、禁用词；ter-failure/安全生产化/非首旅途空窗写HANDOFF。
3. 按详设§9a.1执行最终退役：删除旧运行根豁免、旧入口及独占helper（含旧顾客fixture、wallpaperCatalog），清理 health/format 的旧路径。新driver资源准入/根/kind/红例已在 CP-01 完成，新顾客fixture已在 CP-04准备完成，不延后重做。同步production门/required-inventory/索引/test-closed-loop/README退役引用；索引仅由既有build-index生成。静态判别式同时覆盖导入旧入口和按路径登记旧入口，保留新根精确kind验证。
4. **最后**删除旧UI runner/独占helper/tests/ter-vk hooks/imports及所有调用入口。保留两个check-*的focused mutation检查能力，保留TDC协议验收。不能整目录删除共享process/identity能力。
5. static引用搜索＋remainingcheckerownedproof＋新的manageddriver启动/真实input smoke；删除harness改App必须freshfocused重验证，不能继承此前bundle proof。
6. CP-06整CP退出MATCHED，无旧UI入口/转发壳、旧ownedrun资源残留，cleanup明确。

「删除最后一步」指实现/迁移最后动作；后续全批6b/最终统一验收/13c必须看删除后的字节。不得把删除放到最终review之后。

## 9. 全批6b、最终验收与昂贵阶段准入

### 9.1 全批6b

全部六CP退出MATCHED后，fresh只读独立审查全批需求＋详设/IA＋记忆规范，检查跨层所有权、注册/配置传递、退役空窗、调用链及focused留痕；结论MATCHED/OPEN。这是新全批交叉检查，不要求对未变CP重复开会。OPEN先根因修复与影响CP/6b差量复查。

### 9.2 最终动态清单（当前全部NOT_RUN）

| 顺序 | 执行面/同一脚本                                                   | 必须关闭                                                               |
| ---- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1    | ownedtypecheck/test/lint，skeleton新门red，root scripts/verify    | 默认verify与validate-only分别记录；不能相互顶替                        |
| 2    | Expo Web：sample-console 成员登记主旅途                           | 真实输入/点击、exact request、唯一成员与年龄 selector                  |
| 3    | Expo Web：sample-wallpaper-console 登录及壁纸确认主旅途           | 登录资格、选择/确认 request、pending/confirmed，mobile 主屏仍为 picker |
| 4    | Android application：sample-console 同一成员登记主旅途            | 真实设备身份、真实安装/启动/键盘输入、同一业务 selector                |
| 5    | Android application：sample-wallpaper-terminal 同一壁纸确认主旅途 | 真实安装/启动/键盘输入、同一业务 selector                              |

本表仅列 Dexter 指定的两个应用主旅途；旧 R-17 非主旅途 case、额外拓扑和其它 F 场景不属于本轮动态必跑集合，逐行记 `NOT_RUN`。每个主旅途均先 Expo Web，再在对应 Android application 以同一交互步骤运行；业务与 cleanup 分开记录。配置/ID/装配删除影响结果时做实际focused/终验，不能假称无需测。

### 9.3 条件式昂贵动作

- 当前计划不执行browser L2/reset/seed，不提供这些动作通用授权。
- 如实际需要DEV start，必须当前Dexter实施授权涵盖受管DEV；已有受管DEV仅manifest身份核对，不停止别人的run。所需prepared fixture经既有HTTP owner，不直接写库。
- 若授权要求reset/seed或L2，先全部CP、全批6b、适用UI/testID/§3a与L2_SCRIPT_ADMISSION；reset前当前字节完整seed dry-run。§3a不适用L2时没有空分母「PASS」。本批尚未满足任何准入。
- 不新增backend-acceptance/Testcontainers运行要求；若确有源码影响需获授权，生命周期遵循受管stop→test→条件restart，绝不自动seed。

## 10. 逐代码与详设对账（明确交付步骤）

- **范围**：全批每个新增/修改/删除生产符号、测试/runner、依赖、配置、规范/skill；附件最终重新扫描所得完整范围。不是按章节抽样。
- **执行者**：fresh只读独立子agent；main提供原始需求、详设/IA、规范、真实源码与各自source/run边界，不能代写独立结果。
- **判据**：逐行事实与对应详设；完整调用者；声明—传递—消费；正常/拒绝/竞态/错误/清理；零消费者/幽灵文件/不匹配ID/陈旧proof为OPEN；缺设计判据记DESIGN_GAPS。
- **结论**：MATCHED/OPEN；任一OPEN不能交Dexter/Claude做实施后交付review。与测试前6b不同，不能互相替代。
- 修复后只对影响范围/依赖闭包fresh复查；不要求重做已MATCHED未变化项。

## 11. 整批IMPLEMENTATION review与最终交付

通过13c后fresh独立整批IMPLEMENTATION reviewer重新判断真实生产实现与用户行为，明确GO/NO-GO和M/S/N；按设计找不到判据则DESIGN_GAPS，不因为按设计实现就免合理性审查。NO-GO确认修复后fresh复审，实施review没有两轮上限。
最终交Dexter/Claude：当前设计/计划、源码范围、CP/6b/13c记录、独立review/intake、每条V的source/run/拓扑适用范围、当前最新与最后PASS、首败和修复、business/fixture cleanup/runner cleanup、未运行项与HANDOFF。
不得只报总数，不把没有跑的旧旅途当本期PASS，不保留任何旧UI runner入口。普通两端资源全部回收；DEV是否保留按当前Dexter明确要求，不能自行reset/seed或长期保留新driver。
本轮交付只是设计提案，请另一Claude做DESIGN review；不是以上实施完成报告。

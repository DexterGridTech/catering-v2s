# TER 重点代码结构 T1 优化 · 实施详设

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

## 0 · 输入、状态与授权

BUSINESS_SOURCE=`2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md`，当前 SHA-256 `b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e`。原话来源为同目录讨论稿 §1/§11/§13.1；源码导航 JSON 仅用于找文件，不证明语义。

初始授权为详设、计划、责任附件和审查/处置记录；Dexter随后明确要求本次优化形成记忆与规范、后续新建包必须遵守，因此已同步terminal-coding-standard §7.1/TR-R06/§8与其既有routed memory指针。2026-10-13最新指派：确认问题修订完成后，授权Codex按本详设/计划实施全部T1目标与必要验证，最后交Dexter和Claude review；`IMPLEMENTATION_AUTHORITY=DEXTER_AUTHORIZED_AFTER_DOCUMENT_FIXES`，不是作者自判设计GO。本编写/修订会话仍只改文档，正式需求、源码、测试、脚本、依赖未改；模板/机械门/拟议接口仍未实施，所有生成/编译/测试/verify/Web/Android/DEV及cleanup仍NOT_RUN。新增运行授权仅覆盖本批必要C/F/W/D与受管DEV；reset/seed、后台L2/UAT/部署不是自动附带权。

本设计是结构整改，不新增用户页面或改变业务语义。`JOURNEY_REFS/IA_REF/INTERACTION_REF`：重开 `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-{journey,ia,ui-interaction}-codex.md`、`2026-10-09-ter-update-automatic-execution-and-pair-{journey,ia,ui-interaction}-claude.md`、`2026-10-10-ter-remote-control-{journey,ia,ui-interaction}-claude.md` 的既有任务。没有新 UI，所以新 Journey/IA/线框模板 `N/A_WITH_REASON`；其既有行为回归见 §3a/§11，不能因此省略。MMP/LMP/LMS/LSP、主副机、MAIN/BRANCH、单 VM 双屏、断链遮罩与本机 admin 恢复继续按上述正本。

本次作者会话是续接会话；三个只读来源分析者负责 Runtime/UI、API、配置/原生/测试，未写文件。正式设计审查另用 fresh reviewer，cycle=`TER_T1_IMPLEMENTATION_DESIGN_20261013`，最多两轮，不重开已关闭需求 cycle。

附件唯一路径：`doc/plans/platform/2026-10-13-ter-key-code-structure-t1-owner-and-source-appendix-codex.md`。它是实施导航和责任决定，不是新的合规台账或运行真相。

## 1 · 真正目标与方案比较

维护者需要在一个 owner 包内找到声明、行为、状态、读面及外部 API，加载该包即可带入其能力；修改超时、地址、同步声明或 UI 部件时不必在多个 App 补一份名单。性能目标是消除重复注册与重复判断，不更改业务结果。

| 方案 | 成本与结果 | 决定 |
|---|---|---|
| 仅移动 actors.ts/commands.ts | 最小改动，但中央 TDC 业务 catalog、手写同步名单和装配业务仍在，不能满足目标 | 不采用 |
| 新 module DSL、全局 catalog、自动扫描所有包 | 暗含加载、生命周期和多真相；复杂度超过需求 | 不采用 |
| 明确加载 concrete definitions，现 Runtime/State 派生描述；UI 层收包内贡献；消费 owner 私有 client + TDC 窄认证 command | 复用现有资源与工厂，删除重复输入；改动面大但长期路径直接 | 采用 |

拆 actor 以长期责任、资源和并发边界为单位，不按 handler 数、行数或流程 ID 切。已经清楚的小单元保持。每个包无需空 errors/parameters；协议固定值不变成可调参数。实现不增加新业务 owner、数据库模型、MQ/outbox、服务发现、通用恢复框架或第二 automation runner。

## 2 · 完整 CP 顺序

| CP | 完整能力阶段 | 依赖 | 阶段输出 |
|---|---|---|---|
| CP-01 | declarations、定义派生与纯基础设施生命周期 | 当前需求/规范 | 全包声明迁移、Runtime concrete 注册、State disposal、标准/机械门同步；各当前消费者一起修改 |
| CP-02 | 包内 UI 贡献、同步资格及简化 assembly | CP-01 MATCHED | 模块加载自闭环、State→Topology 资格、required projection 保持、两 App bundle replacement |
| CP-03 | 私有 HTTP client 和 TDC 窄认证执行 | CP-02 MATCHED | 五个 API 消费 owner、生成 policy、旧 TDC 业务入口删除、错误/关联链 |
| CP-04 | 可变地址集合与原生责任整理 | CP-03 MATCHED | 全 producer/consumer 配置链、真实 native capability owner、两个 App 装配与 SDK 资源保真 |
| CP-05 | 业务大单元、UI 生命周期、策略与文档收口 | CP-04 MATCHED | 附件全部责任行完成，named units、参数/错误真实消费、完整 README/公开面 |
| CP-06 | 唯一 driver 回归、整体测试与交付 | 全部前置 CP、全批 6b MATCHED | 日志前置审查、C/F→W→D、业务/cleanup、13c、整批 IMPLEMENTATION review及交接 |

每个 CP 内的变更点做主 agent 前后双读与 focused proof，整个 CP 完成才一次 fresh 三维对账；不能每个文件再开关卡。CP-06 之前 driver 的真实源码接线和必要直接测试已随所属 CP 修改；CP-06 是整体运行，不把静态遗漏留给动态发现。已 MATCHED 且未受修复影响的内容不重复对账。

## 3 · 固定跨切面机制表

四列依次为现成能力、可执行观察、必须同形之处、本批全集。以下 N/A 是范围结论，不是未来豁免。

| 机制 | 现成能力 | 观察与必须同形 | 本批适用全集 |
|---|---|---|---|
| 读侧节点授权 | TDC credential、CBS canonical terminal verification | owner 私有 client 不接外部凭证；错误 scope/失效 credential 不提交业务 state；CBS operation 不变 | store/project/update/remote/TDC 五消费者 |
| 写授权与 grant 复核 | update CBS grant/remote owner、现 TDC HTTP/transport | 本机角色与当前配置复核；短期下载 grant 保留，删除业务集中 facade不改变CBS资格 | update/remote/cancel；其余只读 N/A |
| 跨 owner 写与事务 | Runtime command、CBS REQUIRED 既有链 | A 仅 dispatch B command、读 B selector；没有跨 slice DML；无新CBS事务 | 所有跨包行为；CBS改事务 N/A |
| 集合形态与分页 | generated snapshot cursor、store collections | project snapshot 三次有限重读不变；完整页完成前不固定旧ready；store差量 ref 集合不变 | project规则、store合同/区域/服务点 |
| 缓存失效/改完刷新 | feature topic accept、server config revision | HTTP完成后才更新slice及accept通知；同context刷新期间旧ready失效 | store/project；config→transport；update report |
| RTK currentData/isFetching | 后台 frontend 不在本批修改 | N/A：无 RTK Query 页面变更；TER owner current-generation规则见§8 | 后台 N/A；TER四HTTP消费者 |
| 同一事实住址 | descriptor/credential/native record | 定义派生不再双写；凭证只TDC；Task只update；同步只projection | 全包，见附件§1/§5 |
| 失败原因不改写 | AppError、PortResult、generated problem | validation/domain/network/system 分开；保留 HTTP status、errorCode、原诊断 | config/五API消费者/所有改动平台桥 |
| owner错误到HTTP映射/注册 | canonical schemas→生成client | CBS映射不改；client已知/未知problem及非JSON失败保持 | 五private clients；新CBSerror注册 N/A |
| 新 owner审计三件套 | 现审计正本 | N/A：本批没有新CBS owner/operation；原生adapter不是业务审计owner | 后台 N/A |
| 幂等key/replay | report idempotencyKey、remoteOperationId、update task/action | 不重命名、不清存量、不把timeout等同未提交；重复/迟到只更新同身份 | update/report/remote/runtime/member |
| generated不用手写path | terminal-client-api及两个protocol generators | policy/模板生产私有输出、无手改generated；wire常量同源 | 15JSON operations、TDP及remote协议 |
| 日志/诊断 | platform logger、Runtime journal、automation诊断 | command/request/context/address/boot/task/surface身份可关联；开发诊断保留原始错误，不新增脱敏 | 所有实际改动边界及driver |
| 迁移/回填可逆性 | State persistedFields、native records | 纯路径重构无需迁移，key/descriptor identity保留；有实际shape变更先列明确读写转换 | owner持久化与原生记录，DB migration N/A |
| 共享Drawer/list/form lifecycle | admin-ui-foundation | N/A：无后台页面改动；TER admin-shell/primitives/input复用原容器 | 既有 TER admin/config/activation |
| admin交互一致性 | admin.sections parts、两App stage | pack加载即贡献，不加第二admin registry；只读slave限制/本机恢复保持 | admin-shell（含服务配置）/activation/topology |
| 候选/dropdown | 现server-config空间选择 | N/A：无后台candidate API；spaceName选择走原command | admin-shell服务配置section |
| 编码/name格式 | moduleName、canonical、brands | 保留现身份；流程号只文档，代码按能力命名 | 全包/生成器/测试 |
| 原子字段组 | credential、task/action、report/snapshot context | 不拆关键组合为可部分提交的多个slice；一次owner reducer/flush提交 | TDC/update/project/member/config |

## 3a · 既有 UI 控件和执行控制面

没有新用户操作，既有 Journey/IA/UI 文案、控件、TestId 不因文件移动改名。现 controls 按 owner 常量取：activation 的 code/input/submit/status；admin-shell launcher、tab及服务配置space/addresses/proxy/save；staff-auth staffId/password/login；member-desk member list/add/confirm；wallpaper picker gallery/confirm。PRIMARY/SECONDARY、MMP/LMP/LMS/LSP 均保持 renderer catalog 的既有声明。实施只改 import/包内贡献来源，不能编造同名不可点击节点。

| 回归任务 | 控件来源/真实脚本 | 业务观察 |
|---|---|---|
| 激活→登录→会员 | `tools/terminal-automation/journeys/mainSampleJourney.ts`、`sampleConsoleJourney.ts`；ui/base/terminal-activation、ui/feature/sample-staff-auth/member-desk 的现TestId定义 | 当前空间8位激活→owner active→staff→成员列表/确认；request按真实触发关联 |
| 激活→登录→壁纸 | 同目录 `sampleWallpaperJourney.ts`；picker TestId | 本机背景独立、LMS投影、LSP无logout |
| 同步/断链恢复 | `update.pair.android.test.ts`及topology/runtime direct tests | required projections→遮罩→admin可恢复→重连；slave无TDS |
| 更新/报告 | `update.android.test.ts`、`terminalUpdateSupplyUi.ts` | FULL/HOT固定与跨boot、HTTP receipt及运营历史业务字段 |
| 远控 | `remote.android.test.ts`及现Web remote suite | room开始、真实input、member结果、结束资源释放 |

`L2_SCRIPT_ADMISSION=BLOCKED`（NOT_APPLICABLE_WITH_REASON）：T1不改变两个管理后台页面或operation，不新增 browser-l2；TER automation Web不是browser L2。若未来授权意外扩大后台UI，须先修详设§3a并取得该范围授权，不借现有driver绕过。

实际执行控制面全集（不包括已退役入口）：`scripts/test/terminal-automation.mjs`；`tools/terminal-automation/src/{runner,driver,androidBuild,androidDevice,androidInput,androidAutomationConnection,androidCleanupRecovery,journeyUiPort,journeyFailureDiagnostics}.ts`；同目录fixtures中的terminalActivation、operations、update、remote；上述journeys；`.agents/skills/cs-terminal-automation/SKILL.md`；`scripts/env/check-runtime-resource-budget`；`tools/terminal-shared/run-owned-android-tests.mjs`；`scripts/dev/r5-dev-runner.mjs`及其类型声明。新增场景只能在当前driver/suites注册，不新造受管入口。附件给各字段和CLI的精确落点。

### 3a.1 · 既有实际动作常量与迁移控制

此表是TER automation操作导航，不是browserL2 PASS。输入沿现input完成/submit，request observer先订阅再点击；动态地址行用现函数生产TestId，不手写字符串。

| action | owning constant/source（apps/terminal/） | 实际节点/业务oracle |
|---|---|---|
| 激活输入/提交 | ui/base/terminal-activation/src/foundations/terminalActivationTestIds.ts:codeInput/submit | Registered输入及Button；TDC active与terminal/store身份 |
| admin开启/登录/tab | ui/base/admin-shell/src/foundations/adminTestIds.ts:launcher/login及section | AdminLauncher/登录输入/真实tab；本机admin可用 |
| 空间/服务/地址/保存 | 同文件serverConfig.space/service/addAddress/addressField/removeAddress/save/clear/restore | admin-shell内ServerConfigPanel真实Input/Button；effective目标/拒绝分类 |
| 店员输入/登录 | ui/feature/sample-staff-auth的sampleStaffAuthTestIds:operatorName/passcode/loginSubmit | Login控件；host qualification及operatorName |
| 会员新增/表单/确认 | ui/feature/sample-member-desk的sampleMemberDeskTestId；driver src/mainSampleTestIds.ts对应member字段 | 真控件＋operationId/list；LMS与LSP不同确认owner |
| 壁纸选择/确认 | wallpaperOptionTestId/branchWallpaperOptionTestId、picker confirm | 主副各本机背景、不互相覆盖 |
| 配对/解绑/电源确认 | adminTestIds.topology.formField/pair/unpair/powerConfirmation.confirm/cancel | TopologySection；peer/readiness/role selector |
| 安装邀请 | adminTestIds.installReminder.confirmInstall/deferInstall | 本机PRIMARY；update action；系统UI仅driver现窄例外 |

admin-shell的`declarations/testIds.ts`承接现adminTestIds全部声明，serverConfig组仍在同一owner及namespace中，值不变；UI/driver消费本包公开test-ids，不另复制serverConfig表。服务配置作为本包section而非新workspace，其moduleName不另立；现brandfactory必用，不添加legacy执行层。



## 4 · 各 CP 的不变量与反例

| CP | 不变量/禁止 | 最小 focused proof与复用 |
|---|---|---|
| 01 | module身份和concrete定义只声明一次；合法factorybrand检查保留；state flush仍单一串行Promise；无empty文件义务 | runtime definition/lifecycle/owner tests、state persistence/sync/reset tests；重复定义、构造失败retry后无timer/订阅残留红例 |
| 02 | UI不进kernel；package自己的parts/vars/actor；资格不等同ready；Topology不读别人raw slice | feature-assembly/integration-assembly/topology+State tests；加载/移除包、未知/isolated payload、bundle retry、required缺失反例 |
| 03 | API only private；TDC不识别业务operation/path/DTO；HTTPsecret只在执行补；逐response关联 | generator tests、五owner tests、并发address/context变化/status错误反例；跨root/deep imports红例 |
| 04 | 可变地址1/2/10、按名字而非位置；单VM/record/window/socket owner不复制；Appnamespace不变 | config/transport/entry resolver、native实际classpathfocused；旧socket/window/boot身份拒绝、解析失败不改state |
| 05 | actor/slice/public selector具名定义，helper不成为新事实/调度器；strategydefaults真消费 | 现owner真实command/result/state tests；旧两份规则/零调用者检查；README例子类型证明 |
| 06 | 非adapter先W再D、同清单；真实控件动作/selector业务结果；business与cleanup分开 | §11矩阵；原始firstFailure保留，未改链不重跑 |

每个阶段 Recall：原需求对应R/V、适用原Journey/IA、六维路由命中的原文、附件指定owning source与实际可复用factory/driver。三问审查只保留一行可判的机械门；依赖归属、业务行为靠证伪review。

## 5 · HTTP/协议与数据规模

JSON operation全集和分配见附件§3（15项）。现canonical path prefix仍 `/api/terminal/group-workspaces/{groupWorkspaceKey}`；generated私有client消费suffix，server-config的CBS前缀包含集团空间。HTTP认证保持Authorization、X-Terminal-Ref；激活body deviceId及TDS AUTHENTICATE deviceId不因HTTPheader删除而删。

CBS/TDS operation、数据库权限、Flyway和验收目录本批不改；WS连接/topic/remote-operation envelope仍TDC单一协议owner。terminal-update artifact下载是binary/grant链，**不是**第16个JSON client operation。HTTP解压/响应限额与WS65,536边界分开，既有容量不能从地址数量推导。

集合：store有效合同/启用区域/启用服务点为业务完整集合+detail差量；project规则snapshot使用原opaque cursor/collectionHash/三次SNAPSHOT_CHANGED预算；TDC remoteOperations最多64项现有策略保持，不追加字节quota；规则cache、taskhistory、CBS审计容量不变。T1不改业务集合定义或时间语义。

## 6 · 写面与生命周期责任矩阵

| caller | 唯一写owner / 入口 | 判据 |
|---|---|---|
| integration阶段actor | activation/staff/member/picker公开command | integration只决定阶段优先，不复制owner状态或写part |
| private generated客户端 | TDC executeTerminalHttpCommand→transport command gateway | client只编解码；TDC补认证、transport网络资源与地址选择 |
| project-basic | terminal-update既有执行command | project决定业务candidate；update固定本地task/boot/下载/安装/报告 |
| topology | State.createFullSyncPayload/applyAuthoritativeSync | State独占slice descriptor读取/写入；topology只wire/方向/确认 |
| 配对slave | 本机TDC的直接CBS command；共享credential projection | 不能activate bootstrap或TDS连线；既有explicit取消/解绑行为按现规范，不另立准入 |
| native adapter | 对应port/readback | 原生资源事实不是另一业务task；App注入设备/版本，不写业务slice |

没有新CBS跨owner写，REQUIRED/审计/数据库锁矩阵 `N/A`。既有CBS server side拒绝保持，T1绝不通过降低权限绕开。

## 7 · 声明→传递→消费

| 机制 | 唯一声明 | 传递 | 消费/断言 |
|---|---|---|---|
| module | concrete arrays+moduleName/dependencies | runtime validate/derive descriptor | command actor route/selectors/state注册一致；描述不再第二输入 |
| UI贡献 | 各UI module 的presentationContributions | 明确loaded modules收集一次 | uiCatalog/rendererCatalog及UI-state，同bundle一起replace |
| sync | State实际registration.syncIntent/sync | 窄只读资格 `{sliceName,syncIntent}` | topology install绑controller；State跳过未知/isolated；业务required独立 |
| API | canonical+generation policy消费者 | owner private generated suffix/client | owner actor→TDC auth command→transport→原owner decoder |
| auth/config | TDCcredential+server-config revision | 无secret context＋请求时补headers | pre/post复核，旧config/credential的response不提交业务 |
| collection/cache | feature的当前slice和topic/time | generated HTTP→owner generation fence→topic accept | ref差量不借TDC建业务cache；snapshot未ready不固定 |
| error | declarations/AppError/PortResult/canonicalproblem | Runtime normalize、HTTP status/category | 可修正拒绝非SYSTEM，网络失败无假receipt |
| strategy | 单owner ParameterDefinition.defaultValue | typed construction input校验后的值 | helper/native必要字段显式传入，无独立fallback |
| logs | logger/journal、受管phase | 同request/context/boot/task/surface | 诊断first failure/last good/broken boundary，cleanup单独 |
| addresses | 每个入口自身package.json defaults＋具名环境替换 | server-config纯resolver→transport snapshot | 1/2/10、切换空间、无残留DEV/group、首地址下载既有语义 |

## 8 · 实施形态

### 8.1 · 目录、声明及事实

`src/moduleName.ts`、`dependencies.ts`、`index.ts`保留原职责；index仅barrel。每包命令集合移到`declarations/commands.ts`；错误/参数/parts/variables按需要`declarations/{errors,parameters,parts,variables}.ts`。actor一个具名文件、slice一个具名文件、公开selector一个具名文件；文件内短private helpers可以保留。types不等于parameters；generated不搬成手写declarations。业务session/命令helper在features/actors/shared，application仅工厂/组装；Runtime/State通用生命周期是其基础设施入口，不把feature业务迁入application。

State registration仍从真实slice的descriptor构造；commands factory产生brand、actor factory产生handler、selector factory产生参数元数据，不能从strings推导业务实现。AppModule中未消费的errors/parameters metadata字段，迁移真实消费者后删除；定义本身由使用方直接引用。不为这些静态定义加Runtime catalog。

附件§1/§2定义39功能包的keep/move/delete和大单元分组。新增native能力包在§8.6说明；根终端workspace仅scripts不算功能包。源码有漂移时主agent重新读责任，不以旧行号覆盖新代码。

### 8.2 · Runtime定义派生与UI收集

`RuntimeModule`改为`Omit<AppModule,'commands'|'actors'|'slices'>`加已有concrete arrays和生命周期hooks。`createRuntime/validateModuleShape/describeRuntimeModule`从数组派生命令名/visibility、actor键、slice名、selector参数；原数组均可为空但没有双写descriptors输入。保留owner、brand、重复、internal命令、依赖排序检查；冲突fail closed，不能后者覆盖。

在Runtime现module factory位置增加`createRuntimeModule`（pure validation/clone/freeze，types仍RuntimeModule）；现`createFeatureAssemblyModule`迁为`ui/base/feature-assembly/src/foundations/createUiRuntimeModule.ts`：复用createRuntimeModule，再冻结presentationContributions，接受ui.base/ui.feature/ui.integration及其实际owner/toolkit kind。当前只接受ui.feature的旧factory和createFeatureAssembly转发在CP02迁完消费者后删除；不让旧prefix限制新admin/panel模块。无真实Runtime贡献的primitives/input/render不伪造module。**不是一套新注册体系**：最终只传RuntimeModule数组到createRuntime。

UI扩展类型由`ui/base/feature-assembly/src/types/featureAssembly.ts`拥有：`UiRuntimeModule = RuntimeModule & {presentationContributions?: {parts: readonly DefinedPart[]; variables: readonly UiVariableDeclaration[]; layerDismissals: Readonly<Record<string, RenderLayerDismissal>>}}`。沿现RenderProvider的partKey→owner dismissal函数表；函数本身没有partKey，不能改成无键数组。收集时逐键合并，重复partKey fail closed，不用spread静默覆盖；键必须对应该包实际声明的part。依赖UI types留UI，kernel不import它。使用现definedPart/catalogEntry/rendererBinding形状；admin.sections就是part.containerKeys，不新增admin registry。UI base/feature包自定义贡献，integration只显式加载factory。

每次createRuntimeBundle/retry：重建明确module实例→收它们的UI贡献→构造uiCatalog/rendererCatalog→createUiStateModule→加入display-context/ui-state/automation module→createRuntime。catalog、layerDismissals、Runtime、uiStateModule、automation node sink成为同一个bundle；replaceRuntime同时替换，释放旧bundle所有订阅。两App显式包选择不同，主题/surface/ports/versions/namespace/environment参数保留入口。删除App的parts/variables/dismissals第二份列表及`createApplicationModules({uiStateModule})`同步白名单循环依赖。现LayerStack仍按topLayer.partKey查本owner回调；有回调不得落到通用closeLayerCommand。CP02补三feature失败层完整变体：会员sample.desk.system-notice与sample.desk.branch.system-notice两个partKey分别映射同一deskSystemFailureDismissedCommand，layerId保持现sample.desk.system-notice，由当前workspace处理。按钮、back/backdrop均沿同owner关闭对应层；不假设存在另一个待清业务失败slice，不重置合法pending或会员数据。具体文件为sample-member-desk/test/memberDesk.test.tsx与render/test/layerStack.test.tsx，另在integration-assembly/test/runtimeOwner.test.ts覆盖重复键拒绝/retry后新bundle。每个变体分别验证层已关闭、pending/list未被额外清理，不能只断言表长度。

activation包新增自身presentation actor处理needToActivateTerminalCommand；staff/member/picker同理保留各自具名UI actor。integration保留“断链遮罩 > 未激活 > 未登录 > 当前业务”的应用阶段协调、startup-ready转发；它只发ownercommand。stage selector由integration公开，不下放base变通用业务router。

### 8.3 · State与同步

State从实际已注册slice返回只读`getStateSyncQualifications(): readonly {sliceName:string;syncIntent:Exclude<SyncIntent,'isolated'>}[]`，仅包含有sync descriptor且非isolated的项。RuntimeModuleContext只转交此资格view，Topology在install时取，删除两App stateSyncSlices输入及integration-assembly/foundations/stateSyncSlices.ts。getSlices仍是State内部注册面，不给业务包直接读payload。

controller发送前总经createFullSyncPayload；接收前按资格/方向验证再applyAuthoritativeSync。删除Topology的`state[declaration.name]`读取：State内部按当前registered slice引用缓存本就批准的sync payload；同引用返回同payload引用，topology用payload引用完成现inFlight/queued/lastFailure去重。slice变但projection未变可发送一次，不为深比较加另一个缓存机制；失败同引用不盲重试、force/reconnect可重发仍沿现controller。apply只使被应用且实际changed的slice缓存失效（no-op不失效、未知/isolated不影响任何缓存）；无关入站apply不清出站缓存。reset/dispose才清全部短命cache，不持久化、不建第二revision。credential依原TDCdescriptor只投影credential，status projection单独；未知/isolated失败可诊断。

资格不等于业务ready。两integration与project现required projection判据仍由该行为owner引用具名registration/slice identity；主副链未达required仍遮罩，admin本机可用。未用的sync slice不阻塞业务，不把所有资格作为等待全集。

State auto-flush调度从createStateRuntime提`application/createPersistenceFlushScheduler.ts`，保存store unsubscribe与唯一debounce timer；新`StateRuntime.dispose()`幂等取消timer/unsubscribe并等已运行flush，保留PersistenceEngine现single Promise串行提交。Runtime创建State后立即登记async cleanup；初始化失败、retry、销毁同路径释放。不是新的flush队列。时钟测试证明旧Runtime无后续写。

### 8.4 · 包私有API与认证

详见附件§3逐operation表。policy targets为TDC2、store7、project2、update2、remote2，output均`<owner>/src/generated/terminalApi.ts`，package exports只有允许的公开command/selector/types，**不导出callableclient/operation descriptors**。包内application/actor可导入自己的generated；foreign root re-export与deep import在现dependency checker拒绝。type-only业务DTO在确有公开command/read面消费者时显式导出允许；禁止`export * generated`。

generation policy保留canonical全集，实际targets的union必须覆盖且仅覆盖15operation；不要求每operation只分配一次，只有当前真实多消费者才可重复生成同源private类型，本方案当前没有重复分配。生成器已有路径/符号链接escape红例保持。生成模板共同生产path formatting、status/problem/schema decoder；四个非TDC消费包各有私有`features/actors/shared/createOwnerHttpClient.ts`，仅绑定当前ActorExecutionContext到executeTerminalHttpCommand，不解释operation/path/body。TDC自身client绑定现私有bootstrap/cancel执行，不生成对自身包根的import自环。不能15份手写endpoint/认证。

TDC新增一个public `executeTerminalHttpCommand`，`defaultTarget:'local'`，`allowReentry:true`（不同request独立，既有transport pending机制关联）。参数为JSON对象：`{expectedContext, request:{method,pathAndQuery,headers,body:{kind:'empty'}|{kind:'json';value:StateJsonValue},safeRetryable}}`。只允许同一configured CBS service，suffix相对path；拒绝绝对URL、`//`、前缀逃逸、用户提供Authorization/X-Terminal-Ref；header大小/值沿现HTTP约束。它不认识operationId、store path rewrites、grant/report DTO或topic业务。激活/cancel的私有client在TDC内部使用原credentialbootstrap执行，不伪装成已认证请求。

`selectTerminalHttpContext(state,businessServerName)`公开无秘密scope：`{credentialRevision,groupWorkspaceKey,terminalRef,storeRef,bindingGeneration,instanceMode,selectedSpace,serviceName,serviceRevision,ready}`或null；无secret/deviceId/address/proxy/defaults。复用现TDC credentialRevision/credentialReadyRevision/credentialReadyInstanceMode，不新增authRevision。Runtime ID不在StateRoot中：owner的generated executor从当前ActorExecutionContext.runtimeId另取，组成`expectedContext={runtimeId,scope}`；TDC与自己的ActorExecutionContext.runtimeId比较，selector保持纯读。server-config新增selector `selectServerConfigServiceContext(state,serverName)`只返回selectedSpace和该serviceRevision，不冒充effective config。TDC通过此selector读取；实际网络选择仍transport。业务owner handlers必须保留自己的generation/task/session fence；通用认证执行不替它们解释报告/远控准入。

owner生成executor在调用前读context，null/notready按typed unavailable返回；invoke command后从matched TDC actorResult取唯一response。TDC进入时捕获context、credential对象和actor epoch；await后再次核对相同context/credentialRevision/现readiness/epoch/currentrole；credential按现sameCredential字段身份校验，不仅按对象引用。相同credential重投不人为增加第二epoch；reset/dispose仍有现actor epoch，Runtime重建有新的context.runtimeId。允许现MASTER/共享credentialSLAVE直接CBS准入；slave不因此连TDS。cancel/解绑/configchange后response成为`CONTEXT_CHANGED`失败，不写feature业务。Runtimetimeout只是逻辑结果：不能承诺已撤回网络；写timeout保持既有幂等key/报告缓存语义，不盲重试。

response envelope每次返回自己的`{kind:'response',status,body,contentType:null|string,requestId:null|string,correlationId:null|string,addressName,configRevision,expectedContext}`或`{kind:'failure',category:'not-delivered'|'delivered-failure',code}`；只有发送前确定拒绝才能not-delivered，发送后scope变化/不确定网络失败归delivered-failure，不承诺未执行。HTTP无正文由empty分支不发送body，JSON null用json分支明确表达；所有字段JSON-safe。owner私有decoder分类success/business-rejection/unknown-business-rejection/http/network/schema失败，**保留status/errorCode**。成功或真实业务拒绝可按本次envelope的address/config向现`transportHttpAddressAvailableCommand`报告，地址偏好失败只日志不能反转已完成业务。删共享`acceptedResponse/readAcceptedResponseIdentity`，避免并发串请求身份。

删除TDC public readTerminalData、update grant/report、remote register/report业务command、TerminalReadOperationId/TerminalDataReadPayload和四业务payloadunion，所有真实调用者先移到自己privateclient。同样删除兼容alias TerminalTransportCommands（调用者直接用transport command gateway类型）。TDC保留activate/cancel/topic/heartbeat/远程任意Runtimecommand及结果ACKmap；不能删掉TDPremoteOperations。这些不是本次remote-control HTTP业务facade。

### 8.5 · 业务owner、策略与错误

store-basic在激活/周期状态后加载store，发送自有store-ready command，自身再加载规则/合同/启用服务点；project-basic收到store-ready才加载project/region/group及规则snapshot。并行后续仍依现generation/token提交，集合先完成后detail订阅差量，过期结果不新增订阅。project-basic负责项目候选资格/当前ready，给update执行command；update固定前再核候选当前值，不在assembly做JSON比较。

每个原单actor保留一个install闭包持有owner resources，具名install helper按责任注册handlers；不要把同一socket/task队列拆给多个actors。TDC拆credential/activation、connection、topic subscriptions、remote operation report；update拆admission/fixedtask、artifactprepare/install、bootreadback、CBSreportretry；remote拆sessionstart/end、peer接缝、portevents；topology拆role/host/pair lifecycle、wire/state-sync/command gateway。具体路径见附件§2。

现contracts`createModuleParameterFactory`直接使用，消费者读取`.defaultValue`；外部constructionoverride有decode/validate，非法fail closed；无管理页/catalog。参数表见附件§4。所有沿用默认值从写前当前owning source逐项抄取，不趁抽取更改timeout/interval/count。协议版本、WS65,536、remote wire4,096和固定topic名保持canonical；原生跨层策略由真实owner显式传入，不留JS/Kotlin两份fallback。

errors本包声明只存本owner可预期拒绝；createAppError或typedresult保持现ErrorCategory闭集，不新增DOMAIN类别：配置输入用VALIDATION、host-only用AUTHORIZATION、业务拒绝用BUSINESS，构造不变量仍SYSTEM。server-config非法输入/host-only/business拒绝不能new Error落SYSTEM；native unavailable/运行失败仍PortResult，构造factory不变量可抛Error，CBS已定义error复用canonicaldecoder。不用强制每包errors.ts。Render、primitives、input、TestId工厂保持现能力，不自造控制事件。

### 8.6 · 原生能力与App边界

服务配置呈现保留在`ui/base/admin-shell`内部：ServerConfigPanel/ConfigField是本机admin section的控件，不拥有独立资源或业务事实；通过kernel/server-config command/selector消费配置能力即可。admin-shell将现src/parts/serverConfigParts.tsx迁入本包declarations/serverConfigParts.tsx，并由自身module返回admin.sections贡献；两App只加载admin-shell，不另加载panel。相同目录迁移及职责自闭环已满足R08，拆新workspace只会增加依赖/模块/TestId接线，不新增能力，因此撤回独立server-config-panel包方案。配置事实仍由kernel owner唯一维护，admin-shell不得复制资格或配置cache。

新增两个实际能力包 `adapter/android/{transport,topology}`，分别承接现application/base/android的网络HTTP/WS、NanoHTTPD拓扑host/peer，有实际平台实现和资源，不是空转发包；不建泛化host-runtime。AppControl的唯一reload已有真实owner，复用现adapter/update，见下文。TS native调用在implementations，纯wire/parser在foundations，platform-ports类型不反依赖adapter。

网络TS+TerminalNetworkModule迁transport；topology TS host/peer+TerminalTopologyHostModule/Registry/Server迁topology；appcontrol TS实现迁`adapter/android/update/src/implementations/androidAppControl.ts`，`TerminalAppControlModule.kt`迁同一update adapter，继续调用本包TerminalUpdateProcess.reload。native module的JS `Name`、事件名、request/connection identity不变；Kotlin namespace按目标包迁，不动端侧持久文件。application/base只创建和绑定ports、外部loader/Appidentity/Expo ReactHost入口；Native loading/splash为App启动入口协作，TS移implementations而不另建业务owner，保留PRIMARY物理surface gate。两个App新native依赖由其native autolinking/gradle结构显式接入；最小平台SDK调用形状不改变。

平台网络/peer纯接口从transport迁到`platform-ports/src/types/{transportNetwork,topologyPeerChannel}.ts`：TransportConnection/Event/ManagedConnection、TransportNetworkSnapshot/Adapter、TransportHttpAttemptResult、TopologyPeerChannel/Event保留原形状，所有现调用者改从ports引用。只有TransportCommandGateway/ModuleOptions/profile/retry/业务执行结果仍transport拥有。ports已有contracts依赖，公共地址/proxy类型从唯一contracts引用；adapter依赖图仍只指向ports，不放宽checker，不偷偷隐藏Kotlin依赖。`adapter/update`新增appControl module到自己的expo-module.config.json，同包Gradle/Name=TerminalAppControl和reload共享原进程资源；原application/base删除对应Kotlin/module登记和仅为该类存在的native update依赖，真实仍用update的App入口依赖保持。两App的TS ports组合改从update引用createAndroidAppControlPort。

已有device/persist-kv/dual-screen/update/remote能力仍分别在原adapter。dual-screen registry唯一window/lease/generation；update native record唯一boot/selection/installer；remote session唯一Room/track/capture。大Kotlin单元按附件提取policy/record/installer/bundle helpers，不能并存两个registry或把系统session拷贝成业务Task。JS端SDKresources dispose与原生回调身份保持。

### 8.7 · serverSpaces可变集合

四入口package.json各自内置defaults，不合并。server-config新增pure `resolveServerConfigEnvironment(defaults,overrides)`；overrides=`{spaceName,servers:[{serverName,addresses:[{addressName,baseUrl,timeoutMs}]}]}`。每个声明替换的service采用**完整地址集合**；保留未声明service明确定义，不保留同service旧DEV地址。未知space/service、重复名、空集/非法URL整次拒绝。timeout若输入省略，只按defaults的同名address继承；新名无timeout则拒绝，不按index猜。

defaults/actornormalize/hydrate/sync共用地址规则，去掉4cap；admin-shell ServerConfigPanel的`draft.addresses.length < 4` add按钮限制同根删除，呈现仍留本包，名字唯一/有效输入不放宽；纯constructor invalid defaults抛Error，用户command AppError。transport resolver按addressName消费，成功偏好仍name+configRevision，现retry/轮转预算不变；1/2/10都遍历，不新增探测/服务发现。update adapter的首地址下载行为保持，downloadfailover非本批。

DEV manifest producer输出具名space/service/addresses集合，保留既有三个TDS/两个HAProxy的受管one/two内部拓扑；automation/acceptance转换该producer到统一resolver，不能硬写aurora或两个URL。Android构建注入及Webtest输入采用单个JSON字符串environment配置，集团prefix来自当前fixture/managedidentity而非猜默认。删除入口`tdsEntryOneUrl/tdsEntryTwoUrl`型参数及对应client数量假设，详见附件§6全链。

### 8.8 · 持久化与root reset

移动文件不修改moduleName、commandName、sliceName、partKey、TestId、namespace、schema version、task/action/publication/boot/binding/request identity。TDC凭证仅自有明文persist descriptor，sync仅credential；SLAVE不会成为另一个终端。server-config/terminal-update的retain只保留各descriptor实际persisted字段，其余/ephemeral/orphan由现State清除。正常disconnect不清credential；显式解绑/换host清对应共享credential并flush；取消激活rootreset继续唯一TDC触发。拓扑role flush→App resetRuntime不冒充rootclear。

native MMKV namespace/marker、update native JSON/prepared目录/已安装APK身份/boot成功确认、一个ReactHost/VM、window generation见附件§5。本方案无persistshape迁移与DBreset需要。若源码实现不得不改形状，先新增具名转换、旧数据输入/失败策略及focused重启证明，再更新设计；不可默默扔旧状态“简化”。

## 9 · owner公开能力与调用者

TDC只公开自身业务command/selectors＋窄authenticated execute/context；transport继续command/resource owner；State sync资格仅Runtime/Topology基础设施使用；UI贡献只feature-assembly/integration-assembly消费；server-config环境纯转换供入口/automation，服务context供TDC。其余公开面保留真正A→Bcommand/selector用途，删除无调用的新getter/导出。每新增API必须在附件列producer、consumer、失败反例，不凭“以后用”公开。

### 9a · 变更闭包六列

| 事实 | canonical/生成 | CBS/edge/DB | UI/状态 | tests | fixture/执行 | 动作 |
|---|---|---|---|---|---|---|
| 目录/定义 | 标准/templates/invariants/checkers | N/A | 全模块defs/exports | runtime/state/结构red | package fixture | derive/move/delete |
| 私有API | policy/terminal-client-api | 既有terminal契约不改 | 五owner/TDC/公开面 | generator+五owner | 现activation/store/update/remote | regenerate消费者 |
| 同步 | descriptor唯一 | N/A | State/topology/两integration | state/topology/bundle | 双runtime/同Apppair | 删除白名单/raw读取 |
| 环境 | 每入口package defaults/DEVproducer | DEV同拓扑不增节点 | config/transport/entry/driver | resolver1/2/10 | managed seed identity | 替换具名collection |
| 原生 | existingprotocol私有adapter输出 | N/A | nativeports/autolink/应用装配 | currentownedAndroidrunner | 现device/full-hot/remote | 迁能力/资源不复制 |
| 任务身份 | 现types/persistschema | reports与grant不改 | update/project/TDC | boot/reset/restart | 现updatefixture | 保持所有身份 |
| 文档/规范 | 标准/templates/routed指针 | N/A | README/API deps | retainedmechanicalred | skill/driverreadback | 当前正本同批同步 |

### 9b · 唯一锚点

不用漂移行号驱动实施：Runtime=`createRuntime/validateModuleShape/describeRuntimeModule`；State=`createStateRuntime/createFullSyncPayload`；sync=`createTopologyStateSyncController.sendSnapshot`；API=`terminal-client-api.mjs.loadModel/renderClient`及TDC `createTerminalClientForTransport`；config=`validateServerConfigDefaults/normalizeAddresses/resolveTransportServerAddresses`；UI=`createIntegrationAssembly/createRuntimeBundle`。附件列精确文件路径与具名target，不创建hash gate。

## 10 · 迁移与数据

DB/Flyway/data model均不变，无新seed schema。纯路径迁移替换全部import后删除旧内部文件，不留兼容barrel、legacy handler或双factory。公开command/selector身份保持；公开generatedclient被禁止，真实callers本批一起改，不保留旧business facade。此API源码迁移与已持久终端数据迁移是两回事：后者本方案无需，不能拿前者当理由reset设备。

## 10b · seed、fixture与昂贵运行前提

### 10b.1 · seed全集

不修改业务seed输入：`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`、`scripts/dev/r5-complete-seed-executor.mjs`、`scripts/dev/r5-seed-plan.mjs`、`scripts/dev/r5-seed-bootstrap.mjs`及其由`r5-dev-runner.mjs`调用的当前入口；`scripts/dev/terminal-update-seed-plan.mjs`、`scripts/dev/terminal-update-seed-executor.mjs`是受影响版本producer，只有调用地址/driver输入需同步。无新增业务实体/失效seed；若实际代码改seed形状，须具体列文件与原因而非星号授权。

### 10b.2～10b.4 · 输入与覆盖

store-operating、dual term-front、mobile term-handheld按seed key读取，code/activation secret不另抄。当前sample A001/1111是既有staff样例；会员runId隔离；update INSTALL/FULL/HOT由当前artifact builder同次生成，两App应用身份不同；remote沿现LiveKitresident/fixture。defaults、override、hydration、sync、1/2/10地址、主副required、rootreset、schema拒绝等用直接focused fixture，不污染业务seed。没有新增“空值占位以凑反向断言”。

### 10b.5～10b.6 · 授权、角色和来源

当前无任何运行/数据操作授权。未来计划明确请求existingDEV/tunnel、端侧App临时安装/覆盖与清理、seed终端拥有性核验后的activation cancel/re-activate；console主Journey现有project role补权及store notes修改/恢复、版本/远控fixture操作。角色：platform root与operations `r5-account-multi-role`；password由受管reader读取`V2S_SEED_PLATFORM_ROOT_PASSWORD`/`V2S_SEED_OPERATIONS_DEFAULT_PASSWORD`，无值落文档/CLI。术语与face不可互换。

这些是`ESTABLISHED_SOURCE`；native新增包/生成fixtures是`IN_SCOPE_PRODUCED`；设备serial/API及managedDEV/有效fixture是实际运行前提，Codex先从受管配置/身份读回核实，不按设备顺序或猜账号。必要C/F/W/D及DEV已由最新会话授权，不再把常规执行上报成待批；前提不存在或不兼容才说明具体缺口交Dexter。seed缺失不能自动seed。无例行reset：确需reset/seed先单列授权并做动态前整体准入（所有CP/6b、适用§3a、当前完整seed dry-run），不拿实施授权扩大数据清除范围。

## 11 · 验证场景与执行范围

档位：C=canonical生成链；F=生产定义/类型/单测/机械red；W=真实两integrationExpoWeb；D=Android application与真实adapter。全部当前NOT_RUN，直接tests源码不是PASS。

| 场景ID | 实际入口/断言 | 档位 |
|---|---|---|
| structure.module-load | 现runtime/feature-assembly tests加production factories；添/删UI模块，parts/vars/selectors自动进出、重复brand/name拒绝、retry新bundle不读旧catalog | F/W |
| structure.owner-boundary | generator及现static imports tests；包内private client可用，foreign root/reexport/deep import红；A→Bcommand结果及Bselector同源 | C/F/W |
| structure.auth-context | 五owner直接tests；同时CBS请求各自status/address/request；credential/config/reset中途变化旧result不提交，HTTP timeout不能假未发送 | F/W |
| structure.sync-registration | State/topology双Runtime tests；自动资格、unknown/isolated/方向、credential-only、projection晚到/断链admin、旧payload失败抑制 | F；D配对 |
| structure.address-collection | 四入口共享resolver+productionconfig/transport；1/2/10、乱序addressName、非法/重复、switchproxy/group、hydrate/sync无cap | F/W；D接线 |
| structure.persistence-lifecycle | 真实twoRuntime重启+nativefocused；retain/cleared/ephemeral/orphan、pendingtask/boot不复制、dispose旧timer/资源 | F/D |
| structure.error-parameter | productioncommand输入拒绝/网络/native/constructor分开；实际策略override/default消费，无动态catalog/协议可调化 | F/W |
| sample主旅途共享清单 | 现mainSampleJourney/common driver：激活/登录/业务/owner topic数据/配置；console成员及wallpaper本地独立，D做相同业务断言 | W→D |
| update.supply-chain / update.pair | 现update suites：固定候选、FULL→HOT跨boot、receipt/history、sameApppair，native身份及资源readback | F/W业务接缝→D系统安装/配对例外 |
| remote.main | 现remote suites：start/input/member结果/end；仅本批改adapter/protocol/auth接缝，沿当前已获准主要smoke形态 | F/W→D capture/touch例外 |

动态矩阵设计：W两App各mobile＋consoledual（既有main场景）；D console真机单机双屏、wallpaper mobile虚拟机、console及wallpaper各同App双虚拟机配对，显式serial、API≥29。四设备run复用现update/remote suites的实际主流程，非adapter共有行为先W；不同App不得配对。最终实施授权可由Dexter缩减执行面，但不能把未跑写PASS。单机单屏逻辑用W与mobile/双runtimeF覆盖，native单屏carrier由现devicefocused覆盖，不无理由添第五matrix。无新的L2/UAT/恶意archive/长期容量。

### 11a · R与V逐项闭合

| R | 详设判据 | 场景/V/档位 |
|---|---|---|
| R-01 | §0/§6/§8.6保持四层/owner | V01/V08/V16，F/W/D |
| R-02 | 附件全包责任与逐逻辑保持/迁移；实施重开当前source | V01，静态/F |
| R-03 | §8.1 declarations/具名definition | V02/V03，F |
| R-04 | §8.3/5/6资源/并发拆分不复制 | V02/V15/V17，F/W/D |
| R-05 | §3/§8.5 error分类 | V04，F/W |
| R-06 | §8.5/附件§4静态ParameterDefinition消费 | V05，F |
| R-07 | §8.4/附件§3完整15op | V06/07/08，C/F/W |
| R-08 | §8.2 concrete/UI自闭环 | V07/09/10，F/W |
| R-09 | §8.3资格≠required/投影 | V11/12，F/D，W非adapter |
| R-10 | §8.2/5 integration只装配/阶段 | V09/12/16，F/W/D |
| R-11 | §8.7/附件§6可变地址同链 | V13/14，F/W/D |
| R-12 | §8.8/附件§5身份与常量 | V05/10/14/15，F/W/D |
| R-13 | 附件机制采用表/§8.5真实消费/删除 | V18，静态/C/F |
| R-14 | §8.4/6四层/private/generated | V01/06/08，C/F/D |
| R-15 | §9a/附件§7标准门文档同批 | V03/18，C/F |
| R-16 | 完整§0～14、附件、计划 | V01～18，静态各判据 |
| R-17 | §11/§13/计划CP6日志和顺序 | V16/17/18，C/F/W/D |

以下为唯一验收落点表；case名称是本批应扩展的具名断言，不表示当前已实现。`现有扩例`＝在精确现文件扩展并调整迁移imports；`拟新增`＝实施时先建测试/步骤并注册到现runner，当前不存在。C=生成/类型，F=focused，W=受管Expo Web，D=受管Android，均NOT_RUN。源码责任语义保留独立review，不伪装成自动计数门。文件字段不以泛称或另节引用替代。

| V判据及真实oracle | 测试或场景ID | 执行档位 | 所在文件与本批动作 |
|---|---|---|---|
| V-01：全包每逻辑的owner/caller/资源/keep-move有依据，手写/generated/vendor分开；枚举不代替语义 | package-responsibility/source-readback | 静态独立review＋C/F（结构部分） | `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-owner-and-source-appendix-codex.md`逐责任行；`tools/terminal-skeleton/check-static.test.mjs`现有扩例；源码语义对读记录 `doc/review/platform/2026-10-13-ter-t1-implementation-source-review-codex.md`，逐源码语义判定，不是机器门 |
| V-02：拆定义后相同command/state；资源释放一次；两Runtime恢复ephemeral不持久 | module-load/persistence/resource-disposal | F | `apps/terminal/kernel/base/runtime/test/moduleSystem.test.ts`、`apps/terminal/kernel/base/runtime/test/lifecycle.test.ts`、`apps/terminal/kernel/base/state/test/persistence.test.ts`现有扩例 |
| V-03：declarations法定路径及foreign定义红，不以文件数量判断责任 | declaration-layout/foreign-definition | C/F | `tools/terminal-skeleton/check-static.mjs`、`tools/terminal-skeleton/check-static.test.mjs`、`tools/terminal-runtime/check-static.mjs`、`tools/terminal-runtime/check-static.test.mjs`、`tools/terminal-layering/check-static.test.mjs`现有规则/红例同步 |
| V-04：配置/host-only/业务拒绝类别保持；constructor、nonJSON、native PortResult不误类，界面可继续 | error-parameter/owner-rejection-recovery | F/W | `apps/terminal/kernel/base/server-config/test/serverConfig.test.ts`、`apps/terminal/kernel/base/runtime/test/actorResult.test.ts`、`apps/terminal/ui/base/render/test/requestOutcome.test.ts`、`apps/terminal/kernel/base/topology/test/topology.test.ts`现有扩例，调用真实owner而非仅构造结果；`tools/terminal-automation/journeys/mainSampleJourney.ts`扩既有admin配置拒绝/恢复步骤，`tools/terminal-automation/journeys/sampleConsole.test.ts`注册W |
| V-05：静态策略真实消费默认/合法覆盖、单位正确，非法覆盖拒绝，协议cap不改 | error-parameter/strategy-consumption | F | `apps/terminal/kernel/base/contracts/test/contracts.test.ts`、`apps/terminal/kernel/base/transport/test/transportPrimitives.test.ts`、`apps/terminal/kernel/base/transport/test/connectionOwner.test.ts`现有扩例；`apps/terminal/kernel/base/transport/test/parameters.test.ts`拟新增真实策略消费正反例，不只factory metadata |
| V-06：五owner私有生成可包内用，root/deep/alias/relative/reexport/require/dynamic越界拒绝 | owner-boundary/private-client-generation | C/F | `scripts/test/terminal-client-generation.test.mjs`现有单输出/13op断言迁五targets/完整15op；`tools/terminal-skeleton/check-static.test.mjs`扩私有client边界红；`scripts/generate/terminal-client-api.mjs`为该测试实际调用生成器 |
| V-07：A发B command，B真实generated→TDC→transport，A读selector；拒绝/取消/关联不旁路 | auth-context/owner-http-command | F/W | `apps/terminal/kernel/feature/project-basic/test/projectBasicRuntime.test.ts`、`apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts`、`apps/terminal/kernel/feature/project-basic/test/projectBasic.test.ts`、`apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts`、`apps/terminal/kernel/base/remote-control/test/remoteControlActor.test.ts`、`apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts`现有扩例（mock仅network boundary）；`tools/terminal-automation/journeys/storeBasicDataChange.ts`真实HTTP步骤；`tools/terminal-automation/journeys/updateOwnerFlow.ts`拟新增真实CBS/grant/report步骤，由`tools/terminal-automation/journeys/update.test.ts`注册W |
| V-08：15op只归五owner，TDC自身2op；无业务facade/重复credential，SLAVE CBS可读但不连TDS | owner-boundary/credential-http-only | C/F | `scripts/test/terminal-client-generation.test.mjs`、`tools/terminal-skeleton/check-static.test.mjs`、`apps/terminal/kernel/base/terminal-data-client/test/generatedTerminalApi.test.ts`、`apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts`、`apps/terminal/kernel/base/terminal-data-client/test/runtimeStartup.test.ts`现有扩例/移业务断言至消费owner |
| V-09：加删完整module带入/释放actors/selectors/parts/variables/dismissals，无孤立贡献 | module-load/module-contributions | F/W | `apps/terminal/ui/base/feature-assembly/test/featureAssembly.test.ts`、`apps/terminal/ui/base/integration-assembly/test/runtimeOwner.test.ts`现有扩例；`apps/terminal/ui/base/integration-assembly/test/moduleContributions.test.ts`拟新增加删包/原子bundle proof；`tools/terminal-automation/journeys/sampleConsole.test.ts`、`tools/terminal-automation/journeys/mainSampleJourney.ts`现W加载后的真实UI command |
| V-10：从concrete派生，真正重名/foreign/brand冲突拒绝并诊断 | module-load/definition-identity | C/F | `apps/terminal/kernel/base/runtime/test/moduleSystem.test.ts`、`apps/terminal/kernel/base/runtime/test/types.test.ts`、`apps/terminal/kernel/base/runtime/test/public-surface.typecheck.ts`、`apps/terminal/kernel/base/state/test/descriptor.test.ts`现有扩例 |
| V-11：已加载/新增fixture自动eligible，删除不eligible，未知/isolated不应用，方向保持 | sync-registration/loaded-qualification | F | `apps/terminal/kernel/base/state/test/sync.test.ts`、`apps/terminal/kernel/base/state/test/descriptor.test.ts`、`apps/terminal/kernel/base/state/test/persistence.test.ts`现有扩例；`apps/terminal/kernel/base/state/test/syncRegistration.test.ts`拟新增registration→资格view proof；删除仅测显式名单的`apps/terminal/ui/base/integration-assembly/test/stateSyncSlices.test.ts`，其有效断言迁此，不另模拟sync |
| V-12：eligible与required分开；无关sync不阻塞，断链/缺required遮罩而admin可恢复 | sync-registration/business-interlock | F/W适用部分/D配对部分 | `apps/terminal/ui/integration/sample-console/test/businessInterlock.test.ts`、`apps/terminal/ui/integration/sample-wallpaper-console/test/businessInterlock.test.ts`、`apps/terminal/kernel/base/topology/test/topology.test.ts`现有扩例；`tools/terminal-automation/journeys/mainSampleJourney.ts`＋`tools/terminal-automation/journeys/sampleConsole.test.ts`验证W非adapter准入；`tools/terminal-automation/journeys/update.pair.android.test.ts`扩实际D断链/投影/恢复 |
| V-13：同解析1/2/10完整地址，duplicate/非法整次拒绝，UI无4cap、hydration/sync/轮转正确 | address-collection/configuration-edit | F/W | `apps/terminal/kernel/base/server-config/test/serverConfig.test.ts`、`apps/terminal/kernel/base/transport/test/transportPrimitives.test.ts`、`apps/terminal/kernel/base/transport/test/connectionOwner.test.ts`、`apps/terminal/ui/base/admin-shell/test/serverConfigPanel.test.tsx`现有扩例；`tools/terminal-automation/journeys/mainSampleJourney.ts`扩共享admin编辑/保存步骤，由`tools/terminal-automation/journeys/sampleConsole.test.ts`跑W。具名地址用现managed入口，不新部署节点 |
| V-14：四入口/driver同resolver，当前space/group/proxy/目标一致，不残旧DEV地址 | address-collection/environment-wiring | F/W/D适用接线 | `apps/terminal/kernel/base/server-config/test/environmentResolver.test.ts`、`tools/terminal-automation/test/serverConfigEnvironmentWiring.test.ts`拟新增；`tools/terminal-automation/test/androidManagedServerSpaces.test.ts`、`tools/terminal-automation/test/mainSampleJourneyConfig.test.ts`、`apps/terminal/ui/base/integration-assembly/test/createBrowserTransportNetworkAdapter.test.ts`现有扩例；旧`apps/terminal/application/base/android/test/androidTransportNetworkAdapter.test.ts`迁目标`apps/terminal/adapter/android/transport/test/androidTransportNetworkAdapter.test.ts`；`tools/terminal-automation/journeys/sampleConsole.test.ts`与`tools/terminal-automation/journeys/sampleConsole.android.test.ts`运行同mainSampleJourney真实配置步骤 |
| V-15：正常restore、角色切换、解绑/换主、取消root各有独立正反oracle；retain仅批准persist字段 | persistence-lifecycle/identity-cleanup | F/D适用native | `apps/terminal/kernel/base/state/test/persistence.test.ts`、`apps/terminal/kernel/base/runtime/test/reset.test.ts`、`apps/terminal/kernel/base/terminal-data-client/test/runtimeStartup.test.ts`、`apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts`、`apps/terminal/kernel/base/topology/test/topology.test.ts`、`apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts`、`apps/terminal/adapter/android/persist-kv/test/androidPersistKv.test.ts`现有扩例；`tools/terminal-automation/journeys/update.android.test.ts`与`tools/terminal-automation/journeys/update.pair.android.test.ts`验证D跨boot/解绑 |
| V-16：两App激活→登录→会员确认或壁纸、本机admin，真实command/selector及权限保持 | sample-console/sample-wallpaper/main | F/W/D同清单 | `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`、`apps/terminal/ui/integration/sample-console/test/ownerStageRegression.test.tsx`、`apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`、`apps/terminal/ui/integration/sample-wallpaper-console/test/ownerStageRegression.test.tsx`现有扩例；`tools/terminal-automation/journeys/mainSampleJourney.ts`、`tools/terminal-automation/journeys/sampleConsoleJourney.ts`、`tools/terminal-automation/journeys/sampleWallpaperJourney.ts`共享步骤；`tools/terminal-automation/journeys/sampleConsole.test.ts`/`tools/terminal-automation/journeys/sampleConsole.android.test.ts`按sample选择两App |
| V-17：topic差量/订退/旧结果隔离，FULL/HOT固定/续接/report，remote输入/会员结果/释放各自断言 | store-basic.data-change-proof/update.owner-flow/update.supply-chain/update.pair/remote.main | F/W或D（系统adapter例外） | `apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts`、`apps/terminal/kernel/feature/project-basic/test/projectBasic.test.ts`、`apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts`、`apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts`、`apps/terminal/kernel/base/remote-control/test/remoteControlActor.test.ts`现有扩例；`tools/terminal-automation/journeys/storeBasicDataChange.ts`（现console主旅途调用，不宣称wallpaper也跑该子链）；`tools/terminal-automation/journeys/updateOwnerFlow.ts`拟新增，由`tools/terminal-automation/journeys/update.test.ts`/`tools/terminal-automation/journeys/update.android.test.ts`/`tools/terminal-automation/journeys/update.pair.android.test.ts`复用；`tools/terminal-automation/journeys/remote.web.test.ts`/`tools/terminal-automation/journeys/remote.android.test.ts`保留真实业务断言 |
| V-18：README/public用法/模板/门/generated/driver与实际源码一致，未用机制合理删/说明、无旧runner | public-surface/documentation-consumers/retired-runner-absence | 静态review＋C/F | `tools/terminal-shared/package-invariants.test.mjs`、`tools/terminal-skeleton/check-static.test.mjs`、`tools/terminal-runtime/check-static.test.mjs`、`tools/terminal-layering/check-static.test.mjs`、`scripts/test/terminal-client-generation.test.mjs`、`tools/terminal-automation/test/runner.test.ts`、`tools/terminal-automation/test/requests.test.ts`、`tools/terminal-automation/test/mainSampleJourneyConfig.test.ts`现有扩例；真实README/源码语义对读记录见`doc/review/platform/2026-10-13-ter-t1-implementation-source-review-codex.md`，不由文件存在/总数代替 |

以上表是未来proof落点，不是当前PASS。新参数消费、自动同步资格、bundle贡献、共享环境resolver、私有API生成及owner-flow在当前代码尚未成立，必须在所属CP先写直接测试/红例再退出CP。已有fixture与单例factory测试只供复用，不能据文件存在推导覆盖；全部实际场景状态逐行报告，不只N/N。S1关闭变体的文件/按钮及back/backdrop oracle另在§8.2写定，同为本表V09/V16的CP02扩例。

### 11b · Web更新业务接缝的确切落点

CP03/05修改当前`tools/terminal-automation/journeys/update.test.ts`并新增同目录`updateOwnerFlow.ts`共享步骤，在现update phase增加`update.owner-flow`（web/android都有真实suite注册，CLI未实现之前fail closed）。两个test-expo已有`createTerminalUpdateAutomationFixture`从kernel/base/terminal-update/testing注入，只automation-enabled构建使用；生产Web仍unavailable UpdatePort。本新case用`EXPO_PUBLIC_TER_UPDATE_OWNER_FLOW=1`选择**只注入fixture.port，不注入fixture.sourceProvider**，保留真实project candidate生产绑定；sourceProvider原其他测试用法不改。沿同fixture模拟平台readFacts/prepare/apply，不模拟CBS数据/认证/候选，不手写owner逻辑。

CP03必须同时修改现`terminal-update/src/testing/automationFixture.ts`，不是直接复用当前固定publicationId的port。prepareArtifact在fixture闭包记录当前preparedId、kind和实际source.artifact；applyPrepared按preparedId/kind匹配后，用该artifact.publicationId生成同taskId/actionId的action；readAction只读回匹配身份，releasePrepared只释放对应prepared项，未知身份按现typed failure拒绝。本正常链串行准备，保留一个当前prepared记录即可，不建额外工厂/任务账本。owner-flow的模拟平台结果/readFacts须与同一实际artifact一致，不能夹用synthetic targetArtifact；这仅是Web平台替身，不证明真实安装或跨boot。原synthetic sourceProvider仍只服务原场景。CP03现fixture/direct tests用非全a的真实形状publicationId及不同FULL/HOT身份，验证prepare→apply→readAction→release和错prepared/kind拒绝；生产ACTION_PUBLICATION_IDENTITY_MISMATCH校验不放宽。CP05只适配其余UI/配置调用者，不把这个接缝留给首次W发现。

共享步骤：真实seed激活→store-ready→project组织/规则snapshot ready→公开selector中app匹配candidate→真实project命令发update执行→selectTerminalUpdateTask.fixedTarget与选中rule/artifact身份相等→private grant命令经TDC/transport取真实CBS grant（不只HTTP200）→UpdatePort fixture只模拟平台动作→update report command取真实HTTP receipt→运营真实report/history task/binding读回同记录。no-candidate不发任务、刷新未完成不固定旧snapshot、canonical拒绝保留status/pending分类各落F；真实W只正常链。Android update.supply-chain/update.pair复用该非adapter步骤及原安装动作，不能把Wfixture当PackageInstaller/boot证明。

将`node scripts/test/terminal-automation.mjs --phase update --platform web --shape mobile --sample console|wallpaper --case update.owner-flow`写入runner parser/suite和两App W调度，F及链logging/preflight在初次W之前完成；新case不是第二runner。fixture/授权仍§10b。

## 12 · 依赖、OPEN与禁止事项

不新增第三方依赖或升级SDK。附件§8记录锁定/安装包静态版本与官方精确tag；native Gradle实际解析图未运行，`OPEN_DEPENDENCY_RESOLUTION`只能在未来受管classpath读取关闭，不把声明当解析PASS。使用现SDK API/资源顺序不因拆分改变；行为声明不足时停具体adapter点，不能按记忆补fallback。Web/Device、真实UI保真、资源及cleanup全NOT_RUN。

目前无新增产品裁决：地址取消固定cap、declarations/staticparameter、privateclient与transportowner、credential/role/reset均已确定。Codex实施及本批必要验证已授权；未具备的设备/数据前提和reset/seed等额外动作按§10b处理。若新source与既有需求业务冲突，必须列具体差异，不能把结构整改授权变成产品改写。

## 13 · 动态前诊断、失败和停止条件

必须先给实际测试整条链配关联日志：入口config→Runtime module/order/command→owner context→privateAPI→TDC→transport/HTTP status→owner slice/notification/selector→UI；nativeboot/task/track/window与driverphase/serial/资源身份同样。读真实日志判断first failure、last known good、broken boundary，business与cleanup分开。现日志政策不执行开发诊断字段级脱敏。

日志后的同链路当前字节做两轮fresh只读 `TEST_CHAIN_PREFLIGHT`，覆盖缺控件/错scope/误status/迟到/cleanup/CLI等常见低级错误。可复用满足同链路同日志后字节的既有审查，只对受影响差量复核，不重新开DESIGNcycle。日志新增不能代替此门，文档中的两轮计划不是当前PASS。

同一失败族第二次前冻结该族后续动态，读日志+owning source最小修复、focused关零复发再继续；不延长timeout/魔法等待，不重复全矩阵，不结束已授权goal等Dexter。未知资源/必要product变化/无授权外部环境时fail closed报告。

### 13b · 三维对账

每完整CP fresh三维（正式需求、详设/既有IA、项目记忆规范）只出MATCHED/OPEN，检查逐点双读/focused及失败修复；全部前置CP结束、整体测试前再全批6b，不是CP汇总。CP6运行前无未闭OPEN，cleanupFAIL不得交付。

### 13c · 逐代码与详设对账

计划显式由fresh只读reviewer检查**所有改动行**及附件目标落点，不抽样；包含零调用新增能力、缺产出文件、原生/生成/测试/README/规范/driver。仅MATCHED/OPEN；OPEN不得交Dexter/Codex/Claude做实施交付。此门在整体验证后、交付前，与6b不同；未修改已对账部分不重开。之后还须fresh整批IMPLEMENTATION合理性审查，依据真实代码与授权证据独立GO/NO-GO。

## 14 · 模板与交付自查

§0～14、3固定机制全行、3a既有控件与实际driver、9a六列、10b seed/角色、11a17R/18V、13b/13c均具名。新UI三模板不重绘有据N/A；原Journey保真非N/A；后台审计/HTTP新operation/DB迁移N/A明确。设计完成条件是两份主文、附件、两轮独立设计报告和逐条intake当前可复核；不是生成/测试/运行PASS。


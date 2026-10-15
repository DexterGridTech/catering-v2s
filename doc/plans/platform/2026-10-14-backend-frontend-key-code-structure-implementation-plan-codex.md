# 前后台重点代码结构优化 · 实施计划

## 0 · 任务、输入与授权

日期：2026-10-14。目标是完成正式需求 R01–17/V01–18，保持已批准用户任务与业务事实，消除真实重复/内部泄漏。执行依据是本批 `implementation-design-codex.md` 及 `source-and-verification-appendix-codex.md`，同为 `2026-10-14-backend-frontend-key-code-structure-*`；原需求为 `2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md`。

2026-10-15 最新授权以正式需求§0.1及Dexter会话澄清为准：动态业务验收只在DEV，允许受管DEV reset/完整r5-full seed；禁止操作UAT及使用真机。必要的 focused Testcontainers 测试允许使用现有 `r5-remote-testcontainers` 受管入口，不因此运行全量backend-acceptance、隔离L2或新增suite。Codex可实施本批源码/测试/生成器/配套文档及必要验证；原文档阶段IMPLEMENTATION_AUTHORITY=false及路线A为历史，不是当前实施阻断。六CP仍是一个原子交付批次，业务边界不扩大。
## 1 · 进入条件与执行原则

当前代码读回：remote-control/index.ts及更新Page对它的窄引用已经形成，CP03保留，不重做；CP05只追加launcher出口。现terminalUpdateRuleFilters/terminalUpdateCandidateQuery/terminalUpdateActualUnknownReason等已有纯能力复用，不另造等价helper。主要topic/asset/catalog/extension/六资源改点仍在。shared seed executor现在被DEV/UAT共用，CP04仅改其extensionSubmission和对应静态测试，保留managed-seed-target环境分支；不编辑或运行UAT专属入口。完整来源见本次2026-10-15自审记录。

1. 每次写前重开R/V、详设/附件、命中memory/规范和owning source；写后focused F与同原文回读。每完整CP完成后fresh三维MATCHED才下一CP；单个文件/修复不另建关卡。
2. 主agent唯一写入/运行/收证；finding个人核源后只修确认项。已对账且未改部分不重复，差量只复核实际影响面。
3. 原业务/权限/公开契约/Java FQCN/事务/锁/CAS/receipt/audit/readback保护不变；B4/B5/B7、TER手写、动态catalog/新依赖/新runner不实施。
4. 本批采用F＋D_HTTP/D_BROWSER/W；隔离L2、新admin-ui suite/P1/admission与全量backend-acceptance矩阵不在本次执行范围。此为Dexter批次限定范围，不改R-READ-07正本，不伪称H/L2通过。按Dexter最新澄清，确需直接证明受影响owner接缝时，可选现有 focused Testcontainers/JUnit 测试并走受管 `r5-remote-testcontainers` 入口；不得以此扩大为全量acceptance或隔离L2。
5. DEV reset/seed已获授权，无需重复询问同范围；执行必须显式V2S_RUNTIME_DIR指向本仓.runtime/r5并校验DEV manifest/namespace/数据库。UAT不停止、不重启、不部署、不reset/seed、不写数据；共享主机容量不足时如实停止，不能停UAT腾资源。

## 2 · proof与对账顺序

CP内部：钉住行为→迁移→受影响编译/类型/无环境F→同输入回读→完整CP fresh三维MATCHED。容器依赖测试仅在直接覆盖本CP变更且非重复时按精确测试方法聚焦运行；CP02/04不要求全量backend-acceptance，不把focused测试当真实DEV HTTP或全量持久化证明。

全部CP完成→全批6b独立三维对账→完整实际DEV链日志＋两轮fresh TEST_CHAIN_PREFLIGHT→当前完整seed dry-run及动态前整体准入→必要时受管DEV reset→start→完整r5-full seed→独立owner readback→四个现Web run（console update附三个后台检查、wallpaper update、两个sample remote）→必要受影响DEV HTTP收口→13c逐代码对账→fresh整批IMPLEMENTATION review→Dexter/Claude。

整个动态期间复用同DEV，顺序执行。重跑只针对首败修复影响面，不重复未改矩阵；不启动最终full backend-acceptance或隔离L2。

## 3 · CP-01 · 协议单源与保护基线

RECALL：需求R01–04/R07；详设§3/4/8.1；附件§1/2/6；canonical；当前T1 outputPaths；真实Protocol/Codec/workspace parser；现scope/grant/tx/公开构造。

1. 在现测试钉住每条变更的实际生产接缝：Protocol/Codec合法topic/typed拒绝；Web六个body enum字段/nullable/坐标/非字符串校验；原asset/catalog/FQCN/direct构造与业务证据范围。记录现HTTP operation/参数/errorSetRef∪augmentation，不只记方法名。
2. Protocol加载不可变topic Set并拒空；Codec改实例消费，删除TOPIC_KEYS。session业务scope与repository SQL分类不动；processResources仍从canonical拷resource。
3. 原remote generator按message＋field遍历六个现enum字段新增runtime数组，与type同源，对两个当前目标同renderer生成；Web parser提具名能力并消费。成员判定先核真实string、nullable显式；保留UUID/seq/bytes/shape/cancel坐标/关联；TER手写消费不接入，不分目标render。
   写前重开当前outputPaths/renderContract/测试，不以本设计的双目标截面重建名单或覆盖T1已添加的合法输出/export。兼容当前同renderer的目标只做additive生成；新格式或超出R04派生修改边界时停该生成点为OPEN，说明差异，不自行分目标渲染。其他无依赖工作不因等待该点而改方案。
4. 做本CP实际F：两个Java protocol tests、generator/parser行为测试及相关types；current classpath按实际构建/依赖输出核，不因本CP无容器依赖而启动Testcontainers，不由Boot4.1.0猜Spring版本。若后续CP的修改确需容器证明，按现有受管入口定向运行。本CP保留原typed errors/公開模型/事务属性清单。
5. 全CP fresh三维对账。失败形状：只改一目标、仍手写闭集、把合法topic替代binding权限、canonical resource被手改。只有MATCHED可进入CP02。

## 4 · CP-02 · asset/catalog现owner内提纯

RECALL：需求R05–07/R14；详设§6/8.2/8.3；附件§1/3；R-READ01–10；asset public消费者、catalog pure/IO边界与constructor/promotion。

1. 先补真实服务行为oracle，不靠新pure类测试替代原生产边界。asset公共图片/ZIP，两个temp前缀、stream close/读取失败、实际限长；catalog null/MissingNode/SKU子集/totalCount、真实detail/preparation/单位与inbound、CAS/receipt/promotion。
2. AssetService唯一private stream helper，保留两wrapper各限值/签名/decode/异常/caller清理。stage的无外层事务/objectIO/TransactionTemplate/finally原次序不动；video仍公共拒绝，不加恶意输入专项。
   原PlatformAssetServiceTest的temp扫描只覆盖图片前缀；扩原helper/fixture使图片与ZIP各从真实public wrapper验证，正常小输入下核读取/存储/metadata失败的close、自有temp删除及原typed异常/cause。不能用一个前缀的无残留代替另一条链，也不扫描删除未知文件。诊断复用原owner日志，不新日志或上传平台。
3. 制作差异进现ValueSupport；新DraftValidator迁具名shape/SKU/derived pure簇，原Facts低层校验仍原编排。新DetailAssembler只读已取值；内部ItemFacts必须带sourceScopeRef，按原sourceFact优先级判断来源；用相同sections、null/非null sourceScopeRef验证SELF_MANAGED/COPIED。InboundReference具名投影，不搬JDBC/owner调用。实际helper闭包一项一项查，发现IO就在原owner读并传值，不留第二纯实现。
4. facade/public constructors/nested records/FQCN、promotion/self-call/所有@Transactional属性保持；不新增dependency容器/Bean/proxy、raw-SQL接口或DB预算例外。
5. F pure及不依赖环境的现service测试、相关编译。必要时可通过既有受管入口聚焦运行直接覆盖本次变更的现PG/Flyway集成测试；本CP只选asset物化、Catalog详情/草稿相关方法，不运行其余模块测试。先静态核事务、source/readback/错误映射并完整CP独立MATCHED；真实DEV状态仍由全批6b后的seed及代表HTTP读回证明，不把F当DEV业务证明。

## 5 · CP-03 · App注册与feature边界

RECALL：D01/02；R08/09/13；详设§8.4/8.6；附件十一引用与现registered catalog/授权/type-only、lifecycle词表；原IA。

1. Registration必填icon，每现registered页自己声明；Shell menu成员由catalog/注册/授权决定，删icon filter。分组图标保留，route/scope/焦点原路径保持，不缺注册时用默认图标兜。
2. 本CP保留已存在remote index及workspace/Target/UUID导出，核现Page已从该入口消费；只建立仍缺的organization-status/gate/channel-label窄index，实际消费改入口，含转导出与type-only。extension-fields出口到CP04实际pure能力诞生时同建，remote launcher出口到CP05补；没有定义前不能前向export或加空实现占位。没有外部消费者的内部能力不export，不新增空index。
3. 局部状态mapper从foundation取已知label/color，原规则table/detail与门店fallback各保留。报告/任务/remote状态不碰。现不同owner限值/算法值保持，不机械抽ParameterDefinition。
4. 注册/label/consumer types/窄入口真实red F；public-entry门不通过字符串数量判断所有model，只核外部feature引用与合法内部反例。完整CP独立MATCHED。

## 6 · CP-04 · extension canonical对象全链

RECALL：R12；详设§8.7/9a/10b；附件§2/3十四操作、真实edge、owner typed list、seed七条create；原十Drawer IA。

1. 先在現OrganizationExtensionFields测试和真mapper/HTTP域准备false/0/DATE、CLEAR=null、omission、原值不变、disabled/required、幂等重放及持久化oracle。
2. extension-fields纯能力真实返回对象并同CP建立index窄出口；迁移十Drawer及其六份同语义filter/sort、当前detail渲染消费者与转导出，删除旧helper/双cast。同一index具名导出现extensionListAndSearchColumns/extensionQueryValues，BusinessEntityManagementPage、StoreManagementPage、ContractManagementPage改从该入口引用；原extensionList.tsx实现、查询参数/列配置/排序不搬，orderedExtensionFields不额外公开。表单保留同displayOrder输入顺序；列表保留现displayOrder+key规则，共享enabled过滤而不强行统一两种排序。宿主query/lifecycle/业务scope/幂等不搬。平台和服务点原object整体提交保持，不套delta。
3. 同步owner-command-seed-executor extensionSubmission与七请求到object，保持fixture值/角色/count/失败readback；SERVICE_POINT object反例保留。test.mjs改行为断言，不以seven字符串次数假绿；CP内不运行seed/reset，后续DEV动态阶段按已批准顺序执行。
4. 遷移附件列明所有array acceptance/edge fixtures（含共享helper、空List）并扫描 scripts/tools/frontend/host tests新增同根；测试fixture不是生产兼容理由。无生产arraycaller后删mapper legacy branch，保留typed owner list/public方法/空对象与非法输入错误映射；若找到真实外部调用者先回设计说明，不能突然保留匿名fallback。
5. F十四request实际payload、pure、mapper及seed helper；三个列表类型/现extensionList.test.ts及public-entry红例。legacy acceptance/edge fixture与mapper退出同组同步。完整CP静态三维MATCHED；真实SET/CLEAR/omission/同键重放的独立owner GET由附件§3/4的DEV链在全批6b之后执行；required/disabled拒绝仅F/原owner源码保留，除非修订接缝确需现有受管入口的 focused 容器 proof；不新增DEV拒绝fixture，不借旧H或F升级。

## 7 · CP-05 · 更新Page与远控资源边界

RECALL：R10/11；原更新/remote IA/UI；详设§8.5；附件四hooks/资源/控制面与foundation。

1. 先用真实hook/component接缝deferred requests钉success/error/finally、context/entity/cursor、unmount与overlay；不是只assert源码有guard。
   在既定terminalUpdateReadModels.test.tsx/RuleCreateDrawer.test.tsx补“检查通过后又await→切换context/entity/cursor或关闭→旧成功/拒绝/finally”的反例；结果、problem、loading/ref与回调均不覆盖新资源。复用foundation guard，不新增counter/通用loader。
2. 四具名业务read hook直接消费foundation guard/query identity/cursor，detail与page独立；Page消费读回不留镜像。所有旧counter/result实现删除，原一次刷新收口保留。
3. RuleCreateDrawer搬原lifecycle/幂等/FULL-HOT候选与选FULL约束；dirty draft、submit/failure、title/button intent与CAS错误精确保持。现PlatformRead正确guard、SalesMenu readModel保留，仅改深引用。
4. remote launcher迁宿主start/restart/late cleanup且唯一拥有currentSession；workspace删除initialStart镜像/useState/setCurrentStart，受控currentStart prop变化驱动原Room effect。description/phase等连接呈现态仍归workspace。宿主传原qualified target/权限/ONLINE与焦点；旧start和资源callback只end捕获的旧session，F覆盖A→restart B→A迟到，不建第二session账本/状态机。
5. 补实际mock Room控制行为F，但标明test seam边界；没有原生/media证明。完整CP独立MATCHED。
   在既定useRemoteControlLauncher.test.tsx/RemoteControlWorkspace.test.tsx保持同一Workspace挂载，受控currentStart从A变B，交错A的disconnect/end成功或拒绝；检查A自己的listener/keepalive/Room释放，B的phase/problem/loading/tracks及关闭链不被A修改。已ended/失效身份/end拒绝不豁免旧资源清理；正常disconnect finally沿用，禁止以重挂载或void Promise证明释放完成，不建新资源registry/queue。
   并行end/disconnect启动时即接拒绝观察；补end先拒绝、disconnect随后完成/拒绝的既定F反例，两项结果独立，不出现未处理reject，不以HTTP成功为Room释放前置。

## 8 · CP-06 · 文档、DEV验证接缝与全链日志

RECALL：需求§0.1/R15–17；详设§3a/9a/10b/11a/13；附件§3–5；现terminal-automation/update owner-flow、seed target及受管DEV日志/预算。

1. 同步实际README/public entry/generated来源与既有checklist。规范够用不复制正文；不改全局验证规范，不制造第二账本。
2. 将原三个后台检查接入console现update.owner-flow，唯一新增普通helper为tools/terminal-automation/journeys/adminStructureDevUi.ts及test/adminStructureDevUi.test.ts。在真实报告accepted、CBS读回与assertTerminalUpdateReportInUi完成之后、business PASS输出之前调用。复用现supply browser，新增受管contexts须helper try/finally关闭；不新phase/case/runner，不换原supply session，不创建独立Java/DB/TDS环境。
3. 按附件§4准备角色/assignment、原seed STORE/CONTRACT事实和真正操作节点。补缺失App TestId常量和控件透传，先F＋fresh UI/TestId核验再写/跑locator。未授权菜单/缺注册由F和DEV reader各按精确范围证明；更新/远控和W_CONTROLLED_UI沿原节点，历史fixture不冒充CBS报告。
4. createTerminalUpdateSupplyUi最小additive返回platformPage与当前owner读回的projectRef/contextVersion供helper；其browser/context创建和afterAll仍由原调用者管理。root平台会话仅经现owner HTTP准备run-owned角色/邀请；HTTP复用现generated operation路径和page.request/seed-http-client能力，不另写fetch执行器或通用fixture系统。每个mutating请求明确scope/context/idempotency，独立GET确认持久化。正常错误/竞态仍优先F，不为极端条件扩大DEV场景。
5. 删除原新admin-ui-l2 policy、P1、admission、fixture、spec、CLI及browser-l2-runtime扩suite全部实施义务；现三个隔离suite及其来源文件保持。不登记这些未创建Node测试，不部署新LiveKit或改TDS网络。附件§5.1点名的五项现test-health漏登记仅按写前当前发现集补元数据/现red，相关focused Node检查不启动其业务环境，不跑--node全集或全verify。
6. 工件先复用有效update.artifacts导出；无可用输入才由原受管入口准备两App INSTALL/FULL/HOT十文件供完整dry-run/seed。update.owner-flow自身构建成本仍存在，不声称取消L2就取消APK打包。源export由原owner身份精确回收，保留小报告；DEV/browser/角色fixture cleanup各自读回。
7. 补真实全链日志：parent/run/DEV manifest、seed阶段与角色/fixtureRef、UI动作、operation/request/context、CBS edge/owner typed拒绝和原cause、持久化GET、async stale/settle、Room结束与cleanup。先第一轮fresh源码证伪→主agent最小修复→第二新fresh同根核验→确认缺口关闭再动态。复用相同链/字节的已有效结果，不反复对账；范围外必要日志修补不借机扩产品。
8. 受影响F、helper identity/角色/GET/首败/cleanup red与所有生成/测试/README接缝闭合后完整CP MATCHED；动态business/cleanup仍NOT_RUN，不能预写PASS。

## 9 · DEV准入、reset/seed与未来命令

### 9.1 必须顺序

全部CP＋全批6b MATCHED、实际DEV全链日志和两轮TEST_CHAIN_PREFLIGHT关闭、UI/TestId实际节点静态复核通过、当前完整seed dry-run PASS，才开始本批整体动态。首个reset前dry-run必须先成功；任何失败保留首败，不能先破坏数据再补输入。

每次动作显式绑定本仓.runtime/r5：manifest.kind=r5-dev-run-manifest、namespace=v2s-dev-*、数据库=catering_v2s_dev_*及DEV host/boot/PID/startTicks/日志身份。共享seedRuntimeRoot受V2S_RUNTIME_DIR影响，禁止继承指向.runtime/uat的值、UAT manifest或UAT endpoint。运行资源预检不能因为DEV/UAT同host而停UAT或删UAT容器/卷。

最终字节的实际完整seed对象提交必须得到证明；可复用同字节已具名的实际seed结果，不把旧数据存在当证明。若需重新装载，先dry-run，再用下表精确入口reset→start→seed。reset/start没有--profile参数；reset仅目标DEV，start绝不自动seed。完整seed父/子报告与独立owner读回确认后才四W。真实seed必须执行修改后的七处对象提交，不把dry-run当证明。

### 9.2 授权后入口（本轮文档不执行）

| 事项 | 唯一现入口/拟改接缝 | 证明与限制 |
|---|---|---|
| F | 两后台现typecheck/Vitest、相关Node生成/测试、现Java编译与可独立运行的纯值单测 | 不默认verify；需要容器/隔离PG且直接证明受影响接缝时，可走现有受管入口定向运行，不另造运行入口 |
| 工件输入 | R5_TERMINAL_UPDATE_SEED_ARTIFACT_EXPORT=1 node scripts/test/terminal-automation.mjs --phase update --platform web --shape mobile --case update.artifacts | 原十文件导出，源run business/cleanup；无设备验证 |
| 完整dry-run | V2S_RUNTIME_DIR=<仓根>/.runtime/r5 R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID=<有效源runId> scripts/dev/seed --profile r5-full --dry-run | 只计划/准入，先于reset，不写DEV/UAT数据 |
| DEV reset | V2S_RUNTIME_DIR=<仓根>/.runtime/r5 R5_RESET_CONFIRMATION=EXPLICIT_R5_RESET R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID=<有效源runId> scripts/dev/reset | dry-run先成功；原入口自行处理自己的DEV停机及精确DEV DB/Doris清理，不加--profile，不碰UAT |
| DEV start | V2S_RUNTIME_DIR=<仓根>/.runtime/r5 scripts/dev/start | 无参数；加载当前代码，绝不自动seed |
| DEV seed | V2S_RUNTIME_DIR=<仓根>/.runtime/r5 R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID=<有效源runId> scripts/dev/seed --profile r5-full | 实际七处对象提交、完整父子结果和owner读回；已授权，不再次索要权限 |
| console DEV主链 | node scripts/test/terminal-automation.mjs --phase update --platform web --shape mobile --sample console --case update.owner-flow | 原真实供给/规则/报告＋新增三个后台检查/D_HTTP；helper在真实task读回之后执行 |
| wallpaper DEV主链 | 上行sample改wallpaper | 原供给/规则/报告＋原分页/状态回归；不重复本批三后台fixture |
| 两sample远控 | node scripts/test/terminal-automation.mjs --phase remote --platform web --remote-topology mobile-single --sample console\|wallpaper --case remote.main（分别执行） | 原LiveKit＋synthetic track，新增restart/焦点/释放；非Android |

不执行全量scripts/test/backend-acceptance、browser-l2-runtime新suite或UAT。本批以四个Web run为默认验证面；确需容器证明修改接缝时，使用现有受管 `scripts/test/r5-remote-testcontainers.mjs`，只选择相关类/方法，不扩为全量模块或acceptance矩阵。若真实修改影响TER终端功能且Web不能证明，仅增加受影响场景的安卓虚拟机定向验证（显式serial、现driver），禁止使用真机双屏设备。非adapter仍先Web；不重跑未受影响设备矩阵，不新增拓扑或设备runner。真实DEV服务/浏览器/API证明标D_HTTP/D_BROWSER/W，不叫隔离L2/H或全量acceptance。所需代表HTTP proof与四W若同run已覆盖，不再拆额外run重复证明。

### 9.3 清理与失败

run-ownedcontexts/browser/Expo/driver/导出临时物按原owner身份回收；helper只撤销自己新增assignment/作废自己role，恢复本次改过的seed扩展值并独立GET读回，保留邀请/审计历史，不删除业务表。DEV最终保留运行及r5-full数据用于体验，标PRESERVED_DEV_STATE，不误判为进程泄漏；未知进程/共享cache/UAT资源不删除。

首败停业务操作→日志诊断broken boundary→确认根因最小修复→受影响focused同档复验；不延timeout、不盲重跑、不重复未改矩阵。cleanup或DEV恢复失败均如实保留，不能只凭business PASS交付。

## 10 · 逐代码与详设对账与实施交付

显式步骤名：**逐代码与详设对账**。执行者fresh只读subagent；范围所有新增/修改/删除生产代码、generated diff、测试、fixture/seed helper、README/public source/控制面每行，对当前设计/附件条款；核零调用者、点名未产文件、事务/授权/错误/identity/资源/UI/范围。只MATCHED/OPEN，OPEN先最小修复再复核真实影响面，不能抽样，不能复用6b替代；未MATCHED为“实施未就绪”。

其后fresh整批 `REVIEW_TARGET=IMPLEMENTATION` 依据正式需求/详设/原IA/真实代码与授权proof形成独立GO/NO-GO、M/S/N及DESIGN_GAPS。代码忠实设计仍须判断合理性；L3_UI未证不能写裸GO。新finding主agent核源/最小修复，变动只定向复验，不重复未修改对账。

最后交Dexter/Claude的包：当前source/设计SHA范围、逐CP/6b/13c适用字节、逐V场景结果与run/source/档位、第一失败及边界、日志/business/cleanup、DEPENDENCY/NOT_RUN/OPEN清单、原生/媒体/其他未改scope限制。运行状态“当前字节最新运行”与“最后一次通过”分开，不用计划/测试源码/作者intake宣称PASS。

## 11 · 当前设计审查

以下是旧字节历史记录，非本轮审查：cycle=`BACKEND_FRONTEND_STRUCTURE_IMPLEMENTATION_DESIGN_20261014`；REVIEW_TARGET=DESIGN。治理默认两轮，原R1/R2及R2的ROUND_FINAL_DECISION=SELF_DECIDED独立裁定均原样保留，作者不代写。Dexter本次直接指派全文为“请根据项目设计规范，和需求文档，生成详设和实施计划，并完成对抗式review，直至go，最后将详设和实施计划给另一个Claude做review”。依本次明确“直至go”的追加范围，R2确认项最小修订后再交新的fresh reviewer核验当前整包及差量；计为原cycle的R3，不重置轮数或重开需求cycle，不将这一会话例外写成长期治理规则。每轮先读足适用最小输入、独立证伪形成verdict后才读intake。原verdict/SHA和阅读限制不可改；当前修订只有作者处置，必须另有当前字节独立结论，不能冒称R2已GO。本设计静态通过不授实施；所有生成/编译/F/H/L2/cleanup NOT_RUN。

2026-10-14 本轮：Dexter实质选择A，改变V09/V10/V11/V14验证档位及CP06范围。新cycle=`BACKEND_FRONTEND_STRUCTURE_ROUTE_A_20261014`，REVIEW_TARGET=DESIGN，REVIEW_ROUND_LIMIT=2；只审本次修订及同根接缝，不重开原cycle。R1/R2均fresh只读，主agent只转录原verdict和随后处置；R2后按SELF_DECIDED硬停止。本轮没有实施/运行；旧R4结论不能推为本轮当前字节GO。

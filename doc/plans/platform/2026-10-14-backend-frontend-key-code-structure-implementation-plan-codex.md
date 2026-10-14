# 前后台重点代码结构优化 · 实施计划

## 0 · 任务、输入与授权

日期：2026-10-14。目标是完成正式需求 R01–17/V01–18，保持已批准用户任务与业务事实，消除真实重复/内部泄漏。执行依据是本批 `implementation-design-codex.md` 及 `source-and-verification-appendix-codex.md`，同为 `2026-10-14-backend-frontend-key-code-structure-*`；原需求为 `2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md`。

本文件只获文档编写/对抗审查及Dexter选择A后验证档位同步授权，IMPLEMENTATION_AUTHORITY=false。源码/测试/生成器/规范/记忆/依赖、编译/构建/测试/verify、环境/数据/设备/L2/UAT/部署均不授权现在执行。未来按全部CP一次性实施/交付，不拆成各module独立交付。需求旧字节与作者intake不是当前设计GO；独立设计报告另存。

## 1 · 进入条件与执行原则

2026-10-14 T1 review影响同步：本次只修本计划、详设§0.1/8.1/8.2/8.5/12及直接验证附件，不授实施或运行，不联络/中断在途Codex。保留原需求、路线A、CP和验证档位；不搬TER declarations/ParameterDefinition/错误或凭证机制。以下补充只落实既定生产接缝，原review verdict保留为旧字节记录，不将文档读回写成新的独立GO。

2026-10-14 当前源码自审：详设§0.2及 `doc/review/platform/2026-10-14-backend-frontend-structure-current-source-self-audit-codex.md` 记录本次来源与修订。CP04同组补齐三个现列表的extension-fields出口；CP05补并行关闭的拒绝观察；路线A的三L2/四W及最终H不变。T1私有HTTP、LiveKit配置和driver接缝在当前源码可定位，写前读回具体接口即可，不等待重开T1评审；仅真实调用前提不满足时停对应W并说明，不回退旧API或扩TER整改。主agent仍只准备当前CP所需最小输入，不提前重复全批对账。

1. Dexter 明确批准当前设计并给出实施/具体动态面授权；设计不能自授权。更新/远控/组织/合同的已有IA/交互为ESTABLISHED_SOURCE，本批无新产品页面。若操作/权限/反馈必须改变，回Dexter，不能自己扩需求。
2. 每次写前只准备当前点可执行的最小输入，重开对应R/V、设计/附件目标、全部命中memory与规范、owning source及实际复用接缝；写后focused proof与同组原文回读。每完整CP source/proof/修复齐后fresh三维对账MATCHED才下一CP。新file或单个修复不另设对账阶段。
3. 主agent唯一写/运行/收证；subagent只读。确认finding先个人核源、找反例、比较更小修法，不能照单全收；已对账且未改部分不重复，变化只复核其影响面。
4. 不默认全仓verify；不升级依赖、不改变API/DB/权限/业务状态；不改TER手写。原B4/B5公开契约/FQCN移位和B7新容器不执行。T1当前outputPaths与目录写前重读，由Dexter协调先后，不覆盖其在途源码。
5. 昂贵/动态操作包括容器测试、L2、APK工件构建、reset/seed必须在后来授权范围内。仅构建测试工件不等于运行TER设备；本批复用两个sample的现Expo Web update/remote Journey，不设Android/设备运行矩阵。预算不自主放宽，业务正确性不能省略。

## 2 · proof与对账顺序

CP内部：行为钉住→迁移→受影响type/compile/F→同输入回读→CP完整独立三维MATCHED。涉及真实容器/网络proof的CP先§8当前实际链两轮TEST_CHAIN_PREFLIGHT，无需提前伪造CP已MATCHED；纯本地类型/静态不进入该动态准备。

受影响HTTP接缝在相应CP做focused H（业务与cleanup均PASS）→全部CP退出→全批6b独立三维对账→动态前整体准入（含当前完整seed dry-run）→三个隔离L2 case＋两个sample的现update/remote Web回归（W）→最终一次全量backend-acceptance（晚于全部生产/测试改动）→逐代码与详设对账13c→fresh整批IMPLEMENTATION review→Dexter/Claude。focused H是API进入前端L2前的事实证明，最后full H是R-READ07的最终字节闭包，两者不能互相替代。任何dynamic导致改码，只修根因及受影响proof/准入；最后full acceptance须重新绑定最终字节，不拼接focused PASS。无需重复完整未受影响L2矩阵。

## 3 · CP-01 · 协议单源与保护基线

RECALL：需求R01–04/R07；详设§3/4/8.1；附件§1/2/6；canonical；当前T1 outputPaths；真实Protocol/Codec/workspace parser；现scope/grant/tx/公开构造。

1. 在现测试钉住每条变更的实际生产接缝：Protocol/Codec合法topic/typed拒绝；Web六个body enum字段/nullable/坐标/非字符串校验；原asset/catalog/FQCN/direct构造与业务证据范围。记录现HTTP operation/参数/errorSetRef∪augmentation，不只记方法名。
2. Protocol加载不可变topic Set并拒空；Codec改实例消费，删除TOPIC_KEYS。session业务scope与repository SQL分类不动；processResources仍从canonical拷resource。
3. 原remote generator按message＋field遍历六个现enum字段新增runtime数组，与type同源，对两个当前目标同renderer生成；Web parser提具名能力并消费。成员判定先核真实string、nullable显式；保留UUID/seq/bytes/shape/cancel坐标/关联；TER手写消费不接入，不分目标render。
   写前重开当前outputPaths/renderContract/测试，不以本设计的双目标截面重建名单或覆盖T1已添加的合法输出/export。兼容当前同renderer的目标只做additive生成；新格式或超出R04派生修改边界时停该生成点为OPEN，说明差异，不自行分目标渲染。其他无依赖工作不因等待该点而改方案。
4. 做本CP实际F：两个Java protocol tests、generator/parser行为测试及相关types；current classpath按实际受管任务输出核，不由Boot4.1.0猜Spring版本。保留原typed errors/公開模型/事务属性清单。
5. 全CP fresh三维对账。失败形状：只改一目标、仍手写闭集、把合法topic替代binding权限、canonical resource被手改。只有MATCHED可进入CP02。

## 4 · CP-02 · asset/catalog现owner内提纯

RECALL：需求R05–07/R14；详设§6/8.2/8.3；附件§1/3；R-READ01–10；asset public消费者、catalog pure/IO边界与constructor/promotion。

1. 先补真实服务行为oracle，不靠新pure类测试替代原生产边界。asset公共图片/ZIP，两个temp前缀、stream close/读取失败、实际限长；catalog null/MissingNode/SKU子集/totalCount、真实detail/preparation/单位与inbound、CAS/receipt/promotion。
2. AssetService唯一private stream helper，保留两wrapper各限值/签名/decode/异常/caller清理。stage的无外层事务/objectIO/TransactionTemplate/finally原次序不动；video仍公共拒绝，不加恶意输入专项。
   原PlatformAssetServiceTest的temp扫描只覆盖图片前缀；扩原helper/fixture使图片与ZIP各从真实public wrapper验证，正常小输入下核读取/存储/metadata失败的close、自有temp删除及原typed异常/cause。不能用一个前缀的无残留代替另一条链，也不扫描删除未知文件。诊断复用原owner日志，不新日志或上传平台。
3. 制作差异进现ValueSupport；新DraftValidator迁具名shape/SKU/derived pure簇，原Facts低层校验仍原编排。新DetailAssembler只读已取值；内部ItemFacts必须带sourceScopeRef，按原sourceFact优先级判断来源；用相同sections、null/非null sourceScopeRef验证SELF_MANAGED/COPIED。InboundReference具名投影，不搬JDBC/owner调用。实际helper闭包一项一项查，发现IO就在原owner读并传值，不留第二纯实现。
4. facade/public constructors/nested records/FQCN、promotion/self-call/所有@Transactional属性保持；不新增dependency容器/Bean/proxy、raw-SQL接口或DB预算例外。
5. F pure与原PG/service集成focused；同输入读回source/readback/错误映射；受影响asset/catalog实际HTTP接缝先focused H BUSINESS/cleanup PASS，再完整CP独立MATCHED。纯测试不能证明真实persistence；整批最终full H仍留整体最后。

## 5 · CP-03 · App注册与feature边界

RECALL：D01/02；R08/09/13；详设§8.4/8.6；附件十一引用与现registered catalog/授权/type-only、lifecycle词表；原IA。

1. Registration必填icon，每现registered页自己声明；Shell menu成员由catalog/注册/授权决定，删icon filter。分组图标保留，route/scope/焦点原路径保持，不缺注册时用默认图标兜。
2. 本CP先建立remote现workspace/Target/UUID及organization-status/gate/channel-label的窄index，实际消费改入口，含转导出与type-only。extension-fields出口到CP04实际pure能力诞生时同建，remote launcher出口到CP05补；没有定义前不能前向export或加空实现占位。没有外部消费者的内部能力不export，不新增空index。
3. 局部状态mapper从foundation取已知label/color，原规则table/detail与门店fallback各保留。报告/任务/remote状态不碰。现不同owner限值/算法值保持，不机械抽ParameterDefinition。
4. 注册/label/consumer types/窄入口真实red F；public-entry门不通过字符串数量判断所有model，只核外部feature引用与合法内部反例。完整CP独立MATCHED。

## 6 · CP-04 · extension canonical对象全链

RECALL：R12；详设§8.7/9a/10b；附件§2/3十四操作、真实edge、owner typed list、seed七条create；原十Drawer IA。

1. 先在現OrganizationExtensionFields测试和真mapper/HTTP域准备false/0/DATE、CLEAR=null、omission、原值不变、disabled/required、幂等重放及持久化oracle。
2. extension-fields纯能力真实返回对象并同CP建立index窄出口；迁移十Drawer及其六份同语义filter/sort、当前detail渲染消费者与转导出，删除旧helper/双cast。同一index具名导出现extensionListAndSearchColumns/extensionQueryValues，BusinessEntityManagementPage、StoreManagementPage、ContractManagementPage改从该入口引用；原extensionList.tsx实现、查询参数/列配置/排序不搬，orderedExtensionFields不额外公开。表单保留同displayOrder输入顺序；列表保留现displayOrder+key规则，共享enabled过滤而不强行统一两种排序。宿主query/lifecycle/业务scope/幂等不搬。平台和服务点原object整体提交保持，不套delta。
3. 同步owner-command-seed-executor extensionSubmission与七请求到object，保持fixture值/角色/count/失败readback；SERVICE_POINT object反例保留。test.mjs改行为断言，不以seven字符串次数假绿；不执行seed/reset。
4. 遷移附件列明所有array acceptance/edge fixtures（含共享helper、空List）并扫描 scripts/tools/frontend/host tests新增同根；测试fixture不是生产兼容理由。无生产arraycaller后删mapper legacy branch，保留typed owner list/public方法/空对象与非法输入错误映射；若找到真实外部调用者先回设计说明，不能突然保留匿名fallback。
5. F十四request实际传payload、纯值和mapper；三个列表的类型检查与现extensionList.test.ts验证列/搜索结果保持，public-entry门覆盖这三条外部引用的违规red及同feature内部引用反例；实施获相应环境授权后，必须H focused沿现ExtensionAcceptanceScenarios验证对象SET（false/0/DATE）、CLEAR、omission、重放和权威持久化，BUSINESS/cleanup PASS才允许对应L2；未授权时停在此CP真实proof OPEN，不用F补位。完整CP独立MATCHED，源/fixture/seed旧形状未齐不得进入CP05。

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

## 8 · CP-06 · 控制面、文档及全链日志

RECALL：R15–17；详设§3a/9a/10b/11a/13；附件§4/5；implementation模板6c、browser-L2正本、scripts README唯一順序。

1. 同步实际README/public entry/generated来源与规范导航；既有规范够用不复制正文、不改新规范。将详设/附件中的四种通用失败模式纳入已有review checklist/测试，源与防再犯范围相同，不造合规台账。
2. 先逐case/action节点核UI/TestId/fixture（菜单两角色PROJECT固定scope，精确page/capability/assignment按附件§4.1，不点disabled selector），真Button/input/Menu/Date clear/dirty guard可被唯一常量操作；历史分页节点属于附件§4a的W_CONTROLLED_UI，不加入三个隔离L2 case。`useDrawerFormLifecycle`现dirtyGuardTestIds直接传testId属性，不建第二确认层；缺绑定先修UI+F+fresh review。UI_DESIGN_REVIEW/TESTID_REVIEW当前字节PASS前不写spec/binding。
3. 按附件§5接现browser-l2的admin-ui suite与same-run P1，同时新增admin-ui-l2-admission.json与窄strategy适配文件/测试，复用createL2SuiteAdmissionStrategy，逐case来源/控制面/UI目录/三标记/独立reviewRecordPath固定。不把旧未注册spec当入口。所有新/改控制面file在§3a名单内，既有三suite行为与入口保持。fixture从真实owner HTTP建，不借DEVseed、不复制runner，不假ONLINE/REPORT。
4. 按Dexter选择A，删除隔离TDS/profile、wire新模式、报告credential fixture、工件到L2移交；L2只三个case，全由现owner HTTP fixture。不新增本机TDS节点tunnel、不改wire/TDS/DEV拓扑、不为此部署LiveKit。更新/远控原动作节点作为现Web Journey观察表，按附件§4a复用 terminalUpdateSupplyUi/update.test.ts/remote.web.test.ts；不另造suite或pair runner。F保留全部六读资源、dirty/CAS、A→B迟到与所有生命周期fallback。
   W准备时按T1修复后实际source出口读回私有API→TDC认证→transport、模块贡献/surface及driver配置接缝，不沿用旧业务TDC facade、One/Two输入或旧runner。T1相关问题未闭合时只保持依赖它的W为OPEN，不用本批修TER或靠重复跑发现问题；本批frontend F/backend和三个隔离L2仍各按自身前提推进。未受本批改动影响的T1矩阵不重跑，既有日志/查漏结果符合相同链路和字节条件则复用。
5. 首次隔离L2前仍须现update.artifacts构建两App并导出十文件供完整seed dry-run；不把工件交给L2，不建L2 artifact producer或回收协议。现update.owner-flow自身仍会构建所选App的INSTALL/FULL/HOT，不能声称A省掉全部TER构建。构建、dry-run、DEV及Web均待未来明确授权，先核T1当前住址。源export按原owner身份回收，无现成精确入口时如实OPEN并核源最小补正，不创建第二账本。完整dry-run不执行七处owner seed，真实对象提交及持久化保持NOT_RUN。
6. 准备全链必要日志：入口stage/run、fixture/account角色读回、动作/request/context、edge/owner异常、async settle/ignored stale、oracle/firstfailure、cleanup；fixture/body秘密不写业务日志，runner原始错误按现规范保留，审计不替代诊断。每次真正动态proof前两轮fresh TEST_CHAIN_PREFLIGHT：第一轮证伪→核源最小修复→第二新fresh同根核验，全部关闭再跑；已覆盖且未变链可复用，不重开DESIGN cycle。
   精确日志保护落点见详设§13：复用现CatalogInventoryScopeProblemLoggingTest的无nested cause用例，核本批asset/规则/remote实际拒绝链与现TerminalRemoteControlControllerDiagnosticTest。异常自身stack和原cause保留，原HTTP错误映射不改；正常completion无Throwable是合法反例。只补原logger和现测试，不从T1推广后台SYSTEM分类或重写全域advice。
7. 同步现scripts/test/test-health-entry-runner.mjs#nodeTestFiles及其.test.mjs：登记本CP新增admin-ui-l2-admission.test.mjs、admin-ui-l2-p1.test.mjs、admin-ui-l2-fixture.test.mjs（均scripts/test/下），删除/重命名也同步，不把新增文件存在当自动执行。当前同根缺登记5项也只补此共享入口：scripts/test/terminal-remote-control-protocol.test.mjs、scripts/dev/terminal-update-seed-plan.test.mjs、scripts/dev/terminal-update-seed-executor.test.mjs、scripts/dev/r5-fixture-contract.test.mjs、scripts/dev/r5-livekit-resident.test.mjs；不改这5个测试的业务/运行形态、不把既存差异冒称新回归。写前复核当时发现集，避免覆盖在途追加；新增/删除元数据同组同步。用现validateExplicitTestSet及既有health测试的缺项/重复/额外项red验证入口，保留原scope，禁止宽glob、新入口或通过改mock掩盖现真实目录。只做相关focused Node文件和入口self-test，不默认执行--node整集合或完整verify，也不因登记包含seed/LiveKit测试就授权运行seed/服务。若仍有未归属新漂移如实OPEN并协调其owner，不能宣称CP已MATCHED。F suite/policy/P1/identity/resource/firstfailure/cleanup红例及现Web Journey helper focused闭合，所有scope/TestIds/params传递完。完整CP独立MATCHED；所有运行仍NOT_RUN，不能以源码齐宣称L2准入PASS。

## 9 · 整体准入与未来命令

先全批独立6b三维MATCHED（不是CP结论汇总）。`动态前整体准入`显式要求：所有CP MATCHED、6b MATCHED、§3a UI/TestId/L2控制面当前字节独立PASS、当前完整seed dry-run PASS、所需链日志与两轮TEST_CHAIN_PREFLIGHT关闭；首次L2即须dry-run，不能等到reset。若实际reset/seed，另需Dexter明确授权。artifact准备先于dry-run和L2，已完成的源run不与L2同时占受管运行。W复用现DEV identity、seed fixture、root/operations凭据、HAProxy/LiveKit resident及Vite/browser owner；不借隔离L2的DB/账号，不新建环境。未就绪停在具体前提，不自动reset/seed/deploy。三个L2与四个W run顺序执行，不并发争用共享终端。backend-acceptance不被L2的四项循环前置卡住，但其自己的链准备/环境授权/cleanup仍强制。

以下为**未来实施获得授权后**的执行路径，不是本轮运行指令：

| proof | 入口（当前/拟新增明确区分） | 结果范围 |
|---|---|---|
| frontend type/F | 现 `yarn workspace @catering-v2s/operations-admin typecheck`，`yarn workspace @catering-v2s/platform-admin typecheck`；现Vitest4.1.10按详设11a具体文件run | 局部类型/组件，不是L2 |
| generated/F/seed helper | 现 `node scripts/generate/terminal-remote-control-protocol.mjs --check`；`node --test scripts/test/terminal-remote-control-protocol.test.mjs scripts/dev/owner-command-seed-executor.test.mjs` | 生成/对象提交控制，不启动seed |
| Java focused（原真实任务） | 现 `node scripts/test/r5-remote-testcontainers.mjs :apps:backend:terminal-data-server:test --tests com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocolTest --tests com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodecTest`；asset/catalog/CBS对应test task与附件类filter | 相应class/prod接缝，不能拼全量业务 |
| H focused | 现 `scripts/test/backend-acceptance --operation <该AcceptanceScenarios中实际operation>`，精确从source登记 | 真实CONTRACT/BUSINESS/DB信息/cleanup；不猜scenario名 |
| 有效工件前置 | 现 `R5_TERMINAL_UPDATE_SEED_ARTIFACT_EXPORT=1 node scripts/test/terminal-automation.mjs --phase update --platform web --shape mobile --case update.artifacts` | 只准备工件；受管源run business/cleanup PASS及十文件导出；不运行TER设备或DEV业务 |
| 完整seed准入dry-run | 现 `R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID=<本次工件源runId> scripts/dev/seed --profile r5-full --dry-run` | 唯一公开入口委托r5-complete-seed-executor；不执行reset或实际seed；首次L2前强制 |
| 新suite L2 | 拟支持 `node scripts/test/browser-l2-runtime.mjs readiness --suite admin-ui` →同run `R5_L2_ADMIN_UI_READINESS_MANIFEST=<path> node scripts/generate/admin-ui-l2-p1.mjs`→`node tools/admin-ui-l2/cli.mjs`＋该suite完整生成链检查→同run `finalize --suite admin-ui`→`run --suite admin-ui` | 当前不存在支持；CP06新增source/红例/准入齐后才可用，不能现在运行 |
| W update（两个sample顺序） | 现 `node scripts/test/terminal-automation.mjs --phase update --platform web --shape mobile --sample console --case update.owner-flow`，另一run仅sample改wallpaper | 真实CBS候选/报告/运营读回＋fixture UpdatePort；补附件§4a跨页，不是Android安装/隔离L2 |
| W remote（两个sample顺序） | 现 `node scripts/test/terminal-automation.mjs --phase remote --platform web --remote-topology mobile-single --sample console --case remote.main`，另一run仅sample改wallpaper | 现remote.web.test.ts；真实LiveKit＋synthetic track，补restart/焦点/释放，非原生capture |
| 最终H | 现 `scripts/test/backend-acceptance --operation all`，不加calibration/性能扩展 | 必须晚于最终生产/测试修改，全量业务与cleanup独立 |

本计划不默认完整scripts/verify、不跑无关拓扑/媒体/L2、长期容量或极端ZIP。backend full是R-READ07明确义务，不能改称“无关”。受管容器测试获准后按当前DEV manifest identity stop→测试business/cleanup均PASS→仅原先DEV运行时start，不seed；DEV恢复与业务分别记录，cleanup不PASS不交付。未知进程/共享cache不删。

L2失败只保留首败→日志/源命中→最小修复→受影响focused同档复验；不增加timeout/盲重跑。同一归一failureCategory第二次冻结后续场景，关闭该族后继续授权task，不把一次失败当交付。

## 10 · 逐代码与详设对账与实施交付

显式步骤名：**逐代码与详设对账**。执行者fresh只读subagent；范围所有新增/修改/删除生产代码、generated diff、测试、fixture/seed helper、README/public source/控制面每行，对当前设计/附件条款；核零调用者、点名未产文件、事务/授权/错误/identity/资源/UI/范围。只MATCHED/OPEN，OPEN先最小修复再复核真实影响面，不能抽样，不能复用6b替代；未MATCHED为“实施未就绪”。

其后fresh整批 `REVIEW_TARGET=IMPLEMENTATION` 依据正式需求/详设/原IA/真实代码与授权proof形成独立GO/NO-GO、M/S/N及DESIGN_GAPS。代码忠实设计仍须判断合理性；L3_UI未证不能写裸GO。新finding主agent核源/最小修复，变动只定向复验，不重复未修改对账。

最后交Dexter/Claude的包：当前source/设计SHA范围、逐CP/6b/13c适用字节、逐V场景结果与run/source/档位、第一失败及边界、日志/business/cleanup、DEPENDENCY/NOT_RUN/OPEN清单、原生/媒体/其他未改scope限制。运行状态“当前字节最新运行”与“最后一次通过”分开，不用计划/测试源码/作者intake宣称PASS。

## 11 · 当前设计审查

以下是旧字节历史记录，非本轮审查：cycle=`BACKEND_FRONTEND_STRUCTURE_IMPLEMENTATION_DESIGN_20261014`；REVIEW_TARGET=DESIGN。治理默认两轮，原R1/R2及R2的ROUND_FINAL_DECISION=SELF_DECIDED独立裁定均原样保留，作者不代写。Dexter本次直接指派全文为“请根据项目设计规范，和需求文档，生成详设和实施计划，并完成对抗式review，直至go，最后将详设和实施计划给另一个Claude做review”。依本次明确“直至go”的追加范围，R2确认项最小修订后再交新的fresh reviewer核验当前整包及差量；计为原cycle的R3，不重置轮数或重开需求cycle，不将这一会话例外写成长期治理规则。每轮先读足适用最小输入、独立证伪形成verdict后才读intake。原verdict/SHA和阅读限制不可改；当前修订只有作者处置，必须另有当前字节独立结论，不能冒称R2已GO。本设计静态通过不授实施；所有生成/编译/F/H/L2/cleanup NOT_RUN。

2026-10-14 本轮：Dexter实质选择A，改变V09/V10/V11/V14验证档位及CP06范围。新cycle=`BACKEND_FRONTEND_STRUCTURE_ROUTE_A_20261014`，REVIEW_TARGET=DESIGN，REVIEW_ROUND_LIMIT=2；只审本次修订及同根接缝，不重开原cycle。R1/R2均fresh只读，主agent只转录原verdict和随后处置；R2后按SELF_DECIDED硬停止。本轮没有实施/运行；旧R4结论不能推为本轮当前字节GO。

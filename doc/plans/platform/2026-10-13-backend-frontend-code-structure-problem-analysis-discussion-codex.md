# 前后台代码结构共性问题分析与整改建议 · T1 横向参照

日期：2026-10-13。`DOCUMENT_KIND=PROBLEM_ANALYSIS_DISCUSSION`；`STATUS=DISCUSSION`；`IMPLEMENTATION_AUTHORITY=NONE`。

本稿只讨论问题和候选整改方向，不是正式需求、详设、实施计划、规范修订或GO/NO-GO评审。未经Dexter讨论确认，任何“建议”均不产生代码或契约变更义务。Codex在途TER T1不因本稿扩大为前后台实施。

## 1 · 原始任务与真正目标

Dexter原话：

> 关于T1的需求，你再仔细读一下，然后归纳成共性的问题模式，针对这些问题模式，请扫描一下BackEnd和Frontend两个代码目录，寻找前后台代码存在的问题，并给出整改建议，仅输出问题分析稿，暂不作为正式需求，对于问题和整改方案我们可以一起讨论确认

T1正本为`doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md`。本轮重新读其R-01～R-17，核心不是“文件越小越好”，而是：**能力的事实、行为、公开边界、策略与资源生命周期有清晰住址；维护一个能力时，不需在别处补隐藏名单或猜测重复实现。**

这一目标适用于前后台，但TER的具体机制不直接搬过去：

- CBS跨owner通过其公开Java command/read API，并保留REQUIRED事务、授权、锁/CAS、幂等、审计与权威readback；不改成Runtime command/selector。
- Java沿当前`api/application/domain/persistence`职责及既有技术support分类；不为了统一目录，把所有Java类搬到declarations或新建接口。
- 管理前端沿generated API、App自身baseApi/transport、业务feature和admin-ui-foundation；不引入TER actor/state框架，不要求每个feature一份HTTP执行器。
- 静态策略沿所在能力的Java常量/config/policy或TS具名配置声明；不新增ParameterDefinition框架、动态catalog或参数管理页。
- Spring代理、React组件、WebRTC Room各有实际生命周期；不能按“一handler一个文件”机械拆成多个独立owner。

## 2 · 扫描范围、方法与证据限制

### 2.1 当前目录覆盖

结构枚举覆盖`apps/backend/`和`apps/frontend/`。后台包括CBS主应用/edge、20个Gradle模块及TDS；前端包括platform-admin和operations-admin。`libraries/frontend/admin-ui-foundation`及CBS foundation仅作为真实复用能力参照。没有读取其他旧仓或.runtime。

后台20模块：asset、audit-model、audit-read、business-channel、catalog、collaboration、execution-context、extension、foundation、inventory、organization、platform-admin-iam、sales-menu、store-contract、store-terminal、terminal-binding、terminal-control、terminal-update、workspace、workspace-iam。

本次纯读取枚举口径：Java/Kotlin/TS/TSX/MJS/JSON/YAML/SQL/properties；排除node_modules、build、dist、test-results、.gradle、.runtime、.cache。生成物按generated目录或明确生成标头分桶；测试按test/tests/__tests__及.test/.spec名称分桶。物理行数只用于找到热点，不作缺陷判据。

| 目录 | 上述口径的代码/配置文件 | 非生成生产代码 | 生成文件 | 测试 | 其他配置/迁移 |
|---|---:|---:|---:|---:|---:|
| apps/backend | 1710 | 800 | 501 | 310 | 99 |
| apps/frontend | 490 | 334 | 13 | 133 | 10 |

这些是导航截面，不是语义审查分母或新机器门。全目录做结构/引用/模式定位；下文问题族打开了相应生产者、消费者及复用能力。**未逐分支审计全部1134个非生成生产文件，不宣称前后台所有问题已经找完。**生成物不是重复业务逻辑，不能拿它们的行数或重复字符串要求手工重写。

### 2.2 判据与分工

回读T1、AGENTS、项目入口及六kernel，并按design/platform、backend、admin-ui三条六维route重开适用记忆。直接判据以当前`doc/platform/backend-coding-standard.md`、`frontend-coding-standard.md`、`foundation-charter.md`及对应owning source为准；T1仅用于提炼标尺，不成为新前后台规范。

两个只读分析者分别定位后台、前端；主agent重开关键源码、汇总、去重并独自写本文。查找结果与旧报告仅作导航。本轮没有测试、编译、构建、生成、verify、DEV、数据库、Web/Android、L2、UAT或部署，所有行为效果与性能收益均未运行验证。

下文“事实确认”指源码形状、依赖或重复已确认；不等于确认当前用户已经遇到故障。“候选取舍”指尚需明确目标或不应从现状直接推导整改指令。

## 3 · 从 T1 提炼的共性问题模式

| 模式 | T1来源 | 在后台/前端中的具体读法 | 不能误判的反例 |
|---|---|---|---|
| P-1 责任混装，维护原因没有具名边界 | R03/R04 | Service/Page同时承担多个独立规则、资源和用户surface，改一处必须理解其他生命周期 | 类长但确由同聚合锁/CAS/事务关闭，不能仅按长度拆 |
| P-2 同一事实有第二份声明或派生实现 | R08/R09/R12 | canonical闭集、页面名单、业务纯规则又手写一份 | 业务授权分类和SQL路由不是同一张协议闭集；不同App有各自合法装配 |
| P-3 公开边界泄漏内部组织 | R07/R08/R14 | API暴露application嵌套类型，feature消费者deep import另一feature内部UI/helper | 合法跨owner公开API/跨feature协作应保留，不是禁止协作 |
| P-4 基础能力已存在，却另写一套 | R05/R06/R13 | generation、生命周期、状态呈现、流式清理等机制自实现 | owner异常翻译、业务确认条件或形似不同语义不能机械合并 |
| P-5 业务事实与呈现/传输规则互相越界 | R10/R14 | owner读模型夹入纯页面tab表达；wire适配藏在无关业务feature | 后台必须算的引用/授权/跨模型可用性仍属owner |
| P-6 装配同时维持隐藏名单或重复依赖图 | R08/R10 | 图标表成为页面白名单，多构造路径手工复制dependency wiring | 显式组件注册和generated元数据职责不同，本身不是双真相 |
| P-7 策略、固定契约与环境被混为裸值 | R06/R11/R12 | 相同可调策略多份默认/单位，协议固定值不从canonical消费 | 0/1、SQL参数位、不同业务上限及不可调协议cap不必统一参数化 |
| P-8 资源和异步身份跨层分散 | R04/R12/R17 | 请求generation、草稿关闭、远控start/end/stale清理分属多个surface且无窄接口 | 独立请求需独立身份，不能合成一个全页generation或取消既有fence |
| P-9 “机制存在”替代“真实消费正确” | R13/R15/R17 | helper/测试文件存在，被当成已接入；类型断言掩盖声明→消费差异 | 本轮不因NOT_RUN报缺陷，也不根据测试源码宣布已通过 |

P-7/P-9是后续盘点标尺。本轮没有确认前后台存在等同TER“One/Two/4cap”的环境数量错误，也没有证明所有策略默认值有冲突；不能为对齐表格而编造实例。

## 4 · 后台问题与建议

### B-1 · TDS topic闭集重复手写【事实确认；优先建议】

**证据**：`contracts/protocol/terminal-connection-protocol.json:137–140`是topicKeys正本；`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/protocol/TerminalConnectionFrameCodec.java:24–36/282–289`另持有TOPIC_KEYS并实际校验。现`protocol/TerminalConnectionProtocol.java:33–112`已加载同一canonical，却未消费topicKeys。

**后果/场景**：新增合法topic后，契约更新而codec漏改，会在进入owner查询前拒绝该topic。当前没有发现两集合已经不同，这是重复住址与可推导的维护风险，不是已复现通知故障。

**建议**：优先扩现TerminalConnectionProtocol的只读topic集合校验/访问，再让codec消费；另一可选是现生成链输出具名枚举。前者复用现加载器、变更更小。不要新建通用topic registry、动态发现或配置后台。

**同根/反例**：`session/TdsTerminalSessionActors.java:826–835`有绑定分类，`state/TdsTerminalTopicRepository.java:40–62`有SQL/参数分类；这些是授权/事实读取责任，不能并入“合法topic名单”替代。close reasons/codes已从canonical加载，是可沿用正例。对应P2/P7、后台§2-D。

### B-2 · 资产流式物化复制了完整资源生命周期【事实确认；局部建议】

**证据**：`apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java:201–245`和`:1389–1434`各实现tempfile、读取循环、大小/prefix、SHA-256、输出与失败删除；`:491–497`真实stage路径分流到二者。

**后果**：调整缓存、限长或清理时需同步两份实现。摘要初始化异常时前者`:213–216`删除tempfile、后者`:1402–1404`没有对应删除，已显示细节漂移。该罕见分支只是重复已漂移的证据，不建议为JDK算法不可用另做极端故障专项。

**建议**：在asset owner内抽一个具名流式物化方法，限长和prefix需求显式输入；ZIP signature与图片magic/decode保持两条具体校验。单次Sha256Hex不是流式摘要，不能强替。不要跨owner上传框架、验证pipeline或新storage抽象。对应P4/P8、后台§2-E。

### B-3 · 商品列表与详情复制同一制作信息纯规则【事实确认；局部建议】

**证据**：`apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java:4443–4453`与`CatalogWorkbenchReadService.java:1323–1333`的skuPreparationDiffers同义；分别用于`:4424–4426`、`:1317–1319`输出制作差异事实。

**后果**：null/missing/effective规则修改要同步两处，列表/详情可能给出不同派生事实；当前未发现结果已经不一致。

**建议**：复用现同owner纯值支持`CatalogOwnerValueSupport.java:18–20`，或一个具名制作信息纯函数；不合并查询链、不把catalog JSON逻辑搬入平台foundation。列表已有受限/懒加载事实，不能删totalCount或扩大读取来“统一”。primaryImageAssetRef/sourceFact也是同族定位入口，但尚不把所有相似函数都判可合并。对应P2/P4、R-READ-04。

### B-4 · 商品owner读模型包含纯UI页签表达【归属事实确认；整改需讨论】

**证据**：`CatalogItemService.java:1632–1637`输出tabs/visible/disabled/reason；`:1724–1732`从generated manifest的tabRules.visible组装。真实入口经`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java:167–178`到coordinator/owner/item；前端`apps/frontend/operations-admin/src/features/catalog-management/model/catalog/catalogItemModel.ts:740–742`消费tabs。

**后果**：改变页面组织可能牵动后台模型、契约和生成消费者；业务事实与呈现规则的住址不清。当前不是授权失效或错误数据的结论。

**建议**：先核已批准IA、canonical shape manifest和完整消费者，再讨论把纯页签表达归前端，owner仍返回完整shape/business facts。不能直接删tabs、引入BFF或按屏切多个detail接口；引用阻断、实时授权及模型外availability仍由owner算。对应P5、后台§2-H；这项需要确认是否允许契约消费者一并调整。

### B-5 · IAM公开API解析地址绑到application类【候选取舍，非直接违规】

**证据**：`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceOperationsCommandApi.java:4–6/18–22/27/57`的公开边界使用WorkspaceInvitationService.ManagementInvitationView、WorkspaceUserService.User和WorkspaceCommandAuthorizationFacts。实际wire mapper也依赖这些类型。

**后果**：移动invitation/user实现影响公开类型住址，API难与内部职责独立整理。

**建议**：新公开类型优先落api；存量先列FQCN、直接构造、异常映射及真实消费者，讨论是否另批迁移。**R-READ-02当前明确保护既有公开嵌套record/FQCN**，因此不能本轮按“看起来不干净”直接删或改名。`modules/terminal-update/.../api/TerminalUpdateRuleOwnerApi.java:24–55`的api-local record可作方向参照。不全仓DTO化、不每service加接口。对应P3，需明确后续整改边界。

### B-6 · CatalogItemService仍承载多个维护原因【候选责任拆分】

**证据**：同CatalogItemService，`:180–227`命令/回执，`:864–918`temporary promotion，`:1615–1655`详情组装，`:1736–1808`创建/完整草稿保存，`:2062/2148`识别制作及单位校验，`:2999/3154`promotion preflight/execute。判断依据是实际规则与资源族，不是其5968行。

**建议**：先提纯draft/制作校验和详情值组装，保持同item事实、锁/CAS/readback；promotion另bean是否必要，等原self-call、事务代理和回执顺序钉住后再定。CatalogOwnerService稳定facade不删除；不每handler一个service、不拆聚合、不建万能base service。工程维护性收益可预期，未证明当前事务错误。对应P1、R-READ-01～04。

### B-7 · 同一persistence依赖图多处手工构造【低优先候选】

**证据**：同catalog application下`CatalogItemService.java:123–134`、`CatalogCopyService.java:118–129`、`CatalogWorkbenchReadService.java:112–123`分别new同组SKU/identifier/preparation/category/definition/media/reference Facts；`CatalogOwnerService.java:173–189`又维护nullable直接构造分支。

**后果**：修改Facts构造依赖要更新多个入口，注入与直接构造路径有两种装配责任。stateless Facts多实例本身不是多业务真相，也未证明代理失效。

**建议**：先查哪些Facts确实stateless、哪些有代理/生命周期，只对已重复的实际依赖采用显式注入/现构造接缝。当前直接构造边界受R-READ-02保护；若收益只是少几行new，应保留而不是创建dependency bag、包扫描registry或通用工厂。对应P6，暂不列为必须整改。

## 5 · 前端问题与建议

### F-1 · 一个Page拥有多个独立surface的状态和请求【事实确认；建议按surface拆】

**证据**：`apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx:96/103–168`同时持规则列表/详情/门店分页、版本报告/详情/历史、启停及远控启动，读取分支分布`:192/238/320/437/595/640`。同族：`apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx:184–217`；`apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx:596/652–730`。

**后果**：改一种surface需理解其他请求、刷新、草稿和关闭身份，工程回归面较大；没有动态证据证明现用户错误。

**建议**：按现用户surface及其异步资源提具名controller/hook/组件，Page保留任务编排和上下文。先以更新页为样本，不按长度统一拆所有Page；SalesMenu已有useSalesMenuReadModel，不再抽第二套读模型。不增加新页面或用户跳转。对应P1/P8。

### F-2 · 更新页自建既有generation/查询身份机制【事实确认；优先复用】

**证据**：ProjectTerminalUpdatePage`:103–111/160–171`自建counter/latest refs；`:208–234/258–283`重复成功、失败、finally仍当前的多字段判断；`:288–312`手动失效。现能力为`libraries/frontend/admin-ui-foundation/src/behavior/asyncGeneration.ts:14–35`与`src/list/usePageQuery.ts:56–69`的cursor identity。

**建议**：每个独立资源用自己的现guard和query identity，保留真实target/context、分页并发限制和特殊cleanup。不要让一个全页generation互相取消不同tab的请求。合法反例是完整effect作用域内的current布尔guard；不能全仓关键词替换。当前未确认迟到回写已发生。对应P4/P8、前端§3-F及frontend-capability-lookup。

### F-3 · 远控能力起止逻辑分散在更新feature【事实确认；边界建议】

**证据**：ProjectTerminalUpdatePage`:68–69`deep import remote-control内部UI/model；`:471–526`start和stale-start end，`:530–581`请求身份/反馈。`apps/frontend/operations-admin/src/features/remote-control/ui/RemoteControlWorkspace.tsx:51`要求宿主onRestart，而Room/end/keepalive在其内；feature现无index公开入口。

**建议**：remote-control提供窄的公开launcher/controller及workspace入口，拥有start/restart/stale清理；更新页提供已批准target、入口资格和关闭后焦点归还。不把项目/报表事实迁进remote，不禁止详情页远控入口，不加全局command bus。真实第二入口尚未建设，不据此预建完整插件体系。对应P3/P8。

### F-4 · 远控入站闭集手写第二遍【事实确认；优先单源】

**证据**：RemoteControlWorkspace`:99–129`parser重复INPUT_RESULT/SESSION_END等枚举。`scripts/generate/terminal-remote-control-protocol.mjs:162–179`是现producer，`apps/frontend/operations-admin/src/app/api/generated/terminalRemoteControlProtocol.ts:46–68`已有canonical派生union。

**后果**：合法reason增加后，生成类型更新而手写validator漏改，会拒绝合法包；当前未发现枚举已经不同。

**建议**：现producer输出运行期闭集，parser消费；完整schema validator是否值得生成再比较，先不引新库。不能删运行期校验、靠TS cast相信入站，也不能手改generated。字节上限、UUID、字段间关系仍需校验，中文结束反馈留feature。对应P2/P7、前端§3-E。

### F-5 · 图标表成为第二页面准入名单【事实确认；优先建议】

**证据**：`apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx:67–198`已登记page/route；`app/OperationsApp.tsx:69–96`另有Partial menuIconByKey，`:143`据图标是否存在过滤accessible pages。

**反例/后果**：已批准/授权/注册新页只漏图标，菜单会静默缺入口。未证明当前已有页面漏掉；风险是装饰因素成了隐藏admission。

**建议**：菜单成员只从catalog/实际注册/授权事实确定，图标留呈现职责；可以把图标与同一page registration关联，或用完整类型约束。不要用默认图标掩盖缺注册，也不把router移foundation。generated catalog和组件登记职责不同，本身不需合并。对应P2/P6。

### F-6 · 跨领域扩展表单藏在组织feature【事实确认；归属建议】

**证据**：`apps/frontend/operations-admin/src/features/organization-structure/model/organizationExtensionValues.ts:7–49`做定义筛选、日期hydrate、SET/CLEAR差量；`:58–59`双重断言适配generated shape。合同、经营主体、门店六个Create/Edit Drawer从该内部文件导入，例如`features/contract-management/ui/ContractCreateDrawer.tsx:19–23`和`features/store-management/ui/StoreEditDrawer.tsx:41`。

**建议**：确实共享的扩展表单纯规则归现extension-fields能力并提供公开出口；各业务owner关系和wire adapter留App。是否移foundation需真实跨App纯复用证据，不因“多人用”就上移。

**未证边界**：双重cast及“契约漂移”的注释已确认存在，但尚未闭合canonical→generated→edge→owner全部形状，不能据注释宣布当前请求错误。后续先确认真实输入shape，再讨论取消掩盖，不新增第二schema。useStoreOperatingRuleGate读取门店规则事实，仍应属store owner，不能连同本纯表单helper一律搬通用层。对应P3/P5/P9。

### F-7 · 同一主数据状态重复呈现【事实确认；小整改】

**证据**：ProjectTerminalUpdatePage`:753–756`手写ENABLED/DISABLED标签颜色，`:1086/1311–1312/1593/1700`又重复文案。现`libraries/frontend/admin-ui-foundation/src/presentation/lifecycleLabels.ts`、`LifecycleStatusTag.tsx:4–5`已提供同语义。

**建议**：规则二态用共享labels/colors/Tag，保留业务启停动作和未知值的业务fallback；当前文案一致，属于重复住址而非已出现视觉矛盾。reportState/reportReason和remote结束原因是业务状态机，不能套主数据三态或搬入全局常量垃圾桶。对应P2/P4、前端§2-B/3-K-7。

## 6 · 本轮排除的误判与尚未确认项

1. **中央generated API不自动是错误**：两个管理App本就各有generated edge和baseApi；本轮没有要求复制每个feature生成器或HTTP执行器。整改目标是能力公开边界与业务逻辑归属，不是模仿TER目录。
2. **OwnerProblem/普通异常/协议拒绝不统一成一种error**：现foundation/owner有真实边界；未因每包没有errors文件而报问题。ContractProblemAdvice跨owner映射是独立后续盘点入口，不能把统一HTTP映射本身当god module或擅删兼容异常。
3. **Sha256/receipt/cursor已有复用**：Sha256Hex、CommandReceiptSupport、CollectionRequestSupport有生产消费者；薄的owner错误翻译与不同回执scope不能一律合并。流式摘要与一次性字节摘要也不同。
4. **Foundation有业务词汇不等于越界**：collaborationCodeLabels是已接受双App纯闭集呈现；不持网络、事务或业务事实。auditChangePresentation是否扩大边界需具体看事实，不按文件名/词汇判罪。
5. **wireUuid两个App不是两份实现**：当前只是foundation re-export，不重复重写校验。
6. **同SQL、同数字、同字段名不证明同语义**：scope锁/CAS、用户任务、单位和协议必须先区分。当前没有足够事实要求全仓参数目录、所有裸值归零或服务发现。
7. **大文件、new对象、接口单实现不是自动缺陷**：商品聚合内共锁操作、stateless Facts多实例及跨owner公开API均有合法范围；不能为缩文件牺牲事务/授权/readback。
8. **测试与生成物仅静态参照**：本轮不审动态覆盖完整性，不因无运行证据报业务失败；更不把这些源码存在写成PASS。

## 7 · 建议的讨论顺序与待确认问题

这是讨论优先级，不是批准批次或CP划分。

**先讨论高确定性的小闭包**：B1/F4 canonical闭集真实消费、F5隐藏名单、F2已有guard、F6共享纯规则归属、F7生命周期呈现。每项先补最小直接行为例，再沿现机制修，不批量移动目录。

**再讨论实际职责拆分**：B2流式资源共用、B3纯制作规则、F1 Page surface、F3远控公开能力、B6商品服务。先画输入/输出与唯一资源边界；保持批准页面任务、请求身份和事务。

**单独确认跨边界变化**：B4 tabs/契约、B5公开FQCN、F6双重cast对应的真实schema；B7构造图只有明确收益才继续。不要借结构优化直接改contract/DB/权限或创建长期compatibility层。

建议和Dexter确认：

1. **目标范围**：后续是否先保证业务/Journey/DB/公开契约不变，做责任住址与真实复用；需要跨契约变化的B4/B5另列？推荐这样分清，减少隐藏产品取舍。
2. **前端feature公开面**：是否要求“有真实跨feature消费者的能力必须具备窄公开出口，禁止引用其内部文件”，而非每个feature强制空index？推荐前者。
3. **共享层准入**：同App跨领域纯规则先归现业务能力；只有已经发生的跨App共享机制进入foundation；不新增巨型公共model/参数catalog，是否认可？
4. **Catalog页签**：是否允许后续核原IA/contract后将纯呈现声明归前端？不允许时本轮只拆内部纯规则，保留现API字段，不默默改业务表述。
5. **公开Java类型**：是否把API解析住址整理解为另批可允许的FQCN变更？若只做内部可读性，则R-READ-02继续约束，B5保留讨论项。

## 8 · 状态与下一步

已完成T1共性模式归纳、两侧目录结构枚举和上述问题族的静态生产接缝核验，只新增本文。未修改需求、标准、记忆、生产源码、测试、脚本、契约或依赖；无运行或数据动作。

下一步由Dexter讨论确认问题、目标归属和跨边界范围，再决定是否生成正式需求。本稿不要求立即整改、不发实施授权，不给整批M/S/N或GO/NO-GO。所有动态行为与性能收益仍NOT_RUN/UNVERIFIED。

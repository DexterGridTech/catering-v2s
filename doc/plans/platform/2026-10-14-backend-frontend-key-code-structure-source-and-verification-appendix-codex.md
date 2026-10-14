# 前后台重点代码结构优化 · 源码与验证附件

日期：2026-10-14。本文件补齐详设中的精确住址与执行输入。全部动作计划态/NOT_RUN；没有冻结全仓计数、建立规范或授权实施。来源为当前源码、正式需求、适用规范及主agent汇总的两名只读explorer研究；explorer未写文件。行号仅用于观察导航，编辑用具名符号。

当前源码自审补充见详设§0.2及对应自审记录。本附件新增的三个扩展列表消费者仍是现能力，仅迁公开引用；现extensionList.tsx/extensionList.test.ts接缝和内部orderedExtensionFields保留。原十一状态/gate/channel引用不被当作全部公开消费者，所有变化仍沿原owner与路线A完成，无新增动态执行面。

## 1 · 路径、责任与文件处置

本附件及详设缩写：CBS=`apps/backend/catering-business-server`；CAT=`CBS/modules/catalog/src/main/java/com/catering/v2s/catalog/application`；CAT test=`CBS/modules/catalog/src/test/java/com/catering/v2s/catalog/application`；ASSET=`CBS/modules/asset/src/main/java/com/catering/v2s/platform/asset/application`，ASSET test对应src/test；TDS=`apps/backend/terminal-data-server`；OPS=`apps/frontend/operations-admin/src/features`；PLATFORM=`apps/frontend/platform-admin/src/features`。这些是精确仓根相对路径展开，不是依赖或runtime变量。

| 处置/CP | 文件/唯一符号入口 | 职责与保持 |
|---|---|---|
| UPDATE/01 | TDS/src/main/java/com/catering/v2s/terminaldataserver/protocol/TerminalConnectionProtocol.java#readUniqueTextArray；TerminalConnectionFrameCodec.java#requireTopicKey | canonical Set加载与消费；typed错误/全部帧检验保留 |
| UPDATE/01 | scripts/generate/terminal-remote-control-protocol.mjs#renderContract；scripts/test/terminal-remote-control-protocol.test.mjs | 六字段enum arrays additive（SCREEN_READY.screen、POINTER.screen/phase、INPUT_RESULT.status/reason、SESSION_END.reason）；同renderer双目标，原check/self-test接缝 |
| GENERATED/01 | apps/terminal/kernel/base/remote-control/src/generated/terminalRemoteControlProtocol.ts；apps/frontend/operations-admin/src/app/api/generated/terminalRemoteControlProtocol.ts | 只由前行generator派生；T1手写路径不改 |
| CREATE/01 | OPS/remote-control/model/parseRemoteControlMessage.ts 与 .test.ts | 从workspace迁parseMessage；消费六组enum数组，先核string；nullable/cancel/UUID/seq/bytes/关联保留 |
| UPDATE/01 | TDS/src/test/java/com/catering/v2s/terminaldataserver/protocol/TerminalConnectionProtocolTest.java、TerminalConnectionFrameCodecTest.java | 真实canonical Protocol/Codec，不另造测试白名单 |
| UPDATE/02 | ASSET/PlatformAssetService.java#materializeTerminalUpdatePackage/#materializeAndValidate；ASSET test/PlatformAssetServiceTest.java | 一个private materializeStream和结果record；原两wrapper、public签名/IO事务保护 |
| UPDATE/02 | CAT/CatalogOwnerValueSupport.java；CatalogItemService.java#skuPreparationDiffers/#itemDetail；CatalogWorkbenchReadService.java#skuPreparationDiffers | 单源纯差异；list/detail读取与totalCount保持 |
| CREATE/02 | CAT/CatalogItemDraftValidator.java；CatalogItemDetailAssembler.java | package-private，纯值输入；无Spring/JDBC/锁/ownercommand；不新增公开参数bag |
| CREATE/02 | CAT test/CatalogOwnerValueSupportTest.java、CatalogItemDraftValidatorTest.java、CatalogItemDetailAssemblerTest.java | 包含MissingNode/错误code/值组装真实字段的行为断言 |
| UPDATE/02 | CAT test/CatalogCategoryOwnerIntegrationTest.java | 真PostgreSQL/Flyway owner fixture；保留promotion/receipt/CAS；补纯提取调用接缝 |
| UPDATE/03 | apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx#Registration/#operationsPageRegistry；app/OperationsApp.tsx#accessibleMenuPages | icon入注册；catalog/注册/授权选成员，不以图标过滤 |
| CREATE/03 | apps/frontend/operations-admin/src/app/routing/pageRegistry.test.tsx | 现合法key与无权限/缺注册反例；禁止只assert source token |
| CREATE/03 | OPS/remote-control/index.ts；organization-structure/index.ts；store-operating-rules/index.ts；business-channel/index.ts | 只export既有能力；launcher到CP05补，extension-fields/index到CP04建，不提前占位；audit-history/index保留 |
| UPDATE/03 | 下述十一外部引用＋更新Page/十Drawer的实际消费 | type-only与re-export同闭合；内部同feature不误改 |
| CREATE/03 | OPS/terminal-update/model/terminalUpdateLifecyclePresentation.ts 与 .test.ts | 三具名label/一个color，现fallback与VOIDED文案别名，foundation不改 |
| UPDATE/03 | apps/frontend/operations-admin/src/tests/architecture/public-entry-boundary.test.mjs | 沿现门检查本批跨feature进口，有真实违规red与合法内部反例；不禁止所有model路径 |
| CREATE/04 | OPS/extension-fields/index.ts、model/extensionFormValues.ts、extensionFormValues.test.ts、extensionRequestAdapters.test.tsx | 真实对象＋全部十四提交接缝；pure定义与窄出口同CP；同一index导出现extensionListAndSearchColumns/extensionQueryValues，不公开无外部消费者的orderedExtensionFields；不新HTTP执行器 |
| UPDATE/04 | OPS/business-entity-management/ui/BusinessEntityManagementPage.tsx、store-management/ui/StoreManagementPage.tsx、contract-management/ui/ContractManagementPage.tsx；extension-fields/model/extensionList.test.ts；OPS tests/architecture/public-entry-boundary.test.mjs | 三个列表的两个现能力改从extension-fields窄入口引用；列、筛选参数、排序及query生命周期保留，原extensionList.tsx实现不搬；F检查行为不变和外部deep import红例 |
| DELETE/04 | OPS/organization-structure/model/organizationExtensionValues.ts | 所有生产/测试/渲染调用迁完后删除旧纯规则与双cast |
| UPDATE/04 | OPS/organization-structure/ui/OrganizationExtensionFields.tsx、OrganizationExtensionFields.test.ts；十Drawer（§2） | 保留宿主query/UI，不再跨feature转导出纯规则；原数组expect改对象expect |
| UPDATE/04 | CBS/src/main/java/com/catering/v2s/app/edge/extension/ExtensionSubmissionWireMapper.java；src/test/java/com/catering/v2s/app/edge/extension/ExtensionSubmissionWireMapperTest.java | 全调用者迁完才退array/legacyFields，保留typedowner/public toSubmission |
| UPDATE/04 | scripts/dev/owner-command-seed-executor.mjs#extensionSubmission；其test.mjs | 七个create传object；已有SERVICE_POINT对象保留；不执行seed |
| UPDATE/04 | §3列全部legacy acceptance/edge fixtures | 同原子组迁移，不能下个CP再修旧array |
| CREATE/05 | OPS/terminal-update/model/useTerminalUpdateRules.ts、useTerminalUpdateRuleDetail.ts、useTerminalUpdateReports.ts、useTerminalUpdateReportDetail.ts；terminalUpdateReadModels.test.tsx | 每hook业务resource，detail/page各guard；只一份命令式读回 |
| CREATE/05 | OPS/terminal-update/ui/RuleCreateDrawer.tsx、RuleCreateDrawer.test.tsx | 原表单搬移，lifecycle/FULL/HOT候选保持，不新业务 |
| CREATE/05 | OPS/remote-control/model/useRemoteControlLauncher.ts、useRemoteControlLauncher.test.tsx；ui/RemoteControlWorkspace.test.tsx | start/late/start-restart归launcher；workspace own Room释放 |
| UPDATE/05 | OPS/terminal-update/ui/ProjectTerminalUpdatePage.tsx、ProjectTerminalUpdatePage.static.test.ts；OPS/remote-control/ui/RemoteControlWorkspace.tsx | 删除原counter/result/start/end与parse实现，实际调用新能力；静态测试不是行为证明 |
| UPDATE/06 | §5控制面、tools/terminal-automation/journeys/{update.test.ts,terminalUpdateSupplyUi.ts,remote.web.test.ts}及其现helper直接测试/README | 三case隔离L2＋四个现Web run，补跨页/重发/焦点，不新runner/TDS/wire/credential fixture |

十一外部引用（相对OPS）：organizationStatus在business-channel/model/businessChannelCodeLabels.ts、store-profile/ui/StoreProfilePage.tsx、store-management/ui/{StoreManagementPage,StoreDetailDrawer,StoreStatusModal}.tsx；gate在catalog-management/ui/controllers/CatalogWorkbenchController.tsx、ui/CatalogWorkbenchContent.tsx（type）、inventory-management/ui/InventoryManagementPage.tsx、sales-menu/ui/SalesMenuPage.tsx、store-service-point/ui/StoreServicePointPage.tsx；accessKindLabels/orderKindLabels在sales-menu/ui/SalesMenuPage.tsx。导出组织label/toggle、gate hook/type、channel两个label；不将gate业务变成foundation。

extension-fields同根外部列表消费者为BusinessEntityManagementPage、StoreManagementPage、ContractManagementPage，均消费extensionListAndSearchColumns与extensionQueryValues；这三处由CP04随现纯提交能力的index一起迁移。与前述三组十一引用、remote调用者、十Drawer及其转导出分别核验，不把十一引用当全批公开边界分母；同feature的extensionList.test.ts/orderedExtensionFields内部引用是保留反例。

**明确 RETAIN**：CBS其余owner公开API/DB/迁移、CAT CatalogOwnerService/CatalogCopyService constructor graph、promotion/self-call、ItemRow等原private持久入口、catalog tabs、IAM公开嵌套record；TDS session/store binding/SQL switch；两App HTTP/RTK执行器与generated；PLATFORM/organization-contract-overview/ui/PlatformReadPage.tsx两个正确guard；OPS/sales-menu/model/useSalesMenuReadModel.ts及Page表单effect；平台集团初始化/服务点object整体提交；foundation生命周期词表/async/cursor/Drawer原实现；TER手写consumer。无统计“全包逐行已审计”声称。

20个现module导航已按build.gradle.kts确定：audit-read、audit-model、execution-context、foundation为既有platform library；asset/catalog/organization/extension本批有明确改点；terminal-control/terminal-update的后台事实和原公开API保留，仅用现fixture/read；platform-admin-iam/workspace/workspace-iam/store-contract/store-terminal/terminal-binding/inventory/collaboration/business-channel/sales-menu按原owner保留，本批没有找到要改的同一声明/规则调用就不机械重写。根CBS edge负责现输入适配，TDS是transport；维护范围不等于每个module必须有diff。

## 2 · 现HTTP identity与十四扩展提交

来源正本 `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` 的operation条目（method/path/face/errorSetRef＋operationErrorAugmentations），schema来源 `contracts/openapi-source/r5-baseline/contracts/openapi/components/` 及当前具名schemas JSON，生成输出 `contracts/openapi/`/两App API。保持现schema/公开error，不重生成HTTP类型来遮cast。以下所有路径以 `/api/operations/group-workspaces/{groupWorkspaceKey}` 为公共前缀；face全为operations-admin。

| Drawer（相对OPS/ui） | operationId | method/后缀 |
|---|---|---|
| organization-structure/RegionCreateDrawer | createOperationsOrganizationRegion | POST /hierarchy/regions |
| organization-structure/ProjectCreateDrawer | createOperationsOrganizationProject | POST /hierarchy/regions/{regionId}/projects |
| organization-structure/OrganizationEditDrawer | updateOperationsOrganizationNode | PATCH /hierarchy/{nodeId} |
| organization-structure/CommercialGroupEditDrawer | updateOperationsCommercialGroup | PATCH /hierarchy/commercial-group |
| business-entity-management/BusinessEntityCreateDrawer | createOperationsOrganizationBrand / createOperationsOrganizationTenant / createOperationsOrganizationHeadCompany | POST /organization/brands；/tenants；/head-companies |
| business-entity-management/BusinessEntityEditDrawer | updateOperationsOrganizationBrand / updateOperationsOrganizationTenant / updateOperationsOrganizationHeadCompany | PATCH /organization/brands/{brandId}；/tenants/{tenantId}；/head-companies/{headCompanyId} |
| store-management/StoreCreateDrawer / StoreEditDrawer | createOperationsOrganizationStore / updateOperationsOrganizationStore | POST /organization/stores；PATCH /organization/stores/{storeId} |
| contract-management/ContractCreateDrawer / ContractEditDrawer | createOperationsContract / updateOperationsContract | POST /contracts；PATCH /contracts/{contractId} |

Drawer完整路径是 `OPS/<feature>/ui/<file>.tsx`。Brand/Tenant/HeadCompany更新schema继承create；Project继承NodeCreate，不按extensionValues键文字次数推分母。现object提交的CommercialGroupInitializationDrawer、store-service-point是不同宿主语义反例，保持。

更新/远控method及后缀如下，不允许实施者从近似名称猜API：

| operationId | method/后缀 | 集合/原输入 |
|---|---|---|
| getOperationsProjectTerminalUpdateRulePage | GET /projects/{projectRef}/terminal-update-rules | cursor/limit=50、applicationId/status/createdFrom/ToEpochMillis、expectedContextVersion；nextCursor |
| getOperationsProjectTerminalVersionPage | GET /projects/{projectRef}/terminal-versions | cursor/limit=50、queryText/storeRef/currentApkVersion/currentJsVersion/runtimeVersion、expectedContextVersion |
| getOperationsProjectTerminalUpdateRuleDetail | GET /projects/{projectRef}/terminal-update-rules/{ruleRef} | 单readback，expectedContextVersion |
| getOperationsProjectTerminalUpdateRuleStorePage | GET /projects/{projectRef}/terminal-update-rules/{ruleRef}/stores | cursor/limit，expectedContextVersion；独立详情分页 |
| getOperationsProjectTerminalVersionDetail | GET /projects/{projectRef}/terminal-versions/{terminalRef} | 单readback，expectedContextVersion |
| getOperationsProjectTerminalUpdateReportHistoryPage | GET /projects/{projectRef}/terminal-versions/{terminalRef}/update-reports | cursor/limit=20，expectedContextVersion |
| getOperationsTerminalUpdateArtifactCandidatePage | GET /terminal-update-artifact-candidates | 现FULL/HOT类型/selected FULL条件和candidate cursor/limit |
| createOperationsProjectTerminalUpdateRule | POST /projects/{projectRef}/terminal-update-rules | 原不可编辑规则、scope、FULL/HOT、N/M分钟、状态/description与幂等 |
| changeOperationsProjectTerminalUpdateRuleStatus | POST /projects/{projectRef}/terminal-update-rules/{ruleRef}/status | 原用户intent/status/revision、CAS/幂等 |
| startOperationsTerminalRemoteControl | POST /projects/{projectRef}/terminals/{terminalRef}/remote-control-sessions | 原requestId/expectedContextVersion，permission/ONLINE仍权威 |
| endOperationsTerminalRemoteControl | POST 上行/{sessionId}/end | 原session identity与幂等结束 |
| getOperationsTerminalRemoteControl | GET 上行/{sessionId} | 现session读，不增read capability |
| issueOperationsRemoteControlGrant | POST 上行/{sessionId}/controller-grant | 原controller grant，不改token/SDK调用 |

HTTP error源保持：上述GET为AUTHZ_READ，写为OWNER_COMMAND，加其现operationErrorAugmentations。不是把这两个名字视为全部code；CP01及写前从正本逐operation核对 union 与当前edge advice、generated ProblemOf。没有新增code/status或扩scope，不能在pure类换new exception。

## 3 · F/H具体oracle与fixture

| scenario/文件 | identity/fixture | 请求/动作与真实oracle |
|---|---|---|
| topic.canonical-codec：TDS两Protocol test；CBS acceptance/TerminalConnectionContractScenarios.java#topicSubscriptionScenarios | 原JsonMapper/Protocol/group UUID；H原active-store session fixture | 每个canonical合法topic subscribe/unsubscribe/accept/changed解析；unknown typed拒绝；绑定store与SQL读取仍原分类 |
| asset.materialization：PlatformAssetServiceTest；CBS acceptance/AssetAcceptanceScenarios.java、TerminalUpdateAcceptanceScenarios.java | 原真实service/存储fixture、ImageIO PNG和PK ZIP；两个temp前缀 | 公共入口stage/claim/读回；摘要/大小；图片与ZIP各验证读取/存储/metadata失败、原typed异常/cause、流close与自有temp删除。扩原temporaryAssetUploads的有限前缀观察，不能只查图片就判ZIP无残留；不删未知文件，不运行512MiB视频/恶意ZIP，公共video仍拒绝 |
| catalog.pure-extraction：三个new pure tests＋CatalogCategoryOwnerIntegrationTest/CatalogAcceptanceScenarios | 原真实shape rules/JSON值与现PG/Flyway/direct构造fixture | null/MissingNode/effective与sku子集、totalCount；实际输出item/SKU单位/inbound/preparation；原stale receipt/CAS/promotion和引用失败无写 |
| extension.object-submission：fields/request adapters＋mapper＋ExtensionAcceptanceScenarios | 原GROUP capability fixture/定义版本，TEXT/NUMBER/BOOLEAN/DATE；原brand/store/contract | fourteen实际request对象，不以source含字符证明；H用LinkedHashMap/ObjectNode容纳null，SET false/0/DATE readback，CLEAR=null后真实字段清除；同键重放不第二写，omission保持，required/disabled拒绝不写 |
| update.resource-fences：terminalUpdateReadModels.test.tsx / RuleCreateDrawer.test.tsx | deferred request真实hook、两context/两entity、两页 | 独立guard success/error/finally失效；检查通过后还有await时，再切context/entity/cursor或close/unmount，迟到成功/拒绝/finally均不写新结果/problem/loading/ref或调用新关闭链；刷新dirty不丢；仅VERSION_CONFLICT走CAS；FULL/HOT候选/幂等保留 |
| remote.launcher-identity：useRemoteControlLauncher.test.tsx / RemoteControlWorkspace.test.tsx | 原SessionReadback/Target，deferred start/disconnect/end和mock Room/track/keepalive | start→立即close/context切换→旧reply只end其session；同一Workspace不重挂载，currentStart由A变B，A disconnect/end成功或拒绝均不改B的phase/problem/loading/tracks/关闭链。end/disconnect启动即接拒绝观察，补end先拒绝、disconnect随后完成/拒绝；A已ended/身份失效/end拒绝仍释放A自有listener/keepalive/Room，原finally保留；listener/track/gesture清理精确归属；不把void Promise当完成，不声称媒体/TER证明 |
| menu/labels/public-entry：registry/state/architecture | 当前typed registration、授权key、unknown值、真实违规consumer | menu成员不取icon truthy；两domain所有现fallback；外部deepimport红，内部同feature合法；不冻结whole-repo计数 |

legacy同步测试全集（当前已命中，实施前按同一有限source面复查新增）：CBS/src/test/java/com/catering/v2s/app/acceptance/{ExtensionAcceptanceScenarios,OrganizationAcceptanceScenarios,StoreTerminalAcceptanceScenarios,AuditAcceptanceScenarios,P2ReadConnectionScopeScenarios,CommercialContractAcceptanceScenarios}.java；CBS/src/test/java/com/catering/v2s/app/edge/operations/contract/OperationsContractControllerScopeAndCandidateTest.java；edge/extension/ExtensionSubmissionWireMapperTest；OPS/organization-structure/ui/OrganizationExtensionFields.test.ts；scripts/dev/owner-command-seed-executor.test.mjs。typedExtensionValues/extensionSet及空List请求转object，但owner typed list测试保留。源码扫描面是 apps/frontend/apps backend host tests/scripts/tools，fixture不构成保留legacy理由。

代表H operation直接复用现场景 identity（不新建provider）：`saveOperationsCatalogItem`、现ExtensionAcceptanceScenarios的typed-extension业务场景、现AssetAcceptanceScenarios和TerminalUpdateAcceptanceScenarios的stage/readback；精确operation字段在CP01从这些文件读取，执行时不把HTTP operation名自动等同scenario名称。受影响extension对象SET/CLEAR/omission/重放与asset/catalog HTTP接缝的focused H业务及cleanup PASS必须先于对应L2；最终全量backend-acceptance晚于所有生产/测试改动，两个义务分别记录，不借前一个run的数据库/会话。

## 4 · UI 回归分档（原screen，不增页面）

Dexter 2026-10-14 选择A。隔离 L2 与受管 DEV Web Journey（W）分开，不互借账号、DB、namespace或证据档位。原Journey/IA/权限/文案不变；全部新proof为NOT_RUN。

### 4.1 三个隔离 L2 case

隔离fixture由现bootstrapOwnerFacts及本run真实owner HTTP产生。两个case身份明确为PROJECT角色且assignment绑定同fixture projectRef：adminProjectWriter的pageAccessKeys为PG-PROJECT-TERMINAL-VERSION-RULES、PG-ORG-STORE-MANAGE、PG-CONTRACT-STORE-MANAGE，capabilityKeys为MANAGE_PROJECT_TERMINAL_VERSION、BC-ORG-STORE-EDIT、BC-CONTRACT-EDIT；adminProjectReader只有PG-ORG-STORE-MANAGE且capabilityKeys为空，用于目标终端菜单未授权反例。平台启用super-admin只负责原owner role/账号/权限准备；host事实由原bootstrap GROUP执行者的现HTTP创建。复用现createWorkspaceRole/邀请接受/登录链，不能直接套当前只有business-channel权限的projectRole或修改别suite。目标项目由role assignment与owner session scopeContext固定，必须读回roleNodeType=PROJECT、projectRef、父regionRef一致，缺项在fixture阶段拒绝，不让浏览器点击disabled控件来补scope。没有终端activation/ONLINE/report fixture；凭据只runtime注入。

| case → fixtureRef | actions | oracle | spec |
|---|---|---|---|
| admin.menu.registry → projectWriter/projectReader | 核固定PROJECT范围→已授权终端更新菜单/未授权缺项 | registration/授权决定成员，未授权不可达；菜单焦点/路由不变 | OPS上一级tests/l2/admin-ui.spec.ts（新增） |
| extensionForms.store.delta → extensionStore | 编辑→false/0/DATE/清空→保存→重开；dirty取消/放弃 | canonical对象请求，owner实际读回SET/CLEAR/omission、失败留稿 | 同上 |
| extensionForms.contract.delta → extensionContract | 编辑→改扩展值→保存重开/dirty取消 | 原合同scope/定义/CAS/readback，不套通用宿主 | 同上 |

动作常量住址为现features/role-home-bootstrap/roleHomeTestIds及DataScopeSelector、拟新增app/automation/operationsNavigationTestIds.page(key)、extensionFormTestIds。菜单标真实MenuItem action anchor，scope沿现DataScopeSelector实际动作节点；extensionFormTestIds.edit(host,ref)/field(host,key)/option(host,fieldKey,ref)/submit(host)/cancel(host)/dirtyConfirm(host)/dirtyCancel(host)分别标原编辑项、Input/Switch/DatePicker、候选项、表单Button及foundation dirtyGuardTestIds.confirm/cancel。Date填/清空在native input用既有format、Enter/blur，不选装饰clearIcon；普通控件不适用菜单/option的COMPOSITE_ACTION_ANCHOR窄例外。原StoreManagement/operationsDetailDrawer常量复用；缺节点时CP06先补真实绑定、F及fresh review，再写spec。当前全组OPEN。

### 4.2 逐动作控件准入表（当前全OPEN）

以下每行是一项独立binding；原保存后重开的操作复用同host编辑行，不另造locator。fixture由admin-ui-l2-fixture通过原HTTP定义返回booleanFieldKey/numberFieldKey/dateFieldKey/clearFieldKey四个独立key与宿主ref；前3定义分别BOOLEAN/NUMBER/DATE，clear为已有TEXT值，输入/初值与owner readback明确。required/disabled反例沿F/H另证，不把测试数当业务上限。

| case | fixture/控件 | UI owning source | 唯一TestIds | 真实动作节点/动作 | binding/touch | focused文件 | 独立复核 | 动态 |
|---|---|---|---|---|---|---|---|---|
| admin.menu.registry | projectWriter/projectReader scope | apps/frontend/operations-admin/src/features/role-home-bootstrap/ui/DataScopeSelector.tsx | features/role-home-bootstrap/roleHomeTestIds.ts#roleHomeTestIds.dataScope.trigger | 打开现DataScopeSelector | 原控件binding/touch读回；OPEN | 现role-home-bootstrap focused＋pageRegistry.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| admin.menu.registry | projectWriter/projectReader scope | apps/frontend/operations-admin/src/features/role-home-bootstrap/ui/DataScopeSelector.tsx | features/role-home-bootstrap/roleHomeTestIds.ts#roleHomeTestIds.dataScope.region | 只读观察：PROJECT角色的region/project/confirm均disabled；选项不展开/不点击；固定scope以owner读回为准 | READ_ONLY_SCOPE（非动作locator）；节点/disabled focused核对；OPEN | 现role-home-bootstrap focused＋pageRegistry.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| admin.menu.registry | projectWriter/projectReader scope | apps/frontend/operations-admin/src/features/role-home-bootstrap/ui/DataScopeSelector.tsx | features/role-home-bootstrap/roleHomeTestIds.ts#roleHomeTestIds.dataScope.option('REGION',regionRef) | 只读观察：PROJECT角色的region/project/confirm均disabled；选项不展开/不点击；固定scope以owner读回为准 | READ_ONLY_SCOPE（非动作locator）；节点/disabled focused核对；OPEN | 现role-home-bootstrap focused＋pageRegistry.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| admin.menu.registry | projectWriter/projectReader scope | apps/frontend/operations-admin/src/features/role-home-bootstrap/ui/DataScopeSelector.tsx | features/role-home-bootstrap/roleHomeTestIds.ts#roleHomeTestIds.dataScope.project | 只读观察：PROJECT角色的region/project/confirm均disabled；选项不展开/不点击；固定scope以owner读回为准 | READ_ONLY_SCOPE（非动作locator）；节点/disabled focused核对；OPEN | 现role-home-bootstrap focused＋pageRegistry.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| admin.menu.registry | projectWriter/projectReader scope | apps/frontend/operations-admin/src/features/role-home-bootstrap/ui/DataScopeSelector.tsx | features/role-home-bootstrap/roleHomeTestIds.ts#roleHomeTestIds.dataScope.option('PROJECT',projectRef) | 只读观察：PROJECT角色的region/project/confirm均disabled；选项不展开/不点击；固定scope以owner读回为准 | READ_ONLY_SCOPE（非动作locator）；节点/disabled focused核对；OPEN | 现role-home-bootstrap focused＋pageRegistry.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| admin.menu.registry | projectWriter/projectReader scope | apps/frontend/operations-admin/src/features/role-home-bootstrap/ui/DataScopeSelector.tsx | features/role-home-bootstrap/roleHomeTestIds.ts#roleHomeTestIds.dataScope.confirm | 只读观察：PROJECT角色的region/project/confirm均disabled；选项不展开/不点击；固定scope以owner读回为准 | READ_ONLY_SCOPE（非动作locator）；节点/disabled focused核对；OPEN | 现role-home-bootstrap focused＋pageRegistry.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| admin.menu.registry | projectWriter/projectReader scope | apps/frontend/operations-admin/src/features/role-home-bootstrap/ui/DataScopeSelector.tsx | features/role-home-bootstrap/roleHomeTestIds.ts#roleHomeTestIds.dataScope.cancel | 现Popover内容区取消Button→scope不变 | 原控件binding/touch读回；OPEN | 现role-home-bootstrap focused＋pageRegistry.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| admin.menu.registry | projectWriter/projectReader menu | apps/frontend/operations-admin/src/app/OperationsApp.tsx、app/routing/pageRegistry.tsx | 拟新app/automation/operationsNavigationTestIds.page(key) | 原MenuItem action anchor；进入已注册授权页/缺权限不显示 | 现admin-ui locator binding＋真实节点touch；CP06待建 | 同前行registry test＋现App focused | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.store.delta | storeRef | apps/frontend/operations-admin/src/features/store-management/ui/StoreDetailDrawer.tsx | 拟新extensionFormTestIds.edit(store,ref) | 原详情action-menu编辑项label anchor；开该ref Drawer | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.store.delta | store.booleanFieldKey | apps/frontend/operations-admin/src/features/store-management/ui/StoreEditDrawer.tsx | 拟新extensionFormTestIds.field(store,key) | Switch真实button；输入false | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.store.delta | store.numberFieldKey | apps/frontend/operations-admin/src/features/store-management/ui/StoreEditDrawer.tsx | 拟新extensionFormTestIds.field(store,key) | InputNumber的native input；输入0 | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.store.delta | store.dateFieldKey | apps/frontend/operations-admin/src/features/store-management/ui/StoreEditDrawer.tsx | 拟新extensionFormTestIds.field(store,key) | DatePicker的native input；输入YYYY-MM-DD | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.store.delta | store.clearFieldKey | apps/frontend/operations-admin/src/features/store-management/ui/StoreEditDrawer.tsx | 拟新extensionFormTestIds.field(store,key) | 现Input选中全值→Backspace→blur；已有值CLEAR，未有值omission | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.store.delta | storeRef | apps/frontend/operations-admin/src/features/store-management/ui/StoreEditDrawer.tsx | 拟新extensionFormTestIds.submit(store) | 原表单保存Button→owner权威读回→重开 | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增）＋原useDrawerFormLifecycle focused | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.store.delta | storeRef | apps/frontend/operations-admin/src/features/store-management/ui/StoreEditDrawer.tsx | 拟新extensionFormTestIds.cancel(store) | 原表单取消Button→现dirty guard | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增）＋原useDrawerFormLifecycle focused | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.store.delta | storeRef | apps/frontend/operations-admin/src/features/store-management/ui/StoreEditDrawer.tsx＋libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts | 拟新extensionFormTestIds.dirtyCancel(store) | foundation确认框cancel Button→继续编辑，值保留 | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增）＋原useDrawerFormLifecycle focused | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.store.delta | storeRef | apps/frontend/operations-admin/src/features/store-management/ui/StoreEditDrawer.tsx＋libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts | 拟新extensionFormTestIds.dirtyConfirm(store) | foundation确认框ok Button→放弃稿，返回详情 | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增）＋原useDrawerFormLifecycle focused | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.contract.delta | contractRef | apps/frontend/operations-admin/src/features/contract-management/ui/ContractDetailDrawer.tsx | 拟新extensionFormTestIds.edit(contract,ref) | 原详情action-menu编辑项label anchor；开该ref Drawer | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.contract.delta | contract.booleanFieldKey | apps/frontend/operations-admin/src/features/contract-management/ui/ContractEditDrawer.tsx | 拟新extensionFormTestIds.field(contract,key) | Switch真实button；输入false | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.contract.delta | contract.numberFieldKey | apps/frontend/operations-admin/src/features/contract-management/ui/ContractEditDrawer.tsx | 拟新extensionFormTestIds.field(contract,key) | InputNumber的native input；输入0 | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.contract.delta | contract.dateFieldKey | apps/frontend/operations-admin/src/features/contract-management/ui/ContractEditDrawer.tsx | 拟新extensionFormTestIds.field(contract,key) | 现Input type=date的native input；输入YYYY-MM-DD | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.contract.delta | contract.clearFieldKey | apps/frontend/operations-admin/src/features/contract-management/ui/ContractEditDrawer.tsx | 拟新extensionFormTestIds.field(contract,key) | 现Input选中全值→Backspace→blur；已有值CLEAR，未有值omission | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增） | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.contract.delta | contractRef | apps/frontend/operations-admin/src/features/contract-management/ui/ContractEditDrawer.tsx | 拟新extensionFormTestIds.submit(contract) | 原表单保存Button→owner权威读回→重开 | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增）＋原useDrawerFormLifecycle focused | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.contract.delta | contractRef | apps/frontend/operations-admin/src/features/contract-management/ui/ContractEditDrawer.tsx | 拟新extensionFormTestIds.cancel(contract) | 原表单取消Button→现dirty guard | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增）＋原useDrawerFormLifecycle focused | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.contract.delta | contractRef | apps/frontend/operations-admin/src/features/contract-management/ui/ContractEditDrawer.tsx＋libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts | 拟新extensionFormTestIds.dirtyCancel(contract) | foundation确认框cancel Button→继续编辑，值保留 | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增）＋原useDrawerFormLifecycle focused | fresh UI/TestId review：OPEN | NOT_RUN |
| extensionForms.contract.delta | contractRef | apps/frontend/operations-admin/src/features/contract-management/ui/ContractEditDrawer.tsx＋libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts | 拟新extensionFormTestIds.dirtyConfirm(contract) | foundation确认框ok Button→放弃稿，返回详情 | 现admin-ui locator binding＋真实节点touch；CP06待建 | apps/frontend/operations-admin/src/features/extension-fields/model/extensionRequestAdapters.test.tsx（新增）＋原useDrawerFormLifecycle focused | fresh UI/TestId review：OPEN | NOT_RUN |

scope前提：本case不测试范围切换。两角色均PROJECT固定范围，合法动作仅trigger（打开原Popover）→观察region/project/confirm禁用与owner固定值→cancel→writer菜单点击/reader菜单缺项。region/project option只列为保留控件来源，不进入动作binding；不存在根据动态角色随机跳过的脚本。不得新增GROUP/REGION可变范围case或修改DataScopeSelector权限逻辑。

Contract现DATE是Input type=date，不改成DatePicker；Store沿现DatePicker/格式转换，清除已有TEXT值不用新增控件。实际source缺绑定必须先按现组件透传能力补挂、focused证明真实节点，再fresh核验；不能以wrapper id或表格本身写成PASS。若现scope常量不能标识真实控件，CP06定点补当前App常量及节点，不凭宽locator替代。

### 4a · 更新/远控复用现 Web Journey

执行文件为 tools/terminal-automation/journeys/update.test.ts（case update.owner-flow）、terminalUpdateSupplyUi.ts（供给/运营观察helper）、remote.web.test.ts（case remote.main）。两sample各update/remote一run，共四个W run，顺序执行。不建隔离TDS/wire/报告credential producer，不改TER生产API。现runner核受管DEV及LiveKit resident；CBS/TDS入口、root/operations账号、seed终端fixture、Vite/browser按现manifest/fixture核验。缺前提如实OPEN，不猜账号/旧run或偷偷reset/seed。

| 场景 | 现路径与补强 | 最终断言 / 不覆盖 |
|---|---|---|
| terminalUpdate.rules.read-and-status | createTerminalUpdateSupplyUi：平台上传FULL/HOT→运营创建/详情/启用；补原status筛选、显式查询/重置、停用/再启用及刷新 | 同ruleRef，标签/详情/权威status readback与intent一致；未知/作废label与CAS竞态仅F |
| terminalUpdate.reports.history | assertTerminalUpdateReportInUi：查询→精确task详情/历史；在主update报告accepted并核owner事实后补确定分页 | next、previous、刷新明确点击，当前terminal/cursor/task/版本字段匹配，无跨页重复；不能task在第一页就跳过分页 |
| remoteControl.launch-and-end | 现remote Web start/active/end；补end→同session ENDED/释放→入口焦点→手动再start→新session→end | 同身份readyScreens/active；Room left/inputCancelled/track释放；A→B迟到竞态另在F，不证明原生capture/input |

分页落点：四hook/Drawer F用真实component＋deferred response覆盖规则列表、门店页、报告列表和历史两页、previous/refresh/旧页迟到，不为50条分页创建大组织链。现Web主流程先完成真实update task、报告accepted及CBS精确task/binding/scope读回；这一段不拦截报告，不直接提交额外报告，不侵占terminal-update的nextReportSequence。

随后在同operations浏览器页增加一段具名W_CONTROLLED_UI分页观察：沿现Playwright Page.route接缝，处理的只能是已捕获projectRef/terminalRef的历史GET URL及对应cursor；使用当前canonical合法的两页只读JSON fixture（第一页有nextCursor，第二页有独立taskId，body不增字段），其他HTTP全部continue。两页采用不同fixture taskId、rule/full/hot引用沿已存在合法事实；它们不是CBS持久化报告，不当真实owner oracle。明确点击historyNext/historyPrevious及现refresh，核请求cursor、两页集合无重复、上一页与refresh仍绑定同terminal。旧页迟到/切context资源失效仍由F证明。

route handler是本run/page具名函数，每个被观察请求等其处理完成，try/finally用同pattern＋handler精确unroute；首败尚有处理中请求时先由现page/context owner结束这些请求并记录，不能把unroute当作已经取消所有在途handler；cleanup/readback记录handler已释放，关闭后恢复真实GET再核原真实task仍可查。禁止广泛mock全部API、改limit、造credential、TDC提交假报告、改生产slice或向PG写历史。新增UI观察只证明生产控件/读hook在浏览器中消费分页响应，证据标W_CONTROLLED_UI，不是H/隔离L2或真实CBS分页证明；前段真实W业务仍单独记录，backend真实history分页保持现owner测试/最终H证明范围。没有nextCursor不能以条件跳过写成跨页PASS。

唯一控件/行为映射：
- rules：terminalUpdateTestIds.ruleApplicationFilter/ruleCreatedRangeFilter/ruleOpen(ref)/ruleDetailActions/enableRuleAction/ruleStatusConfirm/ruleStoresPagination；补ruleStatusFilter/ruleQuerySubmit/ruleQueryReset/ruleDetailClose、ruleCreatedRangeStart/End。日期RangePicker用原id={start,end}与components.input透传ref/props按id附testId，不选第0/1个input。
- reports：reportStore/reportApk/reportJs/reportRuntime/reportQuery/reportQuerySubmit/reportQueryReset/reportOpen(ref)/reportDetail；补reportDetailClose、reportHistoryNext/Previous。分页只引用现reportHistoryPagination+'-next'/'-previous'的foundation派生值；门店页同ruleStoresPagination派生标识，由F消费。
- remote：remoteControlTestIds.detailActions(ref)/start(ref)/end/close/restart/status；真菜单/Button及现workArea。restart走同一launcher，不fake description/actor。
- refresh沿现Shell常量，Drawer close沿drawerSurface现closeIcon动作anchor。query/Select/Menu/Button标真实节点，F与节点核验先于Journey，当前OPEN。

remote Web endpoint为现createWebRemoteControlTestPort：真实LiveKit DataChannel＋synthetic canvas track；现afterAll已有ended/roomLeft/inputCancelled/tracksReleased，新增主流程在结束动作后显式观察，不只afterAll。不是Android screen capture、双屏或触摸证明，business/cleanup分开。

## 5 · 受管控制面与工件准入

### 5.1 仅三个case的隔离 L2

手写源：contracts/policy/admin-ui-l2-case-blueprint.json、admin-ui-l2-activation-candidate.json、admin-ui-l2-fixture.json、admin-ui-l2-timing-budget.json；scripts/generate/admin-ui-l2-p1.mjs派生admin-ui-l2-scenarios.json、admin-ui-l2-locator-bindings.json、admin-ui-l2-execution.json。case恰为§4.1三个。复用same-run readiness/identity/digest/activation与原browser-l2-runtime，不新runner/registry。

拟新contracts/policy/admin-ui-l2-admission.json、scripts/test/admin-ui-l2-admission.mjs/.test.mjs复用createL2SuiteAdmissionStrategy，suite='admin-ui'、policyKind='admin-ui-l2-script-admission'；五case来源沿candidate.approvedCaseIds/blueprint.screens[].caseId/scenarios.scenarios[].cases[].caseId/timing.cases[].caseId/fixture.caseFixtures[].caseId。designPath为本详设，reviewRecordPath为未来doc/review/platform/2026-10-14-backend-frontend-structure-l2-admission-review-codex.md；三标记UI_DESIGN_REVIEW/TESTID_REVIEW/L2_SCRIPT_ADMISSION须当前字节独立PASS，当前BLOCKED。

uiSourceDirectories精确为apps/frontend/operations-admin/src/app、apps/frontend/operations-admin/src/features/organization-structure、apps/frontend/operations-admin/src/features/store-management、apps/frontend/operations-admin/src/features/store-profile、apps/frontend/operations-admin/src/features/contract-management、apps/frontend/operations-admin/src/features/extension-fields、libraries/frontend/admin-ui-foundation/src。更新Page菜单入口由app节点＋独立W核验，不把remote媒体依赖纳入L2。controlPlaneFiles全集为本节8份手写/生成policy、producer、tools/admin-ui-l2/cli.mjs、scripts/test/admin-ui-l2-fixture.mjs/.test.mjs、admin-ui-l2-admission和p1直接测试、browser-l2-runtime.mjs/.test.mjs、现operationsL2公共helper、admin-ui.spec.ts、App/registration与上述TestIds真实绑定、三设计文档/正式需求、test-health-entry-runner及其.test.mjs。不含TDS/wire/TER builder/grant/report fixture。

cli只校验source/生成链，复用现P1；fixture只经owner HTTP/fixture client建组织、权限和扩展事实。browser-l2-runtime只扩suite config/admission、bootstrap、环境/discovery/run/byte binding/cleanup。资源为现远端CBS/隔离DB/asset namespace/HTTP资产tunnel、本机两Vite/Playwright/context、run-owned临时文件；TDS节点只远端loopback，不增TDS tunnel/wire进程。红例核缺policy/错suite/run/case/action、UI变更/缺标记/根外路径/资源identity/首败/cleanup；check-runtime-resource-budget只登记真实父run资源。

Node显式登记三个新test：scripts/test/admin-ui-l2-admission.test.mjs、admin-ui-l2-p1.test.mjs、admin-ui-l2-fixture.test.mjs。当前同根五项缺登记按计划CP06精确路径只补test-health-entry-runner.mjs#nodeTestFiles元数据及现入口测试，不改业务/运行范围；复用validateExplicitTestSet缺项/重复/额外项red，写前核在途追加。不运行--node全集合/verify；登记不授权seed/LiveKit运行。

### 5.2 Web控制面（现入口，不增suite）

修改面为tools/terminal-automation/journeys/update.test.ts、terminalUpdateSupplyUi.ts、remote.web.test.ts及拟新增tools/terminal-automation/test/terminalUpdateSupplyUi.test.ts、remoteControlWebJourney.test.ts；复用现updateOwnerFlow.test.ts及runner.test.ts。新增两test由现TER automation Vitest配置发现，不注册到scripts Node列表；只消费src/{driver,runner,managedRun}.ts现API、createWebRemoteControlTestPort及现fixture/cleanup，不修改TER生产代码/fixture port。两sample/currentDEV/account/terminalRef/context/run/session/Room关联从原selector/manifest读回，不复制credential。日志和TEST_CHAIN_PREFLIGHT覆盖真实UI→CBS/TDC→owner→report/Room→cleanup，以及独立标识的W_CONTROLLED_UI→route fixture→分页控件→精确unroute；不混同两类oracle。

### 5.3 首次 L2 的完整 seed dry-run

复用现R5_TERMINAL_UPDATE_SEED_ARTIFACT_EXPORT=1的update.artifacts源run，两App各INSTALL/FULL/HOT，导出十文件；仍有构建成本，不写成只构建Web。源run须FINISHED、business/cleanup PASS后，用R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID=<显式本次源runId> scripts/dev/seed --profile r5-full --dry-run；现buildTerminalUpdateSeedPlan核source/摘要/边界。输入仅用于模板6c准入，不给三case L2上传，不建跨run移交账本，不在held L2启动源run。

源export目录按现source owner身份管理；当前runner有意保留update/seed-inputs，不误称已回收。实施CP06读回原管理能力：需回收且无既有入口时仅补原source owner的显式sourceRunId精确cleanup，不借L2父run所有权、不删未知资源；保留小报告/log。实际cleanup未证明为OPEN，未达到获授权完成条件不得交付。

N-2边界：r5-complete-seed-executor#dryRun只执行plan/plan-only，不执行owner-command-seed-executor七请求，dry-run PASS不能证明seed对象化。helper F与ExtensionAcceptance H各证明自身接缝；真实seed/持久化在实际seed授权前L3/NOT_RUN。W依赖现DEV seed就绪，不自动reset/seed；所选App工件另由现update.owner-flow构建，不能拿这里的export冒称省去成本。

## 6 · 依赖与官方依据

2026-10-14只读 `node_modules/<package>/package.json` 核得React/ReactDOM19.2.5、RTK2.12.0、antd6.5.0、Vitest4.1.10、@playwright/test1.61.1；两App依赖声明与本地解析一致，未来运行仍须核实际图。无新依赖；媒体SDK调用不变，Playwright复用既有routing接缝；不升级工具来迁就设计。

- React19.2.5：官方精确tag [ReactHooks.js](https://github.com/facebook/react/blob/v19.2.5/packages/react/src/ReactHooks.js) 与 [ReactFiberCommitEffects.js](https://github.com/facebook/react/blob/v19.2.5/packages/react-reconciler/src/ReactFiberCommitEffects.js) 已访问；复用hooks与effect cleanup，异步business identity仍由本仓guard，不把cleanup当网络取消。
- RTK2.12.0：官方 [buildHooks.ts](https://github.com/reduxjs/redux-toolkit/blob/v2.12.0/packages/toolkit/src/query/react/buildHooks.ts) 已访问，currentData绑定当前args，data可能保留先前值；沿现transport unsubscribe/track语义，不复制执行器。
- antd6.5.0/ProComponents原组件配置全部保持，经本仓drawerSurface/useDrawerFormLifecycle/原DOM传递；本批不依赖新默认值或新增事件API。官方6.5.0源码远端访问本次未成功，若实施需新增参数/透传TestId，先按实际解析包官方源码（本仓node_modules发行物）及精确tag核对后再用，不把未访问链接写成已证。
- Playwright1.61.1：本地官方发行物 node_modules/playwright-core/package.json、types/types.d.ts:4072/4747/20933及lib/coreBundle.js:60836–60884已读；Page.route支持具名handler，Route.fulfill可返回JSON body/contentType，Page.unroute(pattern,handler)只移除精确handler，不能当取消在途处理。沿现sales-menu.spec.ts的Page.route接缝，保留其他handler与真实HTTP；新增helper F核命中限定、旁路continue、两页身份与finally释放。不是已运行浏览器证明。
- Spring/Java：Boot Gradle声明4.1.0不是实际Spring解析证明；本次无proxy/事务传播改变。CP01读取受管backend-runtime-classpaths输出，按实际Spring精确tag核对原@Transactional/self-call，仅保留原调用形态。native/LiveKit本批不改API，故不新增其官方行为主张。

官方资料证明库约定，不证明本仓装配或运行。F只验证当前接缝；Java/SDK解析与H/L2均NOT_RUN。

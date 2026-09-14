SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# 可读性整改欠账 · Implementation-facing 详设

- 文档类型：implementation-facing design
- 需求正本：doc/plans/platform/2026-09-12-v2s-readability-deferred-backlog-requirements-claude.md
- 实施计划：doc/plans/platform/2026-09-12-v2s-readability-deferred-backlog-implementation-plan-codex.md
- 交付单元：一个 delivery unit，覆盖 B1–B16；不得按批次、module、门或 App 拆成独立 review cycle
- 当前状态：DESIGN follow-up 已按三条文档修复收口；Dexter 已授权本 delivery unit 进入实施
- IMPLEMENTATION_AUTHORITY：true（授权来自当前 Dexter 会话与 R5 Roadmap 授权字段）
- 本轮 review intake：Dexter 已按“最优最长远方向”裁定 M-06 采用 bounded minimal support set、M-08 采用三文件执行归位、M-01 采用 named/typed persistence public boundary；三条 follow-up 文档 finding 已回写并静态核验
- L2_USER_VISIBLE：NOT_APPLICABLE。本立项不改变 UI surface、Journey、控件、文案或 HTTP 契约
- 详设编写阶段未启动 DEV、未 reset/seed、未跑 backend acceptance、browser L2 或 UAT；当前 implementation 阶段仍须按计划在 CP-0、B1–B16 收口后才执行受管验收与 reset/dev/seed

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-12-v2s-readability-deferred-backlog-requirements-claude.md
JOURNEY_REFS=NOT_APPLICABLE_WITH_REASON:本批不新增或改变业务 Journey
IA_REF=NOT_APPLICABLE_WITH_REASON:本批不新增 UI surface；B2 只对既有 Drawer 做结构移动
INTERACTION_REF=NOT_APPLICABLE_WITH_REASON:不改变用户动作、控件、文案或 HTTP operation
AUTHORIZED=按本详设与实施计划完成 B1-B16、最终全量 backend acceptance、受管 reset/dev/seed
NOT_AUTHORIZED=契约或 generated 变更 / migration 变更 / UAT / 部署 / 切流 / Git；任何超出本 delivery unit 的范围
IMPLEMENTATION_AUTHORITY=true
```

## 0. 目标、非目标与第一性决策

### 0.1 真实问题

接手者面对三类混在一起的理解成本：

1. application owner service 同时承担业务规则、事务入口、SQL 文本和 JDBC 执行；
2. query-boundaries 与 backend acceptance structure 的控制意图已经存在，但没有在真实执行序列或完整源全集上闭合；
3. catalog feature 的模型与两个大型 Drawer 把状态、规则、数据访问与渲染挤在平坦目录中。

本批只处理可读性和可维护性，不改变业务事实、HTTP 契约、数据库模型、权限、Journey、operation 身份或执行拓扑的业务语义。

### 0.2 目标形态

- 参与 SQL 表达式构造的 SQL 文本片段，按执行点和 owner module 归属对应 module 的 persistence 纯常量持有类；最终目标中，动态条件的选择与组合归 persistence execution 负责，public persistence 方法只接收业务级参数（读侧例如 filter、sort、page、target；写侧例如聚合/命令对象、字段值等），由 persistence 内部完成 fragment 选择/组合。业务级参数按语义判定：String 只能承载 name、code、ref 等业务数据，读侧 filter/sort/page/target 与写侧聚合/命令对象/字段值不能包含 SQL 文本、fragment、mapper 或可变执行参数。application/domain 不得保留 SQL 文本字面量或 SQL fragment，也不得以参数名、包装类型或其它形式向 persistence 传递 SQL 文本/片段。
- 最终 SQL 执行目标形态唯一归属同一 module 的 persistence 执行类。需求点名的三个既有 infrastructure/adapter 文件按 M-08 裁定迁入对应 module 的 persistence execution；infrastructure/adapter 仍保留在写路径扫描分母中，作为防止责任回流的哨兵，不再是本批执行目标或永久例外。该形态不是改包名：persistence execution 的公开边界必须是具名、类型化的业务读写方法，不得暴露以 `String sql` 加通用 mapper/可变参数或 `update(String, Object...)` 为形态的 raw-SQL 透传；application/domain 也不得拼接 SQL 后交给通用 executor。仅在 persistence execution 类内部的 private helper 可以处理 SQL 字符串，并随目标类归位。

  M-01 的业务参数枚举同时覆盖读写两侧：读侧为 `filter`、`sort`、`page`、`target` 等业务查询参数；写侧为聚合、命令对象、字段值等业务变更参数。任何一侧都不得用参数名、record/wrapper 或通用可变参数承载 SQL 文本、fragment、mapper 或执行参数。

  该边界是 M-01 的形态裁定，不是对通用工具的偏好：raw-SQL 透传只提供执行位置，没有给每条查询提供 persistence 归属；保留它会让 sales-menu 长期维持“application 组装 + 哑执行器”的特殊形态，与其它 module 的具名 persistence 方法并存。代价限定在一个 module 的 execution 批次内，批次独立 cost baseline 达到三倍时只触发向 Dexter 报告，不能由实施者以成本为由自行改裁。
- 保留既有 facade、公开类型 FQCN、公开嵌套异常/record、静态兼容入口和注入边界。
- coordinator、组合 task-read、adapter/support 不伪装成聚合。
- 前端只拆三个已裁定文件，进入职责子目录，保留状态生命周期、foundation 能力和用户行为。
- 只修已纳入的 query-boundaries、写路径分母、acceptance structure 与 backend vocabulary；不顺手接线其它 23 道 check。

### 0.3 方案选择

| 选项 | 决策 | 原因 |
| --- | --- | --- |
| A1：13 个 module 同批搬文本，随后 13 批搬执行 | 采用 | 文本和执行先后解耦，最终形态统一，事务风险逐 module 收口 |
| A2：13 个 module 一次搬文本与执行 | 不采用 | SQL 值、事务拓扑和类边界同时变化，首败难定位 |
| A3：只做文本或只做最重 module | 不采用 | 只做文本会留下执行无归属；只做部分会长期存在两种形态 |
| 测试文件切分 | 不采用 | 场景按 id 发现，helper 扇入高；切分不降低业务理解成本且会引入脚手架 |
| 新 AST/位置门/通用基类 | 不采用 | 当前判据不可靠或复杂度超出本批；按需求裁决保持 review 规则 |

**详设选择 A1 而不是 A2/A3，因为先建立可解析的 persistence 文本边界、再逐 module 移动执行，能把有效 SQL 等价与事务代理边界分成两个可定位的变化面，同时最终不留下两种长期形态。**

## 1. 事实边界与术语

### 1.1 当前源全集

CP-0 必须从当前字节一次性重产出下列工作清单；数量只作结构基线，不作验收分母：

- Backend 候选：每个 module 的 `apps/backend/catering-business-server/modules/<module>/src/main/java/com/catering/v2s/<module-package>/application/` 下，文件名以 `Service.java` 或 `Coordinator.java` 结尾者；`<module-package>` 不是固定一层，必须按当前包根枚举。当前只读枚举为 89 个。
- SQL source：13 个业务 module 的 api/application/domain 段 Java 文件，并追踪到 persistence/infrastructure/adapter sink；其中既有技术段的执行归位受 M-08 决策约束。
- Frontend target：features/catalog-management/model/catalogModel.ts、ui/CatalogDictionaryDrawerState.tsx、ui/LocalCatalogCopyDrawer.tsx。
- Acceptance source：apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/*Scenarios.java 全集，当前 11 个。P2ReadConnectionScopeScenarios 是零 `@AcceptanceScenario` 的显式 connection-scope proof helper，不贡献业务场景；它由 structure gate 的通用 helper-consumer 规则表示，不伪装成 business group。
- 候选边界外的协调器：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/externalcollaboration/ExternalCollaborationBusinessChannelCoordinator.java` 位于 app edge，不在任何 `modules/<module>/.../application/` 候选全集内；它只按既有跨 owner command API 协调 collaboration/channel，不因类名带 `Coordinator` 被静默纳入本批。`PlatformWorkspaceCoordinator` 同样只作为既有 API 边界记录，不扩入 89 个候选。

当前字节与任何清单不一致时，状态只能是 OPEN；不能用旧数字补齐或静默修正。

### 1.2 术语

- 业务事实 owner：决定命令事实、CAS/锁目标、状态/审计和权威 readback 的模块边界。
- method family：同一业务动作的 public overload、同一命令事实的入口和必要内部派发族；不能按方法名 substring 猜族。
- facade：保留稳定公开解析面、只转发到实际 owner bean 的非业务实现类。
- persistence execution：直接调用 JDBC、repository 或 SQL sink 的方法。
- effective SQL：传入 SQL sink 的最终字符串、片段顺序、占位符位置；不包含敏感参数值。
- unknown construction：提取器无法完整解析字符串数据流或 SQL 语义的构造。unknown 不是绿，必须清单化并逐项 review。

## 2A · CP 总览（对应 implementation-design-template §2）

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-0 | 当前字节盘点与四张工作矩阵 | 主 agent；全 13 个 backend module、catalog-management、acceptance structure | 候选逐行理由、caller/transaction/persistence/test 矩阵、M-01 raw-SQL/fragment 边界盘点、已裁定 M-06 支持集与 M-08 归位边界、排序键 | 需求、memory、coding/review standard、owning source |
| B1 | query-boundaries、写路径分母、acceptance structure、backend vocabulary | verify-gates、scripts/test、backend standard | 真实 marker、9+1 mutation、四个 SELECT-star 源处置、三段 write-path red fixture、通用 helper structure proof | CP-0；按已裁定 M-06 支持集实现 |
| B2 | 三个 catalog-management 文件的职责拆分 | operations-admin/catalog-management | 子目录产物、既有 consumer 路径、Drawer lifecycle focused proof | CP-0；不新增 UI/Journey/L2 |
| B3 | 13 个 module 的 SQL 文本归位 | 各业务 module persistence | 常量类、fragment graph、每 execution point 的 before/after effective SQL proof | B1、B2；按已裁定 M-06 支持集处理 unknown |
| B4–B16 | 逐 module 移动 persistence execution | 按 CP-0 排序确定的 module owner | target execution 类、事务/self-call/锁/幂等/readback proof、caller 变更 | B3；M-08 三文件归位边界已定 |
| B16 后 | 全范围对账与唯一全量 acceptance 设计 | 主 agent与受管验收入口 | 全范围三维对账、逐代码与详设对账记录、最终 acceptance 输入 | B1–B16 全部 MATCHED |

### 2A.1 已裁定的范围与形态边界

| 决策 | 当前状态 | 已确定的边界 | 执行处理 |
| --- | --- | --- | --- |
| M-06：SQL 解析能力 | `DECIDED_BY_DEXTER: A` | 采用 bounded minimal support set：仅使用仓内既有 Node/TypeScript 运行时和标准库，不引入第三方 parser/framework；支持 Java string/text block 词法、`+`、同 module 纯常量持有类内由 literal 与同类其它 `static final String` 常量组成的常量表达式、`AS MATERIALIZED` CTE、derived table 与 alias 的关系范围 | B1/B3 必须实现并验证该支持集；StringBuilder、format/join、helper return、条件选择、跨方法链、不同常量持有类之间的引用等 tier 2 构造输出显式 unknown，由 capture 或逐项 review 闭合，不能静默绿 |
| M-08：既有 infrastructure/adapter 三文件 | `DECIDED_BY_DEXTER: relocate` | `SalesMenuRepository.java`、`JdbcSalesMenuRepository.java`、`JdbcGroupWorkspaceRepository.java` 的 SQL 文本与执行分别归位到所属 module persistence；不保留本批技术段执行例外 | B3 纳入 constants；execution relocation 在 CP-0 按统一排序确定的所属 module 批次完成；infrastructure/adapter 仍进入写路径分母和回流哨兵扫描 |
| M-01：persistence execution 公开边界 | `DECIDED_BY_DEXTER: named-typed-boundary` | persistence execution 的 public 方法必须是具名、类型化的业务读写边界：只接收读侧 filter/sort/page/target，以及写侧聚合/命令对象/字段值等业务级参数，由 persistence 内部完成 SQL 条件选择/组合；不得以 raw-SQL `query/update`、SQL fragment 参数或包装类型透传承接 application/domain 组装的 SQL。跨 module coordinator/task-read 若确需单条 SQL，整条语句归属于已明确的 task-read/use-case owner module persistence | CP-0 逐 module 盘点 public raw-SQL 入口、SQL fragment 参数和调用点；所属 execution 批次改为业务参数方法；没有既定 task-read owner 时 OPEN 并报告 Dexter |

M-06-B 不再是可选实现分支：在 A1/B3 先把 SQL 文本迁入 persistence 的序列中，若只支持同表达式而不能解析同 module persistence 常量引用，则每个合法的跨文件调用都将输出 `SELECT_STAR_UNRESOLVED` 或 `UNRESOLVED_SQL_CONSTRUCTION`，使 B3 对自己刚建立的目标形态普遍 fail-closed。因此 B 不能与本 delivery unit 的 A1/B3 序列共同成立；实现必须按上表的 A 支持集推进，仍无法解析的 tier 2 项逐项清单化并按 STOP 规则处理。

## 2. 不变量

### 2.1 业务不变

同一输入、权限/session、数据状态下，返回结构、状态迁移、错误码/错误字段、事务提交/回滚、幂等回放、并发冲突、锁顺序、审计和权威 readback 与变更前一致。

### 2.2 Owner 与公开面

- 既有 controller、其它 owner、advice、测试使用的 facade FQCN、public constructor 保留。
- facade 只转发；target bean 承接业务事实，不用 primary、fallback 或 optional injection 掩盖 bean 歧义。
- ContractProblemAdvice 对公开嵌套异常/record 的 FQCN 映射保持。
- 静态兼容 validator 的入口、签名和结果保持。
- 跨 owner 写仍经目标 owner 的公开 command API，在既有 REQUIRED 事务约定内完成；本批不新增跨 owner write。

### 2.3 事务与持久化

B4–B16 对每个 method family 记录：

- @Transactional 全部属性；
- TransactionTemplate 传播和位置；
- self-call 及其外层事务属性；
- 锁顺序、CAS、幂等 receipt/replay/conflict；
- audit/event/operation record 顺序；
- child row 失败回滚范围；
- authoritative readback 时点和 oracle；
- facade-to-target 的代理边界。

B3 不改变以上项目。B4 起若 bean-to-bean 代理改变事务开始/结束点，必须有源码分析和 focused business proof，不能只复制注解。

### 2.4 范围红线

不新增产品语义、权限、Journey、HTTP operation、契约/generated、schema/migration/seed、MQ/outbox/TDP、内部 OpenAPI client、轮询、新 AST 依赖、新通用基类、前端新 surface/testId、测试文件切分或全仓 SQL 迁移。

## 3. CP-0 与四张工作矩阵

CP-0 是当前实施输入，不是新的 compliance 台账；不建立 hash-chain、incremental receipt 或 package entry/exit 控制面。

### 3.1 候选分类原则

所有 89 个 application service/coordinator 必须有一行。分类只回答是否按业务聚合拆 application 类边界，与 SQL 文本/执行归位独立：

- KEEP_FACADE：保留稳定公开解析面，具体 owner bean 承接事实。
- KEEP_SINGLE_AGGREGATE：命令事实、CAS/锁和 readback 同一根，保持单类。
- KEEP_TASK_READ：组合 task projection，不塞进 mutation aggregate。
- KEEP_ADAPTER_SUPPORT：receipt、audit、authentication、authorization、rate-limit 等 support 边界。
- KEEP_COORDINATOR：跨 owner/服务编排，不塞进任何聚合。
- MOVE_EXECUTION：独立的 SQL/JDBC/repository 执行归位结论，不是分类值；KEEP 类若有 sink 仍必须处理。

### 3.2 89 个候选的初始分类

分类以当前源码名称、Javadoc 和已知 owner 事实为初始值；CP-0 必须逐个核对命令事实、锁/CAS 与 readback，不能仅按名称通过。

| module | 类与分类 |
| --- | --- |
| asset | PlatformAssetService = KEEP_SINGLE_AGGREGATE |
| business-channel | BusinessChannelCommandReceiptService = KEEP_ADAPTER_SUPPORT；BusinessChannelOwnerService = KEEP_FACADE；BusinessChannelService = KEEP_SINGLE_AGGREGATE；BusinessChannelTaskReadService = KEEP_TASK_READ；BusinessChannelTemplateService = KEEP_SINGLE_AGGREGATE |
| catalog | CatalogAttributeDefinitionService = KEEP_SINGLE_AGGREGATE；CatalogCategoryService = KEEP_SINGLE_AGGREGATE；CatalogCopyService = KEEP_SINGLE_AGGREGATE；CatalogDictionaryService = KEEP_SINGLE_AGGREGATE；CatalogInventoryCoordinator = KEEP_COORDINATOR；CatalogItemService = KEEP_SINGLE_AGGREGATE；CatalogOrderOptionDefinitionService = KEEP_SINGLE_AGGREGATE；CatalogOwnerService = KEEP_FACADE；CatalogTaskReadService = KEEP_TASK_READ；CatalogUnitDefinitionService = KEEP_SINGLE_AGGREGATE；CatalogWorkbenchReadService = KEEP_TASK_READ |
| collaboration | CollaborationCommandReceiptService = KEEP_ADAPTER_SUPPORT；CollaborationOwnerService = KEEP_SINGLE_AGGREGATE |
| extension | ExtensionAuditHistoryService = KEEP_ADAPTER_SUPPORT；ExtensionCommandReceiptService = KEEP_ADAPTER_SUPPORT；ExtensionDefinitionService = KEEP_SINGLE_AGGREGATE |
| fulfillment-production | ProductionTagOwnerService = KEEP_SINGLE_AGGREGATE；ProductionTagTaskReadService = KEEP_TASK_READ |
| inventory | InventoryAvailabilityService = KEEP_TASK_READ；InventoryBomService = KEEP_SINGLE_AGGREGATE；InventoryCatalogLifecycleService = KEEP_SINGLE_AGGREGATE；InventoryCopyService = KEEP_SINGLE_AGGREGATE；InventoryOwnerService = KEEP_FACADE；InventoryTargetService = KEEP_SINGLE_AGGREGATE；InventoryTaskReadService = KEEP_TASK_READ |
| organization | BusinessBrandService = KEEP_SINGLE_AGGREGATE；BusinessEntityCommandReceiptService = KEEP_ADAPTER_SUPPORT；BusinessEntityService = KEEP_FACADE；BusinessEntityTaskReadService = KEEP_TASK_READ；BusinessTenantService = KEEP_SINGLE_AGGREGATE；CommercialGroupCommandReceiptService = KEEP_ADAPTER_SUPPORT；HeadCompanyService = KEEP_SINGLE_AGGREGATE；OperationsOrganizationTaskReadService = KEEP_TASK_READ；OrganizationAssignmentCandidateService = KEEP_TASK_READ；OrganizationAuditHistoryService = KEEP_ADAPTER_SUPPORT；OrganizationCommandService = KEEP_SINGLE_AGGREGATE；OrganizationGroupWorkspaceInitializationTaskReadService = KEEP_TASK_READ；OrganizationHierarchyCommandReceiptService = KEEP_ADAPTER_SUPPORT；OrganizationHierarchyService = KEEP_SINGLE_AGGREGATE；OrganizationOverviewTaskReadService = KEEP_TASK_READ；OrganizationTaskPathService = KEEP_TASK_READ；OrganizationVisibilityService = KEEP_TASK_READ；StoreCandidateTaskReadService = KEEP_TASK_READ；StoreService = KEEP_SINGLE_AGGREGATE |
| platform-admin-iam | PlatformAuthenticationService = KEEP_ADAPTER_SUPPORT；PlatformCommandReceiptService = KEEP_ADAPTER_SUPPORT；PlatformIamAuditHistoryService = KEEP_ADAPTER_SUPPORT |
| sales-menu | SalesMenuDefinitionService = KEEP_SINGLE_AGGREGATE；SalesMenuItemService = KEEP_SINGLE_AGGREGATE；SalesMenuManualSaleService = KEEP_SINGLE_AGGREGATE；SalesMenuOperationRecordService = KEEP_ADAPTER_SUPPORT；SalesMenuOwnerService = KEEP_FACADE；SalesMenuPublicationService = KEEP_SINGLE_AGGREGATE；SalesMenuSectionService = KEEP_SINGLE_AGGREGATE |
| store-contract | ContractAuditHistoryService = KEEP_ADAPTER_SUPPORT；ContractCommandReceiptService = KEEP_ADAPTER_SUPPORT；ContractCommandService = KEEP_SINGLE_AGGREGATE；ContractTaskReadService = KEEP_TASK_READ |
| workspace-iam | PlatformInvitationCandidatesTaskReadService = KEEP_TASK_READ；PlatformWorkspaceAccountTaskReadService = KEEP_TASK_READ；PlatformWorkspaceInvitationTaskReadService = KEEP_TASK_READ；WorkspaceAccountService = KEEP_SINGLE_AGGREGATE；WorkspaceAssignmentScopeService = KEEP_TASK_READ；WorkspaceAuditAuthorizationService = KEEP_ADAPTER_SUPPORT；WorkspaceAuthenticationService = KEEP_ADAPTER_SUPPORT；WorkspaceCommandAuthorizationService = KEEP_ADAPTER_SUPPORT；WorkspaceIamAuditHistoryService = KEEP_ADAPTER_SUPPORT；WorkspaceIamCommandReceiptService = KEEP_ADAPTER_SUPPORT；WorkspaceIamSummaryReadService = KEEP_TASK_READ；WorkspaceInvitationService = KEEP_SINGLE_AGGREGATE；WorkspaceLoginRateLimitService = KEEP_ADAPTER_SUPPORT；WorkspaceOperationsCommandService = KEEP_COORDINATOR；WorkspaceOtpRateLimitService = KEEP_ADAPTER_SUPPORT；WorkspacePasswordRecoveryService = KEEP_ADAPTER_SUPPORT；WorkspacePasswordResetService = KEEP_ADAPTER_SUPPORT；WorkspaceRoleService = KEEP_SINGLE_AGGREGATE；WorkspaceTaskReadService = KEEP_TASK_READ；WorkspaceUserService = KEEP_TASK_READ |
| workspace | PlatformWorkspaceAdministrationTaskReadService = KEEP_TASK_READ；PlatformWorkspaceAuditHistoryService = KEEP_ADAPTER_SUPPORT；PlatformWorkspaceService = KEEP_COORDINATOR；WorkspaceAdministrationService = KEEP_SINGLE_AGGREGATE；WorkspaceCommandReceiptService = KEEP_ADAPTER_SUPPORT |

KEEP_* 不等于排除 SQL 处理。CP-0 必须另列每类的 SQL/JDBC/repository sink 是否存在、是否在 B3/B4–B16 处理。

### 3.2A · 逐候选理由矩阵（不是按名称或规模放行）

下表把每个候选的当前理由和源码锚点显式列出。`A`、`F`、`T`、`S`、`C` 是理由模板而不是通过标记：CP-0 必须在同一行补齐实际命令事实、CAS/锁目标和权威 readback；三者不能落在同一事实根时，该行改为 `OPEN`，不得用类名、后缀、行数或事务数量维持原分类。

| 理由码 | 可复核的判定要求 |
| --- | --- |
| A | public command/read family 的源码锚点围绕同一 owner fact；必须指出 CAS/锁目标和权威 readback，才能 KEEP_SINGLE_AGGREGATE |
| F | public FQCN 是稳定解析面，源码应只转发到目标 owner bean；必须证明自身无业务事务/JDBC execution |
| T | public symbols 是组合 task-read/projection；必须证明不执行 mutation、不持有聚合写入/CAS/锁主权 |
| S | public symbols 是 receipt/audit/auth/rate-limit 等 support；必须证明不拥有业务聚合 command、CAS/锁或业务 readback |
| C | public symbols 跨两个或以上 owner command/readback；必须证明不存在可归属于单一聚合根的事实 |

| module | class | 分类 | 理由码 | 当前源码锚点（CP-0 需沿锚点补足三项事实） |
| --- | --- | --- | --- | --- |
| asset | PlatformAssetService | KEEP_SINGLE_AGGREGATE | A | `stageContent`、`stageCatalogContent`、`stageCatalogAsset`、`releaseStagedSalesMenuItemImage` |
| business-channel | BusinessChannelCommandReceiptService | KEEP_ADAPTER_SUPPORT | S | `execute`；核对 receipt/replay，不得承接 channel/template 聚合写入 |
| business-channel | BusinessChannelOwnerService | KEEP_FACADE | F | `pageTemplates`、`pageStoreTemplateCandidates`、`pageChannels`、`readTemplate` |
| business-channel | BusinessChannelService | KEEP_SINGLE_AGGREGATE | A | `pageChannels`、`readChannel`、`createChannel`、`updateChannel` |
| business-channel | BusinessChannelTaskReadService | KEEP_TASK_READ | T | `listSalesMenuEligibleChannels`、`requireSalesMenuChannel`、`readChannelWithTemplateProvider` |
| business-channel | BusinessChannelTemplateService | KEEP_SINGLE_AGGREGATE | A | `pageTemplates`、`pageStoreTemplateCandidates`、`readTemplate`、`createTemplate`、`updateTemplate` |
| catalog | CatalogAttributeDefinitionService | KEEP_SINGLE_AGGREGATE | A | `listAttributeDefinitions`、`createAttributeDefinition`、`updateAttributeDefinition` |
| catalog | CatalogCategoryService | KEEP_SINGLE_AGGREGATE | A | `createCategory`、`updateCategory`、`moveCategory`、`transitionCategoryStatus` |
| catalog | CatalogCopyService | KEEP_SINGLE_AGGREGATE | A | `readLocalCopyCandidates`、`readBrandCopyCandidates`、`copy`、`preflightCopy` |
| catalog | CatalogDictionaryService | KEEP_SINGLE_AGGREGATE | A | `readDictionary`、`createDictionaryEntry`、`updateDictionaryEntry`、`reorderDictionaryEntries` |
| catalog | CatalogInventoryCoordinator | KEEP_COORDINATOR | C | `readCatalogWorkbenchContext`、`readCatalogItems`、`readCatalogItemSkus`；核对 Catalog/Inventory owner API 调用边界 |
| catalog | CatalogItemService | KEEP_SINGLE_AGGREGATE | A | `readItem`、`createCatalogItem`、`transitionCatalogItemStatus`、`saveCatalogItem` |
| catalog | CatalogOrderOptionDefinitionService | KEEP_SINGLE_AGGREGATE | A | `listOrderOptionDefinitions`、`createOrderOptionDefinition`、`updateOrderOptionDefinition` |
| catalog | CatalogOwnerService | KEEP_FACADE | F | `readWorkbenchContext`、`readItems`、`readInventoryDisplayFacts`；保留 package-private `CatalogTemporaryPromotionOwner` 接口 |
| catalog | CatalogTaskReadService | KEEP_TASK_READ | T | `workbenchContext`、`navigation`、`items`、`categoryCandidates` |
| catalog | CatalogUnitDefinitionService | KEEP_SINGLE_AGGREGATE | A | `listUnitDefinitions`、`createUnitDefinition`、`updateUnitDefinition`、`transitionUnitStatus` |
| catalog | CatalogWorkbenchReadService | KEEP_TASK_READ | T | `readWorkbenchContext`、`readNavigation`、`readItems`、`readInventoryDisplayFacts` |
| collaboration | CollaborationCommandReceiptService | KEEP_ADAPTER_SUPPORT | S | `execute`；核对 receipt/replay，不持有 collaboration 聚合事实 |
| collaboration | CollaborationOwnerService | KEEP_SINGLE_AGGREGATE | A | `readExternalSystem`、`readProviderProfile`、`readTree`、`readBinding` |
| extension | ExtensionAuditHistoryService | KEEP_ADAPTER_SUPPORT | S | `read`、`readExtensionDefinition`；核对 audit projection 与业务 command 分离 |
| extension | ExtensionCommandReceiptService | KEEP_ADAPTER_SUPPORT | S | `execute`；核对 receipt/replay，不持有 extension definition 聚合写入 |
| extension | ExtensionDefinitionService | KEEP_SINGLE_AGGREGATE | A | `requireDefinition`、`listDefinitions`、`managementDefinition`、`operationsManagementDefinition` |
| fulfillment-production | ProductionTagOwnerService | KEEP_SINGLE_AGGREGATE | A | `read`、`readTags`、`readNavigationTags`、`write`、`update` |
| fulfillment-production | ProductionTagTaskReadService | KEEP_TASK_READ | T | `tags`；核对组合读取不写 tag 事实 |
| inventory | InventoryAvailabilityService | KEEP_TASK_READ | T | `readSalesMenuAvailability`；只读 sales-menu availability projection，不承接 mutation/CAS/lock |
| inventory | InventoryBomService | KEEP_SINGLE_AGGREGATE | A | `readCatalogInventoryDefinition`、`readCatalogInventorySummary`、`ensureCatalogInventoryTarget`、`saveCatalogProductBom` |
| inventory | InventoryCatalogLifecycleService | KEEP_SINGLE_AGGREGATE | A | `validateCatalogUnitLifecycle`、`catalogItemVoidDependencies`、`catalogSkuVoidDependencies`；CP-0 必须证明跨 Catalog/Inventory 名称下仍是同一 lifecycle fact，否则 OPEN |
| inventory | InventoryCopyService | KEEP_SINGLE_AGGREGATE | A | `copy`、`setValues`、`preflightCopy`、`preflightLocalCopy` |
| inventory | InventoryOwnerService | KEEP_FACADE | F | `readSalesMenuAvailability`、`readTargets`、`readTargetChangeSummary`、`readTargetDiagnostics` |
| inventory | InventoryTargetService | KEEP_SINGLE_AGGREGATE | A | `readTargets`、`readTarget`、`readTargetChangeSummary`、`readTargetBusinessHistory`、`readTargetConsumptionReferences` |
| inventory | InventoryTaskReadService | KEEP_TASK_READ | T | `targets`、`target`、`changeSummary`、`businessHistory`、`consumptionReferences` |
| organization | BusinessBrandService | KEEP_SINGLE_AGGREGATE | A | `createBrand`、`updateBrand`、`transitionBrandStatus`、`createEntity` |
| organization | BusinessEntityCommandReceiptService | KEEP_ADAPTER_SUPPORT | S | `execute`、`executeAuthorizationAcknowledgement`；核对 receipt 与 entity command 分离 |
| organization | BusinessEntityService | KEEP_FACADE | F | `createBrand`、`updateBrand`、`createTenant`、`updateTenant`、`createHeadCompany` |
| organization | BusinessEntityTaskReadService | KEEP_TASK_READ | T | `authorizedBrands`、`authorizedBrandsByHeadCompanyIds`、`isEnterableStore`、`requireSalesMenuStore` |
| organization | BusinessTenantService | KEEP_SINGLE_AGGREGATE | A | `createTenant`、`updateTenant`、`transitionTenantStatus`、`createEntity` |
| organization | CommercialGroupCommandReceiptService | KEEP_ADAPTER_SUPPORT | S | `execute`；核对 receipt/replay，不持有 commercial group facts |
| organization | HeadCompanyService | KEEP_SINGLE_AGGREGATE | A | `createHeadCompany`、`updateHeadCompany`、`transitionHeadCompanyStatus`、`createEntity` |
| organization | OperationsOrganizationTaskReadService | KEEP_TASK_READ | T | `brands`、`tenants`、`headCompanies`、`brand`、`tenant` |
| organization | OrganizationAssignmentCandidateService | KEEP_TASK_READ | T | `listEnabled`、`platformInvitationCandidates`、`operationsInvitationCandidates` |
| organization | OrganizationAuditHistoryService | KEEP_ADAPTER_SUPPORT | S | `read`、`readInitializationForGroupWorkspace`、`readCommercialGroup`、`readOperationsAuditProjection` |
| organization | OrganizationCommandService | KEEP_SINGLE_AGGREGATE | A | `update`、`execute`、`requireCommercialGroup`、`isEnterableCommercialGroup`；核对 organization hierarchy root 与 readback |
| organization | OrganizationGroupWorkspaceInitializationTaskReadService | KEEP_TASK_READ | T | `listInitializationFacts`、`initializationFact` |
| organization | OrganizationHierarchyCommandReceiptService | KEEP_ADAPTER_SUPPORT | S | `execute`；核对 receipt 与 hierarchy command 分离 |
| organization | OrganizationHierarchyService | KEEP_SINGLE_AGGREGATE | A | `createRegion`、`createProject`、`updateNode`、`transitionNodeStatus`；核对 logical hierarchy root、锁/CAS/readback |
| organization | OrganizationOverviewTaskReadService | KEEP_TASK_READ | T | `page`、`platformOverviewTaskPage`、`detail`、`readStoreDetail` |
| organization | OrganizationTaskPathService | KEEP_TASK_READ | T | `requireGroupTaskPath`、`requireStoreProjectCommandFacts`、`resolveCatalogCommandScopeFacts` |
| organization | OrganizationVisibilityService | KEEP_TASK_READ | T | `isVisibleDataNodeAllowed`、`listVisibleDataNodeCandidates`、`resolveSessionEntryFacts`、`describeScopeContext`；只读 visibility/session-scope policy，不承接 command/CAS/lock |
| organization | StoreCandidateTaskReadService | KEEP_TASK_READ | T | `candidatePage`、`platformContractCandidatePage`、`operationsCandidatePage` |
| organization | StoreService | KEEP_SINGLE_AGGREGATE | A | `createStore`、`updateStore`、`transitionStoreStatus`、`transitionEntityStatus` |
| platform-admin-iam | PlatformAuthenticationService | KEEP_ADAPTER_SUPPORT | S | `sendLoginOtp`、`verifyLoginOtp`、`startPasswordRecovery`、`verifyPasswordRecoveryOtp` |
| platform-admin-iam | PlatformCommandReceiptService | KEEP_ADAPTER_SUPPORT | S | `execute`；核对 receipt/replay，不持有 IAM aggregate facts |
| platform-admin-iam | PlatformIamAuditHistoryService | KEEP_ADAPTER_SUPPORT | S | `read`、`readPlatformAdmin`；核对 audit projection 与 IAM commands 分离 |
| sales-menu | SalesMenuDefinitionService | KEEP_SINGLE_AGGREGATE | A | `listMenus`、`readMenu`、`create`、`copy`、`rename` |
| sales-menu | SalesMenuItemService | KEEP_SINGLE_AGGREGATE | A | `listDraftItems`、`readDraftItem`、`listPublishedItems`、`listItemCandidates` |
| sales-menu | SalesMenuManualSaleService | KEEP_SINGLE_AGGREGATE | A | `setManualSoldOut`、`restoreManualSale`；核对 target status、audit 与 readback |
| sales-menu | SalesMenuOperationRecordService | KEEP_ADAPTER_SUPPORT | S | `listOperationRecords`、`recordRejectedOperation`；核对 operation record 不承接 menu mutation |
| sales-menu | SalesMenuOwnerService | KEEP_FACADE | F | `listMenus`、`readMenu`、`listDraftSections`、`listDraftItems`、`readDraftItem` |
| sales-menu | SalesMenuPublicationService | KEEP_SINGLE_AGGREGATE | A | `publicationPreview`、`publish`；核对 publication snapshot、CAS 与 readback |
| sales-menu | SalesMenuSectionService | KEEP_SINGLE_AGGREGATE | A | `listDraftSections`、`listPublishedSections`、`createSection`、`renameSection`、`deleteSection` |
| store-contract | ContractAuditHistoryService | KEEP_ADAPTER_SUPPORT | S | `read`、`readStoreContract`、`readOperationsAuditProjection` |
| store-contract | ContractCommandReceiptService | KEEP_ADAPTER_SUPPORT | S | `execute`；核对 receipt 与 contract command 分离 |
| store-contract | ContractCommandService | KEEP_SINGLE_AGGREGATE | A | `create`、`update`、`invalidate`、`require`、`list` |
| store-contract | ContractTaskReadService | KEEP_TASK_READ | T | `derivedStoreStatus`、`readDerivedStoreStatus`、`derivedStoreStatuses`、`candidates` |
| workspace-iam | PlatformInvitationCandidatesTaskReadService | KEEP_TASK_READ | T | `candidates`；核对 candidate projection 不写 invitation |
| workspace-iam | PlatformWorkspaceAccountTaskReadService | KEEP_TASK_READ | T | `page`、`detail`、`transitionStatusAndReadback` |
| workspace-iam | PlatformWorkspaceInvitationTaskReadService | KEEP_TASK_READ | T | `page`、`detail`；核对组合 invitation read 不承接 mutation |
| workspace-iam | WorkspaceAccountService | KEEP_SINGLE_AGGREGATE | A | `require`、`transitionStatus`、`revokeAssignment`、`revokeAssignmentForPlatform` |
| workspace-iam | WorkspaceAssignmentScopeService | KEEP_TASK_READ | T | `requireActiveScope`；只读 assignment scope lookup，不承接 command/CAS/lock |
| workspace-iam | WorkspaceAuditAuthorizationService | KEEP_ADAPTER_SUPPORT | S | `requireGroupHost`、`requireScopedHost`、`requireWorkspaceSubject` |
| workspace-iam | WorkspaceAuthenticationService | KEEP_ADAPTER_SUPPORT | S | `login`、`loginWithSessionEntry`、`sendLoginOtp`、`verifyLoginOtp` |
| workspace-iam | WorkspaceCommandAuthorizationService | KEEP_ADAPTER_SUPPORT | S | `requireUserManagementAction`、`requireUserManagementActionOnValidatedScope` |
| workspace-iam | WorkspaceIamAuditHistoryService | KEEP_ADAPTER_SUPPORT | S | `read`、`readWorkspaceRole`、`readWorkspaceAccount`、`readWorkspaceInvitation` |
| workspace-iam | WorkspaceIamCommandReceiptService | KEEP_ADAPTER_SUPPORT | S | `execute`；核对 receipt/replay 不持有 account/role facts |
| workspace-iam | WorkspaceIamSummaryReadService | KEEP_TASK_READ | T | `accountAndRoleSummary`、`accountCount`、`roleCount` |
| workspace-iam | WorkspaceInvitationService | KEEP_SINGLE_AGGREGATE | A | `create`、`createForOperations`、`managementPage`、`managementView` |
| workspace-iam | WorkspaceLoginRateLimitService | KEEP_ADAPTER_SUPPORT | S | `begin`、`beginPasswordRecovery`、`recordInvalid`、`recordSourceFailure` |
| workspace-iam | WorkspaceOperationsCommandService | KEEP_COORDINATOR | C | `createInvitation`、`cancelInvitation`、`reissueInvitation`、`revokeAssignment`；核对 workspace/workspace-iam owner command 与两侧 readback |
| workspace-iam | WorkspaceOtpRateLimitService | KEEP_ADAPTER_SUPPORT | S | `beforeSend`、`beforeVerify`、`invalidVerify`、`successfulVerify` |
| workspace-iam | WorkspacePasswordRecoveryService | KEEP_ADAPTER_SUPPORT | S | `start`、`sendOtp`、`verifyOtp`、`complete` |
| workspace-iam | WorkspacePasswordResetService | KEEP_ADAPTER_SUPPORT | S | `requestPlatform`；核对认证 support 与 account aggregate 分离 |
| workspace-iam | WorkspaceRoleService | KEEP_SINGLE_AGGREGATE | A | `create`、`createForPlatform`、`update`、`replacePermissions` |
| workspace-iam | WorkspaceTaskReadService | KEEP_TASK_READ | T | `userPage`、`userDetail`、`invitationCandidates`、`invitations` |
| workspace-iam | WorkspaceUserService | KEEP_TASK_READ | T | `resolveCurrentTaskScope`、`resolveTaskScope`、`resolveCommandTarget`；task/scope/candidate read，不承接 mutation/CAS/lock |
| workspace | PlatformWorkspaceAdministrationTaskReadService | KEEP_TASK_READ | T | `page`、`detail`、`detailAfterCommand` |
| workspace | PlatformWorkspaceAuditHistoryService | KEEP_ADAPTER_SUPPORT | S | `readGroupWorkspace`；核对 audit projection 与 workspace command 分离 |
| workspace | PlatformWorkspaceService | KEEP_COORDINATOR | C | `initializeCommercialGroup` 跨 owner 调用 organization command；`list`/`detail` 是同一服务承接的 task-read facets，不能以它们为由把整个类视为 aggregate |
| workspace | WorkspaceAdministrationService | KEEP_SINGLE_AGGREGATE | A | `create`、`list`、`require`、`requireEnabled`、`requireStatus` |
| workspace | WorkspaceCommandReceiptService | KEEP_ADAPTER_SUPPORT | S | `execute`；核对 receipt/replay 不持有 workspace aggregate |

该表的 `当前源码锚点` 是逐候选理由的最低可读入口，不是以方法名冒充 owner 证据。CP-0 必须逐行补出三项具体事实；若任一行只能写“按名称判断”或“见机制”，该行状态就是 `OPEN`，不能进入 B4–B16。

### 3.2B · 关键分类的事实基线

下表不是按名称或规模替代逐候选矩阵，而是把本轮最容易被误切的 facade、coordinator 和跨 owner 疑似项先固定为可复核的事实入口。CP-0 必须沿这些符号继续补 `command fact`、`CAS/lock target`、`authoritative readback` 三项；若源码不能证明三项属于同一根，分类不得沿用。

| 候选 | 当前已核实的事实 | 分类边界与必须补齐的证明 | 稳定源码锚点 |
| --- | --- | --- | --- |
| `CatalogOwnerService` | 实现 `CatalogOwnerApi` 与包内 `CatalogTemporaryPromotionOwner`；公开方法把请求转给 `CatalogAttributeDefinitionService`、`CatalogItemService`、`CatalogCopyService`、`CatalogWorkbenchReadService` 等目标；`JdbcTemplate` 只出现在兼容构造/wiring，facade 方法体无 JDBC execution，事务注解为零 | `KEEP_FACADE`；保留 FQCN、两个接口和 constructor 形态，目标 bean 承接 Catalog owner facts；逐消费者证明无业务事实被 facade 截留 | `CatalogOwnerService::<constructor>`、`readInventoryDisplayFacts`、`createCatalogItem`、`CatalogTemporaryPromotionOwner` |
| `InventoryOwnerService` | 实现 `InventoryOwnerApi`；把 availability、target、lifecycle、BOM、copy、read/command router 请求转给对应 service；`JdbcTemplate` 只用于兼容构造/wiring，facade 方法体不直接执行 JDBC，事务注解为零 | `KEEP_FACADE`；Inventory owner API 与 constructor 不变，目标 service 负责 inventory facts；逐 method family 核对 target/ref、锁/CAS 和 readback 仍由目标 owner 保持 | `InventoryOwnerService::<constructor>`、`readSalesMenuAvailability`、`write`、`executeLocalCopy` |
| `BusinessChannelOwnerService` | 实现 `BusinessChannelOwnerApi`、`BusinessChannelCommandApi`、`BusinessChannelReadApi`；公开入口在 template、channel、task-read 三类 service 间转发；`JdbcTemplate` 仅为兼容构造参数，facade 方法体无 JDBC execution，事务注解为零 | `KEEP_FACADE`；template/channel owner facts 不在 facade 形成第二份，逐消费者保留三类 API 的 FQCN 与命令回读 | `BusinessChannelOwnerService::<constructor>`、`pageTemplates`、`createTemplate`、`createChannel` |
| `BusinessEntityService` | 实现既有 organization owner/lookup interfaces；brand、tenant、head-company、store 与 entity 入口转给相应 service/read service；`JdbcTemplate` 仅在构造/wiring 兼容路径出现，facade 方法体无 JDBC execution，事务注解为零 | `KEEP_FACADE`；`ContractProblemAdvice` 与其他 owner 使用的公开类型继续由 facade 承接，嵌套异常/静态 validator 单独保留 | `BusinessEntityService::<constructor>`、`createBrand`、`createStore`、`ContractProblemAdvice` consumer |
| `SalesMenuOwnerService` | 实现 `SalesMenuOwnerApi` 与 `SalesMenuCommandApi`；公开入口委托 definition、section、item、publication、manual-sale、operation-record service；不持有 `JdbcTemplate`，事务注解为零 | `KEEP_FACADE`；保持 OwnerApi/CommandApi、constructor 与 typed readback，目标 service 承接各自 SalesMenu facts | `SalesMenuOwnerService::<constructor>`、`listMenus`、`publish`、`setManualSoldOut` |
| `CatalogInventoryCoordinator` | 同时持有 `CatalogOwnerApi`、`InventoryOwnerApi`、`ProductionTagOwnerApi`、asset command/read 依赖；组合 `readCatalog*` 与 temporary-promotion 等跨 owner 调用；不持有 `JdbcTemplate`，其事务入口是组合操作而非单 owner SQL execution | `KEEP_COORDINATOR`；不得塞进 Catalog 或 Inventory 聚合；必须逐方法证明调用方向、外层事务、跨 owner readback 和失败回滚 | `CatalogInventoryCoordinator::<constructor>`、`readCatalogWorkbenchContext`、`executeTemporaryCatalogItemPromotion` |
| `WorkspaceOperationsCommandService` | 实现 `WorkspaceOperationsCommandApi`；四个 `REQUIRED` command 入口组合 `WorkspaceInvitationService`、`WorkspaceAccountService`、`WorkspaceUserService` 与 organization task-path lookup；不持有 `JdbcTemplate` | `KEEP_COORDINATOR`；workspace/workspace-iam 两侧 command 与 session/target/readback 不能被误归为单一聚合；必须保留外层 `REQUIRED` 和失败回滚证明 | `WorkspaceOperationsCommandService::<constructor>`、`createInvitation`、`cancelInvitation`、`reissueInvitation`、`revokeAssignment` |
| `InventoryCatalogLifecycleService` | `@Service` 直接持有 `JdbcTemplate`，在 `inventory.stock_target`、`inventory.stock_ledger`、`inventory.stock_bom` 上执行 lifecycle dependency/lock/readback；公开命令和只读依赖方法返回 Inventory owner readback；源码中的 Catalog 名称表示校验输入与 scope，不单独证明跨 owner fact | 初始 `KEEP_SINGLE_AGGREGATE` 只有在 CP-0 证明 lifecycle command 的 CAS/lock target 与 authoritative readback 均属于 Inventory lifecycle 根后才成立；若事实跨根，改 `OPEN`，不按类名维持 | `InventoryCatalogLifecycleService::<constructor>`、`validateCatalogUnitLifecycle`、`validateCatalogItemBaseMeasureUnitTransition`、`catalogItemVoidDependencies` |
| `OrganizationHierarchyService` | Javadoc 明确 commercial group 是 logical root，只有 REGION/PROJECT 是其 organization descendants；实现 hierarchy lookup 与 command API，并在 create/update/status transition 上维护节点事实、receipt 与 readback | `KEEP_SINGLE_AGGREGATE`；region/project 共享 hierarchy root 的结论必须由 command fact、lock/CAS 与 readback 矩阵复核，不按 38 个事务入口或类名决定 | `OrganizationHierarchyService` class Javadoc、`createRegion`、`createProject`、`updateNode`、`transitionNodeStatus` |

### 3.3 四张矩阵

1. 候选/产物矩阵：类、当前 owner、facade、聚合根、目标类/包、保留公开面、SQL/execution 是否另行归位。
2. 调用方矩阵：controller、其它 owner、coordinator、test、Spring constructor injection、static/FQCN、package-private 接口；每项标保持/修改/不应修改。
3. 事务与持久化矩阵：execution point、method family、fragment source、sink、事务属性、self-call/outer transaction、lock/CAS/idempotency/audit/readback、目标 persistence 类和 proof。
4. 测试覆盖矩阵：真实 fixture、动作、正/负 business oracle、写后 readback、风险维度、现有覆盖、缺口、补测 CP、状态。

矩阵不按每个 private helper 无条件展开。只有改变 SQL 数据流、事务边界、锁/回执/readback 或 caller observable behavior 的 helper 单独成行，其余归入 method family 并保留引用关系。

## 4. SQL fragment 唯一提取口径

### 4.1 分母与 sink

- B3 扫描 13 个业务 module 的 api/application/domain Java source；B4–B16 同时扫描 application/domain/persistence/infrastructure/adapter。
- 先 Java lexical token 化，不在原始源码上用大小写不敏感 substring 判定。
- sink 至少包括当前实际确认的 query、queryForObject、queryForList、update、batchUpdate、execute 及真实 repository 的 insert/delete/save/find/read/write；方法名只有在 receiver 类型和调用边界确认后才算 sink。跨 application/domain 与 persistence 的 public sink 边界必须是具名、类型化的业务方法；“具名、类型化”不只是把 `String sql` 改名或包进 record，public 参数不得承载 SQL 文本/fragment（例如 `whereFragment`、`orderFragment` 或 SQL wrapper），也不得暴露 `RowMapper` 加可变参数的 generic executor；只能接收读侧 filter、sort、page、target，以及写侧聚合、命令对象、字段值等业务级参数。`query(String sql, RowMapper<T>, Object...)`、`update(String sql, Object...)` 等 raw-SQL 透传不是可接受的最终 execution 形态，必须在所属 module 批次改为业务参数方法。persistence 内部 private helper 可保留 SQL 字符串处理，但不得通过 public 接口暴露。

  M-01 的判定重点是“查询事实是否由 persistence 方法拥有”，不是“JDBC 调用是否已经落在 persistence 包”：只移动实现类或只移动常量，仍会把查询选择和 SQL 组装留在 application，不能关闭该不变量。

  条件选择和组合同样属于查询事实：即使方法名是 `findItems`，也不得接收 `whereFragment`、`orderFragment` 或等价 SQL wrapper；最终只能接收读侧业务级筛选、排序、分页和目标参数，或写侧聚合、命令对象、字段值等业务级参数，并由 persistence 内部完成组合。该限制按参数承载的语义而非 Java 类型判断：业务 `String` 值可以传入，但 SQL 语法或片段不能借业务字段名换皮。
- source 片段和执行 sink 必须按完整表达式数据流相连；孤立词命中不算 SQL source。

### 4.2 lexical normalization

提取器必须：

1. 识别普通 string literal 和 text block，按 Java escape 得到运行时值；
2. 去除 line/block comment，不把 comment 内 SQL 当 source；
3. 保留 string 内空格、换行、转义解码结果和片段顺序；
4. 识别 `+`、括号和同 module 纯常量持有类内的 `static final String` 常量表达式引用；helper return、跨方法或其它未支持数据流必须记录为 unknown；
5. 记录稳定的 execution-point id、表达式路径、unresolved branch；source line 只作为诊断信息，不作为前后对账键；
6. 不用 token 命中数作为完成判据。

### 4.3 已裁定的最小支持集与显式 unknown

按 M-06-A，B1/B3 的提取器只使用仓内既有 Node/TypeScript 运行时和标准库，必须可靠支持以下最小集合：

- 普通 Java string 与 text block 的词法语义，包括缩进剥离、反斜杠续行、转义解码、escaped quote/newline、Unicode/Java escape、注释剔除；
- `+` 与括号造成的片段连接、AND/OR 续接、跨行拼接；
- 同 module 纯常量持有类中由字符串 literal 与同一持有类内其它已解析的 `static final String` 常量组成的 Java constant expression 引用求值；方法调用、instance field、条件选择、builder、format/join、不同常量持有类之间的引用和跨 module 引用均属于 tier 2；
- SQL relation scope：physical base relation、physical table alias、CTE（含 `AS MATERIALIZED`）、derived table 及其 alias。`SELECT *` 对 physical base relation/alias 判红，对 CTE/derived relation 判绿；
- 跨 module 的 coordinator/task-read 不得导入 peer module 的 SQL 常量或拼接跨 module 碎片；若确需一条跨 module task-read SQL，整条语句归属于已明确拥有该 task-read/use-case 的 module persistence。没有既定 owner 时输出 unknown 并保持 OPEN，不能让 extractor 自行替 coordinator 选择 owner；
- sink 参数位置只作为 execution-point 识别与后续 capture 的关联信息，不以方法名 token 代替 receiver/type 边界。

以下构造明确属于 tier 2，提取器必须输出 `UNRESOLVED_SQL_CONSTRUCTION` 或 `UNRESOLVED_BRANCH`，不得凭字符串命中猜出最终值：`replace` 占位符、`StringBuilder.append/toString`、`String.format`、`String.join`、helper method return、条件运算、if/switch 选择、跨方法链、非纯字段引用以及其它未解析 wrapper。仓内真实反例 `CatalogSkuMediaFacts` 的条件 fragment：

    String scope = condition ? "" : " AND item.data_node_ref=? AND item.brand_ref=?";

不能因为不含旧词表的 `SELECT`/`FROM`/`WHERE`/`JOIN` 等词而漏掉；它应被识别为 SQL 构造并因条件选择进入显式 unknown 处置，而不是静默忽略。

无法可靠判断 relation 来源时输出 `SELECT_STAR_UNRESOLVED`。每条 unknown 必须列出文件、表达式、sink、branch、原因和证明方式；只有 capture 或完整数据流 review 关闭后才能 MATCHED。

### 4.4 解析能力决策与 unknown 处置

需求要求的构造分成两档，不能把“能找到字符串”冒充“能求出最终值”：

1. **已批准的 lexical/minimal data-flow 档**：使用 §4.3 的最小支持集，尤其必须跟随同 module persistence 纯常量引用，给出确定的 fragment graph；
2. **tier 2 unknown 档**：helper return、跨字段/跨方法引用、builder、format/join、条件选择、跨方法链和未解析 wrapper 先输出显式 unknown，再由该 execution point 的 effective-SQL capture 或完整数据流 review 闭合。未闭合项不得让 B3 宣称全量完成。

M-06 已由 Dexter 裁定为 A。这里的 A 不是通用 AST 或全量 data-flow parser：只实现 §4.3 的 bounded minimal support set，不引入第三方 parser/framework；每个不支持构造都必须输出明确类别和处置记录，达到“无法闭合即 STOP”的阈值。

M-06-B 的反例必须保留在设计中：若只支持同表达式、不支持同 module persistence 常量引用，那么 B3 将把 `CatalogItemService` 的 CTE `item_scope` 与最终 paged projection 迁入 persistence 常量，application sink 变成跨文件 `A + runtime predicate + B`；合法的 CTE/最终投影会普遍输出 `SELECT_STAR_UNRESOLVED`，导致 B3 对目标形态自身 fail-closed。因此 B 不能与本 delivery unit 的 A1/B3 序列共存。

反射、资源/注解生成、外部配置、未解析 alias/field/helper、不可确定的 builder/format/join、未知 wrapper 或同时可能是文案与 SQL 的 literal，均输出 unknown 清单。清单列出文件、行、表达式、原因、sink 和证明方式；未闭合时按需求 §15 停止并报告 Dexter。

### 4.5 B3 产物

每 module persistence 的纯常量类：
- 只有 static final String 和类级说明；每个 initializer 只能是字符串 literal 或同一持有类内其它已解析 `static final String` 常量组成的 Java constant expression；常量之间的这种链式拼接属于 §4.3 的 tier 1，方法调用、instance field、条件逻辑、builder、format/join、不同持有类引用或其它非 constant expression 必须进入 tier 2 unknown；
- 无 Spring/JDBC/repository import；
- 无 bean 注解、方法、builder、条件逻辑或执行；
- **B3 过渡条款**：B3 只搬文本而不改 execution 时，动态条件选择/组合暂留当前调用方，但只能选择/组合 persistence 中已声明的片段；这不是最终目标，也不构成 public persistence boundary 的例外。所属 execution 批次必须把条件选择/组合一并移入 persistence，并将 fragment 参数替换为读侧 filter、sort、page、target，或写侧聚合/命令对象/字段值等业务级参数。最终 application/domain 不得保留参与 SQL 构造的 literal 或 fragment 参数。每个 execution point 的 fragment graph 必须在 B1 支持集内可解析，或已按 §4.4 的 unknown 处置闭合，否则进入 STOP。
- “唯一常量地址”是**按 module、owner 和 execution point 归属**的唯一地址，不是按文本内容跨 owner 去重；相同 SQL 文本若属于不同 owner/method family，必须各自持有，不能建立跨 owner 共享常量而让一方的修改静默影响另一方。
- B3 不得把一条 statement 的 CTE 定义和最终 projection 拆成 B1 无法解析的两个孤立常量；B1 必须能跟随同 module persistence 纯常量引用。若动态条件超出 §4.3 支持集，该 execution point 必须进入显式 unknown，未能由 capture 或完整数据流 review 闭合时 STOP。
- 命名表达 owner 事实/查询用途，禁止 Part1、Helpers、MiscSql；
- B3 逐 execution point 比较 receiver、method、argument order、parameter expression、事务注解和 TransactionTemplate；任一变化升级到 B4–B16 的完整 R-READ-03/R-READ-05 proof。B3 写入后必须再次执行 query-boundaries 的相同 fragment/relation 解析，不能让 B3 自己把 B1 已接线门变成 fail-closed 的假红。

## 5. Effective SQL 等价证明

本详设把 runtime capture comparison 作为 effective SQL 的首选证据；M-06 已裁定采用 §4.3 的 bounded minimal support set，capture 仍用于验证无法仅靠提取器证明的 tier 2 构造。capture 直接验证真实 sink 收到的最终值，不能替代 source enumeration，也不能覆盖未执行 branch 或同形参数互换。

### 5.1 capture 记录

每个 CP-0 execution point 使用在 B3 前建立、随后携带的稳定逻辑 key：
    module / owner-class / method-family / execution-point-id / sink-kind / invocation-ordinal / branch-case-id
其中 `execution-point-id` 由 CP-0 的 owner/method-family/sink-kind/原始调用序号生成；`branch-case-id` 由同一 execution point 的源码可达条件组合生成。二者都不含 source line、文件相对位置或临时类名。B3/B4–B16 移动代码时沿用该 id，不能因文件或行号变化新造 key。key 只用于 proof 关联，不进入 production runtime、HTTP operation 或模型。测试/证明辅助层记录：
- key；
- effective SQL 完整字符串，不记录 bind 敏感值；
- fragment 展开顺序；
- bind parameter positional shape、数量、顺序、类型类别；
- parameter expression/slot mapping（捕获不能看出同类型参数互换，必须保留这个独立证据）；
- branch case id；
- transaction callback/readback 标志。

### 5.2 前后采集

- 每 module B3 第一次写入前先做 before capture；同一 capture 也作为该 module 的前一步 baseline；
- 同一 fixture、输入、数据准备顺序在 B3 写入后做 after capture；
- B4–B16 每个 module 在执行移动前，对 B3 后字节做 before capture，移动后对同一输入做 after capture；effective SQL 等价证明覆盖 B3 以及全部 B4–B16，不得只证明 B3；
- 按 key 对齐，SQL 字符串、fragment 顺序、parameter shape 必须完全一致；
- parameter expression/slot mapping 也必须一致；同形参数交换不是仅靠 SQL 字符串 capture 可见的，必须由该映射和 focused 行为 proof 共同关闭；
- 缺 key、多 key、顺序变化、未执行 branch 或 unresolved branch 都是 OPEN；
- 证据是当前 CP proof，不建 hash-chain/incremental receipt；
- 无法捕获的点必须做完整源码 data-flow proof；两者都不能做时 STOP。

普通业务 oracle 只是补充。`BASE_SQL + WHERE item_ref=?` 改为 `BASE_SQL + WHERE status=?`，在单行 fixture 可能仍返回同样对象，所以业务测试不能单独证明 SQL 等价。Capture 也必须覆盖 `CatalogSkuMediaFacts` 这类条件 fragment、`AS MATERIALIZED` CTE、text block 反斜杠续行和 helper 返回值；不能只捕获一条 happy branch。

### 5.3 Branch matrix 的机械产出

CP-0 从已解析的 SQL 控制流而不是文档手填数字生成 branch cases：为每个 execution point 收集实际的条件/`if`/`switch`/cursor/page/value 分支，计算可达组合，给每个组合稳定的 `branch-case-id`，并记录 fixture 输入如何使该组合实际执行。比如某个 execution point 同时有 usage 三值、cycleBlocked 两值和 cursor 有无两值，应产生 12 个组合；12 不是冻结分母，只是说明“不能只跑一条 happy path”的形态。

每个 branch case 都必须出现在 before/after capture；未执行、不可达性无法由源码证明、或受 M-06-A 未覆盖的数据流影响的 case，全部进入 `UNRESOLVED_BRANCH`，不能被一次成功 capture 抵销。`CatalogSkuMediaFacts` 的条件 `scope` 必须至少覆盖 true/false 两条输入。B3/B4–B16 在 branch matrix 未闭合前不得报 MATCHED；若 tier 2 unknown 无法通过 capture 或逐项 review 闭合，按 STOP 报告 Dexter。

## 6. query-boundaries 与 SELECT star

### 6.1 实际接线

当前 source 在 tools/verify-gates/verify.mjs 和 tools/verify-gates/cli.mjs，外层入口是 scripts/verify。B1：
- 将 scripts/check/query-boundaries 加入 verify.mjs 的实际 static command sequence，条目 label 固定为 `query-boundaries`，不使用已退役的 `database-operation-budget` label；
- checker 在全项通过时输出唯一稳定 gate marker `R4_DATABASE_QUERY_BOUNDARIES=PASS`；该 marker 是 verify.mjs 的 expected marker。其它诊断行不得被当成 gate marker，也不得以旧的 compatibility whitelist 输出冒充通过；
- 以真实执行序列和 expected marker 证明执行，不以源码字符串存在替代；
- 不新增 skip/compatibility path，sequence 条目一律执行并核 marker。

### 6.2 方案 A 的先决验证

项二继续走方案 A，但先把门自测从 Java comment 改为真实 Java string。B1 必须证明：
- SELECT * FROM physical_table 或等价 base relation：红；
- WITH cte AS (...) SELECT * FROM cte：绿；
- SELECT derived_alias.* FROM (SELECT ...) AS derived_alias：绿；
- alias 只有在解析到 CTE/derived relation 时绿；physical table alias 仍红；
- comment 不产生 SQL 命中，也不能替代 red fixture；
- text block、escaped string、跨片段与现有 source enumeration 一致。

解析器要处理 §4.3 支持集内的 CTE 名、`AS MATERIALIZED`、derived alias 与 base relation alias；超出该 relation scope 的 nested/compound 形态必须输出 `SELECT_STAR_UNRESOLVED` 并 fail closed/进入 review，不能当绿。门自己的 self-test 必须以真实 Java string/text block 作为 mutation，不能用 comment 自指。

### 6.3 path exemption closure

删除 compatibilitySelectStarPaths 及集合相等断言。cli.mjs 及其所有本地 imported helper 的闭包内：
- 禁止由 source path 派生的 Set、array、switch、regex、endsWith/contains/startsWith 或等价分支；
- path 只能用于枚举、错误定位和报告，不能改变 verdict；
- 不用“某标识符零引用”作为证明；
- 真实 physical table SELECT * mutation 逐一放入 9 个历史 whitelist path（包含 `apps/backend/catering-business-server/modules/foundation/src/test/java/com/catering/v2s/platform/foundation/persistence/DatabaseOperationTrackerTest.java`），再放入一个新路径，10 处都必须红；
- mutation 是 Java string/text block，不是 comment；
- imported helper 中的豁免也必须被 mutation 变红。

### 6.4 三个超白名单文件与测试夹具

B1 先处置 `CatalogItemService`、`CatalogWorkbenchReadService`、`InventoryBomService` 这三个当前超白名单的 module 主源文件。物理 base table star 不通过搬 helper 或路径判断隐藏；合法 CTE/derived/解析后的 alias 保留并由 fixture 证明；无法解析的 SQL 标 OPEN，不删查询不伪造 CTE。

历史白名单本身还包含 `apps/backend/catering-business-server/modules/foundation/src/test/java/com/catering/v2s/platform/foundation/persistence/DatabaseOperationTrackerTest.java`。它当前 `distinguishesNPlusOneFromRedundantParameters` 的测试字符串为 `select * from item where id = ?`，测试源不在本批排除范围。删白名单前应把该测试题面改成显式列（例如 `select id from item where id = ?`），并保持 `N_PLUS_ONE` 断言；随后仍要在 scratch mutation 中把真实 physical `SELECT *` 逐一注入该路径，证明路径不再改变 verdict。

### 6.5 失败转向

若不能同时满足 physical red、CTE/alias/derived green、comment 规则和 9+1 mutation 全红，按需求 §15 停止项二并报告 Dexter，转方案 B；不把方案 A 的部分改动报作完成。

### 6.6 B1 的真实执行顺序与自测错误码

`tools/verify-gates/cli.mjs` 当前 `selfTest` 在 `prepareSelfTestClean` 后先执行一次 clean action，再用通用 `catch` 判断 mutation 是否变红。该顺序不能直接照搬：旧 whitelist 下的当前 source 不是 clean，且“任意异常”不能证明是 SELECT-star 规则命中。

B1 实施顺序固定为：先在同一个变更组完成新 relation 判定、删除 path whitelist，并先处置三个当前超白名单主源与 `DatabaseOperationTrackerTest` 的物理 `SELECT *` 测试题面；确认生产 source 在新判据下可 clean 后，才运行 clean action。随后对 mutation 运行 `budget --self-test`，必须断言异常中包含固定规则码 `R4_DATABASE_SELECT_STAR`，而不是只断言 `red=true`；命中 `R4_DATABASE_LOOP_IO` 等其它规则时 self-test 必须失败。全程不得加入临时 path exemption。

## 7. 写路径禁令

B1 修改 tools/verify-gates/cli.mjs 的 R4_BACKEND_WRITE_PATH_EXTERNAL_OR_EVENT_CHAIN 分母，保留 application/domain 并加入 persistence/infrastructure/adapter。

分别建立三个独立 checker fixture：
- persistence/ 的 RestTemplate；
- infrastructure/ 的 RestTemplate；
- adapter/ 的 RestTemplate。

三条各自运行且各自红。B3 后确认各 module persistence 仍由同一门覆盖。交付明确保留约 119 个 module 主源文件在该分母外、约 43 个无层段的 known gap；不得宣称五段完整。JDBC 文件数量不证明该门完整。

## 8. Backend acceptance structure

B1 修改 scripts/test/backend-acceptance-structure.test.mjs，并只为 registry 表达真实 source 全集而调整必要 acceptance catalog source。

- 从 acceptance 目录枚举所有 *Scenarios.java，解析顶层类名，不再硬编码 6 个文件。
- 含至少一个 `@AcceptanceScenario` 的 source file 必须由 `BackendAcceptanceScenarioCatalog.discover()` 的 group registry 表示，且其注解方法进入 business definitions；零注解 source file 不进入 business denominator。
- 零注解的 `*Scenarios.java` 按**通用结构规则**处理：structure test 解析其顶层 class name，并要求某个 acceptance host 的显式 `@Test` 方法引用该 class；不按 `P2ReadConnectionScopeScenarios`、`p2ReadConnectionScopeProof` 或任何业务名字写特例。当前 P2 保持 final/static helper 形态，由 `BackendAcceptanceTest.p2ReadConnectionScopeProof` 的类型引用满足该规则。该 helper consumer test 必须无条件可执行；若使用 `EnabledIfEnvironmentVariable` 等条件注解，允许作为显式例外，但同一位置必须声明启用条件、默认状态及本 proof 的显式启用方式；默认禁用且本 proof 未显式启用的测试不能伪装成可执行 proof。
- structure test 比较 source file 全集与两类表示（business group 或显式 helper consumer）；业务 group 至少有一个 `AcceptanceScenario`，helper 必须有真实 `@Test` consumer。这个规则不需要给 P2 造构造器、group object 或修改其静态工具类形态。
- 临时新建带 `@AcceptanceScenario` 但未登记的 `*Scenarios.java`，以及新建零注解但没有显式 acceptance consumer 的 `*Scenarios.java`，都必须红；恢复关系后绿。
- 不切分既有 acceptance 文件、不把 P2 或 performance coverage 伪装成业务场景。

## 9. Backend vocabulary

B1 在 doc/platform/backend-coding-standard.md §2 的 review-only 内容补四段：
- api：对外/模块内解析入口、DTO/edge boundary；
- application：owner 编排、命令入口、task-read 组合和业务流程；
- domain：纯业务规则和值对象，无 Spring/JDBC/事务基础设施依赖；
- persistence：SQL 文本和 persistence execution 的 owner 段，不拥有跨 owner 业务事实。

infrastructure/adapter 是已有技术接入/support 段，不被混成四段业务词表的聚合。

条目必须写适用范围、不授权事项、每段反例、platform library 与 package-root boundary class 的 review-only 处置、R-READ-08 unknown/全集纪律、后续新增文件的 reviewer 判断。明确不建机器门。

## 10. Frontend B2

B2 只拆三个文件，不新增用户路径。foundation primitive、RTK API、文案、testId、权限和生命周期不变。

### 10.1 catalogModel

保留 features/catalog-management/model/catalogModel.ts 作为薄 barrel；新增 model/catalog/：
- catalogTypes.ts；
- catalogLifecycle.ts；
- catalogItemModel.ts；
- catalogCopyModel.ts；
- catalogValidation.ts；
- catalogModel.ts 只 re-export。

依赖方向为 generated wire → types → pure model/validation → barrel；不得导入 React、RTK hook、HTTP transport 或组件，不得循环。既有 consumer 继续从旧 barrel import，避免无意义全仓 import 重写。

### 10.2 CatalogDictionaryDrawerState

新建 ui/dictionary/：
- CatalogDictionaryDrawerState.tsx：controller、open/close、dirty guard、query context、permission、readback；
- CatalogDictionaryDrawerView.tsx：presentational sections；
- catalogDictionaryDrawerModel.ts：labels、row/status presentation 和 pure control state；
- index.ts：公开导出。

CatalogDictionaryDrawer.tsx 改从 dictionary 子目录导入；CatalogDictionaryDrawerState.test.ts、CatalogItemDrawer.test.tsx 更新真实 owner path。root ui 不保留同名实现 wrapper，确保顶层文件数下降。

### 10.3 LocalCatalogCopyDrawer

新建 ui/local-copy/：
- LocalCatalogCopyDrawer.tsx：controller、lifecycle、step state、command coordination；
- LocalCatalogCopyView.tsx：step/form/preview render；
- localCatalogCopyModel.ts：copyScopeTabKey、scope dependency、label/shape/preview 纯逻辑；
- index.ts：公开 Drawer 与 copyScopeTabKey。

更新 CatalogWorkbenchTaskSurfaces.tsx、CatalogManagementPage.test.tsx、static-boundary.test.mjs 和 user-visible-copy test 的真实路径。另将已接线且按仓根路径读取 target 的三个测试纳入同步：`scripts/test/catalog-inventory-query-envelope.test.mjs`、`scripts/test/frontend-idempotency-boundary.test.mjs`、`scripts/test/frontend-transport-cache-lifecycle.test.mjs`；逐处把原文件的正向与 `doesNotMatch` 断言扩展到拆出后的真实文件集合，特别是拼接多个源再断言的 static-boundary 形态。保留 catalogModel barrel import。

### 10.4 B2 行为钉住

动任一 React 文件前补真实 mount、unmount、re-open、dirty input、discard/continue、query context reset、pending/error/readback fixture。每个 Drawer 至少正向和负向 business oracle，断言状态生命周期与用户可见结果；组件存在性不算。

sales-menu.spec.ts 和 catalog-inventory.spec.ts 保持绿，但不视为 state lifecycle 缺口已关闭。使用现有 useDrawerFormLifecycle、useCursorCandidates 等 foundation；不新增 testId/L2 case。新文件必须进职责子目录，禁止 Part1、Helpers、SalesMenuPage2。主判据是 root ui 不保留同名实现 wrapper、全部 consumer/正向与 `doesNotMatch` 断言仍覆盖真实 owning files；root 顶层文件数下降只是辅助方向观察，不能单独关闭 B2。

## 11. B1–B16 批次设计

### 11.1 排序 metric

旧需求数字不作分母。CP-0 首次生产写入前重测两个独立量纲：

- `transactionAnnotationCount`：该 module 主源 Java 中当前确认属于候选范围的 `@Transactional` 注解数；
- `directPersistenceInvocationCount`：receiver 类型已确认属于 JDBC/repository 且 method 属于已确认 sink 的直接调用数。

注释、string/text block、generated/build 产物剔除；receiver 或 sink 不能可靠确认时标 `UNVERIFIED_REQUIRES_EVIDENCE` 并人工复核。排序键是 `(transactionAnnotationCount, directPersistenceInvocationCount, moduleName)`，不把两个不同量纲相加。事务复杂度优先，因为 B4–B16 首要风险是代理/传播边界；direct invocation 只在事务量相同的 module 间决定次序。

该 metric 只决定先后，不证明拆分完成、业务覆盖或事务正确性；receiver/sink 无法可靠判定时标 UNVERIFIED_REQUIRES_EVIDENCE 并人工复核，不用宽 regex。

当前只读预览（B4 前必须重测）：

| 顺序 | module | tx | direct |
| ---: | --- | ---: | ---: |
| 1 | fulfillment-production | 14 | 17 |
| 2 | extension | 15 | 13 |
| 3 | collaboration | 18 | 22 |
| 4 | sales-menu | 18 | 143 |
| 5 | workspace | 19 | 13 |
| 6 | business-channel | 20 | 31 |
| 7 | asset | 21 | 31 |
| 8 | platform-admin-iam | 38 | 67 |
| 9 | store-contract | 43 | 39 |
| 10 | inventory | 44 | 89 |
| 11 | catalog | 52 | 277 |
| 12 | workspace-iam | 110 | 130 |
| 13 | organization | 145 | 143 |

若重测顺序变化，在 B4 前更新计划的 execution record；不改变 13 个 module 范围，也不把预览数字当 acceptance denominator。该排序只表达实施风险次序，不表示“规模越小越优先”，也不替代任何行为或等价证明。

### 11.2 B1

控制面修复：项二、项三、项六 structure gate、项七 vocabulary 正本。完成 red fixtures、实际 verify 接线、P2 registry 处理与 review-only standard 修改；静态/focused 收口后进入 B2。B1 不执行全量 acceptance。

### 11.3 B2

完成三个 frontend target 的子目录拆分和既有 import/path 更新。先补两个 Drawer 的行为钉住，再改结构；model 保持纯函数。focused 类型/测试和步骤级三维对账通过后进入 B3。

### 11.4 B3

13 个 module 一批建立 persistence 段和纯 SQL constants；不搬 execution，不改变 transaction topology。每个 module 即使无 SQL 也出 NO_SQL_SOURCE 记录；完成每个 execution point 的 before/after effective SQL capture 和逐文件 diff。任何未知或边界变化 OPEN。

### 11.5 B4–B16

按 11.1 的重测顺序一次处理一个 module。每批依次：重读材料与 memory → 四矩阵 → 行为缺口 → focused fixture/oracle → execution 移动 → self-call/代理/事务/锁/幂等/回滚/readback proof → compile/既有 tests → fresh independent 3D reconciliation。只有 MATCHED 能进入下一批。KEEP 类不能静默跳过 SQL sink；coordinator 不得塞入业务 aggregate。

### 11.5A · M-08 已裁定：三个既有技术段文件归位

当前字节中的三个被需求项一明确点名的文件是：

- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/infrastructure/SalesMenuRepository.java`；
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/infrastructure/JdbcSalesMenuRepository.java`；
- `apps/backend/catering-business-server/modules/workspace/src/main/java/com/catering/v2s/platform/workspace/adapter/JdbcGroupWorkspaceRepository.java`。

Dexter 已裁定采用归位分支：B3 把这三个文件的 SQL 文本纳入所属 module 的 persistence constants；execution 在 CP-0 按统一排序确定的所属 module 批次迁入 persistence execution，并同步补齐 bean/constructor、caller、事务与 readback 矩阵。保留 infrastructure/adapter 的写路径扫描分母和回流哨兵，不把它们保留为本批 execution target。

该裁定与目标形态一致：`SalesMenuRepository.java` 是当前 sales-menu 的公开 persistence boundary，`JdbcSalesMenuRepository.java` 与 `JdbcGroupWorkspaceRepository.java` 是其 JDBC 实现；具体方法和调用点以 CP-0 当前字节矩阵为准。迁移后这些业务执行段不再留在 infrastructure/adapter，四段业务词表只保留已授权的两个技术支持例外，不得新增同类例外或用扫描覆盖冒充归位。

M-01 的最终形态同时适用于这三个文件：`SalesMenuRepository` 不得继续暴露 raw-SQL `query/update` public 透传，也不得以 `whereFragment`、`orderFragment` 或 SQL wrapper 等参数换皮；sales-menu application 对它的调用必须改为只接收读侧 filter、sort、page、target，或写侧聚合、命令对象、字段值等业务级参数、由 persistence 内部完成条件选择/组合的具名方法。`JdbcGroupWorkspaceRepository` 当前已经是具名 `list`/`detail`，仍须按同一边界迁入所属 persistence execution。CP-0 必须盘点 13 个 module 是否还有其它 public raw-SQL 透传、SQL fragment 参数或包装形态；若协调器需要跨 module task-read SQL，不能导入 peer module 的 SQL 常量或让协调器拼接碎片，整条语句归属于已明确拥有该 task-read/use-case 的 module persistence；若没有既定 owner，保持 OPEN 并报告 Dexter。

这条规则的理由是：泛型透传给了执行一个位置，却没有给查询归属；若 sales-menu 保留这种形态，就会与其它 module 的具名 persistence 方法形成长期双轨，正好抵消本批要建立的可读性边界。范围成本由一个 module 的一个 execution 批次承接，独立三倍 cost baseline 只作为报告触发条件；成本或发现新 owner 歧义都不能由实施者自行缩小范围或保留例外。

### 11.6 B16 后

先做全范围逐条三维对账，不能用 CP 对账汇总替代；再执行唯一一次全量 backend acceptance。run 必须晚于所有 production/test code 改动，operation=all，CONTRACT、真实 BUSINESS、信息性 DB_OPERATIONS、cleanup 分开报告，businessMode=REAL，budget verifier 独立。不得与不存在的旧 baseline 比较。使用受管 remote Java/DB/object storage、local Vite/Playwright/HTTP-asset tunnel；本阶段不执行。

## 12. 固定机制与证明映射

| 机制 | 本批处理 |
| --- | --- |
| 读侧节点授权 | 无新增 HTTP/读接口，保留 owner/session scope |
| 写授权与 grant 复核 | 无业务语义变化，保留原 command/recheck |
| 跨 owner 写与事务 | 不新增，保留 REQUIRED/call order |
| 集合与分页 | 不变 |
| cache invalidation | 不改变调用顺序 |
| RTK data | 不新增，保留 generated RTK |
| single fact address | SQL literal 按 module/owner/execution point 各自有唯一常量地址；M-08 三个点名技术段按裁定落 persistence，业务事实仍归 owner |
| failure visible | 原 typed problem、错误码和文案不改 |
| owner error mapping | 保留 advice/FQCN |
| idempotency | 保留 receipt/replay/conflict |
| generated not hand strings | 不改 contract/generated |
| logging/redaction | 使用现有结构化诊断，proof 不记录敏感 bind values |
| migration/seed | N/A |
| frontend shared behavior | 对接 admin-ui-foundation，不复制 primitive |
| candidate/data source | matrix 记录 source→sink，不扩大 API |
| naming | 按职责命名 |
| atomic group | 每 CP 可回滚小变更组，OPEN 不带入下一批 |

## 13. 测试、对账与 stop

### 13.1 Evidence tiers

static 只证明源码/结构/门；focused 证明指定行为和 SQL capture；backend acceptance 证明整套 remote business；cleanup 单独判读。任何 tier 不升级为另一 tier。

### 13.2 每 CP 必须交付

- 四矩阵当前结果；
- 同一输入前读、写入、focused proof、同一输入后读；
- changed source/consumer/transaction/readback 对账；
- 独立 reviewer 的三维结果，仅 MATCHED 或 OPEN；
- OPEN 的根因、修复和复查。

### 13.3 STOP

以下任一发生即停在当前 CP 报告 Dexter：extractor 无法完整清单且 capture/data-flow 不能闭合；SELECT star A 的四类形态或 9+1 mutation 不全；B3 SQL/receiver/参数/事务变化；B4 代理/传播/锁/幂等/回滚/readback 变化且不能证明等价；三维对账 OPEN；编译/既有测试失败不能在范围内根治；出现新依赖、契约、迁移、surface 或跨 owner 语义；成本达该批基线三倍；任一 execution point 的条件选择/组合无法在不引入 SQL fragment 参数的前提下移入 persistence。

实施者不得自行改写 §14 裁定、缩小范围报完成或扩大范围；停止/推迟/缩小由 Dexter 决定。

### 13.4 成本

每批第一次写入前记录成本单位、估算时点、记录位置。建议成本单位为改动文件数 + 新增/补齐行为 fixture 数 + unresolved item 数。三倍只触发报告，不是机器门；批次间不复用基线。

## 14. 交付前逐代码与详设对账

- 逐个变更点重开需求、本文、实施计划、六维 memory、coding/review standard 和 owning source；
- 记录改动文件、类/函数、包路径、公开面、事务、SQL source/sink、测试、门输出、frontend import path；
- 结果仅 MATCHED 或 OPEN；
- OPEN 必须根因修复并由 fresh reviewer 复查；
- 不使用 hash-chain、旧 receipt、旧 run 或文档存在性冒充对账。
## 15. 模板必填补充：横切机制逐步对照

下表把每个固定机制绑定到精确正本/符号、最低可执行观察和完整适用 CP。N/A 只用于本批确实不消费该机制的维度，并写出理由。

| 机制 | ① 现成能力/正本 | ② 最低可执行观察 | ③ 无现成能力时的形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | AGENTS.md 的 x-consumer-faces；本批无新增 HTTP operation | 静态核对 operation/path/face 无新增，既有 consumer 未移除 | N/A：没有新读节点 | B1、B2、B3、B4–B16 的所有结构改动 |
| 写授权与 grant 复核 | AGENTS.md owner command 主权；R-READ-01 | 逐 caller 矩阵核对原 owner command、permission/session recheck 未被搬入 persistence | N/A：不新增授权 | B1、B2、B3、B4–B16 |
| 跨 owner 写与事务 | AGENTS.md 跨模块写规则；R-READ-03 | 静态比对目标 owner public command 与 REQUIRED 外层事务；无新增 cross-owner write | N/A：不新增跨 owner API | B1、B2、B3、B4–B16 |
| 集合形态与分页 | implementation-design-template §5；本批不改 route | 静态核对 frontend 只改变 import/path，response/page/cursor 类型不变 | N/A：没有新集合 | B2 |
| 缓存失效 / 改完刷新什么 | frontend-coding-standard §3-F；现有 OperationsTransport/RTK query | focused Drawer lifecycle proof 观察原 query invalidation/refetch 仍发生 | N/A：不新增 cache | B2 |
| RTK 数据读取与加载判定 | frontend-coding-standard §3-B；现有 OperationsTransport 与 generated RTK import | static import diff + frontend focused test 核对 currentData/isFetching 使用和 query 结果没有换源 | N/A：不新增请求 | B2 |
| 同一事实只有一个住址 | frontend-coding-standard §3-E；model/catalogModel.ts 及其新增 model/catalog 子目录 | 静态核对 barrel 只 re-export、无本地 server mirror；focused readback 仍来自原 query | N/A：无新事实 | B2 |
| 失败可见且原因不得改写 | frontend-coding-standard §3-D；backend-coding-standard §2-B/§1-D | static 文案/typed problem diff + focused negative fixture 核对 failure label/status/recovery 未改 | N/A：不新增 failure | B1、B2、B4–B16 |
| owner 错误到 HTTP 映射与注册处 | apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java 的现有映射 | compile + ContractProblemAdviceTypedOwnerMappingTest 核对公开嵌套异常/FQCN mapping；本批无新增 problem | N/A：不新增错误码 | B4–B16 |
| 幂等键构成与重放语义 | backend acceptance standard；既有 receipt service 与 idempotency key construction | focused method-family proof 核对 replay/conflict/readback 顺序；不改 key | N/A：不新增 command | B4–B16 |
| 该用生成物的地方不得手搓字符串 | backend-coding-standard §2-D；现有 generated edge imports | source diff 证明 contracts/generated 文件为零改动，frontend 继续 import generated wire | N/A：本批没有新 wire fact | B1、B2 |
| 日志落点与脱敏字段 | AGENTS.md observability hard constraint；doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md | review proof/capture 输出不含 bind 敏感值；受管 run 时读取日志并报告 first failure/cleanup | N/A：不新增业务日志 | B1–B16 |
| 迁移回填与可逆性 | implementation-design-template §10；本批无 schema change | 静态确认无 migration/seed 文件改动；若出现即 STOP | N/A：无 migration | B1–B16 |
| 前端共享行为 Drawer/列表/表单生命周期 | libraries/frontend/admin-ui-foundation 的 useDrawerFormLifecycle、useCursorCandidates、testId | B2 focused mount/reopen/dirty/discard/pending/readback fixture | 新代码必须复用上述 hooks，不新增 primitive | B2 |
| 候选/下拉数据源 | CP-0 caller/source matrix；现有 generated RTK/OperationsTransport | static import/source diff + focused query-context reset/readback | N/A：不新增 candidate | B2 |
| 编码与名称呈现 | backend/frontend coding standards；现有 catalog-management/ui/controllers/ 目录 precedent | static path/name check，禁止 Part1/Helpers/SalesMenuPage2；用户可见文案测试保持绿 | 无现成约定的文件必须按职责命名并进入子目录 | B2、B3、B4–B16 |
| 会同时坏的东西是否已声明为原子组 | foundation-charter §5-C；CP write set | 每 CP 以最小可回滚 write set 记录 SQL/transaction/caller/test 联动；任一 OPEN 不进入下一 CP | N/A：不引入新业务原子事实 | B1–B16 |

## 16. 模板必填补充：UI/L2、operation、跨 owner 与迁移

### 16.1 UI/testId 前置

```text
UI_DESIGN_REVIEW=NOT_APPLICABLE_WITH_REASON:本批不新增或改变 UI surface、Journey、控件、文案
TESTID_REVIEW=NOT_APPLICABLE_WITH_REASON:不新增控件；B2 只移动既有组件与既有 testId
L2_SCRIPT_ADMISSION=BLOCKED
```

B2 的 focused fixture 不是 L2，不能解除 L2 admission；本批也不写 L2 spec、runner、locator 或 blueprint。

### 16.2 operation/path/face/集合形态

| 业务意图 | operationId | method/path | consumer face | 集合形态与增长驱动 |
| --- | --- | --- | --- | --- |
| 本批没有新增或修改 HTTP operation | N/A | N/A | N/A | N/A：只做后端内部结构与前端文件路径 |

### 16.3 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败回滚事实 |
| --- | --- | --- | --- | --- |
| 本批没有新增跨 owner write | N/A | N/A | N/A | N/A：保留既有调用顺序 |

### 16.4 数据迁移与 seed

| migration | 变更 | 回填 | 可逆性 |
| --- | --- | --- | --- |
| N/A | 本批不改 schema/contract/generated | N/A | N/A |

受影响 seed 全集：N/A_WITH_REASON。本批只移动代码责任，不改变业务事实形状、状态枚举或体验数据；不得修改或执行 seed。

## 17. 模板必填补充：声明—传递—消费与同步清单

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| SQL effective value | 当前 SQL expression/source 与 CP-0 transaction/persistence matrix | B3 capture key 与 before/after evidence | 原有 JDBC/repository sink | 完整字符串、fragment order、parameter shape 相等 |
| transaction propagation | application method annotation/TransactionTemplate | method family matrix | target persistence/application boundary | annotation diff、self-call outer tx 与 focused proof |
| aggregate owner | 当前 owner command、CAS/lock/readback source | candidate/production matrix | target class boundary | caller/readback/lock evidence |
| facade public FQCN | facade、公开嵌套异常/record、static validator source | Java imports/DI | controller、其它 owner、advice、test | compile、mapping test、caller matrix |
| frontend state lifecycle | current Drawer state/controller | props/state contract、真实 import path | View、wrapper、foundation hook | mount/reopen/dirty/discard/pending/readback |
| collection shape | existing generated type/RTK endpoint | unchanged import/path only | existing consumer | typecheck、focused existing query test |
| authorization | existing session/owner checks | unchanged calls | existing owner command/read | source diff、negative behavior test |
| cache invalidation | existing RTK/foundation refresh symbol | unchanged calls | existing query cache | focused refresh/readback observation |
| error mapping | typed problem/advice registry | unchanged FQCN/code | HTTP and frontend presentation | negative fixture and mapping test |
| logging/masking | observability standard | proof helper excludes bind secrets | diagnostic/evidence output | log read with redaction check |

### 17.1 全链同步变更清单

| 变更事实 | 契约/generated | 后端 owner/edge/migration | 前端 model/surface/state | focused/static/HTTP/L2 | fixture/seed |
| --- | --- | --- | --- | --- | --- |
| SQL literal location | N/A：不改 wire source | persistence constants 与原 sink；无 migration | N/A | B3 capture/diff、static | N/A |
| SQL execution location | N/A | application/persistence owner、transaction matrix | N/A | B4–B16 focused/compile | N/A |
| acceptance group registry | N/A | BackendAcceptanceScenarioCatalog、structure test | N/A | structure red fixture | N/A |
| backend vocabulary | N/A | backend-coding-standard review-only | N/A | doc review/static | N/A |
| catalog frontend module path | N/A | N/A | model barrel、dictionary/local-copy subdirs | `scripts/test/catalog-inventory-query-envelope.test.mjs`、`frontend-idempotency-boundary.test.mjs`、`frontend-transport-cache-lifecycle.test.mjs` 与既有 frontend tests 的所有正向/`doesNotMatch`/拼接断言同步到真实 owning files；L2 N/A | N/A |

## 17A · 业务规则 → owner 判定点（对应 implementation-design-template §8）

| 规则 | 唯一判定点 | 最低证明 | 适用 CP |
| --- | --- | --- | --- |
| SQL literal fragment 的位置 | CP-0 SQL source/sink 矩阵；B3 各 module persistence constants | 每个 execution point 的 fragment graph、owner、常量地址和 unknown 清单 | CP-0、B3 |
| effective SQL 与参数槽位不变 | B3/B4–B16 capture helper 的稳定 key | 同一输入的完整 SQL、片段顺序、参数 shape、expression/slot mapping 和 branch case 对齐 | B3、B4–B16 |
| SELECT star 关系范围 | `tools/verify-gates/cli.mjs::function budget` 的 relation checker | physical red、CTE/derived/解析 alias green、9+1 mutation 全红、实际 marker | B1 |
| 公开 facade 与异常映射 | 五个 facade 源、`ContractProblemAdvice` 及 owner API | FQCN/constructor/静态 validator/嵌套异常保持，逐消费者 compile 与 mapping test | CP-0、B4–B16 |
| 事务、self-call、锁、幂等、回滚、readback | 每个 method family 的 transaction/persistence matrix | 外层事务属性、代理边界、失败和权威 readback 的 focused proof | CP-0、B4–B16 |
| B2 Drawer 生命周期 | 三个 frontend target 与 `useDrawerFormLifecycle` 所在真实导入点 | mount/unmount/re-open/dirty/discard/pending/error 的组件事实保持；服务端权威 readback 为 `N/A_WITH_REASON` | B2 |
| M-06/M-08 范围 | 本文 2A.1、4.4、11.5A 的 Dexter 裁定 | M-06-A 的最小支持集、M-08 三文件归位及其 write set 必须回读一致；tier 2 unknown 未闭合时 STOP | CP-0、B1、B3、B4–B16 |
| 无新增 operation/schema/seed | 本批 operation、migration、seed 表 | 以当前 source diff 证明没有新增形状；出现即 STOP | B1–B16 |

空号显式声明：权限、Journey、HTTP operation、契约/generated、migration、seed、L2、部署和切流本批均为 `N/A_WITH_REASON` 或未授权，不得由静态文件存在冒充已证明。

## 17B · owner API 与消费者清单（对应 implementation-design-template §9）

本批不新增 API，但不能把消费者盘点推迟为一句“CP-0 再看”。下表已经固定当前字节中的完整 facade public method family 族级入口和精确引用文件集合；CP-0 对这些既定行做逐 overload 签名、调用点行号和类型解析记录，这是补全证据而不是重新发现范围。若某个 overload/family 的类型确认结果为零消费者，必须在同一 CP 删除该公开入口或向 Dexter 报告为什么它是保留的稳定解析面；不得把“可能未来调用”当理由。

| facade | 当前 public method family（族级导航索引；具体 overload 不在本表展开） | 当前精确引用文件集合 |
| --- | --- | --- |
| `CatalogOwnerService` | `readWorkbenchContext`、`readNavigation`、`readItems`、`readCategoryCandidates`、`readInventoryDisplayFacts`、`readInventoryTargetDisplayFact`、`readSalesMenuCandidatePage`、`readSalesMenuItemFacts`、`readSalesMenuItemReferenceFacts`、`readItem`、`readItemSkus`、`list/create/update/transition*Definition`、`readDictionary`、`read*Copy`、`readShapeManifest`、`write`、`*Category`、`*DictionaryEntry`、`*CatalogItem`、`resolveCatalogItemRef`、`*AssetReference*`、`inventoryConsumptionReferences`、`skuNamesByItemCodes`、静态 `validateItemPageQuery` | facade 本身；目录前缀 `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/` 下的 `CatalogAssetGlobalReferenceTest.java`、`CatalogAssetReferenceTest.java`、`CatalogBatchStatusTransitionIntegrationTest.java`、`CatalogCategoryOwnerIntegrationTest.java`、`CatalogDictionaryKindTest.java`、`CatalogDictionaryReorderIntegrationTest.java`、`CatalogInventoryDisplayFactsTest.java`、`CatalogPageQueryContractTest.java`、`CatalogReceiptFirstUseConcurrencyIntegrationTest.java`、`CatalogSalesMenuTaskReadTest.java`、`CatalogSkuStructureFingerprintTest.java`、`CatalogTemporaryPromotionContractTest.java`、`CopyLimitPolicyTest.java`；以及 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/CatalogInventoryReadTransactionTopologyTest.java` |
| `InventoryOwnerService` | `readSalesMenuAvailability`、`readTargets`、`readTarget`、`readTargetChangeSummary`、`readTargetBusinessHistory`、`readTargetConsumptionReferences`、`readTargetLedger`、`readTargetDiagnostics`、`read/write`、`*Target`、`validateCatalog*`、`*Copy`、`*CatalogInventory*`、`*CatalogVoid*`、`*Bom*`、`*TargetConfiguration`、静态 `validateTargetPageQuery` | facade 本身；`apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`；目录前缀 `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/` 下的 `CatalogBatchStatusTransitionIntegrationTest.java`、`CatalogCategoryOwnerIntegrationTest.java`；目录前缀 `apps/backend/catering-business-server/modules/inventory/src/test/java/com/catering/v2s/inventory/application/` 下的 `InventoryBomBatchIntegrationTest.java`、`InventoryCatalogReferenceDependenciesIntegrationTest.java`、`InventoryCopyReplayIntegrationTest.java`、`InventoryLedgerScopeIsolationTest.java`、`InventoryOwnerBehaviorTest.java`、`InventoryOwnerContractTest.java`、`InventoryOwnerScopeGrantTest.java`、`InventoryPageQueryContractTest.java`、`InventoryReceiptFirstUseConcurrencyIntegrationTest.java`、`InventorySalesMenuAvailabilityTest.java`、`InventoryTypedMutationCasIntegrationTest.java`；以及 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/CatalogInventoryReadTransactionTopologyTest.java` |
| `BusinessChannelOwnerService` | `pageTemplates`、`pageStoreTemplateCandidates`、`pageTemplateVisibleStores`、`pageChannels`、`readTemplate`、`readChannel`、`read*CommandContext`、`readChannelWithTemplateProvider`、`findChannelsForBinding`、`listSalesMenuEligibleChannels`、`requireSalesMenuChannel`、`salesMenuChannelBelongsToStore`、`create/update/transitionTemplate`、`create/update/transitionChannel`、`detachChannelBinding` | facade 本身；目录前缀 `apps/backend/catering-business-server/modules/business-channel/src/test/java/com/catering/v2s/businesschannel/application/` 下的 `BusinessChannelCommandQueryTest.java`、`BusinessChannelOwnerContractTest.java`、`BusinessChannelSalesMenuOwnerTest.java` |
| `SalesMenuOwnerService` | `listMenus`、`readMenu`、`list/read*Section/Item`、`listItemCandidates`、`publicationPreview`、`listOperationRecords`、`recordRejectedOperation`、`create/copy/rename/archive/setActivation/updateSchedule`、`create/rename/delete/moveSection`、`add/update/delete/moveItem`、`requireSalesMenuItemAssetTarget`、`publish`、`setManualSoldOut`、`restoreManualSale`（OwnerApi 与 CommandApi overload 分开记录） | facade 本身；目录前缀 `apps/backend/catering-business-server/modules/sales-menu/src/test/java/com/catering/v2s/salesmenu/application/` 下的 `SalesMenuOwnerServiceOwnerApiTest.java`、`SalesMenuOwnerServiceQueryTest.java`、`SalesMenuOwnerServiceReadModelTest.java`；目录前缀 `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/` 下的 `OperationsSalesMenuAssetController.java`、`OperationsSalesMenuController.java`、`SalesMenuCommandFailureRecorder.java`、`SalesMenuEdgeSupport.java`；以及 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuCommandFailureRecorderTest.java` |
| `BusinessEntityService` | `create/update/transitionBrand/Tenant/HeadCompany/Store/Entity` overloads；`add/removeHeadCompanyBrandAuthorization`；`isEnterable*`；`requireSalesMenuStore`；`resolveCatalog*`；`requireStoreContractContext*`；`requireEntity/CommercialGroupId/ProjectId/StoreProjectId`；`readStoreUpdateFacts`；`authorized*`；`list/page/require*Entity`；公开嵌套异常 constructors | facade 本身；目录前缀 `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/` 下的 `BusinessBrandService.java`、`BusinessEntityCommandReceiptService.java`、`BusinessEntityCommandRouter.java`、`BusinessEntityTaskReadService.java`、`BusinessEntityValueSupport.java`、`BusinessTenantService.java`、`HeadCompanyService.java`、`OperationsOrganizationTaskReadService.java`、`OrganizationAuditHistoryService.java`、`OrganizationOverviewTaskReadService.java`、`OrganizationTaskPathService.java`、`StoreCandidateTaskReadService.java`、`StoreService.java`；目录前缀 `apps/backend/catering-business-server/modules/organization/src/test/java/com/catering/v2s/organization/application/` 下的 `BusinessEntityStoreContractQueryTest.java`、`OperationsOrganizationTaskReadServiceTest.java`、`OrganizationOverviewQueryTest.java`、`OrganizationOverviewTaskReadServiceTest.java`、`OrganizationOwnerServiceTest.java`、`OrganizationSalesMenuOwnerTest.java`、`StoreCandidateTaskReadServiceTest.java`；目录前缀 `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/` 下的 `cataloginventory/OperationsCatalogInventoryController.java`、`contract/OperationsContractController.java`、`organization/OperationsBusinessEntityController.java`、`organization/OperationsHeadCompanyAuthorizationController.java`、`organization/OperationsStoreManagementController.java`、`organization/OperationsStoreProfileController.java`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java`；`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java`；`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/CatalogInventoryReadTransactionTopologyTest.java`；`apps/backend/catering-business-server/src/test/java/edge/problem/ContractProblemAdviceTypedOwnerMappingTest.java` |

表中 `*`、`/` 和 `overloads` 是族级索引，不是可直接执行的实施清单。CP-0 必须在首次生产写入前把每个 facade public overload 展开为独立记录，至少包含完整 Java 签名、声明/实现路径、精确调用点 `path:line`、receiver/interface 类型、目标 execution 类和保持/修改/删除结论。任何 wildcard、未展开 overload 或仅靠方法名命中的行都不能作为 CP-0 的 `MATCHED`；四张矩阵必须在该展开完成后才能关闭。

consumer 规则：上表是当前字节的路径全集而不是“可能调用者”示例；CP-0 只在这些固定路径上补 `path:line`、receiver/interface 类型和保持/修改/删除结论，行号是执行记录诊断而不是新的范围来源。不能以 `rg` 命中替代类型确认，也不能把不同方法名的同词命中合并。facade 自身构造器和 `CatalogOwnerApi`/`InventoryOwnerApi` 等 interface declaration 单独列为 declaration，不当作 consumer。任何删除或 FQCN/constructor 变化都要在同一矩阵传播到 controller、其它 owner、advice 与 test。

## 17C · 实施前全链同步变更清单（对应 implementation-design-template §9a）

| 变更事实 | 唯一源/契约 | 后端 owner/edge | 前端 model/surface/state | focused/static/HTTP/L2 | fixture/seed | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| query-boundaries checker 与 marker | `tools/verify-gates/cli.mjs::function budget`、`verify.mjs::staticCommands`、`scripts/check/query-boundaries` | B1 | N/A_WITH_REASON | `standards-enforcement-verify.test.mjs`、query-boundaries red/green fixtures | N/A_WITH_REASON | 同步修改 |
| SELECT-star historical path closure | 当前 9 path（含 `DatabaseOperationTrackerTest`）与 3 个超白名单 source | B1 | N/A_WITH_REASON | 9+1 real-string mutation；tracker 的 N+1 断言 | N/A_WITH_REASON | 同步修改 |
| acceptance source 全集/registry | `acceptance/*Scenarios.java` 与 `BackendAcceptanceScenarioCatalog.discover` | B1 | N/A_WITH_REASON | `backend-acceptance-structure.test.mjs`；P2 显式 host test | N/A_WITH_REASON | 同步修改 |
| B2 catalog-management 文件路径 | 三个 target 的当前 exports/imports | N/A_WITH_REASON | model barrel、dictionary/local-copy subdirs | 三个 `scripts/test/*` 静态测试、所有 `doesNotMatch` 与拼接断言 | N/A_WITH_REASON | 同步修改 |
| SQL fragment/effective SQL | CP-0 source/sink 与 capture key | B3/B4–B16 persistence/application | N/A_WITH_REASON | before/after capture、branch matrix、focused proof | N/A_WITH_REASON | 同步修改 |
| facade public surface | 五个 facade 与 owner API | application、edge、advice、test | N/A_WITH_REASON | compile、mapping、caller focused tests | N/A_WITH_REASON | 同步修改 |
| M-06/M-08 决策结果 | Dexter 明确决策 | B1/B3/B4–B16 | N/A_WITH_REASON | 裁定回读、支持集证明和归位 write set 的步骤三维对账 | N/A_WITH_REASON | 按已裁定分支执行；不保留未决分支 |
| 业务 vocabulary review-only 正本 | `doc/platform/backend-coding-standard.md` | B1 | N/A_WITH_REASON | 文档反例 review；不建机器门 | N/A_WITH_REASON | 同步修改 |

不得把“无影响”作为完整格值；本批确实不消费 HTTP/契约/migration/seed/L2 的格，必须写 `N/A_WITH_REASON` 并说明本批只移动责任、不改变事实或用户路径。

## 17D · 变更定位（对应 implementation-design-template §9b）

所有定位使用稳定文件路径加唯一符号/导出名，不使用行号作为设计锚点；实施期行号只在 execution record 作为诊断。

| CP | 稳定变更锚点 |
| --- | --- |
| B1 | `tools/verify-gates/cli.mjs::function budget`、`tools/verify-gates/cli.mjs::function selfTest`、`tools/verify-gates/verify.mjs::staticCommands`、`scripts/check/query-boundaries::exec`、`scripts/test/backend-acceptance-structure.test.mjs::scenarioFiles`、`DatabaseOperationTrackerTest::distinguishesNPlusOneFromRedundantParameters`、`doc/platform/backend-coding-standard.md::review-only vocabulary section` |
| B2 | `features/catalog-management/model/catalogModel.ts`、`CatalogDictionaryDrawerState.tsx`、`LocalCatalogCopyDrawer.tsx` 的稳定 exports；`scripts/test/catalog-inventory-query-envelope.test.mjs`、`frontend-idempotency-boundary.test.mjs`、`frontend-transport-cache-lifecycle.test.mjs` 的 target source collections |
| B3 | `apps/backend/catering-business-server/modules/<module>/src/main/java/com/catering/v2s/<module-package>/application/<owner-class>::<method-family>`；新增 persistence constant class 的实际 symbol 由 CP-0 matrix 生成；每条 capture key 不依赖行号/文件迁移后路径 |
| B4–B16 | `<owner-class>#<method-family>`、确认过的 sink symbol、目标 persistence execution class；具体边界必须先落在 CP-0 的 transaction/persistence matrix，不得以 module 名或行数推断 |
| M-08 | 三个精确既有技术文件路径及其实际 class/method symbol；按已裁定归位到所属 module persistence，infrastructure/adapter 只保留扫描哨兵 |

## 17E · 已裁定项与后续边界（对应 implementation-design-template §12）

| 项目 | 状态 | 本 delivery unit 的处理 | 禁止的误读 |
| --- | --- | --- | --- |
| M-06：SQL 跨语句/跨方法解析能力 | `DECIDED_BY_DEXTER: A` | 按 §4.3 的 bounded minimal support set 实现；同一纯常量持有类内的 constant-expression 链必须可求值，tier 2 必须输出 unknown 并逐项由 capture/review 闭合 | 不得引入第三方 parser/framework 或把 focused business test 当作完整 data-flow/capture |
| M-08：三处既有 infrastructure/adapter 文件归位 | `DECIDED_BY_DEXTER: relocate` | 按 §11.5A 归位到所属 module persistence；B3 归位文本，execution 在 CP-0 确定的所属 module 批次归位，三条精确路径是范围边界，扫描分母仍保留 infra/adapter | 不得保留本批 execution 技术段例外，也不得把扫描覆盖冒充归位 |
| M-01：persistence execution 公开边界 | `DECIDED_BY_DEXTER: named-typed-boundary` | 按 §2A.1、§4.1、§11.5A 盘点并改为只接读侧 filter/sort/page/target，以及写侧聚合/命令对象/字段值等业务级参数、由 persistence 内部完成条件组合的具名、类型化方法；13 个 module 的 raw-SQL public 入口、SQL fragment 参数/包装形态与调用点必须在 CP-0 清单化；跨 module task-read 没有既定 owner 时保持 OPEN | 不得只改包名、只移动常量或只把 `String sql` 改名为 fragment；不得以 public raw-SQL passthrough、SQL fragment 参数、application 拼 SQL 或未知 owner 冒充 persistence ownership；private persistence helper 不构成 public boundary 例外 |
| 需求项四：domain 目录与业务规则迁移 | `HANDOFF_ONLY` | 不在本单元产出、不改 `application` 业务规则位置；记录为后续独立范围候选 | 不得以本批 persistence relocation 冒充 domain modeling |
| `SalesMenuPage` 新 surface 落点 | `HANDOFF_ONLY` | B2 不处理；等待正本出现新 surface 落点后再单独设计 | 不得为了减少文件数擅自移动或拆分 |
| 需求项八/26 个大 application 文件 | `HANDOFF_ONLY` | 当前立项完成后另行启动；本单元不扩候选、不顺手拆更多 frontend/backend 文件 | 不得把规模阈值当本单元自动纳入条件 |
| M-06-A 下的 `UNRESOLVED_SQL_CONSTRUCTION` / `UNRESOLVED_BRANCH` | `OPEN_UNTIL_PROVEN` | 每项写文件、表达式、原因、sink、branch、证明方式；capture 或完整 review 关闭后才可 MATCHED，否则按 STOP 报 Dexter | 不得静默放过、删除查询或把 unknown 记为 GREEN |

以上条目是本设计对已裁定边界和需求后续项的处置记录，不是新增授权；`HANDOFF_ONLY` 不进入本批 write set。M-06/M-08 已无待决分支，但若已裁定支持集或归位边界在实施中无法闭合，仍按 STOP 规则报告 Dexter，不得自行改裁。

## 18. 模板必填补充：owner API、场景与证据

### 18.1 owner API/consumer 清单

本批不新增 API。完整 facade、public method family、当前精确引用文件集合与逐 overload 的处理规则已在 §17B 固定；本节只保留 focused proof 的入口，不得把 §17B 的逐方法/逐路径确认推迟到实施者自行猜测。零调用者的方法不能被新 design 声明为 command。

### 18.2 非 HTTP focused 场景设计

| scenario/identity | owner source | fixture | request/action | businessOracle |
| --- | --- | --- | --- | --- |
| query-boundaries physical-red | scripts/check/query-boundaries 与 tools/verify-gates/cli.mjs | 临时 Java source，真实 physical SELECT * | 运行 query-boundaries checker | verdict 必须 RED，且不是 comment 命中 |
| query-boundaries cte-derived-green | 同上 | 临时 CTE/derived Java string | 运行 checker | verdict 必须 GREEN，relation scope 被正确解析 |
| query-boundaries path-closure | cli.mjs 及所有 local imported helper | 9 个历史 path + 1 新 path 的真实 physical mutation | 逐路径运行 checker | 10 个均 RED，路径不能改变判定 |
| write-path-layer-red | tools/verify-gates/cli.mjs | persistence/infrastructure/adapter 各一份 RestTemplate source | 分别运行 gate | 三份各自 RED，不能由其它层命中代替 |
| acceptance-group-registration | backend-acceptance-structure.test.mjs 与 BackendAcceptanceScenarioCatalog | 11 个当前 source，另加临时未注册 Scenarios | 运行 structure test | 当前全集被 registry 表示，临时未注册变 RED，P2 不进 business denominator |
| dictionary-drawer-lifecycle | CatalogDictionaryDrawerState.tsx 及 foundation lifecycle | 真实 dirty/pending/error/readback fixture | mount/close/reopen/discard/continue | state、文案、按钮控制与拆分前相同 |
| local-copy-drawer-lifecycle | LocalCatalogCopyDrawer.tsx 及 foundation lifecycle | 真实 source/target/step/dirty fixture | step change/close/reopen/submit/readback | step state、dirty guard、readback 与拆分前相同 |
| sql-effective-value | CP-0 真实 execution points | 同一输入和 branch matrix | before/after capture | 每 key SQL、fragment order、parameter shape 相等 |

这些不是新的业务 acceptance operation；它们是实现期的最低 focused proof。当前不执行。

## 19. 详设最终自检

- [ ] 文件以 SKILL_USED 正确开头，并写明授权与不授权
- [ ] 固定横切机制表 17 行全部保留，精确路径、可执行观察、形态和完整 CP 适用集不为空
- [ ] 3a UI/testId 状态明确 N/A，不伪造 L2
- [ ] 无新增 operation、跨 owner write、migration 或 seed shape
- [ ] 声明—传递—消费矩阵包含集合、授权、cache、错误映射、日志机制行
- [ ] 89 个候选均有分类；KEEP 不等于跳过 SQL sink
- [ ] 关键 facade/coordinator/lifecycle/hierarchy 候选已有事实基线，CP-0 只补 command/CAS-lock/readback 证据
- [ ] app-edge 的 `ExternalCollaborationBusinessChannelCoordinator` 与 platform workspace API 边界已显式排除在 89 个 module application 候选之外
- [ ] CP 总览、业务规则→owner 判定点、owner API→精确 consumer、全链同步与稳定变更锚点均已列出；N/A 格均有理由
- [ ] SQL unknown、capture、SELECT star red fixture 与 path closure 有明确 STOP
- [ ] 零注解 helper 的 consumer 为无条件可执行，或在同一位置声明条件、默认状态和本 proof 的显式启用方式
- [ ] B1–B16 和 B16 后唯一 acceptance 顺序一致
- [ ] 逐代码与详设对账在实施计划中有显式步骤
- [ ] 当前文档编写没有执行未授权的代码、测试、运行或数据操作

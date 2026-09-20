# v2s 全栈复用与前后台一致性 · 实施计划

```text
PLAN_KIND=IMPLEMENTATION_FACING_PLAN
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
BUSINESS_SOURCE=doc/plans/platform/2026-09-18-v2s-fullstack-reuse-and-consistency-requirements-claude.md
DESIGN_SOURCE=doc/plans/platform/2026-09-18-v2s-fullstack-reuse-and-consistency-implementation-design-codex.md
AUTHORIZED=仅编写本计划；本轮不实施生产代码、契约、迁移、测试、seed、DEV、reset、L2、UAT 或部署
IMPLEMENTATION_AUTHORITY=false
DYNAMIC_VALIDATION=NOT_RUN_NOT_AUTHORIZED
```

## 0. 本计划解决的真实问题与执行边界

本计划不是把需求条目改写成任务清单，而是把已经收口的需求拆成能够由主 agent 逐项实施、逐项反证、逐项回读的施工顺序。要解决的真实问题有两类：

1. 后端横切能力在多个 owner、HTTP face、测试和 seed 载体中重复实现，导致表面上能扫描，实际仍可绕过 owner、回执、分页、时区、审计和事务边界。
2. 两个前端对同一事实的状态、时间、空值、错误和动作呈现不一致，导致用户需要重新学习同一后台的同一业务事实。

本轮只产生本文件和配套详设，不调用实施工具、不修改生产源、不修改 generated 契约、不执行编译或测试、不启动或重启 DEV、不 reset/seed、不做浏览器 L2。Roadmap 不能扩大这条直接授权；后续每个施工批次仍需在详设 review 后取得对应实施授权。

### 0.1 不可绕过的施工纪律

- 所有代码、测试、seed、脚本和文档写入由主 agent 完成；reviewer 只读。
- 每个 CP 开工前和 focused proof 后，使用同一组需求、详设、IA/交互、project-memory 与 owning source 做前后双读。
- 每个 CP 结束后，由 fresh 独立 reviewer 做三维对账：需求、详设/IA、项目记忆规范。对账结果只能是 `MATCHED` 或 `OPEN`；`OPEN` 必须在进入下一 CP 前修复并复查。
- 全部 CP 完成后，再做一次全批整体三维对账；它不是阶段对账汇总，专门发现跨批次的语义、调用、文案、测试或 seed 漂移。
- 只有逐代码与详设对账无 `OPEN`，才可以把实施结果交给 Dexter 和 Claude 做 `REVIEW_TARGET=IMPLEMENTATION`；它不能由静态文档或单次测试代替。
- 任何机器门都必须明确为 `NECESSARY_NOT_SUFFICIENT` 或 `REVIEW_ONLY`。除非另行给出完备全集、漏检条件、反例和真实红变异，本计划不把任何门标为 `PROVES_CLOSURE`。

## 1. P0 · 施工前冻结事实、分母和基线

P0 是所有后续批次的前置步骤。它不改代码；它只把会影响施工方向的当前字节事实冻结为可复核的输入。P0 未完成时不得开始 A、B、C、D 或 E。

### 1.1 必须重新打开的输入

| 输入 | 用途 | 施工判据 |
| --- | --- | --- |
| `doc/plans/platform/2026-09-18-v2s-fullstack-reuse-and-consistency-requirements-claude.md` | 需求、D-1 至 D-5、C-1 至 C-10、R-1.1 至 R-11.4 | 当前字节与详设逐条一致；裁决不被“技术优化”改写 |
| `doc/plans/platform/2026-09-18-v2s-fullstack-reuse-and-consistency-implementation-design-codex.md` | owner、helper、批次、门和 R-10 分母 | 每个 CP 都有精确输入、输出、失败边界和闭包等级 |
| `doc/platform/backend-coding-standard.md`、`doc/platform/frontend-coding-standard.md` | 后端/前端唯一规范 | 规范中的 review-only 事项不被假机器门替代 |
| `doc/decisions/templates/implementation-design-template.md` | 详设结构 | 横切机制、3a、声明—传递—消费、9a、10b、owner 矩阵均有落点 |
| `project-memory/decisions/deterministic-context-only.md`、`project-memory/practices/collection-boundary-modes.md`、`project-memory/practices/frontend-capability-lookup.md`、`project-memory/practices/backend-capability-lookup.md`、`project-memory/practices/drawer-form-lifecycle.md` | 确定性上下文、集合形态、前后端能力查找、Drawer 生命周期 | 不从聊天历史推断当前事实，不新增平行能力 |
| `project-memory/operations/backend-acceptance.md`、`project-memory/operations/test-closed-loop.md` | acceptance、fixture、seed 和回归闭环 | business 与 cleanup 分开，失败不改写为 PASS |

### 1.2 当前施工分母与反例

- 回执 SQL 分母冻结为十个：`BusinessChannelCommandReceiptServiceSql`、`CollaborationCommandReceiptServiceSql`、`ExtensionCommandReceiptServiceSql`、`BusinessEntityCommandReceiptServiceSql`、`CommercialGroupCommandReceiptServiceSql`、`OrganizationHierarchyCommandReceiptServiceSql`、`PlatformCommandReceiptServiceSql`、`ContractCommandReceiptServiceSql`、`WorkspaceIamCommandReceiptServiceSql`、`WorkspaceCommandReceiptServiceSql`。每一个都必须进入 C 批逐文件映射；十五张表、四种 payload 是独立维度，不能替代这十个 service SQL 分母。
- R-4 的 `CONTINUATION_` 常量以三类施工：纯物理换行、静态语义片段、运行时/条件片段。值中有 `?` 只圈出必审子集，当前命令实测可能为 662，需求记录为 661；该数字不是安全分类器，也不是最终分母。`CatalogDefinitionFactsSql.java` 的 `LIM`/`IT ?`、`CatalogWorkbenchReadServiceSql.java` 的无占位符语义片段必须进入反例集。
- ArchUnit 依赖在 `apps/backend/catering-business-server/build.gradle.kts` 的 ArchUnit 依赖声明处存在，但 `BackendModuleBoundariesTest` 当前没有方法级调用规则；参数解析门必须新增 `JavaCodeUnit` 级规则，不得写成“沿用已有 ArchUnit”。
- advisory lock 的绕过检查必须排除 `modules/foundation/src/main/java/com/catering/v2s/platform/foundation/persistence/AdvisoryLock.java` 定义处，否则 helper 自身会被判红。
- 审计写入分母不得只取 R-4 能触及的七份 SQL：`StoreServicePointService.java` 中 inline `audit_event` INSERT 仍须进入独立 `AuditEventWriter` 迁移。

### 1.3 P0 输出和停止条件

P0 输出为一份只读施工输入记录，至少包含：扫描根、扩展名、排除项、执行命令、当前计数、十个 receipt SQL 完整名单、R-4 三类反例、所有 Page/Cursor/Bounded/Detail 形态的分桶、R-10 载体集合和 A-E 依赖图。它不是 compliance 台账，也不引入已退役的 package entry/exit、hash-chain、receipt 或 evidence control plane。

若当前源码发现 owner、权限、事务、契约或需求语义冲突，P0 必须 `OPEN` 停止，不得通过缩小分母、增加 fallback、保留旧路径或把问题转成“以后 review”绕过。

## 2. CP 总览与依赖

| CP | 批次 | 范围 | 主要 owner/载体 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-A | 甲 | R-4 SQL 续行常量与等价性 | 后端各 owner 的 SQL source、检查脚本、相关编译/行为测试 | P0 baseline；最先建立 |
| CP-B | 乙 | R-1、R-2、R-7 与其 helper | foundation、两 App、状态/时间/空值/审计呈现、静态/render 测试 | P0；可与 CP-A 并行，已知文件零重叠 |
| CP-C | 丙 | R-3 回执、集合解析、锁、审计与错误 envelope | foundation SPI、十个 receipt SQL/owner persistence、edge/problem、acceptance | CP-A 完成后；不得污染 R-4 baseline |
| CP-D | 丁 | R-8、R-9 词表与跨 App 复用 | audit/extension/collaboration 共享纯值与 app adapter | P0；受 CP-B 的基础呈现能力约束 |
| CP-E | 戊 | R-5、R-6 集合和错误闭环 | collection helper、Page/Cursor owner、contract/edge/front-end | P0；依赖 CP-C 的共享解析/错误形态 |
| CP-Z | 收口 | R-10/R-11、全批三维对账、逐代码与详设对账 | 所有生产/生成/测试/seed/脚本/文档变更 | A-E 全部完成 |

CP-A 与 CP-B 可并行，但两个施工者不得写入同一文件；CP-C 必须在 CP-A 的 baseline 和等价性结论之后开始。R-11 不是第六个独立业务批次，而是在每个 CP 内随实际 helper 一起实现、一起验证。

## 3. CP-A · R-4 SQL 续行常量治理

### 3.1 开工前基线

在任何 SQL source 变更之前，冻结原始源码快照、扫描根和编译入口。基线必须包含：

1. `CONTINUATION_` 声明总量及文件清单；
2. 三类分类结果和每个消费点；
3. 当前 Gradle 编译入口与结果；
4. 混合拼接反例，包括词中间切分、占位符片段、条件片段；
5. 后续 C 批十个 receipt SQL 的原始字节状态。

基线必须在本批和丙批之后各自按同一命令重读；不得用 Git 操作替代源码快照，也不得在 C 批改完回执 SQL 后才补基线。

### 3.2 实施顺序

1. 先把每个常量归入三类；第二类逐消费点确认，第三类保留运行时/条件结构。
2. 只合并有明确物理换行证据、且消费顺序不携带参数/子句语义的第一类。
3. 对 `CatalogDefinitionFactsSql`、`CatalogWorkbenchReadServiceSql` 反例增加 focused 保护，确保词中间切分和无占位符语义片段不会被误归第一类。
4. 对每个被改写的 SQL 消费点确认最终 SQL 片段顺序、绑定参数顺序、条件分支和 owner 语义不变。
5. 按同一 Gradle 入口编译 baseline 与改后源码；执行 `scripts/check/backend-sql-readability.mjs` 及其 `--self-test`，执行 `scripts/check/backend-sql-readability-counterexamples.mjs` 及其 `--self-test`，再执行仓内 SQL relocation equivalence 检查（若该检查自身不覆盖第二、三类，只把它作为必要门，不升级为闭包证明）。

### 3.3 CP-A 完成条件

- 纯换行项完成合并；语义片段和运行时片段无未经确认的改写。
- 第一类、第二类、第三类的每条记录都有唯一消费点；缺消费点的常量删除或停机确认，不保留“可能有用”的孤儿常量。
- `scripts/check/backend-sql-readability-counterexamples.mjs` 对词中间切分、无占位符语义片段、参数顺序敏感片段各有一条真实 red mutation，实际输出 `R4_SQL_SEMANTIC_COUNTEREXAMPLES=PASS` 与 `R4_SQL_SEMANTIC_COUNTEREXAMPLES_RED=PASS`；该门只覆盖已点名的三个消费点，不替代逐消费点确认。
- `backend-sql-readability.mjs` 的生产扫描为零旧续行标识，且 `--self-test` 能被注入的 `CONTINUATION` 标识打红；该门只证明命名闭集，不证明 SQL 语义等价。
- business 与 cleanup 分开报告；本轮仅设计计划，不执行这些动作。
- CP-A 完成后才允许 CP-C 改写十个 receipt SQL。

## 4. CP-B · R-1、R-2、R-7 与前端共享行为

### 4.1 Helper 先行，feature 后迁移

按详设 §5.1 的归属矩阵建立或迁移以下能力：生命周期标签/颜色、状态确认、行操作菜单、canonical 时间、字段级空值、审计呈现、纯 HTTP transport。生命周期用户可见值冻结为 `ENABLED=启用`、`DISABLED=停用`、`VOIDED=作废`，覆盖 `project-memory/decisions/owner-read-model-and-lifecycle-standard.md:66` 的旧“标记删除”裁定；catalog 的生命周期标签消费共享常量，但 `shapeKey` 等 catalog 域内枚举继续由后端 manifest/`catalogEnumLabel` 驱动。每个 helper 必须先有最小 focused behavior proof，再迁移一个 feature 消费者；feature 仍保留自己的 generated 状态穷举、业务动作、权限和空态语义。

特别约束：

- 生命周期 helper 不把合同、账号、资产等非主数据状态机压成三态；C-3 也不把 catalog 的 manifest 域内枚举抽成 foundation 常量。
- 状态变更确认由 foundation 统一承载；catalog 的 Modal 形态只按 C-4 保留，文案、颜色、控件位置和错误呈现不能豁免。
- Drawer dirty/关闭确认/“请先保存”只能由 `useDrawerFormLifecycle` 负责；子控件和 feature 不得自建第二套提示。
- 时间统一 `zh-CN`、`Asia/Shanghai`、medium date/time；字段级 null/undefined/空串用破折号，不把列表空态或无权限态压成字段空值。
- 两 App 的 capability lookup、foundation export 和实际消费者同步；只新增 helper 不迁移消费者视为未完成。

### 4.2 UI/L2 前置门

本批若触及 UI-bearing surface，必须先重开已批准 Journey、IA、交互、销售菜单式列表基线、`*TestIds.ts` 和实际 owning source，逐控件核对位置、容器、样式、选中/排序/边界禁用/失败恢复、焦点和真实动作节点。只发现 testId 存在不能放行。任何 UI 对账 `OPEN` 都使 L2 admission 保持 `BLOCKED`；本计划本轮不执行 L2。

### 4.3 CP-B 完成条件

- 每个 helper 有 `helper -> consumer -> feature retained responsibility -> proof` 行。
- 两 App 共享行为不再保留逐字节重复实现；需要保留 app adapter 的地方明确其 owner/generated 边界。
- R-7 的时间和字段级空值 focused/render 测试能在 helper 变异后变红；不能用“测试跑过”证明所有时区入口已覆盖。
- 状态/动作词汇的用户可见生产源、错误反馈和相关 render 测试已按 R-10 同批同步。

## 5. CP-C · R-3 后端横切能力

CP-C 只能在 CP-A baseline 已冻结且 CP-A 完成后开工。它不得把 foundation 变成业务 owner，也不得把 owner 的回执表、DML、权限和 readback 移入 foundation。

### 5.1 CommandReceiptSupport 与十个 owner

1. foundation 只提供 request hash、claim race、同 key replay、同 key 不同 payload conflict、nullable legacy claim-only 语义和 JSON serialization SPI。
2. 十个 owner 各自保留 receipt table、SQL、persistence、response/readback type、REQUIRED transaction 和业务 Problem code。
3. 十个 receipt SQL 文件逐一迁移并逐一回读；不得把“15 张表”当作漏项证明，也不得只迁移九个。
4. `response_json`/统一 response 列的 nullable legacy 行按 claim-only 重放；不把历史 null 误判成 corrupt，也不执行未授权生产回填。
5. race 由 owner persistence 的唯一约束/`ON CONFLICT DO NOTHING` 或同等正确机制收口，失败时不产生半写 readback。

### 5.2 集合、锁、审计和错误 envelope

- 先按 `collection-boundary-modes` 对 Page、Cursor、Bounded、Detail 分桶，再决定哪些调用消费 `CollectionRequestSupport`；不得把 27 个 OFFSET 文件整体当 Cursor，也不得把六/八个 keyset 数字直接当最终分类。
- `CanonicalCursorIdentity` 只提供统一编解码；三个 wire adapter 保留各 operation 的身份字段。每个 Cursor 场景验证推进、无重复、无遗漏和边界游标。
- `AdvisoryLock` 是锁 API，owner 决定业务 lock key 与事务边界；门只检查 helper 之外的 direct invocation，定义文件本身明确排除。
- `AuditEventWriter` 只提供结构化写入协议；七份 SQL 与 `StoreServicePointService.java` 的 inline INSERT 逐一接入，owner 仍拥有表和事实。
- 采用“共享 envelope shape + owner adapter”：共享层不导入 owner code；六个 Problem owner 保留闭集、上下文和 edge 注册，`ContractProblemAdvice` 的多分支路径逐条迁移。

### 5.3 CP-C 完成条件

- 十个 receipt SQL、对应 persistence/service、共享 SPI、null legacy 和并发 replay 均有一一映射。
- null legacy 的 focused proof carrier 固定为 app-level `apps/backend/catering-business-server/src/test/java/com/catering/v2s/platform/receipt/CommandReceiptNullReplayMatrixTest.java`，逐一列出十个 owner；模块局部测试可补充，但不得以 foundation 单测或单一 owner 单测替代十行矩阵。
- 每个变更 HTTP operation 在对应 `*AcceptanceScenarios.java` 有 identity、fixture、request、businessOracle；不把 scenario 堆回入口类。
- 同 key 同 payload、同 key 不同 payload、旧 null claim-only、owner failure、第二 owner/审计失败回滚均有可证伪反例。
- 共享 envelope 不吞掉 owner error code；generated error sets、edge 注册和前端 adapter 的声明—传递—消费闭合。

## 6. CP-D · R-8、R-9 词表与跨 App 一致性

### 6.1 实施顺序

1. 先盘点 fixed field、owner dynamic key、扩展字段和未知 key 的读取来源；历史审计优先使用 snapshot，无 snapshot 时固定字段才可走注册表，扩展字段必须使用稳定 fallback，不猜中文。
2. 建立共享纯值/呈现 helper 与 app adapter，不把 owner/generated 闭集搬进 foundation。
3. 对全部生产源、problem detail、审计弹窗、商业实体列表、扩展字段和用户可见状态词逐一更新；测试和 red mutation 同批更新。
4. R-9 的跨 App 词表必须按照 capability lookup 的 routed practice 登记，新增符号后两 App 的实际消费者必须能从查找表找到。

### 6.2 完成条件

- 同一事实在 platform-admin 和 operations-admin 的状态、时间、空值、错误、审计标签一致，且权限/owner 边界未被共享 helper 改写。
- 只有 UI-bearing Journey 才进入 L2 前置分母；当前未授权 L2，不能把 render/static proof 写成浏览器 PASS。
- 未知字段 key、历史快照、无权限、列表空态和字段 null 各自有独立呈现，不互相吞并。

### 6.3 CP-D 当前实施记录（2026-09-19 当前字节）

- foundation 新增 `presentation/collaborationCodeLabels.ts`，集中持有跨 App 协作纯词表、属性展示元数据与未知值 fallback；没有引入 generated API、problem-code 或 TestIds。
- 两个 App 的 `collaborationCodeLabels.ts` 只保留 generated union 的 `satisfies Record<...>` 适配，aggregate 与属性呈现直接复用 foundation 对象；`*TestIds.ts` 和 problem-code 映射未跨边界。
- foundation `extension/typedExtension.ts` 新增 `extensionSearchValueType` 与 `extensionSearchFieldProps`；两侧 `extensionList.tsx` 保留 ProColumns、generated field projection 与 App TestId，只消费共享纯搜索配置与 typed value formatter。
- `OperationsTransport.ApiFailure` 补齐 `name`、`title`、`detail`、`errorCode`，与 `PlatformApiFailure` 的错误对象形态一致；problem-code 闭集与 `problem()` 仍各自归 App。
- 审计呈现 helper 收紧为单一稳定链：历史 `fieldLabelSnapshot` → foundation 固定字段注册表 → `字段（key）` fallback；动作码只走 foundation 注册表 → `已记录操作` fallback。移除调用方动态标签参数及其测试期望，防止后续消费者用当前 definition 猜历史字段中文或覆盖动作文案。
- focused proof：foundation typecheck 通过；foundation 13 个测试文件、69 个测试通过；operations-admin 与 platform-admin typecheck 通过；两 App 审计呈现测试各 3 个测试通过；修复前 fresh 步骤复核提出的动态标签绕过已由 helper 契约、测试与当前两 App 消费点共同收口。
- `DYNAMIC_BACKEND_ACCEPTANCE=NOT_RUN`、`RESET_DEV_SEED=NOT_RUN`、`BROWSER_L2_UAT=NOT_AUTHORIZED`；上述 focused 结果不升级为 backend、DEV、seed 或 L2 证据。
- 步骤级 fresh reviewer 已复核 CP-D 当前字节为 `MATCHED`（M/S/N=0/0/0）；动态证据仍为 `NOT_RUN`，不由步骤对账升级。

## 7. CP-E · R-5、R-6 集合和错误闭环

### 7.1 Page/Cursor 分类与 helper 使用

- 以 `project-memory/practices/collection-boundary-modes.md` 的判别式逐个分桶；对每个 OFFSET 文件记录它是合法 Page 还是另有边界。
- Page 保持页号/offset 和 total；Cursor 使用 canonical identity/keyset；Bounded 明确固定上限并拒绝静默截断；Detail 不引入集合参数。
- 同一 collection 事实的请求解析、游标编码、total/readback 和前端 `currentData`/`isFetching` 行为必须在同一变更中核对。
- 业务 failure 使用 owner typed problem；不以空集合、通用网络文案或“下一页为空”隐藏原因。

### 7.2 完成条件

- R-5.1 的分母先完成 Page/Cursor/Bounded/Detail 分桶，之后才允许写 helper 覆盖率。
- R-5.2/R-5.3 的 canonical identity、wire adapter、边界游标、重复/遗漏与失效恢复均有反例。
- R-6 的错误注册、契约生成、前端反馈和 owner 归属逐 operation 对账；未知或未注册 code 不能靠默认字符串通过。

### 7.3 CP-E 当前实施记录（按当前字节）

- **集合形态分桶**：`OFFSET` 命中只作为发现入口，不能直接推导为 Cursor。按
  `project-memory/practices/collection-boundary-modes.md` 逐个看 response 与边界：带页号/offset/total
  的保留 Page；消费 `OpaqueCollectionCursor`、keyset sort/tie-breaker 的保留 Cursor；来源固定上限且拒绝
  游标的才是 Bounded；单实体读取不带集合参数的才是 Detail。当前外部协作候选
  `OperationsExternalCollaborationController#providerCandidates` 已有前端 Cursor 消费者，继续保留 Cursor，
  只修 identity 编码，不把它误收窄为 Bounded。
- **canonical cursor 迁移**：以下 Cursor identity 已统一调用
  `foundation.collection.CanonicalCursorIdentity`，仍由 owner 选择维度并校验其语义：
  `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/externalcollaboration/OperationsExternalCollaborationController.java`、
  `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelTaskReadService.java`、
  `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelTemplateService.java`
  的两个 Cursor read、以及
  `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreServicePointService.java`
  的区域/服务点两条 read。BusinessChannelTemplateService 中命令回执的 `canonical` 仍保留原 owner
  请求语义，不与 Cursor identity 混用；其它已经消费该 helper 的 catalog、production、sales-menu owner
  不重复改写。
- **反例与 focused 载体**：foundation 的
  `CanonicalCursorIdentityTest` 覆盖分隔符、`null` 与文本值的区分；外部协作 controller test 覆盖旧分隔符
  能制造而 canonical identity 必须拒绝的跨查询游标碰撞。新增/迁移的 BusinessChannel 与 StoreServicePoint
  还需在 focused proof 中确认 malformed、边界、重复/遗漏及查询维度失效；不能用只测 helper 的绿灯替代 owner
  行为证明。
- **生命周期反向闭包**：当前迁移目录逐语句发现 39 张含 `status` 列的表；
  `contracts/policy/lifecycle-vocabulary.json` 将其分为 20 张主数据和 19 张过程/关系豁免表，
  `scripts/check/lifecycle-vocabulary` 负责发现集合、重复/过期登记和未登记表的反向校验，
  `--self-test` 以虚构未登记表验证红变异。该门只证明“当前带 status 的表全部有明确桶与理由”，不替代每张表的
  值域、唯一性、owner 与业务语义评审，也不把所有三态字面量强行下沉为共享状态机。
- **CP-E fresh 对账处置**：独立复核发现旧 self-test 直接向已发现集合追加字符串，未覆盖 SQL discovery
  本身；已把 `migrationStatusTables` 改为支持 fixture root，并在 self-test 临时复制当前迁移集后追加
  一条 `CREATE TABLE ... status` 与一条 `ALTER TABLE ... ADD COLUMN status`，先断言两种形态都被同一
  discovery path 发现，再断言闭集门因未登记而变红。当前 `scripts/check/lifecycle-vocabulary --self-test`
  与正常检查均为 `PASS`，但 CP-E 仍需新的 fresh 独立复核后才能标为 `MATCHED`。
- **规范与静态入口**：`backend-coding-standard.md` §1-L 的动态分母指向上述 policy/check；四份设计模板
  已加入 frontend §3-K-1..§3-K-10 的逐屏对账行；`tools/verify-gates/verify.mjs` 将
  `lifecycle-vocabulary` 与现有 R-11 reuse-consistency 静态门纳入统一检查。R-6.3 的禁止词/内联颜色门
  仍复用 R-11 的真实 red mutation，不另造存在性门。
- **仍未升级的动态证明**：CP-E 的检查器 self-test/standalone 与 R-11 统一入口已完成静态复核；
  受影响 backend focused test 的本机顶层调用仍受远端 Testcontainers 拓扑门约束，动态 backend acceptance
  尚未运行。因此 `MATCHED` 仅表示步骤级静态/源码/已运行 focused proof 对账闭合，不等于 backend、DEV、
  seed 或 Browser L2 通过。
- **fresh 步骤复核结果**：生命周期 self-test 修复后，新的独立 reviewer 以当前字节完成三维对账，
  `CP-E_STATUS=MATCHED`、`M/S/N=0/0/0`；复核覆盖 discovery fixture 的两种 SQL 形态、39 张表政策、
  canonical cursor consumer/collision、前端 AST gate 以及 R-10/R-11 载体。动态 backend、DEV、seed、
  Browser L2/UAT 仍未由该步骤复核升级。
- **动态首败处置**：首次受管远端 focused run
  `r5-tc-1789751731084-38396` 的容器/卷与 cleanup 均为 `PASS`，但
  `OperationsExternalCollaborationControllerTest.cursorIdentityRejectsAQueryCollisionThatTheLegacyDelimiterCouldAccept`
  以 `NullPointerException` 失败。根因是新增 collision fixture 给 path 传了两个特殊 group key，mock 返回的
  `WorkspaceSessionReadback` 却仍使用固定 `KEY`；真实 `OperationsSessionResolver` 会拒绝这种不一致。
  已只修测试 fixture，增加按 group key 构造 session 的 helper，未改变生产 controller/canonical identity；本地
  `compileTestJava` 已通过。该新写入使 CP-E 需再次 fresh 复核，首个远端 business `FAIL` 与 cleanup `PASS`
  不得被后续重跑覆盖。
- **远端 focused 重跑**：修复后的 run `r5-tc-1789752076061-46736` 在受管远端完成生成、编译与
  `OperationsExternalCollaborationControllerTest` 五项测试，`REMOTE_GRADLE_STATUS=0`、runner resource
  cleanup=`PASS`。该 invocation 是 focused JUnit，不是 backend-acceptance catalog，因此 manifest 的
  `BUSINESS=NOT_APPLICABLE`；它只证明该测试类行为通过，不能替代后续真实 HTTP business acceptance。
- **CP-E owner focused proof**：run `r5-tc-1789752224252-49812` 在受管远端完成
  `BusinessChannelSalesMenuOwnerTest`，`REMOTE_GRADLE_STATUS=0`、runner resource cleanup=`PASS`；该
  invocation 同样是 focused JUnit，`BUSINESS=NOT_APPLICABLE`，不替代 backend-acceptance。
- **全量 acceptance 的当前首败与预算处置**：run
  `r5-tc-1789756950537-41870` 已完成 source sync、`CATALOG_INVENTORY_P1_GENERATION=PASS`、远端
  Gradle（43 tasks）与全部 backend acceptance business；资源 cleanup=`PASS`。唯一首败在测量边界：
  `createOperationsContract` 实测 20 个 DB operation，而旧生成预算为 19。事件明细把额外两次调用定位到
  `ContractCommandReceiptPersistence#find` 的 advisory lock 与 receipt read；不能删除锁或放宽业务事实。
  已按既有 `CURRENT_PROGRAM_RESULT_BUDGET_DECISION_REF` 以该当前受管结果重分类，得到 `P5`、最大值 20，
  并由 `scripts/generate/edge-codegen.mjs --write` 重生成 403 个文件；`edge-codegen --check` 当前通过。
- **远端主机阻断（当前未闭）**：预算修正后的第一次完整 CALIBRATION run
  `r5-tc-1789757642666-97377` 在 Gradle 完成后于 evidence artifact collection 因
  `server_47.106.121.27_not_responding` 失败；第二次 `r5-tc-1789758905500-61019` 与第三次普通
  ACCEPTANCE `r5-tc-1789761055193-43518` 在 source sync 均以同一远端主机不响应、tar EPIPE 首败，
  三次均未运行 business/measurement。第三次 cleanup recovery 已通过，准确 run manifest 的远端根目录、
  process、containers 与 volumes 均已回收（`REMOTE_ROOT_ABSENT=true`）。同一外部边界连续复现三次后，
  按停滞纪律停止盲目重试；这不是代码或预算 PASS，也不授权绕过受管 runner。

## 8. R-10 测试与 seed 同批闭环

R-10 是每个 CP 的完成门，不是提示语。每个 R 子项必须在同一个 CP 的变更清单中明确生产代码、seed、acceptance、前端 static/render、red mutation 和 scripts/check 的处置；真实不消费者才写 `N/A_WITH_REASON`。

### 8.1 固定载体全集

| 载体 | 精确路径/范围 | 施工要求 |
| --- | --- | --- |
| seed 数据正本 | `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` | 业务事实新增/改形状时先改正本，再核对 executor；不得只改校验器 |
| seed 计划 | `scripts/dev/r5-seed-plan.mjs` | 每个定义闭集/数量断言与阶段引用同步；重点复核 `definitions.length` 断言 |
| owner seed executor | `scripts/dev/owner-command-seed-executor.mjs` | 宿主闭集、数量断言、fixture builder、owner readback 同批同步 |
| 完整阶段 executor | `scripts/dev/r5-complete-seed-executor.mjs` | 四阶段顺序保持机械校验；渠道、回执、实体依赖顺序不可倒置 |
| 各域 seed executor | `scripts/dev/` 下受 R-1 至 R-11 影响的 catalog、inventory、business-channel、collaboration、sales-menu、audit/owner executor | 逐文件列影响事实和边界值，不能只改总 executor |
| seed fixture/校验测试 | `scripts/dev/` 与 `scripts/check/` 下对应测试 | 校验器、数据正本和 readback 三者一致；红变异必须能在写入前失败 |
| backend acceptance | `*AcceptanceScenarios.java`：Asset、Audit、BusinessChannel、Catalog、Collaboration、CommercialContract、Extension、Iam、Organization、SalesMenu、StoreServicePoint | 每个受影响 operation 在 owning group 有 identity/fixture/request/businessOracle；builder 不强制掉待验证的可选参数 |
| 前端静态/render | 两 App feature 测试、foundation focused/render 测试、`*TestIds.ts` | 状态/时间/空值/错误/能力 lookup 与 helper 变异真实变红；不以 L2 替代 static/render |
| 机器检查与 red mutation | `tools/verify/`、`tools/verify-gates/`、受影响 `scripts/check/`、ArchUnit architecture test | 每道门有反例；检查器本身不能永远失败或只查 helper 存在 |

### 8.2 R-1.1 至 R-11.4 逐条同步表

| R 子项 | CP | 必须同步的生产/契约载体 | 必须同步的测试/seed/红变异载体 | 真实 N/A 边界与闭包等级 |
| --- | --- | --- | --- | --- |
| R-1.1 | B | lifecycle helper、两 App 状态呈现；值固定为 `ENABLED=启用`、`DISABLED=停用`、`VOIDED=作废`；`apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogLifecycleStatusTag.tsx` 的 catalog 生命周期走共享常量，`shapeKey` 等域内枚举继续由 `apps/frontend/operations-admin/src/features/catalog-management/model/catalogManifestLabels.ts` 的 manifest/`catalogEnumLabel` 驱动 | 两 App render、状态词 corpus、helper 变异、catalog manifest adapter test | 非主数据三态不消费；catalog 域内 manifest 语义不搬迁；`NECESSARY_NOT_SUFFICIENT` |
| R-1.2 | B | 生命周期动作/确认 helper、owner command adapter | 正常/危险确认、取消、失败原位测试 | 无状态动作的 detail 仅 REVIEW；`REVIEW_ONLY` |
| R-1.3 | B | 状态词、问题反馈、`project-memory/decisions/confirmed-business-language-corpus.md` 与 `project-memory/decisions/owner-read-model-and-lifecycle-standard.md:66`；“标记删除”统一替换为“作废”，不使用“已启用/已停用” | 全生产源扫描、两 App render、直接文案 red mutation | generated value 不手改；`NECESSARY_NOT_SUFFICIENT` |
| R-1.4 | B | 状态颜色/Tag helper | color mutation、各状态 render | feature-specific 非主数据颜色保留；`REVIEW_ONLY` |
| R-1.5 | B | row action/menu helper、确认与 loading | 行菜单每个 action、禁用/危险/red mutation | detail action menu 不合并；`NECESSARY_NOT_SUFFICIENT` |
| R-1.6 | B | catalog Modal 例外适配 | Modal position/style/behavior focused/render | 只豁免承载形态；`REVIEW_ONLY` |
| R-2.1 | B | canonical time helper、所有调用点 | fixed epoch/timezone focused/render、直接格式化 red mutation | 输入表单原始字符串不消费；`NECESSARY_NOT_SUFFICIENT` |
| R-2.2 | B | 字段级空值 helper | null/undefined/0/empty render | 列表空态/无权限不适用并写理由；`REVIEW_ONLY` |
| R-2.3 | B | loading/error/currentData 规则 | stale scope、failure clear、query identity tests | 需真实焦点行为的部分待 L2；`NECESSARY_NOT_SUFFICIENT` |
| R-2.4 | B | Drawer lifecycle/foundation | dirty/close/submit-lock focused | 无 Drawer 的 surface `N/A_WITH_REASON`；`NECESSARY_NOT_SUFFICIENT` |
| R-2.5 | B | capability lookup 与 foundation export | lookup missing/red mutation、两 App import check | generated-only surface 不消费；`NECESSARY_NOT_SUFFICIENT` |
| R-2.6 | B | error/empty surface adapter | failure reason/action/empty state tests | 只读无错误分支需反例证明；`REVIEW_ONLY` |
| R-3.1 | C | CommandReceiptSupport、owner receipt persistence | claim/replay/conflict、10 个 SQL consumer | foundation 不拥有业务表；`NECESSARY_NOT_SUFFICIENT` |
| R-3.2 | C | nullable response/readback、migration 若必要 | legacy null claim-only、旧行可读 | reset 重建不等于生产回填；`REVIEW_ONLY` |
| R-3.3 | C | canonical cursor/collection helper | cursor advance/no duplicate/no omission | Detail/Bounded 不消费 cursor；`NECESSARY_NOT_SUFFICIENT` |
| R-3.4 | C | ServiceNodeTypes/ExtensionHostTypes/AuditEntityTypes 分桶 | 每闭集独立 red mutation、generated check | 不同语义不得合并；`REVIEW_ONLY` |
| R-3.5 | C | Problem envelope + six owner adapters + edge registration | code mapping positive/negative/generated drift | foundation 不收 owner code；`NECESSARY_NOT_SUFFICIENT` |
| R-3.6 | C | collection parse helper 与 owner error mapping | malformed cursor/page/unsupported combination | owner-specific codes留 owner；`NECESSARY_NOT_SUFFICIENT` |
| R-3.7 | C | AdvisoryLock API、调用点 | lock helper mutation、direct invocation red | helper定义处排除；`NECESSARY_NOT_SUFFICIENT` |
| R-3.8 | C | AuditEventWriter、owner audit DML | audit success/failure rollback、inline INSERT | 无审计实体的 operation `N/A_WITH_REASON`；`REVIEW_ONLY` |
| R-4.1 | A | 三类 SQL 常量分类与物理合并 | baseline/equivalence、词中间反例 | `?` 不是分类器；`NECESSARY_NOT_SUFFICIENT` |
| R-4.1a | A | 混合拼接保留/逐消费点确认 | 参数顺序 red mutation、运行时分支行为 | 无安全机械分类器；`REVIEW_ONLY` |
| R-4.2 | A | 纯换行 source 改写 | 同一 SQL/参数顺序验证 | generated SQL 不适用需列反例；`NECESSARY_NOT_SUFFICIENT` |
| R-4.3 | A | 27 个触及续行常量的混合点重测 | 全清单消费点 focused | 93 混合拼接不是最终分母；`REVIEW_ONLY` |
| R-4.4 | A | 检查脚本与编译入口 | red mutation 防止永远绿 | checker 不证明业务语义；`NECESSARY_NOT_SUFFICIENT` |
| R-5.1 | E | 27 OFFSET 与全部 collection read 分桶 | Page/Cursor/Bounded/Detail fixture | 分桶需 review；`REVIEW_ONLY` |
| R-5.2 | E | CollectionRequestSupport、CanonicalCursorIdentity | cursor malformed/边界/重复/遗漏 | owner identity 留 owner；`NECESSARY_NOT_SUFFICIENT` |
| R-5.3 | E | 前后端 collection read model | currentData/isFetching/失效 focused | L2 焦点另行授权；`NECESSARY_NOT_SUFFICIENT` |
| R-6.1 | E | owner operation、candidate source | candidate identity/permission tests | 非候选 operation `N/A_WITH_REASON`；`REVIEW_ONLY` |
| R-6.2 | E | bounded/page contract 与 edge registration | limit/unsupported cursor/typed error | bounded 不是静默截断；`NECESSARY_NOT_SUFFICIENT` |
| R-6.3 | E | problem mapping/feedback adapter | owner reason preservation | 无 UI consumer 仅后端 acceptance；`REVIEW_ONLY` |
| R-6.4 | E | generated contract/source declaration | source-to-generated drift check | generated 文件不手改；`NECESSARY_NOT_SUFFICIENT` |
| R-7.1 | B | canonical time/null/列表空态分离 | field null vs list empty render | 两者语义不同；`REVIEW_ONLY` |
| R-7.2 | B | all updatedAt/审计呈现调用点 | 22 unpinned/7 pinned 迁移扫描、time mutation | raw user input不消费；`NECESSARY_NOT_SUFFICIENT` |
| R-8.1 | D | audit presentation helper、snapshot/fallback registry | fixed/dynamic/unknown key tests | unknown extension key不猜标签；`REVIEW_ONLY` |
| R-8.2 | D | audit action/value state dictionary | four-state render、history paging/permission regression | owner dynamic facts留 owner；`NECESSARY_NOT_SUFFICIENT` |
| R-9.1 | D | cross-App capability lookup、词表 | 两 App consumer/static check | 无 UI-bearing route `N/A_WITH_REASON`；`NECESSARY_NOT_SUFFICIENT` |
| R-9.2 | D | collaboration/extension code/ref/name adapter | code/name fallback、未知值 tests | generated closed set不共享；`REVIEW_ONLY` |
| R-9.3 | D | common frontend foundation export | import/lookup/red mutation | app adapter 保留；`NECESSARY_NOT_SUFFICIENT` |
| R-9.4 | D | problem/detail/status language | 两 App failure/render | 仅后端 code 不需 render但需 acceptance；`REVIEW_ONLY` |
| R-10.1 | Z | fixed carrier inventory itself | missing/extra mechanical self-check | 只作为施工完整性门；`REVIEW_ONLY` |
| R-10.2 | Z | each R subitem's complete sync map | fixture/seed/scenario/static/render/red/check rows | `N/A` 必须有反例理由；`REVIEW_ONLY` |
| R-10.3 | Z | CP completion criteria | no implementation handoff with missing carrier | 不能由动态验收补漏；`NECESSARY_NOT_SUFFICIENT` |
| R-11.1 | A-E | helper ownership matrix/index | helper import/consumer and retained-responsibility checks | TestIds not shared；`REVIEW_ONLY` |
| R-11.2 | A-E | AST/ArchUnit/call-site gates + helper | five red mutations + behavior tests | 任何门不能单独证明闭包；`NECESSARY_NOT_SUFFICIENT` |
| R-11.3 | A-E | all affected consumer migrations | helper->consumer proof、direct bypass search | helper存在不等于消费；`REVIEW_ONLY` |
| R-11.4 | A-E | `project-memory/practices/frontend-capability-lookup.md` 与 `project-memory/practices/backend-capability-lookup.md` | 两张能力查找表在 helper rename/export 后均可查到真实 symbol；lookup 不替代代码调用 proof | index不替代代码调用 proof；`NECESSARY_NOT_SUFFICIENT` |

## 9. 每个 CP 的通用实施单元

每一个实际变更点都按以下顺序执行，不能把多个 owner 或多个 UI surface 合并成“整体改完再看”：

1. **定位**：重开对应 R 原文、详设段落、memory 命中、owner source、契约/生成源、同类正例和反例。
2. **声明**：先改唯一声明源或 helper contract；不得先改 generated 文件、前端副本或 fixture。
3. **传递**：由生成链、owner command、app adapter 或 wire adapter传递；记录事务、权限、缓存失效和错误映射。
4. **消费**：迁移所有本 CP 分母内的消费者；每个消费者保留其业务责任，不把 owner 判定下沉到 foundation。
5. **focused proof**：先运行能直接证伪该变更的最小静态/单测/行为检查；读取日志或测试输出，保留 first failure、last known good、broken boundary、business 和 cleanup 分开判读。
6. **回读**：用第 1 步同一组原文回读源码、测试、fixture、seed 和检查器，确认 helper 真被消费、没有复制第二份实现、没有遗漏可选输入。
7. **CP 对账**：由 fresh reviewer 逐项比对三维输入，只有 `MATCHED` 才进入下一单元。

任何一步发现原需求与 owning source 不成立，立即 `OPEN` 停在当前 CP，交 Dexter 处理产品/权限/范围变化；不在计划里偷偷加例外。

## 10. 验证顺序与证据口径（未来实施时）

实施授权取得后，验证顺序固定为：

1. source/static：生成源、契约、闭集、调用点、R-10 载体分母、R-11 helper 消费者；
2. focused：helper 行为、red mutation、SQL 反例、owner persistence、前端 render/static；
3. backend acceptance：真实 HTTP、真实容器、`CONTRACT` 与 `BUSINESS` 分开，`DB_OPERATIONS` 只作场景信息；
4. 如另有授权，再执行 reset/seed/DEV 或 Browser L2；浏览器之前必须先完成 IA 逐控件位置/样式/行为对账，任何 OPEN 都阻断 L2；
5. 每个动态 run 单独报告 business 与 cleanup。cleanup 失败不得被 business PASS 覆盖，未运行不得写 PASS。

截至 2026-09-19，CP-E 已有以下实际验证：`scripts/check/lifecycle-vocabulary` 正常门与
`--self-test` 均通过（39 张表，20 主数据/19 豁免）；R11 与前端架构 self-test 均通过；
`CanonicalCursorIdentityTest`、`BusinessChannelSalesMenuOwnerTest` 通过。顶层
`OperationsExternalCollaborationControllerTest` 的本机 Gradle 尝试被仓内
`V2S_TESTCONTAINERS_REMOTE_REQUIRED` 拒绝，这不是本机 fallback；该用例必须由受管远端
Testcontainers runner 执行，不能把这次本机拒绝写成业务失败或通过。

另外，`node scripts/generate/edge-codegen.mjs --check` 当前为 `PASS`（403 files），
`node --test scripts/test/r5-remote-testcontainers.test.mjs` 当前为 25/25 `PASS`；这些是
生成/runner 静态与单测证据，不升级为完整 backend acceptance。全量 acceptance 的业务事实与
测量证据必须以后续新的受管 run 重新取得，不能复用测量首败或 source sync 失败 run。

统一静态验证已执行到 backend 阶段，首次失败边界为既有全量
`backendJavaUtf8LineLimit`：该门扫描所有非生成 Java 源，当前约 225 个文件/7275 行超出
120 UTF-8 字节限制，不能只修首批报告行后宣称全量 spotless 通过，也不在本 CP 扩大为跨批次
格式重构。故 `FULL_STATIC_VERIFY=OPEN_EXISTING_BACKEND_LINE_LIMIT`；后续报告必须把该
基线门与 CP-E 业务 proof 分开。未授权或未运行的 reset、seed、DEV、Browser L2、UAT 仍保持
`NOT_RUN`/`NOT_AUTHORIZED`，本计划不伪造输出或 readback。

## 11. CP-Z · 全批三维对账与逐代码与详设对账

### 11.1 全批三维整体对账

A-E 完成后，主 agent 重新读取：需求稿 R-1.1 至 R-11.4、本文、详设、IA/interaction（适用时）、project-memory practices/decisions 和所有实际 changed source。对照维度至少包括：行为、形态、动作、关系、位置、用户可见文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据来源/失效边界、owner/事务/审计、fixture/seed/acceptance/检查器。

它必须独立于各 CP 的汇总，不得用“每个 CP 都 MATCHED”直接推出全批 MATCHED；跨 CP 的 helper、生成物、错误映射、时间/空值和 seed 阶段顺序必须重新核对。

### 11.2 逐代码与详设对账（交付前硬门）

这是实施结果交给 review 的前置条件，不是可选报告。对账人由主 agent 执行首轮，随后由 fresh 独立 reviewer 只读复核。对账输入是：

- 详设中的每个 operation、owner、helper、事务、错误、readback、UI surface 和 R-10/R-11 行；
- 实际变更的每个生产、契约源、generated 派生、迁移、测试、fixture、seed、脚本/检查、foundation index 和文档引用；
- 对应 focused/acceptance/static/render 输出及未运行项的真实状态。

每一行必须记录：`design anchor`、`implementation anchor`、`consumer/fixture/seed carrier`、`proof level`、`business`、`cleanup`、`status`。状态只允许：

- `MATCHED`：实现位置、行为、失败边界、调用者和测试/seed 载体均与详设逐项一致；
- `OPEN`：任一缺失、错位、未核验、证据越权或产品语义漂移。

禁止用 `PARTIAL`、`PASS_WITH_EXCEPTION`、`ASSUMED` 等词把 OPEN 隐藏。出现 OPEN 时不交付 implementation review，不通过增加一次动态运行来掩盖设计/实现偏移。

### 11.3 P9 收口模板

```text
P9_SCOPE=R-1.1..R-11.4 + all changed source/test/fixture/seed/check/generated paths
P9_DESIGN_SOURCE=2026-09-18-v2s-fullstack-reuse-and-consistency-implementation-design-codex.md
P9_PLAN_SOURCE=2026-09-18-v2s-fullstack-reuse-and-consistency-implementation-plan-codex.md
P9_STATUS=MATCHED | OPEN
P9_OPEN_ITEMS=<逐项列出；非零不得交付>
BUSINESS=<separate result>
CLEANUP=<separate result>
IMPLEMENTATION_REVIEW_HANDOFF=BLOCKED_IF_P9_OPEN
```

## 12. 实施后独立 review 交接门

只有以下条件同时成立，才组织 Dexter/Claude review brief：

1. CP-A 至 CP-E 和 CP-Z 无 `OPEN`；
2. R-10 每一项有明确同步处置，R-11 每一个 helper 有真实消费者和反例；
3. 逐代码与详设对账为 `MATCHED`；
4. 运行过的 business/cleanup 结果分别可追溯，未运行项保持 NOT_RUN/NOT_AUTHORIZED；
5. UI-bearing 范围已完成逐控件 IA 对账，L2 未被前置门放行；
6. fresh 独立 `REVIEW_TARGET=IMPLEMENTATION` reviewer 已取得详设、当前生产源码和实际 evidence，先形成独立 verdict，再由作者处置，不把本计划当作 review 结论。

本轮不创建 review verdict；当前只是把未来交付所需的输入、核验重点和授权边界写清楚。

## 13. 停止条件与交 Dexter 的问题格式

以下任一情况出现即停在当前 CP：

- 需求/详设与 owning source 的 owner、权限、事务、生命周期或数据身份冲突；
- R-10 发现新的未列载体，或 fixture builder 强制了本应可省略的参数；
- R-11 helper 会依赖 owner/generated 类型，或只能复制第二套实现；
- 三类闭集、回执、审计、错误码或 collection shape 无法在不改变已裁决语义的情况下统一；
- 需要新增 migration、reset/seed、DEV、L2、UAT 或部署授权；
- baseline 已被 SQL 变更污染，或 cleanup 不能确认；
- 需要引入 fallback、兼容层、业务字符串兜底或扩大 foundation 责任。

交 Dexter 时必须给：当前字节路径/锚点、已核实事实、冲突边界、最小候选方案、被拒的更小/更大方案、用户/权限/数据/测试 seed 影响、是否改变授权。不得用“详设自行决定”隐藏待裁决产品语义。

## 14. 当前状态

```text
DESIGN_STATUS=ACCEPTED_IMPLEMENTATION_IN_PROGRESS
IMPLEMENTATION_AUTHORITY=true
PRODUCTION_CODE_CHANGED=true
CP-A_B_C=STEP_MATCHED
CP-D=STEP_MATCHED_AFTER_FRESH_REVIEW
CP-E=STEP_MATCHED;FOCUSED_REMOTE_PASS;FULL_ACCEPTANCE=OPEN_EXTERNAL_REMOTE_HOST_SOURCE_SYNC
CP-Z=WHOLE_BATCH_RECONCILIATION_IN_PROGRESS
CONTRACT_GENERATION=PASS_EDGE_CODEGEN_403;EDGE_CODEGEN_CHECK=PASS
BUILD_TEST=FOCUSED_TYPECHECK_AND_UNIT_PASS;REMOTE_RUNNER_TESTS=25/25_PASS;FULL_STATIC_VERIFY=OPEN_EXISTING_BACKEND_LINE_LIMIT
REMOTE_BACKEND=OPEN_EXTERNAL_REMOTE_HOST_SOURCE_SYNC;BUSINESS_AND_MEASUREMENT_CURRENT_RUN=NOT_RUN
RESET_DEV_SEED=NOT_RUN
BROWSER_L2_UAT_DEPLOY=NOT_RUN_NOT_AUTHORIZED
P9_STATUS=NOT_APPLICABLE_WITH_REASON:CP-E/CP-Z 未完成
HANDOFF_TO_DEXTER_CLAUDE=BLOCKED_UNTIL_CP_A_TO_E_AND_CP_Z_CLOSE
```

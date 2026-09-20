# 前后端复用性与一致性收敛 · 实现向详设

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0  
DESIGN_KIND=IMPLEMENTATION_FACING_DESIGN  
STATUS=PROPOSED_REVIEW_ONLY  
BUSINESS_SOURCE=doc/plans/platform/2026-09-18-v2s-fullstack-reuse-and-consistency-requirements-claude.md  
JOURNEY_REFS=NO_NEW_JOURNEY;现有 UI-bearing surface 必须沿用各自已批准 Journey/IA/interaction 工件  
IA_REF=现有受影响页面的批准 IA；本批不新造 IA  
INTERACTION_REF=现有受影响页面的批准交互工件；本批不新造交互工件  
AUTHORIZED=只编写本详设与实施计划，并做只读源码/规范核查  
NOT_AUTHORIZED=生产代码、测试代码、契约生成、迁移、构建、测试执行、backend-acceptance、reset、DEV、seed、Browser L2、UAT、部署、Git  
IMPLEMENTATION_AUTHORITY=false  
RUNTIME_AUTHORITY=NONE  

## 0. 设计准入与当前边界

本文件把需求正本的 R-1 至 R-11 变成可以逐代码、逐测试载体、逐 seed 载体对账的实施输入，但不把任何计划动作写成已执行事实。

本次重新打开的输入：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、当前程序 Roadmap 授权字段；
- `project-memory/index.md` 全部 kernel，以及按六维路由命中的 deterministic context、owner/lifecycle、collection boundary、frontend capability、drawer lifecycle、backend acceptance、test closed loop、independent review 原文；
- `scripts/README.md`、`doc/platform/backend-coding-standard.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/foundation-charter.md`；
- `doc/decisions/templates/implementation-design-template.md`、`doc/platform/implementation-task-template.md`、`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`；
- `doc/plans/platform/2026-09-18-v2s-fullstack-reuse-and-consistency-requirements-claude.md` 当前字节及其指定 owning source。

Roadmap 的历史/其他批次实施字段不扩大本轮授权；本轮唯一可执行动作是写这两份文档。若后续 Dexter 重新授权实施，仍需按本详设重新走 P0，不得把本文件的静态准备当作实施或运行证据。

### 0.1 已重开的承重事实

| 事实 | 当前 owning source | 设计约束 |
| --- | --- | --- |
| 回执 SQL 是 10 个 owner 文件 | `business-channel/.../BusinessChannelCommandReceiptServiceSql.java`、`collaboration/.../CollaborationCommandReceiptServiceSql.java`、`extension/.../ExtensionCommandReceiptServiceSql.java`、`organization/.../BusinessEntityCommandReceiptServiceSql.java`、`CommercialGroupCommandReceiptServiceSql.java`、`OrganizationHierarchyCommandReceiptServiceSql.java`、`platform-admin-iam/.../PlatformCommandReceiptServiceSql.java`、`store-contract/.../ContractCommandReceiptServiceSql.java`、`workspace-iam/.../WorkspaceIamCommandReceiptServiceSql.java`、`workspace/.../WorkspaceCommandReceiptServiceSql.java` | 丙批按 10 个逐文件施工；不得把 workspace owner 漏掉，也不得把 persistence/测试文件算作 ServiceSql。 |
| SQL 续行声明扫描不能靠 `?` 分类 | 原基线 `CatalogDefinitionFactsSql.java:31-32` 把 `LIMIT ?` 从词中间切开；`CatalogWorkbenchReadServiceSql.java:107,110,112-115` 有无占位符的语义子句；消费点在 `CatalogDefinitionFacts.java:164-168`、`CatalogWorkbenchReadPersistence.java:371-384` | `?` 只圈必审子集；它不是第二类的完整分类器，也不是 R-4 分母；当前三类反例由 `scripts/check/backend-sql-readability-counterexamples.mjs` 负责 focused 保护。 |
| 当前测量有 661/662 差异 | 需求正本 R-4.1a 与当前声明扫描 | 实施前冻结扫描根、扩展名、排除项、命令和输出快照；数字只作 discovery note，不作闭包门或施工分母。 |
| ArchUnit 依赖存在、方法级门不存在 | `apps/backend/catering-business-server/build.gradle.kts:85`；`src/test/java/architecture/BackendModuleBoundariesTest.java:36-116` 当前只有类/依赖规则 | 详设必须新增方法级 call-site rule；不得写成“复用现成方法级规则”。 |
| AdvisoryLock 自身含 advisory SQL | `modules/foundation/.../persistence/AdvisoryLock.java:20-30` | advisory lock 绕过门必须排除 helper 定义处；否则门先把合法 helper 判红。 |
| foundation 当前没有 command 包 | `modules/foundation/src/main/java/com/catering/v2s/platform/foundation/` 下现有 collection/contract/diagnostic/json/persistence/runtime/security/seed/time/workspace | 回执 SPI 放到已有 `persistence`/`contract` 能力边界；不发明 `foundation.command` 业务包。 |

### 0.2 不新增的控制面

本设计不新增 package-exit、compliance-control、receipt 台账、hash-chain、六类 source 分母、P0/W0/P1、旧 provider/registry、性能 baseline 或新的平行 Roadmap。R-10 是实现分母同步要求，不是新控制面；R-11 的门只落在既有 `scripts/verify`/`tools/verify-gates`/ArchUnit/真实 focused behavior test 能力上。

## 1. 用户任务、代价与方案比较

### 1.1 要解决的真实问题

Dexter 要的不是一组“看起来复用”的文件，而是让后续功能在已有能力存在时有明确目的地，并且让两个管理后台对同一业务事实保持相同的用户心智。当前后端横切逻辑在没有可插入的 owner-neutral 住址时另起炉灶；前端则在 foundation 已存在或应该存在时各自复制。结果是状态词、时间、空值、回执、异常、分页 identity 和用户可见交互在同一业务事实下分叉。

如果只修用户可见字符串，不修目的地，下一批会再次复制；如果只建 helper，不把调用点和测试/seed 分母纳入，helper 可以存在但生产路径仍绕过它；如果只改生产代码，不同步 fixture builder 签名和 seed 正本，默认输入路径仍会在验收中消失。

### 1.2 方案比较

| 方案 | 结果 | 裁定 |
| --- | --- | --- |
| A. 各 feature 逐处修正，靠 code review 记忆保持一致 | 可快速改少量文件，但没有统一目的地；改名、别名、下一批新增都会重新分叉，无法解释 R-11 的用户/数据风险 | 拒绝 |
| B. 建一个吞掉所有生成类型、错误码、owner 事实和 UI 行为的超级 foundation | 破坏 owner 主权、跨 App generated 边界和 feature 的闭集穷举；把展示共性错误地变成业务共性 | 拒绝 |
| C. 按真实重复职责建立窄 helper；owner/feature 保留业务事实与类型证明；调用点由 AST/ArchUnit/行为测试和逐代码 review 共同约束 | 既有目的地被复用，shared 层不反向依赖 app generated 类型，机器门只承担可机械的必要检查，语义由 review/behavior proof 承担 | **采用** |

我选 C 而不是 A/B，因为它只抽取仓内已有错误示范证明会影响用户或数据的职责，不把“所有形状相似”误判成可共享；同时承认没有任何文本门单独 `PROVES_CLOSURE`，避免把形式信号冒充机制闭包。

## 2. 不变量与 owner 边界

1. 一个业务 deployable、一个数据库、一个 Flyway history；foundation 不拥有任何业务表。
2. owner 保有事实、表、命令和 readback；shared helper 只能接收已结构化的通用输入，不反向 import owner/generated 业务类型。
3. 业务失败由 owner 产生 typed code；edge 负责注册和映射，前端只按自身 app 的 problem-code 闭集呈现。
4. 前端服务端事实只有一个住址；local state 只保存查询身份、选择、草稿、分页游标和 UI 生命周期，不镜像 owner 数据。
5. 批量、回执、审计、锁、事务和 authoritative readback 是业务事实保护，不得为降低 DB 数字而删减。
6. 每一条判据都有闭包等级：`PROVES_CLOSURE`、`NECESSARY_NOT_SUFFICIENT`、`REVIEW_ONLY` 三选一。本设计不把任何现有文本/存在性门写成 `PROVES_CLOSURE`；若实施者能提出真正的全集证明，必须同时写出漏检条件、反例和为何不存在，交评审复核后才可升级。

## 3. CP 总览与依赖

| CP | 内容 | owner | 主要产物 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-0 | 施工前事实、扫描根、R-10 分母、R-11 helper 目的地确认 | 主 agent / 各 owner 只读确认 | 分母与 source map、baseline 方案、停止条件 | 本文、需求正本、memory |
| CP-A | R-4 SQL 续行常量三分类与 text block | backend 各 SQL owner | 迁移后的 SQL 源码、baseline/等价性报告、focused 反例 | CP-0；必须先于修改 SQL 的丙批 |
| CP-B | R-1/R-2/R-7 生命周期、确认、时间、字段空值 | frontend foundation + 两 App | helper、adapter、状态/确认交互、时间/空值迁移 | CP-0；可与 CP-A 并行 |
| CP-C | R-3 回执、并发、跨界闭集、Problem、参数解析、锁、审计写入 | foundation + 各 owner | generic SPI、owner persistence 迁移、Problem adapter、cursor/lock/audit helper | CP-A；10 个 receipt SQL 文件 |
| CP-D | R-8/R-9 审计呈现、跨 App 纯闭集、transport | frontend foundation + 两 App | 注册表、adapter、transport helper、审计回归测试 | CP-B；R-3 audit wire 变更完成后接入 |
| CP-E | R-5 集合边界、R-6 规范模板/生命周期门 | backend/frontend/platform governance | Page/Cursor 分类、canonical cursor adapters、禁止句门、模板载体 | CP-0；R-5 先分类 |
| CP-Z | R-10/R-11 逐条同步、三维对账、逐代码对账、独立 review 输入 | 主 agent + fresh reviewer + Claude | 全量分母、对账表、review brief | CP-A–E；不替代正式 review |

CP-A 与 CP-B 的并行只表示源文件集合不重叠；CP-C 必须等待 CP-A 的 baseline 与 SQL 修改完成。CP-D 依赖 CP-B 的 shared presentation 住址，审计 wire 依赖 CP-C 的结构决定。CP-Z 每批都执行一次，不是只在最后执行。

## 4. 横切机制对照表

| 机制 | ① 现成能力/规范与落点 | ② 最低可证伪观察及闭包等级 | ③ 无现成能力时的实现形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `workspace-iam/.../WorkspaceUserService.resolveTaskScope`、`organization/.../OrganizationTaskPathLookup`；kernel `TASK_READ_JOIN` | 用不同 assignment 与同一 workspace/target 读相同事实，断言 owner 目标与祖先路径；静态只证明调用点，行为测试捕捉错误 scope；`NECESSARY_NOT_SUFFICIENT`（别名/错误 target 仍需 review） | 新 helper 只封装 scope 输入/结果，不从列表行或前端 query 推导身份；owner 必须在 read/write 各自复核 | 所有现有 HTTP read/write 受 R-3/R-5/R-8/R-9 影响的 owner operation；无新 route 自行扩大权限 |
| 写授权与 grant 复核 | `OWNER_RECHECKS_COMMAND`；各 owner public command API；现有 grant/target resolver | 直接 HTTP 使用未授权 assignment、停用对象和跨 scope 目标，分别断言 typed 拒绝且无写入；`REVIEW_ONLY`（权限组合全集需按 operation inventory 对账） | 共享层不拥有 grant；owner command 内复核；feature 不以成功的前端页面作为授权证明 | 六个 Problem owner、所有命令 entry、R-3 回执 owner |
| 跨 owner 写与事务 | `COMMAND_REQUIRED_TRANSACTION`、各 owner public API、`AdvisoryLock` | 任一第二 owner/审计/回执失败后 readback 无半写；静态检查 import/DML 边界，acceptance 检查最终事实；`REVIEW_ONLY` | foundation 只给 SPI；跨 owner 通过 public command + 同一 `REQUIRED` 事务，禁止 coordinator 直写表 | 10 个 receipt owner、audit、catalog/business-channel、所有 R-3.1/R-3.2/R-3.8 |
| 集合形态与分页 | `OpaqueCollectionCursor`、`project-memory/practices/collection-boundary-modes.md`、`foundation-charter.md §1-J` | 先完成 Page/Cursor/Bounded/Detail 分类；Cursor fixture 超过一页验证推进、无重复、无遗漏、total；`REVIEW_ONLY`（业务形态不能由源码参数自动推导） | Cursor 使用 canonical identity + keyset；Page 保留页号/offset；Bounded 明确上界并拒绝静默截断 | 当前所有 collection read；重点为 27 个 OFFSET 文件和严格 keyset 6 个/当前发现口径 |
| 缓存失效/刷新 | foundation refresh primitives、`cache-invalidation-granularity.md` | 写后只读 owner readback，切 scope/Tab 后旧事实不出现；`NECESSARY_NOT_SUFFICIENT`（焦点/真实用户行为需 L2） | 缓存 tag 等于受影响 read model；不建全局业务 store | 两 App 受影响的列表、详情、审计、状态/时间展示 |
| RTK currentData/isFetching | `frontend-coding-standard.md §3-B`、现有 RTK query model | scope 变化时旧 `currentData` 不渲染，失败清空业务数据；`NECESSARY_NOT_SUFFICIENT` | query identity 包含 scope/filter/cursor；loading 与 stale 保持区分 | 两 App 所有受 R-1/R-2/R-7/R-8/R-9 影响 query |
| 同一事实只有一个住址 | `frontend-coding-standard.md §3-E`、`read-model-granularity.md` | 更新后刷新同一 owner read model，重挂载/切 tab 不丢失；`REVIEW_ONLY`（列表与抽屉全量消费需逐代码） | local state 只留 draft/selection/lifecycle；不得把 server object copy 到 Redux/local cache | status/time/null/audit/extension/receipt 相关所有 surface |
| 失败可见且原因不改写 | `frontend-coding-standard.md §3-D`、`backend-coding-standard.md §2-B/§1-D` | 每条 failure path 有 owner 原因、归属对象、下一步；错误不被空集合/网络通用文案吞掉；`REVIEW_ONLY` | typed problem 进入 edge 注册和 app feedback map；原位错误优先于全局 message | 两 App feedback、所有新 helper/adapter、owner failure paths |
| owner 错误到 HTTP 映射 | `ContractProblemAdvice.java`、活动 edge catalog/materializer、OpenAPI `x-error-codes` | 每个新增/变更 code 在 disposition、augmentation、materialized path、generated enum 四处一致；`NECESSARY_NOT_SUFFICIENT`（同义 code 仍需语义 review） | 选定的 shared envelope 只统一 shape；code 闭集仍由 owner/app 持有 | R-3.5/R-3.6、R-5、R-6 门、R-10/R-11 check failure |
| 幂等键与重放 | 现有各域 `*CommandReceiptService`；`frontend-coding-standard.md §3-G` | 同 key 同 payload 两次得到同一 readback；同 key 不同 payload typed 拒绝；null legacy 回执 claim-only；`NECESSARY_NOT_SUFFICIENT` | foundation 提供协议/哈希/claim/序列化 SPI；每个 owner 保留表、SQL、persistence、readback | 10 个 receipt service/SQL/persistence 与所有命令 owner |
| 生成物不得手搓 | `edge-codegen.mjs`、现有 generator、`backend-coding-standard.md §2-D` | source 改动后 `--check` 识别 generated 漂移；`NECESSARY_NOT_SUFFICIENT`（生成内容业务语义仍 review） | 只改 declaration/source，generated 由生成链产出；前端 dictionary 不复制 generated API | contracts、generated Java/TS、admin catalog、所有 R-3/R-9 闭集 |
| 日志与脱敏 | `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`、`RequestCompletionEvent` | 受管执行日志含 phase/identity/correlation/firstFailure，且无 secret/raw payload；`NECESSARY_NOT_SUFFICIENT`（日志存在不证明业务正确） | 使用结构化脱敏事件；URL 原文、token/cookie、手机号、登录名、raw payload 不记录 | 每批脚本、helper test、acceptance、seed executor |
| 迁移/回填/可逆性 | additive Flyway、`NO_PHYSICAL_DELETE_FOR_ENTITIES`、历史 response null 规则 | 旧行可读、新列 nullable/默认、无未授权 destructive drop；`REVIEW_ONLY` | C-5 的 DEV reset 重建不转成生产历史回填；不新增兼容层 | 10 个 receipt 表、R-3.2、R-4 无 migration、R-5/R-6 无业务表迁移 |
| 前端共享 Drawer/列表/表单生命周期 | `useDrawerFormLifecycle.ts`、`overlayLock.tsx`、`AdminDetailActionMenu`、`SalesMenuPage`、`frontend-capability-lookup.md` | 每个真实动作节点都有 app `*TestIds.ts`；dirty/close/submit lock 只由 foundation；`REVIEW_ONLY`（用户焦点/滚动需 L2） | 新增独立 `AdminRowActionMenu` 只处理行菜单；详情继续 `AdminDetailActionMenu`；子控件不得自建 dirty/提示 | 两 App 受 R-2、R-7、R-8、R-9 的 UI-bearing surface |
| 候选/下拉数据源 | owner API 与各域 candidate read | 选项来自 owner read model，不从 list row/本地镜像推导；`REVIEW_ONLY` | 业务自定义条目返实体；代码闭集前端 dictionary；不造词汇表接口 | R-8 审计词表、R-9 collaboration/extension、R-5 cursor candidate |
| 编码与名称呈现 | `confirmed-business-language-corpus.md`、前端 dictionary、owner read model | 同一 code/状态跨两 App 同文案；`NECESSARY_NOT_SUFFICIENT` | `code/ref/name` 保持结构化；后端不拼展示句；用户文案只在业务 corpus/共享纯值注册表 | R-1.3/R-1.5、R-8/R-9、各 owner list/detail |
| 会同时坏的东西的原子组 | `foundation-charter §5-C`、owner `REQUIRED` command | 任一写入、审计、回执、锁、readback 失败，断言事务最终事实；`REVIEW_ONLY`（数据库并发边界仍需 acceptance） | owner command 是原子边界；shared helper 不拥有业务 DML；测试与 seed 同批进分母 | 10 receipt owner、R-3 audit/lock、所有跨层写命令 |

## 4a. UI/L2 前置状态

本轮没有 UI 实施、L2 脚本或 locator 变更授权；因此不把静态文档准备写成 UI 通过：

```text
UI_DESIGN_REVIEW=REVIEW_ONLY_EXISTING_SURFACES
TESTID_REVIEW=NOT_APPLICABLE_WITH_REASON:本轮只写跨批详设，不新增或修改 L2 控件绑定
L2_SCRIPT_ADMISSION=BLOCKED_BY_AUTHORITY
```

若后续实施触及 UI，必须在任何 L2 spec/locator 前，按当前批准的 Journey/IA/interaction 与 `frontend-coding-standard.md §3-K-9` 建立实际控件分母，逐控件核对位置、样式、行为、失败/恢复、焦点和真实动作节点；“有 testId”不能代替该对账。

## 5. Helper 归属与 R-11 闭包等级

### 5.1 归属矩阵

| helper 目的地（能力命名） | helper 承担 | feature/owner 保留 | 现有错误示范与边界 |
| --- | --- | --- | --- |
| `libraries/frontend/admin-ui-foundation/src/presentation/lifecycleLabels.ts` 与 `LifecycleStatusTag.tsx` | 三态值、标签和颜色呈现 | 各 generated status 的 `satisfies Record<...>`、合同/账号/资产等非主数据状态机；**`apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogLifecycleStatusTag.tsx` 的生命周期标签消费共享三态常量，但 `shapeKey` 等 catalog 域内枚举继续由 `apps/frontend/operations-admin/src/features/catalog-management/model/catalogManifestLabels.ts` 的后端 manifest（`catalogEnumLabel`）拥有** | 19 个用户可见“标记删除”文件；不得把所有状态机压成三态，也不得把 catalog 域内枚举从 manifest 抽走 |
| `libraries/frontend/admin-ui-foundation/src/overlay/statusChangeConfirm.tsx` | 普通/危险确认、提交锁、错误原位呈现 | 每个 feature 的动作语义、影响范围和权限 | 六个 StatusModal 逐份复制；Modal 承载形态按 C-4 保留 |
| `libraries/frontend/admin-ui-foundation/src/overlay/rowActionMenu.tsx`（新增） | 行末 Dropdown 的统一菜单容器、禁用/危险/loading/testId 接口 | 行数据、动作项、权限和回调 | 6 个消费者统一使用；`CatalogWorkbenchItemList.tsx:87` 的批量菜单明确排除；详情仍使用 `AdminDetailActionMenu`，两者不合并 |
| `libraries/frontend/admin-ui-foundation/src/time/formatCanonicalDateTime.ts`（新增） | `zh-CN`、`Asia/Shanghai`、medium date/time、日期 null/0/空值 | 业务字段选择、非时间字符串和输入表单日期 | 22 处不钉时区、7 处钉上海时区；不得使用浏览器时区 |
| `libraries/frontend/admin-ui-foundation/src/presentation/displayFieldValue.ts`（新增） | 字段级 null/undefined/空字符串的破折号 fallback | 空态、无权限、未配置、不适用的业务解释 | 三种字段级空值写法；空态继续遵守 §3-K-5 |
| `libraries/frontend/admin-ui-foundation/src/presentation/auditChangePresentation.ts`（新增/迁移） | 固定字段 label、动作码、四态展示、历史 snapshot 优先 | owner dynamic key、各 App generated type adapter、权限 | 两 App 函数体相同但标签/动作码分叉；扩展未知 key 不猜中文 |
| `libraries/frontend/admin-ui-foundation/src/http/transportResponse.ts` | `readCurrentDefinitionRevision`、`transportResponseStatus` 等纯 HTTP 解析 | app 的 generated API、problem-code 闭集与 `problem()` 适配 | 两 App 逐字节重复；`problem()` 不整体共享 |
| `modules/foundation/.../persistence/CommandReceiptSupport.java`（新增） | request hash、claim、同 key replay、nullable legacy claim-only、序列化 SPI | 每个 owner 的表、SQL、persistence、response/readback type、事务事实 | 10 个 service/15 张表/4 种 payload；foundation 不执行业务 DML |
| `modules/foundation/.../collection/CollectionRequestSupport.java`（新增） | optional/pageSize/cursor 的结构化解析结果 | owner 的 Problem code 与 Page/Cursor 业务分类 | 8/7/4 处重复解析；不会藏 owner-specific error code |
| `modules/foundation/.../collection/CanonicalCursorIdentity.java`（新增或扩展既有 `OpaqueCollectionCursor`） | 一种 canonical identity 编解码 | 三个 wire adapter、每个 operation 的业务 identity 字段 | 五处长度前缀、单元分隔符、SalesMenu 未转义 filter；不把 filter 直接拼接 |
| `modules/foundation/.../persistence/AdvisoryLock` | 锁 API 和参数规范 | lock key 的业务选择、事务边界 | 4 处绕过；helper 定义处不受绕过门约束 |
| `modules/audit-model/.../AuditEventWriter`（SPI） | 结构化审计事件写入协议/字段态 | owner 表与 DML、事实、权限、事务 | 7 份 SQL 加 1 处 inline audit insert；inline `StoreServicePointService.java:558` 不会被 R-4 吸收 |
| shared owner problem shape（foundation contract + owner adapter） | 统一 Problem envelope shape | 6 个 owner 的 code enum、业务上下文、edge 注册 | `ContractProblemAdvice.java:83-122` 两条多分支链；不让 foundation import owner code |

业务失败 envelope 选择“共享 envelope shape + owner adapter”，不是把所有错误码收进 foundation：这样去掉 advice 的按类分支，同时保留 owner 的错误事实和 generated closed set。该选择是实现向设计决定，须在 P0 用当前 advice、generated code 和六个 owner Problem 逐一反向核验；若发现某 owner 的错误语义无法满足接口，停在 P0 交 Dexter，不自行降级成字符串异常。

**C-2/C-3 的取值与归属冻结**：跨域主数据生命周期的三个用户可见值固定为 `ENABLED=启用`、`DISABLED=停用`、`VOIDED=作废`，不带“已”。这覆盖 `project-memory/decisions/owner-read-model-and-lifecycle-standard.md:66` 的旧 base-1 文案“标记删除”；该旧裁定必须在实施相应规范同步时按 C-2 改写。C-3 不把 catalog 全部枚举搬进 foundation：`CatalogLifecycleStatusTag` 改为消费共享生命周期常量，而 `shapeKey` 等 catalog 域内枚举继续由后端 manifest 和 `catalogEnumLabel` 驱动。C-4 只豁免 catalog 的 Modal 承载形态，不豁免上述文案、颜色或归属规则。

### 5.2 R-11.2 门—反例—闭包证明

| 逻辑 | 必要门 | 已知绕过/误报 | 补足与等级 |
| --- | --- | --- | --- |
| 时间格式化 | TypeScript AST 检查生产调用点只允许调用 canonical helper；helper 定义、test、generated 排除 | 别名、动态属性调用、测试假绿；helper 自身实现错误 | helper 变异后两 App focused behavior 必须红；`NECESSARY_NOT_SUFFICIENT`，剩余交逐代码 review |
| 生命周期颜色/标签 | AST 禁止 feature 内联生命周期 color map/用户文案，排除 helper 定义 | 改名 map、computed object、generated 输出 | helper 变异 + 两 App render tests；`NECESSARY_NOT_SUFFICIENT` |
| 参数解析 | 在 `BackendModuleBoundariesTest` 新增 ArchUnit 方法级 call-site rule；只允许 owner 调 shared parser | ArchUnit 对反射/字符串调用不可见；同义自建方法可改名 | 对 `JavaCodeUnit` method calls 做 focused rule，另加行为 test 与逐代码 review；`NECESSARY_NOT_SUFFICIENT` |
| 三态字面量 | production source 禁止 feature/app 内联中文状态词，helper/固定 corpus/生成物排除 | 拼接、Unicode 转义、不同语言同义词 | front/back behavior + corpus review；`NECESSARY_NOT_SUFFICIENT` |
| advisory SQL | source/AST 检查 `pg_advisory_xact_lock` 及等价 direct invocation，只排除 `AdvisoryLock.java` 定义 | 拆分字符串、参数化构造、不同 SQL 形态 | `AdvisoryLock` mutation 必须使使用点行为失败；剩余等价 SQL 只能逐代码 review，`NECESSARY_NOT_SUFFICIENT` |

现成 TS AST 能力确实位于 `tools/verify-gates/cli.mjs:8,112-124,150-159`；后端 ArchUnit 依赖确实存在，但方法级规则必须新增。任何 R-11 门的源文本/AST结果都只能作为必要检查，不得宣称 `PROVES_CLOSURE`。

### 5.3 Helper 强制消费与索引

每个 CP 的详设和实施记录必须有一行 `helper -> consumer -> retained feature responsibility -> proof`。新增或移动的 frontend helper 同步 `project-memory/practices/frontend-capability-lookup.md`；backend helper 明确同步 `project-memory/practices/backend-capability-lookup.md`。索引同步本身是可查找性要求，不替代调用点 proof。实施的逐代码与详设对账必须逐项验证实际调用，而不是只查 helper 文件存在。

## 6. R-4 SQL 设计

### 6.1 三类分法

1. **纯物理换行**：只为 120 列切开的静态连续片段，且消费顺序不携带参数/子句语义；合并为 Java text block。
2. **静态语义片段**：`FILTER/WHERE/GROUP BY/ORDER BY`、词中间切开的字符串、无占位符但会影响 SQL 结构或参数位置的片段；没有安全的机械分类器，必须逐消费点确认。
3. **运行时/条件片段**：为插入运行时值或条件分支而存在；保留结构，用行为测试证明最终 SQL/参数关系。当前发现的 93 个混合拼接、其中 27 个触及续行常量只作施工起点，实施前重新测量。

`?` 信号只圈必审子集（当前扫描为 662，需求记录为 661），不能把剩余项推成第一类；原基线中的 `CatalogDefinitionFactsSql.java:31-32` 和 `CatalogWorkbenchReadServiceSql.java:107-115` 已作为反例来源，当前代码由 `scripts/check/backend-sql-readability-counterexamples.mjs` 固定检查 `LIMIT ?` 词中间切分、无占位符子句顺序和绑定参数顺序，并用 `--self-test` 对三类顺序破坏各执行一次真实 red mutation。该脚本只证明三个已点名消费点的必要结构，不把它升级为全量 SQL 分类器或语义闭包证明。不得以字节码等价覆盖第二类参数错位或第三类运行时结构变化。

### 6.2 baseline 与顺序

P0 在任何会改写 SQL 的批次前冻结扫描命令和原始源码 snapshot；CP-A 对 baseline 与改后树分别按同一 Gradle 编译入口编译，先运行 `scripts/check/backend-sql-readability.mjs` 与 `--self-test`、`scripts/check/backend-sql-readability-counterexamples.mjs` 与 `--self-test`，再运行 `scripts/check/backend-sql-relocation-equivalence.mjs --baseline <snapshot>`。前者只证明旧续行标识闭集已清零，反例脚本只证明三个显式消费点的必要结构，后者只作必要的编译/holder 形态门；三者都不升级为第二、三类 SQL 语义闭包证明。baseline 不是 Git 动作，不在本轮执行。CP-C 的 10 个 receipt SQL 文件必须等待 CP-A 完成，否则丙批污染 baseline。CP-B 可与 CP-A 并行，因为它的已知两处后端文案是 inline string，文件中没有 `CONTINUATION_` 声明。

## 7. R-3 后端横切设计

### 7.1 回执

`CommandReceiptSupport` 只负责 canonical request hash、claim race、同 key 同 payload replay、同 key 不同 payload typed conflict 和 JSON 序列化 SPI。owner 仍拥有 receipt table、persistence、DML、response/readback projection 和 REQUIRED transaction。所有 10 个 receipt SQL/persistence/service 逐文件迁移，不把 15 张表或四种载荷形态误算成 service 分母。

`response_json` 新列/统一列可空；旧 null 行只表示历史没有 response，重放时按 claim-only 语义处理，不进入 corrupt 分支。DEV reset 可重建数据，但不得把 reset 策略写成生产历史回填。并发 race 必须在 owner persistence 通过 `ON CONFLICT DO NOTHING` 或等价现有正确形态收口；不以重复异常交给 HTTP。

### 7.2 跨界闭集

`ServiceNodeTypes`、`ExtensionHostTypes`、`AuditEntityTypes` 按语义分桶处理；每个 bucket 的 declaration、owner、consumer 和替换范围单独列在实施 inventory。数字 discovery 只用于发现，不作为完成分母；同一个 `STORE` 字节不允许跨 bucket 盲替换。

### 7.3 Problem、解析、锁、审计

- six owner `Problem` 类型通过 shared envelope shape/adapters 被 advice 一次消费；owner code enum 和业务 details 不下沉。
- `IllegalStateException`/`IllegalArgumentException` 的业务分支改为闭集 owner problem；真正的编程错误仍抛 programming exception，不把所有异常包成业务码。
- `CollectionRequestSupport` 返回结构化 invalid field/reason；edge/owner 在边界映射自己的 typed code。`Page` 与 `Cursor` 先按 collection-boundary-modes 分类，不能因 helper 存在把 Page 强行变 Cursor。
- 所有四个 advisory lock 绕过点分别判断是回执锁还是业务锁；统一调用 `AdvisoryLock`，锁 key 选择仍留 owner，helper 定义不算 bypass。
- `AuditEventWriter` 只接受结构化 field key/label snapshot/before-after state/value；owner 表和事务不下沉。`StoreServicePointService.java:558` 这处 inline INSERT 单独纳入丙批，不因 R-4 改写而漏掉。

## 8. R-5/R-6 集合与规范载体

### 8.1 Page/Cursor 分类

P0 建立当前所有 collection read inventory，逐条回答 `collection-boundary-modes.md` 的三问：整体 Detail、源码固定上界 Bounded、可跳任意页 Page、只能连续后翻 Cursor。OFFSET 27 个文件不得直接算违例；严格 keyset 6 个/放宽口径 8 个只是当前发现，不冻结为分母。每条 Cursor 必须使用 `(order, ref)` keyset、canonical identity 与 encoded filter；Page 保留页号语义；Bounded 明确上界和 overflow 行为。

`SalesMenuCursorIdentity` 中用户输入 filter 不转义的形态不能继续存在；改用 canonical identity/adapter，不以路径字符串或局部测试替代 cross-query cursor rejection。

### 8.2 规范载体

- `implementation-design-template.md` 的既有横切表新增 `frontend §3-K-1..§3-K-10` 非空行；
- `ui-interaction-design-template.md`、`ia-design-template.md` 同样新增具体引用与 surface/例外列；
- `journey-decision-template.md` 不假装有同形表，新增一个非空的“管理后台交互一致性”字段/小节；
- lifecycle vocabulary 只建三条禁止句/反向表门，禁止存在性假门；它不负责 Java 三态字面量；
- R-6 所有门都标 `NECESSARY_NOT_SUFFICIENT`，语义由逐代码/设计 review 负责，不恢复退役的 compliance-control。

## 9. R-8/R-9 前端分层

### 9.1 状态、时间、空值

canonical time helper 冻结为 `Intl.DateTimeFormat('zh-CN', {dateStyle:'medium', timeStyle:'medium', timeZone:'Asia/Shanghai'})`；日期 null、undefined、0、空字符串返回字段级 `—`，有效 epoch 才格式化。generic field helper 只把 null/undefined/empty string 变成 `—`，数字 0 保持 `0`；“未配置/无数据/不适用/无权限”仍由 feature 空态/权限事实表达。

生命周期 helper 只提供三态 label/color；每个 feature 保留自己的 generated status exhaustiveness。合同 VALID/INVALID、账号 presence、资产上传等非主数据状态不被三态 helper 改写。

### 9.2 Audit registry

审计 label/action registry 由 foundation 提供纯值/纯函数；历史 `fieldLabelSnapshot` 优先，缺 snapshot 时固定核心字段走 registry，dynamic key 只用稳定 fallback，不根据删除后的 definition 猜标签。两个 App 适配各自 generated audit wire，不能靠同名 key 或数组位置推断。

### 9.3 Cross-App transport and extension

`readCurrentDefinitionRevision`、`transportResponseStatus` 下沉 foundation/http；`ApiFailure`/`PlatformApiFailure` 差异归一。`problem()` 不合并，因 problem-code 闭集不同；`*TestIds.ts` 不合并，继续留在 app。`extensionList.tsx` 只共享纯展示/数据变换能力，generated API nullable 差异由 app adapter 保留。

## 10. R-10 全量测试与 seed 分母

R-10 的核心不是“最后补测试”，而是每条需求在实施前就有完整连带记录。下表是本详设的强制逐项 ledger；`N/A_WITH_REASON` 仍必须写出理由，不得留空。任何条目未能填入具体 owner/source 或合理 N/A，P0 为 `OPEN`，不能进入实施。

### 10.1 固定载体全集

| 载体 | 处理要求 |
| --- | --- |
| `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` | seed 数据正本；校验器变化不能代替 fixture 数据变化；每次改动记录 fixture path/version/digest，实施时由 seed executor readback 验证 |
| `scripts/dev/r5-seed-plan.mjs`、`scripts/dev/owner-command-seed-executor.mjs` | 闭集/数量断言及 owner command payload/readback；`definitions.length` 等字面量按实际 declaration source 同步，不能只改 expected count |
| `scripts/dev/r5-complete-seed-executor.mjs` | 阶段清单与顺序冻结；不得把依赖后置阶段的数据提前；任何新增阶段必须先更新 plan/test/fixture |
| `scripts/dev/*-seed-executor.mjs` 与对应 `.test.mjs` | 逐个检查是否消费本批 closed set/fixture/阶段；受影响者改实现与静态 test，未受影响者记录 N/A |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/*AcceptanceScenarios.java` | fixture builder 签名不能强制本需求验证“缺省路径”本来不应强制的参数；request、fixture、business oracle 分开；真实 HTTP |
| `apps/frontend/operations-admin/src/**`、`apps/frontend/platform-admin/src/**`、`libraries/frontend/admin-ui-foundation/src/**` 测试 | static 与 render/behavior 分开；行为主张不能只用源文本；testId/AST 只作必要检查 |
| `scripts/check/**`、`tools/verify-gates/**`、`BackendModuleBoundariesTest.java` | 只纳入真实受影响门；每个新门必须有真实 red mutation；不恢复退役控制面 |

### 10.2 R-1.1 至 R-11.4 逐项连带 ledger

| R | 生产/详设落点 | Fixture/seed executor | AcceptanceScenarios / 前端 static-render | red mutation / check | 闭包等级与漏检边界 |
| --- | --- | --- | --- | --- | --- |
| R-1.1 | foundation lifecycle label/tag；`apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogLifecycleStatusTag.tsx` catalog adapter；`ENABLED=启用`、`DISABLED=停用`、`VOIDED=作废`；catalog 生命周期消费共享常量，`shapeKey` 等域内枚举继续由 `apps/frontend/operations-admin/src/features/catalog-management/model/catalogManifestLabels.ts` 的 manifest/`catalogEnumLabel` 驱动 | seed fixture 状态值不改业务事实；`r5-seed-plan` 状态 label readback 若消费 | 两 App status render；catalog generated status adapter test | inline lifecycle map mutation；AST gate | `NECESSARY_NOT_SUFFICIENT`；改名/间接 adapter、manifest 与共享生命周期边界需 review |
| R-1.2 | 各 feature `satisfies Record<GeneratedStatus,...>` | N/A_WITH_REASON：仅类型适配，不改变 seed 业务事实 | TS type/static test；无新 backend scenario | 删除 exhaustiveness 应红 | `REVIEW_ONLY`；编译器证明的类型闭集仍不证明文案语义 |
| R-1.3 | 19 frontend production sources + 2 backend direct strings；旧“标记删除”按 C-2 改为“作废”，状态值不带“已” | fixture/seed 中状态标签断言与人可见 readback | 全部生产文案 static scan + render | 禁止词 mutation | `NECESSARY_NOT_SUFFICIENT`；Unicode/运行时装配需 review |
| R-1.4 | `StoreServicePointPage`、`CatalogDefinitionLibraries` color adapters | N/A_WITH_REASON：颜色不进入业务 seed | render/status Tag tests | inline color mutation | `NECESSARY_NOT_SUFFICIENT`；自定义颜色计算需 review |
| R-1.5 | confirmed business corpus G-08/G-09 | seed static assertions only if they read corpus labels | frontend label tests | old label red mutation | `REVIEW_ONLY`；业务语言理解需人审 |
| R-1.6 | `validityStatus.tsx` boundary; non-lifecycle status adapters | N/A_WITH_REASON：合同/账号/资产状态不是三态 seed | type/render tests for retained state machines | force-three-state mutation | `REVIEW_ONLY`；主数据判别式须逐对象复核 |
| R-2.1 | row/detail action menus; remove lifecycle Form fields | seed commands remain command-oriented; no form-only path | render/action tests; existing UI actions | re-add lifecycle Select/Switch mutation | `REVIEW_ONLY`；真实菜单行为需 L2 |
| R-2.2 | `statusChangeConfirm` helper | acceptance command cases keep transition result; seed executor not UI | render/focused confirmation tests | bypass confirm mutation | `NECESSARY_NOT_SUFFICIENT`；焦点/键盘需 L2 |
| R-2.3 | unified “确认+动词” dictionary | N/A_WITH_REASON：确认按钮不进 seed facts | static/render text test | bare “确认/确定” mutation | `NECESSARY_NOT_SUFFICIENT`；动态文案拼装需 review |
| R-2.4 | six StatusModal owners -> foundation primitive | N/A_WITH_REASON：UI-only | render failure/submit-lock tests | local Modal copy mutation | `REVIEW_ONLY`；全量 surface 清单需逐代码 |
| R-2.5 | lifecycle actions not Switch | N/A_WITH_REASON：UI-only | static AST + render | Switch lifecycle mutation | `NECESSARY_NOT_SUFFICIENT`；复合控件需 review |
| R-2.6 | new `AdminRowActionMenu`; detail menu unchanged | N/A_WITH_REASON：UI-only | 6 个当前消费者；`CatalogWorkbenchItemList.tsx:87` 批量菜单明确排除 | add seventh local row menu mutation | `REVIEW_ONLY`；行菜单/详情菜单分母需人审 |
| R-3.1 | foundation receipt SPI + 10 owner services/tables | receipt fixture/readback for every owner; fixture contract only if seed reads receipt | owner receipt focused tests; relevant acceptance write/replay | bypass SPI / owner DML in foundation | `REVIEW_ONLY`；跨 owner 事实与事务必须逐代码 |
| R-3.2 | `response_json` nullable/legacy claim-only | seed executor receipt read path and old-null fixture | receipt JSON focused tests; acceptance replay | null enters corrupt branch mutation | `NECESSARY_NOT_SUFFICIENT`；历史数据权限/语义 review |
| R-3.3 | owner persistence conflict shape | concurrent fixture where two claims race | acceptance same key race/readback | remove `ON CONFLICT`/equivalent mutation | `NECESSARY_NOT_SUFFICIENT`；DB isolation需受管运行 |
| R-3.4 | ServiceNode/ExtensionHost/AuditEntity buckets | seed host closed-set assertions in `r5-seed-plan` and `owner-command-seed-executor`; fixture data per host | acceptance host-specific owner identity | merge `STORE` buckets mutation | `REVIEW_ONLY`；发现数字不是完成分母 |
| R-3.5 | shared envelope shape + six owner adapters + advice | seed only if typed problem is asserted; no fake problem fixture | each affected owner negative HTTP scenario | add new `instanceof` branch / wrong owner code | `REVIEW_ONLY`；业务 code mapping需语义审查 |
| R-3.6 | catalog/business-channel typed failures | negative fixture for every converted business branch | Catalog/BusinessChannel acceptance CONTRACT+BUSINESS | restore IllegalArgument/State branch | `NECESSARY_NOT_SUFFICIENT`；异常路径全集需 review |
| R-3.7 | `CollectionRequestSupport` + owner mapping | seed list fixture > page and invalid cursor/page input if seed consumes it | all affected collection scenarios; cursor fixture over page | local parser renamed/copy mutation; ArchUnit method rule | `NECESSARY_NOT_SUFFICIENT`；reflection/indirect calls需 review |
| R-3.8 | `AdvisoryLock` usage + audit writer | seed command stages requiring business lock only if existing profile exercises it | affected owner acceptance concurrency/lock behavior | direct advisory SQL mutation, excluding helper self | `NECESSARY_NOT_SUFFICIENT`；dynamic SQL等价形态需 review |
| R-4.1 | 2194 declaration discovery, three-class disposition | N/A_WITH_REASON：R-4 不改业务 seed data，但 seed/build scripts must not reference old constants | SQL focused capture/equivalence; no fake acceptance | leave continuation or wrong merge mutation | `REVIEW_ONLY`；分类没有安全机械全集证明 |
| R-4.1a | static semantic vs runtime/conditional | N/A_WITH_REASON：SQL source only | consumer SQL/parameter tests; CatalogDefinition/CatalogWorkbench counterexamples | merge no-placeholder clause/reorder params | `NECESSARY_NOT_SUFFICIENT`；662 signal不是分类器 |
| R-4.2 | no continuation/name mismatch | N/A_WITH_REASON：source naming only | SQL source/focused | rename/mismatch mutation | `NECESSARY_NOT_SUFFICIENT`；语句语义仍需 review |
| R-4.3 | baseline snapshot + two compile trees + equivalence script | N/A_WITH_REASON：runtime seed不消费 baseline | no acceptance substitution; script output later | omit/replace baseline mutation | `NECESSARY_NOT_SUFFICIENT`；等价字节码抓不到动态语义 |
| R-4.4 | CP-A before CP-C SQL changes | all subsequent seed/test source reads must use post-A source only | plan/reconciliation, not business scenario | run C before baseline mutation | `REVIEW_ONLY`；顺序由计划/对账确认 |
| R-5.1 | Page/Cursor/Bounded/Detail inventory; canonical cursor | fixture > one page and invalid/cross-query cursor | all affected `*AcceptanceScenarios` for collection ops | treat Page as Cursor / offset cursor mutation | `REVIEW_ONLY`；业务集合形态不可从参数单推 |
| R-5.2 | no row projection query; set-based owner read | fixture with enough rows and related facts | DB readback/business oracle; no row-count claim alone | query from row mapper mutation | `REVIEW_ONLY`；数据库形态需逐代码+测量 |
| R-5.3 | canonical identity + three adapters | cross-query cursor fixture and user filter containing delimiter | collection acceptance and cursor unit tests | unescaped filter / foreign cursor mutation | `NECESSARY_NOT_SUFFICIENT`；编码安全需 review |
| R-6.1 | three templates, Journey field added | N/A_WITH_REASON：文档载体，不进 seed | N/A_WITH_REASON：不改变 UI runtime | remove/non-empty reference mutation | `REVIEW_ONLY`；模板完整性由设计 review |
| R-6.2 | lifecycle-vocabulary negative table gate | N/A_WITH_REASON：migration rule only | N/A_WITH_REASON：不是 HTTP business scenario | unlisted status table must red | `NECESSARY_NOT_SUFFICIENT`；Java literals不由此门覆盖 |
| R-6.3 | three prohibition gates | N/A_WITH_REASON：static source gates | frontend static tests only | reintroduce prohibited words/colors | `NECESSARY_NOT_SUFFICIENT`；间接实现/用户理解需 review |
| R-6.4 | deleted requirement row | N/A_WITH_REASON：explicitly deleted | N/A_WITH_REASON | gate must not be added | `REVIEW_ONLY`；本条只证明不误造控制面 |
| R-7.1 | canonical time helper | fixture timestamps include zero/null/valid and boundary timezone | both app render tests | direct `toLocaleString`/browser timezone mutation | `NECESSARY_NOT_SUFFICIENT`；动态 locale/format仍需 review |
| R-7.2 | field null helper distinct from empty-state | seed fixture null/empty/0 fields where existing facts permit | Descriptions/table render tests | `暂无`/`暂未配置` fallback mutation | `REVIEW_ONLY`；四种业务缺失语义需人审 |
| R-8.1 | foundation audit label/action registry | seed audit events include snapshot/no-snapshot/unknown dynamic key | Audit acceptance + both app render tests | split registry / label divergence mutation | `NECESSARY_NOT_SUFFICIENT`；历史语义需 review |
| R-8.2 | shared `auditChangePresentation` | receipt/seed no direct UI impact; N/A_WITH_REASON where absent | two app render/value tests | restore duplicate function mutation | `NECESSARY_NOT_SUFFICIENT`；generated adapter差异需 review |
| R-9.1 | foundation pure dictionary/HTTP helpers | N/A_WITH_REASON：pure frontend mechanism | foundation unit/render tests | app-local duplicate dictionary mutation | `NECESSARY_NOT_SUFFICIENT`；同名不等于同语义 |
| R-9.2 | app adapters retain generated projection | seed does not own generated UI types; N/A_WITH_REASON | per-app type/static/render tests | foundation imports generated app type mutation | `NECESSARY_NOT_SUFFICIENT`；projection语义需 review |
| R-9.3 | TestIds/problem maps app-private | N/A_WITH_REASON：automation identity/UI error source | app static tests and existing L2 preflight only | cross-app TestIds/problem import mutation | `NECESSARY_NOT_SUFFICIENT`；locator行为需授权 L2 |
| R-9.4 | transport helper shared, problem skeleton separate | N/A_WITH_REASON：transport UI only | both app HTTP-focused tests | restore duplicate transport / merge problem mutation | `REVIEW_ONLY`；错误闭集边界需人审 |
| R-10.1 | fixed carrier set in §10.1 | every affected executor + fixture contract | every affected AcceptanceScenarios + frontend tests | omit one carrier from planned change list | `REVIEW_ONLY`；分母完整性需详设 review |
| R-10.2 | this per-R ledger | each row states fixture/seed/test/red/gate or N/A reason | no new scenario may hide in entry class | force required fixture parameter mutation | `REVIEW_ONLY`；语义闭包需要 fresh review |
| R-10.3 | delivery prerequisite | no seed/test source changes allowed outside ledger | no dynamic status in docs-only turn | empty ledger accepted mutation | `REVIEW_ONLY`；人审交付门 |
| R-11.1 | helper ownership matrix §5.1 | seed/test only where helper changes observed | helper unit + consumer tests | duplicate helper implementation mutation | `REVIEW_ONLY`；feature retained responsibility需人审 |
| R-11.2 | AST/ArchUnit/behavior/red mutations | N/A_WITH_REASON：gate implementation, not seed data unless seed checks it | helper mutation behavior tests | helper self false positive / renamed bypass mutation | `NECESSARY_NOT_SUFFICIENT`；不声称闭包 |
| R-11.3 | every CP helper consumer row + P9 | each affected seed/executor path must state helper or N/A | focused consumer tests and code reconciliation | helper exists but consumer bypasses | `REVIEW_ONLY`；逐代码对账唯一收口 |
| R-11.4 | `project-memory/practices/frontend-capability-lookup.md` 与 `project-memory/practices/backend-capability-lookup.md` | N/A_WITH_REASON：index metadata only；helper rename/export 后两张表都必须能定位真实 symbol | static lookup/index test if existing | helper omitted from index mutation | `NECESSARY_NOT_SUFFICIENT`；可发现性不等于调用闭包 |

### 10.3 Acceptance 场景设计约束

如果某 R 子项改变真实 HTTP operation，场景必须放到对应的 `*AcceptanceScenarios.java` domain group，至少写清 `identity / fixture / request / businessOracle`，并分离 `CONTRACT`、`BUSINESS` 与 `DB_OPERATIONS`。fixture builder 不得把要验证的可选参数变成 Java 方法必填参数；需要覆盖缺省路径时要有单独 builder overload 或显式 `Optional` 输入形态。仅改变前端静态/文档/SQL 可读性时，写 `N/A_WITH_REASON`，不能为了凑场景创建路径字符串测试。

## 11. 操作、事务与失败 readback

本批没有产品新增 HTTP operation 的授权；所有实现将修改现有 operation 的共享机制或 owner 内部路径。实施前 P0 必须生成一份受影响 operation inventory，逐行包含 `operationId / method/path / x-consumer-faces / owner / target resolver / collection shape / altered helper / typed problems / scenario or N/A`。不得用“全仓”作为该表的替代，也不得因没有新 route 而跳过现有 route 的审计。

### 11.1 写路径

1. command 先在 owner 内复核 actor/scope/target/current status/version。
2. 进入同一 `REQUIRED` 事务后执行 receipt claim、advisory lock、业务 mutation、audit event 和 authoritative readback；foundation helper 不直接写业务表。
3. 所有 owner failure 保留 typed problem；receipt replay 返回保存的 response/readback；null legacy receipt 只 claim-only。
4. 失败时不清理掉用户仍需理解的业务事实；stage/对象存储等非数据库边界按既有 owner API 的 release/claim 规则处理，不能将对象 I/O 包进不允许的外层事务。

### 11.2 读路径

读接口按任务事实闭集决定 Detail/Page/Cursor/Bounded；不会为了让前端方便把同一 owner 事实复制到多个 screen-specific endpoint。前端不从旧列表行猜新身份，不把失败当空集合，不把 stale data 当当前 scope。

## 12. 三维对账与正式 review 准入

每个 CP 完成后、进入下一 CP 前，必须由 fresh 独立只读 reviewer 做逐项三维对账：需求正本、本文/现有 IA/interaction、六维 routed memory 与规范。逐项比较行为、形态、动作、关系、位置、用户可见文案、状态/控制、失败/恢复、数据来源/失效边界；结果只有 `MATCHED`/`OPEN`。`OPEN` 根因修复并复查，不能累积到最后。

全部 CP 完成、第一次动态运行之前，再做一次全批整体三维对账；它不是阶段对账汇总，专门发现跨 CP 的事实漂移。

实现完成后必须另做 `REVIEW_TARGET=IMPLEMENTATION` fresh 独立对抗审查，依据本文逐条回读生产源码和实际 evidence；不能用本文 review 代替 implementation review。当前没有生成该 verdict，也没有授权运行。

## 13. 停机条件

出现以下任一情况，详设/计划停在当前 CP，不由实施者自行补业务语义：

- 当前 source 与需求的 owner、状态、事务、operation face 或数据身份冲突；
- 某 R 子项无法写出失败条件或真实 business oracle；
- 发现 R-10 载体不在固定全集，或 fixture builder 强制了待验证的可选参数；
- 发现 shared helper 会反向依赖 owner/generated 类型，或只能通过复制第二份 helper 维持现有行为；
- 需要改变已裁决产品/Journey/权限语义，或需要新增未授权运行/迁移/部署动作；
- baseline 已被前序 SQL 批污染，或实现者无法重新取得无污染 baseline。

停机报告必须给原文事实、候选理解、倾向方案及代价；不得用 fallback、兼容层、缩小分母或空实现绕过。

## 14. 详设交付前检查

- [ ] 元数据明确本轮只写文档，未把 Roadmap/历史 evidence 误写成当前实施授权。
- [ ] 横切机制表 17 行全部保留；每行都有精确路径/符号、最低可执行观察、无现成能力时的形态和本批全集。
- [ ] 没有把任何机械门标成 `PROVES_CLOSURE`；每个 `NECESSARY_NOT_SUFFICIENT` 都写出漏检边界；每个 `REVIEW_ONLY` 都写明 reviewer、对照物和时点。
- [ ] R-4 三类、baseline、10 个 receipt SQL、ArchUnit 方法级新增、AdvisoryLock 自身排除均已落文。
- [ ] R-10.1 固定载体全集已列；R-10.2 逐条覆盖 R-1.1 至 R-11.4，N/A 有理由；R-10.3 是实施前置门。
- [ ] R-11.1 helper 归属矩阵、R-11.2 门/反例/闭包边界、R-11.3 消费者对账、R-11.4 索引同步均有落点。
- [ ] 文档没有动态 PASS、reset/DEV/seed/browser L2 结果，也没有生产代码修改授权。

## 15. 当前交付状态

```text
DESIGN_STATUS=ACCEPTED_IMPLEMENTATION_IN_PROGRESS
IMPLEMENTATION_AUTHORITY=true
PRODUCTION_CODE_CHANGED=true
CP-D=IMPLEMENTED_AWAITING_FRESH_STEP_REVIEW
STATIC_SOURCE_REOPEN=COMPLETE_FOR_DESIGN_INPUT
DYNAMIC_VALIDATION=FOCUSED_TYPECHECK_AND_UNIT_PASS;BACKEND_ACCEPTANCE_NOT_RUN
R-10_LEDGER=WRITTEN_REQUIRES_INDEPENDENT_REVIEW
R-11_HELPER_CLOSURE=DESIGN_ONLY_REVIEW_REQUIRED
逐代码与详设对账=NOT_APPLICABLE_WITH_REASON:尚未进入实施
HANDOFF_TO_DEXTER_CLAUDE=READY_AFTER_SECOND_DOC_AND_SELF_CHECK
```

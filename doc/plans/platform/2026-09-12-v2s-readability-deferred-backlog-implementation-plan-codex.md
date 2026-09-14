SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# 可读性整改欠账 · Implementation-facing 实施计划

- 需求正本：doc/plans/platform/2026-09-12-v2s-readability-deferred-backlog-requirements-claude.md
- 详设正本：doc/plans/platform/2026-09-12-v2s-readability-deferred-backlog-implementation-design-codex.md
- 交付单元：一个整体 delivery unit，B1–B16 不拆成独立 review cycle
- 计划状态：DESIGN follow-up 已按三条文档修复收口；Dexter 已授权本 delivery unit 进入实施
- IMPLEMENTATION_AUTHORITY：true（授权来自当前 Dexter 会话与 R5 Roadmap 授权字段）
- 本计划编写阶段的只读边界已结束；当前执行不授权契约/generated、migration、UAT、部署、切流或 Git；B1–B16、最终全量 acceptance、受管 reset/dev/seed 已获授权

## 0. 执行原则

### 0.1 主 agent 与独立审查

- 所有代码、测试、脚本和文档写入只能由主 agent 完成；独立 agent 只读核验和报告 finding。
- 每个 CP 严格执行前读、写入、focused proof、同输入后读；进入下一 CP 前由 fresh 独立 reviewer 做三维对账。三维是需求、详设/IA、project memory/规范。
- 步骤级对账只产出 MATCHED 或 OPEN，不替代整批 REVIEW_TARGET=IMPLEMENTATION 对抗 review；不把若干批次合并成新的正式 cycle。
- 全部 CP 完成后，先做一次不依赖各 CP 汇总的全范围三维对账，再进入整体测试与最终 acceptance。

### 0.2 每个 CP 的固定记录

每批第一次写入前在本计划对应的 execution record 填入：

| 字段 | 要求 |
| --- | --- |
| scope | 本 CP 的文件/类/module/测试边界 |
| pre-read | 需求、详设、六维 memory、coding/review standard、owning source |
| cost unit | 改动文件数 + 新增/补齐行为 fixture 数 + unresolved item 数 |
| estimate time | 第一次写入前 |
| baseline location | 本计划对应 CP 的记录位置 |
| first readback | 写入前同输入事实 |
| write set | 主 agent 实际修改清单 |
| focused proof | 该 CP 的机械/行为/等价证明 |
| second readback | 同一输入重新读取的事实 |
| reconciliation | fresh reviewer 的 MATCHED 或 OPEN |
| cleanup | 如发生受管执行，business 与 cleanup 分开；本次写计划阶段为 N/A |

不填估算数字时写 UNVERIFIED_REQUIRES_EVIDENCE，不用历史 run、mtime、hash-chain 或总览阅读补齐。

### 0.3 统一 STOP

任一 CP 出现以下情况停在当前 CP，保留首败与日志/诊断，向 Dexter 报告，不自行改裁或缩小：

- SQL fragment 无法完整清单化，capture 和完整 data-flow proof 都不能闭合；
- SELECT star A 无法同时满足 physical red、CTE/derived/alias green、comment 规则和 9+1 路径 mutation；
- SQL 有效值、receiver、方法、实参顺序或事务边界变化；
- self-call、代理、传播、锁顺序、幂等、回滚、审计或 authoritative readback 无法证明等价；
- 三维对账 OPEN、编译/既有测试失败无法根因修复；
- 需要契约、migration、generated、权限、Journey、HTTP operation、新依赖、通用基类或新的 UI surface；
- 任一 execution point 的条件选择/组合无法在不引入 SQL fragment 参数的前提下移入 persistence；
- 本 CP 实测成本达到开工前基线的三倍。

三倍只是报告触发条件，不是自动门；是否停止、推迟、缩小由 Dexter 决定。

### 0.4 已裁定的范围与形态边界

| 决策 | 状态 | 已确定边界 | 对计划的影响 |
| --- | --- | --- | --- |
| M-06：跨语句/跨方法 SQL 数据流解析 | `DECIDED_BY_DEXTER: A` | 只实现详设 §4.3 的 bounded minimal support set：仓内既有 Node/TypeScript 运行时与标准库、Java string/text block 词法、`+`、同一纯常量持有类内由 literal 与同类 `static final String` 组成的 constant expression、`AS MATERIALIZED` CTE、derived table 与 alias；不引入第三方 parser/framework | B1/B3 按该支持集解析；StringBuilder、format/join、helper return、条件选择、跨方法链、不同常量持有类引用等 tier 2 输出 unknown，逐项以 capture/review 闭合，不能静默绿 |
| M-08：sales-menu infrastructure 两文件与 workspace adapter 一文件是否归位 | `DECIDED_BY_DEXTER: relocate` | 三个精确文件的 SQL 文本与执行分别归位到所属 module persistence；不保留本批技术段 execution 例外 | B3 纳入 constants；execution 在 CP-0 按统一排序确定的所属 module 批次归位；infrastructure/adapter 仍在写路径分母中作为回流哨兵 |
| M-01：persistence execution 公开边界 | `DECIDED_BY_DEXTER: named-typed-boundary` | persistence execution 的 public 方法必须只接收读侧 filter/sort/page/target，以及写侧聚合/命令对象/字段值等业务级参数，由 persistence 内部完成 SQL 条件选择/组合；不得以 public raw-SQL、SQL fragment 参数或包装类型透传承接 application/domain 组装的 SQL。跨 module coordinator/task-read 若确需单条 SQL，整条语句归属于已明确的 task-read/use-case owner module persistence | CP-0 逐 module 盘点 public raw-SQL 入口、SQL fragment 参数/包装形态和调用点；所属 execution 批次改为业务参数方法；没有既定 task-read owner 时 OPEN 并报告 Dexter |

以上是已回写的范围裁定；Dexter 已授权按本计划进入生产实施。若已裁定的支持集或归位边界在实施中无法闭合，按 §0.3 STOP 报告 Dexter，不自行改裁或缩小。

M-01 参数边界的收口同时覆盖读写两侧：读侧只接收 `filter`、`sort`、`page`、`target` 等业务查询参数；写侧只接收聚合、命令对象、字段值等业务变更参数。两侧都不得通过参数名、record/wrapper 或通用可变参数传递 SQL 文本、SQL fragment、mapper 或执行参数。

## 0A · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-0 | 当前字节盘点与四张矩阵 | 主 agent；13 个 backend module、catalog-management、acceptance structure | 候选逐行理由、caller/transaction/persistence/test 矩阵、M-01 raw-SQL/fragment 边界盘点、已裁定 M-06 支持集与 M-08 归位边界 | 需求、详设、memory、规范、owning source |
| B1 | 控制面修复 | verify-gates、scripts/test、backend standard | query-boundaries、write-path、acceptance structure、词表正本及 focused red fixtures | CP-0；按已裁定 M-06 支持集实现 |
| B2 | catalog-management 三文件拆分 | operations-admin | 子目录、consumer/path 同步、Drawer lifecycle proof | CP-0 |
| B3 | 13 module SQL 文本归位 | 各 module persistence | constants、fragment graph、B1 兼容检查、B3 capture | B1、B2；按已裁定 M-06 支持集处理 unknown |
| B4–B16 | 逐 module execution 归位 | module owner | target execution、事务/self-call/锁/幂等/readback proof | B3；M-08 三文件归位边界已定 |
| B16 后 | 全范围对账与唯一全量 acceptance | 主 agent/受管入口 | 三维对账、逐代码与详设对账、最终 acceptance 输入 | B1–B16 全部 MATCHED |

## 1. CP-0 · 当前字节盘点与工作矩阵

### 1.1 前读

重新读取需求、详设、backend-coding-standard 的 R-READ-01 到 R-READ-08、review-standard、foundation-charter 范围裁决段、scripts/README、六维 memory 与所有命中的 owning source。确认当前会话的实施授权仍限于本 delivery unit；CP-0 只做盘点，不因授权存在而跳过语义对账。

### 1.2 盘点

从当前字节重产出：

- 13 个业务 module 的集合；
- 每个 module 的 `src/main/java/com/catering/v2s/<module-package>/application/` 下所有文件名以 `Service.java` 或 `Coordinator.java` 结尾的候选，逐个记录类名、包、constructor、public API、事务、JDBC/repository、caller；`<module-package>` 按当前源码包根解析，不能用一层 `*` 猜测；
- SQL source、helper/field/builder/format/join/conditional 数据流和实际 sink；
- 三个 frontend target 及所有 consumer、测试、static-boundary/user-visible-copy 读取点；
- acceptance 目录所有 *Scenarios.java；当前 11 个，P2 helper 不计 business denominator；
- query-boundaries 当前 checker、import closure、历史 9 路径和 3 个当前超白名单路径；
- write-path checker 当前分母和 infrastructure/adapter/persistence 的真实 source。

候选边界外的 `app/edge/externalcollaboration/ExternalCollaborationBusinessChannelCoordinator.java` 与 `modules/workspace/.../api/PlatformWorkspaceCoordinator.java` 只登记为既有协调/API 边界，不计入 89 个 module application 候选，也不因名称含 `Coordinator` 扩大本批范围。

CP-0 先沿详设 3.2B 的九个关键事实锚点复核 facade、coordinator、Inventory lifecycle 与 hierarchy owner；该表已固定核查入口，CP-0 只能补齐三项事实与 `path:line` 证据，不能因类名、后缀或规模重新发明分类。

### 1.3 四张矩阵

先产出候选/产物、调用方、事务与持久化、测试覆盖四张工作矩阵。方法族矩阵粒度按详设：重载和 private helper 仅在 SQL 数据流、事务边界、锁/回执/readback 或 caller observable behavior 不同才单列。族级索引中的 wildcard 只能作为导航，CP-0 必须在首次写入前展开每个 public overload 的完整 Java 签名、声明/实现路径、调用点 `path:line`、receiver/interface 类型、目标 execution 类和保持/修改/删除结论；未展开项不能将 CP-0 标为 MATCHED。事务与持久化矩阵还必须增加“是否存在 public raw-SQL/SQL-fragment 透传入口及其逐调用点”列，确认 `String sql` 通用 query/update、SQL wrapper 或 fragment 参数是否跨过 application/domain→persistence 边界；未盘点或只按名称统计时不能收口。测试覆盖矩阵在 CP-0 是“现状与缺口盘点”，不是行为证明门：`NONE_FOUND` 表示尚未接受到 `test/path.java:line` 级的精确业务 oracle 定位，不表示仓内绝对没有可复用测试；CP-0 必须把这一状态逐行显式记录，行为 fixture、正负 oracle、权威 readback 与适用事务风险证明留给 CP-1/所属 execution 批次，不能用候选类名、token 命中或既有测试文件存在冒充已关闭。

对 CatalogOwnerService 等当前 facade 逐点确认 self-call；对其它每一个未来 execution target 也必须有 self-call 与外层事务属性一列，不能只写“机制不变”。

### 1.4 排序

按详设 11.1 的统一比较键重测：先按 confirmed `@Transactional` annotation count 升序，再按 confirmed direct persistence invocation count 升序，最后按 module 字典序。receiver、sink 不可靠时不使用宽 regex，标 `UNVERIFIED_REQUIRES_EVIDENCE` 并人工确认。排序只决定 B4–B16 次序；不改变 13 module 范围，也不作验收分母。事务复杂度优先，是因为 B4–B16 的第一风险是代理/传播边界；direct invocation 只作同一 tx 量级内的次序。两个量纲不得相加为伪造单一 score。

### 1.5 CP-0 收口

focused proof：盘点脚本/只读报告、矩阵自一致性、13 module 全集与 89 候选的零缺失零多出、每个 module 的 public raw-SQL/SQL-fragment 透传盘点及调用点；不写生产代码。fresh reviewer 对照需求、详设和 memory，结果必须 MATCHED。若 OPEN，修正矩阵/详设，不进入 B1。

## 2. B1 · 控制面修复

B1 只处理项二、项三、项六 structure gate、项七词表正本，不做业务重构。每项先在 execution record 记录 cost baseline。

### 2.1 SELECT star 方案 A 前置

1. 读取 tools/verify-gates/cli.mjs 的当前 budget 实现，确认 compatibilitySelectStarPaths 的 9 个历史路径与当前实际超集合。
2. 在任何 clean self-test 前先处置真实 source：改写 `CatalogItemService`、`CatalogWorkbenchReadService`、`InventoryBomService` 中实际应被判定的形态；同时把 `DatabaseOperationTrackerTest` 的 `distinguishesNPlusOneFromRedundantParameters` 测试题面改为显式列，保留 N+1 pattern assertion，不能把测试源排除。此步骤完成后，新判据本身必须先能 clean。
3. 将 checker 自测从 Java comment mutation 改为真实 Java string/text block mutation；不把 comment 当 red fixture。`prepareSelfTestClean` 的 clean-first 流程不能在旧 whitelist 红状态下运行；mutation 失败必须明确包含 `R4_DATABASE_SELECT_STAR`，其它错误（例如 `R4_DATABASE_LOOP_IO`）不得被 generic catch 当成目标门通过。
4. 按已裁定的 M-06-A 实现 §4.3 bounded minimal support set：普通 string/text block 词法、`+`、同一纯常量持有类内由 literal 与同类 `static final String` 组成的 constant expression、`AS MATERIALIZED` CTE、derived table 与 alias；StringBuilder、format/join、helper return、条件选择、跨方法链、不同常量持有类引用等 tier 2 必须输出 `UNRESOLVED_SQL_CONSTRUCTION` 或 `UNRESOLVED_BRANCH`，不能静默绿。
5. 证明 physical base relation 的 SELECT * 红；CTE/derived relation 的 SELECT * 或 alias.* 绿；physical table alias 仍红；无法解析 relation 来源输出 SELECT_STAR_UNRESOLVED，不静默绿。
6. 删除 compatibilitySelectStarPaths 及集合相等断言。source path 只用于枚举、定位、报告，不改变 verdict。
7. 在 checker 的真实执行闭包中扫描 cli.mjs 与本地 import helper，禁止 path 派生 Set、array、switch、regex、endsWith/contains/startsWith 或等价豁免。
8. 对 9 个历史 whitelist path（含 `DatabaseOperationTrackerTest`）各做一次真实 physical SELECT * mutation，再对一个门此前未见过的 path 种一次；10 处必须全红。测试必须能覆盖 imported helper 中的豁免搬迁。
9. 将 `scripts/check/query-boundaries` 加入 `tools/verify-gates/verify.mjs` 的真实 static command sequence，条目 label 为 `query-boundaries`，expected marker 固定为 `R4_DATABASE_QUERY_BOUNDARIES=PASS`；不存在 skip 旁路。

若第 5、8、9 步任一不能闭合，或已裁定的 M-06-A 支持集仍无法覆盖同 module persistence 常量引用，按需求 §15 停止项二并报告 Dexter；不得以临时 whitelist、generic catch、comment mutation、半改状态或未闭合 unknown 报完成。

### 2.2 写路径门分母

1. 在 tools/verify-gates/cli.mjs 的 R4_BACKEND_WRITE_PATH_EXTERNAL_OR_EVENT_CHAIN 中保留 application/domain，加入 persistence/infrastructure/adapter。
2. 用三个互相独立的 checker fixture：persistence/、infrastructure/、adapter/，各植入 RestTemplate，各自运行并各自红。
3. 不把 JDBC 落点当作该门完整性的代理；交付报告保留约 119 个分母外主源和约 43 个无层段的已知敞口，当前数字需要随当前源复测。

### 2.3 Backend acceptance structure

1. 让 scripts/test/backend-acceptance-structure.test.mjs 枚举 acceptanceRoot 下全部 *Scenarios.java，解析顶层 class name，删除 6 文件硬编码。
2. BackendAcceptanceScenarioCatalog 使用单一 business group registry；含 `@AcceptanceScenario` 的文件由 discover 反射，零注解文件不进入 business definitions/denominator。
3. structure test 对零注解 `*Scenarios.java` 解析顶层 class name，并要求某个 acceptance host 的显式 `@Test` 方法引用该 class；不按 P2 类名、方法名或目录写特例。当前 P2 继续保持 final/static helper 与 `BackendAcceptanceTest.p2ReadConnectionScopeProof` 调用。该 helper consumer test 必须无条件可执行；若使用 `EnabledIfEnvironmentVariable` 等条件注解，允许作为显式例外，但同一位置必须声明启用条件、默认状态及本 proof 的显式启用方式；默认禁用且本 proof 未显式启用的测试不能伪装成可执行 proof。
4. structure test 比较所有 source file 与两类表示：business group 或显式 helper consumer；含注解且未注册、零注解且无显式 consumer 的临时 `*Scenarios.java` 都必须红。
5. 不切分任何既有 acceptance 文件，不让 P2 或 performance coverage 冒充业务场景。

### 2.4 Backend vocabulary

在 doc/platform/backend-coding-standard.md §2 review-only 段新增 api/application/domain/persistence 四段定义、适用范围、反例、platform library 与 package-root boundary class 的 review-only 处置、R-READ-08 unknown/全集纪律，以及不建机器门声明。明确 infrastructure/adapter 是既有技术支持段，不与四段业务词表冲突；三个点名文件按 M-08 已裁定归位，不得保留为本批 execution 例外。

### 2.5 B1 focused proof 与后读

- node test：backend-acceptance-structure 的全目录与未注册红夹具；
- query-boundaries：四类 SQL shape、comment/text block/fragment、9+1 path mutation、import closure，并核对唯一 marker `R4_DATABASE_QUERY_BOUNDARIES=PASS`；
- write-path：三段独立 red fixture；
- static sequence：真实执行 marker；
- coding standard：逐段反例和 review-only 边界；
- 同一组需求/详设/规范/源码后读；
- fresh reviewer 只能报 MATCHED 或 OPEN。

B1 不执行全量 backend acceptance、不启动 DEV、不 reset/seed。

## 3. B2 · Frontend 三个文件

### 3.1 前读与行为钉住

先读 catalog-management 当前三个 target、所有 imports、static-boundary.test.mjs、CatalogUserVisibleCopy.test.tsx、CatalogItemDrawer.test.tsx、CatalogManagementPage.test.tsx、CatalogWorkbenchTaskSurfaces.tsx、foundation hooks 和既有 specs；并读 `scripts/test/catalog-inventory-query-envelope.test.mjs`、`scripts/test/frontend-idempotency-boundary.test.mjs`、`scripts/test/frontend-transport-cache-lifecycle.test.mjs` 及其在 `scripts/test/test-health-entry-runner.mjs` 的接线。逐个确认无需新 Journey、control、文案或 L2 case。

动 React target 前补真实 state lifecycle fixture：mount、unmount、re-open、dirty input、discard/continue、query context reset、pending/error/readback；每个 Drawer 至少正向和负向 business oracle。这里的 `readback` 是组件 state/query fixture 的回读，不是服务端权威 readback；本批没有新增或修改服务端业务事实/写入，因此 server authoritative readback 对 B2 明确为 `N/A_WITH_REASON`。若拆分导致请求、invalidation、写入或服务端事实改变，立即停止并升级为 B4–B16 的 owner/readback proof，不得用 mock response 冒充服务端证据。缺口不是由既有 spec 绿来关闭。

### 3.2 catalogModel

保留 model/catalogModel.ts 为薄 barrel；在 model/catalog/ 下按职责拆 catalogTypes、catalogLifecycle、catalogItemModel、catalogCopyModel、catalogValidation 和新 barrel。generated wire → types → pure model/validation → barrel，不导入 React、RTK hook、HTTP transport 或组件。保持旧 consumer import path 可解析。

### 3.3 CatalogDictionaryDrawerState

移入 ui/dictionary/：State controller、View、纯 model、index。保留 props、open/close、dirty guard、query context、permission、readback 和 foundation lifecycle；CatalogDictionaryDrawer.tsx 改真实导入。更新 CatalogDictionaryDrawerState.test.ts 与 CatalogItemDrawer.test.tsx 的 owning path，不保留 root ui 同名实现 wrapper。

### 3.4 LocalCatalogCopyDrawer

移入 ui/local-copy/：Drawer controller、View、纯 local-copy model、index。保留 LocalCatalogCopyDrawer 与 copyScopeTabKey 的公共导出。更新 CatalogWorkbenchTaskSurfaces.tsx、CatalogManagementPage.test.tsx、static-boundary 和 user-visible-copy 测试。不得把 state/HTTP/生命周期复制到新 helper。

### 3.5 B2 收口

- sales-menu.spec.ts 与 catalog-inventory.spec.ts 保持绿；
- state lifecycle fixture 的正负 oracle 和 readback 全绿；
- static boundary/user-visible-copy 的路径断言指向真实 owning path；
- root ui 不保留同名实现 wrapper，且所有 consumer、正向断言与 `doesNotMatch` 断言都覆盖拆出的真实 owning files；root ui 顶层文件数下降只是辅助方向观察，不能单独关闭 B2；新文件名表达职责；
- 不新增 testId、L2、HTTP、契约或 generated；
- fresh reviewer 做同输入三维对账，MATCHED 才进入 B3。

B2 只做前端结构和测试补强，不启动本地 Vite 或浏览器 L2。

## 4. B3 · 13 module SQL text relocation

### 4.1 每 module 进入条件

按 CP-0 已确认的 SQL source/sink 与 method family，第一次写入前做该 module before capture。extractor 按已裁定 M-06-A 覆盖普通 string/text block 词法、escape/comment、`+`、同一纯常量持有类内由 literal 与同类 `static final String` 组成的 constant expression、`AS MATERIALIZED`、derived table 与 alias；helper return、field 非纯引用、StringBuilder、String.format、String.join、conditional branch、跨方法链和不同常量持有类引用属于 tier 2，必须显式列为 unknown。跨 module 的 coordinator/task-read 不导入 peer module 的 SQL 常量或拼接碎片；若确需跨 module task-read SQL，整条语句归属于已明确拥有该 task-read/use-case 的 module persistence，没有既定 owner 时保持 OPEN 并报告 Dexter。B3 之前先确认 B1 的 relation checker 能跟随同 module persistence 常量引用，不能把 CTE 定义与最终 projection 拆成它无法解析的孤立片段；若仍无法解析，进入 `UNRESOLVED_SQL_CONSTRUCTION`/`SELECT_STAR_UNRESOLVED`，由 capture 或完整 review 闭合，否则 OPEN/STOP。

### 4.2 写入

只新建或调整 persistence 纯常量持有类：static final String、无 Spring/JDBC/repository import、无 bean、无方法/执行；initializer 只能是字符串 literal 或同一持有类内其它已解析 `static final String` 常量组成的 Java constant expression。**B3 过渡条款**：由于 B3 只搬文本、不改 execution，application/domain 中的动态条件选择/组合暂可组合已声明的 persistence fragment；这不代表最终形态。所属 execution 批次必须将条件选择/组合移入 persistence，并将 fragment 参数替换为读侧 filter、sort、page、target，或写侧聚合/命令对象/字段值等业务级参数；业务级参数按语义而非 Java 类型判定，String 只能承载 name、code、ref 等业务数据，不能包含 SQL 文本、fragment、mapper 或可变执行参数。最终 application/domain 不得保留 SQL literal 或以任何参数形式传递 SQL fragment。按 owner/execution point 分配唯一常量地址，不因文本相同跨 owner 合并。不得改变 receiver、方法、参数顺序、事务注解或 TransactionTemplate。

### 4.3 后读与等价

同一 fixture、输入、准备顺序 after capture；按 `module/owner-class/method-family/execution-point-id/sink-kind/invocation-ordinal/branch-case-id` 对齐 effective SQL、fragment order、parameter shape 和 parameter expression/slot mapping。B3 与 B4–B16 都必须做 before/after capture；缺 key、多 key、未执行 branch、字符串/顺序或参数槽位变化都是 OPEN。普通业务返回对象不能替代 capture；同形参数互换必须由独立参数表达式证据拦住。

13 个 module 都必须有报告行；无 SQL 的 module 写 NO_SQL_SOURCE。B3 的每个 execution point 都要保留 stable capture key、branch matrix、parameter expression/slot mapping 与 before/after effective SQL；B3 不执行每 module 全量 acceptance，也不搬 execution。完成编译、类型、既有测试和逐文件 diff 后，由 fresh reviewer 对账。按 M-06-A 仍产生的 tier 2 unknown 必须逐项完成 capture 或完整 review；未闭合时 B3 不能报“全量归位”，按 STOP 规则保留清单并报告 Dexter。

## 5. B4–B16 · 逐 module execution relocation

### 5.1 通用批内顺序

1. 开工前记录该批独立 cost baseline，并重新读取该 module 的需求条目、详设 CP、memory、R-READ 正本和当前 owning source。
2. 产出/更新四张矩阵；每个 transaction method family 补 self-call 与 outer transaction 属性。
3. 先补行为钉住：真实 fixture、请求/动作、正负 business oracle、写后 authoritative readback；不能只看状态码/异常类型/DB operation 数。
4. 按矩阵移动 execution 到 persistence；application 保留业务规则、owner revalidation、事务协议、跨 owner command 和 readback，但不得继续选择/组合 SQL 或向 persistence 传递 SQL fragment；目标 public persistence 方法只接收读侧 filter、sort、page、target，以及写侧聚合、命令对象、字段值等业务级参数，由 persistence 内部完成条件组合。facade/FQCN/constructor 保留。对 B3 后每个 execution point 重做 before/after effective SQL capture，复用稳定 key、branch case、parameter expression/slot mapping；不能以方法名、返回对象或 DB operation 数替代。
5. 逐点核 self-call、bean proxy、传播、锁/CAS、幂等、审计、回滚和 readback；出现 bean ambiguity 停在当前 CP 修正，不用 primary/fallback。
6. 运行该批 compile、既有 tests、focused proof；focused 只证明该批，不升级为全量 acceptance。
7. 同一输入后读；fresh independent reviewer 做三维对账，只有 MATCHED 进入下一批。

### 5.2 M-08 三个既有技术段文件

`SalesMenuRepository.java`、`JdbcSalesMenuRepository.java` 和 `JdbcGroupWorkspaceRepository.java` 按 M-08 已裁定归位：B3 将三者 SQL 纳入所属 module persistence constants，execution 在 CP-0 按统一排序确定的所属 module 批次迁入 persistence execution，并同步更新 bean/constructor、caller、事务与 readback 矩阵。三文件的 infrastructure/adapter 路径仍保留在写路径扫描分母中作为回流哨兵，但不再保留为本批 execution target；不得另造保留分支或技术段例外。

M-01 形态要求：当前 `SalesMenuRepository` 的 public `query(String, RowMapper<T>, Object...)` 与 `update(String, Object...)` 不得作为最终 persistence boundary，也不得改名为 `whereFragment`、`orderFragment` 或包进 SQL wrapper 继续透传。sales-menu application 对这些入口的调用必须在所属 execution 批次改为只接收读侧 filter、sort、page、target，或写侧聚合、命令对象、字段值等业务级参数、由 persistence 内部完成条件选择/组合的具名方法；persistence 类内部 private helper 可以处理 SQL 字符串，但不能通过 public 接口透传。CP-0 必须在 13 个 module 逐 module 盘点该形态、SQL fragment 参数/包装形态及调用点；发现新实例按同一规则处理，不以“只改实现包名”或“只把 SQL 常量移出 application”判定完成。若协调器需要跨 module task-read SQL，整条语句归属于已明确拥有该 task-read/use-case 的 module persistence，不导入 peer module SQL 常量或拼接跨 module 碎片；没有既定 owner 时保持 OPEN 并报告 Dexter。

该裁定解决的是查询归属而非 JDBC 位置：raw-SQL 泛型透传或 fragment 参数只给 execution 一个位置，没有给查询一个业务名字和 persistence owner；只移动实现包、常量或参数改名，仍会保留 application 组装、persistence 哑执行器的双轨形态。成本限定在 sales-menu 的所属 execution 批次，独立 cost baseline 达到三倍时报告 Dexter；不得以成本自行留下技术段例外或缩小范围。

### 5.3 批次顺序

下表是 CP-0 当前只读预览；B4 开工前按详设 11.1 的统一比较键重测。若顺序变，只更新 execution record，不改变范围：先按 `@Transactional` annotation count，再按 confirmed direct persistence invocation count，最后按 module 字典序；不能把两个不同量纲直接相加。事务复杂度优先是因为 B4–B16 的主要风险是代理/传播边界，direct invocation 只用于同一事务复杂度内排序：

| 批 | module | tx | direct | 批内重点 |
| --- | --- | ---: | ---: | --- |
| B4 | fulfillment-production | 14 | 17 | production tag owner 与 task-read 的边界 |
| B5 | extension | 15 | 13 | definition 与 audit/receipt support 的 owner 边界、receipt/readback |
| B6 | collaboration | 18 | 22 | collaboration enablement/binding 的单 owner 事实与 receipt |
| B7 | sales-menu | 18 | 143 | definition/item/manual/publication/section 与 operation record 边界；M-01 专项：不得沿用前序批次的“只移常量/包归位”做法，公开方法必须接业务参数并在 persistence 内组合条件 |
| B8 | workspace | 19 | 13 | workspace command、初始化与平台 workspace readback |
| B9 | business-channel | 20 | 31 | channel/template facade、candidate/readback、support 不越界 |
| B10 | asset | 21 | 31 | asset owner、对象存储引用和 audit/readback |
| B11 | platform-admin-iam | 38 | 67 | authentication、IAM receipt/audit support 与 owner API |
| B12 | store-contract | 43 | 39 | contract command、audit/receipt、task-read 分界 |
| B13 | inventory | 44 | 89 | availability/BOM/target/lifecycle/copy 的事实边界与 coordinator 调用 |
| B14 | catalog | 52 | 277 | item/category/dictionary/option/copy 与 CatalogInventoryCoordinator、facade |
| B15 | workspace-iam | 110 | 130 | account/invitation/role/user 与 auth/rate-limit/coordinator support |
| B16 | organization | 145 | 143 | hierarchy、entity、visibility、store 与 task-read/audit/receipt |

当前比较键不是验收分母；direct receiver/sink 无法复核时须标 `UNVERIFIED_REQUIRES_EVIDENCE`。表中数字仅为当前只读预览，B4 前重新计算；不把 tx 与 direct 相加，也不把预览值当作成本或完成度。

### 5.4 KEEP 类和 coordinator

KEEP_FACADE、KEEP_TASK_READ、KEEP_ADAPTER_SUPPORT、KEEP_COORDINATOR 不得静默跳过 module 的 SQL sink。它们的 aggregate class boundary 不搬进其它 owner，但其实际 SQL 按 B3/B4–B16 规则处理。跨 owner coordinator 不塞入 Catalog/Inventory 等业务 aggregate；若 coordinator 直接持有未预期 SQL，停下来报告边界。

## 6. B16 后整体收口与 acceptance

### 6.1 逐代码与详设对账

这是进入交付 review 的前置门，计划中必须有名为“逐代码与详设对账”的独立步骤。逐个变更点重新打开需求、详设、计划、memory、规范和 owning source，核对：文件/class/function、包、public FQCN/constructor、事务/代理、SQL source/sink、caller、测试、checker marker、前端 import path、范围边界。结果只能 MATCHED 或 OPEN；OPEN 必须根因修复并 fresh 复查。

### 6.2 全范围三维对账

不把 CP-0/B1–B16 的局部结果拼成总结果。全范围独立重读需求、详设/IA、project memory/规范，逐条比行为、形态、动作、关系、位置、用户可见文案、失败/恢复、事务、readback 和限制。

### 6.3 唯一全量 backend acceptance

只有全范围对账 MATCHED 后执行：

- 受管入口 operation=all；
- 最后一次 run 必须晚于全部 production 与 test code 改动；
- CONTRACT 与 BUSINESS 分开且全绿；businessMode=REAL；每场景有真实 business oracle；
- DB_OPERATIONS 仅信息性；budget verifier 是独立 run-level evidence；
- cleanup 单独全绿；
- 使用远端 Java/Spring、远端 PostgreSQL/对象存储，本机只 Vite/Playwright，经 HTTP/asset tunnel；禁止本机 Spring/PostgreSQL tunnel；
- 不与不存在的旧 baseline 比较。

### 6.4 本计划边界

reset、seed、DEV、browser L2、UAT、部署和切流不属于本次文档编写授权。若未来实施授权明确包含 reset/DEV/seed，仍必须由受管 scripts 执行并分开报告 business/cleanup；本计划不提前执行。

## 7. 交付材料

交付给 Dexter/Claude review 的材料必须包含：

- 一份详设、一份实施计划，且明确一个整体 delivery unit；
- 89 个候选逐个分类、13 module SQL/source/sink 矩阵和 B4–B16 排序 evidence；
- 四张工作矩阵及其生成口径，不把数字当验收分母；
- B1 各 red fixture、import closure、真实 verify sequence 和 P2 处理；
- B2 三个 frontend target 的实际 owning path、behavior pinning 与 consumer 变更边界；
- B3 capture before/after、unknown list、constant shape 与 zero execution boundary proof；
- B4–B16 每批 transaction/self-call/lock/idempotency/readback proof 和步骤级三维结果；
- “逐代码与详设对账”逐项 MATCHED/OPEN 结果；
- 最终 acceptance、reset/seed/DEV/L2 在当前文档阶段标明未执行，而不是提前宣称通过。

## 8. 计划自检

- [ ] 两份文档引用需求正本且路径存在
- [ ] B1–B16 全部覆盖，属于同一个 delivery unit
- [ ] B4–B16 为 13 module，不用旧数字决定范围
- [ ] 所有 89 个候选有分类，分类理由基于事实 owner 而非规模
- [ ] 详设 3.2B 的关键 facade/coordinator/lifecycle/hierarchy 事实锚点逐项补齐 command/CAS-lock/readback；候选边界外的 app-edge coordinator 不被纳入
- [ ] B3 只搬文本，B4–B16 才搬 execution；M-08 三个点名技术段文件按裁定归位
- [ ] SQL extractor 按 M-06-A 覆盖最小支持集；tier 2 unknown 有显式输出、capture/review 闭合或 STOP
- [ ] public persistence 方法只接收读侧 filter/sort/page/target，以及写侧聚合/命令对象/字段值等业务级参数；条件选择与组合在 persistence 内完成；application/domain 无 SQL literal，且不以任何参数形式传递 SQL fragment 或 wrapper
- [ ] effective SQL 采用 capture comparison，业务 oracle 只是补充
- [ ] SELECT star 方案 A 真实 string mutation 先决，失败按 §15 报告
- [ ] path exemption 覆盖 cli 与 imported helper，9+1 mutation 全红
- [ ] write-path 三段各有独立 red fixture，残余 gap 不冒充完整
- [ ] acceptance structure 覆盖 11 个文件，P2 不污染 business denominator
- [ ] 零注解 helper 的 consumer 为无条件可执行，或在同一位置声明条件、默认状态和本 proof 的显式启用方式
- [ ] vocabulary 写回 backend standard 且 review-only
- [ ] B2 不新增 Journey/testId/L2，ui 顶层文件数方向下降
- [ ] 每 CP 有前读、写入、focused proof、同输入后读和 fresh 3D reconciliation
- [ ] facade consumer 的固定文件集合已在详设 17B 列明，CP-0 只补签名、行号和类型证据，不重新发现范围
- [ ] 17B 的 wildcard 族级索引已在 CP-0 展开为每个 public overload 的完整签名；未展开项不能 MATCHED
- [ ] 有“逐代码与详设对账”步骤
- [ ] B16 后只有一次全量 backend acceptance，且晚于全部代码改动
- [ ] 未在本次文档编写阶段执行代码、测试、动态环境、reset、seed、DEV 或验收

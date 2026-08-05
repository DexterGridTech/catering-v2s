---
title: catering-v2s 全工程代码评审（Claude 独立报告）
reviewTarget: CODEBASE
scope: 前后端代码、契约、脚本与治理工具；按 Dexter 的 9 项要求
verdict: 见各条 finding（本报告不构成 GO/NO-GO 门禁结论）
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 本报告是评审与优化输入；不授权任何实现、契约/schema 改动、DEV/seed/reset、动态运行或 Roadmap 变更
createdAt: 2026-08-05
---

# catering-v2s 全工程代码评审（Claude）

## 0. 方法与覆盖边界（先说清楚我做了什么、没做什么）

- **先读记忆再读代码**：6 个 kernel、15 条 routed memory、G-01…G-12 业务语料库索引与
  `MODULE_OWNER_SOVEREIGNTY` / `ONE_DB_MULTI_SCHEMA` / `X_CONSUMER_FACES_ONLY` /
  `COMMAND_REQUIRED_TRANSACTION` 等断言，均在读代码前读完。
- **方法**：先对全仓做机器化探针（枚举字面量分布、路径拼接、日志密度、重复符号、缺陷模式），
  再对每一条候选 finding **打开真实生产源码逐行确认**。所有数字都是我自己算的，未采信任何自报值。
- **规模基线**（我实测，排除 node_modules/build）：

| 目标 | 文件 | 行 | 其中 generated | 其中 test |
| --- | ---: | ---: | ---: | ---: |
| backend app (edge) | 309 | 6,586 | 241 / 2,554 | 0 |
| backend modules (owner) | 147 | 12,436 | 0 | 27 / 2,642 |
| platform-admin | 116 | 7,529 | 3 / 3,157 | 62 / 1,410 |
| operations-admin | 117 | 15,270 | 5 / 7,326 | 44 / 2,441 |
| admin-ui-foundation | 22 | 964 | 0 | 3 / 150 |
| contracts | 57 | 35,384 | — | — |
| scripts | 36 | 7,495 | 0 | 24 / 4,279 |
| tools（治理 CLI） | 16 | 8,784 | 0 | 0 |

  **手写生产代码约 23K 行**；治理工具 8.8K 行。

- **我没有覆盖的**：数据库 migration 的语义正确性、契约 35K 行的逐条 schema 审查、
  前端视觉/可访问性、以及任何动态运行。这些不在本轮结论内。

---

# 优先级 P0

## P0-1 ｜生产环境下，业务失败**不产生任何日志**（对应要求 5、9）

**这是本次评审最重要的一条。**

**证据（我实测）**

```
后端生产 Java 文件（非 test、非 generated）      188 个
其中声明 Logger 的                                1 个
全仓 log.info / warn / error / debug 调用点        0 处
```

唯一的 Logger 是 `modules/foundation/.../diagnostic/Slf4jSecurityDiagnosticRecorder.java`，
它只接收 `PublicSecurityDiagnosticInterceptor` 投喂的事件，而该拦截器只覆盖
`@PublicSecurityOperation` 标注的**公共安全路由**（登录、OTP、找回、邀请）。
**147 个 operation 中占多数的已认证业务面，成功与失败都不写任何一行日志。**

前端同样：

```
platform-admin / operations-admin
   createSafeLogger 引用     各 1 个文件（只有 app/api/*Api.ts）
   logger.* 显式调用点        各 0 处
   console.* 直用             各 0 处
```

而且那唯一的接线是：

```ts
// apps/frontend/platform-admin/src/app/api/PlatformApi.ts:7
const logger = createSafeLogger({service: 'platform-admin', enabled: import.meta.env.DEV});
```

**`enabled: import.meta.env.DEV`** —— 生产构建下 `DEV === false`，前端可观测性**整体关闭**。

**具体失效场景（真实可发生）**

运营管理员作废合同时撞上并发：
`modules/store-contract/.../ContractCommandService.java:115` 的 CAS
`... WHERE ... status='ACTIVE' AND version=?` 返回 0 行 → `throw new ContractConflictException()`。
**服务端零日志，前端零日志。** Dexter 只能看到一个 409。谁在并发、撞的是哪条合同、
expectedVersion 是多少 —— 全部不可知，只能靠复现。

**根因**

不是疏忽，是**观测能力被建成了"诊断期设施"而不是"常驻设施"**：
`HttpRequestMetricsInterceptor` 与 `SeedRequestMetricsInterceptor` 都是为受管诊断 run 服务的
JSONL sink；`SecurityDiagnosticRecorder` 只挂在公共安全面。三者都不是**应用日志**。
于是"能被追踪的调用"= 公共安全路由 + 诊断 run 期间，而不是全部调用。

**这条与仓内自定纪律直接冲突**：`project-memory/pitfalls/log-first-failure-retry.md` 要求
"失败先读日志再重试" —— 但业务失败**没有日志可读**。
作为 AI-first 工程，这等于把 AI 最主要的排障输入切断了。

**优化方向（按代价从小到大）**

1. **最小且立刻见效**：owner 命令的**失败路径**统一记一行结构化日志。
   现在所有 owner 都通过 typed exception 失败，可以在 edge 的 `@ControllerAdvice`
   （已存在 `ContractProblemAdvice` 等）里集中落一条
   `{correlationId, requestId, operationId, owner, errorCode, expectedVersion}` —— **改一处，覆盖全部写命令**，
   不需要动 147 个 handler。
2. 把 `HttpRequestMetricsInterceptor` 的 completion 事件在生产也落一条 INFO 级访问日志
   （已有 `operationId/owner/route/duration/dbCount` 五元组，字段现成）。
3. 前端把 `enabled` 从 `import.meta.env.DEV` 改为**级别控制**（生产保留 warn/error，
   DEV 全开），并保持 `SafeLogger` 既有的脱敏边界。

**是否需要 Dexter 裁决**：否（1、2 是补齐既有能力）；
但"生产日志保留多久、落到哪里"属运维决策，建议登记到 `HANDOFF.md` 而不是现在建基建。

---

## P0-2 ｜五类组织节点这个封闭集合有 **4 份声明 + 316 处裸字面量**（对应要求 1、3）

**证据（我实测）**

生产 Java 中业务枚举字面量共 **673 处**，五类节点占绝大多数：

```
PROJECT 104   STORE 100   GROUP 99   HEAD_COMPANY 89   REGION 85
其中：SQL 内嵌仅 4 处，Java 逻辑（switch / equals / List.of）316 处
```

同一个封闭集合被声明了 **4 次**：

| # | 位置 | 形态 |
| --- | --- | --- |
| 1 | `app/edge/generated/wire/ServiceNodeType.java` | **generated** enum，5 值 |
| 2 | `app/edge/catalog/OrganizationNodeType.java` | 手写 enum，5 值，**与 #1 完全同值** |
| 3 | `modules/workspace-iam/.../WorkspaceRoleService.java:39` | `Set.of("GROUP","REGION","PROJECT","HEAD_COMPANY","STORE")` |
| 4 | `modules/organization/.../OrganizationHierarchyService.java:25` | `List.of("REGION","PROJECT")`（子集） |

**根因不是偷懒，是分层无处可放（这一点很重要）**

我核过 Gradle 依赖方向：`app` → `modules:*` 是**单向**的
（`catering-business-server/build.gradle.kts:9-16`）。
两个 enum 都住在 **app/edge 层**，因此 `modules/organization`、`modules/workspace-iam`
**在架构上就不可能** import 它们 —— 除非反转依赖。
owner 只能自己再声明一份，或者直接写裸字符串。

**同时存在一个现成的解**：`modules/foundation` 与 `modules/execution-context`
被 app 和各 owner **共同依赖**（`workspace-iam/build.gradle.kts:6-8`），
而且 `execution-context` 是 `api(...)` 依赖会传递导出 —— **它就是这个封闭集合的天然住处，但现在什么都没放**。

**为什么这值得修（不是洁癖）**

`OrganizationHierarchyService.java:486` 这一行同时内联了 4 个封闭集合：

```java
if (!List.of("NAME","CODE","UPDATED_AT").contains(safeSort) || !List.of("ASC","DESC").contains(safeDirection)
    || (type != null && !NODE_TYPES.contains(type)) || (status != null && !List.of("ENABLED","DISABLED").contains(status))
    || (projectId != null && !"PROJECT".equals(type))) throw new OrganizationValidationException();
```

新增一个节点类型时，需要人工找齐 4 份声明 + 316 个使用点；漏一处就是
**静默的授权/可见性缺口**（比如某个 `switch` 的 `default -> false`）。
契约门 `edge-codegen --check` 只保证 wire 层一致，**管不到 owner 内部的 316 处**。

**优化方向**

- 在 `modules/execution-context`（或 `foundation`）放一个 `ServiceNodeType` 封闭类型，
  含 `fromWire(String)` 的 fail-closed 解析；
- edge 的 generated enum 改为**从它派生**（codegen 生成委托，不再第二次定义），
  删除手写的 `OrganizationNodeType`；
- owner 的两处手写集合改为引用它；
- 316 处裸字面量**不必一次改完**：优先改 `switch`/`equals` 这类**分支判定**（漏改会静默走错分支），
  SQL 内嵌的 4 处可保留。

---

# 优先级 P1

## P1-1 ｜两个 App 各自造了 14 个同名轮子（对应要求 6）

**证据**：两个 App 的非 generated、非 test 源码中，**各自独立定义**了同名 helper：

```
action, activeControllers, adminCatalog, expandPath, extensionFields, extensionValue,
field, hierarchyNameCollator, hierarchySearchMatches, logger, menuIconByKey, problem,
statusLabel, time                                              —— 共 14 个
```

而 `admin-ui-foundation` 已经导出 22 个共享能力（drawer 生命周期、overlay lock、
列表状态、observability、HTTP protocol、`formatCodeNamePath` 等）——
**foundation 的机制层做得不错，但"展示与语义层"没进去**。

其中 **`statusLabel`、`problem`、`hierarchyNameCollator`、`menuIconByKey` 风险最高**：

- `statusLabel` 是**业务文案**（已启用/已停用/经营中/已停业…），G-08/G-09 语料库有权威叫法。
  两份独立实现意味着两个后台可能对同一状态给出不同中文 —— 这是**用户可见的不一致**，
  而且没有任何门能发现。
- `problem` 是 typed error 到用户提示的映射，两份实现意味着同一 `errorCode`
  在两端可能有不同措辞或不同兜底行为。
- `hierarchyNameCollator` 是排序规则，两份实现会让同一组织树在两个后台**顺序不同**。

**根因**：foundation 的收敛标准是"机制是否可复用"，而不是"真相是否唯一"。
文案与语义映射被默认当成 App-local，但它们其实是**业务真相**。

**优化方向**：把 `statusLabel` / `problem` / `hierarchyNameCollator` / `menuIconByKey`
上收 foundation，并让状态文案的来源指向语料库口径（G-08/G-09）；
`expandPath`、`time` 这类纯工具次之；`adminCatalog`、`extensionFields` 属 App 各自的
generated 投影消费，**保持 App-local 是对的**，不要一刀切。

## P1-2 ｜`pageSize > 100` 这个策略被复制了至少 6 份（对应要求 1、3）

**证据**：

```
modules/organization/.../OrganizationAuditHistoryService.java:17, :28, :36
modules/organization/.../BusinessEntityService.java:440
modules/workspace-iam/.../WorkspaceRoleService.java:127
modules/audit-model/.../AuditHistoryPage.java:8
```

六处独立写死 `pageSize > 100`，分属 3 个 owner。这是**平台级读取策略**，
不是某个 owner 的业务不变量。改上限要改 6 处，漏一处就出现"某个列表能拉 500 行"的不一致。

**优化方向**：`modules/foundation` 提供 `PageRequest.bounded(page, pageSize)` 统一钳制并
抛统一 typed error；各 owner 只保留自己**额外**的收紧（如果有，需要说明理由）。

## P1-3 ｜诊断失败被静默吞掉，且没有日志兜底（对应要求 8）

**证据**：`app/edge/platform/workspace/PlatformCommercialGroupController.java:125`

```java
try { diagnostics.recordWriteFailure(event); } catch (RuntimeException ignoredAgain) { }
```

"诊断失败不要拖垮业务"这个意图是对的，但结合 P0-1（无日志），
结果是**这次诊断丢失没有任何痕迹**。同族还有
`modules/asset/.../MinioAssetObjectStorage.java:69 catch (Exception failure) { return false; }` ——
对象存储异常被降级成布尔 false，调用方无法区分"不存在"与"存储挂了"。

**优化方向**：`ignored` 类 catch 至少落一条 WARN（P0-1 落地后即可）；
`MinioAssetObjectStorage:69` 建议区分 NotFound 与其他异常，后者应向上抛或明确记录。

---

# 优先级 P2

## P2-1 ｜`findFirst()` 承载唯一性假设（对应要求 4、8）

`WorkspaceAuthorizationCatalog.java:137`、`WorkspaceCapabilityRequirementCatalog.java:58`、
`JdbcGroupWorkspaceRepository.java:65`、`OrganizationCommandService.java:111` 等处用
`findFirst()` 表达"应当唯一"。生成期确实保证了 catalog 的唯一性
（`edge-codegen.mjs` 有基数断言），但**Java 侧对"出现两条"是静默取第一条**，不是 fail-closed。

我在 U04 复审时对 `homePageForRoleNodeType` 提过同类问题；这是同一模式的其余实例。
**优化方向**：catalog 类查找改为"恰好一条否则抛"，让后端独立于生成期也 fail-closed。
数据库来源的 `findFirst`（如 `JdbcGroupWorkspaceRepository:65`）若有唯一索引支撑则可保留，
但应在注释里指明依赖哪个约束。

## P2-2 ｜超长单行方法伤可读性（对应要求 2）

`ContractCommandService.java:88` 与 `:115` 各是一整行内联 SQL + 条件 + 抛错；
`BusinessEntityService.java:586` 把 5 分支 `switch` 压在一行；
`OperationsWorkspaceInvitationController.java:60` 把 session 解析、幂等校验、target 解析、
intent 构造、命令调用、wire 映射全压在一行。

职责分离**在架构层是清楚的**（owner 主权、edge 只编排、跨模块走 typed command——
这几点我逐处核过都成立），问题只在**行内密度**。
对 AI-first 工程这条比对人更重要：单行 400+ 字符会让 diff、定位与逐点重读都变困难。

**优化方向**：不必全仓格式化；建议把**内联 SQL 常量**提取为命名常量（同时改善 P0-1 的日志上下文），
其余按接触即改。

## P2-3 ｜治理工具体量与右尺寸（对应要求 7、9）

`tools/` 现为 **8,784 行**，其中 4 个文件占 6,344 行：

```
compliance-control 2,542    implementation-design-granularity 1,387
capability-invariants 1,340   verify-gates 1,075
```

对照手写生产代码 ~23K 行，治理工具占比约 38%。

**需要公允地说**：这一块 Dexter 已经在 7 月 31 日的 harness trim 中砍过一轮
（我当时的复审结论是 GO，实测净删除 −93K 字节 / −17.7%，且退役判据
`CONTROL_RETIREMENT_AFTER_FIVE_PACKAGES` 已进 `verification-governance`）。
**现在的形态是被裁定过的，我不重开这个结论。**

仍值得注意的是：`compliance-control` 单文件 2,542 行，承担 package 准入、hook、
baseline recovery、problem-family、静态扫描等多种职责，**它自己就是本仓最大的单文件**。
按既有退役判据，建议在下一个 package 顺带检查它内部哪些分支"最近五个 package 从未变红"。

---

# 优先级 P3（记录，不建议现在动）

## P3-1 ｜前端手拼 API 路径：**0 处**（对应要求 3）——这条是做对了

我全量扫描两个 App 的 `src`：`/api/...` 字面量共 462 处，**全部在 generated 客户端内**，
生产特性代码与测试代码 **各 0 处**。契约到客户端的单向投影纪律是守住的，
这一点应当明确记为**不得回退**。

## P3-2 ｜owner 边界与事务纪律：核过的部分都成立（对应要求 2、4）

- 跨模块写走 typed command 并入同一 `REQUIRED` 事务；
- extension values 写在**宿主自己的 schema**（`organization.<table>.extension_values`），
  无跨 schema DML；
- edge 不自行拼装授权事实（session entry 全部由 workspace-iam owner 组装）。

这些是我在前几轮 review 中逐处验证过的，本轮复查未见回退。

---

# 与要求的逐条对照

| # | Dexter 的要求 | 结论 |
| --- | --- | --- |
| 1 | 固定值是正确使用还是偷懒 | **混合**：673 处枚举字面量与 6 份 `pageSize>100` 属真实问题（P0-2、P1-2）；根因是分层无处可放，不是单纯偷懒 |
| 2 | 清晰简洁、职责分离 | **架构层良好**（owner 主权/edge 薄/单向依赖都成立），**行内密度差**（P2-2） |
| 3 | 真相是否唯一 / 该契约化 | 前端路径 **0 手拼（做对了）**；后端封闭集合 **4 份声明（P0-2）**；文案与错误映射两份（P1-1） |
| 4 | 简单、健壮、高效 | 结构简单；健壮性有 `findFirst` 与吞异常两类缺口（P2-1、P1-3）；效率问题已由 U13 诊断单独覆盖 |
| 5 | 日志是否完整、调用可否追踪 | **不完整**。已认证业务面 0 日志、前端生产关闭 —— **P0-1，本次最高优先级** |
| 6 | 是否造轮子、什么值得抽象 | 两个 App 14 个同名 helper；**最该上收的是 statusLabel / problem / collator / iconKey**（P1-1） |
| 7 | 是否过度设计 | 治理工具占 38%，但已被裁定过一轮；只建议对 `compliance-control` 用既有退役判据继续瘦身（P2-3） |
| 8 | 可能被忽略的 BUG | 吞异常 + 无日志（P1-3）、`findFirst` 静默取首条（P2-1）、对象存储异常降级为 false |
| 9 | AI-first 底座是否健壮高效 | **底座的"防"很强、"观"很弱**：门与红变异做得扎实，但 AI 排障最依赖的运行时日志几乎不存在（P0-1）。这是底座当前最大的不对称 |

---

# 建议的处置顺序

1. **P0-1 的第 1 步**（`@ControllerAdvice` 集中落失败日志）—— 改一处、覆盖全部写命令，
   投入最小、对 AI-first 收益最大。
2. **P0-2** 的封闭类型下沉到 `execution-context`，先改分支判定处。
3. **P1-1** 的四个语义 helper 上收 foundation（尤其状态文案，涉及用户可见一致性）。
4. P1-2、P1-3、P2-* 按接触即改。

**本报告不授权任何实现**：以上均为设计输入，具体改动仍须按既有流程单独开 package、
冻结详设并接受独立 review。

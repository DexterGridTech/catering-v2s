---
title: 后台性能重构 implementation-facing 详设
status: PROPOSED_REVIEW_ONLY
programId: V2S_W0_W4_EXECUTION
goalId: BACKEND_PERFORMANCE_REFACTOR_20260808
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
reviewTarget: DESIGN
reviewCycleId: BACKEND-PERFORMANCE-REFACTOR-DESIGN-20260808
reviewRoundLimit: 2
SKILL_USED: cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
---

# 后台性能重构 implementation-facing 详设

## 1. 原始问题、用户目标与范围

本设计落实 [HTTP 接口数据库往返与时延问题描述](../../review/platform/2026-08-08-v2s-http-performance-problem-description-codex.md)、[Claude 性能重构方案](../../review/platform/2026-08-08-v2s-backend-performance-refactor-plan-claude.md) 第 14 章、[carry-over manifest B.6.6](../2026-07-24-v2s-carryover-manifest-claude.md) 与 [Claude 复核](../../review/platform/2026-08-09-v2s-backend-performance-refactor-design-recheck-claude.md)。已冻结证据显示：当前 196 个生成 route 是静态审计分母；正常路径的高数据库计数不能推定为单条 SQL 慢，也不得作为删除授权、receipt、CAS、审计或必要 readback 的理由。

工程团队要获得的是可持续的**正确性不降级且实际减少 SQL 往返的治理能力**：处理职责可静态对账、命令授权事实只在同一事务内解析一次、catalog 品牌/复制来源不再退化为客户端字符串、读模型不在循环中逐项查询；SQL-M1～M6 必须达到各自声明的读取次数，而非仅“不回归”；每条性能结论都能回到受控 workload。

本包不新增 UI Journey、HTTP operation、业务字段、缓存、索引、MQ/outbox、内部 HTTP client、跨 schema DML 或跨请求缓存。UI 为 `NOT_APPLICABLE`：现有页面只消费既有 operation；任何后续可见错误/状态变化必须先出现在第 9 节行为变更表，才可进入对应 app 的独立设计分母。

## 2. 不可突破的架构裁决

1. 一个业务 deployable、一个 PostgreSQL、多 owner schema、一个 Flyway history 保持不变。
2. 命令由 initiating owner 的 application handler 开启 `REQUIRED` 事务；coordinator 零资产，只按公开 typed judgment/command API 调目标 owner。
3. 写事务不得跨 schema `SELECT/JOIN`；跨 owner 前置事实只能是闭集 typed judgment。任务型 read 可在事务外使用明确受控的跨 schema read 组件。
4. 196 route 的 HTTP 映射仍由 edge controller 负责；**业务 operation 选择**必须由生成期 owner-local静态 binding 负责。禁止 `Map<String, Handler>`、service locator、反射、扫描 Bean 或跨 owner 全局 dispatcher。
5. command 的 authorization / scope / grant 只在该 command 事务内创建一次；owner 在 receipt lookup/replay 与 mutation 前重核其对象事实，且 owner 不再查询 IAM。

## 3. 分母与唯一真相

### 3.1 A：196 handler 迁移分母

唯一输入为两个生成 registry 的 `.operations[]` 不相交并集：

| owner | operation 数 |
|---|---:|
| workspace-iam | 76 |
| organization | 39 |
| catalog | 25 |
| platform-iam | 16 |
| inventory | 11 |
| contract | 10 |
| platform-workspace | 7 |
| fulfillment-production | 4 |
| extension | 3 |
| platform-asset | 3 |
| asset | 2 |
| **总计** | **196** |

实施时新增唯一输入 `contracts/registry/operation-handler-bindings.json`。它不是从 controller、包名或字符串 case 推断，而是每个 operation 一行显式声明：

```json
{
  "operationId": "...",
  "owner": "catalog",
  "routeRegistry": "catalog-inventory",
  "mode": "READ|COMMAND",
  "adapter": "com.catering.v2s.catalog.application.GetCatalogItemOperation",
  "wireRequest": "CatalogItemQuery",
  "wireResponse": "CatalogItemDetail",
  "contextKind": "READ_CONTEXT|WORKSPACE_EXECUTION_CONTEXT|WORKSPACE_PROTOCOL_CONTEXT|PLATFORM_COMMAND_CONTEXT|PUBLIC_PROTOCOL_CONTEXT",
  "transactionMode": "OUTSIDE_TRANSACTION|REQUIRED",
  "copyRole": "NONE|COPY_SOURCE|COPY_TARGET",
  "commandBoundary": "NOT_APPLICABLE|OWNER_COMMAND|PROTOCOL"
}
```

`commandBoundary` 是逐 operation 的执行证据契约：read 必为 `NOT_APPLICABLE`；真正 receipt-backed owner mutation 为 `OWNER_COMMAND`；登录、OTP、退出、凭据变更、邀请/恢复协议为 `PROTOCOL`。它不从 `contextKind` 后缀、consumer face 或是否恰好存在 receipt service 推导；这保证平台协议即使目前使用 `PLATFORM_COMMAND_CONTEXT`，也不会被请求级 owner-command phase 门错误计入。snapshot 只从该字段导出 owner-command 分母，并同时记录 applicable/observed operation 覆盖数。

生成器必须拒绝：缺/重 operation、owner 与 route registry 不同、一个 adapter 绑定多个 operation、未声明 wire/context/transaction/command boundary、command 使用 `OUTSIDE_TRANSACTION`、read 使用 `ExecutionContext`、任何未登记 `copyRole`，以及逐 operation protocol/owner boundary 漂移。输出是每 owner 的编译期可见 `*OperationBindings`，以 closed `switch` 直接调用构造器注入的 owner-local adapter；edge 不能持有其他 owner 的 handler 集合。

**反例边界**：`stageOperationsCatalogAsset` 是 multipart，必须有专用 decode adapter；它仍占一个静态 binding，不得为统一 `ObjectNode` 而退回字符串 dispatch。catalog read/write/copy 可以保留 application coordinator，但 coordinator 只能处理该 operation policy 明列的有限 cross-owner command/judgment，不能成为 196 operation 的总线。

### 3.2 B：任务型 read 预算分母

当前 registry 中 method=`GET` 的 83 个 operation 先全部进入 `contracts/registry/task-read-surface-policy.json` 的候选集合；该文件必须逐行显式给出 `TASK_READ` 或 `PROTOCOL_READ_EXEMPT` 及 reason。默认是 `TASK_READ`，因此新增 GET 无标签即失败；`PROTOCOL_READ_EXEMPT` 只允许下列五项：

- `getCurrentPlatformSession`；
- `getOperationsWorkspaceLoginEntry`；
- `getPublicInvitationView`；
- `getPublicInvitationCompletion`；
- `getPublicAssetContent`。

故本轮 B 的精确集合是 **78** 个 `TASK_READ` operation；五项协议/内容读取不声明 `BUDGET`，但仍保留完成事件与运行时数据库计数。`OperationBudget` 的唯一计量作用域冻结为 **request-scope**：从 edge 接收请求到 response 完成的同一 requestId 的全部 JDBC round trip 计入该 operation；不得改为只计 owner handler 以规避预算。

预算不是每接口固定三条，也不能按 consumer face 强制相同 SQL 数。生成 binding 仅可选择闭集 `ReadContextKind`，不能自行声明 SQL：`OPERATIONS_SCOPED` 固定加载 `WorkspaceReadAuthorizationFacts + VisibleOrganizationFacts`（事实 cap=2）；`PLATFORM_WORKSPACE` 固定加载 `PlatformReadSessionFacts + EnabledSelectedWorkspaceFact`（cap=2）；`PLATFORM_GLOBAL` 固定加载 `PlatformReadSessionFacts`（cap=1）。`EnabledSelectedWorkspaceFact={workspaceUuid,groupWorkspaceKey,status=ENABLED}` 只供既有平台 workspace-scoped task read 的 selected-workspace 解析与既有 typed 403，不是 operations session 的状态门；其固定集为 15 条平台 B read。`getPlatformEntityAuditHistory` 不能以 operation-wide kind 装载它：仅 `GROUP_WORKSPACE|WORKSPACE_ROLE|WORKSPACE_ACCOUNT|WORKSPACE_INVITATION|EXTENSION_DEFINITION|STORE_CONTRACT` branch 使用该事实并保留 typed failure，`PLATFORM_ADMIN` branch 不得加载。每个 B 行还显式给最小 `requiredFactSet`、`primaryQueryCap=1`、`optionalCountCap=0|1`、`declaredExtrasCap=0`；`primaryQueryCap>1` 只可进入由 `doc/decisions/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline.md` 冻结的至多 10 条具名例外表，且必须写用户任务、基数、fixture、复核日期与每个 owner-local projection 的逻辑 statement 上限。请求总数必须等于闭集 `ReadBudgetComponent` 的实际相加，所有 component 均不超过 cap，任何 `UNCLASSIFIED` 即失败；不得强迫实际值等于某种最大上下文 cap 而平白多查，也不得把 operation 升为严格超集 kind 来换取更大 cap。

该分解落实 B.6.6 的完整机制：每请求的 owner-local 只读事实只加载一次，授权只读取内存投影；祖先与范围约束进入主查询的 `EXISTS`；owner 纯动作判断是进程内计算。任何无法满足这些约束的 B operation 都处于 `UNMEASURED_BLOCKS_OPTIMIZATION` 或 `REMEDIATION_REQUIRED`，不得以“有界豁免”放行。B 的永久豁免上限为 **0**；五项协议/内容读取是分母外的闭集，不是 B 的豁免出口。

`doc/decisions/2026-08-09-v2s-backend-performance-phase4-read-budget-rebaseline.md` 与 `doc/decisions/2026-08-09-v2s-backend-performance-phase4-owner-projection-rebaseline.md` 共同冻结 10 行反例：前五条账户/邀请 read 各最多两段具名 owner-local primary projection；后五条的有限分母、owner boundary 与分支条件由后者逐项登记。`getOperationsEntityAuditHistory` 则以 typed target-authorization projection 收敛为 cap=1，不属于例外。该上限不是任意 SQL 的许可；`optionalCountCap`、`declaredExtrasCap=0`、request-scope component 对账、未测量阻断与其余 68 条 `primaryQueryCap=1` 均不变。

`getOperationsEntityAuditHistory` 的 projection 不是字段标签：它在 `app/application/audit/OperationsAuditTaskReadService#read(OperationsAuditReadQuery)` 形成静态闭集九分支（`WORKSPACE_ACCOUNT|WORKSPACE_INVITATION|COMMERCIAL_GROUP|ORGANIZATION_NODE|BRAND|TENANT|HEAD_COMPANY|STORE|STORE_CONTRACT`）。typed query 仅含已加载的 read facts、canonical entity type、UUID 与 page；每个 branch 由对应事实 owner 的单个 named query 同时完成 target/host-scope 判定、typed absent/mismatch failure、window-count/page。edge 不得保留 `detail`/`view` 或授权 lookup。transition gate 必须对 reader path/method、typed input/output、九 branch、edge call 与 single-query predicate 做 source-bound 验证并有真实 production-source red mutation；未满足前该行仍 `SOURCE_NOT_IMPLEMENTED_BLOCKED`。

### 3.3 command 基线与未触及 command

113 个非 GET operation 均是 command 候选，但**不自动得到数字**。本轮只有 `performance-refactor-command-baselines.json` 中显式列出的 C1–C6 操作会生成 `MeasuredBaseline.fromFixture(fixtureId)`；每一行绑定 operationId、成功/重放/拒绝/冲突分支、运行时 measurement schema、fixture、当前值、允许的语义不变比较方式。其余 command 在 binding 上没有 `BUDGET`、`MeasuredBaseline` 或占位数字。

静态门必须同时验证 A=196、B=78、command-baseline 集合，以及 `A - B - protocol-exempt` 中未触及 command 零数值声明。命令 baseline 一律以同一具名 fixture 的前后受控实测为准，不以预计削减量或 seed 平均值判定。

## 4. Handler 具体接口与生成绑定

以下接口是本轮详设锁定的形态；实现不得自行再引入 `operationId + ObjectNode` owner API：

```java
public interface ReadOperation<Q, R> {
  OperationDescriptor descriptor();
  OperationBudget budget();
  R handle(ReadContext context, Q query);
}

public sealed interface CommandContext
  permits WorkspaceExecutionContext, WorkspaceProtocolContext,
          PlatformCommandContext, PublicProtocolCommandContext {}

public interface CommandOperation<C extends CommandContext, Q, R> {
  OperationDescriptor descriptor();
  Optional<MeasuredBaseline> baseline();
  R handle(C context, Q command);
}

public interface ReadOperationBindings {
  Object invoke(ReadContext context, Object request); // generated closed branch only
}
public interface WorkspaceExecutionOperationBindings<S extends OwnerAuthorizationScope> {
  // generator emits one concrete typed method per workspace-execution operation
}
public interface WorkspaceProtocolOperationBindings {
  // generator emits one concrete typed method per workspace protocol operation
}
public interface PlatformCommandOperationBindings {
  // generator emits one concrete typed method per platform operation
}
public interface PublicProtocolOperationBindings {
  // generator emits one concrete typed method per public protocol operation
}
```

共同 callable 的 `CommandContext` 入口**不存在**。每个生成 method 的签名同时写死本 operation 的 request、response 和唯一 context kind，例如 `saveOperationsCatalogItem(WorkspaceExecutionContext<CatalogAuthorizationScope>, CatalogItemSaveRequest)`；平台/public/workspace-protocol 各自生成不同 method/interface。错误 kind 没有可调用 overload，必须编译失败。`Object` 只允许存在于生成 read branch 或某个具体 method 的私有实现第一行，立即 cast 为生成 wire 类型；不得进入任何 public command binding、owner API、application service、repository 或 business DTO。每个具体 adapter 只有一个 `OperationDescriptor` 常量；编译期测试断言 descriptor operationId 与 binding 行相等。

生成 binding 对 **全部 113 个 command** 强制写一项 context kind，绝不有 `DEFAULT`/`FALLBACK`：75 个 `operations-admin` command 只能二选一 `WORKSPACE_EXECUTION_CONTEXT`（active assignment/capability 的 server judgment）或 `WORKSPACE_PROTOCOL_CONTEXT`（登录、验证码、退出及会话建立/变更协议，只携带该 protocol 的 server facts，**不**拥有 capability grant）；29 个 `platform-admin` command 使用 `PLATFORM_COMMAND_CONTEXT`，由平台身份/凭据 protocol factory 在其 command transaction 首批读创建，不能进入 workspace capability；9 个 public command 使用 `PUBLIC_PROTOCOL_CONTEXT`，只携带 invitation、OTP 或 recovery 的 server-validated protocol facts，不能获得 workspace/platform grant。每个 factory 产物 immutable、无 public constructor，并由对应 owner 重核对象/协议事实。

75 个 operations-admin command 的两类选择不是 consumer face 推断：它是 `operation-handler-bindings.json` 的逐行字段。生成门要求 75+29+9=113、每 command 恰一类、public/platform 绝不绑定 workspace context、`WORKSPACE_PROTOCOL_CONTEXT` 绝不携带 `OwnerGrant`；跨 kind 调用编译失败并有红夹具。

`ReadContext` 仅含 edge 可信身份、consumer face、operation descriptor、server生成 correlation/request ID 与请求范围；它不携带 capability grant，不能被 command API 接受。其唯一可组合的只读事实是由 `ReadContextKind` 静态确定的 `WorkspaceReadAuthorizationFacts`、`VisibleOrganizationFacts`、`PlatformReadSessionFacts`、`EnabledSelectedWorkspaceFact`；它们各自由事实 owner 一次 request-local load，不能是 `Map`、`RequestFacts` 或跨 owner query bus。read handler 在事务外执行；若某 read 需要 owner 内 set-based SQL，则由该 owner 的 task reader 完成，不由 edge 逐 owner 拼装。

## 5. ExecutionContext 与 CatalogAuthorizationScope

### 5.1 workspace command 的唯一创建入口

新增 workspace-iam 公共 judgment API：

```java
CommandExecutionContextResolver.resolve(
    CommandInvocation invocation,
    OwnerScopeKind<S> requestedScopeKind)
  -> ExecutionContext<S>
```

`CommandInvocation` 仅由 generated binding 组装，包含不可伪造 `OperationDescriptor`、server session credential、已解码 typed request、server生成 correlation/request ID；不接受 header/body/path 里的 capability、brand、target、copy source 或 client request ID 作为 authority。`OwnerScopeKind<S>` 是由该 `OperationDescriptor` 生成的 sealed 静态 token；resolver 必须拒绝 descriptor 与 token 的不一致。`S` 因此同时出现在输入和输出，不得使用 unchecked cast、字符串 scope kind 或调用点推断。

调用位置是每个 command handler 的 `@Transactional(REQUIRED)` 事务起点、**首批读**。当前 catalog controller 的 `sessions.require → resolvedScope → resolvedBrand → resolveMutationAuthorization` 必须迁入该 resolver；controller 只做 HTTP decode、Idempotency-Key 存在性校验、route descriptor 和服务器 request identity 传递。

resolver 在一个事务内按固定顺序完成：fresh session → active assignment → ENABLED role 与 requirement/capability → organization scope/task-path judgment → opaque owner grant → owner-specific scope judgment。失败优先级保持当前 operation contract；不使用页面加载快照或跨请求缓存。

BP-U03 可以在 U06 handler runtime cutover 之前生成一个窄的 `WorkspaceCommandOperationToken` 投影，但仅限 catalog-inventory 的 26 条 `COMMAND ∩ WORKSPACE_EXECUTION_CONTEXT` operation。该 token 由 binding 与 catalog edge contract 的 requirement、owner、允许节点类型、capability 与 copy role 双源精确对账生成，供 context resolver 作 identity binding；它不提供 handler lookup、不接收字符串 operationId、不会接线 controller 或删除现有 dispatcher。U06 仍独占 196 handler 的静态 runtime 接线与 legacy dispatcher 退出。

### 5.2 不可变结构

`WorkspaceExecutionContext<S>` 是 final、无公开构造器/重建器的类型；workspace-iam factory 是唯一构造者。它拥有：workspace/group、account/assignment/role、page/capability projection、scope node、task path、consumer face、descriptor、contextVersion、authorizationRevision、server correlation/request ID 与 opaque `OwnerGrant`。本节其余 `ExecutionContext<S>` 均指这一 workspace-only 类型；platform/public factory 不复用该类。

`OwnerGrant` 替代可公开构造的 record：只提供 `verifyFor(requirement, capability, targetType, targetRef)`；其实现持有 requirement/capability/target 以及 assignment ancestry，构造与字段不向调用方公开。任何 owner 都只能验证，不能放宽、重建或把一个 grant 用于另一 operation。

### 5.3 catalog 专用 scope

catalog command 固定使用 `ExecutionContext<CatalogAuthorizationScope>`。该 sealed scope 只能由同一 resolver 在上述事务中通过 organization 的 `CatalogScopeLookup` 创建：

| 字段 | 来源 | 约束 |
|---|---|---|
| dataNodeType / dataNodeId | 已验证会话 scope | 非客户端可写 |
| brandRef | `resolveCatalogBrand` 的 organization judgment 结果 | 不得从 header/body/path 直接构造或覆盖；总部多品牌时，header 仅作为一次性、非授权的候选选择器传给 organization judgment，只有 judgment 返回值才可进入 scope |
| judgmentSource / revision | organization judgment 返回 | 用于审计/版本对账，不作客户端输入 |
| copyRole | `OperationDescriptor` 静态语义 | `NONE`/`COPY_SOURCE`/`COPY_TARGET` |
| copy source policy | `OperationDescriptor` 静态语义 | `TARGET_SCOPE`（local copy）、`CATALOG_ITEM`（temporary promotion）或 `ORGANIZATION_JUDGMENT`（brand copy）；不得由请求选择 |
| copySourceDataNodeId | `resolveCatalogCopySource` judgment | 仅 `ORGANIZATION_JUDGMENT` 的 brand-copy target 持有；local copy 的 source=target scope，temporary promotion 的 source 是 catalog owner 的 item fact，均绝不采纳 request source |

catalog owner 的 receipt 顺序固定为：scope/grant bind 验证 → 对象存在、状态、来源、revision 与业务不变量重核 → receipt hash/lookup → replay 或 mutation/readback。write 与 copy 都覆盖；任何 replay 在授权/对象重核之前返回都是 RF-13 失败。

总部多品牌选择保持现有运营后台的“选择已授权品牌”行为：edge 可把 `X-Workspace-Brand-Ref` 解码为 `CatalogBrandSelection`，但它只是 organization owner 的候选输入，既不进入 `WorkspaceExecutionContext`，也不能直接构造、覆盖或重建 `CatalogAuthorizationScope.brandRef`。store 的候选为空时由唯一持久化品牌判定；总部的候选为空或未获授权时 judgment 失败。`CatalogBrandJudgment` 必须返回品牌、owner judgment 来源和 revision；scope 只接受该返回值。body/path 中的同名字段不得参与该 judgment，任何伪造候选只能得到既有 typed scope failure，不能改变 scope。

## 6. 受控跨 schema task read 组件

不新增全局 query 模块。每个 initiating owner 仅可在自己的 `application` 包内建立 `<Owner>TaskReadService`；它必须命名具体用户任务，输入是 typed `ReadContext + Query`，输出是 typed read model，不暴露 repository/entity/JDBC row。

允许的跨 schema SQL 只在该组件、事务外、固定视图/CTE/显式 join 中出现；每个 join 都在 task-read policy 声明 source schema、目标字段、用户任务、基数与预算。禁止从 write handler、judgment API、owner command、listener 或 edge controller 调它。read 组件不获得写主权、锁、业务状态转换权或“以 read 推导写”的能力。

现有可复用正例是 `OrganizationOverviewTaskReadService`、`ContractTaskReadService` 与 catalog `CatalogInventoryApplicationService` 的受限任务读片段；后者要拆成 catalog/inventory 已声明 task reader，不能继续既承担读拼装又承担所有 command 分派。

## 7. 优化批次与逐分支不变量

| 批次 | delivery unit | 范围 | 不变量与反例 |
|---|---|---|---|
| 一 | BP-U01 | evidence 冻结、DB tracker bucket/phase、44 gate disposition、已知 defect | 不把 connection/transaction kind 误写成业务 section；无 phase 覆盖不得下性能结论 |
| 一 | BP-U02 | 196 static binding contract/generator/gates | multipart asset 是 binding 专用反例；不得以动态 map 代替 |
| 二 | BP-U03 | command context、owner grant、catalog scope、receipt 顺序 | 撤权/role 禁用/assignment switch、brand header 覆盖、copy source 伪造、replay 都先失败于重核 |
| 二 | BP-U04 | C4/C6 的分支语义与基线；BOM 批量化前置事实 | C4 五分支：正常、replay、增资产、移除无引用、移除仍引用；CAS 前置与写后 readback 不可机械删除 |
| 三 | BP-U07 | SQL-M1 command 68、C5 command 2、SQL-M3～M6 的实际 SQL 合并与 196 行适用面处置 | 只对 source-proven command/owner 面声明完成；未测或已重划 read operation 阻断其优化成功声明；BOM fixture 至少 10 行 |
| 四 | BP-U05 | M1 read 58、M2 read 58、task readers、B=78 request-scope 分解预算、各 owner adapter 落地 | 每个 B read 的闭集 budget component 真实不超 cap；禁止循环查询；不把 protocol read 偷入 B，也不从 command transaction 调 task reader |
| 四 | BP-U06 | retire 旧签名/dispatcher、`app/application` 旧布局与 evidence/report | 旧路径“代码库不存在”，不是“暂时无人调用” |

对 C4：先记录五分支 `loadItems`/`generation` 实测调用数和 request DB count；只删除能够证明写前无写入间隔、无 CAS/readback 语义的读取。写后 generation/readback、asset claim/release 与库存 whole-save owner command 只有逐分支证明后才能变化。

对 dictionary 引用检查：只在同一 owner invocation 内复用一次已验证的 set-based snapshot，保留 dictionary status/kind/scope、blocking reason 与 mutation 后 readback；不增加跨请求缓存。

对 BOM target：inventory owner 收集本次 rows 的 distinct target refs 后一次 bounded lookup，再逐行应用既有 scope/版本/typed failure；不能由 catalog 直查 inventory schema。

### BP-U01｜请求证据、数据库操作计量基线与门处置

冻结 `measurementSchemaVersion`、`measurementBasis`、request-scope budget 口径、request join、JDBC kind 与 logical section 的双维口径。没有非零、可关联、可复现的 operation evidence 时，任何基线状态只能是 `UNMEASURED_BLOCKS_OPTIMIZATION`，不能用 seed 平均值填充。

受控 workload 完成后，BP-U01 必须在同一受管 run 内**原子地产出内容寻址 evidence snapshot**，路径为 `<run-evidence>/snapshots/<sha256>/`；其中只读副本/切片包括 DB operations、statement dictionary、关联 request events、seed report 与 run manifest。snapshot manifest 必须列出每个输入的原路径、sha256、byteSize、runId/requestId 范围、measurement schema/basis、dictionary digest 及 operation/request/event 分母。`backend-performance-budget` 和 SQL 覆盖门只接受这个 snapshot，明确拒绝 live `.runtime/r5/evidence/db-operations.jsonl`；本设计阶段的 live 数据仅是 discovery baseline，绝不自动改变覆盖状态。

44 门 disposition 必须逐门记录当前 PASS/FAIL、实际 `run()` 接线、standards enforcement 映射和是否进入 `scripts/verify`。本包的强制决定如下：

| 当前门 | 当前事实 | BP-U01 disposition | 完成判据 |
|---|---|---|---|
| `database-operation-budget` | 关键词扫描、未进 verify、且测试中的 `SELECT *` 使其当前 FAIL | **退役为 B.6/B.3 的 enforcement**；其两个词面 hygiene 规则迁入独立 `database-query-hygiene`，不得再冒充 count budget | 新 `backend-performance-budget` 从 request evidence 读取 `databaseOperationCount`、B=78 与 command fixture 基线；`B.6.N01/N03/N06`、`B.3.N07/N08` 映射迁入它；新门进入 `scripts/verify`；旧门无上述映射 |
| `code-layout` | 当前 FAIL、未进 verify，原因为既存 app/application 与 results 根目录 | **在 BP-U06 退出**，不把它伪称为当前已绿 | BP-U06 删除旧布局、补对应 red fixture 后进入 verify；此前性能包报告不声称全仓门绿 |

新 budget 门的红夹具必须读取真实 request-local measurement：给 B operation 插入一个无用 SQL、把 command fixture 增加一条 SQL、或把 B operation 的计量从 request-scope 缩为 handler-scope，任一均红。它不是 `grep` 的替代名。

### BP-U02｜196 路由的 owner-local 静态 binding

binding 输入将 196 条 operation 逐行固定 owner、wire、transaction mode 与 context kind。113 command 的 context 分母固定为 `operations-admin=75`、`platform-admin=29`、`public=9`；platform/public 的 context parity 是 handler 迁移证据，不自动成为性能数值基线。

### BP-U03｜workspace command context 与 catalog judgment scope

仅 `WORKSPACE_EXECUTION_CONTEXT` 命令创建 workspace grant 和 catalog scope。platform/public/workspace-protocol command 各由自己的 factory 解析 owner protocol facts，任何 factory 都不共享可跨 kind 使用的 grant。catalog write/copy 的 scope、对象重核与 receipt 顺序按第 5.3 节执行。

### BP-U04｜C4/C6 分支语义与命令基线精确分母

`contracts/registry/performance-refactor-command-baselines.json` 是唯一基线输入。它在任何优化前由已冻结 registry bytes 展开、但不得在测量结果出现后挑选成员：

| impact map | command exact set | branch / fixture identity | 测量状态与比较 |
|---|---|---|---|
| C1 context transaction path | 两 registry 中 `consumerFaces=["operations-admin"]` 且 method 非 `GET` 的 **75** operation，排除 `saveOperationsCatalogItem` 的普通分支（由下一行覆盖） | 每 operation 一条 `NORMAL_SUCCESS`，fixture ID 固定为 `PERF-WORKSPACE-COMMAND-V1:<operationId>:NORMAL_SUCCESS` | 初始均 `UNMEASURED_BLOCKS_OPTIMIZATION`；BP-U01 先记录同 schema/basis 的 current count，再比较“不得回归” |
| C4 catalog save | 仅 `saveOperationsCatalogItem` | `PERF-CATALOG-SAVE-V1` 的 `NORMAL_SAVE`、`IDEMPOTENT_REPLAY`、`ASSET_ADD`、`ASSET_REMOVE_UNREFERENCED`、`ASSET_REMOVE_STILL_REFERENCED` 五分支 | 每分支各有一次 current observation；不设上限，只允许不回归及逐读取语义论证 |
| C5 visibility deduplication | `selectOperationsWorkspaceSessionContext`、`selectOperationsWorkspaceSessionDataNode` 两个 command 已在 74 条 workspace normal rows；`getOperationsWorkspaceSessionEntry` 另在 B=78 | 不新增 numeric row，不得重复计入 79 | 同一 `WorkspaceAuthenticationService` invocation 构造一次可见范围 snapshot，供选择校验与 command readback 复用；读侧必须符合 B.6.6 的一次上下文解析 |
| C6 dictionary reference deduplication | task read **及** `reorderOperationsCatalogDictionaryEntry` command readback；后者已经位于 74 条 workspace normal rows | 不新增 numeric row，不得重复计入 79 | `PERF-WORKSPACE-COMMAND-V1:reorderOperationsCatalogDictionaryEntry:NORMAL_SUCCESS` + `dictionaryReferenced` loop red fixture |
| platform/public context binding | 29 platform + 9 public command | 每条 `CONTEXT_PARITY` focused fixture，ID 固定 `PERF-CONTEXT-PARITY-V1:<operationId>` | 不是 SQL 优化候选；只验证 protocol 与 typed failure parity，禁止填 numeric baseline |

baseline generator 对 75 条展开生成显式 operation rows、每行只准一个 fixture/branch；save 的五分支替代它的普通行。因此数值 baseline 的 exact set 是 **74 条 workspace normal + 5 条 save branch = 79**，并且任何数值都必须附 `measurementSchemaVersion`、`measurementBasis`、run manifest digest、fixture digest、observation timestamp。其余 **38** 条 command（29 platform + 9 public）是 binding-only `CONTEXT_PARITY` set，填入任何 `MeasuredBaseline` 即红。遗漏、重复、同一 command 同时出现在 normal/save，或 C5/C6 新增第 80 条数值行均为红。

BP-U04 只冻结 C4/C6 的语义边界、C5 command/read消费者和正常前后计量；**不**将 SQL-M1～M6 的“达到目标读取次数”提前伪装为基线通过，实际合并在 BP-U07 单一执行。

### BP-U07｜SQL-M1～M6 合并、目标与 196 行覆盖矩阵

本单元是 SQL 合并的唯一承载者，输入是方案第 14.2～14.6 节、`doc/review/platform/2026-08-09-v2s-backend-performance-refactor-operation-coverage-initial.md` 的 196 行矩阵以及 BP-U01 同一 measurement schema。它**不是**“196 接口各自手写一条 SQL”：每个合并项必须先定义一个 owner-local、typed、不可变的有限事实/批量 judgment 抽象，由多条适用 operation 复用；operation binding 只静态声明采用的抽象和 typed request，不拥有 SQL。也不得把它们上提为跨 owner 的查询总线、service locator 或万能 `RequestFacts`。它在每项 owner 内完成下列精确目标，任何未达到目标的项只能登记 `SQL_MERGE_REJECTED`（附正确性成本与失配差额），不能以总耗时掩盖：

抽象不是把不同业务对象硬塞进一条“大 SQL”，也不是以每个 endpoint 一份 SQL 逃避抽象。唯一合法的层级为：**owner 内的有限事实 loader / 批量 judgment → 具名 operation adapter → edge binding**。loader 的输入、输出和生命周期必须是领域型且闭集；它只回答同一 owner 的重复事实，例如“本次命令的授权事实”“本次可见范围”“本次保存前后允许复用的商品协调事实”“一组 BOM target 是否存在”。operation adapter 可以组合自己已声明的 loader 和该 operation 的主资源查询，但不得按 `operationId` 选择 SQL、不得获得任意表/任意字段查询能力，也不得以通用 `Map`、`Object` 或 `RequestFacts` 承载事实。不同主资源、不同写入间隔、不同 revision/CAS 或不同 owner 时必须分为不同 typed loader；不能为了降低 statement 数把这些边界合并。

每个 SQL-M 的 implementation manifest 必须逐项列出 `(owner, factLoaderOrJudgment, applicableOperationIds, typedInput, typedOutput, same-invocation validity condition, preserved checks)`。生成器只将这个有限表编译为各 operation adapter 的显式构造器依赖；运行期没有注册表、字符串匹配、反射或 service lookup。这样可以复用真正重复的事实读取，同时保证 196 条 operation 仍保留各自的业务主查询和 owner 主权。

| SQL-M | 唯一允许的复用抽象 | 可复用边界 | 明确禁止 |
|---|---|---|---|
| M1 | `WorkspaceCommandAuthorizationFacts`（command）与 `WorkspaceReadAuthorizationFacts`（read） | 前者仅 workspace-iam command resolver 的同一事务；后者仅 ReadContextKind 的同一 request；各自 session/assignment/ENABLED role/permission projection 一次装载 | 跨请求缓存、裸 capability grant、把 command facts 借给 read |
| M2 | `VisibleOrganizationFacts` | organization owner、单一 `WorkspaceAuthenticationService` invocation 或 `OPERATIONS_SCOPED` read context；候选、node/store/head-company 和派生 scope context | 静态全局 cache、跨 schema join、替代对象重核 |
| M3 | `CatalogCoordinationSnapshot` 与 `DictionaryReferenceSnapshot` | catalog owner、一次保存或 readback invocation；明确区分写前事实与写后 readback | 将写后 readback 与 CAS 合并为同一个陈旧 snapshot |
| M4 | `WorkspaceStatusLookup.isEnabled` post-auth guard retirement | 5 个 post-auth call-site group（6 个直接表达式）必须删除；5 个 pre-auth expression 必须保留；平台 task-read 的 `EnabledSelectedWorkspaceFact` 是既有独立 read 事实，不属于本退役 | 删除预认证保护、删除平台既有 selected-workspace typed failure、跨请求 cache |
| M5 | 每个受影响 owner 的具名 `*Facts`（由行级 applicability map 命名） | 同 owner、同 key、无写入间隔 | 名为“common cache”的跨 owner 泛型容器 |
| M6 | `ResolvedBomTargets` 批量 judgment | inventory owner、单一 BOM command，输入为 distinct target refs、输出保留原行序诊断 | catalog 直查 inventory、逐行回退 lookup |

| 合并项 | owner-local 目标 | 必须保留 | focused red/green 与覆盖 |
|---|---|---|---|
| SQL-M1 | `CommandExecutionContextResolver`（BP-U07 command 68）与 `WorkspaceReadAuthorizationFacts`（BP-U05 task read 58）分别以各自一条 statement 装载 session、active assignment、ENABLED role、page/capability | 强 assignment 谓词、`r.status='ENABLED'`、密码优先级、既有 role mapper、`requireActiveScope` 的其他消费者、命令时 capability 重核 | 改回两条 statement、复制 loader、删除 ENABLED 条件授权均必红；有效并集恰为 126，pre-login protocol GET 不得进入 |
| SQL-M2 | `OrganizationVisibilityService` 的 C5 command invocation（BP-U07，2）与 `OPERATIONS_SCOPED` read context（BP-U05，58）各自一次加载已验证 node/store/head-company 与派生 scope context | 原候选顺序、status/workspace/group 谓词、typed failures、无跨 schema join、`requireCatalogBrand` judgment 语义 | 改回两个组织读取必红；C5 两 command 与 58 task reads 是唯一 source-proven 面，其他 command 不得按 face 推定 |
| SQL-M3 | catalog owner 内把同一无写入间隔的 item/dictionary relation reads 合并；写后 readback、CAS 前置保留 | C4 五分支、dictionary status/kind/scope/blocking reason | 对每分支 read role 对账；dictionary loop red；catalog 25 条适用面 |
| SQL-M4 | 已认证 operations session 后的 `WorkspaceStatusLookup.isEnabled` guard 退役；预认证/凭证流五处保留 | 自然过期窗口、登录前阻断、平台 task-read 的独立 enabled selected-workspace 语义 | 把所有 `group_workspace` 读取视为 M4、删除预认证 guard、借此删除平台 read 403 |
| SQL-M5 | 六个长尾表的“同 owner、同 key、第二读传已读事实” | 有写入间隔、不同 key、typed failure/readback | 每张表至少一正/反例并在 versioned row-level map 给出 owner/operation；逐表拒绝才可 `SQL_MERGE_REJECTED` |
| SQL-M6 | inventory owner 对 BOM distinct target refs 一次 bounded lookup，与 BOM 行数无关 | 原行序第一个 failure、scope/版本/CAS、同一 REQUIRED、catalog 不直查 inventory | BOM 行数 **≥10** 的具名 fixture；恢复逐行 lookup 必红；inventory 11 条适用面 |

`MEASURED_SEED`、`MEASURED_HISTORICAL`、`MEASURED_NEW_FIXTURE`、`UNMEASURED_BLOCKS_OPTIMIZATION` 是唯一四种矩阵值。初版中 `MEASURED_NEW_FIXTURE=0`；任何 unit 只在新增受控 fixture成功后将其 source-proven operation 转换为该值。SQL-M1 command 68、SQL-M2 C5 command 2 由 BP-U07 负责；SQL-M1/M2 的 58 task reads 由 BP-U05 负责。每个 SQL-M1/M2/M5/M6 成功声明都要求其**本决定定义的 source-proven适用面**全部不为 `UNMEASURED_BLOCKS_OPTIMIZATION`；SQL-M3 及 SQL-M6 同理按其 owner 适用面。SQL-M4 是 source-absence/retained-preauth control，不从 196 operation coverage 列得出成功，必须以五组退役、五处保留和行为 fixture 三组非空证据验收。覆盖值只可从 BP-U01 content-addressed snapshot 导入；故仅在 seed 运行过的接口证明成功，必然失败。

#### BP-U07 事实实现清单与抽象防线

`backend-performance-sql-merge-applicability.json` 除 operation 行外必须有 `factImplementations[]`：`factLoaderId`、`mode`、`sourcePath#method`、`statementTemplateHash`、`securityPredicateId`、`applicableOperationIds`、typed input/output、same-invocation validity 与 preserved checks。M1 只有 `COMMAND`、`READ` 两项；M2 必须拆为 `C5_COMMAND` 与 `TASK_READ` 两项；平台 read 的 `EnabledSelectedWorkspaceFact` 一项；每张 M5 表一项或逐表 `SQL_MERGE_REJECTED`。M1 两 mode 的 operation 集合并集必须恰为 126；M2 两 mode 的 operation 集合并集必须恰为 60（2 C5 command + 58 task reads）。SQL-M4 不得伪装为 fact implementation，必须以独立 `sourceRetirements[]` 声明 `retiredPostAuthCallSiteGroups`（5 group/6 direct expressions）与 `retainedPreAuthExpressions`（5 direct expressions）；生产源码 scan 分别必须为零和 exact-set 相等。任何仍需保留的历史读只可出现在逐项 `legacyAllowedImplementations[]`，每项必须有 `owner`、`sourcePath#method`、`reason`、`usedByOperationIds` 与 `disposition=RETAINED_WITH_REASON|REMOVE_IN_BP_U06`；实际 legacy-loader/reference scan 与此表必须 exact-set 相等，后者须有 BP-U06 的 source-absence 退出证明。126 个 M1 adapter 不得直接 JDBC，也不得引用 legacy loader。

静态 SQL 总数 `<=465` 只是一道粗粒度不回归护栏，不能单独证明抽象正确；关键表 SELECT 与 `ENABLED` 谓词均按 `factLoaderId + statementTemplateHash + allowlist` 校验，不能按整张表全局误伤 `requireActiveScope` 等合法 typed failure 路径。必须同时有：复制 SQL 到 adapter、拆成一对一 loader、动态拼接模板、删改 `ENABLED` 谓词、删无关 SQL 试图抵消总数的红夹具。

#### SQL-M4｜工作区状态门退役与保留 exact set

Dexter 已裁定：工作区商业性停用后，已有 **operations** workspace session 自然过期；`WorkspaceAuthenticationService.require` 保持不含 `gw.status='ENABLED'` 的现状。本批退役的不是所有 `platform_workspace.group_workspace` 读取，更不是所有平台管理状态门，而是五个 post-auth `WorkspaceStatusLookup.isEnabled` call-site group：`OrganizationHierarchyService#requireWorkspace`、`BusinessEntityService#requireActiveWorkspace`、`OrganizationCommandService#{isEnterableCommercialGroup,requireEnabledWorkspace}`、`WorkspaceAccountService#requireEnabledWorkspace`、`WorkspaceRoleService#requireWorkspace`。它们对应六个 Java 直接表达式，完成条件是 production source scan 为零。

必须保留五个 pre-auth/credential direct expression：`WorkspaceAuthenticationService#{authenticatePassword,accountByMobile}`、`WorkspacePasswordRecoveryService#{start,enabledAccount}`、`WorkspacePasswordResetService#reset`；其 generated operation coverage 是 `operationsWorkspacePasswordLogin`、`sendOperationsWorkspaceOtp`、`verifyOperationsWorkspaceOtp`、`startOperationsPasswordRecovery`、`verifyOperationsPasswordRecoveryOtp`、`completeOperationsPasswordRecovery`、`requestWorkspaceCredentialReset`。完成条件是该五表达式的 source exact-set 保持不变，且停用工作区后无法建立新的 operations session。

`WorkspaceAdministrationService#requireEnabled` 的平台 selected-workspace task-read 调用不属于 SQL-M4 退役：它产生 `{workspaceUuid,key,status=ENABLED}` 并保留既有 `403 PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED`。固定 B read 为 `getExtensionEntityCatalog`、`getExtensionDefinition`、`getPlatformContractOverviewPage`、`getPlatformContractOverviewDetail`、`getPlatformOrganizationOverviewPage`、`getPlatformOrganizationCandidates`、`getPlatformOrganizationHierarchyTree`、`getPlatformOrganizationOverviewDetail`、`getWorkspaceAccounts`、`getWorkspaceAccount`、`getWorkspaceInvitations`、`getWorkspaceInvitationCandidates`、`getWorkspaceInvitation`、`getWorkspaceRoles`、`getWorkspaceRole`；`getPlatformEntityAuditHistory` 只在 workspace-scoped entity-type branch 使用该事实。`getPlatformGroupWorkspaceDetail` 可查看 DISABLED workspace，`listPlatformGroupWorkspaces` 没有 selected workspace，均为反例。任何 CAS/readback/详情投影的 group-workspace 读取也不得标为 M4。

M4 的收益只以 BP-U01 同 schema/source-hash 的前后受控证据报告；不得将历史 callsite aggregate 中平台 `requireEnabled`、session display join 或 invitation completion 的读取误称为“全部消失”。

#### SQL-M5 六表逐行处置（非空分母）

| 表 / owner | 事实实现与精确 operation | typed 输入/输出 | 保留语义与正反 fixture |
|---|---|---|---|
| `organization.commercial_group` / organization | `CommercialGroupPreState`；`updateOperationsCommercialGroup` | `(workspaceUuid,groupWorkspaceKey,code,expectedVersion,ownerGrant)` -> `{current,revision,auditFields}` | 合并 grant 后与 update 前同 key 两读；receipt 前 grant target、CAS/audit 与 post-write readback 保留。正：2→1 且正确 version；反：grant 不符、CAS 冲突、replay 不写。 |
| `organization.project_phase_name` / organization | `SQL_MERGE_REJECTED`；`createOperationsOrganizationProject`、`updateOperationsOrganizationNode`、`transitionOperationsOrganizationNodeStatus`、`getOperationsOrganizationHierarchy`、`getOperationsContractCandidates`、`createOperationsContract`、`updateOperationsContract` | N/A | 读取被 phase 写入或状态写入隔开，或为单读；旧快照不能替代合法性/readback。反：phase 变动、非法 phase、status 后 readback。 |
| `extension.extension_definition` / extension | `ExtensionDefinitionPreState`；`replaceExtensionDefinition` | `(workspaceUuid,key,hostType,expectedVersion,fields)` -> `{revision,fields}` | 合并 revision/audit/type 三次前读；保留缺失冲突、字段类型拒绝、post-write readback。正：3→1；反：absent expectedVersion、非法类型、replay 不写。 |
| `catalog.catalog_category` / catalog | `SQL_MERGE_REJECTED`；create/update/move/delete category 四条 | N/A | `FOR UPDATE` lock、层级/引用验证、写后 projection 是不同语义或有写间隔；不得以旧快照替换。反：CAS/循环/深度/引用阻断仍正确。 |
| `workspace_iam.invitation_assignment_intent` / workspace-iam | `InvitationAssignmentIntentFacts`；`getWorkspaceInvitations`、`getWorkspaceInvitation`、五类 `getOperationsWorkspace*Invitations` 及 create/cancel/reissue 对应 managementView readback | `invitationIds[]` -> `{intentsByInvitation,roleNamesByInvitation}` | 同 invitation 集合的 intent 与 role-name 两读改为一条 typed join projection；保留排序/targetPath/state。正：多邀请多角色；反：跨 target/no intent 的 typed failure、cancel/reissue replay 不写。 |
| `contract.store_contract` / contract | `DerivedStoreStatusFacts`；`getOperationsOrganizationStore`、create/update/transition store、`getOperationsStoreProfile` | `(workspaceUuid,key,storeId,today)` -> `{derivedStatus}` | 复用已存在 CASE/FILTER 单 query，取代两个同参 scalar count；保留当前/未来/无合约三态。正：2→1；反：临界日期及 `effective_to=null`。contract CRUD 与 stores list 分别 read/write-readback 或已 batch，逐项 `SQL_MERGE_REJECTED`。 |

这六行是 `backend-performance-sql-merge-applicability.json` 的 versioned M5 source；不得保留 `PENDING`、空 operation 集或全 owner 泛化。每条 `SQL_MERGE_REJECTED` 仍要求 reason、correctness cost 和负向夹具，不能被总收益抵消。

### BP-U05｜任务型 reader、M1/M2 read facts 与 read budget

BP-U05 不再等待 BP-U07 的 196 行全量实测；它承接本决定重划的 M1 read 58 与 M2 read 58，并逐条处置 83 GET：78 条 task read 都必须得到 `OperationBudget(ReadContextKind, requiredFactSet, primaryQueryCap, optionalCountCap, declaredExtrasCap=0)`；五个 protocol/content read 没有 budget、不得装载 workspace session facts，但不能停止 completion/DB count evidence。`task-read-surface-policy.json` 是 design-time 语义真相：先完整列出 83 行，再由 generator 校验；每个 TASK_READ 行冻结最小 context kind、source-bound `requiredFactSet`、`primaryQueryCap`、`optionalCountCap`、`declaredExtrasCap=0`、owner task-reader/controller anchor 与具名 NORMAL fixture，五个 protocol/content 行冻结闭集 reason。`PLATFORM_WORKSPACE` 的 `EnabledSelectedWorkspaceFact` 仅允许上述 15 条；`getPlatformEntityAuditHistory` 必须在 policy 中按 entity-type branch 声明 `GROUP_WORKSPACE|WORKSPACE_ROLE|WORKSPACE_ACCOUNT|WORKSPACE_INVITATION|EXTENSION_DEFINITION|STORE_CONTRACT` 使用该事实，`PLATFORM_ADMIN` 不得加载，任何扩大或删去既有 branch gate 都必须红。tracker 新增封闭 request-local `ReadBudgetComponent={CONTEXT_WORKSPACE_IAM,CONTEXT_ORGANIZATION,CONTEXT_PLATFORM_IAM,CONTEXT_PLATFORM_WORKSPACE,PRIMARY_QUERY,OPTIONAL_COUNT,UNCLASSIFIED}`；最终 request snapshot 必须与 components 精确相加，任一 component 越 cap 或 `UNCLASSIFIED>0` 均失败。读侧的 `WorkspaceReadAuthorizationFacts` 必须由新的 request-local factory 以 fresh active session、assignment、ENABLED role query 创建，**不得委托或复用 `WorkspaceSessionRequestCache`**；该既有 cache 只保留给原 session projection。读侧先构造一次 ReadContextKind 的 owner facts，授权只读取内存投影，祖先/范围使用 `EXISTS` 融入主语句；不允许 owner handler 再解析 session 或散发逐项范围查询。读侧跨 schema join 只能进入本 owner task reader，且不得被 BP-U03/BP-U04 command 调用。C5 两个 POST command 保留在 BP-U07 的 `WorkspaceAuthenticationService#selectContext/#selectDataNode` command invocation：mutation 后的 `sessionEntry` 与可见范围 readback 只能复用该 invocation 的 command-local facts，edge 只传 typed command input，且任何 `C5 -> TaskReadService` 或 cache-backed read-fact delegation 都必须红。C6 的 `DictionaryReferenceSnapshot` 是 catalog owner-local 的 bounded fact snapshot：task reader 与 command readback 各自在自己的合法边界构造它，command 只能传/复用本 command invocation 的 snapshot，不可调用 `TaskReadService`，也不可跨请求缓存。

五条 platform workspace-IAM 的跨 owner 反例以 `doc/decisions/2026-08-09-v2s-backend-performance-phase4-read-budget-rebaseline.md` 为本段的后续裁定：policy 必须逐行冻结 workspace-iam 与 organization 两个具名 projection boundary、用户任务原因与 `primaryQueryCap=2`。每个 boundary 的 `logicalStatementCap=1`，不得把 owner batch 内多语句伪装为一个 stage；candidate 的 `ORGANIZATION`/`ROLE` organization boundary 是互斥闭集、每支各 cap=1，不能求和为第三条。现已由 source gate 验证 typed reader 落点和 edge 不绕过，故是 `SOURCE_IMPLEMENTED_UNMEASURED`；在受管 snapshot 导入前仍是 `UNMEASURED_BLOCKS_OPTIMIZATION`，不得把 rebaseline 当作性能成功声明。

#### BP-U05 剩余 owner-projection delivery（implementation-facing）

本 delivery 的用户任务是保留 13 个既有 GET readback 的全部字段与 typed failure，同时把每个 endpoint 的 owner 查询链收敛到 policy 声明的 named typed reader；不是把多段 owner 读取藏进 edge lambda，也不是为了将数值压成更小的预算。更小替代是只把既有 reader 登记进 policy，或在 edge 对旧 service 加 `PRIMARY_QUERY` wrapper；前者遗漏 5 条真正需要新 projection 的 HTTP readback，后者会把 connection、authorization 或多 owner 读伪报为单条。因此本 delivery 采用下列有限分批，所有 reader 只接收 typed input、不得接收 operationId/表名/字段名，保留 BP-U06 的 legacy dispatcher。

| unit | operation exact set | typed boundary / owner chain | 必须保留的反例与 focused proof |
| --- | --- | --- | --- |
| R1 existing-boundary admission | `getOperationsContracts`、`getOperationsContract`、`getOperationsContractCandidates`、`getOperationsContractExtensionDefinition`、`getPlatformContractOverviewPage`、`getPlatformOrganizationOverviewPage`、`getPlatformOrganizationCandidates`、`getPlatformOrganizationHierarchyTree` | `ContractTaskReadService#operationsTaskPage/#operationsTaskView/#operationsTaskCandidates/#platformOverviewTaskPage`、`ExtensionDefinitionService#operationsManagementDefinition`、`OrganizationOverviewTaskReadService#platformOverviewTaskPage/#platformHierarchyTree`、`StoreCandidateTaskReadService#platformContractCandidatePage` | policy 必须逐行绑定真实 edge call 与 source path；contract command 不能调用 task reader；page total 必须在同一 owner logical statement 内；仍为 `SOURCE_IMPLEMENTED_UNMEASURED`，直到受管 snapshot。 |
| R2 organization detail | `getPlatformOrganizationOverviewDetail` | `OrganizationOverviewTaskReadService#platformManagementBaseDetail` 加 `ExtensionDefinitionService#platformManagementDefinition`，两段各 `logicalStatementCap=1` | BUSINESS_ENTITY/HIERARCHY/STORE 三 host、未配置 definition 的 empty fields、target 缺失与 extension raw values 均不变；不得跨 schema join 或改为 strict definition。 |
| R3 operations audit | `getOperationsEntityAuditHistory` | `app/application/audit/OperationsAuditTaskReadService#read(OperationsAuditReadQuery)` 的 compile-time 九分支 coordinator | 九项只可为 `WORKSPACE_ACCOUNT`、`WORKSPACE_INVITATION`、`COMMERCIAL_GROUP`、`ORGANIZATION_NODE`、`BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE`、`STORE_CONTRACT`；每 branch 在自己的 owner 同时完成 target/type/host-scope/window-count/page；禁止 `requireHostAuthorization`、`detail/view` 或 `WorkspaceAuditAuthorizationService` 旧链。 |
| R4 platform audit | `getPlatformEntityAuditHistory` | `app/application/audit/PlatformAuditHistoryTaskReadService#read(PlatformAuditHistoryQuery)`；`GROUP_WORKSPACE` 为 platform-workspace + organization initialization 两段 | `PLATFORM_ADMIN` 仅 platform-iam、绝不加载 selected workspace；workspace-IAM 三 type、extension、contract 各走一个所属 owner projection；任何 branch 加第三段或去掉 typed selected-workspace failure 都必须红。 |
| R5 platform group workspace | `listPlatformGroupWorkspaces`、`getPlatformGroupWorkspaceDetail` | `PlatformWorkspaceAdministrationTaskReadService#page/#detail`；page=platform-workspace base page + organization initialization batch + asset batch 三段，detail 再加 workspace-iam account/role summary 为四段 | page 的商业组初始化路径、asset public reference、detail 的 account/role summary 均是既有 response 事实；每段 cap=1，整体只适用 policy 已冻结的 cap=3/4。 |

R3 的唯一 HTTP caller 是 `OperationsAuditHistoryController#history`：它只能构造 `OperationsAuditReadQuery` 并调用 `OperationsAuditTaskReadService#read`，不得保留 `requireHostAuthorization`、`OrganizationOverviewTaskReadService#detail`、`ContractTaskReadService#view` 或 `WorkspaceAuditAuthorizationService`。R4 的唯一 caller 是 `PlatformAuditHistoryController#history`：它只能把一次 `PlatformReadSessionFacts` 与 typed query 交给 `PlatformAuditHistoryTaskReadService#read`；`PLATFORM_ADMIN` 作为 reader 内单 owner branch，不能经 `scope` 或 `scopeForWorkspaceTarget` 读取 selected workspace，`GROUP_WORKSPACE` 必须保持两个具名 owner projection。R5 的唯一 callers 是 `PlatformWorkspaceAdministrationController#list/#detail`：二者只能调用 `PlatformWorkspaceAdministrationTaskReadService#page/#detail`，不得在 edge 直接组合 workspace、initialization、asset 或 workspace-iam summary。每一项必须有 production-source red mutation：恢复旧 audit lookup、给 PLATFORM_ADMIN 加 selected-workspace、漏 GROUP_WORKSPACE 任一段或恢复 controller 直接组合都必红。

R5 的 list 不得保留 `WorkspaceAdministrationService#list` 中 `EXISTS (SELECT ... organization.commercial_group)` 后再调用新的 organization port；那会把同一 initialization 事实读取两次。该 service 必须仅返回 `platform_workspace.group_workspace` 的 base page。初始化 port 必须由 **organization module** 公布为 `OrganizationGroupWorkspaceInitializationLookup`，并由 `OrganizationGroupWorkspaceInitializationTaskReadService` 实现；workspace reader 只依赖这个 API，绝不要求 organization 依赖 workspace 的 `GroupWorkspaceTaskQuery`，从而禁止 Gradle 环。API 的 list 输入只能是已分页的 group-workspace key 集合，返回仅 organization-owned 的 `InitializationState`；detail 返回 `Optional<CommercialGroupReadback>`，以保留既有 HTTP detail 的商业组 root（id/code/name/revision/timestamps/extension values），不得把 boolean presence 当作 detail 替代品。两种输出都不得含 workspace UUID/ID/name/status 等 platform-owned 字段。detail 同样是 platform base detail → organization fact → asset → `WorkspaceIamSummaryLookup#accountAndRoleSummary`；后者必须由 `WorkspaceIamSummaryReadService` 的一个 owner-local statement 产生 aggregate，不能把现有两个 count 移入 reader 内部。既有 `PlatformWorkspaceService#initializeCommercialGroup` command path 与 workspace-owned `GroupWorkspaceTaskQuery` 的 legacy projection 均不属于 BP-U05 task-read，明确 retain；GET controller 在接入新 reader 后不再消费它们。上述四类 owner assertion 仅在 future reader 翻为 `SOURCE_IMPLEMENTED_UNMEASURED` 时激活：list 方法体不得含 `organization.` 或 `EXISTS`；initialization implementation 不得触及 `platform_workspace`，且 organization API 输出不得含 platform-owned 字段；summary closure 必须恰一条 JDBC statement 且不得委托 `accountCount` / `roleCount`。每一项均须有真实红 mutation；当前 blocked source 保持允许旧链存在，不得伪报未来 reader 已落地。

控制面按上述次序串行接纳 reader：每个 unit 完成后，`task-read-surface-policy` 必须将其 operation 从 `NOT_YET_TASK_READER` 改为真实 `TASK_READER`，写入 exact primary boundary、edge source closure、red mutation 与 focused test。13 条全部接纳后分母才可以从 `65/13` 变为 `78/0`；但只要没有逐 operation immutable snapshot 同时证明 component sum、`UNCLASSIFIED=0` 与每段不超 cap，整体仍是 `BLOCKED_UNMEASURED`。本 delivery 不授权动态运行、SQL 数值成功、BP-U06 旧路径退出或任何 schema/DML 改动。

### BP-U06｜旧路径退出和证据闭环

逐 owner 删除动态 operation dispatch、controller authority derivation 与旧 grant/signature；任何上下文 kind、baseline row 或 task-read policy 未完成 exact-set 对账时，旧路径不能退役。

#### Final-closure implementation-facing design

Dexter 于 2026-08-10 授权完成后台性能优化的全部剩余项目并进行最终受管动态验收。执行必须分为独立的 design、static implementation 与 dynamic acceptance package；RM1-P6-3 与本工作共享受管 runner、tunnel、remote non-production 资源及 `.runtime`，因此暂停但不关闭，任何其运行/快照均不得充作本次性能证据。

BP-U06 的 source-absence 分母固定为三个 production source（`CatalogInventoryApplicationService`、`OperationsAuditTaskReadService`、`PlatformAuditHistoryTaskReadService`）、四个同布局 focused tests、两个 catalog dynamic-registry source 和两个对应 tests，以及 repository-root `results/catalog-inventory-l2-test-fixture.json`。`code-layout` 必须新增 `app/application` 的真实 red mutation。完成条件是当前 repository bytes 对旧布局、旧 `String operationId,ObjectNode` dispatch 及 root artifact 的 exact scan 为零，而不是“没有当前 caller”。

两个 audit coordinator 不得移入 `audit-model`（会形成 owner dependency cycle），也不得移到 edge 使 edge 获得跨 owner coordinator 主权。新建 `modules/audit-read`，仅承载已有闭集 9-target operations audit 与 7-target platform audit coordinator 以及 focused tests；它只依赖 owner public API，owner module 不反向依赖该模块。`PlatformReadSessionFacts` 保持 edge-private：platform audit controller 在一次 `requireRead` 后只将其公开、不可伪造的 `PlatformSessionReadback` 传入 audit-read；audit-read 自己以 workspace owner 的 `requireEnabled` 构造 selected-workspace fact 并计入 `CONTEXT_PLATFORM_WORKSPACE`。因此 module 不得 import `PlatformSessionResolver` 或任何 `app` type，避免 app→module→app cycle。controller 只更新 import/injection；现有 sealed typed query、owner projection、page validation、`PLATFORM_ADMIN` ungated 和 group-workspace two-owner behavior 不变。

Catalog/inventory 的 exact dynamic cutover set 是 42 条 generated catalog route：16 typed GET 与 26 workspace command。`2026-08-10-v2s-backend-performance-final-catalog-route-binding-map.json` 是逐 route 的 edge method、coordinator method 与 command-token single source; it must remain 42 unique operations with 16/26 partition. 每一条 route 必须直接调用 operation-specific typed coordinator method；26 command 可使用 generated closed token constants，但不再经 URI、`String operationId` 或 generic dispatch 选择。Coordinator 迁入 catalog owner side；196 binding 的 owner/route、scope recheck、idempotency/CAS/replay、asset lifecycle、required transaction 及 wire response 均保持。不得保留 compatibility shim。

最终测量不得只运行当前命令：BP-U07 的 generator 现行强制所有 rows 为 `UNMEASURED_BLOCKS_OPTIMIZATION`，所以在动态前必须实现不可变 snapshot admission。只有一个 final-run content-addressed snapshot 内的 request event、database operation、statement dictionary、seed report 与 run-manifest digest 可将精确 operation/fixture row 改为 `MEASURED_NEW_FIXTURE`。run manifest must declare `kind=backend-performance-final-acceptance`, the final implementation manifest digest, the workload policy digest and a unique run id; snapshot admission rejects every historical `.runtime/r5` or other runner kind even if its JSON shape is otherwise valid. Any absent/cross-run tuple、incomplete request/database join、`UNCLASSIFIED>0`、component sum mismatch、cap overflow、route/fixture drift 或无快照的 status 均 fail closed。

最终 workload 的 exact coverage 是 BP-U05 的 78 TASK_READ normal fixtures 与五个 protocol/content completion rows；BP-U04 的 79 numeric command observations（74 normal + 5 catalog-save branch）与 38 non-numeric context parity command；以及 BP-U07 的 196 route completion records、M1=126、M2=60、M3=25、M4 source/behavior exact set、M5 six-row applicability 与 M6=11。M4 不是 route count success。任何 partial result 都继续 `BLOCKED_UNMEASURED`。

受管 workload 复用现有 lifecycle primitives，但建立独立 `backend-performance` runner/workload。它仅启动本地 application process 和受管 tunnel、创建 remote isolated namespace/object prefix、进行最小 fixture preparation、记录脱敏结构化 evidence 并产出 immutable snapshot，再只清理 manifest-owned 本地/远端资源。无 browser、L2、UAT、deployment 或 reset。受影响 Testcontainers focused proof 先于 HTTP workload；business 与 cleanup 必须分别 PASS。动态 package 只在 static U06 cutover、snapshot admission controls 以及 fresh static implementation review 均通过后激活，之后仍需 fresh post-evidence implementation review 与 Claude final review。

Final workload 的 request event 只能在 server 运行边界生成，禁止 JSONL 后处理或通用请求伪造。`HttpRequestMetricsInterceptor` 仅在 `backend-performance-final-acceptance` mode 且 `v2s-backend-performance-` run namespace 内读取两个非敏感 fixture headers，并记录经 policy 校验的 `performanceFixtureId` 与 `performanceArea`；其余 mode、namespace 与既有 diagnostic event 格式不得改变。遗漏该窄入口会使 workload 无法把同 run request/database tuple 归属到 frozen fixture，属于本 final-closure 的必要 instrumentation surface，不扩大 HTTP 业务 contract。

## 8. 强制门与红夹具

| 控制 | 有限分母 | 真 red mutation |
|---|---|---|
| binding exact-set | 两 registry 的 196 并集 | 删/重/换 owner 一行 binding |
| read BUDGET | B=78 | 删除静态 ReadContextKind；给 command 加 budget；漏 protocol reason；把 operation 升为严格超集 kind 却没有对应 `requiredFactSet` source/行为依据 |
| command baseline | 具名 C1–C6 command rows | 在正常 fixture 加一条无用 SQL |
| request-scope measurement | B=78 | 将 budget 限缩为 owner handler scope；将 primary/count 伪装为 context component |
| SQL merge target | SQL-M1～M6 的适用 operation 与 SQL-M4 source-retirement set | 恢复两条可合并 statement；复制 loader/拆一对一 loader/动态拼接；SQL-M1 移除 ENABLED predicate；SQL-M4 恢复任一 post-auth guard、删除任一 pre-auth guard或把 platform `requireEnabled` 误列为 M4；SQL-M6 改为逐行 target lookup |
| no fabricated numbers | 未触及 113 command 减去 C1–C6 rows | 加一个任何数值字段 |
| owner no IAM | 所有 `CommandOperation` owner paths | 从 owner import/query IAM 表 |
| no write cross-schema join | command transaction paths | 添加跨 schema join/query |
| opaque grant/scope | resolver、catalog handler、copy handler | 外部构造 grant，或用 header/body/path 覆盖 brand/source |
| replay ordering | write + copy receipt branches | 让 receipt lookup 先于对象事实重核 |
| no dynamic dispatcher | 所有 binding output/old dispatch points | 加 `Map<String, Handler>` 或 service locator |
| read N+1 | B=78 + C4/C6/BOM rows | 在 loop 内调用 repository/task reader |

门只接受 production path 驱动的 red fixture；词面 grep 只能作为补充定位，不能证明语义。所有 measurement 输出携带 schema/basis，历史 36/44 与新计量口径不直接比较。

## 9. 行为变更登记表

| 变化 | 条件 | 类型 | consumer 同步 |
|---|---|---|---|
| command 授权失败更早返回 | role/assignment/brand/copy-source 已变 | 正确性修正；保持 typed 403/401 contract | API/fixture negative cases 更新；UI 不新增流程 |
| replay 不再绕过对象重核 | idempotency key 重放且对象/授权失效 | 正确性修正；RF-13 | API focused proof；不改变正常成功文案 |
| 缺失显式 binding 失败 | registry/binding 漂移 | 工程 fail-closed | 不公开为 HTTP 行为 |
| C2 assignment 缺失 | 合并 session/assignment 查询抛出 empty result | 正确性修正；将原 500 映射为既有 typed 401 | API/fixture negative cases 更新；UI 不新增流程 |
| B read budget component 超 cap 或未归类 | B operation workload | 治理失败；无永久豁免 | 不以 UI 降级掩盖 |
| SQL-M4 自然过期放宽 | 工作区商业性停用后，已有 operations workspace session | 会话剩余至多 8 小时内可读**且可写**；停用后不能创建新 operations session，窗口因自然过期单调收敛；平台 selected-workspace 既有 403 不变 | 商业停用（停止合作、欠费、租户退出）适用；安全事件紧急停用应在 `transitionStatusNew` 按 workspace 撤销 session，**不得**回加每 command `isEnabled` |

未登记的 HTTP 状态、Problem code、readback 字段、consumer 文案或操作顺序变化均是缺陷，须回到本表和对应 operation contract。

## 10. 退出、回滚与证据

| 退役对象 | 退出条件 | 失败后果 | 回滚点 |
|---|---|---|---|
| `operationId + ObjectNode` owner dispatch/case | 196 binding exact-set 通过、旧签名零命中 | 绕过 typed context | BP-U02 前保留原 adapter；完成后只可整体回滚该 unit |
| controller 外 brand/scope/grant 解析 | command resolver 与 catalog scope 全链路通过 | judgment 丢失或客户端覆盖 | BP-U03 |
| public `OperationsOwnerScopeGrant` 构造形态 | opaque factory-only grant、全 owner `verifyFor` 通过 | 可伪造/放宽授权 | BP-U03 |
| catalog global dispatch/混合 task reads、`app/application` 旧布局 | owner-local adapters/task readers 都已接线且旧布局零命中 | 新的全局耦合中心或 layout gate 继续为红 | BP-U05/BP-U06 |
| C1–C6 / SQL-M1～M6 旧重复读 | 每个具名 fixture 前后对账、矩阵行全处置且反例绿 | 删除必要 readback/CAS 或未测即宣称优化 | BP-U07 单独回滚 |

每批完成证据必须分开记录静态、focused business 与动态 cleanup；本设计阶段没有 business/cleanup PASS 声明。动态 workload 只在实施获授权后运行，读取 run-scoped manifest、first failure 和 cleanup。

## 11. 问题族防再犯

| failure pattern | 有限适用面 | 最小可复用解 | 反例边界 | 主要防线 |
|---|---|---|---|---|
| 把 route registry 当 handler 真相 | 196 HTTP operation | 显式 owner-local binding input + generated exact-set | HTTP route mapping本身不是业务绑定 | binding gate + review checklist |
| 在 edge/owner间丢失 server judgment | 所有 command scope/brand/copy paths | transaction-local immutable context | ordinary read context 不承载 write grant | context RF-13~15 |
| 以 DB count 删除正确性成本 | SQL-M1～M6 与 B=78 | fixture/branch pre/post + owner fact recheck + 196行覆盖矩阵 | 已批量的单对象 detail 不是 N+1 | performance redlines + focused proof |
| 只用 seed 样本宣布全接口优化 | 196 route | 四值 196行矩阵，未测阻断对应成功声明 | 历史 aggregate 不可替代 callSite 级 evidence | BP-U07 coverage gate + review checklist |
| 把跨 schema read 带回写事务 | command/read mixed coordinators | owner-local task reader、typed judgment | 事务外任务 read | cross-schema write gate |

本表的 prevention destination 是 `project-memory/decisions/http-crud-efficiency-design-redlines.md` 的既有效率红线、上表对应机械 gate，以及 implementation review checklist；实施 package exit 必须对问题 intake 与 prevention disposition 做 exact-set 对账。

## 12. Claude review 需要核验的结论

本详设只申请 architecture/design GO。它不申请 implementation、runtime、seed/reset、L2/UAT 或仓库控制。Claude 应优先证伪：C5 两个 POST command 是否已进入既有 79 行而未新增数值行；B=78 是否完整采用 B.6.6 的机制且 request-scope 已冻结；`database-operation-budget` 的退役/替换与 verify 链是否诚实；`OwnerScopeKind<S>` 是否消除内部 unchecked scope cast；SQL-M1～M6 是否都有目标、正确性保留与红夹具；以及 196 行矩阵是否对 registry、历史和 seed 证据自洽。

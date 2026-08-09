# BP-U05 rebaseline design + BP-U07 partial closure —— Claude 定向 recheck

`VERDICT=GO`　`M=0`　`S=0`　`N=1`

**这个 GO 只代表 BP-U05 rebaseline DESIGN 可进入 implementation package 创建。
它不代表任何 SQL 优化已成功**——当前控制面输出仍是 `BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED`，
我在 §4 单独核验了这一点。

## 0. 会话出处

续接会话，非 fresh；本仓零写入（除本文件）。所有分母、anchor、分支绑定、门结果均本会话 fresh 复算，
不采信自报值。`implementation-design-granularity` fresh 复跑 `PASS`，
`REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`
——**未伪称第三轮独立审查，Round 2 的 NO-GO 未被改写**，声明诚实。

---

## 1. Round 2 两个 finding 的关闭核验

### BP-U05-RB2-M-01（audit 分支未逐个绑定 enabled-workspace gate）—— **已关闭**

`PlatformAuditHistoryController#history` 的 switch 我逐分支读了源：

| 分支 | 实际绑定 | 要求 | 结论 |
|---|---|---|---|
| `GROUP_WORKSPACE` | `groupWorkspaceAudit.readGroupWorkspace(scope(entityId), target, …)` | `scope(entityId)` | ✓ |
| `WORKSPACE_ROLE` / `WORKSPACE_ACCOUNT` / `WORKSPACE_INVITATION` | `workspaceIamAudit.read(scopeForWorkspaceTarget(groupWorkspaceKey), …)` | 各自绑定 | ✓ |
| `EXTENSION_DEFINITION` | `extensionAudit.read(scopeForWorkspaceTarget(groupWorkspaceKey), …)` | 同上 | ✓ |
| `STORE_CONTRACT` | `contractAudit.read(scopeForWorkspaceTarget(groupWorkspaceKey), …)` | 同上 | ✓ |
| `PLATFORM_ADMIN` | `platformIamAudit.read(target, page, pageSize)` | **无 scope** | ✓ |
| `default` | `throw new InvalidEdgeRequestException(...)` | — | ✓ |

`scopeForWorkspaceTarget` 另外对 null/blank key 抛 `InvalidEdgeRequestException`，不会静默降级为无 scope。

**控制面是逐分支的源文本校验，不是 method-wide 关键词**：
`validatePlatformAuditBranchBody` 逐条断言 `enabledBranchExpressions` 全部出现（缺一即
`BP_U07_PLATFORM_AUDIT_BRANCH_SOURCE_MISSING`），再把 `PLATFORM_ADMIN` 表达式**切片**出来
用 `/scope\s*\(/` 断言其中**不含** scope —— 反例是被正面证明的，不是靠"没提到"推断。

**红夹具是真源文本变异**（generator `:445`）：取真实 method body，把
`workspaceIamAudit.read(scopeForWorkspaceTarget(groupWorkspaceKey)` 替换为
`workspaceIamAudit.read(target,`，调用校验器并**要求**抛
`BP_U07_PLATFORM_AUDIT_BRANCH_SOURCE_MISSING`；不抛则以 `BP_U07_RED_MUTATION_ACCEPTED` 失败。
与你描述的一致。

### BP-U05-RB2-S-01（59 个 anchor 是通配/`#route` 占位）—— **已关闭**

我没有读自报，而是**逐条打开 78 个 anchor 指向的文件并在文件内正则匹配方法名**：

- `TASK_READ` = **78**，`PROTOCOL_READ_EXEMPT` = **5**，合计 **83** ✓
- **含 `*` / `{` / `}` / `#route` 的 = 0**
- **格式非 `path#method` 或使用绝对路径的 = 0**
- **文件不存在或方法未命中的 = 0**

即 **78/78 全部是准确、仓根相对的 `sourcePath#method`**。

`readContextKind` 分布实算 **`OPERATIONS_SCOPED` 58 / `PLATFORM_WORKSPACE` 15 /
`PLATFORM_GLOBAL` 4 / `PLATFORM_AUDIT_BRANCHED` 1 = 78**，与期望的 58/15/4/1 **逐项一致**。

`policyInvariants` 里两条我认为是关键且写对了：
「`WorkspaceReadAuthorizationFacts` are minted from fresh query and never `WorkspaceSessionRequestCache`」
与「C5 POST commands are not task-read rows and may not call `TaskReadService`」——
这正是 Round 1 M-02 的语义边界，落到了输入文件而不是只在散文里。

---

## 2. U07 分母（独立复算，未采信 generator 输出）

| 项 | 我的复算 | 声明 | 一致 |
|---|---:|---:|---|
| `WORKSPACE_EXECUTION_CONTEXT` command | 68 | 68 | ✓ |
| `OPERATIONS_SCOPED` task read | 58 | 58 | ✓ |
| **M1 applicable** | **126** | 126 | ✓ |
| C5 command | 2 | 2 | ✓ |
| **M2 applicable** | **60** | 60 | ✓ |
| M3 / M6 | 25 / 11 | 25 / 11 | ✓ |

**这个 126 比早先设计里的 128 更准**：早先只从 134 条 operations-admin 里减掉 6 条登录协议；
现在的口径是 68 execution command + 58 `OPERATIONS_SCOPED` read，
把 7 条 `WORKSPACE_PROTOCOL_CONTEXT` command 与 1 条 protocol read 都正确排除（134 = 126 + 8）。

**`getOperationsWorkspaceLoginEntry` 仍是 protocol read**：
policy 中 `disposition = PROTOCOL_READ_EXEMPT`，reason 写明
「pre-login workspace landing; no authenticated session; never mint workspace facts」；
它**不在** `OPERATIONS_SCOPED` 的 58 条内，且我扫过全部 `factImplementations` 的
`applicableOperationIds`，**没有任何一个 fact 把它纳入**。

M2 的账目闭合我也核了：`VisibleOrganizationSessionEntryFacts` 1 +
`VisibleOrganizationFactsC5Command` 2 + `VisibleOrganizationFactsTaskRead` 57 = **60**。

---

## 3. 控制面与红夹具

- `--check` PASS：ROUTES=196 / TASK_READ=78 / M1 126 / M2 60 / M3 25 / M6 11
- `--self-test` PASS，`RED_FIXTURES=17`
- `--snapshot <不可变快照>` PASS，且仍为 `BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED`
- `implementation-design-granularity` PASS，binding mode 诚实标注为等待本次 recheck

`implementationStatus` 与 `blockedOperationCount` 由 generator 内的**显式声明表**驱动
（每个 factLoaderId 一行，带 `sourcePathMethod` / `statementTemplateAnchor` /
`securityPredicateId` / `predicateMarker`），不是从代码推断——语义不可被生成器反向捏造。

---

## 4. `BLOCKED_UNMEASURED` 未被当作成功；BP-U06 零进入

**未被解释为优化成功**：即使供了不可变快照，coverage 门输出仍是
`BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED`。13 条 fact 中有 **5 条**明确标为 DEFERRED
（`WorkspaceReadAuthorizationFacts` → BP-U05、`VisibleOrganizationFactsTaskRead` → BP-U05、
`VisibleOrganizationFactsC5Command` → BP-U07 C5 reconciliation、
`EnabledSelectedWorkspaceFact` → BP-U05 source-bound policy），
且**每条都带 `blockedOperationCount`**（58 / 57 / 2 / 16）。
已实现的 8 条一律是 `IMPLEMENTED_SOURCE_ANCHORED_UNMEASURED`
——**"已按源码锚定"与"已实测"被分开表述，没有混同**。

**BP-U06 零进入**：`runtimeIntegration.status = DEFERRED_TO_BP_U06` 保持；
`CatalogOwnerService` 仍有 69 个旧 `case "` 分支；`CatalogInventoryApplicationService` 仍在。
没有一处声称 runtime cutover 已完成。

---

## 5. Finding

### N-01｜同为 DEFERRED 的 fact 行用了两种编码，`applicableOperationIds` 不可跨行求和

**证据**（`contracts/registry/backend-performance-sql-merge-applicability.json`）：

| factLoaderId | `applicableOperationIds` | `deferredOperationIds` | `blockedOperationCount` | status |
|---|---:|---:|---:|---|
| `WorkspaceReadAuthorizationFacts` | **58** | 0 | 58 | DEFERRED_TO_BP_U05_READ_CONTEXT |
| `VisibleOrganizationFactsC5Command` | **2** | 0 | 2 | DEFERRED_TO_BP_U07_… |
| `EnabledSelectedWorkspaceFact` | **15** | 0 | 16 | DEFERRED_TO_BP_U05_… |
| `VisibleOrganizationFactsTaskRead` | **0** | **57** | 57 | DEFERRED_TO_BP_U05_TASK_READ |

同样是 DEFERRED，前三行把 operation 留在 `applicableOperationIds`，第四行移到 `deferredOperationIds`。
后果：**把 `applicableOperationIds` 跨行求和会得到 222，其中含 58 + 2 + 15 = 75 条尚未实现的**。

**为什么只是 N**：每一行都带显式 `implementationStatus`，**每一条 DEFERRED 都带
`blockedOperationCount`**，阻断账目是完整的；控制面也已输出 `BLOCKED_UNMEASURED`。
**当前没有任何虚假声称**，风险是将来有人（或将来某道门）按 `applicableOperationIds` 求和当作"已实现"。

**最小修复**：统一为一种编码——建议 DEFERRED 行一律
`applicableOperationIds: []` + `deferredOperationIds: [...]`，
并在 generator 加一条不变量：`implementationStatus` 以 `DEFERRED` 开头时
`applicableOperationIds` 必须为空且 `deferredOperationIds.length === blockedOperationCount`。
不改任何分母数字，只统一表述。

**是否需要 Dexter 裁决**：不需要。

---

## 6. 结论

**GO**（M=0，S=0，N=1）。

Round 2 的两个 finding 我复核为**真正关闭**，且关闭方式是可复算的：
audit 六个 enabled 分支逐条在源码里绑定了各自的 scope、`PLATFORM_ADMIN` 的无 scope 是被
**正面切片断言**的而不是靠没提到推断、红夹具是对真实 method body 的源文本变异；
78 条 anchor 我逐个打开文件并匹配方法名，**78/78 准确、仓根相对、零通配零占位**。

U07 分母 126 / 60 / 25 / 11 我从 registry 与 policy 独立重算，逐项相符；
126 的新口径比早先的 128 更准，`getOperationsWorkspaceLoginEntry` 确认未渗入任何 workspace read fact。

`BLOCKED_UNMEASURED` 没有被包装成成功，`IMPLEMENTED_SOURCE_ANCHORED_UNMEASURED` 与"已实测"被明确分开；
BP-U06 零进入。

唯一的 N 是 DEFERRED 行的两种编码，不改数字、只统一表述即可，不阻断。

**本 GO 的授权范围**：仅允许创建 BP-U05 implementation package。
它**不**代表任何 SQL 优化已成功、不授权 BP-U06、不授权生产 implementation、
不授权 SQL 数值优化、DEV、reset/seed、L2/UAT、部署或任何仓库控制动作。

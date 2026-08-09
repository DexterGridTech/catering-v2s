# BP-U05 owner-projection rebaseline —— Claude POST_REMEDIATION_V1 定向 recheck

`VERDICT=GO`　`M=0`　`S=1`　`N=1`

**本 GO 仅恢复 BP-U05 剩余 implementation-facing design 与实现准备。**
不授权 BP-U06、不代表任何 SQL 数值优化成功、不授权 DEV / reset / seed / L2 / UAT / 部署 / 仓库控制。

## 0. 会话出处与门的新鲜复跑

续接会话，非 fresh；本仓零写入（除本文件）。所有分母、type 枚举、cap、路径存在性均本会话 fresh 复算。

| 门 | 结果 |
|---|---|
| `backend-performance-read-budget` | `PASS`　`GET_OPERATIONS=83 TASK_READ=78 PROTOCOL_READ_EXEMPT=5` |
| `backend-performance-read-budget --self-test` | `PASS`　`TWO_OWNER_REMAINING_STATUS=SOURCE_NOT_IMPLEMENTED_BLOCKED`　`BP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED` |
| `task-read-surface-policy.mjs --check` | `PASS` |
| `standards-coverage --phase R5` | `PASS`　`RULES=150` |
| `implementation-design-granularity` | `PASS`　`REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` |

最后一项确认：**机器面只声明"等待 Claude recheck"，没有伪称第三轮独立审查，Round 2 的 NO-GO 未被改写。**

---

## 1. Round 2 两项 finding 的关闭核验

### 1.1 operations audit 的真实九类型分母 —— **已关闭，且作者自己纠了错**

我**不采信"九"这个说法**，直接数了 `OperationsAuditHistoryController#history:60-66` 的 switch：

```
case "WORKSPACE_ACCOUNT", "WORKSPACE_INVITATION"                                    → 2
case "COMMERCIAL_GROUP"                                                             → 1
case "ORGANIZATION_NODE", "BRAND", "TENANT", AuditEntityTypes.HEAD_COMPANY,
     AuditEntityTypes.STORE                                                         → 5
case "STORE_CONTRACT"                                                               → 1
default -> throw new InvalidEdgeRequestException(...)
```

两个常量经查为 `HEAD_COMPANY = "HEAD_COMPANY"`、`STORE = "STORE"`。
**实际类型集合恰为 9 个**：`WORKSPACE_ACCOUNT`、`WORKSPACE_INVITATION`、`COMMERCIAL_GROUP`、
`ORGANIZATION_NODE`、`BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE`、`STORE_CONTRACT`。
**有 `default -> throw`，集合是闭的**，不存在静默接受的第十类。

决策文件 `:43` 明确写道：「经对…的实际 switch 复读，以上"八个"是早期分组摘要而不是可执行分母：
当前 HTTP 接受的有限集合是九个 type」——**作者是重开源码后把自己先前的 8 纠正为 9**，
且九项与我独立枚举的九项**逐个相同**。这正是 Round 2 要求的"可执行分母"。

**cap=1 的 typed reader contract 已落到可执行形态**（决策 `:43`）：
固定为 `app/application/audit/OperationsAuditTaskReadService#read(OperationsAuditReadQuery)`；
edge 只解析 UUID/page 与已加载的 `WorkspaceReadAuthorizationFacts + VisibleOrganizationFacts`；
每分支只调其事实 owner 的**一个** named projection；目标 type、存在/类型不匹配、host scope、
window-count 与 page 进同一 logical statement。

**明令禁止的旧链逐项列名**：不得再调 edge `requireHostAuthorization`、
`OrganizationOverviewTaskReadService#detail`、`ContractTaskReadService#view`、
`WorkspaceAuditAuthorizationService` 的额外 lookup。

**非 dispatcher / 非 query bus 的论证在位**（决策 `:45`）：
「reader 是 compile-time closed nine-branch coordinator，不拥有表、不接受 operationId/表名/字段名，
所有 SQL 仍位于各 owner named projection」。
我独立验证：全仓 edge 中 `switch (operationId)` 命中 **0 处**；四个新命名类型
（`OperationsAuditTaskReadService`、`PlatformAuditHistoryTaskReadService`、
`PlatformWorkspaceAdministrationTaskReadService`、`AuditTargetAuthorizationProjection`）
**当前 0 个文件**——没有提前落地，也没有偷偷落地一个字符串 dispatcher。

policy 行状态诚实：`primaryQueryCap: 1`、`optionalCountCap: 0`、`declaredExtrasCap: 0`、
`primaryReader: "NOT_YET_TASK_READER"`、`primaryBoundary: "UNCLASSIFIED_BLOCKED"`。
generator 另有 `BP_U05_OPERATIONS_AUDIT_AUTHORIZATION_PROJECTION_DRIFT` 钉住该行的
cap=1 与 `futureAuthorizationProjection` 名称。

### 1.2 未来 reader / test surface 未被承认 —— **已关闭**

manifest 的 `changeSurfaces` 里，三个未来 reader **连同它们各自的 focused test** 全部以
`disposition: create` 入册，且**六条全部 absent**：

```
app/application/audit/OperationsAuditTaskReadService.java            + …ServiceTest.java
app/application/audit/PlatformAuditHistoryTaskReadService.java       + …ServiceTest.java
modules/workspace/…/PlatformWorkspaceAdministrationTaskReadService.java + …ServiceTest.java
```

决策 `:75` 还诚实处理了一个容易造假的点：**当前仓没有 `modules/audit` 实现模块，
因此未来 reader 不得声明不存在的模块路径**——路径被固定到既有模块下。这是主动排除了
"用一个不存在的模块路径把 surface 写得好看"的做法。

`SOURCE_NOT_IMPLEMENTED_BLOCKED` 在 policy 中出现 **10 次**、决策中 1 次；
read-budget self-test 输出 `TWO_OWNER_REMAINING_STATUS=SOURCE_NOT_IMPLEMENTED_BLOCKED`
与 `BP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED`。**未实现的部分一律诚实 BLOCKED。**

### 1.3 BP-U06 与动态范围未扩张 —— **已确认**

`runtimeIntegration.status = DEFERRED_TO_BP_U06` 保持；旧 `CatalogInventoryApplicationService` 仍在；
edge 中 `switch (operationId)` **0 处**；四个未来 reader **0 个文件**。

---

## 2. Findings

### S-01｜10 条 `primaryQueryCap > 1` 例外没有任何逐行论证字段

**证据**：`contracts/registry/task-read-surface-policy.json`，`primaryQueryCap > 1` 的行共 **10 条**：

`getPlatformContractOverviewDetail` 2、`getPlatformEntityAuditHistory` 2、
**`getPlatformGroupWorkspaceDetail` 4**、`getPlatformOrganizationOverviewDetail` 2、
`getWorkspaceAccount` 2、`getWorkspaceAccounts` 2、`getWorkspaceInvitation` 2、
`getWorkspaceInvitationCandidates` 2、`getWorkspaceInvitations` 2、
**`listPlatformGroupWorkspaces` 3**。

我逐行检查这 10 条的字段：**`capJustification` / `userTask` / `cardinality` / `reviewDue` /
`exceptionReason` 一个都没有**，10 行全部为空。行里只有 `primaryQueryCap: 2`（或 3、4）这个数字。

**方案 §14.5 与 §15.5 的原文要求是**：`primaryQueryCap > 1` 的例外「必须逐条写明：
用户任务、**为什么不能合并**、基数上限、具名 workload 与到期复核日期」，且「全局上限不超过 8 条」。

**上限 8 → 10 的重基线本身我认为成立**：决策 `:1` 的论证是，沿用 8 会逼出三种伪修复——
task reader 跨 owner schema join、edge 隐藏多段查询计为单条、或删除合同 extension /
商业组初始化 / 资产 URL / 账号角色汇总 / audit host 判断等既有 HTTP 输出。
**这三种都比放宽上限更坏**，我同意这个取舍，也认可它在 Dexter 的委托范围内。

**但逐行论证是防止例外表蔓延的那道控制，它没有落地。** 缺了它：
`getPlatformGroupWorkspaceDetail` 为什么需要 **4** 段、`listPlatformGroupWorkspaces` 为什么需要 **3** 段，
在契约里完全没有依据；下一轮再出现"必须"的第 11、12 条时，也没有可对照的门槛与到期复核。

**有限影响面**：78 条 task read 中的 10 条；不影响任何当前声称
（全部仍 `BLOCKED_UNMEASURED`），影响的是例外表的可持续性与可评审性。

**最小修复**：给这 10 行各补四个字段——`userTask`（用户任务）、
`whyNotMergeable`（为什么不能并成一段）、`cardinalityBound`（基数上限）、`reviewDue`（到期复核日期）；
并在 generator 加一条不变量：`primaryQueryCap > 1` 时四个字段必须非空，
且 cap>1 的行数不得超过决策声明的 10。不改任何 cap 数值，只补论证与守卫。

**是否需要 Dexter 裁决**：**不需要**。上限 8→10 的裁量已由 Dexter 委托 Codex，
且论证成立；本条要的是补齐逐行字段，属工程控制而非产品语义。

### N-01｜"九类型"目前只活在决策散文里，落地前无机器守卫

决策 `:45` 说明 reader 的 source control「在 reader 落地时必须逐项拒绝：…九项任一 branch 遗漏…」
——**延期是诚实且有明文的**。但在 reader 落地之前，如果有人给
`OperationsAuditHistoryController#history` 的 switch 增删一个 case，
**没有任何门会发现"九"已经变成"十"**，决策文件里的九项会静默过期。

generator 现有的 `BP_U05_OPERATIONS_AUDIT_AUTHORIZATION_PROJECTION_DRIFT` 只钉住该 policy 行的
cap=1 与 projection 名称，不看 controller 的 case 集合。

**最小修复（很便宜）**：现在就加一条源文本断言——
`OperationsAuditHistoryController#history` 的 switch 去重 case 集合必须**恰为**决策列出的九项
（含两个 `AuditEntityTypes` 常量分支），增删即红。这不需要等 reader 落地。

**是否需要 Dexter 裁决**：不需要。

---

## 3. 结论

**GO**（M=0，S=1，N=1）。

两项 Round 2 finding 我复核为**真正关闭**，且关闭方式经得起复算：

**九类型分母是作者重开源码后把自己的"八"纠正为"九"的结果**，我独立枚举得到同样的九项，
且 switch 有 `default -> throw`、集合闭合。cap=1 的 typed reader contract 落到了具体的
`sourcePath#method`、逐分支单 projection、以及**逐项列名的旧链禁令**，不是把三段链压成一句声明。

**未来 reader 与其 focused test 六条路径全部入 manifest exact surface 且全部 absent**，
决策还主动排除了"声明不存在的 `modules/audit` 路径"这种取巧写法。未实现部分一律
`SOURCE_NOT_IMPLEMENTED_BLOCKED` / `BLOCKED_UNMEASURED`。

**范围未扩张**：edge 中 `switch (operationId)` 0 处、四个未来 reader 0 个文件、
`DEFERRED_TO_BP_U06` 保持、旧 dispatcher 仍在。五道门本会话全部 fresh 复跑通过，
且 binding mode 诚实标注为等待本次 recheck。

唯一的 S 是**上限放宽了、逐行论证没跟上**：8→10 的取舍我同意，但那 10 条例外一个论证字段都没有，
其中 cap=4 与 cap=3 各一条完全没有依据。补四个字段加一条 generator 不变量即可，不改任何数值。

**授权边界**：本 GO 仅恢复 BP-U05 剩余 implementation-facing design 与实现准备。
不授权 BP-U06、不构成任何 SQL 数值优化成功声明、不授权 DEV / reset / seed / L2 / UAT /
部署或任何仓库控制动作。

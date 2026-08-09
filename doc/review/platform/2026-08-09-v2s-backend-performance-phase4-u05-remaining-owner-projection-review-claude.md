# BP-U05 剩余 13 条 task-read owner projection —— Claude 独立设计评审

`VERDICT=NO-GO`　`M=1`　`S=0`　`N=2`

**NO-GO 只卡一件事**（§3 M-01）：edge 旧链残留在本轮这组行上**没有机器拦截**，我用可编译的真实旧链调用实测门仍绿，
而同类缺陷在隔壁 twoOwner 那五行是红的。其余全部核验通过，是一项周转，不需要重审剩余范围。

## 0. 会话出处与写入边界

续接会话，非 fresh v2s-rooted acceptance。本仓零写入（除本文件）。
所有分母、类型集、cap、路径存在性、hash 均本会话独立复算，不采信任何自报值。
12 次变异实验全部在会话专属 scratchpad 的仓库拷贝上进行，用后即弃；本仓源码与契约未被触碰。

---

## 1. 门的 fresh 复跑

| 门 | 结果 |
|---|---|
| `backend-performance-read-budget --check` | `PASS`　`OPERATIONS_AUDIT_TARGET_TYPES=9`　`TWO_OWNER_BOUNDARY_LOGICAL_STATEMENT_CAP=1` |
| `backend-performance-read-budget --self-test` | `PASS`　`RED_FIXTURES=45` |
| `task-read-surface-policy.mjs --check` | `PASS` |
| `standards-coverage --phase R5` | `PASS`　`RULES=150` |
| `implementation-design-granularity --self-test` | `PASS` |
| `implementation-design-granularity --manifest … --review <round1>` | **`FAIL`　`REASON=REVIEW_MANIFEST_HASH_DRIFT`** |

最后一项见 §3 N-02：这是门**正确**地拒绝把修复后的 manifest 绑到修复前的 Round 1 上，不是假绿。

三个状态位保持诚实：
`TWO_OWNER_REMAINING_STATUS=SOURCE_NOT_IMPLEMENTED_BLOCKED`、
`BP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED`、
`BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED`。**本轮没有任何数值优化成功声明。**

---

## 2. 你点名的六项核验

### 2.1 十三条分母、edge caller、typed reader、focused test —— **通过**

13 条我从 policy 独立筛出（`primaryReader === "NOT_YET_TASK_READER"` 计数 **13**），
逐条打开 edge 文件并在文件内正则匹配方法名，**13/13 命中真实 anchor**，落在 **6 个 controller**。

manifest `deliveryUnits[0].changeSurfaces` 实算 **25 条 = create 6 + update 19**：

- **create 6 条我逐条 stat，全部 absent** —— 三个未来 reader + 三个 focused test；
  测试路径与源路径**包名逐段镜像**（B.3.2）。
- **update 19 条我逐条 stat，19/19 present。**

一个容易被含糊过去的点我专门查了：`OrganizationOverviewTaskReadService.java` **文件已存在**，
但 `platformManagementBaseDetail` **全仓 0 处命中**——所以它标 `SOURCE_NOT_IMPLEMENTED_BLOCKED`
是**方法粒度**的诚实，不是拿"文件在"冒充"已实现"。

manifest 声明的两个 hash 我逐个复算：
design `2a68663d…` **相符**、authorization `ea4640a9…` **相符**；`scope: design-only`、
`status: PROPOSED_REVIEW_ONLY`、`packageExit` 为空——设计期不预支 package exit，正确。

### 2.2 operations audit 恰为九类型 —— **通过，且已机器化**

上一轮我提的 N-01 是「九类型只活在决策散文里，落地前无机器守卫」。**本轮已关闭**：
generator 里 `operationsAuditTargetTypeSet` 是九元素字面量，对着 controller 源码校验。

**我做了真变异**：给 `OperationsAuditHistoryController#history` 的 switch 加第十个 case
（`case "COMMERCIAL_GROUP", "SOMETHING_NEW"`）→ **RED　`BP_U05_OPERATIONS_AUDIT_TARGET_TYPE_SET_DRIFT`**。
九变十会被发现。

**但"不保留旧链"这半句没有机器化 —— 见 M-01。**

### 2.3 platform audit：PLATFORM_ADMIN 不加载 selected workspace、GROUP_WORKSPACE 固定两 owner 段 —— **通过**

分支规格我从契约实读，`when` 覆盖**恰好七个 entityType、零重叠**（1+1+3+1+1）：

| 分支 | owner 段 |
|---|---|
| `GROUP_WORKSPACE` | `PlatformWorkspaceAuditHistoryService#readGroupWorkspace` + `OrganizationAuditHistoryService#readInitializationForGroupWorkspace`（**唯一的两段**） |
| `PLATFORM_ADMIN` | `PlatformIamAuditHistoryService#read`（单段） |
| `WORKSPACE_ROLE｜WORKSPACE_ACCOUNT｜WORKSPACE_INVITATION` | `WorkspaceIamAuditHistoryService#read` |
| `EXTENSION_DEFINITION` | `ExtensionAuditHistoryService#read` |
| `STORE_CONTRACT` | `ContractAuditHistoryService#read` |

每段 `logicalStatementCap: 1`。`validateAudit` 钉住
`absentWhenEntityType === ["PLATFORM_ADMIN"]` 与 `requiredWhenEntityType === 六类 enabled`。

**两次真变异**：
把 `absentWhenEntityType` 清空 → **RED　`BP_U05_READ_BUDGET_AUDIT_BRANCH_DRIFT`**；
把 `GROUP_WORKSPACE` 的两段砍成一段 → **RED　`BP_U05_REMAINING_EXCEPTION_BOUNDARY_OR_BRANCH_DRIFT`**。

我另外查证了一个不显眼的结构事实：`PLATFORM_AUDIT_BRANCHED` 这个 kind 走
`validatePlatformSource` 时，`PLATFORM_WORKSPACE`／`PLATFORM_GLOBAL` 那两条
`requireEnabledSelectedWorkspace` 断言**都不会命中它**（它两者皆非）。
所以"PLATFORM_ADMIN 不加载 selected workspace"**完全由 `conditionalFact` 这条路承担**——
好在这条路是真被钉住的（上面的变异证明了），结论成立，但依赖点比表面看上去窄，记在这里备查。

### 2.4 group-workspace 三/四段只能走 typed reader —— **通过**

`listPlatformGroupWorkspaces` = **3 段**（`WorkspaceAdministrationService#list` +
`GroupWorkspaceTaskQuery#list` + `PlatformAssetService#requireActivePublicReferences`），cap 3 / optional 1；
`getPlatformGroupWorkspaceDetail` = **4 段**（前两个换成 `#require`／`#detail`，加
`PlatformAssetService#requireActivePublicReference` 与 `WorkspaceIamSummaryReadService#accountAndRoleSummary`），cap 4 / optional 0。
两者的 typed reader 都固定为 `PlatformWorkspaceAdministrationTaskReadService#page/#detail`，
`edgeCall` 分别是 `reads.page(` / `reads.detail(`。

**真变异**：把 detail 的四段砍成三段 → **RED　`BP_U05_REMAINING_EXCEPTION_BOUNDARY_OR_BRANCH_DRIFT`**。

"不在 edge 直接组合"这一半，正是 M-01 覆盖的缺口。

### 2.5 未来 reader 路径固定在 `app/application/audit`，错误路径/缺 source/缺 edge-call 真红 —— **通过**

两个 audit reader 的 `readerPath` 都实读为
`apps/backend/…/src/main/java/com/catering/v2s/app/application/audit/…TaskReadService.java`，
上一轮 Round 1 的 M-02（`modules/audit` 幽灵路径）确已改正。

**四次真变异，逐条命中且错误码互不相同**：

| 变异 | 结果 |
|---|---|
| 把 audit reader 路径挪出 `app/application/audit` | **RED**　`BP_U05_FUTURE_READER_PATH_DRIFT` |
| 谎报 `status: SOURCE_IMPLEMENTED_UNMEASURED`（文件并不存在） | **RED**　`BP_U05_REMAINING_EXCEPTION_SOURCE_REQUIREMENT_DRIFT` |
| 把已实现 reader 的方法改名 | **RED**　`BP_U05_READ_BUDGET_SOURCE_METHOD_MISSING` |
| 抽掉 edge 对 typed reader 的调用 | **RED**　`BP_U05_PRIMARY_READER_SOURCE_MISMATCH` |

第二条比设计声称的还严：**谎报状态在 admission 检查之前就被声明表拦住**，
连"翻状态位以绕过检查"这条路都是堵死的。

我还专门验了这套 admission 机制**不是空转**：`getPlatformContractOverviewDetail` 今天就是
`SOURCE_IMPLEMENTED_UNMEASURED`——`ContractTaskReadService#platformOverviewTaskDetail:221` 真实存在、
`PlatformContractOverviewController.java:50` 真实调用、行状态 `TASK_READER` 且 boundary 匹配。
四项检查每天都在这一行上跑。

顺带澄清一个容易误读的地方：这一行出现在 `remainingOwnerProjectionExceptions` 里，**不是**因为它未实现，
而是因为它 cap>1。五条 remaining exception 与五条 twoOwner exception 正好拼成上一轮那 **10 条 cap>1**，
分区干净无重叠。

上一轮 S-01（10 条 cap>1 无逐行论证）**已关闭**：四个字段
`userTask` / `whyNotMergeable` / `cardinalityBound` / `reviewDue` 落在 **10/10** 行上。
**真变异**：抽掉其中一个字段 → **RED　`BP_U05_MULTI_OWNER_REVIEW_METADATA_MISSING`**。

另外我试了一条反向漏洞：**把某条 blocked 行翻成 `TASK_READER` 但 boundary 仍留 `UNCLASSIFIED_BLOCKED`**
→ **RED　`BP_U05_PRIMARY_READER_BOUNDARY_INVALID`**。65/13 的分区计数也被 schema 硬钉，搬不动。

### 2.6 `BLOCKED_UNMEASURED` 保持、BP-U06 与动态环境零进入 —— **通过**

- `runtimeIntegration.status = DEFERRED_TO_BP_U06` 保持
- edge 中 `switch (operationId)` **0 处**
- 三个未来 reader + `AuditTargetAuthorizationProjection` **全仓 0 个文件**
- 三个状态位全部 `BLOCKED_UNMEASURED` / `SOURCE_NOT_IMPLEMENTED_BLOCKED`
- 未启动 DEV / reset / seed / L2 / UAT；**无任何数值优化成功声明**

独立对抗审查这一环也核了：Round 1 是 `reviewerKind: INDEPENDENT_SUBAGENT`、`reviewRound: 1/2`、
`blindReviewDeclaration` 声明先独立成 verdict 再读作者材料、`NO_GO` 带 2 个 M，
作者做的是辩证 intake 而非自审自判。**这个边界没有被绕。**

---

## 3. Findings

### M-01｜edge 旧链残留在本组行上无机器拦截：typed reader 可以**加在旧链之上**而门全绿

**这是本次 NO-GO 的唯一原因。**

**证据（实测，不是推论）**。我在 scratchpad 拷贝上，往已实现的
`PlatformContractOverviewController#detail` 里、紧挨着 typed reader **加回一条旧链读取**：

```java
var legacy = reads.view(workspaceUuid, groupWorkspaceKey, contractId);
var value  = reads.platformOverviewTaskDetail(workspaceUuid, groupWorkspaceKey, contractId);
```

`ContractTaskReadService#view(UUID, String, UUID)` 在 `:209` 是**真实 public 方法**，
`reads` 字段声明类型正是该类——**这段可编译**，且 `#view` 正是决策点名禁止的四个旧链调用之一。

**门结果：GREEN。**

**对照实验**：同一类缺陷放到 twoOwner 那五行（`getWorkspaceAccounts`，注入 `user.page(`）
→ **RED　`BP_U05_TWO_OWNER_EDGE_TYPED_READER_BYPASS`**。

**确认根因**。twoOwner 五行的 spec 带 `legacyEdgeRead` 正则，
`:256` 同时断言「typed reader 调用存在」**且**「旧链调用不存在」。
本组五条 `sourceRequirement` **只有 `edgeCall` 一个字段，没有任何等价物**；
`validateFutureReaderAdmission` 只查 typed reader **在场**，从不查旧链**缺席**。
决策里点名禁止的 `requireHostAuthorization`、`OrganizationOverviewTaskReadService#detail`、
`ContractTaskReadService#view`、`WorkspaceAuditAuthorizationService` 额外 lookup，
**目前是纯散文**。

**为什么是 M 而不是 S**。本单元存在的唯一理由是**把每请求读取次数降下来**。
缺了这条控制，一个"typed reader 包在旧链外面"的实现可以**满足全部机器门**——
exact-set 对账过、receipt 对账过、admission 四项全过——而读取次数**一次都没少**。
`primaryQueryCap` 只约束契约声明的段数，不约束 edge 里多出来的那几条真实 SQL。
这正是仓内点名的假绿模式：**门绿不等于业务完成**。而且判据不是我的推测——
同一缺陷在隔壁五行是红的，**作者自己的标准就是这条**，只是没铺到旧链最长的这五条上。

**有限适用面**。5 条 remaining owner-projection exception（旧链最长的那批），
外溢到 13 条中其余带 `sourceRequirement` 的行。
**不影响任何当前声称**——今天所有状态位仍是 `BLOCKED_UNMEASURED`，
风险在 reader 落地那一刻兑现，而不是现在。

**最小修复**。给这 5 条 `sourceRequirement` 各加一个 `forbiddenEdgeReads`
（正则或字面量清单，内容就取决策已点名的那四个调用），
并在 `validateFutureReaderAdmission` 里于 `status` 翻成 `SOURCE_IMPLEMENTED_UNMEASURED` 时断言其**不出现**。
**不新建机制**——直接复用 `:256` 那条 `legacyEdgeRead` 的写法，
让本组与 twoOwner 组用同一把尺子。不改任何 cap、分母或路径。

**为什么不是更小的方案**：只查 `edgeCall` 在场，在信息上无法区分"替换掉了旧链"与"包在旧链外面"——
这两种实现的字符串证据完全一样。必须有一条缺席断言，没有更小的形式。

**是否需要 Dexter 裁决**：**不需要**。四个被禁调用已在冻结决策里点名，本条只补执行，不引入新语义。

### N-01｜audit 行的 `optionalCountCap` 有两个不一致的数字并存

**证据**：`getPlatformEntityAuditHistory` 行级 `optionalCountCap: 0`，
而同一行的 `conditionalFact.branchCaps` 里 `PLATFORM_ADMIN` 分支是 `optionalCountCap: 1`。
行级值**不是**各分支的最大值。

**后果**：将来任何按行级字段读预算的消费者（包括 BP-U07 的测量门）会拿到 0，
而 `PLATFORM_ADMIN` 分支合法地会产生 1 条 count——要么误判超预算，要么反过来把分支声明架空。

**为什么只是 N**：今天没有任何消费者读它（全部 `BLOCKED_UNMEASURED`），
且 `validateAudit` 把 branchCaps 钉得很死（我变异验证过），语义没有丢失，只是有两个入口。

**最小修复**：给 `PLATFORM_AUDIT_BRANCHED` 行加一个 `optionalCountCapBasis: "BRANCH_CAPS"` 标记，
并加一条不变量——该 kind 的行必须携带此标记，消费者据此走分支而非行级数字。
**不改任何数字**（尤其不要把行级改成 1，那会把六类 enabled 分支的 0 放宽掉）。

**是否需要 Dexter 裁决**：不需要。

### N-02｜granularity 门当前红，作者材料既未谎称其绿、也未登记该状态

**证据**：`implementation-design-granularity --manifest <本轮 manifest> --review <Round 1>`
→ `FAIL　REASON=REVIEW_MANIFEST_HASH_DRIFT`。
Round 1 钉的是修复前的 `a6cda929…`，现字节是 `803abfc4…`。

**这是门在正确工作**：修复后的 manifest 不该绑到提出 NO-GO 的那一版评审上。
我全文检索了作者材料，**没有任何一处声称该门通过**——所以不构成假绿声明，D.3 未被违反。
但它也**没有被显式登记**，而 CLAUDE.md 要求 implementation-facing 设计必须由该门验证。
当前状态是"该门尚不可能通过"，直到 Round 2 落地。

**最小修复**：在提交 Round 2 时显式写明该门在 Round 1 配对下为 `REVIEW_MANIFEST_HASH_DRIFT`、
原因是修复导致 manifest 前进，并在 Round 2 配对下复跑至 `PASS`。

**是否需要 Dexter 裁决**：不需要。

---

## 4. 方案合理性

**问题对不对**——对。13 条是仅剩的未收口 task read，
它们恰好是旧链最长的几条（audit 七分支、group-workspace 三/四段）。
把它们收进 typed owner projection，正是"能用一条 SQL 解决的不要用两条"要打的地方。

**方案优不优**——我自己会给的替代方案有两个，都比现方案差：

其一，**放弃 typed reader，直接在 edge 合并查询**。更短，但会让 edge 跨 owner schema 拼 SQL，
撞 `MODULE_OWNER_SOVEREIGNTY` 与 §3.4，用一个更贵的问题换一个更便宜的问题。

其二，**为 audit 九类型各做一个 reader**。看似更"纯"，但九个 reader 共享同一套
UUID/page/授权解析，会把同一段逻辑抄九遍——正是我在方案 §14.7 划的抽象粒度红线
（不许从一个极端走到另一个极端）另一侧的失败。
现方案取的是**编译期闭合的九分支协调器**：不拥有表、不接受 operationId/表名/字段名、
SQL 全部留在各 owner 的具名 projection 里。我验证过全仓 edge `switch (operationId)` **0 处**，
它确实没有滑成字符串 dispatcher。**这个取舍我认同。**

**代价配不配**——配。三个新 reader + 三个 focused test + 六个 controller 改造，
是一人 + 两个 AI 快速迭代阶段能一次性吃下的量。没有引入 CI 平台、缓存层或新模块
（决策还主动否掉了新建 `modules/audit`）。

**唯一的方案层面隐患就是 M-01**：方案的收益（少读几条）**没有对应的机器判据**。
`primaryQueryCap` 管的是契约声明的段数，管不到 edge 里多出来的真实 SQL。
补上那条缺席断言之后，方案在"是否真的省下了读取"这件事上才有牙齿。

**UI 与交互**：`NOT_APPLICABLE`。本单元不改任何 HTTP 契约、不改响应形状、不新增或改变用户可见操作，
两个 App 的页面与 Journey 零变化——纯后端读取路径重构。

---

## 5. 结论

**NO-GO**（M=1，S=0，N=2）。

先说做得扎实的部分，这些我都是变异验证过的、不是读文档得出的：
**12 次真变异，11 次精确命中且错误码互不相同**，涵盖 reader 路径漂移、谎报实现状态、
方法改名、抽掉 edge 调用、blocked 行偷翻 TASK_READER、九类型变十、
`PLATFORM_ADMIN` 分支被放宽、audit 两段砍成一段、group-workspace 四段砍成三段、cap 论证字段被抽走。
其中"谎报状态"比设计声称的还严——在 admission 检查之前就被声明表拦住。
上一轮我提的 S-01 与 N-01 **均已真正关闭**。13 条分母、25 条 surface（6 create 全 absent / 19 update 全 present）、
两个 hash、七个 entityType 的分支覆盖，我全部独立复算相符。
Round 1 是真盲审 NO-GO，作者做的是辩证 intake，独立对抗审查的边界没有被绕。

**卡住的是第 12 次变异。** 我把决策点名禁止的 `ContractTaskReadService#view`
——一个真实存在、签名匹配、**可编译**的方法——加回 edge，紧挨着 typed reader，**门全绿**。
同一类缺陷在隔壁 twoOwner 五行是 `BP_U05_TWO_OWNER_EDGE_TYPED_READER_BYPASS` 红。
也就是说，一个"把 typed reader 包在旧链外面、一条读取都没少"的实现，
可以走完全部机器门。本单元存在的唯一理由是把读取次数降下来，
而恰恰是这件事没有判据。作者自己的标准已经写在五行之外，只是没铺过来。

**修复很小**：给 5 条 `sourceRequirement` 各加一个 `forbiddenEdgeReads`，
在 admission 里断言其缺席，直接复用既有 `legacyEdgeRead` 写法。不改 cap、不改分母、不改路径、不新建机制。
**闭掉 M-01 即可，不需要重审本轮其余范围**——其余部分我已逐项验证通过。
N-01、N-02 可随手带上。

**授权边界**：本结论仅覆盖 BP-U05 剩余 13 条 owner projection 的 implementation-facing design。
NO-GO 意味着**尚不进入实施准备**，直到 M-01 关闭。
本文件**不**构成任何 SQL 数值优化成功声明——三个状态位当前均为 `BLOCKED_UNMEASURED`，
这是必须保持的真实状态。不授权 BP-U06、不授权 DEV / reset / seed / L2 / UAT / 部署，
不授权动态环境操作，也不替代作者 cycle 仍欠的独立 Round 2。

# BP-U05 剩余 owner projection —— Claude POST_REMEDIATION_V1 定向复核

`VERDICT=GO`　`M=0`　`S=1`　`N=1`

**M-01 已真正关闭**：上一轮变绿的那次变异，我逐字重放，现在是红的。
唯一的 S 是 manifest exact surface 漏了一个 owner 文件——与本次修订无关，是 Round 1 修复时就留下的，
不阻断本轮结论，但要在实施前补上。

## 0. 会话出处与写入边界

续接会话，非 fresh v2s-rooted acceptance。本仓零写入（除本文件）。
14 次变异全部在会话专属 scratchpad 的仓库拷贝上进行，用后即弃。
所有 hash、分母、方法存在性均本会话独立复算。

---

## 1. M-01 关闭核验：同一变异逐字重放

上一轮我用的是这段（`ContractTaskReadService#view` 在 `:209` 真实存在、签名匹配、可编译）：

```java
var legacy = reads.view(workspaceUuid, groupWorkspaceKey, contractId);
var value  = reads.platformOverviewTaskDetail(workspaceUuid, groupWorkspaceKey, contractId);
```

| | 上一轮 | 本轮 |
|---|---|---|
| 同一变异 | **GREEN** | **RED　`BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ`** |

**旧链假绿已关闭。**

### 1.1 十六条禁令逐条对真实源码验证

我没有采信"已补齐"，而是把 5 行的 `forbiddenEdgeReads` 逐条拿去匹配各自 anchor 指向的真实 controller：

| 行 | 禁令条数 | 当前源码命中 |
|---|---:|---|
| `getPlatformContractOverviewDetail` | 1 | 0（**应当为 0**：该行已 `SOURCE_IMPLEMENTED_UNMEASURED`，旧链已removed，absence 断言正在生效） |
| `getPlatformOrganizationOverviewDetail` | 1 | 1/1 真实命中 |
| `getPlatformEntityAuditHistory` | 5 | **5/5 真实命中**，与 controller 五个分支调用表达式逐个对应 |
| `listPlatformGroupWorkspaces` | 3 | 2/3（见 N-01） |
| `getPlatformGroupWorkspaceDetail` | 5 | **5/5 真实命中**（含 `accountCount(`、`roleCount(`） |

**不是写了一串永不命中的正则充数。** 16 条里 13 条命中真实旧链，1 条是已修复行的正确空集，
1 条属 N-01，另有 1 条（`workspaces.list(`）虽命中但见 §4 的方案讨论。

### 1.2 禁令本身能不能被悄悄改软

**变异**：只在契约 JSON 里把禁令换成永不命中的 `\bnever\.happens\(`
→ **RED　`BP_U05_FUTURE_READER_FORBIDDEN_EDGE_SCHEMA_DRIFT`**。

禁令集同时钉在 generator 的 `remainingExceptionSourceRequirements` 声明表里，
契约单改会红，与本仓其它不变量同一标准。

### 1.3 admission 六项是否同时要求

我读了 `validateFutureReaderAdmission` 的实际断言序列，六项齐备且各有独立错误码：

| 要求 | 错误码 |
|---|---|
| status 必须先是 `SOURCE_IMPLEMENTED_UNMEASURED` 才激活 | 时序闸门（BLOCKED 期间旧链必须还在，正确） |
| reader 路径 | `BP_U05_FUTURE_READER_PATH_DRIFT` |
| reader 方法体存在 | `BP_U05_FUTURE_READER_SOURCE_METHOD_MISSING` |
| edge 调用在场 | `BP_U05_FUTURE_READER_EDGE_CALL_MISSING` |
| **旧链缺席** | `BP_U05_FUTURE_READER_FORBIDDEN_EDGE_READ` |
| 行状态 `TASK_READER` + boundary 匹配 | `BP_U05_FUTURE_READER_ADMISSION_STATE_DRIFT` |

上一轮验过的两条侧门本轮仍成立：谎报 status 会先被
`BP_U05_REMAINING_EXCEPTION_SOURCE_REQUIREMENT_DRIFT` 拦住；
偷翻 `TASK_READER` 但留 `UNCLASSIFIED_BLOCKED` 会被 `BP_U05_PRIMARY_READER_BOUNDARY_INVALID` 拦住。

`RED_FIXTURES` 由 **45 增至 50**。

---

## 2. N-01 / N-02 关闭核验

### N-01（branch cap 语义）—— **已关闭，且是机器钉的**

`getPlatformEntityAuditHistory` 行新增 `optionalCountCapBasis: "BRANCH_CAPS"`，
行级 `optionalCountCap: 0` 不再是可被误读的权威值。

**两次变异**：删掉该标记 → **RED　`BP_U05_READ_BUDGET_AUDIT_BRANCH_DRIFT`**；
改成 `"ROW"` → **同样 RED**。不是只写进散文。

`PLATFORM_ADMIN` 的 optional count 现在**只能**从 branch cap 获得：
`validateAudit` 钉住 `absentWhenEntityType === ["PLATFORM_ADMIN"]`、六类 enabled 分支 `optionalCountCap: 0`、
`PLATFORM_ADMIN` 分支 `optionalCountCap: 1`，行级值被 basis 标记显式降级为非权威。

### N-02（review binding）—— **已关闭，且比我要求的更完整**

`postRemediationDeclaration` 我逐项复算：

| 字段 | 复算结果 |
|---|---|
| `reviewPath` 指向的 Round 2 文件 | 存在 |
| `reviewSha256` `ad5c5e7e…` | **与实际文件逐位相符** |
| `intake.sha256` `ea237760…` | **与实际文件逐位相符** |
| `reviewedManifestSha256` `803abfc4…` | **正是我上一轮算出的那个值** |
| `currentBytesNotReviewedByAdversarialReviewer` | `true` |
| `claudeRecheckRequired` | `true` |
| `implementationAuthority` | **`false`** |

`reason` 字段对我上一轮 M-01 的复述准确，且明说"当前字节写于 cycle 最终独立轮之后，
禁止第三轮独立轮"——**没有拿修订字节冒充已被独立审查过**。

**门的配对语义也被证明是活的**：
配 Round 1 → `FAIL　POST_REMEDIATION_DECLARATION_INVALID`（声明说 round 2，你给 round 1，正确拒绝）；
配 Round 2 → **`IMPLEMENTATION_DESIGN_GRANULARITY=PASS`　`REVIEW_ROUND=2`　
`REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`**。

Round 2 本身我也开了：`reviewerKind: INDEPENDENT_SUBAGENT`、`reviewRound: 2 / limit 2`、
`roundFinalDecision: SELF_DECIDED`、`furtherCodexAdversarialRoundAllowed: false`、
blind 声明写明先独立成结论再读 intake。**两轮硬上限与独立盲审边界都没有被绕。**

---

## 3. 分母与状态零漂移

| 项 | 复算 | 期望 |
|---|---:|---:|
| `NOT_YET_TASK_READER` | **13** | 13 |
| `TASK_READER` | **65** | 65 |
| `primaryQueryCap > 1` | **10** | 10 |
| remaining exception / twoOwner exception | **5 / 5** | 5 / 5 |
| `OPERATIONS_AUDIT_TARGET_TYPES` | **9** | 9 |

`TWO_OWNER_REMAINING_STATUS=SOURCE_NOT_IMPLEMENTED_BLOCKED`、
`BP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED`、
`TWO_OWNER_PRIMARY_PROJECTION_STATUS=SOURCE_IMPLEMENTED_UNMEASURED`
—— **三个状态位全部与上一轮一致，无一被改写成成功。**

**BP-U06 / 动态环境 / 数值优化零进入**：`DEFERRED_TO_BP_U06` 保持；
edge 中 `switch (operationId)` **0 处**；四个未来命名类型 **全仓 0 个文件**；
未启动 DEV / reset / seed / L2 / UAT；无任何 SQL 数值成功声明。

---

## 4. Finding

### S-01｜manifest exact surface 漏了一个被声明为 owner 段、且方法尚不存在的文件

**证据**。我把 5 条例外声明的全部 **17 个 owner boundary** 逐个拿去查文件与方法是否存在，
再对照 manifest 的 25 条 exact surface：

- `WorkspaceIamSummaryReadService#accountAndRoleSummary`（`getPlatformGroupWorkspaceDetail` 第四段）
  —— 文件存在，但**方法不存在**。该类当前只有 `accountCount(UUID)`（`:20`）与 `roleCount(UUID)`（`:26`）。
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceIamSummaryReadService.java`
  **不在 25 条 surface 内**，其 focused test 也不在。

**这与 manifest 自身的惯例不一致**。同类情形——
`OrganizationOverviewTaskReadService#platformManagementBaseDetail` 同样是"文件在、方法待建"——
该文件**是**以 `update` 入册的。17 个 boundary 里，**只有这一个**是"方法待建且文件未入册"。

**为什么要紧**。这个方法是 cap 4 的承重件：edge 今天在 `toDetail:128` 分两次调
`workspaces.accountCount(...)` 与 `workspaces.roleCount(...)`，
而该段声明 `logicalStatementCap: 1`——也就是必须合并成一条语句。
两个旧调用都已进 `forbiddenEdgeReads`（我验过 5/5 命中），
但**合并方法的创建没有任何 surface 承接**。后果有二：
其一，实施时该文件必然被改动，changed-path 集合与 manifest exact set 不相等，package exit 对账会失败；
其二，若实施者不建合并方法、把两次 count 挪进 reader 内部，
edge 侧禁令仍然满足、门仍然绿，而 detail 路径实际是 5 条语句而非声明的 4 条——
当前 `BLOCKED_UNMEASURED` 期间没有任何东西会发现这一点。

**有限适用面**。1 条 operation（`getPlatformGroupWorkspaceDetail`）的 1 个 owner 段。
**不影响本次修订的任何声称**——M-01/N-01/N-02 的关闭是独立成立的，
三个状态位也没有因此失真。这是 Round 1 修复 manifest 时就存在的遗漏，不是本次改出来的。

**最小修复**：把 `WorkspaceIamSummaryReadService.java` 以 `update` 入册，
并补一条对应的 focused test surface（沿用该文件已有的测试包镜像）。
不改 cap、不改分母、不改任何 boundary 声明。

**为什么不是更小的方案**：把它留在 manifest 之外，等实施时再补，会让本轮的 exact set 从一开始就不等于
实际 changed-path 集合，而 exact-set 相等正是这份 manifest 唯一的作用。

**是否需要 Dexter 裁决**：**不需要**。

### N-01｜一条禁令在其锚定源码里当前零命中，与"笔误"不可区分

**证据**：`listPlatformGroupWorkspaces` 的三条禁令中，
`\binitializationFacts\s*\.\s*list\s*\(` 在 `PlatformWorkspaceAdministrationController` 中 **0 命中**。
该行仍是 `SOURCE_NOT_IMPLEMENTED_BLOCKED`，旧链此刻本应完整存在。

我查证过这**不是笔误**：`initializationFacts` 字段类型是 `GroupWorkspaceTaskQuery`，
该接口确有 `list(...)` 与 `detail(...)` 两个方法（`detail(` 在 `:125` 有真实调用）。
edge 的 `list` 方法今天只调 `workspaces.list(` 与 `assets.requireActivePublicReferences(`，
从不调 `initializationFacts.list(`。所以这是一条**前瞻性禁令**——"将来也不许从 edge 直接调"——
本身是合理的。

**为什么仍记一条 N**：generator 没有任何"被禁调用今天必须真实存在"的存活性要求，
因此前瞻性禁令与写错的禁令在机器面完全同形。本条恰好是前者，
但下一条写错的会以同样的方式静默通过。

**最小修复**：给这类条目加一个 `prospective: true` 标注，
并对未标注的条目加一条存活性断言（`SOURCE_NOT_IMPLEMENTED_BLOCKED` 行的非前瞻禁令必须在当前源码命中）。
不改任何禁令内容。

**是否需要 Dexter 裁决**：不需要。

---

## 5. 方案合理性（本轮增量）

本次修订只加控制、不改语义：禁令集、basis 标注、binding 声明，
**cap、分母、reader 路径、生产代码、BP-U06 与运行期范围一律未动**——我逐项复算确认。
修复方式正是我建议的"复用既有 `legacyEdgeRead` 写法"，没有新造机制，也没有借修复扩范围。

有一处值得 Codex 在实施设计里讲清楚（**不是 finding，是请说明**）：
`WorkspaceAdministrationService#list:66` 的 SQL 里有一个跨 schema 相关子查询——
platform-workspace owner 直接 `EXISTS (SELECT 1 FROM organization.commercial_group …)` 读 organization 的表。
而 `listPlatformGroupWorkspaces` 声明了三段，其中 `GroupWorkspaceTaskQuery#list` 是 organization 的正规端口。
两种读法：

- 若意图是**用 organization 端口替换那个跨 schema `EXISTS`**，那这是所有权修正，
  语句数 2→3 但归属干净，取舍成立——只是 `WorkspaceAdministrationService.java` 同样不在 manifest 内，
  按 S-01 一并补入即可；
- 若意图是**保留 `EXISTS` 再加一段端口读取**，那同一个事实会被读两次，
  该行读取数不降反升，与本单元目的相反。

manifest 当前未收录该文件，**字面上等于第二种**。请在实施设计里明确是哪一种。
这不影响本轮 GO——该跨 schema 读取是既有状态、非本次引入，且当前无任何数值声称。

**UI 与交互**：`NOT_APPLICABLE`。本次修订只改契约、生成器与门脚本，
不触碰 HTTP 契约、响应形状或任何用户可见操作，两个 App 零变化。

---

## 6. 结论

**GO**（M=0，S=1，N=1）。

上一轮的 M-01 是真关闭，不是文档上关闭：**同一段可编译的旧链调用，逐字重放，从 GREEN 变成 RED**。
16 条禁令我逐条对真实源码验过，13 条命中真实旧链、1 条是已修复行的正确空集，不是凑数的正则；
禁令集本身也钉在 generator 声明表里，契约单改即红。admission 六项齐备、各有独立错误码，
两条侧门（谎报 status、偷翻 TASK_READER）仍然堵着。

N-01 的 branch-cap 语义是机器钉的（删标记、改标记都红），
N-02 的 binding 三个 hash 我逐位复算相符，且门的配对语义被证明是活的——
配 Round 1 拒绝、配 Round 2 通过。Round 2 是独立盲审、`SELF_DECIDED`、明确禁止第三轮，
`implementationAuthority: false`。**没有拿修订字节冒充已被独立审查过。**

13 / 65 / 10 / 5+5 / 9 五个分母与三个状态位零漂移，BP-U06 与动态环境零进入。

唯一的 S 是 manifest 漏收 `WorkspaceIamSummaryReadService.java`：
它被声明为 cap 4 的第四段，其 `accountAndRoleSummary` 方法尚不存在且必须新建
（把今天分开的 `accountCount` + `roleCount` 合并成一条），
而 17 个 owner boundary 里只有这一个是"方法待建且文件未入册"。补两条 surface 即可，
不改 cap、分母或任何 boundary 声明。这是 Round 1 修复时就留下的，与本次修订无关，故不阻断。

**授权边界**：本 GO 仅覆盖 BP-U05 剩余 implementation-facing design 的**本次修订**，
恢复其进入实施准备。**不构成任何 SQL 数值优化成功声明**——三个状态位仍为 `BLOCKED_UNMEASURED`，
这是必须保持的真实状态。不授权 BP-U06、DEV、reset/seed、L2/UAT、部署、仓库控制、
生产 reader 实施，也不替代实施完成后应有的独立实施复核。

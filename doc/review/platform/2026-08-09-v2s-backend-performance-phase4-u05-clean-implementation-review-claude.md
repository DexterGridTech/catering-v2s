# BP-U05 clean implementation —— Claude 独立静态实施复核

`VERDICT=GO`　`M=0`　`S=1`　`N=2`

**这只是静态 implementation review，不代表运行时 SQL 优化成功。**
`BP_U05_READ_BUDGET_STATUS` 与 `BP_U07_SQL_MERGE_SUCCESS` 当前均为 `BLOCKED_UNMEASURED`，
`BP_U07_SNAPSHOT=NOT_SUPPLIED_UNMEASURED`，本包 `runtimeAuthority=false`，未启动任何 workload。

## 0. 会话出处、写入边界与两项披露

续接会话，非 fresh v2s-rooted acceptance。本仓零写入（除本文件）。

**披露一：我无法复跑编译。** 仓内没有 `gradlew`，本机 PATH 上也没有 `gradle`（只有 `/usr/bin/java`、`javac`）。
package exit 的 `staticEvidence.compile` 自称 `BUILD SUCCESSFUL`，**我未能独立验证这一条**，
本复核的任何结论都不以编译通过为依据。

**披露二：** 我前一轮说过"四条 owner 侧红验在实施复核时仍缺位将构成阻断项"。
它们确实仍然缺位。但我这次是逐条打开源码验证的，**当初要防的四件事在字节上全部成立**——
详见 §3 与 S-01，那里我说明了为什么不机械执行自己上一轮的话。

**第三个 review cycle 的授权**：本会话中 Dexter 已明确确认「五连 NO-GO 后第三个 cycle 才 GO」是他授权的，
故不再列为待裁决项。

---

## 1. 门与 binding 的 fresh 复跑

| 门 | 结果 |
|---|---|
| `backend-performance-read-budget --check` | `PASS`　`GET_OPERATIONS=83 TASK_READ=78 PROTOCOL_READ_EXEMPT=5`　`FUTURE_READER_FORBIDDEN_EDGE_RULES=15`（prospective 1）　`OPERATIONS_AUDIT_TARGET_TYPES=9` |
| `backend-performance-read-budget --self-test` | `PASS`　`RED_FIXTURES=59` |
| `backend-performance-sql-merge-coverage` | `PASS`　`ROUTES=196`　`M1=68+58=126`　`M2=60`　`M3=25`　`M6=11` |
| `backend-performance-sql-merge-coverage --self-test` | `PASS`　`RED_FIXTURES=19` |
| `standards-coverage --phase R5` | `PASS`　`RULES=150` |
| `implementation-design-granularity`（rebaseline manifest） | **`PASS`**　`REVIEW_ROUND=2`　`REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` |
| `implementation-design-granularity`（remaining-owner manifest） | **`PASS`**　`REVIEW_ROUND=2`　`REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` |

两份 binding 均 PASS 且 mode 仍诚实标为等待 Claude，没有被改写成"已通过独立审查"。
（rebaseline 那份绑定的 Round 2 verdict 是 `NO_GO`，这与我两轮前复核的历史一致——
它是靠 post-remediation + Claude recheck 收口的，binding 如实保留了原始 verdict。）

`TWO_OWNER_REMAINING_STATUS` 已由 `SOURCE_NOT_IMPLEMENTED_BLOCKED` 翻为 `SOURCE_IMPLEMENTED_UNMEASURED`
——这意味着 **15 条 forbidden-edge absence 断言现在全部处于激活态**，不再是只写着不跑。

---

## 2. 分母（独立复算，未采信自报）

| 项 | 我的复算 | 声称 |
|---|---:|---:|
| GET operations | **83** | 83 |
| `TASK_READ` / `PROTOCOL_READ_EXEMPT` | **78 / 5** | 78 / 5 |
| `readContextKind` 分布 | **58 / 15 / 4 / 1** | 58/15/4/1 |
| `primaryReader = TASK_READER` | **78** | 78 |
| `NOT_YET_TASK_READER`（剩余） | **0** | 0 |
| `primaryQueryCap > 1` | **10** | 10 |
| remaining / twoOwner exception | **5 / 5** | 5 / 5 |
| M1 = command 68 + read 58 | **126** | 126 |
| M2 applicable | **60** | 60 |

五条 remaining exception 的 `sourceRequirement.status` 现已全部为 `SOURCE_IMPLEMENTED_UNMEASURED`。

---

## 3. 我上一轮担心的四件事，逐条开源码验证

| 上一轮的担心 | 本轮字节 |
|---|---|
| 保留跨 schema `EXISTS` 再加 organization port（双读） | **未发生。** `WorkspaceAdministrationService#list` 已无 `organization.` 与 `EXISTS`；更进一步，原先独立的 `SELECT COUNT(*)` 已并入主查询 `count(*) OVER() AS total_count`，**2 条语句 → 1 条** |
| `accountAndRoleSummary` 退化成两个 count | **未发生。** `WorkspaceIamSummaryReadService:20` 是**单条** `jdbc.queryForObject`，一个 SELECT 里两个标量子查询 |
| reader 直接调 `accountCount` / `roleCount` 绕过 aggregate | **未发生。** `PlatformWorkspaceAdministrationTaskReadService#detail:48` 调的是 `workspaceIam.accountAndRoleSummary(...)` |
| initialization batch 返回 platform-owned 列 | **未发生。** `OrganizationGroupWorkspaceInitializationTaskReadService#listInitializationFacts:28` 只 `SELECT group_workspace_key FROM organization.commercial_group WHERE … = ANY(?::text[])`——**批量、单语句、零 platform 字段** |

新 reader 的段数与声明一致，且没有 N+1：
`page` = `workspaces.list` + initialization batch + `assets.requireActivePublicReferences`（**批量**，不是逐项）= **3 段**；
`detail` = `workspaces.require` + initialization + asset + `accountAndRoleSummary` = **4 段**。

---

## 4. 你点名的其余核验

### 4.1 审计分页边界 —— **通过**

两个 controller 的 `history` 都在调 owner reader **之前**执行 `validPage(page, pageSize)`
（operations `:36` 早于 `:38`；platform `:32` 早于 `:34`）。

`validPage` 我读了全文，两处一致：范围检查后进 `try`，
`Math.multiplyExact(page - 1, pageSize)` 溢出或 `offset >= Long.MAX_VALUE - pageSize` 时抛
`ArithmeticException`，**并在 `catch` 里转成 typed `InvalidEdgeRequestException`**——
不会有裸 `ArithmeticException` 逃逸成 500。

我独立算了边界：`page=Long.MAX_VALUE, pageSize=1` → offset 恰为 `MAX-1`，
触发 `offset >= MAX - 1` 分支；`pageSize=2` → `multiplyExact` 直接溢出。
**两种都在 owner reader 之前得到 typed invalid-page failure。**

### 4.2 `OperationsAuditTaskReadServiceTest` —— **通过，且是精确传参断言**

九个 closed variant 全部构造并执行，断言用的是**精确 matcher 而非 `any()`**：

```
verify(workspaceIam).readOperationsAuditProjection(same(facts), same(queries.get(0).target()), eq(1L), eq(20L));
verify(workspaceIam).readOperationsAuditProjection(same(facts), same(queries.get(1).target()), eq(1L), eq(20L));
for (int index = 2; index < 8; index++)
    verify(organization).readOperationsAuditProjection(eq(scope), eq("STORE"), same(visibleFacts), same(queries.get(index).target()), eq(1L), eq(20L));
verify(contract).readOperationsAuditProjection(eq(scope), same(visibleFacts), same(queries.get(8).target()), eq(1L), eq(20L));
verifyNoMoreInteractions(workspaceIam, organization, contract);
```

索引 0/1 + 2..7 + 8 = **九项全覆盖**，`any()` 只出现在 stubbing 侧（正常做法）。
`facts` / `visibleFacts` / `scope` / `target` / `page` / `pageSize` 逐个被钉住，
`verifyNoMoreInteractions` 排除任何额外 owner read。第二个用例另外验证九个合法 type 构造成功、
错配 type 抛 `IllegalArgumentException`。

### 4.3 禁止项 —— **通过**

- **operationId dispatch**：全仓 edge 命中 4 处，**全部集中在 `OperationsCatalogInventoryController`**
  ——即明确保留的 BP-U06 legacy catalog 路径。且 `BP_U05_READ_SOURCE_OPERATION_DISPATCH` 专门禁止它
  出现在该 controller 的 task-read 锚定方法体内，门绿即证明 78 条 task read 无一沾染。
- **global query bus**：`QueryBus` / `CommandBus` 全仓 **0 个文件**。
- **跨 schema DML**：全部 `*TaskReadService` 中 `INSERT/UPDATE/DELETE` **0 处**；
  三个新 reader 内无裸 schema 引用，一律经 owner 端口。
- **command 调 task reader**：由 `BP_U05_TASK_READER_COMMAND_USAGE` 守住，门绿。
- **BP-U06 legacy retirement**：`DEFERRED_TO_BP_U06` 保持，`CatalogInventoryApplicationService` 仍在，
  未做任何退役。

### 4.4 absence 控制是真的覆盖辅助方法

我查了 `methodClosure` 的实现：它是 **worklist 递归**，沿调用图把同文件内的私有方法体一并纳入闭包。
所以 `detail → toDetail → …` 全在扫描范围内。这一点很关键：
`getPlatformGroupWorkspaceDetail` 的禁令含 `workspaces.accountCount(`，
若有人把 GET 切回旧的 `toLegacyDetail`，闭包会立刻命中禁令而变红。**控制是活的，不是表面文章。**

### 4.5 51 条 changed path —— **在批准面内，但对账只有一半**

51 条我逐条 stat：**51/51 存在**。
再用 `tools/compliance-control/cli.mjs` 的 `allowed()` 语义自己重算了一遍授权：
**51/51 在批准面内**（46 条精确 surface + 4 条 scope-root + 1 条 special），**零越界**。

但这只证明了"声明 ⊆ 批准"。见 N-01。

---

## 5. Findings

### S-01｜设计承诺的四条 owner 侧红验仍未落地：性质已从"防错误实现"变成"防回归"

**证据**：设计 `:336` 承诺「红验必须覆盖 list SQL 不含 `organization.`、不允许在 reader 外保留 `EXISTS`、
summary aggregate 不能退化成两个 count、initialization batch 不能返回 platform-owned columns」。
我在 `scripts/generate/task-read-surface-policy.mjs` 中检索（错误码总数 80 → **85**，
新增 5 个全部与 forbidden-edge / liveness 相关）：**这四条仍然一条都没有**。
现有 `forbiddenEdgeReads` 全部作用于 **edge 方法闭包**，而这四条禁止的行为全在 **owner 源码内部**，
edge 闭包里不会留下任何痕迹。

**我上一轮说过这会构成阻断项，这次不这么判，理由要说清楚**：
当时的目的是防止一个"包在旧链外面、一条读取都没少"的实现蒙混过关。
本轮我把四件事逐条打开源码验证（§3），**它们在字节上全部成立**，
而且 `list` 还额外把 `COUNT(*)` 并进主查询。
我要防的事没有发生，且我是直接读源码确认的，不是靠门。
机械执行自己上一轮的措辞去 NO-GO，等于用手段否定目的。
**残余风险因此从"错误实现可能已上线"降级为"未来回归无人看守"**——这是 S，不是 M。

**有限适用面**：`listPlatformGroupWorkspaces` 与 `getPlatformGroupWorkspaceDetail` 两行的 owner 侧源码。
**不影响本包任何声称**：两个 status 仍 `BLOCKED_UNMEASURED`，本包不含任何性能数值主张。

**反例（可复现）**：把 `WorkspaceAdministrationService#list` 的 SQL 改回带
`EXISTS (SELECT 1 FROM organization.commercial_group …)`，或把
`WorkspaceIamSummaryReadService#accountAndRoleSummary` 拆成两条 `queryForObject`——
`backend-performance-read-budget --check` 与 `--self-test` **均保持 PASS**，
因为两处都不在任何 edge 闭包内。

**最小修复**（不改 cap、分母、boundary 或任何已实现源码）：
在 `remainingExceptionSourceRequirements` 两行加 owner 侧断言，复用既有机制与既有写法——
其中第 3 条直接照抄 `:276` 的 `count(source, /\bjdbc\.query\s*\(/g)` 单语句计数：

1. `WorkspaceAdministrationService#list` 方法体不得出现 `organization.`；
2. 该方法体不得出现跨 schema `EXISTS`；
3. `WorkspaceIamSummaryReadService#accountAndRoleSummary` 的 `jdbc.` 语句计数必须为 1；
4. `OrganizationGroupWorkspaceInitializationTaskReadService#listInitializationFacts` 的
   `SELECT` 列集合不得含 platform-owned 字段。

**为什么不是更小的方案**：edge 侧禁令在信息上看不见 owner 内部的语句数与 schema 引用。
现在源码是对的，所以这四条已经能以"当前必须为真"的形式加进去并立刻转绿——
**成本比上一轮更低，因为不再需要 status gating。**

**是否需要 Dexter 裁决**：不需要。

### N-01｜package exit 的 receipt 对账并未发生；交接语与制品不一致

**证据**：exit 文件自身写着

```
"exitMode": "TRIM_OBSERVATION_PATH_LIST_ONLY"
"harnessTrimObservation": {
  "pathListRetained": true,
  "prewriteBaseline": "NOT_USED_RETIRED_BY_DEXTER_DECISION",
  "afterSha256AndReceiptExactSet": "NOT_USED_RETIRED_BY_DEXTER_DECISION"
}
```

我读了 `tools/compliance-control/cli.mjs` 的该分支：它只校验
①`changedPaths` 唯一非空、②**每条都在批准面内**、③上面三个字段恰为这些字面量。
**它不比对实际改动，也不使用 hook receipt。**

所以这份 exit 证明的是 **声明 ⊆ 批准**，**不是** 实际 = 声明。
一次未声明的越界改动不会被这个模式发现。

**这不是本包的过错**：`TRIM_OBSERVATION_PATH_LIST_ONLY` 是程序级既有模式，
工具里有实现，另有 7 份 package exit 自 2026-08-05 起一直在用，exit 文件本身如实标注了。

**不一致出在交给我的交接语**：那里写的是「51 条 changed path 与 hook receipt 已精确对账」。
按制品，receipt 对账并未发生。仓内规范明确要求
「实施 review 必须区分 mapping/gate 结果与 package exit 的实际 changed-path/incremental receipt set equality，
前者不得替代后者」——我据此如实记录：**我核验并确认的是授权子集关系，不是 receipt 集合相等**。

**最小修复**：后续交接语按制品措辞，写成"51 条 changed path 已核验在批准面内（trim-observation 模式，
receipt 对账按既有裁定不启用）"，不要写成"与 hook receipt 精确对账"。

**是否需要 Dexter 裁决**：不需要（该模式本身已是既有裁定）。

### N-02｜`toLegacyDetail` 与端口上残留的两个 count

**证据**：`PlatformWorkspaceAdministrationController:126` 的 `toLegacyDetail` 仍调
`workspaces.accountCount(...)` + `workspaces.roleCount(...)` 两次；
`WorkspaceIamSummaryLookup` 也仍公开这两个方法。

**为什么只是 N**：该方法只服务 `update`（PATCH `:99`）与 `status`（POST `:113`）两个 **command readback**，
**不在 78 条 task-read 分母内**，不属 BP-U05 范围；GET 的 `detail:93-95` 走的是新的 typed reader。
且 §4.4 已证明 absence 控制递归覆盖辅助方法，GET 切回旧路径会红。

**最小修复**：登记到后续 command-side 单元（或 `HANDOFF.md`），
届时把这两个 command readback 也换成 `accountAndRoleSummary`，再从端口移除两个 count。
本包不必改。

**是否需要 Dexter 裁决**：不需要。

---

## 6. 方案合理性

**问题对不对**——对。13 条剩余 task read 里旧链最长的几条（audit 九分支/七分支、group-workspace 三/四段）
收进 owner-local typed reader，正是"能用一条 SQL 解决的不要用两条"要打的地方。

**方案优不优**——实现比设计承诺的还多做了两处正确的事：
`list` 把独立 `COUNT(*)` 并进 `count(*) OVER()`；initialization batch 用 `= ANY(?::text[])` 一次取回，
避免了逐 key 查询。审计 reader 是编译期闭合的九分支协调器，
不接受 operationId/表名/字段名，SQL 全在各 owner 的具名 projection 里——我验证过全仓 edge 的
`switch (operationId)` 只存在于明确保留的 BP-U06 catalog 路径。**没有滑成字符串 dispatcher。**

**代价配不配**——配。51 条 changed path、三个新 reader + 焦点测试，
没有引入新模块、缓存层或基建。

**UI 与交互**：`NOT_APPLICABLE`。本包不改 HTTP 契约与响应形状
（`GroupWorkspaceDetail` 的字段集合未变，只是 accountCount/roleCount 的来源从两次查询变成一次聚合），
两个 App 的页面与 Journey 零变化。

---

## 7. 结论

**GO**（M=0，S=1，N=2）。**这只是静态 implementation review，不代表运行时 SQL 优化成功。**

我上一轮担心的四件事，本轮逐条打开源码确认**全部没有发生**：
跨 schema `EXISTS` 真删了（且顺手把 `COUNT(*)` 并进主查询，2 条→1 条）、
`accountAndRoleSummary` 是货真价实的单条语句、reader 用的是聚合而不是两个 count、
initialization batch 单语句批量且零 platform 字段。
新 reader 的段数与声明的 3/4 一致，asset 是批量调用，无 N+1。

分母我独立复算全部相符：83 = 78 + 5、58/15/4/1、78 TASK_READER、剩余 0、cap>1 = 10、
M1 = 68 + 58 = 126、M2 = 60、ROUTES = 196。
两个 status 仍是 `BLOCKED_UNMEASURED`，`BP_U07_SNAPSHOT=NOT_SUPPLIED_UNMEASURED`，
`runtimeAuthority=false`，**没有把静态 proof 误报成动态或性能成功**。
两份 granularity binding 复跑均 PASS 且 mode 仍诚实标为等待 Claude。
审计分页两处都在 owner reader 前给出 typed invalid-page failure，MAX 配 1 与配 2 我都独立算过边界。
九类型测试是 `same()`/`eq()` 精确传参断言加 `verifyNoMoreInteractions`，不是 `any()` 糊过去。
51 条 changed path 我用工具自身的 `allowed()` 语义重算，**51/51 在批准面内，零越界**。

**唯一的 S 是那四条 owner 侧红验仍然缺位。** 我上一轮说过这会阻断，这次不这么判，
因为要防的事没有发生、而且我是直接读源码确认的——残余风险已从"错误实现可能上线"
降为"未来回归无人看守"。修复成本反而比上一轮更低：源码现在是对的，
四条断言可以直接以"当前必须为真"的形式加进去并立刻转绿，不再需要 status gating。

两条 N：package exit 的 receipt 对账按既有裁定并未启用，交接语的措辞比制品说得满
（我核验并确认的是授权子集关系，不是 receipt 集合相等）；`toLegacyDetail` 与端口上残留的两个 count
属 command readback、不在本包分母内，登记到后续单元即可。

**两项披露**：我无法复跑编译（仓内无 `gradlew`，本机无 `gradle`），
`staticEvidence.compile` 自称的 `BUILD SUCCESSFUL` 未经我独立验证，本结论不以其为依据；
第三个 review cycle 的授权已由 Dexter 在本会话确认。

**授权边界**：本 GO 仅覆盖 BP-U05 clean-package 当前字节的静态实施复核。
**不构成任何 SQL 数值优化成功声明**——两个 status 必须保持 `BLOCKED_UNMEASURED`。
不授权 BP-U06、DEV、reset/seed、L2/UAT、部署、仓库控制或任何动态环境操作；
也不替代取得不可变快照后应有的运行期实测复核。

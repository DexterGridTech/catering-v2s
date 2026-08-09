# 后台性能重构 implementation-facing 详设 —— Claude 独立复核

`VERDICT=NO-GO`　`M=4`　`S=1`　`N=4`　（S-01 已由 Dexter 2026-08-09 裁定撤回）

评审对象：`doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md`
（本会话复算 sha256 = `d8eb3f86fcc94b617bdba8efda0d58f9aaf4b7bd4e7ef35f6cd69cad2968b314`，与 manifest 声明一致）

## 0. 会话出处与独立性声明（不得当作 fresh acceptance）

1. 本会话**不是 fresh v2s-rooted 会话**，是同一会话的续接（上下文已被摘要）。
2. **本次评审的主要冻结输入之一（`…-backend-performance-refactor-plan-claude.md`）由我在本会话内产出。**
   我是在复核"Codex 的详设是否忠实承载了我自己的方案"，这一层不构成独立性。
   为对冲，本报告的每一条数字结论都不引用我方案里的自报值，一律用
   `.runtime/r5/evidence/db-operations.jsonl` 与当前源码字节在本会话内重算，并给出复算方法。
3. 所有 registry 计数、hash、门结果均在本会话 fresh 复跑，未采信任何文档自报值。
4. 本仓在本次评审期间零写入，除本文件。

---

## 1. 方案合理性判断（先于闭环核验）

### 1.1 问题对不对——**部分不对**

Dexter 本轮给的判据是一句话：**"DB 预算只是为了解决效率问题，能用一条 SQL 解决的就不要用两条。"**

详设第 21 行把目标定义为"可持续的**正确性不降级的往返治理能力**：处理职责可静态对账、命令授权事实只在同一事务内解析一次、……每条性能结论都能回到受控 workload"。

这三件都是对的**手段**，但没有一件是**结果**。通读全文，详设对"少几条 SQL"给出的唯一可验收判据是：

- 命令侧（line 219/220）：`初始均 UNMEASURED_BLOCKS_OPTIMIZATION；…再比较"不得回归"`
- 命令侧（line 91）：`不以预计削减量或 seed 平均值判定`
- 读侧（line 85）：78 条 task read 一律 `OperationBudget.of(3)`，超标"逐 operation 列出理由"

命令侧只要求**不变坏**（这一条与 Dexter 已接受的 authorization decision §1 一致，我不作为 finding）；读侧要求达标，但本会话实测**10/10 条被语料覆盖的 B 类 GET 全部超标 4–16 倍**，而详设对"怎么降下来"零设计，只留了一条无上限的豁免子句（见 M-02）。

结果是：三个批次全部做完，最坏情况完全合法——**代码结构变好、门变多、每个请求的 SQL 条数几乎没变，而所有门都是绿的。**

### 1.2 方案优不优——**结构部分优，性能部分缺体**

真正会产生"少一条 SQL"的项，方案 §4.1 已逐条定位并给了收益量级。详设对它们的承载情况：

| 项 | 方案给的收益 | 详设承载 | 结论 |
|---|---|---|---|
| C1 前置链 3 事务 → 1 | 71–134ms/请求 | §5.1 明确迁入 command 事务首批读 | **已承载，真实收益** |
| C2 会话读四查合一 | 74,431ms（8.6%，最大单笔） | 全文 0 命中 | **缺失（M-03）** |
| C3 capability/scope 合一 | ≈17,600ms（2.0%） | 全文 0 命中 | **缺失（M-03）** |
| C4 catalog 保存 | 上限 6.7%，待逐分支对账 | line 195/220 五分支 | 已承载 |
| C5 满分母去重 | 40,676ms（4.7%） | line 221 判为"无 command"→落空 | **误判（M-01）** |
| C6 字典 N→1 | 0.42%，随条目放大 | line 222/229 owner-local snapshot | 已承载 |

**承载了 C1/C4/C6，丢了 C2/C3，错判了 C5。**丢掉与错判的三项，按方案自己的口径合计约 15.3%，是可承诺区间的一半以上。

而本包最大的成本项——196 个 operation 全量迁 handler——服务的是**可维护性与编译期对账**，不是性能。这一项我在方案里要过，现在仍认为该做；但它不产生一条 SQL 的削减，不能替代 C2/C3/C5。

### 1.3 代价配不配——**当前配比失衡**

成本集中在最不产生性能的部分（196 迁移、四类 context、三份新 registry、四道新门），收益最高的三项（C2/C3/C5）成本很小却没做。
把 C2/C3 补进 BP-U03、把 C5 按 C6 同构修正，是**加不到一页纸的设计量**，却是本包"到底解决了没有"的分水岭。

### 1.4 UI 与交互

`NOT_APPLICABLE`。理由：本包不新增 UI Journey、HTTP operation 或业务字段；两个 app 只消费既有 operation。详设 §9 已建立行为变更登记表，我核对其现有四行方向正确（但缺一行，见 N-03）。

---

## 2. Findings

标注约定：`[仓内事实]` 本会话对当前字节复算所得；`[实测]` 本会话对 `.runtime/r5/evidence/db-operations.jsonl` 独立聚合所得；`[推论]` 由前两者推导；`[需 Dexter 裁决]` 涉及产品/范围。

---

### M-01｜C5 被判为"无 command"，与冻结问题描述和实测证据直接矛盾

**位置**：详设 line 221（BP-U04 影响表 C5 行）

> `| C5 visibility deduplication | **无 command**；其实际 consumer 是任务型 read | 不得写入 command baseline | read budget/有界 task workload 单独证明 |`

**[仓内事实]** `OrganizationVisibilityService` 的全部生产调用点都在 `WorkspaceAuthenticationService`：`:112`（`selectContext`）、`:137`（`selectDataNode`）、`:212`（`sessionEntry`）、`:265`、`:279`、`:287`。
按两份 generated registry 复算，`selectOperationsWorkspaceSessionContext` 与 `selectOperationsWorkspaceSessionDataNode` 均为 `method=POST`、`consumerFaces=["operations-admin"]`、`owner=workspace-iam` —— **它们在 75 条命令集合内，也在 74 条数值 baseline 行内。**

**[仓内事实]** 代码路径：`selectDataNode:137` 先 `listVisibleDataNodeCandidates` 做校验 → `UPDATE workspace_session` → `sessionEntry(rawToken)` 再次 `listVisibleDataNodeCandidates:212` → `scopeContext:287` → `describeScopeContext` → `hierarchy:169` + `storeContext:187`。
即 `organization.organization_node` 在**一次写命令内被全表扫 3 次**，`organization.store` 被扫 2 次 + 1 次单行。

**[实测]** `selectOperationsWorkspaceSessionDataNode`，5 个请求，**39.0 DB 操作/请求**（`OWNER_WRITE=28.0`、`SESSION=11.0`）。逐 callSite 每请求次数：
`listVisibleDataNodeCandidates:97` **×3.0**、`:116` **×3.0**、`:142` **×3.0**、`hierarchy:169` **×2.0**、`requireAssignment:298` ×2.0。

**[仓内事实]** 冻结输入 `2026-08-08-v2s-http-performance-problem-description-codex.md:44` 已写明：
「session 选择重复可见范围枚举 | `selectOperationsWorkspaceSessionDataNode` 和非 group assignment 的 `selectOperationsWorkspaceSessionContext`：先枚举候选用于验证，更新后又为 response 枚举。」
同文件 line 19 把该 operation 列为四条头部样本之一（28–33 DB 操作、0.9–1.3s）。

**[推论]** 这是 Round 2 在紧邻下一行（C6）抓到的**同一类错误**——独立审查原话："wrongly declared task-read-only although its N+1 path is returned from a command readback"。作者修了 C6，把 C5 原样留在上一行。

**影响面**：C5（方案口径 40,676ms / 4.7%，第二大项）落不进任何分母：读侧 B=78 只含 GET；命令侧被本行显式禁止（`不得写入 command baseline`，且 line 225 把"C5 被写入 command 表"定为红）。C5 因此**既无门也无设计**。

**最小修复**（不扩大范围）：把 C5 行改成与 C6 同构——
命令面写明 `selectOperationsWorkspaceSessionContext`、`selectOperationsWorkspaceSessionDataNode`（二者已在 74 条 normal rows 内，**不新增数值行**，79 不变）；读面写明 `getOperationsWorkspaceSessionEntry`；处置为"同一 owner invocation 内构造一次可见范围快照，供校验与 readback 复用"，并把 line 225 的"C5 被写入 command 表即红"改为"C5 新增第 80 条数值行即红"。
**为什么不是更小的方案**：只改文字不改分类的话，C5 仍然落在"read budget"这个不含 POST 的分母里，等于没修。

---

### M-02｜读侧预算取了 B.6.6 的数字，没取它的构成与机制；实测 78 条全部不可达

**位置**：详设 line 85、line 137；BP-U05（line 227-229）

**[仓内事实]** 权威条款是 `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md` **B.6.6**，原文给的不只是数字：

> 每个 task read endpoint ≤3（**上下文解析 1 + 主查询 1 + 可选计数 1**）……
> **会话上下文每请求解析一次，授权判定基于已载入上下文内存完成，祖先/范围校验以 EXISTS 并入主语句。**
> owner 纯动作判定是进程内计算，不增加 DB 次数。预算以 `databaseOperationCount` 断言进测试。

**[仓内事实]** 详设**全文未引用该 manifest**，也未引用服务形态决策 §3.5；它只引用两份文档（line 19：问题描述、Claude 方案）。它取了"3"，没取"上下文解析 1"，更没取后面那三句**机制**。

**[实测]** 语料覆盖的 B 类 GET 共 10 条，**10/10 超标**，中位 12–49：

| operationId | 请求数 | DB/请求 | 构成 |
|---|---:|---:|---|
| `getOperationsCatalogDictionary` | 4 | **49.0** | SESSION 12.0 + OWNER_READ 37.0 |
| `getOperationsCatalogItem` | 194 | **24.0** | SESSION 12.0 + OWNER_READ 12.0 |
| `getOperationsInventoryTargets` | 2 | 23.0 | — |
| `getOperationsCatalogItems` | 2 | 23.0 | — |
| `getWorkspaceAccounts` | 6 | 22.3 | SESSION 4.0 + OWNER_READ 18.3 |
| `getOperationsCatalogNavigation` | 4 | 22.0 | SESSION 12.0 + OWNER_READ 10.0 |
| `getOperationsCatalogWorkbenchContext` | 2 | 21.5 | — |
| `getOperationsProductionTags` | 2 | 20.0 | — |
| `getOperationsWorkspaceSessionEntry` | 3 | 19.7 | OWNER_READ 19.7 |
| `getExtensionDefinition` | 8 | 12.0 | — |

（上表即语料覆盖的全部 10 条 B 类 operation，无遗漏；另两条被豁免的 GET 为 `getOperationsWorkspaceLoginEntry` 9.7、`getCurrentPlatformSession` 4.0。剩余 68 条 B 类 operation 本轮语料未触达，按问题描述规则只能标 `UNMEASURED`，不得推定达标。）

**[实测]** `getOperationsCatalogItem` 的 `SESSION=12.0` 逐 callSite 分解（194 个请求）：
`session`（3 个连接作用域）3.0 ／ `require:244` 1.0 ／ `loadSession:162` 1.0 ／ `WorkspaceRoleService#require:145` 1.0 ／ `requireAssignment:298` 1.0 ／ `listVisibleDataNodeCandidates:97` 1.0 ／ `:116` 1.0 ／ `hierarchy:169` 1.0 ／ `headCompanyContext:203` 1.0 ／ `storeContext:187` 0.7 ／ `:142` 0.3。

**即：B.6.6 给"上下文解析"的预算是 1，今天是 12。**

**[仓内事实]** 详设 line 137 明确 `ReadContext` "不携带 capability grant"，且"read handler 在事务外执行"；§5.1 的 resolver 只服务 command。**全文没有一处说读侧授权在哪做、代价几何、如何降到 1。**

**[推论]** 还有一个未冻结的口径：详设没说 `OperationBudget` 的计量作用域是 request-scope 还是 handler-scope。
按 B.6.6 与 `databaseOperationCount` 定义应是 request-scope（则 24.0 / 49.0 对 3）；即使按 handler-scope 只计 OWNER_READ，`getOperationsCatalogItem` 仍是 12.0（4×）、`getOperationsCatalogDictionary` 是 37.0（12×）。**两种口径都不可达。**而 BP-U01 的职责恰恰是"冻结 measurement schema/basis"，却没冻结这一条——它是唯一一个要门住 78 条 operation 的数字。

**影响面**：BP-U05 的核心交付（78 × `OperationBudget.of(3)`）在实施第一天就会退化为 78 条豁免；门形式上绿，读侧一条 SQL 也没少。这正是 Dexter 本轮点名要防的形态。

**最小修复**：
1. BP-U01 增一句：冻结 `OperationBudget` 的 measurement scope（建议 request-scope，与 `databaseOperationCount`、B.6.6 一致）。
2. BP-U05 增一段读侧上下文解析设计，把 B.6.6 的三句机制逐句落到具体落点（会话上下文每请求一次；授权判定在已载入上下文的内存中完成；祖先/范围校验以 `EXISTS` 并入主语句）。
3. 豁免子句给上限（例如"本轮豁免不超过 N 条且逐条列到期复核"），否则它是无限逃逸口。

---

### M-03｜C2/C3——方案里最大的两项 SQL 合并，详设零内容

**位置**：详设 §5.1（line 143-154）、BP-U04 line 219

**[仓内事实]** 方案 §4.1 给的落点，本会话对当前字节逐个复核**全部存在**：
C2 四处 —— `WorkspaceAuthenticationService:244`（session 行）、`:162`（`role_id`）、`:298`（assignment JOIN role）、`WorkspaceRoleService:145`（role + page/capability keys）；
C3 两处 —— `WorkspaceCapabilityScopeResolver:123`（`assignments.requireActiveScope`）、`:180`（`jdbc.query` capability 判定）。

**[仓内事实]** 详设全文对这四个类的命中数：
`WorkspaceAuthenticationService` = **0**、`WorkspaceRoleService` = **0**、`WorkspaceCapabilityScopeResolver` = **0**、`OrganizationVisibilityService` = **0**。

**[仓内事实]** §5.1 line 154 把前置写成：
「fresh session → active assignment → ENABLED role 与 requirement/capability → organization scope/task-path judgment → opaque owner grant → owner-specific scope judgment」
—— 这是**顺序**，不是**合并**。配合 line 219 唯一判据"不得回归"，实施方原样保留 6 步、9–10 条查询，**全门通过**。

**[实测·按 JDBC kind 分账]** 把"操作数"拆成**真实 SQL** 与**事务/连接控制**后，C1 与 C2/C3 的分工是可量化的：

| operation | 请求数 | DB 总耗时/请求（中位） | 真实 SQL/请求 | 事务作用域/请求 | QUERY 耗时占比 | COMMIT 耗时占比 | GET_CONNECTION + SET_AUTO_COMMIT |
|---|---:|---:|---:|---:|---:|---:|---:|
| `getOperationsCatalogItem` | 194 | 716ms | **15.0**（40.6ms/条） | 3 | 609ms / **86%** | 100ms / 14% | **0ms** |
| `saveOperationsCatalogItem` | 191 | 1442ms | **31.1**（QUERY 28.3 + UPDATE 2.8） | 6 | 1149ms / **81%** | 170ms / 12% | **0ms** |

关键更正（相对我前一轮口述）：`requireCatalogBrand` / `requireActiveScope` / `requireTaskPath` / `isScopeAllowed` / `session` 的 **×3.0 是事务作用域条目，不是 SQL 执行次数**——前置的 SQL 每条实际只跑 1.0 次（`WorkspaceSessionRequestCache` 吸收了重复读）。因此：

- **C1（把 6 个事务并成 1）只消除事务开销**：save 省 5×COMMIT(28.4ms) + 5×BEGIN 溢价(≈28ms) ≈ **282ms / 1442ms ≈ 20%**；read 省 2 组 ≈ **123ms / 716ms ≈ 17%**。**前置的 SQL 一条不少。**
- **要少发 SQL 只能靠 C2/C3/C5**：read 的 15 条里，C2 的四条（`:244`/`:162`/`:145`/`:298`）合一省 3、C5 的两组重复（`:169`↔`:97`、`:187`↔`:116`）省 1.7；save 的 31.1 条里 C2 省 3、C3 省 1、C5 省 1.7。按 40.6ms/条计，这部分**单独价值 190–360ms**，与 C1 同量级甚至更大。

**结论**：C1 已承载，拿到约五分之一；**耗时的 81–86% 长在 SQL 条数上，而管这一段的 C2/C3 在详设里没有承载体。**

**[仓内事实]** 一并丢失的还有方案 §4.1.1 给 C2 的**三格判定表**与**四条不可省**：
`LEFT JOIN workspace_role r … AND r.status='ENABLED'` 不能漏；谓词取 `:298` 的强谓词而非 `:162` 的弱谓词；`password_change_required` 判定必须先于 assignment 缺失的解释；`page_access_keys`/`capability_keys` 必须复用 `WorkspaceRoleService:174-211` 同一 mapper。
**第一条漏掉 = DISABLED 角色的 capability 进 readback，是安全级错误，不是性能细节。**

**影响面**：本包承诺的收益里最大的两笔没有设计承载；且若实施方自行合并，缺了上述四条约束会引入授权放宽。

**最小修复**：BP-U03 增加 C2、C3 两个具名合并段：合并后的语句形态、三格判定表、四条不可省逐条抄入、以及 `EmptyResultDataAccessException`→500 改 401 的行为变更登记（见 N-03）。

---

### M-04｜B.6 的既有门是关键词扫描、不在 `verify` 链、且当前 FAIL；详设的门 disposition 未触及

**[仓内事实]** `contracts/policy/standards-coverage-matrix.json`：`B.6.N01`、`B.6.N03`、`B.6.N06`、`B.3.N07`、`B.3.N08` 的 enforcement 全部是
`{"kind":"GATE","ref":"scripts/check/database-operation-budget","status":"ACTIVE","enforcementPhase":"R4"}`。
其中 `B.6.N06` 的 memoryRefs 还包含 `project-memory/decisions/http-crud-efficiency-design-redlines.md#PER_OPERATION_DESIGN_CONTRACT` —— 正是详设 §11 指定的 prevention destination。

**[仓内事实]** 该门的全部实现（`tools/verify-gates/cli.mjs:527`）：

```js
function budget(base = root) {
  const files = …java files…;
  assertNoMatch(files, /SELECT\s+\*/i, "R4_DATABASE_SELECT_STAR", base);
  assertNoMatch(files, /\.query\([^\n]*\)\s*;\s*(?:for|while)\s*\(/i, "R4_DATABASE_LOOP_IO", base);
  process.stdout.write("R4_DATABASE_OPERATION_BUDGET=PASS\n");
}
```

**它不读 `databaseOperationCount`，不读任何预算声明，不计任何数。**两条字面正则通过就无条件打印 PASS。
第二条正则要求查询与循环字面相邻，因此**抓不到** `CatalogOwnerService:531`（在 `jdbc.query` 的 lambda 内逐行调 `dictionaryReferenced:1190`）这类真实 N+1 —— C6 能活到今天的机器原因就在这里。

**[仓内事实]** `scripts/verify`（`tools/verify-gates/verify.mjs`）实际只跑 10 个 `scripts/check/*`：
`openapi-contracts`、`contract-face`、`edge-codegen`、`retirement`、`backend-boundaries`、`database-boundaries`、`flyway-layout`、`frontend-architecture`、`affected-l2`、`standards-coverage`。
**`database-operation-budget` 不在其中。**（`scripts/check` 下共 47 项，其中 44 个可执行门。）

**[本会话 fresh 复跑]**
`scripts/check/database-operation-budget` → `R4_GATE=FAIL / REASON=R4_DATABASE_SELECT_STAR:…/DatabaseOperationTrackerTest.java`
`scripts/check/code-layout` → `CODE_LAYOUT=FAIL / REASON=BACKEND_APP_ROOT_NOT_ALLOWED:…/app/application,REPOSITORY_ROOT_DIRECTORY_NOT_ALLOWED:results`（同样不在 verify 链上；两个目录本会话确认仍存在）
`scripts/check/standards-coverage --phase R5` → `PASS / RULES=150`（它只校验映射存在，不校验被映射的门是否真的执行该规则、是否在链上、是否绿）

**[推论]** 这不是孤例：本包直接相关的两个门都是"红 + 不在链上"。因此 BP-U01 的"44 gate disposition"不能是形式动作，它必须至少回答"哪些门当前是红的、哪些不在 `scripts/verify` 上、哪些的 enforcement 映射名不副实"。

**[推论]** 这就是"为什么这些问题能长期存在"的机器答案：**B.6 的整个性能规则族被映射到一个不测量它的关键词扫描器上，该扫描器不在 verify 链上，且当前是红的。**
manifest D.3 门纪律原文："`self-test` 展示未接线能力是最高危假保障，新门验收必查 `run()` 实际执行面"；以及"机器门当前红时，任何以'门全绿'为前提的声明不成立"。

**[仓内事实]** 详设 BP-U01（line 188）把"44 gate disposition"列为交付物，但全文未点名这个门、未登记它的 FAIL、未指出 `B.6.N06` 的 enforcement 映射是假的，并在其之上再造一套 `OperationBudget` 机制。

**影响面**：本包做完会有两套"预算门"，而权威规则仍映射在关键词扫描器上；同时 `standards-coverage` 会继续为这个映射打 PASS。

**最小修复**：BP-U01 的门 disposition 必须逐条给出该门的结论——修（改成真读计数）或退役并把 `B.6.N01/N03/N06`、`B.3.N07/N08` 改映射到新门；新门必须进 `scripts/verify`；当前 FAIL 单独登记。

---

### ~~S-01~~｜BOM 批量化 —— **本条已撤回（Dexter 2026-08-09 裁定）**

我原以为详设把方案 §5 已否决的 BOM 批量化重新列为必做、还建了常驻门，是为 0.034% 付永久维护成本。
我当时明确标注：该判断的前提是 **DEV seed 的 BOM 基数（max=3、均值 1.25）能代表真实业务**，
而这是产品事实、我从仓内判不出来，因此标 `DEXTER_DECISION`。

**Dexter 裁定：真实经营的 BOM 组分数远大于 seed 造数，它是真实 N+1，必须批量化。**

因此：**详设 §7 line 199 与 §8 的 `BOM rows` 门分母予以保留，本条 finding 撤回。**
方案 §5「明确不做」中的对应条目已同步撤回，并作为 **SQL-M6** 纳入新增批次（方案 §14.3）。
附带的验收要求：seed 的 max=3 不足以证明该项，**必须另建 BOM 行数 ≥10 的具名 fixture**。

**这条留作方法论记录**：用不代表性的样本否决一个真实缺陷，和用样本推定全接口达标，是同一类错误的两个方向。

### S-02｜`CommandExecutionContextResolver.resolve` 的 scope 类型参数不受约束

**位置**：详设 §5.1 line 146-148

```java
CommandExecutionContextResolver.resolve(CommandInvocation invocation)
  -> ExecutionContext<S>
```

**[推论]** `S` 不出现在任何参数里，只能由调用点推断，实现内部必然是 unchecked cast。

**先说已关闭的部分**：BP-M-001 的原始关切——workspace / platform / public **kind** 分区——本会话核验为**已真正关闭**：详设 §4 给出四个互不相通的 binding interface，每 operation 一个 concrete typed method，参数写死唯一 context 类型，跨 kind 传参无可调用 overload，编译失败成立。

**残留的**是 workspace 内部 `S` 的安全性。`CatalogAuthorizationScope` 携带 `brandRef` 与 `copySourceDataNodeId`（§5.3），取错即授权缺陷，而这一层退化为"生成器纪律"，不是编译期保证——与详设 line 131 "错误 kind 没有可调用 overload，必须编译失败"的措辞不完全相符。

**最小修复**：`resolve(CommandInvocation, OwnerScopeKind<S>)`，`OwnerScopeKind<S>` 由 `OperationDescriptor` 静态给出；或每 owner 一个返回具体类型的 resolver 方法。

---

### N-01｜"closed switch"与"无共同 callable 入口"在命令侧不能同时成立

§3.1 line 71 说输出"以 closed `switch` 直接调用构造器注入的 owner-local adapter"；§4 line 131 说"共同 callable 的 `CommandContext` 入口不存在"、每 operation 一个 concrete typed method。命令侧若真有 switch，就需要一个共同签名可 switch 进去。建议写明：switch 只存在于生成的 edge 代码与 `ReadOperationBindings`，命令侧是逐 operation 直呼。

### N-02｜五项 GET 豁免有闭集、无判据

**[仓内事实]** 五项均在 registry 中存在且都是 GET；3 条 public GET 全部落在豁免内；83 − 5 = 78 成立。闭集冻结在详设里（好）。
但只给名单没给**原则**，policy 里那一列 `reason` 就没有可证伪的对象。建议补一句判据（如"预授权协议读或二进制内容读，不存在对应的用户任务 read model"）。
另：`getCurrentPlatformSession`（实测 4.0/请求）豁免、其 operations-admin 类似物 `getOperationsWorkspaceSessionEntry`（实测 19.7/请求）不豁免——这个不对称我认为**可辩护**（后者是业务工作台入口），但详设未写理由。

### N-03｜§9 行为变更表缺一行

方案 §4.1.1 已登记：C2 合并后，`current_assignment_id NOT NULL` 但 assignment 已失效的分支，今天抛 `EmptyResultDataAccessException` → 500，合并后应为 401 `SessionInvalid`。这是可观察行为变更。M-03 修复后须补进 §9。

### N-04｜`sealed interface CommandContext` 已无消费者

line 104-106 保留了 `sealed interface CommandContext`，但在"无共同 callable 入口"之后已没有 API 接受它。作为 marker 保留可以，建议注明"它不是可调用面"，避免后来者再往上挂 `invoke`。

---

## 3. 已独立核验通过的部分（逐项复算，非采信自报）

**exact-set（本会话从两份 registry 重算）**
- 两 registry sha256 与 Round 2 声明一致：`1f7900fb…` / `fe3c3f7b…`；`operationId` 交集为空；并集 **196** ✓
- owner 切片 76/39/25/16/11/10/7/4/3/3/2，与详设 §3.1 表**逐行相同**，合计 196 ✓
- method 分布 POST 95 / GET 83 / PATCH 15 / DELETE 2 / PUT 1 → 非 GET = **113** ✓
- 非 GET 按 consumerFaces：operations-admin **75** / platform-admin **29** / public **9**，与详设 line 133/135 一致
  （Round 1 文本的"30 platform"是错的，Round 2 与 intake 的 29 正确 ✓）
- B = 83 − 5 = **78** ✓；数值 baseline = (75 − `saveOperationsCatalogItem`) + 5 分支 = **74 + 5 = 79** ✓；parity-only = 29 + 9 = **34** ✓；74 + 5 + 34 = 113 ✓

**BP-M-001（kind-specific binding）已关闭** —— 见 S-02 前半段。

**BP-M-002（C6）已关闭**
- `reorderDictionary:784` 末尾 `return dictionary(dataNodeRef,brandRef,requestId,kind,request)`；`dictionary:528` 在 `jdbc.query` 的 result lambda 内逐行调 `dictionaryReferenced:1190` ✓
- `reorderOperationsCatalogDictionaryEntry` 复算为 POST / operations-admin / catalog，确在 74 条内 ✓
- 详设 line 222/229 的处置（owner-local `DictionaryReferenceSnapshot`、command 不调 `TaskReadService`、不新增第 80 条数值行）与代码事实一致 ✓
- 补充观察（不构成 finding）：`dictionaryReferenced` 还被 `transitionDictionary:785` 单次调用，非循环，处置不受影响

**CatalogAuthorizationScope 与 replay 顺序**
- §5.3 五个字段的来源与约束正确：`brandRef` 来自 `requireCatalogBrand` judgment 结果、`copySourceDataNodeId` 来自 `resolveCatalogCopySource`、均"绝不采纳 request source" ✓ —— 这正是 P2 M-01 缺陷类，未回归
- receipt 顺序「scope/grant bind 验证 → 对象存在/状态/来源/revision 重核 → receipt hash/lookup → replay 或 mutation/readback」方向正确，write 与 copy 都覆盖 ✓

**design-only**
- 9 条 `disposition=create` 路径**全部不存在** ✓
- `ReadOperation` / `CommandOperation` / `OperationBudget` / `MeasuredBaseline` / `WorkspaceExecutionContext` / `OwnerGrant` / `CatalogAuthorizationScope` / `CommandExecutionContextResolver` / `DictionaryReferenceSnapshot` 在 `apps/backend` 命中 **0 文件** ✓

**hash（本会话逐个复算）**
design `d8eb3f86…` ✓ ／ authorization `0595e367…` ✓ ／ checker script `e99619ee…` ✓ ／ checker tool `0ae2ae04…` ✓ ／ round2 `dcad12e6…` ✓ ／ intake `e4915e56…` ✓ ／ 6 个 unit 的 `approvedSources` 全部一致 ✓
manifest 自身 `27729b06…` ≠ Round 2 的 `9ad7d4f3…` —— **符合预期**，已由 `currentBytesNotReviewedByAdversarialReviewer: true` 正确声明 ✓

**门（本会话 fresh 复跑）**
- `implementation-design-granularity --self-test`：12 条红夹具全 PASS ✓
- 本设计：`IMPLEMENTATION_DESIGN_GRANULARITY=PASS / UNITS=6 / FINDINGS=2 / VERDICT=NO_GO / REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` ✓（机器侧正确识别"等待 Claude 复核"）
- `standards-coverage --phase R5`：`PASS / RULES=150` ✓（但见 M-04：它不校验被映射的门是否真的执行规则）

**评审边界纪律**：两轮独立盲审上限未被绕过；作者未以换 reviewer、改 hash 或局部修订重置 cycle；post-remediation 字节诚实声明为"未经独立 reviewer 复核" ✓

---

## 4. manifest 章节级命中对照表

### Part B

| 条 | 命中/落点 | 结论 |
|---|---|---|
| B.1 授权与会话安全（1–17） | §2.5、§4 line 133、§5.1–5.3、§10 | **命中**。四维不互推、双层拒绝、平台/业务两套体系分离、opaque grant `verifyFor`、撤权/role 禁用/assignment 切换先失败、不用页面快照或跨请求缓存替代撤权防护——逐条保持。B.1.4 两 JSON 不合并在 C2 合并中是关键约束，但 C2 未设计（M-03） |
| B.2 数据与事务（1–15） | §2.1–2.3、§5.1、§7、§9 | **命中**。一 DB 多 schema、写与审计同事务、幂等回执同事务、CAS 保留、写事务禁跨 schema JOIN、时间 epoch-ms 不变。B.2.13 弱类型受限：`Object` 仅限生成 read branch 与 method 内首行，方向正确（N-01 措辞待澄清） |
| B.3 后端结构（1–12） | §2.4、§3.1、§4、§6 | **命中**。纵向链固定、模块边界即门、controller 只转 wire、`<module>.api` 唯一例外、禁 service locator/反射/扫描。**B.3.8「set-based 优先；循环内 IO 即缺陷」部分命中**：C6/BOM 有处置，C2/C3/C5 无（M-01/M-03） |
| B.4 前端架构与状态 | — | `NOT_APPLICABLE`：本包不触前端 |
| B.5 交互与信息架构 | §1 line 23、§9 | `NOT_APPLICABLE`（UI 无变更）；B.5.14「任务型 read model 以独立决策 surface 为粒度」与 §6 task reader 一致 ✓；B.5.15「detail 动作只能由 owner 判定、零额外往返」与 §6"不得从 write handler/judgment 调 read 组件"一致 ✓ |
| **B.6 性能（1–6）** | §3.2、§6、§7、§8 | **未完全命中，本轮 NO-GO 主因**。B.6.1 N+1：C6/BOM 命中，C5 落空（M-01）。B.6.3 每请求 DB 计量常驻：BP-U01 命中 ✓。B.6.4 禁为性能删审计/幂等/CAS/限流：§8 明确命中 ✓。B.6.5 模块边界≠数据访问边界：§6 命中 ✓。**B.6.6 取数不取机制（M-02）**；**B.6 整族的既有 enforcement 是假的（M-04）** |

### Part C（代码级样板携带清单）

| 样板 | 结论 |
|---|---|
| 幂等回执同事务 + 常量时间指纹 replay | **命中**，§5.3 receipt 顺序强化（replay 不得先于对象重核），§8 有红夹具 |
| on-conflict-returning 消 TOCTOU | `NOT_APPLICABLE`（本包不改写语句形态） |
| 媒资两段式 staging claim | **命中**，§7 C4 的 `ASSET_ADD` / `ASSET_REMOVE_*` 三分支保留 claim/release |
| 门红夹具范本（永不红的门） | **未命中，见 M-04**——`database-operation-budget` 正是"永不红的门"的实例 |
| generator `--check` 字节比对 + count 断言 + 语义绊线 | **命中**，§3.1 生成器拒绝清单 + §8 binding exact-set 红夹具 |
| 架构归属测试四件套 | **命中**，§8「no dynamic dispatcher」「owner no IAM」「no write cross-schema join」 |
| 其余条目（outbox / STALE-GAP-POISON / repair 快照 / HMAC 信封 / 多步凭证流 / 前端各项） | `NOT_APPLICABLE`：属触发时适用或前端范围，本包不触及 |

### Part D

| 条 | 结论 |
|---|---|
| D.1 目录与布局 | **部分命中**。§6 要求 task reader 落在各 owner `application` 包内 ✓；但方案 §4.6 点名的 `app/application` 目录违规（`CatalogInventoryApplicationService`）与仓根 `results` 目录，详设 §10 只说"拆成 task reader"，未把 `code-layout` 门的两条 FAIL 列入退出条件 —— 归入 M-04 的门 disposition 一并处理 |
| D.2 契约治理 | **命中**。三份新 registry 均为契约层唯一输入，生成物带 exact-set 与红夹具；改名导致编译失败的要求由 §4 typed method 满足 |
| D.3 门纪律 | **未命中，见 M-04**。三件套要求（production validator / `--self-test` 共用核心 / 真会失败的 red fixture）与"新门验收必查 `run()` 实际执行面"，恰是本轮暴露的缺口；且"机器门当前红时，任何以门全绿为前提的声明不成立"当前即成立 |
| D.4 文档治理 | **命中**。design/decision/review 三类物理分开；`-claude` 后缀遵守；status 分级诚实（`PROPOSED_REVIEW_ONLY`、`currentBytesNotReviewedByAdversarialReviewer: true`） |
| D.5 流程右尺寸化 | **部分命中**。设计先行、批次有限边界、business/cleanup 分账、独立对抗审查均命中 ✓；"测试与实现独立派生、高风险断言配 discriminator"在 manifest 每个 unit 有 `discriminator.fixture` ✓。S-01 已撤回，本行不再扣分 |
| D.6 技术栈白名单 | `NOT_APPLICABLE`：不引入依赖 |
| D.8 日志与诊断 | **命中**。BP-U01 的 `statementId`/`paramsHash`/`callSite`/phase 与"不记录 SQL/bind 值/敏感字段"一致；"每请求 DB 计量常驻"命中 |

---

## 5. 结论与授权边界

**NO-GO**（M=4，S=1，N=4；S-01 已由 Dexter 裁定撤回）。

BP-M-001 与 BP-M-002 两项 post-remediation 修订**本会话核验为真实关闭**，intake 的自述属实；196 / 113 / 78 / 79 / 75-29-9 五组 exact-set 全部独立复算通过；design-only 属实。**本轮 NO-GO 不是因为这两项没修好，而是因为复核中新发现了四项 M。**

四项 M 有一个共同形状：**详设把"性能重构"落成了"结构重构 + 计量基建"，而把"少几条 SQL"交给了"不得回归"和"逐条豁免"。** 按现在的字节实施，三个批次做完可以全门绿、全 exact-set 对账通过，而每请求 SQL 条数几乎不变——这正是 Dexter 本轮点名要防的形态。

M-01/M-02/M-04 是有界的文字与设计补充：C5 按 C6 同构改一行、读侧补上下文解析设计并冻结计量口径、
BP-U01 的门 disposition 点名处置既有预算门。S-02 改一个签名。
**M-03 已由 Dexter 2026-08-09 追加要求升级为新增交付单元 `BP-U07`**，详见文末附录。

**需 Dexter 裁决的**：无。原唯一一项（S-01）已裁定撤回。其余 M/S/N 均在 Codex 既有批准边界内可自主修复。

---

## 附录｜Dexter 2026-08-09 追加裁定与方案更新

本附录记录复核交付后 Dexter 的两项裁定，以及我据此对方案文件所做的更新。
**它改变本次 NO-GO 的修复范围，Codex 必须按附录执行，而不只按 §2 的 findings 执行。**

### A.1 S-01 撤回

见上文 `~~S-01~~` 条。真实 BOM 基数远大于 seed，BOM 批量化必做；
详设 §7 line 199 与 §8 的 `BOM rows` 门分母保留。

### A.2 新增交付单元 `BP-U07`：专做 SQL 合并（本轮必须实现）

Dexter 裁定：**"效率现在不做是不行的"**，要求方案中补一份专门的 SQL 合并清单，
指明哪些必须合并，并由 Codex 在本轮实现；批次归属由我裁定。

我已在方案文件新增 **§14「SQL 合并清单」**（复算方法、六项清单、逐项约束、批次归属、验收判据）。
要点：

| 口径 | 值 |
|---|---|
| 全语料 DB 总耗时（2,011 请求） | 1,153.5s |
| **可合并的多余读**（同请求同表多读、且两次读之间无写） | **6,539 条 / 257.8s / 22.4%** |
| 必须保留的读-写-读（CAS 前置、写后 readback） | 471 条 / 18.3s |
| 事务开销（COMMIT） | 254.0s / 22.0% |

**分母是 196 条，不是 seed 的 55 条（Dexter 2026-08-09 纠正后重做）**：

| 覆盖来源 | operation 数 |
|---|---:|
| 历史全量 diagnostic 与本轮 seed 都有 | 39 |
| 仅历史全量 diagnostic | 105 |
| 仅本轮 seed | 16 |
| **两者都无（`UNMEASURED`）** | **36** |

历史全量 HTTP diagnostic（144 条 `PASSED`，覆盖当时全部通用 registry）独立确认这不是 seed 造数产物：

| consumerFace | n | DB 操作数 中位 | max | `>3` 占比 |
|---|---:|---:|---:|---:|
| **operations-admin** | 89 | **17** | 34 | **98%** |
| platform-admin | 43 | 8 | 20 | 79% |
| public | 12 | 8 | 16 | 75% |

**结构适用面（静态推导，不依赖实测）**：15 个 operations-admin controller 全部注入 `OperationsSessionResolver`
→ `WorkspaceAuthenticationService` → `OrganizationVisibilityService`。
因此 SQL-M1 / SQL-M2 覆盖 **134 − 6 登录协议 = 128 条接口**。
seed 交叉验证：29 条 operations-admin 业务 operation **29/29 全部命中**该前置链。

**单请求口径**（717 个 operations-admin 业务请求）：每请求 SQL 中位 **20 条**，
其中**可合并的多余读中位 9 条 = 40%**；SQL 耗时中位 817ms，多余读 319ms = **39%**。

六项合并（按可省耗时）：
`SQL-M1` 会话链四查合一 73.0s ／ `SQL-M2` organization 可见范围一次装载 123.1s ／
`SQL-M3` catalog.catalog_item 多读收敛 45.5s ／ `SQL-M4` group_workspace 请求内一次 7.0s ／
`SQL-M5` 长尾统一规则 ≈9.1s ／ `SQL-M6` BOM 批量化（A.1）。

**批次归属裁定**：新增单元 **`BP-U07`**，插在**批次二（BP-U03/U04）之后、原批次三（BP-U05/U06）之前**。
- 不能提前到批次二：SQL-M1 的合并对象横跨三个事务作用域，必须先有 `ExecutionContext` 单事务单次解析。
- 不能并入原批次三：原批次三的 exit 是"旧路径不存在"，与"合并前后实测对账"是两类判据，混账会互相阻塞；
  且 SQL-M1/M2 是 B=78 读预算的前置，不先做，读预算一开就要写 78 条豁免。
- 单列的第三个理由：**它是四批里唯一以"耗时下降"为验收判据的批次**，
  单列才能让"效率到底有没有上去"成为可独立 GO/NO-GO 的事情。

**验收判据与前三批不同**：判据是**"必须达到声明的目标值"**，不是"不得回归"；
每项给出同一具名 fixture 的前后 per-request 该表读取次数与耗时；
任何一项若证明不能合并，须写 `SQL_MERGE_REJECTED` + 理由，拒绝项之和与 257.8s 的差额要能对上。

**未实测的 36 条**（catalog 16、inventory 10、organization 4、workspace-iam 3、fulfillment-production 2、asset 1）
必须逐条 disposition，不得推定达标；其中 **15 条是 GET**（本会话复算：catalog 3、inventory 6、organization 3、workspace-iam 3），属 B=78 分母，没有实测就不能开预算门。
`reorderOperationsCatalogDictionaryEntry`——详设 line 222 指定的 C6 命令 fixture——**也在未实测之列**。
`BP-U07` 的证据必须给出 196 行，取值为 `MEASURED_SEED` / `MEASURED_HISTORICAL` / `MEASURED_NEW_FIXTURE` /
`UNMEASURED_BLOCKS_OPTIMIZATION` 之一，四者之和等于 196；
**只在 seed 跑过的接口上证明合并成功，本批次不通过**（方案 §14.5.6、§14.6）。

### A.4 抽象粒度红线（Dexter 2026-08-09 追加，我下一轮的重点检查项）

Dexter 追加裁定：**"绝不能完全不抽象，为每个接口设计唯一一个 SQL，从一个极端走到另一个极端。"**

我已在方案新增 **§14.7**，把它写成设计红线加机器门，而不是只留给评审事后抓。要点：

**右端的危害比左端更大**：前置链对 128 条接口是同一份事实，每接口一条就是同一个 JOIN 抄 128 遍；
`LEFT JOIN workspace_role r … AND r.status='ENABLED'` 这类**安全级不变量会散落 128 处**，
丢一处就是 DISABLED 角色的 capability 进 readback，而且**没有任何门会发现**——因为每处看起来都"有自己的语句"。

**同时禁止另一种"抽象"**：全局 query 层、动态 SQL builder、查询 DSL、万能候选 DTO
（manifest B.6.5 / B.2.13 / B.5.14 已明令禁止，本轮不放宽）。

**正确粒度**：合并的粒度是**事实**的粒度，不是**接口**的粒度。
共享前置事实按 `(owner, context kind)` 一条（全系统个位数）；owner 内聚合读取按聚合一个参数化 loader；
任务型 read model 按独立决策 surface（manifest B.5.14 已定）。
具体到本轮：SQL-M1 的产物必须是 **2 条**（command 前置 1 + read 前置 1）而不是 128 条；
SQL-M2 是 **1 份**请求内可见范围事实；SQL-M3 是 `catalog_item` 的**一个参数化 loader**。

**机器门基线（本会话对当前主源复算，453 个 `.java`，不含测试）**：
去重后静态 SQL 语句字面量 **465 条 / 出现 516 处**。关键表独立 SELECT 语句数：
`role_assignment` 10、`workspace_role` 11、`workspace_session` 2、`organization_node` 21、
`store` 26、`head_company` 14、`catalog_item` 21、`group_workspace` 10。

三道门：静态 SQL 去重数**不得超过 465**（合并做对了会下降，每接口一条会上涨——单一指标就能抓住右端）；
关键表独立 SELECT 点数降到声明值；`r.status='ENABLED'` 类授权谓词的出现点数等于声明的唯一处数
（**不变量散落即抽象错了**，这条门是抽象正确性的试金石）。

**我下一轮会问的三个语义问题**（机器门替代不了，对应 manifest D.3）：
这条合并查询服务几个 operation（只服务 1 个且事实别处也在读 = 过度定制）；
这份事实在代码里有几个查询实现（大于 1 = 没合并干净）；
安全级过滤谓词落在几处（大于 1 = 抽象层次错了，要重划边界而不是补一处）。

**对 manifest 的影响**：`BP-U07` 需在 granularity manifest 新增一条 delivery unit，
配独立且唯一的 `approvedSources` / `detailDesign` 锚点（不得复用 U01–U06 的锚点，
那六条已被两轮独立盲审绑定）。

### A.3 本附录对复核结论的影响

`VERDICT` 仍为 **NO-GO**。修复范围由"四项 M + 两项 S"调整为：
**M-01 / M-02 / M-04 / S-02 按原文修复；M-03 由 `BP-U07` 承载；S-01 撤回。**
`BP-U07` 落地后，本方案 §14 即成为该单元的 approved source。

**授权边界**：本结论仅为 DESIGN 复核，仅决定是否可申请下一步 implementation authorization。它**不**授权代码实施、契约变更、数据库/迁移、运行环境、DEV、reset/seed、L2/UAT 或任何仓库控制动作。静态 review 不授权下一 Roadmap step。

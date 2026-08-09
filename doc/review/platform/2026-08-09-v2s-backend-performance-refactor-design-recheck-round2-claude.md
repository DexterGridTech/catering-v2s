# 后台性能重构 implementation-facing 详设 —— Claude 第二次复核

`VERDICT=NO-GO`　`M=3`　`S=2`　`N=4`

评审对象（本会话复算 sha256）：

- 详设 `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md` = `6d21019e92c08c68…`（与 manifest 声明一致）
- manifest `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-granularity-manifest.json` = `17822705db276845…`
- 覆盖矩阵 `doc/review/platform/2026-08-09-v2s-backend-performance-refactor-operation-coverage-initial.md` = `c234b910fe6bd271…`（与 manifest 声明一致）

## 0. 会话出处与独立性声明

1. 本会话**不是 fresh v2s-rooted 会话**，是同一会话的续接。
2. **本次评审的冻结输入之一（方案 `…-plan-claude.md`）由我产出，且我在本会话内又编辑过它**（新增 §14.7、修正我自己的 GET 计数错误）。这一层不构成独立性，且直接导致了下文 M-01。
3. 所有 registry 计数、hash、门结果、语料聚合均在本会话 fresh 复跑，未采信任何文档自报值。
4. 本仓评审期间零写入，除本文件与上述方案文件的两处更正。

## 0.1 我自己的错误更正

上一轮我写「36 条未实测里有 **12** 条 GET」。**这是错的，正确是 15 条**（catalog 3、inventory 6、organization 3、workspace-iam 3）。Codex 在 intake 里的 15 是对的。我已更正方案 §14.6 与上一轮复核文件。

---

## 1. 上一轮五项 findings 的关闭核验

| finding | 结论 | 核验依据（本会话实算） |
|---|---|---|
| **M-01 C5 判为「无 command」** | **已关闭** | BP-U04 的 C5 行现写明 `selectOperationsWorkspaceSessionContext`、`selectOperationsWorkspaceSessionDataNode` 已在 74 条 workspace normal rows，`getOperationsWorkspaceSessionEntry` 在 B=78；末段「C5/C6 新增第 80 条数值行均为红」。我复算：两者均为 `POST` / `operations-admin` / `workspace-iam`，在 75 内且非 `saveOperationsCatalogItem`，故在 74 内；**79 = 74 + 5 未变** |
| **M-02 读侧取数不取机制** | **部分关闭，见 M-02（新）** | §3.2 已冻结 `request-scope`、`OperationBudget.requestScope(3)`、B.6.6 四项机制、**永久豁免上限 0**——这三点都做到了。但**算术不成立**，见下 |
| **M-03 C2/C3 零内容** | **已关闭** | 新增 `BP-U07`，SQL-M1～M6 逐项有 owner-local 目标、必须保留清单与红夹具；C1 行已从「C1/C2/C3」收窄为「C1 context transaction path」，C2/C3 落入 SQL-M1 |
| **M-04 B.6 既有门是假的** | **已关闭** | BP-U01 新增门 disposition 表：`database-operation-budget` **退役为 B.6/B.3 enforcement**，词面 hygiene 迁入独立 `database-query-hygiene`；新 `backend-performance-budget` 读 request evidence，承接 `B.6.N01/N03/N06`、`B.3.N07/N08` 并**进入 `scripts/verify`**；三条 red mutation 均为 production 驱动。`code-layout` 登记为范围外红门且不冒充绿证 |
| **S-02 resolver 泛型无约束** | **已关闭** | §5.1 改为 `resolve(CommandInvocation, OwnerScopeKind<S>) -> ExecutionContext<S>`，并写明「`S` 同时出现在输入和输出，不得使用 unchecked cast、字符串 scope kind 或调用点推断」；`OwnerScopeKind<S>` 为 descriptor 生成的 sealed token，resolver 拒绝 descriptor 与 token 不一致 |

## 1.1 覆盖矩阵独立复算（Dexter 点名项）

我按 `operationId` 逐行解析矩阵并与两份 registry 对撞：

- 解析出 **196 行**；唯一 `operationId` **196**；与 registry 并集**完全相同**（无多、无缺）
- **逐行 `owner` / `method` / `consumerFace` 与 registry 全部一致**（0 处不符）
- coverage 分布：`MEASURED_SEED` **55** / `MEASURED_HISTORICAL` **105** / `UNMEASURED_BLOCKS_OPTIMIZATION` **36** / `MEASURED_NEW_FIXTURE` **0** —— 与声明一致，且我按当前字节独立重算亦为 55/105/36
- read class：`NOT_GET` **113** / `TASK_READ` **78** / `PROTOCOL_READ_EXEMPT` **5** —— 一致
- 未测 GET = **15**（Codex 正确，我上一轮的 12 是错的）
- 五项豁免逐行核对，均在矩阵内且保留 coverage 值（未被静默丢弃）
- 静态适用面：`SQL-M1` 128、`SQL-M2` 128、`SQL-M3` 25、`SQL-M4` 134、`SQL-M6` 11 —— M1/M2 的 128 与我独立推导的「134 operations-admin − 6 登录协议」吻合
- 历史 diagnostic 声明 hash `bd8ebf427da5c043…` **复算一致**
- `MEASURED_SEED=55` 与两份 seed report 只有 54 个 endpoint group 的差异，intake 的解释（`getOperationsWorkspaceLoginEntry` 来自 DB JSONL）**经我复核成立**

## 1.2 manifest 与 design-only

- `BP-U07` 已作为第 7 个 delivery unit 加入，`addedDeliveryUnitIds: ["BP-U07"]` 诚实声明
- 七个 unit 的锚点在详设中**各出现且仅出现 1 次**
- `design`、`authorization`、覆盖矩阵、intake 的声明 hash **本会话复算全部一致**
- `BP-U07` 的 `forbiddenPseudoFixes` 明确列出「one endpoint-specific SQL per operation」「global query bus」「Map or Object request facts」「cross-owner cache」——方向正确
- design-only 属实：`WorkspaceCommandAuthorizationFacts`、`VisibleOrganizationFacts`、`CatalogCoordinationSnapshot`、`EnabledGroupWorkspaceFact`、`ResolvedBomTargets`、`OwnerScopeKind`、`backend-performance-budget` 在 `apps/backend` / `contracts` / `scripts` 命中 **0**；`BP-U07` 五条 `create` 路径**全部不存在**

---

## 2. 方案合理性判断

**方向对，且这一轮真正把"效率"变成了可验收的东西。** 上一轮我判「解决了结构没解决效率」；本轮详设第 21 行已改为「**正确性不降级且实际减少 SQL 往返**……SQL-M1～M6 必须达到各自声明的读取次数，而非仅"不回归"」，`BP-U07` 是唯一承载者，四批次顺序也按我的裁定落位（BP-U07 插在 BP-U03/U04 之后、BP-U05/U06 之前）。这是实质性的改善，不是措辞调整。

**抽象层级的裁决是对的。** BP-U07 写明「唯一合法的层级为：owner 内的有限事实 loader / 批量 judgment → 具名 operation adapter → edge binding」，抽象表一项一型，implementation manifest 要求 `(owner, factLoaderOrJudgment, applicableOperationIds, typedInput, typedOutput, same-invocation validity condition, preserved checks)` 七元组，且「生成器只将这个有限表编译为各 operation adapter 的显式构造器依赖；运行期没有注册表、字符串匹配、反射或 service lookup」。**这与我在 §14.7 写的规则独立收敛到同一处**——Codex 并没有看到 §14.7（详设引用的是「14.2～14.6 节」），却自己到了同一个结论，这一点我要明确记下来。

**剩下的三项 M 都不是方向问题，是"算不平"与"没有控制"**：一处纯算术矛盾（M-02）、一处规则有而门没有（M-03）、一处是我造成的门红（M-01）。

**UI**：`NOT_APPLICABLE`。本包不新增 Journey / operation / 字段；§9 行为变更表新增的「C2 assignment 缺失 500→401」与「B read request-scope >3」两行方向正确。

---

## 3. Findings

标注：`[仓内事实]` 本会话对当前字节复算；`[实测]` 本会话对语料独立聚合；`[推论]` 由前两者推导。

---

### M-01｜机器门当前 FAIL：`BP-U07` 的 approvedSource 2 hash 漂移（**起因是我，不是 Codex**）

**[仓内事实]** `scripts/check/implementation-design-granularity` 本会话 fresh 复跑：

```
IMPLEMENTATION_DESIGN_GRANULARITY=FAIL
REASON=UNIT_SOURCE_BP-U07_2_HASH_DRIFT:doc/review/platform/2026-08-08-v2s-backend-performance-refactor-plan-claude.md
```

`BP-U07.approvedSources[2]` 声明 `8121da6f2121d449…`，实算 `ff9b097df414c6f4…`。
另两个 source（详设、覆盖矩阵）hash **一致**。

**[仓内事实]** 漂移原因是我：Dexter 在 Codex 完成本轮修订后追加了「抽象粒度」裁定，我据此在方案新增 **§14.7**，并修正了我自己的 GET 计数错误（12→15）。Codex pin 的是这两处编辑之前的字节。**这不是 Codex 的缺陷。**

**影响面**：manifest **D.3**「机器门当前红时，任何以门全绿为前提的声明不成立」。本轮不能以"门全绿"收口，与内容对错无关。

**最小修复（两步，缺一不可）**：

1. 重新 pin 方案的 sha256（以修订时的实算为准）。
2. **必须实际读 §14.7 再 pin**——详设当前引用的是「14.2～14.6 节」，§14.7「抽象粒度红线」是它没见过的内容，而它正是 M-03 的修复输入。只改 hash 不读内容，等于把一次真实的输入变更盖掉。

**需 Dexter 决策**：否。

---

### M-02｜`B=78` 的 request-scope ≤3 与 BP-U07 自己声明的目标算不平

这一条是**纯算术**，不涉及判断。

**[仓内事实]** 三处相互冲突的声明：

1. **§3.2**：`OperationBudget` 计量作用域冻结为 **request-scope**，`OperationBudget.requestScope(3)`；机制按 B.6.6 = **上下文解析 1** + 主查询 1 + 可选计数 1；**B 的永久豁免上限为 0**。
2. **BP-U07 抽象表 M1 行**：`WorkspaceCommandAuthorizationFacts` 的「明确禁止」栏写着 —— **供 read path 使用**。
3. **BP-U07 目标表 M2 行**：`OrganizationVisibilityService` 每 request 对 node / store / head-company **各一次**已验证 load（= **3 条**）；抽象表 M2 行的「明确禁止」栏写着 —— **跨 schema join**。

**[实测]** 读侧 workspace-iam 的四条语句今天各执行 1.0 次/请求（`getOperationsCatalogItem`，194 个请求）：
`WorkspaceAuthenticationService#require:244`、`#loadSession:162`、`WorkspaceRoleService#require:145`、`#requireAssignment:298`。

**[推论]** 按详设自己的规则做完之后，一个 operations-admin 任务读的 request-scope 计数是：

| 组成 | 条数 | 依据 |
|---|---:|---|
| workspace-iam 会话/任职/角色/能力 | **4** | M1 抽象禁止读路径复用，抽象表中**没有**任何 read-side 替代品 |
| organization 可见范围 | **3** | M2 目标明写「各一次」 |
| owner 主查询 | ≥1 | B.6.6 |
| **合计** | **≥8** | 预算 **3**，永久豁免上限 **0** |

**[仓内事实]** BP-U07 抽象表的列头是「**唯一允许**的复用抽象」。表内没有任何 read-side 的会话/范围事实抽象。
BP-U05 只有一句散文：「读侧先构造一次 `ReadContext` 的会话/范围事实」——**无命名、无 owner、无适用面、无红夹具、不在抽象表内**。按表的封闭语义，它要么不被允许，要么表不封闭；两种解释都不成立。

**影响面**：矩阵第 9 列标注 `SQL-M1` 的 `TASK_READ` 行有 **58 条**（B=78 中的 operations-admin 全部）。
这 58 条在实施第一天全部超预算，而永久豁免上限是 0 —— 亦即 **BP-U05 的核心交付在设计上就无法通过**。

**最小修复（任一或组合，但必须给出落到 ≤3 的逐条算术）**：

- **(a)** 在 BP-U07 抽象表**新增一条 read-side 具名抽象**（例如 workspace-iam 的 `WorkspaceReadAuthorizationFacts`：读路径、事务外、每 request **1 条**、适用面 58），并给它自己的红夹具与「必须保留」清单。
- **(b)** 把 SQL-M2 的**读路径**目标从「各一次」改为 **1 条**；若采用事务外跨 schema 一条语句，需同时消解与抽象表 M2「禁止跨 schema join」的冲突——**§2.3 与 §6 本来就允许任务型 read 在事务外使用受控跨 schema 组件**，所以这是 M2 行自加的更严约束，可由 Codex 在既有边界内调整。
- **(c)** 在 BP-U05 写出算术：`1（workspace-iam 合并）+ 1（organization 合并）+ 1（owner 主查询）= 3`。这条路径不需要跨 schema join，但**列表类 surface 的"可选计数"就没有余量**——若某些 B operation 必然需要第 4 条，那 ≤3 本身就要重新裁定。

**Dexter 已授权我拍板（2026-08-09）**：「3 只是我之前随便想的，需要按照实际情况的最优方式来确定这个数字，而不是一个固定数字。」

**我的裁决（完整内容见方案 §15）**：`OperationBudget` 从常量改为**四分量声明**——
`contextResolution + primaryQuery + optionalCount + declaredExtras`。

- `contextResolution` **上限 2**，且**由 consumerFace 决定、operation 不得自行声明**。
  实测推导：operations-admin 读的上下文今天 9 条真实 SQL，分属 `workspace_iam`（4 条）与 `organization`（5 条）两个 schema，各自可合一 → 2；
  platform-admin 读今天分属 `platform_iam`（1 条）与 `platform_workspace`（`require:75` + `isEnabled:89` 同表两读，即 SQL-M4）→ 2。
  取 1 需要跨 schema join，虽为 §2.3/§6 所允许，但会把两个 owner 的 schema 焊进同一条语句，**不取**。
- `primaryQuery` 默认 **1**；例外须逐条论证，**全局上限 8 条 operation**（约 B 的 10%）。
- `optionalCount` ∈ {0, 1}。
- `declaredExtras` **恒为 0**（保留字段只为让"多发一条"必须显式改门）。

**由此推出的目标值**：详情/表单支持类 = **3**，列表类 = **4**。
原来的「3」对详情是对的，**对列表少了 1**——这正是它会把每个列表 surface 逼进豁免的原因。
实测校准：`getExtensionDefinition` 今天就是 3.0（**已达标**，正例）；
`getOperationsCatalogItem` 15.0 → 3；`getWorkspaceAccounts` 13.3 → 4。

**永久豁免上限保持 0**：声明分解不是豁免，分解仍被逐分量校验且每项有硬上限。

**顺带闭合 M-03 的一半**：把 `contextResolution` 定成由 consumerFace 决定的全局常量、operation 不得自行声明，
就机器地禁止了"每个接口手写自己的上下文查询"——谁手写，谁的实测 `contextResolution` 就会大于 2，门直接红。
这比事后数 SQL 字面量更早更准，与 §14.7.3 的三道静态门互补。

**需 Dexter 决策**：否（已授权，本条已裁决）。

---

### M-03｜抽象粒度只有规则、没有控制：128 份手写副本能通过全部声明目标与红夹具

**先说我认可的部分**：BP-U07 的抽象层级裁决、抽象表一项一型、七元组 manifest、`forbiddenPseudoFixes` 里的「one endpoint-specific SQL per operation」——**方向完全正确**，且是在没有看到我 §14.7 的情况下独立得出的。本条不是方向问题。

**[仓内事实]** BP-U07 的所有声明目标都是 **per-request 口径**：

- SQL-M1：「每个适用 command **request** = 1」
- SQL-M2：「每 **request** 对 node/store/head-company 各一次」
- SQL-M4：「对同 key/**request** 一次 owner-local load」

**[仓内事实]** §8 门表新增的 `SQL merge target` 行，其 real red mutation 是：
「恢复两条可合并 statement；SQL-M1 移除 ENABLED predicate；SQL-M6 改为逐行 target lookup」。**三条全部是左端回退。**

**[推论] 右端的漏法**：实现者为 128 条 operation 各写一份自己的合并 SQL，每份都带 `r.status='ENABLED'`。于是——

- 每 request 仍然只发 1 条 → **SQL-M1 目标通过**
- 没有任何 statement 被"恢复成两条" → **merge target 红夹具通过**
- ENABLED 谓词一处没删 → **授权红夹具通过**
- 每 request 计数下降 → **`backend-performance-budget` 通过**

**抽象完全失败，而全门皆绿。** 并且这正是那条安全级不变量散落 128 处的场景：此后任何一次改动丢掉其中一份的 `ENABLED`，**没有任何门会发现**，因为每一处看起来都"有自己的语句"、没有基准可比。

**[仓内事实]** 起因可追溯且无过错：详设引用「14.2～14.6 节」，§14.7「抽象粒度红线」及其三道门是 Codex 未见过的内容（见 M-01）。

**最小修复**：把 §14.7.3 的三道静态门纳入 `BP-U07`，并给 `backend-performance-sql-merge-applicability.json` 加基数约束。基线我已在本会话对当前主源复算（`apps/backend/catering-business-server`，453 个 `.java`，不含测试）：

- **去重后静态 SQL 语句字面量 465 条 / 出现 516 处** → 门：合并后**不得上升**（做对了会下降；128 份副本会上涨，且无法靠把 SQL 写长绕过）
- 关键表当前独立 SELECT 语句数 → 门：降到各项声明值。`role_assignment` 10、`workspace_role` 11、`workspace_session` 2、`organization_node` 21、`store` 26、`head_company` 14、`catalog_item` 21、`group_workspace` 10
- `r.status='ENABLED'` 类授权谓词的**出现点数 = 设计声明的唯一处数** → 门：出现点数上升即红。**这道门同时是抽象正确性的试金石——不变量散落即抽象错了，不需要人读代码就能判**
- applicability 文件基数约束：`SQL-M1` / `SQL-M2` 的 `factLoaderOrJudgment` **去重数 = 1**，其 `applicableOperationIds` 并集 = **128**

**需 Dexter 决策**：否。

---

### S-01｜证据文件未冻结：矩阵声明的 `db-operations.jsonl` hash 复算不符，且文件在本次评审期间仍在增长

**[仓内事实]** 覆盖矩阵声明 `current seed DB evidence … sha256 3b0f4a7afb39b7ef…`。
我在本会话内先后实算到 `a35bf476f1d24582…`、`2a8bbc40987a7f60…`——**三个值，两个是我在几十分钟内先后测到的**。

**[仓内事实]** 行数在本会话内的变化：**37,810 → 40,986 → 41,022 → 41,058**。
单一 `runId`（`rm1-seed-8a596243-…`），尾部记录是 `getOperationsWorkspaceLoginEntry` 的新请求。**它是活的追加目标。**

**为什么是 S 不是 M**：**计数目前仍复算得上**——我按当前字节重算 `MEASURED_SEED=55` / `MEASURED_HISTORICAL=105` / `UNMEASURED=36`，与矩阵声明**全部一致**。新增的追加恰好都落在已计入的 operation 上。所以矩阵此刻是对的，错的是"可复现性"。

**风险是实的，且正中 BP-U07 的核心控制**：文件继续增长时，36 条 `UNMEASURED` 中任何一条一旦被偶然打到（例如有人点了某个页面），就会**在没有任何人做任何工作的情况下自动变成 `MEASURED_SEED`**，从而解除对应 SQL-M 的成功声明阻断。BP-U07 的整个"未测阻断优化成功声明"机制建立在这个文件上。

方案 §1 与详设 BP-U01 自己都要求先冻结；`BP-U07` 的 `dependencyAndSerialBoundaries` 也写了「Requires BP-U01 request-scope measurement schema and evidence join」——**但矩阵已经建在未冻结的字节上，次序被跳过了。**

**最小修复**：BP-U01 产出 run-scoped 不可变快照（内容寻址路径），覆盖矩阵与 coverage gate **只读该快照**，绝不直接读 `.runtime/r5/evidence/db-operations.jsonl`；矩阵的冻结输入一节改引快照路径与其 hash。

**我自己的披露**：方案 §14.1.5 的语料聚合（257.8s、6,539 条多余读、40%）**同样建在这个移动目标上**，须在冻结后重算。结构性结论（哪些 callSite 重复读哪张表、适用面 128）来自源码与 registry，不受影响。

**需 Dexter 决策**：否。

---

### S-02｜`SQL-M5` 的适用面 196 行全部是 `PENDING`

**[仓内事实]** 矩阵第 11 列 `M5 disposition`，**196 行全部为 `M5_PENDING_STATIC_OWNER_MAPPING`**；静态适用面统计 `SQL-M5 = 0 条`。

**[仓内事实]** 详设 SQL-M5 行要求「每张表至少一正/反例并在矩阵给出 owner/operation」——**矩阵没有给**。

**影响面**：六项合并里有一项在设计阶段结束时**没有任何分母**。BP-U07 的成功判据是「每个 SQL-M 的结构适用 operation 全部不为 `UNMEASURED_BLOCKS_OPTIMIZATION`」；分母为空时该判据恒真，SQL-M5 会以"零工作量"通过。

**最小修复（二选一）**：

- 本轮补齐 M5 的六张表逐行 owner/operation 映射（表名我已在方案 §14.3 列出：`organization.commercial_group`、`organization.project_phase_name`、`extension.extension_definition`、`catalog.catalog_category`、`workspace_iam.invitation_assignment_intent`、`contract.store_contract`）；
- 或显式把 `SQL-M5` 标为 `DEFERRED` 并从 BP-U07 的成功判据中移出，在方案 §14.2 同步标注。

**不可接受的是现状**：以 `PENDING` 状态进入实施，等于给一项合并留了一个恒真的验收条件。

**需 Dexter 决策**：否。

---

### N 类

- **N-01**：`code-layout` 被登记为「当前范围外红门」，但我方案 §7.1 把 `app/application` 目录下线列为批次三 exit 条件，详设 §10 退出表没有对应行。二者需对齐——要么在 §10 恢复该退出行，要么在方案 §7.1 同步撤回。
- **N-02**：`SQL-M4` 的静态适用面矩阵标 **134**（全部 operations-admin，含 6 条登录协议），我 §14.7 写的是「128 + 7」。以矩阵为准即可（登录也要校验工作区启用，134 更准），但方案与详设应统一口径。
- **N-03**：§8 新增的 `request-scope measurement` 与 `SQL merge target` 两行方向正确，但 red mutation 列仍未覆盖「新增第二个 loader 实现 / 把 `applicableOperationIds` 拆成一对一」这一类（与 M-03 同源，修 M-03 时一并补即可）。
- **N-04**：`getOperationsWorkspaceLoginEntry` 同时是 `PROTOCOL_READ_EXEMPT`（B 分母外）与 `MEASURED_SEED`。这是**正确的**，但它同时也是 55 与 54 的差额来源；建议在矩阵该行加一句说明，避免后来者误以为豁免项不需要 evidence。

---

## 4. manifest 章节级命中对照表

### Part B

| 条 | 结论 |
|---|---|
| B.1 授权与会话安全 | **命中**。opaque `OwnerGrant.verifyFor`、四维不互推、平台/业务两套体系分离、撤权先失败、`OwnerScopeKind<S>` 消除 unchecked cast 均保持。SQL-M1 的「必须保留」栏逐条列出强 assignment 谓词、`r.status='ENABLED'`、密码优先级、既有 role mapper、命令时 capability 重核——B.1.4 两 JSON 不合并在合并语句中得到保留 |
| B.2 数据与事务 | **命中**。一 DB 多 schema、写事务禁跨 schema JOIN、CAS/幂等/审计同事务、`Object` 仅限生成 read branch。SQL-M3 明确区分写前事实与写后 readback，禁止「将写后 readback 与 CAS 合并为同一个陈旧 snapshot」 |
| B.3 后端结构 | **命中**。纵向链、模块边界即门、禁 service locator/反射/扫描；**B.3.8「set-based 优先；循环内 IO 即缺陷」**由 SQL-M6 与 §8 `read N+1` 行承接 |
| B.4 前端 | `NOT_APPLICABLE` |
| B.5 交互与信息架构 | `NOT_APPLICABLE`（UI 无变更）；B.5.14 任务型 read model 粒度与 §6 task reader 一致；B.5.15 零额外往返与 §6「不得从 write handler/judgment 调 read 组件」一致 |
| **B.6 性能** | **未完全命中**。B.6.1 N+1：SQL-M6 与 dictionary loop 红夹具命中；B.6.3 每请求 DB 计量常驻：BP-U01 命中；B.6.4 禁为性能删审计/幂等/CAS：各项「必须保留」栏命中；B.6.5 模块边界≠数据访问边界：BP-U07 抽象层级命中。**B.6.6 的"上下文解析 1"算不平（M-02）**；**B.6 的机器 enforcement 迁移正确（M-04 已关闭），但抽象粒度无控制（M-03）** |

### Part C

| 样板 | 结论 |
|---|---|
| 幂等回执同事务 + 常量时间指纹 replay | **命中**，§5.3 receipt 顺序与 RF-13 保持 |
| 媒资两段式 staging claim | **命中**，C4 五分支保留 claim/release |
| 门红夹具范本（永不红的门） | **本轮已修复**：`database-operation-budget` 正是"永不红的门"实例，BP-U01 已判其退役并要求新门读真实 request evidence |
| generator `--check` 字节比对 + count 断言 | **命中**，binding exact-set + 196 行矩阵 + applicability 表 |
| 架构归属测试四件套 | **命中**，§8 的 `owner no IAM` / `no write cross-schema join` / `no dynamic dispatcher` |
| 其余（outbox / HMAC 信封 / 多步凭证流 / 前端各项） | `NOT_APPLICABLE`：触发时适用或前端范围 |

### Part D

| 条 | 结论 |
|---|---|
| D.1 目录与布局 | **部分命中**，见 N-01 |
| D.2 契约治理 | **命中**。三份新 registry + applicability 表均为契约层唯一输入，生成物带 exact-set 与红夹具 |
| D.3 门纪律 | **本轮方向已修正但当前未命中**：新门三件套要求已写入 BP-U01；但「机器门当前红时，任何以门全绿为前提的声明不成立」当前成立（M-01），且抽象粒度缺 `run()` 层面的实际控制（M-03） |
| D.4 文档治理 | **命中**。design/decision/review 三类分开；`-claude` 后缀遵守；`currentBytesNotReviewedByAdversarialReviewer: true`、`addedDeliveryUnitIds` 均诚实声明；矩阵 status 标为 `DESIGN_BASELINE_NOT_IMPLEMENTATION_EVIDENCE` |
| D.5 流程右尺寸化 | **命中**。设计先行、批次有限边界、business/cleanup 分账、每 unit 有 `discriminator.fixture`；BP-U07 的 discriminator（十行 BOM 命令发一次 bounded lookup，而不同 key 或被写入分隔的读不能复用其事实）是合格的判别器 |
| D.6 技术栈白名单 | `NOT_APPLICABLE` |
| D.8 日志与诊断 | **命中**，但证据冻结次序被跳过（S-01） |

---

## 5. 结论与授权边界

**NO-GO**（M=3，S=2，N=4）。

**本轮是实质性的进步，不是措辞修补。** 上一轮四项 M 与一项 S 我逐条核验为**真实关闭**：C5 的两个 POST 已入 74 条且 79 未变；request-scope 已冻结、永久豁免上限定为 0；C2/C3 由新增的 `BP-U07` 承载并有声明目标；`database-operation-budget` 的退役与 `backend-performance-budget` 的接线诚实且进 `scripts/verify`；resolver 的 `OwnerScopeKind<S>` 消除了 unchecked cast。196 行覆盖矩阵我逐行对撞 registry，**196 / 55 / 105 / 36 / 0 / 113 / 78 / 5 与 128 / 128 / 25 / 134 / 11 全部独立复算通过**。BP-U07 的抽象层级裁决在没有看到我 §14.7 的情况下独立收敛到同一处，这一点应当记功而不是记过。

**三项 M 的性质各不相同**：M-01 是**我造成的门红**，修复是重新 pin 加实际读 §14.7；M-02 是**纯算术矛盾**，详设自己的三处声明无法同时为真；M-03 是**规则对但控制缺**，且缺的正是 Codex 没见过的那一节。两项 S 是可复现性（证据未冻结）与一项合并的分母为空。

**全部五项都是有界修订**，不需要推翻任何方向。

**需 Dexter 决策**：仅 M-02 的**条件性触发**——若 read 侧算术做不平（例如列表类 surface 必然需要第 4 条），则 B.6.6 的「≤3」是 Dexter 已接受的标准，调整它需 Dexter 裁定。在此之前不得以"有界豁免"绕过；详设自己把永久豁免上限定为 0，我认为这一条应当保持。其余 M/S/N 均在 Codex 既有批准边界内可自主修复。

**授权边界**：本结论仅为 DESIGN 复核，只决定是否可申请下一步 implementation authorization。它**不**授权代码实施、契约变更、数据库或迁移、运行环境、DEV、reset/seed、L2/UAT 或任何仓库控制动作。静态 review 不授权下一 Roadmap step。

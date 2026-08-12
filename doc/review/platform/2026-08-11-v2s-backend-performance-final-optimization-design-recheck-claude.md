# 后端性能最终优化详设 —— Claude POST_REMEDIATION_V1 独立复核

`VERDICT=NO-GO`　`M=2`　`S=2`　`N=0`

> **修订说明（2026-08-11，逐条复核后）**
> 本文件初版结论为 `GO`（M=0/S=1），当时我只做了**集合层面**的 exact-set 与抽样，
> **没有逐条核 196 行的内容**。Dexter 指出后我补做了 113+83 的逐行审计，
> 发现了 M-01（`cur` 源码证据抽取错误）与 S-02（既有同类门未处置），据此改判 `NO-GO`。
> 初版的 §1 各项结论经复核仍然成立，不因此改判；新增证据见 §5、§6。

**这份详设的质量高于我给出的需求文档。** 196 的 exact-set、地板公式、三条 assertion、
门的 fail-closed 面、Testcontainers 分组与可比性、L2 先于 seed 的顺序，我逐项独立复算或对着源码/既有决定核过，
全部成立；其中两处它比我想得更细，一处它发现了我没发现的既有假绿。

唯一的 S 是 manifest 把本批**两个最核心的新建制品**标成了 `update`，不阻断实施。

**本 GO 只允许创建一个独立的静态 implementation package 并按 BPF-U01…U06 完成实施。**
不授权在 static 与前序 managed evidence 未 PASS 前运行 Testcontainers、reset、seed、L2/UAT、部署，
**也不构成任何 SQL 性能数值成功声明**。

## 0. 会话出处与写入边界

续接会话，非 fresh v2s-rooted acceptance。本仓零写入（除本文件）。未执行任何动态动作。
下列数字均由我从注册表与原始制品独立复算，未采信自报值。

---

## 1. 你点名的核验项

### 1.1 196 exact-set 与未来 fail-closed —— **通过**

| 项 | 我的复算 |
|---|---|
| registry | 196（COMMAND 113 / READ 83） |
| command-catalog 113 条 == registry COMMAND 集合 | **True** |
| read-catalog 83 条 == registry READ 集合 | **True** |
| 两 catalog 并集 == 全集 / 交集 | **True / 0** |
| source-read-ledger 196 条 == 全集 | **True** |

**不是计数相等，是集合逐个相等。**

未来准入（§2.8）fail-closed 面包含：缺 topology、缺 shape、缺 budget component、缺 formula、
缺 source-inventory 引用、**future-operation row**、未知 profile/disposition、重复行、
**unreferenced binding**、缺 above-floor 说明。

**`unreferenced binding` 这一条正是我在 M1 审查里提的 S-01**（矩阵为 68 行声明 binding 作 edge，
实际只有 26 条经 binding、42 个 `bind` 方法无人引用）。他们把它从一条 finding 变成了门的常驻断言，
红变异清单里也有 "a dead M1 binding"。这是正确的收口方式。

### 1.2 地板公式不是数字 cap —— **通过，且比我写得细**

§2.3 开宗明义「No row is judged by one global database-operation limit」。
按形态给公式：单 owner 命令 `6 + N`、`NO_CONTENT` 命令 `5 + N`、
跨 owner 命令 `6..8 + N`（真无内容时 `5..8 + N`）、任务读取 `3..6`。

**两处比我的需求文档更细，我采纳**：

1. 我只写了「最终 readback 1 或 0」，它单独给了 `NO_CONTENT` 的 `5 + N` 公式，
   并明确「the two current no-content M1 commands must remain valid rather than be falsely rejected」——
   避免用一个公式把合法的无内容命令误杀；
2. 我用 public protocol 的 `TRANSACTION=2, CONNECTION=1` 论证地板可达，
   它补了一句「is an existing lower-bound witness, **not a rule to delete semantics elsewhere**」——
   防止有人拿这个观测去别处砍语义。这一句我原文没有，应该有。

超地板处置遵守既有 `TASK_READ_BUDGET_REQUIRES_EXPLANATION`：不自动失败，但须逐行写明
用户任务、基数、查询链与 owner 理由，并明确「it is a review prompt, not a generic mechanical ceiling」。

### 1.3 事务 origin、68/68 binding reachability、loader-once 判定 —— **通过**

三条 assertion（§2.4）与我需求文档的命名逐字一致，语义正确：
`ONE_REQUEST_ONE_TRANSACTION_ORIGIN`（edge 不建事务、参与的 owner 调用不起第二个 origin）、
`REQUEST_LOCAL_FACT_LOADED_ONCE`（**"this is not caching and never bypasses a current owner recheck"**）、
`OPERATION_DATABASE_SHAPE_DECLARED`（source-anchored、source admission 之前）。

判定手段划分正确：
- **静态**：`backend-performance-operation-source-inventory`（route→source 闭包）、
  `backend-performance-operation-database-shape`（196 行公式 join）；
- **不可变快照运行时**：`backend-performance-request-fact-load-once`
  ——用事件流判「同一请求内装载器重复」。这正是可行的机制：
  我需求文档里那些重复次数（`resolveSessionEntryFacts` ×8 等）就是从同一事件流算出来的。

红变异清单覆盖：缺 shape 行、错 floor component、edge 事务注解、第二个 origin、
未列调用方调用装载器、同请求装载器重复事件、**dead M1 binding**、未知装载器归属、
报告 basis/coverage 不符、缺 UPDATE 总数、**UPDATE 总数下降**。
并要求「must prove each mutation changes the intended verdict, **not merely exercise a parser branch**」。

### 1.4 一处他们发现、我没发现的既有假绿 —— **我独立证实了**

§2.8 说 BPF-U05 要先修 read-budget 的既有 command anchor：
`OperationsWorkspaceUserController#revoke` 应替换为五个真实入口
`groupRevoke` / `regionRevoke` / `projectRevoke` / `headCompanyRevoke` / `storeRevoke`。

我核了：该 controller `:62-66` **确有且只有这五个方法，没有任何名为 `revoke` 的方法**；
而 `scripts/generate/task-read-surface-policy.mjs` 的 `workspaceTaskReadCommandAnchors` 第一条正是
`…OperationsWorkspaceUserController.java#revoke`。

**后果**：`BP_U05_TASK_READER_COMMAND_USAGE` 对这条 anchor 取到空方法体，
在空字符串上跑正则，**恒不触发**——也就是"命令不得调用 task reader"这条断言对这五个撤销命令一直是空转。
这是我在此前多轮读侧复核中**没有发现**的既有假绿，他们发现了，并排了修复与"丢成员即红"的红变异。

### 1.5 owner-local 不跨 schema —— **通过**

§2.3 明确跨 owner 命令「must not fold owners into a cross-schema query」，
上下文按真实 owner 数各一条；§2.7 的折叠限定为「only when equivalent」，
且必要性与语义等价性被划入 `UNENFORCEABLE_BY_MACHINE` 加 review checklist，
不冒充自动证明。与 `OWNER_LOCAL_EFFICIENCY_REPAIR`、`MODULE_OWNER_SOVEREIGNTY` 一致。

### 1.6 Testcontainers 可合并但仍可比 + 先修 drift —— **通过**

分组是被允许的：「groups compatible operations into the fewest scenarios…
there is no one-container or one-test-per-operation rule」；
但**可比性不因分组丢失**——「the report still emits **one request/event-joined, HMAC-validated row
per operation** containing DB count, kindCounts and UPDATE」，
`business=PASS` 恰为 **196/196**，`cleanup=PASS` 是独立的自有资源证明。
分组的禁止边界写得精确：只有当共享状态会改变某操作的授权、fixture 前置、
事务/readback 断言或 cleanup 精度时才禁止。

**先修 drift 是被要求的**，且我确认该 drift **此刻真实存在**：
`node scripts/check/backend-performance-final-fixture-catalog --check` 当前输出
**`BP_FINAL_FIXTURE_PLAN_OWNER_HTTP_OPENAPI_DRIFT`**（红）。
详设 `:410` 把它记为显式现状，`:480` 要求「First repair and prove the current 196-row
owner-HTTP/OpenAPI fixture catalog」——顺序正确，不是先跑再说。

### 1.7 L2 先于 seed、seed 不被 L2 消费 —— **通过，且是既有治理的落实**

固定顺序：静态 196 闭合 → 独立 IMPLEMENTATION review GO → 远端 Testcontainers 196/196
business+cleanup PASS → 本机 managed L2 business+cleanup PASS → 破坏性 reset →
managed DEV start → r5-full seed 与同 basis 比较。

理由写明：L2 自有私有隔离 fixture，**既不消费 seed 数据库、也不把自己的运行时数据借给 seed**。
我核了它引用的 `doc/decisions/2026-07-24-v2s-verification-governance.md` **§8 确实存在**，
标题即「阶段归属与闭环顺序：后台 API → 前端 L2 → DEV seed」，其第 3 条明写
「seed 不是 API/L2 的 fixture，不进入 API/L2 业务分母」。**顺序不是详设发明的，是落实既有决定。**

禁止替代项也具体：技术证明阶段禁本机 Docker/Colima、禁 DEV 数据库、禁当作 L2/UAT；
L2 的非 `--managed` 形态「is fixture-only and cannot close L2」；
seed 阶段禁复用 Testcontainers/L2 fixture、禁跨 kind 比较、禁把 seed PASS 说成 L2/UAT/性能成功。
并有一句关键的：「Business and cleanup are independently terminal: **neither PASS upgrades the other**」。

### 1.8 post-remediation 是否绕过 hard stop —— **没有**

Round 1 `NO_GO`、Round 2 `NO_GO` + `SELF_DECIDED`，两轮均 `INDEPENDENT_SUBAGENT` 且
`authorMaterialReadAfterIndependentVerdict: true`，`reviewRound 2 / limit 2`——**无第三轮**。
`postRemediationDeclaration` 如实标注 `currentBytesNotReviewedByAdversarialReviewer: true`、
`claudeRecheckRequired: true`、`implementationAuthority: False`，
`reason` 写明 Round 2 仅 hard-stop 在 stale manifest binding 上、本次只是重绑当前字节。
design 与 authorization 两个 hash 我复算**均相符**；manifest `status: PROPOSED_REVIEW_ONLY`。
`implementation-design-granularity` fresh 复跑 **`PASS`**，
`REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`，
绑定的 Round 2 `NO_GO` 被如实保留、未被改写。

### 1.9 ledger 的诚实度 —— **值得肯定**

196 行的 `gaps` 字段不是"已完备"，而是逐条列出**尚未声明**的东西：
113 条并发未声明、113 条 problem-code 集未声明、87 条幂等未声明、
77 条无 per-operation `CONTEXT_*` 数字地板、45 条 readback 未声明、
5 条协议豁免无 edge/reader anchor、4 条 catalog owner anchor 未标识变更 owner。
**这是把缺口摊开，不是把缺口盖住**，与本仓一贯反假绿的要求一致。

---

## 2. Finding

### S-01｜本批两个最核心的新建制品在 manifest 里被标成 `update`，且门不校验

**证据**：manifest 34 条 changeSurfaces（create 12 / update 21 / retain 1）中，
以下两条标 `disposition: update`，但我逐条 stat 确认**文件不存在**，
且仓内无同名或近似改名物（`contracts/registry/` 与 `scripts/check/` 下检索 `shape` 均无命中）：

- `contracts/registry/backend-performance-operation-database-shape-matrix.json`
- `scripts/check/backend-performance-operation-database-shape`

**这两条恰恰是本批的核心新建物**——196 行形态矩阵与形态门，
§2.8 明确它们是 "A new static … owns the 196-row formula join"。新建物应为 `create`。

**为什么要紧**：`implementation-design-granularity` 有 `CREATE_PATH_ALREADY_EXISTS` 红夹具
（校验 `create` 路径必须不存在），但**不校验 `update` 路径必须存在**——
我实跑该门，在这两条错标的情况下仍输出 `IMPLEMENTATION_DESIGN_GRANULARITY=PASS`。
也就是说标成 `update` 恰好**绕开了**本该适用于它们的 create-path 检查；
package exit 的 changed-path 对账也会把它们当作既有文件的修改而非创建。

**有限适用面**：34 条 surface 中的 2 条。**不阻断实施**（路径仍在批准面内，实施动作不受影响），
不影响 196 分母、地板公式、门语义或任何现有声称。

**最小修复**：把这两条改为 `create`；并建议给 granularity 门补一条对称断言——
`update` 路径必须存在，与既有 `CREATE_PATH_ALREADY_EXISTS` 配对。
不改任何其它字段。

**是否需要 Dexter 裁决**：不需要。

---

## 5. 逐条审计（196 行，Dexter 要求后补做）

初版我只验了集合相等。本节是**逐行**审计结果。

### 5.1 113 条 command 行

| 逐行检查项 | 结果 |
|---|---|
| `edge` 锚点文件存在且方法真实存在 | **113/113** |
| `cur.chain` 锚点文件+方法存在 | **113/113** |
| `http[0]` 方法与注册表一致 | **113/113** |
| `own` 与注册表 owner 一致 | **113/113** |
| `prof` 与注册表四元组推导一致（M1 68/PO 20/PP 9/WP 7/PU 9） | **113/113** |
| `select` 组合（template/A/B/C/floor/accept） | **每 profile 恰好 1 种组合** |
| `adapter` FQCN 无源文件 | 45 条，**全部为非 M1，且顶层 `adapterFieldSemantics` 明写该字段"never proof of a physical Java source path"、45 条一律 `GAP_ADAPTER_SOURCE_ANCHOR`——不是缺陷** |
| `cur.tx` 带路径锚点的 45 条中，锚点方法可被证实为 owner 入口 | **40/45**（见 M-01） |

`select` 的 A/B/C 适用性与需求文档 §4.1 逐桶处置**完全对应**：
PU 是 `A_NA`/`B_NA`/`C_LIGHT`（不动其事务与上下文），PP/WP 是 A+B 而 `C_NA`，M1/PO 是 A+B+C。

### 5.2 83 条 read 行（对权威 `task-read-surface-policy.json` 逐字段）

| 逐行检查项 | 结果 |
|---|---|
| `disposition` 与 policy 一致 | **83/83** |
| `readContextKind` 与 policy 一致 | **78/78**（task read） |
| `requiredFactSet` 与 policy 逐项一致 | **78/78** |
| `budget.components` 四分量与 policy 三个 cap + `UNCLASSIFIED=0` 一致 | **78/78** |

command catalog 声明的 registry `sha256` 与实际复算**相符**。

**结论：除 M-01 外，196 行逐条内容是准确的。** 这一节是我初版缺的功课。

## 6. Findings（补充）

### M-01｜`cur` 的源码证据存在机械抽取错误，5/45 已证实且很可能是下界

**证据**。带路径锚点的 45 条非 M1 行中，5 条的 `cur.tx` / `cur.chain` 指向的不是 owner 入口：

| operationId | 声明的 `cur.tx` | 实际是什么 |
|---|---|---|
| `createPlatformGroupWorkspace` | `app/edge/platform/session/PlatformSessionResolver.java#actor` | **edge 类**中 `:60` `return new AuditActor(...)`，**纯内存构造、零数据库访问** |
| `transitionPlatformGroupWorkspaceStatus` | 同上 | 同上 |
| `updatePlatformGroupWorkspaceDisplay` | 同上 | 同上 |
| `initializeCommercialGroup` | `platform/workspace/api/PlatformWorkspaceCoordinator.java#initializeCommercialGroup` | **interface 声明**，非实现 |
| `stagePlatformAsset` | `PlatformAssetService.java#stageContent` | `:65` 的**委托重载**，非实现体 |

真实 owner 入口在 `PlatformWorkspaceAdministrationController`：
`:88 workspaces.create(...)`、`:109 workspaces.updateDisplay(...)`、`:123 workspaces.transitionStatus(...)`。

**病因可定位**：这三行的**最后一个实参**都是 `sessions.actor(session)`；
抽取时取了行内**最后一个方法引用**而不是 owner 调用。这是机械抽取规则错误，不是个别笔误。

**为什么是 M 而不是 S**：
① 该目录被以 hash 绑进 manifest 作为设计权威，且全文自称「196 条源码阅读证据」，
这 5 条的证据是假的；
② 三条把 **edge 类**记成当前 owner/protocol 入口，而设计自己的
`ONE_REQUEST_ONE_TRANSACTION_ORIGIN` 明令 edge 不得是事务起点——记录与自身断言相抵触；
③ **最要紧的是它很可能是下界**：我能发现这 5 条，靠的是它们恰好没有 `@Transactional`。
若抽取规则在别处误取到另一个**恰好带事务注解**的方法，我这套检查**发现不了**。
所以不能按"改 5 行"处理。

**有限适用面**：113 条中带路径锚点的 45 条（M1 的 68 条经 `rowAnchors.m1` 委托给执行矩阵，
我在 M1 复核中已验 68/68，不受影响）。不影响 196 分母、profile 分区、地板公式或读侧 83 行。

**最小修复**：用**确定性规则**重导这 45 条的 `cur.tx`/`cur.chain`——
取 edge 方法体内对**已声明 owner/protocol API 字段**的调用，而不是行内最后一个方法引用；
重导后逐条复验"该锚点属于 owner 或 protocol 包、且不属于 `app/edge/**`"。
建议把后一条做成 source-inventory 的常驻断言：**`cur` 锚点落在 `app/edge/**` 即红**。

**是否需要 Dexter 裁决**：不需要。

### M-02｜"管住未来"只在本包生命周期内成立：强制执行是包级的，包一换即静默失效

**Dexter 的原始要求**是「这次优化不是针对现有这些后台接口和逻辑，是要能管住未来所有后台接口和逻辑的规范」。
本条判定该要求**在当前字节下不成立**。

**证据（三条，均实查）**：

1. **`scripts/verify` 调用的 `scripts/check/*` 门数量为 0。**
   我对 `scripts/verify` 检索 `scripts/check/` 前缀，命中 **0** 条——
   本仓没有任何常规执行路径会自动跑这些门。
2. **强制门是包级字段，且缺失时静默跳过。**
   `tools/compliance-control/cli.mjs` 的
   `function runMandatoryPerEditGate(root, packageState) { const gate = packageState.mandatoryPerEditGate; if (!gate) return; … }`
   ——它读的是**当前 active package 的字段**。下一个包的 `active-package.json` 若不再声明，
   门**不报错、直接不执行**。
   而 `.runtime/compliance-control/active-package.json` **不在本设计的 34 条 changeSurfaces 内**，
   `tools/compliance-control/cli.mjs` 与 `scripts/verify` 同样不在，
   设计全文也未说明未来包如何继承这条强制声明。
3. **机制 B 对未来是回溯性而非预防性的。**
   `scripts/check/backend-performance-request-fact-load-once` 按设计 §2.8 owns
   "the immutable snapshot event invariant"——它必须消费运行时证据。
   因此未来某个操作在一次请求内重复装载事实，**编辑时不会红**，
   只能等下一次 Testcontainers 或 seed 暴露；而按设计 §1.4.1 的固定顺序，
   那是很晚且需单独授权的阶段。

**因此当前的"未来防护"分成两半，必须分开表述**：

- **会持久的**：三条 project-memory assertion 与 `standards-coverage-matrix.json` 条目——
  它们是包无关的文档与注册项，会留在仓里；
- **不会持久的**：这三个新门的**自动执行**。它只在"某个 active package 恰好把
  `sql-merge-coverage` 声明为 `mandatoryPerEditGate`"时生效。本包声明了，所以本包内有效；
  包一关就没有任何机制保证下一个包还声明它。

**有限适用面**：不影响本批对现有 196 条的整改质量（§5 已逐条验过），
只影响"规范能否管住未来"这一 Dexter 明确提出的目标。

**最小修复（二选一，都很小）**：
① 把三个新门（以及既有的 `sql-merge-coverage`、`standards-coverage`）加入 `scripts/verify`，
使其获得包无关的常驻执行路径；或
② 在 `tools/compliance-control/cli.mjs` 中把 `mandatoryPerEditGate` 由可选字段改为**必填**，
缺失即 `ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID`，
使任何未来包都无法在不声明该门的情况下激活。
两者都需要把 `scripts/verify` 或 `tools/compliance-control/cli.mjs` 纳入 changeSurfaces——
当前两者都不在。

另请在设计中明确：机制 B 的 loader-once 是**运行时回溯**控制，
不得表述为"未来新增操作会在编辑时被挡住"。

**是否需要 Dexter 裁决**：**需要**（`DEXTER_DECISION`）——选 ① 还是 ②、
以及是否接受"loader-once 只能回溯发现"，属于治理范围与代价的取舍，不是纯工程判断。

### S-02｜新建形态门与既有 `database-operation-budget` 职责重叠，且三个既有门当前为红、设计零提及

**证据**。设计新建 `scripts/check/backend-performance-operation-database-shape`，
而 `scripts/check/database-operation-budget` **已存在**（仅 3 行的薄包装）。
我实跑既有的五个相邻门：

| 既有门 | 当前 | 设计中提及次数 |
|---|---|---:|
| `database-operation-budget` | **exit=1**　`R4_GATE=FAIL`　`R4_DATABASE_SELECT_STAR:…DatabaseOperationTrackerTest.java` | **0** |
| `authority-source-ledger` | **exit=1**　`P1_AUTHORITY_SOURCE_LEDGER=FAIL` | **0** |
| `backend-performance-gate-dispositions` | **exit=1**　`BP_U01_GATE_DISPOSITIONS=FAIL` | **0** |
| `canonical-performance-ledger` | exit=0 | 0 |
| `backend-performance-command-baselines` | exit=0　`BP_U04_BASELINE_CHECK=PASS` | 0 |

**为什么要紧**：
① **职责重叠**：两个门同时名义上管"数据库操作预算/形态"，而旧的那个既没被复用、也没被修、更没被退役；
② **`backend-performance-gate-dispositions` 本身就是管门处置的门，现在是红的**，
而本设计新增三个门却完全没有咨询或更新它；
③ 这三个红门都不在 `scripts/verify` 链上（我检索 verify 无任何命中），属长期无人看守的既有债。

**为什么是 S 不是 M**：三处红都是**既有债**，不是本设计造成，
且与本批的正确性无关；本设计的门拓扑本身自洽。

**最小修复**：在设计的门拓扑一节显式处置这五个既有门——
`database-operation-budget` 明确"折叠进新形态门"或"退役并说明"；
新增三个门同时登记进 `backend-performance-gate-dispositions`；
三个红门各给一句处置（修复、退役或登记为 `HANDOFF.md` 欠账）。不新增任何机制。

**是否需要 Dexter 裁决**：不需要。

## 3. 方案合理性

**问题对不对**——对。它没有停在"把 196 条改一遍"，而是按 Dexter 的要求做成了
「项目记忆 assertion + standards 注册 + fail-closed 门」三层，
且对**尚不存在的操作**生效（future-operation row 缺失即红）。这才是"管住未来"。

**方案优不优**——两处取舍我特别认可：

其一，**地板做成按形态的组件公式而非全局上限**。这既满足 Dexter 要的"合理约束下的最小"，
又遵守了既有 `TASK_READ_BUDGET_REQUIRES_EXPLANATION`；
`NO_CONTENT` 单列公式与 public-protocol"下界见证而非删语义许可"两句，
是我需求文档里缺的防误杀条款。

其二，**loader-once 用不可变快照事件流判定，而不是静态猜**。
静态只能证明"装载器只在具名单点被调用"，证明不了"运行时确实只跑了一次"；
用事件流做运行时不变量是唯一诚实的判法，且机制已存在。

**代价配不配**——配。三种机制是框架级单点改动，六个单元串行，
没有把第二批的 `EXISTS`/CTE 折叠伪装成"顺手做掉"，
折叠的语义等价性明确划归人工 checklist。

**UI 与交互**：`NOT_APPLICABLE`。本批不改 HTTP 契约字段集合与响应形状，
不触碰页面、Journey 或任何用户可见操作。

---

## 4. 结论

**GO**（M=0，S=1，N=0）。

196 的 exact-set 我做的是**集合逐个相等**而非计数相等：command 113 与 read 83 分别与注册表两个分区
完全相同、并集为全集、交集为 0、ledger 覆盖全 196。
地板是按形态的组件公式且明写"不是全局上限"，并补了 `NO_CONTENT` 的 `5+N` 与
"public protocol 的 `2+1` 是下界见证、不是删语义的许可"——这两句比我的需求文档更周全。
三条 assertion 命名与语义与需求一致，`REQUEST_LOCAL_FACT_LOADED_ONCE` 明确"不是缓存、不绕过 owner 复核"。
门的 fail-closed 面含 future-operation row 与 **unreferenced binding**——
后者正是我在 M1 审查里提的 S-01，被升级成常驻断言。
loader-once 用不可变快照事件流判定，机制可行且已存在。

**他们还发现了一处我没发现的既有假绿并已证实**：
`OperationsWorkspaceUserController#revoke` 这个 anchor 指向的方法根本不存在（实际是五个 `*Revoke`），
导致 `BP_U05_TASK_READER_COMMAND_USAGE` 对五个撤销命令长期空转。

Testcontainers 允许合并分组但每 operation 仍出一行 HMAC 校验记录、`business=PASS` 恰为 196/196；
fixture catalog drift 我确认**此刻真实为红**，详设要求先修再跑，顺序正确。
L2 先于 seed 并非发明，而是落实既有治理决定 §8（我核了原文）。
两轮独立盲审均 NO_GO、Round 2 `SELF_DECIDED`、无第三轮，post-remediation 只是机械重绑且如实标注。

唯一的 S 是 manifest 把形态矩阵与形态门这两个核心新建物标成了 `update`，
而 granularity 门只校验 `create` 不校验 `update`，所以错标反而绕开了检查。改两个字段即可，不阻断。

**授权边界**：本 GO 仅允许创建一个独立的**静态** implementation package，并按 BPF-U01…U06 完成实施。
不授权新外部 HTTP/API、不授权弱化任何正确性红线或门、不授权未拥有的进程；
在 static 与前序 managed evidence 未 PASS 之前，**不授权** Testcontainers、reset、seed、L2/UAT 或部署；
**不构成任何 SQL 性能数值成功声明**——收益只能等同口径 seed 前后对照产出。

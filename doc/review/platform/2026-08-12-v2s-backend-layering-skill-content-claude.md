# Skill 内容交付：后端分层设计与问题排查

> **本文是 skill 的完整内容，不是需求文档。** 建议置于 `.agents/skills/cs-backend-layering/SKILL.md`（放置动作由 Codex 执行，不在我的写入边界内）。
>
> **本文替代**并作废：`2026-08-12-v2s-layer-call-convention-requirements-claude.md`（两版）、`2026-08-12-v2s-transaction-boundary-static-gate-requirements-claude.md`、`2026-08-12-v2s-database-interaction-boundary-standard-requirements-claude.md` 的**方案部分**。那三份的欠账清单仍可查阅。
>
> **事实纪律**：下文每个数字都经过两轮 fresh 独立子 agent 盲审独立复算确认。被证伪的数字（曾出现在上述作废文档中的「ArchUnit 28 条」「new Operation 15 处」「97 个未匹配类」「registry checker 已在跑」「seed 报告无该 operation」）**一律未采用**。

---

## 第一节 · 这个仓的分层现状（先认清，再设计）

### 1.1 实际形态

| 形态 | 标识 | 关键事实 |
|---|---|---|
| edge controller | `..app.edge..` | `@Transactional` **0 处**；但**直接注入 owner service / coordinator 75 处、32 文件、28 种类型** |
| operation adapter | `*Operation` 类 | 真实存在 **69 个，全部在 app 源根 `src/main/java`，`modules/` 下 0 个**；68 个是 bindings adapter，各恰 1 处 `@Transactional(REQUIRED)` |
| owner api | `*Api` / `*Lookup` | 跨模块契约，但**不是唯一实际路径** |
| owner service | `*OwnerService` | 仅 **3 个**（catalog / inventory / production tag） |
| coordinator | `*Coordinator` | **2 个**。`CatalogInventoryCoordinator` 是 `@Service` 但不叫 `*Service`，独占 **43 处 `@Transactional`**，被 edge 直接注入 |
| task read service | `*TaskReadService` | 83 个读操作的实际承载者 |

### 1.2 三个必须知道的结构事实

**（一）所有事务边界都在 app 源根，与 modules 树构成 split package。**
app 源根 `apps/backend/catering-business-server/src/main/java/com/catering/v2s/` 下托管着 8 个顶层包：`app`、`organization`、`catalog`、`platform`、`workspace`、`fulfillment`、`inventory`、`store`。其中 7 个业务包与 `modules/*/src/main` 共享包名。

**后果**：任何只扫 `modules/*/src/main` 的检查器（含 `tools/module-dependency-registry/check.mjs`）**永远扫不到那 68 个事务边界**。这是当前分层问题的根，不是细节。

**（二）adapter 只覆盖 35%。**
`RESOLVED=68 / UNRESOLVED=128`（合计 196）。128 = **83 READ + 45 COMMAND**。缺 adapter **不是读路径专属**——45 个命令同样没有 adapter 类。所以"edge → Operation"这条路径对 65% 的操作不存在。

**（三）Spring `REQUIRED` 是 start-or-join。**
全仓 598 处 `@Transactional`：裸 **269** / `readOnly=true` **236** / 显式 `REQUIRED` **72** / 含 `noRollbackFor` **21**。`REQUIRES_NEW` / `NOT_SUPPORTED` / `NEVER` / `MANDATORY` **各 0**。

**推论**：零 `REQUIRES_NEW` **不等于**零事务起点问题。`REQUIRED` 在无外层事务时**就是起点**。谁是起点取决于运行时调用链，静态判不了。要静态判定唯一的办法是非入口层一律 `MANDATORY`，而全仓 `MANDATORY` 现为 0，迁移面 530 处注解 / 46 文件——**属重构，不是防回归**。

---

## 第二节 · 新增功能怎么写（编写期指引）

### 2.1 新增一个 operation

1. **先决定它是命令还是读**，并在 `contracts/registry/operation-handler-bindings.json` 有对应声明（`mode` / `transactionMode` / `ownerCount`）
2. **命令**：建 `<Pascal>Operation` 类，`@Component`，`execute` 方法标 `@Transactional(propagation = REQUIRED)`。**事务边界只在这一层声明**
3. **读**：当前读没有 adapter 类，走 owner 的 `read(String operationId, ...)` switch 分派。**新增读时先问：要不要为它建 adapter？** 不建就要接受它落在 `UNRESOLVED` 里
4. **跨模块**：只经 `*Api` / `*Lookup` 接口。若发现必须直接依赖别人的 `..application..`，**停下来问人**——那是设计信号，不是实现细节

### 2.2 声明与代码必须对齐，两边都可能是错的那一边

仓内已知的三类不一致，新增功能时不要复制：

- **`ownerCount` 与实际注入不符**：已知 5 条（`createOperationsOrganizationStore`、`updateOperationsOrganizationStore`、`transitionOperationsOrganizationStoreStatus` 均 contract+organization；`releaseOperationsCatalogStagedAsset` catalog+asset；`transitionOperationsCatalogItemStatus` catalog+inventory）。另有 `saveOperationsCatalogItem` 的 javadoc 自述跨三 owner 而声明 `ownerCount: 1`
- **`transactionEvents: 0` 与实际开着只读事务不符**：78 个 `TASK_READ` 行声明 `OUTSIDE_TRANSACTION` / `transactionEvents: 0`，而 3 个 owner 读入口全部带 `@Transactional(readOnly = true)`
- **bindings 声明的 adapter 类不存在**：128 个

**遇到不一致时，先判断该改哪一边。** `readOnly = true` 常是为保证一次读的快照一致性——若确有依赖，该改的是声明；若没有，该摘注解。**这是业务判断，不要默认改代码。**

### 2.3 不要做的事

- 不要在 edge 直接注入 owner service（已有 75 处，别再加）
- 不要用 `REQUIRES_NEW` 制造新事务起点（全仓目前 0，保持）
- 不要手工编辑 `operation-handler-bindings.json`（生成器产物）
- 不要在 owner service 之间直接依赖对方的 `..application..`

---

## 第三节 · 怎么查问题（核验纪律 —— 本 skill 最重要的一节）

> 这一节的每一条都来自真实事故。写这份 skill 的过程中，作者在两版文档里累计出现 14 处事实错误，全部属于下列形态，**没有一处是因为不懂分层**。

### 3.1 分母必须自己跑命令算

**不得引用另一份文档的数字。** 事故：「既有 ArchUnit 28 条」是从上一份文档原样搬运的，实际是 **9 条**，而且这个错误数字被用来论证「新地不冲突」——实际那 9 条里有一条与新规则直接重复。

**规则**：写进结论的每个数字，必须在**同一次会话里**跑命令得出，并保留命令。

### 3.2 `grep -c` 数的是行数，不是出现处数

事故：`new *Operation(` 报 15 处，实际 **44 处**——一行里有多个调用点。低估约 3 倍，而这是「便宜」论证的唯一成本依据。

**规则**：计数用能数出现次数的方式（如 `grep -o ... | wc -l` 或脚本），并声明口径。

### 3.3 否定式结论必须穷举后才能写

事故：文档写「该 operation 不出现在任何 `*seed-report*` 中」并据此下了禁用令。实测命中 **82 个文件**，其中就包括作者本人十分钟前用来计算的那一份。

**规则**：任何「不存在 / 没有 / 零」的结论，必须先跑一次覆盖全部候选路径的检索。**否定一个自己产出过的证据，是最容易犯也最难被发现的错误。**

### 3.4 一个事实不能替代另一个事实

事故：把「edge 层 `@Transactional` = 0」（为真）当成「edge 不直接依赖 owner service」（为假，75 处），于是把整份文档最大的一笔迁移成本写成了零。

**规则**：一条规范有几个子句，就要分别测几个数。别用一个子句的绿去代表整条。

### 3.5 判据选错会差一个数量级

事故：判断 adapter 的跨模块依赖，用 **import 扫描**得 29 条，用**构造注入字段**得 **5 条**，高估 24 条。原因是 import 里有大量只作类型引用的符号（如 `CatalogScopeLookup`）。

**另一例**：用 `\b符号\s*\(` 匹配函数调用，会漏掉**泛型调用** `envelopeData<T>(...)`，导致真值断言被误判成未使用。

**规则**：判据要先在已知样本上验一遍（正例必中、反例必不中），再拿去扫全量。

### 3.6 分类结论必须给判据和分母

事故：文档写「97 个未匹配类」，但没给判据。按其自述的分类标准复算是 **136**；97 只在把 `*OwnerService`(3) 偷换成 `*Service`(58) 且少记一个 `*Coordinator` 时才成立。

**规则**：任何分类数字，必须同时给出分类判据、总分母、各桶计数，且各桶之和等于总分母。

### 3.7 「已存在」不等于「已在跑」

事故：文档称 `module-dependency-registry` 的 checker「已存在且已在跑」，据此论证补数据零成本。实测它**不在 execution catalog 的 17 条 entry 里，也不在 verify 的 runtimeCommands 里**；唯一调用点传的是 `--require-empty`，而该参数**恰好跳过** `validateSourceFacts`。补完 5 个模块后实测**新增检出 0**。

**规则**：说一个门在生效，必须指出它在哪个执行清单的第几条，并跑一次看它真的执行。

### 3.8 区分「我测的」「我推的」「我引的」

每条结论标注来源。推论要写清依赖哪些前提，前提被推翻时推论一起作废。

**事故示例**：从「全仓零 `REQUIRES_NEW`」推出「零事务起点违规」——前提为真，推论为假，因为 `REQUIRED` 本身就是起点语义。

---

## 第四节 · 怎么落改动

### 4.1 对齐方向是业务判断，门只判不一致

发现「声明与代码不符」时，**不得默认改代码**。逐条给出结论与理由：改代码 / 改声明 / 显式接受。写进证据，不得空着。

### 4.2 两条建议先做的锚（都今天就会红，且不受 split package 影响）

**锚一：owner 包不得依赖另一 owner 的 `..application..` / `..adapter..` / `..domain..`**
泛化既有的 `ORGANIZATION_DOES_NOT_REACH_WORKSPACE_INTERNALS`（`BackendModuleBoundariesTest.java:42-44`）。今天红 **24 处**。
**它键在 owner 前缀而不在物理位置**，所以 app 树与 modules 树的 split package 不影响它。

**锚二：app 源根 `com/catering/v2s/` 下除 `app/` 外不得有编译单元**
今天红 **69 处**。做完之后 split package 消失，**所有 `modules/` 域的既有检查器自动覆盖那 68 个事务边界**——这一条的价值不是新增检查，是**让既有的检查开始生效**。

两条都是几行规则。**不要因为红得多就调宽判据**；要么分批迁移，要么显式记录未迁移集合。

### 4.3 用量问题走既有 harness，不要新建

`src/test/java/database/P4SqlOperationBudgetTest.java` 是**方法级 SQL 预算 harness**：`CountingDataSource` 数真实语句执行，绑定 `doc/evidence/platform/rm1/p4/canonical-performance-ledger.json`，自带 `SQL budget exceeded` 红控制，当前覆盖 **25 条 ledger 行 / 23 个不同 `Class#method`**。

要治「某个接口 DB 调用太多」，**扩它的覆盖面**，不要另起炉灶。

### 4.4 门的位置

- **不要**把需要编译的检查放进 per-edit 钩子。per-edit 门失败会阻塞 post receipt 造成控制面自锁，仓内已有先例
- 结构检查放 `scripts/verify`（经 `ARCHUNIT_SELECTOR`）
- 新增门前先过三问：反复发生？纯机械？维护成本小于返工？任一为否就不建

---

## 第五节 · 什么时候停下来问人

- 需要跨模块直接依赖对方内部包
- 需要为读建 adapter 类（会改变 196 的形态分布）
- 需要改 `operation-handler-bindings.json` 或 shape matrix 的声明
- 发现声明与代码不一致，但看不出该改哪边
- 一条规则会红超过 50 处

**这些都不是实现细节，是设计裁决。**

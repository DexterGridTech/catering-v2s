# 分层调用约束需求（第二版 · Claude）

> **第一版已作废，不要引用。** 它提出四条理想分层规范，经两个 fresh 独立子 agent 盲审后被证伪：四条是从**理想分层**推出来的，不是从**仓内实际形态**推出来的。作废清单见 §1。
>
> 本版换方向：**先给现有形态一个完整分类，再只做迁移量已知且便宜的三件事。**

- 会话出处：fresh v2s-rooted 会话，本文件为唯一写入。未运行任何动态环境。
- 亲验声明：下列全部数字为我在本轮**重新扫描**所得。第一版有 4 处数字直接错误，本版每个数字都复算过。

---

## 1. 第一版被证伪的内容（供交叉核对，勿再引用）

| 第一版说法 | 实测 | 性质 |
|---|---|---|
| 「L1 违规量 **0**，edge 已干净」 | edge 直接注入 `*Service` / `*Coordinator` **75 处 / 32 文件 / 28 种类型**（`WorkspaceAdministrationService` 10、`PlatformAssetService` 7、`WorkspaceUserService` 7、`BusinessEntityService` 5…） | **严重**。我把"edge 层 `@Transactional`=0"（属 L2，为真）当成了 L1 合规，把最大一笔迁移成本写成零 |
| 「既有 ArchUnit **28 条**」 | **9 条**（`static final ArchRule` 9 / `@ArchTest` 9 / 另 6 个红夹具 `@Test`） | 错误，且我用它论证"新地不冲突"；实际 9 条里 `EDGE_DOES_NOT_TOUCH_PERSISTENCE` 与我 L1 第二子句**直接重复** |
| 「L2 起点违规 **0**（零 `REQUIRES_NEW`）」 | 范畴错误。Spring `REQUIRED` 本身是 **start-or-join**，无外层事务时**它就是起点**。零 `REQUIRES_NEW` 不蕴含零起点违规 | 概念错 |
| 「propagation：裸 289 + readOnly 237」 | 裸 **269** + readOnly **236** + 显式 REQUIRED **72** + **`noRollbackFor` 21**（我把这 21 处静默并进了另两桶，而 `noRollbackFor` 改的正是回滚语义） | 分桶错 |
| 「四条成立后那些问题结构上不可能发生」 | 与本文档 §7 自述「用量做完一次都不会少」**自相矛盾**；且有反例：`saveOperationsCatalogItem` 三 owner 扇出而四条全绿 | 断言过度 |
| 未提更小方案 | `contracts/policy/module-dependency-registry.json` + `tools/module-dependency-registry/check.mjs`（455 行）**早已存在**，带模块判据与 typed edge | 违反「说明为什么不是更小方案」 |

---

## 2. 先分类：仓内实际有哪些形态

第一版只认四层，结果**匹配不到全仓最关键的类**。实际形态至少七种：

| 形态 | 标识 | 数量 | 关键事实 |
|---|---|---|---|
| edge controller | `..app.edge..` | 321 文件 | `@Transactional` **0**；但直接注入 owner service **75 处/32 文件** |
| 生成 bindings | `..app.edge.generated..` | 1 | 113 个命令的 edge→Operation 这一跳实际由它承担，**包在 edge 内** |
| operation adapter | `*Operation` 类 | **真实存在 69**（bindings 声明 196） | 68 个是 bindings adapter，各恰 1 处 `@Transactional`；第 69 个 `app/edge/diagnostic/PublicSecurityOperation.java` **住在 edge 里** |
| owner api | `*Api` / `*Lookup` | — | 跨模块契约，但**不是唯一实际路径** |
| owner service | `*OwnerService` | 3 | 85 处 `@Transactional`；`read(String operationId,…)` 三处全带 `readOnly=true` |
| **coordinator** | `*Coordinator` | 1 | **`CatalogInventoryCoordinator`：`@Service` 但不叫 `*Service`，独占 43 处 `@Transactional`，是 catalog 全部 15 个读的实际入口，被 edge 直接注入。第一版四层对它全部失效** |
| task read service | `*TaskReadService` | 多个 | 83 个读操作的实际承载者 |

**关键结构事实：`RESOLVED=68 / UNRESOLVED=128`，而 128 = 83 READ + 45 COMMAND。** adapter 缺失**不是读路径专属**——第一版把 `selectOperationsWorkspaceSessionDataNode` 说成读，它实际是 `mode: COMMAND`。

**结论**：在给这七种形态一个稳定分类之前，任何"层与层之间只能怎么调"的规范都会落空。**分类是前置工作，不是可选项。**

---

## 3. 只做三件事（迁移量已知、便宜、不需要新基建）

### 3.1 补全 `module-dependency-registry` 缺的 5 个模块 —— 最高性价比

**现状**：registry 按 `sourceRoot` 覆盖 **9/14** 个模块，`edges` 24 条。**未覆盖的 5 个是** `catalog`、`inventory`、`fulfillment-production`、`audit-read`、`foundation` —— **我全部发现所在的 catalog 家族整个在外**。

**为什么它优于新写规则**：
- 已有 `moduleKey` / `sourceRoot` / typed edge（`COMMAND` / `VALUE_API` / `SCHEMA_FK` / `TASK_READ`）+ 每条边的 rationale
- **按 Gradle `sourceRoot` 判定，天然不受 split package 影响**——而 app 树与 modules 树共享 6 个包（`catalog.application` 等），任何键在包名的 ArchUnit 规则在这里都判不准
- checker 已存在且已在跑，补数据不需要写代码

**动作**：为这 5 个模块补 `moduleKey` / `sourceRoot`，并把 catalog→inventory / asset / production 等真实跨模块边显式登记为 typed edge 并写 rationale。

**验收**：14/14 模块入册；catalog 家族的跨模块边全部有 typed edge 与 rationale；`check.mjs` 的 `validateSourceFacts` 覆盖到这 5 个模块。

### 3.2 `*Operation` 禁止被 `new` —— 15 处，真假绿

**事实**：edge 内有 **15 处 `new *Operation(`**，绕过 Spring 代理，Operation 上的 `@Transactional` **一次都不会触发**。而依赖方向检查看到的是 edge→`*Operation`，**判定合法**。测试走这条无事务路径会绿，生产语义不同。

**规则**：`*Operation` 只能由容器注入，禁止 `new`。ArchUnit 可直接表达，迁移量 15 处。

**注意**：`app/edge/diagnostic/PublicSecurityOperation.java` 是住在 edge 里的 `*Operation`。若规则键在名字，它会成为"edge 调 Operation 天然合法"的后门形态；实施时必须显式处置（归类或改名）。

### 3.3 固定生成物的层归属 —— 否则规则要么永真要么全红

113 个命令的 edge→Operation 这一跳由 `..app.edge.generated..` 的 bindings 承担，而它的包**在 edge 内**：

- 若按包名算作 edge：手写 controller 只调生成物，任何"edge 只能调 Operation"的规则对手写代码变成**永真式**
- 若把生成物排除出分析范围：所有 controller 看起来都不调 Operation，规则**全红**

**动作**：在规则里显式声明生成物的层归属，并补红变异——改动生成器使 binding 输出到非 edge 包时必须红。

---

## 4. 明确不做（本阶段代价不配）

| 第一版条目 | 真实迁移量 | 判断 |
|---|---|---|
| 「事务起点只由 `*Operation` 声明」 | 唯一可机械表达的形式是"非 `*Operation` 层必须 `MANDATORY`"。全仓 `MANDATORY` 现为 **0**，迁移面 **530 处注解 / 46 文件**，且一改就打断 83 个读 + 45 个无 adapter 的命令 | **月级重构，不做**。按 CLAUDE.md 右尺寸标尺（分钟级、零基建、防回归），这是重构不是防回归 |
| 「持久化只能被本模块 owner service 依赖」 | 仓内**没有持久化层**：直接持有 `JdbcTemplate`/`DataSource` 的类约 **50 个**，而叫 `*OwnerService` 的只有 **3 个**。落地要么新建 repository 层搬 50 个类的 SQL，要么把 44 个 service 改名合并 | **月级重构，不做**。跨模块读别人 schema 这件事，`check.mjs` 的 `validateSourceFacts` 已在做（扫 `schema.` 字面量并要求有 `TASK_READ` 边），补全 §3.1 即可覆盖 |
| 「edge 不得依赖持久化」 | 与既有 `EDGE_DOES_NOT_TOUCH_PERSISTENCE`（`BackendModuleBoundariesTest.java:56-63`）**完全重复** | **不新增**。另注意 edge 已 import `platform.foundation.persistence` 下的诊断类若干处，规则若键在 `..persistence..` 包名会误报 |

**edge→owner service 那 75 处**：本版**不提规则**，先按 §3.1 把它们登记为 typed edge 并写 rationale。**先看清楚再决定要不要禁**，不要用一条规则把 32 个 controller 一次打红而没有承接批次。

---

## 5. 无感：新功能如何自动带上

不再依赖第一版那套"四层标识 + UNRESOLVED 棘轮"（因为异形态**今天就是主干**，基线不是 0）。改为：

- **靠 registry 的模块分母**：`check.mjs` 遍历 `registry.modules`，新增模块必须入册才被检查——所以**入册本身要成为门**：`modules` 集合必须等于 `modules/` 目录集合，不等即红。这一条把"新模块自动纳入"变成机器事实
- **靠 typed edge 的 rationale**：新增跨模块调用必须登记边并写理由，否则 `validateSourceFacts` 红
- **不再声称"开发者不需要知道规范"**：第一版这句过度了。真实机制是"新增跨模块调用会被要求登记"，这需要开发者做一个动作，只是那个动作很轻

**第一版关于 bindings 生成器的说法也要更正**：`scripts/generate/operation-handler-bindings.mjs` 把分母**硬编码**为 `EXPECTED_COUNTS = {operations: 196, …}`，新增第 197 个 operation 会让生成器直接失败并需人工改常量。**"新 operation 自动进入分母"不成立**，登记欠账。

---

## 6. 边界与欠账

**本版三件事管不了的**：

- **用量**。`createOperationsOrganizationStore` 的 41 次、`selectOperationsWorkspaceSessionDataNode` 的 24 查询比 1 写，做完一次都不会少
- **owner 扇出**。`saveOperationsCatalogItem` 类注释自述"across catalog, inventory and asset owners"，matrix 却声明 `ownerCount: 1` / `OWNER_COMMAND_SINGLE_OWNER`；全仓 `OWNER_COMMAND_CROSS_OWNER` 声明了但计数为 0。**这是声明与实现的系统性不一致，不是几条个案**
- **78 个 `TASK_READ` 的 `transactionEvents: 0`** 与源码上普遍开着 `readOnly=true` 事务的事实系统性不一致。第一版说"3 处待裁决"，范围划小了

**欠账**（登记 `HANDOFF.md`，本次不做）：
- 运行时用量对账（原两份文档的设计保留备查）
- bindings 生成器的硬编码分母
- `standards-enforcement-execution-catalog.json` 中 `ARCHUNIT_SELECTOR` 的 dependency 只钉 9 个文件，加规则后会系统性不完整
- 仓内已有 `P4SqlOperationBudgetTest`：方法级 SQL 预算 harness，`CountingDataSource` 数真实语句，已覆盖 **25 条 ledger 行 / 23 个不同方法**。将来治用量应扩它，而非新建

---

## 7. 批次

| 批次 | 内容 | 验收 |
|---|---|---|
| **R0** | 形态分类（§2）写进证据 | 七种形态各有标识与数量；97 个未匹配类有归属结论 |
| **R1** | 补全 registry 5 个模块 + catalog 家族 typed edge（§3.1） | 14/14 入册；`validateSourceFacts` 覆盖 5 个新模块；模块集合相等断言上线 |
| **R2** | `*Operation` 禁止 `new`（§3.2） | 15 处清零；`PublicSecurityOperation` 有显式处置 |
| **R3** | 生成物层归属（§3.3） | 层归属显式声明；生成器输出到非 edge 包必红 |

**红变异**：新增模块不入册必红；新增跨模块调用无 typed edge 必红；`new *Operation(` 必红；生成物输出到非 edge 包必红。

---

## 8. 授权边界

本文档是需求分析，不是实施授权，也不是评审结论。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器。§6 中 `createOperationsOrganizationStore` 的 41 次等用量数字，我在本轮**未能在仓内 seed 报告中找到出处**（该 operation 不出现在任何 `*seed-report*` 中），标 `UNVERIFIED`，不得作为实施依据。

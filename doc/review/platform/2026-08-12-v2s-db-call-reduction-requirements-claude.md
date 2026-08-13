# 无用数据库调用的收敛：需求（第二版）

- 目标：降低每请求 DB 调用次数，并使其不再回涨。
- 范围：A 类事务开销对齐、B 类 SQL 用量台账。跨模块越界、JPMS、`Propagation.MANDATORY` 登记欠账。
- 未运行 Testcontainers / DEV / L2 / reset / seed。

---

## 0. 前置状态

per-edit control-plane P0–P3 **已实施并通过 implementation review**。当前 `print-delta` 正常、mandatory per-edit self-test 全绿。

**新实施包 admission 时只需复核当前控制面健康状态；不得重新执行或重开已关闭的 P0。**

---

## 1. 现状分母

seed run `rm1-seed-7e38f313`：173 次 API 调用 / 41 个端点 / 3212 次 DB 操作。

| 类型 | 次数 | 占比 |
|---|---|---|
| CONNECTION | 438 | 13.6% |
| TRANSACTION | 876 | 27.3% |
| QUERY | 1283 | 39.9% |
| UPDATE | 615 | 19.1% |

连接 + 事务 = 1314（40.9%）。

---

## 2. A 类 · 事务开销对齐

### 2.1 真实运行分母（**非** legacy dispatcher）

**处置对象是 16 个 GET operation 的真实执行链**：

```
GET operation → CatalogInventoryCoordinator 具名方法 → owner 具名方法
```

- bindings 中 `owner ∈ {catalog, inventory, fulfillment-production}` 且 `mode=READ` 的 operation 恰 **16 条**
- `CatalogInventoryCoordinator` 有 **16 个 `@Transactional(readOnly = true)` 具名方法**——**真实事务起点在这里**
- `CatalogTaskReadService` / `InventoryTaskReadService` / `ProductionTagTaskReadService` **各 0 处 `@Transactional`**

**三个 `read(String operationId, ...)` legacy dispatcher 不是真实运行分母。** 它们即便被调用也是嵌套在 coordinator 事务内（`REQUIRED` 语义为 join），**摘掉其注解不会减少任何 CONNECTION 或 TRANSACTION**。

### 2.2 逐 operation disposition（16 条，一条不得空）

对每个 GET operation 沿真实执行链判断，三选一：

| disposition | 判据 | 动作 |
|---|---|---|
| `KEEP_OUTSIDE_TRANSACTION` | 零查询或单查询 | 保持 `OUTSIDE_TRANSACTION`，移除运行链上多余事务 |
| `REMOVE_BEST_EFFORT_TRANSACTION` | 多查询但只要求 best-effort 一致 | 移除真实运行链上的多余事务 |
| `REQUIRE_STABLE_SNAPSHOT` | 真正要求稳定快照 | **优先合并为 set-based SQL**；不可合并时显式设计隔离级别与异常语义 |

### 2.3 必须纠正的隔离级别判断

第一版把「是否依赖同一事务内多查询看到同一快照」当作保留 `readOnly` 事务的理由。**该判断不成立。**

PostgreSQL 默认 `READ COMMITTED` 下，**同一事务内连续 SELECT 仍可能看到不同快照**。仓内当前**没有任何显式更高隔离级别声明**。

所以：普通 `@Transactional(readOnly = true)` **不提供**多查询稳定快照。真需要快照的场景必须走 §2.2 第三类，显式设计隔离级别，或改用 set-based SQL 一次取回。

### 2.4 红变异必须由 disposition 派生

**不得在 D1 完成前预设"所有入口都应摘事务"。** 红变异的正确形态：

> 被判定为 `KEEP_OUTSIDE_TRANSACTION` / `REMOVE_BEST_EFFORT_TRANSACTION` 的**真实 coordinator/owner 入口**重新出现事务 → 必红。

判定为 `REQUIRE_STABLE_SNAPSHOT` 的入口保留事务，不在红变异分母内。

---

## 3. A 类 · coordinated-owner command shape（五条 ownerCount）

### 3.1 五条均为 `DECLARE_2 / KEEP_IMPLEMENTATION`

以下五条的双 owner 实现**承担真实业务职责，不得为维持 single-owner 声明而删除**：

| operation | owners | 第二 owner 的职责 |
|---|---|---|
| `createOperationsOrganizationStore` | organization + contract | 响应组装与 contract 状态 |
| `updateOperationsOrganizationStore` | organization + contract | 同上 |
| `transitionOperationsOrganizationStoreStatus` | organization + contract | contract 状态 |
| `releaseOperationsCatalogStagedAsset` | platform-asset + catalog | catalog 引用检查 |
| `transitionOperationsCatalogItemStatus` | catalog + inventory | inventory VOIDED 依赖判断 |

### 3.2 只改 `ownerCount` 数字会产生内部矛盾

五行当前同时声明 `OWNER_COMMAND_SINGLE_OWNER`，且生成器把 command 的 `ownerCount` 固定为 1。

**必须同步设计或复用 coordinated-owner command shape**，一并更新：`shapeClass`、`ownerCount`、预算公式、生成器、红变异。

### 3.3 `ownerCount` 判据

> 统计 production adapter 中**实际可达调用**所使用的、**按 owner 去重**的业务事实 owner API 构造字段。
> **排除**：context resolver、fact loader、DTO、静态类型引用、纯 import。**同一 owner 的多个 API 只计一次。**

已证实的误判样本：`CreateOperationsCatalogItemOperation` import 了 `organization.api.CatalogScopeLookup`，那是类型引用不是注入依赖，用 import 判据会误判。（第一版声称的「多判 24 条」**无可复算清单，本版删除该数字**，只保留此样本。）

---

## 4. B 类 · SQL 用量台账

### 4.1 前置：先修复台账当前漂移

`scripts/check/canonical-performance-ledger check` 当前 **FAIL**：

```
CANONICAL_PERFORMANCE_LEDGER=FAIL
REASON=CANONICAL_LEDGER_CANDIDATE_SCAN_DRIFT
```

ledger 声明 **721** candidates，当前重算 **730**。**先对新增 9 项逐条 disposition、恢复静态检查 PASS，才能把它当作基线使用。**

### 4.2 执行拓扑（修正）

`P4SqlOperationBudgetTest` **没有**独立的 execution-catalog entry，但**普通 `scripts/verify` 会经 `U02-backend`（`:apps:backend:catering-business-server:test` 根 test task）间接执行它**。只有 `scripts/verify --validate-only` 不执行动态 P4。

**不需要重复接线。**

### 4.3 三个 operation 的方法级测量映射（D3 前必须闭合）

必须先建映射表，字段至少含：`operationId` / `ledgerId` / `caseId` / `callerSymbol` / `invocationSource` / `measurementBoundary` / `fixture`。

候选承载方法：

| operationId | callerSymbol |
|---|---|
| `createOperationsOrganizationStore` | `CreateOperationsOrganizationStoreOperation#execute` |
| `selectOperationsWorkspaceSessionDataNode` | `WorkspaceAuthenticationService#selectDataNode` |
| `getExtensionDefinition` | `ExtensionDefinitionService#platformManagementDefinition` |

**必须明确 `measurementBoundary`**：P4 测的是 HTTP 全链路，还是目标方法及其共享 counted DataSource 的子调用。

**不得把 seed 的 41 / 34 / 12 直接填成方法级 `expectedStatements`**——那是端点级 HTTP 计量，与方法级边界不同。

### 4.4 accepted baseline 与升值归因（棘轮的可执行形式）

**现有 P4 无法证明"只能降不能升"**：它只比较本次 `expectedStatements` 与本次实际 SQL 数。实现增加 SQL 同时把 `expectedStatements` 调到新实测值，测试仍 PASS。当前台账与 scanner **没有独立的前一接受值，也没有升值归因判据**。

**要求**：增加**独立、不可随当前 ledger 一起静默改写**的 accepted / entry baseline。预算升值 disposition 至少含：

- `previousExpectedStatements`
- `currentExpectedStatements`
- `reason`
- `owningSource` 或 `sourceEvidence`
- 明确的**批准状态**

**production checker 必须比较接受基线与当前值**，并用真实红变异证明「只调高当前 `expectedStatements`、无合法归因」会失败。

---

## 5. 验收顺序（固定）

1. 复核当前控制面健康状态（§0）
2. 重建 16-operation 事务分母并完成逐 operation disposition（§2）
3. 闭合 coordinated-owner command shape（§3）
4. 处置 canonical ledger 721 → 730 漂移，恢复静态 PASS（§4.1）
5. 固化三个 operation 的方法级测量映射（§4.3）
6. 建立 SQL 预算 accepted baseline 与升值归因（§4.4）
7. 为每项控制指定 production validator 与真实 red mutation
8. 定义动态前后对比

---

## 6. 红变异

- 判定为 `KEEP_OUTSIDE_TRANSACTION` / `REMOVE_BEST_EFFORT_TRANSACTION` 的真实 coordinator/owner 入口重新出现事务 → 必红
- 五条 coordinated-owner command 的 `shapeClass` / `ownerCount` / 预算公式任一不自洽 → 必红
- adapter 新增业务事实 owner API 构造字段而不更新 `ownerCount` → 必红
- `ownerCount` 判据退回 import 扫描 → 必红（样本 `CreateOperationsCatalogItemOperation`）
- 只调高 `expectedStatements` 而无合法升值归因 → 必红
- 某方法实测语句数超台账 → 必红
- canonical ledger candidate 分母漂移未处置 → 必红

---

## 7. 动态验收（第 8 步）

前后对比必须固定同一：`seedProfile`、operation 分母、fixture 版本、report schema，且要求 **business PASS 与 cleanup PASS**。

判据：CONNECTION 与 TRANSACTION 下降，QUERY 与 UPDATE 不上升。QUERY/UPDATE 上升说明移除事务后出现额外往返，是回退信号。

**seed 只覆盖 41 个 operation，不得把下降表述为"全部达标"。**

---

## 8. 欠账（本次不做）

- JPMS 模块边界
- `Propagation.MANDATORY`（迁移面 530 处注解 / 46 文件）
- 泛化 `ORGANIZATION_DOES_NOT_REACH_WORKSPACE_INTERNALS`

---

## 9. 授权边界

本文档是需求分析，不是实施授权，也不是评审结论。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器 / UAT / 部署。读取历史 PASS seed 报告不代表重新执行动态验证，也不代表性能目标已达成。

# BACKEND-PERFORMANCE M1 命令优化 —— Claude 独立静态审查

`VERDICT=GO`　`M=0`　`S=1`　`N=1`

**68 条命令的运行时链我逐条机械核验，架构目标全部达成**：每操作一个非 final `@Component` adapter、
`@Transactional(REQUIRED)` 入口、零泛型分发、owner 复核在 receipt replay 之前、
跨 owner readback 在同一事务内完成。

唯一的 S 是**执行矩阵对 42 条命令的 edge 声明与真实 HTTP 链不符**，
并因此留下 42 个未被引用的 generated 方法。它不影响任何命令的正确性，但矩阵是门的权威输入，
按它去核验会核到错误的路径。

**本审查不构成任何 SQL 数值收益结论**：本次 seed 无同口径前后 baseline，
`BP_U07_SNAPSHOT=NOT_SUPPLIED_UNMEASURED` 保持。**浏览器 L2 未闭合，seed PASS 不等于 L2 或 UAT PASS。**

## 0. 会话出处、边界与覆盖披露

续接会话，非 fresh v2s-rooted acceptance。本仓零写入（除本文件）。未执行任何 reset、seed、L2、部署、SQL、SSH。

**我实际核验与未核验的范围（请据此判断本结论的适用面）**：

已独立机械核验：68 行 adapter 属性、generated binding 内部闭合、build closure、
幂等策略分布、responseMode 分布、`ExtensionSubmission` 形态、owner 复核与 receipt 顺序、
Store 命令的同事务跨 owner 组合、M1 adapter 是否触碰泛型 read 分发器、seed 报告内部完整性。

**未独立核验**（本结论不覆盖，请勿据本文件认为已通过）：
catalog P1 generated transport 的 Jackson 3 / `CanonicalJsonDocument` 源码实态、
`AUTO_SYNC` 与 `EXTERNAL_ORDER_TEMPORARY` 的 `NOT_APPLICABLE_WITH_REASON` 政策文件、
package exit 的 386 条 changedPaths、HeadCompany 与 Contract 响应形状的逐字段比对。

**一次作废的实验**：我在 scratchpad 上试图变异矩阵的 `edge.methodName` 以测门是否拦截，
但拷贝缺少 P1 生成产物导致基线本身即红（`BP_U07_M1_P1_BACKEND_WIRE_INPUT_INVALID`）。
**该实验作废，我对"门是否会捕捉 S-01 这类偏差"不作任何判断。** S-01 不依赖该实验，见其证据。

---

## 1. 68 条运行时链的逐条机械核验 —— **通过**

### 1.1 adapter 属性（68/68）

对矩阵 68 行逐条打开 `adapterSourcePath`：

| 检查项 | 结果 |
|---|---|
| adapter 源文件存在 | **68/68** |
| `@Transactional(propagation = Propagation.REQUIRED)` | **68/68** |
| 未被声明为 `final` | **68/68**（0 条 `public final class`） |
| 一个文件一个 class | **68/68** |
| 类内含 `OPERATION_ID` 字面量 | **68/68** |
| import 之外出现 `Map<` / `ObjectNode` / `JsonNode` / `Function<` / `switch (operationId)` / `operationRegistry.resolve` | **0 条** |

### 1.2 generated binding 内部闭合（68/68）

`BackendPerformanceM1CommandExecutionBindings.java` 共 521 行、**68 个 public 方法**。
我对每一行做了精确匹配而非包含匹配：

- 每个 `bind<Op>` 方法体内的 `X.execute(` 调用**恰为**其同名字段，`calls != [operationId]` 的行数为 **0**；
- 每个字段声明**恰为** `private final <矩阵声明的 adapterFqcn 简名> <operationId>;`，不符的行数为 **0**；
- 注入的 `*Operation` 字段总数为 **68**；
- binding 体内（去 import 后）无泛型/分发形态。

### 1.3 build closure —— **通过**

`apps/backend/catering-business-server/build.gradle.kts`：
`sourceSets.named("main")` 同时 `java.srcDir` 了 catalog-inventory-P1 与 M1 两个生成目录（`:51-54`）；
`tasks.named("compileJava")` 同时 `dependsOn` 两个生成任务（`:56-59`）。
生成产物是构建产物、进 main 源集，不是第二份手写实现面。

---

## 2. 业务语义核验 —— **通过**

### 2.1 owner 复核在 receipt replay 之前 —— **满足**

这是本轮最要紧的一条，我一开始查到的是反向证据，往上一层看才判定通过，过程如实记录：

`BusinessEntityCommandReceiptService.execute(...)` 内部确实是 **receipt 先短路**：

```java
Receipt existing = claim(workspaceUuid, idempotencyKey, canonicalRequest);
if (existing != null) return deserializer.apply(existing.responseJson());
… command.get() …
```

但**调用方在进入该服务之前已经做完复核**。`BusinessEntityService.createStore(command)`：

```java
UUID ownerProjectId = requireProjectId(workspaceUuid, groupWorkspaceKey, projectId);      // ① 目标事实复核
requireOwnerGrant(command.ownerScopeGrant(), …, ServiceNodeTypes.PROJECT, ownerProjectId); // ② 授权复核
return receipts.execute(…, canonical("createStore", …, command.extensionSubmission()), …); // ③ receipt claim
```

`updateStore` 同形（`requireStoreProjectId` + `requireOwnerGrant` 在 `receipts.execute` 之前，
另加 `ownerProjectId.equals(command.projectId())` 的一致性校验）。
**目标事实与授权两类复核都在 receipt replay 之前**，符合红线
「Receipt claim, owner recheck, CAS, audit and typed denial remain intact」
与「must never globally move receipt lookup ahead of owner recheck」。

另一处正面证据：`command.extensionSubmission()` 已进入 `canonical(...)`，
即扩展字段参与幂等键，改扩展值不会被误判为同键重放。

### 2.2 幂等策略分布 —— **53 / 15，与声称一致**

我按矩阵行的 `ownerInvocation.idempotencyPolicy` 归类：
**header 53 条 + header/body matching 15 条 = 68**，与你给的数字逐项相符。

### 2.3 事务边界与跨 owner readback —— **符合已裁决形态**

`CreateOperationsOrganizationStoreOperation` 是我逐字读的样本：

```java
@Transactional(propagation = Propagation.REQUIRED)
public Result execute(OperationsStoreCommandApi.CreateStoreCommand command) {
    OrganizationEntityReadback store = stores.createStore(command);
    return new Result(store,
        organizationDetails.readStoreDetail(new …StoreDetailQuery(…, store.id())),
        contractStatuses.readDerivedStoreStatus(new …StoreStatusQuery(…, store.id())).status());
}
```

**owner 命令 + organization detail + contract 派生状态三段全部在同一 `REQUIRED` 事务内完成**，
adapter 只持有三个 typed 端口、无 repository/JDBC、无业务规则、返回 typed `Result` 由 edge 映射。
这正是 2026-08-10 裁决的第一条形态（同事务内具名 typed composition producer），
也消除了原先 `OperationsStoreManagementController:74` 在命令后于 edge 侧补两次跨 owner 读取的旧形态。

`responseMode` 分布实算 **`OWNER_READBACK` 66 / `NO_CONTENT` 2**，无第三种取值。
`StoreWireMapper` 与 `ContractWireMapper` 均仍存在且由各自 controller 引用，未新建替代 mapper。

### 2.4 `ExtensionSubmission` —— **与裁决完全一致，并闭掉了 null 歧义**

`modules/extension/…/api/ExtensionSubmission.java`：

```java
public record ExtensionSubmission(List<ExtensionFieldValue> fields) {
    // 省略字段：fieldKey / valueJson / mode(SET|CLEAR)
    // 重复 fieldKey 抛错
    // mode == SET 且 valueJson 为 null 或 "null" 时抛
    //   "extension SET requires canonical JSON distinct from null"
}
```

三态清晰：**字段不出现在 list 中为未提交、`SET` 为赋值、`CLEAR` 为清除**；
类注释明确 canonical JSON 只由 extension owner 依当前 definition 解释。
`SET` 拒绝 `null` 与字面 `"null"`，正是我在裁决里点名的旧 `isJsonNull` 歧义（清除与非法值同分支）的闭合。

### 2.5 M1 命令路径未触碰泛型 read 分发器 —— **0 条**

我对 68 个 adapter 源码逐一检索 `CatalogOwnerApi.read` / `InventoryOwnerApi.read` /
`.read("<operationId>"` / `.read(OPERATION_ID` 形态：**命中 0 条**。
相关遗留面见 N-01。

---

## 3. seed 报告事实核验（仅事实完整性）—— **通过**

`.runtime/r5/seed/rm1-seed-869c93ad-…/seed-report.json` 我独立聚合：

| 项 | 复算 |
|---|---|
| `status` | `PASS` |
| endpoint groups | **41** |
| 调用总数 / success / rejected / error | **173 / 173 / 0 / 0** |
| `unmatchedHttpEvents` / `unmatchedDatabaseEvents` | **均为空** |
| `firstFailure` | `null` |
| `measurement.basis` | `JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH` |

**报告自洽、完整、无未关联事件。**

**但这不构成任何性能收益结论。** 计量口径是 JDBC 执行加连接与事务批量，不是 SQL 条数；
本次没有同口径的前后 baseline snapshot，`BP_U07_SNAPSHOT=NOT_SUPPLIED_UNMEASURED` 保持。
单次无基线报告只能证明"跑通了、观测完整"，**不能证明"SQL 已优化"或"收益已证明"**。
若要给收益结论，需要与改造前同口径 seed 报告的每操作 `databaseOperationCount` 逐条对比。

**L2 边界**：浏览器 catalog L2 仍未闭合（P4 预检被旧硬编码 43/100 分母拦截，
当前 P1 权威可执行分母为 API 26/99、L2 18/41）。
**seed PASS 不等于 L2 PASS，也不等于 UAT PASS**；该问题应单独处置，不得归入 seed 或 M1 owner 代码的 PASS。

---

## 4. Findings

### S-01｜执行矩阵为全部 68 行声明 binding 作为 edge，但 42 条的真实 HTTP 链并不经过它

**证据**（三条，均可直接复现）：

1. 矩阵 `edge.className` 的取值分布实算为
   **`BackendPerformanceM1CommandExecutionBindings` 68 条**，无第二种取值；
2. 全仓引用该 binding 的生产源文件**只有 1 个**：
   `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java`，
   其中 `m1Bindings.` 调用**恰 26 次**；
3. 其余 controller 直接 import 并调用 adapter，例如
   `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementController.java:23`
   直接 import `com.catering.v2s.organization.application.Create…Operation`。

**适用分母**：68 条中的 **42 条**（即 `routeRegistry != catalog-inventory` 的全部命令）。
26 条 catalog-inventory 命令不受影响，它们的 edge 确为 binding。

**为什么违反红线**：`OWNER_LOCAL_EFFICIENCY_REPAIR` 的门要求里，
"Actual compiled chain" 一项是「generated method names its adapter, **and edge invokes it**」。
对这 42 条，generated 方法确实命名了 adapter（我验过），但**没有任何 HTTP 入口调用这 42 个 `bind` 方法**，
它们是编译进 main 源集却无人引用的死代码；而矩阵作为门的权威拓扑输入，
对这 42 条声明了一条并不存在的 edge 链。任何依据矩阵去核验链路的人（包括后续 reviewer 与门本身）
会核到 binding 而不是真实 controller。

**为什么仍是 S 而非 M**：这 42 条**各自都有一条真实且合规的链**——
edge controller → adapter（`@Transactional(REQUIRED)`、非 final、每操作一类、无泛型分发）→ typed owner API，
我在 §1.1 与 §2.3 已逐条验证。架构目标达成，没有任何命令因此行为错误，
也没有产生虚假的性能或安全声称。

**最小修复（二选一，不改任何 adapter 与 owner 代码）**：
① 让那 42 条 controller 也经 binding 调用（与 catalog 一致，链形统一，42 个方法从死代码变为在用）；
② 或把矩阵这 42 行的 `edge.className` / `methodName` / `sourcePath` 改为**真实 controller 与方法**，
并让生成器只为真正经 binding 的 26 条产出方法。
两者都可，但必须二选一到底——**当前是"声明按①、实现按②"的混合态**。
建议同时在门里加一条断言：矩阵声明的 `edge` 方法体必须真实到达其 `transactionEntry`，
且该 `edge` 方法必须被至少一个 HTTP 入口引用。

**是否阻断**：**不阻断 M1 静态实现验收**（架构目标已达成），
**不影响 seed 事实完整性**，**不影响后续 L2**。但它会让后续任何"逐条核链"的复核失真，建议本轮内闭。

**是否需要 Dexter 裁决**：不需要。

### N-01｜catalog / inventory 公开 owner API 仍保留 operationId 泛型 read 分发器与 Jackson 2 类型

**证据**：
`modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java:6-7,13,16-18` 与
`modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java:6-7,18,22,25-26`
仍 import `com.fasterxml.jackson.databind.JsonNode` / `node.ObjectNode`（**Jackson 2**），
并公开 `JsonNode read(String operationId, String dataNodeRef, String brandRef, ObjectNode request, String requestId)`
等方法——这是一个挂在公开 owner API 上的 **operationId 字符串泛型分发器**。

**适用分母**：**读侧**，不在 M1 的 68 条命令内。

**为什么只是 N**：本包 `excludedUnits` 明确排除 `BP-U05 task-read 58` 与 `BP-U07 SQL-M2 read 58`；
且我已验证 **68 个 M1 adapter 中触碰该分发器的为 0 条**，命令侧边界干净。
组织侧 `api` 中 `Map<String,String> extensionValues` 的 5 处命中我也逐个看了，
分别在 `OrganizationEntityReadback`、`OrganizationNodeReadback`、`CommercialGroupReadback`
（读回结构）与 `InitializeCommercialGroupCommand` / `UpdateCommercialGroupCommand`；
其中 `initializeCommercialGroup` **不在** M1 的 68 内（platform-admin 面），
而 68 内唯一的 `updateOperationsCommercialGroup` 其 adapter 不含任何扩展字段处理、
`ownerInvocation` 指向 `OrganizationCommandService#update`，未经由 `Map` 传扩展值。

**最小修复**：登记到读侧单元（M2 / BP-U05 收尾）一并处置，不要在本包展开。
本包若要额外收紧，可在门里加一条：**M1 adapter 与 binding 不得引用这两个泛型 read 方法**
（当前事实已满足，加断言即可防回归）。

**是否阻断**：不阻断本轮任何一项。

---

## 5. 方案合理性

命令侧这一轮的取舍我认同，且有两处值得点名：

其一，**adapter 只做"开事务 + 组合已声明 typed 端口"**，把跨 owner 组合从 edge 移进事务内，
既消除了命令后的两次独立事务读取，又没有把 contract 的真相搬进 organization——
与我 2026-08-10 裁决的第一条一致，且 `StoreWireMapper` 原样复用、未新建响应塑形权威。

其二，**`ExtensionSubmission` 的 `SET` 拒绝 `null` 与 `"null"`**。
这不是风格改进：旧路径用 `isJsonNull` 把"清除"和"非法值"落进同一分支，
新形态把它变成三态显式语义，属于顺手修掉一处真实歧义。

**UI 与交互**：本轮不改任何 HTTP 契约字段集合，`StoreWireMapper` / `ContractWireMapper` 复用，
前端零行为变化；变的只是读取位置与事务边界。记为**已核验且无异议**（Store 与 Contract 的 mapper 复用我验过；
HeadCompany 与 Contract 的逐字段比对未做，见 §0 覆盖披露）。

---

## 6. 结论

**GO**（M=0，S=1，N=1），**仅覆盖静态代码与 seed 报告事实**。

68 条命令的运行时链我逐条机械核验：adapter 六项属性 68/68 全过，
generated binding 的 68 个方法各自恰好调用其同名 adapter 字段、68 个字段类型与矩阵声明一致，
build closure 两个生成目录进 main 源集且 `compileJava` 均 `dependsOn`。
业务语义方面，**owner 的目标事实与授权复核确实在 receipt replay 之前**
（`requireProjectId` → `requireOwnerGrant` → `receipts.execute`），扩展字段已进 canonical 幂等键；
跨 owner readback 在同一 `REQUIRED` 事务内完成且 adapter 无 JDBC/repository；
幂等 53/15 与 `responseMode` 66/2 与声称一致；`ExtensionSubmission` 与裁决完全一致并闭掉了 null 歧义；
M1 命令路径触碰泛型 read 分发器 0 条。seed 报告 173/173 成功、零未关联事件、自洽完整。

唯一的 S 是矩阵为全部 68 行声明 binding 作为 edge，
而实际只有 26 条 catalog-inventory 命令经 binding，其余 42 条 controller 直调 adapter——
声明与实现是混合态，并留下 42 个未被引用的 generated 方法。
它不影响任何命令的正确性与安全性，但会让后续逐条核链失真，建议本轮内二选一收口。

**明确不成立的推论**：本次 seed 无同口径前后 baseline，
**不得由本文件得出"SQL 已优化 / 收益已证明"**；`BP_U07_SNAPSHOT=NOT_SUPPLIED_UNMEASURED` 必须保持。
**浏览器 L2 未闭合，seed PASS 不等于 L2 或 UAT PASS**，L2 的 43/100 旧分母问题需单独处置。

**授权边界**：本 GO 仅为静态实现审查结论，不授权动态环境、DEV、reset、seed、L2、
Testcontainers、部署、手工 SQL/SSH 或仓库控制，也不构成任何性能数值成功声明。
§0 已列出我未核验的范围，那些项不在本结论覆盖内。

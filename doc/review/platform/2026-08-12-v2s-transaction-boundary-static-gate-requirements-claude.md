# 事务与持久化边界静态门需求（便宜方案 · Claude）

- 目标：用**纯静态**手段约束"谁有资格开连接/开事务、谁有资格触库"，秒级反馈，**不碰 Testcontainers**。
- 明确不做：per-operation 实测对账、`UNCLASSIFIED` 基线、下界/重放/`N=0` 防线。这些需要运行时证据，本方案不含，见 §8 欠账。
- 会话出处：fresh v2s-rooted 会话，本文件为唯一写入。未运行任何动态环境。
- 亲验声明：文中分母、行号、注解位置均由我独立打开源码得出。

---

## 1. 这套方案买到什么、买不到什么

**买到（静态可判、确定、可红变异、重构不误红）**

- 声明为 `OUTSIDE_TRANSACTION` 的读路径上是否存在 `@Transactional` —— 这是 `getExtensionDefinition` 那类"**声明与代码直接矛盾**"的根源
- edge / owner 的持久化与事务**资格**边界
- 违规在**编译期后秒级**暴露，不依赖容器、不依赖 DB、不受 Testcontainers 链的稳定性影响

**买不到（静态原理上判不了，不要指望）**

- 实测用量：`createOperationsOrganizationStore` 的 41 次、其中 24 次 QUERY —— 静态看不出循环跑几次、一次查询回几行
- `UNCLASSIFIED` 占比、`N` 的真实基数
- "是否真的走到业务路径"（2xx 但零 DB / 幂等重放 / 空集合）

**一句话**：这套管**资格**，不管**用量**。资格错了它必红；资格对了但实现浪费，它一声不吭。

---

## 2. 为什么它便宜

| 要素 | 现状 | 本方案新增 |
|---|---|---|
| 执行载体 | `BackendModuleBoundariesTest` 已有 **28 条** ArchUnit 规则，已是 catalog 里的 `ARCHUNIT_SELECTOR` | **不新建门**，规则加进这个既有文件 |
| 判据来源 | `contracts/registry/operation-handler-bindings.json` 已给 196 条的 `transactionMode`（`OUTSIDE_TRANSACTION` 83 / `REQUIRED` 113） | **不新建契约** |
| 事务规则覆盖 | 我核过：28 条里**没有任何一条涉及事务**，无重复 | 全新地，不与既有规则冲突 |
| 挂点数量 | 见 §3 | 主规则挂点 **3 个** |
| 运行代价 | ArchUnit 跑在类型图上，不起容器不连库 | 秒级 |

---

## 3. 主规则：owner 读入口不得开事务

### 3.1 事实

全仓 `public JsonNode read(String operationId, ...)` 形态的 owner 读入口**只有 3 个**，且**三个全都带事务标注**：

| 类 | 读入口注解 |
|---|---|
| `CatalogOwnerService` | `@Transactional(readOnly = true)` |
| `InventoryOwnerService` | `@Transactional(readOnly = true)` |
| `ProductionTagOwnerService` | `@Transactional(readOnly = true)` |

三者均 `implements *OwnerApi`。而它们服务的读操作在 bindings 里全部声明 `transactionMode: OUTSIDE_TRANSACTION`。

**这就是矛盾所在**：契约说"这些操作在事务外"，代码在入口处开了只读事务。

### 3.2 规则

> 服务 `transactionMode: OUTSIDE_TRANSACTION` 操作的 owner 读入口，不得标注 `@Transactional`。

ArchUnit 表达：实现 `*OwnerApi` 的类，其 `read(String operationId, ...)` 方法不得带 `@Transactional`。**纯结构，不读源码文本，改名重构不误红。**

### 3.3 对齐方向必须先判断 —— 这一步不是机械的

`@Transactional(readOnly = true)` 加在读入口上**常常是有意的**：它保证一次读里多条查询看到同一快照。所以摘注解之前必须逐个 owner 回答：

> 这个 owner 的读操作里，有没有真的依赖"同一事务内多查询一致性"的？

- **没有** → 摘掉注解，代码向契约对齐
- **有** → **改 matrix 与 bindings 的声明**，把这些操作从 `OUTSIDE_TRANSACTION` 改成有事务，契约向代码对齐

**两边必须一致，但对齐到哪一边是业务判断，不是门能决定的。** 门只负责"不一致就红"。这一步必须由 Codex 逐 owner 给出结论并写进证据，不得默认摘注解了事。

### 3.4 分母的诚实处理

读 owner 有**两种形态**，规则的解析能力不同：

| 形态 | 例 | 能否由 bindings 静态解析到实现 |
|---|---|---|
| switch 分派 | `CatalogOwnerService.read(operationId, ...)` | **能**，3 个入口 |
| 直接方法 | `ExtensionDefinitionService implements ExtensionDefinitionLookup` | **不能直接解析** |

原因：bindings 给读操作声明的 `adapter`（如 `GetOperationsCatalogItemOperation`）**不存在为独立类**——读走 owner 的 switch 分派。这是已登记的 `GAP_ADAPTER_SOURCE_ANCHOR`，不是本次新问题。

**要求**：规则必须报告"已解析 / 未解析"两个数，**未解析部分不得当作通过**。可先覆盖能解析的子集，把未解析清单写进证据并登记欠账；**不得为了让数字好看而假装全覆盖**。

### 3.5 不要扩大化

全仓有 **236 处** `@Transactional(readOnly = true)`，分布在 42 个类。其中绝大多数是 owner **内部私有读方法**，不是 operation 入口，**不在本规则分母内**。规则只管入口，别顺手全摘——那会破坏内部真实需要的快照一致性。

---

## 4. 主规则之二：声明的 `ownerCount` 必须与实际注入的 owner 数一致

### 4.1 事实

`createOperationsOrganizationStore` 的 adapter 只有 39 行、3 个调用，本身很干净。但它**注入了两个不同 owner 的 API**——`OperationsStoreCommandApi`（organization）与 `OperationsStoreContractCommandApi.StoreStatusReadbackApi`（contract）。而 matrix 声明它 `ownerCount: 1`、`shapeClass: OWNER_COMMAND_SINGLE_OWNER`。

**跨 owner 调用会各自借连接、各自参与事务**，这正是它 CONNECTION 4 / TRANSACTION 8 的结构来源。

### 4.2 规则

> adapter 实际注入的 owner API 所属 owner 数，必须等于 matrix 声明的 `ownerCount`。

判据来源全部现成：matrix 已给 196 条的 `ownerCount`（分布 1→181、2→8、3→1、4→1、0→5）；实际值由 adapter 的**构造注入字段类型 → 包名 → owner 模块**静态解析。

### 4.3 当前违规：**5 条**（我已逐条核实）

| 声明 → 实际 | operationId | 实际注入的 owner |
|---|---|---|
| 1 → 2 | `createOperationsOrganizationStore` | contract + organization |
| 1 → 2 | `updateOperationsOrganizationStore` | contract + organization |
| 1 → 2 | `transitionOperationsOrganizationStoreStatus` | contract + organization |
| 1 → 2 | `releaseOperationsCatalogStagedAsset` | catalog + platform.asset |
| 1 → 2 | `transitionOperationsCatalogItemStatus` | catalog + inventory |

**判据必须是构造注入，不能是 import。** 我先用 import 扫描得到 29 条，逐个核对后发现**高估了 24 条**：例如 `CreateOperationsCatalogItemOperation` import 了 `organization.api.CatalogScopeLookup`，但那只是**类型引用**，不是注入依赖，运行时不会产生跨 owner 调用。**实现这条规则时若退回 import 扫描，会造出 24 个假红。**

### 4.4 分母的诚实处理（与 §3.4 同一原则）

`RESOLVED=68 / UNRESOLVED=128`（合计 196）。**这条规则只覆盖 35%**——128 条的 adapter 类不存在为独立文件（读走 owner switch 分派，属已登记的 `GAP_ADAPTER_SOURCE_ANCHOR`）。

规则必须报出两个数，`UNRESOLVED` 不得计入通过。**不得把"68 条里 5 条红"表述为"跨 owner 边界已受控"。**

### 4.5 对齐方向同样需要业务判断

5 条红**不等于 5 个 bug**。两种可能：

- **声明写窄了**——这些操作本就该跨 owner（例如 store 创建后必须读合约派生状态），那么该改的是 `ownerCount` 与 `shapeClass`，让契约向代码对齐
- **实现不该跨**——那部分跨 owner 调用可以收进单 owner，代码向契约对齐

**逐条判断，不得默认改哪一边。** 与 §3.3 同一要求：由 Codex 给出结论并写进证据。

### 4.6 这条抓不到什么

- **抓不到 24 次 QUERY**。`createOperationsOrganizationStore` 的 4 连接 8 事务事件基本能由跨 owner 解释，但那 24 次查询发生在 `stores.createStore(...)` 内部，静态看不出循环跑几次、一次查回几行
- **抓不到 `selectOperationsWorkspaceSessionDataNode`**。它的 adapter 类不存在，落进 `UNRESOLVED`；它那 24 查询比 1 写只能靠运行时对账或人工读代码

---

## 5. 配套规则族（同一文件，同样零新建）

在 `BackendModuleBoundariesTest` 里补这几条，都是既有 28 条的同款写法：

1. **edge 不得成为事务起点**：`..app.edge..` 包内不得出现 `@Transactional`。
   *现状：我核过 edge 层 `@Transactional` 出现次数为 **0**，这条规则上线即绿，作用是防回归。*
2. **edge 不得依赖持久化**：既有 `EDGE_DOES_NOT_TOUCH_PERSISTENCE` 已覆盖，**不重复添加**。
3. **owner 不得在声明的 loader 之外直接触库**：非 loader 类不得依赖 `JdbcTemplate` 等持久化类型。
   *这条需先确认 loader catalogue 的 10 个 loader 在代码里有稳定的结构标识；没有就先不做，别为它造标记。*

---

## 6. 验证手段：用既有 seed 前后对比，**不需要 Testcontainers**

本方案不含实测对账，但**不能因此就没有验证**。最便宜的验证是既有 seed 报告的前后对比：

- 基线：`rm1-seed-7e38f313`，DB 合计 **3212**，其中 CONNECTION 438 + TRANSACTION 876 = **1314（40.9%）**，每次 API 调用 2.53 连接 / 5.06 事务事件
- 改动后重跑 seed，比对同样三个数
- 判据：**CONNECTION 与 TRANSACTION 应下降；QUERY 与 UPDATE 不应上升**

`QUERY`/`UPDATE` 上升意味着摘掉事务后出现了额外往返，那是回退信号，必须查。

**必须诚实的一点**：seed 只覆盖 41 个 operation，这个对比**证明不了全部 83 条读操作都好了**，只能证明方向对。不得把 seed 的下降表述为"全部达标"。

---

## 7. 未来迭代新功能时如何"无感自带"这套检查

这是本方案能否长期成立的关键。**无感的本质是：规则挂在结构上而不是清单上，新增同形态自动纳入，新增异形态自己浮出来。**

### 7.1 机制一：规则键在结构，不在清单（新增同形态自动纳入）

规则**不得**写成"以下 3 个类不许……"，必须写成：

> **实现 `*OwnerApi` 的类，其 `read(String operationId, ...)` 不得标注 `@Transactional`。**

差别是决定性的：明天新增第 4 个 owner service，只要它 `implements *OwnerApi`，**ArchUnit 扫描类路径时自动覆盖它**，没有任何人需要记得去加一行。写成清单则第 4 个静默逃逸。

同理，edge 规则写成"`..app.edge..` 包内不得出现 `@Transactional`"，新增的 edge 控制器自动受约束。

**这一条不需要额外建设**：ArchUnit 本来就扫全类路径，新类天然在扫描范围内。

### 7.2 机制二：声明侧由生成器自动扩容

`operation-handler-bindings.json` 带 `generatedFrom`，是生成器产物。新增 operation 时重新生成，它的 `transactionMode` **自动进入 196→N 的分母**，不靠人手工加行。

**约束**：新 operation 的正确路径是**重新生成**，不是手工编辑 bindings。这一条要写进规则的前置断言（bindings 与生成器输出一致）。

### 7.3 机制三：`UNRESOLVED` 棘轮（新增异形态自己浮出来）

前两条只覆盖"新功能长得和现在一样"的情况。真正的风险是**新功能长出一个新形态**——比如一个不实现 `*OwnerApi` 的新 owner，或一条不走 `read(operationId, ...)` 的读路径。这种会静默绕过结构规则。

**静态侧的解法与运行时侧的 `UNCLASSIFIED` 同构**：

- 规则必须同时输出 `RESOLVED=<n>` 与 `UNRESOLVED=<m>`（§3.4）
- `UNRESOLVED` 的当前值写进规则源码作为基线
- **`UNRESOLVED` 增长即红**

新形态一出现，解析不到，`UNRESOLVED` 上升，门当场红。开发者不需要知道这套规范存在，**走偏会自己撞上来**。

**基线修改遵循同一棘轮**（与另一份需求 §5.3.1 一致，避免两套说法）：

| 方向 | 要求 |
|---|---|
| 收紧（`UNRESOLVED` 下降） | 自由，改基线值即可 |
| 放宽（承认新形态暂不可解析） | 必须归因到**具体 operation 或类**，写明为什么不可解析，且放宽幅度与归因数量对得上；**说不出是什么造成的就不许放宽** |

### 7.4 机制四：新形态的处置义务

`UNRESOLVED` 红了之后只有三条合法出路，**必须三选一并写进证据**：

1. **扩规则**——新形态是正当的，把它纳入解析（推荐，这是让规范跟着业务长）
2. **改实现**——新形态本就不该存在，改回既有形态
3. **显式豁免**——写进基线放宽并归因（按 §7.3 的要求）

**不允许的第四条出路**：把 `UNRESOLVED` 从输出里去掉、或把它计入通过。这一条要配红变异。

### 7.5 反馈时机：verify 时，不是 per-edit

这套规则跑在既有 `ARCHUNIT_SELECTOR` 里，**由 verify root 执行**，所以：

- 开发者不需要新增任何习惯，跑 verify 就带上了 —— 这是"无感"的另一半
- **明确不放进 per-edit 门**。理由有二：ArchUnit 需要编译，per-edit 跑不起；更重要的是，per-edit 门失败会阻塞 post receipt 造成控制面自锁，我们已经在 `sql-merge-coverage` 上吃过这个亏，不要再造一个

代价是反馈从"改完这个文件"推迟到"跑 verify"。这个取舍是有意的：**秒级但会自锁 vs 分钟级但不会自锁，选后者。**

### 7.6 这套无感机制的边界

诚实说明它管不住什么：

- 新功能若采用**已被解析的形态**，但语义上做了规则表达不了的坏事（比如在 loader 内部塞进不该有的查询），静态照样看不见
- `UNRESOLVED` 只能发现"形态没见过"，发现不了"形态见过但用错了"

这部分仍然要靠 fresh 独立对抗审查，以及欠账里那套运行时对账。**不要把 `UNRESOLVED=0` 解读为"新功能都合规"**，它只说明"新功能都长得认识"。

---

## 8. 本方案买不到的，登记欠账

以下问题**本方案完全不覆盖**，需要运行时证据，登记到 `HANDOFF.md`：

- per-operation 实测 vs 声明对账（含**下界**：实测低于声明 floor 应红）
- `UNCLASSIFIED` 占比基线与棘轮
- "未触发业务路径"的三条防线：零 DB 的 2xx、幂等重放观测、`N=0` 观测
- `createOperationsOrganizationStore` 41 次里那 24 次 QUERY —— **本方案对它无能为力**

这些在 `doc/review/platform/2026-08-12-v2s-database-interaction-boundary-standard-requirements-claude.md` 里已有完整设计，本次只是**不做**，不是**不需要**。

---

## 9. 批次与验收

| 批次 | 内容 | 验收 |
|---|---|---|
| **S1** | 逐条判断对齐方向并写进证据：§3.3 的 3 个 owner 读入口 + §4.5 的 5 条 `ownerCount` 违规 | 8 项各有明确结论（改代码 / 改声明）与理由；**不得空着** |
| **S2** | 按 S1 结论执行对齐 | 代码与 bindings 的 `transactionMode`、matrix 的 `ownerCount` 均一致 |
| **S3** | 加规则进 `BackendModuleBoundariesTest`，含 §3.4 的解析报告与 §7.3 的 `UNRESOLVED` 基线 | 规则**键在结构不在清单**（§7.1）；输出 `RESOLVED=<n>` / `UNRESOLVED=<m>`，`m>0` 必须显式出现；基线值写进规则源码 |
| **S4** | seed 前后对比 | CONNECTION/TRANSACTION 下降，QUERY/UPDATE 不升；结论按 §5 措辞，不得宣称全覆盖 |

**红变异（六条，每条都要真反例）**：
1. 给任一 owner 读入口加回 `@Transactional` 必红
2. 在 `..app.edge..` 加一个 `@Transactional` 必红
3. 把 `UNRESOLVED` 从输出里去掉、或计入通过，必红
4. **新增一个 `implements *OwnerApi` 且读入口带 `@Transactional` 的类，必红**（证明 §7.1 的"新增同形态自动纳入"真成立）
5. **新增一个不实现 `*OwnerApi` 的读路径，`UNRESOLVED` 必须上升并红**（证明 §7.3 的"新形态自己浮出来"真成立）
6. 手工编辑 bindings 使其偏离生成器输出，必红（§7.2）
7. **把 §4 的判据从"构造注入"退回"import 扫描"，必红**（防止重新造出 24 个假红；红变异用 `CreateOperationsCatalogItemOperation` 作样本——它 import 了 `organization.api` 但未注入）
8. 给任一 adapter 注入一个新 owner API 而不改 `ownerCount`，必红

第 4、5 两条是**无感机制的验收核心**——没有这两条真红变异，§7 就只是一段承诺。

---

## 10. 我的判断：可以，但有两个前提

**可以的理由**：它精准命中了"声明与代码矛盾"这一类，而这类正是 40.9% 连接事务开销的一个已证实来源；挂点只有 3 个；零新建；秒级；不受 Testcontainers 链影响；而且这一层做完，将来真做对账时要处理的违规种类会少一批。

**两个前提，缺一这方案就会变味**：

1. **§3.3 的对齐方向必须真判断，不能默认摘注解。** 摘错了会破坏读一致性，那是拿正确性换数字。
2. **§3.4 的 `UNRESOLVED` 必须显式报出。** 只能解析 3 个 switch 入口却说成"事务边界已受控"，就又造了一次假绿——这个仓里我们已经反复遇到这个形态。

**不可以的地方要说清**：这套**解决不了用量问题**。`createOperationsOrganizationStore` 的 41 次、`selectOperationsWorkspaceSessionDataNode` 的 24 查询比 1 写，做完这套一次都不会少。如果你的目标里包含"把 DB 调用次数降下来"，这套只是必要的第一步，不是全部。

## 11. 授权边界

本文档是需求分析，不是实施授权，也不是评审结论。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器；文中 seed 数字来自既有报告重算。不得据此宣称任何动态、业务、cleanup 或性能结果。

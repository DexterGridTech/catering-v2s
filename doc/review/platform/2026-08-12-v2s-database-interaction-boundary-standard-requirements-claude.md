# 数据库交互边界规范与实测对账需求（Claude 需求分析）

- 目标：建立一套**与数量无关**的规范，让"什么逻辑可以开连接/开事务、校验事实在哪一层加载"有明确标准、有强制执行、有及时发现，使未来新增的功能与业务**自动纳入约束**，而不是每次靠人记。
- 会话出处：fresh v2s-rooted 会话。本文件为唯一写入。**未运行** Testcontainers / DEV / L2 / reset / seed / 浏览器；所有事实为静态阅读与既有 seed 证据重算。
- 亲验声明：文中所有分母、字段、行号均由我独立打开源码或重算得出，未采信任何自报数字。

---

## 1. 结论先行：规范已经存在，缺的是"实测对账"这一层

我逐份打开后确认——你要的四件事，**`contracts/registry/backend-performance-operation-database-shape-matrix.json` 里已经全部声明了**：

| 你的问题 | 现状 |
|---|---|
| 什么逻辑需要连接和事务 | `transactionOrigin.kind` 四分类已全量声明：`OUTSIDE_TRANSACTION` 83、`M1_DECLARED_ORIGIN` 68、`ORIGIN` 44、`JOIN_EXISTING_REQUIRED_PARTICIPANT` 1；`propagation` `REQUIRED` 113 / `NONE` 83 |
| 必须提前在哪声明 | 就在该 matrix，红线 `OPERATION_DATABASE_SHAPE_DECLARED` 保证每条 canonical operation 必有 |
| 必要性解释 | `budget.aboveFloorExplanation`，83 条 READ 全部 `required: true`，含 `whyNotMergeable` / `cardinalityBound` |
| 连接与事务只能固定在哪一层 | 红线 `ONE_REQUEST_ONE_TRANSACTION_ORIGIN`：「`transactionOrigin.kind/propagation` 与 `inventoryTransactionOriginRef` 精确 join；**edge origin is not admitted**」 |
| 校验只能提前到哪一层 | 红线 `REQUEST_LOCAL_FACT_LOADED_ONCE`：「`factLoaderRefs` 与**封闭 loader catalogue** 精确 join，每 operation 至多一次」 |

**但同一份文件里 196 条全部写着**：

```
measurementDisposition: "STATIC_DECLARATION_NOT_MEASUREMENT"
```

它诚实地交代了自己只是静态声明。门验的是"声明与源码拓扑一致"，**从不验"声明与运行时一致"**。

于是出现这种情况（seed run `rm1-seed-7e38f313`，我逐条重算）：

| operation | 声明 | 实测 | 差 |
|---|---|---|---|
| `getExtensionDefinition` | `OUTSIDE_TRANSACTION`，`transactionEvents: 0`，floor 3 | 12（CONNECTION 3 + QUERY 3 + TRANSACTION 6） | **查询部分恰在底线，却被包进 6 次事务事件** |
| `createOperationsOrganizationStore` | floor 7（connections 1 + transactionEvents 2 + …） | 41（CONNECTION 4 + QUERY 24 + TRANSACTION 8 + UPDATE 5） | 一个请求 **4 个事务起点** |
| `selectOperationsWorkspaceSessionDataNode` | floor 6 | 34（QUERY 24 : UPDATE 1） | 24 次查询只为 1 次写 |

全局：3212 次 DB 操作里 **CONNECTION 438 + TRANSACTION 876 = 1314，占 40.9%**，每次 API 调用平均 2.53 个连接、5.06 个事务事件。若各操作都打到自己声明的底线，可对账部分 3208 → 1076。

**所有门全绿。** 因为没有任何一处把声明和实测放在一起看。

**所以本需求不是新建一套规范，而是补上第三层：把已有声明变成可证伪的承诺。**

---

## 2. 落脚点：三层解耦，只有第三层是新建

这是本需求最关键的设计判断。三层各自独立演进，**都不绑定操作数量**：

| 层 | 落脚点 | 现状 | 本次动作 |
|---|---|---|---|
| **规范层**（规则） | 独立 policy 契约 | 规则目前**嵌在** 196 行的 matrix 里（`redlineChecklist`），规则与枚举耦合 | **抽出**为独立契约，matrix 降级为它的实例化产物 |
| **声明层**（枚举） | 既有三份 registry | 已是生成器产物，`--check` + 红变异齐备（`RED_SOURCE_SUBSTITUTION` / `RED_LITERAL_SOURCE` 等） | **不动**。新增 operation 由重新生成自动进入分母 |
| **对账层**（实测） | Testcontainers 收口 | **缺失** | **新建**，本需求主体 |

### 2.1 为什么规范层要从 matrix 里抽出来

现在 `redlineChecklist` 住在一份 196 行的枚举文件里。规则和枚举同生共死意味着：换一个业务域、加一批新 operation，规则要跟着搬。抽出来之后：

- 新契约 `contracts/policy/database-interaction-boundary-policy.json` **只含规则，不含任何 operation 列表**
- 它定义：事务起点分类法、允许开启连接/事务的层、校验事实加载层、`Section` 分类法与语义、声明必填项、above-floor 解释的必填条件、component↔kind/section 映射
- matrix 继续存在，但它的 `redlineChecklist` 改为**引用** policy 的 ruleId，不再自带规则正文

这样 196 → N、19 → M 都不触碰规范层。

### 2.2 为什么对账层落在 Testcontainers 而不是 seed

我核过两边的实际能力：

| | seed | Testcontainers |
|---|---|---|
| 覆盖 | 41 个 operation（其余 155 无实测） | 全量运行（当前 196，随生成器增长） |
| 环境 | 有历史数据污染（本次 run 范围外历史事件 **7140**） | 每次全新容器，无污染 |
| 计量可信度 | 自报 | `databaseOperationCount` **是 HMAC canonical 字段之一**，防篡改 |
| 分解粒度 | endpoint 级 `kindCounts` | 逐行 `kind` / `section` / `batchSize` / `serverOperationHmac`，且 `:302` 已做聚合与明细交叉对账 |
| 与声明的绑定 | 无 | 测试计划必需字段**已含** `shapeMatrixSha256`、`loaderCatalogueSha256` |

**Testcontainers 侧已经把数据全采齐了，连与 matrix 的哈希绑定都建好了——只是绑了身份，没比数值。** 对账层落在这里，新建量最小。

seed 保留，但它回答的是另一个问题：**Testcontainers 管"每条操作是否守住自己声明的形状"，seed 管"一条真实业务旅程实际花多少"**。两者不得互相替代。

---

## 3. 规范层：policy 契约要写什么

新建 `contracts/policy/database-interaction-boundary-policy.json`，内容全部是**规则**：

### 3.1 连接与事务的层归属

- 允许成为事务起点的层，用既有四分类表达：`ORIGIN` / `M1_DECLARED_ORIGIN` / `JOIN_EXISTING_REQUIRED_PARTICIPANT` / `OUTSIDE_TRANSACTION`
- **edge 层不得成为事务起点**（既有红线原文已如此，抽出后保留）
- 声明为 `OUTSIDE_TRANSACTION` 的操作，其 `transactionEvents` 预算必须为 0；**实测出现事务事件即违规**
- 一次请求的事务起点数量上限由 `transactionOrigin.kind` 决定，不由实现自由裁量

### 3.2 校验事实的加载层

- 校验事实只能由**封闭 loader catalogue** 中声明的 loader 加载
- 每 operation 每类事实**至多加载一次**（既有 `REQUEST_LOCAL_FACT_LOADED_ONCE`）
- 写路径内的校验读必须落在声明的 loader 或 `declaredExtras` 里；**未声明的写路径内读即违规**

### 3.3 `Section` 分类法与 `UNCLASSIFIED` 的语义

`DatabaseOperationTracker:88-90` 已有 14 类：`SESSION, AUTHZ, SCOPE, OWNER_READ, OWNER_WRITE, REFERENCE_CHECK, EXTENSION, IDEMPOTENCY, CAS, AUDIT, READBACK, CONNECTION, TRANSACTION, UNCLASSIFIED`，仓内有 **57 处显式 `pushSection`**。

`defaultSection` 的注释已经把 `UNCLASSIFIED` 定义成信号而非噪声：

> Edge/session/foundation callers must remain visibly `UNCLASSIFIED` until they establish an explicit boundary.

**policy 要把这条从注释升级为规则**：`UNCLASSIFIED` 表示"尚未声明边界"，其占比是一个受监控指标（见 §5.3）。

### 3.4 component ↔ kind/section 映射（必须写进契约）

`budget.components` 六个分量对 4 个 kind、14 个 section，不是一一对应。映射必须在 policy 里写死并配红变异，**否则事后可以调映射来消化差异**——那就退化成调参数让它绿。

至少要定义：`connections → CONNECTION`、`transactionEvents → TRANSACTION`、`freshFactLoads/receiptClaims/finalOwnerReadback → QUERY 的对应 section`、`intrinsicOwnerWrites → UPDATE/OWNER_WRITE`。

---

## 4. 对账层：新控制的输入、判据与输出

### 4.1 输入

任意一次成功的 Testcontainers 运行产出的 per-operation 证据，含 `databaseOperationCount{count, logicalStatementCount}`、`kindCounts`、逐行 `{seq, section, kind, action, statementId}` 与 HMAC。

### 4.2 判据

**对账必须双向。** 只查上界会让"测试没触发到业务路径"变成通过——那比多花几次调用危险得多。

对每个被运行覆盖的 operation：

1. **事务起点一致**：实测 CONNECTION / TRANSACTION 计数与 `transactionOrigin.kind` 允许的形状一致；`OUTSIDE_TRANSACTION` 出现事务事件 → 红
2. **上界**：实测各 kind 计数与 `budget.components` 按 §3.4 映射后一致；超出必须被 `aboveFloorExplanation` 覆盖，**且解释里的 `cardinalityBound` 要能解释超出量**
3. **下界（本节新增，见 §4.2.1）**：实测低于声明 floor → 红
4. **校验层一致**：写路径内的读所属 section 必须在声明的 loader / `declaredExtras` 内
5. **`UNCLASSIFIED` 上限**：见 §5.3

### 4.2.1 下界与"未触发业务路径"的三条防线

**问题**：一次 2xx 响应并不代表操作真的走了业务路径。测试数据没满足触发条件时，操作可能提前返回、命中重放短路、或对空集合执行，DB 次数天然极低，**对账反而"轻松通过"**。

**已有防线（我已核实）**：`backend-performance-testcontainers-196.mjs:240` 断言 `completion.outcome === "SUCCEEDED"` 且 HTTP status ∈ [200,400)，4xx 早退会红；`backend-performance-final-fixture-catalog.json` 的 **396 条全部**声明 `prerequisiteReadback`，并由 `backend-performance-final-fixtures.mjs:96/115-116` 强制（前置读回不为 true 即 `BP_FINAL_FIXTURE_PREREQUISITE_READBACK_MISSING`）。

**仍开着的三条通路，本需求必须补上**：

**（一）零 DB 的 2xx 必红。**
`backend-performance-testcontainers-196.mjs:250` 当前的下界只有 `database.count < 0`，**实测 0 次照样通过**。我重算 matrix：191 条有 `derivedFloor` 的操作**最小值是 2，没有任何一条声明 0**（分布 2×1 / 3×68 / 4×8 / 5×5 / 6×16 / 7×93）。因此"实测 0 → 红"是安全的绝对规则，不会误伤。
推广形式：**实测 < 该操作声明的 `derivedFloor` → 红**，错误码需与"超出"区分（例如 `..._BELOW_DECLARED_FLOOR`），因为两者的排查方向完全相反。

**（二）重放观测不得充当覆盖证据。**
我 grep 过 `scripts/test/backend-performance-workload.mjs`，`idempotenc` / `replay` **零命中**——workload 不区分首次执行与幂等重放。命令操作命中已有回执时会 2xx 返回却几乎不碰 DB，而 `prerequisiteReadback` 只证明前置数据存在，**不证明这次是首次执行**。
要求：命令类操作的覆盖必须建立在**至少一次首次执行观测**上；仅有重放观测的操作，在 §4.4 中计入 `NOT_COVERED_BY_RUN` 而不是已对账。实现上可由 workload 标注该次调用是否命中回执，或由对账层用"实测远低于 floor 且 UPDATE 为 0"识别并要求显式归类。

**（三）`N=0` 的观测不得充当该操作的覆盖证据。**
`6+N` 形态的操作若喂 0 条集合，`optionalCount`/`declaredExtras` 归零，轻松满足底线但没测到真实路径。`prerequisiteReadback` 证明前置存在，不保证基数非平凡。
要求：涉及 `optionalCount`/`declaredExtras` 的操作，fixture 必须声明**非平凡基数**；实测 N=0 时该操作计入 `NOT_COVERED_BY_RUN`。

**红变异**：构造一次 2xx 且 0 DB 的观测必红；构造一次仅重放观测的命令操作，必须出现在 `NOT_COVERED_BY_RUN` 而非已对账；构造 N=0 的批量操作观测，同上。

### 4.3 `N` 的取法（不这样做门会变噪声源）

`6+N` 这类公式里的 `N` 必须**按当次 fixture 的实际基数**计算，不能比固定数。`budget.components` 的 `optionalCount` / `declaredExtras` 就是为此准备的。数据量一变就误报的门，最终一定会被调松。

### 4.4 输出（诚实分母格式）

必须同时报告**已对账**与**未覆盖**，不得只报通过数：

```
RECONCILED=<n>/<declared_total>
NOT_COVERED_BY_RUN=<m>          # 本次运行未触及的 operation
VIOLATIONS=<k>
UNCLASSIFIED_SHARE=<pct>
```

`NOT_COVERED_BY_RUN > 0` 不是失败，但**必须显式出现在输出里**，否则局部对账会被误读为全覆盖——那正是我们这一路反复遇到的假绿形态。

---

## 5. 通用化：三条让它扛得住增长的硬规则

### 5.1 分母必须派生，不得字面量

**控制里不许出现 196、19、41 这类数字。** 全部从证据或契约自身派生。

仓内有现成的正反两面：`tools/catalog-inventory-p4/cli.mjs:69` 曾经硬编码 `43` 而策略文件是 41，**现已改为 `bindings.caseCount !== scenarios.caseCount` 派生**。同一个病在这个仓里犯过也治过，按治好的那版写。

### 5.2 声明层靠生成器扛增长，不靠人维护

三份 registry 都已是生成器产物且带 `--check` 与红变异。新增 operation 的正确路径是**重新生成**，不是手工加行。本次不改这一层，只需在 policy 里写明这条约束。

### 5.3 `UNCLASSIFIED` 占比作为"新功能走偏"的早期信号（Dexter 已裁决：判红）

这是回答"未来更多功能业务也能管住"的关键机制，而且**零额外成本**：

新写的逻辑如果没有 `pushSection` 声明边界，`defaultSection` 会自动把 edge/session/foundation 调用方标成 `UNCLASSIFIED`。对账层只要盯住 `UNCLASSIFIED` 占比：

- 基线存放在 §3 的 policy 契约里（不是运行时文件，不是证据文件）
- 阈值不设绝对值，设"**不得高于当前基线**"
- **实测 > 基线 → 红**（Dexter 裁决）
- 实测 < 基线 → PASS，但输出 `BASELINE_CAN_TIGHTEN=<measured>` 提示可收紧

这样不需要为每个新功能单独写规则，走偏会自己浮出来。

#### 5.3.1 基线修改路径（Dexter 裁决："基线明确不可达时，可说明原因修改"）

这一条是整套设计里**最容易退化**的地方——"说明原因就能改"如果不加约束，等价于"调基线让它绿"。因此修改路径必须做成**不可静默**：

**棘轮方向不对称。**

| 方向 | 含义 | 要求 |
|---|---|---|
| **收紧**（调低基线） | 边界声明变好了 | 自由，只需改契约值。门会主动提示可收紧 |
| **放宽**（调高基线） | 承认某些 `UNCLASSIFIED` 当前不可达 | 见下列四项，缺一不可 |

**放宽必须同时满足：**

1. **写进 policy 契约的 `baselineRevisions[]`**，不得只改数值。每条含 `from` / `to` / `direction` / `reason` / `attributedOperations[]`
2. **必须归因到具体 operation**：`attributedOperations` 非空，且列出的操作在本次实测里确实贡献了 `UNCLASSIFIED`。**说不出是哪几个操作造成的，就不许放宽**——这一条是防止"整体涨了一点，笼统说一句业务变复杂了"
3. **`reason` 必须说明为什么不可达**，而不是为什么现在不方便改。可接受的形态例如"该调用发生在 foundation 层的连接池预热，无 owner 上下文可声明"；不可接受的形态是"本批范围外"、"后续再补"
4. **归因的操作数量与放宽幅度要能对上**：放宽的百分点应能由 `attributedOperations` 的实测贡献解释，对不上即红

**门要额外断言的两件事：**

- 基线值只能来自 policy 契约，**测试运行不得写回基线**（否则就是被测对象自己定标准）
- `baselineRevisions[]` 只增不改：已有条目的 `from`/`to`/`reason` 被修改即红，保证放宽历史可审计

**红变异：** 放宽但 `attributedOperations` 为空必红；归因操作在实测中未贡献 `UNCLASSIFIED` 必红；放宽幅度与归因贡献对不上必红；测试运行写回基线必红；历史 `baselineRevisions` 条目被改必红。

---

## 6. 分批与验收

| 批次 | 内容 | 验收 |
|---|---|---|
| **A** | 抽出 policy 契约（裁决一）；matrix 的 `redlineChecklist` 改为引用 ruleId；写死 §3.4 映射；预留 `unclassifiedBaseline` 与 `baselineRevisions[]` 字段 | policy 不含任何 operation 列表；matrix 与 policy 的 ruleId 集合**双向**精确相等；映射被红变异覆盖 |
| **B** | 对账控制落地在 Testcontainers 收口 | 输出含 §4.4 四个字段；分母全部派生；对 `getExtensionDefinition` 这类已知偏差**必须报红**（这是验收的真红样本） |
| **C** | 三条红线补 `runtimeReconciliationRef` 指向 B 的控制 | 每条 ACTIVE 红线要么有 ref，要么显式降级为 review checklist |
| **D** | `UNCLASSIFIED` 基线建立与棘轮（裁决二，**必须在 A 之后**） | 基线取首次对账实测值并写入 policy；人为在 edge 层加一次未声明 DB 调用 → 占比上升 → 红；§5.3.1 的五条红变异全部有效 |

**红变异清单（每条都要真反例，不能自证）**：
`OUTSIDE_TRANSACTION` 操作出现事务事件必红；超预算而无 `aboveFloorExplanation` 必红；写路径内出现未声明 loader 的读必红；映射被改动以消化差异必红；分母被写成字面量必红；`NOT_COVERED_BY_RUN` 被隐藏必红；`UNCLASSIFIED` 占比超基线必红。

---

## 7. 边界与欠账

- 对账层**依赖 Testcontainers 成功运行**，所以对账频率等于 Testcontainers 成功频率。这不是不做的理由，但要接受。
- 对账层**不能做 per-edit 门**（它是动态的）。硬塞进 per-edit 只会再造一次控制面自锁。它的位置在 Testcontainers 收口。
- 本次**不改 196 条声明本身**，也不改 Testcontainers 既有采集逻辑——那些数据已经够用。
- seed 侧的历史数据污染（本次 run 范围外历史事件 7140）不在本需求范围，登记欠账。

## 8. Dexter 已裁决（2026-08-12）

**裁决一：规范层抽出为独立契约。**
新建 `contracts/policy/database-interaction-boundary-policy.json` 只含规则、零 operation 列表；matrix 的 `redlineChecklist` 改为引用其 ruleId。批次 A 按此执行。**由此产生的约束**：policy 与 matrix 的 ruleId 集合必须精确相等且双向对账；新增红线只能加在 policy，matrix 不得自带规则正文。

**裁决二：`UNCLASSIFIED` 占比超基线判红；基线明确不可达时可说明原因修改。**
判红部分见 §5.3。修改路径按 §5.3.1 的棘轮设计：收紧自由、放宽必须归因到具体 operation 且幅度可解释、测试运行不得写回基线、放宽历史只增不改。

**这两条裁决之间有一个依赖，实施时不要弄反**：基线存放在裁决一新建的 policy 契约里，所以**批次 A 必须先于批次 D**。若先做 D，基线只能暂存在别处，后面再搬一次——那次搬迁本身就是一次未受控的基线改动。

## 9. 仍需注意的取舍（不需裁决，供实施权衡）

- 判红会在业务快速迭代期打断节奏。缓解不是放宽阈值，而是**让声明边界变便宜**：`pushSection` 是一行调用，新逻辑顺手加上即可；真正加不上的才走 §5.3.1。
- 首次建立基线时，实测值可能很高（当前 edge/session/foundation 大量未声明）。**基线应取首次对账实测值，不取理想值**——否则第一天就红成一片，门会被当噪声关掉。收紧靠棘轮逐步完成，不靠一次到位。

## 9. 授权边界

本文档是需求分析，不是实施授权，也不是评审结论。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器；不得据此宣称任何动态、业务、cleanup 或性能结果。文中实测数字来自既有 seed 证据的重算，不代表 Testcontainers 侧的实测结论。

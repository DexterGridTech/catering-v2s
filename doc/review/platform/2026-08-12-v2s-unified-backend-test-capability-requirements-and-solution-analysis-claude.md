# 统一后台测试能力：需求分析与解决方案分析（Claude 独立版）

- 性质：**独立需求与方案分析**，不是对任何他方文档的 review，不含 `GO` / `NO-GO`。
- 独立性：撰写前**未读取 Codex 同主题分析文档**。全部现状数字由本会话从 owning source 独立复算。
- 会话出处：fresh v2s-rooted 会话，本文件为唯一写入。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器 / UAT / 部署。

---

## 0. 需求还原（来自裁决，不引用任何实现）

1. seed **只**为 DEV 提供完整、可体验的业务数据。seed 不是功能测试、不是性能测试、不是接口覆盖证明，且不得再作为发现功能/性能回归的主要手段。
2. 后台行为测试收敛为**一类** Testcontainers 能力。功能与性能**不分家**：同一接口、同一业务场景、同一 fixture、同一受管执行，**同时**产出功能结论与性能结论。
3. 「196 测试」是不可接受的长期模型。196 只是时点快照，**不得**出现在能力名称、固定分母、Java 类名、runner 逻辑、报告 kind、成功条件或未来接口准入逻辑中。
4. 分母必须从**权威后台接口源**自动发现。新增/删除/变更接口必须被自动感知；新接口若缺 Testcontainers 场景、fixture、业务断言或性能判据，必须 **fail-closed**。
5. 「自动接纳未来接口」**不等于**自动猜测请求体、身份、前置条件或业务成功条件。
6. 后台功能正确性与性能回归必须在 **Testcontainers 阶段**暴露，而不是在 reset / DEV / seed 阶段。
7. 需要统一的是**后台行为测试能力**。编译、静态契约生成、架构边界、源码机械门按其真实职责各自归类：**静态门不得伪装成行为测试，也不得为了「只留一类测试」而被删除**。
8. 本轮不执行 L2，仅做分析。

补充裁决（本轮追加）：**数据库性能测试必须内生于每个包已有的 Testcontainers 测试**，而不是另起一个会演化成 197 / 198 的并行套件。

---

## 1. 现状事实（本会话独立复算，非采信自报）

### 1.1 权威接口源已经存在，且当前零漂移

| 来源 | 条数 | 性质 |
|---|---|---|
| `edge-route-face-registry.json` | 154 | generated |
| `catalog-inventory-edge-route-registry.json` | 42 | generated |
| 两者并集 | **196** | — |
| `contracts/registry/operation-handler-bindings.json` | 196 | **手写契约输入** |

并集与 bindings **行集合双向差集均为 0**。

**补充更正（2026-08-12）**：本节初稿据此写「当前零漂移」，**不完整**。行集合相等与投影 metadata 新鲜是两件事：实跑 `scripts/check/operation-handler-bindings` 当前 **FAIL，错误码 `BP_U02_ROUTE_SOURCE_DIGEST_DRIFT`**。因此分母设计必须**分别校验**「行集合双向相等」与「source digest 新鲜」，两者不得互相冒充。该区分由 Codex 独立稿提出，我方初稿漏掉。

> **推论（非仓内断言）**：分母自动发现在架构上不需要新建数据源。generated route registry 已经是权威源，缺的是**把它当枚举源用**——但必须同时校验其 digest 新鲜度。

### 1.2 三类能力沿着「不许分家」的那条缝裂开了

| 能力 | 现在由谁承担 | 缺什么 |
|---|---|---|
| 接口形状 | 仅 `BackendPerformanceTestcontainers196Test` 一条 HTTP lane | — |
| 业务功能 | 18 个包测试，**service / owner 方法层** | **零接口覆盖** |
| 数据库性能 | 无内生承担者 | **无** |

支撑事实：

- `@Testcontainers` 类 **19** 个；其中走 HTTP 层（MockMvc / TestRestTemplate / WebTestClient / 真实端口）的 **1** 个。
- 18 个包测试**没有任何 Spring 测试注解**，服务对象由测试代码手工装配。因此它们结构上不可能看见路由、序列化、边界层与连接层开销。
- 唯一 HTTP lane 的功能断言是 `if (!response?.ok) fail("BP_FINAL_WORKLOAD_HTTP_FAILURE")`；观测记录为 `{operationId, fixtureId, area, status}`。**即只证明「不是 4xx/5xx」，无任何业务语义断言。**

> **这条缝是本次问题的根因**：有业务断言的地方没有接口覆盖，有接口覆盖的地方没有业务断言，而性能两边都没有内生。

### 1.3 测量层已经存在，且是生产级——不需要新建

| 事实 | 位置 |
|---|---|
| `DatabaseOperationTracker` 是生产代码 | `modules/foundation` |
| `MEASUREMENT_SCHEMA_VERSION = 2`；`MEASUREMENT_BASIS = "JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH"` | 同上 |
| scope 由 `HttpRequestMetricsInterceptor` **在请求线程上无条件打开** | `app/edge/diagnostic` |
| 事件**发射**受 `Mode.forProfile(profile)` + secret 头 + runId 头三重门控 | 同上 |

因此 `ThreadLocal` 跨线程问题**不存在**：计量发生在 Tomcat 工作线程，与测试线程无关。

**存在第二套、仅测试可见的计量机制**：`CountingDataSource`（`P4SqlOperationBudgetTest` 使用，口径 `EXACT_SQL_STATEMENTS`）。它与 interceptor 的计量基**不同，两者的数字不可比**。这是必须处置的重复。

### 1.4 时点快照数字被固化的范围

以下均为**时点事实，不得作为未来目标分母**：

- 携带 `196` 的文件 **23** 个，其中文件名内含 `196` 的 **5** 个（含一个 Java 测试类名与一个 checker 名）。
- workload 硬断言 `if (recipes.length !== 396) fail(...)`；plan 输出字面量 `U07=196`。
- workload policy 的 `denominators` 冻结 **16 个**数字（含 `u07RouteCompletions` / `u07M1..u07M6` / `u07M4Retired` 等整套分类学）。
- fixture catalog **396** 行，6 种 `materializerKind`。

### 1.5 新接口的准入方向是**不对称**的

- workload 读两份 generated route registry，但**只作为查表补全** method / path（`withRoute`）；recipe **集合**来自手写 policy。
- 查不到 → `BP_FINAL_WORKLOAD_ROUTE_MISSING`。
- 因此：**删除 / 改名接口会红（fail-closed）；新增接口不会红（fail-open）**。
- `backend-performance-static-196-reconciliation` 在 7 个 policy / registry 之间对账，**其中没有一个是 generated route registry**，锚点是手写的 `operation-handler-bindings.json`。

> 该闭环在**手写产物之间自洽**，对真实接口源失明。这不是「对账不严」，而是**对账对象选错了**。

---

## 2. 方案合理性判断（先于正确性）

### 2.1 问题对不对

真实问题**不是**「196 这个数字不好」，而是三条：

1. 接口覆盖与业务断言**长在两套不同的执行体系上**，因此任何一套都无法单独回答「这个接口业务上对不对」。
2. 性能没有内生承担者，于是被迫外挂到 seed —— 而 seed 的数据量与残留状态会让性能数字漂移，**不可纵向比较**。
3. 分母锚在手写产物上，新增接口 fail-open。

只改数字、或只把 196 改成自动发现，**解决不了第 1 和第 2 条**。

### 2.2 方案优不优（必须构造并否决替代方案）

| 候选 | 结论 | 理由 |
|---|---|---|
| **A. 保留独立性能 lane，仅把分母改为自动发现** | **否决** | 分家仍在。功能断言仍是 `response.ok`，业务回归照样漏。且 lane 会随接口增长演化成 197 / 198，正是被裁掉的形态。 |
| **B. 放弃 Testcontainers，另建 test seed 承担三类验证** | **否决** | ① 让 seed 基建重新变成测试系统，换名不换耦合，与裁决 1 冲突；② DB 调用计数对数据量与残留状态敏感，长生命周期库使基线漂移——这正是现在踩的坑；③ 丢弃已跑通资产：HTTP + 真实容器 + 计量三者同时成立**已在仓内被证明**。 |
| **C.（推荐）包测试驱动真实路由，计量内生** | **采纳** | 三条断言挂在**同一次执行**上，天然不分家。不新建测量层、不新建 runner、不新建数据源。 |
| **D. 全部包测试一律上 HTTP** | **部分否决** | 纯 owner 逻辑测试上 HTTP 只增加成本、不增加信息。见 §3.1 的两类划分。 |

### 2.3 代价配不配

方案 C 的成本集中在两处，且**都不是新建体系**：

- 需计入接口覆盖的包测试从手工装配改为 `@SpringBootTest(RANDOM_PORT)`；
- 19 个类各起各的容器：`new PostgreSQLContainer` 实例化点 **20** 处（catalog 一个类占 2 处），`extends` 关系为 **0**，无任何共享基座。**不先做容器共享，内生化之后必然慢到不可接受。**

> **容器共享不是优化项，是方案 C 的前置条件。**

### 2.4 UI 与交互

`NOT_APPLICABLE`。本方案不引入、不修改任何用户可见界面或 Journey 操作，仅涉及后台测试能力与受管执行。

---

## 3. 目标能力：统一数据模型

### 3.1 两类包测试（划清，避免过度工程）

| 类别 | 入口 | 是否计入接口覆盖 | 性质 |
|---|---|---|---|
| `ROUTE_BEHAVIOR` | 真实路由（HTTP） | **是** | 常设，唯一权威 |
| `OWNER_LOGIC` | owner / service 方法 | 否 | **过渡，默认删除** |

**规则**：接口覆盖分母内的每个 operation，必须存在**至少一个** `ROUTE_BEHAVIOR` 测试驱动它。

**更正（2026-08-12）**：本节初稿把 `OWNER_LOGIC` 写成并列常设类别，与 Dexter 追加要求「统一后台测试能力后，其他的后台测试需要下线删除」冲突。现更正为：

- 某 operation 获得 `ROUTE_BEHAVIOR` 覆盖后，其 owner 层行为测试**默认删除**，业务断言在迁移中**逐条并入** route 场景，不得丢失；
- 例外只能进入一份**显式、有限、逐条写明理由的封闭保留清单**，判据严格限定为「**不触库、不过事务、不跨 owner** 的纯算法 / mapper / parser」；
- 保留清单内的测试**不得产出任何后台性能或整体功能 verdict**。

**不在删除范围**：编译、静态契约生成、架构边界、源码机械门。它们职责不同，不是后台**行为**测试（裁决 7）。

### 3.2 单元数据模型（每个被驱动的 operation 一条）

必需字段，缺一即 fail-closed：

| 字段 | 含义 | 不得自动猜测 |
|---|---|---|
| `operationId` | 来自 generated route registry | — |
| `owningTestClass` / `owningTestMethod` | 承担该 operation 的包测试 | — |
| `scenarioId` | 业务场景标识 | — |
| `identity` | 调用身份 / scope | **是** |
| `precondition` | 前置业务状态 | **是** |
| `requestShape` | 请求体来源 | **是** |
| `functionalOracle` | 业务成功条件（响应内容 + 调用后 DB 状态） | **是** |
| `performanceCriterion` | 计量口径下的预算 | **是** |
| `measurementBasis` | 固定为 tracker 的计量基 | — |

> 裁决 5 的可执行形态就在这张表：**结构可以自动发现，语义必须显式声明。** 新接口被自动感知，但它的 `identity` / `precondition` / `requestShape` / `functionalOracle` / `performanceCriterion` 五项**必须由人写**，写不出就红。

### 3.3 计量口径统一

- **单一权威计量基**：`DatabaseOperationTracker` 的 `JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH`，`MEASUREMENT_SCHEMA_VERSION` 参与证据比对。
- `CountingDataSource` / `EXACT_SQL_STATEMENTS` 作为**第二口径**必须显式处置：或退役、或明确声明其适用边界并**禁止与主口径数字互相引用**。两个口径混用会产出不可比的「性能下降」结论。

---

## 4. 自动发现与 admission 流程

```
[generated route registry 并集]  ← 唯一权威分母源（结构）
            │
            ├─ 与「已声明单元」求双向差集
            │
   ┌────────┴────────┐
   │                 │
新增未声明        已声明但路由已消失
   │                 │
FAIL_CLOSED       FAIL_CLOSED
UNCOVERED_        STALE_UNIT
OPERATION
```

要求：

1. 分母**每次运行时重算**，不得读取任何冻结的分母常量。
2. 双向：新增 fail-closed（补上现在缺的方向），删除 / 改名 fail-closed（保住现有能力）。
3. 差集为空**仅表示结构齐备**，不代表语义齐备——语义由 §3.2 五项的存在性与 §5 的实际断言结果保证。
4. **禁止**任何形如「总数必须等于 N」的硬断言。判据只能是**差集为空**，不能是**计数相等**。

---

## 5. runner 执行流程

```
共享容器（单例，跨测试类复用）
   └─ 每个 ROUTE_BEHAVIOR 测试
        ├─ 建立 precondition（显式 fixture，不猜）
        ├─ 以声明 identity 驱动真实路由
        │     └─ 生产 interceptor 在请求线程计量（无需新建）
        ├─ 断言 1：接口形状（method / path / status / envelope 序列化）
        ├─ 断言 2：业务结果（响应内容 + 调用后 DB 状态）
        ├─ 断言 3：性能预算（计量基下的 DB 操作数）
        └─ 清理断言：该场景留下的状态可判定
```

**一次执行、三条断言**，这就是「不分家」的技术含义。

实现侧要点（仓内事实支撑）：

- 测量事件当前受 profile + secret 头 + runId 头门控。内生化需要一个**测试可见的 in-JVM sink**，而不是让每个包测试去编排环境变量与外部事件文件。这是本方案唯一需要新增的机制，且**只是取数通道，不是新计量层**。
- 容器共享与 sink 均应落在**一个共享测试基座**上（当前 `extends` 关系为 0，基座不存在，必须建立）。

---

## 6. 四类闭合维度（必须分开报告，禁止互相冒充）

| 维度 | 由谁保证 | 绿了能说什么 | 绿了**不能**说什么 |
|---|---|---|---|
| **静态契约完整性** | 编译、契约生成、架构边界、源码机械门 | 结构与声明自洽 | 不能说业务对、不能说性能达标 |
| **动态功能成功** | `ROUTE_BEHAVIOR` 的形状 + 业务断言 | 该场景业务结果正确 | 不能说未覆盖场景正确 |
| **动态性能预算** | 同一次执行的计量断言 | 该场景 DB 开销在预算内 | 不能说真实数据量下延迟可接受 |
| **清理** | 场景状态可判定 | 无残留 | 不能替代前三项 |

裁决 7 的落点：静态门**保留原职责、保留原身份**，既不升格为行为测试，也不因「只留一类测试」而删除。它们证明的是**声明自洽**；行为测试证明的是**运行时没有说谎**。两者不可互换。

---

## 7. 现状测试资产 disposition

| 资产（时点快照） | disposition | 理由 |
|---|---|---|
| 18 个手工装配包测试的**业务断言** | **保留** | 唯一真实业务语义资产。迁移时必须逐条保住，不得在改入口时丢失。 |
| 这 18 个的**入口层** | **分类迁移** | 计入接口覆盖的改为路由入口；纯 owner 逻辑保留在方法层（§3.1）。 |
| 独立 HTTP lane（Java 类 + node runner + remote workload） | **退役** | 其能力被内生化吸收。退役**必须在**接口覆盖由包测试承接**之后**，否则会造成覆盖真空。 |
| 名称 / 类名 / checker 名中的 `196` | **退役** | 裁决 3。含 5 个文件名与 1 个 Java 类名。 |
| `denominators` 的 16 个冻结数字、`recipes.length !== 396`、`U07=196` 字面量 | **退役** | 计数相等判据替换为差集为空判据（§4.4）。 |
| fixture catalog 396 行 | **改造后保留** | 其 `materializerKind` 与 fixture 编排是真实资产；须由「独立 lane 的输入」改为「包测试可复用的 fixture 来源」。 |
| `withRoute` 的删除方向 fail-closed | **保留并推广** | 现有唯一正确的方向，新增方向照此补齐。 |
| `static-196-reconciliation` 的对账对象 | **改锚** | 从手写 bindings 改锚到 generated route registry。 |
| `HttpRequestMetricsInterceptor` + `DatabaseOperationTracker` | **保留为唯一权威计量** | 生产级、已验证、跨线程正确。 |
| `CountingDataSource` / `EXACT_SQL_STATEMENTS`（P4） | **待裁定**：退役或明确边界 | 双口径不可比，必须择一（§3.3）。 |
| 各测试类自建容器（20 实例） | **收敛为共享单例** | 方案前置条件（§2.3）。 |
| seed | **保留，且只做一件事** | 为 DEV 提供业务数据。不拆 biz / test 两套。 |
| 编译 / 契约生成 / 架构边界 / 源码机械门 | **原样保留** | 裁决 7。 |

---

## 8. 迁移顺序（顺序本身是要求）

1. **建共享测试基座**：容器单例 + 测量 sink。此步不改任何断言。
2. **改锚分母**：对账对象换成 generated route registry，**先补新增方向 fail-closed**。此时会暴露一批未覆盖 operation —— 这是预期结果，不是故障。
3. **建单元声明模型**（§3.2），允许分批填充，未填充者列为已知未覆盖并 fail-closed。
4. **逐包迁移**：按 owner 模块推进，每包完成后该包 operation 转为已覆盖。**每包迁移必须保住原有业务断言**。
5. **接口覆盖差集归零后**，退役独立 HTTP lane 与全部 `196` 命名。
6. **处置双计量口径**（§3.3）。
7. **移除 seed 的一切性能与功能验证职责表述**，seed 只留 DEV 数据供给。

> 第 5 步**不得提前**：先退役后迁移会造成接口覆盖真空。

---

## 9. 验收与 red mutation

每条控制必须有 production validator 与**真实红变异**（在 scratchpad 拷贝上验证「确实会红且失败原因精确命中」）：

| 控制 | red mutation |
|---|---|
| 新增接口 fail-closed | 向 generated route registry 加一个 operation，不加声明 → 必红，且原因为「未覆盖」 |
| 删除接口 fail-closed | 移除一个 operation → 必红，原因为「声明陈旧」 |
| 语义不得自动猜测 | 声明中抹掉 `functionalOracle` 或 `identity` → 必红 |
| 功能断言真实存在 | 令某 operation 返回 2xx 但业务结果错误 → 必红（**当前 lane 在此必绿，这正是要修的**） |
| 性能内生 | 在某 operation 路径上人为增加 DB 往返 → 该包测试必红 |
| 禁止计数相等判据 | 引入任一「总数 == N」硬断言 → 必红 |
| 计量口径单一 | 混用第二口径数字做结论 → 必红 |
| 清理维度独立 | 场景留下不可判定残留 → 清理断言必红，且**不得**被功能绿掩盖 |
| 静态门未被降格 | 删除任一静态门并声称「已由行为测试覆盖」→ 必红 |

**验收禁止项**：不得以静态门全绿、差集为空、或历史 PASS 报告，宣称动态功能、性能或清理成功。

---

## 10. 需 Dexter 裁决

> **本节三项已于 2026-08-12 由 Dexter 授权 Claude 依「方向要便宜」裁定，处置见合并稿 review。以下保留原始问题与最终裁定。**

1. **双计量口径的处置**：`CountingDataSource` / `EXACT_SQL_STATEMENTS`（P4 台账现用，实测 **28 row / 26 callerSymbol / 52 case**）与 tracker 主口径不可比。
   **裁定**：不做换算迁移——方法级 SQL 语句数无法换算为 HTTP 级多指标预算，「校准」实为重新测量。某 operation 获得 ROUTE_BEHAVIOR 预算后，其 P4 row **直接删除**，新预算重新实测、不继承旧值。

2. **真实数据量下的延迟**：本方案覆盖的是 **DB 调用次数**回归——小 fixture 上 N+1 会表现为次数上升，计量抓得到；但**耗时**必须在有量的库上才看得见。
   **裁定**：**后置**。本轮性能维度只保留确定性结构计数，时延/分位数/预热/采样一律不做，登记 `HANDOFF.md` 欠账。

3. **`OWNER_LOGIC` 测试的性能断言强度**：方法边界的计量口径与 HTTP 边界不同（后者含边界层与连接层开销）。
   **裁定**：仅 `ROUTE_BEHAVIOR` 带硬预算。且据 Dexter 本轮追加要求（统一后其他后台测试下线删除），`OWNER_LOGIC` **降级为过渡类别**，见 §3.1 更正。

---

## 11. 授权边界

- 本文档是**需求与方案分析**，不是实施授权，不是评审结论，不含 `GO` / `NO-GO`，不构成对任何他方方案的认可或否决。
- 本轮**未执行** Testcontainers、DEV、L2、reset、seed、浏览器、UAT、部署、手工 SQL 或产品范围变更。
- 文中所有数字均为**本会话独立复算的时点快照**，不得作为未来目标分母或固定判据引用。
- §1 为仓内事实；§2 起的判断中，方案取舍属工程推论，`需 Dexter 裁决` 三项属未裁定项，未标注者不得当作已裁定。

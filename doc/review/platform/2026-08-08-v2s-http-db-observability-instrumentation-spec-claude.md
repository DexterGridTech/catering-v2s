# HTTP 接口数据库往返可观测性改造说明（给 Codex）

状态：`INSTRUMENTATION_SPEC` —— 本文只定义"要打什么日志、怎么关联、怎么输出"，
以及跑通后如何取数。**不包含任何性能优化改动**，也不改业务、权限、事务语义。

背景：Dexter 判断当前手上的工具与数据不足以支撑根因分析，已让双方停止分析，
先把可观测性补齐，再用 seed 跑出完整程序日志重做分析。本文是那次改造的输入。

---

## 0. 先说三个已确证的事实（改造的依据）

这三条我逐个打开源码亲验过，是整份说明的地基。

### 0.1 DB 计数为 0 不是 tracker 坏了，是**没开 scope**

`HttpRequestMetricsInterceptor.preHandle`（第 53–68 行）在**两道早退**之后才开 tracker scope：

```java
if (!active || !validSecret(request.getHeader(mode.secretHeader()))) return true;   // 54
if (!runId.equals(request.getHeader(mode.runIdHeader()))) return true;              // 55
...
DatabaseOperationTracker.Scope scope = DatabaseOperationTracker.open();             // 64
```

而 `active` 本身还要求（第 44–49 行）：`mode != null`、`environment == "non-production"`、
`runId` 匹配 `[A-Za-z0-9._:-]{8,128}`、`secret.length >= 24`、
`namespace` 匹配 `v2s-(?:dev|http-diagnostic)-[a-z0-9-]{3,32}`、`eventsPath != null`。

`DatabaseOperationTracker.record()` 在 `CURRENT` ThreadLocal 为 null 时**静默空转**（第 25–26 行），
静态 `snapshot()` 则返回 `Snapshot.empty()`（第 20–22 行）。

**实测印证**：`.runtime/r5/business-server.log` 里 `REQUEST_SUCCEEDED` 事件 125 条、65 条非零；
`REQUEST_COMPLETED` 事件 712 条**全部为 0**，覆盖 catalog 629、asset 34、platform-iam 18、
platform-workspace 13、fulfillment-production 10、workspace-iam 6、inventory 2。
即 r5-full seed 客户端带了诊断头、数字为真；catalog-inventory seed 客户端没带，全程记 0。

> **这意味着"catalog 接口 DB 次数未知"是客户端未接入诊断协议，不是后端缺能力。
> 这条修好，42 个 catalog operation 的真实计数立刻可得，改动量极小。**

### 0.2 现有 `kind` 不足以支撑归因

`CountingDataSource.StatementHandler.kind()` 只按 JDBC 方法名分三类：
`QUERY` / `BATCH` / `UPDATE`。它**不是** session/权限/scope/owner/幂等/CAS/审计/readback 那种来源归因。
所以"数据已经采集、只差输出"的说法不成立——归因维度需要新建。

另外三个当前不可见的成本：

- `getConnection()` **不计数**（`ConnectionHandler` 只包装 Statement 工厂方法，不记录获取连接本身）；
- `executeBatch` 记为 **1 次**，与批内语句数无关；
- 事务开始/提交/回滚（`setAutoCommit`/`commit`/`rollback`）**不计数**，而这些在远端库上同样要付往返。

### 0.3 单次 DB 往返约 42ms，这决定了优化方向的排序

我从 `rm1-seed-23c45701` 的 41 个 endpoint 复算：
DB 次数与 DB 耗时相关系数 **r = 0.9892**，单次操作耗时中位数 **42.2ms**、均值 43.3ms、
区间 35–71ms（两个 70ms 上界都出现在单次操作的请求上，属固定开销未被摊薄）。
DB 占端到端加权总时长 **81.9%**。

单次 42ms 与查询复杂度无关，本地库走索引的查询是亚毫秒级——**这是往返延迟不是执行时间**。
因此后续分析必须同时回答两个问题，且**不要预设答案在第一个**：

1. 次数能不能降（owner-local 代码问题）；
2. 单次 42ms 能不能降（拓扑/连接池/tunnel 问题）。

在同机部署下 44 次 × 0.5ms ≈ 22ms，同样一段代码就不构成用户可感问题。
**所以改造后取数必须同时记录连接获取耗时与拓扑信息**，否则会把 DEV 拓扑的账算到业务代码头上。

---

## 1. 必须改动的代码点（按优先级）

### P0-1｜让 catalog-inventory seed 接入诊断协议（最小改动、最高收益）

**文件**：`scripts/dev/catalog-inventory-seed-executor.mjs`

**做什么**：该执行器所有 HTTP 请求补齐 `HttpRequestMetricsInterceptor` 要求的头：
诊断 secret 头、runId 头，以及它已经在校验的 operation 头与 route 头
（见 `mode.secretHeader()` / `mode.runIdHeader()` / `mode.operationHeader()` / `mode.routeHeader()`）。
具体头名从 `Mode.forProfile(profile)` 读，不要硬编码字面量。

**为什么必须做**：不做这条，改造再多也拿不到 catalog 域 42 个 operation 的任何 DB 数据。
参照实现看 r5-full 的 seed 客户端（它已经在正确发送），复制同一套头构造逻辑即可。

**验收**：跑一次 catalog seed 后，`business-server.log` 中 owner=catalog 的
`databaseOperationCount` 出现非零；当前是 629/629 全零。

### P0-2｜请求侧统一开 scope，不再依赖客户端头

**文件**：`apps/backend/.../app/edge/diagnostic/HttpRequestMetricsInterceptor.java`

**做什么**：把"**开 tracker scope**"与"**写诊断事件文件**"两件事解耦。
scope 应在 `active`（环境级开关）为真时就开，不要求逐请求 secret/runId 头；
事件落盘仍保持现有的 secret + runId 校验。

**为什么**：当前 scope 的生命周期被绑在"这个请求是否来自受管诊断客户端"上，
导致任何非诊断客户端（含 L2 浏览器、手工 curl、未来的 UAT 流量）都测不到。
诊断的价值恰恰在于能测非受控流量。

**边界**：`environment == "non-production"` 这道闸**必须保留**，不得在生产开启。

### P1-1｜给每次 DB 操作加来源归因

**文件**：
`apps/backend/.../modules/foundation/.../persistence/DatabaseOperationTracker.java`、
`apps/backend/.../modules/foundation/.../persistence/CountingDataSource.java`

**做什么**：把 `Operation` 从 `(kind, durationMillis)` 扩到至少：

```
Operation(seq, kind, durationMillis, section, callSite, statementId)
```

- `seq`：请求内自增序号，用于还原顺序与定位 N+1（连续同 `statementId` 即为强信号）；
- `kind`：保留现有 QUERY/UPDATE/BATCH；
- `section`：**来源归因**，取值见 §2；
- `callSite`：栈上第一个 `com.catering.v2s.` 且不属于 foundation.persistence 的帧
  （`类名#方法:行号`），这是最省事且零侵入的归因兜底；
- `statementId`：**参数化 SQL 模板的稳定哈希**（见下方安全边界）。

**安全边界（不得违反）**：`DatabaseOperationTracker` 的类注释写明
"it never stores SQL or bind values"，`CountingDataSource` 注释写明
"without retaining SQL or parameters"。这条**保留**——
只允许记录 `PreparedStatement` 的**参数化模板**（含 `?` 占位、不含绑定值）的 SHA-256 前 12 位作为
`statementId`，另建一份 `statementId → 模板` 的**旁路字典**落在 run 目录下，
不进主日志、不随请求响应外发。若 Dexter 认为连模板也不宜落盘，则退化为只保留 `callSite`，
分析时靠 `callSite` 定位——**这一点请让 Dexter 裁定，不要自行放宽**。

### P1-2｜补齐三类当前不可见的往返

同上两个文件：

- `ConnectionHandler` 增加对 `getConnection` 的计时，记为 `kind=CONNECTION`；
- `executeBatch`/`executeLargeBatch` 记录**批内语句数**，`count` 按实际语句数累加，
  或至少单列 `batchSize` 字段，避免把 N 条压成 1 条；
- `commit`/`rollback`/`setAutoCommit(false)` 记为 `kind=TRANSACTION`。

**注意**：这会让现有数字**变大**（例如 44 可能变成 50+）。这是精度提升不是回归，
但必须在改造记录里显式写明"分母口径已变更"，否则会与历史 evidence 的 44/36 对不上。

### P1-3｜发出阶段事件，让归因可交叉验证

**文件**：`apps/backend/.../app/edge/diagnostic/RequestCompletionDiagnosticState.java`
及 owner 协调层。

**现状**：全日志 795 个请求里 `phase=OWNER_COMMAND` 的事件只出现 **2 次**，
其余全是 `phase=EDGE`。等于阶段维度形同虚设。

**做什么**：在每个请求的固定边界各发一条事件，携带**当时的累计 DB 计数**：
`EDGE_IN` → `SESSION_RESOLVED` → `AUTHORIZED` → `SCOPE_RESOLVED` →
`OWNER_COMMAND_BEGIN` → `OWNER_COMMAND_END` → `READBACK_END` → `EDGE_OUT`。
相邻两条之差即该阶段的 DB 次数，可与 §1-P1-1 的 `section` 互相印证。
**两套归因必须能对上**，对不上说明有路径没被覆盖，这本身就是发现。

### P2-1｜把 catalog seed 的 DB 指标聚合回报告

**文件**：`scripts/dev/catalog-inventory-seed-executor.mjs` 的 report 生成段

P0-1 做完后，按 requestId 把后端事件聚合回 seed report，
与 r5-full 的 `apiEndpoints[].databaseOperationCount` 保持**同一结构**，
这样两个 seed 的数据可以用同一套脚本分析。

---

## 2. `section` 归因的取值闭集

必须是闭集，未命中一律落 `UNCLASSIFIED`（**不允许静默归到相邻类**）：

| section | 含义 |
|---|---|
| `SESSION` | 会话令牌解析、会话读取 |
| `AUTHZ` | 权限/能力校验、角色与分配读取 |
| `SCOPE` | 组织范围、数据节点归属、品牌授权校验 |
| `OWNER_READ` | owner 自有事实读取（业务前置查询） |
| `OWNER_WRITE` | owner 自有事实写入 |
| `REFERENCE_CHECK` | 引用存在性/唯一性/兼容性校验 |
| `EXTENSION` | 扩展字段定义与取值 |
| `IDEMPOTENCY` | 幂等键查询与回执写入 |
| `CAS` | 版本比较与冲突检测 |
| `AUDIT` | 审计与历史写入 |
| `READBACK` | 写后回读 |
| `CONNECTION` | 连接获取 |
| `TRANSACTION` | 事务控制 |
| `UNCLASSIFIED` | 未命中 |

`UNCLASSIFIED` 的占比是这次改造的**质量指标**：跑完第一轮如果它超过 15%，
说明归因未覆盖主路径，应先补覆盖再做分析，不要带着盲区下结论。

**实现建议**：用请求作用域的 section 栈（`push`/`pop`），在
edge 过滤链、session resolver、authorization service、owner service 的入口各 push 一次。
不建议用注解——注解会漏掉 lambda 内与工具类里的 jdbc 调用，而那正是最容易藏 N+1 的地方。

---

## 2.5 让"烂逻辑"在日志里自己现形（本次改造的核心目的）

Dexter 的要求是：**日志要能看出究竟是什么样的烂逻辑导致这么多次调 DB**，
而不只是给出一个总数。只有计数和 section 做不到这一点——
"REFERENCE_CHECK 17 次"仍然看不出那 17 次是必要的还是同一条 SQL 打了 17 遍。

要让问题自明，必须在每条 DB 操作上同时记录**两个哈希**：

- `statementId`：**参数化 SQL 模板**的哈希（含 `?` 占位，不含绑定值）
- `paramsHash`：**绑定值**的哈希 —— **只存哈希，不存值本身**

这两个哈希组合起来，四种典型烂逻辑就能被机械区分，无需人工读代码：

| 现象 | 判据 | 性质 |
|---|---|---|
| **纯重复查询** | 同 `statementId` **且** 同 `paramsHash` 出现 ≥2 次 | 同一份事实被查了多遍，本可传递或请求内缓存。**几乎一定是浪费** |
| **N+1** | 同 `statementId`、`paramsHash` 各不相同、连续出现 ≥3 次 | 循环里逐条查，本可一次 `IN (...)` 批量取 |
| **重复会话/权限解析** | `section=SESSION` 或 `AUTHZ` 内出现同 statementId+同 paramsHash | 同一请求内把会话或权限解析了多次 |
| **写后过度回读** | `section=READBACK` 的条数 > 实际写入对象数 | 回读粒度过细，可合并为一次 |

`paramsHash` 是这里的关键——**没有它就分不清 N+1 和纯重复**，
而这两者的修法完全不同（前者改批量查询，后者改传参/缓存）。
它同时满足现有代码"不存 SQL 与绑定值"的安全边界：哈希不可逆，落盘的不是业务数据。

### 应用自己给出诊断结论，不要只丢原始数据

请在每个请求的汇总事件里**直接输出已判定的可疑模式**，让人打开日志就能看见结论：

```json
{"requestId":"req-...","operationId":"createOperationsOrganizationStore",
 "databaseOperationCount":51,
 "sectionCounts":{"SESSION":2,"AUTHZ":6,"SCOPE":4,"OWNER_READ":9,"REFERENCE_CHECK":17,
                  "IDEMPOTENCY":2,"CAS":1,"AUDIT":3,"READBACK":5,"CONNECTION":1,"TRANSACTION":1},
 "suspects":[
   {"pattern":"REDUNDANT_REPEAT","statementId":"a1b2c3d4","paramsHash":"9f8e7d","count":6,
    "callSite":"OrganizationHierarchyService#resolveParentChain:214","section":"SCOPE"},
   {"pattern":"N_PLUS_ONE","statementId":"e5f6a7b8","distinctParams":12,"count":12,
    "callSite":"BusinessEntityService#loadBrandAuthorizations:389","section":"REFERENCE_CHECK"}
 ]}
```

判定规则写死在代码里、阈值可配：
`REDUNDANT_REPEAT` 为同 statementId+同 paramsHash 计数 ≥2；
`N_PLUS_ONE` 为同 statementId、distinctParams ≥3 且 count == distinctParams。
**规则要简单到不会误判**——宁可漏报也不要报一堆噪声，
真正的大问题（一条 SQL 打十几遍）用这两条规则一定抓得到。

### `callSite` 要能直接跳到那一行

`callSite` 取栈上第一个 `com.catering.v2s.` 且不在 `foundation.persistence` 包内的帧，
格式 `类名#方法:行号`。这是让"烂逻辑"落到具体代码行的唯一途径——
没有它，看到 `REFERENCE_CHECK 17 次` 仍然要靠人猜是哪段代码。

采集成本可控：只在 `active` 为真的非生产环境取栈，
且只取到第一个匹配帧就停（`StackWalker` 配合 `limit`），不做全栈快照。

---

## 3. 关联要求（缺一不可）

每条 DB 操作记录必须能同时回答"哪个请求、哪个接口、哪个阶段、第几次"：

- `runId`：整次 seed 运行
- `correlationId`：一次业务流程（seed stage）
- `requestId`：单个 HTTP 请求 —— **这是主键**
- `operationId` + `routeTemplate` + `owner` + `consumerFace`
- `phase` + `section` + `seq`
- `statementId`（或 `callSite`）
- `durationMillis`

前四组现有事件里已经有了（`Slf4jSecurityDiagnosticRecorder` 已在输出
`correlationId`/`requestId`/`operationId`/`routeTemplate`/`owner`/`consumerFace`），
**沿用同名字段，不要另起一套命名**，否则两份日志无法 join。

---

## 4. 输出格式

### 4.1 主输出：逐 DB 操作一行 JSONL

落在 run 目录下独立文件（例如 `.runtime/r5/<run>/db-operations.jsonl`），
**不要混进 `business-server.log`**——那是人读的应用日志，混进去会让 456KB 变成几十 MB 且难以解析。

```json
{"runId":"...","correlationId":"...","requestId":"req-...","operationId":"createOperationsOrganizationStore",
 "owner":"organization","phase":"OWNER_COMMAND","section":"REFERENCE_CHECK","seq":17,
 "kind":"QUERY","statementId":"a1b2c3d4e5f6","paramsHash":"9f8e7d6c","batchSize":1,
 "callSite":"BusinessEntityService#loadBrandAuthorizations:389","durationMillis":41}
```

`seq` 让顺序可还原，`statementId`+`paramsHash` 让 §2.5 的四类模式可机械判定，
`callSite` 让结论能直接跳到代码行。**这四个字段缺任何一个，"看出烂逻辑"这个目标就达不成。**

### 4.2 次输出：逐请求汇总（保留现有事件，扩字段）

现有 `REQUEST_COMPLETED` 事件保留，增补：
`sectionCounts`（按 §2 闭集的计数字典）、`connectionAcquireMillis`、`batchStatementTotal`。
这样不解析 JSONL 也能一眼看出结构。

### 4.3 旁路字典

`statementId → 参数化模板` 落 `.runtime/r5/<run>/statement-dictionary.json`，
仅本机分析用。**受 §1-P1-1 的安全边界约束。**

---

## 5. 跑数与取数流程

改造完成后按此顺序跑，**每步都要先确认前一步的计数非零再往下**，
否则会重演这次"跑完才发现全是 0"：

1. **冒烟**：任意一个接口发一次请求，确认 `db-operations.jsonl` 有行、
   `sectionCounts` 非空、`UNCLASSIFIED` 占比可接受；
2. **r5-full seed**：作为回归基线，新口径下的 41 个 endpoint 计数应 **≥** 历史值
   （因为补了 connection/transaction/batch），若**小于**历史值说明改造引入了漏记；
3. **catalog-inventory seed**：首次取得 42 个 catalog operation 的真实计数；
4. **未执行接口**：196 - 已执行 的部分，按 §6 处置。

**取数时必须同时记录拓扑**：应用与数据库是否同机、是否经 tunnel、连接池配置
（最大连接数、是否预热）、以及一次空查询（`SELECT 1`）的往返基线。
没有这个基线，42ms 归因不到具体环节。

---

## 6. 未执行接口的处置（不得默认正常）

分母是 **196**（我已独立复算：edge-route-face-registry 154 = public 12 + operations-admin 92 +
platform-admin 50，加 catalog-inventory-edge-route-registry 42，两组不相交；
platform-route-face-registry 的 3 与 capability-operation-registry 的 113 均为子集）。

r5-full seed 覆盖 41 个，**未执行 155 个**：operations-admin 75、catalog 42、
platform-admin 31、public 7。

请按此分类，**逐个 operation 落表**，不得笼统写"未覆盖"：

- `COVERED_BY_R5_SEED`：本次已执行
- `COVERED_BY_CATALOG_SEED`：P0-1 修好后可覆盖
- `NEEDS_MINIMAL_FIXTURE`：需补最小诊断 fixture，**说明需要哪几个前置事实**
- `READ_ONLY_TRIVIAL`：纯读且无授权分支，可用现有会话直接打一次
- `DESTRUCTIVE_OR_STATEFUL`：作废/删除类，需独立命名空间，**不得在体验数据上跑**
- `NOT_REACHABLE_IN_DEV`：说明具体原因（依赖外部系统、需真实支付等）

`NEEDS_MINIMAL_FIXTURE` 的 fixture 必须**最小、安全、彼此独立**：
一个接口一个 fixture，不共享运行态，失败即停并保留首败。

---

## 7. 明确不做的事

改造阶段**不允许**顺手做以下任何一项，它们属于优化不属于观测：

- 合并 SQL、加缓存、改事务边界、加索引；
- 删除任何授权重核、幂等、CAS、审计、锁、typed failure 或必要 readback；
- 改动 `r5-full` profile 的既有分母与行为；
- 在生产环境开启任何新日志。

优化建议要等新数据出来后按 owner-local 提出，并且必须区分
"降低 request-local DB count" 与 "经受控 workload 验证的 p50/p95 改善"——
按 §0.3 的 42ms 结论，这两者在当前 DEV 拓扑下**不是同一回事**。

---

## 8. 我这份说明的置信边界（如实声明）

- §0.1、§0.2 逐行读过 `DatabaseOperationTracker`、`CountingDataSource`、
  `HttpRequestMetricsInterceptor`、`RequestCompletionDiagnosticState` 四个文件，置信高；
- §0.3 的 42ms 与 r=0.9892 是我对 `rm1-seed-23c45701` 的 41 个 endpoint 独立复算所得，
  未采信报告自述；
- §1 的改动点是**基于当前字节的建议**，我未实施也未编译验证，具体落点以 Codex 实施时的实际结构为准；
- 我**没有**读完 155 个未执行接口各自的实现，§6 是分类框架不是分类结论；
- 关于 `statementId` 是否落盘，我给了两个方案但**未替 Dexter 裁定**。

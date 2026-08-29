# 后台接口性能整改 · implementation-facing 详设

```text
BUSINESS_SOURCE=doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-requirements-claude.md
JOURNEY_REFS=doc/decisions/2026-08-22-v2s-backend-performance-batch-outcome-journey.md
IA_REF=doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-ia-codex.md
INTERACTION_REF=doc/decisions/2026-08-22-v2s-backend-performance-batch-outcome-ui-interaction.md
INTAKE_REF=doc/review/platform/2026-08-22-v2s-backend-performance-remediation-design-intake-codex.md
AUTHORIZED=详设、实施计划、设计工件、独立设计复核与 CP-00..CP-13 实施
NOT_AUTHORIZED=reset、start/restart DEV、seed、browser L2、UAT、部署、数据操作
IMPLEMENTATION_AUTHORITY=true
IMPLEMENTATION_AUTHORIZATION=DEXTER_DESIGN_GO_CP00_CP13_20260822
```

## 1 · 真实业务目标与方案比较

### 1.0 · 2026-08-26 current-tree denominator addendum

**Dexter current-program-result budget decision**：本次交付不再以追加三次校准或逐首败调参作为前置；使用最近一次**完整受管 ACCEPTANCE** 的归档 HTTP completion current maximum 作为唯一初始预算输入。报告必须明确标记 `CURRENT_MANAGED_ACCEPTANCE_RESULT`、`runCount=1`、`CURRENT_MANAGED_ACCEPTANCE_RUN_MAX;AVERAGE_NOT_USED` 与 `DEXTER-2026-08-26-CURRENT_PROGRAM_RESULT_BUDGET`，并仍经 archive 双 hash、238 exact-set、成功 normal sample、Testcontainers test execution PASS 与 cleanup PASS 验证。外层 run 若只因旧预算而 FAIL，必须逐字保留该首败，不能冒充整体 ACCEPTANCE PASS。

该裁定只替换本次 CP-05 的测量次数与初值来源，不放松业务事实：不得删除 owner 复核、事务、锁、幂等、receipt、审计或 authoritative readback。受控预算例外仍只在同时证明业务事实未削弱，以及现有通用机制已经复用、没有可消除重复/N+1 时成立；本次 current-result 初值不是针对单 operation 的例外表。

本详设中所有 `238=181+57`、`57` catalog route、`238/238` 仅作为 2026-08-21 evidence 的历史快照，不得继续用作实施或验收分母。`239=180+59` 是 base-1 CP-B0 之前的历史基线，不是当前 active denominator；base-1 CP-F3 后两条 owning generator 的当前唯一 exact set 为 **238=180+58**。原 P0--P5 的 `94/4/57/36/9/38` 也仅是历史重分类输入。实施须先重新生成并比较 current tree，当前任何非 `238` 的值都是 exact-set 红夹具，任何差异先更新本详设及其 serial plan，不得静默沿用旧清单。

预算的 `measurementScenarioIds` 表达受 credential 保护的正常性能样本，不是 route coverage 的别名：completion event 必须写入明确 sample ID；exact-set 读全量 event，预算/连接只读 `outcome=SUCCEEDED` 且该 ID 已由该 operation budget 声明的 normal-path event。coverage-only 4xx 只证明 route reachability；缺 normal sample 必须 fail closed，不可调高预算或以 4xx 补洞。本批仅允许两个闭集 ID：budget metadata 只能声明 `performance.normal-path`，coverage event 只能使用 `performance.coverage-only`；interceptor、parser 与生成期 validator 都拒绝第三值。二者从现有 scenario/P2/coverage fixture 注入，绝不成为产品 HTTP contract。完整 exact-set run 由受管 runner 强制启用现有 P2 normal recipes 与 coverage-only fixture，不能由调用方环境变量任选其一。

### 1.1 结构性问题

历史 DEV 每次 SQL/连接动作跨 SSH PostgreSQL tunnel；高往返接口被放大到秒级乃至几十秒。历史快照中的 238 个 operation 没有非空预算闭集，测量中的 owner 语句因受管 acceptance 未启用 call-site layer classification 大量落入 `UNCLASSIFIED`。只搬 Java 会保留重复往返，只减 SQL 会让 DEV 延迟仍被拓扑主导，只加门会把错误基线冻结为目标。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A · 仅调连接池、timeout 或加缓存 | 不消除每 SQL 隧道往返，也掩盖可直接消除的重复读取 | 拒绝 |
| B · 推翻 owner/schema、把读写揉成大 SQL | 同侧最慢写约 51ms，收益不足以购买 owner 主权与事务风险 | 拒绝 |
| C · 远端 Java + 本机 Vite；current exact-set 预算/分类门；按闭集整改 P0–P5 | 分别移除两个乘数，保留单 deployable、owner transaction 与真实 readback | **采用** |

我选 C 而不是 A/B，因为 C 用既有受管运行与 JDBC 观测能力消除已实测的两个乘数，不引入缓存、分布式组件或跨 owner 写。

## 2 · CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-00 | 正本与治理原子翻转 | platform governance | AGENTS/Blueprint/runtime memory/规范与 AFTER 拓扑一致 | — |
| CP-01 | 受管 DEV 远端 Java | scripts/dev | 远端 Java、本机双 Vite、HTTP+asset tunnel、远端身份与 cleanup | CP-00 设计 |
| CP-02 | current exact-set operation 预算生成链与原子激活 | contract generators | 测量后一次性产生 `databaseOperationBudget` fixed/linear 非空 exact set + 历史 | CP-03/04、CP-05 测量 |
| CP-03 | 请求级观测与独立 run-level 性能门 | foundation + managed verifier | 先产非门控 event；CP-02 后原子激活 DB/connection/transactionBegin/UNCLASSIFIED 判定 | — |
| CP-04 | 架构层 statement 分类 | foundation | owner 默认归类与 semantic section 收敛 | CP-03 |
| CP-05 | P0 全量取证与预算实值 | managed performance calibration | current exact-set/current exact-set normal events、P0=0、初始预算输入；不产生 pending registry | CP-01、CP-03/04 观测 |
| CP-06 | 批量状态预载与严格结果 | catalog owner/contract/UI | 逐项尽力、`15+5×N`、strict receipt、结果 Modal | CP-05 |
| CP-07 | 两条 catalog copy 闭包批量读 | catalog owner | 两条 copy ≤35，结果逐字段不变 | CP-05 |
| CP-08 | save readback/引用批量化 | catalog+inventory owner | save ≤45，readback/CAS/receipt 不变 | CP-05 |
| CP-09 | P2 只读任务连接作用域 | task readers | 经 CP-05 当前树重分类确认的 GET 每请求借连接 1 | CP-05 |
| CP-10 | P3 同类引用/节点批量化 | 各 owner | 36 成员 ≤20，错误定位不降级 | CP-09 |
| CP-11 | P4 重分类 | foundation + owning source | 9 条归入 P2/P3/P5，UNCLASSIFIED ≤5% | CP-04/05 |
| CP-12 | P5 预算保护 | contract | 38 条不改业务，只纳门 | CP-05 |
| CP-13 | 当前树全量闭合与前后对比 | managed verification | static + current exact-set evidence + acceptance + L1 before/after | CP-06–12 |

CP-01 与 CP-03/04 的非门控观测可并行；CP-05 使用它们取得 current exact-set 的 normal 实值，随后 CP-02 一次性写满、生成并原子激活 run-level verifier。任何 budget 生成物在实值齐全前都不存在。CP-06–12 只能在 CP-05 当前树重分类后执行，历史 94/4/57/36/9/38 仅是输入基线。

## 3 · 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 可证伪观察 | ③ 无现成时目标形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | `CommandExecutionContextResolver`、各 task reader 现有 scope contract | `[acceptance]` P2/P0 GET 用错节点均拒绝且 DB 预算不因错误路径放宽 | 不因只读连接作用域移动授权边界 | CP-00 当前 GET 闭集；重点核验 CP-05 重分类 P2 |
| 写授权与 grant 复核 | `WorkspaceCapabilityScopeResolver` + owner command | `[acceptance]` 138 个写 operation 的代表负例仍在写前拒绝 | 性能批量读只准备事实，不代替项事务内授权/版本/状态复核 | 138 个写 operation；CP-06 为逐项复核 |
| 跨 owner 写与事务 | `foundation-charter.md` §1-B/1-C | `[owner test]` coordinator 仍只调目标 owner command；失败回滚边界不变 | 只读可用 task scope；禁止写事务跨 schema JOIN | CP-06/07/08/10 涉及的所有 owner 写 |
| 集合形态与分页 | charter §1-J；IA-BPR-01 | `[focused]` 批量 request/result 1–100 严格同序；101 拒绝 | 性能 registry 是 Bounded current exact-set；不伪造 Page | current registry；batch items/results 1–100；P0 evidence=current exact-set |
| 缓存失效 / 改完刷新什么 | `catalogInventoryApi` 既有 query identity；IA §1.2 | `[component]` batch 成功仅重取当前商品列表与导航 | direct client 收敛到 generated RTK mutation 或显式同形 invalidation | IA-BPR-01 唯一 UI 写 |
| RTK 数据读取与加载判定 | frontend standard §3-B | `[component]` refresh 时 `currentData` 留存且只显示局部 fetching | 不把 receipt 写入 query state | store item list/navigation/detail 消费点 |
| 同一事实只有一个住址 | frontend standard §3-E | `[static]` 商品列表不复制进 component state；Modal state 仅本次 receipt | owner receipt 是结果唯一真相 | batch results/list/navigation |
| 失败可见且原因不得改写 | frontend §3-D；backend §2-B/§1-D | `[component]` FAILED reason 原样显示；空 reason 进入协议失败 | `reason` 由 owner 脱敏生成，前端无本地 fallback | batch per-item 失败全集 + 请求级 typed problem |
| owner 错误到 HTTP 的映射与注册处 | `ContractProblemAdvice`、generated problem enum | `[acceptance]` 请求级问题保留 HTTP；项问题留在 2xx receipt | `CATALOG_BATCH_RESULT_PROTOCOL_INVALID` 仅前端消费错误，不伪造 owner HTTP code | IA §3 的 5+5 类 |
| 幂等键构成与重放语义 | frontend §3-G；catalog receipt 方法 | `[owner test]` 同 key 同请求逐字段重放；换顺序视为 request mismatch；结果顺序不漂移 | canonical request 保留规范化输入顺序，不再排序抹掉 order | batch status；其余 237 不改 |
| 该用生成物的地方不得手搓字符串 | backend §2-D；两条 route generator | `[static]` current exact-set budget、operationId、method/route 同源生成；少一条红 | budget schema/TS/Java 投影全部由 owning generator 发射 | CP-00 current exact-set、batch result wire |
| 日志落点与脱敏字段 | `HttpRequestMetricsInterceptor`、AGENTS 日志硬约束 | `[managed]` event 含 operationId/route/counts/measurementScenarioId，不含 SQL/bind/token/cookie/账号原文 | remote Java 日志本地拉取只保留脱敏结构化文件和 0600 secret | DEV start/stop/calibration/current HTTP events |
| 迁移回填与可逆性 | N/A：无 DB shape、无业务行迁移 | `[static]` Flyway 无新增性能/审计表 | 预算为 contract metadata；B-06 禁审计表 | 全批 N/A |
| 前端共享行为 | `admin-ui-foundation` Modal/HTTP problem/RTK lifecycle；frontend §3-F | `[focused]` 不新增 app-local Modal lifecycle/HTTP wrapper | 仅在现有 CatalogWorkbench 组合业务内容 | IA-BPR-01 |
| 候选/下拉数据源 | N/A：本批不新增候选/下拉 | `[static]` 新 UI 只有现有 targetStatus；无新 query | N/A | 全批 N/A |
| 编码与名称呈现 | IA：itemCode + owner reason | `[component]` 失败行显示 itemCode，DOM 不出现 itemRef | itemCode 必须由 owner receipt 返回，不从 stale row 对齐 | batch failure rows 0–100 |
| 会同时坏的东西是否已声明为原子组 | charter §5-C | `[static+focused]` A/B/C/D 四组完成后才运行证据；组中间不加 fallback | 见 §4 原子组 | A 治理+runtime；B budget chain；C batch contract；D measurement gate |

## 4 · CP 门控与原子组

### CP-00/01 · L1 原子组 A

- **组内顺序**：AGENTS、Blueprint、`scripts/README.md` 与 runtime skill 已先按 Dexter 裁定翻转并明确 fail closed；实施新增远端身份/预检/启动/日志/stop 能力 → HTTP tunnel 与 Vite target → reset/seed 指向 tunnel → focused self-test → 回读四份治理正本与 runner AFTER 一致。
- **中间态**：治理正本已禁止旧拓扑，因此新 runner 完成前 DEV start/restart 必须 fail closed。整组完成后旧命令若仍 spawn 本机 Gradle，门报 `REMOTE_JAVA_PROCESS_REQUIRED`；不得用兼容开关恢复旧形态。
- **不变量**：远端 Java 与 PG/MinIO 同 host；本机仅两个 Vite、一个拥有 HTTP+asset forward 的 tunnel；浏览器只见 localhost；asset public URL 仍可达。
- **身份**：远端 process identity=`trusted host + boot id + PID + /proc start ticks + command digest`；本机 tunnel/Vite=`PID + OS start token + command digest`。只停止 manifest 拥有的 identity。
- **readiness**：远端日志出现 `Started CateringV2sApplication`，本机 tunnel listener identity 与 manifest 相等，两个 Vite listener ready；端口存在本身不算 ready。
- **FORBID**：PostgreSQL forward、本机 Java fallback、按端口杀进程、把 secret 写进 manifest、移除 asset tunnel、start 自动 seed。
- **失败条件**：资源预检不足、远端 identity 漂移、日志拉取不可读、HTTP/asset 任一 tunnel 缺失、stop 任一 owned tree 残留，分别使 business/cleanup 红；business PASS 不覆盖 cleanup FAIL。

### CP-02 · 预算原子组 B

生成源中的每个 operation 增加：

```json
{
  "databaseOperationBudget": {
    "kind": "FIXED | LINEAR_REQUEST_CARDINALITY",
    "max": 20,
    "base": 15,
    "perItem": 5,
    "cardinalityPath": "$.items",
    "measurementScenarioIds": ["..."],
    "history": [{"from": null, "to": 20, "reason": "initial calibrated ceiling", "decisionRef": "..."}]
  }
}
```

- `FIXED` 只允许 `max`；linear 只允许 `base/perItem/cardinalityPath`。current exact-set 条全部非 null。
- 唯一 linear operation 是 `batchTransitionOperationsCatalogItemStatus`，值固定为 `15 + 5 × N`，N 为已通过 1–100 校验的 request.items 数量。
- 通用 schema 的普通 change 只能 `to < from`；`to > from` 默认拒绝。唯一受控例外必须来自同一 CP-05 report，并同时具有精确 `decisionRef`、from/to/history、三次实测 `max=to`、`businessFactsPreserved=true` 及 owner/event evidence、`sharedMechanismsReused=true` 及 source/measurement evidence、被拒绝的更小优化、成本比较与窄 operation scope。`scripts/test/backend-performance-budget.test.mjs` 必须证明普通 fixed 上调（有无 decisionRef）均红，且唯一完整 report-bound 例外才绿；不能只保留“无 decisionRef 调高”夹具。
- `normalPathDbOperations` 不重命名、不 fallback；旧字段继续表达既有说明性事实，budget 是新单义字段。
- **原子顺序**：edge 源 → catalog 源 → OpenAPI/registry/Java/TS projection → acceptance event loader → exact-set/self-test。任一生成物不手改。
- **激活顺序**：CP-05 之前只保留现有非门控 completion event，不创建 pending metadata。current exact-set normal 实值齐全后，以上原子顺序一次完成；validator/registry/verifier 同一原子组启用。不存在 `CALIBRATION_PENDING`、null、哨兵预算、默认无限预算或双 registry。
- **预算脚本口径**：`backend-performance-budget.mjs` 仅拥有共享 schema/validator 的 `--self-test`，不创建第三份 canonical registry；无 canonical 输入时其 `--check` 保持 `NOT_READY`。本批预算闭合以 `edge-codegen --check`、`catalog-inventory-p1 --check` 与 managed manifest `budgetEvidence` 的 current exact-set normal 实值消费为准，不能把该脚本的 `--check` 写成 PASS。

### CP-03/04 · 测量与分类原子组 D

- 独立 run-level verifier 消费 `http-request-events.jsonl`，以 `(runId, requestId, correlationId, operationId, routeTemplate)` 唯一；scenario sink 不作分母真相，性能结果不参与单场景 `CONTRACT`/`BUSINESS`。
- `databaseOperationCount` 对预算；`connectionBorrowCount` 对 GET=1、写=`transactionBeginCount`；新增 `transactionBeginCount` 只数 `SET_AUTO_COMMIT(false)`，不拿 BEGIN/COMMIT 两条 raw `TRANSACTION` 与事务数比较。
- `unclassifiedSqlRatio = UNCLASSIFIED SQL execution / all SQL execution`；排除 CONNECTION/TRANSACTION，不允许稀释；每 operation 与全量均 ≤5%。
- 复用 `DatabaseOperationTracker.defaultSection(kind, callSite)` 作为**唯一模块层归属入口**：受管 measurement 即使不输出逐 SQL artifact 也必须内部取得 call site；owner module 的 SELECT→OWNER_READ、UPDATE/BATCH→OWNER_WRITE。SESSION/SCOPE/IDEMPOTENCY/CAS/AUDIT/READBACK 继续只在各自组件入口用语义 scope 覆盖。
- 删除 owner 方法内仅为分类而写的分散 `pushSection(OWNER_READ/OWNER_WRITE)`；保留真正的 semantic section。新增 owner SQL 不改标记代码仍自动归类。
- **负控制**：foundation/edge 中未进入任何已知层的 SQL 仍为 UNCLASSIFIED；不能把默认值改成 OWNER 取得假绿。

### CP-05 · P0 与初始预算

- 从两条生成源导出 current exact-set 的 `measurementScenarioIds`；managed calibration 先跑现有 acceptance/P2 workload，再运行缺失 operation 的 fixture recipe，最终 normal event join 后 missing/extra 均为空，并把 registry 与真实成功 completion 生成 238-row `normal-sample-matrix.json`。该 artifact 不保留 fixture/body/身份资料，也不另存 operation registry；合法请求与 readback 继续以 owning scenario/P2/coverage recipe 为唯一真相。
- recipe 是测试/测量输入，不是第三套业务契约；每条仍经真实 HTTP、真实 authorization、真实 owner。无法触发即 `P0_OPERATION_NOT_MEASURED:<operationId>` 停机，不登记豁免放行。
- 固定预算初值取**整改后同一规范 fixture 三次运行的最大整数 DB count**，默认不得高于其分类阈值；高于说明整改未完成，不通过抬预算解决。唯一例外是 CP-05 report-bound 的完整双准入记录：它逐 operation 证明业务事实未削弱、通用机制已复用且无可消除重复/N+1，并具备精确 decisionRef、history、实测 max、替代方案与成本比较。P2 的 before/after 只使用同 workload 的 current report，不以历史成员强制当前改动；P3 ≤20；P1 使用 operation-specific ceiling；P5 用三次最大值。
- 三次结果不一致时保留 max 与三次样本；如果由 fixture cardinality 变化导致，先固定 fixture，禁止加随机余量。

### CP-06 · 批量状态原子组 C

- 循环前一次 set-based 载入 1–100 个 item 的 `itemRef/itemCode/version/status/shape/启用校验所需事实`；结果 Map 仅是准备事实。
- 每项仍在独立 `REQUIRES_NEW` 事务内按 itemRef+scope 重新锁定/复核版本、状态和所有写前业务条件；预载不能替代权威复核。成功项提交，失败项回滚且不影响其他项。
- canonical request 保留规范化输入顺序；同 key 同成员但换序属于 mismatch。receipt/results 与请求严格同序同身份同数量。
- 每项 shape：`{itemRef,itemCode,outcome,problemCode?,reason?,version?}`。`SUCCEEDED` 要 itemCode/version，且无 problem；`FAILED` 要 itemCode/problemCode/reason，且无成功 version。no-op 为 `SUCCEEDED`。
- replay 必须执行与 fresh response 同一 strict parser；重复/缺失/额外/乱序/条件字段错误均拒绝，前端不得 Map 对齐或补 `RESULT_UNKNOWN`。
- UI 逐字遵守 IA-BPR-01；成功后只刷新列表与导航。B-06 不新增审计语义。
- 预算：OWNER_READ 预载部分 ≤10 且不随 N 增长；总 DB ≤`15+5×N`；transaction/connection 随项线性是允许形态。

### CP-07–12 · 存量类

| CP | 可证伪失败条件 | 不变量/FORBID | 比例 proof |
|---|---|---|---|
| 07 copy | 任一两条 copy >35 或结果字段/引用闭包不同 | 类型内 set-based；不删 scope/CAS/receipt/readback | owner test + real HTTP fixture |
| 08 save | save >45；单位/BOM/选项/版本 readback 任一漂移 | 复用事务内 projection；不得返回 request echo；引用错误仍定位具体 ref | catalog acceptance 黄金 readback |
| 09 P2 | 任一确认成员 borrow≠1 或 JSON 漂移 | 逐条 route→task reader 复核；只读 scope 不触碰写事务 | CP-05 当前 P2 exact-set event compare |
| 10 P3 | 任一成员 >20，或批量 validate 只给笼统错误 | 同类 ref 去重 set-read；owner 仍指出非法 ref | 36 current-set events + negatives |
| 11 P4 | 九条仍留 P4，或 SQL unclassified>5% | 先分类后重新归类；不猜必要性 | 9 exact-set reclassification |
| 12 P5 | 当前已达标成员未来超过预算仍绿 | 不做无收益业务改动 | current P5 exact-set budget gate |

## 5 · operation / path / face / 集合形态

| 业务意图 | operationId | method/path | face | 集合形态 | 规模与增长 |
|---|---|---|---|---|---|
| 批量改变商品状态并报告逐项结果 | `batchTransitionOperationsCatalogItemStatus` | `POST /operations/catalog-inventory/items/status` | operations-admin | Bounded | 1–100；请求项驱动 DB linear budget |
| 性能预算声明 | current registry operationId exact-set | CP-00 generated routes | 各自唯一 face | Bounded | current exact-set 由生成源闭集驱动 |
| 运行证据 | 不新增业务 operation | managed run artifact | internal | Bounded | 每个 operation 至少一条规范 event；三次校准样本 |

### 5.1 数组 request schema 同族闭集

按 OpenAPI request schema 递归解析得到 24 个数组入参 operation；“元素各自产生独立写入”只命中 1 个。

| # | operationId | 独立逐项写 | 判定 |
|---:|---|---|---|
| 1 | `batchTransitionOperationsCatalogItemStatus` | 是 | 本批 B-01–B-06 唯一成员 |
| 2 | `createOperationsCatalogAttributeDefinition` | 否 | 一个定义聚合的 allowedValues |
| 3 | `createOperationsCatalogOrderOptionDefinition` | 否 | 一个选项定义聚合 |
| 4 | `createOperationsContract` | 否 | 一个合同聚合 |
| 5 | `createOperationsOrganizationProject` | 否 | 一个组织节点聚合 |
| 6 | `createOperationsWorkspaceGroupInvitation` | 否 | 一个邀请聚合的 roleIds |
| 7 | `createOperationsWorkspaceHeadCompanyInvitation` | 否 | 同上 |
| 8 | `createOperationsWorkspaceProjectInvitation` | 否 | 同上 |
| 9 | `createOperationsWorkspaceRegionInvitation` | 否 | 同上 |
| 10 | `createOperationsWorkspaceStoreInvitation` | 否 | 同上 |
| 11 | `createWorkspaceInvitation` | 否 | 一个邀请聚合 |
| 12 | `createWorkspaceRole` | 否 | 一个角色的 capability set |
| 13 | `executeOperationsBrandCatalogCopy` | 否 | 一个 copy closure command |
| 14 | `executeOperationsLocalCatalogCopy` | 否 | 同上 |
| 15 | `preflightOperationsBrandCatalogCopy` | 否 | 只读 preflight |
| 16 | `preflightOperationsLocalCatalogCopy` | 否 | 只读 preflight |
| 17 | `reorderOperationsCatalogDictionaryEntry` | 否 | 一个有序集合的原子替换 |
| 18 | `replaceExtensionDefinition` | 否 | 一个定义聚合替换 |
| 19 | `saveOperationsCatalogItem` | 否 | 一个商品聚合 |
| 20 | `updateOperationsCatalogAttributeDefinition` | 否 | 一个定义聚合 |
| 21 | `updateOperationsCatalogOrderOptionDefinition` | 否 | 一个选项定义聚合 |
| 22 | `updateOperationsContract` | 否 | 一个合同聚合 |
| 23 | `updateOperationsOrganizationNode` | 否 | 一个组织节点聚合 |
| 24 | `updateWorkspaceRole` | 否 | 一个角色 capability set |

实现期生成器必须重新算此表；名称扫描只作下限。若 exact-set 不同，停机更新设计，不把新增成员默认为否。

## 6 · 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败回滚事实 |
|---|---|---|---|---|
| batch status | catalog receipt claim（catalog owner） | 每项 catalog status command | receipt 事务 + 每项独立 `REQUIRES_NEW` | 某项失败只回滚该项；已成功项保留；最终 receipt 记录全部结果 |
| save/copy 现有跨 owner 协调 | 保持 owning coordinator 现状 | 目标 owner 公开 command | 既有 REQUIRED | 性能改动不得改变现有原子边界 |

不新增跨 owner 写；CP-09 的 read-only task scope 只持有连接，不授予写权、不引入跨 schema FK。

## 7 · 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| 预算 | 两个 operation 生成源的 `databaseOperationBudget` | generated route registry/OpenAPI metadata | managed event verifier | current exact-set、normal sample、red mutation |
| batch linear N | request schema `items` 1–100 | event 的 request cardinality（不记录 payload） | `15+5×N` evaluator | N=1/20/100 |
| DB/连接/事务开始 | `DatabaseOperationTracker.Snapshot` | `HttpRequestMetricsInterceptor` event | managed verifier | known-over-budget mutation |
| section | tracker fixed enum + layer classifier | event logicalSectionCounts | UNCLASSIFIED SQL gate/P4 reclass | 新增 owner query 不改标签仍归类 |
| 集合形态 | IA `Bounded 1–100` | OpenAPI items/results，无 cursor/page | owner strict parser + Modal failed subset | 101/缺失/额外/乱序红 |
| 授权执行点 | IA stateAndPermission | edge context + owner command | 项事务内复核 | cross-node acceptance |
| 缓存失效 | IA 只列 list/navigation | generated RTK mutation invalidates exact identities | list/navigation query | focused call-count |
| 错误映射 | IA 请求级5类/项级5类 | `ContractProblemAdvice` / item receipt | Modal banner/failure rows | HTTP + component tests |
| 日志脱敏 | AGENTS 禁止字段 | remote stdout + HTTP event | managed manifest/report | sensitive string scan |
| L1 进程身份 | trusted host/boot/PID/start ticks/digest | run manifest | stop/readiness/cleanup | identity drift self-test |
| B-06 无审计 | Dexter decision | 无新增 transfer | 无新增 UI/DB consumer | migration/schema/UI exact absence review |

## 8 · 业务规则 → owner 判定点

| 规则 | owner 判定点 |
|---|---|
| L1-01–06 | `scripts/dev` 受管环境、remote identity、tunnel/readiness/cleanup |
| L2-01/05 | 两个 owning generator + budget history validator |
| L2-02/03/04 | HTTP event verifier；真实 request event，不是 scenario sink |
| L2-04a/b/c | tracker layer classifier + semantic scopes + current P4 reclass |
| B-01/02 | catalog owner 预载边界 + event evaluator |
| B-03/04/06 | catalog owner command/receipt strict parser |
| B-05 | operations-admin CatalogWorkbench composition |
| P0 | calibration exact-set join |
| P1/P2/P3/P4/P5 | 当前树事件重分类后各 owning source；历史分类不作运行时 truth |

规格编号无空号；B-06 是“不新增审计语义”，不产生 owner API。

## 9 · owner API 与消费者

| owner 方法/能力 | 消费者 |
|---|---|
| `CatalogOwnerApi.transitionCatalogItemStatuses`（扩展 result shape，不新增平行 method） | generated operations edge handler |
| catalog batch preloaded facts（owner private typed record） | `executeBatchStatusItemInTransaction`；无模块外调用者 |
| generated budget registry reader | `HttpRequestMetricsInterceptor` / managed verifier |
| read-only task connection scope | CP-05 逐条确认缺口的 GET task readers |

零调用 private helper 删除；不新增 generic performance owner API。

## 9b · 变更定位（锚点在目标文件内逐项唯一）

| 文件 | 唯一锚点 | 目标 |
|---|---|---|
| `scripts/generate/edge-codegen.mjs` | `const targets = {` | CP-00 fresh edge 180-operation exact-subset budget projection/self-test |
| `scripts/generate/catalog-inventory-p1.mjs` | `const catalogRouteRegistryPath =` | current catalog 58-operation projection及全部238-operation L2 timing budget消费；禁止静态 exception/edge catalog 旁路 |
| `apps/backend/catering-business-server/modules/foundation/src/main/java/com/catering/v2s/platform/foundation/persistence/DatabaseOperationTracker.java` | `private static Section defaultSection(String kind, String callSite) {` | 统一 layer classification、transactionBeginCount |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/HttpRequestMetricsInterceptor.java` | `public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {` | managed classification options 与 event 字段 |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java` | `final class ScenarioContext {` | credential-protected normal/coverage measurement header 注入 |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendPerformanceOperationCoverage.java` | `static void run(BackendAcceptanceTest host, BackendAcceptanceTest.ScenarioContext context)` | current exact-set coverage provider 与 normal recipe/readback matrix |
| `scripts/test/backend-performance-event-verifier.mjs` | `export function validateHttpRequestEvent(` | backend-acceptance event 的 measurementScenarioId 必填和结构校验 |
| `scripts/test/backend-performance-operation-reconciliation.mjs` | `export const assertPerformanceOperationBudgets =` | only succeeded allowed normal sample 的 budget/connection 消费 |
| `scripts/generate/backend-performance-budget.mjs` | `export function validateRemediationBudgetChange` | 本批 fixed budget 默认拒绝上调；只验证完整 CP-05 report-bound 双准入例外 |
| `scripts/test/backend-performance-cp05-reclassification.mjs` | `const readRun =` | 只通过 requireArchive 与 identity-only tuple 读取三份 calibration evidence；canonical report/digest |
| `scripts/test/r5-remote-testcontainers.mjs` | `export const readEvidenceArtifact =` | requireArchive、archive/index/hash 与 workload/digest manifest 读回 |
| `scripts/test/r5-remote-testcontainers.mjs` | `export const verifyFullBackendAcceptanceCalibration =` | 只消费 identity-only tuple；不得读取 active budget metadata |
| `scripts/test/r5-remote-testcontainers.mjs` | `export const parseBackendAcceptanceResult = contents => {` | run event budget消费/manifest，不用 scenario dbOperations 冒充 |
| `scripts/dev/r5-dev-environment.mjs` | `function effectiveEnvironment(env) {` | remote Java/HTTP/asset endpoint environment |
| `scripts/dev/r5-dev-runner.mjs` | `async function openTunnel(env, ports) {` | PostgreSQL forward→HTTP+asset forward |
| `scripts/dev/r5-dev-runner.mjs` | `async function start() {` | remote Java spawn/identity/log/readiness，本机 Vite |
| `scripts/dev/r5-dev-runner.mjs` | `async function stop() {` | 双侧 owned cleanup |
| `CatalogOwnerService.java` | `private CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback executeBatchStatusWithReceipt(` | 预载、strict receipt |
| `CatalogOwnerService.java` | `private CatalogOwnerApi.CatalogItemBatchStatusTransitionResult executeBatchStatusItem(` | 每项结果 reason/outcome |
| `CatalogOwnerService.java` | `private CatalogOwnerApi.CatalogItemBatchStatusTransitionReadback batchStatusReadback(JsonNode response) {` | replay strict parser |
| `CatalogInventoryCoordinator.java` | `private CatalogOwnerApi.CatalogItemSaveReadback mergeInventorySaveReadback(` | save readback 复用 |
| `catalogModel.ts` | `export function decodeCatalogBatchResults(` | strict decoder，删除 align fallback |
| `CatalogWorkbenchPage.tsx` | `const runBatchAction = useCallback(async () => {` | generated mutation、receipt/刷新 |
| `CatalogWorkbenchPage.tsx` | `{batchResults.length > 0 && (` | 已确认 Modal 结果布局 |

`CatalogOwnerService.java` 等简写均指 §9 表中的完整模块路径。实施开工前用 `rg -F -c` 重新确认每锚点=1；0/多命中即停机。

## 10 · 数据迁移

| 迁移 | 处置 |
|---|---|
| 业务 DB/Flyway | N/A；不新增性能表、审计表、缓存表，现有行不回填 |
| contract metadata | generator 全量重发；不是 DB migration，不保留 null/旧字段 fallback |

## 10b · seed 数据

### 10b.1 受影响全集

| seed 文件 | 原因 | 处置 |
|---|---|---|
| `scripts/dev/owner-command-seed-executor.mjs` | Java 不再在本机 8080，executor 目标必须走本机 HTTP tunnel；其 events 用于 calibration | 只替换受管 base URL 来源，业务计划/断言不降级 |
| `scripts/dev/catalog-inventory-seed-executor.mjs` | 同上，且覆盖 catalog 预算 evidence | 同上；不手改 generated fixture |
| `scripts/generate/catalog-inventory-p1.mjs` 的 `catalogDefinitionSeed` | batch response shape 不被 seed 写入，业务 seed shape 不变 | 明确 `NOT_APPLICABLE_WITH_REASON`；仅其 HTTP events 可供预算取证 |

### 10b.2 两类改动

| 类型 | 覆盖 |
|---|---|
| 新功能 | 无新增持久业务事实；不新增“性能 seed”或“审计 seed”。batch result 是命令 readback，不入 seed。 |
| 旧功能调整 | 两个 executor 不得默认 `127.0.0.1:8080`；统一读取 managed manifest 的 local HTTP tunnel endpoint。既有业务 seed 对象、状态分支、断言全部保持。 |

### 10b.3–5 判据与边界

- static self-test：伪造 manifest endpoint，executor 只向该 endpoint 发请求；缺 manifest 失败，不 fallback 8080。
- reset 后 seed 仍形成原业务丰富数据；这属于未来另行授权的 managed proof，本设计不执行。
- calibration fixture 与 seed 分开命名/报告；不得把测量中间态留在最终 DEV seed。

## 11 · 验收场景设计

| scenario id | owner 文件 | identity | fixture/request | businessOracle |
|---|---|---|---|---|
| `catalog.batch-status-partial-outcome` | `CatalogAcceptanceScenarios` | authorized operations | 20 项，第13项 stale version | 2xx；19 SUCCEEDED、1 FAILED；严格同序；成功项版本+1，失败项版本不变 |
| `catalog.batch-status-receipt-integrity` | catalog owner focused + acceptance replay | authorized | fresh 后同 key 重放；red fixtures 缺失/额外/乱序/重复 | fresh/replay 逐字段相等；每个 red fixture 被拒；不补 RESULT_UNKNOWN |
| `catalog.batch-status-request-level-denied` | `CatalogAcceptanceScenarios` | wrong node/no grant | 2 项合法商品 | 整体 typed problem；两项状态/版本均不变；无逐项伪结果 |
| `catalog.batch-status-linear-budget` | performance calibration | authorized | N=1/20/100 | DB≤15+5N；预载 OWNER_READ≤10；结果均完整 |
| `performance.normal-path` | managed verifier | existing scenario/P2/coverage normal recipe | operation budget metadata + succeeded normal events | declared=measured=current exact-set；每条被消费 normal event 的 method/path/owner/face 必须逐字等同 generated registry；missing/extra/duplicate normal samples 为空，任一超预算红 |
| `performance.coverage-only` | managed verifier | route-reachability probe | all completion events | 仅 exact-set；永不满足预算或连接 sample |
| `performance.normal-path`（P2 来源） | current P2 set | scoped identities | 每条 current P2 GET | borrow=1；JSON 黄金 readback 相同；跨节点仍拒绝 |
| `performance.unclassified-sql` | tracker focused + managed | managed | owner 新增 query red mutation / edge unknown SQL negative | owner query 自动归类；unknown edge SQL 保持 UNCLASSIFIED；全量≤5% |
| `performance.copy-save-ceilings` | catalog acceptance | authorized | rich copy/save fixture | copy各≤35、save≤45；结果字段/CAS/receipt/readback 不变 |

机器门红夹具：删任一 operation budget、普通预算调高（有无 decisionRef）、不完整或不匹配的受控例外、coverage-only 冒充 normal、未知/缺 measurement ID、制造 normal 超预算 event、连接 borrow>阈值、UNCLASSIFIED SQL>5%、缺一个 operation event、receipt 少一项。正控制：唯一完整 report-bound 双准入例外可绿。负控制：数据库 duration 变慢但 count 未超不应触发 DB-count 门；coverage-only 业务失败不应成为正常预算样本。

实施补充（2026-08-26）：当 run-level verifier 报告缺少 normal sample 时，先以当前 exact-set 枚举缺口，再在唯一 `BackendPerformanceOperationCoverage` 校准 fixture 中补**合法成功** recipe；不得把受控 4xx/coverage-only probe 改标为 normal，也不得新增 `@AcceptanceScenario`。当前有限补集是 `selectOperationsWorkspaceSessionContext`、`updateOperationsBusinessChannelTemplate`、`updateOperationsBusinessChannel`，分别复用 owner-confirmed role candidate 与既有业务渠道内部模板/渠道 whole-save helpers，并以静态 recipe-set guard 与 run-level missing-normal red mutation 共同防漂移。

## 12 · 未决项

| 项目 | 状态 | 本批允许 | 本批禁止 |
|---|---|---|---|
| 远端主机资源 | 实施测量待证 | 受管只读预检，不足停机 | 本机 Java fallback/猜测加 swap |
| 42.7ms 来源比例 | 实施 before/after 待证 | 同 workload 对比 | 把推论写成已证明 |
| P0 94 实际计数 | 实施 calibration 待证 | current exact-set 真实 HTTP normal 样本取证后重分类 | 填假预算/登记豁免 |
| B-06 审计 | `DEXTER_DECIDED_NO_NEW_AUDIT` | 保持现状 | 表、事件、UI、receipt-as-audit |

## 13 · 停机条件

1. 当前 registry 不再等于 CP-00 重新计算的 unique exact-set，或数组 schema 闭集不再是 24/1；
2. 任一 §9b 锚点 0/多命中；
3. 远端资源、JDK、权限、identity、日志或 cleanup 无法受管证明；
4. P0 某 operation 无法通过真实 HTTP 自动触发；
5. 预算值只能通过高于需求阈值才能让当前正确实现通过；
6. read-only scope 触碰写事务、跨 schema 写/JOIN，或 JSON readback 漂移；
7. batch 预载不能在项事务内重核而要求相信 stale projection；
8. 新增产品语义、依赖、审计或需要取消已确认 IA；
9. 上游数字与当前源码/事件冲突，以当前源码为准并停机更新分类，不沿旧表硬做。

## 14 · 交付前自查

Round 2 N-01 已按辩证 intake 处置：IA 尾注由 `PENDING_AUTHOR_DESIGN` 改为
`CROSS_CHECK_WITH_DESIGN=COMPLETE`；该文案性元数据不改变设计语义，且同一 review cycle 已达到两轮上限，不重开第三轮。

| 检查 | 结果 |
|---|---|
| §3 17 行 | 齐全；N/A 仅迁移、候选两类且有理由 |
| §3 ④ 全集 | current exact-set/GET/write/current catalog/24/1 等闭集均点名 |
| §7 机制行 | budget、计数、section、collection、授权、refresh、error、log、identity、no-audit 齐全 |
| IA 对账 | `Bounded 1–100`、`SUCCEEDED\|FAILED`、严格同序、只刷 list/navigation、B-06 无审计逐字一致 |
| seed | 2 executor + 1 owning seed source 全集；新功能/旧功能两栏齐全 |
| 计数 | registry=CP-00 current exact-set（当前180+58=238）；HTTP method=CP-00 current GET/write；数组 schema=24、独立逐项写=1 |
| 证据档位 | 文档只设计；未把静态读写成 test/DEV/L2/UAT proof |

`DESIGN_STATUS=INDEPENDENT_REVIEW_GO_M0_S0_N1_RESOLVED`；`IMPLEMENTATION_STATUS=IN_PROGRESS_CP00_CP13`。

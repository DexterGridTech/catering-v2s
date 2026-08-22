# 后台接口性能整改 · 串行实施计划

- 日期：2026-08-22
- 设计正本：`doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-implementation-design-codex.md`
- IA：`doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-ia-codex.md`
- 状态：`IMPLEMENTATION_IN_PROGRESS_CP00_CP13`
- 授权：Dexter 已接受独立 DESIGN review GO，并授权按本计划执行 CP-00 至 CP-13；reset、start/restart DEV、seed、browser L2、UAT、部署、数据操作仍须分别授权。

## 0 · 全程纪律

每个 CP 写入前执行同一套双读：需求对应条目、IA/交互（若 UI-bearing）、六维 memory 命中、详设 CP、owning source 与可复用能力；focused proof 后用同一组原文回读。首败保留 first failure、last known good、broken boundary；动态运行每 30 秒、非动态工具/agent 每 60 秒按 AGENTS 六行格式报告。禁止 Git、本机 Java fallback、手改 generated 文件、timeout 止血、预算调高止血、静态 proof 冒充 runtime/L2/UAT。

## 1 · CP-00 · 当前树与分母重建

**RECALL**：requirements §2/§4/§9、intake、foundation charter §3/§4/§5、两条 generator owning source。

1. 从 `edge-codegen.mjs` 和 `catalog-inventory-p1.mjs` 的 canonical operation metadata 重新导出 operationId/method/path/face/owner/request schema。
2. 断言两 registry unique union；预期设计基线 181+57=238、GET=100、write=138。
3. 递归扫描 request schema 数组；输出完整 exact-set 和“数组元素独立写”判定。设计基线为 24/1，唯一成员 batch status。
4. 对 §9b 每个锚点执行目标文件内 exact count=1。

**FORBID**：从 requirement 表复制分母、不核生成源；把 platform duplicate registry 加成 241。

**PROOF**：缺/重 operation、数组新增成员、锚点漂移任一红。若当前值不同，停机修订设计，不继续。

## 2 · CP-01 · L1 远端 Java 受管拓扑

**RECALL**：requirements L1、AGENTS 当前环境矩阵、Blueprint runtime、managed runtime/failure skills、`r5-dev-environment.mjs`、`r5-dev-runner.mjs`、reset/seed executor。

1. 先加远端资源预检与 identity helper：trusted host、boot id、PID、start ticks、command digest、RSS；只读，不启动。
2. 将远端应用 secret 写入 0600 临时文件，通过受管 SSH 在远端 repo/workdir 启动单一 Java；日志保存远端并脱敏拉回本机 run path。
3. readiness 同时验证 remote identity 与 `Started CateringV2sApplication`；任何一项缺失即 start business FAIL。
4. 将 tunnel 从 PostgreSQL+asset 改为 Java HTTP+asset；保留 asset forward，删除 PostgreSQL forward。
5. 两个本机 Vite 的 gateway target 指向 local Java HTTP tunnel；`changeOrigin:false` 保持。
6. reset/seed executor 从 manifest 读取 HTTP endpoint，不默认 8080；reset 的 DB 管理命令仍走受管远端执行，不借应用 JDBC tunnel。
7. stop 先停 Vite，再停 tunnel，最后按远端 identity 停 Java；每一步写 cleanup，未知进程不碰。
8. self-test 红变异：boot id、start ticks、command digest、listener owner、日志 marker、asset forward、secret permission、remote residual 各一例。
9. 回读已由 Dexter 裁定并先行翻转的 AGENTS、Blueprint、`scripts/README.md`、`cs-managed-runtime-execution`，确认 runner AFTER 逐字一致；同时保留浏览器 L2/UAT 各自准确矩阵，不能把 DEV 规则误扩成所有动态环境。

**预期中间态**：脚本闭合前治理正本要求 fail closed；不得运行旧拓扑。不存在兼容开关或双拓扑 fallback。

**PROOF**：static self-test → managed start/stop（须另授权）→ manifest/readiness/log/remote cleanup。business 与 cleanup 分开。

## 3 · CP-02 · 预算契约生成链

**RECALL**：requirements L2-01/02/05、详设 CP-02、backend coding standard generated rules。

1. 在 181 operation canonical source 增加预算结构和 schema validator。
2. 在 `catalog-inventory-p1.mjs` 的 57 operation metadata 增加同一结构；复用一份共享 validator，不能复制两套语义。
3. 支持 `FIXED` 与 `LINEAR_REQUEST_CARDINALITY` 穷尽 union；batch 唯一 linear=`15+5×$.items`。
4. 生成 route registry/OpenAPI metadata/Java/TS 必需投影；预算不是 UI 字段，不进业务 response。
5. generator self-test：missing/null、固定/线性混填、未知 cardinality path、重复、调高无 decisionRef、238 missing/extra。
6. 保持 `normalPathDbOperations` 原语义；无 fallback/alias/双写。

**PROOF**：本 CP 的 schema/validator 设计与 CP-05 的 238 个实值属于一个原子交付，校准前不写 canonical operation source、不生成 budget registry、不接通 verifier。先完成 CP-03/04 的非门控 completion event 与 CP-05 测量；取得 238 实值后一次性写满两条 canonical source，随后按 owning README 运行两 generator `--check`、self-test、operation handler bindings/下游 codegen 并原子激活 verifier。不存在 `CALIBRATION_PENDING`、null、哨兵值或 runtime fallback。

**实施证据口径**：`scripts/generate/backend-performance-budget.mjs` 只负责共享 schema/validator 的 self-test，不拥有第三份 canonical budget registry；因此 `--self-test` 是该脚本的 PASS 门，`--check` 在没有 canonical 输入时保持 `NOT_READY`，不是本批的成功判据。238 个预算的实际闭合必须以两个 owning generator 的 `--check`、生成链 self-test、以及 managed run manifest 的 `budgetEvidence`（declared=observed=238、exceeded=0）共同证明。

## 4 · CP-03/04 · 每请求门与层分类

**RECALL**：requirements L2-02/03/04、`DatabaseOperationTracker`、`HttpRequestMetricsInterceptor`、remote Testcontainers runner。

1. 分离“内部 call-site classification”与“是否输出逐 SQL artifact”：managed measurement 总启用前者；只有有效 HMAC/path 时输出 statement artifact。
2. 收敛 owner layer：以 `defaultSection(kind, callSite)` 的模块边界为唯一 OWNER_READ/OWNER_WRITE 判定；逐个删除只为 owner 分类存在的散点 scope，保留 SESSION/SCOPE/REFERENCE/EXTENSION/IDEMPOTENCY/CAS/AUDIT/READBACK 的真正入口 scope。
3. 增加 `transactionBeginCount`，只在连接切入手工事务时计 1；不要复用 raw TRANSACTION=BEGIN+COMMIT。
4. completion event 加 budget evaluation inputs/results；不记录 request payload/cardinality 明细，只记录规范化 N。
5. verifier 从 run-scoped `http-request-events.jsonl` 读取；以 request tuple 去重，join registry。
6. 门：DB≤fixed/linear；GET borrow≤1；write borrow≤transactionBeginCount；UNCLASSIFIED SQL ratio≤5%；budget exact-set 238；measurement event exact-set 238。
7. 红夹具与负控制都真跑：owner 新 SQL自动归类；edge unknown SQL保持 UNCLASSIFIED；duration 变慢但 count 不超不红；业务 4xx 不自动等于性能红。

**PROOF**：foundation focused test、interceptor focused test、runner parser static tests。不要用 `BackendAcceptanceDatabaseMetricsSink` 的 last snapshot 做全量判定。

## 5 · CP-05 · P0 归零与预算激活

**RECALL**：requirements P0/P1–P5、当前 seed/acceptance scenario、managed runtime skill（只有获得运行授权后才读并执行）。

1. 从 registry 生成 `operationId -> measurementScenarioIds` expected set。
2. 先复用现有 acceptance 与 seed workload；计算覆盖差集。
3. 对差集添加最小真实 HTTP fixture recipe；每个 recipe 有身份、fixture、request、真实业务 readback/side effect，不以状态码为 oracle。
4. 同侧环境运行三次规范 workload，join 238 events；任何 missing/extra/duplicate/无法触发即停。
5. 按当前测量重算 P0–P5；历史 94/4/57/36/9/38 只用于差异说明。
6. 对已整改形态写初始 budget：三次最大值且不高于类阈值；高于阈值先整改。记录 history `from:null`、reason、measurement manifest ref。
7. 取得 238 实值后回到 CP-02：一次性写满 canonical source、生成并激活 run-level verifier；P0 必须为零。任何 budget 生成物在此前都不存在。

**FORBID**：无法触发就登记豁免；用平均值而非最大值；加随意 headroom；为过门调高预算。

## 6 · CP-06 · 批量商品状态

**RECALL**：Journey、interaction、IA 全文；requirements B-01–06；CatalogOwnerService 三个锚点；catalogModel/CatalogWorkbench；catalog acceptance standard。

1. 先写红测试：N=20 第13项失败仍 19 成功；strict receipt 五类畸形；同 key 换顺序 mismatch；no-op success；wrong node 整体拒绝；预算 N=1/20/100。
2. 在 receipt claim 后、item loop 前 set-load 全部准备事实，OWNER_READ≤10。
3. 每项 `REQUIRES_NEW` 内重新锁定并复核 scope/version/status/activation facts；使用预载只减少重复读，不信任 stale fact。
4. result/readback/OpenAPI/generated wire 同批替换成 itemRef+itemCode+outcome+problemCode+reason+version 条件 union；删除 ok/failureCode 旧形态，不留兼容 decoder。
5. canonical request 保留顺序；fresh/replay 共用 strict parser。
6. 前端删除 `alignCatalogBatchResults` Map fallback 和 `RESULT_UNKNOWN` 补造，使用 generated mutation；渲染已确认 Modal，owner reason 原样显示。
7. receipt 成功后精确刷新当前商品列表和导航；refresh 失败保留 receipt。
8. 复核 B-06：没有新增 migration/audit owner/API/UI；receipt 文案不称审计。

**原子中间态**：contract 改后旧 Java/TS compile 红是预期；整个 C 组完成后才跑生成/编译/focused proof，禁止加双字段或 fallback 消红。

## 7 · CP-07/08 · 三个 P1 写路径

1. 两条 copy：按 closure 类型分别 set-load，保留 scope/CAS/receipt/真实 readback；各≤35。
2. save：复用事务内 owner projection，逐引用 `requireActive` 改同类 set validation；`mergeInventorySaveReadback` 不从零重查，也不返回 request echo；≤45。
3. 对单位、标签、SKU 属性、点单选项、库存/BOM、copy 引用闭包逐字段黄金对比。

**停机**：为减少计数需要删除 owner recheck、跨 schema 写 JOIN、降低具体错误定位或重解释历史快照。

## 8 · CP-09 · P2 只读连接作用域

1. 对当前重算 P2 每条建立 route→edge task→task reader→现有事务 annotation→connection borrow 证据表。
2. 仅对确认“请求级 task 无连接作用域”的成员，在最外层只读任务方法加一个 read-only connection/transaction scope；已有正确 scope 不重复包裹。
3. 不把 scope 放进写路径，不改变 owner API，不跨 schema 写 JOIN。
4. 每条用改前 JSON 黄金样本逐字段比；授权/不存在/分页 cursor 负例不变。

**PROOF**：current P2 exact-set borrow=1，DB count 相对历史下降≥30%；任一 JSON 漂移即红。

## 9 · CP-10/11/12 · P3/P4/P5

1. P3 逐 operation 找同类 ref/节点循环；每类去重后一次 set-read/batch，错误仍点名具体 ref；current P3 每条≤20。
2. P4 在分类闭合后九条逐项归 P2/P3/P5；不得保留 P4 “待看”。按新类执行对应 CP。
3. P5 不做无依据重写，只纳 non-null budget 与真实 event。
4. 每完成一个 root family 做同根扫描，不按 requirement 点名单点修。

## 10 · CP-13 · 全量证据与 L1 对比

在另行运行授权下按受管脚本顺序：

1. static generator/check/self-test/compile/frontend focused tests；退出码判绿。
2. managed Testcontainers/acceptance 当前全量；discovered=selected=results，业务与 cleanup 都 PASS。
3. 238 operation calibration/门；declared=measured=passed=238，P0=0，UNCLASSIFIED SQL≤5%。
4. L1 改造前留存的同 workload baseline 与 AFTER 同 workload 对比；`saveOperationsCatalogItem` avg 下降≥90%，并报告 avg/p95、DB count、DB duration/operation。
5. 获得 reset/start/seed 明确授权后才执行；start 不 seed，失败修复后 fresh reset→start→seed；business/cleanup 分离。
6. browser L2/UAT 未授权则明确未验证，不用组件测试冒充。

Testcontainers 启动前按 AGENTS 的联动规则读取 DEV manifest：原有 DEV 则受管 stop 并要求 cleanup PASS；记录 `DEV_WAS_RUNNING`。只有测试 business/cleanup 双 PASS 且原有 DEV 时受管 start 恢复最新代码；测试失败或原先无 DEV 均不启动。该联动不执行 reset/seed。

## 11 · 实施完成回读

逐条回读 requirement L1/L2/P0–P5/B-01–06、IA 每个不可见观察、详设 17 行横切表、24/1 数组闭集、seed 两栏。最终报告必须给：first failure、last known good、broken boundary、business、cleanup、238 manifest、当前 P0–P5 数字、预算调高差集（必须空或逐条 Dexter decisionRef）、UI 未验证清单。

`SERIAL_PLAN_STATUS=INDEPENDENT_DESIGN_REVIEW_GO`；不构成 implementation authorization。

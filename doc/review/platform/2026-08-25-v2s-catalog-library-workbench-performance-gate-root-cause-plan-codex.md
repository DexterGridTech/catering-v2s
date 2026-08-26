# 商品库工作台实施 · 性能门根因修复计划

`SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`

`DATE=2026-08-25`
`SCOPE=catalog-library-workbench implementation closeout`
`AUTHORITY=Dexter dynamic acceptance authorization`

## 1. 触发事实

受管 Testcontainers run `r5-tc-1787669056419-50925` 的 scenario 业务分母为 `80/80 PASS`，远端容器与卷 cleanup 为 `PASS`，但 run-level 性能门首败为：

`PERFORMANCE_OPERATION_BUDGET_EXCEEDED:getOperationsCatalogItems:kind=FIXED:actual=23:max=20`

同一 run 的 HTTP completion exact-set 当时为 `240/240`。后续已退休无法取得合法成功路径的 `updateOperationsOwnerBinding`，当前 generated exact-set 为 `239/239`；所有 GET 的 operation-level connection borrow 均不超过 1。该失败 run 的原始 event 只是诊断输入，不得冒充 CP-05 测量 PASS。故本计划只处理 DB-operation budget 计量与真实 owner fan-out，不改变产品语义、不把 HTTP 4xx 当成成功样本；fixed budget 上调默认拒绝，只有本节定义的受控例外才可进入 CP-05 projection。

### 1a. 2026-08-26 Dexter 明确例外：经证明的正确性闭包

Dexter 已明确授权：当代码语义合理、进一步优化的收益小于安全改造成本时，可以放宽 DB 预算。该授权仅用于 `reorderOperationsCatalogDictionaryEntry` 的 `7 → 14`：受管 run `r5-tc-1787700318429-56433` 的正常成功请求已逐事件证明其 14 次闭包为事务/作用域、幂等重放锁与读取、每个有序项的写入、完整读回、引用判断与 receipt 持久化。把有序集合替换改成压缩 SQL 会扩大幂等、锁定、读回及所有字典种类的回归面，收益不足以抵消成本。

同一裁定还覆盖 `deleteOperationsCatalogUnit` 的 `0 → 13`。该旧零值不是“零 SQL 的删除设计”，而是历史 normal fixture 从未走成功删除的错误记录：本次成功路径的 inventory target、ledger、BOM 三项判断，以及 catalog lock、scope existence、catalog reference judgement 和 delete 分别保护“被引用单位不可删除”的 owner 边界与并发语义。压缩这些判断会改错业务，故以 `decisionRef=DEXTER-2026-08-26-DELETE_UNIT_BUDGET` 固化实测闭包。

生成源必须将每项例外表达为唯一、精确的 history 增量；自检必须拒绝该 operation 的任意其他 max/history 漂移。其余 operation 仍受默认拒绝规则和 red mutation 保护；这不是通用豁免，也不得用于掩盖 owner fan-out。

### 1a.3 库存数量写命令的受控校正

`increaseOperationsInventoryTarget` 与 `adjustOperationsInventoryTarget` 的历史上限均为 3；本次真实 HTTP/Testcontainers 事件证明，两个命令的成功写路径都需要 12 次受控操作：授权、scope、目标与版本复核、幂等 replay、单位快照、库存余额与流水写入、receipt 及 commit。3 次采样实际只覆盖了拒绝路径，不能代表成功命令。

这不是通过抬高预算掩盖 N+1：两个命令共享同一个库存数量写闭包，写入与 readback 的正确性、幂等 receipt 和库存流水均不得为了减少计数而删除。生成器以同一 `DEXTER-2026-08-26-INVENTORY_QUANTITY_WRITE_BUDGET` 决策对两个 operation 分别声明 `3 -> 12`，并对每一项保留精确 history 与 red mutation。随后必须以 fresh 全量 Testcontainers 运行验证，不得以本次失败 run 代替。

### 1a.4 239-operation 差集后的其余受控闭包

第二次 fresh run 的完整 239-operation 差集只剩五项：`getOperationsInventoryTargetChangeSummary` 与 `getOperationsInventoryTargetBusinessHistory` 均为 `8 -> 9`，其第九次操作是业务汇总/历史查询本身；`preflightOperationsTemporaryCatalogItemPromotion` 为 `7 -> 23`，`executeOperationsTemporaryCatalogItemPromotion` 为 `7 -> 58`，以及 `executeOperationsBrandCatalogCopy` 为 `23 -> 47`。逐事件核验显示这些上限来自完整 aggregate 的预检/执行/写后读回与多 owner receipt，不是连接泄漏或可删的业务重复。

依 Dexter 的“业务准确性优先于 DB 效率”裁定，生成源为五个确定 operation 分别加入带 decisionRef、精确 history 与 red mutation 的有限例外；不会扩大为通用放宽，亦不改变库存、转正、复制、幂等、流水或 cross-owner 事务事实。下一次 fresh 全量运行仍必须验证 239 个 operation 的实测差集为空。

## 2. 同根全量盘点

### 2a. 2026-08-26 校正：CP-05 激活链尚未实现，禁止继续逐 operation 例外

最新三个 `ACCEPTANCE` run 的 first failure 依次落在 catalog 与 edge operation；其中最后一次的完整事件对照 239 条生成 registry 后，发现 70 余项 edge budget 仍是历史值或零值。此前只将 catalog assertion matrix 的 59 条预算与事件相比较，得到“只剩五项”的结论，**该比较分母错误，予以撤回**。

根因不是 70 余个 owner 同时退化，而是 CP-05 设计要求的“同一规范 workload 三次 `CALIBRATION` → 239-row reclassification → edge/catalog 两个生成源原子写入实值 → `ACCEPTANCE` 强制消费”的激活链未闭合：

1. `backend-performance-cp05-reclassification.mjs` 仍读取 `http-request-events.jsonl` 的未压缩本地文件；受管 runner 已按磁盘治理把四种大 evidence 改为 gzip archive，只保留 `readEvidenceArtifact` 这一读取能力，故重分类器不能消费当前 run 的权威 evidence。
2. `edge-codegen.mjs` 的 180 条 canonical `databaseOperationBudget` 只从固定 catalog 读取；没有受 CP-05 reclassification report 驱动的、受校验的原子输入。catalog P1 也同样没有完整 CP-05 report 的消费者。因此“CP-05 后一次性写满并激活”的设计从未真实发生。
3. 任何本次已写的单 operation 预算例外在全量 CP-05 结果出来前均不得视作最终激活事实。它们只能作为当前 report 中的候选 decision record，必须重新按两项准入（不削弱事实、已复用通用能力且不存在可消除 fan-out/N+1）逐项复核。

2026-08-26 Dexter 直接裁定替换本段的“三次校准”执行前置：最近一次完整受管 ACCEPTANCE 的 archive HTTP completion 可作为本次唯一的初始预算输入，前提是 report 明确标记 current-result 模式、保留旧预算首败、且 test execution/cleanup、239 exact-set、normal sample 与 archive 双 hash 均通过。由此本批单一链路是：受管 current-result archive → CP-05 reader（只经 runner archive 校验器读取）→ 239-row current-result report → 两个已有 generator 的唯一可重放输入 → generated registry/OpenAPI/TS/Java projection → fresh acceptance verifier。不得增加第三 registry、手写预算表、env fallback、默认 max 或把该历史 FAIL 伪装成生成后验收 PASS。

## 2b. 一次性实施计划与对账判据

### A. 权威 calibration evidence 的可读性

1. 复用 `r5-remote-testcontainers.mjs#readEvidenceArtifact`，在该既有函数增加 `requireArchive` 选项；`backend-performance-cp05-reclassification.mjs#readRun` 必须传入该选项。此模式即使存在 plain raw 也只接受 gzip+`evidence-artifacts.tsv` 的 archive/raw 双 hash；CP-05 不得自行解压、绕过 hash、依赖已删除 raw 文件或把 archive 拷贝回本机。
2. 重分类器的唯一 implementation anchor 是 `backend-performance-cp05-reclassification.mjs#readRun`：它经 `r5-remote-testcontainers.mjs#parseAndValidateRunManifest` 读取 manifest 后，验证内层 `backendAcceptance.runId`、mode=`CALIBRATION`、operation=`all`、business/test/measurement/cleanup 均 PASS，再读取 archive 的 HTTP event。它不接受 ACCEPTANCE 失败 run，也不从 `firstFailure` 反向取值。
3. red proof：raw 文件不存在但 archive 完整仍可读；archive hash 错误、内层 runId 错误、非 calibration mode、少一 run、239 差集非空分别失败并点名边界。

### B. 三次 workload 与 239-row CP-05

1. 只运行 `scripts/test/backend-acceptance --operation all --calibration` 三次；每次由 runner 固定 normal recipe、coverage recipe、P2 scope recipe，生成不含秘密的 canonical workload descriptor/hash（受管 runner、fixture/recipe set、source revision、operation mode 与 generated route exact-set）。三次 hash 必须相同，且不比较旧 active budget。
2. 三份 manifest 的 fixture/event cardinality 必须逐 operation 相同；normal-sample matrix 与 exact-set 均为 239；任一 operation 无成功 normal sample 立即停机补合法 recipe，不能把 4xx 或 coverage-only 改标。仅比 cardinality 不够，CP-05 必须同时比 workload fingerprint。
3. `reclassifyCurrentTree` 以三次最大整数计数计算每条 candidate，输出每个 operation 的 category、readiness、三次样本和 blocked 理由；报告本身是唯一可重放 calibration input，不是第三 operation registry。

### C. 两个 generator 的原子 activation

1. 唯一 canonical CP-05 report 路径固定为 `contracts/policy/backend-performance-cp05-calibration-report.json`；CLI 不接受任意 `--write` target。新增一个受版本/模式/content-digest 约束的 reader，共享给 `edge-codegen.mjs` 与 `catalog-inventory-p1.mjs`；它只接受 exact=239、runCount=3、P0=0、全部 budget readiness=READY、无 workload drift 的 report。report 的 replay identity 由稳定序列化的 source manifest/archive/index/workload/operation digest 构成，`generatedAt` 只能作信息字段且不得参与 digest。
2. edge generator 只消费该报告中属于 canonical edge 180 条的 budget；P1 的 catalog 59 条预算**以及** `l2OperationBudgetRegistry` 的全部 239 条 timing budget 都只消费同一 projection reader，P1 不得再读取 edge static catalog 的 `databaseOperationBudget`。两者均按 operationId exact subset join，少/多/重、kind/max/history 漂移都失败；输出仍是已有 registry/OpenAPI/Java/TS 生成物，禁止新 registry。
3. calibration report 的 candidate max 默认必须满足现有分类 ceiling；高于 ceiling 保持 BLOCKED 并拒绝 activation。唯一例外使用 `backend-performance-budget.mjs#CONTROLLED_BUDGET_EXCEPTION_DECISION_SCOPE` 这个**仅决策 scope、不含预算数值**的 resolver：它将 Dexter 已决定的 `decisionRef` 精确绑定到允许的 operationId 集合。report 的逐 operation exception 同时必须具有 resolver 命中、精确 `from/to/history`、三次实测 `max=to`、`businessFactsPreserved=true`（owner/event evidence）、`sharedMechanismsReused=true`（source/measurement evidence）、已拒绝的更小优化、成本比较与窄 operation scope；validator 同时验证 resolver、record、decisionRef 和 operation identity。任一缺失、未知 ref、未知 operation、from/to/history 漂移或未登记上调均拒绝。该例外不得吞掉未知 edge 上调。
4. 现有手写 `CATALOG_DATABASE_OPERATION_MAX`、`CATALOG_BUDGET_EXCEPTIONS`、`catalogBudgetExceptionFor`、`validateCatalogBudgetException`、edge canonical 静态 max 及其对应 self-test 一并退役为同一 report 的 exact-subset projection；不得并存 dual-read/fallback。report 只作为 build-time calibration input，不进入 runtime registry。

#### C.1 预算 source/consumer 退役矩阵

| 当前 source 或 consumer | 退役后唯一输入 | 强制关系 | 红夹具 |
|---|---|---|---|
| `edge-codegen.mjs#assertCanonicalBudgets/load` 与 edge contract catalog 的静态 `databaseOperationBudget` | CP-05 reader 的 edge 180 subset | static edge catalog 仅保留 operation identity；generated edge registry 写入 `calibrationReportDigest` | static edge budget 残留、edge subset 缺/重/漂移 |
| `catalog-inventory-p1.mjs#CATALOG_DATABASE_OPERATION_MAX`、exception helpers、`databaseOperationBudget` | CP-05 reader 的 catalog 59 subset | catalog operation metadata 只从 projection 附加 budget/history | static max/exception list 残留、catalog subset 缺/重/漂移 |
| `catalog-inventory-p1.mjs#l2OperationBudgetRegistry` | 同一 CP-05 reader 的 union 239 | L2 timing 的每个预算与 edge/catalog generated registry 的 digest 相同 | 更改 edge 或 catalog report row、只改一个 projection、L2 digest 不同 |
| `r5-remote-testcontainers.mjs#verifyFullBackendAcceptancePerformance` | 两个 generated registry 的相同 digest | ACCEPTANCE 只消费当前 projection；缺 digest 或不一致 fail closed | ACCEPTANCE 缺 projection/digest 或校准 metadata 冒充 active budget |

这张表是 source/consumer 全集；不得让 report 成为 runtime registry，也不得从 edge catalog、catalog 静态表或测试 fixture 回填预算。

#### C.2 受控例外的精确 decision scope

| decisionRef | 允许的 operationId（仅 scope，不含 max） |
|---|---|
| `DEXTER-2026-08-26-REORDER_DICTIONARY_BUDGET` | `reorderOperationsCatalogDictionaryEntry` |
| `DEXTER-2026-08-26-DELETE_UNIT_BUDGET` | `deleteOperationsCatalogUnit` |
| `DEXTER-2026-08-26-INVENTORY_QUANTITY_WRITE_BUDGET` | `increaseOperationsInventoryTarget`、`adjustOperationsInventoryTarget` |
| `DEXTER-2026-08-26-INVENTORY_TARGET_SUMMARY_READ_BUDGET` | `getOperationsInventoryTargetChangeSummary`、`getOperationsInventoryTargetBusinessHistory` |
| `DEXTER-2026-08-26-TEMPORARY_PROMOTION_CLOSURE_BUDGET` | `preflightOperationsTemporaryCatalogItemPromotion`、`executeOperationsTemporaryCatalogItemPromotion` |
| `DEXTER-2026-08-26-BRAND_COPY_CLOSURE_BUDGET` | `executeOperationsBrandCatalogCopy` |

`backend-performance-budget.mjs#validateRemediationBudgetChange` 是该 schema/resolver 的唯一 validator；它既不拥有 budget 数值，也不读 P1 静态 exception。`backend-performance-budget.test.mjs` 的 exact red/green matrix 是唯一机器 proof。

### D. 验证顺序

1. focused：archive reader（含 plain raw 存在而 archive 缺失/损坏时 CP-05 必红）、three-run reclassification、workload fingerprint、180/59 exact-subset join、zero/missing/duplicate/history/change/max red mutations；同时证明 CALIBRATION 没有 active budget 仍可绿而 ACCEPTANCE 缺 projection 必红。受控 exception matrix 必须逐项覆盖：完整 resolver/report-bound exception 唯一绿；裸 decisionRef、未知 decisionRef、operation 不匹配、from/to/history 不匹配、max 非三次最大值、任一双准入布尔或 evidence 缺失、rejectedAlternative/cost/narrowScope 缺失、普通 fixed increase（有无 decisionRef）均红。
2. P1 → tokens → M1 → P3、edge-codegen `--check`、compile/typecheck、静态总门。
3. fresh `ACCEPTANCE` full run：80=discovered=selected=results；239=declared=observed；budget/connection evidence 均 0 exceeded；business/cleanup PASS。不得拿 calibration run 替代。
4. 只有步骤 3 PASS 才继续本批 24 case L2、reset、DEV start、seed。

### E. 明确禁止

- 不继续从单次 ACCEPTANCE 首败写 operation 例外；不把当前三次失败 run 伪装成 calibration input。
- 不直接编辑 generated route registry、OpenAPI、Java 或 TS；不为 CP-05 新建平行 JSON registry。
- 不为通过预算删除 owner 复核、事务、receipt、锁、读回、库存流水、转正或复制事实；也不通过提高 timeout、删 case、降 oracle 或忽略 cleanup 收口。

### F. 第一轮对抗复核的确认 finding（必须随实现关闭）

1. 当前 `r5-remote-testcontainers.test.mjs` 已验证 archive hash/读取，而 `backend-performance-operation-reconciliation.test.mjs` 只覆盖 CP-05 的内层 runId 校验；两者之间没有“CP-05 强制 archive 读取成功”的联合 proof。实现必须为既有 `readEvidenceArtifact` 增加 `requireArchive` 模式，CP-05 只能调用该模式；新增联合 focused case，并使 archive hash、archive 缺失以及 plain raw 存在但 archive 缺失/损坏各自红。不得复制解压或 hash 逻辑。
2. `CATALOG_DATABASE_OPERATION_MAX`、`CATALOG_BUDGET_EXCEPTIONS` 与 edge canonical catalog 的静态 `databaseOperationBudget` 都在承担当前 activation；新 report reader 若只覆盖其中之一，仍保留 dual source。两者必须同时改为 report 的 exact subset projection；P1 的 `l2OperationBudgetRegistry` 也必须改为同一 reader，而非重读 edge catalog。静态扫描验证旧静态 max 表和 catalog exception list 精确退役（受 linear 常量、schema/test fixture 与明确非 operation 数值豁免除外）。
3. 现有 `validateRemediationBudgetChange` 的 red fixture 仍默认拒绝一切上调。实施不得删除该负控制；必须将其收敛为“默认拒绝、唯一 report-bound exception 放行”的受控 exception validator。唯一绿色 fixture 通过 decision scope resolver、report exception schema、双重准入 evidence、精确 from/to/history、三次实测 max 与 operation identity；裸/未知 decisionRef、operation/from/to/history 失配、任何 admission 缺失以及未登记上调均必须红。

### G. 第二轮对抗复核的确认 finding（必须随实现关闭）

1. `backend-performance-budget.mjs#buildBudgetProjection` 已具备 CP-05 report schema、三次最大值和 exact-set validator，但它只验证传入 operation 的 budget **已经**等于 report max，并不产生/应用 projection。实现必须复用此 validator，补一个最小 activation adapter；不得复制其三次最大值算法，也不得误把当前函数当成已连接的 CP-02。
2. CP-05 report 必须写入唯一 canonical build-time 路径、schema/version 和稳定内容 digest；`generatedAt` 等易变字段不得参与 replay identity。三个 source run 必须分别携带受管 manifest、archive/index、inner backend-acceptance identity 及不含秘密的 canonical workload descriptor/hash。reader 断言三个 source manifest 的 `verificationMode=CALIBRATION`、`backendAcceptance.operation=all`、normal sample matrix=239/239、route exact-set=239/239 且 workload fingerprint 完全相同，防止 ACCEPTANCE failure、不同 fixture/recipe 或 source revision 混入样本。edge-report mutation、catalog-report mutation、只改一侧 projection、archive 缺失/损坏、workload drift 和 report 无例外但旧静态例外仍在，各自必须红。
3. 受控 exception 的“通用能力已复用、无可消除重复”不能仅是自由文本 reason；report schema 至少需把 `businessFactsPreserved` 与 `sharedMechanismsReused` 两个显式布尔及各自 evidence reference、`rejectedAlternative`、`costComparison` 与 `narrowScope` 作为缺一即拒的 admission；`CONTROLLED_BUDGET_EXCEPTION_DECISION_SCOPE` 只允许它们出现在 Dexter decisionRef 所指的 operation。无 exception 的任何上调仍由 red mutation 拒绝。

本段原先记录的 P2 单 context、238 分母与“26 项真实超限”均为已被当前源码反证的历史诊断，**不得作为实施输入**。当前事实只由 CP-00 再生 239 operation exact-set、受管三次 CALIBRATION 的 workload fingerprint、normal-sample matrix 与 CP-05 report 得出；任何历史 P0–P5 数字只可用于解释差异，不能驱动 owner 改动或预算。

## 3. 修复顺序与完成判据

### A. 计量事实单一化

- **event identity contract**：`BackendAcceptanceTest.ScenarioContext` 只通过受 backend-acceptance credential 保护的 `X-Backend-Acceptance-Measurement-Scenario-Id` 写入受限 ASCII ID；`HttpRequestMetricsInterceptor` 对 credential-authorized 的 ID/route 漂移仍写入 `FAILED` completion 和脱敏 `observationError`，不得为了“干净”而丢失诊断证据；全-event closed-set gate 必须先因此 fail closed，正常样本消费才排除失败行。`parseHttpRequestEvents` 将该 ID 作为全量性能 run 的必填、可校验字段。不得从 HTTP status、route 名、fixture 名或 caller env 推导该 ID。
- 仅有两类 ID：`performance.normal-path` 是预算/连接样本，`performance.coverage-only` 是 exact-set-only completion。前者由 80 个业务 scenario、P2 的指定 task-read/合法 command 或 coverage fixture 的正常 recipe 明示注入；后者标识夹具准备、登录、关联创建与边界 probe 等不应计入预算的请求。二者均不是产品 contract 字段，也不得由 HTTP status、路由名、fixture 名或 caller env 推导。
- `backend-performance-operation-reconciliation.mjs#normalMeasurementEvents` 必须拆为 budget-aware ACCEPTANCE 路径与只接收 `operationId/method/path/owner/face` 的 identity-only CALIBRATION 路径；`#buildNormalSampleMatrix` 同样接受 identity tuple。`r5-remote-testcontainers.mjs#verifyFullBackendAcceptanceCalibration` 与 `backend-performance-cp05-reclassification.mjs#readRun` 只能调用 identity-only 路径。canonical 两条生成源为每个 active budget 声明唯一的 normal allow-list `measurementScenarioIds=["performance.normal-path"]`；这是 operationId + normal measurement kind 的单一映射，不新建第三份 registry。CALIBRATION 不读取或验证 active max/metadata；只有 ACCEPTANCE 消费 report projection 后的 budget metadata。coverage-only 不进入 budget metadata。interceptor、event parser、generator validator 与 run verifier 对两值闭集共同 fail closed，任一第三值（即使同 operation 另有合法 normal sample）均令 run 失败。
- exact-set 仍消费所有 completion event，保证 239 路由没有漏测；budget/connection sample 仅消费 `outcome=SUCCEEDED`、`measurementScenarioId=performance.normal-path` 且该 ID 被 operation 的生成 metadata 声明的事件。**在进入消费集合前**，每条 normal event 的 method/path/owner/face 必须逐字等同 generated registry；coverage-only event 不得替正常 event 提供身份佐证。normal ID 缺失、未知 normal ID、身份漂移或任一 operation 无正常成功样本分别 fail closed；coverage-only event 只能证明 exact-set。
- 缺任何 operation 的正常样本必须 `PERFORMANCE_OPERATION_BUDGET_MISSING_NORMAL_SAMPLE` 停机；不得退化为 4xx、默认样本、按 status 猜测或 budget fallback。
- red mutation：coverage-only event 不可满足 normal sample；第三 measurement ID 即使另有合法 normal sample 也必须红；身份错误 normal event 即使同时存在身份正确 coverage-only event 也必须红；缺 normal sample 必须点名 operation；超预算 normal event 必须红；带任意 `observationError` 的 FAILED completion（包括伪造 metadata）即使另有完整 239 条合法 normal sample 也必须令 ACCEPTANCE 与 CALIBRATION 分别红；任何非 239 exact-set 必须红；普通 fixed max 上调（有无 `decisionRef`）必须红，只有满足本计划 §2b.C.3 的 report-bound 受控例外才可绿。
- **manifest 读回同样是门的一部分**：`parseAndValidateRunManifest` 必须记录并校验本次 backend-acceptance run identity、`operation`、canonical workload descriptor/hash、archive/index digest；当且仅当 `operation=all` 时，parser 按 `verificationMode` 结构性验收 `239/239` exact-set、connection evidence 与 normal-sample matrix；`ACCEPTANCE` 还必须有 `239/239、exceeded=0` 的 fixed-budget evidence 和与两个 generated registry 相同的 `calibrationReportDigest`，`CALIBRATION` 必须有 calibration evidence 且禁止 fixed-budget evidence。不得以一个 `measurementEvidence.status=PASS`、伪造 operation 或省略字段替代真实 run-level proof；每一缺口各有独立 red mutation。

### B. 正常 fixture 闭包

- `BackendPerformanceOperationCoverage` 继续是唯一的非 scenario route-gap fixture 宿主，不新建 provider、registry 或第二份 `@AcceptanceScenario` catalog。`P2ReadConnectionScopeScenarios.run` 显式接收 normal 与 coverage context。**每个 helper/request call site 都必须选择其一**：该 request 本身是已声明的成功业务-normal task-read、合法 command 或 readback 时才用 normal；邀请、登录、夹具创建、关联创建和受控边界请求用 coverage。coverage 宿主同样遵守这条规则；不得再以一个 fixture 的默认 context 给整段请求打标。2026-08-26 的首败证明 IAM/platform 的 93 个合法 2xx 路由已有工作流却整体被错误传入 coverage context；修复必须让三个业务段显式接收双 context，并保持其 fixture/login 调用仍为 coverage，不能把整个段或 coverage probe 改名为 normal。
- 在完整 run 后生成一个 **239-row normal-sample matrix**：`operationId`、method、route template、owner、consumer face、normal sample count 与最大 DB count。它从两条 route generator 的 current exact-set 与真实成功 completion 交叉复算，不保存为第二 registry；合法 fixture、请求与 2xx readback/可观察 side effect 仍只住在既有 scenario/P2/coverage recipe 源码，动态矩阵只证明它们真实发生。`normal provider` 缺失即 fail，不允许手写“已覆盖”。历史“108”只是一轮差集快照，实施时必须从 current 239 exact-set 重算。
- CP-05 reclassification 的三个输入 run 必须是**校准模式**：受管入口显式传递 `--calibration`，runner 在 manifest 写入 `verificationMode=CALIBRATION` 及 canonical workload fingerprint；exact-set、两值闭集、normal identity、normal matrix、connection 与 cleanup 都先绿，但不调用 active fixed-budget compare，也不读取 active max。这样 `CALIBRATION` 是 run-level identity-only 验证模式，measurementScenarioId 仍严格只有两种，不新增第三请求标签。三次同 fingerprint 的 239-row 最大值、分类和 readiness report 是唯一可重放输入。若 report 显示真实 owner 路径未满足阈值，先修 owner；不得用 report 抬高 active budget，唯一例外仅为 §2b.C.3 的受控记录。仅在 report 全 READY 后，现有两条 generator 原子写入/激活 projection。
- CP-05 reclassification 必须区分每个 manifest 的两个 identity：外层 `manifest.runId` 只标识受管 Testcontainers run；HTTP completion 的唯一 identity 是内层 `manifest.backendAcceptance.runId`。它必须调用 `parseHttpRequestEvents(..., manifest.backendAcceptance.runId)` 并要求 measurementScenarioId；内层 identity 缺失或任一 event 不匹配均 fail closed。不可再无 runId 地解析全文件、拿外层 id 比 HTTP event，或消费 coverage-only/failed event。它的 source-manifest 条件为 test execution、two-ID event contract、exact-set、normal matrix 和 cleanup PASS，**不要求旧 active-budget PASS**。
- 将当前 route gap 按 read、单资源 lifecycle command、聚合 command、asset/identity command 分组，逐条提供真实 fixture、合法 request、成功 readback 或可观察 side effect。
- 一条 route 不能构造正常业务样本时，运行直接以 `P0_OPERATION_NOT_MEASURED:<operationId>` 停机，交由 Dexter 决定业务 fixture，不以 4xx 覆盖代替。
- 该 fixture 仍不是第二份 `@AcceptanceScenario` catalog；80 条业务 scenario 分母保持不变。

### C. Catalog 列表投影根治

- list-only hydrator 不读取 `attributeAssignments`；列表不消费该详情事实。
- SKU 商品不读取 item `orderOptionConfigs`；列表仅在无 SKU 的商品投影点单选项。
- list-only hydrator 不读取未被 `DerivedSkuFacts` 消费的 `skuVariantDimensions` relation。
- 分类 relation 与分类路径在一个 owner-local list projection 中产出；不由前端重建路径，也不为同一页再发 relation query。
- 仍保留列表实际消费的 SKU、媒体、属性摘要、引用、单位快照与制作摘要；不通过删字段改变十列表格的 contract。

### D. CP-05 current report 的 owner worklist

- CP-05 report 是唯一 operation selector：只有 `category/readiness` 指明仍需整改、且不符合本计划 §2b.C.3 受控例外的 current row 才进入 owner 修改。不得以历史 26、旧 P0–P5、旧 45/35/20 名单驱动当前改动。
- 每个 current row 先按 event 的 `OWNER_READ/OWNER_WRITE`、`phaseCheckpoints` 与 owner source 形成 command-local root-cause card：重复读取/重复投影的事实、不可削弱的 authorization/CAS/receipt/typed-problem/readback、可复用 shared mechanism、预期 after evidence。然后同根扫描并在 owner task 内处理；不得只改 fixture、分类字段、budget report 或 max。
- 报告出现 catalog list/aggregate 成员时，仍适用本计划 C 节：保留十列表格、SKU、制作、库存、copy/temporary-promotion 的 readback，使用 command-local set projection，而非删详情事实。报告出现分类成员时，三级上限、循环拒绝、CAS、receipt 与删除可用性不得改为前端判断或预算豁免。
- 历史 26 项和其 45/35/20 分配只保留在已归档 review evidence 作 before/after 比较，**严禁**作为当前 implementation worklist；任何其外或其内 current row 都由 report 决定。

## 4. 执行闸门

1. A--D 的源码与 generator/fixture 变更先完成逐项设计对账、239 current-tree denominator addendum、focused proof、P1→tokens→M1→P3 exact chain、compile/typecheck 与静态 health gate。
2. 先受管运行三次无 active-budget 依赖的 CP-05 校准 workload，生成相同 workload 的 239-row report；任一 run 的 exact-set、two-ID contract、normal identity、matrix 或 cleanup 非绿，停在该边界根治，不生成预算。
3. 仅在校准 report 全 READY 后，原子生成 current budget 并执行受管 Testcontainers fresh run；必须同时满足 `80=discovered=selected=results`、operation exact-set `239/239`、每条预算有 normal sample、budget/connection evidence 全绿、business/cleanup 分账 PASS。
4. 仅在上述成功后继续既有 L2、reset、DEV start、seed 收口链。

## 5. 禁止项

- 禁止未满足 §2b.C.3 的 `databaseOperationBudget` 上调、用 decisionRef 伪装历史校准、过滤超限 2xx、将 coverage 4xx 标为成功、仅修改测试期望、或恢复 caller-controlled performance gate。
- 禁止缩减十列表格、SKU 展开、三级分类、单生产标签或已批准的业务 readback 来换取计数。

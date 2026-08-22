# 后台接口性能整改 implementation 独立对抗审查 Round 1

REVIEW_CYCLE_ID=2026-08-23-v2s-backend-performance-remediation-implementation  
REVIEW_TARGET=IMPLEMENTATION  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
REVIEWER_STANCE=FRESH_ADVERSARIAL;AUTHOR_CLAIMS_NOT_TRUSTED  
ARTIFACT=doc/review/platform/2026-08-23-v2s-backend-performance-remediation-implementation-review-round1-claude.md

## Verdict

VERDICT=NO-GO  
M/S/N=3/0/2  
ROUND_2_REQUIRED=YES_AFTER_FIXES

结论：后端 238 operation 预算、connection gate、三 run CP05 重分类和 Testcontainers business/cleanup 证据在本轮没有被证伪；但 implementation 仍存在 3 个 M 级问题，集中在批量结果的 root-cause failure handling 与 UI-bearing B-05 交互闭环。不能因为动态 80/80 或 238/238 自动 GO。

## Review-standard 五项动作

1. `REVIEW_TARGET=IMPLEMENTATION` 已显式声明；本轮执行 1-A 代码提取，不采信作者自述或旧 verdict。
2. 与已批准需求/详设/IA/interaction 对账：重点核对 L2 预算门、CP03/CP06-CP12 owner/frontend 源码、B-05 UI、三 run manifest、CP05 report。
3. 同根全集扫描：除用户点名文件外，还扫描了 catalog owner `RESULT_UNKNOWN`/batch result 创建点、frontend batch modal/refresh/test-id/test 文件、预算 generator 入口、当前 generated registries、CP05 report 与三 run manifest。
4. L3 unverified inventory 已列在本文末尾；静态/HTTP/Testcontainers 与浏览器 L2/UAT 分档，不互相冒充。
5. Verdict 基于下列 findings；每条 finding 均按 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION` 归类。

## Findings

### [M-01][CONFIRMED] 批量逐项事务把未知 RuntimeException 转成正常 2xx item failure，掩盖根因失败

File: `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java:713`

Evidence:
- `executeBatchStatusItem` 捕获所有 `RuntimeException`，只尝试提取 `CatalogOwnerApi.Problem`；若不是 owner typed problem，就返回 `problemCode="RESULT_UNKNOWN"` 和通用 reason，而不是让请求级失败暴露：`CatalogOwnerService.java:713-723`。
- 详设要求每项事务保留 `REQUIRES_NEW`，但前端不得补 `RESULT_UNKNOWN`，并要求请求级前置失败走整体 typed problem：`doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-implementation-design-codex.md:130-134`、`:299-300`。
- Journey 禁止“不展示 raw exception / 不以 fallback 合成缺失结果 / 不把请求级失败伪造成逐项结果”：`doc/decisions/2026-08-22-v2s-backend-performance-batch-outcome-journey.md:39-40`、`:59`。
- Same-root scan 显示 batch 正常结果创建点里该 catch-all 是唯一把未知 exception 降级成 item result 的路径；其他 `RESULT_UNKNOWN` 多为 request-level owner `Problem` 抛出。

Impact:
未知数据库、序列化、NPE 或程序错误会被包装成业务 receipt 的失败项，批量请求仍可能以“明确结果”返回。这样会隐藏 first failure/broken boundary，也违反本批“逐项业务失败可报告；系统/契约失败不可伪造逐项结果”的根因边界。

Fix:
只把已知、脱敏、属于 batch item 闭集的 `CatalogOwnerApi.Problem` 转成 item `FAILED`；其他 `RuntimeException` 必须重新抛出为请求级 failure，并保留受管日志/manifest evidence。补一个 regression：在某项事务内注入非 owner typed exception，断言不会生成 2xx batch receipt，且已提交/回滚边界符合逐项事务语义。

### [M-02][CONFIRMED] 批量成功后的刷新范围过大，且刷新失败不可见

File: `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx:594`

Evidence:
- `refresh()` 会重取 `headCompanyQuery`、`contextQuery`、`navigationQuery`、`manifestQuery`、`tagDictionaryQuery`、`itemsQuery`：`CatalogWorkbenchPage.tsx:594-613`。
- batch action 成功后无条件调用这个全量 `refresh()` 并立刻清空选中项：`CatalogWorkbenchPage.tsx:705-706`。
- IA 明确要求 receipt 严格校验通过后“只让当前 `getOperationsCatalogItems` 查询和 `getOperationsCatalogNavigation` 失效/重取；不重取 workspace context、shape manifest、tag dictionary 或单位库”，且刷新失败时 Modal 保留权威 receipt 并提示列表刷新失败：`doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-ia-codex.md:33`。
- Interaction 也要求关闭后列表和导航读回最新事实，不用本地 patch 冒充 readback：`doc/decisions/2026-08-22-v2s-backend-performance-batch-outcome-ui-interaction.md:119-120`。

Impact:
这是性能整改自身的 UI-bearing path，当前实现会在每次 batch 后引入额外 workspace/context/manifest/tag dictionary 请求；同时 `void ...refetch()` 没有 await/catch，用户无法知道“命令已成功但列表刷新失败”，会把 receipt 与列表事实边界混在一起。

Fix:
拆出 batch 专用 refresh：只 await `itemsQuery.refetch()` 与 `navigationQuery.refetch()`。刷新失败时保留 `batchResults`，显示独立“列表刷新失败，请手动刷新”提示，不把命令降格为失败，也不要用全量 workbench refresh 代替 IA 指定的最小 readback。

### [M-03][CONFIRMED] B-05 结果 Modal 未实现批准的结果层级、滚动容器/testId，focused test 也没有覆盖六项 UI 行为

File: `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx:1441`

Evidence:
- 当前结果态只有一个 `Alert` 和 `List`：`CatalogWorkbenchPage.tsx:1441-1464`。没有可见 “批量操作完成”、没有 “以下 M 个商品未处理成功”、没有“商品编码/失败原因”表头，没有失败区 `max-height: 50vh` 独立滚动，没有商品编码单行省略 + tooltip。
- 当前 testId 只有既有 `catalog-inventory-batch-modal`；same-root scan 未发现 IA 要求的 `catalog-batch-outcome-summary`、`catalog-batch-outcome-failures`、`catalog-batch-outcome-close`。
- IA 明确要求这些 testId、提交态 `aria-busy`、结果总数非纯颜色表达、失败列表可键盘滚动，以及 50vh 失败列表容器：`doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-ia-codex.md:22-26`。
- Interaction 明确列出用户可见文案和 layout：`doc/decisions/2026-08-22-v2s-backend-performance-batch-outcome-ui-interaction.md:39-42`、`:51-53`。
- 现有 focused test 只覆盖 request builder 和 decoder fail-closed：`CatalogManagementPage.test.tsx:782-853`；没有渲染 Modal、滚动容器、copy/testId、refresh failure 或“无 itemRef/problemCode/version 泄露到用户字段”的组件断言。

Impact:
本批唯一 UI-bearing surface 是 B-05。后端 receipt 已有逐项结果，但界面没有按已批 IA/interaction 提供可证伪的结果层级与自动化锚点；100 项全部失败时也缺少批准的容器行为。该问题不能用 backend Testcontainers 或静态 decoder test 代替。

Fix:
按 IA-BPR-01 渲染结果层：summary 使用 `catalog-batch-outcome-summary`；失败区使用 `catalog-batch-outcome-failures`，包含“以下 M 个商品未处理成功”、列头“商品编码/失败原因”、`maxHeight: 50vh` + `overflowY: auto`，商品编码 ellipsis + Tooltip，reason 可换行；关闭按钮提供 `catalog-batch-outcome-close`。新增 focused component tests 覆盖全成功、部分失败、100 项失败滚动、协议错误不补造结果、刷新失败提示、用户字段不显示 itemRef/problemCode/version/raw exception。

### [N-01][PARTIALLY_CONFIRMED] 预算脚本当前 `--check` 仍是 NOT_READY；可通过的是 schema self-test 与两个 canonical generator

File: `scripts/generate/backend-performance-budget.mjs:394`

Evidence:
- 当前命令 `node scripts/generate/backend-performance-budget.mjs --check` 输出 `BACKEND_PERFORMANCE_BUDGET=NOT_READY`，退出码 2，reason 为 `CP05_MEASUREMENT_REQUIRED`。
- 同一脚本 `--self-test` PASS：`BUDGET_SCHEMA=PASS`、`RED_NULL=PASS`、`RED_PLACEHOLDER=PASS`、`RED_LINEAR_LIMIT=PASS`、`BUDGET_SELF_TEST=PASS`。
- 脚本注释说明它不创建第三个 budget registry，canonical budgets 由 edge/catalog 两个 generator 消费：`scripts/generate/backend-performance-budget.mjs:343-348`。
- 当前 `edge-codegen --check` 与 `catalog-inventory-p1 --check` PASS，且 generated registry 当前 exact-set 是 181+57=238。

Impact:
如果作者声称“backend-performance-budget `--check` PASS”，这个精确命令的证据不成立；但本轮未证伪 canonical 预算本身，因为两个 owning generator 与 Testcontainers budgetEvidence 已闭合。

Fix:
把文档/证据口径改成明确的 `backend-performance-budget --self-test` + `edge-codegen --check` + `catalog-inventory-p1 --check`，或在 CP05 后让 `--check` 读取 canonical generated outputs 并返回 PASS。不要留下“check PASS”但命令实际 NOT_READY 的歧义。

### [N-02][UNVERIFIED_REQUIRES_EVIDENCE] B-05 浏览器 L2/UAT 未在本轮验证

Evidence:
- 本轮用户明确禁止 browser L2、UAT、DEV 生命周期、seed/reset/deploy。
- 现有证据能证明 Node tests、Java compile、generated checks、remote Testcontainers HTTP/business/cleanup；不能证明真实浏览器中 Modal 高度、滚动、tooltip、keyboard/focus、同源 cookie、视觉 overflow。

Impact:
这不是对当前 Testcontainers 80/80 的否定；它是证据分档边界。UI-bearing surface 必须在修复 M-02/M-03 后补组件 focused proof；浏览器 L2/UAT 只有获得授权后才能称为对应档位。

Fix:
Round 2 至少需要当前树 focused component proof；如果要宣称 L2/UAT，再按授权运行对应受管浏览器/UAT，而不是用 backend acceptance 代称。

## Attacks cleared with evidence

- 238 operation 预算 exact-set：REJECTED_WITH_EVIDENCE。当前 generated registries 为 edge 181 + catalog 57 = 238，operationId 唯一；CP05 三 run exact-set 均 expected=238、observed=238、missing/extra/drift=0。
- 非 null / 非哨兵预算：REJECTED_WITH_EVIDENCE。`validateDatabaseOperationBudget` 禁止 null、placeholder、混合 fixed/linear；catalog batch 是唯一 `LINEAR_REQUEST_CARDINALITY`；其他 operation 固定 max。
- Batch 线性预算：REJECTED_WITH_EVIDENCE。CP05 复算中 `batchTransitionOperationsCatalogItemStatus` 三 run 均 N=20、DB=110、maxAllowed=115，即满足 `15+5*N`。
- Batch 独立事务：REJECTED_WITH_EVIDENCE。`TransactionTemplate` 设置 `PROPAGATION_REQUIRES_NEW`：`CatalogOwnerService.java:708-710`；M-01 不是否定逐项事务，而是否定 catch-all unknown failure 降级为正常 item result。
- Connection gate：REJECTED_WITH_EVIDENCE。`HttpRequestMetricsInterceptor` 同时记录 raw physical borrow 与 `operationConnectionBorrowCount`；verifier/reconciliation 使用 operation boundary count 判定 GET≤1、write≤transaction。CP05 三 run connection exceeded=0。
- UNCLASSIFIED gate：REJECTED_WITH_EVIDENCE。`DatabaseOperationTracker.defaultSection` 对未知 edge SQL 保持 `UNCLASSIFIED`，event verifier 对 SQL 分母的 unclassified ratio >5% fail；CP05 三 run unclassified ratio=0。
- CP05 当前树重分类：REJECTED_WITH_EVIDENCE。临时复算报告：business=PASS、cleanup=PASS、firstFailure=null、lastKnownGood=三 run id、brokenBoundary=null、P0=0/P1=1/P2=0/P3=0/P4=0/P5=237、budget ready=238、blocked=0、adjustmentDiff=[]。
- Acceptance 档位：REJECTED_WITH_EVIDENCE for “static/Gradle 冒充 HTTP”。`CatalogAcceptanceScenarios` 有真实 HTTP batch partial-outcome 场景；三份 remote Testcontainers manifest 均为 testExecution PASS、measurementEvidence PASS、cleanup PASS。但这仍不是 browser L2/UAT。

## Static validation rerun in this review

- `node scripts/test/test-health-entry-runner.mjs --node`: PASS，24/24 files，131/131 tests。
- `./gradlew :apps:backend:catering-business-server:compileJava :apps:backend:catering-business-server:compileTestJava --no-daemon`: PASS。
- `node scripts/generate/edge-codegen.mjs --check`: PASS，FILES=273。
- `node scripts/generate/catalog-inventory-p1.mjs --check`: PASS，OPERATIONS=57。
- `node scripts/generate/backend-performance-budget.mjs --self-test`: PASS。
- `node scripts/generate/backend-performance-budget.mjs --check`: NOT_READY / exit 2；见 N-01。
- CP05 三 run用 `/tmp` 目标复算，stdout 为 `BACKEND_PERFORMANCE_CP05_RECLASSIFICATION=PASS`，未覆盖仓库证据。

No LSP-specific diagnostic tool was exposed in this review environment; Java compile and Node/TS test-health were used as current-tree static/type evidence.

## L3 unverified inventory

- Browser L2：NOT_RUN，本轮无授权；不能证明 Modal 真实视口、滚动、tooltip、focus/keyboard 或视觉 overflow。
- UAT：NOT_RUN，本轮无授权。
- DEV L1 lifecycle / seed / reset：NOT_RUN，本轮无授权；三份 manifest 显示 `devLifecycle.wasRunning=false`，因此无 DEV stop/restore 链。
- UI focused component proof：PARTIALLY_PRESENT。decoder strictness 有测试，但 B-05 六项用户可见/容器/testId/refresh failure 行为未被测试覆盖。

## Round 2 entry criteria

Round 2 应在以下修复后进行，且仍按同一 `REVIEW_CYCLE_ID`、`REVIEW_ROUND=2`、`REVIEW_ROUND_LIMIT=2`：

1. 修复 M-01：未知 RuntimeException 不再转成正常逐项 result，并补 regression。
2. 修复 M-02：batch 成功后只刷新 items/navigation，且刷新失败可见并保留 receipt。
3. 修复 M-03：按 IA/interaction 实现结果 Modal 与 testId/scroll/copy，并补 focused component tests。
4. 澄清 N-01：预算脚本证据命令到底是 `--self-test` 还是一个真正可 PASS 的 `--check`。

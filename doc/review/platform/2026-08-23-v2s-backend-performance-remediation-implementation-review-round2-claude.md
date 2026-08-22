# 后台接口性能整改 implementation 独立对抗审查 Round 2

REVIEW_CYCLE_ID=2026-08-23-v2s-backend-performance-remediation-implementation
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEWER_STANCE=FRESH_ADVERSARIAL;AUTHOR_CLAIMS_NOT_TRUSTED
GIT_USED=NO
DEV_RESET_SEED_BROWSER_L2_UAT_DEPLOY_USED=NO

## 输入清单与盲审声明

已亲验：AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、Roadmap 授权字段、project-memory 路由原文、scripts/README.md、implementation design、serial plan、Round1 artifact、当前源码、focused tests、generator、Testcontainers runner manifest/log/result。

盲审声明：不采信作者自述；Round1 findings 均重开 owning source / tests / manifest 后重新分类。

## 结论

VERDICT=GO_WITH_UNVERIFIED_UI
GO_NO_GO=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/2

说明：Round1 的 3 个 M 级实现缺陷已由当前源码与 focused proof 反证关闭；剩余 N 为证据边界，不是阻断级实现缺陷。Browser L2/UAT/DEV 生命周期仍未授权、未运行，不能被本轮静态/focused/Testcontainers 代称。

## Round1 Findings 复验

### M-01: unknown item RuntimeException 不能伪造 2xx RESULT_UNKNOWN receipt

STATUS=REJECTED_WITH_EVIDENCE，已闭合。

证据：
- CatalogOwnerService.java:731-739 的 `batchItemFailureOrThrow` 只允许 item 闭集内的 4xx owner typed problem 转成 item `FAILED`；`RESULT_UNKNOWN`、5xx、非 owner problem 均重新抛出为 request-level failure。
- CatalogBatchStatusTransitionIntegrationTest.java:89-124 证明 malformed owner fact 触发 `RESULT_UNKNOWN` request failure，不创建 batch receipt，同时较早 item 的独立事务提交保留。
- CatalogBatchStatusTransitionIntegrationTest.java:128-171 与 224-241 证明 VERSION_CONFLICT / SCOPE_FORBIDDEN 等已知 typed 4xx 仍逐项尽力并明确报告。
- CatalogAcceptanceScenarios.java:1584-1710 以真实 HTTP 覆盖 20 项、1 项失败、19 项提交、结果同序、owner itemCode/reason/readback。

### M-02: batch 后刷新范围和刷新失败呈现

STATUS=REJECTED_WITH_EVIDENCE，已闭合。

证据：
- CatalogWorkbenchPage.tsx:619-629 新增 `refreshAfterBatch`，仅 await `itemsQuery.refetch()` 与 `navigationQuery.refetch()`。
- CatalogWorkbenchPage.tsx:729-730 成功 receipt 后才调用 batch refresh 并清选中项。
- CatalogBatchOutcome.tsx:28 与 CatalogManagementPage.test.tsx:917-928 证明刷新失败在结果层可见，且不改写权威 receipt。
- 未发现 batch path 继续调用全量 `refresh()` 的 headCompany/context/manifest/tagDictionary refetch。

### M-03: CatalogBatchOutcome 与六项 focused proof

STATUS=REJECTED_WITH_EVIDENCE，已闭合。

证据：
- CatalogBatchOutcome.tsx:20-33、38-73 实现 summary/failures/close testId、approved copy、失败表格、50vh 独立滚动、tooltip/ellipsis。
- CatalogManagementPage.test.tsx:879-944 覆盖全成功、部分失败、100 行 50vh scroll、空/协议非法不造结果、刷新失败提示、itemRef/problemCode/version/raw exception 不作为用户字段。
- CatalogInventoryBomWorkbench.test.tsx:112-186 覆盖三布局分支、非法 mode 无入口、cursor 两页去重、typed problem 定位、关闭清草稿、保存后 item detail/candidate 精确失效。测试断言真实 helper/markup/policy，不只是标题存在。
- decodeCatalogBatchResults 在 catalogModel.ts:571-628 对结果字段、顺序、identity、条件 union fail closed；不会补造 `RESULT_UNKNOWN`。

注意：CatalogBatchOutcome.tsx:60 仍有 `未提供失败原因` 兜底文案。按当前 status batch decoder，FAILED 缺 reason 会在 model 层 fail closed，因此该分支对 B-05 status receipt 不可达；建议后续若该组件继续承载 category/tag batch，也把 result type 收紧为 FAILED 必有 reason，避免未来误用。

### N-01: backend-performance-budget --check NOT_READY 边界

STATUS=CONFIRMED。

证据：
- `node scripts/generate/backend-performance-budget.mjs --check` exit=2，输出 `BACKEND_PERFORMANCE_BUDGET=NOT_READY` / `STOP=NO_BUDGET_REGISTRY_BEFORE_CP05`。
- `--self-test` exit=0。
- `edge-codegen --check` exit=0，FILES=273；`catalog-inventory-p1 --check` exit=0，OPERATIONS=57。
- scripts/generate/backend-performance-budget.mjs:378-380 明确不创建第三份 canonical registry；canonical budgets 由两个 owning generator 消费。

### N-02: browser L2/UAT/DEV 生命周期

STATUS=UNVERIFIED_REQUIRES_EVIDENCE。

本轮未授权、未运行 browser L2/UAT/DEV lifecycle/reset/seed/deploy。Testcontainers、static、focused test 只证明各自层级，不能冒充 browser L2 或 UAT。

## 静态与动态复验

- `scripts/verify --validate-only`: exit=0，`R5_VERIFY_VALIDATE_ONLY=PASS`，`CLEANUP=NOT_APPLICABLE_STATIC_ONLY`。
- `node scripts/test/test-health-entry-runner.mjs --node`: exit=0，DISCOVERED_TEST_FILES=24，EXECUTED_TEST_FILES=24，131/131 pass。
- operations-admin `yarn typecheck`: exit=0。
- focused Vitest: `CatalogManagementPage.test.tsx` + `CatalogInventoryBomWorkbench.test.tsx`: 2 files / 47 tests pass。
- LSP/AST MCP: tool transport closed；未作为通过证据。

## Testcontainers Evidence

最终证据取 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787440276179-62850/run-manifest.json`，不是 raw Gradle module run，也不是无 coverage fixture 的 run。

- run status PASS；firstFailure=null。
- Gradle target line: `> Task :apps:backend:catering-business-server:test`，log 显示 BUILD SUCCESSFUL。
- backend acceptance: discovered=80，selected=80，resultRows=80，business/contract/businessMode REAL 全部 PASS。
- operation exact-set: expected=238，observed=238，missing=0，extra=0，drift=0。
- budgetEvidence: declared=238，observed=238，exceeded=0。
- connectionBudgetEvidence: declared=238，observed=238，exceeded=0。
- UNCLASSIFIED_SQL=0，ratio=0。
- cleanup PASS：remoteProcess / remoteWorkspace / Testcontainers containers / volumes 均 PASS。
- devLifecycle.wasRunning=false，stop NOT_RUN，restore NOT_APPLICABLE。

## Recommendation

GO_WITH_UNVERIFIED_UI。实现层 Round1 M 级问题已闭合；不得把本结论升级为 browser L2/UAT/DEV/seed/reset 通过。

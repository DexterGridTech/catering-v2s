# base-1 / catering-v2s 当前字节 implementation 独立对抗复核

REVIEW_CYCLE_ID=BASE1_IMPLEMENTATION_20260830_CURRENT_BYTES_FINAL
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=TRUE

blindReviewDeclaration: 本轮从当前仓库字节、owning source、生成链与指定 runtime/evidence artifact 重新提取事实；不采信作者、上一轮 Claude 或任何报告的自报结论。未运行 reset、seed、DEV restart、browser L2、UAT、deployment、Git 或其他动态命令。除本 review artifact 外未修改源码、生成物、fixture、manifest 或 evidence。

## 输入清单路径

- `.agents/skills/cs-review/SKILL.md`
- `doc/platform/review-standard.md`
- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/README.md`
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`
- `project-memory/index.md`
- `project-memory/kernel/01-workspace-and-roadmap.md`
- `project-memory/kernel/02-service-shape-and-owner.md`
- `project-memory/kernel/03-transaction-data-and-dependencies.md`
- `project-memory/kernel/04-contract-consumer-and-admin.md`
- `project-memory/kernel/05-evidence-runtime-and-git.md`
- `project-memory/kernel/06-heritage-and-change.md`
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/operations/verification-governance.md`
- `project-memory/decisions/r5-full-seed-report-api-db-accounting.md`
- `scripts/README.md`
- `doc/platform/foundation-charter.md`
- `doc/platform/backend-coding-standard.md`
- `doc/platform/frontend-coding-standard.md`
- `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md`
- `doc/plans/platform/2026-08-27-v2s-base-1-appendix-cascade-and-members-claude.md`
- `doc/plans/platform/2026-08-27-v2s-base-1-ia-design-codex.md`
- `doc/plans/platform/2026-08-27-v2s-base-1-implementation-design-codex.md`
- `doc/plans/platform/2026-08-27-v2s-base-1-implementation-design-claude.md`
- `scripts/generate/catalog-inventory-p1.mjs`
- `contracts/catalog/catalog-inventory-edge-contract.json`
- `contracts/catalog/catalog-inventory-read-models.json`
- `contracts/catalog/catalogInventoryEdgeWire.ts`
- `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts`
- `apps/backend/catering-business-server/build/generated/sources/catalog-inventory-p1/main/java/com/catering/v2s/app/edge/generated/wire/*.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinatorCopySourceAuthorityTest.java`
- `scripts/dev/catalog-inventory-seed-executor.mjs`
- `scripts/dev/catalog-inventory-seed-executor.test.mjs`
- `scripts/dev/r5-complete-seed-executor.mjs`
- `contracts/policy/backend-performance-operation-counts.json`
- `contracts/policy/backend-performance-cp05-calibration-report.json`
- `.runtime/browser-l2/l2-1788016956479-74207-bb306a9b-d775-439d-a33c-874f500159fb/*`
- `.runtime/r5/reset/r5-reset-6c287aa8-66a8-4fa3-8c40-02b59edea81f/*`
- `.runtime/r5/run-manifest.json`
- `.runtime/r5/seed/complete/complete-seed-f050f7f3-2e5b-4ad6-9702-b907c1badf31/*`
- `.runtime/r5/catalog-inventory/seed/catalog-seed-b59a4b3c-29ef-4a94-8094-ff2293115c74/*`
- `.runtime/r5/seed/r5-dev-1788017756650-92005-39aa1fef-2581-47c6-894c-ac1f64da62ea/*`

## review-standard §1 五个动作执行摘要

### 动作 1-A：从代码提取用户可见事实

已对 `apps/frontend/operations-admin/src/features/catalog-management/{ui,model}`、`apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts`、catalog generator、catalog owner source 与 generated Java wire 做静态提取。

提取到的事实分母非空，包含：

- operations-admin catalog UI：表格列、Drawer/Modal 表单字段、header 动作、空/错/恢复中文 copy、前端状态/枚举文案。
- catalog generated wire：`CatalogNavigationView`、`CatalogItemPage`、`CatalogItemDetail`、`CatalogDictionaryView`、`ProductionTagPage`、`CatalogItemSkuPage`、copy/preflight/readback、inventory workbench、production tag readback 等响应类型。
- backend catalog owner response：temporary promotion `blockedReasons`、item/SKU void `blockingReasons`、problem messages 与 structured readback。

### 动作 2：与本批设计/规范逐条对账

对账依据按 `cs-review` 顺序：base-1 requirements/IA/implementation design → backend/frontend coding standard → foundation charter → routed memory。动态证据只作为 evidence tier，不替代源级对账。

结论：当前 runtime evidence 显示 seed/reset/DEV/L2 business/cleanup 候选证据为 PASS；但 implementation 源级仍有两个 base-1 判据未闭合，足以 NO-GO。

### 动作 3：同族全集扫描

已对两个 confirmed finding 做 same-root scan：

- closed-set enum：扫描 `scripts/generate/catalog-inventory-p1.mjs`、前端 generated TS、backend generated Java wire；同族包含 status/targetStatus/source/result/productionTag/sku/dictionary/asset/copy/inventory status 等裸 `string` 字段，其中一部分可能是业务自定义或异域状态，但 catalog lifecycle / dictionary lifecycle / production tag lifecycle / SKU lifecycle / code-defined static sets 未见统一 enum exact-set 反向门。
- backend user-visible reason strings：扫描 `CatalogOwnerService` 中 `blockedReasons.add(...)` 与 `appendVoidBlockingReason(...)` 写入响应体的路径，并核对 generated wire 与前端模型/测试消费；temporary promotion、item void、SKU void 三类 readback 仍在后端写用户可见理由文本。

### 动作 4：L3 未验证清单

未运行新动态命令；只复核既有候选 evidence。当前仍未验证：

- UAT/部署：未执行，不能由 DEV/L2 证据升格。
- 全量视觉/可访问性：browser L2 覆盖 24 个 catalog case，但未证明所有 catalog UI 文件提取出的长中文串、布局、焦点与视觉边界。
- closed-set enum 改动后的编译期穷尽性：当前实现尚未闭合，无可验证 PASS。
- backend reason code 化后的 UI copy 显示：当前仍为后端 label/raw string，无可验证 PASS。

### 动作 5：固定 verdict block

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=2/0/0
L1_ENGINEERING=findings: M1, M2
L2_USER_VISIBLE=findings: M2; existing browser L2 candidate has 24/24 caseOutcome=PASS/result=passed/joinStatus=COMPLETE, business=PASS, cleanup=PASS, but it does not override source-level user-visible response violations
L3_UNVERIFIED=UAT/deployment not run; full visual/accessibility coverage not proven; closed-set enum compile-time exhaustiveness not proven; reason-code UI rendering not proven
SAME_ROOT_SCAN=M1 and M2 same-root sets listed below
DESIGN_GAPS=无新的正本缺判据；M1/M2 均已有 base-1 requirements 与 backend coding standard 判据
EVIDENCE_TIER=static owning-source review + existing managed runtime artifact readback; no new dynamic execution
```

## 候选动态证据复核

### Browser L2

- Path: `.runtime/browser-l2/l2-1788016956479-74207-bb306a9b-d775-439d-a33c-874f500159fb`
- `l2-execution-manifest.json`: `business=PASS`, `cleanup=PASS`, `firstFailure=null`, `results=24`, `progress.total=24`, `completeCount=24`, `cleanupErrors=[]`.
- `l2-cleanup-manifest.json`: `business=PASS`, `cleanup=PASS`, `firstFailure=null`, `cleanupErrors=[]`.
- `l2-join-artifact.json`: `joinStatus=COMPLETE`, `caseCount=24`, `caseOutcome PASS=24`, `result passed=24`, `joinStatus COMPLETE=24`, `missingDeclaredControlKeyCount=0`, `invalidCaseScopedEventCount=0`.
- `repository-byte-binding.json` present under same run directory.

Judgment: L2 candidate is internally coherent and user-visible case evidence exists, but cannot erase source-level contract/response violations.

### reset / DEV / r5-full seed

- reset `.runtime/r5/reset/r5-reset-6c287aa8-66a8-4fa3-8c40-02b59edea81f/run-manifest.json`: `business=PASS_DATABASE_ABSENT_READBACK`, `cleanup=PASS_NO_PERSISTENT_RESET_PROCESS`, `firstFailure=null`; `reset-events.jsonl` includes `RESET_MANIFEST PASS`, `MANAGED_DEV_OWNERSHIP PASS`, `MANAGED_DEV_STOP PASS`, `REMOTE_DATABASE_READBACK PASS`.
- DEV `.runtime/r5/run-manifest.json`: `kind=r5-dev-run-manifest`, `runId=r5-dev-1788017756650-92005-39aa1fef-2581-47c6-894c-ac1f64da62ea`, topology `REMOTE_TRUSTED_HOST / REMOTE_LOCALHOST / HTTP_AND_ASSET_ONLY`, readiness contains remote Java identity and two local Vite process identities.
- parent seed `.runtime/r5/seed/complete/complete-seed-f050f7f3-2e5b-4ad6-9702-b907c1badf31/seed-report.json`: `business=PASS`, `cleanup=PASS_PRESERVED_DEV_STATE`, `firstFailure=null`; component `owner-command` cleanup `PASS_NO_PERSISTENT_SEED_PROCESS`, component `catalog-inventory` cleanup `PASS_PRESERVED_DEV_STATE`.
- catalog child `.runtime/r5/catalog-inventory/seed/catalog-seed-b59a4b3c-29ef-4a94-8094-ff2293115c74/seed-report.json`: `status=PASS`, `business=PASS`, `businessStatus=PASS`, `cleanup=PASS_PRESERVED_DEV_STATE`, `cleanupStatus=PASS_PRESERVED_DEV_STATE`, `apiCallCount=1265`, `reportedApiCallCount=1265`, `outOfScopeDatabaseEventCount=205`, `endpointGroupCount=31`, unmatched HTTP/DB events empty.
- owner child `.runtime/r5/seed/r5-dev-1788017756650-92005-39aa1fef-2581-47c6-894c-ac1f64da62ea/seed-report.json`: `status=PASS`, `businessStatus=PASS`, `cleanupStatus=PASS_NO_PERSISTENT_SEED_PROCESS`, `apiCallCount=205`, `reportedApiCallCount=205`, unmatched HTTP/DB events empty.

cleanupStatus root-cause rejudgment: `REJECTED_WITH_EVIDENCE` for “cleanupStatus still aliases business/status in current catalog seed report.” Current source `scripts/dev/catalog-inventory-seed-executor.mjs:2885` sets cleanup separately, `:2893` passes `cleanupStatus: cleanup`, and `scripts/dev/catalog-inventory-seed-executor.test.mjs:10` asserts this binding. Current catalog child and owner child reports both carry cleanupStatus PASS variants. Residual note: parent renderer `scripts/dev/r5-complete-seed-executor.mjs:159-163` normalizes child markdown cleanupStatus from component cleanup; this is presentation-side and not counted as a current blocker because child JSON report remains correct.

### backend performance operation count

- `contracts/policy/backend-performance-operation-counts.json`: current authority is `operations=238`, `reads=102`, `commands=136`, `manual=true`.
- `scripts/test/backend-performance-operation-reconciliation.mjs`, `scripts/test/r5-remote-testcontainers.mjs`, `scripts/test/backend-performance-cp05-reclassification.mjs`, `scripts/generate/backend-performance-budget.mjs` import `BACKEND_PERFORMANCE_OPERATION_COUNTS.operations` rather than hardcoding `239`.
- `contracts/policy/backend-performance-cp05-calibration-report.json`: current file has `budget.readyCount=238`, `budget.blockedCount=0`, `budget.blocked=[]`.

Judgment: old CP05 `blockedCount=23` memory/context is stale for current bytes; current static evidence does not support keeping that as a finding.

## Findings

### [M1] CONFIRMED — Catalog closed-set lifecycle/static status fields remain naked `string` in the generated contract chain

Owning source:

- `doc/platform/backend-coding-standard.md:174-199`: response fields produced by Java enum/fixed constants/DB CHECK closed sets must be contract `enum`; response-side naked `string` must either be enum or explicitly exempted.
- `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:176-183`, `:454`, `:619-627`: base-1 specifically requires response contract enum before frontend dictionaries can be exhaustive; catalog static labels/status are not the benchmark to copy as backend-fed vocabulary.
- `scripts/generate/catalog-inventory-p1.mjs:2477`, `:2839-2844`, `:2867-2871`, `:3150`, `:3167`, `:3189`, `:3814`, `:3926`, `:3971`, `:4051`, `:4068`, `:4217`: generator still emits multiple catalog lifecycle/static-set statuses as `stringField(...)` instead of enum schemas.
- `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts:134-150`, `:173`, `:194`, `:207`, `:227-228`: generated frontend contract exposes productionTag/item/SKU/dictionary/copy/inventory statuses and two transition `targetStatus` fields as `string`.
- `apps/backend/catering-business-server/build/generated/sources/catalog-inventory-p1/main/java/com/catering/v2s/app/edge/generated/wire/CatalogItemDetail.java:8`, `:11-12`, `:22-24`, `:35-37`, `:44`, `:47`, `:65-78`, `:90-94`, `:117`; `CatalogItemSkuPage.java:6-20`; `CatalogDictionaryView.java:4-7`; `ProductionTagReadback.java:4-5`; `CatalogDictionaryEntryTransitionRequest.java:4`; `ProductionTagTransitionRequest.java:4`: generated Java wire still carries `String status` / `String targetStatus`.

Falsifiable failure condition:

- Add or typo a lifecycle/static-set value in owner output, e.g. a catalog item/SKU/dictionary/production-tag status that is not `ENABLED | DISABLED | VOIDED`, or a production tag status not covered by the frontend dictionary. Current generated TS still accepts `string`, so TypeScript does not fail and UI can silently render raw/unknown codes. This reproduces the exact base-1 failure mode: backend owns a closed set but the consumer cannot get compile-time exhaustiveness.

Minimum fix:

- Fix the generator/schema source (`scripts/generate/catalog-inventory-p1.mjs` and the produced OpenAPI/TS/Java outputs) so every response/request field whose values come from catalog code constants, lifecycle CHECKs, shape manifest static enum sets, or owner fixed sets is represented as an enum with the exact value set or has a narrow documented exemption. Regenerate the catalog wire and add a reverse exact-set check/red mutation equivalent to backend standard 1-O.

Why smaller alternative is insufficient:

- Editing generated TS/Java directly is forbidden and will be overwritten.
- Adding frontend fallback labels for `string` preserves the silent failure; the compiler still cannot force dictionary coverage.
- Only fixing transition request `targetStatus` leaves response-side statuses naked, which is the root base-1 problem.

Same-root scan:

- Frontend generated TS same-root scan found 22 export lines containing `status: string`, `targetStatus: string`, `blockedReasons`, or `blockingReasons` in catalog inventory generated surface; lines with naked status include 134, 135, 141, 143, 148, 149, 150, 151, 152, 153, 155, 156, 157, 158, 163, 164, 173, 194, 207, 227, 228.
- Backend generated Java same-root scan found 30 catalog P1 generated classes with `String status` or `String targetStatus`; not all are automatically violations, but no exact-set reverse gate or exemption inventory distinguishes code-defined closed sets from true business strings.
- Generator same-root scan found the concrete generator call sites above; selected positive counterexamples already use enum (`CatalogItemTransitionRequest`, batch item transition, unit/category/attribute/order-option readbacks), proving the generator supports enum and the remaining naked fields are not an unavoidable generator limitation.

### [M2] CONFIRMED — Catalog readback still returns backend-authored user-visible reason text instead of structured reason codes/facts

Owning source:

- `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:21-23`: backend returns business facts; frontend decides presentation/copy/order.
- `doc/platform/backend-coding-standard.md:101-123`: response values must not be backend-assembled presentation strings; review must judge response data flow, not mere keyword presence.
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java:6993-7023`: `TemporaryPromotionPreflight.data.blockedReasons` contains backend-added strings including Chinese `"当前商品不是外部订单临时商品"` and mixed raw codes.
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java:8311-8330`, `:8341-8347`, `:10292-10303`: item/SKU void availability appends Chinese labels such as `"包含规格"`, `"已设置条码与标识"`, `"已设置生产标签"`, `"被其他商品使用"`, `"已配置库存对象"`, `"已配置用料"`, `"当前状态不支持作废"`, `"被套餐内容使用"` directly into response body.
- `scripts/generate/catalog-inventory-p1.mjs:5003-5025`: generator self-test requires `blockingReasons[].label/count/relatedItemNames`, which codifies the backend text shape instead of requiring structured reason code + count + related identities.
- `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts:141`, `:154`, `:164`: generated frontend contract exposes `blockingReasons: Array<{ label: string; count: number; relatedItemNames: Array<string> }>` and `blockedReasons: Array<string>`.
- `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinatorCopySourceAuthorityTest.java:329-336`, `:406-429`, `:490-497`: backend tests assert exact Chinese labels like `"已配置用料"` and `"已配置库存对象"`.

Falsifiable failure condition:

- Change one backend label, locale, punctuation, or wording in `CatalogOwnerService`; the response contract and backend tests continue to treat that text as the API fact. The frontend cannot own copy or perform exhaustive code mapping because the API did not return a stable reason code/structured fact. Browser L2 can pass while the product has backend-owned UI copy embedded in readback.

Minimum fix:

- Replace backend-authored `label`/raw `blockedReasons` strings with structured codes and facts, e.g. `reasonCode`, `factKind`, `count`, `relatedItems[{itemRef, code, name}]` where names are actual entity facts and reason wording lives in frontend copy dictionaries. Update generator schemas, Java/TS generated wire, owner service, frontend mappers, tests, and add a red mutation that changing backend Chinese copy cannot be the contract oracle.

Why smaller alternative is insufficient:

- Merely renaming `label` to `reason` or adding a parallel `reasonCode` while still returning/using backend label leaves two sources of truth and keeps the backend presentation path alive.
- Frontend-side fallback mapping over backend labels is brittle and reverses the ownership: UI copy still depends on exact backend Chinese.
- Exempting this as `Problem.message` is incorrect: these are normal readback fields (`TemporaryPromotionPreflight`, `CatalogItemDetail`, `CatalogItemSaveReadback`), while base-1 explicitly deferred typed problem messages only.

Same-root scan:

- Temporary promotion: current response shape `blockedReasons: Array<string>` at generated TS line 154; owner emits 5 possible entries at `CatalogOwnerService.java:6994-7001`, including one Chinese sentence and four code-like values.
- Item void: current response shape `blockingReasons[].label` at generated TS line 141 and generated Java `CatalogItemDetail.java:102-108`; owner emits item-level labels at `CatalogOwnerService.java:8314-8330`.
- SKU void / save transition: current response shape `blockingReasons[].label` at generated TS lines 141 and 164 and generated Java `CatalogItemDetail.java:14-19`, `CatalogItemSaveReadback.java` generated shape; owner emits SKU labels at `CatalogOwnerService.java:10292-10303`.
- Existing frontend components consume `reason.label` in `CatalogItemGovernanceView.tsx`, `CatalogItemGovernanceEditor.tsx`, `CatalogItemEditorFieldPresentation.tsx`, and tests fixture exact backend labels, so this is not dead data.

## Non-findings / rejected hypotheses

- cleanupStatus still aliases business/status: `REJECTED_WITH_EVIDENCE`. Current catalog seed executor and reports keep business and cleanup separate as described above.
- operation denominator still 239/243 or CP05 blockedCount remains 23: `REJECTED_WITH_EVIDENCE` for current bytes. Current policy is 238 and current CP05 calibration budget has blockedCount 0.
- browser L2 candidate missing 24-case completion: `REJECTED_WITH_EVIDENCE`. Current join artifact has 24/24 complete/pass and cleanup PASS.
- `productionDisplayName` fields are automatically bad: `REJECTED_WITH_EVIDENCE` as a blanket claim. base-1 classifies entity names/display names such as `productionDisplayName` as business-defined names, not necessarily assembled strings; any concrete misuse would need field-level proof.

## Recommendation

NO-GO.

The current candidate evidence is stronger than the stale CP05 NO-GO context and the cleanupStatus root issue appears fixed in current catalog seed evidence. However, base-1 implementation cannot close while catalog generated contract/readback still leaves code-defined closed sets as naked strings and keeps backend-authored user-visible reason labels in normal response bodies. These are source-level violations that passing L2/seed/reset evidence does not negate.

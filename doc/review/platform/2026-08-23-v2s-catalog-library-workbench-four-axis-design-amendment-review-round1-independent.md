# 商品库工作台四轴设计修订 · Round 1 fresh independent DESIGN review

```text
REVIEW_CYCLE_ID=CATALOG_LIBRARY_WORKBENCH_DESIGN_AMENDMENT_20260823
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER=fresh-independent-codex-critic
DATE=2026-08-24
ARTIFACT=doc/review/platform/2026-08-23-v2s-catalog-library-workbench-four-axis-design-amendment-review-round1-independent.md
WRITE_SCOPE=this artifact only
DYNAMIC_ACTIONS=NONE
SOURCE_FIRST_EXPECTATION_FROZEN=true
AUTHOR_CONCLUSIONS_TRUSTED=false
AUTHOR_INTAKE_READ_AFTER_SOURCE_FIRST_AND_AUTHOR_DESIGN_REVIEW=true
DEXTER_2026_08_24_L2_CAPABILITY_ADDENDUM_INCLUDED=true
```

## 0. Verdict

```text
VERDICT=NO-GO
M/S/N=1/0/1
L1_ENGINEERING=findings
L2_USER_VISIBLE=PASS_STATIC_DESIGN
L3_UNVERIFIED=non-empty
BUSINESS_RESULT=FAIL_DESIGN_REVIEW
CLEANUP=NOT_APPLICABLE_STATIC_ONLY
```

现稿在四轴主体上已经显著可实施：八条 Journey 的成功/失败/恢复闭合，contract/owner/generated RTK/frontend/foundation 的控制权边界清楚，当前 L2 状态也如实标为 `NOT_READY` 而非 PASS；并且在 Dexter 2026-08-24 追加要求中的大部分 L2 能力建设项，详设与串行计划都已纳入本批实施。

但本轮必须 `NO-GO`，因为 Dexter 新增的必查项包含 `secret 注入`，而我在现稿中未找到 runner secret 的来源、注入边界、允许字段、缺失/额外 secret 的 fail-closed 判据或 red mutation。这个缺口会迫使实施者在 `scripts/test/browser-l2` 内自行猜测远端 middleware、HTTP/asset tunnel、浏览器登录身份和运行命名空间凭据如何传递，属于受管 L2 能力建设的阻塞性设计缺项。

本结论不表示当前 L2 已执行；本轮没有运行测试、DEV、reset、seed、browser L2、UAT、migration、部署或任何数据动作。

## 1. Blind-review declaration and reading order

我先读取项目入口、授权、review skill、memory kernel/routed memory、frontend/L2/foundation/owning source，并在读取作者设计前冻结四轴独立预期；随后才读取待审正式需求、Journey、交互、IA、implementation-facing 详设、串行计划与线框；最后才读取作者 intake。作者 intake 只作为“作者如何处置旧 finding”的被审输入，不作为结论来源。

`project-memory/index.md` 的六维路由补充说明：`owner=catalog` 与 `impact=ui` 两类非规范参数被脚本拒绝；我改用 `review/admin-ui/operations-admin/product/evidence`、`review/contract/operations-admin/backend/contract`、`testing/admin-ui/operations-admin/platform/evidence` 等可解析组合读取命中原文。该路由失败没有阻断审查，因为 AGENTS 要求的 kernel、deterministic decision、业务语料、review governance、backend acceptance 与相关 practices 已重开。

## 2. Minimal inputs and hashes

### 2.1 Entry, governance, skills, templates

| path | sha256 / status |
| --- | --- |
| `AGENTS.md` | `5cbcb4984ffe19d664192b0cbd9ccea3dde28e37eb26cb6fb552a2a6e1ce5820` |
| `CLAUDE.md` | `ef611507ceadff37484cb51692413fb61af364170a60f2c3df061b263fb6e2e4` |
| `PLATFORM-BLUEPRINT.md` | `b5b9b5110c9e7d8642b81ea885cbe8580aef2e1f042c710dc5bce590538f6fe7` |
| `doc/platform/README.md` | `d358e49c83726528690a9d05aa9f6a1979a0f9d2051fd56ef9db4ff98b573c7f` |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` |
| `project-memory/decisions/deterministic-context-only.md` | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` |
| `project-memory/index.md` | `d76f92a21337ddccd5a642c5853de93dd1b45608d80a982bdd2a2bb3c4f1e0c5` |
| `scripts/README.md` | `a7c0ccc893779729119fd0df9bd74d79f89d8680426b54fa11cba7446271d90b` |
| `.agents/skills/cs-review/SKILL.md` | `5533b184854b47441e41f549a10724cc3ec5b0eea76a7fbf907a4022e34b3c42` |
| `.agents/skills/cs-managed-runtime-execution/SKILL.md` | `fb949a17f2d1da846a2514b17d29ac1f9fe6e8a836806ba1df67753c93b1712d` |
| `doc/platform/review-standard.md` | `31dad2139bae7fec8d3891a66069c3c225ef63f7520993a45ca8f10a8783775a` |
| `project-memory/operations/verification-governance.md` | `3094cf61cea315208323f7d3f9266f719ea6ca9d828094378ede375dfe9f3005` |
| `doc/decisions/templates/journey-decision-template.md` | `57a99ca1fea405cd04857779b0661c7fcfed66b9f5095450f2cd73cc8441230d` |
| `doc/decisions/templates/ui-interaction-design-template.md` | `75cb8c22042f2d9e0f8a8b121e96952d226a7efc4e73184d2b75ecfd8e642e51` |
| `doc/decisions/templates/ia-design-template.md` | `062925f8aa4b3446e06e74d8bad4166f3b3b3e8b18ebe403df7184acd5cd358f` |
| `doc/decisions/templates/implementation-design-template.md` | `2dbe4071db0b3489a0dffee9b7dae6cc293bd4b0b080b5d38751b489123b18f7` |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` |
| `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md` | `fee1f6a0417916d5fa6e38c2f5925c65eb2d26f9bb112d375216f96250ab0777` |
| `doc/platform/frontend-coding-standard.md` | `f11c5bb338ddcdef37568ee8ce379fbfb49cf17917e71590752808a5f6bbf3cd` |

### 2.2 Project-memory kernel and routed originals

| path | sha256 |
| --- | --- |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `ddef77ba39046171338d80a3d224080efe953f49bfc04775f2ac12b95796ec15` |
| `project-memory/decisions/http-crud-efficiency-design-redlines.md` | `96322a1fddb50ba4728288dce275fdc09e6462492456b2b039a52f68cfb3ff9c` |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `9d2903a17c1d71738f530fe00f0abdedf99b2d5370ce6219e63ce1fc082381f1` |
| `project-memory/operations/backend-acceptance.md` | `b5bca0ee74b93b3ac72b326512c07dd71c934430ee28b095ed8024c69d63d215` |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9` |
| `project-memory/operations/business-corpus-parked-domain-intake.md` | `739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e` |
| `project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md` | `8236548a682e0ec408b34d6a4d99c64b95fe784fbbda300ad6d84f8f379726b7` |
| `project-memory/pitfalls/platform-detail-reverse-inference.md` | `15d5751ddd44465e744b392095961ed4841e0d52cf7686e4447514e0d1383c4b` |
| `project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md` | `9e813c6dda2dcef77083db703fbfc7fe54530420def934a49f9b835228de08a6` |
| `project-memory/practices/backend-capability-lookup.md` | `5c5eeb1bf24a3605135d586e58c74f23411cc676c82b8193e6044b389e69c235` |
| `project-memory/practices/collection-boundary-modes.md` | `7e1b7c4bd9b568aaeac810a8e4b5ee2b03e89348ede83383d5d2e69f7d79b0b1` |
| `project-memory/practices/ordering-only-for-consumer-facing.md` | `b99739901809665421077bc973acd184854a8285f1b5e6e1b5f1d93eaa18c57f` |

### 2.3 L2/foundation/source inputs

| path | sha256 / status |
| --- | --- |
| `contracts/policy/catalog-inventory-l2-scenarios.json` | `b08c227fed27139086c503ba37f5fefa42058f64dc32d28b291a7d63f24bd930` |
| `contracts/policy/catalog-inventory-l2-execution.json` | `cf7ef517ef7e29fb7563e29a691686bfdf490a316e070c263cdb2dfeeca30e76` |
| `contracts/policy/catalog-inventory-fixture-catalog.json` | `3d81c403db7b2298c6a382e3faa6d602ddd9033add2c92d8cc33c65a44f6cb3e` |
| `contracts/policy/affected-l2-registry.json` | `c04f24a5775b788232d10bc7d6980be4b898c113e2f5eee67a147fac8288599f` |
| `scripts/test/catalog-inventory-l2-fixture.mjs` | `6c2819bf749aee6ae79880f8820056b8d39de88d82878412eb0aa12fc32535b8` |
| `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts` | `74480cedc28617fa9b96732d67f9e797ea48c672560452180f93d0e4fdab09e7` |
| `apps/frontend/operations-admin/playwright.config.ts` | `8c6146be7398a3b44fd7c8f253fb11e243a74c0fa8de2adb8b616a4a9746a01a` |
| `libraries/frontend/admin-ui-foundation/src/observability/safeLogger.ts` | `817de81f490ac11a4054df543218664a9def602c5dcc9b20d50dafc8a0f61549` |
| `libraries/frontend/admin-ui-foundation/src/rtk/observedBaseQuery.ts` | `MISSING_CURRENT_TREE` |
| `libraries/frontend/admin-ui-foundation/src/observability/observedBaseQuery.ts` | `d97847e67b95d01eed15973581977498b589477c3a87d56129bdddbb43b9eece` |
| `apps/frontend/operations-admin/src/features/catalog-management/**` | owning source read by symbol/path; individual files include `CatalogWorkbenchPage.tsx`, `CatalogItemCreateDrawer.tsx`, `CatalogItemDrawer.tsx`, `CatalogDictionaryDrawer.tsx`, `CatalogDefinitionLibraries.tsx`, `BrandCatalogCopyDrawer.tsx`, `LocalCatalogCopyDrawer.tsx`, model label/runtime files |

The prompt-specified `libraries/frontend/admin-ui-foundation/src/rtk/observedBaseQuery.ts` is absent in the current tree; the actual owning source is `libraries/frontend/admin-ui-foundation/src/observability/observedBaseQuery.ts`, which I read. This is recorded as input-path drift, not a design finding by itself.

### 2.4 Reviewed author artifacts

| path | sha256 |
| --- | --- |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md` | `adecbc13d7832d99e4c0bb087eca944c7a815dfc02bd7eba02ae31c89609175a` |
| `doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md` | `be9f4a1b6bca1046a0c298a0e5598d81905fabc2d920b67136d8816b3a5efbe1` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md` | `ec3349d4b53443ec8b942720be5bd7bfeaae5538fc3b8cee0917b165c423cef8` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md` | `eaa835da3f8201c6779703c1ec4bbf9a3a26c08e539e01491191b534e8608305` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md` | `f2f21308d8093c373fa72b7005ce47495b79aa0ef0f40b89ac50b8ec241fd385` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-serial-plan-codex.md` | `71bc222e5e7356db0aaa6a97809d9a7c71c0a0e4343ddfd582ee657e1e7fd71d` |
| `doc/plans/platform/wireframes/2026-08-23-catalog-library-workbench-and-view.svg` | `319b9b37638ecd3f20060b31a2ea753347f42f696af244e514b7bd0019780368` |
| `doc/plans/platform/wireframes/2026-08-23-catalog-library-edit-drawer.svg` | `330e5bdf25e7347fc666498e4992d8e0d1eb24c046e3d8fa76f53ab6e2aa1e2a` |
| `doc/plans/platform/wireframes/2026-08-23-catalog-library-config-drawer.svg` | `60548623fdb0faa1cbb673c653bfc23172f2ebf27826fc4bbba5720a3c4039cb` |
| `doc/plans/platform/wireframes/2026-08-23-catalog-library-batch-copy.svg` | `024a1ca8f1a036234e4029f607f8133fbf2575ebddbb003a0aa42f05f08114ff` |
| `doc/plans/platform/wireframes/2026-08-23-catalog-category-tree-select.svg` | `be57552fd378f9fbc96cae31780615f0748e528b388af00d8bbe4ffb1b8d0816` |
| `doc/review/platform/2026-08-23-v2s-catalog-library-workbench-four-axis-design-audit-intake-codex.md` | `c211f640e127a3d3d7275e8249a1a7757baa75897c161587c6d071c873354cb6` |

The user-specified glob `doc/plans/platform/wireframes/2026-08-23-catalog-library-*.svg` matches four SVGs. The interaction design also references `2026-08-23-catalog-category-tree-select.svg`; I read and hashed it because it is a reviewed design input.

## 3. Source-first expectation frozen before author design

### A. UI language and eight Journey outcomes

Expected before reading author design:

- All eight journeys must define success, failure, and recovery in user language, including the next action and focus recovery.
- User-visible copy must not expose internal terms such as raw enum, raw ref, owner/scope/contract/profile/effect/payload/readback/manifest/problem code/UUID; `SKU` must be replaced by “规格/规格编码/规格行” except in technical docs/test IDs.
- Current source has real counterexamples that the design must retire, including `catalogTabLabels.ts` with `SKU规格与价格`, `CatalogDictionaryDrawer.tsx` with `SKU 销售属性`, `CatalogItemDrawer.tsx` with `SKU 矩阵` / `套餐组件 SKU` / `SKU 图片上传失败`, `CatalogItemCreateDrawer.tsx` with `商品形态` and “按 SKU 维护规格和价格”, and `CatalogWorkbenchPage.tsx` with `无 SKU` / `SKU 明细加载失败`.

### B. Contract/owner/generated RTK/frontend control

Expected before reading author design:

- Contract declares route shape, closed enum, generated operation IDs, typed problems and read models.
- Owner calculates facts, candidate eligibility, action availability, readback, version/scope/admission and unchanged facts.
- Generated RTK only transports/caches typed responses and exposes `currentData`.
- Frontend owns draft, focus, dirty, task reducer, visual state and user-copy mapping; it must not recalculate owner facts.
- Current source counterexamples that need retirement include `acceptedPage` local server-page mirror, category candidates derived from flat `navigation.tree`, batch category flat/multi `Select`, and status/action/label branches based on raw enum values.

### C. Observability and diagnostics

Expected before reading author design:

- `safeLogger` / `createObservedBaseQuery` already provide request/correlation/trace IDs and redaction, but they do not by themselves connect `caseId/actionId/testId` to frontend request, backend HTTP completion, DB section rows, business oracle or cleanup.
- Design must add a falsifiable runner-level join and no-new-log rule, with firstFailure, lastKnownGood, brokenBoundary, redaction and separated business/local cleanup/remote DB cleanup/remote asset cleanup.

### D. L2 readiness and execution boundary

Expected before reading author design:

- Current L2 is static/framework-only: 18 scenario, 41 case, 0 active, 39 TEST dataset, no managed browser runner, no catalog-library affected registry entry.
- TEST fixture must remain isolated from DEV seed.
- Target design must add 24 active cases and 8 TEST fixtures for J-CATUI-01..08 success/failure/recovery, with action, user result, owner readback/unchanged, focus/recovery and diagnostic correlation.
- Per Dexter 2026-08-24 addendum, if L2 cannot run today, the design/serial plan must include the missing capability build in this batch: resource/identity preflight, per-run isolated remote DB + asset namespace, local Spring Boot + two Vite + Playwright, middleware/HTTP/asset tunnel, secret injection, readiness, TEST fixture setup/readback, 24 active cases, action/request/DB join, business oracle, local/remote cleanup readback and fail-closed profile activation.

## 4. Independent recalculations

### 4.1 USER_VISIBLE_COPY technical-term counterexamples

`USER_VISIBLE_COPY` lines in the reviewed interaction design were scanned for the forbidden/internal set `SKU, 预检, owner, ref, UUID, problem code, capability, grant, payload, readback, profile, effect, source, scope, contract, manifest, raw exception, ENABLED, DISABLED, ARCHIVED, shapeKey`.

```text
USER_VISIBLE_COPY_FORBIDDEN_TECHNICAL_TERM_COUNTEREXAMPLES=0
```

The retained phrases `商品元数据` and `当前结果域` match the Dexter-frozen exception documented in IA §5, and are not counted as technical counterexamples. Wireframe scan found `owner` only once inside a purple design annotation in `2026-08-23-catalog-category-tree-select.svg`; the interaction design explicitly says design annotations are not user interface copy, so it is not a user-visible-copy finding.

### 4.2 Cross-cutting mechanism rows

Implementation design §3 has exactly 17 cross-cutting mechanism rows:

```text
CROSS_CUTTING_MECHANISM_ROWS=17/17
ROWS=读侧节点授权;写授权与 grant 复核;跨 owner 写与事务;集合形态与分页;缓存失效 / 改完刷新什么;RTK 数据读取与加载判定;同一事实只有一个住址;失败可见且原因不得改写;owner 错误到 HTTP 的映射与注册处;幂等键构成与重放语义;该用生成物的地方不得手搓字符串;日志落点与脱敏字段;迁移回填与可逆性;前端共享行为;候选/下拉数据源;编码与名称呈现;会同时坏的东西是否已声明为原子组
```

### 4.3 Change anchors current hit counts

All 16 declared current-tree anchors in implementation design §9b are currently unique:

| # | file | anchor | hit count |
| --- | --- | --- | --- |
| 1 | `scripts/generate/catalog-inventory-p1.mjs` | `const OPERATION_CONTRACT_PATH =` | 1 |
| 2 | `scripts/generate/catalog-inventory-p1.mjs` | `const CATALOG_DATABASE_OPERATION_MAX = Object.freeze({` | 1 |
| 3 | `scripts/generate/catalog-inventory-p1.mjs` | `const catalogDefinitionSeed = {` | 1 |
| 4 | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java` | `JsonNode readNavigation(` | 1 |
| 5 | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogTaskReadService.java` | `public JsonNode navigation(` | 1 |
| 6 | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java` | `public JsonNode readCatalogNavigation(` | 1 |
| 7 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java` | `return readResponse(application.readCatalogItems(` | 1 |
| 8 | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx` | `function CatalogWorkbenchPage({` | 1 |
| 9 | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx` | `function CatalogSkuExpandedRow({` | 1 |
| 10 | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx` | `export function CatalogItemDrawer({` | 1 |
| 11 | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemCreateDrawer.tsx` | `export function CatalogItemCreateDrawer(` | 1 |
| 12 | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx` | `export function CatalogDictionaryDrawer({` | 1 |
| 13 | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDefinitionLibraries.tsx` | `export function CatalogDefinitionLibraries(` | 1 |
| 14 | `apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx` | `export function BrandCatalogCopyDrawer(` | 1 |
| 15 | `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java` | `id = "catalog.sku-removal-blocked-by-inventory"` | 1 |
| 16 | `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java` | `id = "catalog.copy-definition-semantic-conflict"` | 1 |

### 4.4 Current L2 baseline

```text
CURRENT_L2_SCENARIOS=18
CURRENT_L2_DECLARED_CASES=41
CURRENT_L2_ACTUAL_CASES=41
CURRENT_L2_ACTIVE_CASES=0
CURRENT_L2_MODE=FRAMEWORK_ONLY
CURRENT_TEST_DATASETS=39
CURRENT_SEED_DATASETS=6
RUNNER_PATH_EXISTS=false
AFFECTED_REGISTRY_HAS_OPERATIONS_CATALOG_LIBRARY=false
L2_EXECUTION_READY=false
```

Current policy case exact-set:

```text
CI-L2-001-01,CI-L2-001-02,CI-L2-001-03,CI-L2-001-04,CI-L2-001-05,CI-L2-001-06,CI-L2-002-01,CI-L2-003-01,CI-L2-004-01,CI-L2-005-01,CI-L2-005-02,CI-L2-005-03,CI-L2-005-04,CI-L2-006-01,CI-L2-006-02,CI-L2-007-01,CI-L2-007-02,CI-L2-007-03,CI-L2-007-04,CI-L2-007-05,CI-L2-007-06,CI-L2-007-07,CI-L2-008-01,CI-L2-008-02,CI-L2-010-01,CI-L2-010-02,CI-L2-011-01,CI-L2-011-02,CI-L2-012-01,CI-L2-012-02,CI-L2-013-01,CI-L2-013-02,CI-L2-014-01,CI-L2-014-02,CI-L2-015-01,CI-L2-015-02,CI-L2-016-01,CI-L2-016-02,CI-L2-017-01,CI-L2-017-02,CI-L2-018-01
```

### 4.5 Target 24-case exact-set

Implementation design §11b.3 declares exactly 24 target cases:

```text
TARGET_CASE_COUNT=24
TARGET_CASE_IDS=catalog-find-success,catalog-find-failure,catalog-find-recovery,catalog-view-success,catalog-view-failure,catalog-view-recovery,catalog-create-success,catalog-create-failure,catalog-create-recovery,catalog-edit-success,catalog-edit-failure,catalog-edit-recovery,catalog-config-success,catalog-config-failure,catalog-config-recovery,catalog-batch-success,catalog-batch-failure,catalog-batch-recovery,catalog-copy-success,catalog-copy-failure,catalog-copy-recovery,catalog-governance-success,catalog-governance-failure,catalog-governance-recovery
```

Coverage is exactly `J-CATUI-01..08 × success/failure/recovery`. Each row includes locator key group and business oracle; implementation design §11c.4 adds action/result/recovery detail and says write-case oracle must use owner HTTP readback for before/after or unchanged facts.

### 4.6 Target 8-fixture exact-set

Implementation design §11c.3 declares exactly 8 new TEST datasets:

```text
TARGET_FIXTURE_COUNT=8
TARGET_FIXTURE_IDS=FIXTURE-CATALOG-LIBRARY-FIND,FIXTURE-CATALOG-LIBRARY-VIEW,FIXTURE-CATALOG-LIBRARY-CREATE,FIXTURE-CATALOG-LIBRARY-EDIT,FIXTURE-CATALOG-LIBRARY-CONFIG,FIXTURE-CATALOG-LIBRARY-BATCH,FIXTURE-CATALOG-LIBRARY-COPY,FIXTURE-CATALOG-LIBRARY-GOVERNANCE
```

The design requires these datasets to be run-scoped `OWNER_COMMAND_FIXTURE`, setup/readback via owner HTTP commands, separated from DEV seed, with `preState/actionInput/expectedReadback/unchangedReadback`.

## 5. Four-axis review summary

### Axis A — user language and Journey success/failure/recovery

`PASS_STATIC_DESIGN`.

Evidence:

- Journey decision declares `J-CATUI-01..08`, user-language substitutions and “L2 is per-run TEST fixture with owner readback; DEV seed/old cases/static are not proof”.
- Interaction design declares 15 screen surfaces, USER_VISIBLE_COPY lines, an eight-Journey continuity matrix and failure/recovery copy baseline.
- IA §5 explicitly bans UI `SKU`, raw enum/ref/UUID/owner/scope/contract/profile/effect/payload/readback/manifest/problem code/raw exception; it allows business labels “商品编码、规格编码、条码、PLU、BOM” and freezes “商品元数据/当前结果域” only as the U-CATUI-06 exception.
- Current source technical-word counterexamples are named as implementation gaps to retire, not normalized as accepted UI.

No blocking finding on Axis A.

### Axis B — contract/owner/generated RTK/frontend control and state residence

`PASS_STATIC_DESIGN`.

Evidence:

- IA §2 has exactly three state residences: server facts in generated RTK `currentData`, whole-item draft in `useCatalogItemDraft`, UI transient state in task reducer/component/hook.
- Implementation design §5.1.1 separates `CORE_CROSS_SCOPE_ASSERTION_SET=6`, `UI_SCOPED_OPERATION_READS=15`, `PUBLIC_NON_SCOPED_ASSET_READS=1`, `UI_READ_CONSUMERS=16`.
- Implementation design §5.2 lists 33 UI mutation variants and excludes four inventory management writes as out of scope.
- Implementation design §9b declares and current tree verifies 16/16 unique change anchors.
- It explicitly retires `acceptedPage`, multiple first-layer open booleans, flat category inference, View/Edit shared tree and index identity.

No blocking finding on Axis B.

### Axis C — logs, first failure, no-new-log, request/HTTP/DB join

`PASS_STATIC_DESIGN_WITH_L3_UNVERIFIED`.

Evidence:

- Current foundation sources provide `safeLogger` redaction and `createObservedBaseQuery` request/correlation/trace headers plus completion/failure events.
- Implementation design §11d defines `action-request-join.jsonl` with `runId, caseId, stepId, actionId, testId, actionWindowId, requestKind, method, routeTemplate, generatedOperationId, requestId, correlationId, traceId, frontendEventId, backendPhase, databaseOperationCount, sectionCounts, outcome`.
- It defines expected-event/no-new-log behavior and immediate `NO_NEW_EVENT:<source>` / `LOG_NOT_AVAILABLE:<source>` outcomes.
- It requires firstFailure, lastKnownGood, brokenBoundary, stage heartbeat and separate business/local cleanup/remote DB cleanup/remote asset cleanup.

No blocking finding on Axis C by itself. Dynamic proof remains L3-unverified.

### Axis D — current L2 truth, target cases/fixtures, managed runner and cleanup

`FAIL_DESIGN_REVIEW_DUE_TO_SECRET_INJECTION_GAP`.

Evidence of coverage:

- Current L2 truth is accurately stated as 18/41/0 active, 39 TEST datasets, `FRAMEWORK_ONLY`, no browser runner and no affected registry mapping.
- Implementation design §11c.2 and serial plan CP-10 place the missing browser L2 runner, existing Playwright spec/policy/fixture chain, local Spring Boot + platform-admin Vite + operations-admin Vite + Playwright, middleware/HTTP/asset tunnel, per-run remote DB/asset namespace, TEST fixture setup/readback, 24 active cases, diagnostic join, cleanup and fail-closed activation into this batch's implementation work.
- Implementation design §11d covers resource-preflight/process-start/tunnel-ready/fixture-setup/browser-execution/artifact-join/business-verification/cleanup phases and red mutations for requestId join, DB row, heartbeat, lastKnownGood/brokenBoundary and cleanup.

Blocking counterexample:

- A read-only search over the implementation design, serial plan, managed-runtime skill and AGENTS for `secret|密钥|credential|凭据|环境变量` found no design section that declares browser L2 secret injection. The only relevant matches are redaction/sensitive-field exclusions and “注入 detail 读取失败” style test fault injection, not runner secret source/injection.

## 6. Finding

### M-001 — Browser L2 runner design omits secret injection contract

```text
severity=M
status=CONFIRMED
axis=D
```

Owning source evidence:

- Dexter 2026-08-24 addendum requires this review to verify that the detailed design and serial plan cover `secret 注入`.
- AGENTS.md requires managed dynamic boundaries to preserve run-scoped manifest/logs, process identity, tunnel identity and redacted diagnostics; it also forbids logging password/hash/OTP/token/cookie/Authorization/raw payload and similar secrets.
- `.agents/skills/cs-managed-runtime-execution/SKILL.md` says managed browser L2 uses local Spring Boot, local web apps and local Playwright with one isolated remote DB/asset namespace per run, manifest/logs and both-side cleanup.
- Implementation design covers runner topology, namespace, tunnels, readiness, fixture setup/readback, action/request/DB join and cleanup, but there is no `secret` / `密钥` / `credential` / `凭据` / `环境变量` section defining how credentials/secrets are injected.

Counterexample:

- An implementer can create `scripts/test/browser-l2` with all visible phases present, but choose arbitrary environment variables or shell exports for remote DB/asset namespace credentials, tunnel credentials, browser login identity, HTTP base credentials or asset access credentials. The current design would not say whether that is allowed, what is missing, what is extra, what must be redacted, or when the runner must fail closed. That violates Dexter's addendum and makes the runner not safely actionable.

Minimal fix:

1. Add a `SECRET_INJECTION` subsection to implementation design §11c/§11d and serial plan CP-10.
2. It must name the exact existing managed secret source or helper to use; if none exists, it must define the new capability-named runner-local secret adapter as part of `scripts/test/browser-l2`, not as app/business code.
3. It must list the finite allowed secret classes and injection targets: remote DB namespace provisioning, remote asset namespace provisioning, middleware/HTTP tunnel, asset tunnel, local Spring Boot runtime, local platform-admin Vite, local operations-admin Vite, Playwright login/session setup.
4. It must define manifest representation as presence/digest/identity metadata only; no raw secret, credential, token, cookie, Authorization, signed URL, password, account login name or raw environment dump may be written.
5. It must define fail-closed behavior for missing, malformed, stale, extra or cross-run secret material before `fixture-setup`, and cleanup behavior for any temporary secret/session material owned by the run.
6. It must include red mutations: remove one required secret, add one undeclared secret, leak one secret-shaped field into manifest/log/join artifact, reuse a prior run secret/session, and provide a secret for the wrong namespace; each must fail before browser business claims.

Applicability boundary:

- Applies only to managed browser L2 capability construction for this batch and later use of `scripts/test/browser-l2`.
- Does not authorize executing browser L2, DEV, reset, seed, UAT, Testcontainers or any data action.
- Does not require adding product-facing secret UI, changing business contracts, or logging raw secrets.

### N-001 — Prompt-specified observedBaseQuery path drift

```text
severity=N
status=CONFIRMED_INPUT_DRIFT
axis=C
```

The required path `libraries/frontend/admin-ui-foundation/src/rtk/observedBaseQuery.ts` is absent; the current owning source is `libraries/frontend/admin-ui-foundation/src/observability/observedBaseQuery.ts`. I read the actual source and used it for Axis C. This should be corrected in future review prompts or path rosters so reviewers do not accidentally treat a missing path as “not read”.

## 7. Same-root scan and representative task simulation

### Same-root scan

- Technical user copy: design `USER_VISIBLE_COPY` forbidden terms = 0; current production source still contains same-root counterexamples and the design explicitly retires them.
- State residence/control: same-root examples `acceptedPage`, multiple open booleans, View/Edit shared `CatalogItemDrawer`, flat category selector and enum-driven labels are all named in the design as target removals.
- L2 runner capability: same-root scan across implementation design, serial plan, AGENTS and managed-runtime skill shows all Dexter addendum items covered except secret injection.
- L2 policy/fixture/spec: current single chain is 18/41/0 active/39 TEST datasets and no runner/affected mapping; design extends the same chain to 26/65, active 24 and 39→47 TEST datasets without creating a second L2 framework.

### Representative task simulations

1. Category TreeSelect implementation:
   - Executor starts from CP-01/02/05, can find the new category candidate operation, `usage` enum, `path/selectable/disabledReason`, four consumer scenarios and owner recheck rules.
   - They do not need to guess whether to use flat navigation or UI-calculated leaf/descendant logic; the design says that is forbidden.
   - Actionable.

2. Parent/SKU same-table implementation:
   - Executor can find the new `getOperationsCatalogItemSkus` cursor read, parent `hasSkuChildren/summary`, AntD Table tree-data target, no `expandedRowRender`, no SKU selection, parent total unchanged, and L2/focused proof expectations.
   - Actionable.

3. Managed browser L2 runner implementation:
   - Executor can find local Spring Boot / two Vite / Playwright topology, tunnel, remote DB/asset namespace, fixture setup/readback, action-request-DB join, cleanup, fail-closed active profile and 24 active cases.
   - Executor cannot find the secret injection contract. They would have to invent how credentials and per-run secret material enter and are redacted by the runner.
   - Not actionable until M-001 is fixed.

## 8. L3 unverified / not authorized list

These are not findings by themselves; they are the correct evidence boundary for this DESIGN review:

- Browser L2 has not been executed.
- The current tree remains `FRAMEWORK_ONLY` with 0 active cases.
- The target `scripts/test/browser-l2` runner does not exist yet.
- 24 target cases and 8 TEST datasets are design exact-sets, not implemented or run evidence.
- No DEV, reset, seed, Testcontainers, browser L2, UAT, migration, deployment or data action was run.
- No compile/typecheck/focused/acceptance command was run in this review because the user explicitly limited this task to design review and one artifact write.
- L2 business/local cleanup/remote DB cleanup/remote asset cleanup are design obligations only until implementation and separate dynamic authorization.

## 9. Required amendment before Round 2 / GO

To convert this review to GO, update only the design/plan artifacts in a future authorized author session:

1. Add the browser L2 `SECRET_INJECTION` contract described in M-001 to implementation design and serial plan.
2. Keep the current fail-closed stance: dynamic execution still requires separate Dexter authorization after capability readiness.
3. Preserve all existing exact-sets: 17 cross-cutting rows, 16 unique anchors, 24 active cases, 8 TEST datasets, 18/41 old baseline retained into 26/65 target, and 39→47 TEST dataset target.

After that amendment, Round 2 should specifically re-scan `secret|密钥|credential|凭据|环境变量|Authorization|cookie|token|signed URL|asset tunnel|HTTP tunnel` across the amended design/plan and check the red mutations are precise enough for an implementer to build without guessing.

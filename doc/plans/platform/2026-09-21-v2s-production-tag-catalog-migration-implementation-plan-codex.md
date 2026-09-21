SKILL_USED=cs-spec-to-plan@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# ProductionTagDefinition 迁入 catalog：实施计划

> 本文已在 Claude 当前字节 DESIGN review 的十项 finding（2M/4S/4N）全部修订并经主 agent 一致性自审后进入实施授权。当前授权覆盖生产代码、契约/生成物、迁移、测试、fixture、seed、受管 backend acceptance、reset 与 DEV；Browser L2、UAT、部署仍未授权，Git 始终由 Dexter 控制。本计划不做旧数据迁移：reset 后由 catalog seed 重建全部目标事实。

## 0. 依据、目标与边界

- 详设正本：`doc/plans/platform/2026-09-21-v2s-production-tag-catalog-migration-implementation-design-codex.md`。
- 模板正本：`doc/decisions/templates/implementation-design-template.md`、`doc/platform/implementation-task-template.md`。
- 用户目标：将 `ProductionTagDefinition` 作为 `catalog` 原生实体，删除 `fulfillment-production` 业务模块及其活动 owner；用户已明确当前数据全部 reset，再由新 seed 重建，因此本计划不包含旧 tag、商品引用或 receipt 的数据迁移和连续性保证。
- 保留的业务语义：生产标签名称、编码、三态生命周期、未作废范围内编码唯一、scope/grant、版本并发、幂等、锁、typed problem、商品单标签引用、品牌复制、停用既有绑定回显和现有 operations-admin 交互。
- 不做：把生产标签并入 `catalog.dictionary_entry`；新增 route/path/operation；新增用户控件；旧数据复制、旧 UUID 连续性、旧 receipt 回放连续性；生产路由、KDS、打印、队列或履约任务。
- 当前动态边界：本文件不运行任何命令。后续即使获得实施授权，仍需按受管 runtime、business/cleanup 分离、首败诊断和动态授权执行。

## 1. 全批顺序与依赖

```text
CP-00 只读分母/RECALL/一致性基线
  ├─ CP-01 契约源与生成链
  ├─ CP-02 reset-first Flyway 目标结构
  ├─ CP-03 catalog 后端 owner 与 edge wiring
  ├─ CP-04 前端生成消费者与活动设计记忆
  └─ CP-05 测试、fixture、seed、check、L2 闭环
          ↓
CP-06 步骤级/全批三维对账 + 逐代码与详设对账
          ↓
当前授权范围：focused static/compile → backend acceptance → reset → DEV → seed → 交付 IMPLEMENTATION review brief
```

CP-01、CP-02、CP-03、CP-04 的代码修改不得在 CP-00 的分母未冻结前开始。CP-02 的目标 SQL 形状必须先冻结，CP-03 才能把 persistence 迁入目标表；CP-05 必须覆盖所有前述产物。每个 CP 完成后、进入下一个 CP 前，由 fresh 独立子 agent 做需求/详设与 IA/项目规范三维对账；有 `OPEN` 就根因修复并重新对账。

## 2. CP-00：只读分母与 reset-first 基线

### 输入

- 本详设 §0.1、§9a、§10b、§11。
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/backend-coding-standard.md`、`doc/platform/frontend-coding-standard.md`。
- `project-memory/decisions/deterministic-context-only.md`、`project-memory/practices/backend-capability-lookup.md`、`project-memory/decisions/owner-read-model-and-lifecycle-standard.md`、`project-memory/decisions/confirmed-business-language-corpus.md#CIPG-01`。
- current owning source：旧 owner API/service/persistence/SQL、catalog coordinator/owner/copy/item、四个 operation path、生成器、前端消费者、seed/test/check/L2。

### 动作与可观察结果

1. 按详设 §9a.1 冻结的扫描命令 `rg -l -i --glob '!**/build/**' 'production.?tag|fulfillment.?production'` 和路径范围，扫描 `fulfillment-production`、`fulfillment_production`、旧 Java package、`ProductionTagOwner*`、四个 operation owner、旧 schema/table、旧 frontend fallback，分为 active source、generated、seed/test/check、historical-only。构建目录不进入活动源码分母。扫描结果必须逐文件列出完整文件名和原因，不用“全仓零命中”替代分桶；任何未分类文件使本 CP OPEN。
2. 打开所有 owning source，确认当前履约生产模块只有生产标签业务实体，`command_receipt` 只是该实体的支撑表；若发现第二个有独立 owner/消费者语义的实体，停止并上报。
3. 只读核对 reset 会重放历史 Flyway、目标 migration 会删除旧表/schema、seed 的正本和 executor 会重新生成新的 tag/ref/receipt。不得建立旧行 hash、旧 receipt collision、旧 UUID continuity 分母。
4. 冻结 operation identity：`getOperationsProductionTags`、`createOperationsProductionTag`、`updateOperationsProductionTag`、`transitionOperationsProductionTagStatus` 的 path/method/face/capability/query/wire 不改。

### 本 CP 完成判据

- active/historical 分桶有完整清单；旧 owner 允许出现的历史路径有明确理由。
- reset-first 顺序明确为：reset/Flyway 目标结构 → 目标表空态检查 → catalog seed → owner readback。
- 未修改任何文件、未执行动态动作。
- fresh 步骤级三维对账为 `MATCHED`。

## 3. CP-01：契约源、owner registry 与生成链

### 修改源与精确范围

| 类别 | 修改源 | 必须达到的结果 |
| --- | --- | --- |
| HTTP path | `contracts/openapi/paths/operations-admin/production-tag-management.paths.json` | 四个 operation 的 `x-owner-module` 改为 `catalog`；path/method/operationId/face/capability/context 不变 |
| schema | `contracts/openapi/components/fulfillment-production/production-tag.schemas.json` | 迁为 `contracts/openapi/components/catalog/production-tag.schemas.json`；schema shape、status 三态、problem wire 不漂移 |
| edge | `contracts/catalog/catalog-inventory-edge-placement.json`、`catalog-inventory-edge-contract.json` | owner/initiatingOwner/target 改为 catalog；既有 edge placement 保持 |
| RTK/shape | `contracts/catalog/catalog-inventory-rtk-tag-policy.json`、`catalog-item-editor-manifest.json` | 只改 owner metadata；query identity、invalidates、fields、loading/lifecycle 不变 |
| bindings/governance | `contracts/registry/operation-handler-bindings.json`、`contracts/registry/iam-org-governance-manifest.json` | owner 与 adapter namespace 改为 catalog；公共 operation/problem code 不改 |
| generators | `scripts/generate/catalog-inventory-p1.mjs`、`scripts/generate/operation-handler-bindings.mjs`、`scripts/generate/catalog-inventory-workspace-command-tokens.mjs`、`scripts/generate/backend-performance-m1-command-execution-bindings.mjs`、P3 frontend generator、capability owner maps | catalog 成为唯一 active owner；旧 module 不留在 active allowlist；workspace token 与 backend-performance M1 生成器的 owner/import/class namespace 和三个 production-tag command token 一并改为 catalog |
| generated | OpenAPI aggregate、edge route、Java/TS wire、catalog operation binding、workspace command-token Java、RTK、shape/editor manifest、governance output | 只在源修改后重新生成；禁止手改生成物 |

### focused proof（未来实施）

- catalog positive mutation：四个 source entries 生成到 catalog owner/package/shard。
- old-owner red mutation：任一 path owner、schema shard、binding namespace、workspace token owner/gate、generator allowlist 保留 `fulfillment-production` 时，source/check 必须失败。
- exact-set proof：旧生成 owner 文件被移除，新的 catalog generated owner 文件存在且 operation identity 数量仍为四。
- GET negative proof：`getOperationsProductionTags` 保留 coordinator-owned read 语义，不进 command-adapter 集合、不创建/调用 `GetOperationsProductionTagsOperation.java`；三个 command 必须各有实际 catalog adapter class。对 GET 增加 command 集合或删除任一 command class 的 red mutation 必须失败。
- 生成后重新读 source 与 output，不能仅看生成命令 exit code。

### 闭包等级

`NECESSARY_NOT_SUFFICIENT`。它抓不到 Java 运行时是否真的注入 catalog owner、SQL 是否写到目标表、seed 是否读取新 owner；这些由 CP-03/05 和独立 review 补足。

## 4. CP-02：reset-first Flyway 目标结构

### 目标迁移

新增版本号必须在实施开始前重读 migration 目录后确定，不能预先假定冲突版本。新增 migration 只做以下事情：

1. 创建 `catalog.production_tag_definition`：`tag_ref` 主键、`data_node_ref`、`brand_ref`、`code`、`name`、`status`、`version`、created/updated timestamps；不含退役的 `tag_kind`；status check 为 `ENABLED/DISABLED/VOIDED`；未作废 `(data_node_ref, brand_ref, code)` partial unique index；保持现有查询索引形态。
2. 创建空的 `catalog.production_tag_command_receipt`：`receipt_ref`、data node、idempotency key、operation id、request hash、nullable `response_json`、created timestamp；唯一键仍为 `(data_node_ref, idempotency_key)`。
3. 删除 `fulfillment_production.production_tag_definition`、`fulfillment_production.command_receipt` 和空的 `fulfillment_production` schema。不得 `INSERT ... SELECT`，不得按 code/UUID 映射，不能读取旧行或旧 receipt。
4. 在同一 migration 事务内检查目标表/索引/约束存在、旧表/schema 不存在；不检查旧数据 count/hash，因为 reset 已明确丢弃旧数据。
5. reset 完成后先观察目标表为空，再进入 seed；seed 之后由 readback 检查 fixture 与新生成 tag/ref/status/version。

### 未来验证

- migration integration/Testcontainers：目标 DDL、约束、索引、旧 schema drop、target empty-before-seed。
- red mutation：重新引入 `tag_kind`、漏掉 VOIDED partial unique、保留旧 schema、把 target receipt 合并 generic receipt，均应被 migration/static check 或 focused schema assertion 拦住。
- 失败边界：Flyway/DB first failure 必须保留日志和 cleanup；不得通过旧 schema fallback 继续 seed。

### 闭包等级

`NECESSARY_NOT_SUFFICIENT`。目标 schema 正确不证明 owner Java/contract/seed readback 正确；reset 后 seed 与 CP-05 补足。

## 5. CP-03：catalog 后端 owner 与 edge wiring

### 迁移/删除的代码全集

| 当前文件/符号 | 目标动作 |
| --- | --- |
| `modules/fulfillment-production/.../api/ProductionTagOwnerApi.java` | 迁为 `modules/catalog/.../api/CatalogProductionTagOwnerApi.java`，records/problem 语义保持 |
| `.../application/ProductionTagOwnerService.java` | 迁为 `CatalogProductionTagOwnerService.java`；保留 scope/grant、version、status、idempotency、lock、copy/preflight、readback |
| `.../application/ProductionTagTaskReadService.java` | 迁为 catalog application task read；继续由 catalog owner 提供 |
| `.../application/persistence/ProductionTagOwnerPersistence.java` | 迁为 catalog persistence；只读/写新 catalog 表 |
| `.../application/persistence/ProductionTagOwnerServiceSql.java` | 迁为 `CatalogProductionTagOwnerServiceSql.java`；SQL 只出现目标表/receipt |
| `src/main/.../operations/CreateOperationsProductionTagOperation.java` | 迁为 catalog operation adapter |
| `src/main/.../operations/UpdateOperationsProductionTagOperation.java` | 迁为 catalog operation adapter |
| `src/main/.../operations/TransitionOperationsProductionTagStatusOperation.java` | 迁为 catalog operation adapter |
| GET binding metadata | 明确为 coordinator-owned metadata-only binding；不凭空新增 `GetOperationsProductionTagsOperation.java`，controller 继续经 coordinator GET；生成器不把 read adapter 字段当成待反射 Java class |
| `CatalogInventoryCoordinator` | old API import/field 改 catalog API；read/copy call chain不改 |
| `CatalogWorkbenchReadService` | navigation 改 required catalog API 并删除 `null → []`；item preparation 只迁 API/package 与既有 typed problem；reference-count/read-model 保留 `CatalogWorkbenchReadPersistence.readProductionTagReferenceCounts` 的 catalog item-reference 查询，不改走 tag owner API；前两条输出 owner 改 catalog，第三条保持原 read breakdown |
| `CatalogOwnerService`、`CatalogCopyService`、`CatalogItemService` | old API/problem/reference guard 改 catalog API；商品规则与事务不漂移 |
| `ContractProblemAdvice` | 映射 `CatalogProductionTagOwnerApi.Problem`；公共 problem code 不变 |
| `OperationsCatalogInventoryController` | 保持 route/wire；generated binding 改 catalog metadata；GET 仍只走 coordinator |
| `ProductionTagOwnerPersistence` lock namespace | `:122`、`:205` 的 `"production-receipt:" + scope` 与 `:364` 的 `AdvisoryLock.acquire` 三处都改为 `catalog-production-receipt`；通用 `foundation/persistence/AdvisoryLock.java:20-22` 定义排除；reset-first 不要求锁标识连续，static/behavior test 同时拒绝漏改任一活动形态 |
| `modules/fulfillment-production/build.gradle.kts`、root settings、app/catalog Gradle dependencies | 删除旧模块声明和依赖；catalog 自洽拥有所需依赖 |

`TransitionOperationsProductionTagStatusOperation.java` 当前是 active application edge source：它调用旧 production-tag API 做状态变更，同时调用 `CatalogOwnerApi` 做商品引用 guard。迁移后两者均为 catalog-local API；assertion matrix 必须为 `initiatingOwner=catalog`、`coordinatedOwners=[]`。不得把 catalog 自身登记成第二 owner 或保留跨 owner command 叙述；实现可保留两次 catalog-local API 调用，但必须保持 reference guard、status readback 与 REQUIRED 事务事实。

### 禁止误做

- 不在 catalog 内再创建一个“production module”子模块；catalog 直接拥有该实体。
- 不让 catalog 通过自己的另一个 public module API 写自己；owner service 直接完成自身事实与 readback。
- 不因为迁移而改变 `CatalogInventoryCoordinator` 的读非事务、command `REQUIRED`、scope recheck、typed problem、幂等锁或 brand copy 原子性。
- 不把 controller GET 的 registry metadata 误当作需要新增 Java read adapter；该 metadata-only 例外只适用于这个 coordinator-owned GET，不适用于三个 command adapter。
- 不允许 navigation 将 owner wiring 缺失降级为空 production-tag 列表；item preparation 保留 typed problem；reference-count/read-model 必须继续走 catalog persistence-backed item-reference query，不得为了统一形态强制走 tag owner API。

### focused proof 与闭包等级

编译/静态检查必须同时证明：旧包/旧 module active source 不存在；所有 coordinator/owner/edge/problem/copy import 指向 catalog；SQL target 只有 catalog；四个 operation generated binding 可解析；旧 owner bean 不再被 Spring 扫描；GET metadata-only 负向集合与三个 command adapter class exact-set 正确，不能把 generated `OwnerLocalAdapters`/`invoke` 支持分支冒充 GET 运行时 adapter。Workbench 缺失 owner 的 focused failure 也必须存在。等级为 `NECESSARY_NOT_SUFFICIENT`，业务语义仍需 acceptance。

## 6. CP-04：operations-admin 与活动设计记忆

### 前端代码全集

- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemProductionEditor.tsx`：两处裸 owner 改为 generated/constant catalog，删除旧 fallback。
- `CatalogItemProductionView.tsx`：default owner 改 catalog，不复制另一份硬编码。
- `catalogTypes.ts`、validation、read-only presenter：owner union/fixture 改 catalog，业务 status/name/code/ref/version 不变。
- `CatalogDictionaryDrawerState.tsx`、`catalogFieldRuntime.ts`、dictionary library/drawer/page：query/mutation 仍使用同四个 operation，currentData/isFetching/invalidates/dirty guard 不变。
- 对应 `*.test.tsx`、`*.test.ts`、architecture/static exact-set tests：正向 catalog、旧 owner red mutation、用户可见词仍为“生产标签”。

### 活动文档/记忆全集

- `doc/decisions/2026-08-17-v2s-catalog-metadata-central-modal.md`
- `doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md`
- `doc/decisions/2026-08-23-v2s-catalog-identification-production-guidance-journey.md`
- `doc/decisions/2026-08-23-v2s-catalog-identification-production-guidance-ui-interaction.md`
- `project-memory/practices/backend-capability-lookup.md`

只更新活动 owner/API/path 表述；不改历史 review、历史 Flyway、业务语料中“生产标签”的用户术语。现有页面没有新 IA，因此仍需 static/render/L2 regression 对账，不能以“只改 owner”跳过控件/失败恢复/dirty guard 检查。

### 闭包等级

`NECESSARY_NOT_SUFFICIENT`。静态 owner 读取抓不到实际 query cache、用户页面行为和加载/失败恢复；existing focused/render/L2 regression 补足。

## 7. CP-05：测试、fixture、seed、check 与 L2 全分母

### 后端测试

1. 原 `modules/fulfillment-production/src/test/...` 的四个 production-tag 测试全部迁入 catalog package，并逐个复核 scope/grant/status/copy/reference/readback，不得只改 package 声明；新增或更新 `CatalogWorkbenchReadService` 的 navigation、preparation-reference、reference-count/read-model 输出 readback，覆盖旧 owner red mutation。
2. `ProductionTagCopyConflictIntegrationTest.java`、`TransitionOperationsProductionTagStatusOperationTest.java` 迁入 catalog application/operations；`CatalogInventoryReadTransactionTopologyTest.java`、`OperationsCatalogInventoryControllerRouteTest.java`、`ContractProblemAdvice` focused mapping test 更新 owner/problem。
3. `CatalogBatchStatusTransitionIntegrationTest.java`、`CatalogCategoryOwnerIntegrationTest.java`、`CatalogInventoryCoordinatorCopySourceAuthorityTest.java` 中的 production tag API imports、fixture owner、reference/status assertions全部复核。
4. `CatalogAcceptanceScenarios.java` 保留四个 operation identity，使用手写 fixture；场景覆盖 read scope、create duplicate、update stale version、status/reference、copy conflict、idempotency/null response、seed readback。`createProductionTag`（约 7295-7312 行）只允许作为 happy-path helper；duplicate-code、same-key/different-hash、claim-only/null-response replay 必须用显式 request/key builder，不能复用其“期望 200 + 每次新 key”的假设。不得新增错误 operation 注解，也不得让 builder 强制传入本应测试“缺省”的参数。

### 数据库/reset/seed 测试

- migration integration 只验证空目标 schema、约束/索引、旧 schema drop；不验证旧行搬运。
- `contracts/policy/catalog-inventory-fixture-catalog.json` 与 `.schema.json` 是生产标签事实正本/约束；`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` 当前无生产标签事实命中，只是全局 fixture/stage/count contract，不能新增第二个事实地址。
- `scripts/generate/catalog-inventory-p1.mjs` 与 `scripts/dev/catalog-inventory-seed-executor.mjs` 同步 owner/schema/readback；`catalog-inventory-seed-plan.mjs`、`r5-fixture-contract.mjs`、`r5-seed-plan.mjs`、`r5-complete-seed-executor.mjs`、`owner-command-seed-executor.mjs` 当前无生产标签事实命中，逐项记 `N/A_WITH_REASON` 或仅在全局 stage/count 结构受影响时同步；四阶段顺序不改，不添加虚构 fulfillment stage。
- `scripts/dev/*seed*.test.mjs`、`scripts/test/catalog-inventory-definition-seed.test.mjs`、`catalog-inventory-seed-identity.test.mjs`：catalog positive、旧 owner red mutation、fixture/validator 数量闭合、目标 schema readback、reset 后无旧依赖。
- reset 后先做目标表空态和旧 schema absence readback，再 seed；seed 后断言 enabled/disabled/voided、fresh ref、商品引用、brand copy、owner readback、receipt 从空到新写入。不得依赖 reset 前数据。

### 静态检查、工具、前端与 L2

- `scripts/test/catalog-inventory-query-envelope.test.mjs`、`catalog-p3-model-migration.test.mjs`、`catalog-inventory-reference-path-matrix.test.mjs`、`catalog-single-production-tag-migration.test.mjs`、`frontend-idempotency-boundary.test.mjs`、`frontend-transport-cache-lifecycle.test.mjs`：更新 active owner/target schema，并补旧 owner red mutation；`MasterDataLifecycleMigrationIntegrationTest.java:553` 的通用旧 schema DROP 保留，新增目标 migration 的 catalog 空态/旧 schema absence 断言，不把该通用行误判为生产标签 owner consumer。
- active policy/performance 分母不得泛化：逐项同步 `contracts/policy/lifecycle-vocabulary.json:14-18`、`contracts/policy/catalog-inventory-reference-path-matrix.json:14,18`、`contracts/policy/catalog-inventory-l2-case-blueprint.json:328`、`contracts/policy/catalog-inventory-l2-scenarios.json:1904,1939,1956`、`contracts/policy/catalog-inventory-assertion-matrix.json` 的生产标签条目，以及 `scripts/generate/backend-performance-m1-command-execution-bindings.mjs:9,356-377,444` 和 `contracts/policy/backend-performance-cp05-calibration-report.json`；GET `getOperationsProductionTags` 当前校准值 9、create/update/transition 当前校准值 31/2/5 均需重测，不能漏掉 GET；旧 owner red mutation 必须失败。
- §9a.1 的 active carrier 分母逐文件回填：catalog backend consumers/tests、old owner/app edges、acceptance/edge/database tests、全部 active policy JSON、所有 catalog/generator/seed/static/L2 scripts 与 frontend architecture/L2 tests；每个文件都要写改动、历史排除或 N/A_WITH_REASON，不允许以目录级概述代替。
- operation performance contract：GET 固定 1..100/default20，覆盖 0/20/21/100+ cursor boundary；三个 command 是单对象写入与 authoritative readback；重新计算 assertion matrix 的 owner/read breakdown 与既有 DB budget，当前 calibration 的 GET/create/update/transition 9/31/2/5 均只作待复核来源，不能把它们误当 DB budget，也不能无 decisionRef 增预算。
- `scripts/test/standards-enforcement-verify.test.mjs`、`tools/verify-gates/{cli,verify}.mjs`、`tools/capability-invariants/cli.mjs`、`tools/catalog-inventory-p1/cli.mjs`：active owner catalog，历史路径明确排除；`catalog-inventory-p2` 按 `doc/decisions/2026-09-21-v2s-catalog-inventory-p2-retirement.md` 退役，不属于活动门链。
- frontend static/render：`CatalogItemDrawer.test.tsx`、production editor/view tests、`catalogFieldRuntime.test.ts`、catalog management tests、architecture tests；UI control/文案/dirty/loading/error/focus 不漂移。
- L2：`apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts`、`scripts/test/browser-l2-runtime.mjs` 及 test、`catalog-inventory-l2-fixture.mjs`、`browser-l2-catalog-fixture.mjs`、相关 policy JSON；1904/1939 的 owner oracle 改为 catalog，1956/blueprint 328 保留“商品字典与生产标签是不同业务入口/operation surface、入口不混用”，不再声称不同 owner；先按 UI/testId 前置门逐控件对账，再在另行授权后执行 existing catalog regression，不新增页面动作。

### 新功能上线与既有功能调整分母

| 分母 | 结论与要求 |
| --- | --- |
| 新页面、新 IA、新 operation、新用户控件、新业务 seed entity | `N/A_WITH_REASON`：ProductionTagDefinition 已是既有功能，本批只迁 owner；不得以此跳过既有页面回归和 seed readback |
| `contracts/policy/catalog-inventory-fixture-catalog.json` 的 `productionTagDefinitions`、商品 `PRODUCTION_TAG` refs、catalog fixture/schema | 既有功能调整：唯一事实来源；owner/source/target/ref/readback 同步；reset 后使用新 seed refs，不复制旧行 |
| `catalog-inventory-seed-executor`；其他 r5/owner-command stage/plan/check 文件 | 既有功能调整仅由 catalog executor 消费；其他当前零命中载体逐项 `N/A_WITH_REASON`，除非全局 stage/count 结构实际受影响；四阶段顺序、硬编码闭集/数量断言和 data source 同步 |
| acceptance builders/scenarios、L2 fixture/policy/oracle | 既有功能调整：不强制待测缺省参数；`createProductionTag` 仅作 happy-path helper，duplicate-code 与 same-key/null-response replay 用显式 request/key builder；ownerGraph/readback 改 catalog，用户动作不变 |
| command tokens、M1 performance generator、assertion matrix、lifecycle/reference policy | 既有功能调整：三个 command 实际 adapter 和性能生成 imports 改 catalog；GET metadata-only 负向证明入分母 |
| target receipt/lock namespace | 既有功能调整：reset 后空表、null-response replay、`catalog-production-receipt` namespace；不做旧 receipt continuity |

### 每项的闭包等级

上述每个静态测试/检查都标 `NECESSARY_NOT_SUFFICIENT`，必须写明漏检边界；任何一次通过不能代替 fresh review、reset readback 或用户行为 regression。

## 8. CP-06：验证、对账与交付门

### 8.1 每个 CP 之后

由 fresh 独立子 agent 逐条比较：用户目标/冻结不变量、详设对应 CP、项目 memory/规范、owning source、失败/恢复、数据来源和 scope。结论只记 `MATCHED`/`OPEN`；主 agent 逐条修复 `OPEN` 后重新复查，未闭不得开始下一 CP。

### 8.2 全批动态前三维对账

CP-00～05 完成后，重新独立走一遍全批，不把阶段结果拼接成总 PASS。必须确认以下同一事实在契约、Java、SQL、前端、测试、seed、memory 中始终为 catalog：operation owner、schema/receipt target、scope/status/ref、reset-first、seed readback、历史排除项、当前未授权边界。

### 8.3 逐代码与详设对账（交付前置）

实施完成、动态结果收集完后，按详设 §9a 每一行和本计划 §3～§7 每一项逐代码核对，不抽样。核对字段至少包括：真实文件/符号、owner/package、operation/path/wire、事务与锁、problem/readback、target schema、前端 owner consumer、test fixture、seed executor/stage/readback、历史排除。只有 `MATCHED` 才能交付；任何 `OPEN` 都必须根因修复并重新逐代码对账，不能靠额外动态运行掩盖。

### 8.4 后续动态顺序（当前已授权，Browser L2/UAT 除外）

按受管入口和当前 runner 实际帮助执行：

1. focused static/check/compile；
2. focused backend owner/contract/transaction/migration tests；
3. full backend acceptance，分离 CONTRACT、BUSINESS、DB_OPERATIONS 与 cleanup；
4. 受管 reset，确认旧 schema 删除和目标空态；
5. 受管 DEV start/restart（DEV 不自动 seed）；
6. 受管 catalog seed，逐项报告 business/readback 与 cleanup；
7. Browser L2 不在本次授权内，保持 `NOT_AUTHORIZED/NOT_RUN`；若后续单独授权，再执行 existing catalog regression。

同一 `failureCategory` 第二次出现即冻结该失败族后的业务推进，回到日志和 owning source 做根因修复；未运行不得写 PASS，cleanup 失败不得被 business PASS 覆盖。

## 9. 停机条件

- 发现第二个履约生产业务实体，或用户语义证明该域不能整体删除。
- operation path/wire/face/capability 需要改变，或迁移要求新增权限/用户行为。
- target schema 无法在 reset 后为空建立，`tag_kind`、旧 schema 或旧 owner 仍被 active runtime 需要。
- 任一代码、契约、生成物、测试、seed、tool、active memory 仍将 `fulfillment-production` 作为活动 owner，且不是已列明历史分桶。
- seed 只能依赖 reset 前数据、旧 tag ref、旧 receipt 或旧 schema 才能通过。
- acceptance fixture builder 强制待测的 optional 参数，造成缺省/负路径分母为零。
- 需要修改 generated 文件而没有对应 source generator，或静态门没有真实 red mutation。
- 任一步骤三维对账或最终逐代码对账为 `OPEN`。
- 需要执行当前未授权的实现、生成、构建、测试、reset、DEV、seed、L2、UAT 或部署动作。

## 10. 未来交付格式

实施完成后才可交付 `REVIEW_TARGET=IMPLEMENTATION`，并同时附：

- 实施变更清单和每个 CP 的步骤级/全批三维对账；
- 契约/生成链、backend、frontend、migration、test、fixture、seed、check 的实际结果；
- reset 后 schema 空态、seed readback、backend acceptance business/cleanup 分开结果；
- L2 是否授权、实际运行范围和证据档位；
- §8.3 逐代码与详设对账表，全部为 `MATCHED`；
- 未运行/未授权项单列，不升级为 PASS。

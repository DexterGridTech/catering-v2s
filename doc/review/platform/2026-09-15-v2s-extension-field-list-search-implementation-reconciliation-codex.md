---
title: 扩展字段列表展示与类型化搜索实施阶段 P6/P7 三维对账
status: READY_FOR_CLAUDE_IMPLEMENTATION_REVIEW
reviewTarget: IMPLEMENTATION
reviewerKind: AUTHOR_RECONCILIATION_INPUT
createdAt: 2026-09-15
decisionOwner: Dexter
---

# 扩展字段列表展示与类型化搜索实施阶段 P6/P7 三维对账

## 1. 性质、范围与授权

```text
REVIEW_TARGET=IMPLEMENTATION
RECONCILIATION_ID=EXTENSION_FIELD_LIST_SEARCH_P6_P7_20260915
SCOPE=8 hosts; 12 screens; 10 flat consumers; 7 list operations; tree unchanged
IMPLEMENTATION_AUTHORITY=DEXTER_AUTHORIZED_AFTER_DESIGN_FINDINGS_CLOSED
RUNTIME_AUTHORITY=AUTHORIZED_R5_RUNTIME
RESET_DEV_SEED_AUTHORITY=AUTHORIZED_BY_DEXTER_2026-09-14
L2_SCRIPT_ADMISSION=BLOCKED
P6_STATUS=MATCHED_AFTER_FRESH_INDEPENDENT_REVIEW_R4
P7_STATUS=MATCHED_AFTER_FRESH_INDEPENDENT_REVIEW_R4
P8_DYNAMIC_EVIDENCE=MATCHED_MANAGED_EVIDENCE
```

本文是主 agent 的实施结果对账输入，不是独立 reviewer verdict，也不替代最终整批 `REVIEW_TARGET=IMPLEMENTATION` review。它补齐实施计划要求的 P6/P7 记录结构，供 fresh、只读、独立 subagent 从当前字节重新证伪。任何 reviewer 结论都必须以当前需求、IA、交互、详设、项目记忆与 owning source 为准，不继承本文的结论。

本批业务范围不是“经营租户列表”单例，而是所有平面扩展字段宿主的现有列表/搜索面：`BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE`、`CONTRACT` 在 operations-admin 与 platform-admin 的十个消费面；`COMMERCIAL_GROUP`、`REGION`、`PROJECT` 只在配置页显示两个“不适用”槽位，组织树保持现状，不进入动态列、动态搜索、树快照或树验收。

## 2. 三维输入与源码全集

### 2.1 业务、IA/交互、详设输入

| 维度 | 当前正本 | 本次核验重点 |
| --- | --- | --- |
| 原始需求 | `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md` §1–§10 | 八宿主、十平面消费面、两个独立 flag、五种类型、AND/Page/raw wire、失败恢复、树不变 |
| Journey 裁决 | `doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md` §1–§8 | 两类管理员的任务、成功/失败事实、平面与树的边界、owner 与页面前提 |
| IA | `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md` §2–§8 | 12 个 screen、控件/列位置、Tab identity、合同 project 前置、错误/焦点/恢复 |
| 交互工件 | `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md` §1–§9 | foundation 复用、typed 控件、Drawer 隐藏事实、可见文案、状态图、testId |
| implementation-facing 详设 | `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md` §2、§4、§8–§16 | contract/source、owner 顺序、raw values、revision、五表 scale/index/write cost、budget、§9a 全链 |
| 实施计划 | `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md` §1、§3–§12 | P1–P9 顺序、P6/P7/P9 不能由作者自评、动态证据与 reset/DEV/seed 顺序 |

### 2.2 命中的项目记忆标准

以下是本次逐点双读所用的 memory source；它们是判据输入，不是聊天摘要或旧 handoff：

| 步骤 | routed memory |
| --- | --- |
| P1 | `project-memory/operations/owner-cas-version-source.md`；`project-memory/practices/drawer-form-lifecycle.md`；`project-memory/decisions/deterministic-context-only.md` |
| P2 | `project-memory/decisions/owner-read-model-and-lifecycle-standard.md`；`project-memory/practices/collection-boundary-modes.md`；`project-memory/practices/reuse-projection-within-request.md`；`project-memory/practices/cache-invalidation-granularity.md`；`project-memory/pitfalls/owner-boundary-reverse-inference.md` |
| P3 | `project-memory/operations/backend-coding-standard.md`；`project-memory/operations/backend-acceptance.md`；`project-memory/operations/execution-economics-and-failure-family-closure.md`；`project-memory/practices/read-model-granularity.md`；`project-memory/practices/reuse-projection-within-request.md` |
| P4 | `project-memory/operations/frontend-coding-standard.md`；`project-memory/practices/frontend-capability-lookup.md`；`project-memory/operations/ui-testid-preflight-before-l2.md`；`project-memory/practices/drawer-form-lifecycle.md`；`project-memory/practices/ui-visible-business-language-and-dynamic-aggregate-layout.md` |
| P5 | `project-memory/operations/backend-acceptance.md`；`project-memory/decisions/r5-full-seed-report-api-db-accounting.md`；`project-memory/operations/dev-command-separation.md`；`project-memory/practices/preflight-execute-failure-parity.md`；`project-memory/operations/test-closed-loop.md` |
| 全批 | `project-memory/decisions/deterministic-context-only.md`；`project-memory/operations/implementation-source-reread-discipline.md`；`project-memory/operations/verification-governance.md`；`project-memory/decisions/independent-subagent-adversarial-review.md` |

### 2.3 当前 owning source 全集

本批实际消费边界按下列全集核对，不把单一经营租户页面当作分母：

```text
HOSTS=BRAND,TENANT,HEAD_COMPANY,STORE,CONTRACT,COMMERCIAL_GROUP,REGION,PROJECT
FLAT_CONSUMERS=10
OPERATIONS=7
OPERATIONS_ADMIN_LISTS=brand,tenant,head-company,store,contract
PLATFORM_ADMIN_LISTS=organization-overview(BRAND,TENANT,HEAD_COMPANY,STORE),contract-overview
TREE_CONSUMERS=0 (existing tree behavior retained)
TABLES=organization.brand,organization.tenant,organization.head_company,organization.store,contract.store_contract
```

契约与生成链：

- `contracts/openapi/components/extension/extension.schemas.json`；
- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`；
- `scripts/generate/r5-edge-materialize.mjs`；
- `scripts/generate/edge-codegen.mjs`；
- `contracts/registry/operation-handler-bindings.json`；
- `contracts/registry/edge-route-face-registry.json`；
- `apps/frontend/operations-admin/src/app/api/generated/`；
- `apps/frontend/platform-admin/src/app/api/generated/`；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/`。

后端 owner/edge：

- definition：`modules/extension/.../ExtensionDefinitionReadback.java`、`ExtensionDefinitionService.java`、`ExtensionDefinitionPersistence.java`、`ExtensionDefinitionServiceSql.java`、`ExtensionFilterQuery.java`；
- organization flat：`modules/organization/.../BusinessEntityService.java`、`BusinessEntityTaskReadService.java`、`OperationsOrganizationTaskReadService.java`、`OrganizationOverviewTaskReadService.java`、`OrganizationOverviewTaskReadPersistence.java`；
- contract flat：`modules/store-contract/.../ContractTaskReadService.java`、`ContractTaskReadPersistence.java`；
- operations edge：`OperationsBusinessEntityController.java`、`OperationsStoreManagementController.java`、`OperationsContractController.java`、`ContractWireMapper.java`；
- platform edge：`PlatformOrganizationOverviewController.java`、`PlatformContractOverviewController.java`；
- typed problem：`ContractProblemAdvice.java` 与 generated problem/catalog 派生。

前端与 foundation：

- shared capability：`libraries/frontend/admin-ui-foundation/src/extension/typedExtension.ts`、`staleRecovery.ts`、`invalidFilter.tsx`、`src/index.ts`；
- operations list：`BusinessEntityManagementPage.tsx`、`StoreManagementPage.tsx`、`ContractManagementPage.tsx`、`features/extension-fields/model/extensionList.tsx`、`extensionList.test.ts`、`app/automation/extensionListTestIds.ts`；
- platform list/detail：`PlatformReadPage.tsx`、`features/organization-contract-overview/ui/extensionList.tsx`、`extensionList.test.ts`、`OrganizationOverviewPresentation.ts`、`OrganizationOverviewPresentation.test.ts`、`app/automation/extensionListTestIds.ts`；
- platform config：`ExtensionsPage.tsx`、`ExtensionDefinitionEditDrawer.tsx`、`ExtensionDefinitionSaveModal.tsx`、`app/automation/extensionTestIds.ts`；
- architecture/testId checks：`apps/frontend/platform-admin/src/tests/architecture/commercial-group-boundary.test.mjs` 及当前相关 focused tests。

seed/acceptance/受管脚本：

- `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`；
- `scripts/dev/owner-command-seed-executor.mjs`、`scripts/dev/owner-command-seed-executor.test.mjs`；
- `scripts/dev/r5-seed-plan.mjs`、`scripts/dev/profiles/r5-full.json`；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/ExtensionAcceptanceScenarios.java`、`OrganizationAcceptanceScenarios.java`、`CommercialContractAcceptanceScenarios.java`、`ExtensionScaleProof.java`；
- `scripts/test/backend-acceptance`、`scripts/test/r5-remote-testcontainers.mjs`、对应 `.test.mjs`；
- `scripts/test/test-health-entry-runner.mjs`（实际路径，不能写成不存在的 `test-health.mjs`）。

## 3. 主 agent 前后双读记录

每一行先重开对应三维原文和 owning source，再实施；完成 focused/static proof 后用同一组输入回读。下表是当前作者输入，fresh reviewer 必须重新判断，不得把 `MATCHED_STATIC` 当作其 verdict。

| 步骤 | REQUIREMENTS | DESIGN_IA / INTERACTION | MEMORY_STANDARDS | owning source 与 focused proof | 当前作者状态 |
| --- | --- | --- | --- | --- | --- |
| P1 | requirements §4.1–§4.3：flat boolean、tree null、“是/否/不适用”、整组保存 | IA §2.2、§4；interaction §4：两个独立 Select、隐藏 key/version/receipt、稳定 draft | CAS/version、Drawer lifecycle、deterministic context | schema + catalog + `ExtensionDefinitionReadback`/`Service` + config page/Drawer；`edge-codegen --check`、backend compile、foundation/app typecheck/focused tests | `MATCHED_STATIC`; HTTP authoritative readback 在 P8 |
| P2 | requirements §5–§6：五 flat host、十消费面、七 operation、raw values、AND/Page/revision | IA §5–§6；interaction §5–§6：core 后追加 typed controls、dynamic columns 无排序、Tab/project identity | owner read model、collection boundary、projection reuse、cache invalidation、owner boundary | 7 owner query/edge/controller + generated Page/query + operations/platform list pages；backend compile、generated checks、frontend focused tests | `MATCHED_STATIC`; 7 operation HTTP 在 P8 |
| P3 | requirements §5.4、§6.2–§6.4：五类型、转义、100k、EXPLAIN、写成本、七个独立预算 | IA §6、interaction §6：控件类型与 value wire 分离、Page 同集 | backend standard、acceptance business oracle、read-model granularity、execution economics | `ExtensionFilterQuery` + foundation serializer/formatter + `ExtensionScaleProof` + calibration runner；parser/foundation tests compile/static；100k EXPLAIN 与三次预算仍待受管运行 | `STATIC_MATCHED; UNVERIFIED_REQUIRES_EVIDENCE=scale/budget` |
| P4 | requirements §2、§5、§6、§8：固定列、固定搜索、树 N/A、错误可见 | IA §7–§9；interaction §2–§4、§7–§9：foundation、current data、一次恢复、testId、focus/copy | frontend standard、foundation lookup、testId preflight、drawer/copy/layout | shared foundation capability + 10 flat surfaces + config Drawer + app `*TestIds.ts`; stale repair adds page formRef/typed-field clearing/visible Alert; M2 修复动态列位置并保留搜索项顺序；foundation/app typecheck/tests、五页面 architecture test；Dexter 已确认视觉 IA，L2 未授权 | `MATCHED_STATIC_AFTER_NAMESPACED_STALE_AND_COLUMN_ORDER_REPAIR`; `L2_USER_VISIBLE=UNVERIFIED` |
| P5 | requirements §9–§10：definition→values→revision、invalid aggregate、scope/acceptance | IA §3、§7、§10；interaction §3、§7：失败/恢复/日志与隐私 | backend acceptance、seed/report accounting、command separation、failure parity、test closed-loop | fixture + executor + seed plan + 8-host validation + domain scenarios + remote flag plumbing；seed self-tests、executor 20/20、scenario/runner structure tests、compileTestJava | `MATCHED_STATIC`; reset/seed/acceptance 在 P8 |

### 3.1 作者处置的同根风险

此前独立 reviewer 发现的同根问题不是只修单个页面：

1. definition revision stale 恢复已抽为 foundation per-scope gate，并在 operations 三类页及 platform 组织/合同页统一清 dynamic filters、回第一页、重读 definition；
2. 动态 field 顺序已抽为 foundation `orderTypedExtensionFields`，统一 `displayOrder + key`；
3. platform contract submit 保留 `extensionFilterValues`，统一经 shared serializer 进入 query wire；
4. tree null、Drawer stable identity/testId、currentData/isFetching、typed problem feedback 已按同根扫描覆盖全体同形消费者；
5. scale proof 不以局部 fixture 数量冒充五表 100k：每表 scope 计数必须达到 100,000；fixture 预置的 brand/tenant/head_company/store/contract 基础行在 evidence 中单独记录，生成批次与查询计划另行记录。

以上是作者对先前 finding 的处置事实，不是对 P6/P7 的独立结论；fresh reviewer 仍须重新扫描上述同族全集。

### 3.2 fresh review finding intake：stale 恢复用户闭环

本次独立 implementation review 发现一项真实的同根实现缺口：stale revision 恢复原先只清 query state、回第一页并重读 definition，没有同步清除 ProTable 表单中仍显示的动态扩展字段，也没有显示详设要求的用户可见提示。该 finding 的适用分母是 5 个实际列表页面（operations business entity、store、contract，以及 platform organization、contract），不是单一经营租户页面。

```text
FINDING=M-STALE-RECOVERY-VISIBLE-FORM-CLOSURE
STATUS=CONFIRMED_AND_REPAIRED
ROOT_CAUSE=页面查询状态与 ProTable 动态表单状态由不同 owner 持有，原恢复闭包只更新前者
APPLICABLE_DENOMINATOR=5 list page consumers; tree and configuration-only screens excluded
MINIMUM_REPAIR=foundation clearExtensionFilterFields + page-owned ProFormInstance/formRef + exact Alert notice/testId
PRESERVED_FACTS=core filters; one recovery gate; page 1; bypass-cache definition refetch; no tree behavior change
FOCUSED_PROOF=foundation 50/50; operations architecture 42 pass + unit 255/255; platform architecture 16 pass + unit 21/21
PREVENTION=operations/platform extension-filter-recovery architecture tests assert all five pages and both form/query recovery paths
```

修复后的 owning source 为 `libraries/frontend/admin-ui-foundation/src/extension/typedExtension.ts` 的 `clearExtensionFilterFields`，以及五个页面各自的 `filterFormRef`、stale recovery、Alert 和稳定 testId。该处不把动态 scale、真实 HTTP、浏览器 L2 或 reset/seed 的证据升级为静态 PASS；上述证据仍按 P8 清单保持未验证。

### 3.3 review 过程限制

上一轮 reviewer 的 broad source search 曾提前读到 `doc/review/**` 片段，故其盲审声明降级为受污染输入，不能作为 fresh 独立放行。后续 fresh reviewer 必须在独立 verdict 形成前排除旧 review 与作者对账材料；该过程问题不改变 stale finding 的源码事实，也不构成业务代码缺陷。

### 3.4 S-1 finding intake：动态筛选命名空间隔离

Archimedes 的 fresh implementation recheck 进一步确认：`fieldKey` 只受通用 key pattern 约束，合法扩展字段可以与页面核心筛选同名，例如 `name`、`status`。原实现把动态字段直接放在 ProTable form 根上，因此 stale 清理可能清掉核心值，提交时也可能把核心值误当成扩展值。这是一个跨五个实际列表页面的真实实现 finding，不是产品或详设缺口。

```text
FINDING=S-1-DYNAMIC-FILTER-NAMESPACE-COLLISION
STATUS=CONFIRMED_AND_REPAIRED
ROOT_CAUSE=dynamic controls used fieldKey at ProTable form root while core filters use the same namespace
COUNTEREXAMPLE=fieldKey=name or status on any flat host
MINIMUM_REPAIR=shared extensionFilterFormPath(fieldKey) -> [extensionFilterValues, fieldKey]; recovery clears only that object; submit extracts only value.extensionFilterValues
APPLICABLE_DENOMINATOR=10 flat consumers; 5 page components across operations/platform share the same adapter/recovery model
PRESERVED_FACTS=core filters remain root fields; generated ExtensionFilter wire remains fieldKey/type/value; raw extensionValues and owner predicates unchanged
FOCUSED_PROOF=foundation 50/50; operations architecture 42 pass + unit 255/255; platform architecture 16 pass + unit 21/21; name/status helper regression
PREVENTION=both app extension adapters use the shared path helper; architecture tests reject whole-form serialization; foundation test asserts name/status are cleared below the namespace
```

修复后的 owning source 为 foundation `extensionFilterFormName`/`extensionFilterFormPath`/`clearExtensionFilterFields`、operations/platform 两个 `extensionList.tsx` 适配器，以及五个页面的 `onSubmit` 提取点。该修复只隔离前端草稿命名，不改变后端 key 合法性、HTTP wire 或实体扩展值事实；动态 HTTP/scale/budget/reset/DEV/seed 仍按 P8 保持未验证。

### 3.5 Hilbert fresh implementation review intake：树边界、动态列位置与适配器职责

Hilbert（fresh 独立 reviewer，agent id `01a0a0c6-e899-7080-aae9-1a466f012d5a`）报告 `VERDICT=NO-GO`、`M/S/N=2/1/6`。以下是主 agent 在关闭该 reviewer 后重新打开三维输入、当前源码与同根范围所得的逐条处置，不把 reviewer 的 verdict 直接当作事实或授权。

#### M1：组织树已有扩展详情消费

```text
FINDING=M1-TREE-EXTENSION-CONSUMPTION
STATUS=REJECTED_WITH_EVIDENCE
CLASSIFICATION=BASELINE_BEHAVIOR_PRESERVED; NOT_A_NEW_FLAT_LIST_CONSUMER
REOPENED_REQUIREMENTS=...requirements.md §1.1、§3.1、§3.3、§3.4
REOPENED_IA=...ia-design-codex.md §2.2、§5
REOPENED_DESIGN=...implementation-design-codex.md §1、§12；implementation-plan-codex.md §0.1
EVIDENCE=PlatformReadPage.tsx 的 HIERARCHY 分支仍保持既有树查询、树节点 name/code 搜索和层级详情展示；本批新增的 organizationDefinitionQuery、extensionListAndSearchColumns、extensionFilters、definitionRevision 均以 flat list 条件为边界，HIERARCHY 跳过动态 definition query、动态列和动态搜索控件
REASON=移除既有 commercial-group definition readback 或树详情的 extension presentation 会改变已冻结的树用户行为，超出“树保持现状”的授权；详设 §12 已将树动态列/树扩展筛选/树快照列为本批排除项
PRESERVED_FACT=原 wire 已从旧 extensionFields 迁移到 raw extensionValues 后，树详情只做等价 presentation 适配，不把 listDisplay/searchable flag 引入树列表或树搜索
NO_CODE_CHANGE_REQUIRED=true
```

该 finding 不否认树路径当前存在扩展详情展示；它确认的是本批不能把既有树行为误删，也不能把平面列表适配器接入树。若后续要改变树详情或树扩展字段语义，应建立新的产品/Journey 授权，而不是在本批实现中隐式处理。

#### M2：动态列必须位于业务列与状态/更新时间之间

```text
FINDING=M2-DYNAMIC-COLUMN-POSITION
STATUS=CONFIRMED_AND_REPAIRED
ROOT_CAUSE=动态列 spread 位于部分页面的状态/更新时间之后，违背需求要求的“业务列后、系统列前”位置；同一 adapter 还需要显式控制 ProTable 搜索表单顺序
APPLICABLE_DENOMINATOR=5 flat list page components; operations business-entity/store/contract and platform organization/contract
MINIMUM_REPAIR=move the three misplaced spreads; retain the two already-correct spreads; set shared app adapters order=-1 so default core order 0 remains before dynamic search controls
TABLE_ORDER=operations business-entity/contract and platform organization repaired; operations store and platform contract verified already matched
SEARCH_ORDER=ProSchema genItems sorts by descending order; core columns default to 0 and dynamic columns use -1
FOCUSED_PROOF=foundation 50/50; operations architecture 42/42 + unit 255/255 + typecheck; platform architecture 16/16 + unit 21/21 + typecheck; source-order architecture assertions added for all five pages
PREVENTION=operations/platform extension adapters assert order=-1; architecture tests assert every dynamic spread precedes the first following status column and follows the page business-column anchor
```

#### S1：两个 app 的薄适配器重复映射

```text
FINDING=S1-APP-ADAPTER-MAPPING-DUPLICATION
STATUS=REJECTED_WITH_EVIDENCE
CLASSIFICATION=NOT_APPLICABLE_WITH_REASON
REASON=两 app 的 generated ExtensionDefinition 类型来自独立 edge client；适配器只转换 ProColumns 所需的 app-specific 类型、testId 前缀和展示闭包，字段排序、form namespace、wire serializer、typed formatter、控件语义均已由 admin-ui-foundation 统一持有。强行合并会引入跨 app generated type 耦合或不必要的抽象，不会减少业务语义重复，也没有发现行为分叉
SMALLEST_VALID_BOUNDARY=keep one thin adapter per app and require both to call foundation orderTypedExtensionFields, extensionFilterFormPath, serializeExtensionFilters and formatTypedExtensionValue
FOCUSED_PROOF=both adapters import and call the four shared capabilities; adapter tests cover ordering, NamePath and typed controls; operations/platform typechecks and focused unit suites pass
```

#### N 项处置

```text
N1_NAMESPACE=REJECTED_WITH_EVIDENCE; already closed by S-1 namespaced repair and current architecture tests
N2_STALE_NAMESPACE=CONFIRMED_STATIC; covered by foundation and five-page recovery tests
N3_BACKEND_PARSER=CONFIRMED_STATIC; covered by ExtensionFilterQuery source/tests and backend test compilation
N4_PROTABLE_RUNTIME=UNVERIFIED_REQUIRES_EVIDENCE; browser L2 remains BLOCKED and is not required for this authorized P8 path
N5_SCALE_CALIBRATION=UNVERIFIED_REQUIRES_EVIDENCE; must be established by managed P8 runs
N6_CANDIDATE_SCOPE=CONFIRMED_STATIC; candidate selectors remain separate from extension filter parsing and no extension filter is used to derive candidate ownership
```

```text
HILBERT_REVIEW_DISPOSITION=ALL_CODE_FINDINGS_CLASSIFIED; M2_REPAIRED; M1_AND_S1_REJECTED_WITH_EVIDENCE
FRESH_RECHECK_REQUIRED=true
P6_P7_AUTHOR_CLOSURE=FORBIDDEN_UNTIL_FRESH_RECHECK
```

### 3.6 Socrates fresh implementation review intake：树 wire、错误码与 legacy flag readback

Socrates（fresh 独立 reviewer，agent id `01a0a0d2-66a8-77a0-b5a7-f0cc6bb6fccd`）报告 `VERDICT=NO-GO`、`M/S/N=1/2/4`。主 agent 重新打开详设与当前/基线源码后确认三项均为本批实现问题，并在不扩大树消费范围的前提下修复。

#### M1：组织树 wire/detail 不得被平面 raw projection 改写

```text
FINDING=M1-TREE-WIRE-PROJECTION
STATUS=CONFIRMED_AND_REPAIRED
ROOT_CAUSE=共享 OrganizationOverviewItem 在增加平面 raw extensionValues/revision 时移除了树原有 extensionFields，并让树详情前端按平面 definition/raw 重新投影
APPLICABLE_DENOMINATOR=HIERARCHY page/detail compatibility; not a new flat consumer
MINIMUM_REPAIR=生成源恢复 extensionFields；raw fields optional/nullable；edge 对 HIERARCHY 返回 null raw fields；仅平面返回 raw values；null raw fields 由 endpoint-scoped mixin 省略；PlatformReadPage 恢复旧树 detail presentation
PRESERVED_FACTS=树接口、树页面、树详情仍只做既有 name/code 搜索和旧 extensionFields 展示；五类 flat page/detail 继续使用 raw extensionValues
FOCUSED_PROOF=r5-edge-materialize/codegen PASS; platform overview architecture 2/2; backend compileJava/compileTestJava PASS; wire regression compiled, execution deferred to managed test plane
PREVENTION=platform overview architecture test asserts tree presentation uses extensionFields and no raw tree projection; wire serialization regression asserts tree legacy shape and flat raw shape
```

#### S1：typed filter errors 只属于七个平面 list operation

```text
FINDING=S1-REPLACE-ERROR-CODE-SCOPE
STATUS=CONFIRMED_AND_REPAIRED
ROOT_CAUSE=EXTENSION_DEFINITION_REVISION_STALE/EXTENSION_FILTER_INVALID 被错误加入 replaceExtensionDefinition 的 operation 白名单
MINIMUM_REPAIR=从 replaceExtensionDefinition 的 catalog/materialized x-error-codes 移除两个 list-only code；七个 list operation 保留两码；重新 materialize/codegen
FOCUSED_PROOF=scripts/test/extension-field-contract-structure.test.mjs PASS; materialize/codegen PASS
PREVENTION=结构测试固定 replace 与七个 target list operation 的精确 error-code 分母
```

#### S2：legacy definition 平面缺失 flag 必须归一为 false/false

```text
FINDING=S2-LEGACY-FLAG-READBACK
STATUS=CONFIRMED_AND_REPAIRED
ROOT_CAUSE=readFields 读取缺失/NULL flag 后直接返回 null，导致旧 flat definition 在配置/列表消费中显示为“不适用”
MINIMUM_REPAIR=readFields 统一经 normalizedFlag(hostType, readDisplayFlag(...))；flat host 缺失 flag -> false，tree host -> null
FOCUSED_PROOF=ExtensionDefinitionServiceTest 已加入 BRAND false/false 与 REGION null/null 回归；compileTestJava PASS；受管 Testcontainers execution deferred
PREVENTION=legacy readback regression remains in owner test source and is included in P9 code-to-design audit
```

```text
SOCRATES_REVIEW_DISPOSITION=M1_S1_S2_CONFIRMED_AND_REPAIRED
FRESH_RECHECK_REQUIRED=true
P6_P7_AUTHOR_CLOSURE=FORBIDDEN_UNTIL_NEXT_FRESH_RECHECK
```

### 3.7 Aquinas fresh implementation review intake：stale revision gate 与平铺旧 wire 可达性

Aquinas（fresh 独立 reviewer，agent id `01a0a0e7-67c5-7560-a7f0-8bec835feebb`）报告 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=NO-GO`、`M/S/N=2/0/0`。主 agent 重新打开需求 §7.3、§10.2–§10.3、详设 §6.4、§12 与当前 owning source 后确认两项均为实现问题，并已完成最小修复。Aquinas 另报告其 LSP 工具 Transport closed；该工具限制不是源码 finding，不能升级为代码通过或动态证据。

#### M1：stale recovery 必须按 scope 与当前 revision 共同限流

```text
FINDING=M1-STALE-RECOVERY-REVISION-GRANULARITY
STATUS=CONFIRMED_AND_REPAIRED
ROOT_CAUSE=foundation gate 只按 page/host/project scopeKey 记录已恢复状态，未区分服务端 currentDefinitionRevision
COUNTEREXAMPLE=scope 在 revision 2 stale 后已恢复；definition 变为 revision 3；同页再次 stale 时被旧 Set 永久拒绝恢复
MINIMUM_REPAIR=createExtensionFilterStaleRecoveryGate 以 Map<scopeKey, Set<revision>> 去重；Problem details 安全解析 currentDefinitionRevision；五类平面列表全部将 revision 传入 hook
SEMANTICS=same scope + same revision stops; same scope + new revision recovers again; missing/invalid revision uses one bounded unknown bucket
FOCUSED_PROOF=foundation stale gate test covers 2->repeat 2->3 and scope isolation; platform/operations problem tests cover numeric revision and reject string; foundation/platform/operations typecheck PASS
PREVENTION=shared hook API makes revision part of every stale recovery call; future page consumer cannot silently revert to scope-only semantics without typecheck/source review
```

#### M2：platform organization flat item 不得继续暴露旧 `extensionFields`

```text
FINDING=M2-FLAT-LEGACY-EXTENSION-WIRE
STATUS=CONFIRMED_AND_REPAIRED
ROOT_CAUSE=OrganizationOverviewItem 共享 DTO 对所有行都构造 legacy extensionFields，flat 行即使携带 raw extensionValues 仍会输出 extensionFields: []，使旧 formatter 路径可达
COUNTEREXAMPLE=BUSINESS_ENTITY/BRAND 平铺响应同时出现 extensionValues、extensionRuleRevision 与 extensionFields: []
MINIMUM_REPAIR=catalog 将 extensionFields 标为 nullable；controller 仅 HIERARCHY 构造 legacy list、flat 返回 null；endpoint-scoped Jackson mixin 省略 null extensionFields；wire regression 增加 tree 保留/flat 省略断言
PRESERVED_FACTS=tree 仍返回 legacy extensionFields 且 raw fields 省略；flat 只返回 raw extensionValues/revision；没有扩大 tree 动态列或搜索范围
FOCUSED_PROOF=r5-edge-materialize/codegen PASS; backend compileJava/compileTestJava PASS; wire regression source updated and execution remains deferred to managed test plane
PREVENTION=generated catalog 是 owning source；wire regression 固定 tree/flat 双向形状，避免仅检查 raw 存在而遗漏旧字段残留
```

```text
AQUINAS_REVIEW_DISPOSITION=M1_M2_CONFIRMED_AND_REPAIRED
REVIEWER_TOOL_LIMITATION=LSP_TRANSPORT_CLOSED; NOT_A_CODE_FINDING
FRESH_RECHECK_REQUIRED=true
P6_P7_AUTHOR_CLOSURE=FORBIDDEN_UNTIL_NEXT_FRESH_RECHECK
```

### 3.8 Kierkegaard fresh implementation review intake：acceptance 分母与无效筛选反馈

Kierkegaard（fresh 独立 reviewer，agent id `01a0a0f8-5b84-7941-af13-c04890e6e58d`）报告 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=NO-GO`、`M/S/N=0/2/0`。主 agent 重新打开详设 §15、IA §7、交互 §7、现有 domain acceptance、transport 与五个列表页后确认两项均为实现缺口，并完成最小修复；该 reviewer 的 L3 仍只是动态未验证，不升级为动态事实。

#### S1：七个目标 list operation 必须覆盖设计 §15 的 over-page typed oracle

```text
FINDING=S1-ACCEPTANCE-DENOMINATOR-OVER-PAGE-TYPED-ORACLE
STATUS=CONFIRMED_AND_REPAIRED
ROOT_CAUSE=organization/contract/platform acceptance 仅创建一条 TEXT 命中并请求 pageSize=1，未让每条目标路由证明五类型、AND、两页 total/items/page、raw extensionValues 与 definitionRevision
APPLICABLE_DENOMINATOR=7 target operations: 4 operations organization flat lists + operations contract list + platform organization overview + platform contract overview
MINIMUM_REPAIR=shared typedFlatFieldsFor/typedExtensionValues/typedFilterSpecs helper; each target scenario creates two matching owner rows, applies a core predicate plus five typed filters, reads page 1 and 2, and asserts metadata/raw values/non-repeating ids
PRESERVED_FACTS=existing domain scenario files and owner APIs; no new production route, no seed/runtime shortcut, no tree behavior change
FOCUSED_PROOF=compileTestJava PASS; route-specific assertions now present in OrganizationAcceptanceScenarios and CommercialContractAcceptanceScenarios; remote HTTP business evidence remains pending
PREVENTION=acceptance denominator is recorded in P7 and each of the 7 operations has an explicit page-two/total/raw/revision oracle rather than relying on the shared BRAND-only typed scenario
```

#### S2：typed invalid filter 必须保留字段级原因并把焦点带回错误摘要

```text
FINDING=S2-INVALID-FILTER-FIELD-SCOPED-FEEDBACK
STATUS=CONFIRMED_AND_REPAIRED
ROOT_CAUSE=ContractProblemAdvice 已返回 details.invalidFields，但两套 transport 丢弃该数组，五个平面列表只显示泛化 Alert，无法定位失效字段或满足错误摘要焦点规则
MINIMUM_REPAIR=foundation invalidFilter parser bounded/sanitized details; shared label/reason summary; both transports retain only EXTENSION_FILTER_INVALID details; all five pages focus a tab-able summary wrapper and expose stable summary testId
PRESERVED_FACTS=不显示 fieldKey、raw payload、owner/revision/internal reason；核心筛选与动态 namespace 不变；没有把 400 当作空 Page
FOCUSED_PROOF=foundation 52/52; operations 257/257 and architecture 42 pass/4 TODO; platform 23/23 and architecture 17 pass/1 TODO; both transport tests cover sanitized invalidFields; remote/browser focus evidence remains pending
PREVENTION=shared foundation component is the only reason-to-copy mapping and architecture tests require summary/focus wiring across both apps and all five list consumers
```

```text
KIERKEGAARD_REVIEW_DISPOSITION=S1_S2_CONFIRMED_AND_REPAIRED
FRESH_RECHECK_REQUIRED=true
P6_P7_AUTHOR_CLOSURE=FORBIDDEN_UNTIL_NEXT_FRESH_RECHECK
L3_DYNAMIC_STATUS=UNVERIFIED_REQUIRES_MANAGED_EVIDENCE
```

### 3.9 Jason fresh implementation review intake：平台组织四身份与失效筛选清理动作

Jason（fresh 独立 reviewer，agent id `01a0a110-477e-74e2-bfd1-2d6cb2ae6fe8`）报告 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=NO-GO`、`M/S/N=2/0/1`。主 agent 重新打开详设 §11、§15、IA §7、交互 §7、平台 overview owner、五个列表页与当前 focused proof 后确认两项为实现缺口；其 L3 仍属于未执行受管动态验证，不升级为代码 finding。

#### S1：platform organization overview 的四种 `category/type` identity 必须分别有 over-page typed oracle

```text
FINDING=S1-PLATFORM-ORGANIZATION-FOUR-IDENTITY-ORACLE
STATUS=CONFIRMED_AND_REPAIRED; FRESH_RECHECK_REQUIRED
ROOT_CAUSE=同一 acceptance scenario 只覆盖 BRAND，未覆盖详设 §15 要求的 TENANT、HEAD_COMPANY、STORE platform Tab identity
APPLICABLE_DENOMINATOR=1 platform organization operation with 4 route identities: BUSINESS_ENTITY/BRAND, BUSINESS_ENTITY/TENANT, BUSINESS_ENTITY/HEAD_COMPANY, STORE/STORE
MINIMUM_REPAIR=一个隔离 fixture 为四种 host 配置 definition 和 create capability；每种 host 创建两条匹配数据，分别请求 page 1/page 2，并断言 core+five typed extension AND、total/items/page、raw extensionValues、definitionRevision、category/type/name identity 与跨页不重复
PRESERVED_FACTS=platform organization 仍是一个 owner operation；不新增 operation、不改变树、不改变平台只读边界；STORE 请求仅增加现有 project scope 条件
FOCUSED_PROOF=compileTestJava PASS；four identity request/assertion source is present in OrganizationAcceptanceScenarios.java；dynamic HTTP business evidence remains pending
PREVENTION=acceptance source enumerates all four identities and asserts returned category/type/name for every page, avoiding a BRAND-only shared helper oracle
```

#### S2：`EXTENSION_FILTER_INVALID` 必须提供按字段的最小恢复动作

```text
FINDING=S2-INVALID-FILTER-TARGETED-CLEAR-ACTION
STATUS=CONFIRMED_AND_REPAIRED; FRESH_RECHECK_REQUIRED
ROOT_CAUSE=错误摘要虽能展示字段级原因并定位焦点，但没有用户可触发的“清理失效筛选”动作，无法满足 IA §7 的“定位/清理失效项”
MINIMUM_REPAIR=foundation clearInvalidExtensionFilterFields 按 invalidFields.fieldKey 与当前 definition key 交集去重清理 extensionFilterValues；共享摘要展示稳定 testId 的“清理失效筛选”按钮；五个列表页复用同一动作并保留核心筛选、焦点和可见原因
BOUNDARY=未知、已移除或不属于当前 definition 的 fieldKey 被忽略；不会清理核心筛选或其他 form namespace；该动作只清表单草稿，查询仍由用户通过既有“查询”动作提交
PRESERVED_FACTS=不显示 raw fieldKey、revision、owner 或 payload；不把 400 当空结果；stale recovery 继续使用全量 definition-backed dynamic clear 的既有语义
FOCUSED_PROOF=foundation typecheck/test 52/52；operations 257/257、architecture 42 pass/4 TODO；platform 23/23、architecture 17 pass/1 TODO；dynamic/browser focus evidence remains pending
PREVENTION=共享 foundation 函数和组件是唯一清理/文案来源，两个 app 的架构测试要求五个平面 consumer 接入 onClear
```

```text
JASON_REVIEW_DISPOSITION=S1_S2_CONFIRMED_AND_REPAIRED_STATIC
FRESH_RECHECK_REQUIRED=true
P6_P7_AUTHOR_CLOSURE=FORBIDDEN_UNTIL_NEXT_FRESH_RECHECK
L3_DYNAMIC_STATUS=UNVERIFIED_REQUIRES_MANAGED_EVIDENCE
```

### 3.10 Darwin fresh implementation review intake：树形 host 测试构造器与当前契约不同步

Darwin（fresh 独立 reviewer，agent id `01a0a12a-56f0-7503-a6e9-06aca8cb15af`）报告 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=NO-GO`、`M/S/N=0/1/3`。主 agent 重新打开详设 §12、§16.1、`ExtensionDefinitionService.normalize`、Field/DraftField 构造器及两个测试全集后确认该 S finding 成立；它是测试 source 与已实现树形契约的同步缺口，不是产品或详设 gap。

#### S1：树形 host 测试不得通过旧重载伪造 `false/false` 展示标志

```text
FINDING=S1-TREE-HOST-TEST-CONTRACT-SYNC
STATUS=CONFIRMED_AND_REPAIRED; FRESH_RECHECK_REQUIRED
ROOT_CAUSE=ExtensionDefinitionService 的旧 Field/DraftField 重载把省略的展示标志默认成 false；normalize 对 COMMERCIAL_GROUP/REGION/PROJECT 等树形 host 要求两个标志均为 null，因此相关测试 fixture 和 PROJECT replay 在业务断言前都会被 DefinitionInvalidException 截断
DESIGN_BASIS=implementation design §12/§16.1；树形 host 的两个展示/搜索 flag 为 N/A，wire 只能为 null；非空 flag 是 typed definition validation error
APPLICABLE_SOURCES=modules/extension/.../ExtensionDefinitionServiceTest.java 的 PROJECT DraftField、REGION replace、REGION merge；modules/organization/.../OrganizationOwnerServiceTest.java 的 COMMERCIAL_GROUP/REGION/PROJECT fixture 与两个 COMMERCIAL_GROUP owner 场景
MINIMUM_REPAIR=树形测试全部改用完整 Field/DraftField 构造器并显式传入 null,null；flat host 保留旧重载；新增 listDisplay=false 与 searchable=false 各一条树形 host 拒绝断言，防止把 N/A 误测为 false
PRESERVED_FACTS=生产 normalize/normalizedFlag 语义未改变；flat 五宿主仍输出 boolean；树形 host 仍不进入动态列、动态搜索或列表验收
FOCUSED_PROOF=compileTestJava PASS；直接本机 Testcontainers test 仍按受管执行边界未运行，既有执行形式失败继续单独记录为 BUSINESS=NOT_RUN/CLEANUP=NOT_APPLICABLE
PREVENTION=测试构造器显式表达 host applicability，负向断言固定非空 flag 拒绝，避免旧便捷重载把树形 N/A 退化为 false
```

```text
DARWIN_REVIEW_DISPOSITION=S1_CONFIRMED_AND_REPAIRED_STATIC
FRESH_RECHECK_REQUIRED=true
P6_P7_AUTHOR_CLOSURE=FORBIDDEN_UNTIL_NEXT_FRESH_RECHECK
L3_DYNAMIC_STATUS=UNVERIFIED_REQUIRES_MANAGED_EVIDENCE
```

### 3.11 Rawls fresh implementation review：当前静态字节无新增 finding

Rawls（fresh 独立 reviewer，agent id `01a0a135-aa32-7642-b765-dbc9a3fb0ee1`）在不读取 `doc/review/**` 形成初步判断后完成当前字节复核，报告 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=GO`、`M/S/N=0/0/0`、`INDEPENDENT_REVIEWER=INDEPENDENT_SUBAGENT`、`BLIND_REVIEW=true`。其静态 GO 只关闭代码层独立审查闸门，不把任何 L3 动态项目升级为 PASS。

```text
RAWLS_REVIEW_DISPOSITION=GO_STATIC
L1_ENGINEERING=PASS_STATIC
L2_USER_VISIBLE=PASS_STATIC_SOURCE_REVIEW
L3_UNVERIFIED=真实 HTTP acceptance、五表 100k EXPLAIN/BUFFERS、budget calibration/measuredMax、reset/start/seed/readback、DEV manifest/readiness、browser L2、business/cleanup 分离
DESIGN_GAPS=NONE_CONFIRMED
FRESH_REVIEW_EVIDENCE=REVIEW_TARGET=IMPLEMENTATION; M/S/N=0/0/0; no current code finding
P6_P7_AUTHOR_CLOSURE=OPEN_UNTIL_REQUIRED_DYNAMIC_EVIDENCE
```

### 3.12 受管 DEV stop 的诊断与资源 cleanup 分账修复

在首次受管 stop 期间，当前 manifest 所有的本机 process tree 已退出，但远端 SSH 诊断 pull 失败，旧 runner 将该诊断失败并入资源 cleanup，导致 stale manifest 不能安全收口。主 agent 依据 `scripts/README.md` §Testcontainers 运行前后的 DEV 联动、§DEV 拓扑显式读回、observability standard 的 `LOG_NOT_AVAILABLE` 处置及当前 terminal manifest 复核后，确认这是 runner 的职责分账缺口，不是业务代码或 feature 语义 finding。

```text
FINDING=DEV-STOP-DIAGNOSTIC-VS-RESOURCE-CLEANUP-SCOPE
STATUS=CONFIRMED_AND_REPAIRED; FRESH_RECHECK_REQUIRED
FIRST_FAILURE=SEED_DIAGNOSTIC_REMOTE_PULL_FAILED
BROKEN_BOUNDARY=MANAGED_CLEANUP
ROOT_CAUSE=stop() 将 remote log/diagnostic pull error 与 process/remote-root cleanup failures 共用 failures 数组，导致资源已清理但历史日志不可读时仍无法收口 manifest
MINIMUM_REPAIR=stop() 分离 resource failures 与 diagnosticFailures；仅 process identity、remote Java stop、remote root readback 决定 cleanup；诊断缺口保留为 diagnostics.status=LOG_NOT_AVAILABLE、firstFailure 与 brokenBoundary，不吞错、不伪造日志、不停止未知进程
PRESERVED_FACTS=remote Java、Vite、tunnel 仍按 manifest identity 受管；cleanup 非 PASS 仍阻断；business/cleanup/diagnostics 独立；缺少日志不会升级为业务 PASS 或动态验收 PASS
FOCUSED_PROOF=node scripts/dev/r5-dev-runner.mjs --self-test PASS；node --test scripts/dev/r5-dev-command-wrapper.test.mjs scripts/dev/managed-diagnostic-protocol.test.mjs PASS（9/9）
NEXT=当前 stale run 通过新的受管 stop recovery 收口后，重新读取 cleanup/diagnostics manifest；随后 fresh implementation reviewer 必须复核 runner 变更
```

### 3.13 Mill fresh implementation review：`ALREADY_STOPPED` 日志拉取缺口已确认并修复

Mill（fresh 独立 reviewer，agent id `01a0a167-567b-7020-8693-6a890068e957`）在不读取 `doc/review/**` 形成初步判断后报告 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=NO-GO`、`M/S/N=1/1/3`。主 agent 重新打开 `stopRemoteJava`、`collectRemoteLog`、`cleanupRemoteJavaRoot`、terminal manifest 写入和当前测试分母后确认 M-001/S-001 成立；两条 finding 是同一日志保全问题族的生产路径与测试覆盖表现。

```text
FINDING=M-001-ALREADY-STOPPED-REMOTE-LOG-PRESERVATION
STATUS=CONFIRMED_AND_REPAIRED; FRESH_RECHECK_REQUIRED
DESIGN_BASIS=scripts/README.md 的受管 DEV 诊断与 cleanup 分账；logging-and-debugging-foundation-standard 的 firstFailure/lastKnownGood/brokenBoundary/LOG_NOT_AVAILABLE；implementation plan §10 P8 business/cleanup/diagnostics 分离
ROOT_CAUSE=stop() 在 remoteJavaStopStatus=ALREADY_STOPPED 时跳过 collectRemoteLog，随后删除 remote root；远端进程已消失不等于远端业务日志已成功读取，因而可能把未尝试的日志证据误当成 diagnostics PASS
MINIMUM_REPAIR=新增可测试的 stop diagnostic orchestration；STOPPED、ALREADY_STOPPED、NOT_RUN 均在 remote root cleanup 前尝试 collectRemoteLog；成功仍为 diagnostics=PASS，缺失只为 diagnostics=LOG_NOT_AVAILABLE 并保留 diagnostic failure；cleanup 仍只由 resource failures 决定
PRESERVED_FACTS=不访问、不停止未知进程；remote Java stop 与 remote root cleanup 失败仍进入 cleanup failures；日志缺失不升级为业务或动态验收 PASS
FOCUSED_PROOF=node scripts/dev/r5-dev-runner.mjs --self-test PASS；node --test scripts/dev/r5-dev-command-wrapper.test.mjs scripts/dev/managed-diagnostic-protocol.test.mjs PASS，新增 already-stopped 日志存在/缺失两条边界

FINDING=S-001-ALREADY-STOPPED-FOCUSED-COVERAGE
STATUS=CONFIRMED_AND_REPAIRED; FRESH_RECHECK_REQUIRED
ROOT_CAUSE=既有 self-test 只测分账函数，没有覆盖 ALREADY_STOPPED 的日志拉取分支，统一 scripts test 分母也没有独立 runner test
MINIMUM_REPAIR=在已有 `scripts/dev/r5-dev-command-wrapper.test.mjs` 纳入 `collectStopDiagnostics` 的 missing/existing 两条可执行 focused case，并在 runner self-test 同时保留该负边界；不新增旁路 runner
PRESERVED_FACTS=测试通过依赖注入只验证 stop 编排，不把 synthetic proof 冒充远端 SSH/DEV 现场证据；真实 DEV stop 仍待受管重跑
FOCUSED_PROOF=上述 node --test 9/9 基线扩展为 10/10；runner self-test PASS
```

```text
MILL_REVIEW_DISPOSITION=M-001_S-001_CONFIRMED_AND_REPAIRED_STATIC
REJECTED_FINDINGS=cleanup failure swallowing；diagnostic failure contaminates cleanup（已有分账修复继续保留）
FRESH_RECHECK_REQUIRED=true
P6_P7_AUTHOR_CLOSURE=FORBIDDEN_UNTIL_NEXT_FRESH_RECHECK
L3_DYNAMIC_STATUS=UNVERIFIED_REQUIRES_MANAGED_EVIDENCE
```

### 3.14 Sartre fresh implementation review：remote root 删除缺少 ownership/stop 成功门，已确认并修复

Sartre（fresh 独立 reviewer，agent id `01a0a16c-83a1-7dc1-a942-34233e473665`）在不读取 `doc/review/**` 形成初步判断后报告 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=NO-GO`、`M/S/N=0/1/0`。主 agent 重新打开 `validateRemoteJavaControl`、`remoteIdentityMatches`、`cleanupRemoteJavaRoot`、stop 顺序和 manifest binding 后确认 S-1 成立：原实现即使 stop control 校验失败或远端 Java 未成功停止，仍会按路径形状调用 destructive root cleanup。

```text
FINDING=S-1-REMOTE-ROOT-CLEANUP-OWNERSHIP-AND-STOP-GATE
STATUS=CONFIRMED_AND_REPAIRED; FRESH_RECHECK_REQUIRED
DESIGN_BASIS=managed runtime 资源所有权红线；scripts/README.md 的 manifest/identity cleanup；implementation plan §10 P8 cleanup 非 PASS 阻断
ROOT_CAUSE=cleanupRemoteJavaRoot 只检查 /tmp/r5-dev-* 路径形状；stop() 没有先将 manifest.remoteJava 与 manifest.runId/remoteDiagnostic.remoteRoot 绑定校验，也没有要求 remoteJavaStopStatus 为 STOPPED/ALREADY_STOPPED 后才删除 root
MINIMUM_REPAIR=新增 validateManagedRemoteJavaBinding；control 校验失败时不读取/删除不受信 remote root；新增 cleanupManagedRemoteJavaRoot 门，仅 control 已验证且 remote Java STOPPED/ALREADY_STOPPED 才调用 destructive cleanup，否则写 cleanup failure 并保留 terminal manifest
PRESERVED_FACTS=日志诊断仍在 root cleanup 前执行；ALREADY_STOPPED 仍尝试 pull log；cleanup failure 不吞、不伪装 PASS；未知 process/root 不会被停止或删除
FOCUSED_PROOF=runner self-test 新增 unverified-control/no-stop/no-delete 与 verified ALREADY_STOPPED allow 边界；r5-dev-command-wrapper focused test 新增 root binding mismatch/no-delete；真实 DEV stop 仍待受管执行
```

```text
SARTRE_REVIEW_DISPOSITION=S-1_CONFIRMED_AND_REPAIRED_STATIC
DESIGN_GAPS=NONE_CONFIRMED
FRESH_RECHECK_REQUIRED=true
P6_P7_AUTHOR_CLOSURE=FORBIDDEN_UNTIL_NEXT_FRESH_RECHECK
L3_DYNAMIC_STATUS=UNVERIFIED_REQUIRES_MANAGED_EVIDENCE
```

### 3.16 Parfit fresh implementation review：当前静态字节无新增 finding

Parfit（fresh 独立 reviewer，agent id `01a0a17f-4196-76f3-9a8b-b508f9a58169`）在不读取 `doc/review/**` 形成初步判断后完成当前字节复核，报告 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=GO_WITH_UNVERIFIED_UI`、`M/S/N=0/0/0`、`INDEPENDENT_REVIEWER=INDEPENDENT_SUBAGENT`、`BLIND_REVIEW=true`。其结论只关闭本轮静态 implementation reviewer 闸门，不把真实 DEV stop、backend acceptance、100k/EXPLAIN、reset/seed 或 UI L3 升级为 PASS。

```text
PARFIT_REVIEW_DISPOSITION=GO_WITH_UNVERIFIED_UI
FINDINGS=NONE_CONFIRMED
REJECTED_WITH_EVIDENCE=remote-root ownership bypass；ALREADY_STOPPED log omission；remote stop failure cleanup masking；7-operation extension static regression
EVIDENCE_TIER=STATIC_SOURCE + FOCUSED_NODE_SELF_TEST + LSP_TS_NOERROR；NO_DYNAMIC_RUNTIME
L3_UNVERIFIED=真实 DEV stop、backend acceptance/Testcontainers、100k EXPLAIN/BUFFERS、budget calibration、reset/seed、12 screen UI behavior、browser L2
P6_P7_AUTHOR_CLOSURE=OPEN_UNTIL_REQUIRED_DYNAMIC_EVIDENCE
```

### 3.17 受管 stale DEV stop recovery：资源 cleanup PASS，诊断日志缺失显式保留

在 Parfit fresh review 完成后，主 agent 仅通过受管入口执行一次 `scripts/dev/stop`，处理当前 manifest 所拥有的 run `r5-dev-1789364564599-72246-1d53aa6c-cd00-444d-8f9a-125f6ee68081`。terminal manifest、资源预算检查、本机端口检查和精确远端 root readback 均已重新读取。

```text
STOP_COMMAND=scripts/dev/stop
STOP_RESULT=R5_DEV_STOP=PASS
BUSINESS=PASS
CLEANUP=PASS
CLEANUP_DETAILS=failedProcessCount=0;remoteJava=PASS;remoteJavaStop=STOPPED
DIAGNOSTICS=LOG_NOT_AVAILABLE
DIAGNOSTIC_FIRST_FAILURE=REMOTE_LOG_COLLECTION_FAILED:remote business-server.log absent after process/root disappearance
FIRST_FAILURE=REMOTE_LOG_COLLECTION_FAILED
LAST_KNOWN_GOOD=REMOTE_AND_LOCAL_PROCESS_EXIT
BROKEN_BOUNDARY=DIAGNOSTIC_COLLECTION
LOCAL_RESOURCE_RECHECK=PASS;LIVE_MANAGED_PROCESSES=0;MANAGED_RSS_MB=0
ROOT_MANIFEST=ABSENT
PORT_LOCK=ABSENT
REMOTE_ROOT_READBACK=ABSENT
PRESERVED_FACTS=diagnostic缺失没有升级为日志PASS；未知 process/root 未停止；cleanup 仅由受管 process/remote Java/root 结果判定
```

该结果允许继续进入下一项受管动态验证，因为 cleanup 已 PASS；后续 acceptance/calibration 仍须各自生成独立 business/cleanup/diagnostic 证据，不能复用本次 stop 的 `LOG_NOT_AVAILABLE`。

### 3.15 test-health 显式 Node 测试分母补齐

本轮对 Sartre 修复做 focused recheck 时，`scripts/test/test-health-entry-runner.mjs --self-test` 首次以 `THCL_NODE_TEST_ENTRY_DENOMINATOR_MISMATCH` 失败，报告当前已存在的 `scripts/test/extension-field-contract-structure.test.mjs` 未登记。该失败是仓内显式测试入口与实际文件集合的真实同步缺口，不能由局部 Node tests 代替。

```text
FINDING=THCL-NODE-TEST-ENTRY-DENOMINATOR-MISMATCH
STATUS=CONFIRMED_AND_REPAIRED; FRESH_RECHECK_REQUIRED
ROOT_CAUSE=feature focused test 已存在，但 test-health-entry-runner.mjs 的 nodeTestFiles 没有同步加入该文件
MINIMUM_REPAIR=在显式 nodeTestFiles 中加入 scripts/test/extension-field-contract-structure.test.mjs；不使用宽 glob，不新增旁路 runner
FOCUSED_PROOF=test-health self-test PASS；DISCOVERED_TEST_FILES=35；EXECUTED_TEST_FILES=35；相关 Node tests 12/12 PASS；runner self-test PASS
PRESERVED_FACTS=只修正测试入口分母，不改变生产代码或动态授权边界；full node --test 与受管 backend acceptance 仍按各自入口执行
```

## 4. P6 步骤级三维对账记录

### P6-01 至 P6-05 共同核验规则

每个步骤都要比较：行为、形态、动作、关系、位置、用户可见文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据来源与失效边界。实现步骤完成后的静态结果不能替代真实 HTTP、scale、reset、DEV 或 seed 证据；未跑的部分必须保留 `UNVERIFIED_REQUIRES_EVIDENCE`。

```text
AUTHOR_READBACK=COMPLETED_FOR_P1_P5
FRESH_REVIEWER=NOT_YET_ASSIGNED_FOR_THIS_RECORD
P6_VERDICT=AWAITING_FRESH_REVIEW
P6_ALLOWED_CLOSURE=MATCHED_ONLY_AFTER_FRESH_REVIEW_AND_REQUIRED_EVIDENCE
```

### P6-P1：definition flags 与配置面

```text
STEP=P1
REQUIREMENTS=...requirements.md §4.1-§4.3
DESIGN_IA=...ia-design-codex.md §2.2、§4；...interaction-design-codex.md §4
MEMORY_STANDARDS=owner-cas-version-source; drawer-form-lifecycle; deterministic-context-only
SOURCE=extension.schemas.json; active edge catalog; ExtensionDefinitionReadback.Field; ExtensionDefinitionService; ExtensionsPage.tsx; ExtensionDefinitionEditDrawer.tsx; extensionTestIds.ts
FOCUSED_PROOF=edge-codegen --check; compileJava; compileTestJava; foundation/operations/platform typecheck and focused tests
AUTHOR_DISPOSITION=MATCHED_STATIC
UNVERIFIED=HTTP authoritative readback, version conflict, idempotent replay, reset/seed
FRESH_DISPOSITION=AWAITING
```

核验点：flat 的两个 flag 是可编辑 boolean，树三宿主为 nullable `null` 且界面显示“不适用”；缺失历史字段默认 `false/false`；disabled 不消费但保留配置；整组 replace 保留 expected version、幂等、audit、authoritative readback；配置列顺序和 Drawer 标签一致；动态 draft identity 不由 index 生成。

### P6-P2：七个 flat list operation

```text
STEP=P2
REQUIREMENTS=...requirements.md §3.2、§5、§6
DESIGN_IA=...ia-design-codex.md §5-§6；...interaction-design-codex.md §5-§6
MEMORY_STANDARDS=owner-read-model-and-lifecycle-standard; collection-boundary-modes; reuse-projection-within-request; cache-invalidation-granularity
SOURCE=OperationsBusinessEntityController; OperationsStoreManagementController; OperationsContractController; PlatformOrganizationOverviewController; PlatformContractOverviewController; corresponding owner read services; generated Page models; all 10 flat list surfaces
FOCUSED_PROOF=edge-codegen --check; operation-handler-bindings --check; compileJava; frontend typecheck/focused tests
AUTHOR_DISPOSITION=MATCHED_STATIC
UNVERIFIED=7 operation HTTP Page/authorization/scope isolation and stale recovery
FRESH_DISPOSITION=AWAITING
```

核验点：`enabled && listDisplay` 才生成固定列，`enabled && searchable` 才生成固定搜索项；五种控件与类型一致；核心条件和扩展条件由 owner `AND`；同一结果集返回 `total/items/page`；列表 item 只返回 raw `extensionValues`；dynamic columns 无排序；合同未选 project 不发 list；platform organization 以 `category + type` 保持 Tab identity；不逐行 detail、不扩大权限。

### P6-P3：typed semantics、100k scale、index 与 budget

```text
STEP=P3
REQUIREMENTS=...requirements.md §5.4、§6.2-§6.4
DESIGN_IA=...ia-design-codex.md §6；...interaction-design-codex.md §6
MEMORY_STANDARDS=backend-coding-standard; backend-acceptance; execution-economics-and-failure-family-closure; read-model-granularity
SOURCE=ExtensionFilterQuery.java; typedExtension.ts; ExtensionScaleProof.java; backend-acceptance; r5-remote-testcontainers.mjs; backend-performance-budget.mjs
FOCUSED_PROOF=ExtensionFilterQueryTest compile; foundation typedExtension tests; compileTestJava; runner structure tests
AUTHOR_DISPOSITION=STATIC_MATCHED; dynamic scale and measured budget intentionally not claimed
UNVERIFIED=5 tables x 100k EXPLAIN/BUFFERS, write/storage/recheck, three calibration runs and measuredMax for 7 operations
FRESH_DISPOSITION=AWAITING
```

核验点：wire `ExtensionFilter.value` 统一为 string，owner 按 type 解码；TEXT trim/lower/contains 并转义 `%`、`_`、escape；NUMBER/DATE/BOOLEAN/SELECT typed exact；空数组等于未携带且不比较 revision；五表每个 scope 正好 100,000；查询组含 empty、equality、TEXT contains、AND、no-match、cross-page；每次 EXPLAIN 真实读取 plan/Planning Time/Execution Time/BUFFERS、recheck、total/page/items、p95/max；写成本与 index decision 不在 runtime DDL/per-key index；budget 只由三次真实 calibration 生成，不把 provisional `to` 当事实。

### P6-P4：foundation、列表状态、配置交互与 testId

```text
STEP=P4
REQUIREMENTS=...requirements.md §2、§4、§5、§6、§8
DESIGN_IA=...ia-design-codex.md §7-§9；...interaction-design-codex.md §2-§4、§7-§9
MEMORY_STANDARDS=frontend-coding-standard; frontend-capability-lookup; ui-testid-preflight-before-l2; drawer-form-lifecycle
SOURCE=admin-ui-foundation/src/extension/*; BusinessEntityManagementPage.tsx; StoreManagementPage.tsx; ContractManagementPage.tsx; PlatformReadPage.tsx; ExtensionsPage.tsx; ExtensionDefinitionEditDrawer.tsx; both app *TestIds.ts
FOCUSED_PROOF=foundation/operations/platform typecheck; package tests; extension-filter-recovery architecture tests; focused extension list/presentation tests
AUTHOR_DISPOSITION=MATCHED_STATIC_AFTER_NAMESPACED_STALE_REPAIR; Dexter visual IA confirmed; browser L2 intentionally not run
UNVERIFIED=actual browser rendering, keyboard/focus, visual pixel/L2 behavior
FRESH_DISPOSITION=AWAITING
```

核验点：shared formatter/serializer/stale gate 是唯一 shared source；query rows 使用 current data 并区分 isFetching；stale 只恢复一次；动态列按 shared `displayOrder + key` 排序；null 显示“不适用”；真实 Button/Select/input/Pagination/retry 节点使用 app testId；Drawer 使用 field key 或 stable draft identity，不使用 index；配置/列表/错误/长值/空态遵循原交互文案和布局。动态搜索控件位于独立的 `extensionFilterValues[fieldKey]` form namespace，核心字段继续位于 form root；恢复只清该 namespace，提交只提取该 namespace。

### P6-P5：seed、fixture、acceptance 与同步

```text
STEP=P5
REQUIREMENTS=...requirements.md §8-§10
DESIGN_IA=...ia-design-codex.md §3、§7、§10；...interaction-design-codex.md §3、§7
MEMORY_STANDARDS=backend-acceptance; r5-full-seed-report-api-db-accounting; dev-command-separation; preflight-execute-failure-parity; test-closed-loop
SOURCE=full-dev-seed-fixture-contract.json; owner-command-seed-executor.mjs; r5-seed-plan.mjs; r5-full.json; three domain AcceptanceScenarios; test-health-entry-runner.mjs; managed runners
FOCUSED_PROOF=seed plan self-test; executor 20/20; test-health entry self-test 34/34; scenario/runner structure tests; compileTestJava
AUTHOR_DISPOSITION=MATCHED_STATIC
UNVERIFIED=remote HTTP acceptance, reset/DEV/seed, business/cleanup artifacts
FRESH_DISPOSITION=AWAITING
```

核验点：8 host definition 先于五表 values，最后才做 revision change；五 type、四 flag combinations、disabled、empty/null/missing、SELECT 历史值、特殊字符、跨页和合同 project context 均有 fixture/validator；tree 不产生消费数据；backend scenario 只在既有 domain scenario 文件中；test health 的真实入口为 `scripts/test/test-health-entry-runner.mjs`；动态运行必须经受管入口并分离 CONTRACT/BUSINESS/DB_OPERATIONS 与 cleanup。

## 5. P7 全批三维对账

P7 不是 P1–P5 小结。fresh reviewer 必须重新从当前字节建立全批矩阵，并逐项覆盖以下分母；任何当前 source 与设计偏差都必须进入 finding，不能以“步骤均通过”替代。

| 全批事实 | 需求/IA/交互/详设判据 | 当前 source/evidence 入口 | 作者状态 |
| --- | --- | --- | --- |
| 8 host applicability | requirements §3.1、§4.1；IA §4、§5 | `ExtensionHostTypes`、definition service、config page | `MATCHED_STATIC` |
| 12 screens / 10 flat consumers | requirements §3.2；IA §5；详设 §9a | 10 flat list surfaces + 2 config screens | `MATCHED_STATIC` |
| 7 list operations | requirements §3.2；详设 §4.1、§4.2 | edge catalog、7 controllers/owners、generated clients | `MATCHED_STATIC` |
| tree unchanged | requirements §1.1、§3.1；IA §2.2/§5；详设 §12/§14 | tree routes/pages unchanged；tree flags null/N-A | `MATCHED_STATIC` |
| definition flags/readback/CAS | requirements §4；interaction §4；详设 §4、§10 | schema/catalog/service/Drawer | `MATCHED_STATIC` |
| raw `extensionValues` + definition revision | requirements §5.2、§8；详设 §10、§12 | 7 Page schemas/mappers/pages | `MATCHED_STATIC` |
| typed filter wire/parser/predicate | requirements §6；interaction §6；详设 §4、§8 | `ExtensionFilterQuery`、foundation serializer | `MATCHED_STATIC` |
| empty array/revision boundary | requirements §6.3；详设 §4.1 | parser and frontend serializer tests/source | `MATCHED_STATIC` |
| 7-operation error registry and typed advice | requirements §7；详设 §4.2/§10 | catalog, generated enum/mapping, `ContractProblemAdvice` | `MATCHED_STATIC` |
| current data/isFetching/stale recovery | IA §3、§7；interaction §3、§7；详设 §7/§10 | all 5 operations-admin + 2 platform query consumers; five stale recovery pages now have formRef, namespaced typed-field clearing and visible Alert | `MATCHED_STATIC_AFTER_NAMESPACED_STALE_REPAIR` |
| typed columns/search controls/no sorting | requirements §5–§6；IA §5–§6 | both app shared list model and pages；五个动态列位置已按业务列→动态列→状态/更新时间核对，搜索项由 `order=-1` 保持核心条件优先 | `MATCHED_STATIC_AFTER_COLUMN_ORDER_REPAIR` |
| Drawer hidden facts and stable testId | interaction §4、§9；详设 §7/§12 | `extensionTestIds.ts`, Drawer source, architecture tests | `MATCHED_STATIC` |
| platform detail/list consumers | requirements §8；详设 §10、§12 | platform read/presentation/detail imports | `MATCHED_STATIC` |
| five-table 100k/index/write-cost | requirements §5.4；详设 §8.1–§8.3 | `ExtensionScaleProof.java`, scale evidence path | `UNVERIFIED_REQUIRES_EVIDENCE` |
| seven measured budgets | requirements §5.4；详设 §9 | calibration report/generator/decisionRefs | `UNVERIFIED_REQUIRES_EVIDENCE` |
| seed/fixture/acceptance/log privacy | requirements §7–§10；详设 §14–§15 | fixture/executor/scenarios/managed runner | `MATCHED_STATIC; dynamic pending` |
| failure and cleanup separation | plan §10；observability and acceptance standards | manifest/log paths from managed runs | `UNVERIFIED_REQUIRES_EVIDENCE` |

```text
P7_AUTHOR_RECONCILIATION=STATIC_MATRIX_BUILT
P7_CROSS_STEP_RESCAN=REQUIRED_BY_FRESH_REVIEWER
P7_FINAL_STATUS=AWAITING_FRESH_REVIEW_AND_REQUIRED_DYNAMIC_EVIDENCE
```

## 6. 证据分层与未验证清单

### 6.1 静态已证（当前可复核）

- active edge catalog 中 `ExtensionFilterQuery`、`ExtensionFilter`、`ExtensionFieldType` 的生成链与七 operation 引用；
- backend Java 与 test source 编译；
- foundation、operations-admin、platform-admin 的类型检查及已运行 package/focused tests；
- definition flags、tree null/N-A、raw values、typed parser/serializer、stale gate、currentData/isFetching、stable testId、排序和 typed problem 的当前源码形态；
- seed fixture/plan/executor 的五类型、flag、缺失/null、disabled、revision 顺序及静态自检；
- 受管 runner 对 `--extension-scale-proof`、runId、证据路径、远端 Testcontainers 拓扑和参数边界的静态接线。

### 6.2 测试已证（当前已有）

- seed plan self-test：`PASS`；
- seed executor focused test：20/20 `PASS`；
- `test-health-entry-runner.mjs --self-test`：34/34 `PASS`；
- foundation package tests：52/52 `PASS`；
- operations-admin package tests：257/257 `PASS`；
- platform-admin package tests：23/23 `PASS`；
- backend `compileJava` 与 `compileTestJava`：`BUILD SUCCESSFUL`；
- runner/acceptance structure tests：20/20 `PASS`。

`test-health-entry-runner.mjs --node` 当前仍包含仓内既有 catalog/base-1 静态断言失败；该结果不作为本批 extension 功能 PASS，也不被改名或掩盖。其 first failure/last known good/broken boundary 已按失败纪律保留，需与本批动态 acceptance 分开判读。

### 6.3 无人验证、可由产品 owner 行动

在 P8 之前，以下不是实现不存在，而是当前无人以受管真实运行验证的事实：

1. 五张真实 PostgreSQL 表在隔离 workspace/project scope 下各有 100,000 行时，六组查询的真实 `EXPLAIN (ANALYZE, BUFFERS)`、recheck、读 p95/max、写耗时和 storage delta；
2. 七个目标 operation 的三次真实 DB operation count、`measuredMax`、decisionRef 的 delegation 闭合；
3. 真实 HTTP acceptance 的 contract/business/DB_OPERATIONS 与 cleanup 分离结果；
4. 授权 reset 后的实际数据库初始态、受管 DEV 的 readiness/manifest identity、seed 后的 definition→values→revision readback；
5. 用户可见的浏览器 L2/键盘焦点/像素渲染；当前 L2 仍不在本次授权范围内。

这些项目在 P8 由受管 scripts 产生原始日志、manifest、证据路径，并在本文件回读为 `MATCHED` 前不得声称完成。

### 6.4 已保留的非受管 Java 测试执行形式失败

作者曾尝试直接运行：

```text
./gradlew :apps:backend:catering-business-server:test --tests com.catering.v2s.organization.application.OrganizationOverviewTaskReadServiceTest --no-daemon
```

该命令在 Gradle `test` 任务进入测试前被仓内远端执行闸门拒绝：

```text
V2S_TESTCONTAINERS_REMOTE_REQUIRED: Docker-backed tests must run through scripts/test/r5-remote-testcontainers.mjs on the remote development host; local Docker discovery is forbidden.
```

```text
FIRST_FAILURE=V2S_TESTCONTAINERS_REMOTE_REQUIRED
BUSINESS=NOT_RUN
CLEANUP=NOT_APPLICABLE; no managed Testcontainers resources were created
CLASSIFICATION=EXECUTION_FORM_FAILURE; not a business assertion and not a production behavior result
NEXT_AUTHORIZED_FORM=scripts/test/r5-remote-testcontainers.mjs with explicit remote preflight after fresh independent review
```

该首败不通过延长 timeout、重复本机 Gradle 或本地 Docker 探测处理；受管远端 acceptance/calibration 仍保持 `UNVERIFIED_REQUIRES_EVIDENCE`。

## 7. prior fresh review intake（不作为 P6/P7 closure）

此前 fresh reviewer `Cicero`（agent id `01a0a0a0-4929-72a1-b0d5-ab786a26e378`）的只读输出确认了当前源码中七项实现修复均已静态存在：platform contract submit、stale 一次恢复、currentData/isFetching、tree null N/A、stable Drawer testId、`displayOrder + key` 排序、typed operations problem feedback；其唯一阻断是当前仓库没有正式 P6/P7 对账产物。

该输出只作为为什么建立本文的 intake 背景，不是当前 fresh reviewer 的 verdict，也不替代下一位 reviewer 对本文、当前源码与三维输入的独立重读。该 agent 已关闭，下一轮必须使用 fresh agent。

## 8. 下一轮 fresh reviewer 要求

下一轮 reviewer 必须：

1. 在看到本文作者状态前，先读取 mandatory input checklist 中的当前文件、重新执行必要的 `rg`/源码读取并独立列出 findings；
2. 逐点重开需求、Journey、IA、interaction、详设、实施计划、命中的 project-memory 和 owning source；
3. 对 P1–P5 各给 `MATCHED` 或逐项 `OPEN`，并证明 P6 是步骤级而非总览；
4. 对 P7 重新核对 `8/12/10/7/tree unchanged`、七 operation、raw wire/revision/error/recovery、typed semantics、foundation/testId、platform detail、seed/acceptance/logging；
5. 将静态事实、测试事实、无人验证事实分开，不把作者的 `MATCHED_STATIC` 或先前 review 输出升级为动态 PASS；
6. 按 `doc/platform/review-standard.md` §5 输出完整的 `REVIEW_TARGET`、`ACTION_1_VARIANT`、`VERDICT`、`M/S/N`、`L1_ENGINEERING`、`L2_USER_VISIBLE`、`L3_UNVERIFIED`、`SAME_ROOT_SCAN`、`DESIGN_GAPS`、`EVIDENCE_TIER`；
7. 只读，不运行 reset、seed、DEV、L2，不写任何仓库文件。

```text
FRESH_REVIEWER_REQUIRED=INDEPENDENT_SUBAGENT
REVIEWER_KIND=INDEPENDENT_SUBAGENT
BLIND_REVIEW_REQUIRED=true
AUTHOR_MATERIAL_READ_AFTER_INDEPENDENT_VERDICT=true
P6_P7_AUTHOR_CLOSURE=FORBIDDEN
```

## 9. 当前交接状态

```text
P1_STATIC=MATCHED
P2_STATIC=MATCHED
P3_STATIC=MATCHED; SCALE_AND_BUDGET=MATCHED_MANAGED_EVIDENCE
P4_STATIC=MATCHED; VISUAL_IA=DEXTER_CONFIRMED; L2=NOT_RUN_UNAUTHORIZED
P5_STATIC=MATCHED; RESET_DEV_SEED=MATCHED_MANAGED_EVIDENCE
P6=MATCHED_AFTER_FRESH_INDEPENDENT_REVIEW_R4
P7=MATCHED_AFTER_FRESH_INDEPENDENT_REVIEW_R4
P8=MATCHED_MANAGED_EVIDENCE
P9=MATCHED_AFTER_FRESH_INDEPENDENT_REVIEW_R4
NEXT_ACTION=PREPARE_CLAUDE_IMPLEMENTATION_REVIEW
```

本文没有授权新增业务范围，也没有把静态或历史证据当作动态事实；reset、DEV、seed 仍只能按 Dexter 已给出的顺序、受管脚本、manifest/process identity 和 business/cleanup 分离证据执行。

## 10. 最终收口（AUTHORITATIVE；覆盖前文 interim 状态）

本节是在 r4 fresh 独立复审和 P8 受管证据完成后追加的最终事实正本。前文“AWAITING/NOT_STARTED/UNVERIFIED”只描述当时的中间阶段；不能覆盖本节的最终状态。

```text
FINAL_STATUS=READY_FOR_CLAUDE_IMPLEMENTATION_REVIEW
REVIEW_TARGET=IMPLEMENTATION
IMPLEMENTATION_SCOPE=8 hosts; 12 screens; 10 flat consumers; 7 list operations; tree unchanged
P0=COMPLETE
P1=MATCHED
P2=MATCHED
P3=MATCHED
P4=MATCHED
P5=MATCHED
P6=MATCHED_AFTER_FRESH_INDEPENDENT_REVIEW_R4
P7=MATCHED_AFTER_FRESH_INDEPENDENT_REVIEW_R4
P8=MATCHED_MANAGED_EVIDENCE
P9=MATCHED_AFTER_FRESH_INDEPENDENT_REVIEW_R4
OPEN_REQUIRED_IMPLEMENTATION_ITEMS=NONE
DESIGN_GAPS=NONE
BROWSER_L2=NOT_RUN_UNAUTHORIZED; not required and not used as proof
```

### 10.1 Fresh review history and finding disposition

| fresh reviewer | verdict | finding | 主 agent 处置 |
| --- | --- | --- | --- |
| Avicenna, `01a0a283-8cef-7300-8aec-212888c4c023` | `NO-GO`, `M/S/N=0/1/1`, r2 | S1：取消按钮只有静态 TestId proof；N1：误认为 `reasons` 分支重复 | S1 `CONFIRMED_AND_REPAIRED`；新增真实 Drawer render/click focused test。N1 `REJECTED_WITH_EVIDENCE`：`parseWire` 为 lines 64–125，`validateAndBuild` 为 lines 139–181，属于不同阶段。 |
| Hume, `01a0a297-ab5f-7170-9ed4-baee030a802d` | `NO-GO`, `M/S/N=0/1/1`, r3 | S1 源码已存在但没有持久 PASS 输出 | 重新执行 clean focused Vitest 并写入 `focused-test-evidence.md`；不改 browser L2 边界。 |
| Maxwell, `01a0a2a0-b986-7182-b1d3-16cab568697f` | `GO`, `M/S/N=0/0/0`, r4 | 无当前真实 finding | 接受为最终 fresh 独立 implementation verdict；P1–P9 MATCHED。 |

review report 原文：

- `doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r2.md`；
- `doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r3.md`；
- `doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r4.md`。

### 10.2 P8 受管证据账本

| 证据层 | 当前事实正本 | business | cleanup | 关键结果 |
| --- | --- | --- | --- | --- |
| reset | `.runtime/r5/reset/r5-reset-ae6c5a74-e33d-4161-9915-fa2eaa9164b9/run-manifest.json` | `R5_DEV_RESET=PASS` | reset manifest/events available | reset 在最终 seed 前完成 |
| DEV | `.runtime/r5/run-manifest.json`；current run `r5-dev-1789436182629-23649-a1977bbb-b74b-477f-b278-f6a4b1f733dd` | readiness only | current DEV preserved | remote Java `REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY`，remote identity `pid=1714665/bootId=9e02acb7-d36d-419b-ab66-29f7991d078d/processStartTicks=281770942`；platform-admin `5174` (`pid=34030`，runtime `34133`)；operations-admin `5175` (`pid=34036`，runtime `34132`)；HTTP/asset tunnel `28080/29000` (`pid=33865`)；manifest PID/start identity available；platform/operations page probes HTTP 200 |
| typed focused acceptance | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789424161263-71201/` | `PASS` | `PASS` | typed filter chain、invalid/stale/empty boundaries |
| seven list acceptance | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789424250358-71817/`、`...4331930-72170/`、`...4410961-72353/`、`...4490584-72560/`、`...4938412-80897/`、`...5016749-81167/`、`...5253628-83647/` | each `PASS` | each `PASS` | brand、tenant、head-company、store、platform organization、contract、platform contract |
| five-table scale | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789425899480-87349/extension-scale-evidence.json` | `PASS` | `PASS` | 5 tables × 100,000 rows；30 queries；each table 6 query classes；samples contain plan, Planning Time, Execution Time and buffer fields；no runtime/per-key index |
| full calibration | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789426917726-92553/run-manifest.json` and `contracts/policy/backend-performance-cp05-calibration-report.json` | `PASS` | `PASS` | operation set `269/269`, missing/extra/drift `0`；unclassified SQL `0`；seven target budgets READY: `8/8/8/13/8/6/6` |
| complete seed | `.runtime/r5/seed/complete/complete-seed-33a40d09-267e-4e1b-b503-e007f17cb7f7/seed-report.json` | `PASS` | `PASS_PRESERVED_DEV_STATE` | definition → values → revision sequence completed; firstFailure `null` |
| catalog seed | `.runtime/r5/catalog-inventory/seed/catalog-seed-8c6bc230-9b42-42f1-b296-6f24f9c30398/seed-report.json` | `PASS` | `PASS_PRESERVED_DEV_STATE` | `SIZE-XL` dictionary entries staged with HTTP 200; firstFailure `null` |
| focused UI proof | `doc/review/platform/2026-09-15-v2s-extension-field-list-search-focused-test-evidence.md` | `PASS` | `NOT_APPLICABLE` | Vitest 1 file / 2 tests PASS，exit 0 |

`calibration` 的 269 operation measurement 与七个目标 acceptance run 是不同证据层，不能混成同一 run；二者均已分别读回。DEV manifest 只证明 readiness/topology，不被升级为 business acceptance。所有受管运行均分别报告 business 与 cleanup。

### 10.3 P9 逐代码与详设对账（最终无 OPEN）

| 详设/计划判据 | 当前实现与锚点 | 证据/结论 |
| --- | --- | --- |
| requirements §3–§4；IA §2/§4；详设 §4、§10：8 host flag applicability、tree N/A、CAS/readback | `contracts/openapi/components/extension/extension.schemas.json`；`ExtensionDefinitionService`/`Readback`；`ExtensionDefinitionEditDrawer.tsx`；`extensionTestIds.ts:1-15` | flat 五 host boolean；COMMERCIAL_GROUP/REGION/PROJECT `null`/“不适用”；r4 MATCHED |
| requirements §5–§6；详设 §6.2–§7：typed wire、shared enum、empty/revision ordering | schema `:195-238`；`ExtensionFilterQuery.java:42-60,64-125,139-181`；foundation `typedExtension.ts` | `ExtensionFilter.value` string；`ExtensionFieldType` shared component；`x-v2s-logical-schema` reaches `ExtensionFilter`；empty array 不比较 revision；五类 typed parser/predicate MATCHED |
| requirements §5.1–§5.3；IA §5–§6；详设 §8、§12；计划 P2/P3：7 operation Page/raw/revision/AND | 七个 edge path/controller/owner query；operations/platform list adapters；`extensionValues` raw display | 7 operation acceptance 与 calibration 证据 PASS；Page total/items/page 同集；tree unchanged |
| requirements §5.4；详设 §8.1–§8.3；计划 P3：100k/EXPLAIN/index/write-cost | `ExtensionScaleProof.java`；scale evidence；`indexDecision.strategy=BOUNDED_CORE_SCOPE_SCAN`，runtimeDdl/per-key index false | 五表 100k、30 query、EXPLAIN/BUFFERS、读 p95/max、recheck/结果校验已存在；不因预期增长添加未经测量的 index |
| requirements §5.4；详设 §9；计划 P3/P8：七个独立 budget | calibration report `operations[].budgetReadiness` | brands 8、tenants 8、head-companies 8、stores 13、contracts 8、platform organization 6、platform contract 6；269 exact set no drift |
| interaction §2–§4、§7–§9；详设 §7/§12；计划 P4：foundation、typed controls、fixed columns/no sorter、currentData/isFetching、stale once | `libraries/frontend/admin-ui-foundation/src/extension/*`；两 app `extensionList.tsx`；五页面 recovery/form refs | shared serializer/formatter/recovery/invalid summary；动态列无 sorter；currentData/isFetching 与 namespace clearing MATCHED |
| interaction §4.2、§9；详设 §12；计划 P4/P9：real action nodes stable TestId | `extensionTestIds.ts:8`；`ExtensionDefinitionEditDrawer.tsx:397-399`；`ExtensionDefinitionEditDrawer.test.tsx:99-149` | cancel TestId 绑定真实 footer Button；click→requestClose、submitting disabled 2/2 PASS；r4 MATCHED |
| requirements §7–§10；详设 §14–§15；计划 P5/P8：fixture/seed/acceptance/privacy/failure parity | seed executor/plan/profile；three acceptance scenario files；remote manifests/logs | SIZE-XL 首败已根修并 reset/reseed；最终 seed、acceptance、cleanup PASS；无 raw filter value/password/token 等敏感日志 |
| requirements §1.1、§3.1；IA §2.2/§5；详设 §12/§14：tree unchanged | existing hierarchy tree route/detail/presentation and no extension query on tree paths | tree remains existing name/code search/detail; no dynamic column/search/filter/snapshot/scenario/seed addition；MATCHED |

```text
P9_CODE_TO_DESIGN_RECONCILIATION=COMPLETE
P9_OPEN_ITEMS=NONE
P9_DESIGN_GAPS=NONE
```

### 10.4 真实失败与处置记录

```text
SEED_FIRST_FAILURE=SEED_BUSINESS_LABEL_SET_DRIFT:SKU_ATTRIBUTE_VALUE
ROOT_CAUSE=fixture catalog dictionary omitted SIZE-XL while parity plan required it
REPAIR=scripts/generate/catalog-inventory-p1.mjs added SIZE-XL=超大杯; regenerated catalog inventory P1 and seed plan
FOCUSED_PROOF=catalog executor test 10/10 PASS; final catalog seed and complete seed business/cleanup PASS

DEV_START_FORM_FAILURE=R5_DEV_START=REFUSED; REASON=ARGUMENT_INVALID
CAUSE=wrapper accepts no --profile argument
REPAIR=reran canonical scripts/dev/start; final DEV start PASS with manifest/process identities

DEV_TUNNEL_FIRST_FAILURE=Read from remote host 47.106.121.27: Can't assign requested address; client_loop: send disconnect: Broken pipe
DEV_TUNNEL_BOUNDARY=previous manifest tunnel PID 3706 absent while platform/operations Vite remained alive; local HTTP health probe failed with HTTP_STATUS=000
DEV_TUNNEL_REPAIR=used owned-manifest scripts/dev/restart; managed stop PASS and canonical start PASS
DEV_TUNNEL_FINAL=run r5-dev-1789436182629-23649-a1977bbb-b74b-477f-b278-f6a4b1f733dd; remote readiness marker TRUE; tunnel PID 33865 listens on 28080/29000; platform and operations probes HTTP 200

LOCAL_TESTCONTAINERS_FORM_FAILURE=V2S_TESTCONTAINERS_REMOTE_REQUIRED
BUSINESS=NOT_RUN
CLEANUP=NOT_APPLICABLE
CLASSIFICATION=execution-form failure; no local resources created; canonical remote runner later PASS
```

上述失败均已保留 first failure、根因、修复和后续证据，不以重试或改名掩盖。

## 11. 最新受管证据与当前复审状态（2026-09-15；覆盖 10.2/10.3 的旧运行数字）

本节是当前字节的最新动态事实。第 10 节中的旧运行目录、旧预算数字和旧 DEV 状态保留为历史记录；凡与本节冲突之处，以本节为准。fresh 独立 implementation reviewer 已返回 verdict；本节记录其原始结论及主 agent 的逐条 intake，不把历史 reviewer 结论冒充本轮结论。

```text
CURRENT_REVIEW_TARGET=IMPLEMENTATION
CURRENT_REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_IMPLEMENTATION_20260915
CURRENT_REVIEW_ROUND=1
CURRENT_FRESH_REVIEWER=Popper; agent=01a0a37a-ecd4-71e3-a232-58684810d038; read-only; completed
CURRENT_FRESH_REVIEW_VERDICT=GO; M/S/N=0/0/2
CURRENT_P6_P7_P9_STATUS=FRESH_INDEPENDENT_REVIEW_COMPLETE; AUTHOR_INTAKE_COMPLETE
CURRENT_SCOPE=8 hosts; 12 screens; 10 flat consumers; 7 list operations; tree unchanged
CURRENT_BROWSER_L2=NOT_RUN_UNAUTHORIZED
```

### 11.1 CP05 校准和普通 acceptance

| run | mode | batch cardinality | business | operation set | budget | cleanup | 结论 |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789447620559-58804/` | `CALIBRATION` | 1 | `PASS` | `269/269`, missing/extra/drift `0` | calibration source | `PASS` | valid calibration sample |
| `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789446413531-85798/` | `CALIBRATION` | 20 | `PASS` | `269/269`, missing/extra/drift `0` | calibration source | `PASS` | valid calibration sample |
| `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789447975719-70788/` | `CALIBRATION` | 100 | `PASS` | `269/269`, missing/extra/drift `0` | calibration source | `PASS` | valid calibration sample |
| `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789448750623-27172/` | `ACCEPTANCE` | 20 | `PASS` | `269/269`, missing/extra/drift `0` | declared `269`, observed `269`, exceeded `0` | `PASS` | current ordinary acceptance PASS |

CP05 report `contracts/policy/backend-performance-cp05-calibration-report.json` 当前为 `BUDGET_READY=269`、`BUDGET_BLOCKED=0`。七个本批目标 operation 的三次 calibration 最大 DB operation 数为：

```text
getOperationsContracts=12
getOperationsOrganizationBrands=11
getOperationsOrganizationHeadCompanies=11
getOperationsOrganizationStores=15
getOperationsOrganizationTenants=11
getPlatformContractOverviewPage=9
getPlatformOrganizationOverviewPage=11
```

批量 operation 的真实线性观测为 `1→19`、`20→112`、`100→512`，预算 `15 + 5N` 的允许上限分别为 `20/115/515`，三点均通过。普通 acceptance 的生成物已由 `node scripts/generate/edge-codegen.mjs --write` 同步；`edge-codegen --check`、后端 `compileTestJava` 均 PASS。

### 11.2 首败、根因与修复

```text
ORDINARY_ACCEPTANCE_FIRST_FAILURE=r5-tc-1789448360590-3458
ORDINARY_ACCEPTANCE_FIRST_FAILURE_SIGNAL=PERFORMANCE_OPERATION_BUDGET_EXCEEDED:getOperationsContracts:kind=FIXED:actual=12:max=8
ORDINARY_ACCEPTANCE_BUSINESS=PASS
ORDINARY_ACCEPTANCE_CLEANUP=PASS
BROKEN_BOUNDARY=MEASUREMENT_EVIDENCE
ROOT_CAUSE=CP05 report 已更新为实测 max=12，但 edge-route-face-registry 等 374 个 generated outputs 仍保留旧 max=8
REPAIR=node scripts/generate/edge-codegen.mjs --write
FOCUSED_PROOF=edge-codegen --check=PASS; compileTestJava=PASS
REVERIFY=r5-tc-1789448750623-27172; BUSINESS=PASS; budget declared/observed=269/269; exceeded=0; CLEANUP=PASS
```

失败 run 不被重命名或覆盖；它证明了“校准 report 与 generated output 必须同一生成链同步”的通用失败模式，当前修复也已纳入 P9 generated-code 对账。

### 11.3 五表 scale 与索引证据

```text
SCALE_RUN=.runtime/r5/evidence/remote-testcontainers/r5-tc-1789445514821-36502/
SCALE_EVIDENCE=extension-scale-evidence.json
TABLES=organization.brand,organization.tenant,organization.head_company,organization.store,contract.store_contract
ROW_TARGET=100000 per table
QUERY_RESULT_COUNT=60 (5 tables x 6 query classes); EXPLAIN_SAMPLES_PER_QUERY=3
INDEX_DECISION=BOUNDED_CORE_SCOPE_SCAN
RUNTIME_DDL=false
PER_KEY_EXPRESSION_INDEXES=false
BUSINESS=PASS
CLEANUP=PASS
```

`ExtensionScaleProof` 当前实现和最新 evidence 均以五表各 100,000 行、empty/equality/TEXT/AND/no-match/cross-page 六类查询、每个查询结果 3 次真实 `EXPLAIN (ANALYZE, BUFFERS)`、recheck/分页与写入信息为判据；机器实际查询结果总数以 evidence `queries.length=60` 为准。此前同一专题的失败 scale run 和 SQL alias 首败均保留，不替代最新 PASS。

### 11.4 P9 最新逐代码对账（fresh r5 已完成）

| P9 symbol/change | 详设判据 | 当前源码/生成物 | 当前 evidence | 作者结论 |
| --- | --- | --- | --- | --- |
| `ExtensionFilterQuery.parseWire` / `prepare` | 详设 §6.2–§6.4：string wire、typed validation、empty array/revision ordering、safe JSONB predicate | `modules/extension/.../ExtensionFilterQuery.java`、`ExtensionValueSemantics.java`、`ExtensionFilterQueryTest.java` | compileTestJava PASS；managed extension scenario PASS | `MATCHED; fresh r5 GO` |
| `ExtensionFieldType` + `ExtensionFilter` reachable closure | 详设 §4.1、§6.2：shared enum/component，`value` 可生成 string，唯一 serializer/parser | `contracts/openapi/components/extension/extension.schemas.json`、active edge catalog、`scripts/generate/edge-codegen.mjs` | `edge-codegen --check=PASS`; 374 outputs consistent | `MATCHED; fresh r5 GO` |
| seven owner query/controller/page projections | 详设 §4.2、§7、§10、§12：core+extension AND、Page 同集、raw `extensionValues`、revision、scope | organization/contract owner services、7 controllers、generated Page/query and adapters | ordinary acceptance `269/269`, all target business PASS | `MATCHED; fresh r5 GO` |
| `ExtensionHostTypes` / definition normalization | 详设 §4、§12：flat five hosts boolean；tree three hosts null/N/A | extension owner service/readback、platform Drawer | compileJava/compileTestJava、focused UI tests PASS | `MATCHED; fresh r5 GO` |
| foundation typed serializer/formatter/stale/invalid namespace | 详设 §7、§8、§10：shared capability、typed controls、stale once、core preservation、visible invalid summary | `libraries/frontend/admin-ui-foundation/src/extension/*`、5 page recovery/form refs | foundation 54 tests PASS；app architecture/unit/typecheck PASS | `MATCHED_STATIC; fresh r5 GO` |
| 10 flat consumers / fixed dynamic columns | 详设 §5.2–§5.4、IA §5–§6：fixed/no-sort、displayOrder+key、typed search controls | two app `extensionList.tsx` + 5 list page components | static/source tests PASS；browser L2 not run/unauthorized | `MATCHED_STATIC; fresh r5 GO` |
| Drawer real action/testId/defaults | 详设 §7、§12；interaction §4、§9：flat false/false、tree null/null、real cancel Button | `ExtensionDefinitionEditDrawer.tsx`、`extensionTestIds.ts`、focused test | clean focused evidence 2/2 PASS | `MATCHED; fresh r5 GO` |
| scale/index/write-cost | 详设 §8.1–§8.3 | `ExtensionScaleProof.java` + latest evidence | 5 x 100k、60 queries、EXPLAIN/BUFFERS、no runtime/per-key index | `MATCHED_MANAGED; fresh r5 GO` |
| CP05 seven budgets/generated projections | 详设 §9、计划 P3/P8 | calibration report + generated route registries | 3 calibration PASS; `READY=269/BLOCKED=0`; ordinary acceptance budget `269/269` | `MATCHED_MANAGED; fresh r5 GO` |
| seed/acceptance/log privacy/failure parity | 详设 §14–§15、计划 P5/P8 | fixture/executor/seed plan/AcceptanceScenarios/managed runner | final reset/start/complete r5-full seed PASS; revision/readback and four-stage parent receipt present | `MATCHED_MANAGED; fresh r5 GO` |
| tree unchanged | 需求 §1.1、§3.1；IA §2.2/§5；详设 §12/§14 | hierarchy routes/page/detail and tree wire path | static tree boundary; no L2 requested | `MATCHED_STATIC; fresh r5 GO` |

```text
P9_CODE_TO_DESIGN_RECONCILIATION=CURRENT_AUTHOR_MATRIX_COMPLETE_WITHOUT_OPEN_IMPLEMENTATION_ITEM
P9_OPEN_ITEMS=NONE_FROM_AUTHOR_READBACK_OR_FRESH_REVIEW
FRESH_REVIEW_INTAKE=COMPLETE; M/S/N=0/0/2; no confirmed implementation finding
DESIGN_GAPS=NONE_CONFIRMED; any new gap must be returned to design side
```

### 11.5 Fresh r5 finding intake 与下一步边界

fresh reviewer Popper 已返回 `GO`、`M/S/N=0/0/2`，原始留痕见 `doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r5.md`。两条 N 输入均已逐条回源：其一是 LSP transport/tooling limitation，现以 edge-codegen、Gradle compile、前端 typecheck/unit/architecture 与 managed evidence 作为更强的既有编译/运行证据，分类为 `REJECTED_WITH_EVIDENCE`，不改生产代码；其二是 browser L2 未运行且未授权，正是当前边界，分类为 `REJECTED_WITH_EVIDENCE`，不执行 L2。无 CONFIRMED、PARTIALLY_CONFIRMED blocker，无 design gap，无 author OPEN implementation item。

reviewer P8 文本曾引用历史 scale run 并写 total query `30`；主 agent 已回源最新 evidence，当前事实为五表各 100,000 行、每表 6 类、`queries.length=60`、每 query 3 次 EXPLAIN，已修正本节和 Claude handoff，原始 reviewer verdict 不被改写。

现在 review closure、最终 reset、DEV start、完整 r5-full seed 及其 business/cleanup/readiness/manifest 读取均已完成。当前 DEV 保持运行供体验；browser L2 仍为 `NOT_RUN_UNAUTHORIZED`，不作为本批实现完成条件。

### 11.6 最终 reset / DEV / seed 事实

```text
FINAL_RESET=PASS
FINAL_RESET_RUN=.runtime/r5/reset/r5-reset-1a54514e-e1c9-4c76-b589-a7001594302f/
FINAL_DEV_START=PASS
FINAL_DEV_RUN=r5-dev-1789449702279-54617-4d01c1db-be81-41c6-89e4-559fcbcdc573
FINAL_DEV_MANIFEST=.runtime/r5/run-manifest.json
FINAL_DEV_TOPOLOGY=REMOTE_JAVA_LOCAL_DATABASE_LOCAL_VITE_HTTP_AND_ASSET_ONLY_TUNNEL
FINAL_DEV_READINESS=REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY; platform-admin=READY; operations-admin=READY
FINAL_DEV_PORTS=platform-admin:5174; operations-admin:5175; http-tunnel:28080; asset-tunnel:29000
FINAL_COMPLETE_SEED=PASS
FINAL_COMPLETE_SEED_RUN=.runtime/r5/seed/complete/complete-seed-c44513ba-c7a6-47ca-9df8-70ab27123a4d/
FINAL_COMPLETE_SEED_REPORT=.runtime/r5/seed/complete/complete-seed-c44513ba-c7a6-47ca-9df8-70ab27123a4d/seed-report.json
FINAL_COMPLETE_SEED_MARKDOWN=.runtime/r5/seed/complete/complete-seed-c44513ba-c7a6-47ca-9df8-70ab27123a4d/seed-report.md
FINAL_COMPLETE_SEED_BUSINESS=PASS
FINAL_COMPLETE_SEED_CLEANUP=PASS_PRESERVED_DEV_STATE
FINAL_COMPLETE_SEED_FIRST_FAILURE=NONE
FINAL_OWNER_READBACK=PASS; extensionDefinitions=8; extensionValueEntities=37; hosts=8
FINAL_BROWSER_L2=NOT_RUN_UNAUTHORIZED
FINAL_START_RESOURCE_PREFLIGHT=PASS; live managed processes were 0 before start
POST_START_RESOURCE_CHECK=EXPECTED_NON_GATE; checker intentionally returns MANAGED_RESOURCE_BUDGET_EXCEEDED when it sees live owned DEV processes
```

最终 DEV manifest 的三棵受管进程树仍由 manifest identity 绑定；本机 `5174/5175` 两个入口 HTTP `200`。seed 父 receipt 的四个阶段均为 PASS，owner child report 含 extension revision change/readback，catalog/sales-menu 的关联缺口均为空。最后一次资源 checker 是在 DEV 已启动后执行的，它按设计把“存在 live managed process”作为下一次 run 的拒绝条件，不是当前 DEV 的失败或 cleanup 结论；启动前预检已 PASS。当前 DEV 不因 seed 完成而自动停止。

### 11.7 Claude 第二轮 IMPLEMENTATION finding intake：仅修复代码逻辑问题

本节是对 Claude 第二轮静态复审转交材料的最新处置，优先级高于本文件较早的历史收口段；历史 finding、运行产物和原始 reviewer verdict 均不改写。

| finding | 当前处置 | 是否代码逻辑 | 依据与结果 |
| --- | --- | --- | --- |
| `S-01` budget 放宽决策记录不足 | 不补 | 否；预算账本/evidence 治理缺口 | 详设 §9 的 decisionRef 与三次测量记录要求；按 Dexter “单纯 evidence 不全可以不用再提供”规则保留为不重提项 |
| `S-02` platform/contract task read 路径与预算 | 不改 | 当前未确认是本批代码逻辑缺陷 | 当前 owner `page/list/taskPage/platformOverviewTaskPage` 仍保持同一 typed owner path；total 与 items 使用同一过滤谓词集合；额外 SQL/性能与 historical snapshot 属证据/预算边界，不能凭此删除 owner 事实 |
| `S-03` P9 粗粒度对账 | 不补 | 否；evidence/对账完整性 | 按 Dexter 规则不再提供新增 evidence |
| `N-01` 动态列缺 ellipsis/width | 已有修复保持不动 | 否；当前字节已满足 | 两侧 adapter 已有 `ellipsis: {showTitle: false}`、`width: 180` 且无 sorter；operations/platform focused static tests 已通过 |
| `N-02a/b/c` stale recovery | 已修复并复查 | 是 | 详设 §6.3、需求 §7.3、交互 §1/§7；五个 recovery scope 均失败保持 list skip、显示可重试错误、scope 单次 gate、校验 reread revision 下界、typed reconcile、保留 core、回第一页、显式查询/重置可解除 |
| `N-03` request/container 上限 | 不补 | 否；契约/运行 evidence 边界 | 按 Dexter 规则不再提供新增 evidence |
| `N-04` generated `ExtensionFilter` 关联 | 已有修复保持不动 | 否；当前字节已满足 | 两个 adapter 已有 generated `ExtensionFilter` 与 foundation wire 的双向 assignability 检查；typecheck 已通过 |
| `N-05` seed 特殊值/失效 option | 不补 | 否；fixture/evidence 覆盖缺口 | 按 Dexter 规则不再提供新增 evidence |
| `N-06` 门店 100k 延迟与索引判断 | 不改 | 当前不能判为代码逻辑缺陷 | 性能阈值/规模 evidence 与产品可接受性边界；未获新的阈值裁决，不凭观测数字改业务查询语义 |
| `DG-1` generated key reuse | 已修复并已有 focused proof | 是 | 需求 §8.5；历史 before/after audit summary 与当前显式 key 共同保留 `field_N`，不重用被删除 key；isolated managed test PASS |
| `DG-2` 至 `DG-6`、`L3` | 不补 | 否；设计/evidence 缺口 | 按 Dexter 规则不再提供新增 evidence；不把它们升级成代码逻辑 finding |

#### N-02 代码修复后的逐点复查

fresh 独立 reviewer Bernoulli 的原始留痕为 `doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r6.md`，结论为：

```text
REVIEW_TARGET=STEP_RECONCILIATION
reviewerKind=INDEPENDENT_SUBAGENT
STEP_RECONCILIATION=MATCHED
OPEN_COUNT=0
N-02_CODE_LOGIC=FIXED
```

其逐项核对的当前 owning source 与设计位置：

| 变更点 | 当前源码 | 详设判据 | 结果 |
| --- | --- | --- | --- |
| 失败/无 data/低 revision 不解除 list skip | `staleRecovery.ts`、operations 三页、`PlatformReadPage.tsx` | 需求 §7.3；交互 §1、§7；详设 §6.3 | `MATCHED` |
| 自动 recovery 同 scope 只 claim 一次 | `createExtensionFilterStaleRecoveryGate` | 详设 §6.3 | `MATCHED` |
| reread revision 不低于 stale payload 下界 | `isExtensionDefinitionRevisionAtLeast` 及五个调用点 | 需求 §7.3；详设 §6.3 | `MATCHED` |
| typed reconcile/core/page=1/显式解除 | 五个 recovery callback、各页面 submit/reset | 需求 §7.3；交互 §1、§7 | `MATCHED` |

#### 本轮 focused proof

```text
FOUNDATION_TEST=55/55 PASS
OPERATIONS_ARCHITECTURE=42 PASS; 4 TODO; 0 FAIL
OPERATIONS_UNIT=257/257 PASS
OPERATIONS_TYPECHECK=PASS
PLATFORM_ARCHITECTURE=17 PASS; 1 TODO; 0 FAIL
PLATFORM_UNIT=26/26 PASS
PLATFORM_TYPECHECK=PASS
RECOVERY_STEP_REVIEW=Bernoulli MATCHED; OPEN_COUNT=0
```

本轮没有因为 evidence-only finding 重跑动态环境。此前受管动态事实保持原始分类：完整 extension module test run `r5-tc-1789454879665-70973` 首败为测试 fixture 共享状态导致的两个既有场景失败，`business=NOT_APPLICABLE`、`cleanup=PASS`、DEV stop `PASS`、restore `NOT_RUN`；针对 DG-1 的隔离运行 `r5-tc-1789455159275-77126` 为 `PASS`，且此前 Java compile 为 `PASS`。不将完整 module run 改报 PASS，也不以隔离测试替代全量 acceptance。

之后按既有 DEV 体验边界重新启动的当前 DEV 为 `r5-dev-1789455242871-78947-53803790-ab9a-4cca-9f4b-b7ed9d3a2e8b`，拓扑为 `REMOTE_TRUSTED_HOST / REMOTE_LOCALHOST / HTTP_AND_ASSET_ONLY`，remote Java 与两个本机 Vite 均由 manifest 绑定并 ready。当前修复只涉及前端运行时字节与 foundation，未再次 reset/seed；当前 DEV 保持运行，browser L2 仍未执行且不在本轮授权内。

```text
LATEST_CODE_LOGIC_CLOSURE=N-02 FIXED
LATEST_STEP_RECONCILIATION=MATCHED
EVIDENCE_ONLY_ITEMS=NOT_REPROVIDED_PER_DEXTER_RULE
CURRENT_DEV=RUNNING_MANAGED
RESET_SEED_THIS_TURN=NOT_RUN
```

### 11.8 Claude 最新复审后的代码逻辑修复与 fresh 复查

本节只处理 Claude 最新复审中可由当前源码证明的代码逻辑问题；预算、性能、fixture、P9 及其他单纯 evidence 缺口按 Dexter 指令不重新提供。Locke 的原始步骤审查保存在 `doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r7.md`，Aristotle 对修复后的 fresh 复查保存在 `doc/review/platform/2026-09-15-v2s-extension-field-list-search-implementation-independent-review-codex-r8.md`。

| finding | 分类 | 当前修复 | 详设/需求依据 | 当前结果 |
| --- | --- | --- | --- | --- |
| Claude S-01：手动重试依赖被 skip 的 list error，且 gate 用尽后 stale 无法恢复 | `CONFIRMED` | foundation `createExtensionFilterRecoveryState` 保存最近 stale lower bound；五个 recovery scope 的 retry 均重新 reread definition，并在第二次 stale 时走同一 recovery；旧回调由 token 丢弃 | 需求 §7.3；interaction §7；详设 §6.3 | `MATCHED` |
| Claude N-01：recovery late callback 覆盖新查询/Tab/scope | `CONFIRMED` | token 同时校验 scope 与 generation；submit/reset/scope/project/Tab/卸载路径均 invalidate；platform flags 按当前组织 Tab scope 隔离 | 需求 §7.3；interaction §1/§7；详设 §6.3 | `MATCHED` |
| Claude N-02：platform organization source=SYSTEM 对 BRAND/TENANT/HEAD_COMPANY/HIERARCHY 失效 | `CONFIRMED` | `OrganizationOverviewTaskReadPersistence.page` 在当前 owner projections 均为 MANUAL fact 的 BUSINESS_ENTITY/HIERARCHY 分支返回空；STORE 保留 `AND 1=0`；新增三类别测试 | 需求 §3.4、§10.2；详设 §7.2 | `MATCHED` |
| Claude N-03：recovery 中 list 显示空态，失败文案不符合交互 | `CONFIRMED` | 五个页面 loading 合并 recovery in progress；失败文案统一为“暂时无法获取…字段配置”+“请重试。” | interaction §7；详设 §6.3/§7.2 | `MATCHED` |
| Locke F-01：失败仍渲染旧 currentData rows | `CONFIRMED` | 五个 flat list 将 list/definition/recovery failure 同时用于 `dataSource=[]` 与 `adminListState.failed` | 需求 §5.2/§7.3；详设 §7.2 | `MATCHED` |
| Locke F-02：组织 Tab 切换旧 detail 回调可写入当前页面 | `PARTIALLY_CONFIRMED` | `changeOrganizationTab` invalidate detail generation、关闭旧 detail、清理 hierarchy selection | 详设 §7.2；interaction §1/§7 | `MATCHED` |

#### 当前代码与行为核对索引

```text
FOUNDATION_RECOVERY=staleRecovery.ts:33-67; foundation.test.ts recovery state test
OPERATIONS_BRAND_TENANT_HEAD=BusinessEntityManagementPage.tsx listDataFailed + recovery callback
OPERATIONS_STORE=StoreManagementPage.tsx listDataFailed + recovery callback
OPERATIONS_CONTRACT=ContractManagementPage.tsx listDataFailed + recovery callback
PLATFORM_RECOVERY=PlatformReadPage.tsx recovery flags/token/retry/detail invalidation
PLATFORM_SOURCE_SYSTEM=OrganizationOverviewTaskReadPersistence.page; OrganizationOverviewTaskReadServiceTest; OrganizationOverviewQueryTest
```

#### 本轮 focused proof 与动态边界

```text
FOUNDATION=typecheck PASS; 7 files / 56 tests PASS
OPERATIONS=typecheck PASS; architecture 42/42 PASS (4 TODO); unit 257/257 PASS; architecture lint PASS
PLATFORM=typecheck PASS; architecture 17/17 PASS (1 TODO); unit 26/26 PASS; architecture lint PASS
BACKEND_ORGANIZATION=compileJava PASS; compileTestJava PASS
NODE_HEALTH=test-health-entry-runner --self-test PASS; discovered/executed=35/35
BACKEND_TEST_ATTEMPT=local Gradle test blocked by V2S_TESTCONTAINERS_REMOTE_REQUIRED
BACKEND_DYNAMIC_BUSINESS=NOT_RUN
BACKEND_DYNAMIC_CLEANUP=NOT_APPLICABLE_NO_CONTAINER_STARTED
RESET_SEED_DEV_THIS_TURN=NOT_RUN
BROWSER_L2=NOT_RUN_UNAUTHORIZED
```

本地 Gradle 测试首败已保留为受管拓扑门拒绝，未通过本地 Docker 或其他绕过方式执行；organization 测试代码已由 compileTestJava 验证。Aristotle 的最终步骤复查为 `STEP_RECONCILIATION=MATCHED`、`OPEN_COUNT=0`、无新的代码逻辑 finding。

```text
LATEST_AUTHOR_INTAKE=COMPLETE
LATEST_FRESH_STEP_REVIEW=Aristotle; r8; PASS; STEP_RECONCILIATION=MATCHED; OPEN_COUNT=0
LATEST_CODE_LOGIC_FINDINGS=0
EVIDENCE_ONLY_ITEMS=NOT_REPROVIDED_PER_DEXTER_RULE
```

### 11.9 Claude 第二轮 N-01 处置：普通读取失败重试与定义失败文案

Claude 第二轮 `REVIEW_TARGET=IMPLEMENTATION` 静态复审结论为 `GO`、`M/S/N=0/0/1`。N-01 是本批内可确认的代码逻辑问题，按 Dexter 指令立即修复；其余仅 evidence 的观察不重新提供。当前只修改了 N-01 相关前端源码与详设/对账文档，没有启动 runtime、reset、seed、DEV、browser L2 或后端动态测试。

| 复审要求 | 当前处置 | 当前源码/文档锚点 | 结果 |
| --- | --- | --- | --- |
| 平台普通组织/合同列表读取失败可重试 | `PlatformReadPage.tsx` 的 `extensionRecoveryRetryAvailable` 纳入普通 list error；`retryExtensionRead` 在非 stale 时分别调用 `organizationQuery.refetch()` / `contractQuery.refetch()` | `apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`；`extensionRecoveryRetryAvailable`、`retryExtensionRead`、错误 `Alert.action` | `MATCHED` |
| 平台普通 definition 读取失败可重试且文案统一 | 新增 `extensionDefinitionProblem`；仅在对应 list 无错而 definition error 时显示对象化文案，重试调用对应 definition query `refetch()` | 同上；`extensionDefinitionProblem`、`organizationDefinitionQuery.refetch()`、`contractDefinitionQuery.refetch()` | `MATCHED` |
| 平台 stale/恢复失败行为不回退 | `retryExtensionRead` 优先对 recovery failed 或 stale 走既有 `recoverOrganizationExtensionFilters()` / `recoverContractExtensionFilters()`；普通 list/definition 错误才走直接 `refetch()` | 同上；`retryExtensionRead` 分支 | `MATCHED` |
| operations 三个实体列表普通 definition 失败文案 | Business entity、Store、Contract 页面分别以 `extensionDefinitionProblem` 替换通用 definition problem；既有 retry 分支继续重取 definition | `BusinessEntityManagementPage.tsx`、`StoreManagementPage.tsx`、`ContractManagementPage.tsx`；各自 `extensionDefinitionProblem` 与 `queryProblem`/`problemTitle` | `MATCHED` |
| 失败清空、loading、代次保护不被破坏 | 未改 `listDataFailed`、`dataSource=[]`、recovery generation/scope guard；仅增加错误投影与 retry dispatch | 五个 flat list 页面既有 `listDataFailed`/`adminListState` 与 recovery callbacks | `MATCHED` |
| DG-A | 在详设 §6.3 补充“手动重试走同一恢复流程，下界取自最近一次 stale 响应，由页面持有” | `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md` §6.3 | `MATCHED` |
| DG-B | 在详设 §6.3 补充历史 `field_N` 不重用规则，并明确审计记录上线之前删除的 key 不在保留范围内 | 同上 §6.3 | `MATCHED` |

本次 focused 静态验证：

```text
OPERATIONS_TYPECHECK=PASS
OPERATIONS_TEST=42 architecture tests PASS (4 TODO); 257 unit tests PASS
OPERATIONS_ARCHITECTURE_LINT=PASS
PLATFORM_TYPECHECK=PASS
PLATFORM_TEST=17 architecture tests PASS (1 TODO); 26 unit tests PASS
PLATFORM_ARCHITECTURE_LINT=PASS
RUNTIME_RESET_SEED_DEV_BROWSER_L2=NOT_RUN_BY_SCOPE
```

N-01 当前代码逻辑已关闭；按 Claude 明确口径，本次仅有 N-01 代码/文档改动，不重新准备 Claude review 请求。此前 dynamic/backend evidence 的原始分类保持不变，不由本次 focused 静态验证升级。

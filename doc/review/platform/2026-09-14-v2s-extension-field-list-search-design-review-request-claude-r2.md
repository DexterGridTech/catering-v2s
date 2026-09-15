# 扩展字段列表展示与类型化搜索 · Claude 新一轮外部 DESIGN 复审请求

```text
REVIEW_KIND=DESIGN_ARTIFACT_EXTERNAL_REVIEW
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_DESIGN_REMEDIATION_20260914
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
reviewerKind=CLAUDE_EXTERNAL_REVIEWER
ADVERSARIAL_REVIEW=TRUE
BLIND_REVIEW=TRUE
IMPLEMENTATION_AUTHORITY=false
RUNTIME_EXECUTION=NOT_RUN
VERDICT_REQUIRED=GO | GO_WITH_UNVERIFIED_UI | NO-GO
SEVERITY_FORMAT=M/S/N
EVIDENCE_TIER=STATIC_DESIGN_ONLY
INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN
```

## 背景

Claude 上一轮对五份设计材料给出 `NO-GO`，并指出定义来源/list wire、typed filter/codegen、类型语义、scale/budget、seed、acceptance oracle、§9a、独立复核、N/A、heritage 文案、用户可见文案、授权、testId 等问题。Codex 已逐条重新打开当前源码、OpenAPI、seed、项目 memory 和 review 规范，形成作者侧 intake，并按 Dexter 2026-09-14 的三项裁决重写材料：

1. 组织架构树完全不变：两个后台的树接口、树页面、树详情只保留现有名称/编码搜索；树扩展列、树扩展搜索、树 revision、树错误码、树 scenario、树 seed 全部不属于本需求。`COMMERCIAL_GROUP`、`REGION`、`PROJECT` 的两个 flag 显示“不适用”、不可编辑、不消费。
2. 所有平面列表按每个 workspace/project 作用域不超过 100,000 行设计；五张实际持有 `extension_values` 的表逐表写明 equality/TEXT contains 的 index/scan 候选、`EXPLAIN ANALYZE BUFFERS` 和写成本；不使用 runtime DDL 或 per-key expression index。
3. 七个平面 operation 的 DB operation budget 可以逐 operation 提出放宽，但必须独立 decisionRef、`authority=IMPLEMENTATION_AGENT`、from/to/measuredMax 三次测量、替代方案成本和双重准入，并保留 red mutation。

本轮因此是一次材料性范围变化后的新 DESIGN review cycle，不继承旧树范围、旧分母、旧 verdict 或旧轮次。当前设计已重写为 8 个 host、12 个 screen（2 配置 + 10 平面消费面）、7 个 list operation；树不进入目标实现分母。Codex 只修改了需求/Journey/IA/交互/详设/计划/review 文档，没有修改生产代码、OpenAPI、generated、数据库、测试、fixture、seed、依赖，也没有运行 DEV、reset、seed、backend acceptance、browser L2、UAT、部署或 Git。

## 评审目标

请从证伪立场独立复核当前 bytes 是否已经能够指导后续实现，并判断哪些 OPEN 是必要的停机项、哪些仍是真缺陷、哪些是不成立的担忧。不要因为作者文档写了“采用”“MATCHED”或“OPEN”就直接接受；请回到当前 owning source、项目 memory 和适用模板核验。

本轮至少确认：

1. 8 host、12 screen、10 个平面消费面、7 个 list operation 的分母是否真实；组织架构树是否确实只保留“不变”边界，且没有残留树实现/seed/scenario。
2. definition operation/response 是否逐 host 明确；7 个 list operation 是否统一 raw `extensionValues`、definition revision 和同一 Page 集合；platform 旧 `extensionFields[{name,value:string}]` 的 list/detail 消费是否在 §9a 有完整处理。
3. `listDisplay` 与 `searchable` 是否是独立 flag；flat boolean 与树 N/A nullable null 是否贯穿 contract/owner/readback/UI/invalid submission/seed。
4. `extensionFilters` 是否采用 codegen 可承载的 scalar query schema string + JSON array；logical `ExtensionFilter`、`definitionRevision`、当前 searchable 字段数量上限、所有 invalid 聚合和 stale 409 是否闭环。
5. TEXT 的 trim/case/%/_/escape、NUMBER/DATE/BOOLEAN/SELECT 的 typed equality 是否在 foundation formatter 和唯一 Java/SQL predicate 两端对齐，且没有第二套 formatter。
6. 五张表、100k 规模、workspace/project 组合条件、JSONB GIN/TEXT scan/trigram 候选、exact recheck、EXPLAIN、index write cost 和七个独立 budget delegation 是否可测且没有以牺牲业务事实换预算。
7. seed 是否真正能物化五种类型、状态/空/NULL/missing/历史 SELECT/特殊字符/跨页与 definition revision change；acceptance 是否放在正确 domain、fixture 超页、business oracle 为真实业务事实；browser recovery 是否没有塞进 backend。
8. 12 个 screen 的用户可见文案、核心条件、控件类型、dynamic column/no sort、空/加载/错误/重试、project prerequisite、容器滚动、焦点与 foundation/testId 是否与 owning source 和 IA 一致。
9. §9a 是否覆盖 contract、唯一 generated source/派生、backend owner/edge/migration、frontend model/surface/state、focused/static/HTTP/L2、fixture/seed/executor；`OrganizationOverviewDetailDrawer.tsx`、`ContractOverviewDetailDrawer.tsx`、`PlatformReadPage.tsx`、`HeadCompanyBrandAuthorizationActionAdapter.ts`、`platform-read-boundary.test.mjs`、两个 platform focused tests 和 generated catalogs 是否没有遗漏。
10. P6/P7/P9 是否真正建立步骤级、整体测试前和逐代码与详设对账；fresh 独立只读 review 当前尚未运行这一状态是否被诚实保留。

## 需阅读文件

请从 catering-v2s 仓库根直接打开：

- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`：修订后的需求正本、8 host/12 screen/10 flat/7 operation 分母；
- `doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md`：Journey、actor、flat-only 范围和树不变裁决；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md`：12 个 IA-ID、不可见维度、definition source、search denominator、Drawer hidden facts；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md`：12 个 screen、控件依赖图、交互线框、用户可见文案、container、testId 与 heritage hash；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md`：方案比较、CP、固定 17 机制行、7 operation、typed filter、5 表/100k/index、budget、§9a、seed、acceptance、停止条件；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md`：P0–P9、步骤级/整体三维对账、受管验证边界和 P9 逐代码与详设对账；
- `doc/review/platform/2026-09-14-v2s-extension-field-list-search-design-review-intake-codex-r1.md`（若文件名为当前仓内实际 intake 文件，请以 `rg` 定位）：本轮 Claude findings 的作者侧分类和处置，不替代当前源码；
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`doc/platform/claude-review-handoff-template.md`、`doc/decisions/templates/implementation-design-template.md`、`doc/decisions/templates/ia-design-template.md`、`doc/decisions/templates/ui-interaction-design-template.md`、`doc/decisions/templates/journey-decision-template.md`：仓界、模板和审查边界；
- `project-memory/index.md`、全部 `project-memory/kernel/*.md`、`project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/confirmed-business-language-corpus.md`、`project-memory/operations/claude-review-handoff-standard.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`：memory、业务语言和独立审查纪律；
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java`、`apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java`、`apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/persistence/ExtensionDefinitionPersistence.java`、`contracts/openapi/components/extension/extension.schemas.json`：8 host、definition JSONB、revision、现有类型/校验；
- `apps/frontend/platform-admin/src/features/extension-field-management/ui/ExtensionFieldManagementPage.tsx` 或当前源码中的配置 page owning path、`apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`、对应 Drawer：配置 table/Drawer；
- `apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx`、`apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx`、`apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx`、`apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`：10 个平面消费 owning source；
- `apps/frontend/platform-admin/src/features/organization-contract-overview/ui/OrganizationOverviewDetailDrawer.tsx`、`ContractOverviewDetailDrawer.tsx`、`HeadCompanyBrandAuthorizationActionAdapter.ts`、`platform-read-boundary.test.mjs`、`OrganizationOverviewPresentation.test.ts`、`OrganizationOverviewFilters.test.ts`：platform list/detail/adapter/boundary 影响面；
- 7 个 operations list path files（brand/tenant/head-company/store/contract）和 platform `organization-overview.paths.json`/`contract-overview.paths.json`：operationId、path、parameter、response、`x-consumer-faces`；
- `libraries/frontend/admin-ui-foundation/src/index.ts`：现有 Drawer/list/lifecycle/overlay/testId 能力；当前没有 extension formatter；
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260726_160000_000__extension_and_role_json_storage_alignment.sql`、`apps/backend/catering-business-server/src/main/resources/db/migration/V20260815_020000_000__catalog_item_short_name_column.sql`：五表 JSONB 与 pg_trgm/btree_gin 参考；
- `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`、实际 `EdgeProblemCode.java` 与 `ContractProblemAdvice`：typed problem 注册/映射正本；
- `contracts/policy/backend-performance-cp05-calibration-report.json`：7 operation 的 8/8/8/13/8/6/6 FIXED/READY baseline，不是 scale proof；
- `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`、`scripts/dev/owner-command-seed-executor.mjs`、`scripts/dev/r5-seed-plan.mjs`、`scripts/dev/profiles/r5-full.json`、相关 executor test/test-health runner：seed 形状、type、profile、注册；
- `scripts/README.md`、`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`：受管入口与真实 business scenario 规则。

## 独立核验重点

1. 先用当前 bytes 重算 8 host、12 screen、10 flat、7 operation；特别确认配置 page 的当前实际路径，不能把旧 all-v2 名称当 v2s source。
2. 逐字比较 requirements、Journey、IA、interaction、implementation design 中的平面共用段落和树不变段落；若存在一字偏差，报告具体段落。
3. 对 7 个 operation 逐项核验 method/path/face、definition operation、raw list wire、Page、core+extension AND、workspace/project/category+type identity、total/items/page、无逐行请求。
4. 对 `extensionFilters` 的 OpenAPI 结构做 codegen 可行性审查：query schema 必须存在，JSON array serializer/parser 只有一个，逻辑 component 与生成物不能分叉；revision stale 409、invalid aggregate 400 的 owner/registry/advice/generated/UI 映射必须闭环。
5. 对五张表逐表检查 100k 约束、JSONB equality、TEXT contains scan/trigram 候选、%/_ escaping、exact recheck、EXPLAIN、index 写成本和每 operation budget delegation；不要把 DB operation count 当成 scale。
6. 对 `ExtensionDefinitionService#requireDefinition` 当前 definition read 读数、enabled/searchable/listDisplay/status/options/type 校验、`ExtensionDefinitionService#replaceDraft` 的已启用平台管理员授权、expectedVersion/Idempotency-Key/receipt 做 source-first 复核。
7. 对 seed 的 6 文件全集、definition→values→definition change 顺序、NUMBER/DATE/BOOLEAN/SELECT 合法值、null/missing/disabled/历史 SELECT/特殊字符/跨页做可执行性审查；对 acceptance 的 domain 分配、scenario identity、fixture 超页和真实 business oracle 做审查。
8. 对 platform list/detail 的全部影响面和 generated catalogs 做 §9a 反向扫描；若写 N/A，必须有具体反例，不接受“无影响”。
9. 对 12 个 screen 检查 core query 和空态：brand“当前结果域暂无记录”、platform“暂无${tab.label}”、contract“请先选择项目/暂无合同”，合同核心字段和 project prerequisite，dynamic controls 类型，columns no sort，错误不变空成功。
10. 对 17 机制行、P6/P7/P9、主 agent 写入/证据边界、当前 fresh independent review 未运行和 L2 BLOCKED 做审计；不要把 checker PASS 升级为 design GO。
11. 本轮只做静态 review，不执行任何动态命令或写入；不启动 DEV、reset、seed、backend acceptance、browser L2、UAT、部署或 Git。

## 期望结论

请明确输出：

- `REVIEW_TARGET=DESIGN`；
- `VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO`；
- `M/S/N` 数量；
- `L1_ENGINEERING`、`L2_USER_VISIBLE`、`L3_UNVERIFIED`、`SAME_ROOT_SCAN`、`DESIGN_GAPS`、`EVIDENCE_TIER=STATIC_DESIGN_ONLY`。

每条 finding 必须写：`CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`；精确仓根相对路径与行号/唯一 symbol/段落；当前源码/设计事实；后果；有限适用范围；反例或可复验观察；最小修复；是否需要 Dexter 产品/Journey/权限/契约裁决；同根 sibling 扫描和唯一预防落点。

如果 low-fi 尚未取得 Dexter 视觉接受，请明确是否只能给 `GO_WITH_UNVERIFIED_UI` 或 `NO-GO`。请不要把 static design verdict 升级为 implementation、OpenAPI/generated、migration、seed、DEV、reset、backend acceptance、browser L2、UAT、部署、Git 或性能授权。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对“扩展字段列表展示与类型化搜索”的 Journey、IA、交互工件、implementation-facing 详设和实施计划进行新一轮外部静态 DESIGN 复审。

背景：上一轮 Claude 对五份设计材料给出 NO-GO，并指出定义来源/list wire、typed filter/codegen、类型语义、规模/预算、seed、acceptance oracle、§9a、独立复核、N/A、heritage、用户可见文案、授权和 testId 等问题。Codex 已逐条重开当前源码、OpenAPI、seed、项目 memory 和 review 规范，分类为 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，并据此重写当前材料。本轮因 Dexter 对树范围作了材料性裁决，建立新的 review cycle，不继承旧树范围、旧分母或旧 verdict。

Dexter 的当前范围裁决是：组织架构树保持现状，运营管理后台和运维管理后台的组织架构树只保留现有的名称/编码搜索；树接口、树页面、树详情都不改。COMMERCIAL_GROUP、REGION、PROJECT 的 listDisplay 与 searchable 均显示“不适用”、不可编辑、不产生任何消费；候选选择器也不属于本需求。当前目标分母是 8 个 host、12 个 screen（2 个配置 + 10 个平面消费面）、7 个平面 list operation；组织树不进入实现、acceptance、seed 或 operation 分母。

Dexter 另两项规则是：每个平面 list 的 workspace/project 作用域最多 100,000 行；五张真实 extension_values 表要逐表说明 equality/TEXT contains 的 index/scan、EXPLAIN ANALYZE BUFFERS、命中/recheck 和写入代价，不能 runtime DDL 或 per-key expression index。七个 list operation 的 8/8/8/13/8/6/6 只是现有 DB operation count FIXED baseline；如需放宽，必须每 operation 一个 decisionRef、authority=IMPLEMENTATION_AGENT、from/to/measuredMax 三次测量、替代方案成本、双重准入，并保留 red mutation。

目标：请先从“当前详设和计划为什么仍可能不成立”出发，以当前 bytes 独立核验：
1. 8 host、12 screen、10 flat、7 operation 分母及树 zero-change 边界；
2. definition operation/response、raw extensionValues、definitionRevision、7 个 owner Page 的 core+extension AND、total/items/page 和权限；
3. listDisplay/searchable 独立 flag、flat boolean/tree nullable N/A、enabled/status/options/type 校验；
4. extensionFilters 的 scalar query schema string + JSON array、唯一 ExtensionFilter serializer/parser、definitionRevision、由 searchable field 数量决定的上限、409 stale/400 invalid 全量聚合和实际 error registry/generated/advice mapping；
5. TEXT 的 trim/case/%/_/escape 与 NUMBER/DATE/BOOLEAN/SELECT typed semantics 在唯一 foundation formatter 和唯一 Java/SQL predicate 中一致；
6. 五张表 100k 计划、EXPLAIN、index/scan、recheck、write cost 和七个独立 budget delegation；
7. seed 六文件全集及 definition→values→revision-change 顺序、五种 type/状态/空值/历史 SELECT/特殊字符/跨页；acceptance 的 domain、fixture、真实 business oracle 与 browser recovery 分层；
8. §9a 的 platform list/detail/generated/test/fixture/seed 全链；
9. 12 个 screen 的文案、控件、动态列无排序、合同 project prerequisite、loading/error/retry、foundation、stable testId 和容器/焦点；
10. 17 个机制行、P6/P7/P9 和当前 fresh independent review 未运行/L2 BLOCKED 的诚实性。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md：需求正本和 8/12/10/7 分母；
- doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md：Journey 与树不变范围；
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md：IA、不可见维度、definition source、search denominator、Drawer hidden facts；
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md：12 个 screen、控件依赖、线框、文案、container、testId、heritage hash；
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md：17 条机制行、CP、7 operation、typed filter、5 表/100k/index、budget、§9a、seed、acceptance、stop conditions；
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md：P0–P9、步骤级/整体三维对账、P8 受管边界和 P9 逐代码与详设对账；
- doc/review/platform/2026-09-14-v2s-extension-field-list-search-design-review-intake-codex-r1.md：作者侧 finding 处置历史；
- AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、doc/platform/claude-review-handoff-template.md、doc/decisions/templates/journey-decision-template.md、doc/decisions/templates/ia-design-template.md、doc/decisions/templates/ui-interaction-design-template.md、doc/decisions/templates/implementation-design-template.md：授权、模板和审查纪律；
- project-memory/index.md、全部 project-memory/kernel/*.md、project-memory/decisions/deterministic-context-only.md、project-memory/decisions/confirmed-business-language-corpus.md、project-memory/operations/claude-review-handoff-standard.md、doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md：memory、业务语言、独立审查和轮次边界；
- apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java、apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java、apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/persistence/ExtensionDefinitionPersistence.java、contracts/openapi/components/extension/extension.schemas.json：host、definition JSONB、revision、类型校验；
- apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx、对应 ExtensionDefinitionEditDrawer.tsx、apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx、apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx、apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx、apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx：配置和平面 owning source；
- apps/frontend/platform-admin/src/features/organization-contract-overview/ui/OrganizationOverviewDetailDrawer.tsx、ContractOverviewDetailDrawer.tsx、HeadCompanyBrandAuthorizationActionAdapter.ts、platform-read-boundary.test.mjs、OrganizationOverviewPresentation.test.ts、OrganizationOverviewFilters.test.ts：platform 全链消费者；
- 对应 7 个 operations/platform list path files、libraries/frontend/admin-ui-foundation/src/index.ts、apps/backend/catering-business-server/src/main/resources/db/migration/V20260726_160000_000__extension_and_role_json_storage_alignment.sql、V20260815_020000_000__catalog_item_short_name_column.sql、doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json、实际 EdgeProblemCode.java/ContractProblemAdvice、contracts/policy/backend-performance-cp05-calibration-report.json、r5 seed fixture/executor/plan/profile/test-health、scripts/README.md 和 acceptance standard。

请重点输出：L1_ENGINEERING、L2_USER_VISIBLE、L3_UNVERIFIED、SAME_ROOT_SCAN、DESIGN_GAPS、EVIDENCE_TIER=STATIC_DESIGN_ONLY。每条 finding 按 M/S/N 给出分类、CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED_REQUIRES_EVIDENCE/DEXTER_DECISION、精确路径与行号/唯一 symbol/段落、事实、后果、反例、最小修复、是否需要 Dexter 裁决和唯一预防落点。请明确 REVIEW_TARGET=DESIGN、VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO 和 M/S/N 数量；如果发现真问题，请不要默认接受作者处置。

授权边界：本次只授权对上述当前设计材料、当前源码、模板、项目 memory 和静态 evidence 做外部 DESIGN review；不授权修改任何文件，不授权生产代码、OpenAPI/generated、数据库/迁移、测试、fixture、seed 执行、DEV、reset、backend acceptance、browser L2、UAT、部署或 Git。请不要执行动态命令。谢谢。
```

当前未运行 fresh independent design review；本 brief 也不把自身或 handoff checker 结果当作 review verdict。

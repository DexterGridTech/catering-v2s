# 扩展字段列表展示与类型化搜索 · 详设与实施计划 Claude 外部 DESIGN 复审请求

```text
REVIEW_KIND=DESIGN_ARTIFACT_EXTERNAL_REVIEW
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_DESIGN_20260914
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=EXTERNAL_CLAUDE_REVIEW_LIMIT_SET_BY_DEXTER
reviewerKind=CLAUDE_EXTERNAL_REVIEWER
ADVERSARIAL_REVIEW=TRUE
BLIND_REVIEW=TRUE
IMPLEMENTATION_AUTHORITY=false
RUNTIME_EXECUTION=NOT_RUN
VERDICT_REQUIRED=GO | GO_WITH_UNVERIFIED_UI | NO-GO
SEVERITY_FORMAT=M/S/N
EVIDENCE_TIER=STATIC_DESIGN_ONLY
```

## 背景

上一轮 Claude 外部 review 审的是扩展字段需求正本，并指出需求修订后应继续形成 Journey、IA、交互工件、implementation-facing 详设和实施计划。Codex 之前漏掉了这一步；本轮已按 `cs-spec-to-plan` 与 `cs-writing-plans` 补齐以下当前字节：

- `doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md`
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md`
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md`
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md`
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md`

本轮没有修改生产代码、OpenAPI、generated output、数据库、测试、seed、脚本或依赖，也没有执行 DEV、reset、seed、backend acceptance、浏览器 L2、UAT、部署或 Git。五份文档明确 `IMPLEMENTATION_AUTHORITY=false`、`RUNTIME_AUTHORITY=NONE`；Journey、IA、交互工件仍是 `PROPOSED`/`UNSET`，不能把文档编写动作解释成 Dexter 的视觉接受或实现授权。

当前设计刻意保留三类需 review 的 OPEN：平台组织树当前 wire 没有节点扩展属性；`extensionFilters` 的 JSON encoded array 最终 encoding/长度/数量约束；新增 typed problem 的唯一 owner 注册与 HTTP mapping。它们必须被 Claude 判断为合理的停机项、需 Dexter 裁决项或真实设计缺陷，不能被默认填成确定事实。

## 评审目标

请把本轮作为新的 `REVIEW_TARGET=DESIGN`，独立复核详设和实施计划是否真的能指导后续实现，而不是只检查文档是否存在。请先从“这套详设/计划为什么仍可能不成立”出发，再回读需求、IA、交互工件、当前源码和项目 memory；不要因为 Codex 已写出 `采用`、`MATCHED` 或 `OPEN` 就直接接受。

至少判断：

1. Journey 是否仍只表达一个业务能力，且覆盖八类宿主、十个平面消费面和两个树面；候选选择器排除是否没有误伤合同列表的核心经营租户条件。
2. IA 的 14 个 screen 是否逐项覆盖可见/不可见维度；交互工件的 14 个 screen、低保真线框、surface ownership、容器滚动、testId roster 是否与 IA/需求逐字一致。
3. implementation-facing 详设是否确实使用模板固定 17 条机制行，且每行都有精确现成能力、可做观察、无现成时的实现形态和完整适用全集；是否存在“参考既有形态”但不能逐代码对账的空话。
4. 七个平面 operation 是否选择了正确的 `extensionFilters` 传递方式；owner 是否能在同一查询中完成核心+扩展 AND、total/items/page、typed value projection、权限和 definition revision；是否有更小的方案被不必要地拒绝或存在过度设计。
5. 两个树 operation 是否正确区分运营完整 workspace snapshot 与平台 selected workspace projection；商业集团 root 不成为搜索项；REGION/PROJECT 搜索和祖先闭包正确；平台树契约 gap 是否被安全地停在契约层而非用逐节点详情伪修复。
6. definition drift、RTK cache bypass、problem revision 下界、一次自动恢复、同版本停止、树 snapshot revision 是否形成可终止闭环；失败是否会被旧数据/空结果/文本降级掩盖。
7. `§9a` 全链同步矩阵、`§10b` seed 全集和 `§11` acceptance 场景是否真实覆盖 contract/generated/owner/edge/frontend/test/fixture/seed；business oracle 是否不是状态码或 `response.ok`；是否把 seed 与 acceptance 正确分开。
8. 实施计划是否真的包含逐步骤三维对账、整体测试前三维对账和交付前“逐代码与详设对账”；是否明确主 agent 写入/证据边界、独立 reviewer 只读边界和不授权动态执行。

## 需阅读文件

请从 `catering-v2s` 仓库根直接打开：

- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`：修订后的需求正本和八类/页面/operation 分母；
- `doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md`：本 Journey 的用户任务、宿主全集、前提链和待裁决边界；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md`：14 个 IA-ID 的可见/不可见维度、权限观察、集合形态、错误映射和 IA 交叉对账；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md`：14 个 screen、all-v2 path@hash 静态基线、低保真线框、状态、容器、foundation、testId 和 face/owner 矩阵；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md`：方案比较、CP、17 条固定机制行、9 operation/query shape、owner/auth、全链同步、seed、acceptance、三维对账和 stop conditions；
- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md`：P0–P9 实施顺序、步骤级/整体三维对账、受管验证边界和显式逐代码与详设对账交付门；
- `doc/review/platform/2026-09-14-v2s-extension-field-list-search-requirements-review-intake-codex-r2.md`：上一轮需求 finding 的作者处置，作为历史 intake，不替代当前源码；
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`doc/platform/implementation-task-template.md`、`doc/platform/claude-review-handoff-template.md`：仓库边界、设计/实施授权、详设/计划正本和 Claude handoff 格式；
- `doc/decisions/templates/journey-decision-template.md`、`doc/decisions/templates/ia-design-template.md`、`doc/decisions/templates/ui-interaction-design-template.md`、`doc/decisions/templates/implementation-design-template.md`：本批实际使用的模板必填维度；
- `project-memory/index.md` 与全部 `project-memory/kernel/*.md`、`project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/confirmed-business-language-corpus.md`、`project-memory/operations/claude-review-handoff-standard.md`、`project-memory/decisions/independent-subagent-adversarial-review.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`：memory、业务语言、review、盲审和两轮边界；
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java`、`apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java`、`apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/persistence/ExtensionDefinitionPersistence.java`、`contracts/openapi/components/extension/extension.schemas.json`：宿主、JSONB definition、版本和 SELECT 当前事实；
- `apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`、`apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionEditDrawer.tsx`：配置表/Drawer owning source；
- `apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx`、`apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx`、`apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx`、`apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx`、`apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`：平面/树消费源；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationHierarchyController.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationHierarchyService.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationOverviewTaskReadPersistence.java`、`contracts/openapi/components/organization/organization-hierarchy.schemas.json`：树授权、快照和当前平台 node wire；
- `apps/frontend/operations-admin/src/app/queries/useOrganizationCandidates.ts`、`apps/frontend/operations-admin/src/features/contract-management/ui/useContractStoreCandidates.ts`、`apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx`、`apps/frontend/platform-admin/src/app/queries/usePlatformOrganizationCandidates.ts`、`apps/frontend/operations-admin/src/features/workspace-user/application/useWorkspaceInvitationCandidates.ts`、`apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx`：候选边界反例；
- `libraries/frontend/admin-ui-foundation/src/index.ts`、`apps/frontend/operations-admin/src/features/organization-structure/model/organizationExtensionValues.ts`、`apps/frontend/platform-admin/src/features/organization-contract-overview/ui/OrganizationOverviewPresentation.ts`：foundation 复用和现有 typed display 先例；
- `scripts/README.md`、`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`、`contracts/policy/backend-performance-cp05-calibration-report.json`：受管命令、真实 business scenario 和 operation-count/性能边界。

## 独立核验重点

请按以下顺序核验，不把旧 handoff、聊天摘要、上一轮 finding 或文档自称当成当前事实：

1. 先从当前源码重算 8 host、14 screen、10 flat/2 tree、9 operation 和 3 seed file；写出同根 sibling 与反例。特别检查 `WorkspaceManagementPage` 是否正确排除、合同 `tenantId` 是否正确保留。
2. 逐字比较 IA、交互工件、implementation design 中的四段固定事实：五类平面动态消费、当前运营树、当前平台树、树本地 typed matching。任何一字偏差都列为 finding，而不是让实施者自行解释。
3. 检查 `Page` 与完整 `Tree` 的集合边界、owner 过滤位置、total/page、无逐行请求、树祖先闭包和未来分页树的停机条件；不要把当前 calibration `READY` 或最大样本误当行数/延迟/JSONB 性能证据。
4. 检查 `extensionFilters` 提议是否能被当前 Spring edge/generated chain 真实承载：JSON encoded array、fieldKey/type/value、重复/空值/非法类型/SELECT options、建议的 bounded max 是否有明确最终裁决入口；若不能，请指出最小替代。
5. 检查 platform tree contract gap 是否在 `contracts/openapi/components/organization/organization-hierarchy.schemas.json` 和 generated/edge/owner 同步清单中完整闭合；当前未授权实现，不能要求通过 L2 或详情补请求证明。
6. 检查 definition drift 的 revision 来源、强制绕 cache、版本下界、一次恢复和同版本终止；确认 `extensionRuleRevision` 没被误用。
7. 检查 17 条机制行是否全是可执行观察，`§9a` 是否每个业务事实都有 contract/generated/backend/frontend/test/fixture/seed 处理，`§10b` 是否明确 seed 不执行，`§11` 是否为三个 acceptance domain 提供真实 identity/fixture/request/businessOracle。
8. 检查 14 个 screen 是否每个只有一个 `UI_SURFACE`、用户文案没有内部技术词、容器行为没有隐含第二滚动祖先、testId 是否只作为未来实现草案而非当前 evidence；当前 `L2_SCRIPT_ADMISSION` 必须仍为 `BLOCKED`。
9. 检查 P6/P7/P9 是否是实施计划中的独立交付步骤，并确认没有把 static/focused/acceptance/L2、business/cleanup 或文档状态混成同一类 PASS。

本轮静态设计复审不执行四条 recall、任何脚本动态入口、DEV、reset、seed、backend acceptance、browser L2、UAT、部署或 Git。若你复核 memory recall，发现 `PROJECT_MEMORY=FAIL` 的 assertion drift，请记录 first failure、last known good、broken boundary 并回到 owning decision/source，不要把路由失败写成 memory PASS。

## 期望结论

请明确给出 `GO`、`GO_WITH_UNVERIFIED_UI` 或 `NO-GO`，按 `M/S/N` 报告。每条 finding 必须包含：

- `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`；
- 精确仓根相对路径与行号/唯一 symbol/段落；
- 当前源码/设计事实、后果、适用边界、反例或可复验观察；
- 最小修复建议，以及是否需要 Dexter 对产品/Journey/权限/契约语义作裁决；
- 同根 sibling 扫描范围和该 finding 的唯一预防落点。

请分别输出 `L1_ENGINEERING`、`L2_USER_VISIBLE`、`L3_UNVERIFIED`、`SAME_ROOT_SCAN`、`DESIGN_GAPS`、`EVIDENCE_TIER=STATIC_DESIGN_ONLY`。不要把本轮结论升级为实现授权、契约生成、数据库/seed/DEV、浏览器 L2、UAT、部署、Git 或性能通过。若视觉未获 Dexter 接受，请在 verdict 中明确说明是否只能 `GO_WITH_UNVERIFIED_UI` 或 `NO-GO`。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对“扩展字段列表展示与类型化搜索”的 Journey、IA、交互工件、implementation-facing 详设和实施计划进行新的外部静态 DESIGN 复审。

背景：上一轮 Claude review 指出需求修订后必须继续形成详设和实施计划；Codex 之前漏掉了这一步，现已补齐五份当前字节：doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md、doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md、doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md、doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md、doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md。它们全部是当前设计材料，明确 IMPLEMENTATION_AUTHORITY=false、RUNTIME_AUTHORITY=NONE；没有修改生产代码/契约/generated/数据库/测试/seed，也没有运行 DEV、reset、seed、backend acceptance、browser L2、UAT、部署或 Git。

目标：请先从“这套详设和计划为什么仍可能不成立”出发，独立重算 8 个扩展宿主、14 个 screen、10 个平面消费面、2 个树面、9 个目标 read operation 和 3 个受影响 seed 文件；再逐条核验 Journey→IA→交互工件→implementation-facing 详设→实施计划是否形成可执行且不矛盾的闭环。重点检查五类平面宿主的 listDisplay/searchable 独立开关、REGION/PROJECT 与 COMMERCIAL_GROUP 的 N/A 矩阵、SELECT 历史非空未知值、运营完整工作区树与平台 selected workspace 树授权、树本地 typed matching、平面 owner-side filter、platform tree 当前 node wire 缺扩展属性的契约停机项、definitionRevision/cache bypass/一次恢复/同版本停止、extensionFilters JSON query 形态、17 条机制行、§9a 全链同步、seed 与 acceptance 分离、P6/P7/P9 三类对账门。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md：需求正本；
- doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md：Journey；
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md：IA；
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md：14 个 screen 与线框；
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md：详设、17 条机制行、owner/query/tree/seed/acceptance；
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md：P0–P9 实施顺序和逐代码与详设对账门；
- AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、doc/platform/implementation-task-template.md、doc/platform/claude-review-handoff-template.md、doc/decisions/templates/implementation-design-template.md、doc/decisions/templates/ia-design-template.md、doc/decisions/templates/ui-interaction-design-template.md、doc/decisions/templates/journey-decision-template.md：授权、模板、review 和交付边界；
- project-memory/index.md、全部 project-memory/kernel/*.md、project-memory/decisions/deterministic-context-only.md、project-memory/decisions/confirmed-business-language-corpus.md、project-memory/operations/claude-review-handoff-standard.md、project-memory/decisions/independent-subagent-adversarial-review.md、doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md：memory、业务语言、review 和盲审边界；
- apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java、apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java、apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/persistence/ExtensionDefinitionPersistence.java、contracts/openapi/components/extension/extension.schemas.json：宿主、JSONB definition、版本和 SELECT；
- apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx、apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionEditDrawer.tsx、apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx、apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx、apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx、apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx、apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx：配置、平面和树 owning source；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationHierarchyController.java、apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationHierarchyService.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationOverviewTaskReadPersistence.java、contracts/openapi/components/organization/organization-hierarchy.schemas.json：树授权、快照和当前平台 node wire；
- libraries/frontend/admin-ui-foundation/src/index.ts、apps/frontend/operations-admin/src/features/organization-structure/model/organizationExtensionValues.ts、apps/frontend/platform-admin/src/features/organization-contract-overview/ui/OrganizationOverviewPresentation.ts、scripts/README.md、doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md、contracts/policy/backend-performance-cp05-calibration-report.json：foundation、typed display、受管入口、acceptance 和 calibration 边界。

请重点独立核验：当前源码是否支持文档中的分母和 owner 断言；四段共用事实是否在 IA/交互/详设逐字一致；Page 与完整 Tree 是否没有混淆；extensionFilters 是否可由 generated chain 承载；platform tree projection、typed problem registry、max filters 等 OPEN 是否应停机或需要 Dexter 裁决；seed/acceptance 是否有真实业务 oracle；以及 P9 是否真的是逐代码而不是抽样对账。请不要执行任何动态命令，也不要修改任何文件。

烦请给出明确 REVIEW_TARGET=DESIGN、VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO，并按 M/S/N 报告。每条 finding 请写分类、精确仓根相对路径与行号/唯一 symbol/段落、事实、后果、适用边界、反例、最小修复和是否需要 Dexter 裁决；分别输出 L1_ENGINEERING、L2_USER_VISIBLE、L3_UNVERIFIED、SAME_ROOT_SCAN、DESIGN_GAPS、EVIDENCE_TIER=STATIC_DESIGN_ONLY。不要把静态设计 verdict 当作实现、测试、DEV、reset、seed、L2、UAT、部署、Git 或性能授权。

授权边界：本次只复审上述五份设计/计划及其当前源码、模板和项目 memory 依据；不授权生产代码、OpenAPI/generated、数据库/迁移、测试、seed 文件执行、DEV、reset、backend acceptance、browser L2、UAT、部署或 Git。谢谢。
```


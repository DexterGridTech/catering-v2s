# 扩展字段列表展示与类型化搜索需求 · Claude 外部 DESIGN 复审请求

```text
REVIEW_KIND=REQUIREMENTS_DESIGN_EXTERNAL_REVIEW
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_REQUIREMENTS_20260914
REVIEW_TARGET=DESIGN
REVIEW_ROUND=3
REVIEW_ROUND_LIMIT=EXTERNAL_REVIEW_NOT_LIMITED_BY_CODEX_INDEPENDENT_SUBAGENT_CAP
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

Claude 上一轮外部静态 DESIGN 复审针对当时字节给出 `VERDICT=NO-GO`、`M/S/N=0/6/4`。Codex 没有照单全收：已重新打开当前需求、当前生产源码、OpenAPI、active calibration report 和相关项目 memory，逐条判定 Claude 的 finding，确认的部分已修订需求正本；错误的“九个平面 operation”子结论已用当前 operation 映射反证并改成七个平面 operation + 两个树 operation。

当前被审对象是修订后的：

`doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`

第二轮 verdict 针对修订前字节；需求正本当前头部明确：

```text
STATUS=REQUIREMENTS_REVISED_AFTER_DESIGN_REVIEW_ROUND_2
LAST_REVIEW=ROUND_2_VERDICT_NO-GO_ON_PRIOR_BYTES; CURRENT_BYTES_AFTER_AUTHOR_REMEDIATION_NOT_REVIEWED_BY_ROUND_2
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=NONE
```

逐条作者处置在：

`doc/review/platform/2026-09-14-v2s-extension-field-list-search-requirements-review-intake-codex-r2.md`

本请求是用户明确要求的新的 Claude 外部复审，不是 `INDEPENDENT_SUBAGENT` 对抗 review 的第三轮。外部 review 的次数由 Dexter 决定；不要把独立子 agent 的 `REVIEW_ROUND_LIMIT=2` 或 `ROUND_FINAL_DECISION=SELF_DECIDED` 套到本次 Claude 外部复审，也不要把本请求解释为详设、实现或运行授权。

## 评审目标

请先以“当前修订为什么仍可能不成立”为立场，独立阅读当前字节，再核对 Codex 的处置。不要因为作者把 finding 标成 `CONFIRMED` 就直接接受，也不要继续沿用上一轮的 finding 原文或旧行号。

重点确认：

1. 八类宿主、十个平面消费面、两个组织树消费面是否完整；候选下拉/Autocomplete/关系选择器/命令抽屉对象选择是否只被排除在动态扩展列和动态搜索分母之外，而没有误排合同列表的核心经营租户筛选或其他实体列表核心条件。
2. `listDisplay` 与 `searchable` 的宿主适用矩阵是否闭合：五类平面宿主两个开关均可编辑；`REGION`/`PROJECT` 的 `listDisplay` 显示“不适用”且不可编辑、`searchable` 可编辑；`COMMERCIAL_GROUP` 两个均显示“不适用”且不可编辑，但字段本身仍可维护。停用字段的配置可见而消费关闭，不能出现“是”但无消费面的误导状态。
3. SELECT 当前 `options` 是字符串数组；一个字符串同时是保存值、显示文本和搜索身份。字段仍启用时，非空但已不在当前 options 的历史值仍显示原始值，不显示“—”，且不命中当前 SELECT 搜索；空值与历史未知值是否清楚区分。
4. 运营树 `sessions.requireWorkspaceRead` 的工作区级完整快照、平台树的平台 `requireRead` + enabled selected workspace 边界是否被准确写入；本需求是否明确不引入 assignment-scope clipping。商业集团当前只是树根/顶层属性，不是 node，因此不产生树搜索项；只有大区和项目的 searchable 字段产生树搜索项。
5. 树本地 typed matching 是否明确复用需求第 6.2 节的同一语义；完整快照本地筛选与平面分页 owner-side 筛选是否没有混淆；未来分页/有界树是否正确要求 owner 返回命中节点及祖先闭包。当前平台 `OrganizationHierarchyTreeNode` 无扩展属性，需求是否正确把它列为需要契约变更的缺口。
6. definition drift 是否形成可终止的恢复闭环：平面 typed problem 携带 owner `definitionRevision`，强制重读绕过 app/RTK cache 且版本不低于 problem revision；一次恢复后同一版本再次被拒即停止自动恢复并给出结构化错误与手动重试；树快照 metadata 版本发现与同版本停止是否有边界。
7. 当前 `contracts/policy/backend-performance-cp05-calibration-report.json` 是否对准确的九个目标读取 operation 逐项 `READY`：七个平面 operation `getOperationsOrganizationBrands`、`getOperationsOrganizationTenants`、`getOperationsOrganizationHeadCompanies`、`getOperationsOrganizationStores`、`getOperationsContracts`、`getPlatformOrganizationOverviewPage`、`getPlatformContractOverviewPage`，以及两个树 operation `getOperationsOrganizationHierarchy`、`getPlatformOrganizationHierarchyTree`。请明确 `READY`/DB operation count 不能冒充 JSONB 扫描、延迟、规模或新增动态条件后的性能通过。

## 需阅读文件

请从 `catering-v2s` 仓库根直接打开：

- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`：当前被审需求正本；
- `doc/review/platform/2026-09-14-v2s-extension-field-list-search-requirements-review-intake-codex-r2.md`：本轮作者逐条处置、证据等级和未验证清单；
- `doc/review/platform/2026-09-14-v2s-extension-field-list-search-requirements-review-request-claude-r2.md`：上一轮请求和历史复核范围，仅作历史输入；
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`doc/platform/review-standard.md`、`doc/platform/claude-review-handoff-template.md`：入口、边界、动作和输出格式；
- `doc/platform/roadmap-program-registry.json`、`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：显式 program 和授权字段，不从 Roadmap 推断当前 task；
- `project-memory/index.md` 与全部 `project-memory/kernel/*.md`：always-read kernel；
- `project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/confirmed-business-language-corpus.md`、`project-memory/decisions/http-crud-efficiency-design-redlines.md`、`project-memory/decisions/owner-read-model-and-lifecycle-standard.md`：确定性上下文、业务、查询效率和 owner 边界；
- `project-memory/decisions/independent-subagent-adversarial-review.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`、`project-memory/operations/claude-review-handoff-standard.md`：独立子 agent 与 Claude 外部复审边界；若 recall validator 仍报告 assertion drift，请记录该失败并直接回读 owning decision，不要把路由失败写成 memory PASS；
- `project-memory/practices/ordering-only-for-consumer-facing.md`、`project-memory/practices/read-model-granularity.md`、`project-memory/practices/collection-boundary-modes.md`、`project-memory/practices/ui-visible-business-language-and-dynamic-aggregate-layout.md`、`project-memory/pitfalls/designing-from-conversation-not-system.md`、`project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md`：排序、read model、集合形态、UI 可见语义和需求漂移边界；
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java`、`apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java`、`contracts/openapi/components/extension/extension.schemas.json`：宿主全集、SELECT 校验和定义契约；
- `apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`、`apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionEditDrawer.tsx`：字段配置表与编辑抽屉现状；
- `apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx`、`apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx`、`apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx`、`apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx`：运营五类平面列表、合同核心租户筛选和运营树；
- `apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`、`apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceManagementPage.tsx`：平台组织/合同列表、平台树和集团空间列表边界；
- `apps/frontend/operations-admin/src/app/queries/useOrganizationCandidates.ts`、`apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx`、`apps/frontend/operations-admin/src/features/contract-management/ui/useContractStoreCandidates.ts`、`apps/frontend/operations-admin/src/features/workspace-user/application/useWorkspaceInvitationCandidates.ts`、`apps/frontend/platform-admin/src/app/queries/usePlatformOrganizationCandidates.ts`、`apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx`：候选选择器全集；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationHierarchyController.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OperationsOrganizationTaskReadService.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationHierarchyService.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationOverviewTaskReadPersistence.java`：两个树的授权、快照、根/node 形态和 owner read；
- `contracts/openapi/components/organization/organization-hierarchy.schemas.json`、`apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts`：平台树当前 wire/node 无扩展属性的证据；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityValueSupport.java`、`apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationExtensionFields.tsx`：SELECT 类型校验和现有定义 query/cache 消费；
- `contracts/policy/backend-performance-cp05-calibration-report.json`、`contracts/policy/backend-performance-operation-counts.json`：逐 operation READY 与总量计数的不同边界；
- `doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md`、`doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md`：历史交互基线；IA-03 的旧五类和旧列不能覆盖当前八类事实。

## 独立核验重点

请至少执行并阅读以下六维 recall 的命中原文及 sourceRefs：

```bash
scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind design --domain contract --consumer-face operations-admin --owner contract --impact contract --trigger review
scripts/context/recall-memory --task-kind review --domain admin-ui --consumer-face operations-admin --owner frontend-platform --impact architecture --trigger review
```

本轮 Codex 已观察到上述 recall 在当前仓字节返回 `PROJECT_MEMORY=FAIL`、`required assertion drift: project-memory/decisions/independent-subagent-adversarial-review.md`。请不要隐藏或升级该失败；记录 first failure/last known good/broken boundary，并以当前 owning decision 和相关原文继续判断。

请逐条核验：

- 八类宿主、十个平面页面、两个树页面的 exact set，以及 `WorkspaceManagementPage` 是否确实不是商业集团实体消费面；
- 配置三档适用矩阵和 N/A 可见/不可编辑状态是否在第 3、4、6、8、9、11、13 节没有互相矛盾；
- SELECT 非空历史未知值与真正空值的显示区分，当前 options 字符串搜索身份和禁止静默迁移；
- 运营树与平台树授权维度、商业集团根不产生树搜索项、大区/项目类型化搜索、祖先闭包和快照完整性；
- 平面 owner-side 过滤、树完整快照 browser-side 过滤、未来有界树 owner-side 命中之间的集合边界；
- 合同列表 `tenantId` 核心条件与候选 hook 的关系，候选控件排除是否没有扩大或缩小实体列表分母；
- definition revision、RTK cache bypass、版本下界、同版本停止和树 metadata 版本规则；
- 九个目标 operation 的 exact member list、face/owner/READY/max，及 operation count 与 JSONB/延迟/规模证据的分离；
- 对每一条新 finding 给出 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，并写适用边界、反例和最小修复，不要把产品歧义自行变成实现规则。

本请求是静态 DESIGN 外部复审，不要修改需求、源码、契约、generated output、数据库、测试、脚本、依赖或 Git；不要启动 DEV、reset、seed、backend acceptance、browser L2、UAT、部署或任何动态验证。

## 期望结论

请明确给出 `GO`、`GO_WITH_UNVERIFIED_UI` 或 `NO-GO`，并按 `M/S/N` 报告。每条 finding 带精确仓根相对路径与行号/唯一 symbol/段落、当前事实、后果、最小修复、适用边界和分类。请分别输出 `L1_ENGINEERING`、`L2_USER_VISIBLE`、`L3_UNVERIFIED`、`SAME_ROOT_SCAN`、`DESIGN_GAPS`，并保持 `EVIDENCE_TIER=STATIC_DESIGN_ONLY`。本次不需要填写独立子 agent 专用的 `ROUND_FINAL_DECISION=SELF_DECIDED`。

请使用以下固定结构：

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_REQUIREMENTS_20260914
REVIEW_ROUND=3
REVIEW_ROUND_LIMIT=EXTERNAL_REVIEW_NOT_LIMITED_BY_CODEX_INDEPENDENT_SUBAGENT_CAP
reviewerKind=CLAUDE_EXTERNAL_REVIEWER
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=<数量>
L1_ENGINEERING=<PASS / findings>
L2_USER_VISIBLE=<PASS / findings>
L3_UNVERIFIED=<空 / 逐条列出>
SAME_ROOT_SCAN=<八类宿主、十个平面消费面、两个组织树面的全集与判定>
DESIGN_GAPS=<需求正本缺少 canonical criterion 的条目>
EVIDENCE_TIER=STATIC_DESIGN_ONLY
```

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对“扩展字段列表展示与类型化搜索需求”进行新的外部静态 DESIGN 复审。

背景：上一轮外部复审针对旧字节给出 VERDICT=NO-GO、M/S/N=0/6/4。Codex 已逐条重开当前源码、OpenAPI、active calibration report 和项目 memory，确认的问题已修订，错误的“九个平面 operation”子结论已用当前映射改正为七个平面 operation + 两个树 operation。当前对象是 doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md，逐条处置见 doc/review/platform/2026-09-14-v2s-extension-field-list-search-requirements-review-intake-codex-r2.md。当前需求正本明确 ROUND_2_VERDICT_NO-GO_ON_PRIOR_BYTES，当前修订字节尚未被上一轮覆盖。

目标：请先从“当前修订为什么仍可能不成立”出发，独立核验当前字节，再判断 Codex 的处置是否成立。请核验八类宿主、十个平面消费面、两个树面、候选控件和合同核心租户筛选的分母；五类平面/大区项目/商业集团三档配置适用矩阵；SELECT 历史非空未知值与空值的显示区分；运营工作区级与平台 selected workspace 树授权；商业集团根不产生树搜索项；树与平面复用第 6.2 节 typed matching；平台树当前 node wire 无扩展属性的契约缺口；definitionRevision 与 RTK cache bypass/版本下界/同版本停止；以及七平面+两树的九个 operation exact set 和 READY 不等于 JSONB/延迟/规模通过的边界。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md：当前需求正本；
- doc/review/platform/2026-09-14-v2s-extension-field-list-search-requirements-review-intake-codex-r2.md：作者逐条处置与未验证清单；
- AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、doc/platform/review-standard.md、doc/platform/claude-review-handoff-template.md、doc/platform/roadmap-program-registry.json、doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md：入口、授权和 review 输出边界；
- project-memory/index.md、全部 project-memory/kernel/*.md、project-memory/decisions/deterministic-context-only.md、project-memory/decisions/confirmed-business-language-corpus.md、project-memory/decisions/http-crud-efficiency-design-redlines.md、project-memory/decisions/owner-read-model-and-lifecycle-standard.md：当前 memory、业务、owner 和查询边界；
- project-memory/decisions/independent-subagent-adversarial-review.md、doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md、project-memory/operations/claude-review-handoff-standard.md：独立子 agent 与 Claude 外部 review 的边界；
- apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java、apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java、contracts/openapi/components/extension/extension.schemas.json：宿主和 SELECT 定义；
- apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx、apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx、apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx、apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx、apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx、apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceManagementPage.tsx：十个平面面、两个树面和集团空间边界；
- apps/frontend/operations-admin/src/app/queries/useOrganizationCandidates.ts、apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx、apps/frontend/operations-admin/src/features/contract-management/ui/useContractStoreCandidates.ts、apps/frontend/operations-admin/src/features/workspace-user/application/useWorkspaceInvitationCandidates.ts、apps/frontend/platform-admin/src/app/queries/usePlatformOrganizationCandidates.ts、apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx：候选全集；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationHierarchyController.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OperationsOrganizationTaskReadService.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationHierarchyService.java、apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationOverviewTaskReadPersistence.java、contracts/openapi/components/organization/organization-hierarchy.schemas.json：树授权、快照和当前 wire；
- apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationExtensionFields.tsx、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityValueSupport.java、contracts/policy/backend-performance-cp05-calibration-report.json、contracts/policy/backend-performance-operation-counts.json：定义 cache/type 校验、operation READY 和总量计数边界。

请执行并阅读四条六维 recall；本轮 Codex 观察到它们因 project-memory assertion drift 返回 PROJECT_MEMORY=FAIL。若你复现该信号，请保留失败事实，记录 first failure/last known good/broken boundary，并回到 owning decision/source 判定，不要把路由失败写成 memory PASS：
scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind design --domain contract --consumer-face operations-admin --owner contract --impact contract --trigger review
scripts/context/recall-memory --task-kind review --domain admin-ui --consumer-face operations-admin --owner frontend-platform --impact architecture --trigger review

请逐条返回 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION；每条 finding 写精确路径与行号/唯一 symbol/段落、事实、影响、最小修复、适用边界和反例。请分别输出 L1_ENGINEERING、L2_USER_VISIBLE、L3_UNVERIFIED、SAME_ROOT_SCAN、DESIGN_GAPS，使用 EVIDENCE_TIER=STATIC_DESIGN_ONLY。请给出 GO、GO_WITH_UNVERIFIED_UI 或 NO-GO 以及 M/S/N；不要把静态设计复审升级成 UI、DEV、业务、cleanup 或性能通过。

授权边界：本次只复审当前需求正本和 review 材料，不授权代码、契约、数据库、generated output、测试、脚本、依赖、DEV、reset、seed、backend acceptance、browser L2、UAT、部署或 Git。谢谢。
```

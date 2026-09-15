# 扩展字段列表展示与类型化搜索需求 · Claude 第二轮独立 DESIGN 复审请求

```text
REVIEW_KIND=REQUIREMENTS_DESIGN
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_REQUIREMENTS_20260914
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
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

第一轮是同一 `REVIEW_CYCLE_ID` 下的 `REVIEW_ROUND=1`，Claude 给出 `VERDICT=NO-GO`、`M/S/N=2/4/3`。Codex 已将该结果作为待验证输入，重新打开当前源码和当前 policy，逐条判断后修改了需求正本；作者处置记录见 `doc/review/platform/2026-09-14-v2s-extension-field-list-search-requirements-review-intake-codex.md`。

本轮被审对象是已修订的 `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`。用户原始范围仍是所有有扩展字段实体的列表和搜索页，不是截图中的单一经营租户页面。当前需求正本盘点八类宿主：品牌、经营租户、总公司、门店、合同、商业集团、大区、项目；覆盖两个独立后台的十个平面消费面，以及两个组织架构树消费面。它仍只是需求正本，不是详设、实施计划或实现授权。

Codex 对第一轮结果的处置摘要如下：

| finding | 当前处置 | 复审请重新证伪的核心 |
| --- | --- | --- |
| M-01 | `CONFIRMED`；已明确 SELECT 的 options 字符串同时是持久化值、显示文本和当前搜索身份；改名按删除旧字符串+新增新字符串，历史值保留但不迁移、不匹配当前选项；稳定 option key/label 分离另立需求 | 是否仍有值/文本分叉、历史值丢失或实现歧义 |
| M-02 | `CONFIRMED`；已删除 `searchable => listDisplay`，两个开关独立；树忽略 `listDisplay`，允许 search-only | 是否仍存在跨宿主配置与消费面矛盾 |
| S-01 | `PARTIALLY_CONFIRMED`；已声明当前树是完整授权快照，允许在同一完整集合内本地筛选；未来分页/有界树必须 owner 计算命中和祖先闭包 | 当前集合边界、完整性、祖先保留和未来分支是否闭合 |
| S-02 | `PARTIALLY_CONFIRMED`；候选下拉/Autocomplete/关系选择/命令抽屉对象选择明确排除，但实体列表页面本身仍在分母内 | 排除候选是否误排除实体列表的核心候选筛选 |
| S-03 | `CONFIRMED`；已加入 `definitionRevision` 与实体 `extensionRuleRevision` 区分，并定义重读定义、清除失效动态条件、保留有效条件、回到第一页和可见提示 | 是否仍可能带失效条件死循环或旧列伪装成功 |
| S-04 | `PARTIALLY_CONFIRMED`；已加入规模/增长/查询计划/成本记录要求；当前 active calibration report 已逐 operation 覆盖目标读取且为 READY，但这不证明 JSONB 扫描或延迟 | 当前 report 覆盖事实与未测规模/扫描成本是否被准确区分 |
| N-01/N-02/N-03 | 已分别改写树命中/祖先表述、标注 IA-03 为历史五类基线、确定为 `Select（是/否）` | 是否仍有文字或来源基线漂移 |

本轮没有启动 DEV、reset、seed、backend acceptance、browser L2、UAT、部署或任何动态验证；不允许把静态复审升级为用户体验或运行通过。

## 评审目标

请作为同一 review cycle 的第二轮、独立且对抗式 reviewer，先尝试证明修订后的需求仍然不成立，再核对作者处置。不要因为作者 intake 写了 `CONFIRMED` 就直接接受，也不要把第一轮 finding 原文当作当前事实；以当前仓库字节、当前 OpenAPI、当前 active policy 和当前命中 memory 为准。

重点复审：

1. 八类宿主、十个平面消费面和两个树消费面的全集是否闭合；候选选择器排除是否有页面任务依据，是否误排除合同列表自身的门店核心筛选。
2. `listDisplay` 和 `searchable` 是否真正独立；树宿主忽略 `listDisplay`、平面允许 search-only 是否与字段配置表、停用行为、固定动态列/搜索项和用户可见结果闭合。
3. SELECT 当前契约是否确实只有字符串数组；“字符串即保存值、显示文本和搜索身份，改名不迁移历史值”是否解决了值/文本歧义，且没有偷偷引入稳定 key。
4. 当前组织树是否确实是 owner 提供的完整授权快照而非分页/截断集合；在完整快照内本地筛选与平面当前页禁止本地筛选是否区分清楚；命中节点、祖先路径和无关分支规则是否没有泄漏或伪命中。
5. `definitionRevision` 与实体 `extensionRuleRevision` 的职责是否区分清楚；定义漂移、类型变化、停用/不可搜索和非法 SELECT 条件是否有一次性可恢复路径，不会原条件自动重试死循环。
6. 当前 performance report 是否确实逐 operation 覆盖 `getOperationsOrganizationHierarchy`、`getOperationsOrganizationStores`、`getOperationsContracts`、`getPlatformOrganizationOverviewPage`、`getPlatformOrganizationHierarchyTree`、`getPlatformContractOverviewPage` 并标记 READY；同时确认真实数据规模、JSONB 扫描成本、查询计划和动态 UI 仍是 `L3_UNVERIFIED`，不把 READY 或 DB operation count 当作性能通过。
7. 三条 N 修订和 IA-03 历史基线说明是否准确；所有“固定列、不排序、类型控件、空值、权限、分页/总数、失败恢复”规则是否与当前文档内部一致。

## 需阅读文件

请从 `catering-v2s` 仓库根直接打开，并以当前字节为准：

- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`：本轮被审需求正本；
- `doc/review/platform/2026-09-14-v2s-extension-field-list-search-requirements-review-intake-codex.md`：作者对第一轮每条 finding 的证据分类、最小修复和未验证项；仅作待核对输入；
- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`doc/platform/review-standard.md`、`doc/platform/claude-review-handoff-template.md`：仓库入口、审查动作、交接格式与边界；
- `doc/platform/roadmap-program-registry.json`、`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：程序与显式授权字段，不从 Roadmap 推断当前任务；
- `project-memory/index.md` 及全部六个 `project-memory/kernel/*.md`：always-read 约束；
- `project-memory/operations/claude-review-handoff-standard.md`、`project-memory/decisions/independent-subagent-adversarial-review.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`：本轮盲审、finding 处置和两轮硬上限；
- `project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/confirmed-business-language-corpus.md`、`project-memory/decisions/http-crud-efficiency-design-redlines.md`、`project-memory/decisions/owner-read-model-and-lifecycle-standard.md`：当前上下文、业务、读取粒度和 owner 边界；
- `project-memory/practices/ordering-only-for-consumer-facing.md`、`project-memory/practices/read-model-granularity.md`、`project-memory/practices/collection-boundary-modes.md`、`project-memory/practices/ui-visible-business-language-and-dynamic-aggregate-layout.md`、`project-memory/pitfalls/designing-from-conversation-not-system.md`、`project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md`：排序、read model、集合形态、可见交互和需求漂移边界；
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java`、`apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java`、`contracts/openapi/components/extension/extension.schemas.json`：八类宿主、SELECT 校验和当前定义契约；
- `apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`、`apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionEditDrawer.tsx`：平台字段配置表/抽屉现状；
- `apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx`、`apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx`、`apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx`、`apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx`：运营五类平面列表和组织树；
- `apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`：平台组织/合同列表与组织树消费；
- `apps/frontend/operations-admin/src/app/queries/useOrganizationCandidates.ts`、`apps/frontend/operations-admin/src/features/contract-management/ui/useContractStoreCandidates.ts`、`apps/frontend/operations-admin/src/features/workspace-user/application/useWorkspaceInvitationCandidates.ts`、`apps/frontend/platform-admin/src/app/queries/usePlatformOrganizationCandidates.ts`、`apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx`：候选选择器边界；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OperationsOrganizationTaskReadService.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationHierarchyService.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationOverviewTaskReadPersistence.java`：树完整快照、owner page 和平台组织读取；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityValueSupport.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/BusinessEntityTaskReadServiceSql.java`：值类型/SELECT 校验与运营实体 owner read；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformContractOverviewController.java`：平台列表/详情扩展字段映射；
- `contracts/policy/backend-performance-cp05-calibration-report.json`、`contracts/policy/backend-performance-operation-counts.json`：当前逐 operation 性能校准与总量计数基线；
- `doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md`、`doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md`：历史扩展配置和实体交互基线，注意 IA-03 的五类/旧列不能覆盖当前八类事实。

## 独立核验重点

请重新执行并阅读以下四条六维 recall 的命中原文及 sourceRefs；命中结果只负责路由，规则和事实仍需回到当前 source：

```bash
scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind design --domain contract --consumer-face operations-admin --owner contract --impact contract --trigger review
scripts/context/recall-memory --task-kind review --domain admin-ui --consumer-face operations-admin --owner frontend-platform --impact architecture --trigger review
```

请以同根静态读取复核：

- `ExtensionHostTypes.VALUES`、OpenAPI 类型枚举和需求八类宿主是否一致；十个平面面与两个树面是否没有漏项或重复；候选控件是否仅被排除在动态扩展列/搜索分母外；
- 需求第 4、6、8、13 节的独立开关、search-only、树完整快照/未来有界树分支是否互相一致；
- `options` 字符串数组、`field.options().contains(json.asText())`、实体历史值和当前 SELECT 搜索规则是否支持 M-01 修订；
- 需求第 5.4、10.3、11.5 节是否把规模/查询成本/definition drift 作为设计和验收输入，但没有把静态材料伪装成动态性能或 UI 通过；
- active calibration report 中上述六个 operation 的 operationId、owner、consumerFace、budgetReadiness 与实际当前 JSON 是否相符；若发现报告或源码已漂移，请报告当前事实，不要沿用作者 intake；
- IA-03 旧五类与当前八类的关系、N-01/N-02/N-03 的修订是否闭合；
- 对每个新增 finding 主动找一个适用边界/反例，区分 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE`、`DEXTER_DECISION`；需求/产品歧义不要在 review 中擅自变成实现规则。

本轮是静态 DESIGN 复审；不要启动 Web、DEV、reset、seed、backend acceptance、browser L2、UAT、部署，不修改需求、源码、契约、测试、脚本、依赖或 Git。

## 期望结论

请给出明确的 `GO`、`GO_WITH_UNVERIFIED_UI` 或 `NO-GO`，并给出 `M/S/N` 数量。每条 finding 必须包含：严重度、准确仓根相对路径与行号/唯一 symbol/段落、当前事实、后果、最小修复建议、适用边界，以及上述五类分类之一。若作者 intake 中某一子结论被当前字节否定，请明确写 `REJECTED_WITH_EVIDENCE` 和反证，不要保留模糊的“可能”。

请分别输出：

- `L1_ENGINEERING`：需求、契约、owner、集合边界、定义漂移、性能基线等静态设计问题；
- `L2_USER_VISIBLE`：平台配置、五类平面列表、三类树搜索、固定列/搜索项、控件、祖先路径、失败恢复和可见文案问题；没有批准 IA/动态证据时不得假定通过；
- `L3_UNVERIFIED`：动态列/搜索实际渲染与交互、代表性规模下 JSONB 查询计划/延迟、实现后的新增 operation budget 等仍未证实的事实；
- `SAME_ROOT_SCAN`：八类宿主、十个平面消费面、两个树面和候选选择器的完整判定；
- `DESIGN_GAPS`：仍缺 canonical requirement criterion 的条目；
- `EVIDENCE_TIER=STATIC_DESIGN_ONLY`：不得升级为 Web、DEV、L2、business 或 cleanup 结论。

请严格返回以下固定结构，并在第二轮后停止本 review cycle，不再召集第三轮：

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_REQUIREMENTS_20260914
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
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
您好 Claude，烦请对“扩展字段列表展示与类型化搜索需求”进行同一 review cycle 的第二轮独立 DESIGN 复审。

背景：第一轮 REVIEW_ROUND=1 给出 VERDICT=NO-GO、M/S/N=2/4/3。Codex 没有把该结论当授权，而是重新打开当前 catering-v2s 源码、OpenAPI、active performance policy 和项目 memory，逐条判断后修订了需求正本。当前对象是 doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md；逐条作者处置见 doc/review/platform/2026-09-14-v2s-extension-field-list-search-requirements-review-intake-codex.md。用户范围是所有有扩展字段实体的列表和搜索页，不是单一经营租户示例。需求正本当前覆盖八类宿主、两个后台的十个平面消费面和两个组织树消费面，仍不是详设、实施计划或实现授权。

目标：请先从“修订后为什么仍可能不成立”出发，独立核对当前字节，不要因为作者 intake 标成 CONFIRMED 就直接接受，也不要把第一轮原文当当前事实。

本轮重点：
1. SELECT 当前 options 是否确实只有字符串数组；一个 options 字符串同时是实体保存值、显示文本和搜索身份，改名按删除旧字符串+新增新字符串、历史值保留但不迁移且不匹配当前选项，是否已经闭合且没有偷偷引入稳定 option key。
2. listDisplay 与 searchable 是否独立；search-only 是否允许；树宿主忽略 listDisplay 是否与配置、停用、动态列和动态搜索语义一致。
3. 当前组织树是否确实是 owner 提供的完整授权快照；快照内本地筛选与平面分页当前页禁止本地筛选是否区分清楚；命中节点、祖先路径、无关分支和未来分页/有界树分支是否闭合。
4. 候选下拉、Autocomplete、关系选择器和命令抽屉对象选择被排除时，是否误排除了实体列表本身的核心候选筛选；八类宿主、十个平面面、两个树面是否完整。
5. definitionRevision 与实体 extensionRuleRevision 是否被正确区分；定义漂移、停用、不可搜索、类型变化和非法 SELECT 条件是否会重读定义、清除失效动态条件、保留有效条件、回到第一页并避免旧条件死循环。
6. 当前 contracts/policy/backend-performance-cp05-calibration-report.json 是否逐 operation 覆盖并 READY：getOperationsOrganizationHierarchy、getOperationsOrganizationStores、getOperationsContracts、getPlatformOrganizationOverviewPage、getPlatformOrganizationHierarchyTree、getPlatformContractOverviewPage；同时不要把 DB operation count/READY 当作 JSONB 扫描成本、时延或代表性规模已通过。
7. N-01、N-02、N-03 的改写，以及 IA-03 作为历史五类/旧列基线而不能覆盖当前八类事实的说明，是否准确。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md：已修订需求正本；
- doc/review/platform/2026-09-14-v2s-extension-field-list-search-requirements-review-intake-codex.md：作者逐条处置，作为待核对输入；
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、doc/platform/review-standard.md、doc/platform/claude-review-handoff-template.md：仓库入口、review 标准与交接边界；
- doc/platform/roadmap-program-registry.json、doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md：程序和显式授权字段，不从 Roadmap 推断任务；
- project-memory/index.md 及全部 project-memory/kernel/*.md、project-memory/operations/claude-review-handoff-standard.md、project-memory/decisions/independent-subagent-adversarial-review.md、doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md、project-memory/decisions/deterministic-context-only.md：always-read、上下文和两轮独立审查边界；
- project-memory/decisions/confirmed-business-language-corpus.md、project-memory/decisions/http-crud-efficiency-design-redlines.md、project-memory/decisions/owner-read-model-and-lifecycle-standard.md、project-memory/practices/ordering-only-for-consumer-facing.md、project-memory/practices/read-model-granularity.md、project-memory/practices/collection-boundary-modes.md、project-memory/practices/ui-visible-business-language-and-dynamic-aggregate-layout.md、project-memory/pitfalls/designing-from-conversation-not-system.md、project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md：业务、owner read、集合形态、排序、UI 和漂移边界；
- apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java、apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java、contracts/openapi/components/extension/extension.schemas.json：宿主全集、SELECT 校验和当前定义契约；
- apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx、apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionEditDrawer.tsx、apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx、apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx、apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx、apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx、apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx：配置、五类平面列表、运营树和平台消费面；
- apps/frontend/operations-admin/src/app/queries/useOrganizationCandidates.ts、apps/frontend/operations-admin/src/features/contract-management/ui/useContractStoreCandidates.ts、apps/frontend/operations-admin/src/features/workspace-user/application/useWorkspaceInvitationCandidates.ts、apps/frontend/platform-admin/src/app/queries/usePlatformOrganizationCandidates.ts、apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx：候选选择器边界；
- apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OperationsOrganizationTaskReadService.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationHierarchyService.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationOverviewTaskReadPersistence.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityValueSupport.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/BusinessEntityTaskReadServiceSql.java：树快照、owner page、值校验和实体 read；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java、apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformContractOverviewController.java：平台扩展字段映射；
- contracts/policy/backend-performance-cp05-calibration-report.json、contracts/policy/backend-performance-operation-counts.json：当前逐 operation 校准和总量计数基线；
- doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md、doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md：历史交互基线，注意 IA-03 旧五类/旧列不能覆盖当前八类。

请至少执行并阅读以下四条六维 recall 命中原文及 sourceRefs：
scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind design --domain contract --consumer-face operations-admin --owner contract --impact contract --trigger review
scripts/context/recall-memory --task-kind review --domain admin-ui --consumer-face operations-admin --owner frontend-platform --impact architecture --trigger review

请逐条给出 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION；每条 finding 写仓根相对路径与行号/唯一 symbol/段落、事实、后果、最小修复、适用边界。请分别输出 L1_ENGINEERING、L2_USER_VISIBLE、L3_UNVERIFIED、SAME_ROOT_SCAN、DESIGN_GAPS 和 EVIDENCE_TIER=STATIC_DESIGN_ONLY。没有新的 IA 或动态验证时，不得把动态列/搜索实际渲染、代表性规模性能或用户体验判定为已通过。

请严格使用：
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_REQUIREMENTS_20260914
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=CLAUDE_EXTERNAL_REVIEWER
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=<数量>
L1_ENGINEERING=<PASS / findings>
L2_USER_VISIBLE=<PASS / findings>
L3_UNVERIFIED=<空 / 逐条列出>
SAME_ROOT_SCAN=<八类宿主、十个平面消费面、两个组织树面的全集与判定>
DESIGN_GAPS=<需求正本缺少 canonical criterion 的条目>
EVIDENCE_TIER=STATIC_DESIGN_ONLY

授权边界：本次只请求同一 cycle 的第二轮独立静态 DESIGN 复审。不要修改需求、源码、契约、数据库、测试、脚本、依赖或 Git，不要启动 DEV、reset、seed、backend acceptance、browser L2、UAT、部署或动态验证。第二轮是硬停止轮次，不得再召集第三轮。谢谢。
```

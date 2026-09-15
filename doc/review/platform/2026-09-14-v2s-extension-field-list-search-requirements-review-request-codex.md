# 扩展字段列表展示与类型化搜索需求 · Claude 独立评审请求

```text
REVIEW_KIND=REQUIREMENTS_DESIGN
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_REQUIREMENTS_20260914
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=CLAUDE_EXTERNAL_REVIEWER
IMPLEMENTATION_AUTHORITY=false
RUNTIME_EXECUTION=NOT_RUN
VERDICT_REQUIRED=GO | GO_WITH_UNVERIFIED_UI | NO-GO
SEVERITY_FORMAT=M/S/N
```

## 背景

本轮评审对象是 `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`，内容是扩展字段增加“是否列表展示”“是否可搜索”，并让所有有扩展字段的实体列表/搜索面消费这两个配置。

用户明确说明“经营租户列表”只是示例，实际范围必须由 Codex 盘点。当前需求正本按仓内 `ExtensionHostTypes` 与 OpenAPI 枚举列出八类宿主：品牌、经营租户、总公司、门店、合同、商业集团、大区、项目；同时覆盖两个独立后台的五类平面列表，以及组织架构树的搜索特殊边界。

当前尚未进入 implementation-facing 详设或实现。本轮没有因该需求启动 DEV、reset、seed、backend acceptance、browser L2、UAT、部署或动态验证。需求文档中的 `IMPLEMENTATION_AUTHORITY=false` 是本轮边界，不能被其他 Roadmap 授权替代。

## 评审目标

请以独立 `REVIEW_TARGET=DESIGN` reviewer 身份，先从“这份需求为什么可能不成立”出发，再核对作者材料，重点确认：

1. 八类扩展宿主是否完整，是否遗漏任何当前有扩展字段且存在列表/搜索消费面的实体；五类平面宿主在 `operations-admin` 与 `platform-admin` 的页面分母是否正确；商业集团、大区、项目的组织架构树是否应按需求文档纳入搜索而不虚构表格列。
2. 两个配置的业务语义是否清楚且互不混淆：字段定义、默认值、停用行为、整组原子保存、`displayOrder`、类型固定、历史值保留和权威 readback 是否有完整边界。
3. 动态列“固定可见、不可排序”和动态搜索项“固定出现、控件匹配字段类型”的方案是否真正解决用户问题；是否存在更短、更自然或更小的替代方案；不能因现有页面或接口形态反推用户任务。
4. `TEXT`、`NUMBER`、`DATE`、`BOOLEAN`、`SELECT` 的展示、搜索控件、提交值和匹配语义是否足够明确；空值、未知历史值、无效 SELECT 值、布尔“全部”和搜索条件组合是否闭合。
5. `searchable=true` 是否必须约束 `listDisplay=true`。需求文档给了推荐方案但列为 Dexter 裁决，请判断这是必须的产品语义、可独立配置的合理选择，还是需求遗漏；不要替 Dexter 做产品决定。
6. owner、权限、分页总数、服务端过滤、动态值批量读取和 typed problem 边界是否正确；是否会产生前端当前页过滤、逐行 HTTP/DB 请求、跨宿主字段串用、权限扩大或静默降级。
7. 当前源码明确存在的平台列表扩展字段为空、运营列表只有扩展值但没有动态过滤、组织树只有名称/编码本地搜索、扩展定义契约缺少两个属性等事实，是否都被需求正确表达为影响面，而不是只修经营租户页面。
8. 需求文档中的 UI 文字、固定列、固定搜索项、组织树祖先路径、失败恢复和详情行为是否来自真实用户任务；若文档缺少批准 Journey/IA 才能决定的页面语义，请标为 `DEXTER_DECISION` 或 `DESIGN_GAP`，不要默认放行。

## 需阅读文件

请从 `catering-v2s` 仓库根直接打开：

- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`：本轮被审需求正本；
- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`：执行入口、Claude 交接、后台边界和授权规则；
- `doc/platform/roadmap-program-registry.json`、`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：显式程序和当前授权字段；不要从 Roadmap 推断当前任务；
- `project-memory/index.md` 及其全部 kernel：仓内 always-read 约束；
- `scripts/README.md`：受管脚本和动态执行边界；
- `project-memory/operations/claude-review-handoff-standard.md`、`project-memory/decisions/independent-subagent-adversarial-review.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`：本轮独立 review、盲审、两轮上限和交接格式；
- `doc/platform/review-standard.md`、`doc/platform/claude-review-handoff-template.md`、`doc/platform/foundation-charter.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/backend-coding-standard.md`：review 动作及适用工程判据；
- `project-memory/decisions/confirmed-business-language-corpus.md`、`project-memory/decisions/http-crud-efficiency-design-redlines.md`、`project-memory/decisions/owner-read-model-and-lifecycle-standard.md`：业务词汇、集合读取、owner read model 与状态边界；
- `project-memory/practices/ordering-only-for-consumer-facing.md`、`project-memory/practices/read-model-granularity.md`、`project-memory/practices/collection-boundary-modes.md`、`project-memory/practices/ui-visible-business-language-and-dynamic-aggregate-layout.md`、`project-memory/pitfalls/designing-from-conversation-not-system.md`、`project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md`：动态列排序、读取粒度、集合形态、可见文案和需求漂移边界；
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java`、同目录的 `ExtensionDefinitionService.java`：八类宿主全集及定义 owner；
- `contracts/openapi/components/extension/extension.schemas.json`：当前定义契约、五种字段类型及缺失属性；
- `apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`、`ExtensionDefinitionEditDrawer.tsx`：平台字段配置表和编辑抽屉现状；
- `apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx`、`apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx`、`apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx`：五类运营平面列表及核心搜索/排序；
- `apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx`：组织架构树搜索现状；
- `apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`：平台组织/合同概览列表和页签；
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/BusinessEntityTaskReadServiceSql.java`、`OrganizationOverviewTaskReadPersistence.java`、`OrganizationHierarchyService.java`：运营实体、平台列表和组织树 owner read/query 现状；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java`、`PlatformContractOverviewController.java`：平台列表/详情扩展字段映射差异；
- `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts`：运营各实体列表 readback 中的扩展值字段与生成契约；
- `doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md`、`doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md`：既有字段配置及实体扩展值表单/详情基线。

## 独立核验重点

请先执行并独立阅读六维 recall 的命中原文及其 `sourceRefs`，至少覆盖以下路由：

```bash
scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind design --domain contract --consumer-face operations-admin --owner contract --impact contract --trigger review
scripts/context/recall-memory --task-kind review --domain admin-ui --consumer-face operations-admin --owner frontend-platform --impact architecture --trigger review
```

请以当前字节为准逐项核对：

- `ExtensionHostTypes.VALUES` 与 OpenAPI `ExtensionEntityType` 是否仍为同一八类全集；逐个检查五类平面宿主、三类组织树宿主及两个后台，不接受只验证经营租户的点状结论；
- 字段配置 table/drawer 是否需要两个布尔属性、默认值和状态组合是否闭合；当前文档把 `searchable => listDisplay` 列为推荐而非既定裁决，需判断并标出产品歧义；
- 平面动态列的列位置、顺序、固定性、不可排序、类型格式化和空值规则是否有充分业务依据；动态搜索项的控件和匹配规则是否与五种类型一一对应；
- 运营列表的扩展值、平台列表当前空 `extensionFields`、合同列表当前空扩展映射，以及组织树当前本地名称/编码搜索，是否形成完整影响面；
- owner 是否能在同一授权范围内完成扩展过滤、总数、分页和 readback；是否明确禁止逐行请求、当前页本地过滤、跨宿主 key/label 串用和静默文本 fallback；
- 定义启停、label/order/options 修改、类型固定、未知历史值保留、无效请求、定义读取失败、权限/上下文失效和 typed problem 是否均有行为与恢复边界；
- UI 操作是否来自明确的用户任务/既有 IA；当前没有实现，不要以现有源码的缺失反推需求正确，也不要把需求文档中未裁决的树搜索或搜索-only 语义擅自判定为已批准；
- 需求层明确列出的具体规则是否有 canonical home；如评审发现正本缺少必须由标准/详设决定的判据，请写 `DESIGN_GAP`，不要在 review 中另立一套永久规则；
- 这是静态设计审查，不要启动 Web、DEV、reset、seed、backend acceptance、browser L2、UAT 或部署，不修改需求、源码、契约、测试、依赖或 Git。

## 期望结论

请给出明确的 `GO`、`GO_WITH_UNVERIFIED_UI` 或 `NO-GO`，并给出 `M/S/N` 数量。每条 finding 请包含：严重度、准确仓根相对路径与行号/唯一 symbol/段落、当前事实、后果、最小修复建议、适用边界，以及 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION` 分类。

请严格区分静态设计证据、focused test、Web、Android/native/device、DEV、L2 和 cleanup；本轮未运行动态验证，不能把静态设计判断升级为完整用户体验或运行验收。

请按以下固定结构收口：

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_REQUIREMENTS_20260914
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
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
您好 Claude，烦请协助对“扩展字段列表展示与类型化搜索需求”做一次独立 DESIGN review。

背景：用户指出截图中的“经营租户列表”只是示例，实际范围是所有有扩展字段实体的列表和搜索页。Codex 已根据当前 catering-v2s 源码盘点出八类扩展宿主：品牌、经营租户、总公司、门店、合同、商业集团、大区、项目，并形成需求正本 doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md。该正本只写需求，不是详设或实现授权；本轮未启动 DEV、reset、seed、backend acceptance、browser L2、UAT、部署或动态验证。

目标：请独立核验这份需求是否完整覆盖八类宿主、两个独立后台、五类平面列表和组织架构树搜索；是否正确定义“是否列表展示”“是否可搜索”、固定动态列、不可排序、类型化搜索、服务端过滤、分页总数、权限、owner、失败恢复和历史值边界；并判断 searchable=true 是否必须约束 listDisplay=true、商业集团/大区/项目树是否属于搜索范围。请先从“为什么这份需求不成立”出发找反例，再核对作者材料；不要从现有页面缺失反推用户任务。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md：本轮需求正本；
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、doc/platform/review-standard.md、doc/platform/claude-review-handoff-template.md：仓库入口、review 动作与交接边界；
- doc/platform/roadmap-program-registry.json、doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md：程序与当前授权字段，不从 Roadmap 推断任务；
- project-memory/index.md 及全部 kernel、project-memory/operations/claude-review-handoff-standard.md、project-memory/decisions/independent-subagent-adversarial-review.md、doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md：六维 memory、Claude 交接、独立盲审和两轮上限；
- project-memory/decisions/confirmed-business-language-corpus.md、project-memory/decisions/http-crud-efficiency-design-redlines.md、project-memory/decisions/owner-read-model-and-lifecycle-standard.md、project-memory/practices/ordering-only-for-consumer-facing.md、project-memory/practices/read-model-granularity.md：业务、owner read、集合分页和排序边界；
- apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java、apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java、contracts/openapi/components/extension/extension.schemas.json：八类宿主、定义 owner 与当前契约；
- apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx、apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionEditDrawer.tsx：平台配置 table/drawer；
- apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx、apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx、apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx、apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx：运营五类平面列表与组织树；
- apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationOverviewTaskReadPersistence.java、apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java、apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/contract/PlatformContractOverviewController.java：平台列表/详情扩展字段现状；
- apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/BusinessEntityTaskReadServiceSql.java、apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationHierarchyService.java、apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts：运营 owner 查询、组织树查询和列表 readback；
- doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md、doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md：既有扩展配置和实体扩展值交互基线。

请至少执行并阅读以下六维 recall 命中原文及 sourceRefs：
scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind design --domain contract --consumer-face operations-admin --owner contract --impact contract --trigger review
scripts/context/recall-memory --task-kind review --domain admin-ui --consumer-face operations-admin --owner frontend-platform --impact architecture --trigger review

请重点检查：八类宿主与全部页面分母是否闭合；平台列表当前空 extensionFields、运营列表当前无动态过滤、组织树当前仅名称/编码本地搜索是否被完整纳入；两个开关的默认/启停/顺序/历史值规则；TEXT/NUMBER/DATE/BOOLEAN/SELECT 控件与匹配语义；固定列不排序；搜索条件与核心条件 AND、总数和分页一致；owner 权限与 typed problem；是否禁止逐行请求和当前页本地过滤；searchable-only 与树搜索是否属于必须先由 Dexter 裁决的产品语义；以及是否存在更小、更直接的替代方案。

请给出 REVIEW_TARGET=DESIGN、ACTION_1_VARIANT=1-B、VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO、M/S/N，并分别写 L1_ENGINEERING、L2_USER_VISIBLE、L3_UNVERIFIED、SAME_ROOT_SCAN、DESIGN_GAPS、EVIDENCE_TIER。每条 finding 请写准确仓根相对路径与行号/唯一 symbol/段落、事实、后果、最小修复建议和 CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED_REQUIRES_EVIDENCE/DEXTER_DECISION。不要把需求正本、历史 review、聊天摘要或旧 evidence 当作当前授权；以当前仓库字节为准。

授权边界：本次只请求对需求正本做独立静态 DESIGN review。你的 GO/NO-GO 只表示该需求是否具备进入下一轮详设的条件，不授权修改代码、契约、数据库、测试、脚本、依赖、需求正本，启动 DEV、reset、seed、backend acceptance、browser L2、UAT、部署、切流或任何 Git 操作；所有产品/Journey/范围和后续实施授权仍由 Dexter 单独决定。谢谢。
```

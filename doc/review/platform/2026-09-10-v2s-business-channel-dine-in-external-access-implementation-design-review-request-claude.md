REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=NOT_APPLICABLE_RETIRED_BY_AGENTS
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-independent-review-round2-codex.md
ADVERSARIAL_REVIEW_REPORT_ROUND1=doc/review/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-independent-review-round1-codex.md
INDEPENDENT_REVIEW_VERDICT=GO
REVIEW_STATUS=REQUESTED
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-IMPLEMENTATION-DESIGN
IMPLEMENTATION_AUTHORITY=false

## 背景

本轮是 `BC-20260910-DINE_IN_EXTERNAL` 需求变更从影响分析进入 implementation-facing 详设和串行实施计划的独立设计评审。Dexter 已明确三项产品裁决：门店自己的小程序相对于购物中心是外部系统；外部 `DINE_IN` 与所有外部系统一样不使用 `POS/QR/KIOSK`；新规则仅适用于 `STORE`；本批形成完整 platform closure，但外部系统不建立本平台销售菜单。销售菜单仍只接受 `STORE + INTERNAL + DINE_IN/TAKEAWAY`。当前设计将平台闭包 provider 固定为 `STORE_OWNED_MINI_PROGRAM_DINE_IN`，使用既有 `EXTERNAL_GRANT`、`LOCAL_ONLY`、`PLANNED` 闭集语义和 workspace `ENABLED` enablement；不声称具体第三方 adapter 或外部菜单同步。

本轮设计没有修改生产代码、契约、迁移、测试或 seed，也没有启动 DEV、reset、seed、backend acceptance、browser L2 或 UAT。此前需求分析 review 的两轮不替代本轮 fresh implementation-facing DESIGN review。

## 评审目标

请独立判断以下设计是否足以指导后续一次性实施：

1. `STORE + EXTERNAL + DINE_IN` 是否在 policy、DB CHECK、provider capability、binding、edge、UI、seed 和 acceptance 中闭合，且 `dineInForm=null`；
2. `PROJECT + EXTERNAL + DINE_IN` 是否有窄义 typed reject、数据库保护、无部分写入和 UI fail-closed；
3. O5 门店全部经营渠道读取是否与 `SALES_MENU` 资格读取严格分离，且没有把外部渠道引入本平台菜单；
4. DINE_IN capability、真实 provider descriptor、source catalog→materialize/codegen、旧 error 退役和新 error 闭集是否没有遗漏或虚构；
5. UI 信息层次、空/加载/失败/重试、stale-field 清理、foundation 复用、testId roster 和 L2 admission 是否可执行；
6. migration、owner/edge transaction、CAS/权限、acceptance fixture/request/business oracle、full-suite 和受管 runtime 边界是否明确；
7. 是否存在更小的实现方案、跨 owner 反向写、文档互相矛盾、未声明的产品语义或无法证明的完成主张。

## 需阅读文件

从 `catering-v2s` 仓库根读取：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`：执行边界、owner、runtime 和 review 规则；
- `doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-journey-amendment.md`：当前 Journey 与 Dexter 决策；
- `doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ui-interaction-design-codex.md`：O2/O4/O5 UI 文案、信息层次和 testId roster；
- `doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ia-amendment-codex.md`：IA 九维度、读取形态、权限和 forbidden UI；
- `doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-codex.md`：逐层实现目标、owner、契约、migration、UI、seed、acceptance 与证据；
- `doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-plan-codex.md`：CP 顺序、逐点前后双读、focused proof、全量验证和授权边界；
- `doc/review/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-independent-review-round1-codex.md`、`...round2-codex.md`：fresh independent DESIGN Round 1/2 原文与最终 verdict；
- `doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-requirements-change-analysis-codex.md`：裁决前分析及其 superseding section；
- `doc/platform/backend-coding-standard.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/foundation-charter.md`、`doc/platform/review-standard.md`：设计判据；
- `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`：真实 HTTP 场景与 full-suite 判据；
- `project-memory/index.md`、`project-memory/kernel/` 全部文件及六维 recall 命中原文：当前仓约束和既往失败模式；
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java`、`BusinessChannelOwnerService.java`：现行 policy、channel read、sales-menu eligibility；
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CheckedInCollaborationCatalogSource.java`、`CollaborationOwnerService.java`、`CollaborationBindingPolicy.java`：能力、provider、binding owner；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java`：store usage 与 scope edge；
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_001__business_channel_owner.sql`：现行 DINE_IN CHECK；
- `contracts/collaboration/external-platform-catalog.json`、`external-platform-catalog.schema.json`、`contracts/openapi-source/business-channel.schemas.json`、`contracts/openapi-source/collaboration.schemas.json`、`contracts/openapi/paths/operations-admin/business-channel.paths.json`：现行 contract/catalog；
- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`、`doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`、`scripts/generate/r5-edge-materialize.mjs`、`scripts/generate/edge-codegen.mjs`：生成源与闭集；
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx`、`BusinessChannelTemplateDetailDrawer.tsx`、`BusinessChannelList.tsx`、`StoreBusinessChannelPage.tsx`、`application/queries.ts`、`model/collaborationCodeLabels.ts`、`app/automation/businessChannelTemplateTestIds.ts`：UI owning source；
- `libraries/frontend/admin-ui-foundation/`：必须复用的基础能力；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java`、`BusinessChannelAcceptanceScenarios.java`、`SalesMenuAcceptanceScenarios.java` 和 `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`：未来场景/fixture owning source。

## 独立核验重点

- 先从当前 Journey/UI/IA/详设推导 expected set，再判断 implementation plan 是否漏项；不要把作者的“完整闭包”表述当证据。
- 复核 `EXTERNAL + DINE_IN` 的 `dineInForm=null` 是否在请求、owner、migration、readback、UI、seed 和 acceptance 中逐层一致；任何 POS/QR/KIOSK 出现于外部路径都是 finding。
- 复核 D-02 仅 STORE 的边界；项目外部 DINE_IN 是否有新窄义 error，而不是继续使用语义过宽的 `DINE_IN_MUST_BE_INTERNAL`。
- 复核 provider 是否为真实 checked-in capability；不得将现有 TAKEAWAY provider 当 DINE_IN，也不得在没有 descriptor 事实时虚构 provider/adapter。
- 复核 `getOperationsStoreBusinessChannels` 的 `BUSINESS_CHANNEL` 与 `SALES_MENU` 分支、集合形态、参数约束、owner invocation 和 store scope；销售菜单既有双路径 predicate 必须保持。
- 复核 additive migration 能否保护旧数据和新组合，且没有改写已执行 migration、跨表 CHECK 或无回填误读。
- 复核 UI provider 查询显式传 DINE_IN、失败/空集可解释且阻断保存、stale value 清理、O5 全渠道展示、testId 唯一源和真实动作节点。
- 复核 acceptance 场景有 fixture/request/business oracle、负向无写入、全量套件和最终 run 晚于最后代码改动；动态证据在当前阶段应保持 `UNVERIFIED_REQUIRES_EVIDENCE`。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，如仍有未执行动态证据可使用 `GO_WITH_UNVERIFIED_UI`，并统计 `M/S/N`。每项 finding 请带：精确仓根相对路径和锚点、状态（`CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`）、影响面、最小修复建议及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次“到店点餐允许外部接入”的 implementation-facing 详设与串行实施计划。

背景：本轮已完成 D-01、D-02、D-04 的产品裁决。门店自己的小程序相对于购物中心是外部系统；外部 DINE_IN 与所有外部系统一样不使用 POS、扫码或自助机，因此 dineInForm 必须为空；规则仅适用于 STORE；本批形成完整 platform closure，但外部系统不建立本平台销售菜单。销售菜单逻辑保持不变，只接受 STORE + INTERNAL + DINE_IN/TAKEAWAY。当前仅完成设计材料，未写生产代码、契约、迁移、测试或 seed，未启动 DEV、reset、seed、backend acceptance、browser L2 或 UAT。

目标：请独立核验该设计是否在 business-channel policy、additive migration、collaboration DINE_IN capability/provider/binding、source catalog→generated contract、operations edge、operations-admin UI/IA/testId、门店全部渠道读取与 SALES_MENU 隔离、seed/acceptance 计划以及证据/授权边界上形成可实施闭包。请特别找出外部 DINE_IN 仍出现 POS/QR/KIOSK、PROJECT 外部 DINE_IN 未 fail closed、虚构 provider/TAKEAWAY alias、O5 错用 SALES_MENU 读取、旧错误码只删产物、migration 改写历史或 UI/testId/L2 不可执行的反例。

请从 catering-v2s 仓库根阅读：
- doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-journey-amendment.md：当前 Journey 与产品裁决；
- doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ui-interaction-design-codex.md：UI 信息层次、文案和 testId roster；
- doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ia-amendment-codex.md：IA 读取、权限、状态和 forbidden UI；
- doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-codex.md：implementation-facing 逐层详设；
- doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-plan-codex.md：串行 CP、proof 和授权边界；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java：现行 DINE_IN policy；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java：owner revalidation、通用渠道读取和销售菜单资格；
- apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CheckedInCollaborationCatalogSource.java：能力闭集；
- apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java：provider candidate；
- apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationBindingPolicy.java：binding scope；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java：store usage 分支与授权；
- apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_001__business_channel_owner.sql：旧 CHECK；
- contracts/collaboration/external-platform-catalog.json、contracts/collaboration/external-platform-catalog.schema.json、contracts/openapi-source/business-channel.schemas.json、contracts/openapi-source/collaboration.schemas.json：catalog/contract；
- doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json、doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json、scripts/generate/r5-edge-materialize.mjs、scripts/generate/edge-codegen.mjs：生成链；
- apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx、BusinessChannelTemplateDetailDrawer.tsx、BusinessChannelList.tsx、StoreBusinessChannelPage.tsx、application/queries.ts、app/automation/businessChannelTemplateTestIds.ts：UI owning source；
- libraries/frontend/admin-ui-foundation/：foundation 复用边界；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java、BusinessChannelAcceptanceScenarios.java、SalesMenuAcceptanceScenarios.java、scripts/dev/external-collaboration-business-channel-seed-plan.mjs：未来动态证据 owning source。

请重点独立核验：外部 DINE_IN 必须没有 POS/QR/KIOSK；仅 STORE 允许；provider 必须精确声明 DINE_IN；固定 provider descriptor 的全部必填字段、现有 EXTERNAL_GRANT/LOCAL_ONLY/PLANNED 语义与 platform-only closure 说明是否可执行；门店经营渠道全部读取必须与 SALES_MENU 资格读取分开；sales-menu 不得扩张；旧错误码必须从 source catalog 退役并以新 project-specific typed problem 闭合；migration 只能 additive；UI empty/error/retry/stale cleanup/testId 与 L2 admission 必须可执行；未运行的动态证据必须明确标为 UNVERIFIED_REQUIRES_EVIDENCE。

烦请给出明确 GO 或 NO-GO，并按 M/S/N 给出精确 finding、影响、最小修复和是否需要 Dexter 决策。授权边界：本轮只评审 implementation-facing 设计，不授权任何生产代码、契约生成、迁移、测试、seed、reset、DEV、backend acceptance、browser L2、UAT、部署或切流。谢谢。
```

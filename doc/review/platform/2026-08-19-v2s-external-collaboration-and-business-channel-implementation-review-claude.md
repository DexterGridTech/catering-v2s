# 外部协作与经营渠道 IMPLEMENTATION Claude 收口复核

## 背景

本轮是 `R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_AUTHORIZED=true` 下的完整 implementation 交付，范围覆盖 collaboration 与 business-channel owner、契约及 generated wire、edge policy/capability、双后台 UI、14 条 backend acceptance scenario、本域 seed plan/executor 与对应静态/编译/focused proof。

设计阶段已经由 Dexter 收口授权实施。实施后的同一 review cycle 已完成两轮 fresh 独立子 agent 对抗复核：Round 1 为 `NO-GO · M=6 · S=6 · N=1`，Round 2 为 `NO-GO · M=1 · S=1 · N=0`；Round 2 的唯一未闭合项为 F-02（门店深链上下文）与 G-UI-01（P5/P6 owner binding detail/edit）。Codex 已完成逐条 intake、修复与新鲜静态/编译/focused proof，当前请求 Claude 做整批收口复核。Round 2 已是本 cycle 的最后独立子 agent 轮，不请求第三轮，也不把本请求计作第三轮。

本次修复后的作者 intake 为 `REPAIRED_AFTER_ROUND_2`。六项 C（C-01、C-02、C-03、C-04、C-08、C-09）仍保持 `DEXTER_DECISION`，没有被实施或 review 偷做产品裁决；`catalogStatus=PLANNED` 仍只是候选信息，不是启用门槛。

## 评审目标

请从冻结需求、已接受设计和真实源码出发，独立确认：

1. 两个 owner 的事实/命令主权、跨 owner edge 的有限双 command、同一 `REQUIRED` 事务、单向依赖和两个 app 的 consumer face 是否仍成立。
2. 冻结枚举字面量是否全链路一致：`GROUP_BUY`、`TAKEAWAY`、`INVENTORY_SYNC`、`TAKEAWAY_DELIVERY`、`LOCAL_ONLY`、`COMMERCIAL_GROUP`；不得接受旧漂移字面量或把 `GROUP` 当作 `COMMERCIAL_GROUP`。
3. F-02 修复是否真正使 O5 门店深链的 URL `storeRef` 成为确定性上下文：页面先读取 URL 门店，再从真实门店得到 project；edge 是否拒绝跨 project 的 `projectRef/storeRef` 配对；不得用 ambient store session 冒充 URL 门店。
4. G-UI-01 修复是否闭合 `owner table → readback/SQL → OpenAPI source/published → generated wire/client → mapper → platform P5 detail → P6 edit`：P5 必须使用当前 `bindingRef` 的最新 detail，展示 `boundAt`、独立的 `statusChangedAt` 和授权说明；普通名称/owner 编辑不得伪装成状态变化；`EXTERNAL_GRANT` 仍由回调管理，`NO_MAPPING` 不出现 `externalOwnerId`。
5. E-33、候选过滤、PLANNED 候选语义、disabled channel 只读、非 DINE_IN 的 `dineInForm` 边界、seed 夹具三族和 14 条 acceptance scenario 是否没有被修复过程回归。
6. 机器门与证据是否只证明它们实际证明的范围；不得把静态/编译/focused PASS 或 seed plan self-test 说成 HTTP、真实数据库、动态 Testcontainers、DEV、seed/reset、browser L2 或 UAT PASS。

## 需阅读文件

请从 `catering-v2s` 仓库根阅读：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`：执行入口、owner/事务/consumer-face、动态环境和 review 边界；
- `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md`：冻结需求、E-33 与 P5/P6 数据要求；
- `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md`、`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md`、`doc/decisions/2026-08-19-v2s-business-channel-management-journey.md`、`doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md`：IA、页面路径、用户旅程和操作边界；
- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md`、`doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md`：实施详设、CP-00 至 CP-09 和串行交付边界；
- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-review-claude.md`、`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-1-verdict.md`、`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-2-verdict.md`：此前设计复核、Round 1/2 独立 findings；
- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-1-author-intake.md`、`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-2-author-intake.md`、`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-review-round-2-input-checklist.md`：作者逐条 intake、修复状态、最终独立复核输入边界；
- `contracts/openapi-source/collaboration.schemas.json`、`contracts/openapi-source/business-channel.schemas.json`、`contracts/openapi/paths/platform-admin/external-collaboration.paths.json`、`contracts/openapi/paths/operations-admin/business-channel.paths.json`：契约源及双 app 暴露面；
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/api/CollaborationReadback.java`、`apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java`：owner 读回、绑定时间事实和状态转换写路径；
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java`、`apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java`：经营渠道 owner 与兼容性政策；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/externalcollaboration/ExternalCollaborationBusinessChannelCoordinator.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java`：edge 编排、同事务命令和 O5 深链候选 pair 校验；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java`、`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreCandidateTaskReadService.java`：五类 external binding candidate、`COMMERCIAL_GROUP`/`REGION` 与 `EXTERNAL_BINDING` 查询链；
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/ExternalCollaborationWireMapper.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/OwnerBindingView.java`、`apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts`、`apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts`：generated wire/client 与 mapper；
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_000__collaboration_owner.sql`、`apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_002__collaboration_owner_binding_status_changed_at.sql`：owner 表与 additive status timestamp migration；
- `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingDetailDrawer.tsx`、`apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingFormDrawer.tsx`、`apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingList.tsx`、`apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingDetailDrawer.test.ts`：P5 最新 detail、P6 edit、认证方式边界与 focused rule test；
- `apps/frontend/operations-admin/src/features/business-channel/ui/StoreBusinessChannelPage.tsx`、`apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx`、`apps/frontend/operations-admin/src/OperationsApp.tsx`、`apps/frontend/operations-admin/src/tests/architecture/business-channel-scope.test.mjs`：O5 深链和 URL store context 的 consumer/focused proof；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java`：本批新增 acceptance domain group、14 条场景和 catalog 登记；
- `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`、`scripts/dev/external-collaboration-business-channel-seed-executor.mjs`、`scripts/check/external-collaboration-business-channel-contract.mjs`：本域 seed 设计、静态 executor 边界和契约静态检查；
- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`：hash-bound edge source catalog；本批 collaboration schema 变更后已同步 source hash。

## 独立核验重点

请不要只按作者 intake 复述结论，先从需求和源码反推用户任务，再检查实现：

- 重新检查 Round 2 的 F-02：构造“URL 门店 B、ambient/session 门店 A、projectRef 属于 A”的反例，确认显式 organization read、selected-project authorization 和 pair 比较共同阻断错误组合；确认真实 owner module 未被 edge 绕过。
- 重新检查 G-UI-01：确认 list 行只是入口，drawer 打开后按 `bindingRef` 读取 detail；确认 migration/backfill 与 create/delete/authorization/revocation 状态转换的时间语义，且普通 update 不改 `statusChangedAt`；确认 P6 只调用既有 update owner command，不引入解绑状态。
- 对照冻结规格逐一核对六个契约字面量、E-33 七个触点、`catalogStatus=PLANNED` 候选语义、disabled channel 的只读约束、非 DINE_IN `dineInForm`、项目模板状态 idempotency key、seed 的五类绑定/万象城海底捞/内部 POS-扫码-自助机三族。
- 复跑或独立核验这些静态/focused 命令的真实输出：
  `node scripts/generate/edge-codegen.mjs --check`、`bash scripts/check/openapi-contracts`、`bash scripts/check/operation-handler-bindings`、`node scripts/check/external-collaboration-business-channel-contract.mjs`、`bash scripts/check/r5-edge-materialize --check`、`bash scripts/check/capability-invariants`、`bash scripts/check/contract-face`、`bash scripts/check/backend-boundaries`、`bash scripts/check/database-boundaries`、`bash scripts/check/flyway-layout`、`bash scripts/check/frontend-architecture`、两端 `yarn typecheck`/unit/architecture、backend `compileJava`/`compileTestJava`、seed plan/executor self-test 与 plan-only。
- 分清证据边界：本批 backend 动态 test task 首败为 `V2S_TESTCONTAINERS_REMOTE_REQUIRED`，未绕过或重试；没有 HTTP、真实数据库、Testcontainers、DEV、seed/reset、browser L2、UAT 或外部平台联调证据。若发现需要上述动态证据，请标为未验证或另行需要 Dexter 授权，不要把它写成当前实现已通过。
- 独立评价方案合理性和 UI 路径：P5→P6 是否来自批准 Journey、是否比读取旧列表行更可靠、是否复用了 foundation lifecycle；若认为产品/Journey 或六项 C 仍有歧义，请标 `DEXTER_DECISION`，不要自行固化。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并报告 `M` / `S` / `N` 数量。每条 finding 请给出精确仓库相对路径与行号、影响面、最小修复建议、适用边界/反例，以及是否需要 Dexter 产品裁决。请将静态事实、动态未验证、推论和产品判断分开，不要因 Round 2 已修复或机器门全绿而自动放行。

本次 Claude 结论只用于 R5 本批 implementation 的独立收口复核，不替代 Dexter 的产品取舍，也不改变六项 C 的 `DEXTER_DECISION` 状态。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 catering-v2s 本次 R5「外部协作与经营渠道」完整 implementation 做独立收口复核。

背景：本轮已获 Dexter 的 implementation 授权，范围包含 collaboration/business-channel owner、契约与 generated wire、edge policy/capability、platform-admin 与 operations-admin UI、14 条 backend acceptance scenario、本域 seed plan/executor 和静态/编译/focused proof。设计已 GO；同一 implementation review cycle 的 Round 1 独立复核为 NO-GO（M=6、S=6、N=1），Round 2 为 NO-GO（M=1、S=1、N=0），作者已完成逐条 intake 与修复。Round 2 是该 cycle 最后一轮独立子agent复核，不再召集第三轮；本次是 Claude 收口复核，不计作第三轮。

目标：请从冻结需求和真实源码独立确认 owner/edge/事务边界、冻结契约字面量、E-33、F-02 门店深链 URL 上下文修复，以及 G-UI-01 owner binding 的最新 detail、boundAt/statusChangedAt、授权说明和受限 P6 edit 是否真正闭合；同时核对静态/编译/focused 证据没有越界冒充动态业务 PASS。六项 C（C-01、C-02、C-03、C-04、C-08、C-09）必须保持 DEXTER_DECISION。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md：冻结需求、E-33、P5/P6 数据要求；
- doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md、doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md、doc/decisions/2026-08-19-v2s-business-channel-management-journey.md：IA、路由和用户操作；
- doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md、doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md：详设与 CP-00 至 CP-09；
- doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-2-verdict.md、doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-2-author-intake.md：最终独立 verdict 与作者修复 intake；
- contracts/openapi-source/collaboration.schemas.json、contracts/openapi-source/business-channel.schemas.json、contracts/openapi/paths/platform-admin/external-collaboration.paths.json、contracts/openapi/paths/operations-admin/business-channel.paths.json：契约与双 app 面；
- apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java、apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java：owner 事实、时间字段、状态转换与经营渠道；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/externalcollaboration/ExternalCollaborationBusinessChannelCoordinator.java、apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java：edge 编排与 F-02 pair 校验；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/ExternalCollaborationWireMapper.java、apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/OwnerBindingView.java、apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts：wire/generated/mapper；
- apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingDetailDrawer.tsx、apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingFormDrawer.tsx、apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingList.tsx、apps/frontend/operations-admin/src/features/business-channel/ui/StoreBusinessChannelPage.tsx：P5/P6 与 O5 consumer；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java、apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java、apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java：14 条 acceptance 场景；
- scripts/dev/external-collaboration-business-channel-seed-plan.mjs、scripts/dev/external-collaboration-business-channel-seed-executor.mjs、doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-2-input-checklist.md：seed 静态设计与最终复核输入边界。

请重点独立核验：
- 用 URL 门店 B/session 门店 A/project A 的反例检查 F-02 是否被显式 store read、selected-project authorization 和真实 pair comparison 阻断；
- 检查 owner table→statusChangedAt migration/backfill→readback/SQL→OpenAPI/generated→mapper→P5 最新 detail→P6 update 的全链，确认普通 update 不改变 statusChangedAt、EXTERNAL_GRANT 不开放本地 edit、NO_MAPPING 不显示 externalOwnerId；
- 对照冻结规格核对 GROUP_BUY、TAKEAWAY、INVENTORY_SYNC、TAKEAWAY_DELIVERY、LOCAL_ONLY、COMMERCIAL_GROUP、E-33、PLANNED 候选、disabled channel、非 DINE_IN dineInForm、seed 三族和 14 条 scenario；
- 复跑或核验 codegen/OpenAPI/operation-binding/materialize/边界/前端 typecheck-unit-architecture/backend compile 与 seed self-test 的真实结果；动态 test 首败是 V2S_TESTCONTAINERS_REMOTE_REQUIRED，本批没有 HTTP、真实数据库、Testcontainers、DEV、seed/reset、browser L2、UAT 或外部平台联调证据，请勿将其视为已通过；
- 独立判断 P5→P6 是否符合批准 Journey、是否复用共享 foundation、是否存在更短或更安全路径；产品/Journey/六项 C 歧义请明确标为 DEXTER_DECISION。

烦请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请带精确仓库相对路径与行号、影响面、最小修复建议、适用边界/反例及是否需要 Dexter 产品裁决；请区分静态事实、动态未验证、推论和产品判断。

授权边界：本次结论只用于 R5 外部协作与经营渠道 implementation 的独立收口复核；不改变六项 C 的 DEXTER_DECISION，不授权任何未明确批准的产品范围或动态环境动作，也不把静态 review 自动升级为运行、数据或发布结论。谢谢。
```

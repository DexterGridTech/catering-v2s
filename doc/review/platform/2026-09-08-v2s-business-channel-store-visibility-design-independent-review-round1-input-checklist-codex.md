REVIEW_CYCLE_ID=BUSINESS_CHANNEL_STORE_VISIBILITY_DESIGN_2026_09_08
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=AUTHOR_VERDICT_BEFORE_REVIEWER_FORBIDDEN
ROUND_FINAL_DECISION=NOT_APPLICABLE_ROUND_1

# 经营渠道模板门店可见范围 · DESIGN Round 1 独立盲审输入清单

## 1. Reviewer boundary

你是本轮 fresh 独立 reviewer。先按仓库入口和下列原文独立建立业务/架构模型，再形成 findings/verdict；不得先读取作者 disposition/self-review/Claude brief，不得把本清单中的建议当成已接受裁决。

只做只读静态设计审查：不得修改任何文件，不得执行生产代码、契约生成、migration、seed、reset、DEV、backend acceptance、browser L2、UAT、部署、Git 或外部联调；不得召集子 reviewer。动态项只能标记 UNVERIFIED_REQUIRES_EVIDENCE，不得把未运行冒充 PASS。

## 2. 必读入口与规范

- AGENTS.md：执行边界、owner、远端后端/本机 Vite 拓扑、主 agent 写入边界、独立 review 与结束闸门；
- PLATFORM-BLUEPRINT.md：架构、consumer face、事务和动态边界；
- scripts/README.md：受管命令、远端 Java 拓扑、backend acceptance/seed/DEV/L2 入口；
- doc/platform/review-standard.md：review 证据与 finding 规则；
- doc/platform/backend-coding-standard.md：owner、事务、错误、readback、集合形态；
- doc/platform/frontend-coding-standard.md：operations-admin、foundation、TestId、可访问性；
- doc/platform/foundation-charter.md：共享 foundation 与 collection boundary；
- doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md：本轮 two-round/fresh/blind 规则；
- doc/decisions/templates/journey-decision-template.md、doc/decisions/templates/ia-design-template.md、doc/decisions/templates/ui-interaction-design-template.md、doc/decisions/templates/implementation-design-template.md：设计维度；
- doc/platform/claude-review-handoff-template.md、project-memory/operations/claude-review-handoff-standard.md：外部 review 交接边界。

## 3. Project memory

- project-memory/index.md；
- project-memory/kernel/01-workspace-and-roadmap.md；
- project-memory/kernel/02-service-shape-and-owner.md；
- project-memory/kernel/03-transaction-data-and-dependencies.md；
- project-memory/kernel/04-contract-consumer-and-admin.md；
- project-memory/kernel/05-evidence-runtime-and-git.md；
- project-memory/kernel/06-heritage-and-change.md；
- project-memory/decisions/deterministic-context-only.md；
- project-memory/decisions/confirmed-business-language-corpus.md；
- project-memory/decisions/independent-subagent-adversarial-review.md；
- project-memory/operations/backend-acceptance.md；
- project-memory/operations/business-corpus-adoption-and-read-policy.md；
- project-memory/operations/business-corpus-parked-domain-intake.md；
- project-memory/operations/implementation-source-reread-discipline.md；
- project-memory/practices/collection-boundary-modes.md；
- project-memory/practices/backend-capability-lookup.md；
- project-memory/practices/frontend-capability-lookup.md；
- project-memory/practices/decided-undecided-marking.md。

## 4. 本批设计输入

- doc/decisions/2026-09-08-v2s-business-channel-store-visibility-journey-amendment.md：本批 Journey、四条需求、不变量、未决产品边界；
- doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ia.md：五个 IA-ID、九维行为、集合/授权/刷新/错误边界；
- doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ui-interaction.md：O1/O2/O1T/O5/O5C surface ownership、线框、动作与 TestId 分母；
- doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-design.md：owner/契约/schema/transaction/UI/acceptance 详设；
- doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-plan.md：未来实施 CP、逐代码与详设对账、动态边界；
- doc/decisions/2026-08-19-v2s-business-channel-management-journey.md：既有 Journey baseline；
- doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md：既有 IA baseline；
- doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md：既有 interaction baseline；
- doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md：既有 owner/contract baseline；
- doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md：既有 CP baseline。

## 5. Current owning source

- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java：template candidate/read、template create/update、channel create/read、transaction/lock 入口；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java：当前四维/status policy；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelCommandApi.java：当前 typed command；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelOwnerApi.java：当前 owner read API；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelReadback.java：当前 template/channel readback；
- apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java：现有 template/candidate/channel edge、session/grant scope；
- apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_001__business_channel_owner.sql：当前 template/channel/relation owner schema形态；
- apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_000__base1_three_state_lifecycle.sql：当前 template/channel/store status演进；
- contracts/openapi-source/business-channel.schemas.json：current wire schema source；
- contracts/registry/operation-handler-bindings.json：operation/handler source；
- scripts/generate/edge-codegen.mjs：generated contract byte flow；
- scripts/generate/operation-handler-bindings.mjs：generated binding byte flow；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java：owner-domain acceptance placement and existing fixture helpers；
- apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java：current scenario discovery；
- apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreCandidateTaskReadService.java：现有 STORE candidate status/project scope；
- apps/frontend/operations-admin/src/features/business-channel/ui/ProjectBusinessChannelPage.tsx：project template/channel page；
- apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx：template form；
- apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDetailDrawer.tsx：template detail/action menu；
- apps/frontend/operations-admin/src/features/business-channel/ui/StoreBusinessChannelPage.tsx：store candidate/channel page；
- apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelCreateDrawer.tsx：store/project channel create selector；
- apps/frontend/operations-admin/src/features/business-channel/application/queries.ts：candidate query functions；
- apps/frontend/operations-admin/src/app/queries/useOrganizationCandidates.ts：shared organization candidate hook；
- apps/frontend/operations-admin/src/app/automation/operationsDetailDrawerTestIds.ts：current detail action TestId source；
- libraries/frontend/admin-ui-foundation/src/index.ts：foundation export source；
- libraries/frontend/admin-ui-foundation/src/list/useCursorCandidates.ts：cursor candidate behavior；
- libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts：Drawer lifecycle behavior。

## 6. Required adversarial checks

请先独立推导，再逐项攻击：

1. 四条原始需求是否都被直接表达；“可见范围”是否被错误地合并进模板 status、store status 或 channel status。
2. ALL_PROJECT_STORES 是当前项目快照还是动态包含未来门店；SELECTED 空集合、disabled/voided store relation 是否被作者静默固化；未决项是否明确停在 review。
3. PROJECT 模板 null/empty wire 组合是否闭合；create/update 的 scope 与 store refs 是否可被直接 HTTP 绕过；typed problems 是否能阻止部分写。
4. migration backfill、cross-field CHECK、关系表 FK/opaque ref、索引、既有模板兼容和 owner relation consistency 是否可执行；是否过度依赖普通 CHECK 表达跨表 count。
5. candidate query 的 ALL/EXISTS、count/data/cursor identity 是否同步；既有 store channel list/detail 是否确实不受 visibility removal 影响。
6. template update 与 store channel create 的锁、CAS、幂等、audit、authoritative readback 和 same REQUIRED transaction 是否形成完整闭包；是否存在 race 或 partial write。
7. owner/edge/organization 方向是否单向；是否有 direct cross-schema write、reverse command、capability 混用、foreign identity leakage。
8. selected-store Page 与 organization candidate Page 的 collection shape、expected scale、search/add/remove 草稿、跨页和 refresh 是否真实可实现；是否有无理由的 client slice/hidden cap。
9. operationId、OpenAPI source、registry、generated byte flow、consumer face 是否一致；是否在 runtime/test 名称引入 Journey ID 或恢复 retired controls。
10. UI 层次是否让用户理解“影响新建，不回收已创建渠道”；foundation 是否足够复用；新动作是否都有唯一 app-owned TestIds.ts 设计、真实动作节点、焦点/错误/关闭恢复。
11. acceptance 场景是否放入 BusinessChannelAcceptanceScenarios.java、至少两家同项目 ENABLED store、foreign/negative fixture、existing-channel-retention red mutation、直接 HTTP rejection、rollback/CAS/idempotency；是否把静态设计误报动态 PASS。
12. 是否存在更小且不损害业务事实的替代；是否增加了需求未授权的 route/operation/状态耦合；指出具体过度设计或不足。

## 7. Required output

请输出一份独立 verdict，至少包含：

- REVIEW_CYCLE_ID=BUSINESS_CHANNEL_STORE_VISIBILITY_DESIGN_2026_09_08；
- REVIEW_TARGET=DESIGN；
- REVIEW_ROUND=1；
- REVIEW_ROUND_LIMIT=2；
- reviewerKind=INDEPENDENT_SUBAGENT；
- 本清单路径；
- blind declaration；
- GO 或 NO-GO 以及 M/S/N 数量；
- 每条 finding 的 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION；
- 精确仓库相对路径和符号/行号、反例、影响面、最小修复、是否需 Dexter 产品裁决、同根 sibling 检查范围；
- 明确区分设计缺口与尚未授权的动态证据；
- Round 1 不输出作者 disposition；如需要第二轮，只提出定向核验点，不自行修改文件。


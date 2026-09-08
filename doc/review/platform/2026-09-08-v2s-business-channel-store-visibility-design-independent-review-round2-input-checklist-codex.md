REVIEW_CYCLE_ID=BUSINESS_CHANNEL_STORE_VISIBILITY_DESIGN_2026_09_08
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
blindReviewDeclaration=AUTHOR_DISPOSITION_AND_CLAUDE_BRIEF_NOT_READ_BEFORE_REVIEW
SOURCE_ROUND1=doc/review/platform/2026-09-08-v2s-business-channel-store-visibility-design-independent-review-round1-codex.md
IMPLEMENTATION_AUTHORITY=false
RUNTIME_EXECUTION=NOT_RUN

# Round 2 定向独立盲审输入清单

本轮只验证 Round 1 之后当前字节的修复是否闭合，不把作者 intake 当作事实，不做动态执行，不修改文件，不生成契约，不运行 migration、测试、seed、reset、DEV、backend acceptance、browser L2、UAT 或 Git。请不要先阅读 round1-intake-codex.md 或 Claude review request；先从下列源和当前五份设计材料独立核验。

## 必读输入

1. AGENTS.md；PLATFORM-BLUEPRINT.md；scripts/README.md；doc/platform/backend-coding-standard.md；doc/platform/frontend-coding-standard.md；doc/platform/foundation-charter.md；doc/platform/review-standard.md；doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md。
2. project-memory/index.md 全部 kernel；按当前六维 recall 命中的原文；尤其复核 business-channel candidate、既有渠道保留、设计 intake 和 review 轮次边界。
3. doc/decisions/2026-09-08-v2s-business-channel-store-visibility-journey-amendment.md；doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ia.md；doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ui-interaction.md；doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-design.md；doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-plan.md。
4. 既有 baseline：doc/decisions/2026-08-19-v2s-business-channel-management-journey.md；doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md；doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md；doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md。
5. 当前 owning source：apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelReadApi.java；BusinessChannelOwnerApi.java；BusinessChannelReadback.java；BusinessChannelPolicy.java；BusinessChannelOwnerService.java；apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java；BusinessChannelWireMapper.java；apps/backend/catering-business-server/src/main/java/com/catering/v2s/business/channel/application/operations/ 下相关 operation；apps/frontend/operations-admin/src/features/business-channel/ 下页面/Drawer/query；libraries/frontend/admin-ui-foundation/src/index.ts、src/overlay/drawerSurface.ts、src/list/useCursorCandidates.ts、src/behavior/useDrawerFormLifecycle.ts。
6. 当前 seed owning source：scripts/dev/external-collaboration-business-channel-seed-plan.mjs；scripts/dev/external-collaboration-business-channel-seed-executor.mjs；scripts/dev/external-collaboration-business-channel-seed-executor.test.mjs；doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json；scripts/dev/r5-complete-seed-executor.mjs；scripts/dev/r5-complete-seed-executor.test.mjs；scripts/dev/profiles/r5-full.json；以及直接消费渠道 readback 的 scripts/dev/sales-menu-seed-plan.mjs、scripts/dev/sales-menu-seed-executor.mjs。
7. 只将 round1-codex.md 作为 finding 的定位参照；不得以作者 intake 或 Claude brief 代替当前源读取。

## 定向攻击点

1. M-01：确认 D-BCV-01..06 仍清楚标为 Dexter 产品裁决/实现硬门，没有在 plan、IA、UI、implementation design 中静默变成已接受事实；动态 membership、空集合、disabled/voided relation、保存提交、PROJECT wire、visible-store Page 的提案与状态是否一致。
2. M-02：五个 IA-ID 是否各自完整声明 emptyLoadingErrorStates、containerBehaviorUnderLoad、collectionShapeAndScale、forbiddenUI，并与原有九项逐项对应；逐 surface UI 声明是否覆盖 O1、O2 Drawer、O1T Drawer、O5 candidate、O5C create、O5 existing list/detail，且每块含全部强制键。
3. S-01：implementation design §12 是否使用 BusinessChannelReadApi.pageStoreTemplateCandidates/pageTemplateVisibleStores，BusinessChannelOwnerApi 是否仍只承载 sales-menu owner facts；当前 source 的 interface split 与 consumer 表是否一致。
4. S-02：implementation design/plan/UI interaction 的 TestId 分母是否一致，是否明确 formSubmit/formCancel 从当前 BusinessChannelTemplateDrawer.tsx footer inline identity 迁移到唯一 businessChannelTemplateTestIds.ts；不得把未来 TestId 当作当前已实现。
5. S-03：implementation design §15.1 和 plan CP-05 是否列出精确 seed 文件全集、区分直接造事实与依赖编排，并覆盖当前单店/8-template/14-plan static denominator 的未来处置；不能把 seed design 当 seed business PASS。
6. N-01：IA/UI interaction O5 空态文案是否逐字一致，所有同根用户可见文案是否还有可直接证伪的分歧。
7. 反向检查：visibleStoreCount 的 PROJECT/ALL=0、SELECTED=关系行数（含保留的 lifecycle relation）是否与 IA、UI、candidate/detail semantics 矛盾；ReadApi 路径、scope/candidate/既有 channel 边界是否有新冲突。
8. 方案仍必须区分静态设计、future dynamic evidence 和 implementation authorization；不能因为修复文档而报告 GO 到实现。

## 输出格式

请输出完整自包含 verdict，并首先声明：

```text
REVIEW_CYCLE_ID=BUSINESS_CHANNEL_STORE_VISIBILITY_DESIGN_2026_09_08
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
```

然后给出 GO 或 NO-GO、M/S/N；每条 finding 标注 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，提供精确仓库相对路径、符号/行号、反例、影响面、最小修复建议、是否需要 Dexter 裁决和 sibling 范围。明确说明哪些 Round 1 finding 已 MATCHED、哪些仍 OPEN；独立 reviewer 不改文件，不写实现，不运行动态，不召集第三轮 reviewer。

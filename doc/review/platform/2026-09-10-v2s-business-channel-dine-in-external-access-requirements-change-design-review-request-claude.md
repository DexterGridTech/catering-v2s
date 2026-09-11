# Claude DESIGN review request：经营渠道“到店点餐允许外部接入”需求变更

```text
REVIEW_KIND=REQUIREMENT_CHANGE_ANALYSIS
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=CLAUDE_EXTERNAL
IMPLEMENTATION_AUTHORITY=false
RUNTIME_EXECUTION=NOT_RUN
VERDICT_REQUIRED=GO | GO_WITH_UNVERIFIED_UI | NO-GO
SEVERITY_FORMAT=M/S/N
```

## 背景

本轮是 `BC-20260910-DINE-IN-EXTERNAL` 需求变更的独立 DESIGN review。原业务约定要求 `DINE_IN` 只能使用 `INTERNAL` 接入；Dexter 现在要求允许 `DINE_IN` 使用 `EXTERNAL` 接入，同时明确门店销售菜单逻辑不变：只有 STORE owner 的 INTERNAL `DINE_IN`/`TAKEAWAY` 渠道可以设置菜单。本轮尚未进入实施，当前不存在 runtime、backend acceptance、browser L2 或 seed 业务证据。

仓内当前字节显示，旧约束同时存在于 business-channel owner policy、已执行数据库 migration CHECK、operations-admin 模板 Drawer、active contract/error closed set、generated source 和 seed 红夹具；external collaboration catalog 当前没有 `DINE_IN` capability。需求分析必须把这些事实一次性闭合，不能用只删一个 Java 分支的方案冒充完成。

## 评审目标

请独立确认需求变更分析是否：

- 正确解除 `accessKind` 与 `DINE_IN` 的旧耦合，同时保留 DINE_IN form、provider、scope、binding、权限、事务和并发校验；
- 正确把外部 DINE_IN 经营渠道与销售菜单资格分成两个独立判据；
- 完整覆盖数据库、capability source/contract、owner、前端和验收影响，并没有凭空指定 provider 或把 TAKEAWAY 当作 DINE_IN；
- 以最小范围保持既有模板、渠道、菜单、publication、库存/人工可售事实不变。

## 给 Claude 的直接请求

请以独立 DESIGN reviewer 身份阅读当前仓库字节和下列输入，先从“为什么这份变更分析不成立”出发找反例，再给出 `VERDICT` 与 `M/S/N`。本轮只评审需求变更分析，不实施、不启动 DEV、不 reset/seed、不跑 backend acceptance/browser L2，不修改文件。

用户新需求是：到店点餐不再限定为内部接入；但门店销售菜单逻辑不变，只有内部类型的到店点餐和外卖渠道可以设置销售菜单。请验证分析是否把这两层业务事实正确分开。

重点审查：

1. 是否完整解除旧的 `DINE_IN_MUST_BE_INTERNAL` 耦合，而没有误删 DINE_IN form、provider enablement、provider businessScope、binding、权限、事务或 CAS 校验；
2. 是否发现旧规则同时落在 owner policy、已执行 migration 的 CHECK、前端 Drawer、active contract/error closed set、generated source、unit/acceptance/seed 红夹具；
3. 当前 external catalog 没有 DINE_IN capability 的事实是否被正确处理，是否需要 Dexter 先指定真实 provider；是否错误地把 TAKEAWAY 当作 DINE_IN；
4. 外部 DINE_IN 是否在销售菜单 candidate/direct owner revalidation 中继续 fail closed，且没有新增菜单语义；
5. 核心 business-channel request 是否真的不需要新增字段/operation；capability enum 的条件影响是否写得足够；
6. UI 是否只影响 O2 模板 Drawer，并正确处理 provider candidate、DINE_IN form、空候选和错误恢复；是否违反 foundation 或 testId 规范；
7. 是否保留既有模板、渠道、菜单、publication、库存/人工可售事实，不把规则变更变成历史数据迁移或自动回收；
8. 是否漏掉 project/store operator、external binding、store candidate、错误码退役、migration additive 语义、active 与 historical 文档边界；
9. 是否存在更小的安全替代方案，或本分析中产品决策/能力决策被 Codex 擅自假定的地方。

请使用以下输出结构：

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=CLAUDE_EXTERNAL
BLIND_REVIEW_DECLARATION=...
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=...
L1_ENGINEERING=...
L2_USER_VISIBLE=...
L3_UNVERIFIED=...
SAME_ROOT_SCAN=...
DESIGN_GAPS=...
EVIDENCE_TIER=STATIC_DESIGN_ONLY
```

每条 finding 请包含：`severity`、准确相对路径与 symbol/段落、当前事实、后果、最小修复、`CONFIRMED`/`PARTIALLY_CONFIRMED`/`REJECTED_WITH_EVIDENCE`/`UNVERIFIED_REQUIRES_EVIDENCE`/`DEXTER_DECISION`。不要把历史 review/evidence 的旧结论当作本轮授权或当前事实。

## 需阅读文件

以下清单就是本轮必须从仓库根打开的输入；每项用途已在后面的分组标题中说明：入口/授权与 memory、平台标准与 review 治理、需求变更分析与既有设计、business-channel/collaboration owning source、contract/generated source、operations-admin UI、seed/acceptance。完整相对路径清单见“仓根相对输入清单”。

## 独立核验重点

请重开当前 source，沿以下闭包逐条复验：

1. `BusinessChannelPolicy.validateTemplate` → template create → channel create 的 owner 二次复核；
2. 已执行 migration 的 `ck_business_channel_template_dine_in_form` → additive replacement 需求；
3. catalog capability → provider candidate → provider scope → external binding 的真实 DINE_IN 能力闭包；
4. sales-menu candidate 与 `requireSalesMenuChannel` 的 STORE + INTERNAL + DINE_IN/TAKEAWAY 负向边界；
5. operations-admin O2 Drawer 的可选性、DINE_IN form、provider 查询、空候选和 typed failure；
6. active contract/error/generated/seed 对旧 `DINE_IN_MUST_BE_INTERNAL` 的残留，以及 historical review/evidence 不回写边界。

本轮静态证据只用于设计判断；动态 business、cleanup 和 UI 分母均应标记为 `UNVERIFIED_REQUIRES_EVIDENCE` 或 `NOT_RUN`。

## 期望结论

请给出明确的 `GO`、`GO_WITH_UNVERIFIED_UI` 或 `NO-GO` 与 `M/S/N`。若发现问题，请写准确相对路径、symbol/段落/行号、后果、最小修复，以及是否需要 Dexter 产品/能力决策。`GO` 只代表本需求变更分析可以进入下一轮详设，不代表实施授权、动态验证通过或产品验收。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次“到店点餐允许外部接入”需求变更分析。

背景：原规则要求 DINE_IN 只能是 INTERNAL；Dexter 现在要求 DINE_IN 也可使用 EXTERNAL，同时明确门店销售菜单逻辑不变，只有 STORE owner 的 INTERNAL DINE_IN/TAKEAWAY 渠道可以设置销售菜单。本轮仅做 DESIGN review，未实施、未启动 DEV、未 reset/seed、未跑 backend acceptance/browser L2。

目标：请独立核验是否完整解除 accessKind 与 DINE_IN 的旧耦合，保留 DINE_IN form/provider/binding/权限/事务边界，处理数据库 CHECK 与 capability/provider 闭包，并确认外部 DINE_IN 永远不会进入销售菜单候选或直接资格复核。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-requirements-change-analysis-codex.md：本轮需求变更分析；
- doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md：既有 IA 语义；
- doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md：既有 O2 UI 规则；
- doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md：既有 owner/acceptance 约束；
- doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md：销售菜单资格正本；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java：模板策略；
- apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java：模板/渠道与销售菜单 owner 路径；
- apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_001__business_channel_owner.sql：已执行跨字段 CHECK；
- contracts/collaboration/external-platform-catalog.json 与 contracts/collaboration/external-platform-catalog.schema.json：外部 capability 事实；
- apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CheckedInCollaborationCatalogSource.java：runtime closed set；
- apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java 与 CollaborationBindingPolicy.java：provider/binding 门禁；
- contracts/openapi-source/business-channel.schemas.json、contracts/openapi-source/collaboration.schemas.json、contracts/openapi/paths/operations-admin/business-channel.paths.json：契约 source/operation error；
- apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx：当前 O2 Drawer；
- scripts/dev/external-collaboration-business-channel-seed-plan.mjs：seed 与负向红夹具；
- AGENTS.md、doc/platform/backend-coding-standard.md、doc/platform/frontend-coding-standard.md、doc/platform/foundation-charter.md、doc/platform/review-standard.md、doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md：执行与 review 边界。

请重点独立核验：旧规则是否有同根残留；只删 Java 分支是否仍被 DB/provider/contract/UI 拒绝；是否需要 Dexter 指定真实 DINE_IN provider；是否错误把 TAKEAWAY 当别名；销售菜单 candidate/direct owner revalidation 是否仍只认 STORE+INTERNAL+DINE_IN/TAKEAWAY；既有菜单/渠道事实是否被误改。

请给出 REVIEW_TARGET=DESIGN、VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO、M/S/N，并分开写 L1_ENGINEERING、L2_USER_VISIBLE、L3_UNVERIFIED、SAME_ROOT_SCAN、DESIGN_GAPS、EVIDENCE_TIER。每条 finding 写精确路径/行号、后果、最小修复和是否需要 Dexter 决策。

授权边界：本轮结论只决定需求变更分析是否可进入下一轮详设，不授权生产代码、契约、迁移、测试、seed、reset、DEV、backend acceptance、browser L2、UAT、部署或切流。谢谢。
```

## 仓根相对输入清单（请按当前字节重读）

### 入口、授权、memory 与执行边界

1. `AGENTS.md`
2. `PLATFORM-BLUEPRINT.md`
3. `doc/platform/README.md`
4. `doc/platform/roadmap-program-registry.json`
5. `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` 中当前授权字段
6. `project-memory/index.md` 及全部 kernel
7. 本轮六维 recall：`scripts/context/recall-memory --task-kind design --domain platform --consumer-face operations-admin --owner product --impact governance --trigger task-start`
8. `scripts/README.md`
9. `CLAUDE.md`
10. `doc/platform/backend-coding-standard.md`
11. `doc/platform/frontend-coding-standard.md`
12. `doc/platform/foundation-charter.md`
13. `doc/platform/review-standard.md`
14. `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`
15. `project-memory/operations/dev-command-separation.md`
16. `project-memory/decisions/deterministic-context-only.md`
17. `project-memory/decisions/confirmed-business-language-corpus.md`
18. `project-memory/operations/backend-acceptance.md`
19. `project-memory/operations/business-corpus-adoption-and-read-policy.md`

### 本次分析和既有设计材料

20. `doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-requirements-change-analysis-codex.md`
21. `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md`
22. `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md`
23. `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md`
24. `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`
25. `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`

### 当前 owning source 与 contract/capability/seed

26. `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java`
27. `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java`
28. `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelOwnerApi.java`
29. `apps/backend/catering-business-server/modules/business-channel/src/test/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicyTest.java`
30. `apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_001__business_channel_owner.sql`
31. `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CheckedInCollaborationCatalogSource.java`
32. `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java`
33. `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationBindingPolicy.java`
34. `contracts/collaboration/external-platform-catalog.json`
35. `contracts/collaboration/external-platform-catalog.schema.json`
36. `contracts/openapi-source/business-channel.schemas.json`
37. `contracts/openapi-source/collaboration.schemas.json`
38. `contracts/openapi/components/collaboration/collaboration.schemas.json`
39. `contracts/openapi/paths/operations-admin/business-channel.paths.json`
40. `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx`
41. `apps/frontend/operations-admin/src/app/api/operationsProblemFeedback.ts`
42. `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts`
43. `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`

## Review 边界

- 这是新的需求变更分析 review cycle；不要复用销售菜单或经营渠道模板门店可见范围的旧 verdict。
- `IMPLEMENTATION_AUTHORITY=false` 是本分析的边界；Roadmap 的其他授权不能替代本轮用户明确的“只做分析、交 review”。
- 不要创建 implementation、contract、migration、test、seed 或 runtime 文件。
- 不要读取或执行退役的 hash-chain、compliance-control、package entry/exit、lane/旧 scenario registry 作为本轮准入依据。
- 以当前仓库字节和原始需求为准；若发现 product/Journey/provider 决策缺失，标记 `DEXTER_DECISION`，不要替 Dexter 选择 provider 或扩展菜单语义。

# 独立 DESIGN 盲审输入清单：经营渠道“到店点餐允许外部接入”需求变更

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ACTION_1_VARIANT=1-B_DOCUMENT_EXTRACTION
BLIND_REVIEW=true
IMPLEMENTATION_AUTHORITY=false
RUNTIME_EXECUTION=NOT_RUN
HASH_LEDGER=RETIRED_NOT_USED
```

## 1. 给独立 reviewer 的任务

你是本轮 fresh、独立、只读的 DESIGN reviewer。请先用证伪立场审阅需求变更分析：尝试找出它为什么不成立、哪些业务事实会被误放宽、哪些现有路径会继续拒绝、哪些 provider/契约/数据库/UI 影响被漏掉。形成自己的 findings/verdict 后，才可对照作者文档中的推荐处理；不得把作者的结论当作事实。

本轮只分析以下需求变更：

> 到店点餐可以是外部接入类型；门店销售菜单逻辑不变，只有内部类型的到店点餐和外卖渠道可以设置菜单。

不得实施、写文件、改测试、执行 migration、启动 DEV、reset、seed、backend acceptance、browser L2 或 UAT。只能读取当前仓库字节并报告。若输入材料与当前 source 不一致，以当前 source 为准并标记差异。

## 2. 必须回答的证伪问题

### 2.1 业务语义

- 是否将“外部 DINE_IN 经营渠道可用”与“销售菜单仍只认 INTERNAL STORE DINE_IN/TAKEAWAY”拆成两个独立判据？
- 是否错误扩大到外部 TAKEAWAY 进入菜单、项目级菜单、已有渠道转换、菜单 schema/target/availability/publication 变化？
- 新规则是否确实应同时适用于 PROJECT 和 STORE；如果这是缺失的产品裁决，是否明确标记而非擅自决定？

### 2.2 owner、policy、数据库与事务

- `BusinessChannelPolicy.validateTemplate`、模板 create、渠道 create 的重复/二次 provider 校验是否都被覆盖？
- 已执行 migration 中的跨字段 CHECK 是否会让“只删 Java 分支”的方案假绿；是否说明 additive replacement 而非编辑旧 migration？
- DINE_IN form、provider required/enabled/scope、workspace/project/target、binding、CAS、事务、audit、readback 等既有边界是否被错误删除或遗漏？
- 外部 DINE_IN 失败时，是否能证明无模板/渠道/binding 部分写入？

### 2.3 capability 与契约

- 当前 external catalog 是否确实没有 DINE_IN，runtime closed set、schema、OpenAPI candidate/binding/provider enum 是否一致？
- 是否需要 Dexter 指定真实 provider；是否错误把 TAKEAWAY 当成 DINE_IN 或让 external DINE_IN 无 provider？
- 是否清楚区分核心 business-channel request “无新增字段/operation”与 collaboration capability enum “条件性新增”？
- `DINE_IN_MUST_BE_INTERNAL` 在 active error contract/generated/feedback/seed 红夹具中的清理是否完整，同时没有篡改历史 review/evidence？

### 2.4 UI/UX 与 foundation/L2

- O2 Drawer 是否是唯一需要改变的 surface；EXTERNAL+DINE_IN 是否能选择 form、按 DINE_IN 查询 provider、处理无候选与失败恢复？
- 是否保留现有 foundation 对 Drawer/form/query/error 的使用，避免 app 内重复实现？
- 如果后续 implementation-facing 详设需要 UI controls，是否会为真实动作节点建立唯一 `*TestIds.ts`，而不是用 label/CSS/XPath/wait？
- 是否明确本轮无动态 L2/DEV 证据，不能以静态分析替代？

### 2.5 同根扫描与替代方案

- 是否扫描了 policy、DB、contract source/generated、capability catalog/runtime、frontend、tests、seed、sales-menu owner 的同根影响，而非点修一处？
- 是否存在更小、更安全且不改变产品语义的替代方案？
- 是否存在分析文档未覆盖的 active source 或用户可见冲突？

## 3. 必须读取的输入

### 3.1 入口与 memory

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/README.md`
- `doc/platform/roadmap-program-registry.json`
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`（授权字段）
- `project-memory/index.md` 全部 kernel：`project-memory/kernel/01-workspace-and-roadmap.md` 至 `06-heritage-and-change.md`
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/decisions/confirmed-business-language-corpus.md`
- `project-memory/decisions/independent-subagent-adversarial-review.md`
- `project-memory/operations/backend-acceptance.md`
- `project-memory/operations/business-corpus-adoption-and-read-policy.md`
- 本轮 recall 命中原文与命令输出（若无单独产物，则按仓内当前记录和命令重开，不推测）
- `scripts/README.md`
- `CLAUDE.md`

### 3.2 standards 与治理

- `doc/platform/backend-coding-standard.md`
- `doc/platform/frontend-coding-standard.md`
- `doc/platform/foundation-charter.md`
- `doc/platform/review-standard.md`
- `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`
- `project-memory/operations/dev-command-separation.md`

### 3.3 分析与既有设计

- `doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-requirements-change-analysis-codex.md`
- `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md`
- `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md`
- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`

### 3.4 owning source

- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelOwnerApi.java`
- `apps/backend/catering-business-server/modules/business-channel/src/test/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicyTest.java`
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_001__business_channel_owner.sql`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CheckedInCollaborationCatalogSource.java`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java`
- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationBindingPolicy.java`
- `contracts/collaboration/external-platform-catalog.json`
- `contracts/collaboration/external-platform-catalog.schema.json`
- `contracts/openapi-source/business-channel.schemas.json`
- `contracts/openapi-source/collaboration.schemas.json`
- `contracts/openapi/components/collaboration/collaboration.schemas.json`
- `contracts/openapi/paths/operations-admin/business-channel.paths.json`
- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx`
- `apps/frontend/operations-admin/src/app/api/operationsProblemFeedback.ts`
- `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts`
- `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`

## 4. 证据与输出规范

必须输出以下字段：

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
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

每条 finding 都要写：

- severity（M/S/N）；
- `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`；
- 准确相对路径和 symbol/段落/行号；
- 当前字节事实；
- 对业务、契约、用户或验收证据的后果；
- 最小修复或需要 Dexter 裁决的明确问题。

不得把静态文档当作 backend/L2/seed business PASS。动态证据本轮统一为 `NOT_RUN`。不得创建 SHA-256 输入台账；`HASH_LEDGER=RETIRED_NOT_USED`。

## 5. 盲审结束条件

只有在全部输入读完、完成同根扫描、列出未验证分母并形成证伪式 verdict 后，才算本轮完成。不要调用第三轮 reviewer；若本轮发现可由文档修复的设计 finding，主 agent 会重开 owning source 后决定是否进行 round 2 定向复核。产品/Journey/provider 选择仍由 Dexter 决定。

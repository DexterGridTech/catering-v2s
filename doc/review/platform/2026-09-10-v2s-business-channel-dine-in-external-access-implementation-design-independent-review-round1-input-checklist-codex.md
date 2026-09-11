# Independent subagent adversarial review input checklist

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-IMPLEMENTATION-DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_SCOPE=implementation-facing design and serial implementation plan for external STORE DINE_IN
IMPLEMENTATION_AUTHORITY=false
RUNTIME_EXECUTION=NOT_RUN
BLIND_REVIEW_REQUIRED=true
```

本清单是本次“需求变更分析 → implementation-facing 详设/计划”的新 review cycle 输入。此前 `BC-20260910-DINE-IN-EXTERNAL-DESIGN` 的两轮属于上游分析 review，不能充当本轮设计 review。

当前治理已退役 hash-chain/input-ledger 和 implementation-design-granularity 控制。本清单不建立 SHA-256 输入台账；reviewer 必须按路径重新读取当前仓库字节，并把任何缺少当前字节核验的说法当作 finding。

| Required input | Repository-relative path / command | Byte/evidence handling | Read / result |
| --- | --- | --- | --- |
| AGENTS | `AGENTS.md` | 当前字节重读；不使用 hash ledger | READ |
| Blueprint | `PLATFORM-BLUEPRINT.md` | 当前字节重读 | READ |
| Claude entry | `CLAUDE.md` | 当前字节重读 | READ |
| selected Roadmap/authorization | `doc/platform/roadmap-program-registry.json`；`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`；相关 `R3/R5_*AUTHORIZED` 字段 | 只核授权，不从 Roadmap 推断当前步骤 | READ |
| all kernel | `project-memory/kernel/01-workspace-and-roadmap.md` through `06-heritage-and-change.md` | 六个文件全部当前字节重读 | READ_ALL |
| six-dimensional recall | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face operations-admin --owner product --impact governance --trigger task-start` | reviewer 重新运行并读取全部命中原文 | RUN/READ_ALL |
| routed memory | `project-memory/decisions/deterministic-context-only.md`；`project-memory/decisions/confirmed-business-language-corpus.md`；`project-memory/decisions/independent-subagent-adversarial-review.md`；`project-memory/operations/backend-acceptance.md`；`project-memory/operations/business-corpus-adoption-and-read-policy.md`；`project-memory/operations/business-corpus-parked-domain-intake.md`；`project-memory/pitfalls/analysis-ruler-and-scope-discipline.md`；`project-memory/pitfalls/check-repo-before-authoring.md`；`project-memory/pitfalls/criterion-degraded-into-list.md` | 每个命中路径当前字节重读 | READ_ALL |
| platform standards | `doc/platform/backend-coding-standard.md`；`doc/platform/frontend-coding-standard.md`；`doc/platform/foundation-charter.md`；`doc/platform/review-standard.md` | 当前字节重读，按设计判断标准使用 | READ_ALL |
| acceptance standard | `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` | 当前字节重读；核 fixture/request/oracle 和 full-suite 约束 | READ |
| upstream requirement analysis | `doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-requirements-change-analysis-codex.md` | 读取历史 provisional 部分，并核查 superseding section | READ_WITH_SUPERSESSION |
| current Journey amendment | `doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-journey-amendment.md` | 全文重读；以 D-01/D-02/D-04 为 current product input | READ_FULL |
| current UI interaction | `doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ui-interaction-design-codex.md` | 全文重读；核文案、控件、真实动作节点、状态和 O5 分区 | READ_FULL |
| current IA | `doc/decisions/2026-09-10-v2s-business-channel-dine-in-external-access-ia-amendment-codex.md` | 全文重读；核九维度、collection shape、forbidden UI、error map | READ_FULL |
| current implementation design | `doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-design-codex.md` | 全文重读；从 design 先推导 expected set，再看 author claims | READ_FULL_AND_DERIVE_EXPECTED_SET |
| current implementation plan | `doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-implementation-plan-codex.md` | 全文重读；核 CP 顺序、前后双读、review/authorization boundaries | READ_FULL |
| existing Journey/IA/UI | `doc/decisions/2026-08-19-v2s-business-channel-management-journey.md`；`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md`；`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md` | 当前既有语义重读，核 amendment 是否越界 | READ_ALL |
| existing implementation design/plan | `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md`；`doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md` | 当前可复用机制和 owner boundary 重读 | READ_ALL |
| business-channel owner | `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java`；`BusinessChannelOwnerService.java`；`BusinessChannelCommandApi.java` | 按符号重开 policy/create/channel revalidation/pageChannels/sales-menu methods | READ_SYMBOLS |
| collaboration owner | `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CheckedInCollaborationCatalogSource.java`；`CollaborationOwnerService.java`；`CollaborationBindingPolicy.java`；`CollaborationReadback.java` | 按 capability/provider/binding symbols 重开 | READ_SYMBOLS |
| edge | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java`；`BusinessChannelWireMapper.java` | 核 usage branch、session/store scope、owner invocation | READ_SYMBOLS |
| migration | `apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_001__business_channel_owner.sql`；当前 migration directory | 核旧 CHECK、Flyway head 和 additive-only plan | READ |
| collaboration catalog | `contracts/collaboration/external-platform-catalog.json`；`contracts/collaboration/external-platform-catalog.schema.json` | 核现有 provider 事实，不能采信伪 provider | READ |
| contract source/generation | `contracts/openapi-source/business-channel.schemas.json`；`contracts/openapi-source/collaboration.schemas.json`；`contracts/openapi/paths/operations-admin/business-channel.paths.json`；`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`；`doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`；`scripts/generate/r5-edge-materialize.mjs`；`scripts/generate/edge-codegen.mjs` | 源 catalog → materialize/codegen 关系当前字节核验 | READ_ALL |
| frontend owner | `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx`；`BusinessChannelTemplateDetailDrawer.tsx`；`BusinessChannelList.tsx`；`StoreBusinessChannelPage.tsx`；`application/queries.ts`；`model/collaborationCodeLabels.ts`；`app/automation/businessChannelTemplateTestIds.ts` | 核 undefined capability、O5 usage、真实动作节点和 foundation reuse | READ_ALL |
| foundation | `libraries/frontend/admin-ui-foundation/`，重点 `src/index.ts` 及实际 export consumer | 核 Drawer/lifecycle/overlay/generation/cursor/refresh/testId 是否可复用 | READ_RELEVANT_EXPORTS |
| acceptance owners | `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java`；`BusinessChannelAcceptanceScenarios.java`；`SalesMenuAcceptanceScenarios.java` | 核现有 domain group、route identity、scenario oracle 形状 | READ_ALL |
| seed owner | `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`；`scripts/dev/external-collaboration-business-channel-seed-executor.mjs` | 核旧 DINE_IN assertions 和受管入口 | READ_ALL |
| runtime topology | `scripts/README.md`；`doc/platform/browser-l2-execution-standard.md`；`project-memory/operations/dev-command-separation.md` | 只核规则；当前不启动 runtime | READ |
| review governance | `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | 核 fresh、blind、round limit、verdict shape | READ |

## Reviewer must derive before author material

先从 Journey/UI/IA/详设推导以下 expected set，再阅读任何作者自评或本文件之后产生的 finding disposition：

1. `STORE + EXTERNAL + DINE_IN` 必须允许，`dineInForm=null`，不得出现 POS/QR/KIOSK；
2. `PROJECT + EXTERNAL + DINE_IN` 必须 typed reject，且无部分写入；
3. provider source、system capability、provider `businessScope`、candidate query、binding capability 必须都使用 `DINE_IN` 精确能力；
4. O5 的 `BUSINESS_CHANNEL` read 必须包含所有 store channel，`SALES_MENU` read 必须只包含 `STORE + INTERNAL + DINE_IN/TAKEAWAY`；
5. old `DINE_IN_MUST_BE_INTERNAL` 的 active semantics 必须退役，新 project-specific problem 必须沿 source catalog→generated chain 闭合；
6. UI provider empty/failed/loading/retry、stale-field cleanup、真实 testId roster、foundation reuse 和不可见/禁用条件必须与 IA 逐字一致；
7. migration 必须 additive，不改写已执行 migration，不做数据回填；
8. 当前阶段任何动态 evidence 都必须标 `UNVERIFIED_REQUIRES_EVIDENCE`，不能从静态设计推导 acceptance/L2/seed PASS。

## Blind-review declaration

`I received this checklist in a fresh subagent context, tried to falsify the reviewed design, and wrote my findings and verdict before reading the author self-review or author finding disposition.`

`I treated every missing or substituted pointwise source read as a finding; a general preparation pass, static result, or future L2 did not substitute for current source review. I independently checked the product decision boundary, owner/contract/migration closure, UI-visible semantics, collection shapes, forbidden UI, evidence tier, and authorization boundary. I did not write files or run reset, seed, DEV, backend acceptance, browser L2, UAT, deployment, or cutover.`

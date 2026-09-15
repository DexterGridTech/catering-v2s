---
title: 扩展字段列表展示与类型化搜索 P6/P7 fresh reviewer input checklist
reviewTarget: IMPLEMENTATION
reviewerKind: INDEPENDENT_SUBAGENT_REQUIRED
createdAt: 2026-09-15
---

# Fresh reviewer input checklist

这是交给 fresh 独立只读 reviewer 的最小输入清单。hash 只用于绑定送审时的当前字节；reviewer 必须从仓根重新读取每个文件，先独立形成 findings/verdict，再读取作者对账材料。`reviewerRead` 由 reviewer 在其 own artifact 中确认，本文不代填。

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_IMPLEMENTATION_20260915
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=先独立读取当前 source/design 并列 findings，再对照作者 reconciliation
authorMaterialReadAfterIndependentVerdict=true
```

## A. mandatory repository entry and authorization

| path | sha256 | reviewerRead |
| --- | --- | --- |
| `AGENTS.md` | `51158ce0bba78dce53788ef060e77b3c0c768f4fab7ded6e45144d966d3e7739` | REQUIRED_NOT_YET |
| `CLAUDE.md` | `f08b1fc18e5c1ebbb70056a97a8433c7cf7ad229a5987bafcb0b1e3a367a797a` | REQUIRED_NOT_YET |
| `PLATFORM-BLUEPRINT.md` | `19ad18338bb6e4b5a443d205db06e80113993dda295a10c2bb10715764dfe396` | REQUIRED_NOT_YET |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | REQUIRED_NOT_YET |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | REQUIRED_NOT_YET |
| `project-memory/index.md` | `2e73aabb4afc18d5f74eb7c9d58ea799303855d09c0a999295e319c362e0d029` | REQUIRED_NOT_YET |
| `scripts/README.md` | `06d083d7d01d6a14fe75493905da956c20c7e7037ab0fc314e0961bd187dd1c8` | REQUIRED_NOT_YET |

## B. all kernel and routed memory inputs

| path | sha256 | reviewerRead |
| --- | --- | --- |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` | REQUIRED_NOT_YET |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | REQUIRED_NOT_YET |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | REQUIRED_NOT_YET |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `3de3d8aed7c4ad52ecfec89f0a2914e02682bba15220b407197e37ba08ddb026` | REQUIRED_NOT_YET |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` | REQUIRED_NOT_YET |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | REQUIRED_NOT_YET |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `52cc53b9ab5182974fdfcf1d3bcb980e4f8e3069e56558497692880e5dc4b67e` | REQUIRED_NOT_YET |
| `project-memory/decisions/deterministic-context-only.md` | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` | REQUIRED_NOT_YET |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `37b50a3ede16737f6e3082cb86af155438b286bbf936cc99e243ada0b60fde7d` | REQUIRED_NOT_YET |
| `project-memory/decisions/owner-read-model-and-lifecycle-standard.md` | `7f303041fc1799f7491abb9ada3c4bbb5ae5c5cb9da77b93ca08c6e7c3cb60e9` | REQUIRED_NOT_YET |
| `project-memory/operations/implementation-source-reread-discipline.md` | `6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce` | REQUIRED_NOT_YET |
| `project-memory/operations/verification-governance.md` | `3094cf61cea315208323f7d3f9266f719ea6ca9d828094378ede375dfe9f3005` | REQUIRED_NOT_YET |
| `project-memory/operations/backend-acceptance.md` | `778522cb3375c776888ce0bd519ce022693c9b9d41b505e38794546b1bc52910` | REQUIRED_NOT_YET |
| `project-memory/operations/backend-coding-standard.md` | `e3bc36b2da8a5dbeb472b396e4696cc8519eec2404be5a1ff3320c17d2a21aba` | REQUIRED_NOT_YET |
| `project-memory/operations/frontend-coding-standard.md` | `fdeac90ed27cc83881fec7b3021ed621c58ad1fdcd941000e1e21c0e8c3c00a2` | REQUIRED_NOT_YET |
| `project-memory/operations/dev-command-separation.md` | `3d068011a6f34398cb41b61a6b09ea3f38fd593a072cd659abb766b20251f21b` | REQUIRED_NOT_YET |
| `project-memory/operations/test-closed-loop.md` | `0459c5bd0d0e69366e3d8234fe16033f086ee137cccba7862adefb3fcfc65dc7` | REQUIRED_NOT_YET |
| `project-memory/operations/execution-economics-and-failure-family-closure.md` | `033f43201d185e8bac32e424097f475bd54252346dadbd3c2400dea96984b7e0` | REQUIRED_NOT_YET |
| `project-memory/operations/ui-testid-preflight-before-l2.md` | `79abdd990908b6f2599a940b5f2d321bf39de19ea72c967b77df5f4913eaea9f` | REQUIRED_NOT_YET |
| `project-memory/practices/collection-boundary-modes.md` | `7e1b7c4bd9b568aaeac810a8e4b5ee2b03e89348ede83383d5d2e69f7d79b0b1` | REQUIRED_NOT_YET |
| `project-memory/practices/reuse-projection-within-request.md` | `4dd39471a88b96da7702b96be0e809e019063e23540d15be93955670f839f2a5` | REQUIRED_NOT_YET |
| `project-memory/practices/cache-invalidation-granularity.md` | `222f5270a90c16f284457ea35b0a342b369e2c46561c707a225fd5cfbffbf4fc` | REQUIRED_NOT_YET |
| `project-memory/practices/drawer-form-lifecycle.md` | `89bcc2f0efe38994f47bcb92a608a657ecbcb24d5780c393e23db8dc8486e167` | REQUIRED_NOT_YET |
| `project-memory/practices/frontend-capability-lookup.md` | `8ac0fc474432f207b7fdf469656a8d3470570c6ba3bc4cbe938a912dfdadf77b` | REQUIRED_NOT_YET |
| `project-memory/practices/read-model-granularity.md` | `5594f03106a7253def704038768e55244bc11930e7be43184f26a3d49ab60561` | REQUIRED_NOT_YET |
| `project-memory/pitfalls/owner-boundary-reverse-inference.md` | `b782f694c3b9599195557e19a300d79676f42d202377abb16e5d10ed33bf2f00` | REQUIRED_NOT_YET |
| `project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md` | `5ef2cf95a8116003b4f80d71c13568122abbb86421c766bed9f78b2725e6d3b9` | REQUIRED_NOT_YET |

`owner-read-model-and-lifecycle-standard.md` 的正确位置在 `project-memory/decisions/`，已按当前仓库绑定 hash；reviewer 仍须重新计算并报告漂移。

## C. batch design and implementation plan

| path | sha256 | reviewerRead |
| --- | --- | --- |
| `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md` | `5c3b7c30dac89d1f82fafee138f9d453f4460a9b4fa8888c0349a382aa188446` | REQUIRED_NOT_YET |
| `doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md` | `97893b635bee408a55f1015a02f7f958e73a4302739e1aa77fbe67e8a9285334` | REQUIRED_NOT_YET |
| `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md` | `ffeff522992595d69875d4522e4d6336b7aae6295d0a9a4d45f43ff103047fee` | REQUIRED_NOT_YET |
| `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md` | `be3e81db68dea336c4f2e93d0cc2b0f574c9d2e6f55ee119f97d55a32b6effb5` | REQUIRED_NOT_YET |
| `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md` | `81d3d7702c984c6731fbe151dba01edcc11be783fb944534ad235cd2bf013a9e` | REQUIRED_NOT_YET |
| `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md` | `079f1d500b1ddb2c78d6bdd2966acae1a36d031eff11dadcc504ffd6d5631a2b` | REQUIRED_NOT_YET |
| `doc/platform/review-standard.md` | `6e12ca56b08bb8bd6f47506635986b02ea1de0b1d6753a1db09c5757792766e6` | REQUIRED_NOT_YET |
| `doc/platform/backend-coding-standard.md` | `b93417938494281c2ffb8391b3892451aa147efdebe7b129181afb12af01bba3` | REQUIRED_NOT_YET |
| `doc/platform/frontend-coding-standard.md` | `d3e00708093fccd97435922388e27efb01c493933037f51a08b5f9c9db3213f1` | REQUIRED_NOT_YET |
| `doc/platform/foundation-charter.md` | `f54b882baf4fa85f91d4c75e15aff4d4574e9c9374c276113484ed013ab24455` | REQUIRED_NOT_YET |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `521cef2f7e57f16705dab326fe2c5688c33c81add0468470d0ab94dd7f529130` | REQUIRED_NOT_YET |

## D. current implementation sources to reopen

These are source targets, not author claims. The reviewer must inspect every member of each same-root set and record the remaining count checked:

```text
contracts/openapi/components/extension/extension.schemas.json
doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json
scripts/generate/r5-edge-materialize.mjs
scripts/generate/edge-codegen.mjs
apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionDefinitionReadback.java
apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java
apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionFilterQuery.java
apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityTaskReadService.java
apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OperationsOrganizationTaskReadService.java
apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationOverviewTaskReadService.java
apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractTaskReadService.java
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsBusinessEntityController.java
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementController.java
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/contract/OperationsContractController.java
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/contract/PlatformContractOverviewController.java
apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/ExtensionAcceptanceScenarios.java
apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/OrganizationAcceptanceScenarios.java
apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CommercialContractAcceptanceScenarios.java
apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/ExtensionScaleProof.java
libraries/frontend/admin-ui-foundation/src/extension/typedExtension.ts
libraries/frontend/admin-ui-foundation/src/extension/staleRecovery.ts
apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx
apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx
apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx
apps/frontend/operations-admin/src/features/extension-fields/model/extensionList.tsx
apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx
apps/frontend/platform-admin/src/features/organization-contract-overview/ui/extensionList.tsx
apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx
apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionEditDrawer.tsx
apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionSaveModal.tsx
scripts/dev/owner-command-seed-executor.mjs
scripts/dev/r5-seed-plan.mjs
scripts/test/backend-acceptance
scripts/test/r5-remote-testcontainers.mjs
scripts/test/test-health-entry-runner.mjs
```

## E. corpus and review method requirements

Reviewer must search the confirmed business corpus for: `扩展字段`、`列表展示`、`可搜索`、`经营租户`、`品牌`、`总公司`、`门店`、`合同`、`组织架构树`。若没有 direct corpus match, record `NO_CORPUS_ENTRY_MATCHED` and the search terms; do not infer business meaning from screenshots or old handoffs.

Reviewer must read the `doc/decisions/` title inventory, then open all decisions relevant to this batch, including the independent-review governance and deterministic-context decision. Reviewer must not run reset, seed, DEV, browser L2, UAT, deployment, or any write command.

Required independent output:

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=<数量>
L1_ENGINEERING=<...>
L2_USER_VISIBLE=<...>
L3_UNVERIFIED=<...>
SAME_ROOT_SCAN=<...>
DESIGN_GAPS=<...>
EVIDENCE_TIER=<...>
P6_STEP_RECONCILIATION=<MATCHED | OPEN per P1-P5>
P7_WHOLE_BATCH_RECONCILIATION=<MATCHED | OPEN>
```

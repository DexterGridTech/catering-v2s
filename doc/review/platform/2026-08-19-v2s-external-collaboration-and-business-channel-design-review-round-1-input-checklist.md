REVIEW_CYCLE_ID=EXTERNAL_COLLABORATION_DESIGN_2026_08_19
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=REQUIRED
authorVerdictBeforeReviewer=FORBIDDEN

# 独立设计盲审 Round 1 输入清单

本清单是 fresh 独立子 agent 的最小完整输入。reviewer 必须先按 `AGENTS.md` 和项目入口恢复上下文，再独立推导 findings/verdict；不得先读取作者的 self-review、disposition 或 Claude brief（本清单不包含这些产物）。reviewer 不能修改生产代码、契约、生成物、迁移、seed 或 runtime。

## A. 仓库入口与授权

| path | sha256 | role |
| --- | --- | --- |
| `AGENTS.md` | `586dedb45f1d657770aa9e0579157e96597dafcad88647e168ce7a1b5935dc54` | 执行边界、R5 授权、结束闸门 |
| `CLAUDE.md` | `ef611507ceadff37484cb51692413fb61af364170a60f2c3df061b263fb6e2e4` | Claude review 与仓内交接约束 |
| `PLATFORM-BLUEPRINT.md` | `e9956c2ee23f905bcdf70b8ad0874abfdd6a497b3fc9d01ea9ad7ca896c13b74` | owner、consumer face、事务、环境红线 |
| `doc/platform/README.md` | `d358e49c83726528690a9d05aa9f6a1979a0f9d2051fd56ef9db4ff98b573c7f` | platform 文档入口 |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | programId 与 Roadmap 选择 |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | R5 authorization-only 当前字段；历史 §7 不得当活状态 |
| `scripts/README.md` | `2e82318aa0b2593228f040141bf7e217ceddfae58d9ace38b7d311f284785986` | 受管脚本与动态边界 |
| `project-memory/index.md` | `b5638996d64a3a31bc6c7cfd164faadbeb0302d082aafc645affb41db665c9fe` | memory kernel 导航，不作为单独规则替代原文 |

## B. Project-memory kernels 与路由命中原文

| path | sha256 | role |
| --- | --- | --- |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` | workspace/roadmap 入口 |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | deployable 与 owner |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | schema/transaction/cross-owner |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` | contract、consumer face、双后台 |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` | evidence/runtime/Git 边界 |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | heritage 只读与变更 |
| `project-memory/decisions/deterministic-context-only.md` | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` | deterministic context |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `3dba1c80579d4a0eca281efd59d27fbfb20aa86572648f8e36c83a68a603b4f3` | 业务术语与已确认语义 |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `9d2903a17c1d71738f530fe00f0abdedf99b2d5370ce6219e63ce1fc082381f1` | blind review / two-round limit |
| `project-memory/operations/backend-acceptance.md` | `b5bca0ee74b93b3ac72b326512c07dd71c934430ee28b095ed8024c69d63d215` | acceptance evidence boundary |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9` | corpus adoption/read policy |
| `project-memory/operations/business-corpus-parked-domain-intake.md` | `739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e` | parked domain intake |
| `project-memory/operations/claude-review-handoff-standard.md` | `35ee335e19c74ac3bdcd1e93281d60e2f36c5a4a9bf23ccf0759a43f9ab1137f` | Claude brief format |
| `project-memory/operations/implementation-source-reread-discipline.md` | `6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce` | per-change source reread |
| `project-memory/practices/collection-boundary-modes.md` | `7e1b7c4bd9b568aaeac810a8e4b5ee2b03e89348ede83383d5d2e69f7d79b0b1` | Bounded/Detail/Page choice |
| `project-memory/practices/backend-capability-lookup.md` | `5c5eeb1bf24a3605135d586e58c74f23411cc676c82b8193e6044b389e69c235` | backend capability lookup |
| `project-memory/practices/frontend-capability-lookup.md` | `8ac0fc474432f207b7fdf469656a8d3470570c6ba3bc4cbe938a912dfdadf77b` | foundation/source lookup |
| `project-memory/practices/decided-undecided-marking.md` | `2121c517272892fe65d1784e2561db2b0aae768da2739c4a44b18041139c6405` | `[已定]/[未定]` discipline |

## C. Applicable decisions and active standards

| path | sha256 | role |
| --- | --- | --- |
| `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md` | `ebc8cc3affe6446979359194a64a50df9a693dc32cef0e97687caaee31ecd568` | single deployable, edge policy, consumer faces |
| `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md` | `b30cc0d28d4d79034f10914a50c85f6bac9cc394f092dccbfdac21a62e1163e7` | smaller alternative / proportionate design |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5` | static/dynamic evidence boundary |
| `doc/decisions/2026-07-25-v2s-frontend-foundation-consumption-rule.md` | `2fe7ac4c8ba25518941d0bfbecde3d5539c4d2b9f011012db770d1edf0787b27` | shared foundation mandatory reuse |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` | reviewer protocol |
| `doc/decisions/2026-08-13-v2s-backend-acceptance-standard.md` | `fd6c059d479215951c221b886d610874226ef8c0fa4a7af3ae41036c73d3edcb` | backend acceptance owner/HTTP boundary |
| `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` | `cc2373d1d3dc3d329e549acf22048a6e063832878787ee953f2bd4bd85b6a9c9` | scenario fields and placement |
| `doc/decisions/2026-08-12-v2s-complete-dev-seed-composition.md` | `bd3e29f9ddac79b130a632b1b3acd72ac8fa49eccf1c2ec736c0cc6bb7e7ee70` | seed order and no implicit seed |

## D. Original specification and current design batch

| path | sha256 | role |
| --- | --- | --- |
| `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md` | `a9a7c7e719636742ecc94d5476a59a64ac67342c6d9655e394f5dccc8248525c` | BR/OP/typed problems/C/U source |
| `doc/review/platform/2026-08-18-v2s-external-platform-capability-and-binding-decoupling-source-claude.md` | `499eed365ffe591dc390746e09a52c13ebe2a35776d86e4825815b8467983ca7` | Dexter source records 001–012 |
| `doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md` | `ada1e6c6d434452f0aefacd38f0bbb7b323e54445893fa7a613da2fe091e5bd2` | platform Journey，待 Dexter 连同线框确认 |
| `doc/decisions/2026-08-19-v2s-business-channel-management-journey.md` | `3d50b97f70b81167c0ea908c0ae75d5200589b28be31c645f24a5de6b3a7684c` | operations Journey，待 Dexter 连同线框确认 |
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md` | `0407378bdc362e9085f9778bba5372f2273af6c2d6e469fb59b2ff0e47f80608` | eleven screens, wireframes, visual review status |
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md` | `d05420deaefb684583647ed3445aa4a9009ba14d9ac7236ba9808e98645c9aab` | IA-P1..P6 / IA-O1..O5, nine dimensions |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md` | `aeb75e787e7a8af2535c0aac25739fa51302f2e4cc351479bfce62ad64555ec4` | owner/contract/API/UI/acceptance/seed design |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md` | `765420c905d5ba300a83a033bb9966402dc11ff4f3b22f3512989782053f0ecf` | CP-00..CP-09 serial implementation plan |

## E. Current source and reuse proof surfaces

| path | sha256 | role |
| --- | --- | --- |
| `contracts/openapi/edge.openapi.json` | `33be5da51f7d72af146634568efec98a40611fb81e1893c2ef58583fdd12cead` | current edge contract source |
| `contracts/registry/operation-handler-bindings.json` | `5fd602713c9648c7415a948789c2fcbc9175d080127389a8f0d3e151ca835c45` | operation/handler binding source |
| `scripts/generate/edge-codegen.mjs` | `a4de5e2f086bf6b94e9213daa9f1206c73a78ffb42fdf79f3a42bb3497cf42c7` | generated contract byte flow |
| `scripts/generate/operation-handler-bindings.mjs` | `29228e3462df54e755f290740cbd8fa178810d24b68129209ef35555de8540c5` | registry generation |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java` | `29c1284adc4f94db2c6e5a01bf16599bdca814b72fe3038a751db714974fa19d` | current scenario catalog and 44 count |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java` | `34ce04be5ae3f71991cd76103ac6631623d3c478c3e7e3c61be5448c1840e8b8` | current acceptance runner limit/proof |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java` | `d82f7347dcd5d42b932b6aec45a63685f1cd0c2c18de144463ea684d6989927f` | catalog owner scenarios |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CommercialContractAcceptanceScenarios.java` | `d770daf03dc23fc8e3b6b840a24df7e20abf466cefce1530422ab1cb509ec7bd` | commercial owner scenarios |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/OrganizationAcceptanceScenarios.java` | `e02f93c8b46b5d37576cddfb120e936947223b516d35d18ab12b4d747ad874e6` | organization owner scenarios |
| `libraries/frontend/admin-ui-foundation/src/index.ts` | `0bd88bfeac9cd0665732ebf7fef8b51492206f446e218b9fe5970a92c26901c6` | exact foundation exports |
| `apps/frontend/platform-admin/src/app/queries/usePlatformOrganizationCandidates.ts` | `37fe5b75695c6fc101983705779b27729ce8a558c58077f079e551057c6f7d3e` | platform cursor candidate reuse |
| `apps/frontend/operations-admin/src/app/queries/useOrganizationCandidates.ts` | `e3a104be6b3a32e0f7c520ba4f417a08f20ee29548613f3efb1b3cab54ab0ccb` | operations cursor candidate reuse |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OperationsOwnerScopeGrant.java` | `d6a9be8e21595a954e8adb116d893940a741cc87b97f23d01bedafd78aa9556e` | current operations scope grant |
| `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceCapabilityRequirementCatalog.java` | `42b50be4a780ed0eae719d0d06ff74fc524330d3aa99bcd21a7d16a5a062bf65` | current capability catalog |

## F. Reviewer attack list

Reviewer must explicitly attack and report evidence for:

1. E-33: `PLANNED` must not become enablement/candidate gate.
2. Complete BR-01..BR-32, BR-34, BR-35 set; no invented BR-33; OP collection mode and OP-21 reuse.
3. Six C boundaries and U-02: no unresolved product meaning silently becomes contract/DB constraint.
4. IA nine dimensions for all eleven screens; UI surface reasonableness; no sibling-shell/hidden-boundary workaround.
5. Single `x-consumer-faces` per route; platform-admin/operations-admin session, shell, router, store, theme and owner separation.
6. Owner facts, edge orchestration and same-`REQUIRED` transaction; no direct cross-schema write or reverse module command call.
7. OpenAPI `$ref`/generated byte flow; capability-named runtime paths; no Journey ID in runtime/test names.
8. 44 current source scenarios versus stale 28 prose; 14 proposed scenarios; concrete owner files; no retired provider/SPI/registry/package-exit control.
9. Seed is design-only, ordered owner-command → catalog-inventory, no implicit start seed, no dynamic execution.
10. Security/logging/cleanup boundaries, typed errors, CAS, no token/authorizationRef/raw payload leakage, no timeout/magic-wait substitution.
11. Exact contract literal reconciliation against spec §3.3/§5.4/§5.8: `GROUP_BUY`, `TAKEAWAY`, `INVENTORY_SYNC`, `TAKEAWAY_DELIVERY`, `LOCAL_ONLY`, `COMMERCIAL_GROUP`; platform page URL must obey G-10; acceptance domain targets and seed fixtures must match the active standards and cited source shapes.
12. N-1 regression: `collaboration.catalog-readback` must be a real HTTP catalog tree/detail read in `CollaborationAcceptanceScenarios.java`; contract publish rejection remains CP-01 owner validation, and no external-platform contract scenario may remain in `CatalogAcceptanceScenarios.java`.

Reviewer output must contain `REVIEW_CYCLE_ID`, `REVIEW_TARGET`, `REVIEW_ROUND`, `REVIEW_ROUND_LIMIT`, `reviewerKind`, the checklist path, blind declaration, findings with evidence, and a verdict. Do not provide author disposition before independent verdict.

## G. Explicitly not an input

The following retired mechanisms must not be recreated or used as acceptance criteria:

- `scripts/check/implementation-design-granularity`;
- exact-surface static implementation package / package entry or exit;
- 196 source inventory/provider shells/shared SPI/scenario registry;
- compliance-control evidence ledger, hash-chain, manifest Part B/C/D, P0/W0/P1;
- Roadmap `CURRENT_*` fields or its historical §7 example values as active state.

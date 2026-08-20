REVIEW_CYCLE_ID=EXTERNAL_COLLABORATION_IMPLEMENTATION_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=REQUIRED
authorVerdictBeforeReviewer=FORBIDDEN
freshContext=REQUIRED

# 外部协作与经营渠道实施期独立定向复核 Round 2 输入清单

本轮是同一 `REVIEW_CYCLE_ID + REVIEW_TARGET` 的最后一轮，针对 Round 1 verdict 的 F-01 至 F-13 修复做 fresh、证伪优先的定向核验。不得把 Round 1 author intake 当作输入，不得代写作者 intake，不得修改生产代码、契约、生成物、迁移、seed 或 runtime；只能写入指定 Round 2 verdict 文件。Round 2 必须在结论中声明 `ROUND_FINAL_DECISION=SELF_DECIDED`，不得召集第三轮。

## A. 仓库入口、规则与授权

| path | sha256 | role |
| --- | --- | --- |
| `AGENTS.md` | `586dedb45f1d657770aa9e0579157e96597dafcad88647e168ce7a1b5935dc54` | 执行入口、独立复核、状态读取、结束闸门 |
| `CLAUDE.md` | `ef611507ceadff37484cb51692413fb61af364170a60f2c3df061b263fb6e2e4` | review handoff 与边界 |
| `PLATFORM-BLUEPRINT.md` | `e9956c2ee23f905bcdf70b8ad0874abfdd6a497b3fc9d01ea9ad7ca896c13b74` | owner、edge、事务、consumer face |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | programId 选择 |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | R5 授权字段；不得读 CURRENT_* |
| `project-memory/index.md` | `b5638996d64a3a31bc6c7cfd164faadbeb0302d082aafc645affb41db665c9fe` | memory 导航 |
| `project-memory/decisions/deterministic-context-only.md` | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` | 确定性上下文 |
| `scripts/README.md` | `2e82318aa0b2593228f040141bf7e217ceddfae58d9ace38b7d311f284785986` | 受管脚本边界 |

## B. 需求、Journey、设计与 Round 1 事实

| path | sha256 | role |
| --- | --- | --- |
| `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md` | `a9a7c7e719636742ecc94d5476a59a64ac67342c6d9655e394f5dccc8248525c` | 冻结 BR/OP/typed problems/C/U 规格 |
| `doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md` | `448e95ea141a0e0c0d0e018b909efd8a1b4e9a9f0b4f0d304966f72dd9e5f79f` | platform Journey |
| `doc/decisions/2026-08-19-v2s-business-channel-management-journey.md` | `c8ce03f81a311821cb75ce5932bb162ac406c90b202169cd7ee70bdaaba54af9` | operations Journey |
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md` | `de3ab35e380109583346f49625d43ef2aba8f210872c3c6df68d1fc9f48a777f` | 11 屏 interaction 与线框 |
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md` | `f9d7ea214235fdaaa13458c9eedbfe0ade6e0839dcde18bdceb0b78716ff3986` | IA 九维度 |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md` | `8c9ed697f29a9bec93a0c3b067a2a0b9a76e5f60e7c3ca38adc6e8531a67adba` | implementation-facing 详设 |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md` | `830cfbfaca95871c58bfbb62d63a41d3687b18c866c11b26a8d6e1ee4f536b0b` | CP-00 至 CP-09 |
| `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-independent-review-round-1-verdict.md` | `31fbdf5b0372e7d4866ebe0ec60a91ec1ab18880632d8d1aee051f94868d1bbf` | Round 1 独立 findings；只用作定向攻击清单，不读取作者 intake |

## C. Contract、owner read、edge 与生成链

| path | sha256 | role |
| --- | --- | --- |
| `contracts/openapi-source/collaboration.schemas.json` | `e50637ec0d21bb5f85405811719a1f0fc8f2889ecd556ebd22f486a06b459219` | collaboration source；确认无 public UNBINDING、含 nodeDisplayPath |
| `contracts/openapi/components/collaboration/collaboration.schemas.json` | `e50637ec0d21bb5f85405811719a1f0fc8f2889ecd556ebd22f486a06b459219` | published collaboration component |
| `contracts/openapi/components/organization/store.schemas.json` | `3b2577a55648a33e3f18924931e002b4b77a77f360e33e2d61462e5fa8d4dd1e` | candidate subject enum |
| `contracts/openapi/paths/platform-admin/contract-overview.paths.json` | `e6a3df0e81e5822149a6df1b8b4434936bf8b3a48c6bfae7e1803c89bdf431df` | candidateUsage `EXTERNAL_BINDING` |
| `contracts/registry/operation-handler-bindings.json` | `6850e131c8e885ef065f9ea5e9a2d60cf9e1fbe2a443b3755396db7f50132161` | operation registration |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java` | `9f4a5aef2ffa51f15656a25627a30b56b415b79da62ad9ee7a29b99cfb375cbb` | F-01 edge usage/subject routing |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreCandidateTaskReadService.java` | `42f034fdf87e7175cd4112e8cc39085b60130c1ef7917535c74149c883af3e9e` | F-01 owner projections and common paging |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/PlatformExternalCollaborationController.java` | `098e73d5f3554e81eadff7b6f22dd5b99033738d3611c13f6a69bc870fe5a0ba` | binding readback task-path enrichment |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/ExternalCollaborationWireMapper.java` | `e01b8316d83d2f4b5879777df1e4c46478ce36a05b8c79a2ad0b5ec6233a62d4` | nullable display mapping |
| `apps/backend/catering-business-server/src/main/resources/db/migration/V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql` | `94175e17372da05ad8d7be33189a218a5e00edd5c6e3db766f5506e6cdcf3cc2` | 验证 commercial_group、organization_node、head_company、store 真实字段 |

## D. UI、seed、acceptance 与 gate source

| path | sha256 | role |
| --- | --- | --- |
| `apps/frontend/platform-admin/src/app/queries/usePlatformOrganizationCandidates.ts` | `92a3f14f457086bd44d6151387058ad6a590bfdead92eac3aa84a75bfd8f08dd` | EXTERNAL_BINDING query |
| `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingFormDrawer.tsx` | `a17297ddefa0533ee1fd5869950d56c1e2eb76899529fe071a6a61a16ceebf1a` | five bindable node types |
| `apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx` | `d9689cc095d807abcbd8371de3a924c3931848db01ac82b8f5452da2a062a05d` | deep route registration |
| `apps/frontend/operations-admin/src/app/OperationsApp.tsx` | `46a06dc426fbdf7269628488eeed0429c7bef2d164e42c7dcfe6f590b3ed3e65` | deep route matching/context |
| `scripts/dev/external-collaboration-business-channel-seed-plan.mjs` | `922369dedd708cb6f838c4b4a05e0d516fe508dba917ce5c4e949f2bc04a0002` | design-only seed plan |
| `scripts/dev/external-collaboration-business-channel-seed-executor.mjs` | `b42cf0a21b791a2aece5f9f88f1b345d2572ed2f40860addbb2187090ed0eaa6` | static-only executor boundary |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java` | `2d62f57f4e0c448c5ea73dd6886c35d13a83c665b4d1854d36802f3038c1312b` | collaboration domain scenarios |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java` | `d2e046e917880e75288282ea0fcbc5dfb0053ab26967d6887fb8f00313cd2672` | business-channel domain scenarios |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java` | `c236a70a80eb4e705465405312782860615d08914aba97e6ecf0be0178add677` | catalog registration |
| `scripts/check/external-collaboration-business-channel-contract.mjs` | `19d2b7ad082299744a0438e2c5a5f7a9311e6a0ffeb130bb6c40d0c3659a476c` | contract gate |
| `scripts/generate/edge-codegen.mjs` | `a4de5e2f086bf6b94e9213daa9f1206c73a78ffb42fdf79f3a42bb3497cf42c7` | source→generated flow |

## E. Round 2 定向攻击题

Reviewer must independently prove or falsify each item with exact source path/line evidence:

1. F-01：`EXTERNAL_BINDING` 不是只有 OpenAPI 字面量；同一 platform candidate API 是否真正接受五类 subject，并且 owner read 是否分别读取真实 `commercial_group`、`organization_node`、`head_company`、`store`，共用 query/filter/selectedId 语义；不得把 platform UI bindableNodeTypes 当授权。
2. F-02：approved operations project/store deep URLs 是否真实命中 registry/shell，scope ref 是否只作页面查询上下文而非违反 G-10 的 URL 规则；API 路径与页面路由不得混淆。
3. F-03/F-04：non-DINE_IN `dineInForm=null` 是否可达；project template status idempotency key 是否含 target status且保留 receipt conflict。
4. F-05/F-06：disabled channel 的 binding maintenance 与 restore draft 是否同时由 edge/owner/UI 约束，是否存在客户端绕过或把未定状态写死。
5. F-07：public OpenAPI/generated 是否仍出现 `UNBINDING`；不得借复测自行决定 C-04。
6. F-08/E-33：provider candidates 是否按 capability/order/governance facts 过滤或展示；`PLANNED` 是否仍仅为候选事实，不成为 enablement/candidate gate。
7. F-09：P4/P5 真实使用 organization task-path presentation read 展示名称/path；不把 UUID 当用户可读值，不以 display read 代替 authority。
8. F-10/F-11：EXTERNAL 与 DINE_IN 联动清理是否可见且不可提交不相容组合；operations denominator 是否包含两条 deep pages。
9. F-12：seed plan 是否有五类节点覆盖、万象城海底捞三渠道与 POS/扫码/自助机三族，且 executor 不会隐式执行 seed。
10. F-13/全局：runtime/test/source 命名是否无 Journey/BR/OP/R5 控制词；无 provider 壳、共享 SPI、scenario registry 或退役 compliance-control 回流。
11. 全局：owner facts、有限 edge command、同一 `REQUIRED` 事务、CAS/version、single `x-consumer-faces`、foundation 复用、typed problems、日志隐私、生成链与 handler registration 是否真实一致；六项 C 继续依赖态，尤其 C-03/C-04/C-08/C-09 不被实现偷定。
12. 证据边界：静态 PASS、compile PASS、未执行的 test、动态 Testcontainers guard、seed-only self-test 必须分开报告；不得运行 seed/reset/DEV/Testcontainers/browser L2/UAT/external integration。

## F. 输出要求

只写：
`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-2-verdict.md`

输出必须包含：`REVIEW_CYCLE_ID`、`REVIEW_TARGET`、`REVIEW_ROUND=2`、`REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`、本清单路径、盲审声明、`ROUND_FINAL_DECISION=SELF_DECIDED`、逐条 finding 的 `CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED_REQUIRES_EVIDENCE/DEXTER_DECISION` 与 M/S/N、GO/NO-GO，以及已执行/未执行边界。

禁止修改作者 intake、Claude brief 或本清单；禁止执行 seed、reset、DEV start/restart、Testcontainers、browser L2、UAT、外部联调与任何 Git 操作。Round 2 是最后一轮；若发现产品/Journey/C 裁决事项，只能标为 `DEXTER_DECISION` 并硬停止，不得自行确认。

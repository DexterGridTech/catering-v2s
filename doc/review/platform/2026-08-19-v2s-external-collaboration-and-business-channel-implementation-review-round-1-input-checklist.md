REVIEW_CYCLE_ID=EXTERNAL_COLLABORATION_IMPLEMENTATION_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=REQUIRED
authorVerdictBeforeReviewer=FORBIDDEN

# 外部协作与经营渠道实施期独立盲审 Round 1 输入清单

本清单是 fresh 独立子 agent 的最小完整输入。reviewer 必须从仓库入口恢复上下文，先以证伪为立场独立核验真实源码、契约、生成物、测试与 UI；不得读取作者 intake、Claude brief 或作者预先形成的 verdict。reviewer 不得修改生产代码、契约、生成物、迁移、seed 或 runtime，只能写入指定 verdict 文件。

## A. 仓库入口与适用规范

| path | sha256 | role |
| --- | --- | --- |
| `AGENTS.md` | `586dedb45f1d657770aa9e0579157e96597dafcad88647e168ce7a1b5935dc54` | 执行入口、授权边界、独立复核与结束闸门 |
| `CLAUDE.md` | `ef611507ceadff37484cb51692413fb61af364170a60f2c3df061b263fb6e2e4` | 评审交接与话术约束 |
| `PLATFORM-BLUEPRINT.md` | `e9956c2ee23f905bcdf70b8ad0874abfdd6a497b3fc9d01ea9ad7ca896c13b74` | owner、edge、事务、consumer face |
| `doc/platform/README.md` | `d358e49c83726528690a9d05aa9f6a1979a0f9d2051fd56ef9db4ff98b573c7f` | platform 文档入口 |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | programId 选择 |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | R5 授权字段；不得使用 CURRENT_* 历史值 |
| `scripts/README.md` | `2e82318aa0b2593228f040141bf7e217ceddfae58d9ace38b7d311f284785986` | 受管脚本与动态边界 |

## B. 必读 memory 与业务规格

| path | sha256 | role |
| --- | --- | --- |
| `project-memory/index.md` | `b5638996d64a3a31bc6c7cfd164faadbeb0302d082aafc645affb41db665c9fe` | memory 导航；规则须回到命中原文 |
| `project-memory/decisions/deterministic-context-only.md` | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` | 确定性上下文 |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | deployable 与 owner |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | schema、事务、跨 owner 写边界 |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` | contract、consumer face、双后台 |
| `project-memory/operations/backend-acceptance.md` | `b5bca0ee74b93b3ac72b326512c07dd71c934430ee28b095ed8024c69d63d215` | acceptance 场景边界 |
| `project-memory/operations/implementation-source-reread-discipline.md` | `6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce` | 逐点双读 |
| `project-memory/practices/backend-capability-lookup.md` | `5c5eeb1bf24a3605135d586e58c74f23411cc676c82b8193e6044b389e69c235` | backend capability lookup |
| `project-memory/practices/frontend-capability-lookup.md` | `8ac0fc474432f207b7fdf469656a8d3470570c6ba3bc4cbe938a912dfdadf77b` | foundation/source lookup |
| `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md` | `a9a7c7e719636742ecc94d5476a59a64ac67342c6d9655e394f5dccc8248525c` | 冻结 BR/OP/typed problems/C/U 规格 |
| `doc/review/platform/2026-08-18-v2s-external-platform-capability-and-binding-decoupling-source-claude.md` | `499eed365ffe591dc390746e09a52c13ebe2a35776d86e4825815b8467983ca7` | Dexter source records 001–012 |

## C. 已接受设计与实施边界

| path | sha256 | role |
| --- | --- | --- |
| `doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md` | `448e95ea141a0e0c0d0e018b909efd8a1b4e9a9f0b4f0d304966f72dd9e5f79a` | platform Journey |
| `doc/decisions/2026-08-19-v2s-business-channel-management-journey.md` | `c8ce03f81a311821cb75ce5932bb162ac406c90b202169cd7ee70bdaaba54af9` | operations Journey |
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md` | `de3ab35e380109583346f49625d43ef2aba8f210872c3c6df68d1fc9f48a777f` | 11 屏 UI interaction 与线框 |
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md` | `f9d7ea214235fdaaa13458c9eedbfe0ade6e0839dcde18bdceb0b78716ff3986` | IA 九维度 |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md` | `8c9ed697f29a9bec93a0c3b067a2a0b9a76e5f60e7c3ca38adc6e8531a67adba` | owner/contract/API/UI/acceptance/seed 详设 |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md` | `830cfbfaca95871c58bfbb62d63a41d3687b18c866c11b26a8d6e1ee4f536b0b` | CP-00 至 CP-09 实施计划 |
| `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md` | `ebc8cc3affe6446979359194a64a50df9a693dc32cef0e97687caaee31ecd568` | 单 deployable、edge policy |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5` | 静态/动态证据边界 |
| `doc/decisions/2026-07-25-v2s-frontend-foundation-consumption-rule.md` | `2fe7ac4c8ba25518941d0bfbecde3d5539c4d2b9f011012db770d1edf0787b27` | 共享 foundation 强制复用 |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` | fresh blind review 与两轮上限 |
| `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` | `cc2373d1d3dc3d329e549acf22048a6e063832878787ee953f2bd4bd85b6a9c9` | scenario domain placement |

## D. Contract、生成链与 backend implementation source

| path | sha256 | role |
| --- | --- | --- |
| `contracts/collaboration/external-platform-catalog.json` | `d0f85d18defdd7892056ec3f88ab0f120776681e72da266b054f83ba9f0ed5bc` | descriptor/provider catalog |
| `contracts/collaboration/external-platform-catalog.schema.json` | `7f7c31625ef0361c06a17fff333d2fe1cf08ad4cc81cce28a36e37e390c49bb2` | descriptor schema |
| `contracts/openapi-source/business-channel.schemas.json` | `d747bc317d961677725d264d8425eb507379bb024cc528eca74645b219d1258c` | business-channel source schemas |
| `contracts/openapi/components/business-channel/business-channel.schemas.json` | `824b386216d7b768fbd46c5dcea492cf4e4309177c744c5f12034c385e6c93a9` | published component schemas |
| `contracts/openapi/paths/operations-admin/business-channel.paths.json` | `19f47d05edb657d6b7b88bd5a7f58ce599d7a9d07e140d8c077aa2f42b55ff5e` | operations routes |
| `contracts/openapi/paths/platform-admin/external-collaboration.paths.json` | `625a6783dcc5ff2d84fc3816fe35681ad0ceb0a5d36a3187f08176d8d2ebf03d` | platform routes |
| `contracts/openapi/edge.openapi.json` | `7c575faf2f6575e1aacb12fc4a27c3f83bd9a5c4a62888cab56928721a40fc23` | current edge contract |
| `contracts/registry/operation-handler-bindings.json` | `6850e131c8e885ef065f9ea5e9a2d60cf9e1fbe2a443b3755396db7f50132161` | operation binding source |
| `scripts/check/external-collaboration-business-channel-contract.mjs` | `19d2b7ad082299744a0438e2c5a5f7a9311e6a0ffeb130bb6c40d0c3659a476c` | external contract gate |
| `scripts/generate/edge-codegen.mjs` | `a4de5e2f086bf6b94e9213daa9f1206c73a78ffb42fdf79f3a42bb3497cf42c7` | OpenAPI/generated byte flow |
| `scripts/generate/backend-performance-m1-command-execution-bindings.mjs` | `2bf1ff2375a1062974ca61d1934966b24ae313bb09f9cb7abd5c8e0ff467e8c6` | M1 generated command binding flow |
| `tools/code-layout/cli.mjs` | `eb5c4ad62f185cea295369154c61bf011dc59068147be6cbb293dc8c41518640` | capability-named layout gate |
| `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/api/CollaborationCommandApi.java` | `42cdc20e9198d49b68e65dc963d299a674bc896d2f51de1f0fc1d695fa6939e3` | collaboration owner commands |
| `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/api/CollaborationBindingReadApi.java` | `b8d60fa12447936c4062a542f148aef7dc4ca47dd4e7d23e296bdf66db0667f3` | binding read boundary |
| `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/api/CollaborationCatalogReadApi.java` | `14104875aee4a58111ab1e6f0b78045a00d7bd54fca3330d5ca8ba6af204a968` | catalog read boundary |
| `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelCommandApi.java` | `e63602009d3b220b80364317c35f02808c6b0f4e83a58539b7bb1a566f07aa6e` | business-channel owner commands |
| `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelReadApi.java` | `993cf4cadfe0eeb7ae6af105e31d474caa5076a3adb0a17fc54972316f1f504a` | business-channel read boundary |
| `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java` | `1b34abb03197c1414a323dd109bf2f1eb6c7a49b0ae0fbbfb8e57a12f028c056` | owner facts and commands |
| `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelPolicy.java` | `70bb78e209a798919db2f3e0b572f7006d604400e164a1f6129b4b1cb9fe3024` | channel policy and frozen literals |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/externalcollaboration/ExternalCollaborationBusinessChannelCoordinator.java` | `723551511c529d46f6d181d145212bc9b5cd48bc0d6e6dfa8612b837573b5d2a` | finite edge orchestration |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/PlatformExternalCollaborationController.java` | `63605e10e570931329957221134dc02492b305666ce8c1e9e249869686265759` | platform-admin edge |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java` | `ffa89ac89fc2076678295e2ad99d6d71be7ad6e97079dcb7be27358021b19a18` | operations-admin edge |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/ExternalCollaborationWireMapper.java` | `a2ec29efd13a9b335da7162cf18f300d18e54b944ca91cd73653d30b1d094f96` | platform wire mapping |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/BusinessChannelWireMapper.java` | `4cbf8276c53a62fa1d8dfed09f417ab3abe3c9aebc369ba7aeb1632ad4c93fc8` | operations wire mapping |
| `apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_001__business_channel_owner.sql` | `0757a87b77501190cadffc2d18a9637999660fc6aae5dd3a7b8b8a675f0c41d7` | additive owner schema |

Also inspect the six business-channel operation wrapper classes under `apps/backend/catering-business-server/src/main/java/com/catering/v2s/business/channel/application/operations/` and the three operations binding wrapper classes under `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/operations/`.

## E. Generated consumers, UI, seed and acceptance source

Inspect all files under the following feature directories, including route registration and generated API consumers:

- `apps/frontend/platform-admin/src/features/external-collaboration/`
- `apps/frontend/operations-admin/src/features/business-channel/`
- `apps/frontend/platform-admin/src/app/queries/usePlatformOrganizationCandidates.ts`
- `apps/frontend/platform-admin/src/app/routing/pageRegistry.tsx`
- `apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx`
- `apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts`
- `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts`

Core current hashes:

| path | sha256 |
| --- | --- |
| `apps/frontend/platform-admin/src/app/queries/usePlatformOrganizationCandidates.ts` | `495be3e8c35e91614f76dbe10ffc3c7f5f806252948a0148b50cfebe6582c349` |
| `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingFormDrawer.tsx` | `1ec09acba69245c084e457cf98f1a7bd9ed5395c6f753fb7fb9f34791167e426` |
| `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingList.tsx` | `ed1074b6d3c00d856da4c5fd17876ec639d37b0b55667f54725d1008183008a9` |
| `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelList.tsx` | `f5a793ad517613ffbfaba9e9d625a307dc9b3deee4073b2c55d2fa69c134c604` |
| `apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts` | `21f326b9c1a39f21d69c839e1383c5b3c25781620a4620a88a3faa86aa6614b1` |
| `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts` | `5df50865d892c0fc22eb7ea7e2139a27f88ff39f3abcfac719ed5d539d51cc37` |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java` | `c236a70a80eb4e705465405312782860615d08914aba97e6ecf0be0178add677` |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java` | `2d62f57f4e0c448c5ea73dd6886c35d13a83c665b4d1854d36802f3038c1312b` |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java` | `d2e046e917880e75288282ea0fcbc5dfb0053ab26967d6887fb8f00313cd2672` |
| `scripts/dev/external-collaboration-business-channel-seed-plan.mjs` | `dd41c0cca3ff95549292b54d8a5865e86e5b87f1a24112ae45ccc0e270f3d89c` |
| `scripts/dev/external-collaboration-business-channel-seed-executor.mjs` | `0df234e42b31c50d9894127103d0438480d7e75d11ac4061a5ef00da70d43c2c` |

## F. Reviewer attack list

Reviewer must explicitly attack and report evidence for:

1. E-33: `catalogStatus=PLANNED` remains informational and never becomes an enablement, candidate, or write gate.
2. BR-01..BR-32, BR-34, BR-35, BR-33 explicit gap; frozen literals exactly `GROUP_BUY`, `TAKEAWAY`, `INVENTORY_SYNC`, `TAKEAWAY_DELIVERY`, `LOCAL_ONLY`, `COMMERCIAL_GROUP`.
3. Six C boundaries and U-02: no unresolved product meaning silently becomes an API enum, DB constraint, generator, uniqueness rule, or irreversible cascade.
4. Owner facts, finite edge orchestration, command direction, same `REQUIRED` transaction, CAS/version propagation, and absence of direct cross-schema writes.
5. Two independent apps: one `x-consumer-faces` per route, separate sessions/shell/router/store/theme, operations channel-context binding only, no capability on reads.
6. OpenAPI source → edge materialization → generated wire/client → controller mapping; capability-named runtime paths; no Journey/BR/OP ID in runtime/test package names.
7. Collaboration and business-channel status/binding semantics: platform delete, operations binding create/update/delete, binding detach-to-draft, provider/system disable cascade, `EXTERNAL_GRANT` null external owner, and no fabricated `markBindingsCascadeDisabled` behavior.
8. UI nine dimensions and approved Journeys, foundation reuse, no UUID-as-copy, no hidden unsupported node types, and exact route/context alignment with G-10.
9. Acceptance domain placement, current 44 plus 14 new scenarios, concrete owner files, real catalog read scenario, no retired provider/SPI/registry/package-exit mechanism.
10. Seed plan is design-only, ordered owner-command → catalog-inventory, no implicit start seed, complete five node binding coverage, Wanxiang/Haidilao shape, and POS/scan/self-service internal fixtures.
11. Security/logging/typed problems/CAS and privacy; no token, authorization reference, raw provider payload, or sensitive fields in logs; static evidence is not misrepresented as runtime/L2/UAT proof.
12. Review implementation omissions caused by generated UUID typing, nullable reads, operation handler registration versus actual route use, error ownership, and API/DB literal drift.

## G. Required output and boundaries

Write only:
`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-independent-review-round-1-verdict.md`

The verdict must contain `REVIEW_CYCLE_ID`, `REVIEW_TARGET`, `REVIEW_ROUND`, `REVIEW_ROUND_LIMIT`, `reviewerKind`, this checklist path, the blind declaration, findings with exact evidence paths/lines and severity `M/S/N`, a verdict, and a clear statement of what was and was not executed. Do not write author intake or a Claude request. Do not run seed/reset/DEV/Testcontainers/browser L2/UAT/external integration. Do not use retired compliance-control or 196-provider mechanisms.

## H. Explicitly not an input or acceptance criterion

Do not recreate or use `CURRENT_*` Roadmap fields, exact-surface implementation packages, 196 provider shells/shared SPI/scenario registry, compliance-control ledgers/hash chains/package entry-exit, or any other retired control plane. The implementation authorization is bounded to the R5 batch and keeps C-01/C-02/C-03/C-04/C-08/C-09 pending.

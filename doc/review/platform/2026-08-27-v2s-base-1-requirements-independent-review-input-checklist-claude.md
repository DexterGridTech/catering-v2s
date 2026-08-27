# base-1 requirements independent review input checklist

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
REVIEW_CYCLE_ID=BASE1-REQUIREMENTS-2026-08-27-CODEX-INDEPENDENT
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
AUTHORIZATION_BOUNDARY=只读 independent review；不授权实施、生产代码变更、需求/标准/记忆修改、测试、DEV、reset、seed、L2、UAT、部署或 Git。仅授权写入本 checklist 与同名 review artifact。
BLIND_DECLARATION=本轮先按入口、skill、review-standard、project-memory、正本与 owning source 独立证伪并形成 findings/verdict；未读取作者自审或 finding disposition；未把两份 2026-08-26 已作废文档作为行动依据。
L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON(纯后台/需求治理，无本批 UI surface)
```

## 1. Entry and authority inputs

| Input | SHA256 / command result | Read status |
| --- | --- | --- |
| `AGENTS.md` | `ba7e2c19710f463d34c895fbaccd8a12099baab28c18fc2ba57300401fa96bc6` | READ_ALL |
| `CLAUDE.md` | `2a0d415b00e44374b3c0b3bad7a9d76e530b0d9a0d8b39e5e05b243e1e13163d` | READ_ALL |
| `PLATFORM-BLUEPRINT.md` | `b5b9b5110c9e7d8642b81ea885cbe8580aef2e1f042c710dc5bce590538f6fe7` | READ_ALL |
| `doc/platform/README.md` | `b978e9cf851b8c4829a0c69ef16f4492164e9e6583ca62582618f13fe0912c80` | READ_ALL |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | parsed; unique ACTIVE `programId=V2S_W0_W4_EXECUTION` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | read authorization fields only; current exact authority remains Dexter-transferred review-only |

Roadmap authorization readback: R1/R2 foundation closed; later implementation/dynamic flags are historical authorization records, not current task intent. Current task authority is the explicit review-only request.

## 2. Skills, review standard, templates

| Input | SHA256 | Read status |
| --- | --- | --- |
| `.agents/skills/cs-memory-recall/SKILL.md` | `d9e4b8ca8b7ee5bdbe41037338fe3815ae024ce61c42bcb62e6684d8e4648b0f` | READ_ALL |
| `.agents/skills/cs-code-structure-recall/SKILL.md` | `12a9ea88469d2a948d47280b9ea2f4249102cbde4d8d08439d00a5a1a9ddafa7` | READ_ALL |
| `.agents/skills/cs-review/SKILL.md` | `5533b184854b47441e41f549a10724cc3ec5b0eea76a7fbf907a4022e34b3c42` | READ_ALL |
| `doc/platform/review-standard.md` | `0fbd59cbec9b849b232b522fde390c97867efb17d5d4815e01f9cbfcc7578aaf` | READ_ALL; §1-B selected |
| `doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md` | `1150f2911a511c6eb50cb3c64f5e36a495541d7e7fefa87e64cfa09e04e0c6ad` | READ_ALL |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` | READ_ALL |
| `doc/decisions/templates/journey-decision-template.md` | `57a99ca1fea405cd04857779b0661c7fcfed66b9f5095450f2cd73cc8441230d` | READ_ALL |
| `doc/decisions/templates/ui-interaction-design-template.md` | `75cb8c22042f2d9e0f8a8b121e96952d226a7efc4e73184d2b75ecfd8e642e51` | READ_ALL |
| `doc/decisions/templates/ia-design-template.md` | `062925f8aa4b3446e06e74d8bad4166f3b3b3e8b18ebe403df7184acd5cd358f` | READ_ALL |
| `doc/decisions/templates/implementation-design-template.md` | `394a5f810122bc0bb16b96e1c0e1a1a85c8cb4d1b603239827146b0c1024df46` | READ_ALL |

Template applicability:

- Journey template: NOT_APPLICABLE_WITH_REASON. The reviewed artifact is a cross-cutting requirements/governance draft, not a single user Journey decision.
- UI interaction template: NOT_APPLICABLE_WITH_REASON. No new UI-bearing screen, Drawer, Modal, route, or wireframe is directly proposed in this artifact.
- IA template: NOT_APPLICABLE_WITH_REASON. No information-architecture artifact or screen-level IA is being reviewed.
- Implementation-facing template: PARTIALLY_APPLICABLE. The reviewed artifact states rollout order, blockers, acceptance criteria, migration denominator, and execution surfaces; therefore review-standard §1-B requires extracting missing implementation-facing mandatory surfaces before this document can safely drive implementation.

## 3. Project memory and routed context

| Input | SHA256 / command result | Read status |
| --- | --- | --- |
| `project-memory/index.md` | `154ce102d8c3a6325effa62c6ffdfc5d3b14897de8b2d3bb8df0bdafa4339c86` | READ_ALL |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` | READ_ALL |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | READ_ALL |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | READ_ALL |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` | READ_ALL |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` | READ_ALL |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | READ_ALL |
| recall command | `scripts/context/recall-memory --task-kind review --domain backend --consumer-face backend --owner backend --impact governance --trigger review` | PASS; `REF_COUNT=22 PATH_COUNT=54`; stdout digest `9b77fb8bcc00d3a2bc53c07a40037394e0a991186229d4a401d411d259518225` |

Routed-hit hash inventory:

| Routed path | SHA256 |
| --- | --- |
| `doc/decisions/2026-07-24-v2s-r1-authorization.md` | `a2216874062892229424cc9f8c2bc478d110795b4876433782c6d22a2e78b615` |
| `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md` | `ebc8cc3affe6446979359194a64a50df9a693dc32cef0e97687caaee31ecd568` |
| `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md` | `b30cc0d28d4d79034f10914a50c85f6bac9cc394f092dccbfdac21a62e1163e7` |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5` |
| `doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md` | `eb8772599be4ec7c9c111c074946f0ff22ce7b73c54ba29bc17e72131eb3849b` |
| `doc/decisions/2026-07-25-v2s-design-governance-batch-1.md` | `7268ac433b57491b13bb7e79eaf40b54abf121cc5dddecee47261a78a99ea372` |
| `doc/decisions/2026-07-26-v2s-r5-operation-history-interaction-design.md` | `fd5cc25851021fe84f11172f1d5978a9630ba2eec86939957b149dc33f2c477f` |
| `doc/decisions/2026-07-27-v2s-identified-finding-generalization-and-prevention.md` | `0aca450c2bc6e83da1d6d5e6d5bc1ec74b67245c4c1bb2f1fa65fab841b17bba` |
| `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md` | `fee1f6a0417916d5fa6e38c2f5925c65eb2d26f9bb112d375216f96250ab0777` |
| `doc/decisions/2026-08-08-v2s-catalog-inventory-scope-specific-write-capabilities.md` | `6b573bf8b2d4449d39df2ced18c7d86947dcca8cedd7350598084584db1f46db` |
| `doc/decisions/2026-08-11-v2s-routine-runtime-command-classification.md` | `23ff63cce0853cc77587d8e629717804326914cc87f4217f8e00c28af8f340b0` |
| `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` | `0386869f576f4ea2207e130101ea035c2b4e310e8956d49bb77d78a44eee7c0a` |
| `doc/platform/foundation-charter.md` | `f54b882baf4fa85f91d4c75e15aff4d4574e9c9374c276113484ed013ab24455` |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `52cc53b9ab5182974fdfcf1d3bcb980e4f8e3069e56558497692880e5dc4b67e` |
| `project-memory/decisions/deterministic-context-only.md` | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` |
| `project-memory/operations/backend-acceptance.md` | `b5bca0ee74b93b3ac72b326512c07dd71c934430ee28b095ed8024c69d63d215` |
| `project-memory/operations/verification-governance.md` | `3094cf61cea315208323f7d3f9266f719ea6ca9d828094378ede375dfe9f3005` |
| `project-memory/practices/read-model-granularity.md` | `5594f03106a7253def704038768e55244bc11930e7be43184f26a3d49ab60561` |
| `scripts/README.md` | `90b914187daae3bb50da2e504187d522ef01d0f92dc789028cac181a3cc18630` |

All 54 routed paths were hashed/read for routing relevance; the table above lists the decisive subset used in findings. `contracts/policy/standards-coverage-matrix.json` and retired compliance-control assets were not used as admission gates.

## 4. Reviewed artifact and same-batch standards

| Input | SHA256 | Read status |
| --- | --- | --- |
| `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md` | `c798088aaa68a0a9f9a34df9d23fe534c5bfb9cce509036d647e7ba80a8a910a` | READ_ALL |
| `doc/platform/backend-coding-standard.md` | `264c9d197dbc6009bcd0afe4260ae399d05e0a6bcea32991611ac559c66502aa` | READ_ALL |
| `doc/platform/foundation-charter.md` | `f54b882baf4fa85f91d4c75e15aff4d4574e9c9374c276113484ed013ab24455` | READ_ALL |
| `project-memory/decisions/owner-read-model-and-lifecycle-standard.md` | `cff1b21e327868e78c119628c55165c2daae0df129e52039bd9ee66de084698f` | READ_ALL |
| `project-memory/practices/read-model-granularity.md` | `5594f03106a7253def704038768e55244bc11930e7be43184f26a3d49ab60561` | READ_ALL |
| `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` | `0386869f576f4ea2207e130101ea035c2b4e310e8956d49bb77d78a44eee7c0a` | READ_ALL |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `52cc53b9ab5182974fdfcf1d3bcb980e4f8e3069e56558497692880e5dc4b67e` | READ_ALL; G-05/G-07/G-08 reopened |

## 5. Read-only source and denominator commands

No Git, tests, DEV, reset, seed, L2, UAT, deployment, or production/standard/memory edits were run.

| Command | Result |
| --- | --- |
| `rg --files apps/backend/catering-business-server/modules \| rg '/src/main/java/.*\\.java$' \| wc -l` | `210` |
| `rg --files apps/backend/catering-business-server/src/main/java \| rg '\\.java$' \| wc -l` | `416` |
| combined two main Java roots | `626` Java files |
| Java/string assembly scan over 626 main Java files | concat-like Java tokens: 3965 hits / 119 files; SQL concat-like tokens: 1469 hits / 169 files; suffix display/label/summary symbols: 67 unique names / 430 hits / 66 files |
| `rg -c '@AcceptanceScenario' apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/*AcceptanceScenarios.java` | total 80 scenarios across 9 files: CommercialContract 4, Organization 7, Extension 2, Iam 10, Collaboration 9, BusinessChannel 7, Audit 1, Asset 2, Catalog 38 |
| scan for old detail-section phrase in `contracts/catalog/catalog-inventory-edge-contract.json` | 7 lines: 485, 5099, 5241, 5364, 5489, 5624, 5748 |
| scan for old detail-section phrase in `contracts/policy/catalog-inventory-assertion-matrix.json` | 7 lines: 802, 6053, 6249, 6380, 6513, 6656, 6788 |
| operation-count gate scan | `scripts/generate/backend-performance-budget.mjs:10,210,635-648`; `scripts/generate/operation-handler-bindings.mjs:19-25,406-408`; `scripts/test/r5-remote-testcontainers.mjs:343-369`; `scripts/test/backend-performance-operation-reconciliation.mjs:163,223,261,302,332`; CP05 report still carries 239 entries |
| status/lifecycle source spot checks | `WorkspaceAuthenticationService.java:188-195` and `947-953` lack account `status='ENABLED'`; `WorkspacePasswordRecoveryService.java:281-305` includes account `status='ENABLED'`; runtime role resolution keeps `r.status='ENABLED'` at `522,901,1282,1303`; `WorkspaceInvitationService.java:249-258` loads roles but does not check role status; `BusinessEntityService.java:2115-2135` returns store status but does not filter it, while `ContractCommandService.java:78-82,143-151` only checks project id |

## 6. Action 1-B extraction

Non-empty missing/contradiction/value list:

1. Missing implementation-facing §9a full-chain change surface. The requirements draft says expression change currently forces contract/backend/test/seed changes (`doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:14`) but does not enumerate each changed fact across contract/source/generated/backend/frontend/test/fixture/seed/executor.
2. Missing implementation-facing §10b seed design. The draft names seed as a directly affected surface but contains no affected seed file denominator or branch coverage table.
3. Missing implementation-facing §11-style acceptance scenario map. A-6 names backend-acceptance behavior but does not map exact existing/new scenario IDs, fixture construction, red mutation, and old assertion retirement.
4. Missing generated/operation gate full closure table. §4 blocker 1 lists four running gates, but source scan found `scripts/test/backend-performance-operation-reconciliation.mjs` as an additional 239/count gate.
5. Contradiction: active backend-acceptance standard says no scenario count cap, while `AGENTS.md`, `project-memory/operations/backend-acceptance.md`, and `project-memory/practices/backend-capability-lookup.md` still state or route by an 80 cap/five-domain model.
6. Contradiction: §4 blocker 5 says assertion matrix has 2 stale “approved detail section” obligations; current bytes have 7 in that file.
7. Undecided concrete value: `catalog_composite_component.status` remains `ENABLED/DISABLED/ARCHIVED` in an exempt table, while the same draft says platform `ARCHIVED` is unified into `VOIDED`; §7.3 correctly notices this but leaves the exact allowed values unresolved.
8. Undecided concrete source: §7.4 allows “两个 App 各建一份枚举字典(或从生成的契约 enum 派生)”; that is not a single implementation source and can create two front-end residences for the same static display vocabulary.
9. Unreproducible denominator: the draft states 41 `*DisplayName/*Label/*Summary` fields across 8 domains, but independent main-Java scan sees 67 suffix-symbol names; earlier contract-property scan saw 37 unique property names. The draft needs a path-level denominator rather than a raw number.


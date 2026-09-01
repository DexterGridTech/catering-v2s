# v2s sales-menu DESIGN review Round 2 input checklist

targetPath=doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-2-input-checklist-claude.md

## Metadata

REVIEW_CYCLE_ID=SALES-MENU-DESIGN-2026-09-01  
REVIEW_TARGET=DESIGN  
ACTION_1_VARIANT=1-B 文档提取  
REVIEW_ROUND=2  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
ROUND_FINAL_DECISION=SELF_DECIDED  
furtherCodexAdversarialRoundAllowed=false  
artifactTranscription=MAIN_AGENT_VERBATIM_FROM_INDEPENDENT_SUBAGENT  
evidencePolicy=STATIC_SOURCE_REVIEW_ONLY  
writePolicy=NO_REPOSITORY_WRITE_BY_REVIEWER_DUE_READ_ONLY_SUPERIOR_CONSTRAINT  
dynamicExecution=NOT_RUN  
gitExecution=NOT_RUN  
MINIMAL_INPUTS_ALL_FULLY_READ=true

## Blind order declaration

- Independent verdict/findings were formed before reading Round 1 review/intake.
- The following author/previous-round files were not read before independent verdict:
  - `doc/review/platform/2026-09-01-v2s-sales-menu-design-author-reconciliation-codex.md`
  - `doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-input-checklist-claude.md`
  - `doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-claude.md`
  - `doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-intake-claude.md`
- After independent verdict was fixed, only Round 1 review and intake were read for directed closure comparison.

## Repository entry and governance inputs

| path | sha256 | read status |
| --- | --- | --- |
| `AGENTS.md` | `5caa9b1724eb678dfe5ebb48a96a8290ae8747d36920c072fdc404fa9009dcc6` | READ_FULL |
| `PLATFORM-BLUEPRINT.md` | `b5b9b5110c9e7d8642b81ea885cbe8580aef2e1f042c710dc5bce590538f6fe7` | READ_FULL |
| `CLAUDE.md` | `5d6ca2f45578c8664b3e8f3743be17c99c1de9c67f764a1382cb89e2219e26c5` | READ_FULL |
| `.agents/skills/cs-review/SKILL.md` | `5533b184854b47441e41f549a10724cc3ec5b0eea76a7fbf907a4022e34b3c42` | READ_FULL |
| `doc/platform/README.md` | `b978e9cf851b8c4829a0c69ef16f4492164e9e6583ca62582618f13fe0912c80` | READ_FULL |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | READ_FULL |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | READ_FULL |
| `project-memory/index.md` | `549818b4e90dd17b054710c29f7f3b2e0d2c81cb262e7f624c53e095a25c63e5` | READ_FULL |
| `scripts/README.md` | `2b950eaf6e508c67406d7a012610a8763b743553c1438e7fb6f300f4a4462a6a` | READ_FULL |

## Selected roadmap authorization read

selectedRoadmap=`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`

Observed authorization facts:

- `ROADMAP_PROGRAM=V2S_W0_W4_EXECUTION`
- `R3_DESIGN_AUTHORIZED=true`
- `R3_IMPLEMENTATION_FACING_DESIGN_AUTHORIZED=true`
- `R3_IMPLEMENTATION_AUTHORIZED=false`
- `R4_DESIGN_AUTHORIZED=true`
- `R5_DESIGN_AUTHORIZED=true`
- `R5_IMPLEMENTATION_AUTHORIZED=true`
- `R5_RUNTIME_AUTHORIZED=true`
- `R5_SEED_RESET_AUTHORIZED=true`
- `V2S_WRITE_AUTHORITY=true`
- `V2S_SESSION_ENTRY_READY=true`
- `V2S_FOUNDATION_READY=true`
- `GIT_OWNER=Dexter`

Roadmap was used only as authorization record. Current task truth was Dexter’s direct Round 2 review instruction.

## Recall command

Command executed read-only:

```text
scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact architecture --trigger task-start
```

All returned originals were read in full.

## Recall originals

| path | sha256 | read status |
| --- | --- | --- |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `52cc53b9ab5182974fdfcf1d3bcb980e4f8e3069e56558497692880e5dc4b67e` | READ_FULL |
| `project-memory/decisions/deterministic-context-only.md` | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` | READ_FULL |
| `project-memory/decisions/http-crud-efficiency-design-redlines.md` | `f0a075710211cbd62147d53a4bac6f7f9404755bf9d5b52f206e66c15f8ec34e` | READ_FULL |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `9d2903a17c1d71738f530fe00f0abdedf99b2d5370ce6219e63ce1fc082381f1` | READ_FULL |
| `project-memory/decisions/owner-read-model-and-lifecycle-standard.md` | `7f303041fc1799f7491abb9ada3c4bbb5ae5c5cb9da77b93ca08c6e7c3cb60e9` | READ_FULL |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` | READ_FULL |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` | READ_FULL |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | READ_FULL |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | READ_FULL |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | READ_FULL |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` | READ_FULL |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9` | READ_FULL |
| `project-memory/operations/business-corpus-parked-domain-intake.md` | `739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e` | READ_FULL |
| `project-memory/pitfalls/designing-from-conversation-not-system.md` | `18f43e56f97f53f9124bd05aedc458d94abdd210922a79cefa7e3fb8304daddf` | READ_FULL |
| `project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md` | `8236548a682e0ec408b34d6a4d99c64b95fe784fbbda300ad6d84f8f379726b7` | READ_FULL |
| `project-memory/pitfalls/platform-detail-reverse-inference.md` | `15d5751ddd44465e744b392095961ed4841e0d52cf7686e4447514e0d1383c4b` | READ_FULL |
| `project-memory/practices/collection-boundary-modes.md` | `7e1b7c4bd9b568aaeac810a8e4b5ee2b03e89348ede83383d5d2e69f7d79b0b1` | READ_FULL |
| `project-memory/practices/ordering-only-for-consumer-facing.md` | `b99739901809665421077bc973acd184854a8285f1b5e6e1b5f1d93eaa18c57f` | READ_FULL |
| `project-memory/decisions/terminal-architecture-and-stack-rulings.md` | `65e544c180c1b84e8b7d9c9da12f2fd06f8a480be00225179df2b72bcf29ab39` | READ_FULL |

## Current sales-menu design packet

| path | sha256 | read status |
| --- | --- | --- |
| `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md` | `14f22ed3612c3ca4715331a04cb505f24463d5ee47a5a7ea085a8066af8d1024` | READ_FULL |
| `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md` | `8a1325085e1029959a926bd5f3575cc70a4f057f1a1f2cb1cc86aa7671766aa8` | READ_FULL |
| `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md` | `28dc738c176f6f8f1c6e276e75df5afa5e7bd046d5da2ab6488820ea5dd921ce` | READ_FULL |
| `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md` | `3f3c43e7784a8c20d4b4a846342701e1d0f220d7a6ea1a1ebfef035ac6f15e9a` | READ_FULL |
| `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md` | `f6e2cba1b0b12e8fbf2b935aa18b3d504c8ded0d699b5b01c44b17038b2cd3e9` | READ_FULL |

## Templates and standards

| path | sha256 | read status |
| --- | --- | --- |
| `doc/decisions/templates/implementation-design-template.md` | `7b1b2da048c7761540e58666986382476bc50273e9964f871c21f13f2293ac03` | READ_FULL |
| `doc/decisions/templates/ia-design-template.md` | `062925f8aa4b3446e06e74d8bad4166f3b3b3e8b18ebe403df7184acd5cd358f` | READ_FULL |
| `doc/decisions/templates/ui-interaction-design-template.md` | `75cb8c22042f2d9e0f8a8b121e96952d226a7efc4e73184d2b75ecfd8e642e51` | READ_FULL |
| `doc/decisions/templates/journey-decision-template.md` | `57a99ca1fea405cd04857779b0661c7fcfed66b9f5095450f2cd73cc8441230d` | READ_FULL |
| `doc/platform/review-standard.md` | `0fbd59cbec9b849b232b522fde390c97867efb17d5d4815e01f9cbfcc7578aaf` | READ_FULL |
| `doc/platform/backend-coding-standard.md` | `4076003f71e1205525978fdacc3c4bc9b4610445677fbd4d5666a13cb1ae62a7` | READ_FULL |
| `doc/platform/frontend-coding-standard.md` | `fcea879dff8a4a3003b22c650568cdbe2daf3bf3f0575c289b12bea0927dad83` | READ_FULL |
| `doc/platform/foundation-charter.md` | `f54b882baf4fa85f91d4c75e15aff4d4574e9c9374c276113484ed013ab24455` | READ_FULL |
| `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` | `0386869f576f4ea2207e130101ea035c2b4e310e8956d49bb77d78a44eee7c0a` | READ_FULL |
| `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md` | `fee1f6a0417916d5fa6e38c2f5925c65eb2d26f9bb112d375216f96250ab0777` | READ_FULL |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5` | READ_FULL |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` | READ_FULL |
| `doc/platform/browser-l2-execution-standard.md` | `742132ff6f7e47e4f60a304e8cec443a592192a51d1ae6b184496a3b899d4796` | READ_FULL |

## Owning source samples reopened before independent verdict

| path | sha256 | read status |
| --- | --- | --- |
| `scripts/generate/edge-codegen.mjs` | `e15449c77f769df046fb2edab3cc3c8fb1b7db0d3bd5e44d3ee8c394a6a16a5c` | READ_RELEVANT_OWNING_SOURCE |
| `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` | `92c6114c0a4567e63535dfd24402932bf16aea6bcd35ea51d983717c2a98f323` | READ_RELEVANT_OWNING_SOURCE |
| `scripts/dev/profiles/r5-full.json` | `37630d8e960fb98a647e3057205ef854290681d64c34abe768bcd676ee7fc88e` | READ_FULL |
| `scripts/dev/r5-complete-seed-executor.mjs` | `f0b0650e8f27e7bee95c41f8a492dc3713cdd30e184c1d761d0381d39286eb86` | READ_RELEVANT_OWNING_SOURCE |
| `scripts/dev/r5-complete-seed-executor.test.mjs` | `40ee1475fd00e3dd2c4345538c6423b18787e7d7dd32af7200fdd6fc0b37952c` | READ_RELEVANT_OWNING_SOURCE |
| `scripts/dev/external-collaboration-business-channel-seed-plan.mjs` | `922369dedd708cb6f838c4b4a05e0d516fe508dba917ce5c4e949f2bc04a0002` | READ_RELEVANT_OWNING_SOURCE |
| `scripts/dev/external-collaboration-business-channel-seed-executor.mjs` | `3b0e117505dc35a4b63b436db9342234273a316c8491366586f129c7999bcc4c` | READ_RELEVANT_OWNING_SOURCE |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemBasicEditor.tsx` | `4682b219ce25a908800a59bc3ef48110def8a1e24da090941a352944a5a45107` | READ_RELEVANT_OWNING_SOURCE |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/useCatalogWorkbenchReadModel.tsx` | `514dc8df32817068df4fcd7588efe47169d3fafee314e0c4261898e811a12d33` | READ_RELEVANT_OWNING_SOURCE |
| `libraries/frontend/admin-ui-foundation/src/index.ts` | `5f7da60b936f88ece57e00a08628787404999ba9d3bdd0193972d56739984312` | READ_FULL |
| `libraries/frontend/admin-ui-foundation/src/list/cursorPagination.tsx` | `4ee9ab0fa477864d0dc59385477c48fe86a8aa25a44b1a4be90aa83397dfd553` | READ_FULL |
| `libraries/frontend/admin-ui-foundation/src/list/useCursorStack.ts` | `ec6b1a827b1c748ba03b0360ce0e55cedb9d727f6ce949db396b9ae5566dbba9` | READ_FULL |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java` | `c236a70a80eb4e705465405312782860615d08914aba97e6ecf0be0178add677` | READ_RELEVANT_OWNING_SOURCE |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java` | `8565555702aeebd065f632e014812ede6359e1bb7cc42ab7a84d166ca78fdccb` | READ_RELEVANT_OWNING_SOURCE |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/AssetAcceptanceScenarios.java` | `7fb0447b45c22b8470c1583b58809f02ba63b91cd45e8e89f27fa08825be7681` | READ_RELEVANT_OWNING_SOURCE |

## Existing source absence checks

| pattern / target | result | read status |
| --- | --- | --- |
| production `SalesMenu` / `sales-menu` owner in `apps/backend`, `apps/frontend`, `contracts`, `scripts` | No existing production sales-menu owner located; current design is new-owner implementation-facing design | SCANNED |
| generated catalog asset stage/release contract and operation bindings | Existing catalog asset stage request carries actual context through `dataNodeRef`; used as comparison for sales-menu asset design gap | READ_RELEVANT_OWNING_SOURCE |
| current business-channel seed INTERNAL channel instances | No real INTERNAL channel instance in current seed source; design now requires adding true INTERNAL DINE_IN and TAKEAWAY instances | READ_RELEVANT_OWNING_SOURCE |

## Post-independent-verdict Round 1 closure inputs

| path | sha256 | read status |
| --- | --- | --- |
| `doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-claude.md` | `e2bca579606ed3a954c8ba432fd2d8e7fa5077d72586838f055f71bac73d09fd` | READ_FULL_AFTER_INDEPENDENT_VERDICT |
| `doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-intake-claude.md` | `73360e0d2bc0952dbe7e4e274ae61d2d06b3b2ab29370215285a7f76a0e28348` | READ_FULL_AFTER_INDEPENDENT_VERDICT |

## Prohibited work confirmation

- Repository writes: NOT_DONE
- Git commands: NOT_DONE
- Testcontainers/backend-acceptance execution: NOT_DONE
- Browser L2 execution: NOT_DONE
- DEV start/stop/reset/seed: NOT_DONE
- UAT/deploy: NOT_DONE
- File modifications: NOT_DONE


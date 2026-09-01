# v2s sales-menu DESIGN review Round 1 input checklist

targetPath=doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-input-checklist-claude.md  
REVIEW_CYCLE_ID=SALES-MENU-DESIGN-2026-09-01  
REVIEW_TARGET=DESIGN  
ACTION_1_VARIANT=1-B 文档提取  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
reviewerAgentId=01a058bd-69fd-7a11-b30b-f9a043548fbf  
artifactTranscription=MAIN_AGENT_VERBATIM_FROM_INDEPENDENT_SUBAGENT  
blindReviewDeclaration=独立 verdict 前未读取作者对账或作者 intake  
authorMaterialReadAfterIndependentVerdict=false  
writePolicy=NO_REPOSITORY_WRITE_BY_REVIEWER_DUE_READ_ONLY_SUPERIOR_CONSTRAINT  
gitPolicy=NO_GIT_RUN  
dynamicPolicy=NO_TESTCONTAINERS_NO_L2_NO_DEV_NO_RESET_NO_SEED_NO_UAT_NO_DEPLOY  
recallCommand=scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact architecture --trigger task-start  
recallCommandExecuted=true  
recallCommandOutputSaved=SESSION_OUTPUT_CAPTURED_ONLY_NO_REPOSITORY_FILE_WRITE_DUE_READ_ONLY_SUPERIOR_CONSTRAINT  
overallMinimalInputFullRead=true  
MINIMAL_INPUTS_ALL_FULLY_READ=true

## 1. Required repository entry and governance inputs

| item | actualPath | sha256 | completeReadStatus | source/sample anchors |
| --- | --- | --- | --- | --- |
| 仓根 AGENTS | AGENTS.md | 5caa9b1724eb678dfe5ebb48a96a8290ae8747d36920c072fdc404fa9009dcc6 | READ_FULL | collaboration/git boundary; Roadmap authorization-only; implementation/review discipline; dynamic evidence boundary |
| Platform blueprint | PLATFORM-BLUEPRINT.md | b5b9b5110c9e7d8642b81ea885cbe8580aef2e1f042c710dc5bce590538f6fe7 | READ_FULL | single deployable; owner/schema/transaction boundary; two-admin boundary |
| Claude entry | CLAUDE.md | 5d6ca2f45578c8664b3e8f3743be17c99c1de9c67f764a1382cb89e2219e26c5 | READ_FULL | Claude handoff/review expectations |
| Review skill | .agents/skills/cs-review/SKILL.md | 5533b184854b47441e41f549a10724cc3ec5b0eea76a7fbf907a4022e34b3c42 | READ_FULL | DESIGN uses 1-B extraction; evidence tier discipline; no dynamic/Git actions |
| Platform document entry | doc/platform/README.md | b978e9cf851b8c4829a0c69ef16f4492164e9e6583ca62582618f13fe0912c80 | READ_FULL | registry-first Roadmap selection |
| Roadmap registry | doc/platform/roadmap-program-registry.json | f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8 | READ_FULL | active program V2S_W0_W4_EXECUTION |
| selected Roadmap authorization | doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md | not recomputed in final hash batch | READ_FULL | ROADMAP_SCOPE=AUTHORIZATION_ONLY; current task truth is Dexter direct assignment; R5 runtime/seed flags do not override current user prohibition |
| project-memory kernel index | project-memory/index.md | 549818b4e90dd17b054710c29f7f3b2e0d2c81cb262e7f624c53e095a25c63e5 | READ_FULL | kernel navigation; routed memory command executed separately |
| scripts entry | scripts/README.md | 2b950eaf6e508c67406d7a012610a8763b743553c1438e7fb6f300f4a4462a6a | READ_FULL | DEV/start/seed/reset separation; backend-acceptance and browser-L2 boundaries |

## 2. Required sales-menu design inputs

| item | actualPath | sha256 | completeReadStatus | source/sample anchors |
| --- | --- | --- | --- | --- |
| sales-menu requirements | doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md | 14f22ed3612c3ca4715331a04cb505f24463d5ee47a5a7ea085a8066af8d1024 | READ_FULL | store-only menu; INTERNAL DINE_IN/TAKEAWAY; multi-menu; draft/published split; inventory/manual sale-state split; copy exclusions |
| sales-menu IA | doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md | 8a1325085e1029959a926bd5f3575cc70a4f057f1a1f2cb1cc86aa7671766aa8 | READ_FULL | single page; menu manager; publish copy; cursor pagination; accessibility/focus |
| sales-menu UI interaction | doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md | 28dc738c176f6f8f1c6e276e75df5afa5e7bd046d5da2ab6488820ea5dd921ce | READ_FULL | UI-01 to UI-31 interaction flow and copy constraints |
| implementation-facing design | doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md | 56f2ac9b52835eb13217792c077ed70ebb2a6055db0a6ef095ac68d7457ac79b | READ_FULL | §5 operation list; §9 owner APIs; §10b seed; §11 acceptance/L2; §12 unresolved |
| implementation plan | doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md | 1442fdfd78f51d16c56f56f97371308caf3116647003b9325035e33515ccfed2 | READ_FULL | SM-00 through SM-13 execution ordering and proof claims |
| originally requested template path | doc/plans/platform/implementation-design-template.md | MISSING | NOT_READ_FILE_DOES_NOT_EXIST | `test -f` returned 1; not marked read |
| canonical implementation template | doc/decisions/templates/implementation-design-template.md | 7b1b2da048c7761540e58666986382476bc50273e9964f871c21f13f2293ac03 | READ_FULL | §9a full synchronization denominator; §10b seed; §11 scenarios; §13b staged and whole-batch reconciliation |
| template directory same-root scan | doc/decisions/templates/ | N/A_DIRECTORY | READ_LISTING | contains ia-design-template.md, implementation-design-template.md, journey-decision-template.md, ui-interaction-design-template.md |

## 3. Required platform standards and decisions

| item | actualPath | sha256 | completeReadStatus | source/sample anchors |
| --- | --- | --- | --- | --- |
| backend coding standard | doc/platform/backend-coding-standard.md | 4076003f71e1205525978fdacc3c4bc9b4610445677fbd4d5666a13cb1ae62a7 | READ_FULL | owner API, transaction/idempotency/CAS/audit/log, generated-chain constraints |
| frontend coding standard | doc/platform/frontend-coding-standard.md | fcea879dff8a4a3003b22c650568cdbe2daf3bf3f0575c289b12bea0927dad83 | READ_FULL | RTK currentData/isFetching; no server fact mirroring; Drawer/list/foundation behavior |
| foundation charter | doc/platform/foundation-charter.md | f54b882baf4fa85f91d4c75e15aff4d4574e9c9374c276113484ed013ab24455 | READ_FULL | ordered collection and capability/foundation boundaries |
| backend-acceptance scenario standard | doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md | 0386869f576f4ea2207e130101ea035c2b4e310e8956d49bb77d78a44eee7c0a | READ_FULL | real HTTP; CONTRACT/BUSINESS split; correct owner scenario file; no provider/registry revival |
| observability and acceptance standard | doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md | fee1f6a0417916d5fa6e38c2f5925c65eb2d26f9bb112d375216f96250ab0777 | READ_FULL | structured diagnostics; managed manifest; firstFailure/lastKnownGood/brokenBoundary; cleanup separate |
| verification governance | doc/decisions/2026-07-24-v2s-verification-governance.md | 6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5 | READ_FULL | static/HTTP/L2/DEV evidence separation; backend API before L2 before DEV seed |
| independent subagent review governance | doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md | 108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3 | READ_FULL | blind review; checklist; author material after independent verdict only; two-round limit |
| browser L2 execution standard | doc/platform/browser-l2-execution-standard.md | 742132ff6f7e47e4f60a304e8cec443a592192a51d1ae6b184496a3b899d4796 | READ_FULL | only managed L2; no DEV/seed reuse; fixture/run lifecycle; generated source of truth |
| active managed runtime/seed standards from recall/rg | AGENTS.md; scripts/README.md; doc/platform/browser-l2-execution-standard.md; doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md; doc/decisions/2026-07-24-v2s-verification-governance.md | see rows above | READ_FULL_FOR_CANONICALS | current review did not execute dynamic runtime; standards used only to classify evidence boundaries |

## 4. Six-dimensional recall project-memory originals

recallCommand=scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact architecture --trigger task-start  
recallRefCount=19  
recallProjectMemoryOriginalsAllReadFull=true

| # | recall id | path | sha256 | completeReadStatus | key anchors applied |
| ---: | --- | --- | --- | --- | --- |
| 1 | decisions.confirmed-business-language-corpus | project-memory/decisions/confirmed-business-language-corpus.md | 52cc53b9ab5182974fdfcf1d3bcb980e4f8e3069e56558497692880e5dc4b67e | READ_FULL | G-05A authorization; G-08 disabled store blocks menu publish; G-11 menu/sales collection; G-12 inventory/sale-state boundary |
| 2 | decisions.deterministic-context-only | project-memory/decisions/deterministic-context-only.md | c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263 | READ_FULL | no provider/daemon; prompt recommends only; retired compliance-control traceability |
| 3 | decisions.http-crud-efficiency-design-redlines | project-memory/decisions/http-crud-efficiency-design-redlines.md | f0a075710211cbd62147d53a4bac6f7f9404755bf9d5b52f206e66c15f8ec34e | READ_FULL | set-based reads; generated operation path only; operation DB shape; correctness before DB efficiency |
| 4 | decisions.independent-subagent-adversarial-review | project-memory/decisions/independent-subagent-adversarial-review.md | 9d2903a17c1d71738f530fe00f0abdedf99b2d5370ce6219e63ce1fc082381f1 | READ_FULL | independent subagent required; blind review first; checklist required |
| 5 | decisions.owner-read-model-and-lifecycle-standard | project-memory/decisions/owner-read-model-and-lifecycle-standard.md | 7f303041fc1799f7491abb9ada3c4bbb5ae5c5cb9da77b93ca08c6e7c3cb60e9 | READ_FULL | owner returns business facts; no backend display assembly; cascade status derived not stored; disabled stays editable |
| 6 | kernel.contract-admin | project-memory/kernel/04-contract-consumer-and-admin.md | 1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d | READ_FULL | x-consumer-faces only; two admin apps; owner rechecks command; ambiguity requires Dexter |
| 7 | kernel.evidence-runtime | project-memory/kernel/05-evidence-runtime-and-git.md | 254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8 | READ_FULL | log-first retry; business/cleanup separate; DEV start no seed; no Git write |
| 8 | kernel.heritage-change | project-memory/kernel/06-heritage-and-change.md | 5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c | READ_FULL | heritage read-only; no runtime fallback; new decision for drift |
| 9 | kernel.service-owner | project-memory/kernel/02-service-shape-and-owner.md | 45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032 | READ_FULL | one business deployable; module owner sovereignty; coordinator no asset |
| 10 | kernel.transaction-data | project-memory/kernel/03-transaction-data-and-dependencies.md | f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44 | READ_FULL | one DB multi-schema; one Flyway history; REQUIRED transaction; task read join; no polling |
| 11 | kernel.workspace-roadmap | project-memory/kernel/01-workspace-and-roadmap.md | f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63 | READ_FULL | program-scoped current only; Git by Dexter; R3-J02 pending recovery |
| 12 | operations.business-corpus-adoption-and-read-policy | project-memory/operations/business-corpus-adoption-and-read-policy.md | d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9 | READ_FULL | corpus read policy; G-05A authorization implementation discipline |
| 13 | operations.business-corpus-parked-domain-intake | project-memory/operations/business-corpus-parked-domain-intake.md | 739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e | READ_FULL | parked future domains; no automatic trigger or inferred answer |
| 14 | pitfalls.designing-from-conversation-not-system | project-memory/pitfalls/designing-from-conversation-not-system.md | 18f43e56f97f53f9124bd05aedc458d94abdd210922a79cefa7e3fb8304daddf | READ_FULL | check existing capability before describing behavior |
| 15 | pitfalls.invisible-dimension-drifts-at-implementation | project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md | 8236548a682e0ec408b34d6a4d99c64b95fe784fbbda300ad6d84f8f379726b7 | READ_FULL | invisible dimensions need performable observation; cross-doc exactness |
| 16 | pitfalls.platform-detail-reverse-inference | project-memory/pitfalls/platform-detail-reverse-inference.md | 15d5751ddd44465e744b392095961ed4841e0d52cf7686e4447514e0d1383c4b | READ_FULL | platform details stay in adapter; do not reverse-infer main model |
| 17 | practices.collection-boundary-modes | project-memory/practices/collection-boundary-modes.md | 7e1b7c4bd9b568aaeac810a8e4b5ee2b03e89348ede83383d5d2e69f7d79b0b1 | READ_FULL | choose Detail/Bounded/Page/Cursor first; cursor must be real; over-page fixture |
| 18 | practices.ordering-only-for-consumer-facing | project-memory/practices/ordering-only-for-consumer-facing.md | b99739901809665421077bc973acd184854a8285f1b5e6e1b5f1d93eaa18c57f | READ_FULL | ordering only for consumer-facing content; menu/menu items need ordering |
| 19 | decisions.terminal-architecture-and-stack-rulings | project-memory/decisions/terminal-architecture-and-stack-rulings.md | 65e544c180c1b84e8b7d9c9da12f2fd06f8a480be00225179df2b72bcf29ab39 | READ_FULL | TER same governance; terminal scope not used to infer sales-menu implementation |

## 5. Sampled production/owning-source anchors

| source area | actualPath | sha256 | completeReadStatus | source/sample anchors |
| --- | --- | --- | --- | --- |
| contract/generated chain | scripts/generate/edge-codegen.mjs | e15449c77f769df046fb2edab3cc3c8fb1b7db0d3bd5e44d3ee8c394a6a16a5c | READ_RELEVANT_ANCHORS | `canonicalOperationCount = 180`; `assertCanonicalOperationIdentity(catalog)` |
| business-channel edge | apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java | fb5101398be50dab64e3de7190c2a29ac9b813965762c638ec0f154d2fb5f042 | READ_RELEVANT_ANCHORS | `storeChannels(...)`; no current `usage/cursor/pageSize` on store channel route |
| business-channel owner read API | apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelReadApi.java | d110e78007aad328c050d7ba235a2ea032e157bdc03f3e8dac6da54ec343020e | READ_RELEVANT_ANCHORS | `pageChannels(...)` has no usage/cursor/pageSize; candidate template read does |
| business-channel owner service | apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java | 7bbc60e522638ad3161377b23cee1d47f019c003dc01c84fac5c88f6ca1086fb | READ_RELEVANT_ANCHORS | `BOUNDED_READ_LIMIT`; bounded channel read; `nextCursor=null`; template candidate cursor implementation exists |
| business-channel readback | apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelReadback.java | 898e0d78a9b09a62437f4bc4400096e8a79c338ac992dbaec655f74ecd3cc421 | READ_RELEVANT_ANCHORS | `ChannelPage(List<Channel> items, String nextCursor, long total)` |
| catalog image UI reuse | apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemBasicEditor.tsx | 4682b219ce25a908800a59bc3ef48110def8a1e24da090941a352944a5a45107 | READ_RELEVANT_ANCHORS | `CatalogAssetEditor`; image upload/sort interaction can be extracted/reused |
| browser L2 runner | scripts/test/browser-l2-runtime.mjs | 10d452abba5d1bbdcd529710dff120c93686b1d6b571e6255b27dbe1d9818304 | READ_RELEVANT_ANCHORS | catalog-specific fixture/scenario/binding paths; single runner boundary |
| browser L2 entry | scripts/test/browser-l2 | not separately hashed | READ_FULL | imports `main` from `browser-l2-runtime.mjs` |
| complete seed parent | scripts/dev/r5-complete-seed-executor.mjs | f0b0650e8f27e7bee95c41f8a492dc3713cdd30e184c1d761d0381d39286eb86 | READ_RELEVANT_ANCHORS | `COMPLETE_SEED_STAGE_IDS`; `validateCompleteSeedEvidence`; `const catalog = stages[1]` |
| r5-full seed profile | scripts/dev/profiles/r5-full.json | 37630d8e960fb98a647e3057205ef854290681d64c34abe768bcd676ee7fc88e | READ_FULL | `components`: owner-command, catalog-inventory only |
| business-channel seed plan | scripts/dev/external-collaboration-business-channel-seed-plan.mjs | 922369dedd708cb6f838c4b4a05e0d516fe508dba917ce5c4e949f2bc04a0002 | READ_RELEVANT_ANCHORS | TAKEAWAY templates/channels are EXTERNAL; DINE_IN templates are INTERNAL |
| business-channel seed executor | scripts/dev/external-collaboration-business-channel-seed-executor.mjs | 3b0e117505dc35a4b63b436db9342234273a316c8491366586f129c7999bcc4c | READ_RELEVANT_ANCHORS | static-only executor; not runtime seed proof |

## 6. Blind-review exclusions

| excludedPath | status | reason |
| --- | --- | --- |
| doc/review/platform/2026-09-01-v2s-sales-menu-design-author-reconciliation-codex.md | NOT_READ | blind review requires independent verdict before author material; user explicitly continued without reading it |
| any author intake | NOT_READ | user prohibited reading author intake |
| any future Round 1 intake/reconciliation | NOT_READ | user prohibited reading future Round 1 intake; none was needed |
| Git metadata/history | NOT_READ_NOT_RUN | user prohibited Git and superior read-only critic role did not require it |
| Testcontainers/L2/DEV/reset/seed/UAT/deploy runtime output | NOT_RUN | dynamic actions prohibited; evidence tier remains static/source-only |

## 7. Input completeness conclusion

MINIMAL_INPUTS_ALL_FULLY_READ=true

Reasons:

1. The canonical template `doc/decisions/templates/implementation-design-template.md` is fully read and hashed.
2. The originally supplied path `doc/plans/platform/implementation-design-template.md` does not exist and is honestly recorded as missing, not as read.
3. Core required repository entry files, sales-menu documents, selected Roadmap, standards, active L2/runtime/seed canonical standards, and scripts entry were read.
4. The six-dimensional recall command was executed with the specified route.
5. All 19 `project-memory` originals returned by the recall command were individually opened and read to completion.
6. Owning production/source files were sampled at the exact claims under review; this remains source-sampling, not full implementation audit.

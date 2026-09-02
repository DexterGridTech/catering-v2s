# SM-05 sales-menu.copy-current-draft-boundary · fresh independent stage reconciliation

REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION
SCOPE=SM-05 sales-menu.copy-current-draft-boundary
REVIEWER=Codex fresh independent stage reconciler
DATE=2026-09-02

FINAL_STAGE_VERDICT=PASS
STAGE_ALLOWED=YES

This verdict allows only the next focused SM-05 family to start. It does not allow full SM-05 closure, SM-06, browser L2, DEV, reset, seed, UAT, deployment, or the formal two-round `REVIEW_TARGET=IMPLEMENTATION` verdict.

## Blind review declaration

I did not rely on author summaries, prior agent verdicts, or existing reconciliation conclusions as proof. I reopened current repository bytes, current source, contract/generated output, the evidence ledger, and the managed run archives directly. I did not run managed dynamic infrastructure and did not edit implementation, generated, contract, test, plan, or evidence-ledger files.

## Inputs reopened

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/README.md`
- `scripts/README.md`
- `doc/platform/review-standard.md`
- `.agents/skills/cs-review/SKILL.md`
- `.agents/skills/cs-memory-recall/SKILL.md`
- `.agents/skills/cs-managed-runtime-execution/SKILL.md`
- `project-memory/index.md`
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/operations/backend-acceptance.md`
- `project-memory/operations/test-closed-loop.md`
- `project-memory/decisions/owner-read-model-and-lifecycle-standard.md`
- `project-memory/decisions/http-crud-efficiency-design-redlines.md`
- `project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md`
- `project-memory/operations/phase-retrospective-and-systemic-repair.md`
- `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`
- `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`
- `scripts/context/recall-memory --task-kind review --domain backend --consumer-face backend --owner backend --impact evidence --trigger review`
- `scripts/context/recall-memory --task-kind review --domain contract --consumer-face operations-admin --owner contract --impact contract --trigger review`
- `scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact architecture --trigger review`
- `scripts/context/recall-memory --task-kind testing --domain backend --consumer-face backend --owner backend --impact cleanup --trigger review`
- `scripts/context/recall-memory --task-kind implementation --domain backend --consumer-face backend --owner backend --impact database --trigger implementation`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`
- `doc/evidence/platform/2026-09-01-v2s-sales-menu-implementation-evidence-codex.md`
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/infrastructure/JdbcSalesMenuRepository.java`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemMediaFacts.java`
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuAssetCommandFacade.java`
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuAssetCommandApi.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/OperationsSalesMenuController.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuWireMapper.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/SalesMenuDetail.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/SalesMenuSummary.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/salesmenu/application/operations/CopyOperationsSalesMenuOperation.java`
- `contracts/openapi-source/sales-menu.schemas.json`
- `contracts/openapi/components/sales-menu/sales-menu.schemas.json`
- `contracts/registry/generated/operation-handler-bindings/sales-menu.json`
- `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302703361-68736/run-manifest.json`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302703361-68736/backend-acceptance-result.jsonl.gz`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302703361-68736/http-request-events.jsonl.gz`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302703361-68736/db-operation-events.jsonl.gz`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302703361-68736/statement-dictionary.json.gz`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302703361-68736/evidence-artifacts.tsv`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302703361-68736/gradle.log`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302105529-57450/run-manifest.json`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302105529-57450/backend-acceptance-result.jsonl.gz`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302105529-57450/http-request-events.jsonl.gz`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302105529-57450/db-operation-events.jsonl.gz`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302105529-57450/statement-dictionary.json.gz`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302105529-57450/evidence-artifacts.tsv`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302105529-57450/gradle.log`

## Approved target facts

- IA says copy creates `原菜单名 副本`, automatically selects the new copy, uses the source current draft as baseline, copies sections/items/order/catalog and SKU choices/display override/listed price/constraints/menu schedule, creates an independent draft, defaults disabled, and does not copy publication/snapshot/records/inventory/manual-sale facts or source activation relation: `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md:233-238`.
- UI interaction says the same copy rule and forbids mutually-exclusive wording such as “切换” or “设为当前生效”: `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md:143-145`.
- Implementation design says nullable `activation` means no menu-channel relation and default disabled; CUSTOM media copy reuses ordered opaque `assetRef` relation rows, does not clone Asset/file/object, and does not call Asset stage/claim/release: `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md:267-273,613-650`.
- Implementation plan requires copy to be real commands, not fixture-only expected results, and to assert identical source/copy `assetRef`s with no Asset row/object/lifecycle change and no clone/stage/claim/release call: `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md:491-495`.

## Current source facts

- `SalesMenuOwnerService.copy` is `@Transactional(REQUIRED)`, requires grant, locks/checks source menu, performs CAS, creates a new collection UUID and draft UUID, inserts the copy collection, inserts a `DRAFT` version with `source.draftSchedule()`, sets `current_draft_version_ref`, calls `copyDraft(source.salesMenuRef(), copy, draft)`, records success, and writes receipt: `SalesMenuOwnerService.java:467-506`.
- `SalesMenuOwnerService.copyDraft` resolves `UUID sourceVersion = draftVersion(source)`, not published version; creates fresh section UUIDs and item UUIDs; copies source draft section rows, source draft item rows, SKU rows, and media relation rows into the target draft; media copy is `INSERT INTO sales_menu.sales_version_item_media(... asset_ref, display_order) VALUES (...)`: `SalesMenuOwnerService.java:1370-1453`.
- `copyDraft` does not write `sales_collection_activation`, `sales_publication`, `sales_manual_status_current`, `sales_manual_status_event`, inventory tables, `platform_asset.staged_asset`, or `platform_asset.sales_menu_asset_target`; it does not call Asset stage/claim/release APIs. The Asset claim path is separate in `claimStagedAssets`, used for whole-save CUSTOM image binding, not copy: `SalesMenuOwnerService.java:2504-2578`.
- `JdbcSalesMenuRepository.find` reads the current draft via `current_draft_version_ref` and joins latest published as nullable LEFT JOIN only for read model facts: `JdbcSalesMenuRepository.java:39-66,117-131`.
- `CatalogItemMediaFacts.insertForCopy` is the Catalog precedent: it writes ordered `catalog.catalog_item_image(item_ref, asset_ref, display_order)` relation rows and does not call Asset owner/object/lifecycle APIs: `CatalogItemMediaFacts.java:62-75`.
- `SalesMenuAssetCommandApi` exposes stage/release/claim lifecycle commands, and `SalesMenuAssetCommandFacade` delegates those to Platform Asset owner. `copyDraft` does not use this boundary: `SalesMenuAssetCommandApi.java:10-28`, `SalesMenuAssetCommandFacade.java:21-110`.

## Contract and generated output facts

- Contract source marks `SalesMenuSummary.activation` and `SalesMenuDetail.activation` as required properties whose value may be JSON `null`: `contracts/openapi-source/sales-menu.schemas.json:24-37,50-65`.
- Generated OpenAPI component preserves nullable activation: `contracts/openapi/components/sales-menu/sales-menu.schemas.json:59-104,140-193`.
- Backend generated wire records accept nullable `SalesMenuActivation activation`: `SalesMenuDetail.java:4-16`, `SalesMenuSummary.java:4-13`.
- Backend mapper returns JSON null for missing activation: `SalesMenuWireMapper.java:46-58,171-173`.
- Frontend generated type is `activation: (SalesMenuActivation) | null`: `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts:1851-1863`.
- Copy route is generated/bound as `POST /api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus/{salesMenuRef}/copies`, owner command, `REQUIRED` transaction, adapter `CopyOperationsSalesMenuOperation`, dispatch `copyOperationsSalesMenu`: `contracts/registry/generated/operation-handler-bindings/sales-menu.json:45-58`; controller route delegates to the generated command binding with expectedVersion: `OperationsSalesMenuController.java:273-288`; operation adapter delegates to owner copy in a REQUIRED transaction: `CopyOperationsSalesMenuOperation.java:10-20`.

## Acceptance oracle facts

`SalesMenuAcceptanceScenarios.copyCurrentDraftBoundary` is a hand-written real HTTP oracle, not a fixture-only assertion:

- It creates source draft content, publishes an older value, sets activation, applies manual sold-out, then changes the current draft item to price `3100` and CUSTOM media with two staged/claimed image refs: `SalesMenuAcceptanceScenarios.java:316-413`.
- It checks the source current draft CUSTOM media order before copy: `SalesMenuAcceptanceScenarios.java:414-442`.
- It executes real HTTP `copyOperationsSalesMenu` and asserts the new menu ref differs from source: `SalesMenuAcceptanceScenarios.java:448-462`.
- It reads copy detail and asserts name `sourceName + " 副本"`, current draft schedule, `activation` JSON null, and no latest published revision: `SalesMenuAcceptanceScenarios.java:464-479`.
- It reads the copy published sections endpoint and asserts typed 404 `PUBLICATION_NOT_FOUND`: `SalesMenuAcceptanceScenarios.java:481-487`.
- It reads copy draft sections/items and asserts copied item ref differs from source item ref, current draft price is `3100`, CUSTOM mode is preserved, ordered assetRefs are identical, and primary ref is identical: `SalesMenuAcceptanceScenarios.java:488-543`.
- It reads copy records and asserts publication/manual-sale operations were not copied, then rereads source published item and asserts source manual-sale state remains `MANUAL_SOLD_OUT`: `SalesMenuAcceptanceScenarios.java:545-567`.

The oracle does not compare source section ref to copied section ref directly, but current source closes that proof: `copyDraft` creates each copied section with `UUID.randomUUID()` and stores a source-section to target-section map before inserting target section rows: `SalesMenuOwnerService.java:1370-1390`.

## Managed run archive facts

Latest managed run:

```text
RUN_PATH=.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302703361-68736/
RUN_ID=r5-tc-1788302703361-68736
STARTED_AT=2026-09-01T22:45:03.361Z
COMPLETED_AT=2026-09-01T22:46:32.949Z
TASK=:apps:backend:catering-business-server:test
VERIFICATION_MODE=ACCEPTANCE
SOURCE_SYNC=PASS
TEST_EXECUTION=PASS
BUSINESS=PASS
STATUS=PASS
FIRST_FAILURE=null
CLEANUP_STATUS=PASS
REMOTE_PROCESS=PASS
REMOTE_WORKSPACE=PASS
TESTCONTAINERS_CONTAINERS=PASS
TESTCONTAINERS_VOLUMES=PASS
DEV_WAS_RUNNING=false
GRADLE_LOG=BUILD SUCCESSFUL in 51s
```

Latest `backend-acceptance-result.jsonl.gz` has:

```json
{"operation":"sales-menu.copy-current-draft-boundary","discovered":99,"type":"discovery","selected":1}
{"module":"SALES_MENU","business":"PASS","contract":"PASS","businessMode":"REAL","businessAssertion":"HAND_WRITTEN_BUSINESS_ORACLE","status":"PASS","operation":"sales-menu.copy-current-draft-boundary","dbOperations":44}
```

Latest HTTP archive facts:

- `copyOperationsSalesMenu` request is `req-267d36ba-211b-4096-9415-313318a56b15`, status `201`, `databaseOperationCount=39`, `logicalStatementCount=39`, `transactionBeginCount=4`, `sqlOperationCount=27`, `outcome=SUCCEEDED`, `suspects=[]`.
- Post-copy reads include `getOperationsSalesMenu` status `200`, `getOperationsSalesMenuPublishedSections` status `404`, `getOperationsSalesMenuDraftSections` status `200`, `getOperationsSalesMenuDraftItem` status `200`, and `getOperationsSalesMenuPublishedItem` status `200`.
- This HTTP archive intentionally does not include response bodies. It proves route/operation/status/request/database-count completion facts, not JSON body content. JSON body semantics are proved by the hand-written Java oracle that executed in the same selected managed run, plus current source/contract/static evidence.

Latest request-scoped DB facts for `req-267d36ba-211b-4096-9415-313318a56b15`:

- It locks the sales-menu receipt, reads source menu with `current_draft_version_ref` and nullable latest-published LEFT JOIN, reads the command receipt, performs CAS, inserts new `sales_collection`, inserts new `sales_collection_version` DRAFT with schedule, updates target `current_draft_version_ref`, reads source `current_draft_version_ref`, reads source draft sections, writes one new `sales_section`, writes one new `sales_version_section`, reads source draft items/SKUs/media, writes one new `sales_item`, writes one new `sales_version_item`, writes two new `sales_version_item_media` rows, performs authoritative readback, writes operation record, writes command receipt, and commits.
- It contains no statement against `sales_menu.sales_collection_activation`.
- It contains no statement against `sales_menu.sales_publication`.
- It contains no statement against `sales_menu.sales_manual_status_current` or `sales_menu.sales_manual_status_event`.
- It contains no inventory table statement.
- It contains no statement against `platform_asset.staged_asset` or `platform_asset.sales_menu_asset_target`.
- It contains no Asset stage, claim, release, target clone, object clone, or lifecycle statement.

Latest archive integrity:

- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302703361-68736/evidence-artifacts.tsv` lists `http-request-events.jsonl`, `backend-acceptance-result.jsonl`, `db-operation-events.jsonl`, and `statement-dictionary.json`.
- `run-manifest.json` records evidence archive status `PASS`.

Preserved first-failure run:

```text
RUN_PATH=.runtime/r5/evidence/remote-testcontainers/r5-tc-1788302105529-57450/
RUN_ID=r5-tc-1788302105529-57450
STARTED_AT=2026-09-01T22:35:05.529Z
COMPLETED_AT=2026-09-01T22:36:32.541Z
TASK=:apps:backend:catering-business-server:test
VERIFICATION_MODE=ACCEPTANCE
SOURCE_SYNC=PASS
TEST_EXECUTION=FAIL
BUSINESS=FAIL
STATUS=FAIL
FIRST_FAILURE=REMOTE_GRADLE_EXIT_NONZERO
CLEANUP_STATUS=PASS
REMOTE_PROCESS=PASS
REMOTE_WORKSPACE=PASS
TESTCONTAINERS_CONTAINERS=PASS
TESTCONTAINERS_VOLUMES=PASS
GRADLE_LOG=BackendAcceptanceTest > backendAcceptanceScenarios() > sales-menu.copy-current-draft-boundary [SALES_MENU] FAILED; BUILD FAILED in 51s
```

Preserved first-failure `backend-acceptance-result.jsonl.gz` has:

```json
{"type":"discovery","selected":1,"operation":"sales-menu.copy-current-draft-boundary","discovered":99}
{"businessMode":"REAL","failure":"BUSINESS:_copy_has_no_activation_relation_and_is_therefore_default_disabled_==>_expected:_<true>_but_was:_<false>","business":"FAIL","status":"FAIL","operation":"sales-menu.copy-current-draft-boundary","contract":"PASS","dbOperations":28,"module":"SALES_MENU","failureCategory":"BUSINESS_ORACLE","businessAssertion":"HAND_WRITTEN_BUSINESS_ORACLE"}
```

The first failure is preserved and not overwritten. The latest source/contract/oracle behavior closes it by proving `activation` is required nullable JSON null, not a fabricated disabled activation relation.

## 11-dimension reconciliation table

| # | Dimension | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | behavior | MATCHED | `copy()` uses source aggregate current draft schedule and `copyDraft()`. `copyDraft()` resolves `draftVersion(source)` and copies current draft rows. Acceptance oracle proves copied value `3100`, daily schedule, absent publication, null activation, and unchanged source manual-sale fact. |
| 2 | surface/form | MATCHED | Approved surface is a manager-row copy action producing `原菜单名 副本` and selected independent draft. Backend route is `POST .../sales-menus/{salesMenuRef}/copies`; oracle asserts name `sourceName + " 副本"`. No unsupported UI/browser proof is claimed for this backend stage. |
| 3 | actions | MATCHED | Copy is a real generated owner command via controller → generated binding → `CopyOperationsSalesMenuOperation` → `SalesMenuOwnerService.copy`. Archive shows one HTTP `copyOperationsSalesMenu` status `201`. |
| 4 | relationships | MATCHED | New collection/version/section/item identities are generated. Activation relation is not copied or fabricated. CUSTOM media relation points to the same opaque ACTIVE `assetRef`s in order. Copy records do not copy publication/manual history. Source business facts remain unchanged; source aggregate version CAS advances as command-control state, not as copied business content. |
| 5 | placement | MATCHED | Route placement is operations-admin, store-scoped sales-menu copy path. Operation binding records face `operations-admin`, owner `sales-menu`, transaction `REQUIRED`, command boundary `OWNER_COMMAND`. |
| 6 | user-visible copy | MATCHED | IA/UI require `原菜单名 副本`, default disabled via no activation relation, and no “切换/设为当前生效” semantics. Backend oracle asserts the generated copy name; UI copy is not dynamically exercised in this stage and is not overclaimed. |
| 7 | limits | MATCHED | Copy scope is limited to current draft definition/schedule and media relation rows. It does not copy published snapshot, operation records, inventory, manual state/history, activation relation, Asset object/file/lifecycle, or Catalog item. CUSTOM media count/size rules belong to stage/update paths; copy reuses already ACTIVE refs only. |
| 8 | state/control | MATCHED | Operation receipt/readback exists and returns `copyOperationsSalesMenu`; typed 404 absence for no publication is `PUBLICATION_NOT_FOUND`; source manual-sale state remains on source publication. Business PASS and cleanup PASS are separate in latest manifest. |
| 9 | failure/recovery | MATCHED | Preserved first failure remains in `r5-tc-1788302105529-57450` with business FAIL/cleanup PASS. Latest run `r5-tc-1788302703361-68736` has firstFailure null, business PASS, cleanup PASS, archive PASS. |
| 10 | accessibility/focus | MATCHED_N_A_WITH_REASON | This focused backend stage has no browser/UI focus execution. Static IA/UI rules require manager drawer/focus behavior, but this stage only validates copy backend semantics and does not claim browser accessibility proof. |
| 11 | data source/invalidation | MATCHED | `JdbcSalesMenuRepository.find` reads current draft and nullable latest-published facts; `copyDraft` reads source draft sections/items/SKUs/media and writes target owner-local rows. Post-copy authoritative reads validate copy detail/draft item/published absence/source published state. Archive response bodies are omitted, so body content is proved by Java oracle plus source/contract, not by HTTP archive payloads. |

OPEN_COUNT=0

## Explicit falsification checks

| Check | Verdict | Disposition |
| --- | --- | --- |
| 1. Copy reads current draft definition and schedule, not published snapshot. | CONFIRMED | `copyDraft` uses `draftVersion(source)`; copy version uses `source.draftSchedule()`; oracle proves copied price `3100` after older published value `2800` and daily schedule. |
| 2. New menu/item/section identities are independent. | CONFIRMED | `copy()` uses new collection/draft UUIDs; `copyDraft` uses new section/item UUIDs; oracle asserts menu and item refs differ; section independence is statically proven by `UUID.randomUUID()` mapping. |
| 3. Copy has no source activation relation; representation is nullable activation JSON null, not fabricated DISABLED. | CONFIRMED | `copy()`/`copyDraft` contain no activation insert; read model maps absent activation to null; source/component/frontend generated contract is nullable; oracle asserts `activation.isNull()`. |
| 4. No publication/latest published revision, inventory or manual-sale state/history is copied; source remains unchanged. | CONFIRMED | Source code and request DB statements contain no publication/manual/inventory copy. Oracle asserts `latestPublishedRevision` null, published sections 404, copy records exclude publish/manual operations, and source published manual state remains `MANUAL_SOLD_OUT`. Source collection version advances by CAS as command control, not copied business content. |
| 5. CUSTOM media uses same ordered opaque ACTIVE assetRefs and primary ref as source. | CONFIRMED | Source CUSTOM refs are staged and claimed before copy; source draft read confirms order; copy draft item read asserts same primary/secondary refs and same primary ref. |
| 6. CUSTOM copy is Catalog-style relation-only: no Asset/object/staged row/target/lifecycle clone and no stage/claim/release during copy; source static owner boundary and request-scoped DB/HTTP evidence agree. | CONFIRMED | `copyDraft` only writes `sales_version_item_media` relation rows; latest copy request DB has two media relation inserts and no platform_asset/stage/claim/release/target/object statements; Catalog `insertForCopy` confirms precedent relation-only semantics. |
| 7. Operation receipt/readback and typed 404 absence semantics are accurate. | CONFIRMED | Controller/operation/source write receipt/readback; oracle asserts command operation `copyOperationsSalesMenu`; post-copy published sections GET returns 404 with `PUBLICATION_NOT_FOUND`. |
| 8. Business and resource cleanup are separate and PASS; preserved first failure is not erased. | CONFIRMED | Latest manifest: business PASS, cleanup PASS, firstFailure null. First-failure manifest/result remain present at `r5-tc-1788302105529-57450`, business FAIL, cleanup PASS. |
| 9. Current nullable contract and generated outputs match JSON null behavior. | CONFIRMED | OpenAPI source/component nullable activation, backend Java wire nullable reference, mapper null branch, frontend generated `SalesMenuActivation | null`. |
| 10. No unsupported claim is made from an archive that intentionally omits response bodies. | CONFIRMED | This reconciliation treats HTTP archive as route/status/count/request proof only. Body semantics are attributed to the hand-written Java oracle executed in the managed run and corroborated by current source/contract. |
| 11. Stage may proceed only if every scoped mismatch is closed. | CONFIRMED | All 11 dimensions are MATCHED or MATCHED_N_A_WITH_REASON; OPEN_COUNT=0. |

## Findings and dispositions

| Finding | Status | Disposition |
| --- | --- | --- |
| F-01: Copy might accidentally copy the published snapshot instead of current draft. | REJECTED_WITH_EVIDENCE | Source `copyDraft` resolves `draftVersion(source)` and oracle proves updated draft value `3100` rather than published `2800`. |
| F-02: Copy might reuse source menu/section/item identities. | REJECTED_WITH_EVIDENCE | Source generates new collection/draft/section/item UUIDs; oracle proves menu and item independence; section independence is static source proof. |
| F-03: Copy might fabricate a disabled activation row. | REJECTED_WITH_EVIDENCE | Source and request-scoped DB contain no activation write; generated/schema/mapper support JSON null; oracle asserts null activation. |
| F-04: Copy might copy publication, latest published revision, inventory, manual-sale state, or source history. | REJECTED_WITH_EVIDENCE | Source and request DB omit those writes; oracle asserts no latest publication, typed 404 for published sections, no copied publish/manual record, and source manual status unchanged. |
| F-05: Copy might clone Asset/object/lifecycle instead of reusing opaque refs. | REJECTED_WITH_EVIDENCE | Source and request DB show only menu media relation inserts; no Asset lifecycle statements or API calls exist in copy path. |
| F-06: Archive might be overclaimed as JSON body proof. | CONFIRMED | The HTTP archive omits response bodies. The body proof is the real HTTP Java oracle and current source/contract, not archived payload bodies. |
| F-07: First failure might have been erased. | REJECTED_WITH_EVIDENCE | Preserved first-failure run directory and result remain readable with business FAIL and cleanup PASS. |
| F-08: Accessibility/focus may be unproven by this backend stage. | CONFIRMED | It is intentionally `MATCHED_N_A_WITH_REASON`; this stage does not claim browser focus proof. |

No OPEN finding remains. Therefore no minimum implementation fix is required for this scoped stage. If a future reviewer treats “source remains unchanged” as including every technical metadata column, the only observed qualifier is that source aggregate `version` advances through CAS for command control; the business definition/publication/activation/manual/inventory facts are not modified or copied.

## Final gate

STAGE_ALLOWED=YES

Only the next focused SM-05 family may start. Full SM-05 closure, SM-06+, browser L2, DEV, reset, seed, UAT, deployment, and the formal implementation review remain outside this stage verdict.

# V2S Sales Menu SM-05 Ordered Sections and Items Stage Reconciliation

REVIEW_KIND=FRESH_INDEPENDENT_STAGE_RECONCILIATION  
SCOPE=SM-05 sales-menu.ordered-sections-and-items  
reviewerKind=INDEPENDENT_SUBAGENT  
REVIEW_ROUND=不适用（步骤级对账，不是正式 REVIEW_TARGET review）  
blindReviewDeclaration=本轮先以证伪为立场重开当前字节、项目记忆、设计/计划、owning source 与既有 run archive；未采信作者结论或 run PASS 作为自动闭环。  
FINAL_STAGE_VERDICT=OPEN  
STAGE_ALLOWED=NO  
SM-05_ALLOWED=NO  
SM-06_ALLOWED=NO

## INPUTS

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `scripts/README.md`
- `doc/platform/README.md`
- `doc/platform/roadmap-program-registry.json`
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`
- `project-memory/index.md`
- `scripts/context/recall-memory`
- memory routes actually run:
  - `scripts/context/recall-memory --task-kind implementation --domain platform --consumer-face operations-admin --owner product --impact governance --trigger implementation`
  - `scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact governance --trigger review`
  - `scripts/context/recall-memory --task-kind backend-acceptance --domain backend --consumer-face backend --owner backend --impact evidence --trigger review`
  - `scripts/context/recall-memory --task-kind implementation --domain backend --consumer-face backend --owner contract --impact contract --trigger implementation`
- reopened project-memory hits:
  - `project-memory/kernel/01-workspace-and-roadmap.md`
  - `project-memory/kernel/02-service-shape-and-owner.md`
  - `project-memory/kernel/03-transaction-data-and-dependencies.md`
  - `project-memory/kernel/04-contract-consumer-and-admin.md`
  - `project-memory/kernel/05-evidence-runtime-and-git.md`
  - `project-memory/kernel/06-heritage-and-change.md`
  - `project-memory/decisions/confirmed-business-language-corpus.md`
  - `project-memory/decisions/deterministic-context-only.md`
  - `project-memory/decisions/http-crud-efficiency-design-redlines.md`
  - `project-memory/decisions/owner-read-model-and-lifecycle-standard.md`
  - `project-memory/decisions/independent-subagent-adversarial-review.md`
  - `project-memory/operations/backend-acceptance.md`
  - `project-memory/operations/test-closed-loop.md`
  - `project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md`
  - `project-memory/practices/collection-boundary-modes.md`
  - `project-memory/practices/ordering-only-for-consumer-facing.md`
  - `project-memory/practices/read-model-granularity.md`
  - `project-memory/practices/set-interaction-not-n-times-single.md`
- `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`
- `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`
- `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`
- owning source and contract:
  - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuCommandApi.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/domain/SalesMenuMoveDirection.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/domain/SalesMenuPageRequest.java`
  - `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/domain/SalesMenuCursorIdentity.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/OperationsSalesMenuController.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuEdgeSupport.java`
  - `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
  - `contracts/openapi/components/sales-menu/sales-menu.schemas.json`
- latest managed run archive:
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788303723535-86967/run-manifest.json`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788303723535-86967/evidence-artifacts.tsv`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788303723535-86967/http-request-events.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788303723535-86967/db-operation-events.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788303723535-86967/backend-acceptance-result.jsonl.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788303723535-86967/statement-dictionary.json.gz`
  - `.runtime/r5/evidence/remote-testcontainers/r5-tc-1788303723535-86967/gradle.log`

No dynamic infrastructure, Testcontainers, DEV, reset, seed, browser, implementation edit, contract edit, generated edit, test edit, plan edit, or existing ledger edit was run.

## Run archive integrity

Archive integrity is MATCHED.

- `run-manifest.json` declares `backendAcceptance.operation=sales-menu.ordered-sections-and-items`, `business=PASS`, `status=PASS`, `testExecution.status=PASS`, `cleanup.status=PASS`, `firstFailure=null`, `measurementEvidence.status=PASS`, `unclassifiedSqlOperations=0`.
- `backend-acceptance-result.jsonl.gz` raw SHA-256 recomputed as `423a92f9ac8977cb0b3e6748dd77d9860625d834c6c4735ce687ac7eb9badf05`, archive SHA-256 as `aea6d8910d57429845f4813026258c882a3d520fca6c05dc5a07b6903cacfadf`, matching manifest and TSV.
- `http-request-events.jsonl.gz` raw SHA-256 recomputed as `d70a646b6d5fd760b27b8021049cb1f3d94eb57736b27880aaaaa583cc8760db`, archive SHA-256 as `64ddd618f358452720c81531e464e1e90b3462611a6d562e330a07d0eba862db`, matching manifest and TSV.
- `db-operation-events.jsonl.gz` raw SHA-256 recomputed as `897657b87518b2cca3dcae7208a3842b68727f41d5923f9ad05fc64b876162d1`, archive SHA-256 as `8061ef3503a5c61b04390ace514e74dd0f44c4c773f280cc7f8e31c529fd2838`, matching manifest and TSV.
- `statement-dictionary.json.gz` raw SHA-256 recomputed as `71deabeb8f5d57aa3a6348113c69bc0cff5703e24069bfae6aa21c7191041059`, archive SHA-256 as `70c8455e079662ef17c1b4627a990675e8bff197d38685155bf5c35fb0e53872`, matching manifest and TSV.
- HTTP archive records `requestBody=false` and `responseBody=false` for the relevant sales-menu operations. Therefore archive is request/operation/measurement proof only; body-level ordering and identity proof must come from the hand-written oracle in `SalesMenuAcceptanceScenarios.java` and current source, not from archived HTTP bodies.
- Relevant sales-menu HTTP events in archive: 25 total; status counts 17×200, 6×201, 2×409; operation counts include 2 candidate reads, 6 draft-item reads, 5 section reads, create/rename/move/delete section, add items, and move item. Unclassified SQL total for sales-menu events is 0.
- `gradle.log` ends with `BUILD SUCCESSFUL in 50s`.

## 11-dimension reconciliation

| Dimension | Result | Evidence |
| --- | --- | --- |
| behavior | OPEN | Candidate and draft-item 20+1 behavior is proven by scenario assertions. Section and item order mutation/no-mutation behavior has oracle gaps listed in OPEN-01 and OPEN-02. |
| surface/form | MATCHED_N_A_WITH_REASON | This focused artifact is backend-only acceptance plus source reconciliation. The approved UI surface exists in requirements/IA/UI design, but no browser/UI source or L2 proof is in scope. Backend routes are operations-admin sales-menu routes in `OperationsSalesMenuController`. |
| actions | OPEN | Contract/source limit move direction to `UP`/`DOWN`, and scenario exercises rename/move/delete/add. However action outcome readbacks for section and item moves are not fully asserted; see OPEN-01 and OPEN-02. |
| relationships | OPEN | Source creates one new `sales_item_ref` UUID per add, and the scenario proves two rows with the same catalog item. The focused oracle does not assert the two returned `salesItemRef` identities are distinct; see OPEN-03. |
| placement | MATCHED_N_A_WITH_REASON | UI placement is specified in IA/UI design, but SM-05 focused run is backend-only and cannot prove placement/browser layout. No drag/drop placement is introduced in backend contract or source. |
| user-visible copy | MATCHED_N_A_WITH_REASON | Backend source contains typed problem codes/messages (`SECTION_NOT_EMPTY`, `MOVE_NOT_ALLOWED`), but UI row-menu labels/copy are not browser-proven in this backend-only stage. |
| limits | MATCHED | `SalesMenuEdgeSupport.page` enforces pageSize 20; `SalesMenuPageRequest` requires pageSize 20; owner/candidate SQL uses keyset predicates and `LIMIT pageSize+1` / `LIMIT 21`, no OFFSET; archive statement dictionary shows candidate and draft-item keyset SQL without OFFSET. |
| state/control | OPEN | Expected-version command flow and transactional owner mutation exist, but focused oracle does not fully prove post-reject/post-move stable state; see OPEN-01 and OPEN-02. |
| failure/recovery | MATCHED | Non-empty section delete and first-item UP move return 409 typed failures in scenario and archive; archive has business PASS, cleanup PASS, firstFailure null, unclassified SQL 0. |
| accessibility/focus | MATCHED_N_A_WITH_REASON | IA/UI design requires keyboard/focus behavior for row menus, but backend-only acceptance/archive cannot prove browser focus or accessibility. This stage must not masquerade as browser L2. |
| data source/invalidation | MATCHED | Owner readbacks come from sales-menu owner and catalog owner; cursor identity includes operation/scope/store/channel/menu/version/section/filter/pageSize; no total-count closure, OFFSET, or client slicing is used in owner implementation. |

## Focused counterchecks

- 21 real candidates: MATCHED. Scenario creates 21 catalog items, reads first candidate page at pageSize 20, asserts 20 and nonblank cursor, reads second page, asserts 1, and checks all created catalog item refs appear across both pages.
- 21 draft items: MATCHED. Scenario adds 21 items, reads first draft-item page at pageSize 20, asserts 20 and nonblank cursor, reads second page, asserts 1.
- Same catalog item in two sections: OPEN. Source creates separate UUID-backed sales items for each add, but the focused oracle only asserts two rows with the same `catalogItemRef`; it does not assert distinct `salesItemRef` values.
- Three-section full order, rename/move, non-empty delete reject/no mutation, empty delete: OPEN. Scenario only asserts initial count/name and post-reject count; it does not assert full post-rename/post-move sequence, exact post-reject unchanged section identity/order/name, or post-empty-delete remaining order.
- Item first UP typed reject/no mutation and DOWN authoritative readback: OPEN. Scenario asserts typed 409 for UP, then performs DOWN and only asserts the final list has more than one item; it does not read back unchanged order after rejected UP, nor assert the moved item changed position after DOWN.
- Only UP/DOWN, no drag/drop: MATCHED for backend. `SalesMenuMoveDirection` and OpenAPI move request enums contain only `UP` and `DOWN`; no drag/drop operation exists in the backend contract/source inspected.
- No OFFSET/client slice/auto-drain/total-count fake closure: MATCHED for owner/backend source and archive SQL. Backend acceptance test uses explicit cursor requests as an oracle helper; no product client auto-drain is proven or introduced here.
- Current run CONTRACT/BUSINESS/cleanup/archive/measurement/unclassified SQL/first failure layering: MATCHED. Manifest/result/archive show CONTRACT PASS, BUSINESS PASS, cleanup PASS, archive PASS, measurement PASS, unclassified SQL 0, firstFailure null.
- Backend-only UI placement/copy/accessibility boundary: MATCHED_N_A_WITH_REASON. This stage cannot prove browser L2; placement/copy/accessibility remain N/A for this backend-only proof.

## OPEN findings

### OPEN-01 — Section lifecycle oracle does not prove full order/readback/no-mutation closure

- Owning source: `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java:631-641`, `703-722`; supporting owner source `SalesMenuOwnerService.java:596-649`, `1851-1885`.
- Evidence: scenario asserts three sections and first name before rename/move; after `renameSection(second)` and `moveSection(second, DOWN)`, it attempts non-empty delete and only asserts post-reject section count is still 3. It then deletes the third section without an explicit post-delete readback assertion.
- Falsifiable failure condition: a broken implementation could rename the wrong section, move the wrong section, reorder sections incorrectly, mutate section names/order during rejected non-empty delete, or leave the empty section undeleted while preserving a count that still satisfies the current oracle.
- Minimum fix: in the focused scenario, capture section refs/names/order before mutation; after rename+move assert the exact sequence and renamed identity; after 409 non-empty delete assert the same exact refs/names/order and relevant item counts; after empty delete assert the target empty section is absent and remaining section order is stable.
- Why smaller alternative is insufficient: asserting only response status/readback command version or row count cannot distinguish wrong identity, wrong order, or hidden mutation.

### OPEN-02 — Item move oracle does not prove rejected-UP no mutation or DOWN authoritative readback

- Owning source: `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java:724-745`; supporting owner source `SalesMenuOwnerService.java:1780-1849`, `1888-1947`.
- Evidence: scenario asserts `MOVE_NOT_ALLOWED` for moving the first item `UP`, then immediately moves the same item `DOWN`; final readback only asserts item list size is greater than one and that the original item version was positive. It does not read back after rejected `UP`, and it does not assert the item moved from index 0 to index 1, that the previous neighbor moved to index 0, or that no item was duplicated/lost.
- Falsifiable failure condition: a broken implementation could mutate order during the rejected UP then still accept DOWN, no-op the DOWN, move the wrong item, or duplicate/drop rows while returning a nontrivial list.
- Minimum fix: capture at least the first two `salesItemRef` values and the full reachable item identity set before boundary move; after the 409 `UP`, read back and assert exact unchanged sequence/version; after `DOWN`, read back and assert the former first item is at index 1, the former second item is at index 0, and the reachable identity set is unchanged.
- Why smaller alternative is insufficient: command readback does not include authoritative ordered rows, and list size/version positivity does not prove reorder semantics.

### OPEN-03 — Duplicate catalog item oracle does not assert distinct SalesItemRef identities

- Owning source: `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/SalesMenuAcceptanceScenarios.java:659-701`; supporting owner source `SalesMenuOwnerService.java:654-711`.
- Evidence: owner implementation generates a fresh UUID and inserts a `sales_menu.sales_item` row for each catalog item add. The scenario gathers first-section and second-section draft item rows and asserts two rows share the same `catalogItemRef`, but it does not assert `duplicateRows.map(salesItemRef).distinct().count()==2`. HTTP archive has no response body, so the archive cannot independently prove the two returned identities.
- Falsifiable failure condition: a serialization, read-model, or persistence regression could surface two rows tied to the same catalog item without proving two distinct stable `salesItemRef` identities to the consumer.
- Minimum fix: in the focused scenario, assert the two duplicate rows have distinct nonblank `salesItemRef` values and retain their section identities.
- Why smaller alternative is insufficient: counting duplicate catalog refs proves duplicate rows, not independent sales-item identity.

## Static/source matches retained despite OPEN verdict

- Candidate pagination uses catalog owner keyset cursor: `CatalogOwnerService.readSalesMenuCandidatePage` builds cursor identity from operation/data node/brand/category/filter/pageSize, applies `i.code > ? OR (i.code = ? AND i.item_ref > ?)`, orders by `i.code,i.item_ref`, and limits to page size + 1.
- Draft item pagination uses sales-menu owner keyset cursor: `SalesMenuOwnerService.pagedItemRows` binds operation/scope/channel/menu/version/section/mode/pageSize, applies display-order + sales-item-ref frontier, orders by `v.display_order,v.sales_item_ref`, and limits to page size + 1.
- Section and item moves use adjacent-swap SQL under `FOR UPDATE`; item adjacency is constrained to the current section.
- Move directions are exactly `UP` and `DOWN` in both domain enum and OpenAPI schemas.
- Typed failure codes are exercised in the scenario and archive: `SECTION_NOT_EMPTY` and `MOVE_NOT_ALLOWED`.

## Stop condition

Stopped after the verdict became evidence-backed from current source plus the verified archive boundary. Further closure requires implementation/test edits, which are outside this read-only stage-reconciliation authorization.

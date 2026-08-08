# Catalog / Inventory P3 implementation remediation — independent static review

REVIEW_CYCLE_ID: `CATALOG-INVENTORY-P3-IMPLEMENTATION-REMEDIATION-20260807`
REVIEW_TARGET: `IMPLEMENTATION`
REVIEW_ROUND: `1`
REVIEW_ROUND_LIMIT: `2`
reviewerKind: `INDEPENDENT_SUBAGENT`
ROUND_FINAL_DECISION: `N/A (round 1)`

## Verdict

`NO-GO` for implementation closure. The static implementation has eight M findings (seven `CONFIRMED`, one `PARTIALLY_CONFIRMED`) and two confirmed S findings. The M findings cross the owner/contract/IA boundary and must be dispositioned before claiming P3 implementation readiness. This review is static only: no Spring runtime, HTTP/API, database, seed/reset, browser L2, tunnel, or cleanup execution was performed, so it makes no P4/API/L2/business/cleanup PASS claim.

Summary: `M=8` (`7 CONFIRMED + 1 PARTIALLY_CONFIRMED`), `S=2`, `N=0`.

## Blind review declaration

This is a fresh independent subagent review. I did not read any prior Claude verdict, prior independent verdict, or prior evidence conclusion before forming these findings. The review re-opened the approved requirements, IA, three-stage design, current production source, generated/edge contract, policy bindings, and focused L2 source directly. No source or test file was changed by this review.

## Input manifest (path + sha256)

| Input | SHA-256 |
|---|---|
| `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` |
| `PLATFORM-BLUEPRINT.md` | `3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d` |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md` | `21cfaa7ce6dced47d932db2ee9ea2d58bcbbe5b0ad2585dde7fa2829d4c9067a` |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md` | `08be6b7b232e5bc220d5e2e79841e6a4dee0a7df965dbc71e49ceb3942101354` |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md` | `a31a558b19bf41f6eed48093bc86895e01d1c400adae0c4185e633c00742f00b` |
| `contracts/catalog/CatalogInventoryShapeManifest.java` | `71e4963789f626f84d6258028c4e803b9cf72ce67beea5f517e45a2334c1aaee` |
| `contracts/openapi/components/fulfillment-production/production-tag.schemas.yaml` | `fb6e219c8478577b906f319dbdfb6d5719648ba5b23bee99beb29038853ea549` |
| `contracts/policy/catalog-inventory-l2-locator-bindings.json` | `99494cf7251f1318309ecf53d5d629daf3a81e58385fa3b568fc9e976ca1de4d` |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java` | `8bf1cf405cb4e894d827e1472e26bd23ffdb7e7e108b16e5da488918f62a27f3` |
| `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java` | `64dbed006173be723e0e2470dc66cf21b9d612ce8d9e051676c9799e17013a4c` |
| `apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java` | `9504a672c382a640532f3af816e0e7e77a8f2932f0a1070ad3641611a1f16f89` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx` | `51d1f44504baf94aa46956ef18e8e8f3ade5d5fb73a0827952d10c0ceda7a425` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx` | `2ee9f0dd17b21779c41c6d63b1c3a443a9e4f9cb74b19a08f13aaa1b6f3f6c9d` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx` | `fce32c154808a428d42caf1e93ed3fcb3a55cb3e631c1158ec9005d50273d5d7` |
| `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryDetailDrawer.tsx` | `4e9f23f22adc14660c0e802a65c6100c14ba1a6c6a7c555798a5991f85b937fb` |
| `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx` | `87431e4f6134059da097f2e092db96d017c3fa28be56a98adbc9848de77be518` |
| `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx` | `69cc7a596b740530420066bb0ce396c466ed46e2e5bfcebc83ab98e501b68bb1` |
| `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts` | `8f6dde0162bbdf817501168aa76a77fb42ee87334829475651e557d6682e6663` |

## Findings

### M-01 — Shape-derived fields are not enforced by the catalog owner

Status: `CONFIRMED`

The requirements require the backend to derive `itemKind`, `measureMode`, `usageCapabilities`, and `skuMode` from the persisted `shapeKey`; clients must not supply those derived values. The IA repeats this as `IA-CONTRACT-002`, and the manifest marks `backendMustRecheck=true`.

Evidence: `CatalogOwnerService.createItem()` inserts `sections='{}'` without deriving any fields (`CatalogOwnerService.java:485-492`). `saveItem()` copies client draft fields into JSON without recomputation or shape-rule validation (`CatalogOwnerService.java:495-520`). `itemDetail()` then supplies generic defaults (`itemKind=CATALOG_ITEM`, `measureMode=NO_SKU`, `usageCapabilities=[SELLABLE]`) when fields are absent (`CatalogOwnerService.java:718-726`). For example, a newly created `MATERIAL` can read as sellable/no-SKU instead of `STANDARD_ITEM/COUNTED/[STOCK_MANAGED,BOM_COMPONENT]/NONE`.

Impact: owner truth and the generated shape contract can drift; inventory/BOM admission and read-only UI summaries can be wrong. This is a backend owner defect even though P3 consumes the resulting read model.

Required disposition: derive/recheck from the frozen manifest in the catalog owner on create/save/readback, reject conflicting client fields, and add focused red coverage for every shape including `MATERIAL` and `SKU_VARIANT_SALE_COUNTED`.

### M-02 — Product keyword search and list summary omit `shortName`

Status: `CONFIRMED`

`IA-CAT-LIST-012` and the requirements define the product search as code/name/short name, with short name visible in the compact identity cell.

Evidence: the catalog query predicate only uses `i.name` and `i.code` (`CatalogOwnerService.java:361-363`); `itemSummary()` always emits `shortName: null` (`CatalogOwnerService.java:678-684`). The editor can persist a short name, but the list cannot search it and the list model cannot display it.

Impact: a required list query dimension is non-functional and the primary compact identity cell loses a governed fact.

Required disposition: include the persisted short-name fact in the owner query predicate and summary projection, then add a focused test proving a short-name-only match and visible readback.

### M-03 — UI creates a generation token but never applies a response acceptance guard

Status: `PARTIALLY_CONFIRMED`

The IA requires scope/tree identity and generation on request and response, with stale responses rejected after rapid node/brand changes. The page calls `generation.begin()` on brand/tree changes (`CatalogWorkbenchPage.tsx:61,129-137,207`), but the list request does not carry a generation value (`CatalogWorkbenchPage.tsx:78-88`) and the response path only decodes RTK `currentData` (`CatalogWorkbenchPage.tsx:92-97`); there is no `generation.accept` (or equivalent response identity check) in the file.

Impact: the source does not implement the specified last-response-wins acceptance contract. Whether RTK argument isolation masks every race requires runtime L2 evidence, which was intentionally not run; the static implementation requirement is nevertheless missing.

Required disposition: bind generation/query identity into the request and accept only matching scope, tree, and generation responses; add a deterministic focused test plus the approved CI-L2-002/016 race evidence.

### M-04 — CI-L2-014 uses a locator that no implementation renders

Status: `CONFIRMED`

The P3 design makes CI-L2-014 part of the 43-case exit and the policy binding names `inventory-action-modal` as the bound surface.

Evidence: the L2 scenario opens the target and then clicks `page.getByTestId('inventory-action-open').first()` (`apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts:122-126`). No `inventory-action-open` test id exists in the operations-admin source. The actual four action controls are `inventory-action-count`, `inventory-action-increase`, `inventory-action-adjust`, and `inventory-action-configure` (`InventoryDetailDrawer.tsx:118-124`); `inventory-action-modal` is rendered only by the modal itself (`InventoryActionModal.tsx:188`, reviewed by source search).

Impact: the scenario cannot reach its bound modal, so at least the CI-L2-014 journey is statically impossible and the 43-case exact-set/green claim is blocked.

Required disposition: replace the opener with the approved action locator(s) and make the scenario explicitly cover the four-action/result contract; do not add a hidden test-only opener.

### M-05 — Production tags have no `tagKind` across owner, contract, or UI

Status: `CONFIRMED`

`IA-CAT-DICT-004` requires six contract `tagKind` values, lifecycle, reference count, and display of the type; the merged requirements also make `tagKind` a closed contract enum and a copy compatibility discriminator.

Evidence: `ProductionTagOwnerService` selects/inserts/updates only `code`, `name`, `status`, and version (`ProductionTagOwnerService.java:29-34,96-109`). `ProductionTagCreateRequest` exposes only `dataNodeRef`, `code`, and `name` (`contracts/openapi/components/fulfillment-production/production-tag.schemas.yaml:168-188`), and the UI create/update surface has no tag-kind control or field (`CatalogDictionaryDrawer.tsx:39-69,140-148`).

Impact: the six-type production governance contract cannot be represented, stopped-tag selection cannot be typed, and copy preflight cannot compare the required semantic discriminator.

Required disposition: add the closed `tagKind` enum to the owner schema/read/write/copy paths and generated client, expose it in the independent production-tag surface, and add focused negative coverage for kind mismatch.

### M-06 — Brand copy does not build or apply the required stock-target mapping

Status: `CONFIRMED`

The requirements require a complete `(objectType, sourceRef) -> targetRef` map, including inventory objects and BOM-line component refs, with no source-owner refs remaining in the target graph.

Evidence: catalog closure contains only catalog items, categories, and dictionary rows (`CatalogOwnerService.java:871-892`), while `STOCK_TARGET` edges are explicitly excluded from the catalog owner leak assertion (`CatalogOwnerService.java:1150-1156`). Inventory copy then inserts `stock_bom.rows` verbatim from source to target (`InventoryOwnerService.java:98-112`), with no stock-target-ref rewrite. The post-copy assertion only scans owner/scope keys such as `ownerRef` and `dataNodeRef`, not BOM `targetRef` mappings (`InventoryOwnerService.java:284-304`).

Impact: a copied store BOM can still point at the source owner's stock target, violating owner isolation and the explicit 5.6.6 copy rule. This is a P2 owner defect surfaced by the P3 package because the P3 copy preflight UI consumes this contract.

Required disposition: expand the approved closure and mapping to stock targets/SKUs/BOM owners, rewrite every BOM-line component ref before insert, and assert target stock-target identities rather than only JSON owner metadata.

### M-07 — BOM save rejects the required negative-line semantics

Status: `CONFIRMED`

The requirements explicitly allow positive and negative BOM quantities and preserve `lineSign` for add/remove/replace semantics.

Evidence: `saveCatalogProductBom()` rejects every quantity with `signum() <= 0` (`InventoryOwnerService.java:259-266`) before normalizing `lineSign` (`InventoryOwnerService.java:269-273`). A valid negative replacement/removal line therefore cannot be persisted.

Impact: the owner cannot represent the approved BOM merge semantics, making both the item editor and copy/readback contract incomplete.

Required disposition: validate non-zero quantity with sign/line-sign consistency instead of requiring positive quantities, and add focused positive/negative/replace coverage.

### M-08 — Two-level category invariant exists only as a UI affordance

Status: `CONFIRMED`

`IA-CAT-CATEGORY-002` requires a two-level maximum and typed blocking when a move would place any descendant deeper than level two.

Evidence: the UI disables “new child” only when the current node already has a parent (`CatalogWorkbenchPage.tsx:146-149`), but still exposes move. The catalog owner `createCategory()` and `moveCategory()` persist `parent_code` after only duplicate/cycle/version checks; there is no depth or descendant-depth validation (`CatalogOwnerService.java:554-557`).

Impact: a caller can create or move a category tree beyond the governed two-level shape through the owner command, after which the UI can no longer guarantee the approved tree contract.

Required disposition: enforce depth and descendant-depth in owner commands with a typed failure and retain the UI guard as a convenience only.

### S-01 — Inventory SKU identity falls back to code instead of the catalog SKU name

Status: `CONFIRMED`

The inventory list requires the compact product/SKU identity, including SKU name. The owner detail readback hard-codes `productName` to `itemCode` and `skuName` to `skuCode` (`InventoryOwnerService.java:528`); the table renders SKU text only when `row.skuName` exists (`InventoryManagementPage.tsx:51-55`).

Impact: SKU rows lose their governed display name and degrade identity clarity, although the immutable SKU code remains available.

Required disposition: enrich from the catalog owner read model (or a documented task join) and add a focused SKU-name readback test.

### S-02 — VOIDED / “作废并重建” is not exposed on the implemented catalog/production-tag surfaces

Status: `CONFIRMED`

The IA requires a terminal `VOIDED` flow with blocking references, dependent facts, and a separate create-new-record “作废并重建” journey. The backend has transition support, but the implemented item drawer only renders enable/disable/archive actions (`CatalogItemDrawer.tsx:361-367`), and the dictionary surface toggles only enabled/disabled (`CatalogDictionaryDrawer.tsx:140-143`).

Impact: users cannot perform the governed correction path from the approved UI; the owner capability is not reachable in the P3 journey.

Required disposition: expose capability-driven void availability/blocking facts and the separate rebuild flow for every coded object, then bind the relevant L2 case.

## Scope boundary and next step

No dynamic execution was performed. Consequently this document intentionally does not claim API correctness, generated-client correctness at runtime, browser interaction success, business PASS, cleanup PASS, or P4 closure. The recommended next step is for the implementation owner to disposition M-01..M-08 (including the P2 owner defects) and S-01..S-02, then reopen the exact focused proofs and CI-L2-014/002/016 before a second independent review round.

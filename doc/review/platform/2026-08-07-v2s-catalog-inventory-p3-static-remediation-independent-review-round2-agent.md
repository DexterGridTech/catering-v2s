# Catalog / inventory P3 static remediation independent review — Round 2

`REVIEW_CYCLE_ID=CATALOG-INVENTORY-P3-IMPLEMENTATION-REMEDIATION-20260807`  
`REVIEW_TARGET=IMPLEMENTATION`  
`REVIEW_ROUND=2`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`  
`ROUND_FINAL_DECISION=SELF_DECIDED`

## Verdict

**NO-GO — static implementation remediation remains blocked by 2 confirmed implementation findings and 1 intentionally retained upstream contract blocker (M=3, S=0, N=0).** This is the final round for this cycle; no third independent round is permitted.

The review is static only. It makes no claim about DEV, API/HTTP, browser L2, seed/reset, remote middleware, UAT, or cleanup.

## Blind review and inputs

I did not read the previous implementation-review verdict. I independently reopened the requirements, IA, three-stage implementation design, current production source, generated contract, current P3 evidence, current P3 manifest, and locator policy before reaching this verdict.

Primary manifest: `doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-manifest.json`  
SHA-256: `8e7c9e4973dce0ca34f7f7698da3767ba63079b4d7ea81ff24010d09584d3bd3`

Other reviewed inputs and hashes:

| Input | SHA-256 |
| --- | --- |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md` | `21cfaa7ce6dced47d932db2ee9ea2d58bcbbe5b0ad2585dde7fa2829d4c9067a` |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md` | `08be6b7b232e5bc220d5e2e79841e6a4dee0a7df965dbc71e49ceb3942101354` |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md` | `a31a558b19bf41f6eed48093bc86895e01d1c400adae0c4185e633c00742f00b` |
| `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json` | `05226b7700e7636d27ec147952188fa3a4a195570ad83392b8c32e9d2920f4ac` |
| `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json` | `15c68330857e046a342d3fc4bb97802c0c8ac2ad6819f8db3d2d84bbd0a194c4` |
| `contracts/policy/catalog-inventory-l2-locator-bindings.json` | `99494cf7251f1318309ecf53d5d629daf3a81e58385fa3b568fc9e976ca1de4d` |
| `contracts/openapi/components/catalog/catalog-copy.schemas.yaml` | `492f7c13713f4555a7f2e9685d2c898b60ac4a3bc1c7a52b5894e650444d17f0` |
| `contracts/openapi/components/fulfillment-production/production-tag.schemas.yaml` | `e1bf860d773daae4f3ba20e00fe57969a21c606258cd32ba2f837db75618a4e8` |

Current source was reopened in the catalog owner, inventory owner, coordinator, operations-admin workbench/item/dictionary/local-copy surfaces, generated edge client, and focused L2 spec. `scripts/check/catalog-inventory-p3` returned `CATALOG_INVENTORY_P3_STATIC=PASS` (`pages=3`, `scenarios=18`, `cases=43`, `locatorBindings=43`). That mechanical result does not cover the two semantic findings below.

## Round-2 disposition

### R2-M01 — brand-copy inventory BOM closure omits component stock-target owners

**Status: CONFIRMED.**

The brand-copy coordinator sends `codesFrom(catalogPreflight)` to the inventory owner (`CatalogInventoryApplicationService.java:154-176`). The catalog closure only expands an optional catalog `inventoryBom[].itemCode` (`CatalogOwnerService.java:1066-1079`), while the inventory-owned BOM detail is represented by `targetRef` and the catalog `bomEntry` projection drops component identity (`CatalogOwnerService.java:920-926`). The UI also creates BOM rows with only `targetRef`, quantity, and unit (`CatalogItemDrawer.tsx:610-617`).

The inventory preflight can discover the component target by UUID (`InventoryOwnerService.java:161-170`), but it does not add that component's item code to the closure. During execution `copyRewrittenBom` requires a mapped target UUID and throws `REFERENCE_MAPPING_UNRESOLVED` when the component was not created/mapped (`InventoryOwnerService.java:339-357`). Thus a valid cross-owner BOM can pass the catalog-side closure and then fail at the owner copy boundary; the required `(objectType, sourceRef) -> targetRef` rewrite is not complete.

This violates the frozen BOM rule that cross-owner copies rewrite every stock-target BOM reference (`2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md:780-797, 915-924`). It is an implementation finding, not a runtime-only uncertainty.

### R2-M02 — category “void and rebuild” submits the voided category as the new parent

**Status: CONFIRMED.**

After a successful `VOID_REBUILD`, `CatalogWorkbenchPage.tsx:135-139` reopens `CREATE` with the old node. The shared effect at `CatalogWorkbenchPage.tsx:112-115` sets `parentCode` to `categoryAction.node.code` for every CREATE action. The form then displays the old category as the parent (`CatalogWorkbenchPage.tsx:233-238`).

The old node is already `VOIDED`; `CatalogOwnerService.java:648-656` resolves a proposed parent with `status <> 'VOIDED'` and raises `NOT_FOUND` for that code. Therefore the advertised “作废并重建分类” journey cannot create the replacement (including a root category, which is incorrectly submitted beneath the voided root). This is a deterministic source-level lifecycle failure.

### R2-M03 — TemporaryPromotion DTO blocker must remain retained

**Status: CONFIRMED; disposition: DEXTER_DECISION (retain `BLOCKED_UPSTREAM_CONTRACT`).**

The IA requires a real temporary-item completion flow—shape selection, required-data completion, formal-code/source-version preflight, and typed stale/conflict recovery (`2026-08-06-v2s-catalog-inventory-information-architecture-codex.md:416-430`). The frozen `TemporaryPromotionPreflight` contract remains limited to the existing item/source/blockedReasons/changes/digest/canPromote envelope (`contracts/openapi/components/catalog/catalog-copy.schemas.yaml:1322-1461`); the current backend still promotes by directly changing status to `DRAFT` (`CatalogOwnerService.java:687-718`).

The current evidence and IA reconciliation correctly record exactly one `BLOCKED_UPSTREAM_CONTRACT`. This blocker must not be relabeled as implemented and must not be “fixed” with a P3 local DTO or direct status toggle. Reopening the P1 contract and its owner command is a Dexter scope decision; until then it remains the single explicit upstream block.

## Closed round-1 families verified in current bytes

Static source now supports the shape-manifest-derived fields and client-derived-field rejection, short-name list filtering and summary projection, echoed `queryGeneration` plus stale-response rejection, six production-tag kinds, negative/positive BOM line validation, VOIDED action availability, and the current four inventory-action locators. The 89-control IA reconciliation is exact-set and the mechanical locator checker is green; these observations are static only and do not substitute for fresh browser evidence.

## Acceptance boundary

Because R2-M01 and R2-M02 are confirmed implementation defects, and R2-M03 is a confirmed frozen-contract blocker, this final independent verdict is **NO-GO** for closing the P3 static remediation package. The next safe action is to repair the two source defects, preserve the TemporaryPromotion block until an explicitly authorized contract decision, and then perform the separately authorized evidence/runtime gates; this review cycle itself must not be reopened for a third subagent round.

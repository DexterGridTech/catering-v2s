SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

# M-05 typed copy readback: reserved-owner follow-up

## Confirmed failure pattern

Public copy owner APIs exposed a record whose only business value was
`String canonicalJson`.  The composition and HTTP adapter then re-parsed that
opaque string after owner writes.  A missing wire field could therefore become
a post-write `RESULT_UNKNOWN`; the enclosing `REQUIRED` transaction must roll
back, but the diagnosis must remain field-specific and safe.

Finite denominator: `CatalogOwnerApi.CopyExecutionReadback`,
`InventoryOwnerApi.LocalCopyExecutionReadback`, and
`ProductionTagOwnerApi.BrandCopyExecutionReadback`, plus the four coordinator
facades that propagate those values.  The typed command readbacks outside the
copy traversal are counterexamples: they already expose named fields and are
not part of this remediation.

## Completed in this ownership slice

- The four HTTP adapters now preserve only safe missing-field diagnostics and
  throw a runtime `CatalogOwnerApi.Problem` from their `REQUIRED` transaction.
  They cannot downgrade a committed write to a 500 response.
- The focused Java test proves missing `ownerReadbacks` is retained in the
  diagnostic and arbitrary decoder text is replaced by a neutral message.

## Required follow-up in reserved files

1. In `modules/catalog/.../CatalogOwnerApi.java` and
   `CatalogOwnerService.java`, replace `CopyExecutionReadback(String
   canonicalJson)` with named owner readback fields: `preflightDigest`,
   `created`, `reused`, `skipped` (local only), `referenceMappings`,
   `targetVersions`, and `ownerReadbacks`.  `copyLocal` must produce
   `referenceMappings`, never the legacy `mappings` key.
2. In `modules/inventory/.../InventoryOwnerApi.java` and
   `InventoryOwnerService.java`, replace `LocalCopyExecutionReadback(String
   canonicalJson)` with the same named execution contribution needed by the
   coordinator.  Canonical JSON may remain only inside owner receipt
   persistence/replay, not as the public API payload.
3. In `modules/fulfillment-production/.../ProductionTagOwnerApi.java` and
   `ProductionTagOwnerService.java`, replace `BrandCopyExecutionReadback(String
   canonicalJson)` with typed owner status/version/reference-map fields.
4. In the reserved `CatalogInventoryCoordinator.java`, remove all four JSON
   façade readbacks and compose the typed owner contributions directly.  It
   must return the already-projected `LocalCopyReadback` / `BrandCatalogCopyReadback`
   shape to the adapters, eliminating `ObjectMapper.treeToValue` and
   `CopyPreflightWireShape.contract*Readback` from execute paths.
5. In the reserved `CatalogOwnerService.java`, wrap the four GET projections
   as `{revision,requestId,data}`; the contract/generator/UI half is already
   prepared in this slice, but item detail currently remains a bare object.

Required red proof after the reserved-file work: local `mappings` without
`referenceMappings` fails before any response is produced; each local/brand
owner contribution missing a required named field rolls back; every one of the
four catalog GET responses has exactly one envelope and no fallback path.

## Prevention disposition

Destination: implementation review checklist and the focused static tests in
`CopyPreflightWireShapeTest` and `catalog-inventory-query-envelope.test.mjs`.
No performance claim is made here; dynamic workload and Testcontainers
evidence remain out of scope for this static repair.

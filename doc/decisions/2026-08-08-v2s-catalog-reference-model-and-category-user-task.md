# Catalog reference model and category-management user-task decision

```text
STATUS=DEXTER_ACCEPTED
DECISION_OWNER=Dexter
DATE=2026-08-08
SCOPE=operations-admin catalog category management and catalog/inventory/production typed references
SUPERSEDED_IN_PART=2026-08-25 category-depth decision
CURRENT_CATEGORY_DEPTH=3
CURRENT_SOURCE=doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md#124-2026-08-25-category-depth-and-list-density-amendment
```

> **Amendment (2026-08-25, Dexter accepted):** this document's historical two-level category-tree
> limit is superseded. Catalog categories now allow root, second and third levels; creating or
> reparenting any fourth level is rejected by the catalog owner, contract and UI consistently.
> The retained deletion/opaque-reference decisions below are unchanged.

## Business task and outcome

An operations catalog editor must be able to maintain a category tree (historically two levels;
now three levels under the above amendment) without seeing
implementation lifecycle mechanics: rename a category, change its parent, move it up or down
among siblings, and delete an entire subtree when no category in that subtree is used by a
product.  A deleted category code may be used again in the same owner scope.  The user must not
see category disable, re-enable, or “void and rebuild”.

Success is owner-readback of the ordered tree and category labels; a failed command leaves the
tree and the entered form values unchanged and exposes a safe typed business reason.

## Confirmed problem family

The storage model has immutable UUID primary keys, but several fields named `*Ref` persist a
business code instead.  This conflates a natural key used for display/search/duplicate detection
with a durable relationship identity.  It contradicts the approved copy closure's
`(objectType, sourceRef) -> targetRef` mapping, and makes physical deletion or code reuse unsafe.

The finite in-scope denominator is catalog category parent/item relations, catalog dictionary and
production-tag references, item/SKU/component references, and inventory StockTarget/BOM owner
relations.  `assetRef`, inventory `targetRef`, and ledger `targetRef` already contain UUIDs and
are explicit counterexamples: they remain opaque references.

## Decisions

1. Persisted outbound relationships use opaque, immutable UUID refs.  Business codes remain
   scope-local natural keys for human display, search and conflict/compatibility matching only.
2. Category deletion is an atomic hard deletion of a root and all its descendants only when none
   of those categories is referenced by a product.  Command receipts/audit remain the history;
   no `VOIDED` category tombstone is retained.  A surviving category's code is unique, while a
   deleted code may be reused.
3. Category has no user-managed enabled/disabled lifecycle.  Existing `DISABLED` category rows
   are normalized to `ENABLED` during migration; legacy `VOIDED` rows are removed only after the
   reference migration proves no surviving relationship targets them.
4. Category operations are distinct user tasks: rename, change parent, move up, move down and
   delete.  Reparenting appends to the target sibling list; sorting never changes a parent and
   neither action displays an unrelated rename field.
5. Public list/detail labels may retain code-addressed compatibility paths where an operation
   explicitly requires a code, but every owner resolves that code to its UUID before relation
   validation or persistence.  New `*Ref` wire fields never carry codes.

## Explicitly rejected alternatives

- Hiding the old controls while retaining a callable status transition is rejected: it leaves an
  unexplainable business lifecycle and a bypassable API.
- Changing only `categoryRefs` to UUID is rejected: it creates a mixed model and leaves the copy
  closure and other typed relationships inconsistent.
- Physically deleting rows without first proving every typed reference is UUID-based is rejected.
- Adding cross-schema foreign keys or direct cross-schema DML is rejected; owners retain command
  authority and the existing REQUIRED coordinator boundary.

## Evidence and prevention

The first observed move failure was `moveOperationsCatalogCategory` HTTP 409
`VERSION_CONFLICT`: navigation omitted the real category `status` and `version`, so the client
submitted version `0` for existing rows.  The remediation must make all owner read projections
truthful, regenerate the contract/wire, and add focused red cases for missing/incorrect version,
code-as-ref persistence, deleted-code reuse, and cross-scope reference resolution.

The reusable prevention entry is `CATALOG_TYPED_REFERENCE_MUST_NOT_STORE_CODE`, with the finite
denominator and counterexamples recorded in the remediation design and project-memory update.

## Design-review amendments

The accepted finite physical denominator is
`contracts/policy/catalog-inventory-reference-path-matrix.json`, not a recursive key-name
heuristic.  Every row names the JSON/SQL path, object type, owner lookup, legacy value, consumer
and explicit counterexample.

Category deletion and item save share a catalog-owner concurrency invariant: both lock every
referenced category UUID in ascending UUID order.  Save validates scope and existence while it
holds those locks; deletion locks the whole subtree in that order, then checks persisted JSON
relationships before removing rows.  Thus either save commits and deletion is blocked, or delete
commits and save fails safely—no dangling category ref can commit.

Sibling actions use the latest locked sibling order at command time: `向上移动`/`向下移动` exchange
the current adjacent rows, rather than pretending the browser's old adjacency is a CAS fact.

## Independent design-review disposition

```text
REVIEW_CYCLE_ID=CATALOG-REF-CATEGORY-20260808
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
```

Round 1 confirmed the need for a finite physical reference matrix, a save/delete locking
invariant, complete public operation replacement, migration/production authorization, a
legacy-VOIDED fail branch, and latest-sibling ordering.  Those findings are incorporated above
and in the remediation design.  Round 2 found that the first matrix had omitted physically
consumed paths.  `R08` now names `productSkuRef`, `R10` names `inventoryBom[*]`, and `R11` names
`productionTags[*]`; legacy-VOIDED reference abort is also an explicit migration red case.

The fixed matrix is the exact acceptance denominator for implementation.  Any new opaque
relationship path, including a path discovered during migration or copy closure work, is a
blocking matrix expansion rather than an allowed heuristic fallback.
# SUPERSEDED-BY: 商品分类层级上限已由 `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md` §12.4 统一为最多三级；本历史决策中的“两层”表述不得作为实施依据。

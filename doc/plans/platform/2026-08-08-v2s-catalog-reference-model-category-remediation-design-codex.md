# Catalog reference model and category remediation design

```text
STATUS=DEXTER_ACCEPTED_IMPLEMENTATION_DESIGN
DECISION=doc/decisions/2026-08-08-v2s-catalog-reference-model-and-category-user-task.md
INTERACTION=doc/decisions/2026-08-08-v2s-catalog-category-reference-interaction.md
OWNER=catalog; inventory and fulfillment-production for their owned typed references
TRANSACTION=single business deployable, PostgreSQL, owner command APIs in REQUIRED coordinator transaction
```

## 1. Design objective

Replace the mixed `*Ref = code` representation with immutable opaque refs for every persisted
catalog/inventory/production outbound relationship, while retaining code as a scope-local
business key.  Repair category operations as independent user tasks and preserve API/L2/DEV
fixture independence.

## 2. Finite delivery matrix

| Unit | Owning source | Required change | Counterexample / retain |
| --- | --- | --- | --- |
| Category hierarchy | catalog category table/owner/navigation | `parent_category_ref`, `display_order`, true `categoryRef/status/version`; atomic empty-subtree delete; reparent/reorder | code remains label/search/uniqueness key |
| Category item relation | catalog item sections, item queries and copy rewriter | `categoryRefs` stores UUID values and resolves labels by owner task read | no cross-schema FK |
| Dictionary/tag relations | catalog typed JSON and production-tag owner | every `*Ref` is the existing `entry_ref`/`tag_ref`; code remains compatibility key | `assetRef` already correct |
| Item/SKU/component identity | catalog item JSON and copy closure | use existing `item_ref`; assign persistent `skuRef`/component refs and rewrite sourceRef→targetRef | public item/SKU code may remain route/display key |
| Inventory ownership | stock_target and stock_bom tables/owner | persist `item_ref`/`sku_ref` and resolve code only at edge compatibility boundary | target/ledger UUID links remain unchanged |
| Contract/wire | P1 generator, OpenAPI, edge contract, generated Java/TS | opaque-ref fields and truthful category readback; no hand-edited generated output | existing code labels retained separately |
| UI | catalog models/workbench/drawers and inventory consumers | labels from owner readback, exact category actions, no raw UUID display | page/scope capability boundaries unchanged |
| Migration | one additive Flyway migration | backfill category/dictionary/tag/item/SKU/inventory refs from same scope+brand; fail closed on zero or multiple resolution | no reset/seed SQL shortcut |
| Evidence | focused owner/edge/API/UI/DEV seed families | independent category and reference assertions; red mutations; business/cleanup separated for managed runs | DEV cannot prove API/L2 |

The field-level source of truth is
`contracts/policy/catalog-inventory-reference-path-matrix.json`.  No production code may infer a
typed relationship from a JSON key name; every read, write, copy and migration path must select a
matrix row explicitly.

## 3. Category owner semantics

`create`, `rename`, `reparent`, `moveUp`, `moveDown`, and `deleteSubtree` are catalog-owner
commands.  Reparent/reorder acquire the affected sibling rows in stable order, compare the root
expected version, and return the actual row(s).  Delete locks the requested subtree, verifies no
surviving item JSON relation references any subtree ref, then deletes the subtree atomically.
`navigation` orders siblings by `display_order, code` and returns
`categoryRef/code/name/parentCategoryRef/status/version/displayOrder` plus deletion availability.

### 3.1 Concurrency invariant

Before catalog item create/save persists `categoryRefs`, the catalog owner resolves, locks and
validates all referenced category UUIDs in ascending UUID order.  Delete locks the requested
subtree in exactly that order before checking category references and deleting the rows.  A save
that reaches a deleted row returns typed `NOT_FOUND`; a delete that sees a committed save returns
`REFERENCE_BLOCKS_DELETE`.  A focused concurrent delete-vs-save proof is mandatory.

### 3.2 Operation replacement matrix

| Existing operation | Replacement | HTTP / request | typed failures | Consumer action |
| --- | --- | --- | --- | --- |
| `createOperationsCatalogCategory` | retain | `POST /categories`, `parentCategoryRef` | duplicate/mapping/depth | new root/child |
| `updateOperationsCatalogCategory` | retain as rename | `PATCH /categories/{categoryRef}` | not-found/version | rename only |
| `moveOperationsCatalogCategory` | retain as movement command | `POST /categories/{categoryRef}/move`, `action=REPARENT|UP|DOWN`, `parentCategoryRef` only for `REPARENT` | cycle/depth/version/boundary | separate reparent/up/down UI actions |
| `transitionOperationsCatalogCategoryStatus` | replace | `DELETE /categories/{categoryRef}`, `expectedVersion` | reference-blocks-delete/version | delete confirmation |

The generated operation remains catalog-capability-bound for HEAD_COMPANY and STORE.  The retired
status operation is removed from edge contract, x-consumer-faces, generated wire/controller
dispatch/UI/API fixtures; it is not merely hidden.

## 4. Reference migration rules

1. Additive schema fields are backfilled first.  Each map lookup includes
   `data_node_ref`, `brand_ref`, object kind and code, and requires exactly one match.
2. Convert catalog JSON outbound fields only through owner-known typed paths; unknown or malformed
   values abort Flyway rather than silently preserving a code in a `*Ref` field.
3. Assign each legacy SKU a UUID exactly once; stock/BOM rows resolve `(item_code, sku_code)` to
   the new `(item_ref, sku_ref)` before code columns are removed from relationship identity.
4. Copy closure maps `(objectType, sourceRef)` to target ref and rewrites every outbound typed
   ref before target insertion.  Duplicate/compatibility matching remains code-based.
5. After read/write consumers and independent fixtures use refs, remove legacy relationship
   columns/paths.  Codes remain the externally visible natural keys where contract explicitly
   names them.

Legacy category migration normalizes `DISABLED` to `ENABLED`.  Any legacy `VOIDED` category still
referenced after UUID conversion makes Flyway fail with an actionable, non-secret diagnostic;
otherwise the row is removed.  The category status column may remain as an internal legacy
machine field during compatibility rollout, but it cannot appear as an editable user lifecycle or
selectability rule.

## 5. Failure and evidence matrix

| Condition | Owner response | Consumer behavior | Focused proof |
| --- | --- | --- | --- |
| stale category version | `VERSION_CONFLICT` 409 | retain input; invite refresh | navigation→command nonzero version roundtrip |
| cycle/depth invalid | typed 422 | show safe action-specific message | reparent red cases |
| deletion blocked by item | `REFERENCE_BLOCKS_DELETE` 422 with labels/count | no partial deletion | leaf/subtree reference test |
| ref missing/ambiguous in migration/write | fail-closed `REFERENCE_MAPPING_UNRESOLVED` | no hidden code fallback | migration/owner red case |
| deleted code reused | create success when no surviving row shares the code | normal new category | delete→recreate proof |
| legacy voided category still referenced | Flyway aborts before destructive change with safe scope/brand/category/item tuple | no partially migrated state | migration red fixture |

## 6. Package-exit source denominator

1. user/decision: two 2026-08-08 decision artifacts above;
2. requirements/IA/design: merged requirements §copy closure, IA category rules, existing three-stage design;
3. persistence/owner: catalog, inventory and production schema plus their public command APIs;
4. contract/generator: edge contract, OpenAPI root/path/components, P1/P3 generators, generated Java/TS;
5. production consumers: both Store/Brand workbench routes, drawers and inventory readers;
6. evidence: owner tests, exact edge/API command test, focused frontend test, independent DEV seed readback.

`CATALOG_TYPED_REFERENCE_MUST_NOT_STORE_CODE` is a project-memory and review-checklist
prevention target.  A mechanism is admitted only after a real mutation proves it rejects a
business code in a declared opaque-ref field while accepting the matching UUID.

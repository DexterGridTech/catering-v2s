# Catalog / inventory scope-specific write capabilities

**Status:** ACCEPTED — Dexter decision, 2026-08-08  
**Scope:** catalog-inventory operations-admin, platform role catalog, workspace authorization, catalog/inventory/production/asset command boundaries.

## Decision

`catalog` and `inventory` remain separate owners.  An operations capability represents a
user-initiated **write workflow** only; it is neither page access nor a read permission.
The former `EDIT_CATALOG_LIBRARY` and `READ_INVENTORY_ADVANCED_DIAGNOSTICS` keys are retired.

| Key | Platform label | Grantable role node | Authorized write target |
| --- | --- | --- | --- |
| `EDIT_HEAD_COMPANY_CATALOG` | 编辑总公司商品 | `GROUP`, `HEAD_COMPANY` | `HEAD_COMPANY` catalog, category, dictionary, production-tag, temporary-promotion and catalog asset workflows; the Head Company branch of a catalog whole-save may coordinate the approved BOM-definition commands |
| `EDIT_STORE_CATALOG` | 编辑门店商品 | `GROUP`, `REGION`, `PROJECT`, `STORE` | `STORE` catalog, category, dictionary, production-tag, copy and catalog asset workflows; the Store branch of a catalog whole-save may coordinate the approved StockTarget/BOM-definition commands |
| `EDIT_STORE_INVENTORY` | 编辑门店库存 | `GROUP`, `REGION`, `PROJECT`, `STORE` | `STORE` independent inventory-workbench workflows: count, increase, adjustment and standalone stock-target configuration |

All GET operations, including inventory diagnostics, have no action capability.  Page access
continues to admit an authenticated role to a page; an owner-valid scoped GET determines whether
the requested data can be read.  A read-only role may therefore have page access with an empty
capability set.

`saveOperationsCatalogItem` is one catalog user workflow, not two separately authorized user
actions. It may coordinate only `ensureCatalogInventoryTarget` and `saveCatalogProductBom` in
the same `REQUIRED` transaction. Those commands remain inventory owner facts and validations,
but their authorization source is the save operation's exact requirement
`CATALOG_INVENTORY_OPERATION_SAVE_OPERATIONS_CATALOG_ITEM` plus its target-specific catalog
capability: `EDIT_HEAD_COMPANY_CATALOG` for `HEAD_COMPANY`, or `EDIT_STORE_CATALOG` for
`STORE`. An inventory owner must reject a generic catalog grant, an inventory grant, or a grant
minted for another operation on either coordinated-definition path. Conversely, direct inventory
commands—including standalone configuration, count, increase and adjustment—must require
`EDIT_STORE_INVENTORY` and must reject a catalog whole-save grant.

## Scope selection and command enforcement

A workspace session may retain both a Store and a Head Company selection.  A catalog operation
must not choose one by Store-first fallback.  The edge policy selects exactly the persisted
selection whose reference equals the request's explicit `dataNodeRef`; dual-target mutations
require that selector.  Missing, mismatched, unsupported or ambiguous selection fails closed.
The verified target type then selects exactly one capability from the operation's generated
`capabilityByDataNodeType` mapping.

For each mutation and protected preflight the edge uses the existing live
`WorkspaceCapabilityScopeResolver`; it re-reads the current assignment, enabled role capability
and task-path coverage rather than trusting a session/UI snapshot.  The resolver mints an
`OperationsOwnerScopeGrant`, which is passed through the application coordinator into every
catalog, inventory, production-tag and asset owner command.  Each owner verifies the grant's
workspace, group, target type and target reference before receipt replay or state mutation.
The source of a brand-to-store copy is not its authorization target: it requires the target Store
grant.

Cross-owner coordination is not a generic owner-capability bypass. The operation policy for
`saveOperationsCatalogItem` declares the finite
`coordinatedInventoryDefinitionCommands=[ensureCatalogInventoryTarget,saveCatalogProductBom]`;
the generated edge projection and inventory owner both use that declaration. No other catalog
operation, inventory command, or owner command may infer permission from that list.

## Contract and migration requirements

The P1 generated operation policy is the finite source for all 42 operations.  Every mutation
has `mutation`, `authorizationRequirementId`, `allowedDataNodeTypes` and a type-to-capability
map.  Its summary `capabilityKeys` must not be interpreted as an any-of authorization decision.
The 16 reads have an empty capability set and no authorization requirement.  The global IAM
governance manifest contains the matching per-operation authorization requirements and owner
recheck declarations; generated OpenAPI/wire/catalog outputs must be exact projections. The only
coordinated inventory-definition projection is
`x-coordinated-inventory-definition-commands` on `saveOperationsCatalogItem`; it preserves the
primary catalog capability and does not add a second inventory authorization requirement.

The Flyway migration replaces stored roles atomically:

- `GROUP` old catalog grant becomes all three new write keys;
- `HEAD_COMPANY` becomes `EDIT_HEAD_COMPANY_CATALOG`;
- `REGION`, `PROJECT` and `STORE` become `EDIT_STORE_CATALOG` plus
  `EDIT_STORE_INVENTORY`;
- both retired keys are removed, unrelated keys are retained and values are deduplicated.

API, L2 and DEV fixtures remain independent and each receives only the grants it needs.  A DEV
seed proves experience data/readback only; it cannot prove API or L2 authorization behavior.

## Review checklist

Before closing any affected change, verify:

1. no production UI, edge, owner, fixture or generated artifact retains either retired key;
2. every dual-target operation resolves the explicit target rather than session field priority;
3. a Head Company key cannot write Store data, a Store catalog key cannot write Head Company
   data, and neither catalog key can perform an independent Store inventory write;
4. only `saveOperationsCatalogItem`, carrying its exact operation requirement, can use a catalog
   grant for `ensureCatalogInventoryTarget` or `saveCatalogProductBom`; every other inventory
   command rejects it;
5. revoking a live role capability or assignment denies an existing session on its next mutation;
6. owner grants are verified before replay/mutation, including multipart asset stage/release;
7. ordinary diagnostics are visible to an authorized inventory-page reader without a read
   capability; and
8. role UI permits an empty action-capability set and exposes only node-compatible write keys.

The required red mutations are: add a capability to a GET, remove a required target mapping, and
swap the Head Company / Store mapping. The coordinated-definition control additionally requires
red mutations that move either named inventory command to another operation, add a direct
inventory command, or replace the save requirement. A static pass without those
counterexamples is not a closure.

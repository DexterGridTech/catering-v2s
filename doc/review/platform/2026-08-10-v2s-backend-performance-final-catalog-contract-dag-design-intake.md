# Final catalog-contract and executable fixture-DAG — implementation-facing design

implementationAuthority: false
runtimeAuthority: false
`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_CATALOG_CONTRACT_DAG_DESIGN_20260810`

## Business purpose and actor boundary

This design closes a false-green risk in the final backend-performance workload; it does not
change a product journey. The workload observes platform-admin, public and operations-admin
HTTP operations, but write authority remains non-derivable: platform administrators do not hold
workspace capability; operations writes require an authenticated operations session, explicit
selected data node, live `EDIT_STORE_CATALOG` or `EDIT_HEAD_COMPANY_CATALOG` capability,
server-minted scope grant and catalog-owner recheck inside its `REQUIRED` transaction.

CatalogItem remains a catalog product fact, not a menu or inventory substitute. A run-scoped
external-order temporary item is a normal governed catalog state, not a terminal fixture. The
final preparation therefore uses normal owner HTTP only:

```text
platform bootstrap -> final group/workspace/role/invitation lifecycle
  -> public invitation completion -> operations STORE session + selected STORE data node
  -> create temporary catalog item -> save EXTERNAL_ORDER_TEMPORARY / GOVERNANCE_TODO
  -> same-item detail readback -> preflight -> execute
```

Credentials, cookies, OTPs, grants, codes, external identity and preflight digest are private
run state. The run manifest/report contains only redacted cardinality/correlation evidence.

## Finite executable-DAG follow-on boundary

The fixed workload is 396 rows / 196 routes: 166 GET rows and 230 command rows. Route-value
consumers are exactly 592 = 462 path + 130 required-query occurrences. Command operations are
113 (106 JSON, 6 NONE, one multipart); their row projection is 216 JSON, 12 NONE and 2 multipart.
The catalog must eventually replace parallel legacy `stateKey`/`producerReadbackKey` truth with these finite
declarations:

- `bindingDeclarations[592]`, one deterministic `fixtureId|path|name` or
  `fixtureId|query|name`, with exactly one authority reference;
- `nodeDeclarations`, each explicit `OWNER_HTTP` or `BOOTSTRAP_CAPABILITY` node with dependency,
  exact OpenAPI/owner source anchor, typed request inputs and outputs;
- `outputDeclarations`, each typed JSON-pointer or named Set-Cookie extraction with predicate and
  exact consumer binding IDs;
- `literalDeclarations[58]`: 54 OpenAPI enum values and four owner-validated values (`TODAY`,
  `GOVERNANCE_PENDING` and their two occurrences), each anchored to its closed source;
- `derivationDeclarations[14]`: only strict invitation-page-url to token derivation, with its
  input/output contract and no fallback; and
- `builderDeclarations[113]`, one explicit operation builder each, with exact session plan,
  source algorithm/span, fields, headers, CAS/replay inputs, transport, required binding IDs and
  response/postcondition output.

All 592 bindings must be exact-partitioned by their real authority class. Node/output references
must be source-resolved, dependency-reachable and acyclic. The executor consumes this literal
plan directly: exact session handle, encoded path/query, JSON or FormData transport, per-row
Idempotency-Key, declared status and semantic postcondition. No operation-id dispatch, generic
body map, route inference, default fixture value, raw caller session/body/path map or reportable
secret is permitted.

The public platform recovery rows use only `PUBLIC_PLATFORM_RECOVERY` and its recovery-flow
cookie, never `V2S_PLATFORM_SESSION`. Operations context/data-node selection always replaces the
current context version with the value returned by the immediately preceding owner response.

This is a **follow-on boundary, not a delivery promise of this review cycle**. The current
response-correction unit does not alter the catalog, checker, fixture materializer, workload or
adapter. Those sources require a later implementation-facing detailed graph with all 592
binding-to-output and 113 field-level builder contracts in machine data. Keeping it separate
prevents an owner-response repair from pretending to have completed the unadmitted assembler.

## Owner-contract correction delivery unit

The present graph cannot bind two final catalog operations honestly. This unit is deliberately
small and must precede assembler implementation.

1. `CatalogOwnerService#deleteCategory` must return the already-declared
   `{categoryRef, deletedSubtreeSize, deletedCategoryCodes}` from the locked subtree before
   deletion, not `deletedCount`. Its two final rows currently also claim `IDEMPOTENT_SAME_KEY`
   while the owner recheck reaches deleted-object `NOT_FOUND` before receipt lookup. The next
   implementation must choose and prove either a safe same-key receipt after typed grant/context
   recheck or the truthful `SAME_KEY_ONLY` policy; it must never globally move receipt lookup ahead
   of owner recheck.
2. `CatalogOwnerService#promotionPreflight` must emit the canonical single envelope
   `{revision, requestId, data:<TemporaryPromotionPreflight detail>}`. The existing double envelope
   is an owner implementation defect, not an OpenAPI or product capability defect. The operations
   consumer decodes `response.data`, never `response.data.data`, while retaining identical
   same-item `sourceVersion`/`preflightDigest` from preflight to execute.

The subsequent response-correction implementation unit has exactly six technical source surfaces:

| path | disposition | purpose |
| --- | --- | --- |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java` | update | canonical delete readback, single promotion envelope, and explicit delete replay policy |
| `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogCategoryOwnerIntegrationTest.java` | update | subtree response and replay/stale/reference red proof |
| `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogTemporaryPromotionOwnerIntegrationTest.java` | create | normal temporary-item lifecycle, exact single envelope, same-item execute and stale/non-temporary red proof |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/operations/cataloginventory/CatalogTemporaryPromotionEdgeIntegrationTest.java` | create | HTTP selected-node/capability/grant/owner-handoff and one-envelope response proof |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx` | update | single-envelope consumer decode only |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogManagementPage.test.tsx` | update | one-envelope consumer and selected-node/capability regression proof |

The read-only source denominator is separately fixed: canonical byte coverage/OpenAPI and P1/P3
generators; generated wire/route artifacts; catalog coordinator/controller/tokens; and existing
route tests. Generator checks must prove those outputs are byte-identical. No controller,
transaction, schema, generated output, capability, endpoint, migration, seed/reset or runtime
surface is authorized by this delivery unit.

## Required red proof and sequencing

First prove the catalog owner response repair with focused owner/edge/consumer tests and generator
byte-stability. Required red cases in this unit are category legacy field, double promotion
envelope, delete stale/reference/mismatched replay, cross-item digest, non-temporary source and
wrong selected-node/capability handoff. A later graph-design unit owns unknown/unrelated node
output, cycle, query/materializer, session-plan and multipart-execution proofs.

This document authorizes neither static source mutation nor dynamic resources. It is a new
materially expanded design scope because it introduces six owner/edge/consumer paths after the
former fixture-assembler review completed; it deliberately leaves the 592-binding execution
contract for a later, separate design unit.

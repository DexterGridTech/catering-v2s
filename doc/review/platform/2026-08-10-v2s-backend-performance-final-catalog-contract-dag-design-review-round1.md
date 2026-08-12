# Independent catalog-contract and executable-DAG design review — Round 1

`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_CATALOG_CONTRACT_DAG_DESIGN_20260810`  
`REVIEW_TARGET=DESIGN`  
`REVIEW_ROUND=1`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`  
`VERDICT=NO-GO`  
`M=2 / S=1 / N=1`

## Independence and inputs

This is a fresh v2s-rooted adversarial review. I formed the findings from the
Roadmap authorization, project-memory route, canonical OpenAPI, generated
consumer, owner, edge and current fixture-catalog bytes before comparing them
with author conclusions. No separate author-intake file existed at review time.
No production, design, runtime, or dynamic-resource source was changed.

| input | SHA-256 at review | result |
| --- | --- | --- |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-catalog-contract-dag-design-review-input-checklist.md` | `3ee0af078119e6ef297e0b0b93319fcbf784b3a57b0e1ec6f879e41ca3c15c6b` | read |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-catalog-contract-dag-design-intake.md` | `448ccc2aec241874789adc2e159d1d37f7f516279fde65e17fdb97167591caec` | reviewed design |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-catalog-contract-dag-design-granularity-manifest.json` | `df68c6e4131f408e40ef8665c032922c72f979213403cb402b8e4f6f81ffc10a` | reviewed manifest |
| `contracts/policy/backend-performance-final-fixture-catalog.json` | `f3afba7d7c8c8c626f8a4d5d6fdc6a3d8d11ecc56a4784dd98e05efb9e151f1a` | independently recounted |
| `scripts/check/backend-performance-final-fixture-catalog` | `265e5e4a4418c12105193b57229aeb1bc4a3bf1052f2f5b4d0de6ef1de74fb35` | check/self-test run |
| `CatalogOwnerService.java` | `ddc0759bd9eeb8ea5c1a508862b027d9b2e4a73030f71995c53b4d00536f6490` | source reread |
| `CatalogItemDrawer.tsx` | `9687667a18b1c51d188600375d3b4b0b6ffe4de6c215b9114a8c80deaae2895f` | source reread |

Routed memory was recalled with explicit backend, operations-admin, contract
and evidence routes. The business-corpus terms `CatalogItem`, catalog owner,
operations session/data node and capability matched G-05/G-11/G-12. The
review used their no-derivation boundaries. `scripts/check/standards-coverage
--phase BACKEND_PERFORMANCE_FINAL_CLOSURE` passed (R5 alias), as did the
implementation-design-granularity self-test.

## Independent readback

- The current catalog independently recounts to 396 rows: 166 GET and 230
  command rows; 462 path plus 130 query bindings = 592; 113 unique command
  operations; and 216 JSON + 12 no-body + 2 multipart command-row projections.
- It is not the proposed literal graph: the current bytes still contain 1,054
  `stateKey` and 592 `producerReadbackKey` occurrences.
- The two response defects are real. `deleteCategory` emits `deletedCount`
  although OpenAPI declares `deletedSubtreeSize` and `deletedCategoryCodes`.
  `promotionPreflight` nests an already enveloped model in `envelope`, while
  the generated `TemporaryPromotionPreflight` has exactly one outer `data`.
- `CatalogItemDrawer` currently decodes `response.data.data`; the design's
  proposed one-envelope consumer correction is therefore directionally right.

## Findings

### M-000 — the bound design cannot pass its declared granularity admission

The manifest binds `implementation-design-granularity` as an active checker,
but a fresh invocation against the exact manifest/report fails
`DESIGN_IMPLEMENTATION_AUTHORITY_NOT_FALSE`. The checker requires a literal
line `implementationAuthority: false` in the bound design; the current intake
contains only a Markdown inline-code rendering. The authorization input has a
matching raw line, but that does not satisfy the independently bound design
artifact.

Make the design's authority declaration a raw, checker-recognized declaration
(or deliberately change the checker only with a compatible red fixture and
governance rationale). This must be closed before design admission; otherwise
the manifest's own mechanical proof cannot run on the reviewed bytes.

### M-001 — one five-file delivery unit cannot also materialize the claimed literal 396-row graph

`FINAL-U02` declares an executable-DAG contract and says its ordered chain will
“materialize the literal fixture DAG and consume it directly”, yet the manifest
authorizes only the owner, two owner tests, one drawer and one page test. It
does not declare the existing catalog, its checker, the fixture materializer,
workload executor, or their focused tests—each is a necessary actual change
surface to remove the legacy `stateKey`/`producerReadbackKey` model and make
the 592 bindings/113 builders executable.

This is not an implementation-permission objection. It is a design-denominator
failure: the package-exit and pre/post readback set cannot be made equal while
the same unit promises an undeclared, material change across those sources.
The design must either stop at the bounded five-file owner/consumer correction,
or add a separately bounded literal-DAG delivery unit with every catalog,
checker, materializer, executor and test surface, source anchors, red fixtures
and exit denominator. The smaller repair is to split it; it preserves the
correct response repair without reopening the already NO-GO assembler work.

### S-001 — the declared proof surface cannot demonstrate the promised HTTP authorization-to-owner handoff

The design says the final temporary-item chain is normal owner HTTP and that
selected node, live catalog capability, server grant, owner recheck and
`REQUIRED` transaction remain intact. Its only new backend tests, however, are
catalog-owner tests. The existing `CatalogTemporaryPromotionContractTest`
checks code validation/projection; `OperationsCatalogInventoryControllerRouteTest`
only reflects category route annotations. Neither exercises the promotion
path's `itemCode`/`dataNodeRef`/brand header handoff or proves that the
one-envelope correction does not bypass the existing edge-to-owner grant path.

Add a focused existing-or-new edge integration test surface to the manifest:
normal create → save → detail → preflight → execute must retain operations
session, selected-node/capability enforcement and owner typed rejection for a
wrong scope. This is a bounded propagation proof, not a request for a new API,
capability, controller behaviour, runtime, or dynamic run.

### N-001 — numerical and structural checks are baseline evidence only

The static catalog checker and self-test pass, and the 396/592/113 calculation
is reproducible. They validate current legacy structure, not the proposed
literal node/output DAG or an owner-derived final snapshot. Retain these
numbers as pre/post denominators; do not cite them as final fixture or dynamic
acceptance evidence.

## Solution reasonableness

Correcting the two owner/consumer response shapes is a proportionate precursor:
it preserves the canonical contract, owner authority and generated artifacts
instead of changing product capability or API. A literal graph is also a sound
answer to hidden generic fixture state. But combining those two sizes in a
single five-file unit is not proportionate or auditable. Splitting the bounded
owner correction from the catalog/materializer conversion is the simpler,
lower-risk design.

## Authorization boundary

This is a DESIGN-only `NO-GO`. It authorizes no implementation, source or
contract change, generated artifact update, DEV/runtime, seed/reset,
Testcontainers, browser L2, UAT, data operation, or repository-control action.

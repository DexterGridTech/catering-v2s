# Whole-engineering first package implementation-facing design

`REVIEW_TARGET=IMPLEMENTATION`  
`packageId=WHOLE-ENGINEERING-FIRST-PACKAGE-20260805`  
`reviewCycleId=WHOLE-ENGINEERING-FIRST-PACKAGE-20260805`  
`implementationAuthority=true`  
`runtimeAuthority=false; business=NOT_APPLICABLE_WITH_REASON; cleanup=NOT_APPLICABLE_WITH_REASON`

## Authority and boundary

This package implements only the first static semantic package explicitly authorized by Dexter after Claude's S2 GO and D1-D7 rulings. The governing materials are:

- `doc/decisions/2026-08-05-v2s-whole-engineering-d1-d7-rulings-claude.md`
- `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md`
- `doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-rp12-classification.json`

The package contains RP-09, RP-12-pre, RP-12a..n, RP-13..RP-20 and S2 S-01. It does not authorize DEV/UAT, HTTP/L2, seed/reset, runtime deployment, database/migration changes or Git. RP-07/RP-08/RP-10/RP-11 remain in the second package. S1 contract drift remains in the S1 exit and is not silently absorbed here.

## Hard prerequisite

Before any RP-12 replacement, the 320 physical Java rows / 477 token occurrences in the classification artifact must receive one fresh independent blind review. The reviewer must independently rescan the source, compare token, set, owner, generated and normative-source assignments, and publish a GO/NO-GO with M/S/N. A NO-GO blocks replacements; a GO permits the ordered collection checkpoints below.

## Ordered implementation units

1. **S2 S-01** — extend the typed public-security diagnostic envelope with `databaseOperationCount` and `databaseDurationMillis`, reusing the request-scoped `DatabaseOperationTracker` opened by the existing non-production metrics interceptor (never nesting a collector). Add focused tests and record the two deployment-time observability deferrals in `HANDOFF.md`.
2. **RP-09** — make MinIO `exists` return false only for an explicit object-not-found response; map authentication, transport, network and server failures to the existing unavailable exception. Add a red mutation for broad catch-to-false.
3. **RP-12-pre / service-node collection** — replace the silent `enterable` default with an explicit fail-closed rejection and focused unknown-node test. Preserve the five OpenAPI service-node values and do not reuse this vocabulary for other sets.
4. **RP-12a..n** — after classification GO, implement each owner set in this order: organization tree, service node, extension host, business entity, audit `entityType`. The service-node component remains the OpenAPI/codegen source; the other four remain owner-module sources. Every replacement is bounded by its classified rows and has a real red mutation.
5. **RP-13** — keep list and detail read models separate: list responses do not materialize `authorizedBrands`; detail/explicit expansion reads the relation. Preserve the owner authorization predicate and add focused list/detail contract tests.
6. **RP-14** — add one strict `AuditChangeJson.write` in audit-model and route every audit change writer through it; reject invalid shapes and prove escaping/null/nested-value boundaries. Do not move serialization into edge or persist payloads.
7. **RP-15/16** — verify owner reachability of authorization-version errors before deleting any dead declaration; change invalid page size to typed parameter validation while retaining account-visibility concealment. Regenerate only when the contract source actually changes.
8. **RP-17/18** — inventory `findFirst` cardinality and only alter unproven cases; consolidate only byte/semantic-identical helpers, retaining app-local labels, problems and shells.
9. **RP-19a..d** — declare the organization audit task-read edge; replace the two production `SELECT *` wrappers with explicit projections; correct the operations store/contract presentation catalog only where current UI/edge facts differ; remove the empty retired password-reset source directory after reference proof.
10. **RP-19e..g / RP-20** — repair the Flyway discovery denominator, document the accepted ST-11 and heritage-hash authority decisions without blind refresh, and add a source-owned RM1-P6-3→R5 standards-phase mapping while retaining the canonical database-budget command.

## Six package-exit source denominators

| denominator class | owning source | required equality / proof |
|---|---|---|
| `RP12_CLASSIFICATION` | production Java token inventory plus D3 vocabulary | 320 rows / 477 occurrences, five-set assignment and SQL independence |
| `OWNER_SEMANTICS` | asset, workspace-iam, organization, extension, contract and audit-model owners | each finding has one owner fact, typed failure/cardinality proof and real red mutation |
| `EDGE_CONTRACT_GENERATED` | OpenAPI, edge adapters and generated wire | only service-node values are contract/codegen sourced; declaration/owner/consumer sets agree |
| `QUERY_POLICY` | module registry, SQL projections, catalog and gate discovery | explicit task-read, named projections, current UI/catalog sets and complete discovery denominators |
| `FOCUSED_PROOF` | owner/edge/foundation/scripts tests and static checks | green baseline plus mutated red controls; no runtime/UAT claims |
| `COMPLIANCE_EVIDENCE` | pre/post hook receipts, manifest, proof, problem-family and package exit | changed-path set equals successful hook receipt set; business/cleanup are explicit N/A |

## Evidence and review

The package exit must include source paths, exact commands, red mutations, classification acceptance, implementation review Round 1 and (if needed) Round 2. The independent reviewer is fresh and blind to the author intake; after Round 2 no third review is permitted. Claude receives a copyable Chinese review brief with the package-relative paths, M/S/N format and the unchanged authorization boundary.


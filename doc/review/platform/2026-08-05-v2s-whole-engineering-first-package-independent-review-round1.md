# Whole-engineering first package — independent implementation adversarial review (Round 1)

REVIEW_TARGET=IMPLEMENTATION  
REVIEW_CYCLE_ID=WHOLE-ENGINEERING-FIRST-PACKAGE-20260805  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
ROUND_FINAL_DECISION=NOT_APPLICABLE_ROUND_1  

## Blind declaration

I independently reopened the implementation design, delivery manifest, focused static proof,
package exit, current production source and relevant tests. I formed this verdict before reading
any author intake or Claude review. No DEV/UAT/HTTP/L2, runtime, database, seed/reset or Git
operation was performed, and no production source was changed by this review.

## Verdict

**NO-GO — M=1, S=2, N=0.** The package cannot close this round. The classification denominator
used to authorize RP-12 is not the current implementation-state artifact, and the owner-local
extension vocabulary is not fully centralized. A stale generated error declaration also remains
after the RP-15 reachability claim. These are implementation/evidence blockers; business and
cleanup remain `NOT_APPLICABLE_WITH_REASON` under the package boundary.

## Findings

### F-01 — RP12 classification admission is not bound to the implementation bytes

**Severity: S1 — CONFIRMED.** The design requires 320 Java rows / 477 occurrences before any
RP-12 replacement (`doc/plans/platform/2026-08-05-v2s-whole-engineering-first-package-implementation-design.md:19-28,40`).
The focused proof records a GO against SHA `cea91e...`, 320 rows, but separately records the
implementation artifact as SHA `59ca...`, 323 rows, and explicitly says it was rebased with
`reviewStatus=NOT_A_NEW_REVIEW_ROUND`
(`doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-focused-static-proof.json:10-29`).
The exit repeats that only the pre-rebase 320-row artifact was reviewed
(`doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-exit.json:6-9`).
Therefore the three implementation-state rows have no independent GO, while the package claims
RP-12a..n replacement is bounded by the classified set. This fails the six-source
`RP12_CLASSIFICATION` equality, even though the aggregate occurrence count remains 477.

**Minimal repair:** freeze/regenerate the classification against the exact current production
bytes. The classification sub-cycle is already at its Round-2 hard stop, so do not silently open
a third review; Dexter must decide whether a materially new classification scope/cycle is
authorized before any RP-12 replacement is admitted.

### F-02 — RP12 extension-host vocabulary is still duplicated/raw in production consumers

**Severity: S1 — CONFIRMED.** The implementation claims all five finite sets are owner-local
constants and that residual literals remain only in constant definitions
(`doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-focused-static-proof.json:34-35`).
The actual owner source still leaves four extension-host values as raw literals in a production
consumer list: `"BRAND"`, `"TENANT"`, `"CONTRACT"`, and `"COMMERCIAL_GROUP"`
(`apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java:28-30`).
The edge consumer also duplicates `"COMMERCIAL_GROUP"`
(`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationExtensionController.java:42-46`).
`ExtensionHostTypes.VALUES` itself embeds the same un-named raw values
(`apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java:5-11`).
This leaves owner/consumer semantics and the claimed residual-literal scan unequal; a future
change can update one extension vocabulary copy while another accepts a different set.

**Minimal repair:** make the complete extension-host set named owner constants (including
BRAND/TENANT/CONTRACT/COMMERCIAL_GROUP), replace every production consumer with those constants,
and add a red control that mutates one consumer vocabulary independently.

### F-03 — RP-15 dead authorization error declaration was not removed or reconciled

**Severity: M1 — CONFIRMED.** The proof says no emission/consumer exists for
`ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_REQUIRED` and says only in-use code remains
(`doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-focused-static-proof.json:38`).
The current generated edge enum still declares the supposedly dead code
(`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/EdgeProblemCode.java:24-28`),
while the only other source occurrence is a self-test fixture that synthesizes the stale code
(`tools/capability-invariants/cli.mjs:1027-1033`). No OpenAPI source occurrence exists in the
current source tree. `edge-codegen --check` passing does not prove this generated problem enum is
reachable or synchronized with the current contract. The package therefore leaves a dead public
error declaration while claiming RP-15 closure.

**Minimal repair:** independently establish the accepted error-disposition source, regenerate or
remove the unreachable enum member and update its red fixture/catalog path; prove source,
generated enum and consumer sets are equal.

## Reviewed positive controls / no additional finding

- S2 tracker reuse/order is source-consistent: metrics is registered before public-security and
  request-completion interceptors (`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/configuration/EdgeWebConfiguration.java:42-46`),
  and the diagnostic state snapshots rather than opening a nested collector
  (`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/PublicSecurityDiagnosticRequestState.java:58-76`).
- RP-09's explicit not-found classification and broad-failure red tests are present
  (`apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/MinioAssetObjectStorage.java:55-75`,
  `.../MinioAssetObjectStorageTest.java:12-31`).
- RP-14 production audit INSERT paths inspected in this round route through
  `AuditChangeJson.write`; no additional confirmed bypass was found.
- RP-13 list/detail separation and RP-18 foundation imports are present in the current source,
  and RP-19 registry/projection/Flyway evidence is explicitly recorded as static-only proof.

Authorization boundary remains unchanged: this review grants no runtime, DEV/UAT, HTTP/L2,
database/migration, seed/reset or Git authority.

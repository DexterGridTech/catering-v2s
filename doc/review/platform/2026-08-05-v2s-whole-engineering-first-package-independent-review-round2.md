# Whole-engineering first package — independent implementation adversarial review (Round 2, final)

REVIEW_TARGET=IMPLEMENTATION  
REVIEW_CYCLE_ID=WHOLE-ENGINEERING-FIRST-PACKAGE-20260805  
REVIEW_ROUND=2  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
ROUND_FINAL_DECISION=SELF_DECIDED  

## Blind recheck

This is the final directional recheck of Round 1 F-01/F-02/F-03. I independently reopened the
new post-implementation evidence and current source first, then compared it with the Round 1
findings. I did not treat the author's `PASS_PENDING_ROUND2_RECHECK` claims as proof. No third
RP-12 classification review was opened. No DEV/UAT/HTTP/L2, runtime, database, seed/reset or Git
operation was performed.

### Input paths and SHA-256

| input | sha256 |
|---|---|
| `doc/plans/platform/2026-08-05-v2s-whole-engineering-first-package-implementation-design.md` | `92b560e689a9d7ca3951fa434007258ed94809a38a84ac15d971674f12b7c883` |
| `doc/review/platform/2026-08-05-v2s-whole-engineering-first-package-delivery-manifest.json` | `eb1b9536dee75d5033b373f6613607d95ec8b2b18b8b3e2f1749501c66882bdc` |
| `doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-focused-static-proof.json` | `3657a2729d3a1bcfd61e2c2381a0b300197001bd28500470f2dfe2fed82f1778` |
| `doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-exit.json` | `16c2acff72908e3fc3537c8e3427b8c10dcdb7125092ae6bba10e56616a7b533` |
| `doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-rp12-classification.json` | `59ca56242b0e3610e4c5e557c6091b93b32de4bda59d5ce1e7ce5985788a494f` |
| `doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-rp12-post-implementation.json` | `9012c1630ee7e3a9feeecbb2aa1f2327fde3b716cd9d0ea4a761efa8ff4d8db7` |
| `doc/review/platform/2026-08-05-v2s-whole-engineering-first-package-independent-review-round1.md` | `2f6c44fc7208a72c38cea178da6b1a1f1c846a3562ffe48aec3aec1dc618ed71` |

## Final verdict

**NO-GO — M=1, S=2, N=0.** F-03 is closed. F-01 remains an evidence/denominator blocker,
F-02 remains an owner-semantic implementation blocker, and a new static-gate regression is
recorded as F-04. The package exit must not advance to GO from this review cycle.

## F-01 — RP-12 final-state binding

**Status: CONFIRMED, S1 (not closed).** The implementation-state artifact still has 477
occurrences but **323 rows / 323 matching lines**, while the independent classification GO is
bound to SHA `cea91e...` with **320 rows / 320 lines**
(`doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-focused-static-proof.json:10-29`).
The exit still defines `RP12_CLASSIFICATION` equality as “reviewed pre-rebase 477 / 320” and keeps
the package in `AWAITING_INDEPENDENT_IMPLEMENTATION_REVIEW_ROUND_2`
(`doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-exit.json:5-16`).

The new post-implementation artifact is transparent that it is not a third classification review
(`doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-rp12-post-implementation.json:4-6,36-37`),
but its final scan is only an aggregate 152-occurrence scan plus one aggregate production-file
digest (`:15-22`); it does not provide a new per-file source-hash map or occurrence-level equality
for the changed 323-row state. Independently recomputing the classification source hashes finds
current-byte mismatches, including `ExtensionDefinitionService.java` (artifact
`53a6b9...`, current `4c1195...`) and `OrganizationCommandService.java` (artifact
`5829f8...`, current `89d6c8...`). Therefore the 323-row implementation state is not proven by
the reviewed 320-row GO, and the post scan cannot establish which newly changed rows were covered.

The classification sub-cycle is already at its Round-2 hard stop; no third classification review
is permitted. **Minimal repair:** stop this package and obtain Dexter's decision on a materially
new classification scope/cycle or another explicitly accepted binding method before admitting
the ordered RP-12 replacement units.

## F-02 — extension-host constants and consumers

**Status: CONFIRMED, S1 (not closed).** The owner set itself is now complete and named
(`ExtensionHostTypes.java:5-17`), and the two consumers cited by the post evidence use constants
(`doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-rp12-post-implementation.json:24-34`).
However, the claimed “all extension host consumers use `ExtensionHostTypes` named constants” is
false. Production extension-definition reads still pass raw host literals:

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/contract/OperationsContractController.java:56` — `managementDefinition(..., "CONTRACT")`;
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/contract/PlatformContractOverviewController.java:79` — `requireDefinition(..., "CONTRACT")`;
- `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractCommandService.java:164,173` — `requireDefinition(..., "CONTRACT")`;
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationCommandService.java:339` — `requireDefinition(..., "COMMERCIAL_GROUP")`;
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationOverviewTaskReadService.java:230` — extension-host table dispatch still embeds `"BRAND"` and `"TENANT"`.

This is an owner/consumer set inequality, not a formatting issue: a future host vocabulary change
can leave these extension reads accepting a stale literal while the owner set changes. **Minimal
repair:** replace these extension-host consumers with `ExtensionHostTypes` constants and add a
consumer inventory/red mutation that fails when a raw extension-host literal is introduced.

## F-03 — dead authorization error disposition

**Status: CLOSED, M0.** The prior stale generated declaration is gone: current
`EdgeProblemCode.java:20-30` contains `..._IN_USE` and `..._VERSION_CONFLICT` but not
`..._REQUIRED`. The OpenAPI source keeps only `..._IN_USE`
(`contracts/openapi/paths/operations-admin/head-company-management.paths.yaml:709-714`), and the
capability-invariant red fixture now also contains only `..._IN_USE`
(`tools/capability-invariants/cli.mjs:1027-1033`). `node scripts/generate/edge-codegen.mjs --check`
returned `R5_EDGE_CODEGEN_CHECK=PASS; FILES=254`. The owner, contract and generated sets are
self-consistent for this disposition.

## F-04 — RP-16 typed-owner exception inventory drift

**Status: CONFIRMED, M1.** The package introduces `WorkspaceUserService.PageValidationException`
(`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java:357-368`),
but the frozen typed-owner inventory still requires 93 entries
(`tools/capability-invariants/cli.mjs:192`) and the static gate now returns
`CAPABILITY_INVARIANTS=FAIL / P3_A_TYPED_OWNER_EXCEPTION_FROZEN_COUNT_DRIFT:94` from
`node tools/capability-invariants/cli.mjs check`. RP-16 is explicitly a typed parameter error
change, so this is package-caused denominator drift, not an unrelated runtime issue. The focused
proof claims RP-16 PASS but does not list this required gate (`doc/evidence/platform/2026-08-05-v2s-whole-engineering-first-package-focused-static-proof.json:39,51-67`).

**Minimal repair:** update the frozen exception inventory and fingerprint through the accepted
source-owned control, add/retain the real red mutation for count/set drift, rerun the static gate,
and include its exact PASS output in the package proof. Do not merely change the expected count
without proving the new owner exception's edge mapping and problem contract.

## Regression scan / non-finding

The capability-invariants failure is therefore tracked as F-04 above, not hidden as a
pre-existing gate debt.

Authorization boundary remains unchanged: no runtime, DEV/UAT, HTTP/L2, database/migration,
seed/reset or Git authority is granted.

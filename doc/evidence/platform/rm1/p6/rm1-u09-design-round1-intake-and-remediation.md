---
title: RM1 P6 implementation-facing design round-1 finding intake
status: REMEDIATED_AWAITING_INDEPENDENT_ROUND_2
reviewTarget: DESIGN
implementationAuthority: false
---

# RM1 P6 implementation-facing design Round 1 intake

`REVIEW_CYCLE_ID=RM1-P6-IMPLEMENTATION-FACING-DESIGN-20260729`  
`REVIEW_ROUND=1`  
`reviewerKind=INDEPENDENT_SUBAGENT`

The author reopened every owning source before this intake.  This document is not an adversarial verdict and does
not authorize implementation.

| finding | independent evidence reopened | disposition | smallest remediation and counterexample retained |
| --- | --- | --- | --- |
| `RM1-P6-DESIGN-M-001` | carry-over manifest `pageDesignKeySurfaceCrosswalk.nonCatalogSurfaces`; P6 preparation sections 4, 5 and 10; Round-1 review | `CONFIRMED` | The new final roster binds all seven non-catalog surfaces. U01 records three contract/owner-only inputs, U02 records platform auth/password consumers, U03 records operations auth/recovery, invitation, shell and password consumers. The 25-key partition remains a counterexample: it closes catalog keys but cannot prove non-catalog tasks. |
| `RM1-P6-DESIGN-M-002` | P6 preparation section 4.1 and 4.2; carry-over `foundationConsumptionBySurface`; accepted IA screen sheets | `CONFIRMED` | The roster now provides surface/screen sets, face, physical host, exact final feature/test paths, owner operation/N-A, recovery and named foundation primitive for every consumer. It keeps the two required import-equality red mutations. A broad feature directory remains expressly insufficient. |
| `RM1-P6-DESIGN-M-003` | `project-memory/index.json`; `scripts/check/implementation-design-granularity`; current manifest route `design/backend/all/backend/contract/implementation` | `CONFIRMED` | U01 D1 adds deterministic-context-only and independent-subagent-adversarial-review with current hashes and `Assertions`; no route or checker is weakened. The prior kernel/corpus-only list remains the negative counterexample. |

The prevention set is closed in
`rm1-u09-implementation-design-admission-problem-family.json`: M-001 is a review-checklist/surface-roster
obligation; M-002 uses the existing manifest-backed frontend architecture import-equality control; M-003 uses the
existing exact D1 route-equality control.  The next and final independent round must re-open the current bytes,
verify all three remediations, seek counterexamples, and decide `GO` or `NO_GO`; no third independent round is
permitted.

---
reviewCycleId: R4-W2-IMPLEMENTATION-20260725
reviewTarget: IMPLEMENTATION
sourceReview: doc/review/platform/2026-07-25-v2s-r4-implementation-adversarial-review-round-1.json
---

# R4 implementation round-1 finding intake

| Finding | Disposition | Owning-source reopen and minimal repair |
|---|---|---|
| M-001 | CONFIRMED | The existing ArchUnit plus static backend gate did not cover the complete B.3 semantic architecture claims. The unsupported B.3 rows are now `UNENFORCEABLE_BY_MACHINE` with `R4_BOUNDARY_SEMANTICS_REVIEW`; the finite ArchUnit and backend checks remain runnable but are no longer overstated. |
| M-002 | CONFIRMED | The one-line static DDL/query predicates and three true-database tests did not justify all B.2/B.6 claims. Those source rules now use the same explicit semantic review checklist; the finite static checks and Testcontainers FK/CAS/RLS/clean proof remain evidence, not a false total denominator. |
| M-003 | CONFIRMED | The validators do not yet derive controller mapping metadata, so B.1/D.2 total enforcement was overstated. Those rows now require the explicit R4 semantic review instead of a keyword-style substitute. |
| M-004 | CONFIRMED | `scripts/verify` now requires `--changed <comma-separated paths>`, passes that input to `affected-l2`, verifies selected targets exist, prints the exact selected set, and records it in fresh evidence. The bounded R4 backend/edge input is explicit; no invented UI behavioral run is claimed. |
| M-005 | CONFIRMED | The evidence packet now records the current hashes of `scripts/verify`, `tools/r4-gates/verify.mjs`, and `tools/r4-gates/cli.mjs`; fresh verification followed the update. |
| S-001 | CONFIRMED | Logging/retirement source rules needing broader semantic/replacement-map judgment were moved to `R4_BOUNDARY_SEMANTICS_REVIEW`; the existing finite secret/residue gates remain active as limited mechanical evidence. |
| S-002 | CONFIRMED | The verify orchestrator now performs Testcontainers residual inspection in `finally` after the Gradle invocation, so a failed native test still receives cleanup disposition. The socket override honors an explicit caller value and otherwise uses the standard container-visible Unix socket path. |
| N-001 | CONFIRMED | Retained as positive scope evidence only: fresh dynamic execution occurred, but it is not used to cure coverage claims. |

## Alternative considered

Writing larger keyword scanners for every frozen source rule was rejected: it would violate verification governance by pretending to understand architectural and security semantics. The selected repair preserves finite mechanical gates and routes the remainder to the mandatory fresh independent/Claude review checklist.

## Fresh commands after repair

```bash
scripts/check/standards-coverage --phase R4
scripts/verify --changed apps/backend/catering-business-server/src/test/java/r4/database/R4DatabaseBoundariesTest.java,contracts/openapi/edge.openapi.yaml
scripts/check/{security-boundaries,frontend-architecture,database-boundaries,database-operation-budget,backend-boundaries,openapi-contracts,ui-wireframe-traceability,business-terminology-traceability,logging-boundaries,retirement,affected-l2} --self-test
scripts/check/standards-coverage --self-test
```

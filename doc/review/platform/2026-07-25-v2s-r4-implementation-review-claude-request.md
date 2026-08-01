---
title: R4 whole-scope implementation review request
status: REVIEW_PENDING
reviewTarget: IMPLEMENTATION
reviewCycleId: R4-W2-IMPLEMENTATION-20260725
implementationAuthority: true
businessStatus: NOT_APPLICABLE_R4_TECHNICAL_STEP
---

# R4 whole-scope implementation review request

## Scope and authority

Review R4-U01 through R4-U08 only. R4 is a technical verification step; it must not be read as a new business Journey, UI delivery, operations-admin real-login closure, R3-J02/C-02 recovery, TDP runtime, DEV start, seed, or reset authorization.

## Current evidence

- `scripts/check/standards-coverage --phase R4`: PASS, 150 rules.
- `scripts/verify --changed apps/backend/catering-business-server/src/test/java/r4/database/R4DatabaseBoundariesTest.java,contracts/openapi/edge.openapi.yaml`: PASS; business `NOT_APPLICABLE_R4_TECHNICAL_STEP`; cleanup PASS.
- Independent adversarial reviews: round 1 and final round 2, with author intake after each round. Round 2 found the initially missed semantic-routing mutation; the current matrix now has 78 active `R4_BOUNDARY_SEMANTICS_REVIEW` entries and was re-verified after repair. No third adversarial reviewer may be opened.

## Required review materials

- `doc/plans/platform/2026-07-25-v2s-r4-machine-gates-and-verification-implementation-design.md`
- `doc/review/platform/2026-07-25-v2s-r4-design-granularity-manifest.json`
- `contracts/policy/standards-coverage-matrix.json`
- `contracts/policy/r4-gate-catalog.json`
- `doc/evidence/platform/r4-*.json`
- `doc/review/platform/2026-07-25-v2s-r4-implementation-adversarial-review-round-{1,2}.json`
- `doc/review/platform/2026-07-25-v2s-r4-implementation-round-{1,2}-finding-intake.md`
- `scripts/verify`, `tools/r4-gates/`, `scripts/check/`, and the R4 backend tests.

## Mandatory review checks

1. Re-run the two commands above and verify the Testcontainers cleanup statement.
2. Confirm that finite machine predicates have real production-path red mutations, while the 78 semantic rules use the explicit checklist rather than a keyword scanner.
3. Confirm affected-L2 reports selection only and does not claim frontend behavior execution.
4. Confirm no prohibited R4 scope expansion.
5. Attach manifest Part B.1–B.6, Part C normative clauses, and Part D chapter-level hit mapping. A missing table makes the review incomplete and cannot yield GO/NO-GO.

Return `GO` or `NO_GO` with `M / S / N` counts, each finding's owning source/evidence, and an explicit statement whether R4 implementation is ready for Dexter acceptance.

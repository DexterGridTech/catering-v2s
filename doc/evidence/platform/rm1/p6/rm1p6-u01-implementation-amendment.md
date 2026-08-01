---
title: RM1 P6-1 implementation authorization and bounded execution amendment
status: ACTIVE_IMPLEMENTATION_DESIGN
packageId: RM1P6-U01
---

# P6-1 implementation authorization and bounded execution amendment

## 1. Business problem and authorization

P6-1 exists so an unauthenticated person can safely see the owning group workspace's name, logo and operations title, use password or OTP authentication, and recover a password through account name, the person's own mobile number and a one-time code. The owner facts must exist before either admin app renders them; a browser must not derive brand data from an asset reference or turn an administrator-issued reset chain into anonymous recovery.

The original business requirement sources are the P6 design's `G-01/G-02/G-03/G-04/G-05/G-07/G-09/G-10`, `P-U1...P-U5`, `P-Q1/P-Q5/P-Q7`, `ST-2/ST-6/ST-11`, and the accepted IA-01...IA-05 `BUSINESS_REQUIREMENT_SOURCE` citations. The implementation-facing design binds the exact P6-1 capability and user task in `rm1-u09-implementation-facing-design-and-three-phase-plan.md` §3.

Dexter authorized P6-1 implementation after the 2026-07-29 Claude recheck reached `GO (M=0 / S=0 / N=2)`, limited to the P6-1 contract/owner/edge capability and its tests. This amendment is that durable package-local authorization record; it does not alter the Roadmap or the accepted design bytes.

## 2. Bounded execution shape

The package may change only the four manifest-declared roots: `contracts/openapi`, `apps/backend/catering-business-server`, and each app's `src/app/api/generated` directory. It may add only additive owner schema evolution for canonical normalized platform mobile and opaque one-time recovery state. Generated wire is written only through the controlled edge generator.

P6-1 deliberately implements no page, feature, shell, foundation primitive or other UI path. P6-2 and P6-3 remain blocked until Dexter and Claude give P6-1 implementation `GO`.

## 3. Required proof and exclusions

Before package exit, owner/service and controller tests must prove the named OTP/recovery/brand invariants and real red mutations; OpenAPI and typed problem mappings must regenerate and check; the exact package changed-file set must equal non-empty incremental receipts; and business and cleanup evidence must be reported separately.

This authorization excludes P6-2/P6-3, any UI implementation, DEV, seed, reset, Roadmap state modification, and changes outside the four declared roots.

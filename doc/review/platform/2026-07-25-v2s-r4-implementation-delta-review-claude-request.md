---
title: R4 implementation Claude delta review request
status: REVIEW_PENDING
reviewTarget: IMPLEMENTATION_DELTA
authorization: existing R4 implementation authority only; no new business scope
---

# R4 implementation Claude delta review request

## Delta boundary

Review only the remediation after Claude's `NO-GO(1 M / 2 S / 2 N)`:

1. Mechanical rules are restored to real Gate/ArchUnit ownership rather than broadly routed to human review. The current R4 denominator is 34 GATE + 2 ARCHUNIT + 46 honest semantic/applicability checklist rows.
2. Gate predicates were deepened with production-path red mutations, including contract/server/frontend operation equality and prohibited backend dependency injection.
3. The first independent-review cycle has a limited, non-retroactive input-checklist exemption; no historic verdict was edited.
4. Runtime/test and executable tool names use stable capability names. `apps/` and `libraries/` scan zero; design-path and source-name controls each have a true red mutation. Dexter chose rename rather than a script/tool whitelist.

No new Journey, UI, operations-admin login, TDP runtime, DEV start, seed, reset, database topology, or contract behavior is authorized.

## Required materials

- `doc/review/platform/2026-07-25-v2s-r4-implementation-review-claude.md`
- `doc/review/platform/2026-07-25-v2s-r4-implementation-claude-finding-intake.md`
- `doc/decisions/2026-07-25-v2s-r4-first-independent-review-input-checklist-exemption.md`
- `doc/evidence/platform/2026-07-25-v2s-r4-capability-naming-remediation.json`
- `contracts/policy/standards-coverage-matrix.json` and `contracts/policy/r4-gate-catalog.json`
- `tools/verify-gates/{cli.mjs,verify.mjs,red-fixtures/README.md}`
- `tools/implementation-design-granularity/cli.mjs`, `tools/code-layout/cli.mjs`, `scripts/verify`
- `doc/evidence/platform/{r4-standards-coverage-evidence,r4-verify-evidence,r4-closure-readiness-evidence}.json`

## Required independent checks

1. Run `scripts/check/standards-coverage --phase R4`, `scripts/check/code-layout --self-test`, and `scripts/verify --changed apps/backend/catering-business-server/src/test/java/database/DatabaseBoundariesTest.java,apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/PlatformCommercialGroupController.java,contracts/openapi/edge.openapi.yaml`.
2. Verify every restored mechanical row has a truthful catalog/validator owner and a red mutation; challenge any remaining checklist row that can be decided without business judgment.
3. Confirm the capability-name scan is zero for apps/libraries and that no scripts/tools whitelist exists.
4. Confirm the exemption is bounded to the completed first cycle and does not rewrite the two historical independent verdicts.
5. Include manifest Part B.1–B.6, Part C normative clauses, and Part D chapter-level hit mapping. Missing any table is incomplete and cannot return GO/NO-GO.

Return `GO` or `NO_GO` with `M / S / N`, owning source/evidence for each finding, and an explicit conclusion on R4 implementation readiness for Dexter acceptance.

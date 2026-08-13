# DB call reduction DESIGN review input checklist

REVIEW_CYCLE_ID=DB_CALL_REDUCTION_DESIGN_20260812  
REVIEW_TARGET=DESIGN  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
blindReview=true

Reviewer must read the following bytes before verdict:

- `AGENTS.md`
- `doc/review/platform/2026-08-12-v2s-db-call-reduction-requirements-claude.md`
- `doc/plans/platform/2026-08-12-v2s-db-call-reduction-implementation-design-codex.md`
- `doc/evidence/platform/2026-08-12-v2s-db-call-reduction-design-authorization.md`
- `doc/evidence/platform/2026-08-12-v2s-db-call-reduction-design-package-input.json`
- `doc/evidence/platform/2026-08-12-v2s-db-call-reduction-design-granularity-manifest.json`
- `contracts/registry/operation-handler-bindings.json`
- `CatalogInventoryCoordinator`, three owner service sources and `BusinessEntityService`
- five coordinated-owner adapter sources and both backend-performance generators
- `tools/performance/canonical-ledger-scanner.mjs`
- `doc/evidence/platform/rm1/p4/canonical-performance-ledger.json`
- `P4SqlOperationBudgetTest.java`
- `scripts/test/compare-backend-performance-seed-reports.mjs`

Blind-order rule: first inspect requirements/design/owning source and form a falsification verdict; do not read author intake or handoff before the verdict. Review all DBCR-01..05 and specifically challenge: 721/730 truthfulness, 16 transaction chain completeness, owner derivation false positives, method-vs-HTTP measurement boundaries, accepted baseline bypass, comparator direction, and one-batch/one-review authorization boundaries.

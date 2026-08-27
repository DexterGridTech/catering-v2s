# base-1 requirements post-intake independent review round 1 input checklist

- REVIEW_CYCLE_ID: `BASE1-REQUIREMENTS-2026-08-27-POST-INTAKE-CODEX-INDEPENDENT`
- REVIEW_TARGET: `DESIGN`
- ACTION_1_VARIANT: `1-B`
- REVIEW_ROUND: `1`
- REVIEW_ROUND_LIMIT: `2`
- reviewerKind: `INDEPENDENT_SUBAGENT`
- Scope: static-only adversarial review of `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md`
- Blind declaration: I did not read prior base-1 review conclusions or round artifacts before forming this verdict. I derived findings from the current requirements, repository standards, routed project memory, and owning source.
- Prohibited and not run: tests, runtime, DEV, reset, seed, L2, UAT, data/deploy, destructive actions, source edits.

## Inputs reopened

1. `.agents/skills/cs-review/SKILL.md`
2. `AGENTS.md`
3. `PLATFORM-BLUEPRINT.md`
4. `doc/platform/README.md`
5. `doc/platform/roadmap-program-registry.json`
6. `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`
7. `doc/platform/review-standard.md`
8. `project-memory/operations/verification-governance.md`
9. `doc/decisions/2026-07-24-v2s-verification-governance.md`
10. `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`
11. `project-memory/decisions/deterministic-context-only.md`
12. `doc/decisions/templates/implementation-design-template.md`
13. `doc/decisions/templates/ia-design-template.md`
14. `doc/decisions/templates/ui-interaction-design-template.md`
15. `doc/decisions/templates/journey-decision-template.md`
16. `doc/platform/backend-coding-standard.md` sections 1-J, 1-K, 1-L, 1-M, 1-N, 2-H, 2-I
17. `doc/platform/foundation-charter.md` section 1-H
18. `project-memory/decisions/owner-read-model-and-lifecycle-standard.md`
19. `project-memory/practices/read-model-granularity.md`
20. `project-memory/pitfalls/acceptance-scenario-count-freeze.md`
21. `project-memory/decisions/confirmed-business-language-corpus.md` G-07 and G-08
22. `CLAUDE.md` lines 55-67 area
23. `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`
24. `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java`
25. `scripts/README.md`
26. Current requirements: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md`

## Owning source and static scans used

1. Operation count and budget sources:
   - `scripts/generate/backend-performance-budget.mjs`
   - `scripts/generate/operation-handler-bindings.mjs`
   - `scripts/test/backend-performance-operation-reconciliation.mjs`
   - `scripts/test/r5-remote-testcontainers.mjs`
   - `contracts/policy/backend-performance-cp05-calibration-report.json`
2. Invitation and IAM lifecycle sources:
   - `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceInvitationService.java`
   - `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceRoleService.java`
   - `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationTaskPathService.java`
   - `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationAssignmentCandidateService.java`
   - `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OrganizationAssignmentCandidateLookup.java`
3. ARCHIVED lifecycle sources:
   - `apps/backend/catering-business-server/src/main/resources/db/migration/V20260806_120000_000__catalog_inventory_backend.sql`
   - `apps/backend/catering-business-server/src/main/resources/db/migration/V20260814_100000_000__catalog_p3_model.sql`
   - `apps/backend/catering-business-server/src/main/resources/db/migration/V20260816_020000_000__catalog_sku_voided_code_release.sql`
   - `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogSkuFacts.java`
   - `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java`
   - `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts`
   - `apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/useCatalogBatchActionController.ts`
   - `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogBatchActionModal.tsx`
   - `apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/CatalogWorkbenchController.tsx`
   - `contracts/catalog/catalogInventoryShapeManifest.ts`
   - `contracts/catalog/catalog-inventory-edge-contract.json`
4. Assembly mechanism sources:
   - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/contract/PlatformContractOverviewController.java`
   - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/operations/CopyPreflightWireShape.java`
   - `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java`

## Evidence boundary

This review is static source/document review only. I did not prove runtime behavior, database contents, generated artifact freshness, or HTTP/browser behavior.

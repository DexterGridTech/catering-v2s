# 商品定义库 implementation independent review Round 2 输入清单

```text
REVIEW_CYCLE_ID=CATALOG_DEFINITION_LIBRARY_IMPLEMENTATION_20260820
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerKindDeclaration=FRESH_INDEPENDENT_SUBAGENT; ROUND_1_ONLY_AS_ATTACK_LIST
```

本轮只复核当前源码、契约、生成物、前端、acceptance 与最新受管运行证据；Round 1 verdict/disposition 只作为待证伪攻击清单，不能替代 owning-source 重开。不得修改生产代码，不得执行 reset、seed、DEV、浏览器 L2、UAT 或 Git。

## 必读规则与裁判标准

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/review-standard.md`
- `doc/platform/backend-coding-standard.md`
- `doc/platform/frontend-coding-standard.md`
- `doc/platform/foundation-charter.md`
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/operations/verification-governance.md`
- `project-memory/operations/backend-acceptance.md`
- `project-memory/operations/implementation-source-reread-discipline.md`

## 本批原始需求与设计

- `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md`
- `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ia.md`
- `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ui-interaction.md`
- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md`
- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-requirements-discussion-codex.md`
- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-implementation-design.md`
- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-serial-plan.md`

## Round 1 待证伪输入

- `doc/review/platform/2026-08-20-v2s-catalog-definition-library-implementation-independent-review-round-1-claude.md`
- `doc/review/platform/2026-08-20-v2s-catalog-definition-library-implementation-round-1-disposition-codex.md`

## Owning source / contract / generated / UI closure

- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260820_010000_000__catalog_item_definition_libraries.sql`
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260820_010000_001__retire_item_attribute_json_and_order_option_relations.sql`
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260820_010000_002__catalog_order_option_definition_business_codes.sql`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogDefinitionFacts.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemDefinitionFacts.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java`
- `contracts/catalog/CatalogInventoryEdgeWire.java`
- `contracts/catalog/catalog-inventory-edge-contract.json`
- `contracts/openapi/catalog-inventory.openapi.json`
- `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts`
- `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.rtk.ts`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDefinitionLibraries.tsx`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx`
- `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts`

## Acceptance and latest dynamic evidence

- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787224951000-11286/run-manifest.json`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787224951000-11286/backend-acceptance-result.jsonl`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787224951000-11286/http-request-events.jsonl`
- `.runtime/r5/evidence/remote-testcontainers/r5-tc-1787224951000-11286/gradle.log`

动态边界必须分别报告 business、cleanup 与未执行的 browser L2/DEV/seed/UAT；真实 HTTP acceptance 不得冒充浏览器 L2。

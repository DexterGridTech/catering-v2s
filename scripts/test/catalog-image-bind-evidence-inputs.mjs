import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

const targetPaths = {
  contract: [
    'doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json',
    'contracts/policy/catalog-inventory-design-byte-coverage.json',
    'contracts/openapi/catalog-inventory.openapi.yaml',
    'contracts/openapi/components/catalog/catalog-workbench.schemas.yaml',
    'contracts/openapi/paths/operations-admin/catalog-item-management.paths.yaml',
    'scripts/generate/catalog-inventory-p1.mjs',
    'scripts/generate/catalog-inventory-p3-frontend.mjs',
  ],
  source: [
    'apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java',
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java',
    'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java',
    'apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts',
    'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx',
  ],
  test: [
    'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/cataloginventory/CatalogInventoryAssetLifecycleTest.java',
    'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogManagementPage.test.tsx',
    'apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts',
    'scripts/test/catalog-inventory-api.mjs',
    'scripts/test/catalog-inventory-l2-test-fixture.mjs',
  ],
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Hashes only the current image bind-grant proof surface, never request data or secrets. */
export function catalogImageBindEvidenceInputs(root) {
  return Object.fromEntries(Object.entries(targetPaths).map(([kind, paths]) => [kind, Object.fromEntries(paths.map((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    if (!existsSync(absolutePath)) throw new Error(`CATALOG_IMAGE_BIND_EVIDENCE_INPUT_MISSING:${relativePath}`);
    return [relativePath, sha256(readFileSync(absolutePath))];
  }))]));
}

export const catalogImageBindEvidenceTargetPaths = Object.freeze(targetPaths);

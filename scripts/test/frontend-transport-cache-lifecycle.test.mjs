import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => readFileSync(path.join(root, relative), 'utf8');
const operationsTransport = read('apps/frontend/operations-admin/src/app/api/OperationsTransport.ts');
const platformTransport = read('apps/frontend/platform-admin/src/app/api/PlatformTransport.ts');
const operationsApp = read('apps/frontend/operations-admin/src/app/OperationsApp.tsx');
const platformApp = read('apps/frontend/platform-admin/src/app/PlatformApp.tsx');
const catalogGenerator = read('scripts/generate/catalog-inventory-p3-frontend.mjs');
const catalogEdge = read('apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts');
const catalogRtk = read('apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.rtk.ts');
const operationsRtk = read('apps/frontend/operations-admin/src/app/api/generated/operations-edge.rtk.ts');
const operationsApi = read('apps/frontend/operations-admin/src/app/api/OperationsApi.ts');
const catalogWorkbench = read(
  'apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/CatalogWorkbenchController.tsx',
);
const catalogWorkbenchReadModel = read(
  'apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/useCatalogWorkbenchReadModel.tsx',
);
const catalogItemViewDrawer = read(
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemViewDrawer.tsx',
);
const catalogItemEditorState = read(
  'apps/frontend/operations-admin/src/features/catalog-management/ui/useCatalogItemEditorWorkspaceState.tsx',
);
const catalogDefinitionLibraries = read(
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDefinitionLibraries.tsx',
);
const catalogModel = read('apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts');
const catalogDictionaryDrawer = read(
  'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawerState.tsx',
);
const localCatalogCopyDrawer = read(
  'apps/frontend/operations-admin/src/features/catalog-management/ui/LocalCatalogCopyDrawer.tsx',
);
const brandCatalogCopyDrawer = read(
  'apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx',
);
const inventoryDetailDrawer = read(
  'apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryDetailDrawer.tsx',
);
const inventoryManagementPage = read(
  'apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx',
);
const catalogContract = JSON.parse(read('contracts/catalog/catalog-inventory-edge-contract.json'));
const catalogTagPolicy = JSON.parse(read('contracts/catalog/catalog-inventory-rtk-tag-policy.json'));
const salesMenuTagPolicy = JSON.parse(read('contracts/policy/sales-menu-rtk-tag-policy.json'));
const edgeCatalog = JSON.parse(read('doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json'));
const salesMenuPage = read('apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx');

test('command transports release RTK query and mutation lifecycle state', () => {
  for (const source of [operationsTransport, platformTransport]) {
    assert.match(source, /initiate\(request, [\s\S]*?\{subscribe: false\} : \{track: false\}\)/);
    assert.match(source, /finally \{[\s\S]*pending\.unsubscribe\?\.\(\);[\s\S]*pending\.reset\?\.\(\);[\s\S]*\}/);
    assert.doesNotMatch(source, /initiate\(request\)\s+as never/);
  }
});

test('catalog-inventory RTK generation uses the policy-defined fact tags', () => {
  const getCount = catalogContract.operations.filter(operation => operation.method === 'GET').length;
  const mutationCount = catalogContract.operations.length - getCount;
  assert.match(catalogGenerator, /providesTags/);
  assert.match(catalogGenerator, /invalidatesTags/);
  assert.equal((catalogRtk.match(/providesTags:/g) ?? []).length, getCount);
  assert.equal((catalogRtk.match(/invalidatesTags:/g) ?? []).length, mutationCount);
  assert.equal(catalogTagPolicy.operationCount, catalogContract.operations.length);
  assert.equal(catalogTagPolicy.operations.length, catalogContract.operations.length);
  assert.match(operationsApi, /tagTypes: \['wire', 'catalogInventory', 'salesMenu'\]/);
  assert.match(catalogRtk, /type: "catalogInventory"/);
  assert.match(catalogRtk, /resolveCatalogInventoryTags/);
  assert.match(catalogRtk, /catalog-item-ref/);
  assert.match(catalogRtk, /production-tag-ref/);
  assert.match(catalogRtk, /inventory-target/);
  assert.match(catalogRtk, /if \(descriptor\.kind === "static"\)[\s\S]*id: descriptor\.id/);
  assert.doesNotMatch(catalogRtk, /add\(descriptor\.id, descriptor\.id\)/);
  assert.doesNotMatch(catalogRtk, /id: "LIST"/);
  assert.doesNotMatch(catalogRtk, /id: request\.operationId/);
  assert.match(operationsRtk, /createOperationsAdminRtkEndpoints<TagTypes extends OperationsAdminRtkTagType = "wire">/);
  for (const operation of catalogTagPolicy.operations)
    assert.match(catalogRtk, new RegExp(`${operation.operationId}: build\\.`));
});

test('sales-menu RTK generation uses scoped policy tags and one automatic refresh chain', () => {
  const salesMenuOperations = edgeCatalog.operations.filter(
    operation => operation.face === 'operations-admin' && operation.path.includes('/sales-menus'),
  );
  assert.equal(salesMenuTagPolicy.operationCount, salesMenuOperations.length);
  assert.equal(salesMenuTagPolicy.operations.length, salesMenuOperations.length);
  assert.equal(salesMenuTagPolicy.tagType, 'salesMenu');
  assert.match(operationsApi, /tagTypes: \['wire', 'catalogInventory', 'salesMenu'\]/);
  assert.match(operationsRtk, /OperationsAdminRtkTagType = "wire" \| "catalogInventory" \| "salesMenu"/);
  assert.match(operationsRtk, /resolveSalesMenuTags/);
  for (const operation of salesMenuTagPolicy.operations) {
    const start = operationsRtk.indexOf(`    ${operation.operationId}: build.`);
    assert.notEqual(start, -1, `missing generated endpoint ${operation.operationId}`);
    const next = operationsRtk.indexOf('\n    }),', start + 5);
    const endpoint = operationsRtk.slice(start, next === -1 ? operationsRtk.length : next);
    assert.doesNotMatch(endpoint, /id: "LIST"/);
    if (operation.provides.length > 0 || operation.invalidates.length > 0)
      assert.match(endpoint, /resolveSalesMenuTags/);
    for (const descriptor of [...operation.provides, ...operation.invalidates]) {
      assert.notEqual(descriptor.id, 'LIST');
    }
  }
  for (const operationId of [
    'createOperationsSalesMenuSection',
    'renameOperationsSalesMenuSection',
    'deleteOperationsSalesMenuSection',
    'moveOperationsSalesMenuSection',
  ]) {
    const operation = salesMenuTagPolicy.operations.find(candidate => candidate.operationId === operationId);
    assert.ok(operation, `missing sales-menu section policy: ${operationId}`);
    assert.equal(
      operation.invalidates.some(
        descriptor => descriptor.kind === 'static' && descriptor.id === 'sales-menu-draft-items',
      ),
      false,
      `${operationId} must not refetch an unaffected selected-section item collection`,
    );
    assert.equal(
      operation.invalidates.some(
        descriptor => descriptor.kind === 'requestPath' && descriptor.prefix === 'sales-menu-section',
      ),
      false,
      `${operationId} must not invalidate an unchanged section item collection`,
    );
  }
  for (const operationId of [
    'getOperationsSalesMenuDraftSections',
    'getOperationsSalesMenuDraftItems',
    'getOperationsSalesMenuDraftItem',
    'getOperationsSalesMenuPublishedSections',
    'getOperationsSalesMenuPublishedItems',
    'getOperationsSalesMenuPublishedItem',
    'getOperationsSalesMenuItemCandidates',
    'getOperationsSalesMenuPublicationPreview',
    'getOperationsSalesMenuOperationRecords',
  ]) {
    const operation = salesMenuTagPolicy.operations.find(candidate => candidate.operationId === operationId);
    assert.ok(operation, `missing sales-menu read policy: ${operationId}`);
    assert.equal(
      operation.provides.some(descriptor => descriptor.kind === 'requestPath' && descriptor.prefix === 'sales-menu'),
      false,
      `${operationId} must not share the menu-detail invalidation tag`,
    );
  }
  const schedule = salesMenuTagPolicy.operations.find(
    operation => operation.operationId === 'updateOperationsSalesMenuSchedule',
  );
  assert.ok(schedule);
  assert.ok(
    schedule.invalidates.some(
      descriptor => descriptor.kind === 'requestPath' && descriptor.prefix === 'sales-menu-store',
    ),
    'schedule changes must refresh the manager list scope',
  );
  assert.ok(
    schedule.invalidates.some(descriptor => descriptor.kind === 'static' && descriptor.id === 'sales-menu-list'),
    'schedule changes must refresh the manager list read model',
  );
  assert.doesNotMatch(salesMenuPage, /const result = await operation\(\);\s*await read\.refresh\(\);/);
  assert.doesNotMatch(salesMenuPage, /await commands\.updateItem\([\s\S]*?\);\s*await read\.refresh\(\);/);
  assert.doesNotMatch(salesMenuPage, /await commands\.addItems\([\s\S]*?\);\s*await read\.refresh\(\);/);
});

test('catalog-inventory content refresh reaches every open read model without overwriting drafts', () => {
  assert.doesNotMatch(catalogWorkbench, /finishCategoryAction\(\);\s*refresh\(\)/);
  assert.doesNotMatch(catalogWorkbench, /setSelectedRows\(\[\]\);\s*refresh\(\)/);
  assert.doesNotMatch(catalogWorkbench, /onChanged=\{refresh\}|onCompleted=\{refresh\}/);

  assert.doesNotMatch(catalogItemViewDrawer, /onChanged/);
  assert.match(catalogItemViewDrawer, /await detailQuery\.refetch\(\);/);
  assert.match(catalogItemViewDrawer, /onClick=\{\(\) => void detailQuery\.refetch\(\)\}/);
  assert.match(catalogItemEditorState, /const refetchDetail = detailQuery\.refetch;/);
  assert.match(catalogItemEditorState, /void refetchDetail\(\);/);
  assert.match(catalogItemEditorState, /useRefreshVersion\(operationsContentTabRefreshSignal\)/);
  assert.doesNotMatch(localCatalogCopyDrawer, /onCompleted/);
  assert.match(localCatalogCopyDrawer, /onComplete=\{onClose\}/);
  assert.doesNotMatch(brandCatalogCopyDrawer, /onCompleted/);

  assert.match(catalogWorkbenchReadModel, /useRefreshVersion\(operationsContentTabRefreshSignal\)/);
  assert.match(catalogDictionaryDrawer, /useRefreshVersion\(operationsContentTabRefreshSignal\)/);
  assert.match(catalogDictionaryDrawer, /const refetchProduction = productionQuery\.refetch;/);
  assert.match(catalogDictionaryDrawer, /void refetchProduction\(\);/);
  assert.match(catalogDictionaryDrawer, /const refetchDictionary = dictionaryQuery\.refetch;/);
  assert.match(catalogDictionaryDrawer, /void refetchDictionary\(\);/);
  assert.match(catalogDictionaryDrawer, /const refetchAttributeValues = attributeValuesQuery\.refetch;/);
  assert.match(catalogDictionaryDrawer, /void refetchAttributeValues\(\);/);
  assert.match(catalogDefinitionLibraries, /useRefreshVersion\(operationsContentTabRefreshSignal\)/);

  assert.doesNotMatch(inventoryDetailDrawer, /refreshAll|onListChanged|onCompleted/);
  assert.ok((inventoryDetailDrawer.match(/\.refetch\(\)/g) ?? []).length >= 4);
  assert.match(inventoryDetailDrawer, /useRefreshVersion\(operationsContentTabRefreshSignal\)/);
  assert.doesNotMatch(inventoryManagementPage, /onListChanged/);
  assert.match(inventoryManagementPage, /useRefreshVersion\(operationsContentTabRefreshSignal\)/);

  const itemDetail = catalogTagPolicy.operations.find(
    operation => operation.operationId === 'getOperationsCatalogItem',
  );
  assert.ok(
    itemDetail.provides.some(descriptor => descriptor.kind === 'static' && descriptor.id === 'catalog-item-detail'),
  );
  assert.ok(
    itemDetail.provides.some(
      descriptor =>
        descriptor.kind === 'responseArrayValue' &&
        descriptor.prefix === 'production-tag-ref' &&
        descriptor.arrayPath.join('.') === 'data.productionTags' &&
        descriptor.valuePath === 'tagRef',
    ),
  );
  for (const operationId of [
    'createOperationsProductionTag',
    'updateOperationsProductionTag',
    'transitionOperationsProductionTagStatus',
  ]) {
    const operation = catalogTagPolicy.operations.find(candidate => candidate.operationId === operationId);
    assert.ok(
      operation.invalidates.some(
        descriptor =>
          descriptor.kind === 'responsePath' &&
          descriptor.prefix === 'production-tag-ref' &&
          descriptor.path.join('.') === 'tagRef',
      ),
      `missing production-tag-ref invalidation for ${operationId}`,
    );
  }

  for (const operationId of ['executeOperationsLocalCatalogCopy', 'executeOperationsBrandCatalogCopy']) {
    const entry = catalogTagPolicy.operations.find(operation => operation.operationId === operationId);
    assert.ok(
      entry.invalidates.some(
        descriptor =>
          descriptor.kind === 'responseArrayValue' &&
          descriptor.prefix === 'catalog-item-ref' &&
          descriptor.arrayPath.join('.') === 'data.targetVersions' &&
          descriptor.valuePath === 'targetRef',
      ),
    );
    assert.equal(
      entry.invalidates.some(
        descriptor =>
          descriptor.kind === 'responseArrayValue' &&
          descriptor.prefix === 'inventory-target' &&
          descriptor.arrayPath.join('.') === 'data.targetVersions',
      ),
      false,
    );
  }

  for (const operationId of [
    'createOperationsCatalogAttributeDefinition',
    'updateOperationsCatalogAttributeDefinition',
    'createOperationsCatalogOrderOptionDefinition',
    'updateOperationsCatalogOrderOptionDefinition',
  ]) {
    const operation = catalogTagPolicy.operations.find(candidate => candidate.operationId === operationId);
    assert.ok(
      operation.invalidates.some(descriptor => descriptor.kind === 'static' && descriptor.id === 'catalog-item-detail'),
      `missing current detail invalidation for ${operationId}`,
    );
  }
});

test('definition library preserves every material, searches candidates by cursor, and labels copy blocks for users', () => {
  assert.match(catalogDefinitionLibraries, /type OrderOptionForm[\s\S]*values: OrderOptionDefinitionFormValue\[\]/);
  assert.match(catalogDefinitionLibraries, /hydrateOrderOptionDefinitionValues\(definition\.values\)/);
  assert.match(catalogDefinitionLibraries, /serializeOrderOptionDefinitionValues\(values\.values\)/);
  assert.match(catalogDefinitionLibraries, /useCursorCandidates<MaterialCandidate>/);
  assert.match(
    catalogDefinitionLibraries,
    /onPopupScroll=\{event =>\s*onMaterialCandidatePopupScroll\(event,\s*inventoryQuery\.isFetching\)/,
  );
  assert.match(
    catalogDefinitionLibraries,
    /name=\{\[field\.name, 'materials'\]\}[\s\S]*orderOptionMaterialRefs[\s\S]*orderOptionMaterialsFromRefs/,
  );
  assert.match(catalogDefinitionLibraries, /<Select[\s\S]*mode="multiple"[\s\S]*style=\{\{width: '100%'\}\}/);
  assert.doesNotMatch(catalogDefinitionLibraries, /<Form\.List name=\{\[field\.name, 'materials'\]\}/);
  assert.doesNotMatch(catalogDefinitionLibraries, /添加原料商品/);
  assert.doesNotMatch(catalogDefinitionLibraries, /pageSize:\s*200/);

  for (const operationId of ['preflightOperationsBrandCatalogCopy', 'executeOperationsBrandCatalogCopy']) {
    const operation = catalogContract.operations.find(candidate => candidate.operationId === operationId);
    assert.ok(operation.problemCodes.includes('CATALOG_COPY_DEFINITION_CONFLICT'));
  }
  assert.match(catalogEdge, /CATALOG_COPY_DEFINITION_CONFLICT/);
  assert.match(catalogModel, /CATALOG_ORDER_OPTION_DEFINITION: '点单选项'/);
});

test('current-page refresh invalidates active queries without remounting page state', () => {
  assert.match(
    operationsTransport,
    /refreshOperationsCurrentPage[\s\S]*invalidateTags\(\[\s*\{type: 'wire', id: 'LIST'\}/,
  );
  assert.match(
    operationsTransport,
    /refreshOperationsCurrentPage[\s\S]*operationsContentTabRefreshSignal\.publish\(\)/,
  );
  assert.match(platformTransport, /refreshPlatformCurrentPage[\s\S]*invalidateTags\(\[\s*\{type: 'wire', id: 'LIST'\}/);
  assert.match(operationsApp, /onClick=\{refreshOperationsCurrentPage\}/);
  assert.match(platformApp, /onClick=\{refreshPlatformCurrentPage\}/);
  assert.doesNotMatch(operationsApp, /pageReload|setPageReload/);
  assert.doesNotMatch(platformApp, /pageReload|setPageReload/);
});

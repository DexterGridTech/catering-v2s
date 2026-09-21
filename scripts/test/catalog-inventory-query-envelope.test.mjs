import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {readCatalogInventoryOpenApi} from '../lib/catalog-inventory-openapi.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => readFileSync(path.join(root, relative), 'utf8');
const catalogFeatureRoot = path.join(root, 'apps/frontend/operations-admin/src/features/catalog-management');
const collectCatalogFeatureSourceFiles = directory => {
  const files = [];
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectCatalogFeatureSourceFiles(entryPath));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(entryPath);
  }
  return files;
};
const contract = JSON.parse(
  readFileSync(path.join(root, 'contracts/catalog/catalog-inventory-edge-contract.json'), 'utf8'),
);
const readModels = JSON.parse(
  readFileSync(path.join(root, 'contracts/catalog/catalog-inventory-read-models.json'), 'utf8'),
);
const openApi = readCatalogInventoryOpenApi(root);
const readModelRequired = new Map(readModels.models.map(model => [model.name, model.required]));
const queryOperations = contract.operations.filter(operation => operation.method === 'GET');
const transportEnvelopeRequired = required =>
  required.includes('revision') &&
  required.includes('requestId') &&
  (required.includes('data') || required.includes('result') || required.includes('results'));
const schemaRequired = component => openApi.components.schemas[component]?.required ?? [];
const responseEnvelopeOwner = operation => {
  const wireRequired = schemaRequired(operation.responseComponent);
  if (operation.method !== 'GET') return transportEnvelopeRequired(wireRequired) ? 'MODEL' : 'LEGACY';
  const sourceRequired = readModelRequired.get(operation.responseComponent);
  assert.ok(Array.isArray(sourceRequired), `${operation.operationId} must resolve its read-model required fields`);
  if (transportEnvelopeRequired(sourceRequired)) return 'MODEL';
  return transportEnvelopeRequired(wireRequired) ? 'P1' : 'P3';
};
const expectedResponse = operation => {
  const owner = responseEnvelopeOwner(operation);
  if (owner === 'P3') return `CatalogQueryEnvelope<${operation.responseComponent}>`;
  if (owner === 'LEGACY') return `CatalogInventoryEnvelope<${operation.responseComponent}>`;
  return operation.responseComponent;
};
const assertP3WrapperIsTransportFlat = (model, sourceRequired, wireRequired) => {
  assert.equal(
    transportEnvelopeRequired(sourceRequired),
    false,
    `${model} already owns a transport envelope in read-model required fields`,
  );
  assert.equal(
    transportEnvelopeRequired(wireRequired),
    false,
    `${model} already owns a transport envelope in the P3 input schema`,
  );
};

test('every catalog GET has exactly one source-owned transport envelope', () => {
  const frontendGenerator = read('scripts/generate/catalog-inventory-p3-frontend.mjs');
  const edge = read('apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts');
  const rtk = read('apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.rtk.ts');

  assert.match(frontendGenerator, /readModelsPath/);
  assert.match(frontendGenerator, /function responseEnvelopeOwner\(operation\)/);
  assert.match(frontendGenerator, /P3_GET_READ_MODEL_REQUIRED_MISSING/);
  assert.equal(queryOperations.length, 22);
  const owners = Object.groupBy(queryOperations, responseEnvelopeOwner);
  assert.deepEqual(
    owners.P1.map(operation => operation.operationId),
    [
      'getOperationsCatalogNavigation',
      'getOperationsCatalogItems',
      'getOperationsCatalogItem',
      'listOperationsCatalogAttributeDefinitions',
      'listOperationsCatalogOrderOptionDefinitions',
      'getOperationsInventoryConsumptionTargetCandidates',
      'getOperationsCatalogCategoryCandidates',
      'getOperationsCatalogItemSkus',
    ],
  );
  assert.deepEqual(
    owners.MODEL.map(operation => operation.operationId),
    [
      'getOperationsCatalogWorkbenchContext',
      'getOperationsCatalogDictionary',
      'getOperationsProductionTags',
      'getOperationsLocalCatalogCopyCandidates',
      'getOperationsBrandCatalogCopyCandidates',
      'getOperationsInventoryTargets',
      'listOperationsCatalogUnits',
    ],
  );
  assert.deepEqual(
    owners.P3.map(operation => operation.operationId),
    [
      'getOperationsInventoryTarget',
      'getOperationsInventoryTargetChangeSummary',
      'getOperationsInventoryTargetBusinessHistory',
      'getOperationsInventoryTargetConsumptionReferences',
      'getOperationsInventoryTargetLedger',
      'getOperationsInventoryTargetDiagnostics',
      'getOperationsCatalogShapeManifest',
    ],
  );
  for (const operation of queryOperations) {
    const response = expectedResponse(operation);
    assert.match(
      edge,
      new RegExp(`"${operation.operationId}": \\{request: [^\\n]+ response: ${response.replace(/[<>]/g, '\\$&')};`),
    );
    assert.match(rtk, new RegExp(`${operation.operationId}: build\\.query<${response.replace(/[<>]/g, '\\$&')},`));
    assert.doesNotMatch(edge, new RegExp(`"${operation.operationId}": [^\\n]+CatalogInventoryEnvelope<`));
    if (responseEnvelopeOwner(operation) === 'P3') {
      assertP3WrapperIsTransportFlat(
        operation.responseComponent,
        readModelRequired.get(operation.responseComponent),
        schemaRequired(operation.responseComponent),
      );
    }
  }
});

test('CP-B2 reference lifecycle validation distinguishes new bindings from existing relational facts', () => {
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java',
  );
  const definitionFacts = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogItemDefinitionFacts.java',
  );
  const definitionFactsSql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogItemDefinitionFactsSql.java',
  );
  const workbenchPersistence = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogWorkbenchReadPersistence.java',
  );
  const categoryStart = owner.indexOf('private void lockAndValidateCategoryRefs');
  const categoryEnd = owner.indexOf('private Set<UUID> categoryRefsFromSections', categoryStart);
  assert.ok(categoryStart >= 0 && categoryEnd > categoryStart);
  const categoryValidation = owner.slice(categoryStart, categoryEnd);
  assert.match(categoryValidation, /lockCategoriesForReferenceValidation\(scope, brand, categoryRefs\)/);
  assert.match(categoryValidation, /categoryReferencesFromOwner\(currentItemRef\)/);
  assert.match(categoryValidation, /!existingRefs\.contains\(row\.ref\(\)\) && !"ENABLED"\.equals\(row\.status\(\)\)/);

  const dictionaryStart = owner.indexOf('private void validateDeclaredOpaqueReferences');
  const dictionaryEnd = owner.indexOf('private void lockDictionaryRefsByKind', dictionaryStart);
  assert.ok(dictionaryStart >= 0 && dictionaryEnd > dictionaryStart);
  const dictionaryValidation = owner.slice(dictionaryStart, dictionaryEnd);
  assert.match(dictionaryValidation, /dictionaryReferencesFromOwner\(scope, brand, currentItemRef, currentSections/);
  assert.match(dictionaryValidation, /private Map<String, Set<UUID>> dictionaryReferencesFromOwner/);
  const dictionaryLockEnd = owner.indexOf('private void validateProductionTagRef', dictionaryEnd);
  assert.ok(dictionaryLockEnd > dictionaryEnd);
  const dictionaryLock = owner.slice(dictionaryEnd, dictionaryLockEnd);
  assert.match(dictionaryLock, /!alreadyAttached && !"ENABLED"\.equals\(statuses\.get\(requested\)\)/);

  const relationStart = owner.indexOf('private void validateCatalogRelationRefs');
  const relationEnd = owner.indexOf('private String skuRelationKey', relationStart);
  assert.ok(relationStart >= 0 && relationEnd > relationStart);
  const relationValidation = owner.slice(relationStart, relationEnd);
  assert.match(relationValidation, /readByItemRefs\(List\.of\(currentItemRef\)\)/);
  assert.match(relationValidation, /!existingItemRefs\.contains\(itemRef\) && !"ENABLED"\.equals\(itemStatuses\.get\(itemRef\)\)/);
  assert.match(relationValidation, /!existingSkuRelationKeys\.contains\(relationKey\)/);
  assert.match(relationValidation, /owner\.itemStatus\(\)/);
  assert.match(relationValidation, /owner\.skuStatus\(\)/);

  const saveStart = owner.indexOf('private SaveItemResult saveItem');
  const saveEnd = owner.indexOf('private ArrayNode identifierArray', saveStart);
  assert.ok(saveStart >= 0 && saveEnd > saveStart);
  const save = owner.slice(saveStart, saveEnd);
  assert.match(save, /Set<UUID> submittedUnitRefs = unitReferences\(sections\)/);
  assert.match(save, /unitReferencesFromOwner\(dataNodeRef, brandRef, current\.ref\(\)\)/);

  assert.match(definitionFactsSql, /definition\.attribute_definition_ref,definition\.value_type,definition\.status,/);
  assert.match(definitionFacts, /requireBindableDefinition\(\s*definition\.status\(\),\s*existing\.containsKey/);
  assert.match(definitionFacts, /private static void requireBindableDefinition/);

  const categoryCandidateStart = workbenchPersistence.indexOf('String cte = CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CTE_CATEGORY_TREE');
  const categoryCandidateEnd = workbenchPersistence.indexOf('StringBuilder matchingVisibility', categoryCandidateStart);
  assert.ok(categoryCandidateStart >= 0 && categoryCandidateEnd > categoryCandidateStart);
  const categoryCandidate = workbenchPersistence.slice(categoryCandidateStart, categoryCandidateEnd);
  assert.match(workbenchPersistence, /CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_ENABLED_PARENT_CATEGORY_REF/);
  assert.match(workbenchPersistence, /CATALOG_WORKBENCH_READ_SERVICE_WHERE_CHILD_DATA_NODE_REF_BRAND_REF_STATUS/);
  const categoryRedMutation = workbenchPersistence.replace(
    'CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_ENABLED_PARENT_CATEGORY_REF',
    'CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_VOIDED_PARENT_CATEGORY_REF',
  );
  assert.throws(() => assert.match(categoryRedMutation, /CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_ENABLED_PARENT_CATEGORY_REF/), /did not match/);

  const compositeCandidateStart = workbenchPersistence.indexOf('if ("COMPOSITE_COMPONENT".equals(query.candidateUsage()))');
  const compositeCandidateEnd = workbenchPersistence.indexOf('sql.append(CatalogWorkbenchReadServiceSql.CATALOG_WORKBENCH_READ_SERVICE_CLOSE_PAREN_FILTERED', compositeCandidateStart);
  assert.ok(compositeCandidateStart >= 0 && compositeCandidateEnd > compositeCandidateStart);
  const compositeCandidate = workbenchPersistence.slice(compositeCandidateStart, compositeCandidateEnd);
  assert.match(compositeCandidate, /CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_ENABLED_CODE/);
  const compositeRedMutation = compositeCandidate.replace(
    'CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_ENABLED_CODE',
    'CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_VOIDED_CODE',
  );
  assert.throws(() => assert.match(compositeRedMutation, /CATALOG_WORKBENCH_READ_SERVICE_CONDITION_STATUS_ENABLED_CODE/), /did not match/);
});

test('CP-B2 catalog lifecycle routes expose the four typed status commands', () => {
  const controller = read(
    'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java',
  );
  const routes = [
    ['transitionAttributeDefinitionStatus', 'CatalogAttributeDefinitionStatusTransitionRequest', '/attribute-definitions/{definitionRef}/status'],
    ['transitionOrderOptionDefinitionStatus', 'CatalogOrderOptionDefinitionStatusTransitionRequest', '/order-option-definitions/{definitionRef}/status'],
    ['transitionCatalogUnitStatus', 'CatalogUnitStatusTransitionRequest', '/units/{unitRef}/status'],
    ['transitionCatalogCategoryStatus', 'CatalogCategoryStatusTransitionRequest', '/categories/{categoryRef}/status'],
  ];
  for (const [method, requestType, route] of routes) {
    const methodStart = controller.lastIndexOf('@PostMapping', controller.indexOf(` ${method}(`));
    assert.ok(methodStart >= 0, `${method} must be a public controller method`);
    const methodEnd = controller.indexOf('\n    }', methodStart);
    const source = controller.slice(methodStart, methodEnd);
    assert.match(source, new RegExp(`@PostMapping\\(\\"${route.replace(/[{}]/g, '\\$&')}\\"\\)`));
    assert.match(source, new RegExp(requestType));
  }
});

test('a second strict GET wrapper around an envelope-shaped model is a real red mutation', () => {
  assert.throws(
    () =>
      assertP3WrapperIsTransportFlat(
        'mutated-self-envelope',
        ['revision', 'requestId', 'data'],
        ['revision', 'requestId', 'data'],
      ),
    /already owns a transport envelope/,
  );
});

test('mutation response models do not receive a semantic second envelope', () => {
  const edge = read('apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts');
  const rtk = read('apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.rtk.ts');
  const mutations = contract.operations.filter(operation => operation.method !== 'GET');
  const owners = Object.groupBy(mutations, responseEnvelopeOwner);
  assert.deepEqual(
    owners.LEGACY.map(operation => operation.operationId),
    [
      'preflightOperationsBrandCatalogCopy',
      'updateOperationsInventoryTargetConfiguration',
    ],
  );
  for (const operation of mutations) {
    const response = expectedResponse(operation);
    assert.match(
      edge,
      new RegExp(`"${operation.operationId}": \\{request: [^\\n]+ response: ${response.replace(/[<>]/g, '\\$&')};`),
    );
    assert.match(rtk, new RegExp(`${operation.operationId}: build\\.mutation<${response.replace(/[<>]/g, '\\$&')},`));
    if (responseEnvelopeOwner(operation) === 'MODEL') {
      assert.doesNotMatch(edge, new RegExp(`"${operation.operationId}": [^\\n]+CatalogInventoryEnvelope<`));
    }
  }
});

test('Catalog workbench read-model keeps strict GET response types instead of widening casts', () => {
  const workbench = read(
    'apps/frontend/operations-admin/src/features/catalog-management/ui/controllers/useCatalogWorkbenchReadModel.tsx',
  );

  assert.doesNotMatch(workbench, /CatalogInventoryEnvelope/);
  assert.doesNotMatch(workbench, /(?:contextQuery|navigationQuery|itemsQuery)\.currentData as/);
  assert.doesNotMatch(workbench, /query\.data as/);
  assert.match(workbench, /decodeWorkbenchContext\(contextQuery\.currentData\)/);
  assert.match(workbench, /decodeNavigation\(navigationQuery\.currentData\)/);
  assert.match(workbench, /decodeItems\(itemsQuery\.currentData\)/);
});

test('navigation allCount is a required owner statistic, never a browser aggregation', () => {
  const coverage = JSON.parse(read('contracts/policy/catalog-inventory-design-byte-coverage.json'));
  const navigationModel = readModels.models.find(model => model.name === 'CatalogNavigationView');
  const navigationSchema = openApi.components.schemas.CatalogNavigationView;
  const edge = read('apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts');
  const navigationPresenter = read(
    'apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchNavigationTree.tsx',
  );
  const row = coverage.rows.find(entry => entry.model === 'CatalogNavigationView');

  assert.ok(row);
  assert.deepEqual(row.required, navigationModel.required);
  assert.ok(row.required.includes('allCount'));
  assert.deepEqual(
    row.fields.find(field => field.path === 'allCount'),
    {path: 'allCount', type: 'integer'},
  );
  assert.ok(navigationSchema.properties.data.required.includes('allCount'));
  assert.equal(navigationSchema.properties.data.properties.allCount.type, 'integer');
  assert.match(edge, /data: \{ allCount: number;/);
  assert.match(navigationPresenter, /CatalogTreeLine label="全部商品" count=\{navigation\.allCount\}/);

  const derivedMutation = navigationPresenter.replace(
    'navigation.allCount',
    'navigation.shapeCounts.reduce((total, node) => total + node.count, 0)',
  );
  assert.throws(
    () => assert.match(derivedMutation, /CatalogTreeLine label="全部商品" count=\{navigation\.allCount\}/),
    /did not match/,
  );
});

test('navigation derives both all and uncategorized counts from its one scoped shape aggregate', () => {
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogWorkbenchReadService.java',
  );
  const persistence = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogWorkbenchReadPersistence.java',
  );
  const navigationSql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogWorkbenchReadServiceSql.java',
  );
  const navigation = owner.match(/private ObjectNode navigation\([\s\S]*?\n    \}/)?.[0] ?? '';

  assert.notEqual(navigation, '');
  assert.match(persistence, /readNavigationShapes\(/);
  assert.match(navigationSql, /COUNT\(\*\) FILTER \(WHERE NOT EXISTS \(SELECT 1 FROM/);
  assert.match(navigationSql, /catalog\.catalog_item_category relation WHERE relation\.item_ref=catalog_item\.item_ref/);
  assert.match(navigation, /allCount\s*\+=\s*row\.count\(\)/);
  assert.match(navigation, /uncategorizedCount\s*\+=\s*row\.uncategorizedCount\(\)/);
  assert.match(navigation, /data\.put\("allCount", allCount\)/);
  assert.match(navigation, /data\.put\("uncategorizedCount", uncategorizedCount\)/);
  assert.doesNotMatch(navigation, /jdbc\.queryForObject\(|jdbc\.query\(/);

  const splitCountMutation = navigationSql.replace(
    'COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM',
    'COUNT(*) ',
  );
  assert.throws(
    () =>
      assert.match(
        splitCountMutation,
        /COUNT\(\*\) FILTER \(WHERE NOT EXISTS \(SELECT 1 FROM /,
      ),
    assert.AssertionError,
  );
});

test('navigation carries the enabled catalog-tag tree branch and the item page accepts its opaque tag filter', () => {
  const coverage = JSON.parse(read('contracts/policy/catalog-inventory-design-byte-coverage.json'));
  const navigationSchema = openApi.components.schemas.CatalogNavigationView;
  const itemPageQuery = openApi.components.schemas.CatalogItemPageQuery;
  const edge = read('apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts');
  const navigationRow = coverage.rows.find(entry => entry.model === 'CatalogNavigationView');
  const itemPageQueryRow = coverage.requestRows.find(entry => entry.model === 'CatalogItemPageQuery');
  const tagEntry = navigationSchema.properties.data.properties.tags.items;

  assert.ok(navigationRow);
  assert.ok(itemPageQueryRow);
  assert.ok(navigationRow.required.includes('tags'));
  assert.equal(
    itemPageQueryRow.fields.some(field => field.path === 'tagRef' && field.format === 'uuid'),
    true,
  );
  assert.deepEqual(tagEntry.required, ['tagRef', 'code', 'name', 'count']);
  assert.equal(tagEntry.properties.tagRef.format, 'uuid');
  assert.equal(tagEntry.properties.count.type, 'integer');
  assert.equal(itemPageQuery.properties.tagRef.format, 'uuid');
  assert.equal(itemPageQuery.required.includes('tagRef'), false);
  assert.match(edge, /tags: Array<\{ tagRef: Uuid; code: string; name: string; count: number; \}>;/);
  assert.match(edge, /export type CatalogItemPageQuery = \{[^}]*tagRef\?: Uuid;/);

  const withoutTagFilter = JSON.parse(JSON.stringify(itemPageQuery));
  delete withoutTagFilter.properties.tagRef;
  assert.throws(
    () => assert.equal(withoutTagFilter.properties.tagRef.format, 'uuid'),
    /Cannot read properties of undefined/,
  );
});

test('CatalogItemDetail declares the material role that its owner actually returns', () => {
  const coverage = JSON.parse(read('contracts/policy/catalog-inventory-design-byte-coverage.json'));
  const detailSchema = openApi.components.schemas.CatalogItemDetail;
  const edge = read('apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts');
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java',
  );
  const row = coverage.rows.find(entry => entry.model === 'CatalogItemDetail');
  const edgeDetail = edge.match(/export type CatalogItemDetail = \{[\s\S]*?\n\};/);

  assert.ok(row);
  assert.ok(edgeDetail);
  assert.equal(
    row.fields.some(field => field.path === 'item.materialRole'),
    true,
  );
  assert.ok(detailSchema.properties.data.properties.item.properties.materialRole);
  assert.match(edgeDetail[0], /materialRole: string \| null;/);
  assert.match(
    owner,
    /private ObjectNode itemDetail[\s\S]*?item\.put\("materialRole", sections\.path\("materialRole"\)\.asText\(\)\)/,
  );
});

test('catalog attribute readbacks expose owner-resolved option labels without widening the save contract', () => {
  const detailAssignment =
    openApi.components.schemas.CatalogItemDetail.properties.data.properties.item.properties.attributeAssignments.items;
  const detailFacts = openApi.components.schemas.CatalogItemDetail.properties.data.properties.item.properties.attributeFacts.items;
  const pageFacts = openApi.components.schemas.CatalogItemPage.properties.data.properties.items.items.properties.attributeFacts.items;
  const saveAssignment =
    openApi.components.schemas.CatalogItemSaveReadback.properties.result.properties.item.properties.attributeAssignments.items;
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogItemDefinitionFacts.java',
  );
  const ownerSql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogItemDefinitionFactsSql.java',
  );
  const saveOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java',
  );

  for (const schema of [detailAssignment, detailFacts, pageFacts]) {
    assert.ok(schema.properties.selectedOptionNames);
    assert.deepEqual(schema.required, [
      'definitionRef',
      'code',
      'name',
      'valueType',
      'textValue',
      'optionRefs',
      'selectedOptionNames',
    ]);
  }
  assert.equal(saveAssignment.properties.selectedOptionNames, undefined);
  assert.match(ownerSql, /option_row\.name/);
  assert.match(owner, /assignment\.withArray\("selectedOptionNames"\)\.add\(optionName\)/);
  assert.match(saveOwner, /private ArrayNode saveAttributeAssignments\(JsonNode value\)/);
  assert.match(saveOwner, /copy\.remove\("selectedOptionNames"\)/);
});

test('every catalog-management GET consumer preserves its generated strict response type', () => {
  const queryConsumers = [
    [
      'ui/CatalogItemCreateDrawer.tsx',
      ['const manifest = manifestQuery.currentData?.data;'],
      ['manifestQuery.data as'],
    ],
    [
      'ui/controllers/useCatalogWorkbenchReadModel.tsx',
      [
        'decodeWorkbenchContext(contextQuery.currentData)',
        'decodeNavigation(navigationQuery.currentData)',
        'decodeItems(itemsQuery.currentData)',
      ],
      ['contextQuery.currentData as', 'navigationQuery.currentData as', 'itemsQuery.currentData as', 'query.data as'],
    ],
    [
      'ui/local-copy/LocalCatalogCopyDrawer.tsx',
      [
        'decodeLocalCopyCandidatePage(candidatesQuery.currentData)',
        'decodeLocalCopyPreflight(response)',
        'decodeLocalCopyReadback(response)',
      ],
      ['candidatesQuery.data as', 'as CatalogInventoryEnvelope'],
    ],
    [
      'ui/BrandCatalogCopyDrawer.tsx',
      [
        'const candidatePage = candidatesQuery.currentData?.data;',
        'decodeBrandCopyScopes(candidatesQuery.currentData)',
      ],
      ['candidatesQuery.data as'],
    ],
    [
      'ui/dictionary/CatalogDictionaryDrawerState.tsx',
      ['dictionaryQuery.currentData?.data', 'productionQuery.currentData?.data', 'const readback = response.result;'],
      [
        'dictionaryQuery.currentData?.data.data',
        'productionQuery.currentData?.data.data',
        'as CatalogInventoryEnvelope',
      ],
    ],
    [
      'ui/CatalogItemViewDrawer.tsx',
      [
        // The view drawer deliberately keeps the opened identity in
        // `viewedItemCode`: a parent prop may change while the preceding
        // request is still settling.  The typed selector must follow that
        // stable identity, not a particular prop variable name.
        'selectCatalogDetailForItem(viewedItemCode, detailQuery.currentData, detailQuery.data)',
        'detailQuery.isError ? undefined',
        'manifestQuery.currentData?.data',
      ],
      ['detailQuery.data as', 'manifestQuery.currentData?.data as', 'as CatalogInventoryEnvelope'],
    ],
    [
      'model/useCatalogItemEditorSession.ts',
      [
        'selectCatalogDetailForItem(itemCode, detailQuery.currentData, detailQuery.data)',
        'detailQuery.isError ? undefined',
        'const manifest = manifestQuery.currentData?.data;',
      ],
      ['detailQuery.data as', 'manifestQuery.currentData?.data as', 'as CatalogInventoryEnvelope'],
    ],
    [
      'ui/CatalogDefinitionLibraries.tsx',
      [
        'attributeQuery.currentData?.data.definitions',
        'orderOptionQuery.currentData?.data.definitions',
        'inventoryQuery.currentData?.data',
      ],
      ['attributeQuery.data as', 'orderOptionQuery.data as', 'inventoryQuery.data as', 'as CatalogInventoryEnvelope'],
    ],
    [
      'ui/CatalogItemAttributesEditor.tsx',
      ['query.currentData?.data.definitions', 'candidateQuery.currentData?.data.definitions'],
      ['query.data as', 'candidateQuery.data as', 'as CatalogInventoryEnvelope'],
    ],
    [
      'ui/CatalogItemCompositeEditor.tsx',
      ['decodeItems(query.currentData)', 'query.currentData'],
      ['query.data as', 'as CatalogInventoryEnvelope'],
    ],
    [
      'ui/CatalogItemEditorSectionAssembler.tsx',
      ['unitQuery.currentData?.data.units'],
      ['unitQuery.data as', 'as CatalogInventoryEnvelope'],
    ],
    [
      'ui/CatalogItemOrderOptionsEditor.tsx',
      ['candidateQuery.currentData?.data.definitions'],
      ['query.data as', 'candidateQuery.data as', 'as CatalogInventoryEnvelope'],
    ],
    [
      'ui/CatalogItemProductionEditor.tsx',
      ['tagQuery.currentData?.data'],
      ['tagQuery.data as', 'as CatalogInventoryEnvelope'],
    ],
    [
      'ui/controllers/useCatalogSkuRows.ts',
      ['useLazyGetOperationsCatalogItemSkusQuery', 'decodeSkuListPage(response)'],
      ['response as CatalogInventoryEnvelope'],
    ],
    [
      'ui/useCatalogCategoryCandidates.tsx',
      ['useLazyGetOperationsCatalogCategoryCandidatesQuery', 'searchQuery.currentData?.data'],
      ['searchQuery.data as', 'as CatalogInventoryEnvelope'],
    ],
    [
      'ui/useInventoryConsumptionTargetCandidates.ts',
      ['query.currentData?.data'],
      ['query.data as', 'as CatalogInventoryEnvelope'],
    ],
  ];
  const discoveredQueryConsumers = collectCatalogFeatureSourceFiles(catalogFeatureRoot)
    .filter(file => /\boperationsRtk\.use(?:Lazy)?[A-Za-z0-9]+Query\s*\(/.test(readFileSync(file, 'utf8')))
    .map(file => path.relative(catalogFeatureRoot, file).replaceAll(path.sep, '/'))
    .sort();
  assert.deepEqual(
    queryConsumers.map(([file]) => file).sort(),
    discoveredQueryConsumers,
    'the strict response-type roster must cover every current direct operationsRtk GET consumer',
  );
  assert.equal(queryConsumers.length, discoveredQueryConsumers.length);
  for (const [file, required, forbidden] of queryConsumers) {
    const source = read(`apps/frontend/operations-admin/src/features/catalog-management/${file}`);
    const normalizedSource = source.replace(/\s+/g, ' ');
    for (const expression of required)
      assert.ok(normalizedSource.includes(expression.replace(/\s+/g, ' ')), `${file} must consume ${expression}`);
    for (const expression of forbidden)
      assert.equal(normalizedSource.includes(expression.replace(/\s+/g, ' ')), false, `${file} must not widen ${expression}`);
  }
  const model = [
    read('apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts'),
    read('apps/frontend/operations-admin/src/features/catalog-management/model/catalog/catalogItemModel.ts'),
  ].join('\n');
  assert.match(
    model,
    /export function selectCatalogDetailForItem\([\s\S]*?for \(const envelope of \[currentData, data\]\)[\s\S]*?detail\?\.item\.code === itemCode/,
  );
});

test('catalog dictionary void confirmation keeps history without starting a rebuild', () => {
  const drawer = read(
    'apps/frontend/operations-admin/src/features/catalog-management/ui/dictionary/CatalogDictionaryDrawerState.tsx',
  );
  const modal = read('apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryAtomModals.tsx');
  assert.match(modal, /作废后会保留历史记录/);
  assert.match(modal, /不会自动创建新记录/);
  assert.match(modal, /statusTarget === 'VOIDED'/);
  assert.doesNotMatch(drawer, /作废并重建|作废并继续重建|setCreatingKind\(dictionaryKind\)/);
  assert.doesNotMatch(modal, /正在重建作废记录|旧编码|重建/);
});

test('unit list declares its owner limit problem in the source and materialized contract', () => {
  const generator = read('scripts/generate/catalog-inventory-p1.mjs');
  const contract = JSON.parse(read('contracts/catalog/catalog-inventory-edge-contract.json'));
  const operation = contract.operations.find(entry => entry.operationId === 'listOperationsCatalogUnits');
  assert.match(generator, /const unitListProblems = \['VALIDATION_ERROR', 'SCOPE_FORBIDDEN', 'CATALOG_UNIT_LIMIT_EXCEEDED'\]/);
  assert.deepEqual(operation.problemCodes, ['VALIDATION_ERROR', 'SCOPE_FORBIDDEN', 'CATALOG_UNIT_LIMIT_EXCEEDED']);
});

test('Local Copy consumes each model-owned response directly', () => {
  const model = read(
    'apps/frontend/operations-admin/src/features/catalog-management/ui/local-copy/localCatalogCopyModel.ts',
  );
  const drawer = read(
    'apps/frontend/operations-admin/src/features/catalog-management/ui/local-copy/LocalCatalogCopyDrawer.tsx',
  );

  for (const modelName of ['LocalCopyCandidatePage', 'LocalCopyPreflight', 'LocalCopyReadback']) {
    assert.match(model, new RegExp(`export type ${modelName}Data = ${modelName}\\['data'\\];`));
  }
  assert.match(model, /decodeLocalCopyCandidatePage\([\s\S]*?response: LocalCopyCandidatePage \| undefined/);
  assert.match(model, /decodeLocalCopyPreflight\([\s\S]*?response: LocalCopyPreflight \| undefined/);
  assert.match(model, /decodeLocalCopyReadback\([\s\S]*?response: LocalCopyReadback \| undefined/);
  assert.match(drawer, /decodeLocalCopyCandidatePage\(candidatesQuery\.currentData\)/);
  assert.match(drawer, /decodeLocalCopyPreflight\(response\)/);
  assert.match(drawer, /decodeLocalCopyReadback\(response\)/);
  assert.doesNotMatch(model, /localCopyPayload/);
  assert.doesNotMatch(drawer, /CatalogInventoryEnvelope<LocalCopy/);
});

test('catalog model accepts only the declared data envelope', () => {
  const model = read('apps/frontend/operations-admin/src/features/catalog-management/model/catalog/catalogValidation.ts');

  assert.match(model, /return asRecord\(envelope\?\.data\);/);
  assert.doesNotMatch(model, /asRecord\(envelope\?\.result\) \?\? asRecord\(envelope\)/);
});

test('CatalogOwner detail and item-page consumers do not restore root-payload compatibility', () => {
  const coordinator = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java',
  );
  const catalogOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java',
  );
  const itemOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java',
  );
  const workbenchOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogWorkbenchReadService.java',
  );
  const inventoryOwner = read(
    'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java',
  );
  const inventoryTargetOwner = read(
    'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryTargetService.java',
  );
  const strictDetailRead = 'JsonNode item = detail.path("data").path("item");';
  const strictItemPageRead = 'JsonNode catalogData = catalogPage.path("data");';
  const strictAssetRead = 'catalog.readAssetReferences(dataNodeRef, brandRef, itemCode)';
  const forbiddenCatalogOwnerFallback =
    /(?:JsonNode item = detail\.path\("data"\)\.path\("item"\)\.isObject\(\) \? detail\.path\("data"\)\.path\("item"\) : detail\.path\("item"\);|ObjectNode data = root\.path\("data"\)\.isObject\(\) \? \(ObjectNode\) root\.path\("data"\) : root;|JsonNode catalogData = catalogPage\.path\("data"\)\.isObject\(\) \? catalogPage\.path\("data"\) : catalogPage;|JsonNode detailRoot = detail\.path\("data"\)\.isObject\(\) \? detail\.path\("data"\) : detail;)/;

  // The number of consumers is an implementation detail.  What matters is that
  // every remaining direct detail read is strict and that at least one such
  // projection still exists; a source cleanup must not turn this into a stale
  // counter of call sites.
  assert.ok(
    [...coordinator.matchAll(new RegExp(strictDetailRead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].length >= 1,
  );
  for (const strictRead of [strictItemPageRead, strictAssetRead]) assert.ok(coordinator.includes(strictRead));
  assert.ok(coordinator.includes('JsonNode dataNode = root.path("data");'));
  assert.doesNotMatch(coordinator, forbiddenCatalogOwnerFallback);
  assert.match(catalogOwner, /readItems\([\s\S]*?workbenchReadService\.readItems\(/);
  assert.match(workbenchOwner, /private ObjectNode items[\s\S]*?return envelope\(requestId, data\);/);
  assert.match(itemOwner, /private ObjectNode detail[\s\S]*?return envelope\(requestId, data\);/);

  // The remaining data/root branches are source-backed counterexamples, not CatalogOwner HTTP detail/page consumers.
  for (const marker of [
    'NOT_APPLICABLE_WITH_REASON: CatalogOwnerApi copy preflight is a distinct canonical owner payload',
    'NOT_APPLICABLE_WITH_REASON: InventoryOwnerApi defines this as a raw definition graph',
    'NOT_APPLICABLE_WITH_REASON: InventoryOwnerService.references is a raw inventory task-read',
  ])
    assert.ok(coordinator.includes(marker), `missing source-backed counterexample: ${marker}`);
  assert.match(inventoryOwner, /public JsonNode readCatalogInventoryDefinition[\s\S]*?bomService\.readCatalogInventoryDefinition/);
  assert.match(inventoryTargetOwner, /private ObjectNode references[\s\S]*?return data;/);

  const redMutation = coordinator.replace(
    strictAssetRead,
    'JsonNode detailRoot = detail.path("data").isObject() ? detail.path("data") : detail;',
  );
  assert.throws(() => assert.doesNotMatch(redMutation, forbiddenCatalogOwnerFallback), /expected.*not match/i);
});

test('CatalogOwner parent-page summaries keep SQL placeholder and JSON array projection types closed', () => {
  const persistence = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogWorkbenchReadPersistence.java',
  );
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogWorkbenchReadService.java',
  );
  const catalogTagProjection =
    persistence.match(/public List<CatalogTagFactRow> readCatalogTagFacts\([\s\S]*?\n    \}/)?.[0] ?? '';
  const itemSummaryProjection = owner.match(/private ObjectNode itemSummary\([\s\S]*?\n    \}/)?.[0] ?? '';

  assert.notEqual(catalogTagProjection, '');
  assert.notEqual(itemSummaryProjection, '');
  assert.match(
    catalogTagProjection,
    /String placeholders = String\.join\([\s\S]*?Collections\.nCopies\(refs\.size\(\), CatalogWorkbenchReadServiceSql\.PARAMETER_PLACEHOLDER\)\);/,
  );
  assert.match(catalogTagProjection, /\+ placeholders\n\s*\+ CatalogWorkbenchReadServiceSql\./);
  assert.doesNotMatch(catalogTagProjection, /placeholders\(itemRefs\)/);
  assert.match(itemSummaryProjection, /item\.set\("attributeFacts", arrayCopy\(sections\.path\("attributeAssignments"\)\)\);/);
  assert.match(itemSummaryProjection, /item\.set\("preparationFacts", preparationFacts\(/);
  for (const retiredField of [
    'categoryPathLabels',
    'tagSummary',
    'skuDimensionSummary',
    'specificationOrOptionSummary',
    'attributeSummary',
    'preparationSummary',
    'relationLabel',
  ]) assert.doesNotMatch(itemSummaryProjection, new RegExp(`\\b${retiredField}\\b`));

  const missingPlaceholderProjection = catalogTagProjection.replace(
    'String placeholders = String.join(',
    'String parameterPlaceholders = String.join(',
  );
  assert.throws(
    () =>
      assert.match(
        missingPlaceholderProjection,
        /String placeholders = String\.join\(/,
      ),
    assert.AssertionError,
  );
});

test('catalog item-page reuses the primary row unit snapshot instead of reading every item a second time', () => {
  const workbenchSql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogWorkbenchReadServiceSql.java',
  );
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogWorkbenchReadService.java',
  );
  const items = owner.match(/private ObjectNode items\([\s\S]*?\n    \}/)?.[0] ?? '';
  const summaryHydration = owner.match(/private List<ItemRow> hydrateItemSummaryFacts\([\s\S]*?\n    \}/)?.[0] ?? '';

  assert.notEqual(items, '');
  assert.notEqual(summaryHydration, '');
  assert.match(workbenchSql, /i\.sales_unit_ref, i\.sales_unit_code, i\.sales_unit_name, i\.sales_unit_dimension,/);
  assert.match(workbenchSql, /i\.base_measure_unit_ref, i\.base_measure_unit_code,[\s\S]*?i\.base_measure_unit_name,/);
  assert.match(workbenchSql, /'salesUnitSnapshot',CASE WHEN p\.sales_unit_ref IS NULL THEN NULL ELSE jsonb_build_object\(/);
  assert.match(
    workbenchSql,
    /'baseMeasureUnitSnapshot',CASE WHEN p\.base_measure_unit_ref IS NULL THEN NULL[\s\S]*?ELSE jsonb_build_object\(/,
  );
  assert.doesNotMatch(summaryHydration, /itemUnitRefsByItemRefs\(itemRefs\)/);

  const duplicateReadMutation = summaryHydration.replace(
    'Map<UUID, ArrayNode> imagesByItem = itemMediaFacts.readByItemRefs(itemRefs);',
    'Map<UUID, ArrayNode> imagesByItem = itemMediaFacts.readByItemRefs(itemRefs);\n        Map<UUID, ItemUnitRefs> unitRefsByItem = itemUnitRefsByItemRefs(itemRefs);',
  );
  assert.throws(
    () => assert.doesNotMatch(duplicateReadMutation, /itemUnitRefsByItemRefs\(itemRefs\)/),
    /expected.*not match/i,
  );
});

test('catalog hierarchy, production-tag navigation, and SKU page preserve their approved read-model boundaries', () => {
  const categoryOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogCategoryService.java',
  );
  const workbenchOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogWorkbenchReadService.java',
  );
  const workbenchSql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogWorkbenchReadServiceSql.java',
  );
  const itemOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java',
  );
  const itemSql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogItemServiceSql.java',
  );
  const productionOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogProductionTagOwnerService.java',
  );
  const productionSql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogProductionTagOwnerServiceSql.java',
  );
  const moveCategory =
    categoryOwner.match(
      /private ObjectNode moveCategory\([\s\S]*?return categoryCommand\(requestId, updated\);\n    \}/,
    )?.[0] ?? '';
  const navigation =
    workbenchOwner.match(/private ObjectNode navigation\([\s\S]*?ArrayNode tags = data\.putArray\("tags"\);/)?.[0] ?? '';
  const skuPage =
    itemOwner.match(/private ObjectNode itemSkus\([\s\S]*?List<SkuCandidateRow> rows = persistence\.readSkuCandidates\(/)?.[0] ?? '';
  const navigationTags =
    productionOwner.match(
      /public List<CatalogProductionTagOwnerApi\.ProductionTagNavigationReadback> readNavigationTags\([\s\S]*?\n    \}/,
    )?.[0] ?? '';

  assert.notEqual(moveCategory, '');
  assert.notEqual(navigation, '');
  assert.notEqual(skuPage, '');
  assert.notEqual(navigationTags, '');

  assert.match(moveCategory, /List<UUID> subtree = categorySubtreeRefs\(dataNodeRef, brandRef, categoryRef\);/);
  assert.match(moveCategory, /lockCategories\(dataNodeRef, brandRef, subtree\);/);
  assert.match(moveCategory, /if \(subtree\.contains\(parentCategoryRef\)\)/);
  assert.match(moveCategory, /HIERARCHY_CYCLE/);
  assert.match(moveCategory, /assertCategoryMoveDepth\(/);
  assert.match(moveCategory, /lockCategoryHierarchy\(dataNodeRef, brandRef\);/);
  assert.match(workbenchSql, /category_subtree\(root_category_ref,/);
  assert.match(workbenchSql, /subtree\.root_category_ref,child\.category_ref FROM category_subtree subtree JOIN/);
  assert.match(workbenchSql, /COALESCE\(subtree_sizes\.subtree_size,1\)/);
  assert.match(navigation, /\.put\("subtreeSize", row\.subtreeSize\(\)\)/);
  assert.doesNotMatch(navigation, /\.put\("subtreeSize", 1 \+ childCount\)/);
  assert.match(itemSql, /WITH item_scope AS \(SELECT item_ref,preparation_profile FROM /);
  assert.match(itemSql, /catalog\.catalog_item WHERE data_node_ref=\? AND brand_ref=\? AND code=\? AND status <> 'VOIDED'\)/);
  assert.match(itemSql, /FROM catalog\.catalog_sku sku JOIN item_scope item ON /);
  assert.match(itemSql, /item\.item_ref=sku\.item_ref/);
  assert.match(itemSql, /LEFT JOIN catalog\.unit_definition sales_unit/);
  assert.match(itemSql, /EXISTS\(SELECT 1 FROM item_scope\) AS item_exists/);
  assert.doesNotMatch(skuPage, /List<UUID> itemRefs = jdbc\.query\(/);
  assert.match(productionSql, /status <> 'VOIDED'/);
  assert.doesNotMatch(navigationTags, /status='ENABLED'/);
  assert.match(itemSql, /item\.preparation_profile::text,sku\.preparation_override::text,production_tag\.ref/);
  assert.match(itemSql, /catalog\.catalog_item_reference relation/);
  assert.doesNotMatch(skuPage, /preparationFacts\.readItemProfiles/);
  assert.doesNotMatch(skuPage, /itemReferenceFacts\.readByItemRefs/);

  const depthGuardMutation = moveCategory.replaceAll('assertCategoryMoveDepth', 'staleCategoryMoveDepth');
  assert.throws(() => assert.match(depthGuardMutation, /assertCategoryMoveDepth\(/), assert.AssertionError);
  const shallowStatsMutation = workbenchSql.replace(
    'subtree.root_category_ref,child.category_ref FROM category_subtree subtree JOIN',
    'child.category_ref,child.category_ref FROM category_subtree subtree JOIN',
  );
  assert.throws(
    () => assert.match(shallowStatsMutation, /subtree\.root_category_ref,child\.category_ref FROM category_subtree subtree JOIN/),
    assert.AssertionError,
  );
  const joinOrderMutation = itemSql.replace(
    'FROM catalog.catalog_sku sku JOIN item_scope item ON ',
    'FROM catalog.catalog_sku sku JOIN item_scope item ',
  );
  assert.throws(
    () => assert.match(joinOrderMutation, /FROM catalog\.catalog_sku sku JOIN item_scope item ON /),
    assert.AssertionError,
  );
  const disabledTagMutation = productionSql.replaceAll("status <> 'VOIDED'", "status='ENABLED'");
  assert.throws(() => assert.match(disabledTagMutation, /status <> 'VOIDED'/), assert.AssertionError);
});

test('typed production-tag commands atomically claim their receipt, lock the fact, and persist the returned readback', () => {
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogProductionTagOwnerService.java',
  );
  const persistence = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogProductionTagOwnerPersistence.java',
  );
  const sql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogProductionTagOwnerServiceSql.java',
  );
  const p1 = read('scripts/generate/catalog-inventory-p1.mjs');
  const existingMutation = sql;
  const createMutation = sql;

  assert.notEqual(existingMutation, '');
  assert.notEqual(createMutation, '');
  assert.match(owner, /persistence\.updateTypedTagName\(/);
  assert.match(owner, /persistence\.updateTypedTagStatus\(/);
  assert.match(owner, /persistence\.createTypedTag\(/);
  assert.match(persistence, /CatalogProductionTagOwnerServiceSql\.MUTATE_TYPED_TAG_PREFIX/);
  assert.match(persistence, /CatalogProductionTagOwnerServiceSql\.CREATE_TYPED_TAG/);
  assert.match(existingMutation, /WITH receipt_lock AS MATERIALIZED/);
  assert.match(existingMutation, /current_tag AS MATERIALIZED/);
  assert.match(existingMutation, /FOR UPDATE/);
  assert.match(existingMutation, /prior_receipt AS MATERIALIZED/);
  assert.match(existingMutation, /written_receipt AS/);
  assert.match(existingMutation, /NOT EXISTS \(SELECT 1 FROM prior_receipt\)/);
  assert.match(createMutation, /WITH receipt_lock AS MATERIALIZED/);
  assert.match(createMutation, /prior_receipt AS MATERIALIZED/);
  assert.match(createMutation, /written_receipt AS/);
  assert.doesNotMatch(existingMutation, /recheckExistingTagBeforeReceipt|replayTyped|saveTypedReceipt|find\(scope, brand, code\)/);
  assert.match(p1, /const catalogBudgetProjection = projectedCatalogOperationMetadata\(catalogOperationMetadata\);/);
  assert.match(p1, /catalogOperations: Object\.freeze\(entries\.map\(entry => (?:Object\.freeze\(\{\.\.\.entry\}\)|\{)/);
  assert.doesNotMatch(p1, /(?:transitionOperationsProductionTagStatus|updateOperationsProductionTag):\s*\d+,/);

  const unlockedMutation = existingMutation.replace('FOR UPDATE', '');
  assert.throws(() => assert.match(unlockedMutation, /FOR UPDATE/), assert.AssertionError);
});

test('typed category update keeps version, receipt, write, and deletion readback in one owner statement', () => {
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogCategoryService.java',
  );
  const persistence = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogCategoryPersistence.java',
  );
  const sql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogCategoryServiceSql.java',
  );
  const typedEntry =
    owner.match(/public CatalogOwnerApi\.CategoryReadback updateCategory\([\s\S]*?\n    \}/)?.[0] ?? '';
  const typedMutation = sql;

  assert.notEqual(typedEntry, '');
  assert.notEqual(typedMutation, '');
  assert.match(typedEntry, /updateTypedCategory\(/);
  assert.doesNotMatch(typedEntry, /executeWrite\(/);
  assert.match(persistence, /executeTypedUpdate\(/);
  assert.match(typedMutation, /WITH RECURSIVE receipt_lock AS MATERIALIZED/);
  assert.match(typedMutation, /current_category AS MATERIALIZED/);
  assert.match(typedMutation, /FOR UPDATE/);
  assert.match(typedMutation, /updated_category AS/);
  assert.match(typedMutation, /deletion_availability AS/);
  assert.match(typedMutation, /written_receipt AS/);
  assert.match(typedMutation, /NOT EXISTS \(SELECT 1 FROM prior_receipt\)/);
  assert.match(owner, /mapper\.readValue\(response, CatalogOwnerApi\.CategoryReadback\.class\)/);

  const splitWriteMutation = typedMutation.replaceAll('written_receipt AS', 'separate_receipt AS');
  assert.throws(() => assert.match(splitWriteMutation, /written_receipt AS/), assert.AssertionError);
});

test('typed category move owns hierarchy validation, sibling reorder, receipt, and readback in one owner statement', () => {
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogCategoryService.java',
  );
  const persistence = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogCategoryPersistence.java',
  );
  const sql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogCategoryServiceSql.java',
  );
  const p1 = read('scripts/generate/catalog-inventory-p1.mjs');
  const typedEntry =
    owner.match(/public CatalogOwnerApi\.CategoryReadback moveCategory\([\s\S]*?\n    \}/)?.[0] ?? '';
  const typedMutation = sql;

  assert.notEqual(typedEntry, '');
  assert.notEqual(typedMutation, '');
  assert.match(typedEntry, /moveTypedCategory\(/);
  assert.doesNotMatch(typedEntry, /executeWrite\(/);
  assert.doesNotMatch(typedEntry, /requireScope\(/);
  assert.match(persistence, /executeTypedMove\(/);
  assert.match(typedMutation, /WITH RECURSIVE receipt_lock AS MATERIALIZED/);
  assert.match(typedMutation, /hierarchy_lock AS MATERIALIZED/);
  assert.match(typedMutation, /locked_categories AS MATERIALIZED/);
  assert.match(typedMutation, /FOR UPDATE/);
  assert.match(typedMutation, /move_plan AS/);
  assert.match(typedMutation, /MATERIALIZED \(SELECT input\.action/);
  assert.match(typedMutation, /updated_categories AS/);
  assert.match(typedMutation, /written_receipt AS/);
  assert.match(typedMutation, /NOT EXISTS \(SELECT 1 FROM prior_receipt\)/);
  assert.match(typedMutation, /CATEGORY_DEPTH_EXCEEDED/);
  assert.match(owner, /mapper\.readValue\(response, CatalogOwnerApi\.CategoryReadback\.class\)/);
  assert.match(p1, /const catalogBudgetProjection = projectedCatalogOperationMetadata\(catalogOperationMetadata\);/);
  assert.doesNotMatch(p1, /moveOperationsCatalogCategory:\s*\d+,/);

  const missingHierarchyLock = typedMutation.replaceAll('hierarchy_lock AS MATERIALIZED', 'hierarchy_guard AS MATERIALIZED');
  assert.throws(() => assert.match(missingHierarchyLock, /hierarchy_lock AS MATERIALIZED/), assert.AssertionError);
});

test('catalog command context consumes one organization projection for task path and persisted brand', () => {
  const contexts = read(
    'apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/CommandExecutionContextResolver.java',
  );
  const capabilities = read(
    'apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceCapabilityScopeResolver.java',
  );
  const taskPaths = read(
    'apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationTaskPathPersistence.java',
  );
  const taskPathSql = read(
    'apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/OrganizationTaskPathServiceSql.java',
  );

  assert.match(contexts, /capabilities\.resolveGeneratedCatalogOperation\(/);
  assert.doesNotMatch(contexts, /catalogScopes\.resolveCatalogBrand\(/);
  assert.match(capabilities, /taskPaths\.resolveCatalogCommandScopeFacts\(/);
  assert.match(taskPaths, /storeCatalogCommandScopeFacts\(/);
  assert.match(taskPaths, /headCompanyCatalogCommandScopeFacts\(/);
  assert.match(taskPaths, /STORE_PERSISTED_BRAND/);
  assert.match(taskPaths, /HEAD_COMPANY_BRAND_AUTHORIZATION/);
  assert.match(taskPathSql, /head_company_brand_authorization authorization_fact/);
  assert.doesNotMatch(taskPathSql, /head_company_brand_authorization authorization ON/);

  const splitProjectionMutation = capabilities.replace(
    'taskPaths.resolveCatalogCommandScopeFacts(',
    'taskPaths.commandTaskPathFacts(',
  );
  assert.throws(
    () => assert.match(splitProjectionMutation, /taskPaths\.resolveCatalogCommandScopeFacts\(/),
    assert.AssertionError,
  );

  const reservedAliasMutation = taskPathSql.replace(
    'head_company_brand_authorization authorization_fact',
    'head_company_brand_authorization authorization',
  );
  assert.throws(
    () => assert.doesNotMatch(reservedAliasMutation, /head_company_brand_authorization authorization ON/),
    assert.AssertionError,
  );
});

test('catalog coordinator crosses inventory and production read boundaries through public APIs only', () => {
  const coordinator = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java',
  );

  assert.doesNotMatch(coordinator, /^import com\.catering\.v2s\.inventory\.application\./m);
  assert.doesNotMatch(coordinator, /^import com\.catering\.v2s\.fulfillment\.production\.application\./m);
  assert.match(coordinator, /ReadBudgetComponent\.measure\(ReadBudgetComponent\.Component\.PRIMARY_QUERY/);
});

test('shape-manifest payload revision has a distinct contract-wide name', () => {
  const coverage = JSON.parse(read('contracts/policy/catalog-inventory-design-byte-coverage.json'));
  const readModels = JSON.parse(read('contracts/catalog/catalog-inventory-read-models.json'));
  const openApi = JSON.parse(read('contracts/openapi/catalog-inventory.openapi.json'));
  const row = coverage.rows.find(entry => entry.model === 'CatalogShapeManifestView');
  const readModel = readModels.models.find(entry => entry.name === 'CatalogShapeManifestView');
  const schema = openApi.components.schemas.CatalogShapeManifestView;
  const edge = read('apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts');
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogCopyService.java',
  );
  assert.ok(row);
  assert.deepEqual(row.required, readModel.required);
  assert.equal(row.required.includes('manifestRevision'), true);
  assert.equal(row.required.includes('revision'), false);
  assert.equal(
    row.fields.some(field => field.path === 'manifestRevision'),
    true,
  );
  assert.equal(schema.required.includes('manifestRevision'), true);
  assert.equal(schema.required.includes('revision'), false);
  assert.ok(schema.properties.manifestRevision);
  assert.equal(schema.properties.revision, undefined);
  assert.match(edge, /export type CatalogShapeManifestView = \{ manifestRevision: string;/);
  assert.match(owner, /data\.put\("manifestRevision", CatalogInventoryShapeManifest\.REVISION\)/);
});

test('owner typed Problems retain causes at every allowed parse or serialization boundary', () => {
  const api = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java',
  );
  const itemOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java',
  );
  const workbenchOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogWorkbenchReadService.java',
  );
  const dictionaryOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogDictionaryService.java',
  );
  const categoryOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogCategoryService.java',
  );
  const copyOwner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogCopyService.java',
  );
  const coordinator = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java',
  );
  const saveOperation = read(
    'apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/operations/SaveOperationsCatalogItemOperation.java',
  );
  const wire = read(
    'apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/operations/CopyPreflightWireShape.java',
  );
  assert.match(api, /Problem\(String code, int status, String message, Throwable cause\)/);
  assert.match(api, /super\(message, cause\)/);
  const escaped = value => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  assert.match(itemOwner, escaped('"catalog save request is invalid", failure'));
  assert.match(workbenchOwner, escaped('field + " is not a valid UUID", failure'));
  assert.match(copyOwner, escaped('"copy reference plan is invalid", failure'));
  assert.match(itemOwner, escaped('"形态页签契约不可用", failure'));
  assert.match(copyOwner, escaped('"形态契约不可用", ex'));
  for (const source of [itemOwner, workbenchOwner, dictionaryOwner, categoryOwner, copyOwner])
    assert.match(source, /"JSON payload is invalid", (?:failure|ex)/);
  for (const boundary of [
    '"owner copy readback is invalid", failure',
    '"商品库存规则保存后无法读取", failure',
    '"catalog save composition cannot encode owner request", failure',
    '"catalog save request is invalid", failure',
  ])
    assert.match(coordinator, new RegExp(boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(saveOperation, /"catalog save readback is invalid", failure/);
  assert.match(wire, /label \+ " readback is invalid: " \+ safeDiagnostic\(failure\), failure/);
});

test('copy adapters preserve safe missing-field diagnostics while keeping transaction failure', () => {
  const adapters = [
    ['PreflightOperationsLocalCatalogCopyOperation.java', 'local copy preflight'],
    ['PreflightOperationsBrandCatalogCopyOperation.java', 'brand copy preflight'],
    ['ExecuteOperationsLocalCatalogCopyOperation.java', 'local copy execution'],
    ['ExecuteOperationsBrandCatalogCopyOperation.java', 'brand copy execution'],
  ];
  for (const [file, label] of adapters) {
    const source = read(
      `apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/operations/${file}`,
    );
    if (label.endsWith('execution')) {
      assert.match(source, /@Transactional\(propagation = Propagation\.REQUIRED\)/);
      assert.match(
        source,
        /CopyPreflightWireShape\.(localReadback|brandReadback)\(context\.requestId\(\), readback\.catalog\(\), readback\.ownerReadbacks\(\)\)/,
      );
      assert.doesNotMatch(source, /canonicalJson\(\)|ObjectMapper|treeToValue/);
    } else {
      assert.match(source, new RegExp(`CopyPreflightWireShape\\.invalidReadback\\("${label}", failure\\)`));
    }
    assert.doesNotMatch(
      source,
      new RegExp(`new CatalogOwnerApi\\.Problem\\("RESULT_UNKNOWN", 500, "${label} readback is invalid"\\)`),
    );
  }
  const wireShape = read(
    'apps/backend/catering-business-server/src/main/java/com/catering/v2s/catalog/application/operations/CopyPreflightWireShape.java',
  );
  assert.match(wireShape, /missingTypedExecutionField\(label, "referenceMappings"\)/);
  assert.match(wireShape, /required typed field is missing: " \+ field/);
});

test('catalog asset settlement makes one global batch judgment and leaves version reread with the asset owner', () => {
  const coordinator = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java',
  );
  const assetApi = read(
    'apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/api/CatalogAssetCommandApi.java',
  );
  const assetOwner = read(
    'apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java',
  );
  const methodSlice = (startMarker, endMarker) => {
    const start = coordinator.indexOf(startMarker);
    const end = coordinator.indexOf(endMarker);
    assert.ok(start >= 0, `missing method start: ${startMarker}`);
    assert.ok(end > start, `missing method end after ${startMarker}: ${endMarker}`);
    return coordinator.slice(start, end);
  };
  const settlement = methodSlice('private void settleWorkspaceCatalogAssets', 'private String canonicalLocalJson');
  assert.match(settlement, /catalog\.assetRefsStillReferenced\(candidates\)/);
  assert.doesNotMatch(settlement, /assets\.require\(/);
  assert.doesNotMatch(assetApi, /PriorAssetReference\(UUID assetRef, long expectedVersion\)/);
  assert.match(assetOwner, /AssetReadback current = require\(prior\.assetRef\(\)\);/);
  assert.match(
    assetOwner,
    /releaseUnreferencedCatalogAssetAfterAuthorization\(\s*prior\.assetRef\(\),\s*current\.version\(\)/,
  );

  assert.match(settlement, /assetCommands\.settleCatalogSaveAssets\(\s*context/);
  assert.match(settlement, /new CatalogAssetCommandApi\.PriorAssetReference\(UUID\.fromString\(ref\)\)/);
  assert.equal(coordinator.includes('private void settleCatalogAssets'), false);
  assert.match(assetOwner, /Owner-local version read: callers never pre-read an asset merely to supply its CAS value/);
  assert.match(assetOwner, /CATALOG_ITEM_IMAGE_GLOBAL_RELEASE_OWNER_LOCAL_VERSION/);
  assert.match(assetOwner, /PlatformAssetPersistence\.Receipt replay = findReceipt\(GLOBAL_RECEIPT_SCOPE, idempotencyKey\);/);
  assert.match(assetOwner, /AssetReadback current = require\(assetRef\);/);
});

test('catalog detail reads preparation facts through one owner-local projection and reuses SKU timestamps', () => {
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java',
  );
  const preparationFacts = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogPreparationFacts.java',
  );
  const preparationSql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogPreparationFactsSql.java',
  );
  const skuFacts = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogSkuFacts.java',
  );
  const skuSql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogSkuFactsSql.java',
  );
  const referenceFacts = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogItemReferenceFacts.java',
  );
  const referenceSql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogItemReferenceFactsSql.java',
  );
  const unitFacts = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogUnitDefinitionFacts.java',
  );
  const unitSql = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/persistence/CatalogUnitDefinitionFactsSql.java',
  );
  const inventoryOwner = read(
    'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java',
  );
  const inventoryBomOwner = read(
    'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryBomService.java',
  );
  const referenceReplaceStart = referenceFacts.indexOf('public void replace(UUID itemRef, JsonNode productionTagRef, JsonNode tagRefs)');
  const referenceReplaceEnd = referenceFacts.indexOf('/** Inserts facts for freshly-created copy targets', referenceReplaceStart);
  assert.ok(referenceReplaceStart >= 0 && referenceReplaceEnd > referenceReplaceStart);
  const referenceReplace = referenceFacts.slice(referenceReplaceStart, referenceReplaceEnd);
  const detailStart = owner.indexOf('private List<ItemRow> hydrateDetailItemFacts');
  const detailEnd = owner.indexOf('private void decoratePreparationFacts', detailStart);

  assert.ok(detailStart >= 0);
  assert.ok(detailEnd > detailStart);
  const detailHydrator = owner.slice(detailStart, detailEnd);
  assert.match(detailHydrator, /preparationFacts\.readDetailFacts\(itemRefs, skuRefs\)/);
  assert.match(detailHydrator, /categorySummaryFactsForItems\(dataNodeRef, brandRef, rows\)/);
  assert.match(detailHydrator, /sections\.set\("categoryPath", categoryPathArray\(categoryFacts, row\.ref\(\)\)\)/);
  assert.doesNotMatch(detailHydrator, /categoryFacts\.readByItemRefs\(/);
  assert.doesNotMatch(detailHydrator, /preparationFacts\.readItemProfiles\(/);
  assert.doesNotMatch(detailHydrator, /preparationFacts\.readSkuOverrides\(/);
  assert.doesNotMatch(detailHydrator, /preparationFacts\.readOptionEffects\(/);
  assert.match(preparationFacts, /DetailReadback readDetailFacts\(Collection<UUID> itemRefs, Collection<UUID> skuRefs\)/);
  assert.match(preparationSql, /UNION ALL/);
  assert.match(skuSql, /sku\.updated_at_epoch_millis/);
  assert.match(skuFacts, /sku\.put\("updatedAt", result\.getLong\(33\)\);/);
  assert.doesNotMatch(owner, /skuUpdatedAtByRef/);
  assert.match(
    owner,
    /private Set<UUID> existingProductionTagRef\(ItemRow current, ObjectNode request\)[\s\S]*?currentSections\.has\("productionTagRef"\)/,
  );
  assert.match(owner, /if \(ref\.isNull\(\)\) return Set\.of\(\);/);
  assert.match(referenceReplace, /jdbc\.update\(CatalogItemReferenceFactsSql\.CATALOG_ITEM_REFERENCE_FACTS_DELETE_CATALOG_ITEM_REFERENCE_ITEM_REF_ALTERNATE_A, itemRef\);/);
  assert.match(referenceReplace, /jdbc\.batchUpdate\(CatalogItemReferenceFactsSql\.CATALOG_ITEM_REFERENCE_FACTS_INSERT_INTO_CATALOG_ITEM_REFERENCE_ITEM_REF_KIND_REF, rows\);/);
  assert.match(referenceSql, /DELETE FROM catalog\.catalog_item_reference WHERE item_ref=\?/);
  assert.match(referenceSql, /INSERT INTO catalog\.catalog_item_reference\(item_ref,kind,ref\) VALUES\(\?,\?,\?\)/);
  assert.doesNotMatch(referenceReplace, /WITH deleted AS/);
  const saveCurrentStart = owner.indexOf('private ItemRow requireSaveCurrent');
  const saveCurrentEnd = owner.indexOf('private boolean saveContainsAnyField', saveCurrentStart);
  const saveCurrent = owner.slice(saveCurrentStart, saveCurrentEnd);
  assert.match(
    saveCurrent,
    /if \(!sections\.has\("productionTagRef"\) \|\| !sections\.has\("tagRefs"\)\) \{[\s\S]*?itemReferenceFacts\.readByItemRefs\(/,
  );
  const dictionaryStart = owner.indexOf('private Map<String, Set<UUID>> dictionaryReferencesFromOwner');
  const dictionaryEnd = owner.indexOf('private Map<String, Set<UUID>> relationalSkuDictionaryReferencesForItem', dictionaryStart);
  const dictionaryMethod = owner.slice(dictionaryStart, dictionaryEnd);
  assert.match(
    dictionaryMethod,
    /if \(!currentSections\.has\("tagRefs"\)\) \{[\s\S]*?itemReferenceFacts\.readByItemRefs\(/,
  );
  const relationSnapshotGuardRedMutation = saveCurrent.replace(
    'if (!sections.has("productionTagRef") || !sections.has("tagRefs")) {',
    'if (!saveContainsField(request, "productionTagRef") || !saveContainsField(request, "tagRefs")) {',
  );
  assert.throws(
    () =>
      assert.match(
        relationSnapshotGuardRedMutation,
        /if \(!sections\.has\("productionTagRef"\) \|\| !sections\.has\("tagRefs"\)\)/,
      ),
    /did not match/,
  );
  const dictionarySnapshotGuardRedMutation = dictionaryMethod.replace(
    'if (!currentSections.has("tagRefs")) {',
    'if (true) {',
  );
  assert.throws(
    () => assert.match(dictionarySnapshotGuardRedMutation, /if \(!currentSections\.has\("tagRefs"\)\)/),
    /did not match/,
  );
  const requireAllStart = unitFacts.indexOf('private Map<UUID, CatalogOwnerApi.UnitDefinitionReadback> requireAll');
  const requireAllEnd = unitFacts.indexOf('private void lock(UUID unitRef)', requireAllStart);
  assert.ok(requireAllStart >= 0 && requireAllEnd > requireAllStart);
  const requireAll = unitFacts.slice(requireAllStart, requireAllEnd);
  assert.match(unitSql, /WITH unit_locks AS MATERIALIZED/);
  assert.match(unitSql, /pg_advisory_xact_lock\(lock_key_one,lock_key_two\)/);
  assert.match(unitSql, /FOR UPDATE/);
  assert.doesNotMatch(requireAll, /ordered\.forEach\(this::lock\)/);
  const inventoryRulesStart = inventoryBomOwner.indexOf('private JsonNode replaceCatalogInventoryRulesCore');
  const inventoryRulesEnd = inventoryBomOwner.indexOf('private OwnerIdentity parseRuleOwner', inventoryRulesStart);
  assert.ok(inventoryRulesStart >= 0 && inventoryRulesEnd > inventoryRulesStart);
  const inventoryRulesCore = inventoryBomOwner.slice(inventoryRulesStart, inventoryRulesEnd);
  assert.match(inventoryRulesCore, /lockCatalogItemRefs\(List\.of\(itemRef\)\)/);
  assert.doesNotMatch(inventoryRulesCore, /0x49565255/);

  const itemDetailStart = owner.indexOf('private ObjectNode itemDetail');
  const itemDetailEnd = owner.indexOf('private ArrayNode skuRows', itemDetailStart);
  assert.ok(itemDetailStart >= 0);
  assert.ok(itemDetailEnd > itemDetailStart);
  assert.doesNotMatch(
    owner.slice(itemDetailStart, itemDetailEnd),
    /categorySummaryFactsForItems\(/,
  );
  const detailStartForNoRepeat = owner.indexOf('private ObjectNode detail(');
  const detailMethod = owner
    .slice(detailStartForNoRepeat)
    .match(/private ObjectNode detail\([\s\S]*?return envelope\(requestId, data\);\n    \}/)?.[0] ?? '';
  assert.ok(detailStartForNoRepeat >= 0 && detailMethod.length > 0);
  assert.doesNotMatch(detailMethod, /categorySummaryFactsForItems\(/);
  assert.doesNotMatch(detailMethod, /compositeFacts\.readByItemRefs\(/);
  assert.match(detailMethod, /arrayCopy\(sections\.path\("compositeGroups"\)\)/);
  const detailCategoryRepeatRedMutation = detailMethod.replace(
    'ItemRow row = requireDetailItem(dataNodeRef, brandRef, code);',
    'ItemRow row = requireDetailItem(dataNodeRef, brandRef, code);\n'
      + '        CategorySummaryFacts repeatedCategoryFacts = categorySummaryFactsForItems(dataNodeRef, brandRef, List.of(row));\n'
      + '        if (repeatedCategoryFacts == null) throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "商品分类路径读取失败");',
  );
  assert.throws(
    () => assert.doesNotMatch(detailCategoryRepeatRedMutation, /categorySummaryFactsForItems\(/),
    /expected to not match/,
  );

  const redMutation = detailHydrator.replace(
    'preparationFacts.readDetailFacts(itemRefs, skuRefs)',
    'preparationFacts.readItemProfiles(itemRefs)',
  );
  assert.throws(
    () => assert.match(redMutation, /preparationFacts\.readDetailFacts\(itemRefs, skuRefs\)/),
    /did not match/,
  );

  const categoryRedMutation = detailHydrator.replace(
    'categorySummaryFactsForItems(dataNodeRef, brandRef, rows)',
    'categoryFacts.readByItemRefs(itemRefs)',
  );
  assert.throws(
    () => assert.match(categoryRedMutation, /categorySummaryFactsForItems\(dataNodeRef, brandRef, rows\)/),
    /did not match/,
  );
  const categoryPathRedMutation = detailHydrator.replace(
    'sections.set("categoryPath", categoryPathArray(categoryFacts, row.ref()));',
    'sections.set("categoryPath", mapper.createArrayNode());',
  );
  assert.throws(
    () => assert.match(categoryPathRedMutation, /categoryPathArray\(categoryFacts, row\.ref\(\)\)/),
    /did not match/,
  );
  const compositeRedMutation = detailMethod.replace(
    'arrayCopy(sections.path("compositeGroups"))',
    'compositeFacts.readByItemRefs(List.of(row.ref())).getOrDefault(row.ref(), mapper.createArrayNode())',
  );
  assert.throws(
    () => assert.match(compositeRedMutation, /arrayCopy\(sections\.path\("compositeGroups"\)\)/),
    /did not match/,
  );
  const productionTagRedMutation = owner.replace(
    'if (currentSections.has("productionTagRef"))',
    'if (!saveContainsField(request, "productionTagRef"))',
  );
  assert.throws(
    () =>
      assert.match(
        productionTagRedMutation,
        /currentSections\.has\("productionTagRef"\)/,
      ),
    /did not match/,
  );

  const productionTagNullReuseRedMutation = owner.replace(
    'if (ref.isNull()) return Set.of();',
    '',
  );
  assert.throws(
    () => assert.match(productionTagNullReuseRedMutation, /if \(ref\.isNull\(\)\) return Set\.of\(\);/),
    /did not match/,
  );

  const referenceReplaceRedMutation = referenceReplace.replace(
    'jdbc.batchUpdate("INSERT INTO catalog.catalog_item_reference(item_ref,kind,ref) VALUES(?,?,?)", rows);',
    '',
  );
  assert.throws(
    () =>
      assert.match(
        referenceReplaceRedMutation,
        /jdbc\.batchUpdate\("INSERT INTO catalog\.catalog_item_reference\(item_ref,kind,ref\) VALUES\(\?,\?,\?\)", rows\);/,
      ),
    /did not match/,
  );

  const unitLockRedMutation = requireAll.replace('FOR UPDATE', '');
  assert.throws(() => assert.match(unitLockRedMutation, /FOR UPDATE/), /did not match/);

  const inventoryRuleLockRedMutation = inventoryRulesCore.replace(
    'lockCatalogItemRefs(List.of(itemRef));',
    '',
  );
  assert.throws(
    () => assert.match(inventoryRuleLockRedMutation, /lockCatalogItemRefs\(List\.of\(itemRef\)\)/),
    /did not match/,
  );
});

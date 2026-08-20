import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {readCatalogInventoryOpenApi} from '../lib/catalog-inventory-openapi.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const read = relative => readFileSync(path.join(root, relative), 'utf8');
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
  (required.includes('data') || required.includes('result'));
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
  assert.equal(queryOperations.length, 16);
  const owners = Object.groupBy(queryOperations, responseEnvelopeOwner);
  assert.deepEqual(
    owners.P1.map(operation => operation.operationId),
    ['getOperationsCatalogNavigation', 'getOperationsCatalogItems', 'getOperationsCatalogItem'],
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
      'batchTransitionOperationsCatalogItemStatus',
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

test('CatalogWorkbenchPage keeps strict GET response types instead of widening casts', () => {
  const workbench = read('apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx');

  assert.doesNotMatch(workbench, /CatalogInventoryEnvelope/);
  assert.doesNotMatch(workbench, /currentData as/);
  assert.doesNotMatch(workbench, /query\.data as/);
  assert.match(workbench, /decodeWorkbenchContext\(contextQuery\.currentData\)/);
  assert.match(workbench, /decodeNavigation\(navigationQuery\.currentData\)/);
  assert.match(workbench, /decodeItems\(itemsQuery\.currentData\)/);
  assert.match(workbench, /decodeDetail\(query\.data\)/);
});

test('navigation allCount is a required owner statistic, never a browser aggregation', () => {
  const coverage = JSON.parse(read('contracts/policy/catalog-inventory-design-byte-coverage.json'));
  const navigationModel = readModels.models.find(model => model.name === 'CatalogNavigationView');
  const navigationSchema = openApi.components.schemas.CatalogNavigationView;
  const edge = read('apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts');
  const workbench = read('apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx');
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
  assert.match(workbench, /CatalogTreeLine label="全部商品" count=\{navigation\.allCount\}/);

  const derivedMutation = workbench.replace(
    'navigation.allCount',
    'navigation.shapeCounts.reduce((total, node) => total + node.count, 0)',
  );
  assert.throws(
    () => assert.match(derivedMutation, /CatalogTreeLine label="全部商品" count=\{navigation\.allCount\}/),
    /did not match/,
  );
});

test('CatalogItemDetail declares the material role that its owner actually returns', () => {
  const coverage = JSON.parse(read('contracts/policy/catalog-inventory-design-byte-coverage.json'));
  const detailSchema = openApi.components.schemas.CatalogItemDetail;
  const edge = read('apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts');
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java',
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

test('every catalog-management GET consumer preserves its generated strict response type', () => {
  const queryConsumers = [
    ['ui/CatalogItemCreateDrawer.tsx', ['const manifest = manifestQuery.data?.data;'], ['manifestQuery.data as']],
    [
      'ui/CatalogWorkbenchPage.tsx',
      [
        'decodeWorkbenchContext(contextQuery.currentData)',
        'decodeNavigation(navigationQuery.currentData)',
        'decodeItems(itemsQuery.currentData)',
        'decodeDetail(query.data)',
      ],
      ['currentData as', 'query.data as'],
    ],
    [
      'ui/LocalCatalogCopyDrawer.tsx',
      [
        'decodeLocalCopyCandidatePage(candidatesQuery.currentData)',
        'decodeLocalCopyPreflight(response)',
        'decodeLocalCopyReadback(response)',
      ],
      ['candidatesQuery.data as', 'as CatalogInventoryEnvelope'],
    ],
    [
      'ui/BrandCatalogCopyDrawer.tsx',
      ['const candidatePage = candidatesQuery.currentData?.data;', 'decodeBrandCopyScopes(candidatesQuery.currentData)'],
      ['candidatesQuery.data as'],
    ],
    [
      'ui/CatalogDictionaryDrawer.tsx',
      ['dictionaryQuery.currentData?.data', 'productionQuery.currentData?.data', 'const readback = response.result;'],
      [
        'dictionaryQuery.currentData?.data.data',
        'productionQuery.currentData?.data.data',
        'as CatalogInventoryEnvelope',
      ],
    ],
    [
      'ui/CatalogItemDrawer.tsx',
      [
        'decodeDetail(detailQuery.data)',
        'productionTagPage.entries',
        'decodeNavigation(navigationQuery.data)',
        'decodeItems(itemsQuery.currentData)',
        'const value = response.data;',
        'const readback = response.result;',
      ],
      [
        'detailQuery.data as',
        'productionTagsQuery.data as',
        'navigationQuery.data as',
        'itemsQuery.data as',
        'productionTagsQuery.data?.data.data',
        'as CatalogInventoryEnvelope',
        'as unknown as TemporaryPromotionPreflight',
      ],
    ],
  ];
  assert.equal(queryConsumers.length, 6);
  for (const [file, required, forbidden] of queryConsumers) {
    const source = read(`apps/frontend/operations-admin/src/features/catalog-management/${file}`);
    for (const expression of required) assert.ok(source.includes(expression), `${file} must consume ${expression}`);
    for (const expression of forbidden)
      assert.equal(source.includes(expression), false, `${file} must not widen ${expression}`);
  }
});

test('Local Copy consumes each model-owned response directly', () => {
  const model = read('apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts');

  for (const modelName of ['LocalCopyCandidatePage', 'LocalCopyPreflight', 'LocalCopyReadback']) {
    assert.match(model, new RegExp(`response: ${modelName} \\| undefined`));
  }
  assert.doesNotMatch(model, /localCopyPayload/);
  assert.doesNotMatch(model, /CatalogInventoryEnvelope<LocalCopy/);
});

test('catalog model accepts only the declared data envelope', () => {
  const model = read('apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts');

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
  const inventoryOwner = read(
    'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java',
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
  assert.match(catalogOwner, /private ObjectNode items[\s\S]*?return envelope\(requestId, data\);/);
  assert.match(catalogOwner, /private ObjectNode detail[\s\S]*?return envelope\(requestId, data\);/);

  // The remaining data/root branches are source-backed counterexamples, not CatalogOwner HTTP detail/page consumers.
  for (const marker of [
    'NOT_APPLICABLE_WITH_REASON: CatalogOwnerApi copy preflight is a distinct canonical owner payload',
    'NOT_APPLICABLE_WITH_REASON: InventoryOwnerApi defines this as a raw definition graph',
    'NOT_APPLICABLE_WITH_REASON: InventoryOwnerService.references is a raw inventory task-read',
  ])
    assert.ok(coordinator.includes(marker), `missing source-backed counterexample: ${marker}`);
  assert.match(inventoryOwner, /public JsonNode readCatalogInventoryDefinition[\s\S]*?return data;/);
  assert.match(inventoryOwner, /private ObjectNode references[\s\S]*?return data;/);

  const redMutation = coordinator.replace(
    strictAssetRead,
    'JsonNode detailRoot = detail.path("data").isObject() ? detail.path("data") : detail;',
  );
  assert.throws(() => assert.doesNotMatch(redMutation, forbiddenCatalogOwnerFallback), /expected.*not match/i);
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
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java',
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
  const owner = read(
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java',
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
  for (const boundary of [
    '"catalog save request is invalid", failure',
    'field + " must be a canonical JSON object", invalid',
    '"copy reference plan is invalid", failure',
    '"形态页签契约不可用", failure',
    '"形态契约不可用", ex',
    '"JSON payload is invalid", ex',
  ])
    assert.match(owner, new RegExp(boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const boundary of [
    '"owner copy readback is invalid", failure',
    '"inventory save owner readback is invalid", failure',
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
  const settlement = methodSlice(
    'private void settleWorkspaceCatalogAssets',
    'private InventoryTargetEnsureReadback parseCatalogSaveOwnerReadback',
  );
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
  assert.match(assetOwner, /Replay replay = findReceipt\(GLOBAL_RECEIPT_SCOPE, idempotencyKey\);/);
  assert.match(assetOwner, /AssetReadback current = require\(assetRef\);/);
});

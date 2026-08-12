#!/usr/bin/env node
/**
 * L2-only catalog test fixture.  It deliberately creates the external-order
 * temporary item separately from the static 73-item fixture definition.  The
 * runner never reads the DEV catalog seed; all objects are created through the
 * owner HTTP commands in its own managed namespace.
 */
import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadGeneratedOperationRegistry, materializeGeneratedOperationPath, normalizeEdgePath, resolveGeneratedOperationById} from './seed-report.mjs';
import {catalogImageBindEvidenceInputs} from './catalog-image-bind-evidence-inputs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR || '');
const managedManifestPath = path.join(runtime, 'run-manifest.json');
const catalogRegistryPath = path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json');
const generalRegistryPath = path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json');
const reportPath = path.join(runtime, 'results/catalog-inventory-l2-test-fixture.json');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const required = (value, name) => { if (value === null || value === undefined || value === '') throw new Error(`${name}_REQUIRED`); return value; };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requiredUuid = (value, name) => { if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error(`L2_OWNER_REF_MISSING:${name}`); return value; };
const safeFailure = (value) => String(value?.message || value || 'L2_FIXTURE_FAILED').replaceAll(/[^A-Z0-9_:. -]/g, '').slice(0, 240);
const fail = (reason) => { process.stderr.write(`CATALOG_INVENTORY_L2_TEST_FIXTURE=FAIL; REASON=${reason}\n`); process.exitCode = 2; };

function registry() {
  const general = loadGeneratedOperationRegistry(generalRegistryPath);
  const catalog = readJson(catalogRegistryPath).operations.map((entry) => ({...entry, path: normalizeEdgePath(entry.path)}));
  const all = [...general, ...catalog];
  const byId = new Map();
  for (const operation of all) {
    if (byId.has(operation.operationId)) throw new Error(`OPERATION_DUPLICATE:${operation.operationId}`);
    byId.set(operation.operationId, operation);
  }
  return [...byId.values()];
}

const itemResult = (json) => json?.result ?? json?.data?.result ?? json?.data ?? json;
const responseData = (json) => json?.data ?? json;
const dataNodeFromSession = (session, type, requested) => {
  if (!requested) throw new Error(`${type}_DATA_NODE_REF_REQUIRED`);
  const selected = type === 'STORE' ? session?.scopeContext?.store : type === 'HEAD_COMPANY' ? session?.scopeContext?.headCompany : null;
  if (selected?.dataNodeRef && (!requested || selected.dataNodeRef === requested)) return {ref: selected.dataNodeRef, contextVersion: session.contextVersion};
  const candidates = (session?.dataNodeCandidates ?? []).filter((entry) => entry.dataNodeType === type);
  const chosen = candidates.find((entry) => entry.dataNodeRef === requested);
  if (!chosen) throw new Error(`${type}_DATA_NODE_NOT_VISIBLE`);
  return {candidate: chosen, contextVersion: session.contextVersion};
};

async function execute() {
  if (process.argv.includes('--self-test')) {
    if (!process.env.V2S_RUNTIME_DIR) throw new Error('V2S_RUNTIME_DIR_REQUIRED');
    if (!process.env.CATALOG_INVENTORY_OPERATIONS_LOGIN) throw new Error('CATALOG_INVENTORY_OPERATIONS_LOGIN_REQUIRED');
    const sample = {scopeContext: {store: {dataNodeRef: 'store-ref'}}, dataNodeCandidates: [{dataNodeType: 'STORE', dataNodeRef: 'store-ref'}], contextVersion: 7};
    if (dataNodeFromSession(sample, 'STORE', 'store-ref').ref !== 'store-ref') throw new Error('SESSION_WIRE_DATA_NODE_REF_REQUIRED');
    let codeRefRejected = false; try { requiredUuid('LATTE-001', 'PRODUCT_SKU'); } catch { codeRefRejected = true; }
    if (!codeRefRejected) throw new Error('L2_CODE_TYPED_REF_MUST_REJECT');
    process.stdout.write('CATALOG_INVENTORY_L2_TEST_FIXTURE_SELF_TEST=PASS\n');
    return;
  }
  if (!runtime || !fs.existsSync(managedManifestPath)) throw new Error('MANAGED_RUN_MANIFEST_REQUIRED');
  const manifest = readJson(managedManifestPath);
  if (manifest.kind !== 'r5-dev-run-manifest' || manifest.freshDatabase !== true) throw new Error('MANAGED_RUN_MANIFEST_INVALID');
  const imageBindEvidenceInputs = catalogImageBindEvidenceInputs(root);
  const credentials = Object.fromEntries(fs.readFileSync(required(manifest.credentialsFile, 'CREDENTIALS_FILE'), 'utf8').trim().split('\n').filter(Boolean).map((line) => line.split('=', 2)));
  const all = registry();
  const base = (process.env.CATALOG_INVENTORY_EDGE_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
  const workspaceKey = process.env.CATALOG_INVENTORY_GROUP_WORKSPACE_KEY || 'aurora';
  const loginName = required(process.env.CATALOG_INVENTORY_OPERATIONS_LOGIN, 'CATALOG_INVENTORY_OPERATIONS_LOGIN');
  const password = required(process.env.CATALOG_INVENTORY_OPERATIONS_PASSWORD || credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD, 'CATALOG_INVENTORY_OPERATIONS_PASSWORD');
  const brandRef = required(process.env.CATALOG_INVENTORY_BRAND_REF, 'CATALOG_INVENTORY_BRAND_REF');
  const events = [];
  const calls = [];
  const startedAt = new Date().toISOString();
  const request = async (operationId, pathParameters = {}, options = {}) => {
    const operation = resolveGeneratedOperationById(all, operationId);
    const pathname = materializeGeneratedOperationPath(operation, {pathParameters, queryParameters: options.queryParameters || {}});
    const correlationId = `catalog-l2-fixture-${randomUUID()}`;
    const headers = {Accept: 'application/json', 'X-Seed-Operation-Id': operationId, 'X-Seed-Run-Id': manifest.runId, 'X-Correlation-Id': correlationId};
    if (options.cookie) headers.Cookie = options.cookie;
    if (options.brandRef) headers['X-Workspace-Brand-Ref'] = options.brandRef;
    Object.assign(headers, options.headers || {});
    if (operation.method !== 'GET') {
      headers['Idempotency-Key'] = `catalog-l2-fixture-${sha256(`${manifest.runId}:${operationId}:${options.idempotencySuffix || 'default'}`).slice(0, 48)}`;
      if (!options.form) headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${base}${pathname}`, {method: operation.method, headers, body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)), signal: AbortSignal.timeout(30_000)});
    const text = await response.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* response shape is recorded, not raw */ }
    const accepted = (options.expected || [200]).includes(response.status);
    calls.push({operationId, method: operation.method, routeTemplate: operation.path, status: response.status, outcome: accepted ? 'SUCCEEDED' : 'FAILED', requestId: response.headers.get('x-request-id')});
    events.push({at: new Date().toISOString(), operationId, status: accepted ? 'PASS' : 'FAIL', httpStatus: response.status, requestId: response.headers.get('x-request-id')});
    if (!accepted) { const error = new Error(`${operationId}_HTTP_${response.status}_${json?.errorCode || json?.code || 'UNCLASSIFIED'}`); error.response = json; throw error; }
    return {json, status: response.status, cookie: response.headers.get('set-cookie')?.split(';', 1)[0] || null};
  };

  const loginScoped = async (scopeType, scopedLoginName, requestedRef) => {
    const scopedLogin = await request('operationsWorkspacePasswordLogin', {groupWorkspaceKey: workspaceKey}, {
      body: {loginName: scopedLoginName, password},
      idempotencySuffix: `${scopeType}-login`,
    });
    const scopedCookie = required(scopedLogin.cookie, `${scopeType}_SESSION_COOKIE`);
    const scopedEntry = await request('getOperationsWorkspaceSessionEntry', {groupWorkspaceKey: workspaceKey}, {cookie: scopedCookie});
    const scopedNode = dataNodeFromSession(scopedEntry.json, scopeType, requestedRef);
    let scopedSession = scopedEntry.json;
    if (!scopedNode.ref) {
      scopedSession = (await request('selectOperationsWorkspaceSessionDataNode', {groupWorkspaceKey: workspaceKey}, {
        cookie: scopedCookie,
        idempotencySuffix: `${scopeType}-select-${scopedNode.candidate.dataNodeRef}`,
        body: {dataNodeRef: scopedNode.candidate.dataNodeRef, dataNodeType: scopeType, requiredContextVersion: scopedNode.contextVersion},
      })).json;
    }
    const selectedNode = scopeType === 'STORE' ? scopedSession?.scopeContext?.store : scopedSession?.scopeContext?.headCompany;
    const scopedDataNodeRef = selectedNode?.dataNodeRef || scopedNode.ref || scopedNode.candidate?.dataNodeRef;
    if (!scopedDataNodeRef) throw new Error(`${scopeType}_DATA_NODE_SELECTION_MISSING`);
    await request('getOperationsCatalogWorkbenchContext', {}, {cookie: scopedCookie, brandRef, queryParameters: {dataNodeRef: scopedDataNodeRef}});
    return {cookie: scopedCookie, dataNodeRef: scopedDataNodeRef};
  };
  const store = await loginScoped('STORE', loginName, process.env.CATALOG_INVENTORY_STORE_REF);
  const cookie = store.cookie;
  const dataNodeRef = store.dataNodeRef;
  const headLoginName = required(process.env.CATALOG_INVENTORY_HEAD_COMPANY_LOGIN, 'CATALOG_INVENTORY_HEAD_COMPANY_LOGIN');
  const head = await loginScoped('HEAD_COMPANY', headLoginName, required(process.env.CATALOG_INVENTORY_HEAD_COMPANY_REF, 'CATALOG_INVENTORY_HEAD_COMPANY_REF'));
  const headCookie = head.cookie;
  const headDataNodeRef = head.dataNodeRef;
  const l2Suffix = manifest.runId.replaceAll(/[^A-Za-z0-9]/g, '').slice(-12);
  const l2Code = (baseCode) => `${baseCode}-L2-${l2Suffix}`;
  const latteCode = l2Code('LATTE-001');
  const beanCode = l2Code('BEAN-001');
  const dinnerCode = l2Code('DINNER-SET-001');
  const caesarCode = l2Code('CAESAR-001');
  const weighedCode = l2Code('PORK-WEIGHT-001');

  // L2 owns its visible facts.  These are intentionally not the business seed
  // and are not read from the API acceptance report.  They provide only the
  // item shapes required by the browser scenarios, using the same owner HTTP
  // commands that a real operator would use.
  const getDetail = async (code) => request('getOperationsCatalogItem', {itemCode: code}, {cookie, brandRef, queryParameters: {dataNodeRef}, expected: [200, 404], allowRejected: true});
  const createItem = async (code, shapeKey, attributes = {}) => request('createOperationsCatalogItem', {}, {cookie, brandRef, expected: [200], idempotencySuffix: `l2-create-${code}`, body: {dataNodeRef, name: code, code, shapeKey, attributes: {fixtureRef: 'L2_ACCEPTANCE', ...attributes}}});
  const stagedAssetBindGrants = new Map();
  const catalogAssetBindGrantHeaders = (draft) => {
    const refs = [
      ...(draft.images || []),
      ...(draft.skus || []).flatMap((sku) => sku.mediaRefs || []),
    ].map((ref) => typeof ref === 'string' ? ref : ref?.assetRef).filter(Boolean);
    const grants = Object.fromEntries(refs.map((assetRef) => [assetRef, stagedAssetBindGrants.get(assetRef)]).filter(([, bindGrant]) => typeof bindGrant === 'string' && bindGrant.length > 0));
    return Object.keys(grants).length ? {'X-Catalog-Asset-Bind-Grants': JSON.stringify(grants)} : {};
  };
  const saveItem = async (code, version, draft, inventoryConfiguration = {nodes: []}) => request('saveOperationsCatalogItem', {itemCode: code}, {cookie, brandRef, idempotencySuffix: `l2-save-${code}`, headers: catalogAssetBindGrantHeaders(draft), body: {dataNodeRef, itemCode: code, sections: {catalogDraft: draft, inventoryConfiguration, expectedCatalogVersion: version, expectedInventoryVersions: []}}});
  const ensureItem = async ({code, shapeKey, attributes = {}, draft, inventoryConfiguration}) => {
    const existing = await getDetail(code);
    if (existing.status === 404) {
      const createdItem = await createItem(code, shapeKey, attributes);
      const version = Number(itemResult(createdItem.json)?.version || createdItem.json?.version || 1);
      await saveItem(code, version, draft, inventoryConfiguration);
    } else {
      const current = itemResult(existing.json)?.item || itemResult(existing.json);
      if (current?.shapeKey !== shapeKey) throw new Error(`L2_FIXTURE_SHAPE_CONFLICT:${code}`);
    }
  };
  const refsByScope = new Map();
  const refsFor = (scope, scopeDataNodeRef) => {
    const key = `${scope}:${scopeDataNodeRef}`;
    if (!refsByScope.has(key)) refsByScope.set(key, {dictionary: new Map(), item: new Map(), sku: new Map(), value: new Map(), local: new Map()});
    return refsByScope.get(key);
  };
  const dictionaryKey = (kind, code) => `${kind}:${code}`;
  const localRef = (refs, key) => { if (!refs.local.has(key)) refs.local.set(key, randomUUID()); return refs.local.get(key); };
  const dictionaryRef = (refs, kind, code) => requiredUuid(refs.dictionary.get(dictionaryKey(kind, code)), `${kind}:${code}`);
  const itemRef = (refs, code) => requiredUuid(refs.item.get(code), `CATALOG_ITEM:${code}`);
  const skuRef = (refs, code) => requiredUuid(refs.sku.get(code), `PRODUCT_SKU:${code}`);
  const recordRefs = async (scope, scopeCookie, scopeDataNodeRef, phase, code) => {
    const detail = await request('getOperationsCatalogItem', {itemCode: code}, {cookie: scopeCookie, brandRef, queryParameters: {dataNodeRef: scopeDataNodeRef}});
    const item = itemResult(detail.json)?.item || itemResult(detail.json);
    const refs = refsFor(scope, scopeDataNodeRef);
    refs.item.set(code, requiredUuid(item.itemRef, `CATALOG_ITEM:${code}:readback`));
    for (const sku of item.skus || []) refs.sku.set(sku.skuCode, requiredUuid(sku.productSkuRef, `PRODUCT_SKU:${sku.skuCode}:readback`));
    for (const dimension of item.skuVariantDimensions || []) for (const value of dimension.values || []) refs.value.set(value.valueCode, requiredUuid(value.valueRef, `SKU_ATTRIBUTE_VALUE:${value.valueCode}:readback`));
    for (const group of item.orderOptions || []) for (const value of group.values || []) if (value.code) refs.value.set(value.code, requiredUuid(value.attributeValueRef, `SKU_ATTRIBUTE_VALUE:${value.code}:readback`));
    events.push({at: new Date().toISOString(), operationId: 'getOperationsCatalogItem', status: 'PASS', typedReferenceReadback: phase, itemCode: code});
    return item;
  };
  const materializeDictionaryRefs = async (scope, scopeCookie, scopeDataNodeRef) => {
    const refs = refsFor(scope, scopeDataNodeRef);
    for (const [kind, codes] of [['SKU_ATTRIBUTE', ['SIZE']], ['SKU_ATTRIBUTE_VALUE', ['S', 'M', 'L', 'CAESAR-DRESSING-DEFAULT', 'CAESAR-SIZE-DEFAULT', 'CAESAR-TOPPING-DEFAULT']]]) {
      for (const code of codes) await request('createOperationsCatalogDictionaryEntry', {dictionaryKind: kind}, {cookie: scopeCookie, brandRef, idempotencySuffix: `${scope}-${kind}-${code}`, body: {dataNodeRef: scopeDataNodeRef, dictionaryKind: kind, code, name: code}});
      const readback = itemResult((await request('getOperationsCatalogDictionary', {dictionaryKind: kind}, {cookie: scopeCookie, brandRef, queryParameters: {dataNodeRef: scopeDataNodeRef}})).json);
      for (const entry of readback.entries || []) refs.dictionary.set(dictionaryKey(kind, entry.code), requiredUuid(entry.entryRef, `${kind}:${entry.code}:readback`));
      for (const code of codes) dictionaryRef(refs, kind, code);
    }
  };
  await materializeDictionaryRefs('STORE', cookie, dataNodeRef);
  await materializeDictionaryRefs('HEAD_COMPANY', headCookie, headDataNodeRef);
  const latteDraft = (refs, scopeLatteCode) => ({skuVariantDimensions: [{attributeRef: dictionaryRef(refs, 'SKU_ATTRIBUTE', 'SIZE'), attributeCode: 'SIZE', attributeName: '杯型', values: ['S', 'M', 'L'].map((value, displayOrder) => ({valueRef: dictionaryRef(refs, 'SKU_ATTRIBUTE_VALUE', value), valueCode: value, valueLabel: value, displayOrder, status: displayOrder === 2 ? 'ARCHIVED' : 'ENABLED'}))}], skus: ['S', 'M', 'L'].map((size, index) => ({productSkuRef: localRef(refs, `SKU:${scopeLatteCode}-SKU-${size}`), skuCode: `${scopeLatteCode}-SKU-${size}`, skuName: `${size}杯`, attributeValueRefs: [{attributeRef: dictionaryRef(refs, 'SKU_ATTRIBUTE', 'SIZE'), attributeCode: 'SIZE', attributeName: '杯型', attributeValueRef: dictionaryRef(refs, 'SKU_ATTRIBUTE_VALUE', size), valueCode: size, valueLabel: size, displayOrder: index, status: index === 2 ? 'ARCHIVED' : 'ENABLED'}], skuBarcode: `${scopeLatteCode}-SKU-${size}-BARCODE`, standardSalePrice: 100 + index * 20, isDefault: index === 0, status: index === 2 ? 'ARCHIVED' : 'ENABLED', version: 1, mediaRefs: []}))});
  const commonDraft = (code, shapeKey, extra = {}) => ({name: code, shapeKey, attributes: {fixtureRef: 'L2_ACCEPTANCE'}, images: [], productionTagRefs: [], categoryRefs: [], ordering: {priceGranularity: shapeKey === 'SKU_VARIANT_SALE_COUNTED' ? 'SKU' : 'ITEM', standardSalePrice: 100, listedSalePrice: 100, missingPriceCount: 0}, ...extra});
  const stageImage = async (fixtureRef, fileName) => {
    const bytes = fs.readFileSync(path.join(root, 'contracts/policy/catalog-inventory-p1-media', fileName));
    const form = new FormData();
    form.set('dataNodeRef', dataNodeRef);
    form.set('fileName', fileName);
    form.set('mediaType', 'image/jpeg');
    form.set('contentDigest', sha256(bytes));
    form.set('content', new Blob([bytes], {type: 'image/jpeg'}), fileName);
    const staged = await request('stageOperationsCatalogAsset', {}, {cookie, brandRef, form, idempotencySuffix: `l2-image-${fixtureRef}-${fileName}`});
    const result = itemResult(staged.json);
    const assetRef = result?.assetRef;
    const bindGrant = result?.bindGrant;
    if (typeof assetRef !== 'string' || assetRef.length === 0) throw new Error(`L2_IMAGE_STAGE_READBACK_MISSING:${fixtureRef}:${fileName}`);
    if (typeof bindGrant !== 'string' || bindGrant.length === 0) throw new Error(`L2_IMAGE_STAGE_BIND_GRANT_MISSING:${fixtureRef}:${fileName}`);
    stagedAssetBindGrants.set(assetRef, bindGrant);
    return assetRef;
  };
  // Brand-copy candidates are owned by the head-company + brand source scope.
  // Keep that source fact separate from the store-owned target fixtures: the
  // browser journey must prove the real organization-derived copy boundary,
  // not pass because a same-scope target item happens to be present.
  const headGetDetail = async (code) => request('getOperationsCatalogItem', {itemCode: code}, {cookie: headCookie, brandRef, queryParameters: {dataNodeRef: headDataNodeRef}, expected: [200, 404]});
  const headCreateItem = async (code, shapeKey, attributes = {}) => request('createOperationsCatalogItem', {}, {cookie: headCookie, brandRef, expected: [200], idempotencySuffix: `l2-head-create-${code}`, body: {dataNodeRef: headDataNodeRef, name: code, code, shapeKey, attributes: {fixtureRef: 'L2_ACCEPTANCE_HEAD_COMPANY', ...attributes}}});
  const headSaveItem = async (code, version, draft, inventoryConfiguration = {nodes: []}) => request('saveOperationsCatalogItem', {itemCode: code}, {cookie: headCookie, brandRef, idempotencySuffix: `l2-head-save-${code}`, body: {dataNodeRef: headDataNodeRef, itemCode: code, sections: {catalogDraft: draft, inventoryConfiguration, expectedCatalogVersion: version, expectedInventoryVersions: []}}});
  const ensureHeadItem = async ({code, shapeKey, attributes = {}, draft, inventoryConfiguration}) => {
    const existing = await headGetDetail(code);
    if (existing.status === 404) {
      const createdItem = await headCreateItem(code, shapeKey, attributes);
      const version = Number(itemResult(createdItem.json)?.version || createdItem.json?.version || 1);
      await headSaveItem(code, version, draft, inventoryConfiguration);
    } else {
      const current = itemResult(existing.json)?.item || itemResult(existing.json);
      if (current?.shapeKey !== shapeKey) throw new Error(`L2_HEAD_COMPANY_FIXTURE_SHAPE_CONFLICT:${code}`);
    }
  };
  await ensureHeadItem({code: beanCode, shapeKey: 'MATERIAL', attributes: {fixtureRef: 'SEED-MATERIALS', source: 'HEAD_COMPANY_COPY_SOURCE'}, draft: commonDraft(beanCode, 'MATERIAL', {materialRole: 'RAW_MATERIAL'}), inventoryConfiguration: {nodes: [{nodeType: 'ITEM', itemCode: beanCode, mode: 'INDEPENDENT_STOCK', consumptionUnit: 'GRAM', configuration: {allowNegative: false, lowStockThreshold: '1', countingUnit: 'KILOGRAM', conversionFactor: '1000'}}]}});
  await ensureHeadItem({code: latteCode, shapeKey: 'SKU_VARIANT_SALE_COUNTED', attributes: {fixtureRef: 'SEED-LATTE', source: 'HEAD_COMPANY_COPY_SOURCE'}, draft: commonDraft(latteCode, 'SKU_VARIANT_SALE_COUNTED', latteDraft(refsFor('HEAD_COMPANY', headDataNodeRef), latteCode))});
  await recordRefs('HEAD_COMPANY', headCookie, headDataNodeRef, 'HEAD_LATTTE', latteCode);
  const headSourceDetail = await headGetDetail(beanCode);
  const headSourceData = itemResult(headSourceDetail.json)?.item || itemResult(headSourceDetail.json);
  if (headSourceDetail.status !== 200 || headSourceData?.code !== beanCode || headSourceData?.shapeKey !== 'MATERIAL') throw new Error('L2_BRAND_COPY_SOURCE_READBACK_MISSING');
  const sourceCandidates = await request('getOperationsBrandCatalogCopyCandidates', {}, {cookie, brandRef, queryParameters: {dataNodeRef}});
  const sourceCandidateItems = responseData(sourceCandidates.json)?.items || [];
  if (!sourceCandidateItems.some((item) => item.code === beanCode)) throw new Error('L2_BRAND_COPY_CANDIDATE_READBACK_MISSING');
  await ensureItem({code: beanCode, shapeKey: 'MATERIAL', attributes: {fixtureRef: 'SEED-MATERIALS'}, draft: commonDraft(beanCode, 'MATERIAL', {materialRole: 'RAW_MATERIAL'}), inventoryConfiguration: {nodes: [{nodeType: 'ITEM', itemCode: beanCode, mode: 'INDEPENDENT_STOCK', consumptionUnit: 'GRAM', configuration: {allowNegative: false, lowStockThreshold: '1', countingUnit: 'KILOGRAM', conversionFactor: '1000'}}]}});
  await ensureItem({code: latteCode, shapeKey: 'SKU_VARIANT_SALE_COUNTED', attributes: {fixtureRef: 'SEED-LATTE'}, draft: commonDraft(latteCode, 'SKU_VARIANT_SALE_COUNTED', latteDraft(refsFor('STORE', dataNodeRef), latteCode))});
  await recordRefs('STORE', cookie, dataNodeRef, 'STORE_LATTE', latteCode);
  const storeRefs = refsFor('STORE', dataNodeRef);
  await ensureItem({code: dinnerCode, shapeKey: 'COMPOSITE', attributes: {fixtureRef: 'SEED-DINNER-SET'}, draft: commonDraft(dinnerCode, 'COMPOSITE', {compositeGroups: [{groupCode: 'DINNER-COMPONENTS', groupName: '套餐组件', selectionRule: 'REQUIRED', components: [{itemCode: latteCode, itemRef: itemRef(storeRefs, latteCode), skuCode: `${latteCode}-SKU-M`, productSkuRef: skuRef(storeRefs, `${latteCode}-SKU-M`), quantity: '1', unit: 'EACH', default: true, extraPrice: null, status: 'ENABLED'}]}]})});
  await ensureItem({code: caesarCode, shapeKey: 'STANDARD_SALE_COUNTED', attributes: {fixtureRef: 'SEED-CAESAR'}, draft: commonDraft(caesarCode, 'STANDARD_SALE_COUNTED', {orderOptions: ['CAESAR-DRESSING', 'CAESAR-SIZE', 'CAESAR-TOPPING'].map((groupCode) => ({groupCode, groupName: groupCode, selectionMode: 'SINGLE', required: true, values: [{code: `${groupCode}-DEFAULT`, name: `${groupCode}-DEFAULT`, attributeValueRef: dictionaryRef(storeRefs, 'SKU_ATTRIBUTE_VALUE', `${groupCode}-DEFAULT`), default: true, extraPrice: null, productionEffects: []}]}))})});
  await ensureItem({code: weighedCode, shapeKey: 'STANDARD_SALE_WEIGHED', attributes: {fixtureRef: 'SEED-WEIGHED'}, draft: commonDraft(weighedCode, 'STANDARD_SALE_WEIGHED')});
  // This fixture owns the two real image bytes used by browser L2.  It never
  // consumes the DEV seed or API-suite report: stage, claim and readback all
  // pass through the normal owner HTTP operations in this run namespace.
  const assetItemCode = l2Code('ASSET-IMAGE-001');
  const primaryImageAssetRef = await stageImage('FIXTURE-ASSET-PROCESSING', 'coffee.jpg');
  const secondaryImageAssetRef = await stageImage('FIXTURE-ASSET-PROCESSING', 'tiramisu.jpg');
  await ensureItem({
    code: assetItemCode,
    shapeKey: 'STANDARD_SALE_COUNTED',
    attributes: {fixtureRef: 'FIXTURE-ASSET-PROCESSING', source: 'L2_ACCEPTANCE_ONLY'},
    draft: commonDraft(assetItemCode, 'STANDARD_SALE_COUNTED', {images: [primaryImageAssetRef, secondaryImageAssetRef]}),
  });
  const assetItemDetail = await request('getOperationsCatalogItem', {itemCode: assetItemCode}, {cookie, brandRef, queryParameters: {dataNodeRef}});
  const assetItemImages = itemResult(assetItemDetail.json)?.item?.images ?? itemResult(assetItemDetail.json)?.images;
  if (!Array.isArray(assetItemImages) || assetItemImages.length !== 2 || assetItemImages[0] !== primaryImageAssetRef || assetItemImages[1] !== secondaryImageAssetRef) {
    throw new Error('L2_IMAGE_FIXTURE_CLAIM_READBACK_MISSING');
  }
  await request('createOperationsProductionTag', {}, {cookie, brandRef, expected: [200], idempotencySuffix: 'l2-tag', body: {dataNodeRef, code: l2Code('L2-TAG-001'), name: 'L2生产提示', tagKind: 'PRODUCTION'}}).catch((error) => { if (!String(error?.message).includes('HTTP_409')) throw error; });

  // L2 must not exercise the mutable target that the API acceptance suite uses
  // for count/increase/adjust/configuration.  Create a run-scoped target from
  // the same owner command surface and publish its exact ref for the browser;
  // selecting a page's first row would let API mutations silently change the
  // L2 starting state.
  const l2InventoryCode = `L2-INV-${l2Suffix}`;
  const inventoryCreated = await request('createOperationsCatalogItem', {}, {cookie, brandRef, expected: [200], idempotencySuffix: 'create-l2-inventory', body: {
    dataNodeRef,
    name: 'L2库存动作样本',
    code: l2InventoryCode,
    shapeKey: 'MATERIAL',
    attributes: {fixtureRef: 'FIXTURE-L2-INVENTORY-ACTION', source: 'L2_ACCEPTANCE_ONLY'},
  }});
  const inventoryVersion = Number(itemResult(inventoryCreated.json)?.version || inventoryCreated.json?.version || 1);
  await recordRefs('STORE', cookie, dataNodeRef, 'L2_INVENTORY', l2InventoryCode);
  const inventorySaved = await request('saveOperationsCatalogItem', {itemCode: l2InventoryCode}, {cookie, brandRef, idempotencySuffix: 'save-l2-inventory', body: {
    dataNodeRef,
    itemCode: l2InventoryCode,
    sections: {
      catalogDraft: {
        name: 'L2库存动作样本',
        shapeKey: 'MATERIAL',
        materialRole: 'RAW_MATERIAL',
        attributes: {fixtureRef: 'FIXTURE-L2-INVENTORY-ACTION', source: 'L2_ACCEPTANCE_ONLY'},
        images: [],
        identifiers: [],
        categoryRefs: [],
        productionTagRefs: [],
        ordering: {priceGranularity: 'ITEM', standardSalePrice: null, listedSalePrice: null, missingPriceCount: 1},
        productionProfiles: {item: {materialRole: 'RAW_MATERIAL'}, sku: {}, optionValue: {}},
        skus: [],
        orderOptions: [],
        compositeGroups: [],
      },
      inventoryConfiguration: {
        nodes: [{
          nodeType: 'ITEM',
          itemCode: l2InventoryCode,
          itemRef: itemRef(storeRefs, l2InventoryCode),
          productSkuRef: null,
          mode: 'INDEPENDENT_STOCK',
          consumptionUnit: 'EACH',
          configuration: {allowNegative: false, lowStockThreshold: '1', countingUnit: 'EACH', conversionFactor: '1'},
        }],
      },
      expectedCatalogVersion: inventoryVersion,
      expectedInventoryVersions: [],
    },
  }});
  if (!itemResult(inventorySaved.json)?.version && inventorySaved.json?.version === undefined) throw new Error('L2_INVENTORY_FIXTURE_SAVE_READBACK_MISSING');
  const inventoryPage = await request('getOperationsInventoryTargets', {}, {cookie, brandRef, queryParameters: {dataNodeRef, keyword: l2InventoryCode, pageSize: 100}});
  const inventoryData = responseData(inventoryPage.json);
  const inventoryTarget = (inventoryData?.items || []).find((row) => row.productCode === l2InventoryCode);
  if (!inventoryTarget?.targetRef) throw new Error('L2_INVENTORY_FIXTURE_TARGET_READBACK_MISSING');
  const itemBinding = (code) => ({primaryCatalogItemCode: code, catalogItemCodes: [code]});
  const l2FixtureBindings = {
    'SEED-LATTE': itemBinding(latteCode),
    'SEED-DINNER-SET': itemBinding(dinnerCode),
    'SEED-CAESAR': itemBinding(caesarCode),
    'SEED-MATERIALS': {...itemBinding(beanCode), primaryTargetRef: inventoryTarget.targetRef, primaryTargetProductCode: beanCode},
    'SEED-WEIGHED': itemBinding(weighedCode),
    'FIXTURE-ARCHIVED-ONLY-SKU': itemBinding(latteCode),
    'FIXTURE-DISABLED-SKU': itemBinding(latteCode),
    'FIXTURE-SHAPE-ADMISSION': itemBinding(weighedCode),
    'FIXTURE-PRODUCIBLE-RETAINED': itemBinding(caesarCode),
    'FIXTURE-SHAPE-MATRIX': itemBinding(caesarCode),
    'FIXTURE-VOID-INBOUND-REFERENCE': itemBinding(dinnerCode),
    'FIXTURE-VOID-DEPENDENT-FACT': itemBinding(beanCode),
    'FIXTURE-ASSET-PROCESSING': {...itemBinding(assetItemCode), assetRefs: [primaryImageAssetRef, secondaryImageAssetRef]},
    'FIXTURE-UNIT-GRAM-EACH': itemBinding(beanCode),
    'FIXTURE-STALE-SOURCE': itemBinding(latteCode),
    'FIXTURE-SURFACE-STATES': itemBinding(latteCode),
    'FIXTURE-WORKBENCH-QUERY': itemBinding(latteCode),
    'FIXTURE-SCENARIO-CI-L2-004': itemBinding(latteCode),
    'FIXTURE-SCENARIO-CI-L2-008': itemBinding(latteCode),
    'FIXTURE-SCENARIO-CI-L2-018': itemBinding(latteCode),
    'FIXTURE-ADVANCED-DIAGNOSTICS': {primaryTargetRef: inventoryTarget.targetRef, primaryTargetProductCode: l2InventoryCode},
    'FIXTURE-INVENTORY-NEGATIVE': {primaryTargetRef: inventoryTarget.targetRef, primaryTargetProductCode: l2InventoryCode},
    'FIXTURE-COUNT-INCREASE-ADJUST': {primaryTargetRef: inventoryTarget.targetRef, primaryTargetProductCode: l2InventoryCode},
    'FIXTURE-CONFIG-ONLY': {primaryTargetRef: inventoryTarget.targetRef, primaryTargetProductCode: l2InventoryCode},
  };
  const report = {schemaVersion: 1, kind: 'catalog-inventory-l2-test-fixture', fixtureRef: 'L2-RUN-SCOPED-CATALOG', runId: manifest.runId, startedAt, finishedAt: new Date().toISOString(), status: 'PASS', businessStatus: 'PASS', cleanupStatus: 'NOT_OWNED_BY_FIXTURE', cleanupOwner: 'JOINT_L2_RUNNER', firstFailure: null, lastKnownGood: 'L2_FIXTURE_READBACK', brokenBoundary: null, imageBindEvidenceInputs, dataNodeRef, itemCode: latteCode, l2InventoryItemCode: l2InventoryCode, l2InventoryTargetRef: inventoryTarget.targetRef, l2FixtureBindings, calls, events, httpOnly: true};
  fs.mkdirSync(path.dirname(reportPath), {recursive: true, mode: 0o700}); fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {mode: 0o600});
  process.stdout.write(`CATALOG_INVENTORY_L2_TEST_FIXTURE=PASS; REPORT=${reportPath}\n`);
}

execute().catch((error) => { const reason = safeFailure(error); try { fs.mkdirSync(path.dirname(reportPath), {recursive: true, mode: 0o700}); fs.writeFileSync(reportPath, `${JSON.stringify({schemaVersion: 1, kind: 'catalog-inventory-l2-test-fixture', status: 'FAIL', businessStatus: 'FAIL', cleanupStatus: 'NOT_OWNED_BY_FIXTURE', cleanupOwner: 'JOINT_L2_RUNNER', firstFailure: reason, lastKnownGood: 'FIXTURE_EXECUTION', brokenBoundary: 'FIXTURE_EXECUTION', reason}, null, 2)}\n`, {mode: 0o600}); } catch { /* preserve primary failure */ } fail(reason); });

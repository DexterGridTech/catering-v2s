import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {plan as seedPlan} from './sales-menu-seed-plan.mjs';
import {
  SalesMenuSeedFailure,
  buildStaticSeedPlan,
  validateParentSeedContext,
  validateCatalogAvailabilityReceipt,
  validateRuntimeSeedStaticInputs,
  validateStaticSeedPlan,
  sectionRefFromDraftRows,
  publishedSkuSubsetMismatch,
  publishedRowsBySeedItemCode,
} from './sales-menu-seed-executor.mjs';
import {availabilityContractDigest, availabilityReceiptFacts} from './catalog-availability-receipt.mjs';
import {loadGeneratedOperationRegistry} from '../test/seed-report.mjs';

const root = new URL('../../', import.meta.url);
const executorUrl = new URL('./sales-menu-seed-executor.mjs', import.meta.url);
const profileUrl = new URL('./profiles/sales-menu.json', import.meta.url);
const generalRegistryUrl = new URL('../../apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json', import.meta.url);
const catalogRegistryUrl = new URL('../../apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json', import.meta.url);
const code = expected => error => error instanceof SalesMenuSeedFailure && error.code === expected;

async function inputs() {
  const [profileText, catalogText] = await Promise.all([readFile(profileUrl, 'utf8'), readFile(catalogRegistryUrl, 'utf8')]);
  return {
    staticPlan: structuredClone(seedPlan),
    profile: JSON.parse(profileText),
    generalRegistry: loadGeneratedOperationRegistry(generalRegistryUrl),
    catalogRegistry: JSON.parse(catalogText).operations,
  };
}

test('sales-menu child declares static-only inputs and parent-only runtime authority', () => {
  const child = buildStaticSeedPlan();
  assert.equal(child.kind, 'sales-menu-seed-child-plan');
  assert.equal(child.stageId, 'sales-menu');
  assert.equal(child.status, 'STATIC_PLAN_ONLY');
  assert.equal(child.business, 'NOT_RUN');
  assert.equal(child.cleanup, 'NOT_APPLICABLE_STATIC_ONLY');
  assert.equal(child.noDirectDatabaseWrites, true);
  assert.equal(child.requiresManagedParentRunId, true);
  assert.doesNotThrow(() => validateStaticSeedPlan(child));
  assert.throws(() => validateStaticSeedPlan({...child, business: 'PASS'}), code('SALES_MENU_SEED_STATIC_PLAN_INVALID'));
});

test('sales-menu child admits the exact generated operation and cross-owner denominator', async () => {
  const validated = validateRuntimeSeedStaticInputs(await inputs());
  assert.equal(validated.itemSelectors.length, 21);
  assert.equal(validated.primaryDefinition.items.length, 21);
  assert.equal(validated.staticPlan.secondaryDefinition.schedule.kind, 'DAILY_TIME_RANGE');
  assert.equal(validated.staticPlan.secondaryDefinition.activation, 'ENABLED');
  assert.equal(validated.requiredOperationIds.includes('stageOperationsSalesMenuAsset'), true);
  assert.equal(validated.requiredOperationIds.includes('getOperationsSalesMenuItemCandidates'), true);
  assert.equal(validated.requiredOperationIds.includes('getOperationsCatalogItemSkus'), true);
  assert.equal(validated.requiredOperationIds.includes('listOperationsCatalogOrderOptionDefinitions'), true);
  assert.equal(validated.requiredOperationIds.includes('getOperationsInventoryTarget'), false);
  assert.equal(validated.availabilityDefinition.sourceReceiptStage, 'catalog-inventory');
  assert.equal(validated.planDigest.length, 64);
});

test('sales-menu child accepts only a run-bound Catalog availability receipt', () => {
  const report = {
    kind: 'catalog-inventory-seed-report', status: 'PASS', business: 'PASS', managedDevRunId: 'dev-1',
    salesMenuAvailabilityReceipt: [
      ['R5-SALES-AVAIL-NO-TARGET-001', false, 'NOT_APPLICABLE', null, null],
      ['R5-SALES-AVAIL-NORMAL-001', true, 'APPLICABLE', 'AVAILABLE', null],
      ['R5-SALES-AVAIL-LOW-001', true, 'APPLICABLE', 'AVAILABLE', null],
      ['R5-SALES-AVAIL-OUT-001', true, 'APPLICABLE', 'AUTO_UNAVAILABLE', 'OUT_OF_STOCK'],
      ['R5-SALES-AVAIL-NEGATIVE-ALLOWED-001', true, 'APPLICABLE', 'AVAILABLE', null],
      ['R5-SALES-AVAIL-NEGATIVE-DISALLOWED-001', true, 'APPLICABLE', 'AUTO_UNAVAILABLE', 'NEGATIVE_NOT_ALLOWED'],
    ].map(([itemCode, targetPresent, applicability, state, reason], index) => ({
      itemCode,
      catalogItemRef: `catalog-item-ref-${index + 1}`,
      targetPresent,
      expectedAvailability: {applicability, state, reason},
    })),
  };
  const reportPath = '/runtime/r5/catalog/seed-report.json';
  const parent = {managedDevRunId: 'dev-1', catalogAvailabilityReceipt: {reportPath, sha256: '0'.repeat(64), contractDigest: availabilityContractDigest(availabilityReceiptFacts(report.salesMenuAvailabilityReceipt)), itemCount: 6}};
  const accepted = validateCatalogAvailabilityReceipt({report, reportPath, receiptSha256: parent.catalogAvailabilityReceipt.sha256, parent, parentRuntimeRoot: '/runtime/r5'});
  assert.equal(accepted.rows.length, 6);
  assert.throws(
    () => validateCatalogAvailabilityReceipt({report: {...report, managedDevRunId: 'other'}, reportPath: '/runtime/r5/catalog/seed-report.json', receiptSha256: parent.catalogAvailabilityReceipt.sha256, parent, parentRuntimeRoot: '/runtime/r5'}),
    code('SALES_MENU_SEED_CATALOG_RECEIPT_INVALID'),
  );
  const wrongReason = structuredClone(report);
  wrongReason.salesMenuAvailabilityReceipt[5].expectedAvailability.reason = null;
  assert.throws(() => validateCatalogAvailabilityReceipt({report: wrongReason, reportPath, receiptSha256: parent.catalogAvailabilityReceipt.sha256, parent, parentRuntimeRoot: '/runtime/r5'}), code('SALES_MENU_SEED_CATALOG_RECEIPT_CONTRACT_INVALID'));
  assert.throws(() => validateCatalogAvailabilityReceipt({report, reportPath, receiptSha256: 'f'.repeat(64), parent, parentRuntimeRoot: '/runtime/r5'}), code('SALES_MENU_SEED_CATALOG_RECEIPT_PARENT_DIGEST_INVALID'));
});

test('sales-menu child rejects generated route, profile and cross-owner denominator drift before runtime', async () => {
  const actual = await inputs();
  assert.throws(
    () => validateRuntimeSeedStaticInputs({...actual, generalRegistry: actual.generalRegistry.filter(entry => entry.operationId !== 'publishOperationsSalesMenu')}),
    code('SALES_MENU_SEED_OPERATION_MISSING:publishOperationsSalesMenu'),
  );
  assert.throws(
    () => validateRuntimeSeedStaticInputs({...actual, profile: {...actual.profile, stageId: 'other'}}),
    code('SALES_MENU_SEED_PROFILE_INVALID'),
  );
  const withoutAvailability = structuredClone(actual);
  withoutAvailability.staticPlan.crossOwnerReadbackMatrix = {inventoryAvailability: ['NORMAL']};
  assert.throws(() => validateRuntimeSeedStaticInputs(withoutAvailability), /SALES_MENU_SEED_CROSS_OWNER_MATRIX_INVALID/);
});

test('sales-menu child accepts only one matching r5 parent context and refuses direct execution', () => {
  const parentRuntimeRoot = '/runtime/r5';
  const context = {
    schemaVersion: 1,
    kind: 'r5-complete-seed-child-context',
    profile: 'r5-full',
    stageId: 'sales-menu',
    runId: 'complete-1',
    managedDevRunId: 'dev-1',
    tokenSha256: createHash('sha256').update('parent-child-token').digest('hex'),
    catalogAvailabilityReceipt: {reportPath: '/runtime/r5/catalog/seed-report.json', sha256: '0'.repeat(64), contractDigest: '1'.repeat(64), itemCount: 6},
  };
  const parentManifest = {
    kind: 'r5-complete-seed-manifest',
    profile: 'r5-full',
    runId: 'complete-1',
    managedDevRunId: 'dev-1',
    phases: [{stage: 'sales-menu', status: 'RUNNING'}],
  };
  const contextPath = '/runtime/r5/seed/complete/complete-1/sales-menu-context.json';
  assert.deepEqual(
    validateParentSeedContext({context, parentManifest, contextPath, parentRuntimeRoot}),
    {runId: 'complete-1', managedDevRunId: 'dev-1', contextPath, catalogAvailabilityReceipt: context.catalogAvailabilityReceipt},
  );
  assert.throws(
    () => validateParentSeedContext({context: {...context, stageId: 'catalog-inventory'}, parentManifest, contextPath, parentRuntimeRoot}),
    code('SALES_MENU_SEED_PARENT_CONTEXT_INVALID'),
  );
  assert.throws(
    () => validateParentSeedContext({context, parentManifest: {...parentManifest, phases: []}, contextPath, parentRuntimeRoot}),
    code('SALES_MENU_SEED_PARENT_STAGE_NOT_RUNNING'),
  );
  assert.throws(
    () => validateParentSeedContext({context, parentManifest, contextPath: '/outside/context.json', parentRuntimeRoot}),
    code('SALES_MENU_SEED_PARENT_CONTEXT_PATH_INVALID'),
  );
  const direct = spawnSync(process.execPath, [fileURLToPath(executorUrl)], {encoding: 'utf8'});
  assert.equal(direct.status, 2);
  assert.match(direct.stderr, /RUN_FROM_R5_COMPLETE_SEED_ONLY/);
});

test('sales-menu child keeps generated multipart transport and bind grants at the actual owner boundary', async () => {
  const source = await readFile(executorUrl, 'utf8');
  assert.match(source, /resolveGeneratedOperationById\(inputs\.registry, operationId\)/);
  assert.match(source, /materializeGeneratedOperationPath\(operation, \{pathParameters, queryParameters:/);
  assert.match(source, /new FormData\(\)/);
  assert.match(source, /X-Sales-Menu-Asset-Bind-Grants/);
  assert.match(source, /expectedProblemCode: 'SALES_MENU_MANUAL_REASON_REQUIRED'/);
  assert.match(source, /orderOptionSelections/);
  assert.match(source, /targetKind: target.targetKind/);
  assert.match(source, /manualSaleTargetStatuses/);
  assert.match(source, /listOperationsCatalogOrderOptionDefinitions/);
  assert.match(source, /SALES_MENU_SEED_PUBLISHED_SKU_SUBSET_INVALID/);
  assert.match(source, /candidate\.skuRef !== catalogSku\.productSkuRef/);
  assert.doesNotMatch(source, /candidate\.productSkuRef/);
  assert.doesNotMatch(source, /\.slice\(0, 2\)/);
  assert.match(source, /secondaryReadback\.draftDirty !== false/);
  assert.match(source, /copiedReadback\.activation !== null/);
  assert.match(source, /const menuExpectedVersion = \(menu, code\) => versionOf\(menu, code\)/);
  assert.match(source, /SALES_MENU_SEED_PRIMARY_ACTIVATION_VERSION_INVALID/);
  assert.doesNotMatch(source, /activation\?\.version/);
  assert.match(source, /R5_CATALOG_AVAILABILITY_RECEIPT/);
  assert.match(source, /SALES_MENU_SEED_AVAILABILITY_PUBLISHED_FACT_INVALID/);
  assert.match(source, /SALES_MENU_SEED_AVAILABILITY_PUBLISHED_PRICE_INVALID/);
  assert.match(source, /primary-operation-records-\$\{recordsPage \+ 1\}/);
  assert.match(source, /recordsCursor \? \{cursor: recordsCursor\}/);
  assert.match(source, /SALES_MENU_SEED_OPERATION_RECORD_CURSOR_UNBOUNDED/);
  assert.match(source, /menu-list-page-1/);
  assert.match(source, /menu-list-page-2/);
  assert.match(source, /SALES_MENU_SEED_MENU_LIST_READBACK_INVALID/);
  assert.match(source, /primary-published-items-page-1/);
  assert.match(source, /primary-published-items-page-2/);
  assert.match(source, /SALES_MENU_SEED_PUBLICATION_READBACK_INVALID/);
  assert.match(source, /copy-custom-media-readback/);
  assert.match(source, /SALES_MENU_SEED_COPY_CUSTOM_MEDIA_RELATION_INVALID/);
  assert.doesNotMatch(source, /salesMenuRef: copied\.ref/);
  assert.match(source, /salesMenuRef: copiedMenu\.ref/);
  assert.doesNotMatch(source, /cloneOperationsSalesMenuAsset/);
  assert.doesNotMatch(source, /releaseOperationsSalesMenuStagedAsset/);
  assert.doesNotMatch(source, /expectedVersion: Number\((row|current|manualItem|manualRead|secondaryItem|dirty)\.version\)/);
  assert.doesNotMatch(source, /expectedVersion: Number\(\(await menuDetail\(/);
  assert.match(source, /SALES_MENU_SEED_PARENT_CATALOG_RECEIPT_INVALID/);
  assert.match(source, /SALES_MENU_SEED_CATALOG_RECEIPT_PARENT_DIGEST_INVALID/);
  assert.match(source, /RUN_FROM_R5_COMPLETE_SEED_ONLY/);
  assert.doesNotMatch(source, /INSERT\s+INTO|UPDATE\s+sales_menu\.|DELETE\s+FROM/i);
});

test('sales-menu child resolves section identity from draft readback, never command targetRef', () => {
  const rows = [
    {name: '堂食', salesSectionRef: 'section-dine-in'},
    {name: '外带', salesSectionRef: 'section-takeaway'},
  ];
  assert.equal(sectionRefFromDraftRows(rows, '堂食', 'SECTION_REF_MISSING'), 'section-dine-in');
  assert.throws(() => sectionRefFromDraftRows(rows, '不存在', 'SECTION_REF_MISSING'), code('SECTION_REF_MISSING'));
  assert.throws(() => sectionRefFromDraftRows([{name: '堂食', salesSectionRef: 'a'}, {name: '堂食', salesSectionRef: 'b'}], '堂食', 'SECTION_REF_AMBIGUOUS'), code('SECTION_REF_AMBIGUOUS'));
  assert.throws(() => sectionRefFromDraftRows([{name: '堂食', salesSectionRef: null}], '堂食', 'SECTION_REF_MISSING'), code('SECTION_REF_MISSING'));
});

test('published SKU subset mismatch exposes only safe business facts', () => {
  const code = publishedSkuSubsetMismatch({
    item: {productShape: 'SKU', saleContent: {skuPrices: [{skuCode: 'LATTE-SKU-S', listedPriceCents: 3000}]}},
    subset: {skuCodes: ['LATTE-SKU-S'], listedPriceCentsBySkuCode: {'LATTE-SKU-S': 3400}},
  });
  assert.match(code, /actualProductShape/);
  assert.match(code, /LATTE-SKU-S/);
  assert.match(code, /3000/);
  assert.match(code, /3400/);
  assert.doesNotMatch(code, /skuRef|cookie|token|password|payload/i);
});

test('published rows map by SalesItem ref when two SalesItems reuse one Catalog product', () => {
  const mapped = publishedRowsBySeedItemCode({
    primaryItems: [{code: 'R5-SALES-ITEM-15'}, {code: 'R5-SALES-ITEM-21'}],
    draftRows: [{salesItemRef: 'sales-item-15'}, {salesItemRef: 'sales-item-21'}],
    publishedRows: [
      {salesItemRef: 'sales-item-15', itemCode: 'LATTE-001'},
      {salesItemRef: 'sales-item-21', itemCode: 'LATTE-001'},
    ],
  });
  assert.equal(mapped.get('R5-SALES-ITEM-15').salesItemRef, 'sales-item-15');
  assert.equal(mapped.get('R5-SALES-ITEM-21').salesItemRef, 'sales-item-21');
  assert.throws(
    () => publishedRowsBySeedItemCode({
      primaryItems: [{code: 'R5-SALES-ITEM-15'}, {code: 'R5-SALES-ITEM-21'}],
      draftRows: [{salesItemRef: 'sales-item-15'}, {salesItemRef: 'sales-item-21'}],
      publishedRows: [{salesItemRef: 'sales-item-15', itemCode: 'LATTE-001'}],
    }),
    /SALES_MENU_SEED_PUBLISHED_ITEM_MAPPING_INVALID:R5-SALES-ITEM-21/,
  );
});

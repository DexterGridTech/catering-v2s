import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  L2_DATABASE_PATTERN,
  L2_NAMESPACE_PATTERN,
  buildIncompleteExecutionManifest,
  buildL2SelectionManifest,
  buildReadinessManifest,
  buildReadinessFailureCleanupState,
  buildFixtureVoidedSkuTransitions,
  catalogBootstrapCaseIdsForSuite,
  catalogLibraryCaseIdentityPlan,
  deriveL2CaseFailure,
  fixtureSkuFactsForItem,
  l2FixtureStageSuffix,
  loadL2ActivationCandidate,
  materializeL2TimingBudget,
  materializeReadbackFactTemplate,
  parseFocusedCaseId,
  playwrightArtifactDirectoryForRun,
  requiredCatalogItemCommandResourceRef,
  requiredCatalogItemDetailVoidAvailability,
  requireActivatedCatalogLibraryExecution,
  resolveL2TerminalResults,
  salesMenuSaleContentKind,
  sha256,
  sanitizeRuntimeState,
  selectL2FirstFailure,
  materializeFixtureVoidedSkuLifecycle,
  repositoryRelativePath,
  remoteCleanupPassed,
  writeRepositoryByteBinding,
  validateCatalogLibraryCaseIdentityPlans,
  validateCatalogLibraryReadbackFactBindings,
  validateFixtureVoidedSkuTransitionReadback,
  validateFixtureSkuOwnership,
  validateFixtureVisibleSkuReadback,
  validateL2CaseProgress,
  validateL2ContractDenominators,
  validateL2ObservedNetwork,
  validateNamespaceBinding,
  validateRepositoryByteBinding,
} from './browser-l2-runtime.mjs';
import {validateBlueprint as validateSalesMenuBlueprint} from '../generate/sales-menu-p1.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const readJson = relative => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const runtimeSource = readFileSync(path.join(root, 'scripts/test/browser-l2-runtime.mjs'), 'utf8');
const catalogL2Source = readFileSync(
  path.join(root, 'apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts'),
  'utf8',
);
const salesMenuL2Source = readFileSync(
  path.join(root, 'apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts'),
  'utf8',
);
const salesMenuPageSource = readFileSync(
  path.join(root, 'apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx'),
  'utf8',
);
const salesMenuUiSharedSource = readFileSync(
  path.join(root, 'apps/frontend/operations-admin/src/features/sales-menu/ui/salesMenuUiShared.ts'),
  'utf8',
);
const operationsL2Source = readFileSync(
  path.join(root, 'apps/frontend/operations-admin/src/tests/l2/operationsL2.ts'),
  'utf8',
);
const cursorPaginationSource = readFileSync(
  path.join(root, 'libraries/frontend/admin-ui-foundation/src/list/cursorPagination.tsx'),
  'utf8',
);
const fixtureSource = readFileSync(path.join(root, 'scripts/test/catalog-inventory-l2-fixture.mjs'), 'utf8');
const p1Source = readFileSync(path.join(root, 'scripts/generate/catalog-inventory-p1.mjs'), 'utf8');
const salesMenuFixture = readJson('contracts/policy/sales-menu-l2-fixture.json');
const salesMenuBlueprint = readJson('contracts/policy/sales-menu-l2-case-blueprint.json');
const salesMenuGeneratedScenarios = readJson('contracts/policy/sales-menu-l2-scenarios.json');

test('browser L2 digest preserves uploaded asset bytes', () => {
  const bytes = Buffer.from([0, 255, 16, 128, 65]);
  const expected = createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256(bytes), expected);
  assert.equal(sha256('catalog-image'), createHash('sha256').update('catalog-image').digest('hex'));
});

test('sales-menu fixture shapes use the owner-aligned sale-content kind mapping', () => {
  assert.equal(salesMenuSaleContentKind('ORDINARY'), 'DIRECT');
  assert.equal(salesMenuSaleContentKind('SERVICE'), 'DIRECT');
  assert.equal(salesMenuSaleContentKind('SKU'), 'SKU_SELECTION');
  assert.equal(salesMenuSaleContentKind('WEIGHTED'), 'WEIGHTED');
  assert.equal(salesMenuSaleContentKind('COMPOSITE'), 'COMPOSITE');
  assert.match(runtimeSource, /const saleContentKind = salesMenuSaleContentKind\(candidate\.shape\)/);
});

test('sales-menu L2 channel templates carry the owner-required visibility wire shape', () => {
  const createTemplateSource = runtimeSource.slice(
    runtimeSource.indexOf('const createTemplate = async'),
    runtimeSource.indexOf('const takeawayTemplateRef = await createTemplate'),
  );
  assert.match(createTemplateSource, /storeVisibilityScope: operatorKind === 'STORE' \? 'ALL_PROJECT_STORES' : null/);
  assert.match(createTemplateSource, /visibleStoreRefs: \[\]/);
});

test('sales-menu L2 SKU bootstrap materializes distinct Catalog variant values', () => {
  const salesMenuBootstrapSource = runtimeSource.slice(runtimeSource.indexOf('async function bootstrapSalesMenuFacts'));
  assert.match(salesMenuBootstrapSource, /const catalogSkuVariantsByFixtureId = new Map\(\)/);
  assert.match(salesMenuBootstrapSource, /createOperationsCatalogDictionaryEntry/);
  assert.match(salesMenuBootstrapSource, /attributeValueRef: skuVariant\.values\[index\]\.valueRef/);
  assert.match(salesMenuBootstrapSource, /skuVariantDimensions: skuVariant/);
  assert.match(salesMenuBootstrapSource, /values: skuVariant\.values/);
});

test('sales-menu SKU price journey budgets every independent SalesItem detail readback', () => {
  const skuCase = salesMenuBlueprint.scenarios
    .flatMap(scenario => scenario.cases ?? [])
    .find(row => row.caseId === 'sales-menu-edit-sku-prices');
  assert.ok(skuCase);
  assert.equal(
    skuCase.parameter.network.requests.find(row => row.operationId === 'getOperationsSalesMenuDraftItem')
      ?.maxRequestCount,
    5,
  );
  assert.equal(
    skuCase.parameter.network.requests.find(row => row.operationId === 'getOperationsSalesMenu')?.maxRequestCount,
    5,
  );
  assert.equal(
    skuCase.parameter.network.requests.find(row => row.operationId === 'getOperationsSalesMenuDraftItems')
      ?.maxRequestCount,
    4,
  );
  assert.equal(
    skuCase.parameter.network.requests.find(row => row.operationId === 'getOperationsSalesMenuPublicationPreview')
      ?.maxRequestCount,
    5,
  );
  const skuJourneySource = salesMenuL2Source.slice(
    salesMenuL2Source.indexOf("case 'sales-menu-edit-sku-prices':"),
    salesMenuL2Source.indexOf("case 'sales-menu-edit-weighted-item':"),
  );
  assert.equal((skuJourneySource.match(/openDraftEditor\(page, facts, runtime\)/g) ?? []).length, 2);
  assert.match(skuJourneySource, /openDraftEditor\(page, secondFacts, runtime\)/);
  assert.match(
    skuJourneySource,
    /const firstSavedRow = page\s+\.getByRole\('row'\)\s+\.filter\(\{has: visibleTestId\(page, salesMenuTestIds\.item\(salesItemRefs\[0\]\)\)\}\)/,
  );
  assert.match(
    skuJourneySource,
    /const secondSavedRow = page\s+\.getByRole\('row'\)\s+\.filter\(\{has: visibleTestId\(page, salesMenuTestIds\.item\(salesItemRefs\[1\]\)\)\}\)/,
  );
  assert.match(skuJourneySource, /await expect\(firstSavedRow\)\.toContainText\('\¥17\.77'\)/);
  assert.match(skuJourneySource, /await expect\(secondSavedRow\)\.toContainText\('\¥18\.88'\)/);
  assert.match(skuJourneySource, /toHaveValue\('17\.77'\)/);
});

test('sales-menu manual status journey budgets every read-model refresh', () => {
  const manualStatusCase = salesMenuBlueprint.scenarios
    .flatMap(scenario => scenario.cases ?? [])
    .find(row => row.caseId === 'sales-menu-manual-sold-out-and-restore');
  assert.ok(manualStatusCase);
  assert.equal(
    manualStatusCase.parameter.network.requests.find(row => row.operationId === 'getOperationsStoreBusinessChannels')
      ?.maxRequestCount,
    6,
  );
  assert.equal(
    manualStatusCase.parameter.network.requests.find(row => row.operationId === 'getOperationsBusinessChannelTemplates')
      ?.maxRequestCount,
    5,
  );
});

test('sales-menu fixture activation identities cannot overlap its disabled-channel blocker', () => {
  const primaryMenu = salesMenuFixture.menuFixtures.find(menu => menu.fixtureId === 'MENU-01');
  const blockerChannelFixtureId = salesMenuFixture.caseFixtures['FIXTURE-SALES-MENU-BLOCKERS'].blockerChannelFixtureId;
  const fixtureChannelIds = new Set(salesMenuFixture.channelFixtures.map(channel => channel.fixtureId));
  assert.equal(primaryMenu?.channelFixtureId, 'CHANNEL-01');
  assert.equal(primaryMenu?.secondaryActiveChannelFixtureId, 'CHANNEL-02');
  assert.notEqual(primaryMenu?.channelFixtureId, blockerChannelFixtureId);
  assert.notEqual(primaryMenu?.secondaryActiveChannelFixtureId, blockerChannelFixtureId);
  assert.ok(fixtureChannelIds.has(primaryMenu?.secondaryActiveChannelFixtureId));
  for (const menu of salesMenuFixture.menuFixtures) assert.ok(fixtureChannelIds.has(menu.channelFixtureId));
});

test('sales-menu readiness keeps Catalog library fixtures out of its exact candidate denominator', () => {
  const catalogCaseIds = ['catalog-find-success', 'catalog-find-failure'];
  assert.deepEqual(catalogBootstrapCaseIdsForSuite('sales-menu', catalogCaseIds), []);
  assert.deepEqual(catalogBootstrapCaseIdsForSuite('catalog-inventory', catalogCaseIds), catalogCaseIds);
  assert.match(runtimeSource, /activeRows\.length === 0 \? \[\] : validateCatalogLibraryCaseIdentityPlans/);
  assert.match(runtimeSource, /catalogBootstrapCaseIdsForSuite\(suite, activeExecutionCaseIds\)/);
});

test('sales-menu L2 consumes the managed timing report field contract', () => {
  assert.match(salesMenuL2Source, /cases: Array<\{caseId: string; timeoutMs: number\}>/);
  assert.match(salesMenuL2Source, /Number\.isFinite\(budget\.timeoutMs\)/);
  assert.match(salesMenuL2Source, /testInfo\.setTimeout\(budget\.timeoutMs\)/);
  assert.doesNotMatch(salesMenuL2Source, /budget\.caseTimeoutMs/);
});

test('sales-menu L2 never treats an observed HTTP failure as a completed operation', () => {
  assert.match(salesMenuL2Source, /completion\.status < 200 \|\| completion\.status >= 300/);
  assert.match(salesMenuL2Source, /SALES_MENU_L2_OPERATION_HTTP_FAILED/);
});

test('sales-menu L2 action helpers wait for the uniquely bound current-DOM control', () => {
  assert.match(
    salesMenuL2Source,
    /async function clickBoundControl\([\s\S]*?const resolved = await waitForBoundControl\(page, key, facts\);[\s\S]*?await expect\(button\)\.toBeVisible\(\);[\s\S]*?await expect\(button\)\.toBeEnabled\(\);[\s\S]*?if \(label\) await expect\(button\)\.toContainText\(uiLabelPattern\(label\)\);[\s\S]*?recordControlTouch\(key, resolved\.testId\);/,
  );
  assert.doesNotMatch(
    salesMenuL2Source,
    /async function clickBoundControl\([\s\S]*?const button = await requireControl\(page, key, facts\);/,
  );
});

test('sales-menu role-locked store scope records only its actual trigger touch', () => {
  const scopeOptionSource = operationsL2Source.slice(
    operationsL2Source.indexOf('async function selectOrAssertOperationsScopeOption'),
    operationsL2Source.indexOf('/** Select an owner-returned option through a ProTable form field'),
  );
  assert.match(
    scopeOptionSource,
    /if \(await input\.isDisabled\(\)\) \{\s+if \(label\) await expect\(control\)\.toContainText\(label\);\s+return false;\s+\}[\s\S]*?onControlTouch\?\.\(\{testId, phase: 'SELECTOR', type}\);/,
  );
  const salesMenuScopeSource = salesMenuL2Source.slice(
    salesMenuL2Source.indexOf('async function selectStoreScope'),
    salesMenuL2Source.indexOf('async function openSalesMenu'),
  );
  assert.match(salesMenuScopeSource, /touch => recordControlTouch\(storeScopeControlKey\(touch\), touch\.testId\)/);
  const scopeControlKeys = new Set(
    salesMenuBlueprint.scenarios
      .flatMap(scenario => scenario.cases ?? [])
      .filter(
        row =>
          row.caseId !== 'business-channel-external-dine-in-template' &&
          row.caseId !== 'business-channel-store-all-and-sales-menu-exclusion',
      )
      .flatMap(row => row.controlKeys.filter(key => key.startsWith('STORE_SCOPE_'))),
  );
  assert.deepEqual([...scopeControlKeys], ['STORE_SCOPE_TRIGGER']);
  const storeScopeControlKeys = new Set(
    salesMenuBlueprint.scenarios
      .flatMap(scenario => scenario.cases ?? [])
      .filter(row => row.caseId === 'business-channel-store-all-and-sales-menu-exclusion')
      .flatMap(row => row.controlKeys.filter(key => key.startsWith('STORE_SCOPE_'))),
  );
  assert.deepEqual([...storeScopeControlKeys], ['STORE_SCOPE_TRIGGER']);
  const projectScopeControlKeys = new Set(
    salesMenuBlueprint.scenarios
      .flatMap(scenario => scenario.cases ?? [])
      .filter(row => row.caseId === 'business-channel-external-dine-in-template')
      .flatMap(row => row.controlKeys.filter(key => key.startsWith('STORE_SCOPE_'))),
  );
  assert.deepEqual([...projectScopeControlKeys], ['STORE_SCOPE_TRIGGER']);
});

test('sales-menu declares one channel selector and popup accumulation for every case', () => {
  const selectorCases = salesMenuBlueprint.scenarios
    .flatMap(scenario => scenario.cases ?? [])
    .filter(row => row.controlKeys.includes('SALES_MENU_CHANNEL_SELECTOR'))
    .map(row => row.caseId);
  const runtimeSelectorCases = salesMenuGeneratedScenarios.scenarios
    .flatMap(scenario => scenario.cases ?? [])
    .filter(row => row.parameter.controlKeys.includes('SALES_MENU_CHANNEL_SELECTOR'))
    .map(row => row.caseId);
  const channelSelectorSource = salesMenuL2Source.slice(
    salesMenuL2Source.indexOf('async function loadChannelOption'),
    salesMenuL2Source.indexOf('async function chooseChannel'),
  );
  assert.equal(selectorCases.length, 19);
  assert.deepEqual(runtimeSelectorCases, selectorCases);
  assert.match(channelSelectorSource, /salesMenuTestIds\.channelOption\(channelRef\)/);
  assert.match(channelSelectorSource, /scrollTop = element\.scrollHeight/);
  assert.match(channelSelectorSource, /SALES_MENU_CHANNEL_SELECTOR_OPTIONS_READY/);
  assert.doesNotMatch(salesMenuL2Source, /SALES_MENU_CHANNEL_PAGINATION|findChannelCard|channelCard/);
});

test('sales-menu blueprint records selector access instead of retired entry pagination', () => {
  const entryCase = salesMenuBlueprint.scenarios
    .flatMap(scenario => scenario.cases ?? [])
    .find(row => row.caseId === 'sales-menu-entry-and-channels');
  assert.ok(entryCase);
  const steps = entryCase.steps.join(' ');
  const oracles = entryCase.businessOracle.join(' ');
  assert.match(steps, /经营入口下拉/);
  assert.match(steps, /弹层滚动/);
  assert.match(oracles, /rich Select/);
  assert.match(oracles, /弹层滚动/);
  assert.doesNotMatch(`${steps} ${oracles}`, /逐页|显式分页/);
  assert.equal(salesMenuFixture.ownerFacts?.channelCandidatePageSize, 20);
  assert.equal(salesMenuFixture.ownerFacts?.channelPageSize, undefined);
});

test('sales-menu entry and menu controls share one section and one-line rows', () => {
  const entrySectionSource = salesMenuPageSource.slice(
    salesMenuPageSource.indexOf('<Card title="经营入口"'),
    salesMenuPageSource.indexOf('{!selectedMenu ?'),
  );
  assert.notEqual(entrySectionSource, '');
  assert.doesNotMatch(entrySectionSource, /title="菜单工作区"/);

  const channelOptionsSource = entrySectionSource.slice(
    entrySectionSource.indexOf('options={channelItems.map'),
    entrySectionSource.indexOf('onPopupScroll={event =>'),
  );
  assert.doesNotMatch(channelOptionsSource, /direction="vertical"/);
  assert.match(channelOptionsSource, /wrap=\{false\}/);
  assert.match(channelOptionsSource, /whiteSpace: 'nowrap'/);

  const menuSelectorOffset = entrySectionSource.indexOf('value={selectedMenuRef}');
  assert.notEqual(menuSelectorOffset, -1);
  const menuRowSource = entrySectionSource.slice(entrySectionSource.lastIndexOf('<Row', menuSelectorOffset));
  assert.match(menuRowSource, /<Segmented<SalesMenuMode>/);
  assert.match(menuRowSource, /wrap=\{false\}/);
  assert.match(menuRowSource, /testId\(salesMenuTestIds\.menuRefresh\)/);
  assert.deepEqual(salesMenuBlueprint.bindings.controls.SALES_MENU_MENU_REFRESH, {
    testId: 'sales-menu-menu-refresh',
    sourceFiles: [
      'apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts',
      'apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx',
    ],
  });
  assert.deepEqual(salesMenuBlueprint.bindings.controls.SALES_MENU_MANAGER_ACTION.sourceFiles, [
    'apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts',
    'apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuManagerDrawer.tsx',
  ]);
});

test('sales-menu case control denominators follow each case action trace', () => {
  const cases = new Map(
    salesMenuBlueprint.scenarios.flatMap(scenario => (scenario.cases ?? []).map(row => [row.caseId, row.controlKeys])),
  );
  assert.equal(cases.get('sales-menu-section-actions')?.includes('SALES_MENU_CONFIRMATION_SUBMIT'), false);
  assert.equal(cases.get('sales-menu-manual-sold-out-and-restore')?.includes('SALES_MENU_ITEM'), false);
  assert.equal(cases.get('sales-menu-publish-blockers')?.includes('SALES_MENU_MANAGER_PAGINATION'), false);
  assert.equal(cases.get('sales-menu-auth-and-scope-isolation')?.includes('SALES_MENU_MANAGER_PAGINATION'), false);
  assert.equal(cases.get('sales-menu-operation-records')?.includes('SALES_MENU_LOG_PAGINATION'), true);
  const caseRows = salesMenuBlueprint.scenarios.flatMap(scenario => scenario.cases ?? []);
  const baselineItemCaseRows = caseRows.filter(row => {
    const caseFixture = salesMenuFixture.caseFixtures[row.fixtureRef];
    return (
      Array.isArray(caseFixture?.baselineCandidateFixtureIds) && caseFixture.baselineCandidateFixtureIds.length > 0
    );
  });
  assert.ok(baselineItemCaseRows.length > 0);
  for (const row of baselineItemCaseRows) assert.equal(row.controlKeys.includes('SALES_MENU_ITEM_TABLE'), true);
  const missingTableMutation = structuredClone(salesMenuBlueprint);
  const mutatedCase = missingTableMutation.scenarios
    .flatMap(scenario => scenario.cases ?? [])
    .find(row => baselineItemCaseRows.some(baselineRow => baselineRow.caseId === row.caseId));
  assert.ok(mutatedCase);
  mutatedCase.controlKeys = mutatedCase.controlKeys.filter(key => key !== 'SALES_MENU_ITEM_TABLE');
  assert.throws(
    () => validateSalesMenuBlueprint(missingTableMutation, salesMenuFixture),
    error => error instanceof Error && error.message.startsWith('SALES_MENU_P1_BASELINE_ITEM_TABLE_CONTROL_MISSING:'),
  );
  const operationRecordsSource = salesMenuL2Source.slice(
    salesMenuL2Source.indexOf("case 'sales-menu-operation-records':"),
    salesMenuL2Source.indexOf("case 'sales-menu-failure-recovery-and-focus':"),
  );
  assert.match(
    operationRecordsSource,
    /await requireControl\(page, 'SALES_MENU_OPERATION_LOG', facts\);\s+await expect\(visibleTestId\(page, salesMenuTestIds\.operationLog\)\)\.toContainText\('操作人'\);\s+await clickCursorNext\(page, salesMenuTestIds\.logCursor, 'SALES_MENU_LOG_PAGINATION'\);/,
  );
  assert.doesNotMatch(operationRecordsSource, /waitForOperation\(runtime, 'getOperationsSalesMenuOperationRecords'/);
  const clickCursorNextSource = salesMenuL2Source.slice(
    salesMenuL2Source.indexOf('async function clickCursorNext'),
    salesMenuL2Source.indexOf('async function clickCursorPrevious'),
  );
  assert.match(cursorPaginationSource, /disabled=\{!nextCursor\}/);
  assert.match(clickCursorNextSource, /await expect\(next\)\.toBeEnabled\(\);\s+recordControlTouch/);
  assert.doesNotMatch(
    operationRecordsSource,
    /if \(await page\.getByTestId\(`\$\{salesMenuTestIds\.logCursor\}-next`\)\.isEnabled\(\)\)/,
  );
});

test('sales-menu L2 resource-sensitive readbacks select the target menu before using payloads', () => {
  assert.match(
    salesMenuL2Source,
    /function selectedMenuOperationObservations\([\s\S]*?entry\.pathname\.includes\(`\/sales-menus\/\$\{menuRef\}`\)/,
  );
  assert.match(
    salesMenuL2Source,
    /function latestSelectedMenuItems\([\s\S]*?latestSelectedMenuOperation\(runtime, facts, operationId\)/,
  );
  assert.doesNotMatch(salesMenuL2Source, /function latestItems\(/);
  assert.equal(
    (salesMenuL2Source.match(/latestSelectedMenuItems\(runtime, facts, 'getOperationsSalesMenuDraftSections'\)/g) ?? [])
      .length,
    8,
  );
  assert.equal(
    (salesMenuL2Source.match(/latestSelectedMenuItems\(runtime, facts, 'getOperationsSalesMenuDraftItems'\)/g) ?? [])
      .length,
    2,
  );
  assert.match(
    salesMenuL2Source,
    /waitForLatestItemRef\([\s\S]*?runtime,\s*facts,\s*'getOperationsSalesMenuDraftSections'/,
  );
  assert.match(
    salesMenuL2Source,
    /latestSelectedMenuOperation\(runtime, facts, 'getOperationsSalesMenuPublicationPreview'\)/,
  );
  assert.doesNotMatch(
    salesMenuL2Source,
    /\.find\(entry => entry\.operationId === 'getOperationsSalesMenuPublicationPreview'\)/,
  );
});

test('sales-menu media deletion closes after its command joins and editor DOM closure', () => {
  const mediaDeletionSource = salesMenuL2Source.slice(
    salesMenuL2Source.indexOf("case 'sales-menu-edit-direct-item-and-media':"),
    salesMenuL2Source.indexOf("case 'sales-menu-edit-sku-prices':"),
  );
  assert.match(
    mediaDeletionSource,
    /await waitForOperation\(runtime, 'releaseOperationsSalesMenuStagedAsset'\);\s+await waitForOperation\(runtime, 'deleteOperationsSalesMenuItem'\);\s+await expect\(visibleTestId\(page, salesMenuTestIds\.itemEditor\)\)\.toBeHidden\(\);/,
  );
  assert.doesNotMatch(mediaDeletionSource, /targetMenuReadCountBeforeDelete/);
  assert.doesNotMatch(mediaDeletionSource, /waitForSelectedMenuOperation\(runtime, facts, 'getOperationsSalesMenu'/);
});

test('sales-menu shared selection chain uses DOM read models rather than query completion counts', () => {
  const sharedSelectionSource = salesMenuL2Source.slice(
    salesMenuL2Source.indexOf('async function chooseChannel'),
    salesMenuL2Source.indexOf('async function clickCursorNext'),
  );
  assert.match(
    sharedSelectionSource,
    /await expect\(selector\)\.toBeEnabled\(\);[\s\S]*?const channelOption = await loadChannelOption\(page, channelRef\);[\s\S]*?await expect\(menuSelector\.locator\)\.toBeEnabled\(\);/,
  );
  assert.match(
    sharedSelectionSource,
    /const menuOption = visibleTestId\(page, menuOptionTestId\);\s+await expect\(menuOption\)\.toHaveCount\(1\);\s+await expect\(menuOption\)\.toHaveAttribute\('role', 'option'\);[\s\S]*?await expect\(page\.getByTestId\(salesMenuTestIds\.menuSelector\)\)\.toContainText\(facts\.menuName\);/,
  );
  assert.match(
    sharedSelectionSource,
    /await expect\(section\.locator\)\.toHaveAttribute\('aria-current', 'true'\);[\s\S]*?assertCurrentSalesItemPageReadModel/,
  );
  assert.doesNotMatch(sharedSelectionSource, /runtime\.observations\.filter/);
  assert.doesNotMatch(sharedSelectionSource, /waitForOperation\(/);
  assert.doesNotMatch(sharedSelectionSource, /waitForSelectedMenuOperation\(/);
  assert.doesNotMatch(sharedSelectionSource, /waitForSelectedSectionItemsOperation\(/);
});

test('sales-menu manager pagination uses current DOM state without HTTP-count diagnostics', () => {
  const managerPaginationSource = salesMenuL2Source.slice(
    salesMenuL2Source.indexOf('async function waitForManagerPageReadModel'),
    salesMenuL2Source.indexOf('async function clickManagerMenuAction'),
  );
  assert.match(
    managerPaginationSource,
    /if \(\(await candidate\.count\(\)\) === 1\) return 'TARGET_VISIBLE';[\s\S]*?return \(await next\.isEnabled\(\)\) \? 'CURRENT_PAGE_WITH_NEXT' : false;/,
  );
  assert.match(managerPaginationSource, /readModelSourceBasis: 'CURRENT_DOM_READ_MODEL'/);
  assert.doesNotMatch(managerPaginationSource, /runtime\.observations\.filter/);
  assert.doesNotMatch(managerPaginationSource, /waitForOperation\(/);
});

test('sales-menu table presentation keeps the approved columns and density rules', () => {
  const draftStart = salesMenuPageSource.indexOf('function DraftSalesItemTable');
  const publishedStart = salesMenuPageSource.indexOf('function PublishedSalesItemTable');
  const operationStart = salesMenuPageSource.indexOf('function SalesMenuOperationTable');
  const draftSource = salesMenuPageSource.slice(draftStart, publishedStart);
  const publishedSource = salesMenuPageSource.slice(publishedStart, operationStart);
  for (const [tableSource, columns] of [
    [draftSource, ['菜单商品', '挂牌价', '销售规格', '销售约束']],
    [publishedSource, ['菜单商品', '挂牌价', '销售规格', '库存状态', '销售状态']],
  ]) {
    let previous = -1;
    for (const title of columns) {
      const position = tableSource.indexOf(`title: '${title}'`);
      assert.ok(position > previous, `column ${title} is out of order`);
      previous = position;
    }
  }
  assert.match(draftSource, /itemMediaLabel\(row\)/);
  assert.match(draftSource, /\{row\.displayName\}[\s\S]*?\{row\.itemCode\}/);
  assert.match(draftSource, /salesMenuProductShapeLabel\(row\.productShape\)/);
  assert.match(publishedSource, /salesMenuPublishedPriceLabel\(row\)/);
  assert.match(publishedSource, /salesMenuSpecificationLabel\(row\)/);
  assert.match(publishedSource, /salesMenuProductShapeLabel\(row\.productShape\)/);
  assert.match(salesMenuUiSharedSource, /listedPriceCents === defaultPriceCents/);
  assert.match(salesMenuUiSharedSource, /salesMenuStackedLines\(/);
  assert.match(salesMenuUiSharedSource, /salesMenuPublishedPriceLabel/);
  assert.doesNotMatch(salesMenuUiSharedSource, /\.join\('；'\)|\.join\('、'\)/);
  assert.match(salesMenuPageSource, /<Col xs=\{24\} lg=\{5\} style=\{\{minWidth: 0\}\}>/);
  assert.match(salesMenuPageSource, /<Col xs=\{24\} lg=\{19\} style=\{\{minWidth: 0\}\}>/);
});

test('shared option selection waits on the native input before opening an owner-backed portal', () => {
  assert.match(
    operationsL2Source,
    /const input = control\.locator\('input'\);\s+await expect\(input\)\.toBeVisible\(\);[\s\S]*?await expect\(input\)\.toBeEnabled\(\);\s+await control\.click\(\)/,
  );
  assert.doesNotMatch(
    operationsL2Source,
    /await expect\(control\)\.toBeEnabled\(\);\s+await control\.click\(\);\s+const input = control\.locator\('input'\)/,
  );
});

test('browser L2 contract denominators and the target exact set are explicit', () => {
  const current = validateL2ContractDenominators();
  assert.deepEqual(
    {
      scenarios: current.scenarios,
      policyCases: current.policyCases,
      testDatasets: current.testDatasets,
      newTestDatasets: current.newTestDatasets,
    },
    {scenarios: 26, policyCases: 65, testDatasets: 47, newTestDatasets: 8},
  );
  const candidate = loadL2ActivationCandidate();
  const activeIds = candidate.approvedCaseIds;
  const execution = readJson('contracts/policy/catalog-inventory-l2-execution.json');
  const activatedProfile = {
    ...execution,
    mode: 'INCREMENTAL',
    enabledCaseIds: [...activeIds],
    activationCandidate: {
      path: 'contracts/policy/catalog-inventory-l2-activation-candidate.json',
      digest: candidate.candidateDigest,
    },
    readiness: {
      runBinding: {
        runId: 'test',
        namespace: 'v2s_l2_test',
        database: 'catering_v2s_l2_test',
        assetPrefix: 's3://test/l2/test/',
      },
    },
  };
  const activated = validateL2ContractDenominators({execution: activatedProfile});
  assert.equal(activated.activeCases, activeIds.length);
  assert.deepEqual(activated.activeCaseIds, activeIds);
  assert.deepEqual(requireActivatedCatalogLibraryExecution(activatedProfile, candidate), activeIds);
  assert.throws(
    () => requireActivatedCatalogLibraryExecution({mode: 'FRAMEWORK_ONLY', enabledCaseIds: []}, candidate),
    error => error.code === 'L2_EXECUTION_FRAMEWORK_ONLY',
  );
  assert.throws(
    () =>
      requireActivatedCatalogLibraryExecution({...activatedProfile, enabledCaseIds: activeIds.slice(0, -1)}, candidate),
    error => error.code === 'L2_EXECUTION_CANDIDATE_CASE_SET_MISMATCH',
  );
  assert.throws(
    () => requireActivatedCatalogLibraryExecution(undefined),
    error => error.code === 'L2_EXECUTION_PROFILE_MISSING',
  );
});

test('browser L2 fixture validation consumes the generated candidate fixture set instead of a parallel handwritten list', () => {
  assert.match(fixtureSource, /const catalogLibraryFixtureIds = activationCandidate\.fixtureRefs/);
  assert.match(fixtureSource, /L2_CATALOG_LIBRARY_FIXTURE_CANDIDATE_SET_INVALID/);
  assert.doesNotMatch(fixtureSource, /'FIXTURE-CATALOG-LIBRARY-FIND'/);
});

test('browser L2 timeout budget is materialized from the declared tunnel baseline', () => {
  const activeIds = loadL2ActivationCandidate().approvedCaseIds;
  const report = materializeL2TimingBudget(activeIds);
  assert.equal(report.activeCaseCount, activeIds.length);
  assert.equal(report.databaseOperationMillisBaseline, 42.7);
  assert.ok(report.fullRunTimeoutMs > 0);
  assert.ok(report.expectTimeoutMs >= 5_000);
  assert.equal(
    report.expectTimeoutMs,
    Math.max(5_000, Math.ceil(Math.max(...report.cases.map(row => row.databaseBudgetMs)) / 2)),
  );
  assert.ok(report.cases.every(row => row.timeoutMs > 0 && row.databaseBudgetMs >= 0));
});

test('managed browser L2 focused diagnostics select one generated case without changing the active candidate set', () => {
  const activeCaseIds = ['case-a', 'case-b'];
  assert.equal(parseFocusedCaseId(['run', '--case', 'case-b'], activeCaseIds), 'case-b');
  assert.equal(parseFocusedCaseId(['run', '--case=case-a'], activeCaseIds), 'case-a');
  assert.equal(parseFocusedCaseId(['run'], activeCaseIds), null);
  assert.throws(
    () => parseFocusedCaseId(['run', '--case', 'case-c'], activeCaseIds),
    error => error.code === 'L2_FOCUSED_CASE_NOT_ACTIVE',
  );
  assert.throws(
    () => parseFocusedCaseId(['run', '--case', 'case-a', '--case', 'case-b'], activeCaseIds),
    error => error.code === 'L2_FOCUSED_CASE_ARGUMENT_DUPLICATE',
  );
  assert.match(runtimeSource, /executionMode: focusedDiagnostic \? 'FOCUSED_DIAGNOSTIC' : 'FULL'/);
  assert.match(runtimeSource, /business = focusedDiagnostic \? 'NOT_RUN'/);
});

test('browser L2 case identities distinguish fixture primaries from successful and deliberate duplicate creates', () => {
  const allPlans = validateCatalogLibraryCaseIdentityPlans(loadL2ActivationCandidate().approvedCaseIds);
  assert.equal(allPlans.length, 24);
  assert.equal(new Set(allPlans.map(plan => plan.fixtureItemCode)).size, allPlans.length);
  assert.equal(new Set(allPlans.map(plan => plan.createSuccessCode)).size, allPlans.length);
  const plans = validateCatalogLibraryCaseIdentityPlans([
    'catalog-create-success',
    'catalog-create-failure',
    'catalog-create-recovery',
  ]);
  const success = catalogLibraryCaseIdentityPlan('catalog-create-success');
  assert.equal(success.fixtureItemCode, success.createFailureCode);
  assert.notEqual(success.fixtureItemCode, success.createSuccessCode);
  assert.equal(new Set(plans.map(plan => plan.fixtureItemCode)).size, plans.length);
  assert.throws(
    () => validateCatalogLibraryCaseIdentityPlans(['catalog-create-success', 'catalog-create-success']),
    error => error.code === 'L2_OWNER_FIXTURE_CASE_IDENTITY_DUPLICATE',
  );
  assert.match(runtimeSource, /L2_OWNER_FIXTURE_CASE_IDENTITY_COLLISION/);
  assert.match(runtimeSource, /fixtureItemCode: `L2-FIXTURE-\$\{suffix\}`/);
  assert.match(runtimeSource, /createSuccessCode: `L2-CREATE-\$\{suffix\}`/);
  assert.match(runtimeSource, /const itemCode = identityPlan\.fixtureItemCode/);
  assert.match(runtimeSource, /createCode: identityPlan\.createSuccessCode/);
  assert.match(runtimeSource, /failureCode: identityPlan\.createFailureCode/);
});

test('browser L2 keeps strict case identities separate from fixture request-stage identities', () => {
  assert.equal(l2FixtureStageSuffix('FIXTURE-CATALOG-LIBRARY-FIND'), 'FIXTURE-CATALOG-LIBRARY-FIND');
  assert.equal(l2FixtureStageSuffix('catalog-find-success/L2-ITEM'), 'CATALOG-FIND-SUCCESS-L2-ITEM');
  assert.throws(
    () => l2FixtureStageSuffix(''),
    error => error.code === 'L2_OWNER_FIXTURE_STAGE_IDENTITY_INVALID',
  );
  assert.throws(
    () => catalogLibraryCaseIdentityPlan('FIXTURE-CATALOG-LIBRARY-FIND'),
    error => error.code === 'L2_OWNER_FIXTURE_CASE_IDENTITY_INVALID',
  );
  assert.match(runtimeSource, /const shortCaseSuffix = l2FixtureStageSuffix/);
});

test('browser L2 Playwright artifacts are run-scoped evidence and cannot fall back into frontend test-results', () => {
  const runDirectory = path.join(root, '.runtime/browser-l2/l2-static-artifact-binding');
  assert.equal(playwrightArtifactDirectoryForRun(runDirectory), path.join(runDirectory, 'playwright-artifacts'));
  assert.throws(
    () => playwrightArtifactDirectoryForRun(path.join(root, 'apps/frontend/operations-admin/test-results')),
    error => error.code === 'L2_PLAYWRIGHT_ARTIFACT_RUN_BINDING_INVALID',
  );
  assert.match(runtimeSource, /R5_L2_PLAYWRIGHT_OUTPUT_DIR: playwrightArtifactDirectoryForRun\(state\.runDirectory\)/);
  assert.match(runtimeSource, /L2_PLAYWRIGHT_ARTIFACT_STATE_MISMATCH/);
  assert.match(runtimeSource, /retainedEvidence:\s*\{\s*playwrightArtifactDirectory/);
  const configSource = readFileSync(path.join(root, 'apps/frontend/operations-admin/playwright.config.ts'), 'utf8');
  assert.match(configSource, /R5_L2_PLAYWRIGHT_OUTPUT_DIR_REQUIRED/);
  assert.match(configSource, /outputDir,/);
  assert.doesNotMatch(configSource, /outputDir:\s*['"]test-results/);
});

test('browser L2 observed traffic is checked against the P1-generated bounded request envelope', () => {
  const network = {
    required: ['getOperationsCatalogItem'],
    backgroundAllowed: [],
    requests: [
      {operationId: 'getOperationsCatalogItem', maxRequestCount: 2},
      {operationId: 'listOperationsCatalogUnits', maxRequestCount: 1},
    ],
  };
  assert.deepEqual(
    validateL2ObservedNetwork({
      caseId: 'catalog-edit-success',
      network,
      observedOperationCounts: {getOperationsCatalogItem: 2, listOperationsCatalogUnits: 1},
    }),
    {caseId: 'catalog-edit-success', declaredOperationCount: 2, observedOperationCount: 2},
  );
  assert.throws(
    () =>
      validateL2ObservedNetwork({
        caseId: 'catalog-edit-success',
        network: {
          ...network,
          requests: network.requests.filter(row => row.operationId !== 'listOperationsCatalogUnits'),
        },
        observedOperationCounts: {getOperationsCatalogItem: 1, listOperationsCatalogUnits: 1},
      }),
    error => error.code === 'L2_NETWORK_OPERATION_UNDECLARED',
  );
  assert.throws(
    () =>
      validateL2ObservedNetwork({
        caseId: 'catalog-edit-success',
        network,
        observedOperationCounts: {getOperationsCatalogItem: 3},
      }),
    error => error.code === 'L2_NETWORK_REQUEST_COUNT_EXCEEDED',
  );
  assert.match(runtimeSource, /validateL2ObservedNetwork/);
  assert.match(runtimeSource, /networkConformanceError/);
});

test('browser L2 terminal accounting retains join-backed case outcomes after an abnormal reporter exit', () => {
  const activeIds = ['catalog-find-success', 'catalog-find-failure'];
  const resolved = resolveL2TerminalResults({
    activeIds,
    playwrightResultRows: [],
    joinEvents: [
      {kind: 'CASE_COMPLETE', caseId: activeIds[0], outcome: 'PASS'},
      {kind: 'CASE_COMPLETE', caseId: activeIds[1], outcome: 'FAIL'},
    ],
  });
  assert.equal(resolved.source, 'JOIN_EVENT_FALLBACK');
  const manifest = buildL2SelectionManifest({
    state: {identity: {runId: 'l2-test-terminal-accounting'}},
    activeIds,
    resultRows: resolved.rows,
    resultSource: resolved.source,
    joinTerminalRows: resolved.joinTerminalRows,
  });
  assert.equal(manifest.selectedCount, 2);
  assert.equal(manifest.results, 2);
  assert.equal(manifest.failedCount, 1);
  assert.equal(manifest.status, 'PASS');
  assert.throws(
    () =>
      resolveL2TerminalResults({
        activeIds,
        playwrightResultRows: [{caseId: activeIds[0], status: 'passed'}],
        joinEvents: [{kind: 'CASE_COMPLETE', caseId: activeIds[0], outcome: 'FAIL'}],
      }),
    error => error.code === 'L2_RESULT_REPORT_JOIN_MISMATCH',
  );
  assert.match(runtimeSource, /JOIN_EVENT_FALLBACK/);
  assert.match(runtimeSource, /resultCaseIds/);
});

test('browser L2 fail-fast accounting preserves the first failure and excludes skipped cases from results', () => {
  const activeIds = ['sales-menu-case-a', 'sales-menu-case-b', 'sales-menu-case-c'];
  const joinEvents = [
    {
      kind: 'CASE_COMPLETE',
      caseId: activeIds[0],
      outcome: 'FAIL',
      error: 'SALES_MENU_L2_TEST_ID_NOT_FOUND:SALES_MENU_MENU_SCHEDULE',
    },
  ];
  const resolved = resolveL2TerminalResults({
    activeIds,
    playwrightResultRows: [
      {caseId: activeIds[0], status: 'failed'},
      {caseId: activeIds[1], status: 'skipped'},
      {caseId: activeIds[2], status: 'skipped'},
    ],
    joinEvents,
  });
  const selection = buildL2SelectionManifest({
    state: {identity: {runId: 'l2-test-fail-fast-accounting'}},
    activeIds,
    resultRows: resolved.rows,
    resultSource: resolved.source,
    joinTerminalRows: resolved.joinTerminalRows,
  });
  assert.equal(resolved.rows.length, 1);
  assert.equal(selection.results, 1);
  assert.deepEqual(selection.notRunCaseIds, activeIds.slice(1));
  assert.equal(selection.stoppedAfterFirstFailure, true);
  assert.equal(selection.status, 'FAIL');
  assert.deepEqual(deriveL2CaseFailure({joinEvents, resultRows: resolved.rows}), {
    caseId: activeIds[0],
    failureCode: 'SALES_MENU_L2_TEST_ID_NOT_FOUND',
    failureCategory: 'SALES_MENU_L2',
    source: 'JOIN_EVENT',
  });
});

test('browser L2 reports a completed case failure without hiding concurrent source drift', () => {
  const caseFailure = {
    caseId: 'sales-menu-publish-blockers',
    failureCode: 'SALES_MENU_L2_OPERATION_HTTP_FAILED',
  };
  assert.equal(
    selectL2FirstFailure({
      caseFailure,
      sourceByteBindingAfterRunFailure: 'L2_SOURCE_BYTE_BINDING_AFTER_RUN:L2_SOURCE_BYTE_BINDING_SOURCE_DRIFT',
      accountingFailure: 'PLAYWRIGHT_EXIT_1',
    }),
    'L2_CASE_FAILED:sales-menu-publish-blockers:SALES_MENU_L2_OPERATION_HTTP_FAILED',
  );
  assert.equal(
    selectL2FirstFailure({
      sourceByteBindingAfterRunFailure: 'L2_SOURCE_BYTE_BINDING_AFTER_RUN:L2_SOURCE_BYTE_BINDING_SOURCE_DRIFT',
      accountingFailure: 'PLAYWRIGHT_EXIT_1',
    }),
    'L2_SOURCE_BYTE_BINDING_AFTER_RUN:L2_SOURCE_BYTE_BINDING_SOURCE_DRIFT',
  );
  assert.match(
    runtimeSource,
    /firstFailure,\s+remoteArtifactFailure,\s+sourceByteBindingAfterRunFailure,\s+firstFailedCaseId:/,
    'the public execution manifest must retain source drift beside the selected case failure',
  );
});

test('browser L2 merges a join-only terminal failure without treating it as not-run', () => {
  const activeIds = ['sales-menu-case-a', 'sales-menu-case-b'];
  const joinEvents = [
    {
      kind: 'CASE_COMPLETE',
      caseId: activeIds[1],
      outcome: 'FAIL',
      error: 'SALES_MENU_L2_OPERATION_HTTP_FAILED',
    },
  ];
  const resolved = resolveL2TerminalResults({
    activeIds,
    playwrightResultRows: [{caseId: activeIds[0], status: 'passed'}],
    joinEvents,
  });
  const selection = buildL2SelectionManifest({
    state: {identity: {runId: 'l2-test-join-only-terminal'}},
    activeIds,
    resultRows: resolved.rows,
    resultSource: resolved.source,
    joinTerminalRows: resolved.joinTerminalRows,
  });
  assert.equal(resolved.source, 'PLAYWRIGHT_JSON_WITH_JOIN_COMPLETION');
  assert.deepEqual(
    resolved.rows.map(row => row.caseId),
    activeIds,
  );
  assert.equal(selection.results, 2);
  assert.deepEqual(selection.notRunCaseIds, []);
  assert.deepEqual(deriveL2CaseFailure({joinEvents, resultRows: resolved.rows}), {
    caseId: activeIds[1],
    failureCode: 'SALES_MENU_L2_OPERATION_HTTP_FAILED',
    failureCategory: 'SALES_MENU_L2',
    source: 'JOIN_EVENT',
  });
});

test('catalog-library L2 resolves semantic tab anchors to the actual accessible control and reads writes back through the workbench', () => {
  assert.match(catalogL2Source, /anchor\.locator\('xpath=ancestor-or-self::\*\[@role="tab"\]'\)/);
  assert.match(catalogL2Source, /await expect\(tab\)\.toHaveCount\(1\)/);
  assert.match(catalogL2Source, /drawer\.getByRole\('tab', \{name: await anchor\.innerText\(\), exact: true\}\)/);
  assert.match(catalogL2Source, /toHaveAttribute\(\s*'aria-selected',\s*'true',?\s*\)/);
  assert.match(catalogL2Source, /recordControlTouch\('CATALOG_ITEM_TABS', testId, 'ACTION'\)/);
  assert.match(catalogL2Source, /async function reopenCatalogItemForOwnerReadback/);
  assert.match(catalogL2Source, /await searchCatalog\(page, readbackFacts\)/);
  assert.match(catalogL2Source, /await reopenCatalogItemForOwnerReadback\(/);
  assert.doesNotMatch(catalogL2Source, /drawer\.getByTestId\(catalogItemTabTestId\(key\)\)\.click\(\)/);
  assert.doesNotMatch(catalogL2Source, /page\.evaluate\([^]*?fetch\(/);
});

test('catalog-library L2 completes each generated write command and records a redacted browser-runtime boundary', () => {
  assert.match(catalogL2Source, /async function clickGeneratedCommand\(/);
  for (const operationId of [
    'createOperationsCatalogItem',
    'saveOperationsCatalogItem',
    'batchTransitionOperationsCatalogItemStatus',
    'preflightOperationsBrandCatalogCopy',
    'executeOperationsBrandCatalogCopy',
  ]) {
    assert.match(catalogL2Source, new RegExp(`clickGeneratedCommand\\([\\s\\S]*?'${operationId}'`));
  }
  assert.match(catalogL2Source, /kind: 'BROWSER_RUNTIME_ERROR'/);
  assert.match(catalogL2Source, /BROWSER_REACT_UPDATE_DEPTH/);
  assert.match(runtimeSource, /BROWSER_RUNTIME_ERROR/);
  assert.match(runtimeSource, /browserRuntimeErrors\.length === 0/);
});

test('catalog-library L2 follows generated lifecycle routing and the saved view surface', () => {
  const mutationHelper = catalogL2Source.match(
    /async function invalidateFixtureItemVersion\([\s\S]*?\n}\n\nasync function confirmCatalogLifecycle/,
  )?.[0];
  assert.ok(mutationHelper, 'fixture version-drift helper must remain structurally discoverable');
  assert.match(mutationHelper, /saveCatalogItem\(mutationPage, editor, mutationFacts\)/);
  assert.match(mutationHelper, /mutationResult\.item/);
  assert.match(mutationHelper, /Number\(mutationVersion\) <= expectedBaselineVersion/);
  assert.doesNotMatch(mutationHelper, /waitForResponse\(/);
  assert.doesNotMatch(mutationHelper, /visibleOperationsMenuItem\(mutationPage, '停用'\)/);
  assert.match(mutationHelper, /boundary === 'COPY' \? \{itemName: undefined\} : \{\}/);
  const editSuccess = catalogL2Source.match(
    /case 'catalog-edit-success':[\s\S]*?\n\s*case 'catalog-edit-failure':/,
  )?.[0];
  assert.ok(editSuccess, 'catalog edit success L2 branch must remain structurally discoverable');
  assert.match(editSuccess, /facts\.existingProductionTagName/);
  assert.match(editSuccess, /requireControl\(page, 'CATALOG_ITEM_VIEW_DRAWER', facts\)/);
  assert.match(editSuccess, /itemPreparationReadonly/);
  assert.match(editSuccess, /reopenCurrentCatalogItemForOwnerReadback\(page, facts\)/);
  assert.doesNotMatch(editSuccess, /editor\.getByTestId\(catalogTestIds\.static\.itemProductionTags\)\.toBeVisible/);
  assert.match(runtimeSource, /const L2_BASE_PRODUCTION_TAG = Object\.freeze/);
  assert.match(runtimeSource, /stage\('production-tag-base-readback'\)/);
  assert.match(runtimeSource, /L2_PRODUCTION_TAG_READBACK_INVALID/);
  assert.match(runtimeSource, /existingProductionTagName: rootProductionTag\.name/);
  assert.match(runtimeSource, /existingProductionTagName: factBindings\.existingProductionTagName/);
});

test('catalog-library L2 binds composite inputs, write completion, and owner rereads through generated operations', () => {
  const configSuccess = catalogL2Source.match(
    /case 'catalog-config-success':[\s\S]*?\n\s*case 'catalog-config-failure':/,
  )?.[0];
  const batchSubmit = catalogL2Source.match(
    /async function submitBatchAction\([\s\S]*?\n}\n\nasync function advanceBrandCopyPreflight/,
  )?.[0];
  const mutationHelper = catalogL2Source.match(
    /async function invalidateFixtureItemVersion\([\s\S]*?\n}\n\nasync function confirmCatalogLifecycle/,
  )?.[0];
  assert.ok(configSuccess && batchSubmit && mutationHelper);
  assert.match(configSuccess, /typeSequentially\(librarySearch/);
  assert.doesNotMatch(configSuccess, /librarySearch\.fill/);
  assert.match(configSuccess, /waitForGeneratedOperation\(page, 'getOperationsProductionTags'\)/);
  assert.match(configSuccess, /selectOperationsOption\(page, catalogTestIds\.control\.configStatus, '启用'\)/);
  assert.match(configSuccess, /submitProductionTagCreate\(page, facts\)/);
  assert.match(batchSubmit, /waitForGeneratedOperation\(page, 'getOperationsCatalogItems'\)/);
  assert.match(batchSubmit, /refreshedItems: await refreshedItems/);
  assert.match(mutationHelper, /boundary === 'COPY' \? facts\.sourceItemCode : facts\.itemCode/);
  assert.match(mutationHelper, /boundary === 'COPY' \? facts\.sourceScope : facts\.scope/);
  assert.match(mutationHelper, /boundary === 'COPY' \? facts\.sourceBaselineVersion : facts\.baselineVersion/);
  assert.match(mutationHelper, /mutationScope\.kind === 'HEAD_COMPANY'/);
  assert.match(mutationHelper, /browser\.newContext\(\)/);
  assert.match(
    mutationHelper,
    /signIn\(mutationPage, mutationScope\.kind === 'HEAD_COMPANY' \? headCompanyPrincipal : storePrincipal\)/,
  );
  assert.match(mutationHelper, /mutationContext\.close\(\)/);
  assert.match(mutationHelper, /installGeneratedL2Diagnostics\(mutationPage\)/);
  assert.match(mutationHelper, /observeFixtureWholeSave\(mutationPage, boundary\)/);
  assert.match(mutationHelper, /await mutationCompletion\.settle\(\)/);
  assert.match(mutationHelper, /openCatalogEditor\(mutationPage, mutationFacts\)/);
  assert.match(mutationHelper, /saveOperationsCatalogItem/);
  assert.doesNotMatch(mutationHelper, /transitionOperationsCatalogItemStatus/);
  assert.match(mutationHelper, /facts\.fixtureMutationVersion = Number\(mutationVersion\)/);
  assert.match(catalogL2Source, /relation === 'CONTAINS_ITEM_CODE'/);
  assert.match(catalogL2Source, /relation === 'SAME_AS_FIXTURE_MUTATION'/);
  assert.doesNotMatch(catalogL2Source, /relation === 'SAME_AS_FIXTURE_MUTATION_STATUS'/);
  assert.match(catalogL2Source, /function observeFixtureWholeSave/);
  assert.match(catalogL2Source, /operation\?\.operationId !== 'saveOperationsCatalogItem'/);
  assert.match(p1Source, /CONTAINS_ITEM_CODE/);
  assert.match(p1Source, /SAME_AS_FIXTURE_MUTATION/);
  assert.doesNotMatch(p1Source, /SAME_AS_FIXTURE_MUTATION_STATUS/);
  assert.match(p1Source, /copySourceFixtureCodes/);
  assert.match(runtimeSource, /sourceItemsByCode/);
  assert.match(runtimeSource, /sourceScope: sourceBinding/);
  assert.match(runtimeSource, /L2-COPY-SOURCE-\$\{state\}/);
  assert.match(p1Source, /P1_L2_COPY_TARGET_FACT_RED_MUTATION_NOT_REJECTED/);
});

test('browser L2 owner readback templates admit legitimate nullable facts and reject an absent binding', () => {
  const report = validateCatalogLibraryReadbackFactBindings();
  assert.equal(report.templateCount, 16);
  assert.ok(report.bindingKeys.includes('productionTagRef'));
  assert.deepEqual(
    materializeReadbackFactTemplate({item: {productionTagRef: '${productionTagRef}'}}, {productionTagRef: null}),
    {item: {productionTagRef: null}},
  );
  assert.throws(
    () => materializeReadbackFactTemplate({item: {productionTagRef: '${productionTagRef}'}}, {}),
    error => error.code === 'L2_OWNER_FIXTURE_FACT_BINDING_REQUIRED',
  );
  assert.throws(
    () =>
      validateCatalogLibraryReadbackFactBindings({
        testDatasets: [
          {
            fixtureId: 'FIXTURE-CATALOG-LIBRARY-RED',
            expected: {
              expectedReadback: {factTemplate: {item: {unknown: '${unknownBinding}'}}},
              unchangedReadback: {factTemplate: {item: {unknown: '${unknownBinding}'}}},
            },
          },
        ],
      }),
    error => error.code === 'L2_OWNER_FIXTURE_FACT_BINDING_UNDECLARED',
  );
});

test('browser L2 catalog item fixture reads the typed command resourceRef without legacy aliases', () => {
  assert.equal(
    requiredCatalogItemCommandResourceRef(
      {result: {resourceRef: '11111111-1111-1111-1111-111111111111'}},
      'L2_TEST_REF_MISSING',
    ),
    '11111111-1111-1111-1111-111111111111',
  );
  assert.throws(
    () => requiredCatalogItemCommandResourceRef({itemRef: 'legacy-alias'}, 'L2_TEST_REF_MISSING'),
    error => error.code === 'L2_TEST_REF_MISSING',
  );
  assert.doesNotMatch(runtimeSource, /requiredObjectValue\(created\.json, \['itemRef', 'id', 'ref'\]/);
});

test('browser L2 lifecycle fixture reads item action availability from the detail root', () => {
  assert.deepEqual(
    requiredCatalogItemDetailVoidAvailability(
      {data: {item: {itemCode: 'ITEM-1'}, actionAvailability: {voidAvailability: {canVoid: true}}}},
      'L2_TEST_VOID_AVAILABILITY_MISSING',
    ),
    {canVoid: true},
  );
  assert.throws(
    () =>
      requiredCatalogItemDetailVoidAvailability(
        {data: {item: {actionAvailability: {voidAvailability: {canVoid: true}}}}},
        'L2_TEST_VOID_AVAILABILITY_MISSING',
      ),
    error => error.code === 'L2_TEST_VOID_AVAILABILITY_MISSING',
  );
  assert.doesNotMatch(runtimeSource, /\.item\?\.actionAvailability\?\.voidAvailability/);
});

test('browser L2 namespace binding is closed to the managed namespace grammar', () => {
  assert.equal(L2_NAMESPACE_PATTERN.test('v2s_l2_catalog_test_01'), true);
  assert.equal(L2_DATABASE_PATTERN.test('catering_v2s_l2_catalog_test_01'), true);
  assert.equal(
    validateNamespaceBinding({
      runId: 'l2-runtime-test-01',
      namespace: 'v2s_l2_catalog_test_01',
      database: 'catering_v2s_l2_catalog_test_01',
      assetPrefix: 's3://assets/l2/l2-runtime-test-01/',
    }),
    true,
  );
  assert.throws(
    () =>
      validateNamespaceBinding({
        runId: 'l2-runtime-test-01',
        namespace: 'v2s-dev-r5-full',
        database: 'catering_v2s_l2_catalog_test_01',
        assetPrefix: 's3://assets/l2/l2-runtime-test-01/',
      }),
    error => error.code === 'L2_SECRET_NAMESPACE_BINDING_MISMATCH',
  );
});

test('browser L2 failure cleanup awaits remote cleanup and owns partial startup processes', () => {
  assert.match(
    runtimeSource,
    /async function cleanupOwnedL2Resources\(state, credentials\) \{[\s\S]*?await stopRemoteJava\(state\.remote\.host, state\.remoteJava\)[\s\S]*?await stopOwnedProcesses\(state\.processes\)[\s\S]*?await cleanupRemote\(state\.remote\.host, state\.identity, credentials\)/,
  );
  assert.equal((runtimeSource.match(/errors\.push\(\.\.\.\(await cleanupRemote\(/g) ?? []).length, 1);
  assert.doesNotMatch(runtimeSource, /minio\/mc rm[^\n]*\|\| true/);
  assert.doesNotMatch(runtimeSource, /minio\/mc ls[^\n]*\|\| true/);
  assert.match(
    runtimeSource,
    /const started = \[\];[\s\S]*?error\.cleanupErrors = \[[\s\S]*?await stopOwnedProcesses\(started\)/,
  );
  assert.match(runtimeSource, /cleanupPrivateRunFiles,/);
});

test('browser L2 keeps remote artifact failures separate from resource cleanup', () => {
  const manifest = buildIncompleteExecutionManifest({
    state: {
      runDirectory: path.join(root, '.runtime/browser-l2/l2-artifact-separation'),
      identity: {runId: 'l2-artifact-separation'},
      activeCaseIds: ['catalog-view-success'],
    },
    cleanupErrors: [],
    artifactErrors: ['REMOTE_ARTIFACTS:L2_REMOTE_ARTIFACT_COLLECTION_FAILED'],
  });
  assert.deepEqual(manifest.cleanupErrors, []);
  assert.deepEqual(manifest.artifactErrors, ['REMOTE_ARTIFACTS:L2_REMOTE_ARTIFACT_COLLECTION_FAILED']);
  assert.match(runtimeSource, /const artifactErrors = \[\];/);
  assert.match(runtimeSource, /artifactErrors.push\(`REMOTE_ARTIFACTS:\$\{errorCode\(error\)\}`\)/);
  assert.match(runtimeSource, /return \{cleanupErrors: errors, artifactErrors\}/);
  assert.match(runtimeSource, /artifactErrors: finalArtifactErrors/);
  assert.match(runtimeSource, /const remoteHost = runtime\.remote\?\.host/);
  assert.match(runtimeSource, /collectRemoteLog\(remoteHost, runtime\.remoteJava, runtime\.remoteLogPath\)/);
  assert.doesNotMatch(runtimeSource, /collectRemoteLog\(runtime\.remoteHost/);
});

test('browser L2 remote cleanup requires both a zero exit and its readback marker', () => {
  const marker = 'R5_L2_REMOTE_ASSET_CLEANUP=PASS';
  assert.equal(remoteCleanupPassed({status: 0, stdout: marker}, marker), true);
  assert.equal(remoteCleanupPassed({status: 1, stdout: marker}, marker), false);
  assert.equal(remoteCleanupPassed({status: 0, stdout: ''}, marker), false);
  assert.equal(remoteCleanupPassed({status: 1, stdout: ''}, marker), false);
});

test('browser L2 execution is closed to the active catalog case set and backend API paths', () => {
  assert.match(runtimeSource, /['"]--grep['"],\s*activeCaseGrep/);
  assert.match(runtimeSource, /['"]--workers=1['"]/);
  assert.match(runtimeSource, /['"]--workers=1['"],[\s\S]{0,320}?['"]--max-failures=1['"]/);
  assert.match(runtimeSource, /const activeCaseGrep = `\(\$\{executedCaseIds/);
  assert.match(
    runtimeSource,
    /R5_L2_OPERATIONS_LOGIN_ROUTE: `http:\/\/127\.0\.0\.1:\$\{state\.ports\.operations\}\/operations\/\$\{encodeURIComponent\(state\.workspaceKey\)\}\/login`/,
  );
  assert.match(runtimeSource, /R5_L2_HEAD_OPERATIONS_LOGIN_NAME: projected\.V2S_L2_HEAD_OPERATIONS_LOGIN/);
});

test('browser L2 emits per-case progress and persists a structured progress log', () => {
  assert.match(runtimeSource, /const progressPath = path\.join\(state\.runDirectory, 'l2-case-progress\.jsonl'\)/);
  assert.match(runtimeSource, /L2_CASE_QUEUE=READY; TOTAL=\$\{activeCaseCount\}/);
  assert.match(
    runtimeSource,
    /L2_CASE_START=\$\{event\.caseId\}; INDEX=\$\{index\}\/\$\{activeCaseCount\}; TOTAL=\$\{progress\.total\}; COMPLETED=\$\{progress\.completed\}; REMAINING=\$\{progress\.remaining\}/,
  );
  assert.match(
    runtimeSource,
    /L2_CASE_COMPLETE=\$\{event\.caseId\}; INDEX=\$\{index\}\/\$\{activeCaseCount\}; TOTAL=\$\{progress\.total\}; COMPLETED=\$\{progress\.completed\}/,
  );
  assert.match(runtimeSource, /export function validateL2CaseProgress/);
  assert.match(runtimeSource, /L2_CASE_PROGRESS_EVENT_DENOMINATOR_INVALID/);
  assert.match(runtimeSource, /L2_CASE_PROGRESS_COMPLETION_SEQUENCE_INVALID/);
  assert.match(runtimeSource, /remaining: activeCaseCount - completedCases\.size/);
  assert.match(runtimeSource, /caseProgressPath: repositoryRelativePath\(child\.progressPath\)/);
  assert.match(runtimeSource, /joinArtifactPath: repositoryRelativePath\(joinPath\)/);
});

test('browser L2 progress hard gate requires one ordered start and complete record per active case', () => {
  const activeIds = loadL2ActivationCandidate().approvedCaseIds;
  const progress = activeIds.flatMap((caseId, index) => [
    {
      kind: 'L2_CASE_PROGRESS',
      phase: 'START',
      caseId,
      index: index + 1,
      total: activeIds.length,
      completed: 0,
      remaining: activeIds.length,
    },
    {
      kind: 'L2_CASE_PROGRESS',
      phase: 'COMPLETE',
      caseId,
      index: index + 1,
      total: activeIds.length,
      completed: index + 1,
      pass: index + 1,
      fail: 0,
      remaining: activeIds.length - index - 1,
      outcome: 'PASS',
    },
  ]);
  assert.deepEqual(validateL2CaseProgress(progress, activeIds), {
    total: activeIds.length,
    startCount: activeIds.length,
    completeCount: activeIds.length,
  });
  assert.throws(
    () =>
      validateL2CaseProgress(
        progress.map((event, index) => (index === 0 ? {...event, total: activeIds.length - 1} : event)),
        activeIds,
      ),
    error => error.code === 'L2_CASE_PROGRESS_INDEX_OR_TOTAL_INVALID',
  );
  assert.throws(
    () =>
      validateL2CaseProgress(
        progress.map((event, index) => (index === 1 ? {...event, remaining: 0} : event)),
        activeIds,
      ),
    error => error.code === 'L2_CASE_PROGRESS_REMAINING_INVALID',
  );
});

test('browser L2 join distinguishes backend completions from explicit frontend intercepts', () => {
  assert.match(
    catalogL2Source,
    /completionId: headers\['x-request-id'\] \?\? headers\['x-l2-completion-id'\] \?\? null/,
  );
  assert.match(catalogL2Source, /backendExpected: headers\['x-l2-backend-expected'\] !== 'false'/);
  assert.match(runtimeSource, /backendExpected !== false/);
  assert.match(runtimeSource, /const dbEvents = readJsonLines\(state\.diagnostics\.dbEvents\)/);
  assert.match(runtimeSource, /missingHttpCompletions/);
  assert.match(runtimeSource, /completionsInActionWindow/);
  assert.match(runtimeSource, /invalidCaseScopedEventCount/);
  assert.match(runtimeSource, /startRows\.length === 1/);
  assert.match(runtimeSource, /completeRows\.length === 1/);
  assert.match(runtimeSource, /missingDbSectionCount/);
  assert.match(
    runtimeSource,
    /joinStatus:\s*invalidCaseScopedEvents\.length === 0\s*&& cases\.every\(entry => entry\.joinStatus === 'COMPLETE'\)\s*\? 'COMPLETE'\s*:\s*'INCOMPLETE'/,
  );
  assert.match(runtimeSource, /code: 'CASE_COMPLETE'/);
  assert.match(runtimeSource, /code: 'ACTION'/);
  assert.match(runtimeSource, /code: 'OPERATION'/);
  assert.match(runtimeSource, /code: 'HTTP'/);
  assert.match(runtimeSource, /code: 'DB'/);
  assert.match(runtimeSource, /code: 'ACTION_TOUCH'/);
  assert.match(runtimeSource, /L2_SELF_TEST_RED_JOIN/);
  assert.match(
    runtimeSource,
    /entry\.kind === 'HTTP_COMPLETION' && entry\.caseId === activeIds\[0\] \? \{\.\.\.entry, actionId: null\}/,
  );
  assert.match(
    runtimeSource,
    /entry\.kind === 'HTTP_COMPLETION' && entry\.caseId === activeIds\[0\] \? \{\.\.\.entry, operationId: null\}/,
  );
  assert.match(runtimeSource, /httpEvents: selfTestHttpEvents\.slice\(1\)/);
  assert.match(runtimeSource, /declaredActionsByCase/);
  assert.match(runtimeSource, /touchedActionIds/);
  assert.match(runtimeSource, /missingDeclaredActionIds/);
  assert.match(runtimeSource, /unexpectedTouchedActionIds/);
  assert.match(catalogL2Source, /async function runDeclaredAction/);
  assert.match(catalogL2Source, /kind: 'ACTION_START'/);
  assert.match(catalogL2Source, /kind: 'ACTION_COMPLETE'/);
  assert.match(catalogL2Source, /CATALOG_INVENTORY_L2_HTTP_OUTSIDE_ACTION/);
  assert.match(
    catalogL2Source,
    /await page\.waitForLoadState\('networkidle'\);\s*await Promise\.all\(responseWrites\);/,
  );
});

test('catalog-library owner readback and actions are target-specific declarations', () => {
  for (const source of [p1Source, fixtureSource, runtimeSource]) {
    assert.match(source, /DICTIONARY_ENTRY/);
    assert.match(source, /BATCH_RECEIPT_AND_ITEMS/);
    assert.match(source, /COPY_PREFLIGHT_AND_EXECUTION/);
    assert.match(source, /requiredFields/);
    assert.match(source, /factPaths/);
    assert.match(source, /ownerReaders|successOwnerReaders/);
  }
  assert.match(p1Source, /function l2DeclaredActionsFor\(caseId\)/);
  assert.match(p1Source, /declaredActions: l2DeclaredActionsFor\(blueprintCase\.caseId\)/);
  assert.match(fixtureSource, /L2_OWNER_FIXTURE_DECLARED_ACTION_EXACT_SET_INVALID/);
  assert.match(fixtureSource, /L2_OWNER_FIXTURE_SYNTHETIC_TARGET_FORBIDDEN/);
  assert.match(fixtureSource, /L2_OWNER_FIXTURE_READ_TARGET_FIELDS_INVALID/);
  assert.match(fixtureSource, /L2_OWNER_FIXTURE_TARGET_FACT_PATH_VALUE_MISSING/);
  assert.match(p1Source, /P1_L2_TARGET_FACT_VALUE_RED_MUTATION_NOT_REJECTED/);
  assert.match(catalogL2Source, /CATALOG_INVENTORY_L2_OWNER_FACT_MISMATCH/);
  assert.match(catalogL2Source, /CATALOG_INVENTORY_L2_OWNER_BATCH_ITEM_PAGE_MISSING/);
  assert.match(catalogL2Source, /CATALOG_INVENTORY_L2_OWNER_BATCH_ITEM_ROWS_MISSING/);
  assert.match(catalogL2Source, /CATALOG_INVENTORY_L2_OWNER_COPY_EXECUTION_PRESENT_AFTER_FAILURE/);
  assert.doesNotMatch(catalogL2Source, /payloadContainsRequiredFields/);
  assert.match(runtimeSource, /function declaredActionsFor\(activeIds(?:, suite = 'catalog-inventory')?\)/);
  assert.doesNotMatch(catalogL2Source, /const expectedTarget = \{/);
});

test('P1 rejects duplicate L2 blueprint object keys before JSON parsing', () => {
  assert.match(p1Source, /function assertUniqueRawJsonObjectKeys\(raw, errorCode\)/);
  assert.match(p1Source, /assertL2BlueprintRawTextGuard\(\);/);
  assert.match(p1Source, /P1_L2_BLUEPRINT_DUPLICATE_OBJECT_KEY/);
  assert.match(p1Source, /P1_L2_BLUEPRINT_DUPLICATE_KEY_RED_MUTATION_NOT_REJECTED/);
  assert.match(p1Source, /const l2CaseBlueprint = readJson\(L2_CASE_BLUEPRINT_PATH\);/);
});

test('browser L2 readiness consumes the generated candidate instead of an execution profile', () => {
  assert.match(
    runtimeSource,
    /const timingReport = writeTimingReport\(runDirectory, activeExecutionCaseIds(?:, suite)?\)/,
  );
  assert.match(runtimeSource, /const activationCandidate = loadSuiteActivationCandidate\(suite\)/);
  assert.match(runtimeSource, /L2_READINESS_CANDIDATE_CASE_SET_MISMATCH/);
  assert.match(runtimeSource, /L2_READINESS_TIMING_ACTIVE_CASE_MISMATCH/);
  assert.doesNotMatch(runtimeSource, /CATALOG_LIBRARY_CASE_IDS/);
});

test('browser L2 owns a remote Spring backend and exposes only HTTP plus asset ingress', () => {
  assert.match(
    runtimeSource,
    /const L2_RUNTIME_TOPOLOGY = 'REMOTE_SPRING_REMOTE_DB_REMOTE_ASSET_LOCAL_VITE_LOCAL_PLAYWRIGHT_HTTP_ASSET_TUNNEL'/,
  );
  assert.match(runtimeSource, /async function startRemoteRuntime\(/);
  assert.match(runtimeSource, /startRemoteJava\(/);
  assert.match(runtimeSource, /remoteHttpPortPreflight\(/);
  assert.match(runtimeSource, /httpPort: remoteHttpPort/);
  assert.match(runtimeSource, /remote-http-asset-tunnel/);
  assert.match(
    runtimeSource,
    /V2S_DEV_DATABASE_URL: `jdbc:postgresql:\/\/127\.0\.0\.1:5432\/\$\{identity\.database\}`/,
  );
  assert.doesNotMatch(runtimeSource, /ports\.http\}:127\.0\.0\.1:8080/);
  assert.doesNotMatch(runtimeSource, /async function startLocalRuntime\(/);
  assert.doesNotMatch(runtimeSource, /ports\.spring/);
  assert.doesNotMatch(runtimeSource, /ports\.db/);
  assert.doesNotMatch(runtimeSource, /:apps:backend:catering-business-server:bootRun/);
  assert.match(runtimeSource, /remoteBackend: publicRemoteBackend\(/);
  assert.match(runtimeSource, /remoteArtifactFailure/);
});

test('browser L2 interrupted runs have a managed cleanup recovery path', () => {
  assert.match(runtimeSource, /async function cleanupRuntimeState\(\n  state,\n  \{/);
  assert.match(runtimeSource, /await cleanupOwnedL2Resources\(state, credentials\)/);
  assert.match(runtimeSource, /process\.once\('SIGINT', handleSignal\)/);
  assert.match(runtimeSource, /L2_RUNTIME_INTERRUPTED_\$\{interruptedSignal\}/);
  assert.match(
    runtimeSource,
    /if \(mode === 'cleanup'\) return cleanupCommand\(args\[args\.indexOf\('cleanup'\) \+ 1\], suite\)/,
  );
  assert.match(runtimeSource, /executionStatus = 'INCOMPLETE_FINALIZATION'/);
  assert.match(runtimeSource, /brokenBoundary = 'L2_RUNTIME_FINALIZATION'/);
  assert.match(runtimeSource, /preflightComplete \? 'INCOMPLETE_FINALIZATION' : 'INCOMPLETE_PREFLIGHT'/);
  assert.match(runtimeSource, /preflightComplete \? 'L2_RUNTIME_FINALIZATION' : 'L2_RUNTIME_PREFLIGHT'/);
});

test('browser L2 failed readiness keeps an exact managed cleanup recovery state', () => {
  const runtimeDirectory = process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/browser-l2');
  const runId = 'l2-readiness-cleanup-recovery';
  const runDirectory = path.join(runtimeDirectory, runId);
  const manifestPath = path.join(runDirectory, 'readiness-manifest.json');
  const binding = {
    runId,
    namespace: 'v2s_l2_readiness_cleanup_recovery',
    database: 'catering_v2s_l2_readiness_cleanup_recovery',
    assetPrefix: `s3://catering-v2s-r5-assets/catering-v2s/l2/${runId}/`,
  };
  const manifest = {
    kind: 'sales-menu-l2-readiness-manifest',
    status: 'FAIL',
    cleanupStatus: 'FAIL',
    ...binding,
    runBinding: binding,
    remote: {host: 'trusted-test-host', fingerprint: 'test-fingerprint', allowlistVersion: 'test-allowlist'},
    credentialsFile: path.relative(root, path.join(runDirectory, 'credentials.env')).split(path.sep).join('/'),
    processIdentities: [{name: 'l2-remote-http-asset-tunnel', pid: 1234, pgid: 1234, startToken: 'test-start-token'}],
    ports: {http: 28080, asset: 29000, platform: 5174, operations: 5175},
    activeCaseIds: ['sales-menu-entry-and-channels'],
    frontendMode: 'preview',
    createdAt: '2026-09-03T00:00:00.000Z',
  };
  const state = buildReadinessFailureCleanupState({suite: 'sales-menu', manifestPath, manifest});
  assert.equal(state.kind, 'sales-menu-l2-runtime-state');
  assert.equal(state.status, 'CLEANUP_REQUIRED');
  assert.equal(state.runDirectory, runDirectory);
  assert.deepEqual(state.identity, binding);
  assert.deepEqual(state.activeCaseIds, manifest.activeCaseIds);
  assert.match(runtimeSource, /state\.status !== 'READY' && state\.status !== 'CLEANUP_REQUIRED'/);
  assert.match(runtimeSource, /status: finalCleanupErrors\.length \? 'CLEANUP_REQUIRED' : 'CLEANED'/);
});

test('browser L2 readiness failure reports the manifest cleanup result without string truthiness', () => {
  assert.match(runtimeSource, /BROWSER_L2_READINESS=FAIL; FIRST_FAILURE=\$\{firstFailure\}; CLEANUP=\$\{cleanup\};/);
  assert.doesNotMatch(runtimeSource, /CLEANUP=\$\{cleanup\.length \? 'FAIL' : 'PASS'\}/);
});

test('browser L2 preflight failures emit run-bound execution evidence before business execution', () => {
  const runDirectory = path.join(root, '.runtime/browser-l2/l2-preflight-manifest-focused');
  const manifest = buildIncompleteExecutionManifest({
    state: {
      runDirectory,
      sourceByteBindingPath: path.join(root, 'contracts/policy/catalog-inventory-l2-execution.json'),
      identity: {runId: 'l2-preflight-manifest-focused'},
      activeCaseIds: ['catalog-view-success'],
    },
    executionStatus: 'INCOMPLETE_PREFLIGHT',
    firstFailure: 'L2_SOURCE_BYTE_BINDING_SOURCE_DRIFT:example',
    lastKnownGood: 'RUN_CREDENTIALS_VALIDATED',
    brokenBoundary: 'L2_RUNTIME_PREFLIGHT',
    cleanup: 'PASS',
    cleanupManifestPath: path.join(runDirectory, 'l2-cleanup-manifest.json'),
  });
  assert.equal(manifest.executionStatus, 'INCOMPLETE_PREFLIGHT');
  assert.equal(manifest.selected, 1);
  assert.equal(manifest.results, 0);
  assert.deepEqual(manifest.activeCaseIds, ['catalog-view-success']);
  assert.equal(manifest.sourceByteBindingPath, 'contracts/policy/catalog-inventory-l2-execution.json');
  assert.equal(
    manifest.cleanupManifestPath,
    '.runtime/browser-l2/l2-preflight-manifest-focused/l2-cleanup-manifest.json',
  );
  assert.equal(manifest.brokenBoundary, 'L2_RUNTIME_PREFLIGHT');
  assert.doesNotMatch(JSON.stringify(manifest), /\/Users\/|\/Volumes\//);
});

test('browser L2 finalizes bytes in-run and launches installed CLIs without package-manager mutation', () => {
  assert.match(runtimeSource, /const viteCliPath = path\.join\(root, 'node_modules\/vite\/bin\/vite\.js'\)/);
  assert.match(runtimeSource, /const playwrightCliPath = path\.join\(root, 'node_modules\/playwright\/cli\.js'\)/);
  assert.match(runtimeSource, /mode === 'finalize'/);
  assert.match(runtimeSource, /async function refreshLocalFrontendProcesses\(state\)/);
  assert.match(runtimeSource, /state = await refreshLocalFrontendProcesses\(state\)/);
  assert.match(runtimeSource, /GENERATED_CHAIN_COMPLETED_BEFORE_BYTE_BINDING/);
  assert.match(runtimeSource, /BROWSER_L2_SOURCE_BYTE_BINDING_FINALIZE=PASS/);
  assert.match(runtimeSource, /L2_SOURCE_BYTE_BINDING_AFTER_RUN:/);
  assert.doesNotMatch(runtimeSource, /spawnManaged\([^\n]+\n\s*'yarn'/);
  assert.doesNotMatch(runtimeSource, /spawn\(\s*'yarn'/);
});

test('browser L2 owner bootstrap uses the contract asset usage value', () => {
  assert.match(runtimeSource, /form\.set\('usage', 'GROUP_WORKSPACE_LOGO'\)/);
  assert.doesNotMatch(runtimeSource, /form\.set\('usage', 'WORKSPACE_LOGO'\)/);
});

test('sales-menu operation-record readiness reads the required channel-scoped query', () => {
  assert.match(
    runtimeSource,
    /getOperationsSalesMenuOperationRecords'[\s\S]*?\{channelRef: primaryChannel\.ref, pageSize: 20\}/,
  );
  assert.match(runtimeSource, /operation-records-read-page-2/);
  assert.match(runtimeSource, /operationCursor = salesMenuNextCursor\(operationPage\)/);
});

test('sales-menu owner facts use the actual eligible-channel page order', () => {
  assert.match(
    runtimeSource,
    /const ownerChannelRows = \[\.\.\.channelPageRows, \.\.\.salesMenuPageItems\(channelPage2\)\]/,
  );
  assert.match(runtimeSource, /const ownerChannelRefs = ownerChannelRows\.map\(row =>[\s\S]*channelRef/);
  assert.match(
    runtimeSource,
    /const primaryMenuFixture = fixture\.menuFixtures\.find\(menu => menu\.fixtureId === 'MENU-01'\)/,
  );
  assert.match(
    runtimeSource,
    /primaryMenuFixture\.channelFixtureId,[\s\S]*?'SALES_MENU_PRIMARY_CHANNEL_FIXTURE_MISSING'/,
  );
  assert.match(
    runtimeSource,
    /primaryMenuFixture\.secondaryActiveChannelFixtureId,[\s\S]*?'SALES_MENU_SECONDARY_ACTIVE_CHANNEL_FIXTURE_MISSING'/,
  );
  assert.match(runtimeSource, /const menuChannel = requireFixtureChannel\([\s\S]*?menuFixture\.channelFixtureId/);
  assert.match(runtimeSource, /kind: 'SALES_MENU_FIXTURE_CHANNEL_SELECTION'/);
  assert.doesNotMatch(runtimeSource, /const primaryChannel = ownerOrderedChannels\[0\]/);
  assert.doesNotMatch(runtimeSource, /const secondaryChannel = ownerOrderedChannels\[1\]/);
  assert.match(runtimeSource, /channelRefs: ownerChannelRefs/);
});

test('browser L2 owner client binds body idempotency fields to the request header', () => {
  assert.match(runtimeSource, /options\.body\?\.idempotencyKey === '\$header'/);
  assert.match(runtimeSource, /idempotencyKey: '\$header'/);
  assert.doesNotMatch(runtimeSource, /idempotencyKey\(identity\.runId, 'workspace-body'\)/);
});

test('browser L2 store bootstrap role exposes the approved sales-menu page', () => {
  const storeRoleBlock = runtimeSource.match(
    /const storeRole = await request\([\s\S]*?const storeRoleId = requiredObjectValue\([\s\S]*?\n/,
  )?.[0];
  assert.ok(storeRoleBlock, 'store role bootstrap block must remain structurally discoverable');
  assert.match(
    storeRoleBlock,
    /serviceNodeType: 'STORE',[\s\S]*?pageAccessKeys: \[\s*'PG-IAM-STORE-USERS',\s*'PG-CATALOG-STORE-ITEMS',\s*'PG-BUSINESS-CHANNEL-STORE',\s*'PG-SALES-MENU-STORE',\s*\]/,
  );
  assert.doesNotMatch(storeRoleBlock, /PG-CATALOG-BRAND-ITEMS/);
});

test('browser L2 invitation bootstrap verifies the non-production delivery code', () => {
  assert.match(runtimeSource, /const delivery = await request\(stage\(`\$\{prefix\}-otp-send`\)/);
  assert.match(runtimeSource, /requiredObjectValue\(\s*delivery\.json,\s*\['debugVerificationCode'\]/);
  assert.match(runtimeSource, /code: debugCode/);
  assert.doesNotMatch(runtimeSource, /code: credentials\.values\.V2S_L2_TEST_OTP/);
});

test('browser L2 group bootstrap selects the created project before creating a store', () => {
  assert.match(
    runtimeSource,
    /const groupSession = await request\(\s*stage\('group-session'\),\s*'getOperationsWorkspaceSessionEntry'/,
  );
  assert.match(
    runtimeSource,
    /const groupContextVersion = requiredObjectValue\(\s*groupSession\.json,\s*\['contextVersion'\]/,
  );
  assert.match(runtimeSource, /stage\('group-select-project'\),\s*'selectOperationsWorkspaceSessionDataNode'/);
  assert.match(
    runtimeSource,
    /dataNodeRef: org\.projectRef, dataNodeType: 'PROJECT', requiredContextVersion: groupContextVersion/,
  );
  assert.ok(runtimeSource.indexOf("stage('group-select-project')") < runtimeSource.indexOf("stage('store')"));
});

test('browser L2 catalog bootstrap follows the owner HTTP 200 create responses', () => {
  assert.match(runtimeSource, /stage\('category-root'\)[\s\S]*?expected: \[200\]/);
  assert.match(runtimeSource, /stage\('category-child'\)[\s\S]*?expected: \[200\]/);
  assert.match(runtimeSource, /stage\('production-tag-base'\)[\s\S]*?expected: \[200\]/);
  assert.match(runtimeSource, /item-create-\$\{row\.caseId\}[\s\S]*?expected: \[200\]/);
});

test('browser L2 item bootstrap has the canonical item version readback helper', () => {
  assert.match(
    runtimeSource,
    /const itemResult = json => json\?\.result \?\? json\?\.data\?\.result \?\? json\?\.data \?\? json/,
  );
  assert.match(
    runtimeSource,
    /const itemVersion = json => Number\(itemResult\(json\)\?\.version \?\? json\?\.version \?\? 1\)/,
  );
});

test('browser L2 catalog items satisfy the standard sale unit contract', () => {
  assert.match(runtimeSource, /stage\('unit-base'\),\s*'createOperationsCatalogUnit'/);
  assert.match(
    runtimeSource,
    /body: \{dataNodeRef, code: 'L2-EACH', name: '个', unitDimension: 'COUNT', precision: 0\}/,
  );
  assert.match(runtimeSource, /const l2UnitRef = requiredObjectValue\(unit\.json, \['unitRef', 'id', 'ref'\]/);
  assert.match(
    runtimeSource,
    /const createDraft = \(\s*name,\s*categoryRef,\s*tagRef = null,\s*shapeKey = 'STANDARD_SALE_COUNTED',\s*unitRef = l2UnitRef,/,
  );
  assert.match(runtimeSource, /salesUnitRef: unitRef,[\s\S]*?baseMeasureUnitRef: unitRef/);
  assert.match(runtimeSource, /head-item-create-\$\{sourceItem\.code\}[\s\S]*?dataNodeRef: org\.headCompanyRef/);
});

test('browser L2 item bootstrap preserves nullable prices without retired missing-price state', () => {
  assert.match(runtimeSource, /priceGranularity: shapeKey === 'SKU_VARIANT_SALE_COUNTED' \? 'SKU' : 'ITEM'/);
  assert.match(
    runtimeSource,
    /standardSalePrice:\s*shapeKey === 'SKU_VARIANT_SALE_COUNTED'[\s\S]*?skuVariantDimensions/,
  );
  assert.doesNotMatch(runtimeSource, /missingPriceCount/);
});

test('browser L2 keeps a legally unpriced SKU view fixture in draft instead of forcing activation', () => {
  assert.match(runtimeSource, /const enabled =\s*fixtureItem\.status === 'ENABLED'\s*\? await request\(/);
  assert.match(runtimeSource, /if \(sourceItem\.status === 'ENABLED'\) \{/);
  assert.match(runtimeSource, /const baselineStatus = lifecycle\.status;/);
  assert.match(
    runtimeSource,
    /items\.push\(\{\s*itemCode,\s*itemName,\s*fixtureRef: row\.fixtureRef,\s*version: actualVersion,\s*status: baselineStatus,/,
  );
});

test('browser L2 materializes terminal SKU facts through the owner lifecycle command', () => {
  assert.match(
    runtimeSource,
    /status:\s*sku\.status === 'VOIDED'\s*\?\s*'DISABLED'\s*:\s*\(?sku\.status\s*\?\?\s*'ENABLED'\)?/,
  );
  assert.match(runtimeSource, /export async function materializeFixtureVoidedSkuLifecycle/);
  assert.match(runtimeSource, /fixtureSkuFactsForItem\(fixtureObjects, fixtureItem\)/);
  assert.match(runtimeSource, /\$\{stagePrefix\}-sku-void-readback`,\s*'getOperationsCatalogItem'/);
  assert.match(runtimeSource, /export function buildFixtureVoidedSkuTransitions/);
  assert.match(runtimeSource, /function directSkuReference/);
  assert.match(runtimeSource, /const skuRef = directSkuReference\(actualSku\)/);
  assert.match(runtimeSource, /targetStatus: 'VOIDED', expectedVersion: actualSku\.version/);
  assert.match(runtimeSource, /catalogDraft: \{name: itemName, shapeKey\}/);
  assert.match(runtimeSource, /skuTransitions: transitions/);
  assert.match(
    runtimeSource,
    /validateFixtureVoidedSkuTransitionReadback\(transitions, transitioned\.json, stagePrefix\)/,
  );
  assert.match(runtimeSource, /entry\.status !== 'VOIDED'/);
  assert.match(runtimeSource, /expectedCatalogVersion: version/);
});

test('browser L2 terminal SKU fixture selection and transition payload are executable and item-scoped', () => {
  const primaryRef = '11111111-1111-4111-8111-111111111111';
  const fixtureObjects = [
    {type: 'CatalogItem', code: 'PRIMARY', skuCodes: ['PRIMARY-VOID', 'PRIMARY-ACTIVE']},
    {type: 'CatalogItem', code: 'EXTRA', skuCodes: ['EXTRA-VOID']},
    {type: 'CatalogSku', code: 'PRIMARY-VOID', skuCode: 'PRIMARY-VOID', status: 'VOIDED'},
    {type: 'CatalogSku', code: 'PRIMARY-ACTIVE', skuCode: 'PRIMARY-ACTIVE', status: 'ENABLED'},
    {type: 'CatalogSku', code: 'EXTRA-VOID', skuCode: 'EXTRA-VOID', status: 'VOIDED'},
  ];
  const primarySkus = fixtureSkuFactsForItem(fixtureObjects, {
    code: 'PRIMARY',
    skuCodes: ['PRIMARY-VOID', 'PRIMARY-ACTIVE'],
  });
  assert.deepEqual(
    primarySkus.map(sku => sku.code),
    ['PRIMARY-VOID', 'PRIMARY-ACTIVE'],
  );
  assert.deepEqual(
    buildFixtureVoidedSkuTransitions(
      fixtureObjects,
      {code: 'PRIMARY', skuCodes: ['PRIMARY-VOID', 'PRIMARY-ACTIVE']},
      [{skuCode: 'PRIMARY-VOID', productSkuRef: primaryRef, version: 7}],
      'primary',
    ),
    [{skuRef: primaryRef, targetStatus: 'VOIDED', expectedVersion: 7}],
  );
  assert.throws(
    () =>
      buildFixtureVoidedSkuTransitions(
        fixtureObjects,
        {code: 'PRIMARY', skuCodes: ['PRIMARY-VOID', 'PRIMARY-ACTIVE']},
        [{skuCode: 'PRIMARY-VOID', productSkuRef: primaryRef}],
        'primary',
      ),
    error => error.code === 'L2_OWNER_FIXTURE_VOIDED_SKU_READBACK_INVALID',
  );
  assert.throws(
    () =>
      buildFixtureVoidedSkuTransitions(
        fixtureObjects,
        {code: 'PRIMARY', skuCodes: ['PRIMARY-VOID', 'PRIMARY-ACTIVE']},
        [{skuCode: 'PRIMARY-VOID', metadata: {ref: 'unrelated-ref'}, version: 7}],
        'primary',
      ),
    error => error.code === 'L2_OWNER_FIXTURE_VOIDED_SKU_READBACK_INVALID',
  );
  const transitions = [{skuRef: primaryRef, targetStatus: 'VOIDED', expectedVersion: 7}];
  assert.deepEqual(
    validateFixtureVoidedSkuTransitionReadback(
      transitions,
      {
        result: {
          skuTransitions: [
            {
              skuRef: primaryRef,
              targetStatus: 'VOIDED',
              version: 8,
              canVoid: false,
              blockingReferences: [],
              dependentFacts: [],
              blockingReasons: [{reasonCode: 'ALREADY_VOIDED', count: 1, relatedItemNames: []}],
            },
          ],
        },
      },
      'primary',
    ),
    [
      {
        skuRef: primaryRef,
        targetStatus: 'VOIDED',
        version: 8,
        canVoid: false,
        blockingReferences: [],
        dependentFacts: [],
        blockingReasons: [{reasonCode: 'ALREADY_VOIDED', count: 1, relatedItemNames: []}],
      },
    ],
  );
  assert.throws(
    () =>
      validateFixtureVoidedSkuTransitionReadback(
        transitions,
        {result: {skuTransitions: [{skuRef: primaryRef, targetStatus: 'DISABLED', version: 8, canVoid: false}]}},
        'primary',
      ),
    error => error.code === 'L2_OWNER_FIXTURE_VOIDED_SKU_TRANSITION_READBACK_INVALID',
  );
  assert.throws(
    () =>
      buildFixtureVoidedSkuTransitions(
        fixtureObjects,
        {code: 'PRIMARY', skuCodes: ['PRIMARY-VOID', 'PRIMARY-ACTIVE']},
        [{skuCode: 'PRIMARY-VOID', productSkuRef: 'primary-ref', version: 7}],
        'primary',
      ),
    error => error.code === 'L2_OWNER_FIXTURE_VOIDED_SKU_READBACK_INVALID',
  );
  assert.throws(
    () => validateFixtureSkuOwnership([...fixtureObjects, {type: 'CatalogSku', code: 'UNBOUND', status: 'VOIDED'}]),
    error => error.code === 'L2_OWNER_FIXTURE_SKU_OWNERSHIP_UNBOUND',
  );
  assert.throws(
    () =>
      validateFixtureSkuOwnership([
        ...fixtureObjects,
        {type: 'CatalogItem', code: 'DUPLICATE', skuCodes: ['EXTRA-VOID']},
      ]),
    error => error.code === 'L2_OWNER_FIXTURE_SKU_OWNERSHIP_DUPLICATE',
  );
  assert.throws(
    () =>
      validateFixtureSkuOwnership([
        ...fixtureObjects,
        {type: 'CatalogItem', code: 'MISSING', skuCodes: ['MISSING-SKU']},
      ]),
    error => error.code === 'L2_OWNER_FIXTURE_SKU_OWNERSHIP_DECLARED_MISSING',
  );
});

test('browser L2 readiness evidence binds current repository bytes and exposes only repository-relative paths', () => {
  const runDirectory = path.join(root, '.runtime/browser-l2/l2-source-byte-binding-focused');
  const identity = {
    runId: 'l2-source-byte-binding-focused',
    namespace: 'v2s_l2_source_byte_binding_focused',
    database: 'catering_v2s_l2_source_byte_binding_focused',
    assetPrefix: 's3://catering-v2s-r5-assets/catering-v2s/l2/l2-source-byte-binding-focused/',
  };
  const sourceBinding = writeRepositoryByteBinding({runDirectory, identity});
  const validation = validateRepositoryByteBinding(sourceBinding.path, {expectedRunId: identity.runId});
  const binding = readJson('.runtime/browser-l2/l2-source-byte-binding-focused/repository-byte-binding.json');
  assert.equal(validation.bindingDigest, sourceBinding.bindingDigest);
  assert.equal(validation.fileCount, sourceBinding.fileCount);
  assert.equal(validation.byteCount, sourceBinding.byteCount);
  assert.equal(binding.scope, 'apps-backend-and-apps-frontend-input-files-excluding-managed-runtime-and-build-output');
  assert.deepEqual(binding.includedDirectories, ['apps/backend', 'apps/frontend']);
  assert.ok(binding.files.length > 0);
  assert.equal(
    binding.files.every(file => file.path.startsWith('apps/backend/') || file.path.startsWith('apps/frontend/')),
    true,
  );
  assert.equal(
    binding.files.some(file => file.path.startsWith('tools/') || file.path.startsWith('scripts/')),
    false,
  );
  assert.deepEqual(binding.excludedFilePatterns, ['.DS_Store', '*.log', '*.apk', '*.aab', '*.keystore']);
  assert.equal(
    binding.files.some(
      file =>
        file.path
          .split('/')
          .some(segment =>
            ['.expo', '.turbo', '.yarn', '.kotlin', '.vite', '.next', 'test-results', 'playwright-report'].includes(
              segment,
            ),
          ) ||
        file.path === '.DS_Store' ||
        file.path.endsWith('.log') ||
        /\.(apk|aab|keystore)$/.test(file.path),
    ),
    false,
  );

  const candidate = loadL2ActivationCandidate();
  const activeCaseIds = [...candidate.approvedCaseIds];
  const credentialsPath = path.join(runDirectory, 'credentials.env');
  const ownerFixturePath = path.join(runDirectory, 'catalog-inventory-owner-fixture.json');
  const remoteRunId = 'r5-dev-1234567890-12345-11111111-1111-4111-8111-111111111111';
  const remoteRoot = `/tmp/${remoteRunId}`;
  const remoteJava = {
    schemaVersion: 1,
    kind: 'r5-dev-remote-java-control',
    runId: remoteRunId,
    remoteRoot,
    pid: 1,
    pgid: 1,
    bootId: '0123456789abcdef0123456789abcdef',
    processStartTicks: 1,
    commandSha256: 'a'.repeat(64),
    httpPort: 18080,
    phase: 'READY',
    logPath: `${remoteRoot}/results/business-server.log`,
    phasePath: `${remoteRoot}/results/phase.jsonl`,
  };
  const manifest = buildReadinessManifest({
    identity,
    ports: {http: 18080, asset: 19000, platform: 15173, operations: 15174},
    candidate,
    denominators: {activeCases: activeCaseIds.length, activeCaseIds},
    timingReport: {activeCaseCount: activeCaseIds.length, fullRunTimeoutMs: 120000},
    remote: {host: 'trusted-test-host', fingerprint: 'test-fingerprint', allowlistVersion: 'test-allowlist'},
    remoteJava,
    remoteRoot,
    remoteResources: {
      schemaVersion: 1,
      kind: 'r5-dev-remote-resource-snapshot',
      host: 'trusted-test-host',
      bootId: remoteJava.bootId,
      remoteRoot,
      javaMajor: 21,
      cpuCount: 4,
      memoryAvailableMiB: 1024,
      tmpAvailableMiB: 4096,
      remoteRootAbsent: false,
      observedAt: new Date().toISOString(),
    },
    remoteHttpPort: 18080,
    remoteDiagnostics: {
      events: `${remoteRoot}/results/http-request-events.jsonl`,
      dbEvents: `${remoteRoot}/results/db-operation-events.jsonl`,
      dictionary: `${remoteRoot}/results/statement-dictionary.json`,
    },
    remoteLogPath: path.join(runDirectory, 'remote-business-server.log'),
    processes: [{name: 'test-process', pid: 1, pgid: 1, startToken: 'test-start-token'}],
    diagnostics: {
      events: path.join(runDirectory, 'events.jsonl'),
      dbEvents: path.join(runDirectory, 'db-events.jsonl'),
      dictionary: path.join(runDirectory, 'statement-dictionary.json'),
    },
    credentialsPath,
    ownerFixturePath,
    sourceByteBinding: sourceBinding,
    status: 'PASS',
    business: 'PASS',
    setupCleanup: 'PASS',
    cleanup: 'PENDING_HELD',
  });
  assert.equal(manifest.credentialsFile, repositoryRelativePath(credentialsPath));
  assert.equal(manifest.ownerFixturePath, repositoryRelativePath(ownerFixturePath));
  assert.equal(manifest.repositoryByteBinding.path, sourceBinding.relativePath);
  assert.doesNotMatch(JSON.stringify(manifest), /\/Users\/|\/Volumes\//);
  assert.match(runtimeSource, /validateRepositoryByteBinding\(sourceByteBinding\.path/);
  assert.match(runtimeSource, /state\.sourceByteBindingPath/);
  assert.throws(
    () => repositoryRelativePath(path.join(root, '..', 'foreign-worktree', 'credentials.env')),
    error => error.code === 'L2_REPOSITORY_RELATIVE_PATH_REQUIRED',
  );
});

test('browser L2 persisted runtime state excludes diagnostic credentials', () => {
  const state = sanitizeRuntimeState({
    kind: 'sales-menu-l2-runtime-state',
    runDirectory: '.runtime/browser-l2/l2-runtime-state-sanitization',
    credentialsPath: '.runtime/browser-l2/l2-runtime-state-sanitization/credentials.env',
    diagnostics: {
      events: '.runtime/browser-l2/l2-runtime-state-sanitization/http-request-events.jsonl',
      dbEvents: '.runtime/browser-l2/l2-runtime-state-sanitization/db-operation-events.jsonl',
      dictionary: '.runtime/browser-l2/l2-runtime-state-sanitization/statement-dictionary.json',
      debugEvents: '.runtime/browser-l2/l2-runtime-state-sanitization/browser-debug-events.jsonl',
      secret: 'diagnostic-secret-must-not-persist',
      hmac: 'diagnostic-hmac-must-not-persist',
      runId: 'l2-runtime-state-sanitization',
    },
  });
  assert.deepEqual(state.diagnostics, {
    events: '.runtime/browser-l2/l2-runtime-state-sanitization/http-request-events.jsonl',
    dbEvents: '.runtime/browser-l2/l2-runtime-state-sanitization/db-operation-events.jsonl',
    dictionary: '.runtime/browser-l2/l2-runtime-state-sanitization/statement-dictionary.json',
    debugEvents: '.runtime/browser-l2/l2-runtime-state-sanitization/browser-debug-events.jsonl',
    runId: 'l2-runtime-state-sanitization',
  });
  assert.doesNotMatch(JSON.stringify(state), /diagnostic-secret-must-not-persist|diagnostic-hmac-must-not-persist/);
  assert.doesNotMatch(JSON.stringify(state), /"secret"|"hmac"/);
  assert.match(runtimeSource, /const persistedState = sanitizeRuntimeState\(state\)/);
});

test('browser L2 executes the real VIEW fixture terminal SKU lifecycle in owner request order', async () => {
  const catalog = readJson('contracts/policy/catalog-inventory-fixture-catalog.json');
  const fixture = catalog.testDatasets.find(entry => entry.fixtureId === 'FIXTURE-CATALOG-LIBRARY-VIEW');
  assert.ok(fixture);
  const fixtureItem = fixture.objects.find(entry => entry.type === 'CatalogItem');
  assert.ok(fixtureItem);
  const fixtureScaffold = {fixtureObjects: fixture.objects, fixtureBindings: new Map()};
  const refs = {
    'L2-VIEW-SKU-S': '11111111-1111-4111-8111-111111111111',
    'L2-VIEW-SKU-M': '22222222-2222-4222-8222-222222222222',
    'L2-VIEW-SKU-L': '33333333-3333-4333-8333-333333333333',
  };
  const calls = [];
  const request = async (stage, operationId, pathParameters, options) => {
    calls.push({stage, operationId, pathParameters, options});
    if (operationId === 'getOperationsCatalogItem') {
      return {
        json: {
          item: {
            skus: Object.entries(refs).map(([skuCode, productSkuRef]) => ({skuCode, productSkuRef, version: 1})),
          },
        },
      };
    }
    assert.equal(operationId, 'saveOperationsCatalogItem');
    const transitions = options.body.skuTransitions;
    assert.deepEqual(transitions, [{skuRef: refs['L2-VIEW-SKU-L'], targetStatus: 'VOIDED', expectedVersion: 1}]);
    return {
      json: {
        result: {
          version: 2,
          skuTransitions: [
            {
              skuRef: refs['L2-VIEW-SKU-L'],
              targetStatus: 'VOIDED',
              version: 2,
              canVoid: false,
              blockingReferences: [],
              dependentFacts: [],
              blockingReasons: [{reasonCode: 'ALREADY_VOIDED', count: 1, relatedItemNames: []}],
            },
          ],
        },
      },
    };
  };
  const version = await materializeFixtureVoidedSkuLifecycle({
    stagePrefix: 'fixture-view',
    itemCode: 'L2-VIEW-001',
    itemName: fixtureItem.name,
    shapeKey: fixtureItem.shapeKey,
    fixtureScaffold,
    fixtureItem,
    version: 1,
    request,
    requestContext: {dataNodeRef: '44444444-4444-4444-8444-444444444444'},
  });
  assert.equal(version, 2);
  assert.deepEqual(
    calls.map(call => call.operationId),
    ['getOperationsCatalogItem', 'saveOperationsCatalogItem'],
  );
  assert.equal(calls[1].options.body.sections.expectedCatalogVersion, 1);
  assert.equal(fixtureScaffold.fixtureBindings.get('L2-VIEW-SKU-L').ref, refs['L2-VIEW-SKU-L']);
  const visible = validateFixtureVisibleSkuReadback(
    fixture.objects,
    fixtureItem,
    [
      {skuCode: 'L2-VIEW-SKU-S', productSkuRef: refs['L2-VIEW-SKU-S'], version: 1},
      {skuCode: 'L2-VIEW-SKU-M', productSkuRef: refs['L2-VIEW-SKU-M'], version: 1},
    ],
    'fixture-view-final',
  );
  assert.deepEqual(
    visible.map(entry => entry.sku.skuCode),
    ['L2-VIEW-SKU-S', 'L2-VIEW-SKU-M'],
  );
  assert.throws(
    () =>
      validateFixtureVisibleSkuReadback(
        fixture.objects,
        fixtureItem,
        [
          {skuCode: 'L2-VIEW-SKU-S', productSkuRef: refs['L2-VIEW-SKU-S'], version: 1},
          {skuCode: 'L2-VIEW-SKU-M', productSkuRef: refs['L2-VIEW-SKU-M'], version: 1},
          {skuCode: 'L2-VIEW-SKU-L', productSkuRef: refs['L2-VIEW-SKU-L'], version: 2},
        ],
        'fixture-view-final',
      ),
    error => error.code === 'L2_OWNER_ITEM_SKU_READBACK_INVALID',
  );
});

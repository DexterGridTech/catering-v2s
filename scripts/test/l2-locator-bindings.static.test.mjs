import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const proofPath = 'scripts/test/l2-locator-bindings.static.test.mjs';
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readSource = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const catalogCandidate = readJson('contracts/policy/catalog-inventory-l2-activation-candidate.json');
const catalogScenarios = readJson('contracts/policy/catalog-inventory-l2-scenarios.json');
const catalogBindings = readJson('contracts/policy/catalog-inventory-l2-locator-bindings.json');
const salesBlueprint = readJson('contracts/policy/sales-menu-l2-case-blueprint.json');
const salesBindings = readJson('contracts/policy/sales-menu-l2-locator-bindings.json');
const salesCandidate = readJson('contracts/policy/sales-menu-l2-activation-candidate.json');
const salesScenarios = readJson('contracts/policy/sales-menu-l2-scenarios.json');
const operationsScopeSource = readSource('apps/frontend/operations-admin/src/tests/l2/operationsL2.ts');
const catalogSpecSource = readSource('apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts');
const catalogNetworkSource = readSource('apps/frontend/operations-admin/src/tests/l2/catalog-inventory-network.ts');
const salesSpecSource = readSource('apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts');
const salesNetworkSource = readSource('apps/frontend/operations-admin/src/tests/l2/sales-menu-network.ts');
const generatedOperationIds = new Set(
  [
    'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json',
    'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json',
  ].flatMap(relativePath => readJson(relativePath).operations.map(operation => operation.operationId)),
);

const expectedActionNodes = Object.freeze({
  STORE_SCOPE: 'SCOPE_TRIGGER_SELECTOR_OPTION_CONFIRM',
  HEAD_COMPANY_SCOPE: 'SCOPE_TRIGGER_SELECTOR_OPTION_CONFIRM',
  CATALOG_TREE_CATEGORY_NODE: 'TREE_TITLE',
  CATALOG_TREE_CATEGORY_EXPANDER: 'TREE_SWITCHER_ICON',
  CATALOG_TREE_PRODUCTION_TAG_NODE: 'TREE_TITLE',
  CATALOG_VIEW_SWITCH: 'COMPOSITE_OPTION_ANCHOR',
  CATALOG_BASIC_TAB: 'TAB_LABEL_ANCHOR',
  CATALOG_SKU_TAB: 'TAB_LABEL_ANCHOR',
  CATALOG_ORDER_OPTIONS_TAB: 'TAB_LABEL_ANCHOR',
  CATALOG_PRODUCTION_PROMPTS_TAB: 'TAB_LABEL_ANCHOR',
  CATALOG_INVENTORY_BOM_TAB: 'TAB_LABEL_ANCHOR',
  CATALOG_DICTIONARY_OPEN_CREATE: 'BUTTON',
  CATALOG_PAGINATION: 'PAGINATION_CONTROL_GROUP',
  CATALOG_PAGINATION_NEXT: 'PAGINATION_BUTTON',
  CATALOG_PAGINATION_PREVIOUS: 'PAGINATION_BUTTON',
  INVENTORY_STOCK_VIEW: 'COMPOSITE_OPTION_ANCHOR',
  INVENTORY_ACTION_DIRECTION: 'RADIO_OPTION_ANCHOR',
  CATALOG_BATCH_STATUS_ACTION: 'MENU_ITEM',
  STORE_SCOPE_TRIGGER: 'SCOPE_TRIGGER',
  STORE_SCOPE_HEAD_COMPANY_SELECTOR: 'SELECT_INPUT',
  STORE_SCOPE_HEAD_COMPANY_OPTION: 'SELECT_OPTION',
  STORE_SCOPE_REGION_SELECTOR: 'SELECT_INPUT',
  STORE_SCOPE_REGION_OPTION: 'SELECT_OPTION',
  STORE_SCOPE_PROJECT_SELECTOR: 'SELECT_INPUT',
  STORE_SCOPE_PROJECT_OPTION: 'SELECT_OPTION',
  STORE_SCOPE_STORE_SELECTOR: 'SELECT_INPUT',
  STORE_SCOPE_STORE_OPTION: 'SELECT_OPTION',
  STORE_SCOPE_CONFIRM: 'BUTTON',
  SALES_MENU_CHANNEL_SELECTOR: 'SELECT_TRIGGER_AND_OPTION_ROOT',
  SALES_MENU_MODE: 'VISIBLE_SEGMENTED_OPTION_LABEL',
  SALES_MENU_SELECTOR: 'NATIVE_SELECT_INPUT_AND_OPTION_ROOT',
  SALES_MENU_ITEM_MIN_QUANTITY: 'INPUT_NUMBER',
  SALES_MENU_ITEM_QUANTITY_STEP: 'INPUT_NUMBER',
  SALES_MENU_ITEM_DETAIL_MEDIA_CHOICE: 'NATIVE_BUTTON',
});

const salesStoreScopeControlKeys = Object.freeze(['STORE_SCOPE_TRIGGER']);
const salesProjectScopeControlKeys = Object.freeze(['STORE_SCOPE_TRIGGER']);

function interactionSource(binding) {
  return binding.sourceFiles.map(readSource).join('\n');
}

function assertFocusedProof(controlKey, binding) {
  assert.equal(typeof binding.actualActionNode, 'string', `L2_ACTION_NODE_MISSING:${controlKey}`);
  assert.equal(binding.actualActionNode, expectedActionNodes[controlKey], `L2_ACTION_NODE_MISMATCH:${controlKey}`);
  assert.equal(typeof binding.focusedStaticProof, 'string', `L2_STATIC_PROOF_MISSING:${controlKey}`);
  assert.ok(fs.existsSync(path.join(root, binding.focusedStaticProof)), `L2_STATIC_PROOF_NOT_FOUND:${controlKey}`);
}

function assertActionNodeSource(controlKey, binding, source) {
  const has = marker => assert.ok(source.includes(marker), `L2_ACTION_NODE_SOURCE_MISSING:${controlKey}:${marker}`);
  if (controlKey === 'STORE_SCOPE' || controlKey === 'HEAD_COMPANY_SCOPE') {
    has('roleHomeTestIds.dataScope');
    return;
  }
  if (controlKey.startsWith('CATALOG_TREE_')) {
    has('CatalogTreeLine');
    if (controlKey.endsWith('EXPANDER')) has('switcherIcon:');
    if (binding.actualActionNode === 'TREE_TITLE') {
      assert.ok(
        catalogSpecSource.includes('ant-tree-node-content-wrapper'),
        `L2_TREE_TITLE_ACTION_LOCATOR_MISSING:${controlKey}`,
      );
    }
    return;
  }
  if (controlKey === 'CATALOG_VIEW_SWITCH' || controlKey === 'INVENTORY_STOCK_VIEW') {
    has('<Segmented');
    return;
  }
  if (controlKey.endsWith('_TAB')) {
    has('data-active={activeTab === tab.tabKey');
    return;
  }
  if (controlKey === 'CATALOG_DICTIONARY_OPEN_CREATE') {
    has('<Button');
    has('dictionaryOpenCreate');
    return;
  }
  if (controlKey === 'CATALOG_PAGINATION') {
    has('<CursorPagination');
    has('testIdPrefix');
    return;
  }
  if (controlKey === 'CATALOG_PAGINATION_NEXT' || controlKey === 'CATALOG_PAGINATION_PREVIOUS') {
    has('<CursorPagination');
    has(controlKey.endsWith('NEXT') ? '`${testIdPrefix}-next`' : '`${testIdPrefix}-previous`');
    return;
  }
  if (controlKey === 'INVENTORY_ACTION_DIRECTION') {
    has('<Radio value="INCREASE"');
    has('inventoryActionDirectionTestId');
    return;
  }
  if (controlKey === 'CATALOG_BATCH_STATUS_ACTION') {
    has("key: 'STATUS'");
    has('batchStatusAction');
    return;
  }
  if (controlKey.startsWith('STORE_SCOPE_')) {
    has('DataScopeSelector');
    if (controlKey.endsWith('_OPTION')) has('roleHomeTestIds.dataScope.option');
    return;
  }
  if (controlKey === 'SALES_MENU_CHANNEL_SELECTOR') {
    has('<Select');
    has('channelSelector');
    return;
  }
  if (controlKey === 'SALES_MENU_MODE') {
    has('<Segmented');
    has('salesMenuTestIds.mode');
    return;
  }
  if (controlKey === 'SALES_MENU_SELECTOR') {
    has('components={{input: SalesMenuSelectorInput}}');
    has('salesMenuTestIds.menuSelector');
    return;
  }
  if (controlKey === 'SALES_MENU_ITEM_MIN_QUANTITY' || controlKey === 'SALES_MENU_ITEM_QUANTITY_STEP') {
    has('<InputNumber');
    has(binding.testId);
    return;
  }
  if (controlKey === 'SALES_MENU_ITEM_DETAIL_MEDIA_CHOICE') {
    has('<button');
    has('itemDetailMediaChoice');
    return;
  }
  throw new Error(`L2_ACTION_NODE_PROOF_RULE_MISSING:${controlKey}`);
}

function assertInteractionBinding(controlKey, binding) {
  assertFocusedProof(controlKey, binding);
  assertActionNodeSource(controlKey, binding, interactionSource(binding));
}

test('catalog and sales L2 interaction bindings have one explicit action node and focused proof', () => {
  const catalogInteractions = Object.entries(catalogBindings.controls).filter(([, binding]) => binding.interaction);
  assert.deepEqual(salesBindings.controls, salesBlueprint.bindings.controls);
  const salesInteractions = Object.entries(salesBindings.controls).filter(([, binding]) => binding.interaction);
  assert.equal(catalogInteractions.length, 18);
  assert.equal(salesInteractions.length, 16);
  for (const [controlKey, binding] of [...catalogInteractions, ...salesInteractions])
    assertInteractionBinding(controlKey, binding);
});

test('scope join keeps the phase and type, while cancellation stays outside the active L2 denominator', () => {
  assert.match(operationsScopeSource, /phase: 'TRIGGER', type\}/);
  assert.match(catalogSpecSource, /scopePhase: touch\.phase/);
  assert.match(catalogSpecSource, /scopeType: touch\.type/);
  assert.deepEqual(catalogBindings.controls.STORE_SCOPE.touchPhases, ['TRIGGER', 'SELECTOR', 'OPTION', 'CONFIRM']);
  assert.deepEqual(catalogBindings.controls.HEAD_COMPANY_SCOPE.touchPhases, [
    'TRIGGER',
    'SELECTOR',
    'OPTION',
    'CONFIRM',
  ]);
  assert.equal(Object.hasOwn(salesBlueprint.bindings.controls, 'STORE_SCOPE_CANCEL'), false);
  assert.match(salesSpecSource, /SALES_MENU_L2_SCOPE_CANCEL_NOT_IN_ACTIVE_DENOMINATOR/);
});

test('the action-node proof is red under a real source mutation', () => {
  const binding = catalogBindings.controls.CATALOG_BATCH_STATUS_ACTION;
  const source = interactionSource(binding);
  const mutated = source.replaceAll('batchStatusAction', '');
  assert.throws(() => assertActionNodeSource('CATALOG_BATCH_STATUS_ACTION', binding, mutated));
});

test('active L2 cases keep shared page reads and declared controls in one denominator', () => {
  const catalogCases = new Map(
    catalogScenarios.scenarios.flatMap(scenario => scenario.cases).map(row => [row.caseId, row]),
  );
  assert.equal(catalogCandidate.approvedCaseIds.length, 24);
  for (const caseId of catalogCandidate.approvedCaseIds) {
    const row = catalogCases.get(caseId);
    assert.ok(row, `L2_CATALOG_ACTIVE_CASE_MISSING:${caseId}`);
    for (const controlKey of row.parameter.controlKeys)
      assert.ok(catalogBindings.controls[controlKey], `L2_CATALOG_ACTIVE_CONTROL_UNBOUND:${caseId}:${controlKey}`);
    assert.ok(row.parameter.controlKeys.includes('STORE_SCOPE'), `L2_CATALOG_SCOPE_TOUCH_UNDECLARED:${caseId}`);
    assert.ok(row.parameter.controlKeys.includes('CATALOG_STORE_ROUTE'), `L2_CATALOG_ROUTE_TOUCH_UNDECLARED:${caseId}`);
    const operatingRule = row.parameter.network.requests.find(
      request => request.operationId === 'getOperationsOrganizationStoreOperatingRule',
    );
    assert.deepEqual(operatingRule, {
      operationId: 'getOperationsOrganizationStoreOperatingRule',
      maxRequestCount: ['catalog-view-failure', 'catalog-view-recovery'].includes(caseId) ? 2 : 1,
    });
  }
  assert.equal(catalogCases.get('catalog-view-success').parameter.controlKeys.includes('CATALOG_ITEM_EDIT'), false);
  assert.deepEqual(catalogCases.get('catalog-governance-failure').parameter.network.forbidden, [
    'transitionOperationsCatalogItemStatus',
  ]);
  assert.equal(
    catalogCases
      .get('catalog-governance-failure')
      .parameter.network.required.includes('transitionOperationsCatalogItemStatus'),
    false,
  );
  assert.ok(
    catalogCases.get('catalog-create-recovery').parameter.controlKeys.includes('CATALOG_CREATE_SHAPE'),
    'L2_CATALOG_CREATE_RECOVERY_SHAPE_CONTROL_MISSING',
  );
  for (const caseId of ['catalog-batch-success', 'catalog-batch-failure', 'catalog-batch-recovery']) {
    const controls = catalogCases.get(caseId).parameter.controlKeys;
    assert.ok(controls.includes('CATALOG_BATCH_SUBMIT'), `L2_CATALOG_BATCH_SUBMIT_CONTROL_MISSING:${caseId}`);
    assert.ok(controls.includes('CATALOG_BATCH_STATUS_CONFIRM'), `L2_CATALOG_BATCH_CONFIRM_CONTROL_MISSING:${caseId}`);
  }
  assert.match(catalogSpecSource, /function visibleModalDialogByTestId\(/u);
  assert.match(catalogSpecSource, /visibleModalDialogByTestId\(page, catalogTestIds\.static\.dictionaryCreateModal\)/u);
  assert.match(catalogSpecSource, /assertCatalogL2NetworkClosure\(/u);
  assert.match(catalogSpecSource, /expectedFailureOperationIds/u);

  const salesCases = new Map(
    salesScenarios.scenarios.flatMap(scenario => scenario.cases).map(row => [row.caseId, row]),
  );
  assert.equal(salesCandidate.approvedCaseIds.length, 20);
  assert.equal(salesCandidate.approvedCaseIds.length, salesScenarios.caseCount);
  for (const caseId of salesCandidate.approvedCaseIds) {
    const row = salesCases.get(caseId);
    assert.ok(row, `L2_SALES_ACTIVE_CASE_MISSING:${caseId}`);
    for (const controlKey of row.parameter.controlKeys)
      assert.ok(salesBindings.controls[controlKey], `L2_SALES_ACTIVE_CONTROL_UNBOUND:${caseId}:${controlKey}`);
    const operatingRule = row.parameter.network.requests.find(
      request => request.operationId === 'getOperationsOrganizationStoreOperatingRule',
    );
    if (caseId === 'business-channel-external-dine-in-template') {
      assert.equal(operatingRule, undefined);
      assert.equal(row.parameter.network.required.includes('getOperationsOrganizationStoreOperatingRule'), false);
    } else {
      const expectedOperatingRuleRequestCount = row.parameter.controlKeys.includes('BUSINESS_CHANNEL_STORE_PAGE')
        ? 2
        : 1;
      assert.deepEqual(operatingRule, {
        operationId: 'getOperationsOrganizationStoreOperatingRule',
        maxRequestCount: expectedOperatingRuleRequestCount,
      });
      assert.ok(row.parameter.network.required.includes('getOperationsOrganizationStoreOperatingRule'));
    }
    const expectedScopeControls =
      caseId === 'business-channel-external-dine-in-template'
        ? salesProjectScopeControlKeys
        : salesStoreScopeControlKeys;
    assert.deepEqual(
      expectedScopeControls.filter(controlKey => row.parameter.controlKeys.includes(controlKey)),
      expectedScopeControls,
      `L2_SALES_SCOPE_CONTROL_DENOMINATOR_INCOMPLETE:${caseId}`,
    );
    assert.deepEqual(
      row.parameter.controlKeys.filter(controlKey => controlKey.startsWith('STORE_SCOPE_')),
      expectedScopeControls,
      `L2_SALES_SCOPE_CONTROL_DENOMINATOR_HAS_UNREACHABLE_TOUCH:${caseId}`,
    );
  }
});

test('catalog L2 rejects undeclared user touches and isolates fixture mutations', () => {
  assert.match(catalogSpecSource, /CATALOG_INVENTORY_L2_CONTROL_TOUCH_UNDECLARED/);
  assert.match(catalogSpecSource, /fixtureMutationActive = true/);
  assert.match(catalogSpecSource, /if \(fixtureMutationActive\) return/);
  const viewSuccess =
    catalogSpecSource.match(/case 'catalog-view-success':[\s\S]*?case 'catalog-view-failure':/u)?.[0] ?? '';
  assert.ok(viewSuccess.length > 0, 'L2_CATALOG_VIEW_SUCCESS_BRANCH_MISSING');
  assert.equal(viewSuccess.includes("'CATALOG_ITEM_EDIT'"), false);
});

test('active L2 scripts close the declared control/action denominator and keep catalog locators vocabulary-bound', () => {
  const catalogClosureMarkers = [
    'assertControlTouchClosure(row);',
    'CATALOG_INVENTORY_L2_DECLARED_CONTROL_TOUCH_MISSING',
    'CATALOG_INVENTORY_L2_DECLARED_ACTION_TOUCH_MISSING',
  ];
  const catalogNetworkClosureMarkers = [
    'assertCatalogL2NetworkClosure(',
    'CATALOG_INVENTORY_L2_REQUIRED_OPERATION_NON_SUCCESS',
    'CATALOG_INVENTORY_L2_FORBIDDEN_OPERATION_OBSERVED',
    'CATALOG_INVENTORY_L2_EXPECTED_FAILURE_STATUS_MISSING',
    'CATALOG_INVENTORY_L2_UNDECLARED_OPERATION_OBSERVED',
    'CATALOG_INVENTORY_L2_OPERATION_REQUEST_BUDGET_EXCEEDED',
  ];
  const salesClosureMarkers = [
    'assertControlTouchClosure(runtime);',
    'SALES_MENU_L2_DECLARED_CONTROL_TOUCH_MISSING',
    'SALES_MENU_L2_DECLARED_ACTION_TOUCH_MISSING',
    'assertSalesMenuL2NetworkClosure(',
  ];
  for (const marker of catalogClosureMarkers)
    assert.match(catalogSpecSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const marker of catalogNetworkClosureMarkers)
    assert.match(
      marker === 'assertCatalogL2NetworkClosure(' ? catalogSpecSource : catalogNetworkSource,
      new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  for (const marker of salesClosureMarkers)
    assert.match(
      marker === 'assertSalesMenuL2NetworkClosure(' ? salesSpecSource : salesSpecSource,
      new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  for (const marker of [
    'SALES_MENU_L2_FORBIDDEN_OPERATION_OBSERVED',
    'SALES_MENU_L2_UNDECLARED_OPERATION_OBSERVED',
    'SALES_MENU_L2_REQUIRED_OPERATION_NON_SUCCESS',
    'SALES_MENU_L2_EXPECTED_FAILURE_STATUS_MISSING',
    'SALES_MENU_L2_OPERATION_REQUEST_BUDGET_EXCEEDED',
  ])
    assert.match(salesNetworkSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(catalogSpecSource, /getByTestId\(\s*['"]catalog-/u);
  assert.doesNotMatch(catalogSpecSource, /visibleTestId\(\s*page\s*,\s*['"]catalog-/u);
  assert.match(catalogSpecSource, /selectBoundCatalogOption\(/u);
  assert.match(catalogSpecSource, /createShapeKey/u);

  const closureMutation = catalogSpecSource.replace('assertControlTouchClosure(row);', '');
  assert.doesNotMatch(closureMutation, /assertControlTouchClosure\(row\);/u);
  const networkClosureMutation = catalogSpecSource.replace(
    /assertCatalogL2NetworkClosure\(\s*row,\s*operationObservations,/u,
    '',
  );
  assert.doesNotMatch(networkClosureMutation, /assertCatalogL2NetworkClosure\(\s*row,\s*operationObservations,/u);
});

test('L2 network read declarations resolve to generated owner operation identities', () => {
  for (const contract of [catalogScenarios, salesScenarios]) {
    for (const scenario of contract.scenarios) {
      for (const row of scenario.cases) {
        const network = row.parameter.network ?? {};
        const declared = [
          ...(row.parameter.operationIds ?? []),
          ...(network.required ?? []),
          ...(network.forbidden ?? []),
          ...(network.backgroundAllowed ?? []),
          ...(network.requests ?? []).map(request => request.operationId),
        ];
        for (const operationId of new Set(declared))
          assert.ok(generatedOperationIds.has(operationId), `L2_OPERATION_NOT_GENERATED:${row.caseId}:${operationId}`);
      }
    }
  }
});

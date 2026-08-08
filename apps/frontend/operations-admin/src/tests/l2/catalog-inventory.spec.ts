import {expect, test, type Page} from '@playwright/test';
import {appendFileSync, mkdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {selectOperationsDataScope} from './operationsL2';

type LocatorBinding = {
  caseId: string;
  scenarioId: string;
  locator: string;
  position: string;
  wireframe: string;
  fixtureRef: string;
  expectedBusinessResult: string;
  activation: string;
};
type CatalogCaseContext = {loginEnv: string; scope: 'STORE' | 'HEAD_COMPANY'; route: string; storeEnv?: string};
type RuntimeFixtureBinding = {catalogItemCodes?: string[]; primaryCatalogItemCode?: string; primaryTargetRef?: string; primaryTargetProductCode?: string; productionTagCodes?: string[]; primaryProductionTagCode?: string};

const locatorPolicy = JSON.parse(readFileSync(new URL('../../../../../../contracts/policy/catalog-inventory-l2-locator-bindings.json', import.meta.url), 'utf8')) as {bindings: LocatorBinding[]};
const bindingsByCase = new Map(locatorPolicy.bindings.map((binding) => [binding.caseId, binding]));
let completedL2Cases = 0;
const l2ProgressPath = process.env.V2S_RUNTIME_DIR ? path.join(process.env.V2S_RUNTIME_DIR, 'evidence', 'catalog-inventory-l2-progress.log') : undefined;
if (l2ProgressPath) {
  try {
    completedL2Cases = readFileSync(l2ProgressPath, 'utf8').split('\n').filter((line) => /CATALOG_L2_PROGRESS .* status=(PASS|FAIL|TIMED_OUT)$/.test(line)).length;
  } catch {
    completedL2Cases = 0;
  }
}
function emitL2Progress(status: 'START' | 'PASS' | 'FAIL' | 'TIMED_OUT', caseId: string) {
  const line = 'CATALOG_L2_PROGRESS completed=' + completedL2Cases + '/' + locatorPolicy.bindings.length + ' current=' + caseId + ' status=' + status;
  process.stdout.write(line + '\n');
  if (l2ProgressPath) {
    mkdirSync(path.dirname(l2ProgressPath), {recursive: true});
    appendFileSync(l2ProgressPath, new Date().toISOString() + ' ' + line + '\n', {mode: 0o600});
  }
}
test.beforeEach(async ({}, testInfo) => {
  emitL2Progress('START', testInfo.title);
});
test.afterEach(async ({}, testInfo) => {
  completedL2Cases += 1;
  const status = testInfo.status === 'passed' ? 'PASS' : testInfo.status === 'timedOut' ? 'TIMED_OUT' : 'FAIL';
  emitL2Progress(status, testInfo.title);
});

function runtimeFixtureBindings(): Record<string, RuntimeFixtureBinding> {
  const runtime = process.env.V2S_RUNTIME_DIR;
  if (!runtime) return {};
  try {
    // L2 is a frontend-visible behavior test.  Its fixture report is the only
    // runtime input it may consume; the API acceptance report and any seed
    // report are deliberately outside this test's data boundary.
    const l2Report = JSON.parse(readFileSync(`${runtime}/results/catalog-inventory-l2-test-fixture.json`, 'utf8')) as {runId?: string; status?: string; l2FixtureBindings?: Record<string, RuntimeFixtureBinding>};
    if (l2Report.status !== 'PASS') throw new Error('CATALOG_INVENTORY_L2_FIXTURE_NOT_PASS');
    const l2FixtureBindings = l2Report.l2FixtureBindings ?? {};
    const isolatedInventoryFixtures = ['FIXTURE-ADVANCED-DIAGNOSTICS', 'FIXTURE-INVENTORY-NEGATIVE', 'FIXTURE-COUNT-INCREASE-ADJUST', 'FIXTURE-CONFIG-ONLY'];
    for (const fixtureRef of isolatedInventoryFixtures) {
      if (!l2FixtureBindings[fixtureRef]?.primaryTargetRef || !l2FixtureBindings[fixtureRef]?.primaryTargetProductCode) {
        throw new Error(`CATALOG_INVENTORY_L2_ISOLATION_BINDING_MISSING:${fixtureRef}`);
      }
    }
    return l2FixtureBindings;
  } catch (error) {
    throw new Error(`CATALOG_INVENTORY_L2_FIXTURE_BINDINGS_REQUIRED:${String(error)}`);
  }
}

const fixtureBindings = runtimeFixtureBindings();
function fixtureBinding(fixtureRef: string): RuntimeFixtureBinding {
  const binding = fixtureBindings[fixtureRef];
  if (!binding) throw new Error(`CATALOG_INVENTORY_FIXTURE_BINDING_MISSING:${fixtureRef}`);
  return binding;
}

function requiredL2Env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function catalogCaseContext(binding: LocatorBinding): CatalogCaseContext {
  const variant = Number(binding.caseId.split('-').at(-1) ?? 1);
  if (binding.scenarioId === 'CI-L2-001') {
    const matrix = [
      {loginEnv: 'R5_L2_GROUP_LOGIN_NAME', scope: 'STORE' as const, route: 'catalog/store-items'},
      {loginEnv: 'R5_L2_CATALOG_REGION_LOGIN_NAME', scope: 'STORE' as const, route: 'catalog/store-items'},
      {loginEnv: 'R5_L2_CATALOG_PROJECT_LOGIN_NAME', scope: 'STORE' as const, route: 'catalog/store-items'},
      {loginEnv: 'R5_L2_CATALOG_STORE_LOGIN_NAME', scope: 'STORE' as const, route: 'catalog/store-items'},
      {loginEnv: 'R5_L2_GROUP_LOGIN_NAME', scope: 'HEAD_COMPANY' as const, route: 'catalog/brand-items'},
      {loginEnv: 'R5_L2_CATALOG_HEAD_COMPANY_LOGIN_NAME', scope: 'HEAD_COMPANY' as const, route: 'catalog/brand-items'},
    ];
    return matrix[variant - 1] ?? matrix[0];
  }
  if (binding.scenarioId === 'CI-L2-003') return {loginEnv: 'R5_L2_CATALOG_HEAD_COMPANY_LOGIN_NAME', scope: 'HEAD_COMPANY' as const, route: 'catalog/brand-items'};
  if (binding.scenarioId === 'CI-L2-005') {
    const matrix = [
      {loginEnv: 'R5_L2_GROUP_LOGIN_NAME', scope: 'STORE' as const, storeEnv: 'R5_L2_MISSING_HEAD_COMPANY_STORE_NAME'},
      {loginEnv: 'R5_L2_GROUP_LOGIN_NAME', scope: 'STORE' as const, storeEnv: 'R5_L2_OPERATIONS_SCOPE_STORE_NAME'},
      {loginEnv: 'R5_L2_CATALOG_READONLY_GROUP_LOGIN_NAME', scope: 'STORE' as const, storeEnv: 'R5_L2_OPERATIONS_SCOPE_STORE_NAME'},
      {loginEnv: 'R5_L2_CATALOG_READONLY_GROUP_LOGIN_NAME', scope: 'STORE' as const, storeEnv: 'R5_L2_MISSING_HEAD_COMPANY_STORE_NAME'},
    ];
    return {...(matrix[variant - 1] ?? matrix[0]), route: 'catalog/store-items'};
  }
  if (binding.scenarioId === 'CI-L2-013' && variant === 2) return {loginEnv: 'R5_L2_CATALOG_READONLY_GROUP_LOGIN_NAME', scope: 'STORE' as const, route: 'inventory/status'};
  if (/^CI-L2-(012|013|014)$/.test(binding.scenarioId)) return {loginEnv: 'R5_L2_CATALOG_STORE_LOGIN_NAME', scope: 'STORE' as const, route: 'inventory/status'};
  return {loginEnv: 'R5_L2_CATALOG_STORE_LOGIN_NAME', scope: 'STORE' as const, route: 'catalog/store-items'};
}

function routeForScenario(binding: LocatorBinding) {
  const rootRoute = requiredL2Env('R5_L2_STORE_ROUTE');
  return rootRoute.replace(/organization\/stores$/, catalogCaseContext(binding).route);
}

async function signInOperations(page: Page, binding: LocatorBinding) {
  await page.goto(requiredL2Env('R5_L2_OPERATIONS_LOGIN_ROUTE'));
  const loginName = requiredL2Env(catalogCaseContext(binding).loginEnv);
  await page.getByTestId('operations-login-name').fill(loginName);
  await page.getByTestId('operations-login-password').fill(requiredL2Env('R5_L2_OPERATIONS_LOGIN_PASSWORD'));
  await page.getByTestId('operations-login-submit').click();
  await page.getByTestId('operations-shell-menu').waitFor({state: 'visible'});
}

async function selectCatalogScope(page: Page, binding: LocatorBinding) {
  const context = catalogCaseContext(binding);
  if (context.scope === 'HEAD_COMPANY') {
    await selectOperationsDataScope(page, 'HEAD_COMPANY', {
      headCompanyName: requiredL2Env('R5_L2_HEAD_COMPANY_NAME'),
    });
    return;
  }
  await selectOperationsDataScope(page, 'STORE', {
    regionName: requiredL2Env('R5_L2_ORGANIZATION_REGION_NAME'),
    projectName: requiredL2Env('R5_L2_OPERATIONS_SCOPE_PROJECT_NAME'),
    storeName: requiredL2Env(context.storeEnv ?? 'R5_L2_OPERATIONS_SCOPE_STORE_NAME'),
  });
}

async function openCatalogItemByCode(page: Page, fixtureRef: string, options: {simulateDetailFailure?: boolean} = {}) {
  const code = fixtureBinding(fixtureRef).primaryCatalogItemCode;
  if (!code) throw new Error(`CATALOG_INVENTORY_FIXTURE_ITEM_CODE_MISSING:${fixtureRef}`);
  const search = page.getByTestId('catalog-inventory-local-search');
  await expect(search).toBeVisible();
  const searchInput = search.locator('input');
  await searchInput.fill(code);
  await searchInput.press('Enter');
  const item = page.getByTestId(`catalog-inventory-open-item-${code}`);
  await expect(item).toHaveCount(1);
  const detailRoute = '**/api/operations/catalog-inventory/items/**';
  let shouldFailDetail = options.simulateDetailFailure === true;
  if (shouldFailDetail) {
    await page.route(detailRoute, async (route) => {
      const url = new URL(route.request().url());
      const detailPath = `/api/operations/catalog-inventory/items/${encodeURIComponent(code)}`;
      if (shouldFailDetail && route.request().method() === 'GET' && url.pathname === detailPath) {
        shouldFailDetail = false;
        await route.abort('failed');
        return;
      }
      await route.continue();
    });
  }
  await item.click();
  await expect(page.getByTestId('catalog-inventory-item-drawer')).toBeVisible();
  return {detailRoute, disableDetailFailure: async () => { if (options.simulateDetailFailure) await page.unroute(detailRoute); }};
}

async function openInventoryTargetByFixture(page: Page, fixtureRef: string) {
  const binding = fixtureBinding(fixtureRef);
  const productCode = binding.primaryTargetProductCode;
  if (!productCode) throw new Error(`CATALOG_INVENTORY_FIXTURE_TARGET_CODE_MISSING:${fixtureRef}`);
  const search = page.getByTestId('inventory-filter-keyword');
  await expect(search).toBeVisible();
  await search.fill(productCode);
  await page.getByTestId('inventory-filter-submit').click();
  // The target ref is an owner identity, not a user-visible business key. The
  // list deliberately renders the product name/code as the interaction
  // affordance, so bind this journey to the visible product code instead of
  // assuming a generated DOM id can carry the ref through ProTable.
  const target = page.getByRole('button', {name: new RegExp(escapeRegExp(productCode))});
  await expect(target).toHaveCount(1);
  await target.click();
  await expect(page.getByTestId('inventory-target-drawer')).toBeVisible();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function assertBoundControl(page: Page, binding: LocatorBinding) {
  const locator = page.getByTestId(binding.locator);
  await expect(locator, `${binding.caseId} bound control`).toBeVisible();
}

async function assertBrandCopyWizardProgression(page: Page, fixtureRef: string) {
  // Prove the state transitions, not just the existence of the final tab.
  const code = fixtureBinding(fixtureRef).primaryCatalogItemCode;
  if (!code) throw new Error(`CATALOG_INVENTORY_FIXTURE_COPY_CODE_MISSING:${fixtureRef}`);
  const candidate = page.getByTestId(`catalog-copy-candidate-${code}`);
  await expect(candidate).toHaveCount(1);
  await candidate.click();
  const selectionNext = page.getByTestId('catalog-brand-copy-selection-next');
  await expect(selectionNext).toBeEnabled();
  await selectionNext.click();
  const preflightButton = page.getByTestId('catalog-copy-preflight');
  await expect(preflightButton).toBeVisible();
  await preflightButton.click();
  await expect(page.getByTestId('catalog-inventory-copy-preflight')).toBeVisible();
  await expect(page.getByTestId('catalog-brand-copy-preflight-next')).toHaveCount(1);
  for (const label of ['商品与结构', '字典与映射', '库存与BOM', '生产提示', '引用重写']) {
    await expect(page.getByText(label, {exact: true})).toBeVisible();
  }
}

async function assertInventoryActionState(page: Page, caseId: string) {
  const successfulReadback = caseId.endsWith('-02');
  const actionId = successfulReadback ? 'inventory-action-increase' : 'inventory-action-adjust';
  await expect(page.getByTestId(actionId)).toHaveCount(1);
  await page.getByTestId(actionId).click();
  await expect(page.getByTestId('inventory-action-submit')).toBeVisible();
  // AntD InputNumber forwards the stable test id to its native input.
  const quantity = page.getByTestId('inventory-action-quantity');
  // AntD InputNumber forwards data-testid to its native input. It does not
  // render another input below that locator, so fill the test id directly.
  await page.getByTestId('inventory-action-quantity').fill('1');
  if (successfulReadback) {
    await page.getByTestId('inventory-action-note').fill('L2 readback proof');
    await expect(page.getByTestId('inventory-action-submit')).toBeEnabled();
    await page.getByTestId('inventory-action-submit').click();
    const result = page.getByTestId('inventory-action-result');
    await expect(result).toBeVisible();
    for (const label of ['变更前', '变更量', '变更后', '流水号']) await expect(result).toContainText(label);
    await expect(page.getByTestId('inventory-action-result-close')).toBeVisible();
  } else {
    await page.getByTestId('inventory-action-direction').getByLabel('减少').check();
    await page.getByTestId('inventory-action-reason').click();
    await page.getByText('盘点纠正', {exact: true}).click();
    await page.getByTestId('inventory-action-note').fill('L2 negative guard proof');
    await expect(page.getByTestId('inventory-action-negative-preview')).toBeVisible();
    await expect(page.getByTestId('inventory-action-submit')).toBeDisabled();
    // InputNumber renders the canonical three-decimal display ("1.000").
    // Assert the business quantity, not a presentation-specific string.
    expect(Number(await quantity.inputValue())).toBe(1);
  }
}

async function assertTemporaryPromotionFailurePreservesInput(page: Page) {
  // The L2 fixture owns a run-scoped temporary code; do not assume a seed code
  // or read another layer's report to discover it.
  const temporaryCode = fixtureBinding('FIXTURE-TEMPORARY-ITEM').primaryCatalogItemCode;
  const formalCodeValue = fixtureBinding('SEED-LATTE').primaryCatalogItemCode;
  if (!temporaryCode || !formalCodeValue) throw new Error('CATALOG_INVENTORY_TEMPORARY_BINDING_MISSING');
  const search = page.getByTestId('catalog-inventory-local-search');
  await expect(search).toBeVisible();
  const searchInput = search.locator('input');
  await searchInput.fill(temporaryCode);
  await searchInput.press('Enter');
  const temporaryItem = page.getByTestId(`catalog-inventory-open-item-${temporaryCode}`);
  await expect(temporaryItem).toBeVisible();
  await temporaryItem.click();
  await expect(page.getByTestId('catalog-inventory-item-drawer')).toBeVisible();
  await page.getByTestId('catalog-item-temporary-promotion').click();
  const promotionPreflight = page.getByRole('dialog', {name: '外部订单临时商品转正预检'});
  await expect(promotionPreflight).toBeVisible();
  const formalCode = promotionPreflight.getByTestId('catalog-temporary-promotion-formal-code');
  await formalCode.fill(formalCodeValue);
  await page.getByTestId('catalog-temporary-promotion-name').fill('外部订单临时拿铁-治理');
  await page.getByTestId('catalog-temporary-promotion-re-preflight').click();
  await expect(page.locator('[data-testid="catalog-temporary-promotion-problem"], [data-testid="catalog-temporary-promotion-blocked"]')).toBeVisible();
  await expect(formalCode).toHaveValue(formalCodeValue);
}

test.describe('catalog and light-inventory L2 business scenarios', () => {
  for (const binding of locatorPolicy.bindings) {
    test(binding.caseId, async ({page}) => {
      test.info().annotations.push({type: 'fixtureRef', description: binding.fixtureRef});
      test.info().annotations.push({type: 'iaPosition', description: binding.position});
      test.info().annotations.push({type: 'iaWireframe', description: binding.wireframe});
      test.info().annotations.push({type: 'expectedBusinessResult', description: binding.expectedBusinessResult});
      await signInOperations(page, binding);
      await page.goto(routeForScenario(binding));
      // The management-range control is owned by the scoped page shell. Select
      // the range only after navigation; the post-login dashboard intentionally
      // has no scope trigger.
      await selectCatalogScope(page, binding);

      switch (binding.scenarioId) {
        case 'CI-L2-001': {
          const context = catalogCaseContext(binding);
          await expect(page.getByTestId(context.scope === 'HEAD_COMPANY' ? 'catalog-inventory-brand-page' : 'catalog-inventory-store-page')).toBeVisible();
          const shellMenu = page.getByTestId('operations-shell-menu');
          if (context.scope === 'HEAD_COMPANY') {
            await expect(shellMenu.getByText('品牌商品管理', {exact: true})).toBeVisible();
          } else {
            await expect(shellMenu.getByText('门店商品管理', {exact: true})).toBeVisible();
            await expect(shellMenu.getByText('门店库存管理', {exact: true})).toBeVisible();
            if (context.loginEnv.includes('GROUP')) await expect(shellMenu.getByText('品牌商品管理', {exact: true})).toBeVisible();
          }
          await assertBoundControl(page, binding);
          break;
        }
        case 'CI-L2-002':
          await expect(page.getByTestId('catalog-inventory-store-page')).toBeVisible();
          await expect(page.getByTestId('catalog-inventory-local-search')).toBeVisible();
          await assertBoundControl(page, binding);
          break;
        case 'CI-L2-003':
          await expect(page.getByTestId('catalog-inventory-brand-page')).toBeVisible();
          await expect(page.getByTestId('catalog-inventory-view-switch')).toBeVisible();
          await assertBoundControl(page, binding);
          break;
        case 'CI-L2-004':
        case 'CI-L2-016':
        case 'CI-L2-018':
          await expect(page.getByTestId('catalog-inventory-item-table')).toBeVisible();
          if (binding.scenarioId === 'CI-L2-018') {
            await expect(page.getByText('导入', {exact: true})).toHaveCount(0);
            await expect(page.getByText('导出', {exact: true})).toHaveCount(0);
          }
          await assertBoundControl(page, binding);
          break;
        case 'CI-L2-005':
          // The four cases are a truth-table, not four aliases: source fact and
          // write capability are varied independently.
          if (binding.caseId.endsWith('-02')) await expect(page.getByTestId(binding.locator)).toBeVisible();
          else await expect(page.getByTestId(binding.locator)).toHaveCount(0);
          break;
        case 'CI-L2-006':
        case 'CI-L2-007':
        case 'CI-L2-010':
        case 'CI-L2-011':
        case 'CI-L2-017':
          {
            const detailFailure = await openCatalogItemByCode(page, binding.fixtureRef, {simulateDetailFailure: true});
            const problem = page.getByTestId('catalog-item-problem');
            await expect(problem).toBeVisible();
            await expect(problem).toContainText('商品详情暂时无法获取，请重试。');
            await expect(problem).toBeFocused();
            await expect(page.getByTestId('catalog-item-problem-retry')).toBeVisible();
            await expect(page.getByTestId('catalog-inventory-item-drawer')).toBeVisible();
            await detailFailure.disableDetailFailure();
            await page.getByTestId('catalog-item-problem-retry').click();
            await expect(problem).toBeHidden();
            await expect(page.getByTestId('catalog-item-tabs')).toBeVisible();
          }
          break;
        case 'CI-L2-009':
          if (binding.caseId.endsWith('-01')) {
            await openCatalogItemByCode(page, binding.fixtureRef);
            await expect(page.getByTestId('catalog-item-source-auto_sync')).toBeVisible();
          } else {
            await assertTemporaryPromotionFailurePreservesInput(page);
          }
          await assertBoundControl(page, binding);
          break;
        case 'CI-L2-008':
          await openCatalogItemByCode(page, binding.fixtureRef);
          await page.getByTestId('catalog-item-edit').click();
          await expect(page.getByTestId('catalog-inventory-item-drawer')).toBeVisible();
          await page.getByRole('tab', {name: '生产提示'}).click();
          await expect(page.getByTestId('catalog-production-tag-quick-manage')).toBeVisible();
          await page.getByTestId('catalog-production-tag-quick-manage').click();
          await expect(page.getByTestId('catalog-production-tag-quick-manage-drawer')).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(page.getByTestId('catalog-production-tag-quick-manage-drawer')).toBeHidden();
          await page.keyboard.press('Escape');
          await expect(page.getByTestId('catalog-inventory-item-drawer')).toBeHidden();
          await page.getByTestId('catalog-inventory-dictionary').click();
          await expect(page.getByTestId('catalog-dictionary-tabs')).toBeVisible();
          await assertBoundControl(page, binding);
          break;
        case 'CI-L2-012':
          await expect(page.getByTestId('inventory-store-status-page')).toBeVisible();
          await expect(page.getByTestId('inventory-stock-view')).toBeVisible();
          await assertBoundControl(page, binding);
          break;
        case 'CI-L2-013':
          await openInventoryTargetByFixture(page, binding.fixtureRef);
          await assertBoundControl(page, binding);
          break;
        case 'CI-L2-014':
          await openInventoryTargetByFixture(page, binding.fixtureRef);
          for (const action of ['inventory-action-count', 'inventory-action-increase', 'inventory-action-adjust', 'inventory-action-configure']) {
            await expect(page.getByTestId(action)).toHaveCount(1);
          }
          // The bound control is the action Drawer itself. It is intentionally
          // mounted but hidden until the case opens one of the four actions.
          await assertInventoryActionState(page, binding.caseId);
          await assertBoundControl(page, binding);
          break;
        case 'CI-L2-015':
          await expect(page.getByTestId('catalog-inventory-copy-open')).toBeVisible();
          await page.getByTestId('catalog-inventory-copy-open').click();
          await assertBrandCopyWizardProgression(page, binding.fixtureRef);
          await assertBoundControl(page, binding);
          break;
        default:
          await assertBoundControl(page, binding);
      }
    });
  }
});

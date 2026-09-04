#!/usr/bin/env node

/**
 * Declarative r5-full input for sales-menu facts only. It owns neither
 * BusinessChannel nor Catalog facts: those are selected at runtime from the
 * preceding owner stages and re-read before every opaque ref is used.
 */
import crypto from 'node:crypto';

const fail = (code) => { throw new Error(code); };
const sha256 = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const menuCodes = Object.freeze(Array.from({length: 21}, (_, index) => `R5-SALES-MENU-${String(index + 1).padStart(2, '0')}`));
const itemCodes = Object.freeze(Array.from({length: 21}, (_, index) => `R5-SALES-ITEM-${String(index + 1).padStart(2, '0')}`));
const catalogItemSelectors = Object.freeze([
  ['APP-CHICKEN-WINGS-001', 'DIRECT'], ['APP-FRENCH-FRIES-001', 'DIRECT'], ['APP-GARLIC-BREAD-001', 'DIRECT'], ['APP-ROAST-VEG-001', 'DIRECT'],
  ['BEV-AMERICANO-001', 'DIRECT'], ['BEV-ICED-TEA-001', 'DIRECT'], ['BEV-LEMONADE-001', 'DIRECT'], ['BEV-POUROVER-001', 'DIRECT'],
  ['BEV-RED-WINE-GLASS-001', 'DIRECT'], ['BEV-SPARKLING-WATER-001', 'DIRECT'], ['DESSERT-BROWNIE-001', 'DIRECT'], ['DESSERT-CHEESECAKE-001', 'DIRECT'],
  ['DESSERT-PANNA-COTTA-001', 'DIRECT'], ['DESSERT-TIRAMISU-001', 'DIRECT'], ['BEV-LATTE-001', 'SKU'], ['MAIN-STEAK-SIRLOIN-001', 'SKU'],
  ['PASTA-BOLOGNESE-001', 'SKU'], ['PIZZA-MARGHERITA-001', 'SKU'], ['PORK-WEIGHT-001', 'WEIGHTED'], ['DINNER-SET-001', 'COMPOSITE'], ['FEE-PACKAGING-001', 'SERVICE'],
].map(([itemCode, shape]) => Object.freeze({scope: 'STORE', itemCode, shape})));

export const plan = Object.freeze({
  schemaVersion: 1,
  kind: 'sales-menu-seed-plan',
  status: 'STATIC_PLAN_ONLY',
  authority: 'DECLARATIVE_INPUTS_ONLY',
  revision: 'SALES_MENU_20260904',
  noDirectDatabaseWrites: true,
  noRuntimeExecution: true,
  parentProfile: 'r5-full',
  stageId: 'sales-menu',
  prerequisiteStages: ['owner-command', 'external-collaboration-business-channel', 'catalog-inventory'],
  selectors: {
    businessChannel: {
      ownerNodeType: 'STORE',
      accessKind: 'INTERNAL',
      orderKinds: ['DINE_IN', 'TAKEAWAY'],
      status: 'ENABLED',
      usage: 'SALES_MENU',
      requiredCount: 2,
    },
    catalog: {
      ownerReadback: 'getOperationsCatalogItem',
      requiredCount: 21,
      itemSelectors: catalogItemSelectors,
    },
  },
  salesMenuReadbacks: {candidateReadback: 'getOperationsSalesMenuItemCandidates', operationRecords: {minimumCount: 21}},
  menuDefinitions: menuCodes.map((code, index) => ({
    code,
    name: `销售菜单${String(index + 1).padStart(2, '0')}`,
    // The management selector must expose its 21st menu through cursor page 2.
    // Both qualified channels exist as independent entry facts, while this
    // menu denominator intentionally belongs to one entry; splitting it over
    // two channels would silently erase the accepted 20+1 selector boundary.
    channelSelectorIndex: 0,
    lifecycle: index === 0 ? 'PUBLISHED_DRAFT_DIRTY' : index === 1 ? 'PUBLISHED_DRAFT_EQUAL' : index === 2 ? 'UNPUBLISHED_EMPTY' : index === 3 ? 'ARCHIVED' : 'DRAFT',
    activation: index < 2 ? 'ENABLED' : index === 4 ? 'DISABLED' : 'NOT_APPLICABLE',
  })),
  primaryDefinition: {
    menuCode: 'R5-SALES-MENU-01',
    sections: ['分区一', '分区二', '分区三'],
    // Catalog owns the default-price comparison only; the menu must still
    // persist an explicit public price.  The composite and service fixtures
    // have no usable candidate default in the menu readback, so their menu
    // prices are declared here rather than invented at runtime or used to
    // weaken the owner validation.
    items: itemCodes.map((code, index) => ({
      code,
      catalogSelectorIndex: index === 20 ? 0 : index,
      sectionIndex: 0,
      listedPriceCents: index === 18 ? 5200 : index === 19 ? 200 : null,
      duplicateOf: index === 20 ? 'R5-SALES-ITEM-01' : null,
    })),
    schedule: {kind: 'ALL_DAY'},
    saleContent: {kind: 'DIRECT', listedPriceSource: 'CANDIDATE_DEFAULT_PRICE', skuPrices: []},
    displayMedia: {mode: 'INHERIT_CATALOG', assetRefs: [], primaryAssetRef: null},
  },
  // A distinct, one-section menu is required to prove the complementary
  // published-equal and daily-range branches. It is deliberately declarative:
  // the executor resolves its catalog opaque reference from the current
  // sales-menu candidate readback, never from an L2 fixture.
  secondaryDefinition: {
    menuCode: 'R5-SALES-MENU-02',
    sections: ['分区一'],
    catalogSelectorIndex: 0,
    schedule: {kind: 'DAILY_TIME_RANGE', startLocalTime: '11:00', endLocalTime: '14:00'},
    activation: 'ENABLED',
  },
  // Catalog/Inventory owns the six availability rows and their expected
  // values.  This stage owns only the menu surface that consumes the current
  // Catalog stage receipt; it must not duplicate item codes, target refs, or
  // inventory expectations in its declarative input.
  availabilityDefinition: {
    menuCode: 'R5-SALES-MENU-06',
    sectionName: '库存状态',
    sourceReceiptStage: 'catalog-inventory',
    expectedItemCount: 6,
  },
  menuOwnedStateMatrix: {
    saleDefinitions: [
      {kind: 'DIRECT', listedPriceSource: 'CANDIDATE_DEFAULT_PRICE', skuPrices: []},
      {kind: 'SKU', listedPriceCents: null, skuPrices: ['CANDIDATE_SKU_PRICE_01', 'CANDIDATE_SKU_PRICE_02']},
      {kind: 'WEIGHTED', listedPriceSource: 'CANDIDATE_DEFAULT_PRICE', skuPrices: [], orderingConstraints: 'N_A_WITH_REASON'},
      {kind: 'COMPOSITE', listedPriceSource: 'CANDIDATE_DEFAULT_PRICE', skuPrices: []},
      {kind: 'SERVICE', listedPriceSource: 'CANDIDATE_DEFAULT_PRICE', skuPrices: []},
    ],
    schedules: ['ALL_DAY', 'DAILY_TIME_RANGE'],
    displayMedia: [{mode: 'INHERIT_CATALOG'}, {mode: 'CUSTOM', assetCount: 2, primaryAssetOrdinal: 1}],
    orderingConstraints: [{minItemQuantity: 1, quantityStep: 1}, {minItemQuantity: 2, quantityStep: 2}],
    manual: ['NORMAL', 'MANUAL_SOLD_OUT_WITH_REASON', 'RESTORED_HISTORY'],
    recordOutcomes: ['SUCCESS', 'FAILED'],
  },
  exclusions: ['business-channel-template', 'business-channel-creation', 'catalog-item-creation', 'catalog-price-or-version-as-sales-menu-version', 'l2-fixture-reference', 'direct-database-write'],
});

export function validate(input = plan) {
  if (input?.kind !== 'sales-menu-seed-plan' || input.status !== 'STATIC_PLAN_ONLY' || input.noDirectDatabaseWrites !== true || input.noRuntimeExecution !== true || input.parentProfile !== 'r5-full' || input.stageId !== 'sales-menu') fail('SALES_MENU_SEED_PLAN_AUTHORITY_INVALID');
  if (input.prerequisiteStages?.join(',') !== 'owner-command,external-collaboration-business-channel,catalog-inventory') fail('SALES_MENU_SEED_PLAN_STAGE_ORDER_INVALID');
  const channel = input.selectors?.businessChannel;
  if (channel?.ownerNodeType !== 'STORE' || channel?.accessKind !== 'INTERNAL' || channel?.status !== 'ENABLED' || channel?.usage !== 'SALES_MENU' || channel?.requiredCount !== 2 || channel.orderKinds?.join(',') !== 'DINE_IN,TAKEAWAY') fail('SALES_MENU_SEED_CHANNEL_SELECTOR_INVALID');
  const catalog = input.selectors?.catalog;
  if (catalog?.ownerReadback !== 'getOperationsCatalogItem' || catalog?.requiredCount !== 21 || catalog.itemSelectors?.length !== 21 || new Set(catalog.itemSelectors.map((entry) => entry.itemCode)).size !== 21 || catalog.itemSelectors.map((entry) => entry.shape).join(',') !== 'DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,SKU,SKU,SKU,SKU,WEIGHTED,COMPOSITE,SERVICE') fail('SALES_MENU_SEED_CATALOG_SELECTOR_INVALID');
  if (input.salesMenuReadbacks?.candidateReadback !== 'getOperationsSalesMenuItemCandidates' || input.salesMenuReadbacks?.operationRecords?.minimumCount !== 21) fail('SALES_MENU_SEED_READBACK_DENOMINATOR_INVALID');
  if (!Array.isArray(input.menuDefinitions) || input.menuDefinitions.length !== 21 || new Set(input.menuDefinitions.map((entry) => entry.code)).size !== 21) fail('SALES_MENU_SEED_MENU_DENOMINATOR_INVALID');
  for (const lifecycle of ['PUBLISHED_DRAFT_DIRTY', 'PUBLISHED_DRAFT_EQUAL', 'UNPUBLISHED_EMPTY', 'ARCHIVED']) if (!input.menuDefinitions.some((entry) => entry.lifecycle === lifecycle)) fail(`SALES_MENU_SEED_LIFECYCLE_MISSING:${lifecycle}`);
  const enabled = input.menuDefinitions.filter((entry) => entry.activation === 'ENABLED');
  if (enabled.length < 2 || new Set(enabled.map((entry) => entry.channelSelectorIndex)).size !== 1 || !input.menuDefinitions.some((entry) => entry.activation === 'DISABLED')) fail('SALES_MENU_SEED_ACTIVATION_DENOMINATOR_INVALID');
  const primary = input.primaryDefinition;
  if (primary?.menuCode !== 'R5-SALES-MENU-01' || primary.sections?.length !== 3 || primary.items?.length !== 21 || new Set(primary.items.map((entry) => entry.code)).size !== 21 || primary.items.filter((entry) => entry.duplicateOf !== null).length !== 1 || new Set(primary.items.map((entry) => entry.catalogSelectorIndex)).size !== 20 || primary.items.find((entry) => entry.duplicateOf === 'R5-SALES-ITEM-01')?.catalogSelectorIndex !== 0 || primary.items.find((entry) => entry.code === 'R5-SALES-ITEM-19')?.listedPriceCents !== 5200 || primary.items.find((entry) => entry.code === 'R5-SALES-ITEM-20')?.listedPriceCents !== 200) fail('SALES_MENU_SEED_DEFINITION_DENOMINATOR_INVALID');
  if (primary.schedule?.kind !== 'ALL_DAY' || primary.saleContent?.kind !== 'DIRECT' || primary.saleContent?.listedPriceSource !== 'CANDIDATE_DEFAULT_PRICE' || primary.saleContent?.skuPrices?.length !== 0 || primary.displayMedia?.mode !== 'INHERIT_CATALOG') fail('SALES_MENU_SEED_PRIMARY_SHAPE_INVALID');
  const secondary = input.secondaryDefinition;
  if (secondary?.menuCode !== 'R5-SALES-MENU-02' || secondary.sections?.length !== 1 || secondary.catalogSelectorIndex !== 0
    || secondary.schedule?.kind !== 'DAILY_TIME_RANGE' || secondary.schedule?.startLocalTime !== '11:00' || secondary.schedule?.endLocalTime !== '14:00'
    || secondary.activation !== 'ENABLED') fail('SALES_MENU_SEED_SECONDARY_SHAPE_INVALID');
  const availability = input.availabilityDefinition;
  if (availability?.menuCode !== 'R5-SALES-MENU-06' || !input.menuDefinitions.some((entry) => entry.code === availability.menuCode)
    || availability.sectionName !== '库存状态' || availability.sourceReceiptStage !== 'catalog-inventory' || availability.expectedItemCount !== 6)
    fail('SALES_MENU_SEED_AVAILABILITY_DEFINITION_INVALID');
  const matrix = input.menuOwnedStateMatrix;
  if (Object.hasOwn(matrix ?? {}, 'inventoryAvailability')) fail('SALES_MENU_SEED_CROSS_OWNER_MATRIX_INVALID');
  if (matrix?.saleDefinitions?.map((entry) => entry.kind).join(',') !== 'DIRECT,SKU,WEIGHTED,COMPOSITE,SERVICE' || matrix.saleDefinitions.find((entry) => entry.kind === 'SKU')?.skuPrices?.length !== 2 || matrix.saleDefinitions.find((entry) => entry.kind === 'WEIGHTED')?.orderingConstraints !== 'N_A_WITH_REASON' || matrix?.schedules?.join(',') !== 'ALL_DAY,DAILY_TIME_RANGE' || matrix?.displayMedia?.[1]?.mode !== 'CUSTOM' || matrix.displayMedia[1]?.assetCount !== 2 || matrix?.orderingConstraints?.length !== 2 || matrix?.manual?.join(',') !== 'NORMAL,MANUAL_SOLD_OUT_WITH_REASON,RESTORED_HISTORY' || matrix?.recordOutcomes?.join(',') !== 'SUCCESS,FAILED') fail('SALES_MENU_SEED_STATE_MATRIX_INVALID');
  // Availability states and their values belong exclusively to the Catalog
  // receipt.  A second declarative menu-stage matrix would become a second
  // denominator authority and could drift before the runtime readback.
  if (Object.hasOwn(input, 'crossOwnerReadbackMatrix')) fail('SALES_MENU_SEED_CROSS_OWNER_MATRIX_INVALID');
  if (!input.exclusions?.includes('l2-fixture-reference') || !input.exclusions?.includes('direct-database-write')) fail('SALES_MENU_SEED_EXCLUSION_INVALID');
  return Object.freeze({...input, planDigest: sha256(input)});
}

function selfTest() {
  validate();
  const rejects = [
    ['MENU_COUNT', (next) => next.menuDefinitions.pop()],
    ['INTERNAL_CHANNEL', (next) => { next.selectors.businessChannel.accessKind = 'EXTERNAL'; }],
    ['PAGINATION_ITEM_COUNT', (next) => next.primaryDefinition.items.pop()],
    ['STATE_MATRIX', (next) => next.menuOwnedStateMatrix.saleDefinitions.pop()],
    ['SAME_CHANNEL_ENABLED', (next) => { next.menuDefinitions[1].channelSelectorIndex = 1; }],
    ['CROSS_OWNER_OWNERSHIP', (next) => { next.crossOwnerReadbackMatrix = {inventoryAvailability: ['NORMAL']}; }],
    ['AVAILABILITY_RECEIPT', (next) => { next.availabilityDefinition.sourceReceiptStage = 'sales-menu'; }],
    ['L2_REUSE_EXCLUSION', (next) => { next.exclusions = next.exclusions.filter((entry) => entry !== 'l2-fixture-reference'); }],
  ];
  for (const [label, mutate] of rejects) {
    const next = structuredClone(plan); mutate(next);
    try { validate(next); fail(`SALES_MENU_SEED_PLAN_RED_NOT_DETECTED:${label}`); }
    catch (error) { if (error.message.startsWith('SALES_MENU_SEED_PLAN_RED_NOT_DETECTED')) throw error; }
  }
  process.stdout.write('SALES_MENU_SEED_PLAN_SELF_TEST=PASS; MENUS=21; PRIMARY_ITEMS=21; RED=MENU_COUNT,INTERNAL_CHANNEL,PAGINATION_ITEM_COUNT,L2_REUSE_EXCLUSION\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) selfTest();
  else { const result = validate(); process.stdout.write(`SALES_MENU_SEED_PLAN=PASS; STAGE=${result.stageId}; PLAN_DIGEST=${result.planDigest}\n`); }
}

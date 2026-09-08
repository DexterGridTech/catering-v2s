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
  ['DESSERT-PANNA-COTTA-001', 'DIRECT'], ['DESSERT-TIRAMISU-001', 'DIRECT'], ['LATTE-001', 'SKU'], ['MAIN-STEAK-SIRLOIN-001', 'SKU'],
  ['CAESAR-001', 'DIRECT'], ['PIZZA-MARGHERITA-001', 'SKU'], ['PORK-WEIGHT-001', 'WEIGHTED'], ['DINNER-SET-001', 'COMPOSITE'], ['FEE-PACKAGING-001', 'SERVICE'],
].map(([itemCode, shape]) => Object.freeze({scope: 'STORE', itemCode, shape})));

export const plan = Object.freeze({
  schemaVersion: 1,
  kind: 'sales-menu-seed-plan',
  status: 'STATIC_PLAN_ONLY',
  authority: 'DECLARATIVE_INPUTS_ONLY',
  revision: 'SALES_MENU_20260908',
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
    // persist an explicit public price.  The option-bearing CAESAR fixture,
    // composite and service fixtures have no usable candidate default in the
    // menu readback, so their menu prices are declared here rather than
    // invented at runtime or used to weaken the owner validation.
    items: itemCodes.map((code, index) => ({
      code,
      // Item 21 intentionally reuses LATTE-001 (selector 14) as a second
      // SalesItem. Its SKU subset is declared below and differs from item 15.
      catalogSelectorIndex: index === 20 ? 14 : index,
      sectionIndex: 0,
      listedPriceCents: index === 16 ? 3800 : index === 18 ? 5200 : index === 19 ? 200 : null,
      duplicateOf: index === 20 ? 'R5-SALES-ITEM-15' : null,
    })),
    schedule: {kind: 'ALL_DAY'},
    saleContent: {kind: 'DIRECT', listedPriceSource: 'CANDIDATE_DEFAULT_PRICE', skuPrices: [], orderOptionSelections: []},
    displayMedia: {mode: 'INHERIT_CATALOG', assetRefs: [], primaryAssetRef: null},
  },
  // These are business-code declarations only.  The executor resolves every
  // SKU/option opaque ref from the current Catalog/SalesMenu owner readback.
  // LATTE-001 appears twice with disjoint SKU subsets, while CAESAR-001 uses
  // an explicit optional-empty plus required-nonempty option selection.
  targetSelection: {
    skuSubsets: [
      {itemCode: 'R5-SALES-ITEM-15', skuCodes: ['LATTE-SKU-S'], listedPriceCentsBySkuCode: {'LATTE-SKU-S': 3000}},
      {itemCode: 'R5-SALES-ITEM-16', skuCodes: ['STEAK-MEDIUM'], listedPriceCentsBySkuCode: {'STEAK-MEDIUM': 13200}},
      {itemCode: 'R5-SALES-ITEM-18', skuCodes: ['PIZZA-MARGHERITA-9'], listedPriceCentsBySkuCode: {'PIZZA-MARGHERITA-9': 7000}},
      {itemCode: 'R5-SALES-ITEM-21', skuCodes: ['LATTE-SKU-M'], listedPriceCentsBySkuCode: {'LATTE-SKU-M': 3400}},
    ],
    optionSubsets: [
      {
        itemCode: 'R5-SALES-ITEM-17',
        definitions: [
          {definitionCode: 'CAESAR_DRESSING', selectedValueCodes: []},
          {definitionCode: 'CAESAR_TOPPINGS', selectedValueCodes: ['BACON']},
        ],
      },
    ],
    manualTargets: [
      {itemCode: 'R5-SALES-ITEM-01', targetKind: 'ITEM'},
      {itemCode: 'R5-SALES-ITEM-15', targetKind: 'SKU', skuCode: 'LATTE-SKU-S'},
      {itemCode: 'R5-SALES-ITEM-17', targetKind: 'ORDER_OPTION_VALUE', definitionCode: 'CAESAR_TOPPINGS', valueCode: 'BACON'},
    ],
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
      {kind: 'DIRECT', listedPriceSource: 'CANDIDATE_DEFAULT_PRICE', skuPrices: [], orderOptionSelections: []},
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
  if (catalog?.ownerReadback !== 'getOperationsCatalogItem' || catalog?.requiredCount !== 21 || catalog.itemSelectors?.length !== 21 || new Set(catalog.itemSelectors.map((entry) => entry.itemCode)).size !== 21 || catalog.itemSelectors.map((entry) => entry.shape).join(',') !== 'DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,DIRECT,SKU,SKU,DIRECT,SKU,WEIGHTED,COMPOSITE,SERVICE') fail('SALES_MENU_SEED_CATALOG_SELECTOR_INVALID');
  if (input.salesMenuReadbacks?.candidateReadback !== 'getOperationsSalesMenuItemCandidates' || input.salesMenuReadbacks?.operationRecords?.minimumCount !== 21) fail('SALES_MENU_SEED_READBACK_DENOMINATOR_INVALID');
  if (!Array.isArray(input.menuDefinitions) || input.menuDefinitions.length !== 21 || new Set(input.menuDefinitions.map((entry) => entry.code)).size !== 21) fail('SALES_MENU_SEED_MENU_DENOMINATOR_INVALID');
  for (const lifecycle of ['PUBLISHED_DRAFT_DIRTY', 'PUBLISHED_DRAFT_EQUAL', 'UNPUBLISHED_EMPTY', 'ARCHIVED']) if (!input.menuDefinitions.some((entry) => entry.lifecycle === lifecycle)) fail(`SALES_MENU_SEED_LIFECYCLE_MISSING:${lifecycle}`);
  const enabled = input.menuDefinitions.filter((entry) => entry.activation === 'ENABLED');
  if (enabled.length < 2 || new Set(enabled.map((entry) => entry.channelSelectorIndex)).size !== 1 || !input.menuDefinitions.some((entry) => entry.activation === 'DISABLED')) fail('SALES_MENU_SEED_ACTIVATION_DENOMINATOR_INVALID');
  const primary = input.primaryDefinition;
  if (primary?.menuCode !== 'R5-SALES-MENU-01' || primary.sections?.length !== 3 || primary.items?.length !== 21 || new Set(primary.items.map((entry) => entry.code)).size !== 21 || primary.items.filter((entry) => entry.duplicateOf !== null).length !== 1 || new Set(primary.items.map((entry) => entry.catalogSelectorIndex)).size !== 20 || primary.items.find((entry) => entry.duplicateOf === 'R5-SALES-ITEM-15')?.catalogSelectorIndex !== 14 || primary.items.find((entry) => entry.code === 'R5-SALES-ITEM-17')?.listedPriceCents !== 3800 || primary.items.find((entry) => entry.code === 'R5-SALES-ITEM-19')?.listedPriceCents !== 5200 || primary.items.find((entry) => entry.code === 'R5-SALES-ITEM-20')?.listedPriceCents !== 200) fail('SALES_MENU_SEED_DEFINITION_DENOMINATOR_INVALID');
  if (primary.schedule?.kind !== 'ALL_DAY' || primary.saleContent?.kind !== 'DIRECT' || primary.saleContent?.listedPriceSource !== 'CANDIDATE_DEFAULT_PRICE' || primary.saleContent?.skuPrices?.length !== 0 || primary.saleContent?.orderOptionSelections?.length !== 0 || primary.displayMedia?.mode !== 'INHERIT_CATALOG') fail('SALES_MENU_SEED_PRIMARY_SHAPE_INVALID');
  const primaryItemsByCode = new Map(primary.items.map((entry) => [entry.code, entry]));
  const skuSubsets = input.targetSelection?.skuSubsets;
  if (!Array.isArray(skuSubsets) || skuSubsets.length !== 4 || new Set(skuSubsets.map((entry) => entry.itemCode)).size !== 4) fail('SALES_MENU_SEED_SKU_SUBSET_MATRIX_INVALID');
  const expectedSkuSubsets = new Map([
    ['R5-SALES-ITEM-15', ['LATTE-SKU-S']],
    ['R5-SALES-ITEM-16', ['STEAK-MEDIUM']],
    ['R5-SALES-ITEM-18', ['PIZZA-MARGHERITA-9']],
    ['R5-SALES-ITEM-21', ['LATTE-SKU-M']],
  ]);
  for (const subset of skuSubsets) {
    const expectedCodes = expectedSkuSubsets.get(subset.itemCode);
    const item = primaryItemsByCode.get(subset.itemCode);
    const selector = item ? catalog.itemSelectors[item.catalogSelectorIndex] : null;
    const codes = Array.isArray(subset.skuCodes) ? subset.skuCodes : [];
    const prices = subset.listedPriceCentsBySkuCode;
    if (!expectedCodes || !item || selector?.shape !== 'SKU' || codes.length === 0 || new Set(codes).size !== codes.length
      || JSON.stringify([...codes].sort()) !== JSON.stringify([...expectedCodes].sort()) || !prices || typeof prices !== 'object'
      || JSON.stringify(Object.keys(prices).sort()) !== JSON.stringify([...codes].sort())
      || Object.values(prices).some(value => !Number.isInteger(value) || value < 0)) fail('SALES_MENU_SEED_SKU_SUBSET_MATRIX_INVALID');
  }
  const optionSubsets = input.targetSelection?.optionSubsets;
  if (!Array.isArray(optionSubsets) || optionSubsets.length !== 1 || new Set(optionSubsets.map((entry) => entry.itemCode)).size !== 1) fail('SALES_MENU_SEED_OPTION_SUBSET_MATRIX_INVALID');
  const optionSubset = optionSubsets[0];
  const optionItem = primaryItemsByCode.get(optionSubset?.itemCode);
  const optionSelector = optionItem ? catalog.itemSelectors[optionItem.catalogSelectorIndex] : null;
  const definitions = optionSubset?.definitions;
  if (optionSubset?.itemCode !== 'R5-SALES-ITEM-17' || optionSelector?.itemCode !== 'CAESAR-001' || optionSelector.shape !== 'DIRECT'
    || !Array.isArray(definitions) || definitions.length !== 2 || new Set(definitions.map((entry) => entry.definitionCode)).size !== 2
    || JSON.stringify(definitions.map((entry) => entry.definitionCode).sort()) !== JSON.stringify(['CAESAR_DRESSING', 'CAESAR_TOPPINGS'])) fail('SALES_MENU_SEED_OPTION_SUBSET_MATRIX_INVALID');
  const optionDefinitions = new Map(definitions.map((entry) => [entry.definitionCode, entry]));
  const dressing = optionDefinitions.get('CAESAR_DRESSING');
  const toppings = optionDefinitions.get('CAESAR_TOPPINGS');
  if (!dressing || !Array.isArray(dressing.selectedValueCodes) || dressing.selectedValueCodes.length !== 0
    || !toppings || !Array.isArray(toppings.selectedValueCodes) || toppings.selectedValueCodes.length !== 1
    || toppings.selectedValueCodes[0] !== 'BACON') fail('SALES_MENU_SEED_OPTION_SUBSET_MATRIX_INVALID');
  const manualTargets = input.targetSelection?.manualTargets;
  if (!Array.isArray(manualTargets) || manualTargets.length !== 3
    || new Set(manualTargets.map((entry) => `${entry.itemCode}:${entry.targetKind}:${entry.skuCode ?? entry.definitionCode ?? ''}:${entry.valueCode ?? ''}`)).size !== 3
    || manualTargets[0]?.itemCode !== 'R5-SALES-ITEM-01' || manualTargets[0]?.targetKind !== 'ITEM'
    || manualTargets[1]?.itemCode !== 'R5-SALES-ITEM-15' || manualTargets[1]?.targetKind !== 'SKU' || manualTargets[1]?.skuCode !== 'LATTE-SKU-S'
    || manualTargets[2]?.itemCode !== 'R5-SALES-ITEM-17' || manualTargets[2]?.targetKind !== 'ORDER_OPTION_VALUE'
    || manualTargets[2]?.definitionCode !== 'CAESAR_TOPPINGS' || manualTargets[2]?.valueCode !== 'BACON') fail('SALES_MENU_SEED_MANUAL_TARGET_MATRIX_INVALID');
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
    ['SKU_SUBSET_EMPTY', (next) => { next.targetSelection.skuSubsets[0].skuCodes = []; }],
    ['OPTION_REQUIRED_EMPTY', (next) => { next.targetSelection.optionSubsets[0].definitions[1].selectedValueCodes = []; }],
    ['MANUAL_TARGET_MISSING', (next) => { next.targetSelection.manualTargets.pop(); }],
    ['MANUAL_TARGET_KIND', (next) => { next.targetSelection.manualTargets[1].targetKind = 'ITEM'; }],
  ];
  for (const [label, mutate] of rejects) {
    const next = structuredClone(plan); mutate(next);
    try { validate(next); fail(`SALES_MENU_SEED_PLAN_RED_NOT_DETECTED:${label}`); }
    catch (error) { if (error.message.startsWith('SALES_MENU_SEED_PLAN_RED_NOT_DETECTED')) throw error; }
  }
  process.stdout.write('SALES_MENU_SEED_PLAN_SELF_TEST=PASS; MENUS=21; PRIMARY_ITEMS=21; RED=MENU_COUNT,INTERNAL_CHANNEL,PAGINATION_ITEM_COUNT,SKU_SUBSET_EMPTY,OPTION_REQUIRED_EMPTY,MANUAL_TARGET_MISSING,L2_REUSE_EXCLUSION\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) selfTest();
  else { const result = validate(); process.stdout.write(`SALES_MENU_SEED_PLAN=PASS; STAGE=${result.stageId}; PLAN_DIGEST=${result.planDigest}\n`); }
}

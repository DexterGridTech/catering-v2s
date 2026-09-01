import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('catalog seed obtains the diagnostic protocol from the managed runtime and records exact report join fields', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /buildManagedDiagnosticHeaders\(\{manifest, credentials, operationId, routeTemplate: operation\.path, correlationId\}\)/);
  assert.match(source, /managedDevRunId: manifest\.runId, correlationId: response\.headers\.get\("x-correlation-id"\) \|\| correlationId, requestId, owner: operation\.owner, consumerFace:/);
  assert.match(source, /buildSeedReport\(\{runId, managedDevRunId: manifest\.runId, measurement/);
  assert.match(source, /status: business, businessStatus: business, cleanupStatus: cleanup/);
  assert.doesNotMatch(source, /"X-Seed-|"X-Correlation-Id|V2S_SEED_REPORT_SECRET/);
});

test('catalog seed materializes terminal SKUs through the owner transition lifecycle', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /const canonicalInitialOwnerSaveDraft =/);
  assert.match(source, /status === "VOIDED" \? \{\.\.\.sku, status: "DISABLED"\}/);
  assert.match(source, /const canonicalOwnerSaveDraft =/);
  assert.match(source, /draft\.skus = \(draft\.skus \?\? \[\]\)\.filter\(\(sku\) => sku\.status !== "VOIDED"\)/);
  assert.match(source, /skuTransitions: transitions/);
  assert.match(source, /targetStatus: "VOIDED"/);
  assert.match(source, /transitionSequence !== "after-initial-save-before-final-readback"/);
  assert.match(source, /draft\.compositeGroups = \[\]/);
  assert.match(source, /compositeRelationSequence !== "after-target-item-activation"/);
  assert.match(source, /sourceCompositeRelationTargetFixtureKeys/);
  assert.match(source, /!sourceCompositeRelationTargetFixtureKeys\.has\(source\.fixtureKey\)/);
  assert.match(source, /expectedTransitionCount: transitions\.length/);
  assert.match(source, /expectedSkus = \(dataset\.entities\?\.skus \|\| \[\]\)\s+\.filter\(\(entry\) => entry\.status !== "VOIDED"\)/);
});

test('catalog seed resolves direct target refs from both list and catalog-detail readback shapes', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /const targetRefFromCatalogRule = \(row\) => row\?\.targetRef \?\? row\?\.directConfiguration\?\.targetRef \?\? null;/);
  assert.match(source, /targetRefFromCatalogRule\(candidate\)/);
  assert.match(source, /const targetRef = targetRefFromCatalogRule\(row\);/);
});

test('catalog BOM readback compares unit snapshot facts instead of JSONB key order', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /const sameUnitSnapshot = \(actual, expected\)/);
  assert.match(source, /sameUnitSnapshot\(material\.consumptionUnitSnapshot, expectedConsumptionUnitSnapshot\)/);
  assert.match(source, /sameUnitSnapshot\(line\.consumptionUnitSnapshot, expectedRow\.consumptionUnitSnapshot\)/);
  assert.match(source, /line\.lineSign === expectedRow\.lineSign/);
  assert.match(source, /consumptionUnitSnapshot: unitSnapshot\(\s*refs,\s*definitionAssignmentFor\(line\.materialItemCode\)\.baseMeasureUnitCode,/);
  assert.match(source, /sameUnitSnapshot\(line\.consumptionUnitSnapshot, expectedLine\.consumptionUnitSnapshot\)/);
  assert.doesNotMatch(source, /JSON\.stringify\(line\.consumptionUnitSnapshot\)/);
});

test('catalog seed proves the owner candidate collection used by a new BOM line', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /operationId: "getOperationsInventoryConsumptionTargetCandidates"/);
  assert.match(source, /continuationField: "nextCursor"/);
  assert.match(source, /SEED_INVENTORY_CANDIDATE_READBACK_INVALID/);
  assert.match(source, /candidateSetMatches/);
  assert.match(source, /candidateFactsMatch/);
});

test('catalog seed follows the owner aggregate category-count semantics', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /const expectedCategoryNavigationCounts = \(sourceItems, scopeType, categoryDefinitions\)/);
  assert.match(source, /expectedDirectCount: expected\.directCount/);
  assert.match(source, /expectedCountSemantics: "SELF_AND_DESCENDANTS"/);
  assert.match(source, /actualCountSemantics !== "SELF_AND_DESCENDANTS"/);
  assert.match(source, /catalog_item_category_self_and_descendants/);
});

test('catalog seed retains order-option value codes for option BOM attachment', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /values\.set\(value\.code,\s*\{\s*code:\s*value\.code,\s*definitionValueRef:/s);
  assert.match(source, /find\(\(value\) => value\.code === optionBom\.valueCode\)/);
});

test('catalog seed creates a first option-value BOM owner and replaces it on readback', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(ruleIndex < 0\) inventoryRules\.nodes\.push\(rule\);\s*else inventoryRules\.nodes\[ruleIndex\] = rule;/);
  assert.doesNotMatch(source, /if \(ruleIndex < 0\) fail\(`SEED_ORDER_OPTION_BOM_OWNER_MISSING/);
});

test('catalog seed requires strict category paths, complete sorted list rows, and SKU-page owner readback', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /const categoryPathCodes = \(code\) =>/);
  assert.match(source, /const sameCategoryPath = \(actual, expected\) =>/);
  assert.match(source, /String\(segment\?\.categoryRef \?\? ''\) === String\(expected\[index\]\?\.categoryRef \?\? ''\)/);
  assert.match(source, /&& segment\?\.code === expected\[index\]\?\.code/);
  assert.match(source, /&& segment\?\.name === expected\[index\]\?\.name/);
  assert.match(source, /pathMatches: sameCategoryPath\(row\?\.path, expectedPath\)/);
  assert.doesNotMatch(source, /pathMatches: JSON\.stringify\(/);
  assert.match(source, /filteredSetMatches: JSON\.stringify\(actualFilteredCodes\) === JSON\.stringify\(expectedFilteredCodes\)/);
  assert.match(source, /const matchedCodes = categoryDefinitions/);
  assert.match(source, /candidate\.code\.toLowerCase\(\)\.includes\(keyword\) \|\| candidate\.name\.toLowerCase\(\)\.includes\(keyword\)/);
  assert.match(source, /matchedCodes\.some\(\(matchedCode\) => categoryPathCodes\(matchedCode\)\.includes\(candidate\.code\)\)/);
  assert.doesNotMatch(source, /categoryPathCodes\(candidate\.code\)\.some\(\(pathCode\) => matchedCodes\.includes\(pathCode\)\)/);
  assert.match(source, /category-candidate-readback-diagnostic/);
  assert.match(source, /actualRowCount: rows\.length/);
  assert.match(source, /expectedRowCount: expectedFilteredCodes\.length/);
  assert.doesNotMatch(source, /category-candidate-readback-diagnostic-\$\{definition\.code\}/);
  assert.doesNotMatch(source, /phase\([^\n]*category-candidate[^\n]*(?:row\.path|definition\.name|actualFilteredCodes)/);
  assert.match(source, /const assertCatalogListRowOwnerReadback = \(row, detailData, item, expectedCategoryPath, refs, context\) =>/);
  assert.match(source, /const ownerProjectionMismatch = exactFactMismatch\(row, expectedListProjection, LIST_TEN_COLUMN_OWNER_FACTS\);/);
  assert.match(source, /catalog-list-ten-column-owner-readback-diagnostic/);
  assert.match(source, /ownerProjectionMismatch,/);
  assert.match(source, /stage: `\$\{client\.scopeType\}-catalog-list-ten-column-readback`,\s*operationId: "getOperationsCatalogItems",/);
  assert.match(source, /entriesField: "items",\s*continuationField: "cursor",\s*identityOf: \(row\) => row\?\.itemRef,\s*failurePrefix: `SEED_LIST:\$\{client\.scopeType\}`,/);
  assert.match(source, /const \{entries: rows\} = await readCompleteCollection\(/);
  assert.match(source, /const tagFactsFromOwnerDetail = \(item, refs\) =>/);
  assert.match(source, /import \{isDeepStrictEqual\} from "node:util";/);
  assert.match(source, /const sameJson = \(actual, expected\) => isDeepStrictEqual\(actual, expected\);/);
  assert.doesNotMatch(source, /const sameJson = \(actual, expected\) => JSON\.stringify\(actual\) === JSON\.stringify\(expected\);/);
  assert.match(source, /const listProjectionFromOwnerDetail = \(detailData, item, categoryPath, refs\) =>/);
  assert.match(source, /categoryPath: asArray\(categoryPath\)/);
  assert.match(source, /specificationFacts: asArray\(item\?\.specificationFacts\)/);
  assert.match(source, /preparationFacts: item\?\.preparationFacts \?\? null/);
  assert.doesNotMatch(source, /categoryPathLabels|specificationOrOptionSummary|attributeSummary|preparationSummary/);
  assert.match(source, /const inventorySummaryFromOwnerDetail = \(detailData, item, sku = null\) =>/);
  assert.match(source, /if \(!sku && \(item\?\.skuSummary\?\.totalCount \?\? 0\) > 0\)/);
  assert.match(source, /return \{grain: "SKU", mode: null, consumptionUnitSnapshot: null, bomLineCount: null\};/);
  assert.match(source, /mode: "NONE"/);
  assert.match(source, /const inventoryDeductionSummaryMismatch = \(actual, expected\) =>/);
  assert.match(source, /mismatchedSubfact: inventorySummarySubfact/);
  assert.match(source, /expectedInventoryMode: expectedSkuPageRow\.inventoryDeductionSummary\?\.mode \?\? null/);
  assert.match(source, /const LIST_TEN_COLUMN_OWNER_FACTS = Object\.freeze\(\[/);
  assert.match(source, /"updatedAt"/);
  assert.match(source, /exactFactMismatch\(row, expectedListProjection, LIST_TEN_COLUMN_OWNER_FACTS\)/);
  assert.match(source, /SEED_LIST_TEN_COLUMN_OWNER_READBACK_INVALID/);
  assert.match(source, /const assertSkuPageOwnerReadback = async \(client, refs, detailData, item, context\) =>/);
  assert.match(source, /getOperationsCatalogItemSkus/);
  assert.match(source, /const SKU_PAGE_OWNER_FACTS = Object\.freeze\(\[/);
  assert.match(source, /attributeFacts: asArray\(sku\?\.attributeFacts \?\? sku\?\.attributeValueRefs\)/);
  assert.match(source, /const mismatch = expectedSkuPageRow/);
  assert.match(source, /exactFactMismatch\(row, expectedSkuPageRow, SKU_PAGE_OWNER_FACTS\)/);
  assert.match(source, /SEED_SKU_PAGE_STRICT_OWNER_READBACK_INVALID/);
  assert.match(source, /catalog-sku-page-owner-readback-diagnostic/);
  assert.match(source, /mismatchedFact: mismatch/);
  assert.match(source, /TEN_COLUMN_OWNER_READBACK_DRIFT/);
  assert.match(source, /TEN_COLUMN_ATTRIBUTE_OPTION_OWNER_READBACK_DRIFT/);
  assert.match(source, /attributeFacts: \[\{definitionRef: "attribute-ref"/);
  assert.match(source, /SEED_LIST_TEN_COLUMN_OWNER_READBACK_INVALID/);
  assert.match(source, /SKU_STRICT_OWNER_READBACK_DRIFT/);
  assert.match(source, /SKU_NONE_MODE_OWNER_READBACK_DRIFT/);
  assert.match(source, /ITEM_NONE_MODE_OWNER_READBACK_DRIFT/);
  assert.match(source, /SKU_PARENT_NULL_MODE_OWNER_READBACK_DRIFT/);
  assert.match(source, /CONCRETE_SKU_NONE_MODE_OWNER_READBACK_DRIFT/);
  assert.match(source, /SKU_ATTRIBUTE_FACT_OWNER_READBACK_DRIFT/);
  assert.match(source, /SEED_SKU_PAGE_STRICT_OWNER_READBACK_INVALID/);
  assert.match(source, /updatedAt: 124/);
  assert.match(source, /inventoryDeductionSummary: \{grain: "SKU", mode: null, consumptionUnitSnapshot: null, bomLineCount: null\}/);
});

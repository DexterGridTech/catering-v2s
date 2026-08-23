import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('catalog seed obtains the diagnostic protocol from the managed runtime and records exact report join fields', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /buildManagedDiagnosticHeaders\(\{manifest, credentials, operationId, routeTemplate: operation\.path, correlationId\}\)/);
  assert.match(source, /managedDevRunId: manifest\.runId, correlationId: response\.headers\.get\("x-correlation-id"\) \|\| correlationId, requestId, owner: operation\.owner, consumerFace:/);
  assert.match(source, /buildSeedReport\(\{runId, managedDevRunId: manifest\.runId, measurement/);
  assert.doesNotMatch(source, /"X-Seed-|"X-Correlation-Id|V2S_SEED_REPORT_SECRET/);
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

test('catalog seed retains order-option value codes for option BOM attachment', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /values\.set\(value\.code, \{code: value\.code, definitionValueRef:/);
  assert.match(source, /find\(\(value\) => value\.code === optionBom\.valueCode\)/);
});

test('catalog seed creates a first option-value BOM owner and replaces it on readback', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(ruleIndex < 0\) inventoryRules\.nodes\.push\(rule\);\s*else inventoryRules\.nodes\[ruleIndex\] = rule;/);
  assert.doesNotMatch(source, /if \(ruleIndex < 0\) fail\(`SEED_ORDER_OPTION_BOM_OWNER_MISSING/);
});

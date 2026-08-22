import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const fixture = JSON.parse(fs.readFileSync("contracts/policy/catalog-inventory-fixture-catalog.json", "utf8"));
const plan = JSON.parse(fs.readFileSync("doc/evidence/platform/2026-08-07-v2s-catalog-inventory-seed-plan-codex.json", "utf8"));
const executor = fs.readFileSync("scripts/dev/catalog-inventory-seed-executor.mjs", "utf8");

const collectIdentitySets = () => {
  const skuValueCodes = new Set();
  const attributeCodes = new Set();
  const collectSku = (sku) => {
    for (const [attributeCode, valueCode] of Object.entries(sku?.attributeValues ?? {})) {
      attributeCodes.add(attributeCode);
      skuValueCodes.add(attributeCode + "-" + valueCode);
    }
  };
  for (const source of plan.sourceItems ?? []) {
    for (const sku of source.skus ?? []) collectSku(sku);
  }
  for (const dataset of plan.seedDatasets ?? []) {
    for (const sku of dataset.entities?.skus ?? []) collectSku(sku);
  }
  return {skuValueCodes, attributeCodes};
};

test("seed labels close the complete SKU tuple and reusable catalog-definition fixture", () => {
  const {skuValueCodes, attributeCodes} = collectIdentitySets();
  const dictionary = fixture.seedBusinessLabels.dictionary;
  assert.deepEqual(Object.keys(dictionary.SKU_ATTRIBUTE_VALUE).sort(), [...skuValueCodes].sort());
  assert.deepEqual(Object.keys(dictionary.SKU_ATTRIBUTE).sort(), [...attributeCodes].sort());
  assert.equal(skuValueCodes.size, 13);
  assert.equal(dictionary.SKU_ATTRIBUTE_VALUE.MEDIUM, undefined);
  assert.equal(dictionary.SKU_ATTRIBUTE_VALUE.LARGE, undefined);
  assert.equal(dictionary.SKU_ATTRIBUTE_VALUE.SMALL, undefined);
  assert.equal(dictionary.SKU_ATTRIBUTE_VALUE["DONENESS-MEDIUM"], "七分熟");
  assert.equal(dictionary.SKU_ATTRIBUTE_VALUE["DRINK_SIZE-MEDIUM"], "中杯");
  assert.equal(dictionary.SKU_ATTRIBUTE_VALUE["SIZE-MEDIUM"], "中杯");
  const definitions = fixture.catalogDefinitionSeed;
  assert.deepEqual(definitions.tagDefinitions.map((entry) => entry.name), ["推荐商品", "当季推荐"]);
  assert.deepEqual(
    definitions.unitDefinitions.map((entry) => entry.name),
    ["份", "个", "杯", "瓶", "箱", "包", "克", "千克", "毫升", "升", "小时", "套", "片", "停用个"],
  );
  assert.deepEqual(
    definitions.unitDefinitions.map((entry) => [entry.code, entry.unitDimension, entry.precision]),
    [
      ["SERVING", "COUNT", 0],
      ["EACH", "COUNT", 0],
      ["CUP", "COUNT", 0],
      ["BOTTLE", "COUNT", 0],
      ["BOX", "PACKAGE", 0],
      ["PACK", "PACKAGE", 0],
      ["GRAM", "WEIGHT", 0],
      ["KILOGRAM", "WEIGHT", 4],
      ["MILLILITER", "VOLUME", 0],
      ["LITER", "VOLUME", 3],
      ["HOUR", "SERVICE_DURATION", 2],
      ["SET", "PACKAGE", 0],
      ["SLICE", "COUNT", 0],
      ["DISABLED_EACH", "COUNT", 0],
    ],
  );
  assert.deepEqual(definitions.attributeDefinitions.map((entry) => entry.valueType).sort(), ["MULTI_SELECT", "SINGLE_SELECT", "TEXT"]);
  assert.deepEqual([...new Set(definitions.orderOptionDefinitions.map((entry) => entry.selectionMode))].sort(), ["MULTIPLE", "SINGLE"]);
  const caesar = definitions.itemAssignments.find((entry) => entry.itemCode === "CAESAR-001");
  const latte = definitions.itemAssignments.find((entry) => entry.itemCode === "LATTE-001");
  assert.ok(caesar && latte);
  assert.equal(caesar.attributes.find((entry) => entry.definitionCode === "SHELF_LIFE").textValue, "当天制作");
  assert.deepEqual(caesar.attributes.find((entry) => entry.definitionCode === "ALLERGENS").optionNames, ["蛋类", "乳制品"]);
  assert.equal(caesar.orderOptions.find((entry) => entry.definitionCode === "CAESAR_DRESSING").required, false);
  const toppings = caesar.orderOptions.find((entry) => entry.definitionCode === "CAESAR_TOPPINGS");
  assert.deepEqual([toppings.minSelectionCount, toppings.maxSelectionCount], [0, 2]);
  assert.equal(toppings.values.find((entry) => entry.valueCode === "BACON").extraPrice, 200);
  assert.equal(
    caesar.optionValueBoms.find((entry) => entry.valueCode === "CHICKEN").lines[0].quantity,
    80,
  );
  assert.equal(
    caesar.optionValueBoms.some((entry) => entry.lines.some((line) => line.lineSign === "NEGATIVE")),
    false,
  );
  const milkTea = definitions.itemAssignments.find((entry) => entry.itemCode === "MILK-TEA-001");
  assert.equal(
    milkTea.optionValueBoms.find((entry) => entry.valueCode === "OAT_MILK").lines.some((line) => line.lineSign === "NEGATIVE"),
    true,
  );
});

test("every required SKU seed graph supplies the selected variant axes", () => {
  const assertCompleteAxes = (skus, origin) => {
    const axes = new Set((skus ?? []).flatMap((sku) => Object.keys(sku?.attributeValues ?? {})));
    for (const sku of skus ?? []) assert.deepEqual(Object.keys(sku.attributeValues ?? {}).sort(), [...axes].sort(), origin);
  };
  for (const source of plan.sourceItems ?? []) {
    if (source.shapeKey === "SKU_VARIANT_SALE_COUNTED") assertCompleteAxes(source.skus, source.catalogItemCode);
  }
  for (const dataset of plan.seedDatasets ?? []) {
    if (dataset.entities?.shapeKey === "SKU_VARIANT_SALE_COUNTED") assertCompleteAxes(dataset.entities.skus, dataset.fixtureId);
  }
});

test("seed executor preserves SKU dictionaries while materializing current reusable definitions", () => {
  assert.match(executor, /const skuAttributeValueCode =/);
  assert.match(executor, /const skuVariantDimensionsFor =/);
  assert.match(executor, /skuVariantDimensionsFor\(source\.skus/);
  assert.match(executor, /skuVariantDimensionsFor\(entities\.skus/);
  assert.match(executor, /const skuAttributeValues = new Map\(\)/);
  assert.match(executor, /"getOperationsCatalogDictionary".*?pageSize: 100/s);
  assert.match(executor, /parentEntryRef: entry\.parentEntryRef/);
  assert.match(executor, /SEED_SKU_ATTRIBUTE_VALUE_PARENT_READBACK_INVALID/);
  assert.match(executor, /SEED_REFERENCE_PREFLIGHT_INVALID/);
  assert.match(executor, /valueCode: qualifiedValueCode/);
  assert.match(executor, /attributeValueRef: skuAttributeValueRef/);
  assert.match(executor, /createOperationsCatalogAttributeDefinition/);
  assert.match(executor, /createOperationsCatalogOrderOptionDefinition/);
  assert.match(executor, /listOperationsCatalogAttributeDefinitions/);
  assert.match(executor, /listOperationsCatalogOrderOptionDefinitions/);
  assert.match(executor, /SEED_CATALOG_DEFINITION_STOCK_TARGET_MISSING/);
  assert.match(executor, /attributeAssignments = assignment\.attributes/);
  assert.match(executor, /orderOptionConfigs = assignment\.orderOptions/);
  assert.match(executor, /expectedBomVersion: 0/);
  assert.match(executor, /SEED_ORDER_OPTION_BOM_READBACK_INVALID/);
  assert.match(executor, /inventoryRulesFromReadback\(current\)/);
  assert.doesNotMatch(executor, /materialQuantities/);
  const skuAttributeReadback = executor.indexOf('await materializeDictionary("SKU_ATTRIBUTE"');
  const skuAttributeValueReadback = executor.indexOf('await materializeDictionary("SKU_ATTRIBUTE_VALUE"');
  assert.ok(skuAttributeReadback >= 0 && skuAttributeReadback < skuAttributeValueReadback);
  assert.doesNotMatch(executor, /const dictionaries =/);
  assert.doesNotMatch(executor, /referenceCodes\.values/);
  assert.doesNotMatch(executor, /refs\.optionValueRefs/);
  assert.doesNotMatch(executor, /attributeValueRef:\s*dictionaryRef\(refs,\s*"SKU_ATTRIBUTE_VALUE",\s*valueCode\)/);
  assert.doesNotMatch(executor, /attributes:\s*(?:sourceBusinessAttributes|canonicalBusinessAttributes)/);
  assert.doesNotMatch(executor, /orderOptions:\s*(?:sourceBusinessOrderOptions|canonicalBusinessOrderOptions)/);
});

test("seed sends catalog item codes to the owner unchanged", () => {
  assert.match(
    executor,
    /body: \{dataNodeRef: client\.dataNodeRef, name: source\.name, code: source\.catalogItemCode, shapeKey: source\.shapeKey, categoryRef: expectedCategoryRef\}/,
  );
  assert.doesNotMatch(executor, /source\.catalogItemCode\.(?:toUpperCase|toLowerCase|replace)\(/);
});

test("seed writes and verifies the single relational category reference", () => {
  assert.match(executor, /const categoryRefFor = \(source, refs\) =>/);
  assert.match(executor, /categoryRef: categoryRefFor\(source, refs\)/);
  assert.match(executor, /const expectedCategoryRef = categoryRefFor\(source, refs\)/);
  assert.match(executor, /SEED_CATEGORY_ASSIGNMENT_READBACK_INVALID/);
  assert.match(executor, /expectedCategoryRef,\s*actualCategoryRef/);
  assert.match(executor, /SEED_CATEGORY_COUNT_READBACK_INVALID/);
  assert.match(executor, /countSource: "catalog_item_category"/);
  assert.doesNotMatch(executor, /categoryRefs: source\.categoryKey/);
  assert.doesNotMatch(executor, /categoryRefs: \[\]/);
});

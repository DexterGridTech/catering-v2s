import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const fixture = JSON.parse(fs.readFileSync("contracts/policy/catalog-inventory-fixture-catalog.json", "utf8"));
const plan = JSON.parse(fs.readFileSync("doc/evidence/platform/2026-08-07-v2s-catalog-inventory-seed-plan-codex.json", "utf8"));
const executor = fs.readFileSync("scripts/dev/catalog-inventory-seed-executor.mjs", "utf8");

const collectIdentitySets = () => {
  const skuValueCodes = new Set();
  const attributeCodes = new Set();
  const orderOptionCodes = new Set();
  const collectSku = (sku) => {
    for (const [attributeCode, valueCode] of Object.entries(sku?.attributeValues ?? {})) {
      attributeCodes.add(attributeCode);
      skuValueCodes.add(attributeCode + "-" + valueCode);
    }
  };
  for (const source of plan.sourceItems ?? []) {
    for (const sku of source.skus ?? []) collectSku(sku);
    for (const group of source.optionGroups ?? []) {
      for (const value of group.optionValues ?? []) orderOptionCodes.add(value.optionValueCode ?? value.optionValueRef);
    }
  }
  for (const dataset of plan.seedDatasets ?? []) {
    for (const sku of dataset.entities?.skus ?? []) collectSku(sku);
    for (const value of dataset.entities?.optionValues ?? []) orderOptionCodes.add(value.code);
  }
  return {skuValueCodes, attributeCodes, orderOptionCodes};
};

test("seed labels close the complete SKU tuple and order-option denominators", () => {
  const {skuValueCodes, attributeCodes, orderOptionCodes} = collectIdentitySets();
  const dictionary = fixture.seedBusinessLabels.dictionary;
  assert.deepEqual(Object.keys(dictionary.SKU_ATTRIBUTE_VALUE).sort(), [...skuValueCodes].sort());
  assert.deepEqual(Object.keys(dictionary.ORDER_OPTION_VALUE).sort(), [...orderOptionCodes].sort());
  assert.deepEqual(Object.keys(dictionary.SKU_ATTRIBUTE).sort(), [...attributeCodes].sort());
  assert.equal(skuValueCodes.size, 13);
  assert.equal(orderOptionCodes.size, 43);
  assert.equal(dictionary.SKU_ATTRIBUTE_VALUE.MEDIUM, undefined);
  assert.equal(dictionary.SKU_ATTRIBUTE_VALUE.LARGE, undefined);
  assert.equal(dictionary.SKU_ATTRIBUTE_VALUE.SMALL, undefined);
  assert.equal(dictionary.SKU_ATTRIBUTE_VALUE["DONENESS-MEDIUM"], "七分熟");
  assert.equal(dictionary.SKU_ATTRIBUTE_VALUE["DRINK_SIZE-MEDIUM"], "中杯");
  assert.equal(dictionary.SKU_ATTRIBUTE_VALUE["SIZE-MEDIUM"], "中杯");
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

test("seed executor has one kind/parent model across creation, refs, readback and preflight", () => {
  assert.match(executor, /const skuAttributeValueCode =/);
  assert.match(executor, /const skuVariantDimensionsFor =/);
  assert.match(executor, /skuVariantDimensionsFor\(source\.skus/);
  assert.match(executor, /skuVariantDimensionsFor\(entities\.skus/);
  assert.match(executor, /const skuAttributeValues = new Map\(\)/);
  assert.match(executor, /await materializeDictionary\("ORDER_OPTION_VALUE"/);
  assert.match(executor, /parentEntryRef: entry\.parentEntryRef/);
  assert.match(executor, /SEED_SKU_ATTRIBUTE_VALUE_PARENT_READBACK_INVALID/);
  assert.match(executor, /SEED_ORDER_OPTION_VALUE_PARENT_READBACK_INVALID/);
  assert.match(executor, /SEED_REFERENCE_PREFLIGHT_INVALID/);
  assert.match(executor, /valueCode: qualifiedValueCode/);
  assert.match(executor, /attributeValueRef: skuAttributeValueRef/);
  const skuAttributeReadback = executor.indexOf('await materializeDictionary("SKU_ATTRIBUTE"');
  const skuAttributeValueReadback = executor.indexOf('await materializeDictionary("SKU_ATTRIBUTE_VALUE"');
  const orderOptionReadback = executor.indexOf('await materializeDictionary("ORDER_OPTION_VALUE"');
  assert.ok(skuAttributeReadback >= 0 && skuAttributeReadback < skuAttributeValueReadback);
  assert.ok(skuAttributeValueReadback < orderOptionReadback);
  assert.doesNotMatch(executor, /const dictionaries =/);
  assert.doesNotMatch(executor, /referenceCodes\.values/);
  assert.doesNotMatch(executor, /refs\.optionValueRefs/);
  assert.doesNotMatch(executor, /attributeValueRef:\s*dictionaryRef\(refs,\s*"SKU_ATTRIBUTE_VALUE",\s*valueCode\)/);
});

test("seed sends catalog item codes to the owner unchanged", () => {
  assert.match(
    executor,
    /body: \{dataNodeRef: client\.dataNodeRef, name: source\.name, code: source\.catalogItemCode, shapeKey: source\.shapeKey, attributes: sourceBusinessAttributes\(source\)\}/,
  );
  assert.doesNotMatch(executor, /source\.catalogItemCode\.(?:toUpperCase|toLowerCase|replace)\(/);
});

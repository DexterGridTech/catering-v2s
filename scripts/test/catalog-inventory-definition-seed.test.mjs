import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {readCatalogInventoryOpenApi} from "../lib/catalog-inventory-openapi.mjs";

const fixture = JSON.parse(fs.readFileSync("contracts/policy/catalog-inventory-fixture-catalog.json", "utf8"));
const fixtureSchema = JSON.parse(fs.readFileSync("contracts/policy/catalog-inventory-fixture-catalog.schema.json", "utf8"));
const openApi = readCatalogInventoryOpenApi(process.cwd());

const assertDefinitionSeed = (seed) => {
  assert.deepEqual(
    seed.attributeDefinitions.map((definition) => definition.valueType).sort(),
    ["MULTI_SELECT", "SINGLE_SELECT", "TEXT"],
  );
  assert.deepEqual(
    [...new Set(seed.orderOptionDefinitions.map((definition) => definition.selectionMode))].sort(),
    ["MULTIPLE", "SINGLE"],
  );
  const materialCodes = new Set(seed.materialItemCodes);
  assert.equal(materialCodes.size, seed.materialItemCodes.length);
  for (const value of seed.orderOptionDefinitions.flatMap((definition) => definition.values)) {
    for (const materialCode of value.materialItemCodes) assert.ok(materialCodes.has(materialCode));
  }
  const identifierTypes = new Set(["BARCODE", "PLU", "MNEMONIC"]);
  const assignments = [...seed.itemAssignments, ...(seed.sourceItemAssignments ?? [])];
  for (const assignment of assignments) {
    for (const identifier of assignment.identifiers ?? []) {
      assert.ok(identifierTypes.has(identifier.identifierType), "identifier type must be one of the closed business types");
      assert.equal(typeof identifier.identifierValue, "string");
    }
    for (const sku of assignment.skuIdentifiers ?? []) {
      for (const identifier of sku.identifiers ?? []) {
        assert.ok(identifierTypes.has(identifier.identifierType), "identifier type must be one of the closed business types");
        assert.equal(typeof identifier.identifierValue, "string");
      }
    }
  }
  const caesar = seed.itemAssignments.find((assignment) => assignment.itemCode === "CAESAR-001");
  assert.ok(caesar);
  assert.deepEqual(caesar.tagCodes, ["RECOMMENDED"]);
  assert.equal(caesar.salesUnitCode, "SERVING");
  assert.equal(caesar.baseMeasureUnitCode, "SERVING");
  assert.equal(caesar.attributes.length, 3);
  assert.equal(caesar.orderOptions.length, 2);
  assert.equal(
    caesar.orderOptions.some((option) => option.definitionCode === "CAESAR_TOPPINGS" && option.minSelectionCount === 0 && option.maxSelectionCount === 2),
    true,
  );
  assert.equal(caesar.optionValueBoms.some((bom) => bom.valueCode === "CHICKEN" && bom.lines[0].quantity === 80), true);
  assert.equal(caesar.optionValueBoms.some((bom) => Object.hasOwn(bom.lines[0], "actualQuantity")), false);
  const milkTea = seed.itemAssignments.find((assignment) => assignment.itemCode === "MILK-TEA-001");
  assert.ok(milkTea);
  assert.equal(milkTea.optionValueBoms.find((bom) => bom.valueCode === "OAT_MILK").lines.some((line) => line.lineSign === "NEGATIVE"), true);
  assert.deepEqual(
    seed.productionTagDefinitions.map((entry) => entry.code),
    ["HOT_KITCHEN", "COLD_DISH", "BEVERAGE", "PACKING"],
  );
  assert.deepEqual(caesar.identifiers, [
    {identifierType: "BARCODE", identifierValue: "690100000001"},
    {identifierType: "MNEMONIC", identifierValue: "CAESAR"},
  ]);
  assert.deepEqual(caesar.preparationProfile, {
    productionDisplayName: "凯撒沙拉",
    estimatedPreparationSeconds: 180,
    preparationNotes: "出餐前拌匀并装盘",
  });
  assert.deepEqual(
    caesar.optionPreparationEffects.find((effect) => effect.valueCode === "CHICKEN"),
    {valueCode: "CHICKEN", preparationSecondsDelta: 30, instruction: "加鸡胸肉"},
  );
  const latte = seed.itemAssignments.find((assignment) => assignment.itemCode === "LATTE-001");
  assert.equal(latte.salesUnitCode, "CUP");
  assert.equal(latte.baseMeasureUnitCode, "MILLILITER");
  assert.equal(latte.skuIdentifiers.find((entry) => entry.skuCode === "LATTE-SKU-S").identifiers.length, 2);
  assert.equal(latte.skuPreparationOverrides.find((entry) => entry.skuCode === "LATTE-SKU-S").clearAfterReadback, true);
  const service = seed.sourceItemAssignments.find((assignment) => assignment.itemCode === "FEE-PACKAGING-001");
  assert.deepEqual(service.identifiers, [{identifierType: "MNEMONIC", identifierValue: "PACKING_SERVICE"}]);
  assert.equal(service.preparationProfile, null);
  assert.equal(JSON.stringify(seed).includes("skuBarcode"), false);
  assert.equal(JSON.stringify(seed).includes("productionProfiles"), false);
  assert.equal(JSON.stringify(seed).includes('"kind":"BARCODE"'), false);
};

test("catalog definition seed declares a complete HTTP-resolvable library and item override graph", () => {
  const seed = fixture.catalogDefinitionSeed;
  const attributeCreate = openApi.components.schemas.CatalogAttributeDefinitionCreateRequest;
  const optionCreate = openApi.components.schemas.CatalogOrderOptionDefinitionCreateRequest;
  const catalogDraft = openApi.components.schemas.CatalogItemSaveRequest.properties.sections.properties.catalogDraft;

  assert.ok(fixtureSchema.required.includes("catalogDefinitionSeed"));
  assert.ok(fixtureSchema.properties.catalogDefinitionSeed);
  assert.equal(fixtureSchema.additionalProperties, false);
  assertDefinitionSeed(seed);

  assert.deepEqual(attributeCreate.required, ["code", "name", "valueType", "options", "dataNodeRef"]);
  assert.deepEqual(attributeCreate.properties.valueType.enum, ["TEXT", "SINGLE_SELECT", "MULTI_SELECT"]);
  assert.deepEqual(optionCreate.required, ["code", "name", "selectionMode", "values", "dataNodeRef"]);
  assert.deepEqual(optionCreate.properties.selectionMode.enum, ["SINGLE", "MULTIPLE"]);
  assert.deepEqual(optionCreate.properties.values.items.required, ["code", "name", "displayOrder", "materials"]);
  for (const field of ["tagRefs", "salesUnitRef", "baseMeasureUnitRef", "attributeAssignments", "orderOptionConfigs"]) assert.ok(catalogDraft.properties[field]);
  assert.equal(catalogDraft.properties.salesUnitRefs, undefined);
  assert.deepEqual(catalogDraft.properties.attributeAssignments.items.required, ["definitionRef", "optionRefs"]);
  assert.deepEqual(catalogDraft.properties.orderOptionConfigs.items.required, ["definitionRef", "displayOrder", "required", "values"]);
  assert.deepEqual(catalogDraft.properties.orderOptionConfigs.items.properties.values.items.required, ["definitionValueRef", "defaultValue", "expectedBomVersion", "preparationEffect"]);
  assert.equal(catalogDraft.properties.orderOptionConfigs.items.properties.values.items.properties.materialQuantities, undefined);
  assert.ok(fixture.catalogDefinitionSeed.itemAssignments.some((assignment) => assignment.optionValueBoms?.length));
  assert.equal(JSON.stringify(fixture.catalogDefinitionSeed).includes("materialQuantities"), false);
  assert.ok(catalogDraft.properties.identifiers);
  assert.ok(catalogDraft.properties.preparationProfile);
  assert.ok(catalogDraft.properties.skus.items.properties.identifiers);
  assert.ok(catalogDraft.properties.skus.items.properties.preparationOverride);
});

test("definition seed rejects a retired fixed option mode as a red mutation", () => {
  const mutated = structuredClone(fixture.catalogDefinitionSeed);
  mutated.orderOptionDefinitions.find((definition) => definition.code === "CAESAR_TOPPINGS").selectionMode = "FIXED";

  assert.throws(() => assertDefinitionSeed(mutated), /Expected values to be strictly deep-equal/);
});

test("definition seed rejects a retired identifier shape as a red mutation", () => {
  const mutated = structuredClone(fixture.catalogDefinitionSeed);
  mutated.itemAssignments.find((assignment) => assignment.itemCode === "CAESAR-001").identifiers[0].identifierType = "INTERNAL_CODE";

  assert.throws(() => assertDefinitionSeed(mutated), /identifier type must be one of the closed business types/);
});

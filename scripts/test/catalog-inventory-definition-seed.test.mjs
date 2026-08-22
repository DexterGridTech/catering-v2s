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
  assert.deepEqual(catalogDraft.properties.orderOptionConfigs.items.required, ["definitionRef", "required", "values"]);
  assert.deepEqual(catalogDraft.properties.orderOptionConfigs.items.properties.values.items.required, ["definitionValueRef", "defaultValue", "expectedBomVersion"]);
  assert.equal(catalogDraft.properties.orderOptionConfigs.items.properties.values.items.properties.materialQuantities, undefined);
  assert.ok(fixture.catalogDefinitionSeed.itemAssignments.some((assignment) => assignment.optionValueBoms?.length));
  assert.equal(JSON.stringify(fixture.catalogDefinitionSeed).includes("materialQuantities"), false);
});

test("definition seed rejects a retired fixed option mode as a red mutation", () => {
  const mutated = structuredClone(fixture.catalogDefinitionSeed);
  mutated.orderOptionDefinitions.find((definition) => definition.code === "CAESAR_TOPPINGS").selectionMode = "FIXED";

  assert.throws(() => assertDefinitionSeed(mutated), /Expected values to be strictly deep-equal/);
});

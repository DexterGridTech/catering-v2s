#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalog = JSON.parse(fs.readFileSync(
  path.join(root, "doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json"),
  "utf8",
));
const materialized = JSON.parse(fs.readFileSync(
  path.join(root, "contracts/openapi/paths/platform-admin/extension-definition.paths.json"),
  "utf8",
));

const stale = "EXTENSION_DEFINITION_REVISION_STALE";
const invalid = "EXTENSION_FILTER_INVALID";
const targetOperations = [
  "getPlatformContractOverviewPage",
  "getPlatformOrganizationOverviewPage",
  "getOperationsOrganizationBrands",
  "getOperationsOrganizationTenants",
  "getOperationsOrganizationHeadCompanies",
  "getOperationsOrganizationStores",
  "getOperationsContracts",
];
const targetOperationFiles = {
  getPlatformContractOverviewPage: "contracts/openapi/paths/platform-admin/contract-overview.paths.json",
  getPlatformOrganizationOverviewPage: "contracts/openapi/paths/platform-admin/organization-overview.paths.json",
  getOperationsOrganizationBrands: "contracts/openapi/paths/operations-admin/brand-management.paths.json",
  getOperationsOrganizationTenants: "contracts/openapi/paths/operations-admin/tenant-management.paths.json",
  getOperationsOrganizationHeadCompanies: "contracts/openapi/paths/operations-admin/head-company-management.paths.json",
  getOperationsOrganizationStores: "contracts/openapi/paths/operations-admin/store-management.paths.json",
  getOperationsContracts: "contracts/openapi/paths/operations-admin/contract-management.paths.json",
};

assert.deepEqual(catalog.operationErrorAugmentations.replaceExtensionDefinition, [
  "EXTENSION_DEFINITION_INVALID",
  "EXTENSION_DEFINITION_VERSION_CONFLICT",
]);
for (const operationId of targetOperations) {
  assert.deepEqual(catalog.operationErrorAugmentations[operationId], [stale, invalid]);
}

const replaceErrors = materialized.paths["/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}"].put[
  "x-error-codes"
];
assert.equal(replaceErrors.includes(stale), false);
assert.equal(replaceErrors.includes(invalid), false);

for (const operationId of targetOperations) {
  const document = JSON.parse(fs.readFileSync(path.join(root, targetOperationFiles[operationId]), "utf8"));
  const operation = Object.values(document.paths)
    .flatMap(item => Object.values(item))
    .find(item => item.operationId === operationId);
  if (!operation) throw new Error(`EXTENSION_TARGET_OPERATION_MISSING:${operationId}`);
  const parameters = Object.fromEntries(
    operation.parameters
      .filter(parameter => ["extensionFilters", "definitionRevision"].includes(parameter.name))
      .map(parameter => [parameter.name, parameter]),
  );
  assert.equal(parameters.extensionFilters.schema.$ref, "../../components/extension/extension.schemas.json#/components/schemas/ExtensionFilterQuery");
  assert.deepEqual(parameters.definitionRevision.schema, {type: "integer", format: "int64", minimum: 0});
  assert.equal(operation["x-error-codes"].includes(stale), true);
  assert.equal(operation["x-error-codes"].includes(invalid), true);
}

const operationsGenerated = fs.readFileSync(
  path.join(root, "apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts"),
  "utf8",
);
const platformGenerated = fs.readFileSync(
  path.join(root, "apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts"),
  "utf8",
);
for (const operationId of targetOperations) {
  const generated = operationId.startsWith("getPlatform") ? platformGenerated : operationsGenerated;
  assert.match(
    generated,
    new RegExp(`"${operationId}": \\{[\\s\\S]*?extensionFilters\\?: ExtensionFilterQuery;[\\s\\S]*?definitionRevision\\?: number;`),
  );
}

console.log("EXTENSION_FIELD_CONTRACT_STRUCTURE=PASS");

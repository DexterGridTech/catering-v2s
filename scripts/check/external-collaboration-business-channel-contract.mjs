#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = path.join(root, "contracts/collaboration/external-platform-catalog.json");
const schemaPath = path.join(root, "contracts/collaboration/external-platform-catalog.schema.json");
const capabilities = new Set([
  "MASTER_DATA_SYNC",
  "MEMBER_BENEFIT",
  "GROUP_BUY",
  "TAKEAWAY",
  "INVENTORY_SYNC",
  "TAKEAWAY_DELIVERY",
  "ORDER_SYNC",
]);
const nodeTypes = new Set(["COMMERCIAL_GROUP", "REGION", "PROJECT", "HEAD_COMPANY", "STORE"]);
const authKinds = new Set(["EXTERNAL_GRANT", "INTERNAL_MAPPING", "NO_MAPPING"]);
const unbindKinds = new Set(["LOCAL_ONLY", "REQUIRES_ADAPTER_UNBIND"]);

function fail(code, detail) {
  throw new Error(`${code}${detail ? `:${detail}` : ""}`);
}

function expect(condition, code, detail) {
  if (!condition) fail(code, detail);
}

function object(value, code, detail) {
  expect(value !== null && typeof value === "object" && !Array.isArray(value), code, detail);
  return value;
}

function nonEmpty(value, code, detail) {
  expect(typeof value === "string" && value.trim().length > 0, code, detail);
}

function unique(values, code) {
  expect(new Set(values).size === values.length, code);
}

function validateAttributeValues(values, systemCode, capabilityClass) {
  object(values, "CONTRACT_ATTRIBUTE_VALUES", `${systemCode}:${capabilityClass}`);
  const allowed = new Set(["groupBuyMappingDirection", "menuCollaborationDirection"]);
  for (const key of Object.keys(values)) {
    expect(allowed.has(key), "CONTRACT_ATTRIBUTE_KEY_UNKNOWN", `${systemCode}:${capabilityClass}:${key}`);
    const allowedValues = key === "groupBuyMappingDirection"
      ? ["EXTERNAL_TO_INTERNAL", "INTERNAL_TO_EXTERNAL"]
      : ["PULL_ONLY"];
    expect(allowedValues.includes(values[key]), "CONTRACT_ATTRIBUTE_VALUE_UNKNOWN", `${systemCode}:${capabilityClass}:${key}`);
  }
}

function validate() {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  object(catalog, "CONTRACT_ROOT_OBJECT");
  expect(catalog.schemaVersion === 1, "CONTRACT_SCHEMA_VERSION");
  expect(Array.isArray(catalog.externalSystems) && catalog.externalSystems.length > 0, "CONTRACT_SYSTEMS_REQUIRED");
  expect(Array.isArray(catalog.providerProfiles) && catalog.providerProfiles.length > 0, "CONTRACT_PROVIDERS_REQUIRED");
  unique(catalog.externalSystems.map((row) => row.externalSystemCode), "CONTRACT_EXTERNAL_SYSTEM_DUPLICATE");
  unique(catalog.providerProfiles.map((row) => row.providerCode), "CONTRACT_PROVIDER_DUPLICATE");
  const systems = new Map();
  for (const system of catalog.externalSystems) {
    nonEmpty(system.externalSystemCode, "CONTRACT_SYSTEM_CODE");
    nonEmpty(system.displayName, "CONTRACT_SYSTEM_DISPLAY_NAME", system.externalSystemCode);
    expect(["PLANNED", "AVAILABLE"].includes(system.catalogStatus), "CONTRACT_SYSTEM_STATUS", system.externalSystemCode);
    expect(!Object.hasOwn(system, "catalogStatusDisplayName"), "CONTRACT_SYSTEM_STATUS_DISPLAY_NAME_RETIRED", system.externalSystemCode);
    expect(!Object.hasOwn(system, "attributeDictionary"), "CONTRACT_DESCRIPTOR_DICTIONARY_RETIRED", system.externalSystemCode);
    expect(Array.isArray(system.capabilities) && system.capabilities.length > 0, "CONTRACT_SYSTEM_CAPABILITIES", system.externalSystemCode);
    unique(system.capabilities.map((entry) => entry.capabilityClass), "CONTRACT_CAPABILITY_DUPLICATE");
    for (const entry of system.capabilities) {
      expect(capabilities.has(entry.capabilityClass), "CONTRACT_CAPABILITY_UNKNOWN", `${system.externalSystemCode}:${entry.capabilityClass}`);
      nonEmpty(entry.displayName, "CONTRACT_CAPABILITY_DISPLAY_NAME", `${system.externalSystemCode}:${entry.capabilityClass}`);
      validateAttributeValues(entry.attributeValues, system.externalSystemCode, entry.capabilityClass);
      expect(!Object.hasOwn(entry, "attributeValueLabels"), "CONTRACT_ATTRIBUTE_VALUE_LABELS_RETIRED", `${system.externalSystemCode}:${entry.capabilityClass}`);
    }
    systems.set(system.externalSystemCode, new Set(system.capabilities.map((entry) => entry.capabilityClass)));
  }
  for (const provider of catalog.providerProfiles) {
    nonEmpty(provider.providerCode, "CONTRACT_PROVIDER_CODE");
    nonEmpty(provider.displayName, "CONTRACT_PROVIDER_DISPLAY_NAME", provider.providerCode);
    expect(systems.has(provider.externalSystemCode), "CONTRACT_PROVIDER_SYSTEM_UNKNOWN", provider.providerCode);
    expect(Array.isArray(provider.businessScope) && provider.businessScope.length > 0, "CONTRACT_PROVIDER_SCOPE", provider.providerCode);
    expect(!Object.hasOwn(provider, "businessScopeDisplayNames"), "CONTRACT_PROVIDER_SCOPE_DISPLAY_NAMES_RETIRED", provider.providerCode);
    unique(provider.businessScope, "CONTRACT_PROVIDER_SCOPE_DUPLICATE");
    for (const capability of provider.businessScope) expect(capabilities.has(capability), "CONTRACT_PROVIDER_SCOPE_UNKNOWN", `${provider.providerCode}:${capability}`);
    expect(provider.businessScope.every((entry) => systems.get(provider.externalSystemCode).has(entry)), "CONTRACT_PROVIDER_SCOPE_EXCEEDED", provider.providerCode);
    expect(Array.isArray(provider.bindableNodeTypes) && provider.bindableNodeTypes.length > 0, "CONTRACT_PROVIDER_NODE_TYPES", provider.providerCode);
    expect(!Object.hasOwn(provider, "bindableNodeTypeDisplayNames"), "CONTRACT_PROVIDER_NODE_DISPLAY_NAMES_RETIRED", provider.providerCode);
    unique(provider.bindableNodeTypes, "CONTRACT_PROVIDER_NODE_TYPE_DUPLICATE");
    for (const nodeType of provider.bindableNodeTypes) expect(nodeTypes.has(nodeType), "CONTRACT_PROVIDER_NODE_TYPE_UNKNOWN", `${provider.providerCode}:${nodeType}`);
    expect(authKinds.has(provider.authenticationKind), "CONTRACT_PROVIDER_AUTH_KIND", provider.providerCode);
    expect(!Object.hasOwn(provider, "authenticationKindDisplayName"), "CONTRACT_PROVIDER_AUTH_DISPLAY_NAME_RETIRED", provider.providerCode);
    expect(unbindKinds.has(provider.unbindKind), "CONTRACT_PROVIDER_UNBIND_KIND", provider.providerCode);
    expect(!Object.hasOwn(provider, "unbindKindDisplayName"), "CONTRACT_PROVIDER_UNBIND_DISPLAY_NAME_RETIRED", provider.providerCode);
    expect(["PLANNED", "AVAILABLE"].includes(provider.catalogStatus), "CONTRACT_PROVIDER_STATUS", provider.providerCode);
    expect(!Object.hasOwn(provider, "catalogStatusDisplayName"), "CONTRACT_PROVIDER_STATUS_DISPLAY_NAME_RETIRED", provider.providerCode);
  }
  const forbidden = ["TAKEOUT", "GROUP_BUYING", "SELF_SERVICE"];
  const serialized = JSON.stringify(catalog);
  for (const value of forbidden) expect(!serialized.includes(value), "CONTRACT_FROZEN_LITERAL_REGRESSION", value);
  expect(!serialized.match(/\"GROUP\"/), "CONTRACT_BARE_GROUP_REGRESSION");
  console.log(`EXTERNAL_COLLABORATION_CONTRACT_PASS systems=${catalog.externalSystems.length} providers=${catalog.providerProfiles.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) validate();

export { validate };

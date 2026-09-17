#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const profile = JSON.parse(fs.readFileSync(path.join(root, "scripts/dev/profiles/r5-full.json"), "utf8"));
const fixture = JSON.parse(fs.readFileSync(path.join(root, "doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json"), "utf8"));
const isChineseBusinessText = (value) => typeof value === "string" && /[\u3400-\u9fff]/.test(value) && !/[A-Za-z]/.test(value);
const requireChineseBusinessText = (value, label) => {
  if (!isChineseBusinessText(value)) throw new Error(`R5_SEED_BUSINESS_LABEL_INVALID:${label}`);
};
const THREE_STATE_VALUES = new Set(["ENABLED", "DISABLED", "VOIDED"]);
const requireThreeStateCoverage = (entries, label) => {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error(`R5_SEED_STATUS_COLLECTION_INVALID:${label}`);
  const statuses = new Set();
  for (const entry of entries) {
    if (!THREE_STATE_VALUES.has(entry?.status)) throw new Error(`R5_SEED_STATUS_VALUE_INVALID:${label}`);
    statuses.add(entry.status);
  }
  for (const status of THREE_STATE_VALUES) if (!statuses.has(status)) throw new Error(`R5_SEED_STATUS_COVERAGE_MISSING:${label}:${status}`);
};
const requireRolePermission = (source, roleKey, pageAccessKey, capabilityKey) => {
  const role = source.stableFixtures.workspaceIam.roles.find((entry) => entry.key === roleKey);
  if (!role) throw new Error(`R5_SEED_ROLE_PERMISSION_ROLE_MISSING:${roleKey}`);
  if (!role.pageAccessKeys?.includes(pageAccessKey)) throw new Error(`R5_SEED_ROLE_PERMISSION_PAGE_MISSING:${roleKey}:${pageAccessKey}`);
  if (!role.actionCapabilityKeys?.includes(capabilityKey)) throw new Error(`R5_SEED_ROLE_PERMISSION_CAPABILITY_MISSING:${roleKey}:${capabilityKey}`);
};
const validateSalesMenuSeedRolePrerequisites = (source) => {
  requireRolePermission(source, "role-project", "PG-BUSINESS-CHANNEL-PROJECT", "BC-BUSINESS-CHANNEL-PROJECT-EDIT");
  requireRolePermission(source, "role-store", "PG-BUSINESS-CHANNEL-STORE", "BC-BUSINESS-CHANNEL-STORE-EDIT");
  requireRolePermission(source, "role-store", "PG-SALES-MENU-STORE", "EDIT_STORE_SALES_MENU");
};
const EXTENSION_HOST_TYPES = new Set(["BRAND", "TENANT", "HEAD_COMPANY", "STORE", "CONTRACT", "COMMERCIAL_GROUP", "REGION", "PROJECT"]);
const FLAT_EXTENSION_HOST_TYPES = new Set(["BRAND", "TENANT", "HEAD_COMPANY", "STORE", "CONTRACT"]);
const EXTENSION_FIELD_TYPES = new Set(["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT"]);
const validateExtensionSeedShape = (source) => {
  const definitions = source.stableFixtures.extensionDefinitions;
  if (!Array.isArray(definitions) || definitions.length !== 9) throw new Error("R5_SEED_EXTENSION_DEFINITION_SET_INVALID");
  const hosts = new Set();
  const types = new Set();
  const flags = new Set();
  let disabled = 0;
  for (const definition of definitions) {
    if (!definition || !EXTENSION_HOST_TYPES.has(definition.hostType) || hosts.has(definition.hostType) || !Array.isArray(definition.fields) || definition.fields.length === 0) {
      throw new Error(`R5_SEED_EXTENSION_DEFINITION_INVALID:${definition?.hostType ?? "UNKNOWN"}`);
    }
    hosts.add(definition.hostType);
    const keys = new Set();
    for (const field of definition.fields) {
      if (!field || typeof field.key !== "string" || !/^[a-z][A-Za-z0-9_]{0,79}$/.test(field.key) || keys.has(field.key)
        || typeof field.label !== "string" || !field.label || !EXTENSION_FIELD_TYPES.has(field.type)
        || !["ENABLED", "DISABLED"].includes(field.status) || typeof field.required !== "boolean") {
        throw new Error(`R5_SEED_EXTENSION_FIELD_INVALID:${definition.hostType}`);
      }
      keys.add(field.key);
      types.add(field.type);
      const options = field.options ?? [];
      if (!Array.isArray(options) || (field.type === "SELECT" && options.length === 0)
        || (field.type !== "SELECT" && options.length > 0) || options.some((value) => typeof value !== "string" || !value)) {
        throw new Error(`R5_SEED_EXTENSION_OPTIONS_INVALID:${definition.hostType}:${field.key}`);
      }
      if (field.status === "DISABLED") disabled += 1;
      if (FLAT_EXTENSION_HOST_TYPES.has(definition.hostType)) {
        if (typeof field.listDisplay !== "boolean" || typeof field.searchable !== "boolean") throw new Error(`R5_SEED_EXTENSION_FLAGS_INVALID:${definition.hostType}:${field.key}`);
        flags.add(`${field.listDisplay ? "LIST" : "NO_LIST"}:${field.searchable ? "SEARCH" : "NO_SEARCH"}`);
      } else if (field.listDisplay !== null || field.searchable !== null) {
        throw new Error(`R5_SEED_EXTENSION_NA_FLAGS_INVALID:${definition.hostType}:${field.key}`);
      }
    }
  }
  for (const hostType of EXTENSION_HOST_TYPES) if (!hosts.has(hostType)) throw new Error(`R5_SEED_EXTENSION_HOST_MISSING:${hostType}`);
  for (const type of EXTENSION_FIELD_TYPES) if (!types.has(type)) throw new Error(`R5_SEED_EXTENSION_TYPE_MISSING:${type}`);
  for (const combination of ["NO_LIST:NO_SEARCH", "LIST:NO_SEARCH", "NO_LIST:SEARCH", "LIST:SEARCH"]) if (!flags.has(combination)) throw new Error(`R5_SEED_EXTENSION_FLAG_MISSING:${combination}`);
  if (disabled === 0) throw new Error("R5_SEED_EXTENSION_DISABLED_MISSING");
};
const validateExtensionRevisionChangeFixture = (source) => {
  const definitions = source.stableFixtures.extensionDefinitions;
  const changes = source.stableFixtures.extensionDefinitionRevisionChanges;
  if (!Array.isArray(changes) || changes.length === 0) throw new Error("R5_SEED_EXTENSION_REVISION_CHANGE_MISSING");
  const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const seen = new Set();
  for (const change of changes) {
    const definition = definitionsByKey.get(change?.definitionKey);
    if (!definition?.fields?.some((field) => field.key === change?.fieldKey) || seen.has(change?.definitionKey) || typeof change?.displaySuffix !== "string" || !change.displaySuffix.trim()) {
      throw new Error("R5_SEED_EXTENSION_REVISION_CHANGE_INVALID");
    }
    seen.add(change.definitionKey);
  }
};
const extensionDisplayTextEntries = (source, hostType, values, labelPrefix) => {
  const definition = source.stableFixtures.extensionDefinitions.find((entry) => entry.hostType === hostType);
  const fields = new Map((definition?.fields ?? []).map((field) => [field.key, field]));
  return Object.entries(values ?? {})
    .filter(([key]) => ["TEXT", "SELECT"].includes(fields.get(key)?.type) && fields.get(key)?.listDisplay === true)
    .map(([key, value]) => [`${labelPrefix}:${key}`, value]);
};
const displayTextDenominator = (source) => {
  const fixtures = source.stableFixtures;
  const organization = fixtures.organization;
  return [
    ["bootstrap.displayName", source.bootstrapBoundary.displayName],
    ...fixtures.platformAdmins.map((entry) => [`platformAdmin:${entry.key}`, entry.displayName]),
    ...fixtures.groupWorkspaces.flatMap((entry) => [[`groupWorkspace:${entry.key}`, entry.name], [`operationsTitle:${entry.key}`, entry.operationsTitle ?? `${entry.name}运营管理后台`]]),
    ...fixtures.extensionDefinitions.flatMap((definition) => definition.fields.map((field) => [`extensionLabel:${definition.key}:${field.key}`, field.label])),
    ...organization.commercialGroups.flatMap((entry) => [[`commercialGroup:${entry.key}`, entry.name], ...extensionDisplayTextEntries(source, "COMMERCIAL_GROUP", entry.extensionValues, `commercialGroupExtension:${entry.key}`)]),
    ...organization.regions.flatMap((entry) => [[`region:${entry.key}`, entry.name], ...extensionDisplayTextEntries(source, "REGION", entry.extensionValues, `regionExtension:${entry.key}`)]),
    ...organization.projects.flatMap((entry) => [[`project:${entry.key}`, entry.name], ...(entry.phases ?? []).map((value, index) => [`projectPhase:${entry.key}:${index}`, value]), ...extensionDisplayTextEntries(source, "PROJECT", entry.extensionValues, `projectExtension:${entry.key}`)]),
    ...organization.brands.flatMap((entry) => [[`brand:${entry.key}`, entry.name], ...extensionDisplayTextEntries(source, "BRAND", entry.extensionValues, `brandExtension:${entry.key}`)]),
    ...organization.tenants.flatMap((entry) => [[`tenant:${entry.key}`, entry.name], ...extensionDisplayTextEntries(source, "TENANT", entry.extensionValues, `tenantExtension:${entry.key}`)]),
    ...organization.headCompanies.flatMap((entry) => [[`headCompany:${entry.key}`, entry.name], ...extensionDisplayTextEntries(source, "HEAD_COMPANY", entry.extensionValues, `headCompanyExtension:${entry.key}`)]),
    ...organization.stores.flatMap((entry) => [[`store:${entry.key}`, entry.name], ...extensionDisplayTextEntries(source, "STORE", entry.extensionValues, `storeExtension:${entry.key}`)]),
    ...fixtures.workspaceIam.roles.map((entry) => [`role:${entry.key}`, entry.name]),
    ...fixtures.workspaceIam.accounts.map((entry) => [`account:${entry.key}`, entry.displayName]),
    ...fixtures.contracts.flatMap((entry) => [[`contractPhase:${entry.key}`, entry.phaseNameSnapshot], ...extensionDisplayTextEntries(source, "CONTRACT", entry.extensionValues, `contractExtension:${entry.key}`), ...(entry.items ?? []).map((item) => [`contractItem:${entry.key}:${item.code}`, item.name])]),
    ...source.executionPlan.invitationPlans.filter((entry) => entry.displayName).map((entry) => [`invitationAccount:${entry.invitationKey}`, entry.displayName])
  ].filter(([, value]) => value !== undefined && value !== null);
};
const validateBusinessDisplayLabels = (source) => {
  for (const [label, value] of displayTextDenominator(source)) requireChineseBusinessText(value, label);
};
validateBusinessDisplayLabels(fixture);
validateExtensionSeedShape(fixture);
validateExtensionRevisionChangeFixture(fixture);
validateSalesMenuSeedRolePrerequisites(fixture);
if (process.argv.includes("--self-test")) {
  const redMutation = structuredClone(fixture);
  redMutation.stableFixtures.organization.commercialGroups[0].name = "fixture-group";
  let rejected = false;
  try { validateBusinessDisplayLabels(redMutation); } catch (error) { rejected = String(error.message).startsWith("R5_SEED_BUSINESS_LABEL_INVALID:commercialGroup:"); }
  if (!rejected) throw new Error("R5_SEED_BUSINESS_LABEL_RED_MUTATION_MISSED");
  const permissionRedMutation = structuredClone(fixture);
  permissionRedMutation.stableFixtures.workspaceIam.roles.find((role) => role.key === "role-store").actionCapabilityKeys = permissionRedMutation.stableFixtures.workspaceIam.roles.find((role) => role.key === "role-store").actionCapabilityKeys.filter((key) => key !== "EDIT_STORE_SALES_MENU");
  rejected = false;
  try { validateSalesMenuSeedRolePrerequisites(permissionRedMutation); } catch (error) { rejected = String(error.message) === "R5_SEED_ROLE_PERMISSION_CAPABILITY_MISSING:role-store:EDIT_STORE_SALES_MENU"; }
  if (!rejected) throw new Error("R5_SEED_ROLE_PERMISSION_RED_MUTATION_MISSED");
  process.stdout.write("R5_SEED_PLAN_SELF_TEST=PASS; RED=TECHNICAL_ENGLISH_DISPLAY_TEXT,SALES_MENU_ROLE_CAPABILITY\n");
}
if (fixture.stableFixtures.workspaceIam.roles.length !== 8) throw new Error("R5_SEED_ROLE_EXPERIENCE_DENOMINATOR_DRIFT");
for (const roleKey of ["role-store-inventory", "role-store-manager"]) if (!fixture.stableFixtures.workspaceIam.roles.some((role) => role.key === roleKey)) throw new Error(`R5_SEED_ROLE_EXPERIENCE_MISSING:${roleKey}`);
for (const [label, entries] of [
  ["organization.regions", fixture.stableFixtures.organization.regions],
  ["organization.projects", fixture.stableFixtures.organization.projects],
  ["organization.brands", fixture.stableFixtures.organization.brands],
  ["organization.tenants", fixture.stableFixtures.organization.tenants],
  ["organization.headCompanies", fixture.stableFixtures.organization.headCompanies],
  ["organization.stores", fixture.stableFixtures.organization.stores],
  ["workspaceIam.roles", fixture.stableFixtures.workspaceIam.roles],
  ["workspaceIam.accounts", fixture.stableFixtures.workspaceIam.accounts],
]) requireThreeStateCoverage(entries, label);
const facts = {platformAdmins: fixture.stableFixtures.platformAdmins.length, groupWorkspaces: fixture.stableFixtures.groupWorkspaces.length, activeAssets: fixture.stableFixtures.assets.filter((entry) => entry.status === "ACTIVE").length, extensionDefinitions: fixture.stableFixtures.extensionDefinitions.length, commercialGroups: fixture.stableFixtures.organization.commercialGroups.length, regions: fixture.stableFixtures.organization.regions.length, projects: fixture.stableFixtures.organization.projects.length, brands: fixture.stableFixtures.organization.brands.length, tenants: fixture.stableFixtures.organization.tenants.length, headCompanies: fixture.stableFixtures.organization.headCompanies.length, stores: fixture.stableFixtures.organization.stores.length, roles: fixture.stableFixtures.workspaceIam.roles.length, accounts: fixture.stableFixtures.workspaceIam.accounts.length, assignments: fixture.stableFixtures.workspaceIam.assignments.length, invitationStateFixtures: fixture.stableFixtures.workspaceIam.invitationStates.length, contracts: fixture.stableFixtures.contracts.length};
for (const [key, expected] of Object.entries(profile.expectedCounts)) if (facts[key] !== expected) throw new Error(`R5_SEED_PROFILE_DRIFT:${key}:${facts[key]}!=${expected}`);
if (fixture.scenarioPrerequisitePolicy.denominator !== profile.scenarioDenominator) throw new Error("R5_SEED_SCENARIO_DENOMINATOR_DRIFT");
process.stdout.write(`R5_SEED_DRY_RUN=PASS; PROFILE=${profile.profile}; SCENARIOS=${profile.scenarioDenominator}; FIXTURES=${Object.keys(facts).length}; STAGES=${fixture.seedStages.map((stage) => stage.id).join(",")}\n`);

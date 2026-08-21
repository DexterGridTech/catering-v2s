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
const displayTextDenominator = (source) => {
  const fixtures = source.stableFixtures;
  const organization = fixtures.organization;
  return [
    ["bootstrap.displayName", source.bootstrapBoundary.displayName],
    ...fixtures.platformAdmins.map((entry) => [`platformAdmin:${entry.key}`, entry.displayName]),
    ...fixtures.groupWorkspaces.flatMap((entry) => [[`groupWorkspace:${entry.key}`, entry.name], [`operationsTitle:${entry.key}`, entry.operationsTitle ?? `${entry.name}运营管理后台`]]),
    ...fixtures.extensionDefinitions.flatMap((definition) => definition.fields.map((field) => [`extensionLabel:${definition.key}:${field.key}`, field.label])),
    ...organization.commercialGroups.flatMap((entry) => [[`commercialGroup:${entry.key}`, entry.name], ...Object.entries(entry.extensionValues ?? {}).map(([key, value]) => [`commercialGroupExtension:${entry.key}:${key}`, value])]),
    ...organization.regions.flatMap((entry) => [[`region:${entry.key}`, entry.name], ...Object.entries(entry.extensionValues ?? {}).map(([key, value]) => [`regionExtension:${entry.key}:${key}`, value])]),
    ...organization.projects.flatMap((entry) => [[`project:${entry.key}`, entry.name], ...(entry.phases ?? []).map((value, index) => [`projectPhase:${entry.key}:${index}`, value]), ...Object.entries(entry.extensionValues ?? {}).map(([key, value]) => [`projectExtension:${entry.key}:${key}`, value])]),
    ...organization.brands.flatMap((entry) => [[`brand:${entry.key}`, entry.name], ...Object.entries(entry.extensionValues ?? {}).map(([key, value]) => [`brandExtension:${entry.key}:${key}`, value])]),
    ...organization.tenants.flatMap((entry) => [[`tenant:${entry.key}`, entry.name], ...Object.entries(entry.extensionValues ?? {}).map(([key, value]) => [`tenantExtension:${entry.key}:${key}`, value])]),
    ...organization.headCompanies.flatMap((entry) => [[`headCompany:${entry.key}`, entry.name], ...Object.entries(entry.extensionValues ?? {}).map(([key, value]) => [`headCompanyExtension:${entry.key}:${key}`, value])]),
    ...organization.stores.flatMap((entry) => [[`store:${entry.key}`, entry.name], [`storeFloor:${entry.key}`, entry.extensionValues?.floorLabel]]),
    ...fixtures.workspaceIam.roles.map((entry) => [`role:${entry.key}`, entry.name]),
    ...fixtures.workspaceIam.accounts.map((entry) => [`account:${entry.key}`, entry.displayName]),
    ...fixtures.contracts.flatMap((entry) => [[`contractPhase:${entry.key}`, entry.phaseNameSnapshot], ...Object.entries(entry.extensionValues ?? {}).map(([key, value]) => [`contractExtension:${entry.key}:${key}`, value]), ...(entry.items ?? []).map((item) => [`contractItem:${entry.key}:${item.code}`, item.name])]),
    ...source.executionPlan.invitationPlans.filter((entry) => entry.displayName).map((entry) => [`invitationAccount:${entry.invitationKey}`, entry.displayName])
  ].filter(([, value]) => value !== undefined && value !== null);
};
const validateBusinessDisplayLabels = (source) => {
  for (const [label, value] of displayTextDenominator(source)) requireChineseBusinessText(value, label);
};
validateBusinessDisplayLabels(fixture);
if (process.argv.includes("--self-test")) {
  const redMutation = structuredClone(fixture);
  redMutation.stableFixtures.organization.commercialGroups[0].name = "fixture-group";
  let rejected = false;
  try { validateBusinessDisplayLabels(redMutation); } catch (error) { rejected = String(error.message).startsWith("R5_SEED_BUSINESS_LABEL_INVALID:commercialGroup:"); }
  if (!rejected) throw new Error("R5_SEED_BUSINESS_LABEL_RED_MUTATION_MISSED");
  process.stdout.write("R5_SEED_PLAN_SELF_TEST=PASS; RED=TECHNICAL_ENGLISH_DISPLAY_TEXT\n");
}
if (fixture.stableFixtures.workspaceIam.roles.length !== 7) throw new Error("R5_SEED_ROLE_EXPERIENCE_DENOMINATOR_DRIFT");
for (const roleKey of ["role-store-inventory", "role-store-manager"]) if (!fixture.stableFixtures.workspaceIam.roles.some((role) => role.key === roleKey)) throw new Error(`R5_SEED_ROLE_EXPERIENCE_MISSING:${roleKey}`);
const facts = {platformAdmins: fixture.stableFixtures.platformAdmins.length, groupWorkspaces: fixture.stableFixtures.groupWorkspaces.length, activeAssets: fixture.stableFixtures.assets.filter((entry) => entry.status === "ACTIVE").length, extensionDefinitions: fixture.stableFixtures.extensionDefinitions.length, commercialGroups: fixture.stableFixtures.organization.commercialGroups.length, regions: fixture.stableFixtures.organization.regions.length, projects: fixture.stableFixtures.organization.projects.length, brands: fixture.stableFixtures.organization.brands.length, tenants: fixture.stableFixtures.organization.tenants.length, headCompanies: fixture.stableFixtures.organization.headCompanies.length, stores: fixture.stableFixtures.organization.stores.length, roles: fixture.stableFixtures.workspaceIam.roles.length, accounts: fixture.stableFixtures.workspaceIam.accounts.length, assignments: fixture.stableFixtures.workspaceIam.assignments.length, invitationStateFixtures: fixture.stableFixtures.workspaceIam.invitationStates.length, contracts: fixture.stableFixtures.contracts.length};
for (const [key, expected] of Object.entries(profile.expectedCounts)) if (facts[key] !== expected) throw new Error(`R5_SEED_PROFILE_DRIFT:${key}:${facts[key]}!=${expected}`);
if (fixture.scenarioPrerequisitePolicy.denominator !== profile.scenarioDenominator) throw new Error("R5_SEED_SCENARIO_DENOMINATOR_DRIFT");
process.stdout.write(`R5_SEED_DRY_RUN=PASS; PROFILE=${profile.profile}; SCENARIOS=${profile.scenarioDenominator}; FIXTURES=${Object.keys(facts).length}; STAGES=${fixture.seedStages.map((stage) => stage.id).join(",")}\n`);

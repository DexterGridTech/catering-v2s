#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const profile = JSON.parse(fs.readFileSync(path.join(root, "scripts/dev/profiles/r5-full.json"), "utf8"));
const fixture = JSON.parse(fs.readFileSync(path.join(root, "doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json"), "utf8"));
const facts = {platformAdmins: fixture.stableFixtures.platformAdmins.length, groupWorkspaces: fixture.stableFixtures.groupWorkspaces.length, activeAssets: fixture.stableFixtures.assets.filter((entry) => entry.status === "ACTIVE").length, extensionDefinitions: fixture.stableFixtures.extensionDefinitions.length, commercialGroups: fixture.stableFixtures.organization.commercialGroups.length, regions: fixture.stableFixtures.organization.regions.length, projects: fixture.stableFixtures.organization.projects.length, brands: fixture.stableFixtures.organization.brands.length, tenants: fixture.stableFixtures.organization.tenants.length, headCompanies: fixture.stableFixtures.organization.headCompanies.length, stores: fixture.stableFixtures.organization.stores.length, roles: fixture.stableFixtures.workspaceIam.roles.length, accounts: fixture.stableFixtures.workspaceIam.accounts.length, assignments: fixture.stableFixtures.workspaceIam.assignments.length, invitationStateFixtures: fixture.stableFixtures.workspaceIam.invitationStates.length, contracts: fixture.stableFixtures.contracts.length};
for (const [key, expected] of Object.entries(profile.expectedCounts)) if (facts[key] !== expected) throw new Error(`R5_SEED_PROFILE_DRIFT:${key}:${facts[key]}!=${expected}`);
if (fixture.scenarioPrerequisitePolicy.denominator !== profile.scenarioDenominator) throw new Error("R5_SEED_SCENARIO_DENOMINATOR_DRIFT");
process.stdout.write(`R5_SEED_DRY_RUN=PASS; PROFILE=${profile.profile}; SCENARIOS=${profile.scenarioDenominator}; FIXTURES=${Object.keys(facts).length}; STAGES=${fixture.seedStages.map((stage) => stage.id).join(",")}\n`);

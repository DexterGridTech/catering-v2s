const COUNT_KEYS = Object.freeze([
  "platformAdmins",
  "groupWorkspaces",
  "activeAssets",
  "stagedOrCleanupAssets",
  "extensionDefinitions",
  "commercialGroups",
  "regions",
  "projects",
  "projectPhases",
  "brands",
  "tenants",
  "headCompanies",
  "brandAuthorizations",
  "stores",
  "storeServicePointAreas",
  "storeServicePoints",
  "storeTerminals",
  "roles",
  "accounts",
  "assignments",
  "invitationStateFixtures",
  "passwordResetStateFixtures",
  "contracts",
  "terminalUpdateArtifacts",
  "terminalUpdateRules",
]);

export const R5_FIXTURE_EXPECTED_COUNT_KEYS = COUNT_KEYS;
export const R5_FIXTURE_SEED_STAGE_IDS = Object.freeze([
  "bootstrap",
  "platform",
  "extension",
  "organization",
  "access",
  "contract",
  "negatives",
]);

export const R5_FIXTURE_STAGE_COMPONENTS = Object.freeze({
  bootstrap: Object.freeze(["owner-command"]),
  platform: Object.freeze(["owner-command"]),
  extension: Object.freeze(["owner-command"]),
  organization: Object.freeze(["owner-command"]),
  access: Object.freeze(["owner-command"]),
  contract: Object.freeze(["owner-command"]),
  negatives: Object.freeze([
    "owner-command",
    "external-collaboration-business-channel",
    "catalog-inventory",
    "sales-menu",
  ]),
});

const COMPLETE_SEED_COMPONENT_IDS = new Set([
  "owner-command",
  "external-collaboration-business-channel",
  "catalog-inventory",
  "sales-menu",
]);

const collection = (value, label) => {
  if (!Array.isArray(value)) throw new Error(`R5_SEED_FIXTURE_COLLECTION_INVALID:${label}`);
  return value;
};

export function computeFixtureExpectedCounts(fixture) {
  const stable = fixture?.stableFixtures;
  const organization = stable?.organization;
  const workspaceIam = stable?.workspaceIam;
  const terminalUpdate = stable?.terminalUpdate;
  const projects = collection(organization?.projects, "organization.projects");
  const assets = collection(stable?.assets, "assets");
  const storeServicePoints = organization?.storeServicePoints;
  return Object.freeze({
    platformAdmins: collection(stable?.platformAdmins, "platformAdmins").length,
    groupWorkspaces: collection(stable?.groupWorkspaces, "groupWorkspaces").length,
    activeAssets: assets.filter((entry) => entry?.status === "ACTIVE").length,
    stagedOrCleanupAssets: assets.filter((entry) => ["STAGED", "CLEANUP_PENDING"].includes(entry?.status)).length,
    extensionDefinitions: collection(stable?.extensionDefinitions, "extensionDefinitions").length,
    commercialGroups: collection(organization?.commercialGroups, "organization.commercialGroups").length,
    regions: collection(organization?.regions, "organization.regions").length,
    projects: projects.length,
    projectPhases: projects.reduce((count, project) => count + collection(project?.phases, `project.phases:${project?.key ?? "UNKNOWN"}`).length, 0),
    brands: collection(organization?.brands, "organization.brands").length,
    tenants: collection(organization?.tenants, "organization.tenants").length,
    headCompanies: collection(organization?.headCompanies, "organization.headCompanies").length,
    brandAuthorizations: collection(organization?.brandAuthorizations, "organization.brandAuthorizations").length,
    stores: collection(organization?.stores, "organization.stores").length,
    storeServicePointAreas: collection(storeServicePoints?.areas, "organization.storeServicePoints.areas").length,
    storeServicePoints: collection(storeServicePoints?.points, "organization.storeServicePoints.points").length,
    storeTerminals: collection(organization?.storeTerminals, "organization.storeTerminals").length,
    roles: collection(workspaceIam?.roles, "workspaceIam.roles").length,
    accounts: collection(workspaceIam?.accounts, "workspaceIam.accounts").length,
    assignments: collection(workspaceIam?.assignments, "workspaceIam.assignments").length,
    invitationStateFixtures: collection(workspaceIam?.invitationStates, "workspaceIam.invitationStates").length,
    passwordResetStateFixtures: collection(workspaceIam?.passwordResetStates, "workspaceIam.passwordResetStates").length,
    contracts: collection(stable?.contracts, "contracts").length,
    terminalUpdateArtifacts: collection(terminalUpdate?.artifacts, "terminalUpdate.artifacts").length,
    terminalUpdateRules: collection(terminalUpdate?.rules, "terminalUpdate.rules").length,
  });
}

export function validateFixtureExpectedCounts(fixture) {
  const expected = fixture?.expectedCounts;
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
    throw new Error("R5_SEED_FIXTURE_EXPECTED_COUNTS_MISSING");
  }
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = [...COUNT_KEYS].sort();
  if (expectedKeys.join(",") !== actualKeys.join(",")) {
    throw new Error("R5_SEED_FIXTURE_EXPECTED_COUNT_KEYSET_INVALID");
  }
  const actual = computeFixtureExpectedCounts(fixture);
  for (const key of COUNT_KEYS) {
    if (!Number.isInteger(expected[key]) || actual[key] !== expected[key]) {
      throw new Error(`R5_SEED_FIXTURE_CONTRACT_COUNT_DRIFT:${key}:${actual[key]}!=${expected[key]}`);
    }
  }
  return Object.freeze({actual, keys: [...COUNT_KEYS]});
}

export function validateFixtureSeedStages(fixture) {
  const stages = fixture?.seedStages;
  if (!Array.isArray(stages) || stages.length !== R5_FIXTURE_SEED_STAGE_IDS.length) {
    throw new Error("R5_SEED_FIXTURE_STAGE_DENOMINATOR_INVALID");
  }
  const stageIds = stages.map((stage) => stage?.id);
  if (stageIds.join(",") !== R5_FIXTURE_SEED_STAGE_IDS.join(",")) {
    throw new Error("R5_SEED_FIXTURE_STAGE_ORDER_INVALID");
  }
  for (const stage of stages) {
    if (typeof stage?.channel !== "string" || !stage.channel
      || typeof stage.idempotencyKeyPrefix !== "string" || !stage.idempotencyKeyPrefix
      || !Array.isArray(stage.readback) || stage.readback.length === 0) {
      throw new Error(`R5_SEED_FIXTURE_STAGE_INVALID:${stage?.id ?? "UNKNOWN"}`);
    }
    const components = R5_FIXTURE_STAGE_COMPONENTS[stage.id];
    if (!components?.length || components.some((component) => !COMPLETE_SEED_COMPONENT_IDS.has(component))) {
      throw new Error(`R5_SEED_FIXTURE_STAGE_COMPONENT_MAPPING_INVALID:${stage.id}`);
    }
  }
  return Object.freeze({stageIds: [...stageIds], components: R5_FIXTURE_STAGE_COMPONENTS});
}

export function validateFixtureContractPhaseNames(fixture) {
  const stable = fixture?.stableFixtures;
  const stores = new Map(collection(stable?.organization?.stores, "organization.stores").map((store) => [store.key, store]));
  const projects = new Map(collection(stable?.organization?.projects, "organization.projects").map((project) => [project.key, project]));
  for (const contract of collection(stable?.contracts, "contracts")) {
    if (typeof contract?.phaseNameSnapshot !== "string" || !contract.phaseNameSnapshot.trim()) {
      throw new Error(`R5_SEED_FIXTURE_CONTRACT_PHASE_NAME_MISSING:${contract?.key ?? "UNKNOWN"}`);
    }
    const store = stores.get(contract.store);
    const project = projects.get(store?.project);
    if (!project || !collection(project.phases, `project.phases:${project.key}`).includes(contract.phaseNameSnapshot)) {
      throw new Error(`R5_SEED_FIXTURE_CONTRACT_PHASE_NAME_INVALID:${contract?.key ?? "UNKNOWN"}`);
    }
  }
  return Object.freeze({contractCount: collection(stable?.contracts, "contracts").length});
}

export function validateTerminalUpdateSeedFixture(fixture) {
  const terminalUpdate = fixture?.stableFixtures?.terminalUpdate;
  const artifacts = collection(terminalUpdate?.artifacts, "terminalUpdate.artifacts");
  const rules = collection(terminalUpdate?.rules, "terminalUpdate.rules");
  if (artifacts.length !== 4 || rules.length !== 8) throw new Error("R5_TERMINAL_UPDATE_FIXTURE_DENOMINATOR_INVALID");
  const artifactByKey = new Map();
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact.key !== "string" || artifactByKey.has(artifact.key) ||
        !["sample-terminal", "sample-wallpaper-terminal"].includes(artifact.app) ||
        !["FULL", "HOT"].includes(artifact.kind)) throw new Error("R5_TERMINAL_UPDATE_ARTIFACT_FIXTURE_INVALID");
    artifactByKey.set(artifact.key, artifact);
  }
  for (const app of ["sample-terminal", "sample-wallpaper-terminal"]) {
    const pair = artifacts.filter((artifact) => artifact.app === app);
    const full = pair.find((artifact) => artifact.kind === "FULL");
    const hot = pair.find((artifact) => artifact.kind === "HOT");
    if (pair.length !== 2 || !full || !hot || hot.minimumFullKey !== full.key) {
      throw new Error(`R5_TERMINAL_UPDATE_ARTIFACT_PAIR_INVALID:${app}`);
    }
  }
  const keys = new Set();
  for (const rule of rules) {
    const full = artifactByKey.get(rule?.fullArtifactKey);
    const hot = rule?.hotArtifactKey == null ? null : artifactByKey.get(rule.hotArtifactKey);
    if (!rule || typeof rule.key !== "string" || keys.has(rule.key) ||
        !["sample-terminal", "sample-wallpaper-terminal"].includes(rule.app) ||
        !["ALL", "STORE_REFS"].includes(rule.targetMode) || !Array.isArray(rule.storeKeys) ||
        (rule.targetMode === "ALL" && rule.storeKeys.length !== 0) ||
        (rule.targetMode === "STORE_REFS" && (rule.storeKeys.length === 0 || rule.storeKeys.some((key) => typeof key !== "string"))) ||
        !full || full.app !== rule.app || full.kind !== "FULL" ||
        (rule.hotArtifactKey != null && (!hot || hot.app !== rule.app || hot.kind !== "HOT" || hot.minimumFullKey !== full.key)) ||
        !["ENABLED", "DISABLED"].includes(rule.status) || rule.nSeconds !== 300 ||
        !["IMMEDIATE", "IDLE"].includes(rule.hotStrategy) ||
        (rule.hotStrategy === "IMMEDIATE" && rule.mSeconds !== null) ||
        (rule.hotStrategy === "IDLE" && rule.mSeconds !== 600)) {
      throw new Error(`R5_TERMINAL_UPDATE_RULE_FIXTURE_INVALID:${rule?.key ?? "UNKNOWN"}`);
    }
    keys.add(rule.key);
  }
  const roleGroup = fixture?.stableFixtures?.workspaceIam?.roles?.find((role) => role.key === "role-group");
  const roleProject = fixture?.stableFixtures?.workspaceIam?.roles?.find((role) => role.key === "role-project");
  const roleStore = fixture?.stableFixtures?.workspaceIam?.roles?.find((role) => role.key === "role-store");
  if (!roleGroup?.pageAccessKeys?.includes("PG-PROJECT-TERMINAL-VERSION-RULES") ||
      !roleGroup.actionCapabilityKeys?.includes("MANAGE_PROJECT_TERMINAL_VERSION") ||
      !roleProject?.pageAccessKeys?.includes("PG-PROJECT-TERMINAL-VERSION-RULES") ||
      roleProject.actionCapabilityKeys?.includes("MANAGE_PROJECT_TERMINAL_VERSION") ||
      roleStore?.pageAccessKeys?.includes("PG-PROJECT-TERMINAL-VERSION-RULES") ||
      roleStore?.actionCapabilityKeys?.includes("MANAGE_PROJECT_TERMINAL_VERSION")) {
    throw new Error("R5_TERMINAL_UPDATE_ROLE_BOUNDARY_INVALID");
  }
  return Object.freeze({artifacts: artifacts.length, rules: rules.length});
}

export function validateFixtureContract(fixture) {
  if (fixture?.profile?.middleware?.tdp !== "FORBIDDEN") {
    throw new Error("R5_SEED_FIXTURE_TDP_MUST_BE_FORBIDDEN");
  }
  const counts = validateFixtureExpectedCounts(fixture);
  const stages = validateFixtureSeedStages(fixture);
  const phaseNames = validateFixtureContractPhaseNames(fixture);
  const terminalUpdate = validateTerminalUpdateSeedFixture(fixture);
  return Object.freeze({...counts, ...stages, ...phaseNames, ...terminalUpdate});
}

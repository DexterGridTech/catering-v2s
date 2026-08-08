#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const readText = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const hashFile = (relative) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
const fail = (code, detail = "") => { const error = new Error(`${code}${detail ? `:${detail}` : ""}`); error.code = code; throw error; };

const IA_PATH = "doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md";
const DESIGN_PATH = "doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md";
const REQUIREMENTS_PATH = "doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md";
const RECONCILIATION_PATH = "doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json";
const L2_SCENARIOS_PATH = "contracts/policy/catalog-inventory-l2-scenarios.json";
const L2_BINDINGS_PATH = "contracts/policy/catalog-inventory-l2-locator-bindings.json";
const API_SCENARIOS_PATH = "contracts/policy/catalog-inventory-api-scenarios.json";
const ASSERTION_MATRIX_PATH = "contracts/policy/catalog-inventory-assertion-matrix.json";
const EVIDENCE_PATH = "doc/evidence/platform/2026-08-07-v2s-catalog-inventory-p4-pre-l2-control-reconciliation-codex.json";
const L2_SPEC_PATH = "apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts";
const L2_FIXTURE_PATH = "scripts/test/catalog-inventory-l2-test-fixture.mjs";
const JOINT_L2_FIXTURE_PATH = "scripts/test/r5-joint-remote-l2-fixture.mjs";
const NATIVE_CONTROL_CONTRACTS = [
  {testId: "inventory-action-quantity", host: "input", componentPath: "apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx", componentToken: "<InputNumber"},
  {testId: "inventory-action-note", host: "textarea", componentPath: "apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx", componentToken: "<Input.TextArea"},
];
const SESSION_WIRE_CLIENT_PATHS = [
  "scripts/dev/catalog-inventory-seed-executor.mjs",
  "scripts/test/catalog-inventory-api.mjs",
  "scripts/test/catalog-inventory-l2-test-fixture.mjs",
];

function expectedIaIds() {
  return [...new Set([...readText(IA_PATH).matchAll(/`(IA-[A-Z0-9-]+)`/g)].map((match) => match[1]))].sort();
}

function assertControlSet(reconciliation) {
  const expected = expectedIaIds();
  const controls = Array.isArray(reconciliation.controls) ? reconciliation.controls : [];
  const actual = controls.map((entry) => entry.id);
  if (reconciliation.iaIdCount !== 89 || reconciliation.exactSet !== true || actual.length !== expected.length || new Set(actual).size !== actual.length || expected.join("\n") !== [...actual].sort().join("\n")) fail("P4_IA_CONTROL_EXACT_SET_INVALID");
  for (const control of controls) {
    if (typeof control.id !== "string" || typeof control.control !== "string" || !control.control || typeof control.position !== "string" || !control.position || typeof control.wireframe !== "string" || !control.wireframe || typeof control.sourceFile !== "string" || !control.sourceFile) fail("P4_IA_CONTROL_METADATA_MISSING", control.id || "unknown");
    if (control.id.startsWith("IA-CONTRACT-")) {
      if (control.locator !== "NOT_APPLICABLE") fail("P4_CONTRACT_LOCATOR_INVALID", control.id);
      continue;
    }
    if (!fs.existsSync(path.join(root, control.sourceFile))) fail("P4_IA_SOURCE_FILE_MISSING", `${control.id}:${control.sourceFile}`);
    const source = readText(control.sourceFile);
    const locators = String(control.locator || "").split("|").map((value) => value.trim()).filter(Boolean);
    if (!locators.length || locators.some((locator) => !source.includes(locator))) fail("P4_IA_LOCATOR_SOURCE_MISSING", control.id);
  }
  return controls;
}

function scenarioCaseIds(scenarios) {
  return scenarios.scenarios.flatMap((scenario) => scenario.cases.map((entry) => entry.caseId));
}

const POSITION_STOP_WORDS = new Set("the and or of in on to with as for by from into only not is are a an this that current view entry area region row state result domain global local below above immediately after before right left".split(" "));
const positionTokens = (value) => new Set((String(value).toLowerCase().match(/[a-z0-9]+|[\\u4e00-\\u9fff]+/g) || []).filter((token) => token.length > 2 && !POSITION_STOP_WORDS.has(token)));
const sectionRefs = (value) => [...String(value).matchAll(/IA §([0-9.]+)/g)].map((match) => match[1]);

function assertBindings(scenarios, bindings, controls) {
  const caseIds = scenarioCaseIds(scenarios);
  const boundIds = bindings.bindings.map((entry) => entry.caseId);
  if (bindings.caseCount !== 43 || bindings.bindings.length !== 43 || new Set(boundIds).size !== boundIds.length || [...caseIds].sort().join("\n") !== [...boundIds].sort().join("\n")) fail("P4_L2_CASE_EXACT_SET_INVALID");
  const controlMap = new Map(controls.map((entry) => [entry.id, entry]));
  for (const binding of bindings.bindings) {
    if (!binding.caseId || !binding.scenarioId || !binding.locator || !binding.position || !binding.wireframe || !binding.fixtureRef || !binding.expectedBusinessResult || !binding.activation || !Array.isArray(binding.controlIds) || binding.controlIds.length === 0 || !Array.isArray(binding.controlSourceFiles) || binding.controlSourceFiles.length === 0 || !Array.isArray(binding.sourceFiles) || binding.sourceFiles.length === 0) fail("P4_L2_CONTROL_BINDING_METADATA_MISSING", binding.caseId || "unknown");
    if (new Set(binding.controlIds).size !== binding.controlIds.length) fail("P4_L2_CONTROL_BINDING_DUPLICATE_CONTROL", binding.caseId);
    const mapped = binding.controlIds.map((id) => controlMap.get(id));
    if (mapped.some((entry) => !entry)) fail("P4_L2_CONTROL_BINDING_UNKNOWN_CONTROL", binding.caseId);
    const expectedSourceFiles = [...new Set(mapped.map((entry) => entry.sourceFile))].sort();
    if (expectedSourceFiles.join("\n") !== [...binding.controlSourceFiles].sort().join("\n")) fail("P4_L2_CONTROL_SOURCE_FILE_SET_INVALID", binding.caseId);
    const ineligible = mapped.filter((entry) => entry.implementationStatus === "NOT_IMPLEMENTED" || entry.implementationStatus === "BLOCKED_UPSTREAM_CONTRACT");
    if (ineligible.length) fail("P4_L2_CONTROL_NOT_ELIGIBLE", `${binding.caseId}:${ineligible.map((entry) => entry.id).join(",")}`);
    if (!binding.sourceFiles.every((relative) => fs.existsSync(path.join(root, relative)))) fail("P4_L2_BINDING_SOURCE_FILE_MISSING", binding.caseId);
    const locatorSource = binding.sourceFiles.map((relative) => readText(relative)).join("\n");
    if (!locatorSource.includes(binding.locator)) fail("P4_L2_LOCATOR_NOT_IN_DECLARED_CONTROL_SOURCE", binding.caseId);
    if (!binding.wireframe.includes("IA §")) fail("P4_L2_WIREFRAME_REFERENCE_MISSING", binding.caseId);
    const bindingPositionTokens = positionTokens(binding.position);
    const mappedPositionTokens = [...new Set(mapped.flatMap((entry) => [...positionTokens(entry.position)]))];
    if (!mappedPositionTokens.some((token) => bindingPositionTokens.has(token))) fail("P4_L2_POSITION_MAPPING_INVALID", binding.caseId);
    const bindingSections = new Set(sectionRefs(binding.wireframe));
    const mappedSections = [...new Set(mapped.flatMap((entry) => sectionRefs(entry.wireframe)))];
    if (!mappedSections.some((section) => bindingSections.has(section))) fail("P4_L2_WIREFRAME_MAPPING_INVALID", binding.caseId);
  }
}

function assertApiExpectationBindings(apiScenarios, assertionMatrix) {
  const cases = apiScenarios.scenarios.flatMap((scenario) => scenario.cases);
  if (apiScenarios.scenarioCount !== 26 || apiScenarios.caseCount !== 100 || cases.length !== 100 || new Set(cases.map((entry) => entry.caseId)).size !== 100) fail("P4_API_CASE_DENOMINATOR_INVALID");
  const negative = cases.filter((entry) => entry.polarity === "NEGATIVE");
  const positive = cases.filter((entry) => entry.polarity === "POSITIVE");
  const typed = cases.filter((entry) => entry.expectationKind === "TYPED_FAILURE");
  const fact = cases.filter((entry) => entry.expectationKind === "FACT");
  if (negative.length !== 38 || positive.length !== 62 || typed.length !== 13 || fact.length !== 87) fail("P4_API_EXPECTATION_DENOMINATOR_INVALID");
  const operationCodes = new Map(assertionMatrix.operations.map((operation) => [operation.operationId, new Set(operation.conditionToProblem.map((entry) => entry.problemCode))]));
  for (const entry of cases) {
    if (!entry.polarity || !entry.expectationKind) fail("P4_API_EXPECTATION_FIELDS_MISSING", entry.caseId);
    const ref = entry.conditionToProblemRef;
    if (entry.expectationKind === "TYPED_FAILURE") {
      if (!ref || typeof ref.operationId !== "string" || typeof ref.problemCode !== "string" || !operationCodes.has(ref.operationId) || !operationCodes.get(ref.operationId).has(ref.problemCode)) fail("P4_API_CONDITION_REF_INVALID", entry.caseId);
    } else if (ref !== undefined) fail("P4_API_FACT_HAS_CONDITION_REF", entry.caseId);
  }
  const byId = new Map(cases.map((entry) => [entry.caseId, entry]));
  if (byId.get("CI-API-022-01")?.polarity !== "POSITIVE" || byId.get("CI-API-022-01")?.expectationKind !== "FACT" || byId.get("CI-API-022-02")?.polarity !== "NEGATIVE" || byId.get("CI-API-022-02")?.expectationKind !== "TYPED_FAILURE" || byId.get("CI-API-012-01")?.polarity !== "NEGATIVE" || byId.get("CI-API-012-01")?.expectationKind !== "FACT") fail("P4_API_BOUNDARY_SEMANTICS_INVALID");
  return {negative: negative.length, positive: positive.length, typedFailure: typed.length, fact: fact.length};
}

function assertSessionWireFieldUsage(sourceTexts = Object.fromEntries(SESSION_WIRE_CLIENT_PATHS.map((relative) => [relative, readText(relative)]))) {
  for (const [relative, source] of Object.entries(sourceTexts)) {
    if (!source.includes("dataNodeRef")) fail("P4_SESSION_WIRE_DATA_NODE_REF_MISSING", relative);
    if (source.includes("dataNodeId")) fail("P4_SESSION_WIRE_LEGACY_DATA_NODE_ID_PRESENT", relative);
  }
}

// Ant Design's InputNumber/TextArea forward data-testid to their native host
// element. A descendant locator would therefore be structurally impossible
// while still looking plausible in a text-only review. Keep this finite,
// explicit contract close to the pre-L2 gate and prove both the implementation
// host and the test's direct-host access. This is a semantic DOM invariant,
// not a generic locator-style ban.
function assertNativeControlLocatorContracts(sourceOverrides = {}) {
  const spec = sourceOverrides[L2_SPEC_PATH] ?? readText(L2_SPEC_PATH);
  for (const contract of NATIVE_CONTROL_CONTRACTS) {
    const component = sourceOverrides[contract.componentPath] ?? readText(contract.componentPath);
    if (!component.includes(contract.componentToken) || !component.includes(`testId('${contract.testId}')`)) fail("P4_NATIVE_CONTROL_HOST_MAPPING_INVALID", contract.testId);
    const descendantPattern = new RegExp(`getByTestId\\(\\s*['\"]${contract.testId}['\"]\\s*\\)\\s*\\.locator\\(\\s*['\"]${contract.host}['\"]\\s*\\)`);
    if (descendantPattern.test(spec)) fail("P4_NATIVE_CONTROL_LOCATOR_INVALID", `${contract.testId}:${contract.host}`);
  }
}

function assertL2ProgressReporting(sourceOverride) {
  const source = sourceOverride ?? readText(L2_SPEC_PATH);
  for (const token of ["CATALOG_L2_PROGRESS", "completed=", "current=", "status=", "test.beforeEach", "test.afterEach"]) {
    if (!source.includes(token)) fail("P4_L2_PROGRESS_REPORTING_MISSING", token);
  }
}

// A negative L2 assertion is only meaningful when the test creates the
// corresponding failure. Keep this finite to the approved error-surface
// scenario: the detail GET is aborted, the persistent problem surface is
// focused and retryable, and the route is removed before recovery.
function assertL2ErrorScenarioTrigger(sourceOverride) {
  const source = sourceOverride ?? readText(L2_SPEC_PATH);
  for (const token of [
    "case 'CI-L2-017'",
    "simulateDetailFailure",
    "page.route(detailRoute",
    "route.abort('failed')",
    "catalog-item-problem-retry",
    "toBeFocused()",
    "page.unroute(detailRoute)",
  ]) {
    if (!source.includes(token)) fail("P4_L2_ERROR_SCENARIO_TRIGGER_MISSING", token);
  }
}

function assertBrandCopyFixtureSource(sourceOverride) {
  const source = sourceOverride ?? readText(L2_FIXTURE_PATH);
  for (const token of [
    "CATALOG_INVENTORY_HEAD_COMPANY_LOGIN",
    "CATALOG_INVENTORY_HEAD_COMPANY_REF",
    "loginScoped('HEAD_COMPANY'",
    "ensureHeadItem({code: beanCode",
    "ensureHeadItem({code: latteCode",
    "getOperationsBrandCatalogCopyCandidates",
    "L2_BRAND_COPY_CANDIDATE_READBACK_MISSING",
    "'FIXTURE-STALE-SOURCE': itemBinding(latteCode)",
  ]) {
    if (!source.includes(token)) fail("P4_BRAND_COPY_FIXTURE_SOURCE_MISSING", token);
  }
}

function assertJointFixtureScopeEnv(sourceOverride) {
  const source = sourceOverride ?? readText(JOINT_L2_FIXTURE_PATH);
  const requiredTokens = [
    "CATALOG_INVENTORY_HEAD_COMPANY_LOGIN: catalogHeadLoginName",
    "CATALOG_INVENTORY_HEAD_COMPANY_REF: required(headCompany.json?.id, 'CATALOG_TEST_HEAD_COMPANY_REF')",
  ];
  for (const token of requiredTokens) {
    if (!source.includes(token)) fail("P4_BRAND_COPY_JOINT_SCOPE_ENV_MISSING", token);
  }
}

function buildEvidence(reconciliation, scenarios, bindings, controls, apiCounts) {
  const statusCounts = controls.reduce((result, entry) => { result[entry.implementationStatus] = (result[entry.implementationStatus] || 0) + 1; return result; }, {});
  const sourceFiles = [...new Set([
    ...bindings.bindings.flatMap((entry) => entry.sourceFiles),
    L2_SPEC_PATH,
    L2_FIXTURE_PATH,
    JOINT_L2_FIXTURE_PATH,
    ...NATIVE_CONTROL_CONTRACTS.map((entry) => entry.componentPath),
  ])].sort();
  return {
    schemaVersion: 1,
    kind: "catalog-inventory-p4-pre-l2-control-reconciliation",
    status: "PASS",
    createdAt: new Date().toISOString(),
    authority: "STATIC_PRE_L2_ONLY",
    sourceBindings: {
      requirements: {path: REQUIREMENTS_PATH, sha256: hashFile(REQUIREMENTS_PATH)},
      ia: {path: IA_PATH, sha256: hashFile(IA_PATH)},
      implementationDesign: {path: DESIGN_PATH, sha256: hashFile(DESIGN_PATH)},
      iaReconciliation: {path: RECONCILIATION_PATH, sha256: hashFile(RECONCILIATION_PATH)},
      l2Scenarios: {path: L2_SCENARIOS_PATH, sha256: hashFile(L2_SCENARIOS_PATH)},
      l2Bindings: {path: L2_BINDINGS_PATH, sha256: hashFile(L2_BINDINGS_PATH)},
      apiScenarios: {path: API_SCENARIOS_PATH, sha256: hashFile(API_SCENARIOS_PATH)},
      assertionMatrix: {path: ASSERTION_MATRIX_PATH, sha256: hashFile(ASSERTION_MATRIX_PATH)},
    },
    counts: {iaControls: controls.length, apiScenarios: 26, apiCases: 100, apiNegative: apiCounts.negative, apiPositive: apiCounts.positive, apiTypedFailure: apiCounts.typedFailure, apiFact: apiCounts.fact, l2Scenarios: scenarios.scenarioCount, l2Cases: scenarios.caseCount, l2Bindings: bindings.bindings.length, eligibleBindings: bindings.bindings.length, statusCounts},
    controlRule: "每个 L2 case 必须先绑定真实 IA controlIds，再以 control 的 sourceFile/locator/wireframe 形成闭环；NOT_IMPLEMENTED/BLOCKED 控件不得进入 L2。",
    nativeControlDomRule: NATIVE_CONTROL_CONTRACTS.map(({testId, host, componentPath}) => ({testId, host, componentPath, assertion: "testId is forwarded to the native host; L2 must address the testId directly"})),
    l2ProgressRule: "每个 L2 case 在开始与结束均输出 completed=X/43、current=CI-L2-*、status=START|PASS|FAIL|TIMED_OUT，并写入 run-scoped evidence log。",
    l2ErrorScenarioRule: "CI-L2-017 的错误断言必须由目标详情 GET 的受控失败触发，并验证持久错误面、焦点、重试与恢复；不得只断言一个正常路径永远不会出现的错误控件。",
    brandCopyFixtureRule: "复制向导的 L2 fixture 必须以 HEAD_COMPANY 登录/节点建立来源商品，并通过 brand-candidates HTTP 回读证明候选可见；不得只在门店目标范围造同名商品。",
    controls: controls.map((entry) => ({id: entry.id, implementationStatus: entry.implementationStatus, sourceFile: entry.sourceFile, locator: entry.locator, wireframe: entry.wireframe})),
    l2Bindings: bindings.bindings.map((entry) => ({caseId: entry.caseId, scenarioId: entry.scenarioId, controlIds: entry.controlIds, controlSourceFiles: entry.controlSourceFiles, sourceFiles: entry.sourceFiles, locator: entry.locator, position: entry.position, wireframe: entry.wireframe, fixtureRef: entry.fixtureRef})),
    sourceFileHashes: Object.fromEntries(sourceFiles.map((relative) => [relative, hashFile(relative)])),
    runtimeStatus: "NOT_EXECUTED_PRE_L2_GATE",
    businessStatus: "NOT_STARTED",
    cleanupStatus: "NOT_STARTED",
  };
}

function selfTest(reconciliation, scenarios, bindings) {
  const controls = assertControlSet(reconciliation);
  const baseline = JSON.parse(JSON.stringify(bindings));
  const missingControl = JSON.parse(JSON.stringify(baseline));
  delete missingControl.bindings[0].controlIds;
  try { assertBindings(scenarios, missingControl, controls); fail("P4_SELF_TEST_CONTROL_BINDING_MUTATION_NOT_REJECTED"); } catch (error) { if (error.code !== "P4_L2_CONTROL_BINDING_METADATA_MISSING") throw error; process.stdout.write("P4_RED_MUTATION=CONTROL_BINDING_METADATA\n"); }
  const locatorMutation = JSON.parse(JSON.stringify(baseline));
  locatorMutation.bindings[0].locator = "p4-locator-not-rendered";
  try { assertBindings(scenarios, locatorMutation, controls); fail("P4_SELF_TEST_LOCATOR_MUTATION_NOT_REJECTED"); } catch (error) { if (error.code !== "P4_L2_LOCATOR_NOT_IN_DECLARED_CONTROL_SOURCE") throw error; process.stdout.write("P4_RED_MUTATION=LOCATOR_SOURCE\n"); }
  const positionMutation = JSON.parse(JSON.stringify(baseline));
  positionMutation.bindings[0].position = "unrelated surface with no mapped control";
  try { assertBindings(scenarios, positionMutation, controls); fail("P4_SELF_TEST_POSITION_MAPPING_MUTATION_NOT_REJECTED"); } catch (error) { if (error.code !== "P4_L2_POSITION_MAPPING_INVALID") throw error; process.stdout.write("P4_RED_MUTATION=POSITION_MAPPING\n"); }
  const wireframeMutation = JSON.parse(JSON.stringify(baseline));
  wireframeMutation.bindings[0].wireframe = "IA §9.9：unrelated wireframe";
  try { assertBindings(scenarios, wireframeMutation, controls); fail("P4_SELF_TEST_WIREFRAME_MAPPING_MUTATION_NOT_REJECTED"); } catch (error) { if (error.code !== "P4_L2_WIREFRAME_MAPPING_INVALID") throw error; process.stdout.write("P4_RED_MUTATION=WIREFRAME_MAPPING\n"); }
  const statusMutation = JSON.parse(JSON.stringify(reconciliation));
  const target = statusMutation.controls.find((entry) => entry.id === bindings.bindings[0].controlIds[0]);
  target.implementationStatus = "NOT_IMPLEMENTED";
  try { assertBindings(scenarios, baseline, assertControlSet(statusMutation)); fail("P4_SELF_TEST_STATUS_MUTATION_NOT_REJECTED"); } catch (error) { if (error.code !== "P4_L2_CONTROL_NOT_ELIGIBLE") throw error; process.stdout.write("P4_RED_MUTATION=CONTROL_STATUS\n"); }
  const controlSetMutation = JSON.parse(JSON.stringify(reconciliation));
  controlSetMutation.controls.pop();
  try { assertControlSet(controlSetMutation); fail("P4_SELF_TEST_CONTROL_SET_MUTATION_NOT_REJECTED"); } catch (error) { if (error.code !== "P4_IA_CONTROL_EXACT_SET_INVALID") throw error; process.stdout.write("P4_RED_MUTATION=CONTROL_EXACT_SET\n"); }
  const apiScenarios = readJson(API_SCENARIOS_PATH);
  const apiMatrix = readJson(ASSERTION_MATRIX_PATH);
  const apiMutation = JSON.parse(JSON.stringify(apiScenarios));
  delete apiMutation.scenarios.find((scenario) => scenario.scenarioId === "CI-API-021").cases[0].conditionToProblemRef;
  try { assertApiExpectationBindings(apiMutation, apiMatrix); fail("P4_SELF_TEST_API_EXPECTATION_MUTATION_NOT_REJECTED"); } catch (error) { if (error.code !== "P4_API_CONDITION_REF_INVALID") throw error; process.stdout.write("P4_RED_MUTATION=API_CONDITION_REF\n"); }
  const sessionWireMutation = Object.fromEntries(SESSION_WIRE_CLIENT_PATHS.map((relative) => [relative, readText(relative).replaceAll("dataNodeRef", ["dataNode", "Id"].join(""))]));
  try { assertSessionWireFieldUsage(sessionWireMutation); fail("P4_SELF_TEST_SESSION_WIRE_MUTATION_NOT_REJECTED"); } catch (error) { if (!String(error.code || "").startsWith("P4_SESSION_WIRE_")) throw error; process.stdout.write("P4_RED_MUTATION=SESSION_WIRE_FIELD\n"); }
  const nativeControlMutation = {[L2_SPEC_PATH]: readText(L2_SPEC_PATH).replace("getByTestId('inventory-action-quantity')", "getByTestId('inventory-action-quantity').locator('input')")};
  try { assertNativeControlLocatorContracts(nativeControlMutation); fail("P4_SELF_TEST_NATIVE_CONTROL_MUTATION_NOT_REJECTED"); } catch (error) { if (error.code !== "P4_NATIVE_CONTROL_LOCATOR_INVALID") throw error; process.stdout.write("P4_RED_MUTATION=NATIVE_CONTROL_LOCATOR\n"); }
  const progressMutation = readText(L2_SPEC_PATH).replaceAll("CATALOG_L2_PROGRESS", "L2_PROGRESS_REMOVED");
  try { assertL2ProgressReporting(progressMutation); fail("P4_SELF_TEST_PROGRESS_REPORTING_MUTATION_NOT_REJECTED"); } catch (error) { if (error.code !== "P4_L2_PROGRESS_REPORTING_MISSING") throw error; process.stdout.write("P4_RED_MUTATION=L2_PROGRESS_REPORTING\n"); }
  const errorScenarioMutation = readText(L2_SPEC_PATH).replace("await page.route(detailRoute", "await page.route_REMOVED(detailRoute");
  try { assertL2ErrorScenarioTrigger(errorScenarioMutation); fail("P4_SELF_TEST_ERROR_SCENARIO_TRIGGER_MUTATION_NOT_REJECTED"); } catch (error) { if (error.code !== "P4_L2_ERROR_SCENARIO_TRIGGER_MISSING") throw error; process.stdout.write("P4_RED_MUTATION=L2_ERROR_SCENARIO_TRIGGER\n"); }
  const brandCopyFixtureMutation = readText(L2_FIXTURE_PATH).replace("L2_BRAND_COPY_CANDIDATE_READBACK_MISSING", "L2_BRAND_COPY_CANDIDATE_READBACK_REMOVED");
  try { assertBrandCopyFixtureSource(brandCopyFixtureMutation); fail("P4_SELF_TEST_BRAND_COPY_FIXTURE_MUTATION_NOT_REJECTED"); }
  catch (error) { if (error.code !== "P4_BRAND_COPY_FIXTURE_SOURCE_MISSING") throw error; process.stdout.write("P4_RED_MUTATION=BRAND_COPY_FIXTURE_SOURCE\n"); }
  const jointScopeMutation = readText(JOINT_L2_FIXTURE_PATH).replace("CATALOG_INVENTORY_HEAD_COMPANY_REF: required(headCompany.json?.id, 'CATALOG_TEST_HEAD_COMPANY_REF')", "CATALOG_INVENTORY_HEAD_COMPANY_REF_REMOVED");
  try { assertJointFixtureScopeEnv(jointScopeMutation); fail("P4_SELF_TEST_BRAND_COPY_JOINT_SCOPE_MUTATION_NOT_REJECTED"); }
  catch (error) { if (error.code !== "P4_BRAND_COPY_JOINT_SCOPE_ENV_MISSING") throw error; process.stdout.write("P4_RED_MUTATION=BRAND_COPY_JOINT_SCOPE_ENV\n"); }
}

function run() {
  const reconciliation = readJson(RECONCILIATION_PATH);
  const scenarios = readJson(L2_SCENARIOS_PATH);
  const bindings = readJson(L2_BINDINGS_PATH);
  const apiScenarios = readJson(API_SCENARIOS_PATH);
  const assertionMatrix = readJson(ASSERTION_MATRIX_PATH);
  const controls = assertControlSet(reconciliation);
  assertBindings(scenarios, bindings, controls);
  const apiCounts = assertApiExpectationBindings(apiScenarios, assertionMatrix);
  assertSessionWireFieldUsage();
  assertNativeControlLocatorContracts();
  assertL2ProgressReporting();
  assertL2ErrorScenarioTrigger();
  assertBrandCopyFixtureSource();
  assertJointFixtureScopeEnv();
  const evidence = buildEvidence(reconciliation, scenarios, bindings, controls, apiCounts);
  fs.mkdirSync(path.dirname(path.join(root, EVIDENCE_PATH)), {recursive: true});
  fs.writeFileSync(path.join(root, EVIDENCE_PATH), `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`CATALOG_INVENTORY_P4_PRE_L2_CONTROL_RECONCILIATION=PASS\n${JSON.stringify(evidence.counts)}\n`);
}

try {
  if (process.argv.includes("--self-test")) {
    const reconciliation = readJson(RECONCILIATION_PATH);
    selfTest(reconciliation, readJson(L2_SCENARIOS_PATH), readJson(L2_BINDINGS_PATH));
    process.stdout.write("CATALOG_INVENTORY_P4_PRE_L2_SELF_TEST=PASS\n");
  } else run();
} catch (error) {
  process.stderr.write(`${error.code || "P4_PRE_L2_CHECK_FAILED"}:${error.message}\n`);
  process.exitCode = 1;
}

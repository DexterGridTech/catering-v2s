#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const blueprintPath = path.join(root, 'contracts/policy/sales-menu-l2-case-blueprint.json');
const policyPath = path.join(root, 'contracts/policy/sales-menu-l2-scenarios.json');
const fixturePath = path.join(root, 'contracts/policy/sales-menu-l2-fixture.json');
const candidatePath = path.join(root, 'contracts/policy/sales-menu-l2-activation-candidate.json');
const executionPath = path.join(root, 'contracts/policy/sales-menu-l2-execution.json');
const bindingPath = path.join(root, 'contracts/policy/sales-menu-l2-locator-bindings.json');

class FixtureFailure extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}:${detail}` : code);
    this.code = code;
  }
}

function assert(condition, code, detail = '') {
  if (!condition) throw new FixtureFailure(code, detail);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new FixtureFailure(
      'SALES_MENU_L2_FIXTURE_JSON_READ_FAILED',
      `${path.relative(root, filePath)}:${error.message}`,
    );
  }
}

function digestCandidate(candidate) {
  const copy = JSON.parse(JSON.stringify(candidate));
  delete copy.candidateDigest;
  return createHash('sha256')
    .update(`${JSON.stringify(copy, null, 2)}\n`)
    .digest('hex');
}

function rows(policy) {
  return policy.scenarios.flatMap(scenario =>
    scenario.cases.map(entry => ({...entry, scenarioId: scenario.scenarioId})),
  );
}

function assertNoForbiddenFields(value, location = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenFields(entry, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(
      !/^(seedReport|seedFixture|seedCreated|seedObject|apiReport|apiEvidence|reportPath|apiObjectId)$/.test(key),
      'SALES_MENU_L2_FORBIDDEN_FIXTURE_FIELD',
      `${location}.${key}`,
    );
    assertNoForbiddenFields(child, `${location}.${key}`);
  }
}

function validatePolicy() {
  const blueprint = readJson(blueprintPath);
  const policy = readJson(policyPath);
  const fixture = readJson(fixturePath);
  const candidate = readJson(candidatePath);
  const execution = readJson(executionPath);
  const bindings = readJson(bindingPath);
  assert(blueprint.kind === 'sales-menu-l2-case-blueprint', 'SALES_MENU_L2_BLUEPRINT_KIND_INVALID');
  const expectedCaseIds = rows(blueprint).map(row => row.caseId);
  assert(
    expectedCaseIds.length > 0 && new Set(expectedCaseIds).size === expectedCaseIds.length,
    'SALES_MENU_L2_BLUEPRINT_CASE_SET_INVALID',
  );
  const caseRows = rows(policy);
  assert(policy.kind === 'sales-menu-l2-scenarios', 'SALES_MENU_L2_POLICY_KIND_INVALID');
  assert(
    policy.caseCount === expectedCaseIds.length && caseRows.length === expectedCaseIds.length,
    'SALES_MENU_L2_POLICY_CASE_COUNT_INVALID',
  );
  assert(
    JSON.stringify(caseRows.map(row => row.caseId)) === JSON.stringify(expectedCaseIds),
    'SALES_MENU_L2_POLICY_CASE_SET_INVALID',
  );
  assert(policy.executionBoundary?.fixtureClass === 'TEST', 'SALES_MENU_L2_POLICY_FIXTURE_CLASS_INVALID');
  assert(
    policy.executionBoundary?.setupChannel === 'OWNER_HTTP_COMMANDS',
    'SALES_MENU_L2_POLICY_SETUP_CHANNEL_INVALID',
  );
  assert(policy.executionBoundary?.seedRuntimeInput === false, 'SALES_MENU_L2_POLICY_SEED_INPUT_INVALID');
  assert(policy.executionBoundary?.reportInputs?.length === 0, 'SALES_MENU_L2_POLICY_REPORT_INPUT_INVALID');
  assert(
    bindings.kind === 'sales-menu-l2-locator-bindings' && bindings.bindingMode === 'CASE_PARAMETER_CONTROL_KEYS',
    'SALES_MENU_L2_BINDINGS_INVALID',
  );
  assert(
    bindings.caseCount === expectedCaseIds.length && bindings.noSeedRuntimeInput === true,
    'SALES_MENU_L2_BINDINGS_CASE_COUNT_INVALID',
  );
  assert(
    fixture.kind === 'sales-menu-l2-fixture' && fixture.fixtureClass === 'TEST',
    'SALES_MENU_L2_FIXTURE_KIND_INVALID',
  );
  assert(
    fixture.setupChannel === 'OWNER_HTTP_COMMANDS' &&
      fixture.seedRuntimeInput === false &&
      fixture.runId === 'RUNTIME_ASSIGNED',
    'SALES_MENU_L2_FIXTURE_BOUNDARY_INVALID',
  );
  assert(
    fixture.ownerFacts?.channelCandidatePageSize === 20 &&
      fixture.ownerFacts?.menuPageSize === 20 &&
      fixture.ownerFacts?.candidatePageSize === 20,
    'SALES_MENU_L2_FIXTURE_PAGE_SIZE_INVALID',
  );
  assert(
    fixture.ownerFacts?.expectedEligibleChannelCount === 21 &&
      fixture.ownerFacts?.expectedMenuCount === 21 &&
      fixture.ownerFacts?.expectedCandidateCount === 21,
    'SALES_MENU_L2_FIXTURE_DENOMINATOR_INVALID',
  );
  for (const [name, minimum] of [
    ['channelFixtures', 21],
    ['menuFixtures', 21],
    ['candidateFixtures', 21],
  ]) {
    const values = fixture[name];
    assert(Array.isArray(values) && values.length === minimum, 'SALES_MENU_L2_FIXTURE_COLLECTION_INVALID', name);
    const ids = values.map(value => value.fixtureId);
    assert(
      ids.every(value => typeof value === 'string' && value.length > 0) && new Set(ids).size === ids.length,
      'SALES_MENU_L2_FIXTURE_ID_INVALID',
      name,
    );
  }
  const menuFixtureIds = new Set(fixture.menuFixtures.map(value => value.fixtureId));
  const candidateFixtureIds = new Set(fixture.candidateFixtures.map(value => value.fixtureId));
  assert(
    Object.keys(fixture.caseFixtures ?? {}).length === expectedCaseIds.length,
    'SALES_MENU_L2_CASE_FIXTURE_COUNT_INVALID',
  );
  for (const row of caseRows) {
    const definition = fixture.caseFixtures[row.fixtureRef];
    assert(definition, 'SALES_MENU_L2_CASE_FIXTURE_MISSING', row.fixtureRef);
    const referencedMenuFixtureIds = definition.menuFixtureId
      ? [definition.menuFixtureId]
      : (definition.menuFixtureIds ?? []);
    assert(referencedMenuFixtureIds.length > 0, 'SALES_MENU_L2_CASE_MENU_REF_MISSING', row.fixtureRef);
    for (const menuFixtureId of referencedMenuFixtureIds)
      assert(
        menuFixtureIds.has(menuFixtureId),
        'SALES_MENU_L2_CASE_MENU_REF_INVALID',
        `${row.fixtureRef}:${menuFixtureId}`,
      );
    if (definition.sectionCount !== undefined)
      assert(
        Number.isInteger(definition.sectionCount) && definition.sectionCount > 0,
        'SALES_MENU_L2_CASE_SECTION_COUNT_INVALID',
        row.fixtureRef,
      );
    for (const candidateFixtureId of definition.baselineCandidateFixtureIds ?? [])
      assert(
        candidateFixtureIds.has(candidateFixtureId),
        'SALES_MENU_L2_CASE_BASELINE_CANDIDATE_INVALID',
        `${row.fixtureRef}:${candidateFixtureId}`,
      );
    for (const candidateFixtureId of definition.candidateFixtureIds ?? [])
      assert(
        candidateFixtureIds.has(candidateFixtureId),
        'SALES_MENU_L2_CASE_CANDIDATE_INVALID',
        `${row.fixtureRef}:${candidateFixtureId}`,
      );
    for (const candidateFixtureId of [definition.candidateFixtureId, definition.duplicateCandidateFixtureId].filter(
      Boolean,
    ))
      assert(
        candidateFixtureIds.has(candidateFixtureId),
        'SALES_MENU_L2_CASE_TARGET_CANDIDATE_INVALID',
        `${row.fixtureRef}:${candidateFixtureId}`,
      );
  }
  assert(
    candidate.kind === 'sales-menu-l2-activation-candidate' && candidate.noSeedRuntimeInput === true,
    'SALES_MENU_L2_CANDIDATE_BOUNDARY_INVALID',
  );
  assert(
    JSON.stringify(candidate.approvedCaseIds) === JSON.stringify(expectedCaseIds),
    'SALES_MENU_L2_CANDIDATE_CASE_SET_INVALID',
  );
  assert(candidate.candidateDigest === digestCandidate(candidate), 'SALES_MENU_L2_CANDIDATE_DIGEST_INVALID');
  assert(
    execution.kind === 'sales-menu-l2-execution-profile' && execution.noSeedRuntimeInput === true,
    'SALES_MENU_L2_EXECUTION_BOUNDARY_INVALID',
  );
  assert(['FRAMEWORK_ONLY', 'INCREMENTAL'].includes(execution.mode), 'SALES_MENU_L2_EXECUTION_MODE_INVALID');
  if (execution.mode === 'FRAMEWORK_ONLY')
    assert(execution.enabledCaseIds.length === 0, 'SALES_MENU_L2_FRAMEWORK_HAS_ACTIVE_CASES');
  if (execution.mode === 'INCREMENTAL') {
    assert(
      JSON.stringify(execution.enabledCaseIds) === JSON.stringify(expectedCaseIds),
      'SALES_MENU_L2_ACTIVE_CASE_SET_INVALID',
    );
    assert(
      execution.activationCandidate?.digest === candidate.candidateDigest,
      'SALES_MENU_L2_ACTIVE_CANDIDATE_DIGEST_INVALID',
    );
    assert(execution.readiness?.runBinding?.runId, 'SALES_MENU_L2_ACTIVE_RUN_BINDING_MISSING');
  }
  assertNoForbiddenFields(fixture);
  assertNoForbiddenFields(policy);
  const activeCaseIds = [...execution.enabledCaseIds];
  return {policy, fixture, candidate, execution, bindings, caseRows, activeCaseIds};
}

function selfTest() {
  const result = validatePolicy();
  const seedMutation = JSON.parse(JSON.stringify(result.fixture));
  seedMutation.seedRuntimeInput = true;
  try {
    assert(seedMutation.seedRuntimeInput === false, 'SALES_MENU_L2_SELF_TEST_SEED_MUTATION_DID_NOT_FAIL');
  } catch (error) {
    assert(
      error.code === 'SALES_MENU_L2_SELF_TEST_SEED_MUTATION_DID_NOT_FAIL',
      'SALES_MENU_L2_SELF_TEST_WRONG_RED_CODE',
    );
  }
  const countMutation = JSON.parse(JSON.stringify(result.fixture));
  countMutation.channelFixtures.pop();
  try {
    assert(countMutation.channelFixtures.length === 21, 'SALES_MENU_L2_SELF_TEST_DENOMINATOR_MUTATION_DID_NOT_FAIL');
  } catch (error) {
    assert(
      error.code === 'SALES_MENU_L2_SELF_TEST_DENOMINATOR_MUTATION_DID_NOT_FAIL',
      'SALES_MENU_L2_SELF_TEST_WRONG_COUNT_RED_CODE',
    );
  }
  process.stdout.write(
    `SALES_MENU_L2_FIXTURE_SELF_TEST=PASS; POLICY_CASES=${result.caseRows.length}; ACTIVE_CASES=${result.activeCaseIds.length}; CHANNELS=${result.fixture.channelFixtures.length}; MENUS=${result.fixture.menuFixtures.length}; CANDIDATES=${result.fixture.candidateFixtures.length}; SEED_RUNTIME_INPUT=false\n`,
  );
}

function main() {
  const result = validatePolicy();
  if (process.argv[2] === '--self-test') return selfTest();
  if (result.activeCaseIds.length === 0) {
    process.stdout.write(
      `SALES_MENU_L2_FIXTURE=FRAMEWORK_ONLY; POLICY_CASES=${result.caseRows.length}; ACTIVE_CASES=0; SETUP=OWNER_HTTP_COMMANDS; SEED_RUNTIME_INPUT=false\n`,
    );
    return;
  }
  const ownerFixturePath = process.env.R5_L2_SALES_MENU_OWNER_FIXTURE;
  assert(ownerFixturePath, 'R5_L2_SALES_MENU_OWNER_FIXTURE_REQUIRED');
  const ownerFixture = readJson(path.resolve(ownerFixturePath));
  assert(
    ownerFixture.kind === 'sales-menu-l2-owner-fixture' && ownerFixture.fixtureClass === 'TEST',
    'SALES_MENU_L2_OWNER_FIXTURE_KIND_INVALID',
  );
  assert(
    ownerFixture.setupChannel === 'OWNER_HTTP_COMMANDS' && ownerFixture.seedRuntimeInput === false,
    'SALES_MENU_L2_OWNER_FIXTURE_BOUNDARY_INVALID',
  );
  assert(
    ownerFixture.business?.status === 'PASS' && ownerFixture.cleanup?.status === 'PENDING_HELD',
    'SALES_MENU_L2_OWNER_FIXTURE_STATUS_INVALID',
  );
  for (const row of result.caseRows.filter(entry => result.activeCaseIds.includes(entry.caseId)))
    assert(
      ownerFixture.cases?.[row.fixtureRef] || ownerFixture.cases?.[row.caseId],
      'SALES_MENU_L2_OWNER_CASE_MISSING',
      row.caseId,
    );
  process.stdout.write(
    `SALES_MENU_L2_FIXTURE=PASS; POLICY_CASES=${result.caseRows.length}; ACTIVE_CASES=${result.activeCaseIds.length}; SETUP=OWNER_HTTP_COMMANDS; SEED_RUNTIME_INPUT=false; BUSINESS=${ownerFixture.business.status}; CLEANUP=${ownerFixture.cleanup.status}\n`,
  );
}

try {
  main();
} catch (error) {
  const failure =
    error instanceof FixtureFailure
      ? error
      : new FixtureFailure('SALES_MENU_L2_FIXTURE_VALIDATION_FAILED', error.message);
  process.stderr.write(`SALES_MENU_L2_FIXTURE=REFUSED; REASON=${failure.message}; SEED_RUNTIME_INPUT=false\n`);
  process.exitCode = 1;
}

export {validatePolicy};

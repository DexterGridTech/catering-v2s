#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const policyPath = path.join(root, 'contracts/policy/catalog-inventory-l2-scenarios.json');
const bindingPath = path.join(root, 'contracts/policy/catalog-inventory-l2-locator-bindings.json');
const fixtureCatalogPath = path.join(root, 'contracts/policy/catalog-inventory-fixture-catalog.json');
const executionProfilePath = path.join(root, 'contracts/policy/catalog-inventory-l2-execution.json');

const forbiddenRuntimeEnvPatterns = [
  /(?:^|_)SEED(?:_|$)/i,
  /SEED_REPORT/i,
  /API_REPORT/i,
  /CATALOG_INVENTORY_API_EVIDENCE/i,
];
const forbiddenSidecarKeys = /^(?:seedReport|seedFixture|seedCreated|seedObject|apiReport|apiEvidence|reportPath|apiObjectId)$/i;

class L2FixtureFailure extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}:${detail}` : code);
    this.code = code;
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new L2FixtureFailure('L2_FIXTURE_JSON_READ_FAILED', path.relative(root, filePath) + ':' + (error instanceof Error ? error.message : 'unknown'));
  }
}

function assert(condition, code, detail = '') {
  if (!condition) throw new L2FixtureFailure(code, detail);
}

function caseRows(policy) {
  return policy.scenarios.flatMap((scenario) => scenario.cases.map((entry) => ({...entry, scenarioId: scenario.scenarioId, scenarioApplicability: scenario.executionApplicability})));
}

function assertNoForbiddenRuntimeInputs(env) {
  const names = Object.keys(env);
  const forbidden = names.filter((name) => forbiddenRuntimeEnvPatterns.some((pattern) => pattern.test(name)) && env[name]);
  assert(forbidden.length === 0, 'L2_FIXTURE_SEED_OR_REPORT_INPUT_FORBIDDEN', forbidden.join(','));
}

function assertNoForbiddenSidecarKey(value, location = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenSidecarKey(entry, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!forbiddenSidecarKeys.test(key), 'L2_FIXTURE_FORBIDDEN_SIDEcar_FIELD', `${location}.${key}`);
    assertNoForbiddenSidecarKey(child, `${location}.${key}`);
  }
}

function sourceContainsBinding(source, binding) {
  const candidates = [binding.testId, ...(binding.alternatives ?? []), binding.testIdTemplate, binding.scopeFieldTestId, binding.name, ...(binding.names ?? [])].filter(Boolean);
  if (binding.parentTestId) candidates.push(binding.parentTestId);
  return candidates.every((candidate) => {
    const text = String(candidate);
    if (text.includes('${')) return source.includes(text.slice(0, text.indexOf('${')));
    return source.includes(text);
  });
}

function validateExecutionProfile(profile, rows) {
  assert(profile.kind === 'catalog-inventory-l2-execution-profile', 'L2_EXECUTION_PROFILE_KIND_INVALID');
  assert(profile.sourceOfTruth === 'contracts/policy/catalog-inventory-l2-case-blueprint.json', 'L2_EXECUTION_PROFILE_SOURCE_INVALID');
  assert(profile.noSeedRuntimeInput === true, 'L2_EXECUTION_PROFILE_SEED_RUNTIME_INPUT_NOT_FALSE');
  assert(['FRAMEWORK_ONLY', 'INCREMENTAL'].includes(profile.mode), 'L2_EXECUTION_PROFILE_MODE_INVALID');
  assert(Array.isArray(profile.enabledCaseIds), 'L2_EXECUTION_PROFILE_ENABLED_CASES_INVALID');
  const knownCaseIds = new Set(rows.map((row) => row.caseId));
  const enabledCaseIds = new Set(profile.enabledCaseIds);
  assert(enabledCaseIds.size === profile.enabledCaseIds.length, 'L2_EXECUTION_PROFILE_ENABLED_CASE_DUPLICATE');
  for (const caseId of enabledCaseIds) assert(knownCaseIds.has(caseId), 'L2_EXECUTION_PROFILE_UNKNOWN_CASE', caseId);
  if (profile.mode === 'FRAMEWORK_ONLY') assert(enabledCaseIds.size === 0, 'L2_EXECUTION_PROFILE_FRAMEWORK_HAS_ACTIVE_CASES');
  return rows.filter((row) => enabledCaseIds.has(row.caseId));
}

export function validatePolicy() {
  const policy = readJson(policyPath);
  const bindings = readJson(bindingPath);
  const fixtureCatalog = readJson(fixtureCatalogPath);
  const executionProfile = readJson(executionProfilePath);
  assert(policy.kind === 'catalog-inventory-l2-scenarios', 'L2_POLICY_KIND_INVALID');
  assert(policy.executionBoundary?.fixtureClass === 'TEST', 'L2_POLICY_FIXTURE_CLASS_INVALID');
  assert(policy.executionBoundary?.setupChannel === 'OWNER_HTTP_COMMANDS', 'L2_POLICY_SETUP_CHANNEL_INVALID');
  assert(policy.executionBoundary?.seedRuntimeInput === false, 'L2_POLICY_SEED_RUNTIME_INPUT_NOT_FALSE');
  assert(policy.executionBoundary?.reportInputs?.length === 0, 'L2_POLICY_REPORT_INPUTS_NOT_EMPTY');
  assert(bindings.kind === 'catalog-inventory-l2-locator-bindings', 'L2_BINDINGS_KIND_INVALID');
  assert(bindings.bindingMode === 'CASE_PARAMETER_CONTROL_KEYS', 'L2_BINDINGS_MODE_INVALID');
  assert(bindings.noSeedRuntimeInput === true, 'L2_BINDINGS_SEED_RUNTIME_INPUT_NOT_FALSE');

  const rows = caseRows(policy);
  assert(rows.length === policy.caseCount && rows.length === bindings.caseCount, 'L2_CASE_COUNT_MISMATCH', `${rows.length}/${policy.caseCount}/${bindings.caseCount}`);
  const caseIds = new Set();
  for (const row of rows) {
    assert(!caseIds.has(row.caseId), 'L2_CASE_ID_DUPLICATE', row.caseId);
    caseIds.add(row.caseId);
    assert(!String(row.fixtureRef).startsWith('SEED-'), 'L2_CASE_SEED_FIXTURE_FORBIDDEN', row.caseId);
    assert(String(row.fixtureRef).startsWith('FIXTURE-'), 'L2_CASE_FIXTURE_KIND_INVALID', row.caseId);
    for (const controlKey of row.parameter?.controlKeys ?? []) assert(bindings.controls?.[controlKey], 'L2_CONTROL_BINDING_MISSING', `${row.caseId}:${controlKey}`);
  }

  const seedFixtureIds = new Set((fixtureCatalog.seedDatasets ?? []).map((entry) => entry.fixtureId));
  const testFixtureIds = new Set((fixtureCatalog.testDatasets ?? []).map((entry) => entry.fixtureId));
  for (const row of rows) {
    assert(!seedFixtureIds.has(row.fixtureRef), 'L2_CASE_REFERENCES_SEED_DATASET', row.caseId);
    assert(testFixtureIds.has(row.fixtureRef), 'L2_CASE_TEST_FIXTURE_MISSING', `${row.caseId}:${row.fixtureRef}`);
  }

  const sourceCache = new Map();
  for (const [controlKey, binding] of Object.entries(bindings.controls ?? {})) {
    for (const relativeSource of binding.sourceFiles ?? []) {
      const absoluteSource = path.join(root, relativeSource);
      assert(fs.existsSync(absoluteSource), 'L2_CONTROL_SOURCE_MISSING', `${controlKey}:${relativeSource}`);
      if (!sourceCache.has(absoluteSource)) sourceCache.set(absoluteSource, fs.readFileSync(absoluteSource, 'utf8'));
    }
    const sourceText = (binding.sourceFiles ?? []).map((relativeSource) => sourceCache.get(path.join(root, relativeSource)) ?? '').join('\n');
    assert(sourceContainsBinding(sourceText, binding), 'L2_CONTROL_BINDING_NOT_IN_SOURCE', controlKey);
  }

  const activeRows = validateExecutionProfile(executionProfile, rows);
  return {policy, bindings, fixtureCatalog, rows, profile: executionProfile, activeRows};
}

function requiredCaseFacts(row, facts) {
  const keys = new Set(row.parameter?.controlKeys ?? []);
  if (keys.has('CATALOG_ITEM_ROW')) {
    assert(typeof facts.itemCode === 'string' && facts.itemCode.length > 0, 'L2_OWNER_FIXTURE_ITEM_CODE_REQUIRED', row.caseId);
    assert(typeof facts.itemName === 'string' && facts.itemName.length > 0, 'L2_OWNER_FIXTURE_ITEM_NAME_REQUIRED', row.caseId);
  }
  if (keys.has('INVENTORY_TARGET_ROW')) assert(typeof facts.targetRef === 'string' && facts.targetRef.length > 0, 'L2_OWNER_FIXTURE_TARGET_REF_REQUIRED', row.caseId);
  if (keys.has('CATALOG_LOCAL_SEARCH') || keys.has('CATALOG_COPY_SOURCE')) assert(typeof facts.keyword === 'string' && facts.keyword.length > 0, 'L2_OWNER_FIXTURE_KEYWORD_REQUIRED', row.caseId);
  if (keys.has('CATALOG_TREE') || keys.has('CATALOG_TREE_SEARCH')) assert(typeof facts.treeNodeText === 'string' && facts.treeNodeText.length > 0, 'L2_OWNER_FIXTURE_TREE_NODE_REQUIRED', row.caseId);
  if (keys.has('CATALOG_BRAND_SWITCH')) assert(typeof facts.brandName === 'string' && facts.brandName.length > 0, 'L2_OWNER_FIXTURE_BRAND_REQUIRED', row.caseId);
  if (keys.has('STORE_SCOPE') || keys.has('HEAD_COMPANY_SCOPE')) {
    assert(facts.scope && typeof facts.scope === 'object', 'L2_OWNER_FIXTURE_SCOPE_REQUIRED', row.caseId);
    assert(['STORE', 'HEAD_COMPANY'].includes(facts.scope.kind), 'L2_OWNER_FIXTURE_SCOPE_KIND_INVALID', row.caseId);
    if (facts.scope.kind === 'STORE') {
      assert(typeof facts.scope.regionName === 'string' && facts.scope.regionName.length > 0, 'L2_OWNER_FIXTURE_REGION_NAME_REQUIRED', row.caseId);
      assert(typeof facts.scope.projectName === 'string' && facts.scope.projectName.length > 0, 'L2_OWNER_FIXTURE_PROJECT_NAME_REQUIRED', row.caseId);
      assert(typeof facts.scope.storeName === 'string' && facts.scope.storeName.length > 0, 'L2_OWNER_FIXTURE_STORE_NAME_REQUIRED', row.caseId);
    } else assert(typeof facts.scope.headCompanyName === 'string' && facts.scope.headCompanyName.length > 0, 'L2_OWNER_FIXTURE_HEAD_COMPANY_NAME_REQUIRED', row.caseId);
  }
}

export function validateOwnerFixture(fixture, {policy, rows, activeRows} = validatePolicy()) {
  assert(fixture && typeof fixture === 'object', 'L2_OWNER_FIXTURE_OBJECT_REQUIRED');
  assert(fixture.kind === 'catalog-inventory-l2-owner-fixture', 'L2_OWNER_FIXTURE_KIND_INVALID');
  assert(fixture.fixtureClass === 'TEST', 'L2_OWNER_FIXTURE_CLASS_INVALID');
  assert(fixture.setupChannel === 'OWNER_HTTP_COMMANDS', 'L2_OWNER_FIXTURE_SETUP_CHANNEL_INVALID');
  assert(fixture.seedRuntimeInput === false, 'L2_OWNER_FIXTURE_SEED_RUNTIME_INPUT_NOT_FALSE');
  assert(typeof fixture.runId === 'string' && fixture.runId.length > 0, 'L2_OWNER_FIXTURE_RUN_ID_REQUIRED');
  assert(fixture.ownerFacts && typeof fixture.ownerFacts === 'object', 'L2_OWNER_FIXTURE_OWNER_FACTS_REQUIRED');
  assert(fixture.cases && typeof fixture.cases === 'object' && !Array.isArray(fixture.cases), 'L2_OWNER_FIXTURE_CASES_REQUIRED');
  assert(fixture.business && fixture.cleanup, 'L2_OWNER_FIXTURE_BUSINESS_CLEANUP_REQUIRED');
  assert(typeof fixture.business.status === 'string' && typeof fixture.cleanup.status === 'string', 'L2_OWNER_FIXTURE_BUSINESS_CLEANUP_STATUS_REQUIRED');
  assertNoForbiddenSidecarKey(fixture);
  const expectedRows = activeRows ?? rows;
  const expectedCaseIds = new Set(expectedRows.map((row) => row.caseId));
  const actualCaseIds = Object.keys(fixture.cases);
  assert(actualCaseIds.length === expectedCaseIds.size, 'L2_OWNER_FIXTURE_CASE_COUNT_MISMATCH', `${actualCaseIds.length}/${expectedCaseIds.size}`);
  for (const row of expectedRows) {
    const facts = fixture.cases[row.caseId];
    assert(facts && typeof facts === 'object', 'L2_OWNER_FIXTURE_CASE_MISSING', row.caseId);
    assert(facts.fixtureRef === row.fixtureRef, 'L2_OWNER_FIXTURE_CASE_FIXTURE_MISMATCH', row.caseId);
    requiredCaseFacts(row, facts);
  }
  for (const caseId of actualCaseIds) assert(expectedCaseIds.has(caseId), 'L2_OWNER_FIXTURE_UNKNOWN_CASE', caseId);
  assertNoForbiddenRuntimeInputs(process.env);
  return {policy, rows, fixture};
}

function syntheticFixture(rows) {
  const cases = Object.fromEntries(rows.map((row) => {
    const controls = new Set(row.parameter?.controlKeys ?? []);
    return [row.caseId, {
      fixtureRef: row.fixtureRef,
      scope: controls.has('HEAD_COMPANY_SCOPE') ? {kind: 'HEAD_COMPANY', headCompanyName: 'Synthetic Head'} : {kind: 'STORE', regionName: 'Synthetic Region', projectName: 'Synthetic Project', storeName: 'Synthetic Store'},
      itemCode: controls.has('CATALOG_ITEM_ROW') ? 'SYNTHETIC-ITEM' : undefined,
      itemName: controls.has('CATALOG_ITEM_ROW') ? 'Synthetic item' : undefined,
      targetRef: controls.has('INVENTORY_TARGET_ROW') ? 'synthetic-target-ref' : undefined,
      keyword: controls.has('CATALOG_LOCAL_SEARCH') || controls.has('CATALOG_COPY_SOURCE') ? 'Synthetic' : undefined,
      treeNodeText: controls.has('CATALOG_TREE') || controls.has('CATALOG_TREE_SEARCH') ? 'Synthetic tree' : undefined,
      brandName: controls.has('CATALOG_BRAND_SWITCH') ? 'Synthetic brand' : undefined,
    }];
  }));
  return {schemaVersion: 1, kind: 'catalog-inventory-l2-owner-fixture', fixtureClass: 'TEST', setupChannel: 'OWNER_HTTP_COMMANDS', seedRuntimeInput: false, runId: 'synthetic-l2-run', ownerFacts: {source: 'owner-http'}, cases, business: {status: 'NOT_RUN'}, cleanup: {status: 'PENDING'}};
}

function selfTest() {
  const contract = validatePolicy();
  validateOwnerFixture(syntheticFixture(contract.activeRows), contract);
  const incrementalContract = {
    ...contract,
    profile: {...contract.profile, mode: 'INCREMENTAL', enabledCaseIds: contract.rows.map((row) => row.caseId)},
    activeRows: contract.rows
  };
  validateOwnerFixture(syntheticFixture(contract.rows), incrementalContract);
  const seedMutation = syntheticFixture(contract.activeRows);
  seedMutation.seedRuntimeInput = true;
  try {
    validateOwnerFixture(seedMutation, contract);
    throw new L2FixtureFailure('L2_SELF_TEST_SEED_MUTATION_DID_NOT_FAIL');
  } catch (error) {
    if (!(error instanceof L2FixtureFailure) || error.code !== 'L2_OWNER_FIXTURE_SEED_RUNTIME_INPUT_NOT_FALSE') throw error;
  }
  process.stdout.write(`CATALOG_INVENTORY_L2_FIXTURE_SELF_TEST=PASS; POLICY_CASES=${contract.rows.length}; ACTIVE_CASES=${contract.activeRows.length}; MODE=${contract.profile.mode}; SEED_RUNTIME_INPUT=false\n`);
}

function main() {
  const command = process.argv[2] ?? '--validate';
  if (command === '--self-test') return selfTest();
  const contract = validatePolicy();
  assertNoForbiddenRuntimeInputs(process.env);
  if (contract.activeRows.length === 0) {
    process.stdout.write(`CATALOG_INVENTORY_L2_FIXTURE=FRAMEWORK_ONLY; POLICY_CASES=${contract.rows.length}; ACTIVE_CASES=0; SETUP=OWNER_HTTP_COMMANDS; SEED_RUNTIME_INPUT=false\n`);
    return;
  }
  const fixturePath = process.env.R5_L2_CATALOG_INVENTORY_OWNER_FIXTURE;
  assert(fixturePath, 'R5_L2_CATALOG_INVENTORY_OWNER_FIXTURE_REQUIRED');
  const fixture = readJson(path.resolve(fixturePath));
  validateOwnerFixture(fixture, contract);
  process.stdout.write(`CATALOG_INVENTORY_L2_FIXTURE=PASS; POLICY_CASES=${contract.rows.length}; ACTIVE_CASES=${contract.activeRows.length}; SETUP=OWNER_HTTP_COMMANDS; SEED_RUNTIME_INPUT=false; BUSINESS=${fixture.business.status}; CLEANUP=${fixture.cleanup.status}\n`);
}

try {
  main();
} catch (error) {
  const failure = error instanceof L2FixtureFailure ? error : new L2FixtureFailure('L2_FIXTURE_VALIDATION_FAILED', error instanceof Error ? error.message : 'unknown');
  process.stderr.write(`CATALOG_INVENTORY_L2_FIXTURE=REFUSED; REASON=${failure.message}; SEED_RUNTIME_INPUT=false\n`);
  process.exitCode = 1;
}

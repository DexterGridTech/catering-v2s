#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const policyPath = path.join(root, 'contracts/policy/catalog-inventory-l2-scenarios.json');
const bindingPath = path.join(root, 'contracts/policy/catalog-inventory-l2-locator-bindings.json');
const fixtureCatalogPath = path.join(root, 'contracts/policy/catalog-inventory-fixture-catalog.json');
const activationCandidatePath = path.join(root, 'contracts/policy/catalog-inventory-l2-activation-candidate.json');
const executionProfilePath = path.join(root, 'contracts/policy/catalog-inventory-l2-execution.json');
const forbiddenUserVisibleTerms = ['商品类型'];

const forbiddenRuntimeEnvPatterns = [
  /(?:^|_)SEED(?:_|$)/i,
  /SEED_REPORT/i,
  /API_REPORT/i,
  /CATALOG_INVENTORY_API_EVIDENCE/i,
];
const forbiddenSidecarKeys = /^(?:seedReport|seedFixture|seedCreated|seedObject|apiReport|apiEvidence|reportPath|apiObjectId)$/i;
const catalogLibraryReadbackProtocols = Object.freeze({
  ITEM_PAGE: {requiredFields: ['itemCode', 'categoryRef', 'status'], factPaths: ['item.itemCode', 'item.categoryRef', 'item.status'], successOwnerReaders: ['getOperationsCatalogItems'], unchangedOwnerReaders: ['getOperationsCatalogItems']},
  ITEM_DETAIL: {requiredFields: ['itemCode', 'categoryRef', 'productionTagRef', 'version', 'status'], factPaths: ['item.itemCode', 'item.categoryRef', 'item.productionTagRef', 'item.version', 'item.status'], successOwnerReaders: ['getOperationsCatalogItem'], unchangedOwnerReaders: ['getOperationsCatalogItem']},
  CREATED_ITEM: {requiredFields: ['itemCode', 'version', 'status'], factPaths: ['item.itemCode', 'item.version', 'item.status'], successOwnerReaders: ['createOperationsCatalogItem'], unchangedOwnerReaders: ['getOperationsCatalogItems']},
  SAVED_ITEM: {requiredFields: ['itemCode', 'productionTagRef', 'version', 'status'], factPaths: ['item.itemCode', 'item.productionTagRef', 'item.version', 'item.status'], successOwnerReaders: ['saveOperationsCatalogItem'], unchangedOwnerReaders: ['getOperationsCatalogItem']},
  DICTIONARY_ENTRY: {requiredFields: ['code', 'name', 'status'], factPaths: ['dictionary.code', 'dictionary.name', 'dictionary.status'], successOwnerReaders: ['createOperationsProductionTag'], unchangedOwnerReaders: ['getOperationsProductionTags']},
  BATCH_RECEIPT_AND_ITEMS: {requiredFields: ['itemCode', 'outcome', 'version'], factPaths: ['receipt.itemCode', 'receipt.outcome', 'receipt.version', 'item.itemCode', 'item.status', 'item.version'], successOwnerReaders: ['batchTransitionOperationsCatalogItemStatus', 'getOperationsCatalogItems'], unchangedOwnerReaders: ['batchTransitionOperationsCatalogItemStatus', 'getOperationsCatalogItems']},
  COPY_PREFLIGHT_AND_EXECUTION: {requiredFields: ['preflightDigest', 'created'], factPaths: ['preflight.preflightDigest', 'preflight.selectedItemCode', 'execution.preflightDigest', 'execution.createdCodes'], successOwnerReaders: ['preflightOperationsBrandCatalogCopy', 'executeOperationsBrandCatalogCopy'], unchangedOwnerReaders: ['preflightOperationsBrandCatalogCopy']},
  LIFECYCLE_ITEM: {requiredFields: ['itemCode', 'version', 'status'], factPaths: ['item.itemCode', 'item.version', 'item.status'], successOwnerReaders: ['transitionOperationsCatalogItemStatus'], unchangedOwnerReaders: ['getOperationsCatalogItem']},
});

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

function hasFactPath(value, factPath) {
  return factPath.split('.').every((segment) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, segment)) return false;
    value = value[segment];
    return true;
  });
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

function assertNoForbiddenUserVisibleTerms(value, location = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenUserVisibleTerms(entry, `${location}[${index}]`));
    return;
  }
  if (typeof value === 'string') {
    for (const term of forbiddenUserVisibleTerms) {
      assert(!value.includes(term), 'L2_FORBIDDEN_USER_VISIBLE_TERM', `${location}:${term}`);
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['businessOracle', 'steps', 'expectedBusinessResult', 'journey', 'businessRequirement'].includes(key)) {
      assertNoForbiddenUserVisibleTerms(child, `${location}.${key}`);
    }
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

function assertOwnerTestIdUsage(ownerSources, binding, controlKey) {
  if (binding.ownerTestIdExpressions === undefined) return;
  assert(
    Array.isArray(binding.ownerTestIdExpressions) && binding.ownerTestIdExpressions.length > 0,
    'L2_CONTROL_OWNER_TEST_ID_EXPRESSIONS_INVALID',
    controlKey,
  );
  for (const expression of binding.ownerTestIdExpressions) {
    assert(
      typeof expression === 'string' && expression.length > 0 && ownerSources.some(source => source.includes(expression)),
      'L2_CONTROL_OWNER_TEST_ID_USAGE_NOT_IN_SOURCE',
      `${controlKey}:${expression}`,
    );
  }
}

function candidateDigest(candidate) {
  const copy = JSON.parse(JSON.stringify(candidate));
  delete copy.candidateDigest;
  return createHash('sha256').update(`${JSON.stringify(copy, null, 2)}\n`).digest('hex');
}

function validateActivationCandidate(candidate, rows) {
  assert(candidate?.kind === 'catalog-inventory-l2-activation-candidate', 'L2_ACTIVATION_CANDIDATE_KIND_INVALID');
  assert(candidate?.noSeedRuntimeInput === true, 'L2_ACTIVATION_CANDIDATE_SEED_RUNTIME_INPUT_NOT_FALSE');
  assert(typeof candidate?.candidateDigest === 'string' && candidate.candidateDigest === candidateDigest(candidate), 'L2_ACTIVATION_CANDIDATE_DIGEST_INVALID');
  assert(Array.isArray(candidate.approvedCaseIds) && candidate.approvedCaseIds.length > 0, 'L2_ACTIVATION_CANDIDATE_CASE_SET_INVALID');
  assert(new Set(candidate.approvedCaseIds).size === candidate.approvedCaseIds.length, 'L2_ACTIVATION_CANDIDATE_CASE_DUPLICATE');
  const knownCaseIds = new Set(rows.map((row) => row.caseId));
  for (const caseId of candidate.approvedCaseIds) assert(knownCaseIds.has(caseId), 'L2_ACTIVATION_CANDIDATE_UNKNOWN_CASE', caseId);
  return candidate;
}

function validateExecutionProfile(profile, rows, candidate) {
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
  if (profile.mode === 'INCREMENTAL') {
    assert(profile.activationCandidate?.path === 'contracts/policy/catalog-inventory-l2-activation-candidate.json', 'L2_EXECUTION_PROFILE_CANDIDATE_PATH_INVALID');
    assert(profile.activationCandidate?.digest === candidate.candidateDigest, 'L2_EXECUTION_PROFILE_CANDIDATE_DIGEST_INVALID');
    assert(profile.readiness?.runBinding && typeof profile.readiness.runBinding.runId === 'string', 'L2_EXECUTION_PROFILE_READINESS_BINDING_INVALID');
    assert(profile.enabledCaseIds.length === candidate.approvedCaseIds.length, 'L2_EXECUTION_PROFILE_ACTIVE_CASE_COUNT_INVALID');
    assert(profile.enabledCaseIds.every((caseId, index) => caseId === candidate.approvedCaseIds[index]), 'L2_EXECUTION_PROFILE_ACTIVE_CASE_EXACT_SET_INVALID');
  }
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
  assertNoForbiddenUserVisibleTerms(policy);

  const rows = caseRows(policy);
  const activationCandidate = validateActivationCandidate(readJson(activationCandidatePath), rows);
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
  // P1's activation candidate is the only declaration of the selected
  // Journey fixture set.  Fixture validation consumes it; it must not carry
  // a second handwritten list that can quietly drift from the active cases.
  const catalogLibraryFixtureIds = activationCandidate.fixtureRefs;
  assert(
    Array.isArray(catalogLibraryFixtureIds) &&
      catalogLibraryFixtureIds.length === 8 &&
      new Set(catalogLibraryFixtureIds).size === catalogLibraryFixtureIds.length &&
      catalogLibraryFixtureIds.every((fixtureId) => typeof fixtureId === 'string' && fixtureId.length > 0),
    'L2_CATALOG_LIBRARY_FIXTURE_CANDIDATE_SET_INVALID',
  );
  assert(catalogLibraryFixtureIds.every((fixtureId) => testFixtureIds.has(fixtureId)), 'L2_CATALOG_LIBRARY_FIXTURE_EXACT_SET_MISSING');
  assert(!(fixtureCatalog.testDatasets ?? []).some((entry) => /^FIXTURE-L2-(?:FIND|VIEW|CREATE|EDIT|CONFIG|BATCH|COPY|GOVERNANCE)$/.test(String(entry.fixtureId))), 'L2_LEGACY_LIBRARY_FIXTURE_REMAINS');
  for (const fixtureId of catalogLibraryFixtureIds) {
    const dataset = fixtureCatalog.testDatasets.find((entry) => entry.fixtureId === fixtureId);
    for (const field of ['preState', 'actionInput', 'expectedReadback', 'unchangedReadback']) {
      assert(dataset?.expected?.[field] && typeof dataset.expected[field] === 'object', 'L2_CATALOG_LIBRARY_FIXTURE_CONTRACT_MISSING', `${fixtureId}:${field}`);
    }
  }
  for (const row of rows) {
    assert(!seedFixtureIds.has(row.fixtureRef), 'L2_CASE_REFERENCES_SEED_DATASET', row.caseId);
    assert(testFixtureIds.has(row.fixtureRef), 'L2_CASE_TEST_FIXTURE_MISSING', `${row.caseId}:${row.fixtureRef}`);
  }

  const sourceCache = new Map();
  const catalogTestIdsPath = path.join(root, 'apps/frontend/operations-admin/src/features/catalog-management/catalogTestIds.ts');
  assert(fs.existsSync(catalogTestIdsPath), 'L2_CATALOG_TEST_IDS_SOURCE_MISSING');
  const catalogTestIdsSource = fs.readFileSync(catalogTestIdsPath, 'utf8');
  for (const [controlKey, binding] of Object.entries(bindings.controls ?? {})) {
    for (const relativeSource of binding.sourceFiles ?? []) {
      const absoluteSource = path.join(root, relativeSource);
      assert(fs.existsSync(absoluteSource), 'L2_CONTROL_SOURCE_MISSING', `${controlKey}:${relativeSource}`);
      if (!sourceCache.has(absoluteSource)) sourceCache.set(absoluteSource, fs.readFileSync(absoluteSource, 'utf8'));
    }
    const sourceText = [
      ...(binding.sourceFiles ?? []).map((relativeSource) => sourceCache.get(path.join(root, relativeSource)) ?? ''),
      ...(binding.sourceFiles ?? []).some((relativeSource) => relativeSource.includes('/catalog-management/')) ? [catalogTestIdsSource] : [],
    ].join('\n');
    if (binding.presence !== 'ABSENT') {
      assert(sourceContainsBinding(sourceText, binding), 'L2_CONTROL_BINDING_NOT_IN_SOURCE', controlKey);
    }
    const ownerSources = (binding.sourceFiles ?? [])
      .filter(relativeSource => !relativeSource.endsWith('/catalogTestIds.ts'))
      .map(relativeSource => sourceCache.get(path.join(root, relativeSource)) ?? '');
    assertOwnerTestIdUsage(ownerSources, binding, controlKey);
  }

  const activeRows = validateExecutionProfile(executionProfile, rows, activationCandidate);
  return {policy, bindings, fixtureCatalog, rows, candidate: activationCandidate, profile: executionProfile, activeRows};
}

function requiredCaseFacts(row, facts, {allowSynthetic = false} = {}) {
  const keys = new Set(row.parameter?.controlKeys ?? []);
  if ([...keys].some((key) => /^CATALOG_MEDIA_(?:STATUS|RETRY|MOVE|PRIMARY|REMOVE)$/.test(key))) {
    assert(typeof facts.mediaAssetRef === 'string' && facts.mediaAssetRef.length > 0, 'L2_OWNER_FIXTURE_MEDIA_ASSET_REF_REQUIRED', row.caseId);
  }
  if (String(row.fixtureRef).startsWith('FIXTURE-CATALOG-LIBRARY-')) {
    for (const field of ['preState', 'actionInput', 'expectedReadback', 'unchangedReadback']) {
      assert(facts[field] && typeof facts[field] === 'object' && !Array.isArray(facts[field]), `L2_OWNER_FIXTURE_${field.toUpperCase()}_REQUIRED`, row.caseId);
    }
    assert(facts.ownerReadback && typeof facts.ownerReadback === 'object', 'L2_OWNER_FIXTURE_OWNER_READBACK_REQUIRED', row.caseId);
    const baseline = facts.ownerReadback;
    const descriptors = [facts.expectedReadback, facts.unchangedReadback];
    for (const descriptor of [baseline, ...descriptors]) {
      assert(typeof descriptor.readTarget === 'string' && descriptor.readTarget.length > 0, 'L2_OWNER_FIXTURE_READ_TARGET_REQUIRED', row.caseId);
      const protocol = catalogLibraryReadbackProtocols[descriptor.readTarget];
      if (!protocol) {
        assert(allowSynthetic && descriptor.readTarget === 'SYNTHETIC_TARGET', 'L2_OWNER_FIXTURE_SYNTHETIC_TARGET_FORBIDDEN', row.caseId);
      }
      assert(Array.isArray(descriptor.requiredFields) && descriptor.requiredFields.length > 0, 'L2_OWNER_FIXTURE_REQUIRED_FIELDS_REQUIRED', row.caseId);
      assert(descriptor.requiredFields.every((field) => typeof field === 'string' && field.length > 0), 'L2_OWNER_FIXTURE_REQUIRED_FIELDS_INVALID', row.caseId);
      assert(new Set(descriptor.requiredFields).size === descriptor.requiredFields.length, 'L2_OWNER_FIXTURE_REQUIRED_FIELDS_DUPLICATE', row.caseId);
      assert(Array.isArray(descriptor.ownerReaders) && descriptor.ownerReaders.length > 0, 'L2_OWNER_FIXTURE_OWNER_READERS_REQUIRED', row.caseId);
      assert(descriptor.ownerReaders.every((reader) => typeof reader === 'string' && reader.length > 0), 'L2_OWNER_FIXTURE_OWNER_READERS_INVALID', row.caseId);
      assert(new Set(descriptor.ownerReaders).size === descriptor.ownerReaders.length, 'L2_OWNER_FIXTURE_OWNER_READERS_DUPLICATE', row.caseId);
      if (protocol) {
        assert(JSON.stringify(descriptor.requiredFields) === JSON.stringify(protocol.requiredFields), 'L2_OWNER_FIXTURE_READ_TARGET_FIELDS_INVALID', `${row.caseId}:${descriptor.readTarget}`);
        assert(JSON.stringify(descriptor.factPaths) === JSON.stringify(protocol.factPaths), 'L2_OWNER_FIXTURE_READ_TARGET_FACT_PATHS_INVALID', `${row.caseId}:${descriptor.readTarget}`);
        if (descriptor !== baseline) {
          const expectedReaders = descriptor.mode === 'OWNER_FACTS_STRICT' ? protocol.successOwnerReaders : protocol.unchangedOwnerReaders;
          assert(JSON.stringify(descriptor.ownerReaders) === JSON.stringify(expectedReaders), 'L2_OWNER_FIXTURE_READ_TARGET_OWNER_INVALID', `${row.caseId}:${descriptor.readTarget}`);
        }
      }
      assert(descriptor.facts && typeof descriptor.facts === 'object' && !Array.isArray(descriptor.facts), 'L2_OWNER_FIXTURE_TARGET_FACTS_REQUIRED', `${row.caseId}:${descriptor.readTarget}`);
      if (descriptor !== baseline) {
        assert(descriptor.factPaths.every((factPath) => hasFactPath(descriptor.facts, factPath)), 'L2_OWNER_FIXTURE_TARGET_FACT_PATH_VALUE_MISSING', `${row.caseId}:${descriptor.readTarget}`);
      }
    }
    assert(descriptors.every((descriptor) => descriptor.readTarget === baseline.readTarget), 'L2_OWNER_FIXTURE_READ_TARGET_MISMATCH', row.caseId);
    assert(descriptors.every((descriptor) => JSON.stringify(descriptor.requiredFields) === JSON.stringify(baseline.requiredFields)), 'L2_OWNER_FIXTURE_REQUIRED_FIELDS_MISMATCH', row.caseId);
    assert(descriptors.every((descriptor) => JSON.stringify(descriptor.factPaths) === JSON.stringify(baseline.factPaths)), 'L2_OWNER_FIXTURE_FACT_PATHS_MISMATCH', row.caseId);
    assert(JSON.stringify(baseline.ownerReaders) === JSON.stringify([...new Set(descriptors.flatMap((descriptor) => descriptor.ownerReaders))]), 'L2_OWNER_FIXTURE_OWNER_READER_UNION_INVALID', row.caseId);
    const declaredActions = row.parameter?.declaredActions;
    assert(Array.isArray(declaredActions) && declaredActions.length === 1, 'L2_OWNER_FIXTURE_DECLARED_ACTION_EXACT_SET_INVALID', row.caseId);
    assert(typeof declaredActions[0]?.actionId === 'string' && declaredActions[0].actionId.length > 0, 'L2_OWNER_FIXTURE_DECLARED_ACTION_ID_REQUIRED', row.caseId);
    assert(declaredActions[0]?.kind === 'USER_JOURNEY', 'L2_OWNER_FIXTURE_DECLARED_ACTION_KIND_INVALID', row.caseId);
  }
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

export function validateOwnerFixture(fixture, {policy, rows, activeRows} = validatePolicy(), {allowSynthetic = false} = {}) {
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
    requiredCaseFacts(row, facts, {allowSynthetic});
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
      ...(String(row.fixtureRef).startsWith('FIXTURE-CATALOG-LIBRARY-') ? {
        preState: {itemCode: `SYNTHETIC-${row.caseId}`, version: 1, productionTagRef: null},
        actionInput: {journey: row.caseId, categorySelection: 'SYNTHETIC-ROOT/SYNTHETIC-CATEGORY', productionTagRef: 'SYNTHETIC-PRODUCTION-TAG'},
        expectedReadback: {readTarget: 'SYNTHETIC_TARGET', requiredFields: ['itemCode', 'version'], factPaths: ['item.itemCode', 'item.version'], ownerReaders: ['getSyntheticOwner'], versionRule: 'AT_LEAST_BASELINE_VERSION', facts: {item: {itemCode: `SYNTHETIC-${row.caseId}`, version: 2}}, businessResult: 'SUCCESS'},
        unchangedReadback: {readTarget: 'SYNTHETIC_TARGET', requiredFields: ['itemCode', 'version'], factPaths: ['item.itemCode', 'item.version'], ownerReaders: ['getSyntheticOwner'], versionRule: 'EXACT_PRE_STATE', facts: {item: {itemCode: `SYNTHETIC-${row.caseId}`, version: 1}}, businessResult: 'FAILURE'},
        ownerReadback: {readTarget: 'SYNTHETIC_TARGET', requiredFields: ['itemCode', 'version'], factPaths: ['item.itemCode', 'item.version'], ownerReaders: ['getSyntheticOwner'], source: 'owner-http', facts: {item: {itemCode: `SYNTHETIC-${row.caseId}`, version: 1}}},
      } : {}),
    }];
  }));
  return {schemaVersion: 1, kind: 'catalog-inventory-l2-owner-fixture', fixtureClass: 'TEST', setupChannel: 'OWNER_HTTP_COMMANDS', seedRuntimeInput: false, runId: 'synthetic-l2-run', ownerFacts: {source: 'owner-http'}, cases, business: {status: 'NOT_RUN'}, cleanup: {status: 'PENDING'}};
}

function selfTest() {
  const contract = validatePolicy();
  for (const [controlKey, binding] of Object.entries(contract.bindings.controls ?? {})) {
    if (binding.ownerTestIdExpressions === undefined) continue;
    const ownerSources = (binding.sourceFiles ?? [])
      .filter(relativeSource => !relativeSource.endsWith('/catalogTestIds.ts'))
      .map(relativeSource => fs.readFileSync(path.join(root, relativeSource), 'utf8'));
    for (const expression of binding.ownerTestIdExpressions) {
      const ownerIndex = ownerSources.findIndex(source => source.includes(expression));
      assert(ownerIndex >= 0, 'L2_SELF_TEST_OWNER_TEST_ID_SOURCE_MISSING', `${controlKey}:${expression}`);
      const redMutation = [...ownerSources];
      redMutation[ownerIndex] = redMutation[ownerIndex].replace(expression, '');
      try {
        assertOwnerTestIdUsage(redMutation, binding, controlKey);
        throw new L2FixtureFailure('L2_SELF_TEST_OWNER_TEST_ID_MUTATION_DID_NOT_FAIL', `${controlKey}:${expression}`);
      } catch (error) {
        if (!(error instanceof L2FixtureFailure) || error.code !== 'L2_CONTROL_OWNER_TEST_ID_USAGE_NOT_IN_SOURCE') throw error;
      }
    }
  }
  validateOwnerFixture(syntheticFixture(contract.activeRows), contract, {allowSynthetic: true});
  const incrementalContract = {
    ...contract,
    profile: {
      ...contract.profile,
      mode: 'INCREMENTAL',
      enabledCaseIds: [...contract.candidate.approvedCaseIds],
      activationCandidate: {path: 'contracts/policy/catalog-inventory-l2-activation-candidate.json', digest: contract.candidate.candidateDigest},
      readiness: {runBinding: {runId: 'synthetic-l2-run'}},
    },
    activeRows: contract.rows.filter((row) => contract.candidate.approvedCaseIds.includes(row.caseId))
  };
  validateOwnerFixture(syntheticFixture(incrementalContract.activeRows), incrementalContract, {allowSynthetic: true});
  try {
    // FRAMEWORK_ONLY intentionally has no active cases.  The red mutation must
    // nevertheless exercise the approved incremental exact set, otherwise a
    // synthetic read target could slip through while this self-test stays green.
    const redMutationRow = incrementalContract.activeRows[0];
    assert(redMutationRow, 'L2_SELF_TEST_INCREMENTAL_ROW_MISSING');
    validateOwnerFixture(
      syntheticFixture([redMutationRow]),
      {...incrementalContract, activeRows: [redMutationRow]},
    );
    throw new L2FixtureFailure('L2_SELF_TEST_SYNTHETIC_TARGET_MUTATION_DID_NOT_FAIL');
  } catch (error) {
    if (!(error instanceof L2FixtureFailure) || error.code !== 'L2_OWNER_FIXTURE_SYNTHETIC_TARGET_FORBIDDEN') throw error;
  }
  const wrongActiveSet = {...incrementalContract, profile: {...incrementalContract.profile, enabledCaseIds: [...contract.rows.map((row) => row.caseId).slice(0, contract.candidate.approvedCaseIds.length)]}};
  try {
    validateExecutionProfile(wrongActiveSet.profile, contract.rows, contract.candidate);
    throw new L2FixtureFailure('L2_SELF_TEST_ACTIVE_EXACT_SET_MUTATION_DID_NOT_FAIL');
  } catch (error) {
    if (!(error instanceof L2FixtureFailure) || error.code !== 'L2_EXECUTION_PROFILE_ACTIVE_CASE_EXACT_SET_INVALID') throw error;
  }
  const seedMutation = syntheticFixture(incrementalContract.activeRows);
  seedMutation.seedRuntimeInput = true;
  try {
    validateOwnerFixture(seedMutation, incrementalContract);
    throw new L2FixtureFailure('L2_SELF_TEST_SEED_MUTATION_DID_NOT_FAIL');
  } catch (error) {
    if (!(error instanceof L2FixtureFailure) || error.code !== 'L2_OWNER_FIXTURE_SEED_RUNTIME_INPUT_NOT_FALSE') throw error;
  }
  const targetFactMutation = syntheticFixture(incrementalContract.activeRows);
  delete targetFactMutation.cases[incrementalContract.activeRows[0].caseId].expectedReadback.facts.item.version;
  try {
    validateOwnerFixture(targetFactMutation, incrementalContract, {allowSynthetic: true});
    throw new L2FixtureFailure('L2_SELF_TEST_TARGET_FACT_MUTATION_DID_NOT_FAIL');
  } catch (error) {
    if (!(error instanceof L2FixtureFailure) || error.code !== 'L2_OWNER_FIXTURE_TARGET_FACT_PATH_VALUE_MISSING') throw error;
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

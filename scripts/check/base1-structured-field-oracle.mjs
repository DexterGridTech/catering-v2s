#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const registryPath = path.join(root, 'contracts/policy/base1-structured-field-oracle-registry.json');
const routeRegistryPaths = [
  path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json'),
  path.join(
    root,
    'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json',
  ),
];
const acceptanceSourceDirectory = path.join(
  root,
  'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance',
);
const EXPECTED_SIGNAL = 'HTTP=200;CONTRACT=PASS;BUSINESS=FAIL;failureCategory=BUSINESS_ORACLE';
const INVITATION_NODE_TYPES = Object.freeze(['Group', 'Region', 'Project', 'HeadCompany', 'Store']);
const invitationRouteOperations = Object.freeze([
  'getWorkspaceInvitations',
  'createWorkspaceInvitation',
  'getWorkspaceInvitation',
  'cancelWorkspaceInvitation',
  'reissueWorkspaceInvitation',
  ...INVITATION_NODE_TYPES.flatMap(nodeType => [
    `getOperationsWorkspace${nodeType}Invitations`,
    `createOperationsWorkspace${nodeType}Invitation`,
    `cancelOperationsWorkspace${nodeType}Invitation`,
    `reissueOperationsWorkspace${nodeType}Invitation`,
  ]),
]);
const invitationCandidateOperations = Object.freeze([
  'getWorkspaceInvitationCandidates',
  ...INVITATION_NODE_TYPES.map(nodeType => `getOperationsWorkspace${nodeType}InvitationCandidates`),
]);
const accountOrganizationOperations = Object.freeze([
  'getWorkspaceAccounts',
  'getWorkspaceAccount',
  'transitionWorkspaceAccountStatus',
  ...INVITATION_NODE_TYPES.flatMap(nodeType => [
    `getOperationsWorkspace${nodeType}User`,
    `getOperationsWorkspace${nodeType}UserAccount`,
    `revokeOperationsWorkspace${nodeType}UserAssignment`,
  ]),
]);
const EXPECTED_OPERATION_SETS = Object.freeze({
  businessChannel: Object.freeze([
    'getOperationsProjectBusinessChannels',
    'getOperationsStoreBusinessChannels',
    'createOperationsBusinessChannel',
    'getOperationsBusinessChannelDetail',
    'updateOperationsBusinessChannel',
    'transitionOperationsBusinessChannelStatus',
  ]),
  accountPresence: Object.freeze(['verifyPublicInvitationOtp', 'savePublicInvitationCredentials']),
  contract: Object.freeze(['getPlatformContractOverviewPage', 'getPlatformContractOverviewDetail']),
  invitationRoute: invitationRouteOperations,
  invitationCandidate: invitationCandidateOperations,
  accountOrganization: accountOrganizationOperations,
  extensionDefinition: Object.freeze([
    'getExtensionDefinition',
    'replaceExtensionDefinition',
    'getOperationsContractExtensionDefinition',
    'getOperationsOrganizationBusinessEntityExtensionDefinition',
    'getOperationsOrganizationHierarchyExtensionDefinition',
    'getOperationsOrganizationStoreExtensionDefinition',
  ]),
  collaborationBinding: Object.freeze([
    'getPlatformProviderProfileBindings',
    'getPlatformOwnerBindingDetail',
    'updatePlatformOwnerBinding',
    'deletePlatformOwnerBinding',
    'createPlatformOwnerBinding',
    'getOperationsOwnerBindingDetail',
    'createOperationsOwnerBinding',
    'deleteOperationsOwnerBinding',
  ]),
  collaborationCatalog: Object.freeze([
    'getPlatformExternalCollaborationTree',
    'getPlatformExternalSystemDetail',
    'getPlatformProviderProfileDetail',
    'getPlatformExternalCapabilityDictionary',
    'getOperationsExternalCapabilityDictionary',
    'getOperationsExternalProviderCandidates',
  ]),
  catalog: Object.freeze([
    'getOperationsCatalogNavigation',
    'getOperationsCatalogItems',
    'getOperationsCatalogItem',
    'getOperationsCatalogItemSkus',
    'createOperationsCatalogCategory',
    'updateOperationsCatalogCategory',
    'moveOperationsCatalogCategory',
    'transitionOperationsCatalogCategoryStatus',
    'getOperationsInventoryTargets',
    'getOperationsInventoryTarget',
    'countOperationsInventoryTarget',
    'increaseOperationsInventoryTarget',
    'adjustOperationsInventoryTarget',
    'updateOperationsInventoryTargetConfiguration',
  ]),
});
const POINTER_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);
const COMPARISONS = new Set(['EXACT_VALUE', 'EXACT_NULL', 'DEEP_ORDERED', 'EXACT_SET_CARDINALITY']);
const EXPECTED_SUPPORTING_OPERATION_IDS = Object.freeze(['getPublicInvitationView']);
const ACCOUNT_ORGANIZATION_POINTERS = Object.freeze({
  getWorkspaceAccounts: '/items/0/assignments/0/organizationPathNodes',
  getWorkspaceAccount: '/assignments/0/organizationPathNodes',
  transitionWorkspaceAccountStatus: '/assignments/0/organizationPathNodes',
  ...Object.fromEntries(
    INVITATION_NODE_TYPES.flatMap(nodeType => [
      [`getOperationsWorkspace${nodeType}User`, '/items/0/assignments/0/organizationPathNodes'],
      [`getOperationsWorkspace${nodeType}UserAccount`, '/assignments/0/organizationPathNodes'],
      [`revokeOperationsWorkspace${nodeType}UserAssignment`, '/user/assignments/0/organizationPathNodes'],
    ]),
  ),
});
const STRUCTURED_POINTER_REQUIREMENTS = Object.freeze({
  invitationRoute: ({operationId}) => {
    const base =
      operationId === 'getWorkspaceInvitations' || operationId.startsWith('getOperationsWorkspace') ? '/items/0' : '';
    return [`${base}/targetOrganizationPathNodes`, `${base}/invitationRouteFacts`];
  },
  invitationCandidate: () => ['/organizations/0/pathNodes'],
  accountOrganization: entry => [
    ACCOUNT_ORGANIZATION_POINTERS[entry.operationId] ?? '__missing_account_path_pointer__',
  ],
});

function fail(code, detail = '') {
  throw new Error(`${code}${detail ? `:${detail}` : ''}`);
}

function expect(value, code, detail = '') {
  if (!value) fail(code, detail);
}

function object(value, code, detail = '') {
  expect(value !== null && typeof value === 'object' && !Array.isArray(value), code, detail);
  return value;
}

function nonEmpty(value, code, detail = '') {
  expect(typeof value === 'string' && value.trim().length > 0, code, detail);
}

function sameSet(actual, expected, code) {
  expect(Array.isArray(actual), code, 'not-array');
  expect(actual.length === expected.length, code, `${actual.length}!=${expected.length}`);
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  expect(actualSet.size === actual.length, code, 'duplicate');
  expect(expectedSet.size === expected.length, code, 'expected-duplicate');
  expect(
    expected.every(value => actualSet.has(value)),
    code,
    `missing=${expected.filter(value => !actualSet.has(value))}`,
  );
}

function acceptanceSourcePaths() {
  return fs
    .readdirSync(acceptanceSourceDirectory)
    .filter(name => name.endsWith('AcceptanceScenarios.java'))
    .map(name => path.join(acceptanceSourceDirectory, name));
}

function sourceHasOperationOracle(source, operationId) {
  const operationLiteral = new RegExp(`"${escapeRegExp(operationId)}"`, 'g');
  const oracleCall = /(?:oracle[A-Za-z0-9_]*|assert[A-Za-z0-9_]*(?:Oracle|Facts|Definition|Json|MutationResult))\s*\(/;
  let match;
  while ((match = operationLiteral.exec(source)) !== null) {
    const start = Math.max(0, match.index - 1800);
    const end = Math.min(source.length, match.index + match[0].length + 1800);
    if (oracleCall.test(source.slice(start, end))) return true;
  }
  return false;
}

function directSourceOraclePairs(source) {
  const pairs = new Set();
  const directOracleCall = /\b(?:oracle|oracleEquals)\s*\(\s*[\s\S]{0,700}?"([^"\n]+)"\s*,\s*"(\/[^"\n]+)"\s*,/g;
  let match;
  while ((match = directOracleCall.exec(source)) !== null) pairs.add(`${match[1]}\0${match[2]}`);
  return pairs;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateProductionMutationAnchor(anchor, code, operationId, readFile) {
  const resolvedFile = path.resolve(root, anchor.file);
  const relativeFile = path.relative(root, resolvedFile);
  expect(
    relativeFile && !relativeFile.startsWith('..') && !path.isAbsolute(relativeFile),
    `${code}_FILE_OUTSIDE_REPOSITORY`,
    `${operationId}:${anchor.file}`,
  );
  expect(fs.existsSync(resolvedFile), `${code}_FILE_NOT_FOUND`, `${operationId}:${anchor.file}`);

  let source;
  try {
    source = String(readFile(resolvedFile, 'utf8'));
  } catch {
    fail(`${code}_FILE_UNREADABLE`, `${operationId}:${anchor.file}`);
  }

  const symbols = String(anchor.symbol)
    .split('|')
    .map(value => value.trim())
    .filter(Boolean);
  expect(symbols.length > 0, `${code}_SYMBOL_NOT_FOUND`, `${operationId}:${anchor.symbol}`);
  const symbolFound = symbols.some(symbol => {
    const terminal = symbol.split('.').at(-1);
    return terminal && new RegExp(`\\b${escapeRegExp(terminal)}\\b`).test(source);
  });
  expect(symbolFound, `${code}_SYMBOL_NOT_FOUND`, `${operationId}:${anchor.file}:${anchor.symbol}`);
}

function validateAcceptanceOracleSource(registry, readFile) {
  const sources = acceptanceSourcePaths().map(file => ({file, source: String(readFile(file, 'utf8'))}));
  const acceptanceScenarioIds = new Set(
    sources.flatMap(({source}) =>
      [...source.matchAll(/@AcceptanceScenario\(\s*[^)]*?\bid\s*=\s*"([^"]+)"/gs)].map(match => match[1]),
    ),
  );
  const coveredSources = sources.filter(({source}) => /json\.at\s*\(/.test(source));
  expect(coveredSources.length > 0, 'BASE1_ORACLE_SOURCE_JSON_AT_REQUIRED');
  const combined = sources.map(({source}) => source).join('\n');
  expect(/getNodeType\s*\(\)|isMissingNode\s*\(\)|isNull\s*\(\)/.test(combined), 'BASE1_ORACLE_SOURCE_TYPE_CHECK_REQUIRED');
  expect(/assertEquals\s*\(/.test(combined), 'BASE1_ORACLE_SOURCE_EXACT_COMPARISON_REQUIRED');

  const entries = [...registry.operations, ...registry.supportingOperations];
  for (const entry of entries) {
    expect(
      acceptanceScenarioIds.has(entry.scenarioId),
      'BASE1_ORACLE_SCENARIO_NOT_FOUND',
      `${entry.operationId}:${entry.scenarioId}`,
    );
    const operationSources = sources.filter(({source}) => sourceHasOperationOracle(source, entry.operationId));
    expect(operationSources.length > 0, 'BASE1_ORACLE_SOURCE_OPERATION_ORACLE_MISSING', entry.operationId);
    for (const pointer of entry.pointers) {
      const pointerLiteral = `"${pointer.jsonPointer}"`;
      const pointerSources = operationSources.filter(({source}) => source.includes(pointerLiteral));
      expect(
        pointerSources.length > 0,
        'BASE1_ORACLE_SOURCE_POINTER_ORACLE_MISSING',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
      expect(
        pointerSources.some(({source}) => /json\.at\s*\(/.test(source)),
        'BASE1_ORACLE_SOURCE_POINTER_NOT_BOUND_TO_JSON_AT',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
    }
  }
  const registeredPointerKeys = new Set(
    entries.flatMap(entry => entry.pointers.map(pointer => `${entry.operationId}\0${pointer.jsonPointer}`)),
  );
  for (const {file, source} of sources) {
    for (const key of directSourceOraclePairs(source)) {
      expect(registeredPointerKeys.has(key), 'BASE1_ORACLE_SOURCE_POINTER_NOT_REGISTERED', `${file}:${key}`);
    }
  }
  return sources;
}

function validate({readFile = fs.readFileSync, runRedMutation = true} = {}) {
  const registry = JSON.parse(readFile(registryPath, 'utf8'));
  const routes = routeRegistryPaths.flatMap(routeRegistryPath => {
    const parsed = JSON.parse(readFile(routeRegistryPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.operations;
  });
  object(registry, 'BASE1_ORACLE_REGISTRY_ROOT');
  expect(registry.schemaVersion === 1, 'BASE1_ORACLE_REGISTRY_SCHEMA_VERSION');
  expect(registry.kind === 'base1-structured-field-oracle-registry', 'BASE1_ORACLE_REGISTRY_KIND');
  expect(registry.scope === 'CP-B4', 'BASE1_ORACLE_REGISTRY_SCOPE');
  object(registry.operationSets, 'BASE1_ORACLE_OPERATION_SETS');
  for (const [name, expected] of Object.entries(EXPECTED_OPERATION_SETS)) {
    sameSet(registry.operationSets[name], expected, 'BASE1_ORACLE_OPERATION_SET_DRIFT');
  }
  expect(Array.isArray(registry.excludedOperationIds), 'BASE1_ORACLE_EXCLUSIONS');
  expect(registry.excludedOperationIds.length === 1, 'BASE1_ORACLE_EXCLUSION_COUNT');
  expect(registry.excludedOperationIds[0] === 'getExtensionEntityCatalog', 'BASE1_ORACLE_EXCLUSION_WRONG');
  expect(registry.expectedSignal === EXPECTED_SIGNAL, 'BASE1_ORACLE_EXPECTED_SIGNAL');
  expect(Array.isArray(registry.operations) && registry.operations.length > 0, 'BASE1_ORACLE_OPERATIONS');

  const expectedIds = Object.values(EXPECTED_OPERATION_SETS).flat();
  expect(new Set(expectedIds).size === expectedIds.length, 'BASE1_ORACLE_EXPECTED_OPERATION_DUPLICATE');
  const actualIds = registry.operations.map(entry => entry?.operationId);
  sameSet(actualIds, expectedIds, 'BASE1_ORACLE_OPERATION_DENOMINATOR_DRIFT');
  expect(Array.isArray(routes), 'BASE1_ORACLE_ROUTE_REGISTRY_SHAPE');
  const routeIds = new Set(routes.map(entry => entry?.operationId));
  for (const operationId of actualIds)
    expect(routeIds.has(operationId), 'BASE1_ORACLE_OPERATION_NOT_GENERATED', operationId);
  expect(!actualIds.includes('getExtensionEntityCatalog'), 'BASE1_ORACLE_EXCLUDED_OPERATION_PRESENT');
  const supportingOperations = registry.supportingOperations;
  expect(Array.isArray(supportingOperations), 'BASE1_ORACLE_SUPPORTING_OPERATIONS');
  sameSet(
    supportingOperations.map(entry => entry?.operationId),
    EXPECTED_SUPPORTING_OPERATION_IDS,
    'BASE1_ORACLE_SUPPORTING_OPERATION_DENOMINATOR_DRIFT',
  );
  for (const entry of supportingOperations) {
    object(entry, 'BASE1_ORACLE_SUPPORTING_OPERATION_ENTRY');
    nonEmpty(entry.family, 'BASE1_ORACLE_SUPPORTING_FAMILY', entry.operationId);
    nonEmpty(entry.scenarioId, 'BASE1_ORACLE_SUPPORTING_SCENARIO', entry.operationId);
    nonEmpty(entry.operationId, 'BASE1_ORACLE_SUPPORTING_OPERATION_ID');
    expect(!actualIds.includes(entry.operationId), 'BASE1_ORACLE_SUPPORTING_COUNTED_OPERATION', entry.operationId);
    expect(routeIds.has(entry.operationId), 'BASE1_ORACLE_SUPPORTING_OPERATION_NOT_GENERATED', entry.operationId);
    object(entry.productionMutationAnchor, 'BASE1_ORACLE_SUPPORTING_MUTATION_ANCHOR', entry.operationId);
    nonEmpty(entry.productionMutationAnchor.file, 'BASE1_ORACLE_SUPPORTING_MUTATION_FILE', entry.operationId);
    nonEmpty(entry.productionMutationAnchor.symbol, 'BASE1_ORACLE_SUPPORTING_MUTATION_SYMBOL', entry.operationId);
    nonEmpty(
      entry.productionMutationAnchor.mutation,
      'BASE1_ORACLE_SUPPORTING_MUTATION_DESCRIPTION',
      entry.operationId,
    );
    validateProductionMutationAnchor(
      entry.productionMutationAnchor,
      'BASE1_ORACLE_SUPPORTING_MUTATION_ANCHOR',
      entry.operationId,
      readFile,
    );
    expect(
      (entry.expectedSignal ?? registry.expectedSignal) === EXPECTED_SIGNAL,
      'BASE1_ORACLE_SUPPORTING_ENTRY_SIGNAL',
      entry.operationId,
    );
    expect(
      Array.isArray(entry.pointers) && entry.pointers.length > 0,
      'BASE1_ORACLE_SUPPORTING_POINTERS',
      entry.operationId,
    );
    const pointerKeys = new Set();
    for (const pointer of entry.pointers) {
      object(pointer, 'BASE1_ORACLE_SUPPORTING_POINTER_ENTRY', entry.operationId);
      nonEmpty(pointer.jsonPointer, 'BASE1_ORACLE_SUPPORTING_JSON_POINTER', entry.operationId);
      expect(
        pointer.jsonPointer.startsWith('/'),
        'BASE1_ORACLE_SUPPORTING_JSON_POINTER_ABSOLUTE',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
      expect(
        !pointerKeys.has(pointer.jsonPointer),
        'BASE1_ORACLE_SUPPORTING_POINTER_DUPLICATE',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
      pointerKeys.add(pointer.jsonPointer);
      expect(
        POINTER_TYPES.has(pointer.jsonType),
        'BASE1_ORACLE_SUPPORTING_JSON_TYPE',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
      expect(
        COMPARISONS.has(pointer.comparison),
        'BASE1_ORACLE_SUPPORTING_COMPARISON',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
      expect(
        Object.hasOwn(pointer, 'fixtureExpected'),
        'BASE1_ORACLE_SUPPORTING_FIXTURE_EXPECTED',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
      nonEmpty(
        pointer.nullableOrEmptyCounterexample,
        'BASE1_ORACLE_SUPPORTING_COUNTEREXAMPLE',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
    }
    expect(
      pointerKeys.has('/targetOrganizationPathNodes'),
      'BASE1_ORACLE_SUPPORTING_STRUCTURED_POINTER_MISSING',
      `${entry.operationId}:/targetOrganizationPathNodes`,
    );
  }

  let pointerCount = 0;
  const nullableKinds = new Set();
  for (const entry of registry.operations) {
    object(entry, 'BASE1_ORACLE_OPERATION_ENTRY');
    nonEmpty(entry.family, 'BASE1_ORACLE_FAMILY', entry.operationId);
    nonEmpty(entry.scenarioId, 'BASE1_ORACLE_SCENARIO', entry.operationId);
    nonEmpty(entry.operationId, 'BASE1_ORACLE_OPERATION_ID');
    object(entry.productionMutationAnchor, 'BASE1_ORACLE_MUTATION_ANCHOR', entry.operationId);
    nonEmpty(entry.productionMutationAnchor.file, 'BASE1_ORACLE_MUTATION_FILE', entry.operationId);
    nonEmpty(entry.productionMutationAnchor.symbol, 'BASE1_ORACLE_MUTATION_SYMBOL', entry.operationId);
    nonEmpty(entry.productionMutationAnchor.mutation, 'BASE1_ORACLE_MUTATION_DESCRIPTION', entry.operationId);
    validateProductionMutationAnchor(
      entry.productionMutationAnchor,
      'BASE1_ORACLE_MUTATION_ANCHOR',
      entry.operationId,
      readFile,
    );
    expect(
      (entry.expectedSignal ?? registry.expectedSignal) === EXPECTED_SIGNAL,
      'BASE1_ORACLE_ENTRY_SIGNAL',
      entry.operationId,
    );
    expect(Array.isArray(entry.pointers) && entry.pointers.length > 0, 'BASE1_ORACLE_POINTERS', entry.operationId);
    const pointerKeys = new Set();
    for (const pointer of entry.pointers) {
      pointerCount += 1;
      object(pointer, 'BASE1_ORACLE_POINTER_ENTRY', entry.operationId);
      nonEmpty(pointer.jsonPointer, 'BASE1_ORACLE_JSON_POINTER', entry.operationId);
      expect(
        pointer.jsonPointer.startsWith('/'),
        'BASE1_ORACLE_JSON_POINTER_ABSOLUTE',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
      expect(
        !pointerKeys.has(pointer.jsonPointer),
        'BASE1_ORACLE_POINTER_DUPLICATE',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
      pointerKeys.add(pointer.jsonPointer);
      expect(
        POINTER_TYPES.has(pointer.jsonType),
        'BASE1_ORACLE_JSON_TYPE',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
      expect(
        COMPARISONS.has(pointer.comparison),
        'BASE1_ORACLE_COMPARISON',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
      expect(
        Object.hasOwn(pointer, 'fixtureExpected'),
        'BASE1_ORACLE_FIXTURE_EXPECTED',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
      nonEmpty(
        pointer.nullableOrEmptyCounterexample,
        'BASE1_ORACLE_COUNTEREXAMPLE',
        `${entry.operationId}:${pointer.jsonPointer}`,
      );
      if (pointer.jsonPointer.endsWith('capabilityClass')) nullableKinds.add(pointer.jsonType);
    }
    const requiredStructuredPointers = STRUCTURED_POINTER_REQUIREMENTS[entry.family]?.(entry) ?? [];
    if (Object.hasOwn(STRUCTURED_POINTER_REQUIREMENTS, entry.family)) {
      expect(
        requiredStructuredPointers.length > 0,
        'BASE1_ORACLE_STRUCTURED_POINTER_REQUIREMENTS_EMPTY',
        entry.operationId,
      );
    }
    for (const requiredPointer of requiredStructuredPointers) {
      expect(
        pointerKeys.has(requiredPointer),
        'BASE1_ORACLE_STRUCTURED_POINTER_MISSING',
        `${entry.operationId}:${requiredPointer}`,
      );
    }
  }
  expect(nullableKinds.has('string') && nullableKinds.has('null'), 'BASE1_ORACLE_NULLABLE_FIXTURES');
  const sources = validateAcceptanceOracleSource(registry, readFile);
  if (runRedMutation) {
    const registeredPointerKeys = new Set(
      [...registry.operations, ...registry.supportingOperations].flatMap(entry =>
        entry.pointers.map(pointer => `${entry.operationId}\0${pointer.jsonPointer}`),
      ),
    );
    const redRegistryTarget = [...sources]
      .flatMap(({source}) => [...directSourceOraclePairs(source)])
      .find(key => registeredPointerKeys.has(key));
    expect(redRegistryTarget, 'BASE1_ORACLE_REGISTRY_RED_MUTATION_TARGET_MISSING');
    let registryRejected = false;
    try {
      validate({
        readFile(file, encoding) {
          const source = String(readFile(file, encoding));
          if (file !== registryPath) return source;
          const mutated = JSON.parse(source);
          const [operationId, jsonPointer] = redRegistryTarget.split('\0');
          const entry = mutated.operations.find(item => item.operationId === operationId);
          entry.pointers = entry.pointers.filter(pointer => pointer.jsonPointer !== jsonPointer);
          return JSON.stringify(mutated);
        },
        runRedMutation: false,
      });
    } catch {
      registryRejected = true;
    }
    expect(registryRejected, 'BASE1_ORACLE_REGISTRY_REVERSE_RED_MUTATION_NOT_REJECTED');
    const mutationTarget = sources.find(({source}) => /json\.at\s*\(/.test(source));
    expect(mutationTarget, 'BASE1_ORACLE_RED_MUTATION_TARGET_MISSING');
    let rejected = false;
    try {
      validate({
        readFile(file, encoding) {
          const source = String(readFile(file, encoding));
          if (file === mutationTarget.file) return source.replaceAll('json.at(', 'json.path(');
          return source;
        },
        runRedMutation: false,
      });
    } catch {
      rejected = true;
    }
    expect(rejected, 'BASE1_ORACLE_SOURCE_RED_MUTATION_NOT_REJECTED');
    console.log('BASE1_STRUCTURED_FIELD_ORACLE_STATIC_RED_MUTATION=PASS');
  }
  console.log(`BASE1_STRUCTURED_FIELD_ORACLE_REGISTRY=PASS OPERATIONS=${actualIds.length} POINTERS=${pointerCount}`);
  return {operations: actualIds.length, pointers: pointerCount};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    validate();
  } catch (error) {
    process.stderr.write(`BASE1_STRUCTURED_FIELD_ORACLE_REGISTRY=FAIL\nREASON=${error.message}\n`);
    process.exit(1);
  }
}

export {validate};

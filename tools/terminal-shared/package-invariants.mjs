import fs from 'node:fs';
import path from 'node:path';

export const INVARIANT_SCHEMA_VERSION = 1;

function invariantPath(packageRoot) {
  return path.join(packageRoot, 'terminal-invariants.json');
}

function fail(message) {
  throw new Error(`TERMINAL_INVARIANT_FAILURE:${message}`);
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    fail(`${label} must be a string array`);
  }
  if (new Set(value).size !== value.length) fail(`${label} must not contain duplicates`);
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) fail(`${label} must be a non-negative integer`);
}

function validateOwned(owned, packageName) {
  if (!owned || typeof owned !== 'object' || Array.isArray(owned)) fail(`${packageName}.owned must be an object`);
  for (const task of ['test', 'lint', 'clean']) {
    const value = owned[task];
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${packageName}.owned.${task} must be an object`);
    if (!['ABSENT', 'REAL_TESTS', 'NO_TEST_FILES', 'OWNED'].includes(value.kind)) {
      fail(`${packageName}.owned.${task}.kind is invalid`);
    }
    if (value.kind === 'ABSENT') {
      if (value.runner !== undefined || value.owner !== undefined) fail(`${packageName}.owned.${task} ABSENT must not carry runner/owner`);
      continue;
    }
    assertString(value.owner, `${packageName}.owned.${task}.owner`);
    if (value.owner !== packageName) fail(`${packageName}.owned.${task}.owner must equal package`);
    if (value.runner !== undefined) assertString(value.runner, `${packageName}.owned.${task}.runner`);
  }
}

function validateInvariant(invariant, packageRoot, expectedPackageName) {
  if (!invariant || typeof invariant !== 'object' || Array.isArray(invariant)) fail('invariant must be an object');
  if (invariant.schemaVersion !== INVARIANT_SCHEMA_VERSION) {
    fail(`${expectedPackageName ?? invariant.package ?? '<unknown>'} schemaVersion must be ${INVARIANT_SCHEMA_VERSION}`);
  }
  assertString(invariant.package, 'invariant.package');
  if (expectedPackageName !== undefined && invariant.package !== expectedPackageName) {
    fail(`package mismatch expected=${expectedPackageName} actual=${invariant.package}`);
  }
  validateOwned(invariant.owned, invariant.package);
  for (const field of ['publicExports', 'moduleContextMembers', 'actorContextMembers', 'internalCommands', 'internalCommandDefinitions', 'portKeys', 'platformPortsKeys', 'platformPortsOptionalKeys']) {
    if (invariant[field] !== undefined) assertStringArray(invariant[field], `${invariant.package}.${field}`);
  }
  if (invariant.ledgerRecordShape !== undefined) {
    if (!invariant.ledgerRecordShape || typeof invariant.ledgerRecordShape !== 'object' || Array.isArray(invariant.ledgerRecordShape)) {
      fail(`${invariant.package}.ledgerRecordShape must be an object`);
    }
    for (const [key, values] of Object.entries(invariant.ledgerRecordShape)) assertStringArray(values, `${invariant.package}.ledgerRecordShape.${key}`);
  }
  if (invariant.portMethods !== undefined) {
    if (!invariant.portMethods || typeof invariant.portMethods !== 'object' || Array.isArray(invariant.portMethods)) {
      fail(`${invariant.package}.portMethods must be an object`);
    }
    for (const [key, values] of Object.entries(invariant.portMethods)) assertStringArray(values, `${invariant.package}.portMethods.${key}`);
  }
  if (invariant.runtimeIdPrefixes !== undefined) {
    if (!invariant.runtimeIdPrefixes || typeof invariant.runtimeIdPrefixes !== 'object' || Array.isArray(invariant.runtimeIdPrefixes)) {
      fail(`${invariant.package}.runtimeIdPrefixes must be an object`);
    }
    const keys = Object.keys(invariant.runtimeIdPrefixes);
    assertStringArray(keys, `${invariant.package}.runtimeIdPrefixes.keys`);
    for (const [key, value] of Object.entries(invariant.runtimeIdPrefixes)) assertString(value, `${invariant.package}.runtimeIdPrefixes.${key}`);
  }
  if (invariant.literalUnions !== undefined) {
    if (!invariant.literalUnions || typeof invariant.literalUnions !== 'object' || Array.isArray(invariant.literalUnions)) {
      fail(`${invariant.package}.literalUnions must be an object`);
    }
    for (const [key, values] of Object.entries(invariant.literalUnions)) assertStringArray(values, `${invariant.package}.literalUnions.${key}`);
  }
  if (invariant.closedUnionDefinitions !== undefined) {
    if (!invariant.closedUnionDefinitions || typeof invariant.closedUnionDefinitions !== 'object' || Array.isArray(invariant.closedUnionDefinitions)) {
      fail(`${invariant.package}.closedUnionDefinitions must be an object`);
    }
    for (const [key, values] of Object.entries(invariant.closedUnionDefinitions)) {
      assertString(key, `${invariant.package}.closedUnionDefinitions key`);
      assertStringArray(values, `${invariant.package}.closedUnionDefinitions.${key}`);
    }
  }
  if (invariant.closedUnionConsumerCount !== undefined) {
    assertNonNegativeInteger(invariant.closedUnionConsumerCount, `${invariant.package}.closedUnionConsumerCount`);
  }
  if (invariant.tr01Exceptions !== undefined) {
    if (!Array.isArray(invariant.tr01Exceptions)) fail(`${invariant.package}.tr01Exceptions must be an array`);
    const exceptionKeys = new Set();
    for (const [index, item] of invariant.tr01Exceptions.entries()) {
      if (!item || typeof item !== 'object') fail(`${invariant.package}.tr01Exceptions[${index}] must be an object`);
      for (const field of ['sourceFile', 'declarationId', 'dispatchExpression', 'reasonCategory']) assertString(item[field], `${invariant.package}.tr01Exceptions[${index}].${field}`);
      const key = [item.sourceFile, item.declarationId, item.dispatchExpression, item.reasonCategory].join('\u0000');
      if (exceptionKeys.has(key)) fail(`${invariant.package}.tr01Exceptions[${index}] duplicates a previous exception`);
      exceptionKeys.add(key);
    }
  }
  if (invariant.closedUnionConsumers !== undefined) {
    if (!Array.isArray(invariant.closedUnionConsumers)) fail(`${invariant.package}.closedUnionConsumers must be an array`);
    for (const [index, item] of invariant.closedUnionConsumers.entries()) {
      if (!item || typeof item !== 'object') fail(`${invariant.package}.closedUnionConsumers[${index}] must be an object`);
      for (const field of ['union', 'unionPackage', 'expectedSymbol', 'sourceFile', 'declarationId', 'member']) assertString(item[field], `${invariant.package}.closedUnionConsumers[${index}].${field}`);
    }
  }
  void packageRoot;
  return invariant;
}

export function readPackageInvariant(packageRoot, expectedPackageName) {
  const filePath = invariantPath(packageRoot);
  if (!fs.existsSync(filePath)) fail(`missing ${path.relative(process.cwd(), filePath)}`);
  let invariant;
  try {
    invariant = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`invalid JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return validateInvariant(invariant, packageRoot, expectedPackageName);
}

export function assertExactList(label, actualValues, expectedValues) {
  const actual = [...actualValues].sort();
  const expected = [...expectedValues].sort();
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter(value => !actualSet.has(value));
  const extra = actual.filter(value => !expectedSet.has(value));
  if (missing.length || extra.length || actual.length !== actualSet.size) {
    throw new Error(`${label} mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`);
  }
}

export function assertExactMap(label, actual, expected) {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  assertExactList(`${label} keys`, actualKeys, expectedKeys);
  for (const key of expectedKeys) assertExactList(`${label}.${key}`, actual[key], expected[key]);
}

export function readAllPackageInvariants(packageRoots) {
  return packageRoots.map(({packageRoot, packageName}) => readPackageInvariant(packageRoot, packageName));
}

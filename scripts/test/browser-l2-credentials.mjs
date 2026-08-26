#!/usr/bin/env node

import {createHash, randomBytes} from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {resolveTrustedRemoteHost} from '../dev/r5-remote-host-trust.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');

export const DEFAULT_RUNTIME_ROOT = path.join(repositoryRoot, '.runtime/browser-l2');
export const RUN_DIRECTORY_MODE = 0o700;
export const PRIVATE_FILE_MODE = 0o600;
export const DEFAULT_TTL_MILLIS = 30 * 60 * 1000;

export const SECRET_FAILURE_CODES = Object.freeze([
  'L2_SECRET_FILE_REQUIRED',
  'L2_SECRET_FILE_MODE_INVALID',
  'L2_SECRET_REQUIRED_MISSING',
  'L2_SECRET_ALLOWLIST_MISMATCH',
  'L2_SECRET_FORMAT_INVALID',
  'L2_SECRET_STALE',
  'L2_SECRET_RUN_BINDING_MISMATCH',
  'L2_SECRET_NAMESPACE_BINDING_MISMATCH',
  'L2_SECRET_LEAK_DETECTED',
]);

const freezeList = values => Object.freeze([...values]);

export const SECRET_CLASS_KEYS = Object.freeze({
  // Host identity is validated through the managed allowlist and never copied
  // into a child secret environment.
  remoteHostAccess: freezeList([]),
  databaseAppRole: freezeList(['CATERING_BUSINESS_DB_USERNAME', 'CATERING_BUSINESS_DB_PASSWORD']),
  assetStorage: freezeList(['CATERING_ASSET_S3_ACCESS_KEY', 'CATERING_ASSET_S3_SECRET_KEY']),
  appHmacDiagnostic: freezeList([
    'CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET',
    'CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET',
    'V2S_DB_OPERATIONS_HMAC_KEY',
    'V2S_L2_DIAGNOSTIC_SECRET',
  ]),
  testLoginOtp: freezeList([
    'V2S_L2_PLATFORM_LOGIN',
    'V2S_L2_PLATFORM_PASSWORD',
    'V2S_L2_OPERATIONS_LOGIN',
    'V2S_L2_OPERATIONS_PASSWORD',
    'V2S_L2_HEAD_OPERATIONS_LOGIN',
    'V2S_L2_HEAD_OPERATIONS_PASSWORD',
    'V2S_L2_TEST_OTP',
  ]),
  // Browser session material is kept in the two run-private 0600 files, not
  // in credentials.env or public metadata.
  browserSession: freezeList([]),
});

const knownSecretKeys = Object.freeze(Object.values(SECRET_CLASS_KEYS).flat().sort());
export const DEFAULT_SECRET_KEYS = freezeList(knownSecretKeys);

/**
 * A child receives only the smallest secret subset it needs. Host access is
 * deliberately absent: SSH identity/keychain material remains with the
 * managed tunnel owner and is represented here only by binding metadata.
 */
export const CHILD_PROCESS_ENV_ALLOWLISTS = Object.freeze({
  namespaceProvision: freezeList([...SECRET_CLASS_KEYS.databaseAppRole, ...SECRET_CLASS_KEYS.assetStorage].sort()),
  assetProvision: freezeList(SECRET_CLASS_KEYS.assetStorage),
  springBoot: freezeList(
    [
      ...SECRET_CLASS_KEYS.databaseAppRole,
      ...SECRET_CLASS_KEYS.assetStorage,
      ...SECRET_CLASS_KEYS.appHmacDiagnostic,
    ].sort(),
  ),
  fixtureSetup: freezeList(SECRET_CLASS_KEYS.testLoginOtp),
  platformPlaywright: freezeList([]),
  // The operations L2 spec performs a real password login in each case.  It
  // receives only the two explicitly declared run-scoped actors it needs. The
  // store actor drives the primary Journey; the head-company actor is used
  // only to mutate a head-company copy source in a separate browser context.
  // Platform credentials, asset keys and database role stay outside the
  // browser child environment.
  operationsPlaywright: freezeList([
    'V2S_L2_OPERATIONS_LOGIN',
    'V2S_L2_OPERATIONS_PASSWORD',
    'V2S_L2_HEAD_OPERATIONS_LOGIN',
    'V2S_L2_HEAD_OPERATIONS_PASSWORD',
    'V2S_L2_DIAGNOSTIC_SECRET',
  ]),
});

const SESSION_FILENAMES = new Set(['platform-storage-state.json', 'operations-storage-state.json']);

const SAFE_ARTIFACT_KEYS = new Set([
  'allowedKeys',
  'assetPrefix',
  'binding',
  'bindingMetadata',
  'createdAtEpochMillis',
  'credentialBindingPath',
  'credentialsFile',
  'credentialsMode',
  'credentialsPath',
  'databaseNamespace',
  'expiresAtEpochMillis',
  'files',
  'hostAllowlistVersion',
  'hostFingerprint',
  'keySetDigest',
  'kind',
  'mode',
  'operationsStorageStatePath',
  'platformStorageStatePath',
  'runDirectory',
  'runId',
  'schemaVersion',
  'operationsSessionPath',
  'platformSessionPath',
  'sessionFile',
  'sessionPath',
  'storageStatePaths',
  // Managed process start tokens prove ownership of the process tree. They
  // are control metadata, not credential material, and must remain visible in
  // run manifests for cleanup and identity verification.
  'startToken',
]);

const SENSITIVE_ARTIFACT_KEY =
  /(?:password|secret|otp|token|cookie|authorization|signed.?url|private.?key|raw.?payload|raw.?body|login(?:name)?|storage.?state|session(?:value|data|token|cookie)?|credential(?:value|secret)?|hash)/i;

export class BrowserL2CredentialsFailure extends Error {
  constructor(code) {
    super(code);
    this.name = 'BrowserL2CredentialsFailure';
    this.code = code;
  }
}

function fail(code) {
  throw new BrowserL2CredentialsFailure(code);
}

function assert(condition, code) {
  if (!condition) fail(code);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateRunId(runId) {
  assert(typeof runId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(runId), 'L2_SECRET_FORMAT_INVALID');
  return runId;
}

function validateDatabaseNamespace(databaseNamespace) {
  assert(
    typeof databaseNamespace === 'string' && /^catering_v2s_l2_[a-z0-9_]{3,48}$/.test(databaseNamespace),
    'L2_SECRET_FORMAT_INVALID',
  );
  return databaseNamespace;
}

function validateAssetPrefix(assetPrefix, runId) {
  assert(
    typeof assetPrefix === 'string' &&
      /^[A-Za-z][A-Za-z0-9+.-]{1,31}:\/\/[^\s?#]+\/$/.test(assetPrefix) &&
      assetPrefix.includes(runId),
    'L2_SECRET_FORMAT_INVALID',
  );
  return assetPrefix;
}

function validateHostFingerprint(hostFingerprint) {
  assert(typeof hostFingerprint === 'string' && /^[a-f0-9]{64}$/i.test(hostFingerprint), 'L2_SECRET_FORMAT_INVALID');
  return hostFingerprint.toLowerCase();
}

function validateEpoch(value) {
  assert(Number.isSafeInteger(value) && value >= 0, 'L2_SECRET_FORMAT_INVALID');
  return value;
}

function validateAllowlistVersion(value) {
  assert(typeof value === 'string' && /^[A-Za-z0-9._-]{1,96}$/.test(value), 'L2_SECRET_FORMAT_INVALID');
  return value;
}

function normalizeAllowedKeys(input = DEFAULT_SECRET_KEYS) {
  assert(Array.isArray(input) && input.length > 0, 'L2_SECRET_ALLOWLIST_MISMATCH');
  const keys = input.map(value => String(value));
  const unique = new Set(keys);
  assert(unique.size === keys.length, 'L2_SECRET_ALLOWLIST_MISMATCH');
  assert(
    keys.every(key => /^[A-Z][A-Z0-9_]{1,127}$/.test(key) && knownSecretKeys.includes(key)),
    'L2_SECRET_ALLOWLIST_MISMATCH',
  );
  return [...keys].sort();
}

function normalizeProjectionKeys(input) {
  assert(Array.isArray(input), 'L2_SECRET_ALLOWLIST_MISMATCH');
  if (input.length === 0) return [];
  return normalizeAllowedKeys(input);
}

function sameKeySet(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function keySetDigest(keys) {
  return createHash('sha256')
    .update([...keys].sort().join('\n'))
    .digest('hex');
}

function validateCredentialValue(key, value) {
  assert(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 4096 &&
      !/[\u0000\r\n]/.test(value) &&
      !/\s/.test(value),
    'L2_SECRET_FORMAT_INVALID',
  );
  if (key === 'V2S_L2_TEST_OTP') assert(/^\d{6}$/.test(value), 'L2_SECRET_FORMAT_INVALID');
  if (key.endsWith('_LOGIN') || key.endsWith('_USERNAME') || key.endsWith('_ACCESS_KEY')) {
    assert(/^[A-Za-z0-9._@+-]{3,160}$/.test(value), 'L2_SECRET_FORMAT_INVALID');
  }
  if (
    key.endsWith('_PASSWORD') ||
    key.endsWith('_SECRET') ||
    key.endsWith('_SECRET_KEY') ||
    key.endsWith('_HMAC_KEY')
  ) {
    assert(value.length >= 16, 'L2_SECRET_FORMAT_INVALID');
  }
}

function validateCredentialValues(values, allowedKeys) {
  assert(isObject(values), 'L2_SECRET_REQUIRED_MISSING');
  const expected = normalizeAllowedKeys(allowedKeys);
  const actual = Object.keys(values).sort();
  const missing = expected.filter(key => !actual.includes(key));
  assert(missing.length === 0, 'L2_SECRET_REQUIRED_MISSING');
  const extra = actual.filter(key => !expected.includes(key));
  assert(extra.length === 0, 'L2_SECRET_ALLOWLIST_MISMATCH');
  for (const key of expected) validateCredentialValue(key, values[key]);
  return Object.fromEntries(expected.map(key => [key, values[key]]));
}

function validateBindingShape(binding) {
  assert(isObject(binding), 'L2_SECRET_FORMAT_INVALID');
  assert(binding.schemaVersion === 1 && binding.kind === 'browser-l2-credential-binding', 'L2_SECRET_FORMAT_INVALID');
  const runId = validateRunId(binding.runId);
  const databaseNamespace = validateDatabaseNamespace(binding.databaseNamespace);
  const assetPrefix = validateAssetPrefix(binding.assetPrefix, runId);
  const hostFingerprint = validateHostFingerprint(binding.hostFingerprint);
  const hostAllowlistVersion = validateAllowlistVersion(binding.hostAllowlistVersion);
  const createdAtEpochMillis = validateEpoch(binding.createdAtEpochMillis);
  const expiresAtEpochMillis = validateEpoch(binding.expiresAtEpochMillis);
  assert(expiresAtEpochMillis > createdAtEpochMillis, 'L2_SECRET_FORMAT_INVALID');
  const allowedKeys = normalizeAllowedKeys(binding.allowedKeys);
  assert(binding.keySetDigest === keySetDigest(allowedKeys), 'L2_SECRET_ALLOWLIST_MISMATCH');
  assert(
    !Object.keys(binding).some(key => SENSITIVE_ARTIFACT_KEY.test(key) && !SAFE_ARTIFACT_KEYS.has(key)),
    'L2_SECRET_LEAK_DETECTED',
  );
  return Object.freeze({
    schemaVersion: 1,
    kind: 'browser-l2-credential-binding',
    runId,
    databaseNamespace,
    assetPrefix,
    hostFingerprint,
    hostAllowlistVersion,
    createdAtEpochMillis,
    expiresAtEpochMillis,
    allowedKeys: freezeList(allowedKeys),
    keySetDigest: binding.keySetDigest,
  });
}

function assertExpectedBinding(binding, expectedBinding) {
  assert(isObject(expectedBinding), 'L2_SECRET_FORMAT_INVALID');
  if (expectedBinding.runId !== undefined) {
    validateRunId(expectedBinding.runId);
    assert(binding.runId === expectedBinding.runId, 'L2_SECRET_RUN_BINDING_MISMATCH');
  }
  if (expectedBinding.hostFingerprint !== undefined) {
    assert(
      binding.hostFingerprint === validateHostFingerprint(expectedBinding.hostFingerprint),
      'L2_SECRET_RUN_BINDING_MISMATCH',
    );
  }
  if (expectedBinding.databaseNamespace !== undefined) {
    assert(
      binding.databaseNamespace === validateDatabaseNamespace(expectedBinding.databaseNamespace),
      'L2_SECRET_NAMESPACE_BINDING_MISMATCH',
    );
  }
  if (expectedBinding.assetPrefix !== undefined) {
    assert(
      binding.assetPrefix === validateAssetPrefix(expectedBinding.assetPrefix, binding.runId),
      'L2_SECRET_NAMESPACE_BINDING_MISMATCH',
    );
  }
  if (expectedBinding.allowedKeys !== undefined) {
    const expectedKeys = normalizeAllowedKeys(expectedBinding.allowedKeys);
    assert(sameKeySet(binding.allowedKeys, expectedKeys), 'L2_SECRET_ALLOWLIST_MISMATCH');
  }
}

function assertFresh(binding, now) {
  validateEpoch(now);
  assert(now < binding.expiresAtEpochMillis, 'L2_SECRET_STALE');
}

function runPaths(runtimeRoot, runId) {
  const root = path.resolve(runtimeRoot);
  validateRunId(runId);
  const directory = path.resolve(root, runId);
  const relative = path.relative(root, directory);
  assert(relative === runId && !relative.startsWith('..') && !path.isAbsolute(relative), 'L2_SECRET_FORMAT_INVALID');
  return Object.freeze({
    runtimeRoot: root,
    runDirectory: directory,
    credentialsPath: path.join(directory, 'credentials.env'),
    bindingPath: path.join(directory, 'credential-binding.json'),
    storageStatePaths: Object.freeze({
      platform: path.join(directory, 'platform-storage-state.json'),
      operations: path.join(directory, 'operations-storage-state.json'),
    }),
  });
}

function assertDirectoryMode(directory) {
  let stats;
  try {
    stats = lstatSync(directory);
  } catch {
    fail('L2_SECRET_FILE_REQUIRED');
  }
  assert(
    stats.isDirectory() && !stats.isSymbolicLink() && (stats.mode & 0o777) === RUN_DIRECTORY_MODE,
    'L2_SECRET_FILE_MODE_INVALID',
  );
}

function ensurePrivateDirectory(directory, {allowExisting = false} = {}) {
  if (existsSync(directory)) {
    assertDirectoryMode(directory);
    assert(allowExisting, 'L2_SECRET_RUN_BINDING_MISMATCH');
    return;
  }
  mkdirSync(directory, {recursive: true, mode: RUN_DIRECTORY_MODE});
  chmodSync(directory, RUN_DIRECTORY_MODE);
  assertDirectoryMode(directory);
}

function assertPrivateFile(filePath) {
  let stats;
  try {
    stats = lstatSync(filePath);
  } catch {
    fail('L2_SECRET_FILE_REQUIRED');
  }
  assert(
    stats.isFile() && !stats.isSymbolicLink() && (stats.mode & 0o777) === PRIVATE_FILE_MODE,
    'L2_SECRET_FILE_MODE_INVALID',
  );
}

function atomicWritePrivateFile(filePath, content, {overwrite = false} = {}) {
  if (existsSync(filePath)) assert(overwrite, 'L2_SECRET_RUN_BINDING_MISMATCH');
  const temporaryPath = `${filePath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    writeFileSync(temporaryPath, content, {encoding: 'utf8', mode: PRIVATE_FILE_MODE, flag: 'wx'});
    chmodSync(temporaryPath, PRIVATE_FILE_MODE);
    renameSync(temporaryPath, filePath);
    chmodSync(filePath, PRIVATE_FILE_MODE);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
  assertPrivateFile(filePath);
}

function formatCredentialEnv(values, allowedKeys) {
  const normalized = validateCredentialValues(values, allowedKeys);
  return `${Object.entries(normalized)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}

function parseCredentialEnv(content) {
  assert(typeof content === 'string' && content.length > 0, 'L2_SECRET_FORMAT_INVALID');
  const values = {};
  const lines = content.endsWith('\n') ? content.slice(0, -1).split('\n') : content.split('\n');
  for (const line of lines) {
    assert(/^[A-Z][A-Z0-9_]{1,127}=[^\r\n]*$/.test(line), 'L2_SECRET_FORMAT_INVALID');
    const separator = line.indexOf('=');
    const key = line.slice(0, separator);
    assert(!Object.hasOwn(values, key), 'L2_SECRET_FORMAT_INVALID');
    values[key] = line.slice(separator + 1);
  }
  return values;
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    fail('L2_SECRET_FORMAT_INVALID');
  }
}

function privateSessionPath(runDirectory, sessionName) {
  assert(typeof sessionName === 'string' && SESSION_FILENAMES.has(sessionName), 'L2_SECRET_RUN_BINDING_MISMATCH');
  assertDirectoryMode(runDirectory);
  return path.join(runDirectory, sessionName);
}

function flattenSecretValues(secretValues) {
  if (Array.isArray(secretValues)) return secretValues.flatMap(value => flattenSecretValues(value));
  if (isObject(secretValues)) return Object.values(secretValues).flatMap(value => flattenSecretValues(value));
  return typeof secretValues === 'string' && secretValues.length >= 4 ? [secretValues] : [];
}

function assertNoSensitiveLeakInternal(value, secretValues, location = '$', seen = new Set()) {
  if (typeof value === 'string') {
    assert(!secretValues.some(secret => value.includes(secret)), 'L2_SECRET_LEAK_DETECTED');
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) fail('L2_SECRET_LEAK_DETECTED');
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSensitiveLeakInternal(entry, secretValues, `${location}[${index}]`, seen));
  } else {
    for (const [key, child] of Object.entries(value)) {
      assert(!SENSITIVE_ARTIFACT_KEY.test(key) || SAFE_ARTIFACT_KEYS.has(key), 'L2_SECRET_LEAK_DETECTED');
      assertNoSensitiveLeakInternal(child, secretValues, `${location}.${key}`, seen);
    }
  }
  seen.delete(value);
}

/**
 * Validate a manifest/log/join-shaped public artifact without returning or
 * embedding any sensitive value. The error intentionally contains only the
 * closed failure code, never the offending key or value.
 */
export function assertNoSensitiveLeak(value, {secretValues = []} = {}) {
  assertNoSensitiveLeakInternal(value, flattenSecretValues(secretValues));
  return true;
}

export function safeMetadata(value, {secretValues = []} = {}) {
  assertNoSensitiveLeak(value, {secretValues});
  return JSON.stringify(value);
}

export function resolveL2HostBinding(environment = {}, options = {}) {
  // Reuse only the non-secret allowlist/fingerprint resolver. Private SSH
  // identity material never enters this adapter or its child environments.
  const trust = resolveTrustedRemoteHost(environment, options);
  return Object.freeze({
    hostFingerprint: trust.fingerprint.toLowerCase(),
    hostAllowlistVersion: trust.allowlistVersion,
  });
}

export function createRunBinding({
  runId,
  databaseNamespace,
  assetPrefix,
  hostFingerprint,
  hostAllowlistVersion,
  allowedKeys = DEFAULT_SECRET_KEYS,
  createdAtEpochMillis = Date.now(),
  expiresAtEpochMillis = createdAtEpochMillis + DEFAULT_TTL_MILLIS,
} = {}) {
  const normalizedRunId = validateRunId(runId);
  const normalizedAllowedKeys = normalizeAllowedKeys(allowedKeys);
  const binding = {
    schemaVersion: 1,
    kind: 'browser-l2-credential-binding',
    runId: normalizedRunId,
    databaseNamespace: validateDatabaseNamespace(databaseNamespace),
    assetPrefix: validateAssetPrefix(assetPrefix, normalizedRunId),
    hostFingerprint: validateHostFingerprint(hostFingerprint),
    hostAllowlistVersion: validateAllowlistVersion(hostAllowlistVersion),
    createdAtEpochMillis: validateEpoch(createdAtEpochMillis),
    expiresAtEpochMillis: validateEpoch(expiresAtEpochMillis),
    allowedKeys: normalizedAllowedKeys,
    keySetDigest: keySetDigest(normalizedAllowedKeys),
  };
  return validateBindingShape(binding);
}

function buildGeneratedCredentialValues({runId, assetStorage, testLogin} = {}) {
  assert(
    isObject(assetStorage) && typeof assetStorage.accessKey === 'string' && typeof assetStorage.secretKey === 'string',
    'L2_SECRET_FORMAT_INVALID',
  );
  assert(isObject(testLogin), 'L2_SECRET_FORMAT_INVALID');
  const requiredLoginFields = [
    'platformUsername',
    'platformPassword',
    'operationsUsername',
    'operationsPassword',
    'otp',
  ];
  for (const field of requiredLoginFields) assert(typeof testLogin[field] === 'string', 'L2_SECRET_FORMAT_INVALID');
  const suffix = createHash('sha256').update(runId).digest('hex').slice(0, 16);
  return {
    CATERING_BUSINESS_DB_USERNAME: `catering_l2_${suffix}`,
    CATERING_BUSINESS_DB_PASSWORD: randomBytes(32).toString('base64url'),
    CATERING_ASSET_S3_ACCESS_KEY: assetStorage.accessKey,
    CATERING_ASSET_S3_SECRET_KEY: assetStorage.secretKey,
    CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: randomBytes(32).toString('base64url'),
    CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: randomBytes(32).toString('base64url'),
    V2S_DB_OPERATIONS_HMAC_KEY: randomBytes(32).toString('base64url'),
    V2S_L2_DIAGNOSTIC_SECRET: randomBytes(32).toString('base64url'),
    V2S_L2_PLATFORM_LOGIN: testLogin.platformUsername,
    V2S_L2_PLATFORM_PASSWORD: testLogin.platformPassword,
    V2S_L2_OPERATIONS_LOGIN: testLogin.operationsUsername,
    V2S_L2_OPERATIONS_PASSWORD: testLogin.operationsPassword,
    V2S_L2_HEAD_OPERATIONS_LOGIN: testLogin.headOperationsUsername,
    V2S_L2_HEAD_OPERATIONS_PASSWORD: testLogin.headOperationsPassword,
    V2S_L2_TEST_OTP: testLogin.otp,
  };
}

function publicBindingMetadata(binding, paths) {
  const metadata = {
    ...binding,
    files: {
      credentialsFile: paths.credentialsPath,
      credentialBindingPath: paths.bindingPath,
      platformStorageStatePath: paths.storageStatePaths.platform,
      operationsStorageStatePath: paths.storageStatePaths.operations,
      credentialsMode: PRIVATE_FILE_MODE,
      runDirectoryMode: RUN_DIRECTORY_MODE,
    },
  };
  assertNoSensitiveLeak(metadata);
  return Object.freeze(metadata);
}

function writeRunFiles(paths, binding, values) {
  ensurePrivateDirectory(paths.runDirectory, {allowExisting: true});
  const normalizedValues = validateCredentialValues(values, binding.allowedKeys);
  assertNoSensitiveLeak(binding);
  const createdFiles = [];
  try {
    atomicWritePrivateFile(paths.credentialsPath, formatCredentialEnv(normalizedValues, binding.allowedKeys));
    createdFiles.push(paths.credentialsPath);
    atomicWritePrivateFile(paths.bindingPath, `${JSON.stringify(binding, null, 2)}\n`);
    createdFiles.push(paths.bindingPath);
  } catch (error) {
    for (const filePath of createdFiles) if (existsSync(filePath)) unlinkSync(filePath);
    throw error;
  }
  return Object.freeze({
    paths,
    binding: publicBindingMetadata(binding, paths),
  });
}

export function createRunCredentials({
  runtimeRoot = DEFAULT_RUNTIME_ROOT,
  runId,
  databaseNamespace,
  assetPrefix,
  hostFingerprint,
  hostAllowlistVersion,
  assetStorage,
  testLogin,
  credentialValues,
  now = Date.now(),
  ttlMillis = DEFAULT_TTL_MILLIS,
} = {}) {
  validateEpoch(now);
  assert(Number.isSafeInteger(ttlMillis) && ttlMillis > 0, 'L2_SECRET_FORMAT_INVALID');
  const binding = createRunBinding({
    runId,
    databaseNamespace,
    assetPrefix,
    hostFingerprint,
    hostAllowlistVersion,
    createdAtEpochMillis: now,
    expiresAtEpochMillis: now + ttlMillis,
  });
  const values = credentialValues ?? buildGeneratedCredentialValues({runId: binding.runId, assetStorage, testLogin});
  const paths = runPaths(runtimeRoot, binding.runId);
  ensurePrivateDirectory(paths.runtimeRoot, {allowExisting: true});
  assert(!existsSync(paths.runDirectory), 'L2_SECRET_RUN_BINDING_MISMATCH');
  mkdirSync(paths.runDirectory, {mode: RUN_DIRECTORY_MODE});
  chmodSync(paths.runDirectory, RUN_DIRECTORY_MODE);
  assertDirectoryMode(paths.runDirectory);
  return writeRunFiles(paths, binding, values);
}

export function readRunCredentials({
  runtimeRoot = DEFAULT_RUNTIME_ROOT,
  runId,
  credentialsPath,
  bindingPath,
  expectedBinding,
  now = Date.now(),
} = {}) {
  const expected = expectedBinding ?? {runId};
  assert(
    isObject(expected) && expected.runId && expected.databaseNamespace && expected.assetPrefix,
    'L2_SECRET_FORMAT_INVALID',
  );
  const paths =
    credentialsPath || bindingPath
      ? Object.freeze({
          runtimeRoot: path.resolve(runtimeRoot),
          runDirectory: path.dirname(path.resolve(credentialsPath ?? bindingPath)),
          credentialsPath: path.resolve(credentialsPath ?? path.join(path.dirname(bindingPath), 'credentials.env')),
          bindingPath: path.resolve(bindingPath ?? path.join(path.dirname(credentialsPath), 'credential-binding.json')),
          storageStatePaths: Object.freeze({
            platform: path.join(
              path.dirname(path.resolve(credentialsPath ?? bindingPath)),
              'platform-storage-state.json',
            ),
            operations: path.join(
              path.dirname(path.resolve(credentialsPath ?? bindingPath)),
              'operations-storage-state.json',
            ),
          }),
        })
      : runPaths(runtimeRoot, expected.runId);
  const expectedRunId = validateRunId(expected.runId);
  const relativeRunDirectory = path.relative(path.resolve(runtimeRoot), paths.runDirectory);
  assert(
    relativeRunDirectory === expectedRunId &&
      path.basename(paths.runDirectory) === expectedRunId &&
      !relativeRunDirectory.startsWith('..') &&
      !path.isAbsolute(relativeRunDirectory),
    'L2_SECRET_RUN_BINDING_MISMATCH',
  );
  assert(path.dirname(paths.credentialsPath) === path.dirname(paths.bindingPath), 'L2_SECRET_RUN_BINDING_MISMATCH');
  assertDirectoryMode(paths.runDirectory);
  assertPrivateFile(paths.bindingPath);
  assertPrivateFile(paths.credentialsPath);
  const binding = validateBindingShape(readJson(paths.bindingPath));
  assertExpectedBinding(binding, expected);
  assertFresh(binding, now);
  const values = parseCredentialEnv(readFileSync(paths.credentialsPath, 'utf8'));
  const normalizedValues = validateCredentialValues(values, binding.allowedKeys);
  const result = {
    binding: publicBindingMetadata(binding, paths),
    paths,
  };
  Object.defineProperty(result, 'values', {
    configurable: false,
    enumerable: false,
    value: Object.freeze(normalizedValues),
    writable: false,
  });
  return Object.freeze(result);
}

export function projectChildEnvironment({credentials, values, allowedKeys} = {}) {
  const source = credentials?.values ?? values;
  const binding = credentials?.binding ?? credentials?.bindingMetadata;
  assert(isObject(binding), 'L2_SECRET_FORMAT_INVALID');
  const normalizedValues = validateCredentialValues(source, binding.allowedKeys);
  const requestedKeys = normalizeProjectionKeys(allowedKeys);
  assert(
    requestedKeys.every(key => binding.allowedKeys.includes(key)),
    'L2_SECRET_ALLOWLIST_MISMATCH',
  );
  return Object.freeze(Object.fromEntries(requestedKeys.map(key => [key, normalizedValues[key]])));
}

export function writePrivateSessionState({runDirectory, sessionName, content} = {}) {
  const sessionPath = privateSessionPath(runDirectory, sessionName);
  const serialized = typeof content === 'string' ? content : JSON.stringify(content);
  assert(
    typeof serialized === 'string' && serialized.length > 0 && !/[\u0000]/.test(serialized),
    'L2_SECRET_FORMAT_INVALID',
  );
  atomicWritePrivateFile(sessionPath, serialized.endsWith('\n') ? serialized : `${serialized}\n`, {overwrite: true});
  return sessionPath;
}

export function validatePrivateSessionState({sessionPath, runDirectory} = {}) {
  const expectedPath = privateSessionPath(runDirectory, path.basename(String(sessionPath ?? '')));
  assert(path.resolve(sessionPath) === expectedPath, 'L2_SECRET_RUN_BINDING_MISMATCH');
  assertPrivateFile(expectedPath);
  return Object.freeze({path: expectedPath, mode: PRIVATE_FILE_MODE});
}

export function cleanupPrivateRunFiles({paths, sessionPaths = []} = {}) {
  assert(isObject(paths) && typeof paths.runDirectory === 'string', 'L2_SECRET_FORMAT_INVALID');
  assertDirectoryMode(paths.runDirectory);
  const targets = [paths.credentialsPath, paths.bindingPath, ...sessionPaths]
    .filter(Boolean)
    .map(value => path.resolve(value));
  const allowed = new Set([
    paths.credentialsPath && path.resolve(paths.credentialsPath),
    paths.bindingPath && path.resolve(paths.bindingPath),
    path.resolve(paths.storageStatePaths?.platform ?? path.join(paths.runDirectory, 'platform-storage-state.json')),
    path.resolve(paths.storageStatePaths?.operations ?? path.join(paths.runDirectory, 'operations-storage-state.json')),
  ]);
  for (const target of targets) {
    assert(
      allowed.has(target) && path.dirname(target) === path.resolve(paths.runDirectory),
      'L2_SECRET_RUN_BINDING_MISMATCH',
    );
    if (existsSync(target)) unlinkSync(target);
  }
  const residue = [...allowed].filter(target => target && existsSync(target));
  assert(residue.length === 0, 'L2_SECRET_FILE_MODE_INVALID');
  return Object.freeze({status: 'PASS', removed: targets.map(target => path.basename(target))});
}

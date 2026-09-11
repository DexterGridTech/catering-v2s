import assert from 'node:assert/strict';
import {chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  CHILD_PROCESS_ENV_ALLOWLISTS,
  BrowserL2CredentialsFailure,
  SECRET_FAILURE_CODES,
  assertNoSensitiveLeak,
  cleanupPrivateRunFiles,
  createRunCredentials,
  projectChildEnvironment,
  readRunCredentials,
  resolveL2HostBinding,
  safeMetadata,
  validatePrivateSessionState,
  writePrivateSessionState,
} from './browser-l2-credentials.mjs';

const NOW = 1_772_000_000_000;
const RUN_ID = 'browser-l2-catalog-test-01';
const DATABASE_NAMESPACE = 'catering_v2s_l2_catalog_test';
const ASSET_PREFIX = `s3://l2-assets/browser-l2/${RUN_ID}/`;
const HOST_FINGERPRINT = 'a'.repeat(64);
const ASSET_STORAGE = {
  accessKey: 'AKIAL2ACCESSKEY01',
  secretKey: 'asset-secret-value-0123456789',
};
const TEST_LOGIN = {
  platformUsername: 'platform.l2@example.test',
  platformPassword: 'platform-password-value-0123456789',
  operationsUsername: 'operations.l2@example.test',
  operationsPassword: 'operations-password-value-0123456789',
  operationsReadonlyUsername: 'operations-readonly.l2@example.test',
  operationsReadonlyPassword: 'operations-readonly-password-value-0123456789',
  headOperationsUsername: 'head-operations.l2@example.test',
  headOperationsPassword: 'head-operations-password-value-0123456789',
  projectOperationsUsername: 'project-operations.l2@example.test',
  projectOperationsPassword: 'project-operations-password-value-0123456789',
  otp: '123456',
};

function fixtureInput(runtimeRoot) {
  return {
    runtimeRoot,
    runId: RUN_ID,
    databaseNamespace: DATABASE_NAMESPACE,
    assetPrefix: ASSET_PREFIX,
    hostFingerprint: HOST_FINGERPRINT,
    hostAllowlistVersion: 'test-v1',
    assetStorage: ASSET_STORAGE,
    testLogin: TEST_LOGIN,
    now: NOW,
    ttlMillis: 60_000,
  };
}

function expectCode(action, code) {
  assert.throws(action, error => error instanceof BrowserL2CredentialsFailure && error.code === code);
}

function copyMaterial(root) {
  const sourceRoot = mkdtempSync(path.join(root, 'source-'));
  const source = createRunCredentials(fixtureInput(sourceRoot));
  return {sourceRoot, source};
}

function mutateBinding(source, mutate) {
  const binding = JSON.parse(readFileSync(source.paths.bindingPath, 'utf8'));
  mutate(binding);
  writeFileSync(source.paths.bindingPath, `${JSON.stringify(binding, null, 2)}\n`, {mode: 0o600});
  chmodSync(source.paths.bindingPath, 0o600);
}

function mutateCredentials(source, mutate) {
  const values = readFileSync(source.paths.credentialsPath, 'utf8');
  const mutated = mutate(values);
  writeFileSync(source.paths.credentialsPath, mutated, {mode: 0o600});
  chmodSync(source.paths.credentialsPath, 0o600);
}

function readSource(source, overrides = {}) {
  return readRunCredentials({
    runtimeRoot: source.paths.runtimeRoot,
    expectedBinding: source.binding,
    credentialsPath: source.paths.credentialsPath,
    bindingPath: source.paths.bindingPath,
    now: NOW,
    ...overrides,
  });
}

test('creates 0700 run material, 0600 private files, exact binding metadata, and minimal child projections', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'browser-l2-credentials-'));
  try {
    const created = createRunCredentials(fixtureInput(root));
    assert.equal(created.binding.runId, RUN_ID);
    assert.equal(created.binding.databaseNamespace, DATABASE_NAMESPACE);
    assert.equal(created.binding.assetPrefix, ASSET_PREFIX);
    assert.equal(created.binding.files.credentialsMode, 0o600);
    assert.equal(created.binding.files.runDirectoryMode, 0o700);
    assert.equal((created.binding.allowedKeys ?? []).length, 19);
    const loaded = readSource(created);
    assert.equal(loaded.values.V2S_L2_TEST_OTP, '123456');
    assert.equal(JSON.stringify(loaded).includes(TEST_LOGIN.platformPassword), false);
    const springBoot = projectChildEnvironment({
      credentials: loaded,
      allowedKeys: CHILD_PROCESS_ENV_ALLOWLISTS.springBoot,
    });
    assert.equal(Object.hasOwn(springBoot, 'CATERING_BUSINESS_DB_PASSWORD'), true);
    assert.equal(Object.hasOwn(springBoot, 'V2S_L2_PLATFORM_PASSWORD'), false);
    assert.deepEqual(
      projectChildEnvironment({credentials: loaded, allowedKeys: CHILD_PROCESS_ENV_ALLOWLISTS.platformPlaywright}),
      {},
    );
    assert.deepEqual(
      projectChildEnvironment({credentials: loaded, allowedKeys: CHILD_PROCESS_ENV_ALLOWLISTS.operationsPlaywright}),
      {
        V2S_L2_OPERATIONS_LOGIN: TEST_LOGIN.operationsUsername,
        V2S_L2_OPERATIONS_PASSWORD: TEST_LOGIN.operationsPassword,
        V2S_L2_OPERATIONS_READONLY_LOGIN: TEST_LOGIN.operationsReadonlyUsername,
        V2S_L2_OPERATIONS_READONLY_PASSWORD: TEST_LOGIN.operationsReadonlyPassword,
        V2S_L2_HEAD_OPERATIONS_LOGIN: TEST_LOGIN.headOperationsUsername,
        V2S_L2_HEAD_OPERATIONS_PASSWORD: TEST_LOGIN.headOperationsPassword,
        V2S_L2_PROJECT_OPERATIONS_LOGIN: TEST_LOGIN.projectOperationsUsername,
        V2S_L2_PROJECT_OPERATIONS_PASSWORD: TEST_LOGIN.projectOperationsPassword,
        V2S_L2_DIAGNOSTIC_SECRET: loaded.values.V2S_L2_DIAGNOSTIC_SECRET,
      },
    );
    assert.equal(safeMetadata(created.binding).includes(ASSET_STORAGE.secretKey), false);
    assert.equal(safeMetadata(created.binding).includes(TEST_LOGIN.platformPassword), false);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('rejects a missing credential file with L2_SECRET_FILE_REQUIRED', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'browser-l2-credentials-'));
  try {
    const {source} = copyMaterial(root);
    rmSync(source.paths.credentialsPath, {force: true});
    expectCode(() => readSource(source), 'L2_SECRET_FILE_REQUIRED');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('red mutation: non-0600 credential file hits L2_SECRET_FILE_MODE_INVALID', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'browser-l2-credentials-'));
  try {
    const {source} = copyMaterial(root);
    chmodSync(source.paths.credentialsPath, 0o644);
    expectCode(() => readSource(source), 'L2_SECRET_FILE_MODE_INVALID');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('red mutation: removing one required secret hits L2_SECRET_REQUIRED_MISSING', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'browser-l2-credentials-'));
  try {
    const {source} = copyMaterial(root);
    mutateCredentials(source, content =>
      content
        .split('\n')
        .filter(line => !line.startsWith('V2S_DB_OPERATIONS_HMAC_KEY='))
        .join('\n'),
    );
    expectCode(() => readSource(source), 'L2_SECRET_REQUIRED_MISSING');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('red mutation: adding an undeclared secret hits L2_SECRET_ALLOWLIST_MISMATCH', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'browser-l2-credentials-'));
  try {
    const {source} = copyMaterial(root);
    mutateCredentials(source, content => `${content}UNDECLARED_SECRET=undeclared-secret-value-012345\n`);
    expectCode(() => readSource(source), 'L2_SECRET_ALLOWLIST_MISMATCH');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('red mutation: malformed secret format hits L2_SECRET_FORMAT_INVALID', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'browser-l2-credentials-'));
  try {
    const {source} = copyMaterial(root);
    mutateCredentials(source, content =>
      content.replace(
        /CATERING_BUSINESS_DB_PASSWORD=[^\n]+/,
        'CATERING_BUSINESS_DB_PASSWORD=malformed\nnot-an-env-line',
      ),
    );
    expectCode(() => readSource(source), 'L2_SECRET_FORMAT_INVALID');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('red mutation: expired binding hits L2_SECRET_STALE', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'browser-l2-credentials-'));
  try {
    const {source} = copyMaterial(root);
    mutateBinding(source, binding => {
      binding.expiresAtEpochMillis = NOW + 1;
    });
    expectCode(() => readSource(source, {now: NOW + 2}), 'L2_SECRET_STALE');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('red mutation: prior-run material hits L2_SECRET_RUN_BINDING_MISMATCH', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'browser-l2-credentials-'));
  try {
    const {source} = copyMaterial(root);
    mutateBinding(source, binding => {
      binding.runId = 'browser-l2-catalog-test-old';
      binding.assetPrefix = 's3://l2-assets/browser-l2/browser-l2-catalog-test-old/';
    });
    expectCode(() => readSource(source), 'L2_SECRET_RUN_BINDING_MISMATCH');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('red mutation: wrong database namespace hits L2_SECRET_NAMESPACE_BINDING_MISMATCH', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'browser-l2-credentials-'));
  try {
    const {source} = copyMaterial(root);
    mutateBinding(source, binding => {
      binding.databaseNamespace = 'catering_v2s_l2_other_namespace';
    });
    expectCode(() => readSource(source), 'L2_SECRET_NAMESPACE_BINDING_MISMATCH');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('red mutation: secret-shaped manifest/log/join field hits L2_SECRET_LEAK_DETECTED without echoing its value', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'browser-l2-credentials-'));
  try {
    const secret = 'authorization-secret-value-0123456789';
    let thrown;
    try {
      assertNoSensitiveLeak({join: {Authorization: secret}}, {secretValues: [secret]});
    } catch (error) {
      thrown = error;
    }
    assert(thrown instanceof BrowserL2CredentialsFailure);
    assert.equal(thrown.code, 'L2_SECRET_LEAK_DETECTED');
    assert.equal(thrown.message.includes(secret), false);
    assert.equal(thrown.message.includes('Authorization'), false);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('allows managed process start tokens as non-secret identity metadata', () => {
  assert.doesNotThrow(() =>
    assertNoSensitiveLeak({
      processIdentities: [{name: 'spring-boot', pid: 1234, pgid: 1234, startToken: 'Mon Aug 24 07:38:46 2026'}],
    }),
  );
});

test('binds private Playwright session files to the run directory and keeps cleanup scoped', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'browser-l2-credentials-'));
  try {
    const {source} = copyMaterial(root);
    const sessionPath = writePrivateSessionState({
      runDirectory: source.paths.runDirectory,
      sessionName: 'platform-storage-state.json',
      content: {cookies: [{name: 'session', value: 'private-session-value-012345'}]},
    });
    assert.equal(validatePrivateSessionState({sessionPath, runDirectory: source.paths.runDirectory}).mode, 0o600);
    assert.equal(cleanupPrivateRunFiles({paths: source.paths, sessionPaths: [sessionPath]}).status, 'PASS');
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('keeps the failure-code contract closed and each code is exercised', () => {
  assert.deepEqual(SECRET_FAILURE_CODES, [
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
});

test('uses the existing non-secret host fingerprint allowlist and never accepts a wrong fingerprint', () => {
  const fingerprint = 'b'.repeat(64);
  const allowlist = {
    schemaVersion: 1,
    kind: 'r5-remote-host-allowlist',
    version: 'test-host-v1',
    entries: [{host: 'l2-a.internal', fingerprint, maintainer: 'test', rotatedAt: '2026-08-24'}],
  };
  assert.deepEqual(
    resolveL2HostBinding({V2S_DEV_REMOTE_HOST: 'l2-a.internal', V2S_DEV_REMOTE_HOST_SHA256: fingerprint}, {allowlist}),
    {
      hostFingerprint: fingerprint,
      hostAllowlistVersion: 'test-host-v1',
    },
  );
  assert.throws(
    () =>
      resolveL2HostBinding(
        {V2S_DEV_REMOTE_HOST: 'l2-a.internal', V2S_DEV_REMOTE_HOST_SHA256: 'c'.repeat(64)},
        {allowlist},
      ),
    /R5_DEV_REMOTE_HOST_BINDING_INVALID/,
  );
});

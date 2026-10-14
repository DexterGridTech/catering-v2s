import path from 'node:path';

export const DEV_SEED_MANIFEST_KIND = 'r5-dev-run-manifest';
export const UAT_SEED_MANIFEST_KIND = 'uat-environment-run-manifest';

function fail(code) { const error = new Error(code); error.code = code; throw error; }

export function seedEnvironmentKind(manifest) {
  if (manifest?.kind === DEV_SEED_MANIFEST_KIND) return 'dev';
  if (manifest?.kind === UAT_SEED_MANIFEST_KIND && manifest.environmentKind === 'uat') return 'uat';
  fail('SEED_MANAGED_ENVIRONMENT_KIND_INVALID');
}

export function managedEnvironmentRunId(manifest) {
  const value = manifest?.managedEnvironmentRunId ?? manifest?.runId;
  if (typeof value !== 'string' || !value) fail('SEED_MANAGED_ENVIRONMENT_RUN_ID_REQUIRED');
  return value;
}

export function seedRunIdentity(manifest) {
  const environmentKind = seedEnvironmentKind(manifest);
  const runId = managedEnvironmentRunId(manifest);
  return Object.freeze({environmentKind, managedEnvironmentRunId: runId,
    ...(environmentKind === 'dev' ? {managedDevRunId: runId} : {})});
}

export function preservedSeedStateLabels(environmentKind) {
  if (!['dev', 'uat'].includes(environmentKind)) fail('SEED_MANAGED_ENVIRONMENT_KIND_INVALID');
  const label = environmentKind.toUpperCase();
  return Object.freeze({
    cleanup: `PASS_PRESERVED_${label}_STATE`,
    policy: `PRESERVE_${label}_EXPERIENCE_STATE`,
  });
}

export function reportManagedEnvironmentRunId(value) {
  const runId = value?.managedEnvironmentRunId ?? value?.managedDevRunId;
  if (typeof runId !== 'string' || !runId) fail('SEED_REPORT_MANAGED_ENVIRONMENT_RUN_ID_REQUIRED');
  return runId;
}

export function seedRuntimeRoot(root, env = process.env) {
  return path.resolve(env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
}

export function seedTargetBaseUrl(manifest) {
  const kind = seedEnvironmentKind(manifest);
  const value = kind === 'uat' ? manifest.endpoints?.business : manifest.localHttpBaseUrl;
  const pattern = kind === 'uat' ? /^http:\/\/[A-Za-z0-9.-]+:\d{4,5}$/ : /^http:\/\/127\.0\.0\.1:\d{4,5}$/;
  if (typeof value !== 'string' || !pattern.test(value)) fail('SEED_MANAGED_HTTP_ENDPOINT_INVALID');
  return value;
}

export function seedTargetNamespace(manifest) {
  const kind = seedEnvironmentKind(manifest);
  const value = manifest.namespace;
  const pattern = kind === 'uat' ? /^v2s-uat-[a-z0-9-]{3,32}$/ : /^v2s-dev-[a-z0-9-]{3,32}$/;
  if (typeof value !== 'string' || !pattern.test(value)) fail('SEED_MANAGED_NAMESPACE_BINDING_INVALID');
  return value;
}

export function seedTargetDatabase(manifest) {
  const kind = seedEnvironmentKind(manifest);
  const value = manifest?.database;
  let parsed;
  try { parsed = new URL(String(value).replace(/^jdbc:/, '')); }
  catch { fail('SEED_MANAGED_DATABASE_BINDING_INVALID'); }
  const name = parsed.pathname.replace(/^\//, '');
  const prefix = kind === 'uat' ? /^catering_v2s_uat_[a-z0-9_]{3,32}$/ : /^catering_v2s_dev_[a-z0-9_]{3,32}$/;
  if (!prefix.test(name)) fail('SEED_MANAGED_DATABASE_BINDING_INVALID');
  return value;
}

export function seedEnvironmentProjection(manifest, credentials, runtimeDir, processEnvironment = process.env) {
  const kind = seedEnvironmentKind(manifest);
  const baseUrl = seedTargetBaseUrl(manifest);
  const namespace = seedTargetNamespace(manifest);
  const database = seedTargetDatabase(manifest);
  const trust = manifest.remoteHostTrust;
  if (!trust || !/^[a-z0-9._-]{3,128}$/i.test(trust.host ?? '') || !/^[a-f0-9]{64}$/i.test(trust.fingerprint ?? '')
    || !trust.allowlistVersion || !trust.maintainer || !trust.rotatedAt) fail('SEED_MANAGED_REMOTE_HOST_BINDING_INVALID');
  return {
    ...processEnvironment,
    ...credentials,
    V2S_RUNTIME_DIR: runtimeDir,
    V2S_SEED_PROFILE: 'r5-full',
    V2S_SEED_ENVIRONMENT_KIND: kind,
    V2S_SEED_DATABASE_URL: database,
    V2S_SEED_HTTP_BASE_URL: baseUrl,
    V2S_SEED_NAMESPACE: namespace,
    V2S_SEED_ASSET_ROOT: manifest.assetRoot,
    V2S_RUNTIME_ENVIRONMENT: kind === 'uat' ? 'uat' : 'non-production',
    V2S_SEED_REMOTE_HOST: trust.host,
    V2S_SEED_REMOTE_HOST_SHA256: trust.fingerprint,
    V2S_SEED_REMOTE_HOST_ALLOWLIST_VERSION: trust.allowlistVersion,
    V2S_SEED_REMOTE_HOST_MAINTAINER: trust.maintainer,
    V2S_SEED_REMOTE_HOST_ROTATED_AT: trust.rotatedAt,
  };
}


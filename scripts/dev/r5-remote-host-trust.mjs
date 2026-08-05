#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
export const allowlistPath = path.join(root, 'contracts/policy/r5-remote-host-allowlist.json');
const productionLike = (value) => /(?:^|[._/-])(?:prod|production)(?:$|[._/-])/i.test(String(value ?? ''));

export function readHostAllowlist(file = allowlistPath) {
  const value = JSON.parse(readFileSync(file, 'utf8'));
  if (value.schemaVersion !== 1 || value.kind !== 'r5-remote-host-allowlist' || !Array.isArray(value.entries) || !value.entries.length) throw trustError('R5_DEV_REMOTE_HOST_ALLOWLIST_INVALID');
  for (const entry of value.entries) {
    if (!/^[a-z0-9._-]{3,128}$/i.test(entry.host ?? '') || !/^[a-f0-9]{64}$/i.test(entry.fingerprint ?? '') || !entry.maintainer || !entry.rotatedAt) throw trustError('R5_DEV_REMOTE_HOST_ALLOWLIST_INVALID');
  }
  return value;
}

export function resolveTrustedRemoteHost(env = {}, {allowlist = readHostAllowlist()} = {}) {
  const configuredCandidate = env.V2S_DEV_REMOTE_HOST ?? env.CATERING_ALL_V2_DEV_SSH_HOST;
  if (configuredCandidate === undefined && allowlist.entries.length !== 1) throw trustError('R5_DEV_REMOTE_HOST_NOT_SPECIFIED');
  const candidate = configuredCandidate ?? allowlist.entries[0]?.host;
  if (!candidate || productionLike(candidate)) throw trustError(productionLike(candidate) ? 'R5_DEV_REMOTE_HOST_PRODUCTION_LIKE' : 'R5_DEV_REMOTE_HOST_NOT_ALLOWLISTED');
  const entry = allowlist.entries.find((value) => value.host === candidate);
  if (!entry) throw trustError('R5_DEV_REMOTE_HOST_NOT_ALLOWLISTED');
  const supplied = env.V2S_DEV_REMOTE_HOST_SHA256;
  if (supplied !== undefined && (!/^[a-f0-9]{64}$/i.test(supplied) || supplied.toLowerCase() !== entry.fingerprint.toLowerCase())) throw trustError('R5_DEV_REMOTE_HOST_BINDING_INVALID');
  return {host: entry.host, fingerprint: entry.fingerprint, maintainer: entry.maintainer, rotatedAt: entry.rotatedAt, allowlistVersion: allowlist.version};
}

export function hostTrustEnvironment(env = {}, options = {}) {
  const trust = resolveTrustedRemoteHost(env, options);
  return {V2S_DEV_REMOTE_HOST: trust.host, V2S_DEV_REMOTE_HOST_SHA256: trust.fingerprint, V2S_DEV_REMOTE_HOST_ALLOWLIST_VERSION: trust.allowlistVersion, V2S_DEV_REMOTE_HOST_MAINTAINER: trust.maintainer, V2S_DEV_REMOTE_HOST_ROTATED_AT: trust.rotatedAt};
}

function trustError(code) { const error = new Error(code); error.code = code; return error; }

function selfTest() {
  const first = {host: 'dev-a.internal', fingerprint: 'a'.repeat(64), maintainer: 'test', rotatedAt: '2026-08-05'};
  const second = {host: 'dev-b.internal', fingerprint: 'b'.repeat(64), maintainer: 'test', rotatedAt: '2026-08-05'};
  const allowlist = {schemaVersion: 1, kind: 'r5-remote-host-allowlist', version: 'test-v1', entries: [first]};
  if (resolveTrustedRemoteHost({V2S_DEV_REMOTE_HOST: first.host, V2S_DEV_REMOTE_HOST_SHA256: first.fingerprint}, {allowlist}).host !== first.host) throw new Error('R5_REMOTE_HOST_SELF_TEST_VALID');
  if (resolveTrustedRemoteHost({}, {allowlist}).host !== first.host) throw new Error('R5_REMOTE_HOST_SELF_TEST_SINGLE_ENTRY_DEFAULT');
  const expectFailure = (env, code, selectedAllowlist = allowlist) => { try { resolveTrustedRemoteHost(env, {allowlist: selectedAllowlist}); throw new Error(`R5_REMOTE_HOST_SELF_TEST_RED:${code}`); } catch (error) { if (error.code !== code) throw error; } };
  expectFailure({}, 'R5_DEV_REMOTE_HOST_NOT_SPECIFIED', {...allowlist, entries: [first, second]});
  expectFailure({V2S_DEV_REMOTE_HOST: second.host, V2S_DEV_REMOTE_HOST_SHA256: second.fingerprint}, 'R5_DEV_REMOTE_HOST_NOT_ALLOWLISTED');
  expectFailure({V2S_DEV_REMOTE_HOST: first.host, V2S_DEV_REMOTE_HOST_SHA256: '0'.repeat(64)}, 'R5_DEV_REMOTE_HOST_BINDING_INVALID');
  expectFailure({V2S_DEV_REMOTE_HOST: second.host, V2S_DEV_REMOTE_HOST_SHA256: 'c'.repeat(64)}, 'R5_DEV_REMOTE_HOST_NOT_ALLOWLISTED');
  const rotated = {...allowlist, version: 'test-v2', entries: [second]};
  if (resolveTrustedRemoteHost({V2S_DEV_REMOTE_HOST: second.host, V2S_DEV_REMOTE_HOST_SHA256: second.fingerprint}, {allowlist: rotated}).allowlistVersion !== 'test-v2') throw new Error('R5_REMOTE_HOST_SELF_TEST_ROTATION');
  process.stdout.write('R5_REMOTE_HOST_TRUST_SELF_TEST=PASS\nRED=MISSING_MULTI_ENTRY_HOST,UNKNOWN_HOST,WRONG_FINGERPRINT,ATTACKER_HOST_HASH,LEGAL_ROTATION\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === '--self-test') selfTest();

import {describe, expect, it} from 'vitest';
import {isSameManagedDevDataPlane} from '../fixtures/terminalActivation.js';

const priorManifest = {
  kind: 'r5-dev-run-manifest',
  runId: 'r5-dev-prior',
  database: 'jdbc:postgresql://127.0.0.1:5432/catering_v2s_dev_r5_full',
  topology: {java: 'REMOTE_TRUSTED_HOST', tds: 'REMOTE_TRUSTED_HOST'},
  remoteHostTrust: {host: 'catering-remote-dev', fingerprint: 'host-fingerprint'},
  remoteResources: {host: 'catering-remote-dev', bootId: 'remote-boot'},
};

const currentManifest = {
  ...priorManifest,
  runId: 'r5-dev-current',
  readiness: {remoteJava: {remoteIdentity: {bootId: 'remote-boot'}}},
};

describe('managed DEV fixture ownership continuity', () => {
  it('accepts the current managed run identity for a fixture owned during that same run', () => {
    const sameRunManifest = {...priorManifest};

    expect(isSameManagedDevDataPlane(sameRunManifest, sameRunManifest)).toBe(true);
  });

  it('accepts a restarted managed run for the same database and remote host identity', () => {
    expect(isSameManagedDevDataPlane(priorManifest, currentManifest)).toBe(true);
  });

  it.each([
    ['database', {...currentManifest, database: 'jdbc:postgresql://different/catering_v2s_dev_r5_full'}],
    ['remote host', {...currentManifest, remoteHostTrust: {host: 'other-host', fingerprint: 'host-fingerprint'}}],
    ['host fingerprint', {...currentManifest, remoteHostTrust: {host: 'catering-remote-dev', fingerprint: 'other-fingerprint'}}],
    ['host boot', {
      ...currentManifest,
      remoteResources: {host: 'catering-remote-dev', bootId: 'other-boot'},
      readiness: {remoteJava: {remoteIdentity: {bootId: 'other-boot'}}},
    }],
    ['topology', {...currentManifest, topology: {java: 'LOCAL_HOST'}}],
  ])('rejects a changed %s', (_reason, changed) => {
    expect(isSameManagedDevDataPlane(priorManifest, changed)).toBe(false);
  });
});

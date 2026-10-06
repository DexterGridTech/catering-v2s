import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {priorManifestOwnsActiveBinding} from '../fixtures/terminalActivation.js';

const temporaryRoots: string[] = [];

const managedDevManifest = Object.freeze({
  kind: 'r5-dev-run-manifest',
  runId: 'managed-dev-1',
  database: 'jdbc:postgresql://127.0.0.1/dev',
  remoteHostTrust: {host: 'dev-host', fingerprint: 'fingerprint', allowlistVersion: 'v1'},
  topology: {java: 'remote', tds: 'remote', haproxy: 'remote', database: 'remote', tunnel: 'managed'},
  remoteResources: {bootId: 'boot-1'},
});

const writePriorRun = (
  root: string,
  input: Readonly<{runId: string; bindingGeneration?: number; business?: 'PASS' | 'FAIL'}>,
): void => {
  const directory = path.join(root, '.runtime/terminal-automation', input.runId);
  mkdirSync(directory, {recursive: true});
  writeFileSync(
    path.join(directory, 'run-manifest.json'),
    JSON.stringify({
      kind: 'terminal-automation-run-manifest',
      runId: input.runId,
      business: input.business ?? 'PASS',
      execution: {platform: 'android', deviceSerial: 'emulator-1'},
      managedDev: {runId: managedDevManifest.runId},
      fixture: {
        activationIntent: true,
        seedKey: 'term-handheld',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        deviceId: 'device-1',
        ...(input.bindingGeneration === undefined ? {} : {bindingGeneration: input.bindingGeneration}),
      },
    }),
  );
};

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, {recursive: true, force: true});
});

describe('priorManifestOwnsActiveBinding', () => {
  it('prefers one exact generation owner over older incomplete intents for the same fixture', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'terminal-automation-owner-'));
    temporaryRoots.push(root);
    mkdirSync(path.join(root, '.runtime/r5'), {recursive: true});
    mkdirSync(path.join(root, '.runtime/terminal-automation'), {recursive: true});
    writeFileSync(path.join(root, '.runtime/r5/run-manifest.json'), JSON.stringify(managedDevManifest));
    writePriorRun(root, {runId: 'exact-run', bindingGeneration: 19});
    writePriorRun(root, {runId: 'older-intent'});

    const result = priorManifestOwnsActiveBinding(root, {
      managedDevRunId: 'managed-dev-1',
      fixture: {
        seedKey: 'term-handheld',
        storeKey: 'store-operating',
        name: '移动点餐终端',
        deviceType: 'mobile',
        activationCode: '62000004',
      },
      terminalRef: 'terminal-1',
      storeRef: 'store-1',
      binding: {
        name: 'handheld',
        terminalRef: 'terminal-1',
        storeRef: 'store-1',
        bindingStatus: 'ACTIVE',
        generation: 19,
        boundDeviceId: 'device-1',
      },
      appDeviceId: 'device-1',
    });

    expect(result).toEqual({
      owned: true,
      evidence: 'prior=2 exactGeneration=1 legacyAndroid=0 currentGeneration=19',
    });
  });
});

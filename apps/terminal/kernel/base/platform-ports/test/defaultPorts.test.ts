import {describe, expect, it, vi} from 'vitest';

import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  consoleLoggerBinding,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailablePersistSecurePort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type LogEvent,
  type LogLevel,
  type PortAccepted,
  type PortResult,
} from '@catering-v2s/kernel-base-platform-ports';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';

const call = {timeoutMs: 20};
const storageCall = {};

const expectUnavailable = <TValue>(
  result: PortResult<TValue> | PortAccepted<string>,
  port: string,
  capability: string,
): void => {
  expect(result.status).toBe('unavailable');
  if (result.status === 'unavailable') {
    expect(result.port).toBe(port);
    expect(result.capability).toBe(capability);
    expect(result.reason).toBe('ADAPTER_NOT_INJECTED');
    expect(result.message).toContain(`${port}.${capability}`);
  }
};

describe('D-1/D-2: usable defaults', () => {
  it('writes one sanitized event for every level in every environment', () => {
    const consoleMethods: Record<LogLevel, ReturnType<typeof vi.spyOn>> = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => undefined),
      info: vi.spyOn(console, 'info').mockImplementation(() => undefined),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      error: vi.spyOn(console, 'error').mockImplementation(() => undefined),
    };
    const levels: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];
    try {
      for (const environmentMode of ['DEV', 'TEST', 'PROD'] as const) {
        const logger = createPlatformPorts({
          environmentMode,
          bindings: {
            logger: consoleLoggerBinding,
            persistKv: createProcessMemoryStateStoragePort(),
            persistSecure: unavailablePersistSecurePort,
            device: unavailableDevicePort,
            appControl: unavailableAppControlPort,
            script: unavailableScriptPort,
            connector: unavailableConnectorPort,
            hotUpdate: unavailableHotUpdatePort,
            logUpload: unavailableLogUploadPort,
            topologyHost: unavailableTopologyHostPort,
          },
        }).logger;
        for (const level of levels) {
          consoleMethods[level].mockClear();
          const result = logger[level]({
            category: 'default',
            event: environmentMode,
            message: 'phone 13800138000',
            data: {token: 'token-secret', safe: 'keep-me'},
          });
          expect(result.status).toBe('succeeded');
          expect(consoleMethods[level]).toHaveBeenCalledTimes(1);
          const emitted = consoleMethods[level].mock.calls[0]?.[0] as LogEvent | undefined;
          expect(emitted).toMatchObject({
            level,
            security: {containsSensitiveRaw: true, maskingMode: 'masked'},
            data: {safe: 'keep-me'},
          });
          expect(JSON.stringify(emitted)).not.toContain('13800138000');
          expect(JSON.stringify(emitted)).not.toContain('token-secret');
        }
      }
    } finally {
      for (const method of Object.values(consoleMethods)) method.mockRestore();
    }
  });

  it('provides a usable process-memory string KV with explicit missing state', async () => {
    const storage = createProcessMemoryStateStoragePort();
    expect(await storage.read({key: 'missing'})).toEqual({
      status: 'succeeded',
      value: {state: 'missing'},
      completedAt: expect.any(Number),
    });
    expect((await storage.write({key: 'alpha', value: 'one'})).status).toBe('succeeded');
    expect(await storage.read({key: 'alpha'})).toMatchObject({
      status: 'succeeded',
      value: {state: 'found', value: 'one'},
    });
    expect(
      await storage.writeMany({
        entries: [
          {key: 'beta', value: 'two'},
          {key: 'gamma', value: 'three'},
        ],
      }),
    ).toMatchObject({status: 'succeeded'});
    expect(await storage.readMany({keys: ['alpha', 'missing', 'beta']})).toMatchObject({
      status: 'succeeded',
      value: [
        {key: 'alpha', result: {state: 'found', value: 'one'}},
        {key: 'missing', result: {state: 'missing'}},
        {key: 'beta', result: {state: 'found', value: 'two'}},
      ],
    });
    expect(await storage.listKeys(storageCall)).toMatchObject({status: 'succeeded', value: ['alpha', 'beta', 'gamma']});
    expect((await storage.remove({key: 'alpha'})).status).toBe('succeeded');
    expect((await storage.removeMany({keys: ['beta', 'gamma']})).status).toBe('succeeded');
    expect((await storage.clear(storageCall)).status).toBe('succeeded');
    expect(await storage.listKeys(storageCall)).toMatchObject({status: 'succeeded', value: []});
  });
});

describe('D-3/D-4/D-5/D-6/D-7/D-8/D-9/D-10: unavailable defaults', () => {
  it('returns a typed unavailable result for every secure-storage method', async () => {
    const input = {key: 'x'};
    expectUnavailable(await unavailablePersistSecurePort.read(input), 'persistSecure', 'read');
    expectUnavailable(await unavailablePersistSecurePort.write({...input, value: 'x'}), 'persistSecure', 'write');
    expectUnavailable(await unavailablePersistSecurePort.remove(input), 'persistSecure', 'remove');
    expectUnavailable(await unavailablePersistSecurePort.readMany({keys: ['x']}), 'persistSecure', 'readMany');
    expectUnavailable(
      await unavailablePersistSecurePort.writeMany({entries: [{key: 'x', value: 'x'}]}),
      'persistSecure',
      'writeMany',
    );
    expectUnavailable(await unavailablePersistSecurePort.removeMany({keys: ['x']}), 'persistSecure', 'removeMany');
    expectUnavailable(await unavailablePersistSecurePort.listKeys(storageCall), 'persistSecure', 'listKeys');
    expectUnavailable(await unavailablePersistSecurePort.clear(storageCall), 'persistSecure', 'clear');
  });

  it('returns unavailable for every device method without invoking callbacks', async () => {
    const listener = vi.fn();
    const onError = vi.fn();
    expectUnavailable(await unavailableDevicePort.getDeviceInfo(call), 'device', 'getDeviceInfo');
    expectUnavailable(await unavailableDevicePort.getDisplayInfo(call), 'device', 'getDisplayInfo');
    expectUnavailable(await unavailableDevicePort.getSystemStatus(call), 'device', 'getSystemStatus');
    expectUnavailable(await unavailableDevicePort.getNetworkStatus(call), 'device', 'getNetworkStatus');
    expectUnavailable(
      await unavailableDevicePort.subscribeNetworkStatus({...call, listener, onError}),
      'device',
      'subscribeNetworkStatus',
    );
    expectUnavailable(
      await unavailableDevicePort.unsubscribeNetworkStatus({...call, subscriptionId: 'network-sub'}),
      'device',
      'unsubscribeNetworkStatus',
    );
    expectUnavailable(await unavailableDevicePort.getPowerStatus(call), 'device', 'getPowerStatus');
    expectUnavailable(
      await unavailableDevicePort.subscribePowerStatus({...call, listener, onError}),
      'device',
      'subscribePowerStatus',
    );
    expectUnavailable(
      await unavailableDevicePort.unsubscribePowerStatus({...call, subscriptionId: 'sub'}),
      'device',
      'unsubscribePowerStatus',
    );
    expect(listener).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('returns unavailable for every app-control method', async () => {
    const requestId = createRequestId();
    expectUnavailable(await unavailableAppControlPort.resetRuntime({...call, requestId}), 'appControl', 'resetRuntime');
    expectUnavailable(
      await unavailableAppControlPort.exitApplication({...call, requestId}),
      'appControl',
      'exitApplication',
    );
    expectUnavailable(await unavailableAppControlPort.clearHostDataCache(call), 'appControl', 'clearHostDataCache');
    expectUnavailable(
      await unavailableAppControlPort.setFullscreen({...call, containerKey: 'primary', enabled: true}),
      'appControl',
      'setFullscreen',
    );
    expectUnavailable(
      await unavailableAppControlPort.getFullscreen({...call, containerKey: 'primary'}),
      'appControl',
      'getFullscreen',
    );
    expectUnavailable(
      await unavailableAppControlPort.setKioskMode({...call, enabled: true}),
      'appControl',
      'setKioskMode',
    );
    expectUnavailable(await unavailableAppControlPort.getKioskMode(call), 'appControl', 'getKioskMode');
    expectUnavailable(
      await unavailableAppControlPort.showNativeLoading({...call, containerKey: 'primary', message: 'loading'}),
      'appControl',
      'showNativeLoading',
    );
    expectUnavailable(
      await unavailableAppControlPort.hideNativeLoading({...call, containerKey: 'primary'}),
      'appControl',
      'hideNativeLoading',
    );
  });

  it('returns unavailable for every script and connector method without fallback execution', async () => {
    const invoke = vi.fn();
    const requestId = createRequestId();
    expectUnavailable(
      await unavailableScriptPort.execute({
        source: 'return 1',
        paramsJson: '{}',
        globalsJson: '{}',
        native: {kind: 'named', functionNames: ['f'], invoke},
        timeoutMs: 20,
      }),
      'script',
      'execute',
    );
    expectUnavailable(await unavailableScriptPort.getStats(call), 'script', 'getStats');
    expectUnavailable(await unavailableScriptPort.clearStats(call), 'script', 'clearStats');
    expect(invoke).not.toHaveBeenCalled();
    expectUnavailable(
      await unavailableConnectorPort.call({
        requestId,
        channel: {channelKey: 'x'},
        action: 'read',
        payload: {},
        timeoutMs: 20,
      }),
      'connector',
      'call',
    );
    expectUnavailable(
      await unavailableConnectorPort.subscribe({
        channel: {channelKey: 'x'},
        onMessage: vi.fn(),
        onError: vi.fn(),
        timeoutMs: 20,
      }),
      'connector',
      'subscribe',
    );
    expectUnavailable(
      await unavailableConnectorPort.unsubscribe({subscriptionId: 'sub', timeoutMs: 20}),
      'connector',
      'unsubscribe',
    );
    expectUnavailable(
      await unavailableConnectorPort.on({eventName: 'event', handler: vi.fn(), onError: vi.fn(), timeoutMs: 20}),
      'connector',
      'on',
    );
  });

  it('returns unavailable for every hot-update, upload, and topology method', async () => {
    const hotInput = {
      timeoutMs: 20,
      releaseId: 'release',
      packageId: 'package',
      bundleVersion: '1',
      packageUrls: ['https://example.invalid/package'],
      packageSha256: 'package-hash',
      manifestSha256: 'manifest-hash',
      packageSizeBytes: 1,
    };
    expectUnavailable(await unavailableHotUpdatePort.downloadPackage(hotInput), 'hotUpdate', 'downloadPackage');
    expectUnavailable(
      await unavailableHotUpdatePort.writeBootMarker({
        ...hotInput,
        installDirectory: '/tmp',
        entryFile: 'index.js',
        maxLaunchFailures: 1,
        healthCheckTimeoutMs: 10,
      }),
      'hotUpdate',
      'writeBootMarker',
    );
    expectUnavailable(await unavailableHotUpdatePort.readBootMarker(call), 'hotUpdate', 'readBootMarker');
    expectUnavailable(await unavailableHotUpdatePort.readActiveMarker(call), 'hotUpdate', 'readActiveMarker');
    expectUnavailable(await unavailableHotUpdatePort.readRollbackMarker(call), 'hotUpdate', 'readRollbackMarker');
    expectUnavailable(await unavailableHotUpdatePort.clearBootMarker(call), 'hotUpdate', 'clearBootMarker');
    expectUnavailable(await unavailableHotUpdatePort.confirmLoadComplete(call), 'hotUpdate', 'confirmLoadComplete');
    expectUnavailable(
      await unavailableLogUploadPort.uploadLogsForDate({
        uploadUrl: 'https://example.invalid',
        logDate: '2026-08-30',
        surfaceIndex: 0,
        surfaceRole: 'primary',
        overwrite: false,
        headers: {},
        timeoutMs: 20,
      }),
      'logUpload',
      'uploadLogsForDate',
    );
    expectUnavailable(
      await unavailableTopologyHostPort.start({
        port: 8080,
        basePath: '/',
        heartbeatIntervalMs: 1000,
        heartbeatTimeoutMs: 3000,
        timeoutMs: 20,
      }),
      'topologyHost',
      'start',
    );
    expectUnavailable(await unavailableTopologyHostPort.stop(call), 'topologyHost', 'stop');
    expectUnavailable(await unavailableTopologyHostPort.getStatus(call), 'topologyHost', 'getStatus');
    expectUnavailable(
      await unavailableTopologyHostPort.getDiagnosticsSnapshot(call),
      'topologyHost',
      'getDiagnosticsSnapshot',
    );
  });
});

import {describe, expect, it, vi} from 'vitest';

import {
  consoleLoggerBinding,
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  describePlatformPortCapabilities,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailablePersistSecurePort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type PlatformPortBindings,
} from '@catering-v2s/kernel-base-platform-ports';

describe('A: platform port assembly', () => {
  it('assembles all ten keys, preserves injected identities, and freezes the root', () => {
    const persistKv = createProcessMemoryStateStoragePort();
    const sink = vi.fn();
    const bindings: PlatformPortBindings = {
      logger: {kind: 'sink', write: sink},
      persistKv,
      persistSecure: unavailablePersistSecurePort,
      device: unavailableDevicePort,
      appControl: unavailableAppControlPort,
      script: unavailableScriptPort,
      connector: unavailableConnectorPort,
      hotUpdate: unavailableHotUpdatePort,
      logUpload: unavailableLogUploadPort,
      topologyHost: unavailableTopologyHostPort,
    };

    const ports = createPlatformPorts({environmentMode: 'TEST', bindings});

    expect(Object.keys(ports)).toEqual([
      'logger',
      'persistKv',
      'persistSecure',
      'device',
      'appControl',
      'script',
      'connector',
      'hotUpdate',
      'logUpload',
      'topologyHost',
    ]);
    expect(Object.isFrozen(ports)).toBe(true);
    expect(ports.persistKv).toBe(persistKv);
    expect(ports.persistSecure).toBe(unavailablePersistSecurePort);
    expect(ports.device).toBe(unavailableDevicePort);
    expect(ports.appControl).toBe(unavailableAppControlPort);
    expect(ports.script).toBe(unavailableScriptPort);
    expect(ports.connector).toBe(unavailableConnectorPort);
    expect(ports.hotUpdate).toBe(unavailableHotUpdatePort);
    expect(ports.logUpload).toBe(unavailableLogUploadPort);
    expect(ports.topologyHost).toBe(unavailableTopologyHostPort);
    expect(Reflect.set(ports, 'device', persistKv)).toBe(false);
    const mutablePorts = ports as {device: typeof ports.device};
    expect(() => {
      mutablePorts.device = unavailableDevicePort;
    }).toThrow(TypeError);
    expect(ports.device).toBe(unavailableDevicePort);
    expect('environmentMode' in ports).toBe(false);
  });

  it('keeps method-level capability descriptors scoped to the development build', () => {
    const ports = createPlatformPorts({
      environmentMode: 'PROD',
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
    });

    const descriptors = describePlatformPortCapabilities(ports);
    expect(descriptors).toHaveLength(10);
    expect(Object.isFrozen(descriptors)).toBe(true);
    if (__DEV__) {
      expect(descriptors.every(descriptor => descriptor.descriptorStatus === 'complete')).toBe(true);
      expect(descriptors.find(descriptor => descriptor.port === 'device')).toMatchObject({
        capabilities: expect.arrayContaining([
          {capability: 'getDeviceInfo', state: 'unavailable', source: 'default'},
          {capability: 'getDisplayInfo', state: 'unavailable', source: 'default'},
        ]),
      });
      expect(descriptors.find(descriptor => descriptor.port === 'persistKv')).toMatchObject({
        capabilities: expect.arrayContaining([
          {capability: 'read', state: 'real', source: 'default'},
        ]),
      });
    } else {
      expect(descriptors.every(descriptor => descriptor.descriptorStatus === 'missing-descriptor')).toBe(true);
      expect(descriptors.every(descriptor => descriptor.capabilities.length === 0)).toBe(true);
    }
  });
});

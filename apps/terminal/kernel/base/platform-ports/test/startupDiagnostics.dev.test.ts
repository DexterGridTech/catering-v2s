import {describe, expect, it, vi} from 'vitest';
import {
  consoleLoggerBinding,
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableUpdatePort,
  unavailableLogUploadPort,
  unavailablePersistSecurePort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type LogEvent,
  type PlatformPortBindings,
} from '../src/index';

const bindings = (): PlatformPortBindings => ({
  logger: consoleLoggerBinding,
  persistKv: createProcessMemoryStateStoragePort(),
  persistSecure: unavailablePersistSecurePort,
  device: unavailableDevicePort,
  appControl: unavailableAppControlPort,
  script: unavailableScriptPort,
  connector: unavailableConnectorPort,
  update: unavailableUpdatePort,
  logUpload: unavailableLogUploadPort,
  topologyHost: unavailableTopologyHostPort,
});

const startupEventsFrom = (calls: readonly unknown[][]): LogEvent[] =>
  calls
    .map(call => call[0])
    .filter(
      (event): event is LogEvent =>
        typeof event === 'object' &&
        event !== null &&
        'category' in event &&
        typeof event.category === 'string' &&
        event.category.startsWith('startup.'),
    );

describe('platform-ports startup diagnostics', () => {
  it('allocates a distinct runtime-scoped startup id only in dev', () => {
    const first = createPlatformPorts({environmentMode: 'DEV', bindings: bindings()});
    const second = createPlatformPorts({environmentMode: 'DEV', bindings: bindings()});

    if (!__DEV__) {
      expect(first.startupRunId).toBeUndefined();
      expect(second.startupRunId).toBeUndefined();
      return;
    }

    expect(first.startupRunId, 'DEV_STARTUP_RUN_ID_MISSING').toBeDefined();
    expect(second.startupRunId).toBeDefined();
    expect(first.startupRunId).not.toBe(second.startupRunId);
  });

  it('keeps descriptors private and emits one correlated startup sequence in dev', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      const ports = createPlatformPorts({environmentMode: 'DEV', bindings: bindings()});
      if (!__DEV__) {
        expect(startupEventsFrom(info.mock.calls)).toHaveLength(0);
        return;
      }
      ports.logger.info({category: 'startup.modules', event: 'startup.modules', data: {count: 1}});
      ports.logger.info({category: 'startup.slices', event: 'startup.slices', data: {count: 0}});
      ports.logger.info({category: 'startup.commands', event: 'startup.commands', data: {count: 1}});
      ports.logger.info({category: 'startup.actors', event: 'startup.actors', data: {count: 0}});
      ports.logger.info({category: 'startup.parts', event: 'startup.parts', data: {count: 1}});
      ports.logger.info({
        category: 'startup.surfaces',
        event: 'startup.surfaces.declared',
        data: {kind: 'declared', displayMode: 'PRIMARY', width: 1280, height: 800},
      });
      ports.logger.info({
        category: 'startup.surfaces',
        event: 'startup.surfaces.measured',
        data: {
          kind: 'measured',
          displayMode: 'PRIMARY',
          width: 1280,
          height: 800,
          ready: true,
          orientation: 'landscape',
        },
      });

      const events = startupEventsFrom(info.mock.calls);
      expect(
        events.map(event => event.category),
        'DEV_STARTUP_EVENT_SEQUENCE_MISMATCH',
      ).toEqual([
        'startup.ports',
        'startup.modules',
        'startup.slices',
        'startup.commands',
        'startup.actors',
        'startup.parts',
        'startup.surfaces',
        'startup.surfaces',
      ]);
      const runIds = new Set(events.map(event => event.data?.startupRunId));
      expect(runIds.size).toBe(1);
      expect(events.map(event => event.data?.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(events.some(event => event.category === 'startup.complete')).toBe(false);
      const portsEvent = events[0];
      expect(portsEvent.data).toMatchObject({portCount: 10, descriptorStatus: 'complete'});
      const descriptors = portsEvent.data?.descriptors;
      expect(Array.isArray(descriptors)).toBe(true);
      expect(descriptors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({port: 'persistKv', descriptorStatus: 'complete'}),
          expect.objectContaining({port: 'device', descriptorStatus: 'complete'}),
        ]),
      );
    } finally {
      info.mockRestore();
    }
  });

  it('follows the compile-time startup diagnostics branch', () => {
    const events: LogEvent[] = [];
    const portBindings: PlatformPortBindings = {
      ...bindings(),
      logger: {
        kind: 'sink',
        write: (event: LogEvent) => {
          events.push(event);
        },
      },
    };
    const ports = createPlatformPorts({environmentMode: 'PROD', bindings: portBindings});
    if (!__DEV__) {
      expect(events.filter(event => event.category.startsWith('startup.'))).toHaveLength(0);
      return;
    }
    ports.logger.info({category: 'startup.modules', event: 'startup.modules', data: {count: 1}});
    ports.logger.info({category: 'startup.slices', event: 'startup.slices', data: {count: 0}});
    ports.logger.info({category: 'startup.commands', event: 'startup.commands', data: {count: 1}});
    ports.logger.info({category: 'startup.actors', event: 'startup.actors', data: {count: 0}});
    ports.logger.info({category: 'startup.parts', event: 'startup.parts', data: {count: 1}});
    const startupEvents = events.filter(event => event.category.startsWith('startup.'));
    expect(startupEvents).toHaveLength(6);
    expect(startupEvents.every(event => typeof event.data?.startupRunId === 'string')).toBe(true);
    expect(startupEvents.map(event => event.data?.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

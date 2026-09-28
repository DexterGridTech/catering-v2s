import {describe, expect, it, vi} from 'vitest';

import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailablePersistSecurePort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type LogEvent,
  type LogWriteInput,
  type PlatformPortBindings,
} from '@catering-v2s/kernel-base-platform-ports';

const bindingsFor = (write: (event: LogEvent) => void): PlatformPortBindings => ({
  logger: {kind: 'sink', write},
  persistKv: createProcessMemoryStateStoragePort(),
  persistSecure: unavailablePersistSecurePort,
  device: unavailableDevicePort,
  appControl: unavailableAppControlPort,
  script: unavailableScriptPort,
  connector: unavailableConnectorPort,
  hotUpdate: unavailableHotUpdatePort,
  logUpload: unavailableLogUploadPort,
  topologyHost: unavailableTopologyHostPort,
});

const nonStartupEvents = (events: readonly LogEvent[]): LogEvent[] =>
  events.filter(event => !event.category.startsWith('startup.'));

const sensitiveInput: LogWriteInput = {
  category: 'security',
  event: 'fixture',
  message: 'phone 13800138000 and Bearer abc.def.ghi',
  data: {
    password: 'secret-password',
    passwordHash: '0123456789abcdef0123456789abcdef',
    token: 'token-secret-value',
    cookie: 'sid=secret',
    authorization: 'Bearer abc.def.ghi',
    otp: '123456',
    username: 'dexter',
    ip: '127.0.0.1',
    rawPayload: '{"phone":"13800138000"}',
    note: 'token-secret-value',
    ordinary: 'keep-me',
  },
  error: {message: 'account exists for login=dexter'},
};

describe('L: one sanitizer for all logger entry points and environments', () => {
  it('masks sensitive message/data/error values in DEV, TEST, and PROD', () => {
    for (const environmentMode of ['DEV', 'TEST', 'PROD'] as const) {
      const events: LogEvent[] = [];
      const ports = createPlatformPorts({
        environmentMode,
        bindings: bindingsFor(event => events.push(event)),
      });
      const result = ports.logger.info(sensitiveInput);
      expect(result.status).toBe('succeeded');
      const userEvents = nonStartupEvents(events);
      expect(userEvents).toHaveLength(1);
      const event = userEvents[0];
      expect(event).toBeDefined();
      const serialized = JSON.stringify(event);
      for (const raw of [
        '13800138000',
        'secret-password',
        '0123456789abcdef0123456789abcdef',
        'token-secret-value',
        'sid=secret',
        'abc.def.ghi',
        '123456',
        'dexter',
        '127.0.0.1',
        'account exists',
      ]) {
        expect(serialized).not.toContain(raw);
      }
      expect(event?.security).toEqual({containsSensitiveRaw: true, maskingMode: 'masked'});
      expect(event?.data?.ordinary).toBe('keep-me');
    }
  });

  it('uses the same sanitizer for every level and derived scope/context logger', () => {
    const events: LogEvent[] = [];
    const ports = createPlatformPorts({environmentMode: 'TEST', bindings: bindingsFor(event => events.push(event))});
    expect(ports.logger.debug(sensitiveInput).status).toBe('succeeded');
    expect(ports.logger.info(sensitiveInput).status).toBe('succeeded');
    expect(ports.logger.warn(sensitiveInput).status).toBe('succeeded');
    expect(ports.logger.error(sensitiveInput).status).toBe('succeeded');
    expect(
      ports.logger.scope({moduleName: 'derived'}).withContext({commandName: 'fixture'}).info(sensitiveInput).status,
    ).toBe('succeeded');
    const userEvents = nonStartupEvents(events);
    expect(userEvents).toHaveLength(5);
    expect(userEvents.every(event => event.security.containsSensitiveRaw)).toBe(true);
    expect(userEvents.every(event => !JSON.stringify(event).includes('13800138000'))).toBe(true);
  });

  it('keeps non-sensitive values and reports sink failures as typed failures', () => {
    const events: LogEvent[] = [];
    const ports = createPlatformPorts({environmentMode: 'TEST', bindings: bindingsFor(event => events.push(event))});
    const safe = ports.logger.info({
      category: 'safe',
      event: 'fixture',
      message: 'hello',
      data: {count: 1, status: 'ok'},
      error: {message: 'safe'},
    });
    expect(safe).toMatchObject({
      status: 'succeeded',
      value: {message: 'hello', data: {count: 1, status: 'ok'}, security: {containsSensitiveRaw: false}},
    });

    const failing = createPlatformPorts({
      environmentMode: 'TEST',
      bindings: bindingsFor(() => {
        throw new Error('sink failure');
      }),
    }).logger.info({category: 'failure', event: 'fixture'});
    expect(failing).toMatchObject({
      status: 'failed',
      port: 'logger',
      capability: 'info',
      error: {code: 'LOGGER_SINK_WRITE_FAILED'},
    });
  });

  it('preserves safe diagnostic hashes, versions, and balances while masking unsafe values', () => {
    const events: LogEvent[] = [];
    const ports = createPlatformPorts({environmentMode: 'TEST', bindings: bindingsFor(event => events.push(event))});
    const packageSha256 = 'a'.repeat(64);
    const manifestSha256 = 'b'.repeat(64);
    const result = ports.logger.info({
      category: 'diagnostic',
      event: 'hot-update',
      data: {
        packageSha256,
        manifestSha256,
        bundleVersion: '1.2.3.4',
        accountBalance: '123.45',
        unrelatedHash: 'c'.repeat(64),
        account: 'operator-1',
      },
    });
    expect(result.status).toBe('succeeded');
    const userEvents = nonStartupEvents(events);
    expect(userEvents).toHaveLength(1);
    const event = userEvents[0];
    expect(event?.data).toMatchObject({
      packageSha256,
      manifestSha256,
      bundleVersion: '1.2.3.4',
      accountBalance: '123.45',
    });
    expect(event?.data?.unrelatedHash).toBe('[REDACTED:hash]');
    expect(event?.data?.account).toBe('[REDACTED:account]');
    expect(event?.security.containsSensitiveRaw).toBe(true);
  });

  it('sanitizes the closed LogContext commandName through the same funnel', () => {
    const events: LogEvent[] = [];
    const ports = createPlatformPorts({environmentMode: 'TEST', bindings: bindingsFor(event => events.push(event))});
    const context = Object.assign({commandName: 'Bearer context-secret'}, {extra: 'Bearer extra-secret'});
    const result = ports.logger.withContext(context).info({
      category: 'context',
      event: 'fixture',
      message: 'safe',
    });
    expect(result.status).toBe('succeeded');
    const userEvents = nonStartupEvents(events);
    expect(userEvents).toHaveLength(1);
    expect(userEvents[0]?.context?.commandName).toBe('[REDACTED:authorization]');
    expect(userEvents[0]?.context).not.toHaveProperty('extra');
    expect(userEvents[0]?.security.containsSensitiveRaw).toBe(true);
    expect(JSON.stringify(userEvents[0])).not.toContain('context-secret');
    expect(JSON.stringify(userEvents[0])).not.toContain('extra-secret');
  });

  it('counts sensitive error name and code as raw-sensitive input', () => {
    const events: LogEvent[] = [];
    const ports = createPlatformPorts({environmentMode: 'TEST', bindings: bindingsFor(event => events.push(event))});
    const result = ports.logger.error({
      category: 'security',
      event: 'error-code',
      error: {
        name: 'Bearer raw.name.token',
        code: 'cookie=sid.raw',
        message: 'safe error message',
      },
    });
    expect(result.status).toBe('succeeded');
    const userEvents = nonStartupEvents(events);
    expect(userEvents).toHaveLength(1);
    expect(userEvents[0]?.security.containsSensitiveRaw).toBe(true);
    expect(JSON.stringify(userEvents[0])).not.toContain('raw.name.token');
    expect(JSON.stringify(userEvents[0])).not.toContain('sid.raw');
  });
});

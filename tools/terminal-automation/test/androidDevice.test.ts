import {mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {Client, DeviceClient} from '@devicefarmer/adbkit';
import {collectAndroidRuntimeFailureDiagnostics} from '../src/androidAppDiagnostics.js';
import {createAndroidDeviceSession, managedDevServiceReverses} from '../src/androidDevice.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true});
});

const createClient = (
  input: Readonly<{readonly deviceId?: string; readonly reverseList?: {remote: string; local: string}[]}>,
) => {
  const reverses = [...(input.reverseList ?? [])];
  const device = {
    listReverses: vi.fn(async () => reverses.map(reverse => ({...reverse}))),
    reverse: vi.fn(async (remote: string, local: string) => {
      reverses.push({remote, local});
      return true;
    }),
    install: vi.fn(async () => true),
    startActivity: vi.fn(async () => true),
  };
  const client = {
    listDevices: vi.fn(async () => [{id: input.deviceId ?? 'emulator-5554', type: 'emulator'}]),
    getDevice: vi.fn(() => device),
  };
  return {
    client: client as unknown as Client,
    device: device as unknown as DeviceClient,
    startActivity: device.startActivity,
    reverses,
  };
};

const repository = (): Readonly<{readonly root: string; readonly apk: string}> => {
  const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-android-'));
  roots.push(root);
  const apk = path.join(root, 'build/app.apk');
  mkdirSync(path.dirname(apk), {recursive: true});
  writeFileSync(apk, 'fixture-apk');
  return {root, apk};
};

describe('createAndroidDeviceSession', () => {
  it('reads only structured Runtime failure identifiers from the selected app process', async () => {
    const repo = repository();
    const context = createClient({});
    const calls: string[][] = [];
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: repo.root,
      adbPath: '/usr/bin/adb',
      runTextCommand: async (_adb, args) => {
        calls.push([...args]);
        if (args.includes('pidof')) return '1234';
        return [
          'E/ReactNativeJS( 1234): ' +
            JSON.stringify({
              level: 'error',
              category: 'runtime.lifecycle',
              event: 'runtime.start.failed',
              error: {name: 'Runtime lifecycle failed', code: 'ERR_TER_RUNTIME_LIFECYCLE_FAILED'},
              data: {causeName: 'FixtureError', causeCode: 'ERR_FIXTURE_START'},
              message: 'sensitive fixture payload',
            }),
          'E/ReactNativeJS( 1234): ' + JSON.stringify({category: 'other', event: 'ignored'}),
        ].join('\n');
      },
    });
    const diagnostics = await session.readRuntimeFailureDiagnostics('com.example.terminal');
    expect(JSON.parse(diagnostics)).toEqual({
      category: 'runtime.lifecycle',
      event: 'runtime.start.failed',
      level: 'error',
      failureName: 'Runtime_lifecycle_failed',
      failureCode: 'ERR_TER_RUNTIME_LIFECYCLE_FAILED',
      causeName: 'FixtureError',
      causeCode: 'ERR_FIXTURE_START',
    });
    expect(diagnostics).not.toContain('sensitive fixture payload');
    expect(calls.at(-1)).toEqual([
      '-s',
      'emulator-5554',
      'shell',
      'logcat',
      '-d',
      '-v',
      'brief',
      '--pid',
      '1234',
      '-s',
      'ReactNativeJS:V',
      '*:S',
    ]);
  });

  it('projects the failing Runtime module and hook phase without exposing its message', () => {
    const diagnostics = collectAndroidRuntimeFailureDiagnostics(
      'E/ReactNativeJS( 1234): ' +
        JSON.stringify({
          category: 'runtime.lifecycle',
          event: 'runtime.module.hook.failed',
          data: {
            moduleName: 'kernel.base.server-config',
            phase: 'install',
            causeName: 'Error',
            causeCode: 'ERR_CONFIG',
          },
          error: {
            name: 'RuntimeModuleHookFailed',
            code: 'ERR_TER_RUNTIME_MODULE_INSTALL_FAILED',
            message: 'safe generic',
          },
          message: 'secret-bearing raw message',
        }),
    );
    expect(JSON.parse(diagnostics)).toEqual({
      category: 'runtime.lifecycle',
      event: 'runtime.module.hook.failed',
      moduleName: 'kernel.base.server-config',
      phase: 'install',
      causeName: 'Error',
      causeCode: 'ERR_CONFIG',
      failureName: 'RuntimeModuleHookFailed',
      failureCode: 'ERR_TER_RUNTIME_MODULE_INSTALL_FAILED',
    });
    expect(diagnostics).not.toContain('secret-bearing raw message');
  });

  it('projects Runtime command and actor identity plus only a stable cause code', () => {
    const diagnostics = collectAndroidRuntimeFailureDiagnostics(
      'E/ReactNativeJS( 1234): ' +
        JSON.stringify({
          category: 'runtime.lifecycle',
          event: 'runtime.actor.failed',
          data: {
            commandName: 'kernel.base.terminal-update.reconcile-native-facts',
            actorKey: 'kernel.base.terminal-update.update-owner',
            status: 'error',
            failureCode: 'ERR_TER_RUNTIME_COMMAND_EXECUTION_FAILED',
            causeName: 'Error',
            causeCode: 'TERMINAL_UPDATE_STATE_MISSING',
          },
          error: {name: 'RuntimeActorFailed', code: 'ERR_TER_RUNTIME_COMMAND_EXECUTION_FAILED', message: 'generic'},
          message: 'raw private stack or payload',
        }),
    );
    expect(JSON.parse(diagnostics)).toMatchObject({
      event: 'runtime.actor.failed',
      commandName: 'kernel.base.terminal-update.reconcile-native-facts',
      actorKey: 'kernel.base.terminal-update.update-owner',
      actorFailureCode: 'ERR_TER_RUNTIME_COMMAND_EXECUTION_FAILED',
      causeCode: 'TERMINAL_UPDATE_STATE_MISSING',
    });
    expect(diagnostics).not.toContain('raw private stack or payload');
  });

  it('projects safe transport HTTP failure metadata and omits request secrets and payloads', () => {
    const diagnostics = collectAndroidRuntimeFailureDiagnostics(
      'W/ReactNativeJS( 1234): ' +
        JSON.stringify({
          category: 'transport.connection',
          event: 'transport.connection.http-response-non-success',
          level: 'warn',
          data: {
            executionId: 'http-3',
            serverName: 'business',
            method: 'POST',
            stage: 'response',
            addressName: 'dev',
            revision: 'rev-7',
            status: 503,
            attemptNumber: 1,
            candidateCount: 2,
            elapsedMs: 17,
            safeRetryable: false,
            path: '/secret?token=value',
            authorization: 'Bearer secret',
            body: 'activation-secret',
          },
          message: 'do not forward this raw diagnostic',
        }),
    );
    expect(JSON.parse(diagnostics)).toEqual({
      category: 'transport.connection',
      event: 'transport.connection.http-response-non-success',
      level: 'warn',
      executionId: 'http-3',
      serverName: 'business',
      method: 'POST',
      stage: 'response',
      addressName: 'dev',
      configRevision: 'rev-7',
      status: 503,
      attemptNumber: 1,
      candidateCount: 2,
      elapsedMs: 17,
      retryable: false,
    });
    expect(diagnostics).not.toMatch(/secret|token=value|raw diagnostic/u);
  });

  it('projects only the build-time failure injection hit and boundary owner', () => {
    const diagnostics = collectAndroidRuntimeFailureDiagnostics(
      [
        'I/ReactNativeJS( 1234): ' +
          JSON.stringify({
            category: 'runtime.system-failure',
            event: 'runtime.system-failure.debug-injection-resolution',
            level: 'info',
            data: {
              ownerId: 'surface-content',
              source: 'build-time',
              outcome: 'matched',
              buildMarker: 'TER_DEBUG_FAILURE_INJECTION_BUNDLE_MARKER_SURFACE_CONTENT',
              secret: 'never-project',
            },
            message: 'never-project',
          }),
        'E/ReactNativeJS( 1234): ' +
          JSON.stringify({
            category: 'runtime.system-failure',
            event: 'runtime.system-failure.render-failed',
            level: 'error',
            data: {ownerId: 'surface-content', errorName: 'Error'},
            message: 'sensitive exception text',
          }),
      ].join('\n'),
    );

    expect(diagnostics.split('\n').map(line => JSON.parse(line))).toEqual([
      {
        category: 'runtime.system-failure',
        event: 'runtime.system-failure.debug-injection-resolution',
        level: 'info',
        ownerId: 'surface-content',
        source: 'build-time',
        outcome: 'matched',
        buildMarker: 'TER_DEBUG_FAILURE_INJECTION_BUNDLE_MARKER_SURFACE_CONTENT',
      },
      {
        category: 'runtime.system-failure',
        event: 'runtime.system-failure.render-failed',
        level: 'error',
        ownerId: 'surface-content',
        failureName: 'Error',
      },
    ]);
    expect(diagnostics).not.toMatch(/never-project|sensitive exception/u);
  });

  it('projects transport connection and owner failures with safe context only', () => {
    const diagnostics = collectAndroidRuntimeFailureDiagnostics(
      [
        'W/ReactNativeJS( 1234): ' +
          JSON.stringify({
            category: 'transport.connection',
            event: 'transport.connection.socket-error-observed',
            level: 'warn',
            data: {
              profileId: 'terminal-data-client:tds',
              addressName: 'dev-primary',
              revision: 4,
              connectionToken: 19,
              reasonCode: 'NETWORK_ERROR',
              reason: 'private-url-and-secret',
            },
            message: 'private-url-and-secret',
          }),
        'W/ReactNativeJS( 1234): ' +
          JSON.stringify({
            category: 'transport.connection',
            event: 'transport.connection.connect-attempt-failed',
            level: 'warn',
            data: {
              profileId: 'terminal-data-client:tds',
              stage: 'network-snapshot-read',
              candidateCount: 2,
              errorName: 'TypeError',
              errorCode: 'ECONNRESET',
              causeCode: 'EHOSTUNREACH',
              endpoint: 'https://private-host/?token=secret',
            },
          }),
        'W/ReactNativeJS( 1234): ' +
          JSON.stringify({
            category: 'transport.connection',
            event: 'transport.connection.internal-command-failed',
            level: 'warn',
            data: {
              profileId: 'terminal-data-client:tds',
              kind: 'retry',
              status: 'error',
              stateTransition: 'not-applied',
            },
          }),
      ].join('\n'),
    )
      .split('\n')
      .map(line => JSON.parse(line) as Record<string, unknown>);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        event: 'transport.connection.socket-error-observed',
        profileId: 'terminal-data-client:tds',
        addressName: 'dev-primary',
        configRevision: '4',
        connectionToken: 19,
        reasonCode: 'NETWORK_ERROR',
      }),
      expect.objectContaining({
        event: 'transport.connection.connect-attempt-failed',
        stage: 'network-snapshot-read',
        candidateCount: 2,
        transportErrorName: 'TypeError',
        transportErrorCode: 'ECONNRESET',
        transportCauseCode: 'EHOSTUNREACH',
      }),
      expect.objectContaining({
        event: 'transport.connection.internal-command-failed',
        kind: 'retry',
        commandStatus: 'error',
        stateTransition: 'not-applied',
      }),
    ]);
    expect(JSON.stringify(diagnostics)).not.toMatch(/private-url|secret|endpoint|reason"/u);
  });

  it('maps only the three managed loopback DEV services to matching Android reverse ports', () => {
    expect(
      managedDevServiceReverses({
        businessBaseUrl: 'http://127.0.0.1:28080/api/terminal/group-workspaces/aurora',
        tdsEntryOneUrl: 'ws://127.0.0.1:28180',
        tdsEntryTwoUrl: 'ws://127.0.0.1:28181',
      }),
    ).toEqual([
      {remotePort: 28_080, localPort: 28_080},
      {remotePort: 28_180, localPort: 28_180},
      {remotePort: 28_181, localPort: 28_181},
    ]);
    expect(() =>
      managedDevServiceReverses({
        businessBaseUrl: 'http://127.0.0.1:28080/api/terminal/group-workspaces/aurora',
        tdsEntryOneUrl: 'ws://127.0.0.1:28180',
        tdsEntryTwoUrl: 'ws://127.0.0.1:28080',
      }),
    ).toThrow('TERMINAL_AUTOMATION_MANAGED_DEV_URL_INVALID');
  });

  it('binds install, launch, and reverse operations to the selected ready serial', async () => {
    const repo = repository();
    const context = createClient({});
    const runCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      if (args[3] === '--remove') context.reverses.splice(0);
    });
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: repo.root,
      adbPath: '/usr/bin/adb',
      runCommand,
    });

    await session.install(repo.apk);
    await session.launch('com.example.terminal/com.example.terminal.MainActivity');
    const release = await session.attachDriver(19_123);
    expect(context.device.reverse).toHaveBeenCalledExactlyOnceWith('tcp:19090', 'tcp:19123');
    expect(context.device.install).toHaveBeenCalledExactlyOnceWith(realpathSync(repo.apk));
    expect(context.device.startActivity).toHaveBeenCalledExactlyOnceWith({
      component: 'com.example.terminal/com.example.terminal.MainActivity',
      wait: false,
    });

    await release();
    await release();
    expect(runCommand).toHaveBeenCalledExactlyOnceWith('/usr/bin/adb', [
      '-s',
      'emulator-5554',
      'reverse',
      '--remove',
      'tcp:19090',
    ]);
    expect(context.reverses).toEqual([]);
  });

  it('keeps reverse-list failures actionable without logging the raw ADB error', async () => {
    const context = createClient({});
    vi.spyOn(context.device, 'listReverses').mockRejectedValue(
      Object.assign(new Error('sensitive transport detail'), {code: 'ECONNRESET'}),
    );
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
    });
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await expect(session.attachDriver(19_123)).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_REVERSE_LIST_FAILED');
      expect(write).toHaveBeenCalledExactlyOnceWith(
        'TERMINAL_AUTOMATION_ANDROID_REVERSE_LIST_ERROR errorType=Error errorCode=ECONNRESET\n',
      );
      expect(write.mock.calls.flat().join('')).not.toContain('sensitive transport detail');
      expect(context.device.reverse).not.toHaveBeenCalled();
    } finally {
      write.mockRestore();
    }
  });

  it('classifies ActivityManager launch failures without logging the raw device error', async () => {
    const repo = repository();
    const context = createClient({});
    context.startActivity.mockRejectedValue(
      new Error(
        'Activity not started, unable to resolve Intent { cmp=com.example.terminal/com.example.terminal.MainActivity }',
      ),
    );
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: repo.root,
      adbPath: '/usr/bin/adb',
    });
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await expect(session.launch('com.example.terminal/com.example.terminal.MainActivity')).rejects.toThrow(
        'TERMINAL_AUTOMATION_ANDROID_LAUNCH_FAILED',
      );
      expect(write).toHaveBeenCalledExactlyOnceWith(
        'TERMINAL_AUTOMATION_ANDROID_ACTIVITY_START_FAILED componentClass=com.example.terminal.MainActivity failure=INTENT_UNRESOLVED errorType=Error\n',
      );
    } finally {
      write.mockRestore();
    }
  });

  it('reads the Android API level from the explicitly selected serial and rejects invalid readback', async () => {
    const adb = createClient({});
    const runTextCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      expect(args).toEqual(['-s', 'emulator-5554', 'shell', 'getprop', 'ro.build.version.sdk']);
      return '35\n';
    });
    const session = await createAndroidDeviceSession({
      client: adb.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runTextCommand,
    });
    await expect(session.readApiLevel()).resolves.toBe(35);

    const invalid = await createAndroidDeviceSession({
      client: adb.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runTextCommand: async () => 'unknown',
    });
    await expect(invalid.readApiLevel()).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_API_LEVEL_READBACK_INVALID');
  });

  it('reads the primary ABI from the explicitly selected serial and rejects unsupported readback', async () => {
    const adb = createClient({});
    const runTextCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      expect(args).toEqual(['-s', 'emulator-5554', 'shell', 'getprop', 'ro.product.cpu.abi']);
      return 'arm64-v8a\n';
    });
    const session = await createAndroidDeviceSession({
      client: adb.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runTextCommand,
    });
    await expect(session.readPrimaryAbi()).resolves.toBe('arm64-v8a');

    const invalid = await createAndroidDeviceSession({
      client: adb.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runTextCommand: async () => 'unknown',
    });
    await expect(invalid.readPrimaryAbi()).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_PRIMARY_ABI_READBACK_INVALID');
  });

  it('reads only structured TerminalUpdate records from the exact run package process', async () => {
    const context = createClient({});
    const runTextCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      if (args[3] === 'pidof') return '1234\n';
      if (args.includes('ActivityTaskManager:W')) {
        return 'W ActivityTaskManager: Background activity launch blocked! package=com.example.terauto12345678';
      }
      return [
        'I/TerminalUpdate( 1234): event=artifact-download-response declaredBytes=90000000',
        'I/TerminalUpdate( 1234): event=artifact-download-progress bytes=16777216 declaredBytes=90000000 elapsedMs=42000',
        'I/TerminalUpdate( 1234): event=artifact-download-complete bytes=90000000 elapsedMs=71000',
        'I/TerminalUpdate( 1234): event=artifact-prepared kind=full bytes=120 files=4',
        'I/TerminalUpdate( 1234): event=apply-prepared-start kind=full',
        'I/TerminalUpdate( 1234): event=apply-full-stage stage=archive-signers-ready',
        'E/TerminalUpdate( 1234): event=apply-prepared status=failed kind=full code=NATIVE_OPERATION_FAILED errorType=IllegalArgumentException frame=TerminalUpdateRuntime.applyFull:366',
        'E/TerminalUpdate( 1234): event=artifact-prepare status=failed code=TERMINAL_UPDATE_DOWNLOAD_HTTP_404 errorType=IllegalArgumentException',
        'E/OtherTag( 1234): Authorization: secret',
        'E/TerminalUpdate( 9999): private unrelated event=unsafe payload',
      ].join('\n');
    });
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runTextCommand,
    });

    await expect(session.readTerminalUpdateLogs('com.example.terauto12345678')).resolves.toBe(
      [
        'I/TerminalUpdate( 1234): event=artifact-download-response declaredBytes=90000000',
        'I/TerminalUpdate( 1234): event=artifact-download-progress bytes=16777216 declaredBytes=90000000 elapsedMs=42000',
        'I/TerminalUpdate( 1234): event=artifact-download-complete bytes=90000000 elapsedMs=71000',
        'I/TerminalUpdate( 1234): event=artifact-prepared kind=full bytes=120 files=4',
        'I/TerminalUpdate( 1234): event=apply-prepared-start kind=full',
        'I/TerminalUpdate( 1234): event=apply-full-stage stage=archive-signers-ready',
        'E/TerminalUpdate( 1234): event=apply-prepared status=failed kind=full code=NATIVE_OPERATION_FAILED errorType=IllegalArgumentException frame=TerminalUpdateRuntime.applyFull:366',
        'E/TerminalUpdate( 1234): event=artifact-prepare status=failed code=TERMINAL_UPDATE_DOWNLOAD_HTTP_404 errorType=IllegalArgumentException',
        'W/ActivityTaskManager: event=background-activity-start-blocked',
      ].join('\n'),
    );
    expect(runTextCommand).toHaveBeenNthCalledWith(1, '/usr/bin/adb', [
      '-s',
      'emulator-5554',
      'shell',
      'pidof',
      'com.example.terauto12345678',
    ]);
    expect(runTextCommand).toHaveBeenNthCalledWith(2, '/usr/bin/adb', [
      '-s',
      'emulator-5554',
      'shell',
      'logcat',
      '-d',
      '-v',
      'brief',
      '--pid',
      '1234',
      '-s',
      'TerminalUpdate:I',
      '*:S',
    ]);
    expect(runTextCommand).toHaveBeenNthCalledWith(3, '/usr/bin/adb', [
      '-s',
      'emulator-5554',
      'shell',
      'logcat',
      '-d',
      '-v',
      'brief',
      '-s',
      'ActivityTaskManager:W',
      '*:S',
    ]);
  });

  it('does not read device logs when run package process identity is ambiguous', async () => {
    const context = createClient({});
    const runTextCommand = vi.fn(async () => '1234 5678');
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runTextCommand,
    });

    await expect(session.readTerminalUpdateLogs('com.example.terauto12345678')).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_UPDATE_LOG_PROCESS_UNAVAILABLE',
    );
    expect(runTextCommand).toHaveBeenCalledOnce();
  });

  it('binds the three managed DEV endpoints to loopback and releases only its exact reverse mappings', async () => {
    const context = createClient({});
    const runCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      if (args[3] === '--remove') {
        const remote = args[4];
        const index = context.reverses.findIndex(value => value.remote === remote);
        if (index >= 0) context.reverses.splice(index, 1);
      }
    });
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runCommand,
    });
    const release = await session.attachManagedServicePorts([
      {remotePort: 28_080, localPort: 28_080},
      {remotePort: 28_180, localPort: 28_180},
      {remotePort: 28_181, localPort: 28_181},
    ]);
    expect(context.reverses).toEqual([
      {remote: 'tcp:28080', local: 'tcp:28080'},
      {remote: 'tcp:28180', local: 'tcp:28180'},
      {remote: 'tcp:28181', local: 'tcp:28181'},
    ]);
    await release();
    expect(context.reverses).toEqual([]);
    expect(runCommand).toHaveBeenCalledTimes(3);
  });

  it('rejects an existing service reverse without overwriting it', async () => {
    const context = createClient({reverseList: [{remote: 'tcp:28080', local: 'tcp:29000'}]});
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
    });
    await expect(
      session.attachManagedServicePorts([
        {remotePort: 28_080, localPort: 28_080},
        {remotePort: 28_180, localPort: 28_180},
        {remotePort: 28_181, localPort: 28_181},
      ]),
    ).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_MANAGED_REVERSE_ALREADY_OWNED');
    expect(context.device.reverse).not.toHaveBeenCalled();
    expect(context.reverses).toEqual([{remote: 'tcp:28080', local: 'tcp:29000'}]);
  });

  it('does not replace an existing reverse or remove a mapping whose owner changed', async () => {
    const occupied = createClient({reverseList: [{remote: 'tcp:19090', local: 'tcp:19999'}]});
    const occupiedSession = await createAndroidDeviceSession({
      client: occupied.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
    });
    await expect(occupiedSession.attachDriver(19_123)).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_REVERSE_ALREADY_OWNED',
    );
    expect(occupied.device.reverse).not.toHaveBeenCalled();

    const context = createClient({});
    const runCommand = vi.fn(async () => undefined);
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runCommand,
    });

    const release = await session.attachDriver(19_123);
    context.reverses[0].local = 'tcp:19999';
    await expect(release()).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_REVERSE_OWNERSHIP_CHANGED');
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('reports cleanup failure after reverse creation when readback cannot establish ownership', async () => {
    const context = createClient({deviceId: 'emulator-owned-7'});
    const runCommand = vi.fn(async () => undefined);
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-owned-7',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runCommand,
    });
    vi.spyOn(context.device, 'listReverses')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{remote: 'tcp:19090', local: 'tcp:19999'}])
      .mockResolvedValueOnce([{remote: 'tcp:19090', local: 'tcp:19999'}]);

    await expect(session.attachDriver(19_123)).rejects.toThrow(
      'TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:ANDROID_REVERSE_ACQUISITION',
    );
    expect(context.device.reverse).toHaveBeenCalledExactlyOnceWith('tcp:19090', 'tcp:19123');
    expect(runCommand).not.toHaveBeenCalled();
    expect(context.reverses).toEqual([{remote: 'tcp:19090', local: 'tcp:19123'}]);
  });

  it('surfaces failed cleanup of only the managed reverse created before setup failed', async () => {
    const context = createClient({deviceId: 'emulator-owned-9'});
    vi.spyOn(context.device, 'reverse')
      .mockImplementationOnce(async (remote, local) => {
        context.reverses.push({remote, local});
        return true;
      })
      .mockRejectedValueOnce(new Error('injected second reverse failure'));
    const runCommand = vi.fn(async () => {
      throw new Error('injected reverse remove failure');
    });
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-owned-9',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runCommand,
    });

    await expect(
      session.attachManagedServicePorts([
        {remotePort: 28_080, localPort: 28_080},
        {remotePort: 28_180, localPort: 28_180},
        {remotePort: 28_181, localPort: 28_181},
      ]),
    ).rejects.toThrow('TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:ANDROID_MANAGED_REVERSE_ACQUISITION');
    expect(runCommand).toHaveBeenCalledExactlyOnceWith('/usr/bin/adb', [
      '-s',
      'emulator-owned-9',
      'reverse',
      '--remove',
      'tcp:28080',
    ]);
    expect(context.reverses).toEqual([{remote: 'tcp:28080', local: 'tcp:28080'}]);
  });

  it('rejects an APK path outside the repository and invalid activity component', async () => {
    const repo = repository();
    const context = createClient({});
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: repo.root,
      adbPath: '/usr/bin/adb',
    });

    await expect(session.install(path.join(tmpdir(), 'outside.apk'))).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_APK_INVALID',
    );
    await expect(session.launch('com.example.terminal;id/com.example.MainActivity')).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_COMPONENT_INVALID',
    );
    expect(context.device.install).not.toHaveBeenCalled();
    expect(context.device.startActivity).not.toHaveBeenCalled();
  });

  it('only uninstalls the explicit package after readback proves it is present', async () => {
    const context = createClient({});
    let installed = true;
    const runTextCommand = vi.fn(async (_adbPath: string, args: readonly string[]) =>
      args.includes('list') && installed ? 'package:com.anonymous.sampleterminal.terauto1234abcd\n' : '',
    );
    const runCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      if (args[2] === 'uninstall') installed = false;
    });
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runCommand,
      runTextCommand,
    });
    const packageName = 'com.anonymous.sampleterminal.terauto1234abcd';
    expect(await session.isInstalled(packageName)).toBe(true);
    await session.uninstall(packageName);
    expect(runCommand).toHaveBeenCalledExactlyOnceWith(
      '/usr/bin/adb',
      ['-s', 'emulator-5554', 'uninstall', packageName],
      'TERMINAL_AUTOMATION_ANDROID_UNINSTALL_FAILED',
    );
    expect(await session.isInstalled(packageName)).toBe(false);
    await expect(session.uninstall('com.example.foreign')).resolves.toBeUndefined();
  });
});

import {mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {Client, DeviceClient} from '@devicefarmer/adbkit';
import {collectAndroidRuntimeFailureDiagnostics} from '../src/androidAppDiagnostics.js';
import {
  createAndroidDeviceSession,
  managedDevServiceReverses,
  parseAndroidHostForwardList,
} from '../src/androidDevice.js';

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
  it('creates and releases only the exact host topology forward after list readback', async () => {
    const repo = repository();
    let forwardList = '';
    const commands: string[][] = [];
    const session = await createAndroidDeviceSession({
      client: createClient({}).client,
      serial: 'emulator-5554',
      repositoryRoot: repo.root,
      adbPath: '/usr/bin/adb',
      runTextCommand: async (_adb, args) => {
        if (args.join(' ') === 'forward --list') return forwardList;
        throw new Error('UNEXPECTED_ADB_READ');
      },
      runCommand: async (_adb, args) => {
        commands.push([...args]);
        if (args.includes('forward') && args.includes('--no-rebind')) {
          forwardList = 'emulator-5554 tcp:43172 tcp:43172\n';
          return;
        }
        if (args.includes('forward') && args.includes('--remove')) forwardList = '';
      },
    });
    const lifecycle: Array<string> = [];
    const release = await session.attachTopologyHostForward(43172, {
      onAttached: mapping => lifecycle.push(`attached:${mapping.local}:${mapping.remote}`),
      onReleased: mapping => lifecycle.push(`released:${mapping.local}:${mapping.remote}`),
    });
    expect(commands).toEqual([['-s', 'emulator-5554', 'forward', '--no-rebind', 'tcp:43172', 'tcp:43172']]);
    expect(parseAndroidHostForwardList(forwardList)).toEqual([
      {serial: 'emulator-5554', local: 'tcp:43172', remote: 'tcp:43172'},
    ]);
    await release();
    expect(commands[1]).toEqual(['-s', 'emulator-5554', 'forward', '--remove', 'tcp:43172']);
    expect(forwardList).toBe('');
    expect(lifecycle).toEqual(['attached:tcp:43172:tcp:43172', 'released:tcp:43172:tcp:43172']);
  });

  it('fails closed on occupied or changed host forward identity', async () => {
    const repo = repository();
    let forwardList = 'other-emulator tcp:43172 tcp:43172\n';
    const commands: string[][] = [];
    const session = await createAndroidDeviceSession({
      client: createClient({}).client,
      serial: 'emulator-5554',
      repositoryRoot: repo.root,
      adbPath: '/usr/bin/adb',
      runTextCommand: async () => forwardList,
      runCommand: async (_adb, args) => {
        commands.push([...args]);
      },
    });
    await expect(session.attachTopologyHostForward(43172)).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_HOST_FORWARD_PORT_OCCUPIED',
    );
    expect(commands).toEqual([]);

    forwardList = '';
    const ownedSession = await createAndroidDeviceSession({
      client: createClient({}).client,
      serial: 'emulator-5554',
      repositoryRoot: repo.root,
      adbPath: '/usr/bin/adb',
      runTextCommand: async () => forwardList,
      runCommand: async (_adb, args) => {
        commands.push([...args]);
        if (args.includes('--no-rebind')) forwardList = 'emulator-5554 tcp:43172 tcp:43172\n';
        if (args.includes('--remove')) forwardList = 'emulator-5554 tcp:43172 tcp:43173\n';
      },
    });
    const release = await ownedSession.attachTopologyHostForward(43172);
    forwardList = 'emulator-5554 tcp:43172 tcp:43173\n';
    await expect(release()).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_HOST_FORWARD_OWNERSHIP_CHANGED');
    expect(commands.filter(args => args.includes('--remove'))).toHaveLength(0);
    expect(forwardList).toContain('tcp:43173');
  });

  it('reports cleanup readback failure when a removed host forward reappears with a different mapping', async () => {
    const repo = repository();
    let forwardList = '';
    const commands: string[][] = [];
    const session = await createAndroidDeviceSession({
      client: createClient({}).client,
      serial: 'emulator-5554',
      repositoryRoot: repo.root,
      adbPath: '/usr/bin/adb',
      runTextCommand: async () => forwardList,
      runCommand: async (_adb, args) => {
        commands.push([...args]);
        if (args.includes('--no-rebind')) forwardList = 'emulator-5554 tcp:43172 tcp:43172\n';
        if (args.includes('--remove')) forwardList = 'emulator-5554 tcp:43172 tcp:43173\n';
      },
    });
    const release = await session.attachTopologyHostForward(43172);
    await expect(release()).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_HOST_FORWARD_CLEANUP_READBACK_FAILED');
    expect(commands.filter(args => args.includes('--remove'))).toHaveLength(1);
    expect(forwardList).toContain('tcp:43173');
  });

  it('rejects malformed ADB host-forward list rows', () => {
    expect(() => parseAndroidHostForwardList('emulator-5554 tcp:43172 tcp:70000')).toThrow(
      'TERMINAL_AUTOMATION_ANDROID_FORWARD_LIST_INVALID',
    );
  });

  it('preserves raw selected-app Runtime logs alongside structured diagnostics', async () => {
    const repo = repository();
    const context = createClient({});
    const calls: {readonly args: string[]; readonly maxBufferBytes?: number}[] = [];
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: repo.root,
      adbPath: '/usr/bin/adb',
      runTextCommand: async (_adb, args, maxBufferBytes) => {
        calls.push({args: [...args], maxBufferBytes});
        if (args.includes('pidof')) return '1234';
        if (args.includes('-b')) return '';
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
    const structured = diagnostics.split('ANDROID_STRUCTURED_DIAGNOSTICS_BEGIN\n')[1]?.split('\nANDROID_STRUCTURED_DIAGNOSTICS_END')[0];
    expect(structured).toBeDefined();
    expect(JSON.parse(structured!)).toEqual({
      category: 'runtime.lifecycle',
      event: 'runtime.start.failed',
      level: 'error',
      failureName: 'Runtime_lifecycle_failed',
      failureCode: 'ERR_TER_RUNTIME_LIFECYCLE_FAILED',
      causeName: 'FixtureError',
      causeCode: 'ERR_FIXTURE_START',
    });
    expect(diagnostics).toContain('ANDROID_RAW_REACT_NATIVE_LOGCAT_BEGIN');
    expect(diagnostics).toContain('sensitive fixture payload');
    expect(calls.map(call => call.args)).toEqual([
      ['-s', 'emulator-5554', 'shell', 'pidof', 'com.example.terminal'],
      [
        '-s', 'emulator-5554', 'shell', 'logcat', '-d', '-t', '200', '-v', 'brief', '--pid', '1234',
        '-s', 'ReactNativeJS:V', '*:S',
      ],
      [
        '-s', 'emulator-5554', 'shell', 'logcat', '-d', '-b', 'crash', '-v', 'brief',
        '-s', 'AndroidRuntime:E', '*:S',
      ],
    ]);
    expect(calls[1]?.maxBufferBytes).toBe(512 * 1024);
    expect(calls[2]?.maxBufferBytes).toBe(8 * 1024 * 1024);
  });

  it('logs the complete native startup exception and stack when the app process has exited', async () => {
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
        if (args.includes('pidof')) throw new Error('TERMINAL_AUTOMATION_ANDROID_COMMAND_FAILED_EXIT');
        return [
          'E/AndroidRuntime( 1234): FATAL EXCEPTION: main',
          'E/AndroidRuntime( 1234): Process: com.example.terminal, PID: 1234',
          'E/AndroidRuntime( 1234): java.lang.RuntimeException: native wrapper detail',
          'E/AndroidRuntime( 1234): Caused by: java.io.FileNotFoundException: terminal-update-publication.json',
          'E/AndroidRuntime( 1234): java.net.SocketException: authorization=Bearer native-secret-token phone=13800138000 callback=https://user:password@192.168.1.7/path',
          'E/AndroidRuntime( 1234): Cookie: session=first-cookie; identity=second-cookie; Path=/',
          'E/AndroidRuntime( 1234): Set-Cookie: session=third-cookie; Path=/; HttpOnly',
          'E/AndroidRuntime( 1234): apiKey=api-secret accessToken=access-secret refreshToken=refresh-secret X-Api-Key: header-secret',
          'E/AndroidRuntime( 1234): peer=[2001:db8::1] gateway=fe80::1',
          'E/AndroidRuntime( 1234): retryAt=12:34:56 state=a:b:c',
          'E/AndroidRuntime( 1234): \tat com.catering.v2s.terminal.update.TerminalUpdateRuntime.readInstalledIdentity(TerminalUpdateRuntime.kt:1049)',
          'E/ReactNativeJS( 1234): ' +
            JSON.stringify({
              level: 'error',
              category: 'runtime.lifecycle',
              event: 'runtime.start.failed',
              error: {name: 'Runtime lifecycle failed', code: 'ERR_TER_RUNTIME_LIFECYCLE_FAILED'},
              data: {causeName: 'FixtureError', causeCode: 'ERR_FIXTURE_START'},
              message: 'sensitive fixture payload',
            }),
        ].join('\n');
      },
    });

    const diagnostics = await session.readRuntimeFailureDiagnostics('com.example.terminal');
    const structured = diagnostics.split('ANDROID_STRUCTURED_DIAGNOSTICS_BEGIN\n')[1]?.split('\nANDROID_STRUCTURED_DIAGNOSTICS_END')[0] ?? '';

    expect(calls).toEqual([
      ['-s', 'emulator-5554', 'shell', 'pidof', 'com.example.terminal'],
      [
        '-s',
        'emulator-5554',
        'shell',
        'logcat',
        '-d',
        '-b',
        'crash',
        '-v',
        'brief',
        '-s',
        'AndroidRuntime:E',
        '*:S',
      ],
    ]);
    expect(structured).toContain('"failureCode":"ERR_TER_RUNTIME_LIFECYCLE_FAILED"');
    expect(structured).toContain('"causeCode":"ERR_FIXTURE_START"');
    expect(diagnostics).toContain('ANDROID_RAW_STARTUP_FATAL_BEGIN');
    expect(diagnostics).toContain('E/AndroidRuntime( 1234): java.lang.RuntimeException: native wrapper detail');
    expect(diagnostics).toContain('"event":"app.startup.fatal-exception"');
    expect(diagnostics).toContain('"failureName":"java.lang.RuntimeException"');
    expect(diagnostics).toContain('"causeName":"java.io.FileNotFoundException"');
    expect(diagnostics).toContain('native wrapper detail');
    expect(diagnostics).toContain('terminal-update-publication.json');
    expect(diagnostics).toContain('authorization=Bearer native-secret-token phone=13800138000 callback=https://user:password@192.168.1.7/path');
    expect(diagnostics).toContain('Cookie: session=first-cookie; identity=second-cookie; Path=/');
    expect(diagnostics).toContain('Set-Cookie: session=third-cookie; Path=/; HttpOnly');
    expect(diagnostics).toContain('apiKey=api-secret accessToken=access-secret refreshToken=refresh-secret X-Api-Key: header-secret');
    expect(diagnostics).toContain('peer=[2001:db8::1] gateway=fe80::1');
    expect(diagnostics).toContain('retryAt=12:34:56 state=a:b:c');
    expect(diagnostics).toContain('TerminalUpdateRuntime.readInstalledIdentity(TerminalUpdateRuntime.kt:1049)');
  });

  it('uses the latest fatal exception for the selected app package', () => {
    const diagnostics = collectAndroidRuntimeFailureDiagnostics(
      [
        'E/AndroidRuntime( 1234): FATAL EXCEPTION: main',
        'E/AndroidRuntime( 1234): Process: com.example.terminal, PID: 1234',
        'E/AndroidRuntime( 1234): java.lang.IllegalStateException: earlier startup failure',
        'E/AndroidRuntime( 5678): FATAL EXCEPTION: main',
        'E/AndroidRuntime( 5678): Process: com.example.other, PID: 5678',
        'E/AndroidRuntime( 5678): java.lang.IllegalArgumentException: unrelated package failure',
        'E/AndroidRuntime( 9012): FATAL EXCEPTION: main',
        'E/AndroidRuntime( 9012): Process: com.example.terminal, PID: 9012',
        'E/AndroidRuntime( 9012): java.io.FileNotFoundException: latest startup failure',
      ].join('\n'),
      'com.example.terminal',
    );

    expect(diagnostics).toContain('latest startup failure');
    expect(diagnostics).not.toContain('earlier startup failure');
    expect(diagnostics).not.toContain('unrelated package failure');
    expect(diagnostics).toContain('"failureName":"java.io.FileNotFoundException"');
  });

  it('reads a prior process fatal from the crash buffer while the package has restarted', async () => {
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
        if (args.includes('pidof')) return '6789';
        if (args.includes('-b')) {
          return [
            'E/AndroidRuntime( 1234): FATAL EXCEPTION: main',
            'E/AndroidRuntime( 1234): Process: com.example.terminal, PID: 1234',
            'E/AndroidRuntime( 1234): java.lang.IllegalStateException: old process crashed',
            'E/AndroidRuntime( 1234): \tat com.example.terminal.App.start(App.kt:12)',
          ].join('\n');
        }
        return 'E/ReactNativeJS( 6789): current process is alive';
      },
    });

    const diagnostics = await session.readRuntimeFailureDiagnostics('com.example.terminal');

    expect(diagnostics).toContain('old process crashed');
    expect(diagnostics).toContain('App.start(App.kt:12)');
    const crashCall = calls.find(args => args.includes('-b'));
    expect(crashCall).toContain('crash');
    expect(crashCall).not.toContain('--pid');
  });

  it('keeps a matching fatal stack beyond the old 200-line window', () => {
    const stack = Array.from({length: 220}, (_, index) =>
      `E/AndroidRuntime( 1234): \tat com.example.terminal.Frame${index}.run(Frame${index}.kt:${index + 1})`,
    );
    const diagnostics = collectAndroidRuntimeFailureDiagnostics(
      [
        'E/AndroidRuntime( 1234): FATAL EXCEPTION: main',
        'E/AndroidRuntime( 1234): Process: com.example.terminal, PID: 1234',
        'E/AndroidRuntime( 1234): java.lang.RuntimeException: long stack fixture',
        ...stack,
      ].join('\n'),
      'com.example.terminal',
    );

    expect(diagnostics).toContain('Frame219.run(Frame219.kt:220)');
  });

  it('reads only native remote-control event names from the selected app process', async () => {
    const repo = repository();
    const context = createClient({});
    const calls: {readonly args: string[]; readonly maxBufferBytes?: number}[] = [];
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: repo.root,
      adbPath: '/usr/bin/adb',
      runTextCommand: async (_adb, args, maxBufferBytes) => {
        calls.push({args: [...args], maxBufferBytes});
        if (args.includes('pidof')) return '1234';
        return [
          'I/TerminalRemote( 1234): event=touch-dispatch surfaceKey=PRIMARY windowIdentity=window-primary generation=4 action=down result=DISPATCHED',
          'I/TerminalRemoteCapture( 1234): event=capturer-initialized surfaceKey=PRIMARY windowIdentity=window-primary generation=4',
          'I/TerminalRemote( 1234): event=video-track-created streamId=stream-123 surfaceKey=PRIMARY windowIdentity=window-primary trackId=track-123 generation=4 width=1280 height=720',
          'I/Other( 1234): event=ignored',
        ].join('\n');
      },
    });

    const diagnostics = await session.readRemoteControlDiagnostics('com.example.terminal');

    expect(diagnostics).toEqual({
      lineCount: 3,
      eventKinds: ['touch-dispatch', 'capturer-initialized', 'video-track-created'],
      events: [
        {
          event: 'touch-dispatch',
          fields: {surfaceKey: 'PRIMARY', windowIdentity: 'window-primary', generation: 4, action: 'down', result: 'DISPATCHED'},
        },
        {event: 'capturer-initialized', fields: {surfaceKey: 'PRIMARY', windowIdentity: 'window-primary', generation: 4}},
        {
          event: 'video-track-created',
          fields: {
            streamId: 'stream-123',
            surfaceKey: 'PRIMARY',
            windowIdentity: 'window-primary',
            trackId: 'track-123',
            generation: 4,
            width: 1280,
            height: 720,
          },
        },
      ],
    });
    expect(calls[1]?.args).toEqual([
      '-s', 'emulator-5554', 'shell', 'logcat', '-d', '-t', '200', '-v', 'brief', '--pid', '1234',
      '-s', 'TerminalRemote:I', 'TerminalRemoteCapture:I', '*:S',
    ]);
    expect(calls[1]?.maxBufferBytes).toBe(512 * 1024);
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

  it('maps the configured business and TDS address sets to Android reverse ports', () => {
    const environment = (tdsPorts: readonly number[]) => ({
      spaceName: 'development',
      servers: [
        {
          serverName: 'business',
          addresses: [{addressName: 'primary', baseUrl: 'http://127.0.0.1:28080/api/terminal/group-workspaces/aurora'}],
        },
        {
          serverName: 'terminal-data-server',
          addresses: tdsPorts.map((port, index) => ({
            addressName: `haproxy-entry-${index + 1}`,
            baseUrl: `ws://127.0.0.1:${port}`,
          })),
        },
        {serverName: 'livekit', addresses: [{addressName: 'primary', baseUrl: 'ws://47.106.121.27:7880'}]},
      ],
    });
    expect(managedDevServiceReverses(environment([28180, 28181]))).toEqual([
      {remotePort: 28_080, localPort: 28_080},
      {remotePort: 28_180, localPort: 28_180},
      {remotePort: 28_181, localPort: 28_181},
    ]);
    expect(managedDevServiceReverses(environment([28180, 28181, 28182, 28183, 28184, 28185, 28186, 28187, 28188, 28189])))
      .toHaveLength(11);
    expect(() => managedDevServiceReverses(environment([28180, 28080]))).toThrow(
      'TERMINAL_AUTOMATION_MANAGED_DEV_URL_INVALID',
    );
    const invalid = environment([28180]);
    invalid.servers[0]!.addresses[0]!.baseUrl = 'http://example.com:28080/api/terminal/group-workspaces/aurora';
    expect(() => managedDevServiceReverses(invalid)).toThrow('TERMINAL_AUTOMATION_MANAGED_DEV_URL_INVALID');
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
      '-t',
      '200',
      '-v',
      'brief',
      '--pid',
      '1234',
      '-s',
      'TerminalUpdate:I',
      '*:S',
    ], 512 * 1024);
    expect(runTextCommand).toHaveBeenNthCalledWith(3, '/usr/bin/adb', [
      '-s',
      'emulator-5554',
      'shell',
      'logcat',
      '-d',
      '-t',
      '200',
      '-v',
      'brief',
      '-s',
      'ActivityTaskManager:W',
      '*:S',
    ], 512 * 1024);
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

  it('binds and releases only the business reverse for a paired slave device', async () => {
    const context = createClient({deviceId: 'emulator-5556'});
    const runCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      if (args[3] === '--remove') {
        const index = context.reverses.findIndex(value => value.remote === args[4]);
        if (index >= 0) context.reverses.splice(index, 1);
      }
    });
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5556',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runCommand,
    });
    const release = await session.attachManagedServicePorts([{remotePort: 28_080, localPort: 28_080}]);
    expect(context.reverses).toEqual([{remote: 'tcp:28080', local: 'tcp:28080'}]);
    await release();
    expect(context.reverses).toEqual([]);
    expect(runCommand).toHaveBeenCalledExactlyOnceWith('/usr/bin/adb', [
      '-s',
      'emulator-5556',
      'reverse',
      '--remove',
      'tcp:28080',
    ]);
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

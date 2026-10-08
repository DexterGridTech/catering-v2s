import {once} from 'node:events';
import {appendFileSync, lstatSync, realpathSync} from 'node:fs';
import type {Client} from '@devicefarmer/adbkit';
import path from 'node:path';
import {createAndroidDisplayCapture} from './androidCapture.js';
import {createAndroidDeviceSession} from './androidDevice.js';
import type {ManagedReverseLifecycle, ManagedServiceReverse} from './androidDevice.js';
import {createAndroidInput, type AndroidSurface} from './androidInput.js';
import {tapRegisteredAndroidInput, tapRegisteredAndroidNode} from './androidRegisteredInput.js';
import {createAndroidSystemUi, type AndroidSystemUi} from './androidSystemUi.js';
import type {AndroidDisplayShape} from './displayMapping.js';
import type {AndroidLogicalBounds, AndroidTapPosition} from './androidWindow.js';
import {createAutomationDriverServer, type AutomationDriverServer} from './server.js';
import type {TerminalAutomationFixtureApi, TerminalAutomationFixtureFactory} from './driver.js';

export type AndroidAutomationConnection = Readonly<{
  readonly serial: string;
  readonly hostPort: number;
  readonly driver: AutomationDriverServer;
  /** One Android driver surface for system-owned controls outside the app Runtime. */
  readonly systemUi: AndroidSystemUi;
  readonly fixtures?: TerminalAutomationFixtureApi;
  readonly install: (apkPath: string) => Promise<void>;
  readonly servicePorts: readonly ManagedServiceReverse[];
  readonly launch: (component: string) => Promise<void>;
  readonly isInstalled: (packageName: string) => Promise<boolean>;
  readonly readApiLevel: () => Promise<number>;
  readonly readTerminalUpdateLogs: (packageName: string) => Promise<string>;
  readonly readRuntimeFailureDiagnostics: (packageName: string) => Promise<string>;
  readonly forceStop: (packageName: string) => Promise<void>;
  readonly uninstall: (packageName: string) => Promise<void>;
  readonly discoverDisplays: ReturnType<typeof createAndroidInput>['discoverDisplays'];
  readonly tapBounds: (
    surface: AndroidSurface,
    bounds: AndroidLogicalBounds,
    position?: AndroidTapPosition,
  ) => ReturnType<ReturnType<typeof createAndroidInput>['tapBounds']>;
  readonly tapRegisteredNode: (
    input: Readonly<{
      readonly sessionId: string;
      readonly testID: string;
      readonly surface: AndroidSurface;
      readonly displayIndex: 0 | 1;
      readonly position?: AndroidTapPosition;
    }>,
  ) => ReturnType<typeof tapRegisteredAndroidNode>;
  readonly tapRegisteredInput: (
    input: Readonly<{
      readonly sessionId: string;
      readonly testID: string;
      readonly surface: AndroidSurface;
      readonly displayIndex: 0 | 1;
    }>,
  ) => ReturnType<typeof tapRegisteredAndroidInput>;
  readonly capture: (surface: AndroidSurface) => Promise<Buffer>;
  readonly close: () => Promise<void>;
}>;

const fail = (code: string): never => {
  throw new Error(code);
};

const recordReverseOwnership = (
  input: Readonly<{
    repositoryRoot: string;
    runId: string;
    serial: string;
    remote: string;
    local: string;
    kind: 'driver' | 'managed';
    event: 'attached' | 'released';
  }>,
): void => {
  const runDirectory = process.env.TERMINAL_AUTOMATION_RUN_DIRECTORY;
  if (!runDirectory) return;
  const expectedRunId = process.env.TERMINAL_AUTOMATION_RUN_ID;
  if (expectedRunId !== input.runId || path.basename(runDirectory) !== input.runId) {
    fail('TERMINAL_AUTOMATION_ANDROID_REVERSE_RUN_IDENTITY_MISMATCH');
  }
  const root = realpathSync(input.repositoryRoot);
  const resolvedDirectory = realpathSync(runDirectory);
  const expectedDirectory = path.join(root, '.runtime', 'terminal-automation', input.runId);
  if (resolvedDirectory !== expectedDirectory) {
    fail('TERMINAL_AUTOMATION_ANDROID_REVERSE_RUN_DIRECTORY_INVALID');
  }
  const eventPath = path.join(resolvedDirectory, 'events.jsonl');
  const eventStat = lstatSync(eventPath);
  if (!eventStat.isFile() || eventStat.isSymbolicLink()) {
    fail('TERMINAL_AUTOMATION_ANDROID_REVERSE_EVENT_PATH_INVALID');
  }
  appendFileSync(
    eventPath,
    `${JSON.stringify({
      at: new Date().toISOString(),
      event: `android.reverse.${input.kind}.${input.event}`,
      runId: input.runId,
      deviceSerial: input.serial,
      remote: input.remote,
      local: input.local,
    })}\n`,
    {mode: 0o600},
  );
};

export const createAndroidAutomationConnection = async (
  input: Readonly<{
    readonly client: Client;
    readonly serial: string;
    readonly repositoryRoot: string;
    readonly adbPath: string;
    readonly shape: AndroidDisplayShape;
    readonly token: string;
    readonly managedServicePorts?: readonly ManagedServiceReverse[];
    readonly fixtureFactory?: TerminalAutomationFixtureFactory;
    readonly runCommand?: (adbPath: string, args: readonly string[], failureCode?: string) => Promise<void>;
    readonly runTextCommand?: (adbPath: string, args: readonly string[]) => Promise<string>;
  }>,
): Promise<AndroidAutomationConnection> => {
  const device = await createAndroidDeviceSession(input);
  const driver = createAutomationDriverServer({token: input.token, host: '127.0.0.1', port: 0});
  const fixtures = input.fixtureFactory?.(driver);
  let serverReady = false;
  let hostPort = 0;
  let releaseReverse: (() => Promise<void>) | undefined;
  let releaseManagedServiceReverses: (() => Promise<void>) | undefined;
  try {
    await once(driver.server, 'listening');
    serverReady = true;
    const address = driver.server.address();
    if (address === null || typeof address === 'string' || !Number.isSafeInteger(address.port)) {
      return fail('TERMINAL_AUTOMATION_ANDROID_DRIVER_ADDRESS_UNAVAILABLE');
    }
    hostPort = address.port;
    releaseReverse = await device.attachDriver(address.port);
    recordReverseOwnership({
      repositoryRoot: input.repositoryRoot,
      runId: process.env.TERMINAL_AUTOMATION_RUN_ID ?? '',
      serial: input.serial,
      remote: 'tcp:19090',
      local: `tcp:${address.port}`,
      kind: 'driver',
      event: 'attached',
    });
    const servicePorts = input.managedServicePorts ?? Object.freeze([]);
    if (servicePorts.length > 0) {
      const journal: ManagedReverseLifecycle = Object.freeze({
        onAttached: mapping =>
          recordReverseOwnership({
            repositoryRoot: input.repositoryRoot,
            runId: process.env.TERMINAL_AUTOMATION_RUN_ID ?? '',
            serial: input.serial,
            ...mapping,
            kind: 'managed',
            event: 'attached',
          }),
        onReleased: mapping =>
          recordReverseOwnership({
            repositoryRoot: input.repositoryRoot,
            runId: process.env.TERMINAL_AUTOMATION_RUN_ID ?? '',
            serial: input.serial,
            ...mapping,
            kind: 'managed',
            event: 'released',
          }),
      });
      releaseManagedServiceReverses = await device.attachManagedServicePorts(servicePorts, journal);
    }
    const androidInput = createAndroidInput({adbPath: input.adbPath, serial: input.serial, shape: input.shape});
    const systemUi = createAndroidSystemUi({adbPath: input.adbPath, serial: input.serial});
    const capture = createAndroidDisplayCapture({adbPath: input.adbPath, serial: input.serial, shape: input.shape});
    let closed = false;
    return Object.freeze({
      serial: input.serial,
      hostPort: address.port,
      driver,
      systemUi,
      ...(fixtures === undefined ? {} : {fixtures}),
      install: device.install,
      servicePorts,
      launch: device.launch,
      isInstalled: device.isInstalled,
      readApiLevel: device.readApiLevel,
      readTerminalUpdateLogs: device.readTerminalUpdateLogs,
      readRuntimeFailureDiagnostics: device.readRuntimeFailureDiagnostics,
      forceStop: device.forceStop,
      uninstall: device.uninstall,
      discoverDisplays: androidInput.discoverDisplays,
      tapBounds: androidInput.tapBounds,
      tapRegisteredNode: tapInput =>
        tapRegisteredAndroidNode({
          server: driver,
          sessionId: tapInput.sessionId,
          android: androidInput,
          testID: tapInput.testID,
          surface: tapInput.surface,
          displayIndex: tapInput.displayIndex,
          ...(tapInput.position === undefined ? {} : {position: tapInput.position}),
        }),
      tapRegisteredInput: inputForFocus =>
        tapRegisteredAndroidInput({
          server: driver,
          sessionId: inputForFocus.sessionId,
          android: androidInput,
          testID: inputForFocus.testID,
          surface: inputForFocus.surface,
          displayIndex: inputForFocus.displayIndex,
        }),
      capture: capture.capture,
      close: async () => {
        if (closed) return;
        const errors: unknown[] = [];
        try {
          await releaseManagedServiceReverses?.();
        } catch (error) {
          errors.push(error);
        }
        try {
          await releaseReverse?.();
          if (releaseReverse) {
            recordReverseOwnership({
              repositoryRoot: input.repositoryRoot,
              runId: process.env.TERMINAL_AUTOMATION_RUN_ID ?? '',
              serial: input.serial,
              remote: 'tcp:19090',
              local: `tcp:${address.port}`,
              kind: 'driver',
              event: 'released',
            });
          }
        } catch (error) {
          errors.push(error);
        }
        try {
          await driver.close();
        } catch (error) {
          errors.push(error);
        }
        if (errors.length > 0) fail('TERMINAL_AUTOMATION_ANDROID_CONNECTION_CLEANUP_FAILED');
        closed = true;
      },
    });
  } catch (error) {
    const cleanupFailures: string[] = [];
    try {
      await releaseManagedServiceReverses?.();
    } catch (cleanupError) {
      cleanupFailures.push(cleanupError instanceof Error ? cleanupError.message : 'MANAGED_REVERSE_RELEASE_FAILED');
    }
    try {
      await releaseReverse?.();
      if (releaseReverse) {
        recordReverseOwnership({
          repositoryRoot: input.repositoryRoot,
          runId: process.env.TERMINAL_AUTOMATION_RUN_ID ?? '',
          serial: input.serial,
          remote: 'tcp:19090',
          local: `tcp:${hostPort}`,
          kind: 'driver',
          event: 'released',
        });
      }
    } catch (cleanupError) {
      cleanupFailures.push(cleanupError instanceof Error ? cleanupError.message : 'DRIVER_REVERSE_RELEASE_FAILED');
    }
    if (serverReady) {
      try {
        await driver.close();
      } catch (cleanupError) {
        cleanupFailures.push(cleanupError instanceof Error ? cleanupError.message : 'DRIVER_SERVER_CLOSE_FAILED');
      }
    }
    if (cleanupFailures.length > 0) {
      const setupCode = error instanceof Error ? error.message : 'ANDROID_CONNECTION_SETUP_FAILED';
      fail(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:SETUP_${setupCode};CLEANUP_${cleanupFailures.join(',')}`);
    }
    throw error;
  }
};

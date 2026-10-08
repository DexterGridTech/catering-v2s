import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdirSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import type {Client} from '@devicefarmer/adbkit';
import {
  androidAutomationBuildIdentity,
  androidAutomationGradleArguments,
  createAndroidAdbClient,
  createAndroidAutomationConnection,
  ensureMainSampleActivated,
  createAndroidJourneyUiPort,
  createJourneyFailureDiagnostics,
  mainSampleAppName,
  readApplicationDeviceId,
  managedDevServiceReverses,
  parseMainSample,
  parseMainSampleJourneyConfig,
  prepareAndroidJourneySurface,
  type MainSampleJourneyConfig,
  waitForAutomationSession,
  type AndroidAutomationConnection,
} from '../src/index.ts';
import {createManagedActivationFixtureApi} from '../fixtures/managedActivation.ts';
import {runMainSampleJourney} from './mainSampleJourney.ts';
import type {TerminalAutomationProcessIdentity} from '../src/managedRun.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const selectedSample = parseMainSample(process.env.TERMINAL_AUTOMATION_SAMPLE);
const androidApplication = selectedSample === 'console' ? 'sample-terminal' : 'sample-wallpaper-terminal';
const androidProjectRoot = path.join(root, 'apps/terminal/application/android', androidApplication, 'android');
const applicationId =
  selectedSample === 'console' ? 'com.anonymous.sampleterminal' : 'com.catering.v2s.terminal.samplewallpaper';
const appName = mainSampleAppName(selectedSample);
const sessionToken = `ter-auto-${randomUUID()}`;
const adbPath = process.env.ADB_PATH || 'adb';

const readRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`TERMINAL_AUTOMATION_ENV_MISSING_${key}`);
  return value;
};

const streamBuild = async (args: readonly string[], shape: 'mobile' | 'dual'): Promise<void> => {
  const buildEnvironment = {...process.env};
  delete buildEnvironment.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD;
  const child = spawn('./gradlew', [...args], {
    cwd: androidProjectRoot,
    // Keep Gradle in the managed Vitest process group so the outer run manifest
    // owns and cleans its complete process tree.
    detached: false,
    env: {
      ...buildEnvironment,
      NODE_ENV: 'development',
      EXPO_PUBLIC_TER_AUTOMATION_BUILD: 'true',
      EXPO_PUBLIC_TER_AUTOMATION_SURFACE_FORM: shape === 'mobile' ? 'mobile' : 'laptop',
      EXPO_PUBLIC_TER_AUTOMATION_URL: 'ws://127.0.0.1:19090/automation',
      EXPO_PUBLIC_TER_AUTOMATION_TOKEN: sessionToken,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const forward = (chunk: Buffer): void => {
    const safe = chunk.toString('utf8').replaceAll(sessionToken, '[REDACTED]');
    output += safe;
    process.stdout.write(safe);
  };
  child.stdout?.on('data', value => forward(Buffer.from(value)));
  child.stderr?.on('data', value => forward(Buffer.from(value)));
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, 8 * 60_000);
  let code: number | null;
  try {
    [code] = (await once(child, 'close')) as [number | null];
  } catch {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_SPAWN_FAILED');
  } finally {
    clearTimeout(timeout);
  }
  if (timedOut) throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_TIMEOUT');
  if (code !== 0) {
    const failure = output.includes('TERMINAL_AUTOMATION_')
      ? output.match(/TERMINAL_AUTOMATION_[A-Z0-9_]+/u)?.[0]
      : null;
    throw new Error(failure ?? `TERMINAL_AUTOMATION_ANDROID_BUILD_EXIT_${code ?? 'UNKNOWN'}`);
  }
};

describe(`TER automation ${appName} main journey on Android`, () => {
  let adb: Client | undefined;
  let connection: AndroidAutomationConnection | undefined;
  let sessionId: string | null = null;
  let packageId: string | undefined;
  let deviceId: string | null = null;
  let selectedJourney: MainSampleJourneyConfig | undefined;
  let packageWasAbsent = false;
  let installAttempted = false;

  beforeAll(async () => {
    const journey = parseMainSampleJourneyConfig({
      ...process.env,
      TERMINAL_AUTOMATION_SAMPLE: selectedSample,
    });
    selectedJourney = journey;
    const runId = journey.runId;
    const managedDevRunId = readRequiredEnv('TERMINAL_AUTOMATION_MANAGED_DEV_RUN_ID');
    const serial = readRequiredEnv('TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL');
    const {shape} = journey;
    const buildIdentity = androidAutomationBuildIdentity(runId, selectedSample);
    packageId = buildIdentity.packageId;
    if (readRequiredEnv('TERMINAL_AUTOMATION_ANDROID_PACKAGE_ID') !== packageId) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_PACKAGE_IDENTITY_MISMATCH');
    }

    adb = createAndroidAdbClient({adbPath, timeoutMs: 10_000});
    const services = managedDevServiceReverses({
      businessBaseUrl: readRequiredEnv('EXPO_PUBLIC_TER_MANAGED_GROUP_WORKSPACE_BASE_URL'),
      tdsEntryOneUrl: readRequiredEnv('V2S_TERMINAL_DEV_TDS_ENTRY_ONE_WS_URL'),
      tdsEntryTwoUrl: readRequiredEnv('V2S_TERMINAL_DEV_TDS_ENTRY_TWO_WS_URL'),
    });
    connection = await createAndroidAutomationConnection({
      client: adb,
      serial,
      repositoryRoot: root,
      adbPath,
      shape,
      token: sessionToken,
      managedServicePorts: services,
      fixtureFactory: server =>
        createManagedActivationFixtureApi({
          server,
          repositoryRoot: root,
          runId,
          managedDevRunId,
          androidDeviceSerial: serial,
          sessionId: () => sessionId,
          deviceId: () => {
            if (deviceId === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_IDENTITY_UNAVAILABLE');
            return deviceId;
          },
        }),
    });
    await prepareAndroidJourneySurface(connection, shape);
    if (await connection.isInstalled(packageId)) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_RUN_PACKAGE_ALREADY_INSTALLED');
    }
    packageWasAbsent = true;

    const runDirectory = path.join(root, '.runtime/terminal-automation', runId);
    const buildDirectory = path.join(runDirectory, 'android-build');
    mkdirSync(buildDirectory, {recursive: true, mode: 0o700});
    const args = androidAutomationGradleArguments(
      buildIdentity.applicationIdSuffix,
      realpathSync(runDirectory) + '/android-build',
    );
    process.stdout.write(
      `TERMINAL_AUTOMATION_ANDROID_JOURNEY_BUILD_STARTED packageId=${packageId} serial=${serial} shape=${shape}\n`,
    );
    await streamBuild(args, shape);
    const apk = path.join(buildDirectory, 'outputs/apk/debug/app-debug.apk');
    if (await connection.isInstalled(packageId)) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_RUN_PACKAGE_APPEARED_BEFORE_INSTALL');
    }
    installAttempted = true;
    await connection.install(apk);
    if (!(await connection.isInstalled(packageId)))
      throw new Error('TERMINAL_AUTOMATION_ANDROID_INSTALL_READBACK_FAILED');
    await connection.launch(`${packageId}/${applicationId}.MainActivity`);
    const sessionPromise = waitForAutomationSession(connection.driver, value => value.appName === appName, 30_000);
    const session = await sessionPromise;
    sessionId = session.sessionId;
    const appDeviceId = await readApplicationDeviceId(connection.driver, sessionId);
    deviceId = appDeviceId;
    await ensureMainSampleActivated(connection.fixtures, {
      shape,
      deviceId: appDeviceId,
      runId,
    });
  }, 600_000);

  afterAll(async () => {
    const errors: string[] = [];
    if (connection !== undefined && packageId !== undefined) {
      try {
        if (packageWasAbsent && (installAttempted || (await connection.isInstalled(packageId)))) {
          await connection.forceStop(packageId);
          await connection.uninstall(packageId);
        }
        if (await connection.isInstalled(packageId)) errors.push('ANDROID_RUN_PACKAGE_REMAINS');
      } catch {
        errors.push('ANDROID_RUN_PACKAGE_CLEANUP_FAILED');
      }
    }
    try {
      await connection?.close();
    } catch {
      errors.push('ANDROID_CONNECTION_CLEANUP_FAILED');
    }
    if (errors.length > 0) throw new Error(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:${errors.join('_')}`);
    process.stdout.write('TERMINAL_AUTOMATION_DEVICE_CLEANUP_COMPLETE\n');
  });

  it('uses registered native controls and verifies exact Runtime and member owner results', async () => {
    if (connection === undefined || sessionId === null)
      throw new Error('TERMINAL_AUTOMATION_ANDROID_FIXTURE_NOT_READY');
    const journey = selectedJourney;
    if (journey === undefined) throw new Error('TERMINAL_AUTOMATION_JOURNEY_CONFIG_MISSING');
    const session = connection.driver.getSession(sessionId);
    if (session === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_SESSION_MISSING');
    const diagnostics = createJourneyFailureDiagnostics({server: connection.driver, sessionId});
    const ui = createAndroidJourneyUiPort({
      connection,
      sessionId: session.sessionId,
      onStep: diagnostics.markStep,
    });
    try {
      await runMainSampleJourney(
        journey.sample === 'wallpaper'
          ? {sample: 'wallpaper', port: {...ui, server: connection.driver, diagnostics}}
          : {
              sample: 'console',
              port: {...ui, server: connection.driver, diagnostics},
              input: {
                runId: journey.runId,
                shape: journey.shape,
                caseName: journey.caseName,
                age: journey.age,
              },
              storeBasicProof: {
                runId: journey.runId,
                httpBaseUrl: readRequiredEnv('EXPO_PUBLIC_TER_MANAGED_GROUP_WORKSPACE_BASE_URL'),
                operationsPassword: readRequiredEnv('V2S_SEED_OPERATIONS_DEFAULT_PASSWORD'),
                platformRootPassword: readRequiredEnv('V2S_SEED_PLATFORM_ROOT_PASSWORD'),
              },
            },
      );
    } catch (error) {
      diagnostics.report(error);
      throw error;
    } finally {
      diagnostics.close();
    }
    const sessionAfter = connection.driver.getSession(sessionId);
    expect(sessionAfter?.runtimeId).toBe(session.runtimeId);
  }, 180_000);
});

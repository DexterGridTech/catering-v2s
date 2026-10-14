import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdirSync, readFileSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import type {Client} from '@devicefarmer/adbkit';
import {adminTestIds} from '@catering-v2s/ui-base-admin-shell/test-ids';
import {terminalActivationTestIds} from '@catering-v2s/ui-base-terminal-activation/test-ids';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {
  androidAutomationBuildIdentity,
  androidAutomationBuildFailureCode,
  androidAutomationGradleArguments,
  createAndroidAdbClient,
  createAndroidAutomationConnection,
  ensureMainSampleActivated,
  createAndroidJourneyUiPort,
  createJourneyFailureDiagnostics,
  dispatchObservedUiCommand,
  mainSampleAppName,
  readApplicationDeviceId,
  readSelector,
  subscribeSelector,
  managedDevServiceReverses,
  parseMainSample,
  parseMainSampleJourneyConfig,
  prepareAndroidJourneySurface,
  type MainSampleJourneyConfig,
  waitForAutomationSession,
  type AndroidAutomationConnection,
  waitForSelector,
} from '../src/index.ts';
import {createManagedActivationFixtureApi} from '../fixtures/managedActivation.ts';
import {runMainSampleJourney} from './mainSampleJourney.ts';
import type {TerminalAutomationProcessIdentity} from '../src/managedRun.js';
import {parseServerConfigEnvironment} from '../src/serverConfigEnvironment.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const selectedSample = parseMainSample(process.env.TERMINAL_AUTOMATION_SAMPLE);
const androidApplication = selectedSample === 'console' ? 'sample-terminal' : 'sample-wallpaper-terminal';
const androidProjectRoot = path.join(root, 'apps/terminal/application/android', androidApplication, 'android');
const applicationId =
  selectedSample === 'console' ? 'com.anonymous.sampleterminal' : 'com.catering.v2s.terminal.samplewallpaper';
const appName = mainSampleAppName(selectedSample);
const sessionToken = `ter-auto-${randomUUID()}`;
const adbPath = process.env.ADB_PATH || 'adb';
const activationPhase = process.env.TERMINAL_AUTOMATION_PHASE === 'activation';
const primaryDisplay = Object.freeze({mode: 'PRIMARY' as const, index: 0 as const});
const serverConfigSelectorName = 'kernel.base.server-config.selectServerConfiguration';
const serverNetworkSnapshotSelectorName = 'kernel.base.server-config.resolveServerNetworkSnapshot';
const activationSelectorName = 'kernel.base.terminal-data-client.selectActivationState';
const spaceSelectionCommandName = 'kernel.base.server-config.select-space';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`TERMINAL_AUTOMATION_ENV_MISSING_${key}`);
  return value;
};

const readConsoleServerConfig = (): TransportServerConfig => {
  const packagePath = path.join(root, 'apps/terminal/application/android/sample-terminal/package.json');
  const application: unknown = JSON.parse(readFileSync(packagePath, 'utf8'));
  if (!isRecord(application) || !isRecord(application.serverSpaces) || !Array.isArray(application.serverSpaces.spaces)) {
    throw new Error('TERMINAL_AUTOMATION_UAT_SERVER_CONFIG_MISSING');
  }
  const serverSpaces = application.serverSpaces as unknown as TransportServerConfig;
  const uatSpace = serverSpaces.spaces.find(
    space => isRecord(space) && space.name === 'uat' && Array.isArray(space.servers),
  );
  if (uatSpace === undefined) throw new Error('TERMINAL_AUTOMATION_UAT_SPACE_NOT_CONFIGURED');
  const business = uatSpace.servers.find(server => isRecord(server) && server.serverName === 'business');
  if (business === undefined || !Array.isArray(business.addresses)) {
    throw new Error('TERMINAL_AUTOMATION_UAT_BUSINESS_ENDPOINT_NOT_CONFIGURED');
  }
  const primary = business.addresses.find(address => isRecord(address) && address.addressName === 'primary');
  if (primary === undefined || typeof primary.baseUrl !== 'string' || primary.baseUrl.length === 0) {
    throw new Error('TERMINAL_AUTOMATION_UAT_BUSINESS_ENDPOINT_NOT_CONFIGURED');
  }
  return serverSpaces;
};

const registeredNode = async (
  connection: AndroidAutomationConnection,
  sessionId: string,
  testID: string,
): Promise<Record<string, unknown> | null> => {
  const response = await connection.driver.request(sessionId, 'controls.query', {
    filter: {testID, surface: 'PRIMARY', displayIndex: 0},
  });
  if (
    response.type !== 'response' ||
    !isRecord(response.body) ||
    !isRecord(response.body.result) ||
    !Array.isArray(response.body.result.nodes)
  ) {
    throw new Error('TERMINAL_AUTOMATION_REGISTERED_CONTROL_QUERY_INVALID');
  }
  const nodes = response.body.result.nodes;
  if (nodes.length > 1) throw new Error(`TERMINAL_AUTOMATION_REGISTERED_CONTROL_AMBIGUOUS_${testID}`);
  const node = nodes[0];
  return isRecord(node) ? node : null;
};

const waitForRegisteredNode = async (
  connection: AndroidAutomationConnection,
  sessionId: string,
  testID: string,
  timeoutMs = 15_000,
): Promise<Record<string, unknown>> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const node = await registeredNode(connection, sessionId, testID);
    if (node !== null) return node;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`TERMINAL_AUTOMATION_REGISTERED_CONTROL_NOT_FOUND_${testID}`);
};

const waitUntilAdminShellCloses = async (
  connection: AndroidAutomationConnection,
  sessionId: string,
  timeoutMs = 15_000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await registeredNode(connection, sessionId, adminTestIds.shell)) === null) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('TERMINAL_AUTOMATION_ADMIN_SHELL_CLOSE_TIMEOUT');
};

const enterAdminConsole = async (
  connection: AndroidAutomationConnection,
  sessionId: string,
  diagnostics: ReturnType<typeof createJourneyFailureDiagnostics>,
): Promise<void> => {
  const launcherGesturePosition = {x: 48 / 1280, y: 0};
  await dispatchObservedUiCommand({
    server: connection.driver,
    sessionId,
    workspace: 'MAIN',
    displayMode: 'PRIMARY',
    commandName: 'kernel.base.ui-state.open-layer',
    timeoutMs: 30_000,
    action: async () => {
      // Resolve the registered node and display geometry once, then deliver
      // the required five real taps inside the product's 1.8-second window.
      diagnostics.markStep('admin.launcher.gesture.taps');
      const startedAt = Date.now();
      const tap = await connection.tapRegisteredNode({
        sessionId,
        testID: adminTestIds.launcher,
        surface: 'primary',
        displayIndex: 0,
        position: launcherGesturePosition,
        clickPacing: 'intentional-overlap',
        repeatCount: 5,
      });
      process.stdout.write(`TERMINAL_AUTOMATION_ADMIN_GESTURE ${JSON.stringify({
        at: new Date().toISOString(),
        runId: process.env.TERMINAL_AUTOMATION_RUN_ID ?? null,
        testID: adminTestIds.launcher,
        tapCount: 5,
        elapsedMs: Date.now() - startedAt,
        nodeInstanceId: tap.nodeInstanceId,
        layoutRevision: tap.layoutRevision,
      })}\n`);
    },
  });
  diagnostics.markStep('admin.login.controls.ready');
  await waitForRegisteredNode(connection, sessionId, adminTestIds.passwordInput);
  const passwordNode = await waitForRegisteredNode(connection, sessionId, adminTestIds.debugPassword);
  const passwordText = typeof passwordNode.value === 'string' ? passwordNode.value : passwordNode.label;
  const password = typeof passwordText === 'string' ? passwordText.match(/\d{6}/u)?.[0] : undefined;
  if (password === undefined) throw new Error('TERMINAL_AUTOMATION_ADMIN_PASSWORD_UNAVAILABLE');
  await waitForRegisteredNode(connection, sessionId, 'ui.base.input:virtual-keyboard:text-0');
  for (const [index, digit] of [...password].entries()) {
    diagnostics.markStep(`admin.login.key.${index + 1}`);
    await connection.tapRegisteredNode({
      sessionId,
      testID: `ui.base.input:virtual-keyboard:text-${digit}`,
      surface: 'primary',
      displayIndex: 0,
    });
  }
  diagnostics.markStep('admin.login.submit');
  await connection.tapRegisteredNode({
    sessionId,
    testID: adminTestIds.verify,
    surface: 'primary',
    displayIndex: 0,
  });
  await waitForRegisteredNode(connection, sessionId, adminTestIds.shell);
};

const ensureUatServerSpace = async (
  connection: AndroidAutomationConnection,
  sessionId: string,
  ui: ReturnType<typeof createAndroidJourneyUiPort>,
  diagnostics: ReturnType<typeof createJourneyFailureDiagnostics>,
): Promise<void> => {
  const defaults = readConsoleServerConfig();
  const initial = await readSelector(connection.driver, sessionId, serverConfigSelectorName, [defaults]);
  if (!isRecord(initial) || !Array.isArray(initial.spaces) || typeof initial.selectedSpace !== 'string') {
    throw new Error('TERMINAL_AUTOMATION_SERVER_CONFIG_SELECTOR_INVALID');
  }
  const spaces = initial.spaces.filter(isRecord);
  if (!spaces.some(space => space.name === 'uat')) throw new Error('TERMINAL_AUTOMATION_UAT_SPACE_NOT_READABLE');
  let selectedSpace = initial.selectedSpace;
  for (let attempt = 0; selectedSpace !== 'uat' && attempt < spaces.length; attempt += 1) {
    diagnostics.markStep(`server-config.select-space.${attempt + 1}`);
    await dispatchObservedUiCommand({
      server: connection.driver,
      sessionId,
      workspace: 'MAIN',
      displayMode: 'PRIMARY',
      commandName: spaceSelectionCommandName,
      timeoutMs: 30_000,
      action: () => ui.click(adminTestIds.serverConfig.space, primaryDisplay),
    });
    const updated = await waitForSelector(
      connection.driver,
      sessionId,
      serverConfigSelectorName,
      [defaults],
      value => isRecord(value) && value.selectedSpace !== selectedSpace,
      15_000,
    );
    if (!isRecord(updated) || typeof updated.selectedSpace !== 'string') {
      throw new Error('TERMINAL_AUTOMATION_SERVER_CONFIG_SELECTOR_INVALID');
    }
    selectedSpace = updated.selectedSpace;
  }
  if (selectedSpace !== 'uat') throw new Error('TERMINAL_AUTOMATION_UAT_SPACE_SELECTION_FAILED');
  const snapshot = await readSelector(connection.driver, sessionId, serverNetworkSnapshotSelectorName, [defaults, 'business']);
  const uatSpace = defaults.spaces.find(space => space.name === 'uat');
  const expectedBusiness = uatSpace?.servers.find(server => server.serverName === 'business');
  const expectedPrimary = expectedBusiness?.addresses.find(address => address.addressName === 'primary');
  const actualPrimary = isRecord(snapshot) && Array.isArray(snapshot.addresses)
    ? snapshot.addresses.find(address => isRecord(address) && address.addressName === 'primary')
    : undefined;
  if (
    !isRecord(snapshot) ||
    snapshot.serverName !== 'business' ||
    expectedPrimary === undefined ||
    !isRecord(actualPrimary) ||
    actualPrimary.baseUrl !== expectedPrimary.baseUrl
  ) {
    throw new Error('TERMINAL_AUTOMATION_UAT_BUSINESS_ADDRESS_READBACK_MISMATCH');
  }
};

const runUatActivation = async (
  connection: AndroidAutomationConnection,
  sessionId: string,
  ui: ReturnType<typeof createAndroidJourneyUiPort>,
  diagnostics: ReturnType<typeof createJourneyFailureDiagnostics>,
  runId: string,
): Promise<void> => {
  const activationCode = readRequiredEnv('TERMINAL_AUTOMATION_UAT_ACTIVATION_CODE');
  if (!/^\d{8}$/u.test(activationCode)) throw new Error('TERMINAL_AUTOMATION_UAT_ACTIVATION_CODE_INVALID');
  const before = await readSelector(connection.driver, sessionId, activationSelectorName, []);
  if (!isRecord(before) || before.status !== 'inactive') {
    throw new Error('TERMINAL_AUTOMATION_UAT_ACTIVATION_REQUIRES_INACTIVE_APP');
  }
  diagnostics.markStep('uat-admin-open');
  await enterAdminConsole(connection, sessionId, diagnostics);
  diagnostics.markStep('uat-server-config-open');
  await connection.tapRegisteredNode({
    sessionId,
    testID: adminTestIds.section('terminal.server-config.admin'),
    surface: 'primary',
    displayIndex: 0,
  });
  await waitForRegisteredNode(connection, sessionId, adminTestIds.serverConfig.section);
  await ensureUatServerSpace(connection, sessionId, ui, diagnostics);
  diagnostics.markStep('uat-server-config-verified');
  await connection.tapRegisteredNode({
    sessionId,
    testID: adminTestIds.close,
    surface: 'primary',
    displayIndex: 0,
  });
  await waitUntilAdminShellCloses(connection, sessionId);
  await waitForRegisteredNode(connection, sessionId, terminalActivationTestIds.codeInput);
  diagnostics.markStep('uat-activation-code-entry');
  await ui.enterTextAndComplete(terminalActivationTestIds.codeInput, activationCode, primaryDisplay);
  diagnostics.markStep('uat-activation-submit');
  const activationObservation = await subscribeSelector(
    connection.driver,
    sessionId,
    activationSelectorName,
    [],
    {allowUndefinedCurrent: true},
  );
  if (!isRecord(activationObservation.current) || activationObservation.current.status !== 'inactive') {
    await activationObservation.close();
    throw new Error('TERMINAL_AUTOMATION_UAT_ACTIVATION_STATE_CHANGED_BEFORE_SUBMIT');
  }
  let active: unknown;
  try {
    process.stdout.write(`TERMINAL_AUTOMATION_UAT_ACTIVATION_SUBMIT ${JSON.stringify({
      at: new Date().toISOString(),
      runId,
      appName,
      selectedSpace: 'uat',
      testId: 'terminalActivationTestIds.submit',
    })}\n`);
    await ui.click(terminalActivationTestIds.submit, primaryDisplay);
    active = await activationObservation.waitFor(
      value => isRecord(value) && value.status === 'active' && typeof value.terminalRef === 'string',
      90_000,
    );
  } catch (error) {
    const latest = activationObservation.latest();
    const latestValue = latest?.state === 'JSON' && isRecord(latest.value)
      ? {status: latest.value.status ?? null, hasTerminalRef: typeof latest.value.terminalRef === 'string'}
      : null;
    process.stderr.write(`TERMINAL_AUTOMATION_UAT_ACTIVATION_SELECTOR_TIMEOUT ${JSON.stringify({
      at: new Date().toISOString(),
      runId,
      latestState: latest?.state ?? 'UNOBSERVED',
      latestValue,
      error: error instanceof Error ? {name: error.name, message: error.message, stack: error.stack ?? null} : String(error),
    })}\n`);
    throw error;
  } finally {
    await activationObservation.close();
  }
  if (!isRecord(active) || typeof active.terminalRef !== 'string') {
    throw new Error('TERMINAL_AUTOMATION_UAT_ACTIVATION_READBACK_INVALID');
  }
  const selected = await readSelector(connection.driver, sessionId, serverConfigSelectorName, [readConsoleServerConfig()]);
  if (!isRecord(selected) || selected.selectedSpace !== 'uat') {
    throw new Error('TERMINAL_AUTOMATION_UAT_ACTIVATION_SPACE_CHANGED');
  }
  process.stdout.write(`TERMINAL_AUTOMATION_UAT_ACTIVATION_PASS ${JSON.stringify({
    at: new Date().toISOString(),
    runId,
    appName,
    selectedSpace: 'uat',
    status: 'active',
    terminalRef: active.terminalRef,
    storeRef: active.storeRef ?? null,
    activationCode: 'NOT_LOGGED',
  })}\n`);
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
    throw new Error(androidAutomationBuildFailureCode(output, code));
  }
};

describe(`TER automation ${appName} ${activationPhase ? 'UAT activation' : 'main journey'} on Android`, () => {
  let adb: Client | undefined;
  let connection: AndroidAutomationConnection | undefined;
  let sessionId: string | null = null;
  let packageId: string | undefined;
  let deviceId: string | null = null;
  let selectedJourney: MainSampleJourneyConfig | undefined;
  let selectedRunId: string | undefined;
  let packageWasAbsent = false;
  let installAttempted = false;
  let activationSucceeded = false;

  beforeAll(async () => {
    const journey = activationPhase
      ? undefined
      : parseMainSampleJourneyConfig({
          ...process.env,
          TERMINAL_AUTOMATION_SAMPLE: selectedSample,
        });
    selectedJourney = journey;
    const runId = journey?.runId ?? readRequiredEnv('TERMINAL_AUTOMATION_RUN_ID');
    const rawShape = journey?.shape ?? readRequiredEnv('TERMINAL_AUTOMATION_SHAPE');
    if (rawShape !== 'mobile' && rawShape !== 'dual') throw new Error('TERMINAL_AUTOMATION_SHAPE_INVALID');
    selectedRunId = runId;
    if (activationPhase) {
      const activationCode = readRequiredEnv('TERMINAL_AUTOMATION_UAT_ACTIVATION_CODE');
      if (!/^\d{8}$/u.test(activationCode)) throw new Error('TERMINAL_AUTOMATION_UAT_ACTIVATION_CODE_INVALID');
      readConsoleServerConfig();
    }
    const managedDevRunId = activationPhase ? undefined : readRequiredEnv('TERMINAL_AUTOMATION_MANAGED_DEV_RUN_ID');
    const serial = readRequiredEnv('TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL');
    const shape = rawShape;
    const buildIdentity = androidAutomationBuildIdentity(runId, selectedSample);
    packageId = buildIdentity.packageId;
    if (readRequiredEnv('TERMINAL_AUTOMATION_ANDROID_PACKAGE_ID') !== packageId) {
      throw new Error('TERMINAL_AUTOMATION_ANDROID_PACKAGE_IDENTITY_MISMATCH');
    }

    adb = createAndroidAdbClient({adbPath, timeoutMs: 10_000});
    const services = activationPhase
      ? undefined
      : managedDevServiceReverses(
          parseServerConfigEnvironment(readRequiredEnv('EXPO_PUBLIC_TER_SERVER_CONFIG_ENVIRONMENT_JSON')),
        );
    const fixtureFactory = activationPhase
      ? undefined
      : (server: AndroidAutomationConnection['driver']) =>
          createManagedActivationFixtureApi({
            server,
            repositoryRoot: root,
            runId,
            managedDevRunId: managedDevRunId!,
            androidDeviceSerial: serial,
            sessionId: () => sessionId,
            deviceId: () => {
              if (deviceId === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_IDENTITY_UNAVAILABLE');
              return deviceId;
            },
          });
    connection = await createAndroidAutomationConnection({
      client: adb,
      serial,
      repositoryRoot: root,
      adbPath,
      shape,
      token: sessionToken,
      ...(services === undefined ? {} : {managedServicePorts: services}),
      ...(fixtureFactory === undefined ? {} : {fixtureFactory}),
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
      `TERMINAL_AUTOMATION_ANDROID_${activationPhase ? 'ACTIVATION' : 'JOURNEY'}_BUILD_STARTED packageId=${packageId} serial=${serial} shape=${shape}\n`,
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
    if (!activationPhase) {
      await ensureMainSampleActivated(connection.fixtures, {
        shape,
        deviceId: appDeviceId,
        runId,
      });
    }
  }, 600_000);

  afterAll(async () => {
    const errors: string[] = [];
    const cleanupRunId = selectedRunId ?? process.env.TERMINAL_AUTOMATION_RUN_ID ?? null;
    const cleanupStage = async <TValue,>(stage: string, action: () => Promise<TValue>): Promise<TValue> => {
      const emit = (status: 'STARTED' | 'COMPLETE' | 'FAILED', error?: unknown): void => {
        const details = error instanceof Error
          ? {errorName: error.name, errorMessage: error.message, errorStack: error.stack ?? null}
          : error === undefined ? {} : {errorName: 'NON_ERROR_THROWN', errorMessage: String(error)};
        process.stdout.write(`TERMINAL_AUTOMATION_DEVICE_CLEANUP ${JSON.stringify({
          at: new Date().toISOString(),
          runId: cleanupRunId,
          role: 'MAIN',
          stage,
          status,
          ...details,
        })}\n`);
      };
      emit('STARTED');
      try {
        const result = await action();
        emit('COMPLETE');
        return result;
      } catch (error) {
        emit('FAILED', error);
        throw error;
      }
    };
    const cleanupConnection = connection;
    const cleanupPackageId = packageId;
    if (cleanupConnection !== undefined && cleanupPackageId !== undefined) {
      try {
        const installed = await cleanupStage('package-presence', () => cleanupConnection.isInstalled(cleanupPackageId));
        if (activationPhase && activationSucceeded) {
          await cleanupStage('retain-activated-app', async () => {
            if (!installed) throw new Error('ACTIVATED_APP_NOT_INSTALLED');
            if (sessionId === null || cleanupConnection.driver.getSession(sessionId) === null) {
              throw new Error('ACTIVATED_APP_AUTOMATION_SESSION_NOT_AVAILABLE');
            }
            process.stdout.write(`TERMINAL_AUTOMATION_ANDROID_APP_RETAINED ${JSON.stringify({
              at: new Date().toISOString(),
              runId: cleanupRunId,
              packageId: cleanupPackageId,
              installed,
              forceStopped: false,
              uninstalled: false,
            })}\n`);
          });
        } else if (packageWasAbsent && (installAttempted || installed)) {
          await cleanupStage('force-stop', () => cleanupConnection.forceStop(cleanupPackageId));
          await cleanupStage('uninstall', () => cleanupConnection.uninstall(cleanupPackageId));
        }
        if (!(activationPhase && activationSucceeded)) {
          await cleanupStage('package-readback', async () => {
            if (await cleanupConnection.isInstalled(cleanupPackageId)) throw new Error('ANDROID_RUN_PACKAGE_REMAINS');
          });
        }
      } catch {
        errors.push('ANDROID_RUN_PACKAGE_CLEANUP_FAILED');
      }
    }
    try {
      if (cleanupConnection !== undefined) await cleanupStage('connection-close', () => cleanupConnection.close());
    } catch {
      errors.push('ANDROID_CONNECTION_CLEANUP_FAILED');
    }
    if (errors.length > 0) throw new Error(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:${errors.join('_')}`);
    process.stdout.write('TERMINAL_AUTOMATION_DEVICE_CLEANUP_COMPLETE\n');
  });

  it(
    activationPhase
      ? 'selects the UAT serverspace and activates through the registered console UI'
      : 'uses registered native controls and verifies exact Runtime and member owner results',
    async () => {
      if (connection === undefined || sessionId === null)
        throw new Error('TERMINAL_AUTOMATION_ANDROID_FIXTURE_NOT_READY');
      const journey = selectedJourney;
      if (!activationPhase && journey === undefined) throw new Error('TERMINAL_AUTOMATION_JOURNEY_CONFIG_MISSING');
      const session = connection.driver.getSession(sessionId);
      if (session === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_SESSION_MISSING');
      const diagnostics = createJourneyFailureDiagnostics({server: connection.driver, sessionId});
      const ui = createAndroidJourneyUiPort({
        connection,
        sessionId: session.sessionId,
        onStep: diagnostics.markStep,
      });
      try {
        if (activationPhase) {
          const runId = selectedRunId;
          if (runId === undefined) throw new Error('TERMINAL_AUTOMATION_RUN_ID_MISSING');
          await runUatActivation(connection, sessionId, ui, diagnostics, runId);
          activationSucceeded = true;
        } else {
          if (journey === undefined) throw new Error('TERMINAL_AUTOMATION_JOURNEY_CONFIG_MISSING');
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
                    httpBaseUrl: readRequiredEnv('V2S_TERMINAL_DEV_HTTP_BASE_URL'),
                    operationsPassword: readRequiredEnv('V2S_SEED_OPERATIONS_DEFAULT_PASSWORD'),
                    platformRootPassword: readRequiredEnv('V2S_SEED_PLATFORM_ROOT_PASSWORD'),
                  },
                },
          );
        }
      } catch (error) {
        if (activationPhase && connection !== undefined && sessionId !== null) {
          try {
            const activationState = await readSelector(connection.driver, sessionId, activationSelectorName, []);
            if (
              isRecord(activationState) &&
              activationState.status === 'active' &&
              typeof activationState.terminalRef === 'string'
            ) {
              activationSucceeded = true;
              process.stderr.write(`TERMINAL_AUTOMATION_UAT_ACTIVATION_RETAIN_AFTER_FAILURE ${JSON.stringify({
                at: new Date().toISOString(),
                runId: selectedRunId ?? null,
                terminalRef: activationState.terminalRef,
                reason: 'BUSINESS_SELECTOR_CONFIRMS_PERSISTED_ACTIVATION',
              })}\n`);
            }
          } catch (diagnosticError) {
            process.stderr.write(`TERMINAL_AUTOMATION_UAT_ACTIVATION_STATE_READ_FAILED ${diagnosticError instanceof Error ? diagnosticError.stack ?? diagnosticError.message : String(diagnosticError)}\n`);
          }
          try {
            const resultNode = await registeredNode(connection, sessionId, terminalActivationTestIds.result);
            process.stderr.write(`TERMINAL_AUTOMATION_UAT_ACTIVATION_VISIBLE_RESULT ${JSON.stringify({
              at: new Date().toISOString(),
              runId: selectedRunId ?? null,
              node: resultNode,
            })}\n`);
          } catch (diagnosticError) {
            process.stderr.write(`TERMINAL_AUTOMATION_UAT_ACTIVATION_VISIBLE_RESULT_READ_FAILED ${diagnosticError instanceof Error ? diagnosticError.stack ?? diagnosticError.message : String(diagnosticError)}\n`);
          }
          if (packageId !== undefined) {
            try {
              const runtimeDiagnostics = await connection.readRuntimeFailureDiagnostics(packageId);
              process.stderr.write(`TERMINAL_AUTOMATION_UAT_ACTIVATION_ANDROID_DIAGNOSTICS_BEGIN\n${runtimeDiagnostics}\nTERMINAL_AUTOMATION_UAT_ACTIVATION_ANDROID_DIAGNOSTICS_END\n`);
            } catch (diagnosticError) {
              process.stderr.write(`TERMINAL_AUTOMATION_UAT_ACTIVATION_ANDROID_DIAGNOSTICS_READ_FAILED ${diagnosticError instanceof Error ? diagnosticError.stack ?? diagnosticError.message : String(diagnosticError)}\n`);
            }
          }
        }
        diagnostics.report(error);
        throw error;
      } finally {
        diagnostics.close();
      }
      const sessionAfter = connection.driver.getSession(sessionId);
      expect(sessionAfter?.runtimeId).toBe(session.runtimeId);
    },
    180_000,
  );
});

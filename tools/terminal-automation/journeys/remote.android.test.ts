import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {mkdirSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {chromium, type Browser, type Locator, type Page} from 'playwright';
import type {Client} from '@devicefarmer/adbkit';
import {topologyTransportConfig} from '@catering-v2s/kernel-base-contracts';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {pairByHostTopologyCommand, setTopologyHostEnabledCommand} from '@catering-v2s/kernel-base-topology';
import {projectBasicSliceName} from '@catering-v2s/kernel-feature-project-basic';
import {storeBasicSliceName} from '@catering-v2s/kernel-feature-store-basic';
import {remoteControlTestIds} from '../../../apps/frontend/operations-admin/src/app/automation/remoteControlTestIds.ts';
import {terminalUpdateTestIds} from '../../../apps/frontend/operations-admin/src/app/automation/terminalUpdateTestIds.ts';
import {roleHomeTestIds} from '../../../apps/frontend/operations-admin/src/features/role-home-bootstrap/roleHomeTestIds.ts';
import {testExpoTestIds} from '../../../apps/terminal/ui/base/dev-host/src/foundations/testExpoTestIds.ts';
import {inputTestIds} from '@catering-v2s/ui-base-input/test-ids';
import {
  androidAutomationBuildIdentity,
  androidAutomationGradleArguments,
  createAndroidAdbClient,
  createAndroidAutomationConnection,
  createJourneyFailureDiagnostics,
  createVirtualKeyboardInput,
  dispatchObservedUiCommand,
  ensureMainSampleActivated,
  mainSampleAppName,
  managedDevServiceReverses,
  parseMainSample,
  prepareAndroidJourneySurface,
  readApplicationDeviceId,
  readSelector,
  waitForAutomationSession,
  waitForSelector,
  type AndroidAutomationConnection,
} from '../src/index.ts';
import {mainSampleTerminalName} from '../src/mainSampleJourneyConfig.ts';
import {mainSampleTestIds} from '../src/mainSampleTestIds.js';
import {createManagedActivationFixtureApi} from '../fixtures/managedActivation.ts';
import {safeBrowserRequestFailureReason} from '../src/browserNetworkDiagnostics.js';

type RemoteTopology = 'mobile-single' | 'laptop-single' | 'laptop-dual' | 'laptop-paired';
type SafeLogFields = Readonly<Record<string, string | number | boolean>>;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const runId = required('TERMINAL_AUTOMATION_RUN_ID');
const managedDevRunId = required('TERMINAL_AUTOMATION_MANAGED_DEV_RUN_ID');
const sample = parseMainSample(process.env.TERMINAL_AUTOMATION_SAMPLE);
const appName = mainSampleAppName(sample);
const topology = parseRemoteTopology(process.env.TERMINAL_AUTOMATION_REMOTE_TOPOLOGY);
const paired = topology === 'laptop-paired';
const dual = topology === 'laptop-dual';
const wallpaperCommandNames = Object.freeze({
  optionSelected: 'ui.feature.sample-wallpaper-picker.wallpaper-option-selected',
  confirmRequested: 'ui.feature.sample-wallpaper-picker.wallpaper-confirm-requested',
});
const appSurfaceForm = topology === 'mobile-single' ? 'mobile' : 'laptop';
const fixtureShape = topology === 'mobile-single' ? 'mobile' : 'dual';
const androidShape = dual ? 'dual' : 'mobile';
const applicationId =
  sample === 'console' ? 'com.anonymous.sampleterminal' : 'com.catering.v2s.terminal.samplewallpaper';
const androidApplication = sample === 'console' ? 'sample-terminal' : 'sample-wallpaper-terminal';
const androidProjectRoot = path.join(root, 'apps/terminal/application/android', androidApplication, 'android');
const packageIdentity = androidAutomationBuildIdentity(runId, sample);
const sessionToken = `ter-remote-${randomUUID()}`;
const adbPath = process.env.ADB_PATH || 'adb';

let adb: Client | undefined;
let master: AndroidAutomationConnection | undefined;
let peer: AndroidAutomationConnection | undefined;
let browser: Browser | undefined;
let operationsPage: Page | undefined;
let masterSessionId: string | null = null;
let peerSessionId: string | null = null;
let masterDeviceId: string | null = null;
let peerDeviceId: string | null = null;
let terminalRef: string | undefined;
let diagnostics: ReturnType<typeof createJourneyFailureDiagnostics>[] = [];
let masterWasAbsent = false;
let peerWasAbsent = false;
let masterInstallAttempted = false;
let peerInstallAttempted = false;
let setupStage = 'input-validation';

function required(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.length === 0) throw new Error(`TERMINAL_AUTOMATION_ENV_MISSING_${key}`);
  return value;
}

function parseRemoteTopology(value: string | undefined): RemoteTopology {
  if (value === 'mobile-single' || value === 'laptop-single' || value === 'laptop-dual' || value === 'laptop-paired')
    return value;
  throw new Error('TERMINAL_AUTOMATION_REMOTE_TOPOLOGY_INVALID');
}

const safeLog = (event: string, fields: SafeLogFields = {}): void => {
  process.stdout.write(
    `TERMINAL_AUTOMATION_REMOTE ${JSON.stringify({at: new Date().toISOString(), runId, sample, topology, event, ...fields})}\n`,
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safeFailureCode = (error: unknown): string => {
  if (!(error instanceof Error)) return 'UNKNOWN';
  const match = error.message.match(/[A-Z][A-Z0-9_]{4,96}/u);
  return match?.[0] ?? error.name;
};

const apiOperation = (url: string): string | undefined => {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return 'operations.invalid-url';
  }
  if (!pathname.startsWith('/api/')) return undefined;
  if (pathname.endsWith('/auth/session')) return 'admin.session';
  if (/\/remote-control-sessions\/[^/]+\/controller-grant$/u.test(pathname)) return 'remote.grant';
  if (/\/remote-control-sessions\/[^/]+\/end$/u.test(pathname)) return 'remote.end';
  if (/\/remote-control-sessions$/u.test(pathname)) return 'remote.start';
  if (/\/terminal-update-versions(?:\/|$)/u.test(pathname)) return 'terminal-update.read';
  return 'admin.other';
};

const attachAdminDiagnostics = (page: Page): void => {
  let requestSequence = 0;
  const requestIds = new WeakMap<object, number>();
  const started = new WeakMap<object, number>();
  page.on('request', request => {
    const operation = apiOperation(request.url());
    if (operation === undefined) return;
    const requestId = ++requestSequence;
    requestIds.set(request, requestId);
    started.set(request, Date.now());
    safeLog('admin.request.started', {requestId, method: request.method(), operation});
  });
  page.on('response', response => {
    const request = response.request();
    const requestId = requestIds.get(request);
    if (requestId === undefined) return;
    safeLog('admin.request.completed', {
      requestId,
      method: request.method(),
      operation: apiOperation(request.url()) ?? 'admin.other',
      status: response.status(),
      elapsedMs: Date.now() - (started.get(request) ?? Date.now()),
    });
  });
  page.on('requestfailed', request => {
    const requestId = requestIds.get(request);
    if (requestId === undefined) return;
    safeLog('admin.request.failed', {
      requestId,
      method: request.method(),
      operation: apiOperation(request.url()) ?? 'admin.other',
      elapsedMs: Date.now() - (started.get(request) ?? Date.now()),
      reason: safeBrowserRequestFailureReason(request.failure()?.errorText),
    });
  });
  page.on('pageerror', error => safeLog('admin.page.error', {errorName: error.name}));
};

const activeSelectDropdown = async (page: Page, input: Locator): Promise<Locator> => {
  const listboxId = await input.getAttribute('aria-controls');
  if (listboxId) {
    const listbox = page.locator(`[id=${JSON.stringify(listboxId)}]`);
    const ownerDropdown = listbox
      .locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ant-select-dropdown ")]')
      .first();
    // Ant Design can expose an accessibility listbox mirror through aria-controls.
    // Only use it when its visible dropdown actually owns interactive options.
    if (
      (await ownerDropdown.count()) > 0 &&
      (await ownerDropdown.isVisible()) &&
      (await ownerDropdown.locator('.ant-select-item-option:visible').count()) > 0
    )
      return ownerDropdown;
  }
  // Closing portals can remain in the DOM; resolve the current visible portal.
  return page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible').last();
};

const selectOption = async (page: Page, controlTestId: string, optionPrefix: string, label: RegExp): Promise<void> => {
  const input = page.getByTestId(controlTestId).locator('input').first();
  await input.waitFor({state: 'visible', timeout: 30_000});
  await input.click();
  const dropdown = await activeSelectDropdown(page, input);
  await dropdown.waitFor({state: 'visible', timeout: 10_000});
  const options = dropdown.locator('.ant-select-item-option:visible');
  const matches = options.filter({hasText: label});
  // This helper runs from beforeAll; Vitest expect.poll() is only valid in a test body.
  let matchWaitFailure = 'NONE';
  try {
    await matches.first().waitFor({state: 'visible', timeout: 10_000});
  } catch (error) {
    matchWaitFailure = error instanceof Error ? error.name : 'UNKNOWN';
  }
  const [optionCount, labelMatchCount] = await Promise.all([
    options.count().catch(() => -1),
    matches.count().catch(() => -1),
  ]);
  if (matchWaitFailure !== 'NONE' || labelMatchCount !== 1) {
    safeLog('admin.role-context.option.match-failed', {
      dropdownVisible: await dropdown.isVisible().catch(() => false),
      optionCount,
      labelMatchCount,
      matchWaitFailure,
    });
    throw new Error('TERMINAL_AUTOMATION_REMOTE_SCOPE_OPTION_COUNT_INVALID');
  }
  const optionTestId = await matches.first().evaluate((element: Element, prefix: string) => {
    const candidates = [element, ...element.querySelectorAll('[data-testid]')];
    const identified = candidates.find(candidate => candidate.getAttribute('data-testid')?.startsWith(prefix));
    return identified?.getAttribute('data-testid') ?? null;
  }, optionPrefix);
  if (optionTestId === null || !optionTestId.startsWith(optionPrefix))
    throw new Error('TERMINAL_AUTOMATION_REMOTE_SCOPE_OPTION_IDENTITY_MISMATCH');
  safeLog('admin.role-context.option.readback', {
    optionCount: await options.count(),
    labelMatchCount: 1,
    optionIdentityPresent: true,
  });
  await matches.first().click();
};

const responseResult = (response: {readonly type: string; readonly body: unknown}): unknown => {
  if (response.type === 'error')
    throw new Error(
      isRecord(response.body) && typeof response.body.code === 'string'
        ? response.body.code
        : 'TERMINAL_AUTOMATION_CONTROL_ERROR',
    );
  if (response.type !== 'response' || !isRecord(response.body) || !('result' in response.body))
    throw new Error('TERMINAL_AUTOMATION_CONTROL_RESPONSE_INVALID');
  return response.body.result;
};

const dispatchCommand = async (
  connection: AndroidAutomationConnection,
  sessionId: string,
  commandName: string,
  payload: unknown,
  routeContext?: Readonly<Record<string, unknown>>,
): Promise<void> => {
  const requestId = `req_${randomUUID()}`;
  safeLog('runtime.command.started', {requestId, commandName});
  const accepted = responseResult(
    await connection.driver.request(sessionId, 'command.dispatch', {
      commandName,
      payload,
      requestId,
      ...(routeContext === undefined ? {} : {routeContext}),
    }),
  );
  if (!isRecord(accepted) || accepted.requestId !== requestId || accepted.accepted !== true) {
    throw new Error('TERMINAL_AUTOMATION_REMOTE_COMMAND_NOT_ACCEPTED');
  }
  safeLog('runtime.command.accepted', {requestId, commandName});
};

const readRegisteredBounds = async (
  input: Readonly<{
    readonly connection: AndroidAutomationConnection;
    readonly sessionId: string;
    readonly testID: string;
    readonly surface: 'PRIMARY' | 'SECONDARY';
    readonly displayIndex: 0 | 1;
  }>,
): Promise<Readonly<{x: number; y: number; width: number; height: number}>> => {
  const query = responseResult(
    await input.connection.driver.request(input.sessionId, 'controls.query', {
      filter: {testID: input.testID, surface: input.surface, displayIndex: input.displayIndex},
    }),
  );
  if (!isRecord(query) || !Array.isArray(query.nodes) || query.nodes.length !== 1 || !isRecord(query.nodes[0]))
    throw new Error('TERMINAL_AUTOMATION_REMOTE_CONTROL_NODE_NOT_UNIQUE');
  const node = query.nodes[0];
  if (
    !isRecord(node.surface) ||
    node.surface.surface !== input.surface ||
    node.surface.displayIndex !== input.displayIndex ||
    typeof node.nodeInstanceId !== 'string' ||
    !Number.isSafeInteger(node.surface.layoutRevision)
  )
    throw new Error('TERMINAL_AUTOMATION_REMOTE_CONTROL_NODE_IDENTITY_INVALID');
  const boundsResponse = responseResult(
    await input.connection.driver.request(input.sessionId, 'controls.bounds', {
      nodeInstanceId: node.nodeInstanceId,
      layoutRevision: node.surface.layoutRevision,
    }),
  );
  if (
    !isRecord(boundsResponse) ||
    boundsResponse.nodeInstanceId !== node.nodeInstanceId ||
    boundsResponse.layoutRevision !== node.surface.layoutRevision ||
    !isRecord(boundsResponse.bounds)
  )
    throw new Error('TERMINAL_AUTOMATION_REMOTE_CONTROL_BOUNDS_INVALID');
  const bounds = boundsResponse.bounds;
  if (
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(
      value => typeof value === 'number' && Number.isFinite(value),
    )
  )
    throw new Error('TERMINAL_AUTOMATION_REMOTE_CONTROL_BOUNDS_INVALID');
  return bounds as Readonly<{x: number; y: number; width: number; height: number}>;
};

const remoteTargetPoint = async (
  input: Readonly<{
    readonly connection: AndroidAutomationConnection;
    readonly sessionId: string;
    readonly operationsPage: Page;
    readonly screenSlot: 'main' | 'secondary';
    readonly testID: string;
    readonly surface: 'PRIMARY' | 'SECONDARY';
    readonly displayIndex: 0 | 1;
    readonly targetU?: number;
    readonly targetV?: number;
  }>,
): Promise<Readonly<{x: number; y: number; u: number; v: number}>> => {
  const [target, surface] = await Promise.all([
    readRegisteredBounds({
      connection: input.connection,
      sessionId: input.sessionId,
      testID: input.testID,
      surface: input.surface,
      displayIndex: input.displayIndex,
    }),
    readRegisteredBounds({
      connection: input.connection,
      sessionId: input.sessionId,
      testID: String(testExpoTestIds.surface(input.surface)),
      surface: input.surface,
      displayIndex: input.displayIndex,
    }),
  ]);
  if (surface.width <= 0 || surface.height <= 0 || target.width <= 0 || target.height <= 0)
    throw new Error('TERMINAL_AUTOMATION_REMOTE_CONTROL_BOUNDS_INVALID');
  const u = (target.x + target.width * (input.targetU ?? 0.5) - surface.x) / surface.width;
  const v = (target.y + target.height * (input.targetV ?? 0.5) - surface.y) / surface.height;
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) throw new Error('TERMINAL_AUTOMATION_REMOTE_TARGET_OUTSIDE_SURFACE');
  const video = input.operationsPage.getByTestId(remoteControlTestIds.screen(input.screenSlot));
  await expect
    .poll(
      () =>
        video.evaluate(
          (element: HTMLVideoElement) =>
            element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            element.videoWidth > 0 &&
            element.videoHeight > 0,
        ),
      {timeout: 30_000},
    )
    .toBe(true);
  const videoBounds = await video.boundingBox();
  const videoSize = await video.evaluate((element: HTMLVideoElement) => ({
    width: element.videoWidth,
    height: element.videoHeight,
  }));
  if (videoBounds === null || videoBounds.width <= 0 || videoBounds.height <= 0)
    throw new Error('TERMINAL_AUTOMATION_REMOTE_VIDEO_BOUNDS_UNAVAILABLE');
  const scale = Math.min(videoBounds.width / videoSize.width, videoBounds.height / videoSize.height);
  const renderedWidth = videoSize.width * scale;
  const renderedHeight = videoSize.height * scale;
  const x = videoBounds.x + (videoBounds.width - renderedWidth) / 2 + u * renderedWidth;
  const y = videoBounds.y + (videoBounds.height - renderedHeight) / 2 + v * renderedHeight;
  return {x, y, u, v};
};

const clickRemoteTarget = async (
  input: Readonly<{
    readonly connection: AndroidAutomationConnection;
    readonly sessionId: string;
    readonly operationsPage: Page;
    readonly screenSlot: 'main' | 'secondary';
    readonly testID: string;
    readonly surface: 'PRIMARY' | 'SECONDARY';
    readonly displayIndex: 0 | 1;
    readonly duringPress?: () => Promise<void>;
  }>,
): Promise<void> => {
  const {x, y, u, v} = await remoteTargetPoint(input);
  safeLog('pointer.started', {
    screenSlot: input.screenSlot,
    testID: input.testID,
    u: Number(u.toFixed(4)),
    v: Number(v.toFixed(4)),
  });
  await input.operationsPage.mouse.move(x, y);
  await input.operationsPage.mouse.down();
  try {
    // The pointer goes through LiveKit DataChannel to the native MotionEvent port.
    await input.duringPress?.();
  } finally {
    await input.operationsPage.mouse.up();
  }
  safeLog('pointer.completed', {screenSlot: input.screenSlot, testID: input.testID});
};

const dragRemoteTarget = async (
  input: Readonly<{
    readonly connection: AndroidAutomationConnection;
    readonly sessionId: string;
    readonly operationsPage: Page;
    readonly screenSlot: 'main' | 'secondary';
    readonly testID: string;
    readonly surface: 'PRIMARY' | 'SECONDARY';
    readonly displayIndex: 0 | 1;
  }>,
): Promise<void> => {
  const [start, end] = await Promise.all([
    remoteTargetPoint({...input, targetU: 0.5, targetV: 0.8}),
    remoteTargetPoint({...input, targetU: 0.5, targetV: 0.2}),
  ]);
  safeLog('pointer.drag.started', {screenSlot: input.screenSlot, testID: input.testID});
  await input.operationsPage.mouse.move(start.x, start.y);
  await input.operationsPage.mouse.down();
  try {
    await input.operationsPage.mouse.move(end.x, end.y, {steps: 8});
  } finally {
    await input.operationsPage.mouse.up();
  }
  safeLog('pointer.drag.completed', {screenSlot: input.screenSlot, testID: input.testID});
};

const waitForLoginScreen = async (
  connection: AndroidAutomationConnection,
  sessionId: string,
  displayMode: 'PRIMARY' | 'SECONDARY',
) =>
  waitForSelector(
    connection.driver,
    sessionId,
    'kernel.base.ui-state.selectScreen',
    [displayMode, 'main'],
    value => isRecord(value) && value.partKey === 'sample.auth.login',
    45_000,
  );

const enterRemoteKeyboardText = async (
  input: Readonly<{
    readonly connection: AndroidAutomationConnection;
    readonly sessionId: string;
    readonly operationsPage: Page;
    readonly fieldTestID: string;
    readonly value: string;
  }>,
): Promise<void> => {
  const target = {
    connection: input.connection,
    sessionId: input.sessionId,
    operationsPage: input.operationsPage,
    screenSlot: 'main' as const,
    surface: 'PRIMARY' as const,
    displayIndex: 0 as const,
  };
  const keyboard = createVirtualKeyboardInput({
    focusInput: async testID => {
      await clickRemoteTarget({...target, testID});
      const readinessKey = /^[A-Za-z]/u.test(input.value) ? 'virtual-keyboard:text-a' : 'virtual-keyboard:text-1';
      const readinessTestID = String(inputTestIds.node(readinessKey));
      await expect
        .poll(
          async () => {
            try {
              await readRegisteredBounds({
                connection: input.connection,
                sessionId: input.sessionId,
                testID: readinessTestID,
                surface: 'PRIMARY',
                displayIndex: 0,
              });
              return true;
            } catch {
              return false;
            }
          },
          {timeout: 10_000},
        )
        .toBe(true);
      safeLog('terminal.remote-keyboard.ready', {
        fieldTestID: testID,
        layout: /^[A-Za-z]/u.test(input.value) ? 'alpha' : 'numeric',
      });
    },
    click: async testID => clickRemoteTarget({...target, testID}),
  });
  await keyboard.enterTextAndComplete(input.fieldTestID, input.value, {mode: 'PRIMARY', index: 0});
  safeLog('terminal.remote-keyboard.input-completed', {fieldTestID: input.fieldTestID, keyCount: input.value.length});
};

const streamBuild = async (args: readonly string[]): Promise<void> => {
  const environment = {...process.env};
  delete environment.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD;
  delete environment.V2S_SEED_PLATFORM_ROOT_PASSWORD;
  const child = spawn('./gradlew', [...args], {
    cwd: androidProjectRoot,
    detached: false,
    env: {
      ...environment,
      NODE_ENV: 'development',
      EXPO_PUBLIC_TER_AUTOMATION_BUILD: 'true',
      EXPO_PUBLIC_TER_AUTOMATION_PHASE: 'remote',
      EXPO_PUBLIC_TER_AUTOMATION_RUN_ID: runId,
      EXPO_PUBLIC_TER_AUTOMATION_ANDROID_PACKAGE_ID: packageIdentity.packageId,
      EXPO_PUBLIC_TER_AUTOMATION_URL: 'ws://127.0.0.1:19090/automation',
      EXPO_PUBLIC_TER_AUTOMATION_TOKEN: sessionToken,
      EXPO_PUBLIC_TER_AUTOMATION_SURFACE_FORM: appSurfaceForm,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const forward = (chunk: Buffer, stream: 'stdout' | 'stderr'): void => {
    let text = chunk.toString('utf8').replaceAll(sessionToken, '[REDACTED]');
    output += text;
    (stream === 'stdout' ? process.stdout : process.stderr).write(text);
  };
  child.stdout?.on('data', chunk => forward(Buffer.from(chunk), 'stdout'));
  child.stderr?.on('data', chunk => forward(Buffer.from(chunk), 'stderr'));
  if (child.pid === undefined) throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_SPAWN_FAILED');
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, 8 * 60_000);
  let code: number | null;
  try {
    [code] = (await once(child, 'close')) as [number | null];
  } finally {
    clearTimeout(timeout);
  }
  if (timedOut) throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_TIMEOUT');
  if (code !== 0)
    throw new Error(
      output.match(/TERMINAL_AUTOMATION_[A-Z0-9_]+/u)?.[0] ??
        `TERMINAL_AUTOMATION_ANDROID_BUILD_EXIT_${code ?? 'UNKNOWN'}`,
    );
  safeLog('android.build.completed', {exitCode: code ?? 0, appSurfaceForm});
};

const launchManagedApp = async (
  connection: AndroidAutomationConnection,
  apkPath: string,
  role: 'MASTER' | 'PEER',
): Promise<{sessionId: string; deviceId: string}> => {
  if (await connection.isInstalled(packageIdentity.packageId))
    throw new Error(`TERMINAL_AUTOMATION_${role}_RUN_PACKAGE_ALREADY_INSTALLED`);
  if (role === 'MASTER') masterWasAbsent = true;
  else peerWasAbsent = true;
  if (role === 'MASTER') masterInstallAttempted = true;
  else peerInstallAttempted = true;
  await connection.install(apkPath);
  if (!(await connection.isInstalled(packageIdentity.packageId)))
    throw new Error(`TERMINAL_AUTOMATION_${role}_INSTALL_READBACK_FAILED`);
  await connection.launch(`${packageIdentity.packageId}/${applicationId}.MainActivity`);
  const session = await waitForAutomationSession(connection.driver, value => value.appName === appName, 60_000);
  const deviceId = await readApplicationDeviceId(connection.driver, session.sessionId);
  safeLog('android.app.session.ready', {
    role,
    packageId: packageIdentity.packageId,
    sessionId: session.sessionId,
    runtimeId: session.runtimeId,
  });
  return Object.freeze({sessionId: session.sessionId, deviceId});
};

const readConnectionStatus = (connection: AndroidAutomationConnection, sessionId: string) =>
  readSelector(connection.driver, sessionId, 'kernel.base.terminal-data-client.selectConnectionState', []);

const readRemoteStatus = (connection: AndroidAutomationConnection, sessionId: string) =>
  readSelector(connection.driver, sessionId, 'kernel.base.remote-control.selectRemoteControlStatus', []);

describe(`TER remote control ${sample} on Android ${topology}`, () => {
  beforeAll(async () => {
    try {
      if (required('TERMINAL_AUTOMATION_ANDROID_PACKAGE_ID') !== packageIdentity.packageId)
        throw new Error('TERMINAL_AUTOMATION_ANDROID_PACKAGE_IDENTITY_MISMATCH');
      const expectedSuffix = required('TERMINAL_AUTOMATION_ANDROID_APPLICATION_ID_SUFFIX');
      if (expectedSuffix !== packageIdentity.applicationIdSuffix)
        throw new Error('TERMINAL_AUTOMATION_ANDROID_APPLICATION_IDENTITY_MISMATCH');
      const serial = required('TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL');
      const peerSerial = paired ? required('TERMINAL_AUTOMATION_ANDROID_PEER_DEVICE_SERIAL') : undefined;
      if (peerSerial === serial) throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIALS_MUST_DIFFER');
      const operationsPassword = required('V2S_SEED_OPERATIONS_DEFAULT_PASSWORD');
      const operationsOrigin = new URL(required('TERMINAL_AUTOMATION_OPERATIONS_ADMIN_ORIGIN'));
      const managedUrls = {
        businessBaseUrl: required('EXPO_PUBLIC_TER_MANAGED_GROUP_WORKSPACE_BASE_URL'),
        tdsEntryOneUrl: required('V2S_TERMINAL_DEV_TDS_ENTRY_ONE_WS_URL'),
        tdsEntryTwoUrl: required('V2S_TERMINAL_DEV_TDS_ENTRY_TWO_WS_URL'),
      };
      const serviceReverses = managedDevServiceReverses(managedUrls);
      const runDirectory = path.join(root, '.runtime/terminal-automation', runId);
      const buildDirectory = path.join(runDirectory, 'android-build');
      mkdirSync(buildDirectory, {recursive: true, mode: 0o700});
      const buildDirectoryReadback = realpathSync(buildDirectory);
      if (!buildDirectoryReadback.startsWith(`${realpathSync(runDirectory)}${path.sep}`))
        throw new Error('TERMINAL_AUTOMATION_ANDROID_BUILD_DIRECTORY_OUTSIDE_RUN');

      setupStage = 'android-driver-connect';
      safeLog('setup.stage', {stage: setupStage});
      adb = createAndroidAdbClient({adbPath, timeoutMs: 10_000});
      const fixtureState = {sessionId: null as string | null, deviceId: null as string | null};
      master = await createAndroidAutomationConnection({
        client: adb,
        serial,
        repositoryRoot: root,
        adbPath,
        shape: androidShape,
        token: sessionToken,
        managedServicePorts: serviceReverses,
        fixtureFactory: server =>
          createManagedActivationFixtureApi({
            server,
            repositoryRoot: root,
            runId,
            managedDevRunId,
            androidDeviceSerial: serial,
            sessionId: () => fixtureState.sessionId,
            deviceId: () => {
              if (fixtureState.deviceId === null)
                throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_IDENTITY_UNAVAILABLE');
              return fixtureState.deviceId;
            },
          }),
      });
      safeLog('android.driver.ready', {role: 'MASTER', serial, hostPort: master.hostPort});
      await prepareAndroidJourneySurface(master, androidShape);
      if (dual)
        await (async () => {
          const displays = await master!.discoverDisplays();
          if (displays.secondary === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_DUAL_DISPLAY_REQUIRED');
        })();
      if (paired) {
        peer = await createAndroidAutomationConnection({
          client: adb,
          serial: peerSerial!,
          repositoryRoot: root,
          adbPath,
          shape: 'mobile',
          token: sessionToken,
          managedServicePorts: Object.freeze([serviceReverses[0]!]),
        });
        safeLog('android.driver.ready', {role: 'PEER', serial: peerSerial!, hostPort: peer.hostPort});
        await prepareAndroidJourneySurface(peer, 'mobile');
        safeLog('android.devices.selected', {
          masterSerial: serial,
          peerSerial: peerSerial!,
          pairDistinct: serial !== peerSerial,
        });
      }

      const buildIdentity = androidAutomationBuildIdentity(runId, sample);
      const gradleArgs = androidAutomationGradleArguments(buildIdentity.applicationIdSuffix, buildDirectoryReadback);
      setupStage = 'android-app-build';
      safeLog('setup.stage', {stage: setupStage});
      safeLog('android.build.started', {packageId: buildIdentity.packageId, topology, appSurfaceForm});
      await streamBuild(gradleArgs);
      const apkPath = path.join(buildDirectoryReadback, 'outputs/apk/debug/app-debug.apk');
      const masterApp = await launchManagedApp(master, apkPath, 'MASTER');
      masterSessionId = masterApp.sessionId;
      masterDeviceId = masterApp.deviceId;
      diagnostics = [
        createJourneyFailureDiagnostics({
          server: master.driver,
          sessionId: masterSessionId,
          write: line => process.stderr.write(`${line}\n`),
        }),
      ];
      fixtureState.sessionId = masterSessionId;
      fixtureState.deviceId = masterDeviceId;
      setupStage = 'activation-fixture';
      safeLog('setup.stage', {stage: setupStage});
      const activation = await ensureMainSampleActivated(master.fixtures, {
        shape: fixtureShape,
        deviceId: masterDeviceId,
        runId,
      });
      terminalRef = activation.terminalRef;
      safeLog('fixture.activation.verified', {
        terminalRef,
        bindingGeneration: activation.bindingGeneration,
        fixtureShape,
      });
      setupStage = 'tdp-connect';
      safeLog('setup.stage', {stage: setupStage});
      await waitForSelector(
        master.driver,
        masterSessionId,
        'kernel.base.terminal-data-client.selectConnectionState',
        [],
        value => isRecord(value) && value.status === 'connected',
        60_000,
      );
      safeLog('terminal.tdp.ready', {role: 'MASTER'});

      if (paired) {
        setupStage = 'pair-peer';
        safeLog('setup.stage', {stage: setupStage});
        const peerApp = await launchManagedApp(peer!, apkPath, 'PEER');
        peerSessionId = peerApp.sessionId;
        peerDeviceId = peerApp.deviceId;
        diagnostics.push(
          createJourneyFailureDiagnostics({
            server: peer!.driver,
            sessionId: peerSessionId,
            write: line => process.stderr.write(`${line}\n`),
          }),
        );
        if (peerDeviceId === masterDeviceId)
          throw new Error('TERMINAL_AUTOMATION_PAIR_RUNTIME_IDENTITIES_NOT_DISTINCT');
        await master.attachTopologyHostForward(topologyTransportConfig.port);
        await dispatchCommand(master, masterSessionId, setTopologyHostEnabledCommand.commandName, {enabled: true});
        await waitForSelector(
          master.driver,
          masterSessionId,
          'kernel.base.topology.selectTopologyFacts',
          [],
          value => isRecord(value) && value.hostActual === 'running' && value.hostDesired === true,
          30_000,
        );
        await dispatchCommand(
          peer!,
          peerSessionId,
          pairByHostTopologyCommand.commandName,
          {host: '10.0.2.2'},
          {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
        );
        await waitForSelector(
          peer!.driver,
          peerSessionId,
          'kernel.base.topology.selectTopologyFacts',
          [],
          value =>
            isRecord(value) && value.paired === true && value.instanceMode === 'SLAVE' && value.peerReachable === true,
          90_000,
        );
        const requiredProjections = Object.freeze([serverConfigSliceName, storeBasicSliceName, projectBasicSliceName]);
        await waitForSelector(
          peer!.driver,
          peerSessionId,
          'kernel.base.topology.selectTopologyRequiredProjectionsReady',
          [requiredProjections],
          value => value === true,
          90_000,
        );
        const peerStatus = await readConnectionStatus(peer!, peerSessionId);
        expect(peerStatus).toMatchObject({status: 'stopped'});
        const peerActivation = await readSelector(
          peer!.driver,
          peerSessionId,
          'kernel.base.terminal-data-client.selectActivationState',
          [],
        );
        expect(peerActivation).toMatchObject({status: 'active'});
        safeLog('topology.peer.ready', {
          peerInactiveTds: isRecord(peerStatus) && peerStatus.status === 'stopped',
          projectionsReady: true,
        });
      }

      if (master === undefined || masterSessionId === null)
        throw new Error('TERMINAL_AUTOMATION_ANDROID_MASTER_SESSION_MISSING');
      setupStage = 'terminal-staff-login';
      safeLog('setup.stage', {stage: setupStage});
      await waitForLoginScreen(master, masterSessionId, 'PRIMARY');

      setupStage = 'operations-admin-login';
      safeLog('setup.stage', {stage: setupStage});
      browser = await chromium.launch({headless: true});
      operationsPage = await browser.newPage({viewport: {width: 1440, height: 900}});
      operationsPage.setDefaultTimeout(30_000);
      attachAdminDiagnostics(operationsPage);
      if (
        operationsOrigin.protocol !== 'http:' ||
        !['127.0.0.1', 'localhost'].includes(operationsOrigin.hostname) ||
        !/^\d{4,5}$/u.test(operationsOrigin.port)
      )
        throw new Error('TERMINAL_AUTOMATION_OPERATIONS_ORIGIN_INVALID');
      await operationsPage.goto(new URL('/operations/aurora/login', operationsOrigin).toString(), {
        waitUntil: 'domcontentloaded',
      });
      await operationsPage.getByTestId('operations-login-name').fill('r5-account-multi-role');
      await operationsPage.getByTestId('operations-login-password').fill(operationsPassword);
      await operationsPage.getByTestId('operations-login-submit').click();
      await operationsPage.getByTestId('operations-role-context-select').waitFor({state: 'visible'});
      safeLog('admin.login.ready', {roleContextAvailable: true});
      await selectOption(
        operationsPage,
        'operations-role-context-select',
        roleHomeTestIds.roleContext.optionPrefix,
        /项目运营负责人.*太原万象城/u,
      );
      await operationsPage.getByTestId('operations-role-context-enter').click();
      await operationsPage.getByTestId('operations-shell-menu').waitFor({state: 'visible'});
      await operationsPage.goto(new URL('/operations/aurora/terminal-update/rules', operationsOrigin).toString());
      const dataScope = operationsPage.getByTestId(roleHomeTestIds.dataScope.trigger);
      await dataScope.waitFor({state: 'visible'});
      await expect(await dataScope.textContent()).toContain('太原万象城');
      await operationsPage.getByTestId(terminalUpdateTestIds.page).waitFor({state: 'visible'});
      safeLog('admin.scope.ready', {terminalRef});
    } catch (error) {
      safeLog('setup.failed', {stage: setupStage, failureCode: safeFailureCode(error)});
      for (const item of diagnostics) item.report(error);
      throw error;
    }
  }, 12 * 60_000);

  afterAll(async () => {
    const failures: string[] = [];
    try {
      if (operationsPage !== undefined) {
        const end = operationsPage.getByTestId(remoteControlTestIds.end);
        if ((await end.count()) > 0 && (await end.isVisible().catch(() => false))) {
          await end.click();
          safeLog('admin.remote.end.clicked');
          const close = operationsPage.getByTestId(remoteControlTestIds.close);
          if ((await close.count()) > 0 && (await close.isVisible().catch(() => false))) await close.click();
          await operationsPage.getByTestId(remoteControlTestIds.workArea).waitFor({state: 'hidden', timeout: 20_000});
        }
      }
    } catch {
      failures.push('REMOTE_WORKSPACE_RELEASE_FAILED');
    }
    for (const [role, connection, sessionId, expectedTracks] of [
      ['MASTER', master, masterSessionId, dual ? 2 : 1],
      ['PEER', peer, peerSessionId, 1],
    ] as const) {
      if (connection === undefined || sessionId === null) continue;
      try {
        const status = await readRemoteStatus(connection, sessionId);
        if (isRecord(status) && status.sessionId !== null && status.phase !== 'ended') {
          failures.push(`${role}_REMOTE_SESSION_NOT_ENDED`);
        }
        if (isRecord(status) && status.sessionId !== null && status.phase === 'ended') {
          const cleanup = isRecord(status.cleanup) ? status.cleanup : null;
          const roomLeft = cleanup?.roomLeft === true;
          const inputCancelled = cleanup?.inputCancelled === true;
          const tracksReleased = typeof cleanup?.tracksReleased === 'number' ? cleanup.tracksReleased : -1;
          safeLog('terminal.cleanup.readback', {role, roomLeft, inputCancelled, tracksReleased});
          if (!roomLeft || !inputCancelled || tracksReleased < expectedTracks)
            failures.push(`${role}_REMOTE_RESOURCES_NOT_RELEASED`);
        }
      } catch {
        failures.push(`${role}_REMOTE_STATUS_READBACK_FAILED`);
      }
    }
    const diagnosticRoles = paired
      ? ([
          ['MASTER', master],
          ['PAIR_SLAVE', peer],
        ] as const)
      : ([['MASTER', master]] as const);
    for (const [role, connection] of diagnosticRoles) {
      const rolePrefix = role === 'PAIR_SLAVE' ? 'role=PAIR_SLAVE ' : '';
      const marker = (
        source: 'android-runtime' | 'android-native-remote',
        status: 'READ' | 'LOG_NOT_AVAILABLE',
        code?: string,
        lines?: number,
      ) => {
        process.stdout.write(
          `TERMINAL_AUTOMATION_DIAGNOSTICS run=${runId} ${rolePrefix}source=${source} status=${status}${lines === undefined ? '' : ` lines=${lines}`}${code === undefined ? '' : ` code=${code}`}\n`,
        );
      };
      if (connection === undefined) {
        marker('android-runtime', 'LOG_NOT_AVAILABLE', 'DEVICE_NOT_CONNECTED');
        marker('android-native-remote', 'LOG_NOT_AVAILABLE', 'DEVICE_NOT_CONNECTED');
        continue;
      }
      try {
        const runtimeLog = await connection.readRuntimeFailureDiagnostics(packageIdentity.packageId);
        const lines = runtimeLog.split(/\r?\n/u).filter(Boolean).length;
        safeLog('android.diagnostics.read', {role, source: 'runtime', lines});
        marker('android-runtime', 'READ', undefined, lines);
      } catch (error) {
        const code = safeFailureCode(error);
        safeLog('android.diagnostics.unavailable', {role, source: 'runtime', failureCode: code});
        marker('android-runtime', 'LOG_NOT_AVAILABLE', code);
      }
      try {
        const native = await connection.readRemoteControlDiagnostics(packageIdentity.packageId);
        safeLog('android.diagnostics.read', {
          role,
          source: 'native-remote',
          lines: native.lineCount,
          eventKinds: native.eventKinds.length,
        });
        marker('android-native-remote', 'READ', undefined, native.lineCount);
      } catch (error) {
        const code = safeFailureCode(error);
        safeLog('android.diagnostics.unavailable', {role, source: 'native-remote', failureCode: code});
        marker('android-native-remote', 'LOG_NOT_AVAILABLE', code);
      }
    }
    for (const item of diagnostics) item.close();
    try {
      await browser?.close();
    } catch {
      failures.push('ADMIN_BROWSER_CLOSE_FAILED');
    }
    for (const [role, connection, wasAbsent, installAttempted] of [
      ['PEER', peer, peerWasAbsent, peerInstallAttempted],
      ['MASTER', master, masterWasAbsent, masterInstallAttempted],
    ] as const) {
      if (connection === undefined) continue;
      try {
        if (wasAbsent && (installAttempted || (await connection.isInstalled(packageIdentity.packageId)))) {
          await connection.forceStop(packageIdentity.packageId);
          await connection.uninstall(packageIdentity.packageId);
        }
        if (wasAbsent && (await connection.isInstalled(packageIdentity.packageId)))
          failures.push(`${role}_PACKAGE_REMAINS`);
      } catch {
        failures.push(`${role}_PACKAGE_CLEANUP_FAILED`);
      }
      try {
        await connection.close();
      } catch {
        failures.push(`${role}_CONNECTION_CLEANUP_FAILED`);
      }
    }
    safeLog('cleanup.completed', {status: failures.length === 0 ? 'PASS' : 'FAIL', failureCount: failures.length});
    if (failures.length > 0) {
      process.stdout.write(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:${failures.join('_')}\n`);
      throw new Error(`TERMINAL_AUTOMATION_REMOTE_ANDROID_CLEANUP_FAILED_${failures.join('_')}`);
    }
    process.stdout.write('TERMINAL_AUTOMATION_DEVICE_CLEANUP_COMPLETE\n');
  }, 90_000);

  it('starts from the operations page and sends a real remote click through the native endpoint', async () => {
    if (master === undefined || masterSessionId === null || operationsPage === undefined || terminalRef === undefined)
      throw new Error('TERMINAL_AUTOMATION_REMOTE_FIXTURE_NOT_READY');
    const masterDiagnostics = diagnostics[0];
    if (masterDiagnostics === undefined) throw new Error('TERMINAL_AUTOMATION_MASTER_DIAGNOSTICS_NOT_READY');
    const session = master.driver.getSession(masterSessionId);
    if (session === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_SESSION_MISSING');
    try {
      const terminalName = mainSampleTerminalName(fixtureShape);
      await operationsPage.getByTestId(terminalUpdateTestIds.reportsTabLabel).click();
      const reportQuery = operationsPage.getByTestId(terminalUpdateTestIds.reportQuery);
      await reportQuery.waitFor({state: 'visible'});
      await reportQuery.fill(terminalName);
      await operationsPage.getByTestId(terminalUpdateTestIds.reportQuerySubmit).click();
      const terminalLink = operationsPage.getByTestId(terminalUpdateTestIds.reportOpen(terminalRef));
      await terminalLink.waitFor({state: 'visible'});
      await expect
        .poll(
          async () =>
            (await operationsPage!.getByTestId(terminalUpdateTestIds.reportRow(terminalRef!)).textContent())?.includes(
              '在线',
            ) ?? false,
          {timeout: 30_000},
        )
        .toBe(true);
      await terminalLink.click();
      await operationsPage.getByTestId(terminalUpdateTestIds.reportDetail).waitFor({state: 'visible'});
      await operationsPage.getByTestId(remoteControlTestIds.detailActions(terminalRef)).click();
      await operationsPage.getByTestId(remoteControlTestIds.start(terminalRef)).click();
      await operationsPage.getByTestId(remoteControlTestIds.workArea).waitFor({state: 'visible', timeout: 30_000});
      const expectedScreenCount = dual || paired ? 2 : 1;
      const active = await waitForSelector(
        master.driver,
        masterSessionId,
        'kernel.base.remote-control.selectRemoteControlStatus',
        [],
        value =>
          isRecord(value) &&
          value.phase === 'active' &&
          Array.isArray(value.readyScreens) &&
          value.readyScreens.length === expectedScreenCount,
        45_000,
      );
      expect(active).toMatchObject({
        phase: 'active',
        topologyKind:
          topology === 'mobile-single'
            ? 'MOBILE_SINGLE'
            : topology === 'laptop-single'
              ? 'LAPTOP_SINGLE'
              : topology === 'laptop-dual'
                ? 'LAPTOP_DUAL'
                : 'LAPTOP_PAIRED',
      });
      const expectedScreens = expectedScreenCount === 2 ? ['main', 'secondary'] : ['main'];
      const readyScreenNames =
        isRecord(active) && Array.isArray(active.readyScreens)
          ? active.readyScreens.flatMap(item =>
              isRecord(item) && typeof item.screen === 'string' ? [item.screen] : [],
            )
          : [];
      expect([...readyScreenNames].sort()).toEqual([...expectedScreens].sort());
      safeLog('remote.active.verified', {terminalRef, expectedScreenCount});
      for (const screen of expectedScreens as ('main' | 'secondary')[]) {
        const remoteScreen = await readSelector(
          master.driver,
          masterSessionId,
          'kernel.base.remote-control.selectRemoteControlScreen',
          [screen],
        );
        expect(remoteScreen).toMatchObject({screen, streamId: expect.any(String), trackSid: expect.any(String)});
        if (
          !isRecord(remoteScreen) ||
          typeof remoteScreen.widthPx !== 'number' ||
          remoteScreen.widthPx <= 0 ||
          typeof remoteScreen.heightPx !== 'number' ||
          remoteScreen.heightPx <= 0
        ) {
          throw new Error('TERMINAL_AUTOMATION_REMOTE_SCREEN_GEOMETRY_INVALID');
        }
        const video = operationsPage.getByTestId(remoteControlTestIds.screen(screen));
        await expect
          .poll(
            () =>
              video.evaluate(
                (element: HTMLVideoElement) =>
                  element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
                  element.videoWidth > 0 &&
                  element.videoHeight > 0,
              ),
            {timeout: 30_000},
          )
          .toBe(true);
        safeLog('remote.video.ready', {screen});
      }
      await dispatchObservedUiCommand({
        server: master.driver,
        sessionId: masterSessionId,
        workspace: 'MAIN',
        displayMode: 'PRIMARY',
        commandName: 'kernel.feature.sample-staff-session.login',
        onRequestIdentified: masterDiagnostics.requestStarted,
        onRequestFinished: masterDiagnostics.requestFinished,
        onObserverStep: step => safeLog('runtime.command.observation', {step}),
        action: async () => {
          await enterRemoteKeyboardText({
            connection: master!,
            sessionId: masterSessionId!,
            operationsPage: operationsPage!,
            fieldTestID: mainSampleTestIds.staffOperatorName,
            value: 'A001',
          });
          await enterRemoteKeyboardText({
            connection: master!,
            sessionId: masterSessionId!,
            operationsPage: operationsPage!,
            fieldTestID: mainSampleTestIds.staffPasscode,
            value: '1111',
          });
          await clickRemoteTarget({
            connection: master!,
            sessionId: masterSessionId!,
            operationsPage: operationsPage!,
            screenSlot: 'main',
            testID: mainSampleTestIds.staffLoginSubmit,
            surface: 'PRIMARY',
            displayIndex: 0,
          });
        },
      });
      const qualification = await waitForSelector(
        master.driver,
        masterSessionId,
        'kernel.feature.sample-staff-session.selectHostStaffQualification',
        [],
        value => isRecord(value) && value.status === 'authenticated' && value.operatorName === 'A001',
        30_000,
      );
      expect(qualification).toMatchObject({status: 'authenticated', operatorName: 'A001'});
      const screen = await readSelector(master.driver, masterSessionId, 'kernel.base.ui-state.selectScreen', [
        'PRIMARY',
        'main',
      ]);
      expect(screen).toMatchObject({
        partKey: sample === 'console' ? 'sample.desk.member-list' : 'sample.wallpaper.picker',
      });
      safeLog('business.remote-login.verified', {appName, terminalRef});

      if (sample === 'wallpaper') {
        const beforeScroll = await readRegisteredBounds({
          connection: master,
          sessionId: masterSessionId,
          testID: mainSampleTestIds.wallpaperOptionW3,
          surface: 'PRIMARY',
          displayIndex: 0,
        });
        await dragRemoteTarget({
          connection: master,
          sessionId: masterSessionId,
          operationsPage,
          screenSlot: 'main',
          testID: mainSampleTestIds.wallpaperOptionsScroll,
          surface: 'PRIMARY',
          displayIndex: 0,
        });
        const afterScroll = await readRegisteredBounds({
          connection: master,
          sessionId: masterSessionId,
          testID: mainSampleTestIds.wallpaperOptionW3,
          surface: 'PRIMARY',
          displayIndex: 0,
        });
        const scrollDeltaPx = Math.abs(afterScroll.y - beforeScroll.y);
        expect(scrollDeltaPx).toBeGreaterThan(1);
        safeLog('business.remote-scroll.verified', {scrollDeltaPx: Number(scrollDeltaPx.toFixed(2))});

        const currentWallpaper = await readSelector(
          master.driver,
          masterSessionId,
          'kernel.feature.sample-wallpaper.selectWallpaperId',
          [],
        );
        const targetWallpaper: 'w2' | 'w3' = currentWallpaper === 'w3' ? 'w2' : 'w3';
        const targetOptionTestID =
          targetWallpaper === 'w2' ? mainSampleTestIds.wallpaperOptionW2 : mainSampleTestIds.wallpaperOptionW3;
        await dispatchObservedUiCommand({
          server: master.driver,
          sessionId: masterSessionId,
          workspace: 'MAIN',
          displayMode: 'PRIMARY',
          commandName: wallpaperCommandNames.optionSelected,
          onRequestIdentified: masterDiagnostics.requestStarted,
          onRequestFinished: masterDiagnostics.requestFinished,
          onObserverStep: step => safeLog('runtime.command.observation', {step}),
          action: () =>
            clickRemoteTarget({
              connection: master!,
              sessionId: masterSessionId!,
              operationsPage: operationsPage!,
              screenSlot: 'main',
              testID: targetOptionTestID,
              surface: 'PRIMARY',
              displayIndex: 0,
            }),
        });
        const pendingWallpaper = await waitForSelector(
          master.driver,
          masterSessionId,
          'kernel.feature.sample-wallpaper.selectPendingWallpaperId',
          [],
          value => value === targetWallpaper,
          15_000,
        );
        expect(pendingWallpaper).toBe(targetWallpaper);
        await dispatchObservedUiCommand({
          server: master.driver,
          sessionId: masterSessionId,
          workspace: 'MAIN',
          displayMode: 'PRIMARY',
          commandName: wallpaperCommandNames.confirmRequested,
          onRequestIdentified: masterDiagnostics.requestStarted,
          onRequestFinished: masterDiagnostics.requestFinished,
          onObserverStep: step => safeLog('runtime.command.observation', {step}),
          action: () =>
            clickRemoteTarget({
              connection: master!,
              sessionId: masterSessionId!,
              operationsPage: operationsPage!,
              screenSlot: 'main',
              testID: mainSampleTestIds.wallpaperConfirm,
              surface: 'PRIMARY',
              displayIndex: 0,
            }),
        });
        const confirmedWallpaper = await waitForSelector(
          master.driver,
          masterSessionId,
          'kernel.feature.sample-wallpaper.selectWallpaperId',
          [],
          value => value === targetWallpaper,
          30_000,
        );
        expect(confirmedWallpaper).toBe(targetWallpaper);
        expect(
          await readSelector(
            master.driver,
            masterSessionId,
            'kernel.feature.sample-wallpaper.selectPendingWallpaperId',
            [],
          ),
        ).toBeUndefined();
        safeLog('business.remote-wallpaper.verified', {wallpaperId: targetWallpaper});
      }

      if (sample === 'console' && topology === 'laptop-single') {
        await dispatchObservedUiCommand({
          server: master.driver,
          sessionId: masterSessionId,
          workspace: 'MAIN',
          displayMode: 'PRIMARY',
          commandName: 'ui.feature.sample-member-desk.member-form-opened',
          onRequestIdentified: masterDiagnostics.requestStarted,
          onRequestFinished: masterDiagnostics.requestFinished,
          onObserverStep: step => safeLog('runtime.command.observation', {step}),
          action: () =>
            clickRemoteTarget({
              connection: master!,
              sessionId: masterSessionId!,
              operationsPage: operationsPage!,
              screenSlot: 'main',
              testID: mainSampleTestIds.memberListEmptyAction,
              surface: 'PRIMARY',
              displayIndex: 0,
              duringPress: async () => {
                safeLog('local-input.conflict.started', {testID: mainSampleTestIds.memberListEmptyAction});
                await master!.tapRegisteredNode({
                  sessionId: masterSessionId!,
                  testID: mainSampleTestIds.memberListEmptyAction,
                  surface: 'primary',
                  displayIndex: 0,
                });
                safeLog('local-input.conflict.dispatched', {testID: mainSampleTestIds.memberListEmptyAction});
              },
            }),
        });
        const conflictNotice = operationsPage.getByText('本次操作已取消，请重新操作', {exact: true});
        await conflictNotice.waitFor({state: 'visible', timeout: 10_000});
        expect(await conflictNotice.isVisible()).toBe(true);
        const localInputScreen = await waitForSelector(
          master.driver,
          masterSessionId,
          'kernel.base.ui-state.selectScreen',
          ['PRIMARY', 'main'],
          value => isRecord(value) && value.partKey === 'sample.desk.member-form',
          15_000,
        );
        expect(localInputScreen).toMatchObject({partKey: 'sample.desk.member-form'});
        await dispatchObservedUiCommand({
          server: master.driver,
          sessionId: masterSessionId,
          workspace: 'MAIN',
          displayMode: 'PRIMARY',
          commandName: 'ui.feature.sample-member-desk.member-form-cancelled',
          onRequestIdentified: masterDiagnostics.requestStarted,
          onRequestFinished: masterDiagnostics.requestFinished,
          onObserverStep: step => safeLog('runtime.command.observation', {step}),
          action: () =>
            clickRemoteTarget({
              connection: master!,
              sessionId: masterSessionId!,
              operationsPage: operationsPage!,
              screenSlot: 'main',
              testID: mainSampleTestIds.memberFormCancel,
              surface: 'PRIMARY',
              displayIndex: 0,
            }),
        });
        const restoredScreen = await waitForSelector(
          master.driver,
          masterSessionId,
          'kernel.base.ui-state.selectScreen',
          ['PRIMARY', 'main'],
          value => isRecord(value) && value.partKey === 'sample.desk.member-list',
          15_000,
        );
        expect(restoredScreen).toMatchObject({partKey: 'sample.desk.member-list'});
        safeLog('local-input.conflict.verified', {
          noticeVisible: true,
          localScreenRestored: true,
          remoteGestureResumed: true,
        });
      }

      await operationsPage.getByTestId(remoteControlTestIds.end).click();
      await waitForSelector(
        master.driver,
        masterSessionId,
        'kernel.base.remote-control.selectRemoteControlStatus',
        [],
        value =>
          isRecord(value) &&
          value.phase === 'ended' &&
          isRecord(value.cleanup) &&
          value.cleanup.roomLeft === true &&
          value.cleanup.inputCancelled === true,
        30_000,
      );
      safeLog('remote.end.verified', {terminalRef});
      await operationsPage.getByTestId(remoteControlTestIds.close).click();
      await operationsPage.getByTestId(remoteControlTestIds.workArea).waitFor({state: 'hidden'});
    } catch (error) {
      for (const item of diagnostics) item.report(error);
      safeLog('business.failed', {failureCode: safeFailureCode(error)});
      for (const [role, connection] of [
        ['MASTER', master],
        ['PEER', peer],
      ] as const) {
        if (connection === undefined) continue;
        try {
          const status = connection.driver.getDiagnostics();
          safeLog('android.driver.diagnostics', {
            role,
            activeSessions: status.activeSessions,
            activeSockets: status.activeSockets,
            rejectedMessages: status.rejectedMessages,
          });
        } catch {
          safeLog('android.driver.diagnostics', {role, status: 'LOG_NOT_AVAILABLE'});
        }
        try {
          const summary = await connection.systemUi.readScreenSummary();
          safeLog('android.screen.diagnostics', {
            role,
            summaryKind: summary.includes('React') ? 'APP_VISIBLE' : 'SYSTEM_OR_OTHER',
          });
        } catch {
          safeLog('android.screen.diagnostics', {role, status: 'LOG_NOT_AVAILABLE'});
        }
      }
      throw error;
    }
  }, 180_000);
});

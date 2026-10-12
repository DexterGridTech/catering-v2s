import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {mkdirSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, it} from 'vitest';
import {chromium, type Browser, type Locator, type Page} from 'playwright';
import {expect} from 'playwright/test';
import type {Client} from '@devicefarmer/adbkit';
import {topologyTransportConfig} from '@catering-v2s/kernel-base-contracts';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {pairByHostTopologyCommand, setTopologyHostEnabledCommand} from '@catering-v2s/kernel-base-topology';
import {projectBasicSliceName} from '@catering-v2s/kernel-feature-project-basic';
import {storeBasicSliceName} from '@catering-v2s/kernel-feature-store-basic';
import {remoteControlTestIds} from '../../../apps/frontend/operations-admin/src/app/automation/remoteControlTestIds.ts';
import {terminalUpdateTestIds} from '../../../apps/frontend/operations-admin/src/app/automation/terminalUpdateTestIds.ts';
import {roleHomeTestIds} from '../../../apps/frontend/operations-admin/src/features/role-home-bootstrap/roleHomeTestIds.ts';
import {inputTestIds} from '@catering-v2s/ui-base-input/test-ids';
import {
  ANDROID_SCREEN_CLICK_INTERVAL_MS,
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
  waitForAndroidVirtualKeyboardDismissed,
  waitForInteractiveAndroidKeyboardKey,
  waitForSelector,
  type AndroidAutomationConnection,
} from '../src/index.ts';
import {mainSampleTerminalName} from '../src/mainSampleJourneyConfig.ts';
import {mainSampleTestIds} from '../src/mainSampleTestIds.js';
import {createManagedActivationFixtureApi} from '../fixtures/managedActivation.ts';
import {terminalAutomationMemberFixture} from '../fixtures/member.js';
import {
  operationsRemoteControlOperationOfPath,
  projectOperationsRemoteControlLog,
  safeBrowserRequestFailureReason,
} from '../src/browserNetworkDiagnostics.js';
import {
  attachLiveKitSignalDiagnostics,
  captureBrowserRtcDiagnostics,
  installBrowserRtcProbe,
} from '../src/browserRtcProbe.js';

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
let masterRemoteControlSessionId: string | null = null;
let peerRemoteControlSessionId: string | null = null;
let masterDeviceId: string | null = null;
let peerDeviceId: string | null = null;
let terminalRef: string | undefined;
let diagnostics: ReturnType<typeof createJourneyFailureDiagnostics>[] = [];
let masterWasAbsent = false;
let peerWasAbsent = false;
let masterInstallAttempted = false;
let peerInstallAttempted = false;
let setupStage = 'input-validation';
let rtcFailureSnapshotCaptured = false;

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

const diagnosticText = (value: string): string => value.slice(0, 4_096);

const readVideoReadback = async (video: Locator) =>
  video.evaluate(element => {
    const current = element instanceof HTMLVideoElement ? element : undefined;
    const stream = current?.srcObject instanceof MediaStream ? current.srcObject : undefined;
    const tracks = stream?.getVideoTracks() ?? [];
    const duration = current?.duration ?? Number.NaN;
    return {
      tagName: element.tagName,
      isVideo: current !== undefined,
      readyState: current?.readyState ?? -1,
      networkState: current?.networkState ?? -1,
      videoWidth: current?.videoWidth ?? 0,
      videoHeight: current?.videoHeight ?? 0,
      paused: current?.paused ?? true,
      muted: current?.muted ?? false,
      currentTime: current?.currentTime ?? 0,
      durationSeconds: Number.isFinite(duration) ? duration : -1,
      srcObjectPresent: current?.srcObject !== null && current?.srcObject !== undefined,
      streamActive: stream?.active ?? false,
      videoTrackCount: tracks.length,
      liveTrackCount: tracks.filter(track => track.readyState === 'live').length,
      enabledTrackCount: tracks.filter(track => track.enabled).length,
      mutedTrackCount: tracks.filter(track => track.muted).length,
    };
  });

const apiOperation = (url: string): string | undefined => {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return 'operations.invalid-url';
  }
  if (!pathname.startsWith('/api/')) return undefined;
  if (pathname.endsWith('/auth/session')) return 'admin.session';
  const remoteControlOperation = operationsRemoteControlOperationOfPath(pathname);
  if (remoteControlOperation !== undefined) return `remote.${remoteControlOperation}`;
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
      failureDetail: diagnosticText(request.failure()?.errorText ?? 'No browser failure detail'),
    });
  });
  page.on('console', message => {
    const projected = projectOperationsRemoteControlLog(message.text());
    if (projected !== undefined) {
      safeLog('operations.frontend.remote-control', projected);
      return;
    }
    if (message.type() === 'info') {
      return;
    }
    if (message.type() !== 'error' && message.type() !== 'warning') return;
    safeLog('admin.console.diagnostic', {level: message.type(), detail: diagnosticText(message.text())});
  });
  page.on('pageerror', error =>
    safeLog('admin.page.error', {
      errorName: error.name,
      message: diagnosticText(error.message),
      stack: diagnosticText(error.stack ?? 'No JavaScript stack'),
    }),
  );
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
  const control = page.getByTestId(controlTestId);
  const input = control.locator('input').first();
  await input.waitFor({state: 'visible', timeout: 30_000});
  safeLog('admin.role-context.selector.ready', {inputEnabled: await input.isEnabled()});
  await expect(input).toBeEnabled();
  await control.click();
  const [ariaExpanded, visibleDropdownCount, allDropdownCount] = await Promise.all([
    input.getAttribute('aria-expanded'),
    page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible').count(),
    page.locator('.ant-select-dropdown').count(),
  ]);
  safeLog('admin.role-context.selector.opened', {
    ariaExpanded: ariaExpanded ?? 'missing',
    hasAriaControls: (await input.getAttribute('aria-controls')) !== null,
    visibleDropdownCount,
    allDropdownCount,
  });
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
    const [visibleOptionCount, allDropdownCount, emptyStateCount] = await Promise.all([
      options.count().catch(() => -1),
      page
        .locator('.ant-select-dropdown')
        .count()
        .catch(() => -1),
      page
        .getByTestId('operations-role-context-empty')
        .count()
        .catch(() => -1),
    ]);
    const ariaExpanded = await input.getAttribute('aria-expanded').catch(() => null);
    safeLog('admin.role-context.option.match-failed', {
      ariaExpanded: ariaExpanded ?? 'missing',
      dropdownVisible: await dropdown.isVisible().catch(() => false),
      visibleOptionCount,
      allDropdownCount,
      emptyStateCount,
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
): Promise<
  Readonly<{
    readonly nodeInstanceId: string;
    readonly layoutRevision: number;
    readonly role: string;
    readonly disabled: boolean | null;
    readonly bounds: Readonly<{x: number; y: number; width: number; height: number}>;
  }>
> => {
  const query = responseResult(
    await input.connection.driver.request(input.sessionId, 'controls.query', {
      filter: {testID: input.testID, surface: input.surface, displayIndex: input.displayIndex},
    }),
  );
  const nodeCount = isRecord(query) && Array.isArray(query.nodes) ? query.nodes.length : -1;
  safeLog('remote.controls.query', {
    testID: input.testID,
    surface: input.surface,
    displayIndex: input.displayIndex,
    nodeCount,
  });
  if (!isRecord(query) || !Array.isArray(query.nodes) || query.nodes.length !== 1 || !isRecord(query.nodes[0])) {
    if (isRecord(query) && Array.isArray(query.nodes)) {
      query.nodes.slice(0, 3).forEach((candidate, index) => {
        if (!isRecord(candidate)) return;
        const surface = isRecord(candidate.surface) ? candidate.surface : null;
        safeLog('remote.controls.query.candidate', {
          index,
          nodeInstanceId: typeof candidate.nodeInstanceId === 'string' ? candidate.nodeInstanceId : 'missing',
          role: typeof candidate.role === 'string' ? candidate.role : 'missing',
          nodeSurface: typeof surface?.surface === 'string' ? surface.surface : 'missing',
          displayIndex: typeof surface?.displayIndex === 'number' ? surface.displayIndex : -1,
          layoutRevision: typeof surface?.layoutRevision === 'number' ? surface.layoutRevision : -1,
        });
      });
    }
    throw new Error('TERMINAL_AUTOMATION_REMOTE_CONTROL_NODE_NOT_UNIQUE');
  }
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
  const target = Object.freeze({
    nodeInstanceId: node.nodeInstanceId,
    layoutRevision: node.surface.layoutRevision as number,
    role: typeof node.role === 'string' ? node.role : 'unknown',
    disabled:
      isRecord(node.accessibilityState) && typeof node.accessibilityState.disabled === 'boolean'
        ? node.accessibilityState.disabled
        : null,
    bounds: bounds as Readonly<{x: number; y: number; width: number; height: number}>,
  });
  safeLog('remote.controls.target-ready', {
    testID: input.testID,
    nodeInstanceId: target.nodeInstanceId,
    role: target.role,
    disabled: target.disabled ?? 'unknown',
    surface: input.surface,
    displayIndex: input.displayIndex,
    layoutRevision: target.layoutRevision,
    boundsX: target.bounds.x,
    boundsY: target.bounds.y,
    boundsWidth: target.bounds.width,
    boundsHeight: target.bounds.height,
  });
  return target;
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
): Promise<
  Readonly<{
    readonly x: number;
    readonly y: number;
    readonly u: number;
    readonly v: number;
    readonly target: Awaited<ReturnType<typeof readRegisteredBounds>>;
  }>
> => {
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
      testID: String(inputTestIds.surfaceFrame),
      surface: input.surface,
      displayIndex: input.displayIndex,
    }),
  ]);
  const targetBounds = target.bounds;
  const surfaceBounds = surface.bounds;
  if (surfaceBounds.width <= 0 || surfaceBounds.height <= 0 || targetBounds.width <= 0 || targetBounds.height <= 0)
    throw new Error('TERMINAL_AUTOMATION_REMOTE_CONTROL_BOUNDS_INVALID');
  const u = (targetBounds.x + targetBounds.width * (input.targetU ?? 0.5) - surfaceBounds.x) / surfaceBounds.width;
  const v = (targetBounds.y + targetBounds.height * (input.targetV ?? 0.5) - surfaceBounds.y) / surfaceBounds.height;
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) {
    safeLog('remote.target.outside-surface', {
      screenSlot: input.screenSlot,
      testID: input.testID,
      targetX: targetBounds.x,
      targetY: targetBounds.y,
      targetWidth: targetBounds.width,
      targetHeight: targetBounds.height,
      frameX: surfaceBounds.x,
      frameY: surfaceBounds.y,
      frameWidth: surfaceBounds.width,
      frameHeight: surfaceBounds.height,
      u,
      v,
    });
    throw new Error('TERMINAL_AUTOMATION_REMOTE_TARGET_OUTSIDE_SURFACE');
  }
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
  safeLog('remote.target.mapping', {
    screenSlot: input.screenSlot,
    testID: input.testID,
    surfaceX: surfaceBounds.x,
    surfaceY: surfaceBounds.y,
    surfaceWidth: surfaceBounds.width,
    surfaceHeight: surfaceBounds.height,
    normalizedU: u,
    normalizedV: v,
    videoX: videoBounds.x,
    videoY: videoBounds.y,
    videoCssWidth: videoBounds.width,
    videoCssHeight: videoBounds.height,
    videoPixelWidth: videoSize.width,
    videoPixelHeight: videoSize.height,
    browserX: x,
    browserY: y,
  });
  return {x, y, u, v, target};
};

const dispatchRemotePointerAndWaitForTargetPressIn = async (
  input: Readonly<{
    readonly connection: AndroidAutomationConnection;
    readonly sessionId: string;
    readonly testID: string;
    readonly surface: 'PRIMARY' | 'SECONDARY';
    readonly displayIndex: 0 | 1;
    readonly target: Awaited<ReturnType<typeof readRegisteredBounds>>;
    readonly dispatch: () => Promise<Readonly<{forSeq: number; status: string; reason: string}>>;
  }>,
): Promise<Readonly<{forSeq: number; status: string; reason: string}>> => {
  const {target} = input;
  if (target.disabled === true) {
    safeLog('remote.controls.target-disabled', {
      testID: input.testID,
      nodeInstanceId: target.nodeInstanceId,
      layoutRevision: target.layoutRevision,
    });
    throw new Error('TERMINAL_AUTOMATION_REMOTE_CONTROL_TARGET_DISABLED');
  }

  const subscriptionId = `remote-target-${randomUUID()}`;
  const observedPhases: string[] = [];
  type TargetObservation =
    Readonly<{kind: 'press-in'; locationX: number; locationY: number}> | Readonly<{kind: 'error'; code: string}>;
  let resolveTargetObservation!: (value: TargetObservation | null) => void;
  const targetObservation = new Promise<TargetObservation | null>(resolve => {
    resolveTargetObservation = resolve;
  });
  let subscribed = false;
  let removeListener: (() => void) | undefined;
  let subscriptionError: string | undefined;
  let primaryError: unknown;
  try {
    removeListener = input.connection.driver.onMessage(input.sessionId, message => {
      if (!isRecord(message.body) || message.body.subscriptionId !== subscriptionId) return;
      if (message.type === 'error') {
        const code = typeof message.body.code === 'string' ? message.body.code : 'UNKNOWN';
        subscriptionError = code;
        safeLog('remote.controls.target-subscription-error', {
          testID: input.testID,
          nodeInstanceId: target.nodeInstanceId,
          layoutRevision: target.layoutRevision,
          code,
        });
        resolveTargetObservation({kind: 'error', code});
        return;
      }
      if (message.type !== 'event') return;
      const interaction = message.body.interaction;
      if (!isRecord(interaction) || !isRecord(interaction.node)) return;
      const node = interaction.node;
      if (!isRecord(node.surface)) return;
      const nodeSurface = node.surface;
      if (
        node.nodeInstanceId !== target.nodeInstanceId ||
        nodeSurface.layoutRevision !== target.layoutRevision ||
        nodeSurface.surface !== input.surface ||
        nodeSurface.displayIndex !== input.displayIndex ||
        (interaction.phase !== 'press-in' && interaction.phase !== 'press-out')
      ) {
        return;
      }
      observedPhases.push(interaction.phase);
      safeLog('remote.controls.target-interaction', {
        testID: input.testID,
        nodeInstanceId: target.nodeInstanceId,
        layoutRevision: target.layoutRevision,
        phase: interaction.phase,
        locationX: typeof interaction.locationX === 'number' ? interaction.locationX : -1,
        locationY: typeof interaction.locationY === 'number' ? interaction.locationY : -1,
      });
      if (interaction.phase === 'press-in') {
        resolveTargetObservation({
          kind: 'press-in',
          locationX: typeof interaction.locationX === 'number' ? interaction.locationX : -1,
          locationY: typeof interaction.locationY === 'number' ? interaction.locationY : -1,
        });
      }
    });

    const subscribe = responseResult(
      await input.connection.driver.request(input.sessionId, 'controls.subscribe', {
        subscriptionId,
        filter: {testID: input.testID, surface: input.surface, displayIndex: input.displayIndex},
      }),
    );
    subscribed = true;
    if (!isRecord(subscribe) || subscribe.subscriptionId !== subscriptionId || !Array.isArray(subscribe.nodes)) {
      throw new Error('TERMINAL_AUTOMATION_REMOTE_TARGET_SUBSCRIBE_INVALID');
    }
    if (subscribe.nodes.length !== 1 || !isRecord(subscribe.nodes[0])) {
      throw new Error('TERMINAL_AUTOMATION_REMOTE_TARGET_CHANGED_BEFORE_PRESS');
    }
    const current = subscribe.nodes[0];
    if (!isRecord(current.surface)) throw new Error('TERMINAL_AUTOMATION_REMOTE_TARGET_CHANGED_BEFORE_PRESS');
    const currentSurface = current.surface;
    if (
      current.nodeInstanceId !== target.nodeInstanceId ||
      currentSurface.layoutRevision !== target.layoutRevision ||
      currentSurface.surface !== input.surface ||
      currentSurface.displayIndex !== input.displayIndex
    ) {
      throw new Error('TERMINAL_AUTOMATION_REMOTE_TARGET_CHANGED_BEFORE_PRESS');
    }
    if (isRecord(current.accessibilityState) && current.accessibilityState.disabled === true) {
      throw new Error('TERMINAL_AUTOMATION_REMOTE_CONTROL_TARGET_DISABLED');
    }
    safeLog('remote.controls.target-observation-started', {
      testID: input.testID,
      nodeInstanceId: target.nodeInstanceId,
      layoutRevision: target.layoutRevision,
      disabled:
        isRecord(current.accessibilityState) && typeof current.accessibilityState.disabled === 'boolean'
          ? current.accessibilityState.disabled
          : 'unknown',
    });

    if (subscriptionError !== undefined) {
      throw new Error(`TERMINAL_AUTOMATION_REMOTE_TARGET_SUBSCRIPTION_${subscriptionError}`);
    }

    const result = await input.dispatch();
    if (result.status !== 'DISPATCHED') return result;
    let pressTimeout: ReturnType<typeof setTimeout> | undefined;
    const press = await Promise.race([
      targetObservation,
      new Promise<TargetObservation | null>(resolve => {
        pressTimeout = setTimeout(() => resolve(null), 2_000);
      }),
    ]);
    if (pressTimeout !== undefined) clearTimeout(pressTimeout);
    if (press === null) {
      safeLog('remote.controls.target-press-in-missing', {
        testID: input.testID,
        nodeInstanceId: target.nodeInstanceId,
        layoutRevision: target.layoutRevision,
        observedPhases: observedPhases.join(',') || 'none',
        forSeq: result.forSeq,
      });
      throw new Error('TERMINAL_AUTOMATION_REMOTE_TARGET_PRESS_IN_NOT_OBSERVED');
    }
    if (press.kind === 'error') {
      throw new Error(`TERMINAL_AUTOMATION_REMOTE_TARGET_SUBSCRIPTION_${press.code}`);
    }
    safeLog('remote.controls.target-press-in-observed', {
      testID: input.testID,
      nodeInstanceId: target.nodeInstanceId,
      layoutRevision: target.layoutRevision,
      locationX: press.locationX,
      locationY: press.locationY,
      forSeq: result.forSeq,
    });
    return result;
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    removeListener?.();
    if (subscribed) {
      try {
        responseResult(
          await input.connection.driver.request(input.sessionId, 'controls.unsubscribe', {subscriptionId}),
        );
      } catch (error) {
        const code = error instanceof Error ? error.message : 'UNKNOWN';
        safeLog('remote.controls.target-unsubscribe-failed', {
          testID: input.testID,
          nodeInstanceId: target.nodeInstanceId,
          layoutRevision: target.layoutRevision,
          code,
          primaryFailurePreserved: primaryError !== undefined,
        });
        if (primaryError === undefined) throw error;
      }
    }
  }
};

const dispatchRemotePointerAndWaitForResult = async (
  input: Readonly<{
    readonly page: Page;
    readonly screen: 'main' | 'secondary';
    readonly dispatch: () => Promise<void>;
  }>,
): Promise<Readonly<{forSeq: number; status: string; reason: string}>> => {
  let pointerUpSeq: number | null = null;
  const resultBySequence = new Map<number, Readonly<{forSeq: number; status: string; reason: string}>>();
  let resolveResult!: (result: Readonly<{forSeq: number; status: string; reason: string}>) => void;
  const resultReceived = new Promise<Readonly<{forSeq: number; status: string; reason: string}>>(resolve => {
    resolveResult = resolve;
  });
  const onConsole = (message: import('playwright').ConsoleMessage): void => {
    const event = projectOperationsRemoteControlLog(message.text());
    if (event === undefined) return;
    if (
      event.sourceEvent === 'frontend.remote_control.pointer.up' &&
      event.diag_screen === input.screen &&
      typeof event.diag_seq === 'number'
    ) {
      pointerUpSeq = event.diag_seq;
      const result = resultBySequence.get(pointerUpSeq);
      if (result !== undefined) resolveResult(result);
      return;
    }
    if (
      event.sourceEvent === 'frontend.remote_control.input.result' &&
      typeof event.diag_forSeq === 'number' &&
      typeof event.outcome === 'string'
    ) {
      // INPUT_RESULT only carries forSeq; the UI sequence is unique across both screens
      // for this session, so correlate it to the already screen-scoped pointer-up.
      const result = Object.freeze({
        forSeq: event.diag_forSeq,
        status: event.outcome,
        reason: typeof event.diag_reason === 'string' ? event.diag_reason : 'NONE',
      });
      resultBySequence.set(result.forSeq, result);
      if (pointerUpSeq === result.forSeq) resolveResult(result);
    }
  };
  input.page.on('console', onConsole);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await input.dispatch();
    const result = await Promise.race([
      resultReceived,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                `TERMINAL_AUTOMATION_REMOTE_INPUT_RESULT_TIMEOUT screen=${input.screen} forSeq=${pointerUpSeq ?? 'unobserved'}`,
              ),
            ),
          5_000,
        );
      }),
    ]);
    return result;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    input.page.off('console', onConsole);
  }
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
  const isKeyboardKey = input.testID.startsWith('ui.base.input:virtual-keyboard:');
  if (isKeyboardKey) {
    await waitForInteractiveAndroidKeyboardKey({
      server: input.connection.driver,
      sessionId: input.sessionId,
      testID: input.testID,
      surface: input.surface === 'PRIMARY' ? 'primary' : 'secondary',
      displayIndex: input.displayIndex,
      waitTimeoutMs: 10_000,
    });
  }
  if (isKeyboardKey) {
    safeLog('terminal.remote-keyboard.ready', {
      testID: input.testID,
      surface: input.surface,
      displayIndex: input.displayIndex,
      keyEnabled: true,
      boundsInSurface: true,
    });
  }
  // Resolve the target and register its interaction observer inside the same
  // paced action. If layout changes during the 800ms gap, both the coordinates
  // and the observed node identity come from the new layout.
  const dispatchCurrentTarget = async (
    markClickStarted: () => void,
  ): Promise<Readonly<{readonly point: Awaited<ReturnType<typeof remoteTargetPoint>>; readonly inputResult: Awaited<ReturnType<typeof dispatchRemotePointerAndWaitForTargetPressIn>>}>> => {
    const point = await remoteTargetPoint(input);
    safeLog('pointer.started', {
      screenSlot: input.screenSlot,
      testID: input.testID,
      nodeInstanceId: point.target.nodeInstanceId,
      layoutRevision: point.target.layoutRevision,
      targetDisabled: point.target.disabled ?? 'unknown',
      normalizedU: point.u,
      normalizedV: point.v,
      browserX: point.x,
      browserY: point.y,
    });
    const inputResult = await dispatchRemotePointerAndWaitForTargetPressIn({
      connection: input.connection,
      sessionId: input.sessionId,
      testID: input.testID,
      surface: input.surface,
      displayIndex: input.displayIndex,
      target: point.target,
      dispatch: () =>
        dispatchRemotePointerAndWaitForResult({
          page: input.operationsPage,
          screen: input.screenSlot,
          dispatch: async () => {
            await input.operationsPage.mouse.move(point.x, point.y);
            markClickStarted();
            await input.operationsPage.mouse.down();
            try {
              // The pointer goes through LiveKit DataChannel to the native MotionEvent port.
              await input.duringPress?.();
            } finally {
              await input.operationsPage.mouse.up();
            }
          },
        }),
    });
    return Object.freeze({point, inputResult});
  };
  let clickWaitMs = 0;
  const dispatched = input.duringPress === undefined
    ? await input.connection.runPacedClick(dispatchCurrentTarget)
    : Object.freeze({result: await dispatchCurrentTarget(() => undefined), waitMs: 0});
  clickWaitMs = dispatched.waitMs;
  const {point, inputResult} = dispatched.result;
  safeLog('pointer.cadence.applied', {minimumIntervalMs: ANDROID_SCREEN_CLICK_INTERVAL_MS, waitMs: clickWaitMs});
  if (inputResult.status !== 'DISPATCHED') {
    safeLog('pointer.rejected', {
      screenSlot: input.screenSlot,
      testID: input.testID,
      forSeq: inputResult.forSeq,
      status: inputResult.status,
      reason: inputResult.reason,
    });
    throw new Error(
      `TERMINAL_AUTOMATION_REMOTE_POINTER_REJECTED testID=${input.testID} status=${inputResult.status} reason=${inputResult.reason}`,
    );
  }
  safeLog('pointer.completed', {
    screenSlot: input.screenSlot,
    testID: input.testID,
    forSeq: inputResult.forSeq,
    status: inputResult.status,
  });
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
    readonly completeSteps?: number;
    readonly waitForDismissal?: boolean;
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
    focusInput: async testID => clickRemoteTarget({...target, testID}),
    click: async testID => clickRemoteTarget({...target, testID}),
  });
  const display = {mode: 'PRIMARY', index: 0} as const;
  await keyboard.enterTextAndComplete(input.fieldTestID, input.value, display);
  if (input.completeSteps !== undefined) {
    await keyboard.completeInputSteps(input.completeSteps, display);
  }
  if (input.waitForDismissal === true) {
    safeLog('terminal.remote-keyboard.dismissal-wait.started', {
      fieldTestID: input.fieldTestID,
      surface: display.mode,
      displayIndex: display.index,
    });
    await waitForAndroidVirtualKeyboardDismissed({
      server: input.connection.driver,
      sessionId: input.sessionId,
      surface: display.mode === 'PRIMARY' ? 'primary' : 'secondary',
      displayIndex: display.index,
      waitTimeoutMs: 5_000,
    });
    safeLog('terminal.remote-keyboard.dismissed', {
      fieldTestID: input.fieldTestID,
      surface: display.mode,
      displayIndex: display.index,
    });
  }
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
  setupStage = `android-${role.toLowerCase()}-install`;
  safeLog('android.app.install.started', {role, packageId: packageIdentity.packageId});
  if (await connection.isInstalled(packageIdentity.packageId))
    throw new Error(`TERMINAL_AUTOMATION_${role}_RUN_PACKAGE_ALREADY_INSTALLED`);
  if (role === 'MASTER') masterWasAbsent = true;
  else peerWasAbsent = true;
  if (role === 'MASTER') masterInstallAttempted = true;
  else peerInstallAttempted = true;
  await connection.install(apkPath);
  safeLog('android.app.install.completed', {role, packageId: packageIdentity.packageId});
  if (!(await connection.isInstalled(packageIdentity.packageId)))
    throw new Error(`TERMINAL_AUTOMATION_${role}_INSTALL_READBACK_FAILED`);
  setupStage = `android-${role.toLowerCase()}-launch`;
  safeLog('android.app.launch.started', {role, packageId: packageIdentity.packageId});
  await connection.launch(`${packageIdentity.packageId}/${applicationId}.MainActivity`);
  safeLog('android.app.launch.completed', {role});
  setupStage = `android-${role.toLowerCase()}-session`;
  safeLog('android.app.session.wait.started', {role, expectedAppName: appName, timeoutMs: 20_000});
  let session;
  try {
    session = await waitForAutomationSession(connection.driver, value => value.appName === appName, 20_000);
  } catch (error) {
    const driver = connection.driver.getDiagnostics();
    safeLog('android.app.session.wait.failed', {
      role,
      expectedAppName: appName,
      failureCode: safeFailureCode(error),
      socketConnections: driver.socketConnections,
      authenticatedSessions: driver.authenticatedSessions,
      authenticationTimeouts: driver.authenticationTimeouts,
      rejectedMessages: driver.rejectedMessages,
      activeSockets: driver.activeSockets,
      activeSessions: driver.activeSessions,
    });
    try {
      safeLog('android.screen.summary', {role, summary: await connection.systemUi.readScreenSummary()});
    } catch (screenError) {
      safeLog('android.screen.summary.unavailable', {role, failureCode: safeFailureCode(screenError)});
    }
    throw error;
  }
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
      await installBrowserRtcProbe(operationsPage, 'operations', safeLog);
      attachLiveKitSignalDiagnostics(operationsPage, 'operations', safeLog);
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
    if (operationsPage !== undefined && !rtcFailureSnapshotCaptured) {
      await captureBrowserRtcDiagnostics(operationsPage, 'operations', safeLog);
      rtcFailureSnapshotCaptured = true;
    }
    try {
      if (operationsPage !== undefined) {
        for (const [role, connection, driverSessionId, currentRemoteSessionId] of [
          ['MASTER', master, masterSessionId, masterRemoteControlSessionId],
          ['PEER', peer, peerSessionId, peerRemoteControlSessionId],
        ] as const) {
          if (connection === undefined || driverSessionId === null) continue;
          try {
            const status = await readSelector(
              connection.driver,
              driverSessionId,
              'kernel.base.remote-control.selectRemoteControlStatus',
              [],
            );
            if (!isRecord(status)) {
              failures.push(`${role}_REMOTE_STATUS_INVALID`);
              continue;
            }
            const observedId = typeof status.sessionId === 'string' ? status.sessionId : null;
            if (currentRemoteSessionId !== null && observedId !== currentRemoteSessionId) {
              failures.push(`${role}_REMOTE_SESSION_IDENTITY_CHANGED`);
              continue;
            }
            if (observedId !== null) {
              if (role === 'MASTER') masterRemoteControlSessionId = observedId;
              else peerRemoteControlSessionId = observedId;
            }
            safeLog('terminal.cleanup.session-observed', {
              role,
              sessionPresent: observedId !== null,
              phase: typeof status.phase === 'string' ? status.phase : 'missing',
            });
          } catch {
            failures.push(`${role}_REMOTE_STATUS_READBACK_FAILED`);
          }
        }
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
    for (const [role, connection, driverSessionId, remoteControlSessionId, expectedTracks] of [
      ['MASTER', master, masterSessionId, masterRemoteControlSessionId, dual ? 2 : 1],
      ['PEER', peer, peerSessionId, peerRemoteControlSessionId, 1],
    ] as const) {
      if (connection === undefined || driverSessionId === null) continue;
      try {
        if (remoteControlSessionId === null) {
          const status = await readSelector(
            connection.driver,
            driverSessionId,
            'kernel.base.remote-control.selectRemoteControlStatus',
            [],
          );
          if (!isRecord(status) || status.sessionId !== null || status.phase !== 'idle')
            failures.push(`${role}_REMOTE_SESSION_IDENTITY_MISSING`);
          else safeLog('terminal.cleanup.no-session', {role, phase: 'idle'});
          continue;
        }
        const status = await waitForSelector(
          connection.driver,
          driverSessionId,
          'kernel.base.remote-control.selectRemoteControlStatus',
          [],
          value => isRecord(value) && value.sessionId === remoteControlSessionId && value.phase === 'ended',
          20_000,
        );
        if (!isRecord(status) || status.sessionId !== remoteControlSessionId || status.phase !== 'ended') {
          failures.push(`${role}_REMOTE_SESSION_NOT_ENDED`);
        }
        if (isRecord(status) && status.sessionId === remoteControlSessionId && status.phase === 'ended') {
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
        safeLog('android.diagnostics.read', {role, source: 'runtime', lines, details: runtimeLog});
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
        for (const event of native.events) {
          safeLog('android.diagnostics.native-event', {role, event: event.event, ...event.fields});
        }
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
      if (!isRecord(active) || typeof active.sessionId !== 'string')
        throw new Error('TERMINAL_AUTOMATION_REMOTE_SESSION_ID_MISSING');
      masterRemoteControlSessionId = active.sessionId;
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
        try {
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
        } catch (error) {
          try {
            const readback = await readVideoReadback(video);
            safeLog('remote.video.wait-failed', {
              screen,
              failure: diagnosticText(error instanceof Error ? error.message : String(error)),
              ...readback,
            });
          } catch (readbackError) {
            safeLog('remote.video.readback-failed', {
              screen,
              failure: diagnosticText(readbackError instanceof Error ? readbackError.message : String(readbackError)),
            });
          }
          await captureBrowserRtcDiagnostics(operationsPage, 'operations', safeLog);
          rtcFailureSnapshotCaptured = true;
          throw error;
        }
        safeLog('remote.video.ready', {screen, ...(await readVideoReadback(video))});
      }
      await captureBrowserRtcDiagnostics(operationsPage, 'operations', safeLog);
      rtcFailureSnapshotCaptured = true;
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
            waitForDismissal: true,
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
        const scrollDeltaPx = Math.abs(afterScroll.bounds.y - beforeScroll.bounds.y);
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

      if (sample === 'console' && topology === 'laptop-dual') {
        const member = terminalAutomationMemberFixture(runId);
        const existingMembers = await readSelector(
          master.driver,
          masterSessionId,
          'kernel.feature.sample-member-registry.selectMembers',
          [],
        );
        if (!Array.isArray(existingMembers)) throw new Error('TERMINAL_AUTOMATION_MEMBER_LIST_INVALID');
        expect(existingMembers).toHaveLength(0);

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
            }),
        });
        const memberFormScreen = await waitForSelector(
          master.driver,
          masterSessionId,
          'kernel.base.ui-state.selectScreen',
          ['PRIMARY', 'main'],
          value => isRecord(value) && value.partKey === 'sample.desk.member-form',
          15_000,
        );
        expect(memberFormScreen).toMatchObject({partKey: 'sample.desk.member-form'});
        await enterRemoteKeyboardText({
          connection: master,
          sessionId: masterSessionId,
          operationsPage,
          fieldTestID: mainSampleTestIds.memberFormName,
          value: member.name,
        });
        await enterRemoteKeyboardText({
          connection: master,
          sessionId: masterSessionId,
          operationsPage,
          fieldTestID: mainSampleTestIds.memberFormPhone,
          value: member.phone,
          completeSteps: 2,
          waitForDismissal: true,
        });
        await dispatchObservedUiCommand({
          server: master.driver,
          sessionId: masterSessionId,
          workspace: 'MAIN',
          displayMode: 'PRIMARY',
          commandName: 'kernel.feature.sample-member-registry.submit-member',
          onRequestIdentified: masterDiagnostics.requestStarted,
          onRequestFinished: masterDiagnostics.requestFinished,
          onObserverStep: step => safeLog('runtime.command.observation', {step}),
          action: () =>
            clickRemoteTarget({
              connection: master!,
              sessionId: masterSessionId!,
              operationsPage: operationsPage!,
              screenSlot: 'main',
              testID: mainSampleTestIds.memberFormSubmit,
              surface: 'PRIMARY',
              displayIndex: 0,
            }),
        });
        const pendingScreen = await waitForSelector(
          master.driver,
          masterSessionId,
          'kernel.base.ui-state.selectScreen',
          ['SECONDARY', 'main'],
          value => isRecord(value) && value.partKey === 'sample.desk.customer-member',
          15_000,
        );
        expect(pendingScreen).toMatchObject({partKey: 'sample.desk.customer-member'});
        const pendingMember = await waitForSelector(
          master.driver,
          masterSessionId,
          'kernel.feature.sample-member-registry.selectPendingMember',
          [],
          value => isRecord(value) && value.name === member.name && value.phone === member.phone,
          15_000,
        );
        if (
          !isRecord(pendingMember) ||
          typeof pendingMember.operationId !== 'string' ||
          pendingMember.operationId.length === 0
        )
          throw new Error('TERMINAL_AUTOMATION_PENDING_MEMBER_INVALID');
        safeLog('business.remote-secondary-pending.verified', {operationIdPresent: true});

        await dispatchObservedUiCommand({
          server: master.driver,
          sessionId: masterSessionId,
          workspace: 'MAIN',
          displayMode: 'SECONDARY',
          commandName: 'kernel.feature.sample-member-registry.confirm-member',
          onRequestIdentified: masterDiagnostics.requestStarted,
          onRequestFinished: masterDiagnostics.requestFinished,
          onObserverStep: step => safeLog('runtime.command.observation', {step}),
          action: () =>
            clickRemoteTarget({
              connection: master!,
              sessionId: masterSessionId!,
              operationsPage: operationsPage!,
              screenSlot: 'secondary',
              testID: mainSampleTestIds.memberConfirm,
              surface: 'SECONDARY',
              displayIndex: 1,
            }),
        });
        const registeredMembers = await waitForSelector(
          master.driver,
          masterSessionId,
          'kernel.feature.sample-member-registry.selectMembers',
          [],
          value =>
            Array.isArray(value) &&
            value.some(item => isRecord(item) && item.name === member.name && item.phone === member.phone),
          15_000,
        );
        if (!Array.isArray(registeredMembers)) throw new Error('TERMINAL_AUTOMATION_MEMBER_LIST_INVALID');
        const registeredMatches = registeredMembers.filter(
          item => isRecord(item) && item.name === member.name && item.phone === member.phone,
        );
        expect(registeredMatches).toHaveLength(1);
        expect(
          await readSelector(
            master.driver,
            masterSessionId,
            'kernel.feature.sample-member-registry.selectPendingMember',
            [],
          ),
        ).toBeNull();
        const returnedSecondaryScreen = await waitForSelector(
          master.driver,
          masterSessionId,
          'kernel.base.ui-state.selectScreen',
          ['SECONDARY', 'main'],
          value => isRecord(value) && value.partKey === 'sample.desk.customer-welcome',
          15_000,
        );
        expect(returnedSecondaryScreen).toMatchObject({partKey: 'sample.desk.customer-welcome'});
        safeLog('business.remote-secondary-confirmation.verified', {memberCount: 1, pendingCleared: true});
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
                  // This case deliberately overlaps a local tap with the remote press.
                  clickPacing: 'intentional-overlap',
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

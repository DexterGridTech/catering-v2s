import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {chromium, type Browser, type Locator, type Page} from 'playwright';
import {remoteControlTestIds} from '../../../apps/frontend/operations-admin/src/app/automation/remoteControlTestIds.ts';
import {terminalUpdateTestIds} from '../../../apps/frontend/operations-admin/src/app/automation/terminalUpdateTestIds.ts';
import {roleHomeTestIds} from '../../../apps/frontend/operations-admin/src/features/role-home-bootstrap/roleHomeTestIds.ts';
import {
  createJourneyFailureDiagnostics,
  createTerminalAutomationDriver,
  createWebJourneyUiPort,
  ensureMainSampleActivated,
  mainSampleAppName,
  parseMainSample,
  dispatchObservedUiCommand,
  type TerminalAutomationDriver,
} from '../src/index.ts';
import {mainSampleTerminalName} from '../src/mainSampleJourneyConfig.ts';
import type {TerminalAutomationProcessIdentity} from '../src/managedRun.js';
import {mainSampleTestIds} from '../src/mainSampleTestIds.js';
import {readSelector, subscribeSelector, waitForSelector} from '../src/selectorObservation.js';
import {
  isForwardedExpoWebConsoleLine,
  projectTerminalRuntimeRemoteControlLog,
  safeTerminalBrowserPolicyFailure,
  safeBrowserRequestFailureReason,
  terminalRemoteControlOperationOfPath,
} from '../src/browserNetworkDiagnostics.js';
import {createManagedActivationFixtureApi} from '../fixtures/managedActivation.ts';
import {testExpoTestIds} from '../../../apps/terminal/ui/base/dev-host/src/foundations/testExpoTestIds.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sample = parseMainSample(process.env.TERMINAL_AUTOMATION_SAMPLE);
const appName = mainSampleAppName(sample);
const integrationRoot = path.join(
  root,
  'apps/terminal/ui/integration',
  sample === 'console' ? 'sample-console' : 'sample-wallpaper-console',
);
const runId = required('TERMINAL_AUTOMATION_RUN_ID');
const managedDevRunId = required('TERMINAL_AUTOMATION_MANAGED_DEV_RUN_ID');
const testToken = `ter-remote-${randomUUID()}`;
const require = createRequire(import.meta.url);
const managedProcessTree = require('../../../scripts/dev/managed-process-tree.mjs') as {
  readProcessTable: () => readonly {pid: number; pgid: number; startToken: string}[];
  snapshotProcessTree: (identity: TerminalAutomationProcessIdentity) => readonly {pid: number; startToken: string}[];
  terminateOwnedProcessTree: (identity: TerminalAutomationProcessIdentity) => Promise<{
    status: 'PASS' | 'FAIL';
    treeReadback: readonly {pid: number; startToken: string}[];
  }>;
};

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`TERMINAL_AUTOMATION_ENV_MISSING_${name}`);
  return value;
}

const safeLog = (event: string, fields: Readonly<Record<string, string | number | boolean>> = {}): void => {
  process.stdout.write(
    `TERMINAL_AUTOMATION_REMOTE ${JSON.stringify({at: new Date().toISOString(), runId, event, ...fields})}\n`,
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const sanitizedErrorCode = (error: unknown): string => {
  if (!(error instanceof Error)) return 'UNKNOWN';
  const match = error.message.match(/[A-Z][A-Z0-9_]{4,96}/u);
  return match?.[0] ?? error.name;
};

const processIdentity = (pid: number): TerminalAutomationProcessIdentity => {
  const row = managedProcessTree.readProcessTable().find(value => value.pid === pid);
  if (row === undefined || row.pgid !== pid || row.startToken.length === 0) {
    throw new Error('TERMINAL_AUTOMATION_EXPO_PROCESS_IDENTITY_UNAVAILABLE');
  }
  return Object.freeze({pid: row.pid, pgid: row.pgid, startToken: row.startToken});
};

const waitForExpo = async (url: string, child: ReturnType<typeof spawn>): Promise<void> => {
  const deadline = Date.now() + 60_000;
  let lastStatus = 'NOT_REQUESTED';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`TERMINAL_AUTOMATION_EXPO_EXITED_${child.exitCode}`);
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(1_000)});
      if (response.ok) return;
      lastStatus = `HTTP_${response.status}`;
    } catch (error) {
      lastStatus = error instanceof Error ? error.name : 'FETCH_FAILED';
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`TERMINAL_AUTOMATION_EXPO_READINESS_TIMEOUT_${lastStatus}`);
};

const operationOf = (pageUrl: string): string | undefined => {
  let pathname: string;
  try {
    pathname = new URL(pageUrl).pathname;
  } catch {
    return 'admin-api.invalid-url';
  }
  if (!pathname.startsWith('/api/')) return undefined;
  if (pathname.endsWith('/auth/session')) return 'admin-api.session';
  const terminalRemoteControlOperation = terminalRemoteControlOperationOfPath(pathname);
  if (terminalRemoteControlOperation !== undefined) return terminalRemoteControlOperation;
  if (/\/remote-control-sessions\/[^/]+\/controller-grant$/u.test(pathname)) return 'remote-control.grant';
  if (/\/remote-control-sessions\/[^/]+\/end$/u.test(pathname)) return 'remote-control.end';
  if (/\/remote-control-sessions$/u.test(pathname)) return 'remote-control.start';
  if (/\/terminal-update-versions(?:\/|$)/u.test(pathname)) return 'terminal-version.read';
  return undefined;
};

const remoteControlDiagnosticFields = [
  'attempt',
  'cleanupState',
  'deadlineAtEpochMillis',
  'endpointCount',
  'errorCode',
  'errorName',
  'expectedScreenCount',
  'forSeq',
  'missingEndpointCount',
  'participantCount',
  'projectRef',
  'reason',
  'readyScreenCount',
  'screen',
  'screenCount',
  'seq',
  'sessionId',
  'state',
  'status',
  'streamId',
  'terminalRef',
  'trackSid',
  'topologyKind',
] as const;

const attachFrontendRemoteControlLogs = (page: Page): void => {
  const prefix = '[operations-admin] ';
  page.on('console', message => {
    const text = message.text();
    if (!text.startsWith(prefix)) return;
    let value: unknown;
    try {
      value = JSON.parse(text.slice(prefix.length)) as unknown;
    } catch {
      return;
    }
    if (!isRecord(value) || value.service !== 'operations-admin') return;
    if (typeof value.event !== 'string' || !/^frontend\.remote_control\.[a-z0-9_.-]{1,96}$/u.test(value.event)) return;

    const fields: Record<string, string | number | boolean> = {sourceEvent: value.event};
    for (const key of ['level', 'phase', 'outcome'] as const) {
      if (typeof value[key] === 'string' && /^[A-Z0-9_.:-]{1,64}$/u.test(value[key])) fields[key] = value[key] as string;
    }
    if (typeof value.status === 'number' && Number.isInteger(value.status)) fields.httpStatus = value.status;
    const diagnostic = isRecord(value.diagnostic) ? value.diagnostic : undefined;
    if (diagnostic !== undefined) {
      for (const key of remoteControlDiagnosticFields) {
        const item = diagnostic[key];
        if (typeof item === 'number' && Number.isFinite(item)) fields[`diag_${key}`] = item;
        else if (typeof item === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/u.test(item)) fields[key === 'sessionId' ? 'remoteSessionId' : `diag_${key}`] = item;
        else if (typeof item === 'boolean') fields[`diag_${key}`] = item;
      }
    }
    if (typeof value.errorCode === 'string' && /^[A-Z0-9_.:-]{1,96}$/u.test(value.errorCode))
      fields.errorCode = value.errorCode;
    safeLog('operations.frontend.remote-control', fields);
  });
};

const attachPageDiagnostics = (
  page: Page,
  label: 'operations' | 'terminal',
  onTerminalRuntimeEvent?: (event: Readonly<Record<string, string | number | boolean>>) => void,
): void => {
  let sequence = 0;
  const requestIds = new WeakMap<object, number>();
  const startedAt = new WeakMap<object, number>();
  page.on('request', request => {
    const operation = operationOf(request.url());
    if (operation === undefined) return;
    const requestId = ++sequence;
    requestIds.set(request, requestId);
    startedAt.set(request, Date.now());
    safeLog(`${label}.http.started`, {request: requestId, method: request.method(), operation});
  });
  page.on('response', response => {
    const request = response.request();
    const requestId = requestIds.get(request);
    if (requestId === undefined) return;
    const start = startedAt.get(request) ?? Date.now();
    safeLog(`${label}.http.completed`, {
      request: requestId,
      method: request.method(),
      operation: operationOf(request.url()) ?? 'admin-api.other',
      status: response.status(),
      elapsedMs: Date.now() - start,
    });
  });
  page.on('requestfailed', request => {
    const requestId = requestIds.get(request);
    if (requestId === undefined) return;
    const start = startedAt.get(request) ?? Date.now();
    safeLog(`${label}.http.failed`, {
      request: requestId,
      method: request.method(),
      operation: operationOf(request.url()) ?? 'admin-api.other',
      elapsedMs: Date.now() - start,
      reason: safeBrowserRequestFailureReason(request.failure()?.errorText),
    });
  });
  if (label === 'terminal') {
    page.on('console', message => {
      if (message.type() === 'info') {
        const eventHandle = message.args()[0];
        if (eventHandle !== undefined) {
          void eventHandle
            .jsonValue()
            .then(value => {
              const projected = projectTerminalRuntimeRemoteControlLog(value);
              if (projected !== undefined) {
                safeLog('terminal.runtime.remote-control', projected);
                onTerminalRuntimeEvent?.(projected);
              }
            })
            .catch(error =>
              safeLog('terminal.runtime.remote-control.log-read-failed', {
                errorName: error instanceof Error ? error.name : 'UNKNOWN',
              }),
            );
        }
        return;
      }
      if (message.type() !== 'error') return;
      const failedUrl = message.text().match(/https?:\/\/[^\s'"]+/u)?.[0];
      if (failedUrl === undefined) return;
      const failure = safeTerminalBrowserPolicyFailure(failedUrl, message.text());
      if (failure === undefined) return;
      safeLog('terminal.browser.http.policy-failed', failure);
    });
  }
  page.on('pageerror', error => safeLog(`${label}.page.error`, {errorName: error.name}));
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
    safeLog('operations.role-context.option.match-failed', {
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
  if (optionTestId === null || !optionTestId.startsWith(optionPrefix)) {
    throw new Error('TERMINAL_AUTOMATION_REMOTE_SCOPE_OPTION_IDENTITY_MISMATCH');
  }
  safeLog('operations.role-context.option.readback', {
    optionCount: await options.count(),
    labelMatchCount: 1,
    optionIdentityPresent: true,
  });
  await matches.first().click();
};

const clickRemoteTarget = async (
  input: Readonly<{terminalPage: Page; operationsPage: Page; testId: string}>,
): Promise<void> => {
  const target = input.terminalPage.getByTestId(input.testId);
  const surface = input.terminalPage.getByTestId(String(testExpoTestIds.surface('PRIMARY')));
  const [targetBounds, surfaceBounds] = await Promise.all([target.boundingBox(), surface.boundingBox()]);
  if (targetBounds === null || surfaceBounds === null || surfaceBounds.width <= 0 || surfaceBounds.height <= 0) {
    throw new Error('TERMINAL_AUTOMATION_REMOTE_TARGET_BOUNDS_UNAVAILABLE');
  }
  const u = (targetBounds.x + targetBounds.width / 2 - surfaceBounds.x) / surfaceBounds.width;
  const v = (targetBounds.y + targetBounds.height / 2 - surfaceBounds.y) / surfaceBounds.height;
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) throw new Error('TERMINAL_AUTOMATION_REMOTE_TARGET_OUTSIDE_SURFACE');

  const video = input.operationsPage.getByTestId(remoteControlTestIds.screen('main'));
  await expect
    .poll(
      async () =>
        video.evaluate(
          (element: HTMLVideoElement) =>
            element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            element.videoWidth > 0 &&
            element.videoHeight > 0,
        ),
      {timeout: 30_000},
    )
    .toBe(true);
  const videoBox = await video.boundingBox();
  const videoSize = await video.evaluate((element: HTMLVideoElement) => ({
    width: element.videoWidth,
    height: element.videoHeight,
  }));
  if (videoBox === null || videoBox.width <= 0 || videoBox.height <= 0) {
    throw new Error('TERMINAL_AUTOMATION_REMOTE_VIDEO_BOUNDS_UNAVAILABLE');
  }
  const scale = Math.min(videoBox.width / videoSize.width, videoBox.height / videoSize.height);
  const renderedWidth = videoSize.width * scale;
  const renderedHeight = videoSize.height * scale;
  const x = videoBox.x + (videoBox.width - renderedWidth) / 2 + u * renderedWidth;
  const y = videoBox.y + (videoBox.height - renderedHeight) / 2 + v * renderedHeight;
  safeLog('pointer.action.started', {testId: input.testId, u: Number(u.toFixed(4)), v: Number(v.toFixed(4))});
  await input.operationsPage.mouse.move(x, y);
  await input.operationsPage.mouse.down();
  await input.operationsPage.mouse.up();
  safeLog('pointer.action.completed', {testId: input.testId});
};

const throwRemoteStartFailure = (event: Readonly<Record<string, string | number | boolean>>): never => {
  safeLog('remote.workspace.start-or-registration.rejected', {
    event: typeof event.event === 'string' ? event.event : 'UNKNOWN',
    remoteSessionId: typeof event.sessionId === 'string' ? event.sessionId : 'UNKNOWN',
    ...(typeof event.runtimeRequestId === 'string' ? {runtimeRequestId: event.runtimeRequestId} : {}),
    ...(typeof event.status === 'number' ? {httpStatus: event.status} : {}),
    ...(typeof event.reason === 'string' ? {reason: event.reason} : {}),
    ...(typeof event.code === 'string' ? {code: event.code} : {}),
    ...(typeof event.failureCategory === 'string' ? {failureCategory: event.failureCategory} : {}),
  });
  throw new Error('TERMINAL_AUTOMATION_REMOTE_CONTROL_START_OR_REGISTRATION_REJECTED');
};

describe(`TER remote control ${sample} on Expo Web`, () => {
  let driver: TerminalAutomationDriver | undefined;
  let browser: Browser | undefined;
  let terminalPage: Page | undefined;
  let operationsPage: Page | undefined;
  let expo: ReturnType<typeof spawn> | undefined;
  let expoIdentity: TerminalAutomationProcessIdentity | undefined;
  let sessionId: string | null = null;
  let diagnostics: ReturnType<typeof createJourneyFailureDiagnostics> | undefined;
  let terminalRef: string | undefined;
  let observedRemoteStartFailure: Readonly<Record<string, string | number | boolean>> | null = null;
  let resolveRemoteStartFailure: ((event: Readonly<Record<string, string | number | boolean>>) => void) | undefined;
  let remoteStartFailureSignal: Promise<Readonly<Record<string, string | number | boolean>>> | undefined;
  const expoBuffers = new Map<'stdout' | 'stderr', string>([
    ['stdout', ''],
    ['stderr', ''],
  ]);
  const pipeExpoLogs = (stream: 'stdout' | 'stderr', chunk: Buffer, final = false): void => {
    const lines = `${expoBuffers.get(stream) ?? ''}${chunk.toString('utf8')}`.split('\n');
    const pending = final ? '' : (lines.pop() ?? '');
    expoBuffers.set(stream, pending);
    const output = `${lines.join('\n')}${lines.length > 0 || final ? '\n' : ''}${final ? pending : ''}`;
    const outputLines = output.split('\n');
    const safeLines = outputLines.filter(line => !isForwardedExpoWebConsoleLine(line));
    const suppressedConsoleLines = outputLines.length - safeLines.length;
    if (suppressedConsoleLines > 0) safeLog('expo.web-console.suppressed', {count: suppressedConsoleLines});
    const secrets = [
      testToken,
      process.env.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD,
      process.env.V2S_SEED_PLATFORM_ROOT_PASSWORD,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);
    let safeOutput = safeLines.join('\n');
    for (const secret of secrets) safeOutput = safeOutput.replaceAll(secret, '[REDACTED]');
    if (safeOutput.length > 0) (stream === 'stdout' ? process.stdout : process.stderr).write(safeOutput);
  };

  beforeAll(async () => {
    const runId = required('TERMINAL_AUTOMATION_RUN_ID');
    const managedDevRunId = required('TERMINAL_AUTOMATION_MANAGED_DEV_RUN_ID');
    const operationsPassword = required('V2S_SEED_OPERATIONS_DEFAULT_PASSWORD');
    const webOrigin = new URL(required('TERMINAL_AUTOMATION_WEB_ORIGIN'));
    const operationsOrigin = new URL(required('TERMINAL_AUTOMATION_OPERATIONS_ADMIN_ORIGIN'));
    const shape = 'mobile' as const;
    const deviceId = required('EXPO_PUBLIC_TER_MANAGED_DEVICE_ID');
    driver = createTerminalAutomationDriver({
      token: testToken,
      host: '127.0.0.1',
      port: 0,
      fixtureFactory: server =>
        createManagedActivationFixtureApi({
          server,
          repositoryRoot: root,
          runId,
          managedDevRunId,
          sessionId: () => sessionId,
          deviceId: () => deviceId,
        }),
    });
    await once(driver.transport.server, 'listening');
    const address = driver.transport.server.address();
    if (address === null || typeof address === 'string')
      throw new Error('TERMINAL_AUTOMATION_DRIVER_ADDRESS_UNAVAILABLE');
    if (
      webOrigin.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost'].includes(webOrigin.hostname) ||
      !/^\d{4,5}$/u.test(webOrigin.port)
    ) {
      throw new Error('TERMINAL_AUTOMATION_WEB_ORIGIN_INVALID');
    }
    if (
      operationsOrigin.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost'].includes(operationsOrigin.hostname) ||
      !/^\d{4,5}$/u.test(operationsOrigin.port)
    ) {
      throw new Error('TERMINAL_AUTOMATION_OPERATIONS_ORIGIN_INVALID');
    }
    const expoEnvironment = {...process.env};
    delete expoEnvironment.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD;
    delete expoEnvironment.V2S_SEED_PLATFORM_ROOT_PASSWORD;
    expo = spawn('yarn', ['web', '--port', webOrigin.port], {
      cwd: integrationRoot,
      detached: true,
      env: {
        ...expoEnvironment,
        CI: '1',
        NODE_ENV: 'development',
        EXPO_PUBLIC_TER_AUTOMATION_URL: `ws://127.0.0.1:${address.port}/automation`,
        EXPO_PUBLIC_TER_AUTOMATION_TOKEN: testToken,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await once(expo, 'spawn');
    if (expo.pid === undefined) throw new Error('TERMINAL_AUTOMATION_EXPO_PID_UNAVAILABLE');
    expo.stdout?.on('data', value => pipeExpoLogs('stdout', Buffer.from(value)));
    expo.stderr?.on('data', value => pipeExpoLogs('stderr', Buffer.from(value)));
    expoIdentity = processIdentity(expo.pid);
    await waitForExpo(webOrigin.origin, expo);
    browser = await chromium.launch({headless: true});
    terminalPage = await browser.newPage({viewport: {width: 1280, height: 720}});
    operationsPage = await browser.newPage({viewport: {width: 1440, height: 900}});
    attachPageDiagnostics(terminalPage, 'terminal', event => {
      const registrationRejected = event.event === 'remote-control.session-registration-rejected' ||
        (event.event === 'register-completed' && event.resultKind === 'failure');
      if (event.event !== 'remote-control.start-rejected' && !registrationRejected) return;
      observedRemoteStartFailure = event;
      resolveRemoteStartFailure?.(event);
    });
    attachPageDiagnostics(operationsPage, 'operations');
    attachFrontendRemoteControlLogs(operationsPage);
    const sessionPromise = driver.waitForSession(value => value.appName === appName, 15_000);
    const response = await terminalPage.goto(webOrigin.origin, {waitUntil: 'domcontentloaded', timeout: 15_000});
    if (response === null || !response.ok()) throw new Error('TERMINAL_AUTOMATION_REMOTE_EXPO_PAGE_LOAD_FAILED');
    const session = await sessionPromise;
    sessionId = session.sessionId;
    const activation = await ensureMainSampleActivated(driver.fixtures, {shape, deviceId, runId});
    terminalRef = activation.terminalRef;
    safeLog('fixture.activation.verified', {terminalRef, bindingGeneration: activation.bindingGeneration});
    await operationsPage.goto(new URL('/operations/aurora/login', operationsOrigin).toString(), {
      waitUntil: 'domcontentloaded',
    });
    await operationsPage.getByTestId('operations-login-name').fill('r5-account-multi-role');
    await operationsPage.getByTestId('operations-login-password').fill(operationsPassword);
    await operationsPage.getByTestId('operations-login-submit').click();
    await operationsPage.getByTestId('operations-role-context-select').waitFor({state: 'visible', timeout: 30_000});
    await selectOption(
      operationsPage,
      'operations-role-context-select',
      roleHomeTestIds.roleContext.optionPrefix,
      /项目运营负责人.*太原万象城/u,
    );
    const roleSelectionResponse = operationsPage.waitForResponse(response => {
      const url = new URL(response.url());
      return response.request().method() === 'POST' && url.pathname.endsWith('/session/context');
    });
    const [roleSelection] = await Promise.all([
      roleSelectionResponse,
      operationsPage.getByTestId('operations-role-context-enter').click(),
    ]);
    const roleEntry: unknown = await roleSelection.json();
    const selectedRole = isRecord(roleEntry) && isRecord(roleEntry.selected) ? roleEntry.selected : undefined;
    const actionGrants = isRecord(roleEntry) && Array.isArray(roleEntry.actionGrants) ? roleEntry.actionGrants : [];
    const projectRoleSelected = selectedRole?.roleNodeType === 'PROJECT';
    const remoteControlCapability = actionGrants.includes('CONTROL_PROJECT_TERMINAL');
    safeLog('operations.role-context.readback', {
      status: roleSelection.status(),
      projectRoleSelected,
      remoteControlCapability,
    });
    if (!roleSelection.ok()) throw new Error('TERMINAL_AUTOMATION_REMOTE_ROLE_CONTEXT_SELECTION_FAILED');
    if (!projectRoleSelected) throw new Error('TERMINAL_AUTOMATION_REMOTE_PROJECT_ROLE_NOT_SELECTED');
    if (!remoteControlCapability) throw new Error('TERMINAL_AUTOMATION_REMOTE_PROJECT_CAPABILITY_MISSING');
    await operationsPage.getByTestId('operations-shell-menu').waitFor({state: 'visible', timeout: 30_000});
    await operationsPage.goto(new URL('/operations/aurora/terminal-update/rules', operationsOrigin).toString());
    const dataScope = operationsPage.getByTestId(roleHomeTestIds.dataScope.trigger);
    await dataScope.waitFor({state: 'visible', timeout: 30_000});
    await expect(await dataScope.textContent()).toContain('太原万象城');
    await operationsPage.getByTestId(terminalUpdateTestIds.page).waitFor({state: 'visible', timeout: 30_000});
    safeLog('operations.scope.ready');
  }, 180_000);

  afterAll(async () => {
    const cleanupFailures: string[] = [];
    try {
      if (operationsPage !== undefined) {
        const end = operationsPage.getByTestId(remoteControlTestIds.end);
        if ((await end.count()) > 0 && (await end.isVisible().catch(() => false))) {
          await end.click();
          await operationsPage
            .getByTestId(remoteControlTestIds.status)
            .waitFor({state: 'visible', timeout: 15_000})
            .catch(() => undefined);
        }
        const close = operationsPage.getByTestId(remoteControlTestIds.close);
        if ((await close.count()) > 0 && (await close.isVisible().catch(() => false))) {
          await close.click();
          await operationsPage.getByTestId(remoteControlTestIds.workArea).waitFor({state: 'hidden', timeout: 15_000});
        }
      }
    } catch {
      cleanupFailures.push('REMOTE_WORKSPACE_RELEASE_FAILED');
    }
    diagnostics?.close();
    try {
      await browser?.close();
    } catch {
      cleanupFailures.push('BROWSER_CLOSE_FAILED');
    }
    try {
      await driver?.close();
    } catch {
      cleanupFailures.push('DRIVER_CLOSE_FAILED');
    }
    if (expoIdentity !== undefined) {
      try {
        pipeExpoLogs('stdout', Buffer.alloc(0), true);
        pipeExpoLogs('stderr', Buffer.alloc(0), true);
        if (managedProcessTree.snapshotProcessTree(expoIdentity).length > 0) {
          const result = await managedProcessTree.terminateOwnedProcessTree(expoIdentity);
          if (result.status !== 'PASS' || result.treeReadback.length !== 0)
            cleanupFailures.push('EXPO_PROCESS_TREE_REMAINS');
        }
      } catch {
        cleanupFailures.push('EXPO_PROCESS_TREE_CLEANUP_FAILED');
      }
    }
    safeLog('cleanup.completed', {
      status: cleanupFailures.length === 0 ? 'PASS' : 'FAIL',
      failureCount: cleanupFailures.length,
    });
    if (cleanupFailures.length > 0) throw new Error(`TERMINAL_AUTOMATION_REMOTE_CLEANUP_${cleanupFailures.join('_')}`);
  });

  it('starts from operations UI and performs a real remote pointer action against the terminal app', async () => {
    if (
      driver === undefined ||
      terminalPage === undefined ||
      operationsPage === undefined ||
      sessionId === null ||
      terminalRef === undefined
    ) {
      throw new Error('TERMINAL_AUTOMATION_REMOTE_FIXTURE_NOT_READY');
    }
    diagnostics = createJourneyFailureDiagnostics({server: driver.transport, sessionId});
    const ui = createWebJourneyUiPort({
      server: driver.transport,
      sessionId,
      page: terminalPage,
      onStep: diagnostics.markStep,
    });
    try {
      await waitForSelector(
        driver.transport,
        sessionId,
        'kernel.base.ui-state.selectScreen',
        ['PRIMARY', 'main'],
        value => isRecord(value) && value.partKey === 'sample.auth.login',
        30_000,
      );
      await ui.enterTextAndComplete(mainSampleTestIds.staffOperatorName, 'A001', {mode: 'PRIMARY', index: 0});
      await ui.enterTextAndComplete(mainSampleTestIds.staffPasscode, '1111', {mode: 'PRIMARY', index: 0});

      await operationsPage.getByTestId(terminalUpdateTestIds.reportsTabLabel).click();
      const query = operationsPage.getByTestId(terminalUpdateTestIds.reportQuery);
      await query.waitFor({state: 'visible', timeout: 30_000});
      await query.fill(mainSampleTerminalName('mobile'));
      await operationsPage.getByTestId(terminalUpdateTestIds.reportQuerySubmit).click();
      const terminalLink = operationsPage.getByTestId(terminalUpdateTestIds.reportOpen(terminalRef));
      await terminalLink.waitFor({state: 'visible', timeout: 30_000});
      const reportRow = operationsPage.getByTestId(terminalUpdateTestIds.reportRow(terminalRef));
      await expect
        .poll(async () => (await reportRow.textContent())?.includes('在线') ?? false, {timeout: 30_000})
        .toBe(true);
      await terminalLink.click();
      const reportDetail = operationsPage.getByTestId(terminalUpdateTestIds.reportDetail);
      await reportDetail.waitFor({state: 'visible', timeout: 15_000});
      const remoteActionTrigger = operationsPage.getByTestId(remoteControlTestIds.detailActions(terminalRef));
      const remoteActionCount = await remoteActionTrigger.count();
      const remoteActionVisible = remoteActionCount === 1 && (await remoteActionTrigger.isVisible());
      safeLog('operations.remote-action.readback', {
        terminalRef,
        reportDetailVisible: await reportDetail.isVisible(),
        remoteActionCount,
        remoteActionVisible,
        remoteActionEnabled: remoteActionVisible && (await remoteActionTrigger.isEnabled()),
      });
      if (remoteActionCount !== 1 || !remoteActionVisible) {
        throw new Error('TERMINAL_AUTOMATION_REMOTE_ACTION_TRIGGER_MISSING');
      }
      await remoteActionTrigger.click({timeout: 5_000});
      diagnostics.markStep('remote-control.operations.start');
      observedRemoteStartFailure = null;
      remoteStartFailureSignal = new Promise(resolve => {
        resolveRemoteStartFailure = resolve;
        if (observedRemoteStartFailure !== null) resolve(observedRemoteStartFailure);
      });
      await operationsPage.getByTestId(remoteControlTestIds.start(terminalRef)).click();
      const failureSignal = remoteStartFailureSignal;
      if (failureSignal === undefined) throw new Error('TERMINAL_AUTOMATION_REMOTE_FAILURE_OBSERVER_MISSING');
      const workAreaResult = await Promise.race([
        operationsPage.getByTestId(remoteControlTestIds.workArea).waitFor({state: 'visible', timeout: 30_000})
          .then(() => ({kind: 'visible'} as const)),
        failureSignal.then(event => ({kind: 'rejected', event} as const)),
      ]);
      if (workAreaResult.kind === 'rejected') throwRemoteStartFailure(workAreaResult.event);
      const remoteStatus = await subscribeSelector(
        driver.transport,
        sessionId,
        'kernel.base.remote-control.selectRemoteControlStatus',
        [],
      );
      let activeWaitResult:
        | {kind: 'active'}
        | {kind: 'rejected'; event: Readonly<Record<string, string | number | boolean>>};
      try {
        activeWaitResult = await Promise.race([
          remoteStatus.waitFor(value => isRecord(value) && value.phase === 'active', 30_000)
            .then(() => ({kind: 'active'} as const)),
          failureSignal.then(event => ({kind: 'rejected', event} as const)),
        ]);
      } catch (error) {
        const latest = remoteStatus.latest();
        const observed = latest?.state === 'JSON' && isRecord(latest.value) ? latest.value : undefined;
        const readyScreens = observed && Array.isArray(observed.readyScreens) ? observed.readyScreens.length : 0;
        safeLog('remote.workspace.active.timeout', {
          terminalRef,
          remoteSessionId: observed && typeof observed.sessionId === 'string' ? observed.sessionId : 'UNKNOWN',
          observedPhase: observed && typeof observed.phase === 'string' ? observed.phase : 'UNKNOWN',
          ...(observed && typeof observed.reason === 'string'
            ? {observedReason: observed.reason}
            : {}),
          ...(observed && typeof observed.topologyKind === 'string' ? {topologyKind: observed.topologyKind} : {}),
          observationState: latest?.state ?? 'NO_EVENT',
          readyScreenCount: readyScreens,
          expectedScreenCount: 1,
          cleanupState: 'PENDING_AFTER_TEST',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
        throw error;
      } finally {
        resolveRemoteStartFailure = undefined;
        await remoteStatus.close();
      }
      if (activeWaitResult.kind === 'rejected') {
        throwRemoteStartFailure(activeWaitResult.event);
      }
      safeLog('remote.workspace.active', {terminalRef});

      await dispatchObservedUiCommand({
        server: driver.transport,
        sessionId,
        workspace: 'MAIN',
        displayMode: 'PRIMARY',
        commandName: 'kernel.feature.sample-staff-session.login',
        onRequestIdentified: requestId => diagnostics?.requestStarted(requestId),
        onRequestFinished: requestId => diagnostics?.requestFinished(requestId),
        onObserverStep: diagnostics.markStep,
        action: () =>
          clickRemoteTarget({
            terminalPage: terminalPage!,
            operationsPage: operationsPage!,
            testId: mainSampleTestIds.staffLoginSubmit,
          }),
      });
      const qualification = await waitForSelector(
        driver.transport,
        sessionId,
        'kernel.feature.sample-staff-session.selectHostStaffQualification',
        [],
        value => isRecord(value) && value.status === 'authenticated' && value.operatorName === 'A001',
        30_000,
      );
      expect(qualification).toMatchObject({status: 'authenticated', operatorName: 'A001'});
      const currentScreen = await readSelector(driver.transport, sessionId, 'kernel.base.ui-state.selectScreen', [
        'PRIMARY',
        'main',
      ]);
      expect(currentScreen).toMatchObject({
        partKey: sample === 'console' ? 'sample.desk.member-list' : 'sample.wallpaper.picker',
      });
      safeLog('business.remote-login.verified', {appName, terminalRef});
    } catch (error) {
      diagnostics.report(error);
      safeLog('business.failed', {errorCode: sanitizedErrorCode(error)});
      throw error;
    }
  }, 120_000);
});

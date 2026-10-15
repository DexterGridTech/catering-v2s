import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, it} from 'vitest';
import {chromium, type Browser, type Locator, type Page} from 'playwright';
import {expect} from 'playwright/test';
import {remoteControlTestIds} from '../../../apps/frontend/operations-admin/src/app/automation/remoteControlTestIds.ts';
import {terminalUpdateTestIds} from '../../../apps/frontend/operations-admin/src/app/automation/terminalUpdateTestIds.ts';
import {roleHomeTestIds} from '../../../apps/frontend/operations-admin/src/features/role-home-bootstrap/roleHomeTestIds.ts';
import {
  createJourneyFailureDiagnostics,
  createTerminalAutomationDriver,
  ensureMainSampleActivated,
  mainSampleAppName,
  parseMainSample,
  type TerminalAutomationDriver,
} from '../src/index.ts';
import {mainSampleTerminalName} from '../src/mainSampleJourneyConfig.ts';
import type {TerminalAutomationProcessIdentity} from '../src/managedRun.js';
import {subscribeSelector, waitForSelector} from '../src/selectorObservation.js';
import {
  createExpoWebOutputTracker,
  projectOperationsRemoteControlLog,
  projectTerminalRuntimeRemoteControlLog,
  liveKitSignalSocketProtocol,
  operationsRemoteControlOperationOfPath,
  terminalBrowserPolicyFailure,
  safeBrowserRequestFailureReason,
  terminalRemoteControlOperationOfPath,
} from '../src/browserNetworkDiagnostics.js';
import {createManagedActivationFixtureApi} from '../fixtures/managedActivation.ts';
import {captureBrowserRtcDiagnostics, installBrowserRtcProbe} from '../src/browserRtcProbe.js';

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
  const startedAt = Date.now();
  const deadline = Date.now() + 60_000;
  let lastStatus = 'NOT_REQUESTED';
  safeLog('expo.web.readiness.started');
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      safeLog('expo.web.readiness.failed', {
        elapsedMs: Date.now() - startedAt,
        reason: 'PROCESS_EXITED',
        exitCode: child.exitCode,
        lastStatus,
      });
      throw new Error(`TERMINAL_AUTOMATION_EXPO_EXITED_${child.exitCode}`);
    }
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(1_000)});
      if (response.ok) {
        safeLog('expo.web.readiness.ready', {elapsedMs: Date.now() - startedAt, httpStatus: response.status});
        return;
      }
      lastStatus = `HTTP_${response.status}`;
    } catch (error) {
      lastStatus = error instanceof Error ? error.name : 'FETCH_FAILED';
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  safeLog('expo.web.readiness.failed', {elapsedMs: Date.now() - startedAt, reason: 'TIMEOUT', lastStatus});
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
  const remoteControlOperation = operationsRemoteControlOperationOfPath(pathname);
  if (remoteControlOperation !== undefined) return `remote-control.${remoteControlOperation}`;
  if (/\/terminal-update-versions(?:\/|$)/u.test(pathname)) return 'terminal-version.read';
  return undefined;
};

const attachFrontendRemoteControlLogs = (page: Page): void => {
  page.on('console', message => {
    const projected = projectOperationsRemoteControlLog(message.text());
    if (projected !== undefined) safeLog('operations.frontend.remote-control', projected);
  });
};

const attachPageDiagnostics = (
  page: Page,
  label: 'operations' | 'terminal',
  onTerminalRuntimeEvent?: (event: Readonly<Record<string, string | number | boolean>>) => void,
): void => {
  let sequence = 0;
  let liveKitSignalSequence = 0;
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
      errorText: request.failure()?.errorText ?? 'No browser failure detail',
    });
  });
  page.on('websocket', socket => {
    const protocol = liveKitSignalSocketProtocol(socket.url());
    if (protocol === undefined) return;
    const attempt = ++liveKitSignalSequence;
    const startedAt = Date.now();
    let sentFrames = 0;
    let receivedFrames = 0;
    safeLog(`${label}.livekit.signal.socket-observed`, {attempt, protocol});
    socket.on('framesent', () => {
      sentFrames += 1;
    });
    socket.on('framereceived', () => {
      receivedFrames += 1;
    });
    socket.on('socketerror', errorText => {
      safeLog(`${label}.livekit.signal.socket-error`, {
        attempt,
        protocol,
        reason: safeBrowserRequestFailureReason(errorText),
        errorText,
      });
    });
    socket.on('close', () => {
      safeLog(`${label}.livekit.signal.socket-closed`, {
        attempt,
        protocol,
        sentFrames,
        receivedFrames,
        elapsedMs: Date.now() - startedAt,
      });
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
      const failure = terminalBrowserPolicyFailure(failedUrl, message.text());
      if (failure === undefined) return;
      safeLog('terminal.browser.http.policy-failed', failure);
    });
  }
  page.on('pageerror', error => safeLog(`${label}.page.error`, {errorName: error.name, errorMessage: error.message}));
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
  safeLog('operations.role-context.selector.ready', {inputEnabled: await input.isEnabled()});
  await expect(input).toBeEnabled();
  await control.click();
  const [ariaExpanded, visibleDropdownCount, allDropdownCount] = await Promise.all([
    input.getAttribute('aria-expanded'),
    page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible').count(),
    page.locator('.ant-select-dropdown').count(),
  ]);
  safeLog('operations.role-context.selector.opened', {
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
    safeLog('operations.role-context.option.match-failed', {
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
  let remoteStartAttempted = false;
  let remoteControlSessionId: string | null = null;
  let loggedExpoBundleSuccess = false;
  const expoOutput = createExpoWebOutputTracker((stream, diagnostic) => {
    if (diagnostic.category === 'BUNDLE_SUCCEEDED') {
      if (loggedExpoBundleSuccess) return;
      loggedExpoBundleSuccess = true;
    }
    safeLog('expo.web.output.diagnostic', {stream, ...diagnostic});
  });

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
    expo.stdout?.on('data', value => {
      safeLog('expo.web.output.chunk', {stream: 'stdout', text: value.toString('utf8')});
      expoOutput.push('stdout', value);
    });
    expo.stderr?.on('data', value => {
      safeLog('expo.web.output.chunk', {stream: 'stderr', text: value.toString('utf8')});
      expoOutput.push('stderr', value);
    });
    expoIdentity = processIdentity(expo.pid);
    safeLog('expo.web.process.started', {pid: expoIdentity.pid, processIdentityBound: true});
    await waitForExpo(webOrigin.origin, expo);
    browser = await chromium.launch({headless: true});
    terminalPage = await browser.newPage({viewport: {width: 1280, height: 720}});
    operationsPage = await browser.newPage({viewport: {width: 1440, height: 900}});
    await installBrowserRtcProbe(terminalPage, 'terminal', safeLog);
    await installBrowserRtcProbe(operationsPage, 'operations', safeLog);
    attachPageDiagnostics(terminalPage, 'terminal', event => {
      const registrationRejected =
        event.event === 'remote-control.session-registration-rejected' ||
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
          safeLog('operations.remote-end.clicked');
        }
        if (remoteControlSessionId !== null && driver !== undefined && sessionId !== null) {
          const endedStatus = await waitForSelector(
            driver.transport,
            sessionId,
            'kernel.base.remote-control.selectRemoteControlStatus',
            [],
            value =>
              isRecord(value) &&
              value.sessionId === remoteControlSessionId &&
              value.phase === 'ended' &&
              isRecord(value.cleanup) &&
              value.cleanup.roomLeft === true &&
              value.cleanup.inputCancelled === true &&
              typeof value.cleanup.tracksReleased === 'number' &&
              value.cleanup.tracksReleased >= 1,
            30_000,
          );
          const cleanup = isRecord(endedStatus) && isRecord(endedStatus.cleanup) ? endedStatus.cleanup : undefined;
          safeLog('remote-control.cleanup.readback', {
            roomLeft: cleanup?.roomLeft === true,
            inputCancelled: cleanup?.inputCancelled === true,
            tracksReleased: typeof cleanup?.tracksReleased === 'number' ? cleanup.tracksReleased : 0,
          });
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
    try {
      diagnostics?.close();
    } catch {
      cleanupFailures.push('JOURNEY_DIAGNOSTICS_CLEANUP_FAILED');
    }
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
        if (managedProcessTree.snapshotProcessTree(expoIdentity).length > 0) {
          const result = await managedProcessTree.terminateOwnedProcessTree(expoIdentity);
          if (result.status !== 'PASS' || result.treeReadback.length !== 0)
            cleanupFailures.push('EXPO_PROCESS_TREE_REMAINS');
        }
        expoOutput.flush();
        const summary = expoOutput.summary();
        safeLog('expo.web.process.output-summary', {
          stdoutBytes: summary.stdoutBytes,
          stderrBytes: summary.stderrBytes,
          classifiedLines: summary.classifiedLines,
          unclassifiedLines: summary.unclassifiedLines,
          oversizedLines: summary.oversizedLines,
          bundleSucceeded: summary.categories.BUNDLE_SUCCEEDED ?? 0,
          bundleFailed: summary.categories.BUNDLE_FAILED ?? 0,
          moduleResolutionFailed: summary.categories.MODULE_RESOLUTION_FAILED ?? 0,
          dependencyResolutionFailed: summary.categories.DEPENDENCY_RESOLUTION_FAILED ?? 0,
          syntaxFailed: summary.categories.SYNTAX_FAILED ?? 0,
          portBindFailed: summary.categories.PORT_BIND_FAILED ?? 0,
          expoError: summary.categories.EXPO_ERROR ?? 0,
        });
      } catch {
        cleanupFailures.push('EXPO_PROCESS_TREE_CLEANUP_FAILED');
      }
    }
    safeLog('cleanup.completed', {
      status: cleanupFailures.length === 0 ? 'PASS' : 'FAIL',
      failureCount: cleanupFailures.length,
    });
    process.stdout.write(
      `TERMINAL_AUTOMATION_WEB_HARNESS_CLEANUP_${cleanupFailures.length === 0 ? 'PASS' : 'FAIL'} runId=${runId} suite=remote.${sample}${cleanupFailures.length === 0 ? '' : ` failures=${cleanupFailures.join(',')}`}\n`,
    );
    if (cleanupFailures.length > 0) throw new Error(`TERMINAL_AUTOMATION_REMOTE_CLEANUP_${cleanupFailures.join('_')}`);
  });

  it('verifies the terminal connection and receives the remote-control start command', async () => {
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
    try {
      await waitForSelector(
        driver.transport,
        sessionId,
        'kernel.base.terminal-data-client.selectConnectionState',
        [],
        value => isRecord(value) && value.status === 'connected',
        60_000,
      );
      safeLog('terminal.tdp.ready', {status: 'connected'});

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
      remoteStartAttempted = true;
      await operationsPage.getByTestId(remoteControlTestIds.start(terminalRef)).click();
      const failureSignal = remoteStartFailureSignal;
      if (failureSignal === undefined) throw new Error('TERMINAL_AUTOMATION_REMOTE_FAILURE_OBSERVER_MISSING');
      const workAreaResult = await Promise.race([
        operationsPage
          .getByTestId(remoteControlTestIds.workArea)
          .waitFor({state: 'visible', timeout: 30_000})
          .then(() => ({kind: 'visible'}) as const),
        failureSignal.then(event => ({kind: 'rejected', event}) as const),
      ]);
      if (workAreaResult.kind === 'rejected') throwRemoteStartFailure(workAreaResult.event);
      await expect(operationsPage.getByTestId(remoteControlTestIds.header)).toBeFocused();
      const remoteStatus = await subscribeSelector(
        driver.transport,
        sessionId,
        'kernel.base.remote-control.selectRemoteControlStatus',
        [],
      );
      let activeWaitResult:
        {kind: 'active'} | {kind: 'rejected'; event: Readonly<Record<string, string | number | boolean>>};
      try {
        activeWaitResult = await Promise.race([
          remoteStatus
            .waitFor(value => isRecord(value) && value.phase === 'active', 30_000)
            .then(() => ({kind: 'active'}) as const),
          failureSignal.then(event => ({kind: 'rejected', event}) as const),
        ]);
      } catch (error) {
        const latest = remoteStatus.latest();
        const observed = latest?.state === 'JSON' && isRecord(latest.value) ? latest.value : undefined;
        const readyScreens = observed && Array.isArray(observed.readyScreens) ? observed.readyScreens.length : 0;
        if (observed && typeof observed.sessionId === 'string' && observed.sessionId.length > 0) {
          remoteControlSessionId = observed.sessionId;
        }
        safeLog('remote.workspace.active.timeout', {
          terminalRef,
          remoteSessionId: observed && typeof observed.sessionId === 'string' ? observed.sessionId : 'UNKNOWN',
          observedPhase: observed && typeof observed.phase === 'string' ? observed.phase : 'UNKNOWN',
          ...(observed && typeof observed.reason === 'string' ? {observedReason: observed.reason} : {}),
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
      const latest = remoteStatus.latest();
      const activeStatus = latest?.state === 'JSON' && isRecord(latest.value) ? latest.value : undefined;
      const readyScreens =
        activeStatus && Array.isArray(activeStatus.readyScreens) ? activeStatus.readyScreens.length : 0;
      if (activeStatus && typeof activeStatus.sessionId === 'string' && activeStatus.sessionId.length > 0) {
        remoteControlSessionId = activeStatus.sessionId;
      }
      expect(activeStatus).toMatchObject({phase: 'active'});
      expect(typeof activeStatus?.sessionId).toBe('string');
      expect((activeStatus?.sessionId as string | undefined)?.length ?? 0).toBeGreaterThan(0);
      expect(readyScreens).toBe(1);
      safeLog('remote-control.start-command-received', {
        phase: activeStatus?.phase === 'active' ? activeStatus.phase : 'UNKNOWN',
        readyScreenCount: readyScreens,
        expectedScreenCount: 1,
        terminalRef,
      });

      const firstSessionId = remoteControlSessionId;
      if (firstSessionId === null) throw new Error('TERMINAL_AUTOMATION_REMOTE_SESSION_ID_MISSING');
      await operationsPage.getByTestId(remoteControlTestIds.end).click();
      const firstEndedStatus = await waitForSelector(
        driver.transport,
        sessionId,
        'kernel.base.remote-control.selectRemoteControlStatus',
        [],
        value =>
          isRecord(value) &&
          value.sessionId === firstSessionId &&
          value.phase === 'ended' &&
          isRecord(value.cleanup) &&
          value.cleanup.roomLeft === true &&
          value.cleanup.inputCancelled === true &&
          typeof value.cleanup.tracksReleased === 'number' &&
          value.cleanup.tracksReleased >= 1,
        30_000,
      );
      safeLog('remote-control.first-session-ended.readback', {
        sessionId: firstSessionId,
        phase:
          isRecord(firstEndedStatus) && typeof firstEndedStatus.phase === 'string' ? firstEndedStatus.phase : 'UNKNOWN',
        roomLeft:
          isRecord(firstEndedStatus) &&
          isRecord(firstEndedStatus.cleanup) &&
          firstEndedStatus.cleanup.roomLeft === true,
        inputCancelled:
          isRecord(firstEndedStatus) &&
          isRecord(firstEndedStatus.cleanup) &&
          firstEndedStatus.cleanup.inputCancelled === true,
        tracksReleased:
          isRecord(firstEndedStatus) &&
          isRecord(firstEndedStatus.cleanup) &&
          typeof firstEndedStatus.cleanup.tracksReleased === 'number'
            ? firstEndedStatus.cleanup.tracksReleased
            : 0,
      });
      await expect(operationsPage.getByTestId(remoteControlTestIds.status)).toContainText('远程控制已结束');

      await operationsPage.getByTestId(remoteControlTestIds.restart).click();
      const restartedStatus = await waitForSelector(
        driver.transport,
        sessionId,
        'kernel.base.remote-control.selectRemoteControlStatus',
        [],
        value =>
          isRecord(value) &&
          value.phase === 'active' &&
          value.sessionId !== firstSessionId &&
          Array.isArray(value.readyScreens) &&
          value.readyScreens.length === 1,
        30_000,
      );
      if (
        !isRecord(restartedStatus) ||
        typeof restartedStatus.sessionId !== 'string' ||
        typeof restartedStatus.phase !== 'string' ||
        !Array.isArray(restartedStatus.readyScreens)
      )
        throw new Error('TERMINAL_AUTOMATION_REMOTE_RESTART_SESSION_ID_MISSING');
      remoteControlSessionId = restartedStatus.sessionId;
      safeLog('remote-control.manual-restart.readback', {
        previousSessionId: firstSessionId,
        sessionId: remoteControlSessionId,
        phase: restartedStatus.phase,
        readyScreenCount: restartedStatus.readyScreens.length,
        newSession: true,
      });

      await operationsPage.getByTestId(remoteControlTestIds.end).click();
      const secondEndedStatus = await waitForSelector(
        driver.transport,
        sessionId,
        'kernel.base.remote-control.selectRemoteControlStatus',
        [],
        value =>
          isRecord(value) &&
          value.sessionId === remoteControlSessionId &&
          value.phase === 'ended' &&
          isRecord(value.cleanup) &&
          value.cleanup.roomLeft === true &&
          value.cleanup.inputCancelled === true &&
          typeof value.cleanup.tracksReleased === 'number' &&
          value.cleanup.tracksReleased >= 1,
        30_000,
      );
      safeLog('remote-control.restarted-session-ended.readback', {
        sessionId: remoteControlSessionId,
        phase:
          isRecord(secondEndedStatus) && typeof secondEndedStatus.phase === 'string'
            ? secondEndedStatus.phase
            : 'UNKNOWN',
        resourcesReleased:
          isRecord(secondEndedStatus) &&
          isRecord(secondEndedStatus.cleanup) &&
          secondEndedStatus.cleanup.roomLeft === true &&
          secondEndedStatus.cleanup.inputCancelled === true &&
          typeof secondEndedStatus.cleanup.tracksReleased === 'number' &&
          secondEndedStatus.cleanup.tracksReleased >= 1,
      });
      await operationsPage.getByTestId(remoteControlTestIds.close).click();
      await operationsPage.getByTestId(remoteControlTestIds.workArea).waitFor({state: 'hidden', timeout: 15_000});
      await expect(terminalLink).toBeFocused();
      safeLog('remote-control.exit-focus.readback', {terminalRef, focusReturnedToTerminalEntry: true});
    } catch (error) {
      if (remoteStartAttempted && terminalPage !== undefined && operationsPage !== undefined) {
        await Promise.allSettled([
          captureBrowserRtcDiagnostics(terminalPage, 'terminal', safeLog),
          captureBrowserRtcDiagnostics(operationsPage, 'operations', safeLog),
        ]);
      }
      diagnostics.report(error);
      safeLog('business.failed', {errorCode: sanitizedErrorCode(error)});
      throw error;
    }
    process.stdout.write(`TERMINAL_AUTOMATION_WEB_HARNESS_BUSINESS_PASS runId=${runId} suite=remote.${sample}\n`);
  }, 120_000);
});

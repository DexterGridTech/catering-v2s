import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {chromium, type Browser, type Page} from 'playwright';
import {adminTestIds} from '@catering-v2s/ui-base-admin-shell/test-ids';
import {createTerminalAutomationDriver} from '../src/index.ts';
import {testExpoHostPrefix} from '../src/journeySurface.js';
import type {TerminalAutomationProcessIdentity} from '../src/managedRun.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const integrationRoot = path.join(root, 'apps/terminal/ui/integration/sample-console');
const rootTestId = `${testExpoHostPrefix}:root`;
const primarySurfaceTestId = `${testExpoHostPrefix}:surface:PRIMARY`;
const launcherTestId = adminTestIds.launcher;
const testToken = `ter-auto-${randomUUID()}`;
const require = createRequire(import.meta.url);
const managedProcessTree = require('../../../scripts/dev/managed-process-tree.mjs') as {
  readProcessTable: () => readonly {pid: number; ppid: number; pgid: number; startToken: string}[];
  snapshotProcessTree: (
    identity: TerminalAutomationProcessIdentity,
  ) => readonly {pid: number; pgid: number; startToken: string; ownershipUnverified?: boolean}[];
  terminateOwnedProcessTree: (identity: TerminalAutomationProcessIdentity) => Promise<{
    status: 'PASS' | 'FAIL';
    treeReadback: readonly {pid: number; startToken: string}[];
  }>;
};

const availablePort = async (): Promise<number> => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('TERMINAL_AUTOMATION_TEST_PORT_UNAVAILABLE');
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  return address.port;
};

const readProcessIdentity = (pid: number): TerminalAutomationProcessIdentity => {
  const row = managedProcessTree.readProcessTable().find(process => process.pid === pid);
  if (row === undefined || row.pgid !== pid || row.startToken.length === 0) {
    throw new Error('TERMINAL_AUTOMATION_EXPO_PROCESS_IDENTITY_UNAVAILABLE');
  }
  return Object.freeze({pid: row.pid, pgid: row.pgid, startToken: row.startToken});
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const responseResult = (response: unknown): unknown => {
  if (!isRecord(response) || response.type !== 'response' || !isRecord(response.body) || !('result' in response.body)) {
    throw new Error('TERMINAL_AUTOMATION_CONTROL_RESPONSE_INVALID');
  }
  return response.body.result;
};

const waitForExpo = async (pageUrl: string, child: ReturnType<typeof spawn>): Promise<void> => {
  const deadline = Date.now() + 60_000;
  let lastError = 'NOT_REQUESTED';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`TERMINAL_AUTOMATION_EXPO_EXITED_${child.exitCode}`);
    try {
      const response = await fetch(pageUrl, {signal: AbortSignal.timeout(1_000)});
      if (response.ok) return;
      lastError = `HTTP_${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.name : 'FETCH_FAILED';
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`TERMINAL_AUTOMATION_EXPO_READINESS_TIMEOUT_${lastError}`);
};

describe('terminal automation web geometry feasibility', () => {
  let driver: ReturnType<typeof createTerminalAutomationDriver> | undefined;
  let browser: Browser | undefined;
  let page: Page | undefined;
  let expo: ReturnType<typeof spawn> | undefined;
  let expoIdentity: TerminalAutomationProcessIdentity | undefined;
  let readyUrl: string | undefined;
  const expoBuffers = new Map<'stdout' | 'stderr', string>([
    ['stdout', ''],
    ['stderr', ''],
  ]);
  const pipeExpoLogs = (stream: 'stdout' | 'stderr', chunk: Buffer, final = false): void => {
    const lines = `${expoBuffers.get(stream) ?? ''}${chunk.toString('utf8')}`.split('\n');
    const pending = final ? '' : (lines.pop() ?? '');
    expoBuffers.set(stream, pending);
    const text = `${lines.join('\n')}${lines.length > 0 || final ? '\n' : ''}${final ? pending : ''}`;
    if (text.length > 0) {
      (stream === 'stdout' ? process.stdout : process.stderr).write(text.replaceAll(testToken, '[REDACTED]'));
    }
  };

  beforeAll(async () => {
    driver = createTerminalAutomationDriver({token: testToken, host: '127.0.0.1', port: 0});
    await once(driver.transport.server, 'listening');
    const driverAddress = driver.transport.server.address();
    if (driverAddress === null || typeof driverAddress === 'string') {
      throw new Error('TERMINAL_AUTOMATION_DRIVER_ADDRESS_UNAVAILABLE');
    }
    const expoPort = await availablePort();
    readyUrl = `http://127.0.0.1:${expoPort}/`;
    expo = spawn('yarn', ['web', '--port', String(expoPort)], {
      cwd: integrationRoot,
      detached: true,
      env: {
        ...process.env,
        CI: '1',
        NODE_ENV: 'development',
        EXPO_PUBLIC_TER_AUTOMATION_URL: `ws://127.0.0.1:${driverAddress.port}/automation`,
        EXPO_PUBLIC_TER_AUTOMATION_TOKEN: testToken,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await once(expo, 'spawn');
    if (expo.pid === undefined) throw new Error('TERMINAL_AUTOMATION_EXPO_PID_UNAVAILABLE');
    expo.stdout?.on('data', chunk => pipeExpoLogs('stdout', Buffer.from(chunk)));
    expo.stderr?.on('data', chunk => pipeExpoLogs('stderr', Buffer.from(chunk)));
    expoIdentity = readProcessIdentity(expo.pid);
    await waitForExpo(readyUrl, expo);
    browser = await chromium.launch({headless: true});
    const context = await browser.newContext({viewport: {width: 1280, height: 720}});
    page = await context.newPage();
    const sessionPromise = driver.waitForSession(session => session.appName === 'sample-console', 15_000);
    const response = await page.goto(readyUrl, {waitUntil: 'domcontentloaded', timeout: 15_000});
    if (response === null || !response.ok()) throw new Error('TERMINAL_AUTOMATION_EXPO_PAGE_LOAD_FAILED');
    await sessionPromise;
    await page.getByTestId(primarySurfaceTestId).waitFor({state: 'visible', timeout: 15_000});
  }, 90_000);

  afterAll(async () => {
    const cleanupErrors: string[] = [];
    try {
      await browser?.close();
    } catch {
      cleanupErrors.push('BROWSER_CLOSE_FAILED');
    }
    try {
      await driver?.close();
    } catch {
      cleanupErrors.push('DRIVER_CLOSE_FAILED');
    }
    if (expoIdentity !== undefined) {
      try {
        pipeExpoLogs('stdout', Buffer.alloc(0), true);
        pipeExpoLogs('stderr', Buffer.alloc(0), true);
        const remaining = managedProcessTree.snapshotProcessTree(expoIdentity);
        if (remaining.length > 0) {
          const result = await managedProcessTree.terminateOwnedProcessTree(expoIdentity);
          if (result.status !== 'PASS' || result.treeReadback.length !== 0) {
            cleanupErrors.push('EXPO_PROCESS_TREE_REMAINS');
          }
        }
      } catch {
        cleanupErrors.push('EXPO_PROCESS_TREE_CLEANUP_FAILED');
      }
    } else if (expo !== undefined && expo.exitCode === null) {
      expo.kill('SIGTERM');
      cleanupErrors.push('EXPO_PROCESS_IDENTITY_UNAVAILABLE');
    }
    if (cleanupErrors.length > 0) throw new Error(`TERMINAL_AUTOMATION_CLEANUP_${cleanupErrors.join('_')}`);
  });

  it('uses actual DOM bounds and real input after scroll, nonuniform scale, and offset', async () => {
    if (page === undefined || driver === undefined) throw new Error('TERMINAL_AUTOMATION_WEB_FIXTURE_NOT_READY');
    const rootLocator = page.getByTestId(rootTestId);
    await rootLocator.evaluate(element => {
      document.documentElement.style.minHeight = '1800px';
      const host = element as HTMLElement;
      host.style.marginTop = '180px';
      host.style.transformOrigin = 'top left';
      host.style.transform = 'matrix(0.83, 0, 0, 0.71, 23, 17)';
    });
    await page.evaluate(() => window.scrollTo(0, 90));
    await page.waitForFunction(() => window.scrollY === 90);
    const geometry = await rootLocator.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {scrollY: window.scrollY, left: rect.left, top: rect.top, width: rect.width, height: rect.height};
    });
    expect(geometry.scrollY).toBe(90);
    expect(geometry.left).toBeGreaterThan(0);
    expect(geometry.top).toBeGreaterThan(0);

    const session = driver.transport.getSessions().find(value => value.appName === 'sample-console');
    if (session === undefined) throw new Error('TERMINAL_AUTOMATION_WEB_SESSION_MISSING');
    const query = responseResult(
      await driver.transport.request(session.sessionId, 'controls.query', {
        filter: {testID: launcherTestId, surface: 'PRIMARY', displayIndex: 0},
      }),
    );
    expect(isRecord(query) && Array.isArray(query.nodes)).toBe(true);
    if (!isRecord(query) || !Array.isArray(query.nodes) || query.nodes.length !== 1 || !isRecord(query.nodes[0])) {
      throw new Error('TERMINAL_AUTOMATION_LAUNCHER_REGISTRATION_INVALID');
    }
    const registered = query.nodes[0];
    expect(registered.testID).toBe(launcherTestId);
    expect(isRecord(registered.surface)).toBe(true);
    if (!isRecord(registered.surface)) throw new Error('TERMINAL_AUTOMATION_LAUNCHER_SURFACE_INVALID');
    expect(registered.surface.surface).toBe('PRIMARY');
    expect(registered.surface.displayIndex).toBe(0);
    expect(typeof registered.nodeInstanceId).toBe('string');
    expect(Number.isSafeInteger(registered.surface.layoutRevision)).toBe(true);

    const boundsResult = responseResult(
      await driver.transport.request(session.sessionId, 'controls.bounds', {
        nodeInstanceId: registered.nodeInstanceId,
        layoutRevision: registered.surface.layoutRevision,
      }),
    );
    expect(isRecord(boundsResult) && isRecord(boundsResult.bounds)).toBe(true);
    if (!isRecord(boundsResult) || !isRecord(boundsResult.bounds)) {
      throw new Error('TERMINAL_AUTOMATION_LAUNCHER_BOUNDS_INVALID');
    }
    const launcher = page.getByTestId(launcherTestId);
    const domBounds = await launcher.boundingBox();
    expect(domBounds).not.toBeNull();
    if (domBounds === null) throw new Error('TERMINAL_AUTOMATION_LAUNCHER_DOM_BOUNDS_MISSING');
    const registeredBounds = boundsResult.bounds;
    for (const [key, actual] of Object.entries(domBounds)) {
      const measured = registeredBounds[key];
      expect(typeof measured).toBe('number');
      if (typeof measured !== 'number' || Math.abs(measured - actual) > 1) {
        throw new Error(`TERMINAL_AUTOMATION_LAUNCHER_BOUNDS_MISMATCH_${key}`);
      }
    }

    // The observer is intentionally a plain View. Prove its coordinate mapping
    // through the real five-tap admin gesture, not a Pressable-only event hook.
    const position = {x: (domBounds.width * 48) / 1280, y: 0};
    for (let index = 0; index < 5; index += 1) await launcher.click({position});
    await page.getByTestId(adminTestIds.passwordInput).waitFor({state: 'visible', timeout: 5_000});
  }, 20_000);

  it('reconnects with new sessions after clean and abnormal closes, then changes Runtime identity on reload', async () => {
    if (page === undefined || driver === undefined) throw new Error('TERMINAL_AUTOMATION_WEB_FIXTURE_NOT_READY');
    const first = driver.transport.getSessions().find(value => value.appName === 'sample-console');
    if (first === undefined) throw new Error('TERMINAL_AUTOMATION_WEB_SESSION_MISSING');

    first.socket.close(1012, 'service-restart');
    const afterCleanClose = await driver.waitForSession(
      session => session.appName === 'sample-console' && session.sessionId !== first.sessionId,
      10_000,
    );
    expect(afterCleanClose.runtimeId).toBe(first.runtimeId);
    expect(driver.transport.getSession(first.sessionId)).toBeNull();

    afterCleanClose.socket.terminate();
    const afterAbnormalClose = await driver.waitForSession(
      session => session.appName === 'sample-console' && session.sessionId !== afterCleanClose.sessionId,
      10_000,
    );
    expect(afterAbnormalClose.runtimeId).toBe(first.runtimeId);
    expect(driver.transport.getSession(afterCleanClose.sessionId)).toBeNull();

    const reloadedSession = driver.waitForSession(
      session => session.appName === 'sample-console' && session.runtimeId !== first.runtimeId,
      15_000,
    );
    await page.reload({waitUntil: 'domcontentloaded', timeout: 15_000});
    const afterReload = await reloadedSession;
    expect(afterReload.sessionId).not.toBe(afterAbnormalClose.sessionId);
    expect(afterReload.runtimeId).not.toBe(first.runtimeId);
    await page.getByTestId(primarySurfaceTestId).waitFor({state: 'visible', timeout: 15_000});
  }, 45_000);
});

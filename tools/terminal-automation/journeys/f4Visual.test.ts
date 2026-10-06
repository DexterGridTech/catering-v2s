import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {chromium, type Browser, type Page} from 'playwright';
import {adminTestIds} from '@catering-v2s/ui-base-admin-shell/test-ids';
import type {TerminalAutomationProcessIdentity} from '../src/managedRun.ts';
import {compareScreenshots} from '../src/screenshotDiff.ts';
import {testExpoHostPrefix} from '../src/journeySurface.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const integrationRoot = path.join(root, 'apps/terminal/ui/integration/sample-console');
const runtimeSectionId = adminTestIds.sections.runtime;
const launcherId = adminTestIds.launcher;
const passwordInputId = adminTestIds.passwordInput;
const automationUrl = 'ws://127.0.0.1:1/automation';
const require = createRequire(import.meta.url);
const managedProcessTree = require('../../../scripts/dev/managed-process-tree.mjs') as {
  readProcessTable: () => readonly {pid: number; ppid: number; pgid: number; startToken: string}[];
  snapshotProcessTree: (identity: TerminalAutomationProcessIdentity) => readonly {
    pid: number;
    pgid: number;
    startToken: string;
    ownershipUnverified?: boolean;
  }[];
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
  if (address === null || typeof address === 'string') throw new Error('TERMINAL_AUTOMATION_F4_PORT_UNAVAILABLE');
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  return address.port;
};

const readProcessIdentity = (pid: number): TerminalAutomationProcessIdentity => {
  const row = managedProcessTree.readProcessTable().find(process => process.pid === pid);
  if (row === undefined || row.pgid !== pid || row.startToken.length === 0) {
    throw new Error('TERMINAL_AUTOMATION_F4_EXPO_IDENTITY_UNAVAILABLE');
  }
  return Object.freeze({pid: row.pid, pgid: row.pgid, startToken: row.startToken});
};

const waitForExpo = async (url: string, child: ReturnType<typeof spawn>): Promise<void> => {
  const deadline = Date.now() + 60_000;
  let lastError = 'NOT_REQUESTED';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`TERMINAL_AUTOMATION_F4_EXPO_EXITED_${child.exitCode}`);
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(1_000)});
      if (response.ok) return;
      lastError = `HTTP_${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.name : 'FETCH_FAILED';
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`TERMINAL_AUTOMATION_F4_EXPO_READINESS_TIMEOUT_${lastError}`);
};

describe('F-4a automation build visual equivalence', () => {
  let browser: Browser | undefined;
  let page: Page | undefined;
  let expo: ReturnType<typeof spawn> | undefined;
  let expoIdentity: TerminalAutomationProcessIdentity | undefined;
  const runId = process.env.TERMINAL_AUTOMATION_RUN_ID;
  const secret = `ter-auto-f4-${randomUUID()}`;
  const expoBuffers = new Map<'stdout' | 'stderr', string>([['stdout', ''], ['stderr', '']]);
  const pipeExpoLogs = (stream: 'stdout' | 'stderr', chunk: Buffer, final = false): void => {
    const lines = `${expoBuffers.get(stream) ?? ''}${chunk.toString('utf8')}`.split('\n');
    const pending = final ? '' : (lines.pop() ?? '');
    expoBuffers.set(stream, pending);
    const text = `${lines.join('\n')}${lines.length > 0 || final ? '\n' : ''}${final ? pending : ''}`;
    if (text.length > 0) {
      const redacted = text
        .replaceAll(secret, '[REDACTED]')
        .replace(/((?:token|secret|password|authorization)\s*[=:]\s*)[^\s,}"']+/giu, '$1[REDACTED]');
      (stream === 'stdout' ? process.stdout : process.stderr).write(redacted);
    }
  };

  beforeAll(async () => {
    if (!runId) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
    const port = await availablePort();
    const url = `http://127.0.0.1:${port}/`;
    const env: NodeJS.ProcessEnv = {...process.env, CI: '1', NODE_ENV: 'development'};
    delete env.EXPO_PUBLIC_TER_AUTOMATION_URL;
    delete env.EXPO_PUBLIC_TER_AUTOMATION_TOKEN;
    expo = spawn('yarn', ['web', '--port', String(port)], {
      cwd: integrationRoot,
      detached: true,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await once(expo, 'spawn');
    if (expo.pid === undefined) throw new Error('TERMINAL_AUTOMATION_F4_EXPO_PID_UNAVAILABLE');
    expo.stdout?.on('data', chunk => pipeExpoLogs('stdout', Buffer.from(chunk)));
    expo.stderr?.on('data', chunk => pipeExpoLogs('stderr', Buffer.from(chunk)));
    expoIdentity = readProcessIdentity(expo.pid);
    await waitForExpo(url, expo);
    browser = await chromium.launch({headless: true});
    page = await browser.newPage({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1});
    const response = await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 15_000});
    if (response === null || !response.ok()) throw new Error('TERMINAL_AUTOMATION_F4_WEB_PAGE_LOAD_FAILED');
    await page.getByTestId(`${testExpoHostPrefix}:surface:PRIMARY`).waitFor({state: 'visible', timeout: 15_000});
  }, 90_000);

  afterAll(async () => {
    const cleanupErrors: string[] = [];
    try { await browser?.close(); } catch { cleanupErrors.push('BROWSER_CLOSE_FAILED'); }
    if (expoIdentity !== undefined) {
      try {
        pipeExpoLogs('stdout', Buffer.alloc(0), true);
        pipeExpoLogs('stderr', Buffer.alloc(0), true);
        if (managedProcessTree.snapshotProcessTree(expoIdentity).length > 0) {
          const cleanup = await managedProcessTree.terminateOwnedProcessTree(expoIdentity);
          if (cleanup.status !== 'PASS' || cleanup.treeReadback.length !== 0) cleanupErrors.push('EXPO_PROCESS_TREE_REMAINS');
        }
      } catch { cleanupErrors.push('EXPO_PROCESS_TREE_CLEANUP_FAILED'); }
    }
    if (cleanupErrors.length > 0) throw new Error(`TERMINAL_AUTOMATION_F4_CLEANUP_${cleanupErrors.join('_')}`);
  });

  it('compares identical admin runtime page with automation opt-in absent and present', async () => {
    if (page === undefined || runId === undefined) throw new Error('TERMINAL_AUTOMATION_F4_FIXTURE_NOT_READY');
    const socketUrls: string[] = [];
    page.on('websocket', socket => socketUrls.push(socket.url()));
    const launcher = page.getByTestId(launcherId);
    const launcherBounds = await launcher.boundingBox();
    if (launcherBounds === null) throw new Error('TERMINAL_AUTOMATION_F4_LAUNCHER_BOUNDS_MISSING');
    const position = {x: (launcherBounds.width * 48) / 1280, y: 0};
    for (let index = 0; index < 5; index += 1) await launcher.click({position});
    await page.getByTestId(passwordInputId).waitFor({state: 'visible'});
    const passwordLabel = await page.getByTestId(adminTestIds.debugPassword).textContent();
    const password = passwordLabel?.match(/\d{6}/u)?.[0];
    if (!password) throw new Error('TERMINAL_AUTOMATION_F4_ADMIN_PASSWORD_UNAVAILABLE');
    await page.getByTestId(passwordInputId).click();
    for (const digit of password) await page.getByTestId(`ui.base.input:virtual-keyboard:text-${digit}`).click();
    await page.getByTestId(adminTestIds.verify).click();
    await page.getByTestId(adminTestIds.shell).waitFor({state: 'visible'});
    await page.getByTestId(runtimeSectionId).click();
    await page.getByTestId(adminTestIds.runtime.overallStatus).getByText('正常').waitFor({state: 'visible'});
    const enabledValue = page.getByTestId(adminTestIds.runtime.automation.enabled);
    const addressValue = page.getByTestId(adminTestIds.runtime.automation.address);
    await enabledValue.waitFor({state: 'visible'});
    await expect(await enabledValue.textContent()).toBe('未启用');
    await expect(await addressValue.textContent()).toBe('—');
    expect(socketUrls.some(value => value.includes('/automation'))).toBe(false);
    const baseline = await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask: [enabledValue.locator('xpath=..'), addressValue.locator('xpath=..')],
    });

    await expo?.kill('SIGTERM');
    const exit = expo === undefined ? null : await once(expo, 'exit');
    if (exit === null || (Array.isArray(exit) && exit[1] !== null && exit[1] !== 'SIGTERM')) {
      throw new Error('TERMINAL_AUTOMATION_F4_FIRST_WEB_SERVER_STOP_FAILED');
    }
    expo = undefined;
    const port = await availablePort();
    const url = `http://127.0.0.1:${port}/`;
    const enabledEnv = {
      ...process.env,
      CI: '1',
      NODE_ENV: 'development',
      EXPO_PUBLIC_TER_AUTOMATION_URL: automationUrl,
      EXPO_PUBLIC_TER_AUTOMATION_TOKEN: secret,
    };
    expo = spawn('yarn', ['web', '--port', String(port)], {
      cwd: integrationRoot,
      detached: true,
      env: enabledEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await once(expo, 'spawn');
    if (expo.pid === undefined) throw new Error('TERMINAL_AUTOMATION_F4_EXPO_PID_UNAVAILABLE');
    expo.stdout?.on('data', chunk => pipeExpoLogs('stdout', Buffer.from(chunk)));
    expo.stderr?.on('data', chunk => pipeExpoLogs('stderr', Buffer.from(chunk)));
    expoIdentity = readProcessIdentity(expo.pid);
    await waitForExpo(url, expo);
    const enabledPage = await browser!.newPage({viewport: {width: 1280, height: 720}, deviceScaleFactor: 1});
    const response = await enabledPage.goto(url, {waitUntil: 'domcontentloaded', timeout: 15_000});
    if (response === null || !response.ok()) throw new Error('TERMINAL_AUTOMATION_F4_ENABLED_PAGE_LOAD_FAILED');
    await enabledPage.getByTestId(`${testExpoHostPrefix}:surface:PRIMARY`).waitFor({state: 'visible', timeout: 15_000});
    const enabledLauncher = enabledPage.getByTestId(launcherId);
    const enabledBounds = await enabledLauncher.boundingBox();
    if (enabledBounds === null) throw new Error('TERMINAL_AUTOMATION_F4_LAUNCHER_BOUNDS_MISSING');
    const enabledPosition = {x: (enabledBounds.width * 48) / 1280, y: 0};
    for (let index = 0; index < 5; index += 1) await enabledLauncher.click({position: enabledPosition});
    await enabledPage.getByTestId(passwordInputId).waitFor({state: 'visible'});
    const enabledPasswordLabel = await enabledPage.getByTestId(adminTestIds.debugPassword).textContent();
    const enabledPassword = enabledPasswordLabel?.match(/\d{6}/u)?.[0];
    if (!enabledPassword) throw new Error('TERMINAL_AUTOMATION_F4_ADMIN_PASSWORD_UNAVAILABLE');
    await enabledPage.getByTestId(passwordInputId).click();
    for (const digit of enabledPassword) await enabledPage.getByTestId(`ui.base.input:virtual-keyboard:text-${digit}`).click();
    await enabledPage.getByTestId(adminTestIds.verify).click();
    await enabledPage.getByTestId(adminTestIds.shell).waitFor({state: 'visible'});
    await enabledPage.getByTestId(runtimeSectionId).click();
    await enabledPage.getByTestId(adminTestIds.runtime.overallStatus).getByText('正常').waitFor({state: 'visible'});
    const enabledStatus = enabledPage.getByTestId(adminTestIds.runtime.automation.enabled);
    const enabledAddress = enabledPage.getByTestId(adminTestIds.runtime.automation.address);
    await expect(await enabledStatus.textContent()).toBe('已启用');
    await expect(await enabledAddress.textContent()).toBe(automationUrl);
    const enabledScreenshot = await enabledPage.screenshot({
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask: [enabledStatus.locator('xpath=..'), enabledAddress.locator('xpath=..')],
    });
    const visual = compareScreenshots(baseline, enabledScreenshot, []);
    const directory = path.join(root, '.runtime/terminal-automation', runId);
    mkdirSync(directory, {recursive: true, mode: 0o700});
    writeFileSync(path.join(directory, 'f4a-disabled.png'), baseline);
    writeFileSync(path.join(directory, 'f4a-enabled.png'), enabledScreenshot);
    writeFileSync(path.join(directory, 'f4a-diff.png'), visual.diff);
    expect(visual.differentPixels).toBe(0);
    process.stdout.write(`TERMINAL_AUTOMATION_F4A_PASS width=1280 height=720 maskedRows=2 differingPixels=${visual.differentPixels}\n`);
    await enabledPage.close();
  }, 180_000);
});

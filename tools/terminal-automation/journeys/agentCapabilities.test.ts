import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {chromium, type Browser, type Page} from 'playwright';
import {createTerminalAutomationDriver} from '../src/index.ts';
import type {AutomationEnvelope} from '@catering-v2s/ui-base-automation-agent/protocol';
import type {TerminalAutomationProcessIdentity} from '../src/managedRun.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const integrationRoot = path.join(root, 'apps/terminal/ui/integration/sample-console');
const runtimeSelector = 'kernel.base.runtime.selectRuntimeInstanceMode';
const testToken = `ter-auto-${randomUUID()}`;
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

const waitForExpo = async (url: string, child: ReturnType<typeof spawn>): Promise<void> => {
  const deadline = Date.now() + 60_000;
  let lastError = 'NOT_REQUESTED';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`TERMINAL_AUTOMATION_EXPO_EXITED_${child.exitCode}`);
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(1_000)});
      if (response.ok) return;
      lastError = `HTTP_${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.name : 'FETCH_FAILED';
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`TERMINAL_AUTOMATION_EXPO_READINESS_TIMEOUT_${lastError}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const responseResult = (message: AutomationEnvelope): unknown => {
  if (message.type !== 'response' || !isRecord(message.body) || !('result' in message.body)) {
    throw new Error('TERMINAL_AUTOMATION_RESPONSE_INVALID');
  }
  return message.body.result;
};

const eventBody = (message: AutomationEnvelope): Record<string, unknown> | undefined =>
  message.type === 'event' && isRecord(message.body) ? message.body : undefined;

const waitForMessage = (
  server: ReturnType<typeof createTerminalAutomationDriver>['transport'],
  sessionId: string,
  matches: (message: AutomationEnvelope) => boolean,
  timeoutMs = 5_000,
): Promise<AutomationEnvelope> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('TERMINAL_AUTOMATION_MESSAGE_TIMEOUT'));
    }, timeoutMs);
    const unsubscribe = server.onMessage(sessionId, message => {
      if (!matches(message)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(message);
    });
  });

describe('TER automation Web agent capabilities and reload lifecycle', () => {
  let driver: ReturnType<typeof createTerminalAutomationDriver> | undefined;
  let browser: Browser | undefined;
  let page: Page | undefined;
  let expo: ReturnType<typeof spawn> | undefined;
  let expoIdentity: TerminalAutomationProcessIdentity | undefined;
  const expoBuffers = new Map<'stdout' | 'stderr', string>([['stdout', ''], ['stderr', '']]);
  const pipeExpoLogs = (stream: 'stdout' | 'stderr', chunk: Buffer, final = false): void => {
    const lines = `${expoBuffers.get(stream) ?? ''}${chunk.toString('utf8')}`.split('\n');
    const pending = final ? '' : (lines.pop() ?? '');
    expoBuffers.set(stream, pending);
    const text = `${lines.join('\n')}${lines.length > 0 || final ? '\n' : ''}${final ? pending : ''}`;
    if (text) (stream === 'stdout' ? process.stdout : process.stderr).write(text.replaceAll(testToken, '[REDACTED]'));
  };

  beforeAll(async () => {
    if (!process.env.TERMINAL_AUTOMATION_RUN_ID) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
    driver = createTerminalAutomationDriver({token: testToken, host: '127.0.0.1', port: 0});
    await once(driver.transport.server, 'listening');
    const address = driver.transport.server.address();
    if (address === null || typeof address === 'string') throw new Error('TERMINAL_AUTOMATION_DRIVER_ADDRESS_UNAVAILABLE');
    const expoPort = await availablePort();
    const url = `http://127.0.0.1:${expoPort}/`;
    expo = spawn('yarn', ['web', '--port', String(expoPort)], {
      cwd: integrationRoot,
      detached: true,
      env: {
        ...process.env,
        CI: '1',
        NODE_ENV: 'development',
        EXPO_PUBLIC_TER_AUTOMATION_URL: `ws://127.0.0.1:${address.port}/automation`,
        EXPO_PUBLIC_TER_AUTOMATION_TOKEN: testToken,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await once(expo, 'spawn');
    if (expo.pid === undefined) throw new Error('TERMINAL_AUTOMATION_EXPO_PID_UNAVAILABLE');
    expo.stdout?.on('data', chunk => pipeExpoLogs('stdout', Buffer.from(chunk)));
    expo.stderr?.on('data', chunk => pipeExpoLogs('stderr', Buffer.from(chunk)));
    expoIdentity = readProcessIdentity(expo.pid);
    await waitForExpo(url, expo);
    browser = await chromium.launch({headless: true});
    page = await browser.newPage({viewport: {width: 1280, height: 720}});
    const session = driver.waitForSession(value => value.appName === 'sample-console', 15_000);
    const response = await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 15_000});
    if (response === null || !response.ok()) throw new Error('TERMINAL_AUTOMATION_EXPO_PAGE_LOAD_FAILED');
    await session;
  }, 90_000);

  afterAll(async () => {
    const errors: string[] = [];
    try { await browser?.close(); } catch { errors.push('BROWSER_CLOSE_FAILED'); }
    try { await driver?.close(); } catch { errors.push('DRIVER_CLOSE_FAILED'); }
    if (expoIdentity !== undefined) {
      try {
        pipeExpoLogs('stdout', Buffer.alloc(0), true);
        pipeExpoLogs('stderr', Buffer.alloc(0), true);
        const remaining = managedProcessTree.snapshotProcessTree(expoIdentity);
        if (remaining.length > 0) {
          const cleanup = await managedProcessTree.terminateOwnedProcessTree(expoIdentity);
          if (cleanup.status !== 'PASS' || cleanup.treeReadback.length !== 0) errors.push('EXPO_PROCESS_TREE_REMAINS');
        }
      } catch { errors.push('EXPO_PROCESS_TREE_CLEANUP_FAILED'); }
    }
    if (errors.length > 0) throw new Error(`TERMINAL_AUTOMATION_CLEANUP_${errors.join('_')}`);
  });

  it('reads registered selectors, observes state, and dispatches one real safe Runtime command', async () => {
    if (driver === undefined) throw new Error('TERMINAL_AUTOMATION_DRIVER_NOT_READY');
    const session = driver.transport.getSession();
    if (session === null) throw new Error('TERMINAL_AUTOMATION_SESSION_MISSING');
    const runtimeInfo = responseResult(await driver.transport.request(session.sessionId, 'runtime.info', null));
    expect(isRecord(runtimeInfo)).toBe(true);
    if (!isRecord(runtimeInfo) || !Array.isArray(runtimeInfo.descriptors)) throw new Error('RUNTIME_INFO_INVALID');
    const runtimeDescriptor = runtimeInfo.descriptors.find(value => isRecord(value) && value.moduleName === 'kernel.base.runtime');
    expect(isRecord(runtimeDescriptor) && Array.isArray(runtimeDescriptor.selectorNames)).toBe(true);
    if (!isRecord(runtimeDescriptor) || !Array.isArray(runtimeDescriptor.selectorNames)) throw new Error('RUNTIME_SELECTOR_DESCRIPTOR_MISSING');
    expect(runtimeDescriptor.selectorNames).toContain(runtimeSelector);

    const selector = responseResult(await driver.transport.request(session.sessionId, 'selector.read', {
      selectorName: runtimeSelector,
      argsTuple: [],
    }));
    expect(selector).toMatchObject({valueState: 'JSON'});
    if (!isRecord(selector) || selector.valueState !== 'JSON') throw new Error('RUNTIME_SELECTOR_READ_INVALID');
    expect(['MASTER', 'SLAVE']).toContain(selector.value);

    const invalidSelector = await driver.transport.request(session.sessionId, 'selector.read', {
      selectorName: runtimeSelector,
      argsTuple: ['unexpected'],
    });
    expect(invalidSelector.type).toBe('error');
    expect(invalidSelector.body).toMatchObject({code: 'SELECTOR_ARGUMENT_INVALID'});

    const subscriptionId = `runtime-mode-${randomUUID()}`;
    const firstValue = waitForMessage(driver.transport, session.sessionId, message => {
      const body = eventBody(message);
      return body?.subscriptionId === subscriptionId;
    });
    const accepted = responseResult(await driver.transport.request(session.sessionId, 'selector.subscribe', {
      subscriptionId,
      selectorName: runtimeSelector,
      argsTuple: [],
    }));
    expect(accepted).toMatchObject({subscriptionId, accepted: true});
    expect(await firstValue).toMatchObject({type: 'event', body: {subscriptionId, valueState: 'JSON', value: selector.value}});
    const unsubscribed = responseResult(await driver.transport.request(session.sessionId, 'selector.unsubscribe', {subscriptionId}));
    expect(unsubscribed).toMatchObject({subscriptionId, released: true});

    const commandResult = waitForMessage(driver.transport, session.sessionId, message => {
      const body = eventBody(message);
      return body?.kind === 'command.result';
    });
    const acceptedCommand = responseResult(await driver.transport.request(session.sessionId, 'command.dispatch', {
      commandName: 'kernel.base.runtime.hello-world',
      payload: null,
    }));
    expect(isRecord(acceptedCommand) && typeof acceptedCommand.requestId === 'string').toBe(true);
    const completion = await commandResult;
    expect(completion.body).toMatchObject({
      requestId: (acceptedCommand as {requestId: string}).requestId,
      kind: 'command.result',
      result: {status: 'completed'},
    });
  }, 20_000);

  it('reloads with a new Runtime/session and does not restore the old selector subscription', async () => {
    if (driver === undefined || page === undefined) throw new Error('TERMINAL_AUTOMATION_WEB_FIXTURE_NOT_READY');
    const first = driver.transport.getSession();
    if (first === null) throw new Error('TERMINAL_AUTOMATION_SESSION_MISSING');
    const subscriptionId = `reload-${randomUUID()}`;
    const firstEvent = waitForMessage(driver.transport, first.sessionId, message => eventBody(message)?.subscriptionId === subscriptionId);
    await driver.transport.request(first.sessionId, 'selector.subscribe', {
      subscriptionId,
      selectorName: runtimeSelector,
      argsTuple: [],
    });
    await firstEvent;

    const afterReload = driver.waitForSession(session => session.appName === 'sample-console' && session.runtimeId !== first.runtimeId, 15_000);
    await page.reload({waitUntil: 'domcontentloaded', timeout: 15_000});
    const next = await afterReload;
    expect(next.sessionId).not.toBe(first.sessionId);
    expect(next.runtimeId).not.toBe(first.runtimeId);
    expect(driver.transport.getSession(first.sessionId)).toBeNull();
    await expect(driver.transport.request(first.sessionId, 'selector.unsubscribe', {subscriptionId})).rejects.toThrow(
      'TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED',
    );

    const freshSubscriptionId = `reload-fresh-${randomUUID()}`;
    const freshEvent = waitForMessage(driver.transport, next.sessionId, message => eventBody(message)?.subscriptionId === freshSubscriptionId);
    const accepted = responseResult(await driver.transport.request(next.sessionId, 'selector.subscribe', {
      subscriptionId: freshSubscriptionId,
      selectorName: runtimeSelector,
      argsTuple: [],
    }));
    expect(accepted).toMatchObject({subscriptionId: freshSubscriptionId, accepted: true});
    expect(await freshEvent).toMatchObject({type: 'event', body: {subscriptionId: freshSubscriptionId, valueState: 'JSON'}});
  }, 30_000);
});

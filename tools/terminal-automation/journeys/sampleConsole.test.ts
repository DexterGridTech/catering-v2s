import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {chromium, type Browser, type Page} from 'playwright';
import {
  createWebJourneyUiPort,
  createTerminalAutomationDriver,
  createJourneyFailureDiagnostics,
  ensureMainSampleActivated,
  mainSampleAppName,
  parseMainSample,
  parseMainSampleJourneyConfig,
  prepareWebJourneySurface,
  type MainSampleJourneyConfig,
  type TerminalAutomationDriver,
} from '../src/index.ts';
import type {TerminalAutomationProcessIdentity} from '../src/managedRun.js';
import {createManagedActivationFixtureApi} from '../fixtures/managedActivation.ts';
import {runMainSampleJourney} from './mainSampleJourney.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const selectedSample = parseMainSample(process.env.TERMINAL_AUTOMATION_SAMPLE);
const integrationRoot = path.join(
  root,
  'apps/terminal/ui/integration',
  selectedSample === 'console' ? 'sample-console' : 'sample-wallpaper-console',
);
const appName = mainSampleAppName(selectedSample);
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

const processIdentity = (pid: number): TerminalAutomationProcessIdentity => {
  const row = managedProcessTree.readProcessTable().find(value => value.pid === pid);
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

const readRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`TERMINAL_AUTOMATION_ENV_MISSING_${key}`);
  return value;
};

describe(`TER automation ${appName} main journey on Expo Web`, () => {
  let driver: TerminalAutomationDriver | undefined;
  let sessionId: string | null = null;
  let browser: Browser | undefined;
  let page: Page | undefined;
  let expo: ReturnType<typeof spawn> | undefined;
  let expoIdentity: TerminalAutomationProcessIdentity | undefined;
  let selectedJourney: MainSampleJourneyConfig | undefined;
  const expoBuffers = new Map<'stdout' | 'stderr', string>([
    ['stdout', ''],
    ['stderr', ''],
  ]);
  const pipeExpoLogs = (stream: 'stdout' | 'stderr', chunk: Buffer, final = false): void => {
    const lines = `${expoBuffers.get(stream) ?? ''}${chunk.toString('utf8')}`.split('\n');
    const pending = final ? '' : (lines.pop() ?? '');
    expoBuffers.set(stream, pending);
    const output = `${lines.join('\n')}${lines.length > 0 || final ? '\n' : ''}${final ? pending : ''}`;
    if (output)
      (stream === 'stdout' ? process.stdout : process.stderr).write(output.replaceAll(testToken, '[REDACTED]'));
  };

  beforeAll(async () => {
    const journey = parseMainSampleJourneyConfig({
      ...process.env,
      TERMINAL_AUTOMATION_SAMPLE: selectedSample,
    });
    selectedJourney = journey;
    const runId = journey.runId;
    const managedDevRunId = readRequiredEnv('TERMINAL_AUTOMATION_MANAGED_DEV_RUN_ID');
    const {shape} = journey;

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
          deviceId: () => readRequiredEnv('EXPO_PUBLIC_TER_MANAGED_DEVICE_ID'),
        }),
    });
    await once(driver.transport.server, 'listening');
    const driverAddress = driver.transport.server.address();
    if (driverAddress === null || typeof driverAddress === 'string') {
      throw new Error('TERMINAL_AUTOMATION_DRIVER_ADDRESS_UNAVAILABLE');
    }
    const expoOrigin = new URL(readRequiredEnv('TERMINAL_AUTOMATION_WEB_ORIGIN'));
    if (
      expoOrigin.protocol !== 'http:' ||
      (expoOrigin.hostname !== '127.0.0.1' && expoOrigin.hostname !== 'localhost') ||
      !/^[0-9]{4,5}$/u.test(expoOrigin.port) ||
      expoOrigin.pathname !== '/' ||
      expoOrigin.search !== '' ||
      expoOrigin.hash !== ''
    ) {
      throw new Error('TERMINAL_AUTOMATION_WEB_ORIGIN_INVALID');
    }
    const expoPort = Number(expoOrigin.port);
    const url = `${expoOrigin.origin}/`;
    const expoEnvironment = {...process.env};
    delete expoEnvironment.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD;
    expo = spawn('yarn', ['web', '--port', String(expoPort)], {
      cwd: integrationRoot,
      detached: true,
      env: {
        ...expoEnvironment,
        CI: '1',
        NODE_ENV: 'development',
        EXPO_PUBLIC_TER_AUTOMATION_URL: `ws://127.0.0.1:${driverAddress.port}/automation`,
        EXPO_PUBLIC_TER_AUTOMATION_TOKEN: testToken,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await once(expo, 'spawn');
    if (expo.pid === undefined) throw new Error('TERMINAL_AUTOMATION_EXPO_PID_UNAVAILABLE');
    expo.stdout?.on('data', value => pipeExpoLogs('stdout', Buffer.from(value)));
    expo.stderr?.on('data', value => pipeExpoLogs('stderr', Buffer.from(value)));
    expoIdentity = processIdentity(expo.pid);
    await waitForExpo(url, expo);
    browser = await chromium.launch({headless: true});
    page = await browser.newPage({viewport: {width: 1280, height: 720}});
    const sessionPromise = driver.waitForSession(value => value.appName === appName, 15_000);
    const response = await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 15_000});
    if (response === null || !response.ok()) throw new Error('TERMINAL_AUTOMATION_EXPO_PAGE_LOAD_FAILED');
    const session = await sessionPromise;
    sessionId = session.sessionId;
    await prepareWebJourneySurface({page, shape});
    const deviceId = readRequiredEnv('EXPO_PUBLIC_TER_MANAGED_DEVICE_ID');
    await ensureMainSampleActivated(driver.fixtures, {shape, deviceId, runId});
  }, 120_000);

  afterAll(async () => {
    const errors: string[] = [];
    try {
      await browser?.close();
    } catch {
      errors.push('BROWSER_CLOSE_FAILED');
    }
    try {
      await driver?.close();
    } catch {
      errors.push('DRIVER_CLOSE_FAILED');
    }
    if (expoIdentity !== undefined) {
      try {
        pipeExpoLogs('stdout', Buffer.alloc(0), true);
        pipeExpoLogs('stderr', Buffer.alloc(0), true);
        const remaining = managedProcessTree.snapshotProcessTree(expoIdentity);
        if (remaining.length > 0) {
          const result = await managedProcessTree.terminateOwnedProcessTree(expoIdentity);
          if (result.status !== 'PASS' || result.treeReadback.length !== 0) errors.push('EXPO_PROCESS_TREE_REMAINS');
        }
      } catch {
        errors.push('EXPO_PROCESS_TREE_CLEANUP_FAILED');
      }
    }
    if (errors.length > 0) throw new Error(`TERMINAL_AUTOMATION_CLEANUP_${errors.join('_')}`);
  });

  it('uses real UI input, observes the exact Runtime request, and verifies member owner state', async () => {
    if (driver === undefined || page === undefined || sessionId === null) {
      throw new Error('TERMINAL_AUTOMATION_WEB_FIXTURE_NOT_READY');
    }
    const journey = selectedJourney;
    if (journey === undefined) throw new Error('TERMINAL_AUTOMATION_JOURNEY_CONFIG_MISSING');
    const diagnostics = createJourneyFailureDiagnostics({server: driver.transport, sessionId});
    const ui = createWebJourneyUiPort({
      server: driver.transport,
      sessionId,
      page,
      onStep: diagnostics.markStep,
    });
    try {
      await runMainSampleJourney(
        journey.sample === 'wallpaper'
          ? {sample: 'wallpaper', port: {server: driver.transport, sessionId, diagnostics, ...ui}}
          : {
              sample: 'console',
              port: {server: driver.transport, sessionId, diagnostics, ...ui},
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
  }, 90_000);
});

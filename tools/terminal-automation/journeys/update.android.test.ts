import {createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  request as createHttpRequest,
  createServer as createHttpServer,
  type IncomingHttpHeaders,
  type Server as HttpServer,
} from 'node:http';
import {createServer as createNetServer, type Server as NetServer} from 'node:net';
import {closeSync, copyFileSync, createReadStream, openSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, expect, it} from 'vitest';
import type {Client} from '@devicefarmer/adbkit';
import type {TerminalUpdateArtifact} from '@catering-v2s/kernel-base-platform-ports';
import {
  androidAutomationBuildIdentity,
  createAndroidAdbClient,
  createAndroidAutomationConnection,
  createAndroidJourneyUiPort,
  readSelector,
  waitForSelector,
  readApplicationDeviceId,
  ensureMainSampleActivated,
  resolveCurrentAutomationSession,
  waitForAutomationSession,
  waitForReplacementAutomationSession,
  type AndroidAutomationConnection,
} from '../src/index.ts';
import {createManagedActivationFixtureApi} from '../fixtures/managedActivation.ts';
import {mainSampleTestIds} from '../src/mainSampleTestIds.ts';
import {terminalUpdateSampleConfig} from '../src/updateSample.ts';
import {
  mainSampleSeedKey,
  mainSampleSurfaceForm,
  mainSampleTerminalName,
  parseMainSampleShape,
} from '../src/mainSampleJourneyConfig.ts';
import {prepareAndroidJourneySurface} from '../src/journeySurface.ts';
import {loginSampleStaff} from './sampleStaffLogin.js';
import {
  assertTerminalUpdateReportInUi,
  createTerminalUpdateSupplyUi,
  type TerminalUpdateSupplyUi,
} from './terminalUpdateSupplyUi.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const runId = process.env.TERMINAL_AUTOMATION_RUN_ID;
const runDirectory = runId ? path.join(root, '.runtime/terminal-automation', runId) : undefined;
const selectedSample = process.env.TERMINAL_AUTOMATION_SAMPLE ?? 'console';
const sample = terminalUpdateSampleConfig(selectedSample);
const appName = selectedSample === 'console' ? 'sample-terminal' : 'sample-wallpaper-terminal';
const updateCase = process.env.TERMINAL_AUTOMATION_CASE;
const isSupplyChainCase = updateCase === 'update.supply-chain';
const adbPath = process.env.ADB_PATH || 'adb';
const installerPackagePrefixes = ['com.android.packageinstaller', 'com.google.android.packageinstaller'] as const;
const settingsPackagePrefixes = ['com.android.settings'] as const;
const installSourcePackagePrefixes = [...installerPackagePrefixes, ...settingsPackagePrefixes] as const;
const sessionToken = `ter-update-${randomUUID()}`;
let failNextManagedBusinessRead = false;
let forcedManagedBusinessReadFailures = 0;
type ArtifactManifest = TerminalUpdateArtifact &
  Readonly<{
    readonly apk?: Readonly<{readonly path: string; readonly sha256: string}>;
  }>;
type UpdateTarget = Readonly<{
  readonly ruleRef: string;
  readonly createdAt: number;
  readonly applicationId: string;
  readonly full: Readonly<{
    readonly sourceRef: string;
    readonly expectedSha256: string;
    readonly artifact: ArtifactManifest;
  }> | null;
  readonly hot: Readonly<{
    readonly sourceRef: string;
    readonly expectedSha256: string;
    readonly artifact: ArtifactManifest;
  }>;
  readonly strategy: Readonly<{readonly maxNetworkAttempts: number; readonly bootTimeoutMs: number}>;
  readonly selectionContext: Readonly<{
    readonly selectedSpace: string;
    readonly contextIdentity: string;
    readonly ruleRef: string;
  }>;
}>;

const sha256 = (value: Buffer): string => createHash('sha256').update(value).digest('hex');
const managedLoopbackPort = (key: string): number => {
  const raw = process.env[key];
  if (!raw) throw new Error(`TERMINAL_AUTOMATION_ENV_MISSING_${key}`);
  const parsed = new URL(raw);
  if (
    (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') ||
    (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') ||
    parsed.port.length === 0
  )
    throw new Error(`TERMINAL_AUTOMATION_MANAGED_TDS_URL_INVALID_${key}`);
  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error(`TERMINAL_AUTOMATION_MANAGED_TDS_PORT_INVALID_${key}`);
  return port;
};
const sha256File = async (filePath: string): Promise<string> => {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest('hex');
};

const extractCompatibilityFullApk = async (
  input: Readonly<{artifact: ArtifactManifest; packageManifestName: string}>,
) => {
  if (!runDirectory || input.artifact.apk === undefined)
    throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_EXTERNAL_APK_INVALID');
  const outputRoot = path.join(runDirectory, 'update', appName);
  const packageManifest = JSON.parse(readFileSync(path.join(outputRoot, input.packageManifestName), 'utf8')) as {
    schemaVersion: number;
    publicationId: string;
    zip: Readonly<{path: string; sha256: string}>;
    apk: Readonly<{path: string; sha256: string}>;
  };
  const zipName = `${appName}-compat-external-full.zip`;
  if (
    packageManifest.schemaVersion !== 1 ||
    packageManifest.publicationId !== input.artifact.publicationId ||
    packageManifest.zip.path !== zipName ||
    packageManifest.apk.path !== `${appName}.apk` ||
    packageManifest.apk.sha256 !== input.artifact.apk.sha256 ||
    !/^[a-f0-9]{64}$/u.test(packageManifest.zip.sha256) ||
    !/^[a-f0-9]{64}$/u.test(packageManifest.apk.sha256)
  )
    throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_EXTERNAL_PACKAGE_IDENTITY_INVALID');

  const zipPath = path.join(outputRoot, zipName);
  if ((await sha256File(zipPath)) !== packageManifest.zip.sha256)
    throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_EXTERNAL_ZIP_DIGEST_MISMATCH');
  const listing = spawnSync('unzip', ['-Z1', zipPath], {encoding: 'utf8', maxBuffer: 1024 * 1024});
  if (listing.error || listing.status !== 0 || listing.stdout.trim() !== packageManifest.apk.path)
    throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_EXTERNAL_ZIP_ENTRY_MISMATCH');

  const apkPath = path.join(outputRoot, `${appName}-compat-external.apk`);
  const outputDescriptor = openSync(apkPath, 'w', 0o600);
  let extraction;
  try {
    extraction = spawnSync('unzip', ['-p', zipPath, packageManifest.apk.path], {
      encoding: 'buffer',
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', outputDescriptor, 'pipe'],
    });
  } finally {
    closeSync(outputDescriptor);
  }
  if (extraction.error || extraction.status !== 0 || (await sha256File(apkPath)) !== packageManifest.apk.sha256) {
    rmSync(apkPath, {force: true});
    throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_EXTERNAL_APK_DIGEST_MISMATCH');
  }
  return apkPath;
};
const createStaffLoginPort = (
  connection: AndroidAutomationConnection,
  session: Awaited<ReturnType<typeof waitForAutomationSession>>,
) => {
  const resolveSessionId = async (previousSessionId: string): Promise<string> => {
    const replacement = await resolveCurrentAutomationSession(
      connection.driver,
      {...session, sessionId: previousSessionId},
      30_000,
    );
    if (replacement.sessionId === previousSessionId) return previousSessionId;
    process.stdout.write(
      `TERMINAL_AUTOMATION_SESSION_REBOUND run=${runId ?? 'UNKNOWN'} app=${session.appName} previous=${previousSessionId} current=${replacement.sessionId}\n`,
    );
    return replacement.sessionId;
  };
  const ui = createAndroidJourneyUiPort({
    connection,
    sessionId: session.sessionId,
    resolveSessionId,
    onStep: step => process.stdout.write(`TERMINAL_AUTOMATION_DRIVER_STEP run=${runId} step=${step}\n`),
  });
  const withServer = (currentUi: ReturnType<typeof createAndroidJourneyUiPort>) => ({
    ...currentUi,
    server: connection.driver,
    onRequestObserverStep: (step: string) =>
      process.stdout.write(
        `TERMINAL_AUTOMATION_REQUEST_OBSERVER run=${runId ?? 'UNKNOWN'} app=${session.appName} session=${currentUi.sessionId} phase=${step}\n`,
      ),
    refreshSession: async () => withServer(await currentUi.refreshSession!()),
  });
  return withServer(ui);
};
const readArtifact = (file: string): ArtifactManifest => {
  if (!runDirectory) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
  return JSON.parse(readFileSync(path.join(runDirectory, 'update', appName, file), 'utf8')) as ArtifactManifest;
};
const writeArtifact = (file: string, artifact: ArtifactManifest): void => {
  if (!runDirectory) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
  writeFileSync(path.join(runDirectory, 'update', appName, file), `${JSON.stringify(artifact, null, 2)}\n`, {
    mode: 0o600,
  });
};

const proxyHeaders = (headers: IncomingHttpHeaders): Record<string, string | string[]> => {
  const blocked = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'host',
  ]);
  return Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string | string[]] =>
        !blocked.has(entry[0].toLowerCase()) && (typeof entry[1] === 'string' || Array.isArray(entry[1])),
    ),
  );
};

const BUSINESS_PROXY_DEFAULT_SOCKET_IDLE_TIMEOUT_MS = 15_000;
const TERMINAL_UPDATE_CONTENT_SOCKET_IDLE_TIMEOUT_MS = 115_000;

const classifyBusinessProxyOperation = (method: string, path: string): string => {
  if (method === 'GET' && /^\/api\/terminal\/group-workspaces\/[^/]+\/stores\/[^/]+\/basic$/u.test(path))
    return 'terminalReadStoreBasic';
  if (method === 'GET' && path === '/api/operations/audit-history') return 'operationsReadAuditHistory';
  if (path.endsWith('/terminal-update-artifact-stages')) return 'terminalUpdateArtifactStage';
  if (path.includes('/terminal-update-artifact-stages/') && path.endsWith('/release'))
    return 'terminalUpdateArtifactStageRelease';
  if (path.includes('/terminal-update-artifact-stages/')) return 'terminalUpdateArtifactStageRelease';
  if (path.endsWith('/terminal-update-artifacts'))
    return method === 'POST' ? 'terminalUpdateArtifactRegister' : 'terminalUpdateArtifactPage';
  if (path.includes('/terminal-update-artifacts/')) return 'terminalUpdateArtifactDetail';
  if (path.endsWith('/terminal-update-artifact-candidates')) return 'terminalUpdateArtifactCandidates';
  if (path.endsWith('/terminal-update-rules'))
    return method === 'POST' ? 'terminalUpdateRuleCreate' : 'terminalUpdateRulePage';
  if (path.includes('/terminal-update-rules/') && path.endsWith('/status')) return 'terminalUpdateRuleStatus';
  if (path.includes('/terminal-update-rules/') && path.endsWith('/stores')) return 'terminalUpdateRuleStores';
  if (path.includes('/terminal-update-rules/')) return 'terminalUpdateRuleDetail';
  if (/\/projects\/[^/]+\/terminal-versions\/[^/]+\/update-reports$/u.test(path)) return 'terminalUpdateReportHistory';
  if (/\/projects\/[^/]+\/terminal-versions\/[^/]+$/u.test(path)) return 'terminalUpdateVersionDetail';
  if (/\/projects\/[^/]+\/terminal-versions$/u.test(path)) return 'terminalUpdateVersionPage';
  if (method === 'GET' && /^\/api\/terminal\/group-workspaces\/[^/]+\/update-rules\/projects\/[^/]+$/u.test(path))
    return 'terminalReadProjectUpdateRuleSnapshotPage';
  if (path.includes('/update-rules/projects/')) return 'terminalUpdateRuleSnapshot';
  if (path.includes('/update-artifacts/') && path.endsWith('/download-grant')) return 'terminalUpdateArtifactGrant';
  if (path.includes('/update-artifacts/') && path.endsWith('/content')) return 'terminalUpdateArtifactContent';
  if (path.endsWith('/update-reports')) return 'terminalUpdateReportSubmit';
  if (path.includes('/terminal-update')) return 'terminalUpdateRead';
  return 'other';
};

const forwardManagedBusinessRequest = (
  request: import('node:http').IncomingMessage,
  response: import('node:http').ServerResponse,
  runId: string,
  proxyRequestId: number,
  operation: string,
): void => {
  const startedAt = Date.now();
  const errorTags = (failure: unknown): {errorType: string; errorCode: string} => {
    const candidate = failure as {name?: unknown; code?: unknown} | null;
    const name = typeof candidate?.name === 'string' ? candidate.name : '';
    const code = typeof candidate?.code === 'string' ? candidate.code : '';
    return {
      errorType: /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(name) ? name : 'UnknownError',
      errorCode: /^[A-Z0-9_]{1,48}$/.test(code) ? code : 'UNCLASSIFIED',
    };
  };
  const base = process.env.V2S_TERMINAL_DEV_HTTP_BASE_URL;
  if (!base || !request.url?.startsWith('/api/')) {
    response.writeHead(502);
    response.end();
    return;
  }
  let target: URL;
  try {
    target = new URL(request.url, base);
  } catch {
    response.writeHead(502);
    response.end();
    process.stdout.write(`TERMINAL_AUTOMATION_BUSINESS_PROXY_FAILED run=${runId} code=UPSTREAM_URL_INVALID\n`);
    return;
  }
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.username || target.password) {
    response.writeHead(502);
    response.end();
    process.stdout.write(`TERMINAL_AUTOMATION_BUSINESS_PROXY_FAILED run=${runId} code=UPSTREAM_ORIGIN_INVALID\n`);
    return;
  }
  const upstream = createHttpRequest(
    target,
    {method: request.method, headers: proxyHeaders(request.headers)},
    result => {
      response.writeHead(result.statusCode ?? 502, proxyHeaders(result.headers));
      let responseBytes = 0;
      let upstreamBodyFailed = false;
      result.on('data', chunk => {
        responseBytes += Buffer.isBuffer(chunk) ? chunk.byteLength : Buffer.byteLength(String(chunk));
      });
      result.once('end', () =>
        process.stdout.write(
          `TERMINAL_AUTOMATION_BUSINESS_PROXY_BODY_END run=${runId} request=${proxyRequestId} operation=${operation} bytes=${responseBytes} elapsedMs=${Math.max(0, Date.now() - startedAt)}\n`,
        ),
      );
      result.once('error', failure => {
        upstreamBodyFailed = true;
        const tags = errorTags(failure);
        process.stdout.write(
          `TERMINAL_AUTOMATION_BUSINESS_PROXY_BODY_FAILED run=${runId} request=${proxyRequestId} operation=${operation} bytes=${responseBytes} errorType=${tags.errorType} errorCode=${tags.errorCode} elapsedMs=${Math.max(0, Date.now() - startedAt)}\n`,
        );
        result.unpipe(response);
        response.destroy();
        upstream.destroy();
      });
      response.once('finish', () =>
        process.stdout.write(
          `TERMINAL_AUTOMATION_BUSINESS_PROXY_FORWARD_FINISHED run=${runId} request=${proxyRequestId} operation=${operation} status=${result.statusCode ?? 502} bytes=${responseBytes} elapsedMs=${Math.max(0, Date.now() - startedAt)}\n`,
        ),
      );
      response.once('close', () => {
        if (!response.writableFinished) {
          if (!upstreamBodyFailed)
            process.stdout.write(
              `TERMINAL_AUTOMATION_BUSINESS_PROXY_CLIENT_CLOSED run=${runId} request=${proxyRequestId} operation=${operation} bytes=${responseBytes} elapsedMs=${Math.max(0, Date.now() - startedAt)}\n`,
            );
          result.unpipe(response);
          result.destroy();
          upstream.destroy();
        }
      });
      result.pipe(response);
      process.stdout.write(
        `TERMINAL_AUTOMATION_BUSINESS_PROXY_RESPONSE_HEADERS run=${runId} request=${proxyRequestId} operation=${operation} status=${result.statusCode ?? 502} elapsedMs=${Math.max(0, Date.now() - startedAt)}\n`,
      );
    },
  );
  const socketIdleTimeoutMs =
    operation === 'terminalUpdateArtifactContent'
      ? TERMINAL_UPDATE_CONTENT_SOCKET_IDLE_TIMEOUT_MS
      : BUSINESS_PROXY_DEFAULT_SOCKET_IDLE_TIMEOUT_MS;
  process.stdout.write(
    `TERMINAL_AUTOMATION_BUSINESS_PROXY_TIMEOUT run=${runId} request=${proxyRequestId} operation=${operation} socketIdleTimeoutMs=${socketIdleTimeoutMs}\n`,
  );
  upstream.setTimeout(socketIdleTimeoutMs, () => upstream.destroy(new Error('UPSTREAM_TIMEOUT')));
  upstream.once('error', error => {
    const tags = errorTags(error);
    const code = error instanceof Error && error.message === 'UPSTREAM_TIMEOUT' ? 'UPSTREAM_TIMEOUT' : tags.errorCode;
    process.stdout.write(
      `TERMINAL_AUTOMATION_BUSINESS_PROXY_FAILED run=${runId} request=${proxyRequestId} operation=${operation} code=${code} errorType=${tags.errorType}\n`,
    );
    if (!response.headersSent) response.writeHead(502);
    response.end();
  });
  request.pipe(upstream);
};
const listen = async <T extends HttpServer | NetServer>(server: T): Promise<number> =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address();
      if (address === null || typeof address === 'string')
        reject(new Error('TERMINAL_AUTOMATION_UPDATE_PORT_UNAVAILABLE'));
      else resolve(address.port);
    });
  });
const closeServer = async (server: HttpServer | NetServer | undefined): Promise<void> => {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
};

let adb: Client | undefined;
let connection: AndroidAutomationConnection | undefined;
let androidNativeArchitecture: string | undefined;
let packageId: string | undefined;
let packageWasAbsent = false;
let installAttempted = false;
let httpServer: HttpServer | undefined;
let tdsOneSink: NetServer | undefined;
let tdsTwoSink: NetServer | undefined;
let supplyUi: TerminalUpdateSupplyUi | undefined;
let supplyStoreRef: string | undefined;
let supplyTerminalRef: string | undefined;
let supplyTerminalName: string | undefined;
let targetDocument: Readonly<{target: UpdateTarget; sourcePaths: Readonly<Record<string, string>>}> | undefined;
let hotSourceRequested: Promise<void> | undefined;
let signalHotSourceRequested: (() => void) | undefined;
let hotSourceResponseGate: Promise<void> | undefined;
let releaseHotSourceResponse: (() => void) | undefined;
let initialSessionId: string | null = null;
let initialDeviceId: string | null = null;
let compatibilityTargetDocument:
  Readonly<{target: UpdateTarget; sourcePaths: Readonly<Record<string, string>>}> | undefined;
const updatePayloadPaths = new Map<
  ArtifactManifest,
  Readonly<{readonly kind: 'full' | 'hot'; readonly path: string}>
>();

const responseResult = (response: unknown): unknown => {
  if (
    typeof response !== 'object' ||
    response === null ||
    !('type' in response) ||
    response.type !== 'response' ||
    !('body' in response) ||
    typeof response.body !== 'object' ||
    response.body === null ||
    !('result' in response.body)
  )
    throw new Error('TERMINAL_AUTOMATION_UPDATE_RESPONSE_INVALID');
  return response.body.result;
};
const writeUpdateStateDiagnostics = async (
  driver: AndroidAutomationConnection['driver'],
  sessionId: string,
  runId: string,
): Promise<void> => {
  try {
    const [task, status, connection, latency, reportDelivery] = await Promise.all([
      readSelector(driver, sessionId, 'kernel.base.terminal-update.selectTerminalUpdateTask', []),
      readSelector(driver, sessionId, 'kernel.base.terminal-update.selectTerminalUpdateRecentStatus', []),
      readSelector(driver, sessionId, 'kernel.base.terminal-data-client.selectConnectionState', []),
      readSelector(driver, sessionId, 'kernel.base.terminal-data-client.selectConnectionLatency', []),
      readSelector(driver, sessionId, 'kernel.base.terminal-update.selectTerminalUpdateReportDelivery', []),
    ]);
    const taskRecord = isRecord(task) ? task : {};
    const statusRecord = isRecord(status) ? status : {};
    const connectionRecord = isRecord(connection) ? connection : {};
    const latencyRecord = isRecord(latency) ? latency : {};
    const reportRecord = isRecord(reportDelivery) ? reportDelivery : {};
    const token = (value: unknown): string =>
      typeof value === 'string' && /^[a-z0-9_-]{1,80}$/iu.test(value)
        ? value.toUpperCase()
        : value === null
          ? 'NONE'
          : 'UNKNOWN';
    process.stdout.write(
      [
        `TERMINAL_AUTOMATION_UPDATE_STATE run=${runId}`,
        `phase=${token(taskRecord.phase)}`,
        `failure=${token(taskRecord.failureCode)}`,
        `status=${token(statusRecord.state)}`,
        `reason=${token(statusRecord.reason)}`,
        `tds=${token(connectionRecord.status)}`,
        `tdsClose=${token(connectionRecord.lastCloseReason)}`,
        `tdsSession=${connectionRecord.sessionId === null || connectionRecord.sessionId === undefined ? 'NONE' : 'PRESENT'}`,
        `rttMs=${Number.isSafeInteger(latencyRecord.lastRttMs) ? String(latencyRecord.lastRttMs) : 'UNKNOWN'}`,
        `rttSamples=${Array.isArray(latencyRecord.samples) ? latencyRecord.samples.length : 'UNKNOWN'}`,
        `reportPending=${typeof reportRecord.pendingCount === 'number' ? String(reportRecord.pendingCount) : 'UNKNOWN'}`,
        `reportPaused=${reportRecord.sendPaused === true ? 1 : reportRecord.sendPaused === false ? 0 : 'UNKNOWN'}`,
        `reportFailure=${isRecord(reportRecord.latestDeliveryFailure) ? token(reportRecord.latestDeliveryFailure.reasonCode) : 'NONE'}`,
      ].join(' ') + '\n',
    );
  } catch (error) {
    const code =
      error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+$/u.test(error.message)
        ? error.message
        : 'TERMINAL_AUTOMATION_UPDATE_STATE_READ_FAILED';
    process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_STATE_NOT_AVAILABLE run=${runId} code=${code}\n`);
  }
};
const writeNativeUpdateDiagnostics = async (
  input: Readonly<{
    readonly connection: AndroidAutomationConnection;
    readonly packageId: string;
    readonly runId: string;
  }>,
): Promise<Readonly<{readonly installerSucceeded: boolean; readonly changedApkBooted: boolean}>> => {
  let installerSucceeded = false;
  let changedApkBooted = false;
  try {
    const diagnostics = await input.connection.readTerminalUpdateLogs(input.packageId);
    process.stdout.write(
      diagnostics.length === 0
        ? `TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG_NOT_AVAILABLE run=${input.runId}\n`
        : diagnostics
            .split('\n')
            .map(line => `TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG run=${input.runId} ${line}`)
            .join('\n') + '\n',
    );
    installerSucceeded = /event=installer-callback status=0(?:\s|$)/u.test(diagnostics);
    changedApkBooted = /event=boot-reserved entryKind=embedded apkChanged=true(?:\s|$)/u.test(diagnostics);
  } catch {
    process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG_NOT_AVAILABLE run=${input.runId}\n`);
  }
  try {
    const runtimeDiagnostics = await input.connection.readRuntimeFailureDiagnostics(input.packageId);
    if (runtimeDiagnostics.length === 0) {
      process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_RUNTIME_LOG_EMPTY run=${input.runId}\n`);
    } else {
      for (const line of runtimeDiagnostics.split('\n')) {
        process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_RUNTIME_LOG run=${input.runId} fact=${line}\n`);
      }
    }
  } catch {
    process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_RUNTIME_LOG_NOT_AVAILABLE run=${input.runId}\n`);
  }
  return Object.freeze({
    installerSucceeded,
    changedApkBooted,
  });
};

const writeAndroidFailureDiagnostics = async (
  input: Readonly<{
    readonly connection: AndroidAutomationConnection;
    readonly packageId: string;
    readonly runId: string;
    readonly boundary: 'full-session' | 'hot-session';
    readonly expectedSessionId?: string;
  }>,
): Promise<void> => {
  const diagnostics = input.connection.driver.getDiagnostics();
  const currentSessions = input.connection.driver.getSessions().map(session => ({
    appName: session.appName,
    sessionId: session.sessionId,
    runtimeId: session.runtimeId,
  }));
  process.stdout.write(
    [
      `TERMINAL_AUTOMATION_ANDROID_DRIVER_STATE run=${input.runId}`,
      `boundary=${input.boundary}`,
      `socketConnections=${diagnostics.socketConnections}`,
      `authenticatedSessions=${diagnostics.authenticatedSessions}`,
      `authenticationTimeouts=${diagnostics.authenticationTimeouts}`,
      `rejectedMessages=${diagnostics.rejectedMessages}`,
      `activeSockets=${diagnostics.activeSockets}`,
      `activeSessions=${diagnostics.activeSessions}`,
      `expectedSessionPresent=${input.expectedSessionId === undefined ? 'unknown' : Number(currentSessions.some(session => session.sessionId === input.expectedSessionId))}`,
      `sessions=${JSON.stringify(currentSessions)}`,
    ].join(' ') + '\n',
  );
  try {
    process.stdout.write(
      `TERMINAL_AUTOMATION_ANDROID_SCREEN run=${input.runId} boundary=${input.boundary} ` +
        `summary=${await input.connection.systemUi.readScreenSummary()}\n`,
    );
  } catch (error) {
    const code =
      error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+(?:_[A-Z0-9]+)*$/u.test(error.message)
        ? error.message
        : 'TERMINAL_AUTOMATION_ANDROID_SCREEN_SUMMARY_UNAVAILABLE';
    process.stdout.write(`TERMINAL_AUTOMATION_ANDROID_SCREEN_NOT_AVAILABLE run=${input.runId} code=${code}\n`);
  }
  try {
    const runtimeDiagnostics = await input.connection.readRuntimeFailureDiagnostics(input.packageId);
    if (runtimeDiagnostics.length === 0) {
      process.stdout.write(
        `TERMINAL_AUTOMATION_ANDROID_RUNTIME_DIAGNOSTICS_EMPTY run=${input.runId} boundary=${input.boundary}\n`,
      );
    } else {
      for (const line of runtimeDiagnostics.split('\n')) {
        process.stdout.write(
          `TERMINAL_AUTOMATION_ANDROID_RUNTIME_DIAGNOSTIC run=${input.runId} boundary=${input.boundary} fact=${line}\n`,
        );
      }
    }
  } catch (error) {
    const code =
      error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+(?:_[A-Z0-9]+)*$/u.test(error.message)
        ? error.message
        : 'TERMINAL_AUTOMATION_ANDROID_RUNTIME_DIAGNOSTICS_UNAVAILABLE';
    process.stdout.write(
      `TERMINAL_AUTOMATION_ANDROID_RUNTIME_DIAGNOSTICS_NOT_AVAILABLE run=${input.runId} code=${code}\n`,
    );
  }
  if (runDirectory) {
    const screenshotPath = path.join(runDirectory, `${input.boundary}-failure.png`);
    try {
      writeFileSync(screenshotPath, await input.connection.capture('primary'), {mode: 0o600});
      process.stdout.write(
        `TERMINAL_AUTOMATION_ANDROID_FAILURE_SCREEN run=${input.runId} boundary=${input.boundary} path=${screenshotPath}\n`,
      );
    } catch {
      process.stdout.write(
        `TERMINAL_AUTOMATION_ANDROID_FAILURE_SCREEN_NOT_AVAILABLE run=${input.runId} boundary=${input.boundary}\n`,
      );
    }
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const waitForCommandResult = (
  driver: AndroidAutomationConnection['driver'],
  sessionId: string,
  requestId: string,
  timeoutMs: number,
): Readonly<{promise: Promise<Record<string, unknown>>; cancel: () => void}> => {
  let unsubscribe = (): void => undefined;
  let timer: NodeJS.Timeout | undefined;
  let settled = false;
  let resolveResult: (value: Record<string, unknown>) => void = () => undefined;
  let rejectResult: (reason: Error) => void = () => undefined;
  const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const finish = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    unsubscribe();
  };
  unsubscribe = driver.onMessage(sessionId, message => {
    if (
      message.type !== 'event' ||
      !isRecord(message.body) ||
      message.body.kind !== 'command.result' ||
      message.body.requestId !== requestId ||
      settled
    )
      return;
    settled = true;
    finish();
    resolveResult(message.body);
  });
  timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    finish();
    rejectResult(new Error('TERMINAL_AUTOMATION_UPDATE_COMMAND_RESULT_TIMEOUT'));
  }, timeoutMs);
  return Object.freeze({
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      finish();
      rejectResult(new Error('TERMINAL_AUTOMATION_UPDATE_COMMAND_RESULT_CANCELLED'));
    },
  });
};

const waitForWallpaperAssets = async (
  driver: AndroidAutomationConnection['driver'],
  sessionId: string,
  stage: 'full' | 'hot',
): Promise<void> => {
  const subscriptionId = `wallpaper-assets-${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  let subscribed = false;
  let unsubscribeMessages = (): void => undefined;
  let timer: NodeJS.Timeout | undefined;
  let resolveLoaded: () => void = () => undefined;
  let rejectLoaded: (error: Error) => void = () => undefined;
  const loaded = new Promise<void>((resolve, reject) => {
    resolveLoaded = resolve;
    rejectLoaded = reject;
  });
  const statusSummary = (nodes: unknown): string => {
    if (!Array.isArray(nodes)) return 'nodes=invalid';
    const matching = nodes.filter(node => isRecord(node) && node.testID === mainSampleTestIds.wallpaperAssetLoadStatus);
    const values = matching.map(node =>
      isRecord(node) && typeof node.value === 'string'
        ? (node.value.match(/^loaded=\d+\/\d+;failed=\d+;failedIds=(?:none|[A-Za-z0-9._,-]*)$/u)?.[0] ??
          'value=invalid')
        : 'value=missing',
    );
    return `nodes=${nodes.length} statusNodes=${matching.length} status=${values.join('|') || 'missing'}`;
  };
  const isLoaded = (nodes: unknown): boolean =>
    Array.isArray(nodes) &&
    nodes.some(
      node =>
        isRecord(node) &&
        node.testID === mainSampleTestIds.wallpaperAssetLoadStatus &&
        typeof node.value === 'string' &&
        /^loaded=(\d+)\/\1;failed=0;failedIds=none$/u.test(node.value) &&
        node.value !== 'loaded=0/0;failed=0;failedIds=none',
    );
  unsubscribeMessages = driver.onMessage(sessionId, message => {
    if (message.type !== 'event' || !isRecord(message.body) || message.body.subscriptionId !== subscriptionId) return;
    if (isLoaded(message.body.nodes)) resolveLoaded();
    else if (Array.isArray(message.body.nodes)) {
      const status = message.body.nodes.find(
        node =>
          isRecord(node) &&
          node.testID === mainSampleTestIds.wallpaperAssetLoadStatus &&
          typeof node.value === 'string' &&
          /failed=[1-9]/u.test(node.value),
      );
      if (isRecord(status) && typeof status.value === 'string') {
        process.stdout.write(
          `TERMINAL_AUTOMATION_WALLPAPER_ASSETS run=${runId} stage=${stage} state=failed ${status.value}\n`,
        );
        rejectLoaded(new Error(`TERMINAL_AUTOMATION_WALLPAPER_ASSET_LOAD_FAILED_${stage.toUpperCase()}`));
      }
    }
  });
  try {
    const result = responseResult(
      await driver.request(sessionId, 'controls.subscribe', {
        subscriptionId,
        // The probe is unique to this test host. Do not bind its observation to
        // a physical surface identity; application surface metadata may differ
        // from the screen currently shown after a FULL install.
        filter: {testID: mainSampleTestIds.wallpaperAssetLoadStatus},
      }),
    );
    subscribed = true;
    process.stdout.write(
      `TERMINAL_AUTOMATION_WALLPAPER_ASSETS run=${runId} stage=${stage} phase=subscribe ${statusSummary(isRecord(result) ? result.nodes : undefined)}\n`,
    );
    if (!isRecord(result) || !Array.isArray(result.nodes) || result.nodes.length === 0) {
      const registry = responseResult(await driver.request(sessionId, 'controls.query', {filter: {}}));
      const nodes = isRecord(registry) && Array.isArray(registry.nodes) ? registry.nodes : [];
      const related = nodes.filter(
        node =>
          isRecord(node) &&
          typeof node.testID === 'string' &&
          (node.testID.includes('wallpaper') || node.testID.includes('asset-load-status')),
      );
      const diagnostic = related.slice(0, 8).map(node => {
        if (!isRecord(node)) return 'invalid';
        const surface = isRecord(node.surface)
          ? `${String(node.surface.surface)}:${String(node.surface.displayIndex)}`
          : 'unknown';
        const value =
          typeof node.value === 'string' &&
          /^loaded=\d+\/\d+;failed=\d+;failedIds=(?:none|[A-Za-z0-9._,-]*)$/u.test(node.value)
            ? node.value
            : 'omitted';
        return `${String(node.testID)}@${surface}=${value}`;
      });
      process.stdout.write(
        `TERMINAL_AUTOMATION_WALLPAPER_ASSETS run=${runId} stage=${stage} phase=registry-diagnostic totalNodes=${nodes.length} ` +
          `target=${mainSampleTestIds.wallpaperAssetLoadStatus} targetCount=${nodes.filter(node => isRecord(node) && node.testID === mainSampleTestIds.wallpaperAssetLoadStatus).length} ` +
          `related=${diagnostic.join('|') || 'none'}\n`,
      );
    }
    if (isRecord(result) && isLoaded(result.nodes)) {
      process.stdout.write(`TERMINAL_AUTOMATION_WALLPAPER_ASSETS run=${runId} stage=${stage} state=loaded\n`);
      return;
    }
    timer = setTimeout(() => {
      process.stdout.write(
        `TERMINAL_AUTOMATION_WALLPAPER_ASSETS run=${runId} stage=${stage} phase=timeout ${statusSummary(isRecord(result) ? result.nodes : undefined)}\n`,
      );
      rejectLoaded(new Error(`TERMINAL_AUTOMATION_WALLPAPER_ASSET_LOAD_TIMEOUT_${stage.toUpperCase()}`));
    }, 20_000);
    await loaded;
    process.stdout.write(`TERMINAL_AUTOMATION_WALLPAPER_ASSETS run=${runId} stage=${stage} state=loaded\n`);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    unsubscribeMessages();
    if (subscribed) {
      const released = responseResult(await driver.request(sessionId, 'controls.unsubscribe', {subscriptionId}));
      if (!isRecord(released) || released.released !== true) {
        throw new Error(`TERMINAL_AUTOMATION_WALLPAPER_ASSET_SUBSCRIPTION_RELEASE_FAILED_${stage.toUpperCase()}`);
      }
    }
  }
};

const buildArtifact = (
  kind: 'install' | 'full' | 'hot',
  options?: Readonly<{nativeBuildNumber?: number; bundleVersion?: string; minimumFullManifest?: string}>,
): void => {
  if (!runId || !packageId || !httpServer) throw new Error('TERMINAL_AUTOMATION_UPDATE_BUILD_CONTEXT_MISSING');
  const shape = parseMainSampleShape(process.env.TERMINAL_AUTOMATION_SHAPE);
  const surfaceForm = mainSampleSurfaceForm(shape);
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('TERMINAL_AUTOMATION_UPDATE_HTTP_ADDRESS_MISSING');
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    ...(androidNativeArchitecture === undefined
      ? {}
      : {TERMINAL_AUTOMATION_ANDROID_ARCHITECTURES: androidNativeArchitecture}),
    EXPO_PUBLIC_TER_AUTOMATION_BUILD: 'true',
    EXPO_PUBLIC_TER_AUTOMATION_URL: 'ws://127.0.0.1:19090/automation',
    EXPO_PUBLIC_TER_AUTOMATION_TOKEN: sessionToken,
    EXPO_PUBLIC_TER_AUTOMATION_RUN_ID: runId,
    EXPO_PUBLIC_TER_AUTOMATION_SURFACE_FORM: surfaceForm,
    EXPO_PUBLIC_TER_AUTOMATION_ANDROID_PACKAGE_ID: packageId,
    EXPO_PUBLIC_TER_MANAGED_GROUP_WORKSPACE_BASE_URL: 'http://127.0.0.1:28080/api/terminal/group-workspaces/aurora',
    EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_ONE_WS_URL: 'ws://127.0.0.1:28180',
    EXPO_PUBLIC_TER_MANAGED_TDS_ENTRY_TWO_WS_URL: 'ws://127.0.0.1:28181',
  };
  if (updateCase !== 'update.supply-chain') {
    environment.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_TARGET_URL = 'http://127.0.0.1:28080/update-target';
    environment.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_REVISION = kind;
  }
  delete environment.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_ASSET_PROBE;
  if (selectedSample === 'wallpaper') environment.EXPO_PUBLIC_TER_AUTOMATION_UPDATE_ASSET_PROBE = 'true';
  delete environment.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD;
  delete environment.V2S_SEED_PLATFORM_ROOT_PASSWORD;
  delete environment.TERMINAL_AUTOMATION_FULL_NATIVE_BUILD_NUMBER;
  delete environment.TERMINAL_AUTOMATION_UPDATE_BUNDLE_VERSION;
  delete environment.EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION;
  delete environment.EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION_OWNER;
  if (kind === 'full' || kind === 'hot') environment.TERMINAL_AUTOMATION_FULL_NATIVE_BUILD_NUMBER = '2';
  if (kind === 'hot') {
    environment.TERMINAL_AUTOMATION_UPDATE_BUNDLE_VERSION = '1.0.1';
    if (updateCase === 'update.boot-guard' || updateCase === 'update.interruption') {
      environment.EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION = 'true';
      environment.EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION_OWNER = 'surface-content';
    }
  }
  if (options?.nativeBuildNumber !== undefined)
    environment.TERMINAL_AUTOMATION_FULL_NATIVE_BUILD_NUMBER = String(options.nativeBuildNumber);
  if (options?.bundleVersion !== undefined)
    environment.TERMINAL_AUTOMATION_UPDATE_BUNDLE_VERSION = options.bundleVersion;
  const args =
    options === undefined
      ? [`package:${kind}`]
      : [
          path.join(root, 'scripts/build/terminal-update-artifact.mjs'),
          '--app',
          appName,
          '--kind',
          kind,
          '--run-id',
          runId,
          ...(options.minimumFullManifest === undefined
            ? []
            : ['--minimum-full-manifest', options.minimumFullManifest]),
        ];
  const result = spawnSync(options === undefined ? 'yarn' : process.execPath, args, {
    cwd: options === undefined ? path.join(root, 'apps/terminal/application/android', appName) : root,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 8 * 1024 * 1024,
    timeout: 45 * 60 * 1000,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.replaceAll(sessionToken, '[REDACTED]');
  process.stdout.write(output.split('\n').slice(-100).join('\n'));
  if (
    result.error ||
    result.status !== 0 ||
    !output.includes(`TERMINAL_UPDATE_ARTIFACT=${kind.toUpperCase()} PASS app=${appName} run=${runId}`)
  ) {
    throw new Error(
      `TERMINAL_AUTOMATION_UPDATE_ARTIFACT_BUILD_FAILED_${kind.toUpperCase()}_${result.error?.name ?? result.status}`,
    );
  }
  // Ensure the HTTP listener used for reverse-proxy delivery is still owned and live.
  if (httpServer.address() === null || address.port < 1)
    throw new Error('TERMINAL_AUTOMATION_UPDATE_HTTP_LISTENER_LOST');
};

const snapshotCompatibilityArtifact = (
  kind: 'full' | 'hot',
  manifestName: string,
  payloadName: string,
): ArtifactManifest => {
  if (!runDirectory) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
  const outputRoot = path.join(runDirectory, 'update', appName);
  const artifact = readArtifact(`${kind}.json`);
  const sourcePath =
    kind === 'full' ? path.join(outputRoot, `${appName}-full.zip`) : path.join(outputRoot, `${appName}-hot.zip`);
  const targetPath = path.join(outputRoot, payloadName);
  copyFileSync(sourcePath, targetPath);
  const snapshot = artifact;
  writeArtifact(manifestName, snapshot);
  if (kind === 'full') {
    const sourcePackage = JSON.parse(readFileSync(path.join(outputRoot, 'full-package.json'), 'utf8')) as {
      schemaVersion: number;
      publicationId: string;
      apk: Readonly<{path: string; sha256: string; certificateSha256: string}>;
    };
    const packageName = manifestName.replace(/\.json$/u, '-package.json');
    writeFileSync(
      path.join(outputRoot, packageName),
      `${JSON.stringify(
        {
          ...sourcePackage,
          zip: {path: payloadName, sha256: sha256(readFileSync(targetPath))},
        },
        null,
        2,
      )}\n`,
      {mode: 0o600},
    );
  }
  updatePayloadPaths.set(snapshot, Object.freeze({kind, path: targetPath}));
  return snapshot;
};

const updateDocument = (
  full: ArtifactManifest | null,
  hot: ArtifactManifest,
  fullBytes?: Buffer,
  hotBytes?: Buffer,
): Readonly<{target: UpdateTarget; sourcePaths: Readonly<Record<string, string>>}> => {
  if (!runId || !packageId) throw new Error('TERMINAL_AUTOMATION_UPDATE_BUILD_CONTEXT_MISSING');
  const fullRef = `full-${runId}`;
  const hotRef = `hot-${runId}`;
  const hotPayload = updatePayloadPaths.get(hot);
  const fullPayload = full === null ? undefined : updatePayloadPaths.get(full);
  if (hotPayload?.kind !== 'hot' || (full !== null && fullPayload?.kind !== 'full'))
    throw new Error('TERMINAL_AUTOMATION_UPDATE_PAYLOAD_NOT_REGISTERED');
  const fullPayloadBytes = fullBytes ?? (fullPayload === undefined ? undefined : readFileSync(fullPayload.path));
  const hotPayloadBytes = hotBytes ?? readFileSync(hotPayload.path);
  return Object.freeze({
    target: Object.freeze({
      ruleRef: `automation-${runId}`,
      createdAt: Date.now(),
      applicationId: packageId,
      full:
        full === null
          ? null
          : Object.freeze({sourceRef: fullRef, expectedSha256: sha256(fullPayloadBytes!), artifact: full}),
      hot: Object.freeze({sourceRef: hotRef, expectedSha256: sha256(hotPayloadBytes), artifact: hot}),
      strategy: Object.freeze({maxNetworkAttempts: 0, bootTimeoutMs: 60_000}),
      selectionContext: Object.freeze({
        selectedSpace: 'development',
        contextIdentity: runId,
        ruleRef: `automation-${runId}`,
      }),
    }),
    sourcePaths: Object.freeze({...(full === null ? {} : {[fullRef]: '/full.zip'}), [hotRef]: '/hot.zip'}),
  });
};

const resetHotSourceGate = (gated: boolean): void => {
  hotSourceRequested = new Promise<void>(resolve => {
    signalHotSourceRequested = resolve;
  });
  hotSourceResponseGate = gated
    ? new Promise<void>(resolve => {
        releaseHotSourceResponse = resolve;
      })
    : Promise.resolve();
  if (!gated) releaseHotSourceResponse = () => undefined;
};

beforeAll(
  async () => {
    if (
      updateCase !== 'update.full-hot' &&
      updateCase !== 'update.offline-assets' &&
      updateCase !== 'update.boot-guard' &&
      updateCase !== 'update.install-result' &&
      updateCase !== 'update.interruption' &&
      updateCase !== 'update.compatibility' &&
      updateCase !== 'update.rollback' &&
      updateCase !== 'update.supply-chain'
    )
      return;
    if (!runId || !runDirectory) throw new Error('TERMINAL_AUTOMATION_RUN_ID_REQUIRED');
    if (selectedSample !== 'console' && selectedSample !== 'wallpaper')
      throw new Error('TERMINAL_AUTOMATION_SAMPLE_INVALID');
    const serial = process.env.TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL;
    if (!serial) throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_SERIAL_REQUIRED');
    const managedDevRunId = process.env.TERMINAL_AUTOMATION_MANAGED_DEV_RUN_ID;
    if (!managedDevRunId) throw new Error('TERMINAL_AUTOMATION_MANAGED_DEV_RUN_ID_REQUIRED');
    const identity = androidAutomationBuildIdentity(runId, selectedSample);
    packageId = identity.packageId;

    resetHotSourceGate(updateCase !== 'update.compatibility' && !isSupplyChainCase);
    failNextManagedBusinessRead = false;
    forcedManagedBusinessReadFailures = 0;
    let businessProxyRequestSequence = 0;

    httpServer = createHttpServer((request, response) => {
      if (request.url?.startsWith('/api/')) {
        const requestPath = new URL(request.url, 'http://127.0.0.1').pathname;
        const method = request.method ?? 'UNKNOWN';
        const operationClass = classifyBusinessProxyOperation(method, requestPath);
        const proxyRequestId = ++businessProxyRequestSequence;
        process.stdout.write(
          `TERMINAL_AUTOMATION_BUSINESS_PROXY_REQUEST run=${runId} request=${proxyRequestId} method=${method} operation=${operationClass}\n`,
        );
        if (
          updateCase === 'update.rollback' &&
          failNextManagedBusinessRead &&
          request.method === 'GET' &&
          operationClass === 'terminalReadStoreBasic'
        ) {
          failNextManagedBusinessRead = false;
          forcedManagedBusinessReadFailures += 1;
          response.writeHead(503, {'content-type': 'application/problem+json', 'cache-control': 'no-store'});
          response.end(JSON.stringify({type: 'about:blank', title: 'Unavailable', status: 503}));
          process.stdout.write(
            `TERMINAL_AUTOMATION_BUSINESS_PROXY_FORCED_FAILURE run=${runId} request=${proxyRequestId} operation=terminalReadStoreBasic status=503\n`,
          );
          return;
        }
        forwardManagedBusinessRequest(request, response, runId, proxyRequestId, operationClass);
        return;
      }
      if (request.url?.startsWith('/update-target?revision=') && targetDocument !== undefined) {
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_SOURCE run=${runId} resource=descriptor revision=${new URL(request.url, 'http://127.0.0.1').searchParams.get('revision')} status=200\n`,
        );
        response.writeHead(200, {'content-type': 'application/json', 'cache-control': 'no-store'});
        response.end(JSON.stringify(targetDocument));
        return;
      }
      if (request.url === '/full.zip' && runDirectory) {
        const artifact = targetDocument?.target.full?.artifact;
        const payload = artifact === undefined ? undefined : updatePayloadPaths.get(artifact);
        if (artifact === undefined || payload?.kind !== 'full') {
          response.writeHead(404, {'cache-control': 'no-store'});
          response.end();
          return;
        }
        const bytes = readFileSync(payload.path);
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_SOURCE run=${runId} resource=full.zip status=200 bytes=${bytes.byteLength}\n`,
        );
        response.writeHead(200, {
          'content-type': 'application/zip',
          'cache-control': 'no-store',
        });
        response.end(bytes);
        return;
      }
      if (request.url === '/hot.zip' && runDirectory) {
        const artifact = targetDocument?.target.hot?.artifact;
        const payload = artifact === undefined ? undefined : updatePayloadPaths.get(artifact);
        if (artifact === undefined || payload?.kind !== 'hot') {
          response.writeHead(404, {'cache-control': 'no-store'});
          response.end();
          return;
        }
        const bytes = readFileSync(payload.path);
        signalHotSourceRequested?.();
        void hotSourceResponseGate?.then(() => {
          if (response.destroyed) return;
          process.stdout.write(
            `TERMINAL_AUTOMATION_UPDATE_SOURCE run=${runId} resource=hot.zip status=200 bytes=${bytes.byteLength}\n`,
          );
          response.writeHead(200, {'content-type': 'application/zip', 'cache-control': 'no-store'});
          response.end(bytes);
        });
        return;
      }
      process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_SOURCE run=${runId} resource=unknown status=404\n`);
      response.writeHead(404, {'cache-control': 'no-store'});
      response.end();
    });
    const businessLocalPort = await listen(httpServer);
    let tdsOneLocalPort: number;
    let tdsTwoLocalPort: number;
    if (isSupplyChainCase) {
      tdsOneLocalPort = managedLoopbackPort('V2S_TERMINAL_DEV_TDS_ENTRY_ONE_WS_URL');
      tdsTwoLocalPort = managedLoopbackPort('V2S_TERMINAL_DEV_TDS_ENTRY_TWO_WS_URL');
    } else {
      tdsOneSink = createNetServer(socket => socket.destroy());
      tdsTwoSink = createNetServer(socket => socket.destroy());
      tdsOneLocalPort = await listen(tdsOneSink);
      tdsTwoLocalPort = await listen(tdsTwoSink);
    }

    adb = createAndroidAdbClient({adbPath, timeoutMs: 10_000});
    connection = await createAndroidAutomationConnection({
      client: adb,
      serial,
      repositoryRoot: root,
      adbPath,
      shape: parseMainSampleShape(process.env.TERMINAL_AUTOMATION_SHAPE),
      token: sessionToken,
      managedServicePorts: [
        {remotePort: 28080, localPort: businessLocalPort},
        {remotePort: 28180, localPort: tdsOneLocalPort},
        {remotePort: 28181, localPort: tdsTwoLocalPort},
      ],
      fixtureFactory: server =>
        createManagedActivationFixtureApi({
          server,
          repositoryRoot: root,
          runId,
          managedDevRunId,
          androidDeviceSerial: serial,
          sessionId: () => initialSessionId,
          deviceId: () => {
            if (initialDeviceId === null) throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_IDENTITY_UNAVAILABLE');
            return initialDeviceId;
          },
        }),
    });
    await prepareAndroidJourneySurface(connection, parseMainSampleShape(process.env.TERMINAL_AUTOMATION_SHAPE));
    const apiLevel = await connection.readApiLevel();
    process.stdout.write(`TERMINAL_AUTOMATION_ANDROID_API_LEVEL run=${runId} serial=${serial} api=${apiLevel}\n`);
    if (apiLevel < 29) throw new Error('TERMINAL_AUTOMATION_ANDROID_API_LEVEL_BELOW_29');
    androidNativeArchitecture = await connection.readPrimaryAbi();
    process.stdout.write(
      `TERMINAL_AUTOMATION_ANDROID_PRIMARY_ABI run=${runId} serial=${serial} abi=${androidNativeArchitecture}\n`,
    );
    if (await connection.isInstalled(packageId))
      throw new Error('TERMINAL_AUTOMATION_UPDATE_PACKAGE_ALREADY_INSTALLED');
    packageWasAbsent = true;

    process.stdout.write(
      `TERMINAL_AUTOMATION_UPDATE_ANDROID_PREPARED run=${runId} app=${appName} serial=${serial} package=${packageId}\n`,
    );
    buildArtifact('install');
    let compatibilityHotFive: ArtifactManifest | undefined;
    if (updateCase === 'update.compatibility') {
      buildArtifact('hot', {
        nativeBuildNumber: 1,
        bundleVersion: '1.0.5',
        minimumFullManifest: `update/${appName}/install.json`,
      });
      compatibilityHotFive = snapshotCompatibilityArtifact(
        'hot',
        'compatibility-hot-five.json',
        `${appName}-compat-hot-five.zip`,
      );
      buildArtifact('full', {nativeBuildNumber: 2, bundleVersion: '1.0.4'});
      const compatibilityFull = snapshotCompatibilityArtifact(
        'full',
        'compatibility-full.json',
        `${appName}-compat-full.zip`,
      );
      buildArtifact('full', {nativeBuildNumber: 3, bundleVersion: '1.0.7'});
      const compatibilityExternalFull = snapshotCompatibilityArtifact(
        'full',
        'compatibility-external-full.json',
        `${appName}-compat-external-full.zip`,
      );
      if (compatibilityExternalFull.nativeBuildNumber <= compatibilityFull.nativeBuildNumber)
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_EXTERNAL_APK_NOT_HIGHER');
      writeArtifact('full.json', compatibilityFull);
      buildArtifact('hot', {
        nativeBuildNumber: 2,
        bundleVersion: '1.0.6',
        minimumFullManifest: `update/${appName}/compatibility-full.json`,
      });
      const compatibilityHotSix = snapshotCompatibilityArtifact(
        'hot',
        'compatibility-hot-six.json',
        `${appName}-compat-hot-six.zip`,
      );
      updatePayloadPaths.set(
        compatibilityHotSix,
        Object.freeze({kind: 'hot', path: path.join(runDirectory, 'update', appName, `${appName}-compat-hot-six.zip`)}),
      );
      updatePayloadPaths.set(
        compatibilityHotFive,
        Object.freeze({
          kind: 'hot',
          path: path.join(runDirectory, 'update', appName, `${appName}-compat-hot-five.zip`),
        }),
      );
      if (
        compatibilityHotFive.publicationId !== compatibilityHotSix.publicationId ||
        updatePayloadPaths.get(compatibilityHotFive)?.path !==
          path.join(runDirectory, 'update', appName, `${appName}-compat-hot-five.zip`) ||
        updatePayloadPaths.get(compatibilityHotSix)?.path !==
          path.join(runDirectory, 'update', appName, `${appName}-compat-hot-six.zip`)
      ) {
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_HOT_PAYLOAD_IDENTITY_INVALID');
      }
      compatibilityTargetDocument = updateDocument(compatibilityFull, compatibilityHotSix);
    } else {
      buildArtifact('full');
      buildArtifact('hot');
    }

    const install = readArtifact('install.json');
    const full = readArtifact('full.json');
    const hot = readArtifact('hot.json');
    if (
      !install.apk ||
      !full.apk ||
      !hot.minimumFull ||
      full.nativeBuildNumber !== 2 ||
      full.bundleVersion !== (updateCase === 'update.compatibility' ? '1.0.4' : '1.0.0') ||
      hot.bundleVersion !== (updateCase === 'update.compatibility' ? '1.0.6' : '1.0.1') ||
      install.applicationId !== packageId ||
      full.applicationId !== packageId ||
      hot.applicationId !== packageId ||
      hot.minimumFull.apkSha256 !== full.apk.sha256 ||
      full.nativeBuildNumber <= install.nativeBuildNumber ||
      hot.nativeBuildNumber !== full.nativeBuildNumber ||
      hot.bundleVersion <= install.bundleVersion
    ) {
      throw new Error('TERMINAL_AUTOMATION_UPDATE_ARTIFACT_CHAIN_INVALID');
    }
    const fullZipPath = path.join(runDirectory, 'update', appName, `${appName}-full.zip`);
    const fullBytes = readFileSync(fullZipPath);
    const hotBytes = readFileSync(path.join(runDirectory, 'update', appName, `${appName}-hot.zip`));
    updatePayloadPaths.set(full, Object.freeze({kind: 'full', path: fullZipPath}));
    updatePayloadPaths.set(
      hot,
      Object.freeze({kind: 'hot', path: path.join(runDirectory, 'update', appName, `${appName}-hot.zip`)}),
    );
    if (updateCase === 'update.compatibility') {
      if (!compatibilityHotFive) throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_HOT_FIVE_MISSING');
      targetDocument = updateDocument(null, compatibilityHotFive);
    } else if (!isSupplyChainCase) {
      targetDocument = updateDocument(full, hot, fullBytes, hotBytes);
    } else {
      targetDocument = undefined;
    }

    installAttempted = true;
    await connection.install(path.join(runDirectory, 'update', appName, install.apk.path));
    if (!(await connection.isInstalled(packageId)))
      throw new Error('TERMINAL_AUTOMATION_UPDATE_INSTALL_READBACK_FAILED');
    await connection.launch(`${packageId}/${sample.applicationId}.MainActivity`);
    const initial = await waitForAutomationSession(
      connection.driver,
      value => value.appName === sample.appName,
      60_000,
    );
    const actual = await readSelector(
      connection.driver,
      initial.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
      [],
    );
    expect(actual).toMatchObject({
      applicationId: packageId,
      nativeBuildNumber: install.nativeBuildNumber,
      entryKind: 'embedded',
    });
    initialSessionId = initial.sessionId;
    initialDeviceId = await readApplicationDeviceId(connection.driver, initial.sessionId);
    try {
      await ensureMainSampleActivated(connection.fixtures, {
        shape: parseMainSampleShape(process.env.TERMINAL_AUTOMATION_SHAPE),
        deviceId: initialDeviceId,
        runId,
      });
    } catch (error) {
      await writeAndroidFailureDiagnostics({connection, packageId, runId, boundary: 'full-session'});
      throw error;
    }
    if (isSupplyChainCase) {
      const manifestPath = process.env.V2S_TERMINAL_DEV_MANIFEST;
      const platformOrigin = process.env.TERMINAL_AUTOMATION_PLATFORM_ADMIN_ORIGIN;
      const operationsOrigin = process.env.TERMINAL_AUTOMATION_OPERATIONS_ADMIN_ORIGIN;
      const platformPassword = process.env.V2S_SEED_PLATFORM_ROOT_PASSWORD;
      const operationsPassword = process.env.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD;
      if (!manifestPath || !platformOrigin || !operationsOrigin || !platformPassword || !operationsPassword)
        throw new Error('TERMINAL_AUTOMATION_SUPPLY_UI_CONTEXT_MISSING');
      const terminalSeedKey = mainSampleSeedKey(parseMainSampleShape(process.env.TERMINAL_AUTOMATION_SHAPE));
      const terminalName = mainSampleTerminalName(parseMainSampleShape(process.env.TERMINAL_AUTOMATION_SHAPE));
      const {readManagedTerminalBindingByName} = await import('../../../scripts/dev/r5-dev-runner.mjs');
      const bindings = readManagedTerminalBindingByName({
        manifestPath,
        runId: managedDevRunId,
        groupWorkspaceKey: 'aurora',
        terminalNames: [terminalName],
      });
      const binding = bindings[0];
      if (
        bindings.length !== 1 ||
        binding?.bindingStatus !== 'ACTIVE' ||
        binding.boundDeviceId !== initialDeviceId ||
        binding.terminalStatus !== 'ENABLED'
      )
        throw new Error('TERMINAL_AUTOMATION_SUPPLY_TERMINAL_BINDING_READBACK_MISMATCH');
      supplyStoreRef = binding.storeRef;
      supplyTerminalRef = binding.terminalRef;
      supplyTerminalName = terminalName;
      supplyUi = await createTerminalUpdateSupplyUi({
        platformOrigin,
        operationsOrigin,
        platformPassword,
        operationsPassword,
        fullZipPath,
        hotZipPath: path.join(runDirectory, 'update', appName, `${appName}-hot.zip`),
        applicationId: packageId,
        storeRef: binding.storeRef,
        runId,
        verifyIdleDuration: appName === 'sample-terminal',
      });
      process.stdout.write(
        `TERMINAL_AUTOMATION_SUPPLY_IDENTITY run=${runId} terminal=${terminalSeedKey} terminalName=${terminalName} binding=matched store=matched rule=${supplyUi.ruleRef} full=${supplyUi.full.artifactRef} hot=${supplyUi.hot.artifactRef}\n`,
      );
    }
  },
  90 * 60 * 1000,
);

afterAll(async () => {
  if (
    updateCase !== 'update.full-hot' &&
    updateCase !== 'update.offline-assets' &&
    updateCase !== 'update.boot-guard' &&
    updateCase !== 'update.install-result' &&
    updateCase !== 'update.interruption' &&
    updateCase !== 'update.compatibility' &&
    updateCase !== 'update.rollback' &&
    updateCase !== 'update.supply-chain'
  )
    return;
  const errors: string[] = [];
  releaseHotSourceResponse?.();
  if (connection !== undefined && packageId !== undefined) {
    try {
      if (packageWasAbsent && (installAttempted || (await connection.isInstalled(packageId)))) {
        process.stdout.write(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_STAGE run=${runId} stage=force-stop\n`);
        await connection.forceStop(packageId);
        process.stdout.write(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_STAGE run=${runId} stage=uninstall\n`);
        await connection.uninstall(packageId);
      }
      process.stdout.write(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_STAGE run=${runId} stage=package-readback\n`);
      if (await connection.isInstalled(packageId)) errors.push('ANDROID_PACKAGE_REMAINS');
    } catch (error) {
      const code =
        error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+$/u.test(error.message)
          ? error.message
          : 'ANDROID_PACKAGE_CLEANUP_FAILED';
      errors.push(code);
    }
    try {
      process.stdout.write(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_STAGE run=${runId} stage=connection-close\n`);
      await connection.close();
    } catch (error) {
      const code =
        error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+$/u.test(error.message)
          ? error.message
          : 'ANDROID_CONNECTION_CLEANUP_FAILED';
      errors.push(code);
    }
  }
  if (supplyUi !== undefined) {
    try {
      process.stdout.write(`TERMINAL_AUTOMATION_BROWSER_CLEANUP_STAGE run=${runId} stage=close\n`);
      await supplyUi.browser.close();
      supplyUi = undefined;
    } catch {
      errors.push('SUPPLY_BROWSER_CLEANUP_FAILED');
    }
  }
  for (const server of [httpServer, tdsOneSink, tdsTwoSink]) {
    try {
      await closeServer(server);
    } catch {
      errors.push('LOCAL_SOURCE_SERVER_CLEANUP_FAILED');
    }
  }
  if (errors.length > 0) {
    process.stdout.write(`TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:${errors.join('_')}\n`);
    throw new Error(`TERMINAL_AUTOMATION_UPDATE_CLEANUP_${errors.join('_')}`);
  }
  process.stdout.write('TERMINAL_AUTOMATION_DEVICE_CLEANUP_COMPLETE\n');
}, 90_000);

it.skipIf(
  updateCase !== 'update.full-hot' &&
    updateCase !== 'update.offline-assets' &&
    updateCase !== 'update.boot-guard' &&
    updateCase !== 'update.install-result' &&
    updateCase !== 'update.interruption' &&
    updateCase !== 'update.compatibility' &&
    updateCase !== 'update.rollback' &&
    updateCase !== 'update.supply-chain',
)(
  'installs FULL then loads HOT on the same Android identity and verifies wallpaper images',
  async () => {
    if (
      !runId ||
      !runDirectory ||
      connection === undefined ||
      packageId === undefined ||
      (!isSupplyChainCase && targetDocument === undefined)
    ) {
      throw new Error('TERMINAL_AUTOMATION_UPDATE_ANDROID_NOT_READY');
    }
    const install = readArtifact('install.json');
    const full = readArtifact('full.json');
    const hot = readArtifact('hot.json');
    let initial = connection.driver.getSessions().find(value => value.appName === sample.appName);
    if (initial === undefined) throw new Error('TERMINAL_AUTOMATION_UPDATE_INITIAL_SESSION_MISSING');
    process.stdout.write(
      `TERMINAL_AUTOMATION_UPDATE_STAGE run=${runId} stage=application.session.ready session=${initial.sessionId}\n`,
    );
    const readActivationStatus = async (sessionId: string, stage: string): Promise<string> => {
      const value = await readSelector(
        connection!.driver,
        sessionId,
        'kernel.base.terminal-data-client.selectActivationState',
        [],
      );
      const instanceMode = await readSelector(
        connection!.driver,
        sessionId,
        'kernel.base.runtime.selectRuntimeInstanceMode',
        [],
      );
      if (!isRecord(value) || typeof value.status !== 'string')
        throw new Error('TERMINAL_AUTOMATION_TDC_ACTIVATION_SELECTOR_INVALID');
      if (instanceMode !== 'MASTER' && instanceMode !== 'SLAVE')
        throw new Error('TERMINAL_AUTOMATION_RUNTIME_INSTANCE_MODE_SELECTOR_INVALID');
      process.stdout.write(
        `TERMINAL_AUTOMATION_TDC_ACTIVATION run=${runId} stage=${stage} status=${value.status} instanceMode=${instanceMode}\n`,
      );
      return value.status;
    };
    const initialActivationStatus =
      updateCase === 'update.rollback' ? await readActivationStatus(initial.sessionId, 'initial') : undefined;
    let androidUi = createAndroidJourneyUiPort({
      connection,
      sessionId: initial.sessionId,
      onStep: step => process.stdout.write(`TERMINAL_AUTOMATION_DRIVER_STEP run=${runId} step=${step}\n`),
    });
    let systemUi = androidUi;
    const info = responseResult(await connection.driver.request(initial.sessionId, 'runtime.info', null));
    if (!info || typeof info !== 'object' || !('descriptors' in info) || !Array.isArray(info.descriptors)) {
      throw new Error('TERMINAL_AUTOMATION_UPDATE_RUNTIME_INFO_INVALID');
    }
    const descriptor = info.descriptors.find(
      (value: unknown) =>
        typeof value === 'object' &&
        value !== null &&
        'moduleName' in value &&
        value.moduleName === 'kernel.base.terminal-update',
    );
    const terminalDataClientDescriptor = info.descriptors.find(
      (value: unknown) =>
        typeof value === 'object' &&
        value !== null &&
        'moduleName' in value &&
        value.moduleName === 'kernel.base.terminal-data-client',
    );
    if (
      !descriptor ||
      typeof descriptor !== 'object' ||
      !('commandNames' in descriptor) ||
      !Array.isArray(descriptor.commandNames)
    ) {
      throw new Error('TERMINAL_AUTOMATION_UPDATE_OWNER_MISSING');
    }
    if (
      !terminalDataClientDescriptor ||
      typeof terminalDataClientDescriptor !== 'object' ||
      !('commandNames' in terminalDataClientDescriptor) ||
      !Array.isArray(terminalDataClientDescriptor.commandNames)
    ) {
      throw new Error('TERMINAL_AUTOMATION_TERMINAL_DATA_CLIENT_OWNER_MISSING');
    }
    const commandName = descriptor.commandNames.find(
      (value: unknown) => typeof value === 'string' && value.endsWith('.accept-target'),
    );
    if (typeof commandName !== 'string') throw new Error('TERMINAL_AUTOMATION_UPDATE_COMMAND_MISSING');
    let assertCompatibilityDataReadback: ((sessionId: string, stage: string) => Promise<void>) | undefined;
    const dispatchUpdateCommand = async (name: string, payload: unknown, sessionId = initial!.sessionId) => {
      const requestId = `req_${Date.now().toString(36)}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
      const commandCompletion = waitForCommandResult(connection!.driver, sessionId, requestId, 360_000);
      void commandCompletion.promise.catch(() => undefined);
      try {
        const accepted = responseResult(
          await connection!.driver.request(sessionId, 'command.dispatch', {
            commandName: name,
            payload,
            requestId,
          }),
        );
        if (!isRecord(accepted) || accepted.requestId !== requestId || accepted.accepted !== true) {
          commandCompletion.cancel();
          throw new Error('TERMINAL_AUTOMATION_UPDATE_COMMAND_NOT_ACCEPTED');
        }
        const completion = await commandCompletion.promise;
        const result = isRecord(completion.result) ? completion.result : undefined;
        const actorResults = result && Array.isArray(result.actorResults) ? result.actorResults : [];
        const actorSummary = actorResults
          .map(actor => {
            if (!isRecord(actor)) return 'invalid-record';
            const error = isRecord(actor.error) ? actor.error : undefined;
            return `${typeof actor.actorKey === 'string' ? actor.actorKey : 'unknown'}:${typeof actor.status === 'string' ? actor.status : 'unknown'}:${typeof error?.code === 'string' ? error.code : 'no-error'}:${'result' in actor ? 'has-result' : 'no-result'}`;
          })
          .join(',');
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_COMMAND_RESULT run=${runId} request=${requestId} command=${name} status=${typeof result?.status === 'string' ? result.status : 'invalid'} actorCount=${actorResults.length} actors=${actorSummary || 'none'}\n`,
        );
        if (
          !result ||
          result.status !== 'completed' ||
          !Array.isArray(result.actorResults) ||
          !isRecord(result.actorResults[0]) ||
          !('result' in result.actorResults[0])
        )
          throw new Error('TERMINAL_AUTOMATION_UPDATE_COMMAND_RESULT_INVALID');
        return Object.freeze({requestId, result: result.actorResults[0].result});
      } catch (error) {
        commandCompletion.cancel();
        throw error;
      }
    };
    const dispatchUpdateCommandAcrossRuntimeReload = async (name: string, payload: unknown): Promise<string> => {
      const requestId = `req_${Date.now().toString(36)}_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
      const accepted = responseResult(
        await connection!.driver.request(initial!.sessionId, 'command.dispatch', {
          commandName: name,
          payload,
          requestId,
        }),
      );
      if (!isRecord(accepted) || accepted.requestId !== requestId || accepted.accepted !== true) {
        throw new Error('TERMINAL_AUTOMATION_UPDATE_COMMAND_NOT_ACCEPTED');
      }
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_COMMAND_ACCEPTED run=${runId} request=${requestId} observation=successor-runtime\n`,
      );
      return requestId;
    };
    if (updateCase === 'update.compatibility') {
      if (
        compatibilityTargetDocument === undefined ||
        targetDocument === undefined ||
        targetDocument.target.full !== null ||
        targetDocument.target.hot.artifact.bundleVersion !== '1.0.5'
      ) {
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_INITIAL_TARGET_INVALID');
      }
      const hotFiveRequestId = await dispatchUpdateCommandAcrossRuntimeReload(commandName, {
        selectionContext: targetDocument.target.selectionContext,
      });
      const hotFiveSession = await waitForAutomationSession(
        connection.driver,
        value => value.appName === sample.appName && value.sessionId !== initial!.sessionId,
        180_000,
      );
      const hotFiveActual = await readSelector(
        connection.driver,
        hotFiveSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      expect(hotFiveActual).toMatchObject({
        applicationId: packageId,
        nativeBuildNumber: install.nativeBuildNumber,
        bundleVersion: '1.0.5',
        publicationId: targetDocument.target.hot.artifact.publicationId,
        entryKind: 'hot',
      });
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_STAGE run=${runId} request=${hotFiveRequestId} stage=hot-five nativeBuild=${install.nativeBuildNumber} bundle=1.0.5 observation=successor-runtime-selector\n`,
      );

      const layerId = `update-compat-${runId.slice(0, 24)}`;
      const layerMarker = `compatibility-${runId}`;
      const wallpaper = selectedSample === 'wallpaper';
      if (wallpaper) {
        const qualification = await readSelector(
          connection.driver,
          hotFiveSession.sessionId,
          'kernel.feature.sample-staff-session.selectHostStaffQualification',
          [],
        );
        let wallpaperSessionId = hotFiveSession.sessionId;
        if (!isRecord(qualification) || qualification.status !== 'authenticated') {
          const loginPort = await loginSampleStaff(createStaffLoginPort(connection, hotFiveSession), {
            operatorName: 'A001',
            passcode: '1111',
            expectedScreen: 'sample.wallpaper.picker',
          });
          wallpaperSessionId = loginPort.sessionId;
        }
        const selected = await dispatchUpdateCommand(
          'kernel.feature.sample-wallpaper.select-wallpaper',
          {wallpaperId: 'w2'},
          wallpaperSessionId,
        );
        expect(selected.result).toBeNull();
        const confirmed = await dispatchUpdateCommand(
          'kernel.feature.sample-wallpaper.confirm-wallpaper',
          {},
          wallpaperSessionId,
        );
        expect(confirmed.result).toBeNull();
      } else {
        const written = await dispatchUpdateCommand(
          'kernel.base.ui-state.open-layer',
          Object.freeze({
            displayMode: 'PRIMARY',
            layerId,
            partKey: 'sample.desk.waiting-confirm',
            persistence: 'durable',
            props: Object.freeze({compatibilityMarker: layerMarker}),
          }),
          hotFiveSession.sessionId,
        );
        expect(written.result).toMatchObject({changed: true, persistenceStatus: 'succeeded'});
      }
      assertCompatibilityDataReadback = async (sessionId: string, stage: string): Promise<void> => {
        if (wallpaper) {
          const wallpaperId = await readSelector(
            connection!.driver,
            sessionId,
            'kernel.feature.sample-wallpaper.selectWallpaperId',
            [],
          );
          expect(wallpaperId).toBe('w2');
          process.stdout.write(
            `TERMINAL_AUTOMATION_COMPATIBILITY_DATA run=${runId} stage=${stage} owner=sample-wallpaper selection=w2\n`,
          );
          return;
        }
        const layers = await readSelector(connection!.driver, sessionId, 'kernel.base.ui-state.selectLayers', [
          'PRIMARY',
        ]);
        const matching = Array.isArray(layers)
          ? layers.find(value => isRecord(value) && value.layerId === layerId)
          : undefined;
        if (!isRecord(matching) || !isRecord(matching.props) || matching.props.compatibilityMarker !== layerMarker)
          throw new Error(`TERMINAL_AUTOMATION_COMPATIBILITY_DATA_NOT_READ_${stage.toUpperCase()}`);
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_DATA run=${runId} stage=${stage} owner=ui-state layer=present\n`,
        );
      };
      await assertCompatibilityDataReadback(hotFiveSession.sessionId, 'hot-five-write');

      // The new runtime acknowledges generic primary readiness before its base
      // owner finishes boot confirmation. Do not simulate a later stable-process
      // restart until the owner selector proves this HOT action is succeeded;
      // restarting an unconfirmed candidate must correctly roll back to embedded.
      let confirmedHotFiveTask: unknown;
      try {
        confirmedHotFiveTask = await waitForSelector(
          connection.driver,
          hotFiveSession.sessionId,
          'kernel.base.terminal-update.selectTerminalUpdateTask',
          [],
          value =>
            isRecord(value) &&
            value.target !== null &&
            typeof value.target === 'object' &&
            'ruleRef' in value.target &&
            value.target.ruleRef === `automation-${runId}` &&
            value.phase === 'succeeded',
          30_000,
        );
      } catch (error) {
        await writeUpdateStateDiagnostics(connection.driver, hotFiveSession.sessionId, runId);
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
        throw error;
      }
      if (confirmedHotFiveTask === null) {
        await writeUpdateStateDiagnostics(connection.driver, hotFiveSession.sessionId, runId);
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_HOT_FIVE_CONFIRMATION_TIMEOUT');
      }
      expect(confirmedHotFiveTask).toMatchObject({target: {ruleRef: `automation-${runId}`}, phase: 'succeeded'});
      const confirmedHotFiveStatus = await readSelector(
        connection.driver,
        hotFiveSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateRecentStatus',
        [],
      );
      expect(confirmedHotFiveStatus).toMatchObject({state: 'succeeded'});
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_TASK run=${runId} stage=hot-five state=succeeded observation=owner-selector\n`,
      );

      // A fresh app Runtime creates a new boot token; startup reconciliation must
      // release only the completed prior task while durable UI state remains.
      await connection.forceStop(packageId);
      await connection.launch(`${packageId}/${sample.applicationId}.MainActivity`);
      const restartedSession = await waitForAutomationSession(
        connection.driver,
        value => value.appName === sample.appName && value.sessionId !== hotFiveSession.sessionId,
        90_000,
      );
      initial = restartedSession;
      androidUi = createAndroidJourneyUiPort({
        connection,
        sessionId: restartedSession.sessionId,
        onStep: step => process.stdout.write(`TERMINAL_AUTOMATION_DRIVER_STEP run=${runId} step=${step}\n`),
      });
      systemUi = androidUi;
      await assertCompatibilityDataReadback(restartedSession.sessionId, 'same-js-five-process-restart');
      const restartedActual = await readSelector(
        connection.driver,
        restartedSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      expect(restartedActual).toMatchObject({bundleVersion: '1.0.5', entryKind: 'hot'});
      const releasedTask = await waitForSelector(
        connection.driver,
        restartedSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateTask',
        [],
        value => value === null,
        20_000,
      );
      expect(releasedTask).toBeNull();
      resetHotSourceGate(true);
      targetDocument = compatibilityTargetDocument;
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_TASK run=${runId} stage=after-new-runtime state=released\n`,
      );
    }
    let targetSelectionContext: UpdateTarget['selectionContext'] | undefined = targetDocument?.target.selectionContext;
    if (isSupplyChainCase) {
      if (!supplyUi || !supplyStoreRef) throw new Error('TERMINAL_AUTOMATION_SUPPLY_UI_NOT_READY');
      const ruleSnapshotSelector = 'kernel.base.terminal-update.selectTerminalUpdateRuleSnapshot';
      process.stdout.write(
        `TERMINAL_AUTOMATION_SUPPLY run=${runId} stage=rule.snapshot.wait.begin selector=${ruleSnapshotSelector} timeoutMs=90000 session=${initial.sessionId}\n`,
      );
      let ruleSnapshot: unknown;
      try {
        ruleSnapshot = await waitForSelector(
          connection.driver,
          initial.sessionId,
          ruleSnapshotSelector,
          [supplyUi.ruleRef],
          value =>
            isRecord(value) &&
            value.status === 'ready' &&
            value.filterRuleRef === supplyUi!.ruleRef &&
            typeof value.contextIdentity === 'string' &&
            typeof value.selectedSpace === 'string' &&
            value.selectedSpace.length > 0 &&
            Array.isArray(value.items) &&
            value.items.some(item => isRecord(item) && item.ruleRef === supplyUi!.ruleRef),
          90_000,
        );
      } catch (error) {
        const [currentSnapshot, connectionState, activationState, loadReadiness, organizationPath] = await Promise.all([
          readSelector(connection.driver, initial.sessionId, ruleSnapshotSelector, [supplyUi.ruleRef]).catch(
            () => null,
          ),
          readSelector(
            connection.driver,
            initial.sessionId,
            'kernel.base.terminal-data-client.selectConnectionState',
            [],
          ).catch(() => null),
          readSelector(
            connection.driver,
            initial.sessionId,
            'kernel.base.terminal-data-client.selectActivationState',
            [],
          ).catch(() => null),
          readSelector(
            connection.driver,
            initial.sessionId,
            'kernel.feature.store-basic.selectStoreBasicLoadReadiness',
            [],
          ).catch(() => null),
          readSelector(
            connection.driver,
            initial.sessionId,
            'kernel.feature.store-basic.selectStoreOrganizationPath',
            [],
          ).catch(() => null),
        ]);
        const readinessBindingMatchesActivation =
          isRecord(loadReadiness) &&
          isRecord(loadReadiness.binding) &&
          isRecord(activationState) &&
          loadReadiness.binding.terminalRef === activationState.terminalRef &&
          loadReadiness.binding.bindingGeneration === activationState.bindingGeneration &&
          loadReadiness.binding.storeRef === activationState.storeRef &&
          loadReadiness.binding.groupWorkspaceKey === activationState.groupWorkspaceKey;
        const projectRefMatchesPath =
          isRecord(loadReadiness) &&
          isRecord(organizationPath) &&
          loadReadiness.projectRef === organizationPath.projectRef;
        const matchingRule =
          isRecord(currentSnapshot) && Array.isArray(currentSnapshot.items)
            ? currentSnapshot.items.some(item => isRecord(item) && item.ruleRef === supplyUi!.ruleRef)
            : false;
        const failureCode =
          error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+$/u.test(error.message)
            ? error.message
            : 'SELECTOR_WAIT_FAILED';
        process.stdout.write(
          `TERMINAL_AUTOMATION_SUPPLY run=${runId} stage=rule.snapshot.wait.failed code=${failureCode} snapshotStatus=${isRecord(currentSnapshot) ? String(currentSnapshot.status) : 'unavailable'} snapshotError=${isRecord(currentSnapshot) && typeof currentSnapshot.errorCode === 'string' ? currentSnapshot.errorCode : 'none'} snapshotSpacePresent=${isRecord(currentSnapshot) && typeof currentSnapshot.selectedSpace === 'string'} snapshotSpaceMatchesActivation=${isRecord(currentSnapshot) && isRecord(activationState) && currentSnapshot.selectedSpace === activationState.groupWorkspaceKey} snapshotItems=${isRecord(currentSnapshot) && Array.isArray(currentSnapshot.items) ? currentSnapshot.items.length : -1} targetRulePresent=${matchingRule} connection=${isRecord(connectionState) && typeof connectionState.status === 'string' ? connectionState.status : 'unavailable'} activation=${isRecord(activationState) && typeof activationState.status === 'string' ? activationState.status : 'unavailable'} activationWorkspacePresent=${isRecord(activationState) && typeof activationState.groupWorkspaceKey === 'string'} activationWorkspaceMatchesManaged=${isRecord(activationState) && activationState.groupWorkspaceKey === 'aurora'} storeLoad=${isRecord(loadReadiness) && typeof loadReadiness.storeStatus === 'string' ? loadReadiness.storeStatus : 'unavailable'} projectLoad=${isRecord(loadReadiness) && typeof loadReadiness.projectStatus === 'string' ? loadReadiness.projectStatus : 'unavailable'} runtimeIdPresent=${isRecord(loadReadiness) && typeof loadReadiness.runtimeId === 'string'} bindingPresent=${isRecord(loadReadiness) && isRecord(loadReadiness.binding)} readinessBindingMatchesActivation=${readinessBindingMatchesActivation} organizationPathPresent=${isRecord(organizationPath)} projectRefMatchesPath=${projectRefMatchesPath}\n`,
        );
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
        throw new Error(`TERMINAL_AUTOMATION_SUPPLY_RULE_SNAPSHOT_WAIT_FAILED:${failureCode}`);
      }
      if (
        !isRecord(ruleSnapshot) ||
        typeof ruleSnapshot.contextIdentity !== 'string' ||
        typeof ruleSnapshot.selectedSpace !== 'string' ||
        ruleSnapshot.selectedSpace.length === 0 ||
        !Array.isArray(ruleSnapshot.items)
      )
        throw new Error('TERMINAL_AUTOMATION_SUPPLY_RULE_SNAPSHOT_INVALID');
      const rule = ruleSnapshot.items.find(item => isRecord(item) && item.ruleRef === supplyUi!.ruleRef);
      if (
        !isRecord(rule) ||
        rule.applicationId !== packageId ||
        !isRecord(rule.full) ||
        rule.full.artifactRef !== supplyUi.full.artifactRef ||
        !isRecord(rule.hot) ||
        rule.hot.artifactRef !== supplyUi.hot.artifactRef ||
        rule.targetMode !== 'STORE_REFS' ||
        !Array.isArray(rule.storeRefs) ||
        !rule.storeRefs.includes(supplyStoreRef)
      )
        throw new Error('TERMINAL_AUTOMATION_SUPPLY_RULE_SNAPSHOT_IDENTITY_MISMATCH');
      targetSelectionContext = Object.freeze({
        selectedSpace: ruleSnapshot.selectedSpace,
        contextIdentity: ruleSnapshot.contextIdentity,
        ruleRef: supplyUi.ruleRef,
      });
      process.stdout.write(
        `TERMINAL_AUTOMATION_SUPPLY_SNAPSHOT run=${runId} rule=${supplyUi.ruleRef} artifacts=matched store=matched state=ready\n`,
      );
    }
    if (targetSelectionContext === undefined) throw new Error('TERMINAL_AUTOMATION_UPDATE_SELECTION_CONTEXT_MISSING');
    const acceptedTarget = await dispatchUpdateCommand(commandName, {selectionContext: targetSelectionContext});
    const requestId = acceptedTarget.requestId;
    const updateOutcome = acceptedTarget.result;
    if (isRecord(updateOutcome) && (updateOutcome.status === 'failed' || updateOutcome.status === 'unknown')) {
      try {
        const diagnostics = await connection.readTerminalUpdateLogs(packageId);
        process.stdout.write(
          diagnostics.length === 0
            ? `TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG_NOT_AVAILABLE run=${runId}\n`
            : diagnostics
                .split('\n')
                .map(line => `TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG run=${runId} ${line}`)
                .join('\n') + '\n',
        );
      } catch (error) {
        const code =
          error instanceof Error && /^TERMINAL_AUTOMATION_[A-Z0-9_]+$/u.test(error.message)
            ? error.message
            : 'TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG_READ_FAILED';
        process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_NATIVE_LOG_NOT_AVAILABLE run=${runId} code=${code}\n`);
      }
    }
    expect(updateOutcome).toMatchObject({status: 'unknown', reason: 'INSTALLER_AWAITING_READBACK'});
    process.stdout.write(
      `TERMINAL_AUTOMATION_UPDATE_TARGET_ACCEPTED run=${runId} request=${requestId} state=INSTALLER_AWAITING_READBACK\n`,
    );

    const fullSessionMatches = (value: Readonly<{readonly appName: string; readonly sessionId: string}>): boolean =>
      value.appName === sample.appName && value.sessionId !== initial!.sessionId;
    let fullSession: Awaited<ReturnType<typeof waitForAutomationSession>> | undefined;
    let fullSessionId: string | undefined;
    let installerOpenedApp = false;
    let installButton: Awaited<ReturnType<AndroidAutomationConnection['systemUi']['waitForButton']>> | undefined;
    try {
      installButton = await systemUi.waitForSystemButton({
        labels: ['Install', 'Update', 'Settings', 'Allow from this source'],
        timeoutMs: 20_000,
        allowedPackagePrefixes: installSourcePackagePrefixes,
        expectedContext: {label: 'Allow from this source', text: appName},
      });
    } catch (error) {
      if (runDirectory) {
        const screenshotPath = path.join(runDirectory, 'installer-user-action-not-visible.png');
        writeFileSync(screenshotPath, await connection.capture('primary'), {mode: 0o600});
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALLER_FAILURE_SCREEN run=${runId} screenshot=${screenshotPath}\n`,
        );
      }
      await writeNativeUpdateDiagnostics({connection, packageId, runId});
      throw error;
    }
    if (installButton.label === 'Settings') {
      process.stdout.write(
        `TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} package=${installButton.packageName ?? 'UNKNOWN'} action=open\n`,
      );
      await androidUi.clickSystemButton({
        labels: ['Settings'],
        timeoutMs: 20_000,
        allowedPackagePrefixes: settingsPackagePrefixes,
      });
      installButton = await systemUi.waitForSystemButton({
        labels: ['Allow from this source'],
        timeoutMs: 20_000,
        allowedPackagePrefixes: settingsPackagePrefixes,
        expectedContext: {label: 'Allow from this source', text: appName},
      });
    }
    if (installButton.label === 'Allow from this source') {
      if (installButton.checked === undefined) {
        throw new Error('TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTING_STATE_UNKNOWN');
      }
      const permissionNeedsEnable = !installButton.checked;
      if (permissionNeedsEnable) {
        process.stdout.write(
          [
            `TERMINAL_AUTOMATION_INSTALLER_SOURCE_CONTROL run=${runId}`,
            `labelClass=${installButton.labelClass}`,
            `targetClass=${installButton.targetClass}`,
            `ancestorDistance=${installButton.ancestorDistance}`,
            `targetEnabled=${installButton.targetEnabled ? 1 : 0}`,
            `targetClickable=${installButton.targetClickable ? 1 : 0}`,
            `stateSource=${installButton.stateSource}`,
            `bounds=${installButton.bounds.left},${installButton.bounds.top},${installButton.bounds.right},${installButton.bounds.bottom}`,
          ].join(' ') + '\n',
        );
        process.stdout.write(`TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} state=enable\n`);
        const changed = await systemUi.setSystemChecked({
          labels: ['Allow from this source'],
          checked: true,
          timeoutMs: 20_000,
          allowedPackagePrefixes: settingsPackagePrefixes,
          expectedContext: {label: 'Allow from this source', text: appName},
        });
        if (changed.checked !== true) throw new Error('TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTING_READBACK_FAILED');
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} action=setting-toggled readback=enabled\n`,
        );
      } else {
        process.stdout.write(`TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} state=already-enabled\n`);
      }
      // Return to the installer through Android's task stack. Starting the app's
      // main activity here can cover the pending system confirmation screen.
      await systemUi.pressSystemBack();
      process.stdout.write(
        `TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} action=returned-from-settings\n`,
      );
      const immersiveNoticeAcknowledged = await systemUi.acknowledgeImmersiveModeEducation();
      process.stdout.write(
        `TERMINAL_AUTOMATION_IMMERSIVE_NOTICE run=${runId} acknowledged=${immersiveNoticeAcknowledged ? 1 : 0}\n`,
      );
      try {
        installButton = await systemUi.waitForSystemButton({
          labels: ['Install', 'Update'],
          timeoutMs: 20_000,
          allowedPackagePrefixes: installerPackagePrefixes,
        });
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALLER_SOURCE_SETTINGS run=${runId} state=installer-confirmation-visible\n`,
        );
      } catch {
        const screenshotPath = runDirectory ? path.join(runDirectory, 'installer-return-unresolved.png') : undefined;
        const screen = await systemUi.readSystemScreenSummary().catch(() => 'UNAVAILABLE');
        process.stdout.write(`TERMINAL_AUTOMATION_INSTALLER_RETURN_UNRESOLVED_STATE run=${runId} screen=${screen}\n`);
        if (screenshotPath) {
          writeFileSync(screenshotPath, await connection.capture('primary'), {mode: 0o600});
          process.stdout.write(
            `TERMINAL_AUTOMATION_INSTALLER_RETURN_UNRESOLVED run=${runId} screenshot=${screenshotPath}\n`,
          );
        }
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
        throw new Error('TERMINAL_AUTOMATION_INSTALLER_CONFIRMATION_NOT_RETURNED');
      }

      const continuationAbort = new AbortController();
      const continuationButton = systemUi
        .waitForSystemButton({
          labels: ['Install', 'Update'],
          timeoutMs: 20_000,
          signal: continuationAbort.signal,
          allowedPackagePrefixes: installerPackagePrefixes,
        })
        .then(
          button => ({kind: 'button' as const, button}),
          error => ({kind: 'button-error' as const, error}),
        );
      const continuationSession = waitForAutomationSession(
        connection.driver,
        fullSessionMatches,
        60_000,
        continuationAbort.signal,
      ).then(
        session => ({kind: 'session' as const, session}),
        error => ({kind: 'session-error' as const, error}),
      );
      try {
        const continuation = await Promise.race([continuationButton, continuationSession]);
        if (continuation.kind === 'button') {
          installButton = continuation.button;
          process.stdout.write(`TERMINAL_AUTOMATION_INSTALLER_CONTINUATION run=${runId} source=system-confirmation\n`);
        } else if (continuation.kind === 'session') {
          fullSession = continuation.session;
          const installFacts = await writeNativeUpdateDiagnostics({connection, packageId, runId});
          if (!installFacts.installerSucceeded || !installFacts.changedApkBooted) {
            throw new Error('TERMINAL_AUTOMATION_INSTALLER_SESSION_WITHOUT_SUCCESS_READBACK');
          }
          installerOpenedApp = true;
          process.stdout.write(
            `TERMINAL_AUTOMATION_INSTALLER_CONTINUATION run=${runId} source=installed-session-and-native-readback\n`,
          );
        } else {
          const remaining = continuation.kind === 'button-error' ? await continuationSession : await continuationButton;
          if (remaining.kind === 'session') {
            fullSession = remaining.session;
            const installFacts = await writeNativeUpdateDiagnostics({connection, packageId, runId});
            if (!installFacts.installerSucceeded || !installFacts.changedApkBooted) {
              throw new Error('TERMINAL_AUTOMATION_INSTALLER_SESSION_WITHOUT_SUCCESS_READBACK');
            }
            installerOpenedApp = true;
            process.stdout.write(
              `TERMINAL_AUTOMATION_INSTALLER_CONTINUATION run=${runId} source=installed-session-and-native-readback\n`,
            );
          } else if (remaining.kind === 'button') {
            installButton = remaining.button;
            process.stdout.write(
              `TERMINAL_AUTOMATION_INSTALLER_CONTINUATION run=${runId} source=system-confirmation\n`,
            );
          } else {
            throw continuation.kind === 'button-error' ? continuation.error : remaining.error;
          }
        }
      } finally {
        continuationAbort.abort();
      }
    }
    if (updateCase === 'update.install-result' || updateCase === 'update.interruption') {
      if (
        installButton === undefined ||
        !installerPackagePrefixes.some(prefix => installButton?.packageName?.startsWith(prefix))
      ) {
        throw new Error('TERMINAL_AUTOMATION_INSTALL_RESULT_INSTALLER_SCREEN_NOT_OWNED');
      }
      const pendingTask = await readSelector(
        connection.driver,
        initial.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateTask',
        [],
      );
      if (!isRecord(pendingTask) || typeof pendingTask.actionId !== 'string')
        throw new Error('TERMINAL_AUTOMATION_INSTALL_RESULT_ACTION_NOT_PERSISTED');
      if (updateCase === 'update.interruption') {
        const priorNativeLog = await connection.readTerminalUpdateLogs(packageId);
        const commitCount = (value: string): number =>
          value.split('\n').filter(line => line.includes('event=installer-commit ')).length;
        const commitsBeforeInterruption = commitCount(priorNativeLog);
        if (commitsBeforeInterruption !== 1)
          throw new Error('TERMINAL_AUTOMATION_INTERRUPTION_EXPECTED_SINGLE_INSTALLER_COMMIT');
        const interruptedSessionId = initial.sessionId;
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_INTERRUPTION run=${runId} stage=installer-pending actionId=${pendingTask.actionId} action=force-stop-owned-app\n`,
        );
        await connection.forceStop(packageId);
        await connection.launch(`${packageId}/${sample.applicationId}.MainActivity`);
        const resumedSession = await waitForAutomationSession(
          connection.driver,
          value => value.appName === sample.appName && value.sessionId !== interruptedSessionId,
          90_000,
        );
        initial = resumedSession;
        androidUi = createAndroidJourneyUiPort({
          connection,
          sessionId: resumedSession.sessionId,
          onStep: step => process.stdout.write(`TERMINAL_AUTOMATION_DRIVER_STEP run=${runId} step=${step}\n`),
        });
        systemUi = androidUi;
        const resumedTask = await readSelector(
          connection.driver,
          resumedSession.sessionId,
          'kernel.base.terminal-update.selectTerminalUpdateTask',
          [],
        );
        expect(resumedTask).toMatchObject({
          taskId: pendingTask.taskId,
          actionId: pendingTask.actionId,
          target: pendingTask.target,
          phase: 'applying-full',
        });
        // readTerminalUpdateLogs is scoped to the current process PID. After force-stop
        // the resumed process has a new PID, so its log must contain zero new commits;
        // comparing it with the previous process's cumulative count is invalid.
        const resumedNativeLog = await connection.readTerminalUpdateLogs(packageId);
        const commitsAfterResume = commitCount(resumedNativeLog);
        expect(commitsAfterResume).toBe(0);
        installButton = await systemUi.waitForSystemButton({
          labels: ['Install', 'Update'],
          timeoutMs: 20_000,
          allowedPackagePrefixes: installerPackagePrefixes,
        });
        if (!installerPackagePrefixes.some(prefix => installButton?.packageName?.startsWith(prefix)))
          throw new Error('TERMINAL_AUTOMATION_INTERRUPTION_INSTALLER_SCREEN_NOT_OWNED');
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_INTERRUPTION run=${runId} stage=resumed sameTask=1 sameAction=1 sameTarget=1 newProcessInstallerCommits=${commitsAfterResume}\n`,
        );
      }
      if (updateCase === 'update.install-result') {
        if (targetDocument === undefined) throw new Error('TERMINAL_AUTOMATION_INSTALL_RESULT_TARGET_MISSING');
        let cancelButton;
        try {
          cancelButton = await systemUi.waitForSystemButton({
            labels: ['Cancel'],
            timeoutMs: 20_000,
            allowedPackagePrefixes: installerPackagePrefixes,
          });
        } catch (error) {
          const screen = await systemUi.readSystemScreenSummary().catch(() => 'UNAVAILABLE');
          await writeNativeUpdateDiagnostics({connection, packageId, runId});
          process.stdout.write(
            `TERMINAL_AUTOMATION_INSTALL_RESULT_CANCEL_NOT_AVAILABLE run=${runId} screen=${screen}\n`,
          );
          throw error;
        }
        if (!installerPackagePrefixes.some(prefix => cancelButton.packageName?.startsWith(prefix))) {
          throw new Error('TERMINAL_AUTOMATION_INSTALL_RESULT_CANCEL_NOT_OWNED');
        }
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALL_RESULT_CANCEL run=${runId} actionId=${pendingTask.actionId} method=installer-cancel package=${cancelButton.packageName ?? 'UNKNOWN'}\n`,
        );
        await androidUi.clickSystemButton({
          labels: ['Cancel'],
          timeoutMs: 20_000,
          allowedPackagePrefixes: installerPackagePrefixes,
        });
        const cancelScreen = await systemUi.readSystemScreenSummary().catch(() => 'UNAVAILABLE');
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALL_RESULT_CANCEL_READBACK run=${runId} screen=${cancelScreen} observation=native-action-before-reaccept\n`,
        );
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
        const reaccepted = await dispatchUpdateCommand(commandName, {
          selectionContext: targetDocument.target.selectionContext,
        });
        if (
          !isRecord(reaccepted.result) ||
          reaccepted.result.status !== 'unknown' ||
          reaccepted.result.reason !== 'INSTALLER_AWAITING_READBACK'
        ) {
          const observedTask = await readSelector(
            connection.driver,
            initial.sessionId,
            'kernel.base.terminal-update.selectTerminalUpdateTask',
            [],
          );
          process.stdout.write(
            `TERMINAL_AUTOMATION_INSTALL_RESULT_REACCEPT_READBACK run=${runId} result=${isRecord(reaccepted.result) ? String(reaccepted.result.status) : 'INVALID'} task=${isRecord(observedTask) && typeof observedTask.phase === 'string' ? observedTask.phase : 'UNKNOWN'} actionMatches=${isRecord(observedTask) && observedTask.actionId === pendingTask.actionId ? 1 : 0}\n`,
          );
          await writeNativeUpdateDiagnostics({connection, packageId, runId});
        }
        expect(reaccepted.result).toMatchObject({status: 'unknown', reason: 'INSTALLER_AWAITING_READBACK'});
        const retriedTask = await readSelector(
          connection.driver,
          initial.sessionId,
          'kernel.base.terminal-update.selectTerminalUpdateTask',
          [],
        );
        if (!isRecord(retriedTask) || typeof retriedTask.actionId !== 'string')
          throw new Error('TERMINAL_AUTOMATION_INSTALL_RESULT_REINVITED_ACTION_NOT_PERSISTED');
        expect(retriedTask.taskId).toBe(pendingTask.taskId);
        expect(retriedTask.target).toEqual(pendingTask.target);
        expect(retriedTask.actionId).not.toBe(pendingTask.actionId);
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALL_RESULT_REINVITED run=${runId} request=${reaccepted.requestId} newAction=1\n`,
        );
        installButton = await systemUi.waitForSystemButton({
          labels: ['Install', 'Update'],
          timeoutMs: 20_000,
          allowedPackagePrefixes: installerPackagePrefixes,
        });
      }
    }
    if (installButton) {
      process.stdout.write(
        `TERMINAL_AUTOMATION_INSTALLER_BUTTON run=${runId} package=${installButton.packageName ?? 'UNKNOWN'} label=${installButton.label} action=install\n`,
      );
      await androidUi.clickSystemButton({
        labels: [installButton.label],
        timeoutMs: 20_000,
        allowedPackagePrefixes: installerPackagePrefixes,
      });
      const completionAbort = new AbortController();
      const completionButton = systemUi
        .waitForSystemButton({
          labels: ['Done', 'Open'],
          timeoutMs: 20_000,
          signal: completionAbort.signal,
          allowedPackagePrefixes: installerPackagePrefixes,
        })
        .then(
          button => ({kind: 'button' as const, button}),
          error => ({kind: 'button-error' as const, error}),
        );
      const completionSession = waitForAutomationSession(
        connection.driver,
        fullSessionMatches,
        60_000,
        completionAbort.signal,
      ).then(
        session => ({kind: 'session' as const, session}),
        error => ({kind: 'session-error' as const, error}),
      );
      let completion:
        | Awaited<typeof completionButton>
        | Awaited<typeof completionSession>
        | Readonly<{readonly kind: 'native-success'}>;
      try {
        completion = await Promise.race([completionButton, completionSession]);
        if (completion.kind === 'button-error') {
          const installFacts = await writeNativeUpdateDiagnostics({connection, packageId, runId});
          if (installFacts.installerSucceeded && installFacts.changedApkBooted) {
            completion = {kind: 'native-success'};
          } else {
            const sessionResult = await completionSession;
            if (sessionResult.kind === 'session-error') throw completion.error;
            completion = sessionResult;
          }
        } else if (completion.kind === 'session-error') {
          const installFacts = await writeNativeUpdateDiagnostics({connection, packageId, runId});
          if (installFacts.installerSucceeded && installFacts.changedApkBooted) {
            completion = {kind: 'native-success'};
          } else {
            const buttonResult = await completionButton;
            if (buttonResult.kind === 'button-error') throw buttonResult.error;
            completion = buttonResult;
          }
        }
      } catch (error) {
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
        throw error;
      } finally {
        completionAbort.abort();
      }
      if (completion.kind === 'session') {
        fullSession = completion.session;
        installerOpenedApp = true;
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALLER_COMPLETION run=${runId} source=fresh-session session=${fullSession.sessionId}\n`,
        );
      } else if (completion.kind === 'button') {
        const installCompletion = completion.button;
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALLER_BUTTON run=${runId} package=${installCompletion.packageName ?? 'UNKNOWN'} label=${installCompletion.label} action=complete\n`,
        );
        const clickedCompletion = await androidUi.clickSystemButton({
          labels: [installCompletion.label],
          timeoutMs: 20_000,
          allowedPackagePrefixes: installerPackagePrefixes,
        });
        installerOpenedApp = clickedCompletion.label === 'Open';
      } else if (completion.kind === 'native-success') {
        installerOpenedApp = true;
        process.stdout.write(
          `TERMINAL_AUTOMATION_INSTALLER_COMPLETION run=${runId} source=success-callback-and-changed-apk\n`,
        );
        await connection.launch(`${packageId}/${sample.applicationId}.MainActivity`);
        process.stdout.write(`TERMINAL_AUTOMATION_FULL_APP_LAUNCH run=${runId} action=start-after-installer-success\n`);
      } else {
        throw new Error('TERMINAL_AUTOMATION_INSTALL_COMPLETION_UNRESOLVED');
      }
    }
    if (!installerOpenedApp) {
      process.stdout.write(`TERMINAL_AUTOMATION_FULL_APP_LAUNCH run=${runId} action=start\n`);
      await connection.launch(`${packageId}/${sample.applicationId}.MainActivity`);
      process.stdout.write(`TERMINAL_AUTOMATION_FULL_APP_LAUNCH run=${runId} action=returned\n`);
    }
    if (fullSession === undefined) {
      try {
        fullSession = await waitForAutomationSession(connection.driver, fullSessionMatches, 120_000);
        fullSessionId = fullSession.sessionId;
        if (updateCase === 'update.rollback') await readActivationStatus(fullSession.sessionId, 'full');
      } catch (error) {
        const sessions = connection.driver.getSessions();
        process.stdout.write(
          [
            `TERMINAL_AUTOMATION_FULL_SESSION_TIMEOUT run=${runId}`,
            `sessionCount=${sessions.length}`,
            `sampleSessionCount=${sessions.filter(value => value.appName === sample.appName).length}`,
            `initialSessionPresent=${sessions.some(value => value.sessionId === initial!.sessionId) ? 1 : 0}`,
          ].join(' ') + '\n',
        );
        await writeAndroidFailureDiagnostics({
          connection,
          packageId,
          runId,
          boundary: 'full-session',
          expectedSessionId: fullSession?.sessionId,
        });
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
        throw error;
      }
    }
    let hotRequestTimeout: NodeJS.Timeout | undefined;
    try {
      if (!isSupplyChainCase) {
        if (hotSourceRequested === undefined || releaseHotSourceResponse === undefined) {
          throw new Error('TERMINAL_AUTOMATION_HOT_SOURCE_GATE_NOT_READY');
        }
        await Promise.race([
          hotSourceRequested,
          new Promise<never>((_, reject) => {
            hotRequestTimeout = setTimeout(
              () => reject(new Error('TERMINAL_AUTOMATION_HOT_SOURCE_REQUEST_NOT_OBSERVED')),
              120_000,
            );
          }),
        ]);
      }
      const currentFull = await readSelector(
        connection.driver,
        fullSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      expect(currentFull).toMatchObject({
        applicationId: packageId,
        nativeBuildNumber: full.nativeBuildNumber,
        entryKind: 'embedded',
        ...(updateCase === 'update.compatibility' ? {bundleVersion: '1.0.4'} : {}),
      });
      if (updateCase === 'update.compatibility') {
        if (assertCompatibilityDataReadback === undefined)
          throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_ORACLE_MISSING');
        await assertCompatibilityDataReadback(fullSession.sessionId, 'embedded-js-four');
      }
      // The supply-chain case deliberately releases HOT as soon as FULL is confirmed.
      // Its intermediate embedded session can be replaced before wallpaper login/assets
      // are observed; the final HOT session below remains the business oracle.
      if (selectedSample === 'wallpaper' && !isSupplyChainCase) {
        const fullQualification = await readSelector(
          connection.driver,
          fullSession.sessionId,
          'kernel.feature.sample-staff-session.selectHostStaffQualification',
          [],
        );
        if (!isRecord(fullQualification) || fullQualification.status !== 'authenticated') {
          const loginPort = await loginSampleStaff(createStaffLoginPort(connection, fullSession), {
            operatorName: 'A001',
            passcode: '1111',
            expectedScreen: 'sample.wallpaper.picker',
          });
          fullSessionId = loginPort.sessionId;
        }
        await waitForWallpaperAssets(connection.driver, fullSessionId ?? fullSession.sessionId, 'full');
      }
      await writeUpdateStateDiagnostics(connection.driver, fullSessionId ?? fullSession.sessionId, runId);
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_STAGE_READBACK run=${runId} stage=full entryKind=embedded nativeBuild=${full.nativeBuildNumber}\n`,
      );
    } catch (error) {
      process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_STAGE_FAILURE run=${runId} stage=hot-source-observation\n`);
      await writeUpdateStateDiagnostics(connection.driver, fullSessionId ?? fullSession.sessionId, runId);
      await writeAndroidFailureDiagnostics({
        connection,
        packageId,
        runId,
        boundary: 'full-session',
        expectedSessionId: fullSessionId ?? fullSession.sessionId,
      });
      await writeNativeUpdateDiagnostics({connection, packageId, runId});
      throw error;
    } finally {
      if (hotRequestTimeout !== undefined) clearTimeout(hotRequestTimeout);
      releaseHotSourceResponse?.();
    }

    let hotSession: Awaited<ReturnType<typeof waitForAutomationSession>>;
    try {
      hotSession = await waitForAutomationSession(
        connection.driver,
        value =>
          value.appName === sample.appName &&
          value.sessionId !== initial!.sessionId &&
          value.sessionId !== (fullSessionId ?? fullSession.sessionId),
        180_000,
      );
    } catch (error) {
      await writeAndroidFailureDiagnostics({connection, packageId, runId, boundary: 'hot-session'});
      await writeUpdateStateDiagnostics(connection.driver, fullSessionId ?? fullSession.sessionId, runId);
      await writeNativeUpdateDiagnostics({connection, packageId, runId});
      throw error;
    }
    const finalActual = await readSelector(
      connection.driver,
      hotSession.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
      [],
    );
    const hotActivationStatus =
      updateCase === 'update.rollback' ? await readActivationStatus(hotSession.sessionId, 'hot') : undefined;
    if (selectedSample === 'wallpaper' && updateCase !== 'update.boot-guard' && updateCase !== 'update.interruption') {
      await waitForWallpaperAssets(connection.driver, hotSession.sessionId, 'hot');
    }
    expect(finalActual).toMatchObject({
      applicationId: packageId,
      nativeBuildNumber: hot.nativeBuildNumber,
      bundleVersion: hot.bundleVersion,
      publicationId: hot.publicationId,
      entryKind: 'hot',
    });
    if (updateCase === 'update.compatibility') {
      expect(finalActual).toMatchObject({bundleVersion: '1.0.6'});
      if (assertCompatibilityDataReadback === undefined)
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_ORACLE_MISSING');
      await assertCompatibilityDataReadback(hotSession.sessionId, 'hot-six');
      const completedTask = await waitForSelector(
        connection.driver,
        hotSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateTask',
        [],
        value =>
          isRecord(value) &&
          value.target !== null &&
          typeof value.target === 'object' &&
          'ruleRef' in value.target &&
          value.target.ruleRef === `automation-${runId}` &&
          (value.phase === 'succeeded' || value.phase === 'failed' || value.phase === 'unknown'),
        30_000,
      );
      if (completedTask === null) {
        await writeUpdateStateDiagnostics(connection.driver, hotSession.sessionId, runId);
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_TASK_TERMINAL_STATE_TIMEOUT');
      }
      if (!isRecord(completedTask) || completedTask.phase !== 'succeeded') {
        await writeUpdateStateDiagnostics(connection.driver, hotSession.sessionId, runId);
        await writeNativeUpdateDiagnostics({connection, packageId, runId});
      }
      expect(completedTask).toMatchObject({target: {ruleRef: `automation-${runId}`}, phase: 'succeeded'});
      const completedStatus = await readSelector(
        connection.driver,
        hotSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateRecentStatus',
        [],
      );
      expect(completedStatus).toMatchObject({state: 'succeeded'});
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_TASK run=${runId} stage=hot-six state=succeeded\n`,
      );
      const externalFull = readArtifact('compatibility-external-full.json');
      if (externalFull.apk === undefined || externalFull.nativeBuildNumber <= hot.nativeBuildNumber)
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_EXTERNAL_APK_INVALID');
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_STAGE run=${runId} stage=external-apk-replace action=force-stop\n`,
      );
      await connection.forceStop(packageId);
      const extractedExternalFullApk = await extractCompatibilityFullApk({
        artifact: externalFull,
        packageManifestName: 'compatibility-external-full-package.json',
      });
      await connection.install(extractedExternalFullApk);
      if (!(await connection.isInstalled(packageId)))
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_EXTERNAL_APK_INSTALL_READBACK_FAILED');
      await connection.launch(`${packageId}/${sample.applicationId}.MainActivity`);
      const externalSession = await waitForAutomationSession(
        connection.driver,
        value => value.appName === sample.appName && value.sessionId !== hotSession.sessionId,
        90_000,
      );
      initial = externalSession;
      const externalActual = await readSelector(
        connection.driver,
        externalSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      expect(externalActual).toMatchObject({
        applicationId: packageId,
        nativeBuildNumber: externalFull.nativeBuildNumber,
        bundleVersion: externalFull.bundleVersion,
        publicationId: externalFull.publicationId,
        entryKind: 'embedded',
      });
      if (assertCompatibilityDataReadback === undefined)
        throw new Error('TERMINAL_AUTOMATION_COMPATIBILITY_ORACLE_MISSING');
      await assertCompatibilityDataReadback(externalSession.sessionId, 'external-apk-embedded');
      const externalBootLog = await connection.readTerminalUpdateLogs(packageId);
      expect(externalBootLog).toContain(
        'event=boot-reserved entryKind=embedded apkChanged=true resetReason=APK_CHANGED_SELECTION_RESET previousEligible=false candidateEligible=false',
      );
      expect(
        await waitForSelector(
          connection.driver,
          externalSession.sessionId,
          'kernel.base.terminal-update.selectTerminalUpdateTask',
          [],
          value => value === null,
          20_000,
        ),
      ).toBeNull();
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_COMPATIBILITY_STAGE run=${runId} stage=external-apk-embedded data=preserved reset=APK_CHANGED_SELECTION_RESET\n`,
      );
      process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS case=update.compatibility run=${runId}\n`);
      expect(install.nativeBuildNumber).toBeLessThan(full.nativeBuildNumber);
      return;
    }
    expect(install.nativeBuildNumber).toBeLessThan(full.nativeBuildNumber);

    if (updateCase === 'update.boot-guard' || updateCase === 'update.interruption') {
      const rollbackLayerId = `update-rollback-${runId.slice(0, 24)}`;
      const rollbackMarker = `rollback-${runId}`;
      if (updateCase === 'update.interruption') {
        const wallpaper = selectedSample === 'wallpaper';
        const written = await dispatchUpdateCommand(
          'kernel.base.ui-state.open-layer',
          Object.freeze({
            displayMode: 'PRIMARY',
            layerId: rollbackLayerId,
            partKey: wallpaper ? 'sample.wallpaper.system-notice' : 'sample.desk.waiting-confirm',
            persistence: 'durable',
            props: wallpaper
              ? Object.freeze({operation: 'confirm', phase: 'unknown-write-phase', rollbackMarker})
              : Object.freeze({rollbackMarker}),
          }),
          hotSession.sessionId,
        );
        expect(written.result).toMatchObject({changed: true, persistenceStatus: 'succeeded'});
        const candidateLayers = await readSelector(
          connection.driver,
          hotSession.sessionId,
          'kernel.base.ui-state.selectLayers',
          ['PRIMARY'],
        );
        const candidateLayer = Array.isArray(candidateLayers)
          ? candidateLayers.find(value => isRecord(value) && value.layerId === rollbackLayerId)
          : undefined;
        expect(candidateLayer).toMatchObject({props: {rollbackMarker}});
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_ROLLBACK_DATA run=${runId} stage=candidate-write persisted=1\n`,
        );
      }
      const candidateStatus = await readSelector(
        connection.driver,
        hotSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateRecentStatus',
        [],
      );
      // recentStatus is the last persisted update action and may still describe
      // the preceding FULL install while the HOT candidate has not reached
      // PRIMARY real-ready. Record it for diagnosis, but prove rollback from the
      // native deadline and embedded readback below instead of treating this
      // cross-stage snapshot as the candidate's boot-confirmation oracle.
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_BOOT_GUARD_PRIOR_STATUS run=${runId} state=${isRecord(candidateStatus) ? String(candidateStatus.state ?? 'UNKNOWN') : 'INVALID'} taskIdPresent=${isRecord(candidateStatus) && typeof candidateStatus.taskId === 'string' ? 1 : 0}\n`,
      );
      const injectedFailureDiagnostics = (await connection.readRuntimeFailureDiagnostics(packageId))
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as Readonly<Record<string, unknown>>);
      expect(injectedFailureDiagnostics).toContainEqual(
        expect.objectContaining({
          category: 'runtime.system-failure',
          event: 'runtime.system-failure.debug-injection-resolution',
          ownerId: 'surface-content',
          source: 'build-time',
          outcome: 'matched',
          buildMarker: 'TER_DEBUG_FAILURE_INJECTION_BUNDLE_MARKER_SURFACE_CONTENT',
        }),
      );
      expect(injectedFailureDiagnostics).not.toContainEqual(
        expect.objectContaining({
          category: 'runtime.system-failure',
          event: 'runtime.system-failure.debug-injection-resolution',
          ownerId: 'surface-layers',
          source: 'build-time',
          outcome: 'matched',
        }),
      );
      expect(injectedFailureDiagnostics).toContainEqual(
        expect.objectContaining({
          category: 'runtime.system-failure',
          event: 'runtime.system-failure.render-failed',
          ownerId: 'surface-content',
        }),
      );
      const injectionResolutionIndex = injectedFailureDiagnostics.findIndex(
        diagnostic =>
          diagnostic.event === 'runtime.system-failure.debug-injection-resolution' &&
          diagnostic.ownerId === 'surface-content' &&
          diagnostic.source === 'build-time' &&
          diagnostic.outcome === 'matched',
      );
      const contentFailureIndex = injectedFailureDiagnostics.findIndex(
        diagnostic =>
          diagnostic.event === 'runtime.system-failure.render-failed' && diagnostic.ownerId === 'surface-content',
      );
      expect(injectionResolutionIndex).toBeGreaterThanOrEqual(0);
      expect(contentFailureIndex).toBeGreaterThan(injectionResolutionIndex);
      const recoveredSession = await waitForAutomationSession(
        connection.driver,
        value => value.appName === sample.appName && value.sessionId !== hotSession.sessionId,
        90_000,
      );
      const recoveredActual = await readSelector(
        connection.driver,
        recoveredSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      expect(recoveredActual).toMatchObject({
        applicationId: packageId,
        nativeBuildNumber: full.nativeBuildNumber,
        bundleVersion: full.bundleVersion,
        entryKind: 'embedded',
      });
      const recoveredStatus = await waitForSelector(
        connection.driver,
        recoveredSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateRecentStatus',
        [],
        value => isRecord(value) && value.state === 'failed' && value.reason === 'HOT_BOOT_TIMEOUT',
        15_000,
      );
      expect(recoveredStatus).toMatchObject({state: 'failed', reason: 'HOT_BOOT_TIMEOUT'});
      if (updateCase === 'update.interruption') {
        const recoveredLayers = await readSelector(
          connection.driver,
          recoveredSession.sessionId,
          'kernel.base.ui-state.selectLayers',
          ['PRIMARY'],
        );
        const recoveredLayer = Array.isArray(recoveredLayers)
          ? recoveredLayers.find(value => isRecord(value) && value.layerId === rollbackLayerId)
          : undefined;
        expect(recoveredLayer).toMatchObject({props: {rollbackMarker}});
        process.stdout.write(
          `TERMINAL_AUTOMATION_UPDATE_ROLLBACK_DATA run=${runId} stage=previous-success-readback persisted=1\n`,
        );
      }
      const nativeLog = await connection.readTerminalUpdateLogs(packageId);
      expect(nativeLog).toContain('event=hot-boot-timeout-recovery entryKind=embedded');
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_BOOT_GUARD run=${runId} entryKind=embedded nativeBuild=${full.nativeBuildNumber} reason=HOT_BOOT_TIMEOUT\n`,
      );
      process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS case=${updateCase} run=${runId}\n`);
      return;
    }
    if (updateCase === 'update.rollback') {
      if (initialActivationStatus !== 'active' || hotActivationStatus !== 'active') {
        throw new Error('TERMINAL_AUTOMATION_ROLLBACK_TDC_ACTIVATION_NOT_RESTORED');
      }
      const readCommandName = terminalDataClientDescriptor.commandNames.find(
        (value: unknown) => typeof value === 'string' && value.endsWith('.read-terminal-data'),
      );
      if (typeof readCommandName !== 'string') throw new Error('TERMINAL_AUTOMATION_DATA_READ_COMMAND_MISSING');
      const beforeOrdinaryFailure = await readSelector(
        connection.driver,
        hotSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      expect(beforeOrdinaryFailure).toMatchObject({
        applicationId: packageId,
        nativeBuildNumber: hot.nativeBuildNumber,
        publicationId: hot.publicationId,
        entryKind: 'hot',
      });
      const completedTask = await waitForSelector(
        connection.driver,
        hotSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateTask',
        [],
        value =>
          isRecord(value) &&
          value.target !== null &&
          isRecord(value.target) &&
          value.target.ruleRef === `automation-${runId}` &&
          value.phase === 'succeeded',
        30_000,
      );
      expect(completedTask).toMatchObject({target: {ruleRef: `automation-${runId}`}, phase: 'succeeded'});
      failNextManagedBusinessRead = true;
      const readFailure = await dispatchUpdateCommand(
        readCommandName,
        Object.freeze({operationId: 'terminalReadStoreBasic', pathParameters: Object.freeze({storeRef: 'fixture'})}),
        hotSession.sessionId,
      );
      const readResult = isRecord(readFailure.result) ? readFailure.result : undefined;
      process.stdout.write(
        `TERMINAL_AUTOMATION_ROLLBACK_READ_RESULT run=${runId} kind=${typeof readResult?.kind === 'string' ? readResult.kind : 'invalid'} category=${typeof readResult?.category === 'string' ? readResult.category : 'none'} code=${typeof readResult?.code === 'string' ? readResult.code : 'none'} status=${typeof readResult?.status === 'number' ? readResult.status : 'none'}\n`,
      );
      expect(forcedManagedBusinessReadFailures).toBe(1);
      expect(isRecord(readFailure.result)).toBe(true);
      expect(isRecord(readFailure.result) && readFailure.result.kind).not.toBe('success');
      const actualAfterOrdinaryFailure = await readSelector(
        connection.driver,
        hotSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      expect(actualAfterOrdinaryFailure).toMatchObject({
        applicationId: packageId,
        nativeBuildNumber: hot.nativeBuildNumber,
        publicationId: hot.publicationId,
        entryKind: 'hot',
      });
      const disconnectCommandName = terminalDataClientDescriptor.commandNames.find(
        (value: unknown) => typeof value === 'string' && value.endsWith('.disconnect-terminal'),
      );
      if (typeof disconnectCommandName !== 'string') throw new Error('TERMINAL_AUTOMATION_DISCONNECT_COMMAND_MISSING');
      await dispatchUpdateCommand(disconnectCommandName, Object.freeze({}), hotSession.sessionId);
      expect(
        await readSelector(
          connection.driver,
          hotSession.sessionId,
          'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
          [],
        ),
      ).toMatchObject({
        applicationId: packageId,
        nativeBuildNumber: hot.nativeBuildNumber,
        publicationId: hot.publicationId,
        entryKind: 'hot',
      });
      expect(
        await readSelector(
          connection.driver,
          hotSession.sessionId,
          'kernel.base.terminal-update.selectTerminalUpdateTask',
          [],
        ),
      ).toMatchObject({target: {ruleRef: `automation-${runId}`}, phase: 'succeeded'});
      process.stdout.write(
        `TERMINAL_AUTOMATION_UPDATE_ROLLBACK run=${runId} outcome=http-503-and-disconnect selected=hot task=succeeded apkRollback=0\n`,
      );
      process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS case=update.rollback run=${runId}\n`);
      return;
    }
    const expectedRuleRef = supplyUi?.ruleRef ?? `automation-${runId}`;
    let task: unknown;
    try {
      task = await waitForSelector(
        connection.driver,
        hotSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateTask',
        [],
        value =>
          isRecord(value) &&
          isRecord(value.target) &&
          value.target.ruleRef === expectedRuleRef &&
          (value.phase === 'succeeded' || value.phase === 'failed' || value.phase === 'unknown'),
        30_000,
      );
    } catch (error) {
      await writeUpdateStateDiagnostics(connection.driver, hotSession.sessionId, runId);
      await writeNativeUpdateDiagnostics({connection, packageId, runId});
      throw error;
    }
    if (task === null) {
      await writeUpdateStateDiagnostics(connection.driver, hotSession.sessionId, runId);
      await writeNativeUpdateDiagnostics({connection, packageId, runId});
      const caseName = updateCase ?? 'UNKNOWN';
      throw new Error(
        `TERMINAL_AUTOMATION_UPDATE_TASK_TERMINAL_READBACK_TIMEOUT_${caseName.toUpperCase().replaceAll('.', '_')}`,
      );
    }
    expect(task).toMatchObject({target: {ruleRef: expectedRuleRef}, phase: 'succeeded'});
    const status = await readSelector(
      connection.driver,
      hotSession.sessionId,
      'kernel.base.terminal-update.selectTerminalUpdateRecentStatus',
      [],
    );
    expect(status).toMatchObject({state: 'succeeded'});
    if (isSupplyChainCase) {
      if (!supplyUi || !supplyTerminalRef || !supplyTerminalName)
        throw new Error('TERMINAL_AUTOMATION_SUPPLY_REPORT_CONTEXT_MISSING');
      const actual = await readSelector(
        connection.driver,
        hotSession.sessionId,
        'kernel.base.terminal-update.selectTerminalUpdateActualVersions',
        [],
      );
      if (
        !isRecord(actual) ||
        typeof actual.nativeVersion !== 'string' ||
        typeof actual.bundleVersion !== 'string' ||
        typeof actual.runtimeVersion !== 'string'
      )
        throw new Error('TERMINAL_AUTOMATION_SUPPLY_ACTUAL_VERSION_SELECTOR_INVALID');
      expect(actual).toMatchObject({
        applicationId: packageId,
        nativeBuildNumber: full.nativeBuildNumber,
        bundleVersion: hot.bundleVersion,
        runtimeVersion: hot.runtimeVersion,
        publicationId: hot.publicationId,
        entryKind: 'hot',
      });
      const reportDeliverySelector = 'kernel.base.terminal-update.selectTerminalUpdateReportDelivery';
      let reportDelivery = await readSelector(connection.driver, hotSession.sessionId, reportDeliverySelector, []);
      const initialPendingCount = isRecord(reportDelivery) ? reportDelivery.pendingCount : null;
      if (typeof initialPendingCount !== 'number' || !Number.isSafeInteger(initialPendingCount))
        throw new Error('TERMINAL_AUTOMATION_SUPPLY_REPORT_DELIVERY_SELECTOR_INVALID');
      await writeUpdateStateDiagnostics(connection.driver, hotSession.sessionId, runId);
      process.stdout.write(
        `TERMINAL_AUTOMATION_SUPPLY run=${runId} stage=report.delivery.wait.begin pending=${initialPendingCount} timeoutMs=90000\n`,
      );
      if (initialPendingCount > 0) {
        try {
          reportDelivery = await waitForSelector(
            connection.driver,
            hotSession.sessionId,
            reportDeliverySelector,
            [],
            value =>
              isRecord(value) &&
              Number.isSafeInteger(value.pendingCount) &&
              (value.pendingCount === 0 || value.sendPaused === true || value.latestDeliveryFailure !== null),
            90_000,
          );
        } catch (error) {
          await writeUpdateStateDiagnostics(connection.driver, hotSession.sessionId, runId);
          await writeAndroidFailureDiagnostics({
            connection,
            packageId,
            runId,
            boundary: 'hot-session',
            expectedSessionId: hotSession.sessionId,
          });
          const currentDelivery = await readSelector(
            connection.driver,
            hotSession.sessionId,
            reportDeliverySelector,
            [],
          ).catch(() => null);
          const state = isRecord(currentDelivery)
            ? `pending=${String(currentDelivery.pendingCount)} paused=${String(currentDelivery.sendPaused)} failure=${
                isRecord(currentDelivery.latestDeliveryFailure)
                  ? String(currentDelivery.latestDeliveryFailure.reasonCode)
                  : 'none'
              }`
            : 'unavailable';
          throw new Error(`TERMINAL_AUTOMATION_SUPPLY_REPORT_DELIVERY_TIMEOUT:${state}`, {cause: error});
        }
      }
      if (
        !isRecord(reportDelivery) ||
        reportDelivery.pendingCount !== 0 ||
        reportDelivery.sendPaused !== false ||
        reportDelivery.latestDeliveryFailure !== null
      )
        throw new Error('TERMINAL_AUTOMATION_SUPPLY_REPORT_DELIVERY_NOT_ACCEPTED');
      process.stdout.write(`TERMINAL_AUTOMATION_SUPPLY run=${runId} stage=report.delivery.accepted pending=0\n`);
      try {
        await assertTerminalUpdateReportInUi({
          page: supplyUi.operationsPage,
          terminalName: supplyTerminalName,
          terminalRef: supplyTerminalRef,
          ruleRef: supplyUi.ruleRef,
          fullArtifactRef: supplyUi.full.artifactRef,
          hotArtifactRef: supplyUi.hot.artifactRef,
          ruleTargetTitle: supplyUi.ruleTargetTitle,
          fullArtifactTitle: supplyUi.fullArtifactTitle,
          hotArtifactTitle: supplyUi.hotArtifactTitle,
          apkVersion: actual.nativeVersion,
          jsVersion: actual.bundleVersion,
          runtimeVersion: actual.runtimeVersion,
          runId,
        });
      } catch (error) {
        await writeAndroidFailureDiagnostics({
          connection,
          packageId,
          runId,
          boundary: 'hot-session',
          expectedSessionId: hotSession.sessionId,
        });
        throw error;
      }
    }
    process.stdout.write(`TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS case=${updateCase} run=${runId}\n`);
  },
  90 * 60 * 1000,
);

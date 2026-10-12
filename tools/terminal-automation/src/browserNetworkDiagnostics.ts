export const safeBrowserRequestFailureReason = (errorText: string | undefined): string => {
  if (errorText === undefined) return 'UNKNOWN';
  return errorText.match(/\bERR_[A-Z0-9_]{1,80}\b/u)?.[0] ?? 'UNKNOWN';
};

export const liveKitSignalSocketProtocol = (rawUrl: string): 'ws' | 'wss' | undefined => {
  try {
    const url = new URL(rawUrl);
    if ((url.protocol === 'ws:' || url.protocol === 'wss:') && url.pathname === '/rtc/v1') {
      return url.protocol.slice(0, -1) as 'ws' | 'wss';
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const operationsRemoteControlDiagnosticFields = [
  'attempt', 'cleanupState', 'deadlineAtEpochMillis', 'endpointCount', 'errorCode', 'errorName',
  'expectedScreenCount', 'forSeq', 'missingEndpointCount', 'participantCount', 'projectRef', 'reason',
  'readyScreenCount', 'screen', 'screenCount', 'seq', 'sessionId', 'state', 'status', 'streamId',
  'terminalRef', 'trackSid', 'topologyKind',
] as const;
const operationsDiagnosticIdentifier = /^[A-Za-z0-9_.:-]{1,160}$/u;
const operationsDiagnosticCode = /^[A-Z0-9_.:-]{1,96}$/u;

/** Projects only bounded operations-admin remote-control console events for the managed runner. */
export const projectOperationsRemoteControlLog = (
  text: string,
): Readonly<Record<string, string | number | boolean>> | undefined => {
  const prefix = '[operations-admin] ';
  if (!text.startsWith(prefix)) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(text.slice(prefix.length)) as unknown;
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const event = value as Record<string, unknown>;
  if (
    event.service !== 'operations-admin' ||
    typeof event.event !== 'string' ||
    !/^frontend\.remote_control\.[a-z0-9_.-]{1,96}$/u.test(event.event)
  ) return undefined;

  const projected: Record<string, string | number | boolean> = {sourceEvent: event.event};
  for (const key of ['level', 'phase', 'outcome'] as const) {
    if (typeof event[key] !== 'string') continue;
    const valid = key === 'phase'
      ? /^[a-z][a-z0-9_.:-]{0,63}$/u.test(event[key] as string)
      : operationsDiagnosticCode.test(event[key] as string);
    if (valid) projected[key] = event[key] as string;
  }
  if (typeof event.status === 'number' && Number.isInteger(event.status)) projected.httpStatus = event.status;
  const diagnostic = typeof event.diagnostic === 'object' && event.diagnostic !== null && !Array.isArray(event.diagnostic)
    ? event.diagnostic as Record<string, unknown>
    : undefined;
  if (diagnostic !== undefined) {
    for (const key of operationsRemoteControlDiagnosticFields) {
      const item = diagnostic[key];
      if (typeof item === 'number' && Number.isFinite(item)) projected[`diag_${key}`] = item;
      else if (typeof item === 'string' && operationsDiagnosticIdentifier.test(item))
        projected[key === 'sessionId' ? 'remoteSessionId' : `diag_${key}`] = item;
      else if (typeof item === 'boolean') projected[`diag_${key}`] = item;
    }
  }
  if (typeof event.errorCode === 'string' && operationsDiagnosticCode.test(event.errorCode))
    projected.errorCode = event.errorCode;
  return Object.freeze(projected);
};

export type OperationsRemoteControlHttpOperation = 'start' | 'read' | 'grant' | 'end';

/** Classifies the four operations-admin remote-control session HTTP endpoints. */
export const operationsRemoteControlOperationOfPath = (
  pathname: string,
): OperationsRemoteControlHttpOperation | undefined => {
  if (/\/remote-control-sessions\/[^/]+\/controller-grant$/u.test(pathname)) return 'grant';
  if (/\/remote-control-sessions\/[^/]+\/end$/u.test(pathname)) return 'end';
  if (/\/remote-control-sessions\/[^/]+$/u.test(pathname)) return 'read';
  if (/\/remote-control-sessions$/u.test(pathname)) return 'start';
  return undefined;
};

const rtcStates = new Set([
  'new', 'checking', 'connected', 'completed', 'disconnected', 'failed', 'closed',
  'stable', 'have-local-offer', 'have-remote-offer', 'have-local-pranswer', 'have-remote-pranswer',
  'gathering', 'complete',
]);
const rtcCandidateTypes = new Set(['host', 'srflx', 'prflx', 'relay', 'unknown']);
const rtcProtocols = new Set(['udp', 'tcp', 'unknown']);
const rtcCandidatePairStates = new Set(['frozen', 'waiting', 'in-progress', 'failed', 'succeeded']);

export type BrowserRtcDiagnostics = Readonly<{
  probeStatus: 'INSTALLED' | 'UNAVAILABLE';
  peerCount: number;
  overflowCount: number;
  peers: readonly Readonly<{
    peerId: number;
    connectionState: string;
    iceConnectionState: string;
    iceGatheringState: string;
    signalingState: string;
    statsStatus: 'READ' | 'UNAVAILABLE';
    candidateCounts: Readonly<Record<string, number>>;
    candidatePairs: readonly Readonly<{
      state: string;
      selected: boolean;
      nominated: boolean;
      localType: string;
      localProtocol: string;
      localAddress: string;
      localPort: number;
      remoteType: string;
      remoteProtocol: string;
      remoteAddress: string;
      remotePort: number;
      bytesSent: number;
      bytesReceived: number;
      roundTripTimeMs: number;
    }>[];
    videoRtpReports: readonly Readonly<{
      direction: 'inbound' | 'outbound';
      mid: string;
      packets: number;
      bytes: number;
      framesReceived: number;
      framesDecoded: number;
      framesPerSecond: number;
      frameWidth: number;
      frameHeight: number;
    }>[];
  }>[];
}>;

const diagnosticRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const diagnosticCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(Math.floor(value), 1_000_000) : 0;
const diagnosticMetric = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, 1_000_000) : 0;
const diagnosticEnum = (value: unknown, allowed: ReadonlySet<string>): string =>
  typeof value === 'string' && allowed.has(value) ? value : 'unknown';

/** Projects bounded local-runner RTC facts needed to distinguish signaling, ICE, and media flow. */
export const projectBrowserRtcDiagnostics = (value: unknown): BrowserRtcDiagnostics | undefined => {
  if (!diagnosticRecord(value) || !Array.isArray(value.peers)) return undefined;
  if (value.probeStatus !== 'INSTALLED' && value.probeStatus !== 'UNAVAILABLE') return undefined;
  const peers = value.peers.slice(0, 8).flatMap((item): BrowserRtcDiagnostics['peers'][number][] => {
    if (!diagnosticRecord(item)) return [];
    const counts = diagnosticRecord(item.candidateCounts) ? item.candidateCounts : {};
    const pairs = Array.isArray(item.candidatePairs) ? item.candidatePairs.slice(0, 8).flatMap(pair => {
      if (!diagnosticRecord(pair)) return [];
      return [{
        state: diagnosticEnum(pair.state, rtcCandidatePairStates),
        selected: pair.selected === true,
        nominated: pair.nominated === true,
        localType: diagnosticEnum(pair.localType, rtcCandidateTypes),
        localProtocol: diagnosticEnum(pair.localProtocol, rtcProtocols),
        localAddress: typeof pair.localAddress === 'string' ? pair.localAddress.slice(0, 256) : 'unknown',
        localPort: diagnosticCount(pair.localPort),
        remoteType: diagnosticEnum(pair.remoteType, rtcCandidateTypes),
        remoteProtocol: diagnosticEnum(pair.remoteProtocol, rtcProtocols),
        remoteAddress: typeof pair.remoteAddress === 'string' ? pair.remoteAddress.slice(0, 256) : 'unknown',
        remotePort: diagnosticCount(pair.remotePort),
        bytesSent: diagnosticCount(pair.bytesSent),
        bytesReceived: diagnosticCount(pair.bytesReceived),
        roundTripTimeMs: diagnosticCount(pair.roundTripTimeMs),
      }];
    }) : [];
    return [{
      peerId: diagnosticCount(item.peerId),
      connectionState: diagnosticEnum(item.connectionState, rtcStates),
      iceConnectionState: diagnosticEnum(item.iceConnectionState, rtcStates),
      iceGatheringState: diagnosticEnum(item.iceGatheringState, rtcStates),
      signalingState: diagnosticEnum(item.signalingState, rtcStates),
      statsStatus: item.statsStatus === 'READ' ? 'READ' : 'UNAVAILABLE',
      candidateCounts: Object.freeze({
        hostUdp: diagnosticCount(counts.hostUdp), hostTcp: diagnosticCount(counts.hostTcp),
        srflxUdp: diagnosticCount(counts.srflxUdp), srflxTcp: diagnosticCount(counts.srflxTcp),
        prflxUdp: diagnosticCount(counts.prflxUdp), prflxTcp: diagnosticCount(counts.prflxTcp),
        relayUdp: diagnosticCount(counts.relayUdp), relayTcp: diagnosticCount(counts.relayTcp),
      }),
      candidatePairs: Object.freeze(pairs),
      videoRtpReports: Object.freeze(
        (Array.isArray(item.videoRtpReports) ? item.videoRtpReports : []).slice(0, 8).flatMap(report => {
          if (!diagnosticRecord(report)) return [];
          return [{
            direction: report.direction === 'outbound' ? 'outbound' as const : 'inbound' as const,
            mid: typeof report.mid === 'string' && /^\d{1,3}$/u.test(report.mid) ? report.mid : 'unknown',
            packets: diagnosticCount(report.packets),
            bytes: diagnosticCount(report.bytes),
            framesReceived: diagnosticCount(report.framesReceived),
            framesDecoded: diagnosticCount(report.framesDecoded),
            framesPerSecond: diagnosticMetric(report.framesPerSecond),
            frameWidth: diagnosticCount(report.frameWidth),
            frameHeight: diagnosticCount(report.frameHeight),
          }];
        }),
      ),
    }];
  });
  return Object.freeze({
    probeStatus: value.probeStatus,
    peerCount: diagnosticCount(value.peerCount),
    overflowCount: diagnosticCount(value.overflowCount),
    peers: Object.freeze(peers),
  });
};

export const safeBrowserConsoleNetworkFailureReason = (message: string): string | undefined =>
  /blocked by CORS policy/iu.test(message) ? 'CORS_BLOCKED' : undefined;

export type ExpoWebOutputStream = 'stdout' | 'stderr';

export type ExpoWebOutputDiagnostic = Readonly<{
  category:
    | 'PROJECT_STARTING'
    | 'METRO_STARTING'
    | 'BUNDLE_SUCCEEDED'
    | 'BUNDLE_FAILED'
    | 'MODULE_RESOLUTION_FAILED'
    | 'DEPENDENCY_RESOLUTION_FAILED'
    | 'SYNTAX_FAILED'
    | 'PORT_BIND_FAILED'
    | 'EXPO_ERROR'
    | 'OUTPUT_LINE_TOO_LONG';
  elapsedMs?: number;
  moduleCount?: number;
}>;

export type ExpoWebOutputSummary = Readonly<{
  stdoutBytes: number;
  stderrBytes: number;
  classifiedLines: number;
  unclassifiedLines: number;
  oversizedLines: number;
  categories: Readonly<Partial<Record<ExpoWebOutputDiagnostic['category'], number>>>;
}>;

const maxExpoWebOutputLineLength = 4_096;

/** Parse only known Metro/Expo signals; arbitrary output, paths, messages, and stack lines never leave this function. */
export const projectExpoWebOutputLine = (line: string): ExpoWebOutputDiagnostic | undefined => {
  if (line.length > maxExpoWebOutputLineLength) return Object.freeze({category: 'OUTPUT_LINE_TOO_LONG'});
  const normalized = line.replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '').trim();
  if (normalized.startsWith('Starting project at ')) return Object.freeze({category: 'PROJECT_STARTING'});
  if (normalized === 'Starting Metro Bundler') return Object.freeze({category: 'METRO_STARTING'});

  const successfulBundle = normalized.match(/^Web Bundled (\d+)ms .+ \((\d+) modules?\)$/u);
  if (successfulBundle !== null) return Object.freeze({
    category: 'BUNDLE_SUCCEEDED',
    elapsedMs: Number(successfulBundle[1]),
    moduleCount: Number(successfulBundle[2]),
  });
  const failedBundle = normalized.match(/^Web Bundling failed (\d+)ms .+ \((\d+) modules?\)$/u);
  if (failedBundle !== null) return Object.freeze({
    category: 'BUNDLE_FAILED',
    elapsedMs: Number(failedBundle[1]),
    moduleCount: Number(failedBundle[2]),
  });
  if (/^(?:Error: )?listen EADDRINUSE\b/u.test(normalized))
    return Object.freeze({category: 'PORT_BIND_FAILED'});
  if (/^(?:Error: )?Unable to resolve (?:module|"|')/u.test(normalized))
    return Object.freeze({category: 'MODULE_RESOLUTION_FAILED'});
  if (/^(?:Error: )?Cannot find module\b/u.test(normalized))
    return Object.freeze({category: 'DEPENDENCY_RESOLUTION_FAILED'});
  if (/^(?:SyntaxError|TransformError):/u.test(normalized))
    return Object.freeze({category: 'SYNTAX_FAILED'});
  if (/^(?:Error|TypeError|ReferenceError):/u.test(normalized))
    return Object.freeze({category: 'EXPO_ERROR'});
  return undefined;
};

/** Bounded, per-stream line framing with allowlisted diagnostics and numeric-only summaries. */
export const createExpoWebOutputTracker = (
  onDiagnostic: (stream: ExpoWebOutputStream, diagnostic: ExpoWebOutputDiagnostic) => void,
): Readonly<{
  push: (stream: ExpoWebOutputStream, chunk: Uint8Array) => void;
  flush: () => void;
  summary: () => ExpoWebOutputSummary;
}> => {
  const states: Record<ExpoWebOutputStream, {pending: string; discardingLongLine: boolean}> = {
    stdout: {pending: '', discardingLongLine: false},
    stderr: {pending: '', discardingLongLine: false},
  };
  const byteCounts: Record<ExpoWebOutputStream, number> = {stdout: 0, stderr: 0};
  const categories: Partial<Record<ExpoWebOutputDiagnostic['category'], number>> = {};
  let classifiedLines = 0;
  let unclassifiedLines = 0;
  let oversizedLines = 0;

  const acceptLine = (stream: ExpoWebOutputStream, line: string): void => {
    const diagnostic = projectExpoWebOutputLine(line);
    if (diagnostic === undefined) {
      unclassifiedLines += 1;
      return;
    }
    categories[diagnostic.category] = (categories[diagnostic.category] ?? 0) + 1;
    if (diagnostic.category === 'OUTPUT_LINE_TOO_LONG') oversizedLines += 1;
    else classifiedLines += 1;
    onDiagnostic(stream, diagnostic);
  };

  const push = (stream: ExpoWebOutputStream, chunk: Uint8Array): void => {
    byteCounts[stream] += chunk.byteLength;
    let incoming = Buffer.from(chunk).toString('utf8');
    const state = states[stream];
    if (state.discardingLongLine) {
      const newline = incoming.indexOf('\n');
      if (newline < 0) return;
      incoming = incoming.slice(newline + 1);
      state.discardingLongLine = false;
    }

    const combined = state.pending + incoming;
    state.pending = '';
    let start = 0;
    for (let end = combined.indexOf('\n'); end >= 0; end = combined.indexOf('\n', start)) {
      const line = combined.slice(start, end).replace(/\r$/u, '');
      if (line.length > maxExpoWebOutputLineLength) {
        acceptLine(stream, line.slice(0, maxExpoWebOutputLineLength + 1));
      } else {
        acceptLine(stream, line);
      }
      start = end + 1;
    }
    const tail = combined.slice(start);
    if (tail.length > maxExpoWebOutputLineLength) {
      acceptLine(stream, tail.slice(0, maxExpoWebOutputLineLength + 1));
      state.discardingLongLine = true;
    } else {
      state.pending = tail;
    }
  };

  const flush = (): void => {
    for (const stream of ['stdout', 'stderr'] as const) {
      const state = states[stream];
      if (state.pending.length > 0) acceptLine(stream, state.pending);
      state.pending = '';
      state.discardingLongLine = false;
    }
  };

  const summary = (): ExpoWebOutputSummary => Object.freeze({
    stdoutBytes: byteCounts.stdout,
    stderrBytes: byteCounts.stderr,
    classifiedLines,
    unclassifiedLines,
    oversizedLines,
    categories: Object.freeze({...categories}),
  });

  return Object.freeze({push, flush, summary});
};

const terminalRuntimeEvents = new Set([
  'remote-control.start-command-received',
  'remote-control.start-rejected',
  'remote-control.session-registration-started',
  'remote-control.session-registration-rejected',
  'remote-control.session-registration-completed',
  'remote-control.endpoint-preparation-started',
  'remote-control.endpoint-preparation-rejected',
  'remote-control.local-screens-read',
  'remote-control.endpoint-port-begin-started',
  'remote-control.endpoint-port-begin-completed',
  'remote-control.session-endpoint-preparation-failed',
  'remote-control.session-started',
  'remote-control.status-report-dispatch-started',
  'remote-control.status-report-dispatch-completed',
  'remote-control.status-report-dispatch-threw',
  'remote-control.report-failed',
  'remote-control.session-ended',
  'remote-control.cleanup-failed',
  'remote-control.screen-ready-sent',
  'remote-control.input-gesture-cancelled',
  'remote-control.screen-invalidated',
  'remote-control.local-input-preempted',
  'environment-change-dispatch-failed',
  'port-event-dispatch-failed',
  'port-event-dispatch-threw',
  'register-completed',
  'report-command-received',
  'report-command-rejected',
  'report-http-started',
  'report-http-threw',
  'report-rejected-after-http',
  'report-response-acceptance-threw',
  'report-completed',
  'surface.unavailable',
  'surface.ready',
  'endpoint.begin-requested',
  'endpoint.begin-rejected',
  'room.connect.started',
  'room.connected',
  'room.connect.failed',
  'room.released',
  'room.release-failed',
  'data.rejected',
  'data.sent',
  'data.send-failed',
  'pointer.dispatched',
  'session.ended',
  'remote-command.received',
  'remote-command.rejected',
  'remote-command.discarded-after-clear',
  'remote-command.duplicate-reported',
  'remote-command.fact-persisted',
  'remote-command.dispatch-started',
  'remote-command.dispatch-completed',
  'remote-command.dispatch-failed',
]);

const terminalRuntimeCategories = new Map<string, ReadonlySet<string>>([
  ['kernel.base.remote-control', new Set(['terminal.remote-control'])],
  [
    'ui.integration.sample-console.test-expo',
    new Set(['terminal.automation.remote-control']),
  ],
  [
    'ui.integration.sample-wallpaper-console.test-expo',
    new Set(['terminal.automation.remote-control']),
  ],
  [
    'kernel.base.terminal-data-client',
    new Set([
      'terminal.remote-control.execution',
      'terminal.remote-control.register',
      'terminal.remote-control.report',
    ]),
  ],
]);

const terminalRuntimeContextFields = new Set([
  'commandId',
  'requestId',
  'sessionId',
  'connectionId',
  'nodeId',
  'peerNodeId',
]);
const terminalRuntimeDataFields = new Set([
  'remoteOperationId',
  'requestId',
  'correlationId',
  'commandKind',
  'bindingGeneration',
  'sessionReady',
  'hasCredential',
  'credentialGenerationMatches',
  'sessionId',
  'phase',
  'stage',
  'errorCode',
  'failureStage',
  'sdkCode',
  'reason',
  'dispatchStatus',
  'resultKind',
  'failureCategory',
  'code',
  'status',
  'elapsedMs',
  'topologyKind',
  'mode',
  'activationStatus',
  'connectionStatus',
  'connectedSessionMatches',
  'grantCount',
  'runId',
  'errorName',
  'endpointId',
  'trackSid',
  'byteLength',
  'delivered',
  'screen',
  'state',
  'seq',
  'forSeq',
  'generation',
  'resource',
  'acknowledged',
  'paired',
  'peerStopped',
  'reportAccepted',
  'readyScreenCount',
  'screenCount',
  'localScreenCount',
  'actorResultCount',
  'hasPendingActor',
  'endpointCount',
  'requestedScreenCount',
  'expectedPrimaryMapping',
  'surfaceFound',
  'width',
  'height',
  'tracksReleased',
  'roomLeft',
  'inputCancelled',
]);
const terminalRuntimeIdentifier = /^[A-Za-z0-9_.:-]{1,160}$/u;
const terminalRuntimeCode = /^[A-Z][A-Z0-9_.:-]{1,96}$/u;
const terminalRuntimePortStatuses = new Set(['failed', 'timed-out', 'unavailable']);

/** Projects only named TER remote-control lifecycle fields; arbitrary console objects and payloads are discarded. */
export const projectTerminalRuntimeRemoteControlLog = (
  value: unknown,
): Readonly<Record<string, string | number | boolean>> | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const event = value as Record<string, unknown>;
  const security = typeof event.security === 'object' && event.security !== null
    ? event.security as Record<string, unknown>
    : undefined;
  const scope = typeof event.scope === 'object' && event.scope !== null
    ? event.scope as Record<string, unknown>
    : undefined;
  if (
    security?.containsSensitiveRaw !== false ||
    security.maskingMode !== 'masked' ||
    typeof event.event !== 'string' ||
    !terminalRuntimeEvents.has(event.event) ||
    typeof event.category !== 'string' ||
    scope === undefined
  ) return undefined;
  const moduleName = scope.moduleName;
  const categories = typeof moduleName === 'string' ? terminalRuntimeCategories.get(moduleName) : undefined;
  if (categories === undefined || !categories.has(event.category)) return undefined;

  const projected: Record<string, string | number | boolean> = {
    moduleName: moduleName as string,
    category: event.category,
    event: event.event,
  };
  const context = typeof event.context === 'object' && event.context !== null
    ? event.context as Record<string, unknown>
    : {};
  for (const key of terminalRuntimeContextFields) {
    const item = context[key];
    if (typeof item === 'string' && terminalRuntimeIdentifier.test(item)) {
      projected[key === 'requestId' ? 'runtimeRequestId' : key] = item;
    }
  }
  const data = typeof event.data === 'object' && event.data !== null ? event.data as Record<string, unknown> : {};
  for (const key of terminalRuntimeDataFields) {
    const item = data[key];
    if (typeof item === 'boolean') projected[key] = item;
    else if (typeof item === 'number' && Number.isFinite(item)) projected[key] = item;
    else if (typeof item === 'string') {
      if (key === 'reason' && (terminalRuntimeCode.test(item) || terminalRuntimePortStatuses.has(item))) projected[key] = item;
      else if (['errorCode', 'code'].includes(key) && terminalRuntimeCode.test(item)) projected[key] = item;
      else if (terminalRuntimeIdentifier.test(item)) projected[key] = item;
    }
  }
  return Object.freeze(projected);
};

export const terminalRemoteControlOperationOfPath = (
  pathname: string,
): 'remote-control.registration' | 'remote-control.status' | undefined => {
  if (/\/remote-control-sessions\/[^/]+\/registration$/u.test(pathname)) return 'remote-control.registration';
  if (/\/remote-control-sessions\/[^/]+\/status$/u.test(pathname)) return 'remote-control.status';
  return undefined;
};

export const safeTerminalBrowserPolicyFailure = (
  failedUrl: string,
  consoleMessage: string,
): Readonly<{operation: 'remote-control.registration' | 'remote-control.status'; reason: 'CORS_BLOCKED'}> | undefined => {
  let pathname: string;
  try {
    pathname = new URL(failedUrl).pathname;
  } catch {
    return undefined;
  }
  const operation = terminalRemoteControlOperationOfPath(pathname);
  const reason = safeBrowserConsoleNetworkFailureReason(consoleMessage);
  if (operation === undefined || reason !== 'CORS_BLOCKED') return undefined;
  return Object.freeze({operation, reason});
};

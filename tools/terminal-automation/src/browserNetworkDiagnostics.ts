export const safeBrowserRequestFailureReason = (errorText: string | undefined): string => {
  if (errorText === undefined) return 'UNKNOWN';
  return errorText.match(/\bERR_[A-Z0-9_]{1,80}\b/u)?.[0] ?? 'UNKNOWN';
};

export const safeBrowserConsoleNetworkFailureReason = (message: string): string | undefined =>
  /blocked by CORS policy/iu.test(message) ? 'CORS_BLOCKED' : undefined;

/** Expo's forwarded Web console is not a safe diagnostic sink; approved Runtime events are captured via Playwright. */
export const isForwardedExpoWebConsoleLine = (line: string): boolean =>
  /^Web\s+(?:INFO|WARN|ERROR|LOG|DEBUG|TRACE)\b/u.test(line);

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
  'report-completed',
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
  'endpointId',
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

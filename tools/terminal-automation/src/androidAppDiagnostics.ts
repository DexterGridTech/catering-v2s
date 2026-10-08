type RuntimeFailureDiagnostic = Readonly<{
  readonly category: string;
  readonly event: string;
  readonly level?: string;
  readonly failureName?: string;
  readonly failureCode?: string;
  readonly ownerId?: string;
  readonly source?: string;
  readonly outcome?: string;
  readonly buildMarker?: string;
  readonly causeName?: string;
  readonly causeCode?: string;
  readonly moduleName?: string;
  readonly phase?: string;
  readonly commandName?: string;
  readonly actorKey?: string;
  readonly actorFailureKey?: string;
  readonly actorFailureCode?: string;
  readonly executionId?: string;
  readonly profileId?: string;
  readonly serverName?: string;
  readonly method?: string;
  readonly stage?: string;
  readonly addressName?: string;
  readonly configRevision?: string;
  readonly connectionToken?: number;
  readonly reasonCode?: string;
  readonly currentRevision?: string;
  readonly status?: number;
  readonly attemptNumber?: number;
  readonly attemptCount?: number;
  readonly candidateCount?: number;
  readonly addressCount?: number;
  readonly elapsedMs?: number;
  readonly retryable?: boolean;
  readonly willRetry?: boolean;
  readonly transportFailureCategory?: string;
  readonly transportFailureCode?: string;
  readonly transportErrorName?: string;
  readonly transportErrorCode?: string;
  readonly transportCauseName?: string;
  readonly transportCauseCode?: string;
}>;

const safeToken = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[A-Za-z0-9_.: -]{1,100}$/u.test(value) ? value.replaceAll(' ', '_') : undefined;

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

/** Extract only stable startup failure identifiers; never return log messages or business payloads. */
export const projectAndroidRuntimeFailureLog = (line: string): RuntimeFailureDiagnostic | null => {
  const match = line.match(/^[VDIWEF]\/ReactNativeJS\s*\(\s*\d+\):\s*(\{.*\})\s*$/u);
  if (!match) return null;
  let value: unknown;
  try {
    value = JSON.parse(match[1]!);
  } catch {
    return null;
  }
  const event = record(value);
  if (!event) return null;
  const category = safeToken(event.category);
  const name = safeToken(event.event);
  if (
    category === 'runtime.system-failure' &&
    (name === 'runtime.system-failure.debug-injection-resolution' ||
      name === 'runtime.system-failure.render-failed' ||
      name === 'runtime.system-failure.debug-injection-read-failed')
  ) {
    const data = record(event.data);
    return Object.freeze({
      category,
      event: name,
      ...(safeToken(event.level) === undefined ? {} : {level: safeToken(event.level)}),
      ...(safeToken(data?.ownerId) === undefined ? {} : {ownerId: safeToken(data?.ownerId)}),
      ...(safeToken(data?.source) === undefined ? {} : {source: safeToken(data?.source)}),
      ...(safeToken(data?.outcome) === undefined ? {} : {outcome: safeToken(data?.outcome)}),
      ...(safeToken(data?.buildMarker) === undefined ? {} : {buildMarker: safeToken(data?.buildMarker)}),
      ...(safeToken(data?.errorName) === undefined ? {} : {failureName: safeToken(data?.errorName)}),
    });
  }
  if (
    category !== 'runtime.lifecycle' ||
    (name !== 'runtime.start.failed' && name !== 'runtime.module.hook.failed' && name !== 'runtime.actor.failed')
  ) {
    return null;
  }
  const error = record(event.error);
  const data = record(event.data);
  return Object.freeze({
    category,
    event: name,
    ...(safeToken(event.level) === undefined ? {} : {level: safeToken(event.level)}),
    ...(safeToken(error?.name) === undefined ? {} : {failureName: safeToken(error?.name)}),
    ...(safeToken(error?.code) === undefined ? {} : {failureCode: safeToken(error?.code)}),
    ...(safeToken(data?.causeName) === undefined ? {} : {causeName: safeToken(data?.causeName)}),
    ...(safeToken(data?.causeCode) === undefined ? {} : {causeCode: safeToken(data?.causeCode)}),
    ...(safeToken(data?.moduleName) === undefined ? {} : {moduleName: safeToken(data?.moduleName)}),
    ...(safeToken(data?.phase) === undefined ? {} : {phase: safeToken(data?.phase)}),
    ...(safeToken(data?.commandName) === undefined ? {} : {commandName: safeToken(data?.commandName)}),
    ...(safeToken(data?.actorKey) === undefined ? {} : {actorKey: safeToken(data?.actorKey)}),
    ...(safeToken(data?.failureKey) === undefined ? {} : {actorFailureKey: safeToken(data?.failureKey)}),
    ...(safeToken(data?.failureCode) === undefined ? {} : {actorFailureCode: safeToken(data?.failureCode)}),
  });
};

const transportFailureEvents = new Set([
  'transport.connection.http-response-non-success',
  'transport.connection.http-attempt-failed',
  'transport.connection.http-request-failed',
  'transport.connection.http-response-rejected',
  'transport.connection.connect-candidate-failed',
  'transport.connection.connect-attempt-failed',
  'transport.connection.connection-close-failed',
  'transport.connection.ready-timeout',
  'transport.connection.socket-error-observed',
  'transport.connection.socket-send-failed',
  'transport.connection.internal-command-failed',
  'transport.connection.network-observation-failed',
  'transport.connection.resource-disposal-failed',
]);

const safeNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

const safeBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

/** Project only transport failure metadata needed to diagnose a request; omit URLs, headers and payloads. */
export const projectAndroidTransportFailureLog = (line: string): RuntimeFailureDiagnostic | null => {
  const match = line.match(/^[VDIWEF]\/ReactNativeJS\s*\(\s*\d+\):\s*(\{.*\})\s*$/u);
  if (!match) return null;
  let value: unknown;
  try {
    value = JSON.parse(match[1]!);
  } catch {
    return null;
  }
  const event = record(value);
  if (!event || event.category !== 'transport.connection' || !transportFailureEvents.has(String(event.event)))
    return null;
  const data = record(event.data);
  if (!data) return null;
  const error = record(event.error);
  const level = safeToken(event.level);
  if (level !== 'warn' && level !== 'error' && level !== 'fatal') return null;
  const revision = safeNumber(data.revision);
  const output: RuntimeFailureDiagnostic = Object.freeze({
    category: 'transport.connection',
    event: String(event.event),
    level,
    ...(safeToken(data.executionId) === undefined ? {} : {executionId: safeToken(data.executionId)}),
    ...(safeToken(data.profileId) === undefined ? {} : {profileId: safeToken(data.profileId)}),
    ...(safeToken(data.serverName) === undefined ? {} : {serverName: safeToken(data.serverName)}),
    ...(safeToken(data.method) === undefined ? {} : {method: safeToken(data.method)}),
    ...(safeToken(data.stage) === undefined ? {} : {stage: safeToken(data.stage)}),
    ...(safeToken(data.addressName) === undefined ? {} : {addressName: safeToken(data.addressName)}),
    ...(revision === undefined
      ? safeToken(data.revision) === undefined
        ? {}
        : {configRevision: safeToken(data.revision)}
      : {configRevision: String(revision)}),
    ...(safeNumber(data.connectionToken) === undefined ? {} : {connectionToken: safeNumber(data.connectionToken)}),
    ...(safeToken(data.reasonCode) === undefined ? {} : {reasonCode: safeToken(data.reasonCode)}),
    ...(safeToken(data.currentRevision) === undefined ? {} : {currentRevision: safeToken(data.currentRevision)}),
    ...(safeNumber(data.status) === undefined ? {} : {status: safeNumber(data.status)}),
    ...(safeNumber(data.attemptNumber) === undefined ? {} : {attemptNumber: safeNumber(data.attemptNumber)}),
    ...(safeNumber(data.attemptCount) === undefined ? {} : {attemptCount: safeNumber(data.attemptCount)}),
    ...(safeNumber(data.candidateCount) === undefined ? {} : {candidateCount: safeNumber(data.candidateCount)}),
    ...(safeNumber(data.addressCount) === undefined ? {} : {addressCount: safeNumber(data.addressCount)}),
    ...(safeNumber(data.elapsedMs) === undefined ? {} : {elapsedMs: safeNumber(data.elapsedMs)}),
    ...(safeBoolean(data.safeRetryable) === undefined ? {} : {retryable: safeBoolean(data.safeRetryable)}),
    ...(safeBoolean(data.willRetry) === undefined ? {} : {willRetry: safeBoolean(data.willRetry)}),
    ...(safeToken(data.category) === undefined ? {} : {transportFailureCategory: safeToken(data.category)}),
    ...(safeToken(data.code) === undefined ? {} : {transportFailureCode: safeToken(data.code)}),
    ...(safeToken(data.causeCode) === undefined ? {} : {transportCauseCode: safeToken(data.causeCode)}),
    ...(safeToken(data.kind) === undefined ? {} : {kind: safeToken(data.kind)}),
    ...(safeToken(data.status) === undefined ? {} : {commandStatus: safeToken(data.status)}),
    ...(safeToken(data.stateTransition) === undefined ? {} : {stateTransition: safeToken(data.stateTransition)}),
    ...(safeToken(data.outcome) === undefined ? {} : {outcome: safeToken(data.outcome)}),
    ...(safeToken(data.source) === undefined ? {} : {source: safeToken(data.source)}),
    ...(safeToken(data.resource) === undefined ? {} : {resource: safeToken(data.resource)}),
    ...(safeToken(data.errorCode) === undefined ? {} : {transportErrorCode: safeToken(data.errorCode)}),
    ...(safeToken(data.causeName) === undefined ? {} : {transportCauseName: safeToken(data.causeName)}),
    ...(safeToken(data.causeCode) === undefined ? {} : {transportCauseCode: safeToken(data.causeCode)}),
    ...(safeToken(data.errorName) === undefined && safeToken(error?.name) === undefined
      ? {}
      : {transportErrorName: safeToken(data.errorName) ?? safeToken(error?.name)}),
  });
  return output;
};

export const collectAndroidRuntimeFailureDiagnostics = (logcat: string): string =>
  logcat
    .split(/\r?\n/u)
    .map(line => projectAndroidRuntimeFailureLog(line) ?? projectAndroidTransportFailureLog(line))
    .filter((value): value is RuntimeFailureDiagnostic => value !== null)
    .map(value => JSON.stringify(value))
    .join('\n');

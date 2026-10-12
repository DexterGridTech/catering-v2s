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
  readonly operationId?: string;
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
  readonly status?: number | string;
  readonly attemptNumber?: number;
  readonly attemptCount?: number;
  readonly actionPending?: number;
  readonly nextReportSequence?: number;
  readonly pendingReportCount?: number;
  readonly sendPaused?: boolean;
  readonly bindingIdentityPresent?: boolean;
  readonly contextIdentityPresent?: boolean;
  readonly persistenceStatus?: string;
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
  readonly sessionId?: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly reportId?: string;
  readonly taskId?: string;
  readonly selectorName?: string;
  readonly budgetMs?: number;
  readonly closeCode?: number;
  readonly messageCount?: number;
  readonly limitBytes?: number;
  readonly messageBytes?: number;
  readonly pendingBytes?: number;
  readonly pendingMessages?: number;
  readonly messageType?: string;
  readonly pendingMessageType?: string;
  readonly messageIdFamily?: string;
  readonly pendingMessageIdFamily?: string;
  readonly topicKey?: string;
  readonly existingSubscription?: boolean;
  readonly connectionReady?: boolean;
  readonly connectionPresent?: boolean;
  readonly matchingSubscriptionPresent?: boolean;
  readonly pendingNotificationPresent?: boolean;
  readonly persistedSubscriptionCount?: number;
  readonly subscriptionCount?: number;
  readonly dispatchStatus?: string;
  readonly actorStatus?: string;
  readonly resultStatus?: string;
  readonly resultReason?: string;
  readonly reportState?: string;
  readonly reportReason?: string;
  readonly cursorPresent?: boolean;
  readonly collectionHashPresent?: boolean;
  readonly pageLimit?: number;
  readonly actorCount?: number;
  readonly pathParameterCount?: number;
  readonly queryParameterCount?: number;
  readonly resultKind?: string;
  readonly failureCategory?: string;
  readonly resultCode?: string;
  readonly contextReady?: boolean;
  readonly contentReady?: boolean;
  readonly connectionStatus?: string;
  readonly snapshotStatus?: string;
  readonly sliceName?: string;
  readonly direction?: string;
  readonly codec?: string;
  readonly syncEntryCount?: number;
  readonly primaryContainerCount?: number;
  readonly secondaryContainerCount?: number;
  readonly errorCode?: string;
  readonly itemCount?: number;
  readonly contextPresent?: boolean;
  readonly selectedSpacePresent?: boolean;
  readonly activationActive?: boolean;
  readonly activationIdentityPresent?: boolean;
  readonly activationWorkspacePresent?: boolean;
  readonly runtimeIdPresent?: boolean;
  readonly readinessBindingPresent?: boolean;
  readonly readinessBindingMatchesActivation?: boolean;
  readonly storeFlushed?: boolean;
  readonly projectFlushed?: boolean;
  readonly organizationPathPresent?: boolean;
  readonly projectRefMatchesPath?: boolean;
  readonly storeStatus?: string;
  readonly projectStatus?: string;
  readonly localMode?: string;
  readonly operation?: string;
  readonly transition?: string;
}>;

const safeToken = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[A-Za-z0-9_.: -]{1,100}$/u.test(value) ? value.replaceAll(' ', '_') : undefined;

const safeUuid = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)
    ? value.toLowerCase()
    : undefined;

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

const terminalOwnerEvents: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  'terminal.data.read': new Set([
    'terminal-read-rejected',
    'terminal-read-http.begin',
    'terminal-read-http.response',
    'terminal-read-response-accept.begin',
    'terminal-read-response-accept.completed',
    'terminal-read-completed',
    'terminal-read-threw',
  ]),
  'terminal.data.topic-subscription': new Set([
    'terminal-topic-subscribe.begin',
    'terminal-topic-subscribe.completed',
    'terminal-topic-subscribe.failed',
    'terminal-topic-subscribe.frame-send.begin',
    'terminal-topic-subscribe.frame-send.completed',
    'terminal-topic-subscribe.frame-send.failed',
    'terminal-topic-subscribe.persist.begin',
    'terminal-topic-subscribe.persist.readback',
    'terminal-topic-subscribe.rejected',
  ]),
  'terminal.update.download-grant': new Set(['download-grant-completed']),
  'terminal.update.report': new Set(['report-submit-completed', 'report-submit-rejected']),
  'terminal.connection.heartbeat': new Set([
    'heartbeat-consumer-completed',
    'heartbeat-consumer-not-completed',
    'heartbeat-consumer-rejected',
    'heartbeat-pong-matched',
  ]),
  'terminal.project-basic.read': new Set([
    'owner-read-started',
    'owner-read-completed',
    'owner-read-threw',
    'organization-refresh-failed',
    'rules-snapshot-failed',
    'topic-notification-accept-failed',
    'rules-snapshot-ready',
    'terminal-update-request-started',
    'terminal-update-requested',
    'organization-load-started',
    'organization-load-complete',
  ]),
  'terminal.update.lifecycle': new Set([
    'task-state-persisted',
    'task-state-persist-failed',
    'report-descriptor-persisted',
    'report-descriptor-persist-failed',
    'report-submit-started',
    'report-submit-returned',
    'artifact-apply-started',
    'artifact-apply-threw',
    'artifact-apply-returned',
    'update-facts-read-returned',
    'download-grant-request-started',
    'download-grant-request-returned',
    'fixed-task-context-not-ready',
    'target-admission-rejected',
    'target-revalidation-rejected',
    'artifact-prepare-started',
    'artifact-prepare-threw',
    'artifact-prepare-returned',
  ]),
  'terminal-update.primary-ready': new Set([
    'terminal-update.primary-ready-received',
    'terminal-update.primary-ready-continuation-result',
    'terminal-update.primary-ready-continuation-failed',
  ]),
  'terminal.credential.readiness': new Set([
    'credential-readiness-reconcile-failed',
    'credential-readiness-persistence-failed',
  ]),
  'terminal.credential.unpair': new Set(['shared-credential-clear-persistence-failed']),
  'terminal.topology.credential': new Set(['slave-credential-transition-blocked']),
  'terminal.project-basic.update': new Set(['terminal.project-basic.update.evaluation-dispatch-failed']),
  'admin.topology': new Set([
    'admin.topology-operation-started',
    'admin.topology-operation-completed',
    'admin.topology-operation-failed',
  ]),
  'topology.pairing': new Set([
    'topology.pairing.identity-failed',
    'topology.pairing.failed',
    'topology.pairing.completed',
    'topology.pairing.started',
    'topology.pairing.instance-mode-completed',
    'topology.pairing.display-role-completed',
    'topology.pairing.persistence-completed',
    'topology.pairing.runtime-reset-accepted',
  ]),
  'topology.unpairing': new Set([
    'topology.unpairing.wire-notice-sent',
    'topology.unpairing.persistence-failed',
    'topology.unpairing.persistence-completed',
    'topology.unpairing.started',
    'topology.unpairing.display-role-completed',
    'topology.unpairing.instance-mode-completed',
    'topology.unpairing.host-stop-completed',
    'topology.unpairing.completed',
    'topology.unpairing.failed',
  ]),
  'topology.peer': new Set([
    'topology.peer.frame-sent',
    'topology.peer.frame-received',
    'topology.peer.hello-accepted-accepted',
    'topology.peer.hello-accepted-rejected',
    'topology.peer.session-installed',
    'topology.peer.hello-rejected-received',
    'topology.peer.closed-error-received',
    'topology.peer.send-rejected',
    'topology.peer.reconnect-scheduled',
    'topology.peer.command-result-received',
    'topology.peer.state-full-transfer-planned',
    'topology.peer.state-full-transfer-failed',
    'topology.peer.state-full-ignored',
    'topology.peer.state-full-rejected',
    'topology.peer.state-full-applied',
  ]),
});

const ownerLogTextFields = [
  'commandId',
  'requestId',
  'correlationId',
  'operationId',
  'reportId',
  'taskId',
  'actionId',
  'attemptId',
  'artifactKind',
  'sourceKind',
  'resultKind',
  'errorCode',
  'code',
  'resultStatus',
  'dispatchStatus',
  'topicKey',
  'portStatus',
  'actionState',
  'taskPhase',
  'recentState',
  'reportState',
  'reasonCode',
  'phase',
  'snapshotStatus',
  'storeStatus',
  'projectStatus',
  'persistenceStatus',
  'messageType',
  'localMode',
  'operation',
  'transition',
  'outcome',
  'status',
] as const;
const ownerLogNumberFields = [
  'elapsedMs',
  'status',
  'itemCount',
  'attempt',
  'attemptNumber',
  'attemptCount',
  'actionPending',
  'reportSequence',
  'subscriptionCount',
  'persistedSubscriptionCount',
  'pageLimit',
  'candidateCount',
  'revision',
  'lastReceivedRevision',
  'encodedBytes',
  'frameCount',
  'syncEntryCount',
  'primaryContainerCount',
  'secondaryContainerCount',
  'nextReportSequence',
  'pendingReportCount',
] as const;
const ownerLogBooleanFields = [
  'candidatePresent',
  'actualPresent',
  'embeddedPresent',
  'collectionHashPresent',
  'contextReady',
  'contentReady',
  'matchingSubscriptionPresent',
  'connectionReady',
  'connectionPresent',
  'retryable',
  'willRetry',
  'persisted',
  'deterministic',
  'changed',
  'sendPaused',
  'bindingIdentityPresent',
  'contextIdentityPresent',
  'targetValid',
  'targetMatches',
  'ruleMatches',
  'collectionMatches',
  'applicationMatches',
  'fullArtifactMatches',
  'hotArtifactMatches',
  'policyMatches',
  'strategyMatches',
  'selectionMatches',
  'createdAtMatches',
  'contextIdentityMatches',
  'bindingIdentityMatches',
  'taskIdPresent',
  'taskMatchesCurrentTask',
  'taskMatchesRecentStatus',
  'receiptTaskIdPresent',
  'receiptTaskMatchesPayload',
  'receiptSequenceMatchesPayload',
] as const;

/** Safe projection shared by Web console capture and Android logcat capture. Raw messages, URLs and payloads are omitted. */
export const projectTerminalAutomationAppEvent = (value: unknown): RuntimeFailureDiagnostic | null => {
  const event = record(value);
  const category = safeToken(event?.category);
  const name = safeToken(event?.event);
  const allowed = category === undefined ? undefined : terminalOwnerEvents[category];
  const data = record(event?.data);
  if (!category || !name || !allowed?.has(name) || !data) return null;
  const context = record(event?.context);
  const projected: Record<string, string | number | boolean> = {category, event: name};
  const level = safeToken(event?.level);
  if (level !== undefined && ['debug', 'info', 'warn', 'error'].includes(level)) projected.level = level;
  for (const key of ['commandId', 'requestId', 'sessionId'] as const) {
    const token = safeToken(context?.[key]);
    if (token !== undefined) projected[key] = token;
  }
  for (const key of ownerLogTextFields) {
    const token = safeToken(data[key]);
    if (token === undefined) continue;
    if (key === 'reportId' && safeUuid(data[key]) === undefined) continue;
    if (['errorCode', 'code', 'reasonCode'].includes(key) && !/^[A-Z0-9_:-]{1,100}$/u.test(token)) continue;
    if (
      category === 'topology.peer' &&
      key === 'messageType' &&
      ![
        'hello',
        'hello-accepted',
        'hello-rejected',
        'command-request',
        'command-result',
        'command-cancel',
        'state-full-chunk',
        'ping',
        'pong',
        'closed-error',
      ].includes(token)
    )
      continue;
    if (category === 'topology.peer' && key === 'localMode' && !['MASTER', 'SLAVE'].includes(token)) continue;
    projected[key] = token;
  }
  if (category === 'topology.peer') {
    const sliceName = safeToken(data.sliceName);
    if (sliceName !== undefined && /^[A-Za-z0-9_.:-]{1,100}$/u.test(sliceName)) projected.sliceName = sliceName;
    const direction = safeToken(data.direction);
    if (direction === 'master-to-slave' || direction === 'slave-to-master') projected.direction = direction;
    const codec = safeToken(data.codec);
    if (codec !== undefined && /^[A-Za-z0-9_.:-]{1,100}$/u.test(codec)) projected.codec = codec;
    const reason = safeToken(data.reason);
    if (reason !== undefined && /^[A-Za-z0-9_.:-]{1,100}$/u.test(reason)) projected.resultReason = reason;
  }
  for (const key of ownerLogNumberFields) {
    const number = safeNumber(data[key]);
    if (number !== undefined) projected[key] = number;
  }
  for (const key of ownerLogBooleanFields) {
    const boolean = safeBoolean(data[key]);
    if (boolean !== undefined) projected[key] = boolean;
  }
  return Object.freeze(projected) as RuntimeFailureDiagnostic;
};

const projectTerminalAutomationAppLine = (line: string): RuntimeFailureDiagnostic | null => {
  const match = line.match(/^[VDIWEF]\/ReactNativeJS\s*\(\s*\d+\):\s*(\{.*\})\s*$/u);
  if (!match) return null;
  try {
    return projectTerminalAutomationAppEvent(JSON.parse(match[1]!));
  } catch {
    return null;
  }
};

/** Project only non-sensitive rule-refresh and page-read progress emitted by the update owner. */
export const projectAndroidTerminalUpdateRuleLog = (line: string): RuntimeFailureDiagnostic | null => {
  const match = line.match(/^[VDIWEF]\/ReactNativeJS\s*\(\s*\d+\):\s*(\{.*\})\s*$/u);
  if (!match) return null;
  let value: unknown;
  try {
    value = JSON.parse(match[1]!);
  } catch {
    return null;
  }
  const event = record(value);
  const data = record(event?.data);
  const name = safeToken(event?.event);
  const acceptedEvents = new Set([
    'terminal-update.rules.context-gates',
    'terminal-update.rules.refresh-evaluated',
    'terminal-update.rules.refresh-readback',
    'terminal-update.rules.topic-subscribe.begin',
    'terminal-update.rules.topic-subscribe.readback',
    'terminal-update.rules.page-read.begin',
    'terminal-update.rules.page-read.readback',
    'terminal-update.rules.refresh-failed',
  ]);
  if (event?.category !== 'terminal-update.rules' || !acceptedEvents.has(name ?? '') || !data) return null;
  return Object.freeze({
    category: 'terminal-update.rules',
    event: name!,
    ...(safeToken(event.level) === undefined ? {} : {level: safeToken(event.level)}),
    ...(safeToken(data.topicKey) === undefined ? {} : {topicKey: safeToken(data.topicKey)}),
    ...(safeBoolean(data.existingSubscription) === undefined
      ? {}
      : {existingSubscription: safeBoolean(data.existingSubscription)}),
    ...(safeBoolean(data.matchingSubscriptionPresent) === undefined
      ? {}
      : {matchingSubscriptionPresent: safeBoolean(data.matchingSubscriptionPresent)}),
    ...(safeBoolean(data.pendingNotificationPresent) === undefined
      ? {}
      : {pendingNotificationPresent: safeBoolean(data.pendingNotificationPresent)}),
    ...(safeNumber(data.subscriptionCount) === undefined
      ? {}
      : {subscriptionCount: safeNumber(data.subscriptionCount)}),
    ...(safeToken(data.dispatchStatus) === undefined ? {} : {dispatchStatus: safeToken(data.dispatchStatus)}),
    ...(safeToken(data.actorStatus) === undefined ? {} : {actorStatus: safeToken(data.actorStatus)}),
    ...(safeToken(data.resultStatus) === undefined ? {} : {resultStatus: safeToken(data.resultStatus)}),
    ...(safeToken(data.resultReason) === undefined ? {} : {resultReason: safeToken(data.resultReason)}),
    ...(safeBoolean(data.cursorPresent) === undefined ? {} : {cursorPresent: safeBoolean(data.cursorPresent)}),
    ...(safeBoolean(data.collectionHashPresent) === undefined
      ? {}
      : {collectionHashPresent: safeBoolean(data.collectionHashPresent)}),
    ...(safeNumber(data.pageLimit) === undefined ? {} : {pageLimit: safeNumber(data.pageLimit)}),
    ...(safeNumber(data.actorCount) === undefined ? {} : {actorCount: safeNumber(data.actorCount)}),
    ...(safeToken(data.resultKind) === undefined ? {} : {resultKind: safeToken(data.resultKind)}),
    ...(safeToken(data.resultCode) === undefined ? {} : {resultCode: safeToken(data.resultCode)}),
    ...(safeBoolean(data.contextReady) === undefined ? {} : {contextReady: safeBoolean(data.contextReady)}),
    ...(safeToken(data.connectionStatus) === undefined ? {} : {connectionStatus: safeToken(data.connectionStatus)}),
    ...(safeToken(data.snapshotStatus) === undefined ? {} : {snapshotStatus: safeToken(data.snapshotStatus)}),
    ...(safeToken(data.errorCode) === undefined ? {} : {errorCode: safeToken(data.errorCode)}),
    ...(safeNumber(data.itemCount) === undefined ? {} : {itemCount: safeNumber(data.itemCount)}),
    ...(safeBoolean(data.contextPresent) === undefined ? {} : {contextPresent: safeBoolean(data.contextPresent)}),
    ...(safeBoolean(data.selectedSpacePresent) === undefined
      ? {}
      : {selectedSpacePresent: safeBoolean(data.selectedSpacePresent)}),
    ...(safeBoolean(data.activationActive) === undefined ? {} : {activationActive: safeBoolean(data.activationActive)}),
    ...(safeBoolean(data.activationIdentityPresent) === undefined
      ? {}
      : {activationIdentityPresent: safeBoolean(data.activationIdentityPresent)}),
    ...(safeBoolean(data.activationWorkspacePresent) === undefined
      ? {}
      : {activationWorkspacePresent: safeBoolean(data.activationWorkspacePresent)}),
    ...(safeBoolean(data.runtimeIdPresent) === undefined ? {} : {runtimeIdPresent: safeBoolean(data.runtimeIdPresent)}),
    ...(safeBoolean(data.readinessBindingPresent) === undefined
      ? {}
      : {readinessBindingPresent: safeBoolean(data.readinessBindingPresent)}),
    ...(safeBoolean(data.readinessBindingMatchesActivation) === undefined
      ? {}
      : {readinessBindingMatchesActivation: safeBoolean(data.readinessBindingMatchesActivation)}),
    ...(safeBoolean(data.storeFlushed) === undefined ? {} : {storeFlushed: safeBoolean(data.storeFlushed)}),
    ...(safeBoolean(data.projectFlushed) === undefined ? {} : {projectFlushed: safeBoolean(data.projectFlushed)}),
    ...(safeBoolean(data.organizationPathPresent) === undefined
      ? {}
      : {organizationPathPresent: safeBoolean(data.organizationPathPresent)}),
    ...(safeBoolean(data.projectRefMatchesPath) === undefined
      ? {}
      : {projectRefMatchesPath: safeBoolean(data.projectRefMatchesPath)}),
    ...(safeToken(data.storeStatus) === undefined ? {} : {storeStatus: safeToken(data.storeStatus)}),
    ...(safeToken(data.projectStatus) === undefined ? {} : {projectStatus: safeToken(data.projectStatus)}),
    ...(safeToken(data.failureName) === undefined ? {} : {failureName: safeToken(data.failureName)}),
  });
};

/** Project only non-sensitive terminal-data topic-subscription progress for Android failure summaries. */
export const projectAndroidTerminalTopicSubscriptionLog = (line: string): RuntimeFailureDiagnostic | null => {
  const match = line.match(/^[VDIWEF]\/ReactNativeJS\s*\(\s*\d+\):\s*(\{.*\})\s*$/u);
  if (!match) return null;
  let value: unknown;
  try {
    value = JSON.parse(match[1]!);
  } catch {
    return null;
  }
  const event = record(value);
  const data = record(event?.data);
  const name = safeToken(event?.event);
  const acceptedEvents = new Set([
    'terminal-topic-subscribe.begin',
    'terminal-topic-subscribe.rejected',
    'terminal-topic-subscribe.persist.begin',
    'terminal-topic-subscribe.persist.readback',
    'terminal-topic-subscribe.frame-send.begin',
    'terminal-topic-subscribe.frame-send.completed',
    'terminal-topic-subscribe.frame-send.failed',
    'terminal-topic-subscribe.completed',
    'terminal-topic-subscribe.failed',
  ]);
  if (event?.category !== 'terminal.data.topic-subscription' || !acceptedEvents.has(name ?? '') || !data) return null;
  return Object.freeze({
    category: 'terminal.data.topic-subscription',
    event: name!,
    ...(safeToken(event.level) === undefined ? {} : {level: safeToken(event.level)}),
    ...(safeToken(data.topicKey) === undefined ? {} : {topicKey: safeToken(data.topicKey)}),
    ...(safeToken(data.reason) === undefined ? {} : {reasonCode: safeToken(data.reason)}),
    ...(safeToken(data.resultStatus) === undefined ? {} : {resultStatus: safeToken(data.resultStatus)}),
    ...(safeBoolean(data.activationActive) === undefined ? {} : {activationActive: safeBoolean(data.activationActive)}),
    ...(safeBoolean(data.connectionReady) === undefined ? {} : {connectionReady: safeBoolean(data.connectionReady)}),
    ...(safeBoolean(data.connectionPresent) === undefined
      ? {}
      : {connectionPresent: safeBoolean(data.connectionPresent)}),
    ...(safeBoolean(data.existingSubscription) === undefined
      ? {}
      : {existingSubscription: safeBoolean(data.existingSubscription)}),
    ...(safeBoolean(data.matchingSubscriptionPresent) === undefined
      ? {}
      : {matchingSubscriptionPresent: safeBoolean(data.matchingSubscriptionPresent)}),
    ...(safeNumber(data.persistedSubscriptionCount) === undefined
      ? {}
      : {persistedSubscriptionCount: safeNumber(data.persistedSubscriptionCount)}),
  });
};

/** Project only operation names and classified outcomes for terminal HTTP reads. */
export const projectAndroidTerminalDataReadLog = (line: string): RuntimeFailureDiagnostic | null => {
  const match = line.match(/^[VDIWEF]\/ReactNativeJS\s*\(\s*\d+\):\s*(\{.*\})\s*$/u);
  if (!match) return null;
  let value: unknown;
  try {
    value = JSON.parse(match[1]!);
  } catch {
    return null;
  }
  const event = record(value);
  const data = record(event?.data);
  const name = safeToken(event?.event);
  const acceptedEvents = new Set([
    'terminal-read-rejected',
    'terminal-read-http.begin',
    'terminal-read-http.response',
    'terminal-read-response-accept.begin',
    'terminal-read-response-accept.completed',
    'terminal-read-completed',
    'terminal-read-threw',
  ]);
  if (event?.category !== 'terminal.data.read' || !acceptedEvents.has(name ?? '') || !data) return null;
  return Object.freeze({
    category: 'terminal.data.read',
    event: name!,
    ...(safeToken(event.level) === undefined ? {} : {level: safeToken(event.level)}),
    ...(safeToken(data.operationId) === undefined ? {} : {operationId: safeToken(data.operationId)}),
    ...(safeToken(data.code) === undefined ? {} : {failureCode: safeToken(data.code)}),
    ...(safeToken(data.resultKind) === undefined ? {} : {resultKind: safeToken(data.resultKind)}),
    ...(safeToken(data.failureCategory) === undefined ? {} : {failureCategory: safeToken(data.failureCategory)}),
    ...(safeToken(data.errorCode) === undefined ? {} : {failureCode: safeToken(data.errorCode)}),
    ...(safeNumber(data.status) === undefined ? {} : {status: safeNumber(data.status)}),
    ...(safeNumber(data.elapsedMs) === undefined ? {} : {elapsedMs: safeNumber(data.elapsedMs)}),
    ...(safeNumber(data.pathParameterCount) === undefined
      ? {}
      : {pathParameterCount: safeNumber(data.pathParameterCount)}),
    ...(safeNumber(data.queryParameterCount) === undefined
      ? {}
      : {queryParameterCount: safeNumber(data.queryParameterCount)}),
  });
};

/** Project classified report outcomes and safe correlation identity; omit credentials and request data. */
export const projectAndroidTerminalUpdateReportLog = (line: string): RuntimeFailureDiagnostic | null => {
  const match = line.match(/^[VDIWEF]\/ReactNativeJS\s*\(\s*\d+\s*\):\s*(\{.*\})\s*$/u);
  if (!match) return null;
  let value: unknown;
  try {
    value = JSON.parse(match[1]!);
  } catch {
    return null;
  }
  const event = record(value);
  const data = record(event?.data);
  const name = safeToken(event?.event);
  if (
    event?.category !== 'terminal.update.report' ||
    !['report-submit-rejected', 'report-submit-completed'].includes(name ?? '') ||
    !data
  )
    return null;
  return Object.freeze({
    category: 'terminal.update.report',
    event: name!,
    ...(safeToken(event.level) === undefined ? {} : {level: safeToken(event.level)}),
    ...(safeUuid(data.reportId) === undefined ? {} : {reportId: safeUuid(data.reportId)}),
    ...(safeUuid(data.taskId) === undefined ? {} : {taskId: safeUuid(data.taskId)}),
    ...(safeToken(data.requestId) === undefined ? {} : {requestId: safeToken(data.requestId)}),
    ...(safeToken(data.correlationId) === undefined ? {} : {correlationId: safeToken(data.correlationId)}),
    ...(typeof data.reportState === 'string' &&
    [
      'WAITING_USER',
      'DOWNLOADING',
      'VERIFYING',
      'INSTALLING',
      'APPLYING_HOT',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED',
      'UNKNOWN',
    ].includes(data.reportState)
      ? {reportState: data.reportState}
      : {}),
    ...(typeof data.reportReason === 'string' &&
    [
      'NONE',
      'NETWORK',
      'HTTP_REJECTED',
      'HASH_MISMATCH',
      'PREPARE_FAILED',
      'INSTALLER_CANCELLED',
      'INSTALL_FAILED',
      'HOT_APPLY_FAILED',
      'UNKNOWN',
    ].includes(data.reportReason)
      ? {reportReason: data.reportReason}
      : {}),
    ...(safeToken(data.resultKind) === undefined ? {} : {resultKind: safeToken(data.resultKind)}),
    ...(safeToken(data.failureCategory) === undefined ? {} : {failureCategory: safeToken(data.failureCategory)}),
    ...(safeToken(data.code) === undefined ? {} : {failureCode: safeToken(data.code)}),
    ...(safeToken(data.errorCode) === undefined ? {} : {failureCode: safeToken(data.errorCode)}),
    ...(safeNumber(data.status) === undefined ? {} : {status: safeNumber(data.status)}),
    ...(safeNumber(data.reportSequence) === undefined ? {} : {attemptNumber: safeNumber(data.reportSequence)}),
    ...(safeNumber(data.elapsedMs) === undefined ? {} : {elapsedMs: safeNumber(data.elapsedMs)}),
    ...(safeBoolean(data.taskIdPresent) === undefined ? {} : {taskIdPresent: safeBoolean(data.taskIdPresent)}),
    ...(safeBoolean(data.receiptTaskIdPresent) === undefined
      ? {}
      : {receiptTaskIdPresent: safeBoolean(data.receiptTaskIdPresent)}),
    ...(safeBoolean(data.receiptTaskMatchesPayload) === undefined
      ? {}
      : {receiptTaskMatchesPayload: safeBoolean(data.receiptTaskMatchesPayload)}),
    ...(safeBoolean(data.receiptSequenceMatchesPayload) === undefined
      ? {}
      : {receiptSequenceMatchesPayload: safeBoolean(data.receiptSequenceMatchesPayload)}),
    ...(safeToken(data.receiptOutcome) === undefined ? {} : {receiptOutcome: safeToken(data.receiptOutcome)}),
  });
};

/** Project only connection-health and local heartbeat-consumer outcomes. */
export const projectAndroidTerminalHeartbeatLog = (line: string): RuntimeFailureDiagnostic | null => {
  const match = line.match(/^[VDIWEF]\/ReactNativeJS\s*\(\s*\d+\s*\):\s*(\{.*\})\s*$/u);
  if (!match) return null;
  let value: unknown;
  try {
    value = JSON.parse(match[1]!);
  } catch {
    return null;
  }
  const event = record(value);
  const data = record(event?.data);
  const name = safeToken(event?.event);
  const acceptedEvents = new Set([
    'heartbeat-pong-matched',
    'heartbeat-consumer-completed',
    'heartbeat-consumer-not-completed',
    'heartbeat-consumer-rejected',
  ]);
  if (event?.category !== 'terminal.connection.heartbeat' || !acceptedEvents.has(name ?? '') || !data) return null;
  return Object.freeze({
    category: 'terminal.connection.heartbeat',
    event: name!,
    ...(safeToken(event.level) === undefined ? {} : {level: safeToken(event.level)}),
    ...(safeNumber(data.rttMs) === undefined ? {} : {rttMs: safeNumber(data.rttMs)}),
    ...(safeToken(data.dispatchStatus) === undefined ? {} : {dispatchStatus: safeToken(data.dispatchStatus)}),
    ...(safeNumber(data.consumerCount) === undefined ? {} : {consumerCount: safeNumber(data.consumerCount)}),
    ...(safeToken(data.actorStatus) === undefined ? {} : {actorStatus: safeToken(data.actorStatus)}),
    ...(safeToken(data.resultStatus) === undefined ? {} : {resultStatus: safeToken(data.resultStatus)}),
    ...(safeToken(data.code) === undefined ? {} : {failureCode: safeToken(data.code)}),
  });
};

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

/** Keep automation socket lifecycle metadata so Android session loss has an observable close code. */
export const projectAndroidAutomationConnectionLog = (line: string): RuntimeFailureDiagnostic | null => {
  const match = line.match(/^[VDIWEF]\/ReactNativeJS\s*\(\s*\d+\):\s*(\{.*\})\s*$/u);
  if (!match) return null;
  let value: unknown;
  try {
    value = JSON.parse(match[1]!);
  } catch {
    return null;
  }
  const event = record(value);
  const name = safeToken(event?.event);
  const level = safeToken(event?.level);
  if (
    event?.category !== 'automation.connection' ||
    ![
      'connection.opened',
      'connection.authenticated',
      'connection.closed',
      'connection.failed',
      'outbound.window.limit',
    ].includes(name ?? '') ||
    (level !== 'info' && level !== 'warn' && level !== 'error')
  )
    return null;
  const data = record(event?.data);
  const closeCode = safeNumber(data?.code);
  const messageCount = safeNumber(data?.pendingMessages);
  const reasonCode = safeToken(data?.reasonCode);
  const limitBytes = safeNumber(data?.limitBytes);
  const messageBytes = safeNumber(data?.messageBytes);
  const pendingBytes = safeNumber(data?.pendingBytes);
  const pendingMessages = safeNumber(data?.pendingMessages);
  const rawLimitReason = name === 'outbound.window.limit' ? data?.reason : undefined;
  const limitReason =
    typeof rawLimitReason === 'string' &&
    [
      'NON_TEXT_MESSAGE',
      'INVALID_JSON',
      'INVALID_MESSAGE_ID',
      'DUPLICATE_MESSAGE_ID',
      'MESSAGE_TOO_LARGE',
      'UNACKNOWLEDGED_WINDOW_FULL',
      'NATIVE_SEND_FAILED',
    ].includes(rawLimitReason)
      ? rawLimitReason
      : undefined;
  const messageType = name === 'outbound.window.limit' ? safeToken(data?.messageType) : undefined;
  const pendingMessageType = name === 'outbound.window.limit' ? safeToken(data?.pendingMessageType) : undefined;
  const messageIdFamily = name === 'outbound.window.limit' ? safeToken(data?.messageIdFamily) : undefined;
  const pendingMessageIdFamily = name === 'outbound.window.limit' ? safeToken(data?.pendingMessageIdFamily) : undefined;
  return Object.freeze({
    category: 'automation.connection',
    event: name!,
    level,
    ...(safeToken(data?.sessionId) === undefined ? {} : {sessionId: safeToken(data?.sessionId)}),
    ...(closeCode === undefined ? {} : {closeCode}),
    ...(reasonCode === undefined ? {} : {reasonCode}),
    ...(messageCount === undefined ? {} : {messageCount}),
    ...(limitReason === undefined ? {} : {limitReason}),
    ...(limitBytes === undefined ? {} : {limitBytes}),
    ...(messageBytes === undefined ? {} : {messageBytes}),
    ...(pendingBytes === undefined ? {} : {pendingBytes}),
    ...(pendingMessages === undefined ? {} : {pendingMessages}),
    ...(messageType === undefined ? {} : {messageType}),
    ...(pendingMessageType === undefined ? {} : {pendingMessageType}),
    ...(messageIdFamily === undefined ? {} : {messageIdFamily}),
    ...(pendingMessageIdFamily === undefined ? {} : {pendingMessageIdFamily}),
  });
};

/** Retain only bounded selector failure metadata; selector arguments and values are never projected. */
export const projectAndroidAutomationSelectorFailureLog = (line: string): RuntimeFailureDiagnostic | null => {
  const match = line.match(/^[VDIWEF]\/ReactNativeJS\s*\(\s*\d+\):\s*(\{.*\})\s*$/u);
  if (!match) return null;
  let value: unknown;
  try {
    value = JSON.parse(match[1]!);
  } catch {
    return null;
  }
  const event = record(value);
  const data = record(event?.data);
  if (
    event?.category !== 'automation.selector' ||
    event.event !== 'selector.evaluation.failed' ||
    safeToken(event.level) !== 'warn' ||
    !data
  ) {
    return null;
  }
  const phase = safeToken(data.phase);
  if (!['evaluate', 'json-validation', 'json-stringify', 'message-size'].includes(phase ?? '')) return null;
  return Object.freeze({
    category: 'automation.selector',
    event: 'selector.evaluation.failed',
    level: 'warn',
    ...(safeToken(data.selectorName) === undefined ? {} : {selectorName: safeToken(data.selectorName)}),
    ...(safeToken(data.failureCode) === undefined ? {} : {failureCode: safeToken(data.failureCode)}),
    phase,
    ...(safeNumber(data.elapsedMs) === undefined ? {} : {elapsedMs: safeNumber(data.elapsedMs)}),
    ...(safeNumber(data.budgetMs) === undefined ? {} : {budgetMs: safeNumber(data.budgetMs)}),
  });
};

export const collectAndroidRuntimeFailureDiagnostics = (logcat: string): string =>
  logcat
    .split(/\r?\n/u)
    .map(
      line =>
        projectAndroidRuntimeFailureLog(line) ??
        projectAndroidTransportFailureLog(line) ??
        projectAndroidAutomationConnectionLog(line) ??
        projectAndroidAutomationSelectorFailureLog(line) ??
        projectAndroidTerminalUpdateRuleLog(line) ??
        projectAndroidTerminalTopicSubscriptionLog(line) ??
        projectAndroidTerminalHeartbeatLog(line) ??
        projectAndroidTerminalUpdateReportLog(line) ??
        projectAndroidTerminalDataReadLog(line) ??
        projectTerminalAutomationAppLine(line),
    )
    .filter((value): value is RuntimeFailureDiagnostic => value !== null)
    .map(value => JSON.stringify(value))
    .join('\n');

/** Return only native remote-control event names and counts; never retain log fields or payloads. */
export const collectAndroidRemoteControlDiagnostics = (
  logcat: string,
): Readonly<{lineCount: number; eventKinds: readonly string[]}> => {
  const events = new Set<string>();
  let lineCount = 0;
  for (const line of logcat.split(/\r?\n/u)) {
    const match = line.match(/^[VDIWEF]\/(?:TerminalRemote|TerminalRemoteCapture)\s*\(\s*\d+\s*\):\s*event=([A-Za-z0-9._-]{1,96})\b/u);
    if (match === null) continue;
    lineCount += 1;
    events.add(match[1]!);
  }
  return Object.freeze({lineCount, eventKinds: Object.freeze([...events].slice(-30))});
};

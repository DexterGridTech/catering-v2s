import {createRequestId, nowTimestampMs, topologyLateResultMaxTtlMs} from '@catering-v2s/kernel-base-contracts';
import {type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {selectConnectionState, type TerminalDataHeartbeatPayload} from '@catering-v2s/kernel-base-terminal-data-client';
import {terminalUpdateActions} from '../../slices/terminalUpdate';
import {
  actualVersionObservationFactsKey,
  createReportPayload,
  createStatus,
} from '../../../foundations/updateDecisions';
import {createOwnerHttpClient} from './createOwnerHttpClient';
import type {TerminalUpdateExecution} from './createTerminalUpdateExecution';
import type {
  TerminalUpdateRecentStatus,
  TerminalUpdateState,
  TerminalUpdateTask,
  TerminalUpdateContextFacts,
} from '../../../types/terminalUpdate';

type ReportContext = ActorExecutionContext;
type BindingIdentity = Readonly<{identity: string; generation: number}> | null;
type RuleContext = Readonly<{facts: TerminalUpdateContextFacts; identity: string}> | null;
type ReportOwnerInput = Readonly<{
  actions: typeof terminalUpdateActions;
  execution: TerminalUpdateExecution;
  createProtocolUuid: () => string;
  readState: (context: ReportContext) => TerminalUpdateState;
  persist: (context: ReportContext) => Promise<boolean>;
  currentBindingIdentity: (context: ReportContext) => BindingIdentity;
  currentRuleContext: (context: ReportContext) => RuleContext;
  logLifecycle: (
    context: ReportContext,
    event: string,
    data: Readonly<Record<string, string | number | boolean | null>>,
  ) => void;
  logLifecycleAtLevel: (
    context: ReportContext,
    input: Readonly<{
      event: string;
      data: Readonly<Record<string, string | number | boolean | null>>;
      level: 'info' | 'warn';
    }>,
  ) => void;
}>;

export const createTerminalUpdateReportOwner = ({
  actions,
  execution,
  createProtocolUuid,
  readState,
  persist,
  currentBindingIdentity,
  currentRuleContext,
  logLifecycle,
  logLifecycleAtLevel,
}: ReportOwnerInput) => {
  const emptyReportDescriptor = (
    bindingIdentity: string | null,
    contextIdentity: string | null = null,
    nextReportSequence = 1,
  ): TerminalUpdateState['reportDescriptor'] =>
    Object.freeze({
      bindingIdentity,
      contextIdentity,
      nextReportSequence,
      lastObservationFactsKey: null,
      pendingReports: Object.freeze({}),
      sendPaused: false,
      latestDeliveryFailure: null,
    });
  const reportDescriptorForContext = (
    previous: TerminalUpdateState['reportDescriptor'],
    bindingIdentity: string,
    contextIdentity: string,
  ): TerminalUpdateState['reportDescriptor'] => {
    if (previous.bindingIdentity !== bindingIdentity) return emptyReportDescriptor(bindingIdentity, contextIdentity);
    if (previous.contextIdentity === contextIdentity) return previous;
    // A project/context change invalidates pending bodies, but report sequence is
    // scoped to the binding cycle and must remain monotonic for CBS uniqueness.
    return emptyReportDescriptor(bindingIdentity, contextIdentity, previous.nextReportSequence);
  };
  const writeReportDescriptor = async (
    context: ActorExecutionContext,
    descriptor: TerminalUpdateState['reportDescriptor'],
  ): Promise<boolean> => {
    const previous = readState(context).reportDescriptor;
    context.dispatchAction(actions.replaceReportDescriptor(descriptor));
    const persistStartedAt = Date.now();
    const persistResult = await context.flushPersistence();
    const persisted = persistResult.status === 'succeeded';
    logLifecycleAtLevel(context, {
      event: persisted ? 'report-descriptor-persisted' : 'report-descriptor-persist-failed',
      data: {
        nextReportSequence: descriptor.nextReportSequence,
        pendingReportCount: Object.keys(descriptor.pendingReports).length,
        sendPaused: descriptor.sendPaused,
        bindingIdentityPresent: descriptor.bindingIdentity !== null,
        contextIdentityPresent: descriptor.contextIdentity !== null,
        persistenceStatus: persistResult.status,
        elapsedMs: Math.max(0, Date.now() - persistStartedAt),
      },
      level: persisted ? 'info' : 'warn',
    });
    if (persisted) return true;
    context.dispatchAction(actions.replaceReportDescriptor(previous));
    return false;
  };
  const writeTaskWithOptions = async (
    options: Readonly<{
      context: ActorExecutionContext;
      task: TerminalUpdateTask | null;
      status: TerminalUpdateState['recentStatus'];
      initialObservation?: boolean;
    }>,
  ): Promise<boolean> => {
    const {context, task, status, initialObservation = false} = options;
    const before = readState(context);
    const binding = currentBindingIdentity(context);
    const identity = binding?.identity ?? null;
    const previousDescriptor = before.reportDescriptor ?? emptyReportDescriptor(null);
    const associatedTask = initialObservation
      ? null
      : (task ?? (before.currentTask?.taskId === status.taskId ? before.currentTask : null));
    const reportContextIdentity =
      associatedTask?.target.selectionContext.contextIdentity ?? currentRuleContext(context)?.identity ?? null;
    let descriptor =
      identity === null || reportContextIdentity === null
        ? previousDescriptor.bindingIdentity === identity
          ? previousDescriptor
          : emptyReportDescriptor(identity, reportContextIdentity)
        : reportDescriptorForContext(previousDescriptor, identity, reportContextIdentity);
    if (descriptor.contextIdentity === null && reportContextIdentity !== null)
      descriptor = Object.freeze({...descriptor, contextIdentity: reportContextIdentity});
    const recent: TerminalUpdateRecentStatus = Object.freeze({
      ...status,
      applicationId:
        associatedTask?.target.applicationId ??
        status.applicationId ??
        (initialObservation ? null : (before.recentStatus.applicationId ?? null)),
      ruleRef:
        associatedTask !== null
          ? associatedTask.target.ruleRef
          : Object.hasOwn(status, 'ruleRef')
            ? (status.ruleRef ?? null)
            : initialObservation
              ? null
              : (before.recentStatus.ruleRef ?? null),
      fullArtifactRef:
        associatedTask !== null
          ? (associatedTask.target.full?.artifactRef ?? null)
          : Object.hasOwn(status, 'fullArtifactRef')
            ? (status.fullArtifactRef ?? null)
            : initialObservation
              ? null
              : (before.recentStatus.fullArtifactRef ?? null),
      hotArtifactRef:
        associatedTask !== null
          ? (associatedTask.target.hot?.artifactRef ?? null)
          : Object.hasOwn(status, 'hotArtifactRef')
            ? (status.hotArtifactRef ?? null)
            : initialObservation
              ? null
              : (before.recentStatus.hotArtifactRef ?? null),
    });
    const unchangedRecent =
      before.recentStatus.taskId === recent.taskId &&
      before.recentStatus.state === recent.state &&
      before.recentStatus.reason === recent.reason &&
      before.recentStatus.applicationId === recent.applicationId &&
      before.recentStatus.ruleRef === recent.ruleRef &&
      before.recentStatus.fullArtifactRef === recent.fullArtifactRef &&
      before.recentStatus.hotArtifactRef === recent.hotArtifactRef;
    const stableRecent = unchangedRecent
      ? Object.freeze({...recent, changedAt: before.recentStatus.changedAt})
      : recent;
    const observationFactsKey =
      initialObservation && before.actualVersions !== null
        ? actualVersionObservationFactsKey(before.actualVersions)
        : null;
    const report =
      identity === null ||
      (unchangedRecent && !initialObservation) ||
      (initialObservation && observationFactsKey !== null && descriptor.lastObservationFactsKey === observationFactsKey)
        ? null
        : createReportPayload({
            reportId: createProtocolUuid(),
            sequence: descriptor.nextReportSequence,
            task: associatedTask,
            actual: before.actualVersions,
            status: stableRecent,
          });
    if (report !== null) {
      const key = recent.taskId ?? 'observation';
      descriptor = Object.freeze({
        ...descriptor,
        nextReportSequence: descriptor.nextReportSequence + 1,
        ...(initialObservation && observationFactsKey !== null ? {lastObservationFactsKey: observationFactsKey} : {}),
        pendingReports: Object.freeze({...descriptor.pendingReports, [key]: report}),
      });
    }
    context.dispatchAction(actions.replaceTask(task));
    context.dispatchAction(actions.replaceRecentStatus(stableRecent));
    context.dispatchAction(actions.replaceReportDescriptor(descriptor));
    const invitation = before.invitation ?? null;
    const actualBootId = before.actualVersions?.bootId ?? null;
    if (
      invitation !== null &&
      (task?.taskId !== invitation.taskId ||
        task.actionId !== invitation.actionId ||
        actualBootId !== invitation.bootId ||
        status.state !== 'waiting-user')
    )
      context.dispatchAction(actions.replaceInvitation(null));
    if (await persist(context)) return true;
    context.dispatchAction(actions.replaceTask(before.currentTask));
    context.dispatchAction(actions.replaceRecentStatus(before.recentStatus));
    context.dispatchAction(actions.replaceReportDescriptor(previousDescriptor));
    context.dispatchAction(actions.replaceInvitation(invitation));
    return false;
  };
  const writeTask = async (
    context: ActorExecutionContext,
    task: TerminalUpdateTask | null,
    status: TerminalUpdateState['recentStatus'],
  ): Promise<boolean> => writeTaskWithOptions({context, task, status});
  const writeInitialObservation = async (context: ActorExecutionContext): Promise<boolean> =>
    writeTaskWithOptions({context, task: null, status: createStatus(null, 'idle', null), initialObservation: true});

  const sendPendingReport = async (context: ActorExecutionContext, signal: TerminalDataHeartbeatPayload) => {
    const checkedAt = nowTimestampMs();
    if (execution.reportSendInFlight !== null && execution.reportSendInFlight.expiresAt > checkedAt)
      return Object.freeze({status: 'in-flight'});
    execution.reportSendInFlight = null;
    const binding = currentBindingIdentity(context);
    if (binding === null || binding.generation !== signal.bindingGeneration)
      return Object.freeze({status: 'stale-binding'});
    const current = currentRuleContext(context);
    const state = readState(context);
    const existingDescriptor = state.reportDescriptor ?? emptyReportDescriptor(null);
    if (current === null && existingDescriptor.contextIdentity !== null)
      return Object.freeze({status: 'context-not-ready'});
    if (current !== null && existingDescriptor.contextIdentity !== current.identity) {
      const next = reportDescriptorForContext(existingDescriptor, binding.identity, current.identity);
      context.dispatchAction(actions.replaceReportDescriptor(next));
      if (!(await persist(context))) {
        context.dispatchAction(actions.replaceReportDescriptor(existingDescriptor));
        return Object.freeze({status: 'context-reset-flush-failed'});
      }
      if (Object.keys(existingDescriptor.pendingReports).length > 0 || existingDescriptor.sendPaused)
        return Object.freeze({status: 'context-reset'});
    }
    const connection = selectConnectionState(context.getState());
    if (connection.status !== 'connected' || connection.sessionId !== signal.sessionId)
      return Object.freeze({status: 'stale-connection'});
    const descriptor = readState(context).reportDescriptor ?? emptyReportDescriptor(null);
    if (descriptor.bindingIdentity !== binding.identity) {
      context.dispatchAction(actions.replaceReportDescriptor(emptyReportDescriptor(binding.identity)));
      return Object.freeze({status: (await persist(context)) ? 'binding-reset' : 'persistence-failed'});
    }
    if (descriptor.sendPaused) return Object.freeze({status: 'paused'});
    const first = Object.entries(descriptor.pendingReports).sort(
      (a, b) => a[1].body.reportSequence - b[1].body.reportSequence,
    )[0];
    if (first === undefined) return Object.freeze({status: 'empty'});
    const [key, payload] = first;
    const attemptId = ++execution.nextReportSendAttemptId;
    execution.reportSendInFlight = Object.freeze({attemptId, expiresAt: checkedAt + topologyLateResultMaxTtlMs});
    let dispatchTimedOut = false;
    const reportStartedAt = Date.now();
    logLifecycle(context, 'report-submit-started', {
      attemptId,
      reportSequence: payload.body.reportSequence,
      reportState: payload.body.recent.state,
      taskIdPresent: payload.body.taskId !== null,
      taskMatchesCurrentTask: payload.body.taskId !== null && payload.body.taskId === state.currentTask?.taskId,
      taskMatchesRecentStatus: payload.body.taskId === state.recentStatus.taskId,
    });
    try {
      const result = await createOwnerHttpClient(context, context.command.requestId ?? createRequestId(), {
        lateResultTtlMs: topologyLateResultMaxTtlMs,
        lateOutcome: () => {
          if (execution.reportSendInFlight?.attemptId === attemptId) execution.reportSendInFlight = null;
        },
      }).submitTerminalUpdateReport({
        pathParameters: {},
        queryParameters: {},
        headers: {'Idempotency-Key': payload.idempotencyKey},
        body: payload.body,
      });
      const reportResultKind = result.kind;
      const reportReceipt = result.kind === 'success' ? result.body : null;
      logLifecycleAtLevel(context, {
        event: 'report-submit-returned',
        data: {
          attemptId,
          reportSequence: payload.body.reportSequence,
          resultKind: reportResultKind,
          receiptTaskIdPresent: reportReceipt !== null && reportReceipt.taskId !== null,
          receiptTaskMatchesPayload: reportReceipt !== null && reportReceipt.taskId === payload.body.taskId,
          receiptSequenceMatchesPayload:
            reportReceipt !== null && reportReceipt.acceptedSequence === payload.body.reportSequence,
          receiptOutcome:
            reportReceipt !== null && typeof reportReceipt.outcome === 'string' ? reportReceipt.outcome : 'UNAVAILABLE',
          elapsedMs: Math.max(0, Date.now() - reportStartedAt),
        },
        level: result.kind === 'success' ? 'info' : 'warn',
      });
      dispatchTimedOut = result.kind === 'failure' && result.code === 'TERMINAL_HTTP_COMMAND_TIMED_OUT';
      const currentBinding = currentBindingIdentity(context);
      const after = readState(context);
      const current = after.reportDescriptor ?? emptyReportDescriptor(null);
      if (
        currentBinding?.identity !== binding.identity ||
        current.bindingIdentity !== binding.identity ||
        current.pendingReports[key]?.idempotencyKey !== payload.idempotencyKey
      )
        return Object.freeze({status: 'stale-result'});
      if (
        result?.kind === 'success' &&
        result.body.reportId === payload.body.reportId &&
        result.body.taskId === payload.body.taskId &&
        (result.body.outcome === 'ACCEPTED'
          ? result.body.acceptedSequence === payload.body.reportSequence
          : result.body.acceptedSequence > payload.body.reportSequence)
      ) {
        const pendingReports = {...current.pendingReports};
        delete pendingReports[key];
        context.dispatchAction(
          actions.replaceReportDescriptor(Object.freeze({...current, pendingReports: Object.freeze(pendingReports)})),
        );
        if (await persist(context)) return Object.freeze({status: 'accepted'});
        context.dispatchAction(actions.replaceReportDescriptor(current));
        return Object.freeze({status: 'receipt-flush-failed'});
      }
      const rejectCurrentReport = async (reasonCode: string, pause: boolean) => {
        const pendingReports = {...current.pendingReports};
        if (!pause) delete pendingReports[key];
        context.dispatchAction(
          actions.replaceReportDescriptor(
            Object.freeze({
              ...current,
              pendingReports: Object.freeze(pendingReports),
              sendPaused: current.sendPaused || pause,
              latestDeliveryFailure: Object.freeze({
                taskId: payload.body.taskId,
                reportId: payload.body.reportId,
                reportSequence: payload.body.reportSequence,
                reasonCode,
                observedAt: nowTimestampMs(),
              }),
            }),
          ),
        );
        // A receipt flush failure is retryable because the server accepted the
        // report. A terminal rejection must stay non-sendable in this Runtime.
        return (await persist(context))
          ? Object.freeze({status: 'terminal-rejection'})
          : Object.freeze({status: 'rejection-flush-failed'});
      };
      if (result.kind === 'success') return rejectCurrentReport('REPORT_RESPONSE_INVALID', false);
      if (result.kind === 'business-rejection') {
        const identityRejected =
          result.status === 401 ||
          result.status === 403 ||
          result.errorCode === 'PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED' ||
          result.errorCode === 'PLATFORM_COMMON_ACCESS_DENIED';
        if (identityRejected) return rejectCurrentReport(result.errorCode || 'REPORT_IDENTITY_REJECTED', true);
        if (result.status >= 400 && result.status < 500)
          return rejectCurrentReport(
            result.status === 404 || result.status === 409 || result.status === 422
              ? result.errorCode
              : 'REPORT_SUBMISSION_INVALID',
            false,
          );
      }
      if (result.kind === 'failure') {
        if (result.status === 401 || result.status === 403)
          return rejectCurrentReport('REPORT_IDENTITY_REJECTED', true);
        if (result.code === 'INVALID_TERMINAL_UPDATE_REPORT')
          return rejectCurrentReport('REPORT_SUBMISSION_INVALID', false);
        if (result.code === 'TERMINAL_RESPONSE_SCHEMA_INVALID')
          return rejectCurrentReport('REPORT_RESPONSE_INVALID', false);
        if (result.status !== undefined && result.status < 500)
          return rejectCurrentReport('REPORT_SUBMISSION_INVALID', false);
      }
      return Object.freeze({status: 'retry-retained'});
    } finally {
      if (!dispatchTimedOut && execution.reportSendInFlight?.attemptId === attemptId)
        execution.reportSendInFlight = null;
    }
  };

  return Object.freeze({
    emptyReportDescriptor,
    reportDescriptorForContext,
    writeReportDescriptor,
    writeTask,
    writeInitialObservation,
    sendPendingReport,
  });
};

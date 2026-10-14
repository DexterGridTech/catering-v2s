import {createRequestId, nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {
  defineActor,
  type ActorExecutionContext,
  type ActorDefinition,
  selectLastLocalInteraction,
  selectRuntimeInstanceMode,
} from '@catering-v2s/kernel-base-runtime';
import {selectActivationState} from '@catering-v2s/kernel-base-terminal-data-client';
import type {UpdatePort} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName} from '../../moduleName';
import {terminalUpdateSliceName} from '../slices/terminalUpdate';
import {actualMatchesArtifact, actualVersionObservationFactsKey, createStatus, invalid} from '../../foundations/updateDecisions';
import {terminalUpdateActions} from '../slices/terminalUpdate';
import {createTerminalUpdateReportOwner} from './shared/createTerminalUpdateReportOwner';
import {createTerminalUpdateExecution} from './shared/createTerminalUpdateExecution';
import {installUpdateAdmissionCommands} from './shared/installUpdateAdmissionCommands';
import {installUpdateReportCommands} from './shared/installUpdateReportCommands';
import {installUpdateBootCommands} from './shared/installUpdateBootCommands';
import {installUpdateArtifactCommands} from './shared/installUpdateArtifactCommands';
import {createTerminalUpdateArtifactExecutor} from './shared/createTerminalUpdateArtifactExecutor';
import type {
  TerminalUpdateState,
  TerminalUpdateTask,
  CurrentUpdateTargetReader,
  UpdateNetworkSnapshotReader,
  UpdateTargetSourceProvider,
  TerminalUpdateContextFacts,
} from '../../types/terminalUpdate';

type TerminalUpdateActorInput = Readonly<{
  port: UpdatePort;
  createProtocolUuid: () => string;
  sourceProvider?: UpdateTargetSourceProvider;
  readCurrentTarget?: CurrentUpdateTargetReader;
  readTerminalUpdateContextFacts?: (
    state: ReturnType<ActorExecutionContext['getState']>,
  ) => TerminalUpdateContextFacts | null;
  readFixedTerminalUpdateContextFacts?: (
    state: ReturnType<ActorExecutionContext['getState']>,
  ) => TerminalUpdateContextFacts | null;
  actions?: typeof terminalUpdateActions;
  readNetworkSnapshot?: UpdateNetworkSnapshotReader;
}>;

const readState = (context: ActorExecutionContext): TerminalUpdateState => {
  const value = context.getState()[terminalUpdateSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid('STATE_MISSING');
  return value as TerminalUpdateState;
};
const persist = async (context: ActorExecutionContext): Promise<boolean> =>
  (await context.flushPersistence()).status === 'succeeded';
const writeLifecycleLog = (
  input: Readonly<{
    context: ActorExecutionContext;
    event: string;
    data: Readonly<Record<string, string | number | boolean | null>>;
    level: 'info' | 'warn';
  }>,
): void => {
  const {context, event, data, level} = input;
  const baseLogger = context.platformPorts.logger;
  const logger =
    typeof baseLogger.scope === 'function'
      ? baseLogger.scope({
          moduleName,
          layer: 'kernel',
          subsystem: 'terminal-update',
          component: 'update-lifecycle',
        })
      : baseLogger;
  const log = level === 'warn' ? logger.warn.bind(logger) : logger.info.bind(logger);
  log({
    category: 'terminal.update.lifecycle',
    event,
    message: 'Terminal update owner lifecycle boundary',
    context: {
      commandId: context.command.commandId,
      ...(context.command.requestId == null ? {} : {requestId: context.command.requestId}),
    },
    data,
  });
};
const logLifecycle = (
  context: ActorExecutionContext,
  event: string,
  data: Readonly<Record<string, string | number | boolean | null>>,
): void => writeLifecycleLog({context, event, data, level: 'info'});
const logLifecycleWarning = (
  context: ActorExecutionContext,
  event: string,
  data: Readonly<Record<string, string | number | boolean | null>>,
): void => writeLifecycleLog({context, event, data, level: 'warn'});
const logLifecycleAtLevel = (
  context: ActorExecutionContext,
  input: Readonly<{
    event: string;
    data: Readonly<Record<string, string | number | boolean | null>>;
    level: 'info' | 'warn';
  }>,
): void => writeLifecycleLog({...input, context});

export const createTerminalUpdateActor = (input: TerminalUpdateActorInput): ActorDefinition => {
  const {port, sourceProvider, readNetworkSnapshot} = input;
  const actions = input.actions ?? terminalUpdateActions;
  const execution = createTerminalUpdateExecution();
  const currentBindingIdentity = (
    context: ActorExecutionContext,
  ): Readonly<{identity: string; generation: number}> | null => {
    let activation: ReturnType<typeof selectActivationState>;
    try {
      activation = selectActivationState(context.getState());
    } catch {
      return null;
    }
    if (activation.status !== 'active' || activation.terminalRef === null || activation.bindingGeneration === null)
      return null;
    return Object.freeze({
      identity: `${activation.terminalRef}:${activation.bindingGeneration}`,
      generation: activation.bindingGeneration,
    });
  };
  const currentUpdateTargetBindingIdentity = (
    context: ActorExecutionContext,
  ): Readonly<{identity: string; generation: number}> | null => {
    let activation: ReturnType<typeof selectActivationState>;
    let instanceMode: ReturnType<typeof selectRuntimeInstanceMode>;
    try {
      const state = context.getState();
      activation = selectActivationState(state);
      instanceMode = selectRuntimeInstanceMode(state);
    } catch {
      return null;
    }
    const statusMatchesRole =
      (instanceMode === 'MASTER' && activation.status === 'active') ||
      (instanceMode === 'SLAVE' && activation.status === 'inactive');
    if (!statusMatchesRole || activation.terminalRef === null || activation.bindingGeneration === null) return null;
    return Object.freeze({
      identity: `${activation.terminalRef}:${activation.bindingGeneration}`,
      generation: activation.bindingGeneration,
    });
  };
  const currentRuleContext = (
    context: ActorExecutionContext,
    fixedTask = false,
  ): Readonly<{
    readonly facts: TerminalUpdateContextFacts;
    readonly identity: string;
  }> | null => {
    const contextReader = fixedTask
      ? (input.readFixedTerminalUpdateContextFacts ?? input.readTerminalUpdateContextFacts)
      : input.readTerminalUpdateContextFacts;
    const facts = contextReader?.(context.getState());
    if (
      facts === undefined ||
      facts === null ||
      !Number.isSafeInteger(facts.bindingGeneration) ||
      facts.bindingGeneration < 1 ||
      !Number.isSafeInteger(facts.projectUpdatedAtEpochMillis) ||
      facts.projectUpdatedAtEpochMillis < 0
    )
      return null;
    const identity = `${facts.terminalRef}:${facts.bindingGeneration}:${facts.selectedSpace}:${facts.storeRef}:${facts.projectRef}:${facts.projectUpdatedAtEpochMillis}`;
    return Object.freeze({facts, identity});
  };
  const reportOwner = createTerminalUpdateReportOwner({
    actions,
    execution,
    createProtocolUuid: input.createProtocolUuid,
    readState,
    persist,
    currentBindingIdentity,
    currentRuleContext,
    logLifecycle,
    logLifecycleAtLevel,
  });
  const {reportDescriptorForContext, writeReportDescriptor, writeTask, writeInitialObservation} = reportOwner;

  const artifactExecutor = createTerminalUpdateArtifactExecutor({
    actions,
    port,
    readState,
    writeTask,
    readNetworkSnapshot,
    sourceProvider,
    currentRuleContext,
    logLifecycle,
    logLifecycleWarning,
    logLifecycleAtLevel,
  });
  const {applyPreparedArtifact, recordFailedArtifact, releaseUnreferencedFullArtifact, executeNextArtifact} =
    artifactExecutor;

  const reconcile = async (context: ActorExecutionContext, resumeFixedTask: boolean) => {
    const result = await port.readFacts({timeoutMs: 10_000});
    if (result.status !== 'succeeded') return Object.freeze({status: 'unavailable', reason: result.status});
    context.dispatchAction(actions.replaceActualVersions(result.value.actual));
    const task = readState(context).currentTask;
    if (task === null) {
      const binding = currentBindingIdentity(context);
      const ruleContext = currentRuleContext(context);
      let descriptor = readState(context).reportDescriptor;
      const actual = result.value.actual;
      const currentDescriptor =
        binding !== null &&
        ruleContext !== null &&
        binding.identity === `${ruleContext.facts.terminalRef}:${ruleContext.facts.bindingGeneration}`
          ? reportDescriptorForContext(descriptor, binding.identity, ruleContext.identity)
          : descriptor;
      if (currentDescriptor !== descriptor) {
        if (!(await writeReportDescriptor(context, currentDescriptor)))
          return Object.freeze({status: 'persistence-failed', reason: 'REPORT_CONTEXT_PERSISTENCE_FAILED'});
        descriptor = currentDescriptor;
      }
      if (
        binding !== null &&
        ruleContext !== null &&
        binding.identity === `${ruleContext.facts.terminalRef}:${ruleContext.facts.bindingGeneration}` &&
        actual !== null &&
        typeof actual.applicationId === 'string' &&
        actual.applicationId.length > 0 &&
        descriptor.lastObservationFactsKey !== actualVersionObservationFactsKey(actual) &&
        !descriptor.sendPaused
      ) {
        if (!(await writeInitialObservation(context)))
          return Object.freeze({status: 'persistence-failed', reason: 'INITIAL_VERSION_REPORT_PERSISTENCE_FAILED'});
        return Object.freeze({status: 'read', observation: 'queued'});
      }
      return Object.freeze({status: 'read'});
    }
    if (
      (task.phase === 'succeeded' || task.phase === 'failed') &&
      result.value.actual !== null &&
      task.bootId !== null &&
      task.bootId !== result.value.actual.bootId
    ) {
      const recentStatus = readState(context).recentStatus;
      if (!(await writeTask(context, null, recentStatus)))
        return Object.freeze({status: 'persistence-failed', reason: 'TERMINAL_TASK_RELEASE_FAILED'});
      return Object.freeze({status: 'terminal-task-released', taskId: task.taskId});
    }
    if (task.phase === 'fixed' && task.actionId === null && !resumeFixedTask) {
      return Object.freeze({status: 'fixed', continuation: 'PRIMARY_READY'});
    }
    if (task.phase === 'waiting-idle') return Object.freeze({status: 'waiting-idle', taskId: task.taskId});
    if (task.actionId === null)
      return task.phase === 'fixed' ? executeNextArtifact(context, task) : Object.freeze({status: task.phase});
    const actionResult = await port.readAction({timeoutMs: 10_000, taskId: task.taskId, actionId: task.actionId});
    if (actionResult.status !== 'succeeded' || actionResult.value === null) {
      const reason =
        actionResult.status === 'failed' ? actionResult.error.code : `ACTION_${actionResult.status.toUpperCase()}`;
      context.dispatchAction(actions.replaceRecentStatus(createStatus(task.taskId, 'unknown', reason)));
      return Object.freeze({status: 'unknown', reason});
    }
    const action = actionResult.value;
    if (action.taskId !== task.taskId || action.actionId !== task.actionId) {
      context.dispatchAction(
        actions.replaceRecentStatus(createStatus(task.taskId, 'unknown', 'ACTION_IDENTITY_MISMATCH')),
      );
      return Object.freeze({status: 'unknown', reason: 'ACTION_IDENTITY_MISMATCH'});
    }
    const actionArtifact =
      task.actionKind === 'full' ? task.target.full : task.actionKind === 'hot' ? task.target.hot : null;
    if (actionArtifact === null || action.publicationId !== actionArtifact.artifact.publicationId) {
      const reason = 'ACTION_PUBLICATION_IDENTITY_MISMATCH';
      context.dispatchAction(actions.replaceRecentStatus(createStatus(task.taskId, 'unknown', reason)));
      return Object.freeze({status: 'unknown', reason});
    }
    if (action.state === 'succeeded' && !actualMatchesArtifact(result.value.actual, actionArtifact.artifact)) {
      const reason = result.value.actual === null ? 'ACTUAL_FACTS_UNAVAILABLE' : 'ACTION_SUCCESS_ACTUAL_VERSION_MISMATCH';
      const unknown = Object.freeze({...task, phase: 'unknown' as const, failureCode: reason});
      if (!(await writeTask(context, unknown, createStatus(task.taskId, 'unknown', reason))))
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_AFTER_ACTUAL_FACTS'});
      return Object.freeze({status: 'unknown', reason});
    }
    if (action.state === 'accepted') {
      // The native system accepted the action but has not reported a terminal
      // outcome. Preserve the task phase and action identity for the next real
      // readback; treating this as UNKNOWN loses the FULL→HOT continuation.
      await writeTask(context, task, createStatus(task.taskId, 'applying', null));
      return Object.freeze({status: 'applying', actionId: task.actionId, actionState: action.state});
    }
    const actualBootId = result.value.actual?.bootId ?? null;
    if (action.state === 'succeeded' && actualBootId === null) {
      const reason = 'ACTION_SUCCESS_BOOT_ID_UNAVAILABLE';
      const unknown = Object.freeze({...task, phase: 'unknown' as const, failureCode: reason});
      await writeTask(context, unknown, createStatus(task.taskId, 'unknown', reason));
      return Object.freeze({status: 'unknown', reason});
    }
    if (action.state === 'succeeded' && task.actionKind === 'full' && task.target.hot !== null) {
      if (task.originalBundleVersion == null) {
        const reason = 'ORIGINAL_BUNDLE_VERSION_UNAVAILABLE';
        const unknown = Object.freeze({...task, phase: 'unknown' as const, failureCode: reason});
        await writeTask(context, unknown, createStatus(task.taskId, 'unknown', reason));
        return Object.freeze({status: 'unknown', reason});
      }
      if (!(await releaseUnreferencedFullArtifact(task, action.publicationId))) {
        await writeTask(context, task, createStatus(task.taskId, 'unknown', 'PREPARED_RELEASE_FAILED'));
        return Object.freeze({status: 'cleanup-failed', reason: 'PREPARED_RELEASE_FAILED'});
      }
      const fixed = Object.freeze({
        ...task,
        phase: 'fixed' as const,
        actionId: null,
        actionKind: null,
        preparedId: null,
      });
      if (!(await writeTask(context, fixed, createStatus(task.taskId, 'fixed', null))))
        return Object.freeze({status: 'persistence-failed', taskId: task.taskId});
      if (!resumeFixedTask) {
        return Object.freeze({status: 'fixed', continuation: 'PRIMARY_READY'});
      }
      return executeNextArtifact(context, fixed);
    }
    if (action.state === 'failed') recordFailedArtifact(context, task, action.publicationId);
    const status =
      action.state === 'succeeded'
        ? ('succeeded' as const)
        : action.state === 'waiting-user' || action.state === 'user-cancelled'
          ? ('waiting-user' as const)
          : action.state === 'failed'
            ? ('failed' as const)
            : ('unknown' as const);
    const phase =
      action.state === 'succeeded'
        ? ('succeeded' as const)
        : action.state === 'waiting-user' || action.state === 'user-cancelled'
          ? ('waiting-user' as const)
          : action.state === 'failed'
            ? ('failed' as const)
            : ('unknown' as const);
    const isCompletedFullAction =
      task.target.full?.artifact.publicationId === action.publicationId &&
      (action.state === 'succeeded' || action.state === 'failed');
    if (isCompletedFullAction && !(await releaseUnreferencedFullArtifact(task, action.publicationId))) {
      await writeTask(context, task, createStatus(task.taskId, 'unknown', 'PREPARED_RELEASE_FAILED'));
      return Object.freeze({status: 'cleanup-failed', reason: 'PREPARED_RELEASE_FAILED'});
    }
    const updated = Object.freeze({
      ...task,
      phase,
      preparedId: isCompletedFullAction ? null : task.preparedId,
      failureCode: status === 'failed' ? action.reason : null,
    });
    await writeTask(context, updated, createStatus(task.taskId, status, action.reason));
    return Object.freeze({status, reason: action.reason, actionState: action.state});
  };

  const confirmBoot = async (
    context: ActorExecutionContext,
    payload: Readonly<{bootToken: string; publicationId: string}>,
  ) => {
    const current = readState(context);
    const actual = current.actualVersions;
    if (actual === null || actual.bootId !== payload.bootToken || actual.publicationId !== payload.publicationId)
      return Object.freeze({status: 'rejected', reason: 'BOOT_IDENTITY_NOT_CURRENT'});
    const task = current.currentTask;
    const result = await port.confirmBoot({
      timeoutMs: task?.target.strategy.bootTimeoutMs ?? 10_000,
      bootToken: payload.bootToken,
      publicationId: payload.publicationId,
    });
    if (result.status !== 'succeeded') {
      const reason = result.status === 'failed' ? result.error.code : `CONFIRM_${result.status.toUpperCase()}`;
      const reconciled = await reconcile(context, true);
      if (reconciled.status === 'failed') return reconciled;
      return Object.freeze({status: 'unknown', reason});
    }
    return reconcile(context, true);
  };

  const handleDeadline = async (
    context: ActorExecutionContext,
    payload: Readonly<{
      taskId: string;
      bootId: string;
      kind: 'hot-idle' | 'full-reminder';
      interactionRevision: number;
      deadlineAt: number;
      scheduleGeneration: number;
    }>,
  ) => {
    const current = readState(context);
    const task = current.currentTask;
    if (task === null || task.taskId !== payload.taskId || execution.currentPresentation !== 'foreground')
      return Object.freeze({status: 'stale-deadline'});
    const facts = await port.readFacts({timeoutMs: 10_000});
    if (facts.status !== 'succeeded' || facts.value.actual?.bootId !== payload.bootId)
      return Object.freeze({status: 'stale-boot'});
    const actual = facts.value.actual;
    context.dispatchAction(actions.replaceActualVersions(actual));

    if (payload.kind === 'hot-idle') {
      const mSeconds = task.target.policy.mSeconds;
      if (
        task.phase !== 'waiting-idle' ||
        task.actionKind !== 'hot' ||
        task.actionId === null ||
        task.preparedId === null ||
        task.target.hot === null ||
        task.target.policy.hotStrategy !== 'IDLE' ||
        mSeconds === null
      )
        return Object.freeze({status: 'stale-deadline'});
      const interaction = selectLastLocalInteraction(context.getState());
      const dueAt = interaction.lastClickAt + mSeconds * 1000;
      if (
        interaction.revision !== payload.interactionRevision ||
        dueAt !== payload.deadlineAt ||
        nowTimestampMs() < dueAt
      )
        return Object.freeze({status: 'rescheduled', reason: 'LOCAL_INTERACTION_CHANGED'});
      const ready = task.bootId === payload.bootId ? task : Object.freeze({...task, bootId: payload.bootId});
      if (ready !== task && !(await writeTask(context, ready, createStatus(task.taskId, 'waiting-idle', null))))
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_BEFORE_HOT_APPLY'});
      return applyPreparedArtifact(context, ready, {
        actionId: ready.actionId!,
        preparedId: ready.preparedId!,
        kind: 'hot',
        interactionRevision: payload.interactionRevision,
      });
    }

    const nSeconds = task.target.policy.nSeconds;
    if (
      task.phase !== 'waiting-user' ||
      task.actionKind !== 'full' ||
      task.actionId === null ||
      task.preparedId === null ||
      task.target.full === null
    )
      return Object.freeze({status: 'stale-deadline'});
    const lastInviteAt =
      task.lastInviteAt ??
      (current.recentStatus.taskId === task.taskId && current.recentStatus.state === 'waiting-user'
        ? current.recentStatus.changedAt
        : null);
    if (lastInviteAt === null) return Object.freeze({status: 'stale-deadline'});
    const dueAt = lastInviteAt + nSeconds * 1000;
    if (dueAt !== payload.deadlineAt || nowTimestampMs() < dueAt)
      return Object.freeze({status: 'rescheduled', reason: 'INVITATION_NOT_DUE'});
    const actionResult = await port.readAction({timeoutMs: 10_000, taskId: task.taskId, actionId: task.actionId});
    const action = actionResult.status === 'succeeded' ? actionResult.value : null;
    if (
      action === null ||
      action.taskId !== task.taskId ||
      action.actionId !== task.actionId ||
      action.publicationId !== task.target.full.artifact.publicationId
    ) {
      await writeTask(
        context,
        Object.freeze({...task, phase: 'unknown' as const}),
        createStatus(task.taskId, 'unknown', 'INSTALLER_STATE_UNAVAILABLE'),
      );
      return Object.freeze({status: 'readback-unknown'});
    }
    if (action.state === 'accepted') {
      await writeTask(
        context,
        Object.freeze({...task, phase: 'applying-full' as const}),
        createStatus(task.taskId, 'applying', null),
      );
      return Object.freeze({status: 'installing'});
    }
    if (action.state === 'unknown') {
      await writeTask(
        context,
        Object.freeze({...task, phase: 'unknown' as const}),
        createStatus(task.taskId, 'unknown', action.reason ?? 'INSTALLER_STATE_UNKNOWN'),
      );
      return Object.freeze({status: 'readback-unknown'});
    }
    if (action.state === 'succeeded' || action.state === 'failed') return reconcile(context, true);
    if (action.state !== 'waiting-user' && action.state !== 'user-cancelled')
      return Object.freeze({status: 'not-invitable'});
    const invited = Object.freeze({...task, lastInviteAt: nowTimestampMs()});
    if (!(await writeTask(context, invited, createStatus(task.taskId, 'waiting-user', action.reason))))
      return Object.freeze({status: 'persistence-failed', reason: 'INVITATION_TIME_PERSISTENCE_FAILED'});
    context.dispatchAction(
      actions.replaceInvitation({taskId: task.taskId, actionId: task.actionId, bootId: payload.bootId}),
    );
    return Object.freeze({status: 'invited', taskId: task.taskId});
  };

  const installDecisionIsCurrent = (
    context: ActorExecutionContext,
    payload: Readonly<{taskId: string; actionId: string | null; bootId: string}>,
  ): TerminalUpdateTask | null => {
    const {currentTask, invitation} = readState(context);
    const actual = readState(context).actualVersions;
    if (
      currentTask === null ||
      invitation === null ||
      invitation === undefined ||
      actual === null ||
      execution.currentPresentation !== 'foreground' ||
      invitation.taskId !== payload.taskId ||
      invitation.actionId !== payload.actionId ||
      invitation.bootId !== payload.bootId ||
      actual.bootId !== payload.bootId ||
      currentTask.taskId !== payload.taskId ||
      currentTask.actionId !== payload.actionId ||
      currentTask.phase !== 'waiting-user'
    )
      return null;
    return currentTask;
  };

  const confirmInstall = async (
    context: ActorExecutionContext,
    payload: Parameters<typeof installDecisionIsCurrent>[1],
  ) => {
    const task = installDecisionIsCurrent(context, payload);
    if (task === null) return Object.freeze({status: 'rejected', reason: 'INSTALL_INVITATION_STALE'});
    const actionId = task.actionId;
    if (actionId === null || task.target.full === null || task.preparedId === null)
      return Object.freeze({status: 'unknown', reason: 'FIXED_FULL_ACTION_UNAVAILABLE'});
    const result = await port.readAction({timeoutMs: 10_000, taskId: task.taskId, actionId});
    if (result.status !== 'succeeded' || result.value === null)
      return Object.freeze({status: 'unknown', reason: 'INSTALLER_STATE_UNAVAILABLE'});
    const action = result.value;
    if (
      action.taskId !== task.taskId ||
      action.actionId !== actionId ||
      action.publicationId !== task.target.full.artifact.publicationId
    )
      return Object.freeze({status: 'unknown', reason: 'INSTALLER_IDENTITY_MISMATCH'});
    if (action.state === 'waiting-user') {
      const invited = Object.freeze({...task, lastInviteAt: nowTimestampMs()});
      if (!(await writeTask(context, invited, createStatus(task.taskId, 'waiting-user', null))))
        return Object.freeze({status: 'persistence-failed', reason: 'INVITATION_TIME_PERSISTENCE_FAILED'});
      const presented = await port.presentInstallerConfirmation({
        timeoutMs: 10_000,
        taskId: task.taskId,
        actionId,
        publicationId: task.target.full.artifact.publicationId,
        trigger: 'user-confirm',
      });
      if (presented.status === 'succeeded' && presented.value.status === 'presented') {
        context.dispatchAction(actions.replaceInvitation(null));
        return Object.freeze({status: 'presented'});
      }
      return Object.freeze({
        status: presented.status === 'failed' ? 'failed' : presented.status,
        reason: presented.status === 'failed' ? presented.error.code : 'INSTALLER_CONFIRMATION_NOT_PRESENTED',
      });
    }
    if (action.state === 'user-cancelled') {
      const nextActionId = createRequestId();
      const prepared = Object.freeze({...task, actionId: nextActionId, actionKind: 'full' as const});
      const applied = await applyPreparedArtifact(context, prepared, {
        actionId: nextActionId,
        preparedId: task.preparedId,
        kind: 'full',
      });
      return applied;
    }
    if (action.state === 'accepted') {
      await writeTask(
        context,
        Object.freeze({...task, phase: 'applying-full' as const}),
        createStatus(task.taskId, 'applying', null),
      );
      context.dispatchAction(actions.replaceInvitation(null));
      return Object.freeze({status: 'installing'});
    }
    if (action.state === 'succeeded' || action.state === 'failed') {
      context.dispatchAction(actions.replaceInvitation(null));
      return reconcile(context, true);
    }
    return Object.freeze({status: 'unknown', reason: action.reason ?? 'INSTALLER_STATE_UNKNOWN'});
  };

  const deferInstall = async (
    context: ActorExecutionContext,
    payload: Parameters<typeof installDecisionIsCurrent>[1],
  ) => {
    const task = installDecisionIsCurrent(context, payload);
    if (task === null) return Object.freeze({status: 'rejected', reason: 'INSTALL_INVITATION_STALE'});
    const deferred = Object.freeze({...task, lastInviteAt: nowTimestampMs()});
    if (!(await writeTask(context, deferred, createStatus(task.taskId, 'waiting-user', null))))
      return Object.freeze({status: 'persistence-failed', reason: 'INVITATION_TIME_PERSISTENCE_FAILED'});
    context.dispatchAction(actions.replaceInvitation(null));
    return Object.freeze({status: 'deferred'});
  };

  return defineActor(moduleName, 'update-owner', [
    ...installUpdateReportCommands({actions, reportOwner, persist}),
    ...installUpdateBootCommands({execution, port, readState, reconcile, confirmBoot}),
    ...installUpdateArtifactCommands({
      reconcile: context => reconcile(context, context.command.payload.resumeFixedTask),
      deadline: context => handleDeadline(context, context.command.payload),
      confirmInstall: context => confirmInstall(context, context.command.payload),
      deferInstall: context => deferInstall(context, context.command.payload),
    }),
    installUpdateAdmissionCommands({
      actions,
      execution,
      port,
      createProtocolUuid: input.createProtocolUuid,
      readState,
      writeTask,
      persist,
      currentRuleContext,
      currentUpdateTargetBindingIdentity,
      readCurrentCandidate: async (context, target) => {
        if (input.readCurrentTarget !== undefined) return input.readCurrentTarget(context.getState(), target);
        return sourceProvider === undefined ? null : sourceProvider.readTarget(target.selectionContext);
      },
      hasCurrentCandidateReader: input.readCurrentTarget !== undefined || sourceProvider !== undefined,
      reportAdmissionWarning: logLifecycleWarning,
      releaseUnreferencedFullArtifact,
      executeNextArtifact,
      reconcile,
    }),
  ]);
};

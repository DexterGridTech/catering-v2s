import {createRequestId, nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {
  defineActor,
  onCommand,
  type ActorExecutionContext,
  type ActorDefinition,
  primarySurfaceReadyCommand,
} from '@catering-v2s/kernel-base-runtime';
import type {
  TerminalUpdateArtifact,
  UpdateActualVersions,
  UpdateFacts,
  UpdatePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName} from '../../moduleName';
import {terminalUpdateSliceName} from '../slices/terminalUpdate';
import {terminalUpdateActions} from '../slices/terminalUpdate';
import {
  acceptTerminalUpdateTargetCommand,
  confirmTerminalUpdateBootCommand,
  reconcileTerminalUpdateCommand,
} from '../commands/commands';
import type {
  FixedUpdateTarget,
  TerminalUpdateState,
  TerminalUpdateTask,
  UpdateNetworkSnapshotReader,
  UpdateTargetSourceProvider,
} from '../../types/terminalUpdate';

type TerminalUpdateActorInput = Readonly<{
  port: UpdatePort;
  sourceProvider: UpdateTargetSourceProvider;
  actions?: typeof terminalUpdateActions;
  readNetworkSnapshot?: UpdateNetworkSnapshotReader;
}>;

const invalid = (code: string): never => {
  throw new Error(`TERMINAL_UPDATE_${code}`);
};
const readState = (context: ActorExecutionContext): TerminalUpdateState => {
  const value = context.getState()[terminalUpdateSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid('STATE_MISSING');
  return value as TerminalUpdateState;
};
const persist = async (context: ActorExecutionContext): Promise<boolean> =>
  (await context.flushPersistence()).status === 'succeeded';
const validTarget = (target: FixedUpdateTarget): boolean =>
  typeof target.ruleRef === 'string' &&
  target.ruleRef.length > 0 &&
  typeof target.applicationId === 'string' &&
  target.applicationId.length > 0 &&
  (target.full !== null || target.hot !== null) &&
  (target.full === null || target.full.artifact.applicationId === target.applicationId) &&
  (target.hot === null || target.hot.artifact.applicationId === target.applicationId) &&
  (target.full === null ||
    target.hot === null ||
    target.full.artifact.runtimeVersion === target.hot.artifact.runtimeVersion) &&
  Number.isSafeInteger(target.strategy.maxNetworkAttempts) &&
  target.strategy.maxNetworkAttempts >= 0 &&
  Number.isSafeInteger(target.strategy.bootTimeoutMs) &&
  target.strategy.bootTimeoutMs > 0;

const createStatus = (
  taskId: string | null,
  state: TerminalUpdateState['recentStatus']['state'],
  reason: string | null,
) => Object.freeze({taskId, state, reason, changedAt: nowTimestampMs()});

const compareVersion = (left: string, right: string): number => {
  const parse = (value: string): readonly number[] => {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value)) invalid('VERSION_INVALID');
    return value.split('.').map(Number);
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
};

const nextArtifact = (
  target: FixedUpdateTarget,
  actual: UpdateActualVersions | null,
  embedded: UpdateFacts['embedded'],
  originalBundleVersion: string,
): Readonly<{
  kind: 'full' | 'hot';
  sourceRef: string;
  expectedSha256: string;
  artifact: TerminalUpdateArtifact;
}> | null => {
  if (actual === null || actual.applicationId !== target.applicationId) return invalid('ACTUAL_IDENTITY_UNAVAILABLE');
  const full = target.full;
  const hot = target.hot;
  const finalBundleVersion = hot?.artifact.bundleVersion ?? full?.artifact.bundleVersion;
  if (finalBundleVersion !== undefined && compareVersion(finalBundleVersion, originalBundleVersion) < 0)
    return invalid(hot === null ? 'FULL_ONLY_VERSION_DOWNGRADE' : 'HOT_VERSION_DOWNGRADE');
  if (full !== null) {
    if (actual.nativeBuildNumber < full.artifact.nativeBuildNumber) {
      return Object.freeze({kind: 'full', ...full});
    }
    if (
      actual.nativeBuildNumber === full.artifact.nativeBuildNumber &&
      (embedded === null ||
        embedded.applicationId !== full.artifact.applicationId ||
        embedded.nativeBuildNumber !== full.artifact.nativeBuildNumber ||
        embedded.runtimeVersion !== full.artifact.runtimeVersion ||
        embedded.publicationId !== full.artifact.publicationId)
    ) {
      return invalid('FULL_IDENTITY_CONFLICT');
    }
    if (hot === null && full.artifact.runtimeVersion !== actual.runtimeVersion) return invalid('FULL_RUNTIME_MISMATCH');
  }
  if (hot !== null) {
    if (hot.artifact.runtimeVersion !== actual.runtimeVersion) {
      return invalid('HOT_RUNTIME_MISMATCH');
    }
    const order = compareVersion(hot.artifact.bundleVersion, actual.bundleVersion);
    if (order < 0) return invalid('HOT_VERSION_DOWNGRADE');
    if (order > 0) return Object.freeze({kind: 'hot', ...hot});
    if (hot.artifact.publicationId !== actual.publicationId) return invalid('HOT_IDENTITY_CONFLICT');
  }
  return null;
};

export const createTerminalUpdateActor = (input: TerminalUpdateActorInput): ActorDefinition => {
  const {port, sourceProvider, readNetworkSnapshot} = input;
  const actions = input.actions ?? terminalUpdateActions;
  let targetCommitPending: Promise<void> | null = null;
  const writeTask = async (
    context: ActorExecutionContext,
    task: TerminalUpdateTask | null,
    status: TerminalUpdateState['recentStatus'],
  ): Promise<boolean> => {
    context.dispatchAction(actions.replaceTask(task));
    context.dispatchAction(actions.replaceRecentStatus(status));
    return persist(context);
  };

  const recordFailedArtifact = (context: ActorExecutionContext, task: TerminalUpdateTask, publicationId: string) => {
    const isFixedArtifact =
      task.target.full?.artifact.publicationId === publicationId ||
      task.target.hot?.artifact.publicationId === publicationId;
    if (!isFixedArtifact) return;
    const failedArtifactIds = readState(context).failedArtifactIds;
    if (!failedArtifactIds.includes(publicationId)) {
      context.dispatchAction(actions.replaceFailedArtifactIds([...failedArtifactIds, publicationId]));
    }
  };

  const releaseUnreferencedFullArtifact = async (task: TerminalUpdateTask, publicationId: string): Promise<boolean> => {
    if (task.preparedId === null || task.target.full?.artifact.publicationId !== publicationId) return true;
    const released = await port.releasePrepared({timeoutMs: 10_000, preparedId: task.preparedId});
    return released.status === 'succeeded' && released.value.released;
  };

  const executeNextArtifact = async (context: ActorExecutionContext, task: TerminalUpdateTask) => {
    let factsResult = await port.readFacts({timeoutMs: 10_000});
    if (factsResult.status !== 'succeeded') {
      context.dispatchAction(
        actions.replaceRecentStatus(createStatus(task.taskId, 'unknown', 'ACTUAL_FACTS_UNAVAILABLE')),
      );
      return Object.freeze({status: 'unknown', reason: factsResult.status});
    }
    context.dispatchAction(actions.replaceActualVersions(factsResult.value.actual));
    let fixedTask = task;
    if (fixedTask.originalBundleVersion == null || fixedTask.bootId === null) {
      const snapshot = Object.freeze({
        ...fixedTask,
        originalBundleVersion: fixedTask.originalBundleVersion ?? factsResult.value.actual?.bundleVersion ?? null,
        bootId: fixedTask.bootId ?? factsResult.value.actual?.bootId ?? null,
      });
      if (snapshot.originalBundleVersion === null || snapshot.bootId === null) {
        return Object.freeze({status: 'unknown', reason: 'ACTUAL_BUNDLE_VERSION_UNAVAILABLE'});
      }
      if (!(await writeTask(context, snapshot, createStatus(task.taskId, 'fixed', null))))
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_BEFORE_SELECTION'});
      fixedTask = snapshot;
    }
    if (fixedTask.originalBundleVersion == null) {
      return Object.freeze({status: 'unknown', reason: 'ORIGINAL_BUNDLE_VERSION_UNAVAILABLE'});
    }
    let selected: ReturnType<typeof nextArtifact>;
    try {
      selected = nextArtifact(
        fixedTask.target,
        factsResult.value.actual,
        factsResult.value.embedded,
        fixedTask.originalBundleVersion,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message.replace(/^TERMINAL_UPDATE_/u, '') : 'TARGET_INVALID';
      const failedTask = Object.freeze({...fixedTask, phase: 'failed' as const, failureCode: reason});
      await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
      return Object.freeze({status: 'failed', reason});
    }
    if (selected === null) {
      const complete = Object.freeze({
        ...fixedTask,
        phase: 'succeeded' as const,
        actionId: null,
        actionKind: null,
        preparedId: null,
        bootId: factsResult.value.actual?.bootId ?? fixedTask.bootId,
      });
      await writeTask(context, complete, createStatus(task.taskId, 'succeeded', null));
      return Object.freeze({status: 'succeeded'});
    }
    if (readState(context).failedArtifactIds.includes(selected.artifact.publicationId)) {
      const reason = 'FAILED_ARTIFACT_REENTRY_FORBIDDEN';
      const failedTask = Object.freeze({...fixedTask, phase: 'failed' as const, failureCode: reason});
      await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
      return Object.freeze({status: 'failed', reason});
    }
    if (readNetworkSnapshot === undefined || sourceProvider.resolveSourcePath === undefined) {
      const reason = 'UPDATE_SOURCE_OR_NETWORK_UNAVAILABLE';
      const failedTask = Object.freeze({...fixedTask, phase: 'failed' as const, failureCode: reason});
      await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
      return Object.freeze({status: 'failed', reason});
    }
    const actionId = createRequestId();
    const preparingPhase = selected.kind === 'full' ? ('preparing-full' as const) : ('preparing-hot' as const);
    const beforePrepare = Object.freeze({
      ...fixedTask,
      actionId,
      actionKind: selected.kind,
      preparedId: null,
      phase: preparingPhase,
    });
    if (!(await writeTask(context, beforePrepare, createStatus(task.taskId, 'preparing', null)))) {
      const reason = 'PERSISTENCE_FAILED_BEFORE_PREPARE';
      await writeTask(context, fixedTask, createStatus(task.taskId, 'fixed', reason));
      return Object.freeze({status: 'persistence-failed', reason});
    }

    const sourcePath = sourceProvider.resolveSourcePath(selected.sourceRef);
    if (sourcePath === null) {
      const reason = 'SOURCE_UNAVAILABLE';
      const failedTask = Object.freeze({...beforePrepare, phase: 'failed' as const, failureCode: reason});
      await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
      return Object.freeze({status: 'failed', reason});
    }
    const network = readNetworkSnapshot(context.getState(), 'business');
    const prepared = await port.prepareArtifact({
      timeoutMs: 120_000,
      sourceRef: selected.sourceRef,
      expectedSha256: selected.expectedSha256,
      artifact: selected.artifact,
      sourcePath,
      network,
      kind: selected.kind,
    });
    if (prepared.status !== 'succeeded') {
      const reason = prepared.status === 'failed' ? prepared.error.code : `PREPARE_${prepared.status.toUpperCase()}`;
      const state =
        prepared.status === 'timed-out' || prepared.status === 'unavailable'
          ? ('unknown' as const)
          : ('failed' as const);
      const failedTask = Object.freeze({...beforePrepare, phase: state, failureCode: reason});
      if (state === 'failed') recordFailedArtifact(context, fixedTask, selected.artifact.publicationId);
      await writeTask(context, failedTask, createStatus(task.taskId, state, reason));
      return Object.freeze({status: state, reason});
    }

    const applyingPhase = selected.kind === 'full' ? ('applying-full' as const) : ('applying-hot' as const);
    const applying = Object.freeze({...beforePrepare, preparedId: prepared.value.preparedId, phase: applyingPhase});
    if (!(await writeTask(context, applying, createStatus(task.taskId, 'applying', null)))) {
      await port.releasePrepared({timeoutMs: 10_000, preparedId: prepared.value.preparedId});
      const reason = 'PERSISTENCE_FAILED_BEFORE_APPLY';
      await writeTask(context, task, createStatus(task.taskId, 'fixed', reason));
      return Object.freeze({status: 'persistence-failed', reason});
    }

    const applied = await port.applyPrepared({
      timeoutMs: selected.kind === 'hot' ? 60_000 : 120_000,
      taskId: task.taskId,
      actionId,
      preparedId: prepared.value.preparedId,
      kind: selected.kind,
    });
    if (applied.status !== 'succeeded') {
      const reason = applied.status === 'failed' ? applied.error.code : `APPLY_${applied.status.toUpperCase()}`;
      const state =
        applied.status === 'timed-out' || applied.status === 'unavailable' ? ('unknown' as const) : ('failed' as const);
      const failedTask = Object.freeze({...applying, phase: state, failureCode: reason});
      if (state === 'failed') recordFailedArtifact(context, fixedTask, selected.artifact.publicationId);
      await writeTask(context, failedTask, createStatus(task.taskId, state, reason));
      return Object.freeze({status: state, reason});
    }
    const action = applied.value;
    if (action.taskId !== task.taskId || action.actionId !== applying.actionId) {
      const reason = 'ACTION_IDENTITY_MISMATCH';
      await writeTask(context, applying, createStatus(task.taskId, 'unknown', reason));
      return Object.freeze({status: 'unknown', reason});
    }
    if (action.state === 'failed') recordFailedArtifact(context, fixedTask, action.publicationId);
    const fullActionTerminal = selected.kind === 'full' && (action.state === 'succeeded' || action.state === 'failed');
    const fullPreparedReleased =
      !fullActionTerminal || (await releaseUnreferencedFullArtifact(applying, action.publicationId));
    const status =
      action.state === 'waiting-user' || action.state === 'user-cancelled'
        ? ('waiting-user' as const)
        : action.state === 'failed'
          ? ('failed' as const)
          : action.state === 'succeeded'
            ? ('succeeded' as const)
            : action.state === 'unknown'
              ? ('unknown' as const)
              : ('applying' as const);
    const phase =
      action.state === 'waiting-user' || action.state === 'user-cancelled'
        ? ('waiting-user' as const)
        : action.state === 'failed'
          ? ('failed' as const)
          : action.state === 'succeeded'
            ? ('succeeded' as const)
            : action.state === 'unknown' && action.reason !== 'INSTALLER_AWAITING_READBACK'
              ? ('unknown' as const)
              : applyingPhase;
    if (fullActionTerminal && !fullPreparedReleased) {
      await writeTask(context, applying, createStatus(task.taskId, 'unknown', 'PREPARED_RELEASE_FAILED'));
      return Object.freeze({status: 'cleanup-failed', reason: 'PREPARED_RELEASE_FAILED'});
    }
    const next = Object.freeze({
      ...applying,
      phase,
      preparedId: fullActionTerminal ? null : applying.preparedId,
      failureCode: status === 'failed' ? action.reason : null,
    });
    await writeTask(context, next, createStatus(task.taskId, status, action.reason));
    return Object.freeze({status, actionId: action.actionId, reason: action.reason});
  };

  const reconcile = async (context: ActorExecutionContext, resumeFixedTask: boolean) => {
    const runNextArtifact = async (task: TerminalUpdateTask) => {
      const result = await executeNextArtifact(context, task);
      if (
        result.status === 'unknown' &&
        'reason' in result &&
        (result.reason === 'ACTUAL_BUNDLE_VERSION_UNAVAILABLE' ||
          result.reason === 'ORIGINAL_BUNDLE_VERSION_UNAVAILABLE')
      ) {
        context.dispatchAction(actions.replaceRecentStatus(createStatus(task.taskId, 'unknown', result.reason)));
      }
      return result;
    };
    const result = await port.readFacts({timeoutMs: 10_000});
    if (result.status !== 'succeeded') return Object.freeze({status: 'unavailable', reason: result.status});
    context.dispatchAction(actions.replaceActualVersions(result.value.actual));
    const task = readState(context).currentTask;
    if (task === null) return Object.freeze({status: 'read'});
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
    if (task.actionId === null)
      return task.phase === 'fixed' ? runNextArtifact(task) : Object.freeze({status: task.phase});
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
    if (action.state === 'accepted') {
      // The native system accepted the action but has not reported a terminal
      // outcome. Preserve the task phase and action identity for the next real
      // readback; treating this as UNKNOWN loses the FULL→HOT continuation.
      await writeTask(context, task, createStatus(task.taskId, 'applying', null));
      return Object.freeze({status: 'applying', actionId: task.actionId});
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
        bootId: actualBootId,
      });
      if (!(await writeTask(context, fixed, createStatus(task.taskId, 'fixed', null))))
        return Object.freeze({status: 'persistence-failed', taskId: task.taskId});
      if (!resumeFixedTask) {
        return Object.freeze({status: 'fixed', continuation: 'PRIMARY_READY'});
      }
      return runNextArtifact(fixed);
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
      bootId: action.state === 'succeeded' ? actualBootId : (action.bootId ?? task.bootId),
      failureCode: status === 'failed' ? action.reason : null,
    });
    await writeTask(context, updated, createStatus(task.taskId, status, action.reason));
    return Object.freeze({status, reason: action.reason});
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

  return defineActor(moduleName, 'update-owner', [
    onCommand(primarySurfaceReadyCommand, context => {
      const current = readState(context);
      const task = current.currentTask;
      context.platformPorts.logger.info({
        category: 'terminal-update.primary-ready',
        event: 'terminal-update.primary-ready-received',
        message: 'Terminal update owner received the generic primary-surface readiness fact',
        data: {
          contentReady: context.command.payload.contentReady,
          taskPhase: task?.phase ?? 'NONE',
          actionPending: task?.actionId === null || task === null ? 0 : 1,
        },
      });
      if (!context.command.payload.contentReady) return Object.freeze({status: 'not-ready'});
      const actual = current.actualVersions;
      // Primary readiness is a lifecycle acknowledgement, not an update
      // completion barrier. A resumed artifact may wait on network/storage for
      // minutes; keeping that work on the startup actor leaves the native
      // loading surface over the now-rendered app and prevents real UI input.
      // Keep update policy here in the base owner, but run it through the
      // existing commands after acknowledging the readiness fact.
      if (actual === null) return Object.freeze({status: 'actual-boot-unavailable'});
      void (async () => {
        const result = await context.dispatchCommand(confirmTerminalUpdateBootCommand, {
          bootToken: actual.bootId,
          publicationId: actual.publicationId,
        });
        context.platformPorts.logger.info({
          category: 'terminal-update.primary-ready',
          event: 'terminal-update.primary-ready-continuation-result',
          message: 'Terminal update owner completed its primary-ready readback',
          data: {
            taskId: task?.taskId ?? null,
            dispatchStatus: result.status,
          },
        });
      })().catch(error => {
        context.platformPorts.logger.error({
          category: 'terminal-update.primary-ready',
          event: 'terminal-update.primary-ready-continuation-failed',
          message: 'Terminal update owner failed its asynchronous primary-ready continuation',
          data: {taskId: task?.taskId ?? null, errorName: error instanceof Error ? error.name : 'UnknownError'},
        });
      });
      return Object.freeze({status: 'scheduled', taskId: task?.taskId ?? null});
    }),
    onCommand(reconcileTerminalUpdateCommand, context => reconcile(context, context.command.payload.resumeFixedTask)),
    onCommand(acceptTerminalUpdateTargetCommand, async context => {
      const runNextArtifact = async (task: TerminalUpdateTask) => {
        const result = await executeNextArtifact(context, task);
        if (
          result.status === 'unknown' &&
          'reason' in result &&
          (result.reason === 'ACTUAL_BUNDLE_VERSION_UNAVAILABLE' ||
            result.reason === 'ORIGINAL_BUNDLE_VERSION_UNAVAILABLE')
        ) {
          context.dispatchAction(actions.replaceRecentStatus(createStatus(task.taskId, 'unknown', result.reason)));
        }
        return result;
      };
      const resumeAfterCancelledInstall = async (task: TerminalUpdateTask, publicationId: string) => {
        // A later explicit acceptance may recreate a session for the same fixed
        // target. Pending or unknown installer sessions stay untouched.
        if (task.target.full?.artifact.publicationId !== publicationId) {
          const reason = 'ACTION_ARTIFACT_IDENTITY_MISMATCH';
          await writeTask(context, task, createStatus(task.taskId, 'unknown', reason));
          return Object.freeze({status: 'unknown', reason});
        }
        if (!(await releaseUnreferencedFullArtifact(task, publicationId))) {
          await writeTask(context, task, createStatus(task.taskId, 'unknown', 'PREPARED_RELEASE_FAILED'));
          return Object.freeze({status: 'cleanup-failed', reason: 'PREPARED_RELEASE_FAILED'});
        }
        const ready = Object.freeze({
          ...task,
          phase: 'fixed' as const,
          actionId: null,
          actionKind: null,
          preparedId: null,
          failureCode: null,
        });
        if (!(await writeTask(context, ready, createStatus(task.taskId, 'fixed', null))))
          return Object.freeze({status: 'persistence-failed', taskId: task.taskId});
        return runNextArtifact(ready);
      };
      const selectionContext = context.command.payload.selectionContext;
      if (targetCommitPending !== null) await targetCommitPending;
      const current = readState(context);
      if (current.currentTask !== null) {
        const sameSelection =
          JSON.stringify(current.currentTask.target.selectionContext) === JSON.stringify(selectionContext);
        if (!sameSelection) return Object.freeze({status: 'rejected', reason: 'IDENTITY_CONFLICT'});
        const task = current.currentTask;
        if (task.actionId !== null) {
          const observed = await port.readAction({timeoutMs: 10_000, taskId: task.taskId, actionId: task.actionId});
          if (
            observed.status !== 'succeeded' ||
            observed.value === null ||
            observed.value.taskId !== task.taskId ||
            observed.value.actionId !== task.actionId
          ) {
            return Object.freeze({status: 'unknown', reason: 'INSTALLER_STATE_UNAVAILABLE'});
          }
          if (observed.value.state === 'user-cancelled')
            return resumeAfterCancelledInstall(task, observed.value.publicationId);
        }
        return Object.freeze({status: 'already-fixed', reason: null});
      }

      const target = await sourceProvider.readTarget(selectionContext);
      if (target === null) return Object.freeze({status: 'rejected', reason: 'SOURCE_UNAVAILABLE'});
      if (!validTarget(target) || JSON.stringify(target.selectionContext) !== JSON.stringify(selectionContext))
        return Object.freeze({status: 'rejected', reason: 'TARGET_INVALID'});

      // Another root command may have fixed a target while the provider was awaited.
      // Serialize only this persistence commit, then re-read its authoritative result.
      if (targetCommitPending !== null) await targetCommitPending;
      const latestTask = readState(context).currentTask;
      if (latestTask !== null) {
        const sameTarget = JSON.stringify(latestTask.target) === JSON.stringify(target);
        return Object.freeze({
          status: sameTarget ? 'already-fixed' : 'rejected',
          reason: sameTarget ? null : 'IDENTITY_CONFLICT',
        });
      }
      const taskId = `update:${target.ruleRef}:${target.createdAt}`;
      const task: TerminalUpdateTask = Object.freeze({
        taskId,
        target,
        phase: 'fixed',
        actionId: null,
        actionKind: null,
        preparedId: null,
        bootId: null,
        failureCode: null,
        originalBundleVersion: null,
      });
      let finishTargetCommit!: () => void;
      const targetCommit = new Promise<void>(resolve => {
        finishTargetCommit = resolve;
      });
      targetCommitPending = targetCommit;
      const beforeCommit = readState(context);
      try {
        context.dispatchAction(actions.replaceTask(task));
        context.dispatchAction(actions.replaceRecentStatus(createStatus(taskId, 'fixed', null)));
        if (!(await persist(context))) {
          context.dispatchAction(actions.replaceTask(beforeCommit.currentTask));
          context.dispatchAction(actions.replaceRecentStatus(beforeCommit.recentStatus));
          await persist(context);
          return Object.freeze({status: 'persistence-failed', taskId});
        }
      } finally {
        if (targetCommitPending === targetCommit) targetCommitPending = null;
        finishTargetCommit();
      }
      return runNextArtifact(task);
    }),
    onCommand(confirmTerminalUpdateBootCommand, context => confirmBoot(context, context.command.payload)),
  ]);
};
